-- ============================================================================================================================
-- 20261025300000_smart_pack_mid_period_add_on.sql  -  SMART PACK for an account that already pays for the package: a one-time
--                                                     pro-rata charge now, then the SMART PACK line on the same standing order
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-25 ("ב: חיוב יחסי עכשיו"; "תעשה את שניהם יחד"): a subscriber without SMART PACK adds it from the plans window.
--   1. smart_pack_add_ons: one row per add-on payment page (server amount, the live package it belongs to, the period end it pays to);
--      smart_pack_add_on_events: the verified provider events of those pages (append-only; the package events table references
--      package attempts only).
--   2. smart_pack_add_on_quote: the amount = the SMART PACK price of the package cycle x the Israel days left / the days of the active
--      paid period (today counts), a whole shekel (IRON-ILS-001), at least 1.00 ILS. Only an Israeli account whose package is live
--      (active, not limited, no failed charge, renewal not stopped, a bound standing order with its terminal and page request id, a
--      next charge after today) and that has no SMART PACK.
--   3. create_smart_pack_add_on_intent / the page (set once) / the pull targets / the pull: the same discipline as the package page;
--      one payable page per account (a second click gets the open one).
--   4. record_smart_pack_add_on_payment: the paid amount / currency must EQUAL the row; the verified payment gives SMART PACK until
--      the period end it was quoted for (smart_pack_until) and expires the account's other unpaid add-on pages. Billing 'enforced' only;
--      a page paid after its period ended or after its package stopped gives nothing (reported for a refund).
--   5. the line: smart_pack_add_on_line_begin (marked 'requested' BEFORE PayPlus is asked) / smart_pack_add_on_line_finish - only after
--      PayPlus changed the standing order does the package attempt carry the SMART PACK line (amount + add-on, add_on_price_id), so
--      the next renewal of package + SMART PACK passes the unchanged amount check and SMART PACK stays (smart_pack_line). A refused
--      change = 'not_added' (SMART PACK still runs to the period end; the Owner sees it). A lost answer stays 'requested' and is tried
--      again (smart_pack_add_on_line_targets).
--   6. billing_admin_preview: the refund of a period paid BEFORE the line was added counts the package amount only (body 20261022300000
--      + the marked change).
--   7. record_verified_provider_event: a renewal of package + SMART PACK while the line is still 'requested' (PayPlus changed the order,
--      its answer was lost) finishes the line first - the paying customer's renewal is never rejected for it (body 20261022200000 +
--      the marked changes).
--   8. billing_reconcile_source: package charges before the line count the package only; the add-on charges / refunds are ours too.
--   INERT until billing is 'enforced' (Production is): every new path answers billing_off / checkout_unavailable otherwise.
--   ROLLBACK (DB owner): roll subscription-authority back first; re-run 20261022300000 section 4 (billing_admin_preview), 20261022200000
--   section 4 (record_verified_provider_event) and 20261023300000 (billing_reconcile_source); DROP the other functions of this file; the
--   two tables may stay (nothing reads them then).
-- ============================================================================================================================

-- 1. tables --------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.smart_pack_add_ons (
  add_on_id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL,
  package_attempt_id   uuid        NOT NULL REFERENCES public.checkout_attempts (attempt_id),
  price_id             text        NOT NULL REFERENCES public.price_versions (price_id),
  idempotency_key      text        NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$'),
  period               text        NOT NULL CHECK (period IN ('month', 'year')),
  currency             text        NOT NULL CHECK (currency = 'ILS'),
  amount_minor         integer     NOT NULL CHECK (amount_minor > 0),
  period_end           timestamptz NOT NULL,
  days_left            integer     NOT NULL CHECK (days_left > 0),
  days_in_period       integer     NOT NULL CHECK (days_in_period > 0),
  state                text        NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'paid', 'expired')),
  provider_page_url    text        NULL CHECK (provider_page_url IS NULL OR (provider_page_url ~ '^https://' AND length(provider_page_url) <= 2000)),
  provider_page_at     timestamptz NULL,
  provider_request_ref text        NULL CHECK (provider_request_ref IS NULL OR provider_request_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  provider_pulled_at   timestamptz NULL,
  paid_event_id        text        NULL UNIQUE,
  paid_at              timestamptz NULL,
  line_state           text        NULL CHECK (line_state IN ('requested', 'added', 'not_added')),
  line_at              timestamptz NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key),
  CHECK ((state = 'paid') = (paid_event_id IS NOT NULL)),
  CHECK (line_state IS NULL OR state = 'paid')
);
CREATE INDEX IF NOT EXISTS smart_pack_add_ons_user ON public.smart_pack_add_ons (user_id, created_at DESC);
ALTER TABLE public.smart_pack_add_ons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.smart_pack_add_ons FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.smart_pack_add_on_events (
  event_id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider            text        NOT NULL CHECK (provider IN ('payplus', 'mock')),
  provider_event_id   text        NOT NULL CHECK (length(provider_event_id) BETWEEN 1 AND 200),
  event_type          text        NOT NULL CHECK (event_type IN ('payment_confirmed', 'payment_failed', 'refund')),
  add_on_id           uuid        NOT NULL REFERENCES public.smart_pack_add_ons (add_on_id),
  provider_event_time timestamptz NOT NULL,
  payload_sha256      text        NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  paid_amount_minor   integer     NULL,
  paid_currency       text        NULL,
  outcome             text        NOT NULL CHECK (outcome IN ('applied', 'stale', 'rejected', 'recorded')),
  received_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
ALTER TABLE public.smart_pack_add_on_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.smart_pack_add_on_events FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS smart_pack_add_on_events_append_only ON public.smart_pack_add_on_events;
CREATE TRIGGER smart_pack_add_on_events_append_only BEFORE UPDATE OR DELETE ON public.smart_pack_add_on_events
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();
DROP TRIGGER IF EXISTS smart_pack_add_on_events_no_truncate ON public.smart_pack_add_on_events;
CREATE TRIGGER smart_pack_add_on_events_no_truncate BEFORE TRUNCATE ON public.smart_pack_add_on_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.append_only_guard();

-- 2. the amount ----------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.smart_pack_add_on_quote(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_market text; v_ent public.account_entitlements; v_att public.checkout_attempts; v_price public.price_versions;
  v_pp public.billing_paid_periods; v_start timestamptz; v_days int; v_left int;
BEGIN
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable');
  END IF;
  SELECT market INTO v_market FROM public.account_market WHERE user_id = p_user_id;
  IF v_market IS DISTINCT FROM 'IL' THEN RETURN jsonb_build_object('ok', false, 'code', 'market_not_open'); END IF;
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF v_ent.user_id IS NULL OR v_ent.account_mode <> 'paid' OR v_ent.package_id IS DISTINCT FROM 'all_inclusive' OR v_ent.style_plan_id IS NOT NULL
     OR v_ent.subscription_status <> 'active' OR v_ent.live_attempt_id IS NULL OR v_ent.paid_through IS NULL OR v_ent.paid_through <= now()
     OR v_ent.package_period NOT IN ('month', 'year') OR v_ent.renewal_stopped_at IS NOT NULL OR v_ent.payment_failed_at IS NOT NULL
     OR public.paid_account_limited(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_ent.live_attempt_id;
  IF v_ent.smart_pack_line OR v_att.add_on_price_id IS NOT NULL OR (v_ent.smart_pack_until IS NOT NULL AND v_ent.smart_pack_until > now()) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_included');
  END IF;
  -- the line needs what smart_pack_add_on_line_begin needs (review 2026-10-25: never a payment for a line that can never be added):
  -- the standing order of the live package with its terminal, the package page request id, a next charge after today
  IF NOT EXISTS (SELECT 1 FROM public.provider_standing_orders s
                  WHERE s.provider = 'payplus' AND s.attempt_id = v_att.attempt_id AND s.terminal_ref IS NOT NULL)
     OR v_att.provider_request_ref IS NULL
     OR (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date <= (now() AT TIME ZONE 'Asia/Jerusalem')::date THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  SELECT * INTO v_price FROM public.price_versions
   WHERE plan_id = 'smart_pack' AND offer = 'current' AND market = 'IL' AND billing_period = v_ent.package_period;
  IF NOT FOUND OR v_price.currency IS DISTINCT FROM v_att.currency THEN
    RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable');
  END IF;
  -- the active paid period (its real start); derived from the period end only without a period row (the refund preview's rule)
  SELECT * INTO v_pp FROM public.billing_paid_periods p
   WHERE p.user_id = p_user_id AND p.attempt_id = v_att.attempt_id AND p.period_start <= now() AND p.period_end > now()
   ORDER BY p.period_end DESC, p.period_id DESC LIMIT 1;
  v_start := coalesce(v_pp.period_start,
    ((v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem') - CASE v_ent.package_period WHEN 'year' THEN interval '1 year' ELSE interval '1 month' END)
      AT TIME ZONE 'Asia/Jerusalem');
  v_days := greatest(1, (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date - (v_start AT TIME ZONE 'Asia/Jerusalem')::date);
  v_left := least(v_days, greatest(1, (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date - (now() AT TIME ZONE 'Asia/Jerusalem')::date));
  -- IRON-ILS-001: a whole shekel (half up) - the amount charged is the amount shown
  RETURN jsonb_build_object('ok', true, 'market', 'IL', 'currency', v_price.currency,
    'amountMinor', greatest(100, (round(v_price.amount_minor::numeric * v_left / v_days / 100) * 100)::int),
    'priceId', v_price.price_id, 'recurringMinor', v_price.amount_minor, 'period', v_ent.package_period, 'periodEnd', v_ent.paid_through,
    'daysLeft', v_left, 'daysInPeriod', v_days, 'packageAttemptId', v_att.attempt_id);
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_add_on_quote(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_add_on_quote(uuid) TO service_role;

-- 3. the payment page ----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_smart_pack_add_on_intent(p_user_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_q jsonb; v_row public.smart_pack_add_ons;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || p_user_id::text));
  SELECT * INTO v_row FROM public.smart_pack_add_ons WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN
    v_q := public.smart_pack_add_on_quote(p_user_id);
    IF (v_q ->> 'ok') IS DISTINCT FROM 'true' THEN RETURN v_q; END IF;
    -- review 2026-10-25: one payable page per account - a second click / tab gets the open page of the same amount and period end;
    -- an open page of another amount (a day later) expires, so two pages can never both be paid for one period
    SELECT * INTO v_row FROM public.smart_pack_add_ons a
     WHERE a.user_id = p_user_id AND a.state = 'pending' AND a.amount_minor = (v_q ->> 'amountMinor')::int
       AND a.period_end = (v_q ->> 'periodEnd')::timestamptz AND a.package_attempt_id = (v_q ->> 'packageAttemptId')::uuid
     ORDER BY a.created_at DESC LIMIT 1;
  END IF;
  IF v_row.add_on_id IS NULL THEN
    UPDATE public.smart_pack_add_ons SET state = 'expired' WHERE user_id = p_user_id AND state = 'pending';
    INSERT INTO public.smart_pack_add_ons (user_id, package_attempt_id, price_id, idempotency_key, period, currency, amount_minor, period_end,
                                           days_left, days_in_period)
    VALUES (p_user_id, (v_q ->> 'packageAttemptId')::uuid, v_q ->> 'priceId', p_idempotency_key, v_q ->> 'period', v_q ->> 'currency',
            (v_q ->> 'amountMinor')::int, (v_q ->> 'periodEnd')::timestamptz, (v_q ->> 'daysLeft')::int, (v_q ->> 'daysInPeriod')::int)
    RETURNING * INTO v_row;
  END IF;
  RETURN jsonb_build_object('ok', true, 'addOnId', v_row.add_on_id, 'market', 'IL', 'currency', v_row.currency, 'amountMinor', v_row.amount_minor,
    'period', v_row.period, 'periodEnd', v_row.period_end, 'state', v_row.state,
    'recurringMinor', (SELECT p.amount_minor FROM public.price_versions p WHERE p.price_id = v_row.price_id));
END $$;
REVOKE ALL ON FUNCTION public.create_smart_pack_add_on_intent(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_smart_pack_add_on_intent(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.smart_pack_add_on_page(p_add_on_id uuid, p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT a.provider_page_url FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id AND a.user_id = p_user_id AND a.state = 'pending';
$$;
REVOKE ALL ON FUNCTION public.smart_pack_add_on_page(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_add_on_page(uuid, uuid) TO service_role;

-- set once; the stored page (and its request id) always wins
CREATE OR REPLACE FUNCTION public.record_smart_pack_add_on_page(p_add_on_id uuid, p_user_id uuid, p_url text, p_request_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_url text;
BEGIN
  IF p_url IS NULL OR p_url !~ '^https://' OR length(p_url) > 2000
     OR (p_request_ref IS NOT NULL AND p_request_ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RETURN NULL;
  END IF;
  UPDATE public.smart_pack_add_ons SET provider_page_url = p_url, provider_page_at = now(), provider_request_ref = p_request_ref
   WHERE add_on_id = p_add_on_id AND user_id = p_user_id AND state = 'pending' AND provider_page_url IS NULL;
  SELECT a.provider_page_url INTO v_url FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id AND a.user_id = p_user_id AND a.state = 'pending';
  RETURN v_url;
END $$;
REVOKE ALL ON FUNCTION public.record_smart_pack_add_on_page(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_smart_pack_add_on_page(uuid, uuid, text, text) TO service_role;

-- the account's own unpaid add-on pages of the last 24 hours (3 at most; each asked about at most once every 10 seconds)
CREATE OR REPLACE FUNCTION public.smart_pack_add_on_pull_targets(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v jsonb;
BEGIN
  WITH t AS (
    UPDATE public.smart_pack_add_ons a SET provider_pulled_at = now()
     WHERE a.add_on_id IN (SELECT x.add_on_id FROM public.smart_pack_add_ons x
                            WHERE x.user_id = p_user_id AND x.state = 'pending' AND x.provider_request_ref IS NOT NULL
                              AND x.provider_page_at > now() - interval '24 hours'
                              AND (x.provider_pulled_at IS NULL OR x.provider_pulled_at <= now() - interval '10 seconds')
                            ORDER BY x.provider_page_at DESC
                            LIMIT 3)
       AND (a.provider_pulled_at IS NULL OR a.provider_pulled_at <= now() - interval '10 seconds')
    RETURNING a.add_on_id, a.provider_request_ref, a.amount_minor, a.currency, a.provider_page_at)
  SELECT coalesce(jsonb_agg(jsonb_build_object('addOnId', t.add_on_id, 'requestRef', t.provider_request_ref,
                                               'amountMinor', t.amount_minor, 'currency', t.currency) ORDER BY t.provider_page_at DESC), '[]'::jsonb)
    INTO v FROM t;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_add_on_pull_targets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_add_on_pull_targets(uuid) TO service_role;

-- 4. the verified payment ------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_smart_pack_add_on_payment(p_provider text, p_provider_event_id text, p_event_type text,
  p_add_on_id uuid, p_provider_event_time timestamptz, p_payload_sha256 text, p_paid_amount_minor integer DEFAULT NULL,
  p_paid_currency text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_user uuid; v_row public.smart_pack_add_ons; v_ent public.account_entitlements; v_code text;
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('payplus', 'mock') OR p_provider_event_id IS NULL OR length(p_provider_event_id) NOT BETWEEN 1 AND 200
     OR p_event_type IS NULL OR p_event_type NOT IN ('payment_confirmed', 'payment_failed', 'refund') OR p_add_on_id IS NULL
     OR p_provider_event_time IS NULL OR p_provider_event_time > now() + interval '1 day'
     OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
  END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_off'); -- nothing is written
  END IF;
  SELECT a.user_id INTO v_user FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id;
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  -- the same account lock as the package recorder and the pull (a callback, a pull and a renewal of one account never interleave)
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
  IF EXISTS (SELECT 1 FROM public.smart_pack_add_on_events e WHERE e.provider = p_provider AND e.provider_event_id = p_provider_event_id) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  SELECT * INTO v_row FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id FOR UPDATE;
  IF p_event_type <> 'payment_confirmed' THEN
    INSERT INTO public.smart_pack_add_on_events (provider, provider_event_id, event_type, add_on_id, provider_event_time, payload_sha256,
                                                 paid_amount_minor, paid_currency, outcome)
    VALUES (p_provider, p_provider_event_id, p_event_type, p_add_on_id, p_provider_event_time, p_payload_sha256, p_paid_amount_minor, p_paid_currency, 'recorded');
    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', 'recorded', 'activated', false);
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = v_user;
  -- the paid amount / currency must equal the row (never a price); anything else is recorded rejected and changes nothing
  IF (p_paid_amount_minor IS DISTINCT FROM v_row.amount_minor OR p_paid_currency IS DISTINCT FROM v_row.currency)
     AND p_provider_event_id LIKE 'pull:%' THEN
    -- review 2026-10-25: a pull answer read wrong is never kept under the fixed pull id (a later pull or the callback still decides)
    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'activated', false, 'code', 'amount_mismatch');
  END IF;
  v_code := CASE
    WHEN p_paid_amount_minor IS DISTINCT FROM v_row.amount_minor OR p_paid_currency IS DISTINCT FROM v_row.currency THEN 'amount_mismatch'
    -- the same payment seen again (the pull first, then its callback) - or a second payment of one page (an incident)
    WHEN v_row.state = 'paid' THEN CASE WHEN v_row.paid_event_id LIKE 'pull:%' AND p_provider_event_id NOT LIKE 'pull:%'
                                             AND NOT EXISTS (SELECT 1 FROM public.smart_pack_add_on_events e WHERE e.add_on_id = p_add_on_id
                                                              AND e.outcome = 'stale' AND e.provider_event_id NOT LIKE 'pull:%')
                                        THEN 'first_charge_pulled' ELSE 'second_charge' END
    WHEN v_row.state = 'expired' THEN 'attempt_not_payable'
    -- review 2026-10-25: a page paid after its period ended, or after the package it was bought for stopped, gives nothing (refund)
    WHEN v_row.period_end <= now() OR v_ent.live_attempt_id IS DISTINCT FROM v_row.package_attempt_id
         OR v_ent.renewal_stopped_at IS NOT NULL THEN 'attempt_not_payable'
    WHEN v_phase IS DISTINCT FROM 'enforced' THEN 'billing_not_enforced'
  END;
  IF v_code IS NOT NULL THEN
    INSERT INTO public.smart_pack_add_on_events (provider, provider_event_id, event_type, add_on_id, provider_event_time, payload_sha256,
                                                 paid_amount_minor, paid_currency, outcome)
    VALUES (p_provider, p_provider_event_id, p_event_type, p_add_on_id, p_provider_event_time, p_payload_sha256, p_paid_amount_minor, p_paid_currency,
            CASE v_code WHEN 'billing_not_enforced' THEN 'recorded' WHEN 'first_charge_pulled' THEN 'stale' WHEN 'second_charge' THEN 'stale' ELSE 'rejected' END);
    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'activated', false, 'code', v_code);
  END IF;
  UPDATE public.smart_pack_add_ons SET state = 'paid', paid_event_id = p_provider_event_id, paid_at = p_provider_event_time
   WHERE add_on_id = p_add_on_id;
  -- SMART PACK until the end of the period it was quoted for (never shortened)
  UPDATE public.account_entitlements SET smart_pack_until = greatest(coalesce(smart_pack_until, v_row.period_end), v_row.period_end), updated_at = now()
   WHERE user_id = v_user
  RETURNING * INTO v_ent;
  -- one SMART PACK purchase at a time: the account's other unpaid add-on pages expire (a later payment of one is reported)
  UPDATE public.smart_pack_add_ons SET state = 'expired' WHERE user_id = v_user AND state = 'pending' AND add_on_id <> p_add_on_id;
  INSERT INTO public.smart_pack_add_on_events (provider, provider_event_id, event_type, add_on_id, provider_event_time, payload_sha256,
                                               paid_amount_minor, paid_currency, outcome)
  VALUES (p_provider, p_provider_event_id, p_event_type, p_add_on_id, p_provider_event_time, p_payload_sha256, p_paid_amount_minor, p_paid_currency, 'applied');
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', 'applied', 'activated', true, 'addOnId', p_add_on_id,
    'lineNeeded', NOT v_ent.smart_pack_line);
END $$;
REVOKE ALL ON FUNCTION public.record_smart_pack_add_on_payment(text, text, text, uuid, timestamptz, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_smart_pack_add_on_payment(text, text, text, uuid, timestamptz, text, integer, text) TO service_role;

-- a pulled payment (no callback yet): the provider's answer must name THIS add-on; recorded under 'pull:sp:<id>' at the pull time
CREATE OR REPLACE FUNCTION public.record_smart_pack_add_on_pull(p_add_on_id uuid, p_user_id uuid, p_provider_add_on_id uuid,
  p_paid_amount_minor integer, p_paid_currency text, p_payload_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_state text;
BEGIN
  IF p_add_on_id IS NULL OR p_user_id IS NULL OR p_provider_add_on_id IS DISTINCT FROM p_add_on_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
  END IF;
  SELECT a.state INTO v_state FROM public.smart_pack_add_ons a
   WHERE a.add_on_id = p_add_on_id AND a.user_id = p_user_id AND a.provider_request_ref IS NOT NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  IF v_state <> 'pending' THEN RETURN jsonb_build_object('ok', true, 'pulled', false, 'state', v_state); END IF;
  RETURN public.record_smart_pack_add_on_payment('payplus', 'pull:sp:' || p_add_on_id::text, 'payment_confirmed', p_add_on_id, now(),
           p_payload_sha256, p_paid_amount_minor, p_paid_currency) || jsonb_build_object('pulled', true);
END $$;
REVOKE ALL ON FUNCTION public.record_smart_pack_add_on_pull(uuid, uuid, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_smart_pack_add_on_pull(uuid, uuid, uuid, integer, text, text) TO service_role;

-- 5. the SMART PACK line on the standing order ---------------------------------------------------------------------------------
-- begin: marked 'requested' BEFORE PayPlus is asked; returns what the change needs (never the card or the customer - PayPlus has them)
CREATE OR REPLACE FUNCTION public.smart_pack_add_on_line_begin(p_add_on_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_user uuid; v_row public.smart_pack_add_ons; v_ent public.account_entitlements; v_att public.checkout_attempts; v_price public.price_versions;
  v_rec public.provider_standing_orders; v_next date;
BEGIN
  SELECT a.user_id INTO v_user FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id;
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
  SELECT * INTO v_row FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id FOR UPDATE;
  IF v_row.state <> 'paid' OR v_row.line_state IN ('added', 'not_added') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'line_not_open', 'lineState', v_row.line_state);
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = v_user;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_row.package_attempt_id;
  SELECT * INTO v_price FROM public.price_versions p WHERE p.price_id = v_row.price_id;
  SELECT * INTO v_rec FROM public.provider_standing_orders s
   WHERE s.provider = 'payplus' AND s.attempt_id = v_row.package_attempt_id AND s.terminal_ref IS NOT NULL ORDER BY s.created_at DESC LIMIT 1;
  v_next := (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date;
  IF v_ent.live_attempt_id IS DISTINCT FROM v_row.package_attempt_id OR v_ent.subscription_status IS DISTINCT FROM 'active'
     OR v_ent.renewal_stopped_at IS NOT NULL OR v_ent.smart_pack_line OR v_att.add_on_price_id IS NOT NULL OR public.paid_account_limited(v_user)
     OR v_rec.recurring_ref IS NULL OR v_att.provider_request_ref IS NULL
     OR v_next IS NULL OR v_next <= (now() AT TIME ZONE 'Asia/Jerusalem')::date THEN
    UPDATE public.smart_pack_add_ons SET line_state = 'not_added', line_at = now() WHERE add_on_id = p_add_on_id;
    RETURN jsonb_build_object('ok', false, 'code', 'line_not_possible');
  END IF;
  UPDATE public.smart_pack_add_ons SET line_state = 'requested', line_at = now() WHERE add_on_id = p_add_on_id;
  RETURN jsonb_build_object('ok', true, 'addOnId', p_add_on_id, 'packageAttemptId', v_att.attempt_id, 'recurringRef', v_rec.recurring_ref,
    'terminalRef', v_rec.terminal_ref, 'packageRequestRef', v_att.provider_request_ref, 'packageAmountMinor', v_att.amount_minor,
    'addOnAmountMinor', v_price.amount_minor, 'period', v_row.period, 'currency', v_att.currency, 'nextChargeDate', to_char(v_next, 'YYYY-MM-DD'));
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_add_on_line_begin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_add_on_line_begin(uuid) TO service_role;

-- finish: only a standing order PayPlus changed makes the package attempt carry the line (its renewals then pay package + SMART PACK)
CREATE OR REPLACE FUNCTION public.smart_pack_add_on_line_finish(p_add_on_id uuid, p_added boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_user uuid; v_row public.smart_pack_add_ons; v_price public.price_versions;
BEGIN
  IF p_add_on_id IS NULL OR p_added IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  SELECT a.user_id INTO v_user FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id;
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
  SELECT * INTO v_row FROM public.smart_pack_add_ons a WHERE a.add_on_id = p_add_on_id FOR UPDATE;
  IF v_row.line_state IS DISTINCT FROM 'requested' THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'lineState', v_row.line_state);
  END IF;
  IF p_added THEN
    SELECT * INTO v_price FROM public.price_versions p WHERE p.price_id = v_row.price_id;
    UPDATE public.checkout_attempts SET amount_minor = amount_minor + v_price.amount_minor, add_on_price_id = v_row.price_id
     WHERE attempt_id = v_row.package_attempt_id AND add_on_price_id IS NULL;
    UPDATE public.account_entitlements SET smart_pack_line = true, updated_at = now()
     WHERE user_id = v_user AND live_attempt_id = v_row.package_attempt_id;
  END IF;
  UPDATE public.smart_pack_add_ons SET line_state = CASE WHEN p_added THEN 'added' ELSE 'not_added' END, line_at = now()
   WHERE add_on_id = p_add_on_id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'lineState', CASE WHEN p_added THEN 'added' ELSE 'not_added' END);
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_add_on_line_finish(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_add_on_line_finish(uuid, boolean) TO service_role;

-- paid add-ons of the account whose line was never asked for, or whose answer was lost (asked over 2 minutes ago): tried again
CREATE OR REPLACE FUNCTION public.smart_pack_add_on_line_targets(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce(jsonb_agg(t.add_on_id), '[]'::jsonb) FROM (
    SELECT a.add_on_id FROM public.smart_pack_add_ons a
     WHERE a.user_id = p_user_id AND a.state = 'paid'
       AND (a.line_state IS NULL OR (a.line_state = 'requested' AND a.line_at <= now() - interval '2 minutes'))
     ORDER BY a.paid_at DESC LIMIT 3) t;
$$;
REVOKE ALL ON FUNCTION public.smart_pack_add_on_line_targets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_add_on_line_targets(uuid) TO service_role;

-- 6. the refund preview: a period paid before the line was added was paid at the package amount (body 20261022300000 + the change) -
CREATE OR REPLACE FUNCTION public.billing_admin_preview(p_user_id uuid, p_waive_fee boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_ent public.account_entitlements; v_att public.checkout_attempts; v_period text;
  v_rec public.provider_standing_orders; v_charge text; v_start timestamptz; v_end timestamptz;
  v_days int; v_unused int; v_prorated int; v_fee int; v_refund int; v_pp public.billing_paid_periods; v_pend timestamptz; v_future boolean;
  v_paid int;
BEGIN
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
  END IF;
  IF p_user_id IS NULL OR p_waive_fee IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'lifetime_account');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF v_ent.user_id IS NULL OR v_ent.account_mode <> 'paid' OR v_ent.package_id IS NULL OR v_ent.style_plan_id IS NOT NULL
     OR v_ent.live_attempt_id IS NULL OR v_ent.paid_through IS NULL OR v_ent.package_period NOT IN ('month', 'year') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_live_package');
  END IF;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_ent.live_attempt_id;
  v_period := v_ent.package_period;
  -- the newest standing order of the live attempt, and the newest real charge of it (a pulled first charge has no transaction id)
  SELECT * INTO v_rec FROM public.provider_standing_orders s WHERE s.attempt_id = v_att.attempt_id ORDER BY s.created_at DESC LIMIT 1;
  -- the ACTIVE paid period (Codex audit H-03) and its own charge; a later period already paid = hasFuturePeriod
  SELECT * INTO v_pp FROM public.billing_paid_periods p
   WHERE p.user_id = p_user_id AND p.attempt_id = v_att.attempt_id AND p.period_start <= now() AND p.period_end > now()
   ORDER BY p.period_end DESC, p.period_id DESC LIMIT 1;
  v_pend := coalesce(v_pp.period_end, v_ent.paid_through);
  v_future := v_ent.paid_through > v_pend;
  v_charge := v_pp.charge_ref;
  IF v_charge IS NULL AND v_pp.event_id LIKE 'pull:%' THEN
    -- a period opened by a pull: its first charge's callback (stale, within 7 days of the pull)
    SELECT e.provider_event_id INTO v_charge
      FROM public.subscription_events e
      JOIN public.subscription_events p ON p.provider = 'payplus' AND p.provider_event_id = 'pull:' || v_att.attempt_id::text AND p.outcome = 'applied'
     WHERE e.attempt_id = v_att.attempt_id AND e.provider = 'payplus' AND e.event_type = 'payment_confirmed' AND e.outcome = 'stale'
       AND e.provider_event_id NOT LIKE 'pull:%' AND e.provider_event_time < p.provider_event_time + interval '7 days'
     ORDER BY e.provider_event_time, e.event_id LIMIT 1;
  END IF;
  -- the real start of the period (a clamped month end never changes the day count); derived only without a period row
  v_start := coalesce(v_pp.period_start,
    ((v_pend AT TIME ZONE 'Asia/Jerusalem') - CASE v_period WHEN 'year' THEN interval '1 year' ELSE interval '1 month' END)
      AT TIME ZONE 'Asia/Jerusalem');
  -- 20261025300000: the charge of a period that started before the SMART PACK line was added was the package amount only (the
  -- SMART PACK part of that period was its own one-time charge)
  v_paid := v_att.amount_minor - coalesce((SELECT p.amount_minor FROM public.smart_pack_add_ons a JOIN public.price_versions p ON p.price_id = a.price_id
                                            WHERE a.package_attempt_id = v_att.attempt_id AND a.line_state = 'added' AND a.line_at > v_start
                                            ORDER BY a.line_at DESC LIMIT 1), 0);
  v_end := (date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') + interval '1 day') AT TIME ZONE 'Asia/Jerusalem';
  v_days := greatest(1, (v_pend AT TIME ZONE 'Asia/Jerusalem')::date - (v_start AT TIME ZONE 'Asia/Jerusalem')::date);
  v_unused := greatest(0, (v_pend AT TIME ZONE 'Asia/Jerusalem')::date - (v_end AT TIME ZONE 'Asia/Jerusalem')::date);
  v_unused := least(v_unused, v_days);
  v_prorated := round(v_paid::numeric * v_unused / v_days)::int;
  v_fee := CASE WHEN p_waive_fee OR v_prorated = 0 THEN 0
                WHEN v_att.currency = 'ILS' THEN least(round(v_paid * 0.05)::int, 10000)
                ELSE 0 END; -- Codex audit M-02: no USD fee until an approved rule
  v_refund := greatest(0, v_prorated - v_fee);
  RETURN jsonb_build_object('ok', true, 'attemptId', v_att.attempt_id, 'currency', v_att.currency, 'paidMinor', v_paid,
    'period', v_period, 'periodStart', v_start, 'periodEnd', v_pend, 'paidThrough', v_ent.paid_through, 'effectiveEnd', v_end,
    'hasFuturePeriod', v_future,
    'daysInPeriod', v_days, 'unusedDays', v_unused, 'proratedMinor', v_prorated, 'feeMinor', v_fee, 'feeWaived', p_waive_fee,
    'refundMinor', v_refund, 'renewalStopped', v_ent.renewal_stopped_at IS NOT NULL,
    'hasStandingOrder', v_rec.recurring_ref IS NOT NULL, 'hasChargeRef', v_charge IS NOT NULL,
    'recurringRef', v_rec.recurring_ref, 'terminalRef', v_rec.terminal_ref, 'chargeRef', v_charge);
END $$;
REVOKE ALL ON FUNCTION public.billing_admin_preview(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_preview(uuid, boolean) TO service_role;

-- 7. the Edge recorder entry (body 20261022200000 + the marked 20261025300000 changes) ------------------------------------------
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

-- 8. the daily reconciliation source (body 20261023300000 + the marked 20261025300000 changes) -------------------------------------
-- a package charge made BEFORE the SMART PACK line was added paid the package only; the SMART PACK add-on charges (their PayPlus more_info
-- is 'sp_' + the add-on id) and refunds are ours too
CREATE OR REPLACE FUNCTION public.billing_reconcile_source(p_from timestamptz, p_until timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'charges', coalesce((
      SELECT jsonb_agg(c.j ORDER BY c.at) FROM (
        SELECT jsonb_build_object('providerEventId', e.provider_event_id, 'attemptId', e.attempt_id,
          'amountMinor', a.amount_minor - coalesce((SELECT p.amount_minor FROM public.smart_pack_add_ons s JOIN public.price_versions p ON p.price_id = s.price_id
                                                     WHERE s.package_attempt_id = a.attempt_id AND s.line_state = 'added' AND s.line_at > e.provider_event_time
                                                     ORDER BY s.line_at DESC LIMIT 1), 0),
          'currency', a.currency, 'at', e.provider_event_time) AS j, e.provider_event_time AS at
        FROM public.subscription_events e JOIN public.checkout_attempts a ON a.attempt_id = e.attempt_id
        WHERE e.provider = 'payplus' AND e.event_type = 'payment_confirmed' AND e.verified AND e.outcome <> 'rejected'
          AND e.provider_event_time >= p_from AND e.provider_event_time <= p_until
        UNION ALL
        SELECT jsonb_build_object('providerEventId', e.provider_event_id, 'attemptId', 'sp_' || s.add_on_id::text, 'amountMinor', s.amount_minor,
          'currency', s.currency, 'at', e.provider_event_time), e.provider_event_time
        FROM public.smart_pack_add_on_events e JOIN public.smart_pack_add_ons s ON s.add_on_id = e.add_on_id
        WHERE e.provider = 'payplus' AND e.event_type = 'payment_confirmed' AND e.outcome IN ('applied', 'stale')
          AND e.provider_event_time >= p_from AND e.provider_event_time <= p_until) c), '[]'::jsonb),
    'refunds', coalesce((
      SELECT jsonb_agg(jsonb_build_object('transactionUid', s.uid))
      FROM (SELECT e.provider_event_id AS uid FROM public.subscription_events e WHERE e.provider = 'payplus' AND e.event_type = 'refund'
            UNION
            SELECT e.provider_event_id FROM public.smart_pack_add_on_events e WHERE e.provider = 'payplus' AND e.event_type = 'refund'
            UNION
            SELECT r.refund_ref FROM public.billing_admin_refunds r WHERE r.stage = 'result' AND r.refund_status = 'refunded' AND r.refund_ref IS NOT NULL) s), '[]'::jsonb)
  )
$function$;
REVOKE ALL ON FUNCTION public.billing_reconcile_source(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_reconcile_source(timestamptz, timestamptz) TO service_role;