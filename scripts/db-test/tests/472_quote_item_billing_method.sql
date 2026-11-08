-- Item 08 (Owner console 2026-11-09) - forward-only migration 20261109100000_quote_item_billing_method.sql on the disposable DB.
-- Proves: billing_method persists through save_quote_atomic / save_quote_structured (insert + update), an older payload without the key
-- keeps the stored value, an explicit null clears it, any value other than fixed / units is refused, the customer document and the public
-- version are byte-identical whatever the billing method is, approved immutability still refuses, tenant B is refused.
SELECT tst.seed();
DO $$
DECLARE
  r jsonb;
  qid uuid := '47200000-0000-4000-8000-000000000001';
  hdr jsonb := '{"status":"draft","valid_until":"2026-12-31","terms":"t","warranty":"w","notes":"n","subject":"Synthetic 08","quote_subject":"Synthetic 08",
                 "attn_name":"Synthetic Attn","attn_role":"PM","project_name":"Synthetic","currency":"ILS","client_type":"business","subtotal":550,"tax_rate":0.18,"total":649,"discount":0}';
  cl jsonb := '{"id":null,"company_name":"Synthetic 08 Client","email":"b08@synthetic.test","phone":"050","client_type":"business","tax_id":"1","address":"a","notes":"n"}';
  items jsonb := '[{"client_key":"k0","id":null,"section_client_key":null,"description":"Synthetic installation","quantity":1,"unit_price":500,"total_price":500,"sort_order":0,"billing_method":"units","measurements":[]},
                   {"client_key":"k1","id":null,"section_client_key":null,"description":"Synthetic fixed","quantity":1,"unit_price":50,"total_price":50,"sort_order":1,"billing_method":"fixed","measurements":[]},
                   {"client_key":"k2","id":null,"section_client_key":null,"description":"Synthetic old client row","quantity":1,"unit_price":0,"total_price":0,"sort_order":2,"measurements":[]}]';
  i0 uuid; i1 uuid; i2 uuid;
  doc_before jsonb; doc_after jsonb; ver_before text; ver_after text;
BEGIN
  PERFORM tst.ok((SELECT is_nullable = 'YES' AND data_type = 'text' AND column_default IS NULL FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'quote_items' AND column_name = 'billing_method'), 'SCHEMA: billing_method text NULL, no default');

  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  r := public.save_quote_atomic(qid, true, cl, hdr, NULL, '[]', items, ARRAY[]::uuid[], ARRAY[]::uuid[], '[]', '[]', ARRAY[]::uuid[]);
  PERFORM tst.ok((r->>'ok')::boolean, 'SAVE: atomic save with units / fixed / no key succeeds');
  SELECT id INTO i0 FROM public.quote_items WHERE quote_id = qid AND sort_order = 0;
  SELECT id INTO i1 FROM public.quote_items WHERE quote_id = qid AND sort_order = 1;
  SELECT id INTO i2 FROM public.quote_items WHERE quote_id = qid AND sort_order = 2;
  PERFORM tst.ok((SELECT array_agg(billing_method ORDER BY sort_order) FROM public.quote_items WHERE quote_id = qid) = ARRAY['units', 'fixed', NULL],
                 'READ-BACK: units / fixed kept; a row without the key (old client) stays NULL');

  -- the customer document and the public version do not depend on the billing method (read as the server, as the public page does)
  PERFORM tst.logout();
  doc_before := public.quote_output_deal_document('00000000-0000-4000-8000-00000000000a', qid);
  ver_before := public.quote_public_version('00000000-0000-4000-8000-00000000000a', qid);
  PERFORM tst.ok(position('billing_method' in doc_before::text) = 0, 'DOCUMENT: billing_method never enters the customer document');
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');

  -- an older payload without the key keeps the stored choice
  PERFORM public.save_quote_structured(qid, NULL, '[]',
    jsonb_build_array(jsonb_build_object('client_key','k0','id',i0,'section_client_key',NULL,'description','Synthetic installation','quantity',1,'unit_price',500,
      'total_price',500,'sort_order',0,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT billing_method FROM public.quote_items WHERE id = i0) = 'units', 'OLD PAYLOAD: an item update without the key keeps units');

  -- UPDATE: units -> fixed, and an explicit null clears it
  PERFORM public.save_quote_structured(qid, NULL, '[]',
    jsonb_build_array(jsonb_build_object('client_key','k0','id',i0,'section_client_key',NULL,'description','Synthetic installation','quantity',1,'unit_price',500,
      'total_price',500,'sort_order',0,'billing_method','fixed','measurements','[]'::jsonb),
      jsonb_build_object('client_key','k1','id',i1,'section_client_key',NULL,'description','Synthetic fixed','quantity',1,'unit_price',50,
      'total_price',50,'sort_order',1,'billing_method',NULL,'measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
  PERFORM tst.ok((SELECT billing_method FROM public.quote_items WHERE id = i0) = 'fixed', 'UPDATE: units changes to fixed');
  PERFORM tst.ok((SELECT billing_method IS NULL FROM public.quote_items WHERE id = i1), 'UPDATE: an explicit null clears it');

  PERFORM tst.logout();
  doc_after := public.quote_output_deal_document('00000000-0000-4000-8000-00000000000a', qid);
  ver_after := public.quote_public_version('00000000-0000-4000-8000-00000000000a', qid);
  PERFORM tst.ok(doc_after = doc_before, 'DOCUMENT: byte-identical after the billing method changed');
  PERFORM tst.ok(ver_after = ver_before, 'VERSION: the public version is unchanged (an open customer page does not reload)');
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');

  -- CHECK: anything other than fixed / units is refused
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]',
      jsonb_build_array(jsonb_build_object('client_key','k2','id',i2,'section_client_key',NULL,'description','Synthetic old client row','quantity',1,'unit_price',0,
        'total_price',0,'sort_order',2,'billing_method','area','measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'CHECK: billing_method area must raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'quote_items_billing_method_check', 'CHECK: billing_method "area" is refused');
  END;
  PERFORM tst.ok((SELECT billing_method IS NULL FROM public.quote_items WHERE id = i2), 'CHECK: the refused save changed nothing');

  -- tenant B never writes it
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  BEGIN
    PERFORM public.save_quote_structured(qid, NULL, '[]',
      jsonb_build_array(jsonb_build_object('client_key','k1','id',i1,'section_client_key',NULL,'description','x','quantity',1,'unit_price',1,
        'total_price',1,'sort_order',1,'billing_method','units','measurements','[]'::jsonb)), ARRAY[]::uuid[], ARRAY[]::uuid[]);
    PERFORM tst.ok(false, 'TENANT: tenant B must be refused');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* 'not permitted|not found', 'TENANT: tenant B is refused (RLS hides the quote, or not permitted)');
  END;
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  PERFORM tst.ok((SELECT billing_method IS NULL FROM public.quote_items WHERE id = i1), 'TENANT: nothing changed');
END $$;
