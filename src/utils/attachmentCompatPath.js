// MD-2 (First-LIVE cutover compatibility, 2026-09-25): the attachment compatibility route.
//
// The current save flow stores an attachment's `file_url` as its STORAGE PATH (buildAttachmentPath in quoteSaveOrchestrator.js:
// `<ownerUid>/<quoteId>_<stamp>.<ext>`), and opens it through a short-lived signed URL. A browser tab still running the LIVE-baseline
// frontend (7cd78ea; tabs never auto-reload) renders that value as the link target of an anchor on /dashboard, so the browser resolves
// it RELATIVE to the dashboard URL: `/<ownerUid>/<quoteId>_<stamp>.<ext>` (or `/dashboard/<...>` from a `/dashboard/` URL). Vercel
// rewrites every path to index.html, so that new tab loads the CURRENT frontend - which recognizes exactly that shape here and opens
// the file through the same authorized signed-URL path the dashboard uses. Nothing else is matched: no other bucket, no other key
// shape, no encoded character, no traversal. The storage path is rebuilt from the validated groups, never taken from raw input.
import { QUOTE_FILES_BUCKET, createAttachmentAccessUrl } from './quoteSaveOrchestrator';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ATTACHMENT_PATH_RE = new RegExp(`^/(?:dashboard/)?(${UUID})/(${UUID})_(\\d{1,16})\\.([a-z0-9]{1,10})$`);

export function matchAttachmentCompatPath(pathname) {
  if (typeof pathname !== 'string') return null;
  const m = ATTACHMENT_PATH_RE.exec(pathname);
  if (!m) return null;
  const [, ownerId, quoteId, stamp, ext] = m;
  return { ownerId, quoteId, storagePath: `${ownerId}/${quoteId}_${stamp}.${ext}` };
}

// A signed URL is followed only when it is exactly the configured Supabase project's signed-object endpoint for THIS object
// (same origin, https unless the project URL itself is http, the quote-files bucket, this storage path) - never an open redirect.
export function isTrustedSignedAttachmentUrl(signedUrl, supabaseUrl, storagePath) {
  let target; let project;
  try { target = new URL(String(signedUrl)); project = new URL(String(supabaseUrl)); } catch { return false; }
  if (!/^https?:$/.test(project.protocol) || target.protocol !== project.protocol || target.origin !== project.origin) return false;
  if (target.username || target.password) return false;
  return target.pathname === `/storage/v1/object/sign/${QUOTE_FILES_BUCKET}/${storagePath}` && target.searchParams.has('token');
}

// Authorization order (see src/components/AttachmentCompatRoute.jsx): session -> owner folder == user -> RLS-visible attachment row ->
// signed under the user's JWT -> trusted signed URL. The first two refusals happen before any query or signing request.
export const SIGNED_URL_SECONDS = 60;

export async function resolveAttachmentCompatOpen({ client, match, supabaseUrl }) {
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return { state: 'signin' };
  if (userId !== match.ownerId) return { state: 'unavailable' };
  const { data: rows, error: rowError } = await client.from('quote_attachments').select('id').eq('storage_path', match.storagePath).limit(1);
  if (rowError) return { state: 'error' };
  if (!rows || rows.length === 0) return { state: 'unavailable' };
  const { url } = await createAttachmentAccessUrl(client, { storage_path: match.storagePath }, SIGNED_URL_SECONDS);
  if (!url) return { state: 'unavailable' };
  if (!isTrustedSignedAttachmentUrl(url, supabaseUrl, match.storagePath)) return { state: 'error' };
  return { state: 'redirect', url };
}
