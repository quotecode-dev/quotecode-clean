-- PayPlus stage 2 - the Free plan server rule (Owner 2026-10-20, migration 20261021100000). Disposable postgres:17 harness ONLY.
-- Proves: nothing counts or starts while free_issue is not enforced; on the activation day every Free account's 7-day window starts
-- (a new account at its provisioning), a rollback + re-activation never restarts it; a quote counts ONCE per (quote, customer) when
-- it is saved with a customer and an item (never an empty draft, never an edit, never a quote Sent before activation); the first
-- output of a counted (quote, customer) never counts again, a changed version output still counts; at 10 the next counted save /
-- new quote is refused while the counted quotes stay usable; after 7 days (10 not reached) the same, with free_period_ended;
-- LIFETIME and paid accounts are never counted and never end; the counter equals both ledgers; the summary / notice / balance
-- tell the window. The WHOLE file runs in ONE transaction that is rolled back at the end (phase rows are test devices).
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';  -- entitlements are seeded by hand below (except S2)

CREATE OR REPLACE FUNCTION tst.wu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.wq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4001000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.wc(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4002000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.wsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.wdigest(p_user uuid, p_quote uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)) $$;
CREATE OR REPLACE FUNCTION tst.wprep(p_user uuid, p_quote uuid, p_channel text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := tst.wdigest(p_user, p_quote); r jsonb;
BEGIN
  PERFORM tst.wsvc();
  r := public.prepare_quote_output(p_user, p_quote, p_channel, format('out:%s:%s:%s', p_quote, p_channel, d), d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.wfin(p_user uuid, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p ->> 'snapshotPath', jsonb_build_object('size', 100))
  ON CONFLICT (bucket_id, name) DO NOTHING;
  PERFORM tst.wsvc();
  r := public.finalize_quote_output(p_user, (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.wout(p_user uuid, p_quote uuid, p_channel text DEFAULT 'send') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p jsonb;
BEGIN
  p := tst.wprep(p_user, p_quote, p_channel);
  IF p ->> 'state' IS DISTINCT FROM 'preparing' THEN RETURN p; END IF;
  RETURN tst.wfin(p_user, p);
END $$;
CREATE OR REPLACE FUNCTION tst.wused(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.wsaves(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.quote_save_counts WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.wnotice(p_user uuid, p_quote uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.wsvc(); r := public.output_notice(p_user, p_quote); PERFORM tst.logout(); RETURN r; END $$;
-- a new draft (optionally with customer) and its first item, the way the editor saves: quote row, then the item rows
CREATE OR REPLACE FUNCTION tst.wsave(p_user uuid, p_quote uuid, p_num int, p_client uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES (p_quote, p_user, p_num, 'draft', p_client, 'w');
  INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (p_quote, 'Synthetic item', 1, 100, 100);
END $$;
-- DB-owner test device: back-date a started window (the guard refuses this to every role; triggers are off for this one statement)
CREATE OR REPLACE FUNCTION tst.wback(p_user uuid, p_ago interval) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.account_entitlements SET free_window_starts_at = now() - p_ago WHERE user_id = p_user;
  PERFORM set_config('session_replication_role', 'origin', true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------------------------------------------- fixtures
-- 1 ordinary Free, 2 Free for the 7-day window, 3 LIFETIME on a Free row, 4 paid, 5 Free provisioned while not enforced
INSERT INTO auth.users (id, email) SELECT tst.wu(n), format('w400-%s@synthetic.test', n) FROM generate_series(1, 7) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, is_lifetime)
  SELECT tst.wu(n), format('w400-%s@synthetic.test', n), format('Synthetic W400 %s', n), 'Local', 'ILS', n = 3 FROM generate_series(1, 5) n;
INSERT INTO public.account_entitlements (user_id, account_mode) SELECT tst.wu(n), 'free_10' FROM generate_series(1, 3) n;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id) VALUES (tst.wu(4), 'paid', 'visual');
INSERT INTO public.clients (id, company_name, email, user_id)
  SELECT tst.wc(n), format('Synthetic Customer %s', n), format('w400-c%s@synthetic.test', n), tst.wu(CASE WHEN n <= 3 THEN 1 ELSE n - 2 END)
    FROM generate_series(1, 7) n;  -- c1..c3 -> user 1, c4 -> user 2, c5 -> user 3, c6 -> user 4, c7 -> user 5
-- a quote Sent before activation (user 1) and a draft saved with customer + item before activation (user 1)
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES (tst.wq(90), tst.wu(1), 40090, 'sent', tst.wc(1), 'sent before');
SELECT tst.wsave(tst.wu(1), tst.wq(91), 40091, tst.wc(1));

-- ------------------------------------------------------------------------------------------ S0. schema + not enforced = inert
SELECT tst.ok(to_regclass('public.quote_save_counts') IS NOT NULL
          AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'account_entitlements' AND column_name = 'free_window_starts_at')
          AND (SELECT count(*) FROM pg_trigger WHERE tgname IN ('quotes_free10_count_on_save', 'quote_items_free10_count_on_save',
                                                                'account_entitlements_free_window_stamp', 'subscription_activation_free_window_start')
                                                 AND NOT tgisinternal) = 4,
  'S0a the save ledger, the window column and the four triggers exist');
SELECT tst.ok((SELECT phase FROM public.subscription_activation WHERE component = 'free_issue') <> 'enforced',
  'S0b the migrations leave free_issue NOT enforced');
SELECT tst.ok(tst.wused(tst.wu(1)) = 0 AND tst.wsaves(tst.wu(1)) = 0
          AND (SELECT free_window_starts_at FROM public.account_entitlements WHERE user_id = tst.wu(1)) IS NULL
          AND public.free10_ends_at(tst.wu(1)) IS NULL AND NOT public.free10_period_ended(tst.wu(1)),
  'S0c not enforced: a save with customer + item counts nothing and no window starts');

-- ------------------------------------------------------------------------------------------------- S1. activation day
UPDATE public.subscription_activation SET phase = 'shadow' WHERE component = 'free_issue';
SELECT tst.ok((SELECT free_window_starts_at FROM public.account_entitlements WHERE user_id = tst.wu(1)) IS NULL,
  'S1a shadow starts no window');
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
SELECT tst.ok((SELECT free_window_starts_at FROM public.account_entitlements WHERE user_id = tst.wu(1)) = now()
          AND (SELECT free_window_starts_at FROM public.account_entitlements WHERE user_id = tst.wu(2)) = now()
          AND (SELECT free_window_starts_at FROM public.account_entitlements WHERE user_id = tst.wu(4)) IS NULL
          AND (SELECT entitlement_version FROM public.account_entitlements WHERE user_id = tst.wu(1)) = 2,
  'S1b enforced: every Free account starts its 7 days now (version + 1); a paid account has no window');
SELECT tst.ok(public.free10_ends_at(tst.wu(1)) = now() + interval '168 hours' AND public.free10_ends_at(tst.wu(3)) IS NULL
          AND public.free10_ends_at(tst.wu(4)) IS NULL,
  'S1c the window ends 168 hours later; LIFETIME and paid never end');

-- --------------------------------------------------------------------------------------------- S2. new account while enforced
SET LOCAL tekango.skip_signup_provisioning = 'off';
INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  VALUES (tst.wu(6), 'w400-6@synthetic.test', 'Synthetic W400 6', 'Local', 'ILS');
SELECT tst.ok((SELECT account_mode = 'free_10' AND free_window_starts_at = now() AND free_issues_consumed = 0
                 FROM public.account_entitlements WHERE user_id = tst.wu(6)),
  'S2 a new signup while enforced: Free, 0 of 10, its 7 days start at the signup');
SET LOCAL tekango.skip_signup_provisioning = 'on';

-- ------------------------------------------------------------------------------------------------------- S3. count on save
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES (tst.wq(1), tst.wu(1), 40001, 'draft', tst.wc(1), 'w');
SELECT tst.ok(tst.wused(tst.wu(1)) = 0, 'S3a a quote with a customer but no item counts nothing');
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.wq(1), 'Synthetic item', 1, 100, 100);
SELECT tst.ok(tst.wused(tst.wu(1)) = 1 AND tst.wsaves(tst.wu(1)) = 1, 'S3b its first item: the quote counts (1)');
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.wq(1), 'Synthetic item 2', 2, 50, 100);
UPDATE public.quotes SET notes = 'edited' WHERE id = tst.wq(1);
UPDATE public.quote_items SET unit_price = 120, total_price = 120 WHERE quote_id = tst.wq(1) AND description = 'Synthetic item';
SELECT tst.ok(tst.wused(tst.wu(1)) = 1 AND tst.wsaves(tst.wu(1)) = 1, 'S3c more items, edits and saving again never count again (1)');
-- the structured save deletes and re-inserts the items
DELETE FROM public.quote_items WHERE quote_id = tst.wq(1);
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.wq(1), 'Synthetic item', 1, 100, 100);
SELECT tst.ok(tst.wused(tst.wu(1)) = 1, 'S3d items replaced by the structured save: still 1');

INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES (tst.wq(2), tst.wu(1), 40002, 'draft', NULL, 'w');
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.wq(2), 'Synthetic item', 1, 100, 100);
SELECT tst.ok(tst.wused(tst.wu(1)) = 1, 'S3e a draft with items but no customer counts nothing');
UPDATE public.quotes SET client_id = tst.wc(1) WHERE id = tst.wq(2);
SELECT tst.ok(tst.wused(tst.wu(1)) = 2, 'S3f its customer is chosen: it counts (2)');
UPDATE public.quotes SET client_id = tst.wc(2) WHERE id = tst.wq(2);
SELECT tst.ok(tst.wused(tst.wu(1)) = 3, 'S3g another customer for the same quote: counts again (3)');
UPDATE public.quotes SET client_id = tst.wc(1) WHERE id = tst.wq(2);
SELECT tst.ok(tst.wused(tst.wu(1)) = 3, 'S3h back to a customer it was already counted for: no count (3)');

INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.wq(90), 'late item', 1, 1, 1);
SELECT tst.ok(tst.wused(tst.wu(1)) = 3, 'S3i a new item on a quote Sent before activation never counts (3)');
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.wq(91), 'new item', 1, 1, 1);
SELECT tst.ok(tst.wused(tst.wu(1)) = 4, 'S3j a pre-activation draft saved again with a new item after activation counts once (4)');

-- ------------------------------------------------------------------------------------------- S4. outputs after a counted save
DO $$ DECLARE n jsonb; r jsonb; BEGIN
  n := tst.wnotice(tst.wu(1), tst.wq(1));
  PERFORM tst.ok(n ->> 'wouldConsume' = 'false' AND n ->> 'alreadyFinalized' = 'false', 'S4a the notice: the first output of a counted quote would not count');
  r := tst.wout(tst.wu(1), tst.wq(1), 'send');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.wused(tst.wu(1)) = 4
                 AND (SELECT NOT counted_against_free FROM public.quote_issue_ledger WHERE user_id = tst.wu(1) AND quote_id = tst.wq(1)),
    'S4b its first output passes and is recorded, never counted (4)');
  PERFORM tst.ok(tst.wout(tst.wu(1), tst.wq(1), 'final_pdf') ->> 'alreadyFinalized' = 'true' AND tst.wused(tst.wu(1)) = 4,
    'S4c the same version again (PDF): no count (4)');
  UPDATE public.quote_items SET unit_price = 150, total_price = 150 WHERE quote_id = tst.wq(1);
  n := tst.wnotice(tst.wu(1), tst.wq(1));
  r := tst.wout(tst.wu(1), tst.wq(1), 'send');
  PERFORM tst.ok(n ->> 'wouldConsume' = 'true' AND r ->> 'state' = 'finalized' AND tst.wused(tst.wu(1)) = 5,
    'S4d a changed version output to the customer counts, as before (5)');
  r := tst.wout(tst.wu(1), tst.wq(91), 'send');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.wused(tst.wu(1)) = 5, 'S4e the first output of the other counted quote: no count (5)');
END $$;

-- ------------------------------------------------------------------------------------------------------------ S5. the limit
SELECT tst.wsave(tst.wu(1), tst.wq(10 + n), 40010 + n, tst.wc(3)) FROM generate_series(1, 5) n;
SELECT tst.ok(tst.wused(tst.wu(1)) = 10, 'S5a five more saved quotes: 10 of 10');
SELECT tst.throws(format('INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES (%L, %L, 40030, %L, NULL)',
                         tst.wq(30), tst.wu(1), 'draft'),
  'free_issue_limit_reached', 'S5b at 10 a new quote is refused');
SELECT tst.throws(format('UPDATE public.quotes SET client_id = %L WHERE id = %L', tst.wc(3), tst.wq(2)),
  'free_issue_limit_reached', 'S5c at 10 a counted save (a new customer for a quote) is refused and the save rolls back');
SELECT tst.ok((SELECT client_id FROM public.quotes WHERE id = tst.wq(2)) = tst.wc(1) AND tst.wused(tst.wu(1)) = 10, 'S5d the refused save changed nothing');
DO $$ DECLARE r jsonb; BEGIN
  r := tst.wout(tst.wu(1), tst.wq(11), 'send');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.wused(tst.wu(1)) = 10, 'S5e at 10 a quote already counted at its save is still sent (10)');
  UPDATE public.quote_items SET unit_price = 160, total_price = 160 WHERE quote_id = tst.wq(1);
  r := tst.wout(tst.wu(1), tst.wq(1), 'send');
  PERFORM tst.ok(r ->> 'code' = 'free_issue_limit_reached' AND tst.wused(tst.wu(1)) = 10, 'S5f at 10 a changed version that would count is refused');
  -- the editor's structured save (items deleted and inserted again) of a quote counted at its save, and of an output-counted one
  DELETE FROM public.quote_items WHERE quote_id IN (tst.wq(11), tst.wq(1));
  INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price)
    VALUES (tst.wq(11), 'saved again at 10', 1, 90, 90), (tst.wq(1), 'saved again at 10', 1, 90, 90);
  PERFORM tst.ok((SELECT count(*) FROM public.quote_items WHERE quote_id IN (tst.wq(11), tst.wq(1)) AND description = 'saved again at 10') = 2
                 AND tst.wused(tst.wu(1)) = 10, 'S5g at 10 the full editor save of an already-counted quote still saves (10)');
END $$;

-- ------------------------------------------------------------------------------------------------------ S6. the 7 days end first
SELECT tst.wsave(tst.wu(2), tst.wq(40), 40040, tst.wc(4));
SELECT tst.wsave(tst.wu(2), tst.wq(41), 40041, tst.wc(4));
SELECT tst.wback(tst.wu(2), interval '167 hours 59 minutes');
SELECT tst.ok(NOT public.free10_period_ended(tst.wu(2)), 'S6a one minute before the end the period is open');
SELECT tst.wsave(tst.wu(2), tst.wq(42), 40042, tst.wc(4));
SELECT tst.ok(tst.wused(tst.wu(2)) = 3, 'S6b ... and a save still counts (3)');
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES (tst.wq(45), tst.wu(2), 40045, 'draft', NULL, 'no customer yet');
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.wq(45), 'Synthetic item', 1, 100, 100);
DO $$ DECLARE r jsonb; p jsonb; p42 jsonb; BEGIN
  r := tst.wout(tst.wu(2), tst.wq(40), 'send');  -- quote 40 output before the end (covered by its save)
  -- a changed version is prepared inside the window (it would count); quote 42 (counted at its save) is prepared too (covered)
  UPDATE public.quote_items SET unit_price = 165, total_price = 165 WHERE quote_id = tst.wq(40);
  p := tst.wprep(tst.wu(2), tst.wq(40), 'send');
  p42 := tst.wprep(tst.wu(2), tst.wq(42), 'send');
  PERFORM tst.ok(p ->> 'state' = 'preparing' AND p42 ->> 'state' = 'preparing' AND public.quote_output_live_reservations(tst.wu(2), NULL) = 1,
    'S6n1 two live outputs: only the one that would count holds a free slot (1)');
  -- the 7 days end before they finish
  PERFORM tst.wback(tst.wu(2), interval '168 hours');
  r := tst.wfin(tst.wu(2), p);
  PERFORM tst.ok(r ->> 'code' = 'free_issue_limit_reached' AND r ->> 'reason' = 'free_period_ended'
                 AND (SELECT state = 'aborted' AND failure_code = 'free_period_ended' FROM public.quote_output_attempts WHERE attempt_id = (p ->> 'attemptId')::uuid)
                 AND tst.wused(tst.wu(2)) = 3,
    'S6n2 the counted output that the end overtook is aborted at finalize (free_period_ended), nothing counted');
  r := tst.wfin(tst.wu(2), p42);
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.wused(tst.wu(2)) = 3, 'S6n3 the covered output finishes after the end (3)');
  UPDATE public.quote_items SET unit_price = 100, total_price = 100 WHERE quote_id = tst.wq(40);  -- back to the version already output
END $$;
SELECT tst.ok(public.free10_period_ended(tst.wu(2)) AND tst.wused(tst.wu(2)) = 3, 'S6c exactly 168 hours: the period ended with 3 of 10 used');
SELECT tst.throws(format('INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES (%L, %L, 40043, %L, NULL)',
                         tst.wq(43), tst.wu(2), 'draft'),
  'free_period_ended', 'S6d after 7 days a new quote is refused (free_period_ended)');
SELECT tst.throws(format('UPDATE public.quotes SET client_id = %L WHERE id = %L', tst.wc(4), tst.wq(45)),
  'free_period_ended', 'S6m after 7 days a counted save (a customer for a draft with items) is refused');
SELECT tst.ok((SELECT client_id FROM public.quotes WHERE id = tst.wq(45)) IS NULL AND tst.wused(tst.wu(2)) = 3, 'S6m2 ... and rolled back (3)');
DO $$ DECLARE r jsonb; s jsonb; b jsonb; BEGIN
  r := tst.wout(tst.wu(2), tst.wq(41), 'send');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.wused(tst.wu(2)) = 3, 'S6e a quote counted before the end is still sent (3)');
  PERFORM tst.ok(tst.wout(tst.wu(2), tst.wq(40), 'final_print') ->> 'alreadyFinalized' = 'true', 'S6f an already-output version prints again');
  UPDATE public.quote_items SET unit_price = 170, total_price = 170 WHERE quote_id = tst.wq(40);
  r := tst.wout(tst.wu(2), tst.wq(40), 'send');
  PERFORM tst.ok(r ->> 'code' = 'free_issue_limit_reached' AND r ->> 'reason' = 'free_period_ended'
                 AND (r -> 'freeIssues' ->> 'periodEnded')::boolean AND r -> 'freeIssues' ? 'endsAt' AND tst.wused(tst.wu(2)) = 3,
    'S6g a changed version that would count is refused: the closed-contract code, reason free_period_ended');
  s := public.account_summary_build(tst.wu(2), false);
  PERFORM tst.ok((s -> 'free10' ->> 'periodEnded')::boolean AND (s -> 'free10' ->> 'endsAt') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
                 AND (s -> 'free10' ->> 'remaining')::int = 7,
    'S6h the summary: periodEnded true, endsAt set, remaining stays 10 - used (7)');
  PERFORM tst.login(tst.wu(2));
  b := public.get_free_issue_balance(NULL);
  PERFORM tst.logout();
  PERFORM tst.ok((b ->> 'periodEnded')::boolean AND b ? 'freeEndsAt', 'S6i the owner balance tells the period ended');
  PERFORM tst.ok((tst.wnotice(tst.wu(2), tst.wq(40)) ->> 'periodEnded')::boolean, 'S6j the notice tells the period ended');
END $$;
SELECT tst.ok(NOT (public.account_summary_build(tst.wu(1), false) -> 'free10' ->> 'periodEnded')::boolean,
  'S6l the other account is not ended');
UPDATE public.subscription_activation SET phase = 'shadow' WHERE component = 'free_issue';
SELECT tst.ok(NOT public.free10_period_ended(tst.wu(2)) AND NOT (public.account_summary_build(tst.wu(2), false) -> 'free10' ->> 'periodEnded')::boolean,
  'S6o shadow: an ended window refuses nothing (inert)');
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';

-- --------------------------------------------------------------------------------------------- S7. LIFETIME and paid accounts
SELECT tst.wsave(tst.wu(3), tst.wq(50 + n), 40050 + n, tst.wc(5)) FROM generate_series(1, 11) n;
SELECT tst.wback(tst.wu(3), interval '30 days');
SELECT tst.ok(tst.wused(tst.wu(3)) = 0 AND tst.wsaves(tst.wu(3)) = 0 AND NOT public.free10_period_ended(tst.wu(3)),
  'S7a LIFETIME: eleven saved quotes count nothing and its free period never ends');
SELECT tst.wsave(tst.wu(4), tst.wq(70 + n), 40070 + n, tst.wc(6)) FROM generate_series(1, 11) n;
SELECT tst.ok(tst.wused(tst.wu(4)) = 0 AND tst.wsaves(tst.wu(4)) = 0, 'S7b paid: eleven saved quotes count nothing');

-- ------------------------------------------------------------------------------------- S8. rollback + re-activation of the phase
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES (tst.wu(7), 'free_10');
UPDATE public.subscription_activation SET phase = 'prepared' WHERE component = 'free_issue';
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES (tst.wu(5), 'free_10');
SELECT tst.wsave(tst.wu(5), tst.wq(95), 40095, tst.wc(7));
SELECT tst.ok((SELECT free_window_starts_at FROM public.account_entitlements WHERE user_id = tst.wu(5)) IS NULL AND tst.wused(tst.wu(5)) = 0,
  'S8a rolled back to prepared: a new account gets no window and its save counts nothing');
SELECT tst.wback(tst.wu(1), interval '1 hour');
SELECT tst.wback(tst.wu(7), interval '2 hours');
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
SELECT tst.ok((SELECT free_window_starts_at FROM public.account_entitlements WHERE user_id = tst.wu(5)) = now()
          AND (SELECT free_window_starts_at FROM public.account_entitlements WHERE user_id = tst.wu(1)) = now() - interval '1 hour'
          AND (SELECT free_window_starts_at FROM public.account_entitlements WHERE user_id = tst.wu(7)) = now() - interval '2 hours',
  'S8b re-activated: only accounts without a window start now; a started window is never restarted');
SELECT tst.throws(format('UPDATE public.account_entitlements SET free_window_starts_at = now() WHERE user_id = %L', tst.wu(1)),
  'never changes', 'S8c a started window cannot be moved');
SELECT tst.throws(format('UPDATE public.account_entitlements SET free_window_starts_at = NULL WHERE user_id = %L', tst.wu(1)),
  'never changes', 'S8d ... nor cleared');
SELECT tst.throws(format('INSERT INTO public.account_entitlements (user_id, account_mode, free_window_starts_at) VALUES (%L, %L, now() - interval %L)',
                         gen_random_uuid(), 'free_10', '1 day'),
  'starts only now', 'S8e a window never starts in the past');
DO $$ BEGIN
  PERFORM tst.wsvc();
  PERFORM tst.throws(format('UPDATE public.account_entitlements SET free_window_starts_at = now() + interval %L WHERE user_id = %L', '30 days', tst.wu(2)),
    'never changes', 'S8f the server role cannot extend a window either');
  PERFORM tst.logout();
END $$;

-- ------------------------------------------------------------------------------------------------ S9. integrity of the counter
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM public.account_entitlements e
   WHERE e.free_issues_consumed <> (SELECT count(*) FROM public.quote_issue_ledger l WHERE l.user_id = e.user_id AND l.counted_against_free)
                                  + (SELECT count(*) FROM public.quote_save_counts s WHERE s.user_id = e.user_id AND s.counted_against_free)),
  'S9a every counter equals its counted outputs + counted saves');
SELECT tst.throws(format('UPDATE public.quote_save_counts SET counted_against_free = false WHERE user_id = %L', tst.wu(1)),
  'append-only', 'S9b the save ledger is append-only');
SELECT tst.throws(format('DELETE FROM public.quote_save_counts WHERE user_id = %L', tst.wu(1)), 'append-only', 'S9b2 ... no delete');
SELECT tst.throws(format('UPDATE public.account_entitlements SET free_issues_consumed = 0 WHERE user_id = %L', tst.wu(1)),
  'must equal the counted ledger rows', 'S9c a direct counter reset is refused');
DO $$ DECLARE v_own int; v_other int; BEGIN
  PERFORM tst.login(tst.wu(1));
  SELECT count(*) INTO v_own FROM public.quote_save_counts WHERE user_id = tst.wu(1);
  SELECT count(*) INTO v_other FROM public.quote_save_counts WHERE user_id = tst.wu(2);
  PERFORM tst.logout();
  PERFORM tst.ok(v_own = tst.wsaves(tst.wu(1)) AND v_own > 0 AND v_other = 0, 'S9d a user reads only their own save rows');
END $$;
DO $$ BEGIN
  PERFORM tst.login(tst.wu(1));
  PERFORM tst.throws(format('SELECT public.free10_count_quote_save(%L)', tst.wq(1)), 'permission denied', 'S9e a signed-in user cannot call the save counter');
  PERFORM tst.throws(format('SELECT public.free10_period_ended(%L)', tst.wu(1)), 'permission denied', 'S9f ... nor the window helpers');
  PERFORM tst.logout();
END $$;

ROLLBACK;
