-- PROFLOW/TEKANGO — PRODUCTION FORWARD MIGRATION (prepared, not applied)
-- Structured Quote / Smart Quote Production Migration Package, Part 3 of 4.
--
-- PROVENANCE: verbatim content of
-- supabase/migrations/20260904000000_add_professional_quote_hierarchy.sql
-- (already TEST-verified, already live on quotecode-test/ljfizgrdyzxddswcedwr
-- since 2026-09-04), reissued under a fresh Production-forward filename.
--
-- DEPENDENCY: must run AFTER Part 1 (20260917000000) - this file ALTERs
-- public.quote_items and public.quote_item_measurements, both created/
-- extended by Part 1. Independent of Part 2.
--
-- Confirmed via fresh, read-only Production audit that quotes.project_name,
-- public.quote_sections, and quote_items.section_id/sort_order/
-- calculation_method do not exist today. An item with a NULL section_id is
-- "unsectioned" - the exact pre-existing flat-quote behavior, byte-
-- identical, so every existing Production quote (32 quotes / 42 items at
-- audit time) keeps working unchanged.

-- ============================================================
-- 1. quotes.project_name — optional Project identity, one per quote
-- ============================================================
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS project_name text;

COMMENT ON COLUMN public.quotes.project_name IS
  'Optional Project/Job identity for this quote. NULL for an ordinary quote - never required.';

-- ============================================================
-- 2. quote_sections — named groups within one quote
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quote_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Same-quote integrity anchor (Codex NO-GO remediation, blocker 2): id is
-- already the PK (already unique) — this composite UNIQUE constraint exists
-- solely so quote_items.section_id can express a composite FK against
-- (id, quote_id) below and have Postgres actually enforce that an item can
-- never reference a section belonging to a different quote.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_sections_id_quote_id_key' AND conrelid = 'public.quote_sections'::regclass) THEN
    ALTER TABLE public.quote_sections ADD CONSTRAINT quote_sections_id_quote_id_key UNIQUE (id, quote_id);
  END IF;
END
$$;

COMMENT ON TABLE public.quote_sections IS
  'A named group of quote_items within one quote. Optional; a quote with zero sections behaves exactly like today''s flat quote.';
COMMENT ON COLUMN public.quote_sections.name IS 'User-entered section label - free text.';
COMMENT ON COLUMN public.quote_sections.sort_order IS 'Preserves section display order.';

ALTER TABLE public.quote_sections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_sections FROM anon;
REVOKE ALL ON public.quote_sections FROM authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.quote_sections TO authenticated;
DROP POLICY IF EXISTS "Owners can manage quote sections" ON public.quote_sections;
CREATE POLICY "Owners can manage quote sections" ON public.quote_sections
  FOR ALL TO public USING (
    EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_sections.quote_id AND quotes.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_sections.quote_id AND quotes.user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS guard_quote_sections_immutability ON public.quote_sections;
CREATE TRIGGER guard_quote_sections_immutability
  BEFORE INSERT OR DELETE OR UPDATE ON public.quote_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quote_child_immutability();

-- Deleting a section must un-group its items (section_id -> NULL), never
-- touch their quote_id, and never be silently blocked/broken by the
-- composite same-quote FK added below. A version-agnostic BEFORE DELETE
-- trigger (works on any Postgres version, unlike a composite FK's
-- column-specific "ON DELETE SET NULL (section_id)" syntax, which is only
-- available on Postgres 15+) explicitly nulls section_id for this section's
-- own items BEFORE the row is removed, so by the time the FK's end-of-
-- statement check runs, no row still points at the deleted section — the
-- composite FK below is therefore left as its safe default (NO ACTION).
-- Trigger name is alphabetically after "guard_quote_sections_immutability"
-- on purpose: Postgres fires same-event BEFORE triggers on one table in
-- name order, so the immutability guard (which can RAISE EXCEPTION and
-- abort the whole DELETE for an approved/paid/signed quote) always runs
-- first — this trigger never unsections items out from under a delete that
-- immutability was about to reject anyway.
CREATE OR REPLACE FUNCTION public.unsection_quote_items_on_section_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.quote_items SET section_id = NULL WHERE section_id = OLD.id;
  RETURN OLD;
END;
$function$;

COMMENT ON FUNCTION public.unsection_quote_items_on_section_delete() IS
  'Same-quote integrity companion (Codex NO-GO remediation, blocker 2): un-groups a deleted section''s own items (section_id -> NULL) before the row is removed, so the composite (section_id, quote_id) -> quote_sections(id, quote_id) FK on quote_items never has to SET NULL an entire composite key (which would incorrectly null quote_id too) and is never left pointing at a gone section.';

DROP TRIGGER IF EXISTS unsection_quote_items_before_section_delete ON public.quote_sections;
CREATE TRIGGER unsection_quote_items_before_section_delete
  BEFORE DELETE ON public.quote_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.unsection_quote_items_on_section_delete();

-- ============================================================
-- 3. quote_items — section membership, order, calculation method
-- ============================================================
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS section_id uuid,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculation_method text;

-- Same-quote-enforcing composite FK (Codex NO-GO remediation, blocker 2) —
-- replaces a plain single-column section_id -> quote_sections(id) FK, which
-- proved nothing about quote_id matching. NULL section_id (unsectioned
-- items, including every pre-existing flat item) is exempt from the check
-- by Postgres' default MATCH SIMPLE semantics — no behavior change for
-- unsectioned items. ON DELETE NO ACTION (the default) is intentional and
-- safe here: the BEFORE DELETE trigger above already nulls section_id for
-- every affected item before this FK's end-of-statement check ever runs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_section_quote_fkey' AND conrelid = 'public.quote_items'::regclass) THEN
    ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_section_quote_fkey
      FOREIGN KEY (section_id, quote_id) REFERENCES public.quote_sections(id, quote_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_calculation_method_check' AND conrelid = 'public.quote_items'::regclass) THEN
    ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_calculation_method_check
      CHECK (calculation_method IS NULL OR calculation_method IN ('manual', 'quantity', 'area', 'linear'));
  END IF;
END
$$;

COMMENT ON COLUMN public.quote_items.section_id IS
  'Optional membership in a quote_sections row. NULL = unsectioned, the exact pre-existing flat-item behavior. Removing a section un-groups its items (section_id -> NULL) rather than destroying them - implemented via the unsection_quote_items_before_section_delete BEFORE DELETE trigger below (NOT a plain "ON DELETE SET NULL" FK action, which would incorrectly null quote_id too on this composite FK - see quote_items_section_quote_fkey and unsection_quote_items_on_section_delete()).';
COMMENT ON COLUMN public.quote_items.sort_order IS
  'Deterministic display order within its section (or within the unsectioned group). Existing rows default to 0.';
COMMENT ON COLUMN public.quote_items.calculation_method IS
  'Structured pricing-method identifier - one of manual/quantity/area/linear. NULL for a Simple item.';

-- ============================================================
-- 4. quote_item_measurements — specification-only vs pricing-driving rows
-- ============================================================
ALTER TABLE public.quote_item_measurements
  ADD COLUMN IF NOT EXISTS is_pricing_driving boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.quote_item_measurements.is_pricing_driving IS
  'true (default, matches all pre-existing rows): this row''s calculated_area contributes to the item''s calculated_quantity. false: shown to the customer but excluded from price/quantity calculation.';

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually):
--
-- ALTER TABLE public.quote_item_measurements DROP COLUMN IF EXISTS is_pricing_driving;
-- ALTER TABLE public.quote_items DROP CONSTRAINT IF EXISTS quote_items_calculation_method_check;
-- ALTER TABLE public.quote_items DROP CONSTRAINT IF EXISTS quote_items_section_quote_fkey;
-- ALTER TABLE public.quote_items DROP COLUMN IF EXISTS calculation_method;
-- ALTER TABLE public.quote_items DROP COLUMN IF EXISTS sort_order;
-- ALTER TABLE public.quote_items DROP COLUMN IF EXISTS section_id;
-- DROP TRIGGER IF EXISTS unsection_quote_items_before_section_delete ON public.quote_sections;
-- DROP FUNCTION IF EXISTS public.unsection_quote_items_on_section_delete();
-- DROP TRIGGER IF EXISTS guard_quote_sections_immutability ON public.quote_sections;
-- DROP POLICY IF EXISTS "Owners can manage quote sections" ON public.quote_sections;
-- ALTER TABLE public.quote_sections DROP CONSTRAINT IF EXISTS quote_sections_id_quote_id_key;
-- DROP TABLE IF EXISTS public.quote_sections;
-- ALTER TABLE public.quotes DROP COLUMN IF EXISTS project_name;
-- ============================================================
