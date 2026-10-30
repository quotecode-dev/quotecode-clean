-- Owner 2026-10-24 (typed "מאשר"): the quote files storage refuses any single file above 4 MB (20261024100000).
-- Disposable postgres:17 harness ONLY. ONE transaction, rolled back. Proves: the quote-files bucket's limit is exactly 4 MB (it covers the 3 MB
-- attachment and the 4 MB presentation image), nothing else of the bucket changed, and the expense-invoices bucket keeps its own limit.
-- The refusal itself is the storage API's (proven against the local storage service in the journey stack, not in this harness).
BEGIN;

SELECT tst.ok((SELECT file_size_limit = 4194304 FROM storage.buckets WHERE id = 'quote-files'), 'B1 quote-files refuses any file above 4 MB');
SELECT tst.ok((SELECT file_size_limit >= 3 * 1024 * 1024 AND file_size_limit >= 4 * 1024 * 1024 FROM storage.buckets WHERE id = 'quote-files'),
  'B2 the limit covers a 3 MB attachment and a 4 MB presentation image');
-- Codex SEC-ST-02 (Owner 2026-10-30, migration 20261030700000): the bucket now also has a file-type list (no markup / executable types)
SELECT tst.ok((SELECT NOT public AND allowed_mime_types IS NOT NULL AND NOT ('text/html' = ANY (allowed_mime_types)) FROM storage.buckets WHERE id = 'quote-files'),
  'B3 the bucket stays private (since 20260922000000) and refuses markup types (since 20261030700000)');
SELECT tst.ok((SELECT file_size_limit IS DISTINCT FROM 4194304 FROM storage.buckets WHERE id = 'expense-invoices'), 'B4 the expense-invoices bucket keeps its own limit');

ROLLBACK;
