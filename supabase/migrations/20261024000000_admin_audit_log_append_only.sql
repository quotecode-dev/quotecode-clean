-- ============================================================================================================================
-- 20261024000000_admin_audit_log_append_only.sql  -  the admin log cannot be changed or deleted, in the database itself
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-23 (typed: "מאשר שינוי ב-L-06, L-09, L-13, L-14, L-17, L-18, L-22, L-25, L-26, L-29: סעיפים 5, 6, 8, 9, 10, 11,
--   12 מדוח הבוקר לפי ההמלצה" - item 11; Codex acceptance spec docs/CODEX_SPEC_NIGHT_FIXES_2026-10-23.md item 11). public.admin_audit_log
--   was append-only only in code (the functions only insert); the service role still held UPDATE / DELETE (20261021300000). Now:
--   * the actor's id is kept as a plain historical id: its link to auth.users (ON DELETE SET NULL, 20261016000200) is removed, so erasing
--     a former admin's account deletes the account and leaves every log row exactly as it was (no edit of history is ever needed);
--   * UPDATE / DELETE / TRUNCATE are revoked from the service role (it keeps SELECT and INSERT; the app roles have nothing);
--   * a trigger refuses every change, delete and truncate, whoever runs it - no exception.
-- Rollback of THIS file: DROP TRIGGER admin_audit_log_append_only, admin_audit_log_no_truncate ON public.admin_audit_log;
--   DROP FUNCTION public.admin_audit_log_append_only(); GRANT UPDATE, DELETE ON TABLE public.admin_audit_log TO service_role;
--   (the link to auth.users is not restored: rows of erased admins keep their historical id).
-- ============================================================================================================================

DO $do$
DECLARE c record;
BEGIN
  FOR c IN SELECT con.conname FROM pg_constraint con
           JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
          WHERE con.conrelid = 'public.admin_audit_log'::regclass AND con.contype = 'f' AND a.attname = 'actor_user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.admin_audit_log DROP CONSTRAINT %I', c.conname);
  END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION public.admin_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
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
