-- ============================================================================================================================
-- 20261016000000_account_erasure_contact_stops.sql  -  deleting an account is never blocked by its customer contact stops
-- tekango-migration-contract: mode=transaction replay=required
--
--   Night task 2026-10-16 (A-5 / MIG-1, Owner-approved doc 31eae0a7; proven on the local journey stack: "Business data deleted,
--   but failed to delete the Auth account: Database error deleting user"). customer_contact_stops.user_id references auth.users
--   ON DELETE CASCADE, so erasing an account cascades into this table and fires the BEFORE DELETE guard, which (a) refuses a stop
--   the customer set (source customer_link / bounce: TK_STOP_NOT_LIFTABLE) and (b) for a business stop inserts a reminder_audit row
--   for the user being deleted (an FK violation). Either one aborts the whole account deletion.
--   Change: ONLY when the owning account no longer exists (the cascade of an account erasure - the parent row is already gone in
--   the cascading statement) the row is removed without the business rule and without an audit line. A business still can never
--   lift a customer's own stop; every other path is byte-identical to 20261009200000.
--   Re-runnable: CREATE OR REPLACE FUNCTION (same signature, same owner, same ACL; the trigger is unchanged).
--
--   ROLLBACK (DB owner): re-create public.customer_contact_stops_guard_row() verbatim from 20261009200000.
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.customer_contact_stops_guard_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- the app may only record a business-set stop; customer-link / bounce stops come from server code (service_role)
    IF NEW.source <> 'business' AND current_user <> 'service_role' AND coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'TK_STOP_SOURCE_NOT_ALLOWED' USING ERRCODE = '42501';
    END IF;
    NEW.stopped_at := now();
    INSERT INTO public.reminder_audit (user_id, actor, action, detail)
    VALUES (NEW.user_id, CASE NEW.source WHEN 'business' THEN 'business' WHEN 'customer_link' THEN 'customer' ELSE 'system' END, 'contact_stopped',
            jsonb_build_object('channel', NEW.channel, 'source', NEW.source));
    RETURN NEW;
  END IF;
  -- DELETE as part of erasing the whole account (the owner row is already gone): removed with the account, no rule, no audit line
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
    RETURN OLD;
  END IF;
  -- DELETE: a business may lift only its own business-set stop; a customer's own stop is never lifted by the business
  IF OLD.source <> 'business' THEN
    RAISE EXCEPTION 'TK_STOP_NOT_LIFTABLE' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.reminder_audit (user_id, actor, action, detail)
  VALUES (OLD.user_id, 'business', 'contact_stop_lifted', jsonb_build_object('channel', OLD.channel));
  RETURN OLD;
END
$function$;
REVOKE ALL ON FUNCTION public.customer_contact_stops_guard_row() FROM PUBLIC, anon, authenticated;
