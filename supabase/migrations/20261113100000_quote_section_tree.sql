-- ============================================================================================================================
-- 20261113100000_quote_section_tree.sql  -  quote headings become a tree (Owner 2026-11-13)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-11-13 (typed: "מאשר שינוי ב-L-05, L-08, L-09, L-13, L-15, L-16, L-17, L-19, L-23, L-24, L-25, L-26, L-27, L-28,
--   L-29 לביצוע האפיון מ-13/11 בשחרור אחד"; spec docs/MANUAL_QUOTE_IMPLEMENTATION_SPEC_2026-11-13.txt; decisions: headings nest
--   floor -> apartment -> room -> lines, no "x N" in new quotes, the customer document keeps today's look). FORWARD-ONLY:
--   1. quote_sections.parent_section_id uuid NULL, no default (adding it writes no row - the signed-quote immutability triggers never
--      fire). NULL = a top-level heading = every heading saved before this migration.
--   2. composite FK (parent_section_id, quote_id) -> quote_sections(id, quote_id) (the existing UNIQUE of 20260917000002): a parent is
--      always a heading of the SAME quote. ON DELETE NO ACTION on purpose: ON DELETE SET NULL on a composite FK nulls quote_id too.
--   3. CHECK parent_section_id <> id.
--   4. BEFORE DELETE trigger: the children of a deleted heading become top-level before the row goes. It does nothing when the quote
--      row is already gone (a quote delete cascades all its headings in ONE statement; re-parenting a row that the same statement deletes
--      next aborts with 27000). For the same reason save_quote_structured removes headings one statement each.
--   5. save_quote_structured: the body of 20261112100000 unchanged except (a) removed headings deleted one per statement, (b) the optional
--      section key "parent_client_key" (absent -> the stored parent stays, so an older app never moves a heading; explicit null / '' ->
--      top level), resolved in a second pass, (c) one check of the whole quote: no loop, at most 4 levels, a heading of identical copies
--      (older quotes) is never nested. Privileges re-asserted.
--   7. a DEFERRED row check at commit (check_quote_section_tree_at_commit): the same three rules on every write path, a direct table
--      write included; save_quote_structured runs its whole-quote check on every save (an older app sends no parent key).
--   6. quote_output_deal_document: the body of 20261112100000 unchanged except "parent_id" enters ONLY when set - every existing
--      document, digest, public version, issued snapshot and signed document stays byte-identical.
-- ROLLBACK (manual): re-apply save_quote_structured and quote_output_deal_document of 20261112100000; DROP TRIGGER
--   check_quote_section_tree_at_commit ON public.quote_sections; DROP FUNCTION public.check_quote_section_tree(); DROP TRIGGER
--   unparent_child_sections_before_section_delete ON public.quote_sections; DROP FUNCTION public.unparent_child_sections_on_section_delete();
--   DROP INDEX public.quote_sections_parent_section_id_idx; drop quote_sections_parent_quote_fkey, quote_sections_parent_not_self and
--   the column.
-- ============================================================================================================================

ALTER TABLE public.quote_sections ADD COLUMN IF NOT EXISTS parent_section_id uuid NULL;
COMMENT ON COLUMN public.quote_sections.parent_section_id IS 'Heading tree (2026-11-13): the heading of the same quote this heading sits under. NULL = a top-level heading (every heading before 2026-11-13).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sections_parent_quote_fkey' AND conrelid = 'public.quote_sections'::regclass) THEN
    ALTER TABLE public.quote_sections ADD CONSTRAINT quote_sections_parent_quote_fkey
      FOREIGN KEY (parent_section_id, quote_id) REFERENCES public.quote_sections(id, quote_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sections_parent_not_self' AND conrelid = 'public.quote_sections'::regclass) THEN
    ALTER TABLE public.quote_sections ADD CONSTRAINT quote_sections_parent_not_self CHECK (parent_section_id IS NULL OR parent_section_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quote_sections_parent_section_id_idx ON public.quote_sections (parent_section_id) WHERE parent_section_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.unparent_child_sections_on_section_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- a cascade after the quote row is deleted finds no quote: all its headings go in the same statement - nothing to re-parent
  IF EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = OLD.quote_id) THEN
    UPDATE public.quote_sections SET parent_section_id = NULL
     WHERE parent_section_id = OLD.id AND quote_id = OLD.quote_id;
  END IF;
  RETURN OLD;
END;
$function$;
COMMENT ON FUNCTION public.unparent_child_sections_on_section_delete() IS
  'Heading tree (2026-11-13): the child headings of a deleted heading become top-level before the row is removed (a composite FK SET NULL would null quote_id too). Skipped when the quote row is already gone (cascade).';
REVOKE EXECUTE ON FUNCTION public.unparent_child_sections_on_section_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS unparent_child_sections_before_section_delete ON public.quote_sections;
CREATE TRIGGER unparent_child_sections_before_section_delete
  BEFORE DELETE ON public.quote_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.unparent_child_sections_on_section_delete();


-- 2026-11-13 (security review): the same three rules for EVERY write path (a direct table write by the owner included), checked at
-- commit on the final state (deferred: a save moves headings in two passes, its intermediate states are never judged).
CREATE OR REPLACE FUNCTION public.check_quote_section_tree()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_cycle boolean;
  v_up integer;
  v_down integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quote_sections WHERE id = NEW.id) THEN
    RETURN NULL; -- deleted later in the same transaction
  END IF;
  WITH RECURSIVE up(id, parent, depth, path, cyc) AS (
    SELECT s.id, s.parent_section_id, 1, ARRAY[s.id], false FROM public.quote_sections s WHERE s.id = NEW.id
    UNION ALL
    SELECT p.id, p.parent_section_id, u.depth + 1, u.path || p.id, p.id = ANY(u.path)
      FROM up u JOIN public.quote_sections p ON p.id = u.parent
     WHERE NOT u.cyc AND u.depth <= 4
  )
  SELECT coalesce(bool_or(cyc), false), coalesce(max(depth) FILTER (WHERE NOT cyc), 1) INTO v_cycle, v_up FROM up;
  IF v_cycle THEN
    RAISE EXCEPTION 'The headings form a loop (a heading inside its own sub-heading)' USING ERRCODE = '22023';
  END IF;
  WITH RECURSIVE down(id, h) AS (
    SELECT NEW.id, 0
    UNION ALL
    SELECT c.id, d.h + 1 FROM down d JOIN public.quote_sections c ON c.parent_section_id = d.id WHERE d.h < 4
  )
  SELECT max(h) INTO v_down FROM down;
  IF v_up + v_down > 4 THEN
    RAISE EXCEPTION 'Headings nest at most 4 levels deep' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.quote_sections s
     WHERE s.repeat_count > 1
       AND (s.id = NEW.id AND (s.parent_section_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.quote_sections c WHERE c.parent_section_id = s.id))
            OR s.id = (SELECT n.parent_section_id FROM public.quote_sections n WHERE n.id = NEW.id))
  ) THEN
    RAISE EXCEPTION 'A heading of identical copies cannot be nested' USING ERRCODE = '22023';
  END IF;
  RETURN NULL;
END;
$function$;
COMMENT ON FUNCTION public.check_quote_section_tree() IS
  'Heading tree (2026-11-13): at commit, a written heading is in no loop, the tree it belongs to is at most 4 levels deep, and a heading of identical copies is never nested.';
REVOKE EXECUTE ON FUNCTION public.check_quote_section_tree() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS check_quote_section_tree_at_commit ON public.quote_sections;
CREATE CONSTRAINT TRIGGER check_quote_section_tree_at_commit
  AFTER INSERT OR UPDATE OF parent_section_id, repeat_count ON public.quote_sections
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.check_quote_section_tree();

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
  -- 2026-11-13 (heading tree)
  v_removed_id uuid;
  v_parent_id uuid;
  v_has_cycle boolean;
  v_max_depth integer;
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
    -- 2026-11-13 (heading tree): one heading per statement - a removed heading's child that is removed too is re-parented by the
    -- trigger and deleted by a LATER statement (one multi-row DELETE would abort with 27000)
    FOREACH v_removed_id IN ARRAY p_removed_section_ids
    LOOP
      DELETE FROM public.quote_sections WHERE id = v_removed_id AND quote_id = p_quote_id;
    END LOOP;
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
            repeat_count = COALESCE((v_section->>'repeat_count')::int, repeat_count),
            -- 2026-11-12: the group kind the user chose (apartment / room / floor / section); a missing key keeps it
            kind = CASE WHEN v_section ? 'kind' THEN NULLIF(v_section->>'kind', '') ELSE kind END
        WHERE id = (v_section->>'id')::uuid AND quote_id = p_quote_id;
      GET DIAGNOSTICS v_matched = ROW_COUNT;
      IF v_matched = 0 THEN
        RAISE EXCEPTION 'Existing section id % not found for this quote' , (v_section->>'id')
          USING ERRCODE = 'P0002';
      END IF;
      v_section_id := (v_section->>'id')::uuid;
    ELSE
      INSERT INTO public.quote_sections (quote_id, name, sort_order, repeat_count, kind)
        VALUES (p_quote_id, v_section->>'name', COALESCE((v_section->>'sort_order')::int, 0),
                COALESCE((v_section->>'repeat_count')::int, 1), NULLIF(v_section->>'kind', ''))
        RETURNING id INTO v_section_id;
    END IF;
    IF (v_section->>'client_key') IS NOT NULL THEN
      v_section_id_map := jsonb_set(v_section_id_map, ARRAY[v_section->>'client_key'], to_jsonb(v_section_id::text));
    END IF;
  END LOOP;

  -- 2026-11-13 (heading tree): second pass - every heading of this request has its id now; "parent_client_key" absent -> the stored
  -- parent stays (an older app never moves a heading); explicit null / '' -> top level; otherwise a key of THIS request
  FOR v_section IN SELECT * FROM jsonb_array_elements(COALESCE(p_sections, '[]'::jsonb))
  LOOP
    CONTINUE WHEN NOT (v_section ? 'parent_client_key');
    v_section_id := COALESCE((v_section_id_map->>(v_section->>'client_key'))::uuid, NULLIF(v_section->>'id', '')::uuid);
    IF v_section_id IS NULL THEN
      RAISE EXCEPTION 'A section with parent_client_key needs a client_key or an id' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(v_section->>'parent_client_key', '') IS NULL THEN
      v_parent_id := NULL;
    ELSE
      v_parent_id := (v_section_id_map->>(v_section->>'parent_client_key'))::uuid;
      IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Unknown parent_client_key "%" for section', (v_section->>'parent_client_key')
          USING ERRCODE = 'P0002';
      END IF;
      IF v_parent_id = v_section_id THEN
        RAISE EXCEPTION 'A heading cannot be inside itself' USING ERRCODE = '22023';
      END IF;
    END IF;
    UPDATE public.quote_sections SET parent_section_id = v_parent_id
     WHERE id = v_section_id AND quote_id = p_quote_id AND parent_section_id IS DISTINCT FROM v_parent_id;
  END LOOP;

  -- 2026-11-13 (heading tree): the whole quote stays a tree - no loop, at most 4 levels, a heading of identical copies (older quotes)
  -- is never nested
  -- (run on every save - an older app that sends no parent key may still set a count on a heading that is nested now)
  IF TRUE THEN
    WITH RECURSIVE walk(start_id, next_id, depth, path, cyc) AS (
      SELECT s.id, s.parent_section_id, 1, ARRAY[s.id], false
        FROM public.quote_sections s WHERE s.quote_id = p_quote_id
      UNION ALL
      SELECT w.start_id, p.parent_section_id, w.depth + 1, w.path || p.id, p.id = ANY(w.path)
        FROM walk w JOIN public.quote_sections p ON p.id = w.next_id AND p.quote_id = p_quote_id
       WHERE NOT w.cyc AND w.depth <= 4  -- a walk that reaches 5 already proves "too deep" - never longer
    )
    SELECT coalesce(bool_or(cyc), false), coalesce(max(depth) FILTER (WHERE NOT cyc), 0)
      INTO v_has_cycle, v_max_depth FROM walk;
    IF v_has_cycle THEN
      RAISE EXCEPTION 'The headings form a loop (a heading inside its own sub-heading)' USING ERRCODE = '22023';
    END IF;
    IF v_max_depth > 4 THEN
      RAISE EXCEPTION 'Headings nest at most 4 levels deep' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.quote_sections s
       WHERE s.quote_id = p_quote_id AND s.repeat_count > 1
         AND (s.parent_section_id IS NOT NULL
              OR EXISTS (SELECT 1 FROM public.quote_sections c WHERE c.quote_id = p_quote_id AND c.parent_section_id = s.id))
    ) THEN
      RAISE EXCEPTION 'A heading of identical copies cannot be nested' USING ERRCODE = '22023';
    END IF;
  END IF;

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
        billing_method = CASE WHEN v_item ? 'billing_method' THEN NULLIF(v_item->>'billing_method', '') ELSE billing_method END,
        -- 2026-11-12: the room tag of a row ('all' = the whole place); a missing key keeps it; explicit null / '' clears it
        room = CASE WHEN v_item ? 'room' THEN NULLIF(v_item->>'room', '') ELSE room END
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
        billing_method, room
      ) VALUES (
        p_quote_id, v_item->>'description', COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0), COALESCE((v_item->>'total_price')::numeric, 0),
        v_item->>'pricing_unit', NULLIF(v_item->>'calculated_quantity', '')::numeric,
        v_item->>'quantity_source', COALESCE(v_item->'specification', '[]'::jsonb), v_item->>'calculation_method',
        v_resolved_section_id, COALESCE((v_item->>'sort_order')::int, 0), COALESCE((v_item->>'price_missing')::boolean, false),
        NULLIF(v_item->>'price_link_id', '')::uuid,
        NULLIF(v_item->>'billing_method', ''),
        NULLIF(v_item->>'room', '')
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

-- the canonical deal document (body 20261112100000 + parent_id only when set)
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
                                           -- 2026-11-12: the kind enters ONLY when set, so every existing document / digest is byte-identical
                                           || CASE WHEN s.kind IS NOT NULL THEN jsonb_build_object('kind', s.kind) ELSE '{}'::jsonb END
                                           -- 2026-11-13: the parent heading enters ONLY when set, so every existing document / digest is byte-identical
                                           || CASE WHEN s.parent_section_id IS NOT NULL THEN jsonb_build_object('parent_id', s.parent_section_id) ELSE '{}'::jsonb END
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
REVOKE ALL ON FUNCTION public.quote_output_deal_document(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
