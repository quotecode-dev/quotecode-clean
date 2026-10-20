-- ============================================================================================================================
-- 20261021200000_billing_period_grace_limited.sql  -  PayPlus stage 2: the paid period, renewals, a failed charge, the 3 grace days
--                                                      and limited mode (Owner decision 2026-10-18, task-control failedRenewalPolicy20261018)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner 2026-10-18 ("3 ימים זה די והותר"), recorded in task-control activeTask.failedRenewalPolicy20261018 and approved for build in
--   payplusStage2_20261020: a failed renewal charge gives 3 grace days with full use; a successful charge inside the grace days returns
--   the account to normal; after the grace days without payment the account is LIMITED like the end of the Free plan (log in, view,
--   download, print, pay; no NEW quote and no NEW output version; links already sent keep working; nothing deleted). The same 3 days
--   follow the end of a paid period that was not renewed (no charge arrived, e.g. a stopped standing order).
--   1. account_entitlements.paid_through (end of the paid period) + payment_failed_at (the first failed charge of this episode).
--   2. a renewal charge of the active package runs the paid period one more period from its end (never shorter; a late charge runs
--      from the charge); the first payment starts it; a payment while past_due ends the grace days.
--   3. a verified failed charge of the live package -> past_due, its first failure time kept (PayPlus retries daily; the grace days
--      never restart within one episode). Older than the last successful charge = stale, nothing changes.
--   4. no second payment page while past_due inside the grace days (the live standing order is retried) -> payment_update_required;
--      a LIMITED account may open a new payment page (a payment ends limited mode).
--   5. limited mode refuses a new quote and a new output version (the closed contract's code free_issue_limit_reached, reason
--      subscription_limited); the summary carries billing { paidThrough, graceEndsAt, inGrace, limited }.
--   INERT: billing_activation is 'off' (no event is recorded) and set_billing_phase still refuses 'enforced'; every grace / limited
--   rule reads billing 'enforced'. Legacy paid style plans and LIFETIME accounts have no paid period and are never limited.
--   Function bodies 6-11 are the current bodies with only the marked changes (generated with checked replacements).
--   Re-runnable: ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE.
--   ROLLBACK (DB owner): billing stays 'off'; re-run the 20261021000000 bodies of record_verified_subscription_event_and_activate /
--   create_package_checkout_intent and the 20261021100000 bodies of enforce_free10_quote_creation / prepare / finalize /
--   account_summary_build (the two columns may stay; nothing reads them then).
-- ============================================================================================================================

-- 1. the paid period and the failed-charge episode
ALTER TABLE public.account_entitlements ADD COLUMN IF NOT EXISTS paid_through timestamptz NULL;
ALTER TABLE public.account_entitlements ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz NULL;

-- 2. one period after a moment (calendar month / year on the Israel calendar - PayPlus charges by the Israel day of the month)
CREATE OR REPLACE FUNCTION public.billing_period_end(p_from timestamptz, p_period text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $function$
  SELECT ((p_from AT TIME ZONE 'Asia/Jerusalem') + CASE p_period WHEN 'year' THEN interval '1 year' WHEN 'month' THEN interval '1 month' END) AT TIME ZONE 'Asia/Jerusalem'
$function$;
REVOKE ALL ON FUNCTION public.billing_period_end(timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;

-- 3. the end of the 3 grace days of a paid package account (NULL = not in a grace episode). A failed charge: 72 hours after the
--    LATER of the first failure and the end of the paid period (a failure never shortens a period already paid). A paid period that
--    was not renewed: one day of tolerance for the provider's charge time, then 72 hours. The earlier of the two episodes counts.
--    Legacy style plans / LIFETIME: never.
CREATE OR REPLACE FUNCTION public.paid_grace_ends_at(p_user_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT least(CASE WHEN e.subscription_status = 'past_due'
                    THEN greatest(e.payment_failed_at, coalesce(e.paid_through, e.payment_failed_at)) + interval '72 hours' END,
               CASE WHEN e.paid_through IS NOT NULL AND now() >= e.paid_through + interval '24 hours'
                    THEN e.paid_through + interval '96 hours' END)
    FROM public.account_entitlements e
   WHERE e.user_id = p_user_id AND e.account_mode = 'paid' AND e.package_id IS NOT NULL AND e.style_plan_id IS NULL
     AND NOT coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false)
$function$;
REVOKE ALL ON FUNCTION public.paid_grace_ends_at(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.paid_account_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.billing_activation b WHERE b.id AND b.phase = 'enforced')
     AND coalesce(now() >= public.paid_grace_ends_at(p_user_id), false)
$function$;
REVOKE ALL ON FUNCTION public.paid_account_limited(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_billing_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_enf   boolean := EXISTS (SELECT 1 FROM public.billing_activation b WHERE b.id AND b.phase = 'enforced');
  v_paid  timestamptz;
  v_grace timestamptz;
  c_fmt   constant text := 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';
BEGIN
  SELECT e.paid_through INTO v_paid FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  v_grace := CASE WHEN v_enf THEN public.paid_grace_ends_at(p_user_id) END;
  RETURN jsonb_build_object(
    'paidThrough', to_char(v_paid AT TIME ZONE 'UTC', c_fmt),
    'graceEndsAt', to_char(v_grace AT TIME ZONE 'UTC', c_fmt),
    'inGrace', v_grace IS NOT NULL AND now() < v_grace,
    'limited', v_grace IS NOT NULL AND now() >= v_grace);
END
$function$;
REVOKE ALL ON FUNCTION public.account_billing_state(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 4. a verified failed charge of the live package (called by the recorder after it stored the event; holds the account lock)
CREATE OR REPLACE FUNCTION public.billing_record_failed_charge(p_attempt_id uuid, p_event_time timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_sub public.subscriptions;
  v_ent public.account_entitlements;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.billing_activation b WHERE b.id AND b.phase = 'enforced') THEN
    RETURN jsonb_build_object('graceStarted', false, 'code', 'billing_not_enforced');
  END IF;
  SELECT * INTO v_sub FROM public.subscriptions s WHERE s.attempt_id = p_attempt_id FOR UPDATE;
  IF v_sub.attempt_id IS NULL OR v_sub.status NOT IN ('active', 'past_due') THEN
    RETURN jsonb_build_object('graceStarted', false, 'code', 'no_live_subscription');
  END IF;
  IF p_event_time IS NULL OR p_event_time <= v_sub.last_event_time THEN
    RETURN jsonb_build_object('graceStarted', false, 'code', 'stale_failure');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = v_sub.user_id FOR UPDATE;
  -- only a charge of the live package itself (the package of the account's period) - never another plan / period attempt
  IF NOT EXISTS (SELECT 1 FROM public.checkout_attempts c JOIN public.price_versions p ON p.price_id = c.plan_price_id
                  WHERE c.attempt_id = p_attempt_id AND p.plan_id = 'all_inclusive' AND p.billing_period = v_ent.package_period) THEN
    RETURN jsonb_build_object('graceStarted', false, 'code', 'not_the_live_package');
  END IF;
  IF v_ent.user_id IS NULL OR v_ent.account_mode <> 'paid' OR v_ent.package_id IS NULL OR v_ent.style_plan_id IS NOT NULL
     OR v_ent.subscription_status NOT IN ('active', 'past_due')
     OR coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = v_sub.user_id), false) THEN
    RETURN jsonb_build_object('graceStarted', false, 'code', 'not_a_live_package');
  END IF;
  UPDATE public.account_entitlements
     -- a provider time in the future never postpones the grace days
     SET subscription_status = 'past_due', payment_failed_at = coalesce(payment_failed_at, least(p_event_time, now())),
         entitlement_version = entitlement_version + CASE WHEN subscription_status = 'past_due' THEN 0 ELSE 1 END, updated_at = now()
   WHERE user_id = v_sub.user_id
  RETURNING * INTO v_ent;
  UPDATE public.subscriptions SET status = 'past_due', updated_at = now() WHERE attempt_id = p_attempt_id;
  RETURN jsonb_build_object('graceStarted', true, 'paymentFailedAt', v_ent.payment_failed_at,
                            'graceEndsAt', public.paid_grace_ends_at(v_sub.user_id));
END
$function$;
REVOKE ALL ON FUNCTION public.billing_record_failed_charge(uuid, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

-- 6. the verified-payment recorder (body 20261021000000 + the marked 20261021200000 changes)
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
           payment_failed_at = NULL
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

-- 7. package checkout intent (body 20261021000000 + the marked change)
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

-- 8. new-quote guard (body 20261021100000 + the marked change)
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
  -- 20261021200000: a paid account in limited mode (the 3 grace days after a failed charge are over) creates no new quote
  IF public.paid_account_limited(NEW.user_id) THEN
    RAISE EXCEPTION 'subscription_limited: the last payment did not go through; a new quote needs the payment' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = NEW.user_id;
  IF NOT FOUND OR v_ent.account_mode <> 'free_10' OR public.quote_output_unlimited(NEW.user_id, v_ent.account_mode) THEN
    RETURN NEW; -- paid (current or legacy) is never blocked here; unprovisioned keeps the existing output enforcement
  END IF;
  -- 20261021100000: the 7 free days ended -> a new quote needs the subscription
  IF public.free10_period_ended(NEW.user_id) THEN
    RAISE EXCEPTION 'free_period_ended: the 7 free days have ended; a new quote needs the subscription' USING ERRCODE = 'P0001';
  END IF;
  IF v_ent.free_issues_consumed + public.quote_output_live_reservations(NEW.user_id, NULL) >= v_ent.free_issue_limit THEN
    RAISE EXCEPTION 'free_issue_limit_reached: all % free quotes are used; a new quote needs the subscription', v_ent.free_issue_limit
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.enforce_free10_quote_creation() FROM PUBLIC, anon, authenticated, service_role;

-- 9. prepare (body 20261021100000 + the marked change)
CREATE OR REPLACE FUNCTION public.prepare_quote_output(p_user_id uuid, p_quote_id uuid, p_channel text, p_idempotency_key text,
                                            p_expected_digest text, p_style text, p_media_count integer,
                                            p_style_version integer, p_presentation_digest text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  c_ttl      constant interval := interval '10 minutes';
  v_phase    text;
  v_ent      public.account_entitlements%ROWTYPE;
  v_q        record;
  v_by_key   public.quote_output_attempts%ROWTYPE;
  v_live     public.quote_output_attempts%ROWTYPE;
  v_final    public.quote_issue_ledger%ROWTYPE;
  v_binding  text;
  v_doc      jsonb;
  v_digest   text;
  v_issuer   jsonb;
  v_cap      jsonb;
  v_reserved integer;
  v_has_final boolean;
  v_uncounted boolean;
  v_attempt  uuid := gen_random_uuid();
  v_expires  timestamptz := now() + c_ttl;
BEGIN
  IF p_user_id IS NULL OR p_quote_id IS NULL
     OR p_channel IS NULL OR p_channel NOT IN ('send', 'public_share', 'final_pdf', 'final_print')
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 200
     OR p_expected_digest IS NULL OR p_expected_digest !~ '^[0-9a-f]{64}$'
     OR p_style IS NULL OR p_style NOT IN ('classic', 'modern', 'visual')
     OR p_media_count IS NULL OR p_media_count < 0
     OR p_style_version IS NULL OR p_style_version < 1
     OR p_presentation_digest IS NULL OR p_presentation_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'prepare_quote_output: invalid arguments' USING ERRCODE = '22023';
  END IF;

  -- (1) activation gate (lock order 1)
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  IF v_phase IS NULL OR v_phase = 'prepared' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_activated');
  END IF;

  -- (2) account (lock order 2) - unprovisioned accounts never pass, in shadow or enforced
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
  END IF;

  -- (3) quote (lock order 3); a foreign quote answers exactly like a missing one
  SELECT q.id, q.status, q.signature, q.client_id INTO v_q
    FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = p_user_id FOR UPDATE;

  -- (4) attempts / ledger (lock order 4): expire own stale reservations, then idempotency and finals
  UPDATE public.quote_output_attempts a SET state = 'expired', aborted_at = now(), failure_code = 'reservation_ttl'
   WHERE a.user_id = p_user_id AND a.state = 'preparing' AND a.expires_at <= now();

  SELECT * INTO v_by_key FROM public.quote_output_attempts a WHERE a.user_id = p_user_id AND a.idempotency_key = p_idempotency_key;
  IF FOUND AND (v_by_key.quote_id <> p_quote_id OR v_by_key.requested_channel <> p_channel) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'idempotency_key_reused');
  END IF;

  IF v_q.id IS NULL THEN
    -- deleted after an output: metadata of its latest output only; no new consumption, no regenerated document, no refund
    SELECT * INTO v_final FROM public.quote_issue_ledger l
     WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id ORDER BY l.created_at DESC, l.id DESC LIMIT 1;
    IF FOUND THEN
      RETURN public.quote_output_final_response(v_final) || jsonb_build_object('ok', false, 'code', 'document_unavailable',
                                                                                'reason', 'quote_deleted');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'quote_not_found');
  END IF;

  -- Task 30 (Owner 2026-10-11): the counted unit is the quote VERSION for its CUSTOMER = (customer binding, content digest).
  -- The content digest (quote-document/v1) covers the customer block (name / email / phone / address), the recipient
  -- (attn_name / attn_role), header, sections, items and totals. The caller must have seen exactly the current version.
  v_binding := coalesce(v_q.client_id::text, 'none');
  v_doc := public.quote_output_deal_document(p_user_id, p_quote_id);
  v_digest := public.quote_output_digest(v_doc);
  IF v_digest <> p_expected_digest THEN
    RETURN jsonb_build_object('ok', false, 'code', 'quote_changed', 'contentDigest', v_digest);
  END IF;
  -- the same version for the same customer was already output (any channel): its durable final result, never a second count
  SELECT * INTO v_final FROM public.quote_issue_ledger l
   WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id AND l.customer_binding = v_binding AND l.content_digest = v_digest;
  IF FOUND THEN
    RETURN public.quote_output_final_response(v_final) || jsonb_build_object('alreadyFinalized', true);
  END IF;
  -- one idempotency key = one (quote, channel, version): a key reused for another version / customer is refused
  IF v_by_key.attempt_id IS NOT NULL AND (v_by_key.content_digest <> v_digest OR v_by_key.customer_binding <> v_binding) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'idempotency_key_reused');
  END IF;

  IF v_by_key.attempt_id IS NOT NULL THEN
    IF v_by_key.state = 'preparing' THEN
      RETURN public.quote_output_preparing_response(v_by_key, true, NULL);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_' || v_by_key.state, 'failureCode', v_by_key.failure_code,
                              'attemptId', v_by_key.attempt_id);
  END IF;

  -- a live reservation of the same quote under another key: the racer gets that same attempt, never a second reservation
  SELECT * INTO v_live FROM public.quote_output_attempts a
   WHERE a.user_id = p_user_id AND a.quote_id = p_quote_id AND a.state = 'preparing';
  IF FOUND THEN
    IF v_live.customer_binding = v_binding AND v_live.content_digest = v_digest THEN
      RETURN public.quote_output_preparing_response(v_live, true, jsonb_build_object('sameQuoteLiveAttempt', true));
    END IF;
    -- another version of this quote is being output right now: never a parallel second reservation (retry shortly)
    RETURN jsonb_build_object('ok', false, 'code', 'output_in_progress');
  END IF;

  -- (5) quote state. A new VERSION may be output while the quote is Draft, or Sent through this authority (it already has an
  --     output). Signed / approved / other states, and Sent without any output of this authority (legacy), never.
  v_has_final := EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id);
  -- Owner 2026-10-18 ("להתחיל לספור מעכשיו"): a quote already Sent before activation (no output of this authority) may be output
  -- again; it is a pre-activation quote and never counts. Signed / approved / other states stay closed.
  IF coalesce(v_q.signature, '') <> '' OR lower(coalesce(v_q.status, '')) NOT IN ('draft', 'sent') THEN
    RETURN jsonb_build_object('ok', false, 'code', CASE WHEN v_has_final THEN 'quote_closed' ELSE 'legacy_issue_policy_pending' END);
  END IF;
  IF v_q.client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'customer_binding_missing');
  END IF;

  -- (6) content version: bound above (v_digest = p_expected_digest)
  -- Owner 2026-10-18: attachments are allowed (the attachment count stays part of the content digest)
  -- issuer block of the document (issuer/v1 projection) is bound too
  v_issuer := public.quote_output_issuer(p_user_id);
  IF v_issuer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'issuer_missing');
  END IF;
  -- logo (CODEX_PREP_CLOSURE_REVIEW.md section 10.1): business_settings.logo_url is a plain, mutable external URL - the same
  -- URL can serve other bytes after issue, so a logo cannot be part of an immutable issued snapshot yet. Fail closed BEFORE
  -- any reservation / snapshot / ledger / consumption. No fetch, no logo storage, no retention decision; an issuer without a
  -- logo (NULL, empty or whitespace-only) continues normally. Future logo support needs a separate immutable logo artifact.
  IF nullif(btrim(coalesce(v_issuer ->> 'logo_url', '')), '') IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'logo_snapshot_policy_pending');
  END IF;

  -- (7) style / media entitlement from server state
  v_cap := public.resolve_style_media_entitlement(v_ent.account_mode, v_ent.style_plan_id);
  IF NOT (v_cap -> 'allowedStyles') ? p_style THEN
    RETURN jsonb_build_object('ok', false, 'code', 'style_not_entitled', 'allowedStyles', v_cap -> 'allowedStyles');
  END IF;
  IF p_media_count > 0 AND NOT (v_cap ->> 'mediaAllowed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'code', 'media_not_entitled');
  END IF;

  -- (8) commercial gate: paid quota policy NOT decided -> fail closed; free = final + live reservations < limit
  -- Owner 2026-10-18: paid / LIFETIME are unlimited and a pre-activation Sent quote never counts - recorded, never counted
  v_uncounted := public.quote_output_unlimited(p_user_id, v_ent.account_mode)
                 OR (lower(coalesce(v_q.status, '')) = 'sent' AND NOT v_has_final)
                 -- 20261021100000: the first output of a (quote, customer) already counted at its save never counts again
                 OR public.free10_output_covered_by_save(p_user_id, p_quote_id, v_binding);
  -- 20261021200000: a paid account in limited mode outputs no new version (already-output versions answered above stay available).
  -- The closed contract's code; the reason tells which end it was.
  IF public.paid_account_limited(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached', 'reason', 'subscription_limited');
  END IF;
  -- 20261021100000: the 7 free days ended -> a counted output is refused (an uncounted one stays allowed). The code stays the closed
  -- contract's free_issue_limit_reached (subscription-authority passes no other); reason + freeIssues tell which end it was.
  IF NOT v_uncounted AND public.free10_period_ended(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached', 'reason', 'free_period_ended',
      'freeIssues', jsonb_build_object('limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed,
                                       'reserved', public.quote_output_live_reservations(p_user_id, NULL), 'remaining', 0,
                                       'periodEnded', true, 'endsAt', public.free10_ends_at_text(p_user_id)));
  END IF;
  v_reserved := public.quote_output_live_reservations(p_user_id, NULL);
  IF NOT v_uncounted AND v_ent.free_issues_consumed + v_reserved >= v_ent.free_issue_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached',
      'freeIssues', jsonb_build_object('limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed,
                                       'reserved', v_reserved, 'remaining', 0));
  END IF;

  -- (9) reservation (no final consumption)
  INSERT INTO public.quote_output_attempts
    (attempt_id, user_id, quote_id, customer_binding, state, requested_channel, idempotency_key, content_digest, style_id,
     media_count, style_version, issuer_digest, presentation_digest, snapshot_path, expires_at, account_mode_at_event,
     entitlement_version)
  VALUES
    (v_attempt, p_user_id, p_quote_id, v_binding, 'preparing', p_channel, p_idempotency_key, v_digest, p_style, p_media_count,
     p_style_version, public.quote_output_digest(v_issuer), p_presentation_digest,
     format('issued-documents/%s/%s/%s.json', p_user_id, p_quote_id, v_attempt), v_expires, v_ent.account_mode,
     v_ent.entitlement_version)
  RETURNING * INTO v_live;

  RETURN public.quote_output_preparing_response(v_live, false, jsonb_build_object(
    'freeIssues', jsonb_build_object('limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed,
                                     'reserved', v_reserved + 1,
                                     'remaining', v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved - 1)));
END
$function$;
REVOKE ALL ON FUNCTION public.prepare_quote_output(uuid, uuid, text, text, text, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_quote_output(uuid, uuid, text, text, text, text, integer, integer, text) TO service_role;

-- 10. finalize (body 20261021100000 + the marked change)
CREATE OR REPLACE FUNCTION public.finalize_quote_output(p_user_id uuid, p_attempt_id uuid, p_snapshot_path text, p_sha256 text,
                                             p_bytes bigint, p_schema_version integer, p_presentation_digest text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phase    text;
  v_quote_id uuid;
  v_ent      public.account_entitlements%ROWTYPE;
  v_q        record;
  v_a        public.quote_output_attempts%ROWTYPE;
  v_ledger   public.quote_issue_ledger%ROWTYPE;
  v_obj_size text;
  v_cap      jsonb;
  v_reserved integer;
  v_counted  boolean;
BEGIN
  IF p_user_id IS NULL OR p_attempt_id IS NULL OR p_snapshot_path IS NULL
     OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' OR p_bytes IS NULL OR p_bytes <= 0 OR p_schema_version IS NULL
     OR p_presentation_digest IS NULL OR p_presentation_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'finalize_quote_output: invalid arguments' USING ERRCODE = '22023';
  END IF;

  -- (1) activation gate: a phase rolled back to 'prepared' stops every finalization
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  IF v_phase IS NULL OR v_phase = 'prepared' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_activated');
  END IF;

  -- unlocked lookup only to learn which quote to lock (the row is re-read under lock below)
  SELECT a.quote_id INTO v_quote_id FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id AND a.user_id = p_user_id;
  IF v_quote_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_not_found');
  END IF;

  -- (2) account, (3) quote, (4) attempt - fixed lock order
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
  END IF;
  SELECT q.id, q.status, q.signature, q.client_id INTO v_q
    FROM public.quotes q WHERE q.id = v_quote_id AND q.user_id = p_user_id FOR UPDATE;
  SELECT * INTO v_a FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id FOR UPDATE;

  IF v_a.state = 'finalized' THEN
    SELECT * INTO v_ledger FROM public.quote_issue_ledger l WHERE l.attempt_id = p_attempt_id;
    IF v_a.snapshot_sha256 <> p_sha256 OR v_a.snapshot_bytes <> p_bytes THEN
      RETURN jsonb_build_object('ok', false, 'code', 'snapshot_mismatch');  -- a finalized attempt is never re-bound
    END IF;
    RETURN public.quote_output_final_response(v_ledger);  -- retry after a lost response: the same durable answer
  END IF;
  IF v_a.state IN ('aborted', 'expired') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_' || v_a.state, 'failureCode', v_a.failure_code);
  END IF;
  IF v_a.expires_at <= now() THEN
    UPDATE public.quote_output_attempts SET state = 'expired', aborted_at = now(), failure_code = 'reservation_ttl'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_expired', 'failureCode', 'reservation_ttl');
  END IF;

  -- (5) snapshot binding: server-derived path, supported schema, object present in the private bucket with the same size.
  --     Mismatches leave the attempt PREPARING (recoverable until its TTL) and consume nothing.
  IF p_snapshot_path <> v_a.snapshot_path THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_mismatch', 'field', 'path');
  END IF;
  IF p_schema_version <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_mismatch', 'field', 'schemaVersion');
  END IF;
  SELECT o.metadata ->> 'size' INTO v_obj_size FROM storage.objects o
   WHERE o.bucket_id = 'quote-files' AND o.name = v_a.snapshot_path;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_missing');
  END IF;
  -- the platform's recorded size is mandatory (fail closed when absent); the hash itself is verified by the trusted
  -- orchestrator from the read-back bytes and RECORDED here
  IF v_obj_size IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_metadata_missing');
  END IF;
  IF v_obj_size <> p_bytes::text THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_mismatch', 'field', 'bytes');
  END IF;

  -- (6) the deal must be exactly what was reserved
  IF v_q.id IS NULL THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'quote_deleted'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'quote_not_found');
  END IF;
  -- Task 30: a customer change during the output makes it ANOTHER version -> this attempt ends; the new version is prepared anew
  IF coalesce(v_q.client_id::text, 'none') <> v_a.customer_binding THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'customer_changed'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'quote_changed');
  END IF;
  IF coalesce(v_q.signature, '') <> '' OR lower(coalesce(v_q.status, '')) NOT IN ('draft', 'sent')
     OR public.quote_output_digest(public.quote_output_deal_document(p_user_id, v_q.id)) <> v_a.content_digest THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'quote_changed'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'quote_changed');
  END IF;
  IF public.quote_output_issuer(p_user_id) IS NULL
     OR public.quote_output_digest(public.quote_output_issuer(p_user_id)) <> v_a.issuer_digest THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'issuer_changed'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'issuer_changed');
  END IF;
  IF p_presentation_digest <> v_a.presentation_digest THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'presentation_changed'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'presentation_changed');
  END IF;

  -- (7) entitlement and quota again (state may have changed since prepare)
  v_cap := public.resolve_style_media_entitlement(v_ent.account_mode, v_ent.style_plan_id);
  IF NOT (v_cap -> 'allowedStyles') ? v_a.style_id OR (v_a.media_count > 0 AND NOT (v_cap ->> 'mediaAllowed')::boolean) THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'not_entitled'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', CASE WHEN NOT (v_cap -> 'allowedStyles') ? v_a.style_id
                                                        THEN 'style_not_entitled' ELSE 'media_not_entitled' END);
  END IF;
  -- Owner 2026-10-18: paid / LIFETIME unlimited; a pre-activation Sent quote (no output yet) never counts
  v_counted := NOT public.quote_output_unlimited(p_user_id, v_ent.account_mode)
               AND NOT (lower(coalesce(v_q.status, '')) = 'sent'
                        AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id AND l.quote_id = v_q.id))
               -- 20261021100000: the first output of a (quote, customer) already counted at its save never counts again
               AND NOT public.free10_output_covered_by_save(p_user_id, v_q.id, v_a.customer_binding);
  -- 20261021200000: limited mode began since the reservation -> this new version ends here
  IF public.paid_account_limited(p_user_id) THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'subscription_limited'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached', 'reason', 'subscription_limited');
  END IF;
  -- 20261021100000: the 7 free days ended since the reservation -> a counted output ends here
  IF v_counted AND public.free10_period_ended(p_user_id) THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'free_period_ended'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached', 'reason', 'free_period_ended');
  END IF;
  v_reserved := public.quote_output_live_reservations(p_user_id, p_attempt_id);
  IF v_counted AND v_ent.free_issues_consumed + v_reserved >= v_ent.free_issue_limit THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'free_issue_limit_reached'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached');
  END IF;

  -- Task 30 backstop: this exact version was already output for this customer (never a second count; the attempt ends)
  SELECT * INTO v_ledger FROM public.quote_issue_ledger l
   WHERE l.user_id = p_user_id AND l.quote_id = v_q.id AND l.customer_binding = v_a.customer_binding
     AND l.content_digest = v_a.content_digest;
  IF FOUND THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'version_already_output'
     WHERE attempt_id = p_attempt_id;
    RETURN public.quote_output_final_response(v_ledger) || jsonb_build_object('alreadyFinalized', true);
  END IF;

  -- (8) COMMIT POINT: attempt FINALIZED + ledger + counter (+ Sent for 'send' only), all in this transaction
  UPDATE public.quote_output_attempts
     SET state = 'finalized', finalized_at = now(), snapshot_sha256 = p_sha256, snapshot_bytes = p_bytes,
         snapshot_schema_version = p_schema_version, counted_against_free = v_counted
   WHERE attempt_id = p_attempt_id;
  INSERT INTO public.quote_issue_ledger
    (attempt_id, user_id, quote_id, first_output_channel, idempotency_key, counted_against_free, account_mode_at_event,
     customer_binding, content_digest, issuer_digest, presentation_digest, snapshot_path, snapshot_sha256, snapshot_bytes,
     snapshot_schema_version)
  VALUES
    (p_attempt_id, p_user_id, v_q.id, v_a.requested_channel, v_a.idempotency_key, v_counted, v_ent.account_mode,
     v_a.customer_binding, v_a.content_digest, v_a.issuer_digest, v_a.presentation_digest, v_a.snapshot_path, p_sha256,
     p_bytes, p_schema_version)
  RETURNING * INTO v_ledger;
  IF v_counted THEN
    UPDATE public.account_entitlements
       SET free_issues_consumed = free_issues_consumed + 1, entitlement_version = entitlement_version + 1, updated_at = now()
     WHERE user_id = p_user_id;
  END IF;
  IF v_a.requested_channel = 'send' THEN
    UPDATE public.quotes SET status = 'sent' WHERE id = v_q.id AND user_id = p_user_id AND lower(status) = 'draft';
  END IF;
  RETURN public.quote_output_final_response(v_ledger);
END
$function$;
REVOKE ALL ON FUNCTION public.finalize_quote_output(uuid, uuid, text, text, bigint, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_quote_output(uuid, uuid, text, text, bigint, integer, text) TO service_role;

-- 11. account summary (body 20261021100000 + the marked change)
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
    'billing', public.account_billing_state(p_user_id));
  RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
END
$function$;
REVOKE ALL ON FUNCTION public.account_summary_build(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
