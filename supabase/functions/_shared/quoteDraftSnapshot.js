// QUOTE DRAFT SNAPSHOT (Task 34, Owner: "שיפור הצעת המחיר" must analyse the quote that is open in the form - not counts, not a fixed text).
// ONE pure module shared by the dashboard (builds + digests the snapshot) and chat-ai (re-sanitizes it, renders the prompt block).
// Boundaries:
//   - sent ONLY on the user's explicit "review this quote" click (guidedIntent 'quote_improvement'), in its own request field, for that one
//     request - the automatic AI Help Context V4 (helpContext: no free text / money, TEKANGO_AI_ARCHITECTURE §51.2) is NOT widened;
//   - only what the review needs: the quote subject and, per item, description / quantity / unit / unit price / section name. Never the
//     client, contact details, tax ids, notes, terms, attachments, signatures or ids;
//   - bounded (40 items, 200 chars per text) and strictly shaped on BOTH sides; anything else is dropped.
// Task 35: a longer quote keeps its real item count (totalItems, only when truncated) so the model and the user are TOLD that only the
// first 40 were reviewed; a missing price (null) and an intentional 0 are rendered as different facts; price strings use the strict grammar.

export const DRAFT_SNAPSHOT_VERSION = 1;
export const DRAFT_SNAPSHOT_LIMITS = { items: 40, text: 200, subject: 120, section: 80 };
const UNITS = ['unit', 'm2', 'linear_meter', 'kg', 'hour', 'day'];

const text = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n).trim() : '');
const AMOUNT_GRAMMAR = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/; // '.' decimal point; ',' only as complete thousands groups
const amount = (v) => {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : (AMOUNT_GRAMMAR.test(String(v).trim()) ? Number(String(v).trim().replace(/,/g, '')) : NaN);
  return Number.isFinite(n) && n >= 0 && n <= 10000000 ? Math.round(n * 100) / 100 : null;
};

// Strict shape (browser before sending AND server on receipt). Returns null when there is nothing reviewable.
export function sanitizeDraftSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== DRAFT_SNAPSHOT_VERSION || !Array.isArray(raw.items)) return null;
  const items = raw.items.slice(0, DRAFT_SNAPSHOT_LIMITS.items)
    .map((it) => (it && typeof it === 'object' && !Array.isArray(it) ? {
      description: text(it.description, DRAFT_SNAPSHOT_LIMITS.text),
      quantity: amount(it.quantity),
      unit: UNITS.includes(it.unit) ? it.unit : null,
      unitPrice: amount(it.unitPrice),
      section: text(it.section, DRAFT_SNAPSHOT_LIMITS.section) || null,
    } : null))
    .filter((it) => it && it.description);
  if (!items.length) return null;
  const out = { version: DRAFT_SNAPSHOT_VERSION, subject: text(raw.subject, DRAFT_SNAPSHOT_LIMITS.subject) || null, items };
  // the real size of a longer quote: never below what was actually sent, never above 1000; only present when it differs
  const declared = Number.isInteger(raw.totalItems) ? Math.min(raw.totalItems, 1000) : 0;
  const total = Math.max(raw.items.length > DRAFT_SNAPSHOT_LIMITS.items ? Math.min(raw.items.length, 1000) : 0, declared);
  if (total > items.length) out.totalItems = total;
  return out;
}

// Stable digest of a sanitized snapshot (FNV-1a 32-bit over its JSON) - used only to tell "the form changed while the review ran".
export function draftSnapshotDigest(snapshot) {
  const s = JSON.stringify(snapshot || null);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// Task 35 (live TEST: an instruction hidden in an item text leaked an injected "total" into the review): an item text that reads as an
// instruction to the assistant is WITHHELD from the prompt (deterministic, before the model) - the model can only say it must be rewritten.
const INSTRUCTION_LIKE = /\b(?:ignore|disregard|forget)\s+(?:all|any|the|previous|prior|above|your)\b|\b(?:previous|prior|above)\s+instructions\b|\bsystem\s+prompt\b|\byou\s+are\s+now\b|(?:^|[^א-ת])(?:ו|ש)?(?:התעלם|התעלמי|התעלמו|תתעלם|תתעלמי)(?![א-ת])|הוראות\s+(?:ה)?קודמות/i;
export const isInstructionLike = (t) => INSTRUCTION_LIKE.test(String(t || ''));

// The prompt block chat-ai renders (numbered items, so the model can point at "#2"). Prices are plain numbers in the account currency.
export function buildDraftSnapshotBlock(snapshot) {
  if (!snapshot) return null;
  const lines = snapshot.items.map((it, i) => {
    const qty = it.quantity == null ? 'quantity: EMPTY' : `quantity: ${it.quantity}${it.unit && it.unit !== 'unit' ? ` ${it.unit}` : ''}`;
    const price = it.unitPrice == null ? 'unit price: EMPTY (missing)' : it.unitPrice === 0 ? 'unit price: 0 (intentionally free)' : `unit price: ${it.unitPrice}`;
    const description = isInstructionLike(it.description) ? '[ITEM TEXT WITHHELD: it contains instructions, not a work description - tell the user to rewrite it]' : it.description;
    return `#${i + 1}${it.section ? ` [section: ${it.section}]` : ''} ${description} | ${qty} | ${price}`;
  });
  const partial = snapshot.totalItems > snapshot.items.length;
  return ['BEGIN QUOTE DRAFT', `Subject: ${snapshot.subject || '(none)'}`,
    ...(partial ? [`NOTE: the quote is longer - only the first ${snapshot.items.length} of ${snapshot.totalItems} items are included; say that the review covers only these.`] : []),
    `Items (${partial ? `${snapshot.items.length} of ${snapshot.totalItems}` : snapshot.items.length}):`, ...lines, 'END QUOTE DRAFT'].join('\n');
}
