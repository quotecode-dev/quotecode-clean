-- ============================================================================================================================
-- 20261027100000_smart_pack_removal.sql  -  SMART PACK removed by the subscriber (self-service): it stops renewing at the end of the
--                                           paid period; a yearly SMART PACK is refunded pro rata less the Terms section 6 fee
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-26 (typed: "מאשר הסרת חכם פלוס בשירות עצמי: בחודשי בסוף התקופה ששולמה בלי החזר, בשנתי לפי סעיף 6, כולל
--   שינוי ב-L-14, L-17 ו-L-22").
--   1. smart_pack_removals: one row per removal of the SMART PACK line of the live package (append of states; one open per account).
--   2. smart_pack_removal_quote: who may remove (an active package carrying the SMART PACK line, a bound standing order, its page
--      request id, a next charge after today, no open removal / add-on line in progress), the effective date (the paid-through
--      date) and, for a yearly SMART PACK, the refund: the SMART PACK price x the unused days from tomorrow / the days of the period,
--      less the section 6 fee (the lower of 5% of the SMART PACK price or 100 ILS), in whole shekels (IRON-ILS-001: the amount shown is
--      the amount refunded).
--   3. request_smart_pack_removal: the row 'requested' (BEFORE PayPlus is asked) + what the change needs (never the card or the
--      customer); smart_pack_removal_finish: only a standing order PayPlus changed makes the package attempt the package alone and
--      ends SMART PACK at the paid-through date (smart_pack_until); a refused change changes nothing; a lost answer stays 'requested'
--      and is tried again (smart_pack_removal_targets).
--   4. the yearly refund: due after the change, refunded by the Edge function on the period's charge, recorded once.
--   INERT until billing is 'enforced'. ROLLBACK (DB owner): roll subscription-authority back first; DROP the functions of this file.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.smart_pack_removals (
  removal_id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL,
  package_attempt_id uuid        NOT NULL REFERENCES public.checkout_attempts (attempt_id),
  idempotency_key    text        NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$'),
  period             text        NOT NULL CHECK (period IN ('month', 'year')),
  add_on_price_id    text        NOT NULL REFERENCES public.price_versions (price_id),
  effective_at       timestamptz NOT NULL,
  refund_minor       integer     NOT NULL DEFAULT 0 CHECK (refund_minor >= 0),
  charge_ref         text        NULL CHECK (charge_ref IS NULL OR length(charge_ref) BETWEEN 1 AND 200),
  state              text        NOT NULL DEFAULT 'requested' CHECK (state IN ('requested', 'removed', 'refused')),
  change_at          timestamptz NOT NULL DEFAULT now(),
  refund_state       text        NOT NULL DEFAULT 'none' CHECK (refund_state IN ('none', 'due', 'refunded')),
  refund_ref         text        NULL CHECK (refund_ref IS NULL OR length(refund_ref) BETWEEN 1 AND 200),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key),
  CHECK (period = 'year' OR refund_minor = 0)
);
CREATE INDEX IF NOT EXISTS smart_pack_removals_user ON public.smart_pack_removals (user_id, created_at DESC);
ALTER TABLE public.smart_pack_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.smart_pack_removals FROM PUBLIC, anon, authenticated, service_role;

-- 2. who may remove, when it takes effect, and the yearly refund ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.smart_pack_removal_quote(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_ent public.account_entitlements; v_att public.checkout_attempts; v_sp public.price_versions; v_pp public.billing_paid_periods;
  v_open public.smart_pack_removals; v_start timestamptz; v_days int; v_unused int; v_prorated int; v_fee int; v_today date; v_end date;
BEGIN
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
  IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN RETURN jsonb_build_object('ok', false, 'code', 'checkout_unavailable'); END IF;
  SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;
  IF v_ent.user_id IS NULL OR v_ent.account_mode <> 'paid' OR v_ent.live_attempt_id IS NULL OR v_ent.paid_through IS NULL OR v_ent.paid_through <= now() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  -- an open (or already done) removal of this package answers its own state - never a second one
  SELECT * INTO v_open FROM public.smart_pack_removals r WHERE r.user_id = p_user_id AND r.package_attempt_id = v_ent.live_attempt_id
     AND r.state IN ('requested', 'removed') ORDER BY r.created_at DESC LIMIT 1;
  IF v_open.removal_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', CASE v_open.state WHEN 'removed' THEN 'already_removed' ELSE 'retry_later' END, 'effectiveAt', v_open.effective_at);
  END IF;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_ent.live_attempt_id;
  IF NOT v_ent.smart_pack_line OR v_att.add_on_price_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'not_on_plan'); END IF;
  IF v_ent.subscription_status <> 'active' OR v_ent.renewal_stopped_at IS NOT NULL OR v_ent.payment_failed_at IS NOT NULL OR public.paid_account_limited(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  v_today := (now() AT TIME ZONE 'Asia/Jerusalem')::date;
  v_end := (v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem')::date;
  IF NOT EXISTS (SELECT 1 FROM public.provider_standing_orders s WHERE s.provider = 'payplus' AND s.attempt_id = v_att.attempt_id)
     OR v_att.provider_request_ref IS NULL OR v_end <= v_today THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_eligible');
  END IF;
  SELECT * INTO v_sp FROM public.price_versions p WHERE p.price_id = v_att.add_on_price_id;
  SELECT * INTO v_pp FROM public.billing_paid_periods p
   WHERE p.user_id = p_user_id AND p.attempt_id = v_att.attempt_id AND p.period_start <= now() AND p.period_end > now()
   ORDER BY (p.period_end = v_ent.paid_through) DESC, p.period_end DESC, p.period_id DESC LIMIT 1;
  IF v_sp.billing_period = 'year' THEN
    -- section 6: pro rata for the unused days from tomorrow, less the lower of 5% of the SMART PACK price or 100 ILS
    v_start := coalesce(v_pp.period_start, ((v_ent.paid_through AT TIME ZONE 'Asia/Jerusalem') - interval '1 year') AT TIME ZONE 'Asia/Jerusalem');
    v_days := greatest(1, v_end - (v_start AT TIME ZONE 'Asia/Jerusalem')::date);
    v_unused := least(v_days, greatest(0, v_end - (v_today + 1)));
    v_prorated := round(v_sp.amount_minor::numeric * v_unused / v_days)::int;
    v_fee := CASE WHEN v_prorated = 0 THEN 0 ELSE least(round(v_sp.amount_minor * 0.05)::int, 10000) END;
  END IF;
  RETURN jsonb_build_object('ok', true, 'period', v_sp.billing_period, 'currency', v_sp.currency, 'addOnPriceId', v_sp.price_id,
    'recurringMinor', v_sp.amount_minor, 'effectiveAt', v_ent.paid_through,
    'refundMinor', CASE WHEN v_sp.billing_period = 'year' THEN (round(greatest(0, v_prorated - v_fee) / 100.0) * 100)::int ELSE 0 END,
    'feeMinor', coalesce(v_fee, 0), 'chargeRef', v_pp.charge_ref, 'packageAttemptId', v_att.attempt_id);
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_quote(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_quote(uuid) TO service_role;

-- 3. the request (marked BEFORE PayPlus is asked) and the change ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_smart_pack_removal(p_user_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_q jsonb; v_row public.smart_pack_removals;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9_-]{16,128}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || p_user_id::text));
  SELECT * INTO v_row FROM public.smart_pack_removals WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key;
  IF NOT FOUND THEN
    -- a SMART PACK line still being added waits for its own answer first
    IF EXISTS (SELECT 1 FROM public.smart_pack_add_ons a WHERE a.user_id = p_user_id AND a.state = 'paid' AND (a.line_state IS NULL OR a.line_state = 'requested')) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'retry_later');
    END IF;
    v_q := public.smart_pack_removal_quote(p_user_id);
    IF (v_q ->> 'ok') IS DISTINCT FROM 'true' THEN RETURN v_q; END IF;
    INSERT INTO public.smart_pack_removals (user_id, package_attempt_id, idempotency_key, period, add_on_price_id, effective_at, refund_minor, charge_ref)
    VALUES (p_user_id, (v_q ->> 'packageAttemptId')::uuid, p_idempotency_key, v_q ->> 'period', v_q ->> 'addOnPriceId', (v_q ->> 'effectiveAt')::timestamptz,
            (v_q ->> 'refundMinor')::int, v_q ->> 'chargeRef')
    RETURNING * INTO v_row;
  END IF;
  RETURN jsonb_build_object('ok', true, 'removalId', v_row.removal_id, 'state', v_row.state, 'effectiveAt', v_row.effective_at, 'refundMinor', v_row.refund_minor);
END $$;
REVOKE ALL ON FUNCTION public.request_smart_pack_removal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_smart_pack_removal(uuid, text) TO service_role;

-- what the standing order change needs (the row must still be 'requested')
CREATE OR REPLACE FUNCTION public.smart_pack_removal_begin(p_removal_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_row public.smart_pack_removals; v_att public.checkout_attempts; v_rec public.provider_standing_orders; v_sp public.price_versions;
BEGIN
  SELECT * INTO v_row FROM public.smart_pack_removals r WHERE r.removal_id = p_removal_id;
  IF v_row.removal_id IS NULL OR v_row.state <> 'requested' THEN RETURN jsonb_build_object('ok', false, 'code', 'removal_not_open'); END IF;
  SELECT * INTO v_att FROM public.checkout_attempts c WHERE c.attempt_id = v_row.package_attempt_id;
  SELECT * INTO v_sp FROM public.price_versions p WHERE p.price_id = v_row.add_on_price_id;
  SELECT * INTO v_rec FROM public.provider_standing_orders s WHERE s.provider = 'payplus' AND s.attempt_id = v_row.package_attempt_id
   ORDER BY (s.terminal_ref IS NULL), s.created_at DESC LIMIT 1;
  RETURN jsonb_build_object('ok', true, 'removalId', p_removal_id, 'packageAttemptId', v_att.attempt_id, 'recurringRef', v_rec.recurring_ref,
    'terminalRef', v_rec.terminal_ref, 'packageRequestRef', v_att.provider_request_ref, 'currency', v_att.currency, 'period', v_row.period,
    'packageAmountMinor', v_att.amount_minor - v_sp.amount_minor, 'addOnAmountMinor', v_sp.amount_minor,
    'nextChargeDate', to_char((v_row.effective_at AT TIME ZONE 'Asia/Jerusalem')::date, 'YYYY-MM-DD'));
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_begin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_begin(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.smart_pack_removal_finish(p_removal_id uuid, p_removed boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_user uuid; v_row public.smart_pack_removals; v_sp public.price_versions;
BEGIN
  IF p_removal_id IS NULL OR p_removed IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  SELECT r.user_id INTO v_user FROM public.smart_pack_removals r WHERE r.removal_id = p_removal_id;
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
  SELECT * INTO v_row FROM public.smart_pack_removals r WHERE r.removal_id = p_removal_id FOR UPDATE;
  IF v_row.state <> 'requested' THEN RETURN jsonb_build_object('ok', true, 'changed', false, 'state', v_row.state); END IF;
  IF NOT p_removed THEN
    UPDATE public.smart_pack_removals SET state = 'refused', change_at = now() WHERE removal_id = p_removal_id;
    RETURN jsonb_build_object('ok', true, 'changed', true, 'state', 'refused');
  END IF;
  SELECT * INTO v_sp FROM public.price_versions p WHERE p.price_id = v_row.add_on_price_id;
  -- the live attempt is the package alone again (the next renewal passes the unchanged amount check); SMART PACK runs to the paid end
  UPDATE public.checkout_attempts SET amount_minor = amount_minor - v_sp.amount_minor, add_on_price_id = NULL
   WHERE attempt_id = v_row.package_attempt_id AND add_on_price_id = v_row.add_on_price_id;
  UPDATE public.account_entitlements SET smart_pack_line = false, smart_pack_until = v_row.effective_at, updated_at = now()
   WHERE user_id = v_user AND live_attempt_id = v_row.package_attempt_id;
  UPDATE public.smart_pack_removals SET state = 'removed', change_at = now(),
         refund_state = CASE WHEN refund_minor > 0 AND charge_ref IS NOT NULL THEN 'due' ELSE 'none' END
   WHERE removal_id = p_removal_id;
  RETURN jsonb_build_object('ok', true, 'changed', true, 'state', 'removed');
END $$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_finish(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_finish(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.smart_pack_removal_targets(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce(jsonb_agg(t.removal_id), '[]'::jsonb) FROM (
    SELECT r.removal_id FROM public.smart_pack_removals r
     WHERE r.user_id = p_user_id AND r.state = 'requested' AND r.change_at <= now() - interval '2 minutes'
     ORDER BY r.created_at DESC LIMIT 3) t;
$$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_targets(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_targets(uuid) TO service_role;

-- 4. the yearly refund -----------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.smart_pack_removal_refunds_due(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('removalId', r.removal_id, 'chargeRef', r.charge_ref, 'amountMinor', r.refund_minor)), '[]'::jsonb)
    FROM public.smart_pack_removals r WHERE r.user_id = p_user_id AND r.refund_state = 'due';
$$;
REVOKE ALL ON FUNCTION public.smart_pack_removal_refunds_due(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.smart_pack_removal_refunds_due(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.record_smart_pack_removal_refund(p_removal_id uuid, p_refund_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_removal_id IS NULL OR p_refund_ref IS NULL OR length(p_refund_ref) NOT BETWEEN 1 AND 200 THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_request'); END IF;
  UPDATE public.smart_pack_removals SET refund_state = 'refunded', refund_ref = p_refund_ref WHERE removal_id = p_removal_id AND refund_state = 'due';
  RETURN jsonb_build_object('ok', FOUND);
END $$;
REVOKE ALL ON FUNCTION public.record_smart_pack_removal_refund(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_smart_pack_removal_refund(uuid, text) TO service_role;
