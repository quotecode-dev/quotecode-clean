-- Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01, L-06, L-09, L-11, L-12, L-15, L-17, L-22, L-23, L-24, L-25 לפי התוכנית לתיקון 22
-- ממצאי קודקס מ-28/10"): 20261029000000. Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: a removal refund is
-- claimed once (never two refunds); a positive refund stays owed without a charge reference; the reconciliation keeps the historical
-- charge after a removal and knows the removal refund; the market follows the one market rule; an expense can be 'unknown'.
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.tu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4300000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.tsq(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  EXECUTE p_sql INTO r; PERFORM tst.logout(); RETURN r;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) SELECT tst.tu(n), format('t430-%s@synthetic.test', n) FROM generate_series(1, 6) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.tu(n), format('t430-%s@synthetic.test', n), format('Synthetic review %s', n), 'Local', 'ILS', 'free', 'user', false
    FROM generate_series(1, 3) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.tu(n), 'IL', 'business_settings_country' FROM generate_series(1, 3) n
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.tu(n), 'free_10', NULL, 0 FROM generate_series(1, 3) n ON CONFLICT (user_id) DO NOTHING;
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: synthetic Codex review proof' WHERE id;
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';

-- 1: monthly + SMART PACK; 2: yearly + SMART PACK with a known period charge; 3: yearly + SMART PACK, a period opened by a pull (no charge id)
DO $$
DECLARE a uuid; n int; yr boolean; amt int;
BEGIN
  FOREACH n IN ARRAY ARRAY[1, 2, 3] LOOP
    yr := n <> 1;
    amt := CASE WHEN yr THEN 30600 + 10200 ELSE 4000 END;
    a := (tst.tsq(format('SELECT public.create_package_checkout_intent(%L, %L, ''pkg-430-user-%s-00000'', true)', tst.tu(n),
           CASE WHEN yr THEN 'year' ELSE 'month' END, n)) ->> 'attemptId')::uuid;
    PERFORM tst.tsq(format($f$SELECT to_jsonb(public.record_checkout_attempt_page_and_request(%L, %L, 'https://payments.payplus.co.il/p430', %L))$f$,
      a, tst.tu(n), format('1a2aee2e-0000-4000-8000-00000000043%s', n)));
    PERFORM tst.tsq(format($f$SELECT public.record_checkout_pull(%L, %L, %L, %L, %s, 'ILS', %L)$f$, a, tst.tu(n), a, format('rec-430-%s', n), amt, repeat(n::text, 64)));
  END LOOP;
END $$;
UPDATE public.account_entitlements SET paid_through = (((now() AT TIME ZONE 'Asia/Jerusalem')::date + 100) + time '12:00') AT TIME ZONE 'Asia/Jerusalem' WHERE user_id IN (tst.tu(2), tst.tu(3));
ALTER TABLE public.billing_paid_periods DISABLE TRIGGER billing_paid_periods_append_only;
DELETE FROM public.billing_paid_periods WHERE user_id IN (tst.tu(2), tst.tu(3));
ALTER TABLE public.billing_paid_periods ENABLE TRIGGER billing_paid_periods_append_only;
INSERT INTO public.billing_paid_periods (user_id, attempt_id, event_id, charge_ref, period_start, period_end)
  SELECT e.user_id, e.live_attempt_id, 'seed-430', 'tx-430-year', e.paid_through - interval '365 days', e.paid_through FROM public.account_entitlements e WHERE e.user_id = tst.tu(2);
-- user 3: the real shape of a period opened by a pull (event 'pull:<attempt>', no charge id) and no first-charge callback yet
INSERT INTO public.billing_paid_periods (user_id, attempt_id, event_id, charge_ref, period_start, period_end)
  SELECT e.user_id, e.live_attempt_id, 'pull:' || e.live_attempt_id::text, NULL, e.paid_through - interval '365 days', e.paid_through FROM public.account_entitlements e WHERE e.user_id = tst.tu(3);

CREATE TEMP TABLE r430 AS SELECT n, tst.tsq(format('SELECT public.request_smart_pack_removal(%L, %L)', tst.tu(n), format('rm-430-click-0000000%s', n))) AS r
  FROM (VALUES (1), (2), (3)) v(n);
SELECT tst.ok((SELECT bool_and((r ->> 'ok')::boolean AND r ->> 'state' = 'requested' AND r ->> 'refundState' = 'none') FROM r430), 'T1 three removals requested; the answer carries the refund state');
SELECT tst.tsq(format('SELECT public.smart_pack_removal_finish(%L, true)', (SELECT r ->> 'removalId' FROM r430 WHERE n = x))) FROM (VALUES (1), (2), (3)) v(x);

-- F01: the refund is claimed once
SELECT tst.ok((SELECT refund_state = 'none' FROM public.smart_pack_removals WHERE user_id = tst.tu(1)), 'T2 monthly: no refund');
CREATE TEMP TABLE c430 AS SELECT tst.tsq(format('SELECT public.claim_smart_pack_removal_refund(%L)', (SELECT r ->> 'removalId' FROM r430 WHERE n = 2))) AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean AND r ->> 'chargeRef' = 'tx-430-year' AND (r ->> 'amountMinor')::int = 2300 FROM c430), 'T3 the yearly refund is claimed with its charge');
SELECT tst.ok(tst.tsq(format('SELECT public.claim_smart_pack_removal_refund(%L)', (SELECT r ->> 'removalId' FROM r430 WHERE n = 2))) ->> 'code' = 'not_due',
  'T4 a second claim (another tab, a status refresh) gets nothing - never two refunds');
SELECT tst.ok(tst.tsq(format('SELECT public.smart_pack_removal_refunds_due(%L)', tst.tu(2))) = '[]'::jsonb, 'T5 a claimed refund is no longer due');
SELECT tst.ok((tst.tsq(format('SELECT public.record_smart_pack_removal_refund(%L, ''rf-430'')', (SELECT r ->> 'removalId' FROM r430 WHERE n = 2))) ->> 'ok')::boolean
  AND NOT (tst.tsq(format('SELECT public.record_smart_pack_removal_refund(%L, ''rf-430b'')', (SELECT r ->> 'removalId' FROM r430 WHERE n = 2))) ->> 'ok')::boolean,
  'T6 recorded once, only from the claim');

-- F02: a positive refund without a charge reference stays owed (never 'none'), is never sent, and reaches the Owner
SELECT tst.ok((SELECT refund_state = 'due' AND refund_minor > 0 FROM public.smart_pack_removals WHERE user_id = tst.tu(3)), 'T7 a pulled period: the refund is owed, not dropped');
SELECT tst.ok(tst.tsq(format('SELECT public.claim_smart_pack_removal_refund(%L)', (SELECT r ->> 'removalId' FROM r430 WHERE n = 3))) ->> 'code' = 'no_charge_ref',
  'T8 no charge reference yet: nothing is claimed or sent');
UPDATE public.smart_pack_removals SET change_at = now() - interval '25 hours' WHERE user_id = tst.tu(3);
SELECT tst.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(tst.tsq('SELECT public.smart_pack_removal_refunds_owed()')) o WHERE o ->> 'userId' = tst.tu(3)::text AND o ->> 'refundState' = 'due'),
  'T9 owed for a day: the Owner sees it (REFUND_OWED)');
-- a claim PayPlus did not prove: unknown, never due again
UPDATE public.smart_pack_removals SET refund_state = 'sending', refund_claimed_at = now() WHERE user_id = tst.tu(3);
SELECT tst.ok((tst.tsq(format('SELECT public.mark_smart_pack_removal_refund_unknown(%L)', (SELECT r ->> 'removalId' FROM r430 WHERE n = 3))) ->> 'ok')::boolean
  AND tst.tsq(format('SELECT public.smart_pack_removal_refunds_due(%L)', tst.tu(3))) = '[]'::jsonb, 'T10 an unproven refund is unknown and never due again');

-- F03: the reconciliation keeps the charge as it was, and knows the removal refund (one transaction has one now(): the removal is
-- moved a minute after the charge, as it is in real life)
UPDATE public.smart_pack_removals SET change_at = now() + interval '1 minute' WHERE user_id = tst.tu(1);
CREATE TEMP TABLE s430 AS SELECT tst.tsq(format('SELECT public.billing_reconcile_source(%L, %L)', now() - interval '1 day', now() + interval '1 day')) AS r;
SELECT tst.ok((SELECT count(*) = 1 FROM s430, jsonb_array_elements(r -> 'charges') c
               WHERE c ->> 'attemptId' = (SELECT live_attempt_id::text FROM public.account_entitlements WHERE user_id = tst.tu(1))), 'T11a the monthly charge is in the source');
SELECT tst.ok((SELECT (c ->> 'amountMinor')::int = 4000 FROM s430, jsonb_array_elements(r -> 'charges') c
               WHERE c ->> 'attemptId' = (SELECT live_attempt_id::text FROM public.account_entitlements WHERE user_id = tst.tu(1))),
  'T11 a monthly charge of 40 stays 40 after the SMART PACK removal (the attempt is 30 now)');
SELECT tst.ok((SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'refunds') x WHERE x ->> 'transactionUid' = 'rf-430') FROM s430), 'T12 the removal refund is a known refund');
SELECT tst.ok((SELECT jsonb_typeof(r -> 'owedRefunds') = 'array' FROM s430), 'T13 the owed refunds are part of the source');
SELECT tst.lives($q$WITH r AS (INSERT INTO public.billing_reconcile_runs (run_day, source) VALUES ((now() AT TIME ZONE 'Asia/Jerusalem')::date, 'admin') RETURNING run_id)
  INSERT INTO public.billing_reconcile_findings (run_id, code, uid) SELECT run_id, 'REFUND_OWED', 'removal:x' FROM r$q$, 'T14 REFUND_OWED is a finding code');
SELECT tst.ok(EXISTS (SELECT 1 FROM public.billing_reconcile_findings WHERE code = 'REFUND_OWED' AND uid = 'removal:x'), 'T14b the finding was stored');

-- F04: the one market rule
SELECT tst.ok(public.account_market_for_country('IL') = 'IL' AND public.account_market_for_country('il') = 'IL' AND public.account_market_for_country(' Israel ') = 'IL'
  AND public.account_market_for_country('ISRAEL') = 'IL' AND public.account_market_for_country(' Local ') = 'IL' AND public.account_market_for_country('LCL') = 'IL',
  'T15 IL / Israel / Local / LCL in any case and spacing = IL');
SELECT tst.ok(public.account_market_for_country('France') = 'INTERNATIONAL' AND public.account_market_for_country('International') = 'INTERNATIONAL'
  AND public.account_market_for_country('Atlantis') = 'INTERNATIONAL', 'T16 another known or an unknown country = INTERNATIONAL');
SELECT tst.ok(public.account_market_for_country(NULL) IS NULL AND public.account_market_for_country('') IS NULL AND public.account_market_for_country('   ') IS NULL, 'T17 none = no market');
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  VALUES (tst.tu(4), 't430-4@synthetic.test', 'Synthetic Israel', 'Israel', 'ILS', 'free', 'user', false);
SELECT tst.ok((SELECT market = 'IL' FROM public.account_market WHERE user_id = tst.tu(4)), 'T18 an account stored as "Israel" can buy in Israel');

-- F05: an expense PayPlus may have received
SELECT tst.lives($q$INSERT INTO public.expense_invoices (mailbox, message_id, status) VALUES ('quotecodedev@gmail.com', 'm-430-unknown', 'unknown')$q$, 'T19 an expense can be unknown');
SELECT tst.throws($q$INSERT INTO public.expense_invoices (mailbox, message_id, status) VALUES ('quotecodedev@gmail.com', 'm-430-bad', 'maybe')$q$, 'check', 'T20 any other state is refused');

-- the new functions are the server's only
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.claim_smart_pack_removal_refund(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.smart_pack_removal_refunds_owed()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.mark_smart_pack_removal_refund_unknown(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.smart_pack_removal_charge_ref(uuid)', 'EXECUTE'), 'T21 never callable from the browser');
ROLLBACK;
