// Task 28 - the ONE formatter of the owner's manual share text (business_share_defaults.share_text, migration 20261011110000), used by
// the app (WhatsApp, "copy message") and by send-quote-email (the email body, built on the server from server-derived values only).
// Pure: no I/O, no Deno / browser globals, importable from both runtimes.
//   - Only {customer} {business} {number} {total} are replaced. Any other text - including unknown {braces} - stays literal, so a typo
//     can never pull in another value.
//   - The caller passes values already formatted for the quote's market / language (amount via the money rules, number via the quote
//     number rule); here they are only cleaned (control / bidi-override characters removed, bounded).
//   - format 'text': plain text; for an RTL message every value is a bidi isolate (number / total: LRI..PDI, names: FSI..PDI).
//     format 'html': the template and every value are HTML-escaped; values are <bdi> (number / total dir="ltr"); newlines -> <br/>.
//   - Empty / missing template -> null: the caller keeps its existing built-in message unchanged.
//   - The quote link is NOT a variable: buildShareText appends it exactly once (URL encoding is the transport's job, e.g. WhatsApp).
export const SHARE_VARIABLES = Object.freeze(['{customer}', '{business}', '{number}', '{total}']);
export const SHARE_TEMPLATE_MAX = 600;
const LTR_KEYS = new Set(['number', 'total']);
const LRI = '⁦'; const FSI = '⁨'; const PDI = '⁩';
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‎‏‪-‮⁦-⁩]/g;

export function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const cleanValue = (v) => String(v ?? '').replace(UNSAFE, '').replace(/\s+/g, ' ').trim().slice(0, 200);

export function normalizeShareTemplate(template) {
  const t = String(template ?? '').replace(/\r\n?/g, '\n').replace(UNSAFE, '').trim();
  return t ? t.slice(0, SHARE_TEMPLATE_MAX) : null;
}

export function renderShareTemplate(template, vars = {}, { format = 'text', rtl = false } = {}) {
  const t = normalizeShareTemplate(template);
  if (!t) return null;
  const atom = (key) => {
    const v = cleanValue(vars?.[key]);
    if (format === 'html') return LTR_KEYS.has(key) ? `<bdi dir="ltr">${escapeHtml(v)}</bdi>` : `<bdi>${escapeHtml(v)}</bdi>`;
    if (!rtl || !v) return v;
    return `${LTR_KEYS.has(key) ? LRI : FSI}${v}${PDI}`;
  };
  return t.split(/(\{(?:customer|business|number|total)\})/).map((part) => {
    const m = part.match(/^\{(customer|business|number|total)\}$/);
    if (m) return atom(m[1]);
    return format === 'html' ? escapeHtml(part).replace(/\n/g, '<br/>') : part;
  }).join('');
}

// The full manual message: the owner's text + the quote link exactly once. null when there is no owner text (keep the built-in message).
export function buildShareText({ template, vars, link, linkLabel, rtl = false }) {
  const body = renderShareTemplate(template, vars, { format: 'text', rtl });
  if (body === null) return null;
  const url = String(link ?? '').trim();
  return url ? `${body}\n\n${linkLabel}\n${url}` : body;
}
