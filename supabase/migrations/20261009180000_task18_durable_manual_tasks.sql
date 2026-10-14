-- ============================================================================================================================
-- 20261009180000_task18_durable_manual_tasks.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Task 18 (Owner authorization owner-chat-2026-10-09-task18-durable-manual-tasks): ONE durable, tenant-scoped manual task list for the
-- authenticated product. Forward-only. TEST candidate: applied to TEST (ljfizgrdyzxddswcedwr) only through the hard-pinned one-shot
-- tooling path; Production is untouched until a separately authorized promotion.
--
--   public.tasks             one row per manual task, owned by exactly one auth user (cascade on owner deletion)
--   public.tasks_guard_row() BEFORE INSERT/UPDATE: updated_at, immutable owner/created_at, completed_at kept consistent with status,
--                            and the SAME-TENANT link rule (a task may link only to its owner's own quote / client - even a crafted
--                            request naming another tenant's id is refused with one constant error, existence is never revealed)
--   RLS                      enabled AND forced; authenticated CRUD only where auth.uid() = user_id; no anon / public access
--
-- No notification, cron, reminder, message, calendar or automation of any kind. Re-runnable: an existing COMPATIBLE public.tasks is
-- kept (constraints / index / policy / trigger statements are idempotent); an existing INCOMPATIBLE object fails closed.
-- Rollback of THIS file (only while no task data must be kept): DROP TABLE public.tasks; DROP FUNCTION public.tasks_guard_row().
-- ============================================================================================================================

-- 0. Fail closed on an incompatible pre-existing public.tasks (any other column shape is never adopted or altered).
DO $tk_task18_pre$
DECLARE v_shape text;
BEGIN
  IF pg_catalog.to_regclass('public.tasks') IS NOT NULL THEN
    IF (SELECT c.relkind FROM pg_catalog.pg_class c WHERE c.oid = 'public.tasks'::regclass) IS DISTINCT FROM 'r' THEN
      RAISE EXCEPTION 'TK_TASK18_INCOMPATIBLE: public.tasks exists and is not an ordinary table';
    END IF;
    SELECT pg_catalog.string_agg(a.attname || ' ' || pg_catalog.format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' not null' ELSE '' END, ', ' ORDER BY a.attnum)
      INTO v_shape
      FROM pg_catalog.pg_attribute a
     WHERE a.attrelid = 'public.tasks'::regclass AND a.attnum > 0 AND NOT a.attisdropped;
    IF v_shape IS DISTINCT FROM 'id uuid not null, user_id uuid not null, title text not null, notes text, status text not null, priority text not null, due_date date, due_time time without time zone, quote_id uuid, client_id uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, completed_at timestamp with time zone' THEN
      RAISE EXCEPTION 'TK_TASK18_INCOMPATIBLE: public.tasks exists with another column shape';
    END IF;
  END IF;
END
$tk_task18_pre$;

-- 1. The table.
CREATE TABLE IF NOT EXISTS public.tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  title        text NOT NULL,
  notes        text,
  status       text NOT NULL DEFAULT 'open',
  priority     text NOT NULL DEFAULT 'normal',
  due_date     date,
  due_time     time without time zone,
  quote_id     uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  client_id    uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT tasks_title_check CHECK (title = pg_catalog.btrim(title, E' \t\r\n') AND pg_catalog.char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT tasks_notes_check CHECK (notes IS NULL OR (notes = pg_catalog.btrim(notes, E' \t\r\n') AND pg_catalog.char_length(notes) BETWEEN 1 AND 2000)),
  CONSTRAINT tasks_status_check CHECK (status IN ('open', 'completed')),
  CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'normal', 'high')),
  CONSTRAINT tasks_due_time_requires_date CHECK (due_time IS NULL OR due_date IS NOT NULL),
  CONSTRAINT tasks_completed_consistency CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

-- A compatible table created earlier must carry exactly these named checks (fail closed if one is missing).
DO $tk_task18_checks$
DECLARE v_missing text;
BEGIN
  SELECT pg_catalog.string_agg(n, ', ') INTO v_missing
    FROM pg_catalog.unnest(ARRAY['tasks_title_check', 'tasks_notes_check', 'tasks_status_check', 'tasks_priority_check', 'tasks_due_time_requires_date', 'tasks_completed_consistency']) AS n
   WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid = 'public.tasks'::regclass AND c.conname = n AND c.contype = 'c');
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'TK_TASK18_INCOMPATIBLE: public.tasks lacks the checks %', v_missing; END IF;
END
$tk_task18_checks$;

CREATE INDEX IF NOT EXISTS tasks_user_status_due_idx ON public.tasks (user_id, status, due_date, due_time);
CREATE INDEX IF NOT EXISTS tasks_quote_id_idx ON public.tasks (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_client_id_idx ON public.tasks (client_id) WHERE client_id IS NOT NULL;

-- 2. Row guard: timestamps, immutable owner, completed_at consistency and the same-tenant link rule. SECURITY INVOKER: the link
-- lookup runs with the caller's own rights (RLS), and requires the linked row to belong to the task owner; a missing row, another
-- tenant's row and an invisible row all raise the SAME constant error (no existence oracle). It runs BEFORE the FK checks.
CREATE OR REPLACE FUNCTION public.tasks_guard_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'TK_TASK_OWNER_IMMUTABLE: a task cannot change its owner' USING ERRCODE = '42501';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := pg_catalog.now();
  END IF;
  IF NEW.status = 'completed' THEN
    NEW.completed_at := CASE WHEN TG_OP = 'UPDATE' AND OLD.status = 'completed' AND OLD.completed_at IS NOT NULL THEN OLD.completed_at ELSE pg_catalog.now() END;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  IF NEW.quote_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = NEW.quote_id AND q.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'TK_TASK_LINK_NOT_ALLOWED: the linked quote or client is not available' USING ERRCODE = '42501';
  END IF;
  IF NEW.client_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'TK_TASK_LINK_NOT_ALLOWED: the linked quote or client is not available' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.tasks_guard_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tasks_guard_row ON public.tasks;
CREATE TRIGGER tasks_guard_row
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_guard_row();

-- 3. Row level security: enabled and forced; the owner only; no anonymous or public access.
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.tasks FROM PUBLIC;
REVOKE ALL ON public.tasks FROM anon;
REVOKE ALL ON public.tasks FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;

DROP POLICY IF EXISTS tasks_select_own ON public.tasks;
CREATE POLICY tasks_select_own ON public.tasks FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS tasks_insert_own ON public.tasks;
CREATE POLICY tasks_insert_own ON public.tasks FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS tasks_update_own ON public.tasks;
CREATE POLICY tasks_update_own ON public.tasks FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS tasks_delete_own ON public.tasks;
CREATE POLICY tasks_delete_own ON public.tasks FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.tasks IS 'Task 18: durable manual tasks, owner-only (RLS forced); optional same-tenant quote/client links; no reminders or automation.';
