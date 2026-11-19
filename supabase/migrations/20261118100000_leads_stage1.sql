-- ============================================================================================================================
-- 20261118100000_leads_stage1.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Leads, stage 1 (Owner console 2026-11-18, typed: "מאשר את שלב 1 של הפניות: רישום ההדגמה מ-18/11 בחוק 50 כולל רענון הנעילה, מיגרציה
-- עם גיבוי, ושינוי ב-L-07, L-10, L-15, L-17 ו-L-18, ושחרור עד הלייב"; the approved demo of 18/11 and the Owner's answers of 17/11 in
-- docs/CRM_PREP_DECISIONS_2026-11-17.md). Forward-only.
--
--   public.leads        one row per lead (an enquiry the business records itself), owned by exactly one auth user; cascade on owner
--                       deletion (account erasure removes every lead with no change to admin-delete-user, L-18). Status new /
--                       in progress / not relevant is chosen by hand; "quote sent" exists for the later stage that links a quote.
--                       next_task_id points at the REGULAR task that holds the next follow-up (Tasks, Calendar and the bell show it).
--   public.lead_events  the contact log of a lead (call / meeting / message / note), owner-only, cascade with its lead and its owner.
--   guards              updated_at, immutable owner / created_at, and the SAME-TENANT link rule (a lead may point only at its owner's
--                       own task; an event only at its owner's own lead) - one constant error, existence is never revealed.
--   RLS                 enabled AND forced; authenticated CRUD only where auth.uid() = user_id; no anon / public access.
--
-- No notification, cron, reminder, message or automation of any kind; nothing is ever sent to the lead. No audit-writing or
-- delete-refusing trigger (the 20261016000000 lesson: such a guard would abort the account erasure).
-- Re-runnable: compatible existing objects are kept (IF NOT EXISTS / idempotent statements).
-- Rollback of THIS file (only while no lead data must be kept): DROP TABLE public.lead_events; DROP TABLE public.leads;
-- DROP FUNCTION public.leads_guard_row(); DROP FUNCTION public.lead_events_guard_row().
-- ============================================================================================================================

-- 1. The leads table.
CREATE TABLE IF NOT EXISTS public.leads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  name           text NOT NULL,
  phone          text,
  email          text,
  need           text,
  source         text NOT NULL DEFAULT 'none',
  source_detail  text,
  status         text NOT NULL DEFAULT 'new',
  next_task_id   uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leads_name_check CHECK (name = pg_catalog.btrim(name, E' \t\r\n') AND pg_catalog.char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT leads_phone_check CHECK (phone IS NULL OR (phone = pg_catalog.btrim(phone, E' \t\r\n') AND pg_catalog.char_length(phone) BETWEEN 1 AND 40)),
  CONSTRAINT leads_email_check CHECK (email IS NULL OR (email = pg_catalog.btrim(email, E' \t\r\n') AND pg_catalog.char_length(email) BETWEEN 3 AND 254)),
  CONSTRAINT leads_contact_check CHECK (phone IS NOT NULL OR email IS NOT NULL),
  CONSTRAINT leads_need_check CHECK (need IS NULL OR (need = pg_catalog.btrim(need, E' \t\r\n') AND pg_catalog.char_length(need) BETWEEN 1 AND 500)),
  CONSTRAINT leads_source_check CHECK (source IN ('none', 'ref', 'phone', 'wa', 'web', 'fb', 'other')),
  CONSTRAINT leads_source_detail_check CHECK (source_detail IS NULL OR (source_detail = pg_catalog.btrim(source_detail, E' \t\r\n') AND pg_catalog.char_length(source_detail) BETWEEN 1 AND 200)),
  CONSTRAINT leads_status_check CHECK (status IN ('new', 'prog', 'sent', 'off'))
);

CREATE INDEX IF NOT EXISTS leads_user_created_idx ON public.leads (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_next_task_idx ON public.leads (next_task_id) WHERE next_task_id IS NOT NULL;

-- 2. The contact log.
CREATE TABLE IF NOT EXISTS public.lead_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  lead_id      uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  kind         text NOT NULL,
  body         text NOT NULL,
  happened_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_events_kind_check CHECK (kind IN ('call', 'meet', 'msg', 'note')),
  CONSTRAINT lead_events_body_check CHECK (body = pg_catalog.btrim(body, E' \t\r\n') AND pg_catalog.char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS lead_events_lead_idx ON public.lead_events (lead_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS lead_events_user_idx ON public.lead_events (user_id);

-- 3. Row guards. SECURITY INVOKER: the link lookup runs with the caller's own rights (RLS) and requires the linked row to belong to
-- the same owner; a missing row, another tenant's row and an invisible row all raise the SAME constant error (no existence oracle).
CREATE OR REPLACE FUNCTION public.leads_guard_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'TK_LEAD_OWNER_IMMUTABLE: a lead cannot change its owner' USING ERRCODE = '42501';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := pg_catalog.now();
  END IF;
  IF NEW.next_task_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.next_task_id IS DISTINCT FROM OLD.next_task_id)
     AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = NEW.next_task_id AND t.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'TK_LEAD_LINK_NOT_ALLOWED: the linked item is not available' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.leads_guard_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS leads_guard_row ON public.leads;
CREATE TRIGGER leads_guard_row
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_guard_row();

CREATE OR REPLACE FUNCTION public.lead_events_guard_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.lead_id IS DISTINCT FROM OLD.lead_id THEN
      RAISE EXCEPTION 'TK_LEAD_EVENT_IMMUTABLE: a contact entry cannot change its owner or lead' USING ERRCODE = '42501';
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  IF TG_OP = 'INSERT'
     AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = NEW.lead_id AND l.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'TK_LEAD_LINK_NOT_ALLOWED: the linked item is not available' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.lead_events_guard_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lead_events_guard_row ON public.lead_events;
CREATE TRIGGER lead_events_guard_row
  BEFORE INSERT OR UPDATE ON public.lead_events
  FOR EACH ROW EXECUTE FUNCTION public.lead_events_guard_row();

-- 4. Row level security: enabled and forced; the owner only; no anonymous or public access. Explicit grants (no default ALL).
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.leads FROM PUBLIC;
REVOKE ALL ON public.leads FROM anon;
REVOKE ALL ON public.leads FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;

DROP POLICY IF EXISTS leads_select_own ON public.leads;
CREATE POLICY leads_select_own ON public.leads FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS leads_insert_own ON public.leads;
CREATE POLICY leads_insert_own ON public.leads FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS leads_update_own ON public.leads;
CREATE POLICY leads_update_own ON public.leads FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS leads_delete_own ON public.leads;
CREATE POLICY leads_delete_own ON public.leads FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_events FROM PUBLIC;
REVOKE ALL ON public.lead_events FROM anon;
REVOKE ALL ON public.lead_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_events TO authenticated;

DROP POLICY IF EXISTS lead_events_select_own ON public.lead_events;
CREATE POLICY lead_events_select_own ON public.lead_events FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS lead_events_insert_own ON public.lead_events;
CREATE POLICY lead_events_insert_own ON public.lead_events FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS lead_events_update_own ON public.lead_events;
CREATE POLICY lead_events_update_own ON public.lead_events FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS lead_events_delete_own ON public.lead_events;
CREATE POLICY lead_events_delete_own ON public.lead_events FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.leads IS 'Leads stage 1 (Owner 18/11): enquiries the business records itself, owner-only (RLS forced); next follow-up = a regular task; nothing is sent to the lead.';
COMMENT ON TABLE public.lead_events IS 'Leads stage 1 (Owner 18/11): the contact log of a lead (call / meeting / message / note), owner-only (RLS forced).';
