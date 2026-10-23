-- ============================================================================================================================
-- 20261024000000_admin_audit_log_append_only.sql  -  the admin log cannot be changed or deleted, in the database itself
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-23 (typed: "מאשר שינוי ב-L-06, L-09, L-13, L-14, L-17, L-18, L-22, L-25, L-26, L-29: סעיפים 5, 6, 8, 9, 10, 11,
--   12 מדוח הבוקר לפי ההמלצה" - item 11). public.admin_audit_log was append-only only in code (the functions only insert); the service
--   role still held UPDATE / DELETE (20261021300000). Now:
--   * UPDATE / DELETE / TRUNCATE are revoked from the service role (it keeps SELECT and INSERT; the app roles have nothing);
--   * a trigger refuses every change and every delete, whoever runs it - with ONE exception: erasing an admin's account clears that
--     admin's id in the rows (actor_user_id ON DELETE SET NULL, 20261016000200); that exact change, and nothing else, passes;
--   * TRUNCATE is refused too.
-- Rollback of THIS file: DROP TRIGGER admin_audit_log_append_only, admin_audit_log_no_truncate ON public.admin_audit_log;
--   DROP FUNCTION public.admin_audit_log_append_only(); GRANT UPDATE, DELETE ON TABLE public.admin_audit_log TO service_role.
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.admin_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN -- (OLD / NEW exist only for a row trigger: never read them for TRUNCATE)
    IF OLD.actor_user_id IS NOT NULL AND NEW.actor_user_id IS NULL
       AND (to_jsonb(NEW) - 'actor_user_id') = (to_jsonb(OLD) - 'actor_user_id') THEN
      RETURN NEW; -- the erasure of the acting admin's account (ON DELETE SET NULL); the history itself is unchanged
    END IF;
  END IF;
  RAISE EXCEPTION 'admin_audit_log is append-only' USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION public.admin_audit_log_append_only() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS admin_audit_log_append_only ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_append_only BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_append_only();
DROP TRIGGER IF EXISTS admin_audit_log_no_truncate ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_no_truncate BEFORE TRUNCATE ON public.admin_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.admin_audit_log_append_only();

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.admin_audit_log FROM service_role;
GRANT SELECT, INSERT ON TABLE public.admin_audit_log TO service_role;
