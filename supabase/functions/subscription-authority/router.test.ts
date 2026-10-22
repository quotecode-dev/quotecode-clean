// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { routeAuthorityRequest, type AuthorityDeps } from './router';
import { UNAVAILABLE_PROVIDER } from './billing';
import { marketInputsReader, storageMediaAssetSource, storagePresentationSource, type BucketApi } from './adapters';

const U = '11111111-1111-4111-8111-111111111111';
const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
const H = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

function deps() {
  const output = vi.fn(async () => ({ status: 409, body: { ok: false, code: 'not_activated' } }));
  const d: AuthorityDeps = {
    verifyJwt: vi.fn(async (t: string) => (t === 'good.jwt.x' ? { sub: U } : null)),
    notice: { outputNotice: vi.fn(async () => ({ ok: false, code: 'not_activated' })) },
    output: { readFreeIssuePhase: async () => 'prepared', readMarketInputs: async () => ({ accountMarket: 'IL', businessCountry: 'Local' }),
      orchestrator: { output }, mintCapability: vi.fn(), issueGrant: vi.fn() },
    billing: { phase: 'off', sql: { createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(), recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn() }, provider: UNAVAILABLE_PROVIDER, now: () => 0 },
    logo: { readFreeIssuePhase: async () => 'prepared', sql: { reserveLogo: vi.fn(), finalizeLogo: vi.fn() }, storage: { putNew: vi.fn(), read: vi.fn() }, decode: () => ({ ok: false }), limits: { maxBytes: 10, maxDimension: 10 } },
  };
  return { d, output };
}
const req = (body: unknown, headers: Record<string, string> = { authorization: 'Bearer good.jwt.x' }, path = '/functions/v1/subscription-authority') =>
  ({ method: 'POST', path, headers: H(headers), rawBody: enc(body) });

describe('router', () => {
  it('a user action requires a verified JWT; the body never names the account', async () => {
    const { d } = deps();
    expect(await routeAuthorityRequest(d, req({ action: 'authorize_output' }, {}))).toEqual({ status: 401, body: { ok: false, code: 'not_authenticated' } });
    expect(await routeAuthorityRequest(d, req({ action: 'authorize_output', userId: U }, { authorization: 'Bearer bad.jwt.x' }))).toEqual({ status: 401, body: { ok: false, code: 'not_authenticated' } });
  });
  it('authorize_output -> phase not enforced -> not_activated (no orchestrator call)', async () => {
    const { d, output } = deps();
    const r = await routeAuthorityRequest(d, req({ action: 'authorize_output', quoteId: '22222222-2222-4222-8222-222222222222', channel: 'send', idempotencyKey: 'key-00000001', expectedDigest: 'd'.repeat(64) }));
    expect(r).toEqual({ status: 409, body: { ok: false, code: 'not_activated' } });
    expect(output).not.toHaveBeenCalled();
  });
  it('account_summary is not a route (the client calls the RPC get_account_summary)', async () => {
    const { d } = deps();
    expect(await routeAuthorityRequest(d, req({ action: 'account_summary' }))).toEqual({ status: 400, body: { ok: false, code: 'unknown_action' } });
    expect(await routeAuthorityRequest(d, req({}, undefined, '/functions/v1/subscription-authority/account-summary'))).toEqual({ status: 404, body: { ok: false, code: 'unknown_route' } });
  });
  it('checkout_intent and provider-event stay unavailable at the billing code phase "off"', async () => {
    const { d } = deps();
    expect(await routeAuthorityRequest(d, req({ action: 'checkout_intent', planId: 'classic', idempotencyKey: 'k'.repeat(20), amountMinor: 1 }))).toEqual({ status: 503, body: { ok: false, code: 'checkout_unavailable' } });
    expect(await routeAuthorityRequest(d, req({ id: 'e1' }, {}, '/functions/v1/subscription-authority/provider-event'))).toEqual({ status: 503, body: { ok: false, code: 'billing_off' } });
    expect(d.billing.sql.createCheckoutIntent).not.toHaveBeenCalled();
  });
  it('import_logo while not activated -> not_activated, nothing reserved', async () => {
    const { d } = deps();
    expect(await routeAuthorityRequest(d, req({ action: 'import_logo', dataBase64: 'AAAA' }))).toEqual({ status: 409, body: { ok: false, code: 'not_activated' } });
    expect(d.logo.sql.reserveLogo).not.toHaveBeenCalled();
  });
  it('non-POST, oversize and non-JSON bodies are refused', async () => {
    const { d } = deps();
    expect((await routeAuthorityRequest(d, { ...req({}), method: 'GET' })).status).toBe(405);
    expect((await routeAuthorityRequest(d, { ...req({}), rawBody: new Uint8Array(6 * 1024 * 1024 + 1) })).status).toBe(413);
    expect((await routeAuthorityRequest(d, { ...req({}), rawBody: new TextEncoder().encode('{') })).status).toBe(400);
  });
});

describe('adapters: presentation intent from the owner draft + owned asset metas', () => {
  const OWN = U; const Q = '22222222-2222-4222-8222-222222222222'; const A1 = '33333333-3333-4333-8333-333333333333'; const A2 = '44444444-4444-4444-8444-444444444444';
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const sha = createHash('sha256').update(bytes).digest('hex');
  const files = new Map<string, Uint8Array>([
    [`t16-presentation/${OWN}/quotes/${Q}/draft.json`, enc({ v: 1, style: 'modern', media: [
      { assetId: A1, caption: 'c', alt: 'a', role: 'hero', itemKey: null, order: 0 }, { assetId: A2, caption: '', alt: '', role: 'support', itemKey: null, order: 1 }] })],
    [`t16-presentation/${OWN}/assets/${A1}.json`, enc({ id: A1, mime: 'image/png', bytes: 4, width: 64, height: 64, sha256: sha })],
    [`t16-presentation/${OWN}/assets/${A1}.png`, bytes],
  ]);
  const bucket: BucketApi = {
    upload: vi.fn(), remove: vi.fn(),
    download: async (p) => (files.has(p) ? { data: { arrayBuffer: async () => files.get(p)!.slice().buffer }, error: null } : { data: null, error: { status: 404, message: 'Object not found' } }),
  };
  it('binds style, version, layout and per-asset hash/bytes; a missing meta becomes an unverifiable ref (media_verification_failed later)', async () => {
    const intent = await storagePresentationSource(bucket).load(OWN, Q);
    expect(intent.style).toBe('modern');
    expect(intent.media).toEqual([{ assetId: A1, sha256: sha, bytes: 4 }, { assetId: A2, sha256: '0'.repeat(64), bytes: 1 }]);
    expect((intent.branding as { media: unknown[] }).media).toHaveLength(2);
    expect(await storageMediaAssetSource(bucket).read(OWN, A1)).toEqual(bytes);
    expect(await storageMediaAssetSource(bucket).read(OWN, A2)).toBeNull();
    expect(await storageMediaAssetSource(bucket).read('99999999-9999-4999-8999-999999999999', A1)).toBeNull(); // another owner's prefix
  });
  it('no draft -> classic, no media', async () => {
    const intent = await storagePresentationSource(bucket).load(OWN, A2);
    expect(intent).toMatchObject({ style: 'classic', media: [] });
  });
  it('market reader: missing account_market table reads as "no row"; any other error fails closed', async () => {
    const ok = marketInputsReader({ one: async (t) => (t === 'account_market'
      ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.account_market' in the schema cache" } }
      : { data: { country: 'Local' }, error: null }) });
    expect(await ok(U)).toEqual({ accountMarket: undefined, businessCountry: 'Local' });
    const bad = marketInputsReader({ one: async (t) => (t === 'account_market' ? { data: null, error: { code: '500', message: 'boom' } } : { data: { country: 'Local' }, error: null }) });
    await expect(bad(U)).rejects.toThrow();
  });
});
