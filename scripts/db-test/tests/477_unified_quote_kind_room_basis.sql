-- Unified quote (Owner console 2026-11-11) - forward-only migration 20261112100000_unified_quote_kind_room_basis.sql on the disposable DB.
-- Proves: quote_sections.kind / quote_items.room / services.price_basis are nullable text with no default; kind and room persist through
-- save_quote_atomic / save_quote_structured (insert + update); an older payload without the key keeps the stored value; an explicit ''
-- clears it; values outside the CHECK lists are refused; the customer document carries kind / room ONLY when set (a quote without them
-- has no such key - existing documents stay byte-identical) and a room change is a new public version; tenant B is refused.
SELECT tst.seed();
DO $$
DECLARE
  r jsonb;
  qid uuid := '47700000-0000-4000-8000-000000000001';
  hdr jsonb := '{"status":"draft","valid_until":"2026-12-31","terms":"t","warranty":"w","notes":"n","subject":"Synthetic UQ","quote_subject":"Synthetic UQ",
                 "attn_name":"Synthetic Attn","attn_role":"PM","project_name":"Synthetic","currency":"ILS","client_type":"business","subtotal":3600,"tax_rate":0.18,"total":4248,"discount":0}';
  cl jsonb := '{"id":null,"company_name":"Synthetic UQ Client","email":"uq@synthetic.test","phone":"050","client_type":"business","tax_id":"1","address":"a","notes":"n"}';
  secs jsonb := '[{"client_key":"s1","id":null,"name":"דירה 1","sort_order":0,"repeat_count":2,"kind":"apartment"}]';
  items jsonb := '[{"client_key":"k0","id":null,"section_client_key":"s1","description":"Synthetic flooring","quantity":12,"unit_price":150,"total_price":1800,"sort_order":0,"room":"מטבח","measurements":[]},
                   {"client_key":"k1","id":null,"section_client_key":"s1","description":"Synthetic flooring","quantity":30,"unit_price":110,"total_price":3300,"sort_order":1,"room":"סלון","measurements":[]},
                   {"client_key":"k2","id":null,"section_client_key":"s1","description":"Synthetic windows","quantity":4,"unit_price":900,"total_price":3600,"sort_order":2,"room":"all","measurements":[]},
                   {"client_key":"k3","id":null,"section_client_key":null,"description":"Synthetic old row","quantity":1,"unit_price":0,"total_price":0,"sort_order":3,"measurements":[]}]';
  s1 uuid; i0 uuid; i3 uuid; doc jsonb; ver_before text; ver_after text; plain jsonb;
BEGIN
  PERFORM tst.ok((SELECT count(*) = 3 FROM information_schema.columns WHERE table_schema = 'public'
                   AND ((table_name = 'quote_sections' AND column_name = 'kind') OR (table_name = 'quote_items' AND column_name = 'room')
                        OR (table_name = 'services' AND column_name = 'price_basis'))
                   AND is_nullable = 'YES' AND data_type = 'text' AND column_default IS NULL), 'SCHEMA: kind / room / price_basis text NULL, no default');

  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  r := public.save_quote_atomic(qid, true, cl, hdr, NULL, secs, items, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.ok((r->>'ok')::boolean, 'SAVE: atomic save with a kind and rooms succeeds');
  SELECT id INTO s1 FROM public.quote_sections WHERE quote_id = qid;
  SELECT id INTO i0 FROM public.quote_items WHERE quote_id = qid AND sort_order = 0;
  SELECT id INTO i3 FROM public.quote_items WHERE quote_id = qid AND sort_order = 3;
  PERFORM tst.ok((SELECT kind FROM public.quote_sections WHERE id = s1) = 'apartment', 'READ-BACK: the section kind is apartment');
  PERFORM tst.ok((SELECT array_agg(room ORDER BY sort_order) FROM public.quote_items WHERE quote_id = qid) = ARRAY['מטבח', 'סלון', 'all', NULL],
                 'READ-BACK: one row per room with its own tag; "all" kept; a row without the key stays NULL');

  PERFORM tst.logout();
  doc := public.quote_output_deal_document('00000000-0000-4000-8000-00000000000a', qid);
  ver_before := public.quote_public_version('00000000-0000-4000-8000-00000000000a', qid);
  PERFORM tst.ok(doc->'sections'->0->>'kind' = 'apartment', 'DOCUMENT: the section carries its kind when set');
  PERFORM tst.ok((SELECT count(*) FROM jsonb_array_elements(doc->'items') x WHERE x ? 'room') = 3, 'DOCUMENT: the three tagged rows carry their room');
  PERFORM tst.ok((SELECT count(*) FROM jsonb_array_elements(doc->'items') x WHERE NOT (x ? 'room')) = 1, 'DOCUMENT: a row without a room has no room key');
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');

  -- an older payload without the keys keeps the stored values
  PERFORM public.save_quote_structured(qid, NULL,
    jsonb_build_array(jsonb_build_object('client_key','s1','id',s1,'name','דירה 1','sort_order',0,'repeat_count',2)),
    jsonb_build_array(jsonb_build_object('client_key','k0','id',i0,'section_client_key','s1','description','Synthetic flooring','quantity',12,'unit_price',150,
      'total_price',1800,'sort_order',0,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT kind FROM public.quote_sections WHERE id = s1) = 'apartment', 'OLD PAYLOAD: a section update without "kind" keeps it');
  PERFORM tst.ok((SELECT room FROM public.quote_items WHERE id = i0) = 'מטבח', 'OLD PAYLOAD: an item update without "room" keeps it');

  -- a room change is a new version (every saved change shows to the client until the signature)
  PERFORM public.save_quote_structured(qid, NULL,
    jsonb_build_array(jsonb_build_object('client_key','s1','id',s1,'name','דירה 1','sort_order',0,'repeat_count',2,'kind','apartment')),
    jsonb_build_array(jsonb_build_object('client_key','k0','id',i0,'section_client_key','s1','description','Synthetic flooring','quantity',12,'unit_price',150,
      'total_price',1800,'sort_order',0,'room','מרפסת','measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.logout();
  ver_after := public.quote_public_version('00000000-0000-4000-8000-00000000000a', qid);
  PERFORM tst.ok(ver_after IS DISTINCT FROM ver_before, 'VERSION: a room-only change is a new public version');
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');

  -- an explicit '' clears
  PERFORM public.save_quote_structured(qid, NULL,
    jsonb_build_array(jsonb_build_object('client_key','s1','id',s1,'name','דירה 1','sort_order',0,'repeat_count',2,'kind','')),
    jsonb_build_array(jsonb_build_object('client_key','k0','id',i0,'section_client_key','s1','description','Synthetic flooring','quantity',12,'unit_price',150,
      'total_price',1800,'sort_order',0,'room','','measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT kind IS NULL FROM public.quote_sections WHERE id = s1), 'CLEAR: an explicit empty kind clears it');
  PERFORM tst.ok((SELECT room IS NULL FROM public.quote_items WHERE id = i0), 'CLEAR: an explicit empty room clears it');

  -- a quote with no kind and no room: no such key anywhere (existing documents stay byte-identical)
  PERFORM tst.logout();
  plain := public.quote_output_deal_document('00000000-0000-4000-8000-00000000000a', qid);
  PERFORM tst.ok(NOT ((plain->'sections'->0) ? 'kind'), 'DOCUMENT: a section without a kind has no kind key');
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');

  -- CHECK lists
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL,
      jsonb_build_array(jsonb_build_object('client_key','s1','id',s1,'name','דירה 1','sort_order',0,'repeat_count',2,'kind','house')), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'CHECK: kind house must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'quote_sections_kind_check', 'CHECK: a kind outside apartment / room / floor / section is refused');
  END;
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]',
      jsonb_build_array(jsonb_build_object('client_key','k3','id',i3,'section_client_key',NULL,'description','Synthetic old row','quantity',1,'unit_price',0,
        'total_price',0,'sort_order',3,'room',repeat('x', 61),'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'CHECK: a 61-character room must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'quote_items_room_check', 'CHECK: a room longer than 60 characters is refused');
  END;
  BEGIN
    UPDATE public.services SET price_basis = 'meter' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
    INSERT INTO public.services (name, price, user_id, price_basis) VALUES ('Synthetic bad basis', 1, '00000000-0000-4000-8000-00000000000a', 'meter');
    PERFORM tst.ok(false, 'CHECK: price_basis meter must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'services_price_basis_check', 'CHECK: a price basis outside the list is refused');
  END;
  INSERT INTO public.services (name, price, user_id, price_basis) VALUES ('Synthetic tiles', 120, '00000000-0000-4000-8000-00000000000a', 'm2');
  PERFORM tst.ok((SELECT price_basis FROM public.services WHERE name = 'Synthetic tiles' AND user_id = '00000000-0000-4000-8000-00000000000a') = 'm2',
                 'CATALOG: the owner saves a price basis on a catalog item');

  -- tenant B never writes them
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL,
      jsonb_build_array(jsonb_build_object('client_key','s1','id',s1,'name','x','sort_order',0,'repeat_count',1,'kind','room')), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'TENANT: tenant B must be refused');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'not permitted|not found', 'TENANT: tenant B is refused');
  END;
  PERFORM tst.logout();
END $$;
