-- tekango-migration-contract: mode=transaction replay=required
-- 20261110100000 - copying the link of a signed quote gives its existing customer link (Owner 2026-11-09).
-- Owner typed (console 2026-11-09 night): "מאשר משימת לילה 1-5: תיקון ההעתקה בהצעה חתומה עד שער עובר, ..."; before it: "צריך לתת
-- אפשרות העתקה, מה השאלה?".
--
-- A quote that was edited after its link went out and was then signed (A100736) has a current version that was never output. "Copy"
-- asked the server for that version, the quote is signed, so prepare_quote_output answered quote_closed and nothing was copied.
-- The comment at that answer already said the issued version stays re-sendable; this migration makes that true for the copy channel:
--   1. prepare_quote_output (body 20261029200000 + the marked lines): channel public_share on a SIGNED quote returns the final result of
--      the latest version already output to the same customer (alreadyFinalized). subscription-authority then mints a link to it, and
--      get-public-quote serves the document frozen at the signature (public_capability_live, 20261108400000). Nothing is reserved,
--      counted or marked. Every other channel (send, final PDF, final print) and every unsigned closed state keep quote_closed.
--   2. output_notice (body 20261021100000 + the marked lines): the same signed quote answers alreadyFinalized and never wouldConsume,
--      so the owner is never told that a copy uses one of the 10 free quotes.
-- No client file and no Edge Function change. Rollback = re-run the two bodies of 20261029200000 / 20261021100000.

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
                 OR public.free10_output_covered_by_save(p_user_id, p_quote_id, v_binding);
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
