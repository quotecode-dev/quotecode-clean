-- Critical Signature Authorization Fix (Critical Signature Authorization Fix
-- + Mobile Cleanup + Email Column Audit + Lock Final Width task, Owner +
-- ChatGPT authorized, 2026-08-30/31).
--
-- ROOT CAUSE (proven via forensic audit + live TEST reproduction, previous
-- task, see PROFLOW_PROJECT_CONTEXT.md §58): public.public_approve_quote
-- performed zero caller-identity check. The only existing protection
-- (quote.is_owner_viewing, computed client-side by get-public-quote from the
-- caller's own Authorization header) only ever hid the SIGNING UI for the
-- exact quote-owner-in-same-session case - it never gated the RPC itself.
-- A TEST business account was proven able to call this RPC directly
-- (bypassing PublicQuote.jsx entirely) and persist a forged customer
-- approval/signature on its own quote.
--
-- FIX: reject the call whenever the caller is authenticated AND identifiable
-- as ANY ProFlow business account - not merely "equals this quote's own
-- owner". A narrower auth.uid() = quotes.user_id check would still leave the
-- cross-business-account bypass open (a different business user could still
-- sign someone else's quote, indistinguishable from a genuine customer to
-- that narrower check). "ProFlow business account" reuses the exact existing
-- source of truth already used by is_admin()/is_super_admin() for the same
-- purpose (one row in business_settings per business/user) - no new identity
-- table invented for this fix.
--
-- Anonymous customers (auth.uid() IS NULL, the legitimate Public Quote flow)
-- are completely unaffected - the new check short-circuits to false for them
-- and every existing validation/status/immutability behavior below is
-- otherwise byte-identical to the previously-captured definition.

CREATE OR REPLACE FUNCTION public.public_approve_quote(p_quote_id uuid, p_signature_data_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_rows int;
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.business_settings WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not permitted: a ProFlow business account cannot approve or sign a quote on the customer''s behalf'
      USING ERRCODE = '42501';
  END IF;

  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'Missing quote id'
      USING ERRCODE = '22023';
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
  'Fixed 2026-08-31 (Critical Signature Authorization Fix task): now rejects any authenticated ProFlow business account (any row in business_settings matching auth.uid(), not merely this quote''s own owner) before performing any other check. Anonymous/genuine-customer approval is unaffected. See PROFLOW_PROJECT_CONTEXT.md §58/§60 for the full forensic audit and fix rationale.';
