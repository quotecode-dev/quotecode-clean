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
export async function requestAiQuoteDraft(supabase, description, { fetchImpl, quote = null, structure = false } = {}) {
  const checked = validateDraftRequest({ description, ...(quote ? { quote } : {}), ...(structure ? { structure: true } : {}) });
  if (!checked.ok) return { status: 'invalid' };
  const functionUrl = draftFunctionUrl(supabase);
  try {
    const body = { description: checked.value.description, ...(checked.value.quote ? { quote: checked.value.quote } : {}), ...(checked.value.structure ? { structure: true } : {}) };
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
