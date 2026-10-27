-- Owner console 2026-10-27 (typed: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים"): 20261027500000 the agents manager, agent_actions,
-- agent_profiles, site_articles. Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: the manager is an agent; the
-- actions / names are closed to the app; a kind only pairs with its own actions (nothing else runs automatically); the public reads only
-- published articles and only their public columns, and can never write; a signed-in user is the same as the public.
BEGIN;
SELECT tst.seed();

DO $$
BEGIN
  PERFORM tst.ok((SELECT bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE oid IN ('public.agent_actions'::regclass, 'public.agent_profiles'::regclass, 'public.site_articles'::regclass)),
    'S1 RLS enabled and forced on the three new tables');
  PERFORM tst.ok((SELECT count(*) = 0 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('agent_actions', 'agent_profiles')), 'S2 actions and names: no policy - closed to the app');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.agent_actions', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.agent_actions', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.agent_profiles', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.agent_profiles', 'UPDATE'),
    'S3 neither the public nor a signed-in user holds a grant on the actions or the names');
  PERFORM tst.ok(has_table_privilege('service_role', 'public.agent_actions', 'INSERT') AND has_table_privilege('service_role', 'public.agent_actions', 'UPDATE')
    AND NOT has_table_privilege('service_role', 'public.agent_actions', 'DELETE') AND NOT has_table_privilege('service_role', 'public.agent_profiles', 'INSERT')
    AND has_table_privilege('service_role', 'public.agent_profiles', 'UPDATE') AND NOT has_table_privilege('service_role', 'public.site_articles', 'DELETE'),
    'S4 the server role writes what it needs and never deletes');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.site_articles', 'INSERT') AND NOT has_table_privilege('anon', 'public.site_articles', 'UPDATE')
    AND NOT has_column_privilege('anon', 'public.site_articles', 'action_id', 'SELECT') AND has_column_privilege('anon', 'public.site_articles', 'he', 'SELECT'),
    'S5 the public may read the public article columns only and never write');
  -- 20261028000000 (Owner 2026-10-27) adds the social agent as a fifth: this test checks the four stage-2 agents by name
  PERFORM tst.ok((SELECT count(*) = 4 FROM public.agent_profiles WHERE agent IN ('manager', 'seo', 'service', 'security')), 'S6 the four agents have a default name');
END $$;

SELECT tst.lives($q$INSERT INTO public.agent_runs (agent, run_key, trigger) VALUES ('manager', 'cron:2026-11-01', 'cron')$q$, 'S7 the manager is an agent');
SELECT tst.throws($q$INSERT INTO public.agent_runs (agent, run_key, trigger) VALUES ('ads', 'cron:2026-11-01', 'cron')$q$, 'check', 'S8 still no unknown agent');
SELECT tst.lives($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('cron:2026-11-01', 'manager', 'auto', 'sitemap_submit', 'מפה', 'Map')$q$, 'S9 an automatic sitemap resubmission');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k', 'manager', 'auto', 'article_publish', 'x', 'x')$q$, 'check', 'S10 publishing is never automatic');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k', 'manager', 'auto', 'claude_task', 'x', 'x')$q$, 'check', 'S11 a code task is never automatic');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k', 'manager', 'info', 'urgent_mail', 'x', 'x')$q$, 'check', 'S12 information does nothing');
SELECT tst.lives($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en, dedupe_key) VALUES ('k', 'security', 'auto', 'urgent_mail', 'x', 'x', 'urgent:2026-11-01')$q$, 'S13 an urgent email');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en, dedupe_key) VALUES ('k', 'security', 'auto', 'urgent_mail', 'x', 'x', 'urgent:2026-11-01')$q$, 'duplicate key|unique', 'S14 the same urgent email only once');
SELECT tst.throws($q$UPDATE public.agent_profiles SET name_he = '' WHERE agent = 'seo'$q$, 'check', 'S15 a name is never empty');

SELECT tst.lives($q$INSERT INTO public.site_articles (slug, market, he, en) VALUES ('draft-guide', 'intl', '{"h1":"טיוטה"}', '{"h1":"Draft"}')$q$, 'S16 a draft');
SELECT tst.lives($q$INSERT INTO public.site_articles (slug, market, status, he, en, published_at) VALUES ('live-guide', 'il', 'published', '{"h1":"מדריך"}', '{"h1":"Guide"}', now())$q$, 'S17 a published article');
SELECT tst.throws($q$INSERT INTO public.site_articles (slug, market, status, he, en) VALUES ('no-date', 'il', 'published', '{}', '{}')$q$, 'check', 'S18 published means a publication date');
SELECT tst.throws($q$INSERT INTO public.site_articles (slug, market, he, en) VALUES ('Bad Slug!', 'il', '{}', '{}')$q$, 'check', 'S19 the slug is a clean URL part');

SELECT tst.anon();
SELECT tst.ok((SELECT count(*) = 1 AND bool_and(slug = 'live-guide') FROM public.site_articles), 'S20 the public sees the published article and not the draft');
SELECT tst.throws($q$SELECT action_id FROM public.site_articles$q$, 'permission denied', 'S21 the public cannot read a private column');
SELECT tst.throws($q$INSERT INTO public.site_articles (slug, market, he, en) VALUES ('spam', 'il', '{}', '{}')$q$, 'permission denied', 'S22 the public cannot write an article');
SELECT tst.throws($q$SELECT count(*) FROM public.agent_actions$q$, 'permission denied', 'S23 the public cannot read the actions');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((SELECT count(*) = 1 FROM public.site_articles), 'S24 a signed-in user sees only the published article too');
SELECT tst.throws($q$UPDATE public.agent_profiles SET name_he = 'x'$q$, 'permission denied', 'S25 a signed-in user cannot rename an agent');
SELECT tst.logout();

ROLLBACK;
