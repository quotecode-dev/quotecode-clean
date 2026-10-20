-- ============================================================================================================================
-- 20261021300000_explicit_grants_direct_api_tables.sql  -  explicit Data API grants for the three tables the Edge Functions reach
--                                                           directly (Supabase change of 2026-10-30)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Supabase notice to the project owner (2026-10-20, "Final notice: new tables in "public" need grants from October 30"): from
--   2026-10-30 a table created in "public" gets NO automatic Data API grant - also when migrations recreate the schema (a new project,
--   a preview branch, a local reset). Existing tables keep their grants, so LIVE does not change. Owner console 2026-10-20: "כן תוסיף
--   בבקשה" (after the read-only check of every migration table).
--   Only three tables are reached through the Data API (supabase-js .from()) and were created without an explicit grant; all three
--   by service_role Edge clients:
--     admin_reauth_proofs   - admin-reauth-verify (insert) + _shared/adminReauth.ts (claim: select / update)
--     admin_audit_log       - _shared/adminReauth.ts writeAuditLog (insert)
--     support_digest_runs   - support-digest (upsert / update / delete of the day's claim)
--   They get exactly the service_role grant Supabase gives today. anon / authenticated stay revoked (their earlier REVOKE ALL is kept;
--   these tables are reached by signed-in users only through SECURITY DEFINER functions). Every other table is either granted
--   explicitly already or reached only through SECURITY DEFINER functions.
--   Re-runnable: GRANT is idempotent. Rollback: not needed (the same privileges the platform grants today).
-- ============================================================================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_reauth_proofs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.support_digest_runs TO service_role;
