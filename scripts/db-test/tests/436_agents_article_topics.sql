-- Codex release 4 (Owner 2026-10-29, migration 20261030300000): no duplicate article topics in the agents room (decision 6).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: only the service role reaches the inventory and the claims
-- (functions only, no table); the inventory is complete (no 1,000-row window); a topic text held by one article flow refuses another
-- flow's claim atomically (nothing of it stored); a flow's own claim is idempotent and its heading may equal its topic; a rejection frees
-- the topic; the published-article read of the public site is unchanged.
BEGIN;

INSERT INTO public.agent_actions (id, run_key, source, kind, action_type, title_he, title_en, payload) VALUES
  ('a4360000-0000-4000-8000-000000000001', 'db436', 'manager', 'system', 'article_draft', 'נושא א', 'Topic A', '{"market":"intl","topic_he":"נושא א","topic_en":"Topic A"}'),
  ('a4360000-0000-4000-8000-000000000002', 'db436', 'manager', 'system', 'article_draft', 'נושא ב', 'Topic B', '{"market":"il","topic_he":"נושא ב","topic_en":"Topic B"}'),
  ('a4360000-0000-4000-8000-000000000003', 'db436', 'manager', 'claude', 'claude_task', 'משימה', 'Task', '{"prompt_he":"x"}');
-- 1,200 articles: more than any recent-row window
INSERT INTO public.site_articles (slug, market, status, he, en, published_at)
SELECT 'db436-article-' || g, 'intl', CASE WHEN g % 2 = 0 THEN 'published' ELSE 'draft' END,
       jsonb_build_object('h1', 'כותרת ' || g), jsonb_build_object('h1', 'Heading ' || g), CASE WHEN g % 2 = 0 THEN now() END
  FROM generate_series(1, 1200) g;
INSERT INTO public.site_articles (slug, market, status, he, en) VALUES ('db436-rejected', 'il', 'rejected', '{"h1":"נדחה"}', '{"h1":"Rejected"}');

-- ------------------------------------------------------------------------------------------------- T1. closed to the app
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.agents_article_inventory()$q$, 'permission denied', 'T1 the public cannot read the inventory (drafts are private)');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.agents_article_claim('a4360000-0000-4000-8000-000000000001', 'topic', 'x', 'x', 'x', 'x', NULL)$q$, 'permission denied', 'T1b a signed-in user cannot claim');
SELECT tst.throws($q$SELECT count(*) FROM public.article_topic_claims$q$, 'permission denied', 'T1c nor read the claims');
SELECT tst.logout();
SELECT tst.anon();
SELECT tst.ok((SELECT count(slug) = 600 FROM public.site_articles WHERE slug LIKE 'db436-%'), 'T1d the public still reads the published articles (and only them)');
SELECT tst.logout();

-- ------------------------------------------------------------------------------------------------- T2. the whole inventory
SELECT set_config('role', 'service_role', false);
SELECT tst.throws($q$SELECT count(*) FROM public.article_topic_claims$q$, 'permission denied', 'T2 the service role reaches the claims only through the functions');
SELECT tst.ok((SELECT jsonb_array_length(i -> 'articles') >= 1200 AND jsonb_array_length(i -> 'slugs') >= 1201
                 AND NOT (i -> 'articles') @> '[{"he":"נדחה"}]' AND (i -> 'articles') @> '[{"he":"כותרת 1200","en":"Heading 1200","status":"published"}]'
                 AND (i -> 'proposals') @> '[{"id":"a4360000-0000-4000-8000-000000000001","he":"נושא א","en":"Topic A"}]'
                 AND jsonb_array_length(i -> 'claims') = 0
               FROM (SELECT public.agents_article_inventory() i) x),
  'T2b every draft and published article (1,200, no window), every waiting proposal; a rejected article only as a taken address');

-- ------------------------------------------------------------------------------------------------- T3. the atomic claim
SELECT tst.ok((public.agents_article_claim('a4360000-0000-4000-8000-000000000001', 'topic', 'תמחור לפי שעה', 'hourly pricing', 'תמחור לפי שעה', 'Hourly pricing', 'מיקוד') ->> 'ok')::boolean,
  'T3 flow A claims its topic');
SELECT tst.ok((SELECT r ->> 'code' = 'duplicate_topic' AND r ->> 'lang' = 'he' AND r ->> 'ref_id' = 'a4360000-0000-4000-8000-000000000001'
                 FROM (SELECT public.agents_article_claim('a4360000-0000-4000-8000-000000000002', 'topic', 'תמחור לפי שעה', 'per hour rates', 'תמחור לפי שעה', 'Per hour rates', NULL) r) x),
  'T3b flow B with the same Hebrew topic is refused, naming flow A');
SELECT tst.ok((SELECT r ->> 'lang' = 'en' FROM (SELECT public.agents_article_claim('a4360000-0000-4000-8000-000000000002', 'topic', 'משהו אחר', 'hourly pricing', 'משהו אחר', 'Hourly Pricing', NULL) r) x),
  'T3c and with the same English topic (another Hebrew one)');
SELECT tst.ok((SELECT jsonb_array_length(i -> 'claims') = 2 AND NOT (i -> 'claims') @> '[{"norm":"משהו אחר"}]' FROM (SELECT public.agents_article_inventory() i) x),
  'T3d a refused claim stores nothing - not even its other language');
SELECT tst.ok((public.agents_article_claim('a4360000-0000-4000-8000-000000000001', 'topic', 'תמחור לפי שעה', 'hourly pricing', 'תמחור לפי שעה', 'Hourly pricing', 'מיקוד') ->> 'ok')::boolean,
  'T3e flow A pressing again keeps its own claim');
SELECT tst.ok((public.agents_article_claim('a4360000-0000-4000-8000-000000000001', 'title', 'תמחור לפי שעה', 'hourly pricing', 'תמחור לפי שעה', 'Hourly pricing', NULL) ->> 'ok')::boolean,
  'T3f its heading may be its topic''s text');
SELECT tst.ok((public.agents_article_claim('a4360000-0000-4000-8000-000000000001', 'title', 'כותרת חדשה', 'a new heading', 'כותרת חדשה', 'A new heading', NULL) ->> 'ok')::boolean,
  'T3g a rewrite replaces the heading');
SELECT tst.ok((SELECT (i -> 'claims') @> '[{"kind":"topic","norm":"hourly pricing"},{"kind":"title","norm":"a new heading"}]' AND NOT (i -> 'claims') @> '[{"kind":"title","norm":"hourly pricing"}]'
                 FROM (SELECT public.agents_article_inventory() i) x), 'T3h the topic stays claimed while the heading changes');
SELECT tst.throws($q$SELECT public.agents_article_claim('a4360000-0000-4000-8000-000000000003', 'topic', 'x', 'x', 'x', 'x', NULL)$q$, 'agents_article_claim_invalid', 'T3i only an article flow claims');
SELECT tst.throws($q$SELECT public.agents_article_claim('a4360000-0000-4000-8000-000000000002', 'topic', '', 'x', 'x', 'x', NULL)$q$, 'agents_article_claim_invalid', 'T3j an empty identity is refused');
SELECT tst.ok((SELECT (i -> 'claims') @> '[{"kind":"topic","lang":"he","focus":"מיקוד"}]' FROM (SELECT public.agents_article_inventory() i) x), 'T3k the inventory carries each claim''s focus');

-- ------------------------------------------------------------------------------------------------- T4. a rejection frees the topic
SELECT tst.ok(public.agents_article_release('a4360000-0000-4000-8000-000000000001') = 4, 'T4 the rejection releases the flow''s topic and heading');
SELECT tst.ok((public.agents_article_claim('a4360000-0000-4000-8000-000000000002', 'topic', 'תמחור לפי שעה', 'hourly pricing', 'תמחור לפי שעה', 'Hourly pricing', NULL) ->> 'ok')::boolean,
  'T4b then another flow may take the topic');
SELECT tst.logout();
UPDATE public.agent_actions SET status = 'rejected' WHERE id = 'a4360000-0000-4000-8000-000000000001';
SELECT set_config('role', 'service_role', false);
SELECT tst.throws($q$SELECT public.agents_article_claim('a4360000-0000-4000-8000-000000000001', 'title', 'אחר', 'other', 'אחר', 'Other', NULL)$q$, 'agents_article_claim_invalid',
  'T4c a rejected flow claims nothing (a writing that ends after the rejection)');
SELECT tst.logout();
SELECT tst.ok((SELECT count(*) = 8 FROM public.article_topic_claims WHERE status = 'released' AND released_at IS NOT NULL), 'T4d released rows are kept as history (a re-press, a rewrite, the rejection)');

ROLLBACK;
