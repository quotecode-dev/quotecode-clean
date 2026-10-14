-- Disposable-DB platform fixture (LOCAL ONLY; never TEST/Production). Pinned by sha256 in scripts/db-test/migration-contract.json
-- and applied (in one transaction) immediately BEFORE supabase/migrations/20260930000000_converge_mirror_runtime_contract.sql.
--
-- Why: 20260930000000 converges live-platform state that no repo migration creates. It accepts exactly two pre-states per item
-- (its own c_pub_src / c_colacl_src / c_fns[*][2] / c_tbls[*][2] = the TEST "source" values, or the target values) and refuses
-- any third state. A fresh disposable database has neither, so this fixture reproduces EXACTLY the source values that the
-- migration itself declares - nothing more - so the migration runs UNCHANGED and its own postconditions prove the target.
--   * publication supabase_realtime: the Supabase platform default (empty; insert/update/delete/truncate) = c_pub_src
--   * column ACL business_settings.professional_domain: authenticated=aw/postgres = c_colacl_src
--   * function ACLs is_admin(), is_super_admin(), public_increment_quote_view(uuid): c_fns[*][2]
--   * table ACLs business_settings, chat_logs, expenses, quotecode_documents, services: c_tbls[*][2]
-- Negative controls (subscriptions-prep/gate-controls) prove that a missing publication or a drifted ACL makes 20260930000000
-- refuse with its own TKM11 / TKM13 codes, i.e. this fixture is not a bypass.
DO $p$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $p$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO PUBLIC, authenticated, service_role;
REVOKE ALL ON FUNCTION public.public_increment_quote_view(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_increment_quote_view(uuid) TO PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON public.business_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT MAINTAIN ON public.business_settings TO anon;
GRANT SELECT, MAINTAIN ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
GRANT INSERT (professional_domain), UPDATE (professional_domain) ON public.business_settings TO authenticated;

REVOKE ALL ON public.chat_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, MAINTAIN ON public.chat_logs TO authenticated;
GRANT ALL ON public.chat_logs TO service_role;

REVOKE ALL ON public.expenses FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON public.expenses TO anon, authenticated, service_role;
REVOKE ALL ON public.quotecode_documents FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON public.quotecode_documents TO anon, authenticated, service_role;
REVOKE ALL ON public.services FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON public.services TO anon, authenticated, service_role;
