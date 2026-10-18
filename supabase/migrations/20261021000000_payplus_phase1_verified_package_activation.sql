-- ============================================================================================================================
-- 20261021000000_payplus_phase1_verified_package_activation.sql
-- (stage 1 was written as 20261018200000; renamed 2026-10-20 so it orders after the last Production migration 20261020200000)
-- tekango-migration-contract: mode=transaction replay=required
--
-- PayPlus phase 1 (Owner console 2026-10-18, typed: "כן להתחיל לבנות את שלב 1"; task-control activeTask.payplusPhase1_20261018):
-- "record the payment, and open the subscription only after the callback was verified". INERT: billing_activation is 'off'
-- (record_verified_subscription_event answers billing_off before anything is written), the Edge billing phase constant is 'off', and
-- the subscription opens ONLY in the 'enforced' billing phase, which set_billing_phase still refuses (OPEN-12 - a later, separate,
-- Owner-approved step that must also define cancellation / refund / failed renewal, OPEN-09). 'prepared' records, never grants.
--
-- 1. record_verified_subscription_event_and_activate: the SAME verified-event recorder (20261007150100, unchanged), and - in the same
--    transaction - when that recorder APPLIED a payment_confirmed for an all-inclusive package attempt whose paid amount + currency
--    EQUAL the server attempt, the account entitlement becomes the paid package of the attempt's period (subscription_status 'active',
--    entitlement_version + 1). The append-only subscription_events row (verified, payload digest) is the audit of the transition.
--    Never converted (the payment is recorded, activated = false + a code): a legacy style-plan account, a LIFETIME account
--    (business_settings.is_lifetime), an account whose active package is of the other period. A duplicate / stale / rejected / failed /
--    refund event changes nothing. A wrong amount / currency or another active period marks THAT attempt failed and its subscription
--    row pending (the event row stays), so it never counts as a live subscription. On activation every other unpaid link of the
--    account expires: one live package per account.
-- 2. create_package_checkout_intent (body = 20261011100000 + one check): no payment page for an account that would pay for nothing -
--    a legacy paid style plan, LIFETIME, or an already active subscription -> already_subscribed.
-- 3. style_media_capability_policy: the package account (paid, no style plan) gets the whole product, like the free period and every
--    paid plan of policy v1 (20261018100000; PROFLOW_PROJECT_CONTEXT.md §249: ONE all-inclusive package). Without this row
--    resolve_style_media_entitlement('paid', NULL) falls back to the baseline {classic} without media.
--
-- Re-runnable: CREATE OR REPLACE, ON CONFLICT DO NOTHING. Rollback: DROP FUNCTION
-- public.record_verified_subscription_event_and_activate(text, text, text, uuid, timestamptz, text, integer, text); re-create
-- create_package_checkout_intent from 20261011100000 (the policy row is inert without a package account; none exists while billing is off).
-- ============================================================================================================================

-- 1. verified package payment -> entitlement activation ---------------------------------------------------------------------------
-- (an earlier local draft had six parameters; it must never survive next to the eight-parameter function)
DROP FUNCTION IF EXISTS public.record_verified_subscription_event_and_activate(text, text, text, uuid, timestamptz, text);
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
    INSERT INTO public.account_entitlements (user_id, account_mode, package_id, package_period, subscription_status)
    VALUES (v_attempt.user_id, 'paid', 'all_inclusive', v_price.billing_period, 'active')
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
    -- this active package already (the row just created above, or e.g. a renewal charge): nothing changes
  ELSE
    UPDATE public.account_entitlements
       SET account_mode = 'paid', style_plan_id = NULL, package_id = 'all_inclusive', package_period = v_price.billing_period,
           subscription_status = 'active', entitlement_version = entitlement_version + 1, updated_at = now()
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

-- 2. package checkout intent (body = 20261011100000 + the already_subscribed check) ------------------------------------------------
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
  -- PayPlus phase 1: never a payment page for an account that would pay for nothing
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false)
     OR EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = p_user_id AND e.account_mode = 'paid'
                 AND (e.style_plan_id IS NOT NULL OR e.subscription_status = 'active')) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_subscribed');
  END IF;
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

-- 3. the package gets the whole product (policy v1, like the free period and every paid plan) -----------------------------------------
INSERT INTO public.style_media_capability_policy (policy_version, account_mode, style_plan_id, allowed_styles, media_allowed, approval_ref)
VALUES (1, 'paid', NULL, ARRAY['classic', 'modern', 'visual'], true, 'owner-console-2026-10-18-payplus-phase1')
ON CONFLICT DO NOTHING;
