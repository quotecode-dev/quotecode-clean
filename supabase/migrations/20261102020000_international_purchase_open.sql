-- ============================================================================================================================
-- 20261102020000_international_purchase_open.sql  -  purchasing opens abroad (USD), like in Israel
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-01 (typed: "מאשר פתיחת הרכישה בחו"ל לפי ההמלצות א-ה, כולל שינוי ב-L-01, L-05, L-06, L-07, L-11, L-12, L-14,
--   L-17, L-22"); OWNER_INTL_PURCHASE_2026-11-01.md. Bodies = the latest definitions + the marked changes:
--   1. create_package_checkout_intent (20261025200000): the INTERNATIONAL market opens - it pays its own USD price rows.
--   2. smart_pack_add_on_quote (20261025400000) / create_smart_pack_add_on_intent (20261025300000): SMART PACK mid-period in both
--      markets; the USD pro-rata amount is in cents (the ILS one stays a whole shekel, IRON-ILS-001). smart_pack_add_ons takes USD.
--   3. Decision (c): the USD cancellation fee is 5% capped at $27 - billing_admin_preview (20261029100000) and the SMART PACK removal
--      quote (20261029100000); a USD removal refund is in cents.
--   4. smart_pack_removal_refunds_owed (20261029000000) answers the currency of each refund owed (billing-reconcile reports it).
--   Decision (a), 0% VAT abroad (export of a service), is what the PayPlus page already sends (vat_type 2); the price rows keep their
--   append-only tax_mode label. The billing phase and every other rule are unchanged.
-- Rollback of THIS file (DB owner): re-run 20261025200000 section 3, 20261025400000 section 1, 20261025300000 section 3 and
--   20261029100000 sections 2-3 and the owed-refunds function of 20261029000000; the currency CHECK may go back to 'ILS' only while no USD add-on row exists.
-- ============================================================================================================================

ALTER TABLE public.smart_pack_add_ons DROP CONSTRAINT IF EXISTS smart_pack_add_ons_currency_check;
ALTER TABLE public.smart_pack_add_ons ADD CONSTRAINT smart_pack_add_ons_currency_check CHECK (currency IN ('ILS', 'USD'));

CREATE OR REPLACE FUNCTION public.create_package_checkout_intent(p_user_id uuid, p_billing_period text, p_idempotency_key text,
                                                                 p_smart_pack boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_market text; v_price public.price_versions; v_row public.checkout_attempts; v_addon public.price_versions;
BEGIN
  IF p_user_id IS NULL OR p_billing_period IS NULL OR p_idempotency_key IS NULL OR p_smart_pack IS NULL
     OR p_billing_period NOT IN ('month', 'year') OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id FOR SHARE;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable');
  END IF;
  SELECT market INTO v_market FROM public.account_market WHERE user_id = p_user_id FOR SHARE;
  IF v_market IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'account_unprovisioned'); END IF;
  -- 20261101100000 (Owner 2026-11-01): purchasing is open in Israel (ILS) and abroad (USD) - each market pays its own price rows
  IF v_market NOT IN ('IL', 'INTERNATIONAL') THEN RETURN jsonb_build_object('ok', false, 'code', 'market_not_open'); END IF;
  -- PayPlus phase 1: never a payment page for an account that would pay for nothing
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false)
     OR EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = p_user_id AND e.account_mode = 'paid'
                 AND (e.style_plan_id IS NOT NULL OR e.subscription_status = 'active'))
     -- 20261021200000: a LIMITED account (grace days over) may pay again - a payment ends limited mode
     AND NOT public.paid_account_limited(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_subscribed');
  END IF;
  -- 20261021200000: a failed renewal is paid on the live standing order (PayPlus retries it) - never a second subscription
  IF EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = p_user_id AND e.account_mode = 'paid'
              AND e.subscription_status = 'past_due') AND NOT public.paid_account_limited(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'payment_update_required');
  END IF;
  SELECT * INTO v_price FROM public.price_versions
   WHERE plan_id = 'all_inclusive' AND offer = 'current' AND market = v_market AND billing_period = p_billing_period;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable'); END IF;
  -- 20261021400000: the ticked SMART PACK box = its own price row of the same market and cycle, on the same payment
  IF p_smart_pack THEN
    SELECT * INTO v_addon FROM public.price_versions
     WHERE plan_id = 'smart_pack' AND offer = 'current' AND market = v_market AND billing_period = p_billing_period;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable'); END IF;
  END IF;
  SELECT * INTO v_row FROM public.checkout_attempts WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_row.plan_price_id <> v_price.price_id OR v_row.blocks <> 0 OR v_row.add_on_price_id IS DISTINCT FROM v_addon.price_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    END IF;
  ELSE
    INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, block_price_id, blocks, market, currency, amount_minor,
                                          add_on_price_id)
    VALUES (p_user_id, p_idempotency_key, v_price.price_id, NULL, 0, v_market, v_price.currency,
            v_price.amount_minor + coalesce(v_addon.amount_minor, 0), v_addon.price_id)
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING * INTO v_row;
    IF v_row.attempt_id IS NULL THEN
      SELECT * INTO v_row FROM public.checkout_attempts WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'attemptId', v_row.attempt_id, 'market', v_row.market, 'currency', v_row.currency,
                            'amountMinor', v_row.amount_minor, 'planPriceId', v_row.plan_price_id, 'billingPeriod', p_billing_period,
                            'blocks', 0, 'state', v_row.state,
                            'smartPack', v_row.add_on_price_id IS NOT NULL, 'addOnPriceId', v_row.add_on_price_id,
                            'packageAmountMinor', v_price.amount_minor, 'addOnAmountMinor', v_addon.amount_minor);
END $$;
REVOKE ALL ON FUNCTION public.create_package_checkout_intent(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_package_checkout_intent(uuid, text, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.smart_pack_add_on_quote(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_market text; v_ent public.account_entitlements; v_att public.checkout_attempts; v_price public.price_versions;
  v_pp public.billing_paid_periods; v_start timestamptz; v_days int; v_left int;
BEGIN
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable');
  END IF;
  SELECT market INTO v_market FROM public.account_market WHERE user_id = p_user_id;
  -- 20261101100000: SMART PACK can be added mid-period in both markets
  IF v_market IS NULL OR v_market NOT IN ('IL', 'INTERNATIONAL') THEN RETURN jsonb_build_object('ok', false, 'code', 'market_not_open'); END IF;
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF v_ent.user_id IS NULL OR v_ent.account_mode <> 'paid' OR v_ent.package_id IS DISTINCT FROM 'all_inclusive' OR v_ent.style_plan_id IS NOT NULL
     OR v_ent.subscription_status <> 'active' OR v_ent.live_attempt_id IS NULL OR v_ent.paid_through IS NULL OR v_ent.paid_through <= now()
     OR v_ent.package_period NOT IN ('month', 'year') OR v_ent.renewal_stopped_at IS NOT NULL OR v_ent.payment_failed_at IS NOT NULL
     OR public.paid_account_limited(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_ent.live_attempt_id;
  IF v_ent.smart_pack_line OR v_att.add_on_price_id IS NOT NULL OR (v_ent.smart_pack_until IS NOT NULL AND v_ent.smart_pack_until > now()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_included');
  END IF;
  -- the line needs what smart_pack_add_on_line_begin needs (review 2026-10-25: never a payment for a line that can never be added):
  -- the standing order of the live package, the package page request id, a next charge after today. 20261025400000: its terminal is
  -- no longer required here - a standing order bound by the server pull has none, and the function uses the account terminal
  -- (PAYPLUS_TERMINAL_UID) then
  IF NOT EXISTS (SELECT 1 FROM public.provider_standing_orders s
                  WHERE s.provider = 'payplus' AND s.attempt_id = v_att.attempt_id)
     OR v_att.provider_request_ref IS NULL
     OR (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date <= (now() AT TIME ZONE 'Asia/Jerusalem')::date THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  SELECT * INTO v_price FROM public.price_versions
   WHERE plan_id = 'smart_pack' AND offer = 'current' AND market = v_market AND billing_period = v_ent.package_period;
  IF NOT FOUND OR v_price.currency IS DISTINCT FROM v_att.currency THEN
    RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable');
  END IF;
  -- the active paid period (its real start); derived from the period end only without a period row (the refund preview's rule)
  SELECT * INTO v_pp FROM public.billing_paid_periods p
   WHERE p.user_id = p_user_id AND p.attempt_id = v_att.attempt_id AND p.period_start <= now() AND p.period_end > now()
   ORDER BY p.period_end DESC, p.period_id DESC LIMIT 1;
  v_start := coalesce(v_pp.period_start,
    ((v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem') - CASE v_ent.package_period WHEN 'year' THEN interval '1 year' ELSE interval '1 month' END)
      AT TIME ZONE 'Asia/Jerusalem');
  v_days := greatest(1, (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date - (v_start AT TIME ZONE 'Asia/Jerusalem')::date);
  v_left := least(v_days, greatest(1, (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date - (now() AT TIME ZONE 'Asia/Jerusalem')::date));
  -- IRON-ILS-001: a whole shekel (half up) - the amount charged is the amount shown; 20261101100000: USD in cents (at least $1)
  RETURN jsonb_build_object('ok', true, 'market', v_market, 'currency', v_price.currency,
    'amountMinor', CASE WHEN v_price.currency = 'ILS'
                        THEN greatest(100, (round(v_price.amount_minor::numeric * v_left / v_days / 100) * 100)::int)
                        ELSE greatest(100, round(v_price.amount_minor::numeric * v_left / v_days)::int) END,
    'priceId', v_price.price_id, 'recurringMinor', v_price.amount_minor, 'period', v_ent.package_period, 'periodEnd', v_ent.paid_through,
    'daysLeft', v_left, 'daysInPeriod', v_days, 'packageAttemptId', v_att.attempt_id);
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_add_on_quote(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_add_on_quote(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_smart_pack_add_on_intent(p_user_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_q jsonb; v_row public.smart_pack_add_ons;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || p_user_id::text));
  SELECT * INTO v_row FROM public.smart_pack_add_ons WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN
    v_q := public.smart_pack_add_on_quote(p_user_id);
    IF (v_q ->> 'ok') IS DISTINCT FROM 'true' THEN RETURN v_q; END IF;
    -- review 2026-10-25: one payable page per account - a second click / tab gets the open page of the same amount and period end;
    -- an open page of another amount (a day later) expires, so two pages can never both be paid for one period
    SELECT * INTO v_row FROM public.smart_pack_add_ons a
     WHERE a.user_id = p_user_id AND a.state = 'pending' AND a.amount_minor = (v_q ->> 'amountMinor')::int
       AND a.period_end = (v_q ->> 'periodEnd')::timestamptz AND a.package_attempt_id = (v_q ->> 'packageAttemptId')::uuid
     ORDER BY a.created_at DESC LIMIT 1;
  END IF;
  IF v_row.add_on_id IS NULL THEN
    UPDATE public.smart_pack_add_ons SET state = 'expired' WHERE user_id = p_user_id AND state = 'pending';
    INSERT INTO public.smart_pack_add_ons (user_id, package_attempt_id, price_id, idempotency_key, period, currency, amount_minor, period_end,
                                           days_left, days_in_period)
    VALUES (p_user_id, (v_q ->> 'packageAttemptId')::uuid, v_q ->> 'priceId', p_idempotency_key, v_q ->> 'period', v_q ->> 'currency',
            (v_q ->> 'amountMinor')::int, (v_q ->> 'periodEnd')::timestamptz, (v_q ->> 'daysLeft')::int, (v_q ->> 'daysInPeriod')::int)
    RETURNING * INTO v_row;
  END IF;
  RETURN jsonb_build_object('ok', true, 'addOnId', v_row.add_on_id,
    'market', (SELECT m.market FROM public.account_market m WHERE m.user_id = p_user_id), 'currency', v_row.currency, 'amountMinor', v_row.amount_minor,
    'period', v_row.period, 'periodEnd', v_row.period_end, 'state', v_row.state,
    'recurringMinor', (SELECT p.amount_minor FROM public.price_versions p WHERE p.price_id = v_row.price_id));
END $$;
REVOKE ALL ON FUNCTION public.create_smart_pack_add_on_intent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_smart_pack_add_on_intent(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.billing_admin_preview(p_user_id uuid, p_waive_fee boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_ent public.account_entitlements; v_att public.checkout_attempts; v_period text;
  v_rec public.provider_standing_orders; v_charge text; v_start timestamptz; v_end timestamptz;
  v_days int; v_unused int; v_prorated int; v_fee int; v_refund int; v_pp public.billing_paid_periods; v_pend timestamptz; v_future boolean;
  v_paid int;
BEGIN
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
  END IF;
  IF p_user_id IS NULL OR p_waive_fee IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'lifetime_account');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF v_ent.user_id IS NULL OR v_ent.account_mode <> 'paid' OR v_ent.package_id IS NULL OR v_ent.style_plan_id IS NOT NULL
     OR v_ent.live_attempt_id IS NULL OR v_ent.paid_through IS NULL OR v_ent.package_period NOT IN ('month', 'year') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_live_package');
  END IF;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_ent.live_attempt_id;
  v_period := v_ent.package_period;
  -- the newest standing order of the live attempt, and the newest real charge of it (a pulled first charge has no transaction id)
  SELECT * INTO v_rec FROM public.provider_standing_orders s WHERE s.attempt_id = v_att.attempt_id ORDER BY s.created_at DESC LIMIT 1;
  -- the ACTIVE paid period (Codex audit H-03) and its own charge; a later period already paid = hasFuturePeriod
  SELECT * INTO v_pp FROM public.billing_paid_periods p
   WHERE p.user_id = p_user_id AND p.attempt_id = v_att.attempt_id AND p.period_start <= now() AND p.period_end > now()
   ORDER BY p.period_end DESC, p.period_id DESC LIMIT 1;
  v_pend := coalesce(v_pp.period_end, v_ent.paid_through);
  v_future := v_ent.paid_through > v_pend;
  v_charge := v_pp.charge_ref;
  IF v_charge IS NULL AND v_pp.event_id LIKE 'pull:%' THEN
    -- a period opened by a pull: its first charge's callback (stale, within 7 days of the pull)
    SELECT e.provider_event_id INTO v_charge
      FROM public.subscription_events e
      JOIN public.subscription_events p ON p.provider = 'payplus' AND p.provider_event_id = 'pull:' || v_att.attempt_id::text AND p.outcome = 'applied'
     WHERE e.attempt_id = v_att.attempt_id AND e.provider = 'payplus' AND e.event_type = 'payment_confirmed' AND e.outcome = 'stale'
       AND e.provider_event_id NOT LIKE 'pull:%' AND e.provider_event_time < p.provider_event_time + interval '7 days'
     ORDER BY e.provider_event_time, e.event_id LIMIT 1;
  END IF;
  -- the real start of the period (a clamped month end never changes the day count); derived only without a period row
  v_start := coalesce(v_pp.period_start,
    ((v_pend AT TIME ZONE 'Asia/Jerusalem') - CASE v_period WHEN 'year' THEN interval '1 year' ELSE interval '1 month' END)
      AT TIME ZONE 'Asia/Jerusalem');
  -- 20261025300000: the charge of a period that started before the SMART PACK line was added was the package amount only (the
  -- SMART PACK part of that period was its own one-time charge)
  -- 20261029100000 (Codex N02): only a line added after the start that is STILL on the attempt is taken off - a line added and then
  -- removed already left the attempt amount, so taking it off again made the basis too low
  v_paid := v_att.amount_minor - coalesce((SELECT sum(p.amount_minor) FROM public.smart_pack_add_ons a JOIN public.price_versions p ON p.price_id = a.price_id
                                            WHERE a.package_attempt_id = v_att.attempt_id AND a.line_state = 'added' AND a.line_at > v_start
                                              AND NOT EXISTS (SELECT 1 FROM public.smart_pack_removals r WHERE r.package_attempt_id = v_att.attempt_id
                                                                AND r.state = 'removed' AND r.change_at > a.line_at)), 0);
  v_end := (date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') + interval '1 day') AT TIME ZONE 'Asia/Jerusalem';
  v_days := greatest(1, (v_pend AT TIME ZONE 'Asia/Jerusalem')::date - (v_start AT TIME ZONE 'Asia/Jerusalem')::date);
  v_unused := greatest(0, (v_pend AT TIME ZONE 'Asia/Jerusalem')::date - (v_end AT TIME ZONE 'Asia/Jerusalem')::date);
  v_unused := least(v_unused, v_days);
  v_prorated := round(v_paid::numeric * v_unused / v_days)::int;
  v_fee := CASE WHEN p_waive_fee OR v_prorated = 0 THEN 0
                WHEN v_att.currency = 'ILS' THEN least(round(v_paid * 0.05)::int, 10000)
                -- 20261101100000 (Owner decision c, 2026-11-01): USD = 5% capped at $27 (the ILS 100 cap)
                WHEN v_att.currency = 'USD' THEN least(round(v_paid * 0.05)::int, 2700)
                ELSE 0 END;
  v_refund := greatest(0, v_prorated - v_fee);
  RETURN jsonb_build_object('ok', true, 'attemptId', v_att.attempt_id, 'currency', v_att.currency, 'paidMinor', v_paid,
    'period', v_period, 'periodStart', v_start, 'periodEnd', v_pend, 'paidThrough', v_ent.paid_through, 'effectiveEnd', v_end,
    'hasFuturePeriod', v_future,
    'daysInPeriod', v_days, 'unusedDays', v_unused, 'proratedMinor', v_prorated, 'feeMinor', v_fee, 'feeWaived', p_waive_fee,
    'refundMinor', v_refund, 'renewalStopped', v_ent.renewal_stopped_at IS NOT NULL,
    'hasStandingOrder', v_rec.recurring_ref IS NOT NULL, 'hasChargeRef', v_charge IS NOT NULL,
    'recurringRef', v_rec.recurring_ref, 'terminalRef', v_rec.terminal_ref, 'chargeRef', v_charge);
END $$;
REVOKE ALL ON FUNCTION public.billing_admin_preview(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_preview(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.smart_pack_removal_quote(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_ent public.account_entitlements; v_att public.checkout_attempts; v_sp public.price_versions; v_pp public.billing_paid_periods;
  v_open public.smart_pack_removals; v_start timestamptz; v_days int; v_unused int; v_prorated int; v_fee int; v_today date; v_end date;
BEGIN
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable'); END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF v_ent.user_id IS NULL OR v_ent.account_mode <> 'paid' OR v_ent.live_attempt_id IS NULL OR v_ent.paid_through IS NULL OR v_ent.paid_through <= now() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  -- an open (or already done) removal of this package answers its own state - never a second one
  -- 20261029100000 (Codex N04): only a removal of the CURRENT line counts - a SMART PACK bought again after a removal can be removed again
  SELECT * INTO v_open FROM public.smart_pack_removals r WHERE r.user_id = p_user_id AND r.package_attempt_id = v_ent.live_attempt_id
     AND r.state IN ('requested', 'removed')
     AND r.created_at > coalesce((SELECT max(a.line_at) FROM public.smart_pack_add_ons a WHERE a.package_attempt_id = v_ent.live_attempt_id
                                    AND a.line_state = 'added'), '-infinity'::timestamptz)
   ORDER BY r.created_at DESC LIMIT 1;
  IF v_open.removal_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', CASE v_open.state WHEN 'removed' THEN 'already_removed' ELSE 'retry_later' END, 'effectiveAt', v_open.effective_at);
  END IF;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_ent.live_attempt_id;
  IF NOT v_ent.smart_pack_line OR v_att.add_on_price_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'not_on_plan'); END IF;
  IF v_ent.subscription_status <> 'active' OR v_ent.renewal_stopped_at IS NOT NULL OR v_ent.payment_failed_at IS NOT NULL OR public.paid_account_limited(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  v_today := (now() AT TIME ZONE 'Asia/Jerusalem')::date;
  v_end := (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date;
  IF NOT EXISTS (SELECT 1 FROM public.provider_standing_orders s WHERE s.provider = 'payplus' AND s.attempt_id = v_att.attempt_id)
     OR v_att.provider_request_ref IS NULL OR v_end <= v_today THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  SELECT * INTO v_sp FROM public.price_versions p WHERE p.price_id = v_att.add_on_price_id;
  SELECT * INTO v_pp FROM public.billing_paid_periods p
   WHERE p.user_id = p_user_id AND p.attempt_id = v_att.attempt_id AND p.period_start <= now() AND p.period_end > now()
   ORDER BY (p.period_end = v_ent.paid_through) DESC, p.period_end DESC, p.period_id DESC LIMIT 1;
  IF v_sp.billing_period = 'year' THEN
    -- section 6: pro rata for the unused days from tomorrow, less the lower of 5% of the SMART PACK price or 100 ILS
    v_start := coalesce(v_pp.period_start, ((v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem') - interval '1 year') AT TIME ZONE 'Asia/Jerusalem');
    v_days := greatest(1, v_end - (v_start AT TIME ZONE 'Asia/Jerusalem')::date);
    v_unused := least(v_days, greatest(0, v_end - (v_today + 1)));
    v_prorated := round(v_sp.amount_minor::numeric * v_unused / v_days)::int;
    -- 20261101100000 (Owner decision c): the USD cap is $27
    v_fee := CASE WHEN v_prorated = 0 THEN 0 ELSE least(round(v_sp.amount_minor * 0.05)::int, CASE WHEN v_sp.currency = 'USD' THEN 2700 ELSE 10000 END) END;
  END IF;
  RETURN jsonb_build_object('ok', true, 'period', v_sp.billing_period, 'currency', v_sp.currency, 'addOnPriceId', v_sp.price_id,
    'recurringMinor', v_sp.amount_minor, 'effectiveAt', v_ent.paid_through,
    -- a whole shekel in ILS (IRON-ILS-001); USD in cents
    'refundMinor', CASE WHEN v_sp.billing_period <> 'year' THEN 0
                        WHEN v_sp.currency = 'ILS' THEN (round(greatest(0, v_prorated - v_fee) / 100.0) * 100)::int
                        ELSE greatest(0, v_prorated - v_fee) END,
    'feeMinor', coalesce(v_fee, 0), 'chargeRef', v_pp.charge_ref, 'packageAttemptId', v_att.attempt_id);
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_quote(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_quote(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.smart_pack_removal_refunds_owed()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  -- 20261101100000: the currency of the refund owed (the package attempt's) - a USD removal is never reported in ILS
  SELECT coalesce(jsonb_agg(jsonb_build_object('removalId', r.removal_id, 'userId', r.user_id, 'amountMinor', r.refund_minor,
           'currency', (SELECT c.currency FROM public.checkout_attempts c WHERE c.attempt_id = r.package_attempt_id),
           'refundState', r.refund_state, 'at', coalesce(r.refund_claimed_at, r.change_at)) ORDER BY r.change_at), '[]'::jsonb)
    FROM public.smart_pack_removals r
   WHERE r.refund_minor > 0 AND r.state = 'removed'
     AND (r.refund_state = 'unknown'
          OR (r.refund_state = 'sending' AND r.refund_claimed_at < now() - interval '10 minutes')
          OR (r.refund_state = 'due' AND r.change_at < now() - interval '24 hours'));
$$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_refunds_owed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_refunds_owed() TO service_role;

NOTIFY pgrst, 'reload schema';
