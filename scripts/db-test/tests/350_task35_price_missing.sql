-- Task 35 (Codex F4) - forward-only migration 20261012120000_task35_quote_items_price_missing.sql on the disposable DB.
-- Proves: the flag persists through save_quote_structured / save_quote_atomic (insert + update), absent key = false (old clients),
-- the CHECK keeps a missing price at 0, the Free-10 deal document / digest of every quote WITHOUT a missing price is identical to the
-- original projection, a missing price is a real content difference, signed / approved immutability still refuses, tenant B / anon refused.
SELECT tst.seed();
CREATE OR REPLACE FUNCTION tst.deal_document_v1(p_user_id uuid, p_quote_id uuid)
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
                   FROM public.clients c WHERE c.id = q.client_id),
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
  qid uuid := '35000000-0000-4000-8000-000000000001';
  q2 uuid := '35000000-0000-4000-8000-000000000002';
  hdr jsonb := '{"status":"draft","valid_until":"2026-12-31","terms":"t","warranty":"w","notes":"n","subject":"Synthetic T35","quote_subject":"Synthetic T35",
                 "attn_name":"Synthetic Attn","attn_role":"PM","project_name":"Synthetic","currency":"ILS","client_type":"business","subtotal":300,"tax_rate":0.18,"total":354,"discount":0}';
  cl jsonb := '{"id":null,"company_name":"Synthetic T35 Client","email":"t35@synthetic.test","phone":"050","client_type":"business","tax_id":"1","address":"a","notes":"n"}';
  items jsonb := '[{"client_key":"k0","id":null,"section_client_key":null,"description":"Synthetic priced","quantity":3,"unit_price":100,"total_price":300,"price_missing":false,"sort_order":0,"measurements":[]},
                   {"client_key":"k1","id":null,"section_client_key":null,"description":"Synthetic missing","quantity":2,"unit_price":0,"total_price":0,"price_missing":true,"sort_order":1,"measurements":[]},
                   {"client_key":"k2","id":null,"section_client_key":null,"description":"Synthetic free","quantity":1,"unit_price":0,"total_price":0,"price_missing":false,"sort_order":2,"measurements":[]},
                   {"client_key":"k3","id":null,"section_client_key":null,"description":"Synthetic old client","quantity":1,"unit_price":0,"total_price":0,"sort_order":3,"measurements":[]}]';
  plain jsonb := '[{"client_key":"p0","id":null,"section_client_key":null,"description":"Synthetic plain","quantity":1,"unit_price":50,"total_price":50,"sort_order":0,"measurements":[]}]';
  missing_id uuid;
  doc_new jsonb; doc_old jsonb;
BEGIN
  PERFORM tst.ok((SELECT is_nullable = 'NO' AND column_default = 'false' FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'quote_items' AND column_name = 'price_missing'), 'SCHEMA: price_missing boolean NOT NULL DEFAULT false');

  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  r := public.save_quote_atomic(qid, true, cl, hdr, NULL, '[]', items, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.ok((r->>'ok')::boolean, 'SAVE: atomic save with a missing-price line succeeds');
  PERFORM tst.ok((SELECT array_agg(price_missing ORDER BY sort_order) FROM public.quote_items WHERE quote_id = qid) = ARRAY[false, true, false, false],
                 'READ-BACK: priced=false, missing=true, intentional 0=false, absent key (old client)=false');
  PERFORM tst.ok((SELECT unit_price = 0 AND total_price = 0 FROM public.quote_items WHERE quote_id = qid AND sort_order = 1), 'READ-BACK: a missing price keeps the numeric 0 (NOT NULL), never an invented price');
  SELECT id INTO missing_id FROM public.quote_items WHERE quote_id = qid AND sort_order = 1;

  -- UPDATE path: the owner enters the price -> flag false; and back to missing
  PERFORM public.save_quote_structured(qid, NULL, '[]', jsonb_build_array(jsonb_build_object('client_key','k1','id',missing_id,'description','Synthetic missing',
            'quantity',2,'unit_price',80,'total_price',160,'price_missing',false,'sort_order',1,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT NOT price_missing AND unit_price = 80 FROM public.quote_items WHERE id = missing_id), 'UPDATE: an entered price clears the flag');
  PERFORM public.save_quote_structured(qid, NULL, '[]', jsonb_build_array(jsonb_build_object('client_key','k1','id',missing_id,'description','Synthetic missing',
            'quantity',2,'unit_price',0,'total_price',0,'price_missing',true,'sort_order',1,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT price_missing FROM public.quote_items WHERE id = missing_id), 'UPDATE: a cleared price is missing again (flag true)');

  -- CHECK: a missing price can never carry a price
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]', jsonb_build_array(jsonb_build_object('client_key','k1','id',missing_id,'description','x',
              'quantity',2,'unit_price',5,'total_price',10,'price_missing',true,'sort_order',1,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'CHECK: price_missing with a price must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'quote_items_price_missing_zero', 'CHECK: price_missing with a price raises (quote_items_price_missing_zero)');
  END;

  -- tenant B cannot write A's quote (the flag is no new path into another tenant)
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]', jsonb_build_array(jsonb_build_object('client_key','k1','id',missing_id,'description','hijack',
              'quantity',1,'unit_price',0,'total_price',0,'price_missing',false,'sort_order',1,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'TENANT: B must not save A''s quote');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'not permitted|not found', 'TENANT: B is refused');
  END;
  PERFORM tst.ok((SELECT count(*) FROM public.quote_items WHERE quote_id = qid) = 0, 'TENANT: RLS hides A''s items (and their flags) from B');
  PERFORM tst.anon();
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]', '[]', ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'ANON: must not execute save_quote_structured');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'permission denied', 'ANON: no EXECUTE on save_quote_structured (grants re-asserted)');
  END;

  -- Free-10 deal document: a quote WITHOUT a missing price is byte-identical to the original projection (digest unchanged)
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  r := public.save_quote_atomic(q2, true, jsonb_set(cl, '{company_name}', '"Synthetic T35 Client 2"'), hdr, NULL, '[]', plain, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.logout();
  doc_new := public.quote_output_deal_document('00000000-0000-4000-8000-00000000000a', q2);
  doc_old := tst.deal_document_v1('00000000-0000-4000-8000-00000000000a', q2);
  PERFORM tst.ok(doc_new = doc_old AND doc_new::text = doc_old::text, 'DIGEST: a quote without a missing price -> deal document identical to the original projection');
  PERFORM tst.ok(public.quote_output_digest(doc_new) = public.quote_output_digest(doc_old), 'DIGEST: content digest unchanged for every existing kind of quote');
  -- with a missing price: the ONLY difference is "price_missing": true on that item
  doc_new := public.quote_output_deal_document('00000000-0000-4000-8000-00000000000a', qid);
  doc_old := tst.deal_document_v1('00000000-0000-4000-8000-00000000000a', qid);
  PERFORM tst.ok((SELECT count(*) FROM jsonb_array_elements(doc_new->'items') e WHERE e ? 'price_missing') = 1
                 AND (SELECT bool_and((e->>'price_missing')::boolean) FROM jsonb_array_elements(doc_new->'items') e WHERE e ? 'price_missing'),
                 'DIGEST: the missing line alone carries "price_missing": true');
  PERFORM tst.ok(jsonb_set(doc_new, '{items}', (SELECT jsonb_agg(e - 'price_missing' ORDER BY ord) FROM jsonb_array_elements(doc_new->'items') WITH ORDINALITY x(e, ord))) = doc_old,
                 'DIGEST: removing that key gives exactly the original document (no other change)');
  PERFORM tst.ok(public.quote_output_digest(doc_new) <> public.quote_output_digest(doc_old), 'DIGEST: a missing price is a real content difference');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM information_schema.role_routine_grants WHERE routine_name = 'quote_output_deal_document'
                   AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')), 'DIGEST: quote_output_deal_document still has no application-role EXECUTE');

  -- immutability: an approved / signed quote refuses any item change, the flag included
  UPDATE public.quotes SET status = 'approved' WHERE id = qid;
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]', jsonb_build_array(jsonb_build_object('client_key','k1','id',missing_id,'description','Synthetic missing',
              'quantity',2,'unit_price',0,'total_price',0,'price_missing',false,'sort_order',1,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'IMMUTABLE: approved quote item change must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'frozen|not permitted', 'IMMUTABLE: an approved quote refuses the flag change (trigger unchanged)');
  END;
  PERFORM tst.ok((SELECT price_missing FROM public.quote_items WHERE id = missing_id), 'IMMUTABLE: the stored flag is unchanged');
  PERFORM tst.logout();
END $$;
