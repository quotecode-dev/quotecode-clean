-- ============================================================================================================================
-- 20261022300000_billing_admin_stop_and_refund.sql  -  the Owner's tools for Terms section 6: stop the renewal, or end early with a
--                                                     prorated refund (PayPlus standing order + refund; prepared, inert)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-21 ("כן, אם זה מה שאתה חושב שצריך להיות השלב הבא" on docs/PAYMENTS_ACTIVATION_PLAN_2026-10-21.md step 4) and
--   the Owner's answers the same evening: after a stopped renewal the account is LIMITED the moment the paid period ends (no 3 grace
--   days, no "update the card" notices - the customer cancelled, no charge failed); an early end keeps access to the END OF THE DAY
--   (midnight, Israel) and the refund is computed from then. Terms section 6 (src/pages/Terms.jsx, id cancellation): handled by the
--   team, (a) stop the renewal - the package runs to the end of the paid period; (b) early end - the unused share of the period is
--   refunded by the price actually paid and the days of the period; the annual discount is not clawed back; a cancellation fee only
--   where the law allows, at most the lower of 5% and 100 ILS (decision 2026-10-20: the refund deducts it; the Owner may waive it).
--   1. account_entitlements.renewal_stopped_at: the standing order was stopped at PayPlus (set only after PayPlus confirmed it).
--   2. paid_grace_ends_at / paid_account_limited / account_billing_state: a stopped renewal has no grace episode; it is limited from
--      paid_through. The summary keeps its keys (inGrace false, limited true from then).
--   3. billing_admin_actions + billing_admin_action_results + billing_admin_refunds: append-only, no truncate; the request with every
--      computed amount, ONE stop result per action, ONE refund result per action. Service role only; nobody else reads them.
--   4. billing_admin_preview(user, waive_fee) / billing_admin_begin / billing_admin_finish / billing_admin_record_refund: the amounts are
--      computed in SQL only; begin refuses a stale preview (the expected refund must equal the server's) and any open action (no time
--      limit - an action interrupted after PayPlus acted is resolved by the Owner); finish records the stop and applies the entitlement
--      change only when PayPlus stopped the standing order AND the package is still the one computed; ONLY THEN is a refund due (the
--      refund is never sent before the end is recorded, so it can never be sent twice); a failed / impossible refund is recorded for a
--      manual refund in the PayPlus panel.
--   Review 2026-10-21 (scope-security): the refund goes to the charge that paid the current period (billing_paid_periods, written by the
--   recorder; a period opened by a pull: its first charge's callback) and the days count from the real start of the period; a stopped
--   account's limited state carries its end in graceEndsAt (the summary contract requires a time).
--   Codex audit 2026-10-22 (docs/CODEX_PAYMENTS_PREP_AUDIT_2026-10-22.md): H-03 every paid period is its own row with the charge that paid
--   it (billing_paid_periods) - the refund is computed on the ACTIVE period only (Owner: the refund covers the current period), and an
--   early end is refused while a later period is already paid (future_period_paid - refund that charge in the PayPlus panel first);
--   H-04 a verified payment of an attempt that is no longer payable (an expired / failed link) is reported (attempt_not_payable);
--   M-02 no cancellation fee in USD until an approved rule exists (the 100 ILS cap has no USD equivalent).
--   Re-review: a refund is marked 'sending' BEFORE PayPlus is called, so a refund owed is never lost (crash / lost answer) - the Owner
--   sees it (billing_admin_unsettled_refund) and settles it after checking the PayPlus panel; an interrupted action can be resolved only
--   5 minutes after it began (never racing the request still waiting for PayPlus), and an early end resolved after its own midnight
--   refunds nothing automatically (the renewal is recorded as stopped; the Owner starts a fresh early end with today's amount).
--   5. record_verified_subscription_event_and_activate (body 20261022100000 + the marked changes): a renewal charge that arrives after
--      the renewal was stopped extends nothing and is reported (renewal_stopped); a NEW purchase clears the stop.
--   INERT: billing is 'off' in code and in the DB - preview and begin answer billing_off; nothing can be stopped or refunded.
--   ROLLBACK (DB owner): roll the Edge function admin-billing back first; re-run the 20261022100000 bodies of
--   record_verified_subscription_event_and_activate and paid_grace_ends_at and the 20261021200000 bodies of paid_account_limited /
--   account_billing_state; DROP FUNCTION public.billing_admin_preview(uuid, boolean), public.billing_admin_begin(uuid, uuid, text,
--   boolean, integer, text), public.billing_admin_finish(uuid, text, boolean), public.billing_admin_record_refund(uuid, text, text,
--   integer), public.billing_admin_refund_sending(uuid), public.billing_admin_settle_refund(uuid, uuid), public.billing_admin_unsettled_refund(uuid),
--   public.paid_stopped_ends_at(uuid), public.billing_admin_open_action(uuid); the tables and the column may stay (empty / NULL).
-- ============================================================================================================================

-- 1. the stop -------------------------------------------------------------------------------------------------------------------
ALTER TABLE public.account_entitlements ADD COLUMN IF NOT EXISTS renewal_stopped_at timestamptz NULL;
-- every paid period with the charge that paid it (Codex audit 2026-10-22 H-03): an early end refunds the ACTIVE period's own charge,
-- never a renewal paid in advance. Append-only; written by the recorder on every extension.
CREATE TABLE IF NOT EXISTS public.billing_paid_periods (
  period_id    bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      uuid        NOT NULL,
  attempt_id   uuid        NOT NULL REFERENCES public.checkout_attempts (attempt_id),
  event_id     text        NOT NULL CHECK (length(event_id) BETWEEN 1 AND 200),
  charge_ref   text        NULL CHECK (charge_ref IS NULL OR length(charge_ref) BETWEEN 1 AND 200),
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end > period_start)
);
CREATE INDEX IF NOT EXISTS billing_paid_periods_user ON public.billing_paid_periods (user_id, period_end DESC);
ALTER TABLE public.billing_paid_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_paid_periods FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS billing_paid_periods_append_only ON public.billing_paid_periods;
CREATE TRIGGER billing_paid_periods_append_only BEFORE UPDATE OR DELETE ON public.billing_paid_periods
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();
DROP TRIGGER IF EXISTS billing_paid_periods_no_truncate ON public.billing_paid_periods;
CREATE TRIGGER billing_paid_periods_no_truncate BEFORE TRUNCATE ON public.billing_paid_periods
  FOR EACH STATEMENT EXECUTE FUNCTION public.append_only_guard();

-- 2. grace / limited (body 20261022100000 + the marked change) -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.paid_grace_ends_at(p_user_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT least(CASE WHEN e.subscription_status = 'past_due'
                    THEN greatest(e.payment_failed_at, coalesce(e.paid_through, e.payment_failed_at)) + interval '72 hours' END,
               -- 20261022100000 (Owner D-1): no renewal callback at all = the same 3 days from the end of the paid period (shown after
               -- the first 24 hours, so an ordinary renewal arriving a few hours late never flashes a grace notice)
               CASE WHEN e.paid_through IS NOT NULL AND now() >= e.paid_through + interval '24 hours'
                    THEN e.paid_through + interval '72 hours' END)
    FROM public.account_entitlements e
   WHERE e.user_id = p_user_id AND e.account_mode = 'paid' AND e.package_id IS NOT NULL AND e.style_plan_id IS NULL
     -- 20261022300000 (Owner 2026-10-21): a stopped renewal has no grace episode (paid_account_limited: limited from paid_through)
     AND e.renewal_stopped_at IS NULL
     AND NOT coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false)
$function$;
REVOKE ALL ON FUNCTION public.paid_grace_ends_at(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- the end of the paid access of a stopped renewal (NULL = not stopped)
CREATE OR REPLACE FUNCTION public.paid_stopped_ends_at(p_user_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT coalesce(e.paid_through, e.renewal_stopped_at)
    FROM public.account_entitlements e
   WHERE e.user_id = p_user_id AND e.account_mode = 'paid' AND e.package_id IS NOT NULL AND e.style_plan_id IS NULL
     AND e.renewal_stopped_at IS NOT NULL
     AND NOT coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false)
$function$;
REVOKE ALL ON FUNCTION public.paid_stopped_ends_at(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.paid_account_limited(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.billing_activation b WHERE b.id AND b.phase = 'enforced')
     AND (coalesce(now() >= public.paid_grace_ends_at(p_user_id), false)
          -- 20261022300000: a stopped renewal is limited the moment its paid access ends
          OR coalesce(now() >= public.paid_stopped_ends_at(p_user_id), false))
$function$;
REVOKE ALL ON FUNCTION public.paid_account_limited(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_billing_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_enf   boolean := EXISTS (SELECT 1 FROM public.billing_activation b WHERE b.id AND b.phase = 'enforced');
  v_paid  timestamptz;
  v_grace timestamptz;
  v_stop  timestamptz;
  c_fmt   constant text := 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';
BEGIN
  SELECT e.paid_through INTO v_paid FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  v_grace := CASE WHEN v_enf THEN public.paid_grace_ends_at(p_user_id) END;
  v_stop  := CASE WHEN v_enf THEN public.paid_stopped_ends_at(p_user_id) END; -- 20261022300000
  RETURN jsonb_build_object(
    'paidThrough', to_char(v_paid AT TIME ZONE 'UTC', c_fmt),
    -- a limited stopped account carries its end here: the summary contract requires a time with limited
    'graceEndsAt', to_char(coalesce(v_grace, CASE WHEN v_stop IS NOT NULL AND now() >= v_stop THEN v_stop END) AT TIME ZONE 'UTC', c_fmt),
    'inGrace', v_grace IS NOT NULL AND now() < v_grace,
    'limited', (v_grace IS NOT NULL AND now() >= v_grace) OR (v_stop IS NOT NULL AND now() >= v_stop));
END
$function$;
REVOKE ALL ON FUNCTION public.account_billing_state(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 3. the Owner's actions (append-only) ------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_admin_actions (
  action_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text        NOT NULL CHECK (kind IN ('stop_renewal', 'end_early')),
  actor_user_id      uuid        NOT NULL,
  user_id            uuid        NOT NULL,
  attempt_id         uuid        NOT NULL REFERENCES public.checkout_attempts (attempt_id),
  reason             text        NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  recurring_ref      text        NULL,
  terminal_ref       text        NULL,
  charge_ref         text        NULL,
  currency           text        NOT NULL CHECK (currency IN ('ILS', 'USD')),
  paid_minor         integer     NOT NULL CHECK (paid_minor > 0),
  period             text        NOT NULL CHECK (period IN ('month', 'year')),
  period_start       timestamptz NOT NULL,
  paid_through       timestamptz NOT NULL,
  effective_end      timestamptz NULL,
  days_in_period     integer     NOT NULL CHECK (days_in_period > 0),
  unused_days        integer     NOT NULL CHECK (unused_days >= 0),
  prorated_minor     integer     NOT NULL CHECK (prorated_minor >= 0),
  fee_minor          integer     NOT NULL CHECK (fee_minor >= 0),
  fee_waived         boolean     NOT NULL,
  refund_minor       integer     NOT NULL CHECK (refund_minor >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'end_early') = (effective_end IS NOT NULL)),
  CHECK (kind = 'end_early' OR refund_minor = 0)
);
CREATE INDEX IF NOT EXISTS billing_admin_actions_user ON public.billing_admin_actions (user_id, created_at DESC);
ALTER TABLE public.billing_admin_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_admin_actions FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS billing_admin_actions_append_only ON public.billing_admin_actions;
CREATE TRIGGER billing_admin_actions_append_only BEFORE UPDATE OR DELETE ON public.billing_admin_actions
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();
DROP TRIGGER IF EXISTS billing_admin_actions_no_truncate ON public.billing_admin_actions;
CREATE TRIGGER billing_admin_actions_no_truncate BEFORE TRUNCATE ON public.billing_admin_actions
  FOR EACH STATEMENT EXECUTE FUNCTION public.append_only_guard();

CREATE TABLE IF NOT EXISTS public.billing_admin_action_results (
  action_id          uuid        PRIMARY KEY REFERENCES public.billing_admin_actions (action_id),
  cancel_status      text        NOT NULL CHECK (cancel_status IN ('cancelled', 'failed')),
  applied            boolean     NOT NULL,
  resolved_by_owner  boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_admin_action_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_admin_action_results FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS billing_admin_action_results_append_only ON public.billing_admin_action_results;
CREATE TRIGGER billing_admin_action_results_append_only BEFORE UPDATE OR DELETE ON public.billing_admin_action_results
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();
DROP TRIGGER IF EXISTS billing_admin_action_results_no_truncate ON public.billing_admin_action_results;
CREATE TRIGGER billing_admin_action_results_no_truncate BEFORE TRUNCATE ON public.billing_admin_action_results
  FOR EACH STATEMENT EXECUTE FUNCTION public.append_only_guard();

-- the refund of an applied early end, in stages (each once): 'sending' (written BEFORE PayPlus is called), 'result' (what PayPlus
-- answered: refunded / failed / manual = no transaction id), 'owner' (the Owner confirmed in the PayPlus panel that it was refunded)
CREATE TABLE IF NOT EXISTS public.billing_admin_refunds (
  action_id          uuid        NOT NULL REFERENCES public.billing_admin_action_results (action_id),
  stage              text        NOT NULL CHECK (stage IN ('sending', 'result', 'owner')),
  refund_status      text        NULL CHECK (refund_status IN ('refunded', 'failed', 'manual')),
  refund_ref         text        NULL CHECK (refund_ref IS NULL OR length(refund_ref) BETWEEN 1 AND 200),
  refunded_minor     integer     NULL CHECK (refunded_minor IS NULL OR refunded_minor > 0),
  actor_user_id      uuid        NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (action_id, stage),
  CHECK ((stage = 'result') = (refund_status IS NOT NULL)),
  CHECK (stage = 'result' OR (refund_ref IS NULL AND refunded_minor IS NULL)),
  CHECK (refund_status IS DISTINCT FROM 'refunded' OR (refund_ref IS NOT NULL AND refunded_minor IS NOT NULL)),
  CHECK (refund_status IS NULL OR refund_status = 'refunded' OR (refund_ref IS NULL AND refunded_minor IS NULL)),
  CHECK ((stage = 'owner') = (actor_user_id IS NOT NULL))
);
ALTER TABLE public.billing_admin_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_admin_refunds FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS billing_admin_refunds_append_only ON public.billing_admin_refunds;
CREATE TRIGGER billing_admin_refunds_append_only BEFORE UPDATE OR DELETE ON public.billing_admin_refunds
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();
DROP TRIGGER IF EXISTS billing_admin_refunds_no_truncate ON public.billing_admin_refunds;
CREATE TRIGGER billing_admin_refunds_no_truncate BEFORE TRUNCATE ON public.billing_admin_refunds
  FOR EACH STATEMENT EXECUTE FUNCTION public.append_only_guard();

-- 4. preview / begin / finish -------------------------------------------------------------------------------------------------
-- The facts and the amounts of the account's live package. Days are Israel calendar days; the early end is the end of today (midnight,
-- Israel). refund = round(paid x unused days / days of the ACTIVE period) - fee; fee = 5% of the paid amount, at most 100 ILS, ILS only
-- (Codex audit M-02: no USD fee until an approved rule), 0 when waived.
CREATE OR REPLACE FUNCTION public.billing_admin_preview(p_user_id uuid, p_waive_fee boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_ent public.account_entitlements; v_att public.checkout_attempts; v_period text;
  v_rec public.provider_standing_orders; v_charge text; v_start timestamptz; v_end timestamptz;
  v_days int; v_unused int; v_prorated int; v_fee int; v_refund int; v_pp public.billing_paid_periods; v_pend timestamptz; v_future boolean;
BEGIN
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
  END IF;
  IF p_user_id IS NULL OR p_waive_fee IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = p_user_id), false) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'lifetime_account');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF v_ent.user_id IS NULL OR v_ent.account_mode <> 'paid' OR v_ent.package_id IS NULL OR v_ent.style_plan_id IS NOT NULL
     OR v_ent.live_attempt_id IS NULL OR v_ent.paid_through IS NULL OR v_ent.package_period NOT IN ('month', 'year') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_live_package');
  END IF;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_ent.live_attempt_id;
  v_period := v_ent.package_period;
  -- the newest standing order of the live attempt, and the newest real charge of it (a pulled first charge has no transaction id)
  SELECT * INTO v_rec FROM public.provider_standing_orders s WHERE s.attempt_id = v_att.attempt_id ORDER BY s.created_at DESC LIMIT 1;
  -- the ACTIVE paid period (Codex audit H-03) and its own charge; a later period already paid = hasFuturePeriod
  SELECT * INTO v_pp FROM public.billing_paid_periods p
   WHERE p.user_id = p_user_id AND p.attempt_id = v_att.attempt_id AND p.period_start <= now() AND p.period_end > now()
   ORDER BY p.period_end DESC, p.period_id DESC LIMIT 1;
  v_pend := coalesce(v_pp.period_end, v_ent.paid_through);
  v_future := v_ent.paid_through > v_pend;
  v_charge := v_pp.charge_ref;
  IF v_charge IS NULL AND v_pp.event_id LIKE 'pull:%' THEN
    -- a period opened by a pull: its first charge's callback (stale, within 7 days of the pull)
    SELECT e.provider_event_id INTO v_charge
      FROM public.subscription_events e
      JOIN public.subscription_events p ON p.provider = 'payplus' AND p.provider_event_id = 'pull:' || v_att.attempt_id::text AND p.outcome = 'applied'
     WHERE e.attempt_id = v_att.attempt_id AND e.provider = 'payplus' AND e.event_type = 'payment_confirmed' AND e.outcome = 'stale'
       AND e.provider_event_id NOT LIKE 'pull:%' AND e.provider_event_time < p.provider_event_time + interval '7 days'
     ORDER BY e.provider_event_time, e.event_id LIMIT 1;
  END IF;
  -- the real start of the period (a clamped month end never changes the day count); derived only without a period row
  v_start := coalesce(v_pp.period_start,
    ((v_pend AT TIME ZONE 'Asia/Jerusalem') - CASE v_period WHEN 'year' THEN interval '1 year' ELSE interval '1 month' END)
      AT TIME ZONE 'Asia/Jerusalem');
  v_end := (date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') + interval '1 day') AT TIME ZONE 'Asia/Jerusalem';
  v_days := greatest(1, (v_pend AT TIME ZONE 'Asia/Jerusalem')::date - (v_start AT TIME ZONE 'Asia/Jerusalem')::date);
  v_unused := greatest(0, (v_pend AT TIME ZONE 'Asia/Jerusalem')::date - (v_end AT TIME ZONE 'Asia/Jerusalem')::date);
  v_unused := least(v_unused, v_days);
  v_prorated := round(v_att.amount_minor::numeric * v_unused / v_days)::int;
  v_fee := CASE WHEN p_waive_fee OR v_prorated = 0 THEN 0
                WHEN v_att.currency = 'ILS' THEN least(round(v_att.amount_minor * 0.05)::int, 10000)
                ELSE 0 END; -- Codex audit M-02: no USD fee until an approved rule
  v_refund := greatest(0, v_prorated - v_fee);
  RETURN jsonb_build_object('ok', true, 'attemptId', v_att.attempt_id, 'currency', v_att.currency, 'paidMinor', v_att.amount_minor,
    'period', v_period, 'periodStart', v_start, 'periodEnd', v_pend, 'paidThrough', v_ent.paid_through, 'effectiveEnd', v_end,
    'hasFuturePeriod', v_future,
    'daysInPeriod', v_days, 'unusedDays', v_unused, 'proratedMinor', v_prorated, 'feeMinor', v_fee, 'feeWaived', p_waive_fee,
    'refundMinor', v_refund, 'renewalStopped', v_ent.renewal_stopped_at IS NOT NULL,
    'hasStandingOrder', v_rec.recurring_ref IS NOT NULL, 'hasChargeRef', v_charge IS NOT NULL,
    'recurringRef', v_rec.recurring_ref, 'terminalRef', v_rec.terminal_ref, 'chargeRef', v_charge);
END $$;
REVOKE ALL ON FUNCTION public.billing_admin_preview(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_preview(uuid, boolean) TO service_role;

-- one action at a time per account; the expected refund must equal the server's computation (never a stale preview)
CREATE OR REPLACE FUNCTION public.billing_admin_begin(p_actor_user_id uuid, p_user_id uuid, p_kind text, p_waive_fee boolean,
  p_expected_refund_minor integer, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_p jsonb; v_id uuid; v_refund int;
BEGIN
  IF p_actor_user_id IS NULL OR p_kind NOT IN ('stop_renewal', 'end_early') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = p_actor_user_id AND b.role = 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || p_user_id::text));
  v_p := public.billing_admin_preview(p_user_id, coalesce(p_waive_fee, false));
  IF (v_p ->> 'ok') IS DISTINCT FROM 'true' THEN RETURN v_p; END IF;
  -- a stopped renewal may still be ended early (its standing order is already stopped - PayPlus is not asked again); never twice
  IF (v_p ->> 'renewalStopped')::boolean AND p_kind = 'stop_renewal' THEN RETURN jsonb_build_object('ok', false, 'code', 'already_stopped'); END IF;
  -- Codex audit H-03: a later period is already paid - its charge is refunded in the PayPlus panel first (never guessed here)
  IF p_kind = 'end_early' AND (v_p ->> 'hasFuturePeriod')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'code', 'future_period_paid');
  END IF;
  IF EXISTS (SELECT 1 FROM public.billing_admin_actions a JOIN public.billing_admin_action_results r ON r.action_id = a.action_id
              WHERE a.attempt_id = (v_p ->> 'attemptId')::uuid AND a.kind = 'end_early' AND r.applied) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_ended');
  END IF;
  IF NOT (v_p ->> 'hasStandingOrder')::boolean AND NOT (v_p ->> 'renewalStopped')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_standing_order'); -- stop it in the PayPlus panel; nothing here changes
  END IF;
  -- an open action (no recorded stop result) blocks - with no time limit: PayPlus may have acted; the Owner resolves it
  IF EXISTS (SELECT 1 FROM public.billing_admin_actions a WHERE a.user_id = p_user_id
              AND NOT EXISTS (SELECT 1 FROM public.billing_admin_action_results r WHERE r.action_id = a.action_id)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'action_in_progress');
  END IF;
  v_refund := CASE WHEN p_kind = 'end_early' THEN (v_p ->> 'refundMinor')::int ELSE 0 END;
  IF p_expected_refund_minor IS DISTINCT FROM v_refund THEN
    RETURN jsonb_build_object('ok', false, 'code', 'stale_preview', 'refundMinor', v_refund);
  END IF;
  INSERT INTO public.billing_admin_actions (kind, actor_user_id, user_id, attempt_id, reason, recurring_ref, terminal_ref, charge_ref,
    currency, paid_minor, period, period_start, paid_through, effective_end, days_in_period, unused_days, prorated_minor, fee_minor,
    fee_waived, refund_minor)
  VALUES (p_kind, p_actor_user_id, p_user_id, (v_p ->> 'attemptId')::uuid, btrim(p_reason), v_p ->> 'recurringRef', v_p ->> 'terminalRef',
    v_p ->> 'chargeRef', v_p ->> 'currency', (v_p ->> 'paidMinor')::int, v_p ->> 'period', (v_p ->> 'periodStart')::timestamptz,
    (v_p ->> 'paidThrough')::timestamptz, CASE WHEN p_kind = 'end_early' THEN (v_p ->> 'effectiveEnd')::timestamptz END,
    (v_p ->> 'daysInPeriod')::int, (v_p ->> 'unusedDays')::int,
    CASE WHEN p_kind = 'end_early' THEN (v_p ->> 'proratedMinor')::int ELSE 0 END,
    CASE WHEN p_kind = 'end_early' THEN (v_p ->> 'feeMinor')::int ELSE 0 END, coalesce(p_waive_fee, false), v_refund)
  RETURNING action_id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'actionId', v_id, 'kind', p_kind, 'alreadyStopped', (v_p ->> 'renewalStopped')::boolean,
    'recurringRef', v_p ->> 'recurringRef',
    'terminalRef', v_p ->> 'terminalRef', 'chargeRef', v_p ->> 'chargeRef', 'refundMinor', v_refund, 'currency', v_p ->> 'currency');
END $$;
REVOKE ALL ON FUNCTION public.billing_admin_begin(uuid, uuid, text, boolean, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_begin(uuid, uuid, text, boolean, integer, text) TO service_role;

-- the stop result: the entitlement changes only when PayPlus stopped the standing order AND the package is still the one computed;
-- p_resolved_by_owner = the Owner resolved an interrupted action from the PayPlus panel. Returns refundDue: ONLY now may the refund be sent.
CREATE OR REPLACE FUNCTION public.billing_admin_finish(p_action_id uuid, p_cancel_status text, p_resolved_by_owner boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_a public.billing_admin_actions; v_applied boolean; v_ent public.account_entitlements;
BEGIN
  SELECT * INTO v_a FROM public.billing_admin_actions a WHERE a.action_id = p_action_id;
  IF NOT FOUND OR p_cancel_status NOT IN ('cancelled', 'failed') OR p_resolved_by_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  -- the Owner resolves an interrupted action only when the request that began it can no longer be running
  IF p_resolved_by_owner AND v_a.created_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'too_early_to_resolve');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_a.user_id::text));
  IF EXISTS (SELECT 1 FROM public.billing_admin_action_results r WHERE r.action_id = p_action_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_finished');
  END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = v_a.user_id FOR UPDATE;
  -- (an early end of an already stopped renewal: 'cancelled' = the standing order was stopped before)
  v_applied := p_cancel_status = 'cancelled' AND v_ent.live_attempt_id = v_a.attempt_id AND v_ent.paid_through = v_a.paid_through
               AND (v_ent.renewal_stopped_at IS NULL OR v_a.kind = 'end_early')
               -- an early end resolved after its own midnight: the customer kept the days - only the stop is recorded (below)
               AND NOT (p_resolved_by_owner AND v_a.kind = 'end_early' AND now() >= v_a.effective_end);
  INSERT INTO public.billing_admin_action_results (action_id, cancel_status, applied, resolved_by_owner)
  VALUES (p_action_id, p_cancel_status, v_applied, p_resolved_by_owner);
  IF v_applied THEN
    UPDATE public.account_entitlements
       SET renewal_stopped_at = coalesce(renewal_stopped_at, now()),
           paid_through = CASE WHEN v_a.kind = 'end_early' THEN least(paid_through, v_a.effective_end) ELSE paid_through END,
           entitlement_version = entitlement_version + 1, updated_at = now()
     WHERE user_id = v_a.user_id
    RETURNING * INTO v_ent;
  ELSIF p_cancel_status = 'cancelled' AND v_ent.renewal_stopped_at IS NULL AND v_ent.live_attempt_id = v_a.attempt_id THEN
    -- PayPlus stopped the standing order but the package changed meanwhile (a renewal landed): no refund is due, but the renewal IS
    -- stopped - recorded, so the account ends without grace days at its (new) paid end instead of waiting for a charge that never comes
    UPDATE public.account_entitlements SET renewal_stopped_at = now(), entitlement_version = entitlement_version + 1, updated_at = now()
     WHERE user_id = v_a.user_id
    RETURNING * INTO v_ent;
  END IF;
  RETURN jsonb_build_object('ok', true, 'applied', v_applied, 'paidThrough', v_ent.paid_through, 'renewalStopped', v_ent.renewal_stopped_at IS NOT NULL,
    'refundDue', v_applied AND v_a.kind = 'end_early' AND v_a.refund_minor > 0, 'refundMinor', v_a.refund_minor, 'currency', v_a.currency,
    'chargeRef', v_a.charge_ref);
END $$;
REVOKE ALL ON FUNCTION public.billing_admin_finish(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_finish(uuid, text, boolean) TO service_role;

-- 'sending': written BEFORE PayPlus is called (once) - from here a refund owed can never be lost
CREATE OR REPLACE FUNCTION public.billing_admin_refund_sending(p_action_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_a public.billing_admin_actions;
BEGIN
  SELECT a.* INTO v_a FROM public.billing_admin_actions a JOIN public.billing_admin_action_results r ON r.action_id = a.action_id
   WHERE a.action_id = p_action_id AND r.applied AND a.kind = 'end_early' AND a.refund_minor > 0;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  INSERT INTO public.billing_admin_refunds (action_id, stage) VALUES (p_action_id, 'sending') ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'refund_already_started'); END IF;
  RETURN jsonb_build_object('ok', true, 'chargeRef', v_a.charge_ref, 'refundMinor', v_a.refund_minor, 'currency', v_a.currency);
END $$;
REVOKE ALL ON FUNCTION public.billing_admin_refund_sending(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_refund_sending(uuid) TO service_role;

-- 'result': what PayPlus answered - once, after 'sending', and 'refunded' only of the exact recorded amount
CREATE OR REPLACE FUNCTION public.billing_admin_record_refund(p_action_id uuid, p_refund_status text, p_refund_ref text, p_refunded_minor integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_a public.billing_admin_actions;
BEGIN
  SELECT a.* INTO v_a FROM public.billing_admin_actions a JOIN public.billing_admin_refunds s ON s.action_id = a.action_id AND s.stage = 'sending'
   WHERE a.action_id = p_action_id;
  IF NOT FOUND OR p_refund_status NOT IN ('refunded', 'failed', 'manual')
     OR (p_refund_status = 'refunded' AND (p_refunded_minor IS DISTINCT FROM v_a.refund_minor OR p_refund_ref IS NULL OR length(p_refund_ref) NOT BETWEEN 1 AND 200))
     OR (p_refund_status <> 'refunded' AND (p_refunded_minor IS NOT NULL OR p_refund_ref IS NOT NULL)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  INSERT INTO public.billing_admin_refunds (action_id, stage, refund_status, refund_ref, refunded_minor)
  VALUES (p_action_id, 'result', p_refund_status, p_refund_ref, p_refunded_minor)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'already_recorded'); END IF;
  RETURN jsonb_build_object('ok', true, 'refundStatus', p_refund_status, 'refundMinor', v_a.refund_minor, 'currency', v_a.currency);
END $$;
REVOKE ALL ON FUNCTION public.billing_admin_record_refund(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_record_refund(uuid, text, text, integer) TO service_role;

-- a refund owed and not confirmed: an applied early end with a refund, neither refunded by the API nor confirmed by the Owner
CREATE OR REPLACE FUNCTION public.billing_admin_unsettled_refund(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object('actionId', a.action_id, 'refundMinor', a.refund_minor, 'currency', a.currency, 'createdAt', a.created_at,
           'state', coalesce((SELECT x.refund_status FROM public.billing_admin_refunds x WHERE x.action_id = a.action_id AND x.stage = 'result'),
                             CASE WHEN EXISTS (SELECT 1 FROM public.billing_admin_refunds x WHERE x.action_id = a.action_id AND x.stage = 'sending')
                                  THEN 'sending' ELSE 'not_sent' END))
    FROM public.billing_admin_actions a JOIN public.billing_admin_action_results r ON r.action_id = a.action_id
   WHERE a.user_id = p_user_id AND r.applied AND a.kind = 'end_early' AND a.refund_minor > 0
     AND NOT EXISTS (SELECT 1 FROM public.billing_admin_refunds x WHERE x.action_id = a.action_id
                      AND (x.stage = 'owner' OR (x.stage = 'result' AND x.refund_status = 'refunded')))
   ORDER BY a.created_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.billing_admin_unsettled_refund(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_unsettled_refund(uuid) TO service_role;

-- 'owner': the Owner checked the PayPlus panel and confirms the refund of an unsettled action was made there
CREATE OR REPLACE FUNCTION public.billing_admin_settle_refund(p_action_id uuid, p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_u jsonb; v_user uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.business_settings b WHERE b.user_id = p_actor_user_id AND b.role = 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;
  SELECT a.user_id INTO v_user FROM public.billing_admin_actions a WHERE a.action_id = p_action_id;
  v_u := CASE WHEN v_user IS NOT NULL THEN public.billing_admin_unsettled_refund(v_user) END;
  IF v_u IS NULL OR (v_u ->> 'actionId')::uuid IS DISTINCT FROM p_action_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'no_unsettled_refund');
  END IF;
  INSERT INTO public.billing_admin_refunds (action_id, stage, actor_user_id) VALUES (p_action_id, 'owner', p_actor_user_id)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'refundMinor', v_u -> 'refundMinor', 'currency', v_u ->> 'currency');
END $$;
REVOKE ALL ON FUNCTION public.billing_admin_settle_refund(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_settle_refund(uuid, uuid) TO service_role;

-- the account's open action (begun, no stop result) - what the Owner resolves after an interruption
CREATE OR REPLACE FUNCTION public.billing_admin_open_action(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object('actionId', a.action_id, 'kind', a.kind, 'createdAt', a.created_at, 'refundMinor', a.refund_minor, 'currency', a.currency)
    FROM public.billing_admin_actions a
   WHERE a.user_id = p_user_id AND NOT EXISTS (SELECT 1 FROM public.billing_admin_action_results r WHERE r.action_id = a.action_id)
   ORDER BY a.created_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.billing_admin_open_action(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_open_action(uuid) TO service_role;

-- 5. the verified-payment recorder (body 20261022100000 + the marked 20261022300000 changes) ------------------------------------
CREATE OR REPLACE FUNCTION public.record_verified_subscription_event_and_activate(p_provider text, p_provider_event_id text,
  p_event_type text, p_attempt_id uuid, p_provider_event_time timestamptz, p_payload_sha256 text,
  p_paid_amount_minor integer DEFAULT NULL, p_paid_currency text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_r jsonb; v_phase text; v_attempt public.checkout_attempts; v_price public.price_versions; v_ent public.account_entitlements;
  v_user uuid; v_first boolean; v_pstart timestamptz;
BEGIN
  -- one account at a time (two links of one user paid at once never deadlock: attempt -> entitlement -> other attempts)
  SELECT c.user_id, c.state = 'pending' INTO v_user, v_first FROM public.checkout_attempts c WHERE c.attempt_id = p_attempt_id;
  IF v_user IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
    SELECT c.state = 'pending' INTO v_first FROM public.checkout_attempts c WHERE c.attempt_id = p_attempt_id; -- after the lock
  END IF;
  -- 20261022100000 (Codex audit H04): a confirmed payment whose amount / currency differ from the attempt is recorded as REJECTED
  -- before anything advances - no subscription row, no event time, no state - so it can never make a later correct payment stale.
  -- The attempt stays pending: a correct payment of it may still open the package.
  IF p_event_type = 'payment_confirmed' AND v_user IS NOT NULL THEN
    SELECT * INTO v_attempt FROM public.checkout_attempts WHERE attempt_id = p_attempt_id;
    IF p_paid_amount_minor IS DISTINCT FROM v_attempt.amount_minor OR p_paid_currency IS DISTINCT FROM v_attempt.currency THEN
      SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
      IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
      END IF;
      IF p_provider_event_time IS NULL OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
      END IF;
      INSERT INTO public.subscription_events (provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256, verified, outcome)
      VALUES (p_provider, p_provider_event_id, p_event_type, p_attempt_id, p_provider_event_time, p_payload_sha256, true, 'rejected')
      ON CONFLICT (provider, provider_event_id) DO NOTHING;
      IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
      RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', 'rejected', 'activated', false, 'code', 'amount_mismatch');
    END IF;
  END IF;
  v_r := public.record_verified_subscription_event(p_provider, p_provider_event_id, p_event_type, p_attempt_id,
                                                   p_provider_event_time, p_payload_sha256);
  -- 20261021200000: a verified FAILED charge of the live package (PayPlus retries it daily) starts the 3 grace days once
  IF (v_r ->> 'ok') = 'true' AND (v_r ->> 'duplicate') IS DISTINCT FROM 'true' AND p_event_type = 'payment_failed' THEN
    RETURN v_r || public.billing_record_failed_charge(p_attempt_id, p_provider_event_time);
  END IF;
  -- Codex audit H-04: a verified payment of an attempt that is no longer payable (an expired / failed link paid anyway) is reported -
  -- recorded, never a second package; the provider event and its standing order stay traceable for a cancellation / refund
  IF (v_r ->> 'ok') = 'true' AND (v_r ->> 'duplicate') IS DISTINCT FROM 'true' AND p_event_type = 'payment_confirmed'
     AND (v_r ->> 'outcome') = 'rejected' THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'attempt_not_payable');
  END IF;
  IF (v_r ->> 'ok') IS DISTINCT FROM 'true' OR (v_r ->> 'duplicate') = 'true' OR p_event_type IS DISTINCT FROM 'payment_confirmed'
     OR (v_r ->> 'outcome') IS DISTINCT FROM 'applied' THEN
    RETURN v_r;
  END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'enforced' THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'billing_not_enforced');
  END IF;
  SELECT * INTO v_attempt FROM public.checkout_attempts WHERE attempt_id = p_attempt_id;
  SELECT * INTO v_price FROM public.price_versions WHERE price_id = v_attempt.plan_price_id;
  IF v_price.plan_id IS DISTINCT FROM 'all_inclusive' OR v_price.billing_period NOT IN ('month', 'year') THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'not_a_package_attempt');
  END IF;
  IF p_paid_amount_minor IS DISTINCT FROM v_attempt.amount_minor OR p_paid_currency IS DISTINCT FROM v_attempt.currency THEN
    -- the event stays recorded (append-only). A FIRST payment of a wrong amount never counts as a live subscription
    -- (account_billing_period reads it); a wrong-amount renewal of a live subscription changes nothing.
    IF v_first THEN
      UPDATE public.checkout_attempts SET state = 'failed' WHERE attempt_id = p_attempt_id;
      UPDATE public.subscriptions SET status = 'pending', updated_at = now() WHERE attempt_id = p_attempt_id;
    END IF;
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'amount_mismatch');
  END IF;
  IF coalesce((SELECT b.is_lifetime FROM public.business_settings b WHERE b.user_id = v_attempt.user_id), false) THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'legacy_paid_account');
  END IF;
  -- read first: the counter guard trigger fires BEFORE INSERT even when ON CONFLICT would skip the row
  SELECT * INTO v_ent FROM public.account_entitlements WHERE user_id = v_attempt.user_id FOR UPDATE;
  IF NOT FOUND THEN
    -- 20261021400000: the SMART PACK line of the first payment rides on the package charge of the same attempt
    INSERT INTO public.account_entitlements (user_id, account_mode, package_id, package_period, subscription_status, smart_pack_line)
    VALUES (v_attempt.user_id, 'paid', 'all_inclusive', v_price.billing_period, 'active', v_attempt.add_on_price_id IS NOT NULL)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING * INTO v_ent;
    IF v_ent.user_id IS NULL THEN
      SELECT * INTO v_ent FROM public.account_entitlements WHERE user_id = v_attempt.user_id FOR UPDATE; -- created concurrently
    END IF;
  END IF;
  IF v_ent.account_mode = 'paid' AND v_ent.style_plan_id IS NOT NULL THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'legacy_paid_account');
  END IF;
  -- 20261022100000 (review): a charge of a REPLACED attempt (the account paid a newer one) extends nothing - recorded, reported
  -- (superseded_standing_order) for the Owner's cancellation / refund
  IF NOT v_first AND v_ent.live_attempt_id IS NOT NULL AND v_ent.live_attempt_id IS DISTINCT FROM p_attempt_id THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'superseded_standing_order');
  END IF;
  -- 20261022300000 (Owner 2026-10-21): a renewal charge after the Owner stopped the renewal extends nothing - recorded, reported
  -- (renewal_stopped) for a refund
  IF NOT v_first AND v_ent.renewal_stopped_at IS NOT NULL THEN
    RETURN v_r || jsonb_build_object('activated', false, 'code', 'renewal_stopped');
  END IF;
  -- 20261022100000 (review): a NEW attempt of a LIMITED account (no renewal arrived; the row may still say active) is a new purchase -
  -- its own period and SMART PACK choice apply (the ELSE branch), never "another package active"
  IF v_ent.account_mode = 'paid' AND v_ent.package_id = 'all_inclusive' AND v_ent.subscription_status = 'active'
     AND NOT (v_first AND public.paid_account_limited(v_attempt.user_id)) THEN
    IF v_ent.package_period IS DISTINCT FROM v_price.billing_period THEN
      IF v_first THEN
        UPDATE public.checkout_attempts SET state = 'failed' WHERE attempt_id = p_attempt_id;
        UPDATE public.subscriptions SET status = 'pending', updated_at = now() WHERE attempt_id = p_attempt_id;
      END IF;
      RETURN v_r || jsonb_build_object('activated', false, 'code', 'another_package_active');
    END IF;
    -- this active package already (the row just created above, or a renewal charge): the package stays; 20261021200000: the paid
    -- period runs one more period from its end (never shortened; a late charge runs from the charge)
    v_pstart := greatest(coalesce(v_ent.paid_through, p_provider_event_time), p_provider_event_time);
    UPDATE public.account_entitlements
       SET paid_through = public.billing_period_end(greatest(coalesce(paid_through, p_provider_event_time), p_provider_event_time), v_price.billing_period),
           payment_failed_at = NULL, updated_at = now(),
           live_attempt_id = CASE WHEN v_first THEN p_attempt_id ELSE coalesce(live_attempt_id, p_attempt_id) END,
           renewal_stopped_at = CASE WHEN v_first THEN NULL ELSE renewal_stopped_at END -- 20261022300000: a new purchase clears the stop
     WHERE user_id = v_attempt.user_id
    RETURNING * INTO v_ent;
  ELSE
    v_pstart := greatest(coalesce(v_ent.paid_through, p_provider_event_time), p_provider_event_time);
    UPDATE public.account_entitlements
       SET account_mode = 'paid', style_plan_id = NULL, package_id = 'all_inclusive', package_period = v_price.billing_period,
           subscription_status = 'active', entitlement_version = entitlement_version + 1, updated_at = now(),
           -- 20261021200000: the paid period (a payment inside the grace days ends them)
           paid_through = public.billing_period_end(greatest(coalesce(paid_through, p_provider_event_time), p_provider_event_time), v_price.billing_period),
           payment_failed_at = NULL,
           -- 20261021400000: the first payment sets the SMART PACK line from its attempt; a payment that ends the grace days keeps it
           -- 20261022100000 (Codex audit H03): only a payment of the SAME standing order (a retried renewal) keeps the line; a NEW
           -- attempt paid after a failed charge carries its own choice
           smart_pack_line = CASE WHEN subscription_status = 'past_due' AND NOT v_first THEN smart_pack_line ELSE (v_attempt.add_on_price_id IS NOT NULL) END,
           live_attempt_id = p_attempt_id,
           renewal_stopped_at = NULL -- 20261022300000: a new purchase clears the stop
     WHERE user_id = v_attempt.user_id
    RETURNING * INTO v_ent;
  END IF;
  -- 20261022300000 (Codex audit H-03): the period just paid, with its own charge (a pulled charge has no transaction id yet)
  INSERT INTO public.billing_paid_periods (user_id, attempt_id, event_id, charge_ref, period_start, period_end)
  VALUES (v_attempt.user_id, p_attempt_id, p_provider_event_id, CASE WHEN p_provider_event_id LIKE 'pull:%' THEN NULL ELSE p_provider_event_id END,
          v_pstart, v_ent.paid_through);
  -- one live package per account: every other still-unpaid payment link of this account expires (a later payment of one is
  -- 'rejected' by the recorder - visible, never a silent second subscription)
  UPDATE public.checkout_attempts SET state = 'expired'
   WHERE user_id = v_attempt.user_id AND state = 'pending' AND attempt_id <> p_attempt_id;
  RETURN v_r || jsonb_build_object('activated', true, 'packagePeriod', v_ent.package_period, 'entitlementVersion', v_ent.entitlement_version);
END $$;
REVOKE ALL ON FUNCTION public.record_verified_subscription_event_and_activate(text, text, text, uuid, timestamptz, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_subscription_event_and_activate(text, text, text, uuid, timestamptz, text, integer, text) TO service_role;
