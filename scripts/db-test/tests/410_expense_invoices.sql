-- Owner 2026-10-22 (typed L-22): the Owner's expense-invoice tool (20261023100000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: every table is closed to the app (RLS on, no grant to anon / authenticated) and open to the service role (the Edge Function);
-- the Google token is never in the admin state; the admin state is super admin only; one row per email; a sent row must carry its PayPlus id;
-- the settings row exists once; the private bucket exists.
BEGIN;
SELECT tst.seed();

CREATE OR REPLACE FUNCTION tst.esvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
GRANT EXECUTE ON FUNCTION tst.esvc() TO anon, authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['expense_mail_tokens', 'expense_mail_connections', 'expense_mail_seen', 'expense_invoices', 'expense_settings'] LOOP
    PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t AND rowsecurity)
                   AND NOT has_table_privilege('authenticated', 'public.' || t, 'select') AND NOT has_table_privilege('authenticated', 'public.' || t, 'insert')
                   AND NOT has_table_privilege('authenticated', 'public.' || t, 'update') AND NOT has_table_privilege('authenticated', 'public.' || t, 'delete')
                   AND NOT has_table_privilege('anon', 'public.' || t, 'select') AND NOT has_table_privilege('anon', 'public.' || t, 'insert')
                   AND NOT has_table_privilege('anon', 'public.' || t, 'update') AND NOT has_table_privilege('anon', 'public.' || t, 'delete')
                   AND has_table_privilege('service_role', 'public.' || t, 'select') AND has_table_privilege('service_role', 'public.' || t, 'update'),
      format('E0 %s: RLS on, closed to the app, open to the service role', t));
  END LOOP;
END $$;
SELECT tst.ok((SELECT count(*) = 1 FROM public.expense_settings), 'E1 one settings row');
SELECT tst.ok(EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'expense-invoices' AND public = false), 'E2 the invoice files bucket is private');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND (coalesce(qual, '') || coalesce(with_check, '')) ~ 'expense-invoices'),
  'E2b no storage policy opens the invoice files to the app');

-- the Edge Function writes (service role)
SELECT tst.esvc();
INSERT INTO public.expense_mail_tokens (mailbox, refresh_token) VALUES ('quotecodedev@gmail.com', 'synthetic-refresh-token-1');
INSERT INTO public.expense_mail_connections (mailbox) VALUES ('quotecodedev@gmail.com');
INSERT INTO public.expense_invoices (mailbox, message_id, supplier_name, doc_number, doc_date, amount, currency, status)
VALUES ('quotecodedev@gmail.com', 'm1', 'Supabase Inc', 'INV-1', '2026-09-01', 35, 'USD', 'pending');
SELECT tst.throws($q$INSERT INTO public.expense_invoices (mailbox, message_id, status) VALUES ('quotecodedev@gmail.com', 'm1', 'pending')$q$,
  'duplicate|unique', 'E3 one row per email');
SELECT tst.lives($q$UPDATE public.expense_invoices SET status = 'sending' WHERE message_id = 'm1'$q$, 'E4a a row can be claimed for sending');
SELECT tst.throws($q$UPDATE public.expense_invoices SET status = 'sent' WHERE message_id = 'm1'$q$, 'check', 'E4 a sent row must carry its PayPlus id');
SELECT tst.throws($q$UPDATE public.expense_invoices SET confidence = 'maybe' WHERE message_id = 'm1'$q$, 'check', 'E4b confidence is high / medium / low');
SELECT tst.lives($q$INSERT INTO public.expense_mail_seen (mailbox, message_id, outcome, attempts) VALUES ('quotecodedev@gmail.com', 'm7', 'retry', 1)$q$, 'E4c a failed email is kept for a retry with its attempts');
SELECT tst.lives($q$UPDATE public.expense_invoices SET status = 'sent', payplus_uuid = 'pp-1' WHERE message_id = 'm1'$q$, 'E5 sent with its PayPlus id');
SELECT tst.throws($q$INSERT INTO public.expense_mail_tokens (mailbox, refresh_token) VALUES ('not an email', 'synthetic-refresh-token-2')$q$, 'check', 'E6 a mailbox must be an address');
SELECT tst.logout();

-- a user cannot read anything
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.throws($q$SELECT public.expense_invoices_admin_state()$q$, 'super admin only', 'E7 a user cannot read the admin state');
SELECT tst.throws($q$SELECT * FROM public.expense_invoices$q$, 'permission denied', 'E8 a user cannot read the invoices table');
SELECT tst.throws($q$SELECT * FROM public.expense_mail_tokens$q$, 'permission denied', 'E9 a user cannot read the tokens');
SELECT tst.logout();

-- the super admin reads the state - never a token
SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT set_config('session_replication_role', 'origin', true);
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE r jsonb;
BEGIN
  r := public.expense_invoices_admin_state();
  PERFORM tst.ok(r ->> 'ok' = 'true' AND jsonb_array_length(r -> 'connections') = 1 AND jsonb_array_length(r -> 'invoices') = 1
                 AND r -> 'invoices' -> 0 ->> 'status' = 'sent' AND r -> 'settings' -> 'expenseTypes' = '[]'::jsonb
                 AND r::text !~ 'synthetic-refresh-token',
    'E10 the super admin sees mailboxes, invoices and settings - never the Google token');
END $$;
SELECT tst.throws($q$SELECT * FROM public.expense_invoices$q$, 'permission denied', 'E11 even the super admin reads only through the function');
SELECT tst.logout();

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.expense_invoices_admin_state()$q$, 'permission denied|super admin only', 'E12 ANON cannot read the admin state');
SELECT tst.logout();

ROLLBACK;
