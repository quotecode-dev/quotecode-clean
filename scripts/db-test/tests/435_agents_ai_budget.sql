-- Codex release 4 (Owner 2026-10-29, migration 20261030200000): the agents' AI budget is reserved before every paid request.
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: only the service role reaches the ledger (functions only, no
-- table); a reservation is admitted only while carried-in + settled + held + it <= the cap (the exact final slot admitted, one micro-dollar
-- more refused); settlement happens once; unknown keeps the hold; a provider refusal costs 0; an over-reservation stops the month;
-- months are separate; decision 9's carry-in = the month's recorded run costs + 20%, rounded up.
BEGIN;

-- ------------------------------------------------------------------------------------------------- B1. closed to the app
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.agents_ai_reserve('2031-01', 'x', 'gpt-6-luna', 'v', 1, 1, 1)$q$, 'permission denied', 'B1 the public cannot reserve');
SELECT tst.throws($q$SELECT public.agents_ai_budget_state('2031-01')$q$, 'permission denied', 'B1b nor read the budget');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.agents_ai_settle(gen_random_uuid(), 'settled', 1, 1, 1)$q$, 'permission denied', 'B1c a signed-in user cannot settle');
SELECT tst.throws($q$SELECT count(*) FROM public.agents_ai_attempts$q$, 'permission denied', 'B1d nor read the attempts');
SELECT tst.logout();
SELECT set_config('role', 'service_role', false);
SELECT tst.throws($q$SELECT count(*) FROM public.agents_ai_budget_months$q$, 'permission denied', 'B1e the service role reaches the ledger only through its functions');
SELECT tst.throws($q$SELECT public.agents_ai_committed_micros('2031-01')$q$, 'permission denied', 'B1f the internal sum is not callable');

-- ------------------------------------------------------------------------------------------------- B2. admission up to the cap, exactly
SELECT tst.ok((public.agents_ai_reserve('2031-01', 'manager_weekly', 'gpt-6-luna', 'v1', 1000, 2000, 15000000) ->> 'ok')::boolean, 'B2 15 of 20 dollars reserved');
SELECT tst.ok((SELECT r ->> 'code' = 'budget_insufficient' FROM (SELECT public.agents_ai_reserve('2031-01', 'guide_article', 'gpt-6-luna', 'v1', 1000, 6000, 5000001) r) x),
  'B2b one micro-dollar over the cap is refused');
SELECT tst.ok((public.agents_ai_reserve('2031-01', 'guide_article', 'gpt-6-luna', 'v1', 1000, 6000, 5000000) ->> 'ok')::boolean, 'B2c the exact final slot is admitted');
SELECT tst.ok((SELECT r ->> 'code' = 'budget_insufficient' FROM (SELECT public.agents_ai_reserve('2031-01', 'seo_weekly', 'gpt-4o-mini', 'v1', 1, 1, 1) r) x),
  'B2d a full month admits nothing more (a fallback model needs its own reservation)');
SELECT tst.ok((SELECT (s ->> 'committed_micros')::bigint = 20000000 AND (s ->> 'held_micros')::bigint = 20000000 AND (s ->> 'cap_micros')::bigint = 20000000
                 FROM (SELECT public.agents_ai_budget_state('2031-01') s) x), 'B2e the state: everything held, nothing settled yet');
SELECT tst.throws($q$SELECT public.agents_ai_reserve('2031-13', 'x', 'm', 'v', 1, 1, 1)$q$, 'agents_ai_reserve_invalid', 'B2f a malformed month is refused');
SELECT tst.throws($q$SELECT public.agents_ai_reserve('2031-01', 'x', 'm', 'v', 1, 1, 0)$q$, 'agents_ai_reserve_invalid', 'B2g a zero reservation is refused');

-- ------------------------------------------------------------------------------------------------- B3. settlement, once
SELECT tst.logout();
CREATE TEMP TABLE att ON COMMIT DROP AS SELECT id, reserved_micros FROM public.agents_ai_attempts WHERE month = '2031-01';
GRANT SELECT ON att TO service_role;
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((public.agents_ai_settle((SELECT id FROM att WHERE reserved_micros = 15000000), 'settled', 900, 1800, 10000000) ->> 'status') = 'settled',
  'B3 the observed cost settles the first request');
SELECT tst.ok((public.agents_ai_settle((SELECT id FROM att WHERE reserved_micros = 15000000), 'settled', 1, 1, 1) ->> 'code') = 'not_reserved',
  'B3b a second settlement of the same request changes nothing');
SELECT tst.ok((SELECT (s ->> 'committed_micros')::bigint = 15000000 FROM (SELECT public.agents_ai_budget_state('2031-01') s) x), 'B3c 10 settled + 5 held = 15');
SELECT tst.ok((public.agents_ai_reserve('2031-01', 'social_week', 'gpt-6-luna', 'v1', 10, 10, 5000000) ->> 'ok')::boolean, 'B3d the freed 5 dollars are admitted again');
SELECT tst.throws($q$SELECT public.agents_ai_settle(gen_random_uuid(), 'paid', 1, 1, 1)$q$, 'agents_ai_settle_invalid', 'B3e an unknown outcome word is refused');
SELECT tst.throws($q$SELECT public.agents_ai_settle(gen_random_uuid(), NULL, 1, 1, 1)$q$, 'agents_ai_settle_invalid', 'B3f a missing outcome is refused');

-- ------------------------------------------------------------------------------------------------- B4. unknown keeps, a refusal is free, an anomaly stops
SELECT tst.ok((public.agents_ai_settle((SELECT id FROM att WHERE reserved_micros = 5000000), 'unknown', NULL, NULL, NULL) ->> 'status') = 'unknown',
  'B4 no answer: the outcome is unknown');
SELECT tst.ok((SELECT (s ->> 'held_micros')::bigint = 10000000 AND (s ->> 'committed_micros')::bigint = 20000000 FROM (SELECT public.agents_ai_budget_state('2031-01') s) x),
  'B4b the unknown request keeps its whole reservation');
SELECT tst.ok((public.agents_ai_settle((SELECT id FROM att WHERE reserved_micros = 5000000), 'settled', 1, 1, 1) ->> 'code') = 'not_reserved',
  'B4c an unknown request is not settled later as free');
SELECT tst.ok((public.agents_ai_reserve('2031-02', 'manager_weekly', 'gpt-6-luna', 'v1', 10, 10, 3000000) ->> 'ok')::boolean, 'B4d a new month is its own budget');
SELECT tst.ok((SELECT (s ->> 'committed_micros')::bigint = 20000000 FROM (SELECT public.agents_ai_budget_state('2031-01') s) x), 'B4e and the old month keeps its unknown hold');
SELECT tst.logout();
CREATE TEMP TABLE att2 ON COMMIT DROP AS SELECT id FROM public.agents_ai_attempts WHERE month = '2031-02';
GRANT SELECT ON att2 TO service_role;
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((public.agents_ai_settle((SELECT id FROM att2), 'failed', NULL, NULL, NULL) ->> 'status') = 'settled', 'B4f a provider refusal settles');
SELECT tst.ok((SELECT (s ->> 'committed_micros')::bigint = 0 FROM (SELECT public.agents_ai_budget_state('2031-02') s) x), 'B4g at a cost of 0');
SELECT tst.ok((public.agents_ai_reserve('2031-02', 'guide_article', 'gpt-6-luna', 'v1', 10, 10, 100) ->> 'ok')::boolean, 'B4h another request in February');
SELECT tst.logout();
CREATE TEMP TABLE att3 ON COMMIT DROP AS SELECT id FROM public.agents_ai_attempts WHERE month = '2031-02' AND status = 'reserved';
GRANT SELECT ON att3 TO service_role;
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((public.agents_ai_settle((SELECT id FROM att3), 'settled', 10, 10, 101) ->> 'status') = 'anomaly', 'B4i an observed cost above its reservation is an anomaly');
SELECT tst.ok((SELECT r ->> 'code' = 'budget_blocked' FROM (SELECT public.agents_ai_reserve('2031-02', 'x', 'gpt-6-luna', 'v1', 1, 1, 1) r) x),
  'B4j and the month admits no further paid request');
SELECT tst.ok((SELECT (s ->> 'blocked')::boolean AND (s ->> 'committed_micros')::bigint = 101 FROM (SELECT public.agents_ai_budget_state('2031-02') s) x),
  'B4k the state says the month is stopped, with the real cost counted');
SELECT tst.logout();
SELECT tst.ok((SELECT prosrc ~ 'FOR UPDATE' FROM pg_proc WHERE proname = 'agents_ai_reserve'), 'B4l admission locks the month row (one admission at a time per month)');

-- ------------------------------------------------------------------------------------------------- B5. decision 9: the carry-in of the current month
SELECT tst.ok((SELECT count(*) = 1 FROM public.agents_ai_budget_months WHERE month = to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM')),
  'B5 the month the migration was applied in has its row');
DELETE FROM public.agents_ai_budget_months WHERE month = to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM')
  AND NOT EXISTS (SELECT 1 FROM public.agents_ai_attempts a WHERE a.month = to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM'));
INSERT INTO public.agent_runs (agent, run_key, trigger, status, ai_cost_usd, started_at) VALUES
  ('manager', 'b5:1', 'admin', 'done', 1.2345, now()), ('social', 'b5:2', 'admin', 'done', 0.5, now()),
  ('seo', 'b5:3', 'admin', 'done', 7, (date_trunc('month', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem') - interval '1 minute');
-- the migration's own carry-in statement, applied again (the file is replayed as-is by the harness; here on known rows)
INSERT INTO public.agents_ai_budget_months (month, opening_micros)
SELECT to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM'), ceil(coalesce(sum(r.ai_cost_usd), 0) * 1.2 * 1000000)::bigint
  FROM public.agent_runs r WHERE r.started_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem')
ON CONFLICT (month) DO NOTHING;
SELECT tst.ok((SELECT opening_micros = 2081400 FROM public.agents_ai_budget_months WHERE month = to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM')),
  'B5b this month''s recorded 1.7345 dollars + 20% = 2.0814 carried in; last month''s run is not');

ROLLBACK;
