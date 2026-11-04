// Owner console 2026-11-03 (typed approval; spec docs/CODEX_SPEC_QUOTE_FROM_FILE_2026-11-03.md): "quote from a file" - the browser side.
// ONE PDF or JPG (8 MB) goes to the Edge Function quote-from-file as raw bytes (never stored there or here); the answer is draft lines
// with the price printed in the document, for the owner's review only. Nothing here keeps the file or the answer after the dialog.
export const QUOTE_FROM_FILE_FUNCTION = 'quote-from-file';
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** The accepted type of a picked file (the server checks the real bytes again), or null. */
export function fileTypeOf(file) {
  if (!file) return null;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (type === 'application/pdf' || (!type && name.endsWith('.pdf'))) return 'application/pdf';
  if (type === 'image/jpeg' || type === 'image/jpg' || (!type && /\.jpe?g$/.test(name))) return 'image/jpeg';
  return null;
}

/** The client-side check before anything is sent: 'unsupported_type' | 'too_large' | null (ok). */
export function checkPickedFile(file) {
  if (!fileTypeOf(file)) return 'unsupported_type';
  if (!(file.size > 0)) return 'unsupported_type';
  if (file.size > MAX_FILE_BYTES) return 'too_large';
  return null;
}

async function answerBody(error) {
  const ctx = error?.context;
  if (ctx && typeof ctx.json === 'function') { try { return await ctx.json(); } catch { return null; } }
  return null;
}

/** Resolves to { status: 'ok', currency, documentTotal, lines, allowance } or { status: <closed code>, allowance }. Never throws. */
export async function requestQuoteFromFile(supabase, file) {
  const contentType = fileTypeOf(file);
  if (!contentType) return { status: 'unsupported_type', allowance: null };
  try {
    const { data, error } = await supabase.functions.invoke(QUOTE_FROM_FILE_FUNCTION, { body: file, headers: { 'Content-Type': contentType } });
    if (!error && data && data.ok === true && Array.isArray(data.lines)) {
      return { status: 'ok', currency: typeof data.currency === 'string' ? data.currency : null,
        documentTotal: typeof data.documentTotal === 'number' ? data.documentTotal : null, lines: data.lines, allowance: data.status || null };
    }
    const body = error ? await answerBody(error) : data;
    if (error?.name === 'FunctionsFetchError') return { status: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unavailable', allowance: null };
    const code = typeof body?.code === 'string' ? body.code : 'failed';
    return { status: code, allowance: body?.status || null };
  } catch {
    return { status: 'failed', allowance: null };
  }
}

/** The caller's own allowance ({ limit, used, remaining, period, smartPack }) or null. */
export async function readQuoteFileAllowance(supabase) {
  try {
    const { data, error } = await supabase.rpc('quote_file_read_status');
    return error || !data ? null : data;
  } catch { return null; }
}

const norm = (s) => String(s || '').toLowerCase().replace(/[\s"'״׳`.,\-_/]+/g, ' ').trim();

/** A catalog price only for an EXACT name match (after spacing / punctuation); anything looser stays empty for the owner to fill. */
export function catalogPriceFor(description, catalog) {
  const key = norm(description);
  if (!key) return null;
  const hit = (Array.isArray(catalog) ? catalog : []).find((c) => c && norm(c.name) === key && Number.isFinite(Number(c.price)) && Number(c.price) >= 0);
  return hit ? { catalogId: hit.id, price: Number(hit.price) } : null;
}

/** "your price" text -> a number (>= 0, 2 decimals), or null when empty / not a number. "0" is a valid price. */
export function parseOwnPrice(text) {
  const t = String(text ?? '').trim().replace(/,/g, '');
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** The comparison of the ticked lines: both totals and the gap in percent (null when it would mislead). */
export function compareTotals(rows, { sameCurrency }) {
  let doc = 0; let own = 0; let docComplete = true;
  for (const r of rows) {
    const q = Number(r.quantity);
    const qty = Number.isFinite(q) && q > 0 ? q : null;
    const docLine = r.docUnitPrice != null && qty != null ? r.docUnitPrice * qty : (r.docLineTotal != null ? r.docLineTotal : null);
    if (docLine == null) docComplete = false; else doc += docLine;
    if (r.ownPrice != null && qty != null) own += r.ownPrice * qty;
  }
  doc = Math.round(doc * 100) / 100; own = Math.round(own * 100) / 100;
  const gapPercent = sameCurrency && docComplete && doc > 0 ? Math.round(((own - doc) / doc) * 1000) / 10 : null;
  return { docTotal: docComplete ? doc : null, ownTotal: own, gapPercent };
}
