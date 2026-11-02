-- Owner console 2026-11-01, L-22 (migration 20261101050000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: a credit note is stored with the document it cancels, can only be excluded or rejected, and an ordinary charge is not affected.
BEGIN;
SELECT tst.seed();

INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, credited_doc_number, doc_date, amount, currency, status) VALUES
  ('a4550000-0000-4000-8000-000000000001', 'quotecodedev@gmail.com', 'm455-1', 'אור ממן', '311214605', 'credit_note', '30530', '30529', '2026-11-01', 370, 'ILS', 'excluded');
SELECT tst.ok((SELECT doc_type = 'credit_note' AND credited_doc_number = '30529' FROM public.expense_invoices WHERE id = 'a4550000-0000-4000-8000-000000000001'),
  'C1 a credit note is stored with the document it cancels');

DO $$ DECLARE v_status text; BEGIN
  FOREACH v_status IN ARRAY ARRAY['pending', 'approved', 'sending', 'send_failed', 'unknown'] LOOP
    BEGIN
      UPDATE public.expense_invoices SET status = v_status WHERE id = 'a4550000-0000-4000-8000-000000000001';
      RAISE EXCEPTION 'C2 a credit note reached status %', v_status;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
END $$;
SELECT tst.ok(true, 'C2 a credit note cannot be pending, approved, sending, failed or unknown');

DO $$ BEGIN
  UPDATE public.expense_invoices SET status = 'sent', payplus_uuid = 'x' WHERE id = 'a4550000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'C3 a credit note reached sent';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
SELECT tst.ok(true, 'C3 a credit note cannot be sent');

UPDATE public.expense_invoices SET status = 'rejected' WHERE id = 'a4550000-0000-4000-8000-000000000001';
SELECT tst.ok((SELECT status = 'rejected' FROM public.expense_invoices WHERE id = 'a4550000-0000-4000-8000-000000000001'), 'C4 it can be rejected');

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
