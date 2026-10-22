// Customer Twin ("בדיקת הלקוח", Owner night task 2026-10-22; Codex review fixes 2026-10-23): the dashboard side - builds the quote
// payload (only quote content; the shared sanitizer drops everything else and removes the names / address the editor knows), reads the
// caller's counters and asks the Edge Function customer-twin through the fresh-session path (CT-09). Never throws.
import { sanitizeTwinQuote, twinTooLong, TWIN_QUOTE_VERSION } from '../../supabase/functions/_shared/customerTwin.js';
import { getActiveQuantity } from './professionalQuoteItem';
import { calculateQuoteFinancials } from './regionConfig';
import { isQuoteAcceptanceExpired } from './quoteValidity';
import { makeInvokeWithFreshSession } from '../shared/invokeWithFreshSession';

export const CUSTOMER_TWIN_FUNCTION = 'customer-twin';
const num = (v) => (v === '' || v == null ? null : Number(v));
const validityOf = (validUntil, market) => (!validUntil ? 'none'
  : isQuoteAcceptanceExpired(validUntil, market === 'INTERNATIONAL' ? 'International' : 'Local') ? 'expired' : 'ok');
// each editor row keeps ITS number (ref) before empty rows are dropped - a suggestion lands on its own item (CT-02)
const itemsOf = (rows) => (rows || []).map((it, i) => ({
  ref: i + 1, description: it.description, specification: it.specification, quantity: getActiveQuantity(it),
  unit: it.pricing_unit || null, unitPrice: num(it.unit_price), priceMissing: it.price_missing === true || it.unit_price === '' || it.unit_price == null,
}));

function build(raw, personal) {
  if (twinTooLong(raw)) return { quote: null, tooLong: true };
  return { quote: sanitizeTwinQuote(raw, { personal }), tooLong: false };
}

/** the quote open in the editor -> { quote, tooLong } (market = the account's; the server uses its own anyway) */
export function twinPayloadFromEditor({ market, currency, quoteSubject, items, terms, warranty, validUntil, taxRate, clientType, discount, financials = {}, personal = [] }) {
  return build({
    version: TWIN_QUOTE_VERSION, market, currency, subject: quoteSubject, items: itemsOf(items), terms, warranty, validUntil,
    validity: validityOf(validUntil, market), taxRate: num(taxRate), clientType, discountPercent: num(discount),
    // CT-08: the editor's own canonical amounts (calculateQuoteFinancials)
    facts: { subtotal: financials.subtotal, discountAmount: financials.discountAmount, netAmount: financials.netAmount, taxAmount: financials.taxAmount, total: financials.total },
  }, personal);
}

/** a saved quote row of the list (with quote_items) -> { quote, tooLong }; the stored amounts are the facts */
export function twinPayloadFromQuoteRow(quote, market, personal = []) {
  if (!quote) return { quote: null, tooLong: false };
  // the saved order (PostgREST returns rows in no promised order - the same sort as the editor, Dashboard handleEditClick)
  const rows = (quote.quote_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const f = calculateQuoteFinancials({ country: market === 'INTERNATIONAL' ? 'International' : 'Local', clientType: quote.client_type,
    items: [{ quantity: 1, unit_price: Number(quote.subtotal) || 0 }], discount: quote.discount, taxRateOverride: typeof quote.tax_rate === 'number' ? quote.tax_rate : undefined });
  return build({
    version: TWIN_QUOTE_VERSION, market, currency: quote.currency, subject: quote.quote_subject || quote.subject, items: itemsOf(rows),
    terms: quote.terms, warranty: quote.warranty, validUntil: quote.valid_until, validity: validityOf(quote.valid_until, market),
    taxRate: num(quote.tax_rate), clientType: quote.client_type, discountPercent: num(quote.discount),
    facts: { subtotal: num(quote.subtotal), discountAmount: f.discountAmount, netAmount: f.netAmount, taxAmount: f.taxAmount, total: num(quote.total) },
  }, personal);
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** the counters: { state: 'ok', status } | { state: 'not_deployed' | 'unavailable' } */
export async function fetchTwinStatus(supabase) {
  try {
    const { data, error } = await supabase.rpc('customer_twin_status');
    if (error) {
      const code = String(error.code || ''); const status = Number(error.status || 0);
      return { state: code === 'PGRST202' || code === '42883' || status === 404 ? 'not_deployed' : 'unavailable' };
    }
    return isObj(data) && data.ok === true ? { state: 'ok', status: data } : { state: 'unavailable' };
  } catch { return { state: 'unavailable' }; }
}

const KNOWN = new Set(['quota_exhausted', 'smart_pack_required', 'in_progress', 'too_many_failures', 'market_unresolved', 'nothing_to_check',
  'quote_too_long', 'provider_failure', 'unauthenticated']);
/** { state: 'ok', analysis, checklist, status, cached, analyzedAt, saved, refunded } | { state: <closed code>, status?, refunded? } */
export async function requestCustomerTwin(supabase, quote) {
  if (!quote) return { state: 'nothing_to_check' };
  try {
    const invoke = makeInvokeWithFreshSession(supabase);
    const { data, error } = await invoke(CUSTOMER_TWIN_FUNCTION, { body: { quote } });
    if (error) {
      if (error.code === 'signed_out') return { state: 'unauthenticated' };
      if (error.name === 'FunctionsFetchError') return { state: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'not_deployed' };
      const ctx = error.context;
      let body = null;
      try { body = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json() : null; } catch { body = null; }
      // a function that does not exist on this server (404 with the platform's own body, not one of ours)
      if (ctx?.status === 404 && !KNOWN.has(body?.code)) return { state: 'not_deployed' };
      if (ctx?.status === 401) return { state: 'unauthenticated' };
      const code = KNOWN.has(body?.code) ? body.code : 'failed';
      return { state: code, status: isObj(body?.status) ? body.status : null, refunded: body?.refunded === true };
    }
    if (!isObj(data) || data.ok !== true || !isObj(data.analysis)) return { state: 'failed' };
    return { state: 'ok', analysis: data.analysis, checklist: Array.isArray(data.checklist) ? data.checklist : [], status: isObj(data.status) ? data.status : null,
      cached: data.cached === true, analyzedAt: typeof data.analyzedAt === 'string' ? data.analyzedAt : null,
      saved: data.saved !== false, refunded: data.refunded === true };
  } catch { return { state: 'failed' }; }
}
