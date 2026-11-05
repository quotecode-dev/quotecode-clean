-- ============================================================================================================================
-- 20261105100000_billing_notices.sql  -  the customer's emails on every billing change (night task 2026-11-05, item 2)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-05 (typed: "מאשר בניית 10 המיילים מהטבלה במשימת הלילה, שחרור עד הלייב כשהמיילים כבויים ללקוחות עד שאאשר את
--   הנוסחים בבוקר"). The ten rows of the table: a resumed renewal (without SMART PACK / with it kept / with it left off, and adding it
--   right after - rows 1-4), SMART PACK added pro rata (rows 2 and 7), the renewal stopped (5), an early end with a refund (6), SMART
--   PACK removed (8), a week before an annual renewal (9), the first purchase (10).
--   * customer_notice_settings.billing_phase: its OWN switch for these emails - 'test' (only the marked test accounts) until the Owner
--     approves the words; 'live' also real accounts, only for an event after billing_live_since. The failed-renewal / lifecycle phase is
--     untouched.
--   * customer_notices.kind takes the seven new kinds (one email per account, kind and event - the existing claim / complete).
--   * customer_notice_billing_facts: the events of the last 3 days not sent yet (the annual reminder: a renewal 5-7 days ahead), with
--     what the words need. Never a lifetime account, a super admin or an unverified address; the market is the stored one.
--   Closed to the app: service role only. ROLLBACK: UPDATE customer_notice_settings SET billing_phase = 'off'; keep the history.
-- ============================================================================================================================

ALTER TABLE public.customer_notice_settings ADD COLUMN IF NOT EXISTS billing_phase text NOT NULL DEFAULT 'test';
ALTER TABLE public.customer_notice_settings ADD COLUMN IF NOT EXISTS billing_live_since timestamptz NULL;
ALTER TABLE public.customer_notice_settings DROP CONSTRAINT IF EXISTS customer_notice_settings_billing_phase_check;
ALTER TABLE public.customer_notice_settings ADD CONSTRAINT customer_notice_settings_billing_phase_check
  CHECK (billing_phase IN ('off', 'test', 'live') AND (billing_phase <> 'live' OR billing_live_since IS NOT NULL));

ALTER TABLE public.customer_notices DROP CONSTRAINT IF EXISTS customer_notices_kind_check;
ALTER TABLE public.customer_notices ADD CONSTRAINT customer_notices_kind_check
  CHECK (kind IN ('failed_day1', 'failed_day2', 'failed_day3', 'limited', 'limited_weekly', 'welcome', 'free_ending',
                  'renewal_resumed', 'smart_pack_added', 'renewal_stopped', 'ended_early', 'smart_pack_removed', 'annual_reminder', 'first_purchase'));

CREATE OR REPLACE FUNCTION public.customer_notice_billing_facts(p_user uuid DEFAULT NULL)
RETURNS TABLE (account_id uuid, email text, market text, kind text, episode_at timestamptz, details jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH s AS (SELECT billing_phase, billing_live_since FROM public.customer_notice_settings),
  acc AS (
    SELECT b.user_id, u.email::text AS email, m.market::text AS market,
           EXISTS (SELECT 1 FROM public.admin_test_accounts t WHERE t.user_id = b.user_id) AS is_test
    FROM public.business_settings b
    JOIN auth.users u ON u.id = b.user_id
    JOIN public.account_market m ON m.user_id = b.user_id
    WHERE (p_user IS NULL OR b.user_id = p_user)
      AND m.market IN ('IL', 'INTERNATIONAL')
      AND m.market = public.account_market_for_country(b.country)
      AND coalesce(b.role, '') <> 'super_admin'
      AND NOT coalesce(b.is_lifetime, false)
      AND (to_jsonb(u.*) ->> 'email_confirmed_at') IS NOT NULL
  ),
  ev AS (
    -- rows 1, 3, 4 (and the first email of row 2): a stopped renewal resumed - nothing charged; the first charge and its lines
    SELECT a.user_id, 'renewal_resumed'::text AS kind, e.provider_event_time AS at,
           jsonb_build_object('currency', a.currency, 'amountMinor', a.amount_minor, 'period', p.billing_period, 'firstChargeAt', a.resume_first_charge_at,
                              'smartPack', a.add_on_price_id IS NOT NULL,
                              'smartPackUntil', CASE WHEN a.add_on_price_id IS NULL AND ent.smart_pack_until > e.provider_event_time THEN ent.smart_pack_until END) AS d
    FROM public.subscription_events e
    JOIN public.checkout_attempts a ON a.attempt_id = e.attempt_id
    JOIN public.price_versions p ON p.price_id = a.plan_price_id
    LEFT JOIN public.account_entitlements ent ON ent.user_id = a.user_id
    WHERE e.event_type = 'renewal_resumed' AND e.outcome = 'applied' AND e.provider_event_time > now() - interval '3 days'
    UNION ALL
    -- rows 2 (second email) and 7: SMART PACK added pro rata - paid today, part of every charge from the period end
    SELECT sp.user_id, 'smart_pack_added', sp.paid_at,
           jsonb_build_object('currency', sp.currency, 'amountMinor', sp.amount_minor, 'period', sp.period, 'periodEnd', sp.period_end,
                              'totalMinor', a.amount_minor + pv.amount_minor)
    FROM public.smart_pack_add_ons sp
    JOIN public.checkout_attempts a ON a.attempt_id = sp.package_attempt_id
    JOIN public.price_versions pv ON pv.price_id = sp.price_id
    WHERE sp.state = 'paid' AND sp.paid_at > now() - interval '3 days'
    UNION ALL
    -- rows 5 and 6: the renewal stopped at PayPlus / an early end (with its refund), once the stop is confirmed
    SELECT x.user_id, CASE x.kind WHEN 'stop_renewal' THEN 'renewal_stopped' ELSE 'ended_early' END, r.created_at,
           jsonb_build_object('currency', x.currency, 'paidThrough', x.paid_through, 'effectiveEnd', x.effective_end, 'refundMinor', x.refund_minor)
    FROM public.billing_admin_actions x
    JOIN public.billing_admin_action_results r ON r.action_id = x.action_id
    WHERE r.applied AND r.cancel_status = 'cancelled' AND r.created_at > now() - interval '3 days'
    UNION ALL
    -- row 8: SMART PACK taken off the standing order - active to its end, a yearly one refunded pro rata
    SELECT rm.user_id, 'smart_pack_removed', rm.change_at,
           jsonb_build_object('currency', a.currency, 'effectiveAt', rm.effective_at, 'refundMinor', rm.refund_minor, 'period', rm.period)
    FROM public.smart_pack_removals rm
    JOIN public.checkout_attempts a ON a.attempt_id = rm.package_attempt_id
    WHERE rm.state = 'removed' AND rm.change_at > now() - interval '3 days'
    UNION ALL
    -- row 9: a renewing annual package, its renewal 5-7 days ahead (one reminder per period: the event is the period end)
    SELECT ent.user_id, 'annual_reminder', ent.paid_through,
           jsonb_build_object('currency', a.currency, 'amountMinor', a.amount_minor, 'renewsAt', ent.paid_through)
    FROM public.account_entitlements ent
    JOIN public.checkout_attempts a ON a.attempt_id = ent.live_attempt_id
    WHERE ent.account_mode = 'paid' AND ent.package_id = 'all_inclusive' AND ent.package_period = 'year' AND ent.subscription_status = 'active'
      AND ent.renewal_stopped_at IS NULL AND ent.payment_failed_at IS NULL
      AND ent.paid_through > now() + interval '5 days' AND ent.paid_through <= now() + interval '7 days'
    UNION ALL
    -- row 10: the account's first paid period ever
    SELECT pp.user_id, 'first_purchase', pp.created_at,
           jsonb_build_object('currency', a.currency, 'amountMinor', a.amount_minor, 'period', p.billing_period, 'paidThrough', pp.period_end,
                              'smartPack', a.add_on_price_id IS NOT NULL)
    FROM public.billing_paid_periods pp
    JOIN public.checkout_attempts a ON a.attempt_id = pp.attempt_id
    JOIN public.price_versions p ON p.price_id = a.plan_price_id
    WHERE pp.created_at > now() - interval '3 days'
      AND pp.period_id = (SELECT min(q.period_id) FROM public.billing_paid_periods q WHERE q.user_id = pp.user_id)
  )
  SELECT acc.user_id, acc.email, acc.market, ev.kind, ev.at, ev.d
  FROM ev
  JOIN acc ON acc.user_id = ev.user_id
  CROSS JOIN s
  WHERE ev.at IS NOT NULL AND s.billing_phase <> 'off'
    AND (acc.is_test OR (s.billing_phase = 'live' AND (ev.kind = 'annual_reminder' OR ev.at >= s.billing_live_since)))
    AND NOT EXISTS (SELECT 1 FROM public.customer_notices n
                     WHERE n.user_id = acc.user_id AND n.kind = ev.kind AND n.episode_at = ev.at AND n.status = 'sent')
  ORDER BY ev.at
  LIMIT 200;
END
$function$;
REVOKE ALL ON FUNCTION public.customer_notice_billing_facts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_notice_billing_facts(uuid) TO service_role;
