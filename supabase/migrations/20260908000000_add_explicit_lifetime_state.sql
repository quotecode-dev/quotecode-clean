-- TEST-ONLY PACKAGE (quotecode-test, ljfizgrdyzxddswcedwr) — NOT applied to
-- Production by this task. Explicit Lifetime Entitlement Model task
-- (2026-09-08, Owner-authorized: "No more inference-based Lifetime model.
-- No more patches. Lifetime must become an explicit, durable account
-- state."). Production application of this migration is a separate,
-- later, explicitly-authorized Owner gate — never implied by this file
-- existing in the repo (per PROFLOW_PROJECT_CONTEXT.md §205, Release
-- Isolation Law).
--
-- ROOT PROBLEM THIS REPLACES (proven, PROFLOW_PROJECT_CONTEXT.md §204's
-- audit companion task, "CURRENT ENTITLEMENT / ADMIN / REMINDER STATUS:
-- AUDIT COMPLETE"): Lifetime was never a stored fact — it was INFERRED as
-- `trial_ends_at IS NULL AND plan != 'free'`. The one write path meant to
-- grant it (`handleToggleLifetime`, Dashboard.jsx) only ever touched
-- `trial_ends_at`, never `plan` — so granting "Lifetime" to an account
-- whose `plan` was already 'free' silently produced `plan='free',
-- trial_ends_at=null`, which the SAME inference reads as an ordinary
-- self-cancelled FREE account, not Lifetime. The admin saw "success"; the
-- account decayed to FREE. This migration removes the inference entirely
-- by giving Lifetime its own explicit, independently-writable column.
--
-- CHOSEN MODEL (Option A from the Owner's own task brief, chosen over a
-- combined access_source enum): a single orthogonal boolean,
-- `is_lifetime`, alongside the pre-existing `plan` (commercial tier:
-- free/basic/pro) and `trial_ends_at` (trial timing only). Rejected the
-- access_source-enum alternative because it would re-conflate "which
-- underlying tier" with "is this account on a permanent override" into
-- one field — exactly the kind of overloading this task exists to
-- remove. A plain boolean is the smallest change that makes Lifetime
-- unambiguous, costs one column, requires no application-wide enum
-- plumbing, and composes cleanly with any future real billing/
-- subscription field (`is_lifetime` simply short-circuits ahead of
-- whatever billing state exists later — it never needs to know about it).

-- ============================================================
-- 1. Schema: the explicit Lifetime column
-- ============================================================

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS is_lifetime boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.business_settings.is_lifetime IS
  'Explicit, durable Lifetime-entitlement override — added 2026-09-08 to replace the previous trial_ends_at-IS-NULL inference (proven ambiguous/buggy, see migration header). true = this account receives full canonical PRO entitlement (getEntitlementSet(''pro'')) unconditionally, independent of plan/trial_ends_at, until a super_admin explicitly sets it back to false. Never inferred — only ever set by an explicit, password-reauthenticated, server-verified super_admin action (see guard_business_settings_lifetime() below). Orthogonal to plan (commercial tier identity) and trial_ends_at (trial timing only) — never overload this column with either concept.';

-- ============================================================
-- 2. Safe backfill — ONLY unambiguous existing rows
-- ============================================================
--
-- Safe candidate shape (matches the OLD inference exactly, so this backfill
-- changes zero currently-displayed identity for any row — it only makes the
-- already-true fact explicit): trial_ends_at IS NULL AND plan != 'free' AND
-- role != 'super_admin' (super_admin's own entitlement already comes from
-- role, unconditionally — Lifetime is a customer/commercial concept and is
-- never set on an admin's own row, even though it would be harmless if it
-- were, to keep the two concepts cleanly separated per the Owner's own
-- explicit "do not conflate full entitlement with Admin authority" rule).
--
-- Ambiguous shape, DELIBERATELY NOT auto-converted, on TEST or anywhere
-- else: plan = 'free' AND trial_ends_at IS NULL. This shape can currently
-- mean a genuine self-cancellation (correct meaning: FREE) or an
-- incompletely-applied historical Lifetime grant made while the account's
-- plan happened to already be 'free' (the exact defect class this task
-- fixes going forward) — the two are byte-for-byte indistinguishable from
-- stored state alone. These rows are left at the safe default
-- (is_lifetime=false, i.e. they continue to read as FREE, exactly as they
-- did before this migration — zero behavior change) and must be reviewed
-- by the Owner individually, never guessed. Query to find them, unchanged
-- by this migration, for that manual review:
--   SELECT id, business_name, email, plan, trial_ends_at, role
--   FROM public.business_settings
--   WHERE plan = 'free' AND trial_ends_at IS NULL AND role != 'super_admin';
-- On quotecode-test (TEST), this currently identifies exactly 2 synthetic
-- rows ("TEST HE Free" / "TEST EN Free") which are, by their own names and
-- intent, genuinely FREE — correctly left unconverted, not a defect found.
-- This migration does not know, and must never guess, whether any
-- Production row in this same shape (including any real customer account)
-- is a genuine FREE or an unresolved historical Lifetime-grant defect —
-- that determination is explicitly out of this task's scope (Step 15: "No
-- Production data correction yet").

UPDATE public.business_settings
SET is_lifetime = true
WHERE trial_ends_at IS NULL
  AND plan <> 'free'
  AND role <> 'super_admin';

-- ============================================================
-- 3. Server-side authority: extend the existing plan/trial guard trigger
--    to also cover is_lifetime, using the exact same, already-proven
--    pattern (SECURITY DEFINER, re-derives the CALLER's own role from the
--    database via auth.uid() — never trusts a client-supplied value).
-- ============================================================
--
-- Without this, a newly-added column receives NO row-level protection by
-- default: Postgres column-level GRANTs and RLS row policies are enforced
-- independently of each other, and the pre-existing "Super admins can
-- update all business settings" RLS policy only controls which ROWS are
-- touchable, not which COLUMNS on those rows a non-admin caller may set on
-- their OWN row (already permitted broadly by "Owners can manage business
-- settings"). This trigger closes that gap for is_lifetime exactly as it
-- already does for plan/trial_ends_at.

CREATE OR REPLACE FUNCTION public.guard_business_settings_plan_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_role text;
BEGIN
  IF NEW.plan IS NOT DISTINCT FROM OLD.plan
     AND NEW.trial_ends_at IS NOT DISTINCT FROM OLD.trial_ends_at
     AND NEW.is_lifetime IS NOT DISTINCT FROM OLD.is_lifetime THEN
    RETURN NEW;
  END IF;

  SELECT role
  INTO caller_role
  FROM public.business_settings
  WHERE user_id = auth.uid();

  IF caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.plan = 'free'
     AND NEW.trial_ends_at IS NULL
     AND NEW.is_lifetime = false THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Not permitted: plan/trial_ends_at/is_lifetime can only be changed by a super admin, or self-cancelled to the free plan'
    USING ERRCODE = '42501';
END;
$function$;

COMMENT ON FUNCTION public.guard_business_settings_plan_trial() IS
  'Captured 2026-08-30 from live Production (Phase 1); extended 2026-09-08 to also guard is_lifetime (Explicit Lifetime Entitlement Model task). BEFORE UPDATE guard on business_settings: only a super_admin (checked by CALLER''s own role, not the row being updated) may change plan/trial_ends_at/is_lifetime to anything other than a genuine self-cancellation to the free plan (which now also requires is_lifetime=false — a self-cancel can never leave Lifetime set).';

-- ============================================================
-- 4. Column-level grant: authenticated may attempt to write is_lifetime
--    (the trigger above is what actually restricts who succeeds — same
--    division of responsibility already used for plan/trial_ends_at).
-- ============================================================

GRANT UPDATE (is_lifetime) ON public.business_settings TO authenticated;
