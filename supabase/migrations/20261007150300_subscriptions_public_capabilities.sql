-- ============================================================================================================================
-- 20261007150300_subscriptions_public_capabilities.sql  -  public capability tokens, legacy link allowlist, output grants
-- tekango-migration-contract: mode=transaction replay=required
--
--   CROSSCUT_CONTRACT.md section 2.3. Inert until the DB owner raises the phase: nothing mints a token or a grant unless the
--   orchestrator holds a FINALIZED output attempt (which the prepared saga only produces in phase shadow/enforced). Never
--   applied to TEST/Production by this change.
--   Tokens: only sha256(raw token) is stored (64 lowercase hex); the raw token never reaches the database. Clients may read their
--   own rows WITHOUT token_hash (column grants); every write goes through the SECURITY DEFINER functions below; revocation is
--   one-way (trigger). resolve / redeem answer a uniform not_found for every failure (anti-enumeration).
--   Legacy links: record_legacy_public_links (DB owner only, refused once free_issue is enforced) records every quote that is not
--   Draft or carries a signature, so links that exist at cutover keep working; a quote ID alone never exposes a later quote.
--   Every SECURITY DEFINER function pins search_path = public, pg_temp and revokes EXECUTE from PUBLIC and every API role
--   before the explicit grants. Requires 20261007150000 (quote_output_attempts, subscription_activation).
--   Re-runnable: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- ============================================================================================================================

-- shared append-only guard of this cross-cutting layer (also used by 20261007150400)
CREATE OR REPLACE FUNCTION public.xcut_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION '% is append-only (% refused)', TG_TABLE_NAME, TG_OP USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION public.xcut_append_only_guard() FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 1. Public capability tokens
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_public_capabilities (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash      text        NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id         uuid        NOT NULL,
  quote_id        uuid        NOT NULL,
  attempt_id      uuid        NOT NULL,
  snapshot_path   text        NOT NULL,
  snapshot_sha256 text        NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  allowed_ops     text[]      NOT NULL CHECK (allowed_ops <@ ARRAY['view', 'approve']::text[] AND cardinality(allowed_ops) >= 1),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NULL,
  revoked_at      timestamptz NULL,
  revoked_reason  text        NULL CHECK (revoked_reason IS NULL OR length(revoked_reason) BETWEEN 1 AND 200),
  CONSTRAINT quote_public_capabilities_expiry CHECK (expires_at IS NULL OR expires_at > created_at),
  CONSTRAINT quote_public_capabilities_revoked_shape CHECK (revoked_at IS NOT NULL OR revoked_reason IS NULL)
);
CREATE INDEX IF NOT EXISTS quote_public_capabilities_by_user ON public.quote_public_capabilities (user_id, quote_id);
ALTER TABLE public.quote_public_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_public_capabilities FROM PUBLIC, anon, authenticated, service_role;
-- own rows, every column EXCEPT token_hash
GRANT SELECT (id, user_id, quote_id, attempt_id, snapshot_path, snapshot_sha256, allowed_ops, created_at, expires_at, revoked_at,
              revoked_reason) ON public.quote_public_capabilities TO authenticated;
GRANT SELECT ON public.quote_public_capabilities TO service_role;
DROP POLICY IF EXISTS quote_public_capabilities_own_read ON public.quote_public_capabilities;
CREATE POLICY quote_public_capabilities_own_read ON public.quote_public_capabilities
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS quote_public_capabilities_service_read ON public.quote_public_capabilities;
CREATE POLICY quote_public_capabilities_service_read ON public.quote_public_capabilities
  FOR SELECT TO service_role USING (true);

-- one-way revocation: the only allowed change is revoked_at NULL -> NOT NULL (+ reason); no delete / truncate for any role
CREATE OR REPLACE FUNCTION public.quote_public_capabilities_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'quote_public_capabilities: % refused (revocation is the only change)', TG_OP USING ERRCODE = '42501';
  END IF;
  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
     OR (NEW.id, NEW.token_hash, NEW.user_id, NEW.quote_id, NEW.attempt_id, NEW.snapshot_path, NEW.snapshot_sha256, NEW.allowed_ops,
         NEW.created_at, NEW.expires_at)
        IS DISTINCT FROM
        (OLD.id, OLD.token_hash, OLD.user_id, OLD.quote_id, OLD.attempt_id, OLD.snapshot_path, OLD.snapshot_sha256, OLD.allowed_ops,
         OLD.created_at, OLD.expires_at) THEN
    RAISE EXCEPTION 'quote_public_capabilities: only a one-way revocation is allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_public_capabilities_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quote_public_capabilities_guard_row ON public.quote_public_capabilities;
CREATE TRIGGER quote_public_capabilities_guard_row BEFORE UPDATE OR DELETE ON public.quote_public_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.quote_public_capabilities_guard();
DROP TRIGGER IF EXISTS quote_public_capabilities_guard_truncate ON public.quote_public_capabilities;
CREATE TRIGGER quote_public_capabilities_guard_truncate BEFORE TRUNCATE ON public.quote_public_capabilities
  FOR EACH STATEMENT EXECUTE FUNCTION public.quote_public_capabilities_guard();

-- mint (service_role): ANY FINALIZED attempt of that user (send / public_share / final_pdf / final_print - the quote has one final
-- artifact and approved reuse never consumes again, OD-02; approval/signature use the same artifact). Quote / snapshot are bound
-- from the attempt, never from the caller. Idempotent on token_hash (same binding -> replay; other binding -> conflict).
CREATE OR REPLACE FUNCTION public.mint_public_capability(p_user_id uuid, p_attempt_id uuid, p_token_hash text, p_allowed_ops text[],
                                                         p_expires_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_a   public.quote_output_attempts%ROWTYPE;
  v_ops text[];
  v_row public.quote_public_capabilities%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_attempt_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_allowed_ops IS NULL OR cardinality(p_allowed_ops) < 1 OR array_position(p_allowed_ops, NULL) IS NOT NULL
     OR NOT (p_allowed_ops <@ ARRAY['view', 'approve']::text[])
     OR (p_expires_at IS NOT NULL AND p_expires_at <= now()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  v_ops := (SELECT array_agg(DISTINCT o ORDER BY o) FROM unnest(p_allowed_ops) o);
  SELECT * INTO v_a FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id AND a.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_not_found');   -- also another user's attempt
  END IF;
  IF v_a.state <> 'finalized' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_not_finalized');
  END IF;
  INSERT INTO public.quote_public_capabilities (token_hash, user_id, quote_id, attempt_id, snapshot_path, snapshot_sha256,
                                                allowed_ops, expires_at)
  VALUES (p_token_hash, p_user_id, v_a.quote_id, v_a.attempt_id, v_a.snapshot_path, v_a.snapshot_sha256, v_ops, p_expires_at)
  ON CONFLICT (token_hash) DO NOTHING
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.quote_public_capabilities c WHERE c.token_hash = p_token_hash;
    IF v_row.user_id <> p_user_id OR v_row.attempt_id <> p_attempt_id OR v_row.allowed_ops <> v_ops
       OR v_row.expires_at IS DISTINCT FROM p_expires_at THEN
      RETURN jsonb_build_object('ok', false, 'code', 'token_conflict');
    END IF;
    RETURN jsonb_build_object('ok', true, 'replay', true, 'capabilityId', v_row.id, 'quoteId', v_row.quote_id,
                              'attemptId', v_row.attempt_id, 'ops', to_jsonb(v_row.allowed_ops), 'expiresAt', v_row.expires_at);
  END IF;
  RETURN jsonb_build_object('ok', true, 'replay', false, 'capabilityId', v_row.id, 'quoteId', v_row.quote_id,
                            'attemptId', v_row.attempt_id, 'ops', to_jsonb(v_row.allowed_ops), 'expiresAt', v_row.expires_at);
END
$function$;
REVOKE ALL ON FUNCTION public.mint_public_capability(uuid, uuid, text, text[], timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mint_public_capability(uuid, uuid, text, text[], timestamptz) TO service_role;

-- resolve (service_role): uniform not_found for unknown / revoked / expired / op not allowed / malformed input
CREATE OR REPLACE FUNCTION public.resolve_public_capability(p_token_hash text, p_op text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row public.quote_public_capabilities%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' OR p_op IS NULL OR p_op NOT IN ('view', 'approve') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  SELECT * INTO v_row FROM public.quote_public_capabilities c
   WHERE c.token_hash = p_token_hash AND c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > now())
     AND p_op = ANY (c.allowed_ops);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'capabilityId', v_row.id, 'userId', v_row.user_id, 'quoteId', v_row.quote_id,
                            'attemptId', v_row.attempt_id, 'snapshotPath', v_row.snapshot_path,
                            'snapshotSha256', v_row.snapshot_sha256, 'ops', to_jsonb(v_row.allowed_ops));
END
$function$;
REVOKE ALL ON FUNCTION public.resolve_public_capability(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_public_capability(text, text) TO service_role;

-- revoke (authenticated, own rows only; one-way, idempotent)
CREATE OR REPLACE FUNCTION public.revoke_public_capability(p_capability_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.quote_public_capabilities%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;
  SELECT * INTO v_row FROM public.quote_public_capabilities c WHERE c.id = p_capability_id AND c.user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'revoked', true, 'changed', false, 'revokedAt', v_row.revoked_at);
  END IF;
  UPDATE public.quote_public_capabilities
     SET revoked_at = now(), revoked_reason = left(coalesce(nullif(btrim(p_reason), ''), 'owner_revoked'), 200)
   WHERE id = v_row.id
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', true, 'revoked', true, 'changed', true, 'revokedAt', v_row.revoked_at);
END
$function$;
REVOKE ALL ON FUNCTION public.revoke_public_capability(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_public_capability(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 2. Legacy public links allowlist (cutover)
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legacy_public_quote_links (
  quote_id    uuid        PRIMARY KEY,
  user_id     uuid        NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legacy_public_quote_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacy_public_quote_links FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.legacy_public_quote_links TO service_role;
DROP POLICY IF EXISTS legacy_public_quote_links_service_read ON public.legacy_public_quote_links;
CREATE POLICY legacy_public_quote_links_service_read ON public.legacy_public_quote_links FOR SELECT TO service_role USING (true);
DROP TRIGGER IF EXISTS legacy_public_quote_links_append_only ON public.legacy_public_quote_links;
CREATE TRIGGER legacy_public_quote_links_append_only BEFORE UPDATE OR DELETE ON public.legacy_public_quote_links
  FOR EACH ROW EXECUTE FUNCTION public.xcut_append_only_guard();
DROP TRIGGER IF EXISTS legacy_public_quote_links_no_truncate ON public.legacy_public_quote_links;
CREATE TRIGGER legacy_public_quote_links_no_truncate BEFORE TRUNCATE ON public.legacy_public_quote_links
  FOR EACH STATEMENT EXECUTE FUNCTION public.xcut_append_only_guard();

-- DB owner only (no application role). Run at cutover, BEFORE free_issue is enforced; refused once it is enforced (a quote that
-- leaves Draft afterwards does so through finalize and is served by capability token only). Idempotent.
CREATE OR REPLACE FUNCTION public.record_legacy_public_links()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phase    text;
  v_inserted integer;
BEGIN
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  IF v_phase = 'enforced' THEN
    RAISE EXCEPTION 'record_legacy_public_links: free_issue is enforced; the cutover allowlist is closed' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.legacy_public_quote_links (quote_id, user_id)
  SELECT q.id, q.user_id FROM public.quotes q
   WHERE q.user_id IS NOT NULL AND (lower(coalesce(q.status, '')) <> 'draft' OR coalesce(q.signature, '') <> '')
  ON CONFLICT (quote_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted,
                            'total', (SELECT count(*) FROM public.legacy_public_quote_links));
END
$function$;
REVOKE ALL ON FUNCTION public.record_legacy_public_links() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_legacy_public_quote(p_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT p_quote_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.legacy_public_quote_links l WHERE l.quote_id = p_quote_id)
$function$;
REVOKE ALL ON FUNCTION public.is_legacy_public_quote(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_legacy_public_quote(uuid) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 3. Final PDF / Print output grants (short-lived, single use)
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.output_channel_grants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_hash  text        NOT NULL UNIQUE CHECK (grant_hash ~ '^[0-9a-f]{64}$'),
  user_id     uuid        NOT NULL,
  quote_id    uuid        NOT NULL,
  attempt_id  uuid        NOT NULL,
  channel     text        NOT NULL CHECK (channel IN ('final_pdf', 'final_print')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  redeemed_at timestamptz NULL,
  CONSTRAINT output_channel_grants_ttl CHECK (expires_at > created_at AND expires_at <= created_at + interval '300 seconds')
);
ALTER TABLE public.output_channel_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.output_channel_grants FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.output_channel_grants TO service_role;
DROP POLICY IF EXISTS output_channel_grants_service_read ON public.output_channel_grants;
CREATE POLICY output_channel_grants_service_read ON public.output_channel_grants FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.output_channel_grants_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'output_channel_grants: % refused', TG_OP USING ERRCODE = '42501';
  END IF;
  IF OLD.redeemed_at IS NOT NULL OR NEW.redeemed_at IS NULL
     OR (NEW.id, NEW.grant_hash, NEW.user_id, NEW.quote_id, NEW.attempt_id, NEW.channel, NEW.created_at, NEW.expires_at)
        IS DISTINCT FROM
        (OLD.id, OLD.grant_hash, OLD.user_id, OLD.quote_id, OLD.attempt_id, OLD.channel, OLD.created_at, OLD.expires_at) THEN
    RAISE EXCEPTION 'output_channel_grants: only a single redemption is allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.output_channel_grants_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS output_channel_grants_guard_row ON public.output_channel_grants;
CREATE TRIGGER output_channel_grants_guard_row BEFORE UPDATE OR DELETE ON public.output_channel_grants
  FOR EACH ROW EXECUTE FUNCTION public.output_channel_grants_guard();
DROP TRIGGER IF EXISTS output_channel_grants_guard_truncate ON public.output_channel_grants;
CREATE TRIGGER output_channel_grants_guard_truncate BEFORE TRUNCATE ON public.output_channel_grants
  FOR EACH STATEMENT EXECUTE FUNCTION public.output_channel_grants_guard();

-- issue (service_role): FINALIZED attempt of that user required (any first channel: re-output never consumes again); TTL 1..300 s
CREATE OR REPLACE FUNCTION public.issue_output_grant(p_user_id uuid, p_attempt_id uuid, p_channel text, p_grant_hash text,
                                                     p_ttl_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_a   public.quote_output_attempts%ROWTYPE;
  v_row public.output_channel_grants%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_attempt_id IS NULL OR p_channel IS NULL OR p_channel NOT IN ('final_pdf', 'final_print')
     OR p_grant_hash IS NULL OR p_grant_hash !~ '^[0-9a-f]{64}$'
     OR p_ttl_seconds IS NULL OR p_ttl_seconds NOT BETWEEN 1 AND 300 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  SELECT * INTO v_a FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id AND a.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_not_found');
  END IF;
  IF v_a.state <> 'finalized' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_not_finalized');
  END IF;
  INSERT INTO public.output_channel_grants (grant_hash, user_id, quote_id, attempt_id, channel, expires_at)
  VALUES (p_grant_hash, p_user_id, v_a.quote_id, v_a.attempt_id, p_channel, now() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (grant_hash) DO NOTHING
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.output_channel_grants g WHERE g.grant_hash = p_grant_hash;
    IF v_row.user_id <> p_user_id OR v_row.attempt_id <> p_attempt_id OR v_row.channel <> p_channel THEN
      RETURN jsonb_build_object('ok', false, 'code', 'grant_conflict');
    END IF;
    RETURN jsonb_build_object('ok', true, 'replay', true, 'grantId', v_row.id, 'channel', v_row.channel,
                              'expiresAt', v_row.expires_at);
  END IF;
  RETURN jsonb_build_object('ok', true, 'replay', false, 'grantId', v_row.id, 'channel', v_row.channel, 'expiresAt', v_row.expires_at);
END
$function$;
REVOKE ALL ON FUNCTION public.issue_output_grant(uuid, uuid, text, text, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_output_grant(uuid, uuid, text, text, integer) TO service_role;

-- redeem (service_role): single use; unknown / redeemed / expired / wrong channel / malformed -> uniform not_found.
-- Success shape (exact): {ok, userId, quoteId, attemptId, channel, snapshotPath, snapshotSha256}.
CREATE OR REPLACE FUNCTION public.redeem_output_grant(p_grant_hash text, p_channel text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row public.output_channel_grants%ROWTYPE;
  v_a   public.quote_output_attempts%ROWTYPE;
BEGIN
  IF p_grant_hash IS NULL OR p_grant_hash !~ '^[0-9a-f]{64}$' OR p_channel IS NULL OR p_channel NOT IN ('final_pdf', 'final_print') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  SELECT * INTO v_row FROM public.output_channel_grants g
   WHERE g.grant_hash = p_grant_hash AND g.channel = p_channel AND g.redeemed_at IS NULL AND g.expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  SELECT * INTO v_a FROM public.quote_output_attempts a WHERE a.attempt_id = v_row.attempt_id AND a.state = 'finalized';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  UPDATE public.output_channel_grants SET redeemed_at = now() WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true, 'userId', v_row.user_id, 'quoteId', v_row.quote_id,
                            'attemptId', v_row.attempt_id, 'channel', v_row.channel, 'snapshotPath', v_a.snapshot_path,
                            'snapshotSha256', v_a.snapshot_sha256);
END
$function$;
REVOKE ALL ON FUNCTION public.redeem_output_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_output_grant(text, text) TO service_role;

-- ROLLBACK (forward-safe; DB owner): keep / return free_issue to 'prepared' - the Edge layer then serves the legacy path. While
-- quote_public_capabilities / output_channel_grants / legacy_public_quote_links are empty, this file's objects may be dropped
-- (functions, then tables). Once tokens exist they are revoked (one-way), never deleted.
