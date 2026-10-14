-- DIAGNOSTIC ONLY (not canonical, never TEST/Production): reproduce the SOURCE ACL state that
-- supabase/migrations/20260930000000_converge_mirror_runtime_contract.sql itself declares (c_colacl_src, c_fns[*][2],
-- c_tbls[*][2]) and that no repo migration creates (it exists only in the live environments). Applied immediately before
-- 20260930000000 so that migration runs UNCHANGED and converges these ACLs to its targets.
GRANT INSERT (professional_domain), UPDATE (professional_domain) ON public.business_settings TO authenticated;

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
