-- PROFLOW — Full Runtime TEST Environment Build, Phase 1 (schema capture)
-- Part 4 of 4: STORAGE (quote-files bucket + object policies)
--
-- ============================================================
-- ⚠️⚠️⚠️ TEST / BOOTSTRAP MIGRATION — NOT A PRODUCTION FORWARD-MIGRATION
-- PATH. READ BEFORE APPLYING ANYWHERE. ⚠️⚠️⚠️
-- ============================================================
-- POINT-IN-TIME CAPTURE of Production's Storage bucket/policy posture as
-- it existed on 2026-08-26 — NOT a forward migration. Production already
-- contains this bucket/these policies NATIVELY; DO NOT apply this file
-- to Production merely because it exists in `supabase/migrations/` — if
-- Production's live Storage config has drifted since capture, a
-- `db push`/`--include-all` against Production (ref
-- `ixabnzhjeqevtbhdfswv`) would silently OVERWRITE that drift with this
-- stale snapshot. Any future Production use requires its own completely
-- separate, fresh audit and explicit Owner + ChatGPT authorization. See
-- `20260830000000_capture_base_schema_tables.sql`'s header (Part 1) for
-- the full context of this capture package, including the
-- RETIMESTAMPED-2026-08-30 note (PROFLOW_HANDOFF.md §18.CP).
--
-- ⚠️ STORAGE REMAINS ITS OWN SEPARATE FUTURE PHASE. Retimestamping this
-- file alongside Parts 1–3 (so it sorts after the already-applied
-- 20260827*/20260828* chain, avoiding a recurrence of the same
-- migration-history-order blocker documented in §18.CO/§18.CP) does
-- **NOT** authorize its apply. It remains explicitly EXCLUDED from the
-- current Phase 2 DB apply scope (Parts 1–3 only) and stays a distinct,
-- separately-authorized future Phase 4 step — this file's presence in
-- `supabase/migrations/`, its retimestamping, and even a future Phase 2
-- apply of Parts 1–3 are each individually NOT authorization to apply
-- this file.
--
-- Deliberately kept in its own separate migration file, distinct from
-- Parts 1–3 (tables/functions/RLS), per this task's own explicit
-- permission (§9): "If Storage objects cannot safely/idiomatically be
-- represented in the same migration mechanism, document the exact future
-- Phase 4 action instead and keep Phase 1 DB migration scope clean." This
-- file IS expressed as ordinary SQL (storage.buckets/storage.objects
-- policies are plain Postgres tables/RLS under the `storage` schema, which
-- IS a supported migration mechanism), so it is included here as a
-- complete, ready-to-review artifact — but its isolation into its own file
-- means the Owner may choose, in a future separately-authorized decision,
-- to apply it alongside Parts 1–3 or hold it back as its own explicit
-- Phase 4 step, without needing any file restructuring either way.
--
-- Depends on nothing else in this capture package (storage is independent
-- of the public-schema tables) — functional ordering relative to Parts
-- 1–3 does not matter; it is retimestamped last (…0003) among the four
-- purely to preserve narrative/package clarity and to avoid recreating
-- the migration-history-order blocker for its own eventual Phase 4 apply.

-- ============================================================
-- 1. Bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-files', 'quote-files', true)
ON CONFLICT (id) DO NOTHING;

-- Production's bucket has no file_size_limit or allowed_mime_types
-- restriction set (both NULL) — faithfully left unset here, not a gap
-- being silently introduced or corrected.

-- ============================================================
-- 2. Object-level policies (on storage.objects, scoped to this bucket)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated owners upload quote files" ON storage.objects;
CREATE POLICY "Authenticated owners upload quote files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-files'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "Public Access to Quote Files" ON storage.objects;
CREATE POLICY "Public Access to Quote Files" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'quote-files');

-- Confirmed via a direct follow-up query this task (full USING/WITH CHECK
-- body, not just cmd/roles): the INSERT policy also requires the first
-- path segment of the uploaded object's name to equal the uploader's own
-- auth.uid() — matching Dashboard.jsx's own upload path construction
-- (`${session.user.id}/${fileName}`). This detail is now captured
-- verbatim, not assumed.

-- ============================================================
-- ROLLBACK (not part of the forward migration — run manually, TEST only):
--
-- DROP POLICY IF EXISTS "Public Access to Quote Files" ON storage.objects;
-- DROP POLICY IF EXISTS "Authenticated owners upload quote files" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'quote-files';
-- ============================================================
