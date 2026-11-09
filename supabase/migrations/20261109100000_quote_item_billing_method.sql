-- ============================================================================================================================
-- 20261109100000_quote_item_billing_method.sql  -  item 08 of the 2026-11-08 restore: a row keeps the billing method the user chose
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-11-09 (typed: "שמור את אופן החיוב בשדה נפרד במסד. השורה תיפתח נכון, והמסמך של הלקוח לא ישתנה בכלל. זה דורש
--   מיגרציה, ולכן שחרור ארוך יותר."; part of the 2026-11-08 restore approval, typed incl. L-09, L-17, L-24). FORWARD-ONLY:
--   1. quote_items.billing_method text NULL, CHECK NULL / 'fixed' / 'units': the choice between "a fixed amount" and "units" of a row that
--      has no pricing unit and no sizes - both are stored as the very same line, so a "1 unit" row reopened as "a fixed amount". Only the
--      editor reads it. Every existing row stays NULL (it opens exactly as today, decision 3); the column has no default, so adding it
--      writes no row (the signed-quote immutability triggers never fire).
--   2. save_quote_structured (also used by save_quote_atomic): the body of 20261108200000 unchanged except that it persists the optional
--      item key "billing_method" (absent -> the stored value, so an older app never clears it; explicit null / '' -> cleared).
--      Privileges re-asserted.
--   Not changed: the customer document (quote_output_deal_document names its columns - billing_method is not one of them), the deal
--   digest, the public version, issued snapshots, signed documents, print, PDF, RLS, table grants (column-agnostic), any existing value.
-- ROLLBACK (manual): re-apply save_quote_structured of 20261108200000, then
--   ALTER TABLE public.quote_items DROP CONSTRAINT IF EXISTS quote_items_billing_method_check;
--   ALTER TABLE public.quote_items DROP COLUMN IF EXISTS billing_method;
-- ============================================================================================================================

ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS billing_method text NULL;
COMMENT ON COLUMN public.quote_items.billing_method IS
  'Item 08 (2026-11-09): the editor''s billing method of a row without a pricing unit and without sizes - fixed or units. Never in the customer document.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_billing_method_check' AND conrelid = 'public.quote_items'::regclass) THEN
    ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_billing_method_check CHECK (billing_method IS NULL OR billing_method IN ('fixed', 'units'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.save_quote_structured(
  p_quote_id uuid,
  p_financial jsonb,
  p_sections jsonb,
  p_items jsonb,
  p_removed_section_ids uuid[],
  p_removed_item_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_section jsonb;
  v_item jsonb;
  v_measurement jsonb;
  v_section_id uuid;
  v_item_id uuid;
  v_resolved_section_id uuid;
  v_section_id_map jsonb := '{}'::jsonb;
  v_item_result jsonb := '[]'::jsonb;
  v_matched integer;
BEGIN
  SELECT user_id INTO v_owner FROM public.quotes WHERE id = p_quote_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not permitted' USING ERRCODE = '42501';
  END IF;

  IF p_financial IS NOT NULL THEN
    UPDATE public.quotes SET
      currency = COALESCE(p_financial->>'currency', currency),
      client_type = p_financial->>'client_type',
      tax_rate = NULLIF(p_financial->>'tax_rate', '')::numeric,
      subtotal = NULLIF(p_financial->>'subtotal', '')::numeric,
      discount = NULLIF(p_financial->>'discount', '')::numeric,
      total = NULLIF(p_financial->>'total', '')::numeric
    WHERE id = p_quote_id;
  END IF;

  IF p_removed_section_ids IS NOT NULL AND array_length(p_removed_section_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(p_removed_section_ids) AS rid
      WHERE NOT EXISTS (SELECT 1 FROM public.quote_sections WHERE id = rid AND quote_id = p_quote_id)
    ) THEN
      RAISE EXCEPTION 'One or more removed section ids do not exist for this quote' USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM public.quote_sections WHERE id = ANY(p_removed_section_ids) AND quote_id = p_quote_id;
  END IF;

  IF (
    SELECT count(s->>'client_key') FROM jsonb_array_elements(COALESCE(p_sections, '[]'::jsonb)) s
  ) <> (
    SELECT count(DISTINCT s->>'client_key') FROM jsonb_array_elements(COALESCE(p_sections, '[]'::jsonb)) s
  ) THEN
    RAISE EXCEPTION 'Duplicate section client_key in request' USING ERRCODE = '22023';
  END IF;

  FOR v_section IN SELECT * FROM jsonb_array_elements(COALESCE(p_sections, '[]'::jsonb))
  LOOP
    IF (v_section->>'id') IS NOT NULL THEN
      -- stage 3: an older app (its payload has no "repeat_count") would save the totals of ONE copy for a unit of identical copies
      IF NOT (v_section ? 'repeat_count') AND EXISTS (
        SELECT 1 FROM public.quote_sections WHERE id = (v_section->>'id')::uuid AND quote_id = p_quote_id AND repeat_count > 1
      ) THEN
        RAISE EXCEPTION 'This quote has identical units - refresh the app to save it' USING ERRCODE = '22023';
      END IF;
      UPDATE public.quote_sections
        SET name = v_section->>'name', sort_order = COALESCE((v_section->>'sort_order')::int, 0),
            -- stage 3: an older payload without the key keeps the stored count (never reset to 1)
            repeat_count = COALESCE((v_section->>'repeat_count')::int, repeat_count)
        WHERE id = (v_section->>'id')::uuid AND quote_id = p_quote_id;
      GET DIAGNOSTICS v_matched = ROW_COUNT;
      IF v_matched = 0 THEN
        RAISE EXCEPTION 'Existing section id % not found for this quote' , (v_section->>'id')
          USING ERRCODE = 'P0002';
      END IF;
      v_section_id := (v_section->>'id')::uuid;
    ELSE
      INSERT INTO public.quote_sections (quote_id, name, sort_order, repeat_count)
        VALUES (p_quote_id, v_section->>'name', COALESCE((v_section->>'sort_order')::int, 0),
                COALESCE((v_section->>'repeat_count')::int, 1))
        RETURNING id INTO v_section_id;
    END IF;
    IF (v_section->>'client_key') IS NOT NULL THEN
      v_section_id_map := jsonb_set(v_section_id_map, ARRAY[v_section->>'client_key'], to_jsonb(v_section_id::text));
    END IF;
  END LOOP;

  IF p_removed_item_ids IS NOT NULL AND array_length(p_removed_item_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(p_removed_item_ids) AS rid
      WHERE NOT EXISTS (SELECT 1 FROM public.quote_items WHERE id = rid AND quote_id = p_quote_id)
    ) THEN
      RAISE EXCEPTION 'One or more removed item ids do not exist for this quote' USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM public.quote_items WHERE id = ANY(p_removed_item_ids) AND quote_id = p_quote_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    IF (v_item->>'section_client_key') IS NOT NULL THEN
      v_resolved_section_id := (v_section_id_map->>(v_item->>'section_client_key'))::uuid;
      IF v_resolved_section_id IS NULL THEN
        RAISE EXCEPTION 'Unknown section_client_key "%" for item', (v_item->>'section_client_key')
          USING ERRCODE = 'P0002';
      END IF;
    ELSE
      v_resolved_section_id := NULL;
    END IF;

    IF (v_item->>'id') IS NOT NULL THEN
      UPDATE public.quote_items SET
        description = v_item->>'description',
        quantity = COALESCE((v_item->>'quantity')::integer, 1),
        unit_price = COALESCE((v_item->>'unit_price')::numeric, 0),
        price_missing = COALESCE((v_item->>'price_missing')::boolean, false),
        total_price = COALESCE((v_item->>'total_price')::numeric, 0),
        pricing_unit = v_item->>'pricing_unit',
        calculated_quantity = NULLIF(v_item->>'calculated_quantity', '')::numeric,
        quantity_source = v_item->>'quantity_source',
        specification = COALESCE(v_item->'specification', '[]'::jsonb),
        calculation_method = v_item->>'calculation_method',
        section_id = v_resolved_section_id,
        sort_order = COALESCE((v_item->>'sort_order')::int, 0),
        -- stage 3: a missing key keeps the stored link; an explicit null / '' unlinks
        price_link_id = CASE WHEN v_item ? 'price_link_id' THEN NULLIF(v_item->>'price_link_id', '')::uuid ELSE price_link_id END,
        -- item 08 (2026-11-09): a missing key keeps the stored choice (an older app); an explicit null / '' clears it
        billing_method = CASE WHEN v_item ? 'billing_method' THEN NULLIF(v_item->>'billing_method', '') ELSE billing_method END
      WHERE id = (v_item->>'id')::uuid AND quote_id = p_quote_id;
      GET DIAGNOSTICS v_matched = ROW_COUNT;
      IF v_matched = 0 THEN
        RAISE EXCEPTION 'Existing item id % not found for this quote', (v_item->>'id')
          USING ERRCODE = 'P0002';
      END IF;
      v_item_id := (v_item->>'id')::uuid;
    ELSE
      INSERT INTO public.quote_items (
        quote_id, description, quantity, unit_price, total_price, pricing_unit,
        calculated_quantity, quantity_source, specification, calculation_method, section_id, sort_order, price_missing, price_link_id,
        billing_method
      ) VALUES (
        p_quote_id, v_item->>'description', COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0), COALESCE((v_item->>'total_price')::numeric, 0),
        v_item->>'pricing_unit', NULLIF(v_item->>'calculated_quantity', '')::numeric,
        v_item->>'quantity_source', COALESCE(v_item->'specification', '[]'::jsonb), v_item->>'calculation_method',
        v_resolved_section_id, COALESCE((v_item->>'sort_order')::int, 0), COALESCE((v_item->>'price_missing')::boolean, false),
        NULLIF(v_item->>'price_link_id', '')::uuid,
        NULLIF(v_item->>'billing_method', '')
      ) RETURNING id INTO v_item_id;
    END IF;

    DELETE FROM public.quote_item_measurements WHERE quote_item_id = v_item_id;
    FOR v_measurement IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'measurements', '[]'::jsonb))
    LOOP
      INSERT INTO public.quote_item_measurements (
        quote_id, quote_item_id, width, height, unit, calculated_area, label, sort_order, is_pricing_driving
      ) VALUES (
        p_quote_id, v_item_id,
        NULLIF(v_measurement->>'width', '')::numeric,
        NULLIF(v_measurement->>'height', '')::numeric,
        v_measurement->>'unit',
        NULLIF(v_measurement->>'calculated_area', '')::numeric,
        v_measurement->>'label',
        COALESCE((v_measurement->>'sort_order')::int, 0),
        COALESCE((v_measurement->>'is_pricing_driving')::boolean, true)
      );
    END LOOP;

    v_item_result := v_item_result || jsonb_build_object('client_key', v_item->>'client_key', 'id', v_item_id);
  END LOOP;

  -- stage 3: one shared-price group never mixes billing bases (area / length / hours ...) inside this quote
  IF EXISTS (
    SELECT 1 FROM public.quote_items
     WHERE quote_id = p_quote_id AND price_link_id IS NOT NULL
     GROUP BY price_link_id
    HAVING count(DISTINCT coalesce(pricing_unit, '')) > 1
  ) THEN
    RAISE EXCEPTION 'A shared-price group mixes billing bases' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('ok', true, 'items', v_item_result, 'sections', v_section_id_map);
END;
$function$;

REVOKE ALL ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM service_role;
GRANT EXECUTE ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) TO authenticated;
