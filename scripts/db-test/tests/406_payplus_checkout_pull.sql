-- The server pull of a PayPlus payment page (migration 20261022200000; Owner console 2026-10-21). Disposable postgres:17 harness ONLY.
-- Proves: billing off = nothing written; the page and its request id are kept ONCE together (owner + pending only); the pull targets
-- are the account's own pending attempts with a page from the last 24 hours (3 at most); a pull before the callback opens the package
-- once, binds the standing order, and the first charge's later callback (earlier time, a few seconds of clock skew, or a repeated
-- delivery) is 'stale' - never a second period; a renewal a cycle later still extends; a callback first = the pull changes nothing;
-- a wrong pulled amount opens nothing and the correct callback still does; another account's / an unknown attempt, a standing order
-- of another attempt and a callback using the pull event id are refused; 'prepared' never binds; only service_role calls the entries.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (now() is the same instant throughout).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.pu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4060000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.preq(n int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT format('b4060000-0000-4000-8000-%s', lpad(n::text, 12, '0')) $$;
CREATE OR REPLACE FUNCTION tst.psvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.pintent(p_user uuid, p_key text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.psvc(); r := public.create_package_checkout_intent(p_user, 'month', p_key, false); PERFORM tst.logout();
  RETURN (r ->> 'attemptId')::uuid; END $$;
-- an attempt row without the intent function (billing off cannot create one)
CREATE OR REPLACE FUNCTION tst.prow(p_user uuid, p_key text) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, blocks, market, currency, amount_minor)
  SELECT p_user, p_key, price_id, 0, market, currency, amount_minor FROM public.price_versions WHERE price_id = 'il_all_inclusive_month_p1'
  RETURNING attempt_id $$;
CREATE OR REPLACE FUNCTION tst.ppage(p_attempt uuid, p_user uuid, p_url text, p_req text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN PERFORM tst.psvc(); v := public.record_checkout_attempt_page_and_request(p_attempt, p_user, p_url, p_req); PERFORM tst.logout(); RETURN v; END $$;
CREATE OR REPLACE FUNCTION tst.ptargets(p_user uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v jsonb;
BEGIN PERFORM tst.psvc(); v := public.checkout_pull_targets(p_user); PERFORM tst.logout(); RETURN v; END $$;
CREATE OR REPLACE FUNCTION tst.ppull(p_attempt uuid, p_user uuid, p_ref text, p_amount int, p_currency text DEFAULT 'ILS') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.psvc(); r := public.record_checkout_pull(p_attempt, p_user, p_attempt, p_ref, p_amount, p_currency, repeat('d', 64)); PERFORM tst.logout(); RETURN r; END $$;
-- the provider's answer naming ANOTHER attempt id
CREATE OR REPLACE FUNCTION tst.ppullas(p_attempt uuid, p_user uuid, p_named uuid, p_ref text, p_amount int) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.psvc(); r := public.record_checkout_pull(p_attempt, p_user, p_named, p_ref, p_amount, 'ILS', repeat('d', 64)); PERFORM tst.logout(); RETURN r; END $$;
-- the PayPlus callback: subscription-authority wiring -> record_verified_provider_event (as service_role)
CREATE OR REPLACE FUNCTION tst.pcb(p_event text, p_attempt uuid, p_ref text, p_at timestamptz, p_amount int) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.psvc();
  r := public.record_verified_provider_event('payplus', p_event, 'payment_confirmed', p_attempt, p_ref, 'term-406', p_at, repeat('e', 64), p_amount, 'ILS');
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.ppaid(p_user uuid) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT paid_through FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.pactive(p_user uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT account_mode = 'paid' AND package_id = 'all_inclusive' AND subscription_status = 'active' FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.pdev(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  EXECUTE p_sql;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) SELECT tst.pu(n), format('p406-%s@synthetic.test', n) FROM generate_series(1, 9) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.pu(n), format('p406-%s@synthetic.test', n), format('Synthetic pull %s', n), 'Local', 'ILS', 'free', 'user', false
    FROM generate_series(1, 9) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.pu(n), 'IL', 'business_settings_country' FROM generate_series(1, 9) n;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.pu(n), 'free_10', NULL, 0 FROM generate_series(1, 9) n;

-- ---------------------------------------------------------------------------------------------------------------- billing off
DO $$
DECLARE a uuid; r jsonb;
BEGIN
  a := tst.prow(tst.pu(1), 'payplus-pull-user1-off');
  PERFORM tst.ok(tst.ppage(a, tst.pu(1), 'https://payments.payplus.co.il/off', tst.preq(1)) = 'https://payments.payplus.co.il/off',
    'P0 the page and its request id are kept with the attempt (no payment involved)');
  r := tst.ppull(a, tst.pu(1), 'rec-off', 3000);
  PERFORM tst.ok(r ->> 'code' = 'billing_off' AND NOT EXISTS (SELECT 1 FROM public.subscription_events WHERE attempt_id = a)
                 AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'pending',
    'P0b billing off (today): a pull writes nothing and the attempt stays pending');
END $$;

UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;

-- ---------------------------------------------------------------------------------------------------------------- the page + request id
DO $$
DECLARE a uuid; v text;
BEGIN
  a := tst.pintent(tst.pu(2), 'payplus-pull-user2-page');
  v := tst.ppage(a, tst.pu(2), 'https://payments.payplus.co.il/first', tst.preq(2)); -- before the read (AND has no evaluation order)
  PERFORM tst.ok(v = 'https://payments.payplus.co.il/first'
                 AND (SELECT provider_request_ref FROM public.checkout_attempts WHERE attempt_id = a) = tst.preq(2),
    'P1 the first page is kept with its request id');
  PERFORM tst.ok(tst.ppage(a, tst.pu(2), 'https://payments.payplus.co.il/second', tst.preq(3)) = 'https://payments.payplus.co.il/first'
                 AND (SELECT provider_request_ref FROM public.checkout_attempts WHERE attempt_id = a) = tst.preq(2),
    'P1b a second page never replaces it - and never its request id (they always belong together)');
  PERFORM tst.ok(tst.ppage(a, tst.pu(3), 'https://payments.payplus.co.il/x', tst.preq(4)) IS NULL, 'P1c another account never sets it');
  PERFORM tst.ok(tst.ppage(tst.pintent(tst.pu(3), 'payplus-pull-user3-bad'), tst.pu(3), 'https://payments.payplus.co.il/y', 'not-a-uuid') IS NULL
                 AND tst.ppage(tst.pintent(tst.pu(3), 'payplus-pull-user3-http'), tst.pu(3), 'http://payments.payplus.co.il/y', tst.preq(5)) IS NULL,
    'P1d a malformed request id or a non-https page is never stored');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- pull targets
DO $$
DECLARE t jsonb; a uuid; n int;
BEGIN
  t := tst.ptargets(tst.pu(2));
  PERFORM tst.ok(jsonb_array_length(t) = 1 AND t -> 0 ->> 'requestRef' = tst.preq(2) AND (t -> 0 ->> 'amountMinor')::int = 3000
                 AND t -> 0 ->> 'currency' = 'ILS', 'P2 the account''s pending attempt with a page is a pull target (request id, amount, currency)');
  PERFORM tst.ok(tst.ptargets(tst.pu(2)) = '[]'::jsonb, 'P2a asked again at once: nothing (each attempt at most once every 10 seconds)');
  PERFORM tst.pdev(format('UPDATE public.checkout_attempts SET provider_pulled_at = now() - interval %L WHERE user_id = %L', '11 seconds', tst.pu(2)));
  PERFORM tst.ok(jsonb_array_length(tst.ptargets(tst.pu(2))) = 1, 'P2a2 ... 10 seconds later it is a target again');
  PERFORM tst.ok(tst.ptargets(tst.pu(9)) = '[]'::jsonb, 'P2b an account without a page has no target');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tst.ptargets(tst.pu(3))) x WHERE x ->> 'requestRef' = tst.preq(2)),
    'P2c another account never sees it');
  FOR n IN 1..4 LOOP
    a := tst.pintent(tst.pu(9), format('payplus-pull-user9-many-%s', n));
    PERFORM tst.ppage(a, tst.pu(9), format('https://payments.payplus.co.il/m%s', n), format('c4060000-0000-4000-8000-%s', lpad(n::text, 12, '0')));
  END LOOP;
  PERFORM tst.ok(jsonb_array_length(tst.ptargets(tst.pu(9))) = 3, 'P2d 3 targets at most');
  PERFORM tst.pdev(format('UPDATE public.checkout_attempts SET provider_page_at = now() - interval %L WHERE user_id = %L', '25 hours', tst.pu(9)));
  PERFORM tst.ok(tst.ptargets(tst.pu(9)) = '[]'::jsonb, 'P2e a page older than 24 hours is no longer pulled');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- pull first, callback later
DO $$
DECLARE a uuid; r jsonb; pt timestamptz;
BEGIN
  a := (SELECT attempt_id FROM public.checkout_attempts WHERE idempotency_key = 'payplus-pull-user2-page');
  r := tst.ppull(a, tst.pu(2), 'rec-406-2', 3000);
  pt := tst.ppaid(tst.pu(2));
  PERFORM tst.ok(r ->> 'activated' = 'true' AND r ->> 'pulled' = 'true' AND tst.pactive(tst.pu(2))
                 AND pt = public.billing_period_end(now(), 'month')
                 AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'confirmed',
    'P3 a pull before any callback opens the package: one paid month from the pull, the attempt confirmed');
  PERFORM tst.ok((SELECT attempt_id = a AND first_event_id = 'pull:' || a::text FROM public.provider_standing_orders WHERE recurring_ref = 'rec-406-2'),
    'P3b the pulled standing order is bound to the attempt (a renewal is recognised even if no first callback ever arrives)');
  r := tst.ppull(a, tst.pu(2), 'rec-406-2', 3000);
  PERFORM tst.ok(r ->> 'pulled' = 'false' AND r ->> 'state' = 'confirmed' AND tst.ppaid(tst.pu(2)) = pt, 'P3c pulling again changes nothing');
  r := tst.pcb('tx-406-2-first', a, 'rec-406-2', now() - interval '2 minutes', 3000);
  PERFORM tst.ok(r ->> 'outcome' = 'stale' AND r ->> 'activated' = 'false' AND r ->> 'code' = 'first_charge_pulled' AND tst.ppaid(tst.pu(2)) = pt,
    'P4 the first charge''s callback arriving after its pull is the same payment: stale, the paid month is NOT doubled');
  r := tst.pcb('tx-406-2-first', a, 'rec-406-2', now() - interval '2 minutes', 3000);
  PERFORM tst.ok(r ->> 'duplicate' = 'true' AND tst.ppaid(tst.pu(2)) = pt, 'P4b ... its repeated delivery is a duplicate');
  -- a renewal a whole cycle later (the pull moved back 31 days, the device of the DB owner) still extends
  PERFORM tst.pdev(format('UPDATE public.subscription_events SET provider_event_time = provider_event_time - interval %L WHERE attempt_id = %L', '31 days', a));
  PERFORM tst.pdev(format('UPDATE public.subscriptions SET last_event_time = last_event_time - interval %L WHERE attempt_id = %L', '31 days', a));
  PERFORM tst.pdev(format('UPDATE public.account_entitlements SET paid_through = paid_through - interval %L WHERE user_id = %L', '31 days', tst.pu(2)));
  pt := tst.ppaid(tst.pu(2));
  r := tst.pcb('tx-406-2-renewal', NULL, 'rec-406-2', now() - interval '1 hour', 3000);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.ppaid(tst.pu(2)) > pt AND tst.ppaid(tst.pu(2)) > now(),
    'P5 a renewal a cycle later (standing-order id only) reaches the pulled attempt and extends the paid period');
END $$;

-- clock skew: the first charge's callback carries a time a minute AFTER the pull - still the same payment
DO $$
DECLARE a uuid; r jsonb; pt timestamptz;
BEGIN
  a := tst.pintent(tst.pu(3), 'payplus-pull-user3-skew');
  PERFORM tst.ppage(a, tst.pu(3), 'https://payments.payplus.co.il/skew', tst.preq(6));
  r := tst.ppull(a, tst.pu(3), 'rec-406-3', 3000);
  pt := tst.ppaid(tst.pu(3));
  r := tst.pcb('tx-406-3-first', a, 'rec-406-3', now() + interval '1 minute', 3000);
  PERFORM tst.ok(r ->> 'code' = 'first_charge_pulled' AND tst.ppaid(tst.pu(3)) = pt,
    'P4c a provider clock a minute ahead of ours never turns the first charge into a renewal');
  -- review 2026-10-21: a SECOND callback (another event id) within the window - its stale predecessor does not end the window
  r := tst.pcb('tx-406-3-second', a, 'rec-406-3', now() + interval '2 minutes', 3000);
  PERFORM tst.ok(r ->> 'code' = 'second_charge_after_pull' AND r ->> 'outcome' = 'stale' AND tst.ppaid(tst.pu(3)) = pt,
    'P4d a second callback within 7 days of the pull extends nothing and is reported (second_charge_after_pull)');
  r := tst.pcb('tx-406-3-low', a, 'rec-406-3', now() + interval '3 minutes', 100);
  PERFORM tst.ok(r ->> 'code' = 'amount_mismatch' AND r ->> 'outcome' = 'rejected' AND tst.ppaid(tst.pu(3)) = pt,
    'P4e a callback of another amount after the pull is never swallowed as the first charge: rejected, amount_mismatch');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- callback first, pull later
DO $$
DECLARE a uuid; r jsonb; pt timestamptz; n int;
BEGIN
  a := tst.pintent(tst.pu(4), 'payplus-pull-user4-cbfirst');
  PERFORM tst.ppage(a, tst.pu(4), 'https://payments.payplus.co.il/cb', tst.preq(7));
  r := tst.pcb('tx-406-4-first', a, 'rec-406-4', now() - interval '1 minute', 3000);
  pt := tst.ppaid(tst.pu(4));
  SELECT count(*) INTO n FROM public.subscription_events WHERE attempt_id = a;
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.ptargets(tst.pu(4)) = '[]'::jsonb, 'P6 the callback came first: the package is open, nothing left to pull');
  r := tst.ppull(a, tst.pu(4), 'rec-406-4', 3000);
  PERFORM tst.ok(r ->> 'pulled' = 'false' AND r ->> 'state' = 'confirmed' AND tst.ppaid(tst.pu(4)) = pt
                 AND (SELECT count(*) FROM public.subscription_events WHERE attempt_id = a) = n,
    'P6b ... a late pull of it writes nothing and extends nothing');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- wrong amount, refusals
DO $$
DECLARE a uuid; b uuid; r jsonb;
BEGIN
  a := tst.pintent(tst.pu(5), 'payplus-pull-user5-amount');
  PERFORM tst.ppage(a, tst.pu(5), 'https://payments.payplus.co.il/amount', tst.preq(8));
  r := tst.ppull(a, tst.pu(5), 'rec-406-5', 100);
  PERFORM tst.ok(r ->> 'code' = 'amount_mismatch' AND NOT coalesce(tst.pactive(tst.pu(5)), false)
                 AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'pending'
                 AND NOT EXISTS (SELECT 1 FROM public.provider_standing_orders WHERE recurring_ref = 'rec-406-5'),
    'P7 a pulled amount that differs from the attempt opens nothing and binds nothing');
  r := tst.pcb('tx-406-5-ok', a, 'rec-406-5', now() - interval '1 minute', 3000);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.ppaid(tst.pu(5)) = public.billing_period_end(now() - interval '1 minute', 'month'),
    'P7b ... the correct callback of the same attempt still opens the package, once');
  PERFORM tst.ok((tst.ppull(a, tst.pu(6), 'rec-406-x', 3000) ->> 'code') = 'unknown_attempt', 'P8 another account''s attempt is never pulled');
  b := tst.pintent(tst.pu(6), 'payplus-pull-user6-nopage');
  PERFORM tst.ok((tst.ppull(b, tst.pu(6), 'rec-406-6', 3000) ->> 'code') = 'unknown_attempt', 'P8b an attempt without a stored page request is never pulled');
  PERFORM tst.ppage(b, tst.pu(6), 'https://payments.payplus.co.il/six', tst.preq(9));
  PERFORM tst.ok((tst.ppull(b, tst.pu(6), 'rec-406-2', 3000) ->> 'code') = 'invalid_event'
                 AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = b) = 'pending',
    'P9 a standing order bound to another attempt is refused, nothing written');
  PERFORM tst.ok((tst.pcb('pull:' || b::text, b, NULL, now(), 3000) ->> 'code') = 'invalid_event'
                 AND NOT EXISTS (SELECT 1 FROM public.subscription_events WHERE provider_event_id = 'pull:' || b::text),
    'P10 a callback can never use the pull event id');
  PERFORM tst.ok((tst.ppull(b, tst.pu(6), NULL, 3000) ->> 'code') = 'invalid_event', 'P10b a pull without the standing-order id is refused');
  PERFORM tst.ok((tst.ppullas(b, tst.pu(6), a, 'rec-406-6', 3000) ->> 'code') = 'invalid_event'
                 AND (tst.ppullas(b, tst.pu(6), NULL, 'rec-406-6', 3000) ->> 'code') = 'invalid_event'
                 AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = b) = 'pending',
    'P10c an answer naming another attempt (or none) is refused in SQL too, nothing written');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- prepared never binds
UPDATE public.billing_activation SET phase = 'prepared', reason = 'TEST device' WHERE id;
DO $$
DECLARE a uuid; r jsonb;
BEGIN
  a := tst.pintent(tst.pu(7), 'payplus-pull-user7-prepared');
  PERFORM tst.ppage(a, tst.pu(7), 'https://payments.payplus.co.il/prep', 'd4060000-0000-4000-8000-000000000001');
  r := tst.ppull(a, tst.pu(7), 'rec-406-7', 3000);
  PERFORM tst.ok(r ->> 'activated' = 'false' AND r ->> 'code' = 'billing_not_enforced' AND r ->> 'outcome' = 'applied'
                 AND NOT EXISTS (SELECT 1 FROM public.provider_standing_orders WHERE recurring_ref = 'rec-406-7'),
    'P11 prepared (TEST): the pull is recorded, opens nothing and binds nothing');
  r := tst.pcb('tx-406-7-first', a, 'rec-406-7', now() - interval '1 minute', 3000);
  PERFORM tst.ok(r ->> 'code' = 'first_charge_pulled' AND NOT EXISTS (SELECT 1 FROM public.provider_standing_orders WHERE recurring_ref = 'rec-406-7'),
    'P11b ... its first callback is the same payment and binds nothing either');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- who may call
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.record_checkout_pull(uuid,uuid,uuid,text,integer,text,text)', 'execute')
              AND NOT has_function_privilege('anon', 'public.record_checkout_pull(uuid,uuid,uuid,text,integer,text,text)', 'execute')
              AND NOT has_function_privilege('authenticated', 'public.checkout_pull_targets(uuid)', 'execute')
              AND NOT has_function_privilege('authenticated', 'public.record_checkout_attempt_page_and_request(uuid,uuid,text,text)', 'execute')
              AND has_function_privilege('service_role', 'public.record_checkout_pull(uuid,uuid,uuid,text,integer,text,text)', 'execute')
              AND has_function_privilege('service_role', 'public.checkout_pull_targets(uuid)', 'execute')
              AND has_function_privilege('service_role', 'public.record_checkout_attempt_page_and_request(uuid,uuid,text,text)', 'execute'),
  'P12 only service_role (the Edge function) pulls, lists targets or stores a page request');

ROLLBACK;
