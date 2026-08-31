-- PROFLOW — Full Runtime TEST Environment Build, Phase 1 (schema capture)
-- Part 3 of 4: ROW LEVEL SECURITY (enable + policies) and table GRANTS
--
-- ============================================================
-- ⚠️⚠️⚠️ TEST / BOOTSTRAP MIGRATION — NOT A PRODUCTION FORWARD-MIGRATION
-- PATH. READ BEFORE APPLYING ANYWHERE. ⚠️⚠️⚠️
-- ============================================================
-- POINT-IN-TIME CAPTURE of Production's RLS/grant posture as it existed
-- on 2026-08-26 — NOT a forward migration. Production already enforces
-- this exact posture NATIVELY; DO NOT apply this file to Production
-- merely because it exists in `supabase/migrations/` — if Production's
-- live grants/policies have drifted since capture, a `db push`/
-- `--include-all` against Production (ref `ixabnzhjeqevtbhdfswv`) would
-- silently OVERWRITE that drift (including any security tightening made
-- since) with this stale snapshot. Any future Production use requires
-- its own completely separate, fresh audit and explicit Owner + ChatGPT
-- authorization. Scoped exclusively for `quotecode-test` (ref
-- `ljfizgrdyzxddswcedwr`) via a future, separately-authorized Phase 2
-- apply — this rename does not itself authorize any apply. See
-- `20260830000000_capture_base_schema_tables.sql`'s header (Part 1) for
-- the full context of this capture package, including the
-- RETIMESTAMPED-2026-08-30 note and the genuinely-blank-project
-- replay-capability tradeoff (PROFLOW_HANDOFF.md §18.CP).
--
-- Depends on Part 1 (tables) and Part 2 (is_admin()/is_super_admin(), used
-- inside several policies below) — must apply after both.
--
-- FIDELITY PRINCIPLE, per this task's explicit instruction: every grant
-- and policy below is captured EXACTLY as it exists live on Production
-- today — including states that look unusual but were independently
-- verified (not just via information_schema, but via has_table_privilege())
-- to be the actual, real, currently-effective Production security posture.
-- Nothing here weakens or strengthens TEST relative to Production merely
-- because TEST will hold only synthetic data.
--
-- ✅ ANOMALY RESOLVED (2026-08-30 deep review, PROFLOW_HANDOFF.md §18.CM) —
-- the apparent gap ("authenticated has only SELECT on business_settings")
-- was a methodology gap in the original read-only check, not a real
-- Production defect: `authenticated` genuinely holds COLUMN-LEVEL `INSERT`
-- grants on 10 specific columns and `UPDATE` grants on 13 specific columns
-- of `business_settings` (deliberate least-privilege — e.g. `role` is
-- INSERT-only, preventing self-promotion after signup), independently
-- confirmed via `information_schema.column_privileges` and empirically
-- re-verified this revision task. See Part 2 below, immediately after the
-- table-wide `GRANT SELECT`, for the exact column-level grants now
-- captured to match Production precisely.

-- ============================================================
-- 1. Enable RLS on all 9 tables
-- ============================================================

ALTER TABLE public.business_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotecode_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services            ENABLE ROW LEVEL SECURITY;

-- Note: `quotes`' RLS is also relevant to quotecode-test's CURRENT state,
-- where it is confirmed DISABLED with `anon` holding full table grants —
-- the opposite of Production's posture. This ENABLE (and the REVOKE in
-- Part 2 below) corrects that specific TEST-only gap when Phase 2 applies
-- this file — an intentional, in-scope hardening (per this task's own
-- "TEST should mirror Production security... do not weaken it" §8
-- instruction), not an unrelated deviation.

-- ============================================================
-- 2. Table-level grants (anon / authenticated / service_role)
-- ============================================================
-- service_role always retains full DML+DDL-adjacent privileges on every
-- table as Supabase's own platform default — not restated per-table below
-- since nothing here changes it.

-- business_settings: authenticated SELECT (table-wide) plus the exact
-- column-level INSERT/UPDATE grants Production actually has (see the
-- resolved-anomaly note above) — deliberate least-privilege, not table-wide
-- INSERT/UPDATE; no anon grant at all.
REVOKE ALL ON public.business_settings FROM anon;
REVOKE ALL ON public.business_settings FROM authenticated;
GRANT SELECT ON public.business_settings TO authenticated;

-- Column-level INSERT: exactly the 10 columns the real signup INSERT
-- payload writes (Dashboard.jsx's createNewBusinessSettings) — confirmed
-- against Production's live information_schema.column_privileges.
GRANT INSERT (
  user_id, email, business_name, country, currency, plan, role,
  default_terms, trial_ends_at, last_sign_in
) ON public.business_settings TO authenticated;

-- Column-level UPDATE: exactly the 13 columns the real settings-save and
-- admin trial-extension UPDATE paths write. Deliberately excludes `role`
-- (INSERT-only on Production — a user cannot self-promote after signup),
-- `id`, `emailjs_*`, and `trial_reminder_*_sent` (system/admin-managed
-- only, no client UPDATE grant on Production either).
GRANT UPDATE (
  address, business_name, country, currency, default_terms, email,
  last_sign_in, logo_url, phone, plan, tax_id, trial_ends_at, user_id
) ON public.business_settings TO authenticated;

-- chat_logs: authenticated SELECT only; no anon grant.
REVOKE ALL ON public.chat_logs FROM anon;
REVOKE ALL ON public.chat_logs FROM authenticated;
GRANT SELECT ON public.chat_logs TO authenticated;

-- clients: authenticated DELETE/INSERT/SELECT/UPDATE (no REFERENCES/
-- TRIGGER/TRUNCATE — matching Production's exact grant set, not the
-- broader service_role-style set); no anon grant.
REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.clients FROM authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.clients TO authenticated;

-- expenses: anon AND authenticated both hold full grants on Production —
-- faithfully replicated, gated by RLS policies below (not a TEST-only
-- weakening; this is Production's own real, current state).
REVOKE ALL ON public.expenses FROM anon;
REVOKE ALL ON public.expenses FROM authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.expenses TO authenticated;

-- quote_attachments: authenticated DELETE/INSERT/SELECT/UPDATE; no anon.
REVOKE ALL ON public.quote_attachments FROM anon;
REVOKE ALL ON public.quote_attachments FROM authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.quote_attachments TO authenticated;

-- quote_items: authenticated DELETE/INSERT/SELECT/UPDATE; no anon.
REVOKE ALL ON public.quote_items FROM anon;
REVOKE ALL ON public.quote_items FROM authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.quote_items TO authenticated;

-- quotecode_documents: anon AND authenticated both hold full grants —
-- this table is intentionally a public document-sharing surface (see its
-- "Allow public insert/select" / "Public can view documents" RLS policies
-- below) — faithfully replicated, by design, not a gap.
REVOKE ALL ON public.quotecode_documents FROM anon;
REVOKE ALL ON public.quotecode_documents FROM authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quotecode_documents TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.quotecode_documents TO authenticated;

-- quotes: authenticated DELETE/INSERT/SELECT/UPDATE; NO anon grant
-- (⚠️ this is the correction relative to quotecode-test's current
-- unsafe state, where anon holds full grants — see the RLS note above).
REVOKE ALL ON public.quotes FROM anon;
REVOKE ALL ON public.quotes FROM authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.quotes TO authenticated;

-- services: anon AND authenticated both hold full grants on Production —
-- faithfully replicated, gated by RLS policies below.
REVOKE ALL ON public.services FROM anon;
REVOKE ALL ON public.services FROM authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.services TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.services TO authenticated;

-- ============================================================
-- 3. RLS policies — 24 total, captured verbatim (name/cmd/roles/qual/
--    with_check), guarded so re-applying this file is safe.
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all business settings" ON public.business_settings;
CREATE POLICY "Admins can view all business settings" ON public.business_settings
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Owners can manage business settings" ON public.business_settings;
CREATE POLICY "Owners can manage business settings" ON public.business_settings
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AS RESTRICTIVE on both policies below: confirmed via Production's own
-- pg_policies.permissive column that these two are genuinely RESTRICTIVE
-- (not the CREATE POLICY default of PERMISSIVE) — without this keyword
-- they would silently combine via OR with the broader ownership policies
-- instead of AND, completely defeating the plan/trial signup restriction.
-- Empirically proven this revision task via a disposable Docker test (see
-- PROFLOW_HANDOFF.md §18.CM/§18.CN).
DROP POLICY IF EXISTS "Restrict business_settings insert to role=user" ON public.business_settings;
CREATE POLICY "Restrict business_settings insert to role=user" ON public.business_settings
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (role = 'user'::text);

DROP POLICY IF EXISTS "Restrict business_settings insert to safe free or legitimate tr" ON public.business_settings;
CREATE POLICY "Restrict business_settings insert to safe free or legitimate tr" ON public.business_settings
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
    ((plan = 'free'::text) AND (trial_ends_at IS NULL))
    OR ((plan = 'pro'::text) AND (trial_ends_at IS NOT NULL)
        AND (trial_ends_at >= ((now() + '14 days'::interval) - '02:00:00'::interval))
        AND (trial_ends_at <= ((now() + '14 days'::interval) + '02:00:00'::interval)))
  );

DROP POLICY IF EXISTS "Super admins can update all business settings" ON public.business_settings;
CREATE POLICY "Super admins can update all business settings" ON public.business_settings
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Super admins can view all business settings" ON public.business_settings;
CREATE POLICY "Super admins can view all business settings" ON public.business_settings
  FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Users can insert own settings" ON public.business_settings;
CREATE POLICY "Users can insert own settings" ON public.business_settings
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.business_settings;
CREATE POLICY "Users can update own settings" ON public.business_settings
  FOR UPDATE TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can view all chat logs" ON public.chat_logs;
CREATE POLICY "Super admins can view all chat logs" ON public.chat_logs
  FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Owners can manage clients" ON public.clients;
CREATE POLICY "Owners can manage clients" ON public.clients
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can manage expenses" ON public.expenses;
CREATE POLICY "Owners can manage expenses" ON public.expenses
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;
CREATE POLICY "Users can delete own expenses" ON public.expenses
  FOR DELETE TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
CREATE POLICY "Users can insert own expenses" ON public.expenses
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
CREATE POLICY "Users can manage their own expenses" ON public.expenses
  FOR ALL TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
CREATE POLICY "Users can update own expenses" ON public.expenses
  FOR UPDATE TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
CREATE POLICY "Users can view own expenses" ON public.expenses
  FOR SELECT TO public USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own expenses" ON public.expenses;
CREATE POLICY "Users manage their own expenses" ON public.expenses
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Note: `expenses` carries 6 overlapping ALL/SELECT/INSERT/UPDATE/DELETE
-- policies covering the identical `auth.uid() = user_id` condition —
-- confirmed pre-existing historical accretion on Production, faithfully
-- replicated rather than consolidated (consolidating would be an
-- "improvement" this task's own instructions do not authorize).

DROP POLICY IF EXISTS "Owners can manage quote attachments" ON public.quote_attachments;
CREATE POLICY "Owners can manage quote attachments" ON public.quote_attachments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_attachments.quote_id AND quotes.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_attachments.quote_id AND quotes.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners can manage quote items" ON public.quote_items;
CREATE POLICY "Owners can manage quote items" ON public.quote_items
  FOR ALL TO public USING (
    EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_items.quote_id AND quotes.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_items.quote_id AND quotes.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Allow public insert/select" ON public.quotecode_documents;
CREATE POLICY "Allow public insert/select" ON public.quotecode_documents
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can manage documents" ON public.quotecode_documents;
CREATE POLICY "Owners can manage documents" ON public.quotecode_documents
  FOR ALL TO public USING (auth.uid() = (user_id)::uuid) WITH CHECK (auth.uid() = (user_id)::uuid);

DROP POLICY IF EXISTS "Public can view documents" ON public.quotecode_documents;
CREATE POLICY "Public can view documents" ON public.quotecode_documents
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Owners can manage quotes" ON public.quotes;
CREATE POLICY "Owners can manage quotes" ON public.quotes
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can manage services" ON public.services;
CREATE POLICY "Owners can manage services" ON public.services
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ROLLBACK (not part of the forward migration — run manually, TEST only):
--
-- Re-run `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;` for each of the 9
-- tables, and `DROP POLICY IF EXISTS <name> ON <table>;` for each of the
-- 24 policies above, then reissue whatever grant state existed before
-- (for quotecode-test specifically, that was: quotes RLS disabled, anon
-- full grant on quotes — its pre-Phase-1 state).
-- ============================================================
