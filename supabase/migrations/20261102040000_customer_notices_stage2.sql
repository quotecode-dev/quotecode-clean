-- ============================================================================================================================
-- 20261102040000_customer_notices_stage2.sql  -  the welcome email and the email before the free period ends (docs/SPEC_CUSTOMER_EMAILS_2026-11-02.md, stage 2)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-02 (typed on "מיילי שלב 2: ברוכים הבאים וסיום תקופת החינם": "מאשר אבל לא לעשות עכשיו, לשים בזכרון ותעשה אחרי כל מה שאציג בפנייך").
--   * welcome: once, an account in the free plan with a verified address, registered after customer_notice_settings.live_since. No old account gets it.
--   * free_ending: once, by the same rule as Maya's signal: 24 hours left of the 7 days, or 1-2 free quotes left.
--   Never a super admin, a lifetime account, an unverified address or an unresolved market. Sent rows are left out by the same ledger as stage 1.
--   Closed to the app: service role only. ROLLBACK: UPDATE customer_notice_settings SET phase = 'off'.
-- ============================================================================================================================

ALTER TABLE public.customer_notices DROP CONSTRAINT IF EXISTS customer_notices_kind_check;
ALTER TABLE public.customer_notices ADD CONSTRAINT customer_notices_kind_check
  CHECK (kind IN ('failed_day1', 'failed_day2', 'failed_day3', 'limited', 'limited_weekly', 'welcome', 'free_ending'));

CREATE OR REPLACE FUNCTION public.customer_notice_lifecycle_facts(p_user uuid DEFAULT NULL)
RETURNS TABLE (account_id uuid, email text, market text, kind text, episode_at timestamptz, free_ends_at timestamptz, remaining integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH s AS (SELECT phase, live_since FROM public.customer_notice_settings),
  f AS (
    SELECT b.user_id AS account_id, u.email::text AS email, m.market::text AS market, u.created_at AS registered_at,
           public.free10_ends_at(b.user_id) AS free_ends_at, e.free_issue_limit - e.free_issues_consumed AS remaining
    FROM public.business_settings b
    JOIN auth.users u ON u.id = b.user_id
    JOIN public.account_entitlements e ON e.user_id = b.user_id
    JOIN public.account_market m ON m.user_id = b.user_id
    WHERE (p_user IS NULL OR b.user_id = p_user)
      AND m.market IN ('IL', 'INTERNATIONAL')
      AND m.market = public.account_market_for_country(b.country)
      AND coalesce(b.role, '') <> 'super_admin'
      AND NOT coalesce(b.is_lifetime, false)
      AND (to_jsonb(u.*) ->> 'email_confirmed_at') IS NOT NULL
      AND e.account_mode = 'free_10' AND e.subscription_status = 'none'
      AND NOT public.quote_output_unlimited(b.user_id, e.account_mode)
  ),
  due AS (
    SELECT f.account_id, f.email, f.market, 'welcome'::text AS kind, f.registered_at AS episode_at, f.free_ends_at, f.remaining
    FROM f CROSS JOIN s
    WHERE s.phase = 'live' AND f.registered_at >= s.live_since
    UNION ALL
    SELECT f.account_id, f.email, f.market, 'free_ending'::text, f.registered_at, f.free_ends_at, f.remaining
    FROM f CROSS JOIN s
    WHERE s.phase = 'live'
      AND f.free_ends_at > now() AND f.remaining > 0
      AND EXISTS (SELECT 1 FROM public.subscription_activation x WHERE x.component = 'free_issue' AND x.phase = 'enforced')
      AND (f.free_ends_at <= now() + interval '24 hours' OR f.remaining BETWEEN 1 AND 2)
  )
  SELECT d.account_id, d.email, d.market, d.kind, d.episode_at, d.free_ends_at, d.remaining
  FROM due d
  WHERE NOT EXISTS (SELECT 1 FROM public.customer_notices n WHERE n.user_id = d.account_id AND n.kind = d.kind AND n.status = 'sent')
  ORDER BY d.episode_at
  LIMIT 200;
END
$function$;
REVOKE ALL ON FUNCTION public.customer_notice_lifecycle_facts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_notice_lifecycle_facts(uuid) TO service_role;
