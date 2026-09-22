-- save_quote_atomic: one transaction for client + quote header (project_name/attn) + structure + attachment metadata + removals.
-- Failure injection at every DB stage proves nothing partial remains; retry of a committed new-quote save is idempotent.
SELECT tst.seed();
INSERT INTO public.clients (id, company_name, email, user_id) VALUES
  ('30000000-0000-4000-8000-0000000000c1', 'Synthetic Client Existing', 'existing@synthetic.test', '00000000-0000-4000-8000-00000000000a'),
  ('30000000-0000-4000-8000-0000000000c2', 'Synthetic Client Of B', 'b@synthetic.test', '00000000-0000-4000-8000-00000000000b');

SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE
  r jsonb;
  qid uuid := '31000000-0000-4000-8000-000000000001';
  clients_before int;
  items jsonb := '[{"client_key":"new_0","id":null,"section_client_key":"s1","description":"Synthetic window","quantity":2,"unit_price":191.16,"total_price":382.32,"sort_order":0,
                    "measurements":[{"width":1.2,"height":1.5,"unit":"m","calculated_area":1.8,"label":"","sort_order":0,"is_pricing_driving":true}]},
                   {"client_key":"new_1","id":null,"section_client_key":null,"description":"Synthetic install","quantity":1,"unit_price":100.5,"total_price":100.5,"sort_order":1,"measurements":[]}]';
  sections jsonb := '[{"client_key":"s1","id":null,"name":"Synthetic Room 1","sort_order":0}]';
  att jsonb := '[{"file_name":"plan.pdf","file_size":1234,"storage_path":"00000000-0000-4000-8000-00000000000a/31000000-0000-4000-8000-000000000001_1790000000000.pdf"}]';
  hdr jsonb := '{"status":"draft","valid_until":"2026-09-13","terms":"t","warranty":"w","notes":"n","subject":"Synthetic subject","quote_subject":"Synthetic subject",
                 "attn_name":"Synthetic Attn","attn_role":"PM","project_name":"  Synthetic Tower  ","currency":"ILS","client_type":"business","subtotal":482.82,"tax_rate":0.18,"total":569.73,"discount":0}';
  cl jsonb := '{"id":null,"company_name":"Synthetic New Client","email":"new@synthetic.test","phone":"050","client_type":"business","tax_id":"1","address":"a","notes":"n"}';
BEGIN
  SELECT count(*) INTO clients_before FROM public.clients;

  -- NEW quote, everything in one call
  r := public.save_quote_atomic(qid, true, cl, hdr, NULL, sections, items, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', att, ARRAY[]::uuid[]);
  PERFORM tst.ok((r->>'ok')::boolean AND NOT (r->>'idempotent_replay')::boolean, 'NEW: atomic save succeeds');
  PERFORM tst.ok((SELECT count(*) FROM public.clients) = clients_before + 1, 'NEW: exactly one new client created');
  PERFORM tst.ok((SELECT project_name FROM public.quotes WHERE id = qid) = 'Synthetic Tower', 'PROJECT-NAME: persisted (trimmed) and read back');
  PERFORM tst.ok((SELECT attn_name = 'Synthetic Attn' AND status = 'draft' AND quote_number IS NOT NULL FROM public.quotes WHERE id = qid), 'NEW: header fields + allocated quote number + Draft');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_items WHERE quote_id = qid) = 2, 'NEW: both items persisted');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_item_measurements WHERE quote_id = qid) = 1, 'NEW: measurement persisted');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_sections WHERE quote_id = qid) = 1, 'NEW: grouping (room) persisted');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_attachments WHERE quote_id = qid AND file_url = storage_path) = 1, 'NEW: attachment metadata stored with a storage path, never a public URL');

  -- duplicate retry of the SAME new-quote save (e.g. the response was lost): idempotent, nothing duplicated
  r := public.save_quote_atomic(qid, true, cl, hdr, NULL, sections, items, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', att, ARRAY[]::uuid[]);
  PERFORM tst.ok((r->>'idempotent_replay')::boolean, 'RETRY: duplicate new-quote save is recognised as a replay');
  PERFORM tst.ok((SELECT count(*) FROM public.clients) = clients_before + 1 AND (SELECT count(*) FROM public.quotes WHERE id = qid) = 1
                 AND (SELECT count(*) FROM public.quote_items WHERE quote_id = qid) = 2, 'RETRY: no duplicate client/quote/items');

  -- failure injection: structure fails (unknown section key) -> NOTHING of this call remains
  SELECT count(*) INTO clients_before FROM public.clients;
  BEGIN
    r := public.save_quote_atomic('31000000-0000-4000-8000-000000000002', true, cl, hdr, NULL, '[]',
           '[{"client_key":"x","id":null,"section_client_key":"missing","description":"d","quantity":1,"unit_price":1,"total_price":1,"sort_order":0,"measurements":[]}]',
           ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'FAIL-ITEMS: structured item failure must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'Unknown section_client_key', 'FAIL-ITEMS: structured item failure raises');
  END;
  PERFORM tst.ok((SELECT count(*) FROM public.clients) = clients_before, 'FAIL-ITEMS: the client insert was rolled back');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = '31000000-0000-4000-8000-000000000002'), 'FAIL-ITEMS: no quote shell remains');

  -- failure injection: attachment metadata fails (path outside the caller's folder) -> nothing remains
  BEGIN
    r := public.save_quote_atomic('31000000-0000-4000-8000-000000000003', true, cl, hdr, NULL, '[]', '[]', ARRAY[]::uuid[], ARRAY[]::uuid[], '[]',
           '[{"file_name":"x.pdf","file_size":1,"storage_path":"00000000-0000-4000-8000-00000000000b/31000000-0000-4000-8000-000000000003_1.pdf"}]', ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'FAIL-ATTACH-META: invalid attachment metadata must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'Invalid attachment path', 'FAIL-ATTACH-META: metadata failure after upload raises (caller removes the uploaded object)');
  END;
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = '31000000-0000-4000-8000-000000000003') AND (SELECT count(*) FROM public.clients) = clients_before,
                 'FAIL-ATTACH-META: client/quote/items rolled back');

  -- failure injection: client update fails (client of another tenant) on EDIT -> the quote header is unchanged
  BEGIN
    r := public.save_quote_atomic(qid, false, '{"id":"30000000-0000-4000-8000-0000000000c2","company_name":"hijack"}',
           jsonb_set(hdr, '{project_name}', '"Should Not Persist"'), NULL, '[]', '[]', ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'FAIL-CLIENT: foreign client update must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'Client not found', 'FAIL-CLIENT: client update failure raises');
  END;
  PERFORM tst.ok((SELECT project_name FROM public.quotes WHERE id = qid) = 'Synthetic Tower', 'FAIL-CLIENT: quote header unchanged (no partial edit)');

  -- EDIT: existing client update + project_name change + resave read-back
  r := public.save_quote_atomic(qid, false, '{"id":"30000000-0000-4000-8000-0000000000c1","company_name":"Synthetic Client Existing","email":"e@synthetic.test"}',
         jsonb_set(hdr, '{project_name}', '"Synthetic Tower B"'), NULL, sections, '[]', ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT project_name FROM public.quotes WHERE id = qid) = 'Synthetic Tower B', 'PROJECT-NAME: edit + resave read-back');
  PERFORM tst.ok((SELECT client_id FROM public.quotes WHERE id = qid) = '30000000-0000-4000-8000-0000000000c1', 'EDIT: quote re-linked to the matched existing client');
END $$;

-- removed attachment: row deleted + object queued, in the same transaction; a non-existent removal id rolls the whole edit back
DO $$
DECLARE r jsonb; qid uuid := '31000000-0000-4000-8000-000000000001'; att_id uuid;
BEGIN
  SELECT id INTO att_id FROM public.quote_attachments WHERE quote_id = qid;
  BEGIN
    r := public.save_quote_atomic(qid, false, '{"id":"30000000-0000-4000-8000-0000000000c1","company_name":"Synthetic Client Existing"}',
           '{"status":"draft","project_name":"Changed In Failed Edit"}', NULL, '[{"client_key":"s1","id":null,"name":"R","sort_order":0}]', '[]',
           ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[att_id, '39999999-0000-4000-8000-000000000000'::uuid]);
    PERFORM tst.ok(false, 'FAIL-REMOVE: unknown removal id must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'removed attachments do not exist', 'FAIL-REMOVE: unknown removal id raises');
  END;
  PERFORM tst.ok(EXISTS (SELECT 1 FROM public.quote_attachments WHERE id = att_id), 'FAIL-REMOVE: the valid attachment is NOT removed (all-or-nothing)');
  PERFORM tst.ok((SELECT project_name FROM public.quotes WHERE id = qid) = 'Synthetic Tower B', 'FAIL-REMOVE: header change rolled back');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_storage_gc WHERE storage_path LIKE '%/' || qid::text || '_%') = 0, 'FAIL-REMOVE: nothing queued for deletion');

  r := public.save_quote_atomic(qid, false, '{"id":"30000000-0000-4000-8000-0000000000c1","company_name":"Synthetic Client Existing"}',
         '{"status":"draft","project_name":"Synthetic Tower B"}', NULL, '[{"client_key":"s1","id":null,"name":"R","sort_order":0}]', '[]',
         ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[att_id]);
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_attachments WHERE id = att_id), 'REMOVE: persisted attachment row removed');
  PERFORM tst.ok(jsonb_array_length(r->'removed_storage_paths') = 1 AND (SELECT count(*) FROM public.quote_storage_gc WHERE storage_path LIKE '%/' || qid::text || '_%') = 1, 'REMOVE: its object path is returned and queued for post-commit deletion');

  -- unfinished draft: no items, empty project -> saved as Draft, project_name NULL (never an empty string)
  r := public.save_quote_atomic('31000000-0000-4000-8000-000000000009', true, '{"id":null,"company_name":"Synthetic Draft Client"}',
         '{"status":"draft","project_name":"   ","currency":"ILS","subtotal":0,"total":0,"tax_rate":0.18,"discount":0}', NULL, '[]', '[]',
         ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT status = 'draft' AND project_name IS NULL FROM public.quotes WHERE id = '31000000-0000-4000-8000-000000000009'), 'UNFINISHED-DRAFT: empty quote saved as Draft; blank project_name stored as NULL');
END $$;
SELECT tst.logout();

-- another tenant cannot write into A's quote; anonymous cannot call the RPC at all
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$ BEGIN
  PERFORM tst.throws($q$ SELECT public.save_quote_atomic('31000000-0000-4000-8000-000000000001', false, '{"id":null,"company_name":"x"}', '{"status":"draft"}', NULL, '[]', '[]', ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]) $q$,
    'Not permitted|Quote not found', 'CROSS-TENANT: another tenant cannot edit the quote (RLS hides it)');
  PERFORM tst.throws($q$ SELECT public.save_quote_atomic('31000000-0000-4000-8000-000000000001', true, '{"id":null,"company_name":"x"}', '{"status":"draft"}', NULL, '[]', '[]', ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]) $q$,
    'Not permitted', 'CROSS-TENANT: a replay with a foreign quote id is refused');
END $$;
SELECT tst.logout();
SELECT tst.anon();
DO $$ BEGIN
  PERFORM tst.throws($q$ SELECT public.save_quote_atomic('31000000-0000-4000-8000-000000000001', false, '{}', '{}', NULL, '[]', '[]', ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]) $q$,
    'permission denied', 'ANON: cannot execute save_quote_atomic');
  PERFORM tst.throws($q$ SELECT public.save_quote_atomic_version() $q$, 'permission denied', 'ANON: cannot probe the capability');
END $$;
SELECT tst.logout();
