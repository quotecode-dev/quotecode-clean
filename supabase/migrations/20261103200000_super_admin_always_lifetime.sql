-- ============================================================================================================================
-- 20261103200000_super_admin_always_lifetime.sql  -  the system administrator never depends on a plan
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-11-03 (typed: "מאשר כלל קבוע שמנהל המערכת תמיד נחשב מנוי לכל החיים ולא תלוי במסלול, כולל שינוי ב-L-05 ו-L-22,
--   שחרור עד הלייב"; before it: "תחריג אותו מהר מכל המשתמשים!!! זה חשבון שלא אמור להיות תלוי בשום מסלול בשום צורה"):
--   a business_settings row whose role is 'super_admin' is ALWAYS lifetime (is_lifetime = true) - the one explicit entitlement every
--   plan check already honors (unlimited quotes, SMART PACK, no billing state). It cannot be revoked while the role stays super_admin.
--   * business_settings_super_admin_lifetime (BEFORE INSERT OR UPDATE) forces is_lifetime = true for a super_admin row. Its name sorts
--     BEFORE guard_business_settings_plan_trial_update, so the guard sees the final value.
--   * guard_business_settings_plan_trial(): one added allowance - a super_admin row may become lifetime with plan / trial_ends_at
--     untouched when it was super_admin already or when the database itself appoints it (no signed-in caller); a signed-in user can
--     never reach it by setting their own role.
--   * every existing super_admin row is made lifetime now.
-- Rollback of THIS file: DROP TRIGGER business_settings_super_admin_lifetime ON public.business_settings;
--   DROP FUNCTION public.business_settings_super_admin_lifetime(); re-create guard_business_settings_plan_trial() from 20260908000000
--   (the super admin rows keep is_lifetime = true unless revoked in the admin screen).
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.business_settings_super_admin_lifetime()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.role = 'super_admin' THEN
    NEW.is_lifetime := true;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.business_settings_super_admin_lifetime() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS business_settings_super_admin_lifetime ON public.business_settings;
CREATE TRIGGER business_settings_super_admin_lifetime
  BEFORE INSERT OR UPDATE ON public.business_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.business_settings_super_admin_lifetime();

CREATE OR REPLACE FUNCTION public.guard_business_settings_plan_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role text;
BEGIN
  IF NEW.plan IS NOT DISTINCT FROM OLD.plan
     AND NEW.trial_ends_at IS NOT DISTINCT FROM OLD.trial_ends_at
     AND NEW.is_lifetime IS NOT DISTINCT FROM OLD.is_lifetime THEN
    RETURN NEW;
  END IF;

  -- 20261103200000 (Owner 2026-11-03): the system administrator's row is always lifetime (plan / trial_ends_at unchanged). Allowed when
  -- the row WAS super_admin already, or when the database itself appoints one (no signed-in caller: a migration / the SQL editor).
  -- A signed-in user who sets their own role in the same update never passes here (OLD.role is not super_admin, auth.uid() is set).
  IF NEW.role = 'super_admin' AND NEW.is_lifetime = true AND (OLD.role = 'super_admin' OR auth.uid() IS NULL)
     AND NEW.plan IS NOT DISTINCT FROM OLD.plan AND NEW.trial_ends_at IS NOT DISTINCT FROM OLD.trial_ends_at THEN
    RETURN NEW;
  END IF;

  SELECT role
  INTO caller_role
  FROM public.business_settings
  WHERE user_id = auth.uid();

  IF caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.plan = 'free'
     AND NEW.trial_ends_at IS NULL
     AND NEW.is_lifetime = false THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Not permitted: plan/trial_ends_at/is_lifetime can only be changed by a super admin, or self-cancelled to the free plan'
    USING ERRCODE = '42501';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.guard_business_settings_plan_trial() FROM PUBLIC, anon, authenticated;

UPDATE public.business_settings SET is_lifetime = true WHERE role = 'super_admin' AND is_lifetime IS DISTINCT FROM true;
