-- Task 24: digital business card profile (20261011000000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back at the end.
-- Proves: owner-only CRUD under FORCED RLS; no anon access; one row per owner; every publish flag defaults to false (opt-in); bounded
-- trimmed text, the closed style list and the photo rule (https or inline PNG/JPEG/WebP); trigger-owned timestamps; immutable owner;
-- owner deletion removes the card (cascade).
BEGIN;
SELECT tst.seed();

DO $$
BEGIN
  PERFORM tst.ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.business_cards'::regclass), 'RLS enabled and forced on public.business_cards');
  PERFORM tst.ok((SELECT pg_catalog.count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_cards') = 4, 'exactly four policies');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'business_cards' AND roles::text[] <> ARRAY['authenticated']), 'every policy is for authenticated only');
  PERFORM tst.ok(NOT has_table_privilege('anon', 'public.business_cards', 'select') AND NOT has_table_privilege('anon', 'public.business_cards', 'insert')
    AND NOT has_table_privilege('anon', 'public.business_cards', 'update') AND NOT has_table_privilege('anon', 'public.business_cards', 'delete'), 'anon has no table privilege');
  PERFORM tst.ok(NOT has_function_privilege('anon', 'public.business_cards_guard_row()', 'execute') AND NOT has_function_privilege('authenticated', 'public.business_cards_guard_row()', 'execute'), 'trigger function not executable by anon / authenticated');
  PERFORM tst.ok(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'business_cards' AND column_name IN ('tax_id', 'plan', 'role', 'email', 'phone', 'address')), 'no private / duplicated business_settings column is copied into the card table');
END $$;

-- owner A: create with defaults, edit, read back
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
DO $$
DECLARE v_row public.business_cards; v_n int;
BEGIN
  INSERT INTO public.business_cards (display_name) VALUES ('Synthetic Card A') RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.user_id = '00000000-0000-4000-8000-00000000000a', 'user_id defaults to auth.uid()');
  PERFORM tst.ok(NOT v_row.show_phone AND NOT v_row.show_whatsapp AND NOT v_row.show_email AND NOT v_row.show_address, 'every channel is unpublished until the owner opts in');
  PERFORM tst.ok(v_row.style = 'classic' AND v_row.created_at IS NOT NULL AND v_row.updated_at IS NOT NULL, 'style defaults to classic; timestamps set');
  UPDATE public.business_cards SET job_title = 'Installer', slogan = 'Windows that fit', about = 'Family business since 2010.', show_phone = true, style = 'visual',
    photo_url = 'data:image/png;base64,iVBORw0KGgo=', created_at = '2000-01-01T00:00:00Z' RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.style = 'visual' AND v_row.show_phone AND v_row.job_title = 'Installer', 'owner edits fields, a publish flag and the style');
  PERFORM tst.ok(v_row.created_at > '2020-01-01T00:00:00Z', 'created_at is immutable');
  UPDATE public.business_cards SET photo_url = 'https://example.test/photo.jpg' RETURNING * INTO v_row;
  PERFORM tst.ok(v_row.photo_url = 'https://example.test/photo.jpg', 'an https photo URL is accepted');
  SELECT pg_catalog.count(*) INTO v_n FROM public.business_cards;
  PERFORM tst.ok(v_n = 1, 'A sees exactly her card');
END $$;
SELECT tst.throws($q$INSERT INTO public.business_cards (display_name) VALUES ('second')$q$, 'business_cards_pkey', 'one card per owner');
SELECT tst.throws($q$INSERT INTO public.business_cards (user_id, display_name) VALUES ('00000000-0000-4000-8000-00000000000b', 'planted for B')$q$, 'row-level security', 'A cannot create a card owned by B');
SELECT tst.throws($q$UPDATE public.business_cards SET user_id = '00000000-0000-4000-8000-00000000000b'$q$, 'TK_BUSINESS_CARD_OWNER_IMMUTABLE', 'A cannot hand her card to B');
SELECT tst.throws($q$UPDATE public.business_cards SET style = 'neon'$q$, 'business_cards_style_check', 'style outside classic|modern|visual refused');
SELECT tst.throws($q$UPDATE public.business_cards SET display_name = ' padded '$q$, 'business_cards_display_name_check', 'untrimmed name refused');
SELECT tst.throws($q$UPDATE public.business_cards SET display_name = ''$q$, 'business_cards_display_name_check', 'empty name refused (store NULL instead)');
SELECT tst.throws($q$UPDATE public.business_cards SET about = repeat('x', 601)$q$, 'business_cards_about_check', 'about over 600 chars refused');
SELECT tst.throws($q$UPDATE public.business_cards SET job_title = repeat('x', 81)$q$, 'business_cards_job_title_check', 'job title over 80 chars refused');
SELECT tst.throws($q$UPDATE public.business_cards SET slogan = repeat('x', 121)$q$, 'business_cards_slogan_check', 'slogan over 120 chars refused');
SELECT tst.throws($q$UPDATE public.business_cards SET photo_url = 'http://insecure.test/p.png'$q$, 'business_cards_photo_url_check', 'a non-https photo URL refused');
SELECT tst.throws($q$UPDATE public.business_cards SET photo_url = 'data:image/svg+xml;base64,PHN2Zz4='$q$, 'business_cards_photo_url_check', 'an inline SVG photo refused');
SELECT tst.throws($q$UPDATE public.business_cards SET photo_url = 'javascript:alert(1)'$q$, 'business_cards_photo_url_check', 'a script URL refused');
SELECT tst.throws($q$UPDATE public.business_cards SET photo_url = 'data:image/png;base64,' || repeat('A', 700000)$q$, 'business_cards_photo_url_check', 'an oversized inline photo refused');
SELECT tst.logout();

-- tenant B: sees and changes nothing of A
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
DECLARE v_n int;
BEGIN
  SELECT pg_catalog.count(*) INTO v_n FROM public.business_cards;
  PERFORM tst.ok(v_n = 0, 'B sees no card of A');
  UPDATE public.business_cards SET display_name = 'hijacked' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM tst.ok(v_n = 0, 'B cannot update A''s card');
  DELETE FROM public.business_cards WHERE user_id = '00000000-0000-4000-8000-00000000000a';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM tst.ok(v_n = 0, 'B cannot delete A''s card');
END $$;
SELECT tst.logout();

-- anonymous: no access at all
SELECT tst.anon();
SELECT tst.throws($q$SELECT * FROM public.business_cards$q$, 'permission denied', 'anon cannot read cards');
SELECT tst.logout();

-- owner deletion removes the card (user C: a seeded owner without other dependent rows, as in the Task 18 test)
DO $$
DECLARE v_n int;
BEGIN
  PERFORM tst.login('00000000-0000-4000-8000-00000000000c');
  INSERT INTO public.business_cards (display_name, style) VALUES ('Synthetic Card C', 'modern');
  PERFORM tst.logout();
  DELETE FROM auth.users WHERE id = '00000000-0000-4000-8000-00000000000c';
  SELECT pg_catalog.count(*) INTO v_n FROM public.business_cards WHERE user_id = '00000000-0000-4000-8000-00000000000c';
  PERFORM tst.ok(v_n = 0, 'deleting the owner removes the card (cascade)');
END $$;

ROLLBACK;
