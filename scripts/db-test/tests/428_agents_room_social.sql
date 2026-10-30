-- Owner console 2026-10-27 (typed: "מאשר את שלב 1 של סוכנת הרשתות"): 20261028000000 the social agent. Disposable postgres:17 harness ONLY.
-- ONE transaction, rolled back. Proves: the social agent is an agent with a default name; a social post exists only as an Owner-approved
-- system action (never automatic, never information, never Claude's); the closed lists still refuse anything unknown; nothing opens
-- the actions or the names to the app.
BEGIN;
SELECT tst.seed();

DO $$
BEGIN
  PERFORM tst.ok((SELECT name_he = 'שירה' AND name_en = 'Shira' FROM public.agent_profiles WHERE agent = 'social'), 'SO1 the social agent has its default name');
  -- Codex release 9 (20261031100000) adds Maya and Omer - the first five keep their names (DB test 448 R2 checks the two new ones)
  PERFORM tst.ok((SELECT count(*) = 5 FROM public.agent_profiles WHERE agent IN ('manager', 'seo', 'service', 'security', 'social')), 'SO2 five agents have a name');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.agent_actions', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.agent_actions', 'SELECT')
    AND NOT has_table_privilege('authenticated', 'public.agent_profiles', 'UPDATE') AND NOT has_table_privilege('service_role', 'public.agent_actions', 'DELETE'),
    'SO3 the grants did not move: closed to the app, the server never deletes');
  PERFORM tst.ok((SELECT count(*) = 0 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('agent_actions', 'agent_profiles')), 'SO4 still no policy');
END $$;

SELECT tst.lives($q$INSERT INTO public.agent_runs (agent, run_key, trigger) VALUES ('social', 'cron:2026-11-01', 'cron')$q$, 'SO5 the social agent runs');
SELECT tst.throws($q$INSERT INTO public.agent_runs (agent, run_key, trigger) VALUES ('ads', 'cron:2026-11-01', 'cron')$q$, 'check', 'SO6 still no unknown agent');
SELECT tst.lives($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en, payload, dedupe_key)
  VALUES ('cron:2026-11-01', 'social', 'system', 'social_post', 'פוסט', 'Post', '{"channel":"fb_il"}', 'social:2026-11-01:fb_il:0')$q$, 'SO7 a social post waits for the Owner (system)');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k', 'social', 'auto', 'social_post', 'x', 'x')$q$, 'check', 'SO8 a post is never automatic');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k', 'social', 'info', 'social_post', 'x', 'x')$q$, 'check', 'SO9 a post is never just information');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k', 'social', 'claude', 'social_post', 'x', 'x')$q$, 'check', 'SO10 a post is never a code task');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en, dedupe_key)
  VALUES ('k', 'social', 'system', 'social_post', 'x', 'x', 'social:2026-11-01:fb_il:0')$q$, 'duplicate key|unique', 'SO11 the week''s slot is taken once');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k', 'ads', 'system', 'social_post', 'x', 'x')$q$, 'check', 'SO12 no unknown source');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k', 'social', 'system', 'paid_ad', 'x', 'x')$q$, 'check', 'SO13 no unknown action');
SELECT tst.lives($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k2', 'manager', 'auto', 'sitemap_submit', 'מפה', 'Map')$q$, 'SO14 the earlier actions still work');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('k3', 'manager', 'auto', 'article_publish', 'x', 'x')$q$, 'check', 'SO15 publishing an article is still never automatic');
SELECT tst.lives($q$UPDATE public.agent_profiles SET name_he = 'רוני', name_en = 'Roni' WHERE agent = 'social'$q$, 'SO16 the Owner renames the social agent');

-- the supervisor (L-22, Owner 2026-10-27 "מאשר את שניהם"): the two social permissions are known; only the Owner grants; the earlier ones stay
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.throws($q$SELECT public.set_admin_permissions('00000000-0000-4000-8000-00000000000b', ARRAY['social.view'])$q$, 'super_admin required', 'SO17 a non-owner cannot grant the social permissions');
SELECT tst.ok((SELECT public.has_admin_permission('social.view')) = false, 'SO18 nobody holds social.view by default');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((SELECT (public.set_admin_permissions('00000000-0000-4000-8000-00000000000b', ARRAY['social.view', 'social.publish', 'inquiries.view'])->>'ok')::boolean), 'SO19 the Owner grants social.view + social.publish (with an earlier permission)');
SELECT tst.throws($q$SELECT public.set_admin_permissions('00000000-0000-4000-8000-00000000000b', ARRAY['social.delete'])$q$, 'unknown permission', 'SO20 still no unknown permission');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.ok((SELECT public.has_admin_permission('social.view') AND public.has_admin_permission('social.publish') AND public.has_admin_permission('inquiries.view')
  AND NOT public.has_admin_permission('users.view')), 'SO21 the supervisor holds exactly what was granted');
SELECT tst.throws($q$SELECT count(*) FROM public.agent_actions$q$, 'permission denied', 'SO22 a supervisor still reads no agent action directly (only through the function)');
SELECT tst.logout();
SELECT tst.throws($q$INSERT INTO public.admin_permission_grants (user_id, permission) VALUES ('00000000-0000-4000-8000-00000000000c', 'social.edit')$q$, 'check', 'SO23 the grant list refuses an unknown permission');

ROLLBACK;
