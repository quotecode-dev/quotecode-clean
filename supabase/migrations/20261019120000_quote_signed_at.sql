-- ============================================================================================================================
-- 20261019120000_quote_signed_at.sql  -  the time a customer signed a quote (server time), for the bell's "the customer signed" item
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-19 (task-control activeTask.signedNotice20261019), typed: "מאשר שינוי ב-L-17 ושדה זמן חתימה חדש במסד:
--   התראה בפעמון כשלקוח חותם על הצעה".
--   quotes.signed_at is written ONLY by the database itself, in the very update in which the customer's signature is added and the
--   quote becomes approved (both public signing paths - public_approve_quote and public_approve_quote_capability - are covered
--   without touching them). An owner marking a quote approved by hand (no signature) records nothing; an insert (a new quote or a
--   duplicate) never carries it; no other write can set, move or clear it (it silently keeps the stored value, so ordinary saves
--   never fail). The same writer-guard pattern as quotes.first_viewed_at (20261009200000). Additive: no existing row changes.
--   Trigger order: guard_quote_immutability_update (g) runs before quotes_first_view_guard / quotes_signed_at_guard (q), unchanged.
-- Rollback of THIS file (only while no data must be kept): DROP TRIGGER quotes_signed_at_guard ON public.quotes;
--   DROP FUNCTION public.quotes_signed_at_guard(); ALTER TABLE public.quotes DROP COLUMN signed_at.
-- ============================================================================================================================

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signed_at timestamptz;
COMMENT ON COLUMN public.quotes.signed_at IS
  'Owner 2026-10-19: the time (server) the customer signed the quote - written only by quotes_signed_at_guard in the update that adds the signature and approves the quote; never set, moved or cleared by any other write.';

CREATE OR REPLACE FUNCTION public.quotes_signed_at_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.signed_at := NULL;
    RETURN NEW;
  END IF;
  IF OLD.signed_at IS NULL
     AND coalesce(NEW.signature, '') <> ''
     AND coalesce(OLD.signature, '') = ''
     AND lower(coalesce(NEW.status::text, '')) IN ('approved', 'paid') THEN
    NEW.signed_at := pg_catalog.now();
  ELSE
    NEW.signed_at := OLD.signed_at;
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quotes_signed_at_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS quotes_signed_at_guard ON public.quotes;
CREATE TRIGGER quotes_signed_at_guard
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_signed_at_guard();
