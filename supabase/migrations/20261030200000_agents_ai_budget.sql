-- ============================================================================================================================
-- 20261030200000_agents_ai_budget.sql  -  Codex release 4 (topic 6a): the agents' AI budget is RESERVED before every paid call
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-29 (typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
--   החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב"); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 6a, decision 9.
--   The monthly cap of 20 US dollars (Owner 2026-10-27) stays ONE cap for every agent, both markets, retries, fallbacks and rewrites. Until
--   now it was a read of the costs already written (two runs at once could both pass it). From now on:
--   * agents_ai_budget_months - one row per Israel month: the cap and the opening amount carried in (micro-dollars, integers).
--   * agents_ai_attempts      - one row per PHYSICAL provider request: its worst-case cost is reserved BEFORE the request
--     (agents_ai_reserve, serialized per month by the month row's lock) and settled ONCE from the observed usage (agents_ai_settle).
--     A request whose outcome is unknown (no answer, a time-out, a database failure after the call) keeps its whole reservation - no
--     time and no restart releases it. An observed cost above its reservation is an anomaly and stops every further paid admission.
--   * Decision 9 (October): the month this migration is applied in starts with what the agents' runs already recorded this month plus
--     a 20% margin (the recorded amounts are estimates); never zero in the middle of a month.
--   Closed to the app: RLS forced, no policy, no table grant to anyone; only the three SECURITY DEFINER functions below, EXECUTE for the
--   service role only (the agents-room Edge function). agent_runs.ai_cost_usd stays the report of each run.
--   ROLLBACK (spec 6a): the ledger and its holds are KEPT. To stop new paid agents requests until compatible code is active:
--     UPDATE public.agents_ai_budget_months SET blocked_reason = 'rollback' WHERE blocked_reason IS NULL;
--   (DB owner, only if the Owner decides to remove it: DROP FUNCTION public.agents_ai_reserve(text, text, text, text, integer, integer, bigint),
--     public.agents_ai_settle(uuid, text, integer, integer, bigint), public.agents_ai_budget_state(text), public.agents_ai_committed_micros(text);
--     DROP TABLE public.agents_ai_attempts, public.agents_ai_budget_months;)
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.agents_ai_budget_months (
  month           text         PRIMARY KEY CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  cap_micros      bigint       NOT NULL DEFAULT 20000000 CHECK (cap_micros >= 0),
  opening_micros  bigint       NOT NULL DEFAULT 0 CHECK (opening_micros >= 0),
  blocked_reason  text         CHECK (blocked_reason IS NULL OR char_length(blocked_reason) <= 120),
  created_at      timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.agents_ai_budget_months IS
  'Owner 2026-10-29 (Codex release 4, decision 9): the agents'' monthly AI cap (one for all agents) and the amount carried in; service functions only.';

CREATE TABLE IF NOT EXISTS public.agents_ai_attempts (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  month              text         NOT NULL REFERENCES public.agents_ai_budget_months (month),
  purpose            text         NOT NULL CHECK (char_length(purpose) BETWEEN 1 AND 60),
  model              text         NOT NULL CHECK (char_length(model) BETWEEN 1 AND 60),
  rate_version       text         NOT NULL CHECK (char_length(rate_version) BETWEEN 1 AND 60),
  max_input_tokens   integer      NOT NULL CHECK (max_input_tokens > 0),
  max_output_tokens  integer      NOT NULL CHECK (max_output_tokens > 0),
  reserved_micros    bigint       NOT NULL CHECK (reserved_micros > 0),
  status             text         NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled', 'unknown', 'anomaly')),
  prompt_tokens      integer      CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens  integer      CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  settled_micros     bigint       CHECK (settled_micros IS NULL OR settled_micros >= 0),
  outcome            text         CHECK (outcome IS NULL OR char_length(outcome) <= 60),
  created_at         timestamptz  NOT NULL DEFAULT now(),
  settled_at         timestamptz,
  -- reserved / unknown hold their reservation; settled / anomaly carry the observed cost
  CHECK ((status IN ('reserved', 'unknown')) = (settled_micros IS NULL))
);
COMMENT ON TABLE public.agents_ai_attempts IS
  'Owner 2026-10-29 (Codex release 4): one row per paid AI request of the agents - reserved before it, settled once after it; service functions only.';
CREATE INDEX IF NOT EXISTS agents_ai_attempts_month_idx ON public.agents_ai_attempts (month, status);

ALTER TABLE public.agents_ai_budget_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents_ai_budget_months FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agents_ai_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents_ai_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agents_ai_budget_months, public.agents_ai_attempts FROM PUBLIC, anon, authenticated, service_role;

-- what the month already holds: the amount carried in + every settled cost + every reservation not settled (reserved / unknown)
CREATE OR REPLACE FUNCTION public.agents_ai_committed_micros(p_month text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT coalesce((SELECT opening_micros FROM public.agents_ai_budget_months WHERE month = p_month), 0)
       + coalesce((SELECT sum(CASE WHEN status IN ('reserved', 'unknown') THEN reserved_micros ELSE settled_micros END)
                     FROM public.agents_ai_attempts WHERE month = p_month), 0);
$function$;
REVOKE ALL ON FUNCTION public.agents_ai_committed_micros(text) FROM PUBLIC, anon, authenticated, service_role;

-- admission: the worst-case cost of ONE physical request, admitted only while committed + it <= the cap; serialized per month
CREATE OR REPLACE FUNCTION public.agents_ai_reserve(p_month text, p_purpose text, p_model text, p_rate_version text,
  p_max_input integer, p_max_output integer, p_reserved bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row public.agents_ai_budget_months%ROWTYPE;
  v_committed bigint;
  v_id uuid;
BEGIN
  IF p_month IS NULL OR p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' OR coalesce(p_reserved, 0) <= 0 OR coalesce(p_max_input, 0) <= 0
     OR coalesce(p_max_output, 0) <= 0 OR coalesce(btrim(p_purpose), '') = '' OR coalesce(btrim(p_model), '') = '' OR coalesce(btrim(p_rate_version), '') = '' THEN
    RAISE EXCEPTION 'agents_ai_reserve_invalid' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.agents_ai_budget_months (month) VALUES (p_month) ON CONFLICT (month) DO NOTHING;
  SELECT * INTO v_row FROM public.agents_ai_budget_months WHERE month = p_month FOR UPDATE; -- one admission at a time for this month
  IF v_row.blocked_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'budget_blocked');
  END IF;
  v_committed := public.agents_ai_committed_micros(p_month);
  IF v_committed + p_reserved > v_row.cap_micros THEN
    RETURN jsonb_build_object('ok', false, 'code', 'budget_insufficient', 'committed_micros', v_committed, 'cap_micros', v_row.cap_micros);
  END IF;
  INSERT INTO public.agents_ai_attempts (month, purpose, model, rate_version, max_input_tokens, max_output_tokens, reserved_micros)
  VALUES (p_month, left(btrim(p_purpose), 60), left(btrim(p_model), 60), left(btrim(p_rate_version), 60), p_max_input, p_max_output, p_reserved)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_ai_reserve(text, text, text, text, integer, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_ai_reserve(text, text, text, text, integer, integer, bigint) TO service_role;

-- settlement, ONCE per attempt (only a 'reserved' attempt changes):
--   'settled' - the provider answered with its usage (also an empty / invalid answer); above the reservation = anomaly + the month stops;
--   'failed'  - the provider refused the request (an HTTP error) - nothing was produced, the cost is 0;
--   'unknown' - no answer: the reservation stays held.
CREATE OR REPLACE FUNCTION public.agents_ai_settle(p_id uuid, p_outcome text, p_prompt_tokens integer, p_completion_tokens integer, p_settled bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_att public.agents_ai_attempts%ROWTYPE;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('settled', 'failed', 'unknown') OR (p_outcome = 'settled' AND (coalesce(p_settled, -1) < 0 OR p_prompt_tokens IS NULL OR p_completion_tokens IS NULL)) THEN
    RAISE EXCEPTION 'agents_ai_settle_invalid' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_att FROM public.agents_ai_attempts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_att.status <> 'reserved' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_reserved');
  END IF;
  IF p_outcome = 'unknown' THEN
    UPDATE public.agents_ai_attempts SET status = 'unknown', outcome = 'unknown', settled_at = now() WHERE id = p_id;
  ELSIF p_outcome = 'failed' THEN
    UPDATE public.agents_ai_attempts SET status = 'settled', outcome = 'provider_refused', settled_micros = 0, prompt_tokens = 0, completion_tokens = 0, settled_at = now()
    WHERE id = p_id;
  ELSIF p_settled > v_att.reserved_micros THEN
    UPDATE public.agents_ai_attempts SET status = 'anomaly', outcome = 'over_reservation', settled_micros = p_settled, prompt_tokens = p_prompt_tokens,
      completion_tokens = p_completion_tokens, settled_at = now() WHERE id = p_id;
    UPDATE public.agents_ai_budget_months SET blocked_reason = 'over_reservation:' || p_id::text WHERE month = v_att.month AND blocked_reason IS NULL;
    RETURN jsonb_build_object('ok', true, 'status', 'anomaly');
  ELSE
    UPDATE public.agents_ai_attempts SET status = 'settled', outcome = 'answered', settled_micros = p_settled, prompt_tokens = p_prompt_tokens,
      completion_tokens = p_completion_tokens, settled_at = now() WHERE id = p_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN p_outcome = 'unknown' THEN 'unknown' ELSE 'settled' END);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_ai_settle(uuid, text, integer, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_ai_settle(uuid, text, integer, integer, bigint) TO service_role;

-- the screen and the early checks: what the month holds, and how much of it is held for requests without a final outcome
CREATE OR REPLACE FUNCTION public.agents_ai_budget_state(p_month text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'month', p_month,
    'cap_micros', coalesce((SELECT cap_micros FROM public.agents_ai_budget_months WHERE month = p_month), 20000000),
    'committed_micros', public.agents_ai_committed_micros(p_month),
    'held_micros', coalesce((SELECT sum(reserved_micros) FROM public.agents_ai_attempts WHERE month = p_month AND status IN ('reserved', 'unknown')), 0),
    'blocked', coalesce((SELECT blocked_reason IS NOT NULL FROM public.agents_ai_budget_months WHERE month = p_month), false));
$function$;
REVOKE ALL ON FUNCTION public.agents_ai_budget_state(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_ai_budget_state(text) TO service_role;

-- decision 9: the Israel month this migration is applied in carries in what the agents' runs recorded in it, plus 20%, rounded up
INSERT INTO public.agents_ai_budget_months (month, opening_micros)
SELECT to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM'),
       ceil(coalesce(sum(r.ai_cost_usd), 0) * 1.2 * 1000000)::bigint
  FROM public.agent_runs r
 WHERE r.started_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem')
ON CONFLICT (month) DO NOTHING;
