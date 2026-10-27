-- 20261027400000_agents_room.sql  -  the agents room (stage 1): one log of every agent run
-- tekango-migration-contract: mode=transaction replay=required
-- Owner console 2026-10-27 (typed: "מאשר שלב 1 של חדר הסוכנים: דוח גם במייל, תקרה 20 דולר, 65% חו״ל, כמשימת לילה"; plan
-- docs/AGENTS_ROOM_PLAN_2026-10-26.md): three read-only agents - SEO (the weekly Google Search Console report, international 65% /
-- Israel 35%), service (the week's inquiries and chat) and security (the live site's protection headers and public pages). Every run is
-- one row here: what it found, a short summary, the estimated AI cost (the monthly cap of 20 US dollars for all agents together is
-- counted from this table) and whether the Owner was emailed.
--   * Closed to the app: RLS forced, no policy, every grant of PUBLIC / anon / authenticated revoked; only the agents-room Edge function
--     (service role, super admin checked in code) reads and writes it. Explicit service_role grant (Supabase: new tables get none).
--   * run_key makes a run idempotent: the weekly cron run is 'cron:<Israel date>' (a second cron call the same day changes nothing); an
--     Owner "run now" is 'admin:<Israel date>T<hour>' (at most one per agent per hour).
--   ROLLBACK (DB owner): DROP TABLE public.agent_runs;

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  agent        text          NOT NULL CHECK (agent IN ('seo', 'service', 'security')),
  run_key      text          NOT NULL CHECK (char_length(run_key) BETWEEN 1 AND 60),
  trigger      text          NOT NULL CHECK (trigger IN ('cron', 'admin')),
  status       text          NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed', 'skipped_cap')),
  started_at   timestamptz   NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  summary      text          CHECK (summary IS NULL OR char_length(summary) <= 4000),
  findings     jsonb         NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(findings) = 'array'),
  data         jsonb         NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  ai_cost_usd  numeric(10,4) NOT NULL DEFAULT 0 CHECK (ai_cost_usd >= 0),
  tokens       integer       NOT NULL DEFAULT 0 CHECK (tokens >= 0),
  mailed_at    timestamptz,
  error        text          CHECK (error IS NULL OR char_length(error) <= 200),
  UNIQUE (agent, run_key)
);
COMMENT ON TABLE public.agent_runs IS
  'Owner 2026-10-27: the agents room (stage 1) - one row per agent run (seo / service / security); read and written only by the agents-room Edge function.';
CREATE INDEX IF NOT EXISTS agent_runs_agent_started_idx ON public.agent_runs (agent, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_started_idx ON public.agent_runs (started_at);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_runs TO service_role;
