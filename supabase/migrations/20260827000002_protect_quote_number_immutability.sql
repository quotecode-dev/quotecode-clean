-- PROFLOW — Item 17: quote_number immutability hardening
--
-- ⚠️ REWRITTEN 2026-08-28 following the completed READ-ONLY LIVE audit
-- (PROFLOW_TODO.md item 17). Confirmed via direct trigger/RLS introspection
-- that this gap is REAL and currently OPEN live: `quotes` has RLS enabled
-- with one blanket owner policy (`"Owners can manage quotes"`,
-- `FOR ALL USING/WITH CHECK auth.uid() = user_id`) and no column-level
-- restriction, and the two triggers that DO exist on `quotes` today
-- (`guard_quote_immutability_update`, `guard_quote_immutability_delete_trigger`)
-- only guard content changes on approved/paid/signed quotes - neither
-- mentions or protects `quote_number` in any way. Today, live, any
-- authenticated owner can UPDATE their own quote's `quote_number` to an
-- arbitrary value at any time before that quote is approved/paid/signed.
-- This migration closes exactly that gap and does not overlap or conflict
-- with either of the two existing triggers (different trigger names,
-- different underlying functions, both may coexist and fire independently
-- on the same UPDATE event without interfering with each other).
--
-- Design simplified relative to the original version of this file: the
-- original allowed a NULL -> value transition (for the old design's
-- nullable, unassigned-until-migration column). Under the corrected target
-- architecture, `quotes.quote_number` stays NOT NULL throughout the whole
-- transition (see 20260827000003_drop_quote_number_default.sql) - every
-- row always has a value from the moment it is inserted, so a NULL state
-- never legitimately exists for this trigger to allow through. The rule is
-- now unconditional: once a row exists, its quote_number may never change,
-- for any actor, with one narrow SECURITY DEFINER-independent exception -
-- `service_role` - reserved for a genuine future forward-fix/admin
-- correction path (see the rollback/forward-fix plan in this item's audit
-- report), mirroring the exact same `auth.role() = 'service_role'` bypass
-- pattern already used by the live `guard_quote_immutability_delete`
-- function for its own analogous admin-cleanup exception.
--
-- LOCAL PACKAGE ONLY - NOT applied to the live/production project.
-- Depends on 20260827000000_add_quote_number_sequence.sql only for this
-- package's overall documentation context, not for any object this file
-- itself references.

CREATE OR REPLACE FUNCTION public.protect_quote_number_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.quote_number IS DISTINCT FROM OLD.quote_number THEN
    RAISE EXCEPTION
      'quote_number is immutable once assigned (was %, attempted %)',
      OLD.quote_number, NEW.quote_number
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_quote_number_immutability() IS
  'BEFORE UPDATE guard on quotes: rejects any change to quote_number once a row exists, for every actor except service_role (reserved for an explicit, separately-authorized forward-fix). No legitimate application code path ever needs to alter an already-assigned quote_number - Dashboard.jsx never includes quote_number in its edit payload (confirmed during the item-17 audit).';

DROP TRIGGER IF EXISTS quotes_protect_quote_number ON public.quotes;
CREATE TRIGGER quotes_protect_quote_number
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_quote_number_immutability();

-- ============================================================
-- ROLLBACK (not part of the forward migration - run manually):
--
-- DROP TRIGGER IF EXISTS quotes_protect_quote_number ON public.quotes;
-- DROP FUNCTION IF EXISTS public.protect_quote_number_immutability();
-- ============================================================
