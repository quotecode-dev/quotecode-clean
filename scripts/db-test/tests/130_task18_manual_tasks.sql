-- Task 18: durable manual tasks (20261009180000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back at the end.
-- Proves: owner-only CRUD under FORCED RLS; no anon access; a task can link ONLY to its owner's own quote / client (another tenant's
-- id - even a crafted request - is refused with one constant error, an unknown id identically); bounded trimmed title / notes, enum,
-- due-time-needs-date and completed-at consistency checks; trigger-owned timestamps; immutable owner; FK lifecycle (quote / client
-- deletion keeps the task with a cleared link, owner deletion removes the owner's tasks).
BEGIN;
SELECT tst.seed();

INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES
  ('a1800000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 931801, 'sent', 'ILS', 100),
  ('a1800000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', 931802, 'sent', 'USD', 100),
  ('a1800000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', 931803, 'draft', 'ILS', 50);
INSERT INTO public.clients (id, company_name, email, user_id) VALUES
  ('a1800000-0000-4000-8000-00000000c0a1', 'Synthetic Client A', 'client-a@synthetic.test', '00000000-0000-4000-8000-00000000000a'),
  ('a1800000-0000-4000-8000-00000000c0b1', 'Synthetic Client B', 'client-b@synthetic.test', '00000000-0000-4000-8000-00000000000b'),
  ('a1800000-0000-4000-8000-00000000c0a2', 'Synthetic Client A2', 'client-a2@synthetic.test', '00000000-0000-4000-8000-00000000000a');

DO $$
BEGIN
  -- catalog contract
  PERFORM tst.ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.tasks'::regclass), 'RLS enabled and forced on public.tasks');
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks') = 4, 'exactly four policies');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks' AND roles::text[] <> ARRAY['authenticated']), 'every policy is for authenticated only');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.tasks', 'select') AND NOT has_table_privilege('anon', 'public.tasks', 'insert')
    AND NOT has_table_privilege('anon', 'public.tasks', 'update') AND NOT has_table_privilege('anon', 'public.tasks', 'delete'), 'anon has no table privilege');
  PERFORM tst.ok(has_table_privilege('authenticated', 'public.tasks', 'select') AND has_table_privilege('authenticated', 'public.tasks', 'insert')
    AND has_table_privilege('authenticated', 'public.tasks', 'update') AND has_table_privilege('authenticated', 'public.tasks', 'delete'), 'authenticated has CRUD (rows still filtered by RLS)');
  PERFORM tst.ok(NOT has_function_privilege('anon', 'public.tasks_guard_row()', 'execute') AND NOT has_function_privilege('authenticated', 'public.tasks_guard_row()', 'execute'), 'trigger function not executable by anon / authenticated');
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.tasks'::regclass AND tgname = 'tasks_guard_row' AND NOT tgisinternal), 'row guard trigger present');
END $$;

-- tenant A: create / read / update / complete / reopen own tasks
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE v_id uuid; v_row public.tasks; v_count int;
BEGIN
  INSERT INTO public.tasks (user_id, title, notes, priority, due_date, due_time, quote_id, client_id)
  VALUES ('00000000-0000-4000-8000-00000000000a', 'Call back about the kitchen', 'Ask about the second option', 'high', DATE '2026-10-12', TIME '09:30',
          'a1800000-0000-4000-8000-0000000000a1', 'a1800000-0000-4000-8000-00000000c0a1')
  RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.status = 'open' AND v_row.completed_at IS NULL AND v_row.created_at IS NOT NULL AND v_row.updated_at IS NOT NULL, 'A creates an open task linked to her own quote and client');
  PERFORM tst.ok(v_row.due_date = DATE '2026-10-12' AND v_row.due_time = TIME '09:30', 'date-only due date and wall-clock due time stored as given');
  INSERT INTO public.tasks (title) VALUES ('Default owner from auth.uid()') RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.user_id = '00000000-0000-4000-8000-00000000000a' AND v_row.priority = 'normal', 'user_id defaults to auth.uid(); priority defaults to normal');
  v_id := v_row.id;
  UPDATE public.tasks SET status = 'completed' WHERE id = v_id RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.status = 'completed' AND v_row.completed_at IS NOT NULL, 'completing sets completed_at (trigger-owned)');
  UPDATE public.tasks SET status = 'open', completed_at = now() WHERE id = v_id RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.status = 'open' AND v_row.completed_at IS NULL, 'reopening clears completed_at (a client value is ignored)');
  UPDATE public.tasks SET title = 'Renamed', created_at = '2000-01-01T00:00:00Z' WHERE id = v_id RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.title = 'Renamed' AND v_row.created_at > '2020-01-01T00:00:00Z', 'created_at is immutable');
  SELECT pg_catalog.count(*) INTO v_count FROM public.tasks;
  PERFORM tst.ok(v_count = 2, 'A sees exactly her two tasks');
END $$;

-- same-tenant link rule (crafted requests)
SELECT tst.throws($q$INSERT INTO public.tasks (user_id, title, quote_id) VALUES ('00000000-0000-4000-8000-00000000000a', 'x', 'a1800000-0000-4000-8000-0000000000b1')$q$, 'TK_TASK_LINK_NOT_ALLOWED', 'A cannot link B''s quote');
SELECT tst.throws($q$INSERT INTO public.tasks (user_id, title, client_id) VALUES ('00000000-0000-4000-8000-00000000000a', 'x', 'a1800000-0000-4000-8000-00000000c0b1')$q$, 'TK_TASK_LINK_NOT_ALLOWED', 'A cannot link B''s client');
SELECT tst.throws($q$INSERT INTO public.tasks (user_id, title, quote_id) VALUES ('00000000-0000-4000-8000-00000000000a', 'x', 'a1800000-0000-4000-8000-0000000000ff')$q$, 'TK_TASK_LINK_NOT_ALLOWED', 'an unknown quote id gets the SAME error (no existence oracle)');
SELECT tst.throws($q$UPDATE public.tasks SET quote_id = 'a1800000-0000-4000-8000-0000000000b1' WHERE title = 'Renamed'$q$, 'TK_TASK_LINK_NOT_ALLOWED', 'A cannot re-link her task to B''s quote');
SELECT tst.throws($q$INSERT INTO public.tasks (user_id, title) VALUES ('00000000-0000-4000-8000-00000000000b', 'planted for B')$q$, 'row-level security', 'A cannot create a task owned by B');
SELECT tst.throws($q$UPDATE public.tasks SET user_id = '00000000-0000-4000-8000-00000000000b' WHERE title = 'Renamed'$q$, 'TK_TASK_OWNER_IMMUTABLE', 'A cannot hand a task to B');

-- bounded / validated values
SELECT tst.throws($q$INSERT INTO public.tasks (title) VALUES ('')$q$, 'tasks_title_check', 'empty title refused');
SELECT tst.throws($q$INSERT INTO public.tasks (title) VALUES ('   ')$q$, 'tasks_title_check', 'whitespace-only title refused');
SELECT tst.throws($q$INSERT INTO public.tasks (title) VALUES (' padded ')$q$, 'tasks_title_check', 'untrimmed title refused');
SELECT tst.throws($q$INSERT INTO public.tasks (title) VALUES (repeat('x', 201))$q$, 'tasks_title_check', 'title over 200 chars refused');
SELECT tst.throws($q$INSERT INTO public.tasks (title, notes) VALUES ('ok', repeat('n', 2001))$q$, 'tasks_notes_check', 'notes over 2000 chars refused');
SELECT tst.throws($q$INSERT INTO public.tasks (title, notes) VALUES ('ok', ' ')$q$, 'tasks_notes_check', 'blank notes refused (store NULL instead)');
SELECT tst.throws($q$INSERT INTO public.tasks (title, status) VALUES ('ok', 'rejected')$q$, 'tasks_status_check', 'status outside open|completed refused');
SELECT tst.throws($q$INSERT INTO public.tasks (title, priority) VALUES ('ok', 'urgent')$q$, 'tasks_priority_check', 'priority outside low|normal|high refused');
SELECT tst.throws($q$INSERT INTO public.tasks (title, due_time) VALUES ('ok', TIME '10:00')$q$, 'tasks_due_time_requires_date', 'a due time without a due date refused');
SELECT tst.logout();

-- tenant B: sees nothing of A, cannot change or delete A's rows
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
DECLARE v_n int;
BEGIN
  SELECT pg_catalog.count(*) INTO v_n FROM public.tasks;
  PERFORM tst.ok(v_n = 0, 'B sees none of A''s tasks');
  UPDATE public.tasks SET title = 'hijacked' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM tst.ok(v_n = 0, 'B updates zero of A''s tasks');
  DELETE FROM public.tasks WHERE user_id = '00000000-0000-4000-8000-00000000000a';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM tst.ok(v_n = 0, 'B deletes zero of A''s tasks');
  INSERT INTO public.tasks (title, quote_id, client_id) VALUES ('B own follow-up', 'a1800000-0000-4000-8000-0000000000b1', 'a1800000-0000-4000-8000-00000000c0b1');
  PERFORM tst.ok(true, 'B links her own quote and client');
END $$;
SELECT tst.throws($q$INSERT INTO public.tasks (title, quote_id) VALUES ('x', 'a1800000-0000-4000-8000-0000000000a1')$q$, 'TK_TASK_LINK_NOT_ALLOWED', 'B cannot link A''s quote');
SELECT tst.logout();

-- anon: no access at all
SELECT tst.anon();
SELECT tst.throws($q$SELECT pg_catalog.count(*) FROM public.tasks$q$, 'permission denied', 'anon cannot read tasks');
SELECT tst.throws($q$INSERT INTO public.tasks (user_id, title) VALUES ('00000000-0000-4000-8000-00000000000a', 'anon')$q$, 'permission denied', 'anon cannot create tasks');
SELECT tst.logout();

-- A still sees exactly her rows (B's write did not leak in); then lifecycle
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE v_n int; v_titles text;
BEGIN
  SELECT pg_catalog.count(*), pg_catalog.string_agg(title, '|' ORDER BY title) INTO v_n, v_titles FROM public.tasks;
  PERFORM tst.ok(v_n = 2 AND v_titles = 'Call back about the kitchen|Renamed', 'A still sees only her two unchanged tasks');
  DELETE FROM public.tasks WHERE title = 'Renamed';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM tst.ok(v_n = 1, 'A deletes her own task');
END $$;
SELECT tst.logout();

DO $$
DECLARE v_q uuid; v_c uuid; v_n int;
BEGIN
  DELETE FROM public.quotes WHERE id = 'a1800000-0000-4000-8000-0000000000a1';
  DELETE FROM public.clients WHERE id = 'a1800000-0000-4000-8000-00000000c0a1';
  SELECT quote_id, client_id INTO v_q, v_c FROM public.tasks WHERE title = 'Call back about the kitchen';
  PERFORM tst.ok(FOUND AND v_q IS NULL AND v_c IS NULL, 'deleting the linked quote / client keeps the task and clears the links');
  PERFORM tst.login('00000000-0000-4000-8000-00000000000c');
  INSERT INTO public.tasks (title) VALUES ('C task');
  PERFORM tst.logout();
  DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-00000000000c';
  SELECT pg_catalog.count(*) INTO v_n FROM public.tasks WHERE user_id = '00000000-0000-4000-8000-00000000000c';
  PERFORM tst.ok(v_n = 0, 'deleting the owner removes the owner''s tasks (cascade)');
END $$;

ROLLBACK;
