-- Owner console 2026-10-25 ("ב: חיוב יחסי עכשיו"): 20261025300000_smart_pack_mid_period_add_on. Disposable postgres:17 harness ONLY.
-- ONE transaction, rolled back. Proves: only a live Israeli package without SMART PACK gets a quote; the amount = the SMART PACK price
-- x the Israel days left / the days of the paid period; one row per click (idempotency key); the page is kept once; a wrong amount and
-- a duplicate change nothing; the verified payment gives SMART PACK to the period end and expires the other unpaid pages; the line is
-- marked BEFORE PayPlus is asked and only a changed standing order makes the package attempt carry it - its next renewal of package +
-- SMART PACK then extends the package; the refund preview of the period paid before the line counts the package only; service role only.
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.su(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4190000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.ssvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
-- runs one call as the service role (the Edge function's identity)
CREATE OR REPLACE FUNCTION tst.sq(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.ssvc(); EXECUTE p_sql INTO r; PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.sdev(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  EXECUTE p_sql;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- 1 and 5 a live monthly package (standing order bound) | 2 Free | 3 a package bought WITH SMART PACK | 4 a LIFETIME account
INSERT INTO auth.users (id, email) SELECT tst.su(n), format('s419-%s@synthetic.test', n) FROM generate_series(1, 5) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.su(n), format('s419-%s@synthetic.test', n), format('Synthetic SMART PACK %s', n), 'Local', 'ILS', 'free', 'user', n = 4
    FROM generate_series(1, 5) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.su(n), 'IL', 'business_settings_country' FROM generate_series(1, 5) n
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.su(n), 'free_10', NULL, 0 FROM generate_series(1, 5) n ON CONFLICT (user_id) DO NOTHING;

SELECT tst.ok(tst.sq(format('SELECT public.smart_pack_add_on_quote(%L)', tst.su(1))) ->> 'code' = 'checkout_unavailable',
  'S0 billing off: no quote');
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: synthetic SMART PACK add-on proof' WHERE id;
-- SMART PACK is decided only while the plan system is enforced (smart_pack_state)
SELECT tst.sdev($f$UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue'$f$);

DO $$
DECLARE a uuid;
BEGIN
  FOR n IN 1..5 LOOP
    CONTINUE WHEN n = 4;
    a := (tst.sq(format('SELECT public.create_package_checkout_intent(%L, ''month'', %L, %L)', tst.su(n), format('pkg-419-user-%s-000000', n), n = 3)) ->> 'attemptId')::uuid;
    IF n <> 2 THEN
      PERFORM tst.sq(format($f$SELECT public.record_verified_provider_event('payplus', %L, 'payment_confirmed', %L, %L, 'term-419', %L, %L, %s, 'ILS')$f$,
        format('tx-419-%s', n), a, format('rec-419-%s', n), now() - interval '5 days', repeat('e', 64), CASE WHEN n = 3 THEN 4000 ELSE 3000 END));
    END IF;
  END LOOP;
END $$;
-- the package page request id (kept with the page by the real flow) - the line reads the standing order by it
SELECT tst.sdev(format($f$UPDATE public.checkout_attempts SET provider_request_ref = '1a2aee2e-0000-4000-8000-000000000419' WHERE user_id = %L$f$, tst.su(1)));
SELECT tst.sdev(format($f$UPDATE public.checkout_attempts SET provider_request_ref = '1a2aee2e-0000-4000-8000-000000000519' WHERE user_id = %L$f$, tst.su(5)));

SELECT tst.ok((SELECT subscription_status = 'active' AND NOT smart_pack_line FROM public.account_entitlements WHERE user_id = tst.su(1)),
  'S1 setup: account 1 holds a live monthly package without SMART PACK');

-- the quote
CREATE TEMP TABLE q419 AS SELECT tst.sq(format('SELECT public.smart_pack_add_on_quote(%L)', tst.su(1))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'currency' = 'ILS' AND (r ->> 'recurringMinor')::int = 1000 AND r ->> 'period' = 'month'
                 AND (r ->> 'periodEnd')::timestamptz = (SELECT paid_through FROM public.account_entitlements WHERE user_id = tst.su(1)) FROM q419),
  'S2 a live package gets a quote: SMART PACK 10.00 ILS a month, to the end of its paid period');
SELECT tst.ok((SELECT (r ->> 'amountMinor')::int = greatest(100, (round(1000::numeric
                   * ((e.paid_through AT TIME ZONE 'Asia/Jerusalem')::date - (now() AT TIME ZONE 'Asia/Jerusalem')::date)
                   / ((e.paid_through AT TIME ZONE 'Asia/Jerusalem')::date - ((now() - interval '5 days') AT TIME ZONE 'Asia/Jerusalem')::date) / 100) * 100)::int)
                 AND (r ->> 'amountMinor')::int % 100 = 0
                 FROM q419, public.account_entitlements e WHERE e.user_id = tst.su(1)),
  'S3 the amount = 10.00 x the Israel days left / the days of the paid period, a whole shekel (IRON-ILS-001)');
SELECT tst.ok(tst.sq(format('SELECT public.smart_pack_add_on_quote(%L)', tst.su(2))) ->> 'code' = 'not_eligible'
              AND tst.sq(format('SELECT public.smart_pack_add_on_quote(%L)', tst.su(3))) ->> 'code' = 'already_included'
              AND tst.sq(format('SELECT public.smart_pack_add_on_quote(%L)', tst.su(4))) ->> 'code' = 'not_eligible',
  'S4 no quote for Free, for a package that already has SMART PACK, for LIFETIME');

-- the page
CREATE TEMP TABLE i419 AS SELECT tst.sq(format('SELECT public.create_smart_pack_add_on_intent(%L, ''sp-419-click-00000001'')', tst.su(1))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'state' = 'pending' AND (r ->> 'amountMinor')::int = (SELECT (q.r ->> 'amountMinor')::int FROM q419 q) FROM i419)
              AND (SELECT tst.sq(format('SELECT public.create_smart_pack_add_on_intent(%L, ''sp-419-click-00000001'')', tst.su(1))) ->> 'addOnId') = (SELECT r ->> 'addOnId' FROM i419),
  'S5 one row per click: the same key answers the same add-on, with the quoted amount');
CREATE TEMP TABLE pg1 AS SELECT tst.sq(format($f$SELECT to_jsonb(public.record_smart_pack_add_on_page(%L, %L, 'https://payments.payplus.co.il/first', '1a2aee2e-0000-4000-8000-0000000004a1'))$f$,
  (SELECT r ->> 'addOnId' FROM i419), tst.su(1))) #>> '{}' AS v;
CREATE TEMP TABLE pg2 AS SELECT tst.sq(format($f$SELECT to_jsonb(public.record_smart_pack_add_on_page(%L, %L, 'https://payments.payplus.co.il/second', NULL))$f$,
  (SELECT r ->> 'addOnId' FROM i419), tst.su(1))) #>> '{}' AS v;
SELECT tst.ok((SELECT v FROM pg1) = 'https://payments.payplus.co.il/first' AND (SELECT v FROM pg2) = 'https://payments.payplus.co.il/first'
              AND (SELECT provider_request_ref = '1a2aee2e-0000-4000-8000-0000000004a1' FROM public.smart_pack_add_ons WHERE add_on_id = (SELECT (r ->> 'addOnId')::uuid FROM i419)),
  'S6 the page is kept once with its request id; a second page never replaces it');

-- the payment
-- (each action runs in its own statement, the check in the next: one statement's parts run in no promised order)
CREATE TEMP TABLE w419 AS SELECT tst.sq(format($f$SELECT public.record_smart_pack_add_on_payment('payplus', 'tx-419-sp-wrong', 'payment_confirmed', %L, now(), %L, 1, 'ILS')$f$,
  (SELECT r ->> 'addOnId' FROM i419), repeat('a', 64))) AS r;
SELECT tst.ok((SELECT r ->> 'code' = 'amount_mismatch' FROM w419)
              AND (SELECT state = 'pending' FROM public.smart_pack_add_ons WHERE add_on_id = (SELECT (r ->> 'addOnId')::uuid FROM i419)),
  'S7 a wrong amount is recorded rejected and changes nothing');
CREATE TEMP TABLE k419 AS SELECT tst.sq(format('SELECT public.create_smart_pack_add_on_intent(%L, ''sp-419-click-00000002'')', tst.su(1))) AS r;
CREATE TEMP TABLE p419 AS SELECT tst.sq(format($f$SELECT public.record_smart_pack_add_on_payment('payplus', 'tx-419-sp-paid', 'payment_confirmed', %L, now(), %L, %s, 'ILS')$f$,
  (SELECT r ->> 'addOnId' FROM i419), repeat('b', 64), (SELECT r ->> 'amountMinor' FROM i419))) AS r;
SELECT tst.ok((SELECT (r ->> 'activated')::boolean AND (r ->> 'lineNeeded')::boolean FROM p419)
              AND (SELECT smart_pack_until = paid_through AND NOT smart_pack_line FROM public.account_entitlements WHERE user_id = tst.su(1))
              AND (public.smart_pack_state(tst.su(1)) ->> 'active')::boolean,
  'S8 the verified payment gives SMART PACK to the period end (active now; the line not yet)');
SELECT tst.ok((SELECT r ->> 'addOnId' FROM k419) = (SELECT r ->> 'addOnId' FROM i419)
              AND (SELECT count(*) = 1 FROM public.smart_pack_add_ons WHERE user_id = tst.su(1)),
  'S9 one payable page per account: a second click gets the open page');
CREATE TEMP TABLE d419 AS SELECT tst.sq(format($f$SELECT public.record_smart_pack_add_on_payment('payplus', 'tx-419-sp-paid', 'payment_confirmed', %L, now(), %L, %s, 'ILS')$f$,
  (SELECT r ->> 'addOnId' FROM i419), repeat('b', 64), (SELECT r ->> 'amountMinor' FROM i419))) AS r;
SELECT tst.ok((SELECT (r ->> 'duplicate')::boolean FROM d419)
              AND tst.sq(format('SELECT public.smart_pack_add_on_quote(%L)', tst.su(1))) ->> 'code' = 'already_included',
  'S10 the same event again is a duplicate; no second quote while SMART PACK runs');

-- the line
CREATE TEMP TABLE b419 AS SELECT tst.sq(format('SELECT public.smart_pack_add_on_line_begin(%L)', (SELECT r ->> 'addOnId' FROM i419))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'recurringRef' = 'rec-419-1' AND r ->> 'terminalRef' = 'term-419' AND (r ->> 'packageAmountMinor')::int = 3000
                 AND (r ->> 'addOnAmountMinor')::int = 1000 AND r ->> 'packageRequestRef' = '1a2aee2e-0000-4000-8000-000000000419'
                 AND r ->> 'nextChargeDate' = to_char((SELECT (paid_through AT TIME ZONE 'Asia/Jerusalem')::date FROM public.account_entitlements WHERE user_id = tst.su(1)), 'YYYY-MM-DD')
                 FROM b419)
              AND (SELECT line_state = 'requested' FROM public.smart_pack_add_ons WHERE add_on_id = (SELECT (r ->> 'addOnId')::uuid FROM i419)),
  'S11 begin: marked requested BEFORE PayPlus; the standing order, its terminal, both amounts and the next charge date');
CREATE TEMP TABLE f419 AS SELECT tst.sq(format('SELECT public.smart_pack_add_on_line_finish(%L, true)', (SELECT r ->> 'addOnId' FROM i419))) AS r;
CREATE TEMP TABLE g419 AS SELECT tst.sq(format('SELECT public.smart_pack_add_on_line_finish(%L, false)', (SELECT r ->> 'addOnId' FROM i419))) AS r;
SELECT tst.ok((SELECT r ->> 'lineState' = 'added' FROM f419) AND (SELECT NOT (r ->> 'changed')::boolean AND r ->> 'lineState' = 'added' FROM g419)
              AND (SELECT amount_minor = 4000 AND add_on_price_id = 'il_smart_pack_month_p1' FROM public.checkout_attempts
                    WHERE attempt_id = (SELECT live_attempt_id FROM public.account_entitlements WHERE user_id = tst.su(1)))
              AND (SELECT smart_pack_line FROM public.account_entitlements WHERE user_id = tst.su(1)),
  'S12 finish(added): the package attempt carries package + SMART PACK and the line; a second finish changes nothing');
SELECT tst.ok((SELECT (r ->> 'paidMinor')::int = 3000 FROM (SELECT tst.sq(format('SELECT public.billing_admin_preview(%L, false)', tst.su(1))) AS r) x),
  'S13 the refund preview of the period paid before the line counts the package only (30.00)');
CREATE TEMP TABLE n419 AS SELECT tst.sq(format($f$SELECT public.record_verified_provider_event('payplus', 'tx-419-renewal', 'payment_confirmed', NULL, 'rec-419-1', 'term-419', now(), %L, 4000, 'ILS')$f$,
  repeat('c', 64))) AS r;
SELECT tst.ok((SELECT (r ->> 'activated')::boolean FROM n419)
              AND (SELECT smart_pack_line AND paid_through > now() + interval '40 days' FROM public.account_entitlements WHERE user_id = tst.su(1)),
  'S14 the next renewal of package + SMART PACK (40.00) extends the package and keeps SMART PACK');

-- refused / pulled / privileges
SELECT tst.ok(tst.sq(format('SELECT public.record_smart_pack_add_on_pull(%L, %L, %L, 667, ''ILS'', %L)', (SELECT r ->> 'addOnId' FROM i419), tst.su(1),
                 tst.su(9), repeat('d', 64))) ->> 'code' = 'invalid_event',
  'S15 a pull answer naming another add-on is refused');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.smart_pack_add_on_quote(uuid)', 'execute')
              AND NOT has_function_privilege('authenticated', 'public.create_smart_pack_add_on_intent(uuid,text)', 'execute')
              AND NOT has_function_privilege('anon', 'public.record_smart_pack_add_on_payment(text,text,text,uuid,timestamptz,text,integer,text)', 'execute')
              AND NOT has_function_privilege('authenticated', 'public.smart_pack_add_on_line_finish(uuid,boolean)', 'execute')
              AND NOT has_table_privilege('authenticated', 'public.smart_pack_add_ons', 'select'),
  'S16 none of it is callable or readable by a user');

-- a lost PayPlus answer: the line stays 'requested'; the renewal of package + SMART PACK finishes it and extends the package
CREATE TEMP TABLE i519 AS SELECT tst.sq(format('SELECT public.create_smart_pack_add_on_intent(%L, ''sp-519-click-00000001'')', tst.su(5))) AS r;
SELECT tst.sq(format($f$SELECT public.record_smart_pack_add_on_payment('payplus', 'tx-519-sp-paid', 'payment_confirmed', %L, now(), %L, %s, 'ILS')$f$,
  (SELECT r ->> 'addOnId' FROM i519), repeat('5', 64), (SELECT r ->> 'amountMinor' FROM i519)));
SELECT tst.sq(format('SELECT public.smart_pack_add_on_line_begin(%L)', (SELECT r ->> 'addOnId' FROM i519)));
CREATE TEMP TABLE n519 AS SELECT tst.sq(format($f$SELECT public.record_verified_provider_event('payplus', 'tx-519-renewal', 'payment_confirmed', NULL, 'rec-419-5', 'term-419', now(), %L, 4000, 'ILS')$f$,
  repeat('6', 64))) AS r;
SELECT tst.ok((SELECT (r ->> 'activated')::boolean FROM n519)
              AND (SELECT line_state = 'added' FROM public.smart_pack_add_ons WHERE add_on_id = (SELECT (r ->> 'addOnId')::uuid FROM i519))
              AND (SELECT smart_pack_line AND paid_through > now() + interval '40 days' FROM public.account_entitlements WHERE user_id = tst.su(5)),
  'S17 a lost PayPlus answer never rejects the renewal: package + SMART PACK finishes the line and extends the package');

-- a page paid after its package stopped gives nothing
SELECT tst.sdev(format($f$UPDATE public.account_entitlements SET renewal_stopped_at = now() WHERE user_id = %L$f$, tst.su(5)));
SELECT tst.ok(tst.sq(format($f$SELECT public.record_smart_pack_add_on_payment('payplus', 'tx-519-sp-late', 'payment_confirmed', %L, now(), %L, %s, 'ILS')$f$,
                 (SELECT r ->> 'addOnId' FROM i519), repeat('7', 64), (SELECT r ->> 'amountMinor' FROM i519))) ->> 'code' IN ('second_charge', 'attempt_not_payable'),
  'S18 a second payment of a paid page changes nothing (reported)');
ROLLBACK;
