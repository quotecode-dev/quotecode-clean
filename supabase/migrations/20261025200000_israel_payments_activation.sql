-- ============================================================================================================================
-- 20261025200000_israel_payments_activation.sql  -  what the database needs before purchasing opens in Israel only
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-25 ("אני רוצה להפעיל את הסליקה בעברית ... כבר עכשיו"; "להפעיל כל מה שצריך בכדי שמשתמש בארץ יוכל לרכוש מנוי";
--   monthly AND annual; Free-10 in both markets; international stays closed until PayPlus approves foreign-currency billing).
--   Everything here is INERT until the Owner raises public.billing_activation to 'enforced' in Production:
--   1. account_market gets written. Until now only the Owner mapping batch wrote it, so no account had a market and no pay button
--      could ever show. The market follows the account type chosen at signup (business_settings.country): 'Local' / 'LCL' = IL
--      (the same rule as the app's isLocalIsraeliBusiness), any other value = INTERNATIONAL. A new account gets it on its first
--      settings row; an account type change moves it only while the account never started a purchase (no checkout attempt) and
--      is not paid. Backfill: every existing settings row.
--   2. set_billing_phase accepts 'enforced' (OPEN-12 closed by the Owner's activation decision) - only with an operator attestation
--      of at least 20 characters, the same discipline as set_activation_phase. 'off' stays always allowed (the rollback).
--   3. create_package_checkout_intent refuses every market other than IL ('market_not_open') - the server gate; until now only the
--      browser hid the button abroad. Body otherwise identical to 20261021400000 (5).
-- Rollback of THIS file: DROP TRIGGER business_settings_account_market ON public.business_settings; DROP FUNCTION
--   public.sync_account_market(); DROP FUNCTION public.account_market_for_country(text); re-run 20261007150100 (set_billing_phase) and
--   20261021400000 section 5 (create_package_checkout_intent). Market rows written here may stay (they are read only by billing).
-- ============================================================================================================================

-- 1. the market of an account -------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_market_for_country(p_country text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT CASE WHEN p_country IS NULL OR btrim(p_country) = '' THEN NULL
              WHEN p_country IN ('Local', 'LCL') THEN 'IL'
              ELSE 'INTERNATIONAL' END;
$$;
REVOKE ALL ON FUNCTION public.account_market_for_country(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_account_market()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_market text := public.account_market_for_country(NEW.country);
BEGIN
  IF NEW.user_id IS NULL OR v_market IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.account_market (user_id, market, source) VALUES (NEW.user_id, v_market, 'business_settings_country')
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source, set_at = now()
   WHERE public.account_market.market IS DISTINCT FROM EXCLUDED.market
     AND NOT EXISTS (SELECT 1 FROM public.checkout_attempts c WHERE c.user_id = EXCLUDED.user_id)
     AND NOT EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = EXCLUDED.user_id AND e.account_mode = 'paid');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_account_market() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS business_settings_account_market ON public.business_settings;
CREATE TRIGGER business_settings_account_market
  AFTER INSERT OR UPDATE OF country ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_market();

INSERT INTO public.account_market (user_id, market, source)
SELECT b.user_id, public.account_market_for_country(b.country), 'business_settings_country'
  FROM public.business_settings b
 WHERE b.user_id IS NOT NULL AND public.account_market_for_country(b.country) IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2. the billing switch may be raised to enforced (with an attestation) ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_billing_phase(p_phase text, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_phase IS NULL OR p_phase NOT IN ('off', 'prepared', 'enforced') OR coalesce(length(trim(p_reason)), 0) < 3 THEN
    RAISE EXCEPTION 'set_billing_phase: invalid arguments' USING ERRCODE = '22023';
  END IF;
  IF p_phase = 'enforced' AND length(trim(p_reason)) < 20 THEN
    RAISE EXCEPTION 'set_billing_phase: enforced requires an operator attestation of the external preconditions' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.billing_activation SET phase = p_phase, changed_at = now(), reason = p_reason WHERE id;
  RETURN p_phase;
END $$;
REVOKE ALL ON FUNCTION public.set_billing_phase(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- 3. the payment page: Israel only (body 20261021400000 section 5 + the marked change) -----------------------------------------
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
  -- 20261025200000 (Owner 2026-10-25): purchasing is open in Israel only; abroad waits for PayPlus foreign-currency approval
  IF v_market <> 'IL' THEN RETURN jsonb_build_object('ok', false, 'code', 'market_not_open'); END IF;
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
