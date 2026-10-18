-- Continuation (A): the issued document binds the IMMUTABLE logo asset (20261007150800). Disposable postgres:17 harness ONLY.
-- Proves: logo URL without an imported asset still fails closed BEFORE any reservation; with a finalized binding the issuer is
-- 'issuer/v2' carrying the asset identity (no mutable URL) and the output finalizes; a document reserved with A cannot finalize
-- after the owner binds B (issuer_changed); the finalized document keeps A (reuse returns the same attempt; no second
-- consumption); B is used only for a new document; another owner's asset / a reserved (not finalized) asset is never used;
-- removing the logo switch removes the logo from NEW documents only; assets and bindings are never deleted.
-- ONE transaction, rolled back at the end.
BEGIN;
SET tekango.skip_signup_provisioning = 'on';  -- pre-A-1 fixture: this test seeds its entitlements by hand (20261018100000 test device)

CREATE OR REPLACE FUNCTION tst.lu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('ec000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.lq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('eb000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.lsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.lprep(p_user uuid, p_quote uuid, p_channel text, p_key text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)); r jsonb;
BEGIN
  PERFORM tst.lsvc();
  r := public.prepare_quote_output(p_user, p_quote, p_channel, p_key, d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.lfin(p_user uuid, p_attempt uuid, p_path text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p_path, jsonb_build_object('size', 100))
    ON CONFLICT (bucket_id, name) DO NOTHING;
  PERFORM tst.lsvc();
  r := public.finalize_quote_output(p_user, p_attempt, p_path, repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
-- server logo import path (reserve -> object written create-only -> finalize with read-back size), as subscription-authority does it
CREATE OR REPLACE FUNCTION tst.llogo(p_owner uuid, p_fill text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb; f jsonb; sha text := encode(sha256(convert_to(p_fill, 'UTF8')), 'hex');
BEGIN
  PERFORM tst.lsvc();
  r := public.reserve_logo_asset(p_owner, 'image/png', sha, 120, 64, 64);
  PERFORM tst.logout();
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', r ->> 'objectPath', jsonb_build_object('size', 120));
  PERFORM tst.lsvc();
  f := public.finalize_logo_asset(p_owner, (r ->> 'assetId')::uuid, sha, 120);
  PERFORM tst.logout();
  RETURN f;
END $$;
CREATE OR REPLACE FUNCTION tst.liss(p_user uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb; BEGIN r := public.quote_output_issuer(p_user); RETURN r; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- The prep-overlay gates (--extra-migrations subscriptions-prep/sql, subscriptions/run-db-gate.mjs) re-apply the PREPARED SQL after the
-- migrations, which restores the prep issuer/v1 body. The binding is proven in the canonical gate; under the overlay this file
-- records exactly that and asserts nothing else.
SELECT (pg_get_functiondef('public.quote_output_issuer(uuid)'::regprocedure) LIKE '%issuer/v2%') AS logo_binding_active \gset
\if :logo_binding_active

-- fixtures: L1 free with logo URL, L2 another owner with its own asset
INSERT INTO auth.users (id, email) SELECT tst.lu(i), format('xlogo-%s@synthetic.test', i) FROM generate_series(1, 2) i ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, logo_url)
  SELECT tst.lu(i), format('xlogo-%s@synthetic.test', i), format('Synthetic Logo %s', i), 'Local', 'ILS', 'free', 'user',
         'https://example.invalid/logo.png' FROM generate_series(1, 2) i ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.clients (id, company_name, email, user_id)
  SELECT format('ea000000-0000-4000-8000-%s', lpad(i::text, 12, '0'))::uuid, 'Synthetic Logo Customer', 'xlc@synthetic.test', tst.lu(i)
    FROM generate_series(1, 2) i;
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.lq(n), tst.lu(1), 82000 + n, 'draft', 'ea000000-0000-4000-8000-000000000001'::uuid, 'v1' FROM generate_series(1, 5) n;
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES (tst.lu(1), 'free_10'), (tst.lu(2), 'free_10');
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';

-- 1. logo URL but no imported asset: still fail closed, nothing reserved
CREATE TEMP TABLE l1 AS SELECT tst.lprep(tst.lu(1), tst.lq(1), 'send', 'logo-key-1') AS r;
SELECT tst.ok((SELECT r ->> 'code' FROM l1) = 'logo_snapshot_policy_pending', 'LG1 logo URL without immutable asset -> logo_snapshot_policy_pending');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_output_attempts a WHERE a.user_id = tst.lu(1)), 'LG2 nothing reserved before the logo is bound');
SELECT tst.ok((SELECT tst.liss(tst.lu(1)) ->> 'issuerProjection') = 'issuer/v1', 'LG3 issuer stays issuer/v1 until an asset is bound');

-- 2. another owner's asset and a reserved (not finalized) asset of L1 are never used
CREATE TEMP TABLE l_other AS SELECT tst.llogo(tst.lu(2), 'other-owner') AS r;
DO $$ BEGIN PERFORM tst.lsvc(); PERFORM public.reserve_logo_asset(tst.lu(1), 'image/png', repeat('e', 64), 50, 10, 10); PERFORM tst.logout(); END $$;
SELECT tst.ok((SELECT tst.liss(tst.lu(1)) ->> 'issuerProjection') = 'issuer/v1', 'LG4 an unfinalized own asset / another owner''s asset is never bound');

-- 3. import A: issuer/v2 with the asset identity, output finalizes
CREATE TEMP TABLE la AS SELECT tst.llogo(tst.lu(1), 'logo-A') AS r;
SELECT tst.ok((SELECT (r ->> 'ok')::boolean FROM la), 'LG5 logo A imported (reserve -> object -> finalize read-back)');
CREATE TEMP TABLE l_issA AS SELECT tst.liss(tst.lu(1)) AS i;
SELECT tst.ok((SELECT i ->> 'issuerProjection' FROM l_issA) = 'issuer/v2'
  AND (SELECT i -> 'logo' ->> 'assetId' FROM l_issA) = (SELECT r ->> 'assetId' FROM la)
  AND (SELECT i -> 'logo' ->> 'sha256' FROM l_issA) = encode(sha256(convert_to('logo-A', 'UTF8')), 'hex')
  AND (SELECT i -> 'logo' ->> 'objectPath' FROM l_issA) = (SELECT r ->> 'objectPath' FROM la)
  AND NOT ((SELECT i FROM l_issA) ? 'logo_url'), 'LG6 issuer/v2 binds asset A by id/path/sha256 and carries no mutable URL');
CREATE TEMP TABLE l2p AS SELECT tst.lprep(tst.lu(1), tst.lq(1), 'send', 'logo-key-2') AS r;
SELECT tst.ok((SELECT r ->> 'state' FROM l2p) = 'preparing', 'LG7 output with logo A is reserved (pending block lifted only with a bound asset)');
CREATE TEMP TABLE l2f AS SELECT tst.lfin(tst.lu(1), (SELECT (r ->> 'attemptId')::uuid FROM l2p), (SELECT r ->> 'snapshotPath' FROM l2p)) AS r;
SELECT tst.ok((SELECT r ->> 'state' FROM l2f) = 'finalized', 'LG8 output with logo A finalizes');

-- 4. a second document reserved with A, then the owner binds B before finalize: issuer_changed, nothing consumed
CREATE TEMP TABLE l3p AS SELECT tst.lprep(tst.lu(1), tst.lq(2), 'final_pdf', 'logo-key-3') AS r;
CREATE TEMP TABLE lb AS SELECT tst.llogo(tst.lu(1), 'logo-B') AS r;
CREATE TEMP TABLE l3f AS SELECT tst.lfin(tst.lu(1), (SELECT (r ->> 'attemptId')::uuid FROM l3p), (SELECT r ->> 'snapshotPath' FROM l3p)) AS r;
SELECT tst.ok((SELECT r ->> 'code' FROM l3f) = 'issuer_changed', 'LG9 reserved with A, logo changed to B -> finalize refused (issuer_changed)');
SELECT tst.ok((SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.lu(1)) = 1, 'LG10 refused finalize consumed nothing (still 1)');

-- 5. document 1 keeps A: reuse returns the same finalized attempt; no second consumption
CREATE TEMP TABLE l4 AS SELECT tst.lprep(tst.lu(1), tst.lq(1), 'public_share', 'logo-key-4') AS r;
SELECT tst.ok((SELECT r ->> 'attemptId' FROM l4) = (SELECT r ->> 'attemptId' FROM l2p) AND (SELECT r ->> 'state' FROM l4) = 'finalized',
  'LG11 document 1 reuse -> the same finalized attempt (bound to A)');
SELECT tst.ok((SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.lu(1)) = 1, 'LG12 reuse consumed nothing');

-- 6. a NEW document binds B
CREATE TEMP TABLE l5 AS SELECT tst.liss(tst.lu(1)) AS i;
SELECT tst.ok((SELECT i -> 'logo' ->> 'assetId' FROM l5) = (SELECT r ->> 'assetId' FROM lb), 'LG13 new documents bind B (latest finalized binding)');
CREATE TEMP TABLE l6p AS SELECT tst.lprep(tst.lu(1), tst.lq(3), 'send', 'logo-key-6') AS r;
CREATE TEMP TABLE l6f AS SELECT tst.lfin(tst.lu(1), (SELECT (r ->> 'attemptId')::uuid FROM l6p), (SELECT r ->> 'snapshotPath' FROM l6p)) AS r;
SELECT tst.ok((SELECT r ->> 'state' FROM l6f) = 'finalized', 'LG14 new document with B finalizes');
SELECT tst.ok((SELECT a.issuer_digest FROM public.quote_output_attempts a WHERE a.attempt_id = (SELECT (r ->> 'attemptId')::uuid FROM l2p))
  IS DISTINCT FROM (SELECT a.issuer_digest FROM public.quote_output_attempts a WHERE a.attempt_id = (SELECT (r ->> 'attemptId')::uuid FROM l6p)),
  'LG15 documents bound to A and to B carry different issuer digests');

-- 7. assets / bindings are never deleted; finalized identity immutable
SELECT tst.throws(format('DELETE FROM public.account_assets WHERE asset_id = %L', (SELECT r ->> 'assetId' FROM la)), 'never deleted', 'LG16 finalized logo A cannot be deleted');
SELECT tst.throws(format('UPDATE public.account_assets SET sha256 = repeat(''f'', 64) WHERE asset_id = %L', (SELECT r ->> 'assetId' FROM la)), 'immutable', 'LG17 logo A bytes identity cannot change');
SELECT tst.throws('DELETE FROM public.account_logo_bindings', 'append', 'LG18 bindings are append-only');

-- 8. logo switched off: new documents carry no logo; issued ones keep theirs
UPDATE public.business_settings SET logo_url = '' WHERE user_id = tst.lu(1);
CREATE TEMP TABLE l7 AS SELECT tst.liss(tst.lu(1)) AS i;
SELECT tst.ok((SELECT i ->> 'issuerProjection' FROM l7) = 'issuer/v1' AND coalesce((SELECT i ->> 'logo_url' FROM l7), '') = '', 'LG19 logo switched off -> new issuer has no logo');
SELECT tst.ok((SELECT count(*) FROM public.account_assets WHERE owner_id = tst.lu(1) AND state = 'finalized') = 2, 'LG20 both finalized assets kept');

-- 9. grants unchanged: no application role may call the issuer projection
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.quote_output_issuer(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.quote_output_issuer(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.quote_output_issuer(uuid)', 'EXECUTE'), 'LG21 issuer projection not executable by API roles');

\else
SELECT tst.ok(true, 'LG0 prep overlay active (issuer/v1 re-applied by the prepared SQL): logo binding not applicable here; proven by the canonical gate');
\endif

ROLLBACK;
