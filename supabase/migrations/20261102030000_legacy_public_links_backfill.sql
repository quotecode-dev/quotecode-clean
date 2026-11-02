-- ============================================================================================================================
-- 20261102030000_legacy_public_links_backfill.sql  -  quotes sent before the activation open again from the link the customer already has
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-11-02 (typed: "מאשר טיפול מיידי בקישורי ההצעות הישנים לפני סוף הסבב", "רק אחרי שאני מציג את שאר הדברים").
--   The bug: record_legacy_public_links() had to run before free_issue was enforced. It never ran in Production, the list stayed empty, and
--   since the activation every link of the form /public-quote/<id> answered "not found or expired", also for quotes already signed.
--   That function refuses once free_issue is enforced, and stays so; this is the one backfill, with its rule:
--   * a quote that left Draft or was signed, and was never issued through the new path (no row in quote_issue_ledger).
--   A quote that has a ledger row is capability-scoped: its old link stays closed by design (decideLegacyIdAccess), so that an old link can
--   never show a document newer than the customer was sent. A quote still in Draft is never listed.
--   Additive: the list is append-only. Re-runnable: ON CONFLICT DO NOTHING.
--   ROLLBACK: no delete (append-only). The access rule stays in get-public-quote; a forward migration would be needed.
-- ============================================================================================================================

INSERT INTO public.legacy_public_quote_links (quote_id, user_id)
SELECT q.id, q.user_id
  FROM public.quotes q
 WHERE q.user_id IS NOT NULL
   AND (lower(coalesce(q.status, '')) <> 'draft' OR coalesce(q.signature, '') <> '')
   AND NOT EXISTS (SELECT 1 FROM public.quote_issue_ledger l WHERE l.quote_id = q.id)
ON CONFLICT (quote_id) DO NOTHING;
