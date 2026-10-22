-- Owner 2026-10-23 (typed L-22): the weekly review of bug reports and requests (20261023200000). Disposable postgres:17 harness ONLY.
-- ONE transaction, rolled back. Proves: both tables closed to the app and open to the service role; one review per day; the list and the
-- status change are super admin only; only the four statuses; open items first.
BEGIN;
SELECT tst.seed();

CREATE OR REPLACE FUNCTION tst.wsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
GRANT EXECUTE ON FUNCTION tst.wsvc() TO anon, authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['support_review_runs', 'support_review_items'] LOOP
    PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t AND rowsecurity)
                   AND NOT has_table_privilege('authenticated', 'public.' || t, 'select') AND NOT has_table_privilege('authenticated', 'public.' || t, 'update')
                   AND NOT has_table_privilege('anon', 'public.' || t, 'select')
                   AND has_table_privilege('service_role', 'public.' || t, 'insert') AND has_table_privilege('service_role', 'public.' || t, 'update'),
      format('W0 %s: RLS on, closed to the app, open to the service role', t));
  END LOOP;
END $$;

SELECT tst.wsvc();
INSERT INTO public.support_review_runs (week) VALUES ('2026-10-25');
SELECT tst.throws($q$INSERT INTO public.support_review_runs (week) VALUES ('2026-10-25')$q$, 'duplicate|unique', 'W1 one review per day');
INSERT INTO public.support_review_items (week, kind, title, summary, priority, inquiries_count) VALUES
  ('2026-10-25', 'bug', 'PDF', 'two customers', 1, 2),
  ('2026-10-25', 'request', 'Calendar', 'one customer', 3, 1);
SELECT tst.throws($q$INSERT INTO public.support_review_items (week, kind, title, summary, priority, inquiries_count) VALUES ('2026-10-25', 'praise', 'x', 'y', 1, 1)$q$, 'check', 'W2 only bug / request');
SELECT tst.throws($q$INSERT INTO public.support_review_items (week, kind, title, summary, priority, inquiries_count) VALUES ('2026-10-25', 'bug', 'x', 'y', 4, 1)$q$, 'check', 'W3 priority 1-3');
SELECT tst.logout();

SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.throws($q$SELECT public.support_review_admin_list()$q$, 'super admin only', 'W4 a user cannot read the list');
SELECT tst.throws($q$SELECT public.support_review_set_status(gen_random_uuid(), 'fixed')$q$, 'super admin only', 'W5 a user cannot change a status');
SELECT tst.logout();

SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE r jsonb; v_id uuid;
BEGIN
  -- the admin knows an item only from the list (the table itself is closed even to the super admin)
  SELECT (e ->> 'id')::uuid INTO v_id FROM jsonb_array_elements(public.support_review_admin_list() -> 'items') e WHERE e ->> 'title' = 'PDF';
  r := public.support_review_set_status(v_id, 'fixed');
  PERFORM tst.ok(r ->> 'ok' = 'true', 'W6 the super admin marks an item fixed');
  r := public.support_review_set_status(v_id, 'deleted');
  PERFORM tst.ok(r ->> 'ok' = 'false' AND r ->> 'code' = 'invalid_status', 'W7 only the four statuses');
  r := public.support_review_admin_list();
  PERFORM tst.ok(r ->> 'ok' = 'true' AND jsonb_array_length(r -> 'items') = 2 AND r -> 'items' -> 0 ->> 'title' = 'Calendar'
                 AND r -> 'items' -> 1 ->> 'status' = 'fixed' AND jsonb_array_length(r -> 'weeks') = 1,
    'W8 the list: open items first, a fixed one after');
END $$;
SELECT tst.throws($q$SELECT * FROM public.support_review_items$q$, 'permission denied', 'W9 even the super admin reads only through the function');
SELECT tst.logout();

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.support_review_admin_list()$q$, 'permission denied|super admin only', 'W10 ANON cannot read the list');
SELECT tst.logout();

ROLLBACK;
