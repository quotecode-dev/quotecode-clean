-- ============================================================================================================================
-- PREPARED_20261007000000_free10_issue_ledger.sql  -  prep schema version 3 (2026-10-07, Codex closure round)
-- tekango-migration-contract: mode=transaction replay=required
--
--   v3 (CLAUDE_PREP_CLOSURE_SPEC.md section 1): explicit versioned projections (quote-document/v1, issuer/v1 = the renderer
--   contract of get-public-quote; no "row minus denylist"), the attempt binds document + issuer + presentation digests and
--   the style version, outputs with attachments fail closed (attachment_snapshot_policy_pending - no immutable attachment
--   artifact exists yet), finalize fails closed when Storage size metadata is missing, and the reconciler reads the bound
--   attempt state through get_output_attempt_state.
--   Logo (CODEX_PREP_CLOSURE_REVIEW.md 10.1): an issuer with a non-empty logo_url fails closed with logo_snapshot_policy_pending
--   before any reservation (logo_url is a mutable external URL; no immutable logo artifact exists yet).
--
--   STATUS: PREPARED / NOT APPLIED / NOT ACTIVATED / NOT WIRED.
--   Stored OUTSIDE supabase/migrations on purpose (no `db push` can pick it up). Never applied to TEST or Production. Applying
--   it anywhere shared needs a separate explicit Owner authorization after an independent Codex re-review.
--   Version 2 REPLACES version 1 (authorize_quote_output + two booleans) as the whole prepared contract; version 1 was never
--   applied anywhere, so there is no forward migration between them.
--
-- Authority:
--   docs/subscriptions-prep-2026-10-07/CLAUDE_NEXT_STEP_SPEC.md (Codex, 2026-10-07)  - the saga, failure matrix, activation
--   docs/subscriptions-prep-2026-10-07/CODEX_PREPARATION_REVIEW.md                  - findings this version fixes
--   Owner decisions (2026-10-07): Free-10 total, no expiry, consumed once per quote identity at its FIRST client-facing output
--   (send / public_share / final_pdf / final_print); draft/preview never consume; delete never refunds; existing documents stay
--   accessible after the 10th; duplicate / customer replacement = new quote identity. Paid quote quotas: NOT decided.
--
-- THE SAGA (Storage and SQL are NOT one atomic transaction - nothing here claims they are):
--     prepare_quote_output   (SQL tx)  -> attempt PREPARING (reservation, TTL). No final consumption, no output.
--     orchestrator           (server)  -> writes the immutable full-document snapshot to the private derived path
--                                         (upsert:false), reads it back and computes SHA-256 + size itself.
--     finalize_quote_output  (SQL tx)  -> THE ONLY COMMIT POINT: attempt FINALIZED + append-only ledger row + Free counter +1
--                                         + common output state; status Draft->Sent ONLY for channel 'send'.
--     abort / expiry                    -> PREPARING -> ABORTED / EXPIRED; the orchestrator/reconciler deletes the orphan object.
--   Availability counts FINAL consumptions + LIVE reservations, so two racing requests can never produce an 11th output.
--   After FINALIZED there is no silent refund: a missing/corrupt artifact is an incident (document_unavailable), not a refund.
--
-- TRUST BOUNDARY (Storage verification vs SQL transaction):
--   * prepare / finalize / abort / reconcile / descriptor functions are EXECUTE-able by service_role ONLY. They take the user id
--     as a parameter from the trusted orchestrator, which derives it from the verified JWT. `authenticated` and `anon` cannot
--     call them, so a client cannot forge a "Storage verified" claim or a finalization.
--   * The SHA-256 and the byte size of the snapshot are computed by the orchestrator from the bytes it READ BACK from Storage
--     (never from a client claim). SQL cannot read object bytes; it verifies what it can see in the same transaction: the path
--     equals the path it derived at prepare time, and a storage.objects row exists at that path in the private bucket with the
--     same size (when the platform records it). The hash itself is therefore orchestrator-verified, SQL-recorded.
--   * The derived path 'issued-documents/<user>/<quote>/<attempt>.json' does not start with the owner's uid, so owner-scoped
--     client storage policies (first folder = auth.uid()) never grant read or write on it.
--
-- ACTIVATION: one phase per component in public.subscription_activation ('prepared' -> 'shadow' -> 'enforced'); every RPC,
--   trigger and the orchestrator check it. Seeded 'prepared' = nothing works (not_activated) and nothing is enforced.
--   Phase changes only through set_activation_phase, which no application role may execute (DB owner only) and which refuses
--   'enforced' while any account is unmapped. Catalog enforcement is refused until the catalog-product definition is decided.
--
-- NOT decided / NOT implemented (fail-closed where reachable): paid quote quotas (paid -> paid_quote_policy_pending), the
--   commercial style/media capability matrix (empty policy table -> baseline Classic without media, the current server truth
--   outside TEST), registration prerequisites, legacy issued-quote transition, material revision policy, retention / account
--   deletion, catalog-product counting (archive/variant/import/owner transfer), Free catalog limit.
--
-- Rules kept from the convergence migration 20260930000000: nothing references the enum public.quote_status (TKM08); quotes
-- triggers have no column list / WHEN clause and no view depends on quotes columns (TKM02); every SECURITY DEFINER function pins
-- search_path and revokes EXECUTE from PUBLIC.
-- Lock order in EVERY function below: activation row -> account_entitlements row -> quote row -> attempts / ledger.
-- Re-runnable: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS + CREATE / ON CONFLICT DO NOTHING.
-- ============================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------------
-- 1. Activation phase (one gate per component). Seeded 'prepared'. Read: service_role. Write: DB owner via set_activation_phase.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_activation (
  component      text        PRIMARY KEY CHECK (component IN ('free_issue', 'catalog_capacity')),
  phase          text        NOT NULL DEFAULT 'prepared' CHECK (phase IN ('prepared', 'shadow', 'enforced')),
  schema_version integer     NOT NULL CHECK (schema_version = 3),
  changed_at     timestamptz NOT NULL DEFAULT now(),
  changed_reason text
);
INSERT INTO public.subscription_activation (component, phase, schema_version, changed_reason) VALUES
  ('free_issue', 'prepared', 3, 'seeded by the prepared migration'),
  ('catalog_capacity', 'prepared', 3, 'seeded by the prepared migration')
ON CONFLICT (component) DO NOTHING;
ALTER TABLE public.subscription_activation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_activation FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.subscription_activation TO service_role;
DROP POLICY IF EXISTS subscription_activation_service_read ON public.subscription_activation;
CREATE POLICY subscription_activation_service_read ON public.subscription_activation FOR SELECT TO service_role USING (true);

-- ---------------------------------------------------------------------------------------------------------------------------
-- 2. Server-side account record. No usage_package_id (superseded by the Owner's 100-product blocks). No FK to auth.users
--    (account deletion / retention policy is not decided; an FK would also change admin-delete-user behavior).
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_entitlements (
  user_id                  uuid        PRIMARY KEY,
  account_mode             text        NOT NULL CHECK (account_mode IN ('free_10', 'paid')),
  style_plan_id            text        NULL CHECK (style_plan_id IN ('classic', 'modern', 'visual')),
  subscription_status      text        NOT NULL DEFAULT 'none'
                           CHECK (subscription_status IN ('none', 'pending', 'active', 'past_due', 'failed', 'cancelled')),
  catalog_expansion_blocks integer     NOT NULL DEFAULT 0 CHECK (catalog_expansion_blocks >= 0),
  free_issue_limit         integer     NOT NULL DEFAULT 10 CHECK (free_issue_limit = 10),
  free_issues_consumed     integer     NOT NULL DEFAULT 0,
  entitlement_version      integer     NOT NULL DEFAULT 1 CHECK (entitlement_version >= 1),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_entitlements_consumed_range CHECK (free_issues_consumed BETWEEN 0 AND free_issue_limit),
  CONSTRAINT account_entitlements_mode_shape CHECK (
    (account_mode = 'free_10' AND style_plan_id IS NULL AND catalog_expansion_blocks = 0)
    OR (account_mode = 'paid' AND style_plan_id IS NOT NULL))
);
ALTER TABLE public.account_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_entitlements FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.account_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.account_entitlements TO service_role;
DROP POLICY IF EXISTS account_entitlements_own_read ON public.account_entitlements;
CREATE POLICY account_entitlements_own_read ON public.account_entitlements FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS account_entitlements_service ON public.account_entitlements;
CREATE POLICY account_entitlements_service ON public.account_entitlements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------------------------------------------------------
-- 3. Style/media capability policy. EMPTY = no commercial matrix approved. Without a matching approved row every account gets
--    the baseline {classic} without media (the current server truth outside TEST: quote-presentation resolves all to Classic).
--    No application role may write it; a row needs a recorded approval reference.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.style_media_capability_policy (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  policy_version integer     NOT NULL CHECK (policy_version >= 1),
  account_mode   text        NOT NULL CHECK (account_mode IN ('free_10', 'paid')),
  style_plan_id  text        NULL CHECK (style_plan_id IN ('classic', 'modern', 'visual')),
  allowed_styles text[]      NOT NULL CHECK (allowed_styles <@ ARRAY['classic', 'modern', 'visual']::text[] AND cardinality(allowed_styles) >= 1),
  media_allowed  boolean     NOT NULL,
  approval_ref   text        NOT NULL CHECK (length(approval_ref) >= 3),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS style_media_capability_policy_key
  ON public.style_media_capability_policy (policy_version, account_mode, coalesce(style_plan_id, ''));
ALTER TABLE public.style_media_capability_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.style_media_capability_policy FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.style_media_capability_policy TO service_role;
DROP POLICY IF EXISTS style_media_capability_policy_service_read ON public.style_media_capability_policy;
CREATE POLICY style_media_capability_policy_service_read ON public.style_media_capability_policy FOR SELECT TO service_role USING (true);

-- ---------------------------------------------------------------------------------------------------------------------------
-- 4. Output attempts (the saga state). No FK to quotes/users: survives deletion (tombstone). Writes only through the
--    SECURITY DEFINER functions below; the guard trigger allows only PREPARING -> FINALIZED / ABORTED / EXPIRED and forbids
--    DELETE / TRUNCATE for every role (append-only for application roles; a DB owner/superuser can always bypass triggers).
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_output_attempts (
  attempt_id              uuid        PRIMARY KEY,
  user_id                 uuid        NOT NULL,
  quote_id                uuid        NOT NULL,
  customer_binding        text        NOT NULL,
  state                   text        NOT NULL CHECK (state IN ('preparing', 'finalized', 'aborted', 'expired')),
  requested_channel       text        NOT NULL CHECK (requested_channel IN ('send', 'public_share', 'final_pdf', 'final_print')),
  idempotency_key         text        NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  content_digest          text        NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  style_id                text        NOT NULL CHECK (style_id IN ('classic', 'modern', 'visual')),
  media_count             integer     NOT NULL CHECK (media_count >= 0),
  style_version           integer     NOT NULL CHECK (style_version >= 1),
  issuer_digest           text        NOT NULL CHECK (issuer_digest ~ '^[0-9a-f]{64}$'),
  presentation_digest     text        NOT NULL CHECK (presentation_digest ~ '^[0-9a-f]{64}$'),
  snapshot_path           text        NOT NULL,
  snapshot_sha256         text        NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_schema_version integer     NULL CHECK (snapshot_schema_version = 1),
  snapshot_bytes          bigint      NULL CHECK (snapshot_bytes > 0),
  reserved_at             timestamptz NOT NULL DEFAULT now(),
  expires_at              timestamptz NOT NULL,
  finalized_at            timestamptz NULL,
  aborted_at              timestamptz NULL,
  failure_code            text        NULL,
  snapshot_deleted_at     timestamptz NULL,
  counted_against_free    boolean     NULL,
  account_mode_at_event   text        NOT NULL CHECK (account_mode_at_event IN ('free_10', 'paid')),
  entitlement_version     integer     NOT NULL,
  CONSTRAINT quote_output_attempts_key UNIQUE (user_id, idempotency_key),
  CONSTRAINT quote_output_attempts_path CHECK (snapshot_path = format('issued-documents/%s/%s/%s.json', user_id, quote_id, attempt_id)),
  CONSTRAINT quote_output_attempts_state_shape CHECK (
    (state = 'preparing' AND finalized_at IS NULL AND aborted_at IS NULL)
    OR (state = 'finalized' AND finalized_at IS NOT NULL AND aborted_at IS NULL AND snapshot_sha256 IS NOT NULL
        AND snapshot_bytes IS NOT NULL AND snapshot_schema_version IS NOT NULL AND counted_against_free IS NOT NULL
        AND snapshot_deleted_at IS NULL)
    OR (state IN ('aborted', 'expired') AND finalized_at IS NULL AND aborted_at IS NOT NULL AND failure_code IS NOT NULL))
);
-- at most ONE final attempt and at most ONE live reservation per (account, quote)
CREATE UNIQUE INDEX IF NOT EXISTS quote_output_attempts_one_final ON public.quote_output_attempts (user_id, quote_id) WHERE state = 'finalized';
CREATE UNIQUE INDEX IF NOT EXISTS quote_output_attempts_one_live  ON public.quote_output_attempts (user_id, quote_id) WHERE state = 'preparing';
CREATE INDEX IF NOT EXISTS quote_output_attempts_live_by_user ON public.quote_output_attempts (user_id, expires_at) WHERE state = 'preparing';
ALTER TABLE public.quote_output_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_output_attempts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.quote_output_attempts TO authenticated, service_role;
DROP POLICY IF EXISTS quote_output_attempts_own_read ON public.quote_output_attempts;
CREATE POLICY quote_output_attempts_own_read ON public.quote_output_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS quote_output_attempts_service_read ON public.quote_output_attempts;
CREATE POLICY quote_output_attempts_service_read ON public.quote_output_attempts FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.quote_output_attempts_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'quote_output_attempts is append-only (% refused)', TG_OP USING ERRCODE = '42501';
  END IF;
  -- UPDATE: identity / binding / reservation columns never change
  IF (NEW.attempt_id, NEW.user_id, NEW.quote_id, NEW.customer_binding, NEW.requested_channel, NEW.idempotency_key,
      NEW.content_digest, NEW.style_id, NEW.media_count, NEW.style_version, NEW.issuer_digest, NEW.presentation_digest,
      NEW.snapshot_path, NEW.reserved_at, NEW.expires_at,
      NEW.account_mode_at_event, NEW.entitlement_version)
     IS DISTINCT FROM
     (OLD.attempt_id, OLD.user_id, OLD.quote_id, OLD.customer_binding, OLD.requested_channel, OLD.idempotency_key,
      OLD.content_digest, OLD.style_id, OLD.media_count, OLD.style_version, OLD.issuer_digest, OLD.presentation_digest,
      OLD.snapshot_path, OLD.reserved_at, OLD.expires_at,
      OLD.account_mode_at_event, OLD.entitlement_version) THEN
    RAISE EXCEPTION 'quote_output_attempts: identity/binding columns are immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.state = 'preparing' AND NEW.state IN ('preparing', 'finalized', 'aborted', 'expired') THEN
    RETURN NEW;
  END IF;
  -- terminal states: only the orphan-deletion audit stamp of an aborted/expired attempt may be set, once
  IF OLD.state IN ('aborted', 'expired') AND NEW.state = OLD.state AND OLD.snapshot_deleted_at IS NULL
     AND NEW.snapshot_deleted_at IS NOT NULL
     AND (NEW.snapshot_sha256, NEW.snapshot_schema_version, NEW.snapshot_bytes, NEW.finalized_at, NEW.aborted_at,
          NEW.failure_code, NEW.counted_against_free)
         IS NOT DISTINCT FROM
         (OLD.snapshot_sha256, OLD.snapshot_schema_version, OLD.snapshot_bytes, OLD.finalized_at, OLD.aborted_at,
          OLD.failure_code, OLD.counted_against_free) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'quote_output_attempts: transition % -> % refused', OLD.state, NEW.state USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION public.quote_output_attempts_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quote_output_attempts_guard_row ON public.quote_output_attempts;
CREATE TRIGGER quote_output_attempts_guard_row BEFORE UPDATE OR DELETE ON public.quote_output_attempts
  FOR EACH ROW EXECUTE FUNCTION public.quote_output_attempts_guard();
DROP TRIGGER IF EXISTS quote_output_attempts_guard_truncate ON public.quote_output_attempts;
CREATE TRIGGER quote_output_attempts_guard_truncate BEFORE TRUNCATE ON public.quote_output_attempts
  FOR EACH STATEMENT EXECUTE FUNCTION public.quote_output_attempts_guard();

-- ---------------------------------------------------------------------------------------------------------------------------
-- 5. Final-output ledger: exactly one append-only row per FINALIZED attempt (one per account+quote). No FK: survives deletion.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_issue_ledger (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id              uuid        NOT NULL UNIQUE,
  user_id                 uuid        NOT NULL,
  quote_id                uuid        NOT NULL,
  event_type              text        NOT NULL DEFAULT 'first_client_output' CHECK (event_type = 'first_client_output'),
  first_output_channel    text        NOT NULL CHECK (first_output_channel IN ('send', 'public_share', 'final_pdf', 'final_print')),
  idempotency_key         text        NOT NULL,
  counted_against_free    boolean     NOT NULL,
  account_mode_at_event   text        NOT NULL,
  customer_binding        text        NOT NULL,
  content_digest          text        NOT NULL,
  issuer_digest           text        NOT NULL,
  presentation_digest     text        NOT NULL,
  snapshot_path           text        NOT NULL,
  snapshot_sha256         text        NOT NULL,
  snapshot_bytes          bigint      NOT NULL,
  snapshot_schema_version integer     NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_issue_ledger_one_per_quote UNIQUE (user_id, quote_id, event_type),
  CONSTRAINT quote_issue_ledger_key UNIQUE (user_id, idempotency_key)
);
ALTER TABLE public.quote_issue_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_issue_ledger FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.quote_issue_ledger TO authenticated, service_role;
DROP POLICY IF EXISTS quote_issue_ledger_own_read ON public.quote_issue_ledger;
CREATE POLICY quote_issue_ledger_own_read ON public.quote_issue_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS quote_issue_ledger_service_read ON public.quote_issue_ledger;
CREATE POLICY quote_issue_ledger_service_read ON public.quote_issue_ledger FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.quote_issue_ledger_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION 'quote_issue_ledger is append-only (% refused)', TG_OP USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION public.quote_issue_ledger_append_only() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quote_issue_ledger_no_update_delete ON public.quote_issue_ledger;
CREATE TRIGGER quote_issue_ledger_no_update_delete BEFORE UPDATE OR DELETE ON public.quote_issue_ledger
  FOR EACH ROW EXECUTE FUNCTION public.quote_issue_ledger_append_only();
DROP TRIGGER IF EXISTS quote_issue_ledger_no_truncate ON public.quote_issue_ledger;
CREATE TRIGGER quote_issue_ledger_no_truncate BEFORE TRUNCATE ON public.quote_issue_ledger
  FOR EACH STATEMENT EXECUTE FUNCTION public.quote_issue_ledger_append_only();

-- The Free counter is a cache of the ledger, never an independent authority: on every INSERT/UPDATE of an entitlement row the
-- stored free_issues_consumed must equal the number of counted ledger rows of that account (finalize inserts the ledger row
-- before it increments). A direct reset / retro grant by any role (incl. service_role) is refused.
CREATE OR REPLACE FUNCTION public.account_entitlements_counter_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ledger integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'account_entitlements: user_id is immutable' USING ERRCODE = '42501';
  END IF;
  SELECT count(*)::integer INTO v_ledger FROM public.quote_issue_ledger l WHERE l.user_id = NEW.user_id AND l.counted_against_free;
  IF NEW.free_issues_consumed <> v_ledger THEN
    RAISE EXCEPTION 'account_entitlements: free_issues_consumed (%) must equal the counted ledger rows (%)',
      NEW.free_issues_consumed, v_ledger USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.account_entitlements_counter_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS account_entitlements_counter_guard ON public.account_entitlements;
CREATE TRIGGER account_entitlements_counter_guard BEFORE INSERT OR UPDATE ON public.account_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.account_entitlements_counter_guard();

-- Common output state, independent of quotes.status: a quote is output-authorized iff it has a ledger row.
CREATE OR REPLACE VIEW public.quote_output_state WITH (security_invoker = true) AS
  SELECT l.user_id, l.quote_id, l.attempt_id AS finalized_attempt_id, l.created_at AS output_authorized_at,
         l.snapshot_path, l.snapshot_sha256, l.customer_binding
    FROM public.quote_issue_ledger l;
REVOKE ALL ON public.quote_output_state FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.quote_output_state TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 6. Internal helpers (no application-role EXECUTE).
-- ---------------------------------------------------------------------------------------------------------------------------
-- The canonical DEAL document of a quote - projection 'quote-document/v1'. EXPLICIT allowlist = the fields the existing
-- customer document renderer reads (supabase/functions/get-public-quote richSelect: quote header, clients(company_name,
-- email, phone, address), quote_sections(id, name, sort_order), quote_items(...) with quote_item_measurements(...)). No owner,
-- workflow (status/signature), audit or internal column; a column added to these tables later never enters the snapshot.
-- Attachments: no immutable attachment artifact exists yet, so a quote WITH attachments cannot be output
-- (attachment_snapshot_policy_pending); the count is part of the digest so an attachment added after prepare is a change.
-- Its SHA-256 (jsonb text form is canonical) is the content digest bound to the attempt.
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
                   FROM public.clients c WHERE c.id = q.client_id),
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
                        ORDER BY i.sort_order NULLS LAST, i.id)
                         FROM public.quote_items i WHERE i.quote_id = q.id), '[]'::jsonb),
    'attachmentCount', (SELECT count(*) FROM public.quote_attachments a WHERE a.quote_id = q.id),
    'attachmentManifest', '[]'::jsonb)
    FROM public.quotes q
   WHERE q.id = p_quote_id AND q.user_id = p_user_id
$function$;

-- Issuer block - projection 'issuer/v1': EXACTLY the business_settings fields the document renderer reads
-- (get-public-quote: business_name, logo_url, tax_id, email, phone, address, currency, country). Nothing else (no EmailJS
-- keys, sign-in, plan/trial/role, user ids, defaults or future columns).
CREATE OR REPLACE FUNCTION public.quote_output_issuer(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object('issuerProjection', 'issuer/v1', 'business_name', b.business_name, 'logo_url', b.logo_url,
                            'tax_id', b.tax_id, 'email', b.email, 'phone', b.phone, 'address', b.address,
                            'currency', b.currency, 'country', b.country)
    FROM public.business_settings b WHERE b.user_id = p_user_id
$function$;
REVOKE ALL ON FUNCTION public.quote_output_issuer(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.quote_output_deal_document(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.quote_output_digest(p_document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
  SELECT encode(pg_catalog.sha256(convert_to(p_document::text, 'UTF8')), 'hex')
$function$;
REVOKE ALL ON FUNCTION public.quote_output_digest(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Effective style/media entitlement: latest approved policy row for (mode, plan), else the baseline {classic}, no media.
CREATE OR REPLACE FUNCTION public.resolve_style_media_entitlement(p_account_mode text, p_style_plan_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT coalesce(
    (SELECT jsonb_build_object('allowedStyles', to_jsonb(p.allowed_styles), 'mediaAllowed', p.media_allowed,
                               'policyVersion', p.policy_version, 'source', 'approved_policy')
       FROM public.style_media_capability_policy p
      WHERE p.account_mode = p_account_mode AND p.style_plan_id IS NOT DISTINCT FROM p_style_plan_id
      ORDER BY p.policy_version DESC LIMIT 1),
    jsonb_build_object('allowedStyles', jsonb_build_array('classic'), 'mediaAllowed', false, 'policyVersion', NULL,
                       'source', 'baseline_no_commercial_matrix_approved'))
$function$;
REVOKE ALL ON FUNCTION public.resolve_style_media_entitlement(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Live reservations of an account other than p_except_attempt (expired-by-time rows do not count even before they are marked).
CREATE OR REPLACE FUNCTION public.quote_output_live_reservations(p_user_id uuid, p_except_attempt uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT count(*)::integer FROM public.quote_output_attempts a
   WHERE a.user_id = p_user_id AND a.state = 'preparing' AND a.expires_at > now()
     AND a.attempt_id IS DISTINCT FROM p_except_attempt
$function$;
REVOKE ALL ON FUNCTION public.quote_output_live_reservations(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Durable final response, rebuilt from the ledger (identical for the first answer and every retry).
CREATE OR REPLACE FUNCTION public.quote_output_final_response(p_ledger public.quote_issue_ledger)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'ok', true, 'state', 'finalized', 'attemptId', p_ledger.attempt_id, 'quoteId', p_ledger.quote_id,
    'firstChannel', p_ledger.first_output_channel, 'consumed', p_ledger.counted_against_free,
    'accountMode', p_ledger.account_mode_at_event, 'finalizedAt', p_ledger.created_at,
    'descriptor', jsonb_build_object('path', p_ledger.snapshot_path, 'sha256', p_ledger.snapshot_sha256,
                                     'bytes', p_ledger.snapshot_bytes, 'schemaVersion', p_ledger.snapshot_schema_version,
                                     'contentDigest', p_ledger.content_digest, 'issuerDigest', p_ledger.issuer_digest,
                                     'presentationDigest', p_ledger.presentation_digest))
$function$;
REVOKE ALL ON FUNCTION public.quote_output_final_response(public.quote_issue_ledger) FROM PUBLIC, anon, authenticated, service_role;

-- PREPARING response, identical shape for a fresh reservation and every replay. It carries the bound attempt values plus the
-- CURRENT deal document and its digest, so an orchestrator retry can rebuild the byte-identical snapshot (and detect drift:
-- currentDigest <> contentDigest means the reservation can no longer finalize).
CREATE OR REPLACE FUNCTION public.quote_output_preparing_response(p_a public.quote_output_attempts, p_replay boolean,
                                                                  p_extra jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_doc    jsonb := public.quote_output_deal_document(p_a.user_id, p_a.quote_id);
  v_issuer jsonb := public.quote_output_issuer(p_a.user_id);
BEGIN
  RETURN jsonb_build_object(
    'ok', true, 'state', 'preparing', 'replay', p_replay, 'attemptId', p_a.attempt_id, 'ownerId', p_a.user_id,
    'quoteId', p_a.quote_id, 'customerBinding', p_a.customer_binding, 'channel', p_a.requested_channel,
    'style', p_a.style_id, 'styleVersion', p_a.style_version, 'mediaCount', p_a.media_count, 'snapshotPath', p_a.snapshot_path,
    'contentDigest', p_a.content_digest, 'currentDigest', CASE WHEN v_doc IS NULL THEN NULL ELSE public.quote_output_digest(v_doc) END,
    'issuerDigest', p_a.issuer_digest,
    'currentIssuerDigest', CASE WHEN v_issuer IS NULL THEN NULL ELSE public.quote_output_digest(v_issuer) END,
    'presentationDigest', p_a.presentation_digest,
    'reservedAt', p_a.reserved_at, 'expiresAt', p_a.expires_at, 'document', v_doc, 'issuer', v_issuer)
    || coalesce(p_extra, '{}'::jsonb);
END
$function$;
REVOKE ALL ON FUNCTION public.quote_output_preparing_response(public.quote_output_attempts, boolean, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 7. prepare_quote_output: reservation (one SQL transaction). service_role only; p_user_id comes from the orchestrator's
--    verified JWT. p_style / p_media_count are the orchestrator's server-side read of the presentation draft (never the client).
-- ---------------------------------------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.prepare_quote_output(uuid, uuid, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.prepare_quote_output(uuid, uuid, text, text, text, text, integer, integer, text);
-- p_style / p_style_version / p_media_count / p_presentation_digest: the orchestrator's server-side read of the presentation
-- draft and its media objects (verified against the owned Storage objects), never the client. SQL cannot read Storage, so it
-- RECORDS the presentation digest and requires the same digest again at finalize.
CREATE FUNCTION public.prepare_quote_output(p_user_id uuid, p_quote_id uuid, p_channel text, p_idempotency_key text,
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

  SELECT * INTO v_final FROM public.quote_issue_ledger l
   WHERE l.user_id = p_user_id AND l.quote_id = p_quote_id AND l.event_type = 'first_client_output';
  IF FOUND THEN
    IF v_q.id IS NULL THEN
      -- deleted after its final output: metadata only; no new consumption and no regenerated document
      RETURN public.quote_output_final_response(v_final) || jsonb_build_object('ok', false, 'code', 'document_unavailable',
                                                                                'reason', 'quote_deleted');
    END IF;
    IF v_final.customer_binding <> coalesce(v_q.client_id::text, 'none') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'customer_changed_new_quote_required');
    END IF;
    -- reuse of the same quote for the same customer: the durable final result, never a second consumption
    RETURN public.quote_output_final_response(v_final) || jsonb_build_object('alreadyFinalized', true);
  END IF;

  IF v_q.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'quote_not_found');
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
    RETURN public.quote_output_preparing_response(v_live, true, jsonb_build_object('sameQuoteLiveAttempt', true));
  END IF;

  -- (5) quote state: issued/signed without a final output is legacy (transition policy not decided)
  IF lower(coalesce(v_q.status, '')) <> 'draft' OR coalesce(v_q.signature, '') <> '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'legacy_issue_policy_pending');
  END IF;
  IF v_q.client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'customer_binding_missing');
  END IF;
  v_binding := v_q.client_id::text;

  -- (6) content version: the caller must have seen exactly the current deal
  v_doc := public.quote_output_deal_document(p_user_id, p_quote_id);
  v_digest := public.quote_output_digest(v_doc);
  IF v_digest <> p_expected_digest THEN
    RETURN jsonb_build_object('ok', false, 'code', 'quote_changed', 'contentDigest', v_digest);
  END IF;
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

-- ---------------------------------------------------------------------------------------------------------------------------
-- 8. finalize_quote_output: THE ONLY COMMIT POINT (one SQL transaction, same lock order). service_role only.
--    p_sha256 / p_bytes are computed by the orchestrator from the bytes it read back from Storage.
-- ---------------------------------------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.finalize_quote_output(uuid, uuid, text, text, bigint, integer);
DROP FUNCTION IF EXISTS public.finalize_quote_output(uuid, uuid, text, text, bigint, integer, text);
-- p_presentation_digest: recomputed by the orchestrator from the server-side presentation draft + verified media objects at
-- finalize time; it must equal the digest bound at prepare.
CREATE FUNCTION public.finalize_quote_output(p_user_id uuid, p_attempt_id uuid, p_snapshot_path text, p_sha256 text,
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
  IF coalesce(v_q.client_id::text, 'none') <> v_a.customer_binding THEN
    UPDATE public.quote_output_attempts SET state = 'aborted', aborted_at = now(), failure_code = 'customer_changed'
     WHERE attempt_id = p_attempt_id;
    RETURN jsonb_build_object('ok', false, 'code', 'customer_changed_new_quote_required');
  END IF;
  IF lower(coalesce(v_q.status, '')) <> 'draft' OR coalesce(v_q.signature, '') <> ''
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

-- Bound attempt state for the reconciler (service_role, read-only): the same PREPARING response the orchestrator verifies
-- against, so the reconciler uses the FULL verifier (expected bytes) and never a shortened header check.
CREATE OR REPLACE FUNCTION public.get_output_attempt_state(p_user_id uuid, p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_a public.quote_output_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id AND a.user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_not_found');
  END IF;
  IF v_a.state <> 'preparing' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_' || v_a.state, 'failureCode', v_a.failure_code);
  END IF;
  RETURN public.quote_output_preparing_response(v_a, true, NULL);
END
$function$;
REVOKE ALL ON FUNCTION public.get_output_attempt_state(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_output_attempt_state(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 9. abort / reconcile / descriptor / balance
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.abort_quote_output(p_user_id uuid, p_attempt_id uuid, p_failure_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_quote_id uuid;
  v_a        public.quote_output_attempts%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_attempt_id IS NULL OR p_failure_code IS NULL OR p_failure_code !~ '^[a-z_]{3,60}$' THEN
    RAISE EXCEPTION 'abort_quote_output: invalid arguments' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  SELECT a.quote_id INTO v_quote_id FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id AND a.user_id = p_user_id;
  IF v_quote_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_not_found');
  END IF;
  PERFORM 1 FROM public.account_entitlements e WHERE e.user_id = p_user_id FOR UPDATE;
  PERFORM 1 FROM public.quotes q WHERE q.id = v_quote_id FOR UPDATE;
  SELECT * INTO v_a FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id FOR UPDATE;
  IF v_a.state <> 'preparing' THEN
    RETURN jsonb_build_object('ok', true, 'state', v_a.state, 'changed', false);  -- idempotent; a final is never aborted
  END IF;
  -- a reservation past its TTL becomes EXPIRED (the reconciler path), otherwise ABORTED
  UPDATE public.quote_output_attempts
     SET state = CASE WHEN v_a.expires_at <= now() THEN 'expired' ELSE 'aborted' END, aborted_at = now(),
         failure_code = CASE WHEN v_a.expires_at <= now() THEN 'reservation_ttl' ELSE p_failure_code END
   WHERE attempt_id = p_attempt_id;
  RETURN jsonb_build_object('ok', true, 'state', CASE WHEN v_a.expires_at <= now() THEN 'expired' ELSE 'aborted' END,
                            'changed', true, 'snapshotPath', v_a.snapshot_path);
END
$function$;
REVOKE ALL ON FUNCTION public.abort_quote_output(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abort_quote_output(uuid, uuid, text) TO service_role;

-- Reconciler input (SQL state is the authority, not an object listing). READ-ONLY: it never mutates, so it cannot break the
-- lock order; the reconciler acts per attempt through finalize_quote_output / abort_quote_output. Lists
-- (a) PREPARING attempts older than p_min_age (live: finalize if the object verifies; past TTL: abort -> expired) and
-- (b) aborted/expired attempts whose orphan object is not yet recorded as deleted.
CREATE OR REPLACE FUNCTION public.list_output_attempts_for_reconcile(p_min_age interval, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rows jsonb;
BEGIN
  IF p_min_age IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'list_output_attempts_for_reconcile: invalid arguments' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('attemptId', a.attempt_id, 'userId', a.user_id, 'quoteId', a.quote_id,
                                               'state', a.state, 'failureCode', a.failure_code, 'contentDigest', a.content_digest,
                                               'issuerDigest', a.issuer_digest, 'presentationDigest', a.presentation_digest,
                                               'snapshotPath', a.snapshot_path, 'expiresAt', a.expires_at,
                                               'pastTtl', a.state = 'preparing' AND a.expires_at <= now())
                            ORDER BY a.reserved_at), '[]'::jsonb)
    INTO v_rows
    FROM (SELECT * FROM public.quote_output_attempts a
           WHERE (a.state = 'preparing' AND a.reserved_at <= now() - p_min_age)
              OR (a.state IN ('aborted', 'expired') AND a.snapshot_deleted_at IS NULL)
           ORDER BY a.reserved_at LIMIT p_limit) a;
  RETURN v_rows;
END
$function$;
REVOKE ALL ON FUNCTION public.list_output_attempts_for_reconcile(interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_output_attempts_for_reconcile(interval, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_output_snapshot_deleted(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_state text;
BEGIN
  SELECT a.state INTO v_state FROM public.quote_output_attempts a WHERE a.attempt_id = p_attempt_id FOR UPDATE;
  IF v_state IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'attempt_not_found');
  END IF;
  IF v_state NOT IN ('aborted', 'expired') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'snapshot_not_deletable', 'state', v_state);  -- never a final's artifact
  END IF;
  UPDATE public.quote_output_attempts SET snapshot_deleted_at = now()
   WHERE attempt_id = p_attempt_id AND snapshot_deleted_at IS NULL;
  RETURN jsonb_build_object('ok', true, 'state', v_state);
END
$function$;
REVOKE ALL ON FUNCTION public.mark_output_snapshot_deleted(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_output_snapshot_deleted(uuid) TO service_role;

-- Reveal: every output channel (public link, send payload, final PDF, final Print) opens ONLY a FINALIZED descriptor.
-- Read-only: never consumes, never creates a snapshot, never lazy-freezes.
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
  SELECT * INTO v_ledger FROM public.quote_issue_ledger l WHERE l.quote_id = p_quote_id AND l.event_type = 'first_client_output';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_finalized');
  END IF;
  RETURN public.quote_output_final_response(v_ledger);
END
$function$;
REVOKE ALL ON FUNCTION public.get_output_descriptor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_output_descriptor(uuid) TO service_role;

-- Pre-consumption notice for the signed-in owner (own data only; read-only).
DROP FUNCTION IF EXISTS public.get_free_issue_balance(uuid);
CREATE FUNCTION public.get_free_issue_balance(p_quote_id uuid DEFAULT NULL)
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
    v_would := v_ent.account_mode = 'free_10'
      AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = p_quote_id AND q.user_id = v_uid
                     AND lower(coalesce(q.status, '')) = 'draft' AND coalesce(q.signature, '') = '')
      AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = v_uid AND l.quote_id = p_quote_id);
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

-- ---------------------------------------------------------------------------------------------------------------------------
-- 10. Direct-write closure on public.quotes - acts only in phase 'enforced', for EVERY account (unprovisioned accounts fail
--     closed: they cannot leave Draft because they cannot finalize). Output eligibility itself never depends on status:
--     reveal reads the ledger (section 9), so even a status written by a privileged path opens nothing.
-- ---------------------------------------------------------------------------------------------------------------------------
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
  IF v_has_final AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.client_id IS DISTINCT FROM OLD.client_id) THEN
    RAISE EXCEPTION 'output_authority: customer/owner change on an output quote requires a new quote' USING ERRCODE = '42501';
  END IF;
  IF NOT v_has_final AND lower(coalesce(OLD.status, '')) = 'draft' AND coalesce(OLD.signature, '') = ''
     AND (lower(coalesce(NEW.status, '')) <> 'draft' OR coalesce(NEW.signature, '') <> '') THEN
    RAISE EXCEPTION 'output_authority: a quote can only leave Draft through finalize_quote_output' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.enforce_output_authority_on_quotes() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS quotes_output_authority ON public.quotes;
CREATE TRIGGER quotes_output_authority BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_output_authority_on_quotes();

-- ---------------------------------------------------------------------------------------------------------------------------
-- 11. Provisioning (service_role; called by nothing). Never a retroactive grant.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_free_10(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rows integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'provision_free_10: invalid arguments' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provision_free_10:' || p_user_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', true, 'code', 'already_provisioned', 'provisioned', false);
  END IF;
  IF EXISTS (SELECT 1 FROM public.quotes q WHERE q.user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.quote_output_attempts a WHERE a.user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'existing_account_requires_owner_mapping');
  END IF;
  INSERT INTO public.account_entitlements (user_id, account_mode) VALUES (p_user_id, 'free_10') ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'code', CASE WHEN v_rows = 1 THEN 'provisioned' ELSE 'already_provisioned' END,
                            'provisioned', v_rows = 1);
END
$function$;
REVOKE ALL ON FUNCTION public.provision_free_10(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_free_10(uuid) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 12. Activation control (DB owner only - no application role may execute it). 'enforced' requires: matching schema
--     version, ZERO unmapped accounts, an operator attestation that the external preconditions hold (all four output
--     endpoints wired to the orchestrator, canonical DB gate incl. 20260930000000 green, negative/recovery tests green).
--     Paid is fail-closed (paid_quote_policy_pending) until a versioned paid policy exists. Rollback to 'prepared' is always
--     allowed and deletes nothing. Catalog 'enforced' is refused until the catalog-product definition is decided.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subscription_unmapped_accounts()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT count(*)::integer FROM (
    SELECT b.user_id FROM public.business_settings b WHERE b.user_id IS NOT NULL
    UNION
    SELECT q.user_id FROM public.quotes q WHERE q.user_id IS NOT NULL) u
   WHERE NOT EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = u.user_id)
$function$;
REVOKE ALL ON FUNCTION public.subscription_unmapped_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_unmapped_accounts() TO service_role;

CREATE OR REPLACE FUNCTION public.set_activation_phase(p_component text, p_phase text, p_attestation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_unmapped integer;
BEGIN
  IF p_component IS NULL OR p_component NOT IN ('free_issue', 'catalog_capacity')
     OR p_phase IS NULL OR p_phase NOT IN ('prepared', 'shadow', 'enforced') THEN
    RAISE EXCEPTION 'set_activation_phase: invalid arguments' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.subscription_activation a WHERE a.component = p_component FOR UPDATE;
  IF p_phase = 'enforced' THEN
    IF p_component = 'catalog_capacity' THEN
      RAISE EXCEPTION 'set_activation_phase: catalog_product_definition_pending' USING ERRCODE = 'P0001';
    END IF;
    v_unmapped := public.subscription_unmapped_accounts();
    IF v_unmapped <> 0 THEN
      RAISE EXCEPTION 'set_activation_phase: % unmapped account(s); enforced refused', v_unmapped USING ERRCODE = 'P0001';
    END IF;
    IF p_attestation IS NULL OR length(p_attestation) < 20 THEN
      RAISE EXCEPTION 'set_activation_phase: enforced requires an operator attestation of the external preconditions'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  UPDATE public.subscription_activation
     SET phase = p_phase, changed_at = now(), changed_reason = coalesce(p_attestation, 'phase change')
   WHERE component = p_component;
  RETURN jsonb_build_object('ok', true, 'component', p_component, 'phase', p_phase);
END
$function$;
REVOKE ALL ON FUNCTION public.set_activation_phase(text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 13. Catalog capacity (separate component, separate phase). paid = 100 + 100 x blocks; Free limit NOT decided (NULL).
--     Count = every public.services row (archive/variant/import/owner-transfer semantics NOT decided). Never deletes rows.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.catalog_capacity_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid   uuid := auth.uid();
  v_phase text;
  v_ent   public.account_entitlements%ROWTYPE;
  v_used  bigint;
  v_limit bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'catalog_capacity_status: not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT a.phase INTO v_phase FROM public.subscription_activation a WHERE a.component = 'catalog_capacity';
  IF v_phase IS NULL OR v_phase = 'prepared' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_activated');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
  END IF;
  SELECT count(*) INTO v_used FROM public.services s WHERE s.user_id = v_uid;
  IF v_ent.account_mode <> 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'accountMode', v_ent.account_mode, 'used', v_used, 'limit', NULL,
                              'remaining', NULL, 'expansionBlocks', v_ent.catalog_expansion_blocks, 'limitDecided', false);
  END IF;
  v_limit := 100::bigint + 100::bigint * v_ent.catalog_expansion_blocks;
  RETURN jsonb_build_object('ok', true, 'accountMode', v_ent.account_mode, 'used', v_used, 'limit', v_limit,
                            'remaining', greatest(v_limit - v_used, 0), 'expansionBlocks', v_ent.catalog_expansion_blocks,
                            'limitDecided', true);
END
$function$;
REVOKE ALL ON FUNCTION public.catalog_capacity_status() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.catalog_capacity_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_catalog_capacity_on_services()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_mode   text;
  v_blocks integer;
  v_limit  bigint;
  v_used   bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subscription_activation a WHERE a.component = 'catalog_capacity' AND a.phase = 'enforced') THEN
    RETURN NEW;  -- unreachable today: set_activation_phase refuses catalog 'enforced'
  END IF;
  SELECT e.account_mode, e.catalog_expansion_blocks INTO v_mode, v_blocks FROM public.account_entitlements e WHERE e.user_id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_capacity: account_not_provisioned' USING ERRCODE = 'P0001';
  END IF;
  IF v_mode <> 'paid' THEN
    RAISE EXCEPTION 'catalog_capacity: free_catalog_limit_not_decided' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog_capacity:' || NEW.user_id::text, 0));
  v_limit := 100::bigint + 100::bigint * v_blocks;
  SELECT count(*) INTO v_used FROM public.services s WHERE s.user_id = NEW.user_id;
  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'catalog_capacity_reached: % of % catalog products used', v_used, v_limit USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.enforce_catalog_capacity_on_services() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS services_catalog_capacity_enforcement ON public.services;
CREATE TRIGGER services_catalog_capacity_enforcement BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_catalog_capacity_on_services();

-- ROLLBACK (operational, only if ever applied): SELECT public.set_activation_phase('free_issue', 'prepared', '<reason>') as the
-- DB owner. Attempts and ledger are never deleted; finalized consumption is never rolled back.
