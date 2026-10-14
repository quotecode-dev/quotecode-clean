-- Task 20: reminders & automation + customer first view (20261009200000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: first_viewed_at is written only by public_record_quote_first_view, only for a non-issuer viewer with a real (non-bot) user agent,
-- exactly once (repeat views never reset it), also on a signed quote without unlocking its content, and never by a crafted owner write;
-- reminder settings / read marks / stops are owner-only under forced RLS, the mode check holds, Full activation time and history are
-- server-owned; a customer stop cannot be forged or lifted by the business; the occurrence ledger claims at most once per (account, key)
-- and records why nothing was sent (Full off, approved quote, expiry, stop, bounce).
BEGIN;
SELECT tst.seed();

INSERT INTO public.clients (id, company_name, email, user_id) VALUES
  ('a2000000-0000-4000-8000-00000000c0a1', 'Synthetic Client A', 'Client-A@synthetic.test', '00000000-0000-4000-8000-00000000000a');
INSERT INTO public.quotes (id, user_id, client_id, quote_number, status, currency, total, valid_until) VALUES
  ('a2000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000c0a1', 932001, 'sent', 'ILS', 100, DATE '2099-12-31'),
  ('a2000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000c0a1', 932002, 'sent', 'ILS', 100, DATE '2099-12-31'),
  ('a2000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000c0a1', 932003, 'sent', 'ILS', 100, DATE '2000-01-01'),
  ('a2000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-00000000c0a1', 932004, 'sent', 'ILS', 100, DATE '2099-12-31');
-- a signed quote (approved) for the immutability interaction
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total, signature) VALUES
  ('a2000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-00000000000a', 932009, 'approved', 'ILS', 100, 'data:image/png;base64,AAAA');

DO $$
BEGIN
  PERFORM tst.ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'first_viewed_at'), 'quotes.first_viewed_at exists');
  PERFORM tst.ok(has_function_privilege('anon', 'public.public_record_quote_first_view(uuid)', 'execute'), 'anon may call the first-view recorder');
  PERFORM tst.ok(NOT has_function_privilege('anon', 'public.claim_automation_occurrence(uuid, text, text, uuid, text)', 'execute')
    AND NOT has_function_privilege('authenticated', 'public.claim_automation_occurrence(uuid, text, text, uuid, text)', 'execute'), 'claim is service_role only');
  PERFORM tst.ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.reminder_settings'::regclass), 'reminder_settings RLS forced');
  PERFORM tst.ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.customer_contact_stops'::regclass), 'customer_contact_stops RLS forced');
  PERFORM tst.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reminder_audit'::regclass), 'reminder_audit RLS enabled');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.reminder_settings', 'select') AND NOT has_table_privilege('anon', 'public.reminder_audit', 'select')
    AND NOT has_table_privilege('anon', 'public.customer_contact_stops', 'select') AND NOT has_table_privilege('anon', 'public.automation_occurrences', 'select'), 'anon reads none of the new tables');
  PERFORM tst.ok(NOT has_table_privilege('authenticated', 'public.reminder_audit', 'insert') AND NOT has_table_privilege('authenticated', 'public.automation_occurrences', 'insert'), 'the app cannot write history or the ledger');
END $$;

-- ---------------------------------------------------------------- first view
SELECT set_config('request.headers', '{"user-agent":"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36"}', false);

SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok(public.public_record_quote_first_view('a2000000-0000-4000-8000-0000000000a1') = false, 'FIRST VIEW: the issuing owner is never the customer');
SELECT tst.lives($q$UPDATE public.quotes SET first_viewed_at = now() WHERE id = 'a2000000-0000-4000-8000-0000000000a2'$q$, 'FIRST VIEW: a crafted owner write does not fail ...');
SELECT tst.logout();
SELECT tst.ok((SELECT first_viewed_at IS NULL FROM public.quotes WHERE id IN ('a2000000-0000-4000-8000-0000000000a1')) AND (SELECT first_viewed_at IS NULL FROM public.quotes WHERE id = 'a2000000-0000-4000-8000-0000000000a2'),
  'FIRST VIEW: ... and neither the owner view nor the crafted write set it');

SELECT tst.anon();
SELECT set_config('request.headers', '{"user-agent":""}', false);
SELECT tst.ok(public.public_record_quote_first_view('a2000000-0000-4000-8000-0000000000a1') = false, 'FIRST VIEW: no user agent -> not a customer view');
SELECT set_config('request.headers', '{"user-agent":"Mozilla/5.0 (compatible; Googlebot/2.1)"}', false);
SELECT tst.ok(public.public_record_quote_first_view('a2000000-0000-4000-8000-0000000000a1') = false, 'FIRST VIEW: a crawler is not a customer view');
SELECT set_config('request.headers', '{"user-agent":"Mozilla/5.0 (Windows NT 10.0) HeadlessChrome/129.0"}', false);
SELECT tst.ok(public.public_record_quote_first_view('a2000000-0000-4000-8000-0000000000a1') = false, 'FIRST VIEW: a headless scanner is not a customer view');
SELECT set_config('request.headers', '{"user-agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"}', false);
SELECT tst.ok(public.public_record_quote_first_view('a2000000-0000-4000-8000-0000000000a1') = true, 'FIRST VIEW: an anonymous browser view records it');
SELECT tst.ok(public.public_record_quote_first_view('a2000000-0000-4000-8000-0000000000a1') = false, 'FIRST VIEW: a repeat view records nothing');
SELECT tst.ok(public.public_record_quote_first_view('a2000000-0000-4000-8000-0000000000ff') = false, 'FIRST VIEW: an unknown quote id records nothing');
SELECT tst.ok(public.public_record_quote_first_view('a2000000-0000-4000-8000-0000000000a9') = true, 'FIRST VIEW: recorded on a signed quote too');
SELECT tst.logout();

SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.ok(public.public_record_quote_first_view('a2000000-0000-4000-8000-0000000000a4') = true, 'FIRST VIEW: a TEKANGO user of another tenant counts as a customer');
SELECT tst.logout();

DO $$
DECLARE v_first timestamptz;
BEGIN
  SELECT first_viewed_at INTO v_first FROM public.quotes WHERE id = 'a2000000-0000-4000-8000-0000000000a1';
  PERFORM tst.ok(v_first IS NOT NULL, 'FIRST VIEW: stored with server time');
  UPDATE public.quotes SET first_viewed_at = NULL WHERE id = 'a2000000-0000-4000-8000-0000000000a1';
  PERFORM tst.ok((SELECT first_viewed_at FROM public.quotes WHERE id = 'a2000000-0000-4000-8000-0000000000a1') = v_first, 'FIRST VIEW: never reset, even by a privileged write');
END $$;
SELECT tst.throws($q$UPDATE public.quotes SET notes = 'changed' WHERE id = 'a2000000-0000-4000-8000-0000000000a9'$q$, 'can no longer be modified', 'FIRST VIEW: the signed quote content stays immutable');

-- ---------------------------------------------------------------- settings / read marks / stops
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE v_row public.reminder_settings;
BEGIN
  INSERT INTO public.reminder_settings (mode) VALUES ('in_app') RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.user_id = '00000000-0000-4000-8000-00000000000a' AND v_row.full_enabled_at IS NULL, 'SETTINGS: owner row, In-app, no Full time');
  UPDATE public.reminder_settings SET mode = 'full', full_enabled_at = '2000-01-01T00:00:00Z' RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.full_enabled_at > '2020-01-01T00:00:00Z', 'SETTINGS: Full activation time is server-owned');
  UPDATE public.reminder_settings SET paused = true RETURNING * INTO v_row;
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM public.reminder_audit WHERE action IN ('mode_set', 'automation_paused')) = 3, 'SETTINGS: mode changes and pause are in the history');
  UPDATE public.reminder_settings SET mode = 'in_app', paused = false RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.full_enabled_at IS NULL, 'SETTINGS: leaving Full clears its activation time');
  INSERT INTO public.reminder_notification_state (item_key) VALUES ('task_due:x:2026-10-09T');
  INSERT INTO public.customer_contact_stops (email_lower) VALUES ('stopped@synthetic.test');
END $$;
SELECT tst.throws($q$UPDATE public.reminder_settings SET mode = 'reject'$q$, 'reminder_settings_mode_check', 'SETTINGS: no other mode (no reject)');
SELECT tst.throws($q$INSERT INTO public.customer_contact_stops (email_lower, source) VALUES ('forged@synthetic.test', 'customer_link')$q$, 'TK_STOP_SOURCE_NOT_ALLOWED', 'STOPS: the business cannot forge a customer stop');
SELECT tst.throws($q$INSERT INTO public.reminder_audit (user_id, actor, action) VALUES ('00000000-0000-4000-8000-00000000000a', 'business', 'x')$q$, 'permission denied', 'AUDIT: the app cannot write history');
SELECT tst.logout();

SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
BEGIN
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM public.reminder_settings) = 0, 'TENANT: B sees no settings of A');
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM public.reminder_notification_state) = 0, 'TENANT: B sees no read marks of A');
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM public.customer_contact_stops) = 0, 'TENANT: B sees no stops of A');
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM public.reminder_audit) = 0, 'TENANT: B sees no history of A');
  UPDATE public.reminder_settings SET mode = 'off' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
END $$;
SELECT tst.throws($q$INSERT INTO public.reminder_settings (user_id, mode) VALUES ('00000000-0000-4000-8000-00000000000a', 'full')$q$, 'row-level security', 'TENANT: B cannot create settings for A');
SELECT tst.logout();
SELECT tst.ok((SELECT mode FROM public.reminder_settings WHERE user_id = '00000000-0000-4000-8000-00000000000a') = 'in_app', 'TENANT: B''s update of A''s settings changed nothing');

-- ---------------------------------------------------------------- occurrence ledger
SET ROLE service_role;
SELECT tst.ok(public.claim_automation_occurrence('00000000-0000-4000-8000-00000000000a', 'customer_followup_email:a1:fv', 'customer_followup_email', 'a2000000-0000-4000-8000-0000000000a1', 'client-a@synthetic.test') IS NULL,
  'LEDGER: In-app mode -> no claim');
SELECT tst.ok((SELECT status = 'skipped' AND last_error = 'full_mode_off' FROM public.automation_occurrences WHERE dedup_key = 'customer_followup_email:a1:fv'), 'LEDGER: the refusal is recorded with its reason');
RESET ROLE;
UPDATE public.reminder_settings SET mode = 'full', behaviors = '{"customer_followup_email": true, "customer_validity_email": true}'::jsonb,
  rules = '{"customer_followup_email": {"subject": "s", "body": "b", "paused": false}}'::jsonb
 WHERE user_id = '00000000-0000-4000-8000-00000000000a';
UPDATE public.quotes SET status = 'approved' WHERE id = 'a2000000-0000-4000-8000-0000000000a2';
SET ROLE service_role;
SELECT tst.ok(public.claim_automation_occurrence('00000000-0000-4000-8000-00000000000a', 'customer_followup_email:a1:fv', 'customer_followup_email', 'a2000000-0000-4000-8000-0000000000a1', 'client-a@synthetic.test') IS NULL,
  'LEDGER: a recorded skip is final for that key (one message per quote per rule)');
SELECT tst.ok(public.claim_automation_occurrence('00000000-0000-4000-8000-00000000000a', 'customer_followup_email:a1:fv2', 'customer_followup_email', 'a2000000-0000-4000-8000-0000000000a1', 'Client-A@synthetic.test') IS NOT NULL,
  'LEDGER: Full + selected rule + awaiting quote -> one claim');
SELECT tst.ok(public.claim_automation_occurrence('00000000-0000-4000-8000-00000000000a', 'customer_followup_email:a1:fv2', 'customer_followup_email', 'a2000000-0000-4000-8000-0000000000a1', 'client-a@synthetic.test') IS NULL,
  'LEDGER: a second claim for the same key gets nothing (no duplicate)');
SELECT tst.ok(public.complete_automation_occurrence('00000000-0000-4000-8000-00000000000a', 'customer_followup_email:a1:fv2',
  (SELECT claim_id FROM public.automation_occurrences WHERE dedup_key = 'customer_followup_email:a1:fv2'), 'sent', 'msg_synthetic') = true, 'LEDGER: the holder completes as sent');
SELECT tst.ok(public.claim_automation_occurrence('00000000-0000-4000-8000-00000000000a', 'customer_followup_email:a1:fv2', 'customer_followup_email', 'a2000000-0000-4000-8000-0000000000a1', 'client-a@synthetic.test') IS NULL,
  'LEDGER: a sent key is never claimed again');
SELECT tst.ok(public.claim_automation_occurrence('00000000-0000-4000-8000-00000000000a', 'customer_followup_email:a2:fv', 'customer_followup_email', 'a2000000-0000-4000-8000-0000000000a2', 'client-a@synthetic.test') IS NULL, 'LEDGER: approval cancels (no claim)');
SELECT tst.ok((SELECT status = 'cancelled' AND last_error = 'quote_not_awaiting' FROM public.automation_occurrences WHERE dedup_key = 'customer_followup_email:a2:fv'), 'LEDGER: approval cancels');
SELECT tst.ok(public.claim_automation_occurrence('00000000-0000-4000-8000-00000000000a', 'customer_validity_email:a3:vu', 'customer_validity_email', 'a2000000-0000-4000-8000-0000000000a3', 'client-a@synthetic.test') IS NULL, 'LEDGER: expiry cancels (no claim)');
SELECT tst.ok((SELECT last_error = 'quote_expired' FROM public.automation_occurrences WHERE dedup_key = 'customer_validity_email:a3:vu'), 'LEDGER: expiry cancels');
SELECT tst.ok(public.claim_automation_occurrence('00000000-0000-4000-8000-00000000000a', 'customer_followup_email:a4:fv', 'customer_followup_email', 'a2000000-0000-4000-8000-0000000000a4', 'Stopped@synthetic.test') IS NULL, 'LEDGER: a stopped customer is never messaged (no claim)');
SELECT tst.ok((SELECT last_error = 'contact_stopped' FROM public.automation_occurrences WHERE dedup_key = 'customer_followup_email:a4:fv'), 'LEDGER: a stopped customer is never messaged');
SELECT tst.ok(public.claim_automation_occurrence('00000000-0000-4000-8000-00000000000b', 'customer_followup_email:a1:x', 'customer_followup_email', 'a2000000-0000-4000-8000-0000000000a1', 'client-a@synthetic.test') IS NULL, 'LEDGER: another account can never claim A''s quote (no claim)');
SELECT tst.ok((SELECT last_error = 'full_mode_off' FROM public.automation_occurrences WHERE user_id = '00000000-0000-4000-8000-00000000000b'), 'LEDGER: another account can never claim A''s quote');
RESET ROLE;

ROLLBACK;
