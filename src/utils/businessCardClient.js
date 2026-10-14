// Task 23 (Phase 5): browser read of a public digital business card through the get-business-card Edge Function (anonymous).
// Closed statuses so the public page and the owner screen can say exactly what is true:
//   ok | not_found (our own uniform 404: no such card / no business name / market not set) | not_deployed (the server has no such
//   function - a gateway 404 without our contract) | service_unreachable / unavailable / offline (Task 22 fetch-failure rule) | server_error
import { BUSINESS_CARD_CONTRACT_VERSION, isBusinessCardId, sanitizeBusinessCardResponse, businessCardPath } from '../../supabase/functions/_shared/businessCard.js';
import { serverAnswers } from './aiQuoteDraftClient';

export const BUSINESS_CARD_FUNCTION = 'get-business-card';

export function businessCardFunctionUrl(supabase) {
  const base = supabase?.functions?.url;
  return typeof base === 'string' && base ? `${base.replace(/\/+$/, '')}/${BUSINESS_CARD_FUNCTION}` : null;
}

export function businessCardShareUrl(userId, origin = (typeof window !== 'undefined' ? window.location.origin : '')) {
  return isBusinessCardId(userId) && origin ? `${origin}${businessCardPath(userId)}` : null;
}

async function classify(error, functionUrl, fetchImpl) {
  if (error?.name === 'FunctionsFetchError') {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    return (await serverAnswers(functionUrl, fetchImpl)) ? 'service_unreachable' : 'unavailable';
  }
  const ctx = error?.context;
  const status = ctx && typeof ctx.status === 'number' ? ctx.status : null;
  let body;
  try { body = ctx ? await ctx.clone().json() : null; } catch { body = null; }
  if (status === 404) return body && body.contractVersion === BUSINESS_CARD_CONTRACT_VERSION ? 'not_found' : 'not_deployed';
  if (error?.name === 'FunctionsRelayError' || (status != null && status >= 500)) return 'server_error';
  return 'failed';
}

// Resolves to { status: 'ok', card } or { status }. Never throws; sends only the card id.
export async function fetchPublicBusinessCard(supabase, id, { fetchImpl } = {}) {
  if (!isBusinessCardId(id)) return { status: 'not_found' };
  const functionUrl = businessCardFunctionUrl(supabase);
  try {
    const { data, error } = await supabase.functions.invoke(BUSINESS_CARD_FUNCTION, { body: { id } });
    if (error) return { status: await classify(error, functionUrl, fetchImpl) };
    const card = sanitizeBusinessCardResponse(data);
    return card ? { status: 'ok', card } : { status: 'failed' };
  } catch (error) {
    return { status: await classify(error, functionUrl, fetchImpl) };
  }
}
