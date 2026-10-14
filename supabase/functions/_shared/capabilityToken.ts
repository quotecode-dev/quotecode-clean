// Public capability tokens and output grants (CROSSCUT_CONTRACT §2.3 / §3; spec Phase 4 "Public access must no longer be
// ambient /public-quote/<quote-id> authority"). Pure module: no Deno globals, no remote imports, no I/O. Shared by
// subscription-authority (mint) and get-public-quote / quote-presentation (resolve).
//
// Token format: 32 random bytes, base64url without padding = exactly 43 characters. Only the CANONICAL encoding is accepted
// (the last character carries 2 zero padding bits), so one byte string has exactly one accepted spelling.
// Stored form: token_hash = lowercase hex sha256 of the UTF-8 bytes of the 43-character token string. The raw token is never
// stored, never logged and never returned by any read path; it exists only in the minted URL / grant handed to the caller.

export const TOKEN_BYTES = 32;
export const TOKEN_LENGTH = 43;
export const GRANT_TTL_SECONDS = 120; // OD-02 / §3: final PDF / Print grants are short-lived (SQL accepts 1..300)
export const PUBLIC_OPS = Object.freeze(['view', 'approve'] as const);
export type PublicOp = typeof PUBLIC_OPS[number];
export const GRANT_CHANNELS = Object.freeze(['final_pdf', 'final_print'] as const);
export type GrantChannel = typeof GRANT_CHANNELS[number];
export const LINK_CHANNELS = Object.freeze(['send', 'public_share'] as const);

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63] + B64URL[(n >> 6) & 63] + B64URL[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63] + B64URL[(n >> 6) & 63];
  }
  return out;
}

/** Strict decoder for the 43-character token form only; null for anything else (incl. a non-canonical last character). */
export function decodeToken(token: unknown): Uint8Array | null {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const vals = Array.from(token, (c) => B64URL.indexOf(c));
  if (vals.some((v) => v < 0)) return null;
  const out = new Uint8Array(TOKEN_BYTES);
  let o = 0;
  for (let i = 0; i + 3 < 43; i += 4) {
    const n = (vals[i] << 18) | (vals[i + 1] << 12) | (vals[i + 2] << 6) | vals[i + 3];
    out[o++] = (n >> 16) & 255; out[o++] = (n >> 8) & 255; out[o++] = n & 255;
  }
  // last 3 chars -> 2 bytes (18 bits, the lowest 2 must be zero for the canonical encoding)
  const n = (vals[40] << 12) | (vals[41] << 6) | vals[42];
  if ((n & 3) !== 0) return null;
  out[o++] = (n >> 10) & 255; out[o++] = (n >> 2) & 255;
  return o === TOKEN_BYTES && base64UrlEncode(out) === token ? out : null;
}

export function isValidToken(token: unknown): token is string {
  return decodeToken(token) !== null;
}

export type RandomFill = (buf: Uint8Array) => Uint8Array;
const defaultRandom: RandomFill = (buf) => globalThis.crypto.getRandomValues(buf);

/** A fresh token from a CSPRNG (injectable for tests). */
export function mintToken(random: RandomFill = defaultRandom): string {
  const bytes = random(new Uint8Array(TOKEN_BYTES));
  if (!(bytes instanceof Uint8Array) || bytes.length !== TOKEN_BYTES) throw new Error('mintToken: random source failed');
  return base64UrlEncode(bytes);
}

export async function sha256HexOf(bytes: Uint8Array): Promise<string> {
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** token_hash for a VALID token; null for a malformed one (the caller must not query anything then). */
export async function tokenHash(token: unknown): Promise<string | null> {
  if (!isValidToken(token)) return null;
  return sha256HexOf(new TextEncoder().encode(token));
}

export const isHex64 = (v: unknown): v is string => typeof v === 'string' && HEX64_RE.test(v);
export const isUuidLower = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

// ---------------------------------------------------------------------------------------------------------------------
// Market -> public route language. Derived ONLY from server-read account/business data, never from a request body, a
// browser locale, a query parameter or a quote currency (weak signals are never used to pick a market).
//   account_market ('IL' | 'INTERNATIONAL')  - the server-owned market (billing migration); preferred
//   business_settings.country ('Local'|'LCL' | 'International') - the existing product market field
// Both absent, unknown, or contradicting each other -> null (fail closed: the caller refuses BEFORE any consumption).
// ---------------------------------------------------------------------------------------------------------------------
export type Market = 'IL' | 'INTERNATIONAL';
export function marketFromCountry(country: unknown): Market | null {
  if (country === 'Local' || country === 'LCL') return 'IL';
  if (country === 'International') return 'INTERNATIONAL';
  return null;
}
export function resolveServerMarket(input: { accountMarket?: unknown; businessCountry?: unknown }): Market | null {
  const a = input.accountMarket === 'IL' || input.accountMarket === 'INTERNATIONAL' ? input.accountMarket as Market : null;
  const b = marketFromCountry(input.businessCountry);
  if (input.accountMarket != null && a === null) return null; // a present but unknown value fails closed
  if (a && b && a !== b) return null;
  return a ?? b;
}

/** The public route for a capability token. IL -> Hebrew route, INTERNATIONAL -> English route. */
export function publicPathFor(token: string, market: Market): string {
  if (!isValidToken(token)) throw new Error('publicPathFor: invalid token');
  return market === 'IL' ? `/public-quote/c/${token}` : `/en/public-quote/c/${token}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Strict parsers of the SQL answers (§2.3). Anything not exactly the documented success shape is null = uniform not-found.
// The snapshot path must be the canonical one derived from the bound identities, so a resolution can never point a reader
// at another account's / quote's object.
// ---------------------------------------------------------------------------------------------------------------------
export type BoundArtifact = { userId: string; quoteId: string; attemptId: string; snapshotPath: string; snapshotSha256: string };
export type CapabilityResolution = BoundArtifact & { capabilityId: string; ops: readonly PublicOp[] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function canonicalSnapshotPath(userId: string, quoteId: string, attemptId: string): string {
  return `issued-documents/${userId}/${quoteId}/${attemptId}.json`;
}

function parseBound(raw: Record<string, unknown>): BoundArtifact | null {
  const { userId, quoteId, attemptId, snapshotPath, snapshotSha256 } = raw;
  if (!isUuidLower(userId) || !isUuidLower(quoteId) || !isUuidLower(attemptId) || !isHex64(snapshotSha256)) return null;
  if (snapshotPath !== canonicalSnapshotPath(userId, quoteId, attemptId)) return null;
  return { userId, quoteId, attemptId, snapshotPath, snapshotSha256 };
}

export function parseCapabilityResolution(raw: unknown, op: PublicOp): CapabilityResolution | null {
  if (!isObj(raw) || raw.ok !== true || !isUuidLower(raw.capabilityId)) return null;
  const bound = parseBound(raw);
  if (!bound || !Array.isArray(raw.ops) || raw.ops.length === 0) return null;
  if (!raw.ops.every((o) => (PUBLIC_OPS as readonly string[]).includes(o as string))) return null;
  if (!raw.ops.includes(op)) return null;
  return Object.freeze({ ...bound, capabilityId: raw.capabilityId, ops: Object.freeze([...new Set(raw.ops as PublicOp[])]) });
}

export function parseGrantRedemption(raw: unknown, channel: GrantChannel): BoundArtifact | null {
  if (!isObj(raw) || raw.ok !== true) return null;
  if (Object.prototype.hasOwnProperty.call(raw, 'channel') && raw.channel !== channel) return null;
  const bound = parseBound(raw);
  return bound ? Object.freeze(bound) : null;
}

export function isGrantChannel(v: unknown): v is GrantChannel {
  return typeof v === 'string' && (GRANT_CHANNELS as readonly string[]).includes(v);
}

/**
 * Reads the immutable snapshot bound by a capability / grant and verifies it: sha256 of the stored bytes equals the bound
 * hash, and the snapshot's own identity header (kind, schema, attempt, owner, quote) equals the bound identities.
 */
export async function readVerifiedSnapshot(bound: BoundArtifact, read: (path: string) => Promise<Uint8Array | null>):
  Promise<{ ok: true; snapshot: Record<string, unknown> } | { ok: false; reason: 'snapshot_missing' | 'snapshot_hash_mismatch' | 'snapshot_unparseable' | 'snapshot_identity_mismatch' | 'storage_unavailable' }> {
  let bytes: Uint8Array | null;
  try { bytes = await read(bound.snapshotPath); } catch { return { ok: false, reason: 'storage_unavailable' }; }
  if (!bytes) return { ok: false, reason: 'snapshot_missing' };
  if ((await sha256HexOf(bytes)) !== bound.snapshotSha256) return { ok: false, reason: 'snapshot_hash_mismatch' };
  let s: unknown;
  try { s = JSON.parse(new TextDecoder().decode(bytes)); } catch { return { ok: false, reason: 'snapshot_unparseable' }; }
  if (!isObj(s) || s.kind !== 'tekango-issued-quote-document' || s.schemaVersion !== 1 || s.attemptId !== bound.attemptId
      || s.ownerId !== bound.userId || s.quoteId !== bound.quoteId) return { ok: false, reason: 'snapshot_identity_mismatch' };
  return { ok: true, snapshot: s };
}
