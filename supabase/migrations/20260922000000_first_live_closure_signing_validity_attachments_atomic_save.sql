-- ============================================================================================================================
-- TEKANGO First-LIVE combined closure (2026-09-22) - PREPARED, NOT APPLIED to TEST or Production.
-- Applying this file to any shared environment requires a separate explicit Owner authorization. It is proven only in the
-- disposable database harness (scripts/db-test). Forward-safe (OD-5): no destructive change to existing data; every object is
-- created/replaced idempotently; the only rollback lever needed in an incident is operational (see ROLLBACK at the end).
--
--   A. Quote acceptance expiry (OD-1)        public.quote_acceptance_expired(valid_until, country, now)
--   B. Issuer-tenant rule (OD-9)             public.is_issuer_tenant_member(quote_owner)
--   C. public_approve_quote                  issuer-tenant members cannot sign; other-tenant/anonymous customers can; expired
--                                            quotes cannot be approved; historical dates are never changed.
--   D. Private attachment storage (OD-2)     quote-files bucket private; owner-only read/delete; public viewers get short-lived
--                                            signed URLs minted server-side per authorized quote (get-public-quote).
--   E. Storage GC queue                      removed/cascaded attachment rows enqueue their object path AFTER the row is gone;
--                                            objects are deleted only from the queue (never before authoritative state).
--   F. Atomic quote save                     public.save_quote_atomic: client + quote header (incl. project_name / attn_*) +
--                                            structure (save_quote_structured) + attachment metadata + removals in ONE
--                                            transaction; client-generated quote id => idempotent retry.
-- ============================================================================================================================

-- Columns the atomic save writes (already added by 20260828000000 / 20260917000002; repeated defensively, no-ops when present)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS project_name text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS attn_name text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS attn_role text;

-- ---------------------------------------------------------------------------------------------------------------------------
-- A. Acceptance expiry. A quote is acceptable THROUGH the end of its valid_until calendar day:
--    Local (Israel) businesses: the day ends in Asia/Jerusalem. International: "Anywhere on Earth" (UTC-12), so no customer
--    loses the last day because of their own time zone. NULL valid_until = no expiry. Deterministic (no session TimeZone).
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quote_acceptance_expired(p_valid_until date, p_country text, p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT p_valid_until IS NOT NULL
     AND p_valid_until < (p_now AT TIME ZONE CASE WHEN p_country IN ('Local', 'LCL') THEN 'Asia/Jerusalem' ELSE 'Etc/GMT+12' END)::date
$$;
COMMENT ON FUNCTION public.quote_acceptance_expired(date, text, timestamptz) IS
  'OD-1: true when a quote can no longer be accepted - valid through the END of valid_until (Local: Asia/Jerusalem; International: Anywhere-on-Earth UTC-12). NULL = no expiry. Mirrored exactly by src/utils/quoteValidity.js.';
GRANT EXECUTE ON FUNCTION public.quote_acceptance_expired(date, text, timestamptz) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- B. Issuer-tenant membership. The current data model has ONE member per tenant: the business account that owns the quote
--    (quotes.user_id; business_settings is one row per user; there is no team/membership table). This function is the single
--    extension point: when multi-member tenants exist, it (and only it) changes.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_issuer_tenant_member(p_quote_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND p_quote_owner IS NOT NULL AND auth.uid() = p_quote_owner
$$;
COMMENT ON FUNCTION public.is_issuer_tenant_member(uuid) IS
  'OD-9: true when the caller belongs to the tenant that issued the quote (today: is the owning business account). Members of the issuer tenant cannot sign; TEKANGO users of OTHER tenants may sign as customers.';
GRANT EXECUTE ON FUNCTION public.is_issuer_tenant_member(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- C. Public approval (supersedes 20260831000000 broad rule and 20260909000000 owner-only rule; keeps every signature check)
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_approve_quote(p_quote_id uuid, p_signature_data_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
   WHERE q.id = p_quote_id;

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
     AND LOWER(COALESCE(status, '')) IN ('draft', 'sent')
     AND (signature IS NULL OR signature = '');
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved' USING ERRCODE = '42501';
  END IF;
END;
$function$;
COMMENT ON FUNCTION public.public_approve_quote(uuid, text) IS
  '2026-09-22 (OD-9 + OD-1): issuer-tenant members cannot sign; anonymous customers and TEKANGO users of other tenants can; an expired quote (quote_acceptance_expired) cannot be approved. Signature format/size checks unchanged. Supersedes 20260831000000 (broad any-business-account block) and 20260909000000 (owner-only, no expiry).';
REVOKE ALL ON FUNCTION public.public_approve_quote(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_approve_quote(uuid, text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.public_approve_quote(uuid, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------
-- D. Private attachment storage (OD-2). Existing object paths are unchanged; previously stored public URLs simply stop working
--    (the app never relies on them any more - it mints short-lived signed URLs from storage_path).
-- ---------------------------------------------------------------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'quote-files';

DROP POLICY IF EXISTS "Public Access to Quote Files" ON storage.objects;

DROP POLICY IF EXISTS "Owners read own quote files" ON storage.objects;
CREATE POLICY "Owners read own quote files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'quote-files' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "Owners delete own quote files" ON storage.objects;
CREATE POLICY "Owners delete own quote files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'quote-files' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- ---------------------------------------------------------------------------------------------------------------------------
-- E. Storage GC queue: an attachment object may be deleted only after its metadata row is gone (committed).
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_storage_gc (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  bucket_id text NOT NULL DEFAULT 'quote-files',
  storage_path text NOT NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, storage_path)
);
COMMENT ON TABLE public.quote_storage_gc IS
  'Objects whose quote_attachments row has been deleted (removed attachment, deleted quote cascade). The owner''s app deletes the object from storage and then its queue row. An object is never deleted while a row still references it.';
ALTER TABLE public.quote_storage_gc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read own storage gc" ON public.quote_storage_gc;
CREATE POLICY "Owners read own storage gc" ON public.quote_storage_gc FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Owners ack own storage gc" ON public.quote_storage_gc;
CREATE POLICY "Owners ack own storage gc" ON public.quote_storage_gc FOR DELETE TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.quote_storage_gc FROM anon;
GRANT SELECT, DELETE ON public.quote_storage_gc TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_quote_attachment_gc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
BEGIN
  IF OLD.storage_path IS NULL OR OLD.storage_path = '' THEN
    RETURN OLD;
  END IF;
  -- the first path segment is the uploader (enforced by the storage INSERT policy)
  BEGIN
    v_owner := split_part(OLD.storage_path, '/', 1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN OLD;
  END;
  -- still referenced by another row (never expected; defensive) => do not queue
  IF EXISTS (SELECT 1 FROM public.quote_attachments WHERE storage_path = OLD.storage_path AND id <> OLD.id) THEN
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner) THEN
    INSERT INTO public.quote_storage_gc (user_id, storage_path) VALUES (v_owner, OLD.storage_path)
    ON CONFLICT (bucket_id, storage_path) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$function$;
DROP TRIGGER IF EXISTS enqueue_quote_attachment_gc ON public.quote_attachments;
CREATE TRIGGER enqueue_quote_attachment_gc
  AFTER DELETE ON public.quote_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_quote_attachment_gc();

-- ---------------------------------------------------------------------------------------------------------------------------
-- F. Atomic quote save. SECURITY INVOKER: every statement runs under the caller's RLS. One implicit transaction: any failure
--    rolls back the client write, the quote header, the structure and the attachment metadata together.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_quote_atomic_version()
RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;
COMMENT ON FUNCTION public.save_quote_atomic_version() IS 'Capability probe: the app uses save_quote_atomic only when this exists.';
REVOKE ALL ON FUNCTION public.save_quote_atomic_version() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_quote_atomic_version() FROM anon;
GRANT EXECUTE ON FUNCTION public.save_quote_atomic_version() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_quote_atomic(
  p_quote_id uuid,
  p_is_new boolean,
  p_client jsonb,
  p_quote jsonb,
  p_financial jsonb,
  p_sections jsonb,
  p_items jsonb,
  p_removed_section_ids uuid[],
  p_removed_item_ids uuid[],
  p_description_updates jsonb,
  p_new_attachments jsonb,
  p_removed_attachment_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_client_id uuid;
  v_existing_owner uuid;
  v_quote_number integer;
  v_matched integer;
  v_upd jsonb;
  v_att jsonb;
  v_path text;
  v_removed_paths text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'Missing quote id' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_existing_owner FROM public.quotes WHERE id = p_quote_id;

  -- Idempotent replay: a retry of a NEW-quote save whose first attempt already committed returns the committed quote
  -- unchanged (no duplicate client, no second quote). The caller removes any objects it uploaded for the retry that the
  -- committed quote does not reference.
  IF p_is_new AND v_existing_owner IS NOT NULL THEN
    IF v_existing_owner IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Not permitted' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'idempotent_replay', true, 'quote_id', p_quote_id,
      'client_id', (SELECT client_id FROM public.quotes WHERE id = p_quote_id),
      'quote_number', (SELECT quote_number FROM public.quotes WHERE id = p_quote_id),
      'attachment_paths', COALESCE((SELECT jsonb_agg(storage_path) FROM public.quote_attachments WHERE quote_id = p_quote_id), '[]'::jsonb),
      'removed_storage_paths', '[]'::jsonb);
  END IF;
  IF NOT p_is_new THEN
    IF v_existing_owner IS NULL THEN
      RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing_owner IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Not permitted' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 1. client (matched existing client is updated; otherwise a new client is created - disclosed in the UI before save)
  IF NULLIF(p_client->>'id', '') IS NOT NULL THEN
    UPDATE public.clients SET
      company_name = p_client->>'company_name',
      email = COALESCE(p_client->>'email', ''),
      phone = p_client->>'phone',
      client_type = p_client->>'client_type',
      tax_id = p_client->>'tax_id',
      address = p_client->>'address',
      notes = p_client->>'notes'
    WHERE id = (p_client->>'id')::uuid AND user_id = v_uid
    RETURNING id INTO v_client_id;
    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'Client not found' USING ERRCODE = 'P0002';
    END IF;
  ELSE
    INSERT INTO public.clients (company_name, email, phone, client_type, tax_id, address, notes, user_id)
    VALUES (p_client->>'company_name', COALESCE(p_client->>'email', ''), p_client->>'phone', p_client->>'client_type',
            p_client->>'tax_id', p_client->>'address', p_client->>'notes', v_uid)
    RETURNING id INTO v_client_id;
  END IF;

  -- 2. quote header
  IF p_is_new THEN
    v_quote_number := public.allocate_quote_number(v_uid);
    BEGIN
    INSERT INTO public.quotes (
      id, user_id, client_id, quote_number, status, valid_until, terms, warranty, notes, subject, quote_subject,
      attn_name, attn_role, project_name, currency, client_type, subtotal, tax_rate, total, discount
    ) VALUES (
      p_quote_id, v_uid, v_client_id, v_quote_number, COALESCE(NULLIF(p_quote->>'status', ''), 'draft'),
      NULLIF(p_quote->>'valid_until', '')::date, p_quote->>'terms', p_quote->>'warranty', p_quote->>'notes',
      COALESCE(p_quote->>'subject', ''), COALESCE(p_quote->>'quote_subject', ''),
      NULLIF(p_quote->>'attn_name', ''), NULLIF(p_quote->>'attn_role', ''), NULLIF(btrim(p_quote->>'project_name'), ''),
      p_quote->>'currency', p_quote->>'client_type', NULLIF(p_quote->>'subtotal', '')::numeric,
      NULLIF(p_quote->>'tax_rate', '')::numeric, NULLIF(p_quote->>'total', '')::numeric, NULLIF(p_quote->>'discount', '')::numeric
    );
    EXCEPTION WHEN unique_violation THEN
      -- the id belongs to a quote this caller cannot see (another tenant): refuse without revealing it
      RAISE EXCEPTION 'Not permitted' USING ERRCODE = '42501';
    END;
  ELSE
    UPDATE public.quotes SET
      client_id = v_client_id,
      status = COALESCE(NULLIF(p_quote->>'status', ''), status),
      valid_until = NULLIF(p_quote->>'valid_until', '')::date,
      terms = p_quote->>'terms',
      warranty = p_quote->>'warranty',
      notes = p_quote->>'notes',
      subject = COALESCE(p_quote->>'subject', ''),
      quote_subject = COALESCE(p_quote->>'quote_subject', ''),
      attn_name = NULLIF(p_quote->>'attn_name', ''),
      attn_role = NULLIF(p_quote->>'attn_role', ''),
      project_name = NULLIF(btrim(p_quote->>'project_name'), '')
    WHERE id = p_quote_id AND user_id = v_uid;
    GET DIAGNOSTICS v_matched = ROW_COUNT;
    IF v_matched = 0 THEN
      RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- 3. description-only item edits (non-financial, non-structural)
  FOR v_upd IN SELECT * FROM jsonb_array_elements(COALESCE(p_description_updates, '[]'::jsonb))
  LOOP
    UPDATE public.quote_items SET description = v_upd->>'description'
     WHERE id = (v_upd->>'id')::uuid AND quote_id = p_quote_id;
    GET DIAGNOSTICS v_matched = ROW_COUNT;
    IF v_matched = 0 THEN
      RAISE EXCEPTION 'Item % not found for this quote', v_upd->>'id' USING ERRCODE = 'P0002';
    END IF;
  END LOOP;

  -- 4. structure (the proven save_quote_structured body, same transaction)
  PERFORM public.save_quote_structured(p_quote_id, p_financial, p_sections, p_items, p_removed_section_ids, p_removed_item_ids);

  -- 5. removed attachments (rows deleted here; their objects are queued by the AFTER DELETE trigger, deleted after commit)
  IF p_removed_attachment_ids IS NOT NULL AND array_length(p_removed_attachment_ids, 1) > 0 THEN
    SELECT array_agg(storage_path) INTO v_removed_paths
      FROM public.quote_attachments WHERE id = ANY(p_removed_attachment_ids) AND quote_id = p_quote_id;
    DELETE FROM public.quote_attachments WHERE id = ANY(p_removed_attachment_ids) AND quote_id = p_quote_id;
    GET DIAGNOSTICS v_matched = ROW_COUNT;
    IF v_matched <> array_length(p_removed_attachment_ids, 1) THEN
      RAISE EXCEPTION 'One or more removed attachments do not exist for this quote' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- 6. new attachment metadata (objects were uploaded before this call; the path must be the caller's own folder + this quote)
  FOR v_att IN SELECT * FROM jsonb_array_elements(COALESCE(p_new_attachments, '[]'::jsonb))
  LOOP
    v_path := v_att->>'storage_path';
    IF v_path IS NULL OR v_path !~ ('^' || v_uid::text || '/' || p_quote_id::text || '_[0-9]+(_[0-9]+)?\.[A-Za-z0-9]{1,10}$') THEN
      RAISE EXCEPTION 'Invalid attachment path' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.quote_attachments (quote_id, file_name, file_url, file_size, storage_path)
    VALUES (p_quote_id, v_att->>'file_name', v_path, COALESCE((v_att->>'file_size')::bigint, 0), v_path);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent_replay', false, 'quote_id', p_quote_id, 'client_id', v_client_id,
    'quote_number', (SELECT quote_number FROM public.quotes WHERE id = p_quote_id),
    'attachment_paths', COALESCE((SELECT jsonb_agg(storage_path) FROM public.quote_attachments WHERE quote_id = p_quote_id), '[]'::jsonb),
    'removed_storage_paths', to_jsonb(COALESCE(v_removed_paths, ARRAY[]::text[])));
END;
$function$;
COMMENT ON FUNCTION public.save_quote_atomic(uuid, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], jsonb, jsonb, uuid[]) IS
  '2026-09-22 atomic quote save: client + quote header (project_name, attn_*) + structure + attachment metadata + removals in one transaction. Client-generated quote id makes a new-quote retry idempotent. Storage objects are uploaded before and garbage-collected after (quote_storage_gc).';
REVOKE ALL ON FUNCTION public.save_quote_atomic(uuid, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], jsonb, jsonb, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_quote_atomic(uuid, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], jsonb, jsonb, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.save_quote_atomic(uuid, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], jsonb, jsonb, uuid[]) FROM service_role;
GRANT EXECUTE ON FUNCTION public.save_quote_atomic(uuid, boolean, jsonb, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], jsonb, jsonb, uuid[]) TO authenticated;

-- ============================================================================================================================
-- ROLLBACK / KILL-SWITCH (OD-5; operational, TEST first, never routine):
--   * Atomic save: DROP FUNCTION public.save_quote_atomic_version();  -- the app falls back to the phased save immediately.
--   * Signing: re-apply 20260909000000 to restore the previous body (drops the expiry check).
--   * Storage: UPDATE storage.buckets SET public = true WHERE id = 'quote-files'; (restores legacy public reads)
--   Tables/columns created here are additive and may stay in place.
-- ============================================================================================================================
