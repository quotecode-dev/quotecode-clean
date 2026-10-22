// Customer Twin ("בדיקת הלקוח", Owner night task 2026-10-22): the dashboard side - builds the quote payload (only quote content, the
// shared sanitizer drops everything else), reads the caller's counters and asks the Edge Function customer-twin. Never throws.
import { sanitizeTwinQuote, TWIN_QUOTE_VERSION } from '../../supabase/functions/_shared/customerTwin.js';
import { getActiveQuantity } from './professionalQuoteItem';

export const CUSTOMER_TWIN_FUNCTION = 'customer-twin';
const num = (v) => (v === '' || v == null ? null : Number(v));

/** the quote open in the editor -> the payload (market = the account's; the server uses its own anyway) */
export function twinPayloadFromEditor({ market, currency, quoteSubject, items, terms, warranty, validUntil, taxRate, clientType, discount, subtotal, totalAmount }) {
  return sanitizeTwinQuote({
    version: TWIN_QUOTE_VERSION, market, currency, subject: quoteSubject,
    items: (items || []).map((it) => ({
      // the quantity the price uses (calculated for a measured item) - the same rule as the editor and the list
      description: it.description, specification: it.specification, quantity: getActiveQuantity(it),
      unit: it.pricing_unit || null, unitPrice: num(it.unit_price), priceMissing: it.price_missing === true || it.unit_price === '' || it.unit_price == null,
    })),
    terms, warranty, validUntil, taxRate: num(taxRate), clientType, discountPercent: num(discount), subtotal: num(subtotal), total: num(totalAmount),
  });
}

/** a saved quote row of the list (with quote_items) -> the payload */
export function twinPayloadFromQuoteRow(quote, market) {
  if (!quote) return null;
  return sanitizeTwinQuote({
    version: TWIN_QUOTE_VERSION, market, currency: quote.currency, subject: quote.quote_subject || quote.subject,
    // the saved order (PostgREST returns rows in no promised order - the same sort as the editor, Dashboard handleEditClick)
    items: (quote.quote_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((it) => ({
      description: it.description, specification: it.specification, quantity: getActiveQuantity(it),
      unit: it.pricing_unit || null, unitPrice: num(it.unit_price), priceMissing: it.price_missing === true || it.unit_price == null,
    })),
    terms: quote.terms, warranty: quote.warranty, validUntil: quote.valid_until, taxRate: num(quote.tax_rate), clientType: quote.client_type,
    discountPercent: num(quote.discount), subtotal: num(quote.subtotal), total: num(quote.total),
  });
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

const KNOWN = new Set(['quota_exhausted', 'smart_pack_required', 'in_progress', 'too_many_failures', 'market_unresolved', 'nothing_to_check', 'provider_failure', 'malformed_provider_response', 'unauthenticated']);
/** { state: 'ok', analysis, checklist, status, cached } | { state: <closed code>, status? } */
export async function requestCustomerTwin(supabase, quote) {
  if (!quote) return { state: 'nothing_to_check' };
  try {
    const { data, error } = await supabase.functions.invoke(CUSTOMER_TWIN_FUNCTION, { body: { quote } });
    if (error) {
      if (error.name === 'FunctionsFetchError') return { state: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'not_deployed' };
      const ctx = error.context;
      let body = null;
      try { body = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json() : null; } catch { body = null; }
      // a function that does not exist on this server (404 with the platform's own body, not one of ours)
      if (ctx?.status === 404 && !KNOWN.has(body?.code)) return { state: 'not_deployed' };
      const code = KNOWN.has(body?.code) ? body.code : 'failed';
      return { state: code === 'malformed_provider_response' ? 'provider_failure' : code, status: isObj(body?.status) ? body.status : null };
    }
    if (!isObj(data) || data.ok !== true || !isObj(data.analysis)) return { state: 'failed' };
    return { state: 'ok', analysis: data.analysis, checklist: Array.isArray(data.checklist) ? data.checklist : [], status: isObj(data.status) ? data.status : null, cached: data.cached === true };
  } catch { return { state: 'failed' }; }
}
