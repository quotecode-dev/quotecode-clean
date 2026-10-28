-- ============================================================================================================================
-- 20261029000000_codex_review_fixes.sql  -  the database part of the fixes for Codex's review of 25-28/10 (F01-F04, F05)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01, L-06, L-09, L-11, L-12, L-15, L-17, L-22, L-23, L-24, L-25 לפי התוכנית לתיקון
--   22 ממצאי קודקס מ-28/10, כולל הטקסטים וההחלטות שהוצעו"); docs/CODEX_REVIEW_RELEASES_2026-10-25_28.md.
--   1. F01 + F02 (a yearly SMART PACK removal refund): every positive refund stays owed ('due') even without a charge reference; a
--      refund is CLAIMED ('sending') before PayPlus is asked, so two requests never refund twice; an answer that did not prove the
--      refund leaves it 'unknown' - never sent again automatically; the charge reference of a period opened by a pull is its first
--      charge's callback (the same rule as billing_admin_preview, 20261025300000). Rows written by the old code: a 'due' refund may
--      already have been sent and a positive refund left 'none' was abandoned - both become 'unknown' for the Owner.
--   2. F03: the reconciliation charge amount adds back a SMART PACK removed after the charge, and a removal refund is a known refund;
--      a removal refund the Owner must settle is the finding REFUND_OWED (told once, like every finding).
--   3. F04: the market of an account follows the app's one market rule (L-25, the SQL twin admin_market_of): 'Local' / 'LCL' / 'IL' /
--      'Israel' (any case, trimmed) = IL, anything else = INTERNATIONAL. An account stored that way and never purchasing is corrected.
--   4. F05: an expense whose PayPlus answer was lost is 'unknown' - never sent again automatically.
-- Rollback of THIS file (DB owner): roll subscription-authority, billing-reconcile and expense-invoices back first; re-run
--   20261027100000 sections 3-4, 20261025300000 section 8 and 20261025200000 section 1; DROP the new functions of this file. The
--   added states stay valid only with the new code - an old function treats 'sending' / 'unknown' rows as not due (safe).
-- ============================================================================================================================

-- 1. SMART PACK removal refunds ---------------------------------------------------------------------------------------------------
ALTER TABLE public.smart_pack_removals DROP CONSTRAINT IF EXISTS smart_pack_removals_refund_state_check;
ALTER TABLE public.smart_pack_removals ADD CONSTRAINT smart_pack_removals_refund_state_check
  CHECK (refund_state IN ('none', 'due', 'sending', 'refunded', 'unknown'));
ALTER TABLE public.smart_pack_removals ADD COLUMN IF NOT EXISTS refund_claimed_at timestamptz NULL;

-- rows written by the old code (see the header): never refunded again automatically
UPDATE public.smart_pack_removals SET refund_state = 'unknown'
 WHERE state = 'removed' AND refund_minor > 0 AND refund_state IN ('due', 'none');

-- the charge a removal refunds: its own reference, else the period's charge, else (a period opened by a pull) its first charge's callback
CREATE OR REPLACE FUNCTION public.smart_pack_removal_charge_ref(p_removal_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_row public.smart_pack_removals; v_pp public.billing_paid_periods; v_charge text;
BEGIN
  SELECT * INTO v_row FROM public.smart_pack_removals r WHERE r.removal_id = p_removal_id;
  IF v_row.removal_id IS NULL THEN RETURN NULL; END IF;
  IF v_row.charge_ref IS NOT NULL THEN RETURN v_row.charge_ref; END IF;
  SELECT * INTO v_pp FROM public.billing_paid_periods p
   WHERE p.user_id = v_row.user_id AND p.attempt_id = v_row.package_attempt_id AND p.period_start <= v_row.created_at AND p.period_end > v_row.created_at
   ORDER BY p.period_end DESC, p.period_id DESC LIMIT 1;
  v_charge := v_pp.charge_ref;
  IF v_charge IS NULL AND v_pp.event_id LIKE 'pull:%' THEN
    SELECT e.provider_event_id INTO v_charge
      FROM public.subscription_events e
      JOIN public.subscription_events p ON p.provider = 'payplus' AND p.provider_event_id = 'pull:' || v_row.package_attempt_id::text AND p.outcome = 'applied'
     WHERE e.attempt_id = v_row.package_attempt_id AND e.provider = 'payplus' AND e.event_type = 'payment_confirmed' AND e.outcome = 'stale'
       AND e.provider_event_id NOT LIKE 'pull:%' AND e.provider_event_time < p.provider_event_time + interval '7 days'
     ORDER BY e.provider_event_time, e.event_id LIMIT 1;
  END IF;
  RETURN v_charge;
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_charge_ref(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_charge_ref(uuid) TO service_role;

-- body 20261027100000 + the marked change: a positive refund is owed even before its charge reference is known
CREATE OR REPLACE FUNCTION public.smart_pack_removal_finish(p_removal_id uuid, p_removed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_user uuid; v_row public.smart_pack_removals; v_sp public.price_versions;
BEGIN
  IF p_removal_id IS NULL OR p_removed IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  SELECT r.user_id INTO v_user FROM public.smart_pack_removals r WHERE r.removal_id = p_removal_id;
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
  SELECT * INTO v_row FROM public.smart_pack_removals r WHERE r.removal_id = p_removal_id FOR UPDATE;
  IF v_row.state <> 'requested' THEN RETURN jsonb_build_object('ok', true, 'changed', false, 'state', v_row.state); END IF;
  IF NOT p_removed THEN
    UPDATE public.smart_pack_removals SET state = 'refused', change_at = now() WHERE removal_id = p_removal_id;
    RETURN jsonb_build_object('ok', true, 'changed', true, 'state', 'refused');
  END IF;
  SELECT * INTO v_sp FROM public.price_versions p WHERE p.price_id = v_row.add_on_price_id;
  -- the live attempt is the package alone again (the next renewal passes the unchanged amount check); SMART PACK runs to the paid end
  UPDATE public.checkout_attempts SET amount_minor = amount_minor - v_sp.amount_minor, add_on_price_id = NULL
   WHERE attempt_id = v_row.package_attempt_id AND add_on_price_id = v_row.add_on_price_id;
  UPDATE public.account_entitlements SET smart_pack_line = false, smart_pack_until = v_row.effective_at, updated_at = now()
   WHERE user_id = v_user AND live_attempt_id = v_row.package_attempt_id;
  -- 20261029000000 (Codex F02): owed whenever positive - the charge reference is resolved when the refund is claimed
  UPDATE public.smart_pack_removals SET state = 'removed', change_at = now(),
         refund_state = CASE WHEN refund_minor > 0 THEN 'due' ELSE 'none' END
   WHERE removal_id = p_removal_id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'state', 'removed');
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_finish(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_finish(uuid, boolean) TO service_role;

-- the refunds still due of an account (a refund is sent only after claim_smart_pack_removal_refund)
CREATE OR REPLACE FUNCTION public.smart_pack_removal_refunds_due(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('removalId', r.removal_id, 'chargeRef', r.charge_ref, 'amountMinor', r.refund_minor)), '[]'::jsonb)
    FROM public.smart_pack_removals r WHERE r.user_id = p_user_id AND r.refund_state = 'due';
$$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_refunds_due(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_refunds_due(uuid) TO service_role;

-- the claim: exactly one request moves a due refund to 'sending' (with its charge reference) before PayPlus is asked
CREATE OR REPLACE FUNCTION public.claim_smart_pack_removal_refund(p_removal_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_ref text; v_row public.smart_pack_removals;
BEGIN
  IF p_removal_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  v_ref := public.smart_pack_removal_charge_ref(p_removal_id);
  IF v_ref IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'no_charge_ref'); END IF;
  UPDATE public.smart_pack_removals SET refund_state = 'sending', charge_ref = v_ref, refund_claimed_at = now()
   WHERE removal_id = p_removal_id AND refund_state = 'due' AND refund_minor > 0
  RETURNING * INTO v_row;
  IF v_row.removal_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'not_due'); END IF;
  RETURN jsonb_build_object('ok', true, 'removalId', v_row.removal_id, 'chargeRef', v_row.charge_ref, 'amountMinor', v_row.refund_minor);
END $$;
REVOKE ALL ON FUNCTION public.claim_smart_pack_removal_refund(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_smart_pack_removal_refund(uuid) TO service_role;

-- recorded once, only for the claimed refund
CREATE OR REPLACE FUNCTION public.record_smart_pack_removal_refund(p_removal_id uuid, p_refund_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_removal_id IS NULL OR p_refund_ref IS NULL OR length(p_refund_ref) NOT BETWEEN 1 AND 200 THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  UPDATE public.smart_pack_removals SET refund_state = 'refunded', refund_ref = p_refund_ref WHERE removal_id = p_removal_id AND refund_state = 'sending';
  RETURN jsonb_build_object('ok', FOUND);
END $$;
REVOKE ALL ON FUNCTION public.record_smart_pack_removal_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_smart_pack_removal_refund(uuid, text) TO service_role;

-- PayPlus did not prove the refund: the Owner settles it (never sent again automatically)
CREATE OR REPLACE FUNCTION public.mark_smart_pack_removal_refund_unknown(p_removal_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_removal_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  UPDATE public.smart_pack_removals SET refund_state = 'unknown' WHERE removal_id = p_removal_id AND refund_state = 'sending';
  RETURN jsonb_build_object('ok', FOUND);
END $$;
REVOKE ALL ON FUNCTION public.mark_smart_pack_removal_refund_unknown(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_smart_pack_removal_refund_unknown(uuid) TO service_role;

-- every refund the Owner must settle (read by the daily reconciliation): unknown, stuck sending, or owed with no charge reference
CREATE OR REPLACE FUNCTION public.smart_pack_removal_refunds_owed()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('removalId', r.removal_id, 'userId', r.user_id, 'amountMinor', r.refund_minor,
           'refundState', r.refund_state, 'at', coalesce(r.refund_claimed_at, r.change_at)) ORDER BY r.change_at), '[]'::jsonb)
    FROM public.smart_pack_removals r
   WHERE r.refund_minor > 0 AND r.state = 'removed'
     AND (r.refund_state = 'unknown'
          OR (r.refund_state = 'sending' AND r.refund_claimed_at < now() - interval '10 minutes')
          OR (r.refund_state = 'due' AND r.change_at < now() - interval '24 hours'));
$$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_refunds_owed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_refunds_owed() TO service_role;

-- body 20261027100000 + the marked change: the answer carries the refund state
CREATE OR REPLACE FUNCTION public.request_smart_pack_removal(p_user_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_q jsonb; v_row public.smart_pack_removals;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || p_user_id::text));
  SELECT * INTO v_row FROM public.smart_pack_removals WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN
    -- a SMART PACK line still being added waits for its own answer first
    IF EXISTS (SELECT 1 FROM public.smart_pack_add_ons a WHERE a.user_id = p_user_id AND a.state = 'paid' AND (a.line_state IS NULL OR a.line_state = 'requested')) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'retry_later');
    END IF;
    v_q := public.smart_pack_removal_quote(p_user_id);
    IF (v_q ->> 'ok') IS DISTINCT FROM 'true' THEN RETURN v_q; END IF;
    INSERT INTO public.smart_pack_removals (user_id, package_attempt_id, idempotency_key, period, add_on_price_id, effective_at, refund_minor, charge_ref)
    VALUES (p_user_id, (v_q ->> 'packageAttemptId')::uuid, p_idempotency_key, v_q ->> 'period', v_q ->> 'addOnPriceId', (v_q ->> 'effectiveAt')::timestamptz,
            (v_q ->> 'refundMinor')::int, v_q ->> 'chargeRef')
    RETURNING * INTO v_row;
  END IF;
  -- 20261029000000 (Codex F02): the screen promises a refund only when it was made
  RETURN jsonb_build_object('ok', true, 'removalId', v_row.removal_id, 'state', v_row.state, 'effectiveAt', v_row.effective_at, 'refundMinor', v_row.refund_minor,
    'refundState', v_row.refund_state);
END $$;
REVOKE ALL ON FUNCTION public.request_smart_pack_removal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_smart_pack_removal(uuid, text) TO service_role;

-- 2. the daily reconciliation source (body 20261025300000 section 8 + the marked 20261029000000 changes) ----------------------------
CREATE OR REPLACE FUNCTION public.billing_reconcile_source(p_from timestamptz, p_until timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'charges', coalesce((
      SELECT jsonb_agg(c.j ORDER BY c.at) FROM (
        -- 20261029000000 (Codex F03): every SMART PACK line added after the charge is taken off, every one removed after it is added back
        SELECT jsonb_build_object('providerEventId', e.provider_event_id, 'attemptId', e.attempt_id,
          'amountMinor', a.amount_minor
            - coalesce((SELECT sum(p.amount_minor) FROM public.smart_pack_add_ons s JOIN public.price_versions p ON p.price_id = s.price_id
                         WHERE s.package_attempt_id = a.attempt_id AND s.line_state = 'added' AND s.line_at > e.provider_event_time), 0)
            + coalesce((SELECT sum(p.amount_minor) FROM public.smart_pack_removals r JOIN public.price_versions p ON p.price_id = r.add_on_price_id
                         WHERE r.package_attempt_id = a.attempt_id AND r.state = 'removed' AND r.change_at > e.provider_event_time), 0),
          'currency', a.currency, 'at', e.provider_event_time) AS j, e.provider_event_time AS at
        FROM public.subscription_events e JOIN public.checkout_attempts a ON a.attempt_id = e.attempt_id
        WHERE e.provider = 'payplus' AND e.event_type = 'payment_confirmed' AND e.verified AND e.outcome <> 'rejected'
          AND e.provider_event_time >= p_from AND e.provider_event_time <= p_until
        UNION ALL
        SELECT jsonb_build_object('providerEventId', e.provider_event_id, 'attemptId', 'sp_' || s.add_on_id::text, 'amountMinor', s.amount_minor,
          'currency', s.currency, 'at', e.provider_event_time), e.provider_event_time
        FROM public.smart_pack_add_on_events e JOIN public.smart_pack_add_ons s ON s.add_on_id = e.add_on_id
        WHERE e.provider = 'payplus' AND e.event_type = 'payment_confirmed' AND e.outcome IN ('applied', 'stale')
          AND e.provider_event_time >= p_from AND e.provider_event_time <= p_until) c), '[]'::jsonb),
    'refunds', coalesce((
      SELECT jsonb_agg(jsonb_build_object('transactionUid', s.uid))
      FROM (SELECT e.provider_event_id AS uid FROM public.subscription_events e WHERE e.provider = 'payplus' AND e.event_type = 'refund'
            UNION
            SELECT e.provider_event_id FROM public.smart_pack_add_on_events e WHERE e.provider = 'payplus' AND e.event_type = 'refund'
            UNION
            SELECT r.refund_ref FROM public.billing_admin_refunds r WHERE r.stage = 'result' AND r.refund_status = 'refunded' AND r.refund_ref IS NOT NULL
            UNION
            -- 20261029000000 (Codex F03): a recorded SMART PACK removal refund is ours too
            SELECT r.refund_ref FROM public.smart_pack_removals r WHERE r.refund_state = 'refunded' AND r.refund_ref IS NOT NULL) s), '[]'::jsonb),
    -- 20261029000000 (Codex F01/F02): removal refunds the Owner must settle
    'owedRefunds', public.smart_pack_removal_refunds_owed()
  )
$function$;
REVOKE ALL ON FUNCTION public.billing_reconcile_source(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_reconcile_source(timestamptz, timestamptz) TO service_role;
-- a removal refund the Owner must settle is a finding of its own
ALTER TABLE public.billing_reconcile_findings DROP CONSTRAINT IF EXISTS billing_reconcile_findings_code_check;
ALTER TABLE public.billing_reconcile_findings ADD CONSTRAINT billing_reconcile_findings_code_check
  CHECK (code IN ('UNLINKED', 'MISSING_AT_PROVIDER', 'AMOUNT_MISMATCH', 'REFUND_UNRECORDED', 'REFUND_OWED'));

-- 3. the market of an account: the app's one market rule (L-25) ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_market_for_country(p_country text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT CASE WHEN p_country IS NULL OR regexp_replace(p_country, '^\s+|\s+$', '', 'g') = '' THEN NULL
              WHEN public.admin_market_of(p_country) = 'Local' THEN 'IL'
              ELSE 'INTERNATIONAL' END;
$$;
REVOKE ALL ON FUNCTION public.account_market_for_country(text) FROM PUBLIC, anon, authenticated, service_role;

-- an account the old rule placed abroad by mistake, while it never started a purchase and is not paid (the trigger's own guard)
UPDATE public.account_market m SET market = 'IL', set_at = now()
  FROM public.business_settings b
 WHERE b.user_id = m.user_id AND m.source = 'business_settings_country' AND m.market = 'INTERNATIONAL'
   AND public.account_market_for_country(b.country) = 'IL'
   AND NOT EXISTS (SELECT 1 FROM public.checkout_attempts c WHERE c.user_id = m.user_id)
   AND NOT EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = m.user_id AND e.account_mode = 'paid');

-- 4. expense invoices: an unknown PayPlus answer ----------------------------------------------------------------------------------
ALTER TABLE public.expense_invoices DROP CONSTRAINT IF EXISTS expense_invoices_status_check;
ALTER TABLE public.expense_invoices ADD CONSTRAINT expense_invoices_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'excluded', 'sending', 'sent', 'send_failed', 'unknown'));
