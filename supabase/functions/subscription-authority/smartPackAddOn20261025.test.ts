// @vitest-environment node
// Owner console 2026-10-25 ("ב: חיוב יחסי עכשיו"; 20261025300000): an active subscriber adds SMART PACK - a one-time pro-rata page
// ('sp_' + the add-on id), the verified payment reaches the add-on row only, then ONE standing-order Update adds the SMART PACK line
// (both lines, invoices kept on, nothing charged by it). Mocks only - no key, no network, no DB.
import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { checkoutStatusHandler, completeSmartPackLine, parseProviderEvent, providerWebhookHandler, smartPackAddOnIntentHandler,
  smartPackAddOnQuoteHandler, type BillingProvider, type BillingSql } from './billing';
import { buildAddOnLinkBody, createPayPlusProvider, mapPayPlusCallback, PAYPLUS_API_BASES, PAYPLUS_RETURN_PATHS, PAYPLUS_SMART_PACK_ITEM_NAMES,
  payplusProviderFromSecrets, type PayPlusConfig } from './payplus';

const U = '11111111-1111-4111-8111-111111111111';
const ADD = '44444444-4444-4444-8444-444444444444';
const ATT = '22222222-2222-4222-8222-222222222222';
const PAGE = '33333333-3333-4333-8333-333333333333';
const REC = '9ab9e163-0000-4000-8000-000000000001'; const TERM = '66f01674-0000-4000-8000-000000000002';
const PROD_PKG = '386c8e7d-0000-4000-8000-000000000003'; const PROD_SP = '386c8e7d-0000-4000-8000-000000000004';
const PRQ = '1a2aee2e-0000-4000-8000-000000000005';
const NOW = Date.parse('2026-10-25T15:00:00Z');
const LINK = 'https://payments.payplus.co.il/c2b8a6f0-0000-4000-8000-000000000001';
const SECRET = 'synthetic-secret-not-a-real-key-0123';
const urls = { paymentPageUid: PAGE, callbackUrl: 'https://project.supabase.co/functions/v1/subscription-authority/provider-event',
  successUrl: 'https://www.tekango.com/dashboard?billing=processing', failureUrl: 'https://www.tekango.com/dashboard?billing=failed',
  addOnSuccessUrl: 'https://www.tekango.com/dashboard?billing=smart_pack', addOnFailureUrl: 'https://www.tekango.com/dashboard?billing=smart_pack_failed' };
const config = (fetch: unknown): PayPlusConfig => ({ apiBase: PAYPLUS_API_BASES.staging, apiKey: 'synthetic-api-key', secretKey: SECRET, ...urls,
  fetch: fetch as never, now: () => NOW });
const answer = (data: unknown, status = 'success') => ({ ok: true, json: async () => ({ results: { status, code: status === 'success' ? 0 : 1 }, data }) });

describe('the one-time SMART PACK page', () => {
  it('charge_method 1, the server amount, ILS, more_info sp_<id>, the SMART PACK line name, invoice + emails on, the add-on return pages', () => {
    const b = buildAddOnLinkBody(urls, { addOnId: ADD, amountMinor: 667, billingPeriod: 'month', customer: { name: 'עסק', email: 'biz@example.com' } });
    expect(b).toMatchObject({ charge_method: 1, amount: 6.67, currency_code: 'ILS', more_info: `sp_${ADD}`, initial_invoice: true, sendEmailApproval: true,
      sendEmailFailure: true, refURL_success: urls.addOnSuccessUrl, refURL_failure: urls.addOnFailureUrl, customer: { customer_name: 'עסק', email: 'biz@example.com' },
      items: [{ name: PAYPLUS_SMART_PACK_ITEM_NAMES.month, quantity: 1, price: 6.67, vat_type: 0 }] });
    expect(b).not.toHaveProperty('recurring_settings');
  });
  it('the Function secrets give the add-on return pages of the app origin', () => {
    expect(PAYPLUS_RETURN_PATHS).toMatchObject({ addOnSuccess: '/dashboard?billing=smart_pack', addOnFailure: '/dashboard?billing=smart_pack_failed' });
    const env: Record<string, string> = { PAYPLUS_API_KEY: 'synthetic-api-key', PAYPLUS_SECRET_KEY: SECRET, PAYPLUS_PAYMENT_PAGE_UID: PAGE, PAYPLUS_ENVIRONMENT: 'production' };
    const p = payplusProviderFromSecrets((n) => env[n], 'https://project.supabase.co', vi.fn() as never, () => NOW);
    expect(p && typeof p.createAddOnCheckout).toBe('function');
  });
  it('createAddOnCheckout POSTs generateLink and returns the PayPlus page with its request id; a bad input never calls PayPlus', async () => {
    const fetch = vi.fn(async () => answer({ page_request_uid: PRQ, payment_page_link: LINK }));
    const p = createPayPlusProvider(config(fetch));
    expect(await p.createAddOnCheckout!({ addOnId: ADD, currency: 'ILS', amountMinor: 667, billingPeriod: 'month' })).toEqual({ redirectUrl: LINK, pageRequestUid: PRQ });
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toMatchObject({ charge_method: 1, more_info: `sp_${ADD}` });
    expect(await p.createAddOnCheckout!({ addOnId: 'x', currency: 'ILS', amountMinor: 667, billingPeriod: 'month' })).toBeNull();
    expect(await p.createAddOnCheckout!({ addOnId: ADD, currency: 'ILS', amountMinor: 0, billingPeriod: 'month' })).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('the callback of an add-on page reaches the add-on row only', () => {
  const cb = (tx: Record<string, unknown>) => ({ transaction_type: 'Charge', transaction: { uid: 'tx-sp-1', status_code: '000', currency: 'ILS', amount: 6.67,
    date: '2026-10-25 18:00:00', more_info: `sp_${ADD}`, ...tx }, data: { terminal_uid: TERM } });
  it('more_info sp_<id> = addOnId (no attempt, no standing order); a plain uuid stays a package attempt', () => {
    expect(mapPayPlusCallback(cb({}))).toMatchObject({ id: 'tx-sp-1', type: 'payment_confirmed', attemptId: null, addOnId: ADD, recurringRef: null, paidAmountMinor: 667 });
    expect(mapPayPlusCallback(cb({ more_info: ATT }))).not.toHaveProperty('addOnId');
    expect(mapPayPlusCallback(cb({ more_info: 'sp_not-a-uuid' }))).toBeNull();
  });
  it('parseProviderEvent: an add-on event never also names a package attempt, and only payment / failure / refund', () => {
    const base = { id: 'e1', type: 'payment_confirmed', occurredAt: '2026-10-25T15:00:00Z' };
    expect(parseProviderEvent({ ...base, addOnId: ADD })).toMatchObject({ addOnId: ADD, attemptId: null });
    expect(parseProviderEvent({ ...base, addOnId: ADD, attemptId: ATT })).toBeNull();
    expect(parseProviderEvent({ ...base, type: 'renewed', addOnId: ADD })).toBeNull();
  });
  it('a signed add-on callback is recorded by record_smart_pack_add_on_payment (never the package recorder), then the line is added', async () => {
    const body = cb({});
    const raw = new TextEncoder().encode(JSON.stringify(body));
    const hash = createHmac('sha256', SECRET).update(JSON.stringify(body)).digest('base64');
    const headers = { get: (n: string) => (n === 'user-agent' ? 'PayPlus' : n === 'hash' ? hash : null) };
    const provider = createPayPlusProvider(config(vi.fn()));
    const addSmartPackLine = vi.fn(async () => 'added' as const);
    const sql = { recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
      recordSmartPackAddOnPayment: vi.fn(async () => ({ ok: true, duplicate: false, outcome: 'applied', activated: true, lineNeeded: true })),
      smartPackAddOnLineBegin: vi.fn(async () => lineBegin), smartPackAddOnLineFinish: vi.fn(async () => ({ ok: true })) } as never as BillingSql;
    const r = await providerWebhookHandler('enforced', { sql, provider: { ...provider, addSmartPackLine } as BillingProvider, now: () => NOW }, raw, headers);
    expect(r).toEqual({ status: 200, body: { ok: true, duplicate: false, outcome: 'applied' } });
    expect(sql.recordVerifiedEvent).not.toHaveBeenCalled();
    expect((sql.recordSmartPackAddOnPayment as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ provider: 'payplus', providerEventId: 'tx-sp-1',
      eventType: 'payment_confirmed', addOnId: ADD, paidAmountMinor: 667, paidCurrency: 'ILS' });
    expect(addSmartPackLine).toHaveBeenCalledTimes(1);
    expect(sql.smartPackAddOnLineFinish).toHaveBeenCalledWith(ADD, true);
  });
});

const lineBegin = { ok: true, addOnId: ADD, packageAttemptId: ATT, recurringRef: REC, terminalRef: TERM, packageRequestRef: PRQ, packageAmountMinor: 3000,
  addOnAmountMinor: 1000, period: 'month', currency: 'ILS', nextChargeDate: '2026-11-20' };

describe('completeSmartPackLine', () => {
  const sql = (begin: unknown) => ({ smartPackAddOnLineBegin: vi.fn(async () => begin), smartPackAddOnLineFinish: vi.fn(async () => ({ ok: true })) }) as never as BillingSql;
  it('added -> finish(true); refused -> finish(false); no answer -> nothing finished (stays requested, tried again)', async () => {
    for (const [outcome, finished] of [['added', true], ['not_added', false]] as const) {
      const s = sql(lineBegin);
      expect(await completeSmartPackLine({ sql: s, provider: { addSmartPackLine: async () => outcome } as never }, ADD)).toBe(outcome);
      expect(s.smartPackAddOnLineFinish).toHaveBeenCalledWith(ADD, finished);
    }
    const s = sql(lineBegin);
    expect(await completeSmartPackLine({ sql: s, provider: { addSmartPackLine: async () => 'unknown' } as never }, ADD)).toBe('unknown');
    expect(await completeSmartPackLine({ sql: s, provider: { addSmartPackLine: async () => { throw new Error('x'); } } as never }, ADD)).toBe('unknown');
    expect(s.smartPackAddOnLineFinish).not.toHaveBeenCalled();
  });
  it('an incomplete begin answer is never sent to PayPlus (finish false); a refused begin does nothing', async () => {
    const add = vi.fn();
    const s = sql({ ...lineBegin, packageRequestRef: null }); // without the page request id the order cannot be read
    expect(await completeSmartPackLine({ sql: s, provider: { addSmartPackLine: add } as never }, ADD)).toBe('not_added');
    expect(add).not.toHaveBeenCalled();
    expect(s.smartPackAddOnLineFinish).toHaveBeenCalledWith(ADD, false);
    expect(await completeSmartPackLine({ sql: sql({ ok: false, code: 'line_not_open' }), provider: { addSmartPackLine: add } as never }, ADD)).toBe('skipped');
  });
});

describe('addSmartPackLine (PayPlus)', () => {
  const order = (items: unknown[]) => ({ uid: REC, valid: true, amount: 30, currency_code: 'ILS', extra_info: ATT, recurring_type: 2, recurring_range: 1,
    customer_uid: 'cust-1', cashier_uid: 'cash-1', card_token: 'tok-1', items });
  const pkgOnly = order([{ product_uid: PROD_PKG, quantity: 1, quantity_price_including_vat: 30 }]);
  const products = { products: [{ uid: PROD_PKG, name: 'TEKANGO - מנוי חודשי' }, { uid: PROD_SP, name: PAYPLUS_SMART_PACK_ITEM_NAMES.month, valid: true }] };
  const run = (...answers: unknown[]) => {
    const fetch = vi.fn();
    for (const a of answers) fetch.mockImplementationOnce(async () => a);
    return { fetch, p: createPayPlusProvider(config(fetch)) };
  };
  it('reads the order, finds the SMART PACK product, ONE Update with both lines from the next charge date, invoices and emails kept on', async () => {
    // Owner 2026-10-26 (item א2): the package line's own catalog product is looked up too (its name stays on every invoice)
    const { fetch, p } = run(answer(pkgOnly), answer(products), answer(products), answer({ recurring_payment_uid: REC }));
    expect(await p.addSmartPackLine!(lineBegin as never)).toBe('added');
    const calls = fetch.mock.calls as unknown as [string, { method: string; body?: string }][];
    expect(calls[0][0]).toBe(`${PAYPLUS_API_BASES.staging}/PaymentPages/ipn`);
    expect(calls[1][0]).toBe(`${PAYPLUS_API_BASES.staging}/Products/View?currency_code=ILS&skip=0&take=500`);
    expect(calls[1][1]).toMatchObject({ method: 'GET' });
    expect(calls[1][1]).not.toHaveProperty('body');
    expect(calls[2][0]).toBe(`${PAYPLUS_API_BASES.staging}/Products/View?currency_code=ILS&skip=0&take=500`);
    expect(calls[3][0]).toBe(`${PAYPLUS_API_BASES.staging}/RecurringPayments/Update/${REC}`);
    expect(JSON.parse(calls[3][1].body!)).toMatchObject({ terminal_uid: TERM, valid: true, instant_first_payment: false, start_date: '2026-11-20',
      successful_invoice: true, send_customer_success_email: true, customer_failure_email: true, extra_info: ATT,
      items: [{ product_uid: PROD_PKG, quantity: 1, price: 30 }, { product_uid: PROD_SP, quantity: 1, price: 10 }] });
  });
  // Owner console 2026-10-25 (typed: "מאשר: מזהה המסוף כסוד ..."): a standing order bound by the server pull has no terminal - the
  // account terminal (PAYPLUS_TERMINAL_UID) is used; without one nothing is sent
  it('a standing order without its terminal uses the account terminal from the secret; none at all = not added, nothing sent', async () => {
    const fetch = vi.fn();
    for (const a of [answer(pkgOnly), answer(products), answer(products), answer({ recurring_payment_uid: REC })]) fetch.mockImplementationOnce(async () => a);
    const p = createPayPlusProvider({ ...config(fetch), terminalUid: TERM });
    expect(await p.addSmartPackLine!({ ...lineBegin, terminalRef: null } as never)).toBe('added');
    expect(JSON.parse((fetch.mock.calls[3] as unknown as [string, { body: string }])[1].body)).toMatchObject({ terminal_uid: TERM });
    const none = vi.fn();
    // Owner 2026-10-26 (item א2): no terminal at all = our configuration gap - retried ('unknown'), never a final refusal; nothing sent
    expect(await createPayPlusProvider(config(none)).addSmartPackLine!({ ...lineBegin, terminalRef: null } as never)).toBe('unknown');
    expect(none).not.toHaveBeenCalled();
    const env: Record<string, string> = { PAYPLUS_API_KEY: 'synthetic-api-key', PAYPLUS_SECRET_KEY: SECRET, PAYPLUS_PAYMENT_PAGE_UID: PAGE, PAYPLUS_ENVIRONMENT: 'production', PAYPLUS_TERMINAL_UID: 'not-a-uuid' };
    expect(payplusProviderFromSecrets((n) => env[n], 'https://project.supabase.co', vi.fn() as never, () => NOW)).not.toBeNull(); // a bad terminal never breaks checkout
  });
  it('the begin answer may carry no terminal (null), never a malformed one', async () => {
    const add = vi.fn(async () => 'added' as const);
    const s = { smartPackAddOnLineBegin: vi.fn(async () => ({ ...lineBegin, terminalRef: null })), smartPackAddOnLineFinish: vi.fn(async () => ({ ok: true })) } as never as BillingSql;
    expect(await completeSmartPackLine({ sql: s, provider: { addSmartPackLine: add } as never }, ADD)).toBe('added');
    expect((add.mock.calls[0] as unknown[])[0]).toMatchObject({ terminalRef: null });
    const bad = { smartPackAddOnLineBegin: vi.fn(async () => ({ ...lineBegin, terminalRef: 'x' })), smartPackAddOnLineFinish: vi.fn(async () => ({ ok: true })) } as never as BillingSql;
    expect(await completeSmartPackLine({ sql: bad, provider: { addSmartPackLine: add } as never }, ADD)).toBe('not_added');
  });
  it('an order that already carries both lines (a retry after a lost answer) is added without another Update', async () => {
    const { fetch, p } = run(answer(order([{ product_uid: PROD_PKG, quantity: 1, quantity_price_including_vat: 30 },
      { product_uid: PROD_SP, quantity: 1, quantity_price_including_vat: 10 }])));
    expect(await p.addSmartPackLine!(lineBegin as never)).toBe('added');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  // Owner 2026-10-26 (typed: "מאשר את תיקון קריאת הוראת הקבע לפי הסכום הכולל ..."): PayPlus answers the order without its lines
  it('an order read WITHOUT lines: its total stands for them - 30 = the package -> ONE Update with both catalog products; 40 = already added', async () => {
    const noLines = { ...pkgOnly, items: [] };
    const { fetch, p } = run(answer(noLines), answer(products), answer(products), answer({ recurring_payment_uid: REC }));
    expect(await p.addSmartPackLine!(lineBegin as never)).toBe('added');
    expect(JSON.parse((fetch.mock.calls[3] as unknown as [string, { body: string }])[1].body).items)
      .toEqual([{ product_uid: PROD_PKG, quantity: 1, price: 30 }, { product_uid: PROD_SP, quantity: 1, price: 10 }]);
    const done = run(answer({ ...noLines, amount: 40 }));
    expect(await done.p.addSmartPackLine!(lineBegin as never)).toBe('added');
    expect(done.fetch).toHaveBeenCalledTimes(1);
    expect(await run(answer({ ...noLines, amount: 25 })).p.addSmartPackLine!(lineBegin as never)).toBe('not_added');
    // no package product in the catalog for an order without lines = our gap, retried
    expect(await run(answer(noLines), answer(products), answer({ products: [{ uid: PROD_SP, name: PAYPLUS_SMART_PACK_ITEM_NAMES.month }] })).p.addSmartPackLine!(lineBegin as never)).toBe('unknown');
  });
  it('not_added: another standing order, an unexpected line, PayPlus said no; unknown: no answer, no SMART PACK product (our gap)', async () => {
    expect(await run(answer({ ...pkgOnly, uid: '9ab9e163-0000-4000-8000-0000000000ff' })).p.addSmartPackLine!(lineBegin as never)).toBe('not_added');
    // the cycle exactly as PayPlus holds it (an annual order never becomes monthly) and the order of OUR package attempt
    expect(await run(answer({ ...pkgOnly, recurring_range: 12 })).p.addSmartPackLine!(lineBegin as never)).toBe('not_added');
    expect(await run(answer({ ...pkgOnly, recurring_range: undefined })).p.addSmartPackLine!(lineBegin as never)).toBe('not_added');
    expect(await run(answer({ ...pkgOnly, extra_info: ADD })).p.addSmartPackLine!(lineBegin as never)).toBe('not_added');
    expect(await run(answer(order([{ product_uid: PROD_PKG, quantity: 1, quantity_price_including_vat: 25 }]))).p.addSmartPackLine!(lineBegin as never)).toBe('not_added');
    // Owner 2026-10-26 (item א2): a SMART PACK product missing from the catalog is retried, never a final refusal
    expect(await run(answer(pkgOnly), answer({ products: [] })).p.addSmartPackLine!(lineBegin as never)).toBe('unknown');
    expect(await run(answer(pkgOnly), answer(products), answer(products), answer({}, 'error')).p.addSmartPackLine!(lineBegin as never)).toBe('not_added');
    // no package product in the catalog: the order's own package line is sent back
    const noPkg = run(answer(pkgOnly), answer(products), answer({ products: [{ uid: PROD_SP, name: PAYPLUS_SMART_PACK_ITEM_NAMES.month }] }), answer({ recurring_payment_uid: REC }));
    expect(await noPkg.p.addSmartPackLine!(lineBegin as never)).toBe('added');
    expect(JSON.parse((noPkg.fetch.mock.calls[3] as unknown as [string, { body: string }])[1].body).items[0]).toMatchObject({ product_uid: PROD_PKG, price: 30 });
    expect(await run({ ok: false, json: async () => null }).p.addSmartPackLine!(lineBegin as never)).toBe('unknown');
    expect(await run(answer(pkgOnly), answer(products), answer(products), { ok: false, json: async () => { throw new Error('timeout'); } }).p.addSmartPackLine!(lineBegin as never)).toBe('unknown');
  });
});

describe('quote and intent (server amount only)', () => {
  const quote = { ok: true, market: 'IL', currency: 'ILS', amountMinor: 667, recurringMinor: 1000, period: 'month', periodEnd: '2026-11-20T10:00:00.000Z', daysLeft: 20 };
  it('the quote answers the server amount; a refusal keeps its code', async () => {
    const r = await smartPackAddOnQuoteHandler('enforced', { sql: { smartPackAddOnQuote: async () => quote } as never }, U);
    expect(r).toEqual({ status: 200, body: { ok: true, currency: 'ILS', amountMinor: 667, recurringMinor: 1000, period: 'month', periodEnd: quote.periodEnd, daysLeft: 20 } });
    expect((await smartPackAddOnQuoteHandler('enforced', { sql: { smartPackAddOnQuote: async () => ({ ok: false, code: 'already_included' }) } as never }, U)).body)
      .toEqual({ ok: false, code: 'already_included' });
    expect((await smartPackAddOnQuoteHandler('off', { sql: {} as never }, U)).status).toBe(503);
  });
  it('the intent opens the PayPlus page of the server row (a body amount is ignored), keeps it once with its request id', async () => {
    const createAddOnCheckout = vi.fn(async () => ({ redirectUrl: LINK, pageRequestUid: PRQ }));
    const sql = { createSmartPackAddOnIntent: vi.fn(async () => ({ ok: true, addOnId: ADD, market: 'IL', currency: 'ILS', amountMinor: 667, period: 'month', state: 'pending' })),
      smartPackAddOnPage: vi.fn(async () => null), recordSmartPackAddOnPage: vi.fn(async (_a: string, _u: string, url: string) => url),
      checkoutCustomer: async () => ({ name: 'עסק', email: 'biz@example.com' }) } as never as BillingSql;
    const r = await smartPackAddOnIntentHandler('enforced', { sql, provider: { name: 'payplus', createAddOnCheckout } as never }, U,
      { idempotencyKey: 'k'.repeat(24), amountMinor: 1 });
    expect(r).toEqual({ status: 200, body: { ok: true, addOnId: ADD, currency: 'ILS', amountMinor: 667, redirectUrl: LINK, state: 'pending' } });
    expect(createAddOnCheckout).toHaveBeenCalledWith({ addOnId: ADD, currency: 'ILS', amountMinor: 667, billingPeriod: 'month', customer: { name: 'עסק', email: 'biz@example.com' } });
    expect(sql.recordSmartPackAddOnPage).toHaveBeenCalledWith(ADD, U, LINK, PRQ);
    expect((await smartPackAddOnIntentHandler('enforced', { sql, provider: { createAddOnCheckout } as never }, U, { idempotencyKey: 'short' })).status).toBe(400);
  });
  it('a row already paid / expired opens no page; an existing page is answered again without a new one', async () => {
    const createAddOnCheckout = vi.fn();
    const row = (state: string) => ({ ok: true, addOnId: ADD, market: 'IL', currency: 'ILS', amountMinor: 667, period: 'month', state });
    const sql = (state: string, page: string | null) => ({ createSmartPackAddOnIntent: async () => row(state), smartPackAddOnPage: async () => page,
      recordSmartPackAddOnPage: vi.fn() }) as never as BillingSql;
    expect((await smartPackAddOnIntentHandler('enforced', { sql: sql('paid', null), provider: { createAddOnCheckout } as never }, U, { idempotencyKey: 'k'.repeat(24) })).body)
      .toEqual({ ok: false, code: 'checkout_not_pending' });
    expect((await smartPackAddOnIntentHandler('enforced', { sql: sql('pending', LINK), provider: { createAddOnCheckout } as never }, U, { idempotencyKey: 'k'.repeat(24) })).body)
      .toMatchObject({ ok: true, redirectUrl: LINK });
    expect(createAddOnCheckout).not.toHaveBeenCalled();
  });
});

describe('checkout_status also pulls the account\'s add-on pages and retries a line', () => {
  it('an approved pull of OUR add-on is recorded and its line added; a pull naming another add-on is never applied', async () => {
    const addSmartPackLine = vi.fn(async () => 'added' as const);
    const sql = { checkoutPullTargets: async () => [], recordCheckoutPull: vi.fn(),
      smartPackAddOnPullTargets: async () => [{ addOnId: ADD, requestRef: PRQ, amountMinor: 667, currency: 'ILS' }],
      recordSmartPackAddOnPull: vi.fn(async () => ({ ok: true, activated: true, lineNeeded: true, pulled: true })),
      smartPackAddOnLineBegin: vi.fn(async () => lineBegin), smartPackAddOnLineFinish: vi.fn(async () => ({ ok: true })),
      smartPackAddOnLineTargets: async () => [] } as never as BillingSql;
    const provider = { name: 'payplus', pullCheckout: vi.fn(), addSmartPackLine,
      pullAddOnCheckout: async () => ({ addOnId: ADD, amountMinor: 667, currency: 'ILS' as const, approved: true, payloadSha256: 'a'.repeat(64) }) } as never as BillingProvider;
    expect(await checkoutStatusHandler('enforced', { sql, provider }, U)).toEqual({ status: 200, body: { ok: true, activated: true, waiting: 0 } });
    expect(sql.recordSmartPackAddOnPull).toHaveBeenCalledWith({ addOnId: ADD, userId: U, providerAddOnId: ADD, paidAmountMinor: 667, paidCurrency: 'ILS', payloadSha256: 'a'.repeat(64) });
    expect(addSmartPackLine).toHaveBeenCalledTimes(1);
    const other = { ...provider, pullAddOnCheckout: async () => ({ addOnId: ATT, amountMinor: 667, currency: 'ILS' as const, approved: true, payloadSha256: 'a'.repeat(64) }) };
    (sql.recordSmartPackAddOnPull as ReturnType<typeof vi.fn>).mockClear();
    await checkoutStatusHandler('enforced', { sql, provider: other as never }, U);
    expect(sql.recordSmartPackAddOnPull).not.toHaveBeenCalled();
  });
  it('a paid add-on whose line was never added is tried again', async () => {
    const addSmartPackLine = vi.fn(async () => 'added' as const);
    const sql = { checkoutPullTargets: async () => [], recordCheckoutPull: vi.fn(), smartPackAddOnLineTargets: async () => [ADD],
      smartPackAddOnLineBegin: vi.fn(async () => lineBegin), smartPackAddOnLineFinish: vi.fn(async () => ({ ok: true })) } as never as BillingSql;
    await checkoutStatusHandler('enforced', { sql, provider: { name: 'payplus', pullCheckout: vi.fn(), addSmartPackLine } as never }, U);
    expect(sql.smartPackAddOnLineFinish).toHaveBeenCalledWith(ADD, true);
  });
});

describe('pullAddOnCheckout (PayPlus)', () => {
  it('approved only with status 000 and OUR add-on reference; the amount comes back for the SQL equality check', async () => {
    const fetch = vi.fn(async () => answer({ transaction: { status_code: '000', amount: 6.67, currency: 'ILS', more_info: `sp_${ADD}` } }));
    expect(await createPayPlusProvider(config(fetch)).pullAddOnCheckout!(PRQ)).toMatchObject({ addOnId: ADD, amountMinor: 667, currency: 'ILS', approved: true });
    const declined = vi.fn(async () => answer({ status_code: '051', amount: 6.67, currency_code: 'ILS', more_info: `sp_${ADD}` }));
    expect(await createPayPlusProvider(config(declined)).pullAddOnCheckout!(PRQ)).toMatchObject({ approved: false });
    const foreign = vi.fn(async () => answer({ status_code: '000', amount: 6.67, currency_code: 'ILS', more_info: ATT }));
    expect(await createPayPlusProvider(config(foreign)).pullAddOnCheckout!(PRQ)).toMatchObject({ addOnId: null, approved: false });
  });
});
