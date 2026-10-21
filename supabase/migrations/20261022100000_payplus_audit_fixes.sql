-- ============================================================================================================================
-- 20261022100000_payplus_audit_fixes.sql  -  the Codex audit of PayPlus stage 2 (docs/CODEX_PAYPLUS_STAGE2_AUDIT_2026-10-21.md)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-21 (answers to the audit): "כן, את כולן (מומלץ)" (the reproduced defects) and "3 ימים מסוף התקופה (מומלץ)"
--   (the grace days when no renewal callback arrives at all).
--   1. H02: a quote attachment's file / quote cannot be REPLACED without SMART PACK either (the gate covered INSERT only).
--   2. H04 + H03: the verified-payment recorder - a wrong amount / currency is recorded as rejected before anything advances; a NEW
--      attempt paid after a failed charge carries its own SMART PACK choice (only a retried renewal of the same attempt keeps it).
--   3. M03: record_verified_provider_event refuses a provider time more than a day in the future.
--   4. D-1: no renewal callback at all -> the grace days end 72 hours after the paid period (was 24 h tolerance + 72 h); nothing is
--      shown in the first 24 hours after the period, as before.
--   5. H05: the provider payment page of an attempt is kept ONCE; a retry of the same attempt returns the same page.
--   6. D-2 (Owner: "הרי כתוב במפורש המוקדם מביניהם"): the free window's SMART PACK ends with the free plan - 10 counted quotes or 7 days.
--   INERT: billing is 'off' in code and in the DB and free_issue is 'prepared' - every changed path answers before it is reached.
--   ROLLBACK (DB owner): re-run the 20261021400000 / 20261022000000 / 20261021200000 bodies of the functions; DROP FUNCTION
--   public.checkout_attempt_page(uuid, uuid), public.record_checkout_attempt_page(uuid, uuid, text); the trigger back to INSERT only;
--   the two new checkout_attempts columns may stay (nullable, unused).
-- ============================================================================================================================

-- 1. attachments: the SMART PACK gate on INSERT and on a replacement of the file / the quote ---------------------------------
DROP TRIGGER IF EXISTS quote_attachments_smart_pack_gate ON public.quote_attachments;
CREATE TRIGGER quote_attachments_smart_pack_gate BEFORE INSERT OR UPDATE OF quote_id, file_name, file_url, file_size, storage_path
  ON public.quote_attachments FOR EACH ROW EXECUTE FUNCTION public.quote_attachments_smart_pack_gate();

-- 2. the verified-payment recorder (body 20261021400000 + the marked 20261022100000 changes) ---------------------------------
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
  -- 20261022100000 (Codex audit H04): a confirmed payment whose amount / currency differ from the attempt is recorded as REJECTED
  -- before anything advances - no subscription row, no event time, no state - so it can never make a later correct payment stale.
  -- The attempt stays pending: a correct payment of it may still open the package.
  IF p_event_type = 'payment_confirmed' AND v_user IS NOT NULL THEN
    SELECT * INTO v_attempt FROM public.checkout_attempts WHERE attempt_id = p_attempt_id;
    IF p_paid_amount_minor IS DISTINCT FROM v_attempt.amount_minor OR p_paid_currency IS DISTINCT FROM v_attempt.currency THEN
      SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
      IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
      END IF;
      IF p_provider_event_time IS NULL OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
      END IF;
      INSERT INTO public.subscription_events (provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256, verified, outcome)
      VALUES (p_provider, p_provider_event_id, p_event_type, p_attempt_id, p_provider_event_time, p_payload_sha256, true, 'rejected')
      ON CONFLICT (provider, provider_event_id) DO NOTHING;
      IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
      RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', 'rejected', 'activated', false, 'code', 'amount_mismatch');
    END IF;
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
           -- 20261022100000 (Codex audit H03): only a payment of the SAME standing order (a retried renewal) keeps the line; a NEW
           -- attempt paid after a failed charge carries its own choice
           smart_pack_line = CASE WHEN subscription_status = 'past_due' AND NOT v_first THEN smart_pack_line ELSE (v_attempt.add_on_price_id IS NOT NULL) END
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

-- 3. the Edge recorder entry (body 20261022000000 + the marked 20261022100000 change) ------------------------------------------
CREATE OR REPLACE FUNCTION public.record_verified_provider_event(p_provider text, p_provider_event_id text, p_event_type text,
  p_attempt_id uuid, p_recurring_ref text, p_terminal_ref text, p_provider_event_time timestamptz, p_payload_sha256 text,
  p_paid_amount_minor integer DEFAULT NULL, p_paid_currency text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_attempt uuid := p_attempt_id; v_bound uuid; v_r jsonb;
BEGIN
  IF (p_recurring_ref IS NOT NULL AND length(p_recurring_ref) NOT BETWEEN 1 AND 200)
     OR (p_terminal_ref IS NOT NULL AND length(p_terminal_ref) NOT BETWEEN 1 AND 200)
     OR (p_attempt_id IS NULL AND p_recurring_ref IS NULL)
     OR (p_recurring_ref IS NOT NULL AND p_provider IS DISTINCT FROM 'payplus')
     -- 20261022100000 (Codex audit M03): a provider time more than a day in the future is refused (never a paid period for years)
     OR p_provider_event_time > now() + interval '1 day' THEN
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
  v_r := public.record_verified_subscription_event_and_activate(p_provider, p_provider_event_id, p_event_type, v_attempt,
           p_provider_event_time, p_payload_sha256, p_paid_amount_minor, p_paid_currency);
  -- bind once: an activating payment of the attempt (first or renewal) whose signed callback carried our attempt id AND the standing-order id
  IF (v_r ->> 'activated') = 'true' AND p_attempt_id IS NOT NULL AND p_recurring_ref IS NOT NULL AND v_bound IS NULL THEN
    INSERT INTO public.provider_standing_orders (provider, recurring_ref, attempt_id, terminal_ref, first_event_id)
    VALUES (p_provider, p_recurring_ref, p_attempt_id, p_terminal_ref, p_provider_event_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_r;
END $$;
REVOKE ALL ON FUNCTION public.record_verified_provider_event(text, text, text, uuid, text, text, timestamptz, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_provider_event(text, text, text, uuid, text, text, timestamptz, text, integer, text) TO service_role;

-- 4. the grace days (body 20261021200000 + the marked change) ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.paid_grace_ends_at(p_user_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT least(CASE WHEN e.subscription_status = 'past_due'
                    THEN greatest(e.payment_failed_at, coalesce(e.paid_through, e.payment_failed_at)) + interval '72 hours' END,
               -- 20261022100000 (Owner D-1): no renewal callback at all = the same 3 days from the end of the paid period (shown after
               -- the first 24 hours, so an ordinary renewal arriving a few hours late never flashes a grace notice)
               CASE WHEN e.paid_through IS NOT NULL AND now() >= e.paid_through + interval '24 hours'
                    THEN e.paid_through + interval '72 hours' END)
    FROM public.account_entitlements e
   WHERE e.user_id = p_user_id AND e.account_mode = 'paid' AND e.package_id IS NOT NULL AND e.style_plan_id IS NULL
     AND NOT coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false)
$function$;
REVOKE ALL ON FUNCTION public.paid_grace_ends_at(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 5. one provider payment page per attempt ------------------------------------------------------------------------------------
ALTER TABLE public.checkout_attempts ADD COLUMN IF NOT EXISTS provider_page_url text NULL
  CHECK (provider_page_url IS NULL OR (provider_page_url ~ '^https://' AND length(provider_page_url) <= 2000));
ALTER TABLE public.checkout_attempts ADD COLUMN IF NOT EXISTS provider_page_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.checkout_attempt_page(p_attempt_id uuid, p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT c.provider_page_url FROM public.checkout_attempts c
   WHERE c.attempt_id = p_attempt_id AND c.user_id = p_user_id AND c.state = 'pending'
$$;
REVOKE ALL ON FUNCTION public.checkout_attempt_page(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_attempt_page(uuid, uuid) TO service_role;

-- set once; the stored page wins (a concurrent second page is never returned)
CREATE OR REPLACE FUNCTION public.record_checkout_attempt_page(p_attempt_id uuid, p_user_id uuid, p_url text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_url text;
BEGIN
  IF p_url IS NULL OR p_url !~ '^https://' OR length(p_url) > 2000 THEN RETURN NULL; END IF;
  UPDATE public.checkout_attempts SET provider_page_url = p_url, provider_page_at = now()
   WHERE attempt_id = p_attempt_id AND user_id = p_user_id AND state = 'pending' AND provider_page_url IS NULL;
  SELECT c.provider_page_url INTO v_url FROM public.checkout_attempts c WHERE c.attempt_id = p_attempt_id AND c.user_id = p_user_id;
  RETURN v_url;
END $$;
REVOKE ALL ON FUNCTION public.record_checkout_attempt_page(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_checkout_attempt_page(uuid, uuid, text) TO service_role;

-- 6. SMART PACK of the free window ends with the free plan (body 20261021400000 + the marked change) --------------------------
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
     AND now() < v_ent.free_window_starts_at + interval '168 hours'
     -- 20261022100000 (Owner 2026-10-21, IRON-LANDING-001 "המוקדם מביניהם"): it ends with the free plan - 10 counted quotes or 7 days
     AND v_ent.free_issues_consumed < v_ent.free_issue_limit THEN
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
