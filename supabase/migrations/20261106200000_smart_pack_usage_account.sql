-- ============================================================================================================================
-- 20261106200000_smart_pack_usage_account.sql  -  the SMART PACK usage of ONE account, for the admin's user card
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-11-06 (typed: "מאשר את שחרור ג׳, כולל שינוי ב-L-06, L-09, L-14, L-17 ו-L-22"; the request: "אני רוצה לראות
--   שימוש של משתמש בכרטיס שלו"): the admin's user details show that account's SMART PACK usage this Israel month - the same numbers
--   the meter itself decides by (public.smart_pack_usage_state: done actions only), the actions counted and a per-day series for the
--   graph. Super admin only (server-checked), read-only, numbers only - never any content. Nothing else changes.
-- Rollback of THIS file: DROP FUNCTION public.smart_pack_usage_account(uuid);
-- ============================================================================================================================
CREATE OR REPLACE FUNCTION public.smart_pack_usage_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_month  date := date_trunc('month', (now() AT TIME ZONE 'Asia/Jerusalem'))::date;
  v_budget bigint := public.smart_pack_monthly_budget_micros();
  v_state  jsonb;
  v_used   bigint;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'smart_pack_usage_account: super admin only' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  v_state := public.smart_pack_usage_state(p_user_id);
  v_used := coalesce((v_state ->> 'usedMicros')::bigint, 0);
  RETURN jsonb_build_object('ok', true,
    'month', v_state ->> 'month',
    'smartPack', (v_state ->> 'smartPack')::boolean,
    'unlimited', (v_state ->> 'unlimited')::boolean,
    'budgetIls', round(v_budget / 1000000.0, 2),
    'usedIls', round(v_used / 1000000.0, 4),
    'percentUsed', round(v_used * 100.0 / v_budget, 1),
    'percentLeft', (v_state ->> 'percentLeft')::integer,
    'actions', (SELECT count(*) FROM public.smart_pack_usage_claims c WHERE c.user_id = p_user_id AND c.usage_month = v_month AND c.state = 'done'),
    'days', coalesce((
      SELECT jsonb_agg(d ORDER BY d ->> 'day') FROM (
        SELECT jsonb_build_object(
          'day', to_char((c.created_at AT TIME ZONE 'Asia/Jerusalem')::date, 'YYYY-MM-DD'),
          'actions', count(*),
          'costIls', round(coalesce(sum(c.cost_micros), 0) / 1000000.0, 4)) AS d
          FROM public.smart_pack_usage_claims c
         WHERE c.user_id = p_user_id AND c.usage_month = v_month AND c.state = 'done'
         GROUP BY (c.created_at AT TIME ZONE 'Asia/Jerusalem')::date) x), '[]'::jsonb));
END
$function$;
REVOKE ALL ON FUNCTION public.smart_pack_usage_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.smart_pack_usage_account(uuid) TO authenticated;
