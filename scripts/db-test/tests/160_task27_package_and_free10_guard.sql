-- Task 27: all-inclusive package rows / entitlements / summary / package checkout intent and the Free-10 creation guard
-- (20261011100000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back at the end. Phase rows written directly by the DB
-- owner and the replica-mode ledger fixture are test devices (as in 120_subscriptions_crosscut.sql).
BEGIN;
SET tekango.skip_signup_provisioning = 'on';  -- pre-A-1 fixture: this test seeds its entitlements by hand (20261018100000 test device)

CREATE OR REPLACE FUNCTION tst.pu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('ea000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.pq(a int, n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('eb000000-0000-4000-80%s-%s', lpad(a::text, 2, '0'), lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.psvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------- 1. prices
DO $$
DECLARE c jsonb;
BEGIN
  -- 20261021400000 (Owner 2026-10-20): the SMART PACK add-on rows are current too (proved in test 403); the package keeps exactly four
  PERFORM tst.ok((SELECT count(*) FROM public.price_versions WHERE offer = 'current' AND plan_id = 'all_inclusive') = 4
                 AND (SELECT count(*) FROM public.price_versions WHERE offer = 'current') = 8,
                 'P1 exactly four current package rows (2 markets x 2 periods) + four SMART PACK add-on rows');
  PERFORM tst.ok((SELECT count(*) FROM public.price_versions WHERE offer = 'legacy') = 8, 'P2 the eight OD-03..OD-08 rows are kept, as legacy');
  PERFORM tst.ok((SELECT string_agg(market || ':' || billing_period || ':' || amount_minor || ':' || currency || ':' || tax_mode, ',' ORDER BY market, billing_period)
                    FROM public.price_versions WHERE plan_id = 'all_inclusive')
                 = 'IL:month:3000:ILS:included,IL:year:30600:ILS:included,INTERNATIONAL:month:1800:USD:not_decided,INTERNATIONAL:year:18400:USD:not_decided',
                 'P3 package amounts = §249 + the Owner amendment (IL 30 / 306 incl. VAT; INTERNATIONAL 18 / 184 USD)');
  c := public.get_price_catalog('INTERNATIONAL');
  PERFORM tst.ok((SELECT count(*) FROM jsonb_array_elements(c -> 'prices') p WHERE p ->> 'offer' = 'current' AND p ->> 'planId' = 'all_inclusive') = 2,
                 'P4 the public catalog view states the offer class');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.get_price_catalog('IL') -> 'prices') p WHERE p ->> 'currency' <> 'ILS'),
                 'P5 IL catalog is ILS only');
END $$;
SELECT tst.throws($$ UPDATE public.price_versions SET amount_minor = 18360 WHERE price_id = 'intl_all_inclusive_year_p2' $$, 'append-only', 'P6 package rows are immutable too');
SELECT tst.throws($$ UPDATE public.price_versions SET offer = 'current' WHERE price_id = 'il_classic_month_v1' $$, 'append-only', 'P7 a legacy row cannot be re-offered');
SELECT tst.throws($$ INSERT INTO public.price_versions (price_id, plan_id, market, currency, billing_period, amount_minor, tax_mode, approved_ref, offer)
                     VALUES ('il_classic_year_x', 'classic', 'IL', 'ILS', 'year', 100, 'included', 'OD-03', 'legacy') $$, 'billing_period_check',
                  'P8 a year row exists only for the package');
SELECT tst.throws($$ INSERT INTO public.price_versions (price_id, plan_id, market, currency, billing_period, amount_minor, tax_mode, approved_ref, offer)
                     VALUES ('il_visual_month_x', 'visual', 'IL', 'ILS', 'month', 100, 'included', 'OD-03', 'current') $$, 'offer_shape',
                  'P9 a style plan can never be a current offer (styles are not subscriptions)');

-- ---------------------------------------------------------------------------------------------------------------- 2. fixtures
-- 1 F free exhausted (10 counted outputs) | 2 G free with remaining | 3 L legacy paid classic | 4 K package annual INTERNATIONAL | 5 N unprovisioned
-- 6 I INTERNATIONAL without a subscription (PayPlus phase 1, 20261021000000: an active package gets no second payment page)
INSERT INTO auth.users (id, email) SELECT tst.pu(i), format('pkg-%s@synthetic.test', i) FROM generate_series(1, 6) i ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role)
  SELECT tst.pu(i), format('pkg-%s@synthetic.test', i), format('Synthetic Pkg %s', i), CASE WHEN i IN (4, 6) THEN 'International' ELSE 'Local' END,
         CASE WHEN i IN (4, 6) THEN 'USD' ELSE 'ILS' END, 'free', 'user' FROM generate_series(1, 6) i ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.quotes (id, user_id, quote_number, status) SELECT tst.pq(1, n), tst.pu(1), 91000 + n, 'draft' FROM generate_series(1, 11) n;
INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (tst.pq(2, 1), tst.pu(2), 92001, 'draft');
DO $$
BEGIN
  SET LOCAL session_replication_role = replica; -- test device: ten counted first outputs for F without the snapshot pipeline
  INSERT INTO public.quote_issue_ledger (attempt_id, user_id, quote_id, first_output_channel, idempotency_key, counted_against_free, account_mode_at_event,
                                         customer_binding, content_digest, issuer_digest, presentation_digest, snapshot_path, snapshot_sha256, snapshot_bytes, snapshot_schema_version)
    SELECT gen_random_uuid(), tst.pu(1), tst.pq(1, n), 'send', format('out:%s:send', tst.pq(1, n)), true, 'free_10', 'synthetic', repeat('a', 64), repeat('b', 64),
           repeat('c', 64), format('synthetic/%s', n), repeat('d', 64), 100, 1 FROM generate_series(1, 10) n;
  SET LOCAL session_replication_role = origin;
END $$;
INSERT INTO public.account_entitlements (user_id, account_mode, free_issues_consumed) VALUES (tst.pu(1), 'free_10', 10), (tst.pu(2), 'free_10', 0);
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, subscription_status) VALUES (tst.pu(3), 'paid', 'classic', 'active');
INSERT INTO public.account_entitlements (user_id, account_mode, package_id, package_period, subscription_status) VALUES (tst.pu(4), 'paid', 'all_inclusive', 'year', 'active');
INSERT INTO public.account_market (user_id, market, source) VALUES (tst.pu(1), 'IL', 'owner_mapping'), (tst.pu(2), 'IL', 'owner_mapping'),
  (tst.pu(3), 'IL', 'owner_mapping'), (tst.pu(4), 'INTERNATIONAL', 'owner_mapping'), (tst.pu(6), 'INTERNATIONAL', 'owner_mapping');

SELECT tst.throws($$ INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, package_id, package_period) VALUES (tst.pu(5), 'paid', 'modern', 'all_inclusive', 'month') $$,
                  'mode_shape', 'E1 a paid account holds a legacy style plan OR the package, never both');
SELECT tst.throws($$ INSERT INTO public.account_entitlements (user_id, account_mode, package_id) VALUES (tst.pu(5), 'paid', 'all_inclusive') $$,
                  'mode_shape', 'E2 the package needs its billing period');
SELECT tst.throws($$ INSERT INTO public.account_entitlements (user_id, account_mode, package_id, package_period) VALUES (tst.pu(5), 'free_10', 'all_inclusive', 'month') $$,
                  'mode_shape', 'E3 a Free account holds no package');
SELECT tst.throws($$ INSERT INTO public.account_entitlements (user_id, account_mode, package_id, package_period) VALUES (tst.pu(5), 'paid', 'all_inclusive', 'week') $$,
                  'mode_shape|package_values', 'E4 only month / year');

-- ---------------------------------------------------------------------------------------------------------------- 3. prepared phase: nothing changes
UPDATE public.subscription_activation SET phase = 'prepared' WHERE component = 'free_issue';
SELECT tst.login(tst.pu(1));
SELECT tst.lives($$ INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (tst.pq(1, 50), tst.pu(1), 91050, 'draft') $$,
                 'G1 prepared phase: an exhausted Free-10 account still creates quotes (no new restriction while activation is off)');
SELECT tst.logout();

-- ---------------------------------------------------------------------------------------------------------------- 4. enforced phase
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
DO $$
DECLARE s jsonb;
BEGIN
  PERFORM tst.login(tst.pu(4)); s := public.get_account_summary(); PERFORM tst.logout();
  PERFORM tst.ok(s -> 'plan' ->> 'id' = 'all_inclusive' AND s -> 'free10' = 'null'::jsonb AND s ->> 'market' = 'INTERNATIONAL', 'S1 the package account summary names the package');
  PERFORM tst.login(tst.pu(3)); s := public.get_account_summary(); PERFORM tst.logout();
  PERFORM tst.ok(s -> 'plan' ->> 'id' = 'classic', 'S2 a legacy paid account keeps its legacy plan identity (no migration)');
  PERFORM tst.login(tst.pu(1)); s := public.get_account_summary(); PERFORM tst.logout();
  PERFORM tst.ok((s -> 'free10' ->> 'consumed')::int = 10 AND (s -> 'free10' ->> 'remaining')::int = 0, 'S3 exhausted Free-10: consumed 10, remaining 0');
END $$;
SELECT tst.login(tst.pu(1));
SELECT tst.throws($$ INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (tst.pq(1, 60), tst.pu(1), 91060, 'draft') $$, 'free_issue_limit_reached',
                  'G2 enforced: an exhausted Free-10 account cannot create a NEW quote (refused before the row exists)');
DO $$
DECLARE v_n int;
BEGIN
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = tst.pq(1, 60)), 'G3 no empty draft row was left behind');
  UPDATE public.quotes SET notes = 'edited after exhaustion' WHERE id = tst.pq(1, 11);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM tst.ok(v_n = 1, 'G4 editing an existing draft stays permitted');
  PERFORM tst.ok((SELECT count(*) FROM public.quotes WHERE user_id = tst.pu(1)) = 12, 'G5 viewing existing quotes stays permitted (all rows readable)');
END $$;
SELECT tst.logout();
SELECT tst.login(tst.pu(2));
SELECT tst.lives($$ INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (tst.pq(2, 2), tst.pu(2), 92002, 'draft') $$, 'G6 Free-10 with remaining quotes creates normally');
SELECT tst.logout();
SELECT tst.login(tst.pu(3));
SELECT tst.lives($$ INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (tst.pq(3, 1), tst.pu(3), 93001, 'draft') $$, 'G7 a legacy paid account is never blocked');
SELECT tst.logout();
SELECT tst.login(tst.pu(4));
SELECT tst.lives($$ INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (tst.pq(4, 1), tst.pu(4), 94001, 'draft') $$, 'G8 a package account is never blocked');
SELECT tst.logout();
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.enforce_free10_quote_creation()', 'execute')
              AND NOT has_function_privilege('anon', 'public.enforce_free10_quote_creation()', 'execute'), 'G9 the guard function is not callable by app roles');

-- ---------------------------------------------------------------------------------------------------------------- 5. package checkout intent
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.psvc();
  r := public.create_package_checkout_intent(tst.pu(4), 'year', 'pkg-intent-0001-year');
  PERFORM tst.ok(r ->> 'code' = 'checkout_unavailable', 'C1 billing off: the package checkout answers checkout_unavailable (no simulated purchase)');
  PERFORM tst.logout();
END $$;
SELECT public.set_billing_phase('prepared', 'TEST: task27 package checkout');
DO $$
DECLARE r jsonb; r2 jsonb;
BEGIN
  PERFORM tst.psvc();
  r := public.create_package_checkout_intent(tst.pu(6), 'year', 'pkg-intent-0002-year');
  PERFORM tst.ok(r ->> 'ok' = 'true' AND (r ->> 'amountMinor')::int = 18400 AND r ->> 'currency' = 'USD' AND r ->> 'planPriceId' = 'intl_all_inclusive_year_p2',
                 'C2 INTERNATIONAL annual intent = 18400 USD (the displayed $184.00)');
  PERFORM tst.ok(public.create_package_checkout_intent(tst.pu(4), 'year', 'pkg-intent-0009-year') ->> 'code' = 'already_subscribed',
                 'C2b an active package gets no second payment page (20261021000000)');
  r2 := public.create_package_checkout_intent(tst.pu(6), 'year', 'pkg-intent-0002-year');
  PERFORM tst.ok(r2 ->> 'attemptId' = r ->> 'attemptId', 'C3 idempotent retry returns the same attempt');
  r2 := public.create_package_checkout_intent(tst.pu(6), 'month', 'pkg-intent-0002-year');
  PERFORM tst.ok(r2 ->> 'code' = 'idempotency_conflict', 'C4 the same key with another period is a conflict');
  r := public.create_package_checkout_intent(tst.pu(2), 'year', 'pkg-intent-0003-year');
  PERFORM tst.ok((r ->> 'amountMinor')::int = 30600 AND r ->> 'currency' = 'ILS', 'C5 IL annual intent = 30600 ILS incl. VAT (market from the server, not the request)');
  r := public.create_package_checkout_intent(tst.pu(5), 'month', 'pkg-intent-0004-mont');
  PERFORM tst.ok(r ->> 'code' = 'account_unprovisioned', 'C6 no server market = no checkout');
  r := public.create_package_checkout_intent(tst.pu(4), 'quarter', 'pkg-intent-0005-qtr0');
  PERFORM tst.ok(r ->> 'code' = 'invalid_request', 'C7 only month / year');
  PERFORM tst.logout();
END $$;
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.create_package_checkout_intent(uuid,text,text,boolean)', 'execute')
              AND NOT has_function_privilege('anon', 'public.create_package_checkout_intent(uuid,text,text,boolean)', 'execute'), 'C8 only service_role may create an intent');
SELECT public.set_billing_phase('off', 'TEST: back to off');

ROLLBACK;
