-- tekango-migration-contract: mode=transaction replay=required
-- 20261111100000 - after the free quotes end, drafts are neither edited nor sent; the owner gets an email when a customer signs.
-- Owner typed (console 2026-11-11): "מאשר את תוכנית השחרור האחד לממצאי הסיור (docs/RELEASE_PLAN_UX_FINDINGS_2026-11-11.md), כולל
-- שינוי ב-L-02, L-03, L-04, L-05, L-09, L-10, L-12, L-15, L-17, L-19, L-24 ושינוי חוק IRON-DATE-001 כפי שהקלדתי, עד הלייב" + the
-- additional locks line; answers: finding 7 "במסך וגם בשרת", limited paid accounts "כן, אותה חסימה", counted unsent drafts
-- "גם הן חסומות"; finding 18 "מיד אחרי החתימה".
--
-- 1. free10_work_ended(user): the account is a Free-10 account in the enforced phase and its free quotes are used up OR its 7 free days
--    are over (paid / LIFETIME never). This REVERSES rule 4 of 20261021100000 for drafts ("counted work stays usable"): after the end a
--    draft - also one already counted at its save - is not edited and does not go out. Versions already output stay re-sendable.
-- 2. quote_work_guard(user): refuses with the same closed codes as a new quote (subscription_limited / free_period_ended /
--    free_issue_limit_reached), so the screen opens the plans window exactly as for a new quote.
-- 3. Guard triggers (BEFORE) on quotes (content columns only) and on quote_items / quote_sections: they act only for the OWNER's own
--    write (auth.uid() = the quote's owner), never for a service role, the customer's signature or the cron. The save that counts the
--    10th quote is never refused by its own count: a quote created or counted in THIS transaction passes. Deleting a quote stays allowed
--    (its rows cascade after the quote row is gone). Status changes (sent / paid) and every other column are not content.
-- 4. prepare_quote_output and output_notice: the bodies of 20261110100000 with only the marked lines - a counted draft is no longer
--    "covered by its save" after the end, and the notice says 0 left after the end (the screen then opens the plans window at once).
-- 5. quote_signed_owner_notices: one row per signed quote; the quote-signed-notice Edge Function (service role) inserts it before it
--    emails the owner, so a quote is announced once. No client role can read or write it.
-- Rollback: re-run the two bodies of 20261110100000; DROP the three guard triggers and the two new functions; the notices table may stay.

CREATE OR REPLACE FUNCTION public.free10_work_ended(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ent public.account_entitlements%ROWTYPE;
BEGIN
  IF p_user_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    RETURN false;
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF NOT FOUND OR v_ent.account_mode <> 'free_10' OR public.quote_output_unlimited(p_user_id, v_ent.account_mode) THEN
    RETURN false;
  END IF;
  RETURN public.free10_period_ended(p_user_id)
      OR v_ent.free_issues_consumed + public.quote_output_live_reservations(p_user_id, NULL) >= v_ent.free_issue_limit;
END
$function$;
REVOKE ALL ON FUNCTION public.free10_work_ended(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quote_work_guard(p_user_id uuid, p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_limit integer;
BEGIN
  IF p_user_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    RETURN;
  END IF;
  -- the save that creates or counts this quote right now is never refused by its own count (now() = this transaction's start)
  IF p_quote_id IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.created_at = now())
       OR EXISTS (SELECT 1 FROM public.quote_save_counts s WHERE s.quote_id = p_quote_id AND s.created_at = now())) THEN
    RETURN;
  END IF;
  IF public.paid_account_limited(p_user_id) THEN
    RAISE EXCEPTION 'subscription_limited: the last payment did not go through; editing a quote needs the payment' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.free10_work_ended(p_user_id) THEN
    RETURN;
  END IF;
  IF public.free10_period_ended(p_user_id) THEN
    RAISE EXCEPTION 'free_period_ended: the 7 free days have ended; editing a quote needs the subscription' USING ERRCODE = 'P0001';
  END IF;
  SELECT e.free_issue_limit INTO v_limit FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  RAISE EXCEPTION 'free_issue_limit_reached: all % free quotes are used; editing a quote needs the subscription', v_limit USING ERRCODE = 'P0001';
END
$function$;
REVOKE ALL ON FUNCTION public.quote_work_guard(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quotes_work_guard_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id AND (
       NEW.client_id   IS DISTINCT FROM OLD.client_id   OR NEW.client_type   IS DISTINCT FROM OLD.client_type
    OR NEW.currency    IS DISTINCT FROM OLD.currency    OR NEW.subtotal      IS DISTINCT FROM OLD.subtotal
    OR NEW.tax_rate    IS DISTINCT FROM OLD.tax_rate    OR NEW.total         IS DISTINCT FROM OLD.total
    OR NEW.discount    IS DISTINCT FROM OLD.discount    OR NEW.valid_until   IS DISTINCT FROM OLD.valid_until
    OR NEW.terms       IS DISTINCT FROM OLD.terms       OR NEW.warranty      IS DISTINCT FROM OLD.warranty
    OR NEW.notes       IS DISTINCT FROM OLD.notes       OR NEW.subject       IS DISTINCT FROM OLD.subject
    OR NEW.quote_subject IS DISTINCT FROM OLD.quote_subject OR NEW.project_name IS DISTINCT FROM OLD.project_name
    OR NEW.attn_name   IS DISTINCT FROM OLD.attn_name   OR NEW.attn_role     IS DISTINCT FROM OLD.attn_role) THEN
    PERFORM public.quote_work_guard(OLD.user_id, OLD.id);
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quotes_work_guard_on_update() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quotes_work_guard_on_update ON public.quotes;
CREATE TRIGGER quotes_work_guard_on_update BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_work_guard_on_update();

-- quote_items and quote_sections: any write of the owner on an existing quote (a cascade after the quote row is deleted finds no quote)
CREATE OR REPLACE FUNCTION public.quote_rows_work_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_quote uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.quote_id ELSE NEW.quote_id END;
  v_owner uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND v_quote IS NOT NULL THEN
    SELECT q.user_id INTO v_owner FROM public.quotes q WHERE q.id = v_quote;
    IF v_owner IS NOT NULL AND v_owner = auth.uid() THEN
      PERFORM public.quote_work_guard(v_owner, v_quote);
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_rows_work_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quote_items_work_guard ON public.quote_items;
CREATE TRIGGER quote_items_work_guard BEFORE INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.quote_rows_work_guard();
DROP TRIGGER IF EXISTS quote_sections_work_guard ON public.quote_sections;
CREATE TRIGGER quote_sections_work_guard BEFORE INSERT OR UPDATE OR DELETE ON public.quote_sections
  FOR EACH ROW EXECUTE FUNCTION public.quote_rows_work_guard();

-- 4a. prepare_quote_output (body 20261110100000 + the marked lines)
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
  v_ready    jsonb;
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
  -- 20261029200000 (Codex release 1, Owner 2026-10-29): a version with a line without a price never goes out - not a first output,
  -- not a re-send / re-share of a version already output (checked BEFORE the alreadyFinalized answer below), not a final file or
  -- print. Nothing is reserved, counted or marked. The rule is the email's (send-quote-email/priceGate.ts): price_missing = true is
  -- missing, an intentional 0 is a price; a document whose items cannot be read is refused too (fail closed).
  v_ready := public.quote_document_price_readiness(v_doc);
  IF v_ready ->> 'state' IS DISTINCT FROM 'ready' THEN
    RETURN jsonb_build_object('ok', false, 'code', coalesce(v_ready ->> 'state', 'price_state_unverified'),
                              'missingCount', coalesce((v_ready ->> 'missing')::integer, 0));
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
    -- 20261110100000 (Owner 2026-11-09): copying the link of a SIGNED quote gives its existing customer link - the latest version
    -- already output to this customer; the link then shows the document frozen at the signature. Nothing is reserved or counted.
    IF p_channel = 'public_share' AND coalesce(v_q.signature, '') <> '' THEN
      SELECT * INTO v_final FROM public.quote_issue_ledger l
       WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id AND l.customer_binding = v_binding
       ORDER BY l.created_at DESC, l.id DESC LIMIT 1;
      IF FOUND THEN
        RETURN public.quote_output_final_response(v_final) || jsonb_build_object('alreadyFinalized', true);
      END IF;
    END IF;
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
                 -- 20261111100000 (Owner 2026-11-11, finding 7): once the free quotes or days are over, a draft counted at its save does not go
                 -- out either (only versions already output stay re-sendable)
                 OR (public.free10_output_covered_by_save(p_user_id, p_quote_id, v_binding) AND NOT public.free10_work_ended(p_user_id));
  -- 20261021200000: a paid account in limited mode outputs no new version (already-output versions answered above stay available).
  -- The closed contract's code; the reason tells which end it was.
  IF public.paid_account_limited(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'free_issue_limit_reached', 'reason', 'subscription_limited');
  END IF;
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

-- 4b. output_notice (body 20261110100000 + the marked lines)
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
                        AND l.content_digest = public.quote_output_digest(public.quote_output_deal_document(p_user_id, p_quote_id)))
            -- 20261110100000: a SIGNED quote already output to this customer is never counted again (its copy gives the existing link)
            OR EXISTS (SELECT 1 FROM public.quote_issue_ledger l, public.quotes q
                        WHERE q.id = p_quote_id AND q.user_id = p_user_id AND coalesce(q.signature, '') <> ''
                          AND l.user_id = p_user_id AND l.quote_id = p_quote_id
                          AND l.customer_binding = coalesce(q.client_id::text, 'none'));
  v_reserved := public.quote_output_live_reservations(p_user_id, NULL);
  v_unl := public.quote_output_unlimited(p_user_id, v_ent.account_mode);
  -- a pre-activation Sent quote (no output of this authority yet) never counts
  v_legacy := EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = p_user_id AND lower(coalesce(q.status, '')) = 'sent')
              AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id);
  -- 20261021100000: the first output of a (quote, customer) already counted at its save never counts again
  v_covered := EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = p_user_id
                         AND public.free10_output_covered_by_save(p_user_id, q.id, coalesce(q.client_id::text, 'none')))
               -- 20261111100000 (finding 7): after the end a counted draft is not covered any more
               AND NOT public.free10_work_ended(p_user_id);
  RETURN jsonb_build_object(
    'ok', true,
    'contentDigest', public.quote_output_digest(public.quote_output_deal_document(p_user_id, p_quote_id)),
    'alreadyFinalized', v_final,
    'wouldConsume', v_ent.account_mode = 'free_10' AND NOT v_unl AND NOT v_legacy AND NOT v_final AND NOT v_covered,
    'unlimited', v_unl,
    -- 20261111100000 (finding 42): after the end (10 used OR the 7 days over) nothing is left
    'remaining', CASE WHEN v_ent.account_mode = 'free_10' AND NOT v_unl
                      THEN CASE WHEN public.free10_work_ended(p_user_id) THEN 0
                                ELSE greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0) END END,
    'accountMode', v_ent.account_mode,
    'freeEndsAt', public.free10_ends_at_text(p_user_id),
    'periodEnded', public.free10_period_ended(p_user_id));
END
$function$;
REVOKE ALL ON FUNCTION public.output_notice(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.output_notice(uuid, uuid) TO service_role;

-- 5. finding 18: one owner email per signed quote (written only by the quote-signed-notice Edge Function with the service role)
CREATE TABLE IF NOT EXISTS public.quote_signed_owner_notices (
  quote_id   uuid        PRIMARY KEY REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL,
  signed_at  timestamptz NOT NULL,
  sent       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_signed_owner_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_signed_owner_notices FROM PUBLIC, anon, authenticated;
-- 2026-10-30 rule: a new table gets no automatic API grant - the service role is granted explicitly
GRANT SELECT, INSERT, UPDATE ON public.quote_signed_owner_notices TO service_role;
