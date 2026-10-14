-- ============================================================================================================================
-- 20261007150900_subscriptions_capability_defaults_reconciliation.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Subscriptions cross-cut, continuation (B): every enforced-phase capability default now has a recorded source; nothing is
-- granted or denied without one, and no EXISTING product feature is blocked only because the commercial matrix (OPEN-02) is
-- still open. Inert until the DB owner raises free_issue to 'enforced' (prepared / shadow keep the legacy behavior).
--
-- Enforced-phase defaults for a PROVISIONED account when no approved policy row exists (policy rows still add capabilities):
--   quote_style.classic            granted  - technical baseline = current server truth (every account renders Classic;
--                                             quote-presentation resolveTier). Not a commercial decision.
--   quote.edit_duplicate, quote.whatsapp_delete, professional_quote.use, professional_quote.reuse
--                                  granted  - NOT plan-gated in the new model: their only gate was the retired Basic/Pro model
--                                             (superseded by OD-01/OD-15/OD-16); no approved rule gates them. Blocking them at
--                                             cutover would remove existing product features without a source.
--   catalog_product_image.upload   paid: granted (existing behavior: available to every account today; eligible paid plans
--                                             stay OPEN-02 - a later approved rule may narrow it)
--                                  Free: DENIED - OD-18 (approved, locked). The only approved Free denial.
--   quote_style.modern / quote_style.visual / quote_media.upload
--                                  not granted - existing behavior outside TEST (no media, Classic only); OPEN-02.
--   quote_attachment.upload        not granted - OPEN-13; issued outputs with attachments already fail closed
--                                             (attachment_snapshot_policy_pending), so no attachment can reach a client.
--   catalog_capacity.expand        not granted - a purchase action; checkout is unavailable (OPEN-12). Whether Free may buy an
--                                             expansion is NOT decided (OD-04 defines the paid add-on; Free catalog = OPEN-03):
--                                             the previous Free-only CHECK on this capability had no explicit source and is
--                                             removed; no policy row exists, so nothing is granted either way.
--
-- Summary (account-summary/v1): catalog.countDefinition = 'unset' (OPEN-03). catalog.active is the raw number of services rows
-- and has NO commercial meaning until the item / variant / archive definition is decided; catalog_capacity stays 'prepared'
-- (set_activation_phase refuses 'enforced' for it). The paid limit 100 + 100 x blocks is the approved OD-04 figure.
--
-- Replaced objects: subscription_account_capabilities(uuid), account_summary_build(uuid, boolean), capability_check(uuid, text);
-- constraint subscription_capability_policy_free_never (now OD-18 only). Grants unchanged.
-- Rollback: CREATE OR REPLACE the three functions from 20261007150200 and re-add the previous constraint (both bodies are in
-- that file); safe at any time (no data written by this file).
-- ============================================================================================================================

ALTER TABLE public.subscription_capability_policy DROP CONSTRAINT IF EXISTS subscription_capability_policy_free_never;
ALTER TABLE public.subscription_capability_policy ADD CONSTRAINT subscription_capability_policy_free_never
  CHECK (NOT (account_mode = 'free_10' AND capability_id = 'catalog_product_image.upload'));

CREATE OR REPLACE FUNCTION public.subscription_account_capabilities(p_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ent  public.account_entitlements%ROWTYPE;
  v_caps text[] := ARRAY['quote_style.classic', 'quote.edit_duplicate', 'quote.whatsapp_delete',
                         'professional_quote.use', 'professional_quote.reuse'];
  v_sm   jsonb;
  v_ver  integer;
BEGIN
  IF p_user_id IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND THEN RETURN ARRAY[]::text[]; END IF;
  IF v_ent.account_mode = 'paid' THEN
    v_caps := v_caps || ARRAY['catalog_product_image.upload'];
  END IF;
  -- prepared style/media matrix through the prep resolver (empty policy -> no further styles, no media), as in 20261007150200
  v_sm := public.resolve_style_media_entitlement(v_ent.account_mode, v_ent.style_plan_id);
  v_caps := v_caps || coalesce((SELECT array_agg('quote_style.' || s) FROM jsonb_array_elements_text(v_sm -> 'allowedStyles') s
                                 WHERE s IN ('classic', 'modern', 'visual')), ARRAY[]::text[]);
  IF coalesce((v_sm ->> 'mediaAllowed')::boolean, false) THEN
    v_caps := v_caps || ARRAY['quote_media.upload'];
  END IF;
  -- generic approved policy (latest version for the mode / plan)
  SELECT max(p.policy_version) INTO v_ver FROM public.subscription_capability_policy p
   WHERE p.account_mode = v_ent.account_mode AND p.style_plan_id IS NOT DISTINCT FROM v_ent.style_plan_id;
  IF v_ver IS NOT NULL THEN
    v_caps := v_caps || coalesce((SELECT array_agg(p.capability_id) FROM public.subscription_capability_policy p
                                   WHERE p.account_mode = v_ent.account_mode
                                     AND p.style_plan_id IS NOT DISTINCT FROM v_ent.style_plan_id
                                     AND p.policy_version = v_ver), ARRAY[]::text[]);
  END IF;
  -- OD-18: Free never holds catalog product image upload, whatever any row says
  RETURN coalesce((SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(v_caps) c
                    WHERE NOT (v_ent.account_mode = 'free_10' AND c = 'catalog_product_image.upload')), ARRAY[]::text[]);
END
$function$;
REVOKE ALL ON FUNCTION public.subscription_account_capabilities(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.subscription_account_capabilities(uuid) TO service_role;

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
    'plan', jsonb_build_object('id', CASE WHEN v_ent.account_mode = 'free_10' THEN 'free' ELSE v_ent.style_plan_id END),
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
  -- prepared / shadow: no enforcement (shadow only observes); the legacy behavior of every account is kept
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
  IF v_mode = 'free_10' AND p_capability = 'catalog_product_image.upload' THEN
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
