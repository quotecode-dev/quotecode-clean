-- ============================================================================================================================
-- 20261031400000_marketing_truth.sql  -  Guy's weekly data: claimed before it is bought, unavailable is never "not found" (Codex F14 / F15)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-31 (typed: "מאשר את שש הקבוצות של קודקס לפי הסדר, כל אחת בשער משלה ועד הלייב, כולל שינוי ב-L-02, L-13, L-15,
--   L-17, L-18, L-22 ובנעילות של 30/10, החלטות א-ח והנוסחים כמומלץ"); docs/CODEX_REVIEW_RELEASES_2026-10-30.md group 3.
--   * marketing_rank_snapshots.our_status: 'checked' or 'unavailable' (our own ranking could not be read for that market) - an unavailable
--     keyword is never counted as "not found within the checked depth". NULL = rows written before this migration (read as checked).
--   * marketing_weeks: one row per Sunday-week - the collector claims the week with a lease BEFORE any paid request; a second collector
--     answers 'running' (or the stored result when the week completed); an expired lease or a week that did not complete is taken over
--     and resumes only the markets that did not complete (the result keeps its per-market state, opportunities and spend).
--   Service role only (new tables get no automatic API grant - explicit grants below). 20261031000000 is not edited.
--   ROLLBACK: the column is nullable; the table is read only by the new collector.
-- ============================================================================================================================

ALTER TABLE public.marketing_rank_snapshots ADD COLUMN IF NOT EXISTS our_status text CHECK (our_status IS NULL OR our_status IN ('checked', 'unavailable'));

CREATE TABLE IF NOT EXISTS public.marketing_weeks (
  week         date         PRIMARY KEY,
  run_key      text         NOT NULL CHECK (char_length(run_key) BETWEEN 1 AND 120),
  lease_until  timestamptz  NOT NULL,
  state        text         CHECK (state IS NULL OR state IN ('ok', 'partial', 'unavailable', 'budget_blocked', 'not_configured', 'running')),
  result       jsonb,
  finished_at  timestamptz,
  updated_at   timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.marketing_weeks IS 'Codex F15 (Owner 2026-10-31): the weekly competitor collection, claimed before any paid request; service role only.';
ALTER TABLE public.marketing_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_weeks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketing_weeks FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.marketing_weeks TO service_role;

CREATE OR REPLACE FUNCTION public.marketing_week_claim(p_week date, p_run text, p_lease_seconds integer DEFAULT 900)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE w public.marketing_weeks%ROWTYPE; v_rows integer;
BEGIN
  IF p_week IS NULL OR coalesce(p_run, '') = '' OR p_lease_seconds IS NULL OR p_lease_seconds < 60 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'marketing_week_invalid' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.marketing_weeks (week, run_key, lease_until) VALUES (p_week, left(p_run, 120), now() + make_interval(secs => p_lease_seconds))
  ON CONFLICT (week) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN RETURN jsonb_build_object('status', 'claimed', 'previous', NULL); END IF;
  SELECT * INTO w FROM public.marketing_weeks WHERE week = p_week FOR UPDATE;
  IF w.finished_at IS NOT NULL AND w.state = 'ok' THEN RETURN jsonb_build_object('status', 'done', 'result', w.result); END IF;
  IF w.finished_at IS NULL AND w.lease_until > now() AND w.run_key <> p_run THEN RETURN jsonb_build_object('status', 'running'); END IF;
  -- a week that did not complete, or a lease that expired (a worker that died): taken over; the previous result says what is done
  UPDATE public.marketing_weeks SET run_key = left(p_run, 120), lease_until = now() + make_interval(secs => p_lease_seconds), finished_at = NULL, updated_at = now()
   WHERE week = p_week;
  RETURN jsonb_build_object('status', 'claimed', 'previous', w.result);
END
$function$;
REVOKE ALL ON FUNCTION public.marketing_week_claim(date, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_week_claim(date, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.marketing_week_finish(p_week date, p_run text, p_state text, p_result jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_rows integer;
BEGIN
  IF p_state IS NULL OR p_state NOT IN ('ok', 'partial', 'unavailable', 'budget_blocked', 'not_configured') THEN RETURN false; END IF;
  -- only the run that holds the claim writes the result (a run whose lease was taken over writes nothing)
  UPDATE public.marketing_weeks SET state = p_state, result = p_result, finished_at = now(), updated_at = now()
   WHERE week = p_week AND run_key = p_run AND finished_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END
$function$;
REVOKE ALL ON FUNCTION public.marketing_week_finish(date, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_week_finish(date, text, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
