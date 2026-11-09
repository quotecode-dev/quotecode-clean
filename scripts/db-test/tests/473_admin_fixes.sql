-- Owner console 2026-11-09 (typed: "מאשר את תיקוני האדמין כולל שינוי ב-L-22, שחרור עד הלייב"): 20261109200000_admin_fixes.sql on the
-- disposable DB. ONE transaction, rolled back. Proves: a failed-charge paid account is 'paid_past_due' (and the limited branch exists);
-- the summary counts both new statuses; the users list filters by account type (only / exclude) and accepts the new statuses; the user
-- details counts come from get_admin_account_counts (equal to the real rows, admin only); the audit log cap is 10000.
BEGIN;
SELECT tst.seed();
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
CREATE TEMP TABLE t473 (k text PRIMARY KEY, v jsonb);
GRANT ALL ON t473 TO authenticated;

INSERT INTO auth.users (id, email) VALUES ('47300000-0000-4000-8000-0000000000a1', 'pastdue.473@synthetic.test');
DO $$
BEGIN
  SET LOCAL session_replication_role = replica; -- synthetic fixture: the plan system on (shadow) and a paid account whose last charge failed
  UPDATE public.subscription_activation SET phase = 'shadow' WHERE component = 'free_issue';
  INSERT INTO public.business_settings (user_id, email, business_name, country, role, is_lifetime, created_at)
    VALUES ('47300000-0000-4000-8000-0000000000a1', 'pastdue.473@synthetic.test', 'Past Due 473', 'Local', 'user', false, now() - interval '9 day')
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.account_entitlements (user_id, account_mode, package_id, package_period, subscription_status)
    VALUES ('47300000-0000-4000-8000-0000000000a1', 'paid', 'all_inclusive', 'month', 'past_due');
END $$;

-- the real row counts of account b, read as the database (the check the screen could not make under the owner-only policies)
INSERT INTO t473 SELECT 'expect', jsonb_build_object(
  'quotes', (SELECT count(*) FROM public.quotes WHERE user_id = '00000000-0000-4000-8000-00000000000b'),
  'clients', (SELECT count(*) FROM public.clients WHERE user_id = '00000000-0000-4000-8000-00000000000b'),
  'issued', (SELECT count(*) FROM public.quotes WHERE user_id = '00000000-0000-4000-8000-00000000000b' AND status <> 'draft'));

DO $$
BEGIN
  PERFORM tst.ok(public.admin_account_status('47300000-0000-4000-8000-0000000000a1') = 'paid_past_due', 'AF1 a paid account whose last charge failed -> paid_past_due (never paid / free)');
  PERFORM tst.ok(position('paid_limited' in pg_get_functiondef('public.admin_account_status(uuid)'::regprocedure)) > 0
    AND position('public.paid_account_limited(p_user_id)' in pg_get_functiondef('public.admin_account_status(uuid)'::regprocedure)) > 0,
    'AF2 a limited paid account -> paid_limited (the server''s own limited rule)');
  PERFORM tst.ok(position('10000' in pg_get_functiondef('public.get_admin_audit_log(int)'::regprocedure)) > 0, 'AF3 the audit log cap is 10000 ("all time" is all of it)');
  PERFORM tst.ok(NOT has_function_privilege('anon', 'public.get_admin_account_counts(uuid)', 'EXECUTE'), 'AF4 the counts function is closed to anon');
  PERFORM tst.ok(to_regprocedure('public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[])') IS NULL
    AND to_regprocedure('public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[], text)') IS NOT NULL,
    'AF5 one get_admin_accounts (the old 8-argument version is replaced)');
END $$;

-- a plain user: no admin read
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.throws($q$SELECT public.get_admin_account_counts('00000000-0000-4000-8000-00000000000b')$q$, 'super_admin required', 'AF6 a plain user cannot read the admin counts');
SELECT tst.logout();

SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((SELECT (public.get_admin_dashboard_summary()->'subscriptionStatus'->>'paid_past_due')::int >= 1
  AND (public.get_admin_dashboard_summary()->'subscriptionStatus') ? 'paid_limited'), 'AF7 the summary counts paid_past_due and paid_limited');
SELECT tst.ok((SELECT count(*) = 1 FROM jsonb_array_elements(public.get_admin_accounts(p_status => 'paid_past_due')->'rows') r
  WHERE r->>'user_id' = '47300000-0000-4000-8000-0000000000a1'), 'AF8 the users list filters by paid_past_due');
SELECT tst.lives($q$SELECT public.get_admin_accounts(p_status => 'paid_limited')$q$, 'AF9 paid_limited is an accepted filter');
SELECT tst.throws($q$SELECT public.get_admin_accounts(p_test => 'maybe')$q$, 'invalid argument', 'AF10 an unknown account type is refused');

-- account type: mark b as a test account, then only / exclude
SELECT public.set_admin_test_account('00000000-0000-4000-8000-00000000000b', true);
SELECT tst.ok((SELECT bool_and((r->>'is_test')::boolean) AND count(*) >= 1 FROM jsonb_array_elements(public.get_admin_accounts(p_test => 'only', p_page_size => 100)->'rows') r),
  'AF11 "only" lists the test accounts only');
SELECT tst.ok((SELECT NOT bool_or((r->>'is_test')::boolean) FROM jsonb_array_elements(public.get_admin_accounts(p_test => 'exclude', p_page_size => 100)->'rows') r),
  'AF12 "exclude" lists the real accounts only');
SELECT tst.ok((SELECT (public.get_admin_accounts(p_test => 'only')->>'total')::int + (public.get_admin_accounts(p_test => 'exclude')->>'total')::int
  = (public.get_admin_accounts()->>'total')::int), 'AF13 only + exclude = all');
SELECT tst.ok((SELECT (public.get_admin_accounts(p_test => 'only')->>'total')::int = (public.get_admin_dashboard_summary()->>'testAccounts')::int),
  'AF14 the test card count = the test accounts its button lists');

-- the user details counts = the real rows
SELECT tst.ok((SELECT public.get_admin_account_counts('00000000-0000-4000-8000-00000000000b') - 'schema' = v FROM t473 WHERE k = 'expect'),
  'AF15 the admin counts equal the account''s real quotes, clients and issued quotes');
SELECT tst.ok(public.get_admin_account_counts('00000000-0000-4000-8000-00000000000b')->>'schema' = 'admin-account-counts/v1', 'AF16 the counts carry their schema');
SELECT tst.logout();

ROLLBACK;
