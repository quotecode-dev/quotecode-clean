-- Admin release 2026-10-16 (Owner) - 20261016000200_admin_reauth_proofs_and_audit_log_reissue.sql on the disposable DB.
-- Proves: the re-issued tables exist with RLS on and no anon / authenticated access (service-role only); the audit log is read
-- only through get_admin_audit_log, which refuses a regular account and serves a super admin; the replay is a no-op (harness).
INSERT INTO auth.users (id, email) VALUES
  ('37000000-0000-4000-8000-0000000000a1', 'admin.reissue@synthetic.test'),
  ('37000000-0000-4000-8000-0000000000a2', 'regular.reissue@synthetic.test');
INSERT INTO public.business_settings (user_id, role) VALUES ('37000000-0000-4000-8000-0000000000a1', 'super_admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
INSERT INTO public.admin_audit_log (actor_user_id, target_user_id, action, reason, outcome)
  VALUES ('37000000-0000-4000-8000-0000000000a1', '37000000-0000-4000-8000-0000000000a2', 'grant_lifetime', 'synthetic', 'success');

SELECT tst.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.admin_reauth_proofs'::regclass), 'REISSUE: admin_reauth_proofs has RLS on');
SELECT tst.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.admin_audit_log'::regclass), 'REISSUE: admin_audit_log has RLS on');
SELECT tst.ok(NOT has_table_privilege('anon', 'public.admin_reauth_proofs', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.admin_reauth_proofs', 'SELECT,INSERT,UPDATE'), 'REISSUE: no anon / authenticated access to the proofs');
SELECT tst.ok(NOT has_table_privilege('anon', 'public.admin_audit_log', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.admin_audit_log', 'SELECT,INSERT,UPDATE'), 'REISSUE: no anon / authenticated access to the audit log');
SELECT tst.ok(NOT has_function_privilege('anon', 'public.get_admin_audit_log(int)', 'EXECUTE'), 'REISSUE: anon cannot call get_admin_audit_log');

-- a regular signed-in account is refused; the super admin reads the history
SELECT tst.login('37000000-0000-4000-8000-0000000000a2');
SELECT tst.throws($q$SELECT * FROM public.get_admin_audit_log(10)$q$, 'super_admin role required', 'REISSUE: a regular account cannot read the audit log');
SELECT tst.throws($q$SELECT * FROM public.admin_audit_log$q$, 'permission denied', 'REISSUE: a regular account cannot select the table directly');
SELECT tst.logout();
SELECT tst.login('37000000-0000-4000-8000-0000000000a1');
SELECT tst.ok((SELECT count(*) FROM public.get_admin_audit_log(10) WHERE action = 'grant_lifetime') = 1, 'REISSUE: the super admin reads the audit log through the function');
SELECT tst.logout();
