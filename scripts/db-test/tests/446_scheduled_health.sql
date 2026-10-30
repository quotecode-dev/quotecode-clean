-- Continuous work 30/10 (migration 20261030900000, Codex release 7, decision 11): the scheduled-run watcher.
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: the window is the database's (daily / Sunday / the 1st, in
-- UTC); no alert before activation or before the deadline (final slot + grace); a window without a valid completion is ONE incident with
-- one alert; a partial / failed report is an incident too; a later completion recovers it with one notice; a delivered mail is recorded
-- once; nothing is open to the app.
BEGIN;
SELECT tst.seed();

SELECT tst.ok(public.scheduled_window_of('daily', '2026-11-03 10:00+00') = '2026-11-03', 'W1 a daily window is its UTC date');
SELECT tst.ok(public.scheduled_window_of('weekly_sunday', '2026-11-03 10:00+00') = '2026-11-01', 'W1b a weekly window is its Sunday');
SELECT tst.ok(public.scheduled_window_of('monthly_first', '2026-11-17 10:00+00') = '2026-11-01', 'W1c a monthly window is its 1st');

-- activation in the past for the test (production: the moment of the apply - no page for history)
UPDATE public.scheduled_jobs SET enabled_from = '2026-11-01 00:00+00';

-- before the deadline of 3/11 (support-digest final slot 18:00 + 45 min) the latest due window is 2/11; nothing reported -> incidents
SELECT tst.ok((SELECT count(*) = 0 FROM jsonb_array_elements(public.scheduled_health_evaluate('2026-11-01 00:10+00'))), 'W2 nothing is due right after activation');
SELECT tst.ok((SELECT count(*) FILTER (WHERE x ->> 'job' = 'support-digest') = 1 AND count(*) FILTER (WHERE x ->> 'mail' = 'alert') = count(*)
  FROM jsonb_array_elements(public.scheduled_health_evaluate('2026-11-02 19:00+00')) x), 'W3 a window that ended without a completion is one alert');
SELECT tst.ok((SELECT count(*) = 1 FROM public.scheduled_job_incidents WHERE job = 'support-digest' AND window_key = '2026-11-02' AND kind = 'missed'), 'W3b one incident, kind missed');
SELECT public.scheduled_health_evaluate('2026-11-02 19:10+00');
SELECT tst.ok((SELECT count(*) = 1 FROM public.scheduled_job_incidents WHERE job = 'support-digest'), 'W3c a second evaluation never opens a second incident');
SELECT tst.ok(public.scheduled_health_mailed((SELECT id FROM public.scheduled_job_incidents WHERE job = 'support-digest'), 'alert'), 'W4 a delivered alert is recorded');
SELECT tst.ok((SELECT count(*) = 0 FROM jsonb_array_elements(public.scheduled_health_evaluate('2026-11-02 19:20+00')) x WHERE x ->> 'job' = 'support-digest'),
  'W4b and is never sent again ("no still-broken emails")');

-- a worker reports (the window is the server time's): partial
INSERT INTO public.scheduled_job_events (job, window_key, event, outcome) VALUES ('billing-reconcile', '2026-11-03', 'partial', 'not_mailed');
SELECT public.scheduled_health_evaluate('2026-11-03 06:00+00');
SELECT tst.ok((SELECT kind = 'partial' FROM public.scheduled_job_incidents WHERE job = 'billing-reconcile' AND window_key = '2026-11-03'), 'W5 a partial run is an incident (not a success)');

-- the next evening completes: the digest incident recovers with one notice
INSERT INTO public.scheduled_job_events (job, window_key, event, outcome) VALUES ('support-digest', '2026-11-03', 'completed', 'sent');
SELECT tst.ok((SELECT count(*) = 1 FROM jsonb_array_elements(public.scheduled_health_evaluate('2026-11-03 19:00+00')) x WHERE x ->> 'job' = 'support-digest' AND x ->> 'mail' = 'recovery'),
  'W6 a later completed window recovers the incident with one notice');
SELECT tst.ok(public.scheduled_health_mailed((SELECT id FROM public.scheduled_job_incidents WHERE job = 'support-digest'), 'recovery'), 'W6b the notice is recorded');
SELECT tst.ok((SELECT count(*) = 0 FROM jsonb_array_elements(public.scheduled_health_evaluate('2026-11-03 19:10+00')) x WHERE x ->> 'job' = 'support-digest'), 'W6c and never sent again');

-- the record function: server-derived window, unknown job / event refused
SET LOCAL role = service_role;
SELECT tst.ok(public.scheduled_health_record('agents-daily', 'completed', 'ok'), 'W7 a worker records its event');
SELECT tst.ok(NOT public.scheduled_health_record('no-such-job', 'completed', 'ok') AND NOT public.scheduled_health_record('agents-daily', 'done', 'ok'), 'W7b an unknown job or event is refused');
RESET role;
SELECT tst.ok((SELECT window_key = (now() AT TIME ZONE 'UTC')::date FROM public.scheduled_job_events WHERE job = 'agents-daily' ORDER BY id DESC LIMIT 1), 'W7c the window is the server''s, never the caller''s');

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.scheduled_health_evaluate()$q$, 'permission denied', 'W8 the public cannot evaluate');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT count(*) FROM public.scheduled_job_incidents$q$, 'permission denied', 'W8b nor a signed-in user read the incidents');
SELECT tst.throws($q$SELECT public.scheduled_health_record('agents-daily', 'completed', 'ok')$q$, 'permission denied', 'W8c nor fake a completion');
SELECT tst.logout();

ROLLBACK;
