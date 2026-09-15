-- PROFLOW/TEKANGO — PRODUCTION FORWARD MIGRATION (prepared, not applied)
-- Structured Quote / Smart Quote Production Migration Package, Part 2 of 4.
--
-- PROVENANCE: verbatim content of
-- supabase/migrations/20260903000000_add_business_professional_domain.sql
-- (already TEST-verified, already live on quotecode-test/ljfizgrdyzxddswcedwr
-- since 2026-09-03), reissued under a fresh Production-forward filename.
-- No ordering dependency on Part 1 - independent additive column on a
-- different table.
--
-- Confirmed via fresh, read-only Production audit that
-- business_settings.professional_domain does not exist today. Free-text,
-- NULL-default, zero backfill, zero existing-row impact.

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS professional_domain text;

COMMENT ON COLUMN public.business_settings.professional_domain IS
  'Free-text key into PROFESSIONAL_DOMAINS (src/utils/professionalQuoteItem.js) - not a DB enum. NULL = not set / general (no default pricing-unit suggestion). Supplies only a default suggestion for new Professional quote items - never a lock.';

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually):
-- ALTER TABLE public.business_settings DROP COLUMN IF EXISTS professional_domain;
-- ============================================================
