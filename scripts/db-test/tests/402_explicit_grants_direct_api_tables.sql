-- Supabase 2026-10-30 change (migration 20261021300000). Disposable postgres:17 harness ONLY (the harness never grants by default -
-- exactly the post-change behaviour). Proves: the three tables the Edge Functions reach through the Data API carry an explicit
-- service_role grant; anon / authenticated still have no table privilege on them.
-- Owner 2026-10-23 (typed L-18 / L-22, morning report item 11; migration 20261024000000): admin_audit_log is append-only - the service
-- role keeps SELECT and INSERT there (its only use: _shared/adminReauth.ts writeAuditLog) and has no UPDATE / DELETE (proved in 413).
BEGIN;

SELECT tst.ok((SELECT bool_and(has_table_privilege('service_role', 'public.' || t, 'SELECT')
                          AND has_table_privilege('service_role', 'public.' || t, 'INSERT')
                          AND has_table_privilege('service_role', 'public.' || t, 'UPDATE')
                          AND has_table_privilege('service_role', 'public.' || t, 'DELETE'))
                 FROM unnest(ARRAY['admin_reauth_proofs', 'support_digest_runs']) t)
              AND has_table_privilege('service_role', 'public.admin_audit_log', 'SELECT')
              AND has_table_privilege('service_role', 'public.admin_audit_log', 'INSERT'),
  'G1 service_role holds an explicit grant on the three Data API tables (select / insert / update / delete; the append-only admin_audit_log: select / insert)');
SELECT tst.ok((SELECT bool_and(NOT has_table_privilege(r, 'public.' || t, 'SELECT') AND NOT has_table_privilege(r, 'public.' || t, 'INSERT')
                          AND NOT has_table_privilege(r, 'public.' || t, 'UPDATE') AND NOT has_table_privilege(r, 'public.' || t, 'DELETE'))
                 FROM unnest(ARRAY['admin_reauth_proofs', 'admin_audit_log', 'support_digest_runs']) t, unnest(ARRAY['anon', 'authenticated']) r),
  'G2 anon / authenticated still have no privilege on them (reached only through SECURITY DEFINER functions)');

ROLLBACK;
