-- PROFLOW — Full Runtime TEST Environment Build, Phase 1 (schema capture)
-- Part 2 of 4: FUNCTIONS and TRIGGERS
--
-- ============================================================
-- ⚠️⚠️⚠️ TEST / BOOTSTRAP MIGRATION — NOT A PRODUCTION FORWARD-MIGRATION
-- PATH. READ BEFORE APPLYING ANYWHERE. ⚠️⚠️⚠️
-- ============================================================
-- POINT-IN-TIME CAPTURE of Production's functions/triggers as they
-- existed on 2026-08-26 — NOT a forward migration. Production already
-- contains these objects NATIVELY; DO NOT apply this file to Production
-- merely because it exists in `supabase/migrations/` — if Production's
-- live definitions have drifted since capture, a `db push`/
-- `--include-all` against Production (ref `ixabnzhjeqevtbhdfswv`) would
-- silently OVERWRITE that drift with this stale snapshot. Any future
-- Production use requires its own completely separate, fresh audit and
-- explicit Owner + ChatGPT authorization. Scoped exclusively for
-- `quotecode-test` (ref `ljfizgrdyzxddswcedwr`) via a future,
-- separately-authorized Phase 2 apply — this rename does not itself
-- authorize any apply. See `20260830000000_capture_base_schema_tables.sql`'s
-- header (Part 1) for the full context of this capture package, including
-- the RETIMESTAMPED-2026-08-30 note and the genuinely-blank-project
-- replay-capability tradeoff (PROFLOW_HANDOFF.md §18.CP).
--
-- Depends on Part 1 (tables) for every function/trigger below that
-- references `quotes`/`business_settings`/`auth.users` — must apply after
-- that file. Applies before Part 3 (RLS), since several policies captured
-- there call `is_admin()`/`is_super_admin()` defined here.
--
-- SCOPE DECISION, explicitly recorded per this task's own "capture only
-- what's currently required, not every historical/unused object" instruction:
-- the two legacy `approve_quote_public(uuid)` / `approve_quote_public(uuid,
-- text)` overloads that exist live on Production are DELIBERATELY OMITTED.
-- Confirmed via Agent HE's direct review this session: zero call sites in
-- `src/` — both `PublicQuote.jsx` and `PublicQuoteEn.jsx` call only
-- `public_approve_quote(p_quote_id, p_signature_data_url)` (captured
-- below), which is a newer, separately-validated function. Omitting the
-- unused legacy overloads is a deliberate scope decision, not an oversight
-- — flagged here explicitly per this task's own reconciliation
-- requirement, not silently dropped.
--
-- FIDELITY NOTE: every function below is captured EXACTLY as it is defined
-- live on Production today, including characteristics that might look like
-- defects but are pre-existing, intentional-or-at-least-current Production
-- behavior — per this task's explicit "do not silently fix in TEST, flag
-- separately" instruction:
--   - `handle_user_migration()` and `increment_quote_views(uuid)` have NO
--     explicit `search_path` set (unlike most of the other functions here,
--     which do). Captured as-is.
--   - `guard_quote_child_immutability()`'s `service_role` bypass applies
--     to DELETE only (not UPDATE/INSERT) — intentional, for
--     `admin-delete-user` account-cleanup support per its own comment.

-- ============================================================
-- 1. Admin/role-check helpers (SECURITY DEFINER, STABLE, no side effects)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_settings
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$function$;

COMMENT ON FUNCTION public.is_admin() IS
  'Captured 2026-08-30 from live Production (Phase 1). True if the calling user''s own business_settings.role = ''admin''. Used by RLS policies captured in Part 3.';

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_settings
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  );
$function$;

COMMENT ON FUNCTION public.is_super_admin() IS
  'Captured 2026-08-30 from live Production (Phase 1). True if the calling user''s own business_settings.role = ''super_admin''. ⚠️ This CREATE OR REPLACE corrects a confirmed drift: quotecode-test''s existing copy of this function has SECURITY DEFINER = false (vs. Production''s true) — applying this file to TEST in Phase 2 will fix that drift as an intended side effect, not an accidental behavior change.';

-- Explicit REVOKE from anon, matching Production's live grant state
-- exactly (confirmed via has_table_privilege-equivalent introspection this
-- task: anon cannot EXECUTE either function on Production today, while
-- every other function in this file leaves Supabase's platform default
-- anon-EXECUTE grant in place, unrevoked, matching Production faithfully).
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;

-- ============================================================
-- 2. Immutability guard triggers on `quotes` and its children
-- ============================================================
-- NOTE: distinct from, and confirmed non-conflicting with, the already-
-- tracked quote-number-specific `protect_quote_number_immutability()` /
-- `quotes_protect_quote_number` trigger in
-- 20260827000002_protect_quote_number_immutability.sql (different trigger
-- name, different function, both fire independently on the same UPDATE
-- event without interfering — confirmed by that file's own header comment).

CREATE OR REPLACE FUNCTION public.guard_quote_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  was_immutable boolean;
  new_without_bookkeeping public.quotes;
BEGIN
  was_immutable := (
    LOWER(COALESCE(OLD.status, '')) IN ('approved','paid')
    OR (OLD.signature IS NOT NULL AND OLD.signature <> '')
  );

  IF NOT was_immutable THEN
    RETURN NEW;
  END IF;

  IF NEW.view_count IS DISTINCT FROM OLD.view_count
     AND (
       NEW.view_count IS NULL
       OR NEW.view_count < COALESCE(OLD.view_count, 0)
     ) THEN
    RAISE EXCEPTION
      'Not permitted: view_count cannot decrease or become NULL'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.expiration_reminder_sent IS DISTINCT FROM OLD.expiration_reminder_sent
     AND NEW.expiration_reminder_sent IS NOT TRUE THEN
    RAISE EXCEPTION
      'Not permitted: expiration_reminder_sent cannot be reset'
      USING ERRCODE = '42501';
  END IF;

  new_without_bookkeeping := NEW;

  new_without_bookkeeping.view_count :=
    OLD.view_count;

  new_without_bookkeeping.expiration_reminder_sent :=
    OLD.expiration_reminder_sent;

  new_without_bookkeeping.email_bounced :=
    OLD.email_bounced;

  new_without_bookkeeping.email_bounce_reason :=
    OLD.email_bounce_reason;

  new_without_bookkeeping.email_bounced_at :=
    OLD.email_bounced_at;

  IF new_without_bookkeeping IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Not permitted: this quote is approved/paid/signed and its content can no longer be modified'
    USING ERRCODE = '42501';
END;
$function$;

COMMENT ON FUNCTION public.guard_quote_immutability() IS
  'Captured 2026-08-30 from live Production (Phase 1). BEFORE UPDATE guard on quotes: once approved/paid/signed, blocks any content change except a small named bookkeeping allowlist (view_count increase, expiration_reminder_sent one-way, email_bounced*).';

CREATE OR REPLACE FUNCTION public.guard_quote_immutability_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN OLD;
  END IF;

  IF (
    LOWER(COALESCE(OLD.status, '')) IN ('approved','paid')
    OR (OLD.signature IS NOT NULL AND OLD.signature <> '')
  ) THEN
    RAISE EXCEPTION
      'Not permitted: this quote is approved/paid/signed and cannot be deleted'
      USING ERRCODE = '42501';
  END IF;

  RETURN OLD;
END;
$function$;

COMMENT ON FUNCTION public.guard_quote_immutability_delete() IS
  'Captured 2026-08-30 from live Production (Phase 1). BEFORE DELETE guard on quotes: blocks deleting an approved/paid/signed quote, except for service_role (admin-cleanup path).';

CREATE OR REPLACE FUNCTION public.guard_quote_child_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  src_immutable boolean := false;
  dst_immutable boolean := false;
BEGIN
  -- service_role bypass only for DELETE
  -- needed for admin-delete-user account cleanup
  IF auth.role() = 'service_role'
     AND TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- UPDATE/DELETE:
  -- block mutation/removal from an immutable source quote
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT (
      LOWER(COALESCE(status,'')) IN ('approved','paid')
      OR (signature IS NOT NULL AND signature <> '')
    )
    INTO src_immutable
    FROM public.quotes
    WHERE id = OLD.quote_id;

    IF COALESCE(src_immutable, false) THEN
      RAISE EXCEPTION
        'Not permitted: quote is approved/paid/signed - items/attachments are frozen'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- INSERT/UPDATE:
  -- block adding/moving content into an immutable destination quote
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT (
      LOWER(COALESCE(status,'')) IN ('approved','paid')
      OR (signature IS NOT NULL AND signature <> '')
    )
    INTO dst_immutable
    FROM public.quotes
    WHERE id = NEW.quote_id;

    IF COALESCE(dst_immutable, false) THEN
      RAISE EXCEPTION
        'Not permitted: quote is approved/paid/signed - items/attachments are frozen'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.guard_quote_child_immutability() IS
  'Captured 2026-08-30 from live Production (Phase 1). Shared BEFORE INSERT/UPDATE/DELETE guard used by both quote_items and quote_attachments — blocks touching a child row of an approved/paid/signed quote, service_role DELETE-only bypass for admin cleanup.';

-- ============================================================
-- 3. business_settings plan/trial guard
-- ============================================================

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
     AND NEW.trial_ends_at IS NOT DISTINCT FROM OLD.trial_ends_at THEN
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
     AND NEW.trial_ends_at IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Not permitted: plan/trial_ends_at can only be changed by a super admin, or self-cancelled to the free plan'
    USING ERRCODE = '42501';
END;
$function$;

COMMENT ON FUNCTION public.guard_business_settings_plan_trial() IS
  'Captured 2026-08-30 from live Production (Phase 1). BEFORE UPDATE guard on business_settings: only a super_admin (checked by CALLER''s own role, not the row being updated) may change plan/trial_ends_at to anything other than a genuine self-cancellation to the free plan.';

-- ============================================================
-- 4. Public/anonymous quote-interaction RPCs (the ones actually called by
--    PublicQuote.jsx / PublicQuoteEn.jsx — confirmed via Agent HE's direct
--    grep this session)
-- ============================================================

CREATE OR REPLACE FUNCTION public.public_approve_quote(p_quote_id uuid, p_signature_data_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  affected_rows int;
BEGIN
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'Missing quote id'
      USING ERRCODE = '22023';
  END IF;

  IF p_signature_data_url IS NULL
     OR length(p_signature_data_url) = 0 THEN
    RAISE EXCEPTION 'Missing signature'
      USING ERRCODE = '22023';
  END IF;

  IF length(p_signature_data_url) > 500000 THEN
    RAISE EXCEPTION 'Signature payload too large'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (
    p_signature_data_url
    ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
  ) THEN
    RAISE EXCEPTION 'Invalid signature format'
      USING ERRCODE = '22023';
  END IF;

  IF (length(p_signature_data_url) - 22) % 4 <> 0 THEN
    RAISE EXCEPTION 'Invalid signature format'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.quotes
  SET
    status = 'approved',
    signature = p_signature_data_url
  WHERE id = p_quote_id
    AND LOWER(COALESCE(status, '')) IN ('draft', 'sent')
    AND (signature IS NULL OR signature = '');

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Quote not found or cannot be approved'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.public_approve_quote(uuid, text) IS
  'Captured 2026-08-30 from live Production (Phase 1). The signature/approval RPC actually called by PublicQuote.jsx and PublicQuoteEn.jsx (confirmed via direct grep — the legacy approve_quote_public overloads are NOT called and were deliberately omitted from this capture, see this file''s header).';

CREATE OR REPLACE FUNCTION public.public_increment_quote_view(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.quotes
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_quote_id
    AND (auth.uid() IS NULL OR auth.uid() <> user_id);
END;
$function$;

COMMENT ON FUNCTION public.public_increment_quote_view(uuid) IS
  'Captured 2026-08-30 from live Production (Phase 1). Increments view_count only when the viewer is NOT the quote''s own owner (anonymous or a different account) — prevents an owner''s own preview from inflating the "Hot Quote" view counter.';

-- increment_quote_views(uuid) — captured faithfully alongside
-- public_increment_quote_view even though it looks functionally redundant
-- (no owner-exclusion check), because it exists live on Production and
-- this task's own instruction is to capture current required structure
-- faithfully, not silently consolidate. Flagged, not fixed.
CREATE OR REPLACE FUNCTION public.increment_quote_views(quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE quotes
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = quote_id;
END;
$function$;

COMMENT ON FUNCTION public.increment_quote_views(uuid) IS
  'Captured 2026-08-30 from live Production (Phase 1). Faithfully captured with NO explicit search_path, exactly matching its live Production definition — flagged as a pre-existing characteristic, not corrected here.';

-- ============================================================
-- 5. Auth-linked user-migration safety net
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_user_migration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  old_uid UUID;
BEGIN
  SELECT user_id INTO old_uid
  FROM public.business_settings
  WHERE email = NEW.email AND user_id != NEW.id
  LIMIT 1;

  IF old_uid IS NOT NULL THEN
    UPDATE public.business_settings SET user_id = NEW.id WHERE user_id = old_uid;
    UPDATE public.services SET user_id = NEW.id WHERE user_id = old_uid;
    UPDATE public.clients SET user_id = NEW.id WHERE user_id = old_uid;
    UPDATE public.quotes SET user_id = NEW.id WHERE user_id = old_uid;
    UPDATE public.expenses SET user_id = NEW.id WHERE user_id = old_uid;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_user_migration() IS
  'Captured 2026-08-30 from live Production (Phase 1). Legacy safety-net fired on every auth.users insert/update: re-links a business''s data to a NEW user_id if a matching business_settings.email is found under an OLD user_id. Confirmed by Agent HE this session as NOT exercised by normal fresh TEST signups (no pre-existing business_settings.email row would match) — inert-but-present for structural parity, not required for the core smoke-test flow. Faithfully captured with NO explicit search_path, matching Production exactly.';

-- ============================================================
-- 6. Triggers — attach the functions above to their tables
-- ============================================================

DROP TRIGGER IF EXISTS guard_quote_immutability_update ON public.quotes;
CREATE TRIGGER guard_quote_immutability_update
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quote_immutability();

DROP TRIGGER IF EXISTS guard_quote_immutability_delete_trigger ON public.quotes;
CREATE TRIGGER guard_quote_immutability_delete_trigger
  BEFORE DELETE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quote_immutability_delete();

DROP TRIGGER IF EXISTS guard_quote_items_immutability ON public.quote_items;
CREATE TRIGGER guard_quote_items_immutability
  BEFORE INSERT OR DELETE OR UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quote_child_immutability();

DROP TRIGGER IF EXISTS guard_quote_attachments_immutability ON public.quote_attachments;
CREATE TRIGGER guard_quote_attachments_immutability
  BEFORE INSERT OR DELETE OR UPDATE ON public.quote_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_quote_child_immutability();

DROP TRIGGER IF EXISTS guard_business_settings_plan_trial_update ON public.business_settings;
CREATE TRIGGER guard_business_settings_plan_trial_update
  BEFORE UPDATE ON public.business_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_business_settings_plan_trial();

-- `on_auth_user_created_migration` — on auth.users, a Supabase-managed
-- system table. CREATE TRIGGER on auth.users is supported for the
-- postgres/service-role-equivalent role Supabase CLI migrations run as;
-- guarded with DROP TRIGGER IF EXISTS first, matching this package's own
-- established style.
DROP TRIGGER IF EXISTS on_auth_user_created_migration ON auth.users;
CREATE TRIGGER on_auth_user_created_migration
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_migration();

-- ============================================================
-- ROLLBACK (not part of the forward migration — run manually, TEST only):
--
-- DROP TRIGGER IF EXISTS on_auth_user_created_migration ON auth.users;
-- DROP TRIGGER IF EXISTS guard_business_settings_plan_trial_update ON public.business_settings;
-- DROP TRIGGER IF EXISTS guard_quote_attachments_immutability ON public.quote_attachments;
-- DROP TRIGGER IF EXISTS guard_quote_items_immutability ON public.quote_items;
-- DROP TRIGGER IF EXISTS guard_quote_immutability_delete_trigger ON public.quotes;
-- DROP TRIGGER IF EXISTS guard_quote_immutability_update ON public.quotes;
-- DROP FUNCTION IF EXISTS public.handle_user_migration();
-- DROP FUNCTION IF EXISTS public.increment_quote_views(uuid);
-- DROP FUNCTION IF EXISTS public.public_increment_quote_view(uuid);
-- DROP FUNCTION IF EXISTS public.public_approve_quote(uuid, text);
-- DROP FUNCTION IF EXISTS public.guard_business_settings_plan_trial();
-- DROP FUNCTION IF EXISTS public.guard_quote_child_immutability();
-- DROP FUNCTION IF EXISTS public.guard_quote_immutability_delete();
-- DROP FUNCTION IF EXISTS public.guard_quote_immutability();
-- DROP FUNCTION IF EXISTS public.is_super_admin();
-- DROP FUNCTION IF EXISTS public.is_admin();
-- ============================================================
