-- Continuous work 30/10 (migration 20261031100000, Codex release 9: Maya, Omer, the manager chain). Disposable postgres:17 harness ONLY.
-- ONE transaction, rolled back. Proves: Maya's signals are real verified accounts only (never a marked test account, an unverified
-- address or a fresh registration), each with its own consent (default off - no retrospective consent) and suppression; the owner sets
-- only his own consent; the unsubscribe token withdraws only its purpose, suppresses by hash and stales the drafts, the same answer for
-- any token; one case per account and signal for ever; Omer's persona is a registered AND marked test account, and its quotes go only to
-- its own test mailbox; the chain is one per hour, never with email, one step at a time; nothing of it is open to the app.
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';
-- the harness stub of auth.users has no confirmation time; the real table has (rolled back with the rest)
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

CREATE OR REPLACE FUNCTION tst.nu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4480000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.nsvc(p_sql text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
  EXECUTE p_sql INTO r; PERFORM tst.logout(); RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.nsig(p_user uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT tst.nsvc(format($q$SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.customer_success_signals(%L) s$q$, p_user)) $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- 1 IL verified, 3 days old, no quote | 2 unverified | 3 a marked test account | 4 one day old | 5 international | 6 IL, 3 days, verified
INSERT INTO auth.users (id, email, created_at, email_confirmed_at) VALUES
  (tst.nu(1), 'n448-1@synthetic.test', now() - interval '3 days', now() - interval '3 days'),
  (tst.nu(2), 'n448-2@synthetic.test', now() - interval '3 days', NULL),
  (tst.nu(3), 'n448-3@synthetic.test', now() - interval '3 days', now() - interval '3 days'),
  (tst.nu(4), 'n448-4@synthetic.test', now() - interval '1 day', now() - interval '1 day'),
  (tst.nu(5), 'n448-5@synthetic.test', now() - interval '3 days', now() - interval '3 days'),
  (tst.nu(6), 'n448-6@synthetic.test', now() - interval '3 days', now() - interval '3 days');
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.nu(n), format('n448-%s@synthetic.test', n), format('Synthetic agents %s', n), CASE WHEN n = 5 THEN 'International' ELSE 'Local' END,
         CASE WHEN n = 5 THEN 'USD' ELSE 'ILS' END, 'free', 'user', false FROM generate_series(1, 6) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.nu(n), CASE WHEN n = 5 THEN 'INTERNATIONAL' ELSE 'IL' END, 'business_settings_country'
  FROM generate_series(1, 6) n ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed)
  SELECT tst.nu(n), 'free_10', NULL, 0 FROM generate_series(1, 6) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.admin_test_accounts (user_id, marked_by) VALUES (tst.nu(3), tst.nu(1));

-- ---------------------------------------------------------------------------------------------------- the signals
SELECT tst.ok((SELECT s ->> 'signal_code' = 'no_quote_onboarding' AND s ->> 'market' = 'IL' AND NOT (s ->> 'consent')::boolean AND NOT (s ->> 'suppressed')::boolean
  AND NOT (s ->> 'has_case')::boolean FROM jsonb_array_elements(tst.nsig(tst.nu(1))) s), 'N1 a verified account 3 days old with no quote is an onboarding signal - consent off by default');
SELECT tst.ok(jsonb_array_length(tst.nsig(tst.nu(2))) = 0, 'N2 an unverified address is never a signal');
SELECT tst.ok(jsonb_array_length(tst.nsig(tst.nu(3))) = 0, 'N3 a marked test account is never a signal');
SELECT tst.ok(jsonb_array_length(tst.nsig(tst.nu(4))) = 0, 'N4 a registration under 48 hours is not yet a signal');
SELECT tst.ok((SELECT s ->> 'market' = 'INTERNATIONAL' FROM jsonb_array_elements(tst.nsig(tst.nu(5))) s), 'N5 the international account keeps its own market');
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES ('a4481000-0000-4000-8000-000000000006', tst.nu(6), 44801, 'draft', 'ILS', 100);
SELECT tst.ok(jsonb_array_length(tst.nsig(tst.nu(6))) = 0, 'N6 an account that already made a quote is not an onboarding signal');

-- ---------------------------------------------------------------------------------------------------- the owner's own consent
SELECT tst.login(tst.nu(1));
SELECT tst.ok((public.account_outreach_get() ->> 'optionalHelp')::boolean = false, 'C1 the consent is off until the owner turns it on');
SELECT tst.ok((public.account_outreach_set(true) ->> 'optionalHelp')::boolean, 'C2 the owner turns on his own help emails');
SELECT tst.logout();
SELECT tst.ok((SELECT (s ->> 'consent')::boolean FROM jsonb_array_elements(tst.nsig(tst.nu(1))) s), 'C3 the signal now carries the consent');
SELECT tst.ok((SELECT provenance = 'settings' AND version = '2026-10-30' FROM public.account_outreach_preferences WHERE user_id = tst.nu(1)), 'C4 its source and version are kept');
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.account_outreach_set(true)$q$, 'permission denied', 'C5 the public cannot set a consent');
SELECT tst.logout();

-- ---------------------------------------------------------------------------------------------------- one case for ever
SELECT tst.nsvc(format($q$WITH x AS (INSERT INTO public.customer_success_cases (user_id, signal_code) VALUES (%L, 'no_quote_onboarding') RETURNING id) SELECT to_jsonb(x.id) FROM x$q$, tst.nu(1)));
SELECT tst.throws(format($q$SELECT tst.nsvc('INSERT INTO public.customer_success_cases (user_id, signal_code) VALUES (''%s'', ''no_quote_onboarding'') RETURNING to_jsonb(id)')$q$, tst.nu(1)),
  'unique|duplicate', 'L1 a second case for the same account and signal is refused - for ever');
SELECT tst.ok((SELECT (s ->> 'has_case')::boolean FROM jsonb_array_elements(tst.nsig(tst.nu(1))) s), 'L2 the signal shows the account was already handled');

-- ---------------------------------------------------------------------------------------------------- the unsubscribe link
SELECT set_config('tst.tok', tst.nsvc(format($q$SELECT to_jsonb(public.outreach_issue_token(%L))$q$, tst.nu(1))) #>> '{}', false);
SELECT tst.ok(current_setting('tst.tok') ~ '^[0-9a-f]{64}$', 'U1 a fresh token per send');
SELECT tst.ok((SELECT count(*) = 1 FROM public.outreach_unsubscribe_tokens WHERE user_id = tst.nu(1) AND token_hash = encode(sha256(convert_to(current_setting('tst.tok'), 'UTF8')), 'hex')),
  'U2 only its hash is stored');
-- review 30/10: a second email gets its own token - the first email's link keeps working
SELECT set_config('tst.tok2', tst.nsvc(format($q$SELECT to_jsonb(public.outreach_issue_token(%L))$q$, tst.nu(1))) #>> '{}', false);
SELECT tst.ok(current_setting('tst.tok2') <> current_setting('tst.tok') AND (SELECT count(*) = 2 FROM public.outreach_unsubscribe_tokens WHERE user_id = tst.nu(1)), 'U2b every email has its own link, none overwritten');
SELECT tst.ok((tst.nsvc(format($q$SELECT to_jsonb(public.customer_success_claim(id)) FROM public.customer_success_cases WHERE user_id = %L$q$, tst.nu(1))))::text = 'true', 'U2c an opted-in draft is claimed for sending (consent checked in the same statement)');
UPDATE public.customer_success_cases SET status = 'draft' WHERE user_id = tst.nu(1);
SELECT tst.ok(tst.nsvc(format($q$SELECT to_jsonb(public.outreach_issue_token(%L))$q$, tst.nu(5))) IS NULL, 'U3 no token for an account that never opted in');
SELECT tst.anon();
SELECT tst.ok(public.outreach_unsubscribe(repeat('f', 64)), 'U4 an unknown token gets the same answer (no account is revealed)');
SELECT tst.ok(public.outreach_unsubscribe('not-a-token'), 'U4b a malformed token too');
SELECT tst.ok(public.outreach_unsubscribe(current_setting('tst.tok')), 'U5 the FIRST email''s token still withdraws');
SELECT tst.logout();
SELECT tst.ok((SELECT NOT optional_help AND provenance = 'unsubscribe_link' FROM public.account_outreach_preferences WHERE user_id = tst.nu(1))
  AND NOT EXISTS (SELECT 1 FROM public.outreach_unsubscribe_tokens WHERE user_id = tst.nu(1)), 'U6 the consent is off, from the link, and every link of the owner is spent');
SELECT tst.ok((tst.nsvc(format($q$SELECT to_jsonb(public.customer_success_claim(id)) FROM public.customer_success_cases WHERE user_id = %L$q$, tst.nu(1))))::text = 'false', 'U6b a withdrawn owner is never claimed for sending');
SELECT tst.ok(tst.nsvc(format($q$SELECT to_jsonb(public.outreach_issue_token(%L))$q$, tst.nu(1))) IS NULL, 'U6c and gets no new token');
SELECT tst.ok(EXISTS (SELECT 1 FROM public.outreach_suppression WHERE email_hash = public.outreach_email_hash('N448-1@synthetic.test ')), 'U7 the address is suppressed by its hash only');
SELECT tst.ok((SELECT status = 'stale' FROM public.customer_success_cases WHERE user_id = tst.nu(1)), 'U8 the waiting draft became stale at once');
SELECT tst.ok((SELECT (s ->> 'suppressed')::boolean AND NOT (s ->> 'consent')::boolean FROM jsonb_array_elements(tst.nsig(tst.nu(1))) s), 'U9 the signal shows the withdrawal');
SELECT tst.login(tst.nu(1));
SELECT public.account_outreach_set(true);
SELECT tst.logout();
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.outreach_suppression WHERE email_hash = public.outreach_email_hash('n448-1@synthetic.test')), 'U10 a new opt-in by the owner lifts his own suppression');

-- ---------------------------------------------------------------------------------------------------- Omer's personas and the L-13 refusal
INSERT INTO public.live_check_personas (persona, user_id, recipient) VALUES ('il', tst.nu(3), 'omer-il@synthetic.test'), ('intl', tst.nu(5), 'omer-intl@synthetic.test');
SELECT tst.ok((tst.nsvc($q$SELECT public.live_check_persona('il')$q$) ->> 'userId')::uuid = tst.nu(3), 'P1 the Israel persona is a registered, marked test account');
SELECT tst.ok(tst.nsvc($q$SELECT public.live_check_persona('intl')$q$) IS NULL, 'P2 a registered persona that is NOT a marked test account gets no session');
SELECT tst.throws($q$INSERT INTO public.live_check_personas (persona, user_id, recipient) VALUES ('x', 'a4480000-0000-4000-8000-000000000004', 'a@b.test')$q$, 'check', 'P3 only the two personas exist');
-- review 30/10: never an admin session out of this door - a persona that became a supervisor gets nothing
INSERT INTO public.admin_permission_grants (user_id, permission) VALUES (tst.nu(3), 'overview.view');
SELECT tst.ok(tst.nsvc($q$SELECT public.live_check_persona('il')$q$) IS NULL, 'P3b a persona holding an admin permission gets no session');
DELETE FROM public.admin_permission_grants WHERE user_id = tst.nu(3);
SELECT tst.throws($q$UPDATE public.live_check_personas SET recipient = 'Omer@Synthetic.test' WHERE persona = 'il'$q$, 'check', 'P4 the test recipient is stored in its canonical form');
SELECT tst.ok((tst.nsvc(format($q$SELECT to_jsonb(public.live_check_recipient_allowed(%L, ' OMER-IL@synthetic.test'))$q$, tst.nu(3))))::text = 'true', 'P5 the persona emails its own test mailbox');
SELECT tst.ok((tst.nsvc(format($q$SELECT to_jsonb(public.live_check_recipient_allowed(%L, 'customer@real.example'))$q$, tst.nu(3))))::text = 'false', 'P6 and nobody else (refused, never redirected)');
SELECT tst.ok((tst.nsvc(format($q$SELECT to_jsonb(public.live_check_recipient_allowed(%L, 'customer@real.example'))$q$, tst.nu(1))))::text = 'true', 'P7 every other account is not affected');

-- ---------------------------------------------------------------------------------------------------- the agents and the chain
INSERT INTO public.agent_runs (agent, run_key, trigger, status, finished_at, data) VALUES
  ('live_check', 'cron:2026-10-30', 'cron', 'done', now() - interval '2 hours', '{"outcome":"inconclusive"}'),
  ('customer_success', 'daily:2026-10-30', 'cron', 'failed', now() - interval '1 hour', '{}');
SELECT tst.ok((SELECT r -> 'live_check' -> 'lastTerminal' ->> 'outcome' = 'inconclusive' AND r -> 'customer_success' -> 'lastTerminal' ->> 'status' = 'failed'
  FROM tst.nsvc('SELECT public.agents_latest_runs()') r), 'R1 the latest attempt per agent (an inconclusive check, a failed scan)');
SELECT tst.ok((SELECT count(*) = 2 FROM public.agent_profiles WHERE (agent, name_he, name_en) IN (('customer_success', 'מאיה', 'Maya'), ('live_check', 'עומר', 'Omer'))), 'R2 Maya and Omer have their names');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('x', 'customer_success', 'auto', 'outreach_draft', 'a', 'b')$q$,
  'check', 'R3 a help email is never an automatic action');
INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('x', 'customer_success', 'system', 'outreach_draft', 'a', 'b');
SELECT tst.ok(true, 'R3b it waits for the Owner (a system action)');
SELECT tst.ok(EXISTS (SELECT 1 FROM public.scheduled_jobs WHERE job = 'live-check' AND final_slot = '05:17'), 'R4 the watcher expects the daily LIVE check');

SELECT set_config('tst.chain', tst.nsvc(format($q$WITH x AS (INSERT INTO public.agent_chains (hour_key, created_by) VALUES ('chain:2026-10-30T09', %L) RETURNING id) SELECT to_jsonb(x.id) FROM x$q$, tst.nu(1))) #>> '{}', false);
SELECT tst.throws(format($q$SELECT tst.nsvc('INSERT INTO public.agent_chains (hour_key, created_by) VALUES (''chain:2026-10-30T09'', ''%s'') RETURNING to_jsonb(id)')$q$, tst.nu(1)), 'unique|duplicate', 'H1 one chain per hour');
SELECT tst.throws(format($q$SELECT tst.nsvc('INSERT INTO public.agent_chains (hour_key, created_by, allow_email) VALUES (''chain:x'', ''%s'', true) RETURNING to_jsonb(id)')$q$, tst.nu(1)), 'check', 'H2 a chain can never allow email');
SELECT tst.ok(tst.nsvc(format($q$SELECT public.agents_chain_lease(%L, 60)$q$, current_setting('tst.chain'))) ->> 'id' = current_setting('tst.chain'), 'H3 the first call takes the step');
SELECT tst.ok(tst.nsvc(format($q$SELECT public.agents_chain_lease(%L, 60)$q$, current_setting('tst.chain'))) IS NULL, 'H4 a second call meanwhile waits (no step runs twice)');
UPDATE public.agent_chains SET lease_until = now() - interval '1 second' WHERE id = current_setting('tst.chain')::uuid;
SELECT tst.ok(tst.nsvc(format($q$SELECT public.agents_chain_lease(%L, 60)$q$, current_setting('tst.chain'))) IS NOT NULL, 'H5 an expired lease is taken again (a closed tab does not block)');

-- ---------------------------------------------------------------------------------------------------- closed to the app
SELECT tst.login(tst.nu(1));
SELECT tst.throws($q$SELECT count(*) FROM public.customer_success_cases$q$, 'permission denied', 'G1 a signed-in user cannot read the cases');
SELECT tst.throws($q$SELECT count(*) FROM public.customer_success_signals()$q$, 'permission denied', 'G2 nor the signals');
SELECT tst.throws($q$SELECT public.outreach_issue_token('a4480000-0000-4000-8000-000000000001')$q$, 'permission denied', 'G3 nor issue a token');
SELECT tst.throws($q$SELECT count(*) FROM public.live_check_personas$q$, 'permission denied', 'G4 nor see the personas');
SELECT tst.throws($q$SELECT public.live_check_persona('il')$q$, 'permission denied', 'G5 nor ask for a persona');
SELECT tst.throws($q$SELECT count(*) FROM public.agent_chains$q$, 'permission denied', 'G6 nor read the chains');
SELECT tst.throws($q$SELECT count(*) FROM public.outreach_unsubscribe_tokens$q$, 'permission denied', 'G7 nor the unsubscribe tokens');
SELECT tst.throws($q$SELECT public.customer_success_claim('a4480000-0000-4000-8000-000000000001')$q$, 'permission denied', 'G8 nor claim a send');
SELECT tst.logout();

ROLLBACK;
