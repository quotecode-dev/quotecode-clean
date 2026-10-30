-- ============================================================================================================================
-- 20261030800000_expense_invoice_identity.sql  -  Codex release 6 (topic 6b): one canonical record per supplier document
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-30 (typed: "אשר עבודה רצופה מעכשיו: ... שחרורים 6, 7, 8 ... ו-9, כל אחד בשער משלו לפי הסדר, ספירת הכפילויות
--   מהגיבוי של היום בלי מגע בייצור, כולל שינוי ב-L-22 ..." + "מאשר חסימה קשיחה רק לחשבוניות עם מספר עוסק"); decision 10;
--   docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 6b.
--   * document_identity = the supplier's VAT / business number + the document type + the document number (spaces removed, upper case),
--     computed by the database only, and ONLY when the VAT number exists (a document without one keeps the existing name + number check;
--     equal numbers of different suppliers never collide). A type 'other' has no identity.
--   * duplicate_of = the canonical row of the same identity. A second copy (another mailbox, a re-sent email) is still STORED (raw
--     evidence) but marked excluded + duplicate_of - never approved, claimed or sent (a guard trigger, whatever the caller sends).
--   * one canonical row per identity (unique index, independent of the status); an edit that would create a second one is refused.
--   * the inventory of 2026-10-30 (the Production backup of 29/10 23:51 UTC, restored locally): 0 clusters among 13 rows with an identity.
--     Fail closed: if clusters exist at apply time, nothing is changed and the apply stops (the Owner chooses the canonical rows).
--   ROLLBACK: keep the columns and links (evidence); the index and the guard may be dropped by a later Owner-approved migration.
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.expense_invoice_identity(p_vat text, p_type text, p_number text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
  SELECT CASE WHEN p_vat ~ '^[0-9]{5,12}$' AND p_type IN ('tax_invoice', 'receipt', 'tax_invoice_receipt')
                   AND nullif(regexp_replace(coalesce(p_number, ''), '\s', '', 'g'), '') IS NOT NULL
              THEN 'v1|vat:' || p_vat || '|' || p_type || '|' || upper(regexp_replace(p_number, '\s', '', 'g')) END;
$function$;
REVOKE ALL ON FUNCTION public.expense_invoice_identity(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expense_invoice_identity(text, text, text) TO service_role;

ALTER TABLE public.expense_invoices ADD COLUMN IF NOT EXISTS document_identity text CHECK (document_identity IS NULL OR char_length(document_identity) <= 140);
ALTER TABLE public.expense_invoices ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.expense_invoices (id) ON DELETE RESTRICT;
ALTER TABLE public.expense_invoices DROP CONSTRAINT IF EXISTS expense_invoices_duplicate_not_self;
ALTER TABLE public.expense_invoices ADD CONSTRAINT expense_invoices_duplicate_not_self CHECK (duplicate_of IS NULL OR duplicate_of <> id);

UPDATE public.expense_invoices SET document_identity = public.expense_invoice_identity(supplier_vat_id, doc_type, doc_number)
 WHERE document_identity IS DISTINCT FROM public.expense_invoice_identity(supplier_vat_id, doc_type, doc_number);

DO $clusters$
DECLARE v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM (SELECT document_identity FROM public.expense_invoices
    WHERE document_identity IS NOT NULL AND duplicate_of IS NULL GROUP BY document_identity HAVING count(*) > 1) c;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'expense_identity_clusters: % supplier documents exist more than once - the Owner chooses the canonical rows first', v_n;
  END IF;
END
$clusters$;

CREATE UNIQUE INDEX IF NOT EXISTS expense_invoices_canonical_identity_uq ON public.expense_invoices (document_identity)
  WHERE document_identity IS NOT NULL AND duplicate_of IS NULL;

-- the identity is the database's; a new copy of an existing document is linked and excluded; a copy is never approved or sent
CREATE OR REPLACE FUNCTION public.expense_invoice_identity_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE v_canon uuid;
BEGIN
  NEW.document_identity := public.expense_invoice_identity(NEW.supplier_vat_id, NEW.doc_type, NEW.doc_number);
  IF NEW.document_identity IS NOT NULL AND NEW.duplicate_of IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('tekango.expense_identity'), hashtext(NEW.document_identity));
    SELECT id INTO v_canon FROM public.expense_invoices
     WHERE document_identity = NEW.document_identity AND duplicate_of IS NULL AND id <> NEW.id LIMIT 1;
    IF v_canon IS NOT NULL THEN
      IF TG_OP = 'INSERT' THEN
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
DROP TRIGGER IF EXISTS expense_invoice_identity_guard ON public.expense_invoices;
CREATE TRIGGER expense_invoice_identity_guard BEFORE INSERT OR UPDATE ON public.expense_invoices
  FOR EACH ROW EXECUTE FUNCTION public.expense_invoice_identity_guard();

-- the admin screen also shows the link of a copy to its canonical document
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
      'sentAt', i.sent_at, 'duplicateOf', i.duplicate_of) ORDER BY i.doc_date DESC NULLS LAST, i.created_at DESC) FROM public.expense_invoices i), '[]'::jsonb),
    'settings', (SELECT jsonb_build_object('expenseTypes', s.expense_types, 'defaultSubcategoryId', s.default_subcategory_id) FROM public.expense_settings s WHERE s.id = 1)
  );
END
$function$;
REVOKE ALL ON FUNCTION public.expense_invoices_admin_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_invoices_admin_state() TO authenticated, service_role;
