-- Owner console 2026-11-01, L-22 (migrations 20261101050000, 20261101060000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: a credit note is stored with the document it cancels, walks the same approval and sending path as any document, and an ordinary charge is not affected.
BEGIN;
SELECT tst.seed();

INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, credited_doc_number, doc_date, amount, currency, status) VALUES
  ('a4550000-0000-4000-8000-000000000001', 'quotecodedev@gmail.com', 'm455-1', 'אור ממן', '311214605', 'credit_note', '30530', '30529', '2026-11-01', 370, 'ILS', 'pending');
SELECT tst.ok((SELECT doc_type = 'credit_note' AND credited_doc_number = '30529' FROM public.expense_invoices WHERE id = 'a4550000-0000-4000-8000-000000000001'),
  'C1 a credit note is stored with the document it cancels and waits for approval');

UPDATE public.expense_invoices SET status = 'approved' WHERE id = 'a4550000-0000-4000-8000-000000000001';
UPDATE public.expense_invoices SET status = 'sending' WHERE id = 'a4550000-0000-4000-8000-000000000001';
UPDATE public.expense_invoices SET status = 'sent', payplus_uuid = 'x' WHERE id = 'a4550000-0000-4000-8000-000000000001';
SELECT tst.ok((SELECT status = 'sent' FROM public.expense_invoices WHERE id = 'a4550000-0000-4000-8000-000000000001'), 'C2 a credit note can be approved and sent');

DO $$ BEGIN
  INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, doc_type, doc_number, amount, currency, status) VALUES
    ('a4550000-0000-4000-8000-000000000004', 'quotecodedev@gmail.com', 'm455-4', 'בזק', 'credit_note', 'CR 1', -10, 'ILS', 'pending');
  RAISE EXCEPTION 'C3 a negative amount was stored';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
SELECT tst.ok(true, 'C3 the stored amount stays positive; only the function sends the minus');

DO $$ BEGIN
  INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, doc_type, doc_number, credited_doc_number, amount, currency, status) VALUES
    ('a4550000-0000-4000-8000-000000000002', 'quotecodedev@gmail.com', 'm455-2', 'בזק', 'tax_invoice', 'INV 1', '30529', 10, 'ILS', 'pending');
  RAISE EXCEPTION 'C5 a charge carried a credited number';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
SELECT tst.ok(true, 'C5 only a credit note can name a cancelled document');

INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status) VALUES
  ('a4550000-0000-4000-8000-000000000003', 'quotecodedev@gmail.com', 'm455-3', 'אור ממן', '311214605', 'tax_invoice_receipt', '30529', '2026-11-01', 390, 'ILS', 'pending');
UPDATE public.expense_invoices SET status = 'approved' WHERE id = 'a4550000-0000-4000-8000-000000000003';
SELECT tst.ok((SELECT status = 'approved' FROM public.expense_invoices WHERE id = 'a4550000-0000-4000-8000-000000000003'), 'C6 the charge is approved as before');

SELECT tst.ok(position('creditedDocNumber' IN pg_get_functiondef('public.expense_invoices_admin_state()'::regprocedure)) > 0, 'C7 the admin screen receives the cancelled document');

ROLLBACK;
