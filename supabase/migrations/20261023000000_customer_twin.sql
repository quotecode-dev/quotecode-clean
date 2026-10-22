-- ============================================================================================================================
-- 20261023000000_customer_twin.sql  -  Customer Twin ("בדיקת הלקוח"): the AI check allowance, purchased checks and stored results
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-22 (night task, docs/NIGHT_TASK_PLAN_2026-10-22.md; typed approvals for the build and the entry buttons):
--   the AI analysis of a quote before it is sent (three customer perspectives) belongs to SMART PACK (Owner 2026-10-20); a SMART PACK
--   account (bought, the free 7 days, LIFETIME) gets 20 AI checks per Israel calendar month; checks bought separately (20 more for a
--   SMART PACK account, 10 for an account without it - 5 ILS each, the purchase opens with billing) never expire and are used only
--   after the month's 20 ("ה־6 נשארות לו עד שישתמש בהן ... הוא שילם עליהן, אז הן שלו"). While free_issue is not enforced the plan
--   system is inert (L-05): every account counts as SMART PACK for this check, the 20 a month still apply (cost guard).
--   * customer_twin_usage   - the included checks used per user and Israel month (written only by the functions below).
--   * customer_twin_credits - the purchased checks left (balance) and the size of the current purchased run (window_total: "4 of 10").
--   * customer_twin_credit_ledger - append-only record of every purchase / use / refund of a purchased check.
--   * customer_twin_claims  - one row per AI check started (claimed -> stored | refunded): a failed AI call gives the check back.
--   * customer_twin_results - the stored analysis per user and content hash: the same quote content is never charged twice.
--   Every table is closed to the app (RLS on, no policy, no grant); the app reaches it ONLY through customer_twin_status() and
--   customer_twin_claim() (the CALLER, auth.uid()); storing / refunding / granting purchased checks is the service role's (the Edge
--   Function customer-twin, and the billing webhook once purchases open). The quota fails closed: no allowance, no AI call.
-- Rollback of THIS file: DROP FUNCTION public.customer_twin_grant_credits(uuid, integer, text), public.customer_twin_refund(uuid),
--   public.customer_twin_store(uuid, jsonb, text, text), public.customer_twin_claim(text), public.customer_twin_status(),
--   public.customer_twin_state(uuid), public.customer_twin_monthly_limit(); DROP TABLE public.customer_twin_results,
--   public.customer_twin_claims, public.customer_twin_credit_ledger, public.customer_twin_credits, public.customer_twin_usage.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.customer_twin_usage (
  user_id      uuid    NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  usage_month  date    NOT NULL CHECK (usage_month = date_trunc('month', usage_month)::date),
  checks       integer NOT NULL DEFAULT 0 CHECK (checks >= 0),
  PRIMARY KEY (user_id, usage_month)
);
ALTER TABLE public.customer_twin_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_twin_usage FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.customer_twin_credits (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  balance      integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  window_total integer     NOT NULL DEFAULT 0 CHECK (window_total >= balance),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_twin_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_twin_credits FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.customer_twin_credit_ledger (
  entry_id   bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid        NOT NULL,
  delta      integer     NOT NULL CHECK (delta <> 0),
  kind       text        NOT NULL CHECK (kind IN ('purchase', 'use', 'refund')),
  ref        text        NULL CHECK (ref IS NULL OR length(ref) BETWEEN 1 AND 200),
  claim_id   uuid        NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'purchase' OR (delta > 0 AND ref IS NOT NULL AND claim_id IS NULL)),
  CHECK (kind = 'purchase' OR claim_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_twin_credit_purchase_ref ON public.customer_twin_credit_ledger (ref) WHERE kind = 'purchase';
CREATE INDEX IF NOT EXISTS customer_twin_credit_ledger_user ON public.customer_twin_credit_ledger (user_id, entry_id);
ALTER TABLE public.customer_twin_credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_twin_credit_ledger FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS customer_twin_credit_ledger_append_only ON public.customer_twin_credit_ledger;
CREATE TRIGGER customer_twin_credit_ledger_append_only BEFORE UPDATE OR DELETE ON public.customer_twin_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();
DROP TRIGGER IF EXISTS customer_twin_credit_ledger_no_truncate ON public.customer_twin_credit_ledger;
CREATE TRIGGER customer_twin_credit_ledger_no_truncate BEFORE TRUNCATE ON public.customer_twin_credit_ledger
  FOR EACH STATEMENT EXECUTE FUNCTION public.append_only_guard();

CREATE TABLE IF NOT EXISTS public.customer_twin_claims (
  claim_id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content_sha256 text        NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  source         text        NOT NULL CHECK (source IN ('monthly', 'purchased')),
  usage_month    date        NOT NULL,
  state          text        NOT NULL DEFAULT 'claimed' CHECK (state IN ('claimed', 'stored', 'refunded')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz NULL
);
CREATE INDEX IF NOT EXISTS customer_twin_claims_user ON public.customer_twin_claims (user_id, created_at DESC);
ALTER TABLE public.customer_twin_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_twin_claims FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.customer_twin_results (
  user_id        uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content_sha256 text        NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  result         jsonb       NOT NULL CHECK (jsonb_typeof(result) = 'object' AND octet_length(result::text) <= 20000),
  model          text        NOT NULL CHECK (length(model) BETWEEN 1 AND 80),
  prompt_version text        NOT NULL CHECK (length(prompt_version) BETWEEN 1 AND 40),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_sha256)
);
ALTER TABLE public.customer_twin_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_twin_results FROM PUBLIC, anon, authenticated, service_role;

-- the ONE place of the included monthly checks
CREATE OR REPLACE FUNCTION public.customer_twin_monthly_limit()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $function$ SELECT 20 $function$;
GRANT EXECUTE ON FUNCTION public.customer_twin_monthly_limit() TO authenticated, service_role;

-- the allowance of one account (no auth check: internal, called by the definer functions below)
CREATE OR REPLACE FUNCTION public.customer_twin_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_enforced boolean := EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced');
  v_entitled boolean;
  v_month    date := date_trunc('month', (now() AT TIME ZONE 'Asia/Jerusalem'))::date;
  v_used     integer;
  v_cred     public.customer_twin_credits%ROWTYPE;
  v_limit    integer := public.customer_twin_monthly_limit();
BEGIN
  v_entitled := NOT v_enforced OR public.smart_pack_active(p_user_id);
  SELECT u.checks INTO v_used FROM public.customer_twin_usage u WHERE u.user_id = p_user_id AND u.usage_month = v_month;
  SELECT * INTO v_cred FROM public.customer_twin_credits c WHERE c.user_id = p_user_id;
  RETURN jsonb_build_object(
    'enforced', v_enforced,
    'smartPack', v_entitled,
    'monthlyLimit', CASE WHEN v_entitled THEN v_limit ELSE 0 END,
    'monthlyUsed', CASE WHEN v_entitled THEN least(coalesce(v_used, 0), v_limit) ELSE 0 END,
    'monthlyRemaining', CASE WHEN v_entitled THEN greatest(v_limit - coalesce(v_used, 0), 0) ELSE 0 END,
    'purchasedRemaining', coalesce(v_cred.balance, 0),
    'purchasedTotal', coalesce(v_cred.window_total, 0),
    'purchasePackSize', CASE WHEN v_entitled THEN 20 ELSE 10 END,
    'month', to_char(v_month, 'YYYY-MM'));
END
$function$;
REVOKE ALL ON FUNCTION public.customer_twin_state(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- the caller's own counters ("נשארו לך 2 מתוך 20" / "4 מתוך 10")
CREATE OR REPLACE FUNCTION public.customer_twin_status()
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
    RAISE EXCEPTION 'customer_twin_status: not authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('ok', true) || public.customer_twin_state(v_uid);
END
$function$;
REVOKE ALL ON FUNCTION public.customer_twin_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_twin_status() TO authenticated;

-- start ONE AI check for the caller: a stored result of the same content is returned free; otherwise one included check of the month
-- (SMART PACK) or one purchased check is used, atomically (one account at a time). No allowance = refused, nothing used.
CREATE OR REPLACE FUNCTION public.customer_twin_claim(p_content_sha256 text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_state  jsonb;
  v_month  date := date_trunc('month', (now() AT TIME ZONE 'Asia/Jerusalem'))::date;
  v_res    public.customer_twin_results%ROWTYPE;
  v_source text;
  v_claim  uuid;
  v_used   integer;
  v_limit  integer := public.customer_twin_monthly_limit();
  v_stale  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'customer_twin_claim: not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_content_sha256 IS NULL OR p_content_sha256 !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-customer-twin:' || v_uid::text));
  -- a check left 'claimed' for 10 minutes (the request died before storing or refunding) gives its allowance back first
  FOR v_stale IN SELECT c.claim_id FROM public.customer_twin_claims c
                  WHERE c.user_id = v_uid AND c.state = 'claimed' AND c.created_at < now() - interval '10 minutes' LOOP
    PERFORM public.customer_twin_refund(v_stale);
  END LOOP;
  SELECT * INTO v_res FROM public.customer_twin_results r WHERE r.user_id = v_uid AND r.content_sha256 = p_content_sha256;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'cached', true, 'result', v_res.result, 'createdAt', v_res.created_at,
                              'status', public.customer_twin_state(v_uid));
  END IF;
  -- the same content already being checked (a double click): never two checks for one answer
  IF EXISTS (SELECT 1 FROM public.customer_twin_claims c WHERE c.user_id = v_uid AND c.content_sha256 = p_content_sha256
              AND c.state = 'claimed' AND c.created_at > now() - interval '2 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'in_progress', 'status', public.customer_twin_state(v_uid));
  END IF;
  -- every failed check is given back but still cost a model call: 10 failures in 24 hours = no more tries today
  IF (SELECT count(*) FROM public.customer_twin_claims c WHERE c.user_id = v_uid AND c.state = 'refunded'
        AND c.finished_at > now() - interval '24 hours') >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'too_many_failures', 'status', public.customer_twin_state(v_uid));
  END IF;
  v_state := public.customer_twin_state(v_uid);
  IF (v_state ->> 'smartPack')::boolean THEN
    INSERT INTO public.customer_twin_usage AS u (user_id, usage_month, checks) VALUES (v_uid, v_month, 1)
    ON CONFLICT (user_id, usage_month) DO UPDATE SET checks = u.checks + 1 WHERE u.checks < v_limit
    RETURNING u.checks INTO v_used;
    IF v_used IS NOT NULL THEN v_source := 'monthly'; END IF;
  END IF;
  IF v_source IS NULL THEN
    UPDATE public.customer_twin_credits c SET balance = c.balance - 1, updated_at = now()
     WHERE c.user_id = v_uid AND c.balance > 0
    RETURNING c.balance INTO v_used;
    IF v_used IS NOT NULL THEN v_source := 'purchased'; END IF;
  END IF;
  IF v_source IS NULL THEN
    RETURN jsonb_build_object('ok', false,
      'code', CASE WHEN (v_state ->> 'smartPack')::boolean THEN 'quota_exhausted' ELSE 'smart_pack_required' END,
      'status', v_state);
  END IF;
  INSERT INTO public.customer_twin_claims (user_id, content_sha256, source, usage_month)
  VALUES (v_uid, p_content_sha256, v_source, v_month) RETURNING claim_id INTO v_claim;
  IF v_source = 'purchased' THEN
    INSERT INTO public.customer_twin_credit_ledger (user_id, delta, kind, claim_id) VALUES (v_uid, -1, 'use', v_claim);
  END IF;
  RETURN jsonb_build_object('ok', true, 'cached', false, 'claimId', v_claim, 'source', v_source,
                            'status', public.customer_twin_state(v_uid));
END
$function$;
REVOKE ALL ON FUNCTION public.customer_twin_claim(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_twin_claim(text) TO authenticated;

-- the Edge Function stores a VALIDATED analysis for its claim (service role); the claim's content hash is the key
CREATE OR REPLACE FUNCTION public.customer_twin_store(p_claim_id uuid, p_result jsonb, p_model text, p_prompt_version text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claim public.customer_twin_claims%ROWTYPE;
BEGIN
  SELECT * INTO v_claim FROM public.customer_twin_claims c WHERE c.claim_id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'no_claim'); END IF;
  IF v_claim.state <> 'claimed' THEN RETURN jsonb_build_object('ok', false, 'code', 'already_finished'); END IF;
  IF p_result IS NULL OR jsonb_typeof(p_result) <> 'object' OR p_model IS NULL OR p_prompt_version IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  INSERT INTO public.customer_twin_results (user_id, content_sha256, result, model, prompt_version)
  VALUES (v_claim.user_id, v_claim.content_sha256, p_result, p_model, p_prompt_version)
  ON CONFLICT (user_id, content_sha256) DO NOTHING;
  UPDATE public.customer_twin_claims SET state = 'stored', finished_at = now() WHERE claim_id = p_claim_id;
  RETURN jsonb_build_object('ok', true, 'status', public.customer_twin_state(v_claim.user_id));
END
$function$;
REVOKE ALL ON FUNCTION public.customer_twin_store(uuid, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_twin_store(uuid, jsonb, text, text) TO service_role;

-- the AI call failed / its answer was invalid: the check is given back (never charged for nothing)
CREATE OR REPLACE FUNCTION public.customer_twin_refund(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claim public.customer_twin_claims%ROWTYPE;
BEGIN
  SELECT * INTO v_claim FROM public.customer_twin_claims c WHERE c.claim_id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'no_claim'); END IF;
  IF v_claim.state <> 'claimed' THEN RETURN jsonb_build_object('ok', false, 'code', 'already_finished'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-customer-twin:' || v_claim.user_id::text));
  IF v_claim.source = 'monthly' THEN
    UPDATE public.customer_twin_usage u SET checks = greatest(u.checks - 1, 0)
     WHERE u.user_id = v_claim.user_id AND u.usage_month = v_claim.usage_month;
  ELSE
    -- never capped: a purchase that arrived during the failed call restarted the run; the check is still the owner's
    UPDATE public.customer_twin_credits c SET balance = c.balance + 1, window_total = greatest(c.window_total, c.balance + 1), updated_at = now()
     WHERE c.user_id = v_claim.user_id;
    INSERT INTO public.customer_twin_credit_ledger (user_id, delta, kind, claim_id) VALUES (v_claim.user_id, 1, 'refund', p_claim_id);
  END IF;
  UPDATE public.customer_twin_claims SET state = 'refunded', finished_at = now() WHERE claim_id = p_claim_id;
  RETURN jsonb_build_object('ok', true, 'status', public.customer_twin_state(v_claim.user_id));
END
$function$;
REVOKE ALL ON FUNCTION public.customer_twin_refund(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_twin_refund(uuid) TO service_role;

-- purchased checks (service role: the billing webhook once purchases open, or the Owner's admin tool): idempotent per purchase ref.
-- A purchase on an empty balance starts a new run ("4 of 10"); on a balance it adds to the run.
CREATE OR REPLACE FUNCTION public.customer_twin_grant_credits(p_user_id uuid, p_checks integer, p_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_checks IS NULL OR p_checks NOT IN (10, 20) OR p_ref IS NULL OR length(p_ref) NOT BETWEEN 1 AND 200 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN RETURN jsonb_build_object('ok', false, 'code', 'no_account'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-customer-twin:' || p_user_id::text));
  IF EXISTS (SELECT 1 FROM public.customer_twin_credit_ledger l WHERE l.kind = 'purchase' AND l.ref = p_ref) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'status', public.customer_twin_state(p_user_id));
  END IF;
  INSERT INTO public.customer_twin_credits AS c (user_id, balance, window_total) VALUES (p_user_id, p_checks, p_checks)
  ON CONFLICT (user_id) DO UPDATE
    SET window_total = CASE WHEN c.balance = 0 THEN p_checks ELSE c.window_total + p_checks END,
        balance = c.balance + p_checks, updated_at = now();
  INSERT INTO public.customer_twin_credit_ledger (user_id, delta, kind, ref) VALUES (p_user_id, p_checks, 'purchase', p_ref);
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'status', public.customer_twin_state(p_user_id));
END
$function$;
REVOKE ALL ON FUNCTION public.customer_twin_grant_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_twin_grant_credits(uuid, integer, text) TO service_role;
