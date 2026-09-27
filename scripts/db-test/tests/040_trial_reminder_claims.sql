-- Codex Post-LIVE Wave 1 blocker 3: claim_trial_reminder / complete_trial_reminder semantics (single session).
-- Overlapping sessions are proven by 041_trial_reminder_concurrency.mjs. Synthetic accounts only.
SELECT tst.seed();
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'stale-claim@synthetic.test'),
  ('00000000-0000-4000-8000-0000000000d2', 'legacy-flag@synthetic.test'),
  ('00000000-0000-4000-8000-0000000000d3', 'persist-fail@synthetic.test'),
  ('00000000-0000-4000-8000-0000000000d4', 'no-account-row@synthetic.test')
ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, trial_reminder_3d_sent) VALUES
  ('00000000-0000-4000-8000-0000000000d1', 'stale-claim@synthetic.test', 'Synthetic Stale', 'International', 'USD', false),
  ('00000000-0000-4000-8000-0000000000d2', 'legacy-flag@synthetic.test', 'Synthetic Legacy', 'Local', 'ILS', true),
  ('00000000-0000-4000-8000-0000000000d3', 'persist-fail@synthetic.test', 'Synthetic Persist', 'Local', 'ILS', false)
ON CONFLICT (user_id) DO NOTHING;

SELECT tst.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.trial_reminder_deliveries'::regclass), 'LEDGER: RLS enabled');

SET ROLE service_role;

-- first claim wins, later claims while held get NULL
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-00000000000a', '3d') IS NOT NULL, 'CLAIM: first claim returns a claim');
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-00000000000a', '3d') IS NULL, 'CLAIM: a second claim while held returns NULL (no send)');
SELECT tst.ok((SELECT idempotency_key = 'trial-reminder/00000000-0000-4000-8000-00000000000a/3d/1' AND attempt = 1 AND status = 'claimed'
                 FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-00000000000a' AND stage = '3d'),
              'CLAIM: deterministic attempt-1 idempotency key, status claimed');
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-00000000000a', '24h') IS NOT NULL, 'CLAIM: stages are independent');

-- only the holder can complete
SELECT tst.ok(public.complete_trial_reminder('00000000-0000-4000-8000-00000000000a', '3d', gen_random_uuid(), 'sent', 'msg_x') = false,
              'COMPLETE: a non-holder completion is refused');
SELECT tst.ok((SELECT trial_reminder_3d_sent FROM public.business_settings WHERE user_id = '00000000-0000-4000-8000-00000000000a') IS NOT TRUE,
              'COMPLETE: the refused completion wrote no sent flag');
SELECT tst.ok(public.complete_trial_reminder('00000000-0000-4000-8000-00000000000a', '3d',
                (SELECT claim_id FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-00000000000a' AND stage = '3d'),
                'sent', 'msg_synthetic_1') = true,
              'COMPLETE: the holder records sent');
SELECT tst.ok((SELECT trial_reminder_3d_sent AND NOT coalesce(trial_reminder_24h_sent, false) FROM public.business_settings WHERE user_id = '00000000-0000-4000-8000-00000000000a'),
              'SENT: only the 3d flag is set, in the same transaction');
SELECT tst.ok((SELECT status = 'sent' AND sent_at IS NOT NULL AND provider_message_id = 'msg_synthetic_1' AND last_error IS NULL
                 FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-00000000000a' AND stage = '3d'),
              'SENT: ledger row sent with provider message id');
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-00000000000a', '3d') IS NULL, 'SENT: a sent stage is never claimed again');
SELECT tst.ok(public.complete_trial_reminder('00000000-0000-4000-8000-00000000000a', '3d',
                (SELECT claim_id FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-00000000000a' AND stage = '3d'),
                'sent') = false,
              'COMPLETE: a second completion of the same claim is refused');

-- definite failure -> re-claimable with a NEW key; no flag
SELECT tst.ok(public.complete_trial_reminder('00000000-0000-4000-8000-00000000000a', '24h',
                (SELECT claim_id FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-00000000000a' AND stage = '24h'),
                'failed', NULL, 'Resend 422: synthetic') = true,
              'FAILED: holder records a definite failure');
SELECT tst.ok((SELECT trial_reminder_24h_sent FROM public.business_settings WHERE user_id = '00000000-0000-4000-8000-00000000000a') IS NOT TRUE,
              'FAILED: no sent flag');
SELECT tst.ok((public.claim_trial_reminder('00000000-0000-4000-8000-00000000000a', '24h') ->> 'idempotency_key')
                = 'trial-reminder/00000000-0000-4000-8000-00000000000a/24h/2',
              'FAILED: retry is claimable with a NEW idempotency key (attempt 2)');

-- ambiguous outcome -> re-claimable with the SAME key while inside the key window; not after it
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-00000000000b', '3d') IS NOT NULL, 'UNKNOWN: claim');
SELECT tst.ok(public.complete_trial_reminder('00000000-0000-4000-8000-00000000000b', '3d',
                (SELECT claim_id FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-00000000000b' AND stage = '3d'),
                'unknown', NULL, 'Resend 503') = true,
              'UNKNOWN: holder records an ambiguous outcome');
SELECT tst.ok((public.claim_trial_reminder('00000000-0000-4000-8000-00000000000b', '3d') ->> 'idempotency_key')
                = 'trial-reminder/00000000-0000-4000-8000-00000000000b/3d/1',
              'UNKNOWN: retry inside the window reuses the SAME key (provider dedups)');
SELECT tst.ok(public.complete_trial_reminder('00000000-0000-4000-8000-00000000000b', '3d',
                (SELECT claim_id FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-00000000000b' AND stage = '3d'),
                'unknown', NULL, 'Resend 503 again') = true,
              'UNKNOWN: second ambiguous outcome recorded');
RESET ROLE;
UPDATE public.trial_reminder_deliveries SET key_first_used_at = now() - interval '24 hours'
 WHERE user_id = '00000000-0000-4000-8000-00000000000b' AND stage = '3d';
SET ROLE service_role;
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-00000000000b', '3d') IS NULL,
              'UNKNOWN: past the key window an ambiguous row is NOT re-sent automatically');

-- abandoned claim (worker died): re-claimable only after the lease, with the same key; the stale worker cannot complete
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-0000000000d1', '3d') IS NOT NULL, 'LEASE: claim');
CREATE TEMP TABLE IF NOT EXISTS stale_claim AS
  SELECT claim_id FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-0000000000d1' AND stage = '3d';
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-0000000000d1', '3d') IS NULL, 'LEASE: not re-claimable inside the lease');
RESET ROLE;
UPDATE public.trial_reminder_deliveries SET claimed_at = now() - interval '11 minutes'
 WHERE user_id = '00000000-0000-4000-8000-0000000000d1' AND stage = '3d';
GRANT SELECT ON stale_claim TO service_role;
SET ROLE service_role;
SELECT tst.ok((public.claim_trial_reminder('00000000-0000-4000-8000-0000000000d1', '3d') ->> 'idempotency_key')
                = 'trial-reminder/00000000-0000-4000-8000-0000000000d1/3d/1',
              'LEASE: after the lease the claim is taken over with the SAME key');
SELECT tst.ok(public.complete_trial_reminder('00000000-0000-4000-8000-0000000000d1', '3d', (SELECT claim_id FROM stale_claim), 'sent') = false,
              'LEASE: the stale worker''s late completion is refused');
SELECT tst.ok(public.complete_trial_reminder('00000000-0000-4000-8000-0000000000d1', '3d',
                (SELECT claim_id FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-0000000000d1' AND stage = '3d'),
                'sent', 'msg_synthetic_2') = true,
              'LEASE: the new holder completes');

-- legacy sent flag / missing account row -> never claimed, no ledger row
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-0000000000d2', '3d') IS NULL, 'LEGACY: a stage already flagged sent is not claimed');
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-0000000000d4', '3d') IS NULL, 'ACCOUNT: no business_settings row -> not claimed');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.trial_reminder_deliveries WHERE user_id IN ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000d4')),
              'LEGACY/ACCOUNT: no ledger row created');

-- invalid arguments raise
SELECT tst.throws($$SELECT public.claim_trial_reminder('00000000-0000-4000-8000-00000000000a', '7d')$$, 'invalid arguments', 'ARGS: unknown stage rejected');
SELECT tst.throws($$SELECT public.complete_trial_reminder('00000000-0000-4000-8000-00000000000a', '3d', gen_random_uuid(), 'maybe')$$, 'invalid arguments', 'ARGS: unknown outcome rejected');

-- post-send persistence failure: the account row cannot be updated -> the completion rolls back entirely, the claim stays open
SELECT tst.ok(public.claim_trial_reminder('00000000-0000-4000-8000-0000000000d3', '3d') IS NOT NULL, 'PERSIST: claim');
RESET ROLE;
DELETE FROM public.business_settings WHERE user_id = '00000000-0000-4000-8000-0000000000d3';
SET ROLE service_role;
DO $$
DECLARE v uuid;
BEGIN
  SELECT claim_id INTO v FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-0000000000d3' AND stage = '3d';
  PERFORM tst.throws(format($f$SELECT public.complete_trial_reminder('00000000-0000-4000-8000-0000000000d3', '3d', %L, 'sent')$f$, v),
                     'account row not updated', 'PERSIST: completing sent without an updatable account row raises');
END $$;
SELECT tst.ok((SELECT status = 'claimed' AND sent_at IS NULL FROM public.trial_reminder_deliveries
                WHERE user_id = '00000000-0000-4000-8000-0000000000d3' AND stage = '3d'),
              'PERSIST: the ledger update was rolled back (claim still open, not marked sent)');
RESET ROLE;

-- privileges: end users can neither read the ledger nor call the functions
SELECT tst.anon();
SELECT tst.throws($$SELECT count(*) FROM public.trial_reminder_deliveries$$, 'permission denied', 'ANON: cannot read the ledger');
SELECT tst.throws($$SELECT public.claim_trial_reminder('00000000-0000-4000-8000-00000000000b', '24h')$$, 'permission denied', 'ANON: cannot claim');
SELECT tst.throws($$SELECT public.complete_trial_reminder('00000000-0000-4000-8000-00000000000b', '24h', gen_random_uuid(), 'sent')$$, 'permission denied', 'ANON: cannot complete');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.throws($$SELECT count(*) FROM public.trial_reminder_deliveries$$, 'permission denied', 'AUTHENTICATED: cannot read the ledger');
SELECT tst.throws($$SELECT public.claim_trial_reminder('00000000-0000-4000-8000-00000000000b', '24h')$$, 'permission denied', 'AUTHENTICATED: cannot claim for itself');
SELECT tst.throws($$SELECT public.complete_trial_reminder('00000000-0000-4000-8000-00000000000b', '24h', gen_random_uuid(), 'sent')$$, 'permission denied', 'AUTHENTICATED: cannot mark itself sent');
SELECT tst.logout();

-- account deletion cascades the ledger rows
DELETE FROM public.business_settings WHERE user_id = '00000000-0000-4000-8000-0000000000d1';
DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-0000000000d1';
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.trial_reminder_deliveries WHERE user_id = '00000000-0000-4000-8000-0000000000d1'),
              'CASCADE: deleting the auth user removes its ledger rows');
