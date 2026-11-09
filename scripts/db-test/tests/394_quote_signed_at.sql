-- Owner 2026-10-19: quotes.signed_at (20261019120000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the column exists; a customer signing (anonymous / another tenant) records signed_at in server time; a hand-set "approved"
-- without a signature records nothing; an insert (new / duplicate) never carries it; an owner write cannot set, move or clear it
-- and does not fail; the signed (immutable) quote keeps it; first_viewed_at behaviour is unchanged.
BEGIN;
SELECT tst.seed();

INSERT INTO public.quotes (id, user_id, quote_number, status, valid_until, currency, total) VALUES
  ('a3940000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 939401, 'sent',  DATE '2099-12-31', 'ILS', 100),
  ('a3940000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 939402, 'sent',  DATE '2099-12-31', 'ILS', 100),
  ('a3940000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', 939403, 'draft', DATE '2099-12-31', 'ILS', 100),
  ('a3940000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000a', 939404, 'sent',  DATE '2099-12-31', 'ILS', 100);
-- an insert that tries to carry a signing time keeps none
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total, signed_at) VALUES
  ('a3940000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-00000000000a', 939405, 'draft', 'ILS', 100, now() - interval '1 day');

DO $$
BEGIN
  PERFORM tst.ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'signed_at'), 'quotes.signed_at exists');
  PERFORM tst.ok((SELECT signed_at IS NULL FROM public.quotes WHERE id = 'a3940000-0000-4000-8000-000000000005'), 'INSERT: a new / duplicated quote never carries a signing time');
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'quotes_signed_at_guard' AND tgrelid = 'public.quotes'::regclass), 'the writer guard trigger exists');
  PERFORM tst.ok(NOT has_function_privilege('anon', 'public.quotes_signed_at_guard()', 'execute') AND NOT has_function_privilege('authenticated', 'public.quotes_signed_at_guard()', 'execute'), 'the guard is not callable by the app');
END $$;

-- the owner cannot set it by hand, and marking approved WITHOUT a signature records nothing (no failure either)
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.lives($q$UPDATE public.quotes SET signed_at = now() WHERE id = 'a3940000-0000-4000-8000-000000000002'$q$, 'OWNER: a crafted signed_at write does not fail ...');
SELECT tst.lives($q$UPDATE public.quotes SET status = 'approved' WHERE id = 'a3940000-0000-4000-8000-000000000004'$q$, 'OWNER: marking a quote approved by hand works as before ...');
SELECT tst.logout();
SELECT tst.ok((SELECT signed_at IS NULL FROM public.quotes WHERE id = 'a3940000-0000-4000-8000-000000000002')
  AND (SELECT signed_at IS NULL FROM public.quotes WHERE id = 'a3940000-0000-4000-8000-000000000004'), 'OWNER: ... and neither the crafted write nor the hand approval recorded a signing time');

-- the customer signs: anonymous, and a TEKANGO user of another tenant
SELECT tst.anon();
SELECT tst.lives($q$SELECT public.public_approve_quote('a3940000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=')$q$, 'SIGN-ANON: the customer signs');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.lives($q$SELECT public.public_approve_quote('a3940000-0000-4000-8000-000000000003', 'data:image/png;base64,iVBORw0KGgo=')$q$, 'SIGN-OTHER-TENANT: signs');
SELECT tst.logout();
SELECT tst.ok((SELECT signed_at IS NOT NULL AND signed_at > now() - interval '1 minute' AND status::text = 'approved' FROM public.quotes WHERE id = 'a3940000-0000-4000-8000-000000000001'),
  'SIGN-ANON: signed_at recorded in server time with the approval');
SELECT tst.ok((SELECT signed_at IS NOT NULL FROM public.quotes WHERE id = 'a3940000-0000-4000-8000-000000000003'), 'SIGN-OTHER-TENANT: signed_at recorded');

-- once signed, it stays: no owner write moves or clears it, and the immutable quote is not unlocked
CREATE TEMP TABLE tst_signed_before AS SELECT signed_at FROM public.quotes WHERE id = 'a3940000-0000-4000-8000-000000000001';
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$UPDATE public.quotes SET signed_at = NULL WHERE id = 'a3940000-0000-4000-8000-000000000001'$q$, '.', 'SIGNED: clearing the signing time of a signed quote is refused (immutable quote)');
SELECT tst.logout();
SELECT tst.ok((SELECT q.signed_at = b.signed_at FROM public.quotes q, tst_signed_before b WHERE q.id = 'a3940000-0000-4000-8000-000000000001'), 'SIGNED: the stored signing time is unchanged');

RESET ROLE;

ROLLBACK;
