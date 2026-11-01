-- Codex review 2026-10-31 group 3 (migration 20261031400000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the weekly collection is claimed once (a second collector answers running), a completed week answers done with its result,
-- a week that did not complete and an expired lease are taken over with the previous result, only the claim holder writes the result,
-- the snapshot carries checked / unavailable, and nothing of it is open to the app.
BEGIN;
SELECT tst.seed();

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.marketing_week_claim('2026-11-01', 'r', 900)$q$, 'permission denied', 'S1 the public cannot claim a week');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT count(*) FROM public.marketing_weeks$q$, 'permission denied', 'S1b nor a signed-in user read the weeks');
SELECT tst.logout();

SELECT set_config('role', 'service_role', false);
SELECT tst.ok(public.marketing_week_claim('2026-11-01', 'run-a', 900) ->> 'status' = 'claimed', 'S2 the first collector claims the week');
SELECT tst.ok(public.marketing_week_claim('2026-11-01', 'run-b', 900) ->> 'status' = 'running', 'S2b a second collector buys nothing while it runs');
SELECT tst.ok(NOT public.marketing_week_finish('2026-11-01', 'run-b', 'ok', '{"state":"ok"}'), 'S2c only the claim holder writes the result');
SELECT tst.ok(public.marketing_week_finish('2026-11-01', 'run-a', 'partial', '{"state":"partial","markets":{"il":"ok","intl":"unavailable"}}'), 'S3 the holder writes a partial week');
SELECT set_config('tst.c', public.marketing_week_claim('2026-11-01', 'run-c', 900)::text, false);
SELECT tst.ok(current_setting('tst.c')::jsonb ->> 'status' = 'claimed' AND current_setting('tst.c')::jsonb -> 'previous' -> 'markets' ->> 'il' = 'ok',
  'S3b a week that did not complete is taken over with the previous result (resume only what is missing)');
SELECT tst.ok(public.marketing_week_finish('2026-11-01', 'run-c', 'ok', '{"state":"ok","checked":3}'), 'S3c the resumed run completes the week');
SELECT tst.ok((SELECT r ->> 'status' = 'done' AND r -> 'result' ->> 'checked' = '3' FROM public.marketing_week_claim('2026-11-01', 'run-d', 900) r),
  'S4 a completed week answers done with its stored result - nothing is bought again');
SELECT tst.ok(public.marketing_week_claim('2026-11-08', 'run-x', 900) ->> 'status' = 'claimed', 'S5 another week');
UPDATE public.marketing_weeks SET lease_until = now() - interval '1 second' WHERE week = '2026-11-08';
SELECT tst.ok(public.marketing_week_claim('2026-11-08', 'run-y', 900) ->> 'status' = 'claimed', 'S5b an expired lease (a worker that died) is taken over');
SELECT tst.ok(NOT public.marketing_week_finish('2026-11-08', 'run-x', 'ok', '{}'), 'S5c and the dead run can no longer write');
SELECT tst.throws($q$SELECT public.marketing_week_claim('2026-11-15', 'r', 5)$q$, 'marketing_week_invalid', 'S6 a lease outside 60..3600 seconds is refused');
INSERT INTO public.marketing_keywords (id, market, keyword) VALUES ('a4510000-0000-4000-8000-000000000001', 'intl', 'quote app');
INSERT INTO public.marketing_rank_snapshots (week, keyword_id, our_position, competitor_positions, search_volume, depth, our_status)
VALUES ('2026-11-01', 'a4510000-0000-4000-8000-000000000001', NULL, '{}', NULL, 100, 'unavailable');
SELECT tst.ok((SELECT our_status = 'unavailable' FROM public.marketing_rank_snapshots WHERE keyword_id = 'a4510000-0000-4000-8000-000000000001'), 'S7 a snapshot records unavailable');
SELECT tst.throws($q$UPDATE public.marketing_rank_snapshots SET our_status = 'maybe'$q$, 'violates check constraint', 'S7b only checked / unavailable');
RESET role;
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.marketing_week_finish(date, text, text, jsonb)', 'EXECUTE'), 'S8 service role only');

ROLLBACK;
