-- ============================================================================================================================
-- 20261018000000_quote_expiry_country_alias.sql  -  one market rule for the quote acceptance expiry (Codex LANG-02)
-- tekango-migration-contract: mode=transaction replay=required
--
--   Owner console 2026-10-17, typed: "מאשר תיקון זיהוי השוק בממשק המשתמש לפי אותו כלל של האדמין"; Owner console 2026-10-18 on
--   docs/CODEX_ADMIN_LANG_VERIFY_2026-10-18.md ("ותקרא את הדוח של קודקס גם", "אחרי תיקון לנעול"). A business stored as 'Israel'
--   (or 'IL') is the Local market everywhere else; its quotes now also end their validity day in Asia/Jerusalem instead of
--   "Anywhere on Earth". Same rule as src/utils/regionConfig.js marketOfStoredCountry: 'Local' / 'LCL' / 'Israel' / 'IL' (any case,
--   trimmed) = Local; anything else = International. The stored dates and countries are not changed.
--   Re-issue of public.quote_acceptance_expired from 20260922000000: same signature, volatility, search_path and grants.
--   Re-runnable: CREATE OR REPLACE only.
-- ============================================================================================================================

CREATE OR REPLACE FUNCTION public.quote_acceptance_expired(p_valid_until date, p_country text, p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT p_valid_until IS NOT NULL
     AND p_valid_until < (p_now AT TIME ZONE CASE
           WHEN btrim(p_country) IN ('Local', 'LCL') OR lower(btrim(p_country)) IN ('israel', 'il') THEN 'Asia/Jerusalem'
           ELSE 'Etc/GMT+12' END)::date
$$;
COMMENT ON FUNCTION public.quote_acceptance_expired(date, text, timestamptz) IS
  'OD-1 + LANG-02: true when a quote can no longer be accepted - valid through the END of valid_until (Local / LCL / Israel / IL: Asia/Jerusalem; International: Anywhere-on-Earth UTC-12). NULL = no expiry. Mirrored exactly by src/utils/quoteValidity.js and supabase/functions/get-public-quote/validity.ts.';
GRANT EXECUTE ON FUNCTION public.quote_acceptance_expired(date, text, timestamptz) TO anon, authenticated, service_role;
