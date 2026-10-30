-- ============================================================================================================================
-- 20261030500000_support_automation_policy.sql  -  Codex release 5 (topic 5): automatic emails, the grey colour, a persisted reply ban
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-29 night (typed: "אשר משימת לילה: תיקון כל ממצאי קודקס על שחרור 4 ושחרור 5 (החלטות 7 ו-8 כמוצע) בשחרור אחד
--   עד השער, כולל שינוי ב-L-22, L-25 ושאר נעילות המסך והתאריכים בלי שינוי; ..."); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 5,
--   decision 7 ("grey + one Owner alert + no sender reply for ambiguous no-reply mail, bounded non-sending historical reclassification").
--   * support_inbound_messages: the classifier's verdict (human / confirmed_automatic / possible_automatic), its version and a bounded
--     reason, and reply_allowed - false for both automatic classes. reply_allowed can never go back from false to true (a guard trigger):
--     no rollback, no admin action can make an unsafe recipient replyable again.
--   * the bin 'grey' = possibly automatic, kept for the Owner's review (one alert, no acknowledgement, no AI draft, no reply).
--   * history, from retained evidence only, nothing is sent: rows already automated -> confirmed_automatic; a no-reply local part the old
--     start-anchored rule missed (microsoft-noreply@, info.noreply@, donotreply+x@) -> possible_automatic, reply prohibited; their
--     colour, state and answers are kept as they were (headers of old rows were not stored, so they stay uncertain, not re-sorted).
--   ROLLBACK (spec): keep the columns and every value; never set reply_allowed back to true.
-- ============================================================================================================================

ALTER TABLE public.support_inbound_messages ADD COLUMN IF NOT EXISTS automation_class text
  CHECK (automation_class IS NULL OR automation_class IN ('human', 'confirmed_automatic', 'possible_automatic'));
ALTER TABLE public.support_inbound_messages ADD COLUMN IF NOT EXISTS automation_version text CHECK (automation_version IS NULL OR char_length(automation_version) <= 40);
ALTER TABLE public.support_inbound_messages ADD COLUMN IF NOT EXISTS automation_evidence text CHECK (automation_evidence IS NULL OR char_length(automation_evidence) <= 300);
ALTER TABLE public.support_inbound_messages ADD COLUMN IF NOT EXISTS reply_allowed boolean NOT NULL DEFAULT true;

ALTER TABLE public.support_inbound_messages DROP CONSTRAINT IF EXISTS support_inbound_messages_bin_check;
ALTER TABLE public.support_inbound_messages ADD CONSTRAINT support_inbound_messages_bin_check
  CHECK (bin IS NULL OR bin IN ('green', 'yellow', 'red', 'black', 'grey'));

CREATE OR REPLACE FUNCTION public.support_reply_ban_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF OLD.reply_allowed = false AND NEW.reply_allowed = true THEN
    RAISE EXCEPTION 'support_reply_ban_permanent' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.support_reply_ban_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS support_reply_ban_guard ON public.support_inbound_messages;
CREATE TRIGGER support_reply_ban_guard BEFORE UPDATE OF reply_allowed ON public.support_inbound_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_reply_ban_guard();

-- history (bounded, from retained evidence only; nothing is sent)
UPDATE public.support_inbound_messages
   SET automation_class = 'confirmed_automatic', automation_version = 'legacy-2026-10-30', automation_evidence = 'is_automated', reply_allowed = false
 WHERE automation_class IS NULL AND is_automated;
UPDATE public.support_inbound_messages
   SET automation_class = 'possible_automatic', automation_version = 'legacy-2026-10-30', automation_evidence = 'local_part:no-reply', reply_allowed = false
 WHERE automation_class IS NULL AND NOT is_automated
   AND split_part(lower(from_address), '@', 1) ~ '(^|[._+-])(no[-_]?reply|do[-_]?not[-_]?reply)([._+-]|$)';
UPDATE public.support_inbound_messages
   SET automation_class = 'human', automation_version = 'legacy-2026-10-30'
 WHERE automation_class IS NULL;
