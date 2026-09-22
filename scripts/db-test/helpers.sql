-- Test helpers for the disposable DB harness. Assertions emit NOTICE lines "PASS: ..." / "FAIL: ..." that the runner collects.
CREATE SCHEMA IF NOT EXISTS tst;
GRANT USAGE ON SCHEMA tst TO anon, authenticated, service_role;

-- act as an authenticated end user (what PostgREST does per request)
CREATE OR REPLACE FUNCTION tst.login(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
  PERFORM set_config('role', 'authenticated', false);
END $$;
-- act as the anonymous public (no JWT subject)
CREATE OR REPLACE FUNCTION tst.anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  PERFORM set_config('role', 'anon', false);
END $$;
CREATE OR REPLACE FUNCTION tst.logout() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'none', false);
  PERFORM set_config('request.jwt.claims', '', false);
END $$;

CREATE OR REPLACE FUNCTION tst.ok(p_cond boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS TRUE THEN RAISE NOTICE 'PASS: %', p_label; ELSE RAISE NOTICE 'FAIL: % (got %)', p_label, coalesce(p_cond::text, 'NULL'); END IF;
END $$;

-- the statement must raise, with a message matching p_pattern (case-insensitive regex)
CREATE OR REPLACE FUNCTION tst.throws(p_sql text, p_pattern text, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~* p_pattern THEN RAISE NOTICE 'PASS: % [raised: %]', p_label, SQLERRM;
    ELSE RAISE NOTICE 'FAIL: % (raised "%", expected /%/)', p_label, SQLERRM, p_pattern; END IF;
    RETURN;
  END;
  RAISE NOTICE 'FAIL: % (did not raise, expected /%/)', p_label, p_pattern;
END $$;

-- the statement must succeed
CREATE OR REPLACE FUNCTION tst.lives(p_sql text, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE NOTICE 'PASS: %', p_label;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL: % (raised "%")', p_label, SQLERRM;
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated, service_role;

-- synthetic fixtures (disposable DB only): two tenants, one customer-with-own-account, fixed UUIDs
CREATE OR REPLACE FUNCTION tst.seed() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-4000-8000-00000000000a', 'issuer-a@synthetic.test'),
    ('00000000-0000-4000-8000-00000000000b', 'other-tenant-b@synthetic.test'),
    ('00000000-0000-4000-8000-00000000000c', 'plain-user-c@synthetic.test')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
  VALUES ('00000000-0000-4000-8000-00000000000a', 'issuer-a@synthetic.test', 'Synthetic Issuer A', 'Local', 'ILS'),
         ('00000000-0000-4000-8000-00000000000b', 'other-tenant-b@synthetic.test', 'Synthetic Tenant B', 'International', 'USD')
  ON CONFLICT (user_id) DO NOTHING;
END $$;
