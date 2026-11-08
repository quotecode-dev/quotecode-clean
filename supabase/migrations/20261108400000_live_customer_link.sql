-- ============================================================================================================================
-- 20261108400000_live_customer_link.sql  -  the link the customer already has shows every saved change until the signature, and the
--                                           signature is bound to exactly the version the customer saw
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-08 (typed: "כל עוד הלקוח לא חתם!!! כל שינוי ולא משנה איזה שהמשתמש עשה משתקף אצל הלקוח!!!!! נקודה" and
--   "מאשר להחזיר הכול למה שהיה ואת תיקוני הבהירות של קודקס בתוך המסך הקיים, והקישור ללקוח מתעדכן עד החתימה, כולל שינוי ב-L-02, L-05,
--   L-06, L-09, L-13, L-14, L-15, L-17, L-23, L-24, L-25, L-26, L-27, L-28, שחרור עד הלייב"); spec docs/CODEX_SPEC_QUOTE_BUILDER_COMPLETE_2026-11-08.md B6.
--   1. quote_public_version: one digest of everything the customer page shows (the canonical deal document, the business details, the
--      attached files). A view / a status label never changes it.
--   2. public_quote_live_state / public_capability_live (service_role, used by get-public-quote): the live state of a quote for its
--      public page - owner, signed or not, the current version, and the frozen signed document when there is one. A capability link
--      reaches the quote only while it still belongs to the same owner AND the same customer it was sent to (the customer binding of
--      its issued attempt; a quote sent without a customer keeps its link). Revoked / expired / unknown = not found.
--   3. quote_signed_documents: the exact document, business details and file list at the moment of the signature (one row per quote,
--      written only by the signing functions, never changed).
--   4. Two NEW signing functions for the page (public_sign_quote_version by id, public_sign_quote_capability_version by token): the
--      version the page shows is REQUIRED; the quote is locked and the signature refused with "Quote updated" when anything changed
--      since the page loaded (the page reloads and the customer reviews and signs again). The four existing signing functions keep their
--      names and arguments (a page loaded before this release still signs as before); the two capability ones now also require the
--      same customer. Every signature (any of the six) freezes the signed document (the shared core).
-- Rollback of THIS file: DROP FUNCTION public.public_sign_quote_version(uuid, text, text, text, text, text),
--   public.public_sign_quote_capability_version(text, text, text, text, text, text), public.public_capability_live(text),
--   public.public_quote_live_state(uuid); restore quote_public_approve_internal (20261030100000) and the two capability signing
--   functions (20261025000000, 20261007150600). The table may stay.
-- ============================================================================================================================

-- 3. the frozen signed documents -------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_signed_documents (
  quote_id    uuid        PRIMARY KEY REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL,
  version     text        NOT NULL CHECK (version ~ '^[0-9a-f]{64}$'),
  document    jsonb       NOT NULL,
  business    jsonb       NULL,
  attachments jsonb       NOT NULL DEFAULT '[]'::jsonb,
  signed_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_signed_documents ENABLE ROW LEVEL SECURITY;
-- no browser / API access at all: written by the signing functions, read through public_quote_live_state (both SECURITY DEFINER)
REVOKE ALL ON public.quote_signed_documents FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quote_signed_documents_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- a signed document never changes (the account's own deletion removes it with the quote, ON DELETE CASCADE)
  RAISE EXCEPTION 'quote_signed_documents: a signed document never changes' USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION public.quote_signed_documents_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quote_signed_documents_guard_row ON public.quote_signed_documents;
CREATE TRIGGER quote_signed_documents_guard_row BEFORE UPDATE ON public.quote_signed_documents
  FOR EACH ROW EXECUTE FUNCTION public.quote_signed_documents_guard();

-- 1. the version of what the customer sees ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quote_public_business(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object('business_name', b.business_name, 'logo_url', b.logo_url, 'tax_id', b.tax_id, 'email', b.email,
                            'phone', b.phone, 'address', b.address, 'currency', b.currency, 'country', b.country)
    FROM public.business_settings b WHERE b.user_id = p_user_id
$function$;
REVOKE ALL ON FUNCTION public.quote_public_business(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quote_public_attachments(p_quote_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'file_name', a.file_name, 'storage_path', a.storage_path)
                            ORDER BY a.created_at, a.id), '[]'::jsonb)
    FROM public.quote_attachments a WHERE a.quote_id = p_quote_id
$function$;
REVOKE ALL ON FUNCTION public.quote_public_attachments(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quote_public_version(p_user_id uuid, p_quote_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT public.quote_output_digest(jsonb_build_object(
    'document', public.quote_output_deal_document(p_user_id, p_quote_id),
    'business', public.quote_public_business(p_user_id),
    'attachments', public.quote_public_attachments(p_quote_id)))
$function$;
REVOKE ALL ON FUNCTION public.quote_public_version(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 2. the live state for the public page (service_role) ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_quote_live_state(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_owner  uuid;
  v_signed boolean;
  v_doc    public.quote_signed_documents%ROWTYPE;
BEGIN
  IF p_quote_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  SELECT q.user_id, coalesce(q.signature, '') <> '' INTO v_owner, v_signed FROM public.quotes q WHERE q.id = p_quote_id;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  SELECT * INTO v_doc FROM public.quote_signed_documents d WHERE d.quote_id = p_quote_id AND d.user_id = v_owner;
  RETURN jsonb_build_object('ok', true, 'quoteId', p_quote_id, 'userId', v_owner, 'signed', v_signed,
    'version', CASE WHEN v_doc.quote_id IS NOT NULL THEN v_doc.version ELSE public.quote_public_version(v_owner, p_quote_id) END,
    'signedDocument', CASE WHEN v_doc.quote_id IS NULL THEN NULL
                           ELSE jsonb_build_object('document', v_doc.document, 'business', v_doc.business, 'attachments', v_doc.attachments) END);
END
$function$;
REVOKE ALL ON FUNCTION public.public_quote_live_state(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_quote_live_state(uuid) TO service_role;

-- the capability row of a token, still valid for p_op, still the same owner, still the same customer (a quote sent without a customer
-- keeps its link); NULL otherwise
CREATE OR REPLACE FUNCTION public.quote_capability_for_live(p_token_hash text, p_op text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_quote uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' OR p_op IS NULL OR p_op NOT IN ('view', 'approve') THEN
    RETURN NULL;
  END IF;
  SELECT c.quote_id INTO v_quote
    FROM public.quote_public_capabilities c
    JOIN public.quote_output_attempts a ON a.attempt_id = c.attempt_id AND a.user_id = c.user_id
    JOIN public.quotes q ON q.id = c.quote_id AND q.user_id = c.user_id
   WHERE c.token_hash = p_token_hash AND c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > now())
     AND p_op = ANY (c.allowed_ops)
     AND (a.customer_binding = 'none' OR a.customer_binding = coalesce(q.client_id::text, 'none'));
  RETURN v_quote;
END
$function$;
REVOKE ALL ON FUNCTION public.quote_capability_for_live(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.public_capability_live(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_quote uuid := public.quote_capability_for_live(p_token_hash, 'view');
BEGIN
  IF v_quote IS NULL THEN
    RETURN jsonb_build_object('ok', false);   -- unknown / revoked / expired / another customer now / deleted: one uniform answer
  END IF;
  RETURN public.public_quote_live_state(v_quote);
END
$function$;
REVOKE ALL ON FUNCTION public.public_capability_live(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_capability_live(text) TO service_role;

-- 4. signing -------------------------------------------------------------------------------------------------------------------
-- the shared signing core (body 20261030100000 + the marked lines): the quote row is locked BEFORE the checks (a save waiting on it
-- can no longer slip in between the checks and the signature), and every signature freezes the signed document
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

  -- 20261108400000: lock the quote first
  PERFORM 1 FROM public.quotes q WHERE q.id = p_quote_id AND p_visible IS TRUE FOR UPDATE;

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

  IF p_visible IS TRUE AND v_owner IS NOT NULL
     AND public.quote_document_price_readiness(public.quote_output_deal_document(v_owner, p_quote_id)) ->> 'state' IS DISTINCT FROM 'ready' THEN
    RAISE EXCEPTION 'Missing prices: this quote cannot be approved or signed until every price is set' USING ERRCODE = '22023';
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

  -- 20261108400000: the document exactly as signed (content, business details, files), once per quote
  INSERT INTO public.quote_signed_documents (quote_id, user_id, version, document, business, attachments)
  VALUES (p_quote_id, v_owner, public.quote_public_version(v_owner, p_quote_id), public.quote_output_deal_document(v_owner, p_quote_id),
          public.quote_public_business(v_owner), public.quote_public_attachments(p_quote_id))
  ON CONFLICT (quote_id) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.quote_public_approve_internal(uuid, text, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- the version check of the two new functions: lock, compare, then the unchanged signer record + core
CREATE OR REPLACE FUNCTION public.quote_public_sign_versioned(p_quote_id uuid, p_signature_data_url text, p_signer_name text,
  p_signer_company text, p_signer_role text, p_expected_version text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_owner uuid;
  v_doc   jsonb;
  v_biz   jsonb;
  v_files jsonb;
BEGIN
  SELECT q.user_id INTO v_owner FROM public.quotes q WHERE q.id = p_quote_id FOR UPDATE;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  -- the content is read ONCE: the version compared and the document frozen are exactly the same values
  v_doc := public.quote_output_deal_document(v_owner, p_quote_id);
  v_biz := public.quote_public_business(v_owner);
  v_files := public.quote_public_attachments(p_quote_id);
  IF p_expected_version IS NULL OR p_expected_version !~ '^[0-9a-f]{64}$'
     OR public.quote_output_digest(jsonb_build_object('document', v_doc, 'business', v_biz, 'attachments', v_files)) IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Quote updated: the business saved a change after this page was opened - review the quote and sign again'
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.quote_record_signer(p_quote_id, p_signer_name, p_signer_company, p_signer_role);
  -- the verified document first (the core's own freeze then finds it and keeps it); a refused approval rolls the whole call back
  INSERT INTO public.quote_signed_documents (quote_id, user_id, version, document, business, attachments)
  VALUES (p_quote_id, v_owner, p_expected_version, v_doc, v_biz, v_files)
  ON CONFLICT (quote_id) DO NOTHING;
  PERFORM public.quote_public_approve_internal(p_quote_id, p_signature_data_url, true);
END
$function$;
REVOKE ALL ON FUNCTION public.quote_public_sign_versioned(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- NEW, by quote id (legacy links): the visibility rules of public_approve_quote_signed (20261030100000) + the version
CREATE OR REPLACE FUNCTION public.public_sign_quote_version(p_quote_id uuid, p_signature_data_url text, p_signer_name text,
  p_signer_company text, p_signer_role text, p_expected_version text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_visible boolean := true;
BEGIN
  IF public.quote_signer_text(p_signer_name, 120) IS NULL THEN
    RAISE EXCEPTION 'Missing signer name' USING ERRCODE = '22023';
  END IF;
  IF p_quote_id IS NULL OR EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.quote_id = p_quote_id) THEN
    v_visible := false;
  ELSIF EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    v_visible := public.is_legacy_public_quote(p_quote_id);
  END IF;
  IF NOT v_visible THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  PERFORM public.quote_public_sign_versioned(p_quote_id, p_signature_data_url, p_signer_name, p_signer_company, p_signer_role,
                                             p_expected_version);
END;
$function$;
COMMENT ON FUNCTION public.public_sign_quote_version(uuid, text, text, text, text, text) IS
  '2026-11-08 (Owner): the customer signs exactly the version the page shows; a saved change since then refuses with Quote updated.';
REVOKE ALL ON FUNCTION public.public_sign_quote_version(uuid, text, text, text, text, text) FROM PUBLIC, service_role;
GRANT EXECUTE ON FUNCTION public.public_sign_quote_version(uuid, text, text, text, text, text) TO anon, authenticated;

-- NEW, by capability token: valid token for 'approve', same owner, same customer + the version
CREATE OR REPLACE FUNCTION public.public_sign_quote_capability_version(p_token text, p_signature_data_url text, p_signer_name text,
  p_signer_company text, p_signer_role text, p_expected_version text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_quote uuid;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  IF public.quote_signer_text(p_signer_name, 120) IS NULL THEN
    RAISE EXCEPTION 'Missing signer name' USING ERRCODE = '22023';
  END IF;
  v_quote := public.quote_capability_for_live(encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex'), 'approve');
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  PERFORM public.quote_public_sign_versioned(v_quote, p_signature_data_url, p_signer_name, p_signer_company, p_signer_role,
                                             p_expected_version);
END;
$function$;
COMMENT ON FUNCTION public.public_sign_quote_capability_version(text, text, text, text, text, text) IS
  '2026-11-08 (Owner): signs exactly the version the page shows, only while the link still belongs to the same customer.';
REVOKE ALL ON FUNCTION public.public_sign_quote_capability_version(text, text, text, text, text, text) FROM PUBLIC, service_role;
GRANT EXECUTE ON FUNCTION public.public_sign_quote_capability_version(text, text, text, text, text, text) TO anon, authenticated;

-- the two existing capability signing functions (bodies 20261007150600 / 20261025000000): the same token checks through
-- quote_capability_for_live, which adds "the same customer" (a link of a quote that moved to another customer signs nothing)
CREATE OR REPLACE FUNCTION public.public_approve_quote_capability(p_token text, p_signature_data_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_quote uuid;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  v_quote := public.quote_capability_for_live(encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex'), 'approve');
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  PERFORM public.quote_public_approve_internal(v_quote, p_signature_data_url, true);
END;
$function$;
REVOKE ALL ON FUNCTION public.public_approve_quote_capability(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_approve_quote_capability(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_approve_quote_capability_signed(p_token text, p_signature_data_url text, p_signer_name text,
  p_signer_company text DEFAULT NULL, p_signer_role text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_quote uuid;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  IF public.quote_signer_text(p_signer_name, 120) IS NULL THEN
    RAISE EXCEPTION 'Missing signer name' USING ERRCODE = '22023';
  END IF;
  v_quote := public.quote_capability_for_live(encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex'), 'approve');
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  PERFORM public.quote_record_signer(v_quote, p_signer_name, p_signer_company, p_signer_role);
  PERFORM public.quote_public_approve_internal(v_quote, p_signature_data_url, true);
END;
$function$;
REVOKE ALL ON FUNCTION public.public_approve_quote_capability_signed(text, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_approve_quote_capability_signed(text, text, text, text, text) TO anon, authenticated;