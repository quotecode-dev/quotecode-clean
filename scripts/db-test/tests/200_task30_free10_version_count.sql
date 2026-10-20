-- Task 30 (Owner 2026-10-11): Free-10 is counted per quote VERSION and CUSTOMER (migration 20261011130000). Disposable postgres:17
-- harness ONLY. Simulations: same version on several channels, recipient / customer change, content change, deletion, retry,
-- racers (single-session part; the real parallel sessions are 201_task30_free10_version_concurrency.mjs), the tenth quote and the
-- limit (no bypass by a customer / content change), draft save / preview never counting, enforcement off = nothing counted.
-- The WHOLE file runs in ONE transaction that is rolled back at the end (the phase row is forced by the DB owner as a test device).
BEGIN;
SET tekango.skip_signup_provisioning = 'on';  -- pre-A-1 fixture: this test seeds its entitlements by hand (20261018100000 test device)

CREATE OR REPLACE FUNCTION tst.vu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('dd300000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.vq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('dd310000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.vc(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('dd320000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.vsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.vdigest(p_user uuid, p_quote uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)) $$;
-- the client key format of src/domain/subscriptions/outputAuthority.js: out:<quote>:<channel>:<version digest>
CREATE OR REPLACE FUNCTION tst.vkey(p_user uuid, p_quote uuid, p_channel text) RETURNS text LANGUAGE sql AS $$
  SELECT format('out:%s:%s:%s', p_quote, p_channel, tst.vdigest(p_user, p_quote)) $$;
CREATE OR REPLACE FUNCTION tst.vprep(p_user uuid, p_quote uuid, p_channel text, p_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := tst.vdigest(p_user, p_quote); k text := coalesce(p_key, tst.vkey(p_user, p_quote, p_channel)); r jsonb;
BEGIN
  PERFORM tst.vsvc();
  r := public.prepare_quote_output(p_user, p_quote, p_channel, k, d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.vfin(p_user uuid, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p ->> 'snapshotPath', jsonb_build_object('size', 100))
  ON CONFLICT (bucket_id, name) DO NOTHING;
  PERFORM tst.vsvc();
  r := public.finalize_quote_output(p_user, (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
-- one full output (notice digest -> prepare -> snapshot -> finalize); a non-preparing prepare answer is returned as is
CREATE OR REPLACE FUNCTION tst.vout(p_user uuid, p_quote uuid, p_channel text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p jsonb;
BEGIN
  p := tst.vprep(p_user, p_quote, p_channel);
  IF p ->> 'state' IS DISTINCT FROM 'preparing' THEN RETURN p; END IF;
  RETURN tst.vfin(p_user, p);
END $$;
CREATE OR REPLACE FUNCTION tst.vused(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.vrows(p_user uuid) RETURNS int LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.quote_issue_ledger WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.vnotice(p_user uuid, p_quote uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.vsvc(); r := public.output_notice(p_user, p_quote); PERFORM tst.logout(); RETURN r; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- --------------------------------------------------------------------------------------------------------------- fixtures
INSERT INTO auth.users (id, email) SELECT tst.vu(n), format('v30-%s@synthetic.test', n) FROM generate_series(1, 3) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  SELECT tst.vu(n), format('v30-%s@synthetic.test', n), format('Synthetic V30 %s', n), 'Local', 'ILS' FROM generate_series(1, 3) n;
INSERT INTO public.account_entitlements (user_id, account_mode) SELECT tst.vu(n), 'free_10' FROM generate_series(1, 3) n;
INSERT INTO public.clients (id, company_name, email, user_id) VALUES
  (tst.vc(1), 'Synthetic Customer A', 'v30-a@synthetic.test', tst.vu(1)),
  (tst.vc(2), 'Synthetic Customer B', 'v30-b@synthetic.test', tst.vu(1)),
  (tst.vc(3), 'Synthetic Customer C', 'v30-c@synthetic.test', tst.vu(2)),
  (tst.vc(4), 'Synthetic Customer D', 'v30-d@synthetic.test', tst.vu(2));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, attn_name, notes) VALUES
  (tst.vq(1), tst.vu(1), 93001, 'draft', tst.vc(1), 'Dana', 'v1'),
  (tst.vq(2), tst.vu(1), 93002, 'draft', tst.vc(1), NULL, 'v1');
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.vq(100 + n), tst.vu(2), 93100 + n, 'draft', tst.vc(3), format('quote %s', n) FROM generate_series(1, 11) n;
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.vq(1), 'Synthetic window', 1, 100, 100);

-- ------------------------------------------------------------------------------------------- V0. schema + enforcement off
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_issue_ledger_one_per_quote')
          AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'quote_issue_ledger_one_per_version')
              = 'UNIQUE (user_id, quote_id, customer_binding, content_digest)'
          AND to_regclass('public.quote_output_attempts_one_final') IS NULL
          AND to_regclass('public.quote_output_attempts_one_final_version') IS NOT NULL
          AND to_regclass('public.quote_output_attempts_one_live') IS NOT NULL,
  'V0a uniqueness is per (account, quote, customer, version); at most one live reservation per quote stays');
SELECT tst.ok((SELECT phase FROM public.subscription_activation WHERE component = 'free_issue') IN ('prepared', 'shadow'),
  'V0b the migrations leave free_issue NOT enforced');
UPDATE public.subscription_activation SET phase = 'prepared' WHERE component = 'free_issue';
SELECT tst.ok(tst.vout(tst.vu(1), tst.vq(1), 'send') = '{"ok":false,"code":"not_activated"}'::jsonb AND tst.vused(tst.vu(1)) = 0 AND tst.vrows(tst.vu(1)) = 0,
  'V0c enforcement off (prepared): an output answers not_activated and counts NOTHING');

UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
DO $$ DECLARE r jsonb; r2 jsonb; p jsonb; p2 jsonb; n jsonb; BEGIN
  -- --------------------------------------------------------------------------------------- V1. draft save + preview
  UPDATE public.quotes SET notes = 'v1 edited while draft' WHERE id = tst.vq(1);
  n := tst.vnotice(tst.vu(1), tst.vq(1));
  PERFORM tst.ok(tst.vused(tst.vu(1)) = 0 AND n ->> 'wouldConsume' = 'true' AND n ->> 'alreadyFinalized' = 'false',
    'V1 draft saves and the notice (preview of the cost) count nothing; the first output would count');

  -- --------------------------------------------------------------------------------------- V2. first output counts
  r := tst.vout(tst.vu(1), tst.vq(1), 'final_pdf');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.vused(tst.vu(1)) = 1 AND tst.vrows(tst.vu(1)) = 1, 'V2 first output to the customer counts (1)');

  -- --------------------------------------------------------------------------------------- V3. same version, other channels + retry
  r := tst.vout(tst.vu(1), tst.vq(1), 'send');
  r2 := tst.vout(tst.vu(1), tst.vq(1), 'public_share');
  PERFORM tst.ok(r ->> 'alreadyFinalized' = 'true' AND r2 ->> 'alreadyFinalized' = 'true' AND tst.vout(tst.vu(1), tst.vq(1), 'final_print') ->> 'alreadyFinalized' = 'true'
                 AND tst.vused(tst.vu(1)) = 1 AND tst.vrows(tst.vu(1)) = 1,
    'V3a the SAME version to the SAME customer on send / public_share / final_print: no second count');
  PERFORM tst.ok(tst.vout(tst.vu(1), tst.vq(1), 'final_pdf') ->> 'alreadyFinalized' = 'true' AND tst.vused(tst.vu(1)) = 1,
    'V3b a retry of the same channel + version (same idempotency key) returns the durable result, no second count');
  n := tst.vnotice(tst.vu(1), tst.vq(1));
  PERFORM tst.ok(n ->> 'alreadyFinalized' = 'true' AND n ->> 'wouldConsume' = 'false' AND (n ->> 'remaining')::int = 9,
    'V3c notice for the already-output version: alreadyFinalized, wouldConsume false, remaining 9');

  -- --------------------------------------------------------------------------------------- V4. recipient name change counts
  UPDATE public.quotes SET attn_name = 'Dana Levi' WHERE id = tst.vq(1);
  n := tst.vnotice(tst.vu(1), tst.vq(1));
  PERFORM tst.ok(n ->> 'alreadyFinalized' = 'false' AND n ->> 'wouldConsume' = 'true', 'V4a recipient name changed -> the notice says this output would count');
  r := tst.vout(tst.vu(1), tst.vq(1), 'send');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.vused(tst.vu(1)) = 2, 'V4b recipient name changed + output again -> one more counted quote (2)');
  PERFORM tst.ok((SELECT lower(status) FROM public.quotes WHERE id = tst.vq(1)) = 'sent', 'V4c the send channel marked the quote Sent');

  -- --------------------------------------------------------------------------------------- V5. customer change counts (also when Sent)
  UPDATE public.quotes SET client_id = tst.vc(2) WHERE id = tst.vq(1);  -- allowed now (was refused before Task 30)
  r := tst.vout(tst.vu(1), tst.vq(1), 'public_share');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.vused(tst.vu(1)) = 3, 'V5a another customer for the Sent quote + output -> counts (3)');
  PERFORM tst.ok(tst.vout(tst.vu(1), tst.vq(1), 'send') ->> 'alreadyFinalized' = 'true' AND tst.vused(tst.vu(1)) = 3,
    'V5b the same version for that customer on another channel: no count');
  UPDATE public.quotes SET client_id = tst.vc(1) WHERE id = tst.vq(1);  -- back to customer A with the A-version content (Dana Levi)
  PERFORM tst.ok(tst.vout(tst.vu(1), tst.vq(1), 'final_print') ->> 'alreadyFinalized' = 'true' AND tst.vused(tst.vu(1)) = 3,
    'V5c returning to a customer + version that was already output: no count (same version, same customer)');

  -- --------------------------------------------------------------------------------------- V6. content change counts
  UPDATE public.quote_items SET unit_price = 120, total_price = 120 WHERE quote_id = tst.vq(1);
  p := tst.vprep(tst.vu(1), tst.vq(1), 'send', format('out:%s:send:%s', tst.vq(1), repeat('9', 64)));
  PERFORM tst.ok(p ->> 'code' = 'idempotency_key_reused' OR p ->> 'state' = 'preparing', 'V6a (a fresh key is accepted for a new version)');
  IF p ->> 'state' = 'preparing' THEN PERFORM tst.vfin(tst.vu(1), p); END IF;
  PERFORM tst.ok(tst.vused(tst.vu(1)) = 4, 'V6b changed content + output of the new version -> counts again (4)');
  -- a stale key (the key of the previous version) for the new content is refused, never a second count
  UPDATE public.quote_items SET unit_price = 130, total_price = 130 WHERE quote_id = tst.vq(1);
  p := tst.vprep(tst.vu(1), tst.vq(1), 'send', format('out:%s:send:%s', tst.vq(1), repeat('9', 64)));
  PERFORM tst.ok(p ->> 'code' = 'idempotency_key_reused' AND tst.vused(tst.vu(1)) = 4, 'V6c a key already used by another version is refused (no count)');
  -- the owner saw an older version (stale expected digest): quote_changed, nothing reserved
  PERFORM tst.vsvc();
  p := public.prepare_quote_output(tst.vu(1), tst.vq(1), 'send', 'stale-digest-key-01', repeat('0', 64), 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  PERFORM tst.ok(p ->> 'code' = 'quote_changed' AND p ->> 'contentDigest' = tst.vdigest(tst.vu(1), tst.vq(1)), 'V6d a stale expected digest -> quote_changed with the current digest');

  -- --------------------------------------------------------------------------------------- V7. racers on one quote (single session)
  p := tst.vprep(tst.vu(1), tst.vq(1), 'final_pdf');
  p2 := tst.vprep(tst.vu(1), tst.vq(1), 'final_print');
  PERFORM tst.ok(p ->> 'state' = 'preparing' AND p2 ->> 'state' = 'preparing' AND p2 ->> 'attemptId' = p ->> 'attemptId' AND p2 ->> 'sameQuoteLiveAttempt' = 'true',
    'V7a a second channel for the SAME version while the first is live gets the SAME attempt (one reservation)');
  UPDATE public.quote_items SET unit_price = 140, total_price = 140 WHERE quote_id = tst.vq(1);
  r := tst.vprep(tst.vu(1), tst.vq(1), 'send');  -- digest + key computed by the DB owner, the call itself as service_role
  PERFORM tst.ok(r ->> 'code' = 'output_in_progress', 'V7b another version while one is live -> output_in_progress (no parallel reservation)');
  r := tst.vfin(tst.vu(1), p);
  PERFORM tst.ok(r ->> 'code' = 'quote_changed' AND tst.vused(tst.vu(1)) = 4
                 AND (SELECT state FROM public.quote_output_attempts WHERE attempt_id = (p ->> 'attemptId')::uuid) = 'aborted',
    'V7c the live attempt of the older content cannot finalize after a change (aborted, no count)');
  r := tst.vout(tst.vu(1), tst.vq(1), 'send');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND tst.vused(tst.vu(1)) = 5, 'V7d the new version then outputs and counts once (5)');

  -- --------------------------------------------------------------------------------------- V8. signed quote: no new version
  UPDATE public.quotes SET signature = 'data:image/png;base64,AAAA', status = 'approved' WHERE id = tst.vq(1);
  PERFORM tst.ok(tst.vout(tst.vu(1), tst.vq(1), 'final_pdf') ->> 'alreadyFinalized' = 'true' AND tst.vused(tst.vu(1)) = 5,
    'V8a re-output of the signed version: no count');
  PERFORM tst.throws(format($q$ UPDATE public.quote_items SET unit_price = 150, total_price = 150 WHERE quote_id = %L $q$, tst.vq(1)), 'frozen',
    'V8b the items of a signed / approved quote are frozen by the existing guard (no new content version can be made there)');
  BEGIN
    UPDATE public.quotes SET notes = 'header changed after signing' WHERE id = tst.vq(1);
    PERFORM tst.ok(tst.vout(tst.vu(1), tst.vq(1), 'final_pdf') ->> 'code' = 'quote_closed' AND tst.vused(tst.vu(1)) = 5,
      'V8c a changed header version of a signed / approved quote is refused (quote_closed), never counted');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM ~* '(frozen|not permitted|signed|approved)' AND tst.vused(tst.vu(1)) = 5,
      'V8c the header of a signed / approved quote is frozen too (no new version possible): ' || SQLERRM);
  END;

  -- --------------------------------------------------------------------------------------- V9. deletion never refunds
  PERFORM tst.vout(tst.vu(1), tst.vq(2), 'send');
  PERFORM tst.ok(tst.vused(tst.vu(1)) = 6, 'V9a a second quote counts (6)');
  DELETE FROM public.quote_items WHERE quote_id = tst.vq(2);
  DELETE FROM public.quotes WHERE id = tst.vq(2);
  r := tst.vprep(tst.vu(1), tst.vq(2), 'send', 'deleted-quote-key-01');
  PERFORM tst.ok(tst.vused(tst.vu(1)) = 6 AND tst.vrows(tst.vu(1)) = 6 AND r ->> 'code' = 'document_unavailable' AND r ->> 'reason' = 'quote_deleted',
    'V9b deleting an output quote returns NO quota; the ledger row survives; a later output is document_unavailable');

  -- --------------------------------------------------------------------------------------- V10. the tenth quote and the limit
  FOR i IN 1..10 LOOP PERFORM tst.vout(tst.vu(2), tst.vq(100 + i), CASE i % 4 WHEN 0 THEN 'send' WHEN 1 THEN 'public_share' WHEN 2 THEN 'final_pdf' ELSE 'final_print' END); END LOOP;
  PERFORM tst.ok(tst.vused(tst.vu(2)) = 10 AND tst.vrows(tst.vu(2)) = 10, 'V10a ten different quotes -> 10 counted (the tenth is allowed)');
  r := tst.vout(tst.vu(2), tst.vq(111), 'send');
  PERFORM tst.ok(r ->> 'code' = 'free_issue_limit_reached' AND tst.vused(tst.vu(2)) = 10, 'V10b the eleventh quote is refused (free_issue_limit_reached)');
  PERFORM tst.ok(tst.vout(tst.vu(2), tst.vq(110), 'send') ->> 'alreadyFinalized' = 'true' AND tst.vused(tst.vu(2)) = 10,
    'V10c at the limit, re-sending an already-output version still works and counts nothing');
  UPDATE public.quotes SET client_id = tst.vc(4) WHERE id = tst.vq(110);
  PERFORM tst.ok(tst.vout(tst.vu(2), tst.vq(110), 'send') ->> 'code' = 'free_issue_limit_reached' AND tst.vused(tst.vu(2)) = 10,
    'V10d at the limit, a customer change cannot bypass the quota');
  UPDATE public.quotes SET client_id = tst.vc(3), notes = 'changed content' WHERE id = tst.vq(110);
  PERFORM tst.ok(tst.vout(tst.vu(2), tst.vq(110), 'final_pdf') ->> 'code' = 'free_issue_limit_reached' AND tst.vused(tst.vu(2)) = 10,
    'V10e at the limit, a content change cannot bypass the quota');
  UPDATE public.quotes SET notes = 'quote 10' WHERE id = tst.vq(110);
  PERFORM tst.ok(tst.vout(tst.vu(2), tst.vq(110), 'public_share') ->> 'alreadyFinalized' = 'true' AND tst.vused(tst.vu(2)) = 10,
    'V10f restoring the exact output version (customer + content) is the same version again: no count');

  -- --------------------------------------------------------------------------------------- V11. other account + owner
  PERFORM tst.ok(tst.vused(tst.vu(3)) = 0 AND tst.vrows(tst.vu(3)) = 0, 'V11a an untouched account keeps 0 (no bulk change of usage)');
  PERFORM tst.throws(format($q$ UPDATE public.quotes SET user_id = %L WHERE id = %L $q$, tst.vu(3), tst.vq(101)), 'owner change',
    'V11b the OWNER of an output quote never changes');
END $$;

SELECT tst.ok((SELECT count(*) FROM public.account_entitlements WHERE user_id IN (tst.vu(1), tst.vu(2))
                 AND free_issues_consumed = (SELECT count(*) FROM public.quote_issue_ledger l WHERE l.user_id = account_entitlements.user_id AND l.counted_against_free)) = 2,
  'V12 the counter equals the counted ledger rows for every account (cache of the ledger, no drift)');

ROLLBACK;
