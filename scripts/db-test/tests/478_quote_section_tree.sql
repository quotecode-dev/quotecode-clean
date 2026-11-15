-- Heading tree (Owner 2026-11-13) - forward-only migration 20261113100000_quote_section_tree.sql on the disposable DB.
-- Proves: parent_section_id uuid NULL with a same-quote composite FK (NO ACTION) + not-self CHECK + the re-parent trigger; save with
-- parents; a missing key keeps the parent, explicit null clears; unknown / self / loop / 5th level / nested copies refused with nothing
-- changed; a cross-quote parent refused by the FK; tenant B refused; deleting a parent re-parents its children; a parent and its child
-- removed in ONE save; a quote with a tree deletes (cascade); the deal document of a quote without parents is byte-identical to
-- 20261112100000 and a parent is the only difference.
SELECT tst.seed();
-- the previous projection, frozen verbatim from 20261112100000_unified_quote_kind_room_basis.sql
CREATE OR REPLACE FUNCTION tst.deal_document_20261112(p_user_id uuid, p_quote_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'documentProjection', 'quote-document/v1',
    'quote', jsonb_build_object('id', q.id, 'quote_number', q.quote_number, 'created_at', q.created_at,
      'valid_until', q.valid_until, 'currency', q.currency, 'client_type', q.client_type, 'subject', q.subject,
      'project_name', q.project_name, 'attn_name', q.attn_name, 'attn_role', q.attn_role, 'subtotal', q.subtotal,
      'discount', q.discount, 'tax_rate', q.tax_rate, 'total', q.total, 'terms', q.terms, 'warranty', q.warranty,
      'notes', q.notes),
    'customer', (SELECT jsonb_build_object('company_name', c.company_name, 'email', c.email, 'phone', c.phone,
                                           'address', c.address)
                   FROM public.clients c WHERE c.id = q.client_id AND c.user_id = q.user_id),  -- SEC-DB-02: same tenant only
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'sort_order', s.sort_order)
                                           -- stage 3: the count enters ONLY when above 1, so every existing document / digest is byte-identical
                                           || CASE WHEN s.repeat_count > 1 THEN jsonb_build_object('repeat_count', s.repeat_count) ELSE '{}'::jsonb END
                                           -- 2026-11-12: the kind enters ONLY when set, so every existing document / digest is byte-identical
                                           || CASE WHEN s.kind IS NOT NULL THEN jsonb_build_object('kind', s.kind) ELSE '{}'::jsonb END
                                           ORDER BY s.sort_order, s.id)
                            FROM public.quote_sections s WHERE s.quote_id = q.id), '[]'::jsonb),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
                          'description', i.description, 'quantity', i.quantity, 'unit_price', i.unit_price,
                          'total_price', i.total_price, 'pricing_unit', i.pricing_unit,
                          'calculated_quantity', i.calculated_quantity, 'quantity_source', i.quantity_source,
                          'specification', i.specification, 'section_id', i.section_id,
                          'calculation_method', i.calculation_method, 'sort_order', i.sort_order,
                          'measurements', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                'width', m.width, 'height', m.height, 'unit', m.unit, 'calculated_area', m.calculated_area,
                                'label', m.label, 'sort_order', m.sort_order, 'is_pricing_driving', m.is_pricing_driving)
                                ORDER BY m.sort_order, m.id)
                              FROM public.quote_item_measurements m WHERE m.quote_item_id = i.id), '[]'::jsonb))
                        -- Task 35: the flag enters ONLY when true, so every existing document / digest is byte-identical
                        || CASE WHEN i.price_missing THEN jsonb_build_object('price_missing', true) ELSE '{}'::jsonb END
                        -- 2026-11-12: the room enters ONLY when set (a room-only edit is a new version; old documents unchanged)
                        || CASE WHEN i.room IS NOT NULL THEN jsonb_build_object('room', i.room) ELSE '{}'::jsonb END
                        ORDER BY i.sort_order NULLS LAST, i.id)
                         FROM public.quote_items i WHERE i.quote_id = q.id), '[]'::jsonb),
    'attachmentCount', (SELECT count(*) FROM public.quote_attachments a WHERE a.quote_id = q.id),
    'attachmentManifest', '[]'::jsonb)
    FROM public.quotes q
   WHERE q.id = p_quote_id AND q.user_id = p_user_id
$function$;

DO $$
DECLARE
  r jsonb;
  owner uuid := '00000000-0000-4000-8000-00000000000a';
  qid uuid := '47800000-0000-4000-8000-000000000001';
  q2  uuid := '47800000-0000-4000-8000-000000000002';
  q3  uuid := '47800000-0000-4000-8000-000000000003';
  q4  uuid := '47800000-0000-4000-8000-000000000004';
  hdr jsonb := '{"status":"draft","valid_until":"2026-12-31","terms":"t","warranty":"w","notes":"n","subject":"Synthetic tree","quote_subject":"Synthetic tree",
                 "attn_name":"Synthetic Attn","attn_role":"PM","project_name":"Synthetic","currency":"ILS","client_type":"business","subtotal":1000,"tax_rate":0.18,"total":1180,"discount":0}';
  cl jsonb := '{"id":null,"company_name":"Synthetic Tree Client","email":"tree@synthetic.test","phone":"050","client_type":"business","tax_id":"1","address":"a","notes":"n"}';
  secs jsonb := '[{"client_key":"f1","id":null,"name":"קומה 1","sort_order":0,"kind":"floor","parent_client_key":null},
                  {"client_key":"a1","id":null,"name":"דירה 1","sort_order":1,"kind":"apartment","parent_client_key":"f1"},
                  {"client_key":"r1","id":null,"name":"מטבח","sort_order":2,"kind":"room","parent_client_key":"a1"},
                  {"client_key":"r2","id":null,"name":"סלון","sort_order":3,"kind":"room","parent_client_key":"a1"},
                  {"client_key":"t1","id":null,"name":"Synthetic topic","sort_order":4,"kind":"section"}]';
  items jsonb := '[{"client_key":"k0","id":null,"section_client_key":"a1","description":"Synthetic doors","quantity":2,"unit_price":100,"total_price":200,"sort_order":0,"measurements":[]},
                   {"client_key":"k1","id":null,"section_client_key":"r1","description":"Synthetic tiles","quantity":3,"unit_price":100,"total_price":300,"sort_order":1,"measurements":[]},
                   {"client_key":"k2","id":null,"section_client_key":"r2","description":"Synthetic paint","quantity":4,"unit_price":100,"total_price":400,"sort_order":2,"measurements":[]},
                   {"client_key":"k3","id":null,"section_client_key":"t1","description":"Synthetic cleaning","quantity":1,"unit_price":100,"total_price":100,"sort_order":3,"measurements":[]}]';
  plain_secs jsonb := '[{"client_key":"p0","id":null,"name":"Synthetic single","sort_order":0}]';
  plain jsonb := '[{"client_key":"i0","id":null,"section_client_key":"p0","description":"Synthetic plain","quantity":1,"unit_price":50,"total_price":50,"sort_order":0,"measurements":[]}]';
  f1 uuid; a1 uuid; r1 uuid; r2 uuid; t1 uuid; x4 uuid; other uuid;
  doc_new jsonb; doc_old jsonb; ver_before text; ver_after text;
BEGIN
  PERFORM tst.ok((SELECT is_nullable = 'YES' AND data_type = 'uuid' AND column_default IS NULL FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'quote_sections' AND column_name = 'parent_section_id'), 'SCHEMA: parent_section_id uuid NULL, no default');
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = 'quote_sections_parent_quote_fkey' AND c.contype = 'f' AND c.confdeltype = 'a'
                   AND c.conrelid = 'public.quote_sections'::regclass AND c.confrelid = 'public.quote_sections'::regclass
                   AND pg_get_constraintdef(c.oid) ~ 'FOREIGN KEY \(parent_section_id, quote_id\) REFERENCES (public\.)?quote_sections\(id, quote_id\)$'),
                 'SCHEMA: composite same-quote FK, ON DELETE NO ACTION (never SET NULL of the whole key)');
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'unparent_child_sections_before_section_delete' AND tgrelid = 'public.quote_sections'::regclass AND NOT tgisinternal),
                 'SCHEMA: the BEFORE DELETE re-parent trigger exists');

  PERFORM tst.login(owner);
  r := public.save_quote_atomic(qid, true, cl, hdr, NULL, secs, items, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.ok((r->>'ok')::boolean, 'SAVE: a floor > apartment > two rooms tree + a free topic saves');
  SELECT id INTO f1 FROM public.quote_sections WHERE quote_id = qid AND sort_order = 0;
  SELECT id INTO a1 FROM public.quote_sections WHERE quote_id = qid AND sort_order = 1;
  SELECT id INTO r1 FROM public.quote_sections WHERE quote_id = qid AND sort_order = 2;
  SELECT id INTO r2 FROM public.quote_sections WHERE quote_id = qid AND sort_order = 3;
  SELECT id INTO t1 FROM public.quote_sections WHERE quote_id = qid AND sort_order = 4;
  PERFORM tst.ok((SELECT parent_section_id FROM public.quote_sections WHERE id = a1) = f1
                 AND (SELECT parent_section_id FROM public.quote_sections WHERE id = r1) = a1
                 AND (SELECT parent_section_id FROM public.quote_sections WHERE id = r2) = a1, 'READ-BACK: apartment under the floor, both rooms under the apartment');
  PERFORM tst.ok((SELECT parent_section_id IS NULL FROM public.quote_sections WHERE id = f1) AND (SELECT parent_section_id IS NULL FROM public.quote_sections WHERE id = t1),
                 'READ-BACK: explicit null and a new heading without the key are top level');
  PERFORM tst.ok((SELECT section_id FROM public.quote_items WHERE quote_id = qid AND sort_order = 0) = a1, 'READ-BACK: the apartment holds its own line too');

  PERFORM tst.logout();
  doc_new := public.quote_output_deal_document(owner, qid);
  doc_old := tst.deal_document_20261112(owner, qid);
  PERFORM tst.ok((SELECT count(*) FROM jsonb_array_elements(doc_new->'sections') e WHERE e ? 'parent_id') = 3
                 AND (SELECT e->>'parent_id' FROM jsonb_array_elements(doc_new->'sections') e WHERE (e->>'id')::uuid = r1) = a1::text,
                 'DOCUMENT: the three nested headings carry parent_id, the top-level ones do not');
  PERFORM tst.ok(jsonb_set(doc_new, '{sections}', (SELECT jsonb_agg(e - 'parent_id' ORDER BY ord) FROM jsonb_array_elements(doc_new->'sections') WITH ORDINALITY x(e, ord))) = doc_old,
                 'DOCUMENT: removing parent_id gives exactly the 20261112100000 document (no other change)');
  ver_before := public.quote_public_version(owner, qid);
  PERFORM tst.login(owner);

  -- a missing key keeps the parent (an older app)
  PERFORM public.save_quote_structured(qid, NULL,
    jsonb_build_array(jsonb_build_object('client_key', a1::text, 'id', a1, 'name', 'דירה 1 renamed', 'sort_order', 1, 'repeat_count', 1, 'kind', 'apartment')),
    '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT parent_section_id = f1 AND name = 'דירה 1 renamed' FROM public.quote_sections WHERE id = a1), 'OLD PAYLOAD: no parent_client_key -> the parent stays');

  -- explicit null clears; a parent change is a new public version
  PERFORM public.save_quote_structured(qid, NULL,
    jsonb_build_array(jsonb_build_object('client_key', r2::text, 'id', r2, 'name', 'סלון', 'sort_order', 3, 'repeat_count', 1, 'kind', 'room', 'parent_client_key', NULL)),
    '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT parent_section_id IS NULL FROM public.quote_sections WHERE id = r2), 'CLEAR: explicit null -> top level');
  PERFORM tst.logout();
  ver_after := public.quote_public_version(owner, qid);
  PERFORM tst.ok(ver_after IS DISTINCT FROM ver_before, 'VERSION: a parent-only change is a new public version');
  PERFORM tst.login(owner);
  -- re-attach by key (the key of a loaded heading is its id)
  PERFORM public.save_quote_structured(qid, NULL,
    jsonb_build_array(jsonb_build_object('client_key', a1::text, 'id', a1, 'name', 'דירה 1', 'sort_order', 1, 'repeat_count', 1, 'kind', 'apartment'),
                      jsonb_build_object('client_key', r2::text, 'id', r2, 'name', 'סלון', 'sort_order', 3, 'repeat_count', 1, 'kind', 'room', 'parent_client_key', a1::text)),
    '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT parent_section_id FROM public.quote_sections WHERE id = r2) = a1, 'SET: a key of the same request sets the parent');

  BEGIN
    PERFORM public.save_quote_structured(qid, NULL,
      jsonb_build_array(jsonb_build_object('client_key', r2::text, 'id', r2, 'name', 'סלון', 'sort_order', 3, 'repeat_count', 1, 'parent_client_key', 'nope')), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'UNKNOWN: must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = 'P0002' AND SQLERRM ~* 'unknown parent_client_key', 'UNKNOWN: a parent key not in the request is refused (P0002)');
  END;
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL,
      jsonb_build_array(jsonb_build_object('client_key', r2::text, 'id', r2, 'name', 'סלון', 'sort_order', 3, 'repeat_count', 1, 'parent_client_key', r2::text)), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'SELF: must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'inside itself', 'SELF: a heading under itself is refused (22023)');
  END;
  BEGIN  -- floor under its own room: f1 -> r1 -> a1 -> f1
    PERFORM public.save_quote_structured(qid, NULL,
      jsonb_build_array(jsonb_build_object('client_key', f1::text, 'id', f1, 'name', 'קומה 1', 'sort_order', 0, 'repeat_count', 1, 'parent_client_key', r1::text),
                        jsonb_build_object('client_key', r1::text, 'id', r1, 'name', 'מטבח', 'sort_order', 2, 'repeat_count', 1)), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'CYCLE: must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'loop', 'CYCLE: a loop is refused (22023)');
  END;
  PERFORM tst.ok((SELECT parent_section_id IS NULL FROM public.quote_sections WHERE id = f1), 'CYCLE: the refused save changed nothing');

  -- depth: level 4 accepted, level 5 refused
  PERFORM public.save_quote_structured(qid, NULL,
    jsonb_build_array(jsonb_build_object('client_key', r1::text, 'id', r1, 'name', 'מטבח', 'sort_order', 2, 'repeat_count', 1),
                      jsonb_build_object('client_key', 'x4', 'id', NULL, 'name', 'Synthetic corner', 'sort_order', 5, 'kind', 'section', 'parent_client_key', r1::text)),
    '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
  SELECT id INTO x4 FROM public.quote_sections WHERE quote_id = qid AND name = 'Synthetic corner';
  PERFORM tst.ok((SELECT parent_section_id FROM public.quote_sections WHERE id = x4) = r1, 'DEPTH: a 4th level is accepted');
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL,
      jsonb_build_array(jsonb_build_object('client_key', x4::text, 'id', x4, 'name', 'Synthetic corner', 'sort_order', 5, 'repeat_count', 1),
                        jsonb_build_object('client_key', 'x5', 'id', NULL, 'name', 'Synthetic too deep', 'sort_order', 6, 'parent_client_key', x4::text)),
      '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'DEPTH: a 5th level must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'at most 4 levels', 'DEPTH: a 5th level is refused (22023)');
  END;
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_sections WHERE quote_id = qid AND name = 'Synthetic too deep'), 'DEPTH: nothing was inserted');
  -- RECOMMENDED guard (drop with the migration block if not adopted)
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL,
      jsonb_build_array(jsonb_build_object('client_key', a1::text, 'id', a1, 'name', 'דירה 1', 'sort_order', 1, 'repeat_count', 1),
                        jsonb_build_object('client_key', t1::text, 'id', t1, 'name', 'Synthetic topic', 'sort_order', 4, 'repeat_count', 3, 'parent_client_key', a1::text)),
      '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'COPIES: a nested x3 heading must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'identical copies', 'COPIES: identical copies are never nested');
  END;

  -- the FK: a parent from ANOTHER quote of the same owner is refused even by a direct write; the CHECK refuses self
  r := public.save_quote_atomic(q3, true, jsonb_set(cl, '{company_name}', '"Synthetic Tree Client 3"'), hdr, NULL, plain_secs, plain, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  SELECT id INTO other FROM public.quote_sections WHERE quote_id = q3;
  BEGIN
    UPDATE public.quote_sections SET parent_section_id = other WHERE id = t1;
    PERFORM tst.ok(false, 'FK: a cross-quote parent must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '23503' AND SQLERRM ~* 'quote_sections_parent_quote_fkey', 'FK: a parent of another quote is refused (23503)');
  END;
  BEGIN
    UPDATE public.quote_sections SET parent_section_id = t1 WHERE id = t1;
    PERFORM tst.ok(false, 'CHECK: self must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '23514' AND SQLERRM ~* 'quote_sections_parent_not_self', 'CHECK: parent = itself is refused (23514)');
  END;

  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL,
      jsonb_build_array(jsonb_build_object('client_key', r2::text, 'id', r2, 'name', 'x', 'sort_order', 3, 'repeat_count', 1, 'parent_client_key', NULL)), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'TENANT: must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'not permitted|not found', 'TENANT: tenant B is refused');
  END;
  PERFORM tst.login(owner);

  -- deleting a parent re-parents its children; its own line is un-grouped (existing trigger)
  PERFORM public.save_quote_structured(qid, NULL, '[]', '[]', ARRAY[a1], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT bool_and(parent_section_id IS NULL) FROM public.quote_sections WHERE id IN (r1, r2)), 'DELETE: the rooms of a deleted apartment become top level');
  PERFORM tst.ok((SELECT parent_section_id FROM public.quote_sections WHERE id = x4) = r1, 'DELETE: a grandchild keeps its own parent');
  PERFORM tst.ok((SELECT section_id IS NULL FROM public.quote_items WHERE quote_id = qid AND sort_order = 0), 'DELETE: the apartment''s own line is un-grouped, not deleted');
  -- a parent and its child removed in ONE save (parent first on purpose)
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]', '[]', ARRAY[r1, x4], ARRAY[]::uuid[]);
    PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_sections WHERE id IN (r1, x4)), 'DELETE: a parent and its child go in one save');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(false, 'DELETE: a parent and its child in one save raised: ' || SQLERRM);
  END;

  -- a quote without parents: byte-identical to the previous projection
  r := public.save_quote_atomic(q2, true, jsonb_set(cl, '{company_name}', '"Synthetic Tree Client 2"'), hdr, NULL, plain_secs, plain, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.logout();
  doc_new := public.quote_output_deal_document(owner, q2);
  doc_old := tst.deal_document_20261112(owner, q2);
  PERFORM tst.ok(doc_new = doc_old AND doc_new::text = doc_old::text, 'DIGEST: no parents -> deal document identical to 20261112100000');
  PERFORM tst.ok(public.quote_output_digest(doc_new) = public.quote_output_digest(doc_old), 'DIGEST: content digest unchanged for every existing quote');
  doc_new := public.quote_output_deal_document(owner, qid);
  doc_old := tst.deal_document_20261112(owner, qid);
  PERFORM tst.ok(doc_new = doc_old, 'DIGEST: a tree flattened back to top level is byte-identical again');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'quote_output_deal_document'
                   AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')), 'DIGEST: quote_output_deal_document still has no application-role EXECUTE');

  -- a quote with a tree deletes (the cascade removes every heading in one statement)
  PERFORM tst.login(owner);
  r := public.save_quote_atomic(q4, true, jsonb_set(cl, '{company_name}', '"Synthetic Tree Client 4"'), hdr, NULL, secs, items, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  BEGIN
    DELETE FROM public.quotes WHERE id = q4;
    PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_sections WHERE quote_id = q4), 'CASCADE: deleting a quote with a tree removes all its headings');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(false, 'CASCADE: deleting a quote with a tree raised: ' || SQLERRM);
  END;
  PERFORM tst.anon();
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]', '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'ANON: must not execute save_quote_structured');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'permission denied', 'ANON: no EXECUTE on save_quote_structured (grants re-asserted)');
  END;
  PERFORM tst.logout();
END $$;

-- 2026-11-13 (security review): the tree rules on EVERY write path - the deferred row check (judged at once here with SET CONSTRAINTS
-- IMMEDIATE), the whole-quote check of a save from an older app (no parent key), '' as top level, a raw id of another quote refused
DO $$
DECLARE
  r jsonb;
  owner uuid := '00000000-0000-4000-8000-00000000000a';
  q5 uuid := '47800000-0000-4000-8000-000000000005';
  hdr jsonb := '{"status":"draft","valid_until":"2026-12-31","terms":"t","warranty":"w","notes":"n","subject":"Synthetic guard","quote_subject":"Synthetic guard",
                 "attn_name":"Synthetic Attn","attn_role":"PM","project_name":"Synthetic","currency":"ILS","client_type":"business","subtotal":100,"tax_rate":0.18,"total":118,"discount":0}';
  cl jsonb := '{"id":null,"company_name":"Synthetic Guard Client","email":"guard@synthetic.test","phone":"050","client_type":"business","tax_id":"1","address":"a","notes":"n"}';
  secs jsonb := '[{"client_key":"f1","id":null,"name":"קומה 1","sort_order":0,"kind":"floor","parent_client_key":null},
                  {"client_key":"a1","id":null,"name":"דירה 1","sort_order":1,"kind":"apartment","parent_client_key":"f1"},
                  {"client_key":"r1","id":null,"name":"מטבח","sort_order":2,"kind":"room","parent_client_key":"a1"},
                  {"client_key":"t1","id":null,"name":"Synthetic top","sort_order":3,"kind":"section"},
                  {"client_key":"z1","id":null,"name":"Synthetic z","sort_order":4,"kind":"section"}]';
  f1 uuid; a1 uuid; r1 uuid; t1 uuid; z1 uuid; foreign_id uuid;
BEGIN
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'check_quote_section_tree_at_commit' AND tgrelid = 'public.quote_sections'::regclass
                   AND tgdeferrable AND tginitdeferred AND NOT tgisinternal), 'GUARD: the deferred tree check exists (deferrable, initially deferred)');
  PERFORM tst.login(owner);
  r := public.save_quote_atomic(q5, true, cl, hdr, NULL, secs, '[]', ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.ok((r->>'ok')::boolean, 'GUARD: a 3-level tree saves');
  SELECT id INTO f1 FROM public.quote_sections WHERE quote_id = q5 AND sort_order = 0;
  SELECT id INTO a1 FROM public.quote_sections WHERE quote_id = q5 AND sort_order = 1;
  SELECT id INTO r1 FROM public.quote_sections WHERE quote_id = q5 AND sort_order = 2;
  SELECT id INTO t1 FROM public.quote_sections WHERE quote_id = q5 AND sort_order = 3;
  SELECT id INTO z1 FROM public.quote_sections WHERE quote_id = q5 AND sort_order = 4;
  SET CONSTRAINTS public.check_quote_section_tree_at_commit IMMEDIATE;

  BEGIN
    UPDATE public.quote_sections SET parent_section_id = r1 WHERE id = f1;
    PERFORM tst.ok(false, 'GUARD LOOP: a direct write making a loop must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'loop', 'GUARD LOOP: a direct table write that makes a loop is refused (22023)');
  END;
  PERFORM tst.ok((SELECT parent_section_id IS NULL FROM public.quote_sections WHERE id = f1), 'GUARD LOOP: nothing changed');

  UPDATE public.quote_sections SET parent_section_id = t1 WHERE id = f1;
  PERFORM tst.ok((SELECT parent_section_id FROM public.quote_sections WHERE id = f1) = t1, 'GUARD DEPTH: a direct write to 4 levels is accepted');
  BEGIN
    UPDATE public.quote_sections SET parent_section_id = z1 WHERE id = t1;
    PERFORM tst.ok(false, 'GUARD DEPTH: a direct write to 5 levels must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'at most 4 levels', 'GUARD DEPTH: moving a whole 4-level tree under another heading (5 levels) is refused');
  END;

  BEGIN
    UPDATE public.quote_sections SET repeat_count = 3 WHERE id = a1;
    PERFORM tst.ok(false, 'GUARD COPIES: a direct x3 on a nested heading must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'identical copies', 'GUARD COPIES: a direct x3 on a nested heading is refused');
  END;

  BEGIN
    PERFORM public.save_quote_structured(q5, NULL, jsonb_build_array(jsonb_build_object('client_key', 'a1', 'id', a1, 'name', 'דירה 1', 'sort_order', 1, 'kind', 'apartment', 'repeat_count', 3)),
                                         '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'OLD APP: x3 on a nested heading without parent keys must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'identical copies', 'OLD APP: a save with no parent key is checked too (x3 on a nested heading refused)');
  END;

  PERFORM public.save_quote_structured(q5, NULL, jsonb_build_array(jsonb_build_object('client_key', 'r1', 'id', r1, 'name', 'מטבח', 'sort_order', 2, 'kind', 'room', 'parent_client_key', '')),
                                       '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT parent_section_id IS NULL FROM public.quote_sections WHERE id = r1), 'EMPTY KEY: parent_client_key "" -> top level');

  SELECT s.id INTO foreign_id FROM public.quote_sections s JOIN public.quotes q ON q.id = s.quote_id WHERE q.user_id = owner AND s.quote_id <> q5 LIMIT 1;
  BEGIN
    PERFORM public.save_quote_structured(q5, NULL, jsonb_build_array(jsonb_build_object('client_key', 'r1', 'id', r1, 'name', 'מטבח', 'sort_order', 2, 'kind', 'room', 'parent_client_key', foreign_id::text)),
                                         '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'CROSS-QUOTE: a raw id of another quote''s heading must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = 'P0002', 'CROSS-QUOTE: a heading id of another quote of the same owner is an unknown parent key (P0002)');
  END;
  PERFORM tst.ok(foreign_id IS NOT NULL, 'CROSS-QUOTE: the other quote''s heading exists (the case is real)');
  PERFORM tst.logout();
END $$;
