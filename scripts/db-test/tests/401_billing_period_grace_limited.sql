-- PayPlus stage 2 - paid period, renewal, failed charge, 3 grace days, limited mode (Owner 2026-10-18, migration 20261021200000).
-- Disposable postgres:17 harness ONLY. Proves: billing off = inert; the first payment starts the paid period, a renewal runs it one
-- period from its end (package and version unchanged); a verified failed charge -> past_due with the FIRST failure time kept; no second
-- payment page while past_due; within 72 hours full use (inGrace), after them limited: no new quote, no new output version, an
-- already-output version stays available; a payment ends it all; an older failure than the last success is stale; a paid period that
-- ran out without a renewal gets the same 3 days; LIFETIME / legacy style plans are never limited; billing off again = inert.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (phase rows are test devices of the DB owner).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.zu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4010000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.zq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4011000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.zsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.zpay(p_event text, p_type text, p_attempt uuid, p_at timestamptz, p_amount int DEFAULT 3000)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.zsvc();
  r := public.record_verified_subscription_event_and_activate('payplus', p_event, p_type, p_attempt, p_at, repeat('e', 64), p_amount, 'ILS');
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.zintent(p_user uuid, p_period text, p_key text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.zsvc(); r := public.create_package_checkout_intent(p_user, p_period, p_key); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.zdigest(p_user uuid, p_quote uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)) $$;
CREATE OR REPLACE FUNCTION tst.zout(p_user uuid, p_quote uuid, p_channel text DEFAULT 'send') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := tst.zdigest(p_user, p_quote); p jsonb; r jsonb;
BEGIN
  PERFORM tst.zsvc();
  p := public.prepare_quote_output(p_user, p_quote, p_channel, format('out:%s:%s:%s', p_quote, p_channel, d), d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  IF p ->> 'state' IS DISTINCT FROM 'preparing' THEN RETURN p; END IF;
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p ->> 'snapshotPath', jsonb_build_object('size', 100))
  ON CONFLICT (bucket_id, name) DO NOTHING;
  PERFORM tst.zsvc();
  r := public.finalize_quote_output(p_user, (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
-- DB-owner test device: move the paid period / failure time (triggers off for this one statement)
CREATE OR REPLACE FUNCTION tst.zset(p_user uuid, p_paid timestamptz, p_failed timestamptz) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.account_entitlements SET paid_through = p_paid, payment_failed_at = p_failed WHERE user_id = p_user;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;
CREATE OR REPLACE FUNCTION tst.zent(p_user uuid) RETURNS text LANGUAGE sql AS $$
  SELECT account_mode || '/' || coalesce(package_id, '-') || '/' || coalesce(package_period, '-') || '/' || subscription_status || '/v' || entitlement_version
    FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.zbill(p_user uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.account_summary_build(p_user, false) -> 'billing' $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- --------------------------------------------------------------------------------------------------------------------- fixtures
-- 1 Free -> buys the monthly package | 2 LIFETIME on a package row (no style plan) | 3 legacy paid style plan
INSERT INTO auth.users (id, email) SELECT tst.zu(n), format('z401-%s@synthetic.test', n) FROM generate_series(1, 3) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.zu(n), format('z401-%s@synthetic.test', n), format('Synthetic Billing %s', n), 'Local', 'ILS', 'free', 'user', n = 2
    FROM generate_series(1, 3) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.zu(n), 'IL', 'business_settings_country' FROM generate_series(1, 3) n;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id) VALUES (tst.zu(1), 'free_10', NULL), (tst.zu(3), 'paid', 'classic');
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, package_id, package_period, subscription_status)
  VALUES (tst.zu(2), 'paid', NULL, 'all_inclusive', 'month', 'active');
INSERT INTO public.clients (id, company_name, email, user_id) VALUES ('a4012000-0000-4000-8000-000000000001', 'Synthetic Customer Z', 'z401-c@synthetic.test', tst.zu(1));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  VALUES (tst.zq(1), tst.zu(1), 40101, 'draft', 'a4012000-0000-4000-8000-000000000001', 'billing');
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.zq(1), 'Synthetic item', 1, 100, 100);

-- ------------------------------------------------------------------------------------------------------------- B0. billing off
SELECT tst.ok((SELECT phase FROM public.billing_activation WHERE id) = 'off' AND NOT public.paid_account_limited(tst.zu(1))
          AND public.account_billing_state(tst.zu(1)) = '{"paidThrough":null,"graceEndsAt":null,"inGrace":false,"limited":false,"renewalStopped":false,"limitedReason":null}'::jsonb,
  'B0 billing off: no paid period, no grace, never limited');

UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';

-- --------------------------------------------------------------------------------------------- B1-B2. first payment + renewal
DO $$
DECLARE a uuid; r jsonb; t0 timestamptz := now() - interval '20 days'; v1 text;
BEGIN
  a := (tst.zintent(tst.zu(1), 'month', 'billing-z401-user1-month') ->> 'attemptId')::uuid;
  r := tst.zpay('z401-pay-1', 'payment_confirmed', a, t0);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.zent(tst.zu(1)) LIKE 'paid/all_inclusive/month/active/v%'
                 AND (SELECT paid_through FROM public.account_entitlements WHERE user_id = tst.zu(1)) = public.billing_period_end(t0, 'month'),
    'B1 the first payment opens the package; its paid period ends one month after the charge');
  v1 := tst.zent(tst.zu(1));
  r := tst.zpay('z401-pay-2', 'payment_confirmed', a, t0 + interval '29 days');
  PERFORM tst.ok(r ->> 'outcome' = 'applied' AND tst.zent(tst.zu(1)) = v1
                 AND (SELECT paid_through FROM public.account_entitlements WHERE user_id = tst.zu(1))
                     = public.billing_period_end(public.billing_period_end(t0, 'month'), 'month'),
    'B2 a renewal charge (one day early) runs the period one more month from its END; package and version unchanged');
END $$;

-- ------------------------------------------------------------------------------------------------- B3-B6. failed charge + grace
DO $$
DECLARE a uuid; r jsonb; f1 timestamptz := now() - interval '1 hour'; v_before int; b jsonb;
BEGIN
  SELECT attempt_id INTO a FROM public.checkout_attempts WHERE user_id = tst.zu(1) AND idempotency_key = 'billing-z401-user1-month';
  -- the output of the current version before anything fails (it must stay available later)
  PERFORM tst.ok(tst.zout(tst.zu(1), tst.zq(1)) ->> 'state' = 'finalized', 'B3a (fixture) the quote is sent once while paid');
  -- a failure older than the last successful charge changes nothing
  r := tst.zpay('z401-fail-old', 'payment_failed', a, now() - interval '10 days');  -- after the first charge, before the renewal
  PERFORM tst.ok(r ->> 'code' = 'stale_failure' AND tst.zent(tst.zu(1)) LIKE 'paid/all_inclusive/month/active/v%', 'B3 a failure older than the last charge is stale');
  SELECT entitlement_version INTO v_before FROM public.account_entitlements WHERE user_id = tst.zu(1);
  r := tst.zpay('z401-fail-1', 'payment_failed', a, now() + interval '10 days');  -- the renewal attempt fails (a later charge time)
  PERFORM tst.ok(r ->> 'graceStarted' = 'true' AND tst.zent(tst.zu(1)) = format('paid/all_inclusive/month/past_due/v%s', v_before + 1)
                 AND (SELECT status FROM public.subscriptions WHERE attempt_id = a) = 'past_due',
    'B4 a verified failed charge: past_due (version + 1), the subscription row too');
  r := tst.zpay('z401-fail-2', 'payment_failed', a, now() + interval '11 days');  -- PayPlus retries the next day
  PERFORM tst.ok((SELECT payment_failed_at FROM public.account_entitlements WHERE user_id = tst.zu(1)) = now()  -- a future provider time is clamped
                 AND tst.zent(tst.zu(1)) = format('paid/all_inclusive/month/past_due/v%s', v_before + 1),
    'B5 a second failed retry keeps the FIRST failure time (a future provider time clamped to now) - the grace days never restart');
  PERFORM tst.ok(tst.zintent(tst.zu(1), 'month', 'billing-z401-user1-again') ->> 'code' = 'payment_update_required',
    'B6 no second payment page while past_due (the live standing order is retried)');
  -- inside the 3 days: full use
  PERFORM tst.zset(tst.zu(1), (SELECT paid_through FROM public.account_entitlements WHERE user_id = tst.zu(1)), f1);
  b := tst.zbill(tst.zu(1));
  PERFORM tst.ok((b ->> 'inGrace')::boolean AND NOT (b ->> 'limited')::boolean AND b ->> 'graceEndsAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
                 AND NOT public.paid_account_limited(tst.zu(1)),
    'B6b one hour after the failure: in grace, not limited; the summary names the grace end');
  PERFORM tst.ok((b ->> 'graceEndsAt') = to_char(((SELECT paid_through FROM public.account_entitlements WHERE user_id = tst.zu(1)) + interval '72 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'B6d a failure never shortens a period already paid: the grace days end 72 hours after the paid period');
END $$;
SELECT tst.lives(format('INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (%L, %L, 40102, %L)', tst.zq(2), tst.zu(1), 'draft'),
  'B6c in grace a new quote is still created');

-- ------------------------------------------------------------------------------------------------------------- B7. limited mode
SELECT tst.zset(tst.zu(1), now() - interval '80 hours', now() - interval '72 hours');
SELECT tst.ok(public.paid_account_limited(tst.zu(1)) AND (tst.zbill(tst.zu(1)) ->> 'limited')::boolean AND NOT (tst.zbill(tst.zu(1)) ->> 'inGrace')::boolean,
  'B7a the paid period over and 72 hours after the failure: limited');
SELECT tst.ok(tst.zbill(tst.zu(1)) ->> 'limitedReason' = 'payment_failed' AND tst.zbill(tst.zu(1)) ->> 'renewalStopped' = 'false',
  'B7a2 the server says why (Codex audit M-01): a verified failed renewal = payment_failed');
SELECT tst.throws(format('INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (%L, %L, 40103, %L)', tst.zq(3), tst.zu(1), 'draft'),
  'subscription_limited', 'B7b limited: a new quote is refused');
DO $$ DECLARE r jsonb; BEGIN
  r := tst.zout(tst.zu(1), tst.zq(1), 'final_pdf');
  PERFORM tst.ok(r ->> 'alreadyFinalized' = 'true', 'B7c limited: the version already sent is still downloaded / sent again');
  UPDATE public.quote_items SET unit_price = 120, total_price = 120 WHERE quote_id = tst.zq(1);
  r := tst.zout(tst.zu(1), tst.zq(1), 'send');
  PERFORM tst.ok(r ->> 'code' = 'free_issue_limit_reached' AND r ->> 'reason' = 'subscription_limited',
    'B7d limited: a new version is refused (closed-contract code, reason subscription_limited)');
  UPDATE public.quotes SET notes = 'edited while limited' WHERE id = tst.zq(1);
  PERFORM tst.ok((SELECT notes FROM public.quotes WHERE id = tst.zq(1)) = 'edited while limited', 'B7e limited: editing an existing quote still saves; nothing is deleted');
  r := tst.zintent(tst.zu(1), 'month', 'billing-z401-user1-limited');
  PERFORM tst.ok(r ->> 'ok' = 'true' AND r ->> 'attemptId' IS NOT NULL, 'B7f a LIMITED account may open a new payment page (a payment ends limited mode)');
  PERFORM tst.ok(tst.zpay('z401-fail-pending', 'payment_failed', (r ->> 'attemptId')::uuid, now()) ->> 'code' = 'no_live_subscription',
    'B7g a failure of a payment page that never opened a subscription changes nothing');
END $$;

-- -------------------------------------------------------------------------------------------------------------- B8. payment ends it
DO $$ DECLARE a uuid; r jsonb; pt timestamptz; BEGIN
  SELECT attempt_id INTO a FROM public.checkout_attempts WHERE user_id = tst.zu(1) AND idempotency_key = 'billing-z401-user1-month';
  SELECT paid_through INTO pt FROM public.account_entitlements WHERE user_id = tst.zu(1);
  r := tst.zpay('z401-pay-3', 'payment_confirmed', a, now() + interval '12 days');
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.zent(tst.zu(1)) LIKE 'paid/all_inclusive/month/active/v%'
                 AND (SELECT payment_failed_at FROM public.account_entitlements WHERE user_id = tst.zu(1)) IS NULL
                 AND (SELECT paid_through FROM public.account_entitlements WHERE user_id = tst.zu(1))
                     = public.billing_period_end(greatest(pt, now() + interval '12 days'), 'month')
                 AND NOT public.paid_account_limited(tst.zu(1)) AND (SELECT status FROM public.subscriptions WHERE attempt_id = a) = 'active',
    'B8 the retried charge succeeds: active again, the failure cleared, the next period paid, not limited');
END $$;
SELECT tst.lives(format('INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (%L, %L, 40104, %L)', tst.zq(4), tst.zu(1), 'draft'),
  'B8b after the payment a new quote is created again');

-- ------------------------------------------------------------------------------------------ B9. a paid period that ran out unrenewed
SELECT tst.zset(tst.zu(1), now() - interval '23 hours', NULL);
SELECT tst.ok(NOT (tst.zbill(tst.zu(1)) ->> 'inGrace')::boolean AND NOT public.paid_account_limited(tst.zu(1)),
  'B9a the paid period ended 23 hours ago: one day of tolerance for the charge time, no grace yet');
SELECT tst.zset(tst.zu(1), now() - interval '25 hours', NULL);
SELECT tst.ok((tst.zbill(tst.zu(1)) ->> 'inGrace')::boolean AND NOT public.paid_account_limited(tst.zu(1)),
  'B9b a day later without a renewal: the same 3 grace days');
SELECT tst.zset(tst.zu(1), now() - interval '73 hours', NULL);
SELECT tst.ok(public.paid_account_limited(tst.zu(1)), 'B9c 72 hours after the paid period ended without a renewal: limited (20261022100000, Owner 2026-10-21: 3 days)');
SELECT tst.ok(tst.zbill(tst.zu(1)) ->> 'limitedReason' = 'period_ended',
  'B9c2 no failed charge was verified: period_ended - never shown as a failed payment (Codex audit M-01)');
SELECT tst.ok(public.billing_period_end('2026-01-31 10:00:00+02', 'month') = '2026-02-28 10:00:00+02'
          AND public.billing_period_end('2026-03-28 23:30:00+03', 'month') = '2026-04-28 23:30:00+03'
          AND public.billing_period_end('2028-02-29 09:00:00+02', 'year') = '2029-02-28 09:00:00+02',
  'B9d periods run on the Israel calendar (month ends clamp; a late-evening charge keeps its Israel day)');

-- ------------------------------------------------------------------------------------------------- B10. never limited / inert
SELECT tst.zset(tst.zu(2), now() - interval '30 days', now() - interval '30 days');
SELECT tst.zset(tst.zu(3), now() - interval '30 days', now() - interval '30 days');
SELECT tst.ok(NOT public.paid_account_limited(tst.zu(2)) AND NOT public.paid_account_limited(tst.zu(3))
          AND tst.zbill(tst.zu(2)) ->> 'graceEndsAt' IS NULL,
  'B10a a LIFETIME package account and a legacy style plan are never in grace and never limited');
UPDATE public.billing_activation SET phase = 'off' WHERE id;
SELECT tst.ok(NOT public.paid_account_limited(tst.zu(1)) AND NOT (tst.zbill(tst.zu(1)) ->> 'inGrace')::boolean,
  'B10b billing off again: inert (nothing limited, no grace)');
SELECT tst.ok((SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(tst.zbill(tst.zu(1))) k) = 'graceEndsAt,inGrace,limited,limitedReason,paidThrough,renewalStopped',
  'B10c the summary billing block has exactly its keys (20261022300000 / Codex audit M-01: renewalStopped + limitedReason)');
DO $$ BEGIN
  PERFORM tst.login(tst.zu(1));
  PERFORM tst.throws(format('SELECT public.paid_account_limited(%L)', tst.zu(1)), 'permission denied', 'B11 a signed-in user cannot call the billing helpers');
  PERFORM tst.throws(format('SELECT public.billing_record_failed_charge(%L, now())', gen_random_uuid()), 'permission denied', 'B11b ... nor record a failure');
  PERFORM tst.logout();
END $$;

ROLLBACK;
