-- Owner console 2026-10-26 (typed approvals: the legacy documents table closed + a fixed search_path): 20261026500000. Disposable
-- postgres:17 harness ONLY. ONE transaction, rolled back. Proves: anon / authenticated hold no grant on public.quotecode_documents and
-- its open policies are gone (the owner policy stays); the six functions carry search_path = public, pg_temp.
BEGIN;
SELECT tst.ok(NOT has_table_privilege('anon', 'public.quotecode_documents', 'SELECT') AND NOT has_table_privilege('anon', 'public.quotecode_documents', 'INSERT')
              AND NOT has_table_privilege('anon', 'public.quotecode_documents', 'UPDATE') AND NOT has_table_privilege('anon', 'public.quotecode_documents', 'DELETE'),
  'T1 anon can neither read nor write the legacy documents table');
SELECT tst.ok(NOT has_table_privilege('authenticated', 'public.quotecode_documents', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.quotecode_documents', 'DELETE')
              AND NOT has_table_privilege('authenticated', 'public.quotecode_documents', 'TRUNCATE'),
  'T2 a signed-in user can neither read nor delete it');
SELECT tst.ok((SELECT count(*) = 0 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotecode_documents'
                AND policyname IN ('Allow public insert/select', 'Public can view documents')),
  'T3 the two open policies are gone');
SELECT tst.ok((SELECT count(*) = 6 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
                AND p.proname IN ('increment_quote_views', 'handle_user_migration', 'save_quote_atomic_version', 'price_versions_immutable', 'append_only_guard', 'account_assets_guard')
                AND p.proconfig @> ARRAY['search_path=public, pg_temp']),
  'T4 the six functions carry a fixed search_path');
ROLLBACK;
