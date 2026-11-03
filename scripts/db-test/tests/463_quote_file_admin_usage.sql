-- Owner 2026-11-03 (typed approval): the Owner's cost view of "quote from a file" reads (20261103300000).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: super admin only; per day it counts completed and given-back reads, accounts, tokens and the recorded cost; a read still in
-- progress is not counted as completed; an ordinary user is refused; nothing but numbers comes back.
BEGIN;
SELECT tst.seed();

SELECT set_config('session_replication_role', 'replica', true);
UPDATE public.business_settings SET role = 'super_admin' WHERE user_id = '00000000-0000-4000-8000-00000000000a';
SELECT set_config('session_replication_role', 'origin', true);

INSERT INTO public.quote_file_read_claims (user_id, period, state, finished_at, model, prompt_tokens, completion_tokens, cost_micros) VALUES
  ('00000000-0000-4000-8000-00000000000a', to_char(now(), 'YYYY-MM'), 'done', now(), 'gpt-6-luna', 1000, 200, 1500),
  ('00000000-0000-4000-8000-00000000000b', to_char(now(), 'YYYY-MM'), 'done', now(), 'gpt-6-luna', 2000, 300, 2500),
  ('00000000-0000-4000-8000-00000000000b', to_char(now(), 'YYYY-MM'), 'refunded', now(), 'gpt-6-luna', 500, 0, 300);
INSERT INTO public.quote_file_read_claims (user_id, period) VALUES ('00000000-0000-4000-8000-00000000000b', to_char(now(), 'YYYY-MM'));

-- an ordinary user is refused
SELECT tst.login('00000000-0000-4000-8000-00000000000b');
DO $$
BEGIN
  BEGIN
    PERFORM public.quote_file_admin_usage(30);
    PERFORM tst.ok(false, 'T1 an ordinary user must be refused');
  EXCEPTION WHEN others THEN
    PERFORM tst.ok(SQLSTATE = '42501', 'T1 an ordinary user is refused (42501)');
  END;
END $$;
SELECT tst.logout();

-- the super admin sees today's numbers
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.ok((public.quote_file_admin_usage(30) ->> 'ok')::boolean, 'T2 the super admin gets the view');
SELECT tst.ok(jsonb_array_length(public.quote_file_admin_usage(30) -> 'days') = 1, 'T3 one day row');
SELECT tst.ok((public.quote_file_admin_usage(30) -> 'days' -> 0 ->> 'stored')::int = 2, 'T4 two reads completed (the one in progress is not counted)');
SELECT tst.ok((public.quote_file_admin_usage(30) -> 'days' -> 0 ->> 'refunded')::int = 1, 'T5 one read given back');
SELECT tst.ok((public.quote_file_admin_usage(30) -> 'days' -> 0 ->> 'accounts')::int = 2, 'T6 two accounts');
SELECT tst.ok((public.quote_file_admin_usage(30) -> 'days' -> 0 ->> 'promptTokens')::int = 3500
          AND (public.quote_file_admin_usage(30) -> 'days' -> 0 ->> 'completionTokens')::int = 500, 'T7 tokens summed');
SELECT tst.ok((public.quote_file_admin_usage(30) -> 'days' -> 0 ->> 'estimatedCostUsd')::numeric = 0.0043, 'T8 the recorded cost in US dollars');
SELECT tst.ok((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(public.quote_file_admin_usage(30) -> 'days' -> 0) k)
          = ARRAY['accounts', 'completionTokens', 'day', 'estimatedCostUsd', 'promptTokens', 'refunded', 'stored'], 'T9 numbers only - no account, file or line');
SELECT tst.logout();

ROLLBACK;
