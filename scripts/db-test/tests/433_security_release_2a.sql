-- Codex release 2a (Owner 2026-10-29, migration 20261030000000): SEC-DB-05, SEC-DB-02, SEC-AI-01.
-- Disposable postgres:17 harness ONLY. Proves: a new or changed Auth user whose email equals another business's contact email moves
-- nothing; a quote can never point at another owner's client (insert, update, null owner, service role); a client of quotes cannot move to
-- another owner; ordinary same-tenant writes and clientless Drafts still work; the canonical document never shows a foreign client; the
-- public smart-answer pool gives exactly 500 attempts per UTC day and is reachable only through its service-only function.
-- The WHOLE file runs in ONE transaction that is rolled back at the end.
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';

CREATE OR REPLACE FUNCTION tst.su(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4330000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.sc(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4331000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.sq(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT format('a4332000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $$;
CREATE OR REPLACE FUNCTION tst.ssvc() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  PERFORM set_config('role', 'service_role', false);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- --------------------------------------------------------------------------------------------------------------------- fixtures
-- 1 the victim business (contact email victim@business.test) | 2 another tenant
INSERT INTO auth.users (id, email) VALUES (tst.su(1), 's433-owner1@synthetic.test'), (tst.su(2), 's433-owner2@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role) VALUES
  (tst.su(1), 's433-victim@business.test', 'Synthetic Victim', 'Local', 'ILS', 'free', 'user'),
  (tst.su(2), 's433-owner2@synthetic.test', 'Synthetic Other', 'International', 'USD', 'free', 'user') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.clients (id, company_name, email, user_id) VALUES
  (tst.sc(1), 'Synthetic Client One', 's433-c1@synthetic.test', tst.su(1)),
  (tst.sc(2), 'Synthetic Client Two', 's433-c2@synthetic.test', tst.su(2));
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES (tst.sq(1), tst.su(1), 43301, 'draft', tst.sc(1), 'sec');

-- ----------------------------------------------------------------------------------------------------------- S1. SEC-DB-05
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_migration' AND tgrelid = 'auth.users'::regclass),
  'S1 the email-matching Auth trigger is gone');
INSERT INTO auth.users (id, email) VALUES (tst.su(9), 's433-victim@business.test');
SELECT tst.ok((SELECT user_id FROM public.business_settings WHERE email = 's433-victim@business.test') = tst.su(1)
          AND (SELECT user_id FROM public.clients WHERE id = tst.sc(1)) = tst.su(1)
          AND (SELECT user_id FROM public.quotes WHERE id = tst.sq(1)) = tst.su(1),
  'S1b a NEW Auth user with the business contact email takes nothing (settings, clients, quotes stay with their owner)');
UPDATE auth.users SET email = 's433-victim@business.test' WHERE id = tst.su(2);
SELECT tst.ok((SELECT user_id FROM public.business_settings WHERE email = 's433-victim@business.test') = tst.su(1)
          AND (SELECT count(*) FROM public.quotes WHERE user_id = tst.su(2)) = 0,
  'S1c an Auth email CHANGE to that address takes nothing either');
SELECT tst.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=public, pg_temp'] FROM pg_proc WHERE oid = 'public.handle_user_migration()'::regprocedure)
          AND NOT has_function_privilege('authenticated', 'public.handle_user_migration()', 'EXECUTE'),
  'S1d the inert function keeps its search_path and EXECUTE hardening');

-- ----------------------------------------------------------------------------------------------------------- S2. SEC-DB-02
SELECT tst.throws(format('INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES (%L, %L, 43302, %L, %L)', tst.sq(2), tst.su(2), 'draft', tst.sc(1)),
  'client_tenant_mismatch', 'S2 a quote of owner B pointing at owner A''s client is refused');
SELECT tst.throws(format('INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES (%L, NULL, 43303, %L, %L)', tst.sq(3), 'draft', tst.sc(1)),
  'client_tenant_mismatch', 'S2b a quote with a client and no owner is refused');
SELECT tst.throws(format('UPDATE public.quotes SET client_id = %L WHERE id = %L', tst.sc(2), tst.sq(1)),
  'client_tenant_mismatch', 'S2c moving an existing quote to a foreign client is refused');
SELECT tst.throws(format('UPDATE public.quotes SET user_id = %L WHERE id = %L', tst.su(2), tst.sq(1)),
  'client_tenant_mismatch', 'S2d moving a quote to another owner while it keeps its client is refused');
DO $$ BEGIN
  PERFORM tst.ssvc();
  BEGIN
    INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES (tst.sq(4), tst.su(2), 43304, 'draft', tst.sc(1));
    PERFORM tst.ok(false, 'S2e the service role is refused too');
  EXCEPTION WHEN OTHERS THEN
    PERFORM tst.ok(SQLERRM LIKE 'client_tenant_mismatch%', 'S2e the service role is refused too');
  END;
  PERFORM tst.logout();
END $$;
SELECT tst.lives(format('INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES (%L, %L, 43305, %L, %L)', tst.sq(5), tst.su(2), 'draft', tst.sc(2)),
  'S2f a same-tenant quote is saved normally');
SELECT tst.lives(format('INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES (%L, %L, 43306, %L)', tst.sq(6), tst.su(2), 'draft'),
  'S2g a clientless Draft is still saved');
SELECT tst.lives(format('UPDATE public.quotes SET notes = %L WHERE id = %L', 'edited', tst.sq(1)), 'S2h editing other fields of a quote is unchanged');
SELECT tst.throws(format('UPDATE public.clients SET user_id = %L WHERE id = %L', tst.su(2), tst.sc(1)),
  'client_tenant_mismatch', 'S2i a client of quotes cannot move to another owner');
SELECT tst.lives(format('DELETE FROM public.clients WHERE id = %L', tst.sc(2)), 'S2j deleting a client still cascades as before');
SELECT tst.ok(NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = tst.sq(5)), 'S2k its quotes went with it (the existing ON DELETE CASCADE)');
-- a historical cross-tenant row (made by a DB-owner device): the canonical document never shows the foreign client
DO $$ BEGIN
  INSERT INTO public.clients (id, company_name, email, user_id) VALUES (tst.sc(3), 'Synthetic Foreign', 's433-c3@synthetic.test', tst.su(2));
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES (tst.sq(7), tst.su(1), 43307, 'draft', tst.sc(3));
  PERFORM set_config('session_replication_role', 'origin', true);
  PERFORM tst.ok(public.quote_output_deal_document(tst.su(1), tst.sq(7)) -> 'customer' = 'null'::jsonb
                 AND public.quote_output_deal_document(tst.su(1), tst.sq(1)) -> 'customer' ->> 'company_name' = 'Synthetic Client One',
    'S2l the canonical document reads a client only of the same tenant (a historical foreign link shows no customer)');
END $$;

-- ----------------------------------------------------------------------------------------------------------- S3. SEC-AI-01
SELECT tst.ok(NOT has_function_privilege('anon', 'public.chat_ai_public_reserve()', 'EXECUTE')
          AND NOT has_function_privilege('authenticated', 'public.chat_ai_public_reserve()', 'EXECUTE')
          AND has_function_privilege('service_role', 'public.chat_ai_public_reserve()', 'EXECUTE')
          AND NOT has_table_privilege('service_role', 'public.chat_ai_public_pool', 'SELECT')
          AND NOT has_table_privilege('anon', 'public.chat_ai_public_pool', 'SELECT')
          AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.chat_ai_public_pool'::regclass),
  'S3 the pool is reachable only through the service-only function (no direct table access, RLS on)');
DO $$
DECLARE r jsonb; n int := 0; refused int := 0;
BEGIN
  PERFORM tst.ssvc();
  FOR i IN 1..502 LOOP
    r := public.chat_ai_public_reserve();
    IF (r ->> 'allowed')::boolean THEN n := n + 1; ELSE refused := refused + 1; END IF;
  END LOOP;
  PERFORM tst.logout();
  PERFORM tst.ok(n = 500 AND refused = 2 AND r = '{"allowed":false,"limit":500}'::jsonb,
    format('S3b exactly 500 attempts a UTC day, then refused (allowed %s, refused %s)', n, refused));
  PERFORM tst.ok((SELECT used FROM public.chat_ai_public_pool WHERE day = (now() AT TIME ZONE 'UTC')::date) = 500,
    'S3c the counter stops at the limit (a refusal never counts)');
  -- the next UTC day starts a new pool
  UPDATE public.chat_ai_public_pool SET day = day - 1;
  PERFORM tst.ssvc();
  r := public.chat_ai_public_reserve();
  PERFORM tst.logout();
  PERFORM tst.ok((r ->> 'allowed')::boolean AND (r ->> 'used')::int = 1, 'S3d a new UTC day starts a new pool of 500');
END $$;

ROLLBACK;
