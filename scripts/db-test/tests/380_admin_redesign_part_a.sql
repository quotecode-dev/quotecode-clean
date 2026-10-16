-- Admin redesign part A (Owner 2026-10-16) - 20261016100000_admin_redesign_part_a.sql on the disposable DB. The tests share one database,
-- so counts are asserted as DELTAS around this file's own synthetic accounts, and the free_issue phase is restored at the end.
-- Proves: billingPeriod comes only from the active subscription's real price version (year / month / NULL, never a default); the market
-- twin of resolveAdminMarket; the status twin of accountStatus; the dashboard summary and the accounts list are super_admin only, exclude
-- super admins and deleted accounts, filter / sort / page on the server and refuse unknown arguments.
CREATE TEMP TABLE t380 (k text PRIMARY KEY, v jsonb);
GRANT ALL ON t380 TO authenticated;
INSERT INTO t380 SELECT 'phase', to_jsonb(phase) FROM public.subscription_activation WHERE component = 'free_issue';

INSERT INTO auth.users (id, email) VALUES
  ('38000000-0000-4000-8000-0000000000a0', 'admin.380@synthetic.test'),
  ('38000000-0000-4000-8000-0000000000a1', 'local.380@synthetic.test'),
  ('38000000-0000-4000-8000-0000000000a2', 'intl.380@synthetic.test'),
  ('38000000-0000-4000-8000-0000000000a3', 'life.380@synthetic.test'),
  ('38000000-0000-4000-8000-0000000000a4', 'deleted_380@synthetic.test'),
  ('38000000-0000-4000-8000-0000000000a5', 'unknown.380@synthetic.test'),
  ('38000000-0000-4000-8000-0000000000a6', 'paidyear.380@synthetic.test'),
  ('38000000-0000-4000-8000-0000000000a7', 'paidnone.380@synthetic.test');
INSERT INTO public.business_settings (user_id, role) VALUES ('38000000-0000-4000-8000-0000000000a0', 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- the plan system on (shadow) for the whole file, BEFORE the first snapshot, so earlier tests' accounts keep one status
DO $$
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE public.subscription_activation SET phase = 'shadow' WHERE component = 'free_issue';
END $$;

-- the "before" snapshot, as the super admin
SELECT tst.login('38000000-0000-4000-8000-0000000000a0');
INSERT INTO t380 SELECT 'before', public.get_admin_dashboard_summary();
SELECT tst.logout();

DO $$
BEGIN
  SET LOCAL session_replication_role = replica; -- synthetic fixture: legacy fields + a paid subscription without the billing pipeline
  INSERT INTO public.business_settings (user_id, email, business_name, country, role, is_lifetime, trial_ends_at, created_at, last_sign_in) VALUES
    ('38000000-0000-4000-8000-0000000000a1', 'local.380@synthetic.test', 'Zeta Local 380', 'Local', 'user', false, now() + interval '3 day', now() - interval '1 hour', now() - interval '2 minute'),
    ('38000000-0000-4000-8000-0000000000a2', 'intl.380@synthetic.test', 'Alpha Intl 380', 'Germany', 'user', false, now() - interval '3 day', now() - interval '3 day', now() - interval '1 hour'),
    ('38000000-0000-4000-8000-0000000000a3', 'life.380@synthetic.test', 'Mid Life 380', ' israel ', NULL, true, NULL, now() - interval '30 minute', NULL),
    ('38000000-0000-4000-8000-0000000000a4', 'deleted_380@synthetic.test', 'Gone 380', 'Local', 'user', false, NULL, now(), now()),
    ('38000000-0000-4000-8000-0000000000a5', 'unknown.380@synthetic.test', 'Nowhere 380', 'Unknown', 'user', false, NULL, now() - interval '2 day', now() - interval '2 day'),
    ('38000000-0000-4000-8000-0000000000a6', 'paidyear.380@synthetic.test', 'Paid Year 380', 'Local', 'user', false, NULL, now() - interval '5 day', now() - interval '5 day'),
    ('38000000-0000-4000-8000-0000000000a7', 'paidnone.380@synthetic.test', 'Paid None 380', 'Local', 'user', false, NULL, now() - interval '5 day', now() - interval '5 day')
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.account_entitlements (user_id, account_mode, package_id, package_period, subscription_status) VALUES
    ('38000000-0000-4000-8000-0000000000a6', 'paid', 'all_inclusive', 'year', 'active'),
    ('38000000-0000-4000-8000-0000000000a7', 'paid', 'all_inclusive', 'year', 'active');
  INSERT INTO public.checkout_attempts (attempt_id, user_id, idempotency_key, plan_price_id, market, currency, amount_minor, state) VALUES
    ('38000000-0000-4000-8000-0000000000c6', '38000000-0000-4000-8000-0000000000a6', 'tst380paidyear0001', 'il_all_inclusive_year_p1', 'IL', 'ILS', 30600, 'confirmed');
  INSERT INTO public.subscriptions (attempt_id, user_id, status, last_event_time, last_event_id) VALUES
    ('38000000-0000-4000-8000-0000000000c6', '38000000-0000-4000-8000-0000000000a6', 'active', now(), 0);
END $$;

-- billing period: only from the active subscription's real price version
SELECT tst.ok(public.account_billing_period('38000000-0000-4000-8000-0000000000a6') = 'year', 'PERIOD: an active subscription on the annual price -> year');
SELECT tst.ok(public.account_billing_period('38000000-0000-4000-8000-0000000000a7') IS NULL, 'PERIOD: an active entitlement without a subscription row -> NULL (never a default month)');
SELECT tst.ok(public.account_billing_period('38000000-0000-4000-8000-0000000000a1') IS NULL, 'PERIOD: no paid entitlement -> NULL');
SELECT tst.ok((public.account_summary_build('38000000-0000-4000-8000-0000000000a6', false) ->> 'billingPeriod') = 'year', 'SUMMARY: billingPeriod year reaches the account summary');
SELECT tst.ok((public.account_summary_build('38000000-0000-4000-8000-0000000000a7', false) -> 'billingPeriod') = 'null'::jsonb, 'SUMMARY: billingPeriod null when unproven');

-- the market twin
SELECT tst.ok(public.admin_market_of('Local') = 'Local' AND public.admin_market_of('LCL') = 'Local' AND public.admin_market_of(' israel ') = 'Local'
          AND public.admin_market_of('IL') = 'Local' AND public.admin_market_of('International') = 'International' AND public.admin_market_of('Germany') = 'International'
          AND public.admin_market_of('uk') = 'International' AND public.admin_market_of('Unknown') = 'Unknown' AND public.admin_market_of(NULL) = 'Unknown'
          AND public.admin_market_of('local') = 'Unknown', 'MARKET: the SQL twin of resolveAdminMarket');

-- the status twin
SELECT tst.ok(public.admin_account_status('38000000-0000-4000-8000-0000000000a1') = 'trial', 'STATUS: future legacy trial -> trial');
SELECT tst.ok(public.admin_account_status('38000000-0000-4000-8000-0000000000a2') = 'trial_ended', 'STATUS: past legacy trial -> trial_ended');
SELECT tst.ok(public.admin_account_status('38000000-0000-4000-8000-0000000000a3') = 'lifetime', 'STATUS: lifetime flag -> lifetime');
SELECT tst.ok(public.admin_account_status('38000000-0000-4000-8000-0000000000a5') = 'free10_inactive', 'STATUS: no trial, no allocation -> 10 free quotes not yet active');
SELECT tst.ok(public.admin_account_status('38000000-0000-4000-8000-0000000000a6') = 'paid_annual', 'STATUS: active + year -> annual');
SELECT tst.ok(public.admin_account_status('38000000-0000-4000-8000-0000000000a7') = 'paid_unverified', 'STATUS: active without a proven period -> needs verification, never monthly');

-- privileges: anon none; a regular account refused; the super admin served
SELECT tst.ok(NOT has_function_privilege('anon', 'public.get_admin_dashboard_summary()', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[])', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.admin_account_status(uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.account_billing_period(uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.admin_market_of(text)', 'EXECUTE'), 'GRANTS: anon cannot call the admin RPCs; the helpers are internal');
SELECT tst.login('38000000-0000-4000-8000-0000000000a1');
SELECT tst.throws($q$SELECT public.get_admin_dashboard_summary()$q$, 'super_admin required', 'GUARD: a regular account cannot read the dashboard summary');
SELECT tst.throws($q$SELECT public.get_admin_accounts()$q$, 'super_admin required', 'GUARD: a regular account cannot list accounts');
SELECT tst.logout();

SELECT tst.login('38000000-0000-4000-8000-0000000000a0');
INSERT INTO t380 SELECT 'after', public.get_admin_dashboard_summary();
DO $$
DECLARE b jsonb := (SELECT v FROM t380 WHERE k = 'before'); a jsonb := (SELECT v FROM t380 WHERE k = 'after');
  d text;
BEGIN
  PERFORM tst.ok((a ->> 'managedAccounts')::int - (b ->> 'managedAccounts')::int = 6, 'SUMMARY: +6 managed (the deleted_ account and the super admin are excluded)');
  PERFORM tst.ok((a ->> 'registrationsLast24h')::int - (b ->> 'registrationsLast24h')::int = 2, 'SUMMARY: +2 registered in 24h');
  PERFORM tst.ok((a ->> 'signedInLast10m')::int - (b ->> 'signedInLast10m')::int = 1, 'SUMMARY: +1 app entry in 10 minutes');
  PERFORM tst.ok((a #>> '{market,Local}')::int - (b #>> '{market,Local}')::int = 4 AND (a #>> '{market,International}')::int - (b #>> '{market,International}')::int = 1
                 AND (a #>> '{market,Unknown}')::int - (b #>> '{market,Unknown}')::int = 1, 'SUMMARY: market deltas Local +4, International +1, Unknown +1');
  FOREACH d IN ARRAY ARRAY['lifetime', 'paid_annual', 'paid_unverified', 'trial', 'trial_ended', 'free10_inactive'] LOOP
    PERFORM tst.ok((a #>> ARRAY['subscriptionStatus', d])::int - (b #>> ARRAY['subscriptionStatus', d])::int = 1, 'SUMMARY: status ' || d || ' +1');
  END LOOP;
  PERFORM tst.ok((a #>> '{subscriptionStatus,paid_monthly}')::int - (b #>> '{subscriptionStatus,paid_monthly}')::int = 0, 'SUMMARY: monthly +0 (no default month)');
  PERFORM tst.ok(a ->> 'planSystem' = 'active' AND a ->> 'schema' = 'admin-dashboard-summary/v1', 'SUMMARY: schema + plan system state');
END $$;

-- the accounts list: search, filters, sort, paging, unknown arguments
DO $$
DECLARE r jsonb;
BEGIN
  r := public.get_admin_accounts('380', NULL, NULL, 'business_name', 'asc', 2, 0);
  PERFORM tst.ok((r ->> 'total')::int = 6 AND jsonb_array_length(r -> 'rows') = 2, 'LIST: search "380" -> total 6, a page of 2');
  PERFORM tst.ok(r #>> '{rows,0,business_name}' = 'Alpha Intl 380' AND r #>> '{rows,1,business_name}' = 'Mid Life 380', 'LIST: business name ascending');
  r := public.get_admin_accounts('380', NULL, NULL, 'business_name', 'asc', 2, 4);
  PERFORM tst.ok(jsonb_array_length(r -> 'rows') = 2 AND r #>> '{rows,1,business_name}' = 'Zeta Local 380', 'LIST: offset 4 -> the last page');
  r := public.get_admin_accounts('380', 'International', NULL, 'created_at', 'desc', 25, 0);
  PERFORM tst.ok((r ->> 'total')::int = 1 AND r #>> '{rows,0,market}' = 'International' AND r #>> '{rows,0,status}' = 'trial_ended', 'LIST: market filter + status per row');
  r := public.get_admin_accounts('380', NULL, 'lifetime', 'created_at', 'desc', 25, 0);
  PERFORM tst.ok((r ->> 'total')::int = 1 AND r #>> '{rows,0,email}' = 'life.380@synthetic.test', 'LIST: status filter');
  r := public.get_admin_accounts('deleted_380', NULL, NULL, 'created_at', 'desc', 25, 0);
  PERFORM tst.ok((r ->> 'total')::int = 0, 'LIST: a deleted_ account is never listed');
  r := public.get_admin_accounts(NULL, NULL, NULL, 'created_at', 'desc', 25, 0, ARRAY[(SELECT id FROM public.business_settings WHERE user_id = '38000000-0000-4000-8000-0000000000a3')]);
  PERFORM tst.ok((r ->> 'total')::int = 1 AND r #>> '{rows,0,user_id}' = '38000000-0000-4000-8000-0000000000a3', 'LIST: lookup by id (deep link)');
  PERFORM tst.ok(NOT ((r -> 'rows' -> 0) ? 'plan'), 'LIST: the legacy plan field is not returned');
END $$;
SELECT tst.throws($q$SELECT public.get_admin_accounts(NULL, NULL, NULL, 'email', 'asc', 25, 0)$q$, 'invalid argument', 'LIST: an unknown sort is refused');
SELECT tst.ok((SELECT (public.get_admin_accounts(NULL, NULL, NULL, 'plan', 'asc', 25, 0) ->> 'total') IS NOT NULL), 'LIST: sort by plan is accepted');
SELECT tst.ok((SELECT (public.get_admin_accounts(NULL, NULL, NULL, 'indicators', 'desc', 25, 0) ->> 'total') IS NOT NULL), 'LIST: sort by indicators is accepted');
SELECT tst.throws($q$SELECT public.get_admin_accounts(NULL, NULL, NULL, 'created_at', 'asc', 500, 0)$q$, 'invalid argument', 'LIST: a page larger than 100 is refused');
SELECT tst.throws($q$SELECT public.get_admin_accounts(NULL, 'Mars', NULL, 'created_at', 'asc', 25, 0)$q$, 'invalid argument', 'LIST: an unknown market is refused');
SELECT tst.logout();

-- restore the shared phase
DO $$
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE public.subscription_activation SET phase = (SELECT v #>> '{}' FROM t380 WHERE k = 'phase') WHERE component = 'free_issue';
END $$;
