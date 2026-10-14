-- Task 29 - READ-ONLY postcondition probe for 20261009180000_task18_durable_manual_tasks.sql (A1 of the TEST package).
-- Why: A1's own fail-closed guard accepts ONLY its exact column shape, so once 20261011120000 (A5) has added tasks.kind, re-running A1 is
-- refused by design. The package runner therefore never re-runs A1 on an existing table: it runs this probe and lets
-- scripts/db-test/package/apply-test-package.mjs decide (absent -> apply A1; recognized A1 state, plain or extended by A5 -> verified skip;
-- anything else -> STOP). The probe only READS the catalog and returns ONE json row - it changes nothing and needs no privileges beyond
-- catalog reads. The fingerprints it computes are compared with the values pinned in test-package-plan.json (captured from a fresh install).
SELECT pg_catalog.json_build_object(
  'exists', pg_catalog.to_regclass('public.tasks') IS NOT NULL,
  'relkind', (SELECT c.relkind::text FROM pg_catalog.pg_class c WHERE c.oid = pg_catalog.to_regclass('public.tasks')),
  'rls', (SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid = pg_catalog.to_regclass('public.tasks')),
  'force_rls', (SELECT c.relforcerowsecurity FROM pg_catalog.pg_class c WHERE c.oid = pg_catalog.to_regclass('public.tasks')),
  -- the SAME shape expression A1's own guard uses
  'columns', (SELECT pg_catalog.string_agg(a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' not null' ELSE '' END, ', ' ORDER BY a.attnum)
              FROM pg_catalog.pg_attribute a WHERE a.attrelid = pg_catalog.to_regclass('public.tasks') AND a.attnum > 0 AND NOT a.attisdropped),
  'kind_default', (SELECT pg_catalog.pg_get_expr(d.adbin, d.adrelid) FROM pg_catalog.pg_attrdef d JOIN pg_catalog.pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
                   WHERE d.adrelid = pg_catalog.to_regclass('public.tasks') AND a.attname = 'kind'),
  'constraints', (SELECT pg_catalog.md5(pg_catalog.string_agg(con.conname || '=' || pg_catalog.pg_get_constraintdef(con.oid), ';' ORDER BY con.conname))
                  FROM pg_catalog.pg_constraint con WHERE con.conrelid = pg_catalog.to_regclass('public.tasks')),
  'constraint_names', (SELECT pg_catalog.string_agg(con.conname, ',' ORDER BY con.conname) FROM pg_catalog.pg_constraint con WHERE con.conrelid = pg_catalog.to_regclass('public.tasks')),
  'policies', (SELECT pg_catalog.md5(pg_catalog.string_agg(p.polname || ':' || p.polcmd::text || ':' || p.polpermissive::text || ':' || pg_catalog.array_to_string(p.polroles::regrole[]::text[], '|')
                 || ':' || coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '') || ':' || coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), ''), ';' ORDER BY p.polname))
               FROM pg_catalog.pg_policy p WHERE p.polrelid = pg_catalog.to_regclass('public.tasks')),
  'triggers', (SELECT pg_catalog.string_agg(t.tgname || ':' || t.tgenabled::text || ':' || p.proname, ',' ORDER BY t.tgname)
               FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid WHERE t.tgrelid = pg_catalog.to_regclass('public.tasks') AND NOT t.tgisinternal),
  'guard_fn', (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'tasks_guard_row'),
  'guard_fn_secdef', (SELECT p.prosecdef FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'tasks_guard_row'),
  'indexes', (SELECT pg_catalog.md5(pg_catalog.string_agg(i.relname || '=' || pg_catalog.pg_get_indexdef(i.oid), ';' ORDER BY i.relname))
              FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class i ON i.oid = x.indexrelid WHERE x.indrelid = pg_catalog.to_regclass('public.tasks')),
  -- Task 31: grants from pg_class.relacl (readable by every role) instead of information_schema.role_table_grants, whose rows depend on
  -- the EXECUTING role (only privileges where it is grantor / grantee / member) - the TEST read-only endpoint runs as
  -- supabase_read_only_user, not postgres. Same output format: '<grantee>:<PRIVILEGE>' sorted, for the same four grantees.
  'grants', (SELECT pg_catalog.string_agg(g.grantee || ':' || g.privilege_type, ',' ORDER BY g.grantee, g.privilege_type)
             FROM (SELECT DISTINCT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname::text END AS grantee, a.privilege_type
                     FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
                     LEFT JOIN pg_catalog.pg_roles r ON r.oid = a.grantee
                    WHERE c.oid = pg_catalog.to_regclass('public.tasks')) g
            WHERE g.grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
              -- exactly the table privileges information_schema.role_table_grants reports (PG17's MAINTAIN is not one of them), so the
              -- string is the one the recognized states were captured with - the same comparison, never a narrower one
              AND g.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'))
)::text;
