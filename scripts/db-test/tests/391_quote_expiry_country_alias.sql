-- Codex LANG-02 (2026-10-18) - 20261018000000_quote_expiry_country_alias.sql on the disposable DB. Proves: a business stored as
-- 'Israel' / 'IL' (any case, trimmed) ends a quote's validity day in Asia/Jerusalem exactly like 'Local' / 'LCL'; every other value
-- keeps "Anywhere on Earth" (UTC-12); NULL validity never expires. Read-only: nothing is written.
DO $$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['Local', 'LCL', 'Israel', 'IL', 'israel', ' ISRAEL ', 'il'] LOOP
    PERFORM tst.ok(NOT public.quote_acceptance_expired(DATE '2026-10-17', c, TIMESTAMPTZ '2026-10-17 23:59:59+03'), c || ': last second of 17/10/2026 in Asia/Jerusalem is still acceptable');
    PERFORM tst.ok(public.quote_acceptance_expired(DATE '2026-10-17', c, TIMESTAMPTZ '2026-10-18 00:00:00+03'), c || ': 18/10/2026 00:00 Asia/Jerusalem is expired (the Codex boundary)');
  END LOOP;
  FOREACH c IN ARRAY ARRAY['International', 'Germany', 'US', 'ZZ', ''] LOOP
    PERFORM tst.ok(NOT public.quote_acceptance_expired(DATE '2026-10-17', c, TIMESTAMPTZ '2026-10-18 00:00:00+03'), c || ': still valid somewhere on Earth after Israel midnight');
    PERFORM tst.ok(NOT public.quote_acceptance_expired(DATE '2026-10-17', c, TIMESTAMPTZ '2026-10-18 11:59:59+00'), c || ': last second of 17/10 at UTC-12 is acceptable');
    PERFORM tst.ok(public.quote_acceptance_expired(DATE '2026-10-17', c, TIMESTAMPTZ '2026-10-18 12:00:00+00'), c || ': expired once 17/10 ended everywhere');
  END LOOP;
  PERFORM tst.ok(NOT public.quote_acceptance_expired(DATE '2026-10-17', NULL, TIMESTAMPTZ '2026-10-18 00:00:00+03'), 'no country = International (UTC-12)');
  PERFORM tst.ok(NOT public.quote_acceptance_expired(NULL, 'Israel', TIMESTAMPTZ '2030-01-01 00:00:00+00'), 'no validity date = never expires');
  PERFORM tst.ok(has_function_privilege('anon', 'public.quote_acceptance_expired(date,text,timestamptz)', 'execute'), 'anon may still execute quote_acceptance_expired');
END $$;
