// Task 16 - Quote Experience V2: the ONE client for the `quote-presentation` Edge Function
// (docs/task16-quote-experience-v2/CONTRACT.md section 3). Every export resolves to
// `{ ok: true, data }` or `{ ok: false, code, message }` and NEVER throws, so callers render a state, not a crash.
// The server is authoritative for entitlement, ownership, locking and image validation; nothing here is a security
// boundary - imageNormalize only reduces upload size and strips metadata before the server re-validates the bytes.
import { supabase } from '../shared/supabase';
import { normalizeImage } from './imageNormalize';

export const QUOTE_PRESENTATION_FUNCTION = 'quote-presentation';

// Server error codes (`code` of a failed result) the UI may branch on. Owner-facing:
//   quote_issued (409)        the presentation was issued (snapshot frozen forever) - save is refused; show the issued style
//   quote_locked (409)        the quote is approved / paid / signed - presentation can no longer change
//   style_not_entitled (403 on set_default / save_quote, 409 on issue)  style not included in the current tier
//   asset_not_owned (403)     an image does not belong to this account
//   asset_limit_reached (409) the per-account presentation image cap (200) is reached
//   image_too_large (413) | image_too_small | image_dimensions_too_large | invalid_image (400) | unsupported_image_type (415)
//   too_many_media | caption_too_long | invalid_media | invalid_media_role | invalid_style | invalid_id (400)
//   quote_not_found (404, also for another account's quote) | unauthorized (401) | qa_not_available (404) | forbidden (403)
//   payload_too_large (413) | storage_unavailable | database_unavailable (503) | network_error | unknown_error (client side)
export const QUOTE_PRESENTATION_ERROR_CODES = Object.freeze([
  'quote_issued', 'quote_locked', 'style_not_entitled', 'asset_not_owned', 'asset_limit_reached', 'image_too_large', 'image_too_small',
  'image_dimensions_too_large', 'invalid_image', 'unsupported_image_type', 'too_many_media', 'caption_too_long', 'invalid_media',
  'invalid_media_role', 'invalid_style', 'invalid_id', 'quote_not_found', 'unauthorized', 'qa_not_available', 'forbidden',
  'payload_too_large', 'storage_unavailable', 'database_unavailable', 'network_error', 'unknown_error',
]);

function fail(code, message) {
  return { ok: false, code: String(code || 'unknown_error'), message: String(message || code || 'Request failed') };
}

// supabase-js reports every non-2xx as a generic FunctionsHttpError; the real `{ error, message }` body is only in
// error.context (a raw Response). Read a clone when possible so the body stays readable for anyone else.
export async function readFunctionError(error) {
  const fallbackMessage = error?.message || 'Request failed';
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === 'function') {
      const res = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
      const body = await res.json();
      if (body && typeof body.error === 'string') return fail(body.error, body.message || body.error);
      const status = Number(ctx.status) || 0;
      return fail(status ? `http_${status}` : 'unknown_error', fallbackMessage);
    }
  } catch {
    // fall through - unreadable body
  }
  if (error?.name === 'FunctionsFetchError' || error?.name === 'FunctionsRelayError') return fail('network_error', fallbackMessage);
  return fail('unknown_error', fallbackMessage);
}

export async function callQuotePresentation(body) {
  try {
    const { data, error } = await supabase.functions.invoke(QUOTE_PRESENTATION_FUNCTION, { body });
    if (error) return await readFunctionError(error);
    if (!data || typeof data !== 'object') return fail('invalid_response', 'Empty or invalid response');
    if (typeof data.error === 'string') return fail(data.error, data.message || data.error);
    return { ok: true, data };
  } catch (e) {
    return fail('network_error', e?.message || 'Network error');
  }
}

// Chunked so large images never blow the argument limit of String.fromCharCode.
export function bytesToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function blobToBytes(blob) {
  if (typeof blob?.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsArrayBuffer(blob);
  });
}

export function fetchPresentationContext() {
  return callQuotePresentation({ action: 'context' });
}

export function setDefaultStyle(style) {
  return callQuotePresentation({ action: 'set_default', style });
}

export async function uploadPresentationMedia(file) {
  let normalized;
  try {
    normalized = await normalizeImage(file);
  } catch (e) {
    return fail(e?.code || 'image_rejected', e?.message || 'Image could not be processed');
  }
  try {
    const bytes = await blobToBytes(normalized.blob);
    const ext = normalized.mime === 'image/webp' ? 'webp' : normalized.mime === 'image/png' ? 'png' : 'jpg';
    const baseName = String(file?.name || 'image').replace(/\.[^.]*$/, '').slice(0, 80) || 'image';
    return await callQuotePresentation({
      action: 'upload_media',
      filename: `${baseName}.${ext}`,
      contentType: normalized.mime,
      dataBase64: bytesToBase64(bytes),
    });
  } catch (e) {
    return fail('image_rejected', e?.message || 'Image could not be read');
  }
}

export function fetchMediaUrls(assetIds) {
  return callQuotePresentation({ action: 'media_urls', assetIds: Array.isArray(assetIds) ? assetIds : [] });
}

export function fetchQuotePresentation(quoteId) {
  return callQuotePresentation({ action: 'get_quote', quoteId });
}

// style: undefined (omitted) => the server keeps the stored draft style; null => clear (business default); id => set.
export function saveQuotePresentation(quoteId, { style, media = [] } = {}) {
  const body = { action: 'save_quote', quoteId, media: Array.isArray(media) ? media : [] };
  if (style !== undefined) body.style = style;
  return callQuotePresentation(body);
}

export function issueQuotePresentation(quoteId) {
  return callQuotePresentation({ action: 'issue', quoteId });
}

export function linkCatalogMedia(serviceId, assetId, caption = '') {
  return callQuotePresentation({ action: 'catalog_link', serviceId, assetId: assetId ?? null, caption: caption ?? '' });
}

// capabilityToken (capability URL route) replaces the quote id: the id alone is not an access credential (OD-02)
export function fetchPublicPresentation(quoteId, capabilityToken = null) {
  return callQuotePresentation(capabilityToken ? { action: 'public_get', capabilityToken } : { action: 'public_get', quoteId });
}

export function qaSetCapability(userId, tier) {
  return callQuotePresentation({ action: 'qa_set_capability', userId, tier });
}
