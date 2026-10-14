// quote-presentation - server capability gates (OD-17 / OD-18; CROSSCUT_CONTRACT §2.2 / §3) and the capability-token
// presentation read. Pure module: no Deno globals, no remote imports (vitest imports it directly).
//
// upload_media: `purpose: 'catalog_product' | 'quote_media'` (missing = 'quote_media', backward compatible).
//   catalog_product -> capability 'catalog_product_image.upload'; quote_media -> 'quote_media.upload'.
// catalog_link (linking an image): 'catalog_product_image.upload' at PREPARE (before any read/decode/write) and again at
//   FINALIZE (immediately before the catalog link is written). Unlinking is never gated (removal grants nothing).
// The decision reads ONLY the server answer of public.capability_check(uid, capability). Body fields such as plan, tier,
// eligiblePlans or capabilities are never inputs - the function signature has no place for them.
//   * RPC not deployed in this environment (PostgREST function-not-found) -> today's behavior (allowed, source 'not_deployed')
//   * {source:'legacy'} (subscription system not active)                  -> today's behavior (allowed)
//   * {source:'server', allowed:true}                                     -> allowed
//   * {source:'server', allowed:false}                                    -> 403 {error:'capability_not_included', capability}
//   * any other answer / error                                            -> 503 fail closed
import { MEDIA_ROLES, isUuid, parseMediaRefs, pickBranding, type Branding, type MediaRef } from './lib.ts';
import { DEFAULT_QUOTE_STYLE, normalizeStyleId, QUOTE_STYLE_VERSIONS, type QuoteStyleId } from '../_shared/quoteStyleCapabilities.ts';

/** The public_get answer for "no Task 16 record" (resolvePublicPresentation 'legacy' mode). Also the uniform answer for a
 *  refused capability token or a non-served id when free_issue is enforced, so refusal and absence are indistinguishable. */
export const NO_PRESENTATION_BODY = Object.freeze({
  mode: 'legacy', style: DEFAULT_QUOTE_STYLE, styleVersion: QUOTE_STYLE_VERSIONS[DEFAULT_QUOTE_STYLE], branding: null, media: Object.freeze([]) as readonly never[],
});

export const UPLOAD_PURPOSES = Object.freeze(['catalog_product', 'quote_media'] as const);
export type UploadPurpose = typeof UPLOAD_PURPOSES[number];
export type GateCapability = 'catalog_product_image.upload' | 'quote_media.upload';

export function parseUploadPurpose(value: unknown): { ok: true; purpose: UploadPurpose } | { ok: false; status: 400; body: Record<string, unknown> } {
  if (value === undefined || value === null) return { ok: true, purpose: 'quote_media' };
  if (typeof value === 'string' && (UPLOAD_PURPOSES as readonly string[]).includes(value)) return { ok: true, purpose: value as UploadPurpose };
  return { ok: false, status: 400, body: { error: 'invalid_purpose', message: 'purpose must be catalog_product or quote_media' } };
}

export function capabilityForPurpose(purpose: UploadPurpose): GateCapability {
  return purpose === 'catalog_product' ? 'catalog_product_image.upload' : 'quote_media.upload';
}

export type CapabilityCheckAnswer = { kind: 'not_deployed' } | { kind: 'error' } | { kind: 'answer'; data: unknown };
export type GateDecision =
  | { allow: true; source: 'server' | 'legacy' | 'not_deployed' }
  | { allow: false; status: 403 | 503; body: Record<string, unknown> };

export function decideCapabilityGate(answer: CapabilityCheckAnswer, capability: GateCapability): GateDecision {
  if (answer.kind === 'not_deployed') return { allow: true, source: 'not_deployed' };
  if (answer.kind !== 'answer') return { allow: false, status: 503, body: { error: 'capability_unavailable', message: 'Capability check is temporarily unavailable' } };
  const d = answer.data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.ok !== true || typeof d.allowed !== 'boolean'
      || (d.source !== 'server' && d.source !== 'legacy')) {
    return { allow: false, status: 503, body: { error: 'capability_unavailable', message: 'Capability check is temporarily unavailable' } };
  }
  if (d.source === 'legacy') return { allow: true, source: 'legacy' };   // system not active: today's behavior unchanged
  if (d.allowed === true) return { allow: true, source: 'server' };
  return { allow: false, status: 403, body: { error: 'capability_not_included', capability } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Capability-token presentation (public_get {capability_token}): served from the IMMUTABLE issued snapshot only - never a
// draft, never a lazy freeze. The snapshot's presentation body carries style / styleVersion / ordered media refs and the
// layout projection (role / item / caption / alt / order) written by subscription-authority's presentation source.
// ---------------------------------------------------------------------------------------------------------------------
export function presentationFromSnapshot(snapshot: Record<string, unknown>): { style: QuoteStyleId; styleVersion: number; branding: Branding; media: MediaRef[] } | null {
  const p = snapshot.presentation as Record<string, unknown> | undefined;
  if (!p || typeof p !== 'object' || p.presentationProjection !== 'presentation/v1') return null;
  const style = normalizeStyleId(p.style);
  if (!style || p.styleVersion !== QUOTE_STYLE_VERSIONS[style]) return null;
  const refs = Array.isArray(p.media) ? p.media : [];
  const bound = new Set(refs.map((m) => String((m as { assetId?: unknown })?.assetId ?? '').toLowerCase()).filter((id) => isUuid(id)));
  const layoutRaw = (p.branding as { layoutProjection?: unknown; media?: unknown } | null)?.layoutProjection === 'presentation-layout/v1'
    ? (p.branding as { media?: unknown }).media : [];
  const parsed = parseMediaRefs(Array.isArray(layoutRaw) ? layoutRaw.filter((m) => (MEDIA_ROLES as readonly string[]).includes(String((m as { role?: unknown })?.role))) : []);
  // only layout entries whose asset is bound (hash + bytes) by the snapshot are rendered
  const media = parsed.ok ? parsed.media.filter((m) => bound.has(m.assetId)) : [];
  return { style, styleVersion: p.styleVersion as number, branding: pickBranding(snapshot.issuer), media };
}
