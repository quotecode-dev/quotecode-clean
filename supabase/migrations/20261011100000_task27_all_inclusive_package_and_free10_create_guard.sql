-- ============================================================================================================================
-- 20261011100000_task27_all_inclusive_package_and_free10_create_guard.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Task 27 (local; NOT applied to any remote project). Owner decisions: PROFLOW_PROJECT_CONTEXT.md §249 (+ the 2026-10-11 amendment
-- typed by the Owner: International annual $184.00) and §253 (Free-10 upgrade window on attempted paid actions; check before insert).
--
-- 1. price_versions: the ONE current paid offer = the all-inclusive package, monthly or annual, per market (amount_minor = the billed
--    amount = the displayed amount): IL 3000 / 30600 ILS incl. VAT; INTERNATIONAL 1800 / 18400 USD. The OD-03..OD-08 three-plan rows
--    are KEPT (append-only table; immutable) and classified offer = 'legacy' (existing rights only; never offered to new purchases).
-- 2. account_entitlements: a paid account holds EITHER a legacy style plan (existing rights, unchanged) OR the package with its billing
--    period. No account is migrated, re-priced or re-planned by this file. Quote styles are not subscriptions.
-- 3. account_summary_build: plan.id = the package id when the account holds it (else the legacy style plan / 'free').
-- 4. create_package_checkout_intent: the package checkout intent (period month | year, no add-on blocks); the server picks the price
--    row of the account's server market; billing stays 'off' (set_billing_phase still refuses 'enforced': provider unverified), so it
--    answers checkout_unavailable today - nothing simulates a purchase. The legacy 4-arg create_checkout_intent is left unchanged.
-- 5. Free-10 creation guard: when free_issue is 'enforced' and a Free-10 account has no remaining free quote (consumed + live
--    reservations >= limit), INSERT of a NEW quote is refused BEFORE the row exists ('free_issue_limit_reached'), whatever the client
--    path (new / duplicate / template / direct API / concurrent). Updates of existing quotes are untouched (permitted actions stay
--    available); outputs keep their own ledger enforcement. Prepared / shadow phases change nothing.
--
-- Re-runnable: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS + ADD, INSERT ... ON CONFLICT DO NOTHING, CREATE OR REPLACE,
-- DROP TRIGGER IF EXISTS. Rollback: drop the guard trigger + function and create_package_checkout_intent, re-create
-- account_summary_build / get_price_catalog from 20261007150900 / 20261007150100, restore the previous constraints; the package rows
-- (append-only) and the new nullable columns may stay - they are inert without the functions.
-- ============================================================================================================================

-- 1. price_versions --------------------------------------------------------------------------------------------------------------
ALTER TABLE public.price_versions ADD COLUMN IF NOT EXISTS offer text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_offer_check;
ALTER TABLE public.price_versions ADD CONSTRAINT price_versions_offer_check CHECK (offer IN ('current', 'legacy'));
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_plan_id_check;
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_plan_id_check_v2;
ALTER TABLE public.price_versions ADD CONSTRAINT price_versions_plan_id_check_v2
  CHECK (plan_id IN ('classic', 'modern', 'visual', 'catalog_block_100', 'all_inclusive'));
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_billing_period_check;
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_billing_period_check_v2;
ALTER TABLE public.price_versions ADD CONSTRAINT price_versions_billing_period_check_v2
  CHECK (billing_period = 'month' OR (billing_period = 'year' AND plan_id = 'all_inclusive'));
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_approved_ref_check;
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_approved_ref_check_v2;
ALTER TABLE public.price_versions ADD CONSTRAINT price_versions_approved_ref_check_v2
  CHECK (approved_ref ~ '^OD-0[0-9](,OD-0[0-9])*$' OR approved_ref ~ '^S249(,AMEND-2026-10-11)?$');
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_offer_shape;
ALTER TABLE public.price_versions ADD CONSTRAINT price_versions_offer_shape
  CHECK ((plan_id = 'all_inclusive') = (offer = 'current'));

INSERT INTO public.price_versions (price_id, plan_id, market, currency, billing_period, amount_minor, tax_mode, approved_ref, valid_from, offer) VALUES
  ('il_all_inclusive_month_p1',   'all_inclusive', 'IL',            'ILS', 'month',  3000, 'included',    'S249',                  '2026-10-11 00:00:00+00', 'current'),
  ('il_all_inclusive_year_p1',    'all_inclusive', 'IL',            'ILS', 'year',  30600, 'included',    'S249',                  '2026-10-11 00:00:00+00', 'current'),
  ('intl_all_inclusive_month_p1', 'all_inclusive', 'INTERNATIONAL', 'USD', 'month',  1800, 'not_decided', 'S249',                  '2026-10-11 00:00:00+00', 'current'),
  ('intl_all_inclusive_year_p2',  'all_inclusive', 'INTERNATIONAL', 'USD', 'year',  18400, 'not_decided', 'S249,AMEND-2026-10-11', '2026-10-11 00:00:00+00', 'current')
ON CONFLICT (price_id) DO NOTHING;

-- Read-only catalog view for one market; now also states the offer class so a client can never present a legacy row as current.
CREATE OR REPLACE FUNCTION public.get_price_catalog(p_market text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_market IS NULL OR p_market NOT IN ('IL', 'INTERNATIONAL') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unknown_market');
  END IF;
  RETURN jsonb_build_object('ok', true, 'market', p_market, 'prices', coalesce((
    SELECT jsonb_agg(jsonb_build_object('priceId', price_id, 'planId', plan_id, 'currency', currency, 'billingPeriod', billing_period,
                                        'amountMinor', amount_minor, 'taxMode', tax_mode, 'offer', offer) ORDER BY amount_minor, plan_id)
    FROM public.price_versions WHERE market = p_market), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.get_price_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_price_catalog(text) TO anon, authenticated, service_role;

-- 2. account_entitlements ---------------------------------------------------------------------------------------------------------
ALTER TABLE public.account_entitlements ADD COLUMN IF NOT EXISTS package_id text NULL;
ALTER TABLE public.account_entitlements ADD COLUMN IF NOT EXISTS package_period text NULL;
ALTER TABLE public.account_entitlements DROP CONSTRAINT IF EXISTS account_entitlements_package_values;
ALTER TABLE public.account_entitlements ADD CONSTRAINT account_entitlements_package_values
  CHECK ((package_id IS NULL OR package_id = 'all_inclusive') AND (package_period IS NULL OR package_period IN ('month', 'year')));
ALTER TABLE public.account_entitlements DROP CONSTRAINT IF EXISTS account_entitlements_mode_shape;
ALTER TABLE public.account_entitlements ADD CONSTRAINT account_entitlements_mode_shape CHECK (
  (account_mode = 'free_10' AND style_plan_id IS NULL AND package_id IS NULL AND package_period IS NULL AND catalog_expansion_blocks = 0)
  OR (account_mode = 'paid' AND style_plan_id IS NOT NULL AND package_id IS NULL AND package_period IS NULL)
  OR (account_mode = 'paid' AND style_plan_id IS NULL AND package_id IS NOT NULL AND package_id = 'all_inclusive'
      AND package_period IS NOT NULL AND package_period IN ('month', 'year')));

-- 3. account_summary_build (body = 20261007150900 + the package plan id) -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_summary_build(p_user_id uuid, p_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_out      text;
  v_cat      text;
  v_bill     text;
  v_ent      public.account_entitlements%ROWTYPE;
  v_market   text;
  v_reserved integer;
  v_active   bigint;
  v_pcv      text;
  v_legacy   jsonb := NULL;
  v_res      jsonb;
BEGIN
  IF p_admin THEN
    SELECT jsonb_build_object('plan', b.plan, 'trialEndsAt', b.trial_ends_at, 'isLifetime', b.is_lifetime) INTO v_legacy
      FROM public.business_settings b WHERE b.user_id = p_user_id;
    v_legacy := coalesce(v_legacy, jsonb_build_object('plan', NULL, 'trialEndsAt', NULL, 'isLifetime', NULL));
  END IF;
  SELECT a.phase INTO v_out FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_out IS NULL OR v_out = 'prepared' THEN
    v_res := jsonb_build_object('ok', false, 'code', 'not_activated');
    RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND THEN
    v_res := jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
    RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
  END IF;
  SELECT a.phase INTO v_cat FROM public.subscription_activation a WHERE a.component = 'catalog_capacity';
  SELECT b.phase INTO v_bill FROM public.billing_activation b WHERE b.id;
  SELECT m.market INTO v_market FROM public.account_market m WHERE m.user_id = p_user_id;
  v_reserved := public.quote_output_live_reservations(p_user_id, NULL);
  SELECT count(*) INTO v_active FROM public.services s WHERE s.user_id = p_user_id;
  IF v_market IS NOT NULL THEN
    SELECT 'pv1:' || left(encode(sha256(convert_to(string_agg(p.price_id || ':' || p.amount_minor || ':' || p.currency || ':'
                                                              || p.valid_from, ',' ORDER BY p.price_id), 'UTF8')), 'hex'), 16)
      INTO v_pcv FROM public.price_versions p WHERE p.market = v_market;
  END IF;
  v_res := jsonb_build_object(
    'ok', true,
    'schema', 'account-summary/v1',
    'version', v_ent.entitlement_version,
    'phase', jsonb_build_object('output', v_out, 'catalog', coalesce(v_cat, 'prepared'), 'billing', coalesce(v_bill, 'off')),
    'market', v_market,
    'plan', jsonb_build_object('id', CASE WHEN v_ent.account_mode = 'free_10' THEN 'free'
                                          WHEN v_ent.package_id IS NOT NULL THEN v_ent.package_id
                                          ELSE v_ent.style_plan_id END),
    'subscriptionStatus', v_ent.subscription_status,
    'capabilities', to_jsonb(public.subscription_account_capabilities(p_user_id)),
    'eligiblePlans', '{}'::jsonb,
    'free10', CASE WHEN v_ent.account_mode = 'free_10' THEN jsonb_build_object(
                'limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed, 'reserved', v_reserved,
                'remaining', greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0)) END,
    'catalog', jsonb_build_object(
                'active', v_active,
                'countDefinition', 'unset',
                'limit', CASE WHEN v_ent.account_mode = 'paid' THEN 100 + 100 * v_ent.catalog_expansion_blocks END,
                'blocks', v_ent.catalog_expansion_blocks,
                'limitDecided', v_ent.account_mode = 'paid'),
    'priceCatalogVersion', v_pcv);
  RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
END
$function$;
REVOKE ALL ON FUNCTION public.account_summary_build(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- 4. Package checkout intent (service_role only; the subscription-authority function calls it with the JWT identity) -------------
CREATE OR REPLACE FUNCTION public.create_package_checkout_intent(p_user_id uuid, p_billing_period text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_market text; v_price public.price_versions; v_row public.checkout_attempts;
BEGIN
  IF p_user_id IS NULL OR p_billing_period IS NULL OR p_idempotency_key IS NULL
     OR p_billing_period NOT IN ('month', 'year') OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id FOR SHARE;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable');
  END IF;
  SELECT market INTO v_market FROM public.account_market WHERE user_id = p_user_id FOR SHARE;
  IF v_market IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'account_unprovisioned'); END IF;
  SELECT * INTO v_price FROM public.price_versions
   WHERE plan_id = 'all_inclusive' AND offer = 'current' AND market = v_market AND billing_period = p_billing_period;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable'); END IF;
  SELECT * INTO v_row FROM public.checkout_attempts WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_row.plan_price_id <> v_price.price_id OR v_row.blocks <> 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    END IF;
  ELSE
    INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, block_price_id, blocks, market, currency, amount_minor)
    VALUES (p_user_id, p_idempotency_key, v_price.price_id, NULL, 0, v_market, v_price.currency, v_price.amount_minor)
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING * INTO v_row;
    IF v_row.attempt_id IS NULL THEN
      SELECT * INTO v_row FROM public.checkout_attempts WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'attemptId', v_row.attempt_id, 'market', v_row.market, 'currency', v_row.currency,
                            'amountMinor', v_row.amount_minor, 'planPriceId', v_row.plan_price_id, 'billingPeriod', p_billing_period,
                            'blocks', 0, 'state', v_row.state);
END $$;
REVOKE ALL ON FUNCTION public.create_package_checkout_intent(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_package_checkout_intent(uuid, text, text) TO service_role;

-- 5. Free-10 creation guard (BEFORE INSERT on quotes) ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_free10_quote_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ent public.account_entitlements%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = NEW.user_id;
  IF NOT FOUND OR v_ent.account_mode <> 'free_10' THEN
    RETURN NEW; -- paid (current or legacy) is never blocked here; unprovisioned keeps the existing output enforcement
  END IF;
  IF v_ent.free_issues_consumed + public.quote_output_live_reservations(NEW.user_id, NULL) >= v_ent.free_issue_limit THEN
    RAISE EXCEPTION 'free_issue_limit_reached: all % free quotes are used; a new quote needs the subscription', v_ent.free_issue_limit
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.enforce_free10_quote_creation() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quotes_free10_creation_guard ON public.quotes;
CREATE TRIGGER quotes_free10_creation_guard BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free10_quote_creation();
