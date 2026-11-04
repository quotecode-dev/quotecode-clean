-- Resume a stopped renewal from the plans window, nothing charged until the paid period ends (migration 20261104100000; Owner console
-- 2026-11-04, typed: "מאשר המשך חיוב מתחדש בלי חיוב מיידי מחלון המסלולים, כולל שינוי ב-L-01 ו-L-22, שחרור עד הלייב"). Disposable
-- postgres:17 harness ONLY. Proves: an account whose renewal is NOT stopped is unchanged (already_subscribed); a stopped renewal gets a
-- resume attempt of the SAME period and lines whose first charge is the paid period end; the server pull of its page binds the standing
-- order and clears the stop WITHOUT extending the paid period or writing a paid period; a callback of the page before the first charge
-- date does the same (never a free period); the first real charge of the resumed standing order is an ordinary renewal (+1 period);
-- an account that is no longer resumable or a different amount resumes nothing; service role only.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (now() is the same instant throughout).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.ru(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4640000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.rsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.rintent(p_user uuid, p_key text, p_period text DEFAULT 'month', p_smart boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.rsvc(); r := public.create_package_checkout_intent(p_user, p_period, p_key, p_smart); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.rpay(p_event text, p_attempt uuid, p_ref text, p_at timestamptz, p_minor int DEFAULT 3000) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.rsvc();
  r := public.record_verified_provider_event('payplus', p_event, 'payment_confirmed', p_attempt, p_ref, CASE WHEN p_ref IS NULL THEN NULL ELSE 'term-464' END,
         p_at, repeat('e', 64), p_minor, 'ILS');
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.rpage(p_attempt uuid, p_user uuid, p_req uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN PERFORM tst.rsvc(); r := public.record_checkout_attempt_page_and_request(p_attempt, p_user, 'https://pay.example/464', p_req::text); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.rpull(p_attempt uuid, p_user uuid, p_ref text, p_minor int DEFAULT 3000) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.rsvc(); r := public.record_checkout_pull(p_attempt, p_user, p_attempt, p_ref, p_minor, 'ILS', repeat('d', 64)); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.rstop(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE b jsonb;
BEGIN
  PERFORM tst.rsvc();
  b := public.billing_admin_begin(tst.ru(9), p_user, 'stop_renewal', false, 0, 'customer asked (synthetic)');
  PERFORM public.billing_admin_finish((b ->> 'actionId')::uuid, 'cancelled', false);
  PERFORM tst.logout();
END $$;
CREATE OR REPLACE FUNCTION tst.rent(p_user uuid) RETURNS public.account_entitlements LANGUAGE sql AS $$
  SELECT * FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.rperiods(p_user uuid) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.billing_paid_periods WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.rdev(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  EXECUTE p_sql;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- 1-5 customers | 9 the super admin
INSERT INTO auth.users (id, email) SELECT tst.ru(n), format('r464-%s@synthetic.test', n) FROM generate_series(1, 9) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.ru(n), format('r464-%s@synthetic.test', n), format('Synthetic resume %s', n), 'Local', 'ILS', 'free',
         CASE WHEN n = 9 THEN 'super_admin' ELSE 'user' END, false
    FROM generate_series(1, 9) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.ru(n), 'IL', 'business_settings_country' FROM generate_series(1, 9) n
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.ru(n), 'free_10', NULL, 0 FROM generate_series(1, 9) n;
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;

-- monthly packages 1..5, each with a standing order; the paid period ends 10 Israel days after the end of today; 1..4 stopped
DO $$
DECLARE n int; a uuid;
BEGIN
  FOR n IN 1..5 LOOP
    a := (tst.rintent(tst.ru(n), format('renewal-resume-464-buy-%s', n)) ->> 'attemptId')::uuid;
    PERFORM tst.rpay(format('tx-464-%s', n), a, format('rec-464-%s', n), now() - interval '5 days');
    PERFORM tst.rdev(format('UPDATE public.account_entitlements SET paid_through = ((date_trunc(%L, now() AT TIME ZONE %L) + interval %L + interval %L) AT TIME ZONE %L) WHERE user_id = %L',
      'day', 'Asia/Jerusalem', '11 days', '9 hours', 'Asia/Jerusalem', tst.ru(n)));
  END LOOP;
  FOR n IN 1..4 LOOP PERFORM tst.rstop(tst.ru(n)); END LOOP;
  PERFORM tst.ok((SELECT bool_and(renewal_stopped_at IS NOT NULL) FROM public.account_entitlements WHERE user_id IN (tst.ru(1), tst.ru(2), tst.ru(3), tst.ru(4)))
                 AND (tst.rent(tst.ru(5))).renewal_stopped_at IS NULL, 'R0 setup: 1-4 stopped, 5 renewing');
END $$;

SELECT tst.ok(tst.rintent(tst.ru(5), 'renewal-resume-464-again-5') ->> 'code' = 'already_subscribed',
  'R1 a renewing package is unchanged: no second page (already_subscribed)');
SELECT tst.ok(tst.rintent(tst.ru(1), 'renewal-resume-464-year-1', 'year') ->> 'code' = 'invalid_request',
  'R2 a resume is the SAME period only (another period refused)');
SELECT tst.ok(tst.rintent(tst.ru(4), 'renewal-resume-464-smart-4', 'month', true) ->> 'code' = 'invalid_request',
  'R2b SMART PACK that is not active now is never put on the resumed standing order (it is added right after, pro rata, by the mid-period add-on)');

DO $$
DECLARE r jsonb; a uuid; pt timestamptz; periods bigint; s jsonb; e public.account_entitlements;
BEGIN
  pt := (tst.rent(tst.ru(1))).paid_through; periods := tst.rperiods(tst.ru(1));
  r := tst.rintent(tst.ru(1), 'renewal-resume-464-resume-1');
  a := (r ->> 'attemptId')::uuid;
  PERFORM tst.ok(r ->> 'ok' = 'true' AND (r ->> 'amountMinor')::int = 3000 AND r ->> 'state' = 'pending' AND (r ->> 'firstChargeAt')::timestamptz = pt
                 AND (SELECT resume_first_charge_at FROM public.checkout_attempts WHERE attempt_id = a) = pt,
    format('R3 a stopped renewal gets a resume attempt: the same price, its first charge = the paid period end (%s; paid through %s)', r, pt));
  PERFORM tst.ok(tst.rintent(tst.ru(1), 'renewal-resume-464-resume-1') ->> 'attemptId' = a::text, 'R3b the same click again = the same attempt');
  PERFORM tst.rpage(a, tst.ru(1), 'b4640000-0000-4000-8000-000000000001');
  s := tst.rpull(a, tst.ru(1), 'rec-464-resume-1');
  e := tst.rent(tst.ru(1));
  PERFORM tst.ok(s ->> 'ok' = 'true' AND s ->> 'resumed' = 'true' AND s ->> 'activated' = 'false' AND s ->> 'pulled' = 'true'
                 AND e.paid_through = pt AND e.renewal_stopped_at IS NULL AND e.live_attempt_id = a AND tst.rperiods(tst.ru(1)) = periods
                 AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'confirmed'
                 AND EXISTS (SELECT 1 FROM public.provider_standing_orders WHERE recurring_ref = 'rec-464-resume-1' AND attempt_id = a)
                 AND EXISTS (SELECT 1 FROM public.subscription_events WHERE provider_event_id = 'resume:' || a::text AND event_type = 'renewal_resumed' AND outcome = 'applied'),
    'R4 the pull of the page resumes the renewal: the stop is cleared, the attempt is live, its standing order bound - the paid period is NOT extended and no paid period is written');
  s := tst.rpull(a, tst.ru(1), 'rec-464-resume-1');
  PERFORM tst.ok((tst.rent(tst.ru(1))).paid_through = pt AND tst.rperiods(tst.ru(1)) = periods, 'R5 a second pull changes nothing');
  PERFORM tst.ok(tst.rintent(tst.ru(1), 'renewal-resume-464-after-1') ->> 'code' = 'already_subscribed', 'R5b resumed = renewing: no further page');
  -- the paid period ends now: the resumed standing order's first real charge is a renewal (+1 period from the end)
  PERFORM tst.rdev(format('UPDATE public.account_entitlements SET paid_through = now() + interval %L WHERE user_id = %L', '1 hour', tst.ru(1)));
  PERFORM tst.rdev(format('UPDATE public.checkout_attempts SET resume_first_charge_at = now() + interval %L WHERE attempt_id = %L', '1 hour', a));
  -- (the charge comes after the resume: in this one-instant transaction it is placed 30 minutes later)
  r := tst.rpay('tx-464-resume-1-first', a, 'rec-464-resume-1', now() + interval '30 minutes');
  e := tst.rent(tst.ru(1));
  PERFORM tst.ok(r ->> 'activated' = 'true' AND e.paid_through = public.billing_period_end(now() + interval '1 hour', 'month')
                 AND tst.rperiods(tst.ru(1)) = periods + 1 AND e.renewal_stopped_at IS NULL,
    format('R6 the first real charge of the resumed standing order renews: one period from the end, one paid period with that charge (%s)', r));
END $$;

DO $$
DECLARE r jsonb; a uuid; pt timestamptz; periods bigint; e public.account_entitlements;
BEGIN
  pt := (tst.rent(tst.ru(2))).paid_through; periods := tst.rperiods(tst.ru(2));
  a := (tst.rintent(tst.ru(2), 'renewal-resume-464-resume-2') ->> 'attemptId')::uuid;
  -- PayPlus confirms the page by callback before the first charge date (no pull yet)
  r := tst.rpay('tx-464-resume-2-card', a, 'rec-464-resume-2', now());
  e := tst.rent(tst.ru(2));
  PERFORM tst.ok(r ->> 'resumed' = 'true' AND r ->> 'activated' = 'false' AND e.paid_through = pt AND tst.rperiods(tst.ru(2)) = periods
                 AND e.renewal_stopped_at IS NULL AND e.live_attempt_id = a
                 AND EXISTS (SELECT 1 FROM public.provider_standing_orders WHERE recurring_ref = 'rec-464-resume-2' AND attempt_id = a),
    'R7 a callback of the page before the first charge date resumes the renewal - never a free period');
END $$;

DO $$
DECLARE r jsonb; a uuid; pt timestamptz; e public.account_entitlements;
BEGIN
  pt := (tst.rent(tst.ru(3))).paid_through;
  a := (tst.rintent(tst.ru(3), 'renewal-resume-464-resume-3') ->> 'attemptId')::uuid;
  PERFORM tst.rpage(a, tst.ru(3), 'b4640000-0000-4000-8000-000000000003');
  r := tst.rpull(a, tst.ru(3), 'rec-464-resume-3', 3600);
  e := tst.rent(tst.ru(3));
  PERFORM tst.ok(r ->> 'code' = 'amount_mismatch' AND e.renewal_stopped_at IS NOT NULL AND e.paid_through = pt
                 AND (SELECT state FROM public.checkout_attempts WHERE attempt_id = a) = 'pending',
    'R8 a standing order of another amount resumes nothing (the attempt stays pending)');
  -- the paid period has ended meanwhile: nothing resumes here
  PERFORM tst.rdev(format('UPDATE public.account_entitlements SET paid_through = now() - interval %L WHERE user_id = %L', '1 hour', tst.ru(3)));
  r := tst.rpull(a, tst.ru(3), 'rec-464-resume-3');
  e := tst.rent(tst.ru(3));
  PERFORM tst.ok(r ->> 'code' = 'not_resumable' AND e.renewal_stopped_at IS NOT NULL AND e.paid_through = now() - interval '1 hour',
    'R9 a period that already ended resumes nothing here (a later real charge is a purchase as always)');
END $$;

-- ------------------------------------------------------------------ SMART PACK (Owner console 2026-11-05: with or without SMART PACK)
-- 6 and 7: monthly package + SMART PACK, stopped; 4: package only, stopped (from above)
DO $$
DECLARE n int; r jsonb; a uuid;
BEGIN
  INSERT INTO auth.users (id, email) SELECT tst.ru(m), format('r464-%s@synthetic.test', m) FROM generate_series(6, 7) m ON CONFLICT DO NOTHING;
  INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
    SELECT tst.ru(m), format('r464-%s@synthetic.test', m), format('Synthetic resume %s', m), 'Local', 'ILS', 'free', 'user', false
      FROM generate_series(6, 7) m ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.account_market (user_id, market, source) SELECT tst.ru(m), 'IL', 'business_settings_country' FROM generate_series(6, 7) m
    ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
  INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
    SELECT tst.ru(m), 'free_10', NULL, 0 FROM generate_series(6, 7) m ON CONFLICT (user_id) DO NOTHING;
  FOR n IN 6..7 LOOP
    r := tst.rintent(tst.ru(n), format('renewal-resume-464-buy-smart-%s', n), 'month', true);
    PERFORM tst.rpay(format('tx-464-smart-%s', n), (r ->> 'attemptId')::uuid, format('rec-464-smart-%s', n), now() - interval '5 days', (r ->> 'amountMinor')::int);
    PERFORM tst.rdev(format('UPDATE public.account_entitlements SET paid_through = ((date_trunc(%L, now() AT TIME ZONE %L) + interval %L + interval %L) AT TIME ZONE %L) WHERE user_id = %L',
      'day', 'Asia/Jerusalem', '11 days', '9 hours', 'Asia/Jerusalem', tst.ru(n)));
    PERFORM tst.rstop(tst.ru(n));
  END LOOP;
  PERFORM tst.ok((tst.rent(tst.ru(6))).smart_pack_line AND (tst.rent(tst.ru(7))).smart_pack_line AND (tst.rent(tst.ru(6))).renewal_stopped_at IS NOT NULL,
    'R11 setup: 6 and 7 have SMART PACK on a stopped renewal');
END $$;

DO $$
DECLARE r jsonb; a uuid; e public.account_entitlements; pt timestamptz;
BEGIN
  -- keep SMART PACK: on the resumed standing order, still renewing, nothing paid today
  pt := (tst.rent(tst.ru(6))).paid_through;
  r := tst.rintent(tst.ru(6), 'renewal-resume-464-keep-6', 'month', true);
  a := (r ->> 'attemptId')::uuid;
  PERFORM tst.rpage(a, tst.ru(6), 'b4640000-0000-4000-8000-000000000006');
  PERFORM tst.rpull(a, tst.ru(6), 'rec-464-keep-6', (r ->> 'amountMinor')::int);
  e := tst.rent(tst.ru(6));
  PERFORM tst.ok(r ->> 'addOnPriceId' IS NOT NULL AND (r ->> 'amountMinor')::int > 3000 AND e.smart_pack_line AND e.smart_pack_until IS NULL
                 AND e.renewal_stopped_at IS NULL AND e.paid_through = pt,
    'R12 resumed WITH SMART PACK: the standing order carries it, it keeps renewing, the paid period is unchanged');
  -- leave SMART PACK off: it stays to the end of the paid period and does not renew
  pt := (tst.rent(tst.ru(7))).paid_through;
  r := tst.rintent(tst.ru(7), 'renewal-resume-464-drop-7', 'month', false);
  a := (r ->> 'attemptId')::uuid;
  PERFORM tst.rpage(a, tst.ru(7), 'b4640000-0000-4000-8000-000000000007');
  PERFORM tst.rpull(a, tst.ru(7), 'rec-464-drop-7', (r ->> 'amountMinor')::int);
  e := tst.rent(tst.ru(7));
  PERFORM tst.ok((r ->> 'amountMinor')::int = 3000 AND r ->> 'addOnPriceId' IS NULL AND NOT e.smart_pack_line AND e.smart_pack_until = pt
                 AND e.renewal_stopped_at IS NULL AND e.paid_through = pt,
    'R13 resumed WITHOUT SMART PACK: it stays to the end of the paid period, then does not renew (never a free extension)');
  -- no SMART PACK before: resume the package, then SMART PACK can be added at once, pro rata, by the mid-period add-on
  r := tst.rintent(tst.ru(4), 'renewal-resume-464-plain-4', 'month', false);
  a := (r ->> 'attemptId')::uuid;
  PERFORM tst.rpage(a, tst.ru(4), 'b4640000-0000-4000-8000-000000000004');
  PERFORM tst.rpull(a, tst.ru(4), 'rec-464-plain-4');
  PERFORM tst.rsvc(); r := public.smart_pack_add_on_quote(tst.ru(4)); PERFORM tst.logout();
  PERFORM tst.ok(r ->> 'ok' = 'true' AND (r ->> 'amountMinor')::int > 0 AND r ->> 'packageAttemptId' = a::text
                 AND (r ->> 'periodEnd')::timestamptz = (tst.rent(tst.ru(4))).paid_through,
    format('R14 after the resume, SMART PACK is offered at once, pro rata to the end of the paid period, on the resumed standing order (%s)', r));
END $$;

SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.billing_resume_renewal(uuid, text, text, text, timestamptz, text, integer, text)', 'execute')
              AND NOT has_function_privilege('anon', 'public.billing_resume_renewal(uuid, text, text, text, timestamptz, text, integer, text)', 'execute')
              AND has_function_privilege('service_role', 'public.billing_resume_renewal(uuid, text, text, text, timestamptz, text, integer, text)', 'execute'),
  'R10 only the Edge function (service role) may resume');

ROLLBACK;
