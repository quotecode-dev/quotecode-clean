-- tekango-migration-contract: mode=transaction replay=required
-- Owner console 2026-10-26 (typed: "מאשר תיקון יצירת הוראת הקבע כך שהחיוב הראשון שלה יהיה רק אחרי תקופה מלאה, התראה על חיוב בתוך תקופה
-- ששולמה, ושאלה לשירות הלקוחות של פייפלוס"). The first live purchase (25/10) was charged twice: the page charged the first payment and
-- PayPlus charged the standing order again the first night (the order started on the payment date). The creation is fixed in the Edge
-- function (the first standing-order charge after a whole period); here a second charge of a period that is already paid - recorded
-- 'stale' until now, so nobody saw it - is recorded 'rejected': billing_reconcile_source counts only charges that are not 'rejected',
-- so the daily reconciliation reports it as UNLINKED (money at PayPlus with no entitlement) on the admin screen and in the Owner's email.
-- Only that one outcome changes; everything else in the function is byte-identical to 20261025300000.

CREATE OR REPLACE FUNCTION public.record_verified_provider_event(p_provider text, p_provider_event_id text, p_event_type text,
  p_attempt_id uuid, p_recurring_ref text, p_terminal_ref text, p_provider_event_time timestamptz, p_payload_sha256 text,
  p_paid_amount_minor integer DEFAULT NULL, p_paid_currency text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_attempt uuid := p_attempt_id; v_bound uuid; v_r jsonb; v_pulled_at timestamptz; v_phase text; v_user uuid; v_row public.checkout_attempts;
  v_again boolean; v_addon_id uuid; v_base integer;
BEGIN
  IF (p_recurring_ref IS NOT NULL AND length(p_recurring_ref) NOT BETWEEN 1 AND 200)
     OR (p_terminal_ref IS NOT NULL AND length(p_terminal_ref) NOT BETWEEN 1 AND 200)
     OR (p_attempt_id IS NULL AND p_recurring_ref IS NULL)
     OR (p_recurring_ref IS NOT NULL AND p_provider IS DISTINCT FROM 'payplus')
     -- 20261022100000 (Codex audit M03): a provider time more than a day in the future is refused (never a paid period for years)
     OR p_provider_event_time > now() + interval '1 day'
     -- 20261022200000: 'pull:...' is the server's own pull event id, never a callback's
     OR p_provider_event_id LIKE 'pull:%' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
  END IF;
  IF p_recurring_ref IS NOT NULL THEN
    SELECT s.attempt_id INTO v_bound FROM public.provider_standing_orders s
     WHERE s.provider = p_provider AND s.recurring_ref = p_recurring_ref;
  END IF;
  IF v_attempt IS NULL THEN
    IF v_bound IS NULL THEN
      -- billing off answers billing_off first (nothing is written either way)
      IF (SELECT phase FROM public.billing_activation WHERE id) = 'off' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
      END IF;
      RETURN jsonb_build_object('ok', false, 'code', 'unknown_attempt');
    END IF;
    v_attempt := v_bound;
  ELSIF v_bound IS NOT NULL AND v_bound <> v_attempt THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_event'); -- a standing order never moves to another attempt
  END IF;
  -- 20261022200000: the first charge the server already PULLED (record_checkout_pull) is the same payment as its later callback -
  -- recorded 'stale', never a second period. A renewal comes a whole cycle (28+ days) later: a confirmed charge within 7 days of the
  -- pull, before any other COUNTED charge of the attempt, with the attempt's amount / currency, is the first one (a second one within the
  -- window extends nothing either, but is reported). The account lock is taken BEFORE this check (the same
  -- lock as the pull and the activation), so a pull committing at the same instant is always seen.
  SELECT * INTO v_row FROM public.checkout_attempts c WHERE c.attempt_id = v_attempt;
  v_user := v_row.user_id;
  IF v_user IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('tekango-package-activation:' || v_user::text));
  END IF;
  -- 20261025300000: a renewal of package + SMART PACK while the SMART PACK line is still 'requested' (PayPlus changed the standing
  -- order but its answer was lost, or the function stopped before recording it): the line is finished first, so the renewal passes the
  -- unchanged amount check and SMART PACK stays (smart_pack_line)
  IF p_event_type = 'payment_confirmed' AND v_row.attempt_id IS NOT NULL AND v_row.add_on_price_id IS NULL
     AND p_paid_amount_minor IS DISTINCT FROM v_row.amount_minor
     AND (SELECT phase FROM public.billing_activation WHERE id) IN ('prepared', 'enforced') THEN
    SELECT a.add_on_id INTO v_addon_id FROM public.smart_pack_add_ons a JOIN public.price_versions p ON p.price_id = a.price_id
     WHERE a.package_attempt_id = v_attempt AND a.line_state = 'requested'
       AND p_paid_amount_minor = v_row.amount_minor + p.amount_minor AND p_paid_currency IS NOT DISTINCT FROM v_row.currency
     ORDER BY a.line_at DESC LIMIT 1;
    IF v_addon_id IS NOT NULL THEN
      PERFORM public.smart_pack_add_on_line_finish(v_addon_id, true);
      SELECT * INTO v_row FROM public.checkout_attempts c WHERE c.attempt_id = v_attempt;
    END IF;
  END IF;
  IF p_event_type = 'payment_confirmed' THEN
    SELECT e.provider_event_time INTO v_pulled_at FROM public.subscription_events e
     WHERE e.provider = p_provider AND e.provider_event_id = 'pull:' || v_attempt::text AND e.outcome = 'applied';
    -- 20261025300000: the first charge paid the package only when the SMART PACK line was added after the pull
    v_base := v_row.amount_minor - coalesce((SELECT p.amount_minor FROM public.smart_pack_add_ons a JOIN public.price_versions p ON p.price_id = a.price_id
                                              WHERE a.package_attempt_id = v_attempt AND a.line_state = 'added' AND a.line_at > v_pulled_at
                                              ORDER BY a.line_at DESC LIMIT 1), 0);
    IF v_pulled_at IS NOT NULL AND p_provider_event_time < v_pulled_at + interval '7 days'
       AND (p_paid_amount_minor IS NOT DISTINCT FROM v_row.amount_minor OR p_paid_amount_minor IS NOT DISTINCT FROM v_base) AND p_paid_currency IS NOT DISTINCT FROM v_row.currency
       AND NOT EXISTS (SELECT 1 FROM public.subscription_events e
                        WHERE e.provider = p_provider AND e.attempt_id = v_attempt AND e.event_type = 'payment_confirmed'
                          AND e.provider_event_id <> 'pull:' || v_attempt::text AND e.outcome = 'applied') THEN
      v_again := EXISTS (SELECT 1 FROM public.subscription_events e
                          WHERE e.provider = p_provider AND e.attempt_id = v_attempt AND e.event_type = 'payment_confirmed'
                            AND e.provider_event_id <> 'pull:' || v_attempt::text AND e.provider_event_id <> p_provider_event_id
                            AND e.outcome = 'stale');
      SELECT phase INTO v_phase FROM public.billing_activation WHERE id;
      IF v_phase IS DISTINCT FROM 'prepared' AND v_phase IS DISTINCT FROM 'enforced' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'billing_off');
      END IF;
      IF p_provider_event_time IS NULL OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[0-9a-f]{64}$' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'invalid_event');
      END IF;
      INSERT INTO public.subscription_events (provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256, verified, outcome)
      -- Owner console 2026-10-26: a SECOND charge after the pulled first one is money with no entitlement - recorded 'rejected', so the
      -- daily reconciliation reports it (UNLINKED: the admin screen + the Owner's email) and it is refunded; the first one's own callback stays 'stale'
      VALUES (p_provider, p_provider_event_id, p_event_type, v_attempt, p_provider_event_time, p_payload_sha256, true, CASE WHEN v_again THEN 'rejected' ELSE 'stale' END)
      ON CONFLICT (provider, provider_event_id) DO NOTHING;
      IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;
      -- the callback's standing-order id joins the attempt only when the pull activated it (the pull bound its own id then)
      IF p_attempt_id IS NOT NULL AND p_recurring_ref IS NOT NULL AND v_bound IS NULL
         AND EXISTS (SELECT 1 FROM public.provider_standing_orders s
                      WHERE s.provider = p_provider AND s.attempt_id = v_attempt AND s.first_event_id = 'pull:' || v_attempt::text) THEN
        INSERT INTO public.provider_standing_orders (provider, recurring_ref, attempt_id, terminal_ref, first_event_id)
        VALUES (p_provider, p_recurring_ref, v_attempt, p_terminal_ref, p_provider_event_id)
        ON CONFLICT DO NOTHING;
      END IF;
      RETURN jsonb_build_object('ok', true, 'duplicate', false, 'outcome', CASE WHEN v_again THEN 'rejected' ELSE 'stale' END, 'activated', false,
                                'code', CASE WHEN v_again THEN 'second_charge_after_pull' ELSE 'first_charge_pulled' END);
    END IF;
  END IF;
  v_r := public.record_verified_subscription_event_and_activate(p_provider, p_provider_event_id, p_event_type, v_attempt,
           p_provider_event_time, p_payload_sha256, p_paid_amount_minor, p_paid_currency);
  -- bind once: an activating payment of the attempt (first or renewal) whose signed callback carried our attempt id AND the standing-order id;
  -- Codex audit 2026-10-22 H-04: also a payment of an attempt that is no longer payable - its standing order stays traceable (a later
  -- charge of it reaches the same attempt and is reported again, never a package)
  IF ((v_r ->> 'activated') = 'true' OR (v_r ->> 'code') = 'attempt_not_payable') AND p_attempt_id IS NOT NULL AND p_recurring_ref IS NOT NULL AND v_bound IS NULL THEN
    INSERT INTO public.provider_standing_orders (provider, recurring_ref, attempt_id, terminal_ref, first_event_id)
    VALUES (p_provider, p_recurring_ref, p_attempt_id, p_terminal_ref, p_provider_event_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_r;
END $$;
REVOKE ALL ON FUNCTION public.record_verified_provider_event(text, text, text, uuid, text, text, timestamptz, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_provider_event(text, text, text, uuid, text, text, timestamptz, text, integer, text) TO service_role;
