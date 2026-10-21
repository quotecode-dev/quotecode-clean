// @vitest-environment node
// admin-billing (migration 20261022300000; Owner console 2026-10-21): the Owner's stop-renewal / early-end + refund tools.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { adminBillingHandler, PROOF_ACTIONS, type AdminBillingDeps } from './lib';

const ADMIN = '99999999-9999-4999-8999-999999999999';
const U = '11111111-1111-4111-8111-111111111111';
const ACTION = '55555555-5555-4555-8555-555555555555';
const REC = '9ab9e163-0000-4000-8000-000000000001';
const TERM = '66f01674-0000-4000-8000-000000000002';
const OWN_TERM = '66f01674-0000-4000-8000-000000000003';

function deps(over: Partial<AdminBillingDeps> = {}, begun: Record<string, unknown> = {}, finished: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const d = {
    isSuperAdmin: vi.fn(async (id: string) => id === ADMIN),
    claimProof: vi.fn(async () => true),
    preview: vi.fn(async () => ({ ok: true, currency: 'ILS', paidMinor: 3000, period: 'month', refundMinor: 1000, feeMinor: 150,
      recurringRef: REC, terminalRef: TERM, chargeRef: 'tx-1' })),
    openAction: vi.fn(async () => null as Record<string, unknown> | null),
    begin: vi.fn(async () => ({ ok: true, actionId: ACTION, kind: 'end_early', alreadyStopped: false, recurringRef: REC, terminalRef: TERM,
      chargeRef: 'tx-1', refundMinor: 1000, currency: 'ILS', ...begun })),
    finish: vi.fn(async () => { calls.push('finish'); return { ok: true, applied: true, refundDue: true, refundMinor: 1000, chargeRef: 'tx-1',
      paidThrough: '2026-10-22T21:00:00Z', ...finished }; }),
    refundSending: vi.fn(async () => { calls.push('sending'); return { ok: true }; }),
    recordRefund: vi.fn(async () => ({ ok: true })),
    unsettledRefund: vi.fn(async () => null as Record<string, unknown> | null),
    settleRefund: vi.fn(async () => ({ ok: true })),
    payplus: { terminalUid: OWN_TERM, cancel: vi.fn(async () => { calls.push('cancel'); return 'cancelled' as 'cancelled' | 'rejected' | 'unknown'; }),
      refund: vi.fn(async () => { calls.push('refund'); return { ok: true as const, refundRef: 'refund-1' }; }) },
    audit: vi.fn(async () => {}),
    ...over,
  };
  return Object.assign(d as typeof d & AdminBillingDeps, { calls });
}
const endEarly = (extra: Record<string, unknown> = {}) => ({ action: 'end_early', targetUserId: U, reason: 'customer asked', waiveFee: false,
  expectedRefundMinor: 1000, proofToken: 'p', ...extra });

describe('admin-billing: who may act, what the client may send', () => {
  it('only a super admin; never an amount from the client', async () => {
    const d = deps();
    expect(await adminBillingHandler(d, U, endEarly())).toEqual({ status: 403, body: { ok: false, code: 'forbidden' } });
    expect((await adminBillingHandler(d, ADMIN, endEarly({ reason: 'x' }))).body.code).toBe('invalid_request');
    expect((await adminBillingHandler(d, ADMIN, endEarly({ expectedRefundMinor: 1.5 }))).body.code).toBe('invalid_request');
    expect((await adminBillingHandler(d, ADMIN, { ...endEarly(), action: 'stop_renewal', expectedRefundMinor: 5 })).body.code).toBe('invalid_request');
    expect(d.begin).not.toHaveBeenCalled();
  });
  it('the preview keeps the PayPlus references on the server and shows an open action', async () => {
    const d = deps({ openAction: vi.fn(async () => ({ actionId: ACTION, kind: 'stop_renewal', createdAt: '2026-10-21T20:00:00Z', currency: 'ILS' })) });
    const r = await adminBillingHandler(d, ADMIN, { action: 'preview', targetUserId: U, waiveFee: true });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, refundMinor: 1000, feeMinor: 150, openAction: { actionId: ACTION, kind: 'stop_renewal' } });
    for (const k of ['recurringRef', 'chargeRef', 'terminalRef']) expect(r.body).not.toHaveProperty(k);
  });
  it('the re-auth proof is bound to the reason, the fee choice and the exact refund the Owner saw', async () => {
    const d = deps();
    await adminBillingHandler(d, ADMIN, endEarly());
    expect(d.claimProof).toHaveBeenCalledWith(expect.objectContaining({ action: PROOF_ACTIONS.end_early, targetUserId: U,
      params: { reason: 'customer asked', waiveFee: false, expectedRefundMinor: 1000 } }));
    const refused = deps({ claimProof: vi.fn(async () => false) });
    expect((await adminBillingHandler(refused, ADMIN, endEarly())).body.code).toBe('reauth_required');
    expect(refused.begin).not.toHaveBeenCalled();
  });
  it('without the PayPlus secrets nothing is stopped (and the refusal is logged)', async () => {
    const d = deps({ payplus: null });
    expect((await adminBillingHandler(d, ADMIN, endEarly())).body.code).toBe('provider_unavailable');
    expect(d.claimProof).not.toHaveBeenCalled();
    expect(d.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'denied' }));
  });
  it('billing off / a stale preview / an open action: SQL refuses, PayPlus is never called', async () => {
    for (const code of ['billing_off', 'stale_preview', 'action_in_progress']) {
      const d = deps({ begin: vi.fn(async () => ({ ok: false, code, refundMinor: 999 })) });
      const r = await adminBillingHandler(d, ADMIN, endEarly());
      expect(r.body.code).toBe(code);
      if (code === 'stale_preview') expect(r.body.refundMinor).toBe(999);
      expect(d.payplus!.cancel).not.toHaveBeenCalled();
      expect(d.payplus!.refund).not.toHaveBeenCalled();
    }
  });
});

describe('admin-billing: stop, record, and only then refund the exact amount', () => {
  it('end early: stop (its own terminal) -> finish -> refund of the recorded charge by the SQL amount -> record it', async () => {
    const d = deps();
    const r = await adminBillingHandler(d, ADMIN, endEarly());
    expect(d.calls).toEqual(['cancel', 'finish', 'sending', 'refund']);
    expect(d.payplus!.cancel).toHaveBeenCalledWith(REC, TERM);
    expect(d.finish).toHaveBeenCalledWith({ actionId: ACTION, cancelStatus: 'cancelled', resolvedByOwner: false });
    expect(d.payplus!.refund).toHaveBeenCalledWith('tx-1', 1000);
    expect(d.recordRefund).toHaveBeenCalledWith({ actionId: ACTION, refundStatus: 'refunded', refundRef: 'refund-1', refundedMinor: 1000 });
    expect(r).toMatchObject({ status: 200, body: { ok: true, applied: true, refundStatus: 'refunded', refundMinor: 1000 } });
    expect(d.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'success', action: 'billing_end_early' }));
  });
  it('the package changed between begin and finish: SQL says no refund is due - none is sent', async () => {
    const d = deps({}, {}, { applied: false, refundDue: false });
    const r = await adminBillingHandler(d, ADMIN, endEarly());
    expect(d.payplus!.refund).not.toHaveBeenCalled();
    expect(d.recordRefund).not.toHaveBeenCalled();
    expect(r.body).toMatchObject({ ok: true, applied: false, refundStatus: 'none' });
    expect(d.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'error' }));
  });
  it('a standing order without its terminal uses the configured terminal', async () => {
    const d = deps({}, { terminalRef: null });
    await adminBillingHandler(d, ADMIN, endEarly());
    expect(d.payplus!.cancel).toHaveBeenCalledWith(REC, OWN_TERM);
  });
  it('PayPlus did not stop it: recorded as failed, no refund', async () => {
    const d = deps({}, {}, { applied: false, refundDue: false });
    d.payplus!.cancel = vi.fn(async () => 'rejected' as const);
    await adminBillingHandler(d, ADMIN, endEarly());
    expect(d.finish).toHaveBeenCalledWith(expect.objectContaining({ cancelStatus: 'failed' }));
    expect(d.payplus!.refund).not.toHaveBeenCalled();
  });
  it('Codex audit H-02: no answer from PayPlus - never recorded as failed; the action stays open for the Owner, no refund', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const cancel of [vi.fn(async () => 'unknown' as const), vi.fn(async () => { throw new Error('timeout'); })]) {
      const d = deps();
      d.payplus!.cancel = cancel as never;
      const r = await adminBillingHandler(d, ADMIN, endEarly());
      expect(r).toEqual({ status: 503, body: { ok: false, code: 'cancel_outcome_unknown', actionId: ACTION } });
      expect(d.finish).not.toHaveBeenCalled();
      expect(d.refundSending).not.toHaveBeenCalled();
      expect(d.payplus!.refund).not.toHaveBeenCalled();
      expect(d.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'error', afterState: expect.objectContaining({ cancelStatus: 'unknown' }) }));
    }
    expect(log.mock.calls.some((c) => String(c[0]).includes('cancel_outcome_unknown'))).toBe(true);
    log.mockRestore();
  });
  it('a refused refund / a charge without its transaction id: recorded for a manual refund (incident)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps();
    d.payplus!.refund = vi.fn(async () => ({ ok: false as const }));
    expect((await adminBillingHandler(d, ADMIN, endEarly())).body).toMatchObject({ refundStatus: 'failed' });
    expect(d.recordRefund).toHaveBeenCalledWith({ actionId: ACTION, refundStatus: 'failed', refundRef: null, refundedMinor: null });
    const m = deps({}, {}, { chargeRef: null });
    expect((await adminBillingHandler(m, ADMIN, endEarly())).body).toMatchObject({ refundStatus: 'manual' });
    expect(m.payplus!.refund).not.toHaveBeenCalled();
    expect(log.mock.calls.some((c) => String(c[0]).includes('refund_needs_owner'))).toBe(true);
    log.mockRestore();
  });
  it('an early end of an already stopped renewal never asks PayPlus to stop it again', async () => {
    const d = deps({}, { alreadyStopped: true });
    await adminBillingHandler(d, ADMIN, endEarly());
    expect(d.payplus!.cancel).not.toHaveBeenCalled();
    expect(d.payplus!.refund).toHaveBeenCalledWith('tx-1', 1000);
  });
  it('stop the renewal: no refund ever', async () => {
    const d = deps({}, { kind: 'stop_renewal', refundMinor: 0 }, { refundDue: false, refundMinor: 0 });
    const r = await adminBillingHandler(d, ADMIN, { ...endEarly(), action: 'stop_renewal', expectedRefundMinor: 0 });
    expect(d.payplus!.refund).not.toHaveBeenCalled();
    expect(r.body).toMatchObject({ ok: true, kind: 'stop_renewal', refundStatus: 'none' });
  });
  it('the stop could not be recorded after PayPlus acted: never a refund, the action stays open, never silent', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ finish: vi.fn(async () => { throw new Error('db'); }) });
    const r = await adminBillingHandler(d, ADMIN, endEarly());
    expect(d.payplus!.refund).not.toHaveBeenCalled();
    expect(r).toMatchObject({ status: 503, body: { code: 'finish_not_recorded', cancelStatus: 'cancelled', actionId: ACTION } });
    expect(log.mock.calls.some((c) => String(c[0]).includes('finish_not_recorded'))).toBe(true);
    log.mockRestore();
  });
});

describe('admin-billing: the Owner resolves an interrupted action', () => {
  const resolve = (extra: Record<string, unknown> = {}) => ({ action: 'resolve', targetUserId: U, reason: 'checked the PayPlus panel',
    actionId: ACTION, stoppedAtPayPlus: true, proofToken: 'p', ...extra });
  it('re-auth bound to the action and the answer; only the account\'s own open action; then the normal finish (+ refund if due)', async () => {
    const d = deps({ openAction: vi.fn(async () => ({ actionId: ACTION, kind: 'end_early' })) });
    const r = await adminBillingHandler(d, ADMIN, resolve());
    expect(d.claimProof).toHaveBeenCalledWith(expect.objectContaining({ action: PROOF_ACTIONS.resolve,
      params: { reason: 'checked the PayPlus panel', actionId: ACTION, stoppedAtPayPlus: true } }));
    expect(d.payplus!.cancel).not.toHaveBeenCalled();
    expect(d.finish).toHaveBeenCalledWith({ actionId: ACTION, cancelStatus: 'cancelled', resolvedByOwner: true });
    expect(d.payplus!.refund).toHaveBeenCalledWith('tx-1', 1000);
    expect(r.body).toMatchObject({ ok: true, applied: true, refundStatus: 'refunded' });
    const other = deps({ openAction: vi.fn(async () => ({ actionId: REC, kind: 'end_early' })) });
    expect((await adminBillingHandler(other, ADMIN, resolve())).body.code).toBe('no_open_action');
    expect(other.finish).not.toHaveBeenCalled();
  });
  it('not stopped at PayPlus: recorded as failed, nothing refunded', async () => {
    const d = deps({ openAction: vi.fn(async () => ({ actionId: ACTION, kind: 'stop_renewal' })) }, {}, { applied: false, refundDue: false });
    await adminBillingHandler(d, ADMIN, resolve({ stoppedAtPayPlus: false }));
    expect(d.finish).toHaveBeenCalledWith({ actionId: ACTION, cancelStatus: 'failed', resolvedByOwner: true });
    expect(d.payplus!.refund).not.toHaveBeenCalled();
  });
});

describe('admin-billing: a refund owed is never lost', () => {
  it('SQL refuses to mark it sending (e.g. already started): PayPlus is never asked to refund', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ refundSending: vi.fn(async () => ({ ok: false, code: 'refund_already_started' })) });
    const r = await adminBillingHandler(d, ADMIN, endEarly());
    expect(d.payplus!.refund).not.toHaveBeenCalled();
    expect(d.recordRefund).not.toHaveBeenCalled();
    expect(r.body).toMatchObject({ applied: true, refundStatus: 'none' });
    expect(log.mock.calls.some((c) => String(c[0]).includes('refund_not_started'))).toBe(true);
    log.mockRestore();
  });
  it('the preview shows an owed refund; the Owner confirms it from the PayPlus panel (re-auth bound to the action)', async () => {
    const owed = { actionId: ACTION, refundMinor: 1000, currency: 'ILS', state: 'sending', createdAt: '2026-10-21T20:00:00Z' };
    const d = deps({ unsettledRefund: vi.fn(async () => owed) });
    expect((await adminBillingHandler(d, ADMIN, { action: 'preview', targetUserId: U })).body).toMatchObject({ unsettledRefund: owed });
    const ended = deps({ unsettledRefund: vi.fn(async () => owed), preview: vi.fn(async () => ({ ok: false, code: 'no_live_package' })) });
    expect((await adminBillingHandler(ended, ADMIN, { action: 'preview', targetUserId: U })).body)
      .toMatchObject({ ok: false, code: 'no_live_package', unsettledRefund: owed });
    const r = await adminBillingHandler(d, ADMIN, { action: 'settle_refund', targetUserId: U, actionId: ACTION, reason: 'seen in the PayPlus panel', proofToken: 'p' });
    expect(d.claimProof).toHaveBeenCalledWith(expect.objectContaining({ action: PROOF_ACTIONS.settle_refund, params: { reason: 'seen in the PayPlus panel', actionId: ACTION } }));
    expect(d.settleRefund).toHaveBeenCalledWith(ACTION, ADMIN);
    expect(r.body).toMatchObject({ ok: true, settled: true });
    expect(d.payplus!.refund).not.toHaveBeenCalled();
    const none = deps();
    expect((await adminBillingHandler(none, ADMIN, { action: 'settle_refund', targetUserId: U, actionId: ACTION, reason: 'seen there', proofToken: 'p' })).body.code)
      .toBe('no_unsettled_refund');
    expect(none.settleRefund).not.toHaveBeenCalled();
  });
  it('a resolve too soon after the action began is refused by SQL (never racing the running request)', async () => {
    const d = deps({ openAction: vi.fn(async () => ({ actionId: ACTION, kind: 'end_early' })),
      finish: vi.fn(async () => ({ ok: false, code: 'too_early_to_resolve' })) });
    const r = await adminBillingHandler(d, ADMIN, { action: 'resolve', targetUserId: U, reason: 'checked the panel', actionId: ACTION, stoppedAtPayPlus: true, proofToken: 'p' });
    expect(r).toMatchObject({ status: 409, body: { code: 'too_early_to_resolve' } });
    expect(d.payplus!.refund).not.toHaveBeenCalled();
  });
});

describe('admin-billing: wiring', () => {
  it('the SQL parameters match the migration; the re-auth check allows exactly the new actions', () => {
    const wiring = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const sql = readFileSync(new URL('../../migrations/20261022300000_billing_admin_stop_and_refund.sql', import.meta.url), 'utf8');
    for (const fn of ['billing_admin_preview', 'billing_admin_begin', 'billing_admin_finish', 'billing_admin_record_refund', 'billing_admin_open_action',
      'billing_admin_refund_sending', 'billing_admin_unsettled_refund', 'billing_admin_settle_refund']) {
      const sent = [...(new RegExp(`rpc\\('${fn}', \\{([^}]*)\\}\\)`).exec(wiring)?.[1] ?? '').matchAll(/\b(p_[a-z0-9_]+):/g)].map((m) => m[1]);
      const declared = [...(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(([^)]*)\\)`).exec(sql)?.[1] ?? '').matchAll(/\b(p_[a-z0-9_]+)\s/g)].map((m) => m[1]);
      expect(sent.length).toBeGreaterThan(0);
      expect(sent).toEqual(declared);
    }
    const reauth = readFileSync(new URL('../admin-reauth-verify/index.ts', import.meta.url), 'utf8');
    for (const a of Object.values(PROOF_ACTIONS)) expect(reauth).toContain(`'${a}'`);
  });
});
