-- The Codex audit fixes of PayPlus stage 2 (migration 20261022100000; Owner console 2026-10-21). Disposable postgres:17 harness ONLY.
-- Proves: H02 an attachment cannot be REPLACED (file / quote) without SMART PACK once free_issue is enforced (removal stays open,
-- nothing checked before enforcement); H03 a NEW attempt paid after a failed charge carries its own SMART PACK choice while a retried
-- renewal of the same attempt keeps the line; M03 a provider time more than a day ahead is refused; H05 one provider page per
-- attempt (set once, owner + pending only, service_role only); D-1 no renewal callback = limited 72 hours after the paid period.
-- The WHOLE file runs in ONE transaction that is rolled back at the end.
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.fu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4050000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.fq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4051000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.fsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.fintent(p_user uuid, p_key text, p_smart boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.fsvc(); r := public.create_package_checkout_intent(p_user, 'month', p_key, p_smart); PERFORM tst.logout();
  RETURN (r ->> 'attemptId')::uuid; END $$;
CREATE OR REPLACE FUNCTION tst.fpay(p_event text, p_attempt uuid, p_amount int, p_at timestamptz) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.fsvc();
  r := public.record_verified_provider_event('payplus', p_event, 'payment_confirmed', p_attempt, NULL, NULL, p_at, repeat('e', 64), p_amount, 'ILS');
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.fline(p_user uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT smart_pack_line FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.fdev(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  EXECUTE p_sql;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;
CREATE OR REPLACE FUNCTION tst.fpage(p_attempt uuid, p_user uuid, p_url text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN PERFORM tst.fsvc(); v := public.record_checkout_attempt_page(p_attempt, p_user, p_url); PERFORM tst.logout(); RETURN v; END $$;
CREATE OR REPLACE FUNCTION tst.fgetpage(p_attempt uuid, p_user uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN PERFORM tst.fsvc(); v := public.checkout_attempt_page(p_attempt, p_user); PERFORM tst.logout(); RETURN v; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- 1 existing Free (no SMART PACK) with an attachment | 2 LIFETIME | 3 / 4 / 5 buyers | 6 a package that ran out unrenewed
INSERT INTO auth.users (id, email) SELECT tst.fu(n), format('f405-%s@synthetic.test', n) FROM generate_series(1, 6) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.fu(n), format('f405-%s@synthetic.test', n), format('Synthetic audit %s', n), 'Local', 'ILS', 'free', 'user', n = 2
    FROM generate_series(1, 6) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.fu(n), 'IL', 'business_settings_country' FROM generate_series(1, 6) n;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id) VALUES
  (tst.fu(1), 'free_10', NULL), (tst.fu(2), 'paid', 'visual'), (tst.fu(3), 'free_10', NULL), (tst.fu(4), 'free_10', NULL),
  (tst.fu(5), 'free_10', NULL), (tst.fu(6), 'free_10', NULL);
INSERT INTO public.quotes (id, user_id, quote_number, status) SELECT tst.fq(n), tst.fu(CASE WHEN n = 3 THEN 1 ELSE n END), 40500 + n, 'draft'
  FROM generate_series(1, 3) n;
INSERT INTO public.quote_attachments (quote_id, file_name, file_url, file_size, storage_path)
  VALUES (tst.fq(1), 'plan.pdf', 'synthetic/plan.pdf', 10, 'synthetic/plan.pdf'), (tst.fq(2), 'life.pdf', 'synthetic/life.pdf', 10, 'synthetic/life.pdf');

-- ------------------------------------------------------------------------------------------------------ H02 attachments
SELECT tst.lives(format('UPDATE public.quote_attachments SET file_url = %L WHERE quote_id = %L', 'synthetic/other.pdf', tst.fq(1)),
  'F0 not enforced: a replacement is never checked');
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
SELECT tst.throws(format('UPDATE public.quote_attachments SET file_url = %L, storage_path = %L WHERE quote_id = %L', 'synthetic/new.pdf', 'synthetic/new.pdf', tst.fq(1)),
  'smart_pack_required', 'F1 enforced, no SMART PACK: replacing the file of an attachment is refused');
SELECT tst.throws(format('UPDATE public.quote_attachments SET quote_id = %L WHERE quote_id = %L', tst.fq(3), tst.fq(1)),
  'smart_pack_required', 'F1b ... moving it to another quote too');
SELECT tst.lives(format('UPDATE public.quote_attachments SET file_url = %L WHERE quote_id = %L', 'synthetic/life2.pdf', tst.fq(2)),
  'F1c with SMART PACK (LIFETIME) a replacement is saved');
SELECT tst.lives(format('DELETE FROM public.quote_attachments WHERE quote_id = %L', tst.fq(1)), 'F1d removing an attachment is never gated');

-- ------------------------------------------------------------------------------------------------------ billing on (test device)
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;

-- ------------------------------------------------------------------------------------------------------ H03 SMART PACK after a failed charge
DO $$
DECLARE a uuid; b uuid; r jsonb;
BEGIN
  -- 3: paid WITH the line, went limited, buys a NEW package WITHOUT it -> no line
  a := tst.fintent(tst.fu(3), 'audit-f405-user3-a-sp', true);
  r := tst.fpay('f405-3a', a, 4000, now() - interval '40 days');
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.fline(tst.fu(3)), 'F2 user 3 paid the package with SMART PACK');
  PERFORM tst.fdev(format('UPDATE public.account_entitlements SET subscription_status = %L, payment_failed_at = now() - interval %L, paid_through = now() - interval %L WHERE user_id = %L',
                          'past_due', '80 hours', '80 hours', tst.fu(3)));
  b := tst.fintent(tst.fu(3), 'audit-f405-user3-b-nosp', false);
  r := tst.fpay('f405-3b', b, 3000, now() - interval '1 hour');
  PERFORM tst.ok(r ->> 'activated' = 'true' AND NOT tst.fline(tst.fu(3)),
    'F2b a NEW package paid after a failed charge carries its own choice (no SMART PACK) - the old line is not restored for free');
  -- 4: paid WITHOUT the line, went limited, buys a NEW package WITH it -> the line
  a := tst.fintent(tst.fu(4), 'audit-f405-user4-a-nosp', false);
  r := tst.fpay('f405-4a', a, 3000, now() - interval '40 days');
  PERFORM tst.fdev(format('UPDATE public.account_entitlements SET subscription_status = %L, payment_failed_at = now() - interval %L, paid_through = now() - interval %L WHERE user_id = %L',
                          'past_due', '80 hours', '80 hours', tst.fu(4)));
  b := tst.fintent(tst.fu(4), 'audit-f405-user4-b-sp', true);
  r := tst.fpay('f405-4b', b, 4000, now() - interval '1 hour');
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.fline(tst.fu(4)), 'F2c ... and one that adds SMART PACK gets what it paid for');
  -- 5: paid WITH the line, a renewal failed, the SAME standing order is charged again -> keeps the line
  a := tst.fintent(tst.fu(5), 'audit-f405-user5-a-sp', true);
  r := tst.fpay('f405-5a', a, 4000, now() - interval '40 days');
  PERFORM tst.fdev(format('UPDATE public.account_entitlements SET subscription_status = %L, payment_failed_at = now() - interval %L WHERE user_id = %L',
                          'past_due', '10 hours', tst.fu(5)));
  r := tst.fpay('f405-5b', a, 4000, now() - interval '1 hour');
  PERFORM tst.ok(r ->> 'activated' = 'true' AND tst.fline(tst.fu(5))
                 AND (SELECT subscription_status FROM public.account_entitlements WHERE user_id = tst.fu(5)) = 'active',
    'F2d a retried renewal of the same attempt ends the grace days and keeps the SMART PACK line');
END $$;

-- ------------------------------------------------------------------------------------------------------ M03 a future provider time
SELECT tst.ok((tst.fpay('f405-future', tst.fintent(tst.fu(6), 'audit-f405-user6-future', false), 3000, now() + interval '2 days') ->> 'code') = 'invalid_event'
              AND NOT EXISTS (SELECT 1 FROM public.subscription_events WHERE provider_event_id = 'f405-future'),
  'F3 a provider time two days ahead is refused, nothing written');

-- ------------------------------------------------------------------------------------------------------ H05 one page per attempt
DO $$
DECLARE a uuid;
BEGIN
  a := tst.fintent(tst.fu(6), 'audit-f405-user6-page', false);
  PERFORM tst.ok(tst.fgetpage(a, tst.fu(6)) IS NULL, 'F4 a new attempt has no page yet');
  PERFORM tst.ok(tst.fpage(a, tst.fu(6), 'https://payments.payplus.co.il/first') = 'https://payments.payplus.co.il/first',
    'F4b the first page is kept');
  PERFORM tst.ok(tst.fpage(a, tst.fu(6), 'https://payments.payplus.co.il/second') = 'https://payments.payplus.co.il/first'
                 AND tst.fgetpage(a, tst.fu(6)) = 'https://payments.payplus.co.il/first',
    'F4c a second page for the same attempt never replaces it (the stored page is returned)');
  PERFORM tst.ok(tst.fgetpage(a, tst.fu(5)) IS NULL AND tst.fpage(a, tst.fu(5), 'https://payments.payplus.co.il/x') IS NULL,
    'F4d another account never reads or sets it');
  PERFORM tst.ok(tst.fpage(tst.fintent(tst.fu(6), 'audit-f405-user6-page2', false), tst.fu(6), 'http://payments.payplus.co.il/p') IS NULL,
    'F4e a non-https page is never stored');
END $$;
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.record_checkout_attempt_page(uuid,uuid,text)', 'execute')
              AND NOT has_function_privilege('anon', 'public.checkout_attempt_page(uuid,uuid)', 'execute')
              AND has_function_privilege('service_role', 'public.record_checkout_attempt_page(uuid,uuid,text)', 'execute'),
  'F4f only service_role reads / sets a payment page');

-- ------------------------------------------------------------------------------------------------------ D-1 the grace days
SELECT tst.fdev(format('UPDATE public.account_entitlements SET account_mode = %L, package_id = %L, package_period = %L, subscription_status = %L, paid_through = now() - interval %L, payment_failed_at = NULL WHERE user_id = %L',
                       'paid', 'all_inclusive', 'month', 'active', '71 hours', tst.fu(6)));
SELECT tst.ok(NOT public.paid_account_limited(tst.fu(6)), 'F5 no renewal callback, 71 hours after the paid period: still in the 3 grace days');
SELECT tst.fdev(format('UPDATE public.account_entitlements SET paid_through = now() - interval %L WHERE user_id = %L', '73 hours', tst.fu(6)));
SELECT tst.ok(public.paid_account_limited(tst.fu(6)), 'F5b ... 73 hours after it: limited (3 days, Owner 2026-10-21)');
SELECT tst.fdev(format('UPDATE public.account_entitlements SET paid_through = now() - interval %L WHERE user_id = %L', '20 hours', tst.fu(6)));
SELECT tst.ok(public.paid_grace_ends_at(tst.fu(6)) IS NULL, 'F5c the first 24 hours after the period show no grace (an ordinary late renewal)');

ROLLBACK;
