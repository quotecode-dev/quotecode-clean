-- ============================================================================================================================
-- 20261023300000_billing_reconcile.sql  -  the daily payment reconciliation against PayPlus
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-23 (typed: "מאשר שינוי ב-L-09, L-13, L-14, L-17, L-22, L-24, L-25, L-26, L-27:" answering "... התאמת
--   תשלומים יומית עם מסך בניהול"; plan docs/PAYMENTS_RECONCILIATION_PLAN_2026-10-23.md; Codex payments-prep audit 2026-10-22 item 2).
--   Once a day the function billing-reconcile reads PayPlus's transaction history (read only) and compares it with what our server
--   recorded. Nothing here changes an account, an entitlement or a payment - it only keeps what was found, for the Owner.
--   * billing_reconcile_runs     - one row per run (the daily site run: once per Israel day; the Owner's "run now": any time).
--   * billing_reconcile_findings - one row per difference, once per (code, transaction): UNLINKED (money at PayPlus, no verified
--     event of ours), MISSING_AT_PROVIDER (a verified charge of ours that PayPlus does not list), AMOUNT_MISMATCH, REFUND_UNRECORDED.
--   * billing_reconcile_source() - the service role's ONLY read of our billing tables (they stay closed even to the service role).
--   * billing_reconcile_admin_state() / billing_reconcile_set_status() - the admin screen, super admin only.
-- Rollback of THIS file: DROP FUNCTION public.billing_reconcile_set_status(uuid, text), public.billing_reconcile_admin_state(),
--   public.billing_reconcile_source(timestamptz, timestamptz); DROP TABLE public.billing_reconcile_findings, public.billing_reconcile_runs.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.billing_reconcile_runs (
  run_id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_day        date        NOT NULL,
  source         text        NOT NULL CHECK (source IN ('cron', 'admin')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz NULL,
  status         text        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed', 'not_configured')),
  window_from    timestamptz NULL,
  window_until   timestamptz NULL,
  provider_count integer     NOT NULL DEFAULT 0 CHECK (provider_count >= 0),
  ours_count     integer     NOT NULL DEFAULT 0 CHECK (ours_count >= 0),
  matched        integer     NOT NULL DEFAULT 0 CHECK (matched >= 0),
  new_findings   integer     NOT NULL DEFAULT 0 CHECK (new_findings >= 0),
  amount_scale   text        NULL CHECK (amount_scale IN ('minor', 'major', 'unknown')),
  types          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  error_code     text        NULL CHECK (error_code IS NULL OR char_length(error_code) BETWEEN 1 AND 80),
  mailed_at      timestamptz NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_reconcile_runs_cron_day ON public.billing_reconcile_runs (run_day) WHERE source = 'cron';
CREATE INDEX IF NOT EXISTS billing_reconcile_runs_started ON public.billing_reconcile_runs (started_at DESC);
ALTER TABLE public.billing_reconcile_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_reconcile_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.billing_reconcile_runs TO service_role;

CREATE TABLE IF NOT EXISTS public.billing_reconcile_findings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid        NOT NULL REFERENCES public.billing_reconcile_runs (run_id),
  code        text        NOT NULL CHECK (code IN ('UNLINKED', 'MISSING_AT_PROVIDER', 'AMOUNT_MISMATCH', 'REFUND_UNRECORDED')),
  uid         text        NOT NULL CHECK (char_length(uid) BETWEEN 1 AND 200),
  detail      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status      text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'checked')),
  checked_at  timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, uid)
);
ALTER TABLE public.billing_reconcile_findings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_reconcile_findings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.billing_reconcile_findings TO service_role;

-- what OUR server recorded in a window: the verified PayPlus charges that gave an entitlement (a 'rejected' event gave none, so a
-- charge behind it is money without an entitlement = UNLINKED), with the amount of their checkout; and every refund we know of
-- (a verified PayPlus refund event, or an admin refund PayPlus confirmed). Service role only.
CREATE OR REPLACE FUNCTION public.billing_reconcile_source(p_from timestamptz, p_until timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'charges', coalesce((
      SELECT jsonb_agg(jsonb_build_object('providerEventId', e.provider_event_id, 'attemptId', e.attempt_id, 'amountMinor', a.amount_minor,
        'currency', a.currency, 'at', e.provider_event_time) ORDER BY e.provider_event_time)
      FROM public.subscription_events e JOIN public.checkout_attempts a ON a.attempt_id = e.attempt_id
      WHERE e.provider = 'payplus' AND e.event_type = 'payment_confirmed' AND e.verified AND e.outcome <> 'rejected'
        AND e.provider_event_time >= p_from AND e.provider_event_time <= p_until), '[]'::jsonb),
    'refunds', coalesce((
      SELECT jsonb_agg(jsonb_build_object('transactionUid', s.uid))
      FROM (SELECT e.provider_event_id AS uid FROM public.subscription_events e WHERE e.provider = 'payplus' AND e.event_type = 'refund'
            UNION
            SELECT r.refund_ref FROM public.billing_admin_refunds r WHERE r.stage = 'result' AND r.refund_status = 'refunded' AND r.refund_ref IS NOT NULL) s), '[]'::jsonb)
  )
$function$;
REVOKE ALL ON FUNCTION public.billing_reconcile_source(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_reconcile_source(timestamptz, timestamptz) TO service_role;

-- the admin screen: the last 30 runs, the open findings (oldest first) and the last 50 checked - super admin only
CREATE OR REPLACE FUNCTION public.billing_reconcile_admin_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'billing_reconcile_admin_state: super admin only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'runs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.run_id, 'day', r.run_day, 'source', r.source, 'startedAt', r.started_at,
      'finishedAt', r.finished_at, 'status', r.status, 'from', r.window_from, 'until', r.window_until, 'provider', r.provider_count,
      'ours', r.ours_count, 'matched', r.matched, 'newFindings', r.new_findings, 'scale', r.amount_scale, 'types', r.types,
      'error', r.error_code, 'mailedAt', r.mailed_at) ORDER BY r.started_at DESC)
      FROM (SELECT * FROM public.billing_reconcile_runs ORDER BY started_at DESC LIMIT 30) r), '[]'::jsonb),
    'open', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'code', f.code, 'uid', f.uid, 'detail', f.detail, 'createdAt', f.created_at)
      ORDER BY f.created_at) FROM public.billing_reconcile_findings f WHERE f.status = 'new'), '[]'::jsonb),
    'checked', coalesce((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'code', f.code, 'uid', f.uid, 'detail', f.detail, 'createdAt', f.created_at,
      'checkedAt', f.checked_at) ORDER BY f.checked_at DESC)
      FROM (SELECT * FROM public.billing_reconcile_findings WHERE status = 'checked' ORDER BY checked_at DESC LIMIT 50) f), '[]'::jsonb)
  );
END
$function$;
REVOKE ALL ON FUNCTION public.billing_reconcile_admin_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.billing_reconcile_admin_state() TO authenticated, service_role;

-- the Owner marks a finding as checked (or back to new) - super admin only
CREATE OR REPLACE FUNCTION public.billing_reconcile_set_status(p_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_rows integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'billing_reconcile_set_status: super admin only' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('new', 'checked') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_status');
  END IF;
  UPDATE public.billing_reconcile_findings SET status = p_status, checked_at = CASE WHEN p_status = 'checked' THEN now() END WHERE id = p_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', v_rows = 1, 'code', CASE WHEN v_rows = 1 THEN NULL ELSE 'not_found' END);
END
$function$;
REVOKE ALL ON FUNCTION public.billing_reconcile_set_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.billing_reconcile_set_status(uuid, text) TO authenticated, service_role;
