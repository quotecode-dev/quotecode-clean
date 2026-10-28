-- ============================================================================================================================
-- 20261028100000_admin_test_accounts.sql  -  the Owner marks a test account; it is not counted in the admin statistics
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-28, typed: "מאשר שינוי ב-L-22: כיתובים לפעולות שלא זוהו ביומן, וסימון חשבון בדיקה שלא נספר בסטטיסטיקה".
--   * admin_test_accounts: one row per account the Owner marked as a test account (who marked it, when). Closed to the app (RLS on,
--     no policy, no grant); written only by set_admin_test_account.
--   * set_admin_test_account(user, is_test): the Owner only (super admin); a super admin account cannot be marked; every real change
--     writes one admin_audit_log row (mark_test_account / unmark_test_account).
--   * get_admin_dashboard_summary(): a marked account is not counted (managed accounts, registrations, markets, plans); the number of
--     marked accounts is reported apart (testAccounts). get_admin_accounts(): every account stays listed, with is_test. Both bodies are
--     VERBATIM from 20261020200000 except these lines.
--   ROLLBACK (DB owner): both functions from 20261020200000; DROP FUNCTION public.set_admin_test_account(uuid, boolean);
--     DROP TABLE public.admin_test_accounts.

CREATE TABLE IF NOT EXISTS public.admin_test_accounts (
  user_id    uuid PRIMARY KEY,
  marked_by  uuid NOT NULL,
  marked_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_test_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_test_accounts FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_admin_test_account(p_user_id uuid, p_is_test boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_was boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'set_admin_test_account: super_admin required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_is_test IS NULL THEN
    RAISE EXCEPTION 'set_admin_test_account: invalid argument' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = p_user_id AND b.role IS DISTINCT FROM 'super_admin') THEN
    RAISE EXCEPTION 'set_admin_test_account: unknown account' USING ERRCODE = '22023';
  END IF;
  v_was := EXISTS (SELECT 1 FROM public.admin_test_accounts t WHERE t.user_id = p_user_id);
  IF p_is_test AND NOT v_was THEN
    INSERT INTO public.admin_test_accounts (user_id, marked_by) VALUES (p_user_id, v_uid) ON CONFLICT (user_id) DO NOTHING;
  ELSIF NOT p_is_test AND v_was THEN
    DELETE FROM public.admin_test_accounts WHERE user_id = p_user_id;
  END IF;
  IF p_is_test IS DISTINCT FROM v_was THEN
    INSERT INTO public.admin_audit_log (actor_user_id, target_user_id, action, reason, before_state, after_state, outcome)
      VALUES (v_uid, p_user_id, CASE WHEN p_is_test THEN 'mark_test_account' ELSE 'unmark_test_account' END, NULL,
              jsonb_build_object('is_test', v_was), jsonb_build_object('is_test', p_is_test), 'success');
  END IF;
  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'is_test', p_is_test);
END;
$$;
REVOKE ALL ON FUNCTION public.set_admin_test_account(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_admin_test_account(uuid, boolean) TO authenticated;

-- the two admin read RPCs: bodies VERBATIM from 20261020200000, only the test-account lines added

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
       -- L-22 (Owner 2026-10-28): an account the Owner marked as a test account is not counted
       AND NOT EXISTS (SELECT 1 FROM public.admin_test_accounts t WHERE t.user_id = b.user_id)
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
    'testAccounts', (SELECT count(*) FROM public.admin_test_accounts t JOIN public.business_settings b2 ON b2.user_id = t.user_id
                      WHERE b2.role IS DISTINCT FROM 'super_admin'),
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
           public.admin_market_of(b.country) AS market, public.admin_account_status(b.user_id) AS status,
           EXISTS (SELECT 1 FROM public.admin_test_accounts t WHERE t.user_id = b.user_id) AS is_test
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
            'last_sign_in', p.last_sign_in, 'status', p.status, 'is_test', p.is_test) ORDER BY p.rn) FROM page p), '[]'::jsonb)
    INTO v_total, v_rows;
  RETURN jsonb_build_object('schema', 'admin-accounts/v1', 'generatedAt', now(), 'total', v_total, 'offset', p_offset,
                            'pageSize', p_page_size, 'rows', v_rows);
END
$function$;
REVOKE ALL ON FUNCTION public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[]) TO authenticated;
