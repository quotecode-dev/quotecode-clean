-- One quote builder, stage 3 - forward-only migration 20261108200000_quote_unit_repeat_and_price_link.sql on the disposable DB.
-- Proves: repeat_count / price_link_id persist through save_quote_atomic / save_quote_structured (insert + update), an older payload
-- without the keys keeps the stored values, 0 / 1000 / fractions refused, a shared-price group never mixes billing bases, the deal
-- document of a quote whose units are all 1 is byte-identical to the previous projection (20261030000000), a count above 1 is the only
-- difference, the price link never enters the document, approved immutability still refuses, tenant B / anon refused.
SELECT tst.seed();
-- the previous projection, frozen verbatim from 20261030000000_security_release_2a.sql
CREATE OR REPLACE FUNCTION tst.deal_document_v2(p_user_id uuid, p_quote_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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
  qid uuid := '46900000-0000-4000-8000-000000000001';
  q2 uuid := '46900000-0000-4000-8000-000000000002';
  link uuid := '46900000-0000-4000-8000-0000000000aa';
  hdr jsonb := '{"status":"draft","valid_until":"2026-12-31","terms":"t","warranty":"w","notes":"n","subject":"Synthetic S3","quote_subject":"Synthetic S3",
                 "attn_name":"Synthetic Attn","attn_role":"PM","project_name":"Synthetic","currency":"ILS","client_type":"business","subtotal":2400,"tax_rate":0.18,"total":2832,"discount":0}';
  cl jsonb := '{"id":null,"company_name":"Synthetic S3 Client","email":"s3@synthetic.test","phone":"050","client_type":"business","tax_id":"1","address":"a","notes":"n"}';
  secs jsonb := '[{"client_key":"s0","id":null,"name":"Synthetic type A","sort_order":0,"repeat_count":12},
                  {"client_key":"s1","id":null,"name":"Synthetic old client unit","sort_order":1}]';
  items jsonb := '[{"client_key":"k0","id":null,"section_client_key":"s0","description":"Synthetic tiling","quantity":1,"unit_price":100,"total_price":200,"pricing_unit":"m2","calculated_quantity":2,"sort_order":0,"price_link_id":"46900000-0000-4000-8000-0000000000aa","measurements":[]},
                   {"client_key":"k1","id":null,"section_client_key":"s1","description":"Synthetic tiling copy","quantity":1,"unit_price":100,"total_price":200,"pricing_unit":"m2","calculated_quantity":2,"sort_order":1,"price_link_id":"46900000-0000-4000-8000-0000000000aa","measurements":[]},
                   {"client_key":"k2","id":null,"section_client_key":null,"description":"Synthetic old client row","quantity":1,"unit_price":50,"total_price":50,"sort_order":2,"measurements":[]}]';
  plain_secs jsonb := '[{"client_key":"p0","id":null,"name":"Synthetic single","sort_order":0}]';
  plain jsonb := '[{"client_key":"i0","id":null,"section_client_key":"p0","description":"Synthetic plain","quantity":1,"unit_price":50,"total_price":50,"sort_order":0,"measurements":[]}]';
  s0 uuid; s1 uuid; i0 uuid; i1 uuid; i2 uuid;
  doc_new jsonb; doc_old jsonb;
BEGIN
  PERFORM tst.ok((SELECT is_nullable = 'NO' AND column_default = '1' AND data_type = 'integer' FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'quote_sections' AND column_name = 'repeat_count'), 'SCHEMA: repeat_count integer NOT NULL DEFAULT 1');
  PERFORM tst.ok((SELECT is_nullable = 'YES' AND data_type = 'uuid' AND column_default IS NULL FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'quote_items' AND column_name = 'price_link_id'), 'SCHEMA: price_link_id uuid NULL, no default');

  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  r := public.save_quote_atomic(qid, true, cl, hdr, NULL, secs, items, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.ok((r->>'ok')::boolean, 'SAVE: atomic save with a 12-copy unit and a shared-price pair succeeds');
  SELECT id INTO s0 FROM public.quote_sections WHERE quote_id = qid AND sort_order = 0;
  SELECT id INTO s1 FROM public.quote_sections WHERE quote_id = qid AND sort_order = 1;
  SELECT id INTO i0 FROM public.quote_items WHERE quote_id = qid AND sort_order = 0;
  SELECT id INTO i1 FROM public.quote_items WHERE quote_id = qid AND sort_order = 1;
  SELECT id INTO i2 FROM public.quote_items WHERE quote_id = qid AND sort_order = 2;
  PERFORM tst.ok((SELECT array_agg(repeat_count ORDER BY sort_order) FROM public.quote_sections WHERE quote_id = qid) = ARRAY[12, 1],
                 'READ-BACK: 12 kept; a unit without the key (old client) is 1');
  PERFORM tst.ok((SELECT array_agg(price_link_id::text ORDER BY sort_order) FROM public.quote_items WHERE quote_id = qid) = ARRAY[link::text, link::text, NULL],
                 'READ-BACK: the pair shares the link; a row without the key is unlinked');

  -- an older app (no repeat_count key) never saves a unit of identical copies: refused, nothing changes
  BEGIN
    PERFORM public.save_quote_structured(qid, '{"subtotal":200,"total":236}'::jsonb,
      jsonb_build_array(jsonb_build_object('client_key','s0','id',s0,'name','Synthetic type A renamed','sort_order',0)), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'OLD APP: a section update without repeat_count on a 12-copy unit must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'refresh the app', 'OLD APP: refused (22023, "refresh the app") - never the totals of one copy');
  END;
  PERFORM tst.ok((SELECT repeat_count = 12 AND name = 'Synthetic type A' FROM public.quote_sections WHERE id = s0)
                 AND (SELECT total FROM public.quotes WHERE id = qid) = 2832, 'OLD APP: the unit and the stored totals are unchanged');
  -- a unit of 1 still takes an older payload exactly as before
  PERFORM public.save_quote_structured(qid, NULL,
    jsonb_build_array(jsonb_build_object('client_key','s1','id',s1,'name','Synthetic old client unit','sort_order',1)), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT repeat_count FROM public.quote_sections WHERE id = s1) = 1, 'OLD APP: a unit of 1 saves as before (stays 1)');
  -- an item update WITHOUT price_link_id keeps the link
  PERFORM public.save_quote_structured(qid, NULL, '[]',
    jsonb_build_array(jsonb_build_object('client_key','k0','id',i0,'section_client_key',NULL,'description','Synthetic tiling','quantity',1,'unit_price',100,
      'total_price',200,'pricing_unit','m2','calculated_quantity',2,'sort_order',0,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT price_link_id FROM public.quote_items WHERE id = i0) = link, 'OLD PAYLOAD: an item update without price_link_id keeps the link');
  PERFORM public.save_quote_structured(qid, NULL, jsonb_build_array(jsonb_build_object('client_key','s0','id',s0,'name','Synthetic type A','sort_order',0,'repeat_count',12)),
    jsonb_build_array(jsonb_build_object('client_key','k0','id',i0,'section_client_key','s0','description','Synthetic tiling','quantity',1,'unit_price',100,
      'total_price',200,'pricing_unit','m2','calculated_quantity',2,'sort_order',0,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);

  -- UPDATE: a new count, and an explicit null unlinks
  PERFORM public.save_quote_structured(qid, NULL,
    jsonb_build_array(jsonb_build_object('client_key','s0','id',s0,'name','Synthetic type A','sort_order',0,'repeat_count',3)),
    jsonb_build_array(jsonb_build_object('client_key','k1','id',i1,'section_client_key',NULL,'description','Synthetic tiling copy','quantity',1,'unit_price',100,
      'total_price',200,'pricing_unit','m2','calculated_quantity',2,'sort_order',1,'price_link_id',NULL,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT repeat_count FROM public.quote_sections WHERE id = s0) = 3, 'UPDATE: the count changes to 3');
  PERFORM tst.ok((SELECT price_link_id IS NULL FROM public.quote_items WHERE id = i1), 'UPDATE: an explicit null unlinks the row');

  -- CHECK: 0, 1000 and a fraction are refused
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, jsonb_build_array(jsonb_build_object('client_key','s0','id',s0,'name','x','sort_order',0,'repeat_count',0)), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'CHECK: repeat_count 0 must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'quote_sections_repeat_count_range', 'CHECK: repeat_count 0 is refused');
  END;
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, jsonb_build_array(jsonb_build_object('client_key','s0','id',s0,'name','x','sort_order',0,'repeat_count',1000)), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'CHECK: repeat_count 1000 must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'quote_sections_repeat_count_range', 'CHECK: repeat_count 1000 is refused');
  END;
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, jsonb_build_array(jsonb_build_object('client_key','s0','id',s0,'name','x','sort_order',0,'repeat_count','1.5')), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'CHECK: a fractional repeat_count must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22P02', 'CHECK: a fractional repeat_count is refused');
  END;
  PERFORM tst.ok((SELECT repeat_count FROM public.quote_sections WHERE id = s0) = 3, 'CHECK: the refused saves changed nothing');

  -- a shared-price group never mixes billing bases
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]',
      jsonb_build_array(jsonb_build_object('client_key','k2','id',i2,'section_client_key',NULL,'description','Synthetic old client row','quantity',1,'unit_price',50,
        'total_price',50,'pricing_unit','hour','calculated_quantity',1,'sort_order',2,'price_link_id',link,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'BASIS: linking an hours row to an area group must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLSTATE = '22023' AND SQLERRM ~* 'mixes billing bases', 'BASIS: an hours row cannot join an area group (22023)');
  END;
  PERFORM tst.ok((SELECT price_link_id IS NULL AND pricing_unit IS NULL FROM public.quote_items WHERE id = i2), 'BASIS: the refused save changed nothing');

  -- tenant B / anon
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, jsonb_build_array(jsonb_build_object('client_key','s0','id',s0,'name','hijack','sort_order',0,'repeat_count',999)), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'TENANT: B must not save A''s quote');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'not permitted|not found', 'TENANT: B is refused');
  END;
  PERFORM tst.ok((SELECT count(*) FROM public.quote_sections WHERE quote_id = qid) = 0, 'TENANT: RLS hides A''s units (and their counts) from B');
  PERFORM tst.anon();
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]', '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'ANON: must not execute save_quote_structured');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'permission denied', 'ANON: no EXECUTE on save_quote_structured (grants re-asserted)');
  END;

  -- deal document: every unit at 1 -> byte-identical to the 20261030000000 projection; a count > 1 is the only difference
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  r := public.save_quote_atomic(q2, true, jsonb_set(cl, '{company_name}', '"Synthetic S3 Client 2"'), hdr, NULL, plain_secs, plain, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.logout();
  doc_new := public.quote_output_deal_document('00000000-0000-4000-8000-00000000000a', q2);
  doc_old := tst.deal_document_v2('00000000-0000-4000-8000-00000000000a', q2);
  PERFORM tst.ok(doc_new = doc_old AND doc_new::text = doc_old::text, 'DIGEST: units at 1 -> deal document identical to the previous projection');
  PERFORM tst.ok(public.quote_output_digest(doc_new) = public.quote_output_digest(doc_old), 'DIGEST: content digest unchanged for every existing quote');
  doc_new := public.quote_output_deal_document('00000000-0000-4000-8000-00000000000a', qid);
  doc_old := tst.deal_document_v2('00000000-0000-4000-8000-00000000000a', qid);
  PERFORM tst.ok((SELECT count(*) FROM jsonb_array_elements(doc_new->'sections') e WHERE e ? 'repeat_count') = 1
                 AND (SELECT (e->>'repeat_count')::int FROM jsonb_array_elements(doc_new->'sections') e WHERE e ? 'repeat_count') = 3,
                 'DIGEST: only the 3-copy unit carries "repeat_count": 3');
  PERFORM tst.ok(jsonb_set(doc_new, '{sections}', (SELECT jsonb_agg(e - 'repeat_count' ORDER BY ord) FROM jsonb_array_elements(doc_new->'sections') WITH ORDINALITY x(e, ord))) = doc_old,
                 'DIGEST: removing that key gives exactly the previous document (no other change)');
  PERFORM tst.ok(public.quote_output_digest(doc_new) <> public.quote_output_digest(doc_old), 'DIGEST: a unit count is a real content difference');
  PERFORM tst.ok(position('price_link_id' in doc_new::text) = 0, 'DIGEST: the internal price link never enters the deal document');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'quote_output_deal_document'
                   AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')), 'DIGEST: quote_output_deal_document still has no application-role EXECUTE');

  -- immutability: an approved quote refuses a count change
  UPDATE public.quotes SET status = 'approved' WHERE id = qid;
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, jsonb_build_array(jsonb_build_object('client_key','s0','id',s0,'name','Synthetic type A','sort_order',0,'repeat_count',7)), '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'IMMUTABLE: approved quote count change must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'frozen|not permitted', 'IMMUTABLE: an approved quote refuses the count change (trigger unchanged)');
  END;
  PERFORM tst.ok((SELECT repeat_count FROM public.quote_sections WHERE id = s0) = 3, 'IMMUTABLE: the stored count is unchanged');
  PERFORM tst.logout();
END $$;
