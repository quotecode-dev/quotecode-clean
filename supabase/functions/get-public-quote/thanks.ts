// Task 27 (P2, spec §6): the owner's optional thank-you for the customer (public.business_share_defaults, migration 20261011110000).
// Returned by get-public-quote ONLY for a quote the server already holds as signed (approved / paid AND a stored signature) - never before
// signing, never from a client flag. Explicit allowlist: the text, and the website only when the owner opted in and it is an https URL.
// Nothing redirects; the page shows a plain text and (optionally) a normal link the customer may choose to open.
const SIGNED_STATUSES = ['approved', 'paid'];
const WEBSITE_RE = /^https:\/\/[^\s<>"]+$/;

export function isServerSignedQuote(quote: { status?: unknown; signature?: unknown } | null | undefined): boolean {
  if (!quote) return false;
  const status = String(quote.status ?? '').toLowerCase();
  return SIGNED_STATUSES.includes(status) && typeof quote.signature === 'string' && quote.signature.trim().length > 0;
}

export type ThanksRow = { thanks_text?: unknown; website_url?: unknown; show_website_after_signature?: unknown };

// Task 28: the ONE thanks path for every public route that shows the customer page (legacy id + capability view). The quote's status and
// signature must be the SERVER-READ live values (never snapshot / client data), ownerId the server-verified owner of that quote; the row is
// read for that owner only. Not signed, no row, a missing table or any read failure -> null (never a placeholder thank-you).
export async function resolvePublicThanks(
  quote: { status?: unknown; signature?: unknown } | null | undefined,
  ownerId: unknown,
  readRow: ((ownerId: string) => Promise<ThanksRow | null>) | undefined,
): Promise<{ text: string | null; website_url: string | null } | null> {
  if (!readRow || typeof ownerId !== 'string' || !ownerId || !isServerSignedQuote(quote)) return null;
  let row: ThanksRow | null = null;
  try { row = await readRow(ownerId); } catch { return null; }
  return buildPublicThanks(quote, row);
}

export function buildPublicThanks(
  quote: { status?: unknown; signature?: unknown } | null | undefined,
  row: { thanks_text?: unknown; website_url?: unknown; show_website_after_signature?: unknown } | null | undefined,
): { text: string | null; website_url: string | null } | null {
  if (!isServerSignedQuote(quote) || !row) return null;
  const text = typeof row.thanks_text === 'string' && row.thanks_text.trim() ? row.thanks_text.trim().slice(0, 300) : null;
  const url = row.show_website_after_signature === true && typeof row.website_url === 'string' && row.website_url.length <= 300 && WEBSITE_RE.test(row.website_url)
    ? row.website_url : null;
  if (!text && !url) return null;
  return { text, website_url: url };
}
