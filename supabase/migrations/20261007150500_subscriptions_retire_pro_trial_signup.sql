-- ============================================================================================================================
-- 20261007150500_subscriptions_retire_pro_trial_signup.sql  -  a client can no longer self-create a Pro + 14-day trial row
-- tekango-migration-contract: mode=transaction replay=required
--
--   OD-01 (no 14-day trial; Free = 10 outputs total). Replaces ONLY the RESTRICTIVE insert policy
--   "Restrict business_settings insert to safe free or legitimate tr" on public.business_settings (captured in
--   20260830000002_capture_base_rls_grants.sql), which also admitted a self-created plan='pro' row with trial_ends_at = now()+14d,
--   with a RESTRICTIVE policy of a new name that admits only the legacy free record (plan 'free', no trial, not lifetime).
--   Untouched: every other business_settings policy (incl. the RESTRICTIVE role=user policy), the column grants, the
--   plan/trial/lifetime update guard trigger. The signup client omits plan and trial_ends_at (column defaults: 'free' / NULL).
--   Never applied to TEST/Production by this change.
--   Re-runnable: DROP POLICY IF EXISTS + CREATE POLICY.
--
--   ROLLBACK (DB owner) - recreate the previous policy verbatim from 20260830000002 and drop the new one:
--     DROP POLICY IF EXISTS "Restrict business_settings insert to legacy free record" ON public.business_settings;
--     CREATE POLICY "Restrict business_settings insert to safe free or legitimate tr" ON public.business_settings
--       AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
--         ((plan = 'free'::text) AND (trial_ends_at IS NULL))
--         OR ((plan = 'pro'::text) AND (trial_ends_at IS NOT NULL)
--             AND (trial_ends_at >= ((now() + '14 days'::interval) - '02:00:00'::interval))
--             AND (trial_ends_at <= ((now() + '14 days'::interval) + '02:00:00'::interval)))
--       );
-- ============================================================================================================================

DROP POLICY IF EXISTS "Restrict business_settings insert to safe free or legitimate tr" ON public.business_settings;
DROP POLICY IF EXISTS "Restrict business_settings insert to legacy free record" ON public.business_settings;
CREATE POLICY "Restrict business_settings insert to legacy free record" ON public.business_settings
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
    (plan = 'free'::text) AND (trial_ends_at IS NULL) AND (coalesce(is_lifetime, false) = false)
  );
