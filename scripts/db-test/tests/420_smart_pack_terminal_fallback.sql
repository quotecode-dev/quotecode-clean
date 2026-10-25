-- Owner console 2026-10-25 (typed: "מאשר: מזהה המסוף כסוד, תיקון הצעת חכם פלוס והתחלת השורה במסד ..."): 20261025400000. Disposable
-- postgres:17 harness ONLY. ONE transaction, rolled back. Proves: a package activated by the server PULL (its standing order has no
-- terminal - exactly the first real subscription) gets a SMART PACK quote, and the line begin hands the Edge function a null terminal
-- (it uses the account terminal then); an account without any standing order still gets none.
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.tu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4200000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.tsq(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  EXECUTE p_sql INTO r; PERFORM tst.logout(); RETURN r;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) SELECT tst.tu(n), format('t420-%s@synthetic.test', n) FROM generate_series(1, 2) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.tu(n), format('t420-%s@synthetic.test', n), format('Synthetic terminal %s', n), 'Local', 'ILS', 'free', 'user', false
    FROM generate_series(1, 2) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.tu(n), 'IL', 'business_settings_country' FROM generate_series(1, 2) n
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.tu(n), 'free_10', NULL, 0 FROM generate_series(1, 2) n ON CONFLICT (user_id) DO NOTHING;
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: synthetic terminal fallback proof' WHERE id;

-- user 1: activated by the server PULL (the standing order is bound with NO terminal); user 2: a callback without a standing order id
DO $$
DECLARE a uuid;
BEGIN
  a := (tst.tsq(format('SELECT public.create_package_checkout_intent(%L, ''month'', ''pkg-420-user-1-000000'', false)', tst.tu(1))) ->> 'attemptId')::uuid;
  PERFORM tst.tsq(format($f$SELECT to_jsonb(public.record_checkout_attempt_page_and_request(%L, %L, 'https://payments.payplus.co.il/p420', '1a2aee2e-0000-4000-8000-000000000420'))$f$, a, tst.tu(1)));
  PERFORM tst.tsq(format($f$SELECT public.record_checkout_pull(%L, %L, %L, 'rec-420-1', 3000, 'ILS', %L)$f$, a, tst.tu(1), a, repeat('a', 64)));
  a := (tst.tsq(format('SELECT public.create_package_checkout_intent(%L, ''month'', ''pkg-420-user-2-000000'', false)', tst.tu(2))) ->> 'attemptId')::uuid;
  PERFORM tst.tsq(format($f$SELECT to_jsonb(public.record_checkout_attempt_page_and_request(%L, %L, 'https://payments.payplus.co.il/p421', '1a2aee2e-0000-4000-8000-000000000421'))$f$, a, tst.tu(2)));
  PERFORM tst.tsq(format($f$SELECT public.record_verified_provider_event('payplus', 'tx-420-2', 'payment_confirmed', %L, NULL, NULL, now() - interval '1 day', %L, 3000, 'ILS')$f$, a, repeat('b', 64)));
END $$;

SELECT tst.ok((SELECT count(*) = 1 AND bool_and(terminal_ref IS NULL) FROM public.provider_standing_orders s
                JOIN public.account_entitlements e ON e.live_attempt_id = s.attempt_id WHERE e.user_id = tst.tu(1))
              AND (SELECT subscription_status = 'active' FROM public.account_entitlements WHERE user_id = tst.tu(1)),
  'T1 setup: a pulled activation - a live package whose standing order has no terminal (the first real subscription)');
CREATE TEMP TABLE q420 AS SELECT tst.tsq(format('SELECT public.smart_pack_add_on_quote(%L)', tst.tu(1))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND (r ->> 'recurringMinor')::int = 1000 FROM q420),
  'T2 it gets a SMART PACK quote (its terminal is no longer required)');
SELECT tst.ok(tst.tsq(format('SELECT public.smart_pack_add_on_quote(%L)', tst.tu(2))) ->> 'code' = 'not_eligible',
  'T3 a package with no standing order at all still gets none');
CREATE TEMP TABLE i420 AS SELECT tst.tsq(format('SELECT public.create_smart_pack_add_on_intent(%L, ''sp-420-click-00000001'')', tst.tu(1))) AS r;
SELECT tst.tsq(format($f$SELECT public.record_smart_pack_add_on_payment('payplus', 'tx-420-sp', 'payment_confirmed', %L, now(), %L, %s, 'ILS')$f$,
  (SELECT r ->> 'addOnId' FROM i420), repeat('c', 64), (SELECT r ->> 'amountMinor' FROM i420)));
CREATE TEMP TABLE b420 AS SELECT tst.tsq(format('SELECT public.smart_pack_add_on_line_begin(%L)', (SELECT r ->> 'addOnId' FROM i420))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'recurringRef' = 'rec-420-1' AND r -> 'terminalRef' = 'null'::jsonb FROM b420),
  'T4 the line begin hands over the standing order with a null terminal (the function uses the account terminal)');

ROLLBACK;
