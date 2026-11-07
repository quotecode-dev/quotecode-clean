-- Owner console 2026-11-07 (typed: "מאשר את שחרור ד׳ ושחרור ה׳ לפי ההמלצות, סעיף 3 לספור, סעיף 9 בלי אזור זמן, כולל שינוי ב-L-01, L-05,
-- L-06, L-09, L-11, L-12, L-14, L-17, L-22" + "מאשר את התוכנית לשחרור ה׳ ואחריו שחרור ד׳ כפי שהוצגה"): release D, the SMART PACK usage meter
-- tekango-migration-contract: mode=transaction replay=required
-- accuracy (Codex M02 / M03).
--   1. The reserve of an action may be given in micro-USD (p_reserve_usd_micros, its proven maximum computed by the Edge Function) and is
--      converted at TODAY's rate (smart_pack_usd_ils_rate) - never at a fixed 3.5. The old two-argument call keeps working.
--   2. An action left 'claimed' for 10 minutes (the provider answered but its finish never landed) is COUNTED at its reserve - "סעיף 3
--      לספור" - instead of being given back. Such a row is marked model = 'reserve_not_finished'.
-- Nothing else changes: the monthly budget, the rate rule, the finish, the views.

-- the meter of one account this Israel month: a stale claimed action counts at its reserve (it is converted to 'done' by the next claim)
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
  SELECT coalesce(sum(c.cost_micros) FILTER (WHERE c.state = 'done'), 0)
         + coalesce(sum(c.reserve_micros) FILTER (WHERE c.state = 'claimed' AND c.created_at <= now() - interval '10 minutes'), 0),
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
    'percentLeft', CASE WHEN v_admin THEN 100 WHEN v_used >= v_budget THEN 0
                        ELSE greatest(floor((v_budget - v_used) * 100.0 / v_budget), 1)::integer END);
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_usage_state(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- start ONE metered action (the caller): the two-argument form is replaced by one with an optional micro-USD reserve
DROP FUNCTION IF EXISTS public.smart_pack_usage_claim(text, bigint);
CREATE OR REPLACE FUNCTION public.smart_pack_usage_claim(p_feature text, p_reserve_micros bigint, p_reserve_usd_micros bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_state   jsonb;
  v_claim   uuid;
  v_reserve bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'smart_pack_usage_claim: not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_feature IS NULL OR p_feature NOT IN ('chat_data', 'voice', 'ai_draft', 'file_quote', 'customer_twin')
     OR p_reserve_micros IS NULL OR p_reserve_micros <= 0 OR p_reserve_micros > 2000000
     OR (p_reserve_usd_micros IS NOT NULL AND (p_reserve_usd_micros <= 0 OR p_reserve_usd_micros > 1000000)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  -- the proven maximum in USD, at today's rate (at most 2 ILS, the table's own bound)
  v_reserve := CASE WHEN p_reserve_usd_micros IS NULL THEN p_reserve_micros
                    ELSE least(greatest(ceil(p_reserve_usd_micros * public.smart_pack_usd_ils_rate())::bigint, 1), 2000000) END;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-smart-pack-usage:' || v_uid::text));
  -- an action left 'claimed' for 10 minutes is COUNTED at its reserve (the Owner: "סעיף 3 לספור")
  UPDATE public.smart_pack_usage_claims c SET state = 'done', finished_at = now(), cost_micros = c.reserve_micros,
         model = coalesce(c.model, 'reserve_not_finished')
   WHERE c.user_id = v_uid AND c.state = 'claimed' AND c.created_at < now() - interval '10 minutes';
  IF (SELECT count(*) FROM public.smart_pack_usage_claims c WHERE c.user_id = v_uid AND c.created_at > now() - interval '1 minute') >= 20 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'too_many_requests', 'status', public.smart_pack_usage_state(v_uid));
  END IF;
  v_state := public.smart_pack_usage_state(v_uid);
  IF NOT (v_state ->> 'smartPack')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'code', 'smart_pack_required', 'status', v_state);
  END IF;
  IF NOT (v_state ->> 'unlimited')::boolean AND (v_state ->> 'remainingMicros')::bigint < v_reserve THEN
    RETURN jsonb_build_object('ok', false, 'code', 'budget_exhausted', 'status', v_state);
  END IF;
  INSERT INTO public.smart_pack_usage_claims (user_id, feature, usage_month, reserve_micros, exempt)
  VALUES (v_uid, p_feature, to_date(v_state ->> 'month', 'YYYY-MM'), v_reserve, (v_state ->> 'unlimited')::boolean)
  RETURNING claim_id INTO v_claim;
  RETURN jsonb_build_object('ok', true, 'claimId', v_claim, 'status', public.smart_pack_usage_state(v_uid));
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_usage_claim(text, bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.smart_pack_usage_claim(text, bigint, bigint) TO authenticated;
