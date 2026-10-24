-- ============================================================================================================================
-- 20261025000000_quote_signer_identity.sql  -  the customer's name (and, for a business customer, company and role) is stored with the
--                                               signature, so every later view of the signed quote says who signed it
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-01, L-09, L-24, L-13: ... שמירת שם החותם (שדה חדש במסד) ..."): the public page asks
--   for the signer's name (required) and, for a business customer, the company and role - until now they were shown only right after
--   signing and never stored. Now:
--   * public.quotes gains signer_name / signer_company / signer_role (plain text, bounded, NULL for every earlier signature);
--   * two NEW functions sign AND store the signer in one transaction - the approval itself is the unchanged
--     quote_public_approve_internal (issuer members refused, expiry, signature format and size, draft/sent only, signed once);
--   * the former public_approve_quote / public_approve_quote_capability stay exactly as they are (a cached older page keeps working).
-- Rollback of THIS file: DROP FUNCTION public.public_approve_quote_signed(uuid, text, text, text, text),
--   public.public_approve_quote_capability_signed(text, text, text, text, text); ALTER TABLE public.quotes DROP COLUMN signer_name,
--   DROP COLUMN signer_company, DROP COLUMN signer_role.
-- ============================================================================================================================

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_name text NULL CHECK (signer_name IS NULL OR char_length(signer_name) BETWEEN 1 AND 120);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_company text NULL CHECK (signer_company IS NULL OR char_length(signer_company) BETWEEN 1 AND 120);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS signer_role text NULL CHECK (signer_role IS NULL OR char_length(signer_role) BETWEEN 1 AND 80);

-- one cleaned value: control characters removed, spaces collapsed, trimmed, cut to the limit; empty = NULL
CREATE OR REPLACE FUNCTION public.quote_signer_text(p_value text, p_max int)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
  SELECT NULLIF(left(btrim(regexp_replace(regexp_replace(COALESCE(p_value, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), p_max), '');
$function$;
REVOKE ALL ON FUNCTION public.quote_signer_text(text, int) FROM PUBLIC, anon, authenticated, service_role;

-- recorded just BEFORE the approval (a signed quote is immutable - guard_quote_immutability) and only while the quote can still be
-- signed (draft / sent, no signature); the caller's transaction rolls it back whenever the approval that follows is refused
CREATE OR REPLACE FUNCTION public.quote_record_signer(p_quote_id uuid, p_signer_name text, p_signer_company text, p_signer_role text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE public.quotes
     SET signer_name = public.quote_signer_text(p_signer_name, 120),
         signer_company = public.quote_signer_text(p_signer_company, 120),
         signer_role = public.quote_signer_text(p_signer_role, 80)
   WHERE id = p_quote_id
     AND LOWER(COALESCE(status, '')) IN ('draft', 'sent')
     AND (signature IS NULL OR signature = '');
END;
$function$;
REVOKE ALL ON FUNCTION public.quote_record_signer(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- by quote id (legacy links) - the same visibility rule as public_approve_quote
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
  IF EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
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

-- by capability token - the same token checks as public_approve_quote_capability
CREATE OR REPLACE FUNCTION public.public_approve_quote_capability_signed(p_token text, p_signature_data_url text, p_signer_name text,
  p_signer_company text DEFAULT NULL, p_signer_role text DEFAULT NULL)
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
  IF public.quote_signer_text(p_signer_name, 120) IS NULL THEN
    RAISE EXCEPTION 'Missing signer name' USING ERRCODE = '22023';
  END IF;
  v_hash := encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex');
  SELECT * INTO v_cap FROM public.quote_public_capabilities c
   WHERE c.token_hash = v_hash AND c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > now())
     AND 'approve' = ANY (c.allowed_ops)
     AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = c.quote_id AND q.user_id = c.user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
  PERFORM public.quote_record_signer(v_cap.quote_id, p_signer_name, p_signer_company, p_signer_role);
  PERFORM public.quote_public_approve_internal(v_cap.quote_id, p_signature_data_url, true);
END;
$function$;
COMMENT ON FUNCTION public.public_approve_quote_capability_signed(text, text, text, text, text) IS
  '2026-10-25 (Owner typed L-24): public_approve_quote_capability + the signer''s name / company / role stored in the same transaction.';
REVOKE ALL ON FUNCTION public.public_approve_quote_capability_signed(text, text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_approve_quote_capability_signed(text, text, text, text, text) TO anon, authenticated;
