// billing-reconcile (night task 2026-10-23 item 10, local only): every difference between PayPlus and our records is named; nothing is
// guessed; a charge still waiting for its callback is not an alert yet.
import { describe, it, expect } from 'vitest';
import { normalizeProviderTx, reconcile, alertText, type ProviderTx, type OurCharge } from './lib.ts';

const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '22222222-2222-4222-8222-222222222222';
const tx = (o: Partial<ProviderTx>): ProviderTx => ({ uid: 'tx1', kind: 'charge', amountMinor: 3000, currency: 'ILS', at: '2026-11-01T10:00:00Z', moreInfo: A1, ...o });
const ours = (o: Partial<OurCharge>): OurCharge => ({ providerEventId: 'tx1', attemptId: A1, amountMinor: 3000, currency: 'ILS', at: '2026-11-01T10:00:00Z', ...o });
const W = { from: '2026-11-01T00:00:00Z', until: '2026-11-02T00:00:00Z' };

describe('normalize', () => {
  it('a PayPlus history row; an unreadable amount is not guessed', () => {
    expect(normalizeProviderTx({ uuid: 'u', created_at: '2026-11-01T10:00:00Z', information: { amount_by_currency: 3000, currency: { currency_code: 'ILS' }, more_info: A1, transaction_at: '2026-11-01T10:00:01Z' } }))
      .toEqual({ uid: 'u', kind: 'charge', amountMinor: 3000, currency: 'ILS', at: '2026-11-01T10:00:01Z', moreInfo: A1 });
    expect(normalizeProviderTx({ uuid: 'u', information: { amount_by_currency: '30.00' } })).toBeNull();
    expect(normalizeProviderTx({ uuid: 'u', created_at: '2026-11-01T10:00:00Z', information: { amount_by_currency: 3000, more_info: 'not-an-id' } })?.moreInfo).toBeNull();
  });
});

describe('reconcile', () => {
  it('the same transaction on both sides = matched; declines are counted', () => {
    const r = reconcile({ provider: [tx({}), tx({ uid: 'd', kind: 'declined' })], charges: [ours({})], refunds: [], ...W });
    expect(r).toMatchObject({ matched: 1, declined: 1, findings: [] });
    expect(alertText(r)).toBeNull();
  });
  it('linked by our attempt id when the event id differs', () => {
    expect(reconcile({ provider: [tx({ uid: 'other' })], charges: [ours({})], refunds: [], ...W }).matched).toBe(1);
  });
  it('a PayPlus charge we never recorded = UNLINKED (unless it is still within the callback grace)', () => {
    const r = reconcile({ provider: [tx({ uid: 'x', moreInfo: A2 }), tx({ uid: 'late', moreInfo: null, at: '2026-11-01T23:50:00Z' })], charges: [], refunds: [], ...W });
    expect(r.findings).toEqual([{ code: 'UNLINKED', uid: 'x', detail: { amountMinor: 3000, currency: 'ILS', at: '2026-11-01T10:00:00Z', attemptId: A2 } }]);
    expect(alertText(r)?.subject).toBe('התאמת תשלומים: 1 פריטים לבדיקה');
  });
  it('our recorded payment that PayPlus does not have = MISSING_AT_PROVIDER (only inside the window)', () => {
    const r = reconcile({ provider: [], charges: [ours({}), ours({ providerEventId: 'old', at: '2026-10-01T00:00:00Z' })], refunds: [], ...W });
    expect(r.findings.map((f) => [f.code, f.uid])).toEqual([['MISSING_AT_PROVIDER', 'tx1']]);
  });
  it('a different amount or currency = AMOUNT_MISMATCH; a refund we do not know = REFUND_UNRECORDED; the urgent ones first', () => {
    const r = reconcile({ provider: [tx({ uid: 'r1', kind: 'refund' }), tx({ amountMinor: 3060 })], charges: [ours({})], refunds: [], ...W });
    expect(r.findings.map((f) => f.code)).toEqual(['REFUND_UNRECORDED', 'AMOUNT_MISMATCH']);
    const lines = alertText(r)!.text.split('\n').filter((l) => l.startsWith('- '));
    expect(lines[0]).toContain('סכום או מטבע שונים');
    expect(reconcile({ provider: [tx({ uid: 'r1', kind: 'refund' })], charges: [], refunds: [{ transactionUid: 'r1', amountMinor: 3000 }], ...W }).findings).toEqual([]);
  });
});
