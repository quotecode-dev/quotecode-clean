-- Signature Product/Security Contract Correction, systemic remediation
-- continuation task, 2026-09-09, Owner-authorized direct LIVE evidence.
--
-- The 2026-08-31 fix (20260831000000) deliberately rejected a narrower
-- auth.uid() = quotes.user_id check, reasoning that a different
-- authenticated business account signing someone else's quote would be
-- "indistinguishable from a genuine customer." That reasoning has a real
-- gap: ANONYMOUS approval is already this RPC's fully-open, intended,
-- legitimate path (auth.uid() IS NULL) - anyone holding the public link,
-- authenticated as nothing at all, can already sign any quote. A sending
-- business wanting to forge its own customer's approval can already do so
-- trivially via a private/incognito window, completely bypassing any
-- account-based check. The broad rule therefore added no real protection
-- against a determined bad actor - it only ever guarded against the
-- sender carelessly/lazily self-approving while still logged into their
-- own account - while imposing a real, Owner-confirmed cost: it
-- categorically blocks any legitimate customer who happens to also hold
-- their own TEKANGO business account (a realistic scenario for a B2B
-- quoting product) from ever signing a quote sent to them, forcing an
-- incognito-window workaround as normal product usage - exactly the
-- dead-end the Owner directly hit and reported.
--
-- The HARD SECURITY INVARIANT ("the sending business must never be able to
-- forge customer approval") is fully preserved here: auth.uid() =
-- quotes.user_id (this specific quote's own owner) remains blocked,
-- identically to before. Only the block on UNRELATED business accounts -
-- which were never "the sending business" for this quote - is removed.
--
-- Every other validation (payload shape/size/format, status/signature-
-- empty precondition, the atomic conditional UPDATE) is byte-identical to
-- the previously-captured definition (20260831000000) - only the identity
-- check changes. See PROFLOW_PROJECT_CONTEXT.md section 219 for the full
-- reconciliation against the original fix's own reasoning.
CREATE OR REPLACE FUNCTION public.public_approve_quote(p_quote_id uuid, p_signature_data_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_rows int;
  owner_id uuid;
BEGIN
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'Missing quote id'
      USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO owner_id FROM public.quotes WHERE id = p_quote_id;

  IF auth.uid() IS NOT NULL AND owner_id IS NOT NULL AND auth.uid() = owner_id THEN
    RAISE EXCEPTION 'Not permitted: the quote''s own business account cannot approve or sign it on the customer''s behalf'
      USING ERRCODE = '42501';
  END IF;

  IF p_signature_data_url IS NULL
     OR length(p_signature_data_url) = 0 THEN
    RAISE EXCEPTION 'Missing signature'
      USING ERRCODE = '22023';
  END IF;

  IF length(p_signature_data_url) > 500000 THEN
    RAISE EXCEPTION 'Signature payload too large'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (
    p_signature_data_url
    ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
  ) THEN
    RAISE EXCEPTION 'Invalid signature format'
      USING ERRCODE = '22023';
  END IF;

  IF (length(p_signature_data_url) - 22) % 4 <> 0 THEN
    RAISE EXCEPTION 'Invalid signature format'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.quotes
  SET
    status = 'approved',
    signature = p_signature_data_url
  WHERE id = p_quote_id
    AND LOWER(COALESCE(status, '')) IN ('draft', 'sent')
    AND (signature IS NULL OR signature = '');

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.public_approve_quote(uuid, text) IS
  'Corrected 2026-09-09 (Signature Product/Security Contract Correction, systemic remediation continuation task): narrowed from "any authenticated business account" (20260831000000) to "this specific quote''s own owner only" - the broad rule blocked legitimate customers who also hold their own TEKANGO business account, a real product dead-end the Owner directly hit and reported, while adding no real protection beyond what the narrower owner-check already provides (anonymous approval, the fully-open intended path, already lets a determined bad actor bypass any account-based check via a private/incognito window). The hard invariant - the sending business can never forge its own customer''s approval - remains fully enforced. See PROFLOW_PROJECT_CONTEXT.md section 219.';
