-- PROFLOW — Item 17: attach the per-business quote_number uniqueness
-- constraint to its already-built CONCURRENTLY index
--
-- NEW FILE, added 2026-08-28 (Isolated Migration Validation task), split
-- out of 20260827000001_add_quote_number_unique_index.sql for correctness
-- — see that file's header for the exact reasoning (CREATE INDEX
-- CONCURRENTLY cannot share a transaction with any other statement, so it
-- cannot safely coexist in the same migration file as this one).
--
-- LOCAL PACKAGE ONLY - NOT applied to the live/production project. Must
-- be applied AFTER 20260827000001 (its index must already exist) and
-- before 20260827000003 (no hard dependency, but this is the intended
-- package order — see PROFLOW_TODO.md item 17's Release Order).
--
-- This statement itself is transaction-safe (attaching an already-built
-- index as a constraint is a fast, metadata-only catalog change - it does
-- not rebuild the index or take the kind of lock CONCURRENTLY exists to
-- avoid), so it does not need, and must not use, CONCURRENTLY itself.
--
-- Idempotency note: plain Postgres has no `ADD CONSTRAINT IF NOT EXISTS`
-- syntax. Under the intended `supabase db push` deployment path this file
-- only ever runs once (Supabase tracks applied migrations and never
-- reruns one), so this is not a practical blocker there - but the guard
-- below makes the file itself safely re-runnable if it is ever applied
-- manually/out-of-band (e.g. directly via psql or the SQL editor) rather
-- than through the CLI's tracked migration history.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_user_quote_number_unique'
      AND conrelid = 'public.quotes'::regclass
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_user_quote_number_unique UNIQUE USING INDEX quotes_user_quote_number_unique_idx;
  END IF;
END
$$;

-- quote_number is NOT NULL live (confirmed via the 2026-08-28 audit), so
-- this constraint's NULL-handling nuance from the original design
-- (Postgres treats NULL as distinct from every other NULL) is moot in
-- practice today - there are no NULL quote_number rows to worry about.

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually, BEFORE
-- 20260827000001's own rollback, since this constraint depends on that
-- file's index):
--
-- ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_user_quote_number_unique;
-- ============================================================
