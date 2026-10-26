-- Owner console 2026-10-26 (typed: "מאשר את התוכנית א עד ז בשחרור אחד ...", item א2): 20261026100000. Disposable postgres:17 harness
-- ONLY. ONE transaction, rolled back. Proves: a paid in-period SMART PACK whose line was refused ('not_added') is re-opened by the
-- migration statement and its line can begin again; an add-on outside its period / of an account that already has the line stays.
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.tu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4210000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.tsq(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  EXECUTE p_sql INTO r; PERFORM tst.logout(); RETURN r;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) SELECT tst.tu(n), format('t421-%s@synthetic.test', n) FROM generate_series(1, 2) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.tu(n), format('t421-%s@synthetic.test', n), format('Synthetic reopen %s', n), 'Local', 'ILS', 'free', 'user', false
    FROM generate_series(1, 2) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.tu(n), 'IL', 'business_settings_country' FROM generate_series(1, 2) n
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.tu(n), 'free_10', NULL, 0 FROM generate_series(1, 2) n ON CONFLICT (user_id) DO NOTHING;
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: synthetic line reopen proof' WHERE id;

-- both users: a package activated by the server PULL, then a paid SMART PACK add-on
DO $$
DECLARE a uuid; n int;
BEGIN
  FOR n IN 1..2 LOOP
    a := (tst.tsq(format('SELECT public.create_package_checkout_intent(%L, ''month'', ''pkg-421-user-%s-00000'', false)', tst.tu(n), n)) ->> 'attemptId')::uuid;
    PERFORM tst.tsq(format($f$SELECT to_jsonb(public.record_checkout_attempt_page_and_request(%L, %L, 'https://payments.payplus.co.il/p421', %L))$f$,
      a, tst.tu(n), format('1a2aee2e-0000-4000-8000-00000000042%s', n)));
    PERFORM tst.tsq(format($f$SELECT public.record_checkout_pull(%L, %L, %L, %L, 3000, 'ILS', %L)$f$, a, tst.tu(n), a, format('rec-421-%s', n), repeat(n::text, 64)));
  END LOOP;
END $$;
CREATE TEMP TABLE i421 AS SELECT n, tst.tsq(format('SELECT public.create_smart_pack_add_on_intent(%L, %L)', tst.tu(n), format('sp-421-click-0000000%s', n))) AS r
  FROM generate_series(1, 2) n;
SELECT tst.tsq(format($f$SELECT public.record_smart_pack_add_on_payment('payplus', %L, 'payment_confirmed', %L, now(), %L, %s, 'ILS')$f$,
  format('tx-421-sp-%s', n), r ->> 'addOnId', repeat('c', 64), r ->> 'amountMinor')) FROM i421;
-- both lines refused (as on 2026-10-25); user 2's add-on is then moved out of its period
UPDATE public.smart_pack_add_ons SET line_state = 'not_added', line_at = now() WHERE user_id IN (tst.tu(1), tst.tu(2));
UPDATE public.smart_pack_add_ons SET period_end = now() - interval '1 day' WHERE user_id = tst.tu(2);

SELECT tst.ok((SELECT count(*) = 2 AND bool_and(state = 'paid' AND line_state = 'not_added') FROM public.smart_pack_add_ons WHERE user_id IN (tst.tu(1), tst.tu(2))),
  'T1 setup: two paid add-ons whose line was refused');
SELECT tst.ok(tst.tsq(format('SELECT public.smart_pack_add_on_line_begin(%L)', (SELECT r ->> 'addOnId' FROM i421 WHERE n = 1))) ->> 'code' = 'line_not_open',
  'T2 before the migration a refused line cannot begin again');

-- the migration statement (20261026100000), verbatim
UPDATE public.smart_pack_add_ons a
   SET line_state = NULL, line_at = NULL
 WHERE a.state = 'paid'
   AND a.line_state = 'not_added'
   AND a.period_end > now()
   AND EXISTS (SELECT 1 FROM public.account_entitlements e
                WHERE e.user_id = a.user_id AND e.live_attempt_id = a.package_attempt_id AND e.smart_pack_line = false);

SELECT tst.ok((SELECT line_state IS NULL AND line_at IS NULL FROM public.smart_pack_add_ons WHERE user_id = tst.tu(1)),
  'T3 the in-period refused line is re-opened');
SELECT tst.ok((SELECT line_state = 'not_added' FROM public.smart_pack_add_ons WHERE user_id = tst.tu(2)),
  'T4 an add-on outside its period stays refused');
SELECT tst.ok(tst.tsq(format('SELECT public.smart_pack_add_on_line_targets(%L)', tst.tu(1))) = jsonb_build_array((SELECT r ->> 'addOnId' FROM i421 WHERE n = 1)),
  'T5 the re-opened add-on is a line target of the next checkout status call');
SELECT tst.ok((tst.tsq(format('SELECT public.smart_pack_add_on_line_begin(%L)', (SELECT r ->> 'addOnId' FROM i421 WHERE n = 1))) ->> 'ok')::boolean,
  'T6 and its line begins again');

ROLLBACK;
