-- ============================================================================================================================
-- 20261011110000_task27_p2_schedule_templates_sharing.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Task 27 (P2, Owner spec docs/REFERENCE_INSIGHTS_AND_PRODUCT_IMPROVEMENTS_2026-10-11.md §6). LOCAL FILE ONLY - not applied to TEST or
-- Production; applying it is a separately authorized step. Three owner-only tables; nothing is automated, nothing is sent:
--
--   public.quote_service_schedule   an OPTIONAL work / delivery / event date (+ optional time) of a quote, separate from valid_until
--                                   (acceptance validity). One row per quote; the internal calendar derives its "work" events from it.
--                                   Kept outside quotes so the locked atomic quote save (save_quote_atomic) is not changed.
--   public.quote_templates          reusable WHOLE-quote templates (name + sanitized content: items / units / prices, texts, images and
--                                   style references - what the owner chose to keep). The server refuses customer / identity / status /
--                                   signature / payment / number / public-link / date keys, so a template can never carry them.
--   public.business_share_defaults  default text for MANUAL sharing (copy / WhatsApp / email; variables), an optional thank-you text
--                                   shown to the customer only after a server-verified signature, and an opt-in website link.
-- RLS enabled AND forced; authenticated owner-only CRUD; no anon access (the public quote reads business_share_defaults only through the
-- get-public-quote Edge Function with the server key, explicit columns, and only for a signed quote).
-- Re-runnable: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- Rollback (only while no data must be kept): DROP the three tables and the three guard functions.
-- ============================================================================================================================

-- 1. quote_service_schedule ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_service_schedule (
  quote_id     uuid PRIMARY KEY REFERENCES public.quotes (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  service_date date NOT NULL,
  service_time time without time zone NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_service_schedule_date_range CHECK (service_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
  CONSTRAINT quote_service_schedule_minute CHECK (service_time IS NULL OR date_trunc('minute', service_time) = service_time)
);
CREATE INDEX IF NOT EXISTS quote_service_schedule_user_date ON public.quote_service_schedule (user_id, service_date);

CREATE OR REPLACE FUNCTION public.quote_service_schedule_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.quote_id IS DISTINCT FROM OLD.quote_id) THEN
    RAISE EXCEPTION 'TK_SCHEDULE_IMMUTABLE: owner and quote of a schedule never change' USING ERRCODE = '42501';
  END IF;
  -- the quote must belong to the same owner (the RLS of quotes already hides foreign quotes; this makes it explicit)
  IF NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = NEW.quote_id AND q.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'TK_SCHEDULE_FOREIGN_QUOTE: the quote does not belong to this owner' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); ELSE NEW.created_at := OLD.created_at; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_service_schedule_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS quote_service_schedule_guard ON public.quote_service_schedule;
CREATE TRIGGER quote_service_schedule_guard BEFORE INSERT OR UPDATE ON public.quote_service_schedule
  FOR EACH ROW EXECUTE FUNCTION public.quote_service_schedule_guard();

ALTER TABLE public.quote_service_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_service_schedule FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_service_schedule FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_service_schedule TO authenticated;
DROP POLICY IF EXISTS quote_service_schedule_select ON public.quote_service_schedule;
CREATE POLICY quote_service_schedule_select ON public.quote_service_schedule FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS quote_service_schedule_insert ON public.quote_service_schedule;
CREATE POLICY quote_service_schedule_insert ON public.quote_service_schedule FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS quote_service_schedule_update ON public.quote_service_schedule;
CREATE POLICY quote_service_schedule_update ON public.quote_service_schedule FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS quote_service_schedule_delete ON public.quote_service_schedule;
CREATE POLICY quote_service_schedule_delete ON public.quote_service_schedule FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. quote_templates ----------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name       text NOT NULL,
  content    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_templates_name_check CHECK (name = pg_catalog.btrim(name, E' \t\r\n') AND pg_catalog.char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT quote_templates_content_object CHECK (jsonb_typeof(content) = 'object' AND coalesce(content ->> 'schema', '') = 'quote-template/v1'),
  CONSTRAINT quote_templates_content_size CHECK (pg_catalog.pg_column_size(content) <= 262144),
  -- never a customer, identity, number, status, signature, payment, public link or date (the client sanitizes; the server refuses)
  CONSTRAINT quote_templates_content_sanitized CHECK (NOT (content ?| ARRAY['client', 'clients', 'client_id', 'client_name', 'client_email', 'client_phone',
    'client_tax_id', 'client_address', 'attn_name', 'attn_role', 'quote_number', 'quote_id', 'id', 'status', 'signature', 'signed_at', 'paid_at',
    'payment', 'public_token', 'public_link', 'view_count', 'valid_until', 'created_at', 'service_date', 'user_id'])),
  CONSTRAINT quote_templates_owner_name UNIQUE (user_id, name)
);

CREATE OR REPLACE FUNCTION public.quote_templates_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'TK_TEMPLATE_OWNER_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); ELSE NEW.created_at := OLD.created_at; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_templates_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS quote_templates_guard ON public.quote_templates;
CREATE TRIGGER quote_templates_guard BEFORE INSERT OR UPDATE ON public.quote_templates FOR EACH ROW EXECUTE FUNCTION public.quote_templates_guard();

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_templates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_templates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_templates TO authenticated;
DROP POLICY IF EXISTS quote_templates_select ON public.quote_templates;
CREATE POLICY quote_templates_select ON public.quote_templates FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS quote_templates_insert ON public.quote_templates;
CREATE POLICY quote_templates_insert ON public.quote_templates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS quote_templates_update ON public.quote_templates;
CREATE POLICY quote_templates_update ON public.quote_templates FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS quote_templates_delete ON public.quote_templates;
CREATE POLICY quote_templates_delete ON public.quote_templates FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. business_share_defaults ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_share_defaults (
  user_id                      uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  share_text                   text NULL,
  thanks_text                  text NULL,
  website_url                  text NULL,
  show_website_after_signature boolean NOT NULL DEFAULT false,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_share_defaults_share_text CHECK (share_text IS NULL OR (share_text = pg_catalog.btrim(share_text, E' \t\r\n') AND pg_catalog.char_length(share_text) BETWEEN 1 AND 600)),
  CONSTRAINT business_share_defaults_thanks_text CHECK (thanks_text IS NULL OR (thanks_text = pg_catalog.btrim(thanks_text, E' \t\r\n') AND pg_catalog.char_length(thanks_text) BETWEEN 1 AND 300)),
  CONSTRAINT business_share_defaults_website CHECK (website_url IS NULL OR (pg_catalog.char_length(website_url) <= 300 AND website_url ~ '^https://[^[:space:]<>"]+$')),
  CONSTRAINT business_share_defaults_website_optin CHECK (NOT show_website_after_signature OR website_url IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.business_share_defaults_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, pg_temp AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'TK_SHARE_DEFAULTS_OWNER_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); ELSE NEW.created_at := OLD.created_at; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.business_share_defaults_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS business_share_defaults_guard ON public.business_share_defaults;
CREATE TRIGGER business_share_defaults_guard BEFORE INSERT OR UPDATE ON public.business_share_defaults FOR EACH ROW EXECUTE FUNCTION public.business_share_defaults_guard();

ALTER TABLE public.business_share_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_share_defaults FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_share_defaults FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_share_defaults TO authenticated;
DROP POLICY IF EXISTS business_share_defaults_select ON public.business_share_defaults;
CREATE POLICY business_share_defaults_select ON public.business_share_defaults FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS business_share_defaults_insert ON public.business_share_defaults;
CREATE POLICY business_share_defaults_insert ON public.business_share_defaults FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS business_share_defaults_update ON public.business_share_defaults;
CREATE POLICY business_share_defaults_update ON public.business_share_defaults FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS business_share_defaults_delete ON public.business_share_defaults;
CREATE POLICY business_share_defaults_delete ON public.business_share_defaults FOR DELETE TO authenticated USING (user_id = auth.uid());
