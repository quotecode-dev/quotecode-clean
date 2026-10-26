// @vitest-environment node
// PayPlus phase 1 (Owner console 2026-10-18): the PayPlus provider on mocks only - no key, no network, no PayPlus call, no DB.
// Contract = the PayPlus public documentation (generateLink, Transaction Callback Response, Validate Requests Received from PayPlus).
import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { checkoutIntentHandler, checkoutStatusHandler, providerWebhookHandler, type BillingSql } from './billing';
import { ACTIVATION_PHASE } from './authority';
import { firstChargeFreeDays,
  buildGenerateLinkBody, createPayPlusProvider, israelDayOfMonth, mapPayPlusCallback, PAYPLUS_API_BASES, payplusDateToIso,
  payplusProviderFromSecrets, PAYPLUS_SECRET_NAMES, type PayPlusConfig, payplusStandingOrders, normalizeStandingOrder,
} from './payplus';

const U = '11111111-1111-4111-8111-111111111111';
const ATT = '22222222-2222-4222-8222-222222222222';
const PAGE = '33333333-3333-4333-8333-333333333333';
const KEY = 'k'.repeat(20);
const SECRET = 'synthetic-secret-not-a-real-key-0123';
const NOW = Date.parse('2026-10-18T09:00:00Z');
const LINK = 'https://payments.payplus.co.il/c2b8a6f0-0000-4000-8000-000000000001';

function fetchOk(answer: unknown = { results: { status: 'success', code: 0 }, data: { page_request_uid: 'x', payment_page_link: LINK } }) {
  return vi.fn(async () => ({ ok: true, json: async () => answer }));
}
function config(over: Partial<PayPlusConfig> = {}): PayPlusConfig {
  return {
    apiBase: PAYPLUS_API_BASES.staging, apiKey: 'synthetic-api-key', secretKey: SECRET, paymentPageUid: PAGE,
    callbackUrl: 'https://project.supabase.co/functions/v1/subscription-authority/provider-event',
    successUrl: 'https://www.tekango.com/dashboard?billing=processing', failureUrl: 'https://www.tekango.com/dashboard?billing=failed',
    fetch: fetchOk(), now: () => NOW, ...over,
  };
}

const callback = (over: Record<string, unknown> = {}, tx: Record<string, unknown> = {}) => ({
  transaction_type: 'Charge',
  transaction: { uid: 'dcb11c1e7-a1231-37cf-6311-f5111eeb69c7', payment_request_uid: 'ef76432c-769a-43a6-ba7a-6f70272539d8', number: 'fd138',
    type: 'internal_page', date: '2026-10-18 12:32:52', status_code: '000', amount: 306, currency: 'ILS', more_info: ATT,
    approval_number: '002341', ...tx },
  data: { customer_uid: '3bcc6b2d-b35a-62e1-72c1-318a79bfd1be', items: [{ name: 'TEKANGO - מנוי שנתי', quantity: 1, amount_pay: 306 }],
    card_information: { four_digits: '6134', card_holder_name: 'Synthetic' } },
  ...over,
});
/** signs like the documented sample: base64(HMAC-SHA256(secret, JSON.stringify(body))) */
function signed(body: unknown, o: { secret?: string; ua?: string | null; raw?: string; tamper?: (s: string) => string } = {}) {
  const canonical = JSON.stringify(body);
  const hash = createHmac('sha256', o.secret ?? SECRET).update(o.raw ?? canonical).digest('base64');
  const sent = o.tamper ? o.tamper(o.raw ?? canonical) : (o.raw ?? canonical);
  const h: Record<string, string> = { hash, 'content-type': 'application/json' };
  if (o.ua !== null) h['user-agent'] = o.ua ?? 'PayPlus';
  return { raw: new Uint8Array(Buffer.from(sent, 'utf8')), headers: { get: (k: string) => h[k.toLowerCase()] ?? null } };
}

describe('payment page (generateLink): the server attempt only, ILS, renewing', () => {
  it('monthly 30.00 / annual 306.00 ILS, VAT included, charge_method 3, our attempt id in more_info', () => {
    const m = buildGenerateLinkBody(config(), { attemptId: ATT, amountMinor: 3000, billingPeriod: 'month', nowMs: NOW });
    const y = buildGenerateLinkBody(config(), { attemptId: ATT, amountMinor: 30600, billingPeriod: 'year', nowMs: NOW });
    expect(m).toMatchObject({ payment_page_uid: PAGE, charge_method: 3, amount: 30, currency_code: 'ILS', more_info: ATT,
      refURL_callback: config().callbackUrl, send_failure_callback: true, items: [{ name: 'TEKANGO - מנוי חודשי', quantity: 1, price: 30, vat_type: 0 }] });
    expect(m.recurring_settings).toMatchObject({ instant_first_payment: true, recurring_type: 2, recurring_range: 1, number_of_charges: 0,
      start_date_on_payment_date: true, start_date: 18, successful_invoice: true, send_customer_success_email: true, customer_failure_email: true });
    // Owner 2026-10-26: the first standing-order charge after the whole paid period - never a second charge the first night
    expect(m.recurring_settings.jump_payments).toBe(firstChargeFreeDays(NOW, 'month'));
    expect(y.recurring_settings.jump_payments).toBe(firstChargeFreeDays(NOW, 'year'));
    expect(m.recurring_settings.jump_payments).toBeGreaterThanOrEqual(28);
    // Owner 2026-10-25: an Israeli customer gets the approval / failure email and an invoice-receipt for the first charge too
    expect(m).toMatchObject({ sendEmailApproval: true, sendEmailFailure: true, initial_invoice: true });
    expect(y).toMatchObject({ amount: 306, items: [{ name: 'TEKANGO - מנוי שנתי', price: 306, vat_type: 0 }] });
    expect(y.recurring_settings).toMatchObject({ recurring_type: 2, recurring_range: 12 });
  });
  it('POSTs to the documented endpoint with api-key + secret-key and returns only a PayPlus https link', async () => {
    const f = fetchOk();
    const p = createPayPlusProvider(config({ fetch: f }));
    expect(await p.createCheckout({ attemptId: ATT, currency: 'ILS', amountMinor: 30600, billingPeriod: 'year' })).toEqual({ redirectUrl: LINK });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string>; body: string }];
    expect(url).toBe('https://restapidev.payplus.co.il/api/v1.0/PaymentPages/generateLink');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'api-key': 'synthetic-api-key', 'secret-key': SECRET, 'content-type': 'application/json' });
    expect(JSON.parse(init.body)).toMatchObject({ amount: 306, currency_code: 'ILS', more_info: ATT });
  });
  it.each([
    ['a EUR amount (only ILS / USD)', { currency: 'EUR', amountMinor: 1800, billingPeriod: 'month' }],
    ['a legacy style plan (no package period)', { currency: 'ILS', amountMinor: 2900 }],
    ['a bad attempt id', { attemptId: 'not-a-uuid', currency: 'ILS', amountMinor: 3000, billingPeriod: 'month' }],
    ['a non-integer amount', { currency: 'ILS', amountMinor: 30.5, billingPeriod: 'month' }],
  ])('refuses %s without calling PayPlus', async (_n, i) => {
    const f = fetchOk();
    const p = createPayPlusProvider(config({ fetch: f }));
    expect(await p.createCheckout({ attemptId: ATT, ...i } as never)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it.each([
    ['a link outside payplus.co.il', fetchOk({ results: { status: 'success' }, data: { payment_page_link: 'https://payplus.co.il.evil.example/p' } })],
    ['an http link', fetchOk({ results: { status: 'success' }, data: { payment_page_link: 'http://payments.payplus.co.il/p' } })],
    ['an error answer', fetchOk({ results: { status: 'error', code: 1, description: 'can-not-find-payment-page' }, data: {} })],
    ['an HTTP 422', vi.fn(async () => ({ ok: false, json: async () => ({}) }))],
    ['a network failure / timeout', vi.fn(async () => { throw new Error('timeout'); })],
  ])('%s -> no checkout (null)', async (_n, f) => {
    const p = createPayPlusProvider(config({ fetch: f as never }));
    expect(await p.createCheckout({ attemptId: ATT, currency: 'ILS', amountMinor: 3000, billingPeriod: 'month' })).toBeNull();
  });
  it('an unknown API host, an http return URL or a short secret is a configuration error', () => {
    expect(() => createPayPlusProvider(config({ apiBase: 'https://restapi.payplus.example/api/v1.0' }))).toThrow(/invalid configuration/);
    expect(() => createPayPlusProvider(config({ callbackUrl: 'http://project.supabase.co/x' }))).toThrow(/invalid configuration/);
    expect(() => createPayPlusProvider(config({ secretKey: 'short' }))).toThrow(/invalid configuration/);
    expect(() => createPayPlusProvider(config({ apiBase: PAYPLUS_API_BASES.production }))).not.toThrow();
  });
  it('through the checkout handler: the server catalog amount (IL annual 30600) reaches PayPlus, a body amount never does', async () => {
    const f = fetchOk();
    const sql = {
      createCheckoutIntent: vi.fn(),
      createPackageCheckoutIntent: vi.fn(async () => ({ ok: true, attemptId: ATT, market: 'IL', currency: 'ILS', amountMinor: 30600, state: 'pending' })),
      priceCatalog: vi.fn(async () => ({ ok: true, market: 'IL', prices: [
        { priceId: 'il_all_inclusive_month_p1', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'month', amountMinor: 3000, taxMode: 'included', offer: 'current' },
        { priceId: 'il_all_inclusive_year_p1', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'year', amountMinor: 30600, taxMode: 'included', offer: 'current' }] })),
      recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(), recordCheckoutPage: vi.fn(async (_a: string, _u: string, url: string) => url),
    } as never as BillingSql;
    const r = await checkoutIntentHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: f })) }, U,
      { planId: 'all_inclusive', billingPeriod: 'year', idempotencyKey: KEY, amountMinor: 1, currency: 'USD' });
    expect(r).toEqual({ status: 200, body: { ok: true, attemptId: ATT, currency: 'ILS', amountMinor: 30600, redirectUrl: LINK, state: 'pending', smartPack: false } });
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toMatchObject({ amount: 306, currency_code: 'ILS' });
  });
  it('an account that would pay for nothing (SQL already_subscribed) gets 409 and PayPlus is never called', async () => {
    const f = fetchOk();
    const sql = { createCheckoutIntent: vi.fn(), createPackageCheckoutIntent: vi.fn(async () => ({ ok: false, code: 'already_subscribed' })),
      priceCatalog: vi.fn(), recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn() } as never as BillingSql;
    expect(await checkoutIntentHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: f })) }, U,
      { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: KEY })).toEqual({ status: 409, body: { ok: false, code: 'already_subscribed' } });
    expect(f).not.toHaveBeenCalled();
  });
});

describe('callback: really from PayPlus (user-agent + hash), otherwise nothing is stored', () => {
  const p = createPayPlusProvider(config());
  it('a documented, correctly signed success callback -> payment_confirmed for OUR attempt, Israel time -> UTC', async () => {
    const s = signed(callback());
    expect(await p.verifyWebhook(s.raw, s.headers, NOW)).toEqual({ ok: true, event: {
      providerEventId: 'dcb11c1e7-a1231-37cf-6311-f5111eeb69c7', type: 'payment_confirmed', occurredAt: '2026-10-18T09:32:52.000Z',
      attemptId: ATT, userId: null, line: null, paid: { amountMinor: 30600, currency: 'ILS' } } });
  });
  it('the received bytes may differ from JSON.stringify (escaped Hebrew, spacing): the documented JSON.stringify signature is accepted', async () => {
    const body = callback();
    const raw = JSON.stringify(body, null, 2).replace(/[֐-׿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
    const hash = createHmac('sha256', SECRET).update(JSON.stringify(body)).digest('base64');
    const h: Record<string, string> = { hash, 'user-agent': 'PayPlus' };
    const v = await p.verifyWebhook(new Uint8Array(Buffer.from(raw)), { get: (k) => h[k] ?? null }, NOW);
    expect(v).toMatchObject({ ok: true, event: { type: 'payment_confirmed', attemptId: ATT } });
  });
  it.each([
    ['another user-agent', { ua: 'curl/8.0' }, 'untrusted_source'],
    ['no user-agent', { ua: null }, 'untrusted_source'],
    ['the wrong secret (a forger)', { secret: 'another-secret-0123456789abcdef' }, 'invalid_signature'],
    ['a tampered body (status changed after signing)', { tamper: (s: string) => s.replace('"000"', '"001"') }, 'invalid_signature'],
    ['a tampered attempt id', { tamper: (s: string) => s.replace(ATT, '44444444-4444-4444-8444-444444444444') }, 'invalid_signature'],
  ])('%s -> %s', async (_n, o, reason) => {
    const s = signed(callback(), o as never);
    expect(await p.verifyWebhook(s.raw, s.headers, NOW)).toEqual({ ok: false, reason });
  });
  it('no hash header / not base64 / not JSON -> invalid_signature', async () => {
    const raw = new Uint8Array(Buffer.from(JSON.stringify(callback())));
    expect(await p.verifyWebhook(raw, { get: (k) => (k === 'user-agent' ? 'PayPlus' : null) }, NOW)).toEqual({ ok: false, reason: 'invalid_signature' });
    expect(await p.verifyWebhook(raw, { get: (k) => (k === 'user-agent' ? 'PayPlus' : '%%%') }, NOW)).toEqual({ ok: false, reason: 'invalid_signature' });
    const s = signed(callback(), { raw: 'not json' });
    expect(await p.verifyWebhook(s.raw, s.headers, NOW)).toEqual({ ok: false, reason: 'invalid_signature' });
  });
  it.each([
    ['a failed charge', callback({}, { status_code: '001' }), 'payment_failed'],
    ['a refund', callback({ transaction_type: 'Refund' }), 'refund'],
  ])('%s is recorded as %s (never an activation)', async (_n, body, type) => {
    const s = signed(body);
    expect(await p.verifyWebhook(s.raw, s.headers, NOW)).toMatchObject({ ok: true, event: { type } });
  });
  it.each([
    ['a EUR transaction', callback({}, { currency: 'EUR' })],
    ['no attempt id in more_info', callback({}, { more_info: 'Some Info' })],
    ['an unknown transaction type', callback({ transaction_type: 'Approval' })],
    ['no transaction uid', callback({}, { uid: undefined })],
    ['an impossible date', callback({}, { date: '2026-02-30 10:00:00' })],
  ])('signed but %s -> invalid_event', async (_n, body) => {
    const s = signed(body);
    expect(await p.verifyWebhook(s.raw, s.headers, NOW)).toEqual({ ok: false, reason: 'invalid_event' });
  });
  it('read: event id, result, time, our attempt id and the paid amount (for the SQL equality check only); card / customer ignored', () => {
    expect(mapPayPlusCallback(callback({}, { amount: 1 }))).toEqual({ id: 'dcb11c1e7-a1231-37cf-6311-f5111eeb69c7', type: 'payment_confirmed',
      occurredAt: '2026-10-18T09:32:52.000Z', attemptId: ATT, paidAmountMinor: 100, paidCurrency: 'ILS', recurringRef: null, terminalRef: null });
    expect(mapPayPlusCallback(callback({}, { amount: 306 }))?.paidAmountMinor).toBe(30600);
    // review 2026-10-22: a numeric string is the same amount; anything else is no amount
    expect(mapPayPlusCallback(callback({}, { amount: '306' }))?.paidAmountMinor).toBe(30600);
    expect(mapPayPlusCallback(callback({}, { amount: '306.50' }))?.paidAmountMinor).toBe(30650);
    expect(mapPayPlusCallback(callback({}, { amount: '306,00' }))?.paidAmountMinor).toBeNull();
    expect(mapPayPlusCallback(callback({}, { amount: '-1' }))?.paidAmountMinor).toBeNull();
  });
  it.each([['2026-13-05 10:00:00'], ['2026-00-10 10:00:00'], ['2026-10-18 10:60:00'], ['2026-10-18 24:00:00']])(
    'an out-of-range date %s -> invalid_event', async (date) => {
      const s = signed(callback({}, { date }));
      expect(await p.verifyWebhook(s.raw, s.headers, NOW)).toEqual({ ok: false, reason: 'invalid_event' });
    });
});

describe('recorded once, through the existing verified-event path', () => {
  function sqlMock() {
    return { createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      recordVerifiedEvent: vi.fn(async () => ({ ok: true, duplicate: false, outcome: 'applied' })) } as never as BillingSql & { recordVerifiedEvent: ReturnType<typeof vi.fn> };
  }
  it('a verified success reaches SQL as provider payplus / payment_confirmed / our attempt / the body digest', async () => {
    const sql = sqlMock();
    const s = signed(callback());
    const r = await providerWebhookHandler('prepared', { sql, provider: createPayPlusProvider(config()), now: () => NOW }, s.raw, s.headers);
    expect(r).toEqual({ status: 200, body: { ok: true, duplicate: false, outcome: 'applied' } });
    expect(sql.recordVerifiedEvent).toHaveBeenCalledWith({ provider: 'payplus', providerEventId: 'dcb11c1e7-a1231-37cf-6311-f5111eeb69c7',
      eventType: 'payment_confirmed', attemptId: ATT, providerEventTime: '2026-10-18T09:32:52.000Z', payloadSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      paidAmountMinor: 30600, paidCurrency: 'ILS' });
  });
  it('a forged callback is answered 401 and never reaches SQL', async () => {
    const sql = sqlMock();
    const s = signed(callback(), { secret: 'another-secret-0123456789abcdef' });
    expect((await providerWebhookHandler('prepared', { sql, provider: createPayPlusProvider(config()), now: () => NOW }, s.raw, s.headers)).status).toBe(401);
    expect(sql.recordVerifiedEvent).not.toHaveBeenCalled();
  });
  it('billing off (today): refused before verification', async () => {
    const sql = sqlMock();
    const s = signed(callback());
    expect(await providerWebhookHandler('off', { sql, provider: createPayPlusProvider(config()), now: () => NOW }, s.raw, s.headers))
      .toEqual({ status: 503, body: { ok: false, code: 'billing_off' } });
    expect(sql.recordVerifiedEvent).not.toHaveBeenCalled();
  });
});

// Owner night task 2026-10-21 (migration 20261022000000): a standing-order charge is documented with
// transaction.recurring_charge_information.recurring_uid; a renewal need not repeat more_info
describe('standing order: a renewal is recognised by its standing-order id', () => {
  const REC = 'b7f1c2d3-0000-4000-8000-00000000abcd';
  const TERM = 'f0e1d2c3-0000-4000-8000-000000000042';
  const withRec = (tx: Record<string, unknown> = {}) => callback({ data: { terminal_uid: TERM, customer_uid: 'c' } },
    { recurring_charge_information: { recurring_uid: REC, charge_uid: 'ch-1' }, ...tx });
  it('the first payment carries both ids; a renewal without more_info keeps only the standing-order id (+ terminal)', () => {
    expect(mapPayPlusCallback(withRec())).toMatchObject({ attemptId: ATT, recurringRef: REC, terminalRef: TERM });
    expect(mapPayPlusCallback(withRec({ more_info: undefined }))).toMatchObject({ attemptId: null, recurringRef: REC, terminalRef: TERM, type: 'payment_confirmed' });
    expect(mapPayPlusCallback(withRec({ more_info: 'Some Info', status_code: '051' }))).toMatchObject({ attemptId: null, recurringRef: REC, type: 'payment_failed' });
  });
  it('neither id / an over-long standing-order id -> invalid_event', async () => {
    const p = createPayPlusProvider(config());
    for (const body of [callback({}, { more_info: undefined }), withRec({ more_info: undefined, recurring_charge_information: { recurring_uid: 'x'.repeat(201) } })]) {
      const s = signed(body);
      expect(await p.verifyWebhook(s.raw, s.headers, NOW)).toEqual({ ok: false, reason: 'invalid_event' });
    }
  });
  it('the verified renewal reaches SQL with a null attempt id and the standing-order id; the first payment carries both', async () => {
    const sql = { createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      recordVerifiedEvent: vi.fn(async () => ({ ok: true, duplicate: false, outcome: 'applied' })) } as never as BillingSql & { recordVerifiedEvent: ReturnType<typeof vi.fn> };
    const deps = { sql, provider: createPayPlusProvider(config()), now: () => NOW };
    let s = signed(withRec({ more_info: undefined }));
    expect((await providerWebhookHandler('prepared', deps, s.raw, s.headers)).status).toBe(200);
    expect(sql.recordVerifiedEvent).toHaveBeenLastCalledWith(expect.objectContaining({ attemptId: null, recurringRef: REC, terminalRef: TERM, eventType: 'payment_confirmed' }));
    s = signed(withRec());
    await providerWebhookHandler('prepared', deps, s.raw, s.headers);
    expect(sql.recordVerifiedEvent).toHaveBeenLastCalledWith(expect.objectContaining({ attemptId: ATT, recurringRef: REC, terminalRef: TERM }));
  });
  it('SQL unknown_attempt (a standing order nobody bound) -> 404, nothing else', async () => {
    const sql = { createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      recordVerifiedEvent: vi.fn(async () => ({ ok: false, code: 'unknown_attempt' })) } as never as BillingSql;
    const s = signed(withRec({ more_info: undefined }));
    expect(await providerWebhookHandler('prepared', { sql, provider: createPayPlusProvider(config()), now: () => NOW }, s.raw, s.headers))
      .toEqual({ status: 404, body: { ok: false, code: 'unknown_attempt' } });
  });
});

describe('the provider from the Function secrets (Owner night task 2026-10-21; still unreachable while billing is off)', () => {
  const secrets = (over: Record<string, string | undefined> = {}) => {
    const s: Record<string, string | undefined> = { PAYPLUS_API_KEY: 'synthetic-api-key', PAYPLUS_SECRET_KEY: SECRET, PAYPLUS_PAYMENT_PAGE_UID: PAGE,
      PAYPLUS_ENVIRONMENT: 'staging', PAYPLUS_RETURN_ORIGIN: 'https://www.tekango.com', ...over };
    return (n: string) => s[n];
  };
  const URL_ = 'https://project.supabase.co';
  it('all secrets -> a provider whose page carries our callback and the app return pages (processing / failed / cancelled)', async () => {
    const f = fetchOk();
    const p = payplusProviderFromSecrets(secrets(), URL_, f, () => NOW);
    expect(p?.name).toBe('payplus');
    await p!.createCheckout({ attemptId: ATT, currency: 'ILS', amountMinor: 3000, billingPeriod: 'month' });
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe('https://restapidev.payplus.co.il/api/v1.0/PaymentPages/generateLink');
    expect(JSON.parse(init.body)).toMatchObject({ refURL_callback: 'https://project.supabase.co/functions/v1/subscription-authority/provider-event',
      refURL_success: 'https://www.tekango.com/dashboard?billing=processing', refURL_failure: 'https://www.tekango.com/dashboard?billing=failed',
      refURL_cancel: 'https://www.tekango.com/dashboard?billing=cancelled' });
    // production: the production API base; with no return origin it returns to the LIVE app
    const fp = fetchOk();
    await payplusProviderFromSecrets(secrets({ PAYPLUS_ENVIRONMENT: 'production', PAYPLUS_RETURN_ORIGIN: undefined }), URL_, fp, () => NOW)!
      .createCheckout({ attemptId: ATT, currency: 'ILS', amountMinor: 3000, billingPeriod: 'month' });
    const [purl, pinit] = fp.mock.calls[0] as unknown as [string, { body: string }];
    expect(purl).toBe('https://restapi.payplus.co.il/api/v1.0/PaymentPages/generateLink');
    expect(JSON.parse(pinit.body).refURL_success).toBe('https://www.tekango.com/dashboard?billing=processing');
  });
  // Owner console 2026-10-25 (typed: "מאשר: מזהה המסוף כסוד ..."): + the account terminal (the same secret admin-billing reads)
  it('the secret names are exactly these six (no phase, market, plan or price ever comes from a secret)', () => {
    expect([...PAYPLUS_SECRET_NAMES]).toEqual(['PAYPLUS_API_KEY', 'PAYPLUS_SECRET_KEY', 'PAYPLUS_PAYMENT_PAGE_UID', 'PAYPLUS_ENVIRONMENT', 'PAYPLUS_RETURN_ORIGIN', 'PAYPLUS_TERMINAL_UID']);
  });
  it('the staging terminal must name its return origin (never a silent return to LIVE from a test terminal)', () => {
    expect(payplusProviderFromSecrets(secrets({ PAYPLUS_RETURN_ORIGIN: undefined }), URL_, fetchOk(), () => NOW)).toBeNull();
    expect(payplusProviderFromSecrets(secrets({ PAYPLUS_RETURN_ORIGIN: 'https://www.tekango.com/dashboard' }), URL_, fetchOk(), () => NOW)).toBeNull();
  });
  it('wiring passes exactly the parameters of record_verified_provider_event (migration 20261022000000)', () => {
    const wiring = readFileSync(new URL('./wiring.ts', import.meta.url), 'utf8');
    const call = /call\('record_verified_provider_event', \{([\s\S]*?)\}\)\) as Record/.exec(wiring)?.[1] ?? '';
    const sent = [...call.matchAll(/\b(p_[a-z0-9_]+):/g)].map((m) => m[1]);
    const sql = readFileSync(new URL('../../migrations/20261022000000_payplus_standing_order_link.sql', import.meta.url), 'utf8');
    const sig = /FUNCTION public\.record_verified_provider_event\(([\s\S]*?)\)\s*RETURNS/.exec(sql)?.[1] ?? '';
    const declared = [...sig.matchAll(/\b(p_[a-z0-9_]+)\s/g)].map((m) => m[1]);
    expect(sent.length).toBe(10);
    expect(sent).toEqual(declared);
  });
  it.each([
    ['no API key', { PAYPLUS_API_KEY: undefined }],
    ['no secret key', { PAYPLUS_SECRET_KEY: '' }],
    ['no payment page', { PAYPLUS_PAYMENT_PAGE_UID: undefined }],
    ['no environment', { PAYPLUS_ENVIRONMENT: undefined }],
    ['an unknown environment', { PAYPLUS_ENVIRONMENT: 'live' }],
    ['a return origin outside the app', { PAYPLUS_RETURN_ORIGIN: 'https://evil.example' }],
    ['a page id that is not a uuid', { PAYPLUS_PAYMENT_PAGE_UID: 'page-1' }],
    ['a short secret key', { PAYPLUS_SECRET_KEY: 'short' }],
  ])('%s -> no provider (UNAVAILABLE_PROVIDER in wiring)', (_n, over) => {
    expect(payplusProviderFromSecrets(secrets(over), URL_, fetchOk(), () => NOW)).toBeNull();
  });
  it('an http project URL -> no provider; the return origin may be the bare domain', () => {
    expect(payplusProviderFromSecrets(secrets(), 'http://project.supabase.co', fetchOk(), () => NOW)).toBeNull();
    expect(payplusProviderFromSecrets(secrets({ PAYPLUS_RETURN_ORIGIN: 'https://tekango.com/' }), URL_, fetchOk(), () => NOW)).not.toBeNull();
  });
});

describe('Israel time helpers', () => {
  it('summer (IDT +3) and winter (IST +2); an ISO value with a zone is kept', () => {
    expect(payplusDateToIso('2026-07-01 12:00:00')).toBe('2026-07-01T09:00:00.000Z');
    expect(payplusDateToIso('2026-12-01 10:00:00')).toBe('2026-12-01T08:00:00.000Z');
    expect(payplusDateToIso('2026-10-18T09:32:52Z')).toBe('2026-10-18T09:32:52.000Z');
    expect(payplusDateToIso('21/01/2021')).toBeNull();
    expect(israelDayOfMonth(Date.parse('2026-10-31T12:00:00Z'))).toBe(28); // 31 Oct is capped at 28
    expect(israelDayOfMonth(Date.parse('2026-11-30T22:30:00Z'))).toBe(1); // already 1 Dec in Israel
  });
});

describe('the provider comes only from the Function secrets; the code gate is open, the DB switch decides', () => {
  // Owner night task 2026-10-21: wiring builds the provider from the named secrets (UNAVAILABLE_PROVIDER without them); the billing
  // phase is still the code constant 'off', so neither checkout nor a callback ever reaches it
  it('wiring.ts falls back to UNAVAILABLE_PROVIDER, holds no key, and the billing phase constant is enforced (Owner 2026-10-25)', () => {
    const wiring = readFileSync(new URL('./wiring.ts', import.meta.url), 'utf8');
    // Owner 2026-10-24 (Codex spec PAY-01): the provider's fetch is the required relay's (payplusFetch), never a direct fetch
    expect(wiring).toMatch(/payplusProviderFromSecrets\(\(n\) => env\(n\), url, payplusFetch, \(\) => Date\.now\(\)\) \?\? UNAVAILABLE_PROVIDER/);
    expect(wiring).not.toMatch(/api-key|secret-key|restapi/i);
    expect(ACTIVATION_PHASE).toBe('enforced');
  });
});

// Codex audit 2026-10-21 (Owner "כן, את כולן"; migration 20261022100000)
describe('audit fixes: one payment page per attempt (H05); a payment that opened nothing says why (H04)', () => {
  const catalog = vi.fn(async () => ({ ok: true, market: 'IL', prices: [
    { priceId: 'il_all_inclusive_month_p1', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'month', amountMinor: 3000, taxMode: 'included', offer: 'current' },
    { priceId: 'il_all_inclusive_year_p1', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'year', amountMinor: 30600, taxMode: 'included', offer: 'current' }] }));
  const intent = () => vi.fn(async () => ({ ok: true, attemptId: ATT, market: 'IL', currency: 'ILS', amountMinor: 30600, state: 'pending' }));
  const body = { planId: 'all_inclusive', billingPeriod: 'year', idempotencyKey: KEY };
  it('a retry of the same attempt gets the page it already has - PayPlus is not asked again', async () => {
    const f = fetchOk();
    const sql = { createCheckoutIntent: vi.fn(), createPackageCheckoutIntent: intent(), priceCatalog: catalog, recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      checkoutPage: vi.fn(async () => 'https://payments.payplus.co.il/already'), recordCheckoutPage: vi.fn() } as never as BillingSql;
    const r = await checkoutIntentHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: f })) }, U, body);
    expect(r.body).toMatchObject({ ok: true, redirectUrl: 'https://payments.payplus.co.il/already' });
    expect(f).not.toHaveBeenCalled();
  });
  it('a new page is kept once; when another request stored its page first, that stored page is returned', async () => {
    const f = fetchOk();
    const recordCheckoutPage = vi.fn(async () => 'https://payments.payplus.co.il/first-writer');
    const sql = { createCheckoutIntent: vi.fn(), createPackageCheckoutIntent: intent(), priceCatalog: catalog, recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      checkoutPage: vi.fn(async () => null), recordCheckoutPage } as never as BillingSql;
    const r = await checkoutIntentHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: f })) }, U, body);
    expect(recordCheckoutPage).toHaveBeenCalledWith(ATT, U, LINK);
    expect(r.body).toMatchObject({ ok: true, redirectUrl: 'https://payments.payplus.co.il/first-writer' });
  });
  it('Codex audit H-01: no payment link unless the server kept it - a lost answer is read back once, otherwise 503', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mk = (checkoutPage: () => Promise<unknown>, recordCheckoutPage: () => Promise<unknown>) => ({ createCheckoutIntent: vi.fn(),
      createPackageCheckoutIntent: intent(), priceCatalog: catalog, recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      checkoutPage: vi.fn(checkoutPage), recordCheckoutPage: vi.fn(recordCheckoutPage) }) as never as BillingSql;
    const run = (sql: BillingSql) => checkoutIntentHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: fetchOk() })) }, U, body);
    // the store failed and nothing was kept: no link
    expect(await run(mk(async () => null, async () => { throw new Error('db'); }))).toEqual({ status: 503, body: { ok: false, code: 'checkout_unavailable' } });
    expect(await run(mk(async () => null, async () => null))).toEqual({ status: 503, body: { ok: false, code: 'checkout_unavailable' } });
    expect(log.mock.calls.some((c) => String(c[0]).includes('checkout_page_not_stored'))).toBe(true);
    // the answer was lost but the page was kept: the read-back returns the kept page
    let reads = 0;
    const r = await run(mk(async () => (reads++ === 0 ? null : 'https://payments.payplus.co.il/kept'), async () => { throw new Error('lost'); }));
    expect(r.body).toMatchObject({ ok: true, redirectUrl: 'https://payments.payplus.co.il/kept' });
    log.mockRestore();
  });
  it('a wrong-amount payment: the receipt stays 200 and says activated false + amount_mismatch', async () => {
    const sql = { createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      recordVerifiedEvent: vi.fn(async () => ({ ok: true, duplicate: false, outcome: 'rejected', activated: false, code: 'amount_mismatch' })) } as never as BillingSql;
    const s = signed(callback({}, { amount: 1 }));
    expect(await providerWebhookHandler('prepared', { sql, provider: createPayPlusProvider(config()), now: () => NOW }, s.raw, s.headers))
      .toEqual({ status: 200, body: { ok: true, duplicate: false, outcome: 'rejected', activated: false, code: 'amount_mismatch' } });
  });
  it('wiring calls the two page functions with exactly their SQL parameters', () => {
    const wiring = readFileSync(new URL('./wiring.ts', import.meta.url), 'utf8');
    const sql = readFileSync(new URL('../../migrations/20261022100000_payplus_audit_fixes.sql', import.meta.url), 'utf8');
    for (const fn of ['checkout_attempt_page', 'record_checkout_attempt_page']) {
      const sent = [...(new RegExp(`call\\('${fn}', \\{([^}]*)\\}\\)`).exec(wiring)?.[1] ?? '').matchAll(/\b(p_[a-z0-9_]+):/g)].map((m) => m[1]);
      const declared = [...(new RegExp(`FUNCTION public\\.${fn}\\(([^)]*)\\)`).exec(sql)?.[1] ?? '').matchAll(/\b(p_[a-z0-9_]+)\s/g)].map((m) => m[1]);
      expect(sent.length).toBeGreaterThan(1);
      expect(sent).toEqual(declared);
    }
  });
});

describe('review 2026-10-22: a click for an attempt that is no longer pending opens no new page', () => {
  it('SQL answers the same attempt as paid / expired -> 409 checkout_not_pending, PayPlus never asked', async () => {
    const f = fetchOk();
    const sql = { createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(), recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      createPackageCheckoutIntent: vi.fn(async () => ({ ok: true, attemptId: ATT, market: 'IL', currency: 'ILS', amountMinor: 30600, state: 'expired' })) } as never as BillingSql;
    expect(await checkoutIntentHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: f })) }, U,
      { planId: 'all_inclusive', billingPeriod: 'year', idempotencyKey: KEY })).toEqual({ status: 409, body: { ok: false, code: 'checkout_not_pending' } });
    expect(f).not.toHaveBeenCalled();
  });
});

// Owner console 2026-10-21: payments go live in Hebrew AND English together - International = USD, an English page (prepared, inert)
describe('International: USD + English page (prepared; the billing phase stays off)', () => {
  it('USD body: currency USD, English page, VAT-exempt English lines, no Israeli ID / instalments field', () => {
    const b = buildGenerateLinkBody(config(), { attemptId: ATT, amountMinor: 2300, billingPeriod: 'month', nowMs: NOW, addOnAmountMinor: 500, currency: 'USD' });
    expect(b).toMatchObject({ amount: 23, currency_code: 'USD', language_code: 'en', paying_vat: false, hide_identification_id: true,
      hide_payments_field: true, more_info: ATT,
      items: [{ name: 'TEKANGO - Monthly subscription', price: 18, vat_type: 2 }, { name: 'TEKANGO - SMART PACK monthly', price: 5, vat_type: 2 }] });
    // Owner 2026-10-25: international purchasing is not open - no invoice / customer emails on a USD page
    expect(b).toMatchObject({ sendEmailApproval: false, sendEmailFailure: false });
    expect(b).not.toHaveProperty('initial_invoice');
    expect(b.recurring_settings).toMatchObject({ successful_invoice: false, send_customer_success_email: false, customer_failure_email: false });
    const il = buildGenerateLinkBody(config(), { attemptId: ATT, amountMinor: 3000, billingPeriod: 'month', nowMs: NOW });
    expect(il).not.toHaveProperty('language_code');
    expect(il).not.toHaveProperty('paying_vat');
    expect(il.currency_code).toBe('ILS');
  });
  it('createCheckout accepts USD and returns the page request id for the server pull', async () => {
    const PRQ = '44444444-4444-4444-8444-444444444444';
    const f = fetchOk({ results: { status: 'success', code: 0 }, data: { page_request_uid: PRQ, payment_page_link: LINK } });
    const p = createPayPlusProvider(config({ fetch: f }));
    expect(await p.createCheckout({ attemptId: ATT, currency: 'USD', amountMinor: 18400, billingPeriod: 'year' })).toEqual({ redirectUrl: LINK, pageRequestUid: PRQ });
    const [, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toMatchObject({ currency_code: 'USD', language_code: 'en', amount: 184 });
  });
  it('a signed USD charge maps with the USD amount (SQL still compares it with the server attempt)', async () => {
    const p = createPayPlusProvider(config());
    const s = signed(callback({}, { currency: 'USD', amount: 18 }));
    expect(await p.verifyWebhook(s.raw, s.headers, NOW)).toMatchObject({ ok: true, event: { type: 'payment_confirmed', paid: { amountMinor: 1800, currency: 'USD' } } });
  });
});

// Sandbox run 2026-10-21: pull by page request id, Update needs valid:true, DeleteRecurring cancels
describe('standing orders: pull, update, cancel (prepared)', () => {
  const REC = '9ab9e163-0000-4000-8000-000000000001'; const TERM = '66f01674-0000-4000-8000-000000000002';
  const PROD1 = '386c8e7d-0000-4000-8000-000000000003'; const PROD2 = '386c8e7d-0000-4000-8000-000000000004';
  const PRQ = '1a2aee2e-0000-4000-8000-000000000005';
  const record = { uid: REC, number: 'mBa83', valid: true, status: 'approved', amount: 1, currency_code: 'ILS', extra_info: ATT, start_date: '2026-10-21',
    recurring_type: 2, recurring_range: 1, customer_uid: 'cust-1', cashier_uid: 'cash-1', card_token: 'tok-1',
    items: [{ product_uid: PROD1, quantity: 1, quantity_price_including_vat: 0.6 }, { product_uid: PROD2, quantity: 1, quantity_price_including_vat: 0.4 }] };
  const ok = (data: unknown = null) => vi.fn(async () => ({ ok: true, json: async () => ({ results: { status: 'success', code: 0 }, data }) }));
  const so = (f: unknown) => payplusStandingOrders({ apiBase: PAYPLUS_API_BASES.staging, apiKey: 'k', secretKey: 's', fetch: f as never });
  it('normalizes the pulled standing order: our attempt id from extra_info, two lines in minor units', () => {
    expect(normalizeStandingOrder(record)).toMatchObject({ recurringUid: REC, number: 'mBa83', valid: true, amountMinor: 100, currency: 'ILS', attemptId: ATT,
      items: [{ productUid: PROD1, priceMinor: 60 }, { productUid: PROD2, priceMinor: 40 }] });
    expect(normalizeStandingOrder({ ...record, uid: 'x' })).toBeNull();
    expect(normalizeStandingOrder({ ...record, extra_info: 'Some Info' })!.attemptId).toBeNull();
  });
  it('byPageRequest POSTs /PaymentPages/ipn with the page request id; an error answer is null', async () => {
    const f = ok(record);
    expect((await so(f).byPageRequest(PRQ))!.recurringUid).toBe(REC);
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe(`${PAYPLUS_API_BASES.staging}/PaymentPages/ipn`);
    expect(JSON.parse(init.body)).toEqual({ payment_request_uid: PRQ });
    const bad = vi.fn(async () => ({ ok: true, json: async () => ({ results: { status: 'error' }, data: {} }) }));
    expect(await so(bad).byPageRequest(PRQ)).toBeNull();
    expect(await so(f).byPageRequest('not-a-uuid')).toBeNull();
  });
  it('updateLines sends valid:true (422 without it in the sandbox), the lines and a future start date', async () => {
    const f = ok({ recurring_payment_uid: REC });
    const o = normalizeStandingOrder(record)!;
    expect(await so(f).updateLines(o, TERM, [{ productUid: PROD1, priceMinor: 60 }], '2026-10-24')).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe(`${PAYPLUS_API_BASES.staging}/RecurringPayments/Update/${REC}`);
    expect(JSON.parse(init.body)).toMatchObject({ terminal_uid: TERM, valid: true, instant_first_payment: false, start_date: '2026-10-24', currency_code: 'ILS',
      items: [{ product_uid: PROD1, quantity: 1, price: 0.6 }] });
    expect(await so(f).updateLines(o, TERM, [], '2026-10-24')).toBe(false);
    expect(await so(f).updateLines({ ...o, cardToken: null }, TERM, [{ productUid: PROD1, priceMinor: 60 }], '2026-10-24')).toBe(false);
  });
  it('cancel POSTs DeleteRecurring with the terminal; a bad id never calls PayPlus', async () => {
    const f = ok({ recurring_payment_uid: REC });
    expect(await so(f).cancel(REC, TERM)).toBe('cancelled');
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe(`${PAYPLUS_API_BASES.staging}/RecurringPayments/DeleteRecurring/${REC}`);
    expect(JSON.parse(init.body)).toEqual({ terminal_uid: TERM });
    const g = ok();
    expect(await so(g).cancel('x', TERM)).toBe('rejected');
    expect(g).not.toHaveBeenCalled();
  });
  it('cancel (Codex audit H-02): PayPlus said no = rejected; no answer / unreadable = unknown, never rejected', async () => {
    expect(await so(fetchOk({ results: { status: 'error', code: 1 } })).cancel(REC, TERM)).toBe('rejected');
    expect(await so(vi.fn(async () => { throw new Error('timeout'); }) as never).cancel(REC, TERM)).toBe('unknown');
    expect(await so(vi.fn(async () => new Response('<html>', { status: 502 })) as never).cancel(REC, TERM)).toBe('unknown');
  });
  it('refund (20261022300000): POSTs RefundByTransactionUID with the charge and the amount; refunded only on success + 000', async () => {
    const f = ok({ transaction: { uid: 'refund-tx-1', status_code: '000', amount: 10 } });
    expect(await so(f).refund('tx-1', 1000)).toEqual({ ok: true, refundRef: 'refund-tx-1' });
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe(`${PAYPLUS_API_BASES.staging}/Transactions/RefundByTransactionUID`);
    expect(JSON.parse(init.body)).toEqual({ transaction_uid: 'tx-1', amount: 10 });
    expect(await so(ok({ transaction: { uid: 'r', status_code: '006' } })).refund('tx-1', 1000)).toEqual({ ok: false });
    const bad = vi.fn(async () => ({ ok: true, json: async () => ({ results: { status: 'error' }, data: {} }) }));
    expect(await so(bad).refund('tx-1', 1000)).toEqual({ ok: false });
    const g = ok();
    expect(await so(g).refund('tx-1', 0)).toEqual({ ok: false });
    expect(await so(g).refund('', 100)).toEqual({ ok: false });
    expect(g).not.toHaveBeenCalled();
  });
  it('an unknown API host is a configuration error', () => {
    expect(() => payplusStandingOrders({ apiBase: 'https://evil.example', apiKey: 'k', secretKey: 's', fetch: (() => null) as never })).toThrow(/invalid configuration/);
  });
});

// 20261022200000 (Owner 2026-10-21, "להמשיך עכשיו בחיבור למסד"): back from the payment page with no callback, the server pulls
describe('checkout status: the server pull (prepared; the billing phase stays off)', () => {
  const REC = '9ab9e163-0000-4000-8000-000000000011'; const PRQ = '1a2aee2e-0000-4000-8000-000000000015';
  const standing = (over: Record<string, unknown> = {}) => ({ uid: REC, valid: true, status: 'approved', status_code: '000', amount: 30, currency_code: 'ILS',
    extra_info: ATT, customer_uid: 'cust-1', cashier_uid: 'cash-1', card_token: 'tok-1', items: [], ...over });
  const answer = (data: unknown, status = 'success') => vi.fn(async () => ({ ok: true, json: async () => ({ results: { status, code: 0 }, data }) }));
  const target = { attemptId: ATT, requestRef: PRQ, amountMinor: 3000, currency: 'ILS' };
  const sqlWith = (over: Record<string, unknown> = {}) => ({ createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(), recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
    checkoutPullTargets: vi.fn(async () => [target]),
    recordCheckoutPull: vi.fn(async () => ({ ok: true, duplicate: false, outcome: 'applied', activated: true, pulled: true })), ...over }) as never as BillingSql;

  it('pullCheckout: approved only for status 000 + a valid standing order; our attempt id, the standing order, amount in minor units', async () => {
    const p = createPayPlusProvider(config({ fetch: answer(standing()) }));
    const r = await p.pullCheckout!(PRQ);
    expect(r).toMatchObject({ approved: true, attemptId: ATT, recurringRef: REC, amountMinor: 3000, currency: 'ILS' });
    expect(r!.payloadSha256).toMatch(/^[0-9a-f]{64}$/);
    expect((await createPayPlusProvider(config({ fetch: answer(standing({ status_code: '003' })) })).pullCheckout!(PRQ))!.approved).toBe(false);
    expect((await createPayPlusProvider(config({ fetch: answer(standing({ valid: false })) })).pullCheckout!(PRQ))!.approved).toBe(false);
    expect(await createPayPlusProvider(config({ fetch: answer({}, 'error') })).pullCheckout!(PRQ)).toBeNull();
  });
  it('the payment page id is kept together with the page when PayPlus returns it', async () => {
    const f = fetchOk({ results: { status: 'success', code: 0 }, data: { page_request_uid: PRQ, payment_page_link: LINK } });
    const recordCheckoutPageAndRequest = vi.fn(async () => LINK); const recordCheckoutPage = vi.fn();
    const sql = { createCheckoutIntent: vi.fn(), recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      createPackageCheckoutIntent: vi.fn(async () => ({ ok: true, attemptId: ATT, market: 'IL', currency: 'ILS', amountMinor: 3000, state: 'pending' })),
      priceCatalog: vi.fn(async () => ({ ok: true, market: 'IL', prices: [
        { priceId: 'il_all_inclusive_month_p1', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'month', amountMinor: 3000, taxMode: 'included', offer: 'current' }] })),
      checkoutPage: vi.fn(async () => null), recordCheckoutPage, recordCheckoutPageAndRequest } as never as BillingSql;
    const r = await checkoutIntentHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: f })) }, U, { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: KEY });
    expect(r.body).toMatchObject({ ok: true, redirectUrl: LINK });
    expect(recordCheckoutPageAndRequest).toHaveBeenCalledWith(ATT, U, LINK, PRQ);
    expect(recordCheckoutPage).not.toHaveBeenCalled();
  });
  it('an approved pull of our attempt reaches SQL with the pulled amount and standing order; the answer says it opened', async () => {
    const sql = sqlWith();
    const r = await checkoutStatusHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: answer(standing()) })) }, U);
    expect(r).toEqual({ status: 200, body: { ok: true, activated: true, waiting: 0 } });
    expect(sql.recordCheckoutPull).toHaveBeenCalledWith(expect.objectContaining({ attemptId: ATT, userId: U, providerAttemptId: ATT, recurringRef: REC,
      paidAmountMinor: 3000, paidCurrency: 'ILS' }));
  });
  it('not paid yet / not approved / unreachable: nothing reaches SQL, the client keeps waiting', async () => {
    for (const f of [answer({}, 'error'), answer(standing({ status_code: '003' })), vi.fn(async () => { throw new Error('down'); })]) {
      const sql = sqlWith();
      expect(await checkoutStatusHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: f })) }, U))
        .toEqual({ status: 200, body: { ok: true, activated: false, waiting: 1 } });
      expect(sql.recordCheckoutPull).not.toHaveBeenCalled();
    }
  });
  it('an answer naming another attempt is never applied (incident)', async () => {
    const sql = sqlWith(); const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await checkoutStatusHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: answer(standing({ extra_info: PRQ })) })) }, U);
    expect(r.body).toMatchObject({ ok: true, activated: false });
    expect(sql.recordCheckoutPull).not.toHaveBeenCalled();
    expect(log.mock.calls.some((c) => String(c[0]).includes('pull_attempt_mismatch'))).toBe(true);
    log.mockRestore();
  });
  it('a pulled payment that opened nothing is reported; nothing to pull = nothing asked', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sql = sqlWith({ recordCheckoutPull: vi.fn(async () => ({ ok: true, outcome: 'rejected', activated: false, code: 'amount_mismatch', pulled: true })) });
    expect((await checkoutStatusHandler('prepared', { sql, provider: createPayPlusProvider(config({ fetch: answer(standing()) })) }, U)).body).toMatchObject({ activated: false });
    expect(log.mock.calls.some((c) => String(c[0]).includes('amount_mismatch'))).toBe(true);
    log.mockRestore();
    const f = answer(standing());
    const none = sqlWith({ checkoutPullTargets: vi.fn(async () => []) });
    expect(await checkoutStatusHandler('prepared', { sql: none, provider: createPayPlusProvider(config({ fetch: f })) }, U)).toEqual({ status: 200, body: { ok: true, activated: false, waiting: 0 } });
    expect(f).not.toHaveBeenCalled();
  });
  it('billing off answers before anything is read; a malformed target list is never trusted', async () => {
    const sql = sqlWith();
    expect(await checkoutStatusHandler('off', { sql, provider: createPayPlusProvider(config()) }, U)).toEqual({ status: 503, body: { ok: false, code: 'billing_off' } });
    expect(sql.checkoutPullTargets).not.toHaveBeenCalled();
    const bad = sqlWith({ checkoutPullTargets: vi.fn(async () => [{ ...target, requestRef: 'x' }]) });
    expect((await checkoutStatusHandler('prepared', { sql: bad, provider: createPayPlusProvider(config()) }, U)).status).toBe(503);
  });
  it('a second callback within the window after a pull extends nothing but IS reported', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sql = { createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      recordVerifiedEvent: vi.fn(async () => ({ ok: true, duplicate: false, outcome: 'stale', activated: false, code: 'second_charge_after_pull' })) } as never as BillingSql;
    const s = signed(callback());
    expect((await providerWebhookHandler('prepared', { sql, provider: createPayPlusProvider(config()), now: () => NOW }, s.raw, s.headers)).status).toBe(200);
    expect(log.mock.calls.some((c) => String(c[0]).includes('second_charge_after_pull'))).toBe(true);
    log.mockRestore();
  });
  it('the callback of an already-pulled first charge is a normal 200 receipt, not an incident', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sql = { createCheckoutIntent: vi.fn(), priceCatalog: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      recordVerifiedEvent: vi.fn(async () => ({ ok: true, duplicate: false, outcome: 'stale', activated: false, code: 'first_charge_pulled' })) } as never as BillingSql;
    const s = signed(callback());
    expect((await providerWebhookHandler('prepared', { sql, provider: createPayPlusProvider(config()), now: () => NOW }, s.raw, s.headers)).status).toBe(200);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('wiring calls the three new functions with exactly their SQL parameters', () => {
    const wiring = readFileSync(new URL('./wiring.ts', import.meta.url), 'utf8');
    const sql = readFileSync(new URL('../../migrations/20261022200000_payplus_checkout_pull.sql', import.meta.url), 'utf8');
    for (const fn of ['record_checkout_attempt_page_and_request', 'checkout_pull_targets', 'record_checkout_pull']) {
      const sent = [...(new RegExp(`call\\('${fn}', \\{([^}]*)\\}\\)`).exec(wiring)?.[1] ?? '').matchAll(/\b(p_[a-z0-9_]+):/g)].map((m) => m[1]);
      // the definition, not the ROLLBACK note (DROP FUNCTION ... with types only)
      const declared = [...(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(([^)]*)\\)`).exec(sql)?.[1] ?? '').matchAll(/\b(p_[a-z0-9_]+)\s/g)].map((m) => m[1]);
      expect(sent.length).toBeGreaterThan(0);
      expect(sent).toEqual(declared);
    }
  });
});

// Owner console 2026-10-26 (typed: "מאשר תיקון יצירת הוראת הקבע כך שהחיוב הראשון שלה יהיה רק אחרי תקופה מלאה ..."): the free days until the
// first standing-order charge are exactly the paid period (Israel calendar, the month clamp of Postgres' interval '1 month')
describe('the first standing-order charge after the whole paid period', () => {
  const il = (y: number, mo: number, d: number) => Date.UTC(y, mo - 1, d, 10, 0, 0); // 12:00 / 13:00 in Israel - the same Israel day
  it('the live case: 25/10 -> 25/11 = 31 days; the year = 365 days', () => {
    expect(firstChargeFreeDays(il(2026, 10, 25), 'month')).toBe(31);
    expect(firstChargeFreeDays(il(2026, 10, 25), 'year')).toBe(365);
  });
  it('month ends clamp like Postgres: 31/01 -> 28/02 (28 days), 31/03 -> 30/04 (30), 30/12 -> 30/01 (31); a leap year', () => {
    expect(firstChargeFreeDays(il(2026, 1, 31), 'month')).toBe(28);
    expect(firstChargeFreeDays(il(2026, 3, 31), 'month')).toBe(30);
    expect(firstChargeFreeDays(il(2026, 12, 30), 'month')).toBe(31);
    expect(firstChargeFreeDays(il(2028, 1, 31), 'month')).toBe(29);
    expect(firstChargeFreeDays(il(2028, 2, 29), 'year')).toBe(365);
  });
  it('the Israel day counts, not the UTC day: 31/10 00:30 Israel is still the 31st', () => {
    expect(firstChargeFreeDays(Date.UTC(2026, 9, 30, 22, 30), 'month')).toBe(30); // 31/10 Israel -> 30/11
  });
});
