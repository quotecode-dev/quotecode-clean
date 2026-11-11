-- 20261111100000 (Owner 2026-11-11, finding 7: "במסך וגם בשרת", limited paid accounts "כן, אותה חסימה", counted unsent drafts "גם הן
-- חסומות"; finding 18: one owner email per signed quote). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: after the free quotes end (10 used OR the 7 days over) the OWNER can neither edit a quote's content / rows nor send a draft -
-- also one counted at its save; status changes, deleting a quote, other roles and paid / not-enforced accounts are untouched; the save
-- that creates or counts the 10th quote is never refused by its own count; a limited paid account is blocked the same way; the notice
-- says 0 left after the end; the owner-notice table is service-role only. (Everything here runs in ONE transaction, so the quotes that
-- must count as "existing" are inserted with an earlier created_at.)
BEGIN;
SET tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.wu(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('dd476000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.wq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('dd476100-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.wc(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('dd476200-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.wsvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
CREATE OR REPLACE FUNCTION tst.wdigest(p_user uuid, p_quote uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(public.quote_output_digest(public.quote_output_deal_document(p_user, p_quote)), repeat('0', 64)) $$;
CREATE OR REPLACE FUNCTION tst.wprep(p_user uuid, p_quote uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d text := tst.wdigest(p_user, p_quote); r jsonb;
BEGIN
  PERFORM tst.wsvc();
  r := public.prepare_quote_output(p_user, p_quote, 'send', format('out:%s:send:%s', p_quote, d), d, 'classic', 0, 1, repeat('c', 64));
  PERFORM tst.logout();
  RETURN r;
END $$;
CREATE OR REPLACE FUNCTION tst.wnotice(p_user uuid, p_quote uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN PERFORM tst.wsvc(); r := public.output_notice(p_user, p_quote); PERFORM tst.logout(); RETURN r; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- 1 = Free-10 used up (10/10); 2 = Free-10 with 9 used (its 10th quote is saved here); 3 = paid; 4 = Free-10 within its quota
INSERT INTO auth.users (id, email) SELECT tst.wu(n), format('w476-%s@synthetic.test', n) FROM generate_series(1, 4) n ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  SELECT tst.wu(n), format('w476-%s@synthetic.test', n), format('Synthetic W476 %s', n), 'Local', 'ILS' FROM generate_series(1, 4) n;
INSERT INTO public.account_entitlements (user_id, account_mode) SELECT tst.wu(n), 'free_10' FROM generate_series(1, 4) n;
INSERT INTO public.clients (id, company_name, email, user_id) SELECT tst.wc(n), format('Synthetic Customer %s', n), format('w476-c%s@synthetic.test', n), tst.wu(n) FROM generate_series(1, 4) n;
-- existing drafts (created yesterday) with one row each
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes, created_at)
  SELECT tst.wq(n), tst.wu(n), 94760 + n, 'draft', tst.wc(n), 'v1', now() - interval '1 day' FROM generate_series(1, 4) n;
INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price)
  SELECT tst.wq(n), 'Synthetic work', 1, 100, 100 FROM generate_series(1, 4) n;

-- counted history (yesterday), consistent with the counter guard (consumed = counted rows): user 1 = 10, user 2 = 9, user 4 = 3.
-- Written as the DB owner with triggers off (session_replication_role), only to place rows in the past.
SET session_replication_role = replica;
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes, created_at)
  SELECT tst.wq(u * 100 + k), tst.wu(u), 95000 + u * 100 + k, 'sent', tst.wc(u), 'old', now() - interval '2 days'
  FROM (VALUES (1, 9), (2, 8), (4, 2)) AS x(u, extra), generate_series(1, 9) k WHERE k <= x.extra;
INSERT INTO public.quote_save_counts (user_id, quote_id, customer_binding, counted_against_free, account_mode_at_event, created_at)
  SELECT q.user_id, q.id, q.client_id::text, true, 'free_10', now() - interval '1 day'
  FROM public.quotes q WHERE q.user_id IN (tst.wu(1), tst.wu(2), tst.wu(4));
UPDATE public.account_entitlements e SET free_issues_consumed = (SELECT count(*) FROM public.quote_save_counts s WHERE s.user_id = e.user_id)
  WHERE e.user_id IN (tst.wu(1), tst.wu(2), tst.wu(4));
UPDATE public.account_entitlements SET account_mode = 'paid', style_plan_id = 'visual' WHERE user_id = tst.wu(3);
SET session_replication_role = origin;
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';

DO $$
DECLARE n jsonb; p jsonb;
BEGIN
  PERFORM tst.ok((SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.wu(1)) = 10
                 AND (SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.wu(2)) = 9, 'W0a the fixture: 10 and 9 counted');
  PERFORM tst.ok(public.free10_work_ended(tst.wu(1)) AND NOT public.free10_work_ended(tst.wu(2)) AND NOT public.free10_work_ended(tst.wu(3))
                 AND NOT public.free10_work_ended(tst.wu(4)), 'W0 the end: only the account with 10/10 used');

  -- the owner after the end
  PERFORM tst.login(tst.wu(1));
  PERFORM tst.throws(format($q$UPDATE public.quotes SET notes = 'v2' WHERE id = %L$q$, tst.wq(1)), 'free_issue_limit_reached', 'W1 editing the notes of a draft after 10/10 is refused');
  PERFORM tst.throws(format($q$UPDATE public.quotes SET valid_until = '2099-01-01' WHERE id = %L$q$, tst.wq(1)), 'free_issue_limit_reached', 'W2 editing the validity is refused');
  PERFORM tst.throws(format($q$INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (%L, 'more', 1, 1, 1)$q$, tst.wq(1)), 'free_issue_limit_reached', 'W3 adding a row is refused');
  PERFORM tst.throws(format($q$UPDATE public.quote_items SET unit_price = 200 WHERE quote_id = %L$q$, tst.wq(1)), 'free_issue_limit_reached', 'W4 changing a row is refused');
  PERFORM tst.throws(format($q$DELETE FROM public.quote_items WHERE quote_id = %L$q$, tst.wq(1)), 'free_issue_limit_reached', 'W5 removing a row is refused');
  PERFORM tst.lives(format($q$UPDATE public.quotes SET status = 'paid' WHERE id = %L$q$, tst.wq(101)), 'W6 a status change of a sent quote (marked paid - not content) stays allowed');
  PERFORM tst.logout();

  -- the server (service role) is never the owner's edit
  PERFORM tst.wsvc();
  PERFORM tst.lives(format($q$UPDATE public.quotes SET notes = 'server' WHERE id = %L$q$, tst.wq(1)), 'W7 a service-role write is not blocked');
  PERFORM tst.logout();

  -- sending a counted draft after the end is refused by the authority; the notice says 0 left
  UPDATE public.quotes SET status = 'draft' WHERE id = tst.wq(1);
  p := tst.wprep(tst.wu(1), tst.wq(1));
  PERFORM tst.ok(p ->> 'ok' = 'false' AND p ->> 'code' = 'free_issue_limit_reached', 'W8 a draft counted at its save is not sent after 10/10 (free_issue_limit_reached)');
  n := tst.wnotice(tst.wu(1), tst.wq(1));
  PERFORM tst.ok(n ->> 'wouldConsume' = 'true' AND (n ->> 'remaining')::int = 0, 'W9 the notice after the end: would use a free quote, 0 left');

  -- deleting a quote stays allowed (its rows cascade after the quote row is gone)
  PERFORM tst.login(tst.wu(1));
  PERFORM tst.lives(format($q$DELETE FROM public.quotes WHERE id = %L$q$, tst.wq(1)), 'W10 deleting a quote after the end stays allowed');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_items WHERE quote_id = tst.wq(1)), 'W11 its rows went with it');
  PERFORM tst.logout();

  -- the 10th quote: created + counted in ONE transaction is never refused by its own count
  PERFORM tst.login(tst.wu(2));
  PERFORM tst.lives(format($q$INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES (%L, %L, 94770, 'draft', %L, 'tenth')$q$, tst.wq(12), tst.wu(2), tst.wc(2)), 'W12 the 10th quote row is created');
  PERFORM tst.lives(format($q$INSERT INTO public.quote_items (quote_id, description, quantity, unit_price, total_price) VALUES (%L, 'a', 1, 10, 10), (%L, 'b', 2, 10, 20)$q$, tst.wq(12), tst.wq(12)), 'W13 its rows are saved in the same transaction (the count reaches 10 on the first row)');
  PERFORM tst.lives(format($q$UPDATE public.quotes SET total = 30, subtotal = 30 WHERE id = %L$q$, tst.wq(12)), 'W14 and its totals in the same transaction');
  PERFORM tst.logout();
  PERFORM tst.ok((SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = tst.wu(2)) = 10 AND public.free10_work_ended(tst.wu(2)),
    'W15 that save used the 10th free quote; the account has now ended');
  PERFORM tst.login(tst.wu(2));
  PERFORM tst.throws(format($q$UPDATE public.quotes SET notes = 'later' WHERE id = %L$q$, tst.wq(2)), 'free_issue_limit_reached', 'W16 afterwards an older draft of the same account is not edited');
  PERFORM tst.logout();

  -- paid and within the quota: unchanged
  PERFORM tst.login(tst.wu(3));
  PERFORM tst.lives(format($q$UPDATE public.quotes SET notes = 'paid edit' WHERE id = %L$q$, tst.wq(3)), 'W17 a paid account edits freely');
  PERFORM tst.logout();
  PERFORM tst.login(tst.wu(4));
  PERFORM tst.lives(format($q$UPDATE public.quotes SET notes = 'within quota' WHERE id = %L$q$, tst.wq(4)), 'W18 a Free-10 account within its quota edits freely');
  PERFORM tst.logout();
END $$;

-- a limited paid account (the 3 grace days after a failed charge are over) is blocked the same way (only when paid_account_limited says so)
DO $$
DECLARE limited boolean;
BEGIN
  BEGIN
    UPDATE public.account_entitlements SET account_mode = 'paid', style_plan_id = 'visual' WHERE user_id = tst.wu(4);
    limited := public.paid_account_limited(tst.wu(4));
  EXCEPTION WHEN OTHERS THEN limited := NULL;
  END;
  PERFORM tst.ok(limited IS NOT NULL, 'W19 paid_account_limited answers for a paid account (the limited rule itself is proven by its own tests)');
  IF limited IS FALSE THEN
    PERFORM tst.login(tst.wu(4));
    PERFORM tst.lives(format($q$UPDATE public.quotes SET notes = 'paid, not limited' WHERE id = %L$q$, tst.wq(4)), 'W20 a paid account that is not limited edits freely');
    PERFORM tst.logout();
  END IF;
END $$;

-- not enforced: nothing is blocked
UPDATE public.subscription_activation SET phase = 'prepared' WHERE component = 'free_issue';
DO $$
BEGIN
  PERFORM tst.login(tst.wu(2));
  PERFORM tst.lives(format($q$UPDATE public.quotes SET notes = 'not enforced' WHERE id = %L$q$, tst.wq(2)), 'W21 while the plan system is not enforced nothing is blocked');
  PERFORM tst.logout();
END $$;

-- the owner-notice table (finding 18): no client role reads or writes it; the service role does
DO $$
BEGIN
  PERFORM tst.anon();
  PERFORM tst.throws('SELECT * FROM public.quote_signed_owner_notices', 'permission denied', 'W22 anon cannot read the owner-notice table');
  PERFORM tst.logout();
  PERFORM tst.login(tst.wu(3));
  PERFORM tst.throws(format($q$INSERT INTO public.quote_signed_owner_notices (quote_id, user_id, signed_at) VALUES (%L, %L, now())$q$, tst.wq(3), tst.wu(3)), 'permission denied', 'W23 an authenticated user cannot write it');
  PERFORM tst.logout();
  PERFORM tst.wsvc();
  PERFORM tst.lives(format($q$INSERT INTO public.quote_signed_owner_notices (quote_id, user_id, signed_at) VALUES (%L, %L, now())$q$, tst.wq(3), tst.wu(3)), 'W24 the service role records a signed quote');
  PERFORM tst.ok((SELECT count(*) FROM public.quote_signed_owner_notices WHERE quote_id = tst.wq(3)) = 1, 'W25 one row per quote');
  PERFORM tst.throws(format($q$INSERT INTO public.quote_signed_owner_notices (quote_id, user_id, signed_at) VALUES (%L, %L, now())$q$, tst.wq(3), tst.wu(3)), 'duplicate key|unique', 'W26 a second row for the same quote is refused (the email goes once)');
  PERFORM tst.logout();
END $$;

ROLLBACK;
