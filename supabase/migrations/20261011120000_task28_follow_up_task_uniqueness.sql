-- ============================================================================================================================
-- 20261011120000_task28_follow_up_task_uniqueness.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Task 28 (Owner, 2026-10-11): at most ONE OPEN follow-up task per quote per owner, also under concurrent saves. LOCAL FILE ONLY - not
-- applied to TEST or Production; applying it is a separately authorized step. Depends on 20261009180000_task18_durable_manual_tasks.sql.
--
--   tasks.kind  'task' (ordinary, the default) | 'follow_up' (created from a quote's follow-up action). Every EXISTING row becomes
--               'task' - nothing is reclassified, deleted, merged or changed, so historical rows can never make this migration fail and
--               no business decision about them is taken here. Ordinary tasks stay unrestricted (any number per quote).
--   tasks_one_open_follow_up  partial UNIQUE index (user_id, quote_id) WHERE kind = 'follow_up' AND status = 'open' AND quote_id IS NOT NULL:
--               completed follow-ups are kept and do not block a new one; a quote deleted later (quote_id SET NULL) leaves its follow-up
--               rows valid. Reopening a completed follow-up while another one is open is refused by the same index (handled by the client).
--   create_follow_up_task(p_id, ...)  SECURITY INVOKER (RLS applies; owner = auth.uid()): idempotent by the client-generated p_id (a retry
--               returns the same row) and race-safe (INSERT .. ON CONFLICT on the partial index DO NOTHING, then the existing open
--               follow-up is returned) -> two parallel requests return the SAME task; never two rows. {created, task} JSON.
-- The kind of a row is immutable (guard), a follow-up needs a quote at creation, and the quote must be the owner's own.
-- Rollback (only while no follow-up data must be kept): DROP FUNCTION public.create_follow_up_task(...); DROP INDEX
-- public.tasks_one_open_follow_up; restore public.tasks_guard_row() from 20261009180000; ALTER TABLE public.tasks DROP COLUMN kind.
-- ============================================================================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'task';
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_kind_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_kind_check CHECK (kind IN ('task', 'follow_up'));

CREATE UNIQUE INDEX IF NOT EXISTS tasks_one_open_follow_up ON public.tasks (user_id, quote_id)
  WHERE kind = 'follow_up' AND status = 'open' AND quote_id IS NOT NULL;

-- the follow-up rules, in a separate trigger so the Task 18 guard (20261009180000) stays byte-identical
CREATE OR REPLACE FUNCTION public.tasks_follow_up_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'TK_TASK_KIND_IMMUTABLE: the kind of a task never changes' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.kind = 'follow_up' AND NEW.quote_id IS NULL THEN
    RAISE EXCEPTION 'TK_FOLLOW_UP_NEEDS_QUOTE: a follow-up task is created for a quote' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.tasks_follow_up_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tasks_follow_up_guard ON public.tasks;
CREATE TRIGGER tasks_follow_up_guard BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_follow_up_guard();

CREATE OR REPLACE FUNCTION public.create_follow_up_task(
  p_id uuid, p_quote_id uuid, p_title text, p_notes text DEFAULT NULL, p_priority text DEFAULT 'normal',
  p_due_date date DEFAULT NULL, p_due_time time without time zone DEFAULT NULL, p_client_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.tasks;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'TK_NOT_AUTHENTICATED' USING ERRCODE = '42501'; END IF;
  IF p_id IS NULL OR p_quote_id IS NULL THEN RAISE EXCEPTION 'TK_FOLLOW_UP_NEEDS_QUOTE' USING ERRCODE = '23514'; END IF;
  -- idempotent retry: the same request id returns the row it already created (RLS: only the caller's own rows are visible)
  SELECT * INTO v_row FROM public.tasks WHERE id = p_id;
  IF FOUND THEN
    IF v_row.kind <> 'follow_up' OR v_row.quote_id IS DISTINCT FROM p_quote_id THEN
      RAISE EXCEPTION 'TK_FOLLOW_UP_REQUEST_MISMATCH: this request id belongs to another task' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('created', false, 'reason', 'same_request', 'task', to_jsonb(v_row));
  END IF;
  INSERT INTO public.tasks (id, user_id, kind, title, notes, priority, due_date, due_time, quote_id, client_id)
    VALUES (p_id, v_uid, 'follow_up', p_title, p_notes, coalesce(p_priority, 'normal'), p_due_date, p_due_time, p_quote_id, p_client_id)
    ON CONFLICT (user_id, quote_id) WHERE kind = 'follow_up' AND status = 'open' AND quote_id IS NOT NULL DO NOTHING
    RETURNING * INTO v_row;
  IF FOUND THEN RETURN jsonb_build_object('created', true, 'reason', 'created', 'task', to_jsonb(v_row)); END IF;
  -- another request (another window) won the race: return THAT open follow-up, nothing new is written
  SELECT * INTO v_row FROM public.tasks
    WHERE user_id = v_uid AND quote_id = p_quote_id AND kind = 'follow_up' AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'TK_FOLLOW_UP_CONFLICT_UNRESOLVED' USING ERRCODE = '40001'; END IF;
  RETURN jsonb_build_object('created', false, 'reason', 'existing_open_follow_up', 'task', to_jsonb(v_row));
END
$function$;
REVOKE ALL ON FUNCTION public.create_follow_up_task(uuid, uuid, text, text, text, date, time without time zone, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_follow_up_task(uuid, uuid, text, text, text, date, time without time zone, uuid) TO authenticated;
