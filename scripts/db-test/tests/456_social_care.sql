-- Owner console 2026-11-02 (the plan for Shira, migration 20261101070000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the results keep unknown as NULL, the tables are closed to the app, the folder holds JPEG only under its own paths.
BEGIN;
SELECT tst.seed();

INSERT INTO public.social_content_stats (network, post_id, channel, market, kind, title, likes) VALUES ('instagram', 'm1', 'ig_il', 'il', 'video', 'x', 3);
SELECT tst.ok((SELECT views IS NULL AND likes = 3 FROM public.social_content_stats WHERE post_id = 'm1'), 'S1 a number not returned stays unknown');

DO $$ BEGIN
  INSERT INTO public.social_content_stats (network, post_id, channel, market, kind, views) VALUES ('tiktok', 'x', 'tt_il', 'il', 'video', 1);
  RAISE EXCEPTION 'S2 an unknown network was stored';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
SELECT tst.ok(true, 'S2 only the measured networks');

SELECT tst.ok(NOT has_table_privilege('authenticated', 'public.social_content_stats', 'SELECT') AND NOT has_table_privilege('anon', 'public.social_followers', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.social_stills', 'SELECT'), 'S3 closed to the app');
SELECT tst.ok(has_table_privilege('service_role', 'public.social_content_stats', 'INSERT') AND has_table_privilege('service_role', 'public.social_stills', 'UPDATE')
  AND has_table_privilege('service_role', 'public.social_followers', 'INSERT'), 'S4 the service role has its explicit grant');

DO $$ BEGIN
  INSERT INTO public.social_stills (market, path) VALUES ('il', '../other/a.png');
  RAISE EXCEPTION 'S5 a foreign path was stored';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
SELECT tst.ok(true, 'S5 a still lives only under its own folder as a JPEG');

SELECT tst.ok((SELECT public AND allowed_mime_types = ARRAY['image/jpeg'] FROM storage.buckets WHERE id = 'social-stills'), 'S6 the public bucket takes JPEG only');

ROLLBACK;
