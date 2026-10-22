// billing-reconcile - the periodic payment reconciliation (Codex payments-prep audit 2026-10-22, "must before activation" item 2; night task
// 2026-10-23 item 10). LOCAL ONLY - not deployed, no table yet (docs/PAYMENTS_RECONCILIATION_PLAN_2026-10-23.md). Pure: it compares
// what PayPlus charged (TransactionReports/TransactionsHistory, normalized) with what our server recorded (verified provider events +
// paid periods + admin refunds) and names every difference an Owner must look at. Nothing here changes an account or a payment.
//   * a charge at PayPlus with no verified event of ours  = UNLINKED (money taken, no entitlement) - the most urgent alert;
//   * a verified event of ours with no charge at PayPlus  = MISSING_AT_PROVIDER (an entitlement without money);
//   * the same transaction with a different amount or currency = AMOUNT_MISMATCH;
//   * a refund at PayPlus that our admin refunds do not know = REFUND_UNRECORDED;
//   * declined / failed attempts are counted (information, not an alert).
// The link is the transaction uid (our provider_event_id) and, as a second key, our attempt id that we send as more_info.

export type ProviderTx = { uid: string; kind: 'charge' | 'refund' | 'declined'; amountMinor: number; currency: string; at: string; moreInfo: string | null };
export type OurCharge = { providerEventId: string; attemptId: string | null; amountMinor: number; currency: string; at: string };
export type OurRefund = { transactionUid: string; amountMinor: number };
export type Finding = { code: 'UNLINKED' | 'MISSING_AT_PROVIDER' | 'AMOUNT_MISMATCH' | 'REFUND_UNRECORDED'; uid: string; detail: Record<string, unknown> };
export type Reconciliation = { matched: number; declined: number; findings: Finding[]; window: { from: string; until: string } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One PayPlus TransactionsHistory row -> our shape. The amount is taken as minor units only when it is an integer (the documented
 *  example "amount_by_currency": 99000); anything unreadable returns null (counted as unreadable, never guessed). */
export function normalizeProviderTx(raw: unknown, kind: ProviderTx['kind'] = 'charge'): ProviderTx | null {
  const r = raw as Record<string, unknown>;
  const info = (r?.information ?? {}) as Record<string, unknown>;
  const uid = typeof r?.uuid === 'string' ? r.uuid : null;
  const amount = info.amount_by_currency;
  const currency = ((info.currency as Record<string, unknown>)?.currency_code ?? 'ILS') as string;
  const at = typeof info.transaction_at === 'string' ? info.transaction_at : typeof r?.created_at === 'string' ? r.created_at : null;
  if (!uid || !Number.isInteger(amount) || (amount as number) < 0 || !/^[A-Z]{3}$/.test(currency) || !at) return null;
  const more = typeof info.more_info === 'string' && UUID.test(info.more_info) ? info.more_info : null;
  return { uid, kind, amountMinor: amount as number, currency, at, moreInfo: more };
}

export function reconcile(a: { provider: ProviderTx[]; charges: OurCharge[]; refunds: OurRefund[]; from: string; until: string; graceMinutes?: number }): Reconciliation {
  const grace = (a.graceMinutes ?? 30) * 60000;
  const untilMs = Date.parse(a.until);
  const byUid = new Map(a.charges.map((c) => [c.providerEventId, c]));
  const byAttempt = new Map(a.charges.filter((c) => c.attemptId).map((c) => [c.attemptId as string, c]));
  const seen = new Set<string>();
  const refunded = new Set(a.refunds.map((r) => r.transactionUid));
  const findings: Finding[] = [];
  let matched = 0;
  let declined = 0;
  for (const t of a.provider) {
    if (t.kind === 'declined') { declined += 1; continue; }
    if (t.kind === 'refund') {
      if (!refunded.has(t.uid)) findings.push({ code: 'REFUND_UNRECORDED', uid: t.uid, detail: { amountMinor: t.amountMinor, currency: t.currency, at: t.at } });
      continue;
    }
    const ours = byUid.get(t.uid) ?? (t.moreInfo ? byAttempt.get(t.moreInfo) : undefined);
    if (!ours) {
      // a charge in the last minutes may still have its callback on the way - not an alert yet
      if (untilMs - Date.parse(t.at) < grace) continue;
      findings.push({ code: 'UNLINKED', uid: t.uid, detail: { amountMinor: t.amountMinor, currency: t.currency, at: t.at, attemptId: t.moreInfo } });
      continue;
    }
    seen.add(ours.providerEventId);
    if (ours.amountMinor !== t.amountMinor || ours.currency !== t.currency) {
      findings.push({ code: 'AMOUNT_MISMATCH', uid: t.uid, detail: { provider: { amountMinor: t.amountMinor, currency: t.currency }, ours: { amountMinor: ours.amountMinor, currency: ours.currency } } });
    } else matched += 1;
  }
  for (const c of a.charges) {
    if (seen.has(c.providerEventId)) continue;
    const at = Date.parse(c.at);
    if (at < Date.parse(a.from) || at > untilMs) continue;
    findings.push({ code: 'MISSING_AT_PROVIDER', uid: c.providerEventId, detail: { amountMinor: c.amountMinor, currency: c.currency, at: c.at, attemptId: c.attemptId } });
  }
  return { matched, declined, findings, window: { from: a.from, until: a.until } };
}

/** The Owner's alert text (Hebrew): only when there is something to look at; the most urgent first. */
export function alertText(r: Reconciliation): { subject: string; text: string } | null {
  if (!r.findings.length) return null;
  const order = ['UNLINKED', 'MISSING_AT_PROVIDER', 'AMOUNT_MISMATCH', 'REFUND_UNRECORDED'];
  const label: Record<string, string> = {
    UNLINKED: 'חיוב בפיי פלוס שלא נקשר למנוי (נגבה כסף ואין זכאות)', MISSING_AT_PROVIDER: 'תשלום שנרשם אצלנו ולא נמצא בפיי פלוס',
    AMOUNT_MISMATCH: 'סכום או מטבע שונים בין פיי פלוס לבינינו', REFUND_UNRECORDED: 'החזר בפיי פלוס שלא נרשם אצלנו',
  };
  const lines = [...r.findings].sort((x, y) => order.indexOf(x.code) - order.indexOf(y.code))
    .map((f) => `- ${label[f.code]}: עסקה ${f.uid}`);
  return { subject: `התאמת תשלומים: ${r.findings.length} פריטים לבדיקה`, text: [`בהתאמת התשלומים נמצאו ${r.findings.length} פריטים לבדיקה (התאימו: ${r.matched}, נדחו: ${r.declined}).`, '', ...lines].join('\n') };
}
