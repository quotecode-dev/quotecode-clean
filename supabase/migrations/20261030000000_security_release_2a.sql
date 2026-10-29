-- ============================================================================================================================
-- 20261030000000_security_release_2a.sql  -  Codex release 2a: SEC-DB-05, SEC-DB-02, SEC-AI-01
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-29 (typed: "מאשר שחרור 2א עכשיו: ביטול העברת הבעלות לפי מייל, חסימת לקוח של חשבון אחר, ותקרה של 500 פניות ביום לצ'אט הציבורי (החלטה 4), כולל שינוי ב-L-17"); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 2.
--   1. SEC-DB-05: the Auth trigger on_auth_user_created_migration moved every business row whose editable contact email equals a new or
--      changed Auth email to that Auth user (business settings, services, clients, quotes, expenses). Email equality is not authority:
--      the trigger is dropped and handle_user_migration() becomes inert (kept - its search_path / EXECUTE hardening stays). Ordinary
--      signup by Auth ID (the Dashboard provisioning and the activation provisioner) is untouched; no account is moved by email.
--   2. SEC-DB-02: a quote's client must belong to the quote's owner. Enforced on every new write by a guard trigger (not by a new
--      composite foreign key: a second quotes->clients relationship would make the API's quote->client embedding ambiguous); a quote
--      with a client must have an owner; a client referenced by another owner's quotes cannot change owner. The canonical deal document
--      reads the client only when it is the same tenant. Historical rows are not rewritten.
--   3. SEC-AI-01 (decision 4): ONE public pool of 500 paid provider attempts per UTC day for every caller that is not a verified
--      dashboard user (Hebrew and English together, a fallback attempt included). chat_ai_public_reserve() is atomic and service-only.
-- ============================================================================================================================

-- 1. SEC-DB-05 ------------------------------------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created_migration ON auth.users;
CREATE OR REPLACE FUNCTION public.handle_user_migration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- 20261030000000 (SEC-DB-05): inert. A business is never re-linked to another Auth user because an email matches.
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.handle_user_migration() FROM PUBLIC, anon, authenticated;

-- 2. SEC-DB-02 ------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quotes_client_same_tenant_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'client_tenant_mismatch: a quote with a client needs an owner' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'client_tenant_mismatch: the client does not belong to the quote owner' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.quotes_client_same_tenant_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quotes_tenant_client_guard ON public.quotes;
CREATE TRIGGER quotes_tenant_client_guard  -- named to fire AFTER quotes_output_authority and quotes_signed_at_guard (same-timing triggers fire by name)
  BEFORE INSERT OR UPDATE OF client_id, user_id ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_client_same_tenant_guard();

CREATE OR REPLACE FUNCTION public.clients_owner_change_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.client_id = OLD.id AND q.user_id IS DISTINCT FROM NEW.user_id) THEN
    RAISE EXCEPTION 'client_tenant_mismatch: a client of quotes cannot move to another owner' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.clients_owner_change_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS clients_owner_change ON public.clients;
CREATE TRIGGER clients_owner_change
  BEFORE UPDATE OF user_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_owner_change_guard();

-- the canonical deal document (body 20261012120000 + the marked same-tenant condition)
CREATE OR REPLACE FUNCTION public.quote_output_deal_document(p_user_id uuid, p_quote_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'documentProjection', 'quote-document/v1',
    'quote', jsonb_build_object('id', q.id, 'quote_number', q.quote_number, 'created_at', q.created_at,
      'valid_until', q.valid_until, 'currency', q.currency, 'client_type', q.client_type, 'subject', q.subject,
      'project_name', q.project_name, 'attn_name', q.attn_name, 'attn_role', q.attn_role, 'subtotal', q.subtotal,
      'discount', q.discount, 'tax_rate', q.tax_rate, 'total', q.total, 'terms', q.terms, 'warranty', q.warranty,
      'notes', q.notes),
    'customer', (SELECT jsonb_build_object('company_name', c.company_name, 'email', c.email, 'phone', c.phone,
                                           'address', c.address)
                   FROM public.clients c WHERE c.id = q.client_id AND c.user_id = q.user_id),  -- SEC-DB-02: same tenant only
    'sections', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'sort_order', s.sort_order)
                                           ORDER BY s.sort_order, s.id)
                            FROM public.quote_sections s WHERE s.quote_id = q.id), '[]'::jsonb),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
                          'description', i.description, 'quantity', i.quantity, 'unit_price', i.unit_price,
                          'total_price', i.total_price, 'pricing_unit', i.pricing_unit,
                          'calculated_quantity', i.calculated_quantity, 'quantity_source', i.quantity_source,
                          'specification', i.specification, 'section_id', i.section_id,
                          'calculation_method', i.calculation_method, 'sort_order', i.sort_order,
                          'measurements', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                'width', m.width, 'height', m.height, 'unit', m.unit, 'calculated_area', m.calculated_area,
                                'label', m.label, 'sort_order', m.sort_order, 'is_pricing_driving', m.is_pricing_driving)
                                ORDER BY m.sort_order, m.id)
                              FROM public.quote_item_measurements m WHERE m.quote_item_id = i.id), '[]'::jsonb))
                        -- Task 35: the flag enters ONLY when true, so every existing document / digest is byte-identical
                        || CASE WHEN i.price_missing THEN jsonb_build_object('price_missing', true) ELSE '{}'::jsonb END
                        ORDER BY i.sort_order NULLS LAST, i.id)
                         FROM public.quote_items i WHERE i.quote_id = q.id), '[]'::jsonb),
    'attachmentCount', (SELECT count(*) FROM public.quote_attachments a WHERE a.quote_id = q.id),
    'attachmentManifest', '[]'::jsonb)
    FROM public.quotes q
   WHERE q.id = p_quote_id AND q.user_id = p_user_id
$function$;
REVOKE ALL ON FUNCTION public.quote_output_deal_document(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 3. SEC-AI-01 ------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_ai_public_pool (
  day  date    PRIMARY KEY,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0)
);
ALTER TABLE public.chat_ai_public_pool ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.chat_ai_public_pool FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.chat_ai_public_reserve()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  c_limit constant integer := 500;
  v_day   date := (now() AT TIME ZONE 'UTC')::date;
  v_used  integer;
BEGIN
  INSERT INTO public.chat_ai_public_pool AS p (day, used) VALUES (v_day, 1)
  ON CONFLICT (day) DO UPDATE SET used = p.used + 1 WHERE p.used < c_limit
  RETURNING p.used INTO v_used;
  IF v_used IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'limit', c_limit);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', c_limit);
END
$function$;
REVOKE ALL ON FUNCTION public.chat_ai_public_reserve() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_ai_public_reserve() TO service_role;
