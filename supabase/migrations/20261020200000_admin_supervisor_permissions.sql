-- ============================================================================================================================
-- 20261020200000_admin_supervisor_permissions.sql  -  the supervisor ("מפקח"): the Owner grants an existing user modular admin
-- permissions (one per admin screen / action); every server read path of those screens accepts the matching permission
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: צמצום תפריט הניהול לשני כפתורים ומסך מרכזי, ומשתמש מפקח עם מסך הרשאות מנהל"
--   (spec docs/ADMIN_SUPERVISOR_AND_NAV_SPEC_2026-10-20.md).
--   * admin_permission_grants: one row per (user, permission); written ONLY by set_admin_permissions() (super admin); a user reads their
--     own rows, a super admin reads all.
--   * has_admin_permission(p): super admin -> always true; otherwise a matching grant. get_my_admin_permissions(): what the caller holds.
--   * set_admin_permissions(target, permissions[]): super admin only; never for a super admin target or the caller; only the known
--     permission ids; replaces the target's set and writes ONE admin_audit_log row (before / after).
--   * list_admin_permission_holders(): super admin only - everyone holding at least one permission.
--   * Read paths opened to the matching permission (READ ONLY - every protected action stays super admin only in its Edge Function:
--     delete account, lifetime grant / revoke, trial extension, quote cleanup, appointing supervisors):
--       get_admin_dashboard_summary / get_admin_accounts: overview.view | users.view | plans.view (bodies VERBATIM from 20261017000000,
--       only the guard changed); get_admin_audit_log: activity.view | overview.view (VERBATIM from 20261016000200, guard changed);
--       business_settings SELECT: overview.view | users.view | plans.view; chat_logs SELECT: ai-support.view;
--       support_inbound_messages / support_assistant_settings SELECT: inquiries.view.
-- Rollback of THIS file: DROP the four new functions and admin_permission_grants; DROP the four new policies; re-apply the three RPC
--   bodies from 20261017000000 / 20261016000200.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.admin_permission_grants (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text        NOT NULL CHECK (permission IN ('overview.view', 'users.view', 'plans.view', 'inquiries.view', 'inquiries.reply', 'inquiries.settings', 'activity.view', 'ai-support.view')),
  granted_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (user_id, permission)
);
COMMENT ON TABLE public.admin_permission_grants IS
  'Owner 2026-10-20: the supervisor permissions - one row per (user, admin permission); written only by set_admin_permissions() (super admin).';
ALTER TABLE public.admin_permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permission_grants FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_permission_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_permission_grants TO authenticated;
DROP POLICY IF EXISTS admin_permission_grants_read ON public.admin_permission_grants;
CREATE POLICY admin_permission_grants_read ON public.admin_permission_grants
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.has_admin_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_super_admin()
      OR EXISTS (SELECT 1 FROM public.admin_permission_grants g WHERE g.user_id = auth.uid() AND g.permission = p_permission);
$$;
REVOKE ALL ON FUNCTION public.has_admin_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_admin_permissions()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'owner', public.is_super_admin(),
    'permissions', COALESCE((SELECT jsonb_agg(g.permission ORDER BY g.permission) FROM public.admin_permission_grants g WHERE g.user_id = auth.uid()), '[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.get_my_admin_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_admin_permissions() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_admin_permissions(p_user_id uuid, p_permissions text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_known text[] := ARRAY['overview.view', 'users.view', 'plans.view', 'inquiries.view', 'inquiries.reply', 'inquiries.settings', 'activity.view', 'ai-support.view'];
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
REVOKE ALL ON FUNCTION public.set_admin_permissions(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_admin_permissions(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_admin_permission_holders()
RETURNS TABLE (user_id uuid, email text, business_name text, permissions text[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'list_admin_permission_holders: super_admin required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT g.user_id, b.email::text, b.business_name::text, array_agg(g.permission ORDER BY g.permission)
      FROM public.admin_permission_grants g
      LEFT JOIN public.business_settings b ON b.user_id = g.user_id
     GROUP BY g.user_id, b.email, b.business_name
     ORDER BY b.email;
END;
$$;
REVOKE ALL ON FUNCTION public.list_admin_permission_holders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_permission_holders() TO authenticated;

-- read paths of the admin screens: the matching permission (super admin keeps every existing policy)
DROP POLICY IF EXISTS business_settings_admin_permission_read ON public.business_settings;
CREATE POLICY business_settings_admin_permission_read ON public.business_settings
  FOR SELECT TO authenticated USING (public.has_admin_permission('overview.view') OR public.has_admin_permission('users.view') OR public.has_admin_permission('plans.view'));
DROP POLICY IF EXISTS chat_logs_admin_permission_read ON public.chat_logs;
CREATE POLICY chat_logs_admin_permission_read ON public.chat_logs
  FOR SELECT TO authenticated USING (public.has_admin_permission('ai-support.view'));
DROP POLICY IF EXISTS support_inbound_messages_admin_permission_read ON public.support_inbound_messages;
CREATE POLICY support_inbound_messages_admin_permission_read ON public.support_inbound_messages
  FOR SELECT TO authenticated USING (public.has_admin_permission('inquiries.view'));
DROP POLICY IF EXISTS support_assistant_settings_admin_permission_read ON public.support_assistant_settings;
CREATE POLICY support_assistant_settings_admin_permission_read ON public.support_assistant_settings
  FOR SELECT TO authenticated USING (public.has_admin_permission('inquiries.view'));

-- the three admin read RPCs: bodies VERBATIM from their latest migration, only the access guard changed

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_phase text;
  v_res   jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_admin_permission('overview.view') OR public.has_admin_permission('users.view') OR public.has_admin_permission('plans.view')) THEN
    RAISE EXCEPTION 'get_admin_dashboard_summary: super_admin required (or the matching admin permission)' USING ERRCODE = '42501';
  END IF;
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue';
  WITH m AS (
    SELECT b.created_at, b.last_sign_in, public.admin_market_of(b.country) AS market, public.admin_account_status(b.user_id) AS status
      FROM public.business_settings b
     WHERE b.role IS DISTINCT FROM 'super_admin'
       AND lower(coalesce(b.email, '')) NOT LIKE 'deleted\_%'
       AND lower(coalesce(b.business_name, '')) <> 'deleted'
  )
  SELECT jsonb_build_object(
    'schema', 'admin-dashboard-summary/v1',
    'generatedAt', now(),
    'managedAccounts', count(*),
    'registrationsLast24h', count(*) FILTER (WHERE m.created_at > now() - interval '24 hours' AND m.created_at <= now()),
    'signedInLast10m', count(*) FILTER (WHERE m.last_sign_in >= now() - interval '10 minutes' AND m.last_sign_in <= now()),
    'market', jsonb_build_object(
      'Local', count(*) FILTER (WHERE m.market = 'Local'),
      'International', count(*) FILTER (WHERE m.market = 'International'),
      'Unknown', count(*) FILTER (WHERE m.market = 'Unknown')),
    'subscriptionStatus', jsonb_build_object(
      'lifetime', count(*) FILTER (WHERE m.status = 'lifetime'),
      'paid_annual', count(*) FILTER (WHERE m.status = 'paid_annual'),
      'paid_monthly', count(*) FILTER (WHERE m.status = 'paid_monthly'),
      'paid_unverified', count(*) FILTER (WHERE m.status = 'paid_unverified'),
      'free10', count(*) FILTER (WHERE m.status = 'free10'),
      'trial', count(*) FILTER (WHERE m.status = 'trial'),
      'trial_ended', count(*) FILTER (WHERE m.status = 'trial_ended'),
      'free10_inactive', count(*) FILTER (WHERE m.status = 'free10_inactive')),
    'planSystem', CASE WHEN v_phase IS NULL OR v_phase = 'prepared' THEN 'not_active' ELSE 'active' END,
    -- AV-09: the Free-10 counter is reported active ONLY when the quota is enforced (shadow = the API answers, nothing is counted)
    'free10Counter', CASE WHEN v_phase = 'enforced' THEN 'enforced' ELSE 'not_enforced' END)
    INTO v_res FROM m;
  RETURN v_res;
END
$function$;
REVOKE ALL ON FUNCTION public.get_admin_dashboard_summary() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_accounts(
  p_query text DEFAULT NULL,
  p_market text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort text DEFAULT 'created_at',
  p_direction text DEFAULT 'desc',
  p_page_size integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_ids bigint[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_query text := nullif(lower(regexp_replace(coalesce(p_query, ''), '^\s+|\s+$', '', 'g')), '');
  v_total bigint;
  v_rows  jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (public.has_admin_permission('overview.view') OR public.has_admin_permission('users.view') OR public.has_admin_permission('plans.view')) THEN
    RAISE EXCEPTION 'get_admin_accounts: super_admin required (or the matching admin permission)' USING ERRCODE = '42501';
  END IF;
  IF p_sort IS NULL OR p_sort NOT IN ('created_at', 'last_sign_in', 'business_name', 'country', 'plan', 'indicators')
     OR p_direction IS NULL OR p_direction NOT IN ('asc', 'desc')
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 OR p_offset IS NULL OR p_offset < 0
     OR (p_market IS NOT NULL AND p_market NOT IN ('Local', 'International', 'Unknown'))
     OR (p_status IS NOT NULL AND p_status NOT IN ('lifetime', 'paid_annual', 'paid_monthly', 'paid_unverified', 'free10', 'trial',
                                                    'trial_ended', 'free10_inactive')) THEN
    RAISE EXCEPTION 'get_admin_accounts: invalid argument' USING ERRCODE = '22023';
  END IF;
  WITH m AS (
    SELECT b.id, b.user_id, b.business_name, b.email, b.phone, b.address, b.tax_id, b.country, b.currency, b.role, b.is_lifetime,
           b.trial_ends_at, b.created_at, b.last_sign_in,
           public.admin_market_of(b.country) AS market, public.admin_account_status(b.user_id) AS status
      FROM public.business_settings b
     WHERE b.role IS DISTINCT FROM 'super_admin'
       AND lower(coalesce(b.email, '')) NOT LIKE 'deleted\_%'
       AND lower(coalesce(b.business_name, '')) <> 'deleted'
       AND (p_ids IS NULL OR b.id = ANY (p_ids))
       AND (v_query IS NULL OR position(v_query IN lower(coalesce(b.business_name, '') || ' ' || coalesce(b.email, ''))) > 0)
  ), f AS (
    SELECT * FROM m WHERE (p_market IS NULL OR m.market = p_market) AND (p_status IS NULL OR m.status = p_status)
  ), ranked AS (
    SELECT f.*, row_number() OVER (ORDER BY
       CASE WHEN p_sort = 'created_at' AND p_direction = 'asc' THEN f.created_at END ASC NULLS LAST,
         CASE WHEN p_sort = 'created_at' AND p_direction = 'desc' THEN f.created_at END DESC NULLS LAST,
         CASE WHEN p_sort = 'last_sign_in' AND p_direction = 'asc' THEN f.last_sign_in END ASC NULLS LAST,
         CASE WHEN p_sort = 'last_sign_in' AND p_direction = 'desc' THEN f.last_sign_in END DESC NULLS LAST,
         CASE WHEN p_sort = 'business_name' AND p_direction = 'asc' THEN lower(coalesce(f.business_name, '')) END ASC,
         CASE WHEN p_sort = 'business_name' AND p_direction = 'desc' THEN lower(coalesce(f.business_name, '')) END DESC,
         CASE WHEN p_sort = 'country' AND p_direction = 'asc' THEN coalesce(f.country, 'Local') END ASC,
         CASE WHEN p_sort = 'country' AND p_direction = 'desc' THEN coalesce(f.country, 'Local') END DESC,
         -- plan: the shared status order (src/domain/subscriptions/subscriptionStatus.js ACCOUNT_STATUS_ORDER)
         CASE WHEN p_sort = 'plan' AND p_direction = 'asc' THEN array_position(ARRAY['free10', 'trial', 'trial_ended', 'paid_monthly',
           'paid_annual', 'lifetime', 'free10_inactive', 'paid_unverified'], f.status) END ASC,
         CASE WHEN p_sort = 'plan' AND p_direction = 'desc' THEN array_position(ARRAY['free10', 'trial', 'trial_ended', 'paid_monthly',
           'paid_annual', 'lifetime', 'free10_inactive', 'paid_unverified'], f.status) END DESC,
         -- indicators: the shown indicator group (verified, usage not verified, legacy trial, legacy trial ended, payment unverified, none)
         CASE WHEN p_sort = 'indicators' AND p_direction = 'asc' THEN CASE f.status WHEN 'free10' THEN 0 WHEN 'paid_monthly' THEN 0
           WHEN 'paid_annual' THEN 0 WHEN 'free10_inactive' THEN 1 WHEN 'trial' THEN 2 WHEN 'trial_ended' THEN 3
           WHEN 'paid_unverified' THEN 4 ELSE 5 END END ASC,
         CASE WHEN p_sort = 'indicators' AND p_direction = 'desc' THEN CASE f.status WHEN 'free10' THEN 0 WHEN 'paid_monthly' THEN 0
           WHEN 'paid_annual' THEN 0 WHEN 'free10_inactive' THEN 1 WHEN 'trial' THEN 2 WHEN 'trial_ended' THEN 3
           WHEN 'paid_unverified' THEN 4 ELSE 5 END END DESC,
         f.id DESC) AS rn
      FROM f
  ), page AS (
    SELECT * FROM ranked WHERE rn > p_offset AND rn <= p_offset + p_page_size
  )
  SELECT (SELECT count(*) FROM f),
         coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id', p.id, 'user_id', p.user_id, 'business_name', p.business_name, 'email', p.email, 'phone', p.phone,
            'address', p.address, 'tax_id', p.tax_id, 'country', p.country, 'market', p.market, 'currency', p.currency,
            'role', p.role, 'is_lifetime', p.is_lifetime, 'trial_ends_at', p.trial_ends_at, 'created_at', p.created_at,
            'last_sign_in', p.last_sign_in, 'status', p.status) ORDER BY p.rn) FROM page p), '[]'::jsonb)
    INTO v_total, v_rows;
  RETURN jsonb_build_object('schema', 'admin-accounts/v1', 'generatedAt', now(), 'total', v_total, 'offset', p_offset,
                            'pageSize', p_page_size, 'rows', v_rows);
END
$function$;
REVOKE ALL ON FUNCTION public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_audit_log(p_limit int DEFAULT 50)
RETURNS SETOF public.admin_audit_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_admin_permission('activity.view') OR public.has_admin_permission('overview.view')) THEN
    RAISE EXCEPTION 'Forbidden: super_admin role required (or the matching admin permission)';
  END IF;
  RETURN QUERY
    SELECT * FROM public.admin_audit_log
    ORDER BY created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_audit_log(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_audit_log(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log(int) TO authenticated;
