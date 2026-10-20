-- PayPlus stage 2 - SMART PACK on the server (Owner 2026-10-20, migration 20261021400000). Disposable postgres:17 harness ONLY.
-- Proves: nothing is checked while free_issue is not enforced; a NEW account has SMART PACK in its 7 days and loses it after them; an
-- account that existed on the activation day does not (until it adds it); LIFETIME has it; a paid package has it only with its line
-- (or until the end of the period after removal) and never in limited mode; quote attachments follow it (the capability and the
-- server gate), existing attachments are never touched; the package payment page adds the SMART PACK line at its own price of the
-- same market + cycle and the verified payment of that total sets the line; the summary tells it; only the service role asks.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (phase rows are test devices of the DB owner).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.pu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4030000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.pq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4031000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.psvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.pintent(p_user uuid, p_period text, p_key text, p_smart boolean) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.psvc(); r := public.create_package_checkout_intent(p_user, p_period, p_key, p_smart); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.ppay(p_event text, p_attempt uuid, p_amount int) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.psvc();
  r := public.record_verified_subscription_event_and_activate('payplus', p_event, 'payment_confirmed', p_attempt, now() - interval '1 hour',
                                                               repeat('e', 64), p_amount, 'ILS');
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.pstate(p_user uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.smart_pack_state(p_user) $$;
CREATE OR REPLACE FUNCTION tst.pattach(p_quote uuid) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.quote_attachments (quote_id, file_name, file_url, file_size, storage_path)
  VALUES (p_quote, 'plan.pdf', 'synthetic/plan.pdf', 10, 'synthetic/plan.pdf') $$;
-- DB-owner test device (triggers off for this one statement)
CREATE OR REPLACE FUNCTION tst.pdev(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  EXECUTE p_sql;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- --------------------------------------------------------------------------------------------------------------------- fixtures
-- 1 existing Free (before activation) | 2 LIFETIME | 3 / 4 Free -> buy the package (with / without SMART PACK) | 5 new signup (later)
INSERT INTO auth.users (id, email) SELECT tst.pu(n), format('p403-%s@synthetic.test', n) FROM generate_series(1, 5) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.pu(n), format('p403-%s@synthetic.test', n), format('Synthetic Smart %s', n), 'Local', 'ILS', 'free', 'user', n = 2
    FROM generate_series(1, 4) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.pu(n), 'IL', 'business_settings_country' FROM generate_series(1, 5) n;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id) VALUES
  (tst.pu(1), 'free_10', NULL), (tst.pu(2), 'paid', 'visual'), (tst.pu(3), 'free_10', NULL), (tst.pu(4), 'free_10', NULL);
INSERT INTO public.quotes (id, user_id, quote_number, status) SELECT tst.pq(n), tst.pu(n), 40300 + n, 'draft' FROM generate_series(1, 4) n;
SELECT tst.pattach(tst.pq(1));  -- an attachment from before activation

-- --------------------------------------------------------------------------------------------------------- S0. not enforced
SELECT tst.ok(tst.pstate(tst.pu(1)) = '{"active":false,"source":null,"until":null}'::jsonb AND tst.pstate(tst.pu(2)) ->> 'active' = 'false',
  'P0a not enforced: nobody is reported active (the client keeps the legacy rule, L-05)');
SELECT tst.lives(format('SELECT tst.pattach(%L)', tst.pq(1)), 'P0b not enforced: a new attachment is never checked');
SELECT tst.ok((SELECT count(*) FROM public.price_versions WHERE plan_id = 'smart_pack' AND offer = 'current') = 4
          AND (SELECT amount_minor FROM public.price_versions WHERE price_id = 'il_smart_pack_month_p1') = 1000
          AND (SELECT amount_minor FROM public.price_versions WHERE price_id = 'il_smart_pack_year_p1') = 10200
          AND (SELECT amount_minor FROM public.price_versions WHERE price_id = 'intl_smart_pack_month_p1') = 500
          AND (SELECT amount_minor FROM public.price_versions WHERE price_id = 'intl_smart_pack_year_p1') = 5100,
  'P0c SMART PACK prices: ILS 10 / 102, USD 5 / 51 (current offer, month + year)');

-- -------------------------------------------------------------------------------------------------------------- S1. enforced
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
SET LOCAL tekango.skip_signup_provisioning = 'off';
INSERT INTO public.business_settings (user_id, email, business_name, country, currency) VALUES (tst.pu(5), 'p403-5@synthetic.test', 'Synthetic Smart 5', 'Local', 'ILS');
SET LOCAL tekango.skip_signup_provisioning = 'on';
INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (tst.pq(5), tst.pu(5), 40305, 'draft');
SELECT tst.ok(tst.pstate(tst.pu(5)) ->> 'active' = 'true' AND tst.pstate(tst.pu(5)) ->> 'source' = 'free_window'
          AND tst.pstate(tst.pu(5)) ->> 'until' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$',
  'P1a a NEW account has SMART PACK in its free 7 days (until = the window end)');
SELECT tst.ok(tst.pstate(tst.pu(1)) ->> 'active' = 'false', 'P1b an account that existed on the activation day does not have it (until it adds it)');
SELECT tst.ok(tst.pstate(tst.pu(2)) = '{"active":true,"source":"lifetime","until":null}'::jsonb, 'P1c LIFETIME has it');
SELECT tst.ok('quote_attachment.upload' = ANY (public.subscription_account_capabilities(tst.pu(5)))
          AND NOT 'quote_attachment.upload' = ANY (public.subscription_account_capabilities(tst.pu(1))),
  'P1d the attachment capability follows SMART PACK');
SELECT tst.lives(format('SELECT tst.pattach(%L)', tst.pq(5)), 'P1e with SMART PACK a new attachment is saved');
SELECT tst.throws(format('SELECT tst.pattach(%L)', tst.pq(1)), 'smart_pack_required', 'P1f without it a NEW attachment is refused');
SELECT tst.ok((SELECT count(*) FROM public.quote_attachments WHERE quote_id = tst.pq(1)) = 2, 'P1g existing attachments are never touched');
SELECT tst.lives(format('DELETE FROM public.quote_attachments WHERE quote_id = %L AND file_name = %L', tst.pq(1), 'plan.pdf'), 'P1h removing an attachment is never gated');
SELECT tst.ok(public.account_summary_build(tst.pu(5), false) -> 'smartPack' ->> 'active' = 'true'
          AND (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(public.account_summary_build(tst.pu(5), false) -> 'smartPack') k) = 'active,source,until',
  'P1i the summary carries smartPack { active, source, until }');
SELECT tst.pdev(format('UPDATE public.account_entitlements SET free_window_starts_at = now() - interval %L, created_at = now() - interval %L WHERE user_id = %L',
                       '168 hours', '168 hours', tst.pu(5)));
SELECT tst.ok(tst.pstate(tst.pu(5)) ->> 'active' = 'false', 'P1j after the 7 days the new account no longer has it');

-- ------------------------------------------------------------------------------------------------------ S2. the paid add-on line
UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: set_billing_phase refuses enforced (OPEN-12)' WHERE id;
DO $$ DECLARE r jsonb; a uuid; BEGIN
  r := tst.pintent(tst.pu(3), 'month', 'smart-p403-user3-month-sp', true);
  a := (r ->> 'attemptId')::uuid;
  PERFORM tst.ok((r ->> 'amountMinor')::int = 4000 AND r ->> 'smartPack' = 'true' AND r ->> 'addOnPriceId' = 'il_smart_pack_month_p1'
                 AND (r ->> 'packageAmountMinor')::int = 3000 AND (r ->> 'addOnAmountMinor')::int = 1000,
    'P2a the monthly package + SMART PACK = one payment of 40.00 (30 + 10), its add-on row recorded');
  PERFORM tst.ok(tst.pintent(tst.pu(3), 'month', 'smart-p403-user3-month-sp', false) ->> 'code' = 'idempotency_conflict',
    'P2b the same key without the box is another payment (idempotency conflict)');
  r := tst.ppay('p403-pay-short', a, 3000);
  PERFORM tst.ok(r ->> 'code' = 'amount_mismatch' AND tst.pstate(tst.pu(3)) ->> 'active' = 'false', 'P2c a charge of the package alone (30.00) opens nothing');
  a := (tst.pintent(tst.pu(3), 'month', 'smart-p403-user3-month-sp2', true) ->> 'attemptId')::uuid;
  r := tst.ppay('p403-pay-full', a, 4000);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND (SELECT smart_pack_line FROM public.account_entitlements WHERE user_id = tst.pu(3))
                 AND tst.pstate(tst.pu(3)) = '{"active":true,"source":"add_on","until":null}'::jsonb,
    'P2d the verified payment of the total opens the package WITH the SMART PACK line');
  r := tst.pintent(tst.pu(4), 'year', 'smart-p403-user4-year-nosp', false);
  PERFORM tst.ok((r ->> 'amountMinor')::int = 30600 AND r ->> 'smartPack' = 'false', 'P2e the annual package without the box = 306.00 only');
  r := tst.ppay('p403-pay-4', (r ->> 'attemptId')::uuid, 30600);
  PERFORM tst.ok(r ->> 'activated' = 'true' AND NOT (SELECT smart_pack_line FROM public.account_entitlements WHERE user_id = tst.pu(4))
                 AND tst.pstate(tst.pu(4)) ->> 'active' = 'false', 'P2f a package without the line has no SMART PACK');
  PERFORM tst.ok(((SELECT r2 FROM (SELECT tst.pintent(tst.pu(1), 'year', 'smart-p403-user1-year-sp', true) r2) x) ->> 'amountMinor')::int = 40800,
    'P2g the annual package + SMART PACK = 408.00 (306 + 102)');
END $$;
-- removed: stays until the end of the paid period; limited mode: never
SELECT tst.pdev(format('UPDATE public.account_entitlements SET smart_pack_line = false, smart_pack_until = now() + interval %L WHERE user_id = %L', '10 days', tst.pu(3)));
SELECT tst.ok(tst.pstate(tst.pu(3)) ->> 'active' = 'true' AND tst.pstate(tst.pu(3)) ->> 'until' IS NOT NULL, 'P3a removed: it stays until the end of the paid period');
SELECT tst.pdev(format('UPDATE public.account_entitlements SET smart_pack_until = now() - interval %L WHERE user_id = %L', '1 minute', tst.pu(3)));
SELECT tst.ok(tst.pstate(tst.pu(3)) ->> 'active' = 'false', 'P3b ... and not after it');
SELECT tst.pdev(format('UPDATE public.account_entitlements SET smart_pack_line = true, smart_pack_until = NULL, subscription_status = %L, payment_failed_at = now() - interval %L, paid_through = now() - interval %L WHERE user_id = %L',
                       'past_due', '72 hours', '80 hours', tst.pu(3)));
SELECT tst.ok(public.paid_account_limited(tst.pu(3)) AND tst.pstate(tst.pu(3)) ->> 'active' = 'false', 'P3c limited mode: no SMART PACK');

-- ------------------------------------------------------------------------------------------- S5. the new-account marker is fixed
SELECT tst.throws(format('UPDATE public.account_entitlements SET free_window_smart_pack = true WHERE user_id = %L', tst.pu(1)),
  'SMART PACK marker', 'P5a an existing account can never be marked as a new one (no free SMART PACK by hand)');
SELECT tst.throws(format('INSERT INTO public.account_entitlements (user_id, account_mode, free_window_smart_pack) VALUES (%L, %L, true)', gen_random_uuid(), 'free_10'),
  'SMART PACK marker', 'P5b the marker is never inserted by hand either');

-- ---------------------------------------------------------------------------------------------------------- S4. who may ask
DO $$ BEGIN
  PERFORM tst.login(tst.pu(5));
  PERFORM tst.throws(format('SELECT public.smart_pack_state(%L)', tst.pu(5)), 'permission denied', 'P4a a signed-in user cannot call the SMART PACK functions');
  PERFORM tst.logout();
  PERFORM tst.psvc();
  PERFORM tst.ok(public.smart_pack_active(tst.pu(2)), 'P4b the service role (Edge Functions) asks smart_pack_active');
  PERFORM tst.logout();
END $$;

ROLLBACK;
