-- Owner console 2026-11-02 (stage 2, migration 20261102040000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: who gets the welcome and the free-ending email, once; an old account gets no welcome; closed to the app.
BEGIN;
SELECT tst.seed();
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
CREATE OR REPLACE FUNCTION tst.du(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('c4600000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.dk(n integer) RETURNS text LANGUAGE sql AS $$ SELECT coalesce(string_agg(kind, ',' ORDER BY kind), '') FROM public.customer_notice_lifecycle_facts(tst.du(n)) $$;

-- 1 new, plenty left | 2 old, plenty left | 3 old, 1 quote left | 4 old, 2 hours left | 5 unverified new | 6 lifetime new, 1 left | 7 international new | 8 old, nothing left
INSERT INTO auth.users (id, email, created_at, email_confirmed_at)
  SELECT tst.du(n), format('d460-%s@synthetic.test', n), CASE WHEN n IN (1, 5, 6, 7) THEN now() ELSE now() - interval '3 days' END, CASE WHEN n = 5 THEN NULL ELSE now() END FROM generate_series(1, 8) n;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  SELECT tst.du(n), format('d460-%s@synthetic.test', n), format('Synthetic stage2 %s', n), CASE WHEN n = 7 THEN 'International' ELSE 'Local' END,
         CASE WHEN n = 7 THEN 'USD' ELSE 'ILS' END, 'free', 'user', n = 6 FROM generate_series(1, 8) n ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) SELECT tst.du(n), CASE WHEN n = 7 THEN 'INTERNATIONAL' ELSE 'IL' END, 'business_settings_country'
  FROM generate_series(1, 8) n ON CONFLICT (user_id) DO UPDATE SET market = EXCLUDED.market, source = EXCLUDED.source;
DELETE FROM public.account_entitlements WHERE user_id IN (SELECT tst.du(n) FROM generate_series(1, 8) n);
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
-- the window is stamped by the server only; this harness sets it directly to reach each moment
SET LOCAL session_replication_role = replica;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, free_issues_consumed, free_window_starts_at)
  SELECT tst.du(n), 'free_10', NULL, CASE WHEN n IN (3, 6) THEN 9 WHEN n = 8 THEN 10 ELSE 0 END,
         CASE WHEN n = 4 THEN now() - interval '166 hours' ELSE now() - interval '1 hour' END FROM generate_series(1, 8) n;
SET LOCAL session_replication_role = origin;

SELECT tst.ok(tst.dk(1) = '', 'S0 before live nothing goes');
UPDATE public.customer_notice_settings SET phase = 'live', live_since = now() - interval '1 hour';
SELECT tst.ok(tst.dk(1) = 'welcome', 'S1 a new account gets the welcome');
SELECT tst.ok(tst.dk(2) = '', 'S2 an old account with plenty left gets nothing');
SELECT tst.ok(tst.dk(3) = 'free_ending', 'S3 one quote left');
SELECT tst.ok(tst.dk(4) = 'free_ending', 'S4 hours left of the 7 days');
SELECT tst.ok(tst.dk(5) = '', 'S5 an unverified address gets nothing');
SELECT tst.ok(tst.dk(6) = '', 'S6 a lifetime account gets nothing');
SELECT tst.ok((SELECT market = 'INTERNATIONAL' FROM public.customer_notice_lifecycle_facts(tst.du(7)) LIMIT 1), 'S7 the stored market');
SELECT tst.ok(tst.dk(8) = '', 'S8 nothing left is not "ending"');
DO $$
DECLARE v_at timestamptz;
BEGIN
  SELECT episode_at INTO v_at FROM public.customer_notice_lifecycle_facts(tst.du(3));
  PERFORM public.customer_notice_claim(tst.du(3), 'free_ending', v_at, 0, 'customer-notice/s1');
  PERFORM public.customer_notice_complete(tst.du(3), 'free_ending', v_at, 0, 'customer-notice/s1', 'sent');
  PERFORM tst.ok(tst.dk(3) = '', 'S9 once only');
END $$;
SELECT tst.ok(NOT has_function_privilege('authenticated', 'public.customer_notice_lifecycle_facts(uuid)', 'EXECUTE'), 'S10 closed to a user');
SELECT tst.ok(NOT has_function_privilege('anon', 'public.customer_notice_lifecycle_facts(uuid)', 'EXECUTE'), 'S11 closed to the public');

ROLLBACK;
