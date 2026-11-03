-- ============================================================================================================================
-- 20261103100000_quote_file_reads.sql  -  "Quote from a file": the SMART PACK allowance of file reads (no file content, ever)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-11-03 (typed: "מאשר הפעלת ארבעת הסוכנים ובניית הצעה מקובץ לפי האפיון וששת ההחלטות שלי, כולל שינוי ב-L-05,
--   L-06, L-09, L-12, L-14, L-15, L-17, L-22, L-23, L-24, L-25, L-27 ו-L-28, שחרור עד הלייב"; spec docs/CODEX_SPEC_QUOTE_FROM_FILE_2026-11-03.md):
--   one PDF or JPG is read by the AI provider into draft lines; the file is never stored ("לא ישמור את הקובץ ... רק ידלה פרטים
--   וימחק את הקובץ"). Part of SMART PACK: 50 reads per Israel calendar month (bought SMART PACK, LIFETIME), 3 in the free 7 days.
--   While free_issue is not enforced the plan system is inert (L-05): every account counts as SMART PACK, the 50 still apply.
--   * quote_file_read_claims - one row per read started (claimed -> done | refunded): ids, period, state, model, token counts,
--     provider time and cost estimate ONLY. Never a file name, hash, page text, line or price.
--   The table is closed to the app (RLS on, no policy, no grant); the app reaches it ONLY through quote_file_read_status() and
--   quote_file_read_claim() (the CALLER, auth.uid()); finishing / refunding is the service role's (the Edge Function quote-from-file).
--   The allowance fails closed: no allowance, no AI call.
-- Rollback of THIS file: DROP FUNCTION public.quote_file_read_finish(uuid, boolean, text, integer, integer, integer, integer),
--   public.quote_file_read_claim(), public.quote_file_read_status(), public.quote_file_read_state(uuid);
--   DROP TABLE public.quote_file_read_claims.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.quote_file_read_claims (
  claim_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  period            text        NOT NULL CHECK (period ~ '^(free|[0-9]{4}-[0-9]{2})$'),
  state             text        NOT NULL DEFAULT 'claimed' CHECK (state IN ('claimed', 'done', 'refunded')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz NULL,
  -- usage for the Owner's cost view (never file content)
  model             text        NULL CHECK (model IS NULL OR length(model) BETWEEN 1 AND 80),
  prompt_tokens     integer     NULL CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens integer     NULL CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
  provider_ms       integer     NULL CHECK (provider_ms IS NULL OR provider_ms >= 0),
  cost_micros       integer     NULL CHECK (cost_micros IS NULL OR cost_micros >= 0)
);
CREATE INDEX IF NOT EXISTS quote_file_read_claims_user ON public.quote_file_read_claims (user_id, created_at DESC);
ALTER TABLE public.quote_file_read_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quote_file_read_claims FROM PUBLIC, anon, authenticated, service_role;

-- the allowance of one account (internal, called by the definer functions below)
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
  v_limit    integer;
  v_used     integer;
  v_cost     bigint;
BEGIN
  IF v_enforced THEN
    v_sp := public.smart_pack_state(p_user_id);
    v_entitled := coalesce((v_sp ->> 'active')::boolean, false);
  ELSE
    v_sp := jsonb_build_object('source', NULL);
    v_entitled := true;
  END IF;
  IF v_entitled AND (v_sp ->> 'source') = 'free_window' THEN
    v_period := 'free'; v_limit := 3;
  ELSE
    v_period := to_char(date_trunc('month', (now() AT TIME ZONE 'Asia/Jerusalem')), 'YYYY-MM'); v_limit := 50;
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
    -- the internal cost cap: US$10 of provider cost per account and period, whatever the count
    'costCapReached', v_cost >= 10000000);
END
$function$;
REVOKE ALL ON FUNCTION public.quote_file_read_state(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- the caller's own counters ("נשארו לכם 47 מתוך 50 קבצים החודש")
CREATE OR REPLACE FUNCTION public.quote_file_read_status()
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
    RAISE EXCEPTION 'quote_file_read_status: not authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('ok', true) || public.quote_file_read_state(v_uid);
END
$function$;
REVOKE ALL ON FUNCTION public.quote_file_read_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_file_read_status() TO authenticated;

-- start ONE file read for the caller, atomically (one account at a time, one read in flight). No allowance = refused, nothing used.
CREATE OR REPLACE FUNCTION public.quote_file_read_claim()
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
    RAISE EXCEPTION 'quote_file_read_claim: not authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-quote-file-read:' || v_uid::text));
  -- a read left 'claimed' for 10 minutes (the request died) gives its allowance back first
  UPDATE public.quote_file_read_claims c SET state = 'refunded', finished_at = now()
   WHERE c.user_id = v_uid AND c.state = 'claimed' AND c.created_at < now() - interval '10 minutes';
  IF EXISTS (SELECT 1 FROM public.quote_file_read_claims c WHERE c.user_id = v_uid AND c.state = 'claimed') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'in_progress', 'status', public.quote_file_read_state(v_uid));
  END IF;
  -- every failed read is given back but still cost a provider call: 10 failures in 24 hours = no more tries today
  IF (SELECT count(*) FROM public.quote_file_read_claims c WHERE c.user_id = v_uid AND c.state = 'refunded'
        AND c.finished_at > now() - interval '24 hours') >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'too_many_failures', 'status', public.quote_file_read_state(v_uid));
  END IF;
  v_state := public.quote_file_read_state(v_uid);
  IF NOT (v_state ->> 'smartPack')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'code', 'smart_pack_required', 'status', v_state);
  END IF;
  IF (v_state ->> 'remaining')::integer <= 0 OR (v_state ->> 'costCapReached')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'code', 'quota_exhausted', 'status', v_state);
  END IF;
  INSERT INTO public.quote_file_read_claims (user_id, period) VALUES (v_uid, v_state ->> 'period') RETURNING claim_id INTO v_claim;
  RETURN jsonb_build_object('ok', true, 'claimId', v_claim, 'status', public.quote_file_read_state(v_uid));
END
$function$;
REVOKE ALL ON FUNCTION public.quote_file_read_claim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_file_read_claim() TO authenticated;

-- the Edge Function finishes its claim (service role): ok = the read is counted ('done'); not ok = given back ('refunded').
-- Usage of a failed call is kept for the cost view. Lock order as everywhere: the account's advisory lock FIRST, then the row.
CREATE OR REPLACE FUNCTION public.quote_file_read_finish(p_claim_id uuid, p_ok boolean, p_model text DEFAULT NULL,
  p_prompt_tokens integer DEFAULT NULL, p_completion_tokens integer DEFAULT NULL, p_provider_ms integer DEFAULT NULL,
  p_cost_micros integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user  uuid;
  v_claim public.quote_file_read_claims%ROWTYPE;
BEGIN
  SELECT c.user_id INTO v_user FROM public.quote_file_read_claims c WHERE c.claim_id = p_claim_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'no_claim'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-quote-file-read:' || v_user::text));
  SELECT * INTO v_claim FROM public.quote_file_read_claims c WHERE c.claim_id = p_claim_id FOR UPDATE;
  IF v_claim.state <> 'claimed' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_finished', 'status', public.quote_file_read_state(v_user));
  END IF;
  UPDATE public.quote_file_read_claims SET state = CASE WHEN p_ok THEN 'done' ELSE 'refunded' END, finished_at = now(),
         model = left(p_model, 80), prompt_tokens = greatest(p_prompt_tokens, 0), completion_tokens = greatest(p_completion_tokens, 0),
         provider_ms = greatest(p_provider_ms, 0), cost_micros = greatest(p_cost_micros, 0)
   WHERE claim_id = p_claim_id;
  RETURN jsonb_build_object('ok', true, 'status', public.quote_file_read_state(v_user));
END
$function$;
REVOKE ALL ON FUNCTION public.quote_file_read_finish(uuid, boolean, text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_file_read_finish(uuid, boolean, text, integer, integer, integer, integer) TO service_role;
