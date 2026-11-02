-- Owner console 2026-11-02 (stage 1 of docs/SPEC_CUSTOMER_EMAILS_2026-11-02.md): the failed-renewal emails - closed to the app, one claim, nothing about the old.
BEGIN;
SELECT tst.seed();

-- closed to the app
SELECT tst.ok(NOT has_table_privilege('authenticated', 'public.customer_notices', 'SELECT'), 'the notices are closed to a user');
SELECT tst.ok(NOT has_table_privilege('anon', 'public.customer_notice_settings', 'SELECT'), 'the settings are closed to the public');
SELECT tst.ok(has_table_privilege('service_role', 'public.customer_notices', 'SELECT'), 'the service role can read');
SELECT tst.ok(NOT has_table_privilege('service_role', 'public.customer_notices', 'INSERT'), 'the service role writes only through the claim');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.customer_notice_facts(uuid)', 'EXECUTE'), 'a user cannot read the facts');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.customer_notice_claim(uuid,text,timestamptz,integer,text)', 'EXECUTE'), 'a user cannot claim');
SELECT tst.ok(has_function_privilege('service_role', 'public.customer_notice_complete(uuid,text,timestamptz,integer,text,text,text)', 'EXECUTE'), 'the service role can record');
SELECT tst.ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.customer_notices'::regclass), 'row security is forced');

-- starts at test, and the watcher knows the job
SELECT tst.ok((SELECT phase = 'test' FROM public.customer_notice_settings), 'starts in the test phase');
SELECT tst.ok(EXISTS (SELECT 1 FROM public.scheduled_jobs WHERE job = 'customer-notices' AND kind = 'daily'), 'the watcher knows the job');

-- 'live' needs a start time, so no email can go about an old event
DO $$
BEGIN
  BEGIN
    UPDATE public.customer_notice_settings SET phase = 'live', live_since = NULL;
    PERFORM tst.ok(false, 'live without a start time is refused');
  EXCEPTION WHEN check_violation THEN
    PERFORM tst.ok(true, 'live without a start time is refused');
  END;
END $$;

-- one winner for a claim; an outcome that is known is final; a refusal can be tried again with a new key
DO $$
DECLARE v_user uuid := gen_random_uuid(); v_at timestamptz := now();
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user, 'notice-457@example.com');
  PERFORM tst.ok(public.customer_notice_claim(v_user, 'failed_day1', v_at, 0, 'customer-notice/k1') = 'customer-notice/k1', 'the first claim wins');
  PERFORM tst.ok(public.customer_notice_claim(v_user, 'failed_day1', v_at, 0, 'customer-notice/k2') IS NULL, 'a second claim loses');
  PERFORM tst.ok(public.customer_notice_complete(v_user, 'failed_day1', v_at, 0, 'customer-notice/k1', 'sent', 'p1'), 'the outcome is recorded');
  PERFORM tst.ok(public.customer_notice_claim(v_user, 'failed_day1', v_at, 0, 'customer-notice/k3') IS NULL, 'a sent email is never claimed again');
  PERFORM tst.ok(public.customer_notice_claim(v_user, 'failed_day2', v_at, 0, 'customer-notice/k4') = 'customer-notice/k4', 'the next stage has its own claim');
  PERFORM tst.ok(NOT public.customer_notice_complete(v_user, 'failed_day2', v_at, 0, 'customer-notice/other', 'sent'), 'a wrong key records nothing');
  PERFORM tst.ok(public.customer_notice_complete(v_user, 'failed_day2', v_at, 0, 'customer-notice/k4', 'failed'), 'a refusal is recorded');
  PERFORM tst.ok(public.customer_notice_claim(v_user, 'failed_day2', v_at, 0, 'customer-notice/k5') = 'customer-notice/k5', 'a refusal may try again with a new key');
  PERFORM tst.ok(public.customer_notice_complete(v_user, 'failed_day2', v_at, 0, 'customer-notice/k5', 'unknown'), 'an unknown outcome is recorded');
  PERFORM tst.ok(public.customer_notice_claim(v_user, 'failed_day2', v_at, 0, 'customer-notice/k6') = 'customer-notice/k5', 'an unknown outcome keeps its key, so a retry is never a second email');
  PERFORM tst.ok(NOT public.customer_notice_complete(v_user, 'failed_day2', v_at, 0, 'customer-notice/k5', 'nonsense'), 'an unknown word is refused');
END $$;

-- who is told: the facts, in each phase
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
CREATE OR REPLACE FUNCTION tst.cu(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('c4570000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
-- 1 test, IL, failed now | 2 real, failed now | 3 test, stopped renewal | 4 test, lifetime | 5 test, unverified | 6 test, limited, failed 4 days ago
-- 7 real, failed 4 days ago | 8 test, international | 9 test, active and paid up
INSERT INTO auth.users (id, email, email_confirmed_at) SELECT tst.cu(n), format('c457-%s@synthetic.test', n), CASE WHEN n = 5 THEN NULL ELSE now() END FROM generate_series(1, 9) n;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.cu(n), format('c457-%s@synthetic.test', n), format('Synthetic notices %s', n), CASE WHEN n = 8 THEN 'International' ELSE 'Local' END,
         CASE WHEN n = 8 THEN 'USD' ELSE 'ILS' END, 'free', 'user', n = 4 FROM generate_series(1, 9) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.cu(n), CASE WHEN n = 8 THEN 'INTERNATIONAL' ELSE 'IL' END, 'business_settings_country'
  FROM generate_series(1, 9) n ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
DELETE FROM public.account_entitlements WHERE user_id IN (SELECT tst.cu(n) FROM generate_series(1, 9) n);
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, package_id, package_period, subscription_status, paid_through, payment_failed_at, renewal_stopped_at)
  SELECT tst.cu(n), 'paid', NULL, 'all_inclusive', 'month', CASE WHEN n = 9 THEN 'active' ELSE 'past_due' END,
         CASE WHEN n IN (6, 7) THEN now() - interval '4 days' WHEN n = 9 THEN now() + interval '10 days' ELSE now() - interval '1 hour' END,
         CASE WHEN n IN (6, 7) THEN now() - interval '4 days' WHEN n = 9 THEN NULL ELSE now() END,
         CASE WHEN n = 3 THEN now() END
  FROM generate_series(1, 9) n;
INSERT INTO public.admin_test_accounts (user_id, marked_by) SELECT tst.cu(n), tst.cu(1) FROM unnest(ARRAY[1, 3, 4, 5, 6, 8, 9]) n;
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;

SELECT tst.ok((SELECT market = 'IL' AND NOT limited AND reason = 'payment_failed' AND email = 'c457-1@synthetic.test' AND grace_ends_at > now() FROM public.customer_notice_facts(tst.cu(1))), 'a marked test account in grace is told, with its stored market');
SELECT tst.ok((SELECT market = 'INTERNATIONAL' FROM public.customer_notice_facts(tst.cu(8))), 'the international account keeps its market');
SELECT tst.ok((SELECT limited AND reason = 'payment_failed' FROM public.customer_notice_facts(tst.cu(6))), 'a limited account is told');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.customer_notice_facts(tst.cu(2))), 'test phase: a real account is told nothing');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.customer_notice_facts(tst.cu(3))), 'a stopped renewal is told nothing');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.customer_notice_facts(tst.cu(4))), 'a lifetime account is told nothing');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.customer_notice_facts(tst.cu(5))), 'an unverified address is told nothing');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.customer_notice_facts(tst.cu(9))), 'an account paid up is told nothing');
DO $$
DECLARE v_at timestamptz;
BEGIN
  SELECT episode_at INTO v_at FROM public.customer_notice_facts(tst.cu(1));
  PERFORM public.customer_notice_claim(tst.cu(1), 'failed_day1', v_at, 0, 'customer-notice/f1');
  PERFORM public.customer_notice_complete(tst.cu(1), 'failed_day1', v_at, 0, 'customer-notice/f1', 'sent');
  PERFORM tst.ok((SELECT sent = '[{"kind": "failed_day1", "seq": 0}]'::jsonb FROM public.customer_notice_facts(tst.cu(1))), 'the facts carry what was already sent in this episode');
END $$;

UPDATE public.customer_notice_settings SET phase = 'live', live_since = now() - interval '1 day';
SELECT tst.ok(EXISTS (SELECT 1 FROM public.customer_notice_facts(tst.cu(2))), 'live: a real account in a new episode is told');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.customer_notice_facts(tst.cu(7))), 'live: nothing about an episode older than the start');
UPDATE public.customer_notice_settings SET phase = 'off', live_since = NULL;
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.customer_notice_facts()), 'off: nobody is told');

ROLLBACK;
