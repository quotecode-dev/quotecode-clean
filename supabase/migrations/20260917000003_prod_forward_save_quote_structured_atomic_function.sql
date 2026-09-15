-- PROFLOW/TEKANGO — PRODUCTION FORWARD MIGRATION (prepared, not applied)
-- Structured Quote / Smart Quote Production Migration Package, Part 4 of 4.
--
-- PROVENANCE: this file ships ONLY the final, hardened function body -
-- the exact result of applying TEST-only
-- 20260915000000_add_save_quote_structured_atomic_function.sql followed by
-- 20260916000000_harden_save_quote_structured_existing_id_validation.sql in
-- sequence on TEST. Production never ran the intermediate, unhardened
-- 20260915 body, so there is no reason to replay that history here -
-- shipping only the final CREATE OR REPLACE means Production's function
-- goes directly from "does not exist" to "hardened," with zero window in
-- which the unhardened (silent-no-op-on-bad-id) version is ever live.
-- Deliberately smaller than a literal two-file replay - "smallest
-- necessary delta," not a rename of the TEST files.
--
-- DEPENDENCY: must run AFTER Part 1 and Part 3 (20260917000000,
-- 20260917000002) - this function references quote_items.pricing_unit/
-- calculated_quantity/quantity_source/specification/calculation_method/
-- section_id, quote_sections, and quote_item_measurements.is_pricing_driving,
-- all introduced by those two files. Independent of Part 2.
--
-- Confirmed via fresh, read-only Production audit that
-- public.save_quote_structured does not exist today - this is a pure
-- addition, not a replacement of any Production-live function.
--
-- SECURITY INVOKER (not DEFINER): every statement inside runs as the
-- calling authenticated user, subject to the exact same RLS policies as if
-- the client had issued each statement directly. The explicit ownership
-- check at the top fails fast with a clear error rather than relying on
-- RLS to silently affect zero rows.
--
-- Hardening included from day one on Production: an "existing" section/
-- item id supplied by the client that does not match a real row for this
-- exact quote (nonexistent, already removed, or belonging to a different
-- quote - including a different quote owned by the SAME user) raises and
-- rolls back the entire call instead of silently succeeding with the
-- quote-level financial UPDATE still committed.
--
-- Codex NO-GO remediation, additional hardening in this revision:
-- - PUBLIC, anon, AND service_role EXECUTE are all explicitly revoked
--   (blocker 3, later hardened further for service_role in the Codex
--   re-review's own blocker 1 - see the REVOKE block below for the exact
--   runtime-confirmed reason a REVOKE FROM PUBLIC alone is insufficient).
-- - Every id in p_removed_section_ids / p_removed_item_ids is verified to
--   exist for this exact quote BEFORE any DELETE runs; any nonexistent,
--   already-removed, or foreign-quote id raises and rolls back the whole
--   call - no partial deletion, no financial commit survives an invalid
--   removal request (blocker 4). Duplicate ids in the input array are safe
--   (checked/deleted once per distinct id, not double-counted).
-- - A non-null section_client_key on an item that does not resolve to a
--   section created/updated in this same call raises and rolls back,
--   instead of silently unsectioning the item (blocker 5). Duplicate
--   non-null client_key values across p_sections are rejected outright.
-- - quote_items.sort_order is now written on both the INSERT and UPDATE
--   paths (blocker 6) - previously present in the schema but never
--   persisted by this function.

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
        calculated_quantity, quantity_source, specification, calculation_method, section_id, sort_order
      ) VALUES (
        p_quote_id, v_item->>'description', COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0), COALESCE((v_item->>'total_price')::numeric, 0),
        v_item->>'pricing_unit', NULLIF(v_item->>'calculated_quantity', '')::numeric,
        v_item->>'quantity_source', COALESCE(v_item->'specification', '[]'::jsonb), v_item->>'calculation_method',
        v_resolved_section_id, COALESCE((v_item->>'sort_order')::int, 0)
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

COMMENT ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) IS
  'Single atomic transactional boundary for the Smart Quote structured save - quote-level financial fields + quote_sections + quote_items + quote_item_measurements, upsert-by-id (never delete-all-reinsert), one implicit transaction. An "existing" section/item id that does not match a real row for this exact quote raises and rolls back the entire call. SECURITY INVOKER - subject to the same RLS as direct client calls. Production-forward package, ships the final hardened body directly (supersedes TEST-only 20260915000000 + 20260916000000).';

-- Explicit privilege lockdown, matching this repo's own established,
-- runtime-confirmed precedent (see supabase/migrations/20260827000000_add_
-- quote_number_sequence.sql, "CORRECTED 2026-08-28 (Disposable Supabase
-- Runtime Migration Validation task)"): `REVOKE ALL ... FROM PUBLIC` alone
-- does NOT remove `anon`'s or `service_role`'s EXECUTE privilege on a newly
-- created `public`-schema function, because Supabase's own platform-level
-- default privileges grant EXECUTE to `anon`/`authenticated`/`service_role`
-- as individually-recorded ACL entries, not inherited via the `PUBLIC`
-- pseudo-role - a `REVOKE ... FROM PUBLIC` never touches them. Codex NO-GO
-- re-review remediation, blocker 1: the prior revision of this file only
-- revoked from PUBLIC and anon, never service_role - closing exactly the
-- same gap `allocate_quote_number` already closed for real via runtime
-- testing. `service_role` is not an authorized caller of this RPC (the
-- Owner has not authorized any service-role use path for the Smart Quote
-- structured save) - the application always calls it as the authenticated
-- end user, so `service_role` gets no exception carved out here.
REVOKE ALL ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM service_role;
GRANT EXECUTE ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) TO authenticated;

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually):
--
-- REVOKE EXECUTE ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]);
-- ============================================================
