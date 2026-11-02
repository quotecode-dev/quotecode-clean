-- ============================================================================================================================
-- 20261101060000_expense_credit_notes_to_payplus.sql  -  a supplier credit note goes to PayPlus with a minus, like any document
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-01 (typed: "מאשר שינוי ב-L-22: כל חשבונית חיוב עוברת לפיי פלוס בפלוס וכל חשבונית זיכוי עוברת לפיי פלוס במינוס,
--   כל מסמך בפני עצמו, בלי חישוב נטו, אחרי אישור שלי במסך, שחרור עד הלייב").
--   * Removes the check of 20261101050000 that kept a credit note out of approval and sending. The approval on screen stays required.
--   * The stored amount stays positive (amount >= 0); the function sends it to PayPlus with a minus and doc_type_code inv_refund.
--   Former migrations are not edited. ROLLBACK: the former check may be restored by a later Owner-approved migration once no credit
--   note is in another status.
-- ============================================================================================================================

ALTER TABLE public.expense_invoices DROP CONSTRAINT IF EXISTS expense_invoices_credit_note_not_expense;
