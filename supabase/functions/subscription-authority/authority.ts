// TEKANGO subscription authority - server modules. Spec §3.3 / Phases 2, 3, 9; Owner decisions OD-01..OD-20; CROSSCUT §3.
// Pure, dependency-injected handlers (Deno + vitest): the Edge entry (index.ts) supplies SQL / Storage / JWT / provider
// adapters. ACTIVATION_PHASE is the BILLING code constant 'off' (identical in every environment, never derived from
// env=TEST): checkout and provider events stay unavailable whatever the DB says. Output authorization and logo import are
// gated by the DB phase public.subscription_activation.free_issue (seeded 'prepared'; only the DB owner can raise it).
// Trust boundary: the user id ALWAYS comes from the verified JWT; a body is never a source of account, market, plan rights,
// amount, currency or rate. Responses are rebuilt from explicit allowlists.

export const ACTIVATION_PHASE = 'off' as const;
export type ActivationPhase = 'off' | 'prepared' | 'enforced';
export type Resp = { status: number; body: Record<string, unknown> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const err = (status: number, code: string): Resp => ({ status, body: { ok: false, code } });

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------------------------------------ authenticate (JWT only)
export type JwtVerifier = (token: string) => Promise<{ sub?: unknown } | null>;
export async function userFromRequest(headers: { get(name: string): string | null }, verify: JwtVerifier): Promise<string | null> {
  const h = headers.get('authorization') || '';
  const m = /^Bearer ([A-Za-z0-9._-]+)$/.exec(h);
  if (!m) return null;
  const claims = await verify(m[1]).catch(() => null);
  const sub = claims?.sub;
  return typeof sub === 'string' && UUID.test(sub) ? sub : null;
}

// ------------------------------------------------------------------------------------------------ account summary
// NOT a function route (CROSSCUT §3): the client calls the RPC public.get_account_summary() directly with its own JWT
// (auth.uid() inside SQL; no argument can name an account). There is ONE account-summary parser - the shared contract's
// strict allowlist parser - re-exported here so server code never grows a second one.
export { parseAccountSummary } from '../_shared/subscriptionContract.ts';

// ------------------------------------------------------------------------------------------------ billing (provider-neutral)
// Moved to billing.ts (BillingProvider with createCheckout / verifyWebhook; UNAVAILABLE_PROVIDER default). Re-exported.
export {
  parseCatalog, computeCheckoutAmount, checkoutIntentHandler, providerWebhookHandler, UNAVAILABLE_PROVIDER,
  type BillingProvider, type BillingSql, type PriceRow,
} from './billing.ts';

// ------------------------------------------------------------------------------------------------ immutable logo assets
export type ImageInfo = { mime: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number };
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
// Magic bytes + dimensions from the BYTES (never from a client-declared MIME or file name). SVG is not accepted.
export function sniffImage(b: Uint8Array): ImageInfo | null {
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a && ascii(b, 12, 4) === 'IHDR') {
    return { mime: 'image/png', width: u32be(b, 16), height: u32be(b, 20) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1]; const len = u16be(b, i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { mime: 'image/jpeg', height: u16be(b, i + 5), width: u16be(b, i + 7) };
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const chunk = ascii(b, 12, 4);
    if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { mime: 'image/webp', width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    if (chunk === 'VP8L' && b[20] === 0x2f) { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { mime: 'image/webp', width: (v & 0x3fff) + 1, height: ((v >>> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X') return { mime: 'image/webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
}
export interface AssetSql {
  reserveLogo(a: { ownerId: string; mime: string; sha256: string; bytes: number; width: number; height: number }): Promise<Record<string, unknown>>;
  finalizeLogo(a: { ownerId: string; assetId: string; sha256: string; bytes: number }): Promise<Record<string, unknown>>;
}
export interface AssetStorage {
  // must be a create-only write (no upsert); returns 'exists' when an object is already at the path
  putNew(path: string, bytes: Uint8Array, contentType: string): Promise<'created' | 'exists'>;
  read(path: string): Promise<Uint8Array | null>;
}
export type LogoLimits = { maxBytes: number; maxDimension: number }; // operational safety bounds supplied by the caller (not a commercial quota)
// Import a logo the user UPLOADED (bytes in hand). There is deliberately no URL parameter: arbitrary URLs are never fetched at
// issue time (spec Phase 3); an existing external logo needs an explicit import of its bytes, and on failure the current
// setting is kept (never deleted).
export async function importLogoAsset(deps: { sql: AssetSql; storage: AssetStorage }, ownerId: string, bytes: Uint8Array, limits: LogoLimits): Promise<Resp> {
  if (!UUID.test(ownerId) || !(limits?.maxBytes > 0) || !(limits?.maxDimension > 0)) return err(400, 'invalid_request');
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > limits.maxBytes) return err(400, 'invalid_asset');
  const info = sniffImage(bytes);
  if (!info || info.width < 1 || info.height < 1 || info.width > limits.maxDimension || info.height > limits.maxDimension) return err(400, 'invalid_asset');
  const sha256 = await sha256Hex(bytes);
  let res: Record<string, unknown>;
  try { res = await deps.sql.reserveLogo({ ownerId, mime: info.mime, sha256, bytes: bytes.length, width: info.width, height: info.height }); } catch { return err(503, 'asset_unavailable'); }
  // the SQL-derived versioned path: account-assets/<owner>/<random asset id>.<ext> (a new asset per import; never reused)
  const ext = info.mime === 'image/png' ? 'png' : info.mime === 'image/jpeg' ? 'jpg' : 'webp';
  if (!res || res.ok !== true || typeof res.assetId !== 'string' || !UUID.test(res.assetId)
      || res.objectPath !== `account-assets/${ownerId}/${res.assetId}.${ext}`) return err(503, 'asset_unavailable');
  let put: 'created' | 'exists';
  let back: Uint8Array | null;
  try {
    put = await deps.storage.putNew(res.objectPath, bytes, info.mime); // create-only (no upsert)
    // read-back: whatever is at the path (newly created or pre-existing) must be exactly these bytes, type and dimensions
    back = await deps.storage.read(res.objectPath);
  } catch { return err(503, 'asset_unavailable'); }   // the current logo binding is untouched; nothing is deleted
  const backInfo = back ? sniffImage(back) : null;
  if (!back || back.length !== bytes.length || (await sha256Hex(back)) !== sha256 || !backInfo || backInfo.mime !== info.mime
      || backInfo.width !== info.width || backInfo.height !== info.height) return err(409, 'asset_not_immutable');
  let fin: Record<string, unknown>;
  try { fin = await deps.sql.finalizeLogo({ ownerId, assetId: res.assetId, sha256, bytes: bytes.length }); } catch { return err(503, 'asset_unavailable'); }
  if (!fin || fin.ok !== true || fin.sha256 !== sha256 || !HEX64.test(String(fin.sha256)) || fin.assetId !== res.assetId
      || (fin.bytes !== undefined && fin.bytes !== bytes.length) || (fin.mime !== undefined && fin.mime !== info.mime)) {
    const code = fin && typeof fin.code === 'string' && /^[a-z_]{3,48}$/.test(fin.code) ? fin.code : 'asset_not_immutable';
    return err(409, code);
  }
  return { status: 200, body: { ok: true, assetId: res.assetId, sha256, bytes: bytes.length, mime: info.mime, width: info.width, height: info.height, created: put === 'created' } };
}

// ------------------------------------------------------------------------------------------------ import_logo action
// Gated by the free_issue phase (server read): 'shadow' or 'enforced' only, so accounts can import their logo before
// enforcement; 'absent' / 'prepared' -> not_activated with no side effect. The body is read for `dataBase64` ONLY (no URL is
// ever fetched). Operational byte / dimension bounds are the existing quote-presentation upload bounds (not a quota).
export async function importLogoRoute(deps: { readFreeIssuePhase(): Promise<string>; sql: AssetSql; storage: AssetStorage;
  decode(b64: unknown): { ok: true; bytes: Uint8Array } | { ok: false }; limits: LogoLimits }, userId: string, body: unknown): Promise<Resp> {
  if (!UUID.test(userId)) return err(401, 'not_authenticated');
  let phase: string;
  try { phase = await deps.readFreeIssuePhase(); } catch { return err(503, 'asset_unavailable'); }
  if (phase === 'error') return err(503, 'asset_unavailable');
  if (phase !== 'shadow' && phase !== 'enforced') return err(409, 'not_activated');
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const decoded = deps.decode(b.dataBase64);
  if (!decoded.ok) return err(400, 'invalid_asset');
  return importLogoAsset({ sql: deps.sql, storage: deps.storage }, userId, decoded.bytes, deps.limits);
}
