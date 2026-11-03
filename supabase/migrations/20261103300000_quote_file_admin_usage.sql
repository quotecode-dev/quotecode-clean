-- ============================================================================================================================
-- 20261103300000_quote_file_admin_usage.sql  -  the Owner's cost view of "quote from a file" reads (numbers only)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-11-03 (typed: "מאשר תיקון כל אזכורי הצעת מחיר מקובץ לפי התוכנית (פעמון, צ'אט, מכסות ותנאי שימוש, יתרת קבצים
--   בצ'אט, טיפ יומי, מסך ניהול, סוכנת הרשתות, בדיקת הלקוח ברשימת חכם פלוס), כולל שינוי ב-L-05, L-06, L-11, L-12, L-14, L-17 ו-L-22,
--   שחרור עד הלייב"): an admin screen beside the Customer Twin cost view. Per Israel day: reads completed / given back, accounts,
--   tokens and the provider cost the Edge Function recorded (quote_file_read_claims.cost_micros, millionths of a US dollar).
--   Super admin only; numbers only - never a file, a line, a price or an account. Read-only.
-- Rollback of THIS file: DROP FUNCTION public.quote_file_admin_usage(integer);
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.quote_file_admin_usage(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 366);
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'quote_file_admin_usage: super admin only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('ok', true, 'days', coalesce((
    SELECT jsonb_agg(d ORDER BY d ->> 'day' DESC) FROM (
      SELECT jsonb_build_object(
        'day', to_char((c.created_at AT TIME ZONE 'Asia/Jerusalem')::date, 'YYYY-MM-DD'),
        'stored', count(*) FILTER (WHERE c.state = 'done'),
        'refunded', count(*) FILTER (WHERE c.state = 'refunded'),
        'accounts', count(DISTINCT c.user_id),
        'promptTokens', coalesce(sum(c.prompt_tokens), 0),
        'completionTokens', coalesce(sum(c.completion_tokens), 0),
        'estimatedCostUsd', round(coalesce(sum(c.cost_micros), 0) / 1000000.0, 4)) AS d
        FROM public.quote_file_read_claims c
       WHERE c.created_at >= now() - make_interval(days => v_days)
       GROUP BY (c.created_at AT TIME ZONE 'Asia/Jerusalem')::date) x), '[]'::jsonb));
END
$function$;
REVOKE ALL ON FUNCTION public.quote_file_admin_usage(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_file_admin_usage(integer) TO authenticated;
