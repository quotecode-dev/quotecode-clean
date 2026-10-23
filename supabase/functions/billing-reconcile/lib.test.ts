// billing-reconcile (Owner console 2026-10-23, typed approval of the daily payment reconciliation): every difference between PayPlus and our
// records is named; nothing is guessed - the amount unit comes from the linked transactions, an unknown type code only counts; a charge
// still waiting for its callback is not an alert yet; one site run a day; the Owner is mailed only about NEW findings of the site run.
import { describe, it, expect, vi } from 'vitest';
import { normalizeProviderTx, reconcile, detectScale, alertText, historyBody, readHistory, reconcileHandler, israelDay,
  type ProviderTx, type OurCharge, type ReconcileDeps, type Finding } from './lib.ts';

const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '22222222-2222-4222-8222-222222222222';
const tx = (o: Partial<ProviderTx>): ProviderTx => ({ uid: 'tx1', type: '01', kind: 'charge', amount: 3000, currency: 'ILS', at: '2026-11-01T10:00:00.000Z', moreInfo: A1, ...o });
const ours = (o: Partial<OurCharge>): OurCharge => ({ providerEventId: 'tx1', attemptId: A1, amountMinor: 3000, currency: 'ILS', at: '2026-11-01T10:00:00.000Z', ...o });
const W = { from: '2026-11-01T00:00:00.000Z', until: '2026-11-02T00:00:00.000Z' };
const row = (o: Record<string, unknown> = {}, info: Record<string, unknown> = {}) => ({ uuid: 'tx1', transaction_type: '01', created_at: '2026-11-01T10:00:01Z',
  information: { amount_by_currency: 99000, currency: { currency_code: 'ILS' }, transaction_at: '2026-11-01T10:00:00Z', more_info: A1, ...info }, ...o });

describe('normalize a PayPlus history row', () => {
  it('reads the documented fields', () => {
    expect(normalizeProviderTx(row())).toEqual({ uid: 'tx1', type: '01', kind: 'charge', amount: 99000, currency: 'ILS', at: '2026-11-01T10:00:00.000Z', moreInfo: A1 });
  });
  it('a refund code is a refund, any other code only "other"; a non-uuid more_info is no link', () => {
    expect(normalizeProviderTx(row({ transaction_type: '03' }))?.kind).toBe('refund');
    expect(normalizeProviderTx(row({ transaction_type: '02' }))?.kind).toBe('other');
    expect(normalizeProviderTx(row({}, { more_info: 'test1' }))?.moreInfo).toBe(null);
  });
  it('an unreadable row is null - never guessed', () => {
    for (const bad of [null, 'x', row({ uuid: '' }), row({ transaction_type: '' }), row({}, { amount_by_currency: -1 }), row({}, { amount_by_currency: 'ten' }),
      row({}, { currency: { currency_code: 'shekel' } }), row({ created_at: null }, { transaction_at: 'not a date' })]) {
      expect(normalizeProviderTx(bad)).toBe(null);
    }
  });
});

describe('the amount unit comes from the linked transactions', () => {
  it('minor, major or unknown', () => {
    expect(detectScale([tx({ amount: 3000 })], [ours({})])).toBe('minor');
    expect(detectScale([tx({ amount: 30 })], [ours({})])).toBe('major');
    expect(detectScale([tx({ uid: 'other', amount: 30 })], [ours({})])).toBe('unknown');
  });
});

describe('reconcile', () => {
  it('a linked charge with the same amount matches (by uid, or by our attempt id)', () => {
    expect(reconcile({ provider: [tx({})], charges: [ours({})], refunds: [], ...W })).toMatchObject({ matched: 1, findings: [], scale: 'minor' });
    const byAttempt = reconcile({ provider: [tx({ uid: 'tx-other', amount: 30 }), tx({ uid: 'tx1', amount: 30 })], charges: [ours({}), ours({ providerEventId: 'p2', attemptId: A2 })], refunds: [], ...W });
    expect(byAttempt.scale).toBe('major');
  });
  it('money at PayPlus without our event = UNLINKED; inside the 30-minute grace = not yet', () => {
    const r = reconcile({ provider: [tx({ uid: 'tx9', moreInfo: null }), tx({ uid: 'tx10', moreInfo: null, at: '2026-11-01T23:45:00.000Z' })], charges: [], refunds: [], ...W });
    expect(r.findings.map((f) => [f.code, f.uid])).toEqual([['UNLINKED', 'tx9']]);
  });
  it('our charge that PayPlus does not list = MISSING_AT_PROVIDER (only inside the window)', () => {
    const r = reconcile({ provider: [], charges: [ours({}), ours({ providerEventId: 'old', at: '2026-10-20T00:00:00.000Z' })], refunds: [], ...W });
    expect(r.findings.map((f) => [f.code, f.uid])).toEqual([['MISSING_AT_PROVIDER', 'tx1']]);
  });
  it('a different amount or currency = AMOUNT_MISMATCH, in the detected unit', () => {
    const r = reconcile({ provider: [tx({ amount: 3000 }), tx({ uid: 'tx2', amount: 2900, moreInfo: A2 })], charges: [ours({}), ours({ providerEventId: 'tx2', attemptId: A2 })], refunds: [], ...W });
    expect(r.matched).toBe(1);
    expect(r.findings.map((f) => f.code)).toEqual(['AMOUNT_MISMATCH']);
    const cur = reconcile({ provider: [tx({ currency: 'USD' })], charges: [ours({})], refunds: [], ...W });
    expect(cur.findings[0].code).toBe('AMOUNT_MISMATCH');
  });
  it('with an unknown unit amounts are not compared (no false alert), the currency still is', () => {
    const r = reconcile({ provider: [tx({ amount: 12345 })], charges: [ours({})], refunds: [], ...W });
    expect(r.scale).toBe('unknown');
    expect(r.findings).toEqual([]);
  });
  it('a refund we do not know = REFUND_UNRECORDED; a known one is fine; an unknown type code only counts', () => {
    const r = reconcile({ provider: [tx({ uid: 'rf1', type: '03', kind: 'refund' }), tx({ uid: 'rf2', type: '03', kind: 'refund' }), tx({ uid: 'x', type: '07', kind: 'other' })],
      charges: [], refunds: [{ transactionUid: 'rf1' }], ...W });
    expect(r.findings.map((f) => [f.code, f.uid])).toEqual([['REFUND_UNRECORDED', 'rf2']]);
    expect(r.types).toEqual({ '03': 2, '07': 1 });
  });
});

describe('the Owner email', () => {
  it('only new findings, the most urgent first; nothing new = no email', () => {
    expect(alertText([], 3, 'https://www.tekango.com')).toBe(null);
    const m = alertText([{ code: 'REFUND_UNRECORDED', uid: 'r', detail: {} }, { code: 'UNLINKED', uid: 'u', detail: {} }], 2, 'https://www.tekango.com');
    expect(m?.subject).toBe('התאמת תשלומים: 2 פריטים חדשים לבדיקה');
    expect(m?.text.indexOf('עסקה u')).toBeLessThan(m?.text.indexOf('עסקה r') as number);
    expect(m?.text).toContain('https://www.tekango.com/dashboard');
  });
});

describe('the PayPlus read', () => {
  it('the body: terminal, Israel dates, currency, pages of 500', () => {
    expect(historyBody('term', new Date('2026-10-31T22:30:00Z'), new Date('2026-11-02T10:00:00Z'), 'USD', 500))
      .toEqual({ terminal_uid: 'term', filter: { fromDate: '2026-11-01', untilDate: '2026-11-02', currency_code: 'USD' }, skip: '500', take: '500' });
  });
  const cfg = { apiBase: 'https://restapi.payplus.co.il/api/v1.0', apiKey: 'k', secretKey: 's', terminalUid: 't' };
  it('reads every page and sends the keys only as headers', async () => {
    const page = (n: number) => Array.from({ length: n }, (_, i) => ({ uuid: `u${i}` }));
    const f = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ transactions: page(500), pages: 2 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ transactions: page(3), pages: 2 })));
    const r = await readHistory(f, cfg, new Date(), new Date(), 'ILS');
    expect(r).toMatchObject({ ok: true });
    expect((r as { rows: unknown[] }).rows.length).toBe(503);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://restapi.payplus.co.il/api/v1.0/TransactionReports/TransactionsHistory');
    expect(init.headers).toMatchObject({ 'api-key': 'k', 'secret-key': 's' });
    expect(String(init.body)).not.toContain('"k"');
  });
  it('a refused or strange answer is a failed read with its code, never an empty list', async () => {
    expect(await readHistory(vi.fn().mockResolvedValue(new Response('{}', { status: 400 })), cfg, new Date(), new Date(), 'ILS')).toEqual({ ok: false, code: 'provider_400' });
    expect(await readHistory(vi.fn().mockResolvedValue(new Response('{}')), cfg, new Date(), new Date(), 'ILS')).toEqual({ ok: false, code: 'provider_unexpected_answer' });
    expect(await readHistory(vi.fn().mockRejectedValue(new Error('net')), cfg, new Date(), new Date(), 'ILS')).toEqual({ ok: false, code: 'provider_unreachable' });
  });
});

describe('one run', () => {
  const NOW = new Date('2026-11-02T04:00:00Z');
  const deps = (o: Partial<ReconcileDeps> = {}) => {
    const d = {
      caller: vi.fn(async () => 'cron' as const),
      now: () => NOW,
      config: () => ({ apiBase: 'b', apiKey: 'k', secretKey: 's', terminalUid: 't' }),
      claimRun: vi.fn(async () => 'run-1'),
      finishRun: vi.fn(async () => {}),
      source: vi.fn(async () => ({ charges: [ours({})], refunds: [] })),
      history: vi.fn(async (_c: unknown, _f: Date, _u: Date, cur: string) => ({ ok: true as const, rows: cur === 'ILS' ? [row(), row({ uuid: 'tx9' }, { more_info: 'x' }), { junk: 1 }] : [row()] })),
      saveFindings: vi.fn(async (_r: string, f: Finding[]) => f),
      mailOwner: vi.fn(async () => true),
      markMailed: vi.fn(async () => {}),
      ...o,
    };
    return d;
  };
  it('the site run: reads both currencies, counts a transaction once, keeps the findings, mails the new ones', async () => {
    const d = deps();
    const r = await reconcileHandler({ action: 'run' }, d as unknown as ReconcileDeps, 'https://www.tekango.com');
    expect(r.body).toMatchObject({ ok: true, status: 'ok', provider: 2, newFindings: 1, unreadable: 1, mailed: true });
    expect(d.claimRun).toHaveBeenCalledWith(israelDay(NOW), 'cron');
    expect(d.history.mock.calls.map((c) => c[3])).toEqual(['ILS', 'USD']);
    expect(d.finishRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'ok', providerCount: 2, oursCount: 1, newFindings: 1, types: { '01': 2, unreadable: 1 } }));
    expect(d.markMailed).toHaveBeenCalledWith('run-1');
  });
  it('the Owner\'s run is not mailed; no caller = 401; a second site run the same day does nothing', async () => {
    const admin = deps({ caller: vi.fn(async () => 'admin' as const) });
    expect((await reconcileHandler({ action: 'run' }, admin as unknown as ReconcileDeps, 'x')).body).toMatchObject({ mailed: false });
    expect(admin.mailOwner).not.toHaveBeenCalled();
    expect((await reconcileHandler({ action: 'run' }, deps({ caller: vi.fn(async () => null) }) as unknown as ReconcileDeps, 'x')).status).toBe(401);
    const again = deps({ claimRun: vi.fn(async () => null) });
    expect((await reconcileHandler({ action: 'run' }, again as unknown as ReconcileDeps, 'x')).body).toMatchObject({ status: 'already_ran_today' });
    expect(again.history).not.toHaveBeenCalled();
  });
  it('no PayPlus read secrets = not configured, recorded; a refused read = failed with its code, nothing compared', async () => {
    const nc = deps({ config: () => null });
    expect((await reconcileHandler({ action: 'run' }, nc as unknown as ReconcileDeps, 'x')).body).toMatchObject({ status: 'not_configured' });
    expect(nc.finishRun).toHaveBeenCalledWith('run-1', { status: 'not_configured', errorCode: 'payplus_read_not_configured' });
    const fail = deps({ history: vi.fn(async () => ({ ok: false as const, code: 'provider_400' })) });
    expect((await reconcileHandler({ action: 'run' }, fail as unknown as ReconcileDeps, 'x')).body).toMatchObject({ ok: false, code: 'provider_400' });
    expect(fail.source).not.toHaveBeenCalled();
    expect(fail.saveFindings).not.toHaveBeenCalled();
  });
  it('anything but action "run" is refused', async () => {
    expect((await reconcileHandler({ action: 'delete' }, deps() as unknown as ReconcileDeps, 'x')).status).toBe(400);
  });
});

describe('a run that breaks half-way', () => {
  it('is recorded as failed, never left running', async () => {
    const finishRun = vi.fn(async () => {});
    const d = { caller: async () => 'admin' as const, now: () => new Date('2026-11-02T04:00:00Z'), config: () => ({ apiBase: 'b', apiKey: 'k', secretKey: 's', terminalUid: 't' }),
      claimRun: async () => 'run-9', finishRun, source: async () => { throw new Error('database'); },
      history: async () => ({ ok: true as const, rows: [] }), saveFindings: async () => [], mailOwner: async () => true, markMailed: async () => {} };
    await expect(reconcileHandler({ action: 'run' }, d as unknown as ReconcileDeps, 'x')).rejects.toThrow('database');
    expect(finishRun).toHaveBeenCalledWith('run-9', { status: 'failed', errorCode: 'internal' });
  });
});
