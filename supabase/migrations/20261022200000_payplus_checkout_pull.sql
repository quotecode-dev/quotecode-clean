-- ============================================================================================================================
-- 20261022200000_payplus_checkout_pull.sql  -  the server PULLS the result of a payment page from PayPlus when the user is back
--                                              and no callback arrived; the same first charge never counts twice
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-21 ("תתחיל" on docs/PAYMENTS_ACTIVATION_PLAN_2026-10-21.md step 1, then "להמשיך עכשיו בחיבור למסד").
--   Sandbox run 2026-10-21 (Owner-typed authorization): POST /PaymentPages/ipn with the page request id returns the standing order
--   the payment created (its uid, amount, currency, status 000, extra_info = our attempt id) - but NOT the transaction uid that the
--   callback carries as its event id. So a pulled payment and its later callback cannot share an event id:
--   1. checkout_attempts.provider_request_ref: the PayPlus page request id, kept ONCE together with the page
--      (record_checkout_attempt_page_and_request - the stored page and its request id always belong together).
--   2. checkout_pull_targets(user): the account's own pending attempts with a page opened in the last 24 hours (newest first, 3 at most);
--      each attempt is asked about at most once every 10 seconds (provider_pulled_at), so a client can never flood PayPlus.
--   3. record_checkout_pull: the pulled payment is recorded as the attempt's FIRST charge under the event id 'pull:<attempt id>' at the
--      pull time, through the unchanged record_verified_subscription_event_and_activate (same lock, same amount / currency equality,
--      same activation); an activating pull binds the standing order (its uid) so a renewal is recognised even if no first callback
--      ever arrives. An attempt that is no longer pending (the callback came first) changes nothing.
--   4. record_verified_provider_event: the first charge's callback arriving AFTER its pull is the same payment - recorded as 'stale',
--      never a second period. A renewal comes a whole cycle later; a confirmed charge within 7 days of the pull is the first charge.
--      An event id 'pull:...' is never accepted from a callback. Review 2026-10-21 (scope-security): only a COUNTED callback ends the
--      window; a second callback within it is reported (second_charge_after_pull); a callback whose amount / currency differ from the
--      attempt is never swallowed (the normal path records it rejected / amount_mismatch); SQL itself checks the attempt id PayPlus named.
--   INERT: billing is 'off' in code (subscription-authority ACTIVATION_PHASE) and in the DB; every new path answers billing_off
--   before anything is written.
--   ROLLBACK (DB owner): roll the Edge function back first; re-run the 20261022100000 body of record_verified_provider_event;
--   DROP FUNCTION public.record_checkout_pull(uuid, uuid, uuid, text, integer, text, text), public.checkout_pull_targets(uuid),
--   public.record_checkout_attempt_page_and_request(uuid, uuid, text, text); the two new columns may stay (nullable, unused).
-- ============================================================================================================================

-- 1. the page request id of an attempt -----------------------------------------------------------------------------------------
ALTER TABLE public.checkout_attempts ADD COLUMN IF NOT EXISTS provider_request_ref text NULL
  CHECK (provider_request_ref IS NULL OR provider_request_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE public.checkout_attempts ADD COLUMN IF NOT EXISTS provider_pulled_at timestamptz NULL;

-- set once, together with the page (20261022100000 H05: the stored page wins - and its request id with it)
CREATE OR REPLACE FUNCTION public.record_checkout_attempt_page_and_request(p_attempt_id uuid, p_user_id uuid, p_url text, p_request_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_url text;
BEGIN
  IF p_url IS NULL OR p_url !~ '^https://' OR length(p_url) > 2000
     OR p_request_ref IS NULL OR p_request_ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  UPDATE public.checkout_attempts SET provider_page_url = p_url, provider_page_at = now(), provider_request_ref = p_request_ref
   WHERE attempt_id = p_attempt_id AND user_id = p_user_id AND state = 'pending' AND provider_page_url IS NULL;
  SELECT c.provider_page_url INTO v_url FROM public.checkout_attempts c
   WHERE c.attempt_id = p_attempt_id AND c.user_id = p_user_id AND c.state = 'pending';
  RETURN v_url;
END $$;
REVOKE ALL ON FUNCTION public.record_checkout_attempt_page_and_request(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_checkout_attempt_page_and_request(uuid, uuid, text, text) TO service_role;

-- 2. what may be pulled for this account ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_pull_targets(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v jsonb;
BEGIN
  -- claimed: an attempt asked about in the last 10 seconds is skipped (the provider is never flooded by a polling client)
  WITH t AS (
    UPDATE public.checkout_attempts c SET provider_pulled_at = now()
     WHERE c.attempt_id IN (SELECT x.attempt_id FROM public.checkout_attempts x
                             WHERE x.user_id = p_user_id AND x.state = 'pending' AND x.provider_request_ref IS NOT NULL
                               AND x.provider_page_at > now() - interval '24 hours'
                               AND (x.provider_pulled_at IS NULL OR x.provider_pulled_at <= now() - interval '10 seconds')
                             ORDER BY x.provider_page_at DESC
                             LIMIT 3)
       -- re-checked on the row itself: a concurrent claim that waited for this row's lock never claims it a second time
       AND (c.provider_pulled_at IS NULL OR c.provider_pulled_at <= now() - interval '10 seconds')
    RETURNING c.attempt_id, c.provider_request_ref, c.amount_minor, c.currency, c.provider_page_at)
  SELECT coalesce(jsonb_agg(jsonb_build_object('attemptId', t.attempt_id, 'requestRef', t.provider_request_ref,
                                               'amountMinor', t.amount_minor, 'currency', t.currency) ORDER BY t.provider_page_at DESC), '[]'::jsonb)
    INTO v FROM t;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.checkout_pull_targets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_pull_targets(uuid) TO service_role;

-- 3. a pulled payment = the attempt's first charge ----------------------------------------------------------------------------
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

-- 4. the Edge recorder entry (body 20261022100000 + the marked 20261022200000 changes) ------------------------------------------
CREATE OR REPLACE FUNCTION public.record_verified_provider_event(p_provider text, p_provider_event_id text, p_event_type text,
  p_attempt_id uuid, p_recurring_ref text, p_terminal_ref text, p_provider_event_time timestamptz, p_payload_sha256 text,
  p_paid_amount_minor integer DEFAULT NULL, p_paid_currency text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_attempt uuid := p_attempt_id; v_bound uuid; v_r jsonb; v_pulled_at timestamptz; v_phase text; v_user uuid; v_row public.checkout_attempts;
  v_again boolean;
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
  IF p_event_type = 'payment_confirmed' THEN
    SELECT e.provider_event_time INTO v_pulled_at FROM public.subscription_events e
     WHERE e.provider = p_provider AND e.provider_event_id = 'pull:' || v_attempt::text AND e.outcome = 'applied';
    IF v_pulled_at IS NOT NULL AND p_provider_event_time < v_pulled_at + interval '7 days'
       AND p_paid_amount_minor IS NOT DISTINCT FROM v_row.amount_minor AND p_paid_currency IS NOT DISTINCT FROM v_row.currency
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
      VALUES (p_provider, p_provider_event_id, p_event_type, v_attempt, p_provider_event_time, p_payload_sha256, true, 'stale')
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
      RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', 'stale', 'activated', false,
                                'code', CASE WHEN v_again THEN 'second_charge_after_pull' ELSE 'first_charge_pulled' END);
    END IF;
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
