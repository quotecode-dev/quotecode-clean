// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
  NO_PRESENTATION_BODY, capabilityForPurpose, decideCapabilityGate, parseUploadPurpose, presentationFromSnapshot,
} from './capabilityGate';
import { publicMediaView, resolvePublicPresentation } from './lib';

const A1 = '33333333-3333-4333-8333-333333333333';
const A2 = '44444444-4444-4444-8444-444444444444';
const src = () => readFileSync(join(cwd(), 'supabase/functions/quote-presentation/index.ts'), 'utf8');
const between = (s: string, a: string, b: string) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i)); };

describe('upload purpose', () => {
  it('missing purpose = quote_media (backward compatible); explicit values; anything else 400', () => {
    expect(parseUploadPurpose(undefined)).toEqual({ ok: true, purpose: 'quote_media' });
    expect(parseUploadPurpose(null)).toEqual({ ok: true, purpose: 'quote_media' });
    expect(parseUploadPurpose('catalog_product')).toEqual({ ok: true, purpose: 'catalog_product' });
    expect(parseUploadPurpose('logo')).toMatchObject({ ok: false, status: 400 });
    expect(capabilityForPurpose('catalog_product')).toBe('catalog_product_image.upload');
    expect(capabilityForPurpose('quote_media')).toBe('quote_media.upload');
  });
});

describe('server capability gate (capability_check answer only)', () => {
  const cap = 'catalog_product_image.upload' as const;
  it.each([
    ['RPC not deployed here -> today\'s behavior', { kind: 'not_deployed' }, { allow: true, source: 'not_deployed' }],
    ['system not active (source legacy) -> today\'s behavior', { kind: 'answer', data: { ok: true, allowed: true, source: 'legacy', reason: 'not_enforced' } }, { allow: true, source: 'legacy' }],
    ['legacy answer is never a denial', { kind: 'answer', data: { ok: true, allowed: false, source: 'legacy', reason: 'x' } }, { allow: true, source: 'legacy' }],
    ['server allowed', { kind: 'answer', data: { ok: true, allowed: true, source: 'server', reason: 'granted' } }, { allow: true, source: 'server' }],
  ])('%s', (_n, answer, want) => { expect(decideCapabilityGate(answer as never, cap)).toEqual(want); });
  it('server denial (Free: OD-18) -> exactly 403 {error:capability_not_included, capability}', () => {
    expect(decideCapabilityGate({ kind: 'answer', data: { ok: true, allowed: false, source: 'server', reason: 'free_not_eligible' } }, cap))
      .toEqual({ allow: false, status: 403, body: { error: 'capability_not_included', capability: 'catalog_product_image.upload' } });
    expect(decideCapabilityGate({ kind: 'answer', data: { ok: true, allowed: false, source: 'server', reason: 'not_included' } }, 'quote_media.upload'))
      .toEqual({ allow: false, status: 403, body: { error: 'capability_not_included', capability: 'quote_media.upload' } });
  });
  it.each([
    ['rpc error', { kind: 'error' }], ['ok false', { kind: 'answer', data: { ok: false } }], ['allowed not boolean', { kind: 'answer', data: { ok: true, allowed: 'yes', source: 'server' } }],
    ['unknown source', { kind: 'answer', data: { ok: true, allowed: true, source: 'client' } }], ['null', { kind: 'answer', data: null }],
  ])('%s -> 503 fail closed', (_n, answer) => {
    expect(decideCapabilityGate(answer as never, cap)).toMatchObject({ allow: false, status: 503 });
  });
  it('forged body fields (plan, tier, eligiblePlans, capabilities) cannot turn a server denial into an allow', () => {
    const forged = { action: 'upload_media', purpose: 'catalog_product', plan: 'visual', tier: 'visual', eligiblePlans: { 'catalog_product_image.upload': ['free'] },
      capabilities: ['catalog_product_image.upload'], allowed: true, source: 'legacy' };
    const purpose = parseUploadPurpose(forged.purpose);
    expect(purpose.ok).toBe(true);
    const deny = { kind: 'answer' as const, data: { ok: true, allowed: false, source: 'server', reason: 'free_not_eligible' } };
    expect(decideCapabilityGate(deny, capabilityForPurpose((purpose as { purpose: 'catalog_product' }).purpose))).toMatchObject({ allow: false, status: 403 });
    expect(decideCapabilityGate.length).toBe(2); // (server answer, capability) - no request body parameter exists
  });
});

describe('index.ts wiring: gate BEFORE any decode / Storage write; again right before the catalog link write; nothing written on denial', () => {
  it('upload_media: purpose + gate precede decode, detect, cap count, object upload and meta write', () => {
    const block = between(src(), "case 'upload_media': {", "case 'media_urls':");
    const gate = block.indexOf('capabilityGate(admin, uid, capabilityForPurpose(purpose.purpose))');
    expect(gate).toBeGreaterThan(-1);
    for (const later of ['decodeImageBase64(', 'detectImage(', 'countUserAssets(', '.upload(', 'writeJson(']) expect(block.indexOf(later)).toBeGreaterThan(gate);
    expect(block.indexOf('if (refused) return refused;')).toBeLessThan(block.indexOf('decodeImageBase64('));
  });
  it('catalog_link: prepare gate before any read; finalize gate immediately before the link write; unlink never gated', () => {
    const block = between(src(), "case 'catalog_link': {", "case 'qa_set_capability':");
    const first = block.indexOf("capabilityGate(admin, uid, 'catalog_product_image.upload'); // prepare");
    const second = block.indexOf("capabilityGate(admin, uid, 'catalog_product_image.upload'); // finalize");
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(block.indexOf('ownedAssetExts('));
    expect(first).toBeLessThan(block.indexOf('readJson('));
    expect(second).toBeGreaterThan(block.indexOf('planCatalogLink('));
    expect(block.indexOf('writeJson(admin, catalogPath(uid)')).toBeGreaterThan(second);
    expect(block).toContain('const linking = assetId !== null;');
  });
  it('no Task 16 / subscription path deletes a Storage object (unlink / replacement never deletes an asset an issued snapshot references)', () => {
    expect(src()).not.toMatch(/\.remove\(|\.delete\(|deleteObject|emptyBucket/);
    expect(readFileSync(join(cwd(), 'supabase/functions/quote-presentation/lib.ts'), 'utf8')).toMatch(/Unlink only: the asset object itself is immutable and is never deleted/);
  });
  it('public_get: capabilityToken mode and the enforced id rule use the shared decision; refusals answer "no presentation"', () => {
    const s = src();
    expect(s).toContain("hasOwnProperty.call(body, 'capabilityToken')");
    expect(s).toContain('decideLegacyIdAccess({ phase, isLegacy: legacyRes.data, callerUserId: caller');
    expect(s).toMatch(/if \(decision !== 'serve' \|\| !loaded\.q\) return noPresentation\(\);/);
    expect(s).toContain('if (decision.freeze && mayFreeze)');
  });
});

describe('"no presentation" answer = the existing no-record answer (refusal is indistinguishable from absence)', () => {
  it('equals what public_get returns today for a quote without a Task 16 record', () => {
    const d = resolvePublicPresentation({ issued: null, draft: null, quote: { status: 'Draft' }, tier: 'classic', defaultStyle: null });
    expect({ ...NO_PRESENTATION_BODY, media: [...NO_PRESENTATION_BODY.media] })
      .toEqual({ mode: d.mode, style: d.style, styleVersion: d.styleVersion, branding: d.branding, media: publicMediaView(d.media, {}) });
  });
});

describe('presentation from the immutable snapshot (capability mode)', () => {
  const snap = (media: unknown[], layout: unknown[]) => ({
    presentation: { presentationProjection: 'presentation/v1', style: 'modern', styleVersion: 1,
      branding: { layoutProjection: 'presentation-layout/v1', media: layout }, media },
    issuer: { issuerProjection: 'issuer/v1', business_name: 'Biz', logo_url: null, tax_id: null, email: null, phone: null, address: null, currency: 'ILS', country: 'Local' },
  });
  it('renders only layout entries whose asset is bound by hash in the snapshot; branding from the bound issuer', () => {
    const p = presentationFromSnapshot(snap([{ assetId: A1, sha256: '1'.repeat(64), bytes: 10 }],
      [{ assetId: A1, role: 'hero', itemKey: null, caption: 'c', alt: 'a', order: 0 }, { assetId: A2, role: 'support', itemKey: null, caption: 'x', alt: '', order: 1 }]));
    expect(p?.media.map((m) => m.assetId)).toEqual([A1]);
    expect(p?.branding.business_name).toBe('Biz');
  });
  it('wrong projection / unknown style / wrong style version -> null', () => {
    expect(presentationFromSnapshot({ presentation: { presentationProjection: 'x' } })).toBeNull();
    const s = snap([], []);
    expect(presentationFromSnapshot({ ...s, presentation: { ...s.presentation, style: 'neon' } })).toBeNull();
    expect(presentationFromSnapshot({ ...s, presentation: { ...s.presentation, styleVersion: 99 } })).toBeNull();
  });
});
