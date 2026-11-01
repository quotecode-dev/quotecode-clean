-- ============================================================================================================================
-- 20261031600000_files_invoices_truth.sql  -  the file quota counts the incoming file; invoice identity edits re-link (Codex F06/F08/F09)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-31 (typed: "מאשר את שש הקבוצות של קודקס לפי הסדר, כל אחת בשער משלה ועד הלייב, כולל שינוי ב-L-02, L-13, L-15,
--   L-17, L-18, L-22 ובנעילות של 30/10, החלטות א-ח והנוסחים כמומלץ" + the night task); docs/CODEX_REVIEW_RELEASES_2026-10-30.md group 6.
--   * F06 (decision h): the upload check counts the INCOMING file - the stored total + this file stays within 30 MB and the count within
--     300. The storage server checks the policy in a test step without the new file's size, so in practice every upload counts as 4 MB
--     (the bucket's own per-file limit; the Owner's decision h): an upload needs 4 MB free. That test step ends before the file is
--     stored, so the lock does not serialize two uploads made at the same moment - each must still leave 4 MB free, which bounds them.
--     The former no-argument check stays for its callers.
--   * F08: an edit that changes a document's identity re-links it - a copy corrected to another number becomes its own document (or a
--     copy of the canonical row of the new number); a canonical row whose identity changes hands its copies to the oldest of them.
--   * F09 (decision g): identity_series = the Owner's own "another document - series or period" of a copy; it is part of the identity, so
--     a supplier reusing a number in another series or period is a separate document. Never inferred from an OCR date.
--   20261030700000 / 20261030800000 are not edited. ROLLBACK: the column is nullable; the former functions may be restored by a later
--   Owner-approved migration.
-- ============================================================================================================================

-- ---------------------------------------------------------------------------------------------------- F06: the file quota
CREATE OR REPLACE FUNCTION public.quote_files_upload_allowed(p_metadata jsonb)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_incoming bigint := CASE WHEN p_metadata ->> 'size' ~ '^[0-9]{1,15}$' THEN (p_metadata ->> 'size')::bigint ELSE 4194304 END;
  v_count bigint; v_sum bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  -- one upload admission at a time per account (held until the upload's own transaction ends)
  PERFORM pg_advisory_xact_lock(hashtext('tekango.quote_files_quota'), hashtext(v_uid::text));
  SELECT count(*), coalesce(sum(CASE WHEN o.metadata ->> 'size' ~ '^[0-9]{1,15}$' THEN (o.metadata ->> 'size')::bigint ELSE 0 END), 0)
    INTO v_count, v_sum
    FROM storage.objects o
   WHERE o.bucket_id = 'quote-files' AND (storage.foldername(o.name))[1] = v_uid::text;
  RETURN v_count + 1 <= 300 AND v_sum + v_incoming <= 31457280;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_files_upload_allowed(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_files_upload_allowed(jsonb) TO authenticated;

DROP POLICY IF EXISTS "Authenticated owners upload quote files" ON storage.objects;
CREATE POLICY "Authenticated owners upload quote files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-files'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.quote_files_upload_allowed(metadata)
  );

-- ---------------------------------------------------------------------------------------------------- F08 / F09: invoice identity
ALTER TABLE public.expense_invoices ADD COLUMN IF NOT EXISTS identity_series text
  CHECK (identity_series IS NULL OR (char_length(identity_series) BETWEEN 1 AND 40 AND identity_series = btrim(identity_series)));
COMMENT ON COLUMN public.expense_invoices.identity_series IS 'Codex F09 (Owner 2026-10-31, decision g): the Owner''s own series / period of a reused supplier number.';

CREATE OR REPLACE FUNCTION public.expense_invoice_identity(p_vat text, p_type text, p_number text, p_series text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
  SELECT CASE WHEN public.expense_invoice_identity(p_vat, p_type, p_number) IS NULL THEN NULL
              WHEN nullif(btrim(coalesce(p_series, '')), '') IS NULL THEN public.expense_invoice_identity(p_vat, p_type, p_number)
              ELSE left(public.expense_invoice_identity(p_vat, p_type, p_number) || '|series:' || upper(btrim(p_series)), 140) END;
$function$;
REVOKE ALL ON FUNCTION public.expense_invoice_identity(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expense_invoice_identity(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.expense_invoice_identity_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE v_canon uuid; v_old text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.document_identity END;
BEGIN
  NEW.document_identity := public.expense_invoice_identity(NEW.supplier_vat_id, NEW.doc_type, NEW.doc_number, NEW.identity_series);
  -- F08: a copy whose identity changed is linked again from scratch (it never keeps the link of its former number)
  IF TG_OP = 'UPDATE' AND NEW.document_identity IS DISTINCT FROM v_old AND NEW.duplicate_of IS NOT NULL
     AND NEW.duplicate_of IS NOT DISTINCT FROM OLD.duplicate_of THEN
    NEW.duplicate_of := NULL;
  END IF;
  IF NEW.document_identity IS NOT NULL AND NEW.duplicate_of IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('tekango.expense_identity'), hashtext(NEW.document_identity));
    SELECT id INTO v_canon FROM public.expense_invoices
     WHERE document_identity = NEW.document_identity AND duplicate_of IS NULL AND id <> NEW.id ORDER BY created_at LIMIT 1;
    IF v_canon IS NOT NULL THEN
      IF TG_OP = 'INSERT' OR OLD.duplicate_of IS NOT NULL THEN
        -- a new copy, or a corrected copy that matches another document: linked to it and excluded
        NEW.duplicate_of := v_canon;
        IF NEW.status IN ('pending', 'approved', 'send_failed') THEN NEW.status := 'excluded'; END IF;
      ELSE
        RAISE EXCEPTION 'expense_identity_exists' USING ERRCODE = '23505';
      END IF;
    END IF;
  END IF;
  IF NEW.duplicate_of IS NOT NULL AND NEW.status IN ('approved', 'sending', 'sent', 'unknown') THEN
    RAISE EXCEPTION 'expense_duplicate_not_sendable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.expense_invoice_identity_guard() FROM PUBLIC, anon, authenticated;

-- F08: a canonical row whose identity changed hands its copies of the former identity to the oldest of them
CREATE OR REPLACE FUNCTION public.expense_invoice_identity_relink()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE v_new uuid;
BEGIN
  IF OLD.duplicate_of IS NULL AND OLD.document_identity IS NOT NULL AND NEW.document_identity IS DISTINCT FROM OLD.document_identity THEN
    SELECT id INTO v_new FROM public.expense_invoices WHERE duplicate_of = NEW.id AND document_identity = OLD.document_identity ORDER BY created_at LIMIT 1;
    IF v_new IS NOT NULL THEN
      UPDATE public.expense_invoices SET duplicate_of = NULL WHERE id = v_new;
      UPDATE public.expense_invoices SET duplicate_of = v_new WHERE duplicate_of = NEW.id AND document_identity = OLD.document_identity AND id <> v_new;
    END IF;
  END IF;
  RETURN NULL;
END
$function$;
REVOKE ALL ON FUNCTION public.expense_invoice_identity_relink() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS expense_invoice_identity_relink ON public.expense_invoices;
CREATE TRIGGER expense_invoice_identity_relink AFTER UPDATE ON public.expense_invoices
  FOR EACH ROW EXECUTE FUNCTION public.expense_invoice_identity_relink();

-- the admin screen also shows the Owner's series / period of a copy
CREATE OR REPLACE FUNCTION public.expense_invoices_admin_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'expense_invoices_admin_state: super admin only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'connections', coalesce((SELECT jsonb_agg(jsonb_build_object('mailbox', c.mailbox, 'connectedAt', c.connected_at, 'lastScanAt', c.last_scan_at,
      'scannedUntil', c.scanned_until, 'lastError', c.last_error) ORDER BY c.mailbox) FROM public.expense_mail_connections c), '[]'::jsonb),
    'invoices', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'mailbox', i.mailbox, 'receivedAt', i.received_at, 'emailFrom', i.email_from,
      'emailSubject', i.email_subject, 'supplierName', i.supplier_name, 'supplierVatId', i.supplier_vat_id, 'supplierCountry', i.supplier_country,
      'docType', i.doc_type, 'docNumber', i.doc_number, 'docDate', i.doc_date, 'amount', i.amount, 'currency', i.currency,
      'amountIncludesVat', i.amount_includes_vat, 'vatPercentage', i.vat_percentage, 'category', i.category, 'confidence', i.confidence, 'reason', i.reason,
      'hasFile', i.has_file, 'fileName', i.file_name, 'status', i.status, 'subcategoryId', i.subcategory_id, 'sendError', i.send_error,
      'sentAt', i.sent_at, 'duplicateOf', i.duplicate_of, 'identitySeries', i.identity_series) ORDER BY i.doc_date DESC NULLS LAST, i.created_at DESC) FROM public.expense_invoices i), '[]'::jsonb),
    'settings', (SELECT jsonb_build_object('expenseTypes', s.expense_types, 'defaultSubcategoryId', s.default_subcategory_id) FROM public.expense_settings s WHERE s.id = 1)
  );
END
$function$;
REVOKE ALL ON FUNCTION public.expense_invoices_admin_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_invoices_admin_state() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
