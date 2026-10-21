-- ============================================================================================================================
-- 20261022000000_payplus_standing_order_link.sql  -  a PayPlus standing order is bound to the server attempt of its first payment,
--                                                     so a renewal / failed renewal is recognised by the standing-order id
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner night task 2026-10-21 ("תעשה את כל מה שאתה יכול ... כדי שמחר בבוקר ישארו רק הדברים שאני צריך לעשות"). The PayPlus
--   documentation (docs.payplus.co.il, transaction callback) carries transaction.recurring_charge_information.recurring_uid on a
--   standing-order charge; it does NOT promise that a later charge repeats the payment page's more_info (our attempt id). Until
--   now a renewal without more_info was refused (invalid_event) and the account would fall into the grace days / limited mode.
--
--   1. provider_standing_orders (append-only, no truncate): (provider, recurring_ref) -> attempt_id, bound ONCE by a verified ACTIVATING
--      payment (the first one or a renewal) whose callback carries BOTH our attempt id (more_info, signed) and the standing-order id.
--      A standing order never moves to another attempt; one attempt may gain a second standing order (e.g. PayPlus re-creates it after
--      a card update - its first charge still carries our attempt id). No client or role reads it.
--   2. record_verified_provider_event: the Edge recorder entry. Our attempt id when the callback carries it, otherwise the bound
--      attempt of the standing order; a callback whose two ids disagree with the binding is refused (invalid_event); a standing-order
--      id is PayPlus-only. It calls the unchanged record_verified_subscription_event_and_activate and binds after an activating payment.
--   INERT: billing is 'off' in code (subscription-authority ACTIVATION_PHASE) and in the DB; the recorder refuses with billing_off
--   before anything is written, so no binding can be created either.
--   ROLLBACK (DB owner): DROP FUNCTION public.record_verified_provider_event(text, text, text, uuid, text, text, timestamptz, text,
--   integer, text); DROP TABLE public.provider_standing_orders (empty while billing is off). The Edge function of this release
--   calls the new entry - roll the function back first.
-- ============================================================================================================================

CREATE TABLE IF NOT EXISTS public.provider_standing_orders (
  provider       text        NOT NULL CHECK (provider IN ('payplus')),
  recurring_ref  text        NOT NULL CHECK (length(recurring_ref) BETWEEN 1 AND 200),
  attempt_id     uuid        NOT NULL REFERENCES public.checkout_attempts (attempt_id),
  terminal_ref   text        NULL CHECK (terminal_ref IS NULL OR length(terminal_ref) BETWEEN 1 AND 200),
  first_event_id text        NOT NULL CHECK (length(first_event_id) BETWEEN 1 AND 200),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, recurring_ref)
);
CREATE INDEX IF NOT EXISTS provider_standing_orders_attempt ON public.provider_standing_orders (attempt_id);
ALTER TABLE public.provider_standing_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_standing_orders FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS provider_standing_orders_append_only ON public.provider_standing_orders;
CREATE TRIGGER provider_standing_orders_append_only BEFORE UPDATE OR DELETE ON public.provider_standing_orders
  FOR EACH ROW EXECUTE FUNCTION public.append_only_guard();
DROP TRIGGER IF EXISTS provider_standing_orders_no_truncate ON public.provider_standing_orders;
CREATE TRIGGER provider_standing_orders_no_truncate BEFORE TRUNCATE ON public.provider_standing_orders
  FOR EACH STATEMENT EXECUTE FUNCTION public.append_only_guard();

CREATE OR REPLACE FUNCTION public.record_verified_provider_event(p_provider text, p_provider_event_id text, p_event_type text,
  p_attempt_id uuid, p_recurring_ref text, p_terminal_ref text, p_provider_event_time timestamptz, p_payload_sha256 text,
  p_paid_amount_minor integer DEFAULT NULL, p_paid_currency text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_attempt uuid := p_attempt_id; v_bound uuid; v_r jsonb;
BEGIN
  IF (p_recurring_ref IS NOT NULL AND length(p_recurring_ref) NOT BETWEEN 1 AND 200)
     OR (p_terminal_ref IS NOT NULL AND length(p_terminal_ref) NOT BETWEEN 1 AND 200)
     OR (p_attempt_id IS NULL AND p_recurring_ref IS NULL)
     OR (p_recurring_ref IS NOT NULL AND p_provider IS DISTINCT FROM 'payplus') THEN
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
  v_r := public.record_verified_subscription_event_and_activate(p_provider, p_provider_event_id, p_event_type, v_attempt,
           p_provider_event_time, p_payload_sha256, p_paid_amount_minor, p_paid_currency);
  -- bind once: an activating payment of the attempt (first or renewal) whose signed callback carried our attempt id AND the standing-order id
  IF (v_r ->> 'activated') = 'true' AND p_attempt_id IS NOT NULL AND p_recurring_ref IS NOT NULL AND v_bound IS NULL THEN
    INSERT INTO public.provider_standing_orders (provider, recurring_ref, attempt_id, terminal_ref, first_event_id)
    VALUES (p_provider, p_recurring_ref, p_attempt_id, p_terminal_ref, p_provider_event_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_r;
END $$;
REVOKE ALL ON FUNCTION public.record_verified_provider_event(text, text, text, uuid, text, text, timestamptz, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_provider_event(text, text, text, uuid, text, text, timestamptz, text, integer, text) TO service_role;
