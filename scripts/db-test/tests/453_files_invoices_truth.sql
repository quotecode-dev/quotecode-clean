-- Codex review 2026-10-31 group 6 (migration 20261031600000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the file quota counts the incoming file (a missing size counts as 4 MB); a copy corrected to another number becomes its own
-- document or a copy of that number; a canonical row whose number changes hands its copies to the oldest one; the Owner's series /
-- period makes a reused supplier number a separate document; the upload policy uses the new check.
BEGIN;
SELECT tst.seed();

-- ------------------------------------------------------------------------------------------------- S1. the file quota (F06, decision h)
SELECT tst.ok((SELECT with_check LIKE '%quote_files_upload_allowed(metadata)%' FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname = 'Authenticated owners upload quote files'), 'S1 the upload policy counts the incoming file');
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'quote-files', '00000000-0000-4000-8000-00000000000a/q' || g || '.pdf', jsonb_build_object('size', 3145728) FROM generate_series(1, 9) g; -- 27 MiB stored
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok(public.quote_files_upload_allowed('{"size": 2097152}'::jsonb), 'S1b 27 MiB + 2 MiB fits');
SELECT tst.ok(NOT public.quote_files_upload_allowed('{"size": 4194304}'::jsonb), 'S1c 27 MiB + 4 MiB does not (the incoming file counts)');
SELECT tst.ok(NOT public.quote_files_upload_allowed('{}'::jsonb), 'S1d a file of unknown size counts as 4 MB');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.ok(public.quote_files_upload_allowed('{}'::jsonb), 'S1e another business is not affected');
SELECT tst.logout();
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.quote_files_upload_allowed('{"size": 1}'::jsonb)$q$, 'permission denied', 'S1f the public cannot even call it');
SELECT tst.logout();

-- ------------------------------------------------------------------------------------------------- S2. a corrected copy (F08)
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status) VALUES
  ('a4530000-0000-4000-8000-000000000001', 'quotecodedev@gmail.com', 'm453-1', 'ספק', '520031931', 'tax_invoice', '77', '2026-10-01', 100, 'ILS', 'pending');
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status) VALUES
  ('a4530000-0000-4000-8000-000000000002', 'quotecodedev@gmail.com', 'm453-2', 'ספק', '520031931', 'tax_invoice', '77', '2026-10-05', 250, 'ILS', 'pending');
SELECT tst.ok((SELECT duplicate_of = 'a4530000-0000-4000-8000-000000000001' AND status = 'excluded' FROM public.expense_invoices WHERE id = 'a4530000-0000-4000-8000-000000000002'),
  'S2 the OCR read the second invoice as 77 - a copy');
UPDATE public.expense_invoices SET doc_number = '78' WHERE id = 'a4530000-0000-4000-8000-000000000002';
SELECT tst.ok((SELECT duplicate_of IS NULL AND document_identity = 'v1|vat:520031931|tax_invoice|78' FROM public.expense_invoices WHERE id = 'a4530000-0000-4000-8000-000000000002'),
  'S2b corrected to 78 it is its own document (the stale link is gone)');
UPDATE public.expense_invoices SET status = 'pending' WHERE id = 'a4530000-0000-4000-8000-000000000002';
UPDATE public.expense_invoices SET status = 'approved' WHERE id = 'a4530000-0000-4000-8000-000000000002';
SELECT tst.ok((SELECT status = 'approved' FROM public.expense_invoices WHERE id = 'a4530000-0000-4000-8000-000000000002'), 'S2c and can be approved');
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status) VALUES
  ('a4530000-0000-4000-8000-000000000003', 'quotecodedev@gmail.com', 'm453-3', 'ספק', '520031931', 'tax_invoice', '77', '2026-10-01', 100, 'ILS', 'pending');
UPDATE public.expense_invoices SET doc_number = '78' WHERE id = 'a4530000-0000-4000-8000-000000000003';
SELECT tst.ok((SELECT duplicate_of = 'a4530000-0000-4000-8000-000000000002' AND status = 'excluded' FROM public.expense_invoices WHERE id = 'a4530000-0000-4000-8000-000000000003'),
  'S2d a copy corrected to a number that exists becomes a copy of THAT document');

-- ------------------------------------------------------------------------------------------------- S3. a canonical row edited (F08)
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status, created_at) VALUES
  ('a4530000-0000-4000-8000-000000000011', 'quotecodedev@gmail.com', 'm453-11', 'ספק ב', '514000000', 'receipt', '500', '2026-10-01', 10, 'ILS', 'pending', now() - interval '3 hours');
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status, created_at) VALUES
  ('a4530000-0000-4000-8000-000000000012', 'info@tekango.com', 'm453-12', 'ספק ב', '514000000', 'receipt', '500', '2026-10-01', 10, 'ILS', 'pending', now() - interval '2 hours'),
  ('a4530000-0000-4000-8000-000000000013', 'info@tekango.com', 'm453-13', 'ספק ב', '514000000', 'receipt', '500', '2026-10-01', 10, 'ILS', 'pending', now() - interval '1 hour');
UPDATE public.expense_invoices SET doc_number = '501' WHERE id = 'a4530000-0000-4000-8000-000000000011';
SELECT tst.ok((SELECT duplicate_of IS NULL FROM public.expense_invoices WHERE id = 'a4530000-0000-4000-8000-000000000012')
  AND (SELECT duplicate_of = 'a4530000-0000-4000-8000-000000000012' FROM public.expense_invoices WHERE id = 'a4530000-0000-4000-8000-000000000013'),
  'S3 the canonical row changed its number: the oldest copy is now the document of 500, the other copy points to it');
SELECT tst.ok((SELECT count(*) = 1 FROM public.expense_invoices WHERE document_identity = 'v1|vat:514000000|receipt|500' AND duplicate_of IS NULL), 'S3b still one canonical row per identity');

-- ------------------------------------------------------------------------------------------------- S4. series / period (F09)
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status, payplus_uuid) VALUES
  ('a4530000-0000-4000-8000-000000000021', 'quotecodedev@gmail.com', 'm453-21', 'ספק ג', '515000000', 'tax_invoice', '1', '2025-01-10', 40, 'ILS', 'sent', 'pp-453');
INSERT INTO public.expense_invoices (id, mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, doc_date, amount, currency, status) VALUES
  ('a4530000-0000-4000-8000-000000000022', 'quotecodedev@gmail.com', 'm453-22', 'ספק ג', '515000000', 'tax_invoice', '1', '2026-01-10', 90, 'ILS', 'pending');
SELECT tst.ok((SELECT duplicate_of IS NOT NULL FROM public.expense_invoices WHERE id = 'a4530000-0000-4000-8000-000000000022'), 'S4 a reused number in a new year is first a copy');
UPDATE public.expense_invoices SET identity_series = '2026' WHERE id = 'a4530000-0000-4000-8000-000000000022';
SELECT tst.ok((SELECT duplicate_of IS NULL AND document_identity = 'v1|vat:515000000|tax_invoice|1|series:2026' FROM public.expense_invoices WHERE id = 'a4530000-0000-4000-8000-000000000022'),
  'S4b the Owner''s series makes it a separate document');
SELECT tst.throws($q$UPDATE public.expense_invoices SET identity_series = '  x' WHERE id = 'a4530000-0000-4000-8000-000000000022'$q$, 'check', 'S4c a series is stored trimmed');
SELECT tst.ok(public.expense_invoice_identity('515000000', 'tax_invoice', '1', NULL) = public.expense_invoice_identity('515000000', 'tax_invoice', '1'),
  'S4d without a series the identity is the former one (nothing existing changes)');

ROLLBACK;
