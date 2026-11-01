-- Codex review 2026-10-31 group 4 (migration 20261031500000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: a draft is admitted under the day's cap, never a second open proposal for one account, one case per account and signal;
-- account erasure removes the recipient address from the send records and the text / address / evidence from Maya's drafts (and only
-- that account's); the 30-day retention removes addresses from old send records and handled drafts; nothing of it is open to the app.
BEGIN;
SELECT tst.seed();

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.account_erase_agent_and_email_records('00000000-0000-4000-8000-00000000000a')$q$, 'permission denied', 'S1 the public cannot erase');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.customer_success_admit('00000000-0000-4000-8000-00000000000a', 'free_ending', '{}', now(), 20)$q$, 'permission denied', 'S1b nor a signed-in user admit a draft');
SELECT tst.throws($q$SELECT public.privacy_retention_tick()$q$, 'permission denied', 'S1c nor run the retention');
SELECT tst.logout();

SELECT set_config('role', 'service_role', false);
-- ------------------------------------------------------------------------------------------------- S2. admission (F21)
SELECT tst.ok((public.customer_success_admit('00000000-0000-4000-8000-00000000000a', 'renewal_failed_grace', '{"d":1}', now() - interval '1 hour', 20) ->> 'ok')::boolean, 'S2 a draft is admitted');
SELECT tst.ok(public.customer_success_admit('00000000-0000-4000-8000-00000000000a', 'free_ending', '{}', now() - interval '1 hour', 20) ->> 'code' = 'account_open',
  'S2b never a second open proposal for the same account');
SELECT tst.ok((public.customer_success_admit('00000000-0000-4000-8000-00000000000b', 'free_ending', '{}', now() - interval '1 hour', 1) ->> 'code') = 'cap',
  'S2c the day''s cap is counted inside the admission (1 already today)');
UPDATE public.customer_success_cases SET status = 'sent' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT tst.ok(public.customer_success_admit('00000000-0000-4000-8000-00000000000a', 'renewal_failed_grace', '{}', now() - interval '1 hour', 20) ->> 'code' = 'exists',
  'S2d one case per account and signal, for ever');
SELECT tst.ok((public.customer_success_admit('00000000-0000-4000-8000-00000000000a', 'free_ending', '{}', now() - interval '1 hour', 20) ->> 'ok')::boolean,
  'S2e another signal once the first proposal was handled');
SELECT tst.throws($q$SELECT public.customer_success_admit('00000000-0000-4000-8000-00000000000a', 'paid_inactive', '{}', now() - interval '5 days', 20)$q$, 'customer_success_admit_invalid', 'S2f a day start out of range is refused');

-- ------------------------------------------------------------------------------------------------- S3. erasure (F30)
INSERT INTO public.quote_email_sends (quote_id, user_id, recipient, send_key, state) VALUES
  (gen_random_uuid(), '00000000-0000-4000-8000-00000000000a', 'dana@customer.test', 'quote-email/v1/e452-1', 'sent'),
  (gen_random_uuid(), '00000000-0000-4000-8000-00000000000a', 'ron@customer.test', 'quote-email/v1/e452-2', 'unknown'),
  (gen_random_uuid(), '00000000-0000-4000-8000-00000000000b', 'keep@customer.test', 'quote-email/v1/e452-3', 'sent');
RESET role;
INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en, detail_he, detail_en, payload, dedupe_key) VALUES
  ('x452', 'customer_success', 'system', 'outreach_draft', 'a', 'b', 'hello Dana', 'hello Dana',
   '{"caseId":"c1","userId":"00000000-0000-4000-8000-00000000000a","recipient":"owner-a@biz.test","text":"hello","evidence":{"q":1}}', 'outreach:a:free_ending'),
  ('x452', 'customer_success', 'system', 'outreach_draft', 'a', 'b', 'hello B', 'hello B',
   '{"caseId":"c2","userId":"00000000-0000-4000-8000-00000000000b","recipient":"owner-b@biz.test","text":"hello"}', 'outreach:b:free_ending');
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((public.account_erase_agent_and_email_records('00000000-0000-4000-8000-00000000000a') ->> 'sends')::int = 2, 'S3 the account''s two send records are anonymized');
SELECT tst.ok((SELECT bool_and(recipient = 'erased') AND bool_and(send_key LIKE 'quote-email/v1/e452-%') FROM public.quote_email_sends WHERE user_id = '00000000-0000-4000-8000-00000000000a'),
  'S3b no address left; the key / state tombstone stays (the provider replay still works)');
SELECT tst.ok((SELECT recipient = 'keep@customer.test' FROM public.quote_email_sends WHERE send_key = 'quote-email/v1/e452-3'), 'S3c another account untouched');
RESET role;
SELECT tst.ok((SELECT payload = '{"caseId":"c1","erased":true}'::jsonb AND detail_he IS NULL AND dedupe_key IS NULL FROM public.agent_actions WHERE run_key = 'x452' AND payload ->> 'caseId' = 'c1'),
  'S3d Maya''s draft keeps no text, address or evidence');
SELECT tst.ok((SELECT payload ->> 'recipient' = 'owner-b@biz.test' FROM public.agent_actions WHERE run_key = 'x452' AND payload ->> 'caseId' = 'c2'), 'S3e another account''s draft untouched');

-- ------------------------------------------------------------------------------------------------- S4. retention after 30 days (decision c)
UPDATE public.quote_email_sends SET created_at = now() - interval '31 days' WHERE send_key = 'quote-email/v1/e452-3';
UPDATE public.agent_actions SET created_at = now() - interval '31 days', status = 'done' WHERE run_key = 'x452' AND payload ->> 'caseId' = 'c2';
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((public.privacy_retention_tick() ->> 'sends')::int = 1, 'S4 an address older than 30 days is removed from the send records');
RESET role;
SELECT tst.ok((SELECT recipient = 'erased' FROM public.quote_email_sends WHERE send_key = 'quote-email/v1/e452-3')
  AND (SELECT NOT (payload ? 'recipient') AND (payload ->> 'recipient_erased')::boolean FROM public.agent_actions WHERE run_key = 'x452' AND payload ->> 'caseId' = 'c2'),
  'S4b and from a handled draft older than 30 days');
-- review fixes: a stuck old case never blocks an account; an unconfirmed old send keeps its address; an erased waiting draft is closed
INSERT INTO public.quote_email_sends (quote_id, user_id, recipient, send_key, state, created_at) VALUES
  (gen_random_uuid(), '00000000-0000-4000-8000-00000000000b', 'open@customer.test', 'quote-email/v1/e452-4', 'unknown', now() - interval '40 days');
SELECT set_config('role', 'service_role', false);
SELECT public.privacy_retention_tick();
RESET role;
SELECT tst.ok((SELECT recipient = 'open@customer.test' FROM public.quote_email_sends WHERE send_key = 'quote-email/v1/e452-4'), 'S4c an unconfirmed send keeps its address (it still blocks a fresh key)');
UPDATE public.customer_success_cases SET status = 'draft', updated_at = now() - interval '8 days' WHERE user_id = '00000000-0000-4000-8000-00000000000a' AND signal_code = 'free_ending';
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((public.customer_success_admit('00000000-0000-4000-8000-00000000000a', 'paid_inactive', '{}', now() - interval '1 hour', 50) ->> 'ok')::boolean, 'S2g a case stuck for over 7 days never blocks the account');
RESET role;
INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en, payload, status) VALUES
  ('y452', 'customer_success', 'system', 'outreach_draft', 'a', 'b', '{"caseId":"c3","userId":"00000000-0000-4000-8000-00000000000b","recipient":"x@y.test"}', 'proposed');
SELECT set_config('role', 'service_role', false);
SELECT public.account_erase_agent_and_email_records('00000000-0000-4000-8000-00000000000b');
RESET role;
SELECT tst.ok((SELECT status = 'rejected' AND decided_at IS NOT NULL FROM public.agent_actions WHERE run_key = 'y452'), 'S3f an erased draft still waiting for the Owner is closed');
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.privacy_retention_tick()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.customer_success_admit(uuid, text, jsonb, timestamptz, integer)', 'EXECUTE'), 'S5 service role only');

ROLLBACK;
