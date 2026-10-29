-- Codex release 2b (Owner 2026-10-29, migration 20261030100000): SEC-DB-04 + decision 3.
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: the signature fields are written only by the public signing
-- functions (a direct write by the owner, a customer or the service role is refused, on insert and update); the business's own status
-- labels without a signature still work; real customer signing still works; a quote with a line without a price cannot be signed (nothing
-- stored); the signed legacy-id function refuses a quote issued through the output authority in any phase.
BEGIN;
SELECT tst.seed();

INSERT INTO public.quotes (id, user_id, quote_number, status, total, currency, valid_until) VALUES
  ('a4340000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 943401, 'sent', 100, 'ILS', '2999-12-31'),
  ('a4340000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 943402, 'sent', 100, 'ILS', '2999-12-31'),
  ('a4340000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', 943403, 'sent', 100, 'ILS', '2999-12-31'),
  ('a4340000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000a', 943404, 'sent', 100, 'ILS', '2999-12-31');
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price, price_missing) VALUES
  ('a4340000-0000-4000-8000-000000000001', 'Synthetic priced', 1, 100, 100, false),
  ('a4340000-0000-4000-8000-000000000002', 'Synthetic priced', 1, 100, 100, false),
  ('a4340000-0000-4000-8000-000000000002', 'Synthetic unpriced', 1, 0, 0, true),
  ('a4340000-0000-4000-8000-000000000003', 'Synthetic priced', 1, 100, 100, false),
  ('a4340000-0000-4000-8000-000000000004', 'Synthetic priced', 1, 100, 100, false);

-- ------------------------------------------------------------------------------------------------- P1. nobody writes a signature directly
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$UPDATE public.quotes SET signature = 'data:image/png;base64,iVBORw0KGgo=' WHERE id = 'a4340000-0000-4000-8000-000000000001'$q$,
  'approval_write_forbidden', 'P1 the owner cannot write a customer signature into his own quote');
SELECT tst.throws($q$UPDATE public.quotes SET signer_name = 'Forged' WHERE id = 'a4340000-0000-4000-8000-000000000001'$q$,
  'approval_write_forbidden', 'P1b nor a signer name');
SELECT tst.throws($q$INSERT INTO public.quotes (id, user_id, quote_number, status, signature) VALUES ('a4340000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-00000000000a', 943409, 'draft', 'data:image/png;base64,iVBORw0KGgo=')$q$,
  'approval_write_forbidden', 'P1c nor insert a quote that already carries a signature');
SELECT tst.lives($q$UPDATE public.quotes SET status = 'approved' WHERE id = 'a4340000-0000-4000-8000-000000000004'$q$,
  'P1d the business''s own status label (Approved, no signature) still works');
SELECT tst.logout();
SELECT tst.ok((SELECT signature IS NULL AND signed_at IS NULL AND signer_name IS NULL FROM public.quotes WHERE id = 'a4340000-0000-4000-8000-000000000004'),
  'P1e and it carries no signature, no signer and no signing time');
DO $$ BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  BEGIN
    UPDATE public.quotes SET signature = 'data:image/png;base64,iVBORw0KGgo=' WHERE id = 'a4340000-0000-4000-8000-000000000001';
    PERFORM tst.ok(false, 'P1f the service role cannot write a signature either');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM LIKE 'approval_write_forbidden%', 'P1f the service role cannot write a signature either');
  END;
  PERFORM tst.logout();
END $$;
SELECT tst.anon();
SELECT tst.throws($q$UPDATE public.quotes SET signature = 'data:image/png;base64,iVBORw0KGgo=' WHERE id = 'a4340000-0000-4000-8000-000000000001'$q$,
  '.', 'P1g a customer cannot write it directly (refused by privileges or the guard)');
SELECT tst.logout();

-- ------------------------------------------------------------------------------------------------- P2. the real signing still works
SELECT tst.anon();
SELECT public.public_approve_quote_signed('a4340000-0000-4000-8000-000000000001', 'data:image/png;base64,iVBORw0KGgo=', 'Synthetic Signer');
SELECT tst.logout();
SELECT tst.ok((SELECT status = 'approved' AND signature LIKE 'data:image/png;base64,%' AND signer_name = 'Synthetic Signer' AND signed_at IS NOT NULL
                 FROM public.quotes WHERE id = 'a4340000-0000-4000-8000-000000000001'),
  'P2 a customer signs through the public function: approved, signature, signer and signing time stored');

-- ------------------------------------------------------------------------------------------- P3. decision 3: no signing of a missing price
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.public_approve_quote_signed('a4340000-0000-4000-8000-000000000002', 'data:image/png;base64,iVBORw0KGgo=', 'Synthetic Signer')$q$,
  'Missing prices', 'P3 a quote with a line without a price cannot be signed');
SELECT tst.throws($q$SELECT public.public_approve_quote('a4340000-0000-4000-8000-000000000002', 'data:image/png;base64,iVBORw0KGgo=')$q$,
  'Missing prices', 'P3b nor through the former function (the shared core)');
SELECT tst.logout();
SELECT tst.ok((SELECT status = 'sent' AND signature IS NULL AND signer_name IS NULL AND signed_at IS NULL FROM public.quotes WHERE id = 'a4340000-0000-4000-8000-000000000002'),
  'P3c nothing stored: still Sent, no signature, no signer');

-- ------------------------------------------------------------- P4. the signed legacy-id function: an output-issued quote only by capability
INSERT INTO auth.users (id, email) VALUES ('a4340000-0000-4000-8000-0000000000aa', 'p434-owner@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role)
  VALUES ('a4340000-0000-4000-8000-0000000000aa', 'p434-owner@synthetic.test', 'Synthetic Ledger', 'Local', 'ILS', 'free', 'user') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id) VALUES ('a4340000-0000-4000-8000-0000000000aa', 'free_10', NULL) ON CONFLICT (user_id) DO UPDATE SET account_mode = EXCLUDED.account_mode;
INSERT INTO public.clients (id, company_name, email, user_id) VALUES ('a4340000-0000-4000-8000-0000000000cc', 'Synthetic Customer P', 'p434-c@synthetic.test', 'a4340000-0000-4000-8000-0000000000aa');
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, valid_until) VALUES
  ('a4340000-0000-4000-8000-000000000005', 'a4340000-0000-4000-8000-0000000000aa', 943405, 'draft', 'a4340000-0000-4000-8000-0000000000cc', '2999-12-31');
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES ('a4340000-0000-4000-8000-000000000005', 'Synthetic', 1, 50, 50);
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
DO $$
DECLARE d text; p jsonb; r jsonb;
BEGIN
  d := public.quote_output_digest(public.quote_output_deal_document('a4340000-0000-4000-8000-0000000000aa', 'a4340000-0000-4000-8000-000000000005'));
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  p := public.prepare_quote_output('a4340000-0000-4000-8000-0000000000aa', 'a4340000-0000-4000-8000-000000000005', 'send', 'p434:' || d, d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('quote-files', p ->> 'snapshotPath', jsonb_build_object('size', 100)) ON CONFLICT (bucket_id, name) DO NOTHING;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  r := public.finalize_quote_output('a4340000-0000-4000-8000-0000000000aa', (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('a', 64), 100, 1, repeat('c', 64));
  PERFORM tst.logout();
  PERFORM tst.ok(r ->> 'state' = 'finalized', 'P4a (fixture) the quote went out through the output authority');
END $$;
-- even after a phase rollback (not enforced), its bare id never signs it
UPDATE public.subscription_activation SET phase = 'shadow' WHERE component = 'free_issue';
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.public_approve_quote_signed('a4340000-0000-4000-8000-000000000005', 'data:image/png;base64,iVBORw0KGgo=', 'Synthetic Signer')$q$,
  'cannot be approved', 'P4 the signed legacy-id function refuses a quote of the output ledger in any phase (only its capability link signs it)');
SELECT tst.logout();
SELECT tst.ok((SELECT signature IS NULL AND signer_name IS NULL FROM public.quotes WHERE id = 'a4340000-0000-4000-8000-000000000005'), 'P4b nothing stored');

ROLLBACK;
