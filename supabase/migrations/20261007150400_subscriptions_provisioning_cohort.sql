-- ============================================================================================================================
-- 20261007150400_subscriptions_provisioning_cohort.sql  -  read-only cohort inventory, owner-only provisioning batches
-- tekango-migration-contract: mode=transaction replay=required
--
--   CROSSCUT_CONTRACT.md section 2.5 (OD-14, OPEN-07). Inert: no batch or mapping row exists, and only the DB owner can create,
--   apply or roll back one (no application role, not even service_role, holds any privilege on the batch objects). Never
--   applied to TEST/Production by this change. Nothing here grants Free-10 retroactively: an account with history is mapped to
--   free_10 only when its mapping row explicitly says so with an approval reference; any unknown account, or an account whose
--   state changed since it was mapped (before_hash), stops the WHOLE batch before anything is written.
--   Rollback of a batch removes only the rows that batch created and refuses when any ledger row / output attempt exists for
--   one of its accounts (finalized consumption is never undone).
--   transition_account_plan: the owner-only same-account plan transition (free_10 -> paid, paid plan change); it only changes the
--   entitlement row, never services / quotes / ledger / attempts. Downgrades stay refused (OPEN-09).
--   Every SECURITY DEFINER function pins search_path = public, pg_temp and revokes EXECUTE from PUBLIC and every API role.
--   Requires 20261007150000, 20261007150100 and 20261007150300 (xcut_append_only_guard).
--   Re-runnable: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- ============================================================================================================================

-- ---------------------------------------------------------------------------------------------------------------------------
-- 1. Account state hash (internal): what an Owner mapping was decided on. Any change of the legacy fields, the quote count,
--    the ledger count or the entitlement presence changes it.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subscription_account_state_hash(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'userId', p_user_id,
    'legacy', (SELECT jsonb_build_object('plan', b.plan, 'trialEndsAt', b.trial_ends_at, 'isLifetime', b.is_lifetime,
                                         'role', b.role, 'country', b.country)
                 FROM public.business_settings b WHERE b.user_id = p_user_id),
    'quotes', (SELECT count(*) FROM public.quotes q WHERE q.user_id = p_user_id),
    'ledger', (SELECT count(*) FROM public.quote_issue_ledger l WHERE l.user_id = p_user_id),
    'entitlement', EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = p_user_id))::text, 'UTF8')), 'hex')
$function$;
REVOKE ALL ON FUNCTION public.subscription_account_state_hash(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Known accounts: auth users, business settings owners and quote owners.
CREATE OR REPLACE FUNCTION public.subscription_known_account(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT p_user_id IS NOT NULL AND (EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.quotes q WHERE q.user_id = p_user_id))
$function$;
REVOKE ALL ON FUNCTION public.subscription_known_account(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 2. Read-only cohort inventory (service_role). One row per known account. No writes.
-- ---------------------------------------------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.subscription_cohort_inventory();
CREATE FUNCTION public.subscription_cohort_inventory()
RETURNS TABLE (user_id uuid, legacy_plan text, trial_ends_at timestamptz, is_lifetime boolean, role text, country text,
               created_at timestamptz, quotes_total bigint, quotes_by_status jsonb, services_count bigint,
               has_entitlement boolean, state_hash text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH accounts AS (
    SELECT u.id AS uid FROM auth.users u
    UNION SELECT b.user_id FROM public.business_settings b WHERE b.user_id IS NOT NULL
    UNION SELECT q.user_id FROM public.quotes q WHERE q.user_id IS NOT NULL)
  SELECT a.uid, b.plan, b.trial_ends_at, b.is_lifetime, b.role, b.country, coalesce(b.created_at, u.created_at),
         (SELECT count(*) FROM public.quotes q WHERE q.user_id = a.uid),
         coalesce((SELECT jsonb_object_agg(s.st, s.n) FROM (SELECT lower(coalesce(q.status, 'null')) AS st, count(*) AS n
                                                           FROM public.quotes q WHERE q.user_id = a.uid GROUP BY 1) s), '{}'::jsonb),
         (SELECT count(*) FROM public.services s WHERE s.user_id = a.uid),
         EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = a.uid),
         public.subscription_account_state_hash(a.uid)
    FROM accounts a
    LEFT JOIN public.business_settings b ON b.user_id = a.uid
    LEFT JOIN auth.users u ON u.id = a.uid
   ORDER BY a.uid
$function$;
REVOKE ALL ON FUNCTION public.subscription_cohort_inventory() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.subscription_cohort_inventory() TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 3. Provisioning batches / mappings (DB owner only: no grant to any application role)
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_provisioning_batches (
  batch_id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_ref        text        NOT NULL CHECK (length(approval_ref) >= 3),
  state               text        NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'applied', 'rolled_back')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  applied_at          timestamptz NULL,
  applied_attestation text        NULL,
  rolled_back_at      timestamptz NULL,
  rollback_reason     text        NULL
);
ALTER TABLE public.subscription_provisioning_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_provisioning_batches FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.subscription_provisioning_mappings (
  id                          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id                    uuid        NOT NULL REFERENCES public.subscription_provisioning_batches (batch_id),
  user_id                     uuid        NOT NULL,
  target_account_mode         text        NOT NULL CHECK (target_account_mode IN ('free_10', 'paid')),
  target_style_plan_id        text        NULL CHECK (target_style_plan_id IN ('classic', 'modern', 'visual')),
  target_market               text        NULL CHECK (target_market IN ('IL', 'INTERNATIONAL')),
  grant_free10_with_history   boolean     NOT NULL DEFAULT false,
  approval_ref                text        NOT NULL CHECK (length(approval_ref) >= 3),
  before_hash                 text        NOT NULL CHECK (before_hash ~ '^[0-9a-f]{64}$'),
  state                       text        NOT NULL DEFAULT 'pending'
                                          CHECK (state IN ('pending', 'applied', 'skipped_existing', 'rolled_back')),
  created_entitlement         boolean     NOT NULL DEFAULT false,
  created_market              boolean     NOT NULL DEFAULT false,
  CONSTRAINT subscription_provisioning_mappings_one UNIQUE (batch_id, user_id),
  CONSTRAINT subscription_provisioning_mappings_shape CHECK (
    (target_account_mode = 'free_10' AND target_style_plan_id IS NULL)
    OR (target_account_mode = 'paid' AND target_style_plan_id IS NOT NULL AND NOT grant_free10_with_history))
);
ALTER TABLE public.subscription_provisioning_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_provisioning_mappings FROM PUBLIC, anon, authenticated, service_role;
DO $do$ BEGIN
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated, service_role',
                 pg_get_serial_sequence('public.subscription_provisioning_mappings', 'id'));
END $do$;

-- apply (DB owner only). Validation pass over EVERY mapping first; any failure returns before any write.
CREATE OR REPLACE FUNCTION public.apply_provisioning_batch(p_batch_id uuid, p_attestation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_batch   public.subscription_provisioning_batches%ROWTYPE;
  v_m       public.subscription_provisioning_mappings%ROWTYPE;
  v_ledger  integer;
  v_applied integer := 0;
  v_skipped integer := 0;
  v_market  integer;
BEGIN
  IF p_batch_id IS NULL OR p_attestation IS NULL OR length(btrim(p_attestation)) < 20 THEN
    RAISE EXCEPTION 'apply_provisioning_batch: a batch id and an operator attestation are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_batch FROM public.subscription_provisioning_batches b WHERE b.batch_id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'batch_not_found');
  END IF;
  IF v_batch.state = 'applied' THEN
    RETURN jsonb_build_object('ok', true, 'state', 'applied', 'changed', false);
  END IF;
  IF v_batch.state <> 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'batch_not_draft', 'state', v_batch.state);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subscription_provisioning_mappings m WHERE m.batch_id = p_batch_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'empty_batch');
  END IF;
  -- lock order of the saga: activation -> entitlements
  PERFORM 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  -- (1) validation pass: nothing is written unless every mapping is valid
  FOR v_m IN SELECT * FROM public.subscription_provisioning_mappings m WHERE m.batch_id = p_batch_id ORDER BY m.user_id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('provision_free_10:' || v_m.user_id::text, 0));
    IF NOT public.subscription_known_account(v_m.user_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'unknown_account', 'userId', v_m.user_id);
    END IF;
    IF public.subscription_account_state_hash(v_m.user_id) <> v_m.before_hash THEN
      RETURN jsonb_build_object('ok', false, 'code', 'account_changed_since_mapping', 'userId', v_m.user_id);
    END IF;
    IF v_m.target_account_mode = 'free_10' AND NOT v_m.grant_free10_with_history
       AND (EXISTS (SELECT 1 FROM public.quotes q WHERE q.user_id = v_m.user_id)
            OR EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = v_m.user_id)
            OR EXISTS (SELECT 1 FROM public.quote_output_attempts a WHERE a.user_id = v_m.user_id)) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'free10_retroactive_requires_approval', 'userId', v_m.user_id);
    END IF;
  END LOOP;
  -- (2) write pass: never overwrites an existing entitlement / market row
  FOR v_m IN SELECT * FROM public.subscription_provisioning_mappings m WHERE m.batch_id = p_batch_id ORDER BY m.user_id FOR UPDATE LOOP
    IF EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = v_m.user_id) THEN
      UPDATE public.subscription_provisioning_mappings SET state = 'skipped_existing' WHERE id = v_m.id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    SELECT count(*)::integer INTO v_ledger FROM public.quote_issue_ledger l WHERE l.user_id = v_m.user_id AND l.counted_against_free;
    INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
    VALUES (v_m.user_id, v_m.target_account_mode, v_m.target_style_plan_id, v_ledger);
    v_market := 0;
    IF v_m.target_market IS NOT NULL THEN
      INSERT INTO public.account_market (user_id, market, source) VALUES (v_m.user_id, v_m.target_market, 'owner_mapping')
      ON CONFLICT (user_id) DO NOTHING;
      GET DIAGNOSTICS v_market = ROW_COUNT;
    END IF;
    UPDATE public.subscription_provisioning_mappings
       SET state = 'applied', created_entitlement = true, created_market = (v_market = 1)
     WHERE id = v_m.id;
    v_applied := v_applied + 1;
  END LOOP;
  UPDATE public.subscription_provisioning_batches
     SET state = 'applied', applied_at = now(), applied_attestation = p_attestation
   WHERE batch_id = p_batch_id;
  RETURN jsonb_build_object('ok', true, 'state', 'applied', 'changed', true, 'applied', v_applied, 'skippedExisting', v_skipped);
END
$function$;
REVOKE ALL ON FUNCTION public.apply_provisioning_batch(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- rollback (DB owner only): removes only rows the batch created; refused when any ledger row / attempt exists for them, or when
-- the created entitlement changed after apply (a later transition is never silently undone).
CREATE OR REPLACE FUNCTION public.rollback_provisioning_batch(p_batch_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_batch public.subscription_provisioning_batches%ROWTYPE;
  v_m     public.subscription_provisioning_mappings%ROWTYPE;
  v_ent   public.account_entitlements%ROWTYPE;
  v_n     integer := 0;
BEGIN
  IF p_batch_id IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'rollback_provisioning_batch: a batch id and a reason are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_batch FROM public.subscription_provisioning_batches b WHERE b.batch_id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'batch_not_found');
  END IF;
  IF v_batch.state = 'rolled_back' THEN
    RETURN jsonb_build_object('ok', true, 'state', 'rolled_back', 'changed', false);
  END IF;
  IF v_batch.state <> 'applied' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'batch_not_applied');
  END IF;
  PERFORM 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  FOR v_m IN SELECT * FROM public.subscription_provisioning_mappings m
              WHERE m.batch_id = p_batch_id AND m.created_entitlement ORDER BY m.user_id LOOP
    SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = v_m.user_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.user_id = v_m.user_id)
       OR EXISTS (SELECT 1 FROM public.quote_output_attempts a WHERE a.user_id = v_m.user_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'consumption_exists', 'userId', v_m.user_id);
    END IF;
    IF v_ent.user_id IS NOT NULL AND (v_ent.entitlement_version <> 1 OR v_ent.account_mode <> v_m.target_account_mode
       OR v_ent.style_plan_id IS DISTINCT FROM v_m.target_style_plan_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'entitlement_changed_since_apply', 'userId', v_m.user_id);
    END IF;
  END LOOP;
  FOR v_m IN SELECT * FROM public.subscription_provisioning_mappings m WHERE m.batch_id = p_batch_id ORDER BY m.user_id FOR UPDATE LOOP
    IF v_m.created_entitlement THEN
      DELETE FROM public.account_entitlements WHERE user_id = v_m.user_id;
      v_n := v_n + 1;
    END IF;
    IF v_m.created_market THEN
      DELETE FROM public.account_market WHERE user_id = v_m.user_id AND source = 'owner_mapping';
    END IF;
    UPDATE public.subscription_provisioning_mappings SET state = 'rolled_back' WHERE id = v_m.id;
  END LOOP;
  UPDATE public.subscription_provisioning_batches SET state = 'rolled_back', rolled_back_at = now(), rollback_reason = p_reason
   WHERE batch_id = p_batch_id;
  RETURN jsonb_build_object('ok', true, 'state', 'rolled_back', 'changed', true, 'removedEntitlements', v_n);
END
$function$;
REVOKE ALL ON FUNCTION public.rollback_provisioning_batch(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 4. Owner-only same-account plan transition (free_10 -> paid, paid -> other paid plan). Changes ONLY the entitlement row
--    (mode / plan / version); services, quotes, ledger and attempts are untouched; the Free counter stays equal to the ledger.
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_account_plan(p_user_id uuid, p_style_plan_id text, p_approval_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ent public.account_entitlements%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_style_plan_id IS NULL OR p_style_plan_id NOT IN ('classic', 'modern', 'visual')
     OR p_approval_ref IS NULL OR length(btrim(p_approval_ref)) < 3 THEN
    RAISE EXCEPTION 'transition_account_plan: invalid arguments' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.subscription_activation a WHERE a.component = 'free_issue' FOR SHARE;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');
  END IF;
  IF v_ent.account_mode = 'paid' AND v_ent.style_plan_id = p_style_plan_id THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'planId', p_style_plan_id, 'version', v_ent.entitlement_version);
  END IF;
  UPDATE public.account_entitlements
     SET account_mode = 'paid', style_plan_id = p_style_plan_id, entitlement_version = entitlement_version + 1, updated_at = now()
   WHERE user_id = p_user_id
  RETURNING * INTO v_ent;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'planId', v_ent.style_plan_id, 'version', v_ent.entitlement_version,
                            'freeIssuesConsumed', v_ent.free_issues_consumed);
END
$function$;
REVOKE ALL ON FUNCTION public.transition_account_plan(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------------
-- 5. Trial cron retirement readiness (service_role, read-only). eligibleTrialRows = business_settings rows the legacy trial
--    reminder cron can still act on (trial_ends_at set, not lifetime); mapped / unmapped over the same account universe as
--    subscription_unmapped_accounts (the enforcement gate).
-- ---------------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trial_cron_retirement_readiness()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH u AS (
    SELECT b.user_id FROM public.business_settings b WHERE b.user_id IS NOT NULL
    UNION
    SELECT q.user_id FROM public.quotes q WHERE q.user_id IS NOT NULL)
  SELECT jsonb_build_object(
    'eligibleTrialRows', (SELECT count(*) FROM public.business_settings b WHERE b.trial_ends_at IS NOT NULL AND NOT b.is_lifetime),
    'mappedAccounts', (SELECT count(*) FROM u WHERE EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = u.user_id)),
    'unmappedAccounts', (SELECT count(*) FROM u WHERE NOT EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = u.user_id)))
$function$;
REVOKE ALL ON FUNCTION public.trial_cron_retirement_readiness() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trial_cron_retirement_readiness() TO service_role;

-- ROLLBACK (forward-safe; DB owner): an applied batch is undone with rollback_provisioning_batch (refused once consumption
-- exists). While subscription_provisioning_batches is empty, this file's objects may be dropped (functions, then mappings, then
-- batches). account_entitlements / ledger rows are never dropped by a rollback of this file.
