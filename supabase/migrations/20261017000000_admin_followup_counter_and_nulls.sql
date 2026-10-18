-- ============================================================================================================================
-- 20261017000000_admin_followup_counter_and_nulls.sql  -  admin part A follow-up (Codex verification AV-09, AV-13)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-17, typed: "מאשר תיקון כל 16 הממצאים של קודקס (AV-01 עד AV-16), כולל העברה חדשה למסד ל-AV-09 ו-AV-13,
--   ותיקון AV-04 רק בהקשר האדמין" (docs/CODEX_ADMIN_VERIFY_2026-10-17.md). Read-only functions; nothing is written, no data changes,
--   no phase changes. Same signatures and grants as 20261016100000.
--   1. get_admin_dashboard_summary(): + 'free10Counter' = 'enforced' only when free_issue is enforced (AV-09: a shadow phase answers
--      the API but counts nothing - the admin never reports the counter as active there).
--   2. get_admin_accounts(...): an account without a registration / last sign-in date sorts LAST in either direction (AV-13), with
--      the same stable id tie-break; dates are no longer replaced by the epoch.
--   Re-runnable: CREATE OR REPLACE only.
-- ============================================================================================================================

-- 1. admin dashboard summary --------------------------------------------------------------------------------------------------
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
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = v_uid AND b.role = 'super_admin') THEN
    RAISE EXCEPTION 'get_admin_dashboard_summary: super_admin required' USING ERRCODE = '42501';
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

-- 2. paged admin accounts list -----------------------------------------------------------------------------------------------------
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
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = v_uid AND b.role = 'super_admin') THEN
    RAISE EXCEPTION 'get_admin_accounts: super_admin required' USING ERRCODE = '42501';
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
