-- Leads stage 1 (20261118100000, Owner console 2026-11-18). Disposable postgres:17 harness ONLY. ONE transaction, rolled back at the end.
-- Proves: owner-only CRUD under FORCED RLS on leads and lead_events; no anon access; explicit grants only (no TRUNCATE / TRIGGER /
-- REFERENCES); a lead may point ONLY at its owner's own task, an event only at its owner's own lead (one constant error, an unknown id
-- identically); bounded trimmed fields, enums and "a phone or an email"; trigger-owned timestamps; immutable owner; FK lifecycle (the
-- follow-up task deleted -> the link cleared; the lead deleted -> its events gone; the owner deleted -> every lead and event gone, the
-- account erasure path of admin-delete-user needs no change).
BEGIN;
SELECT tst.seed();

DO $$
BEGIN
  PERFORM tst.ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.leads'::regclass), 'RLS enabled and forced on public.leads');
  PERFORM tst.ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.lead_events'::regclass), 'RLS enabled and forced on public.lead_events');
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leads') = 4, 'leads: exactly four policies');
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lead_events') = 4, 'lead_events: exactly four policies');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('leads', 'lead_events') AND roles::text[] <> ARRAY['authenticated']), 'every policy is for authenticated only');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.leads', 'select') AND NOT has_table_privilege('anon', 'public.leads', 'insert')
    AND NOT has_table_privilege('anon', 'public.lead_events', 'select') AND NOT has_table_privilege('anon', 'public.lead_events', 'insert'), 'anon has no table privilege');
  PERFORM tst.ok(has_table_privilege('authenticated', 'public.leads', 'select') AND has_table_privilege('authenticated', 'public.leads', 'insert')
    AND has_table_privilege('authenticated', 'public.leads', 'update') AND has_table_privilege('authenticated', 'public.leads', 'delete'), 'authenticated has CRUD on leads (rows still filtered by RLS)');
  PERFORM tst.ok(NOT has_table_privilege('authenticated', 'public.leads', 'truncate') AND NOT has_table_privilege('authenticated', 'public.leads', 'trigger')
    AND NOT has_table_privilege('authenticated', 'public.leads', 'references') AND NOT has_table_privilege('authenticated', 'public.lead_events', 'truncate')
    AND NOT has_table_privilege('authenticated', 'public.lead_events', 'trigger') AND NOT has_table_privilege('authenticated', 'public.lead_events', 'references'), 'no TRUNCATE / TRIGGER / REFERENCES for authenticated');
  PERFORM tst.ok(NOT has_function_privilege('authenticated', 'public.leads_guard_row()', 'execute') AND NOT has_function_privilege('authenticated', 'public.lead_events_guard_row()', 'execute'), 'guard functions not executable by authenticated');
END $$;

INSERT INTO public.tasks (id, user_id, title) VALUES
  ('a4790000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'Follow up with Dana'),
  ('a4790000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', 'B task');

-- tenant A: create / read / update own leads and contact entries
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE v_row public.leads; v_ev public.lead_events; v_n int;
BEGIN
  INSERT INTO public.leads (id, name, phone, need, source, next_task_id) VALUES ('a4790000-0000-4000-8000-00000000d1a1', 'Dana Cohen', '052-1234567', 'Replace a living-room window', 'ref', 'a4790000-0000-4000-8000-0000000000a1') RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.user_id = '00000000-0000-4000-8000-00000000000a' AND v_row.status = 'new' AND v_row.source = 'ref', 'A creates a lead (owner from auth.uid(), status new)');
  INSERT INTO public.lead_events (lead_id, kind, body) VALUES (v_row.id, 'call', 'First call - wants a quote this week') RETURNING * INTO v_ev;
  PERFORM tst.ok(v_ev.user_id = v_row.user_id AND v_ev.kind = 'call', 'A records a contact entry on her lead');
  UPDATE public.leads SET status = 'prog' WHERE id = v_row.id;
  SELECT pg_catalog.count(*) INTO v_n FROM public.leads WHERE status = 'prog';
  PERFORM tst.ok(v_n = 1, 'A changes the status of her lead');
  INSERT INTO public.leads (name, email) VALUES ('Email only', 'only@synthetic.test');
  PERFORM tst.ok(true, 'an email alone is enough contact');
END $$;
SELECT tst.throws($q$INSERT INTO public.leads (name) VALUES ('No contact')$q$, 'leads_contact_check', 'a lead needs a phone or an email');
SELECT tst.throws($q$INSERT INTO public.leads (name, phone) VALUES ('', '1')$q$, 'leads_name_check', 'empty name refused');
SELECT tst.throws($q$INSERT INTO public.leads (name, phone) VALUES (' padded ', '1')$q$, 'leads_name_check', 'untrimmed name refused');
SELECT tst.throws($q$INSERT INTO public.leads (name, phone) VALUES (repeat('x', 201), '1')$q$, 'leads_name_check', 'name over 200 chars refused');
SELECT tst.throws($q$INSERT INTO public.leads (name, phone, need) VALUES ('x', '1', repeat('n', 501))$q$, 'leads_need_check', 'work needed over 500 chars refused');
SELECT tst.throws($q$INSERT INTO public.leads (name, phone, source) VALUES ('x', '1', 'tv')$q$, 'leads_source_check', 'unknown source refused');
SELECT tst.throws($q$INSERT INTO public.leads (name, phone, status) VALUES ('x', '1', 'signed')$q$, 'leads_status_check', 'unknown status refused');
SELECT tst.throws($q$INSERT INTO public.leads (name, phone, next_task_id) VALUES ('x', '1', 'a4790000-0000-4000-8000-0000000000b1')$q$, 'TK_LEAD_LINK_NOT_ALLOWED', 'A cannot point her lead at B''s task');
SELECT tst.throws($q$INSERT INTO public.leads (name, phone, next_task_id) VALUES ('x', '1', 'a4790000-0000-4000-8000-0000000000ff')$q$, 'TK_LEAD_LINK_NOT_ALLOWED', 'an unknown task id gets the SAME error (no existence oracle)');
SELECT tst.throws($q$INSERT INTO public.leads (user_id, name, phone) VALUES ('00000000-0000-4000-8000-00000000000b', 'planted', '1')$q$, 'row-level security', 'A cannot create a lead owned by B');
SELECT tst.throws($q$UPDATE public.leads SET user_id = '00000000-0000-4000-8000-00000000000b' WHERE name = 'Dana Cohen'$q$, 'TK_LEAD_OWNER_IMMUTABLE', 'A cannot hand a lead to B');
SELECT tst.throws($q$INSERT INTO public.lead_events (lead_id, kind, body) SELECT id, 'visit', 'x' FROM public.leads WHERE name = 'Dana Cohen'$q$, 'lead_events_kind_check', 'unknown entry kind refused');
SELECT tst.throws($q$INSERT INTO public.lead_events (lead_id, kind, body) SELECT id, 'note', ' ' FROM public.leads WHERE name = 'Dana Cohen'$q$, 'lead_events_body_check', 'blank entry refused');
SELECT tst.logout();

-- tenant B: sees nothing of A, cannot write into A's lead
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
DECLARE v_n int;
BEGIN
  SELECT pg_catalog.count(*) INTO v_n FROM public.leads;
  PERFORM tst.ok(v_n = 0, 'B sees none of A''s leads');
  SELECT pg_catalog.count(*) INTO v_n FROM public.lead_events;
  PERFORM tst.ok(v_n = 0, 'B sees none of A''s contact entries');
  UPDATE public.leads SET status = 'off';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM tst.ok(v_n = 0, 'B changes nothing of A''s leads');
  DELETE FROM public.leads;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM tst.ok(v_n = 0, 'B deletes nothing of A''s leads');
END $$;
SELECT tst.throws($q$INSERT INTO public.lead_events (lead_id, kind, body) VALUES ('a4790000-0000-4000-8000-00000000d1a1', 'note', 'planted')$q$, 'TK_LEAD_LINK_NOT_ALLOWED', 'B cannot add an entry to A''s lead even naming its id (one constant error)');
SELECT tst.logout();

-- lifecycle: deleting the follow-up task clears the link; deleting a lead removes its entries; deleting the owner removes everything
DO $$
DECLARE v_task uuid; v_n int;
BEGIN
  DELETE FROM public.tasks WHERE id = 'a4790000-0000-4000-8000-0000000000a1';
  SELECT next_task_id INTO v_task FROM public.leads WHERE name = 'Dana Cohen';
  PERFORM tst.ok(v_task IS NULL, 'deleting the follow-up task keeps the lead and clears the link');
  DELETE FROM public.leads WHERE name = 'Email only';
  SELECT pg_catalog.count(*) INTO v_n FROM public.leads WHERE name = 'Email only';
  PERFORM tst.ok(v_n = 0, 'A lead can be deleted');
  PERFORM tst.login('00000000-0000-4000-8000-00000000000c');
  INSERT INTO public.leads (name, phone) VALUES ('C lead', '03-0000000');
  INSERT INTO public.lead_events (lead_id, kind, body) SELECT id, 'note', 'C entry' FROM public.leads WHERE name = 'C lead';
  PERFORM tst.logout();
  DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-00000000000c';
  SELECT pg_catalog.count(*) INTO v_n FROM public.leads WHERE user_id = '00000000-0000-4000-8000-00000000000c';
  PERFORM tst.ok(v_n = 0, 'deleting the owner removes every lead (cascade - account erasure)');
  SELECT pg_catalog.count(*) INTO v_n FROM public.lead_events WHERE user_id = '00000000-0000-4000-8000-00000000000c';
  PERFORM tst.ok(v_n = 0, 'deleting the owner removes every contact entry (cascade - account erasure)');
END $$;
ROLLBACK;
