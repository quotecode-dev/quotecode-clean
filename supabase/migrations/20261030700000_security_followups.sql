-- ============================================================================================================================
-- 20261030700000_security_followups.sql  -  Codex security follow-ups after the four high items (SEC-EF-02/03, SEC-DB-06/07, SEC-ST-02)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-30 (typed: "אשר עבודה רצופה מעכשיו: ממצאי האבטחה ושחרורים 6, 7, 8 ... ו-9, כל אחד בשער משלו לפי הסדר, ...");
--   docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md "Remaining original-audit inventory" (follow-up order: EF-02/EF-03; LOG; FE-02; ST-02;
--   DB-06, DB-07, FE-04, FE-05, HOST-02).
--   * SEC-EF-02: quote_email_sends = one durable record per send of a quote email (reserved -> sent / failed / unknown), reserved
--     BEFORE the provider is called: one send in flight per quote, a 2-minute cooldown for the same quote + recipient, at most 20 emails
--     a day to one recipient and 200 a day per business; an unknown outcome is retried with the SAME provider idempotency key (never a
--     blind second email).
--   * SEC-EF-03: resend_webhook_events = every provider webhook event id once (a replay changes nothing); the send record lets the
--     webhook mark a bounce only for the newest sent email of the quote.
--   * SEC-DB-06: no app role keeps TRUNCATE / TRIGGER / REFERENCES on any public table (RLS never guards those; the app never uses them).
--   * SEC-DB-07: the old counter increment_quote_views is closed to the app; the public counter skips the issuing business, known bots /
--     link scanners, counts a quote at most once a minute and at most 50 times a day (counts are an indication, not verified people).
--   * SEC-ST-02: the quote-files bucket (its 4 MB limit of 20261024100000 unchanged) refuses executable / markup types at the storage server; an upload is
--     refused once the business's stored files reach 30 MB or 300 files (orphan uploads can no longer grow without bound).
--   Closed to the app: the new tables force RLS with no policy and no grant to PUBLIC / anon / authenticated; service role only.
--   ROLLBACK: keep the records (history); the grants and limits may be restored by a later Owner-approved migration.
-- ============================================================================================================================

-- ---------------------------------------------------------------------------------------------------- SEC-EF-02: quote email sends
CREATE TABLE IF NOT EXISTS public.quote_email_sends (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     uuid         NOT NULL,
  user_id      uuid         NOT NULL,
  recipient    text         NOT NULL CHECK (char_length(recipient) BETWEEN 3 AND 320),
  send_key     text         NOT NULL UNIQUE CHECK (char_length(send_key) BETWEEN 8 AND 120),
  state        text         NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'sent', 'failed', 'unknown')),
  provider_id  text         CHECK (provider_id IS NULL OR char_length(provider_id) <= 200),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  attempt_at   timestamptz  NOT NULL DEFAULT now(),
  settled_at   timestamptz
);
ALTER TABLE public.quote_email_sends ADD COLUMN IF NOT EXISTS attempt_at timestamptz NOT NULL DEFAULT now();
COMMENT ON TABLE public.quote_email_sends IS 'Codex SEC-EF-02 (Owner 2026-10-30): one durable record per quote email send, reserved before the provider call; service role only.';
CREATE INDEX IF NOT EXISTS quote_email_sends_quote_idx ON public.quote_email_sends (quote_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quote_email_sends_user_idx ON public.quote_email_sends (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quote_email_sends_provider_idx ON public.quote_email_sends (provider_id) WHERE provider_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.resend_webhook_events (
  event_id     text         PRIMARY KEY CHECK (char_length(event_id) BETWEEN 1 AND 200),
  event_type   text         CHECK (event_type IS NULL OR char_length(event_type) <= 80),
  received_at  timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.resend_webhook_events IS 'Codex SEC-EF-03 (Owner 2026-10-30): every signed email-provider webhook event id once; service role only.';

ALTER TABLE public.quote_email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_email_sends FORCE ROW LEVEL SECURITY;
ALTER TABLE public.resend_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resend_webhook_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quote_email_sends, public.resend_webhook_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.quote_email_sends TO service_role;
GRANT SELECT, INSERT ON TABLE public.resend_webhook_events TO service_role;

-- reserves one send (or hands back the unknown one to retry with the same key); serialized per business
CREATE OR REPLACE FUNCTION public.quote_email_reserve(p_quote uuid, p_user uuid, p_recipient text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_to text := lower(btrim(coalesce(p_recipient, '')));
  v_row public.quote_email_sends%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_quote IS NULL OR p_user IS NULL OR char_length(v_to) < 3 THEN RAISE EXCEPTION 'quote_email_invalid' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango.quote_email'), hashtext(p_user::text));
  -- a send of this quote still in flight (every attempt, a retry too, carries its own attempt time)
  IF EXISTS (SELECT 1 FROM public.quote_email_sends WHERE quote_id = p_quote AND state = 'reserved' AND attempt_at > now() - interval '2 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'in_progress');
  END IF;
  -- an unknown outcome - or an attempt that never settled (a crash / time-out) - to the same recipient: the SAME idempotency key again
  -- (the provider answers it with the first result; never a blind second email)
  SELECT * INTO v_row FROM public.quote_email_sends
   WHERE quote_id = p_quote AND recipient = v_to AND state IN ('unknown', 'reserved') AND created_at > now() - interval '23 hours'
   ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    UPDATE public.quote_email_sends SET state = 'reserved', settled_at = NULL, attempt_at = now() WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', true, 'id', v_row.id, 'send_key', v_row.send_key, 'retry', true);
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
  INSERT INTO public.quote_email_sends (id, quote_id, user_id, recipient, send_key) VALUES (v_id, p_quote, p_user, v_to, 'quote-email/v1/' || v_id::text);
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'send_key', 'quote-email/v1/' || v_id::text, 'retry', false);
END
$function$;
REVOKE ALL ON FUNCTION public.quote_email_reserve(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_email_reserve(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.quote_email_settle(p_id uuid, p_state text, p_provider_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH u AS (
    UPDATE public.quote_email_sends
       SET state = p_state, provider_id = coalesce(left(p_provider_id, 200), provider_id), settled_at = now()
     WHERE id = p_id AND state = 'reserved' AND p_state IN ('sent', 'failed', 'unknown')
     RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$function$;
REVOKE ALL ON FUNCTION public.quote_email_settle(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quote_email_settle(uuid, text, text) TO service_role;

-- SEC-EF-03: one webhook event, once; a bounce counts only for the newest sent email of its quote (legacy emails without a record:
-- only while the quote has no recorded send at all; a newest send whose provider id was never read: accepted, it cannot be told apart).
-- The event and the bounce mark are ONE transaction: a failed mark leaves no event behind, so the provider's retry is applied.
CREATE OR REPLACE FUNCTION public.resend_webhook_accept(p_event_id text, p_event_type text, p_email_id text, p_quote uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rows integer; v_send public.quote_email_sends%ROWTYPE; v_newest public.quote_email_sends%ROWTYPE; v_reason text;
BEGIN
  IF coalesce(p_event_id, '') = '' THEN RAISE EXCEPTION 'webhook_invalid' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.resend_webhook_events (event_id, event_type) VALUES (left(p_event_id, 200), left(p_event_type, 80)) ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('accept', false, 'reason', 'duplicate'); END IF;
  IF p_quote IS NULL THEN RETURN jsonb_build_object('accept', false, 'reason', 'no_quote'); END IF;
  SELECT * INTO v_send FROM public.quote_email_sends WHERE provider_id = p_email_id AND quote_id = p_quote LIMIT 1;
  SELECT * INTO v_newest FROM public.quote_email_sends WHERE quote_id = p_quote AND state IN ('sent', 'unknown', 'reserved') ORDER BY created_at DESC LIMIT 1;
  IF v_newest.id IS NULL THEN v_reason := 'legacy';
  ELSIF v_send.id IS NOT NULL AND v_send.id = v_newest.id THEN v_reason := 'current';
  ELSIF v_send.id IS NULL AND v_newest.provider_id IS NULL THEN v_reason := 'unconfirmed';
  ELSE RETURN jsonb_build_object('accept', false, 'reason', 'not_current');
  END IF;
  IF p_event_type IN ('email.bounced', 'email.failed') THEN
    UPDATE public.quotes SET email_bounced = true, email_bounce_reason = left(coalesce(p_reason, p_event_type), 300), email_bounced_at = now()
     WHERE id = p_quote;
  END IF;
  RETURN jsonb_build_object('accept', true, 'reason', v_reason);
END
$function$;
REVOKE ALL ON FUNCTION public.resend_webhook_accept(text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resend_webhook_accept(text, text, text, uuid, text) TO service_role;

-- ---------------------------------------------------------------------------------------------------- SEC-DB-06: least privilege
DO $least$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE public.%I FROM anon, authenticated', r.relname);
  END LOOP;
END
$least$;

-- ---------------------------------------------------------------------------------------------------- SEC-DB-07: view counters
DO $old_counter$
BEGIN
  IF to_regprocedure('public.increment_quote_views(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.increment_quote_views(uuid) FROM PUBLIC, anon, authenticated;
    ALTER FUNCTION public.increment_quote_views(uuid) SET search_path = public, pg_temp;
  END IF;
END
$old_counter$;

CREATE TABLE IF NOT EXISTS public.quote_view_throttle (
  quote_id    uuid         PRIMARY KEY,
  last_at     timestamptz  NOT NULL,
  day         date         NOT NULL,
  day_count   integer      NOT NULL DEFAULT 0 CHECK (day_count >= 0)
);
COMMENT ON TABLE public.quote_view_throttle IS 'Codex SEC-DB-07 (Owner 2026-10-30): the public view counter counts a quote at most once a minute and 50 times a day; definer only.';
ALTER TABLE public.quote_view_throttle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_view_throttle FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quote_view_throttle FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.quote_view_throttle TO service_role;

CREATE OR REPLACE FUNCTION public.public_increment_quote_view(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_owner uuid; v_ua text; v_today date := (now() AT TIME ZONE 'Asia/Jerusalem')::date; v_ok boolean;
BEGIN
  IF p_quote_id IS NULL THEN RETURN; END IF;
  SELECT q.user_id INTO v_owner FROM public.quotes q WHERE q.id = p_quote_id;
  IF v_owner IS NULL OR public.is_issuer_tenant_member(v_owner) THEN RETURN; END IF;
  BEGIN
    v_ua := lower(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'user-agent', ''));
  EXCEPTION WHEN OTHERS THEN
    v_ua := '';
  END;
  IF v_ua = '' OR v_ua ~ '(bot\y|bot/|crawl|spider|slurp|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|python|curl/|wget|httpclient|okhttp|axios|go-http|java/|libwww|facebookexternalhit|safelinks|proofpoint|mimecast|barracuda|urldefense)' THEN
    RETURN;
  END IF;
  INSERT INTO public.quote_view_throttle AS t (quote_id, last_at, day, day_count) VALUES (p_quote_id, now(), v_today, 1)
  ON CONFLICT (quote_id) DO UPDATE
     SET last_at = now(), day = v_today, day_count = CASE WHEN t.day = v_today THEN t.day_count + 1 ELSE 1 END
   WHERE t.last_at <= now() - interval '1 minute' AND (t.day <> v_today OR t.day_count < 50)
  RETURNING true INTO v_ok;
  IF v_ok IS NOT TRUE THEN RETURN; END IF;
  UPDATE public.quotes SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_quote_id;
END
$function$;
REVOKE ALL ON FUNCTION public.public_increment_quote_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_increment_quote_view(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------------------------------- SEC-ST-02: quote-files
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
         'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/x-zip-compressed',
         'application/json', 'application/octet-stream']
 WHERE id = 'quote-files';

-- the caller's stored files in the bucket (all of them, attached or not) stay under 30 MB and 300 files
CREATE OR REPLACE FUNCTION public.quote_files_upload_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    SELECT count(*) < 300
       AND coalesce(sum(CASE WHEN o.metadata ->> 'size' ~ '^[0-9]{1,15}$' THEN (o.metadata ->> 'size')::bigint ELSE 0 END), 0) < 31457280
      FROM storage.objects o
     WHERE o.bucket_id = 'quote-files' AND (storage.foldername(o.name))[1] = (auth.uid())::text);
$function$;
REVOKE ALL ON FUNCTION public.quote_files_upload_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_files_upload_allowed() TO authenticated;

DROP POLICY IF EXISTS "Authenticated owners upload quote files" ON storage.objects;
CREATE POLICY "Authenticated owners upload quote files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-files'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.quote_files_upload_allowed()
  );
