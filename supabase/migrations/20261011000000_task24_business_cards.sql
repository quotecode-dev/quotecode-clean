-- ============================================================================================================================
-- 20261011000000_task24_business_cards.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Task 24 (Owner prompt owner-chat-2026-10-11-task24-business-card-editor-styles): the editable part of the Phase 5 digital business
-- card. ONE owner-only row per business owner. Forward-only. LOCAL FILE ONLY in Task 24 - not applied to TEST or Production; applying
-- it is a separately authorized step.
--
--   public.business_cards               the card fields that business_settings does not have, the per-channel publish choices (opt-in,
--                                       all false by default) and the card style. The business name / phone / email / address / logo stay
--                                       in business_settings; nothing private is copied here.
--   public.business_cards_guard_row()   BEFORE INSERT/UPDATE: updated_at, immutable owner and created_at
--   RLS                                 enabled AND forced; authenticated owner-only CRUD; no anon / public access. The public card page
--                                       reads ONLY through the get-business-card Edge Function (server key, explicit column list).
--
-- Re-runnable: an existing COMPATIBLE public.business_cards is kept; an existing INCOMPATIBLE object fails closed.
-- Rollback of THIS file (only while no card data must be kept): DROP TABLE public.business_cards; DROP FUNCTION public.business_cards_guard_row().
-- ============================================================================================================================

-- 0. Fail closed on an incompatible pre-existing public.business_cards.
DO $tk_task24_pre$
DECLARE v_shape text;
BEGIN
  IF pg_catalog.to_regclass('public.business_cards') IS NOT NULL THEN
    IF (SELECT c.relkind FROM pg_catalog.pg_class c WHERE c.oid = 'public.business_cards'::regclass) IS DISTINCT FROM 'r' THEN
      RAISE EXCEPTION 'TK_TASK24_INCOMPATIBLE: public.business_cards exists and is not an ordinary table';
    END IF;
    SELECT pg_catalog.string_agg(a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' not null' ELSE '' END, ', ' ORDER BY a.attnum)
      INTO v_shape
      FROM pg_catalog.pg_attribute a
     WHERE a.attrelid = 'public.business_cards'::regclass AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_shape IS DISTINCT FROM 'user_id uuid not null, display_name text, job_title text, slogan text, about text, photo_url text, show_phone boolean not null, show_whatsapp boolean not null, show_email boolean not null, show_address boolean not null, style text not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null' THEN
      RAISE EXCEPTION 'TK_TASK24_INCOMPATIBLE: public.business_cards exists with another column shape';
    END IF;
  END IF;
END
$tk_task24_pre$;

-- 1. The table. Text fields are optional, trimmed and bounded; the photo is an https URL or an inline PNG/JPEG/WebP image of at most
-- ~500 KB (the existing logo rule). Every publish flag starts false: a channel is public only after the owner turns it on.
CREATE TABLE IF NOT EXISTS public.business_cards (
  user_id       uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name  text,
  job_title     text,
  slogan        text,
  about         text,
  photo_url     text,
  show_phone    boolean NOT NULL DEFAULT false,
  show_whatsapp boolean NOT NULL DEFAULT false,
  show_email    boolean NOT NULL DEFAULT false,
  show_address  boolean NOT NULL DEFAULT false,
  style         text NOT NULL DEFAULT 'classic',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_cards_display_name_check CHECK (display_name IS NULL OR (display_name = pg_catalog.btrim(display_name, E' \t\r\n') AND pg_catalog.char_length(display_name) BETWEEN 1 AND 120)),
  CONSTRAINT business_cards_job_title_check CHECK (job_title IS NULL OR (job_title = pg_catalog.btrim(job_title, E' \t\r\n') AND pg_catalog.char_length(job_title) BETWEEN 1 AND 80)),
  CONSTRAINT business_cards_slogan_check CHECK (slogan IS NULL OR (slogan = pg_catalog.btrim(slogan, E' \t\r\n') AND pg_catalog.char_length(slogan) BETWEEN 1 AND 120)),
  CONSTRAINT business_cards_about_check CHECK (about IS NULL OR (about = pg_catalog.btrim(about, E' \t\r\n') AND pg_catalog.char_length(about) BETWEEN 1 AND 600)),
  CONSTRAINT business_cards_photo_url_check CHECK (photo_url IS NULL OR (pg_catalog.char_length(photo_url) <= 700000 AND (photo_url ~ '^https://[^[:space:]]+$' OR photo_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$'))),
  CONSTRAINT business_cards_style_check CHECK (style IN ('classic', 'modern', 'visual'))
);

-- A compatible table created earlier must carry exactly these named checks (fail closed if one is missing).
DO $tk_task24_checks$
DECLARE v_missing text;
BEGIN
  SELECT pg_catalog.string_agg(n, ', ') INTO v_missing
    FROM pg_catalog.unnest(ARRAY['business_cards_display_name_check', 'business_cards_job_title_check', 'business_cards_slogan_check', 'business_cards_about_check', 'business_cards_photo_url_check', 'business_cards_style_check']) AS n
   WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid = 'public.business_cards'::regclass AND c.conname = n AND c.contype = 'c');
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'TK_TASK24_INCOMPATIBLE: public.business_cards lacks the checks %', v_missing; END IF;
END
$tk_task24_checks$;

-- 2. Row guard: trigger-owned timestamps and an immutable owner.
CREATE OR REPLACE FUNCTION public.business_cards_guard_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'TK_BUSINESS_CARD_OWNER_IMMUTABLE: a business card cannot change its owner' USING ERRCODE = '42501';
    END IF;
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.created_at := pg_catalog.now();
  END IF;
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.business_cards_guard_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS business_cards_guard_row ON public.business_cards;
CREATE TRIGGER business_cards_guard_row
  BEFORE INSERT OR UPDATE ON public.business_cards
  FOR EACH ROW EXECUTE FUNCTION public.business_cards_guard_row();

-- 3. Row level security: enabled and forced; the owner only; no anonymous or public access.
ALTER TABLE public.business_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_cards FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.business_cards FROM PUBLIC;
REVOKE ALL ON public.business_cards FROM anon;
REVOKE ALL ON public.business_cards FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_cards TO authenticated;

DROP POLICY IF EXISTS business_cards_select_own ON public.business_cards;
CREATE POLICY business_cards_select_own ON public.business_cards FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS business_cards_insert_own ON public.business_cards;
CREATE POLICY business_cards_insert_own ON public.business_cards FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS business_cards_update_own ON public.business_cards;
CREATE POLICY business_cards_update_own ON public.business_cards FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS business_cards_delete_own ON public.business_cards;
CREATE POLICY business_cards_delete_own ON public.business_cards FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.business_cards IS 'Task 24: digital business card fields, opt-in channel publish flags and card style; owner-only (RLS forced); public reads only through get-business-card (explicit columns).';
