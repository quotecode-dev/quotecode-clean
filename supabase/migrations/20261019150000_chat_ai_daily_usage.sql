-- ============================================================================================================================
-- 20261019150000_chat_ai_daily_usage.sql  -  the smart chat's daily question allowance (30 model questions per user per day)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-19 (task-control activeTask.smartChatTools20261019): the smart chat reads the user's own data with
--   read-only tools and a stronger model only when tools are needed; "כמה שאלות ביום מותר לכל משתמש בצ'אט? - 30 ביום (מומלץ)";
--   L-17 unlocked by the Owner for the smart chat ("צ'אט החכם: עדיין צריך את אישור ההקלדה לפריט הנעול 17 ... - מאשר").
--   chat_ai_daily_usage holds one counter row per user and UTC day. Nobody reads or writes it directly (RLS on, no policy, no
--   grant); the only writer is chat_ai_claim_question(), which counts ONE question for the CALLER (auth.uid(), no argument) and
--   refuses once the day's 30 are used - atomically, so parallel requests can never pass the cap. Additive: no existing row changes.
-- Rollback of THIS file: DROP FUNCTION public.chat_ai_claim_question(); DROP TABLE public.chat_ai_daily_usage;
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.chat_ai_daily_usage (
  user_id    uuid    NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  usage_day  date    NOT NULL,
  questions  integer NOT NULL DEFAULT 0 CHECK (questions >= 0),
  PRIMARY KEY (user_id, usage_day)
);
COMMENT ON TABLE public.chat_ai_daily_usage IS
  'Owner 2026-10-19: smart-chat model questions per user per UTC day (cap 30) - written only by chat_ai_claim_question().';
ALTER TABLE public.chat_ai_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_ai_daily_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.chat_ai_claim_question()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  c_limit CONSTANT integer := 30;
  v_uid   uuid := auth.uid();
  v_day   date := (pg_catalog.now() AT TIME ZONE 'UTC')::date;
  v_used  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'chat_ai_claim_question: not authenticated' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.chat_ai_daily_usage AS u (user_id, usage_day, questions)
  VALUES (v_uid, v_day, 1)
  ON CONFLICT (user_id, usage_day) DO UPDATE SET questions = u.questions + 1
    WHERE u.questions < c_limit
  RETURNING u.questions INTO v_used;
  IF v_used IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'used', c_limit, 'limit', c_limit);
  END IF;
  RETURN pg_catalog.jsonb_build_object('allowed', true, 'used', v_used, 'limit', c_limit);
END
$function$;
REVOKE ALL ON FUNCTION public.chat_ai_claim_question() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_ai_claim_question() TO authenticated;
