-- Owner 2026-11-06 (release C, typed: "מאשר את שחרור ג׳, כולל שינוי ב-L-06, L-09, L-14, L-17 ו-L-22"): one account's SMART PACK usage for
-- the admin's user card (20261106200000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: super admin only; the same used / % as the meter itself (done actions only - a refunded one is not counted); the actions and
-- the per-day series of this Israel month; an account with no usage is 0; the admin account is unlimited.
BEGIN;
SELECT tst.seed();
-- the super admin of this test (as in 466): tenant B
UPDATE public.business_settings SET role = 'super_admin', is_lifetime = true WHERE user_id = '00000000-0000-4000-8000-00000000000b';

CREATE OR REPLACE FUNCTION tst.msvc2() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.mact2(p_uid uuid, p_usd_micros bigint, p_ok boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM tst.login(p_uid);
  r := public.smart_pack_usage_claim('ai_draft', 12000);
  PERFORM tst.logout();
  PERFORM tst.msvc2();
  PERFORM public.smart_pack_usage_finish((r ->> 'claimId')::uuid, p_ok, p_usd_micros, 'gpt-test', 1000, 0, 200, NULL);
  PERFORM tst.logout();
END $$;

SELECT tst.ok(has_function_privilege('authenticated', 'public.smart_pack_usage_account(uuid)', 'execute')
          AND NOT has_function_privilege('anon', 'public.smart_pack_usage_account(uuid)', 'execute'),
  'T1 signed-in callers may call it (the function itself checks the super admin); anon may not');
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.smart_pack_usage_account('00000000-0000-4000-8000-00000000000a')$q$, 'super admin only',
  'T2 a regular account cannot read any account''s usage, not even its own through this function');
SELECT tst.logout();

DO $$
DECLARE r jsonb; e jsonb; a jsonb;
BEGIN
  -- two real actions of $0.10 each (0.35 ILS at 3.5) and one failed (given back, 0 counted)
  PERFORM tst.mact2('00000000-0000-4000-8000-00000000000a', 100000, true);
  PERFORM tst.mact2('00000000-0000-4000-8000-00000000000a', 100000, true);
  PERFORM tst.mact2('00000000-0000-4000-8000-00000000000a', 100000, false);
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  r := public.smart_pack_usage_account('00000000-0000-4000-8000-00000000000a');
  e := public.smart_pack_usage_account('00000000-0000-4000-8000-00000000000c');
  a := public.smart_pack_usage_account('00000000-0000-4000-8000-00000000000b');
  PERFORM tst.logout();
  PERFORM tst.ok((r ->> 'ok')::boolean AND (r ->> 'budgetIls')::numeric = 4 AND (r ->> 'usedIls')::numeric = 0.7
                 AND (r ->> 'percentUsed')::numeric = 17.5 AND (r ->> 'percentLeft')::int = 82 AND (r ->> 'actions')::int = 2
                 AND (r ->> 'unlimited')::boolean = false AND r ->> 'month' ~ '^[0-9]{4}-[0-9]{2}$',
    'T3 the super admin reads the account: 0.70 of 4 ILS = 17.5% used, 82% left (the meter''s own number), 2 actions (the failed one not counted)');
  PERFORM tst.ok(jsonb_array_length(r -> 'days') = 1 AND (r -> 'days' -> 0 ->> 'actions')::int = 2 AND (r -> 'days' -> 0 ->> 'costIls')::numeric = 0.7
                 AND r -> 'days' -> 0 ->> 'day' = to_char((now() AT TIME ZONE 'Asia/Jerusalem')::date, 'YYYY-MM-DD'),
    'T3b the per-day series of this Israel month (today: 2 actions, 0.70 ILS)');
  PERFORM tst.ok((e ->> 'usedIls')::numeric = 0 AND (e ->> 'actions')::int = 0 AND e -> 'days' = '[]'::jsonb AND (e ->> 'percentLeft')::int = 100,
    'T4 an account with no usage this month: 0, 100% left, no days');
  PERFORM tst.ok((a ->> 'unlimited')::boolean, 'T5 the admin account is unlimited');
  PERFORM tst.login('00000000-0000-4000-8000-00000000000b');
  PERFORM tst.ok(public.smart_pack_usage_account(NULL) ->> 'code' = 'invalid_request', 'T6 no account = invalid_request, nothing read');
  PERFORM tst.logout();
END $$;

ROLLBACK;
