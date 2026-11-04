// Owner console 2026-11-04 (typed: "מאשר המשך חיוב מתחדש בלי חיוב מיידי מחלון המסלולים, כולל שינוי ב-L-01 ו-L-22, שחרור עד הלייב"): a
// stopped renewal resumes from the plans window - nothing charged on the PayPlus page, the standing order's first charge on the day the
// paid period ends (sandbox 2026-11-04: instant_first_payment false + jump_payments N). Migration 20261104100000 keeps the period.
import { describe, it, expect, vi } from 'vitest';
import { checkoutIntentHandler, checkoutStatusHandler, type BillingSql, type BillingProvider } from './billing';
import { buildGenerateLinkBody, createPayPlusProvider, resumeFreeDays, PAYPLUS_API_BASES, type PayPlusConfig } from './payplus';

const U = '11111111-1111-4111-8111-111111111111';
const ATT = '22222222-2222-4222-8222-222222222222';
const PAGE = '33333333-3333-4333-8333-333333333333';
const REQ = '44444444-4444-4444-8444-444444444444';
const KEY = 'k'.repeat(20);
const NOW = Date.parse('2026-11-04T21:00:00Z'); // 23:00 in Israel, 4/11
const LINK = 'https://payments.payplus.co.il/c2b8a6f0-0000-4000-8000-000000000001';
const PT = '2026-11-25T15:48:24.917Z'; // the paid period ends 25/11 (Israel)

function config(over: Partial<PayPlusConfig> = {}): PayPlusConfig {
  return {
    apiBase: PAYPLUS_API_BASES.staging, apiKey: 'synthetic-api-key', secretKey: 'synthetic-secret-not-a-real-key-0123', paymentPageUid: PAGE,
    callbackUrl: 'https://project.supabase.co/functions/v1/subscription-authority/provider-event',
    successUrl: 'https://www.tekango.com/dashboard?billing=processing', failureUrl: 'https://www.tekango.com/dashboard?billing=failed',
    fetch: vi.fn(async () => ({ ok: true, json: async () => ({ results: { status: 'success', code: 0 }, data: { page_request_uid: REQ, payment_page_link: LINK } }) })),
    now: () => NOW, ...over,
  } as PayPlusConfig;
}

describe('the PayPlus page of a resumed renewal', () => {
  it('the free days run to the Israel day the paid period ends (21 days from 4/11 to 25/11); a past / today date is refused', () => {
    expect(resumeFreeDays(NOW, Date.parse(PT))).toBe(21);
    expect(resumeFreeDays(NOW, Date.parse('2026-11-04T22:30:00Z'))).toBe(1); // 00:30 on 5/11 in Israel = tomorrow
    expect(resumeFreeDays(NOW, Date.parse('2026-11-04T21:30:00Z'))).toBeNull(); // 23:30 on 4/11 = today: never a page
    expect(resumeFreeDays(Date.parse('2026-11-04T10:00:00Z'), Date.parse('2026-11-05T10:00:00Z'))).toBe(1);
    expect(resumeFreeDays(NOW, NOW - 1)).toBeNull();
    expect(resumeFreeDays(NOW, Number.NaN)).toBeNull();
  });
  it('the body charges nothing now and starts the standing order on that day; an ordinary purchase is unchanged', () => {
    const resumed = buildGenerateLinkBody(config(), { attemptId: ATT, amountMinor: 3000, billingPeriod: 'month', nowMs: NOW, resumeFreeDays: 21 }) as never as { recurring_settings: Record<string, unknown>; amount: number };
    expect(resumed.recurring_settings).toMatchObject({ instant_first_payment: false, jump_payments: 21, recurring_type: 2, recurring_range: 1, number_of_charges: 0 });
    expect(resumed.amount).toBe(30);
    const bought = buildGenerateLinkBody(config(), { attemptId: ATT, amountMinor: 3000, billingPeriod: 'month', nowMs: NOW }) as never as { recurring_settings: Record<string, unknown> };
    expect(bought.recurring_settings.instant_first_payment).toBe(true);
    expect(bought.recurring_settings.jump_payments).toBeGreaterThanOrEqual(28);
  });
  it('the provider sends that body for a first charge date, and opens NO page for a date that is not a future Israel day', async () => {
    const cfg = config();
    const p = createPayPlusProvider(cfg);
    expect(await p.createCheckout({ attemptId: ATT, currency: 'ILS', amountMinor: 3000, billingPeriod: 'month', firstChargeAt: PT })).toMatchObject({ redirectUrl: LINK });
    const sent = JSON.parse((cfg.fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[0][1].body);
    expect(sent.recurring_settings).toMatchObject({ instant_first_payment: false, jump_payments: 21 });
    const cfg2 = config();
    expect(await createPayPlusProvider(cfg2).createCheckout({ attemptId: ATT, currency: 'ILS', amountMinor: 3000, billingPeriod: 'month', firstChargeAt: '2026-11-04T08:00:00Z' })).toBeNull();
    expect((cfg2.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });
});

describe('checkout_intent / checkout_status with a resume attempt', () => {
  const catalog = { ok: true, market: 'IL', prices: [
    { priceId: 'all_inclusive_month_ils', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'month', amountMinor: 3000, taxMode: 'included', offer: 'current' },
    { priceId: 'all_inclusive_year_ils', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'year', amountMinor: 30600, taxMode: 'included', offer: 'current' }] };
  const sqlWith = (firstChargeAt: unknown): BillingSql => ({
    createCheckoutIntent: vi.fn(),
    createPackageCheckoutIntent: vi.fn(async () => ({ ok: true, attemptId: ATT, market: 'IL', currency: 'ILS', amountMinor: 3000, state: 'pending', addOnPriceId: null, firstChargeAt })),
    priceCatalog: vi.fn(async () => catalog),
    checkoutPage: vi.fn(async () => null),
    recordCheckoutPageAndRequest: vi.fn(async (_a: string, _u: string, url: string) => url),
    recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
  } as unknown as BillingSql);
  it('the SQL first charge date reaches the provider and the answer says it is a resume', async () => {
    const createCheckout = vi.fn(async () => ({ redirectUrl: LINK, pageRequestUid: REQ }));
    const provider = { name: 'payplus', createCheckout, verifyWebhook: vi.fn() } as unknown as BillingProvider;
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const r = await checkoutIntentHandler('enforced', { sql: sqlWith(future), provider }, U, { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: KEY });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, resume: true, firstChargeAt: future, amountMinor: 3000 });
    expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({ firstChargeAt: future, billingPeriod: 'month' }));
  });
  it('an ordinary purchase carries no first charge date; a past / malformed one opens no page', async () => {
    const createCheckout = vi.fn(async () => ({ redirectUrl: LINK, pageRequestUid: REQ }));
    const provider = { name: 'payplus', createCheckout, verifyWebhook: vi.fn() } as unknown as BillingProvider;
    const ok = await checkoutIntentHandler('enforced', { sql: sqlWith(null), provider }, U, { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: KEY });
    expect(ok.body).not.toHaveProperty('resume');
    expect(createCheckout.mock.calls[0][0]).not.toHaveProperty('firstChargeAt');
    for (const bad of [new Date(Date.now() - 1000).toISOString(), 'soon', 42]) {
      const r = await checkoutIntentHandler('enforced', { sql: sqlWith(bad), provider }, U, { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: KEY });
      expect(r).toEqual({ status: 503, body: { ok: false, code: 'checkout_unavailable' } });
    }
    expect(createCheckout).toHaveBeenCalledTimes(1);
  });
  it('the pull of a resumed page answers resumed (never activated) and is not an incident', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sql = { checkoutPullTargets: vi.fn(async () => [{ attemptId: ATT, requestRef: REQ, amountMinor: 3000, currency: 'ILS' }]),
      recordCheckoutPull: vi.fn(async () => ({ ok: true, pulled: true, activated: false, resumed: true })) } as unknown as BillingSql;
    const provider = { name: 'payplus', createCheckout: vi.fn(), verifyWebhook: vi.fn(),
      pullCheckout: vi.fn(async () => ({ attemptId: ATT, recurringRef: 'S4xcM', amountMinor: 3000, currency: 'ILS', approved: true, payloadSha256: 'a'.repeat(64) })) } as unknown as BillingProvider;
    const r = await checkoutStatusHandler('enforced', { sql, provider }, U);
    expect(r.body).toEqual({ ok: true, activated: false, waiting: 0, resumed: true });
    expect(errors.mock.calls.some((c) => String(c[0]).includes('payment_not_activated'))).toBe(false);
    errors.mockRestore();
  });
});
