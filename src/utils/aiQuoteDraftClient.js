// Task 21: browser call to the ai-quote-draft Edge Function. Sends ONLY the job description (identity/market/catalog are server-derived)
// and classifies every failure into a closed status the dialog can explain truthfully - a function that is not deployed on this server
// is reported as such, never as a generic error and never papered over with a fake draft.
// Task 22 (Owner report: "לא הצלחנו להתחבר לשירות ה-AI" although the connection works): a browser call to an Edge Function the server
// does not have usually FAILS AT FETCH LEVEL - the gateway's not-found answer carries no CORS headers, so the page never sees the 404 and
// functions-js reports FunctionsFetchError. A fetch failure is therefore no longer called a connection problem by itself: ONE
// credential-free `no-cors` GET of the same URL tells "the server answered (the service itself did not)" apart from "no answer at all".
// That check carries no Authorization header, no body and no cookies; a deployed ai-quote-draft rejects it (JWT required / POST only).
import { sanitizeDraftResponse, validateDraftRequest } from '../../supabase/functions/_shared/aiQuoteDraft.js';
import { isMeasurableUnit, resolveCalculationMethod } from './professionalQuoteItem';

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

export async function classifyDraftError(error, { functionUrl = null, fetchImpl } = {}) {
  const name = error?.name || '';
  if (name === 'FunctionsFetchError') {
    if (isOffline()) return 'offline';
    return (await serverAnswers(functionUrl, fetchImpl)) ? 'service_unreachable' : 'unavailable';
  }
  const { status, code } = await httpStatusOf(error);
  if (status === 404) return 'not_deployed';
  if (name === 'FunctionsRelayError') return 'server_error';
  if (status === 401 || status === 403) return 'unauthenticated';
  if (status === 409 && code === 'market_unresolved') return 'market_unresolved';
  if (status === 422) return 'no_items';
  if (status === 400) return 'invalid';
  if (status === 502 || status === 503 || status === 504) return 'provider';
  if (status != null && status >= 500) return 'server_error';
  return 'failed';
}

// The exact URL functions-js posts to (`<project>/functions/v1/<name>`), or null when the client does not expose it.
export function draftFunctionUrl(supabase) {
  const base = supabase?.functions?.url;
  return typeof base === 'string' && base ? `${base.replace(/\/+$/, '')}/${AI_QUOTE_DRAFT_FUNCTION}` : null;
}

// Resolves to { status: 'ok', subject, items } or { status: <closed failure code> }. Never throws.
export async function requestAiQuoteDraft(supabase, description, { fetchImpl } = {}) {
  const checked = validateDraftRequest({ description });
  if (!checked.ok) return { status: 'invalid' };
  const functionUrl = draftFunctionUrl(supabase);
  try {
    const { data, error } = await supabase.functions.invoke(AI_QUOTE_DRAFT_FUNCTION, { body: { description: checked.value.description } });
    if (error) return { status: await classifyDraftError(error, { functionUrl, fetchImpl }) };
    const draft = sanitizeDraftResponse(data);
    return draft ? { status: 'ok', ...draft } : { status: 'failed' };
  } catch (error) {
    return { status: await classifyDraftError(error, { functionUrl, fetchImpl }) };
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
      isFromCatalog: line.catalogId != null && line.unitPrice != null,
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
