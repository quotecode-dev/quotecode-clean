-- The Owner's stop-renewal / early-end tools (migration 20261022300000; Owner console 2026-10-21). Disposable postgres:17 harness ONLY.
-- Proves: billing off = nothing; only a live package is eligible (not free, not LIFETIME); the refund = round(paid x unused Israel days /
-- days of the period) - 5% fee (waivable), from the end of today, of the charge that paid the period; a stale preview, a non-super-admin
-- actor and a second action while one is open (no time limit) are refused; the end is recorded only after PayPlus stopped the standing
-- order and only for the package computed - and ONLY THEN is a refund due (once, of the exact amount); a renewal landing between begin
-- and finish = no refund, but the renewal stays stopped; a stopped renewal has NO grace days, is limited the moment its access ends and
-- carries that end in graceEndsAt (the summary contract); a renewal charge after the stop extends nothing (renewal_stopped) and never
-- becomes the refunded charge; an early end keeps access to midnight; a stopped renewal may still be ended early, never twice; an
-- interrupted action is resolved by the Owner; a new purchase clears the stop; the days count from the real start of the period;
-- append-only; service role only.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (now() is the same instant throughout).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.bu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4080000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.bsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.bintent(p_user uuid, p_key text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.bsvc(); r := public.create_package_checkout_intent(p_user, 'month', p_key, false); PERFORM tst.logout();
  RETURN (r ->> 'attemptId')::uuid; END $$;
CREATE OR REPLACE FUNCTION tst.bpay(p_event text, p_attempt uuid, p_ref text, p_at timestamptz) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.bsvc();
  r := public.record_verified_provider_event('payplus', p_event, 'payment_confirmed', p_attempt, p_ref, CASE WHEN p_ref IS NULL THEN NULL ELSE 'term-408' END,
         p_at, repeat('e', 64), 3000, 'ILS');
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.bprev(p_user uuid, p_waive boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.bsvc(); r := public.billing_admin_preview(p_user, p_waive); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.bbegin(p_actor uuid, p_user uuid, p_kind text, p_waive boolean, p_expected int) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.bsvc(); r := public.billing_admin_begin(p_actor, p_user, p_kind, p_waive, p_expected, 'customer asked (synthetic)'); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.bfinish(p_action uuid, p_cancel text, p_owner boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.bsvc(); r := public.billing_admin_finish(p_action, p_cancel, p_owner); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.brefund(p_action uuid, p_status text, p_ref text, p_minor int) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.bsvc(); r := public.billing_admin_record_refund(p_action, p_status, p_ref, p_minor); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.bsending(p_action uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.bsvc(); r := public.billing_admin_refund_sending(p_action); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.bowed(p_user uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.bsvc(); r := public.billing_admin_unsettled_refund(p_user); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.bsettle(p_action uuid, p_actor uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.bsvc(); r := public.billing_admin_settle_refund(p_action, p_actor); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.bopen(p_user uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.bsvc(); r := public.billing_admin_open_action(p_user); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.bstate(p_user uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.account_billing_state(p_user) $$;
CREATE OR REPLACE FUNCTION tst.bpaid(p_user uuid) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT paid_through FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.bstopped(p_user uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT renewal_stopped_at IS NOT NULL FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.bdev(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  EXECUTE p_sql;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;
-- the expected amounts, written out independently: Israel calendar days of the period, unused days from the end of today
CREATE OR REPLACE FUNCTION tst.bexpect(p_pt timestamptz, p_waive boolean) RETURNS int LANGUAGE sql AS $$
  WITH d AS (SELECT (p_pt AT TIME ZONE 'Asia/Jerusalem')::date AS e,
                    ((p_pt AT TIME ZONE 'Asia/Jerusalem') - interval '1 month')::date AS s,
                    (now() AT TIME ZONE 'Asia/Jerusalem')::date + 1 AS t)
  SELECT greatest(0, round(3000::numeric * greatest(0, e - t) / (e - s))::int - CASE WHEN p_waive THEN 0 ELSE 150 END) FROM d $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- 1-6 customers | 9 the super admin (the actor) | 8 a LIFETIME account
INSERT INTO auth.users (id, email) SELECT tst.bu(n), format('b408-%s@synthetic.test', n) FROM generate_series(1, 9) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.bu(n), format('b408-%s@synthetic.test', n), format('Synthetic billing admin %s', n), 'Local', 'ILS', 'free',
         CASE WHEN n = 9 THEN 'super_admin' ELSE 'user' END, n = 8
    FROM generate_series(1, 9) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.bu(n), 'IL', 'business_settings_country' FROM generate_series(1, 9) n;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.bu(n), 'free_10', NULL, 0 FROM generate_series(1, 9) n;

-- ---------------------------------------------------------------------------------------------------------------- billing off
SELECT tst.ok(tst.bprev(tst.bu(1)) ->> 'code' = 'billing_off'
              AND tst.bbegin(tst.bu(9), tst.bu(1), 'stop_renewal', false, 0) ->> 'code' = 'billing_off'
              AND NOT EXISTS (SELECT 1 FROM public.billing_admin_actions),
  'B0 billing off (today): no preview, no action, nothing written');

UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;

-- paid packages: 1..4 with a standing order (callback carries our attempt id + the standing-order id); 5 without one
DO $$
DECLARE n int; a uuid;
BEGIN
  FOR n IN 1..5 LOOP
    a := tst.bintent(tst.bu(n), format('billing-admin-408-user-%s', n));
    PERFORM tst.bpay(format('tx-408-%s', n), a, CASE WHEN n = 5 THEN NULL ELSE format('rec-408-%s', n) END, now() - interval '5 days');
  END LOOP;
  PERFORM tst.ok((SELECT count(*) = 1 AND min(charge_ref) = 'tx-408-1' AND min(period_start) = now() - interval '5 days'
                    AND min(period_end) = public.billing_period_end(now() - interval '5 days', 'month')
                   FROM public.billing_paid_periods WHERE user_id = tst.bu(1)),
    'B1a the recorder writes the paid period with the charge that paid it and its real start / end (Codex audit H-03)');
  -- a known paid period (the DB owner's device): it ends 10 Israel days after the end of today and started one month before that
  PERFORM tst.bdev(format('DELETE FROM public.billing_paid_periods WHERE user_id IN (%L, %L, %L, %L, %L)', tst.bu(1), tst.bu(2), tst.bu(3), tst.bu(4), tst.bu(5)));
  FOR n IN 1..5 LOOP
    PERFORM tst.bdev(format('UPDATE public.account_entitlements SET paid_through = ((date_trunc(%L, now() AT TIME ZONE %L) + interval %L + interval %L) AT TIME ZONE %L) WHERE user_id = %L',
      'day', 'Asia/Jerusalem', '11 days', '9 hours', 'Asia/Jerusalem', tst.bu(n)));
    INSERT INTO public.billing_paid_periods (user_id, attempt_id, event_id, charge_ref, period_start, period_end)
    SELECT e.user_id, e.live_attempt_id, format('tx-408-%s', n), format('tx-408-%s', n),
           ((e.paid_through AT TIME ZONE 'Asia/Jerusalem') - interval '1 month') AT TIME ZONE 'Asia/Jerusalem', e.paid_through
      FROM public.account_entitlements e WHERE e.user_id = tst.bu(n);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------------------------- preview
SELECT tst.ok(tst.bprev(tst.bu(6)) ->> 'code' = 'no_live_package' AND tst.bprev(tst.bu(8)) ->> 'code' = 'lifetime_account',
  'B1 a free account has no package to stop; a LIFETIME account is never touched');
DO $$
DECLARE p jsonb; w jsonb;
BEGIN
  p := tst.bprev(tst.bu(1));
  PERFORM tst.ok(p ->> 'ok' = 'true' AND (p ->> 'paidMinor')::int = 3000 AND p ->> 'currency' = 'ILS' AND (p ->> 'unusedDays')::int = 10
                 AND (p ->> 'feeMinor')::int = 150 AND (p ->> 'refundMinor')::int = tst.bexpect(tst.bpaid(tst.bu(1)), false)
                 AND (p ->> 'hasStandingOrder')::boolean AND p ->> 'chargeRef' = 'tx-408-1' AND p ->> 'recurringRef' = 'rec-408-1',
    format('B2 preview: 10 unused days from the end of today, 5%% fee (150 agorot), refund %s; the standing order and the charge are known', p ->> 'refundMinor'));
  w := tst.bprev(tst.bu(1), true);
  PERFORM tst.ok((w ->> 'feeMinor')::int = 0 AND (w ->> 'refundMinor')::int = (p ->> 'proratedMinor')::int,
    'B2b the fee waived (e.g. a fault on our side): the whole unused share is refunded');
  PERFORM tst.ok((p ->> 'effectiveEnd')::timestamptz = (date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') + interval '1 day') AT TIME ZONE 'Asia/Jerusalem',
    'B2c the early end is the end of today (midnight, Israel)');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- refusals
SELECT tst.ok(tst.bbegin(tst.bu(2), tst.bu(1), 'stop_renewal', false, 0) ->> 'code' = 'forbidden', 'B3 only a super admin may act');
SELECT tst.ok(tst.bbegin(tst.bu(9), tst.bu(1), 'end_early', false, 1) ->> 'code' = 'stale_preview'
              AND NOT EXISTS (SELECT 1 FROM public.billing_admin_actions),
  'B3b an expected refund that differs from the server (a stale preview) is refused, nothing written');
SELECT tst.ok(tst.bbegin(tst.bu(9), tst.bu(5), 'stop_renewal', false, 0) ->> 'code' = 'no_standing_order',
  'B3c no known standing order: refused (stop it in the PayPlus panel)');

-- ---------------------------------------------------------------------------------------------------------------- stop the renewal
DO $$
DECLARE b jsonb; f jsonb; pt timestamptz; r jsonb;
BEGIN
  pt := tst.bpaid(tst.bu(1));
  b := tst.bbegin(tst.bu(9), tst.bu(1), 'stop_renewal', false, 0);
  PERFORM tst.ok(b ->> 'ok' = 'true' AND b ->> 'recurringRef' = 'rec-408-1' AND b ->> 'terminalRef' = 'term-408' AND (b ->> 'refundMinor')::int = 0,
    'B4 begin: the action is recorded with the standing order and terminal to stop');
  PERFORM tst.ok(tst.bbegin(tst.bu(9), tst.bu(1), 'stop_renewal', false, 0) ->> 'code' = 'action_in_progress', 'B4b a second action meanwhile is refused');
  f := tst.bfinish((b ->> 'actionId')::uuid, 'cancelled');
  PERFORM tst.ok(f ->> 'applied' = 'true' AND f ->> 'refundDue' = 'false' AND tst.bpaid(tst.bu(1)) = pt AND tst.bstopped(tst.bu(1)),
    'B5 PayPlus stopped it: the renewal is stopped, the paid period is untouched, no refund is due');
  PERFORM tst.ok(tst.brefund((b ->> 'actionId')::uuid, 'refunded', 'x', 1) ->> 'code' = 'invalid_request', 'B5a a stop never carries a refund');
  PERFORM tst.ok(tst.bfinish((b ->> 'actionId')::uuid, 'cancelled') ->> 'code' = 'already_finished', 'B5b one result per action');
  PERFORM tst.ok(tst.bstate(tst.bu(1)) ->> 'inGrace' = 'false' AND tst.bstate(tst.bu(1)) ->> 'limited' = 'false'
                 AND tst.bstate(tst.bu(1)) ->> 'graceEndsAt' IS NULL AND NOT public.paid_account_limited(tst.bu(1))
                 AND tst.bstate(tst.bu(1)) ->> 'renewalStopped' = 'true' AND tst.bstate(tst.bu(1)) ->> 'limitedReason' IS NULL,
    'B5c inside the paid period: full use, no grace notice; the summary says the renewal is off (Codex audit M-01)');
  PERFORM tst.ok(tst.bbegin(tst.bu(9), tst.bu(1), 'stop_renewal', false, 0) ->> 'code' = 'already_stopped', 'B5d it cannot be stopped twice');
  r := tst.bpay('tx-408-1-renewal', NULL, 'rec-408-1', now() - interval '1 hour');
  PERFORM tst.ok(r ->> 'activated' = 'false' AND r ->> 'code' = 'renewal_stopped' AND tst.bpaid(tst.bu(1)) = pt
                 AND tst.bprev(tst.bu(1)) ->> 'chargeRef' = 'tx-408-1',
    'B6 a renewal charge that still arrives after the stop extends nothing, is reported, and never becomes the refunded charge');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- end early
DO $$
DECLARE p jsonb; b jsonb; f jsonb; v_end timestamptz;
BEGIN
  p := tst.bprev(tst.bu(2));
  v_end := (p ->> 'effectiveEnd')::timestamptz;
  b := tst.bbegin(tst.bu(9), tst.bu(2), 'end_early', false, (p ->> 'refundMinor')::int);
  PERFORM tst.ok(b ->> 'ok' = 'true' AND b ->> 'chargeRef' = 'tx-408-2' AND (b ->> 'refundMinor')::int = (p ->> 'refundMinor')::int,
    'B7 begin an early end: the charge to refund and the exact amount');
  PERFORM tst.ok(tst.brefund((b ->> 'actionId')::uuid, 'refunded', 'refund-408-2', (p ->> 'refundMinor')::int) ->> 'code' = 'invalid_request',
    'B7a no refund before the end is recorded');
  f := tst.bfinish((b ->> 'actionId')::uuid, 'cancelled');
  PERFORM tst.ok(f ->> 'applied' = 'true' AND f ->> 'refundDue' = 'true' AND f ->> 'chargeRef' = 'tx-408-2'
                 AND tst.bpaid(tst.bu(2)) = v_end AND NOT public.paid_account_limited(tst.bu(2)),
    'B8 stopped and recorded: access runs to midnight tonight; NOW the refund is due');
  PERFORM tst.ok(tst.bowed(tst.bu(2)) ->> 'state' = 'not_sent', 'B8-1 from the recorded end, the refund owed is visible (not sent yet)');
  PERFORM tst.ok(tst.brefund((b ->> 'actionId')::uuid, 'refunded', 'refund-408-2', (p ->> 'refundMinor')::int) ->> 'code' = 'invalid_request',
    'B8-2 no refund result before it is marked sending');
  PERFORM tst.ok(tst.bsending((b ->> 'actionId')::uuid) ->> 'chargeRef' = 'tx-408-2', 'B8-3 marked sending BEFORE PayPlus is asked');
  PERFORM tst.ok(tst.bsending((b ->> 'actionId')::uuid) ->> 'code' = 'refund_already_started' AND tst.bowed(tst.bu(2)) ->> 'state' = 'sending',
    'B8-4 never sent twice; while unanswered it stays owed (a crash / a lost answer is never lost)');
  PERFORM tst.ok(tst.brefund((b ->> 'actionId')::uuid, 'refunded', 'refund-408-2', (p ->> 'refundMinor')::int + 1) ->> 'code' = 'invalid_request',
    'B8a a refund of any other amount is refused');
  PERFORM tst.ok(tst.brefund((b ->> 'actionId')::uuid, 'refunded', 'refund-408-2', (p ->> 'refundMinor')::int) ->> 'ok' = 'true',
    'B8b the exact refund is recorded');
  PERFORM tst.ok(tst.brefund((b ->> 'actionId')::uuid, 'refunded', 'refund-408-2b', (p ->> 'refundMinor')::int) ->> 'code' = 'already_recorded',
    'B8c ... once - never a second one');
  PERFORM tst.ok(tst.bowed(tst.bu(2)) IS NULL, 'B8d refunded by PayPlus: nothing owed any more');
  PERFORM tst.bdev(format('UPDATE public.account_entitlements SET paid_through = now() - interval %L WHERE user_id = %L', '1 minute', tst.bu(2)));
  PERFORM tst.ok(public.paid_account_limited(tst.bu(2)) AND public.paid_grace_ends_at(tst.bu(2)) IS NULL
                 AND tst.bstate(tst.bu(2)) ->> 'limited' = 'true' AND tst.bstate(tst.bu(2)) ->> 'inGrace' = 'false'
                 AND (tst.bstate(tst.bu(2)) ->> 'graceEndsAt')::timestamptz = date_trunc('milliseconds', now() - interval '1 minute')
                 AND tst.bstate(tst.bu(2)) ->> 'limitedReason' = 'cancelled',
    'B9 the minute the access ends the account is limited - no 3 grace days; graceEndsAt carries the end (the summary contract)');
  PERFORM tst.ok(tst.bbegin(tst.bu(9), tst.bu(2), 'end_early', false, 0) ->> 'code' = 'already_ended', 'B9b never ended early twice');
END $$;

-- a stopped renewal (user 1) may still be ended early - PayPlus is not asked again; the refund is recorded as manual
DO $$
DECLARE p jsonb; b jsonb; f jsonb;
BEGIN
  p := tst.bprev(tst.bu(1), true); -- the preview of the same choice (fee waived) as the action
  b := tst.bbegin(tst.bu(9), tst.bu(1), 'end_early', true, (p ->> 'refundMinor')::int);
  PERFORM tst.ok(b ->> 'ok' = 'true' AND b ->> 'alreadyStopped' = 'true' AND b ->> 'chargeRef' = 'tx-408-1',
    'B10 a stopped renewal may still be ended early (no second stop), refunding the charge that paid the period');
  f := tst.bfinish((b ->> 'actionId')::uuid, 'cancelled');
  PERFORM tst.ok(f ->> 'applied' = 'true' AND f ->> 'refundDue' = 'true' AND tst.bpaid(tst.bu(1)) = (p ->> 'effectiveEnd')::timestamptz,
    'B10b ... ended at midnight');
  PERFORM tst.bsending((b ->> 'actionId')::uuid);
  PERFORM tst.ok(tst.brefund((b ->> 'actionId')::uuid, 'manual', NULL, NULL) ->> 'refundStatus' = 'manual' AND tst.bowed(tst.bu(1)) ->> 'state' = 'manual',
    'B10c the refund is recorded for a manual refund in the PayPlus panel - and stays owed');
  PERFORM tst.ok(tst.bsettle((b ->> 'actionId')::uuid, tst.bu(2)) ->> 'code' = 'forbidden', 'B10d only a super admin confirms it');
  PERFORM tst.ok(tst.bsettle((b ->> 'actionId')::uuid, tst.bu(9)) ->> 'ok' = 'true', 'B10e the Owner confirms it from the PayPlus panel');
  PERFORM tst.ok(tst.bowed(tst.bu(1)) IS NULL AND tst.bsettle((b ->> 'actionId')::uuid, tst.bu(9)) ->> 'code' = 'no_unsettled_refund',
    'B10f ... then nothing is owed, and it cannot be confirmed twice');
END $$;

-- PayPlus refused to stop the standing order (user 3): nothing changes; an interrupted action blocks until the Owner resolves it
DO $$
DECLARE b jsonb; c jsonb; pt timestamptz;
BEGIN
  pt := tst.bpaid(tst.bu(3));
  b := tst.bbegin(tst.bu(9), tst.bu(3), 'stop_renewal', false, 0);
  PERFORM tst.ok(tst.bfinish((b ->> 'actionId')::uuid, 'failed') ->> 'applied' = 'false' AND tst.bpaid(tst.bu(3)) = pt AND NOT tst.bstopped(tst.bu(3)),
    'B11 PayPlus did not stop it: nothing changes (the renewal continues)');
  c := tst.bbegin(tst.bu(9), tst.bu(3), 'stop_renewal', false, 0);
  PERFORM tst.ok(c ->> 'ok' = 'true', 'B11b ... and it may be tried again');
  -- interrupted: no result recorded (e.g. a crash after PayPlus answered) - it stays open with no time limit
  PERFORM tst.bdev(format('UPDATE public.billing_admin_actions SET created_at = now() - interval %L WHERE action_id = %L', '2 days', c ->> 'actionId'));
  PERFORM tst.ok(tst.bbegin(tst.bu(9), tst.bu(3), 'stop_renewal', false, 0) ->> 'code' = 'action_in_progress'
                 AND tst.bopen(tst.bu(3)) ->> 'actionId' = c ->> 'actionId',
    'B11c an interrupted action blocks every new one, even days later, and is shown as open');
  b := tst.bfinish((c ->> 'actionId')::uuid, 'cancelled', true); -- before the reads (AND has no evaluation order)
  PERFORM tst.ok(b ->> 'applied' = 'true' AND tst.bstopped(tst.bu(3)) AND tst.bopen(tst.bu(3)) IS NULL
                 AND (SELECT resolved_by_owner FROM public.billing_admin_action_results WHERE action_id = (c ->> 'actionId')::uuid),
    'B11d the Owner resolves it from the PayPlus panel (stopped there): recorded as resolved by the Owner');
END $$;
DO $$
DECLARE p jsonb; b jsonb; f jsonb; pt timestamptz;
BEGIN
  p := tst.bprev(tst.bu(3));
  b := tst.bbegin(tst.bu(9), tst.bu(3), 'end_early', false, (p ->> 'refundMinor')::int);
  PERFORM tst.ok(tst.bfinish((b ->> 'actionId')::uuid, 'cancelled', true) ->> 'code' = 'too_early_to_resolve'
                 AND NOT EXISTS (SELECT 1 FROM public.billing_admin_action_results WHERE action_id = (b ->> 'actionId')::uuid),
    'B11e a resolve within 5 minutes of the action is refused (the request may still be waiting for PayPlus)');
  -- resolved days later, after its own midnight: the customer kept the days - no automatic refund, the renewal stays stopped
  PERFORM tst.bdev(format('UPDATE public.billing_admin_actions SET created_at = now() - interval %L, effective_end = now() - interval %L WHERE action_id = %L',
                          '3 days', '2 days', b ->> 'actionId'));
  pt := tst.bpaid(tst.bu(3));
  f := tst.bfinish((b ->> 'actionId')::uuid, 'cancelled', true);
  PERFORM tst.ok(f ->> 'applied' = 'false' AND f ->> 'refundDue' = 'false' AND tst.bpaid(tst.bu(3)) = pt AND tst.bstopped(tst.bu(3)),
    'B11f an early end resolved after its own midnight refunds nothing automatically and leaves the paid end');
  PERFORM tst.ok(tst.bbegin(tst.bu(9), tst.bu(3), 'end_early', false, (tst.bprev(tst.bu(3)) ->> 'refundMinor')::int) ->> 'ok' = 'true',
    'B11g ... the Owner starts a fresh early end with today''s amount');
END $$;

-- a renewal lands between begin and finish (user 4): no refund is due, but the renewal IS stopped
DO $$
DECLARE p jsonb; b jsonb; f jsonb; pt timestamptz;
BEGIN
  p := tst.bprev(tst.bu(4));
  b := tst.bbegin(tst.bu(9), tst.bu(4), 'end_early', false, (p ->> 'refundMinor')::int);
  pt := tst.bpaid(tst.bu(4));
  PERFORM tst.ok(tst.bpay('tx-408-4-renewal', NULL, 'rec-408-4', now() - interval '1 hour') ->> 'activated' = 'true' AND tst.bpaid(tst.bu(4)) > pt,
    'B12 setup: a renewal charge extends the package after the early end was begun');
  f := tst.bfinish((b ->> 'actionId')::uuid, 'cancelled');
  PERFORM tst.ok(f ->> 'applied' = 'false' AND f ->> 'refundDue' = 'false' AND tst.bstopped(tst.bu(4)) AND tst.bpaid(tst.bu(4)) > pt
                 AND tst.brefund((b ->> 'actionId')::uuid, 'refunded', 'r', (p ->> 'refundMinor')::int) ->> 'code' = 'invalid_request',
    'B12b the package changed: nothing is refunded (no refund can be recorded), the end is not applied - but the renewal is stopped');
END $$;

-- a stopped account that ran out buys again (user 2): the stop is cleared
DO $$
DECLARE a uuid; r jsonb;
BEGIN
  a := tst.bintent(tst.bu(2), 'billing-admin-408-user-2-again');
  r := tst.bpay('tx-408-2-again', a, 'rec-408-2b', now() - interval '1 minute');
  PERFORM tst.ok(r ->> 'activated' = 'true' AND NOT public.paid_account_limited(tst.bu(2)) AND NOT tst.bstopped(tst.bu(2))
                 AND (SELECT live_attempt_id = a FROM public.account_entitlements WHERE user_id = tst.bu(2))
                 AND (SELECT charge_ref FROM public.billing_paid_periods WHERE user_id = tst.bu(2) ORDER BY period_id DESC LIMIT 1) = 'tx-408-2-again',
    'B13 a new purchase after the end opens a new package, clears the stop and is the new charge to refund');
END $$;

-- the days count from the real period row (a clamped month end, e.g. 31 Jan -> 28 Feb, is 28 days - never derived back from its end)
SELECT tst.bdev(format('DELETE FROM public.billing_paid_periods WHERE user_id = %L', tst.bu(5)));
SELECT tst.bdev(format('UPDATE public.account_entitlements SET paid_through = now() + interval %L WHERE user_id = %L', '26 days', tst.bu(5)));
INSERT INTO public.billing_paid_periods (user_id, attempt_id, event_id, charge_ref, period_start, period_end)
SELECT e.user_id, e.live_attempt_id, 'tx-408-5', 'tx-408-5', now() - interval '2 days', now() + interval '26 days' FROM public.account_entitlements e WHERE e.user_id = tst.bu(5);
SELECT tst.ok((tst.bprev(tst.bu(5)) ->> 'daysInPeriod')::int = 28, 'B14 the days come from the real period row (28)');

-- Codex audit 2026-10-22 H-03: a renewal paid in advance (user 7) - the refund is on the ACTIVE period and its own charge; an early end
-- is refused while the later period is paid
DO $$
DECLARE a uuid; p jsonb;
BEGIN
  a := tst.bintent(tst.bu(7), 'billing-admin-408-user-7');
  PERFORM tst.bpay('tx-408-7-current', a, 'rec-408-7', now() - interval '15 days');
  PERFORM tst.bpay('tx-408-7-future', NULL, 'rec-408-7', now() - interval '1 hour');
  p := tst.bprev(tst.bu(7));
  PERFORM tst.ok(p ->> 'chargeRef' = 'tx-408-7-current' AND (p ->> 'hasFuturePeriod')::boolean
                 AND (p ->> 'periodEnd')::timestamptz = public.billing_period_end(now() - interval '15 days', 'month')
                 AND (p ->> 'paidThrough')::timestamptz > (p ->> 'periodEnd')::timestamptz,
    'B17 an early renewal: the preview keeps the active period and its own charge, and shows the later paid period');
  PERFORM tst.ok(tst.bbegin(tst.bu(9), tst.bu(7), 'end_early', false, (p ->> 'refundMinor')::int) ->> 'code' = 'future_period_paid',
    'B17b an early end is refused while a later period is already paid (refund that charge in the PayPlus panel first)');
  PERFORM tst.ok(tst.bbegin(tst.bu(9), tst.bu(7), 'stop_renewal', false, 0) ->> 'ok' = 'true', 'B17c stopping the renewal is still allowed');
END $$;

-- Codex audit H-04: two links of one account; A paid opens the package and expires B locally; B paid anyway is reported, and its
-- standing order is bound to B (traceable for the cancellation)
DO $$
DECLARE a uuid; b uuid; r jsonb;
BEGIN
  a := tst.bintent(tst.bu(6), 'billing-admin-408-user-6-a');
  b := tst.bintent(tst.bu(6), 'billing-admin-408-user-6-b');
  r := tst.bpay('tx-408-6-a', a, 'rec-408-6a', now() - interval '2 hours'); -- before the read (AND has no evaluation order)
  PERFORM tst.ok(r ->> 'activated' = 'true' AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = b) = 'expired', 'B18 A paid; B expired locally');
  r := tst.bpay('tx-408-6-b', b, 'rec-408-6b', now() - interval '1 hour');
  PERFORM tst.ok(r ->> 'activated' = 'false' AND r ->> 'code' = 'attempt_not_payable' AND r ->> 'outcome' = 'rejected'
                 AND (SELECT attempt_id = b FROM public.provider_standing_orders WHERE recurring_ref = 'rec-408-6b'),
    'B18b the payment of the expired link is reported (attempt_not_payable, never a second package) and its standing order is traceable');
END $$;

-- Codex audit M-02: no cancellation fee in USD until an approved rule (an International account, user 10)
INSERT INTO auth.users (id, email) VALUES (tst.bu(10), 'b408-10@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  VALUES (tst.bu(10), 'b408-10@synthetic.test', 'Synthetic billing admin 10', 'US', 'USD', 'free', 'user', false) ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) VALUES (tst.bu(10), 'INTERNATIONAL', 'business_settings_country');
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed) VALUES (tst.bu(10), 'free_10', NULL, 0);
DO $$
DECLARE a uuid; amt int; p jsonb;
BEGIN
  a := tst.bintent(tst.bu(10), 'billing-admin-408-user-10');
  SELECT amount_minor INTO amt FROM public.checkout_attempts WHERE attempt_id = a;
  PERFORM tst.bsvc();
  PERFORM public.record_verified_provider_event('payplus', 'tx-408-10', 'payment_confirmed', a, 'rec-408-10', 'term-408', now() - interval '3 days', repeat('e', 64), amt, 'USD');
  PERFORM tst.logout();
  p := tst.bprev(tst.bu(10));
  PERFORM tst.ok(p ->> 'currency' = 'USD' AND (p ->> 'feeMinor')::int = 0 AND (p ->> 'refundMinor')::int = (p ->> 'proratedMinor')::int,
    'B19 USD: no cancellation fee until an approved rule (Codex audit M-02)');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- the log + grants
SELECT tst.throws(format('UPDATE public.billing_admin_actions SET refund_minor = 0 WHERE user_id = %L', tst.bu(2)), 'append', 'B15 the action log cannot be rewritten');
SELECT tst.throws('DELETE FROM public.billing_admin_action_results', 'append', 'B15b ... nor its results deleted');
SELECT tst.throws('DELETE FROM public.billing_admin_refunds', 'append', 'B15c ... nor its refunds');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.billing_admin_refund_sending(uuid)', 'execute')
              AND NOT has_function_privilege('authenticated', 'public.billing_admin_settle_refund(uuid,uuid)', 'execute')
              AND NOT has_function_privilege('anon', 'public.billing_admin_unsettled_refund(uuid)', 'execute')
              AND has_function_privilege('service_role', 'public.billing_admin_settle_refund(uuid,uuid)', 'execute'),
  'B15d the refund stages are service role only');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.billing_admin_begin(uuid,uuid,text,boolean,integer,text)', 'execute')
              AND NOT has_function_privilege('authenticated', 'public.billing_admin_preview(uuid,boolean)', 'execute')
              AND NOT has_function_privilege('anon', 'public.billing_admin_finish(uuid,text,boolean)', 'execute')
              AND NOT has_function_privilege('authenticated', 'public.billing_admin_record_refund(uuid,text,text,integer)', 'execute')
              AND NOT has_function_privilege('authenticated', 'public.billing_admin_open_action(uuid)', 'execute')
              AND has_function_privilege('service_role', 'public.billing_admin_record_refund(uuid,text,text,integer)', 'execute')
              AND NOT has_table_privilege('authenticated', 'public.billing_admin_actions', 'select')
              AND NOT has_table_privilege('service_role', 'public.billing_admin_refunds', 'select'),
  'B16 only the Edge function (service role) acts, through the functions; nobody reads the tables directly');

ROLLBACK;
