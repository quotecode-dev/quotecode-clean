/* global Buffer */
import { describe, it, expect } from 'vitest';
import {
  MAX_IMAGE_BYTES,
  QA_CAPABILITIES_PATH,
  applyQaCapability,
  assetMetaPath,
  assetObjectPath,
  authorizeQaSetCapability,
  catalogPath,
  decodeImageBase64,
  detectImage,
  draftPath,
  highestEntitledStyle,
  isLockedQuote,
  isPastDraft,
  issuedPath,
  normalizeCatalog,
  normalizeItemKey,
  parseAssetIdList,
  parseBearer,
  parseRequestBody,
  planCatalogLink,
  planDraftSave,
  planSetDefault,
  publicMediaView,
  resolveIssueSnapshot,
  resolvePublicPresentation,
  resolveTier,
  settingsPath,
  sha256Hex,
  testModeFor,
  validateMediaRefs,
} from './lib.ts';
import { isQuoteImmutable } from '../../../src/utils/quoteLock.js';
import {
  ASSET_LIST_PAGE, MAX_ASSETS_PER_USER, checkAssetCap, countAssetMetas, isStorageConflict, isStorageNotFound,
} from './lib.ts';

const UID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const QID = '33333333-3333-4333-8333-333333333333';
const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const A2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const A_OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NOW = new Date('2026-10-04T10:00:00.000Z');

// ------------------------------------------------------------------ image fixtures
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const ascii = (s) => Array.from(s, (c) => c.charCodeAt(0));
const chunk = (type, data) => [...be32(data.length), ...ascii(type), ...data, 0, 0, 0, 0];

function png(w, h, { extraChunks = [], trailing = [] } = {}) {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [...be32(w), ...be32(h), 8, 2, 0, 0, 0]),
    ...extraChunks.flat(),
    ...chunk('IDAT', [1, 2, 3, 4]),
    ...chunk('IEND', []),
    ...trailing,
  ]);
}

function jpeg(w, h, { sof = 0xc0, trailing = [], app = [] } = {}) {
  const sofSeg = [0xff, sof, 0, 11, 8, (h >> 8) & 255, h & 255, (w >> 8) & 255, w & 255, 1, 1, 0x11, 0];
  const sos = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0];
  const entropy = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56];
  return new Uint8Array([0xff, 0xd8, ...app, ...sofSeg, ...sos, ...entropy, 0xff, 0xd9, ...trailing]);
}

function riff(chunkBytes, trailing = []) {
  const body = [...ascii('WEBP'), ...chunkBytes];
  return new Uint8Array([...ascii('RIFF'), ...le32(body.length), ...body, ...trailing]);
}
function webpVp8(w, h) {
  const data = [0, 0, 0, 0x9d, 0x01, 0x2a, w & 255, (w >> 8) & 0x3f, h & 255, (h >> 8) & 0x3f, 0, 0];
  return riff([...ascii('VP8 '), ...le32(data.length), ...data]);
}
function webpVp8l(w, h) {
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  const data = [0x2f, ...le32(bits), 0, 0, 0];
  return riff([...ascii('VP8L'), ...le32(data.length), ...data]);
}
function webpVp8x(w, h, trailing = [], { image = true } = {}) {
  const data = [0, 0, 0, 0, (w - 1) & 255, ((w - 1) >> 8) & 255, ((w - 1) >> 16) & 255, (h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255];
  const bits = ((w - 1) & 0x3fff) | (((h - 1) & 0x3fff) << 14);
  const vp8l = [0x2f, ...le32(bits), 0, 0, 0];
  const alph = [1, 2, 3];
  const after = image ? [...ascii('VP8L'), ...le32(vp8l.length), ...vp8l] : [...ascii('ALPH'), ...le32(alph.length), ...alph, 0];
  return riff([...ascii('VP8X'), ...le32(data.length), ...data, ...after], trailing);
}
// PNG with arbitrary chunk list (type strings used verbatim, so case can be tested)
function pngRaw(chunks) {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunks.flatMap(([t, d]) => chunk(t, d))]);
}
const toB64 = (u8) => Buffer.from(u8).toString('base64');

describe('detectImage', () => {
  it('accepts PNG / JPEG (SOF0,1,2) / WebP (VP8, VP8L, VP8X) and parses dimensions', () => {
    expect(detectImage(png(640, 480))).toEqual({ ok: true, image: { mime: 'image/png', ext: 'png', width: 640, height: 480 } });
    for (const sof of [0xc0, 0xc1, 0xc2]) {
      expect(detectImage(jpeg(1600, 900, { sof }))).toEqual({ ok: true, image: { mime: 'image/jpeg', ext: 'jpg', width: 1600, height: 900 } });
    }
    expect(detectImage(webpVp8(300, 200)).image).toEqual({ mime: 'image/webp', ext: 'webp', width: 300, height: 200 });
    expect(detectImage(webpVp8l(301, 201)).image).toEqual({ mime: 'image/webp', ext: 'webp', width: 301, height: 201 });
    expect(detectImage(webpVp8x(5000, 64)).image).toEqual({ mime: 'image/webp', ext: 'webp', width: 5000, height: 64 });
  });

  it('JPEG with an APP segment before the frame header is parsed', () => {
    const app = [0xff, 0xe0, 0, 16, ...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
    expect(detectImage(jpeg(800, 600, { app })).image).toMatchObject({ width: 800, height: 600 });
  });

  it('enforces 64..6000 px per side', () => {
    expect(detectImage(png(63, 500))).toMatchObject({ ok: false, code: 'image_too_small' });
    expect(detectImage(png(500, 63))).toMatchObject({ ok: false, code: 'image_too_small' });
    expect(detectImage(png(64, 64)).ok).toBe(true);
    expect(detectImage(png(6000, 6000)).ok).toBe(true);
    expect(detectImage(png(6001, 100))).toMatchObject({ ok: false, code: 'image_dimensions_too_large' });
    expect(detectImage(jpeg(100, 6001))).toMatchObject({ ok: false, code: 'image_dimensions_too_large' });
  });

  it('rejects > 4 MB', () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png(100, 100));
    expect(detectImage(big)).toMatchObject({ ok: false, code: 'image_too_large', status: 413 });
  });

  it('rejects SVG, HTML, GIF, empty and unknown content', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(detectImage(svg)).toMatchObject({ ok: false, code: 'unsupported_image_type' });
    expect(detectImage(new TextEncoder().encode('<!doctype html><html></html>'))).toMatchObject({ ok: false, code: 'unsupported_image_type' });
    expect(detectImage(new TextEncoder().encode('GIF89a......'))).toMatchObject({ ok: false, code: 'unsupported_image_type' });
    expect(detectImage(new Uint8Array(0))).toMatchObject({ ok: false, code: 'invalid_image' });
    expect(detectImage(null)).toMatchObject({ ok: false });
  });

  it('rejects polyglots: markup in the first 1 KB', () => {
    const comment = (text) => { const d = ascii(text); return [0xff, 0xfe, (d.length + 2) >> 8, (d.length + 2) & 255, ...d]; };
    for (const m of ['<script>', '<SVG onload=x>', '<?xml version="1.0"?>', '<html>']) {
      expect(detectImage(jpeg(200, 200, { app: comment(m) })), m).toMatchObject({ ok: false, code: 'invalid_image' });
    }
    expect(detectImage(png(200, 200, { extraChunks: [chunk('tEXt', ascii('c\0<script>x</script>'))] }))).toMatchObject({ ok: false, code: 'invalid_image' });
  });

  it('rejects > 64 bytes after the JPEG EOI / PNG IEND / RIFF end; tolerates small padding', () => {
    expect(detectImage(jpeg(200, 200, { trailing: new Array(65).fill(0) }))).toMatchObject({ ok: false, code: 'invalid_image' });
    expect(detectImage(jpeg(200, 200, { trailing: new Array(64).fill(0) })).ok).toBe(true);
    expect(detectImage(png(200, 200, { trailing: new Array(65).fill(7) }))).toMatchObject({ ok: false, code: 'invalid_image' });
    expect(detectImage(webpVp8x(200, 200, new Array(65).fill(1)))).toMatchObject({ ok: false, code: 'invalid_image' });
    // a short tail that is markup is still refused
    expect(detectImage(jpeg(200, 200, { trailing: ascii('<script>') }))).toMatchObject({ ok: false, code: 'invalid_image' });
    // a large appended zip/html payload after the image
    const payload = ascii(`PK\u0003\u0004${'x'.repeat(2000)}`);
    expect(detectImage(png(200, 200, { trailing: payload }))).toMatchObject({ ok: false, code: 'invalid_image' });
  });

  it('rejects malformed / truncated headers and unsupported JPEG encodings', () => {
    expect(detectImage(png(200, 200).slice(0, 40))).toMatchObject({ ok: false, code: 'invalid_image' });
    const noEoi = jpeg(200, 200); expect(detectImage(noEoi.slice(0, noEoi.length - 2))).toMatchObject({ ok: false, code: 'invalid_image' });
    expect(detectImage(jpeg(200, 200, { sof: 0xc3 }))).toMatchObject({ ok: false, code: 'invalid_image' });
    const noSof = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 1, 0xff, 0xd9]);
    expect(detectImage(noSof)).toMatchObject({ ok: false, code: 'invalid_image' });
    const badRiff = webpVp8(200, 200); badRiff[4] = 0xff; badRiff[5] = 0xff;
    expect(detectImage(badRiff)).toMatchObject({ ok: false, code: 'invalid_image' });
  });
});

describe('detectImage structure hardening (review L2/L3)', () => {
  const ihdr = (w, h) => [...be32(w), ...be32(h), 8, 2, 0, 0, 0];
  it('PNG must carry IDAT before IEND', () => {
    expect(detectImage(pngRaw([['IHDR', ihdr(200, 200)], ['IEND', []]]))).toMatchObject({ ok: false, code: 'invalid_image' });
    expect(detectImage(pngRaw([['IHDR', ihdr(200, 200)], ['IEND', []], ['IDAT', [1]]]))).toMatchObject({ ok: false, code: 'invalid_image' });
    expect(detectImage(pngRaw([['IHDR', ihdr(200, 200)], ['IDAT', [1]], ['IEND', []]])).ok).toBe(true);
  });
  it('PNG chunk types are compared case-sensitively', () => {
    expect(detectImage(pngRaw([['ihdr', ihdr(200, 200)], ['IDAT', [1]], ['IEND', []]]))).toMatchObject({ ok: false, code: 'invalid_image' });
    expect(detectImage(pngRaw([['IHDR', ihdr(200, 200)], ['idat', [1]], ['IEND', []]]))).toMatchObject({ ok: false, code: 'invalid_image' });
    expect(detectImage(pngRaw([['IHDR', ihdr(200, 200)], ['IDAT', [1]], ['iend', []]]))).toMatchObject({ ok: false, code: 'invalid_image' });
  });
  it('WebP signatures are case-sensitive', () => {
    const lower = webpVp8(200, 200); lower.set(ascii('riff'), 0);
    expect(detectImage(lower)).toMatchObject({ ok: false, code: 'unsupported_image_type' });
    const vp8lower = webpVp8(200, 200); vp8lower.set(ascii('vp8 '), 12);
    expect(detectImage(vp8lower)).toMatchObject({ ok: false, code: 'invalid_image' });
  });
  it('WebP: the RIFF must be long enough to hold the dimension fields', () => {
    const shortVp8 = webpVp8(200, 200); shortVp8.set(le32(20), 4); // end = 28 < 30
    expect(detectImage(shortVp8)).toMatchObject({ ok: false, code: 'invalid_image' });
    const shortVp8l = webpVp8l(200, 200); shortVp8l.set(le32(16), 4); // end = 24 < 25
    expect(detectImage(shortVp8l)).toMatchObject({ ok: false, code: 'invalid_image' });
  });
  it('WebP VP8X needs a VP8/VP8L image chunk inside the RIFF', () => {
    expect(detectImage(webpVp8x(300, 200)).image).toMatchObject({ width: 300, height: 200 });
    expect(detectImage(webpVp8x(300, 200, [], { image: false }))).toMatchObject({ ok: false, code: 'invalid_image' });
  });
});

describe('decodeImageBase64', () => {
  it('decodes strict base64 (with or without a data: prefix) and round-trips', () => {
    const bytes = png(100, 100);
    expect(decodeImageBase64(toB64(bytes))).toEqual({ ok: true, bytes });
    expect(decodeImageBase64(`data:image/png;base64,${toB64(bytes)}`)).toEqual({ ok: true, bytes });
  });
  it('refuses junk and oversized payloads before decoding', () => {
    expect(decodeImageBase64('not base64!!')).toMatchObject({ ok: false, code: 'invalid_image' });
    expect(decodeImageBase64('')).toMatchObject({ ok: false });
    expect(decodeImageBase64(123)).toMatchObject({ ok: false });
    expect(decodeImageBase64('A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 3) / 3) * 4))).toMatchObject({ ok: false, code: 'image_too_large' });
  });
});

describe('sha256Hex', () => {
  it('hashes with web crypto', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('isLockedQuote mirrors src/utils/quoteLock.js', () => {
  const cases = [null, {}, { status: 'draft' }, { status: 'sent' }, { status: 'approved' }, { status: 'PAID' }, { status: 'sent', signature: 'data:x' }, { status: 'draft', signature: '' }];
  it('agrees with isQuoteImmutable on every case', () => {
    for (const q of cases) expect(isLockedQuote(q), JSON.stringify(q)).toBe(isQuoteImmutable(q));
  });
  it('isPastDraft: any non-empty non-draft status or a signature; null / empty status counts as draft', () => {
    expect(isPastDraft({ status: 'draft' })).toBe(false);
    expect(isPastDraft({ status: ' Draft ' })).toBe(false);
    expect(isPastDraft({ status: null })).toBe(false);
    expect(isPastDraft({ status: '' })).toBe(false);
    expect(isPastDraft({})).toBe(false);
    expect(isPastDraft({ status: null, signature: 'sig' })).toBe(true);
    expect(isPastDraft({ status: 'approved' })).toBe(true);
    expect(isPastDraft({ status: 'paid' })).toBe(true);
    expect(isPastDraft({ status: 'sent' })).toBe(true);
    expect(isPastDraft({ status: 'draft', signature: 'sig' })).toBe(true);
  });
});

describe('testModeFor', () => {
  it('true only for the TEST project host over https', () => {
    expect(testModeFor('https://ljfizgrdyzxddswcedwr.supabase.co')).toBe(true);
    expect(testModeFor('https://ljfizgrdyzxddswcedwr.supabase.co/')).toBe(true);
    for (const u of ['https://ixabnzhjeqevtbhdfswv.supabase.co', 'http://ljfizgrdyzxddswcedwr.supabase.co', 'https://ljfizgrdyzxddswcedwr.supabase.co.evil.com',
      'https://evil.com/ljfizgrdyzxddswcedwr.supabase.co', 'https://x@ljfizgrdyzxddswcedwr.supabase.co', 'http://127.0.0.1:54321', '', null, undefined, 'garbage']) {
      expect(testModeFor(u), String(u)).toBe(false);
    }
  });
});

describe('path builders', () => {
  it('build the CONTRACT layout under t16-presentation/<uid>/', () => {
    expect(settingsPath(UID)).toBe(`t16-presentation/${UID}/settings.json`);
    expect(catalogPath(UID)).toBe(`t16-presentation/${UID}/catalog.json`);
    expect(assetObjectPath(UID, A1, 'webp')).toBe(`t16-presentation/${UID}/assets/${A1}.webp`);
    expect(assetMetaPath(UID, A1)).toBe(`t16-presentation/${UID}/assets/${A1}.json`);
    expect(draftPath(UID, QID)).toBe(`t16-presentation/${UID}/quotes/${QID}/draft.json`);
    expect(issuedPath(UID, QID)).toBe(`t16-presentation/${UID}/quotes/${QID}/issued.json`);
    expect(QA_CAPABILITIES_PATH).toBe('t16-presentation/_qa/capabilities.json');
  });
  it('reject anything not UUID-shaped (traversal, slashes, _qa) and bad extensions', () => {
    for (const bad of ['../x', `${UID}/..`, '_qa', '', null, 42, `${UID} `, `${UID}/x`]) {
      expect(() => settingsPath(bad), String(bad)).toThrow(/Invalid/);
      expect(() => draftPath(UID, bad), String(bad)).toThrow(/Invalid/);
      expect(() => assetMetaPath(UID, bad), String(bad)).toThrow(/Invalid/);
    }
    expect(() => assetObjectPath(UID, A1, 'svg')).toThrow(/Invalid/);
    expect(() => assetObjectPath(UID, A1, 'jpg/../x')).toThrow(/Invalid/);
  });
});

describe('validateMediaRefs', () => {
  const ref = (o = {}) => ({ assetId: A1, caption: 'Front', alt: 'Front view', role: 'hero', itemKey: null, order: 0, ...o });
  it('normalizes captions, itemKey and order; sorts by order', () => {
    const r = validateMediaRefs([
      ref({ assetId: A2, role: 'item', itemKey: '  Oak   TABLE\n', order: 2, caption: '  Table  ' }),
      ref({ order: 1, role: 'support', itemKey: 'ignored' }),
    ], [A1, A2]);
    expect(r).toEqual({ ok: true, media: [
      { assetId: A1, caption: 'Front', alt: 'Front view', role: 'support', itemKey: null, order: 1 },
      { assetId: A2, caption: 'Table', alt: 'Front view', role: 'item', itemKey: 'oak table', order: 2 },
    ] });
    expect(normalizeItemKey('  A  b\tC ')).toBe('a b c');
  });
  it('max 12 refs', () => {
    expect(validateMediaRefs(Array.from({ length: 12 }, (_, i) => ref({ order: i })), [A1]).ok).toBe(true);
    expect(validateMediaRefs(Array.from({ length: 13 }, (_, i) => ref({ order: i })), [A1])).toMatchObject({ ok: false, code: 'too_many_media' });
  });
  it('captions/alt <= 140 after trimming', () => {
    expect(validateMediaRefs([ref({ caption: `  ${'x'.repeat(140)}  ` })], [A1]).ok).toBe(true);
    expect(validateMediaRefs([ref({ caption: 'x'.repeat(141) })], [A1])).toMatchObject({ ok: false, code: 'caption_too_long' });
    expect(validateMediaRefs([ref({ alt: 'x'.repeat(141) })], [A1])).toMatchObject({ ok: false, code: 'caption_too_long' });
    expect(validateMediaRefs([ref({ caption: 5 })], [A1])).toMatchObject({ ok: false });
  });
  it('roles allowlisted, item requires itemKey, order is an int', () => {
    expect(validateMediaRefs([ref({ role: 'banner' })], [A1])).toMatchObject({ ok: false, code: 'invalid_media_role' });
    expect(validateMediaRefs([ref({ role: 'item', itemKey: '   ' })], [A1])).toMatchObject({ ok: false, code: 'invalid_media' });
    expect(validateMediaRefs([ref({ order: 1.5 })], [A1])).toMatchObject({ ok: false, code: 'invalid_media' });
    expect(validateMediaRefs([ref({ order: '1' })], [A1])).toMatchObject({ ok: false, code: 'invalid_media' });
    expect(validateMediaRefs([ref({ assetId: '../x' })], [A1])).toMatchObject({ ok: false, code: 'invalid_media' });
    expect(validateMediaRefs('nope', [A1])).toMatchObject({ ok: false, code: 'invalid_media' });
  });
  it("assets of another user are rejected", () => {
    expect(validateMediaRefs([ref({ assetId: A_OTHER })], [A1, A2])).toMatchObject({ ok: false, code: 'asset_not_owned', status: 403 });
  });
});

describe('tier resolution and QA capability', () => {
  const fixture = { v: 1, users: { [UID]: 'visual', [OTHER]: 'bogus' } };
  it('fixture only applies in TEST mode', () => {
    expect(resolveTier({ testMode: true, fixture, userId: UID })).toEqual({ tier: 'visual', tierSource: 'qa_fixture' });
    // Owner 2026-10-14: every account outside a TEST QA fixture gets the full visual tier (all three styles)
    expect(resolveTier({ testMode: false, fixture, userId: UID })).toEqual({ tier: 'visual', tierSource: 'default' });
    expect(resolveTier({ testMode: true, fixture, userId: OTHER })).toEqual({ tier: 'visual', tierSource: 'default' });
    expect(resolveTier({ testMode: true, fixture: null, userId: UID })).toEqual({ tier: 'visual', tierSource: 'default' });
  });
  it('qa_set_capability refused outside TEST and for non-super_admin', () => {
    expect(authorizeQaSetCapability({ testMode: false, callerRole: 'super_admin', userId: UID, tier: 'visual' })).toMatchObject({ ok: false, code: 'qa_not_available' });
    for (const role of ['admin', 'user', null, undefined, 'SUPER_ADMIN']) {
      expect(authorizeQaSetCapability({ testMode: true, callerRole: role, userId: UID, tier: 'visual' })).toMatchObject({ ok: false, code: 'forbidden', status: 403 });
    }
    expect(authorizeQaSetCapability({ testMode: true, callerRole: 'super_admin', userId: 'x', tier: 'visual' })).toMatchObject({ ok: false, code: 'invalid_id' });
    expect(authorizeQaSetCapability({ testMode: true, callerRole: 'super_admin', userId: UID, tier: 'pro' })).toMatchObject({ ok: false, code: 'invalid_tier' });
    expect(authorizeQaSetCapability({ testMode: true, callerRole: 'super_admin', userId: UID, tier: 'modern' })).toEqual({ ok: true, userId: UID, tier: 'modern' });
  });
  it('applyQaCapability sets and clears a user tier, dropping junk entries', () => {
    expect(applyQaCapability(fixture, OTHER, 'modern')).toEqual({ v: 1, users: { [UID]: 'visual', [OTHER]: 'modern' } });
    expect(applyQaCapability(fixture, UID, null)).toEqual({ v: 1, users: {} });
  });
});

describe('planSetDefault', () => {
  it('refuses a style outside the tier with style_not_entitled (403)', () => {
    expect(planSetDefault({ style: 'modern', tier: 'classic', now: NOW })).toMatchObject({ ok: false, code: 'style_not_entitled', status: 403 });
    expect(planSetDefault({ style: 'svg', tier: 'visual', now: NOW })).toMatchObject({ ok: false, code: 'invalid_style' });
    expect(planSetDefault({ style: 'modern', tier: 'modern', now: NOW })).toEqual({ ok: true, settings: { v: 1, defaultStyle: 'modern', updatedAt: NOW.toISOString() } });
  });
});

describe('planDraftSave', () => {
  const base = { quote: { status: 'draft' }, issued: null, existingDraft: null, media: [], tier: 'classic', ownedAssetIds: [A1], now: NOW };
  it('changed premium style by a classic-tier user is refused', () => {
    expect(planDraftSave({ ...base, style: 'modern' })).toMatchObject({ ok: false, code: 'style_not_entitled', status: 403 });
    expect(planDraftSave({ ...base, existingDraft: { v: 1, style: 'visual', media: [] }, style: 'modern' })).toMatchObject({ ok: false, code: 'style_not_entitled' });
  });
  it('unchanged premium style is preserved on save after a downgrade', () => {
    const r = planDraftSave({ ...base, existingDraft: { v: 1, style: 'visual', media: [] }, style: 'visual', media: [{ assetId: A1, role: 'hero', order: 0 }] });
    expect(r).toMatchObject({ ok: true, draft: { v: 1, style: 'visual', updatedAt: NOW.toISOString() } });
    expect(r.draft.media).toHaveLength(1);
  });
  it('classic or null style is always allowed; entitled change allowed', () => {
    expect(planDraftSave({ ...base, style: null }).draft.style).toBe(null);
    expect(planDraftSave({ ...base, style: 'classic' }).draft.style).toBe('classic');
    expect(planDraftSave({ ...base, tier: 'visual', style: 'visual' }).draft.style).toBe('visual');
    expect(planDraftSave({ ...base, style: 'fancy' })).toMatchObject({ ok: false, code: 'invalid_style' });
  });
  it('locked quote (approved / paid / signed) save is refused', () => {
    for (const quote of [{ status: 'approved' }, { status: 'paid' }, { status: 'sent', signature: 'data:image/png;base64,AA==' }]) {
      expect(planDraftSave({ ...base, quote, style: 'classic' })).toMatchObject({ ok: false, code: 'quote_locked', status: 409 });
    }
  });
  it('issued quote save is refused (the snapshot is never overwritten)', () => {
    expect(planDraftSave({ ...base, issued: { v: 1, style: 'classic' }, style: 'classic' })).toMatchObject({ ok: false, code: 'quote_issued', status: 409 });
  });
  it("another user's asset is refused", () => {
    expect(planDraftSave({ ...base, style: null, media: [{ assetId: A_OTHER, role: 'hero' }] })).toMatchObject({ ok: false, code: 'asset_not_owned' });
  });
  it('omitted style keeps the stored draft style (even a premium one after a downgrade); explicit null clears it', () => {
    const existingDraft = { v: 1, style: 'visual', media: [] };
    expect(planDraftSave({ ...base, existingDraft, style: undefined }).draft.style).toBe('visual');
    expect(planDraftSave({ ...base, existingDraft: null, style: undefined }).draft.style).toBe(null);
    expect(planDraftSave({ ...base, existingDraft, style: null }).draft.style).toBe(null);
  });
});

describe('resolveIssueSnapshot', () => {
  const business = { business_name: 'Acme', logo_url: 'data:image/png;base64,AA==', tax_id: '123', email: 'a@b.c', phone: '', address: 'Street 1', role: 'super_admin', plan: 'pro' };
  const media = [{ assetId: A1, caption: 'c', alt: 'a', role: 'hero', itemKey: null, order: 0 }];
  it('refuses a non-entitled draft style with style_not_entitled (409), reporting the style', () => {
    expect(resolveIssueSnapshot({ draft: { style: 'visual', media }, settings: null, tier: 'modern', business, now: NOW }))
      .toMatchObject({ ok: false, code: 'style_not_entitled', status: 409, style: 'visual' });
    expect(resolveIssueSnapshot({ draft: { style: null, media }, settings: { defaultStyle: 'modern' }, tier: 'classic', business, now: NOW }))
      .toMatchObject({ ok: false, code: 'style_not_entitled', style: 'modern' });
  });
  it('freezes draft.style -> default -> classic with styleVersion, issuedAt, branding (only the 6 fields) and media', () => {
    expect(resolveIssueSnapshot({ draft: { style: 'modern', media }, settings: { defaultStyle: 'visual' }, tier: 'visual', business, now: NOW })).toEqual({
      ok: true,
      snapshot: { v: 1, style: 'modern', styleVersion: 1, issuedAt: NOW.toISOString(),
        branding: { business_name: 'Acme', logo_url: 'data:image/png;base64,AA==', tax_id: '123', email: 'a@b.c', phone: null, address: 'Street 1' }, media },
    });
    expect(resolveIssueSnapshot({ draft: { style: null, media }, settings: { defaultStyle: 'visual' }, tier: 'visual', business, now: NOW }).snapshot.style).toBe('visual');
    const classic = resolveIssueSnapshot({ draft: null, settings: null, tier: 'classic', business: null, now: NOW });
    expect(classic.snapshot).toMatchObject({ style: 'classic', media: [], branding: { business_name: null } });
  });
  it('classic snapshot carries no media', () => {
    expect(resolveIssueSnapshot({ draft: { style: 'classic', media }, settings: null, tier: 'visual', business, now: NOW }).snapshot.media).toEqual([]);
  });
});

describe('resolvePublicPresentation', () => {
  const media = [{ assetId: A1, caption: 'c', alt: 'a', role: 'hero', itemKey: null, order: 0 }];
  const issued = { v: 1, style: 'visual', styleVersion: 1, issuedAt: '2026-01-01T00:00:00.000Z', branding: { business_name: 'Old name' }, media };
  it('issued snapshot wins and is never re-frozen, whatever the current tier/draft', () => {
    const r = resolvePublicPresentation({ issued, draft: { style: 'classic', media: [] }, quote: { status: 'approved' }, tier: 'classic', defaultStyle: 'classic' });
    expect(r).toMatchObject({ mode: 'issued', style: 'visual', freeze: null, media });
    expect(r.branding.business_name).toBe('Old name');
  });
  it('legacy when there is no Task 16 record (no fabricated snapshot)', () => {
    expect(resolvePublicPresentation({ issued: null, draft: null, quote: { status: 'approved', signature: 's' }, tier: 'visual', defaultStyle: 'visual' }))
      .toEqual({ mode: 'legacy', style: 'classic', styleVersion: 1, branding: null, media: [], freeze: null });
  });
  it('draft quote: entitled-resolved draft, live branding, no freeze', () => {
    expect(resolvePublicPresentation({ issued: null, draft: { style: 'modern', media }, quote: { status: 'draft' }, tier: 'modern', defaultStyle: null }))
      .toMatchObject({ mode: 'draft', style: 'modern', branding: null, media, freeze: null });
  });
  it('lazy freeze for a non-draft or signed quote resolves to the highest entitled of draft/default/classic', () => {
    const business = { business_name: 'Acme' };
    // visual requested, modern tier, default modern => modern
    let r = resolvePublicPresentation({ issued: null, draft: { style: 'visual', media }, quote: { status: 'sent' }, tier: 'modern', defaultStyle: 'modern', business, now: NOW });
    expect(r).toMatchObject({ mode: 'issued', style: 'modern', media, freeze: { v: 1, style: 'modern', issuedAt: NOW.toISOString(), branding: { business_name: 'Acme' }, media } });
    // visual requested, classic tier => classic (no media)
    r = resolvePublicPresentation({ issued: null, draft: { style: 'visual', media }, quote: { status: 'draft', signature: 'sig' }, tier: 'classic', defaultStyle: 'modern', business, now: NOW });
    expect(r).toMatchObject({ mode: 'issued', style: 'classic', media: [], freeze: { style: 'classic', media: [] } });
    // entitled draft style kept even when the default ranks higher
    r = resolvePublicPresentation({ issued: null, draft: { style: 'modern', media }, quote: { status: 'sent' }, tier: 'visual', defaultStyle: 'visual', business, now: NOW });
    expect(r.style).toBe('modern');
  });
  it('a quote with a null / empty status is treated as draft (no lazy freeze)', () => {
    for (const status of [null, '', undefined]) {
      expect(resolvePublicPresentation({ issued: null, draft: { style: 'modern', media }, quote: { status }, tier: 'modern', defaultStyle: null }))
        .toMatchObject({ mode: 'draft', style: 'modern', freeze: null });
    }
  });
  it('a draft-status quote with an unentitled draft style shows the entitled fallback without freezing', () => {
    expect(resolvePublicPresentation({ issued: null, draft: { style: 'visual', media }, quote: { status: 'draft' }, tier: 'classic', defaultStyle: null }))
      .toMatchObject({ mode: 'draft', style: 'classic', media: [], freeze: null });
  });
  it('highestEntitledStyle', () => {
    expect(highestEntitledStyle(['visual', 'modern', 'classic'], 'modern')).toBe('modern');
    expect(highestEntitledStyle(['visual', null, 'classic'], 'classic')).toBe('classic');
    expect(highestEntitledStyle([], 'visual')).toBe('classic');
  });
  it('publicMediaView marks unreadable objects missing and never exposes asset ids', () => {
    const v = publicMediaView([...media, { ...media[0], assetId: A2, order: 1 }], { [A1]: 'https://signed/1', [A2]: null });
    expect(v).toEqual([
      { url: 'https://signed/1', caption: 'c', alt: 'a', role: 'hero', itemKey: null, missing: false },
      { url: null, caption: 'c', alt: 'a', role: 'hero', itemKey: null, missing: true },
    ]);
  });
});

describe('catalog links', () => {
  it('links an owned asset, unlinks without touching assets, refuses foreign assets and bad ids', () => {
    const linked = planCatalogLink({ catalog: null, serviceId: 42, assetId: A1, caption: ' Oak ', ownedAssetIds: [A1] });
    expect(linked).toEqual({ ok: true, catalog: { v: 1, links: { 42: { assetId: A1, caption: 'Oak' } } } });
    expect(planCatalogLink({ catalog: linked.catalog, serviceId: '42', assetId: null, caption: '', ownedAssetIds: [] }))
      .toEqual({ ok: true, catalog: { v: 1, links: {} } });
    expect(planCatalogLink({ catalog: null, serviceId: 42, assetId: A_OTHER, caption: '', ownedAssetIds: [A1] })).toMatchObject({ ok: false, code: 'asset_not_owned' });
    for (const sid of ['__proto__', '../x', '', null, -1, 1.5]) {
      expect(planCatalogLink({ catalog: null, serviceId: sid, assetId: A1, caption: '', ownedAssetIds: [A1] }), String(sid)).toMatchObject({ ok: false, code: 'invalid_id' });
    }
  });
  it('normalizeCatalog drops junk entries', () => {
    expect(normalizeCatalog({ links: { 7: { assetId: A1, caption: 'x' }, bad: { assetId: A1 }, 8: { assetId: 'nope' } } }))
      .toEqual({ v: 1, links: { 7: { assetId: A1, caption: 'x' } } });
  });
});

describe('request parsing', () => {
  it('parseRequestBody: size cap, JSON, known action', () => {
    expect(parseRequestBody(JSON.stringify({ action: 'context' }))).toMatchObject({ ok: true, action: 'context' });
    expect(parseRequestBody('{')).toMatchObject({ ok: false, code: 'invalid_request' });
    expect(parseRequestBody('[]')).toMatchObject({ ok: false, code: 'invalid_request' });
    expect(parseRequestBody(JSON.stringify({ action: 'drop_tables' }))).toMatchObject({ ok: false, code: 'unknown_action' });
    expect(parseRequestBody('x'.repeat(6 * 1024 * 1024 + 1))).toMatchObject({ ok: false, code: 'payload_too_large', status: 413 });
  });
  it('parseBearer', () => {
    expect(parseBearer('Bearer abc.def-ghi_j')).toBe('abc.def-ghi_j');
    expect(parseBearer('Basic abc')).toBe(null);
    expect(parseBearer(null)).toBe(null);
  });
  it('parseAssetIdList dedupes and validates', () => {
    expect(parseAssetIdList([A1, A1.toUpperCase(), A2])).toEqual({ ok: true, ids: [A1, A2] });
    expect(parseAssetIdList(['x'])).toMatchObject({ ok: false });
    expect(parseAssetIdList(Array(51).fill(A1))).toMatchObject({ ok: false });
  });
});

describe('per-user asset cap (review M2)', () => {
  it('counts only <uuid>.json meta objects', () => {
    expect(countAssetMetas([{ name: `${A1}.json` }, { name: `${A1}.png` }, { name: `${A2}.json` }, { name: 'x.json' }, null, {}])).toBe(2);
    expect(countAssetMetas(null)).toBe(0);
  });
  it('refuses at the cap with 409 asset_limit_reached', () => {
    expect(MAX_ASSETS_PER_USER).toBe(200);
    expect(ASSET_LIST_PAGE).toBeGreaterThan(0);
    expect(checkAssetCap(199)).toEqual({ ok: true });
    expect(checkAssetCap(200)).toMatchObject({ ok: false, code: 'asset_limit_reached', status: 409 });
  });
});

describe('storage error classification (review L6)', () => {
  it('a missing object is "no record"', () => {
    expect(isStorageNotFound({ message: 'Object not found', status: 400 })).toBe(true);
    expect(isStorageNotFound({ statusCode: '404', error: 'not_found', message: 'Object not found' })).toBe(true);
    expect(isStorageNotFound({ status: 404, message: '' })).toBe(true);
  });
  it('a missing bucket or any other failure is NOT "no record"', () => {
    expect(isStorageNotFound({ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' })).toBe(false);
    expect(isStorageNotFound({ status: 404, message: 'Bucket not found' })).toBe(false);
    expect(isStorageNotFound({ status: 500, message: 'Internal Server Error' })).toBe(false);
    expect(isStorageNotFound({ status: 403, message: 'new row violates row-level security policy' })).toBe(false);
    expect(isStorageNotFound(null)).toBe(false);
  });
  it('conflict detection', () => {
    expect(isStorageConflict({ statusCode: '409', message: 'The resource already exists' })).toBe(true);
    expect(isStorageConflict({ status: 409 })).toBe(true);
    expect(isStorageConflict({ status: 400, message: 'Bucket not found' })).toBe(false);
    expect(isStorageConflict({ status: 500, message: 'boom' })).toBe(false);
  });
});
