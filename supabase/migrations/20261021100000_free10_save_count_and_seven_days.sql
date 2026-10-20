-- ============================================================================================================================
-- 20261021100000_free10_save_count_and_seven_days.sql  -  the Free plan server rule of PayPlus stage 2: a quote counts when it is
--                                                         SAVED, and the free period ends after 10 quotes OR 7 days
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-20 (task-control payplusStage2_20261020 + decisions20261020b; IRON-LANDING-001 as amended 2026-10-20):
--   1. Free = 10 counted quotes OR 7 days, whichever ends first. The 7 days start when the account's free window starts:
--      a NEW account at its provisioning while free_issue is 'enforced'; every account that exists when free_issue first becomes
--      'enforced' (and every account provisioned while it was not) on that activation day ("מיום ההפעלה").
--   2. A quote counts when it is SAVED with a customer and at least one item, once per (quote, customer). An empty draft never
--      counts; editing and saving again never counts again ("כמו היום, ובנוסף בשמירה").
--   3. The output rule of 20261011130000 stays: a changed version output to the customer, or another customer, counts; the same
--      version again never counts. The FIRST output of a (quote, customer) that was already counted at its save never counts a
--      second time.
--   4. After the end (10 used or 7 days): no new quote, no new counted save / output; everything already counted stays usable
--      (its outputs, download, print, links already sent). Paid and LIFETIME accounts are unlimited and never end.
--   Inert while free_issue is not 'enforced': no save is counted, no window starts, the 7 days refuse nothing (also in 'shadow').
--   This migration changes no phase; it writes account rows only when free_issue is ALREADY 'enforced' (section 14: the windows start
--   now). Function bodies 8-13 are the current bodies with only the marked changes (generated with checked replacements).
--   A started window never changes (guarded for every role; a DB-owner test device disables triggers with session_replication_role).
--   Re-runnable: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS.
--   ROLLBACK (DB owner): set_activation_phase('free_issue', 'prepared', ...) stops every path at once (the safe rollback). Restoring
--   the older function bodies is one-way only while NO save row is counted: the 20261007150000 counter guard ignores the save ledger,
--   so with a counted save row it would refuse every later write of that account (incl. PayPlus opening its subscription).
-- ============================================================================================================================

-- 1. the account's free window (NULL = not started; the window is never applied while it is NULL)
ALTER TABLE public.account_entitlements ADD COLUMN IF NOT EXISTS free_window_starts_at timestamptz NULL;

-- 2. window helpers: 7 days = 168 hours from the start (one fixed length, independent of time zone / daylight saving)
CREATE OR REPLACE FUNCTION public.free10_ends_at(p_user_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT e.free_window_starts_at + interval '168 hours'
    FROM public.account_entitlements e
   WHERE e.user_id = p_user_id AND e.account_mode = 'free_10'
     AND NOT public.quote_output_unlimited(p_user_id, e.account_mode)
$function$;
REVOKE ALL ON FUNCTION public.free10_ends_at(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- the window end as the API carries it: UTC with milliseconds (one format every browser engine parses)
CREATE OR REPLACE FUNCTION public.free10_ends_at_text(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT to_char(public.free10_ends_at(p_user_id) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$function$;
REVOKE ALL ON FUNCTION public.free10_ends_at_text(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- the 7 days refuse only while free_issue is 'enforced' (shadow / prepared stay inert, also for a window started earlier)
CREATE OR REPLACE FUNCTION public.free10_period_ended(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced')
     AND coalesce(now() >= public.free10_ends_at(p_user_id), false)
$function$;
REVOKE ALL ON FUNCTION public.free10_period_ended(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 3. the window starts: a Free account provisioned (or becoming Free) while free_issue is 'enforced' starts now. A window starts
--    only at now() and, once started, never changes - for every role (service_role included): no reset, no extension.
CREATE OR REPLACE FUNCTION public.account_entitlements_free_window_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.free_window_starts_at IS NOT NULL
     AND NEW.free_window_starts_at IS DISTINCT FROM OLD.free_window_starts_at THEN
    RAISE EXCEPTION 'account_entitlements: a started free window never changes' USING ERRCODE = '42501';
  END IF;
  IF NEW.free_window_starts_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.free_window_starts_at IS NULL)
     AND NEW.free_window_starts_at <> now() THEN
    RAISE EXCEPTION 'account_entitlements: a free window starts only now' USING ERRCODE = '42501';
  END IF;
  IF NEW.free_window_starts_at IS NULL AND NEW.account_mode = 'free_10'
     AND EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    NEW.free_window_starts_at := now();
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.account_entitlements_free_window_stamp() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS account_entitlements_free_window_stamp ON public.account_entitlements;
CREATE TRIGGER account_entitlements_free_window_stamp BEFORE INSERT OR UPDATE ON public.account_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.account_entitlements_free_window_stamp();

--    ... and every Free account without a window starts when free_issue becomes 'enforced' (the activation day). A rollback and a
--    later re-activation never restart a window that already started.
CREATE OR REPLACE FUNCTION public.subscription_activation_free_window_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.component = 'free_issue' AND NEW.phase = 'enforced' AND OLD.phase IS DISTINCT FROM 'enforced' THEN
    UPDATE public.account_entitlements
       SET free_window_starts_at = now(), entitlement_version = entitlement_version + 1, updated_at = now()
     WHERE account_mode = 'free_10' AND free_window_starts_at IS NULL;
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.subscription_activation_free_window_start() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS subscription_activation_free_window_start ON public.subscription_activation;
CREATE TRIGGER subscription_activation_free_window_start AFTER UPDATE ON public.subscription_activation
  FOR EACH ROW EXECUTE FUNCTION public.subscription_activation_free_window_start();

-- 4. save ledger: one append-only row per counted (account, quote, customer). No FK: survives deletion (never returns quota).
CREATE TABLE IF NOT EXISTS public.quote_save_counts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL,
  quote_id              uuid        NOT NULL,
  customer_binding      text        NOT NULL,
  counted_against_free  boolean     NOT NULL,
  account_mode_at_event text        NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_save_counts_one_per_customer UNIQUE (user_id, quote_id, customer_binding)
);
ALTER TABLE public.quote_save_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_save_counts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.quote_save_counts TO authenticated, service_role;
DROP POLICY IF EXISTS quote_save_counts_own_read ON public.quote_save_counts;
CREATE POLICY quote_save_counts_own_read ON public.quote_save_counts FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS quote_save_counts_service_read ON public.quote_save_counts;
CREATE POLICY quote_save_counts_service_read ON public.quote_save_counts FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.quote_save_counts_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION 'quote_save_counts is append-only (% refused)', TG_OP USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION public.quote_save_counts_append_only() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quote_save_counts_no_update_delete ON public.quote_save_counts;
CREATE TRIGGER quote_save_counts_no_update_delete BEFORE UPDATE OR DELETE ON public.quote_save_counts
  FOR EACH ROW EXECUTE FUNCTION public.quote_save_counts_append_only();
DROP TRIGGER IF EXISTS quote_save_counts_no_truncate ON public.quote_save_counts;
CREATE TRIGGER quote_save_counts_no_truncate BEFORE TRUNCATE ON public.quote_save_counts
  FOR EACH STATEMENT EXECUTE FUNCTION public.quote_save_counts_append_only();

-- 5. the Free counter is a cache of BOTH ledgers: counted output rows + counted save rows (body 20261007150000 + the marked change)
CREATE OR REPLACE FUNCTION public.account_entitlements_counter_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ledger integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'account_entitlements: user_id is immutable' USING ERRCODE = '42501';
  END IF;
  SELECT count(*)::integer INTO v_ledger FROM public.quote_issue_ledger l WHERE l.user_id = NEW.user_id AND l.counted_against_free;
  -- 20261021100000: + the counted saves
  v_ledger := v_ledger + (SELECT count(*)::integer FROM public.quote_save_counts s WHERE s.user_id = NEW.user_id AND s.counted_against_free);
  IF NEW.free_issues_consumed <> v_ledger THEN
    RAISE EXCEPTION 'account_entitlements: free_issues_consumed (%) must equal the counted ledger rows (%)',
      NEW.free_issues_consumed, v_ledger USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.account_entitlements_counter_guard() FROM PUBLIC, anon, authenticated, service_role;

-- 6. is the next output of (quote, customer) the first one after a counted save? Then it never counts.
CREATE OR REPLACE FUNCTION public.free10_output_covered_by_save(p_user_id uuid, p_quote_id uuid, p_binding text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.quote_save_counts s
                  WHERE s.user_id = p_user_id AND s.quote_id = p_quote_id AND s.customer_binding = p_binding AND s.counted_against_free)
     AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l
                      WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id AND l.customer_binding = p_binding)
$function$;
REVOKE ALL ON FUNCTION public.free10_output_covered_by_save(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

--    a live reservation of such a covered output holds no free slot (body 20261007150000 + the marked change), so sending a quote
--    already counted at its save never blocks another save / output at 9 of 10
CREATE OR REPLACE FUNCTION public.quote_output_live_reservations(p_user_id uuid, p_except_attempt uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT count(*)::integer FROM public.quote_output_attempts a
   WHERE a.user_id = p_user_id AND a.state = 'preparing' AND a.expires_at > now()
     AND a.attempt_id IS DISTINCT FROM p_except_attempt
     -- 20261021100000: an output covered by its counted save reserves nothing
     AND NOT public.free10_output_covered_by_save(a.user_id, a.quote_id, a.customer_binding)
$function$;
REVOKE ALL ON FUNCTION public.quote_output_live_reservations(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 7. count on save. Runs inside the saving transaction (a refusal rolls the whole save back) when the quote gets its first item or
--    a new customer. Counts once per (quote, customer); never an empty draft, a signed / closed quote, a quote Sent before
--    activation, a (quote, customer) already output, a paid or LIFETIME account, or anything while free_issue is not 'enforced'.
--    Lock order as the output functions: activation, account, then the save row (the saving transaction already holds the quote).
CREATE OR REPLACE FUNCTION public.free10_count_quote_save(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phase   text;
  v_q       record;
  v_binding text;
  v_ent     public.account_entitlements%ROWTYPE;
BEGIN
  IF p_quote_id IS NULL THEN
    RETURN;
  END IF;
  -- a plain read first: while not enforced no save takes any lock here
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN;
  END IF;
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  IF v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN;
  END IF;
  SELECT q.id, q.user_id, q.client_id, q.status, q.signature INTO v_q FROM public.quotes q WHERE q.id = p_quote_id;
  IF v_q.id IS NULL OR v_q.user_id IS NULL OR v_q.client_id IS NULL
     OR coalesce(v_q.signature, '') <> '' OR lower(coalesce(v_q.status, '')) NOT IN ('draft', 'sent')
     OR NOT EXISTS (SELECT 1 FROM public.quote_items i WHERE i.quote_id = p_quote_id) THEN
    RETURN;
  END IF;
  v_binding := v_q.client_id::text;
  -- cheap exits before the account lock: already counted for this customer, or already output to this customer
  IF EXISTS (SELECT 1 FROM public.quote_save_counts s WHERE s.user_id = v_q.user_id AND s.quote_id = p_quote_id AND s.customer_binding = v_binding)
     OR EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = v_q.user_id AND l.quote_id = p_quote_id AND l.customer_binding = v_binding) THEN
    RETURN;
  END IF;
  -- a quote Sent before activation (no output and no counted save of this authority) never counts
  IF lower(coalesce(v_q.status, '')) = 'sent'
     AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = v_q.user_id AND l.quote_id = p_quote_id)
     AND NOT EXISTS (SELECT 1 FROM public.quote_save_counts s WHERE s.user_id = v_q.user_id AND s.quote_id = p_quote_id) THEN
    RETURN;
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = v_q.user_id FOR UPDATE;
  IF NOT FOUND OR v_ent.account_mode <> 'free_10' OR public.quote_output_unlimited(v_q.user_id, v_ent.account_mode) THEN
    RETURN;  -- paid / LIFETIME unlimited; an unprovisioned account keeps the output enforcement
  END IF;
  -- re-check under the account lock (a parallel save of the same quote + customer)
  IF EXISTS (SELECT 1 FROM public.quote_save_counts s WHERE s.user_id = v_q.user_id AND s.quote_id = p_quote_id AND s.customer_binding = v_binding) THEN
    RETURN;
  END IF;
  IF public.free10_period_ended(v_q.user_id) THEN
    RAISE EXCEPTION 'free_period_ended: the 7 free days have ended; a new quote needs the subscription' USING ERRCODE = 'P0001';
  END IF;
  IF v_ent.free_issues_consumed + public.quote_output_live_reservations(v_q.user_id, NULL) >= v_ent.free_issue_limit THEN
    RAISE EXCEPTION 'free_issue_limit_reached: all % free quotes are used; a new quote needs the subscription', v_ent.free_issue_limit
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.quote_save_counts (user_id, quote_id, customer_binding, counted_against_free, account_mode_at_event)
  VALUES (v_q.user_id, p_quote_id, v_binding, true, v_ent.account_mode);
  UPDATE public.account_entitlements
     SET free_issues_consumed = free_issues_consumed + 1, entitlement_version = entitlement_version + 1, updated_at = now()
   WHERE user_id = v_q.user_id;
END
$function$;
REVOKE ALL ON FUNCTION public.free10_count_quote_save(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quotes_free10_count_on_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.client_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.client_id IS DISTINCT FROM OLD.client_id) THEN
    PERFORM public.free10_count_quote_save(NEW.id);
  END IF;
  RETURN NULL;
END
$function$;
REVOKE ALL ON FUNCTION public.quotes_free10_count_on_save() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quotes_free10_count_on_save ON public.quotes;
CREATE TRIGGER quotes_free10_count_on_save AFTER INSERT OR UPDATE OF client_id ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_free10_count_on_save();

CREATE OR REPLACE FUNCTION public.quote_items_free10_count_on_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  PERFORM public.free10_count_quote_save(NEW.quote_id);
  RETURN NULL;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_items_free10_count_on_save() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quote_items_free10_count_on_save ON public.quote_items;
CREATE TRIGGER quote_items_free10_count_on_save AFTER INSERT OR UPDATE OF quote_id ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.quote_items_free10_count_on_save();

-- 8. prepare (body 20261018100000 + the marked 20261021100000 changes)
CREATE OR REPLACE FUNCTION public.prepare_quote_output(p_user_id uuid, p_quote_id uuid, p_channel text, p_idempotency_key text,
                                            p_expected_digest text, p_style text, p_media_count integer,
                                            p_style_version integer, p_presentation_digest text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  c_ttl      constant interval := interval '10 minutes';
  v_phase    text;
  v_ent      public.account_entitlements%ROWTYPE;
  v_q        record;
  v_by_key   public.quote_output_attempts%ROWTYPE;
  v_live     public.quote_output_attempts%ROWTYPE;
  v_final    public.quote_issue_ledger%ROWTYPE;
  v_binding  text;
  v_doc      jsonb;
  v_digest   text;
  v_issuer   jsonb;
  v_cap      jsonb;
  v_reserved integer;
  v_has_final boolean;
  v_uncounted boolean;
  v_attempt  uuid := gen_random_uuid();
  v_expires  timestamptz := now() + c_ttl;
BEGIN
  IF p_user_id IS NULL OR p_quote_id IS NULL
     OR p_channel IS NULL OR p_channel NOT IN ('send', 'public_share', 'final_pdf', 'final_print')
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 200
     OR p_expected_digest IS NULL OR p_expected_digest !~ '^[0-9a-f]{64}$'
     OR p_style IS NULL OR p_style NOT IN ('classic', 'modern', 'visual')
     OR p_media_count IS NULL OR p_media_count < 0
     OR p_style_version IS NULL OR p_style_version < 1
     OR p_presentation_digest IS NULL OR p_presentation_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'prepare_quote_output: invalid arguments' USING ERRCODE = '22023';
  END IF;

  -- (1) activation gate (lock order 1)
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  IF v_phase IS NULL OR v_phase = 'prepared' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_activated');
  END IF;

  -- (2) account (lock order 2) - unprovisioned accounts never pass, in shadow or enforced
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
  END IF;

  -- (3) quote (lock order 3); a foreign quote answers exactly like a missing one
  SELECT q.id, q.status, q.signature, q.client_id INTO v_q
    FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = p_user_id FOR UPDATE;

  -- (4) attempts / ledger (lock order 4): expire own stale reservations, then idempotency and finals
  UPDATE public.quote_output_attempts a SET state = 'expired', aborted_at = now(), failure_code = 'reservation_ttl'
   WHERE a.user_id = p_user_id AND a.state = 'preparing' AND a.expires_at <= now();

  SELECT * INTO v_by_key FROM public.quote_output_attempts a WHERE a.user_id = p_user_id AND a.idempotency_key = p_idempotency_key;
  IF FOUND AND (v_by_key.quote_id <> p_quote_id OR v_by_key.requested_channel <> p_channel) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'idempotency_key_reused');
  END IF;

  IF v_q.id IS NULL THEN
    -- deleted after an output: metadata of its latest output only; no new consumption, no regenerated document, no refund
    SELECT * INTO v_final FROM public.quote_issue_ledger l
     WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id ORDER BY l.created_at DESC, l.id DESC LIMIT 1;
    IF FOUND THEN
      RETURN public.quote_output_final_response(v_final) || jsonb_build_object('ok', false, 'code', 'document_unavailable',
                                                                                'reason', 'quote_deleted');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'quote_not_found');
  END IF;

  -- Task 30 (Owner 2026-10-11): the counted unit is the quote VERSION for its CUSTOMER = (customer binding, content digest).
  -- The content digest (quote-document/v1) covers the customer block (name / email / phone / address), the recipient
  -- (attn_name / attn_role), header, sections, items and totals. The caller must have seen exactly the current version.
  v_binding := coalesce(v_q.client_id::text, 'none');
  v_doc := public.quote_output_deal_document(p_user_id, p_quote_id);
  v_digest := public.quote_output_digest(v_doc);
  IF v_digest <> p_expected_digest THEN
    RETURN jsonb_build_object('ok', false, 'code', 'quote_changed', 'contentDigest', v_digest);
  END IF;
  -- the same version for the same customer was already output (any channel): its durable final result, never a second count
  SELECT * INTO v_final FROM public.quote_issue_ledger l
   WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id AND l.customer_binding = v_binding AND l.content_digest = v_digest;
  IF FOUND THEN
    RETURN public.quote_output_final_response(v_final) || jsonb_build_object('alreadyFinalized', true);
  END IF;
  -- one idempotency key = one (quote, channel, version): a key reused for another version / customer is refused
  IF v_by_key.attempt_id IS NOT NULL AND (v_by_key.content_digest <> v_digest OR v_by_key.customer_binding <> v_binding) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'idempotency_key_reused');
  END IF;

  IF v_by_key.attempt_id IS NOT NULL THEN
    IF v_by_key.state = 'preparing' THEN
      RETURN public.quote_output_preparing_response(v_by_key, true, NULL);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_' || v_by_key.state, 'failureCode', v_by_key.failure_code,
                              'attemptId', v_by_key.attempt_id);
  END IF;

  -- a live reservation of the same quote under another key: the racer gets that same attempt, never a second reservation
  SELECT * INTO v_live FROM public.quote_output_attempts a
   WHERE a.user_id = p_user_id AND a.quote_id = p_quote_id AND a.state = 'preparing';
  IF FOUND THEN
    IF v_live.customer_binding = v_binding AND v_live.content_digest = v_digest THEN
      RETURN public.quote_output_preparing_response(v_live, true, jsonb_build_object('sameQuoteLiveAttempt', true));
    END IF;
    -- another version of this quote is being output right now: never a parallel second reservation (retry shortly)
    RETURN jsonb_build_object('ok', false, 'code', 'output_in_progress');
  END IF;

  -- (5) quote state. A new VERSION may be output while the quote is Draft, or Sent through this authority (it already has an
  --     output). Signed / approved / other states, and Sent without any output of this authority (legacy), never.
  v_has_final := EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id);
  -- Owner 2026-10-18 ("להתחיל לספור מעכשיו"): a quote already Sent before activation (no output of this authority) may be output
  -- again; it is a pre-activation quote and never counts. Signed / approved / other states stay closed.
  IF coalesce(v_q.signature, '') <> '' OR lower(coalesce(v_q.status, '')) NOT IN ('draft', 'sent') THEN
    RETURN jsonb_build_object('ok', false, 'code', CASE WHEN v_has_final THEN 'quote_closed' ELSE 'legacy_issue_policy_pending' END);
  END IF;
  IF v_q.client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'customer_binding_missing');
  END IF;

  -- (6) content version: bound above (v_digest = p_expected_digest)
  -- Owner 2026-10-18: attachments are allowed (the attachment count stays part of the content digest)
  -- issuer block of the document (issuer/v1 projection) is bound too
  v_issuer := public.quote_output_issuer(p_user_id);
  IF v_issuer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'issuer_missing');
  END IF;
  -- logo (CODEX_PREP_CLOSURE_REVIEW.md section 10.1): business_settings.logo_url is a plain, mutable external URL - the same
  -- URL can serve other bytes after issue, so a logo cannot be part of an immutable issued snapshot yet. Fail closed BEFORE
  -- any reservation / snapshot / ledger / consumption. No fetch, no logo storage, no retention decision; an issuer without a
  -- logo (NULL, empty or whitespace-only) continues normally. Future logo support needs a separate immutable logo artifact.
  IF nullif(btrim(coalesce(v_issuer ->> 'logo_url', '')), '') IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'logo_snapshot_policy_pending');
  END IF;

  -- (7) style / media entitlement from server state
  v_cap := public.resolve_style_media_entitlement(v_ent.account_mode, v_ent.style_plan_id);
  IF NOT (v_cap -> 'allowedStyles') ? p_style THEN
    RETURN jsonb_build_object('ok', false, 'code', 'style_not_entitled', 'allowedStyles', v_cap -> 'allowedStyles');
  END IF;
  IF p_media_count > 0 AND NOT (v_cap ->> 'mediaAllowed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'code', 'media_not_entitled');
  END IF;

  -- (8) commercial gate: paid quota policy NOT decided -> fail closed; free = final + live reservations < limit
  -- Owner 2026-10-18: paid / LIFETIME are unlimited and a pre-activation Sent quote never counts - recorded, never counted
  v_uncounted := public.quote_output_unlimited(p_user_id, v_ent.account_mode)
                 OR (lower(coalesce(v_q.status, '')) = 'sent' AND NOT v_has_final)
                 -- 20261021100000: the first output of a (quote, customer) already counted at its save never counts again
                 OR public.free10_output_covered_by_save(p_user_id, p_quote_id, v_binding);
  -- 20261021100000: the 7 free days ended -> a counted output is refused (an uncounted one stays allowed). The code stays the closed
  -- contract's free_issue_limit_reached (subscription-authority passes no other); reason + freeIssues tell which end it was.
  IF NOT v_uncounted AND public.free10_period_ended(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached', 'reason', 'free_period_ended',
      'freeIssues', jsonb_build_object('limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed,
                                       'reserved', public.quote_output_live_reservations(p_user_id, NULL), 'remaining', 0,
                                       'periodEnded', true, 'endsAt', public.free10_ends_at_text(p_user_id)));
  END IF;
  v_reserved := public.quote_output_live_reservations(p_user_id, NULL);
  IF NOT v_uncounted AND v_ent.free_issues_consumed + v_reserved >= v_ent.free_issue_limit THEN
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached',
      'freeIssues', jsonb_build_object('limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed,
                                       'reserved', v_reserved, 'remaining', 0));
  END IF;

  -- (9) reservation (no final consumption)
  INSERT INTO public.quote_output_attempts
    (attempt_id, user_id, quote_id, customer_binding, state, requested_channel, idempotency_key, content_digest, style_id,
     media_count, style_version, issuer_digest, presentation_digest, snapshot_path, expires_at, account_mode_at_event,
     entitlement_version)
  VALUES
    (v_attempt, p_user_id, p_quote_id, v_binding, 'preparing', p_channel, p_idempotency_key, v_digest, p_style, p_media_count,
     p_style_version, public.quote_output_digest(v_issuer), p_presentation_digest,
     format('issued-documents/%s/%s/%s.json', p_user_id, p_quote_id, v_attempt), v_expires, v_ent.account_mode,
     v_ent.entitlement_version)
  RETURNING * INTO v_live;

  RETURN public.quote_output_preparing_response(v_live, false, jsonb_build_object(
    'freeIssues', jsonb_build_object('limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed,
                                     'reserved', v_reserved + 1,
                                     'remaining', v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved - 1)));
END
$function$;
REVOKE ALL ON FUNCTION public.prepare_quote_output(uuid, uuid, text, text, text, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_quote_output(uuid, uuid, text, text, text, text, integer, integer, text) TO service_role;

-- 9. finalize (body 20261018100000 + the marked changes)
CREATE OR REPLACE FUNCTION public.finalize_quote_output(p_user_id uuid, p_attempt_id uuid, p_snapshot_path text, p_sha256 text,
                                             p_bytes bigint, p_schema_version integer, p_presentation_digest text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phase    text;
  v_quote_id uuid;
  v_ent      public.account_entitlements%ROWTYPE;
  v_q        record;
  v_a        public.quote_output_attempts%ROWTYPE;
  v_ledger   public.quote_issue_ledger%ROWTYPE;
  v_obj_size text;
  v_cap      jsonb;
  v_reserved integer;
  v_counted  boolean;
BEGIN
  IF p_user_id IS NULL OR p_attempt_id IS NULL OR p_snapshot_path IS NULL
     OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' OR p_bytes IS NULL OR p_bytes <= 0 OR p_schema_version IS NULL
     OR p_presentation_digest IS NULL OR p_presentation_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'finalize_quote_output: invalid arguments' USING ERRCODE = '22023';
  END IF;

  -- (1) activation gate: a phase rolled back to 'prepared' stops every finalization
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  IF v_phase IS NULL OR v_phase = 'prepared' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_activated');
  END IF;

  -- unlocked lookup only to learn which quote to lock (the row is re-read under lock below)
  SELECT a.quote_id INTO v_quote_id FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id AND a.user_id = p_user_id;
  IF v_quote_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_not_found');
  END IF;

  -- (2) account, (3) quote, (4) attempt - fixed lock order
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
  END IF;
  SELECT q.id, q.status, q.signature, q.client_id INTO v_q
    FROM public.quotes q WHERE q.id = v_quote_id AND q.user_id = p_user_id FOR UPDATE;
  SELECT * INTO v_a FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id FOR UPDATE;

  IF v_a.state = 'finalized' THEN
    SELECT * INTO v_ledger FROM public.quote_issue_ledger l WHERE l.attempt_id = p_attempt_id;
    IF v_a.snapshot_sha256 <> p_sha256 OR v_a.snapshot_bytes <> p_bytes THEN
      RETURN jsonb_build_object('ok', false, 'code', 'snapshot_mismatch');  -- a finalized attempt is never re-bound
    END IF;
    RETURN public.quote_output_final_response(v_ledger);  -- retry after a lost response: the same durable answer
  END IF;
  IF v_a.state IN ('aborted', 'expired') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_' || v_a.state, 'failureCode', v_a.failure_code);
  END IF;
  IF v_a.expires_at <= now() THEN
    UPDATE public.quote_output_attempts SET state = 'expired', aborted_at = now(), failure_code = 'reservation_ttl'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_expired', 'failureCode', 'reservation_ttl');
  END IF;

  -- (5) snapshot binding: server-derived path, supported schema, object present in the private bucket with the same size.
  --     Mismatches leave the attempt PREPARING (recoverable until its TTL) and consume nothing.
  IF p_snapshot_path <> v_a.snapshot_path THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_mismatch', 'field', 'path');
  END IF;
  IF p_schema_version <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_mismatch', 'field', 'schemaVersion');
  END IF;
  SELECT o.metadata ->> 'size' INTO v_obj_size FROM storage.objects o
   WHERE o.bucket_id = 'quote-files' AND o.name = v_a.snapshot_path;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_missing');
  END IF;
  -- the platform's recorded size is mandatory (fail closed when absent); the hash itself is verified by the trusted
  -- orchestrator from the read-back bytes and RECORDED here
  IF v_obj_size IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_metadata_missing');
  END IF;
  IF v_obj_size <> p_bytes::text THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_mismatch', 'field', 'bytes');
  END IF;

  -- (6) the deal must be exactly what was reserved
  IF v_q.id IS NULL THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'quote_deleted'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'quote_not_found');
  END IF;
  -- Task 30: a customer change during the output makes it ANOTHER version -> this attempt ends; the new version is prepared anew
  IF coalesce(v_q.client_id::text, 'none') <> v_a.customer_binding THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'customer_changed'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'quote_changed');
  END IF;
  IF coalesce(v_q.signature, '') <> '' OR lower(coalesce(v_q.status, '')) NOT IN ('draft', 'sent')
     OR public.quote_output_digest(public.quote_output_deal_document(p_user_id, v_q.id)) <> v_a.content_digest THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'quote_changed'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'quote_changed');
  END IF;
  IF public.quote_output_issuer(p_user_id) IS NULL
     OR public.quote_output_digest(public.quote_output_issuer(p_user_id)) <> v_a.issuer_digest THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'issuer_changed'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'issuer_changed');
  END IF;
  IF p_presentation_digest <> v_a.presentation_digest THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'presentation_changed'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'presentation_changed');
  END IF;

  -- (7) entitlement and quota again (state may have changed since prepare)
  v_cap := public.resolve_style_media_entitlement(v_ent.account_mode, v_ent.style_plan_id);
  IF NOT (v_cap -> 'allowedStyles') ? v_a.style_id OR (v_a.media_count > 0 AND NOT (v_cap ->> 'mediaAllowed')::boolean) THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'not_entitled'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', CASE WHEN NOT (v_cap -> 'allowedStyles') ? v_a.style_id
                                                        THEN 'style_not_entitled' ELSE 'media_not_entitled' END);
  END IF;
  -- Owner 2026-10-18: paid / LIFETIME unlimited; a pre-activation Sent quote (no output yet) never counts
  v_counted := NOT public.quote_output_unlimited(p_user_id, v_ent.account_mode)
               AND NOT (lower(coalesce(v_q.status, '')) = 'sent'
                        AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id AND l.quote_id = v_q.id))
               -- 20261021100000: the first output of a (quote, customer) already counted at its save never counts again
               AND NOT public.free10_output_covered_by_save(p_user_id, v_q.id, v_a.customer_binding);
  -- 20261021100000: the 7 free days ended since the reservation -> a counted output ends here
  IF v_counted AND public.free10_period_ended(p_user_id) THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'free_period_ended'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached', 'reason', 'free_period_ended');
  END IF;
  v_reserved := public.quote_output_live_reservations(p_user_id, p_attempt_id);
  IF v_counted AND v_ent.free_issues_consumed + v_reserved >= v_ent.free_issue_limit THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'free_issue_limit_reached'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached');
  END IF;

  -- Task 30 backstop: this exact version was already output for this customer (never a second count; the attempt ends)
  SELECT * INTO v_ledger FROM public.quote_issue_ledger l
   WHERE l.user_id = p_user_id AND l.quote_id = v_q.id AND l.customer_binding = v_a.customer_binding
     AND l.content_digest = v_a.content_digest;
  IF FOUND THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'version_already_output'
     WHERE attempt_id = p_attempt_id;
    RETURN public.quote_output_final_response(v_ledger) || jsonb_build_object('alreadyFinalized', true);
  END IF;

  -- (8) COMMIT POINT: attempt FINALIZED + ledger + counter (+ Sent for 'send' only), all in this transaction
  UPDATE public.quote_output_attempts
     SET state = 'finalized', finalized_at = now(), snapshot_sha256 = p_sha256, snapshot_bytes = p_bytes,
         snapshot_schema_version = p_schema_version, counted_against_free = v_counted
   WHERE attempt_id = p_attempt_id;
  INSERT INTO public.quote_issue_ledger
    (attempt_id, user_id, quote_id, first_output_channel, idempotency_key, counted_against_free, account_mode_at_event,
     customer_binding, content_digest, issuer_digest, presentation_digest, snapshot_path, snapshot_sha256, snapshot_bytes,
     snapshot_schema_version)
  VALUES
    (p_attempt_id, p_user_id, v_q.id, v_a.requested_channel, v_a.idempotency_key, v_counted, v_ent.account_mode,
     v_a.customer_binding, v_a.content_digest, v_a.issuer_digest, v_a.presentation_digest, v_a.snapshot_path, p_sha256,
     p_bytes, p_schema_version)
  RETURNING * INTO v_ledger;
  IF v_counted THEN
    UPDATE public.account_entitlements
       SET free_issues_consumed = free_issues_consumed + 1, entitlement_version = entitlement_version + 1, updated_at = now()
     WHERE user_id = p_user_id;
  END IF;
  IF v_a.requested_channel = 'send' THEN
    UPDATE public.quotes SET status = 'sent' WHERE id = v_q.id AND user_id = p_user_id AND lower(status) = 'draft';
  END IF;
  RETURN public.quote_output_final_response(v_ledger);
END
$function$;
REVOKE ALL ON FUNCTION public.finalize_quote_output(uuid, uuid, text, text, bigint, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_quote_output(uuid, uuid, text, text, bigint, integer, text) TO service_role;

-- 10. owner balance (body 20261018100000 + the marked changes)
CREATE OR REPLACE FUNCTION public.get_free_issue_balance(p_quote_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_phase    text;
  v_ent      public.account_entitlements%ROWTYPE;
  v_reserved integer;
  v_would    boolean := false;
  v_unl      boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'get_free_issue_balance: not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_phase IS NULL OR v_phase = 'prepared' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_activated');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
  END IF;
  v_reserved := public.quote_output_live_reservations(v_uid, NULL);
  v_unl := public.quote_output_unlimited(v_uid, v_ent.account_mode);
  IF p_quote_id IS NOT NULL THEN
    -- Task 30: would the CURRENT version (customer + content) count? Not when exactly this version was already output.
    v_would := v_ent.account_mode = 'free_10' AND NOT v_unl
      AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = v_uid
                     AND coalesce(q.signature, '') = ''
                     AND (lower(coalesce(q.status, '')) = 'draft'
                          OR (lower(coalesce(q.status, '')) = 'sent'
                              AND EXISTS (SELECT 1 FROM public.quote_issue_ledger l0 WHERE l0.user_id = v_uid AND l0.quote_id = q.id))))
      AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l, public.quotes q
                       WHERE q.id = p_quote_id AND q.user_id = v_uid AND l.user_id = v_uid AND l.quote_id = p_quote_id
                         AND l.customer_binding = coalesce(q.client_id::text, 'none')
                         AND l.content_digest = public.quote_output_digest(public.quote_output_deal_document(v_uid, p_quote_id)))
      -- 20261021100000: the first output of a (quote, customer) already counted at its save would not count
      AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = v_uid
                         AND public.free10_output_covered_by_save(v_uid, q.id, coalesce(q.client_id::text, 'none')));
  END IF;
  RETURN jsonb_build_object('ok', true, 'phase', v_phase, 'accountMode', v_ent.account_mode,
    'limit', CASE WHEN v_ent.account_mode = 'free_10' AND NOT v_unl THEN v_ent.free_issue_limit END,
    'consumed', v_ent.free_issues_consumed, 'reserved', v_reserved,
    'remaining', CASE WHEN v_ent.account_mode = 'free_10' AND NOT v_unl
                      THEN greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0) END,
    'unlimited', v_unl,
    'paidQuotePolicy', CASE WHEN v_unl THEN 'unlimited' END,
    'wouldConsume', v_would,
    'freeEndsAt', public.free10_ends_at_text(v_uid),
    'periodEnded', public.free10_period_ended(v_uid));
END
$function$;
REVOKE ALL ON FUNCTION public.get_free_issue_balance(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_free_issue_balance(uuid) TO authenticated;

-- 11. pre-output notice (body 20261018100000 + the marked changes)
CREATE OR REPLACE FUNCTION public.output_notice(p_user_id uuid, p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phase    text;
  v_ent      public.account_entitlements%ROWTYPE;
  v_final    boolean;
  v_reserved integer;
  v_unl      boolean;
  v_legacy   boolean;
  v_covered  boolean;
BEGIN
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_activated');
  END IF;
  IF p_user_id IS NULL OR p_quote_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'quote_not_found');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
  END IF;
  -- Task 30: "already finalized" = THIS version (current customer binding + current content digest) was already output
  v_final := EXISTS (SELECT 1 FROM public.quote_issue_ledger l, public.quotes q
                      WHERE q.id = p_quote_id AND q.user_id = p_user_id AND l.user_id = p_user_id AND l.quote_id = p_quote_id
                        AND l.event_type = 'first_client_output' AND l.customer_binding = coalesce(q.client_id::text, 'none')
                        AND l.content_digest = public.quote_output_digest(public.quote_output_deal_document(p_user_id, p_quote_id)));
  v_reserved := public.quote_output_live_reservations(p_user_id, NULL);
  v_unl := public.quote_output_unlimited(p_user_id, v_ent.account_mode);
  -- a pre-activation Sent quote (no output of this authority yet) never counts
  v_legacy := EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = p_user_id AND lower(coalesce(q.status, '')) = 'sent')
              AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id);
  -- 20261021100000: the first output of a (quote, customer) already counted at its save never counts again
  v_covered := EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = p_user_id
                         AND public.free10_output_covered_by_save(p_user_id, q.id, coalesce(q.client_id::text, 'none')));
  RETURN jsonb_build_object(
    'ok', true,
    'contentDigest', public.quote_output_digest(public.quote_output_deal_document(p_user_id, p_quote_id)),
    'alreadyFinalized', v_final,
    'wouldConsume', v_ent.account_mode = 'free_10' AND NOT v_unl AND NOT v_legacy AND NOT v_final AND NOT v_covered,
    'unlimited', v_unl,
    'remaining', CASE WHEN v_ent.account_mode = 'free_10' AND NOT v_unl
                      THEN greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0) END,
    'accountMode', v_ent.account_mode,
    'freeEndsAt', public.free10_ends_at_text(p_user_id),
    'periodEnded', public.free10_period_ended(p_user_id));
END
$function$;
REVOKE ALL ON FUNCTION public.output_notice(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.output_notice(uuid, uuid) TO service_role;

-- 12. new-quote guard (body 20261018100000 + the marked change)
CREATE OR REPLACE FUNCTION public.enforce_free10_quote_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ent public.account_entitlements%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = NEW.user_id;
  IF NOT FOUND OR v_ent.account_mode <> 'free_10' OR public.quote_output_unlimited(NEW.user_id, v_ent.account_mode) THEN
    RETURN NEW; -- paid (current or legacy) is never blocked here; unprovisioned keeps the existing output enforcement
  END IF;
  -- 20261021100000: the 7 free days ended -> a new quote needs the subscription
  IF public.free10_period_ended(NEW.user_id) THEN
    RAISE EXCEPTION 'free_period_ended: the 7 free days have ended; a new quote needs the subscription' USING ERRCODE = 'P0001';
  END IF;
  IF v_ent.free_issues_consumed + public.quote_output_live_reservations(NEW.user_id, NULL) >= v_ent.free_issue_limit THEN
    RAISE EXCEPTION 'free_issue_limit_reached: all % free quotes are used; a new quote needs the subscription', v_ent.free_issue_limit
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.enforce_free10_quote_creation() FROM PUBLIC, anon, authenticated, service_role;

-- 13. account summary (body 20261016100000 + the marked change)
CREATE OR REPLACE FUNCTION public.account_summary_build(p_user_id uuid, p_admin boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_out      text;
  v_cat      text;
  v_bill     text;
  v_ent      public.account_entitlements%ROWTYPE;
  v_market   text;
  v_reserved integer;
  v_active   bigint;
  v_pcv      text;
  v_legacy   jsonb := NULL;
  v_res      jsonb;
BEGIN
  IF p_admin THEN
    SELECT jsonb_build_object('plan', b.plan, 'trialEndsAt', b.trial_ends_at, 'isLifetime', b.is_lifetime) INTO v_legacy
      FROM public.business_settings b WHERE b.user_id = p_user_id;
    v_legacy := coalesce(v_legacy, jsonb_build_object('plan', NULL, 'trialEndsAt', NULL, 'isLifetime', NULL));
  END IF;
  SELECT a.phase INTO v_out FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_out IS NULL OR v_out = 'prepared' THEN
    v_res := jsonb_build_object('ok', false, 'code', 'not_activated');
    RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND THEN
    v_res := jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
    RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
  END IF;
  SELECT a.phase INTO v_cat FROM public.subscription_activation a WHERE a.component = 'catalog_capacity';
  SELECT b.phase INTO v_bill FROM public.billing_activation b WHERE b.id;
  SELECT m.market INTO v_market FROM public.account_market m WHERE m.user_id = p_user_id;
  v_reserved := public.quote_output_live_reservations(p_user_id, NULL);
  SELECT count(*) INTO v_active FROM public.services s WHERE s.user_id = p_user_id;
  IF v_market IS NOT NULL THEN
    SELECT 'pv1:' || left(encode(sha256(convert_to(string_agg(p.price_id || ':' || p.amount_minor || ':' || p.currency || ':'
                                                              || p.valid_from, ',' ORDER BY p.price_id), 'UTF8')), 'hex'), 16)
      INTO v_pcv FROM public.price_versions p WHERE p.market = v_market;
  END IF;
  v_res := jsonb_build_object(
    'ok', true,
    'schema', 'account-summary/v1',
    'version', v_ent.entitlement_version,
    'phase', jsonb_build_object('output', v_out, 'catalog', coalesce(v_cat, 'prepared'), 'billing', coalesce(v_bill, 'off')),
    'market', v_market,
    'plan', jsonb_build_object('id', CASE WHEN v_ent.account_mode = 'free_10' THEN 'free'
                                          WHEN v_ent.package_id IS NOT NULL THEN v_ent.package_id
                                          ELSE v_ent.style_plan_id END),
    'subscriptionStatus', v_ent.subscription_status,
    'billingPeriod', public.account_billing_period(p_user_id),
    'capabilities', to_jsonb(public.subscription_account_capabilities(p_user_id)),
    'eligiblePlans', '{}'::jsonb,
    'free10', CASE WHEN v_ent.account_mode = 'free_10' THEN jsonb_build_object(
                'limit', v_ent.free_issue_limit, 'consumed', v_ent.free_issues_consumed, 'reserved', v_reserved,
                'remaining', greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0),
                -- 20261021100000: the 7-day window (NULL until the account's window starts; never for unlimited accounts)
                'endsAt', public.free10_ends_at_text(p_user_id),
                'periodEnded', public.free10_period_ended(p_user_id)) END,
    'catalog', jsonb_build_object(
                'active', v_active,
                'countDefinition', 'unset',
                'limit', CASE WHEN v_ent.account_mode = 'paid' THEN 100 + 100 * v_ent.catalog_expansion_blocks END,
                'blocks', v_ent.catalog_expansion_blocks,
                'limitDecided', v_ent.account_mode = 'paid'),
    'priceCatalogVersion', v_pcv);
  RETURN CASE WHEN p_admin THEN v_res || jsonb_build_object('legacy', v_legacy) ELSE v_res END;
END
$function$;
REVOKE ALL ON FUNCTION public.account_summary_build(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- 14. applied while free_issue is ALREADY enforced: every Free account without a window starts it now (otherwise nothing is written;
--     on a not-enforced database the windows start on the activation day through section 3).
UPDATE public.account_entitlements
   SET free_window_starts_at = now(), entitlement_version = entitlement_version + 1, updated_at = now()
 WHERE account_mode = 'free_10' AND free_window_starts_at IS NULL
   AND EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced');
