-- Owner 2026-11-06 (typed night-task approval): the SMART PACK usage meter (20261106100000).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the table is closed to the app and keeps no content; the caller sees only their own meter; 4 ILS a month at 3.5 ILS per USD;
-- a claim holds the action's maximum cost while it runs, so the budget can never be passed (also in parallel); a failed call is given
-- back (0 counted); a stale claim is COUNTED at its reserve after 10 minutes (2026-11-07, the Owner: "סעיף 3 לספור"); at 0% the action is refused (budget_exhausted) and nothing is held;
-- without SMART PACK nothing; the super admin (who is also LIFETIME) is recorded but never refused; finishing is the service role's;
-- the cost view is the super admin's; the count quotas of a quote from a file and Customer Twin are lifted.
BEGIN;
SELECT tst.seed();

CREATE OR REPLACE FUNCTION tst.msvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
-- one metered action as an Edge Function runs it: claim as the caller (reserve), then finish (service role) with a USD cost
CREATE OR REPLACE FUNCTION tst.mact(p_uid uuid, p_feature text, p_reserve bigint, p_usd_micros bigint, p_ok boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.login(p_uid);
  r := public.smart_pack_usage_claim(p_feature, p_reserve);
  PERFORM tst.logout();
  IF (r ->> 'ok')::boolean THEN
    PERFORM tst.msvc();
    PERFORM public.smart_pack_usage_finish((r ->> 'claimId')::uuid, p_ok, p_usd_micros, 'gpt-test', 1000, 100, 200, NULL);
    PERFORM tst.logout();
  END IF;
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.mstatus(p_uid uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.login(p_uid);
  r := public.smart_pack_usage_status();
  PERFORM tst.logout();
  RETURN r;
END $$;

DO $$
BEGIN
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'smart_pack_usage_claims' AND rowsecurity)
                 AND NOT has_table_privilege('authenticated', 'public.smart_pack_usage_claims', 'select')
                 AND NOT has_table_privilege('authenticated', 'public.smart_pack_usage_claims', 'insert')
                 AND NOT has_table_privilege('anon', 'public.smart_pack_usage_claims', 'select'),
    'T0 smart_pack_usage_claims exists with RLS on and is closed to the app');
  PERFORM tst.ok((SELECT array_agg(column_name::text ORDER BY column_name) FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'smart_pack_usage_claims')
                 = ARRAY['cached_tokens', 'claim_id', 'completion_tokens', 'cost_micros', 'cost_usd_micros', 'created_at', 'exempt', 'feature',
                         'finished_at', 'model', 'prompt_tokens', 'reserve_micros', 'state', 'units', 'usage_month', 'usd_ils_rate', 'user_id'],
    'T0b no content can be kept: ids, feature, month, state, model, counts and costs only');
  PERFORM tst.ok(has_function_privilege('authenticated', 'public.smart_pack_usage_claim(text, bigint, bigint)', 'execute')
                 AND has_function_privilege('authenticated', 'public.smart_pack_usage_status()', 'execute')
                 AND NOT has_function_privilege('anon', 'public.smart_pack_usage_claim(text, bigint, bigint)', 'execute')
                 AND NOT has_function_privilege('anon', 'public.smart_pack_usage_status()', 'execute')
                 AND NOT has_function_privilege('authenticated', 'public.smart_pack_usage_finish(uuid, boolean, bigint, text, integer, integer, integer, numeric)', 'execute')
                 AND has_function_privilege('service_role', 'public.smart_pack_usage_finish(uuid, boolean, bigint, text, integer, integer, integer, numeric)', 'execute')
                 AND NOT has_function_privilege('authenticated', 'public.smart_pack_usage_state(uuid)', 'execute'),
    'T0c the app may only read its own meter and claim; finishing is the service role''s');
  PERFORM tst.ok(public.smart_pack_monthly_budget_micros() = 4000000 AND public.smart_pack_usd_ils_rate() = 3.5,
    'T0d the Owner''s numbers: 4 ILS a month; no representative rate stored yet -> the fallback 3.5 ILS per USD');
  PERFORM tst.ok(NOT has_function_privilege('authenticated', 'public.smart_pack_store_fx_rate(date, numeric)', 'execute')
                 AND has_function_privilege('service_role', 'public.smart_pack_store_fx_rate(date, numeric)', 'execute')
                 AND NOT has_table_privilege('authenticated', 'public.smart_pack_fx_rates', 'select'),
    'T0e only the service role stores a rate; the rates table is closed to the app');
END $$;

-- ------------------------------------------------------------------------------------- T1. inert plan system: 4 ILS for everyone
SELECT tst.ok(tst.mstatus('00000000-0000-4000-8000-00000000000a')
              @> '{"ok":true,"smartPack":true,"unlimited":false,"budgetMicros":4000000,"usedMicros":0,"remainingMicros":4000000,"percentLeft":100}'::jsonb
          AND tst.mstatus('00000000-0000-4000-8000-00000000000a') ->> 'month' ~ '^[0-9]{4}-[0-9]{2}$',
  'T1 inert plan system: the account counts as SMART PACK - 100% of 4 ILS this month');
DO $$
DECLARE r jsonb; s jsonb;
BEGIN
  -- a real action: $0.10 (100,000 micro-USD) at 3.5 = 0.35 ILS = 350,000 micro-ILS = 8.75% of 4 ILS
  r := tst.mact('00000000-0000-4000-8000-00000000000a', 'chat_data', 600000, 100000);
  s := tst.mstatus('00000000-0000-4000-8000-00000000000a');
  PERFORM tst.ok((r ->> 'ok')::boolean AND (s ->> 'usedMicros')::bigint = 350000 AND (s ->> 'reservedMicros')::bigint = 0
                 AND (s ->> 'percentLeft')::int = 91,
    'T2 the real provider cost is counted at 3.5 ILS per USD (0.35 ILS = 91% left); the reserve is released');
  PERFORM tst.ok((SELECT state = 'done' AND cost_usd_micros = 100000 AND usd_ils_rate = 3.5 AND cost_micros = 350000 AND feature = 'chat_data'
                    FROM public.smart_pack_usage_claims WHERE claim_id = (r ->> 'claimId')::uuid),
    'T2b the row keeps the USD cost, the rate of the moment and the ILS cost');
  -- a failed call: given back, 0 counted, usage still recorded
  r := tst.mact('00000000-0000-4000-8000-00000000000a', 'ai_draft', 10000, 2000, false);
  PERFORM tst.ok((SELECT state = 'refunded' AND cost_micros = 0 AND prompt_tokens = 1000 FROM public.smart_pack_usage_claims WHERE claim_id = (r ->> 'claimId')::uuid)
                 AND (tst.mstatus('00000000-0000-4000-8000-00000000000a') ->> 'usedMicros')::bigint = 350000,
    'T3 a failed call is given back (0 counted) and its usage is still recorded');
  PERFORM tst.msvc();
  PERFORM tst.ok(public.smart_pack_usage_finish((r ->> 'claimId')::uuid, true, 999999) ->> 'code' = 'already_finished', 'T3b a claim is finished once');
  PERFORM tst.logout();
END $$;

-- ------------------------------------------------------------------------------------- T4. the reserve: the budget is never passed
DO $$
DECLARE r1 jsonb; r2 jsonb; r3 jsonb; s jsonb;
BEGIN
  -- user B: 3.65 ILS left after a 0.35 ILS action; two parallel claims of 2 ILS each: the first holds 2, the second is refused
  PERFORM tst.mact('00000000-0000-4000-8000-00000000000b', 'voice', 200000, 100000);
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  r1 := public.smart_pack_usage_claim('chat_data', 2000000);
  r2 := public.smart_pack_usage_claim('chat_data', 2000000);
  s := public.smart_pack_usage_status();
  PERFORM tst.logout();
  PERFORM tst.ok((r1 ->> 'ok')::boolean AND r2 ->> 'code' = 'budget_exhausted' AND (s ->> 'reservedMicros')::bigint = 2000000
                 AND (s ->> 'remainingMicros')::bigint = 1650000 AND (s ->> 'percentLeft')::int = 91,
    'T4 a running action holds its maximum cost: a parallel action that would pass the budget is refused (budget_exhausted)');
  -- the running one actually cost 1 USD = 3.5 ILS: 0.35 + 3.5 = 3.85 used, 0.15 left = 3%
  PERFORM tst.msvc();
  PERFORM public.smart_pack_usage_finish((r1 ->> 'claimId')::uuid, true, 1000000);
  PERFORM tst.logout();
  s := tst.mstatus('00000000-0000-4000-8000-00000000000b');
  PERFORM tst.ok((s ->> 'usedMicros')::bigint = 3850000 AND (s ->> 'percentLeft')::int = 3, 'T4b 3.85 of 4 ILS used: 3% left');
  r3 := tst.mact('00000000-0000-4000-8000-00000000000b', 'file_quote', 160000, 1000);
  PERFORM tst.ok(r3 ->> 'code' = 'budget_exhausted' AND (r3 -> 'status' ->> 'reservedMicros')::bigint = 0,
    'T5 an action whose maximum cost is more than what is left is refused and holds nothing');
  r3 := tst.mact('00000000-0000-4000-8000-00000000000b', 'file_quote', 100000, 1000);
  PERFORM tst.ok((r3 ->> 'ok')::boolean, 'T5b a cheaper action that fits in what is left still runs');
  -- 3.8535 + a 0.1435 action (41,000 micro-USD) = 3.997 ILS used: 0.003 left is less than 1% - shown as 1%, never 0% while anything is left
  r3 := tst.mact('00000000-0000-4000-8000-00000000000b', 'ai_draft', 100000, 41000);
  PERFORM tst.ok((tst.mstatus('00000000-0000-4000-8000-00000000000b') ->> 'remainingMicros')::bigint BETWEEN 1 AND 39999 AND (tst.mstatus('00000000-0000-4000-8000-00000000000b') ->> 'percentLeft')::int = 1,
    'T5d a little left (under 1%) is shown as 1% - 0% only when nothing is left');
  PERFORM tst.ok(tst.mact('00000000-0000-4000-8000-00000000000b', 'chat_data', 0, 1) ->> 'code' = 'invalid_request'
                 AND tst.mact('00000000-0000-4000-8000-00000000000b', 'plain_chat', 1000, 1) ->> 'code' = 'invalid_request'
                 AND tst.mact('00000000-0000-4000-8000-00000000000b', 'chat_data', 2000001, 1) ->> 'code' = 'invalid_request',
    'T5c a zero / over-large reserve or an unknown feature is refused (a plain chat question is never metered)');
END $$;

-- ---------------------------------------------------------- T6. a stale claim is COUNTED at its reserve after 10 minutes (2026-11-07)
DO $$
DECLARE r jsonb; n jsonb;
BEGIN
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  r := public.smart_pack_usage_claim('customer_twin', 1500000);
  PERFORM tst.logout();
  UPDATE public.smart_pack_usage_claims SET created_at = now() - interval '11 minutes' WHERE claim_id = (r ->> 'claimId')::uuid;
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  n := public.smart_pack_usage_claim('customer_twin', 1500000);
  PERFORM tst.logout();
  PERFORM tst.ok((n ->> 'ok')::boolean AND (SELECT state = 'done' AND cost_micros = 1500000 AND model = 'reserve_not_finished' FROM public.smart_pack_usage_claims WHERE claim_id = (r ->> 'claimId')::uuid),
    'T6 an action left open for 10 minutes is counted at its reserve before the next one starts (2026-11-07, the Owner: count it)');
END $$;

-- ------------------------------------------------------------------------------- T7. enforced plan system: SMART PACK decides
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  VALUES ('00000000-0000-4000-8000-00000000000c', 'plain-user-c@synthetic.test', 'Synthetic C', 'Local', 'ILS') ON CONFLICT (user_id) DO NOTHING;
-- no free window (its 7 days are over) and no package: no SMART PACK
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.account_entitlements SET free_window_starts_at = now() - interval '30 days' WHERE user_id = '00000000-0000-4000-8000-00000000000c';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.ok(tst.mstatus('00000000-0000-4000-8000-00000000000c') @> '{"smartPack":false}'::jsonb
          AND tst.mact('00000000-0000-4000-8000-00000000000c', 'ai_draft', 10000, 1) ->> 'code' = 'smart_pack_required',
  'T7 enforced, no SMART PACK: refused (smart_pack_required), nothing held');
-- the free 7 days (SMART PACK included): the same 4 ILS
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.account_entitlements SET free_window_starts_at = now() - interval '1 hour', free_window_smart_pack = true
 WHERE user_id = '00000000-0000-4000-8000-00000000000c';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.ok(tst.mstatus('00000000-0000-4000-8000-00000000000c') @> '{"smartPack":true,"unlimited":false,"budgetMicros":4000000,"percentLeft":100}'::jsonb,
  'T7b the free 7 days: SMART PACK with the same 4 ILS');
-- LIFETIME: the same 4 ILS, refused at 0%
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.account_entitlements SET free_window_starts_at = now() - interval '30 days' WHERE user_id = '00000000-0000-4000-8000-00000000000c';
UPDATE public.business_settings SET is_lifetime = true WHERE user_id = '00000000-0000-4000-8000-00000000000c';
SELECT set_config('session_replication_role', 'origin', true);
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.ok(tst.mstatus('00000000-0000-4000-8000-00000000000c') @> '{"smartPack":true,"unlimited":false,"percentLeft":100}'::jsonb,
    'T8 LIFETIME counts as SMART PACK with the same 4 ILS');
  r := tst.mact('00000000-0000-4000-8000-00000000000c', 'chat_data', 2000000, 1142858);
  r := tst.mact('00000000-0000-4000-8000-00000000000c', 'chat_data', 100000, 1);
  PERFORM tst.ok(r ->> 'code' = 'budget_exhausted' AND (r -> 'status' ->> 'percentLeft')::int = 0,
    'T8b LIFETIME at 0% (4 ILS used): the next action is refused');
END $$;
-- the super admin: also LIFETIME (20261103200000), recorded, never refused, always 100%
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.business_settings SET role = 'super_admin', is_lifetime = true WHERE user_id = '00000000-0000-4000-8000-00000000000b';
SELECT set_config('session_replication_role', 'origin', true);
DO $$
DECLARE r jsonb;
BEGIN
  r := tst.mact('00000000-0000-4000-8000-00000000000b', 'chat_data', 2000000, 2000000);
  PERFORM tst.ok((r ->> 'ok')::boolean AND (r -> 'status' ->> 'unlimited')::boolean AND (r -> 'status' ->> 'percentLeft')::int = 100
                 AND (SELECT exempt AND cost_micros = 7000000 FROM public.smart_pack_usage_claims WHERE claim_id = (r ->> 'claimId')::uuid),
    'T9 the super admin (also LIFETIME) is never refused, shows 100%, and the cost is still recorded for the cost view');
END $$;

-- ------------------------------------------------------------------------------- T9b. the burst guard: 20 actions a minute per account
DO $$
DECLARE r jsonb; i integer;
BEGIN
  -- (the super admin, never refused by budget, so only the burst guard can stop it)
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  FOR i IN 1..25 LOOP r := public.smart_pack_usage_claim('ai_draft', 1); END LOOP;
  PERFORM tst.logout();
  PERFORM tst.ok(r ->> 'code' = 'too_many_requests'
                 AND (SELECT count(*) FROM public.smart_pack_usage_claims WHERE user_id = '00000000-0000-4000-8000-00000000000b' AND created_at > now() - interval '1 minute') = 20,
    'T9b at most 20 metered actions a minute per account (even the super admin) - a script cannot fill the table');
END $$;

-- ------------------------------------------------------------------------------- T10. the cost view: the super admin only
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.smart_pack_usage_admin(30)$q$, 'super admin only', 'T10 a regular account cannot read the cost view');
SELECT tst.logout();
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  r := public.smart_pack_usage_admin(30);
  PERFORM tst.logout();
  PERFORM tst.ok((r ->> 'ok')::boolean AND (r ->> 'budgetIls')::numeric = 4 AND (r ->> 'usdIlsRate')::numeric = 3.5
                 AND jsonb_array_length(r -> 'days') >= 1 AND jsonb_array_length(r -> 'accounts') >= 3
                 AND EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'accounts') a WHERE a ->> 'email' = 'plain-user-c@synthetic.test' AND (a ->> 'percentUsed')::numeric >= 100),
    'T10b the super admin sees per day / feature and per account this month (email, ILS, % used)');
END $$;

-- ------------------------------------------------------------------------------- T11. the count quotas are lifted (the meter decides)
UPDATE public.subscription_activation SET phase = 'prepared' WHERE component = 'free_issue';
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((public.quote_file_read_status() ->> 'limit')::int = 1000000 AND (public.customer_twin_status() ->> 'monthlyLimit')::int = 1000000,
  'T11 a quote from a file and Customer Twin are no longer limited by count');
SELECT tst.logout();

-- ------------------------------------------------------------------------------- T12. the representative rate + 10% (Owner 2026-11-06)
CREATE OR REPLACE FUNCTION tst.fx(p_date date, p_rate numeric) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.msvc();
  r := public.smart_pack_store_fx_rate(p_date, p_rate);
  PERFORM tst.logout();
  RETURN r;
END $$;
DO $$
DECLARE r jsonb; t date := (now() AT TIME ZONE 'Asia/Jerusalem')::date;
BEGIN
  PERFORM tst.ok(tst.fx(t + 1, 3.1) ->> 'code' = 'invalid_request' AND tst.fx(t, 11) ->> 'code' = 'invalid_request',
    'T12 a future date or a rate outside 1..10 is refused');
  r := tst.fx(t - 20, 3.0);
  PERFORM tst.ok(public.smart_pack_usd_ils_rate() = 3.5, 'T12b a rate older than 14 days is not used - the fallback 3.5');
  r := tst.fx(t - 2, 3.1);
  PERFORM tst.ok((r ->> 'rate')::numeric = 3.41 AND public.smart_pack_usd_ils_rate() = 3.41 AND public.smart_pack_fx_stale(),
    'T12c the representative rate 3.1 + 10% = 3.41 ILS per USD; two days old = stale (fetch today''s)');
  r := tst.fx(t, 3.2);
  PERFORM tst.ok(public.smart_pack_usd_ils_rate() = 3.52 AND NOT public.smart_pack_fx_stale(), 'T12d today''s rate wins (3.2 + 10% = 3.52); not stale');
  UPDATE public.subscription_activation SET phase = 'prepared' WHERE component = 'free_issue';
  r := tst.mact('00000000-0000-4000-8000-00000000000a', 'file_quote', 1000, 100000);
  PERFORM tst.ok((r ->> 'ok')::boolean AND (SELECT usd_ils_rate = 3.52 AND cost_micros = 352000 FROM public.smart_pack_usage_claims WHERE claim_id = (r ->> 'claimId')::uuid),
    'T12e a finished action is counted at the rate of that moment (3.52): 0.10 USD = 0.352 ILS');
END $$;

ROLLBACK;
