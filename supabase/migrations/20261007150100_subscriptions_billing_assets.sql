-- ============================================================================================================================
-- 20261007150100_subscriptions_billing_assets.sql  -  billing catalog, server market, checkout intent, verified events, assets
-- tekango-migration-contract: mode=transaction replay=required
--
--   ADOPTED from subscriptions/sql/PREPARED_20261007120000_subscription_billing_assets.sql
--   (sha256 6cc46c6cdbb212c5009652b2bc2750d9dbe50dfd0bd0bce5a671170699328aff = LF bytes of the committed git blob 4b77daaf);
--   inert until the DB owner raises the phase; never applied to TEST/Production by this change.
--
--   Sections 1-6 below are byte-identical to the prepared file (only its header comment block was replaced). Section 7 is the
--   cross-cutting add-on (CROSSCUT_CONTRACT.md section 2.4): subscription lines and renewal failure / recovery. Billing phase
--   stays off; enforced is refused (OPEN-12); nothing here grants an entitlement or calls a provider.
--   Lock order: billing_activation -> account_market -> price_versions -> checkout_attempts / subscription rows.
--   Re-runnable: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS / ON CONFLICT DO NOTHING.
-- ============================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------------
-- 1. Billing activation (single row). 'off' = no checkout intent, no event processing. Write: DB owner only.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_activation (
  id         boolean     PRIMARY KEY DEFAULT true CHECK (id),
  phase      text        NOT NULL DEFAULT 'off' CHECK (phase IN ('off', 'prepared', 'enforced')),
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason     text
);
INSERT INTO public.billing_activation (id, phase, reason) VALUES (true, 'off', 'seeded by the prepared migration') ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.billing_activation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_activation FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_billing_phase(p_phase text, p_reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_phase IS NULL OR p_phase NOT IN ('off', 'prepared', 'enforced') OR coalesce(length(trim(p_reason)), 0) < 3 THEN
    RAISE EXCEPTION 'set_billing_phase: invalid arguments' USING ERRCODE = '22023';
  END IF;
  IF p_phase = 'enforced' THEN
    -- OPEN-12: no documented PayPlus/Max terminal, recurring/tokenization and signed-webhook evidence exists.
    RAISE EXCEPTION 'set_billing_phase: billing_provider_unverified' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.billing_activation SET phase = p_phase, changed_at = now(), reason = p_reason WHERE id;
  RETURN p_phase;
END $$;
REVOKE ALL ON FUNCTION public.set_billing_phase(text, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 2. Approved price versions (OD-03..OD-08). Seeded with exactly the Owner-locked rows; immutable; monthly only (OPEN-10).
--    IL = ILS, tax_mode 'included' (OD-05: no VAT is ever added). INTERNATIONAL = USD, tax_mode 'not_decided' (OPEN-11).
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_versions (
  price_id       text        PRIMARY KEY CHECK (price_id ~ '^[a-z0-9_]{3,64}$'),
  plan_id        text        NOT NULL CHECK (plan_id IN ('classic', 'modern', 'visual', 'catalog_block_100')),
  market         text        NOT NULL CHECK (market IN ('IL', 'INTERNATIONAL')),
  currency       text        NOT NULL,
  billing_period text        NOT NULL CHECK (billing_period = 'month'),
  amount_minor   integer     NOT NULL CHECK (amount_minor > 0),
  tax_mode       text        NOT NULL,
  approved_ref   text        NOT NULL CHECK (approved_ref ~ '^OD-0[0-9](,OD-0[0-9])*$'),
  valid_from     timestamptz NOT NULL DEFAULT '2026-10-07 00:00:00+00',
  CONSTRAINT price_versions_market_currency CHECK ((market = 'IL' AND currency = 'ILS' AND tax_mode = 'included')
                                                OR (market = 'INTERNATIONAL' AND currency = 'USD' AND tax_mode = 'not_decided'))
);
CREATE UNIQUE INDEX IF NOT EXISTS price_versions_one_per_plan_market ON public.price_versions (plan_id, market, billing_period);
INSERT INTO public.price_versions (price_id, plan_id, market, currency, billing_period, amount_minor, tax_mode, approved_ref) VALUES
  ('il_classic_month_v1',         'classic',           'IL',            'ILS', 'month', 2900, 'included',    'OD-03,OD-05'),
  ('il_modern_month_v1',          'modern',            'IL',            'ILS', 'month', 4900, 'included',    'OD-03,OD-05'),
  ('il_visual_month_v1',          'visual',            'IL',            'ILS', 'month', 6900, 'included',    'OD-03,OD-05'),
  ('il_catalog_block_month_v1',   'catalog_block_100', 'IL',            'ILS', 'month',  500, 'included',    'OD-04,OD-05'),
  ('intl_classic_month_v1',       'classic',           'INTERNATIONAL', 'USD', 'month', 1800, 'not_decided', 'OD-06,OD-08'),
  ('intl_modern_month_v1',        'modern',            'INTERNATIONAL', 'USD', 'month', 2800, 'not_decided', 'OD-06,OD-08'),
  ('intl_visual_month_v1',        'visual',            'INTERNATIONAL', 'USD', 'month', 3800, 'not_decided', 'OD-06,OD-08'),
  ('intl_catalog_block_month_v1', 'catalog_block_100', 'INTERNATIONAL', 'USD', 'month',  300, 'not_decided', 'OD-07,OD-08')
ON CONFLICT (price_id) DO NOTHING;
ALTER TABLE public.price_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.price_versions FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.price_versions_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'price_versions is append-only (approved prices are immutable; a change is a new Owner-approved version)'
    USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS price_versions_no_update ON public.price_versions;
CREATE TRIGGER price_versions_no_update BEFORE UPDATE OR DELETE ON public.price_versions
  FOR EACH ROW EXECUTE FUNCTION public.price_versions_immutable();
DROP TRIGGER IF EXISTS price_versions_no_truncate ON public.price_versions;
CREATE TRIGGER price_versions_no_truncate BEFORE TRUNCATE ON public.price_versions
  FOR EACH STATEMENT EXECUTE FUNCTION public.price_versions_immutable();

-- Read-only catalog view for one market (allowlisted fields). Anonymous-safe: prices are public facts; no account data.
CREATE OR REPLACE FUNCTION public.get_price_catalog(p_market text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_market IS NULL OR p_market NOT IN ('IL', 'INTERNATIONAL') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unknown_market');
  END IF;
  RETURN jsonb_build_object('ok', true, 'market', p_market, 'prices', coalesce((
    SELECT jsonb_agg(jsonb_build_object('priceId', price_id, 'planId', plan_id, 'currency', currency, 'billingPeriod', billing_period,
                                        'amountMinor', amount_minor, 'taxMode', tax_mode) ORDER BY amount_minor, plan_id)
    FROM public.price_versions WHERE market = p_market), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.get_price_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_price_catalog(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 3. Server-owned market per account. Written only by provisioning (service role); the browser locale, a query parameter or a
--    client payload never sets it (IRON-MARKET-002). No row = unprovisioned = no checkout.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_market (
  user_id uuid        PRIMARY KEY,
  market  text        NOT NULL CHECK (market IN ('IL', 'INTERNATIONAL')),
  source  text        NOT NULL CHECK (source IN ('business_settings_country', 'owner_mapping')),
  set_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_market ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_market FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.account_market TO service_role;
DROP POLICY IF EXISTS account_market_service ON public.account_market;
CREATE POLICY account_market_service ON public.account_market FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.account_market TO authenticated;
DROP POLICY IF EXISTS account_market_own_read ON public.account_market;
CREATE POLICY account_market_own_read ON public.account_market FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------------------------------------
-- 4. Checkout intents. Amount / currency / market are resolved HERE from the authenticated account's server market and the
--    approved price version; the caller passes only the plan id, the number of explicit +100 blocks and an idempotency key.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkout_attempts (
  attempt_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  idempotency_key text        NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$'),
  plan_price_id   text        NOT NULL REFERENCES public.price_versions (price_id),
  block_price_id  text        NULL REFERENCES public.price_versions (price_id),
  blocks          integer     NOT NULL DEFAULT 0 CHECK (blocks BETWEEN 0 AND 1000),
  market          text        NOT NULL CHECK (market IN ('IL', 'INTERNATIONAL')),
  currency        text        NOT NULL CHECK (currency IN ('ILS', 'USD')),
  amount_minor    integer     NOT NULL CHECK (amount_minor > 0),
  state           text        NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'expired', 'failed', 'confirmed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key),
  CONSTRAINT checkout_blocks_need_block_price CHECK ((blocks = 0) = (block_price_id IS NULL))
);
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_attempts FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_checkout_intent(p_user_id uuid, p_plan_id text, p_blocks integer, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_market text; v_plan public.price_versions; v_block public.price_versions; v_row public.checkout_attempts;
BEGIN
  IF p_user_id IS NULL OR p_plan_id IS NULL OR p_blocks IS NULL OR p_idempotency_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id FOR SHARE;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable');
  END IF;
  IF p_plan_id NOT IN ('classic', 'modern', 'visual') OR p_blocks < 0 OR p_blocks > 1000
     OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  SELECT market INTO v_market FROM public.account_market WHERE user_id = p_user_id FOR SHARE;
  IF v_market IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'account_unprovisioned'); END IF;
  SELECT * INTO v_row FROM public.checkout_attempts WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_row.plan_price_id <> (SELECT price_id FROM public.price_versions WHERE plan_id = p_plan_id AND market = v_market)
       OR v_row.blocks <> p_blocks THEN
      RETURN jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    END IF;
  ELSE
    SELECT * INTO v_plan FROM public.price_versions WHERE plan_id = p_plan_id AND market = v_market AND billing_period = 'month';
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable'); END IF;
    IF p_blocks > 0 THEN
      SELECT * INTO v_block FROM public.price_versions WHERE plan_id = 'catalog_block_100' AND market = v_market AND billing_period = 'month';
    END IF;
    INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, block_price_id, blocks, market, currency, amount_minor)
    VALUES (p_user_id, p_idempotency_key, v_plan.price_id, CASE WHEN p_blocks > 0 THEN v_block.price_id END, p_blocks, v_market,
            v_plan.currency, v_plan.amount_minor + p_blocks * coalesce(v_block.amount_minor, 0))
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING * INTO v_row;
    IF v_row.attempt_id IS NULL THEN
      SELECT * INTO v_row FROM public.checkout_attempts WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'attemptId', v_row.attempt_id, 'market', v_row.market, 'currency', v_row.currency,
                            'amountMinor', v_row.amount_minor, 'planPriceId', v_row.plan_price_id, 'blocks', v_row.blocks,
                            'state', v_row.state);
END $$;
REVOKE ALL ON FUNCTION public.create_checkout_intent(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_intent(uuid, text, integer, text) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 5. Verified provider events (append-only, idempotent) and the subscription projection. Only a VERIFIED event is stored; a
--    browser redirect is never an event. The only transition implemented is pending -> active on a confirmed payment for a
--    pending checkout attempt; past_due / cancel / refund / proration stay 'policy_pending' (OPEN-09). Older events never
--    overwrite newer state (monotonic provider_event_time). Entitlement activation is NOT performed here (activation off).
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_events (
  event_id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider            text        NOT NULL CHECK (provider IN ('payplus', 'mock')),
  provider_event_id   text        NOT NULL CHECK (length(provider_event_id) BETWEEN 1 AND 200),
  event_type          text        NOT NULL CHECK (event_type IN ('payment_confirmed', 'payment_failed', 'subscription_cancelled', 'refund')),
  attempt_id          uuid        NOT NULL REFERENCES public.checkout_attempts (attempt_id),
  provider_event_time timestamptz NOT NULL,
  payload_sha256      text        NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  verified            boolean     NOT NULL CHECK (verified),
  outcome             text        NOT NULL CHECK (outcome IN ('applied', 'stale', 'policy_pending', 'rejected')),
  received_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_events FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  attempt_id      uuid        PRIMARY KEY REFERENCES public.checkout_attempts (attempt_id),
  user_id         uuid        NOT NULL,
  status          text        NOT NULL CHECK (status IN ('pending', 'active')),
  last_event_time timestamptz NOT NULL,
  last_event_id   bigint      NOT NULL REFERENCES public.subscription_events (event_id),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscriptions FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.append_only_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS subscription_events_append_only ON public.subscription_events;
CREATE TRIGGER subscription_events_append_only BEFORE UPDATE OR DELETE ON public.subscription_events
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();
DROP TRIGGER IF EXISTS subscription_events_no_truncate ON public.subscription_events;
CREATE TRIGGER subscription_events_no_truncate BEFORE TRUNCATE ON public.subscription_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.append_only_guard();

CREATE OR REPLACE FUNCTION public.record_verified_subscription_event(p_provider text, p_provider_event_id text, p_event_type text,
  p_attempt_id uuid, p_provider_event_time timestamptz, p_payload_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_attempt public.checkout_attempts; v_sub public.subscriptions; v_outcome text; v_event_id bigint;
BEGIN
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id FOR SHARE;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
  END IF;
  IF p_provider_event_time IS NULL OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
  END IF;
  SELECT * INTO v_attempt FROM public.checkout_attempts WHERE attempt_id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  IF EXISTS (SELECT 1 FROM public.subscription_events WHERE provider = p_provider AND provider_event_id = p_provider_event_id) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  SELECT * INTO v_sub FROM public.subscriptions WHERE attempt_id = p_attempt_id FOR UPDATE;
  IF p_event_type <> 'payment_confirmed' THEN
    v_outcome := 'policy_pending';
  ELSIF v_sub.attempt_id IS NOT NULL AND v_sub.last_event_time >= p_provider_event_time THEN
    v_outcome := 'stale';
  ELSIF v_attempt.state <> 'pending' AND v_sub.attempt_id IS NULL THEN
    v_outcome := 'rejected';
  ELSE
    v_outcome := 'applied';
  END IF;
  INSERT INTO public.subscription_events (provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256, verified, outcome)
  VALUES (p_provider, p_provider_event_id, p_event_type, p_attempt_id, p_provider_event_time, p_payload_sha256, true, v_outcome)
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING event_id INTO v_event_id;
  IF v_event_id IS NULL THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
  IF v_outcome = 'applied' THEN
    INSERT INTO public.subscriptions (attempt_id, user_id, status, last_event_time, last_event_id)
    VALUES (p_attempt_id, v_attempt.user_id, 'active', p_provider_event_time, v_event_id)
    ON CONFLICT (attempt_id) DO UPDATE SET status = 'active', last_event_time = excluded.last_event_time,
      last_event_id = excluded.last_event_id, updated_at = now();
    UPDATE public.checkout_attempts SET state = 'confirmed' WHERE attempt_id = p_attempt_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', v_outcome);
END $$;
REVOKE ALL ON FUNCTION public.record_verified_subscription_event(text, text, text, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_subscription_event(text, text, text, uuid, timestamptz, text) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 6. Immutable account assets (spec Phase 3; mechanism for every plan, NOT a commercial claim). A logo is bound by identity:
--    random asset id + immutable object path + server-computed sha256 / bytes / MIME / dimensions. Replacing a logo creates a
--    NEW asset; a finalized asset never changes and is never deleted while it may be referenced. Attachments: same table later,
--    only after their entitlement is decided (kind is 'logo' only today).
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_assets (
  asset_id     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid        NOT NULL,
  kind         text        NOT NULL CHECK (kind = 'logo'),
  mime         text        NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
  object_path  text        NOT NULL UNIQUE,
  sha256       text        NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  bytes        integer     NOT NULL CHECK (bytes > 0),
  width        integer     NOT NULL CHECK (width > 0),
  height       integer     NOT NULL CHECK (height > 0),
  state        text        NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'finalized', 'orphaned')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz NULL,
  CONSTRAINT account_assets_path_shape CHECK (object_path = 'account-assets/' || owner_id::text || '/' || asset_id::text || '.' ||
    CASE mime WHEN 'image/png' THEN 'png' WHEN 'image/jpeg' THEN 'jpg' ELSE 'webp' END)
);
ALTER TABLE public.account_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_assets FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.account_logo_bindings (
  binding_id bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id   uuid        NOT NULL,
  asset_id   uuid        NOT NULL REFERENCES public.account_assets (asset_id),
  bound_at   timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.account_logo_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_logo_bindings FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS account_logo_bindings_append_only ON public.account_logo_bindings;
CREATE TRIGGER account_logo_bindings_append_only BEFORE UPDATE OR DELETE ON public.account_logo_bindings
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();

CREATE OR REPLACE FUNCTION public.account_assets_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state = 'finalized' THEN RAISE EXCEPTION 'a finalized asset is never deleted' USING ERRCODE = '42501'; END IF;
    RETURN OLD;
  END IF;
  IF (NEW.asset_id, NEW.owner_id, NEW.kind, NEW.mime, NEW.object_path, NEW.sha256, NEW.bytes, NEW.width, NEW.height)
     IS DISTINCT FROM (OLD.asset_id, OLD.owner_id, OLD.kind, OLD.mime, OLD.object_path, OLD.sha256, OLD.bytes, OLD.width, OLD.height) THEN
    RAISE EXCEPTION 'asset identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF NOT ((OLD.state = 'reserved' AND NEW.state IN ('finalized', 'orphaned')) OR OLD.state = NEW.state) THEN
    RAISE EXCEPTION 'asset state % -> % is not allowed', OLD.state, NEW.state USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS account_assets_guard ON public.account_assets;
CREATE TRIGGER account_assets_guard BEFORE UPDATE OR DELETE ON public.account_assets
  FOR EACH ROW EXECUTE FUNCTION public.account_assets_guard();

-- Reserve: the SERVER (Edge orchestrator) passes the metadata it computed from the bytes it holds; the path is derived here.
CREATE OR REPLACE FUNCTION public.reserve_logo_asset(p_owner_id uuid, p_mime text, p_sha256 text, p_bytes integer, p_width integer, p_height integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid := gen_random_uuid(); v_path text;
BEGIN
  IF p_owner_id IS NULL OR p_mime NOT IN ('image/png', 'image/jpeg', 'image/webp') OR p_sha256 !~ '^[0-9a-f]{64}$'
     OR coalesce(p_bytes, 0) <= 0 OR coalesce(p_width, 0) <= 0 OR coalesce(p_height, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_asset');
  END IF;
  v_path := 'account-assets/' || p_owner_id::text || '/' || v_id::text || '.' ||
            CASE p_mime WHEN 'image/png' THEN 'png' WHEN 'image/jpeg' THEN 'jpg' ELSE 'webp' END;
  INSERT INTO public.account_assets (asset_id, owner_id, kind, mime, object_path, sha256, bytes, width, height)
  VALUES (v_id, p_owner_id, 'logo', p_mime, v_path, p_sha256, p_bytes, p_width, p_height);
  RETURN jsonb_build_object('ok', true, 'assetId', v_id, 'objectPath', v_path);
END $$;
REVOKE ALL ON FUNCTION public.reserve_logo_asset(uuid, text, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_logo_asset(uuid, text, text, integer, integer, integer) TO service_role;

-- Finalize: the object must exist at the reserved path with the reserved size (read-back of storage metadata); then the asset
-- becomes immutable and is bound as the account's current logo (history kept). Re-finalizing returns the same descriptor.
CREATE OR REPLACE FUNCTION public.finalize_logo_asset(p_owner_id uuid, p_asset_id uuid, p_sha256 text, p_bytes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, storage AS $$
DECLARE v public.account_assets; v_size bigint;
BEGIN
  SELECT * INTO v FROM public.account_assets WHERE asset_id = p_asset_id FOR UPDATE;
  IF NOT FOUND OR v.owner_id IS DISTINCT FROM p_owner_id THEN RETURN jsonb_build_object('ok', false, 'code', 'asset_not_found'); END IF;
  IF v.sha256 IS DISTINCT FROM p_sha256 OR v.bytes IS DISTINCT FROM p_bytes THEN
    RETURN jsonb_build_object('ok', false, 'code', 'asset_not_immutable');
  END IF;
  IF v.state = 'finalized' THEN
    RETURN jsonb_build_object('ok', true, 'assetId', v.asset_id, 'objectPath', v.object_path, 'sha256', v.sha256, 'bytes', v.bytes, 'mime', v.mime, 'replay', true);
  END IF;
  IF v.state <> 'reserved' THEN RETURN jsonb_build_object('ok', false, 'code', 'asset_not_immutable'); END IF;
  SELECT (o.metadata ->> 'size')::bigint INTO v_size FROM storage.objects o WHERE o.bucket_id = 'quote-files' AND o.name = v.object_path;
  IF v_size IS NULL OR v_size <> v.bytes THEN RETURN jsonb_build_object('ok', false, 'code', 'asset_not_immutable'); END IF;
  UPDATE public.account_assets SET state = 'finalized', finalized_at = now() WHERE asset_id = v.asset_id;
  INSERT INTO public.account_logo_bindings (owner_id, asset_id) VALUES (v.owner_id, v.asset_id);
  RETURN jsonb_build_object('ok', true, 'assetId', v.asset_id, 'objectPath', v.object_path, 'sha256', v.sha256, 'bytes', v.bytes, 'mime', v.mime, 'replay', false);
END $$;
REVOKE ALL ON FUNCTION public.finalize_logo_asset(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_logo_asset(uuid, uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.current_logo_asset(p_owner_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce((
    SELECT jsonb_build_object('assetId', a.asset_id, 'objectPath', a.object_path, 'sha256', a.sha256, 'bytes', a.bytes, 'mime', a.mime)
    FROM public.account_logo_bindings b JOIN public.account_assets a ON a.asset_id = b.asset_id
    WHERE b.owner_id = p_owner_id AND a.state = 'finalized'
    ORDER BY b.binding_id DESC LIMIT 1), 'null'::jsonb) $$;
REVOKE ALL ON FUNCTION public.current_logo_asset(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_logo_asset(uuid) TO service_role;
-- ===========================================================================================================================
-- 7. ADD-ON (CROSSCUT_CONTRACT.md section 2.4): subscription lines + renewal failure / recovery. Not part of the prepared file.
--    Everything below is additive: the prepared event types / statuses are kept as a subset, record_verified_subscription_event is
--    unchanged. Billing phase gates every function exactly like the prepared functions ('off' -> billing_off). No function here
--    writes account_entitlements (entitlement projection is an activation step, not a billing step - see B31 in the prep tests).
-- ===========================================================================================================================

-- 7.1 vocabulary widening (superset of the prepared CHECK values; existing rows always satisfy the wider check)
ALTER TABLE public.subscription_events DROP CONSTRAINT IF EXISTS subscription_events_event_type_check;
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_event_type_check
  CHECK (event_type IN ('payment_confirmed', 'payment_failed', 'subscription_cancelled', 'refund',
                        'renewed', 'payment_succeeded', 'renewal_failed', 'line_changed'));
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('pending', 'active', 'past_due'));

-- 7.2 renewal periods (append-only). A verified successful renewal opens a period; a renewal failure never does.
CREATE TABLE IF NOT EXISTS public.subscription_periods (
  period_id       bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id      uuid        NOT NULL REFERENCES public.subscriptions (attempt_id),
  user_id         uuid        NOT NULL,
  period_start    timestamptz NOT NULL,
  source_event_id bigint      NOT NULL UNIQUE REFERENCES public.subscription_events (event_id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_periods FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.subscription_periods TO service_role;
DROP POLICY IF EXISTS subscription_periods_service_read ON public.subscription_periods;
CREATE POLICY subscription_periods_service_read ON public.subscription_periods FOR SELECT TO service_role USING (true);
DROP TRIGGER IF EXISTS subscription_periods_append_only ON public.subscription_periods;
CREATE TRIGGER subscription_periods_append_only BEFORE UPDATE OR DELETE ON public.subscription_periods
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();
DROP TRIGGER IF EXISTS subscription_periods_no_truncate ON public.subscription_periods;
CREATE TRIGGER subscription_periods_no_truncate BEFORE TRUNCATE ON public.subscription_periods
  FOR EACH STATEMENT EXECUTE FUNCTION public.append_only_guard();

-- 7.3 renewal events. renewal_failed -> past_due (no new period); only a later verified renewed / payment_succeeded -> active
--     (+ one period). An event older than (or equal to) the last applied event time -> stale, state unchanged. Idempotent on
--     (provider, provider_event_id). A renewal for an attempt without a subscription is recorded as rejected (never creates one).
CREATE OR REPLACE FUNCTION public.apply_verified_renewal_event(p_provider text, p_provider_event_id text, p_event_type text,
  p_attempt_id uuid, p_occurred_at timestamptz, p_payload_sha256 text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phase    text;
  v_attempt  public.checkout_attempts%ROWTYPE;
  v_sub      public.subscriptions%ROWTYPE;
  v_outcome  text;
  v_event_id bigint;
  v_status   text;
BEGIN
  SELECT b.phase INTO v_phase FROM public.billing_activation b WHERE b.id FOR SHARE;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
  END IF;
  IF p_provider IS NULL OR p_provider NOT IN ('payplus', 'mock')
     OR p_provider_event_id IS NULL OR length(p_provider_event_id) NOT BETWEEN 1 AND 200
     OR p_event_type IS NULL OR p_event_type NOT IN ('renewed', 'payment_succeeded', 'renewal_failed')
     OR p_attempt_id IS NULL OR p_occurred_at IS NULL
     OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
  END IF;
  SELECT * INTO v_attempt FROM public.checkout_attempts c WHERE c.attempt_id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt');
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscription_events e WHERE e.provider = p_provider AND e.provider_event_id = p_provider_event_id) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  SELECT * INTO v_sub FROM public.subscriptions s WHERE s.attempt_id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    v_outcome := 'rejected';
  ELSIF v_sub.last_event_time >= p_occurred_at THEN
    v_outcome := 'stale';
  ELSE
    v_outcome := 'applied';
  END IF;
  INSERT INTO public.subscription_events (provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256,
                                          verified, outcome)
  VALUES (p_provider, p_provider_event_id, p_event_type, p_attempt_id, p_occurred_at, p_payload_sha256, true, v_outcome)
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING event_id INTO v_event_id;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_outcome = 'applied' THEN
    v_status := CASE WHEN p_event_type = 'renewal_failed' THEN 'past_due' ELSE 'active' END;
    UPDATE public.subscriptions
       SET status = v_status, last_event_time = p_occurred_at, last_event_id = v_event_id, updated_at = now()
     WHERE attempt_id = p_attempt_id;
    IF v_status = 'active' THEN
      INSERT INTO public.subscription_periods (attempt_id, user_id, period_start, source_event_id)
      VALUES (p_attempt_id, v_sub.user_id, p_occurred_at, v_event_id);
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', v_outcome,
                            'status', CASE WHEN v_outcome = 'applied' THEN v_status ELSE v_sub.status END);
END
$function$;
REVOKE ALL ON FUNCTION public.apply_verified_renewal_event(text, text, text, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_verified_renewal_event(text, text, text, uuid, timestamptz, text) TO service_role;

-- 7.4 subscription lines: one open line per (account, line type); price snapshot copied from price_versions of the account's
--     SERVER market (account_market). Append-only except closing effective_to once (never deleted).
CREATE TABLE IF NOT EXISTS public.subscription_lines (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL,
  line_type          text        NOT NULL CHECK (line_type IN ('plan', 'catalog_block')),
  quantity           integer     NOT NULL CHECK (quantity >= 1),
  price_version_id   text        NOT NULL REFERENCES public.price_versions (price_id),
  unit_amount_minor  integer     NOT NULL CHECK (unit_amount_minor > 0),
  currency           text        NOT NULL CHECK (currency IN ('ILS', 'USD')),
  effective_from     timestamptz NOT NULL,
  effective_to       timestamptz NULL,
  provider           text        NOT NULL CHECK (provider IN ('payplus', 'mock')),
  provider_ref       text        NULL CHECK (provider_ref IS NULL OR length(provider_ref) BETWEEN 1 AND 200),
  source_event_id    bigint      NOT NULL UNIQUE REFERENCES public.subscription_events (event_id),
  closed_by_event_id bigint      NULL REFERENCES public.subscription_events (event_id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_lines_period CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT subscription_lines_closed_shape CHECK ((effective_to IS NULL) = (closed_by_event_id IS NULL)),
  CONSTRAINT subscription_lines_plan_qty CHECK (line_type <> 'plan' OR quantity = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_lines_one_open ON public.subscription_lines (user_id, line_type) WHERE effective_to IS NULL;
CREATE INDEX IF NOT EXISTS subscription_lines_by_user ON public.subscription_lines (user_id, line_type, effective_from);
ALTER TABLE public.subscription_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_lines FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.subscription_lines TO service_role;
DROP POLICY IF EXISTS subscription_lines_service_read ON public.subscription_lines;
CREATE POLICY subscription_lines_service_read ON public.subscription_lines FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.subscription_lines_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'subscription_lines is append-only (% refused)', TG_OP USING ERRCODE = '42501';
  END IF;
  IF OLD.effective_to IS NOT NULL
     OR NEW.effective_to IS NULL OR NEW.closed_by_event_id IS NULL
     OR (NEW.id, NEW.user_id, NEW.line_type, NEW.quantity, NEW.price_version_id, NEW.unit_amount_minor, NEW.currency,
         NEW.effective_from, NEW.provider, NEW.provider_ref, NEW.source_event_id, NEW.created_at)
        IS DISTINCT FROM
        (OLD.id, OLD.user_id, OLD.line_type, OLD.quantity, OLD.price_version_id, OLD.unit_amount_minor, OLD.currency,
         OLD.effective_from, OLD.provider, OLD.provider_ref, OLD.source_event_id, OLD.created_at) THEN
    RAISE EXCEPTION 'subscription_lines: only closing effective_to once is allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
REVOKE ALL ON FUNCTION public.subscription_lines_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS subscription_lines_guard_row ON public.subscription_lines;
CREATE TRIGGER subscription_lines_guard_row BEFORE UPDATE OR DELETE ON public.subscription_lines
  FOR EACH ROW EXECUTE FUNCTION public.subscription_lines_guard();
DROP TRIGGER IF EXISTS subscription_lines_guard_truncate ON public.subscription_lines;
CREATE TRIGGER subscription_lines_guard_truncate BEFORE TRUNCATE ON public.subscription_lines
  FOR EACH STATEMENT EXECUTE FUNCTION public.subscription_lines_guard();

-- 7.5 apply_verified_line_event: the verified provider event sets the quantity of one line type from p_effective_from.
--     p_quantity >= 1 = (re)set the line (closes the open one, opens the new one); p_quantity = 0 = removal (closes the open line,
--     deletes nothing). Never auto-purchases: it only records what a verified provider event states, for an account that already
--     has a subscription. The event row lands in subscription_events (event_type 'line_changed'); its payload_sha256 is the SHA-256
--     of the normalized verified arguments (the caller passes no raw payload here). Idempotent on (provider, provider_event_id).
CREATE OR REPLACE FUNCTION public.apply_verified_line_event(p_provider text, p_provider_event_id text, p_user_id uuid,
  p_line_type text, p_quantity integer, p_price_version_id text, p_effective_from timestamptz, p_provider_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_phase    text;
  v_market   text;
  v_price    public.price_versions%ROWTYPE;
  v_sub      public.subscriptions%ROWTYPE;
  v_open     public.subscription_lines%ROWTYPE;
  v_latest   timestamptz;
  v_outcome  text := 'applied';
  v_reason   text;
  v_event_id bigint;
  v_line_id  uuid;
  v_digest   text;
BEGIN
  SELECT b.phase INTO v_phase FROM public.billing_activation b WHERE b.id FOR SHARE;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
  END IF;
  IF p_provider IS NULL OR p_provider NOT IN ('payplus', 'mock')
     OR p_provider_event_id IS NULL OR length(p_provider_event_id) NOT BETWEEN 1 AND 200
     OR p_user_id IS NULL OR p_line_type IS NULL OR p_line_type NOT IN ('plan', 'catalog_block')
     OR p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 1000 OR (p_line_type = 'plan' AND p_quantity > 1)
     OR p_effective_from IS NULL
     OR (p_provider_ref IS NOT NULL AND length(p_provider_ref) NOT BETWEEN 1 AND 200)
     OR (p_quantity > 0 AND p_price_version_id IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
  END IF;
  -- lock order: billing_activation -> account_market -> price_versions -> subscription rows
  SELECT m.market INTO v_market FROM public.account_market m WHERE m.user_id = p_user_id FOR SHARE;
  IF v_market IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_unprovisioned');
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscription_events e WHERE e.provider = p_provider AND e.provider_event_id = p_provider_event_id) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF p_price_version_id IS NOT NULL THEN
    SELECT * INTO v_price FROM public.price_versions p WHERE p.price_id = p_price_version_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'unknown_price_version');
    END IF;
    IF (p_line_type = 'plan' AND v_price.plan_id NOT IN ('classic', 'modern', 'visual'))
       OR (p_line_type = 'catalog_block' AND v_price.plan_id <> 'catalog_block_100') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'price_line_type_mismatch');
    END IF;
    IF v_price.market <> v_market THEN
      RETURN jsonb_build_object('ok', false, 'code', 'market_mismatch');   -- never an ILS line for INTERNATIONAL (or vice versa)
    END IF;
  END IF;
  -- the account must already hold a subscription (a line never creates or buys one)
  SELECT * INTO v_sub FROM public.subscriptions s
   WHERE s.user_id = p_user_id AND s.status IN ('active', 'past_due')
   ORDER BY s.last_event_time DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_subscription');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('subscription_lines:' || p_user_id::text || ':' || p_line_type, 0));
  SELECT * INTO v_open FROM public.subscription_lines l
   WHERE l.user_id = p_user_id AND l.line_type = p_line_type AND l.effective_to IS NULL FOR UPDATE;
  SELECT max(greatest(l.effective_from, coalesce(l.effective_to, l.effective_from))) INTO v_latest
    FROM public.subscription_lines l WHERE l.user_id = p_user_id AND l.line_type = p_line_type;
  IF v_latest IS NOT NULL AND p_effective_from < v_latest THEN
    v_outcome := 'stale';
  ELSIF p_quantity = 0 AND v_open.id IS NULL THEN
    v_outcome := 'rejected'; v_reason := 'no_open_line';
  END IF;
  v_digest := encode(sha256(convert_to(jsonb_build_object('provider', p_provider, 'providerEventId', p_provider_event_id,
    'userId', p_user_id, 'lineType', p_line_type, 'quantity', p_quantity, 'priceVersionId', p_price_version_id,
    'effectiveFrom', p_effective_from, 'providerRef', p_provider_ref)::text, 'UTF8')), 'hex');
  INSERT INTO public.subscription_events (provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256,
                                          verified, outcome)
  VALUES (p_provider, p_provider_event_id, 'line_changed', v_sub.attempt_id, p_effective_from, v_digest, true, v_outcome)
  ON CONFLICT (provider, provider_event_id) DO NOTHING
  RETURNING event_id INTO v_event_id;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_outcome <> 'applied' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', v_outcome, 'reason', v_reason);
  END IF;
  IF v_open.id IS NOT NULL THEN
    UPDATE public.subscription_lines SET effective_to = p_effective_from, closed_by_event_id = v_event_id WHERE id = v_open.id;
  END IF;
  IF p_quantity > 0 THEN
    INSERT INTO public.subscription_lines (user_id, line_type, quantity, price_version_id, unit_amount_minor, currency, effective_from,
                                           provider, provider_ref, source_event_id)
    VALUES (p_user_id, p_line_type, p_quantity, v_price.price_id, v_price.amount_minor, v_price.currency, p_effective_from,
            p_provider, p_provider_ref, v_event_id)
    RETURNING id INTO v_line_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', 'applied', 'lineId', v_line_id, 'closedLineId', v_open.id,
                            'quantity', p_quantity, 'unitAmountMinor', v_price.amount_minor, 'currency', v_price.currency,
                            'priceVersionId', v_price.price_id);
END
$function$;
REVOKE ALL ON FUNCTION public.apply_verified_line_event(text, text, uuid, text, integer, text, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_verified_line_event(text, text, uuid, text, integer, text, timestamptz, text) TO service_role;

-- identity sequence of the new table: no application role draws from it
DO $do$ BEGIN
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated, service_role',
                 pg_get_serial_sequence('public.subscription_periods', 'period_id'));
END $do$;

-- ROLLBACK (forward-safe; DB owner): SELECT public.set_billing_phase('off', '<reason>'). The add-on objects can be dropped only
-- while subscription_lines / subscription_periods are empty; subscription_events (and the prepared tables) are never dropped.
