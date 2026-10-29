-- Codex release 1 (Owner 2026-10-29, migration 20261029200000): no quote with a missing price leaves the business.
-- Disposable postgres:17 harness ONLY. Proves: a version with a line without a price is refused on every output channel (send, public
-- share, final PDF, final print) with nothing reserved, counted or marked; a re-send of a version already output that has a line without a
-- price is refused before the "already finalized" answer; an intentional 0 is a price; a complete version still goes out and its re-send
-- still answers the same finalized output; the readiness rule fails closed on a document whose items cannot be read; a price edit
-- between prepare and finalize is still refused by finalize (quote_changed).
-- The WHOLE file runs in ONE transaction that is rolled back at the end (phase rows are test devices of the DB owner).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.gu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4320000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.gq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4321000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.gsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.gdigest(p_user uuid, p_quote uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)) $$;
CREATE OR REPLACE FUNCTION tst.gprep(p_user uuid, p_quote uuid, p_channel text DEFAULT 'send') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := tst.gdigest(p_user, p_quote); p jsonb;
BEGIN
  PERFORM tst.gsvc();
  p := public.prepare_quote_output(p_user, p_quote, p_channel, format('gate:%s:%s:%s', p_quote, p_channel, d), d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN p;
END $$;
CREATE OR REPLACE FUNCTION tst.gfin(p_user uuid, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p ->> 'snapshotPath', jsonb_build_object('size', 100))
  ON CONFLICT (bucket_id, name) DO NOTHING;
  PERFORM tst.gsvc();
  r := public.finalize_quote_output(p_user, (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.gout(p_user uuid, p_quote uuid, p_channel text DEFAULT 'send') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p jsonb := tst.gprep(p_user, p_quote, p_channel);
BEGIN
  IF p ->> 'state' IS DISTINCT FROM 'preparing' THEN RETURN p; END IF;
  RETURN tst.gfin(p_user, p);
END $$;
CREATE OR REPLACE FUNCTION tst.gtrace(p_user uuid, p_quote uuid) RETURNS text LANGUAGE sql AS $$
  SELECT (SELECT count(*) FROM public.quote_output_attempts a WHERE a.user_id = p_user AND a.quote_id = p_quote) || '/'
      || (SELECT count(*) FROM public.quote_issue_ledger l WHERE l.user_id = p_user AND l.quote_id = p_quote) || '/'
      || (SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = p_user) || '/'
      || (SELECT lower(status) FROM public.quotes WHERE id = p_quote) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- --------------------------------------------------------------------------------------------------------------------- fixtures
-- 1 Free (Israel, ILS) | 2 Free (international, USD) - the rule does not depend on the market or the currency
INSERT INTO auth.users (id, email) SELECT tst.gu(n), format('g432-%s@synthetic.test', n) FROM generate_series(1, 2) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role)
  VALUES (tst.gu(1), 'g432-1@synthetic.test', 'Synthetic Gate IL', 'Local', 'ILS', 'free', 'user'),
         (tst.gu(2), 'g432-2@synthetic.test', 'Synthetic Gate Intl', 'International', 'USD', 'free', 'user')
  ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) VALUES (tst.gu(1), 'IL', 'business_settings_country'), (tst.gu(2), 'INTERNATIONAL', 'business_settings_country')
  ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id) VALUES (tst.gu(1), 'free_10', NULL), (tst.gu(2), 'free_10', NULL);
INSERT INTO public.clients (id, company_name, email, user_id) VALUES
  ('a4322000-0000-4000-8000-000000000001', 'Synthetic Customer G1', 'g432-c1@synthetic.test', tst.gu(1)),
  ('a4322000-0000-4000-8000-000000000002', 'Synthetic Customer G2', 'g432-c2@synthetic.test', tst.gu(2));
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
-- q1: one priced line + one line without a price | q2: complete | q3: an intentional 0 | q4: international, a line without a price
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES
  (tst.gq(1), tst.gu(1), 43201, 'draft', 'a4322000-0000-4000-8000-000000000001', 'gate'),
  (tst.gq(2), tst.gu(1), 43202, 'draft', 'a4322000-0000-4000-8000-000000000001', 'gate'),
  (tst.gq(3), tst.gu(1), 43203, 'draft', 'a4322000-0000-4000-8000-000000000001', 'gate'),
  (tst.gq(4), tst.gu(2), 43204, 'draft', 'a4322000-0000-4000-8000-000000000002', 'gate');
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price, price_missing) VALUES
  (tst.gq(1), 'Synthetic priced', 1, 100, 100, false), (tst.gq(1), 'Synthetic unpriced', 1, 0, 0, true),
  (tst.gq(2), 'Synthetic complete', 2, 50, 100, false),
  (tst.gq(3), 'Synthetic free of charge', 1, 0, 0, false),
  (tst.gq(4), 'Synthetic unpriced intl', 1, 0, 0, true);

-- ----------------------------------------------------------------------------------------------------------- G1. the readiness rule
SELECT tst.ok(public.quote_document_price_readiness(public.quote_output_deal_document(tst.gu(1), tst.gq(1))) = '{"state":"missing_price","missing":1}'::jsonb
          AND public.quote_document_price_readiness(public.quote_output_deal_document(tst.gu(1), tst.gq(2))) = '{"state":"ready","missing":0}'::jsonb
          AND public.quote_document_price_readiness(public.quote_output_deal_document(tst.gu(1), tst.gq(3))) = '{"state":"ready","missing":0}'::jsonb,
  'G1 one rule over the canonical document: a line without a price is missing; a complete quote and an intentional 0 are ready');
SELECT tst.ok(public.quote_document_price_readiness(NULL) ->> 'state' = 'price_state_unverified'
          AND public.quote_document_price_readiness('{"items":"x"}'::jsonb) ->> 'state' = 'price_state_unverified'
          AND public.quote_document_price_readiness('{}'::jsonb) ->> 'state' = 'price_state_unverified'
          AND public.quote_document_price_readiness('{"items":[1]}'::jsonb) ->> 'state' = 'missing_price',
  'G1b fail closed: no document / unreadable items are unverified; a malformed line counts as missing');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.quote_document_price_readiness(jsonb)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.quote_document_price_readiness(jsonb)', 'EXECUTE'),
  'G1c the rule is server-only (no anon / authenticated execute)');

-- ------------------------------------------------------------------------------------- G2. every channel refuses, nothing is spent
DO $$
DECLARE ch text; r jsonb; before text := tst.gtrace(tst.gu(1), tst.gq(1));
BEGIN
  FOREACH ch IN ARRAY ARRAY['send', 'public_share', 'final_pdf', 'final_print'] LOOP
    r := tst.gprep(tst.gu(1), tst.gq(1), ch);
    PERFORM tst.ok(r ->> 'ok' = 'false' AND r ->> 'code' = 'missing_price' AND (r ->> 'missingCount')::int = 1,
      format('G2 %s: a quote with a line without a price is refused (missing_price, 1 line)', ch));
  END LOOP;
  PERFORM tst.ok(tst.gtrace(tst.gu(1), tst.gq(1)) = before AND before LIKE '0/0/%/draft',
    'G2b nothing reserved, finalized, counted or marked: no attempt, no ledger row, the Free-10 count unchanged by the refusal (the save rule counted it before), still Draft');
  r := tst.gprep(tst.gu(2), tst.gq(4), 'send');
  PERFORM tst.ok(r ->> 'code' = 'missing_price' AND tst.gtrace(tst.gu(2), tst.gq(4)) LIKE '0/0/%/draft',
    'G2c international (USD) the same - the rule never depends on the market or the currency');
END $$;

-- --------------------------------------------------------------------------- G3. a complete quote and an intentional 0 still go out
DO $$
DECLARE r jsonb;
BEGIN
  r := tst.gout(tst.gu(1), tst.gq(2));
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.gtrace(tst.gu(1), tst.gq(2)) LIKE '1/1/%/sent', 'G3 a complete quote goes out once (Sent)');
  r := tst.gout(tst.gu(1), tst.gq(2));
  PERFORM tst.ok(r ->> 'alreadyFinalized' = 'true' AND tst.gtrace(tst.gu(1), tst.gq(2)) LIKE '1/1/%/sent',
    'G3b its re-send answers the same finalized output - no second count');
  r := tst.gout(tst.gu(1), tst.gq(3));
  PERFORM tst.ok(r ->> 'state' = 'finalized', 'G3c an intentional 0 is a price - that quote goes out');
END $$;

-- ------------------------------------------------- G4. a version already output that has a line without a price: no re-send at all
-- (a pre-gate output of an incomplete version, made here by a DB-owner device: the output's digest = the current incomplete document)
DO $$
DECLARE r jsonb; v text;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.quote_items SET price_missing = true, unit_price = 0, total_price = 0 WHERE quote_id = tst.gq(2);
  v := public.quote_output_digest(public.quote_output_deal_document(tst.gu(1), tst.gq(2)));
  UPDATE public.quote_issue_ledger SET content_digest = v WHERE quote_id = tst.gq(2);
  PERFORM set_config('session_replication_role', 'origin', true);
  FOREACH v IN ARRAY ARRAY['send', 'public_share', 'final_pdf'] LOOP
    r := tst.gprep(tst.gu(1), tst.gq(2), v);
    PERFORM tst.ok(r ->> 'code' = 'missing_price' AND r ->> 'alreadyFinalized' IS NULL AND r -> 'descriptor' IS NULL,
      format('G4 %s of an already-output incomplete version is refused before the finalized answer (no descriptor, no link)', v));
  END LOOP;
  PERFORM tst.ok(tst.gtrace(tst.gu(1), tst.gq(2)) LIKE '1/1/%/sent', 'G4b the historical output itself is untouched (one attempt, one ledger row, Sent)');
END $$;

-- -------------------------------------------------------------- G5. a price removed between prepare and finalize: finalize refuses
DO $$
DECLARE p jsonb; r jsonb;
BEGIN
  INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
    VALUES (tst.gq(5), tst.gu(1), 43205, 'draft', 'a4322000-0000-4000-8000-000000000001', 'gate');
  INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price, price_missing) VALUES (tst.gq(5), 'Synthetic race', 1, 10, 10, false);
  p := tst.gprep(tst.gu(1), tst.gq(5));
  PERFORM tst.ok(p ->> 'state' = 'preparing', 'G5a (fixture) a complete quote is reserved');
  UPDATE public.quote_items SET price_missing = true, unit_price = 0, total_price = 0 WHERE quote_id = tst.gq(5);
  r := tst.gfin(tst.gu(1), p);
  PERFORM tst.ok(r ->> 'code' = 'quote_changed' AND tst.gtrace(tst.gu(1), tst.gq(5)) LIKE '1/0/%/draft',
    'G5 the price removed after prepare: finalize refuses (quote_changed) - nothing finalized, still Draft');
  r := tst.gprep(tst.gu(1), tst.gq(5));
  PERFORM tst.ok(r ->> 'code' = 'missing_price', 'G5b and the next attempt is refused for the missing price');
END $$;

-- ------------------------------------------------------------------------- G6. the Draft itself and its save rule are unchanged
SELECT tst.lives(format('UPDATE public.quotes SET notes = %L WHERE id = %L', 'gate edited', tst.gq(1)),
  'G6 a Draft with a line without a price is still saved and edited normally');
SELECT tst.throws(format('UPDATE public.quotes SET status = %L WHERE id = %L', 'sent', tst.gq(1)), 'only leave Draft through finalize_quote_output',
  'G6b and it never becomes Sent by a direct write (only through the output authority, which refuses it)');

ROLLBACK;
