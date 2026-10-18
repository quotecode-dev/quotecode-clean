// @vitest-environment node
// Provider-neutral billing on mocks only: no provider, sandbox, network or DB. The mock SQL implements the documented §2.4
// semantics through the reference state graph (applySubscriptionEvent); the real SQL is proven by stream A's DB tests.
import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  applySubscriptionEvent, checkoutIntentHandler, computeCheckoutAmount, createHmacWebhookVerifier, INITIAL_SUB_STATE, parseCatalog,
  parseProviderEvent, providerWebhookHandler, reconcileSubscriptions, UNAVAILABLE_PROVIDER, type BillingProvider, type BillingSql,
  type ProviderEvent, type SubState,
} from './billing';

const U = '11111111-1111-4111-8111-111111111111';
const ATT = '22222222-2222-4222-8222-222222222222';
const KEY = 'k'.repeat(20);
// the Owner-locked catalog (OD-03/04/06/07) exactly as the billing SQL seeds it
const IL = { ok: true, market: 'IL', prices: [
  { priceId: 'il_catalog_block_month_v1', planId: 'catalog_block_100', currency: 'ILS', billingPeriod: 'month', amountMinor: 500, taxMode: 'included' },
  { priceId: 'il_classic_month_v1', planId: 'classic', currency: 'ILS', billingPeriod: 'month', amountMinor: 2900, taxMode: 'included' },
  { priceId: 'il_modern_month_v1', planId: 'modern', currency: 'ILS', billingPeriod: 'month', amountMinor: 4900, taxMode: 'included' },
  { priceId: 'il_visual_month_v1', planId: 'visual', currency: 'ILS', billingPeriod: 'month', amountMinor: 6900, taxMode: 'included' }] };
const INTL = { ok: true, market: 'INTERNATIONAL', prices: [
  { priceId: 'intl_catalog_block_month_v1', planId: 'catalog_block_100', currency: 'USD', billingPeriod: 'month', amountMinor: 300, taxMode: 'not_decided' },
  { priceId: 'intl_classic_month_v1', planId: 'classic', currency: 'USD', billingPeriod: 'month', amountMinor: 1800, taxMode: 'not_decided' },
  { priceId: 'intl_modern_month_v1', planId: 'modern', currency: 'USD', billingPeriod: 'month', amountMinor: 2800, taxMode: 'not_decided' },
  { priceId: 'intl_visual_month_v1', planId: 'visual', currency: 'USD', billingPeriod: 'month', amountMinor: 3800, taxMode: 'not_decided' }] };

describe('server price catalog arithmetic (+100 block)', () => {
  it('INTERNATIONAL +100 = 300 USD minor (never 600); IL +100 = 500 ILS minor; no VAT added', () => {
    const intl = parseCatalog(INTL, 'INTERNATIONAL');
    const il = parseCatalog(IL, 'IL');
    expect(computeCheckoutAmount(intl, 'classic', 1)).toEqual({ currency: 'USD', amountMinor: 2100, planPriceId: 'intl_classic_month_v1', blockPriceId: 'intl_catalog_block_month_v1' });
    expect(computeCheckoutAmount(intl, 'classic', 1)!.amountMinor - computeCheckoutAmount(intl, 'classic', 0)!.amountMinor).toBe(300);
    expect(computeCheckoutAmount(intl, 'visual', 2)!.amountMinor).toBe(3800 + 600);
    expect(computeCheckoutAmount(il, 'modern', 1)).toMatchObject({ currency: 'ILS', amountMinor: 5400 });
    expect(computeCheckoutAmount(il, 'classic', 0)).toMatchObject({ currency: 'ILS', amountMinor: 2900 });
  });
  it('a regression to a 6 USD block, a foreign-currency row or an unknown plan fails closed', () => {
    const bad = { ...INTL, prices: INTL.prices.map((p) => (p.planId === 'catalog_block_100' ? { ...p, currency: 'ILS' } : p)) };
    expect(parseCatalog(bad, 'INTERNATIONAL')).toBeNull();
    expect(parseCatalog(IL, 'INTERNATIONAL')).toBeNull();
    expect(computeCheckoutAmount(parseCatalog(INTL, 'INTERNATIONAL'), 'pro', 0)).toBeNull();
    expect(computeCheckoutAmount(parseCatalog(INTL, 'INTERNATIONAL'), 'classic', -1)).toBeNull();
    expect(computeCheckoutAmount(parseCatalog(INTL, 'INTERNATIONAL'), 'classic', 1.5)).toBeNull();
  });
});

function sqlFor(market: 'IL' | 'INTERNATIONAL', sqlAmount?: number): BillingSql & Record<string, ReturnType<typeof vi.fn>> {
  const cat = market === 'IL' ? IL : INTL;
  return {
    createCheckoutIntent: vi.fn(async (_u: string, planId: string, blocks: number) => {
      const amt = computeCheckoutAmount(parseCatalog(cat, market), planId, blocks);
      return { ok: true, attemptId: ATT, market, currency: amt!.currency, amountMinor: sqlAmount ?? amt!.amountMinor, state: 'pending' };
    }),
    priceCatalog: vi.fn(async () => cat),
    recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
  } as never;
}
const okProvider = (): BillingProvider & { createCheckout: ReturnType<typeof vi.fn> } => ({ name: 'mock',
  createCheckout: vi.fn(async () => ({ redirectUrl: 'https://provider.example/pay/abc' })), verifyWebhook: vi.fn() } as never);

describe('checkout intent: server market + server catalog amount; redirect is not an entitlement', () => {
  it('phase off (the code constant today): refused before any SQL or provider call', async () => {
    const sql = sqlFor('IL'); const provider = okProvider();
    expect(await checkoutIntentHandler('off', { sql, provider }, U, { planId: 'visual', idempotencyKey: KEY })).toEqual({ status: 503, body: { ok: false, code: 'checkout_unavailable' } });
    expect(sql.createCheckoutIntent).not.toHaveBeenCalled(); expect(provider.createCheckout).not.toHaveBeenCalled();
  });
  it('tampered amount / currency / rate / market / account id in the body are ignored', async () => {
    const sql = sqlFor('INTERNATIONAL'); const provider = okProvider();
    const r = await checkoutIntentHandler('prepared', { sql, provider }, U, { planId: 'classic', blocks: 1, idempotencyKey: KEY,
      amountMinor: 1, currency: 'ILS', rate: 3.7, market: 'IL', userId: '00000000-0000-4000-8000-000000000000', displayCurrency: 'EUR' });
    expect(sql.createCheckoutIntent).toHaveBeenCalledWith(U, 'classic', 1, KEY);
    expect(provider.createCheckout).toHaveBeenCalledWith({ attemptId: ATT, currency: 'USD', amountMinor: 2100 });
    expect(r).toEqual({ status: 200, body: { ok: true, attemptId: ATT, currency: 'USD', amountMinor: 2100, redirectUrl: 'https://provider.example/pay/abc', state: 'pending' } });
  });
  it('IL checkout charges exactly the VAT-inclusive catalog amount (5400 for Modern + 1 block)', async () => {
    const provider = okProvider();
    await checkoutIntentHandler('prepared', { sql: sqlFor('IL'), provider }, U, { planId: 'modern', blocks: 1, idempotencyKey: KEY });
    expect(provider.createCheckout).toHaveBeenCalledWith({ attemptId: ATT, currency: 'ILS', amountMinor: 5400 });
  });
  it('a SQL amount that drifts from the server catalog (e.g. a 600 block) is refused, provider never called', async () => {
    const provider = okProvider();
    expect(await checkoutIntentHandler('prepared', { sql: sqlFor('INTERNATIONAL', 2400), provider }, U, { planId: 'classic', blocks: 1, idempotencyKey: KEY }))
      .toEqual({ status: 503, body: { ok: false, code: 'checkout_unavailable' } });
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });
  it('UNAVAILABLE_PROVIDER (OPEN-12) is the default: checkout unavailable, webhooks refused', async () => {
    expect(await checkoutIntentHandler('prepared', { sql: sqlFor('IL'), provider: UNAVAILABLE_PROVIDER }, U, { planId: 'classic', idempotencyKey: KEY }))
      .toEqual({ status: 503, body: { ok: false, code: 'checkout_unavailable' } });
    expect(await UNAVAILABLE_PROVIDER.verifyWebhook(new Uint8Array([1]), { get: () => null }, 0)).toEqual({ ok: false, reason: 'provider_unavailable' });
  });
  it.each([
    [{ ok: false, code: 'account_unprovisioned' }, 409, 'account_unprovisioned'], [{ ok: false, code: 'idempotency_conflict' }, 409, 'idempotency_conflict'],
    [{ ok: false, code: 'internal_detail_leak' }, 503, 'checkout_unavailable'], [{ ok: true, attemptId: 'x', market: 'IL', currency: 'ILS', amountMinor: 1 }, 503, 'checkout_unavailable'],
    [{ ok: true, attemptId: ATT, market: 'IL', currency: 'EUR', amountMinor: 2900 }, 503, 'checkout_unavailable'],
  ])('SQL answer %j -> %s %s', async (answer, status, code) => {
    const sql = { ...sqlFor('IL'), createCheckoutIntent: async () => answer };
    expect(await checkoutIntentHandler('prepared', { sql, provider: okProvider() }, U, { planId: 'classic', idempotencyKey: KEY })).toEqual({ status, body: { ok: false, code } });
  });
});

// ---------------------------------------------------------------------------------------------------------------- webhooks
const SECRET = new TextEncoder().encode('test-secret-not-a-real-key-0123456789');
const NOW = Date.parse('2026-10-07T12:00:00Z');
const verifier = createHmacWebhookVerifier({ secret: SECRET, signatureHeader: 'x-signature', timestampHeader: 'x-timestamp', toleranceSeconds: 300,
  sourceHeader: 'user-agent', allowedSources: ['MockPay-Webhook/1'], encoding: 'hex' });
const provider: BillingProvider = { name: 'mock', createCheckout: async () => null, verifyWebhook: verifier };
function signed(payload: Record<string, unknown>, o: { ts?: number; secret?: Uint8Array; source?: string; tamper?: boolean } = {}) {
  const raw = Buffer.from(JSON.stringify(payload));
  const ts = String(Math.floor((o.ts ?? NOW) / 1000));
  const sig = createHmac('sha256', Buffer.from(o.secret ?? SECRET)).update(`${ts}.`).update(raw).digest('hex');
  const body = o.tamper ? Buffer.from(JSON.stringify({ ...payload, type: 'renewed' })) : raw;
  const h: Record<string, string> = { 'x-signature': sig, 'x-timestamp': ts, 'user-agent': o.source ?? 'MockPay-Webhook/1' };
  return { raw: new Uint8Array(body), headers: { get: (k: string) => h[k.toLowerCase()] ?? null } };
}
const ev = (id: string, type: string, at: string, extra: Record<string, unknown> = {}) => ({ id, type, occurredAt: at, attemptId: ATT, ...extra });

/** in-memory SQL following §2.4 via the reference graph + idempotent line events */
function eventSql() {
  let sub: SubState = INITIAL_SUB_STATE;
  const lines = new Map<string, { quantity: number; unitAmountMinor: number; currency: string }>();
  const priceOf: Record<string, { amountMinor: number; currency: string }> = {
    intl_catalog_block_month_v1: { amountMinor: 300, currency: 'USD' }, il_catalog_block_month_v1: { amountMinor: 500, currency: 'ILS' } };
  const failNext = { n: 0 };
  const sql = {
    createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(),
    recordVerifiedEvent: vi.fn(async (e: { providerEventId: string; eventType: string; providerEventTime: string }) => {
      if (failNext.n > 0) { failNext.n--; throw new Error('statement timeout'); }
      const r = applySubscriptionEvent(sub, { providerEventId: e.providerEventId, type: e.eventType as never, occurredAt: e.providerEventTime });
      sub = r.state;
      return r.outcome === 'duplicate' ? { ok: true, duplicate: true } : { ok: true, duplicate: false, outcome: r.outcome };
    }),
    applyVerifiedLineEvent: vi.fn(async (e: { providerEventId: string; quantity: number; priceVersionId: string }) => {
      if (lines.has(e.providerEventId)) return { ok: true, duplicate: true };
      const p = priceOf[e.priceVersionId];
      lines.set(e.providerEventId, { quantity: e.quantity, unitAmountMinor: p.amountMinor, currency: p.currency }); // price snapshot from the server table
      return { ok: true, duplicate: false, outcome: 'applied' };
    }),
  };
  return { sql: sql as unknown as BillingSql & typeof sql, get sub() { return sub; }, lines, failNext };
}
const hook = (s: ReturnType<typeof eventSql>, m: ReturnType<typeof signed>) => providerWebhookHandler('prepared', { sql: s.sql, provider, now: () => NOW }, m.raw, m.headers);

describe('webhook verification: signature + timestamp window + source, BEFORE anything is stored', () => {
  it.each([
    ['forged signature (other secret)', signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z'), { secret: new TextEncoder().encode('another-secret-0123456789abcdef') }), 401, 'invalid_signature'],
    ['tampered body', signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z'), { tamper: true }), 401, 'invalid_signature'],
    ['stale timestamp (10 minutes old)', signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z'), { ts: NOW - 600_000 }), 401, 'stale_timestamp'],
    ['future timestamp', signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z'), { ts: NOW + 600_000 }), 401, 'stale_timestamp'],
    ['untrusted source', signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z'), { source: 'curl/8' }), 401, 'untrusted_source'],
    ['unknown event type (grant_pro)', signed(ev('e1', 'grant_pro', '2026-10-07T11:00:00Z')), 400, 'invalid_event'],
  ])('%s -> %s %s, nothing stored', async (_n, msg, status, code) => {
    const s = eventSql();
    expect(await hook(s, msg)).toEqual({ status, body: { ok: false, code } });
    expect(s.sql.recordVerifiedEvent).not.toHaveBeenCalled();
    expect(s.sql.applyVerifiedLineEvent).not.toHaveBeenCalled();
  });
  it('billing phase off (the code constant today): refused before verification', async () => {
    const s = eventSql();
    expect((await providerWebhookHandler('off', { sql: s.sql, provider, now: () => NOW }, signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z')).raw, { get: () => null })).body.code).toBe('billing_off');
  });
  it('the event parser ignores amount / currency / rate / plan fields entirely', () => {
    expect(parseProviderEvent({ ...ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z'), amountMinor: 1, currency: 'ILS', rate: 9, plan: 'visual' }))
      .toEqual({ providerEventId: 'e1', type: 'payment_confirmed', occurredAt: '2026-10-07T11:00:00Z', attemptId: ATT, userId: null, line: null });
  });
});

describe('verified events: idempotent, monotonic, renewal failure / recovery', () => {
  it('duplicate delivery -> one transition; payload sha256 recorded from the RAW body', async () => {
    const s = eventSql();
    const m = signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z'));
    expect((await hook(s, m)).body).toEqual({ ok: true, duplicate: false, outcome: 'applied' });
    expect((await hook(s, m)).body).toEqual({ ok: true, duplicate: true });
    expect(s.sub).toMatchObject({ status: 'active', periods: 1 });
    expect(s.sql.recordVerifiedEvent.mock.calls[0][0]).toMatchObject({ provider: 'mock', providerEventId: 'e1', attemptId: ATT, payloadSha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });
  it('out-of-order (older event after a newer one) -> stale, state unchanged', async () => {
    const s = eventSql();
    await hook(s, signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z')));
    await hook(s, signed(ev('e3', 'renewal_failed', '2026-11-07T11:00:00Z')));
    expect((await hook(s, signed(ev('e2', 'renewed', '2026-11-01T11:00:00Z')))).body).toEqual({ ok: true, duplicate: false, outcome: 'stale' });
    expect(s.sub).toMatchObject({ status: 'past_due', periods: 1 });
  });
  it('renewal failure -> past_due WITHOUT a new period; only a verified success returns to active', async () => {
    const s = eventSql();
    await hook(s, signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z')));
    await hook(s, signed(ev('e2', 'renewal_failed', '2026-11-07T11:00:00Z')));
    expect(s.sub).toMatchObject({ status: 'past_due', periods: 1 });
    // a forged "success" is refused at verification and changes nothing
    await hook(s, signed(ev('e3', 'payment_succeeded', '2026-11-08T11:00:00Z'), { secret: new TextEncoder().encode('forged-secret-0123456789abcdef!!') }));
    expect(s.sub).toMatchObject({ status: 'past_due', periods: 1 });
    await hook(s, signed(ev('e4', 'payment_succeeded', '2026-11-09T11:00:00Z')));
    expect(s.sub).toMatchObject({ status: 'active', periods: 2 });
  });
  it('timeout / retry: a SQL timeout answers 503 retry_later (nothing applied); the provider retry applies exactly once', async () => {
    const s = eventSql(); s.failNext.n = 1;
    const m = signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z'));
    expect(await hook(s, m)).toEqual({ status: 503, body: { ok: false, code: 'retry_later' } });
    expect(s.sub.status).toBe('pending');
    expect((await hook(s, m)).body).toMatchObject({ ok: true, duplicate: false, outcome: 'applied' });
    expect((await hook(s, m)).body).toEqual({ ok: true, duplicate: true });
    expect(s.sub.periods).toBe(1);
  });
  it('cancellation / refund stay policy_pending (OPEN-09): no state invented', async () => {
    const s = eventSql();
    await hook(s, signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z')));
    expect((await hook(s, signed(ev('e2', 'refund', '2026-10-08T11:00:00Z')))).body).toMatchObject({ outcome: 'policy_pending' });
    expect(s.sub.status).toBe('active');
  });
});

describe('add-on line events (apply_verified_line_event)', () => {
  const line = (id: string, priceVersionId: string, extra: Record<string, unknown> = {}) => ({ id, type: 'line_added', occurredAt: '2026-10-07T11:00:00Z', userId: U,
    line: { lineType: 'catalog_block', quantity: 1, priceVersionId, effectiveFrom: '2026-10-07T11:00:00Z', providerRef: 'sub_1' }, ...extra });
  it('+100 block: one USD line of 300 minor even when delivered twice (never 600); IL line 500 ILS; tampered amount/currency ignored', async () => {
    const s = eventSql();
    const m = signed(line('l1', 'intl_catalog_block_month_v1', { amountMinor: 600, currency: 'ILS', rate: 3.7 }));
    await hook(s, m); await hook(s, m);
    expect([...s.lines.values()]).toEqual([{ quantity: 1, unitAmountMinor: 300, currency: 'USD' }]);
    expect([...s.lines.values()].reduce((t, l) => t + l.quantity * l.unitAmountMinor, 0)).toBe(300);
    expect(Object.keys(s.sql.applyVerifiedLineEvent.mock.calls[0][0]).sort()).toEqual(['effectiveFrom', 'lineType', 'priceVersionId', 'provider', 'providerEventId', 'providerRef', 'quantity', 'removal', 'userId']);
    await hook(s, signed(line('l2', 'il_catalog_block_month_v1')));
    expect(s.lines.get('l2')).toEqual({ quantity: 1, unitAmountMinor: 500, currency: 'ILS' });
  });
  it('a line event that names a plan price instead of a block price is invalid', async () => {
    const s = eventSql();
    expect((await hook(s, signed(line('l3', 'intl_visual_month_v1')))).status).toBe(400);
    expect(s.sql.applyVerifiedLineEvent).not.toHaveBeenCalled();
  });
});

describe('reconciliation (mock provider list): replays verified events idempotently and reports drift; never writes a status', () => {
  it('converges a missed webhook and reports a drifting projection', async () => {
    const s = eventSql();
    const events: ProviderEvent[] = [parseProviderEvent(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z'))!,
      parseProviderEvent(ev('e2', 'renewal_failed', '2026-11-07T11:00:00Z'))!];
    await hook(s, signed(ev('e1', 'payment_confirmed', '2026-10-07T11:00:00Z')));   // e2 was never delivered
    const record = vi.fn((e: ProviderEvent) => s.sql.recordVerifiedEvent({ provider: 'mock', providerEventId: e.providerEventId, eventType: e.type, attemptId: ATT, providerEventTime: e.occurredAt, payloadSha256: '0'.repeat(64) }));
    const r1 = await reconcileSubscriptions({ listLocal: async () => [{ attemptId: ATT }], fetchProviderEvents: async () => events, record, readStatus: async () => s.sub.status });
    expect(r1).toMatchObject({ ok: true, checked: 1, drift: [] });
    expect(s.sub).toMatchObject({ status: 'past_due', periods: 1 });
    const r2 = await reconcileSubscriptions({ listLocal: async () => [{ attemptId: ATT }], fetchProviderEvents: async () => events, record, readStatus: async () => 'active' });
    expect(r2.drift).toEqual([{ attemptId: ATT, local: 'active', expected: 'past_due' }]);
  });
});

// Task 27 (§249 + the Owner's 2026-10-11 amendment): the all-inclusive package is the current offer, monthly or annual; the legacy rows
// stay parseable (offer 'legacy') for existing rights. The amount checked is the server row = the displayed price.
describe('all-inclusive package (current offer)', () => {
  const pkg = (market: 'IL' | 'INTERNATIONAL') => (market === 'IL'
    ? [{ priceId: 'il_all_inclusive_month_p1', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'month', amountMinor: 3000, taxMode: 'included', offer: 'current' },
       { priceId: 'il_all_inclusive_year_p1', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'year', amountMinor: 30600, taxMode: 'included', offer: 'current' }]
    : [{ priceId: 'intl_all_inclusive_month_p1', planId: 'all_inclusive', currency: 'USD', billingPeriod: 'month', amountMinor: 1800, taxMode: 'not_decided', offer: 'current' },
       { priceId: 'intl_all_inclusive_year_p2', planId: 'all_inclusive', currency: 'USD', billingPeriod: 'year', amountMinor: 18400, taxMode: 'not_decided', offer: 'current' }]);
  const cat = (market: 'IL' | 'INTERNATIONAL') => {
    const base = market === 'IL' ? IL : INTL;
    return { ...base, prices: [...base.prices.map((p) => ({ ...p, offer: 'legacy' })), ...pkg(market)] };
  };
  it('the package amounts are exactly the server rows: IL 3000 / 30600 ILS, INTERNATIONAL 1800 / 18400 USD; no blocks', () => {
    const il = parseCatalog(cat('IL'), 'IL');
    const intl = parseCatalog(cat('INTERNATIONAL'), 'INTERNATIONAL');
    expect(computeCheckoutAmount(il, 'all_inclusive', 0, 'month')).toEqual({ currency: 'ILS', amountMinor: 3000, planPriceId: 'il_all_inclusive_month_p1', blockPriceId: null });
    expect(computeCheckoutAmount(il, 'all_inclusive', 0, 'year')!.amountMinor).toBe(30600);
    expect(computeCheckoutAmount(intl, 'all_inclusive', 0, 'year')).toMatchObject({ currency: 'USD', amountMinor: 18400, planPriceId: 'intl_all_inclusive_year_p2' });
    expect(computeCheckoutAmount(intl, 'all_inclusive', 1, 'year')).toBeNull();
    expect(computeCheckoutAmount(intl, 'all_inclusive', 0, 'week')).toBeNull();
    expect(computeCheckoutAmount(intl, 'classic', 0, 'year')).toBeNull(); // a legacy plan has no annual price
    expect(computeCheckoutAmount(intl, 'classic', 0)).toMatchObject({ amountMinor: 1800 }); // the legacy monthly path is unchanged
  });
  it('fails closed on a year row for a style plan, a legacy-marked package row or a current-marked legacy row', () => {
    const c = cat('IL');
    expect(parseCatalog({ ...c, prices: [...c.prices, { priceId: 'il_classic_year_x', planId: 'classic', currency: 'ILS', billingPeriod: 'year', amountMinor: 1, taxMode: 'included', offer: 'legacy' }] }, 'IL')).toBeNull();
    expect(parseCatalog({ ...c, prices: c.prices.map((p) => (p.planId === 'all_inclusive' ? { ...p, offer: 'legacy' } : p)) }, 'IL')).toBeNull();
    expect(parseCatalog({ ...c, prices: c.prices.map((p) => (p.planId === 'classic' ? { ...p, offer: 'current' } : p)) }, 'IL')).toBeNull();
  });
  it('the package intent goes through create_package_checkout_intent with the period only; the amount must match the server row', async () => {
    const sqlAmount = { v: 18400 };
    const sql = {
      createCheckoutIntent: vi.fn(),
      createPackageCheckoutIntent: vi.fn(async () => ({ ok: true, attemptId: ATT, market: 'INTERNATIONAL', currency: 'USD', amountMinor: sqlAmount.v, state: 'pending' })),
      priceCatalog: vi.fn(async () => cat('INTERNATIONAL')), recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
    } as never as BillingSql & Record<string, ReturnType<typeof vi.fn>>;
    const provider = okProvider();
    const r = await checkoutIntentHandler('prepared', { sql, provider }, U, { planId: 'all_inclusive', billingPeriod: 'year', idempotencyKey: KEY, amountMinor: 1, currency: 'ILS' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ amountMinor: 18400, currency: 'USD', state: 'pending' });
    expect(sql.createPackageCheckoutIntent).toHaveBeenCalledWith(U, 'year', KEY);
    expect(sql.createCheckoutIntent).not.toHaveBeenCalled();
    // the package period reaches the provider (PayPlus phase 1: monthly / annual renewal), from the request period only
    expect(provider.createCheckout).toHaveBeenCalledWith({ attemptId: ATT, currency: 'USD', amountMinor: 18400, billingPeriod: 'year' });
    sqlAmount.v = 18360; // the retired $183.60 would be a mismatch -> refused, nothing reaches the provider
    const provider2 = okProvider();
    expect((await checkoutIntentHandler('prepared', { sql, provider: provider2 }, U, { planId: 'all_inclusive', billingPeriod: 'year', idempotencyKey: KEY })).body).toMatchObject({ ok: false, code: 'checkout_unavailable' });
    expect(provider2.createCheckout).not.toHaveBeenCalled();
    expect((await checkoutIntentHandler('prepared', { sql, provider }, U, { planId: 'all_inclusive', billingPeriod: 'quarter', idempotencyKey: KEY })).status).toBe(400);
    expect((await checkoutIntentHandler('prepared', { sql, provider }, U, { planId: 'all_inclusive', billingPeriod: 'year', blocks: 1, idempotencyKey: KEY })).status).toBe(400);
    expect((await checkoutIntentHandler('off', { sql, provider }, U, { planId: 'all_inclusive', billingPeriod: 'year', idempotencyKey: KEY })).body).toMatchObject({ code: 'checkout_unavailable' });
  });
});
