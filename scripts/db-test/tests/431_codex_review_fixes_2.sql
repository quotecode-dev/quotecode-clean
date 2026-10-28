-- Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01, L-09, L-11, L-14, L-15, L-17, L-22, L-23, L-25 לפי התוכנית לתיקון 17 ממצאי קודקס
-- על בקשת מיזוג 113, כולל ארבע ההחלטות שהוצעו"): 20261029100000. Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: an article carries its revision (N01); the Owner closes an owed removal refund made in PayPlus with its transaction number,
-- once, for that account only, and the reconciliation knows it (N03); a SMART PACK bought again can be removed again (N04); the
-- early-end basis takes off only a line that is still on the attempt (N02).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.tu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4310000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.tsq(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  EXECUTE p_sql INTO r; PERFORM tst.logout(); RETURN r;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) SELECT tst.tu(n), format('t431-%s@synthetic.test', n) FROM generate_series(1, 3) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.tu(n), format('t431-%s@synthetic.test', n), format('Synthetic review two %s', n), 'Local', 'ILS', 'free', 'user', false
    FROM generate_series(1, 3) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.tu(n), 'IL', 'business_settings_country' FROM generate_series(1, 3) n
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.tu(n), 'free_10', NULL, 0 FROM generate_series(1, 3) n ON CONFLICT (user_id) DO NOTHING;
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: synthetic Codex review two proof' WHERE id;
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';

-- 1: monthly + SMART PACK; 2: yearly + SMART PACK with a known period charge; 3: yearly + SMART PACK, a period opened by a pull (no charge id)
DO $$
DECLARE a uuid; n int; yr boolean; amt int;
BEGIN
  FOREACH n IN ARRAY ARRAY[1, 2, 3] LOOP
    yr := n <> 1;
    amt := CASE WHEN yr THEN 30600 + 10200 ELSE 4000 END;
    a := (tst.tsq(format('SELECT public.create_package_checkout_intent(%L, %L, ''pkg-431-user-%s-00000'', true)', tst.tu(n),
           CASE WHEN yr THEN 'year' ELSE 'month' END, n)) ->> 'attemptId')::uuid;
    PERFORM tst.tsq(format($f$SELECT to_jsonb(public.record_checkout_attempt_page_and_request(%L, %L, 'https://payments.payplus.co.il/p431', %L))$f$,
      a, tst.tu(n), format('1a2aee2e-0000-4000-8000-00000000431%s', n)));
    PERFORM tst.tsq(format($f$SELECT public.record_checkout_pull(%L, %L, %L, %L, %s, 'ILS', %L)$f$, a, tst.tu(n), a, format('rec-431-%s', n), amt, repeat(n::text, 64)));
  END LOOP;
END $$;
UPDATE public.account_entitlements SET paid_through = (((now() AT TIME ZONE 'Asia/Jerusalem')::date + 100) + time '12:00') AT TIME ZONE 'Asia/Jerusalem' WHERE user_id IN (tst.tu(2), tst.tu(3));
ALTER TABLE public.billing_paid_periods DISABLE TRIGGER billing_paid_periods_append_only;
DELETE FROM public.billing_paid_periods WHERE user_id IN (tst.tu(2), tst.tu(3));
ALTER TABLE public.billing_paid_periods ENABLE TRIGGER billing_paid_periods_append_only;
INSERT INTO public.billing_paid_periods (user_id, attempt_id, event_id, charge_ref, period_start, period_end)
  SELECT e.user_id, e.live_attempt_id, 'seed-431', 'tx-431-year', e.paid_through - interval '365 days', e.paid_through FROM public.account_entitlements e WHERE e.user_id = tst.tu(2);
INSERT INTO public.billing_paid_periods (user_id, attempt_id, event_id, charge_ref, period_start, period_end)
  SELECT e.user_id, e.live_attempt_id, 'pull:' || e.live_attempt_id::text, NULL, e.paid_through - interval '365 days', e.paid_through FROM public.account_entitlements e WHERE e.user_id = tst.tu(3);
-- the SMART PACK price of each attempt, kept before the removal takes it off
CREATE TEMP TABLE sp431 AS SELECT e.user_id, c.attempt_id, c.add_on_price_id, p.amount_minor AS sp_minor
  FROM public.account_entitlements e JOIN public.checkout_attempts c ON c.attempt_id = e.live_attempt_id JOIN public.price_versions p ON p.price_id = c.add_on_price_id
 WHERE e.user_id IN (tst.tu(1), tst.tu(2), tst.tu(3));
SELECT tst.ok((SELECT count(*) = 3 FROM sp431), 'T0 three packages with SMART PACK');

CREATE TEMP TABLE r431 AS SELECT n, tst.tsq(format('SELECT public.request_smart_pack_removal(%L, %L)', tst.tu(n), format('rm-431-click-0000000%s', n))) AS r
  FROM (VALUES (1), (2), (3)) v(n);
SELECT tst.ok((SELECT bool_and((r ->> 'ok')::boolean) FROM r431), 'T0b three removals requested');
SELECT tst.tsq(format('SELECT public.smart_pack_removal_finish(%L, true)', (SELECT r ->> 'removalId' FROM r431 WHERE n = x))) FROM (VALUES (1), (2), (3)) v(x);
-- one transaction has one now(): the removals are moved a few minutes later, as they are in real life
UPDATE public.smart_pack_removals SET change_at = now() + interval '5 minutes' WHERE user_id IN (tst.tu(1), tst.tu(2));

-- N01: the article revision
SELECT tst.ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_articles' AND column_name = 'revision'
  AND data_type = 'integer' AND is_nullable = 'NO' AND column_default = '0'), 'T1 every article has a revision (0 to start)');
SELECT tst.ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.site_articles'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%revision >= 0%'),
  'T2 a revision is never negative');

-- N03 (Owner decision 1): the Owner closes an owed refund made in PayPlus
UPDATE public.smart_pack_removals SET change_at = now() - interval '25 hours' WHERE user_id = tst.tu(3);
SELECT tst.ok((SELECT refund_state = 'due' AND refund_minor > 0 FROM public.smart_pack_removals WHERE user_id = tst.tu(3)), 'T3 a pulled period: the refund is owed');
SELECT tst.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(tst.tsq('SELECT public.smart_pack_removal_refunds_owed()')) o WHERE o ->> 'userId' = tst.tu(3)::text),
  'T4 the Owner sees it (REFUND_OWED, with its account)');
SELECT tst.ok(tst.tsq(format('SELECT public.settle_smart_pack_removal_refund(%L, %L, ''ab'')', (SELECT r ->> 'removalId' FROM r431 WHERE n = 3), tst.tu(3))) ->> 'code' = 'invalid_request',
  'T5 a transaction number shorter than 3 is refused');
SELECT tst.ok(tst.tsq(format('SELECT public.settle_smart_pack_removal_refund(%L, %L, ''PP-431-77'')', (SELECT r ->> 'removalId' FROM r431 WHERE n = 3), tst.tu(1))) ->> 'code' = 'no_unsettled_refund'
  AND (SELECT refund_state = 'due' FROM public.smart_pack_removals WHERE user_id = tst.tu(3)), 'T6 another account never closes it');
CREATE TEMP TABLE st431 AS SELECT tst.tsq(format('SELECT public.settle_smart_pack_removal_refund(%L, %L, ''  PP-431-77  '')', (SELECT r ->> 'removalId' FROM r431 WHERE n = 3), tst.tu(3))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND (r ->> 'refundMinor')::int > 0 FROM st431)
  AND (SELECT refund_state = 'refunded' AND refund_ref = 'PP-431-77' AND refund_claimed_at IS NOT NULL FROM public.smart_pack_removals WHERE user_id = tst.tu(3)),
  'T7 closed with its PayPlus transaction number (trimmed)');
SELECT tst.ok(tst.tsq(format('SELECT public.settle_smart_pack_removal_refund(%L, %L, ''PP-431-78'')', (SELECT r ->> 'removalId' FROM r431 WHERE n = 3), tst.tu(3))) ->> 'code' = 'no_unsettled_refund'
  AND (SELECT refund_ref = 'PP-431-77' FROM public.smart_pack_removals WHERE user_id = tst.tu(3)), 'T8 closed once - a second confirmation changes nothing');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(tst.tsq('SELECT public.smart_pack_removal_refunds_owed()')) o WHERE o ->> 'userId' = tst.tu(3)::text),
  'T9 no longer owed');
SELECT tst.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(tst.tsq(format('SELECT public.billing_reconcile_source(%L, %L)', now() - interval '2 days', now() + interval '1 day')) -> 'refunds') x
  WHERE x ->> 'transactionUid' = 'PP-431-77'), 'T10 the reconciliation knows the refund made in PayPlus');
SELECT tst.ok(tst.tsq(format('SELECT public.settle_smart_pack_removal_refund(%L, %L, ''PP-431-79'')', (SELECT r ->> 'removalId' FROM r431 WHERE n = 1), tst.tu(1))) ->> 'code' = 'no_unsettled_refund',
  'T11 a removal with no refund cannot be "closed"');

-- N04: a SMART PACK bought again after a removal can be removed again
SELECT tst.ok(tst.tsq(format('SELECT public.smart_pack_removal_quote(%L)', tst.tu(1))) ->> 'code' = 'already_removed', 'T12 the removed line answers its own state');
UPDATE public.checkout_attempts c SET add_on_price_id = s.add_on_price_id, amount_minor = c.amount_minor + s.sp_minor FROM sp431 s WHERE s.user_id = tst.tu(1) AND c.attempt_id = s.attempt_id;
UPDATE public.account_entitlements SET smart_pack_line = true, smart_pack_until = NULL WHERE user_id = tst.tu(1);
INSERT INTO public.smart_pack_add_ons (user_id, package_attempt_id, price_id, idempotency_key, period, currency, amount_minor, period_end, days_left, days_in_period,
                                       state, paid_event_id, paid_at, line_state, line_at)
  SELECT tst.tu(1), s.attempt_id, s.add_on_price_id, 'readd-431-user-1-0000', 'month', 'ILS', s.sp_minor, e.paid_through, 10, 30,
         'paid', 'ev-431-readd-1', now(), 'added', now() + interval '10 minutes'
    FROM sp431 s JOIN public.account_entitlements e ON e.user_id = s.user_id WHERE s.user_id = tst.tu(1);
SELECT tst.ok((tst.tsq(format('SELECT public.smart_pack_removal_quote(%L)', tst.tu(1))) ->> 'ok')::boolean, 'T13 the line bought again can be removed again');

-- N02: the early-end basis takes off only a SMART PACK line that is still on the attempt
INSERT INTO public.smart_pack_add_ons (user_id, package_attempt_id, price_id, idempotency_key, period, currency, amount_minor, period_end, days_left, days_in_period,
                                       state, paid_event_id, paid_at, line_state, line_at)
  SELECT tst.tu(2), s.attempt_id, s.add_on_price_id, 'add-431-user-2-before', 'year', 'ILS', s.sp_minor, e.paid_through, 100, 365,
         'paid', 'ev-431-add-2a', now() - interval '1 day', 'added', now() - interval '1 day'
    FROM sp431 s JOIN public.account_entitlements e ON e.user_id = s.user_id WHERE s.user_id = tst.tu(2);
SELECT tst.ok((tst.tsq(format('SELECT public.billing_admin_preview(%L, false)', tst.tu(2))) ->> 'paidMinor')::int
              = (SELECT c.amount_minor FROM public.checkout_attempts c JOIN sp431 s ON s.attempt_id = c.attempt_id WHERE s.user_id = tst.tu(2)),
  'T14 a line added in the period and removed since is not taken off again');
INSERT INTO public.smart_pack_add_ons (user_id, package_attempt_id, price_id, idempotency_key, period, currency, amount_minor, period_end, days_left, days_in_period,
                                       state, paid_event_id, paid_at, line_state, line_at)
  SELECT tst.tu(2), s.attempt_id, s.add_on_price_id, 'add-431-user-2-after0', 'year', 'ILS', s.sp_minor, e.paid_through, 100, 365,
         'paid', 'ev-431-add-2b', now(), 'added', now() + interval '20 minutes'
    FROM sp431 s JOIN public.account_entitlements e ON e.user_id = s.user_id WHERE s.user_id = tst.tu(2);
SELECT tst.ok((tst.tsq(format('SELECT public.billing_admin_preview(%L, false)', tst.tu(2))) ->> 'paidMinor')::int
              = (SELECT c.amount_minor - s.sp_minor FROM public.checkout_attempts c JOIN sp431 s ON s.attempt_id = c.attempt_id WHERE s.user_id = tst.tu(2)),
  'T15 a line added in the period and still on the attempt is taken off once');

-- the new function is the server's only
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.settle_smart_pack_removal_refund(uuid, uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.settle_smart_pack_removal_refund(uuid, uuid, text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.settle_smart_pack_removal_refund(uuid, uuid, text)', 'EXECUTE'), 'T16 never callable from the browser');
ROLLBACK;
