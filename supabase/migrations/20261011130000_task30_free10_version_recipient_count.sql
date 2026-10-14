-- ============================================================================================================================
-- 20261011130000_task30_free10_version_recipient_count.sql  -  Free-10 counted per quote VERSION and CUSTOMER (Task 30)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner decision 2026-10-11 (owner-chat-2026-10-11-task30-free10-version-recipient-count; canonical record
--   docs/subscriptions-complete-end-to-end-2026-10-07/OWNER_DECISION_FREE10_VERSION_RECIPIENT_2026-10-11.md), superseding the
--   "one output per quote identity" rule of OD-01 / OD-02 (the locked file itself is not edited):
--     * the first output of a quote to its customer counts;
--     * a changed customer / recipient name, then output again -> one more counted quote;
--     * changed quote content, then output of the new version -> counts again;
--     * re-sending / re-outputting the SAME version to the SAME customer - on any channel - never counts again;
--     * draft save and preview never count; deleting never returns quota (the ledger is append-only and survives deletion).
--   Version = (customer binding = quotes.client_id, content digest = quote-document/v1 of the deal, which includes the customer
--   block and attn_name / attn_role). Retry / concurrency: one idempotency key per (quote, channel, version), at most ONE live
--   reservation per quote (a racer on the same version gets that attempt, another version gets output_in_progress), and a
--   unique index per version as the backstop. Every new version needs a free slot -> no customer / content change bypasses
--   the limit.
--   Forward-only on top of 20261007150000 / 20261007150700 (their bytes are unchanged); inert while free_issue is 'prepared'
--   (enforcement and billing stay off; no usage row, counter or quota is reset or rewritten). Never applied to TEST /
--   Production by this change. Re-runnable: DROP ... IF EXISTS / CREATE ... IF NOT EXISTS / CREATE OR REPLACE.
--   ROLLBACK (DB owner): re-run the function bodies of 20261007150000 / 20261007150700 and restore the two per-quote unique
--   constraints (only possible while no quote has two output versions).
-- ============================================================================================================================

-- 1. uniqueness moves from (account, quote) to (account, quote, customer, version)
DROP INDEX IF EXISTS public.quote_output_attempts_one_final;
CREATE UNIQUE INDEX IF NOT EXISTS quote_output_attempts_one_final_version
  ON public.quote_output_attempts (user_id, quote_id, customer_binding, content_digest) WHERE state = 'finalized';
ALTER TABLE public.quote_issue_ledger DROP CONSTRAINT IF EXISTS quote_issue_ledger_one_per_quote;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'quote_issue_ledger_one_per_version'
                    AND conrelid = 'public.quote_issue_ledger'::regclass) THEN
    ALTER TABLE public.quote_issue_ledger
      ADD CONSTRAINT quote_issue_ledger_one_per_version UNIQUE (user_id, quote_id, customer_binding, content_digest);
  END IF;
END
$do$;

-- 2. prepare: reservation of a VERSION
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
  IF coalesce(v_q.signature, '') <> '' OR lower(coalesce(v_q.status, '')) NOT IN ('draft', 'sent')
     OR (lower(coalesce(v_q.status, '')) = 'sent' AND NOT v_has_final) THEN
    RETURN jsonb_build_object('ok', false, 'code', CASE WHEN v_has_final THEN 'quote_closed' ELSE 'legacy_issue_policy_pending' END);
  END IF;
  IF v_q.client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'customer_binding_missing');
  END IF;

  -- (6) content version: bound above (v_digest = p_expected_digest)
  -- attachments: no immutable attachment artifact / retention contract exists yet -> fail closed (no promise invented)
  IF (v_doc ->> 'attachmentCount')::bigint > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attachment_snapshot_policy_pending');
  END IF;
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
  IF v_ent.account_mode = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'paid_quote_policy_pending');
  END IF;
  v_reserved := public.quote_output_live_reservations(p_user_id, NULL);
  IF v_ent.free_issues_consumed + v_reserved >= v_ent.free_issue_limit THEN
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

-- 3. finalize: the only commit point, per version
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
     OR (lower(coalesce(v_q.status, '')) = 'sent'
         AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id AND l.quote_id = v_q.id))
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
  IF v_ent.account_mode = 'paid' THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'paid_quote_policy_pending'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'paid_quote_policy_pending');
  END IF;
  v_reserved := public.quote_output_live_reservations(p_user_id, p_attempt_id);
  IF v_ent.free_issues_consumed + v_reserved >= v_ent.free_issue_limit THEN
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
         snapshot_schema_version = p_schema_version, counted_against_free = true
   WHERE attempt_id = p_attempt_id;
  INSERT INTO public.quote_issue_ledger
    (attempt_id, user_id, quote_id, first_output_channel, idempotency_key, counted_against_free, account_mode_at_event,
     customer_binding, content_digest, issuer_digest, presentation_digest, snapshot_path, snapshot_sha256, snapshot_bytes,
     snapshot_schema_version)
  VALUES
    (p_attempt_id, p_user_id, v_q.id, v_a.requested_channel, v_a.idempotency_key, true, v_ent.account_mode,
     v_a.customer_binding, v_a.content_digest, v_a.issuer_digest, v_a.presentation_digest, v_a.snapshot_path, p_sha256,
     p_bytes, p_schema_version)
  RETURNING * INTO v_ledger;
  UPDATE public.account_entitlements
     SET free_issues_consumed = free_issues_consumed + 1, entitlement_version = entitlement_version + 1, updated_at = now()
   WHERE user_id = p_user_id;
  IF v_a.requested_channel = 'send' THEN
    UPDATE public.quotes SET status = 'sent' WHERE id = v_q.id AND user_id = p_user_id AND lower(status) = 'draft';
  END IF;
  RETURN public.quote_output_final_response(v_ledger);
END
$function$;
REVOKE ALL ON FUNCTION public.finalize_quote_output(uuid, uuid, text, text, bigint, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_quote_output(uuid, uuid, text, text, bigint, integer, text) TO service_role;

-- 4. reveal: the latest output version of a quote
CREATE OR REPLACE FUNCTION public.get_output_descriptor(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phase  text;
  v_ledger public.quote_issue_ledger%ROWTYPE;
BEGIN
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'free_issue';
  IF v_phase IS NULL OR v_phase = 'prepared' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_activated');
  END IF;
  -- Task 30: a quote may have several output versions; the channels open the LATEST one
  SELECT * INTO v_ledger FROM public.quote_issue_ledger l WHERE l.quote_id = p_quote_id AND l.event_type = 'first_client_output'
   ORDER BY l.created_at DESC, l.id DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_finalized');
  END IF;
  RETURN public.quote_output_final_response(v_ledger);
END
$function$;
REVOKE ALL ON FUNCTION public.get_output_descriptor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_output_descriptor(uuid) TO service_role;

-- 5. owner balance + notice: per version
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
  IF p_quote_id IS NOT NULL THEN
    -- Task 30: would the CURRENT version (customer + content) count? Not when exactly this version was already output.
    v_would := v_ent.account_mode = 'free_10'
      AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = v_uid
                     AND lower(coalesce(q.status, '')) IN ('draft', 'sent') AND coalesce(q.signature, '') = '')
      AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l, public.quotes q
                       WHERE q.id = p_quote_id AND q.user_id = v_uid AND l.user_id = v_uid AND l.quote_id = p_quote_id
                         AND l.customer_binding = coalesce(q.client_id::text, 'none')
                         AND l.content_digest = public.quote_output_digest(public.quote_output_deal_document(v_uid, p_quote_id)));
  END IF;
  RETURN jsonb_build_object('ok', true, 'phase', v_phase, 'accountMode', v_ent.account_mode,
    'limit', CASE WHEN v_ent.account_mode = 'free_10' THEN v_ent.free_issue_limit END,
    'consumed', v_ent.free_issues_consumed, 'reserved', v_reserved,
    'remaining', CASE WHEN v_ent.account_mode = 'free_10'
                      THEN greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0) END,
    'paidQuotePolicy', CASE WHEN v_ent.account_mode = 'paid' THEN 'pending' END,
    'wouldConsume', v_would);
END
$function$;
REVOKE ALL ON FUNCTION public.get_free_issue_balance(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_free_issue_balance(uuid) TO authenticated;

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
  RETURN jsonb_build_object(
    'ok', true,
    'contentDigest', public.quote_output_digest(public.quote_output_deal_document(p_user_id, p_quote_id)),
    'alreadyFinalized', v_final,
    'wouldConsume', v_ent.account_mode = 'free_10' AND NOT v_final,
    'remaining', CASE WHEN v_ent.account_mode = 'free_10'
                      THEN greatest(v_ent.free_issue_limit - v_ent.free_issues_consumed - v_reserved, 0) END,
    'accountMode', v_ent.account_mode);
END
$function$;
REVOKE ALL ON FUNCTION public.output_notice(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.output_notice(uuid, uuid) TO service_role;

-- 6. quotes direct-write closure: the customer of an output quote may change (new counted version); the owner never
CREATE OR REPLACE FUNCTION public.enforce_output_authority_on_quotes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_has_final boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.quote_id = NEW.id) THEN
      RAISE EXCEPTION 'output_authority: this quote identity was already output; re-creating it is refused (use a new quote)'
        USING ERRCODE = '42501';
    END IF;
    IF lower(coalesce(NEW.status, '')) <> 'draft' OR coalesce(NEW.signature, '') <> '' THEN
      RAISE EXCEPTION 'output_authority: a quote can only leave Draft through finalize_quote_output' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  v_has_final := EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.quote_id = OLD.id);
  -- Task 30: changing the CUSTOMER of an output quote is allowed - its next output is a new counted version; the OWNER never changes
  IF v_has_final AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'output_authority: owner change on an output quote is refused' USING ERRCODE = '42501';
  END IF;
  IF NOT v_has_final AND lower(coalesce(OLD.status, '')) = 'draft' AND coalesce(OLD.signature, '') = ''
     AND (lower(coalesce(NEW.status, '')) <> 'draft' OR coalesce(NEW.signature, '') <> '') THEN
    RAISE EXCEPTION 'output_authority: a quote can only leave Draft through finalize_quote_output' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.enforce_output_authority_on_quotes() FROM PUBLIC, anon, authenticated, service_role;
