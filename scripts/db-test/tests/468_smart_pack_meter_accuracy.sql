-- Owner console 2026-11-07 (typed: "מאשר את שחרור ד׳ ושחרור ה׳ לפי ההמלצות, סעיף 3 לספור ..." + the plan): release D, the meter accuracy
-- (20261108100000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: a micro-USD reserve is converted at TODAY's rate (not 3.5); the old two-argument call keeps working; a micro-USD reserve over
-- the bound is refused; a stale claimed action counts as used at once and is converted to 'done' at its reserve by the next claim;
-- the new signature is open to signed-in callers only.
BEGIN;
SELECT tst.seed();

SELECT tst.ok(has_function_privilege('authenticated', 'public.smart_pack_usage_claim(text, bigint, bigint)', 'execute')
          AND NOT has_function_privilege('anon', 'public.smart_pack_usage_claim(text, bigint, bigint)', 'execute')
          AND to_regprocedure('public.smart_pack_usage_claim(text, bigint)') IS NULL,
  'T1 one claim function (with the optional USD reserve): signed-in callers only; the old two-argument form is gone (its calls still work)');

DO $$
DECLARE r1 jsonb; r2 jsonb; r3 jsonb; r4 jsonb; r5 jsonb; s jsonb;
BEGIN
  -- today's representative rate 3.2 -> 3.52 ILS per USD (+10%)
  INSERT INTO public.smart_pack_fx_rates (rate_date, usd_ils) VALUES ((now() AT TIME ZONE 'Asia/Jerusalem')::date, 3.2)
  ON CONFLICT (rate_date) DO UPDATE SET usd_ils = EXCLUDED.usd_ils;
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  r1 := public.smart_pack_usage_claim('ai_draft', 3500, 1000);
  r2 := public.smart_pack_usage_claim('ai_draft', 12000);
  r3 := public.smart_pack_usage_claim('ai_draft', 12000, 2000000);
  r4 := public.smart_pack_usage_claim('ai_draft', 12000, 0);
  r5 := public.smart_pack_usage_claim('customer_twin', 400000);
  PERFORM tst.logout();
  PERFORM tst.ok((r1 ->> 'ok')::boolean AND (SELECT reserve_micros = 3520 FROM public.smart_pack_usage_claims WHERE claim_id = (r1 ->> 'claimId')::uuid),
    'T2 a reserve of 1,000 micro-USD is held at today''s rate: 3,520 micro-ILS (3.2 + 10%), not 3,500 (the fixed 3.5)');
  PERFORM tst.ok((r2 ->> 'ok')::boolean AND (SELECT reserve_micros = 12000 FROM public.smart_pack_usage_claims WHERE claim_id = (r2 ->> 'claimId')::uuid),
    'T3 the old call (no USD reserve) keeps working with its own micro-ILS reserve');
  PERFORM tst.ok(r3 ->> 'code' = 'invalid_request' AND r4 ->> 'code' = 'invalid_request', 'T4 a USD reserve over the bound (US$1) or of zero is refused');
  -- a stale action: counted as used at once (status), then converted to done at its reserve by the next claim
  UPDATE public.smart_pack_usage_claims SET created_at = now() - interval '11 minutes' WHERE claim_id = (r5 ->> 'claimId')::uuid;
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  s := public.smart_pack_usage_status();
  PERFORM tst.logout();
  PERFORM tst.ok((s ->> 'usedMicros')::bigint >= 400000, 'T5 a stale action counts as used at once (its reserve), before any later claim');
  PERFORM tst.login('00000000-0000-4000-8000-00000000000a');
  PERFORM public.smart_pack_usage_claim('ai_draft', 12000);
  PERFORM tst.logout();
  PERFORM tst.ok((SELECT state = 'done' AND cost_micros = 400000 AND model = 'reserve_not_finished' FROM public.smart_pack_usage_claims WHERE claim_id = (r5 ->> 'claimId')::uuid),
    'T6 the next claim closes it as done at its reserve (the Owner: "סעיף 3 לספור"), marked reserve_not_finished');
END $$;

ROLLBACK;
