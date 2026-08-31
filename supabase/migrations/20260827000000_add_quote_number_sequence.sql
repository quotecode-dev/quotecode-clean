-- PROFLOW — Item 17: Per-Business Customer-Facing Quote Numbering
--
-- ⚠️ REWRITTEN 2026-08-28 following a dedicated READ-ONLY LIVE audit
-- (PROFLOW_TODO.md item 17, PROFLOW_HANDOFF.md's corresponding entry). The
-- ORIGINAL version of this file assumed `quotes.quote_number` did not yet
-- exist live and attempted `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS
-- quote_number integer` (nullable, no default). That assumption is PROVEN
-- FALSE: the live column already exists as
-- `integer NOT NULL DEFAULT nextval('quotes_quote_number_seq'::regclass)`,
-- populated automatically and unconditionally by a single GLOBAL sequence
-- shared across every business on the platform (not per-business, not
-- starting at 100700 — confirmed via direct schema introspection: 23
-- historical quotes across 7 businesses share one continuous 11–90 range).
-- This is what produced the real, live "A90" quote_number this engagement
-- observed unexpectedly.
--
-- This file no longer touches the `quotes.quote_number` column at all
-- (it already exists with the correct final type). It creates ONLY the
-- new per-business counter table and the atomic allocator function.
-- Removing the column's global DEFAULT is a SEPARATE, later, deliberately
-- isolated step — see 20260827000003_drop_quote_number_default.sql — so
-- that step's own release-coordination requirement is explicit and cannot
-- be missed.
--
-- LOCAL PACKAGE ONLY. This file is NOT applied to the live/production
-- Supabase project. It is prepared for a future, separately-authorized
-- `supabase db push` once the Owner explicitly approves a LIVE migration.
--
-- Architecture summary (unchanged from the original design in this
-- respect — this part of the original package was never in conflict with
-- live reality, only the `quotes.quote_number` column assumption above
-- was wrong):
--   - quotes.id (UUID) remains the sole technical/routing/security identifier.
--   - business_quote_sequences is a NEW, dedicated table (not a column on
--     the existing client-writable business_settings) holding exactly one
--     persistent counter row per business (user_id). RLS is enabled with
--     ZERO policies granted to `authenticated` — the table is completely
--     unreachable by ordinary client reads/writes. The only way to advance
--     it is the SECURITY DEFINER function below.
--   - allocate_quote_number(uuid) is the sole write path to the counter.
--     It re-checks auth.uid() = p_user_id internally (defense in depth,
--     independent of the caller's own claimed p_user_id), uses a single
--     atomic INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING statement
--     (safe under concurrent calls via Postgres's own row-level locking —
--     no frontend SELECT MAX()+1).
--   - The counter's starting value (100700 on first-ever allocation for a
--     business with no prior history) is correct ONLY for a business with
--     no historical quote_number values already at/above that range. See
--     supabase/quote_number_counter_init.sql for the one-time, idempotent
--     step that raises an EXISTING business's counter above its own
--     historical high-water mark before this allocator is ever called for
--     that business — this migration alone does not perform that seeding.

-- ============================================================
-- 1. Per-business persistent counter table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_quote_sequences (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 100700,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.business_quote_sequences IS
  'Per-business persistent counter for customer-facing sequential quote numbers (item 17). One row per business (user_id). The stored next_number is the value that WILL be assigned to the next allocation for that business - it is advanced atomically by allocate_quote_number(uuid) only, and may be pre-seeded once by quote_number_counter_init.sql to respect a business''s pre-transition historical high-water mark. Never written to directly by any client; RLS below grants authenticated no policies at all.';

ALTER TABLE public.business_quote_sequences ENABLE ROW LEVEL SECURITY;

-- Deliberately NO policy grants SELECT/INSERT/UPDATE/DELETE to `authenticated`
-- or `anon` on this table. Default-deny: RLS enabled with zero policies means
-- every row is inaccessible to every client role. The only privileged access
-- path is the SECURITY DEFINER function below, which runs as the function
-- owner and therefore bypasses RLS internally - by design, not by mistake.
--
-- One narrow read-only exception, mirroring the existing is_super_admin()
-- oversight pattern already used for chat_logs (see PROFLOW_ARCHITECTURE.md
-- §8.2): super admins may SELECT for support/debugging visibility. This is
-- read-only and does not weaken the write lockdown above in any way.
CREATE POLICY "Super admins can view all quote sequences"
  ON public.business_quote_sequences
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- ============================================================
-- 2. Atomic per-business allocation function
-- ============================================================

CREATE OR REPLACE FUNCTION public.allocate_quote_number(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  -- Defense in depth: even though this function is only ever meant to be
  -- called by the quote's own owner from application code, never trust the
  -- caller-supplied p_user_id alone - re-derive and compare against the
  -- actual authenticated identity. A caller attempting to pass a different
  -- business's user_id is rejected here, independent of any RLS on other
  -- tables.
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'allocate_quote_number: not authorized for this business';
  END IF;

  -- Single atomic statement: on a business's very first allocation, the
  -- INSERT succeeds directly and RETURNING yields the DEFAULT (100700) -
  -- unless quote_number_counter_init.sql has already seeded a higher
  -- next_number for this business to respect its pre-transition historical
  -- numbers, in which case that seeded value is used instead. On every
  -- subsequent call, the unique-key conflict on user_id routes into the DO
  -- UPDATE branch, which increments and returns the new value. Two
  -- concurrent calls for the SAME user_id serialize via Postgres's own
  -- row-level lock on the conflicting unique index entry - the second
  -- transaction waits for the first to commit before its own UPDATE reads
  -- the incremented value, so no duplicate number can ever be returned.
  INSERT INTO public.business_quote_sequences (user_id, next_number)
  VALUES (p_user_id, 100700)
  ON CONFLICT (user_id) DO UPDATE
    SET next_number = public.business_quote_sequences.next_number + 1,
        updated_at = now()
  RETURNING next_number INTO v_number;

  RETURN v_number;
END;
$$;

COMMENT ON FUNCTION public.allocate_quote_number(uuid) IS
  'Atomically allocates and returns the next customer-facing quote_number for the given business (user_id). Re-validates auth.uid() = p_user_id internally. Only this function (and the one-time quote_number_counter_init.sql seeding step) may write to business_quote_sequences.';

-- Explicit privilege lockdown: only authenticated users may call it, and
-- only for their own business (enforced inside the function body above,
-- not by this grant alone - the grant controls who may attempt the call,
-- the internal check controls whose business it succeeds for).
--
-- ⚠️ CORRECTED 2026-08-28 (Disposable Supabase Runtime Migration
-- Validation task) — a genuine, confirmed security gap was found via
-- runtime testing: `REVOKE ALL ... FROM PUBLIC` alone does NOT remove
-- `anon`'s (or `service_role`'s) EXECUTE privilege here, because
-- Supabase's own platform-level default privileges grant EXECUTE on
-- newly created `public` schema functions to `anon`/`authenticated`/
-- `service_role` as individual, explicit ACL entries - not inherited via
-- the `PUBLIC` pseudo-role - so a `REVOKE ... FROM PUBLIC` never touches
-- them. Runtime-confirmed in the disposable environment: `anon` could
-- actually invoke this function and reach its internal `auth.uid()`
-- check (which correctly rejected it, since anon has no `auth.uid()`) -
-- meaning the intended grant-layer defense was not actually in effect,
-- even though the internal check happened to save it. Explicit REVOKE
-- from the individually-granted roles closes this for real.
REVOKE ALL ON FUNCTION public.allocate_quote_number(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.allocate_quote_number(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.allocate_quote_number(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION public.allocate_quote_number(uuid) TO authenticated;

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually if this
-- migration needs to be fully reverted after being applied). Run this
-- BEFORE 20260827000001's own rollback if both are being undone, and only
-- after 20260827000003 (DROP DEFAULT) has itself been rolled back first
-- (restoring the global sequence DEFAULT), otherwise INSERTs would start
-- failing NOT NULL with no allocation path available at all:
--
-- REVOKE EXECUTE ON FUNCTION public.allocate_quote_number(uuid) FROM authenticated;
-- DROP FUNCTION IF EXISTS public.allocate_quote_number(uuid);
-- DROP POLICY IF EXISTS "Super admins can view all quote sequences" ON public.business_quote_sequences;
-- DROP TABLE IF EXISTS public.business_quote_sequences;
-- ============================================================
