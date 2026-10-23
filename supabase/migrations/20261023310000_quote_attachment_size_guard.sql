-- ============================================================================================================================
-- 20261023310000_quote_attachment_size_guard.sql  -  the attachment limits are enforced by the server too
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-23 (typed: "מאשר שינוי ב-L-09, L-13, L-14, L-17, L-22, L-24, L-25, L-26, L-27:" answering "... מכסת הקבצים
--   נאכפת"; morning report 2026-10-23 section D item 4). The editor already refuses a file over 3 MB and a total over 30 MB per business
--   (QuoteForm.jsx), but nothing on the server did: a request sent around the editor could store any size. Every new attachment row is
--   now checked against the REAL stored size (storage.objects metadata, the uploaded bytes; the client's file_size only when larger):
--   one file at most 3 MB (3,145,728 bytes), the business's attachments together at most 30 MB (31,457,280 bytes) - the editor's limits.
--   Existing rows are never touched or deleted; only a new attachment over a limit is refused (the whole save is refused, as before).
-- Rollback of THIS file: DROP TRIGGER quote_attachment_size_guard ON public.quote_attachments;
--   DROP FUNCTION public.quote_attachment_size_guard().
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.quote_attachment_size_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_owner uuid;
  v_size  bigint;
  v_total bigint;
BEGIN
  SELECT q.user_id INTO v_owner FROM public.quotes q WHERE q.id = NEW.quote_id;
  SELECT CASE WHEN o.metadata ->> 'size' ~ '^[0-9]{1,15}$' THEN (o.metadata ->> 'size')::bigint END INTO v_size
    FROM storage.objects o WHERE o.bucket_id = 'quote-files' AND o.name = NEW.storage_path;
  v_size := greatest(coalesce(v_size, 0), coalesce(NEW.file_size, 0));
  IF v_size > 3145728 THEN
    RAISE EXCEPTION 'attachment_file_too_large: one attachment is at most 3 MB' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(sum(greatest(coalesce(CASE WHEN o.metadata ->> 'size' ~ '^[0-9]{1,15}$' THEN (o.metadata ->> 'size')::bigint END, 0),
                               coalesce(a.file_size, 0))), 0)
    INTO v_total
    FROM public.quote_attachments a
    JOIN public.quotes q ON q.id = a.quote_id
    LEFT JOIN storage.objects o ON o.bucket_id = 'quote-files' AND o.name = a.storage_path
   WHERE q.user_id = v_owner;
  IF v_total + v_size > 31457280 THEN
    RAISE EXCEPTION 'attachment_total_exceeded: the attachments of a business are at most 30 MB together' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_attachment_size_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS quote_attachment_size_guard ON public.quote_attachments;
CREATE TRIGGER quote_attachment_size_guard BEFORE INSERT ON public.quote_attachments
  FOR EACH ROW EXECUTE FUNCTION public.quote_attachment_size_guard();
