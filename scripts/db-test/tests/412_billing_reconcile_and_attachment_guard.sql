-- Owner 2026-10-23 (typed L-09, L-13, L-14, L-17, L-22, L-24..L-27): the daily payment reconciliation (20261023300000) and the server-side
-- attachment limits (20261023310000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the reconciliation tables are closed to the app and open to the service role; one site run per Israel day, the Owner's runs any
-- time; one finding per (code, transaction); the source returns only verified PayPlus charges that gave an entitlement (never a rejected
-- one) with their checkout amount, and every refund we know; the source is the service role's only; the admin view and the status change
-- are super admin only. Attachments: the real stored size counts (a smaller file_size claim does not help), one file at most 3 MB, a
-- business at most 30 MB together, another business is not counted, a normal attachment is stored.
BEGIN;
SELECT tst.seed();

CREATE OR REPLACE FUNCTION tst.rsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
GRANT EXECUTE ON FUNCTION tst.rsvc() TO anon, authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['billing_reconcile_runs', 'billing_reconcile_findings'] LOOP
    PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t AND rowsecurity)
                   AND NOT has_table_privilege('authenticated', 'public.' || t, 'select') AND NOT has_table_privilege('authenticated', 'public.' || t, 'update')
                   AND NOT has_table_privilege('anon', 'public.' || t, 'select')
                   AND has_table_privilege('service_role', 'public.' || t, 'insert') AND has_table_privilege('service_role', 'public.' || t, 'update')
                   AND NOT has_table_privilege('service_role', 'public.' || t, 'delete'),
      format('R0 %s: RLS on, closed to the app, open to the service role (no delete)', t));
  END LOOP;
  PERFORM tst.ok(NOT has_function_privilege('authenticated', 'public.billing_reconcile_source(timestamptz, timestamptz)', 'execute')
                 AND NOT has_function_privilege('anon', 'public.billing_reconcile_source(timestamptz, timestamptz)', 'execute')
                 AND has_function_privilege('service_role', 'public.billing_reconcile_source(timestamptz, timestamptz)', 'execute'),
    'R1 the source of our billing records is the service role''s only');
END $$;

-- our records: user a paid (applied), a rejected charge, a failed one, a refund event, an admin refund PayPlus confirmed
INSERT INTO public.account_market (user_id, market, source) VALUES ('00000000-0000-4000-8000-00000000000a', 'IL', 'business_settings_country')
  ON CONFLICT (user_id) DO NOTHING;
DO $$
DECLARE v_price text; a1 uuid; a2 uuid; a3 uuid;
BEGIN
  SELECT price_id INTO v_price FROM public.price_versions WHERE currency = 'ILS' ORDER BY price_id LIMIT 1;
  INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, market, currency, amount_minor, state)
    VALUES ('00000000-0000-4000-8000-00000000000a', 'reconcile-412-attempt-1', v_price, 'IL', 'ILS', 3000, 'confirmed') RETURNING attempt_id INTO a1;
  INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, market, currency, amount_minor, state)
    VALUES ('00000000-0000-4000-8000-00000000000a', 'reconcile-412-attempt-2', v_price, 'IL', 'ILS', 3000, 'pending') RETURNING attempt_id INTO a2;
  INSERT INTO public.checkout_attempts (user_id, idempotency_key, plan_price_id, market, currency, amount_minor, state)
    VALUES ('00000000-0000-4000-8000-00000000000a', 'reconcile-412-attempt-3', v_price, 'IL', 'ILS', 3000, 'failed') RETURNING attempt_id INTO a3;
  INSERT INTO public.subscription_events (provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256, verified, outcome) VALUES
    ('payplus', 'tx-412-paid', 'payment_confirmed', a1, now() - interval '1 day', repeat('a', 64), true, 'applied'),
    ('payplus', 'tx-412-rejected', 'payment_confirmed', a2, now() - interval '1 day', repeat('b', 64), true, 'rejected'),
    ('payplus', 'tx-412-failed', 'payment_failed', a3, now() - interval '1 day', repeat('c', 64), true, 'applied'),
    ('payplus', 'tx-412-old', 'payment_confirmed', a1, now() - interval '40 days', repeat('d', 64), true, 'applied'),
    ('payplus', 'tx-412-refund', 'refund', a1, now() - interval '1 day', repeat('e', 64), true, 'policy_pending');
END $$;

SELECT tst.rsvc();
DO $$
DECLARE s jsonb;
BEGIN
  s := public.billing_reconcile_source(now() - interval '3 days', now());
  PERFORM tst.ok(jsonb_array_length(s -> 'charges') = 1 AND s -> 'charges' -> 0 ->> 'providerEventId' = 'tx-412-paid'
                 AND (s -> 'charges' -> 0 ->> 'amountMinor')::int = 3000 AND s -> 'charges' -> 0 ->> 'currency' = 'ILS'
                 AND s -> 'charges' -> 0 ->> 'attemptId' IS NOT NULL,
    'R2 the source: only the verified charge that gave an entitlement, in the window, with its checkout amount (not rejected / failed / older)');
  PERFORM tst.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(s -> 'refunds') r WHERE r ->> 'transactionUid' = 'tx-412-refund'),
    'R3 the source: a PayPlus refund event is a refund we know');
END $$;

INSERT INTO public.billing_reconcile_runs (run_day, source) VALUES ('2026-10-24', 'cron');
SELECT tst.throws($q$INSERT INTO public.billing_reconcile_runs (run_day, source) VALUES ('2026-10-24', 'cron')$q$, 'duplicate|unique', 'R4 one site run per Israel day');
INSERT INTO public.billing_reconcile_runs (run_day, source) VALUES ('2026-10-24', 'admin'), ('2026-10-24', 'admin');
SELECT tst.ok((SELECT count(*) = 3 FROM public.billing_reconcile_runs WHERE run_day = '2026-10-24'), 'R5 the Owner''s "run now" any time');
INSERT INTO public.billing_reconcile_findings (run_id, code, uid, detail)
  SELECT run_id, 'UNLINKED', 'tx-412-x', '{"amountMinor": 3000}'::jsonb FROM public.billing_reconcile_runs WHERE source = 'cron';
INSERT INTO public.billing_reconcile_findings (run_id, code, uid)
  SELECT run_id, 'AMOUNT_MISMATCH', 'tx-412-y' FROM public.billing_reconcile_runs WHERE source = 'cron';
SELECT tst.throws($q$INSERT INTO public.billing_reconcile_findings (run_id, code, uid) SELECT run_id, 'UNLINKED', 'tx-412-x' FROM public.billing_reconcile_runs WHERE source = 'cron'$q$,
  'duplicate|unique', 'R6 one finding per (code, transaction) - a later run never repeats it');
SELECT tst.throws($q$INSERT INTO public.billing_reconcile_findings (run_id, code, uid) SELECT run_id, 'GUESS', 'tx-412-z' FROM public.billing_reconcile_runs WHERE source = 'cron'$q$,
  'check', 'R7 only the four finding codes');
SELECT tst.throws($q$DELETE FROM public.billing_reconcile_findings$q$, 'permission denied', 'R8 the service role never deletes a finding');
SELECT tst.logout();

SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.throws($q$SELECT public.billing_reconcile_admin_state()$q$, 'super admin only', 'R9 a user cannot read the reconciliation');
SELECT tst.throws($q$SELECT public.billing_reconcile_set_status(gen_random_uuid(), 'checked')$q$, 'super admin only', 'R10 a user cannot change a finding');
SELECT tst.throws($q$SELECT public.billing_reconcile_source(now() - interval '3 days', now())$q$, 'permission denied', 'R11 a user cannot read the source');
SELECT tst.logout();

SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE r jsonb; v_id uuid;
BEGIN
  r := public.billing_reconcile_admin_state();
  PERFORM tst.ok(r ->> 'ok' = 'true' AND jsonb_array_length(r -> 'open') = 2 AND jsonb_array_length(r -> 'runs') = 3 AND jsonb_array_length(r -> 'checked') = 0,
    'R12 the super admin sees the runs and the open findings');
  SELECT (e ->> 'id')::uuid INTO v_id FROM jsonb_array_elements(r -> 'open') e WHERE e ->> 'uid' = 'tx-412-x';
  r := public.billing_reconcile_set_status(v_id, 'checked');
  PERFORM tst.ok(r ->> 'ok' = 'true', 'R13 the super admin marks a finding checked');
  r := public.billing_reconcile_set_status(v_id, 'ignored');
  PERFORM tst.ok(r ->> 'ok' = 'false' AND r ->> 'code' = 'invalid_status', 'R14 only new / checked');
  r := public.billing_reconcile_admin_state();
  PERFORM tst.ok(jsonb_array_length(r -> 'open') = 1 AND jsonb_array_length(r -> 'checked') = 1 AND r -> 'checked' -> 0 ->> 'checkedAt' IS NOT NULL,
    'R15 a checked finding moves to the checked list with its time');
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.billing_reconcile_findings'::regclass AND attname = 'mailed_at' AND NOT attisdropped),
    'R17 every finding records when the Owner was told (a failed email is retried)');
END $$;
SELECT tst.throws($q$SELECT * FROM public.billing_reconcile_findings$q$, 'permission denied', 'R16 even the super admin reads only through the function');
SELECT tst.logout();

-- ------------------------------------------------------------------------------------------------------------ attachment limits
-- two businesses of this file only (a shared seed user may already hold attachments committed by an earlier test file)
INSERT INTO auth.users (id, email) VALUES ('a4120000-0000-4000-8000-000000000001', 'att-412-1@synthetic.test'),
  ('a4120000-0000-4000-8000-000000000002', 'att-412-2@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES
  ('41200000-0000-4000-8000-000000000001', 'a4120000-0000-4000-8000-000000000001', 941201, 'draft', 'ILS', 10),
  ('41200000-0000-4000-8000-000000000002', 'a4120000-0000-4000-8000-000000000002', 941202, 'draft', 'USD', 10);
CREATE OR REPLACE FUNCTION tst.aobj(p_name text, p_size bigint) RETURNS void LANGUAGE sql AS $$
  INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('quote-files', p_name, NULL, jsonb_build_object('size', p_size)) $$;
CREATE OR REPLACE FUNCTION tst.aatt(p_quote uuid, p_name text, p_claim bigint) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.quote_attachments (quote_id, file_name, file_url, file_size, storage_path) VALUES (p_quote, 'f', p_name, p_claim, p_name) $$;

SELECT tst.aobj('a/q1_1.pdf', 2000000);
SELECT tst.aatt('41200000-0000-4000-8000-000000000001', 'a/q1_1.pdf', 2000000);
SELECT tst.ok((SELECT count(*) = 1 FROM public.quote_attachments WHERE quote_id = '41200000-0000-4000-8000-000000000001'), 'A1 a normal attachment is stored');
SELECT tst.aobj('a/q1_2.pdf', 3145729);
SELECT tst.throws($q$SELECT tst.aatt('41200000-0000-4000-8000-000000000001', 'a/q1_2.pdf', 10)$q$, 'attachment_file_too_large',
  'A2 the REAL stored size counts: a 3 MB + 1 byte file claimed as 10 bytes is refused');
SELECT tst.aobj('a/q1_3.pdf', 3145728);
SELECT tst.aatt('41200000-0000-4000-8000-000000000001', 'a/q1_3.pdf', 3145728);
SELECT tst.ok((SELECT count(*) = 2 FROM public.quote_attachments WHERE quote_id = '41200000-0000-4000-8000-000000000001'), 'A3 exactly 3 MB is allowed');
-- fill business a to 30 MB - 1 MB: 2,000,000 + 3,145,728 + 8 x 3,000,000 = 29,145,728
DO $$ BEGIN
  FOR n IN 1..8 LOOP
    PERFORM tst.aobj(format('a/q1_fill_%s.pdf', n), 3000000);
    PERFORM tst.aatt('41200000-0000-4000-8000-000000000001', format('a/q1_fill_%s.pdf', n), 3000000);
  END LOOP;
END $$;
SELECT tst.aobj('a/q1_over.pdf', 2400000);
SELECT tst.throws($q$SELECT tst.aatt('41200000-0000-4000-8000-000000000001', 'a/q1_over.pdf', 2400000)$q$, 'attachment_total_exceeded',
  'A4 a business at most 30 MB together (29.1 MB + 2.4 MB refused)');
SELECT tst.aobj('a/q1_fits.pdf', 2311552);
SELECT tst.aatt('41200000-0000-4000-8000-000000000001', 'a/q1_fits.pdf', 2311552);
SELECT tst.ok((SELECT sum(file_size) = 31457280 FROM public.quote_attachments WHERE quote_id = '41200000-0000-4000-8000-000000000001'), 'A5 exactly 30 MB together is allowed');
SELECT tst.aobj('b/q2_1.pdf', 3000000);
SELECT tst.aatt('41200000-0000-4000-8000-000000000002', 'b/q2_1.pdf', 3000000);
SELECT tst.ok((SELECT count(*) = 1 FROM public.quote_attachments WHERE quote_id = '41200000-0000-4000-8000-000000000002'), 'A6 another business is not counted');
SELECT tst.throws($q$SELECT tst.aatt('41200000-0000-4000-8000-000000000002', 'b/q2_missing.pdf', 3145729)$q$, 'attachment_file_too_large',
  'A7 without a stored object the claimed size still counts');
-- A8 / A9: a small row re-pointed at a large file, or a size raised, is checked like a new one; an unchanged row stays editable
SELECT tst.aobj('b/q2_big.pdf', 3145729);
SELECT tst.throws($q$UPDATE public.quote_attachments SET storage_path = 'b/q2_big.pdf', file_url = 'b/q2_big.pdf' WHERE storage_path = 'b/q2_1.pdf'$q$,
  'attachment_file_too_large', 'A8 re-pointing a row at a file over 3 MB is refused');
UPDATE public.quote_attachments SET file_name = 'renamed.pdf' WHERE storage_path = 'b/q2_1.pdf';
UPDATE public.quote_attachments SET file_size = 2999999 WHERE storage_path = 'b/q2_1.pdf';
SELECT tst.ok((SELECT file_name = 'renamed.pdf' AND file_size = 2999999 FROM public.quote_attachments WHERE storage_path = 'b/q2_1.pdf'),
  'A9 a rename and a size within the limit are allowed (the row itself is not counted twice)');

ROLLBACK;
