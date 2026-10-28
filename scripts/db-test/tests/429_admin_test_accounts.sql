-- Owner console 2026-10-28 (typed L-22: "... וסימון חשבון בדיקה שלא נספר בסטטיסטיקה"): 20261028100000 the test-account mark. Disposable
-- postgres:17 harness ONLY. ONE transaction, rolled back. Proves: only the Owner marks; never a super admin or an unknown account; a
-- marked account leaves the counts but stays listed with its mark; every real change is audited once; the table is closed to the app.
BEGIN;
SELECT tst.seed();
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';

DO $$
BEGIN
  PERFORM tst.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.admin_test_accounts'::regclass), 'TA1 the table has RLS');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.admin_test_accounts', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.admin_test_accounts', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.admin_test_accounts', 'INSERT') AND NOT has_table_privilege('service_role', 'public.admin_test_accounts', 'DELETE'),
    'TA2 closed to the app and the server - only the Owner''s function writes it');
END $$;

-- a non-owner cannot mark
SELECT tst.login('00000000-0000-4000-8000-00000000000c');
SELECT tst.throws($q$SELECT public.set_admin_test_account('00000000-0000-4000-8000-00000000000b', true)$q$, 'super_admin required', 'TA3 a non-owner cannot mark');
SELECT tst.logout();

SELECT tst.login('00000000-0000-4000-8000-00000000000a');
CREATE TEMP TABLE ta_before AS SELECT public.get_admin_dashboard_summary() AS s, public.get_admin_accounts() AS a;
SELECT tst.ok((SELECT (public.set_admin_test_account('00000000-0000-4000-8000-00000000000b', true)->>'is_test')::boolean), 'TA4 the Owner marks a test account');
SELECT tst.ok((SELECT ((public.get_admin_dashboard_summary()->>'managedAccounts')::int) = ((s->>'managedAccounts')::int) - 1 FROM ta_before), 'TA5 the marked account is not counted');
SELECT tst.ok((SELECT (public.get_admin_dashboard_summary()->>'testAccounts')::int = 1), 'TA6 the marked accounts are reported apart');
SELECT tst.ok((SELECT (public.get_admin_accounts()->>'total')::int = (a->>'total')::int FROM ta_before), 'TA7 the account stays listed');
SELECT tst.ok((SELECT bool_and(((r->>'is_test')::boolean) = (r->>'user_id' = '00000000-0000-4000-8000-00000000000b'))
  FROM jsonb_array_elements(public.get_admin_accounts()->'rows') r), 'TA8 only the marked account carries the mark');
SELECT tst.ok((SELECT count(*) = 1 FROM public.get_admin_audit_log(50) l WHERE l.action = 'mark_test_account' AND l.target_user_id = '00000000-0000-4000-8000-00000000000b'), 'TA9 the mark is audited');
SELECT tst.lives($q$SELECT public.set_admin_test_account('00000000-0000-4000-8000-00000000000b', true)$q$, 'TA10 marking again is harmless');
SELECT tst.ok((SELECT count(*) = 1 FROM public.get_admin_audit_log(50) l WHERE l.action = 'mark_test_account'), 'TA11 ... and writes no second audit row');
SELECT tst.throws($q$SELECT public.set_admin_test_account('00000000-0000-4000-8000-00000000000a', true)$q$, 'unknown account', 'TA12 a super admin is never marked');
SELECT tst.throws($q$SELECT public.set_admin_test_account('00000000-0000-4000-8000-0000000000ff', true)$q$, 'unknown account', 'TA13 only an existing account');
SELECT tst.throws($q$SELECT public.set_admin_test_account('00000000-0000-4000-8000-00000000000c', true)$q$, 'unknown account', 'TA14 only a business account (a bare login is not one)');
SELECT tst.ok((SELECT NOT (public.set_admin_test_account('00000000-0000-4000-8000-00000000000b', false)->>'is_test')::boolean), 'TA15 the Owner removes the mark');
SELECT tst.ok((SELECT (public.get_admin_dashboard_summary()->>'managedAccounts')::int = (s->>'managedAccounts')::int FROM ta_before)
  AND (SELECT (public.get_admin_dashboard_summary()->>'testAccounts')::int = 0), 'TA16 it is counted again');
SELECT tst.ok((SELECT count(*) = 1 FROM public.get_admin_audit_log(50) l WHERE l.action = 'unmark_test_account'), 'TA17 removing the mark is audited');
SELECT tst.logout();

ROLLBACK;
