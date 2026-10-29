-- ============================================================================================================================
-- 20261030300000_agents_article_topics.sql  -  Codex release 4 (topic 4): no duplicate article topics in the agents room
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-29 (typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
--   החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב"); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 4, decision 6.
--   * agents_article_inventory() - EVERY article (draft + published), every article proposal still waiting and every active topic claim,
--     in one answer (no 40 / 100 / 1,000 recent-row window). The function compares a new topic with all of it (plus the static guides).
--   * article_topic_claims - the topic identities in use by the new flow (the normalized Hebrew and English topic, later the article's
--     own headings), one active row per language and text. agents_article_claim() replaces the rows of ONE article flow (the
--     article_draft action) atomically: a text already held by another flow refuses the whole claim - two approvals of the same topic
--     at once cannot both write. A claim is released only explicitly (a rejection); a failed or unknown draft keeps it.
--   Historical articles are not rewritten, renamed or merged; they are compared, not claimed.
--   Closed to the app: RLS forced, no policy, no table grant to anyone; only the SECURITY DEFINER functions below, EXECUTE for the
--   service role only. The published-article read of the public site (20261027500000) is unchanged.
--   ROLLBACK (DB owner): DROP FUNCTION public.agents_article_inventory(), public.agents_article_claim(uuid, text, text, text, text, text, text),
--     public.agents_article_release(uuid); DROP TABLE public.article_topic_claims;
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.article_topic_claims (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id       uuid         NOT NULL REFERENCES public.agent_actions (id),
  kind         text         NOT NULL CHECK (kind IN ('topic', 'title')),
  lang         text         NOT NULL CHECK (lang IN ('he', 'en')),
  norm         text         NOT NULL CHECK (char_length(norm) BETWEEN 1 AND 300),
  display      text         NOT NULL CHECK (char_length(display) BETWEEN 1 AND 300),
  focus        text         CHECK (focus IS NULL OR char_length(focus) <= 300),
  status       text         NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  released_at  timestamptz,
  CHECK ((status = 'released') = (released_at IS NOT NULL))
);
COMMENT ON TABLE public.article_topic_claims IS
  'Owner 2026-10-29 (Codex release 4, decision 6): the article topics / headings in use by the agents'' article flow; service functions only.';
-- one active flow per text, per language and per kind (a flow's own topic and heading may be the same text)
CREATE UNIQUE INDEX IF NOT EXISTS article_topic_claims_active_idx ON public.article_topic_claims (lang, kind, norm) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS article_topic_claims_ref_idx ON public.article_topic_claims (ref_id) WHERE status = 'active';

ALTER TABLE public.article_topic_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_topic_claims FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.article_topic_claims FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.agents_article_inventory()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'articles', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'status', s.status, 'market', s.market,
        'he', s.he ->> 'h1', 'en', s.en ->> 'h1', 'action_id', s.action_id) ORDER BY s.created_at)
      FROM public.site_articles s WHERE s.status IN ('draft', 'published')), '[]'::jsonb),
    'proposals', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'he', a.payload ->> 'topic_he', 'en', a.payload ->> 'topic_en',
        'focus', a.payload ->> 'focus') ORDER BY a.created_at)
      FROM public.agent_actions a WHERE a.action_type = 'article_draft' AND a.status = 'proposed'), '[]'::jsonb),
    'claims', coalesce((SELECT jsonb_agg(jsonb_build_object('ref_id', c.ref_id, 'kind', c.kind, 'lang', c.lang, 'norm', c.norm, 'display', c.display, 'focus', c.focus) ORDER BY c.created_at)
      FROM public.article_topic_claims c WHERE c.status = 'active'), '[]'::jsonb),
    'slugs', coalesce((SELECT jsonb_agg(s.slug ORDER BY s.slug) FROM public.site_articles s), '[]'::jsonb));
$function$;
REVOKE ALL ON FUNCTION public.agents_article_inventory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_inventory() TO service_role;

-- replaces the active rows of one kind (the topic, or the article's headings) of one article flow (p_ref = its article_draft action)
-- with the Hebrew and English identity given; a text another flow holds refuses everything (nothing released, nothing stored) and
-- names that flow. The topic stays claimed while the headings change with a rewrite.
CREATE OR REPLACE FUNCTION public.agents_article_claim(p_ref uuid, p_kind text, p_he_norm text, p_en_norm text, p_he text, p_en text, p_focus text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_lang text; v_other uuid;
BEGIN
  IF p_ref IS NULL OR p_kind NOT IN ('topic', 'title') OR coalesce(p_he_norm, '') = '' OR coalesce(p_en_norm, '') = ''
     OR char_length(p_he_norm) > 300 OR char_length(p_en_norm) > 300 OR coalesce(btrim(p_he), '') = '' OR coalesce(btrim(p_en), '') = '' THEN
    RAISE EXCEPTION 'agents_article_claim_invalid' USING ERRCODE = '22023';
  END IF;
  -- a rejected flow claims nothing (a writing that ends after the Owner's rejection never takes the topic back)
  IF NOT EXISTS (SELECT 1 FROM public.agent_actions WHERE id = p_ref AND action_type = 'article_draft' AND status <> 'rejected') THEN
    RAISE EXCEPTION 'agents_article_claim_invalid' USING ERRCODE = '22023';
  END IF;
  BEGIN
    UPDATE public.article_topic_claims SET status = 'released', released_at = now() WHERE ref_id = p_ref AND kind = p_kind AND status = 'active';
    v_lang := 'he';
    INSERT INTO public.article_topic_claims (ref_id, kind, lang, norm, display, focus) VALUES (p_ref, p_kind, 'he', p_he_norm, left(btrim(p_he), 300), left(nullif(btrim(p_focus), ''), 300));
    v_lang := 'en';
    INSERT INTO public.article_topic_claims (ref_id, kind, lang, norm, display, focus) VALUES (p_ref, p_kind, 'en', p_en_norm, left(btrim(p_en), 300), left(nullif(btrim(p_focus), ''), 300));
  EXCEPTION WHEN unique_violation THEN
    SELECT ref_id INTO v_other FROM public.article_topic_claims
     WHERE status = 'active' AND lang = v_lang AND kind = p_kind AND norm = CASE WHEN v_lang = 'he' THEN p_he_norm ELSE p_en_norm END;
    RETURN jsonb_build_object('ok', false, 'code', 'duplicate_topic', 'lang', v_lang, 'ref_id', v_other);
  END;
  RETURN jsonb_build_object('ok', true);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_article_claim(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_claim(uuid, text, text, text, text, text, text) TO service_role;

-- an explicit rejection frees the flow's topic (a failed or unknown draft never does by itself)
CREATE OR REPLACE FUNCTION public.agents_article_release(p_ref uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH r AS (UPDATE public.article_topic_claims SET status = 'released', released_at = now() WHERE ref_id = p_ref AND status = 'active' RETURNING 1)
  SELECT count(*)::integer FROM r;
$function$;
REVOKE ALL ON FUNCTION public.agents_article_release(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_release(uuid) TO service_role;
