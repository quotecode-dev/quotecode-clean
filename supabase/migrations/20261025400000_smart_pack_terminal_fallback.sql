-- ============================================================================================================================
-- 20261025400000_smart_pack_terminal_fallback.sql  -  SMART PACK for a subscriber whose standing order was bound without its terminal
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-25 (typed: "מאשר: מזהה המסוף כסוד, תיקון הצעת חכם פלוס והתחלת השורה במסד, שימוש בו גם בעצירת מנוי בניהול,
--   והסבר בחלון המסלולים כשאי אפשר להוסיף"): the first real subscription was activated by the server PULL, which never carries the
--   PayPlus terminal - so its standing order has no terminal_ref and the SMART PACK quote refused it (not_eligible). The terminal is
--   one per PayPlus account: subscription-authority now uses the Function secret PAYPLUS_TERMINAL_UID when the standing order has none
--   (admin-billing already did). Here (bodies 20261025300000 + the marked changes):
--   1. smart_pack_add_on_quote: a bound standing order is enough (its terminal is not required);
--   2. smart_pack_add_on_line_begin: the standing order with its terminal first, else the newest one (terminalRef null).
--   ROLLBACK (DB owner): re-run 20261025300000 sections 2 and 5 for these two functions.
-- ============================================================================================================================

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
  IF v_market IS DISTINCT FROM 'IL' THEN RETURN jsonb_build_object('ok', false, 'code', 'market_not_open'); END IF;
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
   WHERE plan_id = 'smart_pack' AND offer = 'current' AND market = 'IL' AND billing_period = v_ent.package_period;
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
  -- IRON-ILS-001: a whole shekel (half up) - the amount charged is the amount shown
  RETURN jsonb_build_object('ok', true, 'market', 'IL', 'currency', v_price.currency,
    'amountMinor', greatest(100, (round(v_price.amount_minor::numeric * v_left / v_days / 100) * 100)::int),
    'priceId', v_price.price_id, 'recurringMinor', v_price.amount_minor, 'period', v_ent.package_period, 'periodEnd', v_ent.paid_through,
    'daysLeft', v_left, 'daysInPeriod', v_days, 'packageAttemptId', v_att.attempt_id);
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_add_on_quote(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_add_on_quote(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.smart_pack_add_on_line_begin(p_add_on_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user uuid; v_row public.smart_pack_add_ons; v_ent public.account_entitlements; v_att public.checkout_attempts; v_price public.price_versions;
  v_rec public.provider_standing_orders; v_next date;
BEGIN
  SELECT a.user_id INTO v_user FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id;
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
  SELECT * INTO v_row FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id FOR UPDATE;
  IF v_row.state <> 'paid' OR v_row.line_state IN ('added', 'not_added') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'line_not_open', 'lineState', v_row.line_state);
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = v_user;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_row.package_attempt_id;
  SELECT * INTO v_price FROM public.price_versions p WHERE p.price_id = v_row.price_id;
  SELECT * INTO v_rec FROM public.provider_standing_orders s
   WHERE s.provider = 'payplus' AND s.attempt_id = v_row.package_attempt_id
   ORDER BY (s.terminal_ref IS NULL), s.created_at DESC LIMIT 1; -- 20261025400000: one with its terminal first; else terminalRef null
  v_next := (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date;
  IF v_ent.live_attempt_id IS DISTINCT FROM v_row.package_attempt_id OR v_ent.subscription_status IS DISTINCT FROM 'active'
     OR v_ent.renewal_stopped_at IS NOT NULL OR v_ent.smart_pack_line OR v_att.add_on_price_id IS NOT NULL OR public.paid_account_limited(v_user)
     OR v_rec.recurring_ref IS NULL OR v_att.provider_request_ref IS NULL
     OR v_next IS NULL OR v_next <= (now() AT TIME ZONE 'Asia/Jerusalem')::date THEN
    UPDATE public.smart_pack_add_ons SET line_state = 'not_added', line_at = now() WHERE add_on_id = p_add_on_id;
    RETURN jsonb_build_object('ok', false, 'code', 'line_not_possible');
  END IF;
  UPDATE public.smart_pack_add_ons SET line_state = 'requested', line_at = now() WHERE add_on_id = p_add_on_id;
  RETURN jsonb_build_object('ok', true, 'addOnId', p_add_on_id, 'packageAttemptId', v_att.attempt_id, 'recurringRef', v_rec.recurring_ref,
    'terminalRef', v_rec.terminal_ref, 'packageRequestRef', v_att.provider_request_ref, 'packageAmountMinor', v_att.amount_minor,
    'addOnAmountMinor', v_price.amount_minor, 'period', v_row.period, 'currency', v_att.currency, 'nextChargeDate', to_char(v_next, 'YYYY-MM-DD'));
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_add_on_line_begin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_add_on_line_begin(uuid) TO service_role;
