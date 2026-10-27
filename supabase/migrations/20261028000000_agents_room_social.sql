-- 20261028000000_agents_room_social.sql  -  the agents room: the social media agent (stage 1)
-- tekango-migration-contract: mode=transaction replay=required
-- Owner console 2026-10-27, typed: "מאשר את שלב 1 של סוכנת הרשתות" (plan docs/SOCIAL_AGENT_PLAN_2026-10-27.md; the Owner: "בארץ בעברית
-- ובחו"ל רק באנגלית", the weekly counts "מה שאתה ממליץ"):
--   * agent_runs / agent_profiles / agent_actions.source: the social agent is a fifth agent (default name שירה / Shira, the Owner renames it).
--   * agent_actions: a new action social_post - "approve and the system does it" (kind system). In stage 1 the approval only marks the post
--     ready: the Owner copies the text, downloads the image and publishes it, then marks it published (done). Nothing is ever posted
--     automatically - no network is connected in stage 1. The post itself (network, market, text, image, link, video script) lives in
--     the action's payload; no new table.
--   * the supervisor (L-22, Owner console 2026-10-27: "מאשר את שניהם" on the two new permissions and the supervisor screen): two new
--     permission ids - social.view (the "Social media" admin screen: the posts only, never the agents room) and social.publish (approve /
--     ask for a change / not now / mark published, on social posts only). The grant list check and set_admin_permissions' known list take
--     them; set_admin_permissions' body is VERBATIM from 20261020200000 except that list. The agents-room function asks
--     has_admin_permission() AS THE CALLER for every supervisor read and action (like support-admin).
--   ROLLBACK (DB owner): DELETE FROM public.admin_permission_grants WHERE permission IN ('social.view', 'social.publish'); the grant check
--     and set_admin_permissions from 20261020200000;
--     DELETE FROM public.agent_actions WHERE source = 'social' OR action_type = 'social_post';
--     DELETE FROM public.agent_runs WHERE agent = 'social'; DELETE FROM public.agent_profiles WHERE agent = 'social'; then the four
--     checks below with the 20261027500000 lists (without 'social' / 'social_post').

ALTER TABLE public.agent_runs DROP CONSTRAINT IF EXISTS agent_runs_agent_check;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_agent_check CHECK (agent IN ('manager', 'seo', 'service', 'security', 'social'));

ALTER TABLE public.agent_profiles DROP CONSTRAINT IF EXISTS agent_profiles_agent_check;
ALTER TABLE public.agent_profiles ADD CONSTRAINT agent_profiles_agent_check CHECK (agent IN ('manager', 'seo', 'service', 'security', 'social'));
INSERT INTO public.agent_profiles (agent, name_he, name_en) VALUES ('social', 'שירה', 'Shira') ON CONFLICT (agent) DO NOTHING;

ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_source_check;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_source_check CHECK (source IN ('manager', 'seo', 'service', 'security', 'social'));

ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_action_type_check;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_action_type_check
  CHECK (action_type IN ('sitemap_submit', 'urgent_mail', 'article_draft', 'article_publish', 'claude_task', 'social_post', 'none'));

-- the kind and the action agree: a social post is never automatic - only after the Owner's approval (kind system)
ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_check;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_check
  CHECK ((kind = 'auto' AND action_type IN ('sitemap_submit', 'urgent_mail'))
      OR (kind = 'system' AND action_type IN ('article_draft', 'article_publish', 'social_post'))
      OR (kind = 'claude' AND action_type = 'claude_task')
      OR (kind = 'info' AND action_type = 'none'));

-- the supervisor's two social permissions (L-22, Owner 2026-10-27)
ALTER TABLE public.admin_permission_grants DROP CONSTRAINT IF EXISTS admin_permission_grants_permission_check;
ALTER TABLE public.admin_permission_grants ADD CONSTRAINT admin_permission_grants_permission_check
  CHECK (permission IN ('overview.view', 'users.view', 'plans.view', 'inquiries.view', 'inquiries.reply', 'inquiries.settings', 'activity.view', 'ai-support.view', 'social.view', 'social.publish'));

CREATE OR REPLACE FUNCTION public.set_admin_permissions(p_user_id uuid, p_permissions text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_known text[] := ARRAY['overview.view', 'users.view', 'plans.view', 'inquiries.view', 'inquiries.reply', 'inquiries.settings', 'activity.view', 'ai-support.view', 'social.view', 'social.publish'];
  v_new text[] := COALESCE((SELECT array_agg(DISTINCT p ORDER BY p) FROM unnest(COALESCE(p_permissions, ARRAY[]::text[])) p), ARRAY[]::text[]);
  v_before jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'set_admin_permissions: super_admin required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_user_id = v_uid THEN
    RAISE EXCEPTION 'set_admin_permissions: invalid target' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = p_user_id) THEN
    RAISE EXCEPTION 'set_admin_permissions: unknown user' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = p_user_id AND b.role = 'super_admin') THEN
    RAISE EXCEPTION 'set_admin_permissions: the target is a super admin' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_new) p WHERE NOT (p = ANY (v_known))) THEN
    RAISE EXCEPTION 'set_admin_permissions: unknown permission' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(jsonb_agg(g.permission ORDER BY g.permission), '[]'::jsonb) INTO v_before FROM public.admin_permission_grants g WHERE g.user_id = p_user_id;
  DELETE FROM public.admin_permission_grants g WHERE g.user_id = p_user_id AND NOT (g.permission = ANY (v_new));
  INSERT INTO public.admin_permission_grants (user_id, permission, granted_by)
    SELECT p_user_id, p, v_uid FROM unnest(v_new) p
    ON CONFLICT (user_id, permission) DO NOTHING;
  INSERT INTO public.admin_audit_log (actor_user_id, target_user_id, action, reason, before_state, after_state, outcome)
    VALUES (v_uid, p_user_id, 'set_admin_permissions', NULL, jsonb_build_object('permissions', v_before), jsonb_build_object('permissions', to_jsonb(v_new)), 'success');
  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'permissions', to_jsonb(v_new));
END;
$$;
