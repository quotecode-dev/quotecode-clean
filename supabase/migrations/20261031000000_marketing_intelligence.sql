-- ============================================================================================================================
-- 20261031000000_marketing_intelligence.sql  -  Codex release 8 (topic 8): competitors, keywords, own-post results, Shira's replies
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-30 (typed: "אשר עבודה רצופה מעכשיו: ... 8 (כולל תשובות שירה כטיוטה לאישור) ...", "מאשר להוסיף לשחרור 8 תשובות של
--   שירה לתגובות, כטיוטה לאישור שלי", "מאשר הרשאות תגובות במטא לשירה, טקסט התגובה נשמר עד 30 יום"); decisions 12-14 (100 keywords
--   65 / 35, the search-data service with a 10 USD monthly cap enforced HERE, read-only post results); docs/CODEX_SPEC_MORNING_PLANS
--   section 8.
--   * agents_data_months / agents_data_attempts: every paid search-data request is reserved before it is sent (10 USD a month, one pool,
--     serialized per month) and settled once with the provider's own reported cost; an unknown outcome keeps its hold.
--   * marketing_keywords (the tracked keywords per market), marketing_competitors (the Owner's competitor domains per market),
--     marketing_rank_snapshots (one row per keyword per week: our position, the competitors' positions, the monthly search volume - a
--     position missing = "not found within the checked depth", never a zero).
--   * social_post_metrics: the latest results of our own published posts (what the current permissions allow; unavailable != zero).
--   * agent_actions: a new system action 'social_reply' (a reply to a comment, published only after the Owner's approval). The comment's
--     text and author are personal data: kept at most 30 days (agents_purge_reply_texts, the daily run).
--   Closed to the app: RLS forced, no policy, no grant to PUBLIC / anon / authenticated; the service role only.
--   ROLLBACK: stop the collection (no code calls it); keep the history; replies already published stay as they are.
-- ============================================================================================================================

ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_action_type_check;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_action_type_check
  CHECK (action_type IN ('sitemap_submit', 'urgent_mail', 'article_draft', 'article_publish', 'claude_task', 'social_post', 'social_reply', 'none'));
ALTER TABLE public.agent_actions DROP CONSTRAINT IF EXISTS agent_actions_check;
ALTER TABLE public.agent_actions ADD CONSTRAINT agent_actions_check
  CHECK ((kind = 'auto' AND action_type IN ('sitemap_submit', 'urgent_mail'))
      OR (kind = 'system' AND action_type IN ('article_draft', 'article_publish', 'social_post', 'social_reply'))
      OR (kind = 'claude' AND action_type = 'claude_task')
      OR (kind = 'info' AND action_type = 'none'));

-- ---------------------------------------------------------------------------------------------------- the data spend (10 USD / month)
CREATE TABLE IF NOT EXISTS public.agents_data_months (
  month           date         PRIMARY KEY,
  cap_micros      bigint       NOT NULL DEFAULT 10000000 CHECK (cap_micros >= 0),
  held_micros     bigint       NOT NULL DEFAULT 0 CHECK (held_micros >= 0),
  settled_micros  bigint       NOT NULL DEFAULT 0 CHECK (settled_micros >= 0)
);
CREATE TABLE IF NOT EXISTS public.agents_data_attempts (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  month          date         NOT NULL REFERENCES public.agents_data_months (month),
  purpose        text         NOT NULL CHECK (char_length(purpose) BETWEEN 1 AND 80),
  hold_micros    bigint       NOT NULL CHECK (hold_micros > 0),
  cost_micros    bigint       CHECK (cost_micros IS NULL OR cost_micros >= 0),
  state          text         NOT NULL DEFAULT 'held' CHECK (state IN ('held', 'settled', 'failed', 'unknown')),
  created_at     timestamptz  NOT NULL DEFAULT now(),
  settled_at     timestamptz
);
ALTER TABLE public.agents_data_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents_data_months FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agents_data_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents_data_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agents_data_months, public.agents_data_attempts FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.agents_data_reserve(p_purpose text, p_hold_micros bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_month date := date_trunc('month', now() AT TIME ZONE 'Asia/Jerusalem')::date; m public.agents_data_months%ROWTYPE; v_id uuid;
BEGIN
  IF p_hold_micros IS NULL OR p_hold_micros <= 0 OR p_hold_micros > 1000000 OR coalesce(p_purpose, '') = '' THEN RAISE EXCEPTION 'data_reserve_invalid' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.agents_data_months (month) VALUES (v_month) ON CONFLICT (month) DO NOTHING;
  SELECT * INTO m FROM public.agents_data_months WHERE month = v_month FOR UPDATE;
  IF m.held_micros + m.settled_micros + p_hold_micros > m.cap_micros THEN RETURN jsonb_build_object('ok', false, 'code', 'data_budget_blocked'); END IF;
  UPDATE public.agents_data_months SET held_micros = held_micros + p_hold_micros WHERE month = v_month;
  INSERT INTO public.agents_data_attempts (month, purpose, hold_micros) VALUES (v_month, left(p_purpose, 80), p_hold_micros) RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_data_reserve(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_data_reserve(text, bigint) TO service_role;

-- settled once: 'settled' with the provider's reported cost, 'failed' = nothing was charged, 'unknown' = the hold stays
CREATE OR REPLACE FUNCTION public.agents_data_settle(p_id uuid, p_state text, p_cost_micros bigint DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE a public.agents_data_attempts%ROWTYPE;
BEGIN
  IF p_state NOT IN ('settled', 'failed', 'unknown') THEN RETURN false; END IF;
  SELECT * INTO a FROM public.agents_data_attempts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR a.state <> 'held' THEN RETURN false; END IF;
  PERFORM 1 FROM public.agents_data_months WHERE month = a.month FOR UPDATE;
  IF p_state = 'unknown' THEN
    UPDATE public.agents_data_attempts SET state = 'unknown', settled_at = now() WHERE id = p_id;
    RETURN true;
  END IF;
  UPDATE public.agents_data_months
     SET held_micros = greatest(held_micros - a.hold_micros, 0),
         settled_micros = settled_micros + CASE WHEN p_state = 'settled' THEN greatest(coalesce(p_cost_micros, a.hold_micros), 0) ELSE 0 END
   WHERE month = a.month;
  UPDATE public.agents_data_attempts SET state = p_state, cost_micros = CASE WHEN p_state = 'settled' THEN greatest(coalesce(p_cost_micros, a.hold_micros), 0) ELSE 0 END,
         settled_at = now() WHERE id = p_id;
  RETURN true;
END
$function$;
REVOKE ALL ON FUNCTION public.agents_data_settle(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_data_settle(uuid, text, bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.agents_data_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT coalesce((SELECT jsonb_build_object('month', month, 'cap_micros', cap_micros, 'held_micros', held_micros, 'settled_micros', settled_micros)
    FROM public.agents_data_months WHERE month = date_trunc('month', now() AT TIME ZONE 'Asia/Jerusalem')::date),
    jsonb_build_object('month', date_trunc('month', now() AT TIME ZONE 'Asia/Jerusalem')::date, 'cap_micros', 10000000, 'held_micros', 0, 'settled_micros', 0));
$function$;
REVOKE ALL ON FUNCTION public.agents_data_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_data_state() TO service_role;

-- ---------------------------------------------------------------------------------------------------- keywords and competitors
CREATE TABLE IF NOT EXISTS public.marketing_keywords (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  market      text         NOT NULL CHECK (market IN ('il', 'intl')),
  keyword     text         NOT NULL CHECK (char_length(keyword) BETWEEN 2 AND 120 AND keyword = lower(keyword)),
  source      text         NOT NULL DEFAULT 'search_console' CHECK (source IN ('search_console', 'owner')),
  active      boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_keywords_unique ON public.marketing_keywords (market, keyword);
CREATE TABLE IF NOT EXISTS public.marketing_competitors (
  domain      text         NOT NULL CHECK (domain ~ '^[a-z0-9.-]{3,100}$'),
  market      text         NOT NULL CHECK (market IN ('il', 'intl')),
  created_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, market)
);
CREATE TABLE IF NOT EXISTS public.marketing_rank_snapshots (
  week                  date         NOT NULL,
  keyword_id            uuid         NOT NULL REFERENCES public.marketing_keywords (id),
  our_position          integer      CHECK (our_position IS NULL OR our_position BETWEEN 1 AND 100),
  competitor_positions  jsonb        NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(competitor_positions) = 'object'),
  search_volume         integer      CHECK (search_volume IS NULL OR search_volume >= 0),
  depth                 integer      NOT NULL DEFAULT 100 CHECK (depth BETWEEN 1 AND 1000),
  fetched_at            timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (week, keyword_id)
);
CREATE TABLE IF NOT EXISTS public.social_post_metrics (
  action_id      uuid         PRIMARY KEY REFERENCES public.agent_actions (id) ON DELETE CASCADE,
  network        text         NOT NULL CHECK (network IN ('facebook', 'instagram')),
  likes          integer      CHECK (likes IS NULL OR likes >= 0),
  comments       integer      CHECK (comments IS NULL OR comments >= 0),
  shares         integer      CHECK (shares IS NULL OR shares >= 0),
  reach          integer      CHECK (reach IS NULL OR reach >= 0),
  reach_available boolean     NOT NULL DEFAULT false,
  fetched_at     timestamptz  NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_keywords FORCE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_competitors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_rank_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_rank_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_metrics FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketing_keywords, public.marketing_competitors, public.marketing_rank_snapshots, public.social_post_metrics FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.marketing_keywords, public.marketing_rank_snapshots, public.social_post_metrics TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.marketing_competitors TO service_role;

-- ---------------------------------------------------------------------------------------------------- the 30-day limit on comment texts
CREATE OR REPLACE FUNCTION public.agents_purge_reply_texts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_n integer;
BEGIN
  UPDATE public.agent_actions
     SET payload = (payload - 'comment_text' - 'author') || jsonb_build_object('comment_text_purged', true)
   WHERE action_type = 'social_reply' AND created_at < now() - interval '30 days' AND (payload ? 'comment_text' OR payload ? 'author');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$function$;
REVOKE ALL ON FUNCTION public.agents_purge_reply_texts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_purge_reply_texts() TO service_role;
