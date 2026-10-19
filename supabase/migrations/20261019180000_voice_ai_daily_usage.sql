-- ============================================================================================================================
-- 20261019180000_voice_ai_daily_usage.sql  -  the voice assistant's daily allowance (60 voice operations per user per day)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-19 (task-control activeTask.voiceChat20261019, plan docs/VOICE_ASSISTANT_PLAN_2026-10-19.md): a microphone in
--   the smart chat and spoken answers ("שברירת המחדל תהיה בקול ... לבחור גם וגם"; "מתאים, יאללה בוא נלך על זה").
--   voice_ai_daily_usage holds one counter row per user and UTC day. Nobody reads or writes it directly (RLS on, no policy, no
--   grant); the only writer is voice_ai_claim_operation(), which counts ONE voice operation (a recording turned into text, or an
--   answer turned into speech) for the CALLER (auth.uid(), no argument) and refuses once the day's 60 are used - atomically.
--   Separate from chat_ai_daily_usage: a spoken question still counts once there when it reaches the model. Additive.
-- Rollback of THIS file: DROP FUNCTION public.voice_ai_claim_operation(); DROP TABLE public.voice_ai_daily_usage;
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.voice_ai_daily_usage (
  user_id     uuid    NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  usage_day   date    NOT NULL,
  operations  integer NOT NULL DEFAULT 0 CHECK (operations >= 0),
  PRIMARY KEY (user_id, usage_day)
);
COMMENT ON TABLE public.voice_ai_daily_usage IS
  'Owner 2026-10-19: voice-assistant operations (speech to text, text to speech) per user per UTC day (cap 60) - written only by voice_ai_claim_operation().';
ALTER TABLE public.voice_ai_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voice_ai_daily_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.voice_ai_claim_operation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  c_limit CONSTANT integer := 60;
  v_uid   uuid := auth.uid();
  v_day   date := (pg_catalog.now() AT TIME ZONE 'UTC')::date;
  v_used  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'voice_ai_claim_operation: not authenticated' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.voice_ai_daily_usage AS u (user_id, usage_day, operations)
  VALUES (v_uid, v_day, 1)
  ON CONFLICT (user_id, usage_day) DO UPDATE SET operations = u.operations + 1
    WHERE u.operations < c_limit
  RETURNING u.operations INTO v_used;
  IF v_used IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'used', c_limit, 'limit', c_limit);
  END IF;
  RETURN pg_catalog.jsonb_build_object('allowed', true, 'used', v_used, 'limit', c_limit);
END
$function$;
REVOKE ALL ON FUNCTION public.voice_ai_claim_operation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.voice_ai_claim_operation() TO authenticated;
