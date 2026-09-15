-- PROFLOW/TEKANGO — PRODUCTION FORWARD MIGRATION (prepared, not applied)
-- Structured Quote / Smart Quote Production Migration Package, Part 1 of 4.
--
-- PROVENANCE: verbatim content of
-- supabase/migrations/20260902000000_add_professional_quote_items_stage_a.sql
-- (already TEST-verified, already live on quotecode-test/ljfizgrdyzxddswcedwr
-- since 2026-09-02), reissued under a fresh Production-forward filename per
-- this release's own migration-package review. Not a new schema design —
-- no statement below differs from the original TEST file. Kept as a
-- separate new file (not a rename/edit of the original) so both the
-- original TEST-history record and this Production-forward record remain
-- intact and independently reviewable.
--
-- Confirmed via fresh, read-only `supabase migration list --project-ref
-- ixabnzhjeqevtbhdfswv` and a direct information_schema/pg_catalog audit
-- (same date) that Production has NEITHER public.quote_item_measurements
-- NOR any of these four quote_items columns today — this is a pure
-- additive delta, zero pre-existing objects to collide with.
--
-- Every statement is additive/idempotent (IF NOT EXISTS / conditional
-- constraint-existence check) and touches only NULL-defaulted new columns
-- or a brand-new child table — zero effect on any existing row in
-- Production's real quotes/quote_items tables (32 quotes / 42 quote_items
-- at the time of this audit).
--
-- Dependency: guard_quote_child_immutability() already exists natively on
-- Production (confirmed live, SECURITY DEFINER, search_path=public) — no
-- new function required for the trigger this file attaches.
--
-- SAME-QUOTE INTEGRITY (Codex NO-GO remediation, blocker 1): a measurement
-- row must never be able to reference an item from a DIFFERENT quote than
-- the one it claims (quote_id). Enforced with a database-level composite
-- foreign key, not application logic alone: quote_items(id, quote_id) is
-- given a UNIQUE constraint below (id is already the PK and therefore
-- already unique — this is a zero-cost index build over quote_items' own
-- real 42-row Production size, not a data rewrite), and
-- quote_item_measurements' single-column quote_item_id FK is replaced with
-- a composite (quote_item_id, quote_id) -> quote_items(id, quote_id) FK.
-- Both columns on quote_item_measurements are NOT NULL, so this check
-- always applies (never silently skipped via MATCH SIMPLE NULL exemption).

-- ============================================================
-- 1. quote_items — 4 additive, nullable columns
-- ============================================================
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS pricing_unit text,
  ADD COLUMN IF NOT EXISTS calculated_quantity numeric,
  ADD COLUMN IF NOT EXISTS quantity_source text,
  ADD COLUMN IF NOT EXISTS specification jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_quantity_source_check' AND conrelid = 'public.quote_items'::regclass) THEN
    ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_quantity_source_check
      CHECK (quantity_source IS NULL OR quantity_source IN ('manual', 'calculated'));
  END IF;
END
$$;

-- Same-quote integrity anchor: id is already the PK (already unique) — this
-- composite UNIQUE constraint exists solely so quote_item_measurements (and,
-- in Part 3, quote_items.section_id) can express a composite FK against
-- (id, quote_id) and have Postgres actually enforce the same-quote pairing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_items_id_quote_id_key' AND conrelid = 'public.quote_items'::regclass) THEN
    ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_id_quote_id_key UNIQUE (id, quote_id);
  END IF;
END
$$;

COMMENT ON COLUMN public.quote_items.pricing_unit IS
  'Professional Quotes Stage A. One of the approved unit ids (unit/m2/linear_meter/kg/hour/day) or NULL for a plain Simple item.';
COMMENT ON COLUMN public.quote_items.calculated_quantity IS
  'Professional Quotes Stage A. The professional-mode active quantity (system-computed from dimensions, or manually corrected). NULL for Simple items; existing quantity column stays authoritative when this is NULL.';
COMMENT ON COLUMN public.quote_items.quantity_source IS
  'Professional Quotes Stage A. Provenance flag for the UI badge only (''manual''|''calculated''|NULL).';
COMMENT ON COLUMN public.quote_items.specification IS
  'Professional Quotes Stage A. Free-form professional specification bag (JSONB).';

-- ============================================================
-- 2. quote_item_measurements — new additive table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quote_item_measurements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id          uuid NOT NULL,
  quote_item_id     uuid NOT NULL,
  width             numeric,
  height            numeric,
  unit              text,
  calculated_area   numeric,
  label             text,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quote_item_measurements IS
  'Professional Quotes Stage A. Repeating dimension/measurement rows for a quote_items row carrying professional/dimensional data. quote_id is a deliberate denormalization from quotes so guard_quote_child_immutability() attaches with zero function change.';
COMMENT ON COLUMN public.quote_item_measurements.width IS 'Entered value, snapshotted exactly as typed - never silently rewritten.';
COMMENT ON COLUMN public.quote_item_measurements.height IS 'Entered value, snapshotted exactly as typed - never silently rewritten.';
COMMENT ON COLUMN public.quote_item_measurements.unit IS 'The entered dimension unit (mm/cm/m/in/ft) - snapshotted exactly, never silently converted.';
COMMENT ON COLUMN public.quote_item_measurements.calculated_area IS 'width x height, computed and persisted on save, never recomputed on render.';
COMMENT ON COLUMN public.quote_item_measurements.label IS 'Optional free-text row identifier.';
COMMENT ON COLUMN public.quote_item_measurements.sort_order IS 'Preserves row entry order for display.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_item_measurements_quote_id_fkey' AND conrelid = 'public.quote_item_measurements'::regclass) THEN
    ALTER TABLE public.quote_item_measurements ADD CONSTRAINT quote_item_measurements_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;
  END IF;
  -- Composite, same-quote-enforcing FK (replaces a plain single-column
  -- quote_item_id -> quote_items(id) FK, which proved nothing about
  -- quote_id matching). A measurement can now never reference an item that
  -- belongs to a different quote than the measurement's own quote_id, even
  -- if both quotes are owned by the same user. Both referencing columns are
  -- NOT NULL, so the check is never exempted. ON DELETE CASCADE: deleting a
  -- quote_items row (any row, any quote) deletes only that exact row's own
  -- measurements, matched on both id AND quote_id — never another quote's.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_item_measurements_item_quote_fkey' AND conrelid = 'public.quote_item_measurements'::regclass) THEN
    ALTER TABLE public.quote_item_measurements ADD CONSTRAINT quote_item_measurements_item_quote_fkey
      FOREIGN KEY (quote_item_id, quote_id) REFERENCES public.quote_items(id, quote_id) ON DELETE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- 3. RLS - identical pattern to "Owners can manage quote items"
-- ============================================================
ALTER TABLE public.quote_item_measurements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_item_measurements FROM anon;
REVOKE ALL ON public.quote_item_measurements FROM authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.quote_item_measurements TO authenticated;
DROP POLICY IF EXISTS "Owners can manage quote item measurements" ON public.quote_item_measurements;
CREATE POLICY "Owners can manage quote item measurements" ON public.quote_item_measurements
  FOR ALL TO public USING (
    EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_item_measurements.quote_id AND quotes.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_item_measurements.quote_id AND quotes.user_id = auth.uid())
  );

-- ============================================================
-- 4. Immutability trigger - reuses existing function verbatim
-- ============================================================
DROP TRIGGER IF EXISTS guard_quote_item_measurements_immutability ON public.quote_item_measurements;
CREATE TRIGGER guard_quote_item_measurements_immutability
  BEFORE INSERT OR DELETE OR UPDATE ON public.quote_item_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quote_child_immutability();

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually):
--
-- DROP TRIGGER IF EXISTS guard_quote_item_measurements_immutability ON public.quote_item_measurements;
-- DROP POLICY IF EXISTS "Owners can manage quote item measurements" ON public.quote_item_measurements;
-- DROP TABLE IF EXISTS public.quote_item_measurements;
-- ALTER TABLE public.quote_items DROP CONSTRAINT IF EXISTS quote_items_id_quote_id_key;
-- ALTER TABLE public.quote_items DROP CONSTRAINT IF EXISTS quote_items_quantity_source_check;
-- ALTER TABLE public.quote_items DROP COLUMN IF EXISTS specification;
-- ALTER TABLE public.quote_items DROP COLUMN IF EXISTS quantity_source;
-- ALTER TABLE public.quote_items DROP COLUMN IF EXISTS calculated_quantity;
-- ALTER TABLE public.quote_items DROP COLUMN IF EXISTS pricing_unit;
-- ============================================================
