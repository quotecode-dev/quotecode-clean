// Subscription authority (PREPARED / OFF) - unit + contract tests with in-memory adapters. No network, no DB, no provider.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
  ACTIVATION_PHASE, userFromRequest, parseAccountSummary, sniffImage, importLogoAsset, importLogoRoute, sha256Hex,
} from './authority';
import { parseAccountSummary as sharedParse } from '../_shared/subscriptionContract';

const H = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
const U1 = '11111111-1111-4111-8111-111111111111';
const ATT = '22222222-2222-4222-8222-222222222222';
const fileSha = (rel: string) => createHash('sha256').update(readFileSync(join(cwd(), rel))).digest('hex');

describe('adoption of the closed PREP CONTRACT (no drift)', () => {
  it('authorizeOutput.ts is byte-identical to subscriptions-prep/server/authorizeQuoteOutput.ts', () => {
    expect(fileSha('supabase/functions/subscription-authority/authorizeOutput.ts')).toBe(fileSha('subscriptions-prep/server/authorizeQuoteOutput.ts'));
  });
  it('the byte-identity assertion is sensitive to a CRLF checkout drift', () => {
    const adopted = readFileSync(join(cwd(), 'supabase/functions/subscription-authority/authorizeOutput.ts'));
    const crlfDrift = Buffer.from(adopted.toString('utf8').replace(/\r?\n/g, '\r\n'), 'utf8');
    expect(createHash('sha256').update(crlfDrift).digest('hex')).not.toBe(createHash('sha256').update(adopted).digest('hex'));
  });
  it('the billing phase is the code constant "off" (not derived from an environment variable)', () => {
    expect(ACTIVATION_PHASE).toBe('off');
    const dir = 'supabase/functions/subscription-authority/';
    const pure = ['authority.ts', 'index.ts', 'router.ts', 'outputRoute.ts', 'billing.ts', 'adapters.ts', 'payplus.ts'].map((f) => readFileSync(join(cwd(), dir + f), 'utf8')).join('\n');
    expect(pure).not.toMatch(/Deno\.env|process\.env|VITE_PROFLOW_ENV|import\.meta\.env/);
  });
  // Owner night task 2026-10-21: the PayPlus provider comes from the named Function secrets; phase, market, plan and price never do
  it('wiring.ts is the only env reader: SUPABASE_URL / SUPABASE_SECRET_KEYS + the named PayPlus secrets (no phase / market / price from env)', () => {
    const w = readFileSync(join(cwd(), 'supabase/functions/subscription-authority/wiring.ts'), 'utf8');
    // Owner 2026-10-24 (Codex spec PAY-01 / PAY-02): + the relay secret; every outgoing PayPlus call through the REQUIRED relay
    expect(w).toMatch(/ALLOWED_ENV = Object\.freeze\(\['SUPABASE_URL', 'SUPABASE_SECRET_KEYS', 'PAYPLUS_PROXY_URL', \.\.\.PAYPLUS_SECRET_NAMES\]\)/);
    expect([...w.matchAll(/env\('([A-Z_]+)'\)/g)].map((m) => m[1]).sort()).toEqual(['PAYPLUS_PROXY_URL', 'SUPABASE_SECRET_KEYS', 'SUPABASE_URL']);
    expect(w).toMatch(/const payplusFetch = requiredPayplusEgress\(env\('PAYPLUS_PROXY_URL'\)\)\.fetch;/);
    expect(w).toMatch(/billing: \{ phase: ACTIVATION_PHASE, sql: billingSql, now: \(\) => Date\.now\(\),\n {6}provider: payplusProviderFromSecrets\(\(n\) => env\(n\), url, payplusFetch, \(\) => Date\.now\(\)\) \?\? UNAVAILABLE_PROVIDER \}/);
    expect(w).not.toMatch(/\(u, init\) => fetch\(u, init\)/); // no direct PayPlus fetch left
  });
});

describe('authenticate: the user id comes only from the verified JWT', () => {
  const verify = vi.fn(async (t: string) => (t === 'good.token.x' ? { sub: U1 } : t === 'other.token.x' ? { sub: 'not-a-uuid' } : null));
  it.each([
    ['no header', {}, null], ['not bearer', { authorization: 'Basic abc' }, null], ['invalid token', { authorization: 'Bearer bad.token.x' }, null],
    ['sub not a uuid', { authorization: 'Bearer other.token.x' }, null], ['valid', { authorization: 'Bearer good.token.x' }, U1],
  ])('%s', async (_n, headers, want) => { expect(await userFromRequest(H(headers as Record<string, string>), verify)).toBe(want); });
});

describe('account summary: ONE parser (the shared contract) and NOT a function route', () => {
  it('authority.ts re-exports the shared parseAccountSummary (no second parser)', () => {
    expect(parseAccountSummary).toBe(sharedParse);
    const src = readFileSync(join(cwd(), 'supabase/functions/subscription-authority/authority.ts'), 'utf8');
    expect(src).not.toMatch(/function parseAccountSummary|accountSummaryHandler/);
  });
  it('the shared parser fails closed on an inconsistent Free-10 balance and on legacy plan ids', () => {
    expect(parseAccountSummary({ ok: false, code: 'not_activated' })).toEqual({ state: 'not_activated', code: 'not_activated' });
    expect(parseAccountSummary({ accountMode: 'free', planId: 'free10' }).state).toBe('invalid');
    expect(parseAccountSummary({ ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'off' }, market: 'IL',
      plan: { id: 'pro' }, subscriptionStatus: 'none', capabilities: [], eligiblePlans: {}, free10: null, catalog: { active: 0, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false }, priceCatalogVersion: null }).state).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------------------------- immutable logo (spec Phase 3)
const png = (w: number, h: number) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b; };
const jpeg = (w: number, h: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0, 0, 0, 0, 0, 0]);
const webpX = (w: number, h: number) => { const b = new Uint8Array(32); b.set([...new TextEncoder().encode('RIFF'), 24, 0, 0, 0, ...new TextEncoder().encode('WEBPVP8X'), 10, 0, 0, 0, 0, 0, 0, 0]); b[24] = (w - 1) & 255; b[25] = ((w - 1) >> 8) & 255; b[26] = 0; b[27] = (h - 1) & 255; b[28] = ((h - 1) >> 8) & 255; b[29] = 0; return b; };

describe('image sniffing from bytes (never a declared MIME / file name)', () => {
  it.each([[png(120, 40), 'image/png'], [jpeg(300, 100), 'image/jpeg'], [webpX(64, 32), 'image/webp']])('%#: detects type and dimensions', (bytes, mime) => {
    const i = sniffImage(bytes as Uint8Array);
    expect(i?.mime).toBe(mime);
    expect([i?.width, i?.height]).toEqual(mime === 'image/png' ? [120, 40] : mime === 'image/jpeg' ? [300, 100] : [64, 32]);
  });
  it.each([['svg', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')], ['html', new TextEncoder().encode('<html>')], ['empty', new Uint8Array()], ['truncated png', png(1, 1).subarray(0, 10)]])('%s is rejected', (_n, b) => {
    expect(sniffImage(b as Uint8Array)).toBeNull();
  });
});

describe('importLogoAsset: immutable identity, create-only write, read-back, no URL fetch', () => {
  const limits = { maxBytes: 1_000_000, maxDimension: 4096 };
  const mk = (stored: Map<string, Uint8Array>) => {
    const sql = {
      reserveLogo: vi.fn(async (a: Record<string, unknown>) => ({ ok: true, assetId: ATT, objectPath: `account-assets/${a.ownerId}/${ATT}.png` })),
      finalizeLogo: vi.fn(async (a: Record<string, unknown>) => ({ ok: true, assetId: a.assetId, sha256: a.sha256, bytes: a.bytes })),
    };
    const storage = {
      putNew: vi.fn(async (p: string, b: Uint8Array) => { if (stored.has(p)) return 'exists' as const; stored.set(p, b); return 'created' as const; }),
      read: vi.fn(async (p: string) => stored.get(p) ?? null),
    };
    return { sql, storage };
  };
  it('reserves with SERVER-computed sha256 / bytes / MIME / dimensions, writes create-only, reads back, finalizes', async () => {
    const d = mk(new Map()); const bytes = png(120, 40);
    const r = await importLogoAsset(d, U1, bytes, limits);
    expect(r.status).toBe(200);
    const sha = await sha256Hex(bytes);
    expect(d.sql.reserveLogo).toHaveBeenCalledWith({ ownerId: U1, mime: 'image/png', sha256: sha, bytes: bytes.length, width: 120, height: 40 });
    expect(d.sql.finalizeLogo).toHaveBeenCalledWith({ ownerId: U1, assetId: ATT, sha256: sha, bytes: bytes.length });
    expect(r.body).toMatchObject({ ok: true, sha256: sha, mime: 'image/png', created: true });
  });
  it('NEGATIVE CONTROL: other bytes already at the same path are never bound (no silent overwrite)', async () => {
    const stored = new Map([[`account-assets/${U1}/${ATT}.png`, png(999, 999)]]);
    const d = mk(stored);
    expect(await importLogoAsset(d, U1, png(120, 40), limits)).toEqual({ status: 409, body: { ok: false, code: 'asset_not_immutable' } });
    expect(d.sql.finalizeLogo).not.toHaveBeenCalled();
    expect(stored.get(`account-assets/${U1}/${ATT}.png`)).toEqual(png(999, 999)); // the existing object is untouched
  });
  it('a read-back that differs from the uploaded bytes is refused', async () => {
    const d = mk(new Map()); d.storage.read.mockResolvedValueOnce(png(121, 40));
    expect((await importLogoAsset(d, U1, png(120, 40), limits)).body.code).toBe('asset_not_immutable');
    expect(d.sql.finalizeLogo).not.toHaveBeenCalled();
  });
  it.each([['SVG', new TextEncoder().encode('<svg/>')], ['over the byte bound', png(10, 10)], ['over the dimension bound', png(5000, 10)]])('%s is refused before any reservation', async (n, b) => {
    const d = mk(new Map());
    const r = await importLogoAsset(d, U1, b as Uint8Array, n === 'over the byte bound' ? { maxBytes: 10, maxDimension: 4096 } : limits);
    expect(r.body.code).toBe('invalid_asset');
    expect(d.sql.reserveLogo).not.toHaveBeenCalled();
  });
  it('read-back with the right bytes length but another MIME / dimensions is refused (no silent rebinding)', async () => {
    const d = mk(new Map()); const b = png(120, 40); const other = png(40, 120);
    d.storage.read.mockResolvedValueOnce(other);
    expect((await importLogoAsset(d, U1, b, limits)).body.code).toBe('asset_not_immutable');
    expect(d.sql.finalizeLogo).not.toHaveBeenCalled();
  });
  it('a reservation path that is not the versioned account-assets/<owner>/<asset>.<ext> path is refused before any write', async () => {
    const d = mk(new Map()); d.sql.reserveLogo.mockResolvedValueOnce({ ok: true, assetId: ATT, objectPath: `account-assets/${U1}/logo.png` });
    expect((await importLogoAsset(d, U1, png(10, 10), limits)).body.code).toBe('asset_unavailable');
    expect(d.storage.putNew).not.toHaveBeenCalled();
  });
  it('a Storage / SQL outage keeps the current logo: no finalize, nothing deleted (there is no delete in the deps)', async () => {
    const d = mk(new Map()); d.storage.putNew.mockRejectedValueOnce(new Error('down'));
    expect(await importLogoAsset(d, U1, png(10, 10), limits)).toEqual({ status: 503, body: { ok: false, code: 'asset_unavailable' } });
    expect(d.sql.finalizeLogo).not.toHaveBeenCalled();
    expect(Object.keys(d.storage)).toEqual(['putNew', 'read']);
  });
  it('finalize answering another asset / mime is refused', async () => {
    const d = mk(new Map()); d.sql.finalizeLogo.mockImplementationOnce(async (a: Record<string, unknown>) => ({ ok: true, assetId: U1, sha256: a.sha256, bytes: a.bytes }));
    expect((await importLogoAsset(d, U1, png(10, 10), limits)).status).toBe(409);
  });
  it('import_logo route: phase-gated (shadow / enforced), body dataBase64 only, decoder bound', async () => {
    const d = mk(new Map());
    const route = (phase: string, decodeOk = true) => importLogoRoute({ readFreeIssuePhase: async () => phase, sql: d.sql, storage: d.storage,
      decode: () => (decodeOk ? { ok: true, bytes: png(64, 64) } : { ok: false }), limits }, U1, { dataBase64: 'x', url: 'https://evil.example/logo.png' });
    expect(await route('absent')).toEqual({ status: 409, body: { ok: false, code: 'not_activated' } });
    expect(await route('prepared')).toEqual({ status: 409, body: { ok: false, code: 'not_activated' } });
    expect((await route('error')).status).toBe(503);
    expect(d.sql.reserveLogo).not.toHaveBeenCalled();
    expect((await route('shadow', false)).body.code).toBe('invalid_asset');
    expect((await route('enforced')).status).toBe(200);
  });
  it('limits are required from the caller (no invented default quota) and there is no URL input at all', async () => {
    expect((await importLogoAsset(mk(new Map()), U1, png(1, 1), undefined as never)).body.code).toBe('invalid_request');
    expect(importLogoAsset.length).toBe(4);
  });
});
