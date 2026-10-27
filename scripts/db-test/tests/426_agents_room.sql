-- Owner console 2026-10-27 (typed: "מאשר שלב 1 של חדר הסוכנים ..."): 20261027400000 agent_runs. Disposable postgres:17 harness ONLY.
-- ONE transaction, rolled back. Proves: closed to anon / signed-in users (RLS forced, no grant); the server role writes and reads it;
-- fixed agents / triggers / statuses; one run per agent and run key; the findings are an array.
BEGIN;
SELECT tst.seed();

DO $$
BEGIN
  PERFORM tst.ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.agent_runs'::regclass), 'A1 RLS enabled and forced');
  PERFORM tst.ok((SELECT count(*) = 0 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_runs'), 'A2 no policy - closed to the app');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.agent_runs', 'SELECT') AND NOT has_table_privilege('anon', 'public.agent_runs', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.agent_runs', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.agent_runs', 'UPDATE'),
    'A3 neither anon nor a signed-in user holds any grant');
  PERFORM tst.ok(has_table_privilege('service_role', 'public.agent_runs', 'SELECT') AND has_table_privilege('service_role', 'public.agent_runs', 'INSERT')
    AND has_table_privilege('service_role', 'public.agent_runs', 'UPDATE') AND NOT has_table_privilege('service_role', 'public.agent_runs', 'DELETE'),
    'A4 the server role reads, inserts and updates (never deletes - the log stays)');
END $$;

SELECT tst.lives($q$INSERT INTO public.agent_runs (agent, run_key, trigger) VALUES ('seo', 'cron:2026-10-27', 'cron')$q$, 'A5 a weekly run is logged');
SELECT tst.throws($q$INSERT INTO public.agent_runs (agent, run_key, trigger) VALUES ('seo', 'cron:2026-10-27', 'cron')$q$, 'duplicate key|unique', 'A6 one run per agent and run key');
SELECT tst.throws($q$INSERT INTO public.agent_runs (agent, run_key, trigger) VALUES ('ads', 'cron:2026-10-27', 'cron')$q$, 'check', 'A7 only the three stage-1 agents');
SELECT tst.throws($q$INSERT INTO public.agent_runs (agent, run_key, trigger, findings) VALUES ('security', 'x', 'admin', '{}')$q$, 'check', 'A8 findings is an array');
SELECT tst.throws($q$UPDATE public.agent_runs SET status = 'published' WHERE agent = 'seo'$q$, 'check', 'A9 only the fixed statuses');

SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT count(*) FROM public.agent_runs$q$, 'permission denied', 'A10 a signed-in user cannot read the log');
SELECT tst.logout();
SELECT tst.anon();
SELECT tst.throws($q$INSERT INTO public.agent_runs (agent, run_key, trigger) VALUES ('seo', 'anon', 'cron')$q$, 'permission denied', 'A11 the public cannot write it');
SELECT tst.logout();
ROLLBACK;
