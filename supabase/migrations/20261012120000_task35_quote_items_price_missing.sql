-- ============================================================================================================================
-- 20261012120000_task35_quote_items_price_missing.sql  -  a missing item price is recorded, never saved as a silent free 0 (Task 35)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner prompt 2026-10-12 (owner-chat-2026-10-12-task35-ai-pricing-verification-closure), Codex finding F4: a line whose price was
--   never entered was saved as unit_price 0 (NOT NULL) and came back as an intentional free line. FORWARD-ONLY:
--   1. quote_items.price_missing boolean NOT NULL DEFAULT false. Every existing row is false (a historical 0 is NEVER reinterpreted as
--      missing); the fast default writes no row, so the immutability trigger of signed / approved quotes never fires for existing rows.
--   2. CHECK: a missing price carries the numeric 0 and a 0 line total (unit_price stays NOT NULL; totals are partial, never invented).
--   3. save_quote_structured (also used by save_quote_atomic): the body of 20260917000003 unchanged except that it persists the
--      optional item key "price_missing" (absent -> false, the previous behavior). Privileges re-asserted exactly as before.
--   4. quote_output_deal_document (Free-10 deal-document digest): the item gets "price_missing": true ONLY when true, so every existing
--      document and digest is unchanged; a missing price is a real content difference when it exists.
--   Not changed: RLS, grants on quote_items, the immutability trigger, any existing value. Application code is forward-compatible
--   (it sends the key and reads the column only when present).
-- ROLLBACK (manual, only before any row was written with price_missing = true; otherwise keep the column):
--   re-apply the function bodies of 20260917000003 / 20261007150000, then
--   ALTER TABLE public.quote_items DROP CONSTRAINT IF EXISTS quote_items_price_missing_zero;
--   ALTER TABLE public.quote_items DROP COLUMN IF EXISTS price_missing;
-- ============================================================================================================================

ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS price_missing boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.quote_items.price_missing IS
  'Task 35: true = the price of this line was never entered (unit_price holds 0 only because it is NOT NULL; the totals are partial). false = a real price, or an intentional 0.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_price_missing_zero' AND conrelid = 'public.quote_items'::regclass) THEN
    ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_price_missing_zero
      CHECK (NOT price_missing OR (unit_price = 0 AND coalesce(total_price, 0) = 0));
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
      UPDATE public.quote_sections
        SET name = v_section->>'name', sort_order = COALESCE((v_section->>'sort_order')::int, 0)
        WHERE id = (v_section->>'id')::uuid AND quote_id = p_quote_id;
      GET DIAGNOSTICS v_matched = ROW_COUNT;
      IF v_matched = 0 THEN
        RAISE EXCEPTION 'Existing section id % not found for this quote' , (v_section->>'id')
          USING ERRCODE = 'P0002';
      END IF;
      v_section_id := (v_section->>'id')::uuid;
    ELSE
      INSERT INTO public.quote_sections (quote_id, name, sort_order)
        VALUES (p_quote_id, v_section->>'name', COALESCE((v_section->>'sort_order')::int, 0))
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
        sort_order = COALESCE((v_item->>'sort_order')::int, 0)
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
        calculated_quantity, quantity_source, specification, calculation_method, section_id, sort_order, price_missing
      ) VALUES (
        p_quote_id, v_item->>'description', COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0), COALESCE((v_item->>'total_price')::numeric, 0),
        v_item->>'pricing_unit', NULLIF(v_item->>'calculated_quantity', '')::numeric,
        v_item->>'quantity_source', COALESCE(v_item->'specification', '[]'::jsonb), v_item->>'calculation_method',
        v_resolved_section_id, COALESCE((v_item->>'sort_order')::int, 0), COALESCE((v_item->>'price_missing')::boolean, false)
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

  RETURN jsonb_build_object('ok', true, 'items', v_item_result, 'sections', v_section_id_map);
END;
$function$;

REVOKE ALL ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM service_role;
GRANT EXECUTE ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) TO authenticated;

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
