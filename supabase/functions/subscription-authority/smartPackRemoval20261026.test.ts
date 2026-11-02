// @vitest-environment node
// Owner console 2026-10-26 (typed: "מאשר הסרת חכם פלוס בשירות עצמי: בחודשי בסוף התקופה ששולמה בלי החזר, בשנתי לפי סעיף 6 ...";
// 20261027100000): the SMART PACK line comes off the standing order (ONE Update, the package line alone, the same cycle, from the next
// charge date); a yearly SMART PACK is refunded pro rata on the period charge. Mocks only - no key, no network, no DB.
import { describe, it, expect, vi } from 'vitest';
import { completeSmartPackRemoval, refundDueRemovals, smartPackRemovalQuoteHandler, smartPackRemovalRequestHandler, type BillingSql } from './billing';
import { createPayPlusProvider, PAYPLUS_API_BASES, PAYPLUS_ITEM_NAMES, type PayPlusConfig } from './payplus';

const U = '11111111-1111-4111-8111-111111111111';
const RM = '77777777-7777-4777-8777-777777777777';
const ATT = '22222222-2222-4222-8222-222222222222';
const PAGE = '33333333-3333-4333-8333-333333333333';
const REC = '9ab9e163-0000-4000-8000-000000000001'; const TERM = '66f01674-0000-4000-8000-000000000002';
const PROD_PKG = '386c8e7d-0000-4000-8000-000000000003';
const PRQ = '1a2aee2e-0000-4000-8000-000000000005';
const config = (fetch: unknown): PayPlusConfig => ({ apiBase: PAYPLUS_API_BASES.staging, apiKey: 'synthetic-api-key', secretKey: 'synthetic-secret-not-a-real-key-0123',
  paymentPageUid: PAGE, callbackUrl: 'https://project.supabase.co/functions/v1/subscription-authority/provider-event',
  successUrl: 'https://www.tekango.com/dashboard?billing=processing', failureUrl: 'https://www.tekango.com/dashboard?billing=failed',
  terminalUid: TERM, fetch: fetch as never, now: () => Date.parse('2026-10-26T15:00:00Z') });
const answer = (data: unknown, status = 'success') => ({ ok: true, json: async () => ({ results: { status, code: status === 'success' ? 0 : 1 }, data }) });
const raw = (v: unknown) => ({ ok: true, json: async () => v });
const run = (...answers: unknown[]) => {
  const fetch = vi.fn();
  for (const a of answers) fetch.mockImplementationOnce(async () => a);
  return { fetch, p: createPayPlusProvider(config(fetch)) };
};
const order = (amount: number, range = 1) => ({ uid: REC, valid: true, amount, currency_code: 'ILS', extra_info: ATT, recurring_type: 2, recurring_range: range,
  customer_uid: 'cust-1', cashier_uid: 'cash-1', card_token: 'tok-1', items: [] });
const products = [{ uuid: PROD_PKG, name: PAYPLUS_ITEM_NAMES.month, currency_code: 'ILS', valid: true }];
const req = { removalId: RM, packageAttemptId: ATT, recurringRef: REC, terminalRef: null, packageRequestRef: PRQ, packageAmountMinor: 3000, addOnAmountMinor: 1000,
  period: 'month' as const, currency: 'ILS' as const, nextChargeDate: '2026-11-25' };

describe('removeSmartPackLine (PayPlus)', () => {
  it('ONE Update: the same order and cycle, the package line alone (its catalog product, 30), from the next charge date, invoices kept on', async () => {
    const { fetch, p } = run(answer(order(40)), raw(products), answer({ recurring_payment_uid: REC }));
    expect(await p.removeSmartPackLine!(req)).toBe('removed');
    const body = JSON.parse((fetch.mock.calls[2] as unknown as [string, { body: string }])[1].body);
    expect((fetch.mock.calls[2] as unknown as [string])[0]).toBe(`${PAYPLUS_API_BASES.staging}/RecurringPayments/Update/${REC}`);
    expect(body).toMatchObject({ terminal_uid: TERM, recurring_type: 2, recurring_range: 1, start_date: '2026-11-25', valid: true, successful_invoice: true,
      extra_info: ATT, items: [{ product_uid: PROD_PKG, quantity: 1, price: 30 }] });
  });
  it('the order already at the package alone = removed (a retry after a lost answer), nothing sent', async () => {
    const { fetch, p } = run(answer(order(30)));
    expect(await p.removeSmartPackLine!(req)).toBe('removed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('a yearly order keeps its yearly cycle', async () => {
    const yearProducts = [{ uuid: PROD_PKG, name: PAYPLUS_ITEM_NAMES.year, currency_code: 'ILS', valid: true }];
    const { fetch, p } = run(answer(order(408, 12)), raw(yearProducts), answer({ recurring_payment_uid: REC }));
    expect(await p.removeSmartPackLine!({ ...req, period: 'year', packageAmountMinor: 30600, addOnAmountMinor: 10200 })).toBe('removed');
    expect(JSON.parse((fetch.mock.calls[2] as unknown as [string, { body: string }])[1].body)).toMatchObject({ recurring_range: 12, items: [{ price: 306 }] });
  });
  it('refused: another order, another total, PayPlus said no; unknown: no answer, no package product', async () => {
    expect(await run(answer({ ...order(40), uid: '9ab9e163-0000-4000-8000-0000000000ff' })).p.removeSmartPackLine!(req)).toBe('refused');
    expect(await run(answer(order(55))).p.removeSmartPackLine!(req)).toBe('refused');
    expect(await run(answer(order(40)), raw(products), answer({}, 'error')).p.removeSmartPackLine!(req)).toBe('refused');
    expect(await run({ ok: false, json: async () => null }).p.removeSmartPackLine!(req)).toBe('unknown');
    expect(await run(answer(order(40)), raw([])).p.removeSmartPackLine!(req)).toBe('unknown');
  });
});

describe('the removal on the server', () => {
  it('the quote: the period, the date it takes effect, the yearly refund only', async () => {
    const quote = { ok: true, period: 'month', currency: 'ILS', effectiveAt: '2026-11-25T15:48:24.917Z', refundMinor: 0, recurringMinor: 1000, feeMinor: 0 };
    expect((await smartPackRemovalQuoteHandler('enforced', { sql: { smartPackRemovalQuote: async () => quote } as never }, U)).body)
      .toEqual({ ok: true, period: 'month', effectiveAt: quote.effectiveAt, refundMinor: 0, recurringMinor: 1000, feeMinor: 0 });
    expect((await smartPackRemovalQuoteHandler('enforced', { sql: { smartPackRemovalQuote: async () => ({ ok: false, code: 'already_removed', effectiveAt: quote.effectiveAt }) } as never }, U)).body)
      .toEqual({ ok: false, code: 'already_removed', effectiveAt: quote.effectiveAt });
  });
  const begin = { ok: true, removalId: RM, packageAttemptId: ATT, recurringRef: REC, terminalRef: null, packageRequestRef: PRQ, currency: 'ILS', period: 'month',
    packageAmountMinor: 3000, addOnAmountMinor: 1000, nextChargeDate: '2026-11-25' };
  const sql = (extra = {}) => ({ smartPackRemovalBegin: vi.fn(async () => begin), smartPackRemovalFinish: vi.fn(async () => ({ ok: true })), ...extra }) as never as BillingSql;
  it('removed -> finish(true); refused -> finish(false); no answer -> nothing finished', async () => {
    let s = sql();
    expect(await completeSmartPackRemoval({ sql: s, provider: { removeSmartPackLine: async () => 'removed' } as never }, RM)).toBe('removed');
    expect(s.smartPackRemovalFinish).toHaveBeenCalledWith(RM, true);
    s = sql();
    expect(await completeSmartPackRemoval({ sql: s, provider: { removeSmartPackLine: async () => 'refused' } as never }, RM)).toBe('refused');
    expect(s.smartPackRemovalFinish).toHaveBeenCalledWith(RM, false);
    s = sql();
    expect(await completeSmartPackRemoval({ sql: s, provider: { removeSmartPackLine: async () => 'unknown' } as never }, RM)).toBe('unknown');
    expect(s.smartPackRemovalFinish).not.toHaveBeenCalled();
  });
  it('the request: only the idempotency key is read; the change is made at once and the answer says the state', async () => {
    const s = sql({ requestSmartPackRemoval: vi.fn(async () => ({ ok: true, removalId: RM, state: 'requested', effectiveAt: '2026-11-25T15:48:24.917Z', refundMinor: 0 })) });
    const r = await smartPackRemovalRequestHandler('enforced', { sql: s, provider: { removeSmartPackLine: async () => 'removed' } as never }, U, { idempotencyKey: 'rm-click-0000000001', amountMinor: 5 });
    expect(r.body).toEqual({ ok: true, state: 'removed', effectiveAt: '2026-11-25T15:48:24.917Z', refundMinor: 0, refundState: 'none' });
    expect(s.requestSmartPackRemoval).toHaveBeenCalledWith(U, 'rm-click-0000000001');
  });
  // 20261029000000 (Codex F01/F02): a shared claim - the first request wins, a second never refunds
  const refundSql = (over: Record<string, unknown> = {}) => {
    let state = 'due';
    return {
      smartPackRemovalRefundsDue: vi.fn(async () => (state === 'due' ? [{ removalId: RM, chargeRef: null, amountMinor: 2300 }] : [])),
      claimSmartPackRemovalRefund: vi.fn(async () => { if (state !== 'due') return { ok: false, code: 'not_due' }; state = 'sending'; return { ok: true, removalId: RM, chargeRef: 'tx-year', amountMinor: 2300 }; }),
      recordSmartPackRemovalRefund: vi.fn(async () => { if (state !== 'sending') return { ok: false }; state = 'refunded'; return { ok: true }; }),
      markSmartPackRemovalRefundUnknown: vi.fn(async () => { state = 'unknown'; return { ok: true }; }),
      state: () => state,
      ...over,
    };
  };
  it('section 6: a yearly refund due is claimed, refunded once on the period charge and recorded', async () => {
    const refund = vi.fn(async () => ({ ok: true as const, refundRef: 'rf-1' }));
    const s = refundSql();
    const made = await refundDueRemovals({ sql: s as never as BillingSql, provider: { refund } as never }, U);
    expect(made.get(RM)).toBe('refunded');
    expect(refund).toHaveBeenCalledWith('tx-year', 2300);
    expect(s.recordSmartPackRemovalRefund).toHaveBeenCalledWith(RM, 'rf-1');
  });
  it('two requests at once (two tabs, or the removal and a status refresh) refund once', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    const refund = vi.fn(async () => { await gate; return { ok: true as const, refundRef: 'rf-1' }; });
    const s = refundSql();
    const a = refundDueRemovals({ sql: s as never as BillingSql, provider: { refund } as never }, U);
    const b = refundDueRemovals({ sql: s as never as BillingSql, provider: { refund } as never }, U);
    release();
    await Promise.all([a, b]);
    expect(refund).toHaveBeenCalledTimes(1);
    expect(s.state()).toBe('refunded');
  });
  it('a refund PayPlus did not prove is left for the Owner and never sent again', async () => {
    const refund = vi.fn(async () => ({ ok: false as const }));
    const s = refundSql();
    expect((await refundDueRemovals({ sql: s as never as BillingSql, provider: { refund } as never }, U)).get(RM)).toBe('pending');
    expect(s.state()).toBe('unknown');
    await refundDueRemovals({ sql: s as never as BillingSql, provider: { refund } as never }, U);
    expect(refund).toHaveBeenCalledTimes(1);
  });
  it('a refund made but not recorded stays claimed and is never sent again', async () => {
    const refund = vi.fn(async () => ({ ok: true as const, refundRef: 'rf-1' }));
    const s = refundSql({ recordSmartPackRemovalRefund: vi.fn(async () => { throw new Error('db down'); }) });
    expect((await refundDueRemovals({ sql: s as never as BillingSql, provider: { refund } as never }, U)).get(RM)).toBe('pending');
    await refundDueRemovals({ sql: s as never as BillingSql, provider: { refund } as never }, U);
    expect(refund).toHaveBeenCalledTimes(1);
    expect(s.state()).toBe('sending');
  });
  it('no charge reference yet: nothing is sent, the refund stays owed', async () => {
    const refund = vi.fn();
    const s = refundSql({ claimSmartPackRemovalRefund: vi.fn(async () => ({ ok: false, code: 'no_charge_ref' })) });
    expect((await refundDueRemovals({ sql: s as never as BillingSql, provider: { refund } as never }, U)).get(RM)).toBe('pending');
    expect(refund).not.toHaveBeenCalled();
  });
  it('the request answers the refund state the screen may promise', async () => {
    const yearly = (refundState: string) => vi.fn(async () => ({ ok: true, removalId: RM, state: 'removed', effectiveAt: '2026-11-25T15:48:24.917Z', refundMinor: 2300, refundState }));
    const none = { smartPackRemovalRefundsDue: vi.fn(async () => []), claimSmartPackRemovalRefund: vi.fn(), recordSmartPackRemovalRefund: vi.fn(), markSmartPackRemovalRefundUnknown: vi.fn() };
    const done = await smartPackRemovalRequestHandler('enforced', { sql: sql({ ...none, requestSmartPackRemoval: yearly('refunded') }), provider: { refund: vi.fn() } as never }, U, { idempotencyKey: 'rm-click-0000000002' });
    expect(done.body.refundState).toBe('refunded');
    const owed = await smartPackRemovalRequestHandler('enforced', { sql: sql({ ...none, requestSmartPackRemoval: yearly('unknown') }), provider: { refund: vi.fn() } as never }, U, { idempotencyKey: 'rm-click-0000000003' });
    expect(owed.body.refundState).toBe('pending');
  });
});
