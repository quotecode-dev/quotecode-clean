-- Night task 29-30/10 (migration 20261030400000): the fixes of Codex's review of release 4.
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: one identity namespace across topic / heading / focus per
-- flow (R4-01); admission, saving a draft, a rewrite, a publication and a rejection are each one locked decision (R4-02 / R4-03) - a stale
-- token, a stale revision or a fresh writing token refuse and change nothing; an interrupted earlier press is resumed, not rewritten;
-- the reservation of before keeps working and now records its run / action / operation and the provider's id once (R4-11); closed to the app.
BEGIN;

INSERT INTO public.agent_actions (id, run_key, source, kind, action_type, title_he, title_en, payload) VALUES
  ('a4380000-0000-4000-8000-00000000000a', 'db438', 'manager', 'system', 'article_draft', 'א', 'A', '{"market":"intl","topic_he":"תמחור לפי שעה","topic_en":"Hourly pricing"}'),
  ('a4380000-0000-4000-8000-00000000000b', 'db438', 'manager', 'system', 'article_draft', 'ב', 'B', '{"market":"il","topic_he":"נושא ב","topic_en":"Topic B"}'),
  ('a4380000-0000-4000-8000-00000000000c', 'db438', 'manager', 'system', 'article_draft', 'ג', 'C', '{"market":"intl","topic_he":"נושא ג","topic_en":"Topic C"}'),
  ('a4380000-0000-4000-8000-00000000000d', 'db438', 'manager', 'system', 'article_draft', 'ד', 'D', '{"market":"intl","topic_he":"נושא ד","topic_en":"Topic D"}');

-- ------------------------------------------------------------------------------------------------- F1. closed to the app
SELECT tst.anon();
SELECT tst.throws($q$SELECT public.agents_article_reject('a4380000-0000-4000-8000-00000000000a', 900)$q$, 'permission denied', 'F1 the public cannot reject');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT public.agents_article_admit('a4380000-0000-4000-8000-00000000000a', 'drafting:a4380000-0000-4000-8000-000000000001', 900, 'x', 'x', 'x', 'x', NULL, NULL)$q$, 'permission denied', 'F1b nor admit');
SELECT tst.throws($q$SELECT count(*) FROM public.article_identity_owners$q$, 'permission denied', 'F1c nor read the identity owners');
SELECT tst.logout();
SELECT set_config('role', 'service_role', false);
SELECT tst.throws($q$SELECT public.agents_article_claim_core('a4380000-0000-4000-8000-00000000000a', 'topic', 'x', 'x', 'x', 'x', NULL, NULL)$q$, 'permission denied', 'F1d the core claim is internal');

-- ------------------------------------------------------------------------------------------------- F2. R4-01 one namespace + focus
SELECT tst.ok((public.agents_article_admit('a4380000-0000-4000-8000-00000000000a', 'drafting:a4380000-0000-4000-8000-0000000000a1', 900,
  'תמחור לפי שעה', 'hourly pricing', 'תמחור לפי שעה', 'Hourly pricing', 'רק עבודות חשמל', 'רק עבודות חשמל') ->> 'ok')::boolean, 'F2 flow A is admitted with its topic and focus');
SELECT tst.ok((SELECT r ->> 'code' = 'drafting' FROM (SELECT public.agents_article_admit('a4380000-0000-4000-8000-00000000000a', 'drafting:a4380000-0000-4000-8000-0000000000a2', 900,
  'תמחור לפי שעה', 'hourly pricing', 'תמחור לפי שעה', 'Hourly pricing', NULL, NULL) r) x), 'F2b a second press while A is writing is refused (one paid writing)');
SELECT tst.ok((SELECT r ->> 'code' = 'duplicate_topic' AND r ->> 'lang' = 'focus' AND r ->> 'ref_id' = 'a4380000-0000-4000-8000-00000000000a'
                 FROM (SELECT public.agents_article_admit('a4380000-0000-4000-8000-00000000000b', 'drafting:a4380000-0000-4000-8000-0000000000b1', 900,
                   'נושא ב', 'topic b', 'נושא ב', 'Topic B', 'רק עבודות חשמל!', 'רק עבודות חשמל') r) x),
  'F2c another flow with the same normalized focus is refused, naming A');
SELECT tst.ok((SELECT error IS NULL AND decided_at IS NULL FROM public.agent_actions WHERE id = 'a4380000-0000-4000-8000-00000000000b'),
  'F2d and it took no writing token');
SELECT tst.ok((SELECT r ->> 'code' = 'duplicate_topic' AND r ->> 'lang' = 'en'
                 FROM (SELECT public.agents_article_claim('a4380000-0000-4000-8000-00000000000c', 'title', 'כותרת אחרת', 'hourly pricing', 'כותרת אחרת', 'Hourly pricing', NULL) r) x),
  'F2e a HEADING of another flow equal to A''s TOPIC is refused (one namespace across kinds)');
SELECT tst.ok((SELECT count(*) = 0 FROM public.agents_article_inventory() i, jsonb_array_elements(i -> 'claims') c WHERE c ->> 'ref_id' = 'a4380000-0000-4000-8000-00000000000c'),
  'F2f nothing of it stored');

-- ------------------------------------------------------------------------------------------------- F3. R4-03 save / reject
SELECT tst.ok((SELECT r ->> 'code' = 'drafting' FROM (SELECT public.agents_article_reject('a4380000-0000-4000-8000-00000000000a', 900) r) x),
  'F3 a rejection while A is being written is refused');
SELECT tst.ok((SELECT r ->> 'code' = 'not_pending' FROM (SELECT public.agents_article_save_draft('a4380000-0000-4000-8000-00000000000a', 'drafting:a4380000-0000-4000-8000-0000000000ff',
  'hourly-work', 'intl', '{"h1":"איך מתמחרים עבודה לפי שעה"}', '{"h1":"How to price hourly work"}', 'איך מתמחרים עבודה לפי שעה', 'how to price hourly work', 'ל', 'R', 'x', 'x') r) x),
  'F3b another press''s token cannot save');
SELECT tst.ok((public.agents_article_save_draft('a4380000-0000-4000-8000-00000000000a', 'drafting:a4380000-0000-4000-8000-0000000000a1',
  'hourly-work', 'intl', '{"h1":"איך מתמחרים עבודה לפי שעה"}', '{"h1":"How to price hourly work"}', 'איך מתמחרים עבודה לפי שעה', 'how to price hourly work', 'ל', 'R', 'x', 'x') ->> 'ok')::boolean,
  'F3c this press''s token saves the draft');
SELECT tst.ok((SELECT a.status = 'done' AND a.error IS NULL AND (a.result ->> 'slug') = 'hourly-work' FROM public.agent_actions a WHERE a.id = 'a4380000-0000-4000-8000-00000000000a')
  AND (SELECT count(*) = 1 FROM public.site_articles WHERE action_id = 'a4380000-0000-4000-8000-00000000000a' AND status = 'draft' AND revision = 0)
  AND (SELECT count(*) = 1 FROM public.agent_actions WHERE action_type = 'article_publish' AND dedupe_key LIKE 'publish:%' AND payload ->> 'slug' = 'hourly-work'),
  'F3d the article, the topic done and the publication action - together');
SELECT tst.ok((SELECT r ->> 'code' = 'not_pending' FROM (SELECT public.agents_article_reject('a4380000-0000-4000-8000-00000000000a', 900) r) x),
  'F3e a stale rejection after the save changes nothing');

-- ------------------------------------------------------------------------------------------------- F4. R4-02 rewrite / publish
SELECT tst.logout();
CREATE TEMP TABLE art ON COMMIT DROP AS SELECT s.id AS article_id, p.id AS pub_id FROM public.site_articles s JOIN public.agent_actions p ON p.payload ->> 'articleId' = s.id::text
  WHERE s.action_id = 'a4380000-0000-4000-8000-00000000000a';
GRANT SELECT ON art TO service_role;
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((SELECT r ->> 'code' = 'article_changed' FROM (SELECT public.agents_article_rewrite((SELECT article_id FROM art), 7, '{"h1":"חדש"}', '{"h1":"New"}', 'חדש', 'new') r) x),
  'F4 a rewrite of a stale revision is refused');
SELECT tst.logout();
SELECT tst.ok((SELECT count(*) = 0 FROM public.article_topic_claims WHERE ref_id = 'a4380000-0000-4000-8000-00000000000a' AND kind = 'title' AND status = 'active' AND norm = 'new'),
  'F4b and the registry is unchanged (the losing rewrite displaced nothing)');
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((public.agents_article_rewrite((SELECT article_id FROM art), 0, '{"h1":"מדריך חדש לשעה"}', '{"h1":"A new hourly guide"}', 'מדריך חדש לשעה', 'a new hourly guide') ->> 'ok')::boolean,
  'F4c the current revision is rewritten');
SELECT tst.logout();
SELECT tst.ok((SELECT revision = 1 AND en ->> 'h1' = 'A new hourly guide' FROM public.site_articles WHERE id = (SELECT article_id FROM art))
  AND (SELECT count(*) = 2 FROM public.article_topic_claims WHERE ref_id = 'a4380000-0000-4000-8000-00000000000a' AND kind = 'title' AND status = 'active' AND norm IN ('מדריך חדש לשעה', 'a new hourly guide'))
  AND (SELECT count(*) = 2 FROM public.article_topic_claims WHERE ref_id = 'a4380000-0000-4000-8000-00000000000a' AND kind = 'topic' AND status = 'active'),
  'F4d text, revision and heading claim moved together; the topic stays claimed');
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((SELECT r ->> 'code' = 'article_changed' FROM (SELECT public.agents_article_publish((SELECT article_id FROM art), 0, 'מדריך חדש לשעה', 'a new hourly guide', NULL, NULL) r) x),
  'F4e a publication of the old revision is refused');
SELECT tst.ok((public.agents_article_publish((SELECT article_id FROM art), 1, 'מדריך חדש לשעה', 'a new hourly guide', NULL, NULL) ->> 'ok')::boolean, 'F4f the read revision is published');
SELECT tst.ok((SELECT status = 'published' AND published_at IS NOT NULL FROM public.site_articles WHERE id = (SELECT article_id FROM art)), 'F4g as stored');

-- ------------------------------------------------------------------------------------------------- F5. rejection of a draft frees the flow; resume
SELECT tst.ok((public.agents_article_admit('a4380000-0000-4000-8000-00000000000d', 'drafting:a4380000-0000-4000-8000-0000000000d1', 900,
  'נושא ד', 'topic d', 'נושא ד', 'Topic D', NULL, NULL) ->> 'ok')::boolean, 'F5 flow D is admitted');
SELECT tst.logout();
UPDATE public.agent_actions SET decided_at = now() - interval '20 minutes' WHERE id = 'a4380000-0000-4000-8000-00000000000d'; -- its writer crashed 20 minutes ago
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((public.agents_article_reject('a4380000-0000-4000-8000-00000000000d', 900) ->> 'ok')::boolean, 'F5b after the 15-minute hold the Owner may reject it');
SELECT tst.ok((SELECT count(*) = 0 FROM public.agents_article_inventory() i, jsonb_array_elements(i -> 'claims') c WHERE c ->> 'ref_id' = 'a4380000-0000-4000-8000-00000000000d'),
  'F5c and its identities are freed');
SELECT tst.logout();
INSERT INTO public.site_articles (slug, market, he, en, action_id) VALUES ('db438-partial', 'il', '{"h1":"חלקי"}', '{"h1":"Partial"}', 'a4380000-0000-4000-8000-00000000000c');
SELECT set_config('role', 'service_role', false);
SELECT tst.ok((SELECT r ->> 'code' = 'already_drafted' FROM (SELECT public.agents_article_admit('a4380000-0000-4000-8000-00000000000c', 'drafting:a4380000-0000-4000-8000-0000000000c1', 900,
  'נושא ג', 'topic c', 'נושא ג', 'Topic C', NULL, NULL) r) x), 'F5d a flow that already stored a draft is resumed, never written again');

-- ------------------------------------------------------------------------------------------------- F6. R4-11 the reservation of before + correlation
SELECT tst.ok((public.agents_ai_reserve(p_month => '2032-01', p_purpose => 'manager_weekly', p_model => 'gpt-6-luna', p_rate_version => 'v1',
  p_max_input => 1, p_max_output => 1, p_reserved => 10) ->> 'ok')::boolean, 'F6 the 7-argument call of the code of before still reserves');
SELECT tst.ok((public.agents_ai_reserve('2032-01', 'guide_article', 'gpt-6-luna', 'v1', 1, 1, 10, 'admin:2032-01-01T08', 'a4380000-0000-4000-8000-00000000000a',
  'a4380000-0000-4000-8000-0000000000e1') ->> 'ok')::boolean, 'F6b a reservation records its run / action / operation');
SELECT tst.logout();
SELECT tst.ok((SELECT count(*) = 1 FROM public.agents_ai_attempts WHERE month = '2032-01' AND run_ref = 'admin:2032-01-01T08'
                 AND action_ref = 'a4380000-0000-4000-8000-00000000000a' AND op_ref = 'a4380000-0000-4000-8000-0000000000e1'), 'F6c as stored');
CREATE TEMP TABLE att6 ON COMMIT DROP AS SELECT id FROM public.agents_ai_attempts WHERE month = '2032-01' AND run_ref IS NOT NULL;
GRANT SELECT ON att6 TO service_role;
SELECT set_config('role', 'service_role', false);
SELECT public.agents_ai_note_provider((SELECT id FROM att6), 'chatcmpl-first');
SELECT public.agents_ai_note_provider((SELECT id FROM att6), 'chatcmpl-second');
SELECT tst.logout();
SELECT tst.ok((SELECT provider_ref = 'chatcmpl-first' FROM public.agents_ai_attempts WHERE id = (SELECT id FROM att6)), 'F6d the provider''s id is recorded once');

ROLLBACK;
