-- Owner console 2026-11-08 (typed: "כל עוד הלקוח לא חתם ... כל שינוי ... משתקף אצל הלקוח" + the release approval incl. L-17, L-24):
-- 20261108400000. Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: the version of what the customer sees
-- changes with every saved change and never with a view; the customer signs only the version the page shows (a stale version signs
-- nothing); a signature freezes the signed document; the live state of a signed quote serves the frozen document; the new functions are
-- callable by a customer, the state readers only by the server.
BEGIN;
SELECT tst.seed();

DO $$ BEGIN
  PERFORM tst.ok(has_function_privilege('anon', 'public.public_sign_quote_version(uuid,text,text,text,text,text)', 'execute')
                 AND has_function_privilege('anon', 'public.public_sign_quote_capability_version(text,text,text,text,text,text)', 'execute')
                 AND NOT has_function_privilege('service_role', 'public.public_sign_quote_version(uuid,text,text,text,text,text)', 'execute'),
    'L1 the two new signing functions are callable by a customer (not by the server role)');
  PERFORM tst.ok(has_function_privilege('service_role', 'public.public_quote_live_state(uuid)', 'execute')
                 AND has_function_privilege('service_role', 'public.public_capability_live(text)', 'execute')
                 AND NOT has_function_privilege('anon', 'public.public_quote_live_state(uuid)', 'execute')
                 AND NOT has_function_privilege('authenticated', 'public.public_capability_live(text)', 'execute')
                 AND NOT has_function_privilege('anon', 'public.quote_public_version(uuid,uuid)', 'execute')
                 AND NOT has_function_privilege('service_role', 'public.quote_public_version(uuid,uuid)', 'execute')
                 AND NOT has_function_privilege('anon', 'public.quote_public_sign_versioned(uuid,text,text,text,text,text)', 'execute'),
    'L2 the live state is read only by the server; the version and the core are not callable directly');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.quote_signed_documents', 'select')
                 AND NOT has_table_privilege('authenticated', 'public.quote_signed_documents', 'select')
                 AND NOT has_table_privilege('service_role', 'public.quote_signed_documents', 'insert'),
    'L3 nobody reads or writes the signed documents directly');
END $$;

INSERT INTO public.quotes (id, user_id, quote_number, status, total, currency, valid_until, notes)
VALUES ('a4710000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 947101, 'sent', 100, 'ILS', '2999-12-31', 'first');

SELECT set_config('tst.v1', public.quote_public_version('00000000-0000-4000-8000-00000000000a', 'a4710000-0000-4000-8000-000000000001'), false);
SELECT tst.ok(current_setting('tst.v1') ~ '^[0-9a-f]{64}$', 'L4 the version is a 64-hex digest');
SELECT tst.ok((public.public_quote_live_state('a4710000-0000-4000-8000-000000000001') ->> 'version') = current_setting('tst.v1')
              AND (public.public_quote_live_state('a4710000-0000-4000-8000-000000000001') ->> 'signed')::boolean IS FALSE
              AND public.public_quote_live_state('a4710000-0000-4000-8000-000000000001') -> 'signedDocument' = 'null'::jsonb,
  'L5 the live state of an unsigned quote: its current version, not signed, no frozen document');

-- a view (counter / first view) and a status label never change the version
UPDATE public.quotes SET view_count = coalesce(view_count, 0) + 1, status = 'sent' WHERE id = 'a4710000-0000-4000-8000-000000000001';
SELECT tst.ok(public.quote_public_version('00000000-0000-4000-8000-00000000000a', 'a4710000-0000-4000-8000-000000000001') = current_setting('tst.v1'),
  'L6 a view never changes the version');

-- a saved change does
UPDATE public.quotes SET notes = 'changed by the business' WHERE id = 'a4710000-0000-4000-8000-000000000001';
SELECT set_config('tst.v2', public.quote_public_version('00000000-0000-4000-8000-00000000000a', 'a4710000-0000-4000-8000-000000000001'), false);
SELECT tst.ok(current_setting('tst.v2') <> current_setting('tst.v1'), 'L7 a saved change changes the version');

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.public_sign_quote_version('a4710000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'לקוח', NULL, NULL, current_setting('tst.v1'))$q$,
  'Quote updated', 'L8 a page opened before the change signs nothing');
SELECT tst.throws($q$SELECT public.public_sign_quote_version('a4710000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'לקוח', NULL, NULL, NULL)$q$,
  'Quote updated', 'L9 no version signs nothing');
SELECT tst.logout();
SELECT tst.ok((SELECT status = 'sent' AND signer_name IS NULL AND coalesce(signature, '') = '' FROM public.quotes WHERE id = 'a4710000-0000-4000-8000-000000000001')
              AND NOT EXISTS (SELECT 1 FROM public.quote_signed_documents WHERE quote_id = 'a4710000-0000-4000-8000-000000000001'),
  'L10 nothing stored on a refused signature');

SELECT tst.anon();
SELECT public.public_sign_quote_version('a4710000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'לקוח אמיתי', NULL, NULL, current_setting('tst.v2'));
SELECT tst.logout();
SELECT tst.ok((SELECT status = 'approved' AND signer_name = 'לקוח אמיתי' FROM public.quotes WHERE id = 'a4710000-0000-4000-8000-000000000001'),
  'L11 the current version signs, with the signer');
SELECT tst.ok((SELECT version = current_setting('tst.v2') AND document -> 'quote' ->> 'notes' = 'changed by the business'
                 FROM public.quote_signed_documents WHERE quote_id = 'a4710000-0000-4000-8000-000000000001'),
  'L12 the signed document is frozen exactly as signed');
SELECT tst.ok((public.public_quote_live_state('a4710000-0000-4000-8000-000000000001') ->> 'signed')::boolean
              AND public.public_quote_live_state('a4710000-0000-4000-8000-000000000001') -> 'signedDocument' -> 'document' -> 'quote' ->> 'notes' = 'changed by the business'
              AND (public.public_quote_live_state('a4710000-0000-4000-8000-000000000001') ->> 'version') = current_setting('tst.v2'),
  'L13 the live state of a signed quote serves the frozen document');

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.public_sign_quote_version('a4710000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'מישהו אחר', NULL, NULL, current_setting('tst.v2'))$q$,
  'cannot be approved', 'L14 a signed quote is never signed again');
SELECT tst.logout();
SELECT tst.throws($q$UPDATE public.quote_signed_documents SET version = repeat('0', 64) WHERE quote_id = 'a4710000-0000-4000-8000-000000000001'$q$,
  'never changes', 'L15 a signed document never changes');

-- the existing signing functions keep working for a page loaded before the release, and freeze the document too
INSERT INTO public.quotes (id, user_id, quote_number, status, total, currency, valid_until)
VALUES ('a4710000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 947102, 'sent', 100, 'ILS', '2999-12-31');
SELECT tst.anon();
SELECT public.public_approve_quote_signed('a4710000-0000-4000-8000-000000000002', 'data:image/png;base64,iVBORw0KGgo=', 'לקוח');
SELECT tst.logout();
SELECT tst.ok(EXISTS (SELECT 1 FROM public.quote_signed_documents WHERE quote_id = 'a4710000-0000-4000-8000-000000000002'),
  'L16 a signature through the existing function freezes the document as well');

-- the issuing business still cannot sign its own quote through the new function
INSERT INTO public.quotes (id, user_id, quote_number, status, total, currency, valid_until)
VALUES ('a4710000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', 947103, 'sent', 100, 'ILS', '2999-12-31');
SELECT set_config('tst.v3', public.quote_public_version('00000000-0000-4000-8000-00000000000a', 'a4710000-0000-4000-8000-000000000003'), false);
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.public_sign_quote_version('a4710000-0000-4000-8000-000000000003', 'data:image/png;base64,iVBORw0KGgo=', 'הבעלים', NULL, NULL, current_setting('tst.v3'))$q$,
  'Not permitted', 'L17 the issuing business cannot sign its own quote');
SELECT tst.logout();

SELECT tst.ok(public.public_quote_live_state('a4710000-0000-4000-8000-0000000000ff') = '{"ok": false}'::jsonb
              AND public.public_capability_live(repeat('0', 64)) = '{"ok": false}'::jsonb
              AND public.public_capability_live('not-a-hash') = '{"ok": false}'::jsonb,
  'L18 an unknown quote / token is one uniform answer');

ROLLBACK;
