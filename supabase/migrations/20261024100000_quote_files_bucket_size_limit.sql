-- ============================================================================================================================
-- 20261024100000_quote_files_bucket_size_limit.sql  -  the quote files storage refuses any single file above 4 MB
-- tekango-migration-contract: mode=transaction replay=required
-- ----------------------------------------------------------------------------------------------------------------------------
--   Owner console 2026-10-24 (typed: "מאשר" to "a 4 MB limit on every file in the quote files storage"). The 3 MB attachment limit is checked
--   by the editor and the attachment row's real stored size by the database (20261023310000 / 20261024000100), but the storage itself had no
--   limit (NULL since the capture, 20260830000003): a file could be replaced after its row was saved, or sent around the editor. Now the
--   storage refuses any object above 4 MB (4 * 1024 * 1024 bytes) - the largest legitimate object there: quote attachments are at most 3 MB
--   (editor), quote-presentation images at most 4 MB (MAX_IMAGE_BYTES, after the browser's downscale they are usually far below 1 MB).
--   Signed quotes are not stored in this bucket. Existing objects are not touched; other buckets are not touched.
-- Rollback of THIS file: UPDATE storage.buckets SET file_size_limit = NULL WHERE id = 'quote-files';
-- ============================================================================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'quote-files') THEN
    RAISE EXCEPTION 'the quote-files bucket does not exist';
  END IF;
END
$do$;

UPDATE storage.buckets SET file_size_limit = 4194304 WHERE id = 'quote-files';
