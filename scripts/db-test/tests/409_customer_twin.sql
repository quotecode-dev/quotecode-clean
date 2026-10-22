-- Owner 2026-10-22 (night task): Customer Twin ("בדיקת הלקוח") allowance, purchased checks and stored results (20261023000000).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: every table is closed to the app; the caller sees only their own counters; 20 included checks a month for SMART PACK
-- (and for everyone while the plan system is inert), the 21st refused without using anything; a stored result of the same content is
-- returned free; a double click never uses two checks; a failed AI call gives the check back; purchased checks are used only after the
-- month's 20, never expire and show "x of y"; without SMART PACK only purchased checks work; store / refund / grant are service-role only.
BEGIN;
SELECT tst.seed();

CREATE OR REPLACE FUNCTION tst.tsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.tsha(n integer) RETURNS text LANGUAGE sql AS $$ SELECT encode(sha256(convert_to('twin-' || n, 'UTF8')), 'hex') $$;
CREATE OR REPLACE FUNCTION tst.tres() RETURNS jsonb LANGUAGE sql AS $$
  SELECT '{"schema":"customer-twin/1","personas":[],"persuasive":[],"blockers":[],"strengthen":[],"edits":[]}'::jsonb $$;
-- one full check as the Edge Function runs it: claim as the caller, then store (service role); returns the claim answer
CREATE OR REPLACE FUNCTION tst.tcheck(p_uid uuid, n integer) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.login(p_uid);
  r := public.customer_twin_claim(tst.tsha(n));
  PERFORM tst.logout();
  IF (r ->> 'ok')::boolean AND NOT (r ->> 'cached')::boolean THEN
    PERFORM tst.tsvc();
    PERFORM public.customer_twin_store((r ->> 'claimId')::uuid, tst.tres(), 'gpt-test', 'v1');
    PERFORM tst.logout();
  END IF;
  RETURN r;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_twin_usage', 'customer_twin_credits', 'customer_twin_credit_ledger', 'customer_twin_claims', 'customer_twin_results'] LOOP
    PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t AND rowsecurity)
                   AND NOT has_table_privilege('authenticated', 'public.' || t, 'select') AND NOT has_table_privilege('authenticated', 'public.' || t, 'insert')
                   AND NOT has_table_privilege('anon', 'public.' || t, 'select'), format('T0 %s exists with RLS on and is closed to the app', t));
  END LOOP;
  PERFORM tst.ok(has_function_privilege('authenticated', 'public.customer_twin_claim(text)', 'execute')
                 AND has_function_privilege('authenticated', 'public.customer_twin_status()', 'execute')
                 AND NOT has_function_privilege('anon', 'public.customer_twin_claim(text)', 'execute')
                 AND NOT has_function_privilege('authenticated', 'public.customer_twin_store(uuid, jsonb, text, text)', 'execute')
                 AND NOT has_function_privilege('authenticated', 'public.customer_twin_refund(uuid)', 'execute')
                 AND NOT has_function_privilege('authenticated', 'public.customer_twin_grant_credits(uuid, integer, text)', 'execute')
                 AND has_function_privilege('service_role', 'public.customer_twin_store(uuid, jsonb, text, text)', 'execute'),
    'T0b the app may only read its counters and claim; store / refund / grant are the service role''s');
END $$;

-- ------------------------------------------------------------------------------------- T1. inert plan system: 20 a month for everyone
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok(public.customer_twin_status() @> '{"ok":true,"enforced":false,"smartPack":true,"monthlyLimit":20,"monthlyUsed":0,"monthlyRemaining":20,"purchasedRemaining":0,"purchasedTotal":0}'::jsonb,
  'T1 inert plan system: the account counts as SMART PACK - 20 of 20 left, nothing purchased');
SELECT tst.ok(public.customer_twin_claim('not-a-hash') ->> 'code' = 'invalid_request', 'T1b a malformed content hash is refused');
SELECT tst.logout();
DO $$
DECLARE r jsonb; i integer;
BEGIN
  FOR i IN 1..20 LOOP r := tst.tcheck('00000000-0000-4000-8000-00000000000a', i); END LOOP;
  PERFORM tst.ok((r ->> 'ok')::boolean AND r ->> 'source' = 'monthly' AND (r -> 'status' ->> 'monthlyRemaining')::int = 0,
    'T2 the 20th check of the month uses the last included check');
  r := tst.tcheck('00000000-0000-4000-8000-00000000000a', 21);
  PERFORM tst.ok(NOT (r ->> 'ok')::boolean AND r ->> 'code' = 'quota_exhausted' AND (r -> 'status' ->> 'monthlyUsed')::int = 20,
    'T2b the 21st is refused (quota_exhausted) and uses nothing');
  r := tst.tcheck('00000000-0000-4000-8000-00000000000a', 7);
  PERFORM tst.ok((r ->> 'ok')::boolean AND (r ->> 'cached')::boolean AND r -> 'result' ->> 'schema' = 'customer-twin/1',
    'T3 the same quote content again: the stored analysis, free - even with the month used up');
END $$;
SELECT tst.ok((SELECT checks FROM public.customer_twin_usage WHERE user_id = '00000000-0000-4000-8000-00000000000a') = 20,
  'T3b exactly 20 counted');

-- ---------------------------------------------------------------------------------- T4. purchased checks: after the 20, never expire
SELECT tst.tsvc();
SELECT tst.ok(public.customer_twin_grant_credits('00000000-0000-4000-8000-00000000000a', 20, 'pp-twin-1') ->> 'ok' = 'true'
          AND public.customer_twin_grant_credits('00000000-0000-4000-8000-00000000000a', 20, 'pp-twin-1') ->> 'duplicate' = 'true'
          AND public.customer_twin_grant_credits('00000000-0000-4000-8000-00000000000a', 7, 'pp-twin-x') ->> 'code' = 'invalid_request',
  'T4 a purchase of 20 adds 20 once (the same payment ref twice = one purchase); only packs of 10 / 20');
SELECT tst.logout();
DO $$
DECLARE r jsonb; i integer;
BEGIN
  FOR i IN 1..16 LOOP r := tst.tcheck('00000000-0000-4000-8000-00000000000a', 100 + i); END LOOP;
  PERFORM tst.ok((r ->> 'ok')::boolean AND r ->> 'source' = 'purchased'
                 AND r -> 'status' @> '{"purchasedRemaining":4,"purchasedTotal":20,"monthlyRemaining":0}'::jsonb,
    'T4b with the month used up the purchased checks are used: "4 of 20" left');
END $$;
-- a new month: the included 20 come back first, the purchased 4 stay
UPDATE public.customer_twin_usage SET usage_month = (usage_month - interval '1 month')::date WHERE user_id = '00000000-0000-4000-8000-00000000000a';
DO $$
DECLARE r jsonb;
BEGIN
  r := tst.tcheck('00000000-0000-4000-8000-00000000000a', 200);
  PERFORM tst.ok(r ->> 'source' = 'monthly' AND r -> 'status' @> '{"monthlyRemaining":19,"purchasedRemaining":4,"purchasedTotal":20}'::jsonb,
    'T4c a new month: the 20 included come first; the purchased checks never expire');
END $$;
SELECT tst.ok((SELECT sum(delta) FROM public.customer_twin_credit_ledger WHERE user_id = '00000000-0000-4000-8000-00000000000a') = 4
          AND (SELECT count(*) FROM public.customer_twin_credit_ledger WHERE kind = 'use' AND user_id = '00000000-0000-4000-8000-00000000000a') = 16,
  'T4d the ledger adds up to the balance (20 bought, 16 used)');
SELECT tst.throws($q$UPDATE public.customer_twin_credit_ledger SET delta = 99$q$, 'append', 'T4e the purchased-checks ledger is append-only');

-- --------------------------------------------------------------------------------------- T5. double click / failed AI call
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
DECLARE r1 jsonb; r2 jsonb;
BEGIN
  r1 := public.customer_twin_claim(tst.tsha(500));
  r2 := public.customer_twin_claim(tst.tsha(500));
  PERFORM tst.ok((r1 ->> 'ok')::boolean AND r2 ->> 'code' = 'in_progress' AND (r2 -> 'status' ->> 'monthlyUsed')::int = 1,
    'T5 a double click on the same content: one check, the second answer is in_progress');
  PERFORM tst.logout();
  PERFORM tst.tsvc();
  PERFORM tst.ok(public.customer_twin_refund((r1 ->> 'claimId')::uuid) -> 'status' ->> 'monthlyUsed' = '0'
                 AND public.customer_twin_refund((r1 ->> 'claimId')::uuid) ->> 'code' = 'already_finished'
                 AND public.customer_twin_store((r1 ->> 'claimId')::uuid, tst.tres(), 'gpt-test', 'v1') ->> 'code' = 'already_finished',
    'T5b a failed AI call gives the check back once; a refunded claim can never be stored');
  PERFORM tst.logout();
END $$;
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.throws($q$SELECT public.customer_twin_store(gen_random_uuid(), '{}'::jsonb, 'm', 'v')$q$, 'permission denied', 'T5c a user cannot store a result');
SELECT tst.throws($q$SELECT * FROM public.customer_twin_results$q$, 'permission denied', 'T5d a user cannot read the stored results directly');
SELECT tst.logout();
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.customer_twin_results WHERE user_id = '00000000-0000-4000-8000-00000000000b'),
  'T5e nothing stored for the refunded check');

-- ------------------------------------------------------------------------------- T6. enforced plan system: SMART PACK decides
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
-- user C has no SMART PACK (no entitlement row) and nothing purchased
INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  VALUES ('00000000-0000-4000-8000-00000000000c', 'plain-user-c@synthetic.test', 'Synthetic C', 'Local', 'ILS') ON CONFLICT (user_id) DO NOTHING;
-- its free 7 days (with SMART PACK) are over
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.account_entitlements SET free_window_starts_at = now() - interval '30 days' WHERE user_id = '00000000-0000-4000-8000-00000000000c';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.login('00000000-0000-4000-8000-00000000000c');
SELECT tst.ok(public.customer_twin_status() @> '{"enforced":true,"smartPack":false,"monthlyLimit":0,"monthlyRemaining":0,"purchasePackSize":10}'::jsonb
          AND public.customer_twin_claim(tst.tsha(600)) ->> 'code' = 'smart_pack_required',
  'T6 enforced, no SMART PACK: no included checks; the offer is the pack of 10; a check is refused (smart_pack_required)');
SELECT tst.logout();
SELECT tst.tsvc();
SELECT public.customer_twin_grant_credits('00000000-0000-4000-8000-00000000000c', 10, 'pp-twin-c1');
SELECT tst.logout();
DO $$
DECLARE r jsonb;
BEGIN
  r := tst.tcheck('00000000-0000-4000-8000-00000000000c', 601);
  PERFORM tst.ok((r ->> 'ok')::boolean AND r ->> 'source' = 'purchased' AND r -> 'status' @> '{"purchasedRemaining":9,"purchasedTotal":10}'::jsonb,
    'T6b without SMART PACK the 10 bought checks work: "9 of 10" left');
END $$;
-- user A is LIFETIME: SMART PACK, the month's 20 again
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.business_settings SET is_lifetime = true WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok(public.customer_twin_status() @> '{"enforced":true,"smartPack":true,"monthlyLimit":20,"purchasePackSize":20}'::jsonb,
  'T6c LIFETIME counts as SMART PACK (20 a month; the extra pack is 20)');
SELECT tst.logout();

-- ------------------------------------------------------------------------------ T8. a stuck check, a refund of a purchased check
-- user C: one purchased check in use, a new purchase arrives during the AI call, then the call fails -> the check comes back in full
DO $$
DECLARE r jsonb; v_claim uuid;
BEGIN
  PERFORM tst.login('00000000-0000-4000-8000-00000000000c');
  r := public.customer_twin_claim(tst.tsha(800));
  v_claim := (r ->> 'claimId')::uuid;
  PERFORM tst.logout();
  PERFORM tst.tsvc();
  PERFORM public.customer_twin_grant_credits('00000000-0000-4000-8000-00000000000c', 10, 'pp-twin-c2');
  r := public.customer_twin_refund(v_claim);
  PERFORM tst.logout();
  PERFORM tst.ok(r -> 'status' @> '{"purchasedRemaining":19,"purchasedTotal":20}'::jsonb
                 AND (SELECT sum(delta) FROM public.customer_twin_credit_ledger WHERE user_id = '00000000-0000-4000-8000-00000000000c') = 19,
    'T8 a purchase during a failed call: the purchased check comes back in full and the ledger equals the balance');
END $$;
-- a check stuck in 'claimed' for over 10 minutes is given back on the next claim (and the same content can be checked again)
DO $$
DECLARE r jsonb; v_claim uuid;
BEGIN
  PERFORM tst.login('00000000-0000-4000-8000-00000000000c');
  r := public.customer_twin_claim(tst.tsha(801));
  v_claim := (r ->> 'claimId')::uuid;
  PERFORM tst.logout();
  UPDATE public.customer_twin_claims SET created_at = now() - interval '11 minutes' WHERE claim_id = v_claim;
  PERFORM tst.login('00000000-0000-4000-8000-00000000000c');
  r := public.customer_twin_claim(tst.tsha(801));
  PERFORM tst.logout();
  PERFORM tst.ok((r ->> 'ok')::boolean AND (SELECT state FROM public.customer_twin_claims WHERE claim_id = v_claim) = 'refunded'
                 AND (r -> 'status' ->> 'purchasedRemaining')::int = 18,
    'T8b a stuck check is refunded on the next claim: one check used, not two');
END $$;
-- 10 failures in 24 hours: no more tries today (each failure cost a model call)
UPDATE public.customer_twin_claims SET state = 'refunded', finished_at = now() WHERE user_id = '00000000-0000-4000-8000-00000000000c' AND state = 'claimed';
INSERT INTO public.customer_twin_claims (user_id, content_sha256, source, usage_month, state, finished_at)
SELECT '00000000-0000-4000-8000-00000000000c', tst.tsha(900 + g), 'purchased', date_trunc('month', now())::date, 'refunded', now() FROM generate_series(1, 10) g;
SELECT tst.login('00000000-0000-4000-8000-00000000000c');
SELECT tst.ok(public.customer_twin_claim(tst.tsha(999)) ->> 'code' = 'too_many_failures', 'T8c ten failed checks in a day: refused (too_many_failures)');
SELECT tst.logout();

-- no identity
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.customer_twin_claim('aa')$q$, 'permission denied|not authenticated', 'T7 ANON cannot claim');
SELECT tst.logout();

ROLLBACK;
