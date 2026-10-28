-- ============================================================================================================================
-- 20261029100000_codex_review_fixes_2.sql  -  the database part of the fixes for Codex's review of PR #113 (N01, N02, N03, N04)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01, L-09, L-11, L-14, L-15, L-17, L-22, L-23, L-25 לפי התוכנית לתיקון 17 ממצאי
--   קודקס על בקשת מיזוג 113, כולל ארבע ההחלטות שהוצעו"); docs/CODEX_REVIEW_CODEXFIX_2026-10-28.md.
--   1. N01: site_articles.revision - a publication and a rewrite are each ONE conditional write on (status, revision), so the text published
--      is exactly the revision the Owner approved. Existing drafts take the revision their publish action already carries.
--   2. N02: billing_admin_preview - the paid basis takes off only a SMART PACK line added after the period start that is still on the attempt.
--   3. N04: smart_pack_removal_quote - only a removal of the current line blocks; a SMART PACK bought again can be removed again.
--   4. N03 (Owner decision 1): settle_smart_pack_removal_refund - the Owner confirms (password, through admin-billing) that an owed removal
--      refund was made in PayPlus, with its PayPlus transaction number; the debt closes for good and the reconciliation knows the refund.
-- Rollback of THIS file (DB owner): roll admin-billing / agents-room back first; re-run 20261025300000 section 6 and 20261027100000
--   section 2; DROP FUNCTION public.settle_smart_pack_removal_refund(uuid, uuid, text). The revision column may stay (unused by old code).
-- ============================================================================================================================

-- 1. the article revision -------------------------------------------------------------------------------------------------------
ALTER TABLE public.site_articles ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);
UPDATE public.site_articles s SET revision = coalesce((
    SELECT (a.payload ->> 'revision')::int FROM public.agent_actions a
     WHERE a.action_type = 'article_publish' AND a.payload ->> 'articleId' = s.id::text AND (a.payload ->> 'revision') ~ '^[0-9]+$'
     ORDER BY a.created_at DESC LIMIT 1), 0)
 WHERE s.status = 'draft';

-- 2. the admin early-end preview (body 20261025300000 section 6 + the marked change) -----------------------------------------------
CREATE OR REPLACE FUNCTION public.billing_admin_preview(p_user_id uuid, p_waive_fee boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_phase text; v_ent public.account_entitlements; v_att public.checkout_attempts; v_period text;
  v_rec public.provider_standing_orders; v_charge text; v_start timestamptz; v_end timestamptz;
  v_days int; v_unused int; v_prorated int; v_fee int; v_refund int; v_pp public.billing_paid_periods; v_pend timestamptz; v_future boolean;
  v_paid int;
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
  -- 20261025300000: the charge of a period that started before the SMART PACK line was added was the package amount only (the
  -- SMART PACK part of that period was its own one-time charge)
  -- 20261029100000 (Codex N02): only a line added after the start that is STILL on the attempt is taken off - a line added and then
  -- removed already left the attempt amount, so taking it off again made the basis too low
  v_paid := v_att.amount_minor - coalesce((SELECT sum(p.amount_minor) FROM public.smart_pack_add_ons a JOIN public.price_versions p ON p.price_id = a.price_id
                                            WHERE a.package_attempt_id = v_att.attempt_id AND a.line_state = 'added' AND a.line_at > v_start
                                              AND NOT EXISTS (SELECT 1 FROM public.smart_pack_removals r WHERE r.package_attempt_id = v_att.attempt_id
                                                                AND r.state = 'removed' AND r.change_at > a.line_at)), 0);
  v_end := (date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') + interval '1 day') AT TIME ZONE 'Asia/Jerusalem';
  v_days := greatest(1, (v_pend AT TIME ZONE 'Asia/Jerusalem')::date - (v_start AT TIME ZONE 'Asia/Jerusalem')::date);
  v_unused := greatest(0, (v_pend AT TIME ZONE 'Asia/Jerusalem')::date - (v_end AT TIME ZONE 'Asia/Jerusalem')::date);
  v_unused := least(v_unused, v_days);
  v_prorated := round(v_paid::numeric * v_unused / v_days)::int;
  v_fee := CASE WHEN p_waive_fee OR v_prorated = 0 THEN 0
                WHEN v_att.currency = 'ILS' THEN least(round(v_paid * 0.05)::int, 10000)
                ELSE 0 END; -- Codex audit M-02: no USD fee until an approved rule
  v_refund := greatest(0, v_prorated - v_fee);
  RETURN jsonb_build_object('ok', true, 'attemptId', v_att.attempt_id, 'currency', v_att.currency, 'paidMinor', v_paid,
    'period', v_period, 'periodStart', v_start, 'periodEnd', v_pend, 'paidThrough', v_ent.paid_through, 'effectiveEnd', v_end,
    'hasFuturePeriod', v_future,
    'daysInPeriod', v_days, 'unusedDays', v_unused, 'proratedMinor', v_prorated, 'feeMinor', v_fee, 'feeWaived', p_waive_fee,
    'refundMinor', v_refund, 'renewalStopped', v_ent.renewal_stopped_at IS NOT NULL,
    'hasStandingOrder', v_rec.recurring_ref IS NOT NULL, 'hasChargeRef', v_charge IS NOT NULL,
    'recurringRef', v_rec.recurring_ref, 'terminalRef', v_rec.terminal_ref, 'chargeRef', v_charge);
END $$;
REVOKE ALL ON FUNCTION public.billing_admin_preview(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_admin_preview(uuid, boolean) TO service_role;

-- 3. who may remove SMART PACK (body 20261027100000 section 2 + the marked change) ------------------------------------------------
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
  -- 20261029100000 (Codex N04): only a removal of the CURRENT line counts - a SMART PACK bought again after a removal can be removed again
  SELECT * INTO v_open FROM public.smart_pack_removals r WHERE r.user_id = p_user_id AND r.package_attempt_id = v_ent.live_attempt_id
     AND r.state IN ('requested', 'removed')
     AND r.created_at > coalesce((SELECT max(a.line_at) FROM public.smart_pack_add_ons a WHERE a.package_attempt_id = v_ent.live_attempt_id
                                    AND a.line_state = 'added'), '-infinity'::timestamptz)
   ORDER BY r.created_at DESC LIMIT 1;
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

-- 4. the Owner confirms an owed removal refund was made in PayPlus ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_smart_pack_removal_refund(p_removal_id uuid, p_user_id uuid, p_refund_ref text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_row public.smart_pack_removals;
BEGIN
  IF p_removal_id IS NULL OR p_user_id IS NULL OR p_refund_ref IS NULL OR length(btrim(p_refund_ref)) NOT BETWEEN 3 AND 200 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;
  UPDATE public.smart_pack_removals SET refund_state = 'refunded', refund_ref = btrim(p_refund_ref), refund_claimed_at = coalesce(refund_claimed_at, now())
   WHERE removal_id = p_removal_id AND user_id = p_user_id AND state = 'removed' AND refund_minor > 0 AND refund_state IN ('due', 'sending', 'unknown')
  RETURNING * INTO v_row;
  IF v_row.removal_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'no_unsettled_refund'); END IF;
  RETURN jsonb_build_object('ok', true, 'removalId', v_row.removal_id, 'refundMinor', v_row.refund_minor);
END $$;
REVOKE ALL ON FUNCTION public.settle_smart_pack_removal_refund(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_smart_pack_removal_refund(uuid, uuid, text) TO service_role;
