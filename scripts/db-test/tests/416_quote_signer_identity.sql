-- Owner 2026-10-25 (typed L-24): the signer's name / company / role are stored with the signature (20261025000000).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: signing through the new function stores the cleaned signer;
-- a missing name signs nothing; the approval rules are the unchanged internal ones (signed once, issuer member refused); the former
-- functions are untouched; the anonymous caller may execute only the public functions.
BEGIN;
SELECT tst.seed();

DO $$ BEGIN
  PERFORM tst.ok(has_function_privilege('anon', 'public.public_approve_quote_signed(uuid,text,text,text,text)', 'execute')
                 AND has_function_privilege('anon', 'public.public_approve_quote_capability_signed(text,text,text,text,text)', 'execute')
                 AND NOT has_function_privilege('anon', 'public.quote_record_signer(uuid,text,text,text)', 'execute')
                 AND NOT has_function_privilege('anon', 'public.quote_signer_text(text,int)', 'execute')
                 AND has_function_privilege('anon', 'public.public_approve_quote(uuid,text)', 'execute'),
    'S1 the public signing functions are callable by a customer; the helpers are not; the former function stays');
END $$;

-- a sent quote of the seed business
INSERT INTO public.quotes (id, user_id, quote_number, status, total, currency, valid_until)
VALUES ('a4160000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 941601, 'sent', 100, 'ILS', '2999-12-31'),
       ('a4160000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 941602, 'sent', 100, 'ILS', '2999-12-31');

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.public_approve_quote_signed('a4160000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', '   ')$q$,
  'Missing signer name', 'S2 a blank name signs nothing');
SELECT public.public_approve_quote_signed('a4160000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=',
  E'  שלומי\t ספרות \n', 'ספרות בע"מ', 'מנכ"ל');
SELECT tst.logout();
SELECT tst.ok((SELECT status = 'approved' AND signer_name = 'שלומי ספרות' AND signer_company = 'ספרות בע"מ' AND signer_role = 'מנכ"ל'
                 FROM public.quotes WHERE id = 'a4160000-0000-4000-8000-000000000001'),
  'S3 the quote is signed and the cleaned signer is stored with it');
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.public_approve_quote_signed('a4160000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'מישהו אחר')$q$,
  'cannot be approved', 'S4 a signed quote cannot be signed again (the signer is never overwritten)');
SELECT tst.logout();
SELECT tst.ok((SELECT signer_name = 'שלומי ספרות' FROM public.quotes WHERE id = 'a4160000-0000-4000-8000-000000000001'), 'S5 the first signer stays');

SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.public_approve_quote_signed('a4160000-0000-4000-8000-000000000002', 'data:image/png;base64,iVBORw0KGgo=', 'הבעלים')$q$,
  'Not permitted', 'S6 the issuing business cannot sign its own quote through the new function either');
SELECT tst.logout();
SELECT tst.ok((SELECT signer_name IS NULL AND status = 'sent' FROM public.quotes WHERE id = 'a4160000-0000-4000-8000-000000000002'), 'S7 nothing stored on a refused signature');

SELECT tst.anon();
SELECT public.public_approve_quote_signed('a4160000-0000-4000-8000-000000000002', 'data:image/png;base64,iVBORw0KGgo=', repeat('א', 200));
SELECT tst.logout();
SELECT tst.ok((SELECT char_length(signer_name) = 120 AND signer_company IS NULL AND signer_role IS NULL FROM public.quotes WHERE id = 'a4160000-0000-4000-8000-000000000002'),
  'S8 a long name is cut to 120; no company / role = NULL');

ROLLBACK;
