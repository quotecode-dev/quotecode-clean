-- Continuous work 30/10 (migration 20261030700000, Codex security follow-ups). Disposable postgres:17 harness ONLY. ONE transaction,
-- rolled back. Proves: the quote email send record (in flight / cooldown / unknown reused with the same key / limits / settle once);
-- the webhook accepts an event once and only for the quote's newest send; the app roles hold no TRUNCATE / TRIGGER / REFERENCES; the old
-- counter is closed and the public counter is throttled; the quote-files bucket has its size / type limits and the upload policy its
-- stored-total check; nothing of it is open to the app.
BEGIN;
SELECT tst.seed();

-- ------------------------------------------------------------------------------------------------- S1. closed to the app
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.quote_email_reserve(gen_random_uuid(), gen_random_uuid(), 'a@b.c')$q$, 'permission denied', 'S1 the public cannot reserve a send');
SELECT tst.throws($q$SELECT count(*) FROM public.quote_email_sends$q$, 'permission denied', 'S1b nor read the send records');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.resend_webhook_accept('e', 'email.bounced', 'x', gen_random_uuid())$q$, 'permission denied', 'S1c nor a signed-in user the webhook');
SELECT tst.throws($q$SELECT count(*) FROM public.quote_view_throttle$q$, 'permission denied', 'S1d nor the view throttle');
SELECT tst.logout();

-- ------------------------------------------------------------------------------------------------- S2. the send record (service role)
SELECT set_config('role', 'service_role', false);
SELECT set_config('tst.r1', public.quote_email_reserve('a4420000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', ' Dana@Customer.TEST ')::text, false);
SELECT tst.ok((current_setting('tst.r1')::jsonb ->> 'ok')::boolean AND current_setting('tst.r1')::jsonb ->> 'send_key' LIKE 'quote-email/v1/%', 'S2 a first send is reserved with its own key');
SELECT tst.ok(public.quote_email_reserve('a4420000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test') ->> 'code' = 'in_progress', 'S2b a second send of the same quote while it is in flight is refused');
SELECT tst.ok(public.quote_email_settle((current_setting('tst.r1')::jsonb ->> 'id')::uuid, 'unknown', NULL), 'S2c an unknown outcome is recorded');
SELECT tst.ok(NOT public.quote_email_settle((current_setting('tst.r1')::jsonb ->> 'id')::uuid, 'sent', NULL), 'S2d a settled send is never settled again');
SELECT tst.ok((SELECT r ->> 'send_key' = current_setting('tst.r1')::jsonb ->> 'send_key' AND (r ->> 'retry')::boolean
  FROM public.quote_email_reserve('a4420000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test') r),
  'S2e after an unknown outcome the next attempt reuses the SAME key (the provider never sends twice)');
SELECT tst.ok(public.quote_email_settle((current_setting('tst.r1')::jsonb ->> 'id')::uuid, 'sent', 'em_442_1'), 'S2f the retried send is settled as sent with its provider id');
SELECT tst.ok(public.quote_email_reserve('a4420000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test') ->> 'code' = 'cooldown', 'S2g the same quote to the same address a moment later is refused (cooldown, from the retry''s own time)');
SELECT set_config('tst.r2', public.quote_email_reserve('a4420000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 'stuck@customer.test')::text, false);
UPDATE public.quote_email_sends SET attempt_at = now() - interval '5 minutes' WHERE id = (current_setting('tst.r2')::jsonb ->> 'id')::uuid;
SELECT tst.ok((SELECT r ->> 'send_key' = current_setting('tst.r2')::jsonb ->> 'send_key' AND (r ->> 'retry')::boolean
  FROM public.quote_email_reserve('a4420000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 'stuck@customer.test') r),
  'S2g2 an attempt that never settled (a crash / time-out) is retried with the SAME key, never a new one');
SELECT tst.ok(public.quote_email_reserve('a4420000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 'other2@customer.test') ->> 'code' = 'in_progress',
  'S2g3 while that retry is in flight, a second click (even to another address) is refused');
SELECT tst.ok((public.quote_email_reserve('a4420000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'other@customer.test') ->> 'ok')::boolean, 'S2h another address of the same quote is not in cooldown');
UPDATE public.quote_email_sends SET state = 'failed' WHERE recipient = 'other@customer.test';
INSERT INTO public.quote_email_sends (quote_id, user_id, recipient, send_key, state)
SELECT gen_random_uuid(), '00000000-0000-4000-8000-00000000000a', 'spam@victim.test', 'quote-email/v1/s442-' || g, 'sent' FROM generate_series(1, 20) g;
SELECT tst.ok(public.quote_email_reserve(gen_random_uuid(), '00000000-0000-4000-8000-00000000000a', 'spam@victim.test') ->> 'code' = 'recipient_limit', 'S2i at most 20 emails a day to one recipient');
INSERT INTO public.quote_email_sends (quote_id, user_id, recipient, send_key, state)
SELECT gen_random_uuid(), '00000000-0000-4000-8000-00000000000a', 'r' || g || '@x.test', 'quote-email/v1/d442-' || g, 'sent' FROM generate_series(1, 180) g;
SELECT tst.ok(public.quote_email_reserve(gen_random_uuid(), '00000000-0000-4000-8000-00000000000a', 'fresh@x.test') ->> 'code' = 'daily_limit', 'S2j at most 200 emails a day per business');
SELECT tst.ok((public.quote_email_reserve(gen_random_uuid(), '00000000-0000-4000-8000-00000000000b', 'fresh@x.test') ->> 'ok')::boolean, 'S2k another business is not affected');

-- ------------------------------------------------------------------------------------------------- S3. the webhook
SELECT tst.ok(public.resend_webhook_accept('msg_442_a', 'email.bounced', 'em_442_1', 'a4420000-0000-4000-8000-000000000001') ->> 'reason' = 'current', 'S3 a bounce of the newest send is accepted');
SELECT tst.ok(public.resend_webhook_accept('msg_442_a', 'email.bounced', 'em_442_1', 'a4420000-0000-4000-8000-000000000001') ->> 'reason' = 'duplicate', 'S3b the same event again is a duplicate');
INSERT INTO public.quote_email_sends (quote_id, user_id, recipient, send_key, state, provider_id, created_at)
VALUES ('a4420000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', 'quote-email/v1/newer442', 'sent', 'em_442_2', now() + interval '1 minute');
SELECT tst.ok(public.resend_webhook_accept('msg_442_b', 'email.bounced', 'em_442_1', 'a4420000-0000-4000-8000-000000000001') ->> 'reason' = 'not_current', 'S3c an old send''s bounce never marks the quote after a newer send');
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES ('a4420000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-00000000000a', 944202, 'sent', 'ILS', 1);
SELECT tst.ok(public.resend_webhook_accept('msg_442_c', 'email.bounced', 'em_unknown', 'a4420000-0000-4000-8000-0000000000bb', 'mailbox does not exist') ->> 'reason' = 'legacy', 'S3d a quote with no recorded send keeps the former behaviour');
SELECT tst.ok((SELECT email_bounced AND email_bounce_reason = 'mailbox does not exist' FROM public.quotes WHERE id = 'a4420000-0000-4000-8000-0000000000bb'), 'S3d2 and the bounce is marked in the same call');
SELECT tst.ok(public.resend_webhook_accept('msg_442_d', 'email.bounced', 'em_unknown', 'a4420000-0000-4000-8000-000000000001') ->> 'reason' = 'not_current', 'S3e an unrecorded email of a recorded quote is not current');
RESET role;

-- ------------------------------------------------------------------------------------------------- S4. least privilege (DB-06)
SELECT tst.ok(NOT EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, unnest(ARRAY['anon', 'authenticated']) r(role), unnest(ARRAY['TRUNCATE', 'TRIGGER', 'REFERENCES']) p(priv)
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND has_table_privilege(r.role, c.oid, p.priv)), 'S4 no app role holds TRUNCATE / TRIGGER / REFERENCES on any public table');
SELECT tst.ok(has_table_privilege('authenticated', 'public.expenses', 'SELECT'), 'S4b the ordinary CRUD grants stay');

-- ------------------------------------------------------------------------------------------------- S5. view counters (DB-07)
SELECT tst.ok(to_regprocedure('public.increment_quote_views(uuid)') IS NULL OR NOT has_function_privilege('anon', 'public.increment_quote_views(uuid)', 'EXECUTE'), 'S5 the old counter is closed to the public');
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES ('a4420000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000000a', 944201, 'sent', 'ILS', 1);
SELECT set_config('request.headers', '{"user-agent":"Mozilla/5.0 (Windows NT 10.0) Chrome/130"}', true);
SELECT tst.anon();
SELECT public.public_increment_quote_view('a4420000-0000-4000-8000-0000000000aa');
SELECT public.public_increment_quote_view('a4420000-0000-4000-8000-0000000000aa');
SELECT tst.logout();
SELECT tst.ok((SELECT view_count = 1 FROM public.quotes WHERE id = 'a4420000-0000-4000-8000-0000000000aa'), 'S5b two views within a minute count once');
SELECT set_config('request.headers', '{"user-agent":"Mozilla/5.0 (compatible; Googlebot/2.1)"}', true);
UPDATE public.quote_view_throttle SET last_at = now() - interval '5 minutes';
SELECT tst.anon();
SELECT public.public_increment_quote_view('a4420000-0000-4000-8000-0000000000aa');
SELECT tst.logout();
SELECT tst.ok((SELECT view_count = 1 FROM public.quotes WHERE id = 'a4420000-0000-4000-8000-0000000000aa'), 'S5c a known bot does not count');
SELECT set_config('request.headers', '{"user-agent":"Mozilla/5.0 (Windows NT 10.0) Chrome/130"}', true);
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT public.public_increment_quote_view('a4420000-0000-4000-8000-0000000000aa');
SELECT tst.logout();
SELECT tst.ok((SELECT view_count = 1 FROM public.quotes WHERE id = 'a4420000-0000-4000-8000-0000000000aa'), 'S5d the issuing business does not count its own views');
UPDATE public.quote_view_throttle SET last_at = now() - interval '5 minutes', day_count = 50;
SELECT tst.anon();
SELECT public.public_increment_quote_view('a4420000-0000-4000-8000-0000000000aa');
SELECT tst.logout();
SELECT tst.ok((SELECT view_count = 1 FROM public.quotes WHERE id = 'a4420000-0000-4000-8000-0000000000aa'), 'S5e at most 50 counted views a day');

-- ------------------------------------------------------------------------------------------------- S6. quote-files (ST-02)
SELECT tst.ok((SELECT file_size_limit = 4194304 AND 'application/pdf' = ANY (allowed_mime_types) AND NOT ('text/html' = ANY (allowed_mime_types)) AND NOT ('image/svg+xml' = ANY (allowed_mime_types))
  FROM storage.buckets WHERE id = 'quote-files'), 'S6 the bucket keeps its 4 MB limit and refuses markup / executable types');
SELECT tst.ok((SELECT with_check LIKE '%quote_files_upload_allowed%' FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated owners upload quote files'),
  'S6b the upload policy checks the stored total');
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'quote-files', '00000000-0000-4000-8000-00000000000a/f' || g || '.pdf', jsonb_build_object('size', 3000000) FROM generate_series(1, 11) g;
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok(NOT public.quote_files_upload_allowed(), 'S6c a business with 30 MB of stored files (attached or not) cannot upload more');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.ok(public.quote_files_upload_allowed(), 'S6d another business is not affected');
SELECT tst.logout();

ROLLBACK;
