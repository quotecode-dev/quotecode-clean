-- PayPlus phase 1 (Owner console 2026-10-18, migration 20261021000000). Disposable postgres:17 harness ONLY.
-- Proves: billing off = nothing written; 'prepared' records but never grants; in 'enforced' (a test device - set_billing_phase still
-- refuses it) a VERIFIED confirmed package payment whose amount + currency equal the attempt opens the paid package of the attempt's
-- period in the same transaction (version + 1); a wrong amount, a duplicate / later charge / stale / failed / refund event, another
-- active period, a legacy style plan or LIFETIME change nothing; no payment page for an account that would pay for nothing; an account
-- without an entitlement row gets one; the Free counter stays equal to the ledger; the package gets every style + media; only
-- service_role may call it.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (billing phase rows are test devices of the DB owner).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';  -- entitlements are seeded by hand below

CREATE OR REPLACE FUNCTION tst.yu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a3930000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.ysvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
-- the Edge call: subscription-authority wiring -> record_verified_subscription_event_and_activate (as service_role)
CREATE OR REPLACE FUNCTION tst.ypay(p_event text, p_type text, p_attempt uuid, p_at timestamptz, p_amount int, p_currency text DEFAULT 'ILS')
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.ysvc();
  r := public.record_verified_subscription_event_and_activate('payplus', p_event, p_type, p_attempt, p_at, repeat('e', 64), p_amount, p_currency);
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.yintent(p_user uuid, p_period text, p_key text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.ysvc();
  r := public.create_package_checkout_intent(p_user, p_period, p_key);
  PERFORM tst.logout();
  RETURN r;
END $$;
-- an attempt written directly (test device): an account the intent now refuses still needs one to prove the recorder's guards
CREATE OR REPLACE FUNCTION tst.yattempt(p_user uuid, p_price text, p_key text) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, blocks, market, currency, amount_minor)
  SELECT p_user, p_key, price_id, 0, market, currency, amount_minor FROM public.price_versions WHERE price_id = p_price
  RETURNING attempt_id $$;
CREATE OR REPLACE FUNCTION tst.yent(p_user uuid) RETURNS text LANGUAGE sql AS $$
  SELECT account_mode || '/' || coalesce(style_plan_id, '-') || '/' || coalesce(package_id, '-') || '/' || coalesce(package_period, '-') || '/'
         || subscription_status || '/v' || entitlement_version FROM public.account_entitlements WHERE user_id = p_user $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------- fixtures (Israel)
-- 1 free 0/10 | 2 no entitlement row | 3 legacy paid classic | 4 free 0/10 | 5 LIFETIME paid / visual | 6 free 3/10 used
-- 7 LIFETIME flag on a free_10 row | 8 free (paid in 'prepared')
INSERT INTO auth.users (id, email) SELECT tst.yu(n), format('a393-%s@synthetic.test', n) FROM generate_series(1, 8) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.yu(n), format('a393-%s@synthetic.test', n), format('Synthetic PayPlus %s', n), 'Local', 'ILS', 'free', 'user', n IN (5, 7)
    FROM generate_series(1, 8) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.yu(n), 'IL', 'business_settings_country' FROM generate_series(1, 8) n;
INSERT INTO public.quotes (id, user_id, quote_number, status)
  SELECT format('a3931000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid, tst.yu(6), 93900 + n, 'draft' FROM generate_series(1, 3) n;
DO $$
BEGIN
  SET LOCAL session_replication_role = replica; -- test device: three counted first outputs for account 6 without the snapshot pipeline
  INSERT INTO public.quote_issue_ledger (attempt_id, user_id, quote_id, first_output_channel, idempotency_key, counted_against_free, account_mode_at_event,
                                         customer_binding, content_digest, issuer_digest, presentation_digest, snapshot_path, snapshot_sha256, snapshot_bytes, snapshot_schema_version)
    SELECT gen_random_uuid(), tst.yu(6), format('a3931000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid, 'send', format('out:a393:%s', n), true, 'free_10',
           'synthetic', repeat('a', 64), repeat('b', 64), repeat('c', 64), format('synthetic/a393/%s', n), repeat('d', 64), 100, 1 FROM generate_series(1, 3) n;
  SET LOCAL session_replication_role = origin;
END $$;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed) VALUES
  (tst.yu(1), 'free_10', NULL, 0), (tst.yu(3), 'paid', 'classic', 0), (tst.yu(4), 'free_10', NULL, 0), (tst.yu(5), 'paid', 'visual', 0),
  (tst.yu(6), 'free_10', NULL, 3), (tst.yu(7), 'free_10', NULL, 0), (tst.yu(8), 'free_10', NULL, 0);

-- ---------------------------------------------------------------------------------------------------------------- billing off
SELECT tst.ok((tst.ypay('pp-off-1', 'payment_confirmed', gen_random_uuid(), now(), 30600) ->> 'code') = 'billing_off',
              'Y0 billing off (today): the verified event is refused, nothing is written');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.subscription_events WHERE provider_event_id = 'pp-off-1') AND tst.yent(tst.yu(1)) = 'free_10/-/-/-/none/v1',
              'Y0b billing off: no event row, the account is unchanged');

-- ---------------------------------------------------------------------------------------------------------------- 'prepared' never grants
SELECT public.set_billing_phase('prepared', 'TEST: PayPlus phase 1 - prepared');
DO $$
DECLARE a uuid; r jsonb;
BEGIN
  a := (tst.yintent(tst.yu(8), 'month', 'payplus-p1-user8-month') ->> 'attemptId')::uuid;
  r := tst.ypay('pp-evt-prep', 'payment_confirmed', a, '2026-10-18 09:00:00+00', 3000);
  PERFORM tst.ok(r ->> 'outcome' = 'applied' AND r ->> 'activated' = 'false' AND r ->> 'code' = 'billing_not_enforced'
                 AND tst.yent(tst.yu(8)) = 'free_10/-/-/-/none/v1', 'Y1 prepared (sandbox / test): the payment is recorded, the subscription never opens');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- enforced (test device)
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;
DO $$
DECLARE a uuid; r jsonb;
BEGIN
  r := tst.yintent(tst.yu(1), 'year', 'payplus-p1-user1-year');
  a := (r ->> 'attemptId')::uuid;
  PERFORM tst.ok((r ->> 'amountMinor')::int = 30600 AND r ->> 'currency' = 'ILS', 'Y2 the IL annual attempt = 30600 ILS (306.00)');
  r := tst.ypay('pp-evt-low', 'payment_confirmed', a, '2026-10-18 09:30:00+00', 100);
  -- 20261022100000 (Codex audit H04): recorded as rejected BEFORE anything advances - no subscription row, no event time
  PERFORM tst.ok(r ->> 'outcome' = 'rejected' AND r ->> 'code' = 'amount_mismatch' AND r ->> 'activated' = 'false'
                 AND tst.yent(tst.yu(1)) = 'free_10/-/-/-/none/v1',
                 'Y3 a charge of 1.00 for a 306.00 attempt is recorded as rejected and opens nothing');
  PERFORM tst.ok((SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'pending'
                 AND NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE attempt_id = a)
                 AND (SELECT outcome FROM public.subscription_events WHERE provider_event_id = 'pp-evt-low') = 'rejected',
                 'Y3b that attempt never counts as a live subscription and no event time advanced; the rejected event row stays');
END $$;
DO $$
DECLARE a uuid; old uuid; r jsonb;
BEGIN
  -- an unpaid monthly link created BEFORE the annual payment (the user opened two payment pages)
  old := (tst.yintent(tst.yu(1), 'month', 'payplus-p1-user1-month-old') ->> 'attemptId')::uuid;
  a := tst.yattempt(tst.yu(1), 'il_all_inclusive_year_p1', 'payplus-p1-user1-year-b');
  r := tst.ypay('pp-evt-cur', 'payment_confirmed', a, '2026-10-18 09:40:00+00', 30600, 'USD');
  PERFORM tst.ok(r ->> 'code' = 'amount_mismatch' AND tst.yent(tst.yu(1)) = 'free_10/-/-/-/none/v1', 'Y4 another currency opens nothing');
  a := tst.yattempt(tst.yu(1), 'il_all_inclusive_year_p1', 'payplus-p1-user1-year-c');
  r := tst.ypay('pp-evt-1', 'payment_confirmed', a, '2026-10-18 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'ok' = 'true' AND r ->> 'outcome' = 'applied' AND r ->> 'activated' = 'true' AND r ->> 'packagePeriod' = 'year',
                 'Y5 a verified confirmed payment of the exact amount opens the subscription');
  PERFORM tst.ok(tst.yent(tst.yu(1)) = 'paid/-/all_inclusive/year/active/v2', 'Y6 the account = paid annual package, active, version + 1');
  PERFORM tst.ok((SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'confirmed'
                 AND (SELECT status FROM public.subscriptions WHERE attempt_id = a) = 'active', 'Y7 attempt confirmed, subscription active');
  PERFORM tst.ok((SELECT count(*) FROM public.subscription_events WHERE attempt_id = a AND provider = 'payplus' AND verified) = 1,
                 'Y8 one append-only verified event row = the audit of the transition');
  r := tst.ypay('pp-evt-1', 'payment_confirmed', a, '2026-10-18 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'duplicate' = 'true' AND tst.yent(tst.yu(1)) = 'paid/-/all_inclusive/year/active/v2', 'Y9 the same callback again = a no-op');
  r := tst.ypay('pp-evt-2', 'payment_confirmed', a, '2027-10-18 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'outcome' = 'applied' AND tst.yent(tst.yu(1)) = 'paid/-/all_inclusive/year/active/v2', 'Y10 a renewal charge of the same active package keeps the package and its version (20261021200000 extends its paid period - test 401)');
  r := tst.ypay('pp-evt-2b', 'payment_confirmed', a, '2027-11-18 10:00:00+00', 100);
  PERFORM tst.ok(r ->> 'code' = 'amount_mismatch' AND tst.yent(tst.yu(1)) = 'paid/-/all_inclusive/year/active/v2'
                 AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'confirmed'
                 AND (SELECT status FROM public.subscriptions WHERE attempt_id = a) = 'active',
                 'Y10b a wrong-amount renewal is recorded and never downgrades the live subscription');
  r := tst.ypay('pp-evt-0', 'payment_confirmed', a, '2026-10-01 10:00:00+00', 30600);
  PERFORM tst.ok(r ->> 'outcome' = 'stale' AND r ->> 'activated' IS NULL AND tst.yent(tst.yu(1)) = 'paid/-/all_inclusive/year/active/v2', 'Y11 an older event is stale');
  PERFORM tst.ok(tst.yintent(tst.yu(1), 'month', 'payplus-p1-user1-month') ->> 'code' = 'already_subscribed', 'Y12 no second payment page while a package is active');
  PERFORM tst.ok((SELECT state FROM public.checkout_attempts WHERE attempt_id = old) = 'expired', 'Y13 the activation expired the older unpaid link');
  r := tst.ypay('pp-evt-old', 'payment_confirmed', old, '2026-10-19 10:00:00+00', 3000);
  PERFORM tst.ok(r ->> 'outcome' = 'rejected' AND r ->> 'activated' IS NULL AND tst.yent(tst.yu(1)) = 'paid/-/all_inclusive/year/active/v2',
                 'Y13b paying the old link later is rejected (visible), never a second subscription');
  a := tst.yattempt(tst.yu(1), 'il_all_inclusive_month_p1', 'payplus-p1-user1-month-direct');
  r := tst.ypay('pp-evt-other', 'payment_confirmed', a, '2026-10-19 11:00:00+00', 3000);
  PERFORM tst.ok(r ->> 'code' = 'another_package_active' AND tst.yent(tst.yu(1)) = 'paid/-/all_inclusive/year/active/v2'
                 AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'failed',
                 'Y13c another period never flips the active annual package and never counts');
  PERFORM tst.ok(public.account_billing_period(tst.yu(1)) = 'year', 'Y13d the account billing period (admin / summary) stays year');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- no activation
DO $$
DECLARE a uuid; r jsonb;
BEGIN
  a := (tst.yintent(tst.yu(4), 'month', 'payplus-p1-user4-month') ->> 'attemptId')::uuid;
  r := tst.ypay('pp-evt-fail', 'payment_failed', a, '2026-10-18 11:00:00+00', 3000);
  PERFORM tst.ok(r ->> 'outcome' = 'policy_pending' AND r ->> 'activated' IS NULL AND tst.yent(tst.yu(4)) = 'free_10/-/-/-/none/v1',
                 'Y14 a failed payment is recorded and opens nothing');
  PERFORM tst.ok((SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'pending', 'Y15 the attempt stays pending');
  r := tst.ypay('pp-evt-refund', 'refund', a, '2026-10-18 11:05:00+00', 3000);
  PERFORM tst.ok(r ->> 'outcome' = 'policy_pending' AND tst.yent(tst.yu(4)) = 'free_10/-/-/-/none/v1', 'Y16 a refund opens nothing (OPEN-09)');
  r := tst.ypay('pp-evt-unknown', 'payment_confirmed', 'a3939999-0000-4000-8000-000000000001', '2026-10-18 11:10:00+00', 3000);
  PERFORM tst.ok(r ->> 'code' = 'unknown_attempt', 'Y17 an unknown attempt is refused');
  PERFORM tst.ysvc();
  a := ((public.create_checkout_intent(tst.yu(4), 'classic', 0, 'payplus-p1-user4-legacy')) ->> 'attemptId')::uuid;
  PERFORM tst.logout();
  r := tst.ypay('pp-evt-legacy', 'payment_confirmed', a, '2026-10-18 14:00:00+00', 2900);
  PERFORM tst.ok(r ->> 'code' = 'not_a_package_attempt' AND tst.yent(tst.yu(4)) = 'free_10/-/-/-/none/v1', 'Y18 a legacy plan attempt never opens the package');
END $$;

DO $$
DECLARE a uuid; r jsonb;
BEGIN
  a := (tst.yintent(tst.yu(2), 'month', 'payplus-p1-user2-month') ->> 'attemptId')::uuid;
  r := tst.ypay('pp-evt-u2', 'payment_confirmed', a, '2026-10-18 12:00:00+00', 3000);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.yent(tst.yu(2)) = 'paid/-/all_inclusive/month/active/v1',
                 'Y19 an account without an entitlement row gets the monthly package row');
  a := (tst.yintent(tst.yu(6), 'month', 'payplus-p1-user6-month') ->> 'attemptId')::uuid;
  r := tst.ypay('pp-evt-u6', 'payment_confirmed', a, '2026-10-18 12:10:00+00', 3000);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.yent(tst.yu(6)) = 'paid/-/all_inclusive/month/active/v2'
                 AND (SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.yu(6)) = 3,
                 'Y20 an account that used 3 of 10 opens the package; the Free counter stays equal to the ledger');
END $$;

DO $$
DECLARE a uuid; r jsonb;
BEGIN
  PERFORM tst.ok(tst.yintent(tst.yu(3), 'month', 'payplus-p1-user3-month') ->> 'code' = 'already_subscribed'
                 AND tst.yintent(tst.yu(5), 'year', 'payplus-p1-user5-year') ->> 'code' = 'already_subscribed'
                 AND tst.yintent(tst.yu(7), 'year', 'payplus-p1-user7-year') ->> 'code' = 'already_subscribed',
                 'Y21 no payment page for a legacy paid plan or LIFETIME (they would pay for nothing)');
  a := tst.yattempt(tst.yu(3), 'il_all_inclusive_month_p1', 'payplus-p1-user3-direct');
  r := tst.ypay('pp-evt-u3', 'payment_confirmed', a, '2026-10-18 13:00:00+00', 3000);
  PERFORM tst.ok(r ->> 'outcome' = 'applied' AND r ->> 'activated' = 'false' AND r ->> 'code' = 'legacy_paid_account'
                 AND tst.yent(tst.yu(3)) = 'paid/classic/-/-/none/v1', 'Y22 a legacy paid account is recorded but never converted');
  a := tst.yattempt(tst.yu(5), 'il_all_inclusive_year_p1', 'payplus-p1-user5-direct');
  r := tst.ypay('pp-evt-u5', 'payment_confirmed', a, '2026-10-18 13:30:00+00', 30600);
  PERFORM tst.ok(r ->> 'code' = 'legacy_paid_account' AND tst.yent(tst.yu(5)) = 'paid/visual/-/-/none/v1', 'Y23 LIFETIME (paid / visual) is never converted');
  a := tst.yattempt(tst.yu(7), 'il_all_inclusive_year_p1', 'payplus-p1-user7-direct');
  r := tst.ypay('pp-evt-u7', 'payment_confirmed', a, '2026-10-18 13:40:00+00', 30600);
  PERFORM tst.ok(r ->> 'code' = 'legacy_paid_account' AND tst.yent(tst.yu(7)) = 'free_10/-/-/-/none/v1', 'Y24 a LIFETIME flag on a free_10 row is never converted');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- rights + grants
SELECT tst.ok(public.resolve_style_media_entitlement('paid', NULL) @> '{"allowedStyles": ["classic", "modern", "visual"], "mediaAllowed": true}'::jsonb
              AND public.resolve_style_media_entitlement('paid', NULL) ->> 'source' = 'approved_policy', 'Y25 the package gets every style + media (policy v1)');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.record_verified_subscription_event_and_activate(text,text,text,uuid,timestamptz,text,integer,text)', 'execute')
              AND NOT has_function_privilege('anon', 'public.record_verified_subscription_event_and_activate(text,text,text,uuid,timestamptz,text,integer,text)', 'execute')
              AND has_function_privilege('service_role', 'public.record_verified_subscription_event_and_activate(text,text,text,uuid,timestamptz,text,integer,text)', 'execute'),
              'Y26 only service_role (the Edge after verification) may call it');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.create_package_checkout_intent(uuid,text,text,boolean)', 'execute'), 'Y27 the intent grants are unchanged');
SELECT tst.throws($$ SELECT public.set_billing_phase('enforced', 'TEST: still refused') $$, 'billing_provider_unverified', 'Y28 enforced still cannot be set (OPEN-12)');
UPDATE public.billing_activation SET phase = 'off', reason = 'TEST: back to off' WHERE id;

ROLLBACK;
