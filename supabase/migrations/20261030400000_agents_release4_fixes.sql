-- ============================================================================================================================
-- 20261030400000_agents_release4_fixes.sql  -  the fixes of Codex's review of release 4 (docs/CODEX_REVIEW_RELEASE4_2026-10-29.md)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-29 night (typed: "אשר משימת לילה: תיקון כל ממצאי קודקס על שחרור 4 ושחרור 5 (החלטות 7 ו-8 כמוצע) בשחרור
--   אחד עד השער, כולל שינוי ב-L-22, L-25 ושאר נעילות המסך והתאריכים בלי שינוי; ..."). Additive only; nothing existing is rewritten.
--   * R4-01: ONE identity namespace for every article flow - a normalized Hebrew / English topic or heading and a normalized distinct
--     focus belong to at most one flow (article_identity_owners, primary key = the identity). A flow may hold its own topic and heading
--     with the same text. Owned inside agents_article_claim, atomically with the claim rows.
--   * R4-02 / R4-03: the article lifecycle writes are each ONE locked transaction - admission (the writing token + the topic / focus
--     claim), saving a written draft (token + headings claim + article + action done + publication action), a rewrite (revision check
--     + headings claim + text / revision), a publication (revision check + headings claim + status) and a rejection (refused while a
--     fresh writing token is held). A losing operation changes nothing, including the registry.
--   * R4-11: every AI attempt carries the run / action / logical operation that made it, and the provider's response id when known.
--   ROLLBACK (spec 6a / section 4): keep every table and row (claims, owners, attempts). To stop new paid article work until compatible
--     code is active: UPDATE public.agents_ai_budget_months SET blocked_reason = 'rollback' WHERE blocked_reason IS NULL.
--     (The DROP lines in the rollback comment of 20261030300000 are superseded: claims and drafts are retained.)
-- ============================================================================================================================

-- R4-01 ----------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.article_topic_claims ADD COLUMN IF NOT EXISTS focus_norm text CHECK (focus_norm IS NULL OR char_length(focus_norm) BETWEEN 1 AND 300);

CREATE TABLE IF NOT EXISTS public.article_identity_owners (
  lang        text         NOT NULL CHECK (lang IN ('he', 'en', 'focus')),
  norm        text         NOT NULL CHECK (char_length(norm) BETWEEN 1 AND 300),
  ref_id      uuid         NOT NULL REFERENCES public.agent_actions (id),
  created_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (lang, norm)
);
COMMENT ON TABLE public.article_identity_owners IS
  'Owner 2026-10-29 (Codex R4-01): which article flow owns a normalized topic / heading / focus; service functions only.';
CREATE INDEX IF NOT EXISTS article_identity_owners_ref_idx ON public.article_identity_owners (ref_id);
ALTER TABLE public.article_identity_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_identity_owners FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.article_identity_owners FROM PUBLIC, anon, authenticated, service_role;

-- the active claims of before this migration own their identities (the first flow wins; an existing collision stays reported, not deleted)
INSERT INTO public.article_identity_owners (lang, norm, ref_id)
SELECT DISTINCT ON (c.lang, c.norm) c.lang, c.norm, c.ref_id FROM public.article_topic_claims c WHERE c.status = 'active' ORDER BY c.lang, c.norm, c.created_at
ON CONFLICT (lang, norm) DO NOTHING;

-- the identities one flow still holds: its active claim rows + the focus of its active topic rows
CREATE OR REPLACE FUNCTION public.agents_article_owner_gc(p_ref uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  DELETE FROM public.article_identity_owners o
   WHERE o.ref_id = p_ref
     AND NOT EXISTS (SELECT 1 FROM public.article_topic_claims c WHERE c.ref_id = p_ref AND c.status = 'active'
                       AND ((o.lang IN ('he', 'en') AND c.lang = o.lang AND c.norm = o.norm) OR (o.lang = 'focus' AND c.focus_norm = o.norm)));
$function$;
REVOKE ALL ON FUNCTION public.agents_article_owner_gc(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- takes one identity for p_ref; returns the other flow that owns it (NULL = it is p_ref's)
CREATE OR REPLACE FUNCTION public.agents_article_take_identity(p_ref uuid, p_lang text, p_norm text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_owner uuid;
BEGIN
  INSERT INTO public.article_identity_owners (lang, norm, ref_id) VALUES (p_lang, p_norm, p_ref) ON CONFLICT (lang, norm) DO NOTHING;
  SELECT ref_id INTO v_owner FROM public.article_identity_owners WHERE lang = p_lang AND norm = p_norm;
  RETURN CASE WHEN v_owner = p_ref THEN NULL ELSE v_owner END;
END
$function$;
REVOKE ALL ON FUNCTION public.agents_article_take_identity(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- the claim of 20261030300000 + the one namespace + the focus identity; refuses everything when any identity is another flow's
CREATE OR REPLACE FUNCTION public.agents_article_claim_core(p_ref uuid, p_kind text, p_he_norm text, p_en_norm text, p_he text, p_en text,
  p_focus text, p_focus_norm text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_lang text; v_other uuid;
BEGIN
  IF p_ref IS NULL OR p_kind NOT IN ('topic', 'title') OR coalesce(p_he_norm, '') = '' OR coalesce(p_en_norm, '') = ''
     OR char_length(p_he_norm) > 300 OR char_length(p_en_norm) > 300 OR coalesce(btrim(p_he), '') = '' OR coalesce(btrim(p_en), '') = ''
     OR (p_focus_norm IS NOT NULL AND (p_focus_norm = '' OR char_length(p_focus_norm) > 300)) THEN
    RAISE EXCEPTION 'agents_article_claim_invalid' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agent_actions WHERE id = p_ref AND action_type = 'article_draft' AND status <> 'rejected') THEN
    RAISE EXCEPTION 'agents_article_claim_invalid' USING ERRCODE = '22023';
  END IF;
  BEGIN
    UPDATE public.article_topic_claims SET status = 'released', released_at = now() WHERE ref_id = p_ref AND kind = p_kind AND status = 'active';
    v_lang := 'he';
    INSERT INTO public.article_topic_claims (ref_id, kind, lang, norm, display, focus, focus_norm)
      VALUES (p_ref, p_kind, 'he', p_he_norm, left(btrim(p_he), 300), left(nullif(btrim(p_focus), ''), 300), p_focus_norm);
    v_lang := 'en';
    INSERT INTO public.article_topic_claims (ref_id, kind, lang, norm, display, focus, focus_norm)
      VALUES (p_ref, p_kind, 'en', p_en_norm, left(btrim(p_en), 300), left(nullif(btrim(p_focus), ''), 300), p_focus_norm);
    v_lang := 'he'; v_other := public.agents_article_take_identity(p_ref, 'he', p_he_norm);
    IF v_other IS NULL THEN v_lang := 'en'; v_other := public.agents_article_take_identity(p_ref, 'en', p_en_norm); END IF;
    IF v_other IS NULL AND p_focus_norm IS NOT NULL THEN v_lang := 'focus'; v_other := public.agents_article_take_identity(p_ref, 'focus', p_focus_norm); END IF;
    IF v_other IS NOT NULL THEN RAISE EXCEPTION 'agents_identity_taken' USING ERRCODE = 'P0001'; END IF;
    PERFORM public.agents_article_owner_gc(p_ref);
  EXCEPTION WHEN unique_violation OR raise_exception THEN
    IF v_other IS NULL THEN
      SELECT ref_id INTO v_other FROM public.article_topic_claims
       WHERE status = 'active' AND lang = v_lang AND kind = p_kind AND norm = CASE WHEN v_lang = 'he' THEN p_he_norm ELSE p_en_norm END;
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'duplicate_topic', 'lang', v_lang, 'ref_id', v_other);
  END;
  RETURN jsonb_build_object('ok', true);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_article_claim_core(uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- the public RPC of 20261030300000 keeps its signature (the code of before this release keeps working) and now owns identities
CREATE OR REPLACE FUNCTION public.agents_article_claim(p_ref uuid, p_kind text, p_he_norm text, p_en_norm text, p_he text, p_en text, p_focus text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$ SELECT public.agents_article_claim_core(p_ref, p_kind, p_he_norm, p_en_norm, p_he, p_en, p_focus, NULL); $function$;
REVOKE ALL ON FUNCTION public.agents_article_claim(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_claim(uuid, text, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.agents_article_release(p_ref uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_n integer;
BEGIN
  UPDATE public.article_topic_claims SET status = 'released', released_at = now() WHERE ref_id = p_ref AND status = 'active';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  DELETE FROM public.article_identity_owners WHERE ref_id = p_ref;
  RETURN v_n;
END
$function$;
REVOKE ALL ON FUNCTION public.agents_article_release(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_release(uuid) TO service_role;

-- R4-03: admission - the writing token, the topic / focus claim and the stored focus, together, on the locked action
CREATE OR REPLACE FUNCTION public.agents_article_admit(p_action uuid, p_token text, p_hold_seconds integer, p_he_norm text, p_en_norm text,
  p_he text, p_en text, p_focus text, p_focus_norm text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_a public.agent_actions%ROWTYPE; v_claim jsonb; v_article uuid;
BEGIN
  IF coalesce(p_token, '') !~ '^drafting:[0-9a-f-]{36}$' OR coalesce(p_hold_seconds, 0) <= 0 THEN
    RAISE EXCEPTION 'agents_article_admit_invalid' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_a FROM public.agent_actions WHERE id = p_action AND action_type = 'article_draft' FOR UPDATE;
  IF NOT FOUND OR v_a.status <> 'proposed' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_pending'); END IF;
  IF coalesce(v_a.error, '') LIKE 'drafting:%' AND v_a.decided_at > now() - make_interval(secs => p_hold_seconds) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'drafting');
  END IF;
  -- a draft this flow already stored (an interrupted earlier press) is resumed, never written again
  SELECT id INTO v_article FROM public.site_articles WHERE action_id = p_action ORDER BY created_at LIMIT 1;
  IF v_article IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'already_drafted', 'article_id', v_article); END IF;
  v_claim := public.agents_article_claim_core(p_action, 'topic', p_he_norm, p_en_norm, p_he, p_en, p_focus, p_focus_norm);
  IF (v_claim ->> 'ok')::boolean IS NOT TRUE THEN RETURN v_claim; END IF;
  UPDATE public.agent_actions
     SET error = p_token, decided_at = now(),
         payload = CASE WHEN nullif(btrim(p_focus), '') IS NULL THEN payload ELSE payload || jsonb_build_object('focus', left(btrim(p_focus), 300)) END
   WHERE id = p_action;
  RETURN jsonb_build_object('ok', true);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_article_admit(uuid, text, integer, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_admit(uuid, text, integer, text, text, text, text, text, text) TO service_role;

-- R4-02 / R4-03: saving a written draft - still this press's token on a waiting flow; headings claimed; article + done + publication
-- action in the same transaction (a stale rejection or a second press cannot interleave)
CREATE OR REPLACE FUNCTION public.agents_article_save_draft(p_action uuid, p_token text, p_slug text, p_market text, p_he jsonb, p_en jsonb,
  p_he_norm text, p_en_norm text, p_pub_title_he text, p_pub_title_en text, p_pub_detail_he text, p_pub_detail_en text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_a public.agent_actions%ROWTYPE; v_claim jsonb; v_article uuid; v_pub uuid;
BEGIN
  SELECT * INTO v_a FROM public.agent_actions WHERE id = p_action AND action_type = 'article_draft' FOR UPDATE;
  IF NOT FOUND OR v_a.status <> 'proposed' OR coalesce(v_a.error, '') <> coalesce(p_token, '-') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_pending');
  END IF;
  v_claim := public.agents_article_claim_core(p_action, 'title', p_he_norm, p_en_norm, p_he ->> 'h1', p_en ->> 'h1',
    v_a.payload ->> 'focus', NULL);
  IF (v_claim ->> 'ok')::boolean IS NOT TRUE THEN
    UPDATE public.agent_actions SET error = 'duplicate_topic' WHERE id = p_action;
    RETURN v_claim;
  END IF;
  INSERT INTO public.site_articles (slug, market, he, en, action_id) VALUES (p_slug, p_market, p_he, p_en, p_action) RETURNING id INTO v_article;
  UPDATE public.agent_actions SET status = 'done', done_at = now(), error = NULL,
         result = jsonb_build_object('articleId', v_article, 'slug', p_slug) WHERE id = p_action;
  INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en, detail_he, detail_en, payload, dedupe_key)
  VALUES (v_a.run_key, 'manager', 'system', 'article_publish', left(p_pub_title_he, 300), left(p_pub_title_en, 300), left(p_pub_detail_he, 6000),
          left(p_pub_detail_en, 6000), jsonb_build_object('articleId', v_article, 'slug', p_slug, 'revision', 0), 'publish:' || v_article::text)
  RETURNING id INTO v_pub;
  RETURN jsonb_build_object('ok', true, 'article_id', v_article, 'publish_action_id', v_pub);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_article_save_draft(uuid, text, text, text, jsonb, jsonb, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_save_draft(uuid, text, text, text, jsonb, jsonb, text, text, text, text, text, text) TO service_role;

-- R4-02: a rewrite - only the draft still at p_revision changes, together with its headings claim; a losing rewrite changes nothing
CREATE OR REPLACE FUNCTION public.agents_article_rewrite(p_article uuid, p_revision integer, p_he jsonb, p_en jsonb, p_he_norm text, p_en_norm text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_s public.site_articles%ROWTYPE; v_claim jsonb; v_focus text;
BEGIN
  SELECT * INTO v_s FROM public.site_articles WHERE id = p_article FOR UPDATE;
  IF NOT FOUND OR v_s.status <> 'draft' THEN RETURN jsonb_build_object('ok', false, 'code', 'article_not_draft'); END IF;
  IF v_s.revision <> p_revision THEN RETURN jsonb_build_object('ok', false, 'code', 'article_changed'); END IF;
  IF v_s.action_id IS NOT NULL THEN
    SELECT payload ->> 'focus' INTO v_focus FROM public.agent_actions WHERE id = v_s.action_id;
    v_claim := public.agents_article_claim_core(v_s.action_id, 'title', p_he_norm, p_en_norm, p_he ->> 'h1', p_en ->> 'h1', v_focus, NULL);
    IF (v_claim ->> 'ok')::boolean IS NOT TRUE THEN RETURN v_claim; END IF;
  END IF;
  UPDATE public.site_articles SET he = p_he, en = p_en, revision = p_revision + 1 WHERE id = p_article;
  RETURN jsonb_build_object('ok', true, 'revision', p_revision + 1);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_article_rewrite(uuid, integer, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_rewrite(uuid, integer, jsonb, jsonb, text, text) TO service_role;

-- R4-02: a publication - the draft at p_revision, its headings claimed for its flow (with the focus given now, if any), published
CREATE OR REPLACE FUNCTION public.agents_article_publish(p_article uuid, p_revision integer, p_he_norm text, p_en_norm text, p_focus text, p_focus_norm text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_s public.site_articles%ROWTYPE; v_claim jsonb;
BEGIN
  SELECT * INTO v_s FROM public.site_articles WHERE id = p_article FOR UPDATE;
  IF NOT FOUND OR v_s.status <> 'draft' THEN RETURN jsonb_build_object('ok', false, 'code', 'article_not_draft'); END IF;
  IF v_s.revision <> p_revision THEN RETURN jsonb_build_object('ok', false, 'code', 'article_changed'); END IF;
  IF v_s.action_id IS NOT NULL THEN
    IF nullif(btrim(p_focus), '') IS NOT NULL THEN
      UPDATE public.agent_actions SET payload = payload || jsonb_build_object('focus', left(btrim(p_focus), 300)) WHERE id = v_s.action_id;
      v_claim := public.agents_article_claim_core(v_s.action_id, 'topic',
        coalesce((SELECT norm FROM public.article_topic_claims WHERE ref_id = v_s.action_id AND kind = 'topic' AND lang = 'he' AND status = 'active' LIMIT 1), p_he_norm),
        coalesce((SELECT norm FROM public.article_topic_claims WHERE ref_id = v_s.action_id AND kind = 'topic' AND lang = 'en' AND status = 'active' LIMIT 1), p_en_norm),
        v_s.he ->> 'h1', v_s.en ->> 'h1', p_focus, p_focus_norm);
      IF (v_claim ->> 'ok')::boolean IS NOT TRUE THEN RETURN v_claim; END IF;
    END IF;
    v_claim := public.agents_article_claim_core(v_s.action_id, 'title', p_he_norm, p_en_norm, v_s.he ->> 'h1', v_s.en ->> 'h1', NULL, NULL);
    IF (v_claim ->> 'ok')::boolean IS NOT TRUE THEN RETURN v_claim; END IF;
  END IF;
  UPDATE public.site_articles SET status = 'published', published_at = now() WHERE id = p_article;
  RETURN jsonb_build_object('ok', true);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_article_publish(uuid, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_publish(uuid, integer, text, text, text, text) TO service_role;

-- R4-03: a rejection - refused while a fresh writing token is held (the writer finishes or the hold expires first); a waiting topic or a
-- waiting draft is rejected and its flow's identities are freed, in one transaction
CREATE OR REPLACE FUNCTION public.agents_article_reject(p_action uuid, p_hold_seconds integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_a public.agent_actions%ROWTYPE; v_s public.site_articles%ROWTYPE; v_flow uuid;
BEGIN
  SELECT * INTO v_a FROM public.agent_actions WHERE id = p_action AND action_type IN ('article_draft', 'article_publish') FOR UPDATE;
  IF NOT FOUND OR v_a.status <> 'proposed' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_pending'); END IF;
  IF v_a.action_type = 'article_draft' THEN
    IF coalesce(v_a.error, '') LIKE 'drafting:%' AND v_a.decided_at > now() - make_interval(secs => coalesce(p_hold_seconds, 900)) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'drafting');
    END IF;
    v_flow := p_action;
  ELSE
    SELECT * INTO v_s FROM public.site_articles WHERE id = (v_a.payload ->> 'articleId')::uuid FOR UPDATE;
    IF NOT FOUND OR v_s.status <> 'draft' THEN RETURN jsonb_build_object('ok', false, 'code', 'not_pending'); END IF;
    UPDATE public.site_articles SET status = 'rejected' WHERE id = v_s.id;
    v_flow := v_s.action_id;
  END IF;
  UPDATE public.agent_actions SET status = 'rejected', decided_at = now() WHERE id = p_action;
  IF v_flow IS NOT NULL THEN PERFORM public.agents_article_release(v_flow); END IF;
  RETURN jsonb_build_object('ok', true);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_article_reject(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_reject(uuid, integer) TO service_role;

-- the inventory also carries each claim's focus identity (R4-01 checkFocus)
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
        'focus', a.payload ->> 'focus', 'market', a.payload ->> 'market', 'created_at', a.created_at) ORDER BY a.created_at)
      FROM public.agent_actions a WHERE a.action_type = 'article_draft' AND a.status = 'proposed'), '[]'::jsonb),
    'claims', coalesce((SELECT jsonb_agg(jsonb_build_object('ref_id', c.ref_id, 'kind', c.kind, 'lang', c.lang, 'norm', c.norm, 'display', c.display,
        'focus', c.focus, 'focus_norm', c.focus_norm) ORDER BY c.created_at)
      FROM public.article_topic_claims c WHERE c.status = 'active'), '[]'::jsonb),
    'slugs', coalesce((SELECT jsonb_agg(s.slug ORDER BY s.slug) FROM public.site_articles s), '[]'::jsonb));
$function$;
REVOKE ALL ON FUNCTION public.agents_article_inventory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_article_inventory() TO service_role;

-- R4-11 ----------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.agents_ai_attempts ADD COLUMN IF NOT EXISTS run_ref text CHECK (run_ref IS NULL OR char_length(run_ref) <= 80);
ALTER TABLE public.agents_ai_attempts ADD COLUMN IF NOT EXISTS action_ref uuid;
ALTER TABLE public.agents_ai_attempts ADD COLUMN IF NOT EXISTS op_ref uuid;
ALTER TABLE public.agents_ai_attempts ADD COLUMN IF NOT EXISTS provider_ref text CHECK (provider_ref IS NULL OR char_length(provider_ref) <= 120);
CREATE INDEX IF NOT EXISTS agents_ai_attempts_op_idx ON public.agents_ai_attempts (op_ref) WHERE op_ref IS NOT NULL;

-- the same admission as 20261030200000, with the correlation of the attempt (the old 7-argument call keeps working through the defaults)
DROP FUNCTION IF EXISTS public.agents_ai_reserve(text, text, text, text, integer, integer, bigint);
CREATE OR REPLACE FUNCTION public.agents_ai_reserve(p_month text, p_purpose text, p_model text, p_rate_version text,
  p_max_input integer, p_max_output integer, p_reserved bigint, p_run_ref text DEFAULT NULL, p_action_ref uuid DEFAULT NULL, p_op_ref uuid DEFAULT NULL)
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
  INSERT INTO public.agents_ai_attempts (month, purpose, model, rate_version, max_input_tokens, max_output_tokens, reserved_micros, run_ref, action_ref, op_ref)
  VALUES (p_month, left(btrim(p_purpose), 60), left(btrim(p_model), 60), left(btrim(p_rate_version), 60), p_max_input, p_max_output, p_reserved,
          left(nullif(btrim(p_run_ref), ''), 80), p_action_ref, p_op_ref)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END
$function$;
REVOKE ALL ON FUNCTION public.agents_ai_reserve(text, text, text, text, integer, integer, bigint, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_ai_reserve(text, text, text, text, integer, integer, bigint, text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.agents_ai_note_provider(p_id uuid, p_provider_ref text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  UPDATE public.agents_ai_attempts SET provider_ref = left(p_provider_ref, 120) WHERE id = p_id AND provider_ref IS NULL AND nullif(btrim(p_provider_ref), '') IS NOT NULL;
$function$;
REVOKE ALL ON FUNCTION public.agents_ai_note_provider(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agents_ai_note_provider(uuid, text) TO service_role;
