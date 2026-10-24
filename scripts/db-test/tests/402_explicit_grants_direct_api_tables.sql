-- Supabase 2026-10-30 change (migration 20261021300000). Disposable postgres:17 harness ONLY (the harness never grants by default -
-- exactly the post-change behaviour). Proves: the three tables the Edge Functions reach through the Data API carry an explicit
-- service_role grant; anon / authenticated still have no table privilege on them.
BEGIN;

SELECT tst.ok((SELECT bool_and(has_table_privilege('service_role', 'public.' || t, 'SELECT')
                          AND has_table_privilege('service_role', 'public.' || t, 'INSERT')
                          AND has_table_privilege('service_role', 'public.' || t, 'UPDATE')
                          AND has_table_privilege('service_role', 'public.' || t, 'DELETE'))
                 FROM unnest(ARRAY['admin_reauth_proofs', 'admin_audit_log', 'support_digest_runs']) t),
  'G1 service_role holds an explicit select / insert / update / delete grant on the three Data API tables');
SELECT tst.ok((SELECT bool_and(NOT has_table_privilege(r, 'public.' || t, 'SELECT') AND NOT has_table_privilege(r, 'public.' || t, 'INSERT')
                          AND NOT has_table_privilege(r, 'public.' || t, 'UPDATE') AND NOT has_table_privilege(r, 'public.' || t, 'DELETE'))
                 FROM unnest(ARRAY['admin_reauth_proofs', 'admin_audit_log', 'support_digest_runs']) t, unnest(ARRAY['anon', 'authenticated']) r),
  'G2 anon / authenticated still have no privilege on them (reached only through SECURITY DEFINER functions)');

ROLLBACK;
