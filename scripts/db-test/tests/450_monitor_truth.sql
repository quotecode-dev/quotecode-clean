-- Codex review 2026-10-31 group 2 (migration 20261031300000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the weekly review claim carries its completion; the service role can write it; the app cannot read or write it.
BEGIN;
SELECT tst.seed();

SELECT tst.ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'support_review_runs' AND column_name = 'completed_at'),
  'S1 the weekly review claim has its completion time');
SELECT set_config('role', 'service_role', false);
INSERT INTO public.support_review_runs (week) VALUES ('2026-11-01');
SELECT tst.ok((SELECT completed_at IS NULL FROM public.support_review_runs WHERE week = '2026-11-01'), 'S2 a fresh claim is not completed');
UPDATE public.support_review_runs SET completed_at = now() WHERE week = '2026-11-01';
SELECT tst.ok((SELECT completed_at IS NOT NULL FROM public.support_review_runs WHERE week = '2026-11-01'), 'S3 the service role marks it completed');
RESET role;
SELECT tst.login('00000000-0000-4000-8000-00000000000a');
SELECT tst.throws($q$SELECT completed_at FROM public.support_review_runs$q$, 'permission denied', 'S4 a signed-in user cannot read it');
SELECT tst.logout();
SELECT tst.anon();
SELECT tst.throws($q$UPDATE public.support_review_runs SET completed_at = now()$q$, 'permission denied', 'S5 nor the public write it');
SELECT tst.logout();

ROLLBACK;
