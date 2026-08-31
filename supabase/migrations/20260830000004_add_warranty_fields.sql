-- PROFLOW — Item 23: Default Warranty ("אחריות" / "Warranty")
--
-- TEST-ONLY PACKAGE (quotecode-test, ljfizgrdyzxddswcedwr) — NOT applied to
-- Production by this task. Independent of the item-17/18 migrations before
-- it (no ordering dependency either way).
--
-- Design: mirrors the existing default_terms/terms pattern exactly.
-- business_settings.default_warranty holds the business's current default
-- (editable any time in Settings); quotes.warranty holds a per-quote
-- SNAPSHOT copied in at quote-creation time, deliberately independent of
-- the business default from that moment on — a later change to
-- default_warranty must never retroactively alter an already-created
-- quote's warranty text, exactly like default_terms/terms today.
--
-- Both columns are plain nullable text — no NOT NULL, no default, no
-- backfill needed. Existing rows simply read NULL, which the frontend
-- treats as "no Warranty section to render" (same convention already used
-- for terms/notes/attn_name/attn_role).
--
-- Immutability: quotes.warranty needs NO new trigger. public.guard_quote_
-- immutability() (20260830000001) copies the entire NEW row into a local
-- `public.quotes`-typed variable and compares it whole-row against OLD once
-- a quote is approved/paid/signed — a newly added column is automatically
-- included in that comparison with zero trigger changes, exactly like every
-- other content column added since that trigger was captured.
--
-- Grants: quotes already has a table-wide grant for authenticated
-- (DELETE, INSERT, SELECT, UPDATE — 20260830000002), so the new `warranty`
-- column needs no additional grant there. business_settings, however, uses
-- deliberate COLUMN-LEVEL least-privilege INSERT/UPDATE grants (not
-- table-wide) — the exact gap class that a prior Phase-1 deep review on
-- this same table caught as a real bug. default_warranty is explicitly
-- added to both column-privilege lists below so business owners can
-- actually save it; this does not touch or re-grant any of the existing
-- column entries.

ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS default_warranty text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS warranty text;

GRANT INSERT (default_warranty) ON public.business_settings TO authenticated;
GRANT UPDATE (default_warranty) ON public.business_settings TO authenticated;

COMMENT ON COLUMN public.business_settings.default_warranty IS
  'Optional default Warranty text ("אחריות"/"Warranty"), separate from default_terms. Copied as a snapshot into quotes.warranty at quote-creation time; editing this default never retroactively changes an existing quote.';
COMMENT ON COLUMN public.quotes.warranty IS
  'Optional per-quote Warranty snapshot, copied from business_settings.default_warranty at creation time. Governed by the same row-level security and the same guard_quote_immutability() whole-row lock as every other quote content column — no warranty-specific trigger exists or is needed.';

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually):
--
-- REVOKE INSERT (default_warranty) ON public.business_settings FROM authenticated;
-- REVOKE UPDATE (default_warranty) ON public.business_settings FROM authenticated;
-- ALTER TABLE public.business_settings DROP COLUMN IF EXISTS default_warranty;
-- ALTER TABLE public.quotes DROP COLUMN IF EXISTS warranty;
-- ============================================================
