-- Owner Free-10 activation rules 2026-10-18 (migration 20261018100000). Disposable postgres:17 harness ONLY.
-- Proves: a NEW account is provisioned at signup (0 of 10); existing accounts are mapped once through the Owner cohort batch
-- (history granted, everyone 0 of 10; LIFETIME -> paid / visual); ten outputs count and the eleventh is refused; a re-send of the
-- same version never counts; paid / LIFETIME are unlimited and never counted; a quote Sent before activation is output again
-- without counting; attachments are SMART PACK (20261021400000); every style + media in the free period; the notice tells the truth for each case.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (the phase row is forced by the DB owner as a test device).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';  -- the "existing accounts" below are created the pre-A-1 way

CREATE OR REPLACE FUNCTION tst.au(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a3920000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.aq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a3921000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.ac(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a3922000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.asvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.adigest(p_user uuid, p_quote uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)) $$;
CREATE OR REPLACE FUNCTION tst.aprep(p_user uuid, p_quote uuid, p_channel text, p_style text DEFAULT 'classic', p_media int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := tst.adigest(p_user, p_quote); r jsonb;
BEGIN
  PERFORM tst.asvc();
  r := public.prepare_quote_output(p_user, p_quote, p_channel, format('out:%s:%s:%s', p_quote, p_channel, d), d, p_style, p_media, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.afin(p_user uuid, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p ->> 'snapshotPath', jsonb_build_object('size', 100))
  ON CONFLICT (bucket_id, name) DO NOTHING;
  PERFORM tst.asvc();
  r := public.finalize_quote_output(p_user, (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.aout(p_user uuid, p_quote uuid, p_channel text DEFAULT 'send', p_style text DEFAULT 'classic', p_media int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p jsonb;
BEGIN
  p := tst.aprep(p_user, p_quote, p_channel, p_style, p_media);
  IF p ->> 'state' IS DISTINCT FROM 'preparing' THEN RETURN p; END IF;
  RETURN tst.afin(p_user, p);
END $$;
CREATE OR REPLACE FUNCTION tst.aused(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.anotice(p_user uuid, p_quote uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.asvc(); r := public.output_notice(p_user, p_quote); PERFORM tst.logout(); RETURN r; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------- existing accounts (created before the rules, unmapped)
-- 1 = an ordinary business with history (two drafts + one quote already Sent before activation), 2 = LIFETIME with history
INSERT INTO auth.users (id, email) SELECT tst.au(n), format('a392-%s@synthetic.test', n) FROM generate_series(1, 4) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, is_lifetime) VALUES
  (tst.au(1), 'a392-1@synthetic.test', 'Synthetic Existing', 'Local', 'ILS', false),
  (tst.au(2), 'a392-2@synthetic.test', 'Synthetic Lifetime', 'Local', 'ILS', true);
INSERT INTO public.clients (id, company_name, email, user_id) VALUES
  (tst.ac(1), 'Synthetic Customer 1', 'a392-c1@synthetic.test', tst.au(1)),
  (tst.ac(2), 'Synthetic Customer 2', 'a392-c2@synthetic.test', tst.au(2)),
  (tst.ac(3), 'Synthetic Customer 3', 'a392-c3@synthetic.test', tst.au(3));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.aq(n), tst.au(1), 39200 + n, 'draft', tst.ac(1), format('existing quote %s', n) FROM generate_series(1, 11) n;
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES
  (tst.aq(50), tst.au(1), 39250, 'sent', tst.ac(1), 'sent before activation');
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.aq(100 + n), tst.au(2), 39300 + n, 'draft', tst.ac(2), format('lifetime quote %s', n) FROM generate_series(1, 12) n;

SELECT tst.ok(public.subscription_unmapped_accounts() >= 2, 'A0 the two existing accounts are unmapped before the Owner mapping');

-- ---------------------------------------------------------------------------------- A1. the Owner cohort mapping (once)
SELECT tst.ok((public.free10_map_existing_accounts('Owner console 2026-10-18 synthetic attestation for the test') ->> 'ok') = 'true',
  'A1 the existing-account mapping applies');
SELECT tst.ok((SELECT account_mode FROM public.account_entitlements WHERE user_id = tst.au(1)) = 'free_10' AND tst.aused(tst.au(1)) = 0,
  'A1 an existing business with history starts at 0 of 10 (history granted by the Owner rule)');
SELECT tst.ok((SELECT account_mode || '/' || style_plan_id FROM public.account_entitlements WHERE user_id = tst.au(2)) = 'paid/visual',
  'A1 a LIFETIME account is mapped to paid / visual');
SELECT tst.ok(public.subscription_unmapped_accounts() = 0, 'A1 nothing is left unmapped');
SELECT tst.ok((public.free10_map_existing_accounts('Owner console 2026-10-18 synthetic attestation for the test') ->> 'mapped') = '0',
  'A1 a second run maps nothing (replay-safe)');

-- --------------------------------------------------------------------------------------- A2. a NEW account at signup
SET LOCAL tekango.skip_signup_provisioning = 'off';
INSERT INTO public.business_settings (user_id, email, business_name, country, currency) VALUES
  (tst.au(3), 'a392-3@synthetic.test', 'Synthetic New', 'Local', 'ILS');
SELECT tst.ok((SELECT account_mode FROM public.account_entitlements WHERE user_id = tst.au(3)) = 'free_10' AND tst.aused(tst.au(3)) = 0,
  'A2 a new account is provisioned when its business row is created (0 of 10)');
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES (tst.aq(200), tst.au(3), 39400, 'draft', tst.ac(3), 'new account quote');

-- ------------------------------------------------------------------------------------------------------- enforcement on
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';

-- ------------------------------------------------------------------- A3. ten count, a re-send never counts, the eleventh is refused
SELECT tst.ok((tst.anotice(tst.au(1), tst.aq(1)) ->> 'wouldConsume') = 'true' AND (tst.anotice(tst.au(1), tst.aq(1)) ->> 'remaining') = '10',
  'A3 the notice says the first output uses one of the 10 (10 remaining)');
SELECT tst.ok((tst.aout(tst.au(1), tst.aq(1)) ->> 'state') = 'finalized' AND tst.aused(tst.au(1)) = 1, 'A3 the first output counts (1 of 10)');
SELECT tst.ok((tst.anotice(tst.au(1), tst.aq(1)) ->> 'wouldConsume') = 'false', 'A3 the notice says a re-send of the same version does not count');
SELECT tst.ok((tst.aout(tst.au(1), tst.aq(1), 'public_share') ->> 'ok') = 'true' AND tst.aused(tst.au(1)) = 1,
  'A3 the same version on another channel never counts again');
SELECT tst.ok((SELECT bool_and((tst.aout(tst.au(1), tst.aq(n)) ->> 'state') = 'finalized') FROM generate_series(2, 10) n) AND tst.aused(tst.au(1)) = 10,
  'A3 outputs 2..10 count (10 of 10)');
SELECT tst.ok((tst.aout(tst.au(1), tst.aq(11)) ->> 'code') = 'free_issue_limit_reached' AND tst.aused(tst.au(1)) = 10,
  'A3 the eleventh new quote is refused (free_issue_limit_reached) and nothing is consumed');

-- ------------------------------------------------------------ A4. a quote Sent before activation: output again, never counted
SELECT tst.ok((tst.anotice(tst.au(1), tst.aq(50)) ->> 'wouldConsume') = 'false', 'A4 the notice says a pre-activation Sent quote does not count');
SELECT tst.ok((tst.aout(tst.au(1), tst.aq(50)) ->> 'state') = 'finalized' AND tst.aused(tst.au(1)) = 10,
  'A4 a pre-activation Sent quote is output again even at 10 of 10, and never counts');
SELECT tst.ok((SELECT counted_against_free FROM public.quote_issue_ledger WHERE quote_id = tst.aq(50)) = false,
  'A4 its ledger row is recorded as not counted');

-- ----------------------------------------------------------------------------- A5. LIFETIME / paid: unlimited, never counted
SELECT tst.ok((tst.anotice(tst.au(2), tst.aq(101)) ->> 'wouldConsume') = 'false' AND (tst.anotice(tst.au(2), tst.aq(101)) ->> 'unlimited') = 'true',
  'A5 the notice says LIFETIME never uses a free quote (unlimited)');
SELECT tst.ok((SELECT bool_and((tst.aout(tst.au(2), tst.aq(100 + n)) ->> 'state') = 'finalized') FROM generate_series(1, 12) n),
  'A5 twelve LIFETIME outputs all pass (no limit)');
SELECT tst.ok(tst.aused(tst.au(2)) = 0 AND (SELECT count(*) FROM public.quote_issue_ledger WHERE user_id = tst.au(2) AND NOT counted_against_free) = 12,
  'A5 LIFETIME outputs are recorded and never counted');

-- --------------------------------------------------- A6. every style + media in the free period; attachments are SMART PACK
-- 20261021400000 (Owner 2026-10-20, the approved stage-2 plan + decisions20261020c): quote file attachments belong to SMART PACK,
-- replacing the 2026-10-18 "attachments allowed". This account signed up BEFORE the activation day, so it has no SMART PACK until it
-- adds it: a new attachment is refused (the SMART PACK cases are proved in test 403).
SELECT tst.throws(format($q$ INSERT INTO public.quote_attachments (quote_id, file_name, file_url, file_size, storage_path)
                             VALUES (%L, 'plan.pdf', 'https://example.invalid/plan.pdf', 1000, 'quote-attachments/plan.pdf') $q$, tst.aq(200)),
  'smart_pack_required', 'A6a an account from before the activation day: a new quote attachment needs SMART PACK');
SELECT tst.ok((tst.aout(tst.au(3), tst.aq(200), 'send', 'visual', 2) ->> 'state') = 'finalized' AND tst.aused(tst.au(3)) = 1,
  'A6 a free account outputs a quote in the visual style with media (counted once)');

-- ------------------------------------------------------------------------------------- A7. the counter is a cache of the ledger
SELECT tst.ok((SELECT count(*) FROM public.account_entitlements e WHERE e.user_id IN (tst.au(1), tst.au(2), tst.au(3))
                 AND e.free_issues_consumed = (SELECT count(*) FROM public.quote_issue_ledger l WHERE l.user_id = e.user_id AND l.counted_against_free)) = 3,
  'A7 the counter equals the counted ledger rows for every account');

-- -------------------------------- A8. a LIFETIME flag granted AFTER activation (the row stays free_10) is unlimited too
SET LOCAL session_replication_role = replica;  -- test device for ONE statement: the admin grant itself is proven by spec-admin
UPDATE public.business_settings SET is_lifetime = true WHERE user_id = tst.au(1);
SET LOCAL session_replication_role = origin;
DO $$
BEGIN
  INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES (tst.aq(60), tst.au(1), 39260, 'draft', tst.ac(1), 'after lifetime');
  PERFORM tst.ok(true, 'A8 at 10 of 10 a LIFETIME-flagged account still creates a new quote');
EXCEPTION WHEN OTHERS THEN
  PERFORM tst.ok(false, 'A8 the new quote of a LIFETIME-flagged account was refused: ' || SQLERRM);
END $$;
SELECT tst.ok((tst.anotice(tst.au(1), tst.aq(60)) ->> 'wouldConsume') = 'false' AND (tst.aout(tst.au(1), tst.aq(60)) ->> 'state') = 'finalized'
              AND tst.aused(tst.au(1)) = 10, 'A8 its output passes without counting (still 10)');

ROLLBACK;
