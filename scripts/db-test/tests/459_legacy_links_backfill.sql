-- Owner console 2026-11-02 (migration 20261102030000). Disposable postgres:17 harness ONLY. ONE transaction, rolled back.
-- Proves: the rule of the backfill on a fresh run, the access decision after it, and that drafts and capability-scoped quotes stay closed.
BEGIN;
SELECT tst.seed();

INSERT INTO public.clients (id, company_name, email, user_id) VALUES ('c4590000-0000-4000-8000-000000000009', 'Synthetic C', 'c459@synthetic.test', '00000000-0000-4000-8000-00000000000a');
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id) VALUES
  ('c4590000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a', 45901, 'sent', 'c4590000-0000-4000-8000-000000000009'),
  ('c4590000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a', 45902, 'approved', 'c4590000-0000-4000-8000-000000000009'),
  ('c4590000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a', 45903, 'draft', 'c4590000-0000-4000-8000-000000000009');

INSERT INTO public.legacy_public_quote_links (quote_id, user_id)
SELECT q.id, q.user_id FROM public.quotes q
 WHERE q.user_id IS NOT NULL AND (lower(coalesce(q.status, '')) <> 'draft' OR coalesce(q.signature, '') <> '')
   AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.quote_id = q.id)
ON CONFLICT (quote_id) DO NOTHING;

SELECT tst.ok(public.is_legacy_public_quote('c4590000-0000-4000-8000-000000000001'), 'L1 a sent quote is listed');
SELECT tst.ok(public.is_legacy_public_quote('c4590000-0000-4000-8000-000000000002'), 'L2 an approved quote is listed');
SELECT tst.ok(NOT public.is_legacy_public_quote('c4590000-0000-4000-8000-000000000003'), 'L3 a draft is never listed');
SELECT tst.throws($$ DELETE FROM public.legacy_public_quote_links WHERE quote_id = 'c4590000-0000-4000-8000-000000000001' $$, 'append-only', 'L4 the list stays append-only');
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
SELECT tst.throws($$ SELECT public.record_legacy_public_links() $$, 'enforced', 'L5 the old recording function stays refused once enforced');

ROLLBACK;
