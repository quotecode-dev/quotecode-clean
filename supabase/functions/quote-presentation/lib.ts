// Task 16 - Quote Experience V2: pure decision logic of the quote-presentation Edge Function.
// docs/task16-quote-experience-v2/CONTRACT.md sections 2 (storage layout) and 3 (API) are binding.
// NO Deno globals and NO remote imports: vitest imports this module directly (lib.test.js). index.ts is a thin I/O shell.
import {
  DEFAULT_QUOTE_STYLE,
  PRESENTATION_TIERS,
  QUOTE_STYLE_VERSIONS,
  isStyleIncluded,
  normalizeStyleId,
  normalizeTierId,
  resolveEffectiveStyle,
  styleSupportsImages,
  type PresentationTierId,
  type QuoteStyleId,
} from '../_shared/quoteStyleCapabilities.ts';

// ---------------------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------------------
export const BUCKET = 'quote-files';
export const ROOT_PREFIX = 't16-presentation';
export const QA_CAPABILITIES_PATH = `${ROOT_PREFIX}/_qa/capabilities.json`;
export const TEST_PROJECT_REF = 'ljfizgrdyzxddswcedwr';
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MIN_IMAGE_SIDE = 64;
export const MAX_IMAGE_SIDE = 6000;
export const MAX_REQUEST_BYTES = 6 * 1024 * 1024;
export const MAX_MEDIA_REFS = 12;
export const MAX_TEXT_LENGTH = 140;
export const MAX_ITEM_KEY_LENGTH = 300;
export const MAX_MEDIA_URL_IDS = 50;
export const MAX_CATALOG_LINKS = 500;
export const SIGNED_URL_TTL_SECONDS = 3600;
export const POLYGLOT_SCAN_BYTES = 1024;
export const MAX_TRAILING_BYTES = 64;
export const MEDIA_ROLES = Object.freeze(['hero', 'support', 'item'] as const);
export type MediaRole = typeof MEDIA_ROLES[number];

export const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const SERVICE_ID_RE = /^(?:[1-9][0-9]{0,18}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

export class PresentationError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message?: string) {
    super(message || code);
    this.name = 'PresentationError';
    this.code = code;
    this.status = status;
  }
}

export type Ok<T> = { ok: true } & T;
export type Fail = { ok: false; code: string; status: number; message: string };
const fail = (code: string, status: number, message: string): Fail => ({ ok: false, code, status, message });

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

// ---------------------------------------------------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------------------------------------------------
// TEST mode only when the function itself runs on the TEST project. Any parse failure / other host => false.
export function testModeFor(supabaseUrl: unknown): boolean {
  if (typeof supabaseUrl !== 'string' || !supabaseUrl) return false;
  try {
    const u = new URL(supabaseUrl);
    return u.protocol === 'https:' && u.hostname === `${TEST_PROJECT_REF}.supabase.co` && !u.username && !u.password && (u.port === '' || u.port === '443');
  } catch {
    return false;
  }
}

export function parseBearer(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const m = header.match(/^Bearer\s+([A-Za-z0-9\-_.=+/]+)\s*$/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Storage paths (server-only prefix; every client storage policy requires first folder = auth.uid(), and
// 't16-presentation' is never a uid, so no client role can read/write/delete these objects).
// ---------------------------------------------------------------------------------------------------------------------
const ASSET_EXTS = Object.freeze(['jpg', 'png', 'webp']);

function requireUuid(value: unknown, what: string): string {
  if (!isUuid(value)) throw new PresentationError('invalid_id', 400, `Invalid ${what}`);
  return (value as string).toLowerCase();
}

export function userRoot(uid: unknown): string {
  return `${ROOT_PREFIX}/${requireUuid(uid, 'user id')}`;
}
export function settingsPath(uid: unknown): string {
  return `${userRoot(uid)}/settings.json`;
}
export function catalogPath(uid: unknown): string {
  return `${userRoot(uid)}/catalog.json`;
}
export function assetObjectPath(uid: unknown, assetId: unknown, ext: unknown): string {
  if (typeof ext !== 'string' || !ASSET_EXTS.includes(ext)) throw new PresentationError('invalid_id', 400, 'Invalid asset extension');
  return `${userRoot(uid)}/assets/${requireUuid(assetId, 'asset id')}.${ext}`;
}
export function assetMetaPath(uid: unknown, assetId: unknown): string {
  return `${userRoot(uid)}/assets/${requireUuid(assetId, 'asset id')}.json`;
}
export function draftPath(uid: unknown, quoteId: unknown): string {
  return `${userRoot(uid)}/quotes/${requireUuid(quoteId, 'quote id')}/draft.json`;
}
export function issuedPath(uid: unknown, quoteId: unknown): string {
  return `${userRoot(uid)}/quotes/${requireUuid(quoteId, 'quote id')}/issued.json`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Request body helpers
// ---------------------------------------------------------------------------------------------------------------------
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function decodedBase64Length(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

// Strict base64 -> bytes; size is checked BEFORE decoding so an oversized payload never allocates.
export function decodeImageBase64(input: unknown): Ok<{ bytes: Uint8Array }> | Fail {
  if (typeof input !== 'string' || input.length === 0) return fail('invalid_image', 400, 'Missing image data');
  const b64 = input.replace(/^data:[a-z/+.-]+;base64,/i, '').replace(/\s+/g, '');
  if (b64.length % 4 !== 0 || !B64_RE.test(b64)) return fail('invalid_image', 400, 'Image data is not valid base64');
  if (decodedBase64Length(b64) > MAX_IMAGE_BYTES) return fail('image_too_large', 413, 'Image is larger than 4 MB');
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    return fail('invalid_image', 400, 'Image data is not valid base64');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { ok: true, bytes };
}

// ---------------------------------------------------------------------------------------------------------------------
// Image detection (magic bytes + header dimensions + polyglot refusal)
// ---------------------------------------------------------------------------------------------------------------------
export type DetectedImage = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp'; width: number; height: number };

const POLYGLOT_MARKERS = ['<script', '<svg', '<?xml', '<html', '<!doctype', '<iframe', '<body', '<object', '<embed', 'javascript:'];

function asciiLower(bytes: Uint8Array, start: number, end: number): string {
  let s = '';
  for (let i = Math.max(0, start); i < Math.min(bytes.length, end); i++) {
    const c = bytes[i];
    s += c >= 0x41 && c <= 0x5a ? String.fromCharCode(c + 32) : String.fromCharCode(c);
  }
  return s;
}

function asciiExact(bytes: Uint8Array, start: number, end: number): string {
  let s = '';
  for (let i = Math.max(0, start); i < Math.min(bytes.length, end); i++) s += String.fromCharCode(bytes[i]);
  return s;
}

export function containsPolyglotMarker(bytes: Uint8Array, start: number, end: number): boolean {
  const text = asciiLower(bytes, start, end);
  return POLYGLOT_MARKERS.some((m) => text.includes(m));
}

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32le = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + ((b[o + 3] << 24) >>> 0);

type Parsed = { width: number; height: number; end: number } | { error: string };

function parsePng(b: Uint8Array): Parsed {
  // IHDR must be the first chunk: length 13, type exactly 'IHDR' (chunk types are case-sensitive bytes).
  if (b.length < 33 || u32be(b, 8) !== 13 || asciiExact(b, 12, 16) !== 'IHDR') return { error: 'PNG header is malformed' };
  const width = u32be(b, 16);
  const height = u32be(b, 20);
  // Walk chunks to IEND to find the real end of the image; image data (IDAT) must come before IEND.
  let o = 8;
  let sawIdat = false;
  while (o + 12 <= b.length) {
    const len = u32be(b, o);
    const type = asciiExact(b, o + 4, o + 8);
    const next = o + 12 + len;
    if (next > b.length || len > b.length) return { error: 'PNG chunk is truncated' };
    if (type === 'IDAT') sawIdat = true;
    if (type === 'IEND') return sawIdat ? { width, height, end: next } : { error: 'PNG has no image data before IEND' };
    o = next;
  }
  return { error: 'PNG has no IEND chunk' };
}

function parseJpeg(b: Uint8Array): Parsed {
  let o = 2;
  let width = 0;
  let height = 0;
  let sawSof = false;
  // Header segments up to the first SOS.
  for (;;) {
    while (o < b.length && b[o] === 0xff && b[o + 1] === 0xff) o++; // fill bytes
    if (o + 4 > b.length || b[o] !== 0xff) return { error: 'JPEG marker structure is malformed' };
    const marker = b[o + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
    if (marker === 0xd9) return { error: 'JPEG has no image data' };
    const len = u16be(b, o + 2);
    if (len < 2 || o + 2 + len > b.length) return { error: 'JPEG segment is truncated' };
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (len < 8) return { error: 'JPEG frame header is malformed' };
      height = u16be(b, o + 5);
      width = u16be(b, o + 7);
      sawSof = true;
    } else if ((marker >= 0xc3 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { error: 'Unsupported JPEG encoding (lossless/arithmetic)' };
    }
    o += 2 + len;
    if (marker === 0xda) break; // SOS: entropy-coded data follows
  }
  if (!sawSof) return { error: 'JPEG has no frame header' };
  // Entropy-coded data: 0xFF is byte-stuffed (FF00) and RSTn are FFD0..FFD7; any other marker is a segment
  // (progressive DHT/SOS/DQT...) to skip by length, until EOI (FFD9).
  while (o + 1 < b.length) {
    if (b[o] !== 0xff) { o++; continue; }
    const m = b[o + 1];
    if (m === 0x00 || m === 0xff || (m >= 0xd0 && m <= 0xd7)) { o += m === 0xff ? 1 : 2; continue; }
    if (m === 0xd9) return { width, height, end: o + 2 };
    if (o + 4 > b.length) break;
    const len = u16be(b, o + 2);
    if (len < 2 || o + 2 + len > b.length) return { error: 'JPEG segment is truncated' };
    o += 2 + len;
  }
  return { error: 'JPEG has no end-of-image marker' };
}

// Minimum RIFF end (8 + riffSize) needed before a chunk's dimension fields may be read.
const WEBP_MIN_END: Record<string, number> = { 'VP8 ': 30, VP8L: 25, VP8X: 30 };

function parseWebp(b: Uint8Array): Parsed {
  if (b.length < 21) return { error: 'WebP header is truncated' };
  const riffSize = u32le(b, 4);
  const end = 8 + riffSize;
  if (riffSize < 4 || end > b.length) return { error: 'WebP RIFF size is invalid' };
  const chunk = asciiExact(b, 12, 16);
  const minEnd = WEBP_MIN_END[chunk];
  if (!minEnd) return { error: 'Unsupported WebP chunk' };
  if (end < minEnd) return { error: 'WebP header is truncated' };
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return { error: 'WebP VP8 frame is malformed' };
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff, end };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return { error: 'WebP VP8L signature is malformed' };
    const bits = u32le(b, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, end };
  }
  // VP8X (extended): the canvas size is in the header, but a real image chunk (VP8 / VP8L) must follow inside the RIFF.
  // Animated WebP (ANIM/ANMF, no top-level VP8/VP8L) is therefore refused.
  const vp8xSize = u32le(b, 16);
  let o = 20 + vp8xSize + (vp8xSize & 1);
  let sawImage = false;
  while (o + 8 <= end) {
    const type = asciiExact(b, o, o + 4);
    const size = u32le(b, o + 4);
    if (type === 'VP8 ' || type === 'VP8L') { sawImage = o + 8 + size <= end; break; }
    o += 8 + size + (size & 1);
  }
  if (!sawImage) return { error: 'WebP VP8X has no image chunk' };
  return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1, end };
}

export function detectImage(input: unknown): Ok<{ image: DetectedImage }> | Fail {
  // ArrayBuffer.isView, not instanceof: a Uint8Array from another realm (tests, workers) is still bytes.
  const b = ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(0);
  if (b.length === 0) return fail('invalid_image', 400, 'Empty image');
  if (b.length > MAX_IMAGE_BYTES) return fail('image_too_large', 413, 'Image is larger than 4 MB');

  let mime: DetectedImage['mime'];
  let ext: DetectedImage['ext'];
  let parsed: Parsed;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    mime = 'image/jpeg'; ext = 'jpg'; parsed = parseJpeg(b);
  } else if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    mime = 'image/png'; ext = 'png'; parsed = parsePng(b);
  } else if (b.length >= 12 && asciiExact(b, 0, 4) === 'RIFF' && asciiExact(b, 8, 12) === 'WEBP') {
    mime = 'image/webp'; ext = 'webp'; parsed = parseWebp(b);
  } else {
    return fail('unsupported_image_type', 415, 'Only JPEG, PNG or WebP images are accepted');
  }
  if ('error' in parsed) return fail('invalid_image', 400, parsed.error);

  // Polyglot refusal: markup in the header region, or a sizeable payload appended after the real end of the image.
  if (containsPolyglotMarker(b, 0, POLYGLOT_SCAN_BYTES)) return fail('invalid_image', 400, 'Image contains markup');
  const trailing = b.length - parsed.end;
  if (trailing > MAX_TRAILING_BYTES) return fail('invalid_image', 400, 'Image has trailing data after its end marker');
  if (trailing > 0 && containsPolyglotMarker(b, parsed.end, b.length)) return fail('invalid_image', 400, 'Image contains markup');

  const { width, height } = parsed;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < MIN_IMAGE_SIDE || height < MIN_IMAGE_SIDE) {
    return fail('image_too_small', 400, `Image must be at least ${MIN_IMAGE_SIDE} px on each side`);
  }
  if (width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE) {
    return fail('image_dimensions_too_large', 400, `Image must be at most ${MAX_IMAGE_SIDE} px on each side`);
  }
  return { ok: true, image: { mime, ext, width, height } };
}

export function buildAssetMeta({ id, image, bytes, sha256, now }: { id: string; image: DetectedImage; bytes: number; sha256: string; now: Date }) {
  return { id: requireUuid(id, 'asset id'), mime: image.mime, bytes, width: image.width, height: image.height, sha256, createdAt: now.toISOString() };
}

// Web-standard crypto (Deno and Node >= 18): not a Deno global.
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Asset meta must exist under the caller's own prefix and agree with the requested id; the object extension follows mime.
export function extForMime(mime: unknown): 'jpg' | 'png' | 'webp' | null {
  return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Quote lock (mirror of src/utils/quoteLock.js isQuoteImmutable)
// ---------------------------------------------------------------------------------------------------------------------
export function isLockedQuote(quote: { status?: unknown; signature?: unknown } | null | undefined): boolean {
  if (!quote) return false;
  const status = String(quote.status || '').toLowerCase();
  return status === 'approved' || status === 'paid' || !!quote.signature;
}

// "Now non-draft or signed": the moment a public view must freeze a snapshot instead of showing a live draft.
// A missing / empty status counts as draft (legacy rows); any non-empty non-draft status (sent / approved / paid) or a
// signature freezes.
export function isPastDraft(quote: { status?: unknown; signature?: unknown } | null | undefined): boolean {
  if (!quote) return false;
  const status = String(quote.status ?? '').trim().toLowerCase();
  return (status !== '' && status !== 'draft') || !!quote.signature;
}

// ---------------------------------------------------------------------------------------------------------------------
// Text + MediaRef validation
// ---------------------------------------------------------------------------------------------------------------------
export type MediaRef = { assetId: string; caption: string; alt: string; role: MediaRole; itemKey: string | null; order: number };

const CONTROL_RE = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}${String.fromCharCode(0x7f, 0x2028, 0x2029)}]`, 'g');

export function cleanText(value: unknown): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const t = value.replace(CONTROL_RE, ' ').trim();
  return t.length > MAX_TEXT_LENGTH ? null : t;
}

export function normalizeItemKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const k = value.replace(CONTROL_RE, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!k) return null;
  return k.length > MAX_ITEM_KEY_LENGTH ? k.slice(0, MAX_ITEM_KEY_LENGTH) : k;
}

// Shape-only parse (no ownership): used first so index.ts knows which asset metas to look up.
export function parseMediaRefs(refs: unknown): Ok<{ media: MediaRef[] }> | Fail {
  if (refs === undefined || refs === null) return { ok: true, media: [] };
  if (!Array.isArray(refs)) return fail('invalid_media', 400, 'media must be an array');
  if (refs.length > MAX_MEDIA_REFS) return fail('too_many_media', 400, `At most ${MAX_MEDIA_REFS} images per quote`);
  const out: (MediaRef & { _i: number })[] = [];
  for (let i = 0; i < refs.length; i++) {
    const r = refs[i];
    if (!r || typeof r !== 'object' || Array.isArray(r)) return fail('invalid_media', 400, `media[${i}] is not an object`);
    const { assetId, caption, alt, role, itemKey, order } = r as Record<string, unknown>;
    if (!isUuid(assetId)) return fail('invalid_media', 400, `media[${i}].assetId is invalid`);
    const c = cleanText(caption);
    if (c === null) return fail('caption_too_long', 400, `media[${i}].caption must be text of at most ${MAX_TEXT_LENGTH} characters`);
    const a = cleanText(alt);
    if (a === null) return fail('caption_too_long', 400, `media[${i}].alt must be text of at most ${MAX_TEXT_LENGTH} characters`);
    if (typeof role !== 'string' || !(MEDIA_ROLES as readonly string[]).includes(role)) return fail('invalid_media_role', 400, `media[${i}].role is invalid`);
    let key: string | null = null;
    if (role === 'item') {
      key = normalizeItemKey(itemKey);
      if (!key) return fail('invalid_media', 400, `media[${i}].itemKey is required for an item image`);
    }
    let ord: number;
    if (order === undefined || order === null) ord = i;
    else if (typeof order === 'number' && Number.isInteger(order) && order >= 0 && order <= 9999) ord = order;
    else return fail('invalid_media', 400, `media[${i}].order must be an integer 0..9999`);
    out.push({ assetId: (assetId as string).toLowerCase(), caption: c, alt: a, role: role as MediaRole, itemKey: key, order: ord, _i: i });
  }
  out.sort((x, y) => x.order - y.order || x._i - y._i);
  return { ok: true, media: out.map(({ _i, ...m }) => m) };
}

export function validateMediaRefs(refs: unknown, ownedAssetIds: Iterable<string>): Ok<{ media: MediaRef[] }> | Fail {
  const parsed = parseMediaRefs(refs);
  if (!parsed.ok) return parsed;
  const owned = new Set(Array.from(ownedAssetIds || [], (x) => String(x).toLowerCase()));
  for (const m of parsed.media) {
    if (!owned.has(m.assetId)) return fail('asset_not_owned', 403, 'An image does not belong to this account');
  }
  return parsed;
}

export function uniqueAssetIds(media: { assetId?: unknown }[] | null | undefined): string[] {
  const s = new Set<string>();
  for (const m of media || []) if (isUuid(m?.assetId)) s.add((m.assetId as string).toLowerCase());
  return Array.from(s);
}

// ---------------------------------------------------------------------------------------------------------------------
// Tier resolution (server-authoritative). Owner console 2026-10-14 ("the modern and visual styles must be open to everyone"): outside
// TEST every account gets the full 'visual' tier (classic + modern + visual) - styles are not plan-gated while tiers are not mapped to plans.
// ---------------------------------------------------------------------------------------------------------------------
export type QaFixture = { v: 1; users: Record<string, PresentationTierId> };

export function normalizeQaFixture(raw: unknown): QaFixture {
  const users: Record<string, PresentationTierId> = Object.create(null);
  const src = raw && typeof raw === 'object' ? (raw as { users?: unknown }).users : null;
  if (src && typeof src === 'object' && !Array.isArray(src)) {
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      if (isUuid(k) && PRESENTATION_TIERS.some((t) => t.id === v)) users[k.toLowerCase()] = v as PresentationTierId;
    }
  }
  return { v: 1, users };
}

export function resolveTier({ testMode, fixture, userId }: { testMode: boolean; fixture: unknown; userId: string }):
  { tier: PresentationTierId; tierSource: 'qa_fixture' | 'default' } {
  if (testMode && isUuid(userId)) {
    const t = normalizeQaFixture(fixture).users[userId.toLowerCase()];
    if (t) return { tier: t, tierSource: 'qa_fixture' };
  }
  return { tier: 'visual', tierSource: 'default' };
}

export function authorizeQaSetCapability({ testMode, callerRole, userId, tier }: { testMode: boolean; callerRole: unknown; userId: unknown; tier: unknown }):
  Ok<{ userId: string; tier: PresentationTierId | null }> | Fail {
  if (!testMode) return fail('qa_not_available', 404, 'QA capability fixtures exist only on the TEST project');
  if (callerRole !== 'super_admin') return fail('forbidden', 403, 'Only a super admin may set QA capabilities');
  if (!isUuid(userId)) return fail('invalid_id', 400, 'Invalid user id');
  if (tier !== null && !PRESENTATION_TIERS.some((t) => t.id === tier)) return fail('invalid_tier', 400, 'Invalid tier');
  return { ok: true, userId: (userId as string).toLowerCase(), tier: tier as PresentationTierId | null };
}

export function applyQaCapability(fixture: unknown, userId: string, tier: PresentationTierId | null): QaFixture {
  const next = normalizeQaFixture(fixture);
  const users: Record<string, PresentationTierId> = { ...next.users };
  if (tier === null) delete users[userId.toLowerCase()];
  else users[userId.toLowerCase()] = tier;
  return { v: 1, users };
}

// ---------------------------------------------------------------------------------------------------------------------
// Settings / default style
// ---------------------------------------------------------------------------------------------------------------------
export function readDefaultStyle(settings: unknown): QuoteStyleId | null {
  return normalizeStyleId(settings && typeof settings === 'object' ? (settings as { defaultStyle?: unknown }).defaultStyle : null);
}

export function planSetDefault({ style, tier, now }: { style: unknown; tier: unknown; now: Date }):
  Ok<{ settings: { v: 1; defaultStyle: QuoteStyleId; updatedAt: string } }> | Fail {
  const s = normalizeStyleId(style);
  if (!s) return fail('invalid_style', 400, 'Unknown style');
  if (!isStyleIncluded(tier, s)) return fail('style_not_entitled', 403, 'This style is not included in the current plan');
  return { ok: true, settings: { v: 1, defaultStyle: s, updatedAt: now.toISOString() } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Draft save
// ---------------------------------------------------------------------------------------------------------------------
export type Draft = { v: 1; style: QuoteStyleId | null; media: MediaRef[]; updatedAt: string };

export function normalizeStoredDraft(raw: unknown): Draft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { style?: unknown; media?: unknown; updatedAt?: unknown };
  const parsed = parseMediaRefs(r.media);
  return {
    v: 1,
    style: normalizeStyleId(r.style),
    media: parsed.ok ? parsed.media : [],
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
  };
}

export function planDraftSave({ quote, issued, existingDraft, style, media, tier, ownedAssetIds, now }: {
  quote: { status?: unknown; signature?: unknown };
  issued: unknown;
  existingDraft: unknown;
  style: unknown;
  media: unknown;
  tier: unknown;
  ownedAssetIds: Iterable<string>;
  now: Date;
}): Ok<{ draft: Draft }> | Fail {
  if (isLockedQuote(quote)) return fail('quote_locked', 409, 'The quote is approved, paid or signed and can no longer change');
  // Owner-facing 409 'quote_issued': an issued snapshot is frozen forever (documented in quotePresentationClient.js).
  if (issued) return fail('quote_issued', 409, 'The quote presentation was already issued and is frozen');
  const previous = normalizeStoredDraft(existingDraft)?.style ?? null;
  // style omitted (undefined) => keep the stored draft style; explicit null => clear (use the business default).
  let nextStyle: QuoteStyleId | null = style === undefined ? previous : null;
  if (style !== null && style !== undefined) {
    nextStyle = normalizeStyleId(style);
    if (!nextStyle) return fail('invalid_style', 400, 'Unknown style');
  }
  // A CHANGED style must be entitled. An unchanged premium style of a downgraded account is preserved (never silently
  // rewritten); issue/public freeze decide what is actually rendered.
  if (nextStyle && nextStyle !== previous && !isStyleIncluded(tier, nextStyle)) {
    return fail('style_not_entitled', 403, 'This style is not included in the current plan');
  }
  const v = validateMediaRefs(media, ownedAssetIds);
  if (!v.ok) return v;
  return { ok: true, draft: { v: 1, style: nextStyle, media: v.media, updatedAt: now.toISOString() } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Issue snapshot
// ---------------------------------------------------------------------------------------------------------------------
export type Branding = { business_name: string | null; logo_url: string | null; tax_id: string | null; email: string | null; phone: string | null; address: string | null };
export type IssuedSnapshot = { v: 1; style: QuoteStyleId; styleVersion: number; issuedAt: string; branding: Branding; media: MediaRef[] };

const BRANDING_FIELDS = ['business_name', 'logo_url', 'tax_id', 'email', 'phone', 'address'] as const;

export function pickBranding(business: unknown): Branding {
  const src = (business && typeof business === 'object' ? business : {}) as Record<string, unknown>;
  const out = {} as Branding;
  for (const f of BRANDING_FIELDS) {
    const v = src[f];
    out[f] = typeof v === 'string' && v !== '' ? v : null;
  }
  return out;
}

function buildSnapshot(style: QuoteStyleId, draft: Draft | null, business: unknown, now: Date): IssuedSnapshot {
  return {
    v: 1,
    style,
    styleVersion: QUOTE_STYLE_VERSIONS[style],
    issuedAt: now.toISOString(),
    branding: pickBranding(business),
    media: styleSupportsImages(style) && draft ? draft.media : [],
  };
}

// Owner-initiated issue: draft.style -> default -> classic; a non-entitled result is REFUSED (draft kept).
export function resolveIssueSnapshot({ draft, settings, tier, business, now }: { draft: unknown; settings: unknown; tier: unknown; business: unknown; now: Date }):
  Ok<{ snapshot: IssuedSnapshot }> | (Fail & { style?: QuoteStyleId }) {
  const d = normalizeStoredDraft(draft);
  const eff = resolveEffectiveStyle({ draftStyle: d?.style, businessDefault: readDefaultStyle(settings), tierId: tier });
  if (!eff.entitled) return { ...fail('style_not_entitled', 409, 'The selected style is not included in the current plan'), style: eff.style };
  return { ok: true, snapshot: buildSnapshot(eff.style, d, business, now) };
}

export function normalizeIssued(raw: unknown): IssuedSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const style = normalizeStyleId(r.style);
  if (!style) return null;
  const parsed = parseMediaRefs(r.media);
  return {
    v: 1,
    style,
    styleVersion: typeof r.styleVersion === 'number' ? r.styleVersion : QUOTE_STYLE_VERSIONS[style],
    issuedAt: typeof r.issuedAt === 'string' ? r.issuedAt : '',
    branding: pickBranding(r.branding),
    media: parsed.ok ? parsed.media : [],
  };
}

// Server-authoritative fallback: the requested style when entitled, otherwise the highest-ranked ENTITLED of
// draft / business default / classic (classic is always entitled).
export function highestEntitledStyle(candidates: unknown[], tier: unknown): QuoteStyleId {
  let best: QuoteStyleId = DEFAULT_QUOTE_STYLE;
  let bestRank = 0;
  for (const c of candidates) {
    const s = normalizeStyleId(c);
    if (!s || !isStyleIncluded(tier, s)) continue;
    const rank = PRESENTATION_TIERS.find((t) => t.id === s)!.rank;
    if (rank > bestRank) { best = s; bestRank = rank; }
  }
  return best;
}

export function resolveEntitledStyle({ draftStyle, defaultStyle, tier }: { draftStyle: unknown; defaultStyle: unknown; tier: unknown }): QuoteStyleId {
  const eff = resolveEffectiveStyle({ draftStyle, businessDefault: defaultStyle, tierId: tier });
  if (eff.entitled) return eff.style;
  return highestEntitledStyle([draftStyle, defaultStyle, DEFAULT_QUOTE_STYLE], normalizeTierId(tier));
}

// ---------------------------------------------------------------------------------------------------------------------
// Public view
// ---------------------------------------------------------------------------------------------------------------------
export type PublicDecision = {
  mode: 'issued' | 'draft' | 'legacy';
  style: QuoteStyleId;
  styleVersion: number;
  branding: Branding | null;
  media: MediaRef[];
  // Set when a snapshot must be written now (lazy freeze). index.ts writes it with upsert:false and, on a race,
  // re-reads and serves whichever snapshot won.
  freeze: IssuedSnapshot | null;
};

export function resolvePublicPresentation({ issued, draft, quote, tier, defaultStyle, business, now }: {
  issued: unknown; draft: unknown; quote: { status?: unknown; signature?: unknown }; tier: unknown; defaultStyle: unknown; business?: unknown; now?: Date;
}): PublicDecision {
  const frozen = normalizeIssued(issued);
  if (frozen) {
    return { mode: 'issued', style: frozen.style, styleVersion: frozen.styleVersion, branding: frozen.branding, media: frozen.media, freeze: null };
  }
  const d = normalizeStoredDraft(draft);
  if (!d) {
    // No Task 16 record: legacy Classic with live branding and no media. Never a fabricated snapshot.
    return { mode: 'legacy', style: DEFAULT_QUOTE_STYLE, styleVersion: QUOTE_STYLE_VERSIONS[DEFAULT_QUOTE_STYLE], branding: null, media: [], freeze: null };
  }
  const style = resolveEntitledStyle({ draftStyle: d.style, defaultStyle, tier });
  if (isPastDraft(quote)) {
    const snapshot = buildSnapshot(style, d, business, now || new Date());
    return { mode: 'issued', style, styleVersion: snapshot.styleVersion, branding: snapshot.branding, media: snapshot.media, freeze: snapshot };
  }
  return { mode: 'draft', style, styleVersion: QUOTE_STYLE_VERSIONS[style], branding: null, media: styleSupportsImages(style) ? d.media : [], freeze: null };
}

export function publicMediaView(media: MediaRef[], urls: Record<string, string | null>) {
  return media.map((m) => {
    const url = urls[m.assetId] ?? null;
    return { url, caption: m.caption, alt: m.alt, role: m.role, itemKey: m.itemKey, missing: !url };
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Catalog links
// ---------------------------------------------------------------------------------------------------------------------
export type Catalog = { v: 1; links: Record<string, { assetId: string; caption: string }> };

export function normalizeServiceId(value: unknown): string | null {
  const s = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof s === 'string' && SERVICE_ID_RE.test(s) ? s.toLowerCase() : null;
}

export function normalizeCatalog(raw: unknown): Catalog {
  const links: Catalog['links'] = {};
  const src = raw && typeof raw === 'object' ? (raw as { links?: unknown }).links : null;
  if (src && typeof src === 'object' && !Array.isArray(src)) {
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      const id = normalizeServiceId(k);
      const link = v as { assetId?: unknown; caption?: unknown } | null;
      const caption = cleanText(link?.caption);
      if (id && link && isUuid(link.assetId) && caption !== null) links[id] = { assetId: (link.assetId as string).toLowerCase(), caption };
    }
  }
  return { v: 1, links };
}

export function planCatalogLink({ catalog, serviceId, assetId, caption, ownedAssetIds }: {
  catalog: unknown; serviceId: unknown; assetId: unknown; caption: unknown; ownedAssetIds: Iterable<string>;
}): Ok<{ catalog: Catalog }> | Fail {
  const sid = normalizeServiceId(serviceId);
  if (!sid) return fail('invalid_id', 400, 'Invalid service id');
  const next = normalizeCatalog(catalog);
  if (assetId === null || assetId === undefined) {
    // Unlink only: the asset object itself is immutable and is never deleted by any Task 16 path.
    delete next.links[sid];
    return { ok: true, catalog: next };
  }
  if (!isUuid(assetId)) return fail('invalid_id', 400, 'Invalid asset id');
  const owned = new Set(Array.from(ownedAssetIds || [], (x) => String(x).toLowerCase()));
  if (!owned.has(assetId.toLowerCase())) return fail('asset_not_owned', 403, 'The image does not belong to this account');
  const c = cleanText(caption);
  if (c === null) return fail('caption_too_long', 400, `caption must be text of at most ${MAX_TEXT_LENGTH} characters`);
  if (!next.links[sid] && Object.keys(next.links).length >= MAX_CATALOG_LINKS) return fail('catalog_full', 400, 'Too many catalog images');
  next.links[sid] = { assetId: assetId.toLowerCase(), caption: c };
  return { ok: true, catalog: next };
}

// ---------------------------------------------------------------------------------------------------------------------
// Per-user asset cap (no DB: counted from the asset meta objects under the caller's own prefix)
// ---------------------------------------------------------------------------------------------------------------------
export const MAX_ASSETS_PER_USER = 200;
export const ASSET_LIST_PAGE = 100;
const ASSET_META_NAME_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.json$/;

export function countAssetMetas(entries: unknown): number {
  if (!Array.isArray(entries)) return 0;
  return entries.filter((e) => e && typeof e === 'object' && ASSET_META_NAME_RE.test(String((e as { name?: unknown }).name ?? ''))).length;
}

export function checkAssetCap(count: number): Ok<Record<never, never>> | Fail {
  return count >= MAX_ASSETS_PER_USER
    ? fail('asset_limit_reached', 409, `At most ${MAX_ASSETS_PER_USER} presentation images per account`)
    : { ok: true };
}

// ---------------------------------------------------------------------------------------------------------------------
// Storage error classification (supabase-js StorageError shapes). Only a missing OBJECT is an empty record; a missing
// bucket or any other failure is an outage (503), never "no record".
// ---------------------------------------------------------------------------------------------------------------------
function storageErrorParts(error: unknown): { status: number; text: string } {
  const e = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
  const orig = (e.originalError && typeof e.originalError === 'object' ? e.originalError : {}) as Record<string, unknown>;
  const status = Number(e.status ?? e.statusCode ?? orig.status ?? 0) || 0;
  const text = `${e.message ?? ''} ${e.error ?? ''} ${e.statusCode ?? ''}`;
  return { status, text };
}

export function isStorageNotFound(error: unknown): boolean {
  const { status, text } = storageErrorParts(error);
  if (/bucket/i.test(text)) return false;
  return status === 404 || /object not found|not[ _-]?found|does not exist|\b404\b/i.test(text);
}

export function isStorageConflict(error: unknown): boolean {
  const { status, text } = storageErrorParts(error);
  if (/bucket/i.test(text)) return false;
  return status === 409 || /already exists|duplicate|\b409\b/i.test(text);
}

// ---------------------------------------------------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------------------------------------------------
export const AUTH_ACTIONS = Object.freeze(['context', 'set_default', 'upload_media', 'media_urls', 'get_quote', 'save_quote', 'issue', 'catalog_link', 'qa_set_capability']);
export const PUBLIC_ACTIONS = Object.freeze(['public_get']);

export function parseRequestBody(text: string): Ok<{ body: Record<string, unknown>; action: string }> | Fail {
  if (text.length > MAX_REQUEST_BYTES) return fail('payload_too_large', 413, 'Request body is too large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail('invalid_request', 400, 'Invalid JSON body');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('invalid_request', 400, 'Invalid request body');
  const action = (body as { action?: unknown }).action;
  if (typeof action !== 'string' || (!AUTH_ACTIONS.includes(action) && !PUBLIC_ACTIONS.includes(action))) {
    return fail('unknown_action', 400, 'Unknown action');
  }
  return { ok: true, body: body as Record<string, unknown>, action };
}

export function parseAssetIdList(value: unknown): Ok<{ ids: string[] }> | Fail {
  if (!Array.isArray(value)) return fail('invalid_request', 400, 'assetIds must be an array');
  if (value.length > MAX_MEDIA_URL_IDS) return fail('invalid_request', 400, `At most ${MAX_MEDIA_URL_IDS} asset ids`);
  const ids = new Set<string>();
  for (const v of value) {
    if (!isUuid(v)) return fail('invalid_id', 400, 'Invalid asset id');
    ids.add(v.toLowerCase());
  }
  return { ok: true, ids: Array.from(ids) };
}
