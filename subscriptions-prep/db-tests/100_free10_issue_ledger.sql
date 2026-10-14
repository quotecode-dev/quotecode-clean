-- PREPARATION / NOT ACTIVATED - prep schema version 3 (2026-10-07 Codex closure round). Disposable postgres:17 harness ONLY.
-- Proves subscriptions-prep/sql/PREPARED_20261007000000_free10_issue_ledger.sql: activation phases, reservation -> finalize
-- commit point, snapshot binding, idempotent retries, content/customer change, style/media, paid/unprovisioned fail-closed,
-- reveal only after FINALIZED, privileges/append-only, direct-write closure, catalog capacity. Concurrency: 101_*.mjs.
-- Run (additive to the canonical tests):
--   node scripts/db-test/run-db-tests.mjs --extra-migrations subscriptions-prep/sql --extra-tests-dir subscriptions-prep/db-tests
-- Test-only devices (never part of the product contract): `SET session_replication_role = replica` to back-date a reservation
-- TTL, and direct superuser rows to simulate an Owner-approved mapping / a capability-policy fixture.

-- ---------------------------------------------------------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION tst.q(acct int, n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('bb000000-0000-4000-80%s-%s', lpad(acct::text, 2, '0'), lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.u(acct int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('aa000000-0000-4000-8000-%s', lpad(acct::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.c(acct int, letter text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('cc000000-0000-4000-8000-000000000%s%s', lpad(acct::text, 2, '0'), letter)::uuid $$;
CREATE OR REPLACE FUNCTION tst.svc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.digest(p_user uuid, p_quote uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)) $$;
-- prepare as service_role (caller is the superuser test session; the role switch is undone before returning)
-- p_pdigest: the presentation digest the orchestrator would compute from the verified server-side presentation
CREATE OR REPLACE FUNCTION tst.prep(p_user uuid, p_quote uuid, p_channel text, p_key text, p_style text DEFAULT 'classic',
                                    p_media int DEFAULT 0, p_digest text DEFAULT NULL, p_style_version int DEFAULT 1,
                                    p_pdigest text DEFAULT repeat('c', 64)) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := coalesce(p_digest, tst.digest(p_user, p_quote), repeat('0', 64)); r jsonb;
BEGIN
  PERFORM tst.svc();
  r := public.prepare_quote_output(p_user, p_quote, p_channel, p_key, d, p_style, p_media, p_style_version, p_pdigest);
  PERFORM tst.logout();
  RETURN r;
END $$;
-- the orchestrator's Storage step, simulated as the platform would record it (superuser): object row + size metadata
CREATE OR REPLACE FUNCTION tst.put(p_path text, p_size bigint DEFAULT 100) RETURNS void LANGUAGE sql AS $$
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p_path, jsonb_build_object('size', p_size))
  ON CONFLICT (bucket_id, name) DO NOTHING $$;
CREATE OR REPLACE FUNCTION tst.fin(p_user uuid, p_attempt uuid, p_path text, p_sha text DEFAULT repeat('a', 64),
                                   p_bytes bigint DEFAULT 100, p_schema int DEFAULT 1,
                                   p_pdigest text DEFAULT repeat('c', 64)) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.svc();
  r := public.finalize_quote_output(p_user, p_attempt, p_path, p_sha, p_bytes, p_schema, p_pdigest);
  PERFORM tst.logout();
  RETURN r;
END $$;
-- full saga for one quote: prepare -> object -> finalize; returns the finalize answer (or the prepare answer if not preparing)
CREATE OR REPLACE FUNCTION tst.out(p_user uuid, p_quote uuid, p_channel text, p_key text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p jsonb;
BEGIN
  p := tst.prep(p_user, p_quote, p_channel, p_key);
  IF p ->> 'state' IS DISTINCT FROM 'preparing' THEN RETURN p; END IF;
  PERFORM tst.put(p ->> 'snapshotPath');
  RETURN tst.fin(p_user, (p ->> 'attemptId')::uuid, p ->> 'snapshotPath');
END $$;
CREATE OR REPLACE FUNCTION tst.consumed(p_user uuid) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = p_user $$;
CREATE OR REPLACE FUNCTION tst.desc_of(p_quote uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.svc(); r := public.get_output_descriptor(p_quote); PERFORM tst.logout(); RETURN r; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------- fixtures
-- accounts: 1 F free (main 10), 2 G free (scenarios), 3 H free (reservations), 4 X foreign tenant, 5 U unprovisioned legacy,
--           6 P paid, 7 C paid catalog, 8 K free catalog
SELECT tst.seed();
INSERT INTO auth.users (id, email) SELECT tst.u(i), format('prep-acct-%s@synthetic.test', i) FROM generate_series(1, 8) i ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  SELECT tst.u(i), format('prep-acct-%s@synthetic.test', i), format('Synthetic Business %s', i), 'Local', 'ILS' FROM generate_series(1, 8) i
  ON CONFLICT (user_id) DO NOTHING;
-- U has history BEFORE any provisioning: a draft and a legacy sent quote
INSERT INTO public.clients (id, company_name, email, user_id) VALUES
  ('cc000000-0000-4000-8000-000000000501', 'Synthetic Customer U', 'cust-u@synthetic.test', tst.u(5));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES
  (tst.q(5, 1), tst.u(5), 1, 'draft', 'cc000000-0000-4000-8000-000000000501'),
  (tst.q(5, 2), tst.u(5), 2, 'sent',  'cc000000-0000-4000-8000-000000000501');

-- ======================================================================================== A. structure, grants, defaults
SELECT tst.ok((SELECT count(*) FROM public.subscription_activation WHERE phase = 'prepared' AND schema_version = 3) = 2,
              'A1 both components seeded in phase prepared (schema v3)');
SELECT tst.ok((SELECT count(*) FROM public.style_media_capability_policy) = 0, 'A2 no commercial style/media matrix row exists');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.prepare_quote_output(uuid,uuid,text,text,text,text,integer,integer,text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.prepare_quote_output(uuid,uuid,text,text,text,text,integer,integer,text)', 'EXECUTE')
          AND has_function_privilege('service_role', 'public.prepare_quote_output(uuid,uuid,text,text,text,text,integer,integer,text)', 'EXECUTE'),
              'A3 prepare: service_role only');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.finalize_quote_output(uuid,uuid,text,text,bigint,integer,text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.finalize_quote_output(uuid,uuid,text,text,bigint,integer,text)', 'EXECUTE')
          AND has_function_privilege('service_role', 'public.finalize_quote_output(uuid,uuid,text,text,bigint,integer,text)', 'EXECUTE'),
              'A4 finalize: service_role only - a client cannot forge a Storage verification or a finalization');
SELECT tst.ok(NOT has_function_privilege('service_role', 'public.set_activation_phase(text,text,text)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.set_activation_phase(text,text,text)', 'EXECUTE'),
              'A5 set_activation_phase: no application role');
SELECT tst.ok(has_function_privilege('authenticated', 'public.get_free_issue_balance(uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.get_free_issue_balance(uuid)', 'EXECUTE'), 'A6 balance: authenticated only');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.get_output_descriptor(uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.get_output_descriptor(uuid)', 'EXECUTE'), 'A7 descriptor: not callable by clients');
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM unnest(ARRAY['quote_issue_ledger', 'quote_output_attempts']) t,
                unnest(ARRAY['authenticated', 'service_role', 'anon']) r,
                unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
   WHERE has_table_privilege(r, 'public.' || t, p)), 'A8 ledger/attempts: no write privilege for any application role');
SELECT tst.ok(NOT has_table_privilege('authenticated', 'public.account_entitlements', 'UPDATE')
          AND NOT has_table_privilege('authenticated', 'public.account_entitlements', 'INSERT'), 'A9 entitlements: clients read only');
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('prepare_quote_output', 'finalize_quote_output', 'abort_quote_output',
         'get_output_descriptor', 'get_free_issue_balance', 'list_output_attempts_for_reconcile', 'mark_output_snapshot_deleted',
         'provision_free_10', 'set_activation_phase', 'catalog_capacity_status', 'subscription_unmapped_accounts',
         'enforce_output_authority_on_quotes', 'enforce_catalog_capacity_on_services', 'quote_output_deal_document',
         'resolve_style_media_entitlement', 'quote_output_live_reservations', 'quote_output_final_response',
         'quote_output_preparing_response', 'account_entitlements_counter_guard', 'quote_output_issuer', 'get_output_attempt_state')
     AND NOT coalesce(p.proconfig, '{}') @> ARRAY['search_path=public, pg_temp']), 'A10 every new function pins search_path');
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef AND p.proname LIKE ANY (ARRAY['%quote_output%', 'provision_free_10', 'set_activation_phase'])
     AND has_function_privilege('public', p.oid, 'EXECUTE')), 'A11 no SECURITY DEFINER function of this file is executable by PUBLIC');
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM pg_depend d WHERE d.refobjid = 'public.quote_status'::regtype
     AND d.objid IN (SELECT c.oid FROM pg_class c WHERE c.relname IN ('quote_issue_ledger', 'quote_output_attempts', 'quote_output_state',
                                                                       'account_entitlements', 'subscription_activation'))),
              'A12 TKM08: nothing of this file depends on public.quote_status');
SELECT tst.ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'quotes_output_authority' AND coalesce(array_length(tgattr::int2[], 1), 0) = 0 AND tgqual IS NULL),
              'A13 TKM02: the quotes trigger has no column list / WHEN clause');

-- ======================================================================================== B. phase prepared = nothing works
DO $$ BEGIN
  PERFORM tst.svc();
  PERFORM tst.ok(public.provision_free_10(tst.u(1)) ->> 'code' = 'provisioned', 'B1 provision F (new account, no history)');
  PERFORM tst.ok(public.provision_free_10(tst.u(1)) ->> 'code' = 'already_provisioned', 'B2 provisioning is idempotent');
  PERFORM tst.ok(public.provision_free_10(tst.u(5)) ->> 'code' = 'existing_account_requires_owner_mapping',
                 'B3 an account with history is NOT granted 10 retroactively');
  PERFORM tst.ok(public.provision_free_10(tst.u(2)) ->> 'code' = 'provisioned' AND public.provision_free_10(tst.u(3)) ->> 'code' = 'provisioned'
                 AND public.provision_free_10(tst.u(4)) ->> 'code' = 'provisioned' AND public.provision_free_10(tst.u(8)) ->> 'code' = 'provisioned',
                 'B4 provision G, H, X, K');
  PERFORM tst.logout();
END $$;
-- paid accounts (Owner-approved mapping simulated by the DB owner; paid activation authority = future verified webhook)
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, subscription_status, catalog_expansion_blocks) VALUES
  (tst.u(6), 'paid', 'visual', 'active', 0), (tst.u(7), 'paid', 'classic', 'active', 0);
-- quotes and customers of the provisioned accounts (inserted AFTER provisioning)
INSERT INTO public.clients (id, company_name, email, user_id)
  SELECT tst.c(a, c), format('Synthetic Customer %s%s', a, c),
         format('cust-%s-%s@synthetic.test', a, c), tst.u(a)
    FROM generate_series(1, 6) a, (VALUES ('a'), ('b')) v(c);
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.q(a, n), tst.u(a), 1000 * a + n, 'draft', tst.c(a, 'a'), 'v1'
    FROM generate_series(1, 4) a, generate_series(1, 14) n;
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES
  (tst.q(6, 1), tst.u(6), 6001, 'draft', tst.c(6, 'a'));
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price)
  SELECT tst.q(a, n), 'Synthetic item', 2, 191.16, 382.32 FROM generate_series(1, 4) a, generate_series(1, 14) n;

DO $$ DECLARE r jsonb; BEGIN
  r := tst.prep(tst.u(1), tst.q(1, 1), 'send', 'b-key-0001');
  PERFORM tst.ok(r ->> 'code' = 'not_activated', 'B5 [control 1] phase prepared + entitlement present: not_activated');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_output_attempts) = 0 AND (SELECT count(*) FROM public.quote_issue_ledger) = 0,
                 'B6 [control 1] no reservation and no ledger row');
  PERFORM tst.ok(tst.desc_of(tst.q(1, 1)) ->> 'code' = 'not_activated', 'B7 reveal: not_activated');
  PERFORM tst.login(tst.u(1));
  PERFORM tst.ok(public.get_free_issue_balance(NULL) ->> 'code' = 'not_activated', 'B8 balance: not_activated');
  PERFORM tst.ok(public.catalog_capacity_status() ->> 'code' = 'not_activated', 'B9 catalog status: not_activated');
  -- no behavior change while prepared: the existing direct status update still works
  UPDATE public.quotes SET status = 'sent' WHERE id = tst.q(1, 14);
  PERFORM tst.ok((SELECT status FROM public.quotes WHERE id = tst.q(1, 14)) = 'sent', 'B10 prepared: legacy direct Draft->Sent unchanged');
  UPDATE public.quotes SET status = 'draft' WHERE id = tst.q(1, 14);
  PERFORM tst.logout();
END $$;

-- ======================================================================================== C. activation control
SELECT tst.svc();
SELECT tst.throws($$ SELECT public.set_activation_phase('free_issue', 'shadow', 'x') $$, 'permission denied',
                  'C1 service_role cannot change the phase');
SELECT tst.logout();
SELECT tst.throws($$ SELECT public.set_activation_phase('free_issue', 'enforced', 'attestation: all output endpoints wired, gate green') $$,
                  'unmapped account', 'C2 [control 2] enforced refused while accounts are unmapped');
SELECT tst.throws($$ SELECT public.set_activation_phase('catalog_capacity', 'enforced', 'attestation long enough here') $$,
                  'catalog_product_definition_pending', 'C3 catalog enforced refused until the product definition is decided');
SELECT tst.ok(public.set_activation_phase('free_issue', 'shadow', 'test: shadow') ->> 'phase' = 'shadow', 'C4 owner sets shadow');

-- ======================================================================================== D. fail-closed accounts / policy
DO $$ BEGIN
  PERFORM tst.ok(tst.prep(tst.u(5), tst.q(5, 1), 'send', 'd-key-0001') ->> 'code' = 'account_not_provisioned',
                 'D1 unprovisioned account: account_not_provisioned');
  PERFORM tst.ok(tst.prep(tst.u(6), tst.q(6, 1), 'send', 'd-key-0002', 'visual') ->> 'code' = 'style_not_entitled',
                 'D2 paid Visual without an approved matrix: style_not_entitled (no fixture approves it)');
  PERFORM tst.ok(tst.prep(tst.u(6), tst.q(6, 1), 'send', 'd-key-0003') ->> 'code' = 'paid_quote_policy_pending',
                 'D3 [control 3] paid: paid_quote_policy_pending (no implicit unlimited)');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_output_attempts) = 0, 'D4 no reservation from refused requests');
END $$;

-- ======================================================================================== E. style / media from server state
DO $$ DECLARE r jsonb; BEGIN
  PERFORM tst.ok(tst.prep(tst.u(2), tst.q(2, 1), 'send', 'e-key-0001', 'modern') ->> 'code' = 'style_not_entitled',
                 'E1 [control 4] Modern above the baseline: style_not_entitled');
  PERFORM tst.ok(tst.prep(tst.u(2), tst.q(2, 1), 'send', 'e-key-0002', 'classic', 2) ->> 'code' = 'media_not_entitled',
                 'E2 [control 4] media above the baseline: media_not_entitled');
  -- mechanism check with a TEST FIXTURE row (not a commercial approval): the policy is read from server state
  INSERT INTO public.style_media_capability_policy (policy_version, account_mode, style_plan_id, allowed_styles, media_allowed, approval_ref)
    VALUES (1, 'free_10', NULL, ARRAY['classic', 'modern'], true, 'TEST-FIXTURE-NOT-COMMERCIAL');
  r := tst.prep(tst.u(2), tst.q(2, 1), 'send', 'e-key-0003', 'modern', 1);
  PERFORM tst.ok(r ->> 'state' = 'preparing', 'E3 with the fixture row the same request reserves');
  DELETE FROM public.style_media_capability_policy;
  PERFORM tst.put(r ->> 'snapshotPath');
  PERFORM tst.ok(tst.fin(tst.u(2), (r ->> 'attemptId')::uuid, r ->> 'snapshotPath') ->> 'code' = 'style_not_entitled',
                 'E4 entitlement re-checked at finalize: removed policy -> style_not_entitled');
  PERFORM tst.ok((SELECT state FROM public.quote_output_attempts WHERE attempt_id = (r ->> 'attemptId')::uuid) = 'aborted'
                 AND tst.consumed(tst.u(2)) = 0, 'E5 aborted, nothing consumed');
END $$;

-- ======================================================================================== F. Free-10: 1..10 then 11
DO $$ DECLARE r jsonb; ok_all boolean := true; ch text[] := ARRAY['send', 'public_share', 'final_pdf', 'final_print']; BEGIN
  FOR n IN 1..10 LOOP
    r := tst.out(tst.u(1), tst.q(1, n), ch[1 + n % 4], format('f-key-%s', lpad(n::text, 4, '0')));
    ok_all := ok_all AND r ->> 'state' = 'finalized' AND (r ->> 'consumed')::boolean;
  END LOOP;
  PERFORM tst.ok(ok_all AND tst.consumed(tst.u(1)) = 10, 'F1 outputs 1..10 finalize across all four channels; counter 10');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_issue_ledger WHERE user_id = tst.u(1)) = 10, 'F2 exactly 10 ledger rows');
  r := tst.prep(tst.u(1), tst.q(1, 11), 'send', 'f-key-0011');
  PERFORM tst.ok(r ->> 'code' = 'free_issue_limit_reached', 'F3 [boundary] the 11th is refused: free_issue_limit_reached');
  PERFORM tst.ok(tst.consumed(tst.u(1)) = 10 AND NOT EXISTS (SELECT 1 FROM public.quote_output_attempts WHERE quote_id = tst.q(1, 11))
                 AND (SELECT status FROM public.quotes WHERE id = tst.q(1, 11)) = 'draft', 'F4 no partial state for the 11th');
  PERFORM tst.ok((SELECT count(*) FROM public.quotes WHERE user_id = tst.u(1) AND status = 'sent') = 2,
                 'F5 only channel send moved Draft->Sent (n = 4 and 8 used send: 2 of 10)');
  -- existing documents stay accessible after the 10th
  PERFORM tst.ok(tst.desc_of(tst.q(1, 3)) ->> 'state' = 'finalized', 'F6 an issued document is still revealable after the 10th');
  PERFORM tst.login(tst.u(1));
  r := public.get_free_issue_balance(tst.q(1, 11));
  PERFORM tst.ok((r ->> 'remaining')::int = 0 AND (r ->> 'consumed')::int = 10 AND (r ->> 'limit')::int = 10, 'F7 balance shows 10 of 10 used, 0 remaining');
  PERFORM tst.logout();
END $$;

-- ======================================================================================== G. idempotency / retries / reuse
DO $$ DECLARE p jsonb; p2 jsonb; f1 jsonb; f2 jsonb; BEGIN
  p := tst.prep(tst.u(2), tst.q(2, 2), 'send', 'g-key-0001');
  p2 := tst.prep(tst.u(2), tst.q(2, 2), 'send', 'g-key-0001');
  PERFORM tst.ok(p2 ->> 'attemptId' = p ->> 'attemptId' AND (p2 ->> 'replay')::boolean, 'G1 same key: the same attempt (replay)');
  p2 := tst.prep(tst.u(2), tst.q(2, 2), 'final_pdf', 'g-key-0002');
  PERFORM tst.ok(p2 ->> 'attemptId' = p ->> 'attemptId' AND (p2 ->> 'sameQuoteLiveAttempt')::boolean,
                 'G2 same quote, other key: the racer gets the same live attempt, no second reservation');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_output_attempts WHERE quote_id = tst.q(2, 2)) = 1, 'G3 one attempt row');
  PERFORM tst.ok(tst.prep(tst.u(2), tst.q(2, 3), 'send', 'g-key-0001') ->> 'code' = 'idempotency_key_reused', 'G4 key on another quote refused');
  PERFORM tst.put(p ->> 'snapshotPath');
  f1 := tst.fin(tst.u(2), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath');
  f2 := tst.fin(tst.u(2), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath');
  PERFORM tst.ok(f1 = f2 AND f1 ->> 'state' = 'finalized', 'G5 finalize retried after a lost response: the identical durable answer');
  PERFORM tst.ok(tst.consumed(tst.u(2)) = 1, 'G6 still exactly one consumption');
  PERFORM tst.ok(tst.fin(tst.u(2), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('b', 64)) ->> 'code' = 'snapshot_mismatch',
                 'G7 a finalized attempt is never re-bound to another hash');
  p2 := tst.prep(tst.u(2), tst.q(2, 2), 'send', 'g-key-0001');
  PERFORM tst.ok(p2 ->> 'state' = 'finalized' AND (p2 ->> 'alreadyFinalized')::boolean, 'G8 prepare retry after final: durable final');
  p := tst.prep(tst.u(2), tst.q(2, 2), 'final_print', 'g-key-0003');
  p2 := tst.prep(tst.u(2), tst.q(2, 2), 'public_share', 'g-key-0004');
  PERFORM tst.ok(p ->> 'state' = 'finalized' AND p2 ->> 'state' = 'finalized' AND tst.consumed(tst.u(2)) = 1,
                 'G9 reuse for the same customer on other channels: no second consumption');
  -- duplicate = new quote identity consumes at its own first output
  f1 := tst.out(tst.u(2), tst.q(2, 4), 'send', 'g-key-0005');      -- evaluated first (AND has no evaluation order)
  PERFORM tst.ok(f1 ->> 'state' = 'finalized' AND tst.consumed(tst.u(2)) = 2, 'G10 duplicate (new quote id) consumes once');
END $$;

-- ======================================================================================== H. finalize negatives (control 7)
DO $$ DECLARE p jsonb; a uuid; BEGIN
  p := tst.prep(tst.u(2), tst.q(2, 5), 'send', 'h-key-0001'); a := (p ->> 'attemptId')::uuid;
  PERFORM tst.ok(tst.fin(tst.u(2), a, p ->> 'snapshotPath') ->> 'code' = 'snapshot_missing', 'H1 no object: snapshot_missing');
  PERFORM tst.put(p ->> 'snapshotPath', 100);
  PERFORM tst.ok(tst.fin(tst.u(2), a, replace(p ->> 'snapshotPath', '.json', '-x.json')) ->> 'code' = 'snapshot_mismatch', 'H2 wrong path');
  PERFORM tst.ok(tst.fin(tst.u(2), a, p ->> 'snapshotPath', repeat('a', 64), 100, 2) ->> 'code' = 'snapshot_mismatch', 'H3 wrong schema');
  PERFORM tst.ok(tst.fin(tst.u(2), a, p ->> 'snapshotPath', repeat('a', 64), 99) ->> 'code' = 'snapshot_mismatch', 'H4 wrong size');
  PERFORM tst.ok(tst.fin(tst.u(4), a, p ->> 'snapshotPath') ->> 'code' = 'attempt_not_found', 'H5 another account cannot finalize it');
  PERFORM tst.ok(tst.consumed(tst.u(2)) = 2 AND (SELECT state FROM public.quote_output_attempts WHERE attempt_id = a) = 'preparing',
                 'H6 [control 7] no consumption; attempt still recoverable');
  PERFORM tst.ok(tst.fin(tst.u(2), a, p ->> 'snapshotPath') ->> 'state' = 'finalized', 'H7 the correct claim then finalizes');
END $$;

-- ======================================================================================== I. content / customer change (control 8)
DO $$ DECLARE p jsonb; a uuid; old_digest text; BEGIN
  p := tst.prep(tst.u(2), tst.q(2, 6), 'send', 'i-key-0001'); a := (p ->> 'attemptId')::uuid; old_digest := p ->> 'contentDigest';
  PERFORM tst.put(p ->> 'snapshotPath');
  UPDATE public.quote_items SET unit_price = 200, total_price = 400 WHERE quote_id = tst.q(2, 6);
  PERFORM tst.ok(tst.fin(tst.u(2), a, p ->> 'snapshotPath') ->> 'code' = 'quote_changed', 'I1 item changed after prepare: quote_changed');
  PERFORM tst.ok((SELECT state FROM public.quote_output_attempts WHERE attempt_id = a) = 'aborted' AND tst.consumed(tst.u(2)) = 3,
                 'I2 reservation released (aborted); nothing consumed');
  PERFORM tst.ok(tst.prep(tst.u(2), tst.q(2, 6), 'send', 'i-key-0002', 'classic', 0, old_digest) ->> 'code' = 'quote_changed',
                 'I3 a stale expected digest is refused');
  PERFORM tst.ok(tst.prep(tst.u(2), tst.q(2, 6), 'send', 'i-key-0003') ->> 'state' = 'preparing', 'I4 a new attempt on the current content reserves');
  p := tst.prep(tst.u(2), tst.q(2, 7), 'send', 'i-key-0004'); a := (p ->> 'attemptId')::uuid;
  PERFORM tst.put(p ->> 'snapshotPath');
  UPDATE public.quotes SET client_id = tst.c(2, 'b') WHERE id = tst.q(2, 7);
  PERFORM tst.ok(tst.fin(tst.u(2), a, p ->> 'snapshotPath') ->> 'code' = 'customer_changed_new_quote_required',
                 'I5 [customer check] customer changed after prepare: customer_changed_new_quote_required');
  PERFORM tst.ok((SELECT state || ':' || failure_code FROM public.quote_output_attempts WHERE attempt_id = a) = 'aborted:customer_changed',
                 'I6 aborted with failure_code customer_changed');
  -- customer change AFTER a final output (shadow: no trigger) -> no free reuse of the issued identity
  UPDATE public.quotes SET client_id = tst.c(2, 'b') WHERE id = tst.q(2, 4);
  PERFORM tst.ok(tst.prep(tst.u(2), tst.q(2, 4), 'send', 'i-key-0005') ->> 'code' = 'customer_changed_new_quote_required',
                 'I7 customer replaced on an output quote: new quote required, no reuse');
END $$;

-- ======================================================================================== J. reservations, TTL, abort, reconcile
DO $$ DECLARE p jsonb; p2 jsonb; BEGIN
  -- H at 9 counted outputs (real finals), one live reservation, then a race-free single-session check
  FOR n IN 1..9 LOOP PERFORM tst.out(tst.u(3), tst.q(3, n), 'final_pdf', format('j-key-%s', lpad(n::text, 4, '0'))); END LOOP;
  p := tst.prep(tst.u(3), tst.q(3, 10), 'send', 'j-key-0010');
  PERFORM tst.ok(p ->> 'state' = 'preparing' AND tst.consumed(tst.u(3)) = 9, 'J1 at 9 counted + this reservation');
  PERFORM tst.ok(tst.prep(tst.u(3), tst.q(3, 11), 'send', 'j-key-0011') ->> 'code' = 'free_issue_limit_reached',
                 'J2 a live reservation counts: no 11th even before the 10th is final');
  -- back-date the reservation (test-only time travel; triggers bypassed for this single statement)
  SET session_replication_role = replica;
  UPDATE public.quote_output_attempts SET expires_at = now() - interval '1 second' WHERE attempt_id = (p ->> 'attemptId')::uuid;
  SET session_replication_role = origin;
  PERFORM tst.put(p ->> 'snapshotPath');
  PERFORM tst.ok(tst.fin(tst.u(3), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath') ->> 'code' = 'attempt_expired',
                 'J3 finalize after TTL: attempt_expired, nothing consumed');
  p2 := tst.prep(tst.u(3), tst.q(3, 11), 'send', 'j-key-0012');
  PERFORM tst.ok(p2 ->> 'state' = 'preparing', 'J4 the expired reservation released the slot');
  PERFORM tst.svc();
  PERFORM tst.ok(public.abort_quote_output(tst.u(3), (p2 ->> 'attemptId')::uuid, 'storage_write_failed') ->> 'state' = 'aborted', 'J5 abort');
  PERFORM tst.ok(public.abort_quote_output(tst.u(3), (p2 ->> 'attemptId')::uuid, 'storage_write_failed') ->> 'changed' = 'false', 'J6 abort is idempotent');
  PERFORM tst.ok(jsonb_array_length(public.list_output_attempts_for_reconcile(interval '0 seconds', 100)) >= 2,
                 'J7 reconcile lists aborted/expired attempts with undeleted orphans');
  PERFORM tst.ok(public.mark_output_snapshot_deleted((p2 ->> 'attemptId')::uuid) ->> 'ok' = 'true', 'J8 orphan deletion recorded');
  PERFORM tst.ok(public.mark_output_snapshot_deleted((SELECT attempt_id FROM public.quote_output_attempts WHERE state = 'finalized' LIMIT 1)) ->> 'code'
                 = 'snapshot_not_deletable', 'J9 a finalized artifact is never marked deletable');
  PERFORM tst.logout();
END $$;

-- ======================================================================================== K. reveal and Storage policy (controls 5, 6, 12)
DO $$ DECLARE path text := format('issued-documents/%s/%s/%s.json', tst.u(2), tst.q(2, 9), gen_random_uuid()); n int; BEGIN
  PERFORM tst.ok(tst.desc_of(tst.q(2, 9)) ->> 'code' = 'not_finalized', 'K1 [control 5] a complete Draft without finalize: not revealable');
  PERFORM tst.put(path);
  PERFORM tst.ok(tst.desc_of(tst.q(2, 9)) ->> 'code' = 'not_finalized', 'K2 [control 6] an orphan object under the prefix is not served');
  PERFORM tst.login(tst.u(2));
  SELECT count(*) INTO n FROM storage.objects WHERE name = path;
  PERFORM tst.ok(n = 0, 'K3 the owner cannot read issued-documents/* through client storage policies');
  PERFORM tst.logout();
END $$;
SELECT tst.login(tst.u(2));
SELECT tst.throws(format($$ INSERT INTO storage.objects (bucket_id, name) VALUES ('quote-files', 'issued-documents/%s/%s/forged.json') $$, tst.u(2), tst.q(2, 9)),
                  'row-level security|permission denied', 'K4 the owner cannot plant an object under issued-documents/*');
SELECT tst.logout();
DO $$ BEGIN
  PERFORM tst.login(tst.u(2));
  UPDATE public.quotes SET status = 'sent' WHERE id = tst.q(2, 10);   -- shadow: a privileged/legacy status write still happens
  PERFORM tst.logout();
  PERFORM tst.ok(tst.desc_of(tst.q(2, 10)) ->> 'code' = 'not_finalized', 'K5 [control 12] status Sent written directly opens nothing');
END $$;

-- ======================================================================================== L. append-only and counter (control 11)
SELECT tst.login(tst.u(2));
SELECT tst.throws($$ INSERT INTO public.quote_issue_ledger (attempt_id, user_id, quote_id, first_output_channel, idempotency_key,
  counted_against_free, account_mode_at_event, customer_binding, content_digest, snapshot_path, snapshot_sha256, snapshot_bytes,
  snapshot_schema_version) VALUES (gen_random_uuid(), auth.uid(), gen_random_uuid(), 'send', 'forged-key', true, 'free_10', 'x',
  repeat('a', 64), 'p', repeat('a', 64), 1, 1) $$, 'permission denied', 'L1 authenticated cannot INSERT ledger');
SELECT tst.throws($$ UPDATE public.quote_issue_ledger SET counted_against_free = false $$, 'permission denied', 'L2 authenticated cannot UPDATE ledger');
SELECT tst.throws($$ DELETE FROM public.quote_issue_ledger $$, 'permission denied', 'L3 authenticated cannot DELETE ledger');
SELECT tst.throws($$ TRUNCATE public.quote_issue_ledger $$, 'permission denied', 'L4 authenticated cannot TRUNCATE ledger');
SELECT tst.throws($$ UPDATE public.account_entitlements SET free_issues_consumed = 0 $$, 'permission denied', 'L5 authenticated cannot reset its counter');
SELECT tst.logout();
SELECT tst.svc();
SELECT tst.throws($$ UPDATE public.quote_issue_ledger SET counted_against_free = false $$, 'permission denied', 'L6 service_role cannot UPDATE ledger');
SELECT tst.throws($$ DELETE FROM public.quote_issue_ledger $$, 'permission denied', 'L7 service_role cannot DELETE ledger');
SELECT tst.throws($$ TRUNCATE public.quote_issue_ledger $$, 'permission denied', 'L8 service_role cannot TRUNCATE ledger');
SELECT tst.throws($$ UPDATE public.quote_output_attempts SET state = 'preparing' $$, 'permission denied', 'L9 service_role cannot rewrite attempts');
SELECT tst.throws(format($$ UPDATE public.account_entitlements SET free_issues_consumed = 0 WHERE user_id = '%s' $$, tst.u(1)),
                  'must equal the counted ledger rows', 'L10 service_role cannot reset the Free counter (trigger path)');
SELECT tst.logout();
SELECT tst.throws($$ UPDATE public.quote_issue_ledger SET counted_against_free = false $$, 'append-only', 'L11 even the DB owner: ledger UPDATE refused by trigger');
SELECT tst.throws($$ DELETE FROM public.quote_issue_ledger $$, 'append-only', 'L12 ledger DELETE refused by trigger');
SELECT tst.throws($$ TRUNCATE public.quote_issue_ledger $$, 'append-only', 'L13 ledger TRUNCATE refused by trigger');
SELECT tst.throws($$ UPDATE public.quote_output_attempts SET state = 'preparing' WHERE state = 'finalized' $$, 'refused', 'L14 finalized -> preparing refused');
SELECT tst.throws($$ DELETE FROM public.quote_output_attempts $$, 'append-only', 'L15 attempts DELETE refused by trigger');
SELECT tst.throws($$ UPDATE public.quote_output_attempts SET content_digest = repeat('f', 64) $$, 'immutable', 'L16 attempt binding columns immutable');

-- ======================================================================================== M. delete after final (control 10)
DO $$ DECLARE r jsonb; before int := tst.consumed(tst.u(2)); BEGIN
  PERFORM tst.login(tst.u(2));
  DELETE FROM public.quotes WHERE id = tst.q(2, 2);                 -- an output (unsigned) quote of G
  PERFORM tst.logout();
  PERFORM tst.ok(EXISTS (SELECT 1 FROM public.quote_issue_ledger WHERE quote_id = tst.q(2, 2)), 'M1 the ledger tombstone survives deletion');
  PERFORM tst.ok(tst.consumed(tst.u(2)) = before, 'M2 delete never refunds');
  r := tst.prep(tst.u(2), tst.q(2, 2), 'send', 'g-key-0001');
  PERFORM tst.ok(r ->> 'code' = 'document_unavailable' AND r -> 'descriptor' ->> 'sha256' IS NOT NULL,
                 'M3 retry after deletion: document_unavailable + durable metadata, no regeneration, no crash');
  PERFORM tst.ok(tst.consumed(tst.u(2)) = before, 'M4 still no refund and no new consumption');
  -- deletion semantics, kept separate: re-issue/regeneration is refused (M3); the RETAINED finalized artifact's descriptor is
  -- still readable for reveal (retention duration itself is an open Owner decision; a missing artifact fails closed in reveal)
  r := tst.desc_of(tst.q(2, 2));
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND r -> 'descriptor' ->> 'path' IS NOT NULL,
                 'M5 after deletion the retained finalized artifact descriptor is still available (no regeneration involved)');
END $$;

-- ======================================================================================== S. snapshot contract (closure round)
-- extra synthetic quotes for G (no consumption expected in this section)
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.q(2, n), tst.u(2), 2000 + n, 'draft', tst.c(2, 'a'), 'v1' FROM generate_series(20, 26) n;
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price)
  SELECT tst.q(2, n), 'Synthetic item', 1, 10, 10 FROM generate_series(20, 26) n;
-- internal / integration / future columns that must never reach a snapshot
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS emailjs_service_id text, ADD COLUMN IF NOT EXISTS emailjs_public_key text,
  ADD COLUMN IF NOT EXISTS last_sign_in timestamptz, ADD COLUMN IF NOT EXISTS zz_future_internal text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS zz_future_internal text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS zz_future_internal text;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS zz_future_internal text;
UPDATE public.business_settings SET emailjs_service_id = 'svc-secret', emailjs_public_key = 'pk-secret', last_sign_in = now(),
       zz_future_internal = 'LEAK-BS' WHERE user_id = tst.u(2);
UPDATE public.quotes SET zz_future_internal = 'LEAK-Q' WHERE id = tst.q(2, 20);
UPDATE public.clients SET zz_future_internal = 'LEAK-C' WHERE id = tst.c(2, 'a');
UPDATE public.quote_items SET zz_future_internal = 'LEAK-I' WHERE quote_id = tst.q(2, 20);
DO $$ DECLARE p jsonb; a uuid; before int := tst.consumed(tst.u(2)); txt text; BEGIN
  p := tst.prep(tst.u(2), tst.q(2, 20), 'send', 's-key-0001');
  txt := (p -> 'document')::text || (p -> 'issuer')::text;
  PERFORM tst.ok(p ->> 'state' = 'preparing', 'S0 a reservation with internal/future columns present');
  PERFORM tst.ok((SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p -> 'issuer') k)
                 = ARRAY['address', 'business_name', 'country', 'currency', 'email', 'issuerProjection', 'logo_url', 'phone', 'tax_id'],
                 'S1 [allowlist] issuer = exactly issuer/v1 (renderer fields) - no EmailJS, sign-in, plan/trial/role, ids or future columns');
  PERFORM tst.ok((SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p -> 'document' -> 'quote') k)
                 = ARRAY['attn_name', 'attn_role', 'client_type', 'created_at', 'currency', 'discount', 'id', 'notes', 'project_name',
                         'quote_number', 'subject', 'subtotal', 'tax_rate', 'terms', 'total', 'valid_until', 'warranty'],
                 'S2 [allowlist] quote block = exactly quote-document/v1 (no user_id, status, signature, bookkeeping, future column)');
  PERFORM tst.ok((SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p -> 'document' -> 'customer') k)
                 = ARRAY['address', 'company_name', 'email', 'phone'], 'S3 [allowlist] customer block = exactly the rendered fields');
  PERFORM tst.ok((SELECT array_agg(k ORDER BY k COLLATE "C") FROM jsonb_object_keys(p -> 'document' -> 'items' -> 0) k)
                 = ARRAY['calculated_quantity', 'calculation_method', 'description', 'measurements', 'pricing_unit', 'quantity',
                         'quantity_source', 'section_id', 'sort_order', 'specification', 'total_price', 'unit_price'],
                 'S4 [allowlist] item = exactly the rendered fields');
  PERFORM tst.ok(txt !~ '(LEAK-|secret|emailjs|last_sign_in|user_id|"plan"|trial|"role")', 'S5 no internal/integration/future value or key in the snapshot body');
  -- issuer drift between prepare and finalize
  PERFORM tst.put(p ->> 'snapshotPath');
  UPDATE public.business_settings SET phone = '050-0000001' WHERE user_id = tst.u(2);
  a := (p ->> 'attemptId')::uuid;
  PERFORM tst.ok(tst.fin(tst.u(2), a, p ->> 'snapshotPath') ->> 'code' = 'issuer_changed', 'S6 [issuer drift] finalize refused: issuer_changed');
  PERFORM tst.ok((SELECT state || ':' || failure_code FROM public.quote_output_attempts WHERE attempt_id = a) = 'aborted:issuer_changed'
                 AND tst.consumed(tst.u(2)) = before, 'S7 aborted, nothing consumed');
  -- presentation digest must be the one bound at prepare
  p := tst.prep(tst.u(2), tst.q(2, 21), 'send', 's-key-0002');
  PERFORM tst.put(p ->> 'snapshotPath');
  PERFORM tst.ok(tst.fin(tst.u(2), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('a', 64), 100, 1, repeat('d', 64)) ->> 'code'
                 = 'presentation_changed', 'S8 [presentation drift] another presentation digest at finalize: presentation_changed');
  PERFORM tst.ok((SELECT state FROM public.quote_output_attempts WHERE attempt_id = (p ->> 'attemptId')::uuid) = 'aborted'
                 AND tst.consumed(tst.u(2)) = before, 'S9 aborted, nothing consumed');
  -- attachments fail closed (no immutable attachment artifact yet)
  INSERT INTO public.quote_attachments (quote_id, file_name, file_url, file_size, storage_path)
    VALUES (tst.q(2, 22), 'plan.pdf', format('%s/%s_1.pdf', tst.u(2), tst.q(2, 22)), 10, format('%s/%s_1.pdf', tst.u(2), tst.q(2, 22)));
  PERFORM tst.ok(tst.prep(tst.u(2), tst.q(2, 22), 'send', 's-key-0003') ->> 'code' = 'attachment_snapshot_policy_pending',
                 'S10 [attachments] a quote with attachments: attachment_snapshot_policy_pending');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_output_attempts WHERE quote_id = tst.q(2, 22)), 'S11 nothing reserved');
  p := tst.prep(tst.u(2), tst.q(2, 23), 'send', 's-key-0004');
  PERFORM tst.put(p ->> 'snapshotPath');
  INSERT INTO public.quote_attachments (quote_id, file_name, file_url, file_size, storage_path)
    VALUES (tst.q(2, 23), 'late.pdf', format('%s/%s_2.pdf', tst.u(2), tst.q(2, 23)), 10, format('%s/%s_2.pdf', tst.u(2), tst.q(2, 23)));
  PERFORM tst.ok(tst.fin(tst.u(2), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath') ->> 'code' = 'quote_changed',
                 'S12 [attachments] an attachment added after prepare changes the bound document: quote_changed');
  -- Storage size metadata is mandatory
  p := tst.prep(tst.u(2), tst.q(2, 24), 'send', 's-key-0005');
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p ->> 'snapshotPath', '{}'::jsonb);
  PERFORM tst.ok(tst.fin(tst.u(2), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath') ->> 'code' = 'snapshot_metadata_missing',
                 'S13 [size metadata] missing size metadata fails closed: snapshot_metadata_missing');
  PERFORM tst.ok((SELECT state FROM public.quote_output_attempts WHERE attempt_id = (p ->> 'attemptId')::uuid) = 'preparing'
                 AND tst.consumed(tst.u(2)) = before AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger WHERE quote_id = tst.q(2, 24)),
                 'S14 no consumption, no ledger row, attempt still recoverable');
  -- the reconciler reads the bound state through get_output_attempt_state (service_role only)
  PERFORM tst.svc();
  PERFORM tst.ok(public.get_output_attempt_state(tst.u(2), (p ->> 'attemptId')::uuid) ->> 'presentationDigest' = repeat('c', 64)
                 AND public.get_output_attempt_state(tst.u(2), (p ->> 'attemptId')::uuid) ->> 'issuerDigest' IS NOT NULL,
                 'S15 get_output_attempt_state returns the bound digests');
  PERFORM tst.logout();
  PERFORM tst.ok(NOT has_function_privilege('authenticated', 'public.get_output_attempt_state(uuid,uuid)', 'EXECUTE')
                 AND has_function_privilege('service_role', 'public.get_output_attempt_state(uuid,uuid)', 'EXECUTE'),
                 'S16 get_output_attempt_state: service_role only');
END $$;

-- ======================================================================================== T. logo fails closed (closure 10.1)
-- account 10: provisioned BEFORE its quotes (no retro grant); used only here so earlier counts are untouched
INSERT INTO auth.users (id, email) VALUES (tst.u(10), 'prep-acct-10@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  VALUES (tst.u(10), 'prep-acct-10@synthetic.test', 'Synthetic Business 10', 'Local', 'ILS') ON CONFLICT (user_id) DO NOTHING;
DO $$ BEGIN PERFORM tst.svc(); PERFORM public.provision_free_10(tst.u(10)); PERFORM tst.logout(); END $$;
INSERT INTO public.clients (id, company_name, email, user_id) VALUES (tst.c(10, 'a'), 'Synthetic Customer 10a', 'cust-10a@synthetic.test', tst.u(10));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.q(10, n), tst.u(10), 10000 + n, 'draft', tst.c(10, 'a'), 'v1' FROM generate_series(1, 6) n;
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price)
  SELECT tst.q(10, n), 'Synthetic item', 1, 10, 10 FROM generate_series(1, 6) n;
DO $$ DECLARE r jsonb; r2 jsonb; p jsonb; objs int; BEGIN
  SELECT count(*) INTO objs FROM storage.objects;
  UPDATE public.business_settings SET logo_url = 'https://cdn.example.test/logo.png' WHERE user_id = tst.u(10);
  -- the same URL is presented twice (in reality it could serve bytes A, then bytes B): both requests are refused, nothing is read
  r := tst.prep(tst.u(10), tst.q(10, 1), 'send', 't-key-0001');
  r2 := tst.prep(tst.u(10), tst.q(10, 1), 'final_pdf', 't-key-0002');
  PERFORM tst.ok(r ->> 'code' = 'logo_snapshot_policy_pending' AND r2 ->> 'code' = 'logo_snapshot_policy_pending',
                 'T1 [logo AC1/AC3] issuer with a logo_url: logo_snapshot_policy_pending on every attempt');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_output_attempts WHERE user_id = tst.u(10))
                 AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger WHERE user_id = tst.u(10))
                 AND tst.consumed(tst.u(10)) = 0 AND (SELECT count(*) FROM storage.objects) = objs
                 AND (SELECT status FROM public.quotes WHERE id = tst.q(10, 1)) = 'draft',
                 'T2 [logo AC3] no attempt, no ledger row, no counter change, no Storage object, status unchanged');
  PERFORM tst.ok(tst.desc_of(tst.q(10, 1)) ->> 'code' = 'not_finalized', 'T3 [logo AC3] nothing can be revealed');
  -- no logo: NULL, empty and whitespace-only keep the normal path
  UPDATE public.business_settings SET logo_url = NULL WHERE user_id = tst.u(10);
  PERFORM tst.ok(tst.out(tst.u(10), tst.q(10, 2), 'send', 't-key-0003') ->> 'state' = 'finalized', 'T4 [logo AC5] logo NULL: finalized');
  UPDATE public.business_settings SET logo_url = '' WHERE user_id = tst.u(10);
  PERFORM tst.ok(tst.out(tst.u(10), tst.q(10, 3), 'send', 't-key-0004') ->> 'state' = 'finalized', 'T5 [logo AC5] logo empty: finalized');
  UPDATE public.business_settings SET logo_url = '   ' WHERE user_id = tst.u(10);
  PERFORM tst.ok(tst.out(tst.u(10), tst.q(10, 4), 'send', 't-key-0005') ->> 'state' = 'finalized', 'T6 [logo AC5] logo whitespace-only: finalized');
  PERFORM tst.ok(tst.consumed(tst.u(10)) = 3, 'T7 three normal outputs consumed exactly three');
  -- a logo added AFTER prepare: the issuer digest changes, finalize refuses, nothing consumed
  UPDATE public.business_settings SET logo_url = NULL WHERE user_id = tst.u(10);
  p := tst.prep(tst.u(10), tst.q(10, 5), 'send', 't-key-0006');
  PERFORM tst.put(p ->> 'snapshotPath');
  UPDATE public.business_settings SET logo_url = 'https://cdn.example.test/late-logo.png' WHERE user_id = tst.u(10);
  PERFORM tst.ok(tst.fin(tst.u(10), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath') ->> 'code' = 'issuer_changed',
                 'T8 [logo AC4] logo added after prepare: finalize returns issuer_changed');
  PERFORM tst.ok((SELECT state || ':' || failure_code FROM public.quote_output_attempts WHERE attempt_id = (p ->> 'attemptId')::uuid)
                 = 'aborted:issuer_changed' AND tst.consumed(tst.u(10)) = 3, 'T9 [logo AC4] aborted, nothing consumed');
END $$;

-- ======================================================================================== N. legacy / signed
DO $$ BEGIN
  UPDATE public.quotes SET signature = 'synthetic-signature' WHERE id = tst.q(2, 11);
  PERFORM tst.ok(tst.prep(tst.u(2), tst.q(2, 11), 'send', 'n-key-0001') ->> 'code' = 'legacy_issue_policy_pending',
                 'N1 signed without a final output: legacy_issue_policy_pending (transition policy not decided)');
  PERFORM tst.throws(format($q$ UPDATE public.quotes SET notes = 'rewrite' WHERE id = '%s' $q$, tst.q(2, 11)), 'can no longer be modified',
                     'N2 a signed quote stays locked by the existing immutability guard');
END $$;

-- ======================================================================================== O. enforced phase
-- map the remaining population (simulates the Owner-approved migration mapping) and enforce
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES (tst.u(5), 'free_10');
INSERT INTO public.account_entitlements (user_id, account_mode)
  SELECT b.user_id, 'free_10' FROM public.business_settings b
   WHERE NOT EXISTS (SELECT 1 FROM public.account_entitlements e WHERE e.user_id = b.user_id);
SELECT tst.ok(public.subscription_unmapped_accounts() = 0, 'O0 every account mapped');
SELECT tst.throws($$ SELECT public.set_activation_phase('free_issue', 'enforced', 'short') $$, 'attestation', 'O1 enforced needs an attestation');
SELECT tst.ok(public.set_activation_phase('free_issue', 'enforced', 'TEST: attestation of the external preconditions') ->> 'phase' = 'enforced', 'O2 enforced');
SELECT tst.login(tst.u(2));
SELECT tst.throws(format($$ UPDATE public.quotes SET status = 'sent' WHERE id = '%s' $$, tst.q(2, 12)), 'finalize_quote_output',
                  'O3 enforced: direct Draft->Sent refused');
SELECT tst.throws(format($$ INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (gen_random_uuid(), '%s', 99999, 'sent') $$, tst.u(2)),
                  'finalize_quote_output', 'O4 enforced: INSERT of a non-Draft quote refused');
SELECT tst.throws(format($$ UPDATE public.quotes SET client_id = '%s' WHERE id = '%s' $$, tst.c(2, 'a'), tst.q(2, 4)),
                  'requires a new quote', 'O5 enforced: customer change on an output quote refused');
SELECT tst.throws(format($$ INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES ('%s', '%s', 99998, 'draft') $$, tst.q(2, 2), tst.u(2)),
                  're-creating it is refused', 'O6 enforced: re-inserting a deleted output quote id refused');
SELECT tst.logout();
-- control 2: a NEW unmapped account during enforced fails closed
INSERT INTO auth.users (id, email) VALUES (tst.u(9), 'prep-acct-9@synthetic.test');
INSERT INTO public.business_settings (user_id, email, business_name, country, currency) VALUES (tst.u(9), 'prep-acct-9@synthetic.test', 'Synthetic 9', 'Local', 'ILS');
INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (tst.q(9, 1), tst.u(9), 9001, 'draft');
DO $$ BEGIN
  PERFORM tst.ok(tst.prep(tst.u(9), tst.q(9, 1), 'send', 'o-key-0001') ->> 'code' = 'account_not_provisioned', 'O7 [control 2] unmapped: account_not_provisioned');
END $$;
SELECT tst.login(tst.u(9));
SELECT tst.throws(format($$ UPDATE public.quotes SET status = 'sent' WHERE id = '%s' $$, tst.q(9, 1)), 'finalize_quote_output',
                  'O8 [control 2] unmapped account cannot leave Draft either (no unchanged bypass)');
SELECT tst.logout();
-- control 12 (trigger disabled by a privileged path): output still requires FINALIZED
ALTER TABLE public.quotes DISABLE TRIGGER quotes_output_authority;
UPDATE public.quotes SET status = 'sent' WHERE id = tst.q(2, 13);
ALTER TABLE public.quotes ENABLE TRIGGER quotes_output_authority;
SELECT tst.ok(tst.desc_of(tst.q(2, 13)) ->> 'code' = 'not_finalized', 'O9 [control 12] trigger disabled + status Sent: still not revealable');
-- the saga works under enforcement (G still has credit)
DO $$ DECLARE r jsonb; BEGIN
  r := tst.out(tst.u(2), tst.q(2, 14), 'send', 'o-key-0002');
  PERFORM tst.ok(r ->> 'state' = 'finalized' AND (SELECT status FROM public.quotes WHERE id = tst.q(2, 14)) = 'sent',
                 'O10 enforced: finalize(send) is the path out of Draft');
END $$;

-- ======================================================================================== P. rollback to prepared
DO $$ DECLARE l int := (SELECT count(*) FROM public.quote_issue_ledger); a int := (SELECT count(*) FROM public.quote_output_attempts); BEGIN
  PERFORM public.set_activation_phase('free_issue', 'prepared', 'TEST: rollback');
  PERFORM tst.ok(tst.prep(tst.u(2), tst.q(2, 12), 'send', 'p-key-0001') ->> 'code' = 'not_activated', 'P1 after rollback: not_activated');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_issue_ledger) = l AND (SELECT count(*) FROM public.quote_output_attempts) = a,
                 'P2 rollback deletes no ledger row and no attempt');
END $$;

-- ======================================================================================== Q. catalog capacity (separate component)
SELECT public.set_activation_phase('catalog_capacity', 'shadow', 'TEST: catalog shadow');
DO $$ DECLARE r jsonb; BEGIN
  UPDATE public.account_entitlements SET catalog_expansion_blocks = 0 WHERE user_id = tst.u(7);
  PERFORM tst.login(tst.u(7)); r := public.catalog_capacity_status(); PERFORM tst.logout();
  PERFORM tst.ok((r ->> 'limit')::int = 100, 'Q1 paid, 0 blocks: 100');
  UPDATE public.account_entitlements SET catalog_expansion_blocks = 1 WHERE user_id = tst.u(7);
  PERFORM tst.login(tst.u(7)); r := public.catalog_capacity_status(); PERFORM tst.logout();
  PERFORM tst.ok((r ->> 'limit')::int = 200, 'Q2 paid, 1 block: 200');
  UPDATE public.account_entitlements SET catalog_expansion_blocks = 9 WHERE user_id = tst.u(7);
  PERFORM tst.login(tst.u(7)); r := public.catalog_capacity_status(); PERFORM tst.logout();
  PERFORM tst.ok((r ->> 'limit')::int = 1000, 'Q3 paid, 9 blocks: 1000');
  PERFORM tst.login(tst.u(8)); r := public.catalog_capacity_status(); PERFORM tst.logout();
  PERFORM tst.ok(r ->> 'limit' IS NULL AND NOT (r ->> 'limitDecided')::boolean, 'Q4 Free catalog limit: not decided (NULL)');
  PERFORM tst.login(tst.u(9)); r := public.catalog_capacity_status(); PERFORM tst.logout();
  PERFORM tst.ok(r ->> 'code' = 'account_not_provisioned', 'Q5 unprovisioned: account_not_provisioned');
  PERFORM tst.ok(public.resolve_style_media_entitlement('paid', 'classic') -> 'allowedStyles' = '["classic"]'::jsonb
                 AND NOT (public.resolve_style_media_entitlement('paid', 'classic') ->> 'mediaAllowed')::boolean,
                 'Q6 capacity never opens style/media: paid Classic with 9 blocks is still classic-only, no media');
END $$;
-- trigger mechanism only (catalog enforced is refused by set_activation_phase; forced here by the DB owner for the test)
UPDATE public.account_entitlements SET catalog_expansion_blocks = 0 WHERE user_id = tst.u(7);
INSERT INTO public.services (name, user_id) SELECT format('Synthetic product %s', n), tst.u(7) FROM generate_series(1, 100) n;
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'catalog_capacity';
SELECT tst.login(tst.u(7));
SELECT tst.throws($$ INSERT INTO public.services (name, user_id) VALUES ('Synthetic product 101', auth.uid()) $$, 'catalog_capacity_reached',
                  'Q7 the 101st product is refused at 100');
SELECT tst.lives($$ UPDATE public.services SET name = name || ' (edited)' WHERE user_id = auth.uid() AND name = 'Synthetic product 1' $$,
                 'Q8 editing an existing product never consumes capacity');
SELECT tst.logout();
SELECT tst.login(tst.u(8));
SELECT tst.throws($$ INSERT INTO public.services (name, user_id) VALUES ('Synthetic free product', auth.uid()) $$, 'free_catalog_limit_not_decided',
                  'Q9 Free catalog under forced enforcement fails closed (limit not decided)');
SELECT tst.logout();
UPDATE public.subscription_activation SET phase = 'prepared' WHERE component = 'catalog_capacity';
SELECT tst.ok((SELECT count(*) FROM public.services WHERE user_id = tst.u(7)) = 100, 'Q10 no existing product was deleted or changed in count');
