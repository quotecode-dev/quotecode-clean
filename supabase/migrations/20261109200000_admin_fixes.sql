-- 20261109200000_admin_fixes.sql - Owner console 2026-11-09 (typed: "מאשר את תיקוני האדמין כולל שינוי ב-L-22, שחרור עד הלייב").
-- tekango-migration-contract: mode=transaction replay=required
-- Forward-only. Bodies VERBATIM from their latest definitions; only the marked lines change:
--   1. admin_account_status: a limited paid account -> 'paid_limited', a failed last charge -> 'paid_past_due' (as the account shows it);
--   2. get_admin_dashboard_summary: counts both, and testAccounts uses the same account set as the users list (no deleted account);
--   3. get_admin_accounts: the two statuses, and p_test ('only' / 'exclude') for the plans screen's cards (the old 8-argument version is
--      replaced - every caller passes named arguments);
--   4. get_admin_account_counts: the saved quotes, clients and issued quotes of one account for the admin (the user details screen read the
--      tables directly and the owner-only row policies returned 0);
--   5. get_admin_audit_log: up to 10000 rows (was 200), so "all time" is all of it.

-- 1 -------------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_account_status(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_b      public.business_settings%ROWTYPE;
  v_ent    public.account_entitlements%ROWTYPE;
  v_out    text;
  v_period text;
BEGIN
  SELECT * INTO v_b FROM public.business_settings b WHERE b.user_id = p_user_id;
  IF v_b.is_lifetime IS TRUE THEN RETURN 'lifetime'; END IF;
  SELECT a.phase INTO v_out FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_out IS NOT NULL AND v_out <> 'prepared' THEN
    SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
    IF FOUND THEN
      -- 20261109200000 (Owner 2026-11-09): a paid account that is limited, then one whose last charge failed - as the account itself shows
      IF v_ent.account_mode = 'paid' AND public.paid_account_limited(p_user_id) THEN RETURN 'paid_limited'; END IF;
      IF v_ent.account_mode = 'paid' AND v_ent.subscription_status = 'past_due' THEN RETURN 'paid_past_due'; END IF;
      IF v_ent.subscription_status = 'active' THEN
        v_period := public.account_billing_period(p_user_id);
        RETURN CASE v_period WHEN 'year' THEN 'paid_annual' WHEN 'month' THEN 'paid_monthly' ELSE 'paid_unverified' END;
      END IF;
      IF v_ent.account_mode = 'free_10' AND v_out = 'enforced' THEN RETURN 'free10'; END IF;
    END IF;
  END IF;
  IF v_b.trial_ends_at IS NOT NULL THEN
    RETURN CASE WHEN v_b.trial_ends_at > now() THEN 'trial' ELSE 'trial_ended' END;
  END IF;
  RETURN 'free10_inactive';
END
$function$;
REVOKE ALL ON FUNCTION public.admin_account_status(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 2 -------------------------------------------------------------------------------------------------------------------------------
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
      'free10_inactive', count(*) FILTER (WHERE m.status = 'free10_inactive'),
      'paid_past_due', count(*) FILTER (WHERE m.status = 'paid_past_due'),
      'paid_limited', count(*) FILTER (WHERE m.status = 'paid_limited')),
    -- 20261109200000: the same account set as the users list (no super admin, no deleted account)
    'testAccounts', (SELECT count(*) FROM public.admin_test_accounts t JOIN public.business_settings b2 ON b2.user_id = t.user_id
                      WHERE b2.role IS DISTINCT FROM 'super_admin'
                        AND lower(coalesce(b2.email, '')) NOT LIKE 'deleted\_%'
                        AND lower(coalesce(b2.business_name, '')) <> 'deleted'),
    'planSystem', CASE WHEN v_phase IS NULL OR v_phase = 'prepared' THEN 'not_active' ELSE 'active' END,
    -- AV-09: the Free-10 counter is reported active ONLY when the quota is enforced (shadow = the API answers, nothing is counted)
    'free10Counter', CASE WHEN v_phase = 'enforced' THEN 'enforced' ELSE 'not_enforced' END)
    INTO v_res FROM m;
  RETURN v_res;
END
$function$;
REVOKE ALL ON FUNCTION public.get_admin_dashboard_summary() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_summary() TO authenticated;

-- 3 -------------------------------------------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[]);
CREATE OR REPLACE FUNCTION public.get_admin_accounts(
  p_query text DEFAULT NULL,
  p_market text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort text DEFAULT 'created_at',
  p_direction text DEFAULT 'desc',
  p_page_size integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_ids bigint[] DEFAULT NULL,
  p_test text DEFAULT NULL)
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
                                                    'trial_ended', 'free10_inactive', 'paid_past_due', 'paid_limited'))
     -- 20261109200000: 'only' = the test accounts, 'exclude' = the real ones (the plans cards), NULL = all
     OR (p_test IS NOT NULL AND p_test NOT IN ('only', 'exclude')) THEN
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
                      AND (p_test IS NULL OR (p_test = 'only') = m.is_test)
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
           'paid_annual', 'lifetime', 'free10_inactive', 'paid_unverified', 'paid_past_due', 'paid_limited'], f.status) END ASC,
         CASE WHEN p_sort = 'plan' AND p_direction = 'desc' THEN array_position(ARRAY['free10', 'trial', 'trial_ended', 'paid_monthly',
           'paid_annual', 'lifetime', 'free10_inactive', 'paid_unverified', 'paid_past_due', 'paid_limited'], f.status) END DESC,
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
REVOKE ALL ON FUNCTION public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[], text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[], text) TO authenticated;

-- 4 -------------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_account_counts(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (public.has_admin_permission('overview.view') OR public.has_admin_permission('users.view') OR public.has_admin_permission('plans.view')) THEN
    RAISE EXCEPTION 'get_admin_account_counts: super_admin required (or the matching admin permission)' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'get_admin_account_counts: invalid argument' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object(
    'schema', 'admin-account-counts/v1',
    'quotes', (SELECT count(*) FROM public.quotes q WHERE q.user_id = p_user_id),
    'clients', (SELECT count(*) FROM public.clients c WHERE c.user_id = p_user_id),
    -- the same rule the screen used: a quote whose status is not 'draft'
    'issued', (SELECT count(*) FROM public.quotes q WHERE q.user_id = p_user_id AND q.status <> 'draft'));
END
$function$;
REVOKE ALL ON FUNCTION public.get_admin_account_counts(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_account_counts(uuid) TO authenticated;

-- 5 -------------------------------------------------------------------------------------------------------------------------------
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
    LIMIT LEAST(GREATEST(p_limit, 1), 10000); -- 20261109200000: was 200
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_audit_log(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_audit_log(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log(int) TO authenticated;
