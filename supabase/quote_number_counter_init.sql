-- PROFLOW — Item 17: per-business counter initialization
--
-- NEW FILE, added 2026-08-28, replacing the retired
-- quote_number_backfill.sql (see that file for why it was retired - its
-- core premise, `quote_number IS NULL` rows existing to backfill, is
-- proven false live: quote_number is NOT NULL and always populated).
--
-- This script does NOT renumber, touch, or reinterpret any existing
-- quotes.quote_number value. Per the Owner's explicit "Historical Number
-- Preservation" rule: a historical quote showing A11/A56/A90 remains A11/
-- A56/A90 forever - it is a historical identifier, not a placeholder to
-- be replaced. Only NEW quotes created after this transition receive
-- numbers from the new per-business A100700+ sequence.
--
-- ⚠️ CORRECTED 2026-08-28 (Disposable Supabase Runtime Migration Validation
-- task) — a genuine, reproducible defect was found and fixed here via
-- actual runtime testing (not caught by the prior static-only review).
--
-- `business_quote_sequences.next_number`, DESPITE its name, is actually
-- treated by allocate_quote_number() as "the LAST number already given
-- out" (or, for a business with no row yet, the value its very first
-- INSERT both stores AND returns in the same call) - NOT "the next number
-- to hand out." Proof: allocate_quote_number()'s INSERT ... VALUES
-- (p_user_id, 100700) stores 100700 AND returns 100700 on a business's
-- true first-ever call (no existing row -> direct INSERT, no conflict).
-- Every SUBSEQUENT call hits ON CONFLICT DO UPDATE next_number+1 and
-- returns the incremented value - so the stored value always equals the
-- value most recently handed out, never "the value about to be handed
-- out next."
--
-- The ORIGINAL version of this script seeded
-- `next_number = GREATEST(100700, MAX(historical quote_number)+1)` -
-- treating the column as "next value to hand out." For any business with
-- historical quotes (i.e. every real business today), this pre-created a
-- row already sitting at 100700. The allocator's very next call for that
-- business then hit ON CONFLICT (a row already existed) and incremented
-- it BEFORE returning - silently skipping A100700 entirely and handing
-- out A100701 as that business's first "new" managed number, live-
-- reproduced and confirmed in the disposable validation environment. A
-- business with genuinely zero historical quotes (never touched by this
-- script) correctly received A100700 via the direct-INSERT path,
-- confirming the bug was specific to counter_init-seeded businesses.
--
-- FIX: seed the column with its TRUE "last given out" semantic instead -
-- one less than the first number this business should actually receive:
--
--   next_number for business X = GREATEST(
--     100699,
--     (current business_quote_sequences.next_number for X, if any row
--      already exists),
--     MAX(quotes.quote_number) WHERE quotes.user_id = X
--   )
--
-- so that allocate_quote_number()'s own +1-on-conflict logic lands
-- exactly on 100700 (or, for a business already historically past
-- 100700, exactly on its own correct next value) on that business's
-- first real call after seeding - re-verified end-to-end in the
-- disposable environment after this fix.
--
-- Today (2026-08-28 audit), every live business's historical maximum is
-- 90 or below, so this resolves to exactly 100700 as each business's
-- first new managed number - the same starting point as a business with
-- zero history. The GREATEST(...) formula exists for correctness/future-
-- proofing (the business-D-equivalent case: a business whose historical
-- maximum already sits at/above 100700), not because any current live
-- business is known to already exceed 100700.
--
-- LOCAL DESIGN ONLY - NOT EXECUTED BY THIS TASK, NOT EVER AUTO-APPLIED.
--
-- Deliberately placed OUTSIDE supabase/migrations/ - the Supabase CLI only
-- auto-applies files inside that directory via `supabase db push`. This
-- file lives here specifically so it can NEVER run as a side effect of a
-- routine schema push. It must be run manually, as its own
-- separately-authorized step, after 20260827000000_add_quote_number_
-- sequence.sql has itself been applied to LIVE (business_quote_sequences
-- must exist first), and BEFORE the frontend's allocate_quote_number()
-- call becomes the active, non-silently-swallowed path for any business
-- that already has historical quotes.
--
-- Do NOT run this against LIVE without explicit, separate Owner
-- authorization for that exact action. Do NOT run this in a way that
-- singles out David Aluminum's account, and do NOT run it as a side
-- effect of a blanket "all businesses" action without the Owner's own
-- review of the resulting per-business starting points first (see
-- PROFLOW_PROJECT_CONTEXT.md §19).
--
-- Idempotent: safe to re-run at any time (e.g. after a new business signs
-- up and creates its first historical-range quote before this transition
-- ships) - GREATEST(...) never moves an already-initialized counter
-- backward, and never touches a business whose counter is already ahead
-- of its own historical maximum.

BEGIN;

INSERT INTO public.business_quote_sequences (user_id, next_number)
SELECT
  q.user_id,
  GREATEST(100699, MAX(q.quote_number)) AS seeded_next_number
FROM public.quotes q
WHERE q.user_id IS NOT NULL
GROUP BY q.user_id
ON CONFLICT (user_id) DO UPDATE
  SET next_number = GREATEST(
        public.business_quote_sequences.next_number,
        EXCLUDED.next_number
      ),
      updated_at = now();

COMMIT;

-- Verification queries to run AFTER the above, before trusting the result
-- (read-only, safe to run any time):
--
-- -- Confirm every business with historical quotes now has a seeded
-- -- counter row, and every seeded value is >= 100699 (this column stores
-- -- the LAST number given out, not the next one - see the header note
-- -- above - so the FIRST real allocate_quote_number() call after seeding
-- -- should return seeded_value + 1, i.e. >= 100700):
-- SELECT user_id, next_number FROM public.business_quote_sequences
-- ORDER BY next_number;
-- -- Expected: one row per distinct quotes.user_id, every next_number >= 100699.
--
-- -- Confirm NO existing quotes.quote_number value was touched by this
-- -- script (it must be a strict no-op on the quotes table itself):
-- -- (compare a pre-run and post-run snapshot of this query - they must be
-- -- byte-identical)
-- SELECT id, user_id, quote_number FROM public.quotes ORDER BY id;
--
-- ROLLBACK (undo only this seeding step, keep the schema from the other
-- migrations in place) - SAFE ONLY if run immediately after this script,
-- before any real allocate_quote_number() call has happened for any
-- business (once real allocations exist, a seeded-only row and a
-- once-allocated row are indistinguishable by next_number alone - manual
-- per-business review would be required instead of this blanket DELETE):
-- DELETE FROM public.business_quote_sequences;
