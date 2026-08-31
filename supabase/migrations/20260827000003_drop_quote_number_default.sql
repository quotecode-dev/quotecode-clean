-- PROFLOW — Item 17: retire the global quote_number DEFAULT
--
-- NEW FILE, added 2026-08-28 following the completed READ-ONLY LIVE audit
-- (PROFLOW_TODO.md item 17). None of the original 3-file migration package
-- included this step, because it was written under the (now-disproven)
-- assumption that `quotes.quote_number` did not exist live at all. In
-- reality it already exists as
-- `integer NOT NULL DEFAULT nextval('quotes_quote_number_seq'::regclass)`
-- - a single GLOBAL sequence shared by every business, silently assigning
-- a number to every new quote regardless of the frontend's own
-- allocate_quote_number() attempt (this is the confirmed, proven root
-- cause of the "A90" discovery). This file is the step that actually
-- stops that silent global allocation from continuing once the new
-- per-business architecture is ready to take over.
--
-- ⚠️⚠️⚠️ RELEASE-COORDINATION REQUIREMENT — READ BEFORE APPLYING ⚠️⚠️⚠️
-- This migration MUST be deployed in the SAME release window as the
-- frontend's per-business allocation code (already present locally in
-- Dashboard.jsx's create-quote flow, currently gated by the RPC not
-- existing live - see PROFLOW_TODO.md item 17's Surface Impact Matrix and
-- Release Order for the exact required sequencing). Applying this file
-- BEFORE 20260827000000 (the allocator) is live and BEFORE the frontend's
-- allocation call is the active, non-silently-swallowed path will make
-- EVERY new quote INSERT fail outright with a NOT NULL violation on
-- quote_number, because there will be no DEFAULT left to fall back to and
-- nothing yet supplying an explicit value. That failure mode is the
-- INTENDED fail-closed behavior once the transition is actually rolled
-- out (see the "Allocation failure behavior" design decision in this
-- item's audit report) - but only once the rest of the release has
-- already landed. Applied alone, out of order, it is a straightforward
-- live outage of quote creation for every business. DO NOT apply this
-- file in isolation.
--
-- LOCAL PACKAGE ONLY - NOT applied to the live/production project by this
-- task. Depends on 20260827000000 and 20260827000002 being applied first
-- in the eventual coordinated release (not a SQL-level dependency - this
-- file does not reference either of their objects directly - but a
-- correctness/release-order dependency, see the Release Order in this
-- item's audit report).

-- ============================================================
-- 1. Remove the global sequence as the column's automatic DEFAULT
-- ============================================================

ALTER TABLE public.quotes
  ALTER COLUMN quote_number DROP DEFAULT;

-- The column itself stays exactly as it is today: `integer NOT NULL`.
-- No nullable transitional state is introduced (per the audit's explicit
-- "prefer avoiding unnecessary nullable states" guidance) - every future
-- INSERT must now supply quote_number explicitly (via
-- allocate_quote_number(), or an explicit historical/admin value), or the
-- NOT NULL constraint rejects the row outright. This is the fail-closed
-- guarantee at the DB level, independent of whatever the frontend does or
-- forgets to do.

-- ============================================================
-- 2. Defense-in-depth: revoke now-unnecessary client privileges on the
--    retired sequence object
-- ============================================================

-- The audit found `quotes_quote_number_seq` carries Supabase's own
-- standard schema-wide default grant (USAGE+SELECT+UPDATE to
-- anon/authenticated/service_role on every sequence in `public`) - not a
-- project-specific misconfiguration, and not directly exploitable via
-- PostgREST today (it does not expose raw sequence functions to REST/JS
-- clients). Once this sequence is no longer the column's DEFAULT, nothing
-- legitimate needs client-role access to it at all. Revoking here is
-- narrowly scoped to this one sequence only - it does not change the
-- platform-wide default grant applied to future sequences.
REVOKE ALL ON SEQUENCE public.quotes_quote_number_seq FROM anon, authenticated;

-- ============================================================
-- 3. Sequence object lifecycle — explicitly NOT dropped here
-- ============================================================

-- `quotes_quote_number_seq` itself is deliberately RETAINED, not dropped,
-- by this migration. It still numerically represents the historical
-- 11-90(+) global range already assigned to real rows before this
-- transition, and remains useful for rollback/forensic purposes (e.g.
-- confirming which historical values were ever globally assigned) during
-- the period immediately following this transition. A LATER, SEPARATE
-- cleanup migration may DROP SEQUENCE public.quotes_quote_number_seq once
-- the new per-business architecture has been running live and verified
-- stable for a reasonable period - explicitly deferred, not part of this
-- transition package, and not authorized by this task.

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually; restores
-- the PRE-transition global-allocation behavior exactly - only safe to do
-- if no per-business A100700-series numbers have been issued yet that
-- would need reconciling, per the "irreversible points" discussion in
-- this item's audit report):
--
-- GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.quotes_quote_number_seq TO anon, authenticated;
-- ALTER TABLE public.quotes ALTER COLUMN quote_number SET DEFAULT nextval('quotes_quote_number_seq'::regclass);
-- ============================================================
