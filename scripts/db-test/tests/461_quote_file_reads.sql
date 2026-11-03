-- Owner 2026-11-03 (typed approval): "quote from a file" - the SMART PACK allowance of file reads (20261103100000).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the table is closed to the app and holds no file content; the caller sees only their own counters; 50 reads a month for
-- SMART PACK (and for everyone while the plan system is inert), the 51st refused without using anything; one read in flight; a failed
-- read is given back; a stale read is given back after 10 minutes; the free 7 days give 3; without SMART PACK nothing; finishing is the
-- service role's only.
BEGIN;
SELECT tst.seed();

CREATE OR REPLACE FUNCTION tst.fsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
-- one full read as the Edge Function runs it: claim as the caller, then finish (service role); returns the claim answer
CREATE OR REPLACE FUNCTION tst.fread(p_uid uuid, p_ok boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.login(p_uid);
  r := public.quote_file_read_claim();
  PERFORM tst.logout();
  IF (r ->> 'ok')::boolean THEN
    PERFORM tst.fsvc();
    PERFORM public.quote_file_read_finish((r ->> 'claimId')::uuid, p_ok, 'gpt-test', 1000, 200, 900, 4500);
    PERFORM tst.logout();
  END IF;
  RETURN r;
END $$;

DO $$
BEGIN
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quote_file_read_claims' AND rowsecurity)
                 AND NOT has_table_privilege('authenticated', 'public.quote_file_read_claims', 'select')
                 AND NOT has_table_privilege('authenticated', 'public.quote_file_read_claims', 'insert')
                 AND NOT has_table_privilege('anon', 'public.quote_file_read_claims', 'select'),
    'T0 quote_file_read_claims exists with RLS on and is closed to the app');
  PERFORM tst.ok((SELECT array_agg(column_name::text ORDER BY column_name) FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'quote_file_read_claims')
                 = ARRAY['claim_id', 'completion_tokens', 'cost_micros', 'created_at', 'finished_at', 'model', 'period', 'prompt_tokens', 'provider_ms', 'state', 'user_id'],
    'T0b no file content can be kept: ids, period, state, model, token counts, time and cost only (no name, hash, text, line or price)');
  PERFORM tst.ok(has_function_privilege('authenticated', 'public.quote_file_read_claim()', 'execute')
                 AND has_function_privilege('authenticated', 'public.quote_file_read_status()', 'execute')
                 AND NOT has_function_privilege('anon', 'public.quote_file_read_claim()', 'execute')
                 AND NOT has_function_privilege('authenticated', 'public.quote_file_read_finish(uuid, boolean, text, integer, integer, integer, integer)', 'execute')
                 AND has_function_privilege('service_role', 'public.quote_file_read_finish(uuid, boolean, text, integer, integer, integer, integer)', 'execute'),
    'T0c the app may only read its counters and claim; finishing is the service role''s');
END $$;

-- ------------------------------------------------------------------------------------- T1. inert plan system: 50 a month for everyone
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok(public.quote_file_read_status() @> '{"ok":true,"smartPack":true,"limit":50,"used":0,"remaining":50}'::jsonb
          AND public.quote_file_read_status() ->> 'period' ~ '^[0-9]{4}-[0-9]{2}$',
  'T1 inert plan system: the account counts as SMART PACK - 50 of 50 this month');
SELECT tst.logout();
DO $$
DECLARE r jsonb; c jsonb; i integer;
BEGIN
  -- one read in flight: a second claim while the first is open is refused (in_progress) and uses nothing
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  r := public.quote_file_read_claim();
  c := public.quote_file_read_claim();
  PERFORM tst.logout();
  PERFORM tst.ok((r ->> 'ok')::boolean AND c ->> 'code' = 'in_progress' AND (c -> 'status' ->> 'used')::int = 1,
    'T2 a double click: the second read is refused while the first is open (counted once)');
  -- the first read fails: given back
  PERFORM tst.fsvc();
  PERFORM public.quote_file_read_finish((r ->> 'claimId')::uuid, false);
  PERFORM tst.ok(public.quote_file_read_finish((r ->> 'claimId')::uuid, true) ->> 'code' = 'already_finished', 'T2b a claim is finished once');
  PERFORM tst.logout();
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  PERFORM tst.ok((public.quote_file_read_status() ->> 'used')::int = 0, 'T3 a failed read is given back (0 used)');
  PERFORM tst.logout();
  FOR i IN 1..50 LOOP r := tst.fread('00000000-0000-4000-8000-00000000000a'); END LOOP;
  PERFORM tst.ok((r ->> 'ok')::boolean AND (r -> 'status' ->> 'remaining')::int = 0, 'T4 the 50th read of the month uses the last one');
  r := tst.fread('00000000-0000-4000-8000-00000000000a');
  PERFORM tst.ok(NOT (r ->> 'ok')::boolean AND r ->> 'code' = 'quota_exhausted' AND (r -> 'status' ->> 'used')::int = 50,
    'T4b the 51st is refused (quota_exhausted) and uses nothing');
END $$;

-- ------------------------------------------------------------------------------------- T5. a stale read is given back after 10 minutes
DO $$
DECLARE r jsonb; n jsonb;
BEGIN
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  r := public.quote_file_read_claim();
  PERFORM tst.logout();
  UPDATE public.quote_file_read_claims SET created_at = now() - interval '11 minutes' WHERE claim_id = (r ->> 'claimId')::uuid;
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  n := public.quote_file_read_claim();
  PERFORM tst.logout();
  PERFORM tst.ok((n ->> 'ok')::boolean AND (SELECT state FROM public.quote_file_read_claims WHERE claim_id = (r ->> 'claimId')::uuid) = 'refunded',
    'T5 a read left open for 10 minutes is given back before the next one starts');
END $$;

-- ------------------------------------------------------------------------------- T6. enforced plan system: SMART PACK decides
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  VALUES ('00000000-0000-4000-8000-00000000000c', 'plain-user-c@synthetic.test', 'Synthetic C', 'Local', 'ILS') ON CONFLICT (user_id) DO NOTHING;
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.account_entitlements SET free_window_starts_at = now() - interval '1 hour', free_window_smart_pack = true
 WHERE user_id = '00000000-0000-4000-8000-00000000000c';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.login('00000000-0000-4000-8000-00000000000c');
SELECT tst.ok(public.quote_file_read_status() @> '{"smartPack":true,"period":"free","limit":3,"remaining":3}'::jsonb,
  'T6 the free 7 days (SMART PACK included): 3 reads in the whole window');
SELECT tst.logout();
DO $$
DECLARE r jsonb; i integer;
BEGIN
  FOR i IN 1..3 LOOP r := tst.fread('00000000-0000-4000-8000-00000000000c'); END LOOP;
  PERFORM tst.ok((r ->> 'ok')::boolean AND (r -> 'status' ->> 'remaining')::int = 0, 'T6b the 3rd read in the free days is the last one');
  r := tst.fread('00000000-0000-4000-8000-00000000000c');
  PERFORM tst.ok(r ->> 'code' = 'quota_exhausted', 'T6c the 4th is refused');
END $$;
-- the free 7 days are over and there is no SMART PACK: nothing
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.account_entitlements SET free_window_starts_at = now() - interval '30 days' WHERE user_id = '00000000-0000-4000-8000-00000000000c';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.login('00000000-0000-4000-8000-00000000000c');
SELECT tst.ok(public.quote_file_read_status() @> '{"smartPack":false,"limit":0,"remaining":0}'::jsonb
          AND public.quote_file_read_claim() ->> 'code' = 'smart_pack_required',
  'T7 enforced, no SMART PACK: no reads; a read is refused (smart_pack_required)');
SELECT tst.logout();
-- LIFETIME: SMART PACK, 50 a month
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.business_settings SET is_lifetime = true WHERE user_id = '00000000-0000-4000-8000-00000000000c';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.login('00000000-0000-4000-8000-00000000000c');
SELECT tst.ok(public.quote_file_read_status() @> '{"smartPack":true,"limit":50}'::jsonb AND public.quote_file_read_status() ->> 'period' <> 'free',
  'T8 LIFETIME counts as SMART PACK: 50 a month');
SELECT tst.logout();

ROLLBACK;
