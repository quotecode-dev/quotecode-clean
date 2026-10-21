-- PayPlus standing-order link (migration 20261022000000, Owner night task 2026-10-21). Disposable postgres:17 harness ONLY.
-- Proves: billing off = nothing written, no binding; a callback with neither id is refused; a standing-order id is PayPlus-only;
-- 'prepared' never binds; the activating payment (our attempt id + the standing-order id) binds the standing order once; a later
-- renewal / failed renewal / grace recovery that carries ONLY the standing-order id reaches the same attempt; an unknown standing
-- order is unknown_attempt; ids that disagree with the binding are refused; a binding never moves; one attempt may gain a second
-- standing order; billing switched off again refuses a bound standing order; append-only, no truncate; only service_role may call
-- the entry and nobody reads the table.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (billing phase rows are test devices of the DB owner).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.zu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4040000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.zsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
-- the Edge call: subscription-authority wiring -> record_verified_provider_event (as service_role)
CREATE OR REPLACE FUNCTION tst.zpay(p_event text, p_type text, p_attempt uuid, p_ref text, p_at timestamptz, p_amount int, p_provider text DEFAULT 'payplus')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.zsvc();
  r := public.record_verified_provider_event(p_provider, p_event, p_type, p_attempt, p_ref, 'term-404', p_at, repeat('e', 64), p_amount, 'ILS');
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.zattempt(p_user uuid, p_key text) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, blocks, market, currency, amount_minor)
  SELECT p_user, p_key, price_id, 0, market, currency, amount_minor FROM public.price_versions WHERE price_id = 'il_all_inclusive_year_p1'
  RETURNING attempt_id $$;
CREATE OR REPLACE FUNCTION tst.zent(p_user uuid) RETURNS text LANGUAGE sql AS $$
  SELECT account_mode || '/' || coalesce(package_id, '-') || '/' || subscription_status FROM public.account_entitlements WHERE user_id = p_user $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) SELECT tst.zu(n), format('a404-%s@synthetic.test', n) FROM generate_series(1, 5) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.zu(n), format('a404-%s@synthetic.test', n), format('Synthetic standing order %s', n), 'Local', 'ILS', 'free', 'user', false
    FROM generate_series(1, 5) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.zu(n), 'IL', 'business_settings_country' FROM generate_series(1, 5) n;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.zu(n), 'free_10', NULL, 0 FROM generate_series(1, 5) n;

-- ---------------------------------------------------------------------------------------------------------------- billing off
DO $$
DECLARE a uuid; r jsonb;
BEGIN
  a := tst.zattempt(tst.zu(1), 'payplus-so-user1-off');
  r := tst.zpay('so-off-1', 'payment_confirmed', a, 'rec-off', '2020-10-22 09:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'code' = 'billing_off', 'Z0 billing off (today): the attempt-carrying callback is refused');
  r := tst.zpay('so-off-2', 'payment_confirmed', NULL, 'rec-off', '2020-10-22 09:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'code' = 'billing_off', 'Z0b billing off: a standing-order-only callback is refused too');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.provider_standing_orders)
                 AND NOT EXISTS (SELECT 1 FROM public.subscription_events WHERE provider_event_id IN ('so-off-1', 'so-off-2')),
                 'Z0c billing off: no binding and no event row');
END $$;
SELECT tst.ok((tst.zpay('so-none', 'payment_confirmed', NULL, NULL, now(), 30600) ->> 'code') = 'invalid_event',
              'Z1 a callback with neither our attempt id nor a standing-order id is refused');
SELECT tst.ok((tst.zpay('so-long', 'payment_confirmed', gen_random_uuid(), repeat('x', 201), now(), 30600) ->> 'code') = 'invalid_event',
              'Z1b an over-long standing-order id is refused');
SELECT tst.ok((tst.zpay('so-other', 'payment_confirmed', gen_random_uuid(), 'rec-x', now(), 30600, 'stripe') ->> 'code') = 'invalid_event',
              'Z1c a standing-order id is PayPlus-only');

-- ---------------------------------------------------------------------------------------------------------------- 'prepared' never binds
SELECT public.set_billing_phase('prepared', 'TEST: standing-order link - prepared');
DO $$
DECLARE a uuid; r jsonb;
BEGIN
  a := tst.zattempt(tst.zu(4), 'payplus-so-user4-year');
  r := tst.zpay('so-prep', 'payment_confirmed', a, 'rec-4', '2020-10-22 08:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'code' = 'billing_not_enforced' AND NOT EXISTS (SELECT 1 FROM public.provider_standing_orders WHERE recurring_ref = 'rec-4'),
                 'Z1d prepared: the payment is recorded, opens nothing and binds no standing order');
  r := tst.zpay('so-prep-2', 'payment_confirmed', NULL, 'rec-4', '2020-11-22 08:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'code' = 'unknown_attempt', 'Z1e prepared: that standing order alone stays unknown');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- enforced (test device)
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;
DO $$
DECLARE a uuid; other uuid; r jsonb; pt timestamptz;
BEGIN
  r := tst.zpay('so-unknown', 'payment_confirmed', NULL, 'rec-unknown', '2020-10-22 09:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'code' = 'unknown_attempt' AND NOT EXISTS (SELECT 1 FROM public.subscription_events WHERE provider_event_id = 'so-unknown'),
                 'Z2 a standing order nobody bound = unknown_attempt, nothing written');

  a := tst.zattempt(tst.zu(1), 'payplus-so-user1-year');
  r := tst.zpay('so-first', 'payment_confirmed', a, 'rec-1', '2020-10-22 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.zent(tst.zu(1)) = 'paid/all_inclusive/active', 'Z3 the first payment opens the package');
  PERFORM tst.ok((SELECT attempt_id = a AND terminal_ref = 'term-404' AND first_event_id = 'so-first' FROM public.provider_standing_orders
                   WHERE provider = 'payplus' AND recurring_ref = 'rec-1'), 'Z4 the standing order is bound to that attempt once');
  r := tst.zpay('so-first', 'payment_confirmed', a, 'rec-1', '2020-10-22 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'duplicate' = 'true' AND (SELECT count(*) FROM public.provider_standing_orders WHERE attempt_id = a) = 1,
                 'Z4b the first callback again = a no-op; the binding is unchanged');
  SELECT paid_through INTO pt FROM public.account_entitlements WHERE user_id = tst.zu(1);

  r := tst.zpay('so-renew', 'payment_confirmed', NULL, 'rec-1', '2021-10-22 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'outcome' = 'applied' AND r ->> 'activated' = 'true'
                 AND (SELECT paid_through FROM public.account_entitlements WHERE user_id = tst.zu(1))
                     = public.billing_period_end(greatest(pt, '2021-10-22 10:00:00+00'::timestamptz), 'year')
                 AND (SELECT attempt_id FROM public.subscription_events WHERE provider_event_id = 'so-renew') = a,
                 'Z5 a renewal carrying ONLY the standing-order id reaches the same attempt and extends the paid period by one year');
  r := tst.zpay('so-renew', 'payment_confirmed', NULL, 'rec-1', '2021-10-22 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'duplicate' = 'true', 'Z6 the same renewal callback again = a no-op');

  r := tst.zpay('so-fail', 'payment_failed', NULL, 'rec-1', '2022-10-22 10:00:00+00', 30600);
  PERFORM tst.ok(tst.zent(tst.zu(1)) = 'paid/all_inclusive/past_due'
                 AND (SELECT payment_failed_at FROM public.account_entitlements WHERE user_id = tst.zu(1)) IS NOT NULL,
                 'Z7 a failed renewal carrying ONLY the standing-order id starts the grace days of that account');
  r := tst.zpay('so-retry-ok', 'payment_confirmed', NULL, 'rec-1', '2022-10-23 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.zent(tst.zu(1)) = 'paid/all_inclusive/active'
                 AND (SELECT payment_failed_at FROM public.account_entitlements WHERE user_id = tst.zu(1)) IS NULL,
                 'Z7b the retried charge carrying ONLY the standing-order id ends the grace days');

  -- PayPlus re-creates the standing order (e.g. a card update): its first charge carries our attempt id + the NEW id
  r := tst.zpay('so-second', 'payment_confirmed', a, 'rec-1b', '2023-10-23 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND (SELECT attempt_id FROM public.provider_standing_orders WHERE recurring_ref = 'rec-1b') = a,
                 'Z7c one attempt may gain a second standing order');
  r := tst.zpay('so-second-renew', 'payment_confirmed', NULL, 'rec-1b', '2024-10-23 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'outcome' = 'applied' AND (SELECT attempt_id FROM public.subscription_events WHERE provider_event_id = 'so-second-renew') = a,
                 'Z7d its renewals carrying only the new id reach the same attempt');

  other := tst.zattempt(tst.zu(2), 'payplus-so-user2-year');
  r := tst.zpay('so-move', 'payment_confirmed', other, 'rec-1', '2022-10-23 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'code' = 'invalid_event' AND tst.zent(tst.zu(2)) = 'free_10/-/none'
                 AND (SELECT attempt_id FROM public.provider_standing_orders WHERE recurring_ref = 'rec-1') = a,
                 'Z8 a callback whose attempt id disagrees with the binding is refused; the binding never moves');

  -- a payment that activates nothing (wrong amount) binds nothing
  other := tst.zattempt(tst.zu(3), 'payplus-so-user3-year');
  r := tst.zpay('so-low', 'payment_confirmed', other, 'rec-3', '2020-10-22 11:00:00+00', 100);
  PERFORM tst.ok(r ->> 'code' = 'amount_mismatch' AND NOT EXISTS (SELECT 1 FROM public.provider_standing_orders WHERE recurring_ref = 'rec-3'),
                 'Z9 a payment that opens nothing binds no standing order');
END $$;

-- billing switched off again: a bound standing order is refused before anything is written
UPDATE public.billing_activation SET phase = 'off', reason = 'TEST device: back off' WHERE id;
SELECT tst.ok((tst.zpay('so-after-off', 'payment_confirmed', NULL, 'rec-1', '2025-10-23 10:00:00+00', 30600) ->> 'code') = 'billing_off'
              AND NOT EXISTS (SELECT 1 FROM public.subscription_events WHERE provider_event_id = 'so-after-off'),
              'Z9b billing off again: a bound standing order is refused, nothing written');

SELECT tst.throws($$ UPDATE public.provider_standing_orders SET attempt_id = gen_random_uuid() $$, 'append-only', 'Z10 the binding table is append-only (update)');
SELECT tst.throws($$ DELETE FROM public.provider_standing_orders $$, 'append-only', 'Z10b the binding table is append-only (delete)');
SELECT tst.throws($$ TRUNCATE public.provider_standing_orders $$, 'append-only', 'Z10c the binding table cannot be truncated');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.record_verified_provider_event(text,text,text,uuid,text,text,timestamptz,text,integer,text)', 'execute')
              AND NOT has_function_privilege('anon', 'public.record_verified_provider_event(text,text,text,uuid,text,text,timestamptz,text,integer,text)', 'execute')
              AND has_function_privilege('service_role', 'public.record_verified_provider_event(text,text,text,uuid,text,text,timestamptz,text,integer,text)', 'execute'),
              'Z11 only service_role may call the entry');
SELECT tst.ok(NOT has_table_privilege('authenticated', 'public.provider_standing_orders', 'SELECT')
              AND NOT has_table_privilege('anon', 'public.provider_standing_orders', 'SELECT')
              AND NOT has_table_privilege('service_role', 'public.provider_standing_orders', 'SELECT'),
              'Z12 no role reads the binding table directly');

ROLLBACK;
