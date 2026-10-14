-- ============================================================================================================================
-- 20261007150700_subscriptions_output_notice.sql  -  pre-consumption notice + expected content digest for the orchestrator
-- tekango-migration-contract: mode=transaction replay=required
--
--   The adopted prepare_quote_output (20261007150000) requires p_expected_digest = the quote-document/v1 digest of the deal the
--   owner saw. quote_output_deal_document / quote_output_digest are internal (no application role EXECUTE). output_notice gives
--   the trusted orchestrator (service_role; p_user_id from the verified JWT) that digest plus the pre-consumption notice, so the
--   owner can be told before the first client-facing output whether it consumes one of the 10 Free outputs.
--   Read-only (STABLE): no reservation, no consumption, no snapshot. Not enforced -> not_activated (the client keeps the legacy
--   path). A quote of another account answers exactly like a missing one (quote_not_found).
--   Never applied to TEST/Production by this change. Re-runnable: CREATE OR REPLACE + explicit REVOKE / GRANT.
--   ROLLBACK (DB owner): DROP FUNCTION public.output_notice(uuid, uuid); it holds no data.
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.output_notice(p_user_id uuid, p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phase    text;
  v_ent      public.account_entitlements%ROWTYPE;
  v_final    boolean;
  v_reserved integer;
BEGIN
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_activated');
  END IF;
  IF p_user_id IS NULL OR p_quote_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'quote_not_found');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
  END IF;
  v_final := EXISTS (SELECT 1 FROM public.quote_issue_ledger l
                      WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id AND l.event_type = 'first_client_output');
  v_reserved := public.quote_output_live_reservations(p_user_id, NULL);
  RETURN jsonb_build_object(
    'ok', true,
    'contentDigest', public.quote_output_digest(public.quote_output_deal_document(p_user_id, p_quote_id)),
    'alreadyFinalized', v_final,
    'wouldConsume', v_ent.account_mode = 'free_10' AND NOT v_final,
    'remaining', CASE WHEN v_ent.account_mode = 'free_10'
                      THEN greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0) END,
    'accountMode', v_ent.account_mode);
END
$function$;
REVOKE ALL ON FUNCTION public.output_notice(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.output_notice(uuid, uuid) TO service_role;
