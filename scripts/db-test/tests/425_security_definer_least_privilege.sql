-- Owner console 2026-10-26 (typed: "מאשר תיקון ממצאי האבטחה 1 עד 5 מדוח הלילה, בשחרור דרך השער"): 20261027300000. Disposable postgres:17
-- harness ONLY. ONE transaction, rolled back. Proves: the eight trigger functions and the legacy increment_quote_views are not callable by
-- anon / authenticated; the triggers still fire for a signed-in user (the quote number stays immutable, a draft still saves); the public
-- quote page functions stay callable by anon.
BEGIN;
SELECT tst.seed();

INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES
  ('a4250000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000000a', 942501, 'draft', 'ILS', 100);

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.enqueue_quote_attachment_gc()', 'public.guard_business_settings_plan_trial()', 'public.guard_quote_child_immutability()',
    'public.guard_quote_immutability()', 'public.guard_quote_immutability_delete()', 'public.handle_user_migration()',
    'public.protect_quote_number_immutability()', 'public.unsection_quote_items_on_section_delete()', 'public.increment_quote_views(uuid)'] LOOP
    PERFORM tst.ok(NOT has_function_privilege('anon', f, 'execute') AND NOT has_function_privilege('authenticated', f, 'execute'),
      'T1 ' || f || ' is not callable by anon or a signed-in user');
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.public_approve_quote(uuid, text)', 'public.public_approve_quote_capability(text, text)',
    'public.public_increment_quote_view(uuid)', 'public.public_record_quote_first_view(uuid)'] LOOP
    PERFORM tst.ok(has_function_privilege('anon', f, 'execute'), 'T2 ' || f || ' stays callable by the public quote page (anon)');
  END LOOP;
END $$;

SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$UPDATE public.quotes SET quote_number = 942599 WHERE id = 'a4250000-0000-4000-8000-0000000000a1'$q$,
  'quote_number is immutable', 'T3 the quote-number trigger still fires for a signed-in user');
SELECT tst.lives($q$UPDATE public.quotes SET total = 120 WHERE id = 'a4250000-0000-4000-8000-0000000000a1'$q$,
  'T4 a signed-in user still saves a draft (the guard triggers run without EXECUTE)');
SELECT tst.logout();
SELECT tst.ok((SELECT total = 120 FROM public.quotes WHERE id = 'a4250000-0000-4000-8000-0000000000a1'), 'T5 the draft change was saved');
ROLLBACK;
