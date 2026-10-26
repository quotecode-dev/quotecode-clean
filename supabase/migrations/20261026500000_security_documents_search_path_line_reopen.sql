-- 20261026500000_security_documents_search_path_line_reopen.sql  -  the legacy documents table closed, a fixed search_path for six
--                                                                  functions, and the refused SMART PACK line re-opened
-- tekango-migration-contract: mode=transaction replay=required
-- Owner console 2026-10-26 (typed: "מאשר את 1 ו-2: ... וסגירת טבלת המסמכים, כותרות ההגנה, עדכון הספרייה ונתיב החיפוש" and "מאשר את תיקון
-- קריאת הוראת הקבע לפי הסכום הכולל, בשחרור אחד עם תיקוני האבטחה"):
--   1. public.quotecode_documents (legacy; 6 rows, the newest 2026-07-28; no app code reads it) was open to anyone for read / write /
--      delete (policy "Allow public insert/select" = FOR ALL USING (true); full grants to anon + authenticated - the Supabase Security
--      Advisor and the external review both flag it). Every grant of anon / authenticated is revoked and the two open policies are
--      dropped. The rows stay; the admin account erasure reads / deletes it with the service role (unchanged).
--   2. the six functions the Security Advisor lists with a mutable search_path get a fixed one (public, pg_temp - what they resolve today).
--   3. the SMART PACK line refused because PayPlus answers the order without its lines (the Edge function now reads the order total) is
--      re-opened: the same statement as 20261026100000.
--   ROLLBACK (DB owner): re-grant / re-create from 20260830000002 (section quotecode_documents); ALTER FUNCTION ... RESET search_path.

-- 1 ------------------------------------------------------------------------------------------------------------------------------
REVOKE ALL ON public.quotecode_documents FROM anon, authenticated;
DROP POLICY IF EXISTS "Allow public insert/select" ON public.quotecode_documents;
DROP POLICY IF EXISTS "Public can view documents" ON public.quotecode_documents;

-- 2 ------------------------------------------------------------------------------------------------------------------------------
ALTER FUNCTION public.increment_quote_views(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_user_migration() SET search_path = public, pg_temp;
ALTER FUNCTION public.save_quote_atomic_version() SET search_path = public, pg_temp;
ALTER FUNCTION public.price_versions_immutable() SET search_path = public, pg_temp;
ALTER FUNCTION public.append_only_guard() SET search_path = public, pg_temp;
ALTER FUNCTION public.account_assets_guard() SET search_path = public, pg_temp;

-- 3 ------------------------------------------------------------------------------------------------------------------------------
UPDATE public.smart_pack_add_ons a
   SET line_state = NULL, line_at = NULL
 WHERE a.state = 'paid'
   AND a.line_state = 'not_added'
   AND a.period_end > now()
   AND EXISTS (SELECT 1 FROM public.account_entitlements e
                WHERE e.user_id = a.user_id AND e.live_attempt_id = a.package_attempt_id AND e.smart_pack_line = false);
