-- ============================================================================================================================
-- 20261108200000_quote_unit_repeat_and_price_link.sql  -  one quote builder, stage 3: identical units and a shared price
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-11-08 (typed: "מאשר את שלב 3 (דירות זהות ומחיר משותף) ואת שלב 4 (תבנית יחידה) לפי ההחלטות, כולל מיגרציה ושינוי
--   ב-L-09, L-17, L-24, L-25, L-26, L-27, L-28, אישור מראה מצילומים לפני כל שער, שחרור עד הלייב"). FORWARD-ONLY:
--   1. quote_sections.repeat_count integer NOT NULL DEFAULT 1, CHECK 1..999: a unit stands for N identical copies. quote_items.total_price
--      stays the total of ONE copy; the quote total (computed by the app, stored in quotes.subtotal / total as today) weights each row by
--      its unit's count. Every existing unit is 1; the constant default writes no row (the signed-quote immutability triggers never fire).
--   2. quote_items.price_link_id uuid NULL: an internal shared-price group inside one quote (rows linked by duplicating a unit). Never in
--      the customer document, the deal digest, a template or an export.
--   3. save_quote_structured (also used by save_quote_atomic): the body of 20261012120000 unchanged except that it persists the optional
--      section key "repeat_count" (absent -> the stored value / 1 for a new unit) and the optional item key "price_link_id" (absent -> the
--      stored value; explicit null -> unlinked); it refuses an older payload (no "repeat_count") for a unit already above 1 (an
--      older app would store the totals of one copy) and a shared-price group that mixes billing bases. Privileges re-asserted.
--   4. quote_output_deal_document: the body of 20261030000000 unchanged except that a unit gets "repeat_count" ONLY when above 1, so every
--      existing document and digest is unchanged.
--   Not changed: RLS, table grants (column-agnostic), the immutability triggers, any existing value.
-- ROLLBACK (manual, only before any unit was saved with repeat_count > 1 or any row linked; otherwise keep the columns):
--   re-apply save_quote_structured of 20261012120000 and quote_output_deal_document of 20261030000000, then
--   ALTER TABLE public.quote_items DROP COLUMN IF EXISTS price_link_id;
--   ALTER TABLE public.quote_sections DROP CONSTRAINT IF EXISTS quote_sections_repeat_count_range;
--   ALTER TABLE public.quote_sections DROP COLUMN IF EXISTS repeat_count;
-- ============================================================================================================================

ALTER TABLE public.quote_sections ADD COLUMN IF NOT EXISTS repeat_count integer NOT NULL DEFAULT 1;
COMMENT ON COLUMN public.quote_sections.repeat_count IS
  'Stage 3 (2026-11-08): how many identical copies this unit stands for (1..999). Item totals are per copy; the quote total weights by this count.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sections_repeat_count_range' AND conrelid = 'public.quote_sections'::regclass) THEN
    ALTER TABLE public.quote_sections ADD CONSTRAINT quote_sections_repeat_count_range CHECK (repeat_count BETWEEN 1 AND 999);
  END IF;
END $$;

ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS price_link_id uuid NULL;
COMMENT ON COLUMN public.quote_items.price_link_id IS
  'Stage 3 (2026-11-08): internal shared-price group inside one quote (rows linked by duplicating a unit). Never shown to the customer.';

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
        price_link_id = CASE WHEN v_item ? 'price_link_id' THEN NULLIF(v_item->>'price_link_id', '')::uuid ELSE price_link_id END
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
        calculated_quantity, quantity_source, specification, calculation_method, section_id, sort_order, price_missing, price_link_id
      ) VALUES (
        p_quote_id, v_item->>'description', COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0), COALESCE((v_item->>'total_price')::numeric, 0),
        v_item->>'pricing_unit', NULLIF(v_item->>'calculated_quantity', '')::numeric,
        v_item->>'quantity_source', COALESCE(v_item->'specification', '[]'::jsonb), v_item->>'calculation_method',
        v_resolved_section_id, COALESCE((v_item->>'sort_order')::int, 0), COALESCE((v_item->>'price_missing')::boolean, false),
        NULLIF(v_item->>'price_link_id', '')::uuid
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

-- the canonical deal document (body 20261030000000 + the marked unit count)
CREATE OR REPLACE FUNCTION public.quote_output_deal_document(p_user_id uuid, p_quote_id uuid)
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
                                           -- stage 3: the count enters ONLY when above 1, so every existing document / digest is byte-identical
                                           || CASE WHEN s.repeat_count > 1 THEN jsonb_build_object('repeat_count', s.repeat_count) ELSE '{}'::jsonb END
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
REVOKE ALL ON FUNCTION public.quote_output_deal_document(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
