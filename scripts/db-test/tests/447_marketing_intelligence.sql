-- Continuous work 30/10 (migration 20261031000000, Codex release 8 + the Owner's reply addition). Disposable postgres:17 harness ONLY.
-- ONE transaction, rolled back. Proves: the data spend is reserved against 10 USD a month and settled once (unknown keeps the hold);
-- keywords are stored once per market in lower case; a reply to a comment is a system action (never automatic); the comment text and
-- author are removed after 30 days; nothing of it is open to the app.
BEGIN;
SELECT tst.seed();
SET LOCAL role = service_role;

SELECT set_config('tst.d1', public.agents_data_reserve('ranked:intl:tekango.com', 150000)::text, false);
SELECT tst.ok((current_setting('tst.d1')::jsonb ->> 'ok')::boolean, 'M1 a data request is reserved');
SELECT tst.ok(public.agents_data_settle((current_setting('tst.d1')::jsonb ->> 'id')::uuid, 'settled', 110000), 'M1b and settled with the provider''s cost');
SELECT tst.ok(NOT public.agents_data_settle((current_setting('tst.d1')::jsonb ->> 'id')::uuid, 'settled', 1), 'M1c never settled twice');
SELECT tst.ok((SELECT (s ->> 'settled_micros')::bigint = 110000 AND (s ->> 'held_micros')::bigint = 0 FROM public.agents_data_state() s), 'M1d the month shows the settled cost, nothing held');
SELECT set_config('tst.d2', public.agents_data_reserve('overview:il', 30000)::text, false);
SELECT public.agents_data_settle((current_setting('tst.d2')::jsonb ->> 'id')::uuid, 'unknown', NULL);
SELECT tst.ok((SELECT (s ->> 'held_micros')::bigint = 30000 FROM public.agents_data_state() s), 'M2 an unknown outcome keeps its hold');
RESET role;
UPDATE public.agents_data_months SET settled_micros = 9990000;
SET LOCAL role = service_role;
SELECT tst.ok(public.agents_data_reserve('ranked:il:rival.example', 60000) ->> 'code' = 'data_budget_blocked', 'M3 a request above the 10 USD month is refused before it is sent');
SELECT tst.throws($q$SELECT public.agents_data_reserve('x', 2000000)$q$, 'data_reserve_invalid', 'M3b one request may never hold more than 1 USD');

INSERT INTO public.marketing_keywords (market, keyword) VALUES ('intl', 'quote template');
SELECT tst.throws($q$INSERT INTO public.marketing_keywords (market, keyword) VALUES ('intl', 'quote template')$q$, 'unique', 'M4 a keyword once per market');
SELECT tst.throws($q$INSERT INTO public.marketing_keywords (market, keyword) VALUES ('intl', 'Quote Template')$q$, 'check', 'M4b keywords are stored in lower case');
RESET role;

-- a reply is a system action (waits for the Owner), never automatic
INSERT INTO public.agent_actions (id, run_key, source, kind, action_type, title_he, title_en, payload, created_at) VALUES
  ('a4470000-0000-4000-8000-000000000001', 'daily:2026-09-01', 'social', 'system', 'social_reply', 'תגובה', 'Comment', '{"comment_text":"אני רוצה החזר","author":"רון","comment_id":"c1"}', now() - interval '31 days'),
  ('a4470000-0000-4000-8000-000000000002', 'daily:2026-10-29', 'social', 'system', 'social_reply', 'תגובה', 'Comment', '{"comment_text":"תודה","author":"דנה","comment_id":"c2"}', now() - interval '1 day');
SELECT tst.throws($q$INSERT INTO public.agent_actions (run_key, source, kind, action_type, title_he, title_en) VALUES ('x', 'social', 'auto', 'social_reply', 'a', 'b')$q$, 'check', 'M5 a reply is never an automatic action');
SET LOCAL role = service_role;
SELECT tst.ok(public.agents_purge_reply_texts() = 1, 'M6 the daily purge removes comment texts older than 30 days');
RESET role;
SELECT tst.ok((SELECT NOT (payload ? 'comment_text') AND NOT (payload ? 'author') AND (payload ->> 'comment_text_purged')::boolean AND payload ->> 'comment_id' = 'c1'
  FROM public.agent_actions WHERE id = 'a4470000-0000-4000-8000-000000000001'), 'M6b the text and the author are gone; the comment id stays (never answered twice)');
SELECT tst.ok((SELECT payload ->> 'comment_text' = 'תודה' FROM public.agent_actions WHERE id = 'a4470000-0000-4000-8000-000000000002'), 'M6c a recent comment keeps its text');

SELECT tst.anon();
SELECT tst.throws($q$SELECT public.agents_data_reserve('x', 1000)$q$, 'permission denied', 'M7 the public cannot spend');
SELECT tst.logout();
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT count(*) FROM public.marketing_rank_snapshots$q$, 'permission denied', 'M7b nor a signed-in user read the rank data');
SELECT tst.throws($q$SELECT count(*) FROM public.social_post_metrics$q$, 'permission denied', 'M7c nor the post results');
SELECT tst.logout();

ROLLBACK;
