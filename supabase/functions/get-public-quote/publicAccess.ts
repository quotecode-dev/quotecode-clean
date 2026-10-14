// get-public-quote - pure access decisions and the capability / grant read path (CROSSCUT_CONTRACT §2.3 / §3; spec Phase 4).
// No Deno globals, no remote imports: index.ts supplies the I/O; vitest drives this module with fakes (publicAccess.test.ts).
//
// Modes (exactly one per request):
//   {capability_token}          -> resolve_public_capability(sha256(token), 'view') -> immutable snapshot -> renderer contract
//   {output_grant, channel}     -> redeem_output_grant(sha256(grant), channel) (single use) -> the same renderer contract
//   {quote_id}                  -> legacy. free_issue NOT enforced: unchanged. Enforced: served only to (a) the verified OWNER
//                                  of the quote (owner preview; decided by the caller JWT, never a body flag; non-consuming)
//                                  or (b) an is_legacy_public_quote id. Everything else = the SAME uniform 404 as an unknown id.
// Anti-enumeration: every refusal of a token / grant / post-cutover id is the identical 404 body; a malformed token or grant
// never reaches SQL; in enforced id mode the same lookups run for every id (legacy check + owner lookup) before deciding.
import { isQuoteAcceptanceExpired } from './validity.ts';
import {
  isGrantChannel, isValidToken, parseCapabilityResolution, parseGrantRedemption, readVerifiedSnapshot, tokenHash,
  type BoundArtifact, type GrantChannel,
} from '../_shared/capabilityToken.ts';
import { decideLegacyIdAccess, type PhaseRead } from '../_shared/activationPhase.ts';
import { resolvePublicThanks, type ThanksRow } from './thanks.ts';

export type Resp = { status: number; body: Record<string, unknown> };
export const UNIFORM_NOT_FOUND: Readonly<Resp> = Object.freeze({ status: 404, body: Object.freeze({ error: 'Quote not found' }) as Record<string, unknown> });
export const UNABLE: Readonly<Resp> = Object.freeze({ status: 400, body: Object.freeze({ error: 'Unable to load quote' }) as Record<string, unknown> });
const notFound = (): Resp => ({ status: 404, body: { error: 'Quote not found' } });
const unable = (): Resp => ({ status: 400, body: { error: 'Unable to load quote' } });

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export type PublicRequest =
  | { mode: 'capability'; token: string }
  | { mode: 'grant'; grant: string; channel: GrantChannel }
  | { mode: 'legacy'; quoteId: string }
  | { mode: 'malformed' }                        // a token / grant that can never be valid -> uniform 404, no SQL
  | { mode: 'bad_request'; res: Resp };

export function parsePublicRequest(body: unknown): PublicRequest {
  if (!isObj(body)) return { mode: 'bad_request', res: { status: 400, body: { error: 'Missing or invalid quote_id' } } };
  const hasToken = own(body, 'capability_token');
  const hasGrant = own(body, 'output_grant');
  const hasId = own(body, 'quote_id');
  if ([hasToken, hasGrant, hasId].filter(Boolean).length > 1) return { mode: 'bad_request', res: { status: 400, body: { error: 'Invalid request body' } } };
  if (hasToken) return isValidToken(body.capability_token) ? { mode: 'capability', token: body.capability_token as string } : { mode: 'malformed' };
  if (hasGrant) {
    if (!isGrantChannel(body.channel)) return { mode: 'bad_request', res: { status: 400, body: { error: 'Invalid request body' } } };
    return isValidToken(body.output_grant) ? { mode: 'grant', grant: body.output_grant as string, channel: body.channel } : { mode: 'malformed' };
  }
  const q = body.quote_id;
  if (!q || typeof q !== 'string' || !UUID_RE.test(q)) return { mode: 'bad_request', res: { status: 400, body: { error: 'Missing or invalid quote_id' } } };
  return { mode: 'legacy', quoteId: q };
}

// ---------------------------------------------------------------------------------------------------------------------
// Legacy id mode decision
// ---------------------------------------------------------------------------------------------------------------------
export type LegacyDecision = 'serve' | 'not_found' | 'error';
export type OutputPhase = 'off' | 'prepared' | 'shadow' | 'enforced';
/** Allowlisted page field: the server free_issue phase; 'off' when the subscription schema does not exist here. */
export function outputPhaseOf(phase: PhaseRead): OutputPhase | null {
  if (phase === 'absent') return 'off';
  return phase === 'prepared' || phase === 'shadow' || phase === 'enforced' ? phase : null;
}
/** See _shared/activationPhase.ts decideLegacyIdAccess (one rule for every public id read). */
export const decideLegacyAccess = decideLegacyIdAccess;

// ---------------------------------------------------------------------------------------------------------------------
// Capability / grant read path
// ---------------------------------------------------------------------------------------------------------------------
export interface CapabilityDeps {
  resolve(tokenHash: string, op: 'view'): Promise<unknown>;               // resolve_public_capability
  redeem(grantHash: string, channel: GrantChannel): Promise<unknown>;     // redeem_output_grant
  readSnapshot(path: string): Promise<Uint8Array | null>;                 // service client, bucket quote-files
  /** live approval state only (status / signature / owner); the deal content always comes from the snapshot */
  readLiveQuote(quoteId: string): Promise<{ user_id: string; status: unknown; signature: unknown } | null>;
  /** issuer/v2 only: the immutable logo object bytes (service client, bucket quote-files); null when missing */
  readLogo?(objectPath: string): Promise<Uint8Array | null>;
  /** Task 28: the verified owner's thank-you settings (service client, explicit columns); absent / throwing = no thanks */
  readThanksRow?(ownerId: string): Promise<ThanksRow | null>;
  callerUserId: string | null;
  /** the server free_issue phase as reported to the page (outputPhaseOf) */
  outputPhase: OutputPhase;
  now?: () => Date;
  onIncident?: (code: string) => void;
}

const SNAPSHOT_KIND = 'tekango-issued-quote-document';
const LOGO_EXT: Readonly<Record<string, string>> = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' });
const HEX64_LOGO = /^[0-9a-f]{64}$/;

export interface IssuedLogo { assetId: string; objectPath: string; sha256: string; bytes: number; mime: string }

/** issuer/v2 logo identity bound in the snapshot: owner-scoped immutable path, sha256, bytes, MIME. Anything else -> null. */
export function parseIssuedLogo(issuer: unknown, ownerId: string): IssuedLogo | null {
  if (!isObj(issuer) || issuer.issuerProjection !== 'issuer/v2' || !isObj(issuer.logo)) return null;
  const l = issuer.logo;
  const assetId = typeof l.assetId === 'string' ? l.assetId.toLowerCase() : '';
  const mime = typeof l.mime === 'string' ? l.mime : '';
  const ext = LOGO_EXT[mime];
  if (!UUID_RE.test(assetId) || !ext || typeof l.sha256 !== 'string' || !HEX64_LOGO.test(l.sha256)) return null;
  if (typeof l.bytes !== 'number' || !Number.isInteger(l.bytes) || l.bytes <= 0) return null;
  if (l.objectPath !== `account-assets/${ownerId.toLowerCase()}/${assetId}.${ext}`) return null;
  return { assetId, objectPath: l.objectPath, sha256: l.sha256, bytes: l.bytes, mime };
}

async function sha256HexOf(bytes: Uint8Array): Promise<string> {
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}
function base64Of(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Read-back of the issued logo: the exact bytes the snapshot bound (size + sha256), served inline. No URL is fetched. */
export async function verifiedLogoDataUrl(logo: IssuedLogo, readLogo: ((p: string) => Promise<Uint8Array | null>) | undefined): Promise<string | null> {
  if (!readLogo) return null;
  let bytes: Uint8Array | null = null;
  try { bytes = await readLogo(logo.objectPath); } catch { return null; }
  if (!(bytes instanceof Uint8Array) || bytes.length !== logo.bytes) return null;
  if (await sha256HexOf(bytes) !== logo.sha256) return null;
  return `data:${logo.mime};base64,${base64Of(bytes)}`;
}

/** Renderer contract (the same shape the legacy response has) built from the immutable snapshot + live approval state. */
export function rendererFromSnapshot(snapshot: unknown, bound: BoundArtifact,
  live: { user_id: string; status: unknown; signature: unknown } | null, ctx: { callerUserId: string | null; now: Date }): Record<string, unknown> | null {
  if (!isObj(snapshot) || snapshot.kind !== SNAPSHOT_KIND || snapshot.schemaVersion !== 1) return null;
  if (snapshot.attemptId !== bound.attemptId || snapshot.ownerId !== bound.userId || snapshot.quoteId !== bound.quoteId) return null;
  const doc = snapshot.document; const issuer = snapshot.issuer;
  if (!isObj(doc) || doc.documentProjection !== 'quote-document/v1' || !isObj(doc.quote)) return null;
  if (issuer !== null && (!isObj(issuer) || (issuer.issuerProjection !== 'issuer/v1' && issuer.issuerProjection !== 'issuer/v2'))) return null;
  // issuer/v2 (immutable logo asset): the bound logo identity must be valid and owner-scoped, or the snapshot is refused
  if (isObj(issuer) && issuer.issuerProjection === 'issuer/v2' && !parseIssuedLogo(issuer, bound.userId)) return null;
  const q = doc.quote;
  if (q.id !== bound.quoteId) return null;
  const liveOk = live && live.user_id === bound.userId ? live : null;
  const iss = isObj(issuer) ? issuer : null;
  const sortBy = (a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter(isObj) : []);
  const c = isObj(doc.customer) ? doc.customer : null;
  return {
    quote: {
      id: q.id, quote_number: q.quote_number, attn_name: q.attn_name, attn_role: q.attn_role, created_at: q.created_at,
      valid_until: q.valid_until, tax_rate: q.tax_rate, subtotal: q.subtotal, total: q.total, discount: q.discount, terms: q.terms,
      warranty: q.warranty, notes: q.notes, subject: q.subject,
      status: liveOk ? liveOk.status : null, signature: liveOk ? liveOk.signature : null,
      currency: q.currency, client_type: q.client_type,
      is_owner_viewing: Boolean(ctx.callerUserId && ctx.callerUserId === bound.userId),
      is_expired: isQuoteAcceptanceExpired(q.valid_until, iss?.country, ctx.now),
      project_name: q.project_name,
    },
    // issuer/v2: logo_url is filled by serveBound with the read-back verified bytes (never the mutable account URL)
    business: iss ? { business_name: iss.business_name, logo_url: iss.issuerProjection === 'issuer/v2' ? null : iss.logo_url, tax_id: iss.tax_id, email: iss.email, phone: iss.phone,
      address: iss.address, currency: iss.currency } : null,
    client: c ? { company_name: c.company_name, email: c.email, phone: c.phone, address: c.address } : null,
    sections: arr(doc.sections).slice().sort(sortBy).map((s) => ({ id: s.id, name: s.name })),
    items: arr(doc.items).slice().sort(sortBy).map((i) => ({
      description: i.description, quantity: i.quantity, price: i.unit_price, total_price: i.total_price,
      ...(i.price_missing === true ? { price_missing: true } : {}), // Task 35 (F4): from the issued deal document, only when true
      pricing_unit: i.pricing_unit, calculated_quantity: i.calculated_quantity, quantity_source: i.quantity_source,
      calculation_method: i.calculation_method, specification: Array.isArray(i.specification) ? i.specification : [],
      section_id: i.section_id,
      measurements: arr(i.measurements).slice().sort(sortBy).map((m) => ({ width: m.width, height: m.height, unit: m.unit,
        calculated_area: m.calculated_area, label: m.label, is_pricing_driving: m.is_pricing_driving !== false })),
    })),
    attachments: [], // issued snapshots never carry attachments (attachment_snapshot_policy_pending / OPEN-13)
    capability: true,
  };
}

async function serveBound(deps: CapabilityDeps, bound: BoundArtifact, extra: Record<string, unknown>, opts: { thanks: boolean }): Promise<Resp> {
  const v = await readVerifiedSnapshot(bound, deps.readSnapshot);
  if (!v.ok) { deps.onIncident?.(v.reason); return unable(); }   // never a regenerated / mutable document
  let live: { user_id: string; status: unknown; signature: unknown } | null = null;
  try { live = await deps.readLiveQuote(bound.quoteId); } catch { return unable(); }
  const body = rendererFromSnapshot(v.snapshot, bound, live, { callerUserId: deps.callerUserId, now: (deps.now ?? (() => new Date()))() });
  if (!body) { deps.onIncident?.('snapshot_identity_mismatch'); return unable(); }
  const logo = parseIssuedLogo((v.snapshot as Record<string, unknown>).issuer, bound.userId);
  if (logo) {
    // the issued document shows exactly the bound logo bytes or nothing at all: a missing / changed object is an incident
    const dataUrl = await verifiedLogoDataUrl(logo, deps.readLogo);
    if (!dataUrl) { deps.onIncident?.('issued_logo_unavailable'); return unable(); }
    (body.business as Record<string, unknown>).logo_url = dataUrl;
  }
  // Task 28: the thank-you only on the customer view, from the LIVE server status / signature (rendererFromSnapshot keeps them only when
  // the live row belongs to the bound owner) and the bound owner's settings; output grants (final PDF / Print) never carry it.
  body.thanks = opts.thanks ? await resolvePublicThanks(body.quote as Record<string, unknown>, bound.userId, deps.readThanksRow) : null;
  return { status: 200, body: { ...body, ...extra } };
}

export async function serveCapability(deps: CapabilityDeps, token: string): Promise<Resp> {
  const hash = await tokenHash(token);
  if (!hash) return notFound();
  let raw: unknown;
  try { raw = await deps.resolve(hash, 'view'); } catch { return unable(); }
  const r = parseCapabilityResolution(raw, 'view');
  if (!r) return notFound();                           // unknown / revoked / expired / op not allowed / malformed: uniform
  // a capability viewer is never the owner path (the page prints / captures the artifact itself)
  return serveBound(deps, r, { viewerIsOwner: false, outputPhase: deps.outputPhase }, { thanks: true });
}

export async function serveGrant(deps: CapabilityDeps, grant: string, channel: GrantChannel): Promise<Resp> {
  const hash = await tokenHash(grant);
  if (!hash) return notFound();
  let raw: unknown;
  try { raw = await deps.redeem(hash, channel); } catch { return unable(); }
  const r = parseGrantRedemption(raw, channel);
  if (!r) return notFound();                           // used / expired / wrong channel / unknown: uniform
  // grants are only ever minted for the verified owner (authorize_output final_pdf / final_print)
  return serveBound(deps, r, { output_channel: channel, viewerIsOwner: true, outputPhase: deps.outputPhase }, { thanks: false });
}
