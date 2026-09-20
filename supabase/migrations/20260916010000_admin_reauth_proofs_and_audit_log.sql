-- TEKANGO Admin V1 (Task 3, Protected Admin Actions + Security).
-- Adds the two tables the current Admin protected-action flow lacks:
--
-- 1. admin_reauth_proofs: a server-minted, short-lived, single-use proof
--    that a sensitive Admin action was genuinely preceded by a fresh
--    password re-authentication, bound to the specific caller, action,
--    target and parameters it was minted for. Today's flow re-verifies the
--    admin's password via signInWithPassword on the CLIENT and then
--    proceeds independently to the privileged write - a real password
--    check, but not cryptographically tied to the write that follows. This
--    table closes that gap: the password check now happens server-side (in
--    the admin-reauth-verify Edge Function), which mints a row here; every
--    privileged Edge Function then must atomically claim a matching,
--    unexpired, unused row before doing anything else, or it refuses.
--
-- 2. admin_audit_log: an append-only record of privileged Admin actions
--    (actor/target/action/reason/before-after state/outcome), closing the
--    disclosed gap AdminSystemActivity.jsx's own comments already
--    document ("this schema does not persist an audit log").
--
-- Both tables are service-role-only (RLS enabled, no policy grants either
-- table to `anon`/`authenticated` at all) - the only code that ever reads
-- or writes them is the Edge Functions below, using the Service Role key.
-- This mirrors the existing pattern in 20260830000001_capture_base_
-- functions_triggers.sql (is_admin()/is_super_admin() are SECURITY DEFINER,
-- REVOKEd from anon) and in admin-delete-user/admin-cleanup-user-quotes
-- (server-side role re-verification via the Service Role client, never
-- trusting a client-supplied claim).

CREATE TABLE IF NOT EXISTS public.admin_reauth_proofs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action         text NOT NULL,
  target_user_id uuid,
  params_hash    text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz
);

COMMENT ON TABLE public.admin_reauth_proofs IS
  'Server-minted, short-lived (5 min), single-use proof that a fresh password re-authentication preceded one specific privileged Admin action, bound to actor/action/target/params. Claimed atomically (UPDATE ... WHERE used_at IS NULL) by the privileged Edge Function it was minted for; never read/written by client code directly.';
COMMENT ON COLUMN public.admin_reauth_proofs.params_hash IS
  'SHA-256 hex digest of the action-specific parameters (e.g. {targetUserId, reason}) the proof was minted for - a mismatched hash at claim time means the caller is trying to reuse a proof for different parameters than it was issued for, and is refused.';

CREATE INDEX IF NOT EXISTS admin_reauth_proofs_actor_idx ON public.admin_reauth_proofs(actor_user_id);
CREATE INDEX IF NOT EXISTS admin_reauth_proofs_expires_idx ON public.admin_reauth_proofs(expires_at);

ALTER TABLE public.admin_reauth_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_reauth_proofs FROM anon;
REVOKE ALL ON public.admin_reauth_proofs FROM authenticated;
-- No GRANT to anon/authenticated and no policy is created on purpose: this
-- table is reachable only via the Service Role key inside Edge Functions,
-- exactly like admin-delete-user's own targetBiz/callerBiz lookups.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid,
  action         text NOT NULL,
  reason         text,
  before_state   jsonb,
  after_state    jsonb,
  outcome        text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_audit_log IS
  'Append-only history of privileged Admin actions (Grant/Revoke Lifetime, Extend Trial, Delete Account, quote cleanup), written by the Edge Functions that perform each action, after it resolves (success or failure). Never contains a password, a reauth proof secret, or customer document contents - only structural before/after fields (e.g. {is_lifetime}, {trial_ends_at}). Closes the disclosed gap AdminSystemActivity.jsx previously reported ("this schema does not persist an audit log") for actions going forward; does not retroactively invent history for earlier changes.';
COMMENT ON COLUMN public.admin_audit_log.outcome IS
  'One of: success, denied, error. denied covers role/eligibility/proof failures caught before any mutation; error covers a failure during/after the mutation attempt.';

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON public.admin_audit_log(target_user_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM anon;
REVOKE ALL ON public.admin_audit_log FROM authenticated;
-- Read access for AdminSystemActivity.jsx's UI also goes through a
-- SECURITY DEFINER function (below), not a direct RLS policy grant to
-- `authenticated` - so a super_admin's read is still server-verified per
-- call (matching is_admin()/is_super_admin()'s own existing pattern),
-- not merely "any authenticated row-owner can select their own rows".

CREATE OR REPLACE FUNCTION public.get_admin_audit_log(p_limit int DEFAULT 50)
RETURNS SETOF public.admin_audit_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super_admin role required';
  END IF;
  RETURN QUERY
    SELECT * FROM public.admin_audit_log
    ORDER BY created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_audit_log(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log(int) TO authenticated;
