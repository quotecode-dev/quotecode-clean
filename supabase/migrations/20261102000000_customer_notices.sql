-- ============================================================================================================================
-- 20261102000000_customer_notices.sql  -  the failed-renewal emails to a customer (docs/SPEC_CUSTOMER_EMAILS_2026-11-02.md, stage 1)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-02 (typed: "מאשר בניית שלב 1: מסכי ימי החסד ומיילי החיוב שנכשל לפי ההחלטה מ-18/10, כולל שינוי ב-L-02, L-11, L-12, L-13
--   ו-L-15, עם ההמלצות בהחלטות 1, 2 ו-4, שחרור עד הלייב"); the notices themselves: task-control failedRenewalPolicy20261018.noticesDecision.
--   * customer_notices: ONE row per (account, kind, episode, sequence) - a claim before the send, the outcome after it; never two emails.
--   * customer_notice_settings: 'off' nothing is sent / 'test' only the marked test accounts / 'live' also real accounts, only for an
--     episode that began after live_since (no email about an old event). Starts at 'test'; the Owner moves it to 'live'.
--   * customer_notice_facts: the accounts in grace or limited for a failed / missing renewal. Never a stopped renewal (Owner 21/10: no
--     update-card notices after a cancellation), a lifetime account, a super admin or an unverified address; the market is the stored one.
--   Closed to the app: RLS forced, no policy, no grant to PUBLIC / anon / authenticated; the service role only.
--   ROLLBACK: UPDATE customer_notice_settings SET phase = 'off'; keep the history.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.customer_notice_settings (
  id          boolean      PRIMARY KEY DEFAULT true CHECK (id),
  phase       text         NOT NULL DEFAULT 'test' CHECK (phase IN ('off', 'test', 'live')),
  live_since  timestamptz  NULL,
  CHECK (phase <> 'live' OR live_since IS NOT NULL)
);
INSERT INTO public.customer_notice_settings (id, phase) VALUES (true, 'test') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.customer_notices (
  user_id          uuid         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind             text         NOT NULL CHECK (kind IN ('failed_day1', 'failed_day2', 'failed_day3', 'limited', 'limited_weekly')),
  episode_at       timestamptz  NOT NULL,
  seq              integer      NOT NULL DEFAULT 0 CHECK (seq >= 0),
  status           text         NOT NULL CHECK (status IN ('claimed', 'sent', 'failed', 'unknown', 'cancelled')),
  idempotency_key  text         NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9/_:.-]{8,250}$'),
  attempts         integer      NOT NULL DEFAULT 1,
  claimed_at       timestamptz  NOT NULL DEFAULT now(),
  sent_at          timestamptz  NULL,
  provider_id      text         NULL CHECK (provider_id IS NULL OR char_length(provider_id) <= 120),
  PRIMARY KEY (user_id, kind, episode_at, seq)
);

ALTER TABLE public.customer_notice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notice_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notices FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_notice_settings, public.customer_notices FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.customer_notice_settings, public.customer_notices TO service_role;

CREATE OR REPLACE FUNCTION public.customer_notice_facts(p_user uuid DEFAULT NULL)
RETURNS TABLE (account_id uuid, email text, market text, episode_at timestamptz, grace_ends_at timestamptz, limited boolean, reason text, sent jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT f.account_id, f.email, f.market, f.episode_at, (f.st ->> 'graceEndsAt')::timestamptz, (f.st ->> 'limited')::boolean,
         CASE WHEN f.past_due THEN 'payment_failed' ELSE 'period_ended' END,
         coalesce((SELECT jsonb_agg(jsonb_build_object('kind', n.kind, 'seq', n.seq)) FROM public.customer_notices n
                   WHERE n.user_id = f.account_id AND n.episode_at = f.episode_at AND n.status = 'sent'), '[]'::jsonb)
  FROM (
    SELECT b.user_id AS account_id, u.email::text AS email, m.market::text AS market, coalesce(e.payment_failed_at, e.paid_through) AS episode_at,
           public.account_billing_state(b.user_id) AS st, e.subscription_status = 'past_due' AS past_due,
           EXISTS (SELECT 1 FROM public.admin_test_accounts t WHERE t.user_id = b.user_id) AS is_test,
           s.phase, s.live_since
    FROM public.business_settings b
    JOIN auth.users u ON u.id = b.user_id
    JOIN public.account_entitlements e ON e.user_id = b.user_id
    JOIN public.account_market m ON m.user_id = b.user_id
    CROSS JOIN public.customer_notice_settings s
    WHERE (p_user IS NULL OR b.user_id = p_user)
      AND m.market IN ('IL', 'INTERNATIONAL')
      AND m.market = public.account_market_for_country(b.country)
      AND coalesce(b.role, '') <> 'super_admin'
      AND NOT coalesce(b.is_lifetime, false)
      AND (to_jsonb(u.*) ->> 'email_confirmed_at') IS NOT NULL
      AND e.account_mode = 'paid' AND e.package_id IS NOT NULL AND e.style_plan_id IS NULL
      AND e.renewal_stopped_at IS NULL
  ) f
  WHERE f.episode_at IS NOT NULL AND f.phase <> 'off'
    AND (f.is_test OR (f.phase = 'live' AND f.episode_at >= f.live_since))
    AND ((f.st ->> 'inGrace')::boolean OR ((f.st ->> 'limited')::boolean AND f.st ->> 'limitedReason' IN ('payment_failed', 'period_ended')))
    AND f.st ->> 'graceEndsAt' IS NOT NULL
  ORDER BY f.episode_at
  LIMIT 200;
END
$function$;
REVOKE ALL ON FUNCTION public.customer_notice_facts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_notice_facts(uuid) TO service_role;

-- the claim before a send (the pattern of 20260927000000): one winner; 'failed' / 'cancelled' may be claimed again with a new key; an
-- unknown outcome or a dead worker only with the SAME key while the provider still remembers it (23 hours), so a retry is never a second email
CREATE OR REPLACE FUNCTION public.customer_notice_claim(p_user uuid, p_kind text, p_episode timestamptz, p_seq integer, p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  INSERT INTO public.customer_notices AS n (user_id, kind, episode_at, seq, status, idempotency_key)
  VALUES (p_user, p_kind, p_episode, p_seq, 'claimed', p_key)
  ON CONFLICT (user_id, kind, episode_at, seq) DO UPDATE
    SET status = 'claimed', attempts = n.attempts + 1, claimed_at = now(),
        idempotency_key = CASE WHEN n.status IN ('failed', 'cancelled') THEN EXCLUDED.idempotency_key ELSE n.idempotency_key END
    WHERE n.status IN ('failed', 'cancelled')
       OR (n.status = 'unknown' AND n.claimed_at > now() - interval '23 hours')
       OR (n.status = 'claimed' AND n.claimed_at < now() - interval '10 minutes' AND n.claimed_at > now() - interval '23 hours')
  RETURNING n.idempotency_key;
$function$;
REVOKE ALL ON FUNCTION public.customer_notice_claim(uuid, text, timestamptz, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_notice_claim(uuid, text, timestamptz, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.customer_notice_complete(p_user uuid, p_kind text, p_episode timestamptz, p_seq integer, p_key text, p_outcome text, p_provider_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_rows integer;
BEGIN
  IF p_outcome NOT IN ('sent', 'failed', 'unknown', 'cancelled') THEN RETURN false; END IF;
  UPDATE public.customer_notices
     SET status = p_outcome, sent_at = CASE WHEN p_outcome = 'sent' THEN now() END, provider_id = left(p_provider_id, 120)
   WHERE user_id = p_user AND kind = p_kind AND episode_at = p_episode AND seq = p_seq AND idempotency_key = p_key AND status = 'claimed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END
$function$;
REVOKE ALL ON FUNCTION public.customer_notice_complete(uuid, text, timestamptz, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_notice_complete(uuid, text, timestamptz, integer, text, text, text) TO service_role;

-- the watcher notices a day without a completed run (the job runs every hour; the window is the UTC day)
INSERT INTO public.scheduled_jobs (job, kind, final_slot, deadline_min, label_he)
VALUES ('customer-notices', 'daily', '23:05', 45, 'מיילי החיוב שנכשל ללקוחות')
ON CONFLICT (job) DO NOTHING;
