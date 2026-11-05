-- The customer's email on every billing change (migration 20261105100000; Owner console 2026-11-05, typed: "מאשר בניית 10 המיילים מהטבלה
-- במשימת הלילה, שחרור עד הלייב כשהמיילים כבויים ללקוחות עד שאאשר את הנוסחים בבוקר"). Disposable postgres:17 harness ONLY. Proves: its own
-- switch starts at 'test' - only the marked test accounts get facts, a real account none, 'off' nothing; a first purchase, a stopped
-- renewal and a resumed renewal (with its first charge date) each give one fact with what the words need; a sent email is not offered
-- again; a lifetime account never; service role only.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (now() is the same instant throughout).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.nu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4650000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.nsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.nfacts(p_user uuid) RETURNS SETOF jsonb LANGUAGE plpgsql AS $$
BEGIN
  PERFORM tst.nsvc();
  RETURN QUERY SELECT to_jsonb(f) FROM public.customer_notice_billing_facts(p_user) f;
  PERFORM tst.logout();
END $$;
CREATE OR REPLACE FUNCTION tst.nbuy(p_user uuid, p_key text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.nsvc();
  r := public.create_package_checkout_intent(p_user, 'month', p_key, false);
  PERFORM public.record_verified_provider_event('payplus', 'tx-' || p_key, 'payment_confirmed', (r ->> 'attemptId')::uuid, 'rec-' || p_key, 'term-465',
            now() - interval '1 hour', repeat('e', 64), 3000, 'ILS');
  PERFORM tst.logout();
  RETURN (r ->> 'attemptId')::uuid;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- 1, 2 test accounts | 3 a real account | 4 a lifetime test account | 9 the super admin
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
INSERT INTO auth.users (id, email, email_confirmed_at) SELECT tst.nu(n), format('n465-%s@synthetic.test', n), now() FROM generate_series(1, 9) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.nu(n), format('n465-%s@synthetic.test', n), format('Synthetic notices %s', n), 'Local', 'ILS', 'free',
         CASE WHEN n = 9 THEN 'super_admin' ELSE 'user' END, n = 4
    FROM generate_series(1, 9) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.nu(n), 'IL', 'business_settings_country' FROM generate_series(1, 9) n
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.nu(n), 'free_10', NULL, 0 FROM generate_series(1, 9) n;
INSERT INTO public.admin_test_accounts (user_id, marked_by) SELECT tst.nu(n), tst.nu(9) FROM unnest(ARRAY[1, 2, 4]) n ON CONFLICT DO NOTHING;
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;

DO $$
DECLARE f jsonb; b jsonb; a uuid; n int;
BEGIN
  PERFORM tst.ok((SELECT billing_phase FROM public.customer_notice_settings) = 'test', 'N0 the billing emails start at test (off for real customers)');
  FOR n IN 1..3 LOOP PERFORM tst.nbuy(tst.nu(n), format('notices-465-buy-%s', n)); END LOOP;
  SELECT x INTO f FROM tst.nfacts(tst.nu(1)) x WHERE x ->> 'kind' = 'first_purchase';
  PERFORM tst.ok(f IS NOT NULL AND (f -> 'details' ->> 'amountMinor')::int = 3000 AND f -> 'details' ->> 'currency' = 'ILS' AND f -> 'details' ->> 'period' = 'month'
                 AND f ->> 'email' = 'n465-1@synthetic.test' AND f ->> 'market' = 'IL',
    format('N1 a test account''s first purchase gives its fact with the amount, the currency and the period (%s)', f));
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM tst.nfacts(tst.nu(3))), 'N2 in test, a real account gets no billing email');
  -- a stopped renewal (the Owner's tool, confirmed at PayPlus)
  PERFORM tst.nsvc();
  b := public.billing_admin_begin(tst.nu(9), tst.nu(2), 'stop_renewal', false, 0, 'customer asked (synthetic)');
  PERFORM public.billing_admin_finish((b ->> 'actionId')::uuid, 'cancelled', false);
  PERFORM tst.logout();
  SELECT x INTO f FROM tst.nfacts(tst.nu(2)) x WHERE x ->> 'kind' = 'renewal_stopped';
  PERFORM tst.ok(f IS NOT NULL AND (f -> 'details' ->> 'paidThrough')::timestamptz = (SELECT paid_through FROM public.account_entitlements WHERE user_id = tst.nu(2)),
    'N3 a stopped renewal gives its fact with the paid-through date');
  -- the resume of that renewal (nothing charged) gives its fact with the first charge date
  PERFORM tst.nsvc();
  b := public.create_package_checkout_intent(tst.nu(2), 'month', 'notices-465-resume-2', false);
  PERFORM public.record_checkout_attempt_page_and_request((b ->> 'attemptId')::uuid, tst.nu(2), 'https://pay.example/465', 'b4650000-0000-4000-8000-000000000002');
  PERFORM public.record_checkout_pull((b ->> 'attemptId')::uuid, tst.nu(2), (b ->> 'attemptId')::uuid, 'rec-465-resume-2', 3000, 'ILS', repeat('d', 64));
  PERFORM tst.logout();
  SELECT x INTO f FROM tst.nfacts(tst.nu(2)) x WHERE x ->> 'kind' = 'renewal_resumed';
  PERFORM tst.ok(f IS NOT NULL AND (f -> 'details' ->> 'firstChargeAt')::timestamptz = (SELECT paid_through FROM public.account_entitlements WHERE user_id = tst.nu(2))
                 AND (f -> 'details' ->> 'smartPack')::boolean = false AND (f -> 'details' ->> 'amountMinor')::int = 3000,
    format('N4 a resumed renewal gives its fact with the first charge date and its lines (%s)', f));
  -- sent once = not offered again
  SELECT x INTO f FROM tst.nfacts(tst.nu(2)) x WHERE x ->> 'kind' = 'renewal_stopped';
  PERFORM tst.nsvc();
  PERFORM public.customer_notice_claim(tst.nu(2), 'renewal_stopped', (f ->> 'episode_at')::timestamptz, 0, 'customer-notice/n465-y');
  PERFORM public.customer_notice_complete(tst.nu(2), 'renewal_stopped', (f ->> 'episode_at')::timestamptz, 0, 'customer-notice/n465-y', 'sent', 'm1');
  PERFORM tst.logout();
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM tst.nfacts(tst.nu(2)) x WHERE x ->> 'kind' = 'renewal_stopped'), 'N5 a sent email is never offered again');
  -- a lifetime account never; 'off' nothing at all
  PERFORM tst.nbuy(tst.nu(4), 'notices-465-buy-4');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM tst.nfacts(tst.nu(4))), 'N6 a lifetime account never gets a billing email');
  UPDATE public.customer_notice_settings SET billing_phase = 'off';
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM tst.nfacts(NULL)), 'N7 off = no billing email at all');
END $$;

SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.customer_notice_billing_facts(uuid)', 'execute')
              AND NOT has_function_privilege('anon', 'public.customer_notice_billing_facts(uuid)', 'execute')
              AND has_function_privilege('service_role', 'public.customer_notice_billing_facts(uuid)', 'execute'),
  'N8 only the Edge function (service role) reads the billing facts');

ROLLBACK;
