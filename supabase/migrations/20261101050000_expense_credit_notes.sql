-- ============================================================================================================================
-- 20261101050000_expense_credit_notes.sql  -  a supplier credit note is recorded, never an expense
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-01 (typed: "מאשר: זיהוי חשבוניות זיכוי בכלי ההוצאות, סימון בלי אפשרות אישור, כולל שינוי ב-L-22, שחרור עד הלייב
--   אחרי שמסיימים את הסרטון"; "יש חשבונית חיוב על 390 שזו הוצאה ויש חשבונית זיכוי של 370 כך שסך ההוצאה היא 20 ש"ח בסה"כ אבל המערכת חייבת
--   להבחין שזה זיכוי").
--   * doc_type 'credit_note', and credited_doc_number = the printed number of the document it cancels.
--   * A credit note can only be 'excluded' or 'rejected', so it can never be approved or sent to PayPlus, by any path.
--   Former migrations are not edited. ROLLBACK: the column is nullable; the former constraint and function may be restored by a later
--   Owner-approved migration once no credit_note row exists.
-- ============================================================================================================================

ALTER TABLE public.expense_invoices ADD COLUMN IF NOT EXISTS credited_doc_number text;
ALTER TABLE public.expense_invoices DROP CONSTRAINT IF EXISTS expense_invoices_doc_type_check;
ALTER TABLE public.expense_invoices ADD CONSTRAINT expense_invoices_doc_type_check
  CHECK (doc_type IN ('tax_invoice', 'receipt', 'tax_invoice_receipt', 'credit_note', 'other'));
ALTER TABLE public.expense_invoices DROP CONSTRAINT IF EXISTS expense_invoices_credit_note_not_expense;
ALTER TABLE public.expense_invoices ADD CONSTRAINT expense_invoices_credit_note_not_expense
  CHECK (doc_type <> 'credit_note' OR status IN ('excluded', 'rejected'));
ALTER TABLE public.expense_invoices DROP CONSTRAINT IF EXISTS expense_invoices_credited_number_only_on_credit;
ALTER TABLE public.expense_invoices ADD CONSTRAINT expense_invoices_credited_number_only_on_credit
  CHECK (credited_doc_number IS NULL OR doc_type = 'credit_note');

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
      'sentAt', i.sent_at, 'duplicateOf', i.duplicate_of, 'identitySeries', i.identity_series, 'creditedDocNumber', i.credited_doc_number) ORDER BY i.doc_date DESC NULLS LAST, i.created_at DESC) FROM public.expense_invoices i), '[]'::jsonb),
    'settings', (SELECT jsonb_build_object('expenseTypes', s.expense_types, 'defaultSubcategoryId', s.default_subcategory_id) FROM public.expense_settings s WHERE s.id = 1)
  );
END
$function$;
REVOKE ALL ON FUNCTION public.expense_invoices_admin_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expense_invoices_admin_state() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
