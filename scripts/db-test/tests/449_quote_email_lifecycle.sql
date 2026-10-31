-- Codex review 2026-10-31 group 1 (migration 20261031200000, Owner-typed decisions a + b). Disposable postgres:17 harness ONLY.
-- ONE transaction, rolled back. Proves: a retry of an unconfirmed send must be the same email (fingerprint) - a changed one is refused;
-- an unconfirmed send older than 23 hours is refused until the user's explicit "send anyway", which supersedes it with a new key; a bounce
-- that cannot be matched yet is held and applied only to the send it belongs to; the server clears only an OLDER bounce when the newest
-- send is recorded as sent; nothing of it is open to the app.
BEGIN;
SELECT tst.seed();

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.quote_email_reserve(gen_random_uuid(), gen_random_uuid(), 'a@b.c', NULL, true)$q$, 'permission denied', 'S1 the public cannot reserve (nor force a new send)');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.quote_email_reserve(gen_random_uuid(), '00000000-0000-4000-8000-00000000000a', 'a@b.c', NULL, true)$q$, 'permission denied', 'S1b nor a signed-in user');
SELECT tst.logout();

SELECT set_config('role', 'service_role', false);
-- ------------------------------------------------------------------------------------------------- S2. the fingerprint (decision b)
SELECT set_config('tst.a', public.quote_email_reserve('a4490000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', repeat('a', 64))::text, false);
SELECT tst.ok(public.quote_email_settle((current_setting('tst.a')::jsonb ->> 'id')::uuid, 'unknown', NULL), 'S2 the first send is unconfirmed');
SELECT tst.ok(public.quote_email_reserve('a4490000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', repeat('b', 64)) ->> 'code' = 'changed',
  'S2b a retry whose email changed is refused - the same key is never used for different content');
SELECT tst.ok((SELECT r ->> 'send_key' = current_setting('tst.a')::jsonb ->> 'send_key' AND (r ->> 'retry')::boolean
  FROM public.quote_email_reserve('a4490000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', repeat('a', 64)) r),
  'S2c the same email is retried with the SAME key');
SELECT tst.ok((SELECT fingerprint = repeat('a', 64) FROM public.quote_email_sends WHERE id = (current_setting('tst.a')::jsonb ->> 'id')::uuid), 'S2d only the fingerprint is kept (never the email)');
SELECT tst.ok(public.quote_email_settle((current_setting('tst.a')::jsonb ->> 'id')::uuid, 'unknown', NULL), 'S2e still unconfirmed');
SELECT tst.ok(public.quote_email_reserve('a4490000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', 'not-a-hash') ->> 'retry' = 'true',
  'S2f a malformed fingerprint is ignored (not a refusal of the same send)');
SELECT public.quote_email_settle((current_setting('tst.a')::jsonb ->> 'id')::uuid, 'unknown', NULL);

-- ------------------------------------------------------------------------------------------------- S3. older than 23 hours (decision a)
UPDATE public.quote_email_sends SET created_at = now() - interval '23 hours 1 minute' WHERE id = (current_setting('tst.a')::jsonb ->> 'id')::uuid;
SELECT tst.ok(public.quote_email_reserve('a4490000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', repeat('a', 64)) ->> 'code' = 'unresolved',
  'S3 an unconfirmed send older than 23 hours is never retried with a fresh key on its own');
SELECT set_config('tst.n', public.quote_email_reserve('a4490000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', repeat('a', 64), true)::text, false);
SELECT tst.ok((current_setting('tst.n')::jsonb ->> 'ok')::boolean AND NOT (current_setting('tst.n')::jsonb ->> 'retry')::boolean
  AND current_setting('tst.n')::jsonb ->> 'send_key' <> current_setting('tst.a')::jsonb ->> 'send_key', 'S3b the user''s "send anyway" issues a NEW key');
SELECT tst.ok((SELECT superseded_at IS NOT NULL AND state = 'unknown' FROM public.quote_email_sends WHERE id = (current_setting('tst.a')::jsonb ->> 'id')::uuid),
  'S3c the unconfirmed send stays as history, superseded');
SELECT tst.ok(public.quote_email_reserve('a4490000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', repeat('a', 64), true) ->> 'code' = 'in_progress',
  'S3d "send anyway" never bypasses a send in flight');
UPDATE public.quote_email_sends SET created_at = now() - interval '22 hours 59 minutes', superseded_at = NULL, state = 'unknown'
 WHERE id = (current_setting('tst.a')::jsonb ->> 'id')::uuid;
UPDATE public.quote_email_sends SET state = 'failed' WHERE id = (current_setting('tst.n')::jsonb ->> 'id')::uuid;
SELECT tst.ok(public.quote_email_reserve('a4490000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', repeat('a', 64)) ->> 'retry' = 'true',
  'S3e inside 23 hours the same email is still retried with its key');

-- ------------------------------------------------------------------------------------------------- S4. bounces (F04 / F05)
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total, email_bounced, email_bounce_reason, email_bounced_at)
VALUES ('a4490000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000a', 944901, 'sent', 'ILS', 1, true, 'old mailbox', now() - interval '1 hour');
SELECT set_config('tst.b', public.quote_email_reserve('a4490000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000a', 'fixed@customer.test', repeat('c', 64))::text, false);
SELECT tst.ok(public.resend_webhook_accept('msg_449_held', 'email.bounced', 'em_449_new', 'a4490000-0000-4000-8000-0000000000b1', 'mailbox full') ->> 'reason' = 'held',
  'S4 a bounce that cannot be matched yet (the newest send has no provider id) is held');
SELECT tst.ok((SELECT email_bounce_reason = 'old mailbox' FROM public.quotes WHERE id = 'a4490000-0000-4000-8000-0000000000b1'), 'S4b and the quote is not marked by it');
SELECT tst.ok(public.quote_email_settle((current_setting('tst.b')::jsonb ->> 'id')::uuid, 'sent', 'em_449_new'), 'S4c the send is recorded with its provider id');
SELECT tst.ok((SELECT email_bounced AND email_bounce_reason = 'mailbox full' FROM public.quotes WHERE id = 'a4490000-0000-4000-8000-0000000000b1'),
  'S4d the OLD bounce is cleared and the held bounce of THIS send is applied - a bounce that came first is never erased');
SELECT tst.ok((SELECT state = 'applied' FROM public.resend_webhook_events WHERE event_id = 'msg_449_held'), 'S4e the held event is applied once');
SELECT tst.ok(NOT public.quote_email_settle((current_setting('tst.b')::jsonb ->> 'id')::uuid, 'sent', 'em_449_new'), 'S4f and a second settle changes nothing');

INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total, email_bounced, email_bounce_reason, email_bounced_at)
VALUES ('a4490000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000000a', 944902, 'sent', 'ILS', 1, true, 'old mailbox', now() - interval '1 hour');
SELECT set_config('tst.c', public.quote_email_reserve('a4490000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000000a', 'ok@customer.test', repeat('d', 64))::text, false);
SELECT tst.ok(public.quote_email_settle((current_setting('tst.c')::jsonb ->> 'id')::uuid, 'sent', 'em_449_ok'), 'S5 a clean send is recorded');
SELECT tst.ok((SELECT NOT email_bounced AND email_bounce_reason IS NULL AND email_bounced_at IS NULL FROM public.quotes WHERE id = 'a4490000-0000-4000-8000-0000000000b2'),
  'S5b the server clears the older bounce mark (the browser no longer does)');

-- an old unmatched bounce arriving while a replacement send is in flight never marks the replacement
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES ('a4490000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-00000000000a', 944903, 'sent', 'ILS', 1);
SELECT set_config('tst.d', public.quote_email_reserve('a4490000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-00000000000a', 'r@customer.test', repeat('e', 64))::text, false);
SELECT tst.ok(public.resend_webhook_accept('msg_449_old', 'email.bounced', 'em_449_old', 'a4490000-0000-4000-8000-0000000000b3', 'old address') ->> 'reason' = 'held',
  'S6 an old unmatched bounce during a replacement send is held');
SELECT public.quote_email_settle((current_setting('tst.d')::jsonb ->> 'id')::uuid, 'sent', 'em_449_replacement');
SELECT tst.ok((SELECT NOT coalesce(email_bounced, false) FROM public.quotes WHERE id = 'a4490000-0000-4000-8000-0000000000b3'), 'S6b the replacement send is not marked by it');
SELECT tst.ok((SELECT state = 'held' FROM public.resend_webhook_events WHERE event_id = 'msg_449_old'), 'S6c the old event stays held (never guessed)');
SELECT tst.ok(public.resend_webhook_accept('msg_449_old2', 'email.bounced', 'em_449_other', 'a4490000-0000-4000-8000-0000000000b3') ->> 'reason' = 'not_current',
  'S6d once the newest send has its provider id, an unmatched event is not current');
SELECT tst.ok((SELECT state = 'ignored' FROM public.resend_webhook_events WHERE event_id = 'msg_449_old2'), 'S6e and is recorded as ignored');

-- a held event of a send that is no longer the newest is ignored when that send is recorded
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES ('a4490000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-00000000000a', 944904, 'sent', 'ILS', 1);
SELECT set_config('tst.e', public.quote_email_reserve('a4490000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-00000000000a', 'p@customer.test', repeat('f', 64))::text, false);
SELECT tst.ok(public.resend_webhook_accept('msg_449_late', 'email.bounced', 'em_449_first', 'a4490000-0000-4000-8000-0000000000b4') ->> 'reason' = 'held', 'S7 held');
INSERT INTO public.quote_email_sends (quote_id, user_id, recipient, send_key, state, created_at)
VALUES ('a4490000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-00000000000a', 'q@customer.test', 'quote-email/v1/newer449', 'reserved', now() + interval '1 minute');
SELECT public.quote_email_settle((current_setting('tst.e')::jsonb ->> 'id')::uuid, 'sent', 'em_449_first');
SELECT tst.ok((SELECT state = 'ignored' FROM public.resend_webhook_events WHERE event_id = 'msg_449_late')
  AND (SELECT NOT coalesce(email_bounced, false) FROM public.quotes WHERE id = 'a4490000-0000-4000-8000-0000000000b4'),
  'S7b the bounce of a send that is no longer the newest is ignored, the quote unmarked');
RESET role;

-- ------------------------------------------------------------------------------------------------- S8. closed to the app
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.quote_email_reserve(uuid, uuid, text, text, boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.quote_email_settle(uuid, text, text)', 'EXECUTE')
  AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'quote_email_reserve' AND pronargs = 3), 'S8 service role only; the former three-argument reservation is gone');


ROLLBACK;
