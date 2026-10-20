-- Subscriptions cross-cutting layer (CROSSCUT_CONTRACT.md sections 2.1-2.5 + the pro-trial signup retirement). Disposable
-- postgres:17 harness ONLY. Proves supabase/migrations/20261007150000..20261007150500: account-summary/v1, capability policy and
-- capability_check, public capability tokens / legacy allowlist / output grants, billing lines + renewal, cohort inventory and
-- owner-only provisioning, owner-only plan transition, Storage prefixes, and the OD-01 signup policy.
-- The WHOLE file runs in ONE transaction that is rolled back at the end, so the later suites (incl. the prep suites that assert
-- global counts on a fresh database) see exactly the state the migrations left. now() is therefore constant in this file;
-- expiry is tested by back-dating rows (test-only device: session_replication_role = replica for one statement, as in the
-- prep suite). Forced phase rows written directly by the DB owner are test devices; set_activation_phase gates are proven by
-- the prep suite.
BEGIN;
SET tekango.skip_signup_provisioning = 'on';  -- pre-A-1 fixture: this test seeds its entitlements by hand (20261018100000 test device)
-- this file proves the NO-policy fallback (resolve_style_media_entitlement baseline): the Owner style / media policy v1 of
-- 20261018100000 is removed inside this file's transaction (rolled back at the end, so the later suites keep it)
DELETE FROM public.style_media_capability_policy;

-- ---------------------------------------------------------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION tst.xu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('ee000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.xq(a int, n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('ef000000-0000-4000-80%s-%s', lpad(a::text, 2, '0'), lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.xc(a int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('ed000000-0000-4000-8000-0000000000%s', lpad(a::text, 2, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.xsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
-- service_role call of one SQL expression returning jsonb
CREATE OR REPLACE FUNCTION tst.xcall(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.xsvc(); EXECUTE 'SELECT (' || p_sql || ')::jsonb' INTO r; PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.xprep(p_user uuid, p_quote uuid, p_channel text, p_key text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)); r jsonb;
BEGIN
  PERFORM tst.xsvc();
  r := public.prepare_quote_output(p_user, p_quote, p_channel, p_key, d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.xput(p_path text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p_path, jsonb_build_object('size', 100))
  ON CONFLICT (bucket_id, name) DO NOTHING $$;
CREATE OR REPLACE FUNCTION tst.xfin(p_user uuid, p_attempt uuid, p_path text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.xsvc();
  r := public.finalize_quote_output(p_user, p_attempt, p_path, repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.xout(p_user uuid, p_quote uuid, p_channel text, p_key text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p jsonb;
BEGIN
  p := tst.xprep(p_user, p_quote, p_channel, p_key);
  IF p ->> 'state' IS DISTINCT FROM 'preparing' THEN RETURN p; END IF;
  PERFORM tst.xput(p ->> 'snapshotPath');
  RETURN tst.xfin(p_user, (p ->> 'attemptId')::uuid, p ->> 'snapshotPath');
END $$;
CREATE OR REPLACE FUNCTION tst.xsum(p_user uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.login(p_user); r := public.get_account_summary(); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.xkeys(p jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg(k, ',' ORDER BY k COLLATE "C") FROM jsonb_object_keys(p) k $$;
CREATE OR REPLACE FUNCTION tst.xsha(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(p, 'UTF8')), 'hex') $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------- fixtures
-- 1 F free (main) | 2 P paid classic +2 blocks | 3 B free (other tenant) | 4 U unprovisioned legacy | 5 A super_admin
-- 6 LI billing IL | 7 LN billing INTERNATIONAL | 8 R1 fresh | 9 R2 with history | 10 R3 fresh | 11 N signup | 12 N2 signup
INSERT INTO auth.users (id, email) SELECT tst.xu(i), format('xcut-%s@synthetic.test', i) FROM generate_series(1, 12) i ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role)
  SELECT tst.xu(i), format('xcut-%s@synthetic.test', i), format('Synthetic Xcut %s', i), 'Local', 'ILS', 'free',
         CASE WHEN i = 5 THEN 'super_admin' ELSE 'user' END
    FROM generate_series(1, 10) i WHERE i <> 4 ON CONFLICT (user_id) DO NOTHING;
-- U: legacy Pro trial record (history only; inserted by the DB owner)
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, trial_ends_at)
  VALUES (tst.xu(4), 'xcut-4@synthetic.test', 'Synthetic Xcut 4', 'Local', 'ILS', 'pro', 'user', '2026-10-21 00:00+00');
INSERT INTO public.clients (id, company_name, email, user_id)
  SELECT tst.xc(a), format('Synthetic Customer %s', a), format('xcust-%s@synthetic.test', a), tst.xu(a) FROM generate_series(1, 9) a;
-- F: 12 draft quotes; B: 4 drafts + legacy sent / approved / signed-draft quotes; U and R2: history
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.xq(1, n), tst.xu(1), 81000 + n, 'draft', tst.xc(1), 'v1' FROM generate_series(1, 12) n;
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.xq(3, n), tst.xu(3), 83000 + n, 'draft', tst.xc(3), 'v1' FROM generate_series(1, 4) n;
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES
  (tst.xq(3, 10), tst.xu(3), 83010, 'sent', tst.xc(3)),
  (tst.xq(3, 11), tst.xu(3), 83011, 'approved', tst.xc(3)),
  (tst.xq(3, 12), tst.xu(3), 83012, 'draft', tst.xc(3)),
  (tst.xq(4, 1), tst.xu(4), 84001, 'sent', tst.xc(4)),
  (tst.xq(9, 1), tst.xu(9), 89001, 'draft', tst.xc(9)),
  (tst.xq(9, 2), tst.xu(9), 89002, 'draft', tst.xc(9));
UPDATE public.quotes SET signature = 'synthetic-signature' WHERE id = tst.xq(3, 12);
INSERT INTO public.services (name, user_id) SELECT format('Synthetic F product %s', n), tst.xu(1) FROM generate_series(1, 4) n;
INSERT INTO public.services (name, user_id) SELECT format('Synthetic P product %s', n), tst.xu(2) FROM generate_series(1, 3) n;
-- provisioning of F and B through the prepared service path (no history at provisioning time is not required for this test:
-- the DB owner simulates the Owner-approved mapping); P paid via the DB owner
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES (tst.xu(1), 'free_10'), (tst.xu(3), 'free_10');
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, subscription_status, catalog_expansion_blocks)
  VALUES (tst.xu(2), 'paid', 'classic', 'active', 2);
INSERT INTO public.account_market (user_id, market, source) VALUES
  (tst.xu(1), 'IL', 'owner_mapping'), (tst.xu(2), 'IL', 'owner_mapping'),
  (tst.xu(6), 'IL', 'business_settings_country'), (tst.xu(7), 'INTERNATIONAL', 'business_settings_country');

-- ======================================================================================== A. structure, grants, privileges
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('subscription_account_capabilities', 'account_summary_build', 'get_account_summary',
         'get_account_summary_for_admin', 'capability_check', 'mint_public_capability', 'resolve_public_capability',
         'revoke_public_capability', 'record_legacy_public_links', 'is_legacy_public_quote', 'issue_output_grant', 'redeem_output_grant',
         'apply_verified_line_event', 'apply_verified_renewal_event', 'subscription_cohort_inventory', 'apply_provisioning_batch',
         'rollback_provisioning_batch', 'transition_account_plan', 'trial_cron_retirement_readiness', 'subscription_account_state_hash',
         'subscription_known_account')
     AND (NOT p.prosecdef OR NOT coalesce(p.proconfig, '{}') @> ARRAY['search_path=public, pg_temp']
          OR has_function_privilege('public', p.oid, 'EXECUTE'))),
  'A1 every new SECURITY DEFINER function pins search_path = public, pg_temp and is not executable by PUBLIC');
SELECT tst.ok((SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname IN ('subscription_account_capabilities', 'account_summary_build',
                  'get_account_summary', 'get_account_summary_for_admin', 'capability_check', 'mint_public_capability',
                  'resolve_public_capability', 'revoke_public_capability', 'record_legacy_public_links', 'is_legacy_public_quote',
                  'issue_output_grant', 'redeem_output_grant', 'apply_verified_line_event', 'apply_verified_renewal_event',
                  'subscription_cohort_inventory', 'apply_provisioning_batch', 'rollback_provisioning_batch', 'transition_account_plan',
                  'trial_cron_retirement_readiness', 'subscription_account_state_hash', 'subscription_known_account')) = 21,
  'A2 all 21 functions exist exactly once (no stray overloads)');
SELECT tst.ok(has_function_privilege('authenticated', 'public.get_account_summary()', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.get_account_summary()', 'EXECUTE')
          AND NOT has_function_privilege('service_role', 'public.get_account_summary()', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.get_account_summary_for_admin(uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.get_account_summary_for_admin(uuid)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.revoke_public_capability(uuid,text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.revoke_public_capability(uuid,text)', 'EXECUTE'),
  'A3 summary / admin summary / revoke: authenticated only');
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM unnest(ARRAY['public.mint_public_capability(uuid,uuid,text,text[],timestamptz)', 'public.resolve_public_capability(text,text)',
                              'public.issue_output_grant(uuid,uuid,text,text,integer)', 'public.redeem_output_grant(text,text)',
                              'public.capability_check(uuid,text)', 'public.subscription_cohort_inventory()',
                              'public.trial_cron_retirement_readiness()', 'public.is_legacy_public_quote(uuid)',
                              'public.subscription_account_capabilities(uuid)',
                              'public.apply_verified_line_event(text,text,uuid,text,integer,text,timestamptz,text)',
                              'public.apply_verified_renewal_event(text,text,text,uuid,timestamptz,text)',
                              'public.apply_provisioning_batch(uuid,text)', 'public.rollback_provisioning_batch(uuid,text)',
                              'public.record_legacy_public_links()', 'public.transition_account_plan(uuid,text,text)',
                              'public.set_activation_phase(text,text,text)', 'public.set_billing_phase(text,text)',
                              'public.account_summary_build(uuid,boolean)', 'public.subscription_account_state_hash(uuid)']) f,
                unnest(ARRAY['authenticated', 'anon']) r
   WHERE has_function_privilege(r, f, 'EXECUTE')),
  'A4 authenticated / anon cannot EXECUTE any service-only or owner-only function');
SELECT tst.ok((SELECT bool_and(has_function_privilege('service_role', f, 'EXECUTE')) FROM unnest(ARRAY[
                'public.mint_public_capability(uuid,uuid,text,text[],timestamptz)', 'public.resolve_public_capability(text,text)',
                'public.issue_output_grant(uuid,uuid,text,text,integer)', 'public.redeem_output_grant(text,text)',
                'public.capability_check(uuid,text)', 'public.subscription_cohort_inventory()', 'public.trial_cron_retirement_readiness()',
                'public.is_legacy_public_quote(uuid)', 'public.subscription_account_capabilities(uuid)',
                'public.apply_verified_line_event(text,text,uuid,text,integer,text,timestamptz,text)',
                'public.apply_verified_renewal_event(text,text,text,uuid,timestamptz,text)']) f),
  'A5 service_role holds EXECUTE on the service functions');
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM unnest(ARRAY['public.apply_provisioning_batch(uuid,text)', 'public.rollback_provisioning_batch(uuid,text)',
                              'public.record_legacy_public_links()', 'public.transition_account_plan(uuid,text,text)',
                              'public.set_activation_phase(text,text,text)', 'public.set_billing_phase(text,text)',
                              'public.account_summary_build(uuid,boolean)']) f
   WHERE has_function_privilege('service_role', f, 'EXECUTE')),
  'A6 owner-only functions (apply/rollback batch, legacy cutover, plan transition, phase setters): not even service_role');
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM unnest(ARRAY['account_entitlements', 'subscription_activation', 'billing_activation', 'price_versions', 'quote_issue_ledger',
                              'quote_output_attempts', 'subscription_events', 'subscriptions', 'subscription_lines', 'subscription_periods',
                              'account_assets', 'account_logo_bindings', 'subscription_capability_policy', 'style_media_capability_policy',
                              'quote_public_capabilities', 'output_channel_grants', 'legacy_public_quote_links', 'account_market',
                              'checkout_attempts', 'subscription_provisioning_batches', 'subscription_provisioning_mappings']) t,
                unnest(ARRAY['authenticated', 'anon']) r, unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
   WHERE has_table_privilege(r, 'public.' || t, p)),
  'A7 no INSERT/UPDATE/DELETE/TRUNCATE privilege for authenticated/anon on any entitlement/phase/price/ledger/event/line/asset/policy/token/grant/provisioning table');
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM unnest(ARRAY['subscription_activation', 'billing_activation', 'price_versions', 'quote_issue_ledger', 'quote_output_attempts',
                              'subscription_events', 'subscriptions', 'subscription_lines', 'subscription_periods', 'account_assets',
                              'account_logo_bindings', 'subscription_capability_policy', 'style_media_capability_policy',
                              'quote_public_capabilities', 'output_channel_grants', 'legacy_public_quote_links',
                              'subscription_provisioning_batches', 'subscription_provisioning_mappings']) t,
                unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
   WHERE has_table_privilege('service_role', 'public.' || t, p))
  AND NOT has_table_privilege('service_role', 'public.subscription_provisioning_batches', 'SELECT')
  AND NOT has_table_privilege('service_role', 'public.subscription_provisioning_mappings', 'SELECT'),
  'A8 service_role writes no phase/price/ledger/event/line/asset/policy/token/grant/legacy/provisioning row directly; provisioning tables: no privilege at all');
-- the denial is real for both client roles: every write statement fails on privilege
DO $$ DECLARE t text; r text; BEGIN
  FOREACH r IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    FOREACH t IN ARRAY ARRAY['account_entitlements', 'subscription_activation', 'billing_activation', 'price_versions', 'quote_issue_ledger',
                             'quote_output_attempts', 'subscription_events', 'subscriptions', 'subscription_lines', 'account_assets',
                             'account_logo_bindings', 'subscription_capability_policy', 'style_media_capability_policy',
                             'quote_public_capabilities', 'output_channel_grants', 'legacy_public_quote_links',
                             'subscription_provisioning_batches', 'subscription_provisioning_mappings'] LOOP
      IF r = 'authenticated' THEN PERFORM tst.login(tst.xu(1)); ELSE PERFORM tst.anon(); END IF;
      PERFORM tst.throws(format('INSERT INTO public.%I DEFAULT VALUES', t), 'permission denied', format('A9 %s INSERT %s refused', r, t));
      PERFORM tst.throws(format('DELETE FROM public.%I', t), 'permission denied', format('A9 %s DELETE %s refused', r, t));
      PERFORM tst.logout();
    END LOOP;
  END LOOP;
END $$;
SELECT tst.ok(NOT has_column_privilege('authenticated', 'public.quote_public_capabilities', 'token_hash', 'SELECT')
          AND has_column_privilege('authenticated', 'public.quote_public_capabilities', 'quote_id', 'SELECT')
          AND NOT has_column_privilege('anon', 'public.quote_public_capabilities', 'quote_id', 'SELECT'),
  'A10 token_hash is not selectable by authenticated (column grants); anon reads nothing');
SELECT tst.ok((SELECT count(*) FROM public.subscription_capability_policy) = 0
          AND (SELECT count(*) FROM public.style_media_capability_policy) = 0,
  'A11 both capability policy tables are empty (no commercial matrix decided)');
SELECT tst.ok((SELECT pronargs FROM pg_proc WHERE oid = 'public.get_account_summary()'::regprocedure) = 0,
  'A12 get_account_summary takes no argument (no body/parameter can name an account)');

-- ======================================================================================== B. phase prepared
SELECT tst.anon();
SELECT tst.throws($$ SELECT public.get_account_summary() $$, 'permission denied', 'B1 anon cannot call get_account_summary');
SELECT tst.logout();
DO $$ DECLARE r jsonb; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, false);
  PERFORM set_config('role', 'authenticated', false);
  r := public.get_account_summary();
  PERFORM tst.logout();
  PERFORM tst.ok(r = '{"ok":false,"code":"not_authenticated"}'::jsonb, 'B2 authenticated role without a subject: not_authenticated');
  r := tst.xsum(tst.xu(1));
  PERFORM tst.ok(r = '{"ok":false,"code":"not_activated"}'::jsonb, 'B3 phase prepared + provisioned account: not_activated');
  r := tst.xsum(tst.xu(4));
  PERFORM tst.ok(r = '{"ok":false,"code":"not_activated"}'::jsonb, 'B4 phase prepared + unprovisioned account: not_activated');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(4), 'catalog_product_image.upload'));
  PERFORM tst.ok(r = '{"ok":true,"allowed":true,"source":"legacy","reason":"not_enforced"}'::jsonb,
                 'B5 prepared: catalog image upload keeps the legacy behavior (allowed for every account, even unprovisioned)');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(1), 'catalog_product_image.upload'));
  PERFORM tst.ok(r ->> 'allowed' = 'true' AND r ->> 'source' = 'legacy', 'B6 prepared: Free account keeps legacy catalog image upload');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(1), 'quote_style.modern'));
  PERFORM tst.ok(r = '{"ok":true,"allowed":false,"source":"legacy","reason":"legacy_not_included"}'::jsonb,
                 'B7 prepared: a capability not available to every account today is left to the legacy record (server says no)');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(1), 'unlimited.everything'));
  PERFORM tst.ok(r ->> 'allowed' = 'false' AND r ->> 'reason' = 'unknown_capability', 'B8 unknown capability id: denied');
END $$;
SELECT tst.login(tst.xu(1));
SELECT tst.throws(format($$ SELECT public.get_account_summary(%L::uuid) $$, tst.xu(2)), 'does not exist',
                  'B9 an account id cannot be passed to get_account_summary (no such signature)');
SELECT tst.throws($$ SELECT public.capability_check(auth.uid(), 'catalog_product_image.upload') $$, 'permission denied',
                  'B10 authenticated cannot call capability_check');
SELECT tst.throws($$ SELECT public.set_activation_phase('free_issue', 'enforced', 'client attempt to raise the phase') $$, 'permission denied',
                  'B11 authenticated cannot raise the phase');
SELECT tst.logout();

-- ======================================================================================== C. summary: shadow phase
SELECT public.set_activation_phase('free_issue', 'shadow', 'TEST: crosscut shadow');
DO $$ DECLARE r jsonb; BEGIN
  r := tst.xsum(tst.xu(4));
  PERFORM tst.ok(r = '{"ok":false,"code":"account_not_provisioned"}'::jsonb, 'C1 unprovisioned account: account_not_provisioned');
  r := tst.xsum(tst.xu(1));
  PERFORM tst.ok(tst.xkeys(r) = 'billingPeriod,capabilities,catalog,eligiblePlans,free10,market,ok,phase,plan,priceCatalogVersion,schema,subscriptionStatus,version',
                 'C2 Free ready: exactly the account-summary/v1 top-level keys');
  PERFORM tst.ok(r ->> 'ok' = 'true' AND r ->> 'schema' = 'account-summary/v1' AND jsonb_typeof(r -> 'version') = 'number'
                 AND (r ->> 'version')::int = 1, 'C3 ok / schema / version');
  PERFORM tst.ok(r -> 'phase' = '{"output":"shadow","catalog":"prepared","billing":"off"}'::jsonb,
                 'C4 phase = {output: free_issue, catalog: catalog_capacity, billing: billing_activation off}');
  PERFORM tst.ok(r ->> 'market' = 'IL' AND r -> 'plan' = '{"id":"free"}'::jsonb AND r ->> 'subscriptionStatus' = 'none',
                 'C5 market from account_market, plan.id free, subscriptionStatus none');
  -- 20261007150900: provisioned defaults = technical baseline classic + the not-plan-gated former Basic/Pro gates (no source to block)
  PERFORM tst.ok((SELECT string_agg(x, ',' ORDER BY x COLLATE "C") FROM jsonb_array_elements_text(r -> 'capabilities') x) = 'professional_quote.reuse,professional_quote.use,quote.edit_duplicate,quote.whatsapp_delete,quote_style.classic' AND r -> 'eligiblePlans' = '{}'::jsonb,
                 'C6 Free capabilities = classic baseline + not-plan-gated defaults; eligiblePlans {} (nothing approved)');
  PERFORM tst.ok(r -> 'free10' = '{"limit":10,"consumed":0,"reserved":0,"remaining":10,"endsAt":null,"periodEnded":false}'::jsonb, 'C7 free10 0/0/10');
  PERFORM tst.ok(r -> 'catalog' = '{"active":4,"countDefinition":"unset","limit":null,"blocks":0,"limitDecided":false}'::jsonb,
                 'C8 Free catalog: raw rows only, countDefinition unset, limit null / limitDecided false (OPEN-03)');
  PERFORM tst.ok(jsonb_typeof(r -> 'priceCatalogVersion') = 'string' AND r ->> 'priceCatalogVersion' ~ '^pv1:[0-9a-f]{16}$',
                 'C9 priceCatalogVersion: opaque string for the server market');
  r := tst.xsum(tst.xu(3));
  PERFORM tst.ok(r ->> 'market' IS NULL AND jsonb_typeof(r -> 'market') = 'null' AND jsonb_typeof(r -> 'priceCatalogVersion') = 'null',
                 'C10 no server market row: market null, priceCatalogVersion null');
END $$;

-- Free-10 balance arithmetic through the adopted saga: 1..10 then the 11th is refused
DO $$ DECLARE p jsonb; f jsonb; s jsonb; ok_all boolean := true; ch text[] := ARRAY['send', 'public_share', 'final_pdf', 'final_print']; BEGIN
  FOR n IN 1..10 LOOP
    p := tst.xprep(tst.xu(1), tst.xq(1, n), ch[1 + (n - 1) % 4], format('x-f-key-%s', lpad(n::text, 4, '0')));
    s := tst.xsum(tst.xu(1));
    ok_all := ok_all AND p ->> 'state' = 'preparing'
              AND s -> 'free10' = jsonb_build_object('limit', 10, 'consumed', n - 1, 'reserved', 1, 'remaining', 10 - n, 'endsAt', NULL, 'periodEnded', false);
    PERFORM tst.xput(p ->> 'snapshotPath');
    f := tst.xfin(tst.xu(1), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath');
    s := tst.xsum(tst.xu(1));
    ok_all := ok_all AND f ->> 'state' = 'finalized'
              AND s -> 'free10' = jsonb_build_object('limit', 10, 'consumed', n, 'reserved', 0, 'remaining', 10 - n, 'endsAt', NULL, 'periodEnded', false)
              AND (s ->> 'version')::int = n + 1;
  END LOOP;
  PERFORM tst.ok(ok_all, 'C11 outputs 1..10: after each prepare reserved=1 / remaining=10-n, after each finalize consumed=n / remaining=10-n, version+1');
  p := tst.xprep(tst.xu(1), tst.xq(1, 11), 'send', 'x-f-key-0011');
  s := tst.xsum(tst.xu(1));
  PERFORM tst.ok(p ->> 'code' = 'free_issue_limit_reached', 'C12 the 11th output is refused (free_issue_limit_reached)');
  PERFORM tst.ok(s -> 'free10' = '{"limit":10,"consumed":10,"reserved":0,"remaining":0,"endsAt":null,"periodEnded":false}'::jsonb, 'C13 summary after the 11th: 10/0/0');
END $$;

-- paid shape
DO $$ DECLARE r jsonb; BEGIN
  r := tst.xsum(tst.xu(2));
  PERFORM tst.ok(r ->> 'ok' = 'true' AND r -> 'plan' = '{"id":"classic"}'::jsonb AND jsonb_typeof(r -> 'free10') = 'null'
                 AND r ->> 'subscriptionStatus' = 'active', 'C14 paid: plan.id = style plan, free10 null, status from the entitlement');
  PERFORM tst.ok(r -> 'catalog' = '{"active":3,"countDefinition":"unset","limit":300,"blocks":2,"limitDecided":true}'::jsonb,
                 'C15 paid catalog limit = 100 + 100 x blocks (2 -> 300); countDefinition unset (OPEN-03: active is not a commercial count)');
  PERFORM tst.ok((SELECT string_agg(x, ',' ORDER BY x COLLATE "C") FROM jsonb_array_elements_text(r -> 'capabilities') x) = 'catalog_product_image.upload,professional_quote.reuse,professional_quote.use,quote.edit_duplicate,quote.whatsapp_delete,quote_style.classic', 'C16 paid without a policy row: defaults incl. existing catalog images; no style/media/attachment grant');
END $$;

-- cross-account isolation
DO $$ DECLARE r jsonb; n_all int; n_foreign int; BEGIN
  r := tst.xsum(tst.xu(3));
  PERFORM tst.ok(r -> 'free10' = '{"limit":10,"consumed":0,"reserved":0,"remaining":10,"endsAt":null,"periodEnded":false}'::jsonb AND r -> 'catalog' ->> 'active' = '0',
                 'C17 user B obtains its own summary, never A''s');
  PERFORM tst.login(tst.xu(3));
  SELECT count(*) INTO n_all FROM public.account_entitlements;
  SELECT count(*) INTO n_foreign FROM public.account_entitlements WHERE user_id = tst.xu(1);
  PERFORM tst.logout();
  PERFORM tst.ok(n_all = 1 AND n_foreign = 0, 'C18 RLS: B reads only its own account_entitlements row');
END $$;

-- admin summary
SELECT tst.login(tst.xu(1));
SELECT tst.throws(format($$ SELECT public.get_account_summary_for_admin(%L) $$, tst.xu(2)), 'super_admin required',
                  'C19 a non-super_admin is refused get_account_summary_for_admin (42501)');
SELECT tst.logout();
DO $$ DECLARE r jsonb; r4 jsonb; BEGIN
  PERFORM tst.login(tst.xu(5));
  r := public.get_account_summary_for_admin(tst.xu(2));
  r4 := public.get_account_summary_for_admin(tst.xu(4));
  PERFORM tst.logout();
  PERFORM tst.ok(r ->> 'ok' = 'true' AND r -> 'plan' = '{"id":"classic"}'::jsonb
                 AND r -> 'legacy' = '{"plan":"free","trialEndsAt":null,"isLifetime":false}'::jsonb,
                 'C20 super_admin: target summary + legacy audit block');
  PERFORM tst.ok(r4 ->> 'code' = 'account_not_provisioned' AND r4 -> 'legacy' ->> 'plan' = 'pro' AND r4 -> 'legacy' ->> 'trialEndsAt' IS NOT NULL,
                 'C21 super_admin on an unprovisioned legacy account: account_not_provisioned + legacy history (plan pro / trial)');
END $$;

-- ======================================================================================== D. capability check: enforced
-- forced by the DB owner (test device; U must stay unmapped, so set_activation_phase would - correctly - refuse)
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
DO $$ DECLARE r jsonb; BEGIN
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(4), 'catalog_product_image.upload'));
  PERFORM tst.ok(r = '{"ok":true,"allowed":false,"source":"server","reason":"account_not_provisioned"}'::jsonb,
                 'D1 enforced + unprovisioned: denied account_not_provisioned');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(1), 'catalog_product_image.upload'));
  PERFORM tst.ok(r = '{"ok":true,"allowed":false,"source":"server","reason":"free_not_eligible"}'::jsonb,
                 'D2 enforced + Free + catalog image: free_not_eligible (OD-18)');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(1), 'catalog_capacity.expand'));
  PERFORM tst.ok(r = '{"ok":true,"allowed":false,"source":"server","reason":"not_included"}'::jsonb,
                 'D3 enforced + Free + catalog expansion: not included (no policy row; Free eligibility NOT decided - no invented free_not_eligible)');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(1), 'quote_style.classic'));
  PERFORM tst.ok(r = '{"ok":true,"allowed":true,"source":"server","reason":"granted"}'::jsonb, 'D4 enforced: baseline classic granted');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(2), 'catalog_product_image.upload'));
  PERFORM tst.ok(r = '{"ok":true,"allowed":true,"source":"server","reason":"granted"}'::jsonb,
                 'D5 enforced + paid without a policy row: catalog images keep the existing behavior (granted; OPEN-02 may narrow later)');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(1), 'quote.edit_duplicate'));
  PERFORM tst.ok(r ->> 'allowed' = 'true', 'D5b enforced: edit/duplicate is not plan-gated (no source to block an existing feature)');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(2), 'quote_attachment.upload'));
  PERFORM tst.ok(r ->> 'allowed' = 'false', 'D5c enforced: attachments not granted (OPEN-13; issue with attachments fails closed anyway)');
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(2), 'quote_style.modern'));
  PERFORM tst.ok(r ->> 'allowed' = 'false', 'D5d enforced: Modern not granted without an approved row (OPEN-02; existing behavior outside TEST)');
END $$;
SELECT tst.throws($$ INSERT INTO public.subscription_capability_policy (policy_version, account_mode, capability_id, approval_ref)
                    VALUES (1, 'free_10', 'catalog_product_image.upload', 'TEST-FIXTURE') $$, 'subscription_capability_policy_free_never',
                  'D6 a policy row granting Free catalog image upload is rejected by CHECK (even for the DB owner)');
SELECT tst.throws($$ INSERT INTO public.subscription_capability_policy (policy_version, account_mode, capability_id, approval_ref)
                    VALUES (1, 'paid', 'unlimited', 'TEST-FIXTURE') $$, 'check constraint', 'D7 unknown capability id rejected by CHECK');
-- TEST FIXTURE (not a commercial approval): paid Classic may upload catalog images
INSERT INTO public.subscription_capability_policy (policy_version, account_mode, style_plan_id, capability_id, approval_ref)
  VALUES (1, 'paid', 'classic', 'catalog_product_image.upload', 'TEST-FIXTURE-NOT-COMMERCIAL');
DO $$ DECLARE r jsonb; s jsonb; f jsonb; BEGIN
  r := tst.xcall(format('public.capability_check(%L, %L)', tst.xu(2), 'catalog_product_image.upload'));
  PERFORM tst.ok(r = '{"ok":true,"allowed":true,"source":"server","reason":"granted"}'::jsonb, 'D8 paid with an approved policy row: granted');
  s := tst.xsum(tst.xu(2));
  f := tst.xsum(tst.xu(1));
  PERFORM tst.ok((SELECT string_agg(x, ',' ORDER BY x COLLATE "C") FROM jsonb_array_elements_text(s -> 'capabilities') x) = 'catalog_product_image.upload,professional_quote.reuse,professional_quote.use,quote.edit_duplicate,quote.whatsapp_delete,quote_style.classic'
                 AND (SELECT string_agg(x, ',' ORDER BY x COLLATE "C") FROM jsonb_array_elements_text(f -> 'capabilities') x) = 'professional_quote.reuse,professional_quote.use,quote.edit_duplicate,quote.whatsapp_delete,quote_style.classic',
                 'D9 the summary lists the server capabilities; the Free account never gets the paid row');
  PERFORM tst.ok(s -> 'phase' ->> 'output' = 'enforced', 'D10 summary phase.output follows free_issue (enforced)');
END $$;
-- style/media matrix of the prep feeds the same list
INSERT INTO public.style_media_capability_policy (policy_version, account_mode, style_plan_id, allowed_styles, media_allowed, approval_ref)
  VALUES (1, 'free_10', NULL, ARRAY['classic', 'modern'], true, 'TEST-FIXTURE-NOT-COMMERCIAL');
DO $$ DECLARE f jsonb; BEGIN
  f := tst.xsum(tst.xu(1));
  PERFORM tst.ok((SELECT string_agg(x, ',' ORDER BY x COLLATE "C") FROM jsonb_array_elements_text(f -> 'capabilities') x) = 'professional_quote.reuse,professional_quote.use,quote.edit_duplicate,quote.whatsapp_delete,quote_media.upload,quote_style.classic,quote_style.modern',
                 'D11 an approved style/media row (fixture) appears as quote_style.* / quote_media.upload capabilities');
END $$;
DELETE FROM public.style_media_capability_policy;
DELETE FROM public.subscription_capability_policy;

-- ======================================================================================== E. public capability tokens
UPDATE public.subscription_activation SET phase = 'shadow' WHERE component = 'free_issue';
CREATE TEMP TABLE e_att AS SELECT quote_id, attempt_id, requested_channel, snapshot_path, snapshot_sha256
  FROM public.quote_output_attempts WHERE user_id = tst.xu(1) AND state = 'finalized';
DO $$ DECLARE send_att uuid; pdf_att uuid; p jsonb; r jsonb; BEGIN
  SELECT attempt_id INTO send_att FROM e_att WHERE requested_channel = 'send' LIMIT 1;
  SELECT attempt_id INTO pdf_att FROM e_att WHERE requested_channel = 'final_pdf' LIMIT 1;
  -- B: a PREPARING attempt, then the same attempt ABORTED
  p := tst.xprep(tst.xu(3), tst.xq(3, 1), 'send', 'x-b-key-0001');
  r := tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view''], NULL)', tst.xu(3), p ->> 'attemptId', tst.xsha('tok-b-1')));
  PERFORM tst.ok(r = '{"ok":false,"code":"attempt_not_finalized"}'::jsonb, 'E1 mint refused for a PREPARING attempt');
  PERFORM tst.xcall(format('public.abort_quote_output(%L, %L, %L)', tst.xu(3), p ->> 'attemptId', 'storage_write_failed'));
  r := tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view''], NULL)', tst.xu(3), p ->> 'attemptId', tst.xsha('tok-b-1')));
  PERFORM tst.ok(r = '{"ok":false,"code":"attempt_not_finalized"}'::jsonb, 'E2 mint refused for an ABORTED attempt');
  r := tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view''], NULL)', tst.xu(3), gen_random_uuid(), tst.xsha('tok-b-1')));
  PERFORM tst.ok(r = '{"ok":false,"code":"attempt_not_found"}'::jsonb, 'E3 mint refused for a draft quote without any attempt (unknown attempt)');
  r := tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view''], NULL)', tst.xu(3), send_att, tst.xsha('tok-b-1')));
  PERFORM tst.ok(r = '{"ok":false,"code":"attempt_not_found"}'::jsonb, 'E4 mint refused for ANOTHER user''s finalized attempt');
  r := tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view''], NULL)', tst.xu(1), send_att, 'ABCDEF'));
  PERFORM tst.ok(r ->> 'code' = 'invalid_request', 'E6 malformed token hash refused');
  r := tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''delete''], NULL)', tst.xu(1), send_att, tst.xsha('tok-f-1')));
  PERFORM tst.ok(r ->> 'code' = 'invalid_request', 'E7 an op outside {view, approve} refused');
  r := tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view''], now() - interval ''1 minute'')', tst.xu(1), send_att, tst.xsha('tok-f-1')));
  PERFORM tst.ok(r ->> 'code' = 'invalid_request', 'E8 an expiry in the past refused');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_public_capabilities), 'E9 no token row from refused mints');
END $$;
-- E5: a PDF-first quote (its one finalized attempt is final_pdf) later gets a share/send capability for the SAME artifact
CREATE TEMP TABLE e_pdf AS SELECT * FROM e_att WHERE requested_channel = 'final_pdf' LIMIT 1;
CREATE TEMP TABLE e_m0 AS SELECT tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view'',''approve''], NULL)', tst.xu(1),
  (SELECT attempt_id FROM e_pdf), tst.xsha('tok-f-pdf'))) AS r;
CREATE TEMP TABLE e_r0 AS SELECT tst.xcall(format('public.resolve_public_capability(%L, %L)', tst.xsha('tok-f-pdf'), 'approve')) AS r;
SELECT tst.ok((SELECT r ->> 'ok' FROM e_m0) = 'true' AND (SELECT r ->> 'quoteId' FROM e_m0) = (SELECT quote_id::text FROM e_pdf)
          AND (SELECT r ->> 'attemptId' FROM e_r0) = (SELECT attempt_id::text FROM e_pdf)
          AND (SELECT r ->> 'snapshotPath' FROM e_r0) = (SELECT snapshot_path FROM e_pdf)
          AND (SELECT r ->> 'snapshotSha256' FROM e_r0) = (SELECT snapshot_sha256 FROM e_pdf)
          AND (SELECT count(*) FROM public.quote_issue_ledger WHERE user_id = tst.xu(1)) = 10
          AND (SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.xu(1)) = 10,
  'E5 PDF-first quote: a later share/send capability binds the same finalized artifact (no new consumption, no new ledger row)');
CREATE TEMP TABLE e_m1 AS SELECT tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view'',''approve''], NULL)', tst.xu(1),
  (SELECT attempt_id FROM e_att WHERE requested_channel = 'send' LIMIT 1), tst.xsha('tok-f-1'))) AS r;
CREATE TEMP TABLE e_m1b AS SELECT tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''approve'',''view''], NULL)', tst.xu(1),
  (SELECT attempt_id FROM e_att WHERE requested_channel = 'send' LIMIT 1), tst.xsha('tok-f-1'))) AS r;
CREATE TEMP TABLE e_m1c AS SELECT tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view''], NULL)', tst.xu(1),
  (SELECT attempt_id FROM e_att WHERE requested_channel = 'send' LIMIT 1), tst.xsha('tok-f-1'))) AS r;
SELECT tst.ok((SELECT r ->> 'ok' FROM e_m1) = 'true' AND (SELECT r ->> 'replay' FROM e_m1) = 'false'
          AND (SELECT r ->> 'quoteId' FROM e_m1) = (SELECT quote_id::text FROM e_att WHERE requested_channel = 'send' LIMIT 1),
  'E10 mint with a FINALIZED send attempt of that user: quote bound from the attempt');
-- the PDF-first token (E5) is one more own row below
SELECT tst.ok((SELECT r ->> 'capabilityId' FROM e_m1b) = (SELECT r ->> 'capabilityId' FROM e_m1) AND (SELECT r ->> 'replay' FROM e_m1b) = 'true'
          AND (SELECT count(*) FROM public.quote_public_capabilities WHERE token_hash = tst.xsha('tok-f-1')) = 1, 'E11 mint is idempotent on token_hash (one row)');
SELECT tst.ok((SELECT r FROM e_m1c) = '{"ok":false,"code":"token_conflict"}'::jsonb, 'E12 same token hash with another binding: token_conflict');
SELECT tst.ok((SELECT token_hash FROM public.quote_public_capabilities WHERE id = (SELECT (r ->> 'capabilityId')::uuid FROM e_m1)) = tst.xsha('tok-f-1')
          AND NOT EXISTS (SELECT 1 FROM public.quote_public_capabilities WHERE token_hash !~ '^[0-9a-f]{64}$'),
  'E13 only the sha256 hex of the raw token is stored');
-- public_share attempt token with an expiry (to back-date)
CREATE TEMP TABLE e_m2 AS SELECT tst.xcall(format('public.mint_public_capability(%L, %L, %L, ARRAY[''view''], now() + interval ''1 day'')', tst.xu(1),
  (SELECT attempt_id FROM e_att WHERE requested_channel = 'public_share' LIMIT 1), tst.xsha('tok-f-2'))) AS r;
DO $$ DECLARE r jsonb; nf jsonb := '{"ok":false,"code":"not_found"}'::jsonb; a record; BEGIN
  SELECT * INTO a FROM e_att WHERE requested_channel = 'send' LIMIT 1;
  r := tst.xcall(format('public.resolve_public_capability(%L, %L)', tst.xsha('tok-f-1'), 'view'));
  PERFORM tst.ok(r ->> 'ok' = 'true' AND r ->> 'userId' = tst.xu(1)::text AND r ->> 'quoteId' = a.quote_id::text
                 AND r ->> 'attemptId' = a.attempt_id::text AND r ->> 'snapshotPath' = a.snapshot_path
                 AND r ->> 'snapshotSha256' = a.snapshot_sha256 AND r -> 'ops' = '["approve", "view"]'::jsonb
                 AND tst.xkeys(r) = 'attemptId,capabilityId,ok,ops,quoteId,snapshotPath,snapshotSha256,userId',
                 'E14 resolve view: the bound snapshot descriptor (exact keys)');
  r := tst.xcall(format('public.resolve_public_capability(%L, %L)', tst.xsha('tok-unknown'), 'view'));
  PERFORM tst.ok(r = nf, 'E15 unknown token: not_found');
  r := tst.xcall(format('public.resolve_public_capability(%L, %L)', 'not-a-hash', 'view'));
  PERFORM tst.ok(r = nf, 'E16 malformed token: not_found');
  r := tst.xcall(format('public.resolve_public_capability(%L, %L)', tst.xsha('tok-f-2'), 'approve'));
  PERFORM tst.ok(r = nf, 'E17 op not allowed on the token: not_found');
  r := tst.xcall(format('public.resolve_public_capability(%L, %L)', tst.xsha('tok-f-1'), 'delete'));
  PERFORM tst.ok(r = nf, 'E18 unknown op: not_found');
  r := tst.xcall(format('public.resolve_public_capability(%L, %L)', tst.xsha('tok-f-2'), 'view'));
  PERFORM tst.ok(r ->> 'ok' = 'true', 'E19 the expiring token resolves before its expiry');
  SET LOCAL session_replication_role = replica;
  UPDATE public.quote_public_capabilities SET created_at = now() - interval '2 days', expires_at = now() - interval '1 second'
   WHERE token_hash = tst.xsha('tok-f-2');
  SET LOCAL session_replication_role = origin;
  r := tst.xcall(format('public.resolve_public_capability(%L, %L)', tst.xsha('tok-f-2'), 'view'));
  PERFORM tst.ok(r = nf, 'E20 expired token: not_found');
END $$;
-- revoke: own only, one-way
DO $$ DECLARE cap uuid := (SELECT (r ->> 'capabilityId')::uuid FROM e_m1); r jsonb; r2 jsonb; nf jsonb := '{"ok":false,"code":"not_found"}'::jsonb; BEGIN
  PERFORM tst.login(tst.xu(3)); r := public.revoke_public_capability(cap, 'not mine'); PERFORM tst.logout();
  PERFORM tst.ok(r = nf AND (SELECT revoked_at FROM public.quote_public_capabilities WHERE id = cap) IS NULL,
                 'E21 another user cannot revoke the capability (not_found, unchanged)');
  PERFORM tst.login(tst.xu(1)); r := public.revoke_public_capability(cap, 'owner revoked'); r2 := public.revoke_public_capability(cap, 'again');
  PERFORM tst.logout();
  PERFORM tst.ok(r ->> 'changed' = 'true' AND r2 ->> 'changed' = 'false'
                 AND (SELECT revoked_reason FROM public.quote_public_capabilities WHERE id = cap) = 'owner revoked',
                 'E22 the owner revokes its own capability; a second revoke is idempotent');
  r := tst.xcall(format('public.resolve_public_capability(%L, %L)', tst.xsha('tok-f-1'), 'view'));
  PERFORM tst.ok(r = nf, 'E23 revoked token: not_found');
END $$;
SELECT tst.throws($$ UPDATE public.quote_public_capabilities SET revoked_at = NULL, revoked_reason = NULL WHERE revoked_at IS NOT NULL $$,
                  'one-way', 'E24 un-revoke refused even for the DB owner');
SELECT tst.throws($$ UPDATE public.quote_public_capabilities SET allowed_ops = ARRAY['view','approve'] WHERE expires_at IS NOT NULL $$,
                  'one-way', 'E25 changing ops/expiry of a token refused (only revocation is allowed)');
SELECT tst.throws($$ DELETE FROM public.quote_public_capabilities $$, 'refused', 'E26 token rows are never deleted');
SELECT tst.throws($$ TRUNCATE public.quote_public_capabilities $$, 'refused', 'E27 token table cannot be truncated');
SELECT tst.login(tst.xu(1));
SELECT tst.throws($$ SELECT token_hash FROM public.quote_public_capabilities $$, 'permission denied', 'E28 authenticated cannot select token_hash');
SELECT tst.throws($$ SELECT * FROM public.quote_public_capabilities $$, 'permission denied', 'E29 SELECT * is refused (token_hash column)');
SELECT tst.throws($$ UPDATE public.quote_public_capabilities SET revoked_at = NULL $$, 'permission denied', 'E30 authenticated cannot update tokens directly');
SELECT tst.ok((SELECT count(*) FROM public.quote_public_capabilities WHERE user_id = auth.uid()) = 3, 'E31 the owner lists its own tokens (without hashes)');
SELECT tst.logout();
SELECT tst.login(tst.xu(3));
SELECT tst.ok((SELECT count(id) FROM public.quote_public_capabilities) = 0, 'E32 another user sees none of them (RLS)');
SELECT tst.logout();

-- legacy allowlist (cutover): only non-draft or signed quotes; idempotent; closed once enforced
CREATE TEMP TABLE l_r1 AS SELECT public.record_legacy_public_links() AS r;
CREATE TEMP TABLE l_r2 AS SELECT public.record_legacy_public_links() AS r;
SELECT tst.ok(EXISTS (SELECT 1 FROM public.legacy_public_quote_links WHERE quote_id = tst.xq(3, 10))
          AND EXISTS (SELECT 1 FROM public.legacy_public_quote_links WHERE quote_id = tst.xq(3, 11))
          AND EXISTS (SELECT 1 FROM public.legacy_public_quote_links WHERE quote_id = tst.xq(3, 12))
          AND EXISTS (SELECT 1 FROM public.legacy_public_quote_links WHERE quote_id = tst.xq(4, 1))
          AND NOT EXISTS (SELECT 1 FROM public.legacy_public_quote_links WHERE quote_id IN (tst.xq(3, 2), tst.xq(3, 3), tst.xq(9, 1))),
  'E33 the allowlist records sent / approved / signed quotes, never a plain draft');
SELECT tst.ok((SELECT (r ->> 'inserted')::int FROM l_r2) = 0 AND (SELECT r ->> 'total' FROM l_r2) = (SELECT r ->> 'total' FROM l_r1),
  'E34 record_legacy_public_links is idempotent');
DO $$ DECLARE a boolean; b boolean; BEGIN
  PERFORM tst.xsvc();
  a := public.is_legacy_public_quote(tst.xq(3, 10)); b := public.is_legacy_public_quote(tst.xq(3, 2));
  PERFORM tst.logout();
  PERFORM tst.ok(a AND NOT b, 'E35 is_legacy_public_quote: recorded legacy quote true, draft false');
END $$;
SELECT tst.throws($$ UPDATE public.legacy_public_quote_links SET user_id = user_id $$, 'append-only', 'E36 allowlist rows cannot be changed');
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
SELECT tst.throws($$ SELECT public.record_legacy_public_links() $$, 'allowlist is closed', 'E37 recording is refused once free_issue is enforced');
UPDATE public.subscription_activation SET phase = 'shadow' WHERE component = 'free_issue';

-- ======================================================================================== F. output grants
DO $$ DECLARE att uuid; r jsonb; nf jsonb := '{"ok":false,"code":"not_found"}'::jsonb; p jsonb; BEGIN
  SELECT attempt_id INTO att FROM e_att WHERE requested_channel = 'send' LIMIT 1;
  r := tst.xcall(format('public.issue_output_grant(%L, %L, %L, %L, 0)', tst.xu(1), att, 'final_pdf', tst.xsha('g-0')));
  PERFORM tst.ok(r ->> 'code' = 'invalid_request', 'F1 TTL 0 refused');
  r := tst.xcall(format('public.issue_output_grant(%L, %L, %L, %L, 301)', tst.xu(1), att, 'final_pdf', tst.xsha('g-0')));
  PERFORM tst.ok(r ->> 'code' = 'invalid_request', 'F2 TTL 301 s refused (max 300)');
  r := tst.xcall(format('public.issue_output_grant(%L, %L, %L, %L, 60)', tst.xu(1), att, 'send', tst.xsha('g-0')));
  PERFORM tst.ok(r ->> 'code' = 'invalid_request', 'F3 channel send is not a grant channel');
  r := tst.xcall(format('public.issue_output_grant(%L, %L, %L, %L, 60)', tst.xu(3), att, 'final_pdf', tst.xsha('g-0')));
  PERFORM tst.ok(r ->> 'code' = 'attempt_not_found', 'F4 another user''s attempt refused');
  p := tst.xprep(tst.xu(3), tst.xq(3, 2), 'final_pdf', 'x-b-key-0002');
  r := tst.xcall(format('public.issue_output_grant(%L, %L, %L, %L, 60)', tst.xu(3), p ->> 'attemptId', 'final_pdf', tst.xsha('g-0')));
  PERFORM tst.ok(r ->> 'code' = 'attempt_not_finalized', 'F5 a PREPARING attempt gets no grant');
  r := tst.xcall(format('public.issue_output_grant(%L, %L, %L, %L, 120)', tst.xu(1), att, 'final_pdf', tst.xsha('g-1')));
  PERFORM tst.ok(r ->> 'ok' = 'true' AND (SELECT expires_at - created_at FROM public.output_channel_grants WHERE grant_hash = tst.xsha('g-1')) = interval '120 seconds',
                 'F6 a FINALIZED attempt gets a 120 s grant (any first channel: re-output never consumes)');
  r := tst.xcall(format('public.redeem_output_grant(%L, %L)', tst.xsha('g-1'), 'final_print'));
  PERFORM tst.ok(r = nf, 'F7 wrong channel: not_found');
  r := tst.xcall(format('public.redeem_output_grant(%L, %L)', tst.xsha('g-1'), 'final_pdf'));
  PERFORM tst.ok(r ->> 'ok' = 'true' AND r ->> 'attemptId' = att::text AND r ->> 'snapshotPath' IS NOT NULL
                 AND r ->> 'snapshotSha256' ~ '^[0-9a-f]{64}$' AND r ->> 'userId' = tst.xu(1)::text AND r ->> 'channel' = 'final_pdf'
                 AND tst.xkeys(r) = 'attemptId,channel,ok,quoteId,snapshotPath,snapshotSha256,userId',
                 'F8 redeem: the finalized snapshot descriptor, exact shape {ok,userId,quoteId,attemptId,channel,snapshotPath,snapshotSha256}');
  r := tst.xcall(format('public.redeem_output_grant(%L, %L)', tst.xsha('g-1'), 'final_pdf'));
  PERFORM tst.ok(r = nf, 'F9 single use: the second redemption is not_found');
  r := tst.xcall(format('public.redeem_output_grant(%L, %L)', 'zz', 'final_pdf'));
  PERFORM tst.ok(r = nf, 'F10 malformed grant: not_found');
  r := tst.xcall(format('public.issue_output_grant(%L, %L, %L, %L, 300)', tst.xu(1), att, 'final_print', tst.xsha('g-2')));
  SET LOCAL session_replication_role = replica;
  UPDATE public.output_channel_grants SET created_at = now() - interval '10 minutes', expires_at = now() - interval '5 minutes'
   WHERE grant_hash = tst.xsha('g-2');
  SET LOCAL session_replication_role = origin;
  r := tst.xcall(format('public.redeem_output_grant(%L, %L)', tst.xsha('g-2'), 'final_print'));
  PERFORM tst.ok(r = nf, 'F11 expired grant: not_found');
END $$;
SELECT tst.throws(format($$ INSERT INTO public.output_channel_grants (grant_hash, user_id, quote_id, attempt_id, channel, expires_at)
                           VALUES (%L, %L, gen_random_uuid(), gen_random_uuid(), 'final_pdf', now() + interval '301 seconds') $$,
                         tst.xsha('g-3'), tst.xu(1)), 'output_channel_grants_ttl', 'F12 a grant longer than 300 s cannot exist (CHECK)');
SELECT tst.throws($$ UPDATE public.output_channel_grants SET redeemed_at = NULL WHERE redeemed_at IS NOT NULL $$, 'single redemption',
                  'F13 a redemption cannot be undone (even by the DB owner)');
SELECT tst.throws($$ DELETE FROM public.output_channel_grants $$, 'refused', 'F14 grants are never deleted');

-- ======================================================================================== G. billing lines + renewal
SELECT public.set_billing_phase('prepared', 'TEST: crosscut billing');
DO $$ DECLARE r jsonb; BEGIN
  PERFORM tst.xsvc();
  r := public.apply_verified_line_event('mock', 'x-line-0', tst.xu(6), 'catalog_block', 1, 'il_catalog_block_month_v1', '2026-10-07 10:00+00', 'ref');
  PERFORM tst.logout();
  PERFORM tst.ok(r ->> 'code' = 'no_subscription', 'G1 no subscription: the line event is refused (never auto-purchases)');
  PERFORM tst.xsvc();
  r := public.apply_verified_line_event('mock', 'x-line-0', tst.xu(4), 'catalog_block', 1, 'il_catalog_block_month_v1', '2026-10-07 10:00+00', 'ref');
  PERFORM tst.logout();
  PERFORM tst.ok(r ->> 'code' = 'account_unprovisioned', 'G2 no server market: refused');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.subscription_events WHERE provider_event_id = 'x-line-0'), 'G3 nothing recorded for refused events');
END $$;
-- subscriptions for LI (IL) and LN (INTERNATIONAL) through the prepared checkout + verified payment path
CREATE TEMP TABLE g_ck AS
  SELECT tst.xcall(format('public.create_checkout_intent(%L, %L, 0, %L)', tst.xu(6), 'classic', 'x-ck-il-classic-0001')) AS il,
         tst.xcall(format('public.create_checkout_intent(%L, %L, 0, %L)', tst.xu(7), 'classic', 'x-ck-int-classic-001')) AS intl;
CREATE TEMP TABLE g_pay AS
  SELECT tst.xcall(format('public.record_verified_subscription_event(%L, %L, %L, %L, %L, %L)', 'mock', 'x-pay-il', 'payment_confirmed',
           (SELECT il ->> 'attemptId' FROM g_ck), '2026-10-07 09:00+00', repeat('e', 64))) AS il,
         tst.xcall(format('public.record_verified_subscription_event(%L, %L, %L, %L, %L, %L)', 'mock', 'x-pay-int', 'payment_confirmed',
           (SELECT intl ->> 'attemptId' FROM g_ck), '2026-10-07 09:00+00', repeat('e', 64))) AS intl;
SELECT tst.ok((SELECT il ->> 'outcome' FROM g_pay) = 'applied' AND (SELECT intl ->> 'outcome' FROM g_pay) = 'applied', 'G4 fixture: both subscriptions active');
CREATE OR REPLACE FUNCTION tst.xline(p_eid text, p_user uuid, p_type text, p_qty int, p_price text, p_at timestamptz) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.xsvc();
  r := public.apply_verified_line_event('mock', p_eid, p_user, p_type, p_qty, p_price, p_at, 'provider-ref-' || p_eid);
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.xrenew(p_eid text, p_type text, p_attempt uuid, p_at timestamptz) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.xsvc();
  r := public.apply_verified_renewal_event('mock', p_eid, p_type, p_attempt, p_at, repeat('f', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;
CREATE TEMP TABLE g_l1 AS SELECT tst.xline('x-line-1', tst.xu(6), 'catalog_block', 1, 'il_catalog_block_month_v1', '2026-10-07 10:00+00') AS r;
CREATE TEMP TABLE g_l1b AS SELECT tst.xline('x-line-1', tst.xu(6), 'catalog_block', 1, 'il_catalog_block_month_v1', '2026-10-07 10:00+00') AS r;
SELECT tst.ok((SELECT r ->> 'outcome' FROM g_l1) = 'applied' AND (SELECT r @> '{"unitAmountMinor":500,"currency":"ILS","quantity":1}' FROM g_l1),
  'G5 IL +100 block: price snapshot 500 ILS (OD-04)');
SELECT tst.ok((SELECT r FROM g_l1b) = '{"ok":true,"duplicate":true}'::jsonb
          AND (SELECT count(*) FROM public.subscription_lines WHERE user_id = tst.xu(6)) = 1
          AND (SELECT count(*) FROM public.subscription_events WHERE provider_event_id = 'x-line-1') = 1,
  'G6 the same provider event twice: one event, one line (idempotent replay)');
CREATE TEMP TABLE g_l2 AS SELECT tst.xline('x-line-2', tst.xu(7), 'catalog_block', 1, 'intl_catalog_block_month_v1', '2026-10-07 10:00+00') AS r;
CREATE TEMP TABLE g_l3 AS SELECT tst.xline('x-line-3', tst.xu(7), 'catalog_block', 1, 'il_catalog_block_month_v1', '2026-10-07 10:30+00') AS r;
CREATE TEMP TABLE g_l4 AS SELECT tst.xline('x-line-4', tst.xu(7), 'catalog_block', 1, 'intl_classic_month_v1', '2026-10-07 10:30+00') AS r;
SELECT tst.ok((SELECT r @> '{"outcome":"applied","unitAmountMinor":300,"currency":"USD"}' FROM g_l2),
  'G7 INTERNATIONAL +100 block: price snapshot 300 USD (OD-07)');
SELECT tst.ok((SELECT r ->> 'code' FROM g_l3) = 'market_mismatch' AND (SELECT r ->> 'code' FROM g_l4) = 'price_line_type_mismatch',
  'G8 an IL price on an INTERNATIONAL account / a plan price on a block line: refused');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.subscription_lines WHERE unit_amount_minor = 600)
          AND NOT EXISTS (SELECT 1 FROM public.subscription_lines l JOIN public.account_market m ON m.user_id = l.user_id
                           WHERE m.market = 'INTERNATIONAL' AND l.currency <> 'USD'),
  'G9 never 600 and never a non-USD line on an INTERNATIONAL account');
CREATE TEMP TABLE g_l5 AS SELECT tst.xline('x-line-5', tst.xu(6), 'catalog_block', 2, 'il_catalog_block_month_v1', '2026-10-08 10:00+00') AS r;
SELECT tst.ok((SELECT r ->> 'outcome' FROM g_l5) = 'applied'
          AND (SELECT count(*) FROM public.subscription_lines WHERE user_id = tst.xu(6)) = 2
          AND (SELECT effective_to FROM public.subscription_lines WHERE id = (SELECT (r ->> 'lineId')::uuid FROM g_l1)) = '2026-10-08 10:00+00'
          AND (SELECT quantity FROM public.subscription_lines WHERE user_id = tst.xu(6) AND effective_to IS NULL) = 2,
  'G10 a quantity change closes the open line (effective_to) and opens the new one');
CREATE TEMP TABLE g_l6 AS SELECT tst.xline('x-line-6', tst.xu(6), 'catalog_block', 3, 'il_catalog_block_month_v1', '2026-10-07 12:00+00') AS r;
SELECT tst.ok((SELECT r ->> 'outcome' FROM g_l6) = 'stale'
          AND (SELECT quantity FROM public.subscription_lines WHERE user_id = tst.xu(6) AND effective_to IS NULL) = 2
          AND (SELECT outcome FROM public.subscription_events WHERE provider_event_id = 'x-line-6') = 'stale',
  'G11 an out-of-order (older) line event: stale, lines unchanged');
CREATE TEMP TABLE g_l7 AS SELECT tst.xline('x-line-7', tst.xu(6), 'catalog_block', 0, NULL, '2026-10-09 10:00+00') AS r;
SELECT tst.ok((SELECT r ->> 'outcome' FROM g_l7) = 'applied'
          AND (SELECT count(*) FROM public.subscription_lines WHERE user_id = tst.xu(6)) = 2
          AND NOT EXISTS (SELECT 1 FROM public.subscription_lines WHERE user_id = tst.xu(6) AND effective_to IS NULL),
  'G12 removal closes effective_to and deletes nothing');
CREATE TEMP TABLE g_l8 AS SELECT tst.xline('x-line-8', tst.xu(6), 'catalog_block', 0, NULL, '2026-10-10 10:00+00') AS r;
SELECT tst.ok((SELECT r ->> 'outcome' FROM g_l8) = 'rejected', 'G13 removing a line that is not open: rejected');
SELECT tst.throws(format($$ UPDATE public.subscription_lines SET quantity = 9 WHERE user_id = %L $$, tst.xu(6)), 'only closing',
                  'G14 a line quantity can never be rewritten (DB owner too)');
SELECT tst.throws($$ DELETE FROM public.subscription_lines $$, 'append-only', 'G15 lines are never deleted');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.account_entitlements WHERE user_id IN (tst.xu(6), tst.xu(7))),
  'G16 billing lines write no entitlement (activation is a separate owner step)');
-- renewal on the IL subscription (last applied event 09:00)
CREATE TEMP TABLE g_att AS SELECT (il ->> 'attemptId')::uuid AS il FROM g_ck;
CREATE TEMP TABLE g_r1 AS SELECT tst.xrenew('x-ren-1', 'renewal_failed', (SELECT il FROM g_att), '2026-11-07 09:00+00') AS r;
SELECT tst.ok((SELECT r ->> 'outcome' FROM g_r1) = 'applied'
          AND (SELECT status FROM public.subscriptions WHERE attempt_id = (SELECT il FROM g_att)) = 'past_due'
          AND (SELECT count(*) FROM public.subscription_periods WHERE attempt_id = (SELECT il FROM g_att)) = 0,
  'G17 renewal_failed -> past_due, no new period');
CREATE TEMP TABLE g_r2 AS SELECT tst.xrenew('x-ren-2', 'renewed', (SELECT il FROM g_att), '2026-11-01 09:00+00') AS r;
SELECT tst.ok((SELECT r ->> 'outcome' FROM g_r2) = 'stale'
          AND (SELECT status FROM public.subscriptions WHERE attempt_id = (SELECT il FROM g_att)) = 'past_due'
          AND (SELECT count(*) FROM public.subscription_periods WHERE attempt_id = (SELECT il FROM g_att)) = 0,
  'G18 an older (out-of-order) success: stale, still past_due, no period');
CREATE TEMP TABLE g_r3 AS SELECT tst.xcall(format('public.record_verified_subscription_event(%L, %L, %L, %L, %L, %L)', 'mock', 'x-ren-3',
  'payment_failed', (SELECT il FROM g_att), '2026-11-08 09:00+00', repeat('e', 64))) AS r;
SELECT tst.ok((SELECT status FROM public.subscriptions WHERE attempt_id = (SELECT il FROM g_att)) = 'past_due',
  'G19 a payment_failed event (policy pending, OPEN-09) does not change past_due');
CREATE TEMP TABLE g_r4 AS SELECT tst.xrenew('x-ren-4', 'payment_succeeded', (SELECT il FROM g_att), '2026-11-09 09:00+00') AS r;
CREATE TEMP TABLE g_r4b AS SELECT tst.xrenew('x-ren-4', 'payment_succeeded', (SELECT il FROM g_att), '2026-11-09 09:00+00') AS r;
SELECT tst.ok((SELECT r ->> 'outcome' FROM g_r4) = 'applied' AND (SELECT r ->> 'status' FROM g_r4) = 'active'
          AND (SELECT status FROM public.subscriptions WHERE attempt_id = (SELECT il FROM g_att)) = 'active'
          AND (SELECT count(*) FROM public.subscription_periods WHERE attempt_id = (SELECT il FROM g_att)) = 1,
  'G20 only a later verified success returns to active (+ one period)');
SELECT tst.ok((SELECT r FROM g_r4b) = '{"ok":true,"duplicate":true}'::jsonb
          AND (SELECT count(*) FROM public.subscription_periods WHERE attempt_id = (SELECT il FROM g_att)) = 1,
  'G21 renewal replay: duplicate, no second period');
CREATE TEMP TABLE g_r5 AS SELECT tst.xrenew('x-ren-5', 'renewal_failed', gen_random_uuid(), '2026-11-10 09:00+00') AS r;
SELECT tst.ok((SELECT r ->> 'code' FROM g_r5) = 'unknown_attempt', 'G22 renewal for an unknown attempt: refused');
SELECT public.set_billing_phase('off', 'TEST: back to off');
CREATE TEMP TABLE g_r6 AS SELECT tst.xrenew('x-ren-6', 'renewed', (SELECT il FROM g_att), '2026-12-07 09:00+00') AS r,
                                  tst.xline('x-line-9', tst.xu(6), 'catalog_block', 1, 'il_catalog_block_month_v1', '2026-12-07 10:00+00') AS l;
SELECT tst.ok((SELECT r ->> 'code' FROM g_r6) = 'billing_off' AND (SELECT l ->> 'code' FROM g_r6) = 'billing_off',
  'G23 billing phase off: renewal and line events refused');
SELECT tst.throws($$ UPDATE public.subscription_periods SET period_start = now() $$, 'append-only', 'G24 periods are append-only');

-- ======================================================================================== H. cohort inventory + provisioning
CREATE TEMP TABLE h_inv AS SELECT * FROM public.subscription_cohort_inventory() WHERE false;
GRANT INSERT ON h_inv TO service_role;
DO $$ BEGIN
  PERFORM tst.xsvc();
  INSERT INTO h_inv SELECT * FROM public.subscription_cohort_inventory();
  PERFORM tst.logout();
END $$;
SELECT tst.ok((SELECT count(*) FROM h_inv) = (SELECT count(*) FROM (SELECT id FROM auth.users UNION SELECT user_id FROM public.business_settings
                                                                    UNION SELECT user_id FROM public.quotes WHERE user_id IS NOT NULL) a),
  'H1 inventory lists every account (auth users + settings owners + quote owners)');
SELECT tst.ok((SELECT NOT has_entitlement AND legacy_plan = 'pro' AND trial_ends_at IS NOT NULL AND quotes_total = 1
                      AND quotes_by_status = '{"sent":1}'::jsonb FROM h_inv WHERE user_id = tst.xu(4))
          AND (SELECT has_entitlement AND services_count = 4 AND role = 'user' FROM h_inv WHERE user_id = tst.xu(1))
          AND (SELECT state_hash FROM h_inv WHERE user_id = tst.xu(9)) ~ '^[0-9a-f]{64}$',
  'H2 inventory rows carry the legacy fields, quote counts by status, services count, entitlement flag and state hash');
SELECT tst.ok((SELECT provolatile FROM pg_proc WHERE oid = 'public.subscription_cohort_inventory()'::regprocedure) = 's',
  'H3 inventory is STABLE (read-only: it cannot write)');
SELECT tst.xsvc();
SELECT tst.throws($$ SELECT public.apply_provisioning_batch(gen_random_uuid(), 'service role attempt to apply a batch') $$, 'permission denied',
                  'H4 service_role cannot apply a provisioning batch');
SELECT tst.throws($$ SELECT public.rollback_provisioning_batch(gen_random_uuid(), 'service role attempt') $$, 'permission denied',
                  'H5 service_role cannot roll back a provisioning batch');
SELECT tst.throws($$ SELECT * FROM public.subscription_provisioning_mappings $$, 'permission denied', 'H6 service_role cannot read mappings');
SELECT tst.logout();
SELECT tst.login(tst.xu(1));
SELECT tst.throws($$ SELECT public.apply_provisioning_batch(gen_random_uuid(), 'client attempt to apply a batch here') $$, 'permission denied',
                  'H7 authenticated cannot apply a provisioning batch');
SELECT tst.logout();
-- batch 1: R1 fresh (free_10, IL) + R2 with history (free_10 WITHOUT the approval flag) -> whole batch refused
INSERT INTO public.subscription_provisioning_batches (batch_id, approval_ref) VALUES
  ('e1000000-0000-4000-8000-000000000001', 'TEST-OWNER-MAPPING-1'),
  ('e1000000-0000-4000-8000-000000000002', 'TEST-OWNER-MAPPING-2'),
  ('e1000000-0000-4000-8000-000000000003', 'TEST-OWNER-MAPPING-3'),
  ('e1000000-0000-4000-8000-000000000004', 'TEST-OWNER-MAPPING-4');
INSERT INTO public.subscription_provisioning_mappings (batch_id, user_id, target_account_mode, target_market, approval_ref, before_hash) VALUES
  ('e1000000-0000-4000-8000-000000000001', tst.xu(8), 'free_10', 'IL', 'TEST-OWNER-MAPPING-1', public.subscription_account_state_hash(tst.xu(8))),
  ('e1000000-0000-4000-8000-000000000001', tst.xu(9), 'free_10', NULL, 'TEST-OWNER-MAPPING-1', public.subscription_account_state_hash(tst.xu(9)));
CREATE TEMP TABLE h_a1 AS SELECT public.apply_provisioning_batch('e1000000-0000-4000-8000-000000000001', 'TEST: operator attestation for batch 1') AS r;
SELECT tst.ok((SELECT r ->> 'code' FROM h_a1) = 'free10_retroactive_requires_approval'
          AND NOT EXISTS (SELECT 1 FROM public.account_entitlements WHERE user_id IN (tst.xu(8), tst.xu(9)))
          AND (SELECT state FROM public.subscription_provisioning_batches WHERE batch_id = 'e1000000-0000-4000-8000-000000000001') = 'draft',
  'H8 Free-10 is never granted retroactively to an account with quotes without an explicit approval; the whole batch stops (nothing written)');
-- batch 2: an unknown account stops the whole batch
INSERT INTO public.subscription_provisioning_mappings (batch_id, user_id, target_account_mode, approval_ref, before_hash) VALUES
  ('e1000000-0000-4000-8000-000000000002', tst.xu(10), 'free_10', 'TEST-OWNER-MAPPING-2', public.subscription_account_state_hash(tst.xu(10))),
  ('e1000000-0000-4000-8000-000000000002', 'e9999999-0000-4000-8000-000000000999', 'free_10', 'TEST-OWNER-MAPPING-2', repeat('0', 64));
CREATE TEMP TABLE h_a2 AS SELECT public.apply_provisioning_batch('e1000000-0000-4000-8000-000000000002', 'TEST: operator attestation for batch 2') AS r;
SELECT tst.ok((SELECT r ->> 'code' FROM h_a2) = 'unknown_account' AND NOT EXISTS (SELECT 1 FROM public.account_entitlements WHERE user_id = tst.xu(10)),
  'H9 an unknown account stops the whole batch (the valid mapping is not applied either)');
-- batch 1 fixed by the Owner: explicit approval for R2's history
UPDATE public.subscription_provisioning_mappings SET grant_free10_with_history = true, approval_ref = 'TEST-OWNER-APPROVED-HISTORY'
 WHERE batch_id = 'e1000000-0000-4000-8000-000000000001' AND user_id = tst.xu(9);
CREATE TEMP TABLE h_a3 AS SELECT public.apply_provisioning_batch('e1000000-0000-4000-8000-000000000001', 'TEST: operator attestation for batch 1') AS r;
CREATE TEMP TABLE h_a3b AS SELECT public.apply_provisioning_batch('e1000000-0000-4000-8000-000000000001', 'TEST: operator attestation for batch 1') AS r;
SELECT tst.ok((SELECT r @> '{"ok":true,"applied":2}' FROM h_a3) AND (SELECT r @> '{"ok":true,"changed":false}' FROM h_a3b)
          AND (SELECT count(*) FROM public.account_entitlements WHERE user_id IN (tst.xu(8), tst.xu(9)) AND account_mode = 'free_10') = 2
          AND (SELECT market FROM public.account_market WHERE user_id = tst.xu(8)) = 'IL',
  'H10 with the explicit approval the batch applies (entitlements + owner-mapped market); a re-apply changes nothing');
-- batch 3: stale before_hash (the account changed after it was mapped) stops the batch
INSERT INTO public.subscription_provisioning_mappings (batch_id, user_id, target_account_mode, target_style_plan_id, approval_ref, before_hash) VALUES
  ('e1000000-0000-4000-8000-000000000003', tst.xu(10), 'paid', 'visual', 'TEST-OWNER-MAPPING-3', public.subscription_account_state_hash(tst.xu(10)));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES (tst.xq(10, 1), tst.xu(10), 90001, 'draft', NULL);
CREATE TEMP TABLE h_a4 AS SELECT public.apply_provisioning_batch('e1000000-0000-4000-8000-000000000003', 'TEST: operator attestation for batch 3') AS r;
SELECT tst.ok((SELECT r ->> 'code' FROM h_a4) = 'account_changed_since_mapping', 'H11 an account that changed since it was mapped stops the batch');
-- batch 4: R3 (refreshed hash) -> apply, then rollback succeeds and removes only what it created
INSERT INTO public.subscription_provisioning_mappings (batch_id, user_id, target_account_mode, target_style_plan_id, target_market, approval_ref, before_hash) VALUES
  ('e1000000-0000-4000-8000-000000000004', tst.xu(10), 'paid', 'visual', 'INTERNATIONAL', 'TEST-OWNER-MAPPING-4', public.subscription_account_state_hash(tst.xu(10))),
  ('e1000000-0000-4000-8000-000000000004', tst.xu(1), 'paid', 'classic', NULL, 'TEST-OWNER-MAPPING-4', public.subscription_account_state_hash(tst.xu(1)));
CREATE TEMP TABLE h_a5 AS SELECT public.apply_provisioning_batch('e1000000-0000-4000-8000-000000000004', 'TEST: operator attestation for batch 4') AS r;
SELECT tst.ok((SELECT r @> '{"ok":true,"applied":1,"skippedExisting":1}' FROM h_a5)
          AND (SELECT state FROM public.subscription_provisioning_mappings WHERE batch_id = 'e1000000-0000-4000-8000-000000000004' AND user_id = tst.xu(1)) = 'skipped_existing',
  'H12 an existing entitlement is never overwritten (skipped_existing)');
CREATE TEMP TABLE h_rb AS SELECT public.rollback_provisioning_batch('e1000000-0000-4000-8000-000000000004', 'TEST: rollback batch 4') AS r;
CREATE TEMP TABLE h_rb2 AS SELECT public.rollback_provisioning_batch('e1000000-0000-4000-8000-000000000004', 'TEST: rollback batch 4') AS r;
SELECT tst.ok((SELECT r @> '{"ok":true,"removedEntitlements":1}' FROM h_rb) AND (SELECT r @> '{"changed":false}' FROM h_rb2)
          AND NOT EXISTS (SELECT 1 FROM public.account_entitlements WHERE user_id = tst.xu(10))
          AND NOT EXISTS (SELECT 1 FROM public.account_market WHERE user_id = tst.xu(10))
          AND EXISTS (SELECT 1 FROM public.account_entitlements WHERE user_id = tst.xu(1)),
  'H13 rollback removes only the rows the batch created (the skipped account keeps its entitlement); idempotent');
-- R2 consumes one Free output -> rollback of batch 1 is refused (finalized consumption is never undone)
CREATE TEMP TABLE h_out AS SELECT tst.xout(tst.xu(9), tst.xq(9, 1), 'final_pdf', 'x-r2-key-0001') AS r;
CREATE TEMP TABLE h_rb3 AS SELECT public.rollback_provisioning_batch('e1000000-0000-4000-8000-000000000001', 'TEST: rollback batch 1') AS r;
SELECT tst.ok((SELECT r ->> 'state' FROM h_out) = 'finalized' AND (SELECT r ->> 'code' FROM h_rb3) = 'consumption_exists'
          AND (SELECT count(*) FROM public.account_entitlements WHERE user_id IN (tst.xu(8), tst.xu(9))) = 2,
  'H14 rollback refuses when a ledger row / attempt exists for one of its accounts; nothing removed');
DO $$ DECLARE r jsonb; BEGIN
  PERFORM tst.xsvc(); r := public.trial_cron_retirement_readiness(); PERFORM tst.logout();
  PERFORM tst.ok(tst.xkeys(r) = 'eligibleTrialRows,mappedAccounts,unmappedAccounts' AND (r ->> 'eligibleTrialRows')::int >= 1
                 AND (r ->> 'unmappedAccounts')::int = public.subscription_unmapped_accounts()
                 AND (r ->> 'mappedAccounts')::int >= 5, 'H15 trial cron readiness: {eligibleTrialRows, mappedAccounts, unmappedAccounts}');
END $$;

-- ======================================================================================== I. same-account plan transition
DO $$ DECLARE s_before int; q_before int; l_before int; c_before int; r jsonb; s jsonb; BEGIN
  SELECT count(*) INTO s_before FROM public.services WHERE user_id = tst.xu(1);
  SELECT count(*) INTO q_before FROM public.quotes WHERE user_id = tst.xu(1);
  SELECT count(*) INTO l_before FROM public.quote_issue_ledger WHERE user_id = tst.xu(1);
  SELECT free_issues_consumed INTO c_before FROM public.account_entitlements WHERE user_id = tst.xu(1);
  r := public.transition_account_plan(tst.xu(1), 'modern', 'TEST-OWNER-TRANSITION');
  s := tst.xsum(tst.xu(1));
  PERFORM tst.ok(r ->> 'changed' = 'true' AND s -> 'plan' = '{"id":"modern"}'::jsonb AND jsonb_typeof(s -> 'free10') = 'null'
                 AND s -> 'catalog' = '{"active":4,"countDefinition":"unset","limit":100,"blocks":0,"limitDecided":true}'::jsonb,
                 'I1 owner-only transition free_10 -> paid modern: summary shows the paid shape on the same account');
  PERFORM tst.ok((SELECT count(*) FROM public.services WHERE user_id = tst.xu(1)) = s_before AND s_before = 4
                 AND (SELECT count(*) FROM public.quotes WHERE user_id = tst.xu(1)) = q_before
                 AND (SELECT count(*) FROM public.quote_issue_ledger WHERE user_id = tst.xu(1)) = l_before AND l_before = 10
                 AND (SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.xu(1)) = c_before,
                 'I2 services, quotes and issued ledger rows are preserved (counter still equals the ledger)');
  PERFORM tst.ok(EXISTS (SELECT 1 FROM e_att a JOIN public.quote_output_attempts o ON o.attempt_id = a.attempt_id WHERE o.state = 'finalized')
                 AND (SELECT count(*) FROM public.quote_output_attempts WHERE user_id = tst.xu(1) AND state = 'finalized') = 10,
                 'I3 issued (finalized) attempts are untouched');
END $$;
SELECT tst.throws(format($$ SELECT public.transition_account_plan(%L, 'free', 'TEST') $$, tst.xu(1)), 'invalid arguments',
                  'I4 no downgrade to Free through the transition path (OPEN-09)');

-- ======================================================================================== J. Storage prefixes (direct client writes)
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', format('t16-presentation/%s/catalog-1.png', tst.xu(1)), '{"size":10}');
SELECT tst.login(tst.xu(1));
SELECT tst.throws(format($$ INSERT INTO storage.objects (bucket_id, name) VALUES ('quote-files', 't16-presentation/%s/forged.png') $$, tst.xu(1)),
                  'row-level security', 'J1 authenticated cannot insert under t16-presentation/<uid>/');
SELECT tst.throws(format($$ INSERT INTO storage.objects (bucket_id, name) VALUES ('quote-files', 'account-assets/%s/forged.png') $$, tst.xu(1)),
                  'row-level security', 'J2 authenticated cannot insert under account-assets/');
SELECT tst.throws(format($$ INSERT INTO storage.objects (bucket_id, name) VALUES ('quote-files', 'issued-documents/%s/x/forged.json') $$, tst.xu(1)),
                  'row-level security', 'J3 authenticated cannot insert under issued-documents/');
UPDATE storage.objects SET metadata = '{"size":999}' WHERE name LIKE 't16-presentation/%';
SELECT tst.logout();
SELECT tst.ok((SELECT metadata ->> 'size' FROM storage.objects WHERE name = format('t16-presentation/%s/catalog-1.png', tst.xu(1))) = '10',
  'J4 authenticated cannot update an object under t16-presentation/ (no row changed)');

-- ======================================================================================== K. OD-01 signup policy (no self-created Pro trial)
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_settings' AND policyname = 'Restrict business_settings insert to safe free or legitimate tr')
          AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_settings' AND policyname = 'Restrict business_settings insert to legacy free record'
                        AND permissive = 'RESTRICTIVE' AND cmd = 'INSERT' AND roles = '{authenticated}')
          AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_settings' AND policyname = 'Restrict business_settings insert to role=user'
                        AND permissive = 'RESTRICTIVE'),
  'K1 the pro-trial insert policy is replaced by the legacy-free-record policy; the role=user policy is untouched');
-- In the migrated disposable DB the TEST-source ACL (fixture for 20260930000000) leaves authenticated WITHOUT any INSERT column
-- grant on business_settings, so privilege alone already blocks a client insert. The policy is the guard wherever the Production
-- capture grant of 20260830000002 (10 signup columns) exists: that grant is re-applied INSIDE this rolled-back transaction
-- (test device) so the RESTRICTIVE policy itself is what decides below.
SELECT tst.ok(NOT has_column_privilege('authenticated', 'public.business_settings', 'plan', 'INSERT'),
  'K0 canonical disposable state: authenticated holds no INSERT grant on business_settings.plan');
GRANT INSERT (user_id, email, business_name, country, currency, plan, role, default_terms, trial_ends_at, last_sign_in)
  ON public.business_settings TO authenticated;
SELECT tst.login(tst.xu(11));
SELECT tst.throws(format($$ INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, trial_ends_at)
                           VALUES (%L, 'n@synthetic.test', 'N', 'Local', 'ILS', 'pro', 'user', now() + interval '14 days') $$, tst.xu(11)),
                  'row-level security', 'K2 a client cannot self-create plan pro + a 14-day trial');
SELECT tst.throws(format($$ INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role)
                           VALUES (%L, 'n@synthetic.test', 'N', 'Local', 'ILS', 'pro', 'user') $$, tst.xu(11)),
                  'row-level security', 'K3 a client cannot self-create plan pro without a trial either');
SELECT tst.throws(format($$ INSERT INTO public.business_settings (user_id, email, business_name, country, currency, trial_ends_at)
                           VALUES (%L, 'n@synthetic.test', 'N', 'Local', 'ILS', now() + interval '14 days') $$, tst.xu(11)),
                  'row-level security', 'K4 a client cannot self-create a free row with a trial date');
SELECT tst.lives(format($$ INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
                          VALUES (%L, 'n@synthetic.test', 'N', 'Local', 'ILS') $$, tst.xu(11)),
                 'K5 the signup insert that omits plan / trial_ends_at succeeds');
SELECT tst.logout();
SELECT tst.ok((SELECT plan = 'free' AND trial_ends_at IS NULL AND role = 'user' AND NOT is_lifetime FROM public.business_settings WHERE user_id = tst.xu(11)),
  'K6 the created row is the legacy free record (plan free, no trial, role user, not lifetime)');
SELECT tst.login(tst.xu(12));
SELECT tst.throws(format($$ INSERT INTO public.business_settings (user_id, email, business_name, country, currency, role)
                           VALUES (%L, 'n2@synthetic.test', 'N2', 'Local', 'ILS', 'super_admin') $$, tst.xu(12)),
                  'row-level security', 'K7 role must still be user (self-promotion refused)');
SELECT tst.logout();

-- ======================================================================================== L. output_notice (expected digest + notice)
CREATE OR REPLACE FUNCTION tst.xnotice(p_user uuid, p_quote uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.xsvc(); r := public.output_notice(p_user, p_quote); PERFORM tst.logout(); RETURN r; END $$;
CREATE OR REPLACE FUNCTION tst.xtok(n int) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT rpad('xcutTok' || n, 43, 'Q') $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;
INSERT INTO auth.users (id, email) VALUES (tst.xu(13), 'xcut-13@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency) VALUES (tst.xu(13), 'xcut-13@synthetic.test', 'Synthetic Xcut 13', 'Local', 'ILS');
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES (tst.xu(13), 'free_10');
INSERT INTO public.clients (id, company_name, email, user_id) VALUES (tst.xc(13), 'Synthetic Customer 13', 'xcust-13@synthetic.test', tst.xu(13));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
  SELECT tst.xq(13, n), tst.xu(13), 91300 + n, 'draft', tst.xc(13), 'v1' FROM generate_series(1, 2) n;
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (tst.xq(13, 1), 'Synthetic item', 1, 10, 10);
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES (tst.xq(2, 1), tst.xu(2), 82001, 'draft', NULL);
SELECT tst.ok(has_function_privilege('service_role', 'public.output_notice(uuid,uuid)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.output_notice(uuid,uuid)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.output_notice(uuid,uuid)', 'EXECUTE')
          AND (SELECT prosecdef AND provolatile = 's' AND proconfig @> ARRAY['search_path=public, pg_temp']
                 FROM pg_proc WHERE oid = 'public.output_notice(uuid,uuid)'::regprocedure),
  'L1 output_notice: service_role only, SECURITY DEFINER, STABLE (read-only), search_path pinned');
SELECT tst.ok(tst.xnotice(tst.xu(13), tst.xq(13, 1)) = '{"ok":false,"code":"not_activated"}'::jsonb, 'L2 phase not enforced (shadow): not_activated');
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
DO $$ DECLARE n jsonb; p jsonb; f jsonb; n2 jsonb; n3 jsonb; BEGIN
  n := tst.xnotice(tst.xu(13), tst.xq(13, 1));
  PERFORM tst.ok(tst.xkeys(n) = 'accountMode,alreadyFinalized,contentDigest,freeEndsAt,ok,periodEnded,remaining,unlimited,wouldConsume'
                 AND n ->> 'ok' = 'true' AND n ->> 'accountMode' = 'free_10' AND n ->> 'alreadyFinalized' = 'false'
                 AND n ->> 'wouldConsume' = 'true' AND (n ->> 'remaining')::int = 10,
                 'L3 Free, not yet output: exact keys, wouldConsume true, remaining 10');
  PERFORM tst.ok(n ->> 'contentDigest' = public.quote_output_digest(public.quote_output_deal_document(tst.xu(13), tst.xq(13, 1)))
                 AND n ->> 'contentDigest' ~ '^[0-9a-f]{64}$', 'L4 contentDigest = quote-document/v1 digest of the deal');
  PERFORM tst.ok(tst.xnotice(tst.xu(13), tst.xq(1, 1)) = '{"ok":false,"code":"quote_not_found"}'::jsonb
                 AND tst.xnotice(tst.xu(13), gen_random_uuid()) = '{"ok":false,"code":"quote_not_found"}'::jsonb,
                 'L5 owner-only: another account''s quote answers exactly like a missing one (quote_not_found)');
  PERFORM tst.ok(tst.xnotice(tst.xu(4), tst.xq(4, 1)) = '{"ok":false,"code":"account_not_provisioned"}'::jsonb, 'L6 unprovisioned: account_not_provisioned');
  -- the digest from the notice is exactly what prepare accepts
  PERFORM tst.xsvc();
  p := public.prepare_quote_output(tst.xu(13), tst.xq(13, 1), 'final_pdf', 'x-notice-key-01', n ->> 'contentDigest', 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  PERFORM tst.ok(p ->> 'state' = 'preparing' AND p ->> 'contentDigest' = n ->> 'contentDigest', 'L7 prepare accepts the notice digest as p_expected_digest');
  n2 := tst.xnotice(tst.xu(13), tst.xq(13, 2));
  PERFORM tst.ok((n2 ->> 'remaining')::int = 9, 'L8 remaining counts the live reservation (10 - 0 - 1)');
  PERFORM tst.xput(p ->> 'snapshotPath');
  f := tst.xfin(tst.xu(13), (p ->> 'attemptId')::uuid, p ->> 'snapshotPath');
  n3 := tst.xnotice(tst.xu(13), tst.xq(13, 1));
  PERFORM tst.ok(f ->> 'state' = 'finalized' AND n3 ->> 'alreadyFinalized' = 'true' AND n3 ->> 'wouldConsume' = 'false'
                 AND (n3 ->> 'remaining')::int = 9, 'L9 after finalize: alreadyFinalized true, wouldConsume false, remaining 9');
  n := tst.xnotice(tst.xu(2), tst.xq(2, 1));
  PERFORM tst.ok(n ->> 'accountMode' = 'paid' AND jsonb_typeof(n -> 'remaining') = 'null' AND n ->> 'wouldConsume' = 'false',
                 'L10 paid: remaining null, wouldConsume false');
END $$;

-- ======================================================================================== M. approval / signature by capability
SELECT tst.ok(encode(pg_catalog.sha256(convert_to(tst.xtok(1), 'UTF8')), 'hex')
            = encode(extensions.digest(convert_to(tst.xtok(1), 'UTF8'), 'sha256'), 'hex')
          AND tst.xtok(1) ~ '^[A-Za-z0-9_-]{43}$',
  'M1 token hash: pg_catalog.sha256 = extensions.digest(..., sha256) (pgcrypto in schema extensions); test tokens are 43-char base64url');
SELECT tst.ok((SELECT string_agg(a::text, ',' ORDER BY a::text COLLATE "C") FROM pg_proc p, unnest(p.proacl) a
                WHERE p.oid = 'public.public_approve_quote(uuid,text)'::regprocedure) = 'anon=X/postgres,authenticated=X/postgres,postgres=X/postgres'
          AND has_function_privilege('anon', 'public.public_approve_quote_capability(text,text)', 'EXECUTE')
          AND has_function_privilege('authenticated', 'public.public_approve_quote_capability(text,text)', 'EXECUTE')
          AND NOT has_function_privilege('service_role', 'public.public_approve_quote_capability(text,text)', 'EXECUTE')
          AND NOT has_function_privilege('anon', 'public.quote_public_approve_internal(uuid,text,boolean)', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.quote_public_approve_internal(uuid,text,boolean)', 'EXECUTE')
          AND NOT has_function_privilege('service_role', 'public.quote_public_approve_internal(uuid,text,boolean)', 'EXECUTE')
          AND (SELECT proconfig @> ARRAY['search_path=public, pg_temp'] AND prosecdef FROM pg_proc
                WHERE oid = 'public.public_approve_quote_capability(text,text)'::regprocedure),
  'M2 public_approve_quote keeps its ACL (anon, authenticated, owner); capability approval: anon + authenticated; internal helper: no API role');
-- not enforced: the id path is unchanged (a post-cutover finalized quote is still approvable by id)
UPDATE public.subscription_activation SET phase = 'shadow' WHERE component = 'free_issue';
SELECT tst.anon();
SELECT tst.lives(format($$ SELECT public.public_approve_quote(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xq(1, 12)),
                 'M3 not enforced: id path unchanged (a post-cutover draft quote id is still approved by id)');
SELECT tst.logout();
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
-- tokens (raw tokens never reach the DB; only their sha256 hex)
CREATE TEMP TABLE m_att AS SELECT requested_channel, quote_id, attempt_id FROM e_att;
DO $$ DECLARE
  a_print uuid := (SELECT attempt_id FROM m_att WHERE requested_channel = 'final_print' LIMIT 1);
  a_share uuid := (SELECT attempt_id FROM m_att WHERE requested_channel = 'public_share' LIMIT 1);
  a_send  uuid := (SELECT attempt_id FROM m_att WHERE requested_channel = 'send' LIMIT 1);
  r jsonb; ok_all boolean := true; v_cap uuid;
BEGIN
  PERFORM tst.xsvc();
  r := public.mint_public_capability(tst.xu(1), a_print, encode(sha256(convert_to(tst.xtok(1), 'UTF8')), 'hex'), ARRAY['view', 'approve'], NULL);
  ok_all := ok_all AND r ->> 'ok' = 'true';
  r := public.mint_public_capability(tst.xu(1), a_share, encode(sha256(convert_to(tst.xtok(2), 'UTF8')), 'hex'), ARRAY['view'], NULL);
  ok_all := ok_all AND r ->> 'ok' = 'true';
  r := public.mint_public_capability(tst.xu(1), a_send, encode(sha256(convert_to(tst.xtok(3), 'UTF8')), 'hex'), ARRAY['approve'], NULL);
  ok_all := ok_all AND r ->> 'ok' = 'true';
  r := public.mint_public_capability(tst.xu(1), a_send, encode(sha256(convert_to(tst.xtok(4), 'UTF8')), 'hex'), ARRAY['approve'], now() + interval '1 hour');
  ok_all := ok_all AND r ->> 'ok' = 'true';
  PERFORM tst.logout();
  v_cap := (SELECT id FROM public.quote_public_capabilities WHERE token_hash = encode(sha256(convert_to(tst.xtok(3), 'UTF8')), 'hex'));
  PERFORM tst.login(tst.xu(1));
  r := public.revoke_public_capability(v_cap, 'test');
  PERFORM tst.logout();
  ok_all := ok_all AND r ->> 'changed' = 'true';
  SET LOCAL session_replication_role = replica;
  UPDATE public.quote_public_capabilities SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 second'
   WHERE token_hash = encode(sha256(convert_to(tst.xtok(4), 'UTF8')), 'hex');
  SET LOCAL session_replication_role = origin;
  PERFORM tst.ok(ok_all, 'M4 fixture: approve token (final_print artifact), view-only token, revoked token, expired token');
END $$;
CREATE TEMP TABLE m_before AS SELECT id, status, signature FROM public.quotes WHERE user_id IN (tst.xu(1), tst.xu(3));
SELECT tst.anon();
SELECT tst.throws(format($$ SELECT public.public_approve_quote_capability(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xtok(2)),
                  '^Quote not found or cannot be approved$', 'M5 view-only token: refused (uniform not-found error)');
SELECT tst.throws(format($$ SELECT public.public_approve_quote_capability(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xtok(3)),
                  '^Quote not found or cannot be approved$', 'M6 revoked token: refused (uniform)');
SELECT tst.throws(format($$ SELECT public.public_approve_quote_capability(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xtok(4)),
                  '^Quote not found or cannot be approved$', 'M7 expired token: refused (uniform)');
SELECT tst.throws(format($$ SELECT public.public_approve_quote_capability(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xtok(99)),
                  '^Quote not found or cannot be approved$', 'M8 unknown well-formed token: refused (uniform)');
SELECT tst.throws($$ SELECT public.public_approve_quote_capability('short-token', 'data:image/png;base64,iVBORw0KGgo=') $$,
                  '^Quote not found or cannot be approved$', 'M9 malformed token: refused (uniform)');
SELECT tst.throws($$ SELECT public.public_approve_quote_capability(NULL, 'data:image/png;base64,iVBORw0KGgo=') $$,
                  '^Quote not found or cannot be approved$', 'M10 missing token: refused (uniform)');
SELECT tst.logout();
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.quotes q JOIN m_before b ON b.id = q.id
                           WHERE q.status IS DISTINCT FROM b.status OR q.signature IS DISTINCT FROM b.signature),
  'M11 refused tokens changed no quote');
SELECT tst.anon();
SELECT tst.throws(format($$ SELECT public.public_approve_quote_capability(%L, 'data:image/jpeg;base64,AAAA') $$, tst.xtok(1)),
                  'Invalid signature format', 'M12 valid token, invalid signature: the shared signature checks apply');
SELECT tst.logout();
SELECT tst.login(tst.xu(1));
SELECT tst.throws(format($$ SELECT public.public_approve_quote_capability(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xtok(1)),
                  'member of the business that issued this quote cannot approve', 'M13 the issuing owner cannot sign through its own token (OD-9)');
SELECT tst.logout();
SELECT tst.anon();
SELECT tst.lives(format($$ SELECT public.public_approve_quote_capability(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xtok(1)),
                 'M14 valid approve token (enforced): the bound quote is approved by an anonymous customer');
SELECT tst.logout();
SELECT tst.ok((SELECT status = 'approved' AND signature = 'data:image/png;base64,iVBORw0KGgo=' FROM public.quotes
                WHERE id = (SELECT quote_id FROM m_att WHERE requested_channel = 'final_print' LIMIT 1))
          AND (SELECT count(*) FROM public.quotes q JOIN m_before b ON b.id = q.id
                WHERE q.status IS DISTINCT FROM b.status OR q.signature IS DISTINCT FROM b.signature) = 1,
  'M15 exactly the token''s bound quote changed (a token never approves another quote)');
SELECT tst.anon();
SELECT tst.throws(format($$ SELECT public.public_approve_quote_capability(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xtok(1)),
                  'not found or cannot be approved', 'M16 a second approval with the same token is refused (already signed)');
-- id path while enforced
SELECT tst.throws(format($$ SELECT public.public_approve_quote(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xq(1, 7)),
                  '^Quote not found or cannot be approved$', 'M17 enforced: a post-cutover quote id is refused by id');
SELECT tst.throws(format($$ SELECT public.public_approve_quote(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, gen_random_uuid()),
                  '^Quote not found or cannot be approved$', 'M18 ... with exactly the error of an unknown id');
SELECT tst.throws(format($$ SELECT public.public_approve_quote(%L, 'data:image/jpeg;base64,AAAA') $$, tst.xq(1, 7)),
                  '^Invalid signature format$', 'M19 no oracle: with a bad signature the post-cutover id fails like an unknown id ...');
SELECT tst.throws(format($$ SELECT public.public_approve_quote(%L, 'data:image/jpeg;base64,AAAA') $$, gen_random_uuid()),
                  '^Invalid signature format$', 'M20 ... (unknown id, same error)');
SELECT tst.lives(format($$ SELECT public.public_approve_quote(%L, 'data:image/png;base64,iVBORw0KGgo=') $$, tst.xq(3, 10)),
                 'M21 enforced: a cutover-allowlisted legacy quote id is still approvable by id');
SELECT tst.logout();
SELECT tst.ok(NOT public.is_legacy_public_quote(tst.xq(1, 7)) AND (SELECT status FROM public.quotes WHERE id = tst.xq(1, 7)) = 'draft'
          AND (SELECT status FROM public.quotes WHERE id = tst.xq(3, 10)) = 'approved',
  'M22 the post-cutover quote is unchanged; the legacy quote is approved');

ROLLBACK;
