-- ============================================================================================================================
-- 20261007151000_subscriptions_capability_scoped_rollback_safety.sql
-- tekango-migration-contract: mode=transaction replay=required
--
-- Subscriptions cross-cut, continuation (D): rollback safety. A quote that was issued through the output authority (it has a
-- quote_issue_ledger row) is CAPABILITY-SCOPED for good: in EVERY phase - including after the DB owner rolls free_issue back
-- to 'prepared' - its bare quote id neither exposes it (get-public-quote / quote-presentation, decided in the Edge layer via
-- is_capability_scoped_quote) nor approves it (public_approve_quote below). Its capability tokens keep working in every phase.
-- Legacy quotes (never output through the authority) keep the legacy id behavior while not enforced, exactly as before.
-- Nothing is deleted; no consumption is refunded; no event is changed.
-- Rollback of THIS file: CREATE OR REPLACE public.public_approve_quote with the 20261007150600 body; DROP FUNCTION
-- is_capability_scoped_quote. (Doing so re-opens id exposure of authority-issued quotes after a phase rollback.)
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.is_capability_scoped_quote(p_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT p_quote_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.quote_id = p_quote_id)
$function$;
REVOKE ALL ON FUNCTION public.is_capability_scoped_quote(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_capability_scoped_quote(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.public_approve_quote(p_quote_id uuid, p_signature_data_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_visible boolean := true;
BEGIN
  -- a quote issued through the output authority is approved only through its capability (any phase; rollback-safe)
  IF p_quote_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.quote_id = p_quote_id) THEN
    v_visible := false;
  -- enforced: a quote ID alone opens only the cutover allowlist; any other id takes the unknown-quote path (no oracle)
  ELSIF EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' AND a.phase = 'enforced') THEN
    v_visible := p_quote_id IS NOT NULL AND public.is_legacy_public_quote(p_quote_id);
  END IF;
  PERFORM public.quote_public_approve_internal(p_quote_id, p_signature_data_url, v_visible);
END;
$function$;
