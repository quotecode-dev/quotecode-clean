-- Owner 2026-10-20: the supervisor permissions (20261020200000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: only a super admin grants; never to themselves / a super admin / an unknown user; only known permissions; every change is
-- audited; a supervisor reads exactly the screens granted (accounts / summary / audit log / inquiries / chat logs) and nothing else; a
-- supervisor can never grant; an ordinary user reaches nothing; revoking closes the door at once.
BEGIN;
SELECT tst.seed();
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
INSERT INTO public.support_inbound_messages (provider_event_id, provider_email_id, from_address, received_at) VALUES ('sup-evt-1', 'sup-mail-1', 'c@example.test', now());
INSERT INTO public.chat_logs (user_email, user_question, ai_response, category) VALUES ('someone@example.test', 'q', 'a', 'GENERAL');

DO $$
BEGIN
  PERFORM tst.ok((SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.admin_permission_grants'::regclass), 'grants table: RLS forced');
  PERFORM tst.ok(NOT has_table_privilege('authenticated', 'public.admin_permission_grants', 'insert') AND NOT has_table_privilege('authenticated', 'public.admin_permission_grants', 'delete'), 'grants table: no direct app writes');
END $$;

-- the supervisor-to-be (tenant b) has nothing yet
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.ok((SELECT public.get_my_admin_permissions()) = '{"owner": false, "permissions": []}'::jsonb, 'NOBODY: no permissions yet');
SELECT tst.throws($q$SELECT public.get_admin_accounts()$q$, 'super_admin', 'NOBODY: the accounts RPC is refused');
SELECT tst.throws($q$SELECT public.get_admin_audit_log(5)$q$, 'super_admin', 'NOBODY: the audit log is refused');
SELECT tst.ok((SELECT count(*) FROM public.support_inbound_messages) = 0, 'NOBODY: no inquiries');
SELECT tst.throws($q$SELECT public.set_admin_permissions('00000000-0000-4000-8000-00000000000b', ARRAY['users.view'])$q$, 'super_admin required', 'NOBODY: cannot grant (not even to themselves)');
SELECT tst.logout();

-- the super admin grants users.view + inquiries.view
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((SELECT (public.set_admin_permissions('00000000-0000-4000-8000-00000000000b', ARRAY['users.view', 'inquiries.view', 'users.view'])->>'ok')::boolean), 'OWNER: grants users.view + inquiries.view (duplicates collapse)');
SELECT tst.ok((SELECT count(*) FROM public.admin_permission_grants WHERE user_id = '00000000-0000-4000-8000-00000000000b') = 2, 'OWNER: exactly the two grants');
SELECT tst.ok((SELECT count(*) FROM public.get_admin_audit_log(50) a WHERE a.action = 'set_admin_permissions' AND a.target_user_id = '00000000-0000-4000-8000-00000000000b' AND a.outcome = 'success') = 1, 'OWNER: the change is audited');
SELECT tst.throws($q$SELECT public.set_admin_permissions('00000000-0000-4000-8000-00000000000a', ARRAY['users.view'])$q$, 'invalid target', 'OWNER: never to themselves');
SELECT tst.throws($q$SELECT public.set_admin_permissions('00000000-0000-4000-8000-00000000000b', ARRAY['users.delete'])$q$, 'unknown permission', 'OWNER: only known permissions (no delete / lifetime permission exists)');
SELECT tst.throws($q$SELECT public.set_admin_permissions('00000000-0000-4000-8000-0000000000ff', ARRAY['users.view'])$q$, 'unknown user', 'OWNER: only an existing user');
SELECT tst.ok((SELECT count(*) FROM public.list_admin_permission_holders()) = 1, 'OWNER: lists the holders');
SELECT tst.ok((SELECT (public.get_my_admin_permissions()->>'owner')::boolean), 'OWNER: is the owner');
SELECT tst.logout();

-- the supervisor reads what was granted, and only that
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.ok((SELECT public.get_my_admin_permissions()) = '{"owner": false, "permissions": ["inquiries.view", "users.view"]}'::jsonb, 'SUPERVISOR: sees their two permissions');
SELECT tst.ok(public.has_admin_permission('users.view') AND NOT public.has_admin_permission('ai-support.view'), 'SUPERVISOR: has users.view, not ai-support.view');
SELECT tst.ok((SELECT jsonb_typeof(public.get_admin_dashboard_summary()) = 'object'), 'SUPERVISOR: the dashboard summary works with users.view');
SELECT tst.ok((SELECT count(*) FROM public.business_settings) > 1, 'SUPERVISOR: reads the accounts (users.view)');
SELECT tst.ok((SELECT count(*) FROM public.support_inbound_messages) = 1, 'SUPERVISOR: reads the inquiries (inquiries.view)');
SELECT tst.ok((SELECT count(*) FROM public.support_assistant_settings) = 1, 'SUPERVISOR: reads the assistant settings (inquiries.view)');
SELECT tst.throws($q$SELECT public.get_admin_audit_log(5)$q$, 'super_admin', 'SUPERVISOR: no audit log without activity.view');
SELECT tst.ok((SELECT count(*) FROM public.chat_logs) = 0, 'SUPERVISOR: no chat logs without ai-support.view');
SELECT tst.throws($q$SELECT public.set_admin_permissions('00000000-0000-4000-8000-00000000000b', ARRAY['activity.view'])$q$, 'super_admin required', 'SUPERVISOR: cannot widen their own permissions');
SELECT tst.throws($q$SELECT public.list_admin_permission_holders()$q$, 'super_admin required', 'SUPERVISOR: cannot list the holders');
SELECT tst.throws($q$UPDATE public.support_inbound_messages SET status = 'dismissed'$q$, 'permission denied', 'SUPERVISOR: cannot change an inquiry from the app');
SELECT tst.logout();

-- a plain user (no business row) reaches nothing
SELECT tst.login('00000000-0000-4000-8000-00000000000c');
SELECT tst.throws($q$SELECT public.get_admin_dashboard_summary()$q$, 'super_admin', 'PLAIN-USER: the summary is refused');
SELECT tst.ok((SELECT count(*) FROM public.support_inbound_messages) = 0, 'PLAIN-USER: no inquiries');
SELECT tst.logout();

-- revoking closes the door at once
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((SELECT (public.set_admin_permissions('00000000-0000-4000-8000-00000000000b', ARRAY[]::text[])->>'ok')::boolean), 'OWNER: removes every permission');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.throws($q$SELECT public.get_admin_accounts()$q$, 'super_admin', 'REVOKED: the accounts RPC is refused again');
SELECT tst.ok((SELECT count(*) FROM public.support_inbound_messages) = 0, 'REVOKED: no inquiries again');
SELECT tst.logout();

ROLLBACK;
