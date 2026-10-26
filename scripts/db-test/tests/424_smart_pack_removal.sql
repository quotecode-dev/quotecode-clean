-- Owner console 2026-10-26 (typed: "מאשר הסרת חכם פלוס בשירות עצמי: בחודשי בסוף התקופה ששולמה בלי החזר, בשנתי לפי סעיף 6 ..."):
-- 20261027100000. Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: a monthly SMART PACK line is removed at
-- the paid end with no refund; a yearly one is refunded pro rata less the section 6 fee; a refused change changes nothing; a package
-- without SMART PACK has nothing to remove; one removal at a time.
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.tu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4240000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.tsq(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  EXECUTE p_sql INTO r; PERFORM tst.logout(); RETURN r;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) SELECT tst.tu(n), format('t424-%s@synthetic.test', n) FROM generate_series(1, 4) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.tu(n), format('t424-%s@synthetic.test', n), format('Synthetic removal %s', n), 'Local', 'ILS', 'free', 'user', false
    FROM generate_series(1, 4) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.tu(n), 'IL', 'business_settings_country' FROM generate_series(1, 4) n
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.tu(n), 'free_10', NULL, 0 FROM generate_series(1, 4) n ON CONFLICT (user_id) DO NOTHING;
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: synthetic SMART PACK removal proof' WHERE id;
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue'; -- smart_pack_state reads it

-- 1: monthly + SMART PACK; 2: yearly + SMART PACK; 3: monthly + SMART PACK (refused change); 4: monthly without SMART PACK
DO $$
DECLARE a uuid; n int; yr boolean; sp boolean; amt int;
BEGIN
  FOREACH n IN ARRAY ARRAY[1, 2, 3, 4] LOOP
    yr := n = 2; sp := n <> 4;
    amt := CASE WHEN yr THEN 30600 + 10200 WHEN sp THEN 4000 ELSE 3000 END;
    a := (tst.tsq(format('SELECT public.create_package_checkout_intent(%L, %L, ''pkg-424-user-%s-00000'', %L)', tst.tu(n),
           CASE WHEN yr THEN 'year' ELSE 'month' END, n, sp)) ->> 'attemptId')::uuid;
    PERFORM tst.tsq(format($f$SELECT to_jsonb(public.record_checkout_attempt_page_and_request(%L, %L, 'https://payments.payplus.co.il/p424', %L))$f$,
      a, tst.tu(n), format('1a2aee2e-0000-4000-8000-00000000042%s', n)));
    PERFORM tst.tsq(format($f$SELECT public.record_checkout_pull(%L, %L, %L, %L, %s, 'ILS', %L)$f$, a, tst.tu(n), a, format('rec-424-%s', n), amt, repeat(n::text, 64)));
  END LOOP;
END $$;
SELECT tst.ok((SELECT bool_and(e.smart_pack_line) FROM public.account_entitlements e WHERE e.user_id IN (tst.tu(1), tst.tu(2), tst.tu(3))),
  'T1 setup: three packages carry the SMART PACK line');
-- a known yearly period for user 2: 365 days, 100 left (99 unused from tomorrow); the period carries its charge
UPDATE public.account_entitlements SET paid_through = (((now() AT TIME ZONE 'Asia/Jerusalem')::date + 100) + time '12:00') AT TIME ZONE 'Asia/Jerusalem' WHERE user_id = tst.tu(2);
ALTER TABLE public.billing_paid_periods DISABLE TRIGGER billing_paid_periods_append_only;
DELETE FROM public.billing_paid_periods WHERE user_id = tst.tu(2);
ALTER TABLE public.billing_paid_periods ENABLE TRIGGER billing_paid_periods_append_only;
INSERT INTO public.billing_paid_periods (user_id, attempt_id, event_id, charge_ref, period_start, period_end)
  SELECT e.user_id, e.live_attempt_id, 'seed-424', 'tx-424-year', e.paid_through - interval '365 days', e.paid_through FROM public.account_entitlements e WHERE e.user_id = tst.tu(2);

CREATE TEMP TABLE q424 AS SELECT n, tst.tsq(format('SELECT public.smart_pack_removal_quote(%L)', tst.tu(n))) AS r FROM generate_series(1, 4) n;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'period' = 'month' AND (r ->> 'refundMinor')::int = 0 FROM q424 WHERE n = 1),
  'T2 monthly: removable, no refund');
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'period' = 'year' AND (r ->> 'feeMinor')::int = 510
                 AND (r ->> 'refundMinor')::int = 2300 AND r ->> 'chargeRef' = 'tx-424-year' FROM q424 WHERE n = 2),
  'T3 yearly: 102 x 99 / 365 = 27.67 less the 5% fee (5.10) = 22.57 -> 23 whole shekels (IRON-ILS-001) on the period charge');
SELECT tst.ok((SELECT r ->> 'code' = 'not_on_plan' FROM q424 WHERE n = 4), 'T4 a package without SMART PACK has nothing to remove');

-- user 1: request -> PayPlus changed -> removed at the paid end
CREATE TEMP TABLE r424 AS SELECT n, tst.tsq(format('SELECT public.request_smart_pack_removal(%L, %L)', tst.tu(n), format('rm-424-click-0000000%s', n))) AS r
  FROM (VALUES (1), (2), (3)) v(n);
SELECT tst.ok((SELECT bool_and((r ->> 'ok')::boolean AND r ->> 'state' = 'requested') FROM r424), 'T5 three removals requested');
SELECT tst.ok(tst.tsq(format('SELECT public.request_smart_pack_removal(%L, ''rm-424-click-00000099'')', tst.tu(1))) ->> 'code' = 'retry_later',
  'T6 one removal at a time');
CREATE TEMP TABLE b424 AS SELECT tst.tsq(format('SELECT public.smart_pack_removal_begin(%L)', (SELECT r ->> 'removalId' FROM r424 WHERE n = 1))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'recurringRef' = 'rec-424-1' AND (r ->> 'packageAmountMinor')::int = 3000 AND (r ->> 'addOnAmountMinor')::int = 1000 FROM b424),
  'T7 the change: the package 30 alone on the same order');
SELECT tst.tsq(format('SELECT public.smart_pack_removal_finish(%L, true)', (SELECT r ->> 'removalId' FROM r424 WHERE n = 1)));
SELECT tst.ok((SELECT NOT e.smart_pack_line AND e.smart_pack_until = e.paid_through AND c.amount_minor = 3000 AND c.add_on_price_id IS NULL
               FROM public.account_entitlements e JOIN public.checkout_attempts c ON c.attempt_id = e.live_attempt_id WHERE e.user_id = tst.tu(1)),
  'T8 removed: the attempt is the package alone (30), SMART PACK runs to the paid end');
SELECT tst.ok((SELECT (public.smart_pack_state(tst.tu(1)) ->> 'active')::boolean), 'T9 SMART PACK is still active until the paid end');

-- user 2: yearly -> removed -> the refund is due, then recorded once
SELECT tst.tsq(format('SELECT public.smart_pack_removal_finish(%L, true)', (SELECT r ->> 'removalId' FROM r424 WHERE n = 2)));
SELECT tst.ok(tst.tsq(format('SELECT public.smart_pack_removal_refunds_due(%L)', tst.tu(2))) -> 0 ->> 'chargeRef' = 'tx-424-year', 'T10 the yearly refund is due on the period charge');
SELECT tst.ok((tst.tsq(format('SELECT public.record_smart_pack_removal_refund(%L, ''rf-424'')', (SELECT r ->> 'removalId' FROM r424 WHERE n = 2))) ->> 'ok')::boolean
              AND tst.tsq(format('SELECT public.smart_pack_removal_refunds_due(%L)', tst.tu(2))) = '[]'::jsonb, 'T11 recorded once');

-- user 3: PayPlus refused -> nothing changes
SELECT tst.tsq(format('SELECT public.smart_pack_removal_finish(%L, false)', (SELECT r ->> 'removalId' FROM r424 WHERE n = 3)));
SELECT tst.ok((SELECT e.smart_pack_line AND c.amount_minor = 4000 FROM public.account_entitlements e JOIN public.checkout_attempts c ON c.attempt_id = e.live_attempt_id
               WHERE e.user_id = tst.tu(3)), 'T12 a refused change leaves SMART PACK on the plan');
ROLLBACK;
