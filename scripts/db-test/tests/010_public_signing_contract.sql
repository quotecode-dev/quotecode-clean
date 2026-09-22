-- OD-9 public signing contract + OD-1 acceptance expiry (public_approve_quote after 20260922000000).
SELECT tst.seed();
-- synthetic quotes owned by issuer tenant A (Local). Fixed ids; valid_until far future unless the case says otherwise.
INSERT INTO public.quotes (id, user_id, quote_number, status, valid_until, currency, total) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 900001, 'sent',  DATE '2099-12-31', 'ILS', 100),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 900002, 'sent',  DATE '2020-01-13', 'ILS', 100),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', 900003, 'draft', DATE '2099-12-31', 'ILS', 100),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000a', 900004, 'sent',  NULL,              'ILS', 100),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-00000000000b', 900005, 'sent',  DATE '2020-01-13', 'USD', 100);

-- quote owner (issuer-tenant member) cannot sign
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$ BEGIN
  PERFORM tst.ok(public.is_issuer_tenant_member('00000000-0000-4000-8000-00000000000a'), 'owner is an issuer-tenant member');
  PERFORM tst.throws($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=') $q$,
    'member of the business that issued this quote cannot approve', 'SIGN-OWNER: quote owner attempts to sign -> blocked');
END $$;
SELECT tst.logout();

-- authenticated TEKANGO user of ANOTHER tenant may sign (as the customer)
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$ BEGIN
  PERFORM tst.ok(NOT public.is_issuer_tenant_member('00000000-0000-4000-8000-00000000000a'), 'other-tenant user is not an issuer-tenant member');
  PERFORM tst.lives($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-000000000003', 'data:image/png;base64,iVBORw0KGgo=') $q$,
    'SIGN-OTHER-TENANT: authenticated user of another tenant signs a valid quote -> allowed');
  PERFORM tst.throws($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-000000000002', 'data:image/png;base64,iVBORw0KGgo=') $q$,
    'expired', 'SIGN-EXPIRED (other tenant): expired quote -> blocked');
END $$;
SELECT tst.logout();

-- unauthenticated public customer
SELECT tst.anon();
DO $$ BEGIN
  PERFORM tst.lives($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=') $q$,
    'SIGN-ANON: unauthenticated legitimate customer signs a valid quote -> allowed');
  PERFORM tst.lives($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-000000000004', 'data:image/png;base64,iVBORw0KGgo=') $q$,
    'SIGN-NO-EXPIRY: a quote without a validity date can be signed');
  PERFORM tst.throws($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-000000000002', 'data:image/png;base64,iVBORw0KGgo=') $q$,
    'expired', 'SIGN-EXPIRED (anonymous, Local): expired quote -> blocked');
  PERFORM tst.throws($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-000000000005', 'data:image/png;base64,iVBORw0KGgo=') $q$,
    'expired', 'SIGN-EXPIRED (anonymous, International): expired quote -> blocked');
  PERFORM tst.throws($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-0000000000ff', 'data:image/png;base64,iVBORw0KGgo=') $q$,
    'not found or cannot be approved', 'SIGN-WRONG-QUOTE: unknown quote id / wrong scope -> blocked');
  PERFORM tst.throws($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=') $q$,
    'not found or cannot be approved', 'SIGN-TWICE: an already signed quote cannot be signed again');
  PERFORM tst.throws($q$ SELECT public.public_approve_quote('10000000-0000-4000-8000-000000000003', 'data:image/jpeg;base64,AAAA') $q$,
    'Invalid signature format|cannot be approved', 'SIGN-FORMAT: non-PNG signature rejected');
END $$;
SELECT tst.logout();

DO $$ BEGIN
  PERFORM tst.ok((SELECT status = 'approved' AND signature IS NOT NULL FROM public.quotes WHERE id = '10000000-0000-4000-8000-000000000001'), 'anonymous signature recorded (approved + signature)');
  PERFORM tst.ok((SELECT status = 'approved' FROM public.quotes WHERE id = '10000000-0000-4000-8000-000000000003'), 'other-tenant signature recorded');
  PERFORM tst.ok((SELECT status = 'sent' AND signature IS NULL FROM public.quotes WHERE id = '10000000-0000-4000-8000-000000000002'), 'expired quote unchanged');
  PERFORM tst.ok((SELECT valid_until = DATE '2020-01-13' FROM public.quotes WHERE id = '10000000-0000-4000-8000-000000000002'), 'OD-1: the stored historical validity date was not changed');

  -- OD-1 exact boundary (valid THROUGH the end of valid_until; unambiguous day 13)
  PERFORM tst.ok(NOT public.quote_acceptance_expired(DATE '2026-09-13', 'Local', TIMESTAMPTZ '2026-09-13 23:59:59+03'), 'Local: last second of 13/09/2026 (Asia/Jerusalem) still acceptable');
  PERFORM tst.ok(public.quote_acceptance_expired(DATE '2026-09-13', 'Local', TIMESTAMPTZ '2026-09-14 00:00:00+03'), 'Local: 14/09/2026 00:00 Asia/Jerusalem is expired');
  PERFORM tst.ok(NOT public.quote_acceptance_expired(DATE '2026-09-13', 'International', TIMESTAMPTZ '2026-09-14 11:59:59+00'), 'International: 09/13/2026 still valid anywhere on Earth (UTC-12)');
  PERFORM tst.ok(public.quote_acceptance_expired(DATE '2026-09-13', 'International', TIMESTAMPTZ '2026-09-14 12:00:00+00'), 'International: expired once 09/13 ended everywhere');
  PERFORM tst.ok(NOT public.quote_acceptance_expired(NULL, 'Local', now()), 'no validity date = never expires');
  PERFORM tst.ok(NOT public.quote_acceptance_expired(DATE '2026-09-12', 'Local', TIMESTAMPTZ '2026-09-12 20:30:00+00'), 'Local: 23:30 Asia/Jerusalem on the validity day is acceptable');
  PERFORM tst.ok(public.quote_acceptance_expired(DATE '2026-09-12', 'Local', TIMESTAMPTZ '2026-09-12 21:30:00+00'), 'Local: 00:30 Asia/Jerusalem next day is expired although UTC is still the validity day (market time zone decides, not the server)');

  -- privileges
  PERFORM tst.ok(has_function_privilege('anon', 'public.public_approve_quote(uuid,text)', 'execute'), 'anon may execute public_approve_quote');
  PERFORM tst.ok(has_function_privilege('authenticated', 'public.public_approve_quote(uuid,text)', 'execute'), 'authenticated may execute public_approve_quote');
  PERFORM tst.ok(NOT has_function_privilege('service_role', 'public.public_approve_quote(uuid,text)', 'execute'), 'service_role has no execute on public_approve_quote');
END $$;
