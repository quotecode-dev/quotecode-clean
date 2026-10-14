-- ============================================================================================================================
-- 20261009200000_task20_reminders_automation.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Task 20 / Phase 4 (Owner decisions PROFLOW_PROJECT_CONTEXT.md §246 + Task 20 contract): reminders & automation, quote link view ("Quote link viewed").
-- PREPARED LOCALLY, NOT APPLIED to TEST or Production. Applying it to any shared environment requires a separate explicit Owner
-- authorization. Proven only in the disposable database harness (scripts/db-test). Forward-only, additive, re-runnable.
--
--   A. quotes.first_viewed_at          the FIRST VIEW OF THE QUOTE LINK (an indication the link was opened - never a certain
--                                      identification of the customer), server time, written ONLY by
--                                      public.public_record_quote_first_view (never by the owner, an issuer-tenant member, an internal
--                                      preview or a known bot / link scanner); repeat views never reset it; nothing else can set it.
--   B. guard_quote_immutability()      unchanged except first_viewed_at joins the named bookkeeping columns (a first view may be
--                                      recorded on an already signed quote; content stays immutable).
--   C. public.reminder_settings        one row per business: mode in_app (default) | off | full, ticked behaviors, chosen days, customer
--                                      rule content, sending window, sending time zone, pause. Owner-only (RLS forced).
--   D. public.reminder_notification_state   per-user read marks of derived in-app reminders. Owner-only.
--   E. public.customer_contact_stops   "do not send automatic messages to this customer" (business-set now; customer-link and bounce
--                                      sources reserved for the dispatcher slice). Owner-only.
--   F. public.reminder_audit           append-only action history (mode / pause / Full changes, stops, sends, cancellations). Owner reads;
--                                      only SECURITY DEFINER code writes.
--   G. public.automation_occurrences + claim/complete   the de-duplication ledger for automatic customer messages: one row per
--                                      (account, dedup key) = at most one message per quote per rule; the claim re-checks Full, the rule,
--                                      pause, quote still awaiting signature (approval / paid / expiry cancel), stop and bounce. service_role
--                                      only. No scheduler, provider or sending is created here.
-- No reject status, no WhatsApp automation, no cron.
-- Rollback of THIS file (only while no data must be kept): DROP the five tables and the functions named below; DROP COLUMN
-- quotes.first_viewed_at; restore guard_quote_immutability() from 20260830000001.
-- ============================================================================================================================

-- A. first view -----------------------------------------------------------------------------------------------------------------
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;
COMMENT ON COLUMN public.quotes.first_viewed_at IS
  'Task 20: first view of the quote link (server time) - an indication the link was opened, not a certain customer identification. Written only by public_record_quote_first_view; never reset.';

CREATE OR REPLACE FUNCTION public.quotes_first_view_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.first_viewed_at IS NOT NULL AND coalesce(pg_catalog.current_setting('tekango.first_view_writer', true), '') <> 'on' THEN
      NEW.first_viewed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.first_viewed_at IS DISTINCT FROM OLD.first_viewed_at
     AND (OLD.first_viewed_at IS NOT NULL OR coalesce(pg_catalog.current_setting('tekango.first_view_writer', true), '') <> 'on') THEN
    -- a whole-row save or a crafted write never moves it: the stored first view stays (no error, so ordinary saves never fail)
    NEW.first_viewed_at := OLD.first_viewed_at;
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quotes_first_view_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS quotes_first_view_guard ON public.quotes;
CREATE TRIGGER quotes_first_view_guard
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_first_view_guard();

-- Records the first view of the quote link (an indication, not a certain customer identification). Returns true only when THIS call recorded it. Refuses (false, nothing written): unknown quote, the
-- issuing tenant (public.is_issuer_tenant_member), a missing user agent or a known bot / link-scanner user agent. The app calls it only
-- from the customer's public quote page after the document was actually visible (internal previews never call it).
CREATE OR REPLACE FUNCTION public.public_record_quote_first_view(p_quote_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_owner uuid;
  v_ua    text;
  v_rows  integer;
BEGIN
  IF p_quote_id IS NULL THEN RETURN false; END IF;
  SELECT q.user_id INTO v_owner FROM public.quotes q WHERE q.id = p_quote_id;
  IF v_owner IS NULL THEN RETURN false; END IF;
  IF public.is_issuer_tenant_member(v_owner) THEN RETURN false; END IF;
  BEGIN
    v_ua := lower(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'user-agent', ''));
  EXCEPTION WHEN OTHERS THEN
    v_ua := '';
  END;
  IF v_ua = '' OR v_ua ~ '(bot\y|bot/|crawl|spider|slurp|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|python|curl/|wget|httpclient|okhttp|axios|go-http|java/|libwww|facebookexternalhit|safelinks|proofpoint|mimecast|barracuda|urldefense)' THEN
    RETURN false;
  END IF;
  PERFORM set_config('tekango.first_view_writer', 'on', true);
  UPDATE public.quotes SET first_viewed_at = now() WHERE id = p_quote_id AND first_viewed_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM set_config('tekango.first_view_writer', 'off', true);
  RETURN v_rows = 1;
END
$function$;
COMMENT ON FUNCTION public.public_record_quote_first_view(uuid) IS
  'Task 20: idempotently record the first quote-link view (server time). Never the signed-in issuing tenant, never a known bot / scanner; never resets. An indication, not a certain customer identification.';
REVOKE ALL ON FUNCTION public.public_record_quote_first_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_record_quote_first_view(uuid) TO anon, authenticated;

-- B. immutability guard: first_viewed_at becomes a named bookkeeping column (body otherwise identical to 20260830000001) ---------------
CREATE OR REPLACE FUNCTION public.guard_quote_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  was_immutable boolean;
  new_without_bookkeeping public.quotes;
BEGIN
  was_immutable := (
    LOWER(COALESCE(OLD.status, '')) IN ('approved','paid')
    OR (OLD.signature IS NOT NULL AND OLD.signature <> '')
  );

  IF NOT was_immutable THEN
    RETURN NEW;
  END IF;

  IF NEW.view_count IS DISTINCT FROM OLD.view_count
     AND (
       NEW.view_count IS NULL
       OR NEW.view_count < COALESCE(OLD.view_count, 0)
     ) THEN
    RAISE EXCEPTION
      'Not permitted: view_count cannot decrease or become NULL'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.expiration_reminder_sent IS DISTINCT FROM OLD.expiration_reminder_sent
     AND NEW.expiration_reminder_sent IS NOT TRUE THEN
    RAISE EXCEPTION
      'Not permitted: expiration_reminder_sent cannot be reset'
      USING ERRCODE = '42501';
  END IF;

  new_without_bookkeeping := NEW;

  new_without_bookkeeping.view_count :=
    OLD.view_count;

  new_without_bookkeeping.expiration_reminder_sent :=
    OLD.expiration_reminder_sent;

  new_without_bookkeeping.email_bounced :=
    OLD.email_bounced;

  new_without_bookkeeping.email_bounce_reason :=
    OLD.email_bounce_reason;

  new_without_bookkeeping.email_bounced_at :=
    OLD.email_bounced_at;

  new_without_bookkeeping.first_viewed_at :=
    OLD.first_viewed_at;

  IF new_without_bookkeeping IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Not permitted: this quote is approved/paid/signed and its content can no longer be modified'
    USING ERRCODE = '42501';
END;
$function$;

-- F. audit (created first: C and E write to it) -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminder_audit (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  actor      text        NOT NULL CHECK (actor IN ('business', 'system', 'customer')),
  action     text        NOT NULL CHECK (char_length(action) BETWEEN 1 AND 64),
  detail     jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object' AND pg_column_size(detail) < 4096)
);
CREATE INDEX IF NOT EXISTS reminder_audit_user_at_idx ON public.reminder_audit (user_id, at DESC);
-- RLS enabled, deliberately NOT forced: the SECURITY DEFINER guards below (table owner) append history rows; every API role is still
-- filtered by the policies (authenticated: read own rows only; no INSERT/UPDATE/DELETE grant at all).
ALTER TABLE public.reminder_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reminder_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reminder_audit TO authenticated;
GRANT SELECT, INSERT ON public.reminder_audit TO service_role;
DROP POLICY IF EXISTS reminder_audit_select_own ON public.reminder_audit;
CREATE POLICY reminder_audit_select_own ON public.reminder_audit FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS reminder_audit_service ON public.reminder_audit;
CREATE POLICY reminder_audit_service ON public.reminder_audit FOR ALL TO service_role USING (true) WITH CHECK (true);

-- C. settings ----------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminder_settings (
  user_id         uuid        PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  mode            text        NOT NULL DEFAULT 'in_app',
  behaviors       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  days            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  rules           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  send_window     jsonb,
  time_zone       text,
  paused          boolean     NOT NULL DEFAULT false,
  full_enabled_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reminder_settings_mode_check CHECK (mode IN ('in_app', 'off', 'full')),
  CONSTRAINT reminder_settings_behaviors_check CHECK (jsonb_typeof(behaviors) = 'object'),
  CONSTRAINT reminder_settings_days_check CHECK (jsonb_typeof(days) = 'object'),
  CONSTRAINT reminder_settings_rules_check CHECK (jsonb_typeof(rules) = 'object' AND pg_column_size(rules) < 32768),
  CONSTRAINT reminder_settings_window_check CHECK (send_window IS NULL OR jsonb_typeof(send_window) = 'object'),
  CONSTRAINT reminder_settings_zone_check CHECK (time_zone IS NULL OR char_length(time_zone) BETWEEN 1 AND 64)
);

CREATE OR REPLACE FUNCTION public.reminder_settings_guard_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'TK_REMINDER_OWNER_IMMUTABLE: settings cannot change owner' USING ERRCODE = '42501';
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  -- Full is an explicit business choice: its activation time is server-owned
  IF NEW.mode = 'full' THEN
    NEW.full_enabled_at := CASE WHEN TG_OP = 'UPDATE' AND OLD.mode = 'full' THEN OLD.full_enabled_at ELSE now() END;
  ELSE
    NEW.full_enabled_at := NULL;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.mode IS DISTINCT FROM OLD.mode THEN
    INSERT INTO public.reminder_audit (user_id, actor, action, detail)
    VALUES (NEW.user_id, 'business', 'mode_set', jsonb_build_object('mode', NEW.mode));
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.paused IS DISTINCT FROM OLD.paused THEN
    INSERT INTO public.reminder_audit (user_id, actor, action, detail)
    VALUES (NEW.user_id, 'business', CASE WHEN NEW.paused THEN 'automation_paused' ELSE 'automation_resumed' END, '{}'::jsonb);
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.reminder_settings_guard_row() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reminder_settings_guard_row ON public.reminder_settings;
CREATE TRIGGER reminder_settings_guard_row
  BEFORE INSERT OR UPDATE ON public.reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.reminder_settings_guard_row();

ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.reminder_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reminder_settings TO authenticated;
GRANT SELECT ON public.reminder_settings TO service_role;
DROP POLICY IF EXISTS reminder_settings_select_own ON public.reminder_settings;
CREATE POLICY reminder_settings_select_own ON public.reminder_settings FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS reminder_settings_insert_own ON public.reminder_settings;
CREATE POLICY reminder_settings_insert_own ON public.reminder_settings FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS reminder_settings_update_own ON public.reminder_settings;
CREATE POLICY reminder_settings_update_own ON public.reminder_settings FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS reminder_settings_service_read ON public.reminder_settings;
CREATE POLICY reminder_settings_service_read ON public.reminder_settings FOR SELECT TO service_role USING (true);

-- D. in-app read marks -------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminder_notification_state (
  user_id   uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  item_key  text        NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 200),
  read_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);
ALTER TABLE public.reminder_notification_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_notification_state FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.reminder_notification_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.reminder_notification_state TO authenticated;
DROP POLICY IF EXISTS reminder_state_select_own ON public.reminder_notification_state;
CREATE POLICY reminder_state_select_own ON public.reminder_notification_state FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS reminder_state_insert_own ON public.reminder_notification_state;
CREATE POLICY reminder_state_insert_own ON public.reminder_notification_state FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS reminder_state_delete_own ON public.reminder_notification_state;
CREATE POLICY reminder_state_delete_own ON public.reminder_notification_state FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

-- E. stops -------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_contact_stops (
  user_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  email_lower text        NOT NULL CHECK (email_lower = lower(btrim(email_lower)) AND char_length(email_lower) BETWEEN 3 AND 320),
  channel     text        NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  source      text        NOT NULL DEFAULT 'business' CHECK (source IN ('business', 'customer_link', 'bounce')),
  stopped_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, email_lower, channel)
);

CREATE OR REPLACE FUNCTION public.customer_contact_stops_guard_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- the app may only record a business-set stop; customer-link / bounce stops come from server code (service_role)
    IF NEW.source <> 'business' AND current_user <> 'service_role' AND coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'TK_STOP_SOURCE_NOT_ALLOWED' USING ERRCODE = '42501';
    END IF;
    NEW.stopped_at := now();
    INSERT INTO public.reminder_audit (user_id, actor, action, detail)
    VALUES (NEW.user_id, CASE NEW.source WHEN 'business' THEN 'business' WHEN 'customer_link' THEN 'customer' ELSE 'system' END, 'contact_stopped',
            jsonb_build_object('channel', NEW.channel, 'source', NEW.source));
    RETURN NEW;
  END IF;
  -- DELETE: a business may lift only its own business-set stop; a customer's own stop is never lifted by the business
  IF OLD.source <> 'business' THEN
    RAISE EXCEPTION 'TK_STOP_NOT_LIFTABLE' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.reminder_audit (user_id, actor, action, detail)
  VALUES (OLD.user_id, 'business', 'contact_stop_lifted', jsonb_build_object('channel', OLD.channel));
  RETURN OLD;
END
$function$;
REVOKE ALL ON FUNCTION public.customer_contact_stops_guard_row() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS customer_contact_stops_guard_row ON public.customer_contact_stops;
CREATE TRIGGER customer_contact_stops_guard_row
  BEFORE INSERT OR DELETE ON public.customer_contact_stops
  FOR EACH ROW EXECUTE FUNCTION public.customer_contact_stops_guard_row();

ALTER TABLE public.customer_contact_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contact_stops FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_contact_stops FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.customer_contact_stops TO authenticated;
GRANT SELECT, INSERT ON public.customer_contact_stops TO service_role;
DROP POLICY IF EXISTS contact_stops_select_own ON public.customer_contact_stops;
CREATE POLICY contact_stops_select_own ON public.customer_contact_stops FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS contact_stops_insert_own ON public.customer_contact_stops;
CREATE POLICY contact_stops_insert_own ON public.customer_contact_stops FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS contact_stops_delete_own ON public.customer_contact_stops;
CREATE POLICY contact_stops_delete_own ON public.customer_contact_stops FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS contact_stops_service ON public.customer_contact_stops;
CREATE POLICY contact_stops_service ON public.customer_contact_stops FOR ALL TO service_role USING (true) WITH CHECK (true);

-- G. occurrence ledger (dedup + cancellation, service_role only) -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_occurrences (
  user_id             uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  dedup_key           text        NOT NULL CHECK (char_length(dedup_key) BETWEEN 1 AND 300),
  rule_id             text        NOT NULL CHECK (rule_id IN ('customer_followup_email', 'customer_validity_email', 'followup_task')),
  quote_id            uuid        REFERENCES public.quotes (id) ON DELETE SET NULL,
  recipient_lower     text,
  status              text        NOT NULL CHECK (status IN ('claimed', 'sent', 'failed', 'unknown', 'cancelled', 'skipped')),
  claim_id            uuid        NOT NULL,
  idempotency_key     text        NOT NULL,
  attempt             integer     NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  key_first_used_at   timestamptz NOT NULL DEFAULT now(),
  claimed_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  provider_message_id text,
  last_error          text,
  PRIMARY KEY (user_id, dedup_key)
);
ALTER TABLE public.automation_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_occurrences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_occurrences FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.automation_occurrences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.automation_occurrences TO service_role;
DROP POLICY IF EXISTS automation_occurrences_select_own ON public.automation_occurrences;
CREATE POLICY automation_occurrences_select_own ON public.automation_occurrences FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS automation_occurrences_service ON public.automation_occurrences;
CREATE POLICY automation_occurrences_service ON public.automation_occurrences FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Atomic claim: exactly one caller wins a (account, dedup key); every guard is re-checked at claim time. A cancelled / skipped row is
-- final and never re-claimed (one message per quote per rule). Returns {claim_id, idempotency_key, attempt} or NULL (+ a recorded
-- 'cancelled'/'skipped' row when a guard refuses, so the history shows why nothing was sent).
CREATE OR REPLACE FUNCTION public.claim_automation_occurrence(p_user_id uuid, p_dedup_key text, p_rule_id text, p_quote_id uuid, p_recipient text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  c_lease      constant interval := interval '10 minutes';
  c_key_window constant interval := interval '23 hours';
  v_claim   uuid := gen_random_uuid();
  v_set     public.reminder_settings;
  v_quote   public.quotes;
  v_country text;
  v_reason  text;
  v_rcpt    text := lower(btrim(coalesce(p_recipient, '')));
  v_result  jsonb;
BEGIN
  IF p_user_id IS NULL OR p_dedup_key IS NULL OR p_rule_id NOT IN ('customer_followup_email', 'customer_validity_email', 'followup_task') THEN
    RAISE EXCEPTION 'claim_automation_occurrence: invalid arguments' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_set FROM public.reminder_settings s WHERE s.user_id = p_user_id;
  SELECT * INTO v_quote FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = p_user_id;
  SELECT b.country INTO v_country FROM public.business_settings b WHERE b.user_id = p_user_id;

  v_reason := CASE
    WHEN v_set.user_id IS NULL OR v_set.mode <> 'full' THEN 'full_mode_off'
    WHEN v_set.paused THEN 'automation_paused'
    WHEN coalesce((v_set.behaviors ->> p_rule_id)::boolean, false) IS NOT TRUE THEN 'rule_not_selected'
    WHEN p_rule_id <> 'followup_task' AND coalesce((v_set.rules -> p_rule_id ->> 'paused')::boolean, false) THEN 'rule_paused'
    WHEN v_quote.id IS NULL THEN 'quote_not_available'
    WHEN lower(coalesce(v_quote.status, '')) <> 'sent' THEN 'quote_not_awaiting'                 -- approved / paid / draft cancel
    WHEN public.quote_acceptance_expired(v_quote.valid_until, v_country, now()) THEN 'quote_expired'
    WHEN p_rule_id <> 'followup_task' AND v_quote.email_bounced IS TRUE THEN 'email_bounced'
    WHEN p_rule_id <> 'followup_task' AND (v_rcpt = '' OR EXISTS (SELECT 1 FROM public.customer_contact_stops x
           WHERE x.user_id = p_user_id AND x.email_lower = v_rcpt AND x.channel = 'email')) THEN 'contact_stopped'
    ELSE NULL END;

  IF v_reason IS NOT NULL THEN
    INSERT INTO public.automation_occurrences AS o (user_id, dedup_key, rule_id, quote_id, recipient_lower, status, claim_id, idempotency_key, last_error)
    VALUES (p_user_id, p_dedup_key, p_rule_id, v_quote.id, nullif(v_rcpt, ''), CASE WHEN v_reason LIKE 'quote_%' OR v_reason = 'contact_stopped' OR v_reason = 'email_bounced' THEN 'cancelled' ELSE 'skipped' END,
            v_claim, format('automation/%s/%s/1', p_user_id, md5(p_dedup_key)), v_reason)
    ON CONFLICT (user_id, dedup_key) DO NOTHING;
    RETURN NULL;
  END IF;

  INSERT INTO public.automation_occurrences AS d (user_id, dedup_key, rule_id, quote_id, recipient_lower, status, claim_id, idempotency_key)
  VALUES (p_user_id, p_dedup_key, p_rule_id, v_quote.id, nullif(v_rcpt, ''), 'claimed', v_claim, format('automation/%s/%s/1', p_user_id, md5(p_dedup_key)))
  ON CONFLICT (user_id, dedup_key) DO UPDATE SET
    status = 'claimed', claim_id = v_claim, claimed_at = now(), completed_at = NULL, attempt = d.attempt + 1,
    idempotency_key   = CASE WHEN d.status = 'failed' THEN format('automation/%s/%s/%s', d.user_id, md5(d.dedup_key), d.attempt + 1) ELSE d.idempotency_key END,
    key_first_used_at = CASE WHEN d.status = 'failed' THEN now() ELSE d.key_first_used_at END
  WHERE d.status = 'failed'
     OR (d.status = 'unknown' AND d.key_first_used_at > now() - c_key_window)
     OR (d.status = 'claimed' AND d.claimed_at < now() - c_lease AND d.key_first_used_at > now() - c_key_window)
  RETURNING jsonb_build_object('claim_id', d.claim_id, 'idempotency_key', d.idempotency_key, 'attempt', d.attempt) INTO v_result;
  RETURN v_result;
END
$function$;
REVOKE ALL ON FUNCTION public.claim_automation_occurrence(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_automation_occurrence(uuid, text, text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_automation_occurrence(p_user_id uuid, p_dedup_key text, p_claim_id uuid, p_outcome text,
  p_provider_message_id text DEFAULT NULL, p_error text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE v_rows integer;
BEGIN
  IF p_outcome NOT IN ('sent', 'failed', 'unknown') THEN
    RAISE EXCEPTION 'complete_automation_occurrence: invalid outcome' USING ERRCODE = '22023';
  END IF;
  UPDATE public.automation_occurrences o SET
    status = p_outcome, completed_at = now(),
    provider_message_id = CASE WHEN p_outcome = 'sent' THEN left(p_provider_message_id, 200) ELSE o.provider_message_id END,
    last_error = CASE WHEN p_outcome = 'sent' THEN NULL ELSE left(p_error, 500) END
  WHERE o.user_id = p_user_id AND o.dedup_key = p_dedup_key AND o.claim_id = p_claim_id AND o.status = 'claimed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 1 THEN
    INSERT INTO public.reminder_audit (user_id, actor, action, detail)
    VALUES (p_user_id, 'system', 'automation_' || p_outcome, jsonb_build_object('dedup_key', p_dedup_key));
  END IF;
  RETURN v_rows = 1;
END
$function$;
REVOKE ALL ON FUNCTION public.complete_automation_occurrence(uuid, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_automation_occurrence(uuid, text, uuid, text, text, text) TO service_role;

COMMENT ON TABLE public.reminder_settings IS 'Task 20: reminders & automation settings, one row per business; default mode in_app; owner-only.';
COMMENT ON TABLE public.automation_occurrences IS 'Task 20: one row per (account, dedup key) = at most one automatic message per quote per rule; service_role writes.';
