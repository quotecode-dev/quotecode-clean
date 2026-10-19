-- Owner 2026-10-19: the voice assistant's daily allowance (20261019180000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the table is closed to the app (no select / insert / update for anon or authenticated); the claim counts only the CALLER's
-- own operations; the 61st operation of the day is refused (and refusing does not count); another user / another day has its own
-- allowance; an anonymous caller is refused; the function is not callable by anon.
BEGIN;
SELECT tst.seed();

DO $$
BEGIN
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voice_ai_daily_usage' AND rowsecurity), 'voice_ai_daily_usage exists with RLS on');
  PERFORM tst.ok(NOT has_table_privilege('authenticated', 'public.voice_ai_daily_usage', 'select') AND NOT has_table_privilege('authenticated', 'public.voice_ai_daily_usage', 'insert')
    AND NOT has_table_privilege('authenticated', 'public.voice_ai_daily_usage', 'update') AND NOT has_table_privilege('anon', 'public.voice_ai_daily_usage', 'select'), 'the table is closed to the app');
  PERFORM tst.ok(has_function_privilege('authenticated', 'public.voice_ai_claim_operation()', 'execute') AND NOT has_function_privilege('anon', 'public.voice_ai_claim_operation()', 'execute'), 'only a signed-in user may claim');
END $$;

-- 60 operations pass, the 61st is refused (and is not counted)
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE r jsonb; i integer;
BEGIN
  FOR i IN 1..60 LOOP r := public.voice_ai_claim_operation(); END LOOP;
  PERFORM tst.ok((r->>'allowed')::boolean AND (r->>'used')::int = 60 AND (r->>'limit')::int = 60, 'USER-A: the 60th operation of the day is allowed');
  r := public.voice_ai_claim_operation();
  PERFORM tst.ok(NOT (r->>'allowed')::boolean AND (r->>'used')::int = 60, 'USER-A: the 61st operation is refused');
END $$;
SELECT tst.throws($q$SELECT * FROM public.voice_ai_daily_usage$q$, 'permission denied', 'USER-A: cannot read the counters directly');
SELECT tst.throws($q$INSERT INTO public.voice_ai_daily_usage (user_id, usage_day, operations) VALUES ('00000000-0000-4000-8000-00000000000a', current_date + 1, 0)$q$, 'permission denied', 'USER-A: cannot write a counter directly');
SELECT tst.logout();
SELECT tst.ok((SELECT operations FROM public.voice_ai_daily_usage WHERE user_id = '00000000-0000-4000-8000-00000000000a') = 60, 'USER-A: exactly 60 counted (the refusal added nothing)');

-- another user has a separate allowance
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
DECLARE r jsonb;
BEGIN
  r := public.voice_ai_claim_operation();
  PERFORM tst.ok((r->>'allowed')::boolean AND (r->>'used')::int = 1, 'USER-B: own allowance, first operation allowed');
END $$;
SELECT tst.logout();

-- yesterday's full allowance does not block today
UPDATE public.voice_ai_daily_usage SET usage_day = usage_day - 1 WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE r jsonb;
BEGIN
  r := public.voice_ai_claim_operation();
  PERFORM tst.ok((r->>'allowed')::boolean AND (r->>'used')::int = 1, 'USER-A: a new day starts a new allowance');
END $$;
SELECT tst.logout();

-- no identity: refused
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.voice_ai_claim_operation()$q$, 'permission denied|not authenticated', 'ANON: cannot claim');
SELECT tst.logout();

ROLLBACK;
