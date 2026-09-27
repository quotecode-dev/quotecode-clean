-- ============================================================================================================================
-- TEKANGO Post-LIVE Wave 1 - Codex blocker 3 remediation (2026-09-27): atomic claim / outcome ledger for trial reminders.
-- PREPARED, NOT APPLIED to TEST or Production. Applying it to any shared environment requires a separate explicit Owner
-- authorization. Proven only in the disposable database harness (scripts/db-test). Additive and re-runnable: one new table,
-- two new functions, no change to existing data or existing objects.
--
-- Problem (Codex): send-trial-expiration-email selected "unsent" rows, sent through Resend, and only then wrote
-- trial_reminder_*_sent (result ignored). Two overlapping invocations could both send; a failed write was invisible.
--
-- Contract:
--   * public.claim_trial_reminder(user, stage) - ONE atomic INSERT .. ON CONFLICT DO UPDATE .. WHERE. Exactly one caller wins
--     a (user, stage); losers get NULL and must not send. A stage already flagged sent on business_settings is never claimed.
--   * The winner sends with the returned Resend Idempotency-Key, then calls public.complete_trial_reminder(.., outcome):
--       sent     -> ledger 'sent' AND business_settings.trial_reminder_<stage>_sent = true, in ONE transaction (verified row
--                   count; if the account row is not updated the whole completion rolls back and the claim stays open).
--       failed   -> provider definitely rejected the request (nothing sent). Re-claimable; the next attempt gets a NEW key.
--       unknown  -> outcome ambiguous (timeout / network / 5xx / 409). Re-claimable only while the SAME key is still inside
--                   Resend's 24h idempotency retention (23h here), so a retry can never produce a second email.
--   * A claim whose worker died (status 'claimed' older than the 10-minute lease) is treated like 'unknown'.
--   * Past the key window an ambiguous row is NOT re-sent automatically (no duplicate risk); it stays visible for review.
--   * Completion is accepted only from the current claim holder (claim_id match); a stale worker's late completion is refused.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.trial_reminder_deliveries (
  user_id             uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stage               text        NOT NULL CHECK (stage IN ('3d', '24h')),
  status              text        NOT NULL CHECK (status IN ('claimed', 'sent', 'failed', 'unknown')),
  claim_id            uuid        NOT NULL,
  idempotency_key     text        NOT NULL,
  attempt             integer     NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  key_first_used_at   timestamptz NOT NULL DEFAULT now(),
  claimed_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  sent_at             timestamptz,
  provider_message_id text,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stage)
);

COMMENT ON TABLE public.trial_reminder_deliveries IS
  'Post-LIVE Wave 1 (2026-09-27): one row per (account, trial reminder stage) - the atomic claim + provider outcome ledger that '
  'guarantees at most one trial reminder email per stage under overlapping cron invocations. Written only by '
  'claim_trial_reminder / complete_trial_reminder (service_role). No customer content; last_error holds provider error text only.';

ALTER TABLE public.trial_reminder_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_reminder_deliveries FROM PUBLIC;
REVOKE ALL ON public.trial_reminder_deliveries FROM anon;
REVOKE ALL ON public.trial_reminder_deliveries FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trial_reminder_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.claim_trial_reminder(p_user_id uuid, p_stage text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  c_lease      constant interval := interval '10 minutes';
  c_key_window constant interval := interval '23 hours';  -- inside Resend's 24h idempotency-key retention
  v_claim      uuid := gen_random_uuid();
  v_result     jsonb;
BEGIN
  IF p_user_id IS NULL OR p_stage IS NULL OR p_stage NOT IN ('3d', '24h') THEN
    RAISE EXCEPTION 'claim_trial_reminder: invalid arguments' USING ERRCODE = '22023';
  END IF;

  -- The account must exist and the stage must not already be recorded as sent (this also covers flags written before
  -- this ledger existed).
  IF NOT EXISTS (
    SELECT 1 FROM public.business_settings b
     WHERE b.user_id = p_user_id
       AND (CASE p_stage WHEN '3d' THEN b.trial_reminder_3d_sent ELSE b.trial_reminder_24h_sent END) IS NOT TRUE
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.trial_reminder_deliveries AS d
    (user_id, stage, status, claim_id, idempotency_key, attempt, key_first_used_at, claimed_at)
  VALUES
    (p_user_id, p_stage, 'claimed', v_claim, format('trial-reminder/%s/%s/1', p_user_id, p_stage), 1, now(), now())
  ON CONFLICT (user_id, stage) DO UPDATE SET
    status            = 'claimed',
    claim_id          = v_claim,
    claimed_at        = now(),
    completed_at      = NULL,
    attempt           = d.attempt + 1,
    -- definite failure: nothing was sent -> a fresh key; ambiguous previous attempt: the SAME key, so the provider dedups
    idempotency_key   = CASE WHEN d.status = 'failed'
                             THEN format('trial-reminder/%s/%s/%s', d.user_id, d.stage, d.attempt + 1)
                             ELSE d.idempotency_key END,
    key_first_used_at = CASE WHEN d.status = 'failed' THEN now() ELSE d.key_first_used_at END
  WHERE d.status = 'failed'
     OR (d.status = 'unknown' AND d.key_first_used_at > now() - c_key_window)
     OR (d.status = 'claimed' AND d.claimed_at < now() - c_lease AND d.key_first_used_at > now() - c_key_window)
  RETURNING jsonb_build_object('claim_id', d.claim_id, 'idempotency_key', d.idempotency_key, 'attempt', d.attempt)
  INTO v_result;

  RETURN v_result;  -- NULL when another invocation holds or has completed this (user, stage)
END
$function$;

COMMENT ON FUNCTION public.claim_trial_reminder(uuid, text) IS
  'Post-LIVE Wave 1 (2026-09-27): atomically claim one trial reminder stage for one account. Returns {claim_id, idempotency_key, '
  'attempt} to exactly one caller, NULL to every other caller. Never claims a stage already sent. See the migration header.';

CREATE OR REPLACE FUNCTION public.complete_trial_reminder(
  p_user_id uuid,
  p_stage text,
  p_claim_id uuid,
  p_outcome text,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rows integer;
BEGIN
  IF p_user_id IS NULL OR p_claim_id IS NULL OR p_stage IS NULL OR p_stage NOT IN ('3d', '24h')
     OR p_outcome IS NULL OR p_outcome NOT IN ('sent', 'failed', 'unknown') THEN
    RAISE EXCEPTION 'complete_trial_reminder: invalid arguments' USING ERRCODE = '22023';
  END IF;

  UPDATE public.trial_reminder_deliveries d SET
    status              = p_outcome,
    completed_at        = now(),
    sent_at             = CASE WHEN p_outcome = 'sent' THEN now() ELSE NULL END,
    provider_message_id = CASE WHEN p_outcome = 'sent' THEN left(p_provider_message_id, 200) ELSE d.provider_message_id END,
    last_error          = CASE WHEN p_outcome = 'sent' THEN NULL ELSE left(p_error, 500) END
  WHERE d.user_id = p_user_id AND d.stage = p_stage AND d.claim_id = p_claim_id AND d.status = 'claimed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RETURN false;  -- not the current claim holder (lease expired and re-claimed, or already completed): nothing written
  END IF;

  IF p_outcome = 'sent' THEN
    UPDATE public.business_settings b SET
      trial_reminder_3d_sent  = CASE WHEN p_stage = '3d'  THEN true ELSE b.trial_reminder_3d_sent  END,
      trial_reminder_24h_sent = CASE WHEN p_stage = '24h' THEN true ELSE b.trial_reminder_24h_sent END
    WHERE b.user_id = p_user_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      -- rolls back the ledger update above too: the claim stays open and is retried with the SAME idempotency key
      RAISE EXCEPTION 'complete_trial_reminder: account row not updated (% rows)', v_rows USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN true;
END
$function$;

COMMENT ON FUNCTION public.complete_trial_reminder(uuid, text, uuid, text, text, text) IS
  'Post-LIVE Wave 1 (2026-09-27): record the provider outcome of a claimed trial reminder. Only the current claim holder can '
  'complete; "sent" also sets business_settings.trial_reminder_<stage>_sent in the same transaction (row count verified).';

REVOKE ALL ON FUNCTION public.claim_trial_reminder(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_trial_reminder(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_trial_reminder(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_trial_reminder(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.complete_trial_reminder(uuid, text, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_trial_reminder(uuid, text, uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.complete_trial_reminder(uuid, text, uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_trial_reminder(uuid, text, uuid, text, text, text) TO service_role;

-- ROLLBACK (operational, only if ever needed; the Edge Function must be reverted first, it depends on these objects):
--   DROP FUNCTION IF EXISTS public.complete_trial_reminder(uuid, text, uuid, text, text, text);
--   DROP FUNCTION IF EXISTS public.claim_trial_reminder(uuid, text);
--   DROP TABLE IF EXISTS public.trial_reminder_deliveries;
