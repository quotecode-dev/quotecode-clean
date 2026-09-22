-- OD-2 private attachments + storage GC lifecycle (objects deleted only after the metadata row is gone).
SELECT tst.seed();
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 910001, 'draft', 'ILS', 10),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 910002, 'draft', 'ILS', 10),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', 910003, 'approved', 'ILS', 10);
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('quote-files', '00000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000001_1.pdf', '00000000-0000-4000-8000-00000000000a'),
  ('quote-files', '00000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000002_1.pdf', '00000000-0000-4000-8000-00000000000a'),
  ('quote-files', '00000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000002_2.png', '00000000-0000-4000-8000-00000000000a'),
  ('quote-files', '00000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000003_1.pdf', '00000000-0000-4000-8000-00000000000a');
INSERT INTO public.quote_attachments (id, quote_id, file_name, file_url, file_size, storage_path) VALUES
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'plan.pdf', 'x', 10, '00000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000001_1.pdf'),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'a.pdf', 'x', 10, '00000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000002_1.pdf'),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'b.png', 'x', 10, '00000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000002_2.png');
-- the approved quote's attachment was added before approval (the child guard freezes it afterwards)
ALTER TABLE public.quote_attachments DISABLE TRIGGER guard_quote_attachments_immutability;
INSERT INTO public.quote_attachments (id, quote_id, file_name, file_url, file_size, storage_path) VALUES
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'signed.pdf', 'x', 10, '00000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000003_1.pdf');
ALTER TABLE public.quote_attachments ENABLE TRIGGER guard_quote_attachments_immutability;

DO $$ BEGIN
  PERFORM tst.ok((SELECT public = false FROM storage.buckets WHERE id = 'quote-files'), 'PRIVACY: quote-files bucket is private (no permanent public URL)');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polname = 'Public Access to Quote Files'), 'PRIVACY: public SELECT policy removed');
END $$;

-- anonymous public: sees no objects at all (public viewers only get short-lived signed URLs minted server-side)
SELECT tst.anon();
DO $$ BEGIN
  PERFORM tst.ok((SELECT count(*) FROM storage.objects WHERE bucket_id = 'quote-files') = 0, 'PRIVACY-ANON: anonymous caller cannot read any quote file object');
END $$;
SELECT tst.logout();

-- another tenant: cannot read, delete, or see the owner's GC queue
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$ DECLARE n int; BEGIN
  PERFORM tst.ok((SELECT count(*) FROM storage.objects WHERE bucket_id = 'quote-files') = 0, 'PRIVACY-CROSS-TENANT: other tenant cannot read the owner''s objects');
  DELETE FROM storage.objects WHERE bucket_id = 'quote-files'; GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM tst.ok(n = 0, 'PRIVACY-CROSS-TENANT: other tenant cannot delete the owner''s objects');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_attachments) = 0, 'PRIVACY-CROSS-TENANT: other tenant cannot read the owner''s attachment rows');
END $$;
SELECT tst.logout();

-- owner: reads own objects; removing an attachment row queues its object; the object is deleted only from the queue
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$ DECLARE n int; BEGIN
  PERFORM tst.ok((SELECT count(*) FROM storage.objects WHERE bucket_id = 'quote-files') = 4, 'owner reads own objects');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_storage_gc) = 0, 'GC queue empty while every object is referenced');
  DELETE FROM public.quote_attachments WHERE id = '21000000-0000-4000-8000-000000000001';
  PERFORM tst.ok((SELECT count(*) FROM public.quote_storage_gc WHERE storage_path LIKE '%20000000-0000-4000-8000-000000000001_1.pdf') = 1, 'LIFECYCLE: removed persisted attachment queues its object AFTER the row is gone');
  PERFORM tst.ok((SELECT count(*) FROM storage.objects WHERE name LIKE '%20000000-0000-4000-8000-000000000001_1.pdf') = 1, 'LIFECYCLE: the object itself is not deleted by the DB (no premature delete)');
  DELETE FROM storage.objects WHERE bucket_id = 'quote-files' AND name IN (SELECT storage_path FROM public.quote_storage_gc); GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM tst.ok(n = 1, 'LIFECYCLE: owner deletes exactly the queued object (owner DELETE policy)');
  DELETE FROM public.quote_storage_gc WHERE storage_path LIKE '%20000000-0000-4000-8000-000000000001_1.pdf';
  PERFORM tst.ok((SELECT count(*) FROM public.quote_storage_gc) = 0, 'LIFECYCLE: owner acknowledges the queue row');
  -- quote deletion cascades its attachments into the queue
  DELETE FROM public.quotes WHERE id = '20000000-0000-4000-8000-000000000002';
  PERFORM tst.ok((SELECT count(*) FROM public.quote_storage_gc) = 2, 'LIFECYCLE: deleting a draft quote queues all of its attachment objects');
  -- signed/approved quote attachments are frozen: no deletion, nothing queued
  PERFORM tst.throws($q$ DELETE FROM public.quote_attachments WHERE id = '21000000-0000-4000-8000-000000000004' $q$, 'frozen', 'LIFECYCLE: an approved quote''s attachment cannot be removed');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_storage_gc WHERE storage_path LIKE '%000000000003_1.pdf') = 0, 'LIFECYCLE: nothing queued for the frozen attachment');
END $$;
SELECT tst.logout();

-- the other tenant cannot see or acknowledge A's queue
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$ DECLARE n int; BEGIN
  PERFORM tst.ok((SELECT count(*) FROM public.quote_storage_gc) = 0, 'GC queue rows are owner-private');
  DELETE FROM public.quote_storage_gc; GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM tst.ok(n = 0, 'other tenant cannot acknowledge the owner''s queue rows');
END $$;
SELECT tst.logout();
DO $$ BEGIN
  PERFORM tst.ok((SELECT count(*) FROM public.quote_storage_gc) = 2, 'owner queue intact after the cross-tenant attempt');
END $$;
