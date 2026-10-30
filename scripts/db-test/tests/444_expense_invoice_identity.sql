-- Continuous work 30/10 (migration 20261030800000, Codex release 6, decision 10): one canonical record per supplier document.
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: the identity exists only with a VAT number (no VAT, or a
-- type 'other' = none, so equal numbers of different suppliers never collide); a second copy is stored, linked and excluded; a copy is
-- never approved, claimed or sent; an edit cannot create a second canonical document; the status does not bypass the rule; the admin
-- state shows the link; nothing is open to the app.
BEGIN;
SELECT tst.seed();
SET LOCAL role = service_role;

INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status, payplus_uuid) VALUES
  ('a4440000-0000-4000-8000-000000000001', 'quotecodedev@gmail.com', 'm444-1', 'בזק', '520031931', 'tax_invoice', 'INV 77', '2026-10-01', 117, 'ILS', 'sent', 'pp-444');
SELECT tst.ok((SELECT document_identity = 'v1|vat:520031931|tax_invoice|INV77' FROM public.expense_invoices WHERE id = 'a4440000-0000-4000-8000-000000000001'),
  'R6-1 the identity is computed by the database (VAT + type + number without spaces, upper case)');

-- the same document from another mailbox: stored, linked, excluded
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status) VALUES
  ('a4440000-0000-4000-8000-000000000002', 'info@tekango.com', 'm444-2', 'Bezeq', '520031931', 'tax_invoice', 'inv77', '2026-10-01', 117, 'ILS', 'pending');
SELECT tst.ok((SELECT duplicate_of = 'a4440000-0000-4000-8000-000000000001' AND status = 'excluded' FROM public.expense_invoices WHERE id = 'a4440000-0000-4000-8000-000000000002'),
  'R6-2 a second copy of the same document is stored, linked to the canonical row and excluded');
SELECT tst.throws($q$UPDATE public.expense_invoices SET status = 'approved' WHERE id = 'a4440000-0000-4000-8000-000000000002'$q$, 'expense_duplicate_not_sendable',
  'R6-3 a copy is never approved (whatever the caller sends)');
SELECT tst.throws($q$UPDATE public.expense_invoices SET status = 'sending' WHERE id = 'a4440000-0000-4000-8000-000000000002'$q$, 'expense_duplicate_not_sendable',
  'R6-3b nor claimed for sending');
SELECT tst.ok((SELECT count(*) = 2 FROM public.expense_invoices WHERE document_identity = 'v1|vat:520031931|tax_invoice|INV77'), 'R6-4 both raw copies are kept (evidence)');

-- different suppliers, the same number; no VAT; type other
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, status) VALUES
  ('a4440000-0000-4000-8000-000000000003', 'quotecodedev@gmail.com', 'm444-3', 'Partner', '520044314', 'tax_invoice', 'INV77', 'pending'),
  ('a4440000-0000-4000-8000-000000000004', 'quotecodedev@gmail.com', 'm444-4', 'Supabase Inc', NULL, 'tax_invoice', 'INV77', 'pending'),
  ('a4440000-0000-4000-8000-000000000005', 'quotecodedev@gmail.com', 'm444-5', 'Supabase Inc', NULL, 'tax_invoice', 'INV77', 'pending'),
  ('a4440000-0000-4000-8000-000000000006', 'quotecodedev@gmail.com', 'm444-6', 'בזק', '520031931', 'other', 'INV77', 'pending');
SELECT tst.ok((SELECT bool_and(duplicate_of IS NULL AND status = 'pending') FROM public.expense_invoices
  WHERE id IN ('a4440000-0000-4000-8000-000000000003', 'a4440000-0000-4000-8000-000000000004', 'a4440000-0000-4000-8000-000000000005', 'a4440000-0000-4000-8000-000000000006')),
  'R6-5 another supplier with the same number, documents without a VAT number and type "other" are never linked (no hard block)');
SELECT tst.ok((SELECT document_identity IS NULL FROM public.expense_invoices WHERE id = 'a4440000-0000-4000-8000-000000000004'), 'R6-5b no VAT number = no identity');

-- an edit cannot create a second canonical document; the status never bypasses it
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, status) VALUES
  ('a4440000-0000-4000-8000-000000000007', 'quotecodedev@gmail.com', 'm444-7', 'Partner', '520044314', 'tax_invoice', 'INV78', 'rejected');
SELECT tst.throws($q$UPDATE public.expense_invoices SET doc_number = 'INV77' WHERE id = 'a4440000-0000-4000-8000-000000000007'$q$, 'expense_identity_exists',
  'R6-6 an edit that would duplicate another canonical document is refused, even for a rejected row');
SELECT tst.ok((SELECT doc_number = 'INV78' FROM public.expense_invoices WHERE id = 'a4440000-0000-4000-8000-000000000007'), 'R6-6b and nothing changed');
SELECT tst.ok((SELECT count(*) = 1 FROM pg_indexes WHERE indexname = 'expense_invoices_canonical_identity_uq'), 'R6-7 the canonical unique index exists');
RESET role;

-- the admin state shows the link (super admin only)
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((SELECT (x ->> 'duplicateOf') = 'a4440000-0000-4000-8000-000000000001' FROM jsonb_array_elements(public.expense_invoices_admin_state() -> 'invoices') x
  WHERE x ->> 'id' = 'a4440000-0000-4000-8000-000000000002'), 'R6-8 the admin state shows which document a copy belongs to');
SELECT tst.throws($q$SELECT count(*) FROM public.expense_invoices$q$, 'permission denied', 'R6-9 the table stays closed to the app');
SELECT tst.logout();

ROLLBACK;
