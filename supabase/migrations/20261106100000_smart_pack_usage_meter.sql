-- ============================================================================================================================
-- 20261106100000_smart_pack_usage_meter.sql  -  the SMART PACK usage meter: a monthly AI budget per account, shown as "% left"
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-11-06 (typed: "מאשר את משימת הלילה בסדר הזה: שחרור א׳, מונה השימוש של חכם פלוס (4 ₪ = 100%, שער 3.5 ₪
--   לדולר, לפי התשובות שנתתי), שחרור ב׳ שנספר במונה, והכנת חוק 49; כולל שינוי ב-L-01, L-05, L-06, L-09, L-11, L-12, L-14, L-17,
--   L-22"). The Owner's answers: at 0% only the expensive actions are blocked (a chat question that reads the account's data, voice,
--   the AI smart quote / smart edit, a quote from a file, Customer Twin); a plain chat question stays free and is not counted; the
--   percentage REPLACES the count quotas (50 files, 20 checks); the free 7 days and LIFETIME get the same 4 ILS; the super admin is
--   never limited.
--   * smart_pack_usage_claims - one row per metered AI action (claimed -> done | refunded): the feature, the Israel month, the
--     reserve held while the call runs, and - written by the Edge Function (service role) - the model, token counts / units, the
--     provider cost in micro-USD and the micro-ILS cost at the rate of that moment. Never any content.
--   * the budget: 4 ILS = 4,000,000 micro-ILS per account and Israel calendar month; the rate: the Bank of Israel representative rate
--     + 10% (Owner console 2026-11-06, typed: "החלטתי כבר, שער יציג פלוס 10%"), 3.5 ILS per USD when no rate of the last 14 days is
--     stored (the Owner's first number). The Edge Functions store the representative rate (smart_pack_store_fx_rate, service role).
--   * a claim holds the action's maximum possible cost while the call runs, so parallel calls can never pass the budget; a failed
--     call is given back (refunded, 0 counted). The super admin (business_settings.role = 'super_admin' - by user id, because the
--     admin row is also LIFETIME, 20261103200000) is recorded for the cost view but never refused.
--   * the count quotas are lifted: quote_file_read_state and customer_twin_monthly_limit no longer limit by count (their one-in-flight,
--     cache and failure guards stay); the meter decides.
--   The table is closed to the app (RLS on, no policy, no grant); the app reaches it ONLY through smart_pack_usage_status() and
--   smart_pack_usage_claim() (the CALLER, auth.uid()); finishing is the service role's; the cost view is the super admin's.
-- Rollback of THIS file: DROP FUNCTION public.smart_pack_store_fx_rate(date, numeric), public.smart_pack_usage_admin(integer), public.smart_pack_usage_finish(uuid, boolean, bigint,
--   text, integer, integer, integer, numeric), public.smart_pack_usage_claim(text, bigint), public.smart_pack_usage_status(),
--   public.smart_pack_usage_state(uuid), public.smart_pack_usd_ils_rate(), public.smart_pack_monthly_budget_micros();
--   DROP TABLE public.smart_pack_usage_claims, public.smart_pack_fx_rates; re-apply quote_file_read_state from 20261103100000 and customer_twin_monthly_limit
--   from 20261023000000.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.smart_pack_usage_claims (
  claim_id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid          NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  feature           text          NOT NULL CHECK (feature IN ('chat_data', 'voice', 'ai_draft', 'file_quote', 'customer_twin')),
  usage_month       date          NOT NULL,
  state             text          NOT NULL DEFAULT 'claimed' CHECK (state IN ('claimed', 'done', 'refunded')),
  reserve_micros    bigint        NOT NULL CHECK (reserve_micros > 0 AND reserve_micros <= 2000000),
  exempt            boolean       NOT NULL DEFAULT false,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  finished_at       timestamptz   NULL,
  model             text          NULL CHECK (model IS NULL OR length(model) BETWEEN 1 AND 80),
  prompt_tokens     integer       NULL CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  cached_tokens     integer       NULL CHECK (cached_tokens IS NULL OR cached_tokens >= 0),
  completion_tokens integer       NULL CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  units             numeric(12,3) NULL CHECK (units IS NULL OR units >= 0),
  cost_usd_micros   bigint        NULL CHECK (cost_usd_micros IS NULL OR cost_usd_micros >= 0),
  usd_ils_rate      numeric(8,4)  NULL CHECK (usd_ils_rate IS NULL OR usd_ils_rate > 0),
  cost_micros       bigint        NULL CHECK (cost_micros IS NULL OR cost_micros >= 0)
);
CREATE INDEX IF NOT EXISTS smart_pack_usage_claims_user_month ON public.smart_pack_usage_claims (user_id, usage_month);
CREATE INDEX IF NOT EXISTS smart_pack_usage_claims_created ON public.smart_pack_usage_claims (created_at DESC);
ALTER TABLE public.smart_pack_usage_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.smart_pack_usage_claims FROM PUBLIC, anon, authenticated, service_role;

-- the Bank of Israel representative USD rate by its date (written ONLY by smart_pack_store_fx_rate, the service role)
CREATE TABLE IF NOT EXISTS public.smart_pack_fx_rates (
  rate_date date         PRIMARY KEY,
  usd_ils   numeric(8,4) NOT NULL CHECK (usd_ils BETWEEN 1 AND 10),
  stored_at timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE public.smart_pack_fx_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.smart_pack_fx_rates FROM PUBLIC, anon, authenticated, service_role;

-- the Owner's numbers: 4 ILS a month (micro-ILS); the representative rate of the last 14 days + 10%, else 3.5 ILS per USD
CREATE OR REPLACE FUNCTION public.smart_pack_monthly_budget_micros()
RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $function$ SELECT 4000000::bigint $function$;
REVOKE ALL ON FUNCTION public.smart_pack_monthly_budget_micros() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.smart_pack_usd_ils_rate()
RETURNS numeric LANGUAGE sql STABLE SET search_path = public, pg_temp AS $function$
  SELECT coalesce((SELECT round(r.usd_ils * 1.10, 4) FROM public.smart_pack_fx_rates r
                    WHERE r.rate_date >= (now() AT TIME ZONE 'Asia/Jerusalem')::date - 14 ORDER BY r.rate_date DESC LIMIT 1), 3.5::numeric)
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_usd_ils_rate() FROM PUBLIC, anon, authenticated, service_role;
-- whether today's representative rate (Israel date) is missing - the Edge Function then fetches it once (Bank of Israel publishes on
-- business days; a weekend keeps the last one)
CREATE OR REPLACE FUNCTION public.smart_pack_fx_stale()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $function$
  SELECT NOT EXISTS (SELECT 1 FROM public.smart_pack_fx_rates r WHERE r.rate_date >= (now() AT TIME ZONE 'Asia/Jerusalem')::date - 1)
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_fx_stale() FROM PUBLIC, anon, authenticated, service_role;
-- the Edge Function stores the representative rate it read (service role); a rate outside 1..10 or a future date is refused
CREATE OR REPLACE FUNCTION public.smart_pack_store_fx_rate(p_date date, p_usd_ils numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF p_date IS NULL OR p_usd_ils IS NULL OR p_usd_ils < 1 OR p_usd_ils > 10 OR p_date > (now() AT TIME ZONE 'Asia/Jerusalem')::date THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  INSERT INTO public.smart_pack_fx_rates (rate_date, usd_ils) VALUES (p_date, round(p_usd_ils, 4))
  ON CONFLICT (rate_date) DO UPDATE SET usd_ils = EXCLUDED.usd_ils, stored_at = now();
  RETURN jsonb_build_object('ok', true, 'rate', public.smart_pack_usd_ils_rate());
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_store_fx_rate(date, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_store_fx_rate(date, numeric) TO service_role;

-- the meter of one account this Israel month (internal, called by the definer functions below)
CREATE OR REPLACE FUNCTION public.smart_pack_usage_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_admin    boolean := EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = p_user_id AND b.role = 'super_admin');
  v_enforced boolean := EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced');
  v_entitled boolean;
  v_month    date := date_trunc('month', (now() AT TIME ZONE 'Asia/Jerusalem'))::date;
  v_budget   bigint := public.smart_pack_monthly_budget_micros();
  v_used     bigint;
  v_reserved bigint;
BEGIN
  v_entitled := v_admin OR NOT v_enforced OR coalesce((public.smart_pack_state(p_user_id) ->> 'active')::boolean, false);
  SELECT coalesce(sum(c.cost_micros) FILTER (WHERE c.state = 'done'), 0),
         coalesce(sum(c.reserve_micros) FILTER (WHERE c.state = 'claimed' AND c.created_at > now() - interval '10 minutes'), 0)
    INTO v_used, v_reserved
    FROM public.smart_pack_usage_claims c WHERE c.user_id = p_user_id AND c.usage_month = v_month;
  RETURN jsonb_build_object(
    'smartPack', v_entitled,
    'unlimited', v_admin,
    'month', to_char(v_month, 'YYYY-MM'),
    'budgetMicros', v_budget,
    'usedMicros', v_used,
    'reservedMicros', v_reserved,
    'remainingMicros', greatest(v_budget - v_used - v_reserved, 0),
    -- what the user sees: the share of the month's budget not yet used (whole percent, rounded down, but at least 1 while anything is
    -- left; 0 only when nothing is left)
    'percentLeft', CASE WHEN v_admin THEN 100 WHEN v_used >= v_budget THEN 0
                        ELSE greatest(floor((v_budget - v_used) * 100.0 / v_budget), 1)::integer END);
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_usage_state(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- the caller's own meter ("נשארו לכם 63% משימוש חכם פלוס החודש")
CREATE OR REPLACE FUNCTION public.smart_pack_usage_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'smart_pack_usage_status: not authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('ok', true) || public.smart_pack_usage_state(v_uid);
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_usage_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.smart_pack_usage_status() TO authenticated;

-- start ONE metered action for the caller, atomically (one account at a time): it holds p_reserve_micros (the action's maximum
-- possible cost) until the Edge Function finishes it. Not SMART PACK = refused; not enough left = refused; nothing is held then.
CREATE OR REPLACE FUNCTION public.smart_pack_usage_claim(p_feature text, p_reserve_micros bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_state jsonb;
  v_claim uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'smart_pack_usage_claim: not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_feature IS NULL OR p_feature NOT IN ('chat_data', 'voice', 'ai_draft', 'file_quote', 'customer_twin')
     OR p_reserve_micros IS NULL OR p_reserve_micros <= 0 OR p_reserve_micros > 2000000 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-smart-pack-usage:' || v_uid::text));
  -- an action left 'claimed' for 10 minutes (the request died) gives its reserve back first
  UPDATE public.smart_pack_usage_claims c SET state = 'refunded', finished_at = now(), cost_micros = 0
   WHERE c.user_id = v_uid AND c.state = 'claimed' AND c.created_at < now() - interval '10 minutes';
  -- a burst guard: at most 20 metered actions a minute per account (a script cannot fill the table with tiny claims)
  IF (SELECT count(*) FROM public.smart_pack_usage_claims c WHERE c.user_id = v_uid AND c.created_at > now() - interval '1 minute') >= 20 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'too_many_requests', 'status', public.smart_pack_usage_state(v_uid));
  END IF;
  v_state := public.smart_pack_usage_state(v_uid);
  IF NOT (v_state ->> 'smartPack')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'code', 'smart_pack_required', 'status', v_state);
  END IF;
  IF NOT (v_state ->> 'unlimited')::boolean AND (v_state ->> 'remainingMicros')::bigint < p_reserve_micros THEN
    RETURN jsonb_build_object('ok', false, 'code', 'budget_exhausted', 'status', v_state);
  END IF;
  INSERT INTO public.smart_pack_usage_claims (user_id, feature, usage_month, reserve_micros, exempt)
  VALUES (v_uid, p_feature, to_date(v_state ->> 'month', 'YYYY-MM'), p_reserve_micros, (v_state ->> 'unlimited')::boolean)
  RETURNING claim_id INTO v_claim;
  RETURN jsonb_build_object('ok', true, 'claimId', v_claim, 'status', public.smart_pack_usage_state(v_uid));
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_usage_claim(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.smart_pack_usage_claim(text, bigint) TO authenticated;

-- the Edge Function finishes its claim (service role): ok = the provider cost is counted at today's rate ('done'); not ok = given
-- back ('refunded', 0 counted; the usage is still recorded for the cost view). The account's advisory lock FIRST, then the row.
CREATE OR REPLACE FUNCTION public.smart_pack_usage_finish(p_claim_id uuid, p_ok boolean, p_cost_usd_micros bigint DEFAULT NULL,
  p_model text DEFAULT NULL, p_prompt_tokens integer DEFAULT NULL, p_cached_tokens integer DEFAULT NULL,
  p_completion_tokens integer DEFAULT NULL, p_units numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user  uuid;
  v_claim public.smart_pack_usage_claims%ROWTYPE;
  v_rate  numeric := public.smart_pack_usd_ils_rate();
  v_usd   bigint := greatest(coalesce(p_cost_usd_micros, 0), 0);
BEGIN
  SELECT c.user_id INTO v_user FROM public.smart_pack_usage_claims c WHERE c.claim_id = p_claim_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'no_claim'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-smart-pack-usage:' || v_user::text));
  SELECT * INTO v_claim FROM public.smart_pack_usage_claims c WHERE c.claim_id = p_claim_id FOR UPDATE;
  IF v_claim.state <> 'claimed' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_finished', 'status', public.smart_pack_usage_state(v_user));
  END IF;
  UPDATE public.smart_pack_usage_claims SET state = CASE WHEN p_ok THEN 'done' ELSE 'refunded' END, finished_at = now(),
         model = left(p_model, 80), prompt_tokens = greatest(p_prompt_tokens, 0), cached_tokens = greatest(p_cached_tokens, 0),
         completion_tokens = greatest(p_completion_tokens, 0), units = greatest(p_units, 0), cost_usd_micros = v_usd,
         usd_ils_rate = v_rate, cost_micros = CASE WHEN p_ok THEN ceil(v_usd * v_rate)::bigint ELSE 0 END
   WHERE claim_id = p_claim_id;
  RETURN jsonb_build_object('ok', true, 'status', public.smart_pack_usage_state(v_user), 'fxStale', public.smart_pack_fx_stale());
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_usage_finish(uuid, boolean, bigint, text, integer, integer, integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_usage_finish(uuid, boolean, bigint, text, integer, integer, integer, numeric) TO service_role;

-- the Owner's cost view (super admin only, read-only): per Israel day and feature, and per account this month. Numbers + the
-- account's email only (the admin already sees every account) - never any content.
CREATE OR REPLACE FUNCTION public.smart_pack_usage_admin(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_days   integer := least(greatest(coalesce(p_days, 30), 1), 366);
  v_month  date := date_trunc('month', (now() AT TIME ZONE 'Asia/Jerusalem'))::date;
  v_budget bigint := public.smart_pack_monthly_budget_micros();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'smart_pack_usage_admin: super admin only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('ok', true, 'budgetIls', round(v_budget / 1000000.0, 2), 'usdIlsRate', public.smart_pack_usd_ils_rate(),
    'days', coalesce((
      SELECT jsonb_agg(d ORDER BY d ->> 'day' DESC, d ->> 'feature') FROM (
        SELECT jsonb_build_object(
          'day', to_char((c.created_at AT TIME ZONE 'Asia/Jerusalem')::date, 'YYYY-MM-DD'),
          'feature', c.feature,
          'stored', count(*) FILTER (WHERE c.state = 'done'),
          'refunded', count(*) FILTER (WHERE c.state = 'refunded'),
          'accounts', count(DISTINCT c.user_id),
          'promptTokens', coalesce(sum(c.prompt_tokens), 0),
          'completionTokens', coalesce(sum(c.completion_tokens), 0),
          'costIls', round(coalesce(sum(c.cost_micros), 0) / 1000000.0, 4),
          'costUsd', round(coalesce(sum(c.cost_usd_micros) FILTER (WHERE c.state = 'done'), 0) / 1000000.0, 4)) AS d
          FROM public.smart_pack_usage_claims c
         WHERE c.created_at >= now() - make_interval(days => v_days)
         GROUP BY (c.created_at AT TIME ZONE 'Asia/Jerusalem')::date, c.feature) x), '[]'::jsonb),
    'accounts', coalesce((
      SELECT jsonb_agg(a ORDER BY (a ->> 'costIls')::numeric DESC) FROM (
        SELECT jsonb_build_object(
          'email', u.email,
          'admin', bool_or(c.exempt),
          'actions', count(*) FILTER (WHERE c.state = 'done'),
          'costIls', round(coalesce(sum(c.cost_micros), 0) / 1000000.0, 4),
          'percentUsed', round(coalesce(sum(c.cost_micros), 0) * 100.0 / v_budget, 1)) AS a
          FROM public.smart_pack_usage_claims c JOIN auth.users u ON u.id = c.user_id
         WHERE c.usage_month = v_month
         GROUP BY u.email) y), '[]'::jsonb));
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_usage_admin(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.smart_pack_usage_admin(integer) TO authenticated;

-- the count quotas are lifted (the meter decides): a quote from a file is no longer limited to 50 / 3 reads. Body of
-- 20261103100000 with ONLY the marked change; the period, the one-in-flight / failure guards and the US$10 cost cap stay.
CREATE OR REPLACE FUNCTION public.quote_file_read_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_enforced boolean := EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced');
  v_sp       jsonb;
  v_entitled boolean;
  v_period   text;
  -- 20261106100000 (Owner 2026-11-06): no count limit any more - the SMART PACK usage meter decides
  v_limit    integer := 1000000;
  v_used     integer;
  v_cost     bigint;
BEGIN
  IF v_enforced THEN
    v_sp := public.smart_pack_state(p_user_id);
    v_entitled := coalesce((v_sp ->> 'active')::boolean, false)
      OR EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = p_user_id AND b.role = 'super_admin');
  ELSE
    v_sp := jsonb_build_object('source', NULL);
    v_entitled := true;
  END IF;
  IF v_entitled AND (v_sp ->> 'source') = 'free_window' THEN
    v_period := 'free';
  ELSE
    v_period := to_char(date_trunc('month', (now() AT TIME ZONE 'Asia/Jerusalem')), 'YYYY-MM');
  END IF;
  SELECT count(*) FILTER (WHERE c.state IN ('claimed', 'done')), coalesce(sum(c.cost_micros) FILTER (WHERE c.state = 'done'), 0)
    INTO v_used, v_cost
    FROM public.quote_file_read_claims c WHERE c.user_id = p_user_id AND c.period = v_period;
  RETURN jsonb_build_object(
    'smartPack', v_entitled,
    'period', v_period,
    'limit', CASE WHEN v_entitled THEN v_limit ELSE 0 END,
    'used', CASE WHEN v_entitled THEN least(v_used, v_limit) ELSE 0 END,
    'remaining', CASE WHEN v_entitled THEN greatest(v_limit - v_used, 0) ELSE 0 END,
    'costCapReached', v_cost >= 10000000);
END
$function$;
REVOKE ALL ON FUNCTION public.quote_file_read_state(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Customer Twin: no monthly count any more (the meter decides); the cache, in-progress and failure guards stay
CREATE OR REPLACE FUNCTION public.customer_twin_monthly_limit()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $function$ SELECT 1000000 $function$;
GRANT EXECUTE ON FUNCTION public.customer_twin_monthly_limit() TO authenticated, service_role;
