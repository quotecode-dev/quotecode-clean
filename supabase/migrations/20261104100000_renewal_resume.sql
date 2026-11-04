-- ============================================================================================================================
-- 20261104100000_renewal_resume.sql  -  resume a stopped renewal from the plans window, nothing charged until the paid period ends
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-04 (typed: "מאשר המשך חיוב מתחדש בלי חיוב מיידי מחלון המסלולים, כולל שינוי ב-L-01 ו-L-22, שחרור עד הלייב";
--   PROFLOW_TODO 5ב). The Owner: "לא שייך לחייב לקוח בחיוב חדש כשיש לו מנוי משולם". Proven in the PayPlus sandbox 2026-11-04: a
--   recurring page with instant_first_payment false + jump_payments keeps the card, charges nothing that day (Transactions/View:
--   "no transactions") and its standing order starts on the first charge date.
--   1. checkout_attempts.resume_first_charge_at: set only on a resume attempt (= the paid period end); subscription_events takes the
--      non-payment event 'renewal_resumed'.
--   2. billing_resume_renewal (new, service only): binds the resume page's standing order, the attempt becomes the live one and the
--      stop is cleared - paid_through and billing_paid_periods are NEVER touched (nothing was paid). Owner console 2026-11-05 (typed:
--      "מאשר חידוש עם או בלי חכם פלוס, והוספת חכם פלוס מיד בחיוב יחסי רק עליו, כולל שינוי ב-L-01 ו-L-22, שחרור עד הלייב"): with or
--      without SMART PACK - kept (only while active now) it renews; left off it stays to the paid period end; a SMART PACK that is not
--      active is added right after the resume by the existing mid-period add-on (pro-rata, SMART PACK only).
--   3. create_package_checkout_intent (20261102020000) + the resume attempt; record_checkout_pull (20261022200000) + the resume branch;
--      record_verified_provider_event (20261027200000) + a confirmation before the first charge date resumes, never pays. Every other
--      line of the three bodies is byte-identical to its source.
--   The first real charge of the resumed standing order is an ordinary renewal of the now live attempt: +1 period from paid_through.
-- Rollback of THIS file (DB owner): re-run the three source bodies; DROP FUNCTION public.billing_resume_renewal(uuid, text, text, text,
--   timestamptz, text, integer, text); the column and the event type may stay (unused) - drop them only while no row uses them.
-- ============================================================================================================================

ALTER TABLE public.checkout_attempts ADD COLUMN IF NOT EXISTS resume_first_charge_at timestamptz NULL;

ALTER TABLE public.subscription_events DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_event_type_check
  CHECK (event_type IN ('payment_confirmed', 'payment_failed', 'subscription_cancelled', 'refund',
                        'renewed', 'payment_succeeded', 'renewal_failed', 'line_changed', 'renewal_resumed'));

CREATE OR REPLACE FUNCTION public.billing_resume_renewal(p_attempt_id uuid, p_recurring_ref text, p_terminal_ref text, p_event_id text,
  p_event_time timestamptz, p_payload_sha256 text, p_amount_minor integer, p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_att public.checkout_attempts; v_ent public.account_entitlements; v_bound uuid; v_event_id bigint; v_phase text;
BEGIN
  IF p_attempt_id IS NULL OR p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 1 AND 200 OR p_event_time IS NULL
     OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$'
     OR (p_recurring_ref IS NOT NULL AND length(p_recurring_ref) NOT BETWEEN 1 AND 200) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
  END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
  END IF;
  SELECT * INTO v_att FROM public.checkout_attempts WHERE attempt_id = p_attempt_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_att.user_id::text));
  SELECT * INTO v_att FROM public.checkout_attempts WHERE attempt_id = p_attempt_id FOR UPDATE; -- after the lock
  IF v_att.resume_first_charge_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_event'); END IF;
  IF EXISTS (SELECT 1 FROM public.subscription_events WHERE provider = 'payplus' AND provider_event_id = p_event_id) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'activated', false, 'resumed', v_att.state = 'confirmed');
  END IF;
  IF v_att.state <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'activated', false, 'resumed', v_att.state = 'confirmed', 'state', v_att.state);
  END IF;
  -- the standing order the provider kept must be for exactly this attempt's lines (never a different amount)
  IF p_amount_minor IS DISTINCT FROM v_att.amount_minor OR p_currency IS DISTINCT FROM v_att.currency THEN
    RETURN jsonb_build_object('ok', true, 'activated', false, 'code', 'amount_mismatch');
  END IF;
  IF p_recurring_ref IS NOT NULL THEN
    SELECT s.attempt_id INTO v_bound FROM public.provider_standing_orders s WHERE s.provider = 'payplus' AND s.recurring_ref = p_recurring_ref;
    IF v_bound IS NOT NULL AND v_bound <> p_attempt_id THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_event'); END IF;
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements WHERE user_id = v_att.user_id FOR UPDATE;
  -- still the same stopped package, still paid: otherwise nothing resumes here (the attempt stays pending - a later real charge of its
  -- standing order is a purchase as always, a limited account's payment ends limited mode)
  IF v_ent.user_id IS NULL OR v_ent.account_mode <> 'paid' OR v_ent.package_id IS DISTINCT FROM 'all_inclusive' OR v_ent.subscription_status <> 'active'
     OR v_ent.renewal_stopped_at IS NULL OR v_ent.payment_failed_at IS NOT NULL OR v_ent.paid_through IS NULL OR v_ent.paid_through <= now()
     OR public.paid_account_limited(v_att.user_id)
     OR (SELECT p.billing_period FROM public.price_versions p WHERE p.price_id = v_att.plan_price_id) IS DISTINCT FROM v_ent.package_period THEN
    RETURN jsonb_build_object('ok', true, 'activated', false, 'code', 'not_resumable');
  END IF;
  INSERT INTO public.subscription_events (provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256, verified, outcome)
  VALUES ('payplus', p_event_id, 'renewal_resumed', p_attempt_id, p_event_time, p_payload_sha256, true, 'applied')
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING event_id INTO v_event_id;
  IF v_event_id IS NULL THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
  -- the attempt is live: its later standing-order charges are renewals (record_verified_subscription_event: 'applied' with a subscription row)
  INSERT INTO public.subscriptions (attempt_id, user_id, status, last_event_time, last_event_id)
  VALUES (p_attempt_id, v_att.user_id, 'active', p_event_time, v_event_id)
  ON CONFLICT (attempt_id) DO NOTHING;
  UPDATE public.checkout_attempts SET state = 'confirmed' WHERE attempt_id = p_attempt_id;
  -- SMART PACK (Owner console 2026-11-05): kept on the resumed standing order = it renews (it was active - the intent checked);
  -- left off = it stays to the end of the paid period and does not renew (as a removal does); never a free extension
  UPDATE public.account_entitlements
     SET live_attempt_id = p_attempt_id, renewal_stopped_at = NULL, entitlement_version = entitlement_version + 1, updated_at = now(),
         smart_pack_line = (v_att.add_on_price_id IS NOT NULL),
         smart_pack_until = CASE WHEN v_att.add_on_price_id IS NOT NULL THEN NULL
                                 WHEN smart_pack_line THEN greatest(coalesce(smart_pack_until, paid_through), paid_through)
                                 ELSE smart_pack_until END
   WHERE user_id = v_att.user_id;
  IF p_recurring_ref IS NOT NULL AND v_bound IS NULL THEN
    INSERT INTO public.provider_standing_orders (provider, recurring_ref, attempt_id, terminal_ref, first_event_id)
    VALUES ('payplus', p_recurring_ref, p_attempt_id, p_terminal_ref, p_event_id)
    ON CONFLICT DO NOTHING;
  END IF;
  -- one live package per account: every other unpaid link of the account expires (as after any activation)
  UPDATE public.checkout_attempts SET state = 'expired' WHERE user_id = v_att.user_id AND state = 'pending' AND attempt_id <> p_attempt_id;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', 'applied', 'activated', false, 'resumed', true,
                            'firstChargeAt', v_att.resume_first_charge_at, 'paidThrough', v_ent.paid_through);
END $$;
REVOKE ALL ON FUNCTION public.billing_resume_renewal(uuid, text, text, text, timestamptz, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_resume_renewal(uuid, text, text, text, timestamptz, text, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_package_checkout_intent(p_user_id uuid, p_billing_period text, p_idempotency_key text,
                                                                 p_smart_pack boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_market text; v_price public.price_versions; v_row public.checkout_attempts; v_addon public.price_versions;
  v_ent public.account_entitlements; v_resume timestamptz;
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
  -- 20261104100000 (Owner console 2026-11-04, typed: "מאשר המשך חיוב מתחדש בלי חיוב מיידי מחלון המסלולים, כולל שינוי ב-L-01 ו-L-22,
  -- שחרור עד הלייב"): an active package whose renewal was stopped, still paid for more than a day, resumes its renewal - the SAME period
  -- and the SAME lines (SMART PACK only when its line renews now), nothing charged today: the standing order starts charging when the
  -- paid period ends (resume_first_charge_at; the Edge page sends instant_first_payment false). Any other active account: unchanged.
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF v_ent.user_id IS NOT NULL AND v_ent.account_mode = 'paid' AND v_ent.package_id = 'all_inclusive' AND v_ent.style_plan_id IS NULL
     AND v_ent.subscription_status = 'active' AND v_ent.renewal_stopped_at IS NOT NULL AND v_ent.payment_failed_at IS NULL
     AND v_ent.live_attempt_id IS NOT NULL AND v_ent.package_period IN ('month', 'year')
     AND v_ent.paid_through IS NOT NULL AND (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date > (now() AT TIME ZONE 'Asia/Jerusalem')::date
     AND NOT coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false)
     AND NOT public.paid_account_limited(p_user_id) THEN
    -- Owner console 2026-11-05 (typed: "מאשר חידוש עם או בלי חכם פלוס, והוספת חכם פלוס מיד בחיוב יחסי רק עליו, כולל שינוי ב-L-01 ו-L-22,
    -- שחרור עד הלייב"): the resume keeps SMART PACK on the standing order only when it is active now (nothing to pay today); a SMART PACK
    -- that is not active now is added right after the resume by the mid-period add-on (a pro-rata charge for SMART PACK only)
    IF p_billing_period IS DISTINCT FROM v_ent.package_period
       OR (p_smart_pack AND NOT (coalesce(v_ent.smart_pack_line, false) OR (v_ent.smart_pack_until IS NOT NULL AND v_ent.smart_pack_until > now()))) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
    END IF;
    v_resume := v_ent.paid_through;
  END IF;
  -- PayPlus phase 1: never a payment page for an account that would pay for nothing
  IF v_resume IS NULL AND (coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false)
     OR EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = p_user_id AND e.account_mode = 'paid'
                 AND (e.style_plan_id IS NOT NULL OR e.subscription_status = 'active'))
     -- 20261021200000: a LIMITED account (grace days over) may pay again - a payment ends limited mode
     AND NOT public.paid_account_limited(p_user_id)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_subscribed');
  END IF;
  -- 20261021200000: a failed renewal is paid on the live standing order (PayPlus retries it) - never a second subscription
  IF v_resume IS NULL AND EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = p_user_id AND e.account_mode = 'paid'
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
    IF v_row.plan_price_id <> v_price.price_id OR v_row.blocks <> 0 OR v_row.add_on_price_id IS DISTINCT FROM v_addon.price_id
       OR v_row.resume_first_charge_at IS DISTINCT FROM v_resume THEN
      RETURN jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    END IF;
  ELSE
    INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, block_price_id, blocks, market, currency, amount_minor,
                                          add_on_price_id, resume_first_charge_at)
    VALUES (p_user_id, p_idempotency_key, v_price.price_id, NULL, 0, v_market, v_price.currency,
            v_price.amount_minor + coalesce(v_addon.amount_minor, 0), v_addon.price_id, v_resume)
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
                            'packageAmountMinor', v_price.amount_minor, 'addOnAmountMinor', v_addon.amount_minor,
                            'firstChargeAt', v_row.resume_first_charge_at);
END $$;
REVOKE ALL ON FUNCTION public.create_package_checkout_intent(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_package_checkout_intent(uuid, text, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.record_checkout_pull(p_attempt_id uuid, p_user_id uuid, p_provider_attempt_id uuid, p_recurring_ref text,
  p_paid_amount_minor integer, p_paid_currency text, p_payload_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_state text; v_bound uuid; v_r jsonb; v_phase text;
  v_event text := 'pull:' || p_attempt_id::text;
BEGIN
  -- the provider's answer must name THIS attempt (its extra_info) - checked here too, not only in the Edge
  IF p_attempt_id IS NULL OR p_user_id IS NULL OR p_provider_attempt_id IS DISTINCT FROM p_attempt_id
     OR p_recurring_ref IS NULL OR length(p_recurring_ref) NOT BETWEEN 1 AND 200 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
  END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_off'); -- nothing is written
  END IF;
  -- the same account lock as record_verified_subscription_event_and_activate: a callback and a pull of one account never interleave
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || p_user_id::text));
  SELECT c.state INTO v_state FROM public.checkout_attempts c
   WHERE c.attempt_id = p_attempt_id AND c.user_id = p_user_id AND c.provider_request_ref IS NOT NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  -- the callback came first (or the link expired / failed): the pull changes nothing
  IF v_state <> 'pending' THEN RETURN jsonb_build_object('ok', true, 'pulled', false, 'state', v_state); END IF;
  SELECT s.attempt_id INTO v_bound FROM public.provider_standing_orders s
   WHERE s.provider = 'payplus' AND s.recurring_ref = p_recurring_ref;
  IF v_bound IS NOT NULL AND v_bound <> p_attempt_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event'); -- a standing order never moves to another attempt
  END IF;
  -- 20261104100000: the page of a resumed renewal charged nothing - its standing order is bound and the renewal resumes (no period)
  IF (SELECT c.resume_first_charge_at FROM public.checkout_attempts c WHERE c.attempt_id = p_attempt_id) IS NOT NULL THEN
    RETURN public.billing_resume_renewal(p_attempt_id, p_recurring_ref, NULL, 'resume:' || p_attempt_id::text, now(), p_payload_sha256,
                                         p_paid_amount_minor, p_paid_currency) || jsonb_build_object('pulled', true);
  END IF;
  v_r := public.record_verified_subscription_event_and_activate('payplus', v_event, 'payment_confirmed', p_attempt_id,
           now(), p_payload_sha256, p_paid_amount_minor, p_paid_currency);
  IF (v_r ->> 'activated') = 'true' AND v_bound IS NULL THEN
    INSERT INTO public.provider_standing_orders (provider, recurring_ref, attempt_id, terminal_ref, first_event_id)
    VALUES ('payplus', p_recurring_ref, p_attempt_id, NULL, v_event)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_r || jsonb_build_object('pulled', true);
END $$;
REVOKE ALL ON FUNCTION public.record_checkout_pull(uuid, uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_checkout_pull(uuid, uuid, uuid, text, integer, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.record_verified_provider_event(p_provider text, p_provider_event_id text, p_event_type text,
  p_attempt_id uuid, p_recurring_ref text, p_terminal_ref text, p_provider_event_time timestamptz, p_payload_sha256 text,
  p_paid_amount_minor integer DEFAULT NULL, p_paid_currency text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_attempt uuid := p_attempt_id; v_bound uuid; v_r jsonb; v_pulled_at timestamptz; v_phase text; v_user uuid; v_row public.checkout_attempts;
  v_again boolean; v_addon_id uuid; v_base integer;
BEGIN
  IF (p_recurring_ref IS NOT NULL AND length(p_recurring_ref) NOT BETWEEN 1 AND 200)
     OR (p_terminal_ref IS NOT NULL AND length(p_terminal_ref) NOT BETWEEN 1 AND 200)
     OR (p_attempt_id IS NULL AND p_recurring_ref IS NULL)
     OR (p_recurring_ref IS NOT NULL AND p_provider IS DISTINCT FROM 'payplus')
     -- 20261022100000 (Codex audit M03): a provider time more than a day in the future is refused (never a paid period for years)
     OR p_provider_event_time > now() + interval '1 day'
     -- 20261022200000: 'pull:...' is the server's own pull event id, never a callback's
     OR p_provider_event_id LIKE 'pull:%' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
  END IF;
  IF p_recurring_ref IS NOT NULL THEN
    SELECT s.attempt_id INTO v_bound FROM public.provider_standing_orders s
     WHERE s.provider = p_provider AND s.recurring_ref = p_recurring_ref;
  END IF;
  IF v_attempt IS NULL THEN
    IF v_bound IS NULL THEN
      -- billing off answers billing_off first (nothing is written either way)
      IF (SELECT phase FROM public.billing_activation WHERE id) = 'off' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
      END IF;
      RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt');
    END IF;
    v_attempt := v_bound;
  ELSIF v_bound IS NOT NULL AND v_bound <> v_attempt THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event'); -- a standing order never moves to another attempt
  END IF;
  -- 20261022200000: the first charge the server already PULLED (record_checkout_pull) is the same payment as its later callback -
  -- recorded 'stale', never a second period. A renewal comes a whole cycle (28+ days) later: a confirmed charge within 7 days of the
  -- pull, before any other COUNTED charge of the attempt, with the attempt's amount / currency, is the first one (a second one within the
  -- window extends nothing either, but is reported). The account lock is taken BEFORE this check (the same
  -- lock as the pull and the activation), so a pull committing at the same instant is always seen.
  SELECT * INTO v_row FROM public.checkout_attempts c WHERE c.attempt_id = v_attempt;
  v_user := v_row.user_id;
  IF v_user IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
  END IF;
  -- 20261025300000: a renewal of package + SMART PACK while the SMART PACK line is still 'requested' (PayPlus changed the standing
  -- order but its answer was lost, or the function stopped before recording it): the line is finished first, so the renewal passes the
  -- unchanged amount check and SMART PACK stays (smart_pack_line)
  IF p_event_type = 'payment_confirmed' AND v_row.attempt_id IS NOT NULL AND v_row.add_on_price_id IS NULL
     AND p_paid_amount_minor IS DISTINCT FROM v_row.amount_minor
     AND (SELECT phase FROM public.billing_activation WHERE id) IN ('prepared', 'enforced') THEN
    SELECT a.add_on_id INTO v_addon_id FROM public.smart_pack_add_ons a JOIN public.price_versions p ON p.price_id = a.price_id
     WHERE a.package_attempt_id = v_attempt AND a.line_state = 'requested'
       AND p_paid_amount_minor = v_row.amount_minor + p.amount_minor AND p_paid_currency IS NOT DISTINCT FROM v_row.currency
     ORDER BY a.line_at DESC LIMIT 1;
    IF v_addon_id IS NOT NULL THEN
      PERFORM public.smart_pack_add_on_line_finish(v_addon_id, true);
      SELECT * INTO v_row FROM public.checkout_attempts c WHERE c.attempt_id = v_attempt;
    END IF;
  END IF;
  IF p_event_type = 'payment_confirmed' THEN
    SELECT e.provider_event_time INTO v_pulled_at FROM public.subscription_events e
     WHERE e.provider = p_provider AND e.provider_event_id = 'pull:' || v_attempt::text AND e.outcome = 'applied';
    -- 20261025300000: the first charge paid the package only when the SMART PACK line was added after the pull
    v_base := v_row.amount_minor - coalesce((SELECT p.amount_minor FROM public.smart_pack_add_ons a JOIN public.price_versions p ON p.price_id = a.price_id
                                              WHERE a.package_attempt_id = v_attempt AND a.line_state = 'added' AND a.line_at > v_pulled_at
                                              ORDER BY a.line_at DESC LIMIT 1), 0);
    IF v_pulled_at IS NOT NULL AND p_provider_event_time < v_pulled_at + interval '7 days'
       AND (p_paid_amount_minor IS NOT DISTINCT FROM v_row.amount_minor OR p_paid_amount_minor IS NOT DISTINCT FROM v_base) AND p_paid_currency IS NOT DISTINCT FROM v_row.currency
       AND NOT EXISTS (SELECT 1 FROM public.subscription_events e
                        WHERE e.provider = p_provider AND e.attempt_id = v_attempt AND e.event_type = 'payment_confirmed'
                          AND e.provider_event_id <> 'pull:' || v_attempt::text AND e.outcome = 'applied') THEN
      v_again := EXISTS (SELECT 1 FROM public.subscription_events e
                          WHERE e.provider = p_provider AND e.attempt_id = v_attempt AND e.event_type = 'payment_confirmed'
                            AND e.provider_event_id <> 'pull:' || v_attempt::text AND e.provider_event_id <> p_provider_event_id
                            AND e.outcome = 'stale');
      SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
      IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
      END IF;
      IF p_provider_event_time IS NULL OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
      END IF;
      INSERT INTO public.subscription_events (provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256, verified, outcome)
      -- Owner console 2026-10-26: a SECOND charge after the pulled first one is money with no entitlement - recorded 'rejected', so the
      -- daily reconciliation reports it (UNLINKED: the admin screen + the Owner's email) and it is refunded; the first one's own callback stays 'stale'
      VALUES (p_provider, p_provider_event_id, p_event_type, v_attempt, p_provider_event_time, p_payload_sha256, true, CASE WHEN v_again THEN 'rejected' ELSE 'stale' END)
      ON CONFLICT (provider, provider_event_id) DO NOTHING;
      IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
      -- the callback's standing-order id joins the attempt only when the pull activated it (the pull bound its own id then)
      IF p_attempt_id IS NOT NULL AND p_recurring_ref IS NOT NULL AND v_bound IS NULL
         AND EXISTS (SELECT 1 FROM public.provider_standing_orders s
                      WHERE s.provider = p_provider AND s.attempt_id = v_attempt AND s.first_event_id = 'pull:' || v_attempt::text) THEN
        INSERT INTO public.provider_standing_orders (provider, recurring_ref, attempt_id, terminal_ref, first_event_id)
        VALUES (p_provider, p_recurring_ref, v_attempt, p_terminal_ref, p_provider_event_id)
        ON CONFLICT DO NOTHING;
      END IF;
      RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', CASE WHEN v_again THEN 'rejected' ELSE 'stale' END, 'activated', false,
                                'code', CASE WHEN v_again THEN 'second_charge_after_pull' ELSE 'first_charge_pulled' END);
    END IF;
  END IF;
  -- 20261104100000: the page of a resumed renewal charges nothing; a confirmation of it before the first charge date (a day of slack) is
  -- the card being kept - the renewal resumes, the paid period is never extended. A real charge on / after that date is a payment as always.
  IF p_event_type = 'payment_confirmed' AND v_row.resume_first_charge_at IS NOT NULL AND v_row.state = 'pending'
     AND p_provider_event_time < v_row.resume_first_charge_at - interval '1 day' THEN
    RETURN public.billing_resume_renewal(v_attempt, p_recurring_ref, p_terminal_ref, p_provider_event_id, p_provider_event_time, p_payload_sha256,
                                         p_paid_amount_minor, p_paid_currency);
  END IF;
  v_r := public.record_verified_subscription_event_and_activate(p_provider, p_provider_event_id, p_event_type, v_attempt,
           p_provider_event_time, p_payload_sha256, p_paid_amount_minor, p_paid_currency);
  -- bind once: an activating payment of the attempt (first or renewal) whose signed callback carried our attempt id AND the standing-order id;
  -- Codex audit 2026-10-22 H-04: also a payment of an attempt that is no longer payable - its standing order stays traceable (a later
  -- charge of it reaches the same attempt and is reported again, never a package)
  IF ((v_r ->> 'activated') = 'true' OR (v_r ->> 'code') = 'attempt_not_payable') AND p_attempt_id IS NOT NULL AND p_recurring_ref IS NOT NULL AND v_bound IS NULL THEN
    INSERT INTO public.provider_standing_orders (provider, recurring_ref, attempt_id, terminal_ref, first_event_id)
    VALUES (p_provider, p_recurring_ref, p_attempt_id, p_terminal_ref, p_provider_event_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_r;
END $$;
REVOKE ALL ON FUNCTION public.record_verified_provider_event(text, text, text, uuid, text, text, timestamptz, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_provider_event(text, text, text, uuid, text, text, timestamptz, text, integer, text) TO service_role;
