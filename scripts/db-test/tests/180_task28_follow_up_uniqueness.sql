-- Task 28: one OPEN follow-up per quote per owner (20261011120000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: existing / ordinary tasks unaffected (default kind 'task', any number per quote); create_follow_up_task idempotent by request id
-- and returns the existing open follow-up instead of a second row; completed follow-ups kept and a new one allowed afterwards; reopening a
-- completed follow-up while another is open refused; kind immutable; a follow-up needs a quote; tenant isolation; anon refused.
BEGIN;
SELECT tst.seed();
INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES
  ('ed000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 98001, 'sent'),
  ('ed000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', 98002, 'sent'),
  ('ed000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 98003, 'sent'),
  ('ed000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000000b', 98004, 'sent');

DO $$
BEGIN
  PERFORM tst.ok((SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'kind') = '''task''::text',
                 'F1 tasks.kind defaults to task (existing rows are ordinary tasks; nothing reclassified)');
  PERFORM tst.ok(NOT has_function_privilege('anon', 'public.create_follow_up_task(uuid, uuid, text, text, text, date, time without time zone, uuid)', 'execute'), 'F2 anon cannot call create_follow_up_task');
  PERFORM tst.ok(has_function_privilege('authenticated', 'public.create_follow_up_task(uuid, uuid, text, text, text, date, time without time zone, uuid)', 'execute'), 'F3 authenticated can call it');
  PERFORM tst.ok(NOT has_function_privilege('authenticated', 'public.tasks_follow_up_guard()', 'execute'), 'F4 guard not callable by clients');
END $$;

SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE r1 jsonb; r2 jsonb; r3 jsonb; r4 jsonb; n int;
BEGIN
  -- ordinary tasks: any number per quote, untouched by the follow-up rule
  INSERT INTO public.tasks (title, quote_id) VALUES ('Order tiles', 'ed000000-0000-4000-8000-00000000000a'), ('Call supplier', 'ed000000-0000-4000-8000-00000000000a');
  PERFORM tst.ok((SELECT count(*) FROM public.tasks WHERE quote_id = 'ed000000-0000-4000-8000-00000000000a' AND kind = 'task') = 2, 'F5 two ordinary open tasks on the same quote are allowed');

  r1 := public.create_follow_up_task('ee000000-0000-4000-8000-000000000001', 'ed000000-0000-4000-8000-00000000000a', 'Follow up 98001');
  PERFORM tst.ok((r1 ->> 'created')::boolean AND r1 -> 'task' ->> 'kind' = 'follow_up' AND r1 -> 'task' ->> 'user_id' = '00000000-0000-4000-8000-00000000000a', 'F6 first follow-up created for the caller');
  r2 := public.create_follow_up_task('ee000000-0000-4000-8000-000000000001', 'ed000000-0000-4000-8000-00000000000a', 'Follow up 98001 (retry)');
  PERFORM tst.ok(NOT (r2 ->> 'created')::boolean AND r2 ->> 'reason' = 'same_request' AND r2 -> 'task' ->> 'id' = r1 -> 'task' ->> 'id' AND r2 -> 'task' ->> 'title' = 'Follow up 98001',
                 'F7 a retry with the same request id returns the same row, unchanged');
  r3 := public.create_follow_up_task('ee000000-0000-4000-8000-000000000002', 'ed000000-0000-4000-8000-00000000000a', 'Second window');
  PERFORM tst.ok(NOT (r3 ->> 'created')::boolean AND r3 ->> 'reason' = 'existing_open_follow_up' AND r3 -> 'task' ->> 'id' = r1 -> 'task' ->> 'id', 'F8 another request for the same quote returns the existing open follow-up');
  SELECT count(*) INTO n FROM public.tasks WHERE quote_id = 'ed000000-0000-4000-8000-00000000000a' AND kind = 'follow_up';
  PERFORM tst.ok(n = 1, 'F9 still exactly one follow-up row');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = 'ee000000-0000-4000-8000-000000000002'), 'F10 the losing request wrote nothing');

  -- completing keeps it; a new follow-up is then allowed
  UPDATE public.tasks SET status = 'completed' WHERE id = 'ee000000-0000-4000-8000-000000000001';
  r4 := public.create_follow_up_task('ee000000-0000-4000-8000-000000000003', 'ed000000-0000-4000-8000-00000000000a', 'Follow up again');
  PERFORM tst.ok((r4 ->> 'created')::boolean, 'F11 after completion a new follow-up can be created');
  PERFORM tst.ok((SELECT count(*) FROM public.tasks WHERE quote_id = 'ed000000-0000-4000-8000-00000000000a' AND kind = 'follow_up') = 2, 'F12 the completed follow-up is kept');
  -- a follow-up on ANOTHER quote is independent
  PERFORM tst.ok((public.create_follow_up_task('ee000000-0000-4000-8000-000000000004', 'ed000000-0000-4000-8000-0000000000a2', 'Other quote') ->> 'created')::boolean, 'F13 one open follow-up per quote, not per owner');
END $$;
SELECT tst.throws($q$UPDATE public.tasks SET status = 'open' WHERE id = 'ee000000-0000-4000-8000-000000000001'$q$, 'tasks_one_open_follow_up', 'F14 reopening a completed follow-up while another is open is refused');
SELECT tst.throws($q$UPDATE public.tasks SET kind = 'task' WHERE id = 'ee000000-0000-4000-8000-000000000003'$q$, 'TK_TASK_KIND_IMMUTABLE', 'F15 the kind never changes');
SELECT tst.throws($q$INSERT INTO public.tasks (title, kind) VALUES ('No quote', 'follow_up')$q$, 'TK_FOLLOW_UP_NEEDS_QUOTE', 'F16 a follow-up needs a quote');
SELECT tst.throws($q$INSERT INTO public.tasks (title, kind, quote_id) VALUES ('Direct second', 'follow_up', 'ed000000-0000-4000-8000-00000000000a')$q$, 'tasks_one_open_follow_up', 'F17 a direct insert cannot bypass the rule');
SELECT tst.throws($q$INSERT INTO public.tasks (title, kind) VALUES ('Bad kind', 'reminder')$q$, 'tasks_kind_check', 'F18 unknown kind refused');
SELECT tst.throws($q$SELECT public.create_follow_up_task('ee000000-0000-4000-8000-000000000005', 'ed000000-0000-4000-8000-00000000000b', 'Foreign quote')$q$, 'TK_TASK_LINK_NOT_ALLOWED', 'F19 A cannot create a follow-up on B''s quote');
SELECT tst.throws($q$SELECT public.create_follow_up_task('ee000000-0000-4000-8000-000000000004', 'ed000000-0000-4000-8000-00000000000a', 'Reused id')$q$, 'TK_FOLLOW_UP_REQUEST_MISMATCH', 'F20 a request id of another task is refused, never reinterpreted');
SELECT tst.logout();

SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.ok((SELECT count(*) FROM public.tasks) = 0, 'F21 B sees none of A''s tasks');
  r := public.create_follow_up_task('ee000000-0000-4000-8000-000000000006', 'ed000000-0000-4000-8000-00000000000b', 'B follow-up');
  PERFORM tst.ok((r ->> 'created')::boolean AND r -> 'task' ->> 'user_id' = '00000000-0000-4000-8000-00000000000b', 'F22 B creates its own follow-up independently');
END $$;
-- B using A's request id (RLS hides A's row): with B's open follow-up on that quote the arbiter returns B's OWN row; on a quote without one the
-- primary key refuses. Nothing of A is ever returned or changed.
DO $$
DECLARE r jsonb;
BEGIN
  r := public.create_follow_up_task('ee000000-0000-4000-8000-000000000001', 'ed000000-0000-4000-8000-00000000000b', 'B steals id');
  PERFORM tst.ok(r -> 'task' ->> 'id' = 'ee000000-0000-4000-8000-000000000006' AND r -> 'task' ->> 'user_id' = '00000000-0000-4000-8000-00000000000b', 'F23a another tenant''s request id returns only B''s own open follow-up');
END $$;
SELECT tst.throws($q$SELECT public.create_follow_up_task('ee000000-0000-4000-8000-000000000001', 'ed000000-0000-4000-8000-0000000000b2', 'B steals id')$q$, 'tasks_pkey', 'F23b on a quote without a follow-up the primary key refuses (no row of A returned)');
SELECT tst.logout();

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.create_follow_up_task('ee000000-0000-4000-8000-000000000007', 'ed000000-0000-4000-8000-00000000000a', 'anon')$q$, 'permission denied', 'F24 anon refused');
SELECT tst.logout();

ROLLBACK;
