-- Owner 2026-10-23 (typed L-18 / L-22, morning report item 11): the admin log is append-only in the database (20261024000000).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: the service role inserts and reads but cannot update, delete or
-- truncate; even the database owner cannot change or delete a row; erasing the acting admin's account still works (the actor id becomes
-- null, nothing else changes).
BEGIN;
SELECT tst.seed();

CREATE OR REPLACE FUNCTION tst.asvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
GRANT EXECUTE ON FUNCTION tst.asvc() TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) VALUES ('a4130000-0000-4000-8000-000000000001', 'admin-413@synthetic.test') ON CONFLICT DO NOTHING;

DO $$ BEGIN
  PERFORM tst.ok(has_table_privilege('service_role', 'public.admin_audit_log', 'insert') AND has_table_privilege('service_role', 'public.admin_audit_log', 'select')
                 AND NOT has_table_privilege('service_role', 'public.admin_audit_log', 'update') AND NOT has_table_privilege('service_role', 'public.admin_audit_log', 'delete')
                 AND NOT has_table_privilege('service_role', 'public.admin_audit_log', 'truncate')
                 AND NOT has_table_privilege('authenticated', 'public.admin_audit_log', 'select') AND NOT has_table_privilege('anon', 'public.admin_audit_log', 'insert'),
    'G1 the service role inserts and reads only; the app roles have nothing');
END $$;

SELECT tst.asvc();
INSERT INTO public.admin_audit_log (id, actor_user_id, target_user_id, action, outcome)
  VALUES ('a4130000-0000-4000-8000-0000000000aa', 'a4130000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b', 'set_lifetime', 'success');
SELECT tst.ok((SELECT count(*) = 1 FROM public.admin_audit_log WHERE id = 'a4130000-0000-4000-8000-0000000000aa'), 'G2 the service role writes a row');
SELECT tst.throws($q$UPDATE public.admin_audit_log SET outcome = 'failed' WHERE id = 'a4130000-0000-4000-8000-0000000000aa'$q$, 'permission denied', 'G3 the service role cannot change a row');
SELECT tst.throws($q$DELETE FROM public.admin_audit_log WHERE id = 'a4130000-0000-4000-8000-0000000000aa'$q$, 'permission denied', 'G4 the service role cannot delete a row');
SELECT tst.logout();

-- even the database owner (the trigger, not only the grants)
SELECT tst.throws($q$UPDATE public.admin_audit_log SET reason = 'edited' WHERE id = 'a4130000-0000-4000-8000-0000000000aa'$q$, 'append-only', 'G5 the owner cannot change a row');
SELECT tst.throws($q$UPDATE public.admin_audit_log SET actor_user_id = NULL, outcome = 'failed' WHERE id = 'a4130000-0000-4000-8000-0000000000aa'$q$, 'append-only',
  'G6 clearing the actor together with another change is refused');
SELECT tst.throws($q$DELETE FROM public.admin_audit_log WHERE id = 'a4130000-0000-4000-8000-0000000000aa'$q$, 'append-only', 'G7 the owner cannot delete a row');
SELECT tst.throws($q$TRUNCATE public.admin_audit_log$q$, 'append-only', 'G8 the log cannot be truncated');

-- erasing the acting admin's account still works: the actor id becomes null, the history is unchanged
DELETE FROM auth.users WHERE id = 'a4130000-0000-4000-8000-000000000001';
SELECT tst.ok((SELECT actor_user_id IS NULL AND action = 'set_lifetime' AND outcome = 'success' FROM public.admin_audit_log WHERE id = 'a4130000-0000-4000-8000-0000000000aa'),
  'G9 erasing the acting admin clears only the actor id (ON DELETE SET NULL)');

ROLLBACK;
