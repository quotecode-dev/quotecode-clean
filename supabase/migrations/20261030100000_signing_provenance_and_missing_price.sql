-- ============================================================================================================================
-- 20261030100000_signing_provenance_and_missing_price.sql  -  Codex release 2b: SEC-DB-04 + decision 3
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-29 (typed: "מאשר שחרור 2ב כמשימת לילה: רק פונקציית החתימה האמיתית כותבת חתימה, וחסימת חתימה על הצעה עם מחיר חסר (החלטה 3), כולל שינוי ב-L-17, L-24" - "להתחיל מייד אחרי שאתה מסיים עם השאר"); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md
--   sections 1 and 2.
--   1. SEC-DB-04: the customer's signature and the signer's identity (signature, signer_name, signer_company, signer_role) are written
--      ONLY by the validated public signing code. A guard trigger refuses any insert / change of those fields made directly by a browser
--      or API role (anon, authenticated, service_role); the four public signing functions are SECURITY DEFINER, so their writes pass.
--      signed_at is already written only by quotes_signed_at_guard. The business's own status labels (Approved / Paid marked by the
--      owner, without a signature) are an existing product feature and stay as they are.
--      Not the spec's dedicated database role: the same guarantee (no direct writer of the signature fields) without moving function
--      ownership or adding a role, which the platform may refuse.
--   2. Decision 3: the shared signing core (quote_public_approve_internal - all four public signing functions converge on it) refuses a
--      quote with a line without a price, with the output gate's one readiness rule.
--   3. The signed legacy-id function gets the same permanent capability rule as the unsigned one (a quote issued through the output
--      authority is signed only through its capability link, in any phase).
-- ============================================================================================================================

-- 1. SEC-DB-04 ------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quotes_signing_provenance_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  -- the caller's own role: a browser / API role writes the signature fields only through a SECURITY DEFINER signing function
  IF current_user NOT IN ('anon', 'authenticated', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF coalesce(NEW.signature, '') <> '' OR NEW.signer_name IS NOT NULL OR NEW.signer_company IS NOT NULL OR NEW.signer_role IS NOT NULL THEN
      RAISE EXCEPTION 'approval_write_forbidden: a signature is written only by the customer''s signing' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.signature IS DISTINCT FROM OLD.signature OR NEW.signer_name IS DISTINCT FROM OLD.signer_name
     OR NEW.signer_company IS DISTINCT FROM OLD.signer_company OR NEW.signer_role IS DISTINCT FROM OLD.signer_role THEN
    RAISE EXCEPTION 'approval_write_forbidden: a signature is written only by the customer''s signing' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quotes_signing_provenance_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quotes_signing_provenance_guard ON public.quotes;
CREATE TRIGGER quotes_signing_provenance_guard  -- after quotes_signed_at_guard by name (same-timing triggers fire by name)
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_signing_provenance_guard();

-- 2. decision 3: the shared signing core (body 20261007150600 + the marked readiness check)
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

  -- 20261030100000 (Codex release 2b, decision 3): a quote with a line without a price is never approved or signed - the one readiness
  -- rule of the output gate (20261029200000) over the canonical document; an unreadable document is refused too (fail closed)
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
END;
$function$;
REVOKE ALL ON FUNCTION public.quote_public_approve_internal(uuid, text, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- 3. the signed legacy-id function (body 20261025000000 + the marked permanent capability rule)
CREATE OR REPLACE FUNCTION public.public_approve_quote_signed(p_quote_id uuid, p_signature_data_url text, p_signer_name text,
  p_signer_company text DEFAULT NULL, p_signer_role text DEFAULT NULL)
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
  -- 20261030100000 (Codex release 2b): the same permanent rule as public_approve_quote (20261007151000) - a quote issued through the
  -- output authority is approved only through its capability, in any phase
  IF p_quote_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.quote_id = p_quote_id) THEN
    v_visible := false;
  ELSIF EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    v_visible := p_quote_id IS NOT NULL AND public.is_legacy_public_quote(p_quote_id);
  END IF;
  IF v_visible THEN PERFORM public.quote_record_signer(p_quote_id, p_signer_name, p_signer_company, p_signer_role); END IF;
  PERFORM public.quote_public_approve_internal(p_quote_id, p_signature_data_url, v_visible);
END;
$function$;
COMMENT ON FUNCTION public.public_approve_quote_signed(uuid, text, text, text, text) IS
  '2026-10-25 (Owner typed L-24): public_approve_quote + the signer''s name / company / role stored in the same transaction.';
REVOKE ALL ON FUNCTION public.public_approve_quote_signed(uuid, text, text, text, text) FROM PUBLIC, service_role;
GRANT EXECUTE ON FUNCTION public.public_approve_quote_signed(uuid, text, text, text, text) TO anon, authenticated;
