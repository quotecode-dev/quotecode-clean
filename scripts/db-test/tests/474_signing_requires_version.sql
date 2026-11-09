-- Codex review 2026-11-09, finding D1 (Owner typed: "מאשר תיקון ממצאי קודקס 1-5 כולל L-05, L-13, L-17, L-24, L-25, L-26, L-27, L-28
-- ושחרור ללייב"): 20261109300000. Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: the four version-less public
-- signing functions are closed to PUBLIC / anon / authenticated (a direct call by a customer or a signed-in user is refused and changes
-- nothing); the two versioned functions stay open; a customer still signs - only the version the page shows.
BEGIN;
SELECT tst.seed();

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.public_approve_quote(uuid,text)', 'public.public_approve_quote_signed(uuid,text,text,text,text)',
    'public.public_approve_quote_capability(text,text)', 'public.public_approve_quote_capability_signed(text,text,text,text,text)'] LOOP
    PERFORM tst.ok(NOT has_function_privilege('anon', f, 'execute') AND NOT has_function_privilege('authenticated', f, 'execute')
                   AND NOT has_function_privilege('service_role', f, 'execute')
                   AND NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = f::regprocedure AND a.grantee = 0),
      'V1 ' || f || ' is closed to PUBLIC, anon, authenticated and the server role');
  END LOOP;
  PERFORM tst.ok(has_function_privilege('anon', 'public.public_sign_quote_version(uuid,text,text,text,text,text)', 'execute')
                 AND has_function_privilege('authenticated', 'public.public_sign_quote_version(uuid,text,text,text,text,text)', 'execute')
                 AND has_function_privilege('anon', 'public.public_sign_quote_capability_version(text,text,text,text,text,text)', 'execute')
                 AND has_function_privilege('authenticated', 'public.public_sign_quote_capability_version(text,text,text,text,text,text)', 'execute'),
    'V2 the two versioned signing functions stay open to a customer');
END $$;

INSERT INTO public.quotes (id, user_id, quote_number, status, total, currency, valid_until, notes)
VALUES ('a4740000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 947401, 'sent', 100, 'ILS', '2999-12-31', 'v1');
SELECT set_config('tst.v1', public.quote_public_version('00000000-0000-4000-8000-00000000000a', 'a4740000-0000-4000-8000-000000000001'), false);

-- a customer (anon) and a signed-in user of another business cannot use the old entrances
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.public_approve_quote('a4740000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=')$q$,
  'permission denied', 'V3 anon: the version-less id signing is refused');
SELECT tst.throws($q$SELECT public.public_approve_quote_signed('a4740000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'לקוח')$q$,
  'permission denied', 'V4 anon: the version-less signed id signing is refused');
SELECT tst.throws($q$SELECT public.public_approve_quote_capability(repeat('A', 43), 'data:image/png;base64,iVBORw0KGgo=')$q$,
  'permission denied', 'V5 anon: the version-less capability signing is refused');
SELECT tst.throws($q$SELECT public.public_approve_quote_capability_signed(repeat('A', 43), 'data:image/png;base64,iVBORw0KGgo=', 'לקוח')$q$,
  'permission denied', 'V6 anon: the version-less signed capability signing is refused');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.throws($q$SELECT public.public_approve_quote_signed('a4740000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'לקוח')$q$,
  'permission denied', 'V7 a signed-in user: the version-less signing is refused too');
SELECT tst.logout();
SELECT tst.ok((SELECT status = 'sent' AND signature IS NULL FROM public.quotes WHERE id = 'a4740000-0000-4000-8000-000000000001'),
  'V8 the refused calls changed nothing');

-- the business saves a change; the customer page that still holds the old version signs nothing, the current version signs
UPDATE public.quotes SET notes = 'v2' WHERE id = 'a4740000-0000-4000-8000-000000000001';
SELECT set_config('tst.v2', public.quote_public_version('00000000-0000-4000-8000-00000000000a', 'a4740000-0000-4000-8000-000000000001'), false);
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.public_sign_quote_version('a4740000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'לקוח', NULL, NULL, current_setting('tst.v1'))$q$,
  'Quote updated', 'V9 the old version signs nothing');
SELECT tst.lives($q$SELECT public.public_sign_quote_version('a4740000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'לקוח', NULL, NULL, current_setting('tst.v2'))$q$,
  'V10 the version the page shows signs');
SELECT tst.logout();
SELECT tst.ok((SELECT status = 'approved' AND signature IS NOT NULL AND signer_name = 'לקוח' FROM public.quotes WHERE id = 'a4740000-0000-4000-8000-000000000001')
              AND (SELECT version = current_setting('tst.v2') FROM public.quote_signed_documents WHERE quote_id = 'a4740000-0000-4000-8000-000000000001'),
  'V11 signed once, with the signer, and the frozen document is exactly the signed version');

ROLLBACK;
