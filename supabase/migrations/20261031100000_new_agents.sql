-- ============================================================================================================================
-- 20261031100000_new_agents.sql  -  Codex release 9 (topics 9-11): Maya (Customer Success), Omer (the daily LIVE check), the manager chain
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-30 (typed: "אשר עבודה רצופה מעכשיו: ... ו-9 ... כולל שינוי ב-L-22, L-23, L-26, L-12, L-15 ו-L-17, L-13 רק לחסימת
--   הנמען של חשבונות הבדיקה בשחרור 9 ..."; "מאשר את השמות מאיה ועומר לסוכנים החדשים"; "מאשר לעומר פתח כניסה מיוחד בשרת, רק לשני חשבונות
--   הבדיקה ..."; decisions 15-21 as recommended); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md sections 9, 10, 11.
--   * Two new roles: customer_success (מאיה / Maya) and live_check (עומר / Omer) - runs, profiles, actions; a new system action
--     'outreach_draft' (Maya's message waits for the Owner's approval of that exact text and recipient).
--   * account_outreach_preferences: the account owner's OWN optional-help consent (default off, no retrospective consent), its version,
--     time and provenance; withdrawal any time (signed in, or by any email's unsubscribe token - one per email, only its hash is stored).
--   * outreach_suppression: a withdrawn address stays suppressed by its hash (also after an account is deleted - never the address itself).
--   * customer_success_cases: ONE case per account and signal for the account's LIFETIME (the unique key wins races; a rejected or
--     unknown case never reopens by itself).
--   * customer_success_signals(): the five signals of the spec, exactly, for real accounts only (never a test account of the admin
--     registry, never an unverified address, never an unresolved market); each with its consent / suppression state. Service only.
--   * agent_chains: the manager's "run now" as a durable job (one step per call, its own record of each agent's result; never an email).
--   Closed to the app except the owner's own preference RPCs and the token-bound withdrawal.
--   ROLLBACK: stop the drafts / the chain (no code calls them); keep cases, preferences, suppressions and history.
-- ============================================================================================================================

ALTER TABLE public.agent_runs DROP CONSTRAINT IF EXISTS agent_runs_agent_check;
ALTER TABLE public.agent_runs ADD CONSTRAINT agent_runs_agent_check CHECK (agent IN ('manager', 'seo', 'service', 'security', 'social', 'customer_success', 'live_check'));
ALTER TABLE public.agent_profiles DROP CONSTRAINT IF EXISTS agent_profiles_agent_check;
ALTER TABLE public.agent_profiles ADD CONSTRAINT agent_profiles_agent_check CHECK (agent IN ('manager', 'seo', 'service', 'security', 'social', 'customer_success', 'live_check'));
INSERT INTO public.agent_profiles (agent, name_he, name_en) VALUES ('customer_success', 'מאיה', 'Maya'), ('live_check', 'עומר', 'Omer') ON CONFLICT (agent) DO NOTHING;
ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_source_check;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_source_check CHECK (source IN ('manager', 'seo', 'service', 'security', 'social', 'customer_success', 'live_check'));
ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_action_type_check;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_action_type_check
  CHECK (action_type IN ('sitemap_submit', 'urgent_mail', 'article_draft', 'article_publish', 'claude_task', 'social_post', 'social_reply', 'outreach_draft', 'none'));
ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_check;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_check
  CHECK ((kind = 'auto' AND action_type IN ('sitemap_submit', 'urgent_mail'))
      OR (kind = 'system' AND action_type IN ('article_draft', 'article_publish', 'social_post', 'social_reply', 'outreach_draft'))
      OR (kind = 'claude' AND action_type = 'claude_task')
      OR (kind = 'info' AND action_type = 'none'));

-- ---------------------------------------------------------------------------------------------------- consent and suppression
CREATE TABLE IF NOT EXISTS public.account_outreach_preferences (
  user_id                uuid         PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  optional_help          boolean      NOT NULL DEFAULT false,
  version                text         NOT NULL DEFAULT '2026-10-30' CHECK (char_length(version) <= 20),
  provenance             text         NOT NULL DEFAULT 'settings' CHECK (provenance IN ('settings', 'unsubscribe_link')),
  updated_at             timestamptz  NOT NULL DEFAULT now()
);
-- one unsubscribe token per sent email (only its hash), never overwritten - the link in EVERY earlier email keeps working (review 30/10)
CREATE TABLE IF NOT EXISTS public.outreach_unsubscribe_tokens (
  token_hash  text         PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id     uuid         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.outreach_suppression (
  email_hash  text         PRIMARY KEY CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.customer_success_cases (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  signal_code  text         NOT NULL CHECK (signal_code IN ('no_quote_onboarding', 'free_ending', 'quote_awaiting_response', 'renewal_failed_grace', 'paid_inactive')),
  evidence     jsonb        NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object' AND pg_column_size(evidence) < 4096),
  status       text         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'rejected', 'stale', 'failed', 'unknown')),
  action_id    uuid         REFERENCES public.agent_actions (id),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id, signal_code)
);
CREATE TABLE IF NOT EXISTS public.agent_chains (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  hour_key     text         NOT NULL UNIQUE CHECK (char_length(hour_key) <= 40),
  origin       text         NOT NULL DEFAULT 'manual_manager_chain' CHECK (origin = 'manual_manager_chain'),
  allow_email  boolean      NOT NULL DEFAULT false CHECK (allow_email = false),
  status       text         NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  steps        jsonb        NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(steps) = 'array'),
  lease_until  timestamptz,
  created_by   uuid         NOT NULL,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  finished_at  timestamptz
);

ALTER TABLE public.account_outreach_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_outreach_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_unsubscribe_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_suppression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_suppression FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_success_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_success_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_chains FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_outreach_preferences, public.outreach_unsubscribe_tokens, public.outreach_suppression, public.customer_success_cases, public.agent_chains FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.account_outreach_preferences, public.outreach_suppression TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_success_cases, public.agent_chains TO service_role;

CREATE OR REPLACE FUNCTION public.outreach_email_hash(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$ SELECT encode(sha256(convert_to(lower(btrim(coalesce(p_email, ''))), 'UTF8')), 'hex'); $function$;
REVOKE ALL ON FUNCTION public.outreach_email_hash(text) FROM PUBLIC, anon, authenticated;

-- the signed-in owner's own preference (never another account's)
CREATE OR REPLACE FUNCTION public.account_outreach_get()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object('optionalHelp', coalesce((SELECT optional_help FROM public.account_outreach_preferences WHERE user_id = auth.uid()), false));
$function$;
REVOKE ALL ON FUNCTION public.account_outreach_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_outreach_get() TO authenticated;

CREATE OR REPLACE FUNCTION public.account_outreach_set(p_optional_help boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_optional_help IS NULL THEN RAISE EXCEPTION 'outreach_invalid' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.account_outreach_preferences (user_id, optional_help, provenance, updated_at) VALUES (v_uid, p_optional_help, 'settings', now())
  ON CONFLICT (user_id) DO UPDATE SET optional_help = EXCLUDED.optional_help, provenance = 'settings', version = '2026-10-30', updated_at = now();
  IF p_optional_help THEN
    -- a new opt-in lifts an earlier suppression of the owner's own verified address
    DELETE FROM public.outreach_suppression WHERE email_hash = public.outreach_email_hash((SELECT email FROM auth.users WHERE id = v_uid));
  ELSE
    -- withdrawal: queued optional drafts of this account become stale at once
    UPDATE public.customer_success_cases SET status = 'stale', updated_at = now() WHERE user_id = v_uid AND status = 'draft';
  END IF;
  RETURN jsonb_build_object('optionalHelp', p_optional_help);
END
$function$;
REVOKE ALL ON FUNCTION public.account_outreach_set(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_outreach_set(boolean) TO authenticated;

-- the send claim (review 30/10): consent, suppression and draft -> sending in ONE statement - a withdrawal a moment before wins
CREATE OR REPLACE FUNCTION public.customer_success_claim(p_case uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH c AS (
    UPDATE public.customer_success_cases k SET status = 'sending', updated_at = now()
     WHERE k.id = p_case AND k.status = 'draft'
       AND EXISTS (SELECT 1 FROM public.account_outreach_preferences p WHERE p.user_id = k.user_id AND p.optional_help)
       AND NOT EXISTS (SELECT 1 FROM public.outreach_suppression x JOIN auth.users u ON x.email_hash = public.outreach_email_hash(u.email) WHERE u.id = k.user_id)
    RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM c);
$function$;
REVOKE ALL ON FUNCTION public.customer_success_claim(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_success_claim(uuid) TO service_role;

-- the unsubscribe link: a fresh random token per send (only its hash is stored), only while the owner is opted in; service only
CREATE OR REPLACE FUNCTION public.outreach_issue_token(p_user uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.account_outreach_preferences WHERE user_id = p_user AND optional_help) THEN RETURN NULL; END IF;
  INSERT INTO public.outreach_unsubscribe_tokens (token_hash, user_id) VALUES (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_user);
  RETURN v_token;
END
$function$;
REVOKE ALL ON FUNCTION public.outreach_issue_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_issue_token(uuid) TO service_role;

-- the token-bound withdrawal: only withdraws its own purpose; the same answer whatever the token (no account enumeration)
CREATE OR REPLACE FUNCTION public.outreach_unsubscribe(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_uid uuid;
BEGIN
  IF coalesce(p_token, '') !~ '^[0-9a-f]{64}$' THEN RETURN true; END IF;
  DELETE FROM public.outreach_unsubscribe_tokens WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') RETURNING user_id INTO v_uid;
  IF v_uid IS NOT NULL THEN
    UPDATE public.account_outreach_preferences SET optional_help = false, provenance = 'unsubscribe_link', updated_at = now() WHERE user_id = v_uid;
    DELETE FROM public.outreach_unsubscribe_tokens WHERE user_id = v_uid; -- every link of this owner is spent with the withdrawal
    INSERT INTO public.outreach_suppression (email_hash) SELECT public.outreach_email_hash(email) FROM auth.users WHERE id = v_uid ON CONFLICT DO NOTHING;
    UPDATE public.customer_success_cases SET status = 'stale', updated_at = now() WHERE user_id = v_uid AND status = 'draft';
  END IF;
  RETURN true;
END
$function$;
REVOKE ALL ON FUNCTION public.outreach_unsubscribe(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.outreach_unsubscribe(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------------------------------- Maya's five signals (spec section 9)
CREATE OR REPLACE FUNCTION public.customer_success_signals(p_user uuid DEFAULT NULL)
RETURNS TABLE (account_id uuid, signal_code text, evidence jsonb, market text, email text, consent boolean, suppressed boolean, has_case boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  WITH clock AS (SELECT now() AS checked_at),
  facts AS (
   SELECT b.user_id AS account_id, u.created_at AS registered_at, b.last_sign_in AS last_recorded_app_entry, b.country,
          coalesce(b.is_lifetime, false) AS is_lifetime, m.market::text AS market, u.email::text AS email,
          (to_jsonb(u.*) ->> 'email_confirmed_at') IS NOT NULL AS verified,
          e.account_mode, e.subscription_status, e.package_id, e.style_plan_id, e.free_issue_limit, e.free_issues_consumed,
          e.free_issue_limit - e.free_issues_consumed AS remaining, e.paid_through, e.payment_failed_at, e.renewal_stopped_at,
          public.quote_output_unlimited(b.user_id, e.account_mode) AS unlimited,
          public.free10_ends_at(b.user_id) AS free_ends_at,
          public.account_billing_state(b.user_id) AS billing,
          greatest(b.last_sign_in,
            (SELECT max(q.created_at) FROM public.quotes q WHERE q.user_id = b.user_id),
            (SELECT max(s.created_at) FROM public.quote_save_counts s WHERE s.user_id = b.user_id),
            (SELECT max(l.created_at) FROM public.quote_issue_ledger l WHERE l.user_id = b.user_id)) AS last_activity_evidence,
          c.checked_at
   FROM public.business_settings b
   JOIN auth.users u ON u.id = b.user_id
   JOIN public.account_entitlements e ON e.user_id = b.user_id
   JOIN public.account_market m ON m.user_id = b.user_id
   CROSS JOIN clock c
   WHERE (p_user IS NULL OR b.user_id = p_user)
     AND m.market IN ('IL', 'INTERNATIONAL')
     AND m.market = public.account_market_for_country(b.country)
     AND coalesce(b.role, '') <> 'super_admin'
     AND NOT EXISTS (SELECT 1 FROM public.admin_test_accounts t WHERE t.user_id = b.user_id)
  ),
  awaiting AS (
   SELECT f.account_id, q.id AS quote_id, lower(coalesce(q.status, '')) AS quote_status, q.first_viewed_at, coalesce(q.view_count, 0) AS view_count,
          max(a.finalized_at) AS last_qualifying_output_at, f.checked_at
   FROM facts f
   JOIN public.quotes q ON q.user_id = f.account_id
   JOIN public.quote_issue_ledger l ON l.user_id = q.user_id AND l.quote_id = q.id
   JOIN public.quote_output_attempts a ON a.attempt_id = l.attempt_id AND a.user_id = q.user_id AND a.quote_id = q.id
   WHERE lower(coalesce(q.status, '')) IN ('sent', 'viewed') AND coalesce(q.signature, '') = ''
     AND NOT public.quote_acceptance_expired(q.valid_until, f.country, f.checked_at)
     AND l.first_output_channel IN ('send', 'public_share') AND a.state = 'finalized' AND a.finalized_at IS NOT NULL AND a.snapshot_deleted_at IS NULL
   GROUP BY f.account_id, q.id, q.status, q.first_viewed_at, q.view_count, f.checked_at
   HAVING max(a.finalized_at) <= f.checked_at - interval '72 hours'
  ),
  signals AS (
   SELECT f.account_id, 'no_quote_onboarding'::text AS signal_code, jsonb_build_object('registeredAt', f.registered_at, 'asOf', f.checked_at) AS evidence
   FROM facts f
   WHERE f.registered_at BETWEEN f.checked_at - interval '7 days' AND f.checked_at - interval '48 hours'
     AND f.free_issues_consumed = 0
     AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.user_id = f.account_id)
     AND NOT EXISTS (SELECT 1 FROM public.quote_save_counts s WHERE s.user_id = f.account_id)
     AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = f.account_id)
   UNION ALL
   SELECT f.account_id, 'free_ending', jsonb_build_object('remaining', f.remaining, 'endsAt', f.free_ends_at, 'asOf', f.checked_at)
   FROM facts f
   WHERE f.account_mode = 'free_10' AND f.subscription_status = 'none' AND NOT f.unlimited AND NOT f.is_lifetime
     AND f.free_ends_at > f.checked_at AND f.remaining > 0
     AND EXISTS (SELECT 1 FROM public.subscription_activation x WHERE x.component = 'free_issue' AND x.phase = 'enforced')
     AND (f.free_ends_at <= f.checked_at + interval '24 hours' OR f.remaining BETWEEN 1 AND 2)
   UNION ALL
   SELECT w.account_id, 'quote_awaiting_response', jsonb_build_object('quotes', count(*), 'lastQualifyingOutputAt', max(w.last_qualifying_output_at), 'asOf', max(w.checked_at))
   FROM awaiting w
   WHERE (w.quote_status = 'sent' AND w.first_viewed_at IS NULL AND w.view_count = 0) OR w.first_viewed_at <= w.checked_at - interval '72 hours'
   GROUP BY w.account_id
   UNION ALL
   SELECT f.account_id, 'renewal_failed_grace', jsonb_build_object('paymentFailedAt', f.payment_failed_at, 'graceEndsAt', f.billing ->> 'graceEndsAt', 'asOf', f.checked_at)
   FROM facts f
   WHERE f.account_mode = 'paid' AND f.package_id IS NOT NULL AND f.style_plan_id IS NULL AND f.subscription_status = 'past_due'
     AND f.payment_failed_at IS NOT NULL AND f.payment_failed_at <= f.checked_at AND f.renewal_stopped_at IS NULL AND NOT f.is_lifetime
     AND f.billing @> '{"inGrace":true,"limited":false,"renewalStopped":false}'::jsonb
   UNION ALL
   SELECT f.account_id, 'paid_inactive', jsonb_build_object('lastRecordedAppEntry', f.last_recorded_app_entry, 'asOf', f.checked_at)
   FROM facts f
   WHERE f.account_mode = 'paid' AND f.package_id IS NOT NULL AND f.style_plan_id IS NULL AND f.subscription_status = 'active'
     AND f.paid_through > f.checked_at AND f.renewal_stopped_at IS NULL AND NOT f.is_lifetime
     AND f.registered_at <= f.checked_at - interval '14 days' AND f.last_recorded_app_entry IS NOT NULL
     AND f.last_activity_evidence <= f.checked_at - interval '14 days'
     AND f.billing @> '{"inGrace":false,"limited":false,"renewalStopped":false}'::jsonb
  )
  SELECT s.account_id, s.signal_code, s.evidence, f.market, f.email,
         coalesce((SELECT p.optional_help FROM public.account_outreach_preferences p WHERE p.user_id = s.account_id), false),
         EXISTS (SELECT 1 FROM public.outreach_suppression x WHERE x.email_hash = public.outreach_email_hash(f.email)),
         EXISTS (SELECT 1 FROM public.customer_success_cases k WHERE k.user_id = s.account_id AND k.signal_code = s.signal_code)
  FROM signals s JOIN facts f ON f.account_id = s.account_id
  WHERE f.verified AND f.email IS NOT NULL;
END
$function$;
REVOKE ALL ON FUNCTION public.customer_success_signals(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_success_signals(uuid) TO service_role;

-- ---------------------------------------------------------------------------------------------------- Omer (spec section 10)
-- the two synthetic personas, mapped by exact account id (never an email pattern or a browser flag); each must ALSO be one of the
-- Owner's marked test accounts. recipient = the persona's dedicated test mailbox (the only address its quotes may be emailed to).
CREATE TABLE IF NOT EXISTS public.live_check_personas (
  persona    text         PRIMARY KEY CHECK (persona IN ('il', 'intl')),
  user_id    uuid         NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient  text         NOT NULL CHECK (recipient = lower(btrim(recipient)) AND recipient ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  created_at timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE public.live_check_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_check_personas FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.live_check_personas FROM PUBLIC, anon, authenticated, service_role;

-- the persona's account (id + sign-in address) only while it is registered AND marked as a test account, and never a super admin or a
-- supervisor (no admin session can come out of this door); service only
CREATE OR REPLACE FUNCTION public.live_check_persona(p_persona text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object('userId', p.user_id, 'email', u.email::text)
  FROM public.live_check_personas p
  JOIN auth.users u ON u.id = p.user_id
  JOIN public.admin_test_accounts t ON t.user_id = p.user_id
  WHERE p.persona = p_persona
    AND NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = p.user_id AND b.role = 'super_admin')
    AND NOT EXISTS (SELECT 1 FROM public.admin_permission_grants g WHERE g.user_id = p.user_id);
$function$;
REVOKE ALL ON FUNCTION public.live_check_persona(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_check_persona(text) TO service_role;

-- L-13, the narrow refusal (Owner 2026-10-30): a registered persona emails a quote ONLY to its own test mailbox; any other account = true
CREATE OR REPLACE FUNCTION public.live_check_recipient_allowed(p_user uuid, p_recipient text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT NOT EXISTS (SELECT 1 FROM public.live_check_personas p WHERE p.user_id = p_user AND p.recipient IS DISTINCT FROM lower(btrim(coalesce(p_recipient, ''))));
$function$;
REVOKE ALL ON FUNCTION public.live_check_recipient_allowed(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_check_recipient_allowed(uuid, text) TO service_role;

-- the release 7 watcher also expects the daily LIVE check (GitHub 05:17 UTC; a dropped schedule is a coverage problem, said once)
INSERT INTO public.scheduled_jobs (job, kind, final_slot, deadline_min, label_he, enabled_from)
VALUES ('live-check', 'daily', '05:17', 60, 'בדיקת ה-LIVE היומית של עומר', now() + interval '1 day')
ON CONFLICT (job) DO NOTHING;

-- ---------------------------------------------------------------------------------------------------- the manager chain (spec section 11)
-- per agent: the latest completed report, the latest terminal attempt and a live run (one indexed read each - not the global history)
CREATE OR REPLACE FUNCTION public.agents_latest_runs()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_object_agg(a.agent, jsonb_build_object(
    'lastDone', (SELECT jsonb_build_object('finishedAt', r.finished_at, 'outcome', r.data ->> 'outcome') FROM public.agent_runs r
                  WHERE r.agent = a.agent AND r.status = 'done' AND r.run_key !~ '^(draft|revise|srev):' ORDER BY r.started_at DESC LIMIT 1),
    'lastTerminal', (SELECT jsonb_build_object('status', r.status, 'finishedAt', r.finished_at, 'outcome', r.data ->> 'outcome') FROM public.agent_runs r
                  WHERE r.agent = a.agent AND r.status IN ('done', 'failed') AND r.run_key !~ '^(draft|revise|srev):' ORDER BY r.started_at DESC LIMIT 1),
    'running', EXISTS (SELECT 1 FROM public.agent_runs r WHERE r.agent = a.agent AND r.status = 'running' AND r.started_at > now() - interval '35 minutes')))
  FROM (VALUES ('seo'), ('service'), ('security'), ('customer_success'), ('live_check'), ('social'), ('manager')) AS a(agent);
$function$;
REVOKE ALL ON FUNCTION public.agents_latest_runs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_latest_runs() TO service_role;

-- one step at a time: the lease (database time) - a second tab / a double click waits instead of running the same step twice
CREATE OR REPLACE FUNCTION public.agents_chain_lease(p_id uuid, p_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v public.agent_chains;
BEGIN
  IF p_seconds IS NULL OR p_seconds NOT BETWEEN 10 AND 600 THEN RAISE EXCEPTION 'chain_invalid' USING ERRCODE = '22023'; END IF;
  UPDATE public.agent_chains SET lease_until = now() + make_interval(secs => p_seconds)
   WHERE id = p_id AND status = 'running' AND (lease_until IS NULL OR lease_until < now()) RETURNING * INTO v;
  RETURN CASE WHEN v.id IS NULL THEN NULL ELSE to_jsonb(v) END;
END
$function$;
REVOKE ALL ON FUNCTION public.agents_chain_lease(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_chain_lease(uuid, integer) TO service_role;
