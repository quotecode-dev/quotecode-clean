-- ============================================================================================================================
-- 20261021400000_smart_pack_entitlement.sql  -  PayPlus stage 2: SMART PACK on the server - who has it, its prices, its line on the
--                                                package payment, and the quote-attachment gate (inert until free_issue is enforced)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner decisions (task-control payplusStage2_20261020 + decisions20261020c; IRON-LANDING-001 as amended 2026-10-20):
--   * SMART PACK = smart chat with the user's data, voice chat, the smart quote with dictation, quote file attachments (the business
--     LOGO is not part of it - open to every account). ILS 10 / month or 102 / year incl. VAT; USD 5 / 51; always the package cycle.
--   * who has it: a NEW account during its free 7 days (window started at its own provisioning); LIFETIME accounts; a paid package
--     account with the SMART PACK line (or until the end of the paid period after removing it); never in limited mode. An account that
--     existed on the activation day has it only when it adds it ("existing users at activation - smart features only with SMART PACK").
--   * it is a second line of the SAME payment (one standing order, one invoice with two lines): the package payment page carries it
--     when the box is ticked; the attempt stores its price row; the verified first payment sets the line.
--   1. account_entitlements.smart_pack_line / smart_pack_until; checkout_attempts.add_on_price_id.
--   2. price rows smart_pack (offer 'current', IL + INTERNATIONAL, month + year) - the catalog constraints are widened for them.
--      DEPLOY ORDER: the subscription-authority function that reads them (parseCatalog accepting smart_pack) BEFORE this migration;
--      an older function rejects the whole catalog (checkout_unavailable) - harmless only while billing is off.
--   3. smart_pack_active / smart_pack_state (summary 'smartPack' { active, source, until }).
--   4. quote_attachments: a new attachment needs SMART PACK once free_issue is enforced (existing attachments, removal and every
--      other account state are untouched; while not enforced nothing is checked - L-05).
--   5. create_package_checkout_intent gains p_smart_pack (DEFAULT false - every existing caller is unchanged).
--   Mid-period add / remove (monthly free until the renewal; yearly pro-rata) waits for PayPlus's answer on changing a standing order.
--   Re-runnable: ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS + ADD / ON CONFLICT DO NOTHING / CREATE OR REPLACE / DROP ... IF EXISTS.
--   ROLLBACK (DB owner): re-run the 20261021200000 bodies (recorder, intent with 3 arguments, summary) and the 20261007150900
--   capabilities; DROP TRIGGER quote_attachments_smart_pack_gate; the price rows may stay (no attempt can reference them then).
-- ============================================================================================================================

-- 1. columns ------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.account_entitlements ADD COLUMN IF NOT EXISTS smart_pack_line boolean NOT NULL DEFAULT false;
ALTER TABLE public.account_entitlements ADD COLUMN IF NOT EXISTS smart_pack_until timestamptz NULL;
ALTER TABLE public.checkout_attempts ADD COLUMN IF NOT EXISTS add_on_price_id text NULL REFERENCES public.price_versions (price_id);
-- a NEW account's free window includes SMART PACK: set only when the window starts at the account's own provisioning (never at the
-- activation day, never by a later update) and, like the window itself, never changed afterwards
ALTER TABLE public.account_entitlements ADD COLUMN IF NOT EXISTS free_window_smart_pack boolean NOT NULL DEFAULT false;

-- the window stamp (body 20261021100000 + the marked 20261021400000 changes)
CREATE OR REPLACE FUNCTION public.account_entitlements_free_window_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.free_window_starts_at IS NOT NULL
     AND NEW.free_window_starts_at IS DISTINCT FROM OLD.free_window_starts_at THEN
    RAISE EXCEPTION 'account_entitlements: a started free window never changes' USING ERRCODE = '42501';
  END IF;
  -- 20261021400000: the SMART PACK marker of the window never changes either (and is never set by hand)
  IF (TG_OP = 'UPDATE' AND NEW.free_window_smart_pack IS DISTINCT FROM OLD.free_window_smart_pack)
     OR (TG_OP = 'INSERT' AND NEW.free_window_smart_pack) THEN
    RAISE EXCEPTION 'account_entitlements: the free window SMART PACK marker is set only by the window start' USING ERRCODE = '42501';
  END IF;
  IF NEW.free_window_starts_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.free_window_starts_at IS NULL)
     AND NEW.free_window_starts_at <> now() THEN
    RAISE EXCEPTION 'account_entitlements: a free window starts only now' USING ERRCODE = '42501';
  END IF;
  IF NEW.free_window_starts_at IS NULL AND NEW.account_mode = 'free_10'
     AND EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    NEW.free_window_starts_at := now();
    -- 20261021400000: a NEW account (provisioned while enforced) has SMART PACK in its 7 days
    NEW.free_window_smart_pack := (TG_OP = 'INSERT');
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.account_entitlements_free_window_stamp() FROM PUBLIC, anon, authenticated, service_role;

-- 2. SMART PACK prices (Owner 2026-10-20) -----------------------------------------------------------------------------------
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_plan_id_check_v2;
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_plan_id_check_v3;
ALTER TABLE public.price_versions ADD CONSTRAINT price_versions_plan_id_check_v3
  CHECK (plan_id IN ('classic', 'modern', 'visual', 'catalog_block_100', 'all_inclusive', 'smart_pack'));
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_billing_period_check_v2;
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_billing_period_check_v3;
ALTER TABLE public.price_versions ADD CONSTRAINT price_versions_billing_period_check_v3
  CHECK (billing_period = 'month' OR (billing_period = 'year' AND plan_id IN ('all_inclusive', 'smart_pack')));
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_approved_ref_check_v2;
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_approved_ref_check_v3;
ALTER TABLE public.price_versions ADD CONSTRAINT price_versions_approved_ref_check_v3
  CHECK (approved_ref ~ '^OD-0[0-9](,OD-0[0-9])*$' OR approved_ref ~ '^S249(,AMEND-2026-10-11)?$' OR approved_ref = 'SMARTPACK-2026-10-20');
ALTER TABLE public.price_versions DROP CONSTRAINT IF EXISTS price_versions_offer_shape;
ALTER TABLE public.price_versions ADD CONSTRAINT price_versions_offer_shape
  CHECK ((plan_id IN ('all_inclusive', 'smart_pack')) = (offer = 'current'));
INSERT INTO public.price_versions (price_id, plan_id, market, currency, billing_period, amount_minor, tax_mode, approved_ref, valid_from, offer) VALUES
  ('il_smart_pack_month_p1',   'smart_pack', 'IL',            'ILS', 'month',  1000, 'included',    'SMARTPACK-2026-10-20', '2026-10-20 00:00:00+00', 'current'),
  ('il_smart_pack_year_p1',    'smart_pack', 'IL',            'ILS', 'year',  10200, 'included',    'SMARTPACK-2026-10-20', '2026-10-20 00:00:00+00', 'current'),
  ('intl_smart_pack_month_p1', 'smart_pack', 'INTERNATIONAL', 'USD', 'month',   500, 'not_decided', 'SMARTPACK-2026-10-20', '2026-10-20 00:00:00+00', 'current'),
  ('intl_smart_pack_year_p1',  'smart_pack', 'INTERNATIONAL', 'USD', 'year',   5100, 'not_decided', 'SMARTPACK-2026-10-20', '2026-10-20 00:00:00+00', 'current')
ON CONFLICT (price_id) DO NOTHING;

-- 3. who has SMART PACK ------------------------------------------------------------------------------------------------------------
--    source: 'lifetime' | 'free_window' (a NEW account in its 7 days: its window started at its own provisioning) | 'add_on'
CREATE OR REPLACE FUNCTION public.smart_pack_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ent public.account_entitlements%ROWTYPE;
  c_fmt constant text := 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    RETURN jsonb_build_object('active', false, 'source', NULL, 'until', NULL);
  END IF;
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false) THEN
    RETURN jsonb_build_object('active', true, 'source', 'lifetime', 'until', NULL);
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false, 'source', NULL, 'until', NULL);
  END IF;
  IF v_ent.account_mode = 'free_10' AND v_ent.free_window_starts_at IS NOT NULL AND v_ent.free_window_smart_pack
     AND now() < v_ent.free_window_starts_at + interval '168 hours' THEN
    RETURN jsonb_build_object('active', true, 'source', 'free_window',
                              'until', to_char((v_ent.free_window_starts_at + interval '168 hours') AT TIME ZONE 'UTC', c_fmt));
  END IF;
  IF v_ent.account_mode = 'paid' AND v_ent.package_id IS NOT NULL AND NOT public.paid_account_limited(p_user_id)
     AND (v_ent.smart_pack_line OR (v_ent.smart_pack_until IS NOT NULL AND now() < v_ent.smart_pack_until)) THEN
    RETURN jsonb_build_object('active', true, 'source', 'add_on',
                              'until', CASE WHEN v_ent.smart_pack_line THEN NULL ELSE to_char(v_ent.smart_pack_until AT TIME ZONE 'UTC', c_fmt) END);
  END IF;
  RETURN jsonb_build_object('active', false, 'source', NULL, 'until', NULL);
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_state(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.smart_pack_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT coalesce((public.smart_pack_state(p_user_id) ->> 'active')::boolean, false)
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_active(uuid) FROM PUBLIC, anon, authenticated;
-- the Edge Functions (voice-ai, ai-quote-draft, chat-ai) ask the server with the service role
GRANT EXECUTE ON FUNCTION public.smart_pack_active(uuid) TO service_role;

-- 4. quote attachments are SMART PACK once free_issue is enforced (a new attachment only; never existing rows or removal) ----------
CREATE OR REPLACE FUNCTION public.quote_attachments_smart_pack_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    RETURN NEW;
  END IF;
  SELECT q.user_id INTO v_user FROM public.quotes q WHERE q.id = NEW.quote_id;
  IF v_user IS NOT NULL AND NOT public.smart_pack_active(v_user) THEN
    RAISE EXCEPTION 'smart_pack_required: quote file attachments are part of SMART PACK' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_attachments_smart_pack_gate() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quote_attachments_smart_pack_gate ON public.quote_attachments;
CREATE TRIGGER quote_attachments_smart_pack_gate BEFORE INSERT ON public.quote_attachments
  FOR EACH ROW EXECUTE FUNCTION public.quote_attachments_smart_pack_gate();

-- 5. the package payment page with the optional SMART PACK line (body 20261021200000 + the marked changes) ----------------------
DROP FUNCTION IF EXISTS public.create_package_checkout_intent(uuid, text, text);
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

-- 7. account capabilities (body 20261007150900 + the marked change)
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
  -- 20261021400000 (Owner 2026-10-20): quote file attachments are part of SMART PACK
  IF public.smart_pack_active(p_user_id) THEN
    v_caps := v_caps || ARRAY['quote_attachment.upload'];
  END IF;
  -- OD-18: Free never holds catalog product image upload, whatever any row says
  RETURN coalesce((SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(v_caps) c
                    WHERE NOT (v_ent.account_mode = 'free_10' AND c = 'catalog_product_image.upload')), ARRAY[]::text[]);
END
$function$;
REVOKE ALL ON FUNCTION public.subscription_account_capabilities(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.subscription_account_capabilities(uuid) TO service_role;

-- 8. the verified-payment recorder (body 20261021200000 + the marked 20261021400000 changes)
CREATE OR REPLACE FUNCTION public.record_verified_subscription_event_and_activate(p_provider text, p_provider_event_id text,
  p_event_type text, p_attempt_id uuid, p_provider_event_time timestamptz, p_payload_sha256 text,
  p_paid_amount_minor integer DEFAULT NULL, p_paid_currency text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_r jsonb; v_phase text; v_attempt public.checkout_attempts; v_price public.price_versions; v_ent public.account_entitlements;
  v_user uuid; v_first boolean;
BEGIN
  -- one account at a time (two links of one user paid at once never deadlock: attempt -> entitlement -> other attempts)
  SELECT c.user_id, c.state = 'pending' INTO v_user, v_first FROM public.checkout_attempts c WHERE c.attempt_id = p_attempt_id;
  IF v_user IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
    SELECT c.state = 'pending' INTO v_first FROM public.checkout_attempts c WHERE c.attempt_id = p_attempt_id; -- after the lock
  END IF;
  v_r := public.record_verified_subscription_event(p_provider, p_provider_event_id, p_event_type, p_attempt_id,
                                                   p_provider_event_time, p_payload_sha256);
  -- 20261021200000: a verified FAILED charge of the live package (PayPlus retries it daily) starts the 3 grace days once
  IF (v_r ->> 'ok') = 'true' AND (v_r ->> 'duplicate') IS DISTINCT FROM 'true' AND p_event_type = 'payment_failed' THEN
    RETURN v_r || public.billing_record_failed_charge(p_attempt_id, p_provider_event_time);
  END IF;
  IF (v_r ->> 'ok') IS DISTINCT FROM 'true' OR (v_r ->> 'duplicate') = 'true' OR p_event_type IS DISTINCT FROM 'payment_confirmed'
     OR (v_r ->> 'outcome') IS DISTINCT FROM 'applied' THEN
    RETURN v_r;
  END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'billing_not_enforced');
  END IF;
  SELECT * INTO v_attempt FROM public.checkout_attempts WHERE attempt_id = p_attempt_id;
  SELECT * INTO v_price FROM public.price_versions WHERE price_id = v_attempt.plan_price_id;
  IF v_price.plan_id IS DISTINCT FROM 'all_inclusive' OR v_price.billing_period NOT IN ('month', 'year') THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'not_a_package_attempt');
  END IF;
  IF p_paid_amount_minor IS DISTINCT FROM v_attempt.amount_minor OR p_paid_currency IS DISTINCT FROM v_attempt.currency THEN
    -- the event stays recorded (append-only). A FIRST payment of a wrong amount never counts as a live subscription
    -- (account_billing_period reads it); a wrong-amount renewal of a live subscription changes nothing.
    IF v_first THEN
      UPDATE public.checkout_attempts SET state = 'failed' WHERE attempt_id = p_attempt_id;
      UPDATE public.subscriptions SET status = 'pending', updated_at = now() WHERE attempt_id = p_attempt_id;
    END IF;
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'amount_mismatch');
  END IF;
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = v_attempt.user_id), false) THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'legacy_paid_account');
  END IF;
  -- read first: the counter guard trigger fires BEFORE INSERT even when ON CONFLICT would skip the row
  SELECT * INTO v_ent FROM public.account_entitlements WHERE user_id = v_attempt.user_id FOR UPDATE;
  IF NOT FOUND THEN
    -- 20261021400000: the SMART PACK line of the first payment rides on the package charge of the same attempt
    INSERT INTO public.account_entitlements (user_id, account_mode, package_id, package_period, subscription_status, smart_pack_line)
    VALUES (v_attempt.user_id, 'paid', 'all_inclusive', v_price.billing_period, 'active', v_attempt.add_on_price_id IS NOT NULL)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING * INTO v_ent;
    IF v_ent.user_id IS NULL THEN
      SELECT * INTO v_ent FROM public.account_entitlements WHERE user_id = v_attempt.user_id FOR UPDATE; -- created concurrently
    END IF;
  END IF;
  IF v_ent.account_mode = 'paid' AND v_ent.style_plan_id IS NOT NULL THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'legacy_paid_account');
  END IF;
  IF v_ent.account_mode = 'paid' AND v_ent.package_id = 'all_inclusive' AND v_ent.subscription_status = 'active' THEN
    IF v_ent.package_period IS DISTINCT FROM v_price.billing_period THEN
      IF v_first THEN
        UPDATE public.checkout_attempts SET state = 'failed' WHERE attempt_id = p_attempt_id;
        UPDATE public.subscriptions SET status = 'pending', updated_at = now() WHERE attempt_id = p_attempt_id;
      END IF;
      RETURN v_r || jsonb_build_object('activated', false, 'code', 'another_package_active');
    END IF;
    -- this active package already (the row just created above, or a renewal charge): the package stays; 20261021200000: the paid
    -- period runs one more period from its end (never shortened; a late charge runs from the charge)
    UPDATE public.account_entitlements
       SET paid_through = public.billing_period_end(greatest(coalesce(paid_through, p_provider_event_time), p_provider_event_time), v_price.billing_period),
           payment_failed_at = NULL, updated_at = now()
     WHERE user_id = v_attempt.user_id
    RETURNING * INTO v_ent;
  ELSE
    UPDATE public.account_entitlements
       SET account_mode = 'paid', style_plan_id = NULL, package_id = 'all_inclusive', package_period = v_price.billing_period,
           subscription_status = 'active', entitlement_version = entitlement_version + 1, updated_at = now(),
           -- 20261021200000: the paid period (a payment inside the grace days ends them)
           paid_through = public.billing_period_end(greatest(coalesce(paid_through, p_provider_event_time), p_provider_event_time), v_price.billing_period),
           payment_failed_at = NULL,
           -- 20261021400000: the first payment sets the SMART PACK line from its attempt; a payment that ends the grace days keeps it
           smart_pack_line = CASE WHEN subscription_status = 'past_due' THEN smart_pack_line ELSE (v_attempt.add_on_price_id IS NOT NULL) END
     WHERE user_id = v_attempt.user_id
    RETURNING * INTO v_ent;
  END IF;
  -- one live package per account: every other still-unpaid payment link of this account expires (a later payment of one is
  -- 'rejected' by the recorder - visible, never a silent second subscription)
  UPDATE public.checkout_attempts SET state = 'expired'
   WHERE user_id = v_attempt.user_id AND state = 'pending' AND attempt_id <> p_attempt_id;
  RETURN v_r || jsonb_build_object('activated', true, 'packagePeriod', v_ent.package_period, 'entitlementVersion', v_ent.entitlement_version);
END $$;
REVOKE ALL ON FUNCTION public.record_verified_subscription_event_and_activate(text, text, text, uuid, timestamptz, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_subscription_event_and_activate(text, text, text, uuid, timestamptz, text, integer, text) TO service_role;

-- 9. account summary (body 20261021200000 + the marked change)
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
    'billingPeriod', public.account_billing_period(p_user_id),
    'capabilities', to_jsonb(public.subscription_account_capabilities(p_user_id)),
    'eligiblePlans', '{}'::jsonb,
    'free10', CASE WHEN v_ent.account_mode = 'free_10' THEN jsonb_build_object(
                'limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed, 'reserved', v_reserved,
                'remaining', greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0),
                -- 20261021100000: the 7-day window (NULL until the account's window starts; never for unlimited accounts)
                'endsAt', public.free10_ends_at_text(p_user_id),
                'periodEnded', public.free10_period_ended(p_user_id)) END,
    'catalog', jsonb_build_object(
                'active', v_active,
                'countDefinition', 'unset',
                'limit', CASE WHEN v_ent.account_mode = 'paid' THEN 100 + 100 * v_ent.catalog_expansion_blocks END,
                'blocks', v_ent.catalog_expansion_blocks,
                'limitDecided', v_ent.account_mode = 'paid'),
    'priceCatalogVersion', v_pcv,
    -- 20261021200000: the paid period, the grace days after a failed charge and limited mode
    'billing', public.account_billing_state(p_user_id),
    -- 20261021400000: SMART PACK (included in the free 7 days of a new account, LIFETIME, or the paid add-on line)
    'smartPack', public.smart_pack_state(p_user_id));
  RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
END
$function$;
REVOKE ALL ON FUNCTION public.account_summary_build(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
