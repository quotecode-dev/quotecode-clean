-- PROFLOW — Item 18: Quote Attention Contact ("לידי" / "Attn")
--
-- LOCAL PACKAGE ONLY - NOT applied to the live/production project by this
-- task. Independent of the item-17 quote_number migrations (no ordering
-- dependency either way).
--
-- Design: two plain nullable text columns on quotes, deliberately stored at
-- the QUOTE level (not on clients, not a foreign key to a client-contacts
-- table) so a historical quote keeps showing exactly who it was addressed
-- to at the time, even if the client's own contacts later change or are
-- deleted. Both optional - no NOT NULL, no default, no backfill needed
-- (existing rows simply read NULL, which the frontend already treats as
-- "no Attn block to render").
--
-- No new RLS policy is needed: quotes already has row-level security
-- scoped to the owning user_id for the existing columns, and these two
-- columns are governed by that exact same per-row policy automatically -
-- there is nothing attn-specific to secure differently.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS attn_name text,
  ADD COLUMN IF NOT EXISTS attn_role text;

COMMENT ON COLUMN public.quotes.attn_name IS
  'Optional quote-level "Attn"/"לידי" contact name - stored per-quote (not linked to a live client-contact record) so historical quotes keep their original value even if the client''s own contacts change later.';
COMMENT ON COLUMN public.quotes.attn_role IS
  'Optional quote-level "Attn"/"לידי" contact role/title, paired with attn_name.';

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually):
--
-- ALTER TABLE public.quotes DROP COLUMN IF EXISTS attn_name;
-- ALTER TABLE public.quotes DROP COLUMN IF EXISTS attn_role;
-- ============================================================
