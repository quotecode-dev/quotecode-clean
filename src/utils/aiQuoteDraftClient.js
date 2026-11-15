// Task 21: browser call to the ai-quote-draft Edge Function. Sends ONLY the job description (identity/market/catalog are server-derived)
// and classifies every failure into a closed status the dialog can explain truthfully - a function that is not deployed on this server
// is reported as such, never as a generic error and never papered over with a fake draft.
// Task 22 (Owner report: "לא הצלחנו להתחבר לשירות ה-AI" although the connection works): a browser call to an Edge Function the server
// does not have usually FAILS AT FETCH LEVEL - the gateway's not-found answer carries no CORS headers, so the page never sees the 404 and
// functions-js reports FunctionsFetchError. A fetch failure is therefore no longer called a connection problem by itself: ONE
// credential-free `no-cors` GET of the same URL tells "the server answered (the service itself did not)" apart from "no answer at all".
// That check carries no Authorization header, no body and no cookies; a deployed ai-quote-draft rejects it (JWT required / POST only).
import { sanitizeDraftResponse, validateDraftRequest } from '../../supabase/functions/_shared/aiQuoteDraft.js';
import { isMeasurableUnit, resolveCalculationMethod, getActiveQuantity } from './professionalQuoteItem';
import { defaultGroupName } from './quoteGroups';

export const AI_QUOTE_DRAFT_FUNCTION = 'ai-quote-draft';

async function httpStatusOf(error) {
  const ctx = error?.context;
  if (ctx && typeof ctx.status === 'number') {
    let code;
    try { code = (await ctx.clone().json())?.code ?? null; } catch { code = null; }
    return { status: ctx.status, code };
  }
  return { status: null, code: null };
}

// Resolves true when the server at `functionUrl` gave ANY answer (an opaque `no-cors` response), false when nothing answered.
export async function serverAnswers(functionUrl, fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null)) {
  if (!functionUrl || !fetchImpl) return false;
  try {
    // no `redirect` option: the Fetch spec rejects any redirect mode other than 'follow' together with mode 'no-cors'
    await fetchImpl(functionUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit' });
    return true;
  } catch {
    return false;
  }
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

// Owner 2026-10-23 (morning report item 10): a long description makes the model's answer run past its length and arrive cut (the server
// answers 502 malformed_provider_response) - said as "the description may be too long", never as "the service returned nothing".
export const LONG_DESCRIPTION_CHARS = 800;

export async function classifyDraftError(error, { functionUrl = null, fetchImpl, descriptionLength = 0 } = {}) {
  const name = error?.name || '';
  if (name === 'FunctionsFetchError') {
    if (isOffline()) return 'offline';
    return (await serverAnswers(functionUrl, fetchImpl)) ? 'service_unreachable' : 'unavailable';
  }
  const { status, code } = await httpStatusOf(error);
  if (status === 404) return 'not_deployed';
  if (name === 'FunctionsRelayError') return 'server_error';
  // Owner 2026-10-20 (typed L-17 approval): the AI smart quote is SMART PACK once the plan system is enforced
  if (status === 403 && code === 'smart_pack_required') return 'smart_pack_required';
  // Owner console 2026-11-06 (typed night-task approval): the month's SMART PACK usage is used up (the usage meter)
  if (status === 403 && code === 'budget_exhausted') return 'budget_exhausted';
  if (status === 401 || status === 403) return 'unauthenticated';
  if (status === 409 && code === 'market_unresolved') return 'market_unresolved';
  if (status === 422) return 'no_items';
  if (status === 400) return 'invalid';
  if (status === 502 && code === 'malformed_provider_response' && descriptionLength >= LONG_DESCRIPTION_CHARS) return 'too_long';
  if (status === 429 || status === 502 || status === 503 || status === 504) return 'provider'; // busy / temporarily unavailable (Codex spec item 10)
  if (status != null && status >= 500) return 'server_error';
  return 'failed';
}

// The exact URL functions-js posts to (`<project>/functions/v1/<name>`), or null when the client does not expose it.
export function draftFunctionUrl(supabase) {
  const base = supabase?.functions?.url;
  return typeof base === 'string' && base ? `${base.replace(/\/+$/, '')}/${AI_QUOTE_DRAFT_FUNCTION}` : null;
}

// Resolves to { status: 'ok', subject, items, changes } or { status: <closed failure code> }. Never throws.
// Owner console 2026-11-06 (release B): + quote = the open quote (lines, notes, discount - never a price) so the AI can change it
// 2026-11-12 (unified quote, spec 5): structure = ask for places / rooms too (a new quote that is not divided yet)
// 2026-11-13 (Owner: the headings are a TREE): tree = floors / apartments / rooms with parents, each copy its own heading (on top of structure)
export async function requestAiQuoteDraft(supabase, description, { fetchImpl, quote = null, structure = false, tree = false } = {}) {
  const checked = validateDraftRequest({ description, ...(quote ? { quote } : {}), ...(structure ? { structure: true, ...(tree ? { tree: true } : {}) } : {}) });
  if (!checked.ok) return { status: 'invalid' };
  const functionUrl = draftFunctionUrl(supabase);
  try {
    const body = { description: checked.value.description, ...(checked.value.quote ? { quote: checked.value.quote } : {}), ...(checked.value.structure ? { structure: true } : {}), ...(checked.value.tree ? { tree: true } : {}) };
    const { data, error } = await supabase.functions.invoke(AI_QUOTE_DRAFT_FUNCTION, { body });
    if (error) return { status: await classifyDraftError(error, { functionUrl, fetchImpl, descriptionLength: checked.value.description.length }) };
    const draft = sanitizeDraftResponse(data);
    return draft ? { status: 'ok', ...draft } : { status: 'failed' };
  } catch (error) {
    return { status: await classifyDraftError(error, { functionUrl, fetchImpl, descriptionLength: checked.value.description.length }) };
  }
}

// Draft lines -> quote form items. A line without a catalog price keeps an EMPTY price so the form asks the user for it; nothing is
// invented. Task 33: the reviewed quantity + unit travel as the SAME item shapes the item wizard / unit selector already produce:
//   - no unit or "unit": the plain item (quantity = the reviewed count);
//   - m2 / linear_meter: a professional measured item whose quantity is the stated (manual) amount - pricing_unit + quantity_source
//     'manual' + calculation_method 'manual' + calculated_quantity, no measurement rows (the user can add them in the form later);
//   - kg / hour / day: a professional quantity item (pricing_unit + manual quantity), exactly as the unit selector stores it.
// The dialog never applies a line without a positive quantity (the user fills or unticks it first).
/** 2026-11-13 (tree): the suggested headings in tree order with their depth (parents first; a heading is never hidden) */
export function draftPlaceRows(places) {
  const list = Array.isArray(places) ? places : []; const keys = new Set(list.map((p) => p.key)); const out = []; const seen = new Set();
  const walk = (parent, depth) => list.filter((p) => ((p.parent && keys.has(p.parent)) ? p.parent : null) === parent)
    .forEach((p) => { if (seen.has(p.key) || depth > 3) return; seen.add(p.key); out.push({ place: p, depth }); walk(p.key, depth + 1); });
  walk(null, 0); list.forEach((p) => { if (!seen.has(p.key)) out.push({ place: p, depth: 0 }); });
  return out;
}
/** 2026-11-13 (tree): the path of a heading from the top ([] = a line of the whole quote) */
export function draftPlacePath(places, key) {
  const byKey = new Map((Array.isArray(places) ? places : []).map((p) => [p.key, p])); const path = []; const seen = new Set();
  for (let k = key; k && byKey.has(k) && !seen.has(k) && path.length < 4; k = byKey.get(k).parent || null) { seen.add(k); path.unshift(byKey.get(k)); }
  return path;
}
/** 2026-11-13 (Owner: the headings are a TREE, no "× N" in a new quote): reviewed places -> NEW headings appended after `existing` (never
 *  replacing or merging them), nested by parent_key; each drafted line -> its own deepest heading (none = the whole quote). A place still
 *  carrying a count N (a group too big to expand on the server) -> N sibling headings, its lines repeated in each copy only when the
 *  text said identical. No repeat_count, no limit of 20. */
export function aiPlacesToSections(places, lines, drafted, existing = [], { isHebrew = true, stamp = String(Date.now()) } = {}) {
  const rows = draftPlaceRows(places).map((r) => r.place);
  const firstOrder = (existing || []).reduce((m, s) => Math.max(m, Number(s?.sort_order) || 0), -1) + 1;
  const fresh = []; const copiesOf = new Map(); const fills = new Map(); // fills: a heading key -> it takes the place's lines too
  const siblings = (kind, parentKey) => [...(existing || []), ...fresh].filter((s) => s && s.kind === kind && (s.parent_key || null) === parentKey).length;
  for (const p of rows) {
    const n = Math.max(1, Math.floor(Number(p.count)) || 1);
    // 2026-11-13 (system-impact review A3): a place under a parent of N copies is made under EVERY copy of that parent (never only the first);
    // a copy takes the lines only when every copy level above it said "identical"
    const parents = p.parent ? (copiesOf.get(p.parent) || [null]) : [null];
    const keys = [];
    for (const parentKey of parents) {
      for (let i = 0; i < n; i += 1) {
        const key = `tmp_section_${stamp}_${fresh.length}`; keys.push(key);
        fills.set(key, (parentKey == null || fills.get(parentKey) !== false) && (i === 0 || p.identical === 'yes'));
        fresh.push({ key, kind: p.kind, parent_key: parentKey, sort_order: firstOrder + fresh.length,
          name: p.name ? (n > 1 ? `${p.name} ${i + 1}` : p.name) : defaultGroupName(p.kind, siblings(p.kind, parentKey), isHebrew) });
      }
    }
    copiesOf.set(p.key, keys);
  }
  const extra = [];
  const items = drafted.map((it, i) => {
    const place = lines[i] && lines[i].place; const keys = copiesOf.get(place) || [];
    keys.slice(1).filter((k) => fills.get(k)).forEach((k) => extra.push({ ...it, section_key: k }));
    return { ...it, section_key: keys[0] || null };
  });
  return { sections: fresh, items: [...items, ...extra] };
}

export function draftLinesToQuoteItems(lines) {
  return (Array.isArray(lines) ? lines : []).map((line) => {
    const quantity = Number(line.quantity);
    const base = {
      description: line.description,
      quantity: String(quantity),
      unit_price: line.unitPrice != null ? String(line.unitPrice) : '',
      // Owner 2026-11-11 (finding 3): a price from the user's own description is not a catalog price
      isFromCatalog: line.catalogId != null && line.unitPrice != null && line.priceSource !== 'description',
      // 2026-11-12 (unified quote, spec 5): the room the description names (the place is mapped to its group by the caller)
      ...(typeof line.room === 'string' && line.room ? { room: line.room } : {}),
    };
    if (!line.unit || line.unit === 'unit') return base;
    return {
      ...base,
      quantity: isMeasurableUnit(line.unit) ? '1' : String(quantity),
      pricing_unit: line.unit,
      quantity_source: 'manual',
      calculation_method: resolveCalculationMethod(line.unit, 'manual'),
      calculated_quantity: quantity,
      ...(isMeasurableUnit(line.unit) ? { measurements: [] } : {}),
    };
  });
}

// Owner console 2026-11-06 (typed night-task approval; release B - "הצעה חכמה" and "עריכה חכמה" handle every section): the open quote
// the AI may see and change. ONLY real lines (an untouched placeholder or the local example is never sent); NO price is sent - the
// prices stay in the form (the dialog shows them from here, the model never sees them). refs = the position of each real line.
export function aiQuoteSnapshot(items, notes, discount, isRealItem = () => true) {
  const real = (Array.isArray(items) ? items : []).filter((it) => it && isRealItem(it));
  const d = Number(discount);
  const snapshot = {
    items: real.map((it, i) => ({
      ref: i + 1, description: String(it.description || ''), quantity: getActiveQuantity(it) || null, unit: it.pricing_unit || null,
      unitPrice: it.unit_price === '' || it.unit_price == null ? null : Number(it.unit_price),
    })),
    notes: String(notes || ''),
    discountPercent: Number.isFinite(d) && d > 0 ? d : 0,
  };
  return { snapshot, real, empty: real.length === 0 && !snapshot.notes.trim() && !snapshot.discountPercent };
}

/** one reviewed change applied to ONE form item - the same item shapes the item window and the quick dialog store */
export function applyDraftUpdateToItem(item, update) {
  let next = { ...item };
  if (update.description) next.description = update.description;
  if (update.unitPrice != null) next.unit_price = String(update.unitPrice);
  // Owner console 2026-11-07 (F03): a unit-only change keeps the line's current quantity and takes the new unit's shape
  const unitOnly = update.quantity == null && update.unit && update.unit !== (item.pricing_unit || 'unit');
  if (update.quantity != null || unitOnly) {
    const q = update.quantity != null ? Number(update.quantity) : Number(getActiveQuantity(item)) || 1;
    const unit = update.unit && update.unit !== (item.pricing_unit || 'unit') ? update.unit : null;
    if (unit) {
      // another unit: the line takes the unit's own shape (as a drafted line of that unit), its price and description kept
      const shaped = draftLinesToQuoteItems([{ description: next.description, quantity: q, unit, unitPrice: null, catalogId: null }])[0];
      next = { ...next, ...shaped, description: next.description, unit_price: next.unit_price, isFromCatalog: item.isFromCatalog };
      delete next.price_link_id; // Owner console 2026-11-08 (stage 3): another billing basis leaves the shared-price group
      if (unit === 'unit') {
        delete next.pricing_unit; delete next.calculated_quantity; delete next.quantity_source; delete next.calculation_method;
        // Codex review 2026-11-09 (item 4 of section 08): an explicit change to units is a units row - its sizes go with the old basis and
        // the row is marked "units", so one unit never reopens as a fixed amount (a fixed amount and "1 unit" store the same line)
        delete next.measurements; delete next.quote_item_measurements;
        next._billing = 'units';
      }
    } else if (isMeasurableUnit(item.pricing_unit)) {
      // a measured line: the stated amount overrides the measurements (as the item window's manual override)
      next = { ...next, calculated_quantity: q, quantity_source: 'manual', calculation_method: 'manual' };
    } else if (item.calculated_quantity !== undefined && item.calculated_quantity !== null && item.calculated_quantity !== '') {
      next.calculated_quantity = q;
    } else {
      next.quantity = String(q);
    }
  }
  return next;
}

/** the notes after a reviewed notes change */
export function applyDraftNotes(current, notes) {
  if (!notes) return current;
  if (notes.action === 'clear') return '';
  if (notes.action === 'replace') return notes.text;
  const prev = String(current || '').trimEnd();
  return prev ? `${prev}\n${notes.text}` : notes.text;
}
