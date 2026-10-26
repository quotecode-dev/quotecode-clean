-- 20261027300000_security_definer_execute_least_privilege.sql  -  nine SECURITY DEFINER functions no longer callable from outside
-- tekango-migration-contract: mode=transaction replay=required
-- Owner console 2026-10-26 (typed: "מאשר תיקון ממצאי האבטחה 1 עד 5 מדוח הלילה, בשחרור דרך השער"): the Supabase Security Advisor lists
-- SECURITY DEFINER functions that anyone (anon) or any signed-in user can call through the API. Nine of them have no reason to be callable:
--   1. eight TRIGGER functions - they run only as triggers (Postgres checks EXECUTE on a trigger function when the trigger is created,
--      never when it fires; precedent: tasks_guard_row / business_cards_guard_row, revoked since 20261009180000 / Task 24, triggers firing);
--   2. increment_quote_views(uuid) - a legacy view counter with no owner check (anyone could inflate any quote's view count); nothing in the
--      app or the Edge functions calls it - the public quote page uses public_increment_quote_view.
-- The functions the public quote page needs (public_approve_quote*, public_increment_quote_view, public_record_quote_first_view) and the
-- signed-in / admin functions that check their caller themselves are unchanged. No function body, trigger or behaviour changes
-- (guard_quote_immutability keeps the Owner-locked approved -> paid rule of 20261025100000).
--   ROLLBACK (DB owner): GRANT EXECUTE ON FUNCTION <each function below> TO PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.enqueue_quote_attachment_gc() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_business_settings_plan_trial() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_quote_child_immutability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_quote_immutability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_quote_immutability_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_migration() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_quote_number_immutability() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unsection_quote_items_on_section_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_quote_views(uuid) FROM PUBLIC, anon, authenticated;
