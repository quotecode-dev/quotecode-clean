-- Owner 2026-10-20: smart support email stage 2 (20261020100000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the stage-1 row keeps 'new'; the widened status list and the colour / language / sender checks hold; the settings row
-- exists with sending OFF (drafts only) and the stop switch OFF; a super admin reads the settings and nobody in the app can change
-- them or the inquiries; the evening-summary day is claimed once and the app cannot see it.
BEGIN;
SELECT tst.seed();
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';

INSERT INTO public.support_inbound_messages (provider_event_id, provider_email_id, from_address, to_addresses, subject, text_body, received_at)
VALUES ('msg_evt_s2', 'email-s2', 'customer@example.test', ARRAY['support@inbound.tekango.test'], 'שאלה', 'איך מוסיפים לוגו?', now());

DO $$
BEGIN
  PERFORM tst.ok((SELECT status = 'new' AND bin IS NULL AND is_automated = false FROM public.support_inbound_messages WHERE provider_email_id = 'email-s2'), 'a newly stored email starts new, unsorted, not automated');
  PERFORM tst.ok((SELECT auto_send_green = false AND auto_send_yellow = false AND paused = false FROM public.support_assistant_settings WHERE id = 1), 'SETTINGS: one row, sending by colour OFF (drafts only), stop switch OFF');
  PERFORM tst.ok((SELECT count(*) FROM public.support_assistant_settings) = 1, 'SETTINGS: exactly one row');
END $$;

-- the service role (harness owner) moves an email through the stage-2 states
UPDATE public.support_inbound_messages SET bin = 'green', status = 'draft', reply_language = 'he', mailbox = 'support', draft_reply = 'שלום' WHERE provider_email_id = 'email-s2';
UPDATE public.support_inbound_messages SET status = 'answered', reply_text = 'שלום', reply_sent_at = now(), reply_sent_by = 'owner' WHERE provider_email_id = 'email-s2';
SELECT tst.ok((SELECT status = 'answered' AND reply_sent_by = 'owner' FROM public.support_inbound_messages WHERE provider_email_id = 'email-s2'), 'STATES: draft -> answered by the Owner is stored');
SELECT tst.throws($q$UPDATE public.support_inbound_messages SET status = 'sent' WHERE provider_email_id = 'email-s2'$q$, 'support_inbound_messages_status_check', 'STATES: an unknown status is refused');
SELECT tst.throws($q$UPDATE public.support_inbound_messages SET bin = 'blue' WHERE provider_email_id = 'email-s2'$q$, 'check', 'COLOUR: only green / yellow / red / black');
SELECT tst.throws($q$UPDATE public.support_inbound_messages SET reply_language = 'fr' WHERE provider_email_id = 'email-s2'$q$, 'check', 'LANGUAGE: only he / en');
SELECT tst.throws($q$UPDATE public.support_inbound_messages SET reply_sent_by = 'someone' WHERE provider_email_id = 'email-s2'$q$, 'check', 'SENDER: only the assistant or the Owner');
SELECT tst.throws($q$UPDATE public.support_inbound_messages SET mailbox = 'sales' WHERE provider_email_id = 'email-s2'$q$, 'check', 'MAILBOX: only support / info');
SELECT tst.throws($q$INSERT INTO public.support_assistant_settings (id) VALUES (2)$q$, 'check', 'SETTINGS: a second settings row is refused');

-- the evening summary day is claimed once
INSERT INTO public.support_digest_runs (day) VALUES (DATE '2026-10-20');
SELECT tst.throws($q$INSERT INTO public.support_digest_runs (day) VALUES (DATE '2026-10-20')$q$, 'support_digest_runs_pkey', 'DIGEST: one summary per day');

-- a super admin reads the inquiries and the settings, but cannot change either from the app
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((SELECT count(*) FROM public.support_assistant_settings) = 1, 'SUPER-ADMIN: reads the settings');
SELECT tst.ok((SELECT count(*) FROM public.support_inbound_messages WHERE status = 'answered') = 1, 'SUPER-ADMIN: reads the stage-2 state');
SELECT tst.throws($q$UPDATE public.support_assistant_settings SET paused = true$q$, 'permission denied', 'SUPER-ADMIN: cannot change the settings from the app (support-admin does it)');
SELECT tst.throws($q$UPDATE public.support_inbound_messages SET status = 'dismissed'$q$, 'permission denied', 'SUPER-ADMIN: cannot change an inquiry from the app');
SELECT tst.throws($q$SELECT count(*) FROM public.support_digest_runs$q$, 'permission denied', 'SUPER-ADMIN: the digest log is service-role only');
SELECT tst.logout();

-- another tenant / anon see no settings
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.ok((SELECT count(*) FROM public.support_assistant_settings) = 0, 'OTHER-TENANT: reads no settings');
SELECT tst.logout();
SELECT tst.anon();
SELECT tst.throws($q$SELECT count(*) FROM public.support_assistant_settings$q$, 'permission denied', 'ANON: no access to the settings');
SELECT tst.logout();

ROLLBACK;
