// admin-billing - the Owner's tools for Terms section 6 (migration 20261022300000; Owner console 2026-10-21): preview, stop the renewal,
// end early with a prorated refund, and resolve an interrupted action. Pure, dependency-injected (Deno + vitest); index.ts is wiring only.
//   * super_admin only; stop / end early / resolve also need a fresh re-auth proof (admin-reauth-verify) bound to their parameters -
//     the refund the Owner saw is the refund that runs, or SQL refuses (stale_preview).
//   * every amount comes from SQL (billing_admin_preview / begin); the client never sends one that is used.
//   * order: claim the proof -> begin (SQL records the action) -> PayPlus stops the standing order -> finish (SQL records the stop and
//     applies the end ONLY if the package is still the one computed) -> ONLY THEN, when SQL says a refund is due, PayPlus refunds the
//     exact recorded amount of the charge that paid the period -> record_refund. A refund is never sent before the end is recorded, so it
//     can never be sent twice; a refused / impossible refund is recorded for a manual refund in the PayPlus panel.
//   * an action interrupted after begin stays OPEN (SQL blocks every new action of the account) until the Owner resolves it from what
//     the PayPlus panel shows (resolve: stopped there or not; at least 5 minutes after it began).
//   * a refund is marked 'sending' in SQL BEFORE PayPlus is called: a refund owed is never lost - the preview shows it until PayPlus
//     confirmed it or the Owner confirms it from the PayPlus panel (settle_refund).
//   * INERT: billing is 'off' - SQL answers billing_off before anything is recorded and PayPlus is never called.
export type Resp = { status: number; body: Record<string, unknown> };
export type Kind = 'stop_renewal' | 'end_early';
export const PROOF_ACTIONS = Object.freeze({ stop_renewal: 'billing_stop_renewal', end_early: 'billing_end_early', resolve: 'billing_resolve',
  settle_refund: 'billing_settle_refund' } as const);
type RefundStatus = 'none' | 'refunded' | 'failed' | 'manual';

export interface AdminBillingDeps {
  isSuperAdmin(userId: string): Promise<boolean>;
  claimProof(a: { proofToken: unknown; actorUserId: string; action: string; targetUserId: string; params: unknown }): Promise<boolean>;
  preview(userId: string, waiveFee: boolean): Promise<Record<string, unknown>>;
  openAction(userId: string): Promise<Record<string, unknown> | null>;
  begin(a: { actorUserId: string; userId: string; kind: Kind; waiveFee: boolean; expectedRefundMinor: number; reason: string }): Promise<Record<string, unknown>>;
  finish(a: { actionId: string; cancelStatus: 'cancelled' | 'failed'; resolvedByOwner: boolean }): Promise<Record<string, unknown>>;
  refundSending(actionId: string): Promise<Record<string, unknown>>;
  recordRefund(a: { actionId: string; refundStatus: Exclude<RefundStatus, 'none'>; refundRef: string | null; refundedMinor: number | null }): Promise<Record<string, unknown>>;
  unsettledRefund(userId: string): Promise<Record<string, unknown> | null>;
  settleRefund(actionId: string, actorUserId: string): Promise<Record<string, unknown>>;
  /** null = the PayPlus secrets are not set (nothing can be stopped) */
  payplus: null | {
    terminalUid: string;
    /** 'unknown' = no readable answer (it may have stopped): the action stays open for the Owner (Codex audit 2026-10-22 H-02) */
    cancel(recurringUid: string, terminalUid: string): Promise<'cancelled' | 'rejected' | 'unknown'>;
    refund(transactionUid: string, amountMinor: number): Promise<{ ok: true; refundRef: string } | { ok: false }>;
  };
  audit(a: { actorUserId: string; targetUserId: string; action: string; reason: string | null; beforeState?: unknown; afterState?: unknown;
    outcome: 'success' | 'denied' | 'error' }): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (status: number, code: string, extra: Record<string, unknown> = {}): Resp => ({ status, body: { ok: false, code, ...extra } });
const PREVIEW_FIELDS = ['currency', 'paidMinor', 'period', 'periodStart', 'paidThrough', 'effectiveEnd', 'daysInPeriod', 'unusedDays',
  'proratedMinor', 'feeMinor', 'feeWaived', 'refundMinor', 'renewalStopped', 'hasStandingOrder', 'hasChargeRef'] as const;
const SQL_REFUSALS: Record<string, number> = { billing_off: 503, invalid_request: 400, forbidden: 403, lifetime_account: 409, no_live_package: 409,
  already_stopped: 409, already_ended: 409, no_standing_order: 409, action_in_progress: 409, stale_preview: 409, already_finished: 409,
  too_early_to_resolve: 409, no_unsettled_refund: 409,
  // L-22 (Owner 2026-10-28, "החזר בקירוב במסך, והודעה ברורה כשהתקופה הבאה כבר שולמה"): a later period already paid - the screen says so
  future_period_paid: 409 };
const refusal = (r: unknown): Resp => {
  const code = isObj(r) && typeof r.code === 'string' && r.code in SQL_REFUSALS ? r.code : 'retry_later';
  return err(SQL_REFUSALS[code] ?? 503, code, code === 'stale_preview' && isObj(r) && Number.isInteger(r.refundMinor) ? { refundMinor: r.refundMinor } : {});
};

/** finish -> (only when SQL says a refund is due) mark it sending -> refund -> record it. Never throws. */
async function settle(deps: AdminBillingDeps, actionId: string, cancelStatus: 'cancelled' | 'failed', resolvedByOwner: boolean) {
  let done: Record<string, unknown>;
  try { done = await deps.finish({ actionId, cancelStatus, resolvedByOwner }); } catch { done = { ok: false }; }
  if (!isObj(done) || done.ok !== true) return { recorded: false as const, done: isObj(done) ? done : {}, refundStatus: 'none' as RefundStatus };
  let refundStatus: RefundStatus = 'none';
  let refundRef: string | null = null;
  const refundMinor = Number.isInteger(done.refundMinor) ? (done.refundMinor as number) : 0;
  if (done.refundDue === true && refundMinor > 0) {
    // from here the refund owed is visible until it is confirmed (never lost on a crash / a lost answer)
    const sending = await deps.refundSending(actionId).catch(() => ({ ok: false }));
    if (!isObj(sending) || sending.ok !== true) {
      console.error(JSON.stringify({ fn: 'admin-billing', incident: 'refund_not_started' }));
      return { recorded: true as const, done, refundStatus: 'none' as RefundStatus };
    }
    if (deps.payplus && typeof done.chargeRef === 'string' && done.chargeRef) {
      const r = await deps.payplus.refund(done.chargeRef, refundMinor).catch(() => ({ ok: false as const }));
      if (r.ok) { refundStatus = 'refunded'; refundRef = r.refundRef; } else refundStatus = 'failed';
    } else {
      refundStatus = 'manual'; // the charge's transaction id (or the PayPlus secrets) unknown: refund it in the PayPlus panel
    }
    const rec = await deps.recordRefund({ actionId, refundStatus, refundRef, refundedMinor: refundStatus === 'refunded' ? refundMinor : null })
      .catch(() => ({ ok: false }));
    if (!isObj(rec) || rec.ok !== true) {
      console.error(JSON.stringify({ fn: 'admin-billing', incident: 'refund_not_recorded', refundStatus }));
    }
  }
  if (refundStatus === 'failed' || refundStatus === 'manual') {
    console.error(JSON.stringify({ fn: 'admin-billing', incident: 'refund_needs_owner', refundStatus }));
  }
  return { recorded: true as const, done, refundStatus };
}

export async function adminBillingHandler(deps: AdminBillingDeps, callerId: string, body: unknown): Promise<Resp> {
  if (typeof callerId !== 'string' || !UUID.test(callerId)) return err(401, 'not_authenticated');
  const b = isObj(body) ? body : {};
  const action = b.action;
  const target = b.targetUserId;
  const waiveFee = b.waiveFee ?? false;
  if (typeof target !== 'string' || !UUID.test(target) || typeof waiveFee !== 'boolean') return err(400, 'invalid_request');
  if (!(await deps.isSuperAdmin(callerId).catch(() => false))) return err(403, 'forbidden');

  if (action === 'preview') {
    let p: Record<string, unknown>; let open: Record<string, unknown> | null;
    let owed: Record<string, unknown> | null;
    try { [p, open, owed] = await Promise.all([deps.preview(target, waiveFee), deps.openAction(target), deps.unsettledRefund(target)]); }
    catch { return err(503, 'retry_later'); }
    const unsettledRefund = isObj(owed) ? { actionId: owed.actionId ?? null, refundMinor: owed.refundMinor ?? null, currency: owed.currency ?? null,
      state: owed.state ?? null, createdAt: owed.createdAt ?? null } : null;
    // an owed refund is shown even when there is nothing (left) to stop
    if (!isObj(p) || p.ok !== true) { const r = refusal(p); return { status: r.status, body: { ...r.body, unsettledRefund } }; }
    // the provider references stay on the server
    return { status: 200, body: { ok: true, ...Object.fromEntries(PREVIEW_FIELDS.map((k) => [k, p[k] ?? null])),
      openAction: isObj(open) ? { actionId: open.actionId ?? null, kind: open.kind ?? null, createdAt: open.createdAt ?? null } : null,
      unsettledRefund } };
  }

  const reason = typeof b.reason === 'string' ? b.reason.trim() : '';
  if (reason.length < 3 || reason.length > 500) return err(400, 'invalid_request');

  if (action === 'settle_refund') {
    // the Owner checked the PayPlus panel: the owed refund of this action was made there
    const actionId = b.actionId;
    if (typeof actionId !== 'string' || !UUID.test(actionId)) return err(400, 'invalid_request');
    if (!(await deps.claimProof({ proofToken: b.proofToken, actorUserId: callerId, action: PROOF_ACTIONS.settle_refund, targetUserId: target,
      params: { reason, actionId } }).catch(() => false))) return err(403, 'reauth_required');
    const owed = await deps.unsettledRefund(target).catch(() => null);
    if (!isObj(owed) || owed.actionId !== actionId) return err(409, 'no_unsettled_refund');
    const r = await deps.settleRefund(actionId, callerId).catch(() => ({ ok: false }));
    await deps.audit({ actorUserId: callerId, targetUserId: target, action: PROOF_ACTIONS.settle_refund, reason,
      afterState: { actionId, refundMinor: owed.refundMinor ?? null, currency: owed.currency ?? null, state: owed.state ?? null },
      outcome: isObj(r) && r.ok === true ? 'success' : 'error' });
    return isObj(r) && r.ok === true ? { status: 200, body: { ok: true, actionId, settled: true } } : refusal(r);
  }

  if (action === 'resolve') {
    // the Owner checked the PayPlus panel: was the standing order of the interrupted action stopped there?
    const actionId = b.actionId; const stopped = b.stoppedAtPayPlus;
    if (typeof actionId !== 'string' || !UUID.test(actionId) || typeof stopped !== 'boolean') return err(400, 'invalid_request');
    const params = { reason, actionId, stoppedAtPayPlus: stopped };
    if (!(await deps.claimProof({ proofToken: b.proofToken, actorUserId: callerId, action: PROOF_ACTIONS.resolve, targetUserId: target, params }).catch(() => false))) {
      return err(403, 'reauth_required');
    }
    const open = await deps.openAction(target).catch(() => null);
    if (!isObj(open) || open.actionId !== actionId) return err(409, 'no_open_action');
    const s = await settle(deps, actionId, stopped ? 'cancelled' : 'failed', true);
    const record = { actionId, kind: open.kind ?? null, cancelStatus: stopped ? 'cancelled' : 'failed', refundStatus: s.refundStatus,
      applied: s.done.applied === true, paidThrough: s.done.paidThrough ?? null };
    await deps.audit({ actorUserId: callerId, targetUserId: target, action: PROOF_ACTIONS.resolve, reason, afterState: record,
      outcome: s.recorded ? 'success' : 'error' });
    return s.recorded ? { status: 200, body: { ok: true, ...record } } : refusal(s.done);
  }

  if (action !== 'stop_renewal' && action !== 'end_early') return err(400, 'unknown_action');
  const kind = action as Kind;
  const expected = b.expectedRefundMinor;
  if (!Number.isInteger(expected) || (expected as number) < 0 || (kind === 'stop_renewal' && expected !== 0)) return err(400, 'invalid_request');
  const proofAction = PROOF_ACTIONS[kind];
  if (!deps.payplus) {
    await deps.audit({ actorUserId: callerId, targetUserId: target, action: proofAction, reason, outcome: 'denied' });
    return err(503, 'provider_unavailable');
  }
  const params = { reason, waiveFee, expectedRefundMinor: expected };
  if (!(await deps.claimProof({ proofToken: b.proofToken, actorUserId: callerId, action: proofAction, targetUserId: target, params }).catch(() => false))) {
    return err(403, 'reauth_required');
  }

  let begun: Record<string, unknown>;
  try {
    begun = await deps.begin({ actorUserId: callerId, userId: target, kind, waiveFee, expectedRefundMinor: expected as number, reason });
  } catch {
    await deps.audit({ actorUserId: callerId, targetUserId: target, action: proofAction, reason, outcome: 'error' });
    return err(503, 'retry_later');
  }
  if (!isObj(begun) || begun.ok !== true || typeof begun.actionId !== 'string' || !UUID.test(begun.actionId)) {
    await deps.audit({ actorUserId: callerId, targetUserId: target, action: proofAction, reason,
      beforeState: { code: isObj(begun) ? begun.code ?? null : null }, outcome: 'denied' });
    return refusal(begun);
  }

  // 1. the standing order (already stopped before = an early end of a stopped renewal: PayPlus is not asked again)
  let cancelStatus: 'cancelled' | 'failed' = 'failed';
  if (begun.alreadyStopped === true) {
    cancelStatus = 'cancelled';
  } else if (typeof begun.recurringRef === 'string') {
    const terminal = typeof begun.terminalRef === 'string' && UUID.test(begun.terminalRef) ? begun.terminalRef : deps.payplus.terminalUid;
    const outcome = await deps.payplus.cancel(begun.recurringRef, terminal).catch(() => 'unknown' as const);
    if (outcome !== 'cancelled' && outcome !== 'rejected') {
      // Codex audit 2026-10-22 H-02: a lost answer is never recorded as 'failed' - the action stays OPEN until the Owner checks the
      // PayPlus panel and resolves it (stopped there or not)
      await deps.audit({ actorUserId: callerId, targetUserId: target, action: proofAction, reason,
        afterState: { actionId: begun.actionId, kind, cancelStatus: 'unknown' }, outcome: 'error' });
      console.error(JSON.stringify({ fn: 'admin-billing', incident: 'cancel_outcome_unknown' }));
      return err(503, 'cancel_outcome_unknown', { actionId: begun.actionId });
    }
    cancelStatus = outcome === 'cancelled' ? 'cancelled' : 'failed';
  }
  // 2. record it; 3. refund only if SQL now says it is due
  const s = await settle(deps, begun.actionId, cancelStatus, false);
  const record = { actionId: begun.actionId, kind, cancelStatus, refundStatus: s.refundStatus,
    refundMinor: Number.isInteger(begun.refundMinor) ? begun.refundMinor : 0, currency: begun.currency ?? null,
    applied: s.done.applied === true, paidThrough: s.done.paidThrough ?? null };
  const success = s.recorded && record.applied && (s.refundStatus === 'none' || s.refundStatus === 'refunded');
  await deps.audit({ actorUserId: callerId, targetUserId: target, action: proofAction, reason, afterState: record, outcome: success ? 'success' : 'error' });
  if (!s.recorded) {
    // PayPlus may already have stopped it: the action stays OPEN - the Owner resolves it from the PayPlus panel (never silent)
    console.error(JSON.stringify({ fn: 'admin-billing', incident: 'finish_not_recorded', cancelStatus }));
    return err(503, 'finish_not_recorded', { cancelStatus, actionId: begun.actionId });
  }
  return { status: 200, body: { ok: true, ...record } };
}
