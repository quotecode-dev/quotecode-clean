-- Owner 2026-10-25 (Israel-only purchasing; monthly + annual): 20261025200000_israel_payments_activation.
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: every account gets its market from the account type
-- (Local / LCL = IL, anything else = INTERNATIONAL); a type change moves it only before any purchase; the billing switch reaches
-- enforced only with an attestation and always goes back to off; a payment page opens for IL (monthly / annual, with SMART PACK)
-- and never for INTERNATIONAL.
BEGIN;
SELECT tst.seed();

SELECT tst.ok((SELECT market = 'IL' AND source = 'business_settings_country' FROM public.account_market WHERE user_id = '00000000-0000-4000-8000-00000000000a'),
  'M1 a Local account gets the IL market from its settings row');
SELECT tst.ok((SELECT market = 'INTERNATIONAL' FROM public.account_market WHERE user_id = '00000000-0000-4000-8000-00000000000b'),
  'M2 an International account gets the INTERNATIONAL market');
SELECT tst.ok(public.account_market_for_country('LCL') = 'IL' AND public.account_market_for_country('International') = 'INTERNATIONAL'
              AND public.account_market_for_country(NULL) IS NULL AND public.account_market_for_country(' ') IS NULL,
  'M3 the rule: Local / LCL = IL, any other type = INTERNATIONAL, no type = no market');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.account_market_for_country(text)', 'execute')
              AND NOT has_function_privilege('anon', 'public.set_billing_phase(text,text)', 'execute')
              AND NOT has_function_privilege('authenticated', 'public.create_package_checkout_intent(uuid,text,text,boolean)', 'execute'),
  'M4 none of the switches or helpers is callable by a user');

-- the switch
SELECT tst.throws($q$SELECT public.set_billing_phase('enforced', 'too short')$q$, 'attestation', 'M5 enforced without an attestation is refused');
SELECT tst.lives($q$SELECT public.set_billing_phase('enforced', 'Owner 2026-10-25: Israel purchasing on, test charge passed')$q$,
  'M6 enforced with an attestation is accepted');

-- a type change before any purchase moves the market
UPDATE public.business_settings SET country = 'International' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT tst.ok((SELECT market = 'INTERNATIONAL' FROM public.account_market WHERE user_id = '00000000-0000-4000-8000-00000000000a'),
  'M7 before any purchase the market follows an account type change');
UPDATE public.business_settings SET country = 'Local' WHERE user_id = '00000000-0000-4000-8000-00000000000a';

-- the payment page: IL monthly / annual (+ SMART PACK); never INTERNATIONAL
SELECT tst.ok((SELECT (r->>'ok')::boolean AND r->>'market' = 'IL' AND r->>'currency' = 'ILS' AND (r->>'amountMinor')::int = 3000
                 FROM public.create_package_checkout_intent('00000000-0000-4000-8000-00000000000a', 'month', 'k418-month-0000000001') r),
  'M8 an IL account gets a monthly page: 30.00 ILS');
SELECT tst.ok((SELECT (r->>'ok')::boolean AND (r->>'amountMinor')::int = 30600 + 10200 AND (r->>'smartPack')::boolean
                 FROM public.create_package_checkout_intent('00000000-0000-4000-8000-00000000000a', 'year', 'k418-year-00000000001', true) r),
  'M9 an IL account gets an annual page with SMART PACK: 306.00 + 102.00 ILS');
SELECT tst.ok((SELECT r = '{"ok": false, "code": "market_not_open"}'::jsonb
                 FROM public.create_package_checkout_intent('00000000-0000-4000-8000-00000000000b', 'month', 'k418-intl-00000000001') r),
  'M10 an INTERNATIONAL account gets no page (market_not_open)');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.checkout_attempts WHERE user_id = '00000000-0000-4000-8000-00000000000b'),
  'M11 nothing is recorded for the refused market');

-- after a purchase started, a type change no longer moves the market
UPDATE public.business_settings SET country = 'International' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT tst.ok((SELECT market = 'IL' FROM public.account_market WHERE user_id = '00000000-0000-4000-8000-00000000000a'),
  'M12 after a purchase started the market stays');

SELECT tst.lives($q$SELECT public.set_billing_phase('off', 'rollback')$q$, 'M13 off is always allowed (the rollback)');
SELECT tst.ok((SELECT r->>'code' = 'checkout_unavailable'
                 FROM public.create_package_checkout_intent('00000000-0000-4000-8000-00000000000a', 'month', 'k418-off-000000000001') r),
  'M14 with the switch off no page opens');

ROLLBACK;
