-- 20261027500000_agents_room_stage2.sql  -  the agents room (stage 2): the agents manager, actions the Owner approves, agent names,
-- articles the Owner approves for publication
-- tekango-migration-contract: mode=transaction replay=required
-- Owner console 2026-10-27 (typed: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים" + the four decisions: automatic article publication, the
-- Google permission raised for the sitemap, a daily security agent, two article proposals a week; plan
-- docs/AGENTS_ROOM_STAGE2_PLAN_2026-10-27.md):
--   * agent_runs: the manager is a fourth agent (it gathers the specialists' findings and proposes the week's actions).
--   * agent_actions: every proposal of the manager - automatic (a closed list: sitemap resubmission, an urgent email to the Owner),
--     "approve and the system does it" (an article draft / its publication), "approve and Claude does it" (a code task), or information.
--     Nothing but an Owner approval (checked in the agents-room function, super admin only) moves a proposal to approved.
--   * agent_profiles: the name the Owner gives each agent (Hebrew + English), shown on the screen and in the weekly email.
--   * site_articles: guides written by the AI on an approved topic. A draft is visible to nobody but the function; an article the Owner
--     approved (status published) is public content - the site reads it (anon, published rows and public columns only) and the
--     production build prerenders it.
--   Closed to the app except the published articles: RLS forced; agent_actions / agent_profiles have no policy and no grant for PUBLIC /
--   anon / authenticated; only the agents-room Edge function (service role) reads and writes. Explicit grants (Supabase: new tables get none).
--   ROLLBACK (DB owner): DROP TABLE public.site_articles, public.agent_actions, public.agent_profiles;
--     ALTER TABLE public.agent_runs DROP CONSTRAINT agent_runs_agent_check, ADD CONSTRAINT agent_runs_agent_check CHECK (agent IN ('seo', 'service', 'security'));

ALTER TABLE public.agent_runs DROP CONSTRAINT IF EXISTS agent_runs_agent_check;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_agent_check CHECK (agent IN ('manager', 'seo', 'service', 'security'));

CREATE TABLE IF NOT EXISTS public.agent_profiles (
  agent       text         PRIMARY KEY CHECK (agent IN ('manager', 'seo', 'service', 'security')),
  name_he     text         NOT NULL CHECK (char_length(btrim(name_he)) BETWEEN 1 AND 30),
  name_en     text         NOT NULL CHECK (char_length(btrim(name_en)) BETWEEN 1 AND 30),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.agent_profiles IS
  'Owner 2026-10-27: the name the Owner gives each agent of the agents room; read and written only by the agents-room Edge function.';
INSERT INTO public.agent_profiles (agent, name_he, name_en) VALUES
  ('manager', 'נועה', 'Noa'), ('seo', 'גיא', 'Guy'), ('service', 'מיכל', 'Michal'), ('security', 'אבי', 'Avi')
ON CONFLICT (agent) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz   NOT NULL DEFAULT now(),
  run_key      text          NOT NULL CHECK (char_length(run_key) BETWEEN 1 AND 60),
  source       text          NOT NULL CHECK (source IN ('manager', 'seo', 'service', 'security')),
  kind         text          NOT NULL CHECK (kind IN ('auto', 'system', 'claude', 'info')),
  action_type  text          NOT NULL CHECK (action_type IN ('sitemap_submit', 'urgent_mail', 'article_draft', 'article_publish', 'claude_task', 'none')),
  title_he     text          NOT NULL CHECK (char_length(title_he) BETWEEN 1 AND 300),
  title_en     text          NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 300),
  detail_he    text          CHECK (detail_he IS NULL OR char_length(detail_he) <= 6000),
  detail_en    text          CHECK (detail_en IS NULL OR char_length(detail_en) <= 6000),
  payload      jsonb         NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status       text          NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'done', 'failed')),
  decided_at   timestamptz,
  done_at      timestamptz,
  result       jsonb         NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result) = 'object'),
  error        text          CHECK (error IS NULL OR char_length(error) <= 200),
  dedupe_key   text          CHECK (dedupe_key IS NULL OR char_length(dedupe_key) <= 200),
  -- the kind and the action agree: only the closed automatic list runs without the Owner; a code task is always Claude's; info does nothing
  CHECK ((kind = 'auto' AND action_type IN ('sitemap_submit', 'urgent_mail'))
      OR (kind = 'system' AND action_type IN ('article_draft', 'article_publish'))
      OR (kind = 'claude' AND action_type = 'claude_task')
      OR (kind = 'info' AND action_type = 'none'))
);
COMMENT ON TABLE public.agent_actions IS
  'Owner 2026-10-27: the agents manager''s proposals (auto / approve-system / approve-Claude / info) and what happened to each; agents-room Edge function only.';
CREATE UNIQUE INDEX IF NOT EXISTS agent_actions_dedupe_idx ON public.agent_actions (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS agent_actions_created_idx ON public.agent_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_actions_status_idx ON public.agent_actions (status);

CREATE TABLE IF NOT EXISTS public.site_articles (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text          NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 80),
  market          text          NOT NULL CHECK (market IN ('intl', 'il')),
  status          text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'rejected')),
  he              jsonb         NOT NULL CHECK (jsonb_typeof(he) = 'object'),
  en              jsonb         NOT NULL CHECK (jsonb_typeof(en) = 'object'),
  action_id       uuid          REFERENCES public.agent_actions (id),
  created_at      timestamptz   NOT NULL DEFAULT now(),
  published_at    timestamptz,
  CHECK ((status = 'published') = (published_at IS NOT NULL))
);
COMMENT ON TABLE public.site_articles IS
  'Owner 2026-10-27: guides written on an Owner-approved topic; a draft is private, an Owner-approved (published) article is public site content.';
CREATE INDEX IF NOT EXISTS site_articles_published_idx ON public.site_articles (published_at DESC) WHERE status = 'published';

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.site_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_articles FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agent_profiles, public.agent_actions, public.site_articles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON TABLE public.agent_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_actions TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.site_articles TO service_role;

-- the public site reads the published articles only: the public columns, the published rows
GRANT SELECT (slug, market, status, he, en, published_at) ON TABLE public.site_articles TO anon, authenticated;
DROP POLICY IF EXISTS site_articles_published_read ON public.site_articles;
CREATE POLICY site_articles_published_read ON public.site_articles FOR SELECT TO anon, authenticated USING (status = 'published');
