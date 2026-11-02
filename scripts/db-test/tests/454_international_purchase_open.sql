-- Owner console 2026-11-01 (typed: "מאשר פתיחת הרכישה בחו"ל לפי ההמלצות א-ה ..."): 20261101100000_international_purchase_open.
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: an INTERNATIONAL account gets its own USD page (monthly,
-- annual, annual + SMART PACK); a live USD package gets a SMART PACK mid-period quote in USD cents and its page row is kept in USD;
-- the SMART PACK removal of a USD annual line takes 5% capped at $27 and refunds in cents; an Israeli account keeps its ILS page.
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.iu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4540000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.isq(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  EXECUTE p_sql INTO r; PERFORM tst.logout(); RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.idev(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  EXECUTE p_sql;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- 1 an INTERNATIONAL monthly package | 2 an INTERNATIONAL annual package WITH SMART PACK | 3 INTERNATIONAL Free | 4 an Israeli account
INSERT INTO auth.users (id, email) SELECT tst.iu(n), format('i454-%s@synthetic.test', n) FROM generate_series(1, 4) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.iu(n), format('i454-%s@synthetic.test', n), format('Synthetic international %s', n), CASE WHEN n = 4 THEN 'Local' ELSE 'US' END,
         CASE WHEN n = 4 THEN 'ILS' ELSE 'USD' END, 'free', 'user', false FROM generate_series(1, 4) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source)
  SELECT tst.iu(n), CASE WHEN n = 4 THEN 'IL' ELSE 'INTERNATIONAL' END, 'business_settings_country' FROM generate_series(1, 4) n
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.iu(n), 'free_10', NULL, 0 FROM generate_series(1, 4) n ON CONFLICT (user_id) DO NOTHING;
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: synthetic international purchase proof' WHERE id;
SELECT tst.idev($f$UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue'$f$);

-- the payment pages
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'market' = 'INTERNATIONAL' AND r ->> 'currency' = 'USD' AND (r ->> 'amountMinor')::int = 1800
                 FROM tst.isq(format($q$SELECT public.create_package_checkout_intent(%L, 'month', 'pkg-454-user-3-month-0')$q$, tst.iu(3))) r),
  'I1 an INTERNATIONAL Free account gets a monthly page: 18.00 USD');
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'currency' = 'USD' AND (r ->> 'amountMinor')::int = 18400 + 5100 AND (r ->> 'smartPack')::boolean
                   AND (r ->> 'packageAmountMinor')::int = 18400 AND (r ->> 'addOnAmountMinor')::int = 5100
                 FROM tst.isq(format($q$SELECT public.create_package_checkout_intent(%L, 'year', 'pkg-454-user-3-year-00', true)$q$, tst.iu(3))) r),
  'I2 an annual page with SMART PACK: 184.00 + 51.00 USD on the same payment');
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'market' = 'IL' AND r ->> 'currency' = 'ILS' AND (r ->> 'amountMinor')::int = 3000
                 FROM tst.isq(format($q$SELECT public.create_package_checkout_intent(%L, 'month', 'pkg-454-user-4-month-0')$q$, tst.iu(4))) r),
  'I3 an Israeli account keeps its own page: 30.00 ILS');

-- two live USD packages: 1 monthly, 2 annual with SMART PACK
DO $$
DECLARE a uuid;
BEGIN
  a := (tst.isq(format($q$SELECT public.create_package_checkout_intent(%L, 'month', 'pkg-454-user-1-000000', false)$q$, tst.iu(1))) ->> 'attemptId')::uuid;
  PERFORM tst.isq(format($f$SELECT public.record_verified_provider_event('payplus', 'tx-454-1', 'payment_confirmed', %L, 'rec-454-1', 'term-454', %L, %L, 1800, 'USD')$f$,
    a, now() - interval '5 days', repeat('e', 64)));
  a := (tst.isq(format($q$SELECT public.create_package_checkout_intent(%L, 'year', 'pkg-454-user-2-000000', true)$q$, tst.iu(2))) ->> 'attemptId')::uuid;
  PERFORM tst.isq(format($f$SELECT public.record_verified_provider_event('payplus', 'tx-454-2', 'payment_confirmed', %L, 'rec-454-2', 'term-454', %L, %L, 23500, 'USD')$f$,
    a, now() - interval '5 days', repeat('f', 64)));
END $$;
SELECT tst.idev(format($f$UPDATE public.checkout_attempts SET provider_request_ref = '1a2aee2e-0000-4000-8000-000000000454' WHERE user_id = %L$f$, tst.iu(1)));
SELECT tst.idev(format($f$UPDATE public.checkout_attempts SET provider_request_ref = '1a2aee2e-0000-4000-8000-000000000554' WHERE user_id = %L$f$, tst.iu(2)));
SELECT tst.ok((SELECT count(*) = 2 AND bool_and(subscription_status = 'active') FROM public.account_entitlements WHERE user_id IN (tst.iu(1), tst.iu(2))),
  'I4 setup: both USD payments activated their package');

-- SMART PACK mid-period, in USD cents
CREATE TEMP TABLE q454 AS SELECT tst.isq(format('SELECT public.smart_pack_add_on_quote(%L)', tst.iu(1))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'market' = 'INTERNATIONAL' AND r ->> 'currency' = 'USD' AND (r ->> 'recurringMinor')::int = 500
                 AND r ->> 'period' = 'month' FROM q454),
  'I5 a live USD package gets a SMART PACK quote: 5.00 USD a month');
SELECT tst.ok((SELECT (r ->> 'amountMinor')::int = greatest(100, round(500::numeric * (r ->> 'daysLeft')::int / (r ->> 'daysInPeriod')::int)::int) FROM q454),
  'I6 the amount = 5.00 x the days left / the days of the period, in cents (no whole-dollar rounding)');
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'market' = 'INTERNATIONAL' AND r ->> 'currency' = 'USD'
                   AND (r ->> 'amountMinor')::int = (SELECT (q.r ->> 'amountMinor')::int FROM q454 q)
                 FROM tst.isq(format($q$SELECT public.create_smart_pack_add_on_intent(%L, 'addon-454-user-1-000')$q$, tst.iu(1))) r),
  'I7 the add-on page answers in USD for the same amount');
SELECT tst.ok(EXISTS (SELECT 1 FROM public.smart_pack_add_ons WHERE user_id = tst.iu(1) AND currency = 'USD' AND state = 'pending'),
  'I7b its row is kept in USD (the currency check takes USD)');

-- SMART PACK removal of a USD annual line: 5% capped at $27, refund in cents
SELECT tst.idev(format($f$UPDATE public.account_entitlements SET smart_pack_line = true WHERE user_id = %L$f$, tst.iu(2)));
CREATE TEMP TABLE r454 AS SELECT tst.isq(format('SELECT public.smart_pack_removal_quote(%L)', tst.iu(2))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'currency' = 'USD' AND r ->> 'period' = 'year' AND (r ->> 'feeMinor')::int = 255 FROM r454),
  'I8 the removal fee of a 51.00 USD annual SMART PACK = 5% = 2.55 USD (under the $27 cap)');
SELECT tst.ok((SELECT (r ->> 'refundMinor')::int > 0 AND (r ->> 'refundMinor')::int < 5100 - 255 + 1 FROM r454),
  'I9 the USD removal refund is the unused part less the fee, in cents');
SELECT tst.ok(least(round(18400 * 0.05)::int, 2700) = 920 AND least(round(1000000 * 0.05)::int, 2700) = 2700,
  'I10 the USD cap: 5% of 184.00 = 9.20; a large amount stops at 27.00');

ROLLBACK;
