-- ============================================================================================================================
-- 20261018100000_free10_activation_rules.sql  -  the Owner's Free-10 activation rules (the counter itself is still switched by the
--                                                DB owner with set_activation_phase; this migration changes no phase)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-18 (task-control activeTask.free10AndPayplus20261018), typed: "כרטיס זכאות: ... - אוטומטי",
--   "חשבונות שכבר קיימים ויש להם הצעות: ... - להתחיל לספור מעכשיו", "כמו שהמלצת" (docs/FREE10_A1_PLAN_2026-10-16.md section 6):
--   1. every NEW account gets its Free-10 entitlement row when its business row is created (A-1; the night-task trigger e4becf74);
--   2. every EXISTING account is mapped once through the Owner cohort batch (apply_provisioning_batch): LIFETIME -> paid / visual,
--      everyone else -> free_10 with history granted (consumed = counted ledger rows = 0) - everyone starts at 0 of 10;
--   3. paid and LIFETIME accounts are unlimited: their outputs are recorded in the ledger and never counted (no limit check);
--   4. a quote already Sent BEFORE activation (no output of this authority) may be output again and never counts;
--   5. attachments are allowed (the guard is removed; the attachment count stays inside the content digest);
--   6. the free period has the whole product: style / media policy v1 = every style + media for free_10 and every paid plan.
--   Logo: an imported (immutable) logo already passes (issuer/v2); the client imports a not-yet-imported logo before the first
--   output (frontend), so the logo guard itself is unchanged.
--   Function bodies are the 20261011130000 bodies with only the marked changes (generated with checked replacements).
--   Re-runnable: CREATE OR REPLACE / DROP TRIGGER IF EXISTS / ON CONFLICT DO NOTHING / the batch runs only for unmapped accounts.
--   ROLLBACK (DB owner): set_activation_phase('free_issue', 'prepared', ...) stops every output path at once; re-run the
--   20261011130000 bodies of prepare / finalize / get_free_issue_balance / output_notice; DROP TRIGGER
--   business_settings_provision_new_account; rollback_provisioning_batch(<batch>, <reason>) while no ledger row exists.
-- ============================================================================================================================

-- 1. unlimited accounts (paid mode or the legacy LIFETIME flag): recorded, never counted
CREATE OR REPLACE FUNCTION public.quote_output_unlimited(p_user_id uuid, p_account_mode text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT p_account_mode = 'paid'
      OR coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false)
$function$;
REVOKE ALL ON FUNCTION public.quote_output_unlimited(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- 2. style / media policy v1: the whole product in the free period and in every paid plan
INSERT INTO public.style_media_capability_policy (policy_version, account_mode, style_plan_id, allowed_styles, media_allowed, approval_ref)
VALUES
  (1, 'free_10', NULL,      ARRAY['classic', 'modern', 'visual'], true, 'owner-console-2026-10-18-free10'),
  (1, 'paid',    'classic', ARRAY['classic', 'modern', 'visual'], true, 'owner-console-2026-10-18-free10'),
  (1, 'paid',    'modern',  ARRAY['classic', 'modern', 'visual'], true, 'owner-console-2026-10-18-free10'),
  (1, 'paid',    'visual',  ARRAY['classic', 'modern', 'visual'], true, 'owner-console-2026-10-18-free10')
ON CONFLICT DO NOTHING;

-- 3. prepare (Owner rules 3, 4, 5)
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
                 OR (lower(coalesce(v_q.status, '')) = 'sent' AND NOT v_has_final);
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

-- 4. finalize (Owner rules 3, 4)
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
                        AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id AND l.quote_id = v_q.id));
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

-- 5. owner balance (unlimited / pre-activation quotes never "would consume")
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
                         AND l.content_digest = public.quote_output_digest(public.quote_output_deal_document(v_uid, p_quote_id)));
  END IF;
  RETURN jsonb_build_object('ok', true, 'phase', v_phase, 'accountMode', v_ent.account_mode,
    'limit', CASE WHEN v_ent.account_mode = 'free_10' AND NOT v_unl THEN v_ent.free_issue_limit END,
    'consumed', v_ent.free_issues_consumed, 'reserved', v_reserved,
    'remaining', CASE WHEN v_ent.account_mode = 'free_10' AND NOT v_unl
                      THEN greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0) END,
    'unlimited', v_unl,
    'paidQuotePolicy', CASE WHEN v_unl THEN 'unlimited' END,
    'wouldConsume', v_would);
END
$function$;
REVOKE ALL ON FUNCTION public.get_free_issue_balance(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_free_issue_balance(uuid) TO authenticated;

-- 6. pre-output notice (same rules)
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
  RETURN jsonb_build_object(
    'ok', true,
    'contentDigest', public.quote_output_digest(public.quote_output_deal_document(p_user_id, p_quote_id)),
    'alreadyFinalized', v_final,
    'wouldConsume', v_ent.account_mode = 'free_10' AND NOT v_unl AND NOT v_legacy AND NOT v_final,
    'unlimited', v_unl,
    'remaining', CASE WHEN v_ent.account_mode = 'free_10' AND NOT v_unl
                      THEN greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0) END,
    'accountMode', v_ent.account_mode);
END
$function$;
REVOKE ALL ON FUNCTION public.output_notice(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.output_notice(uuid, uuid) TO service_role;

-- 6b. new-quote guard (20261011100000): a LIFETIME flag granted after activation (free_10 row) is unlimited too
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
  IF v_ent.free_issues_consumed + public.quote_output_live_reservations(NEW.user_id, NULL) >= v_ent.free_issue_limit THEN
    RAISE EXCEPTION 'free_issue_limit_reached: all % free quotes are used; a new quote needs the subscription', v_ent.free_issue_limit
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.enforce_free10_quote_creation() FROM PUBLIC, anon, authenticated, service_role;

-- 7. every NEW account is provisioned when its business row is created (A-1, night task e4becf74). A provisioning refusal never
--    fails the signup (an account with history stays for the Owner cohort mapping). The session setting
--    tekango.skip_signup_provisioning = 'on' is a DISPOSABLE-DB TEST DEVICE only (the pre-A-1 fixtures of the subscription tests seed
--    entitlements by hand); no API role can set it, and skipping only leaves an account unprovisioned (fail closed).
CREATE OR REPLACE FUNCTION public.business_settings_provision_new_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL AND coalesce(current_setting('tekango.skip_signup_provisioning', true), '') <> 'on' THEN
    BEGIN
      PERFORM public.provision_free_10(NEW.user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'business_settings_provision_new_account: provisioning skipped for %: %', NEW.user_id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.business_settings_provision_new_account() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS business_settings_provision_new_account ON public.business_settings;
CREATE TRIGGER business_settings_provision_new_account
  AFTER INSERT ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.business_settings_provision_new_account();

-- 8. every EXISTING unmapped account, once, through the Owner cohort batch (validation first; any refusal raises and aborts).
--    DB owner only. Called once below; on a replay (or with nothing unmapped) it maps nothing.
CREATE OR REPLACE FUNCTION public.free10_map_existing_accounts(p_attestation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_batch uuid;
  v_res   jsonb;
BEGIN
  IF public.subscription_unmapped_accounts() = 0 THEN
    RETURN jsonb_build_object('ok', true, 'mapped', 0);
  END IF;
  INSERT INTO public.subscription_provisioning_batches (approval_ref)
  VALUES ('owner-console-2026-10-18-free10-existing-accounts') RETURNING batch_id INTO v_batch;
  INSERT INTO public.subscription_provisioning_mappings
    (batch_id, user_id, target_account_mode, target_style_plan_id, grant_free10_with_history, approval_ref, before_hash)
  SELECT v_batch, u.user_id,
         CASE WHEN coalesce(b.is_lifetime, false) THEN 'paid' ELSE 'free_10' END,
         CASE WHEN coalesce(b.is_lifetime, false) THEN 'visual' END,
         NOT coalesce(b.is_lifetime, false),
         'owner-console-2026-10-18-free10-existing-accounts',
         public.subscription_account_state_hash(u.user_id)
    FROM (SELECT b0.user_id FROM public.business_settings b0 WHERE b0.user_id IS NOT NULL
          UNION
          SELECT q.user_id FROM public.quotes q WHERE q.user_id IS NOT NULL) u
    LEFT JOIN public.business_settings b ON b.user_id = u.user_id
   WHERE NOT EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = u.user_id);
  v_res := public.apply_provisioning_batch(v_batch, p_attestation);
  IF coalesce(v_res ->> 'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'free10 existing-account mapping refused: %', v_res;
  END IF;
  RETURN v_res || jsonb_build_object('batchId', v_batch);
END
$function$;
REVOKE ALL ON FUNCTION public.free10_map_existing_accounts(text) FROM PUBLIC, anon, authenticated, service_role;

SELECT public.free10_map_existing_accounts(
  'Owner console 2026-10-18: every existing account starts at 0 of 10; LIFETIME is unlimited (paid / visual)');
