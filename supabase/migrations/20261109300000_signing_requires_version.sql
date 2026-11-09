-- tekango-migration-contract: mode=transaction replay=required
-- 20261109300000 - every customer signature names the version the customer saw (Codex review 2026-11-09, finding D1).
-- Owner typed (console 2026-11-09): "מאשר תיקון ממצאי קודקס 1-5 כולל L-05, L-13, L-17, L-24, L-25, L-26, L-27, L-28 ושחרור ללייב".
--
-- 20261108400000 added the versioned signing functions (public_sign_quote_version / public_sign_quote_capability_version): they lock the
-- quote, compare the version the page shows and freeze exactly that document. The four version-less public signing functions stayed
-- executable by anon / authenticated, so a direct call could still sign whatever the quote holds now, without the customer having seen it.
-- The public pages now call only the versioned functions (src/pages/PublicQuote.jsx, PublicQuoteEn.jsx); every page that can still be
-- signed receives a version from get-public-quote (public_quote_live_state / public_capability_live), a signed quote is never signed again.
--
-- This migration only closes the four old entrances to the public roles. Their bodies are unchanged (the internal core
-- quote_public_approve_internal and the versioned functions keep using the same core), so a rollback is the four GRANTs below.
--   rollback: GRANT EXECUTE ON FUNCTION <each of the four> TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.public_approve_quote(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_approve_quote_signed(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_approve_quote_capability(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_approve_quote_capability_signed(text, text, text, text, text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.public_approve_quote(uuid, text) IS
  '2026-11-09 (Codex D1, Owner typed): closed to the public roles - a customer signs only through public_sign_quote_version (the version it saw).';
COMMENT ON FUNCTION public.public_approve_quote_signed(uuid, text, text, text, text) IS
  '2026-11-09 (Codex D1, Owner typed): closed to the public roles - a customer signs only through public_sign_quote_version (the version it saw).';
COMMENT ON FUNCTION public.public_approve_quote_capability(text, text) IS
  '2026-11-09 (Codex D1, Owner typed): closed to the public roles - a customer signs only through public_sign_quote_capability_version.';
COMMENT ON FUNCTION public.public_approve_quote_capability_signed(text, text, text, text, text) IS
  '2026-11-09 (Codex D1, Owner typed): closed to the public roles - a customer signs only through public_sign_quote_capability_version.';
