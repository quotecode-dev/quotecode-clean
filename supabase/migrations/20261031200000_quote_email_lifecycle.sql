-- ============================================================================================================================
-- 20261031200000_quote_email_lifecycle.sql  -  the quote email send record tells the truth (Codex review 2026-10-31, F02-F05)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-31 (typed: "מאשר את שש הקבוצות של קודקס לפי הסדר, כל אחת בשער משלה ועד הלייב, כולל שינוי ב-L-02, L-13, L-15,
--   L-17, L-18, L-22 ובנעילות של 30/10, החלטות א-ח והנוסחים כמומלץ"); docs/CODEX_REVIEW_RELEASES_2026-10-30.md group 1.
--   * F02 + decision (b): every send keeps a FINGERPRINT of the email (sha256, never the email itself). A retry of an unconfirmed send
--     whose content changed is refused ('changed') - the same provider key is never reused for a different email.
--   * F03 + decision (a): an unconfirmed send older than 23 hours is never retried with a fresh key on its own ('unresolved'); a new
--     send needs the user's explicit "send anyway" (p_new_send), which marks the unconfirmed records as superseded.
--   * F04: a bounce event that matches no recorded provider id while the newest send has none yet is HELD (stored with its quote,
--     email id and reason) instead of marking the quote; it is applied when that send is settled with the same provider id.
--   * F05: the old bounce mark is cleared by the server when the newest send is settled as sent (only a bounce older than that send),
--     never by the browser after the answer - a bounce that arrived first is never erased.
--   Closed to the app as before (service role only); 20261030700000 is not edited.
--   ROLLBACK: the added columns are nullable and ignored by the former functions; the former function bodies may be restored by a
--   later Owner-approved migration.
-- ============================================================================================================================

ALTER TABLE public.quote_email_sends ADD COLUMN IF NOT EXISTS fingerprint text CHECK (fingerprint IS NULL OR fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE public.quote_email_sends ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
COMMENT ON COLUMN public.quote_email_sends.fingerprint IS 'Codex F02 (Owner 2026-10-31, decision b): sha256 of the email as sent (the capability token normalized); never the email itself.';
COMMENT ON COLUMN public.quote_email_sends.superseded_at IS 'Codex F03 (Owner 2026-10-31, decision a): an unconfirmed send replaced by the user''s explicit "send anyway".';

ALTER TABLE public.resend_webhook_events ADD COLUMN IF NOT EXISTS quote_id uuid;
ALTER TABLE public.resend_webhook_events ADD COLUMN IF NOT EXISTS email_id text CHECK (email_id IS NULL OR char_length(email_id) <= 200);
ALTER TABLE public.resend_webhook_events ADD COLUMN IF NOT EXISTS bounce_reason text CHECK (bounce_reason IS NULL OR char_length(bounce_reason) <= 300);
ALTER TABLE public.resend_webhook_events ADD COLUMN IF NOT EXISTS state text CHECK (state IS NULL OR state IN ('held', 'applied', 'ignored'));
CREATE INDEX IF NOT EXISTS resend_webhook_events_held_idx ON public.resend_webhook_events (quote_id, email_id) WHERE state = 'held';

-- the former three-argument reservation is replaced (the function calls it with named arguments; the new two have defaults)
DROP FUNCTION IF EXISTS public.quote_email_reserve(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.quote_email_reserve(p_quote uuid, p_user uuid, p_recipient text, p_fingerprint text DEFAULT NULL, p_new_send boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_to text := lower(btrim(coalesce(p_recipient, '')));
  v_fp text := CASE WHEN p_fingerprint ~ '^[0-9a-f]{64}$' THEN p_fingerprint ELSE NULL END;
  v_row public.quote_email_sends%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_quote IS NULL OR p_user IS NULL OR char_length(v_to) < 3 THEN RAISE EXCEPTION 'quote_email_invalid' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango.quote_email'), hashtext(p_user::text));
  -- a send of this quote still in flight (every attempt, a retry too, carries its own attempt time)
  IF EXISTS (SELECT 1 FROM public.quote_email_sends WHERE quote_id = p_quote AND state = 'reserved' AND attempt_at > now() - interval '2 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'in_progress');
  END IF;
  IF coalesce(p_new_send, false) THEN
    -- the user confirmed "send anyway": the unconfirmed sends to this address stay as history, superseded, and a new key is issued
    UPDATE public.quote_email_sends SET superseded_at = now()
     WHERE quote_id = p_quote AND recipient = v_to AND state IN ('unknown', 'reserved') AND superseded_at IS NULL;
  ELSE
    -- an unconfirmed send (unknown, or an attempt that never settled) to the same address
    SELECT * INTO v_row FROM public.quote_email_sends
     WHERE quote_id = p_quote AND recipient = v_to AND state IN ('unknown', 'reserved') AND superseded_at IS NULL
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
      -- past the provider's replay window: never a fresh key on its own (decision a)
      IF v_row.created_at <= now() - interval '23 hours' THEN RETURN jsonb_build_object('ok', false, 'code', 'unresolved'); END IF;
      -- the email changed since: the same key is never used for different content (decision b)
      IF v_row.fingerprint IS NOT NULL AND v_fp IS NOT NULL AND v_row.fingerprint <> v_fp THEN RETURN jsonb_build_object('ok', false, 'code', 'changed'); END IF;
      UPDATE public.quote_email_sends SET state = 'reserved', settled_at = NULL, attempt_at = now(), fingerprint = coalesce(fingerprint, v_fp) WHERE id = v_row.id;
      RETURN jsonb_build_object('ok', true, 'id', v_row.id, 'send_key', v_row.send_key, 'retry', true);
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.quote_email_sends WHERE quote_id = p_quote AND recipient = v_to AND state = 'sent' AND coalesce(settled_at, attempt_at) > now() - interval '2 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'cooldown');
  END IF;
  IF (SELECT count(*) FROM public.quote_email_sends WHERE user_id = p_user AND recipient = v_to AND state <> 'failed' AND created_at > now() - interval '24 hours') >= 20 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'recipient_limit');
  END IF;
  IF (SELECT count(*) FROM public.quote_email_sends WHERE user_id = p_user AND state <> 'failed' AND created_at > now() - interval '24 hours') >= 200 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'daily_limit');
  END IF;
  v_id := gen_random_uuid();
  INSERT INTO public.quote_email_sends (id, quote_id, user_id, recipient, send_key, fingerprint)
  VALUES (v_id, p_quote, p_user, v_to, 'quote-email/v1/' || v_id::text, v_fp);
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'send_key', 'quote-email/v1/' || v_id::text, 'retry', false);
END
$function$;
REVOKE ALL ON FUNCTION public.quote_email_reserve(uuid, uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_email_reserve(uuid, uuid, text, text, boolean) TO service_role;

-- settles a send once; a SENT newest send clears the quote's OLDER bounce mark and applies the bounce events held for its provider id
CREATE OR REPLACE FUNCTION public.quote_email_settle(p_id uuid, p_state text, p_provider_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row public.quote_email_sends%ROWTYPE; v_newest uuid; v_ev public.resend_webhook_events%ROWTYPE;
BEGIN
  IF p_state IS NULL OR p_state NOT IN ('sent', 'failed', 'unknown') THEN RETURN false; END IF;
  UPDATE public.quote_email_sends
     SET state = p_state, provider_id = coalesce(left(p_provider_id, 200), provider_id), settled_at = now()
   WHERE id = p_id AND state = 'reserved'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_state <> 'sent' THEN RETURN true; END IF;
  SELECT id INTO v_newest FROM public.quote_email_sends WHERE quote_id = v_row.quote_id AND state IN ('sent', 'unknown', 'reserved') ORDER BY created_at DESC LIMIT 1;
  IF v_newest = v_row.id THEN
    UPDATE public.quotes SET email_bounced = false, email_bounce_reason = NULL, email_bounced_at = NULL
     WHERE id = v_row.quote_id AND (email_bounced IS TRUE OR email_bounced_at IS NOT NULL)
       AND (email_bounced_at IS NULL OR email_bounced_at < v_row.created_at);
  END IF;
  IF v_row.provider_id IS NOT NULL THEN
    FOR v_ev IN SELECT * FROM public.resend_webhook_events
                 WHERE state = 'held' AND quote_id = v_row.quote_id AND email_id = v_row.provider_id ORDER BY received_at
    LOOP
      IF v_newest = v_row.id THEN
        IF v_ev.event_type IN ('email.bounced', 'email.failed') THEN
          UPDATE public.quotes SET email_bounced = true, email_bounce_reason = left(coalesce(v_ev.bounce_reason, v_ev.event_type), 300), email_bounced_at = now()
           WHERE id = v_row.quote_id;
        END IF;
        UPDATE public.resend_webhook_events SET state = 'applied' WHERE event_id = v_ev.event_id;
      ELSE
        UPDATE public.resend_webhook_events SET state = 'ignored' WHERE event_id = v_ev.event_id;
      END IF;
    END LOOP;
  END IF;
  RETURN true;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_email_settle(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_email_settle(uuid, text, text) TO service_role;

-- one webhook event, once; a bounce marks the quote only for its newest send; an event that cannot be matched yet is HELD (F04)
CREATE OR REPLACE FUNCTION public.resend_webhook_accept(p_event_id text, p_event_type text, p_email_id text, p_quote uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rows integer; v_send public.quote_email_sends%ROWTYPE; v_newest public.quote_email_sends%ROWTYPE; v_reason text; v_id text := left(p_event_id, 200);
BEGIN
  IF coalesce(p_event_id, '') = '' THEN RAISE EXCEPTION 'webhook_invalid' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.resend_webhook_events (event_id, event_type, quote_id, email_id, bounce_reason)
  VALUES (v_id, left(p_event_type, 80), p_quote, left(p_email_id, 200), left(p_reason, 300)) ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('accept', false, 'reason', 'duplicate'); END IF;
  IF p_quote IS NULL THEN RETURN jsonb_build_object('accept', false, 'reason', 'no_quote'); END IF;
  SELECT * INTO v_send FROM public.quote_email_sends WHERE provider_id = p_email_id AND quote_id = p_quote LIMIT 1;
  SELECT * INTO v_newest FROM public.quote_email_sends WHERE quote_id = p_quote AND state IN ('sent', 'unknown', 'reserved') ORDER BY created_at DESC LIMIT 1;
  IF v_newest.id IS NULL THEN v_reason := 'legacy';
  ELSIF v_send.id IS NOT NULL AND v_send.id = v_newest.id THEN v_reason := 'current';
  ELSIF v_send.id IS NULL AND v_newest.provider_id IS NULL THEN
    -- the newest send has no provider id yet: this event may belong to it or to an older unrecorded email - kept, applied on settle
    UPDATE public.resend_webhook_events SET state = 'held' WHERE event_id = v_id;
    RETURN jsonb_build_object('accept', false, 'reason', 'held');
  ELSE
    UPDATE public.resend_webhook_events SET state = 'ignored' WHERE event_id = v_id;
    RETURN jsonb_build_object('accept', false, 'reason', 'not_current');
  END IF;
  IF p_event_type IN ('email.bounced', 'email.failed') THEN
    UPDATE public.quotes SET email_bounced = true, email_bounce_reason = left(coalesce(p_reason, p_event_type), 300), email_bounced_at = now()
     WHERE id = p_quote;
  END IF;
  UPDATE public.resend_webhook_events SET state = 'applied' WHERE event_id = v_id;
  RETURN jsonb_build_object('accept', true, 'reason', v_reason);
END
$function$;
REVOKE ALL ON FUNCTION public.resend_webhook_accept(text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resend_webhook_accept(text, text, text, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
