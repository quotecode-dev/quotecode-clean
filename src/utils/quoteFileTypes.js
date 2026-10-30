// Codex SEC-ST-02 (Owner console 2026-10-30): the file types the quote-files bucket accepts (JSON and images are also written by the
// quote-presentation and subscription-authority functions) (migration 20261030700000 holds the SAME list;
// quoteFileTypes.test.js keeps them equal). An attachment of any other type - or of no type - is uploaded as a generic file
// (application/octet-stream): it is still kept and downloads, but the storage server never serves it as a page or a script.
export const QUOTE_FILE_TYPES = Object.freeze([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
  'text/plain', 'text/csv', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/x-zip-compressed',
  'application/json', 'application/octet-stream',
]);

export function uploadContentType(file) {
  const type = String(file?.type || '').toLowerCase().split(';')[0].trim();
  return QUOTE_FILE_TYPES.includes(type) ? type : 'application/octet-stream';
}
