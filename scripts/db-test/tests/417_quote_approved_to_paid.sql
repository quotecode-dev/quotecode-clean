-- Owner 2026-10-25 (typed: "הצעה שאושרה או נחתמה אפשר לסמן כשולמה (רק המצב)"): 20261025100000_quote_approved_to_paid.
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: the owner may move an approved or a signed quote to paid
-- (the status only - the signature and signed_at stay); the same update with any other change is refused; paid never moves back or to
-- another status; approved never moves to another status; bookkeeping columns stay writable on a paid quote.
BEGIN;
SELECT tst.seed();

INSERT INTO public.quotes (id, user_id, quote_number, status, total, currency, valid_until)
VALUES ('a4170000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 941701, 'approved', 100, 'ILS', '2999-12-31'),
       ('a4170000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 941702, 'sent', 200, 'ILS', '2999-12-31'),
       ('a4170000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', 941703, 'approved', 300, 'ILS', '2999-12-31');

-- the customer signs quote 2 (status approved + signature + signed_at)
SELECT tst.anon();
SELECT public.public_approve_quote_signed('a4170000-0000-4000-8000-000000000002', 'data:image/png;base64,iVBORw0KGgo=', 'לקוח');
SELECT tst.logout();
CREATE TEMP TABLE p417_signed ON COMMIT DROP AS
  SELECT signature, signed_at, signer_name FROM public.quotes WHERE id = 'a4170000-0000-4000-8000-000000000002';
SELECT tst.ok((SELECT signed_at IS NOT NULL AND signature <> '' FROM p417_signed), 'P0 the signed quote carries its signature and signed_at');
GRANT SELECT ON p417_signed TO authenticated;

SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$UPDATE public.quotes SET status = 'paid', total = 999 WHERE id = 'a4170000-0000-4000-8000-000000000001'$q$,
  'can no longer be modified', 'P1 approved -> paid together with another change is refused');
SELECT tst.throws($q$UPDATE public.quotes SET status = 'sent' WHERE id = 'a4170000-0000-4000-8000-000000000001'$q$,
  'can no longer be modified', 'P2 approved -> sent is refused');
SELECT tst.throws($q$UPDATE public.quotes SET status = 'draft' WHERE id = 'a4170000-0000-4000-8000-000000000001'$q$,
  'can no longer be modified', 'P3 approved -> draft is refused');
SELECT tst.lives($q$UPDATE public.quotes SET status = 'paid' WHERE id = 'a4170000-0000-4000-8000-000000000001'$q$,
  'P4 an approved quote is marked paid');
SELECT tst.lives($q$UPDATE public.quotes SET status = 'paid' WHERE id = 'a4170000-0000-4000-8000-000000000002'$q$,
  'P5 a signed quote is marked paid');
SELECT tst.throws($q$UPDATE public.quotes SET status = 'approved' WHERE id = 'a4170000-0000-4000-8000-000000000001'$q$,
  'can no longer be modified', 'P6 paid never moves back to approved');
SELECT tst.throws($q$UPDATE public.quotes SET status = 'sent' WHERE id = 'a4170000-0000-4000-8000-000000000002'$q$,
  'can no longer be modified', 'P7 paid never moves to another status');
SELECT tst.throws($q$UPDATE public.quotes SET total = 1 WHERE id = 'a4170000-0000-4000-8000-000000000002'$q$,
  'can no longer be modified', 'P8 a paid quote stays content-locked');
SELECT tst.throws($q$UPDATE public.quotes SET status = 'paid', valid_until = '2000-01-01' WHERE id = 'a4170000-0000-4000-8000-000000000003'$q$,
  'can no longer be modified', 'P9 marking paid cannot change anything else (validity date)');
SELECT tst.throws($q$UPDATE public.quotes SET status = 'paid', signature = NULL WHERE id = 'a4170000-0000-4000-8000-000000000002'$q$,
  'can no longer be modified', 'P9b marking paid cannot clear the signature');
SELECT tst.lives($q$UPDATE public.quotes SET view_count = COALESCE(view_count, 0) + 1 WHERE id = 'a4170000-0000-4000-8000-000000000002'$q$,
  'P10 bookkeeping (view count) stays writable on a paid quote');
SELECT tst.ok((SELECT q.status = 'paid' AND q.signature = s.signature AND q.signed_at = s.signed_at AND q.signer_name = s.signer_name AND q.total = 200
                 FROM public.quotes q, p417_signed s WHERE q.id = 'a4170000-0000-4000-8000-000000000002'),
  'P11 the signed quote is paid; its signature, signed_at, signer and total are unchanged');
SELECT tst.ok((SELECT status = 'paid' AND total = 100 FROM public.quotes WHERE id = 'a4170000-0000-4000-8000-000000000001'),
  'P12 the approved quote is paid with its total unchanged');
SELECT tst.logout();

-- another business cannot mark someone else's quote (row security unchanged)
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
UPDATE public.quotes SET status = 'paid' WHERE id = 'a4170000-0000-4000-8000-000000000003';
SELECT tst.logout();
SELECT tst.ok((SELECT status = 'approved' FROM public.quotes WHERE id = 'a4170000-0000-4000-8000-000000000003'),
  'P13 another account cannot mark the quote paid');

ROLLBACK;
