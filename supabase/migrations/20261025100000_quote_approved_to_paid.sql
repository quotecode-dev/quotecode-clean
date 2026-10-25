-- ============================================================================================================================
-- 20261025100000_quote_approved_to_paid.sql  -  an approved or signed quote may be marked Paid (the status only)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-25 (typed: "מאשר שינוי: הצעה שאושרה או נחתמה אפשר לסמן כשולמה (רק המצב)"): until now an approved / signed
--   quote was fully immutable, so a customer's payment could never be recorded on it. guard_quote_immutability now lets exactly ONE
--   change through on a locked quote: status approved -> paid, with every other column unchanged (the same bookkeeping columns as
--   before stay writable). Paid stays fully locked (no way back to approved, no other status), the signature, signed_at and every
--   content column stay as they are. Body otherwise identical to 20261009200000 (B).
-- Rollback of THIS file: re-run section B of 20261009200000_task20_reminders_automation.sql (the previous body).
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.guard_quote_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  was_immutable boolean;
  new_without_bookkeeping public.quotes;
BEGIN
  was_immutable := (
    LOWER(COALESCE(OLD.status, '')) IN ('approved','paid')
    OR (OLD.signature IS NOT NULL AND OLD.signature <> '')
  );

  IF NOT was_immutable THEN
    RETURN NEW;
  END IF;

  IF NEW.view_count IS DISTINCT FROM OLD.view_count
     AND (
       NEW.view_count IS NULL
       OR NEW.view_count < COALESCE(OLD.view_count, 0)
     ) THEN
    RAISE EXCEPTION
      'Not permitted: view_count cannot decrease or become NULL'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.expiration_reminder_sent IS DISTINCT FROM OLD.expiration_reminder_sent
     AND NEW.expiration_reminder_sent IS NOT TRUE THEN
    RAISE EXCEPTION
      'Not permitted: expiration_reminder_sent cannot be reset'
      USING ERRCODE = '42501';
  END IF;

  new_without_bookkeeping := NEW;

  new_without_bookkeeping.view_count :=
    OLD.view_count;

  new_without_bookkeeping.expiration_reminder_sent :=
    OLD.expiration_reminder_sent;

  new_without_bookkeeping.email_bounced :=
    OLD.email_bounced;

  new_without_bookkeeping.email_bounce_reason :=
    OLD.email_bounce_reason;

  new_without_bookkeeping.email_bounced_at :=
    OLD.email_bounced_at;

  new_without_bookkeeping.first_viewed_at :=
    OLD.first_viewed_at;

  -- Owner 2026-10-25: the one allowed status change on a locked quote - approved -> paid
  IF LOWER(COALESCE(OLD.status, '')) = 'approved' AND LOWER(COALESCE(NEW.status, '')) = 'paid' THEN
    new_without_bookkeeping.status :=
      OLD.status;
  END IF;

  IF new_without_bookkeeping IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Not permitted: this quote is approved/paid/signed and its content can no longer be modified'
    USING ERRCODE = '42501';
END;
$function$;
