-- ============================================================================================================================
-- 20261007150200_subscriptions_account_summary.sql  -  account-summary/v1, capability policy, server capability check
-- tekango-migration-contract: mode=transaction replay=required
--
--   CROSSCUT_CONTRACT.md sections 2.1 and 2.2 (docs/subscriptions-complete-end-to-end-2026-10-07/crosscut/). Inert until the DB
--   owner raises the phase (subscription_activation free_issue is seeded 'prepared' -> get_account_summary answers not_activated,
--   capability_check answers the legacy decision). Never applied to TEST/Production by this change.
--   Decides no commercial value: subscription_capability_policy is created EMPTY, so the only capability any account holds is
--   the baseline quote_style.classic. OD-18: Free can never hold catalog_product_image.upload / catalog_capacity.expand (CHECK).
--   The JSON keys of get_account_summary are exactly the account-summary/v1 contract parsed by
--   supabase/functions/_shared/subscriptionContract.ts (parseAccountSummary).
--   Every SECURITY DEFINER function pins search_path = public, pg_temp and revokes EXECUTE from PUBLIC and every API role
--   before the explicit grants below. Requires 20261007150000 (activation, entitlements, ledger) and 20261007150100 (billing
--   phase, server market, price versions).
--   Re-runnable: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- ============================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------------
-- 1. Generic capability policy (EMPTY = no commercial matrix approved; OPEN-02 / OPEN-13). No application role writes it.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_capability_policy (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  policy_version integer     NOT NULL CHECK (policy_version >= 1),
  account_mode   text        NOT NULL CHECK (account_mode IN ('free_10', 'paid')),
  style_plan_id  text        NULL CHECK (style_plan_id IN ('classic', 'modern', 'visual')),
  capability_id  text        NOT NULL CHECK (capability_id IN (
                   'quote_style.classic', 'quote_style.modern', 'quote_style.visual', 'quote_media.upload',
                   'catalog_product_image.upload', 'quote_attachment.upload', 'quote.edit_duplicate', 'quote.whatsapp_delete',
                   'professional_quote.use', 'professional_quote.reuse', 'catalog_capacity.expand')),
  approval_ref   text        NOT NULL CHECK (length(approval_ref) >= 3),
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- OD-18 (+ OD-04: catalog expansion is a paid add-on): an approved denial no policy row can override
  CONSTRAINT subscription_capability_policy_free_never
    CHECK (NOT (account_mode = 'free_10' AND capability_id IN ('catalog_product_image.upload', 'catalog_capacity.expand'))),
  CONSTRAINT subscription_capability_policy_mode_shape
    CHECK (account_mode = 'paid' OR style_plan_id IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_capability_policy_key
  ON public.subscription_capability_policy (policy_version, account_mode, coalesce(style_plan_id, ''), capability_id);
ALTER TABLE public.subscription_capability_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_capability_policy FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.subscription_capability_policy TO service_role;
DROP POLICY IF EXISTS subscription_capability_policy_service_read ON public.subscription_capability_policy;
CREATE POLICY subscription_capability_policy_service_read ON public.subscription_capability_policy
  FOR SELECT TO service_role USING (true);
DO $do$ BEGIN
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated, service_role',
                 pg_get_serial_sequence('public.subscription_capability_policy', 'id'));
END $do$;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 2. Effective capabilities of an account (internal; service_role only). Unprovisioned -> empty. Provisioned -> baseline
--    quote_style.classic + the styles/media of the latest style_media_capability_policy row + the capabilities of the latest
--    subscription_capability_policy version for exactly (account_mode, style_plan_id). Free never gets the OD-18 denials.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subscription_account_capabilities(p_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ent  public.account_entitlements%ROWTYPE;
  v_sm   jsonb;
  v_ver  integer;
  v_caps text[] := ARRAY['quote_style.classic'];
BEGIN
  IF p_user_id IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN ARRAY[]::text[];
  END IF;
  -- prepared style/media matrix (empty -> baseline classic, no media)
  v_sm := public.resolve_style_media_entitlement(v_ent.account_mode, v_ent.style_plan_id);
  v_caps := v_caps || coalesce((SELECT array_agg('quote_style.' || s) FROM jsonb_array_elements_text(v_sm -> 'allowedStyles') s
                                 WHERE s IN ('classic', 'modern', 'visual')), ARRAY[]::text[]);
  IF coalesce((v_sm ->> 'mediaAllowed')::boolean, false) THEN
    v_caps := v_caps || ARRAY['quote_media.upload'];
  END IF;
  -- generic policy: latest version for exactly this (mode, plan)
  SELECT max(p.policy_version) INTO v_ver FROM public.subscription_capability_policy p
   WHERE p.account_mode = v_ent.account_mode AND p.style_plan_id IS NOT DISTINCT FROM v_ent.style_plan_id;
  IF v_ver IS NOT NULL THEN
    v_caps := v_caps || coalesce((SELECT array_agg(p.capability_id) FROM public.subscription_capability_policy p
                                   WHERE p.account_mode = v_ent.account_mode
                                     AND p.style_plan_id IS NOT DISTINCT FROM v_ent.style_plan_id
                                     AND p.policy_version = v_ver), ARRAY[]::text[]);
  END IF;
  RETURN coalesce((SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(v_caps) c
                    WHERE NOT (v_ent.account_mode = 'free_10'
                               AND c IN ('catalog_product_image.upload', 'catalog_capacity.expand'))), ARRAY[]::text[]);
END
$function$;
REVOKE ALL ON FUNCTION public.subscription_account_capabilities(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.subscription_account_capabilities(uuid) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 3. account-summary/v1 builder (internal, no grants). p_admin adds the legacy audit block.
--    phase.output = free_issue phase, phase.catalog = catalog_capacity phase, phase.billing = billing_activation phase
--    ('off'/'prepared'/'enforced' are already in the summary phase vocabulary off|prepared|shadow|enforced).
-- ---------------------------------------------------------------------------------------------------------------------------
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
  -- opaque version of the approved price catalog of the account's server market (changes with any price row of that market)
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
    'plan', jsonb_build_object('id', CASE WHEN v_ent.account_mode = 'free_10' THEN 'free' ELSE v_ent.style_plan_id END),
    'subscriptionStatus', v_ent.subscription_status,
    'capabilities', to_jsonb(public.subscription_account_capabilities(p_user_id)),
    'eligiblePlans', '{}'::jsonb,
    'free10', CASE WHEN v_ent.account_mode = 'free_10' THEN jsonb_build_object(
                'limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed, 'reserved', v_reserved,
                'remaining', greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0)) END,
    'catalog', jsonb_build_object(
                'active', v_active,
                'limit', CASE WHEN v_ent.account_mode = 'paid' THEN 100 + 100 * v_ent.catalog_expansion_blocks END,
                'blocks', v_ent.catalog_expansion_blocks,
                'limitDecided', v_ent.account_mode = 'paid'),
    'priceCatalogVersion', v_pcv);
  RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
END
$function$;
REVOKE ALL ON FUNCTION public.account_summary_build(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- The signed-in account's own summary. Identity = auth.uid(); there is no argument, so no body/parameter can name an account.
CREATE OR REPLACE FUNCTION public.get_account_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;
  RETURN public.account_summary_build(v_uid, false);
END
$function$;
REVOKE ALL ON FUNCTION public.get_account_summary() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_account_summary() TO authenticated;

-- Admin read (read-only): only a caller whose OWN business_settings.role is super_admin; legacy fields are audit history only.
CREATE OR REPLACE FUNCTION public.get_account_summary_for_admin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = v_uid AND b.role = 'super_admin') THEN
    RAISE EXCEPTION 'get_account_summary_for_admin: super_admin required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'get_account_summary_for_admin: invalid arguments' USING ERRCODE = '22023';
  END IF;
  RETURN public.account_summary_build(p_user_id, true);
END
$function$;
REVOKE ALL ON FUNCTION public.get_account_summary_for_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_account_summary_for_admin(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 4. Server capability check (service_role only; the Edge functions call it before any decode / Storage write).
--    Phase not enforced (prepared / shadow) -> legacy behavior: allowed only for what every account has today
--    (quote_style.classic, catalog_product_image.upload); other capabilities are left to the caller's legacy record (denied here).
--    Enforced -> unprovisioned denied; Free + OD-18 capability denied (free_not_eligible); else membership of the server list.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.capability_check(p_user_id uuid, p_capability text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  c_known  constant text[] := ARRAY['quote_style.classic', 'quote_style.modern', 'quote_style.visual', 'quote_media.upload',
                                    'catalog_product_image.upload', 'quote_attachment.upload', 'quote.edit_duplicate',
                                    'quote.whatsapp_delete', 'professional_quote.use', 'professional_quote.reuse',
                                    'catalog_capacity.expand'];
  c_legacy constant text[] := ARRAY['quote_style.classic', 'catalog_product_image.upload'];
  v_phase  text;
  v_mode   text;
BEGIN
  IF p_user_id IS NULL OR p_capability IS NULL OR NOT (p_capability = ANY (c_known)) THEN
    RETURN jsonb_build_object('ok', true, 'allowed', false, 'source', 'server', 'reason', 'unknown_capability');
  END IF;
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_phase IS DISTINCT FROM 'enforced' THEN
    IF p_capability = ANY (c_legacy) THEN
      RETURN jsonb_build_object('ok', true, 'allowed', true, 'source', 'legacy', 'reason', 'not_enforced');
    END IF;
    RETURN jsonb_build_object('ok', true, 'allowed', false, 'source', 'legacy', 'reason', 'legacy_not_included');
  END IF;
  SELECT e.account_mode INTO v_mode FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF v_mode IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'allowed', false, 'source', 'server', 'reason', 'account_not_provisioned');
  END IF;
  IF v_mode = 'free_10' AND p_capability IN ('catalog_product_image.upload', 'catalog_capacity.expand') THEN
    RETURN jsonb_build_object('ok', true, 'allowed', false, 'source', 'server', 'reason', 'free_not_eligible');
  END IF;
  IF p_capability = ANY (public.subscription_account_capabilities(p_user_id)) THEN
    RETURN jsonb_build_object('ok', true, 'allowed', true, 'source', 'server', 'reason', 'granted');
  END IF;
  RETURN jsonb_build_object('ok', true, 'allowed', false, 'source', 'server', 'reason', 'not_included');
END
$function$;
REVOKE ALL ON FUNCTION public.capability_check(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.capability_check(uuid, text) TO service_role;

-- ROLLBACK (forward-safe; DB owner): keep / return subscription_activation free_issue to 'prepared'
-- (SELECT public.set_activation_phase('free_issue', 'prepared', '<reason>')) -> summary answers not_activated, capability_check
-- answers legacy. Before any policy row exists the objects of this file may be dropped (functions first, then
-- subscription_capability_policy); they hold no ledger or payment data.
