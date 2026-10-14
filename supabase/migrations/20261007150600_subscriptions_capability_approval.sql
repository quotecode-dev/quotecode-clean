-- ============================================================================================================================
-- 20261007150600_subscriptions_capability_approval.sql  -  approval / signature by capability token; legacy id path gated
-- tekango-migration-contract: mode=transaction replay=required
--
--   CROSSCUT_CONTRACT.md section 2.3 / 3 (approval and signature use the same issued artifact, OD-02). Never applied to
--   TEST/Production by this change. Inert while subscription_activation free_issue is not 'enforced': the id path of
--   public_approve_quote then behaves exactly as before.
--
--   * public.quote_public_approve_internal(p_quote_id, p_signature_data_url, p_visible): the approval logic of
--     public.public_approve_quote(uuid, text) as last defined in 20260922000000_first_live_closure_signing_validity_attachments_
--     atomic_save.sql (section C), statement for statement, with ONE added parameter: p_visible = false makes the quote lookup
--     and the UPDATE see no row, i.e. the call takes EXACTLY the path of an unknown quote id (same checks, same order, same
--     final error 'Quote not found or cannot be approved' 42501) - no oracle. SECURITY INVOKER, no grants (only the two
--     SECURITY DEFINER entry points below call it, as their owner).
--   * public.public_approve_quote(uuid, text): same signature, same ACL (anon, authenticated; not service_role; not PUBLIC).
--     When free_issue is 'enforced', an id that is not on the cutover allowlist (is_legacy_public_quote) is treated as unknown.
--     Not enforced: unchanged behavior.
--   * public.public_approve_quote_capability(p_token text, p_signature_data_url text): anon + authenticated. Token format
--     ^[A-Za-z0-9_-]{43}$ (32 random bytes, base64url); hash = lowercase hex SHA-256 of the UTF-8 token (pg_catalog.sha256 -
--     byte-identical to encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex'), proven in the DB test; no
--     dependency on the pgcrypto schema). Malformed / unknown / revoked / expired / view-only / owner-mismatch token -> the same
--     error as an unknown quote id, raised before anything else. Otherwise the shared approval runs for the BOUND quote.
--
--   NOTE: 20260929000000 asserts the pre-change definition hash of public_approve_quote (TKA05) in its own transaction. It is a
--   one-time convergence migration whose immediate replay happens before this file; re-running 20260929000000 on a database
--   that already has this file would (correctly) fail closed with TKA05.
--
--   Re-runnable: CREATE OR REPLACE + explicit REVOKE / GRANT.
--   ROLLBACK (DB owner): re-create public_approve_quote verbatim from 20260922000000 section C (its sha256 then equals the
--   20260929000000 constant eab641c5...), then DROP FUNCTION public.public_approve_quote_capability(text, text) and
--   public.quote_public_approve_internal(uuid, text, boolean). No data is changed by this file.
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.quote_public_approve_internal(p_quote_id uuid, p_signature_data_url text, p_visible boolean)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_rows int;
  v_owner uuid;
  v_valid_until date;
  v_country text;
BEGIN
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'Missing quote id' USING ERRCODE = '22023';
  END IF;

  SELECT q.user_id, q.valid_until, b.country
    INTO v_owner, v_valid_until, v_country
    FROM public.quotes q
    LEFT JOIN public.business_settings b ON b.user_id = q.user_id
   WHERE q.id = p_quote_id
     AND p_visible IS TRUE;

  IF public.is_issuer_tenant_member(v_owner) THEN
    RAISE EXCEPTION 'Not permitted: a member of the business that issued this quote cannot approve or sign it on the customer''s behalf'
      USING ERRCODE = '42501';
  END IF;

  IF public.quote_acceptance_expired(v_valid_until, v_country) THEN
    RAISE EXCEPTION 'Quote expired: the validity date has passed, so it can no longer be approved or signed'
      USING ERRCODE = '22023';
  END IF;

  IF p_signature_data_url IS NULL OR length(p_signature_data_url) = 0 THEN
    RAISE EXCEPTION 'Missing signature' USING ERRCODE = '22023';
  END IF;
  IF length(p_signature_data_url) > 500000 THEN
    RAISE EXCEPTION 'Signature payload too large' USING ERRCODE = '22023';
  END IF;
  IF NOT (p_signature_data_url ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$') THEN
    RAISE EXCEPTION 'Invalid signature format' USING ERRCODE = '22023';
  END IF;
  IF (length(p_signature_data_url) - 22) % 4 <> 0 THEN
    RAISE EXCEPTION 'Invalid signature format' USING ERRCODE = '22023';
  END IF;

  UPDATE public.quotes
     SET status = 'approved', signature = p_signature_data_url
   WHERE id = p_quote_id
     AND p_visible IS TRUE
     AND LOWER(COALESCE(status, '')) IN ('draft', 'sent')
     AND (signature IS NULL OR signature = '');
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.quote_public_approve_internal(uuid, text, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.public_approve_quote(p_quote_id uuid, p_signature_data_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_visible boolean := true;
BEGIN
  -- enforced: a quote ID alone opens only the cutover allowlist; any other id takes the unknown-quote path (no oracle)
  IF EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    v_visible := p_quote_id IS NOT NULL AND public.is_legacy_public_quote(p_quote_id);
  END IF;
  PERFORM public.quote_public_approve_internal(p_quote_id, p_signature_data_url, v_visible);
END;
$function$;
COMMENT ON FUNCTION public.public_approve_quote(uuid, text) IS
  '2026-10-07 (subscriptions cross-cutting, 20261007150600): approval logic of 2026-09-22 (OD-9 + OD-1: issuer-tenant members cannot sign; anonymous customers and TEKANGO users of other tenants can; an expired quote cannot be approved; signature format/size checks) moved unchanged into quote_public_approve_internal. While free_issue is enforced only cutover-allowlisted ids (is_legacy_public_quote) are approvable by id; every other id answers exactly like an unknown id. Capability-token approval: public_approve_quote_capability.';
REVOKE ALL ON FUNCTION public.public_approve_quote(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_approve_quote(uuid, text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.public_approve_quote(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_approve_quote_capability(p_token text, p_signature_data_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_hash  text;
  v_cap   public.quote_public_capabilities%ROWTYPE;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  v_hash := encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex');
  SELECT * INTO v_cap FROM public.quote_public_capabilities c
   WHERE c.token_hash = v_hash AND c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > now())
     AND 'approve' = ANY (c.allowed_ops)
     AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = c.quote_id AND q.user_id = c.user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  PERFORM public.quote_public_approve_internal(v_cap.quote_id, p_signature_data_url, true);
END;
$function$;
COMMENT ON FUNCTION public.public_approve_quote_capability(text, text) IS
  '2026-10-07 (subscriptions cross-cutting): approve/sign the quote bound to a public capability token (op approve). Any token failure answers like an unknown quote. Same approval logic as public_approve_quote (quote_public_approve_internal).';
REVOKE ALL ON FUNCTION public.public_approve_quote_capability(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_approve_quote_capability(text, text) TO anon, authenticated;
