-- ============================================================================================================================
-- 20261031300000_monitor_truth.sql  -  a claimed weekly review counts only once it completed (Codex review 2026-10-31, F11)
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-31 (typed: "מאשר את שש הקבוצות של קודקס לפי הסדר, כל אחת בשער משלה ועד הלייב, כולל שינוי ב-L-02, L-13, L-15,
--   L-17, L-18, L-22 ובנעילות של 30/10, החלטות א-ח והנוסחים כמומלץ"); docs/CODEX_REVIEW_RELEASES_2026-10-30.md group 2.
--   * support_review_runs.completed_at: set by support-weekly-review only when the review was saved; a week claimed by a run that never
--     completed is no longer a healthy "already reviewed" (the scheduled-run monitor records it as failed).
--   * History: a past review that mailed the Owner counts as completed (mailed_at); nothing else is inferred.
--   Closed to the app as before (service role only). ROLLBACK: the column is nullable and ignored by the former function.
-- ============================================================================================================================

ALTER TABLE public.support_review_runs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
COMMENT ON COLUMN public.support_review_runs.completed_at IS 'Codex F11 (Owner 2026-10-31): the review of this week was saved; a claim without it is incomplete.';
UPDATE public.support_review_runs SET completed_at = mailed_at WHERE completed_at IS NULL AND mailed_at IS NOT NULL;
