-- ============================================================================================================================
-- 20261102010000_expense_document_truth.sql  -  Codex R01 + R02: a credit note has its own document identity; the Owner's "not created" answer is remembered
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-02 (typed: "מאשר תיקון R01 ו-R02 של קודקס, כולל שינוי ב-L-22, שחרור עד הלייב"); docs/CODEX_SPEC_REVIEW_RELEASES_2026-11-02.md.
--   R01: credit_note enters expense_invoice_identity, so a charge and its credit note with the same number are two documents, and a second
--        copy of the same credit note is linked and excluded like any other document.
--   R02: payplus_match_cleared - the Owner checked PayPlus and said the document is not there. The next send does not stop again on a record
--        that could not be proven to be this document (a reused number in another period); it is used once.
--   Fail closed: two rows of one credit note stop the apply (expense_identity_exists); the Owner chooses first.
--   ROLLBACK: the column may stay; re-run the 20261030800000 body of the three-argument function.
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.expense_invoice_identity(p_vat text, p_type text, p_number text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
  SELECT CASE WHEN p_vat ~ '^[0-9]{5,12}$' AND p_type IN ('tax_invoice', 'receipt', 'tax_invoice_receipt', 'credit_note')
                   AND nullif(regexp_replace(coalesce(p_number, ''), '\s', '', 'g'), '') IS NOT NULL
              THEN 'v1|vat:' || p_vat || '|' || p_type || '|' || upper(regexp_replace(p_number, '\s', '', 'g')) END;
$function$;
REVOKE ALL ON FUNCTION public.expense_invoice_identity(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expense_invoice_identity(text, text, text) TO service_role;

ALTER TABLE public.expense_invoices ADD COLUMN IF NOT EXISTS payplus_match_cleared boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.expense_invoices.payplus_match_cleared IS 'Codex R02 (Owner 2026-11-02): the Owner checked PayPlus and said this document is not there; used by the next send only.';

-- the credit notes that exist get their identity (the guard computes it; a second copy of one stops the apply)
UPDATE public.expense_invoices
   SET document_identity = public.expense_invoice_identity(supplier_vat_id, doc_type, doc_number, identity_series)
 WHERE doc_type = 'credit_note'
   AND document_identity IS DISTINCT FROM public.expense_invoice_identity(supplier_vat_id, doc_type, doc_number, identity_series);
