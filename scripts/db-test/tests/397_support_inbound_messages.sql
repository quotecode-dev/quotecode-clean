-- Owner 2026-10-19: smart support email stage 1 (20261019200000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: RLS on + forced; a super admin reads every inbound message; an ordinary user / another tenant / anon reads none; nobody
-- in the app can insert, update or delete; the same provider event or provider email never makes a second row; the body / attachment
-- limits hold.
BEGIN;
SELECT tst.seed();
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';

-- the support-inbound function (service role = the harness owner here) stores one message
INSERT INTO public.support_inbound_messages (provider_event_id, provider_email_id, message_id, from_address, from_name, to_addresses, subject, text_body, received_at)
VALUES ('msg_evt_1', 'email-1', '<a1@mail.example>', 'customer@example.test', 'Customer', ARRAY['support@inbound.tekango.test'], 'שאלה על המערכת', 'איך מוסיפים לוגו?', now());

DO $$
BEGIN
  PERFORM tst.ok(EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'support_inbound_messages' AND rowsecurity), 'support_inbound_messages exists with RLS on');
  PERFORM tst.ok((SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.support_inbound_messages'::regclass), 'RLS is forced');
  PERFORM tst.ok(NOT has_table_privilege('authenticated', 'public.support_inbound_messages', 'insert') AND NOT has_table_privilege('authenticated', 'public.support_inbound_messages', 'update')
    AND NOT has_table_privilege('authenticated', 'public.support_inbound_messages', 'delete') AND NOT has_table_privilege('anon', 'public.support_inbound_messages', 'select'), 'the app can only read (and only through the policy)');
END $$;

-- the same provider event / the same provider email never makes a second row
SELECT tst.throws($q$INSERT INTO public.support_inbound_messages (provider_event_id, provider_email_id, from_address, received_at) VALUES ('msg_evt_1', 'email-2', 'x@example.test', now())$q$, 'support_inbound_messages_event_unique', 'DEDUP: the same webhook event is stored once');
SELECT tst.throws($q$INSERT INTO public.support_inbound_messages (provider_event_id, provider_email_id, from_address, received_at) VALUES ('msg_evt_2', 'email-1', 'x@example.test', now())$q$, 'support_inbound_messages_email_unique', 'DEDUP: the same received email is stored once');
SELECT tst.throws($q$INSERT INTO public.support_inbound_messages (provider_event_id, provider_email_id, from_address, received_at, text_body) VALUES ('msg_evt_3', 'email-3', 'x@example.test', now(), repeat('a', 100001))$q$, 'check', 'LIMIT: an oversize body is refused');
SELECT tst.throws($q$INSERT INTO public.support_inbound_messages (provider_event_id, provider_email_id, from_address, received_at, attachments) VALUES ('msg_evt_4', 'email-4', 'x@example.test', now(), '{}'::jsonb)$q$, 'check', 'LIMIT: attachments must be a list');

-- a super admin reads it
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((SELECT count(*) FROM public.support_inbound_messages) = 1, 'SUPER-ADMIN: reads the inbound message');
SELECT tst.throws($q$INSERT INTO public.support_inbound_messages (provider_event_id, provider_email_id, from_address, received_at) VALUES ('e9', 'm9', 'x@example.test', now())$q$, 'permission denied', 'SUPER-ADMIN: cannot write from the app');
SELECT tst.throws($q$DELETE FROM public.support_inbound_messages$q$, 'permission denied', 'SUPER-ADMIN: cannot delete from the app');
SELECT tst.logout();

-- another tenant and a plain user read nothing; anon has no access
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.ok((SELECT count(*) FROM public.support_inbound_messages) = 0, 'OTHER-TENANT: reads nothing');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000c');
SELECT tst.ok((SELECT count(*) FROM public.support_inbound_messages) = 0, 'PLAIN-USER (no business row): reads nothing');
SELECT tst.logout();
SELECT tst.anon();
SELECT tst.throws($q$SELECT count(*) FROM public.support_inbound_messages$q$, 'permission denied', 'ANON: no access');
SELECT tst.logout();

ROLLBACK;
