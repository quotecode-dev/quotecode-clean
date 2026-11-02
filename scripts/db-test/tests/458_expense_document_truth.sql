-- Owner console 2026-11-02 (Codex R01 + R02, migration 20261102010000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: a charge and its credit note with one number are two documents; a second copy of a credit note is linked and excluded; the Owner's clearance starts off.
BEGIN;
SELECT tst.seed();

SELECT tst.ok(public.expense_invoice_identity('311214605', 'credit_note', '42') = 'v1|vat:311214605|credit_note|42', 'R1 a credit note has an identity');
SELECT tst.ok(public.expense_invoice_identity('311214605', 'credit_note', '42', '2026') LIKE 'v1|vat:311214605|credit_note|42|series:2026', 'R2 with the Owner''s series too');
SELECT tst.ok(public.expense_invoice_identity('311214605', 'tax_invoice', '42') <> public.expense_invoice_identity('311214605', 'credit_note', '42'), 'R3 a charge and a credit note with one number differ');
SELECT tst.ok(public.expense_invoice_identity('311214605', 'other', '42') IS NULL, 'R4 an unknown type still has no identity');
SELECT tst.ok(public.expense_invoice_identity(NULL, 'credit_note', '42') IS NULL, 'R5 no supplier number, no identity');

INSERT INTO public.expense_invoices (id, mailbox, message_id, status, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency)
VALUES ('c4580000-0000-4000-8000-000000000001', 'a@synthetic.test', 'm1', 'pending', 'Synthetic Supplier', '311214605', 'tax_invoice_receipt', '42', '2026-11-01', 100, 'ILS'),
       ('c4580000-0000-4000-8000-000000000002', 'a@synthetic.test', 'm2', 'pending', 'Synthetic Supplier', '311214605', 'credit_note', '42', '2026-11-01', 20, 'ILS'),
       ('c4580000-0000-4000-8000-000000000003', 'a@synthetic.test', 'm3', 'pending', 'Synthetic Supplier', '311214605', 'credit_note', '42', '2026-11-01', 20, 'ILS');
SELECT tst.ok((SELECT duplicate_of IS NULL AND status = 'pending' FROM public.expense_invoices WHERE id = 'c4580000-0000-4000-8000-000000000002'), 'R6 the credit note is not a copy of the charge');
SELECT tst.ok((SELECT duplicate_of = 'c4580000-0000-4000-8000-000000000002' AND status = 'excluded' FROM public.expense_invoices WHERE id = 'c4580000-0000-4000-8000-000000000003'), 'R7 a second copy of the credit note is linked and excluded');
SELECT tst.ok((SELECT NOT payplus_match_cleared FROM public.expense_invoices WHERE id = 'c4580000-0000-4000-8000-000000000001'), 'R8 the clearance starts off');
SELECT tst.ok(NOT has_column_privilege('anon', 'public.expense_invoices', 'payplus_match_cleared', 'SELECT'), 'R9 closed to the public');

ROLLBACK;
