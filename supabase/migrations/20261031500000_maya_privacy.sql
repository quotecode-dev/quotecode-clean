-- ============================================================================================================================
-- 20261031500000_maya_privacy.sql  -  Maya's daily drafts admitted atomically; erasure and retention of addresses (Codex F21 / F30)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-31 (typed: "מאשר את שש הקבוצות של קודקס לפי הסדר, כל אחת בשער משלה ועד הלייב, כולל שינוי ב-L-02, L-13, L-15,
--   L-17, L-18, L-22 ובנעילות של 30/10, החלטות א-ח והנוסחים כמומלץ" + the night task); docs/CODEX_REVIEW_RELEASES_2026-10-30.md group 4.
--   * customer_success_admit: ONE transaction (a lock per Israel day) admits a draft - at most p_cap cases opened since the day start,
--     never a second open proposal ('draft' / 'sending') for the same account, one case per account and signal for ever (F21).
--   * account_erase_agent_and_email_records: on account deletion (admin-delete-user, L-18) the account's quote-email send records keep
--     no recipient address (the row stays as a non-personal tombstone: key, state, provider id, times) and Maya's drafts for it keep
--     no text, address or evidence (F30).
--   * privacy_retention_tick (decision c): recipient addresses older than 30 days are removed from the send records, and from Maya's
--     handled drafts; called by the 10-minute scheduled-health tick.
--   Service role only. 20261030700000 / 20261031100000 are not edited.
--   ROLLBACK: the functions only remove personal fields; nothing to restore.
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.customer_success_admit(p_user uuid, p_signal text, p_evidence jsonb, p_day_start timestamptz, p_cap integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_user IS NULL OR p_signal IS NULL OR p_day_start IS NULL OR p_cap IS NULL OR p_cap < 0 OR p_cap > 100
     OR p_day_start < now() - interval '2 days' OR p_day_start > now() + interval '1 hour' THEN
    RAISE EXCEPTION 'customer_success_admit_invalid' USING ERRCODE = '22023';
  END IF;
  -- one admission at a time for the whole day: the cap is counted and the case inserted under the same lock
  PERFORM pg_advisory_xact_lock(hashtext('tekango.customer_success_day'), 0);
  IF (SELECT count(*) FROM public.customer_success_cases WHERE created_at >= p_day_start) >= p_cap THEN
    RETURN jsonb_build_object('ok', false, 'code', 'cap');
  END IF;
  -- an open proposal of the last 7 days blocks a second one; a case stuck longer (a crash) never blocks the account for ever
  IF EXISTS (SELECT 1 FROM public.customer_success_cases WHERE user_id = p_user AND status IN ('draft', 'sending') AND updated_at > now() - interval '7 days') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_open');
  END IF;
  INSERT INTO public.customer_success_cases (user_id, signal_code, evidence) VALUES (p_user, p_signal, coalesce(p_evidence, '{}'::jsonb))
  ON CONFLICT (user_id, signal_code) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'exists'); END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END
$function$;
REVOKE ALL ON FUNCTION public.customer_success_admit(uuid, text, jsonb, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_success_admit(uuid, text, jsonb, timestamptz, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.account_erase_agent_and_email_records(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_sends integer; v_drafts integer;
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'erase_invalid' USING ERRCODE = '22023'; END IF;
  UPDATE public.quote_email_sends SET recipient = 'erased' WHERE user_id = p_user AND recipient <> 'erased';
  GET DIAGNOSTICS v_sends = ROW_COUNT;
  UPDATE public.agent_actions
     SET payload = jsonb_build_object('caseId', payload -> 'caseId', 'erased', true), detail_he = NULL, detail_en = NULL, dedupe_key = NULL,
         -- a draft still waiting for the Owner is closed (nothing is left to send)
         status = CASE WHEN status = 'proposed' THEN 'rejected' ELSE status END,
         decided_at = CASE WHEN status = 'proposed' THEN now() ELSE decided_at END
   WHERE action_type = 'outreach_draft' AND payload ->> 'userId' = p_user::text;
  GET DIAGNOSTICS v_drafts = ROW_COUNT;
  RETURN jsonb_build_object('sends', v_sends, 'drafts', v_drafts);
END
$function$;
REVOKE ALL ON FUNCTION public.account_erase_agent_and_email_records(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_erase_agent_and_email_records(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.privacy_retention_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_sends integer; v_drafts integer;
BEGIN
  -- an unconfirmed send that was never superseded keeps its address: it still blocks a fresh key until "send anyway" (decision a)
  UPDATE public.quote_email_sends SET recipient = 'erased' WHERE created_at < now() - interval '30 days' AND recipient <> 'erased'
     AND NOT (state IN ('unknown', 'reserved') AND superseded_at IS NULL);
  GET DIAGNOSTICS v_sends = ROW_COUNT;
  UPDATE public.agent_actions SET payload = payload - 'recipient' || jsonb_build_object('recipient_erased', true)
   WHERE action_type = 'outreach_draft' AND created_at < now() - interval '30 days' AND status NOT IN ('proposed', 'approved') AND payload ? 'recipient';
  GET DIAGNOSTICS v_drafts = ROW_COUNT;
  RETURN jsonb_build_object('sends', v_sends, 'drafts', v_drafts);
END
$function$;
REVOKE ALL ON FUNCTION public.privacy_retention_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_retention_tick() TO service_role;

NOTIFY pgrst, 'reload schema';
