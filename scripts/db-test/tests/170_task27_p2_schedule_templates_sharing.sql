-- Task 27 P2: quote service schedule / whole-quote templates / manual sharing defaults (20261011110000). Disposable postgres:17 harness ONLY.
-- ONE transaction, rolled back at the end. Proves for each table: RLS enabled AND forced, authenticated-only owner policies, no anon access,
-- trigger-owned timestamps, immutable owner; plus the per-table rules (schedule only on the owner's own quote, date range / whole minutes;
-- template sanitization of customer / identity / status / signature / payment / number / link / date keys, size bound, unique name;
-- share text bounds, https-only website, opt-in website needs a URL).
BEGIN;
SELECT tst.seed();
INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES
  ('ec000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 97001, 'draft'),
  ('ec000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 97002, 'draft');

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['quote_service_schedule', 'quote_templates', 'business_share_defaults'] LOOP
    PERFORM tst.ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = format('public.%I', t)::regclass), format('R1 RLS enabled and forced on %s', t));
    PERFORM tst.ok((SELECT pg_catalog.count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t) = 4, format('R2 exactly four policies on %s', t));
    PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND roles::text[] <> ARRAY['authenticated']), format('R3 %s policies are authenticated-only', t));
    PERFORM tst.ok(NOT has_table_privilege('anon', format('public.%I', t), 'select') AND NOT has_table_privilege('anon', format('public.%I', t), 'insert')
      AND NOT has_table_privilege('anon', format('public.%I', t), 'update') AND NOT has_table_privilege('anon', format('public.%I', t), 'delete'), format('R4 anon has no privilege on %s', t));
  END LOOP;
  PERFORM tst.ok(NOT has_function_privilege('authenticated', 'public.quote_service_schedule_guard()', 'execute')
    AND NOT has_function_privilege('authenticated', 'public.quote_templates_guard()', 'execute')
    AND NOT has_function_privilege('authenticated', 'public.business_share_defaults_guard()', 'execute'), 'R5 guard functions are not callable by clients');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- 1. service schedule
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE v public.quote_service_schedule;
BEGIN
  INSERT INTO public.quote_service_schedule (quote_id, service_date) VALUES ('ec000000-0000-4000-8000-00000000000a', DATE '2026-11-02') RETURNING * INTO v;
  PERFORM tst.ok(v.user_id = '00000000-0000-4000-8000-00000000000a' AND v.service_time IS NULL, 'S1 owner sets a work date; time optional; owner defaults to auth.uid()');
  UPDATE public.quote_service_schedule SET service_time = TIME '08:30', created_at = '2000-01-01' RETURNING * INTO v;
  PERFORM tst.ok(v.service_time = TIME '08:30' AND v.created_at > '2020-01-01', 'S2 owner adds a time; created_at is immutable');
END $$;
SELECT tst.throws($q$INSERT INTO public.quote_service_schedule (quote_id, service_date) VALUES ('ec000000-0000-4000-8000-00000000000a', DATE '2026-11-03')$q$, 'quote_service_schedule_pkey', 'S3 one schedule per quote');
SELECT tst.throws($q$INSERT INTO public.quote_service_schedule (quote_id, service_date) VALUES ('ec000000-0000-4000-8000-00000000000b', DATE '2026-11-03')$q$, 'TK_SCHEDULE_FOREIGN_QUOTE', 'S4 A cannot schedule B''s quote');
SELECT tst.throws($q$INSERT INTO public.quote_service_schedule (quote_id, user_id, service_date) VALUES ('ec000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', DATE '2026-11-03')$q$, 'TK_SCHEDULE_FOREIGN_QUOTE|row-level security', 'S5 A cannot plant a row owned by B (B''s quote is invisible to A)');
SELECT tst.throws($q$UPDATE public.quote_service_schedule SET service_time = TIME '08:30:15'$q$, 'quote_service_schedule_minute', 'S6 time is whole minutes');
SELECT tst.throws($q$UPDATE public.quote_service_schedule SET service_date = DATE '1999-12-31'$q$, 'quote_service_schedule_date_range', 'S7 date range bounded');
SELECT tst.throws($q$UPDATE public.quote_service_schedule SET quote_id = 'ec000000-0000-4000-8000-00000000000b'$q$, 'TK_SCHEDULE_IMMUTABLE', 'S8 quote of a schedule never changes');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
BEGIN
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM public.quote_service_schedule) = 0, 'S9 B does not see A''s schedule');
  UPDATE public.quote_service_schedule SET service_date = DATE '2026-12-01';
  DELETE FROM public.quote_service_schedule;
END $$;
SELECT tst.logout();
DO $$
BEGIN
  PERFORM tst.ok((SELECT service_date FROM public.quote_service_schedule WHERE quote_id = 'ec000000-0000-4000-8000-00000000000a') = DATE '2026-11-02', 'S10 B cannot change or delete A''s schedule');
  DELETE FROM public.quotes WHERE id = 'ec000000-0000-4000-8000-00000000000a';
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM public.quote_service_schedule WHERE quote_id = 'ec000000-0000-4000-8000-00000000000a'), 'S11 deleting the quote removes its schedule');
END $$;

-- ---------------------------------------------------------------------------------------------------------------- 2. templates
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE v public.quote_templates;
BEGIN
  INSERT INTO public.quote_templates (name, content) VALUES ('Synthetic bathroom', '{"schema":"quote-template/v1","items":[{"description":"Tiles","unit":"m2","unit_price":120}],"notes":"Warranty 12 months"}')
    RETURNING * INTO v;
  PERFORM tst.ok(v.user_id = '00000000-0000-4000-8000-00000000000a' AND v.content -> 'items' -> 0 ->> 'unit' = 'm2', 'T1 owner saves a template with items / units / prices / texts');
END $$;
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('Synthetic bathroom', '{"schema":"quote-template/v1"}')$q$, 'quote_templates_owner_name', 'T2 template names are unique per owner');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('x1', '{"schema":"quote-template/v1","client_name":"Synthetic Customer"}')$q$, 'quote_templates_content_sanitized', 'T3 a customer name is refused');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('x2', '{"schema":"quote-template/v1","signature":"data:x"}')$q$, 'quote_templates_content_sanitized', 'T4 a signature is refused');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('x3', '{"schema":"quote-template/v1","quote_number":97001}')$q$, 'quote_templates_content_sanitized', 'T5 a quote number is refused');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('x4', '{"schema":"quote-template/v1","status":"approved"}')$q$, 'quote_templates_content_sanitized', 'T6 a status is refused');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('x5', '{"schema":"quote-template/v1","public_token":"t"}')$q$, 'quote_templates_content_sanitized', 'T7 a public link is refused');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('x6', '{"schema":"quote-template/v1","valid_until":"2026-12-01"}')$q$, 'quote_templates_content_sanitized', 'T8 a date is refused');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('x7', '{"schema":"quote-template/v1","payment":{}}')$q$, 'quote_templates_content_sanitized', 'T9 payment data is refused');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('x8', '{"items":[]}')$q$, 'quote_templates_content_object', 'T10 an unversioned content is refused');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES (' padded ', '{"schema":"quote-template/v1"}')$q$, 'quote_templates_name_check', 'T11 untrimmed name refused');
SELECT tst.throws($q$INSERT INTO public.quote_templates (name, content) VALUES ('big', jsonb_build_object('schema', 'quote-template/v1', 'notes', (SELECT string_agg(md5(i::text), '') FROM generate_series(1, 9000) i)))$q$, 'quote_templates_content_size', 'T12 oversized content refused');
SELECT tst.throws($q$UPDATE public.quote_templates SET user_id = '00000000-0000-4000-8000-00000000000b'$q$, 'TK_TEMPLATE_OWNER_IMMUTABLE', 'T13 owner of a template never changes');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
BEGIN
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM public.quote_templates) = 0, 'T14 B does not see A''s templates');
  INSERT INTO public.quote_templates (name, content) VALUES ('Synthetic bathroom', '{"schema":"quote-template/v1"}');
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM public.quote_templates) = 1, 'T15 the same name is allowed for another owner');
END $$;
SELECT tst.logout();

-- ---------------------------------------------------------------------------------------------------------------- 3. share defaults
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE v public.business_share_defaults;
BEGIN
  INSERT INTO public.business_share_defaults (share_text) VALUES ('Hello {customer}, here is your quote') RETURNING * INTO v;
  PERFORM tst.ok(v.user_id = '00000000-0000-4000-8000-00000000000a' AND NOT v.show_website_after_signature AND v.thanks_text IS NULL, 'H1 defaults: website opt-in is off, no thanks text');
  UPDATE public.business_share_defaults SET thanks_text = 'Thank you!', website_url = 'https://example.test', show_website_after_signature = true RETURNING * INTO v;
  PERFORM tst.ok(v.show_website_after_signature AND v.website_url = 'https://example.test', 'H2 owner opts in to a website link');
END $$;
SELECT tst.throws($q$UPDATE public.business_share_defaults SET website_url = 'http://example.test'$q$, 'business_share_defaults_website', 'H3 only https websites');
SELECT tst.throws($q$UPDATE public.business_share_defaults SET website_url = 'javascript:alert(1)'$q$, 'business_share_defaults_website', 'H4 a script URL refused');
SELECT tst.throws($q$UPDATE public.business_share_defaults SET website_url = NULL$q$, 'business_share_defaults_website_optin', 'H5 opt-in website needs a URL');
SELECT tst.throws($q$UPDATE public.business_share_defaults SET thanks_text = repeat('x', 301)$q$, 'business_share_defaults_thanks_text', 'H6 thanks text bounded');
SELECT tst.throws($q$UPDATE public.business_share_defaults SET share_text = ''$q$, 'business_share_defaults_share_text', 'H7 empty share text refused (store NULL)');
SELECT tst.throws($q$INSERT INTO public.business_share_defaults (user_id) VALUES ('00000000-0000-4000-8000-00000000000b')$q$, 'row-level security', 'H8 A cannot plant B''s defaults');
SELECT tst.throws($q$UPDATE public.business_share_defaults SET user_id = '00000000-0000-4000-8000-00000000000b'$q$, 'TK_SHARE_DEFAULTS_OWNER_IMMUTABLE', 'H9 owner never changes');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
SELECT tst.ok((SELECT pg_catalog.count(*) FROM public.business_share_defaults) = 0, 'H10 B does not see A''s defaults');
SELECT tst.logout();

SELECT tst.anon();
SELECT tst.throws($q$SELECT * FROM public.quote_service_schedule$q$, 'permission denied', 'A1 anon cannot read schedules');
SELECT tst.throws($q$SELECT * FROM public.quote_templates$q$, 'permission denied', 'A2 anon cannot read templates');
SELECT tst.throws($q$SELECT * FROM public.business_share_defaults$q$, 'permission denied', 'A3 anon cannot read share defaults');
SELECT tst.logout();

ROLLBACK;
