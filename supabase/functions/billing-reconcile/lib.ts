// billing-reconcile - the daily payment reconciliation (Owner console 2026-10-23, typed approval of "... התאמת תשלומים יומית עם מסך
// בניהול"; Codex payments-prep audit 2026-10-22 item 2; docs/PAYMENTS_RECONCILIATION_PLAN_2026-10-23.md). Pure: it compares what PayPlus
// lists (TransactionReports/TransactionsHistory, normalized) with what our server recorded (billing_reconcile_source: verified charges
// that gave an entitlement + refunds we know) and names every difference the Owner must look at. Nothing here changes an account or a
// payment.
//   * a charge at PayPlus with no verified event of ours  = UNLINKED (money taken, no entitlement) - the most urgent alert;
//   * a verified charge of ours that PayPlus does not list = MISSING_AT_PROVIDER (an entitlement without money);
//   * the same transaction with a different amount or currency = AMOUNT_MISMATCH;
//   * a refund at PayPlus that we do not know = REFUND_UNRECORDED.
// The link is the transaction uid (our provider_event_id) and, as a second key, our attempt id that we send as more_info.
// What the PayPlus documentation leaves open is decided from the data, never guessed:
//   * the amount unit of amount_by_currency (the example 99000 has no unit): the transactions that link to ours by uid decide it -
//     agorot / cents ('minor') or shekels / dollars ('major'); with no linked transaction amounts are not compared ('unknown');
//   * the transaction type codes: only the documented charge code ('01') raises UNLINKED; a known refund code raises REFUND_UNRECORDED;
//     every other code is only counted (types), so an unknown code never makes a false alert.

export type ProviderTx = { uid: string; type: string; kind: 'charge' | 'refund' | 'other'; amount: number; currency: string; at: string; moreInfo: string | null };
export type OurCharge = { providerEventId: string; attemptId: string | null; amountMinor: number; currency: string; at: string };
export type OurRefund = { transactionUid: string };
export type FindingCode = 'UNLINKED' | 'MISSING_AT_PROVIDER' | 'AMOUNT_MISMATCH' | 'REFUND_UNRECORDED';
export type Finding = { code: FindingCode; uid: string; detail: Record<string, unknown> };
export type Scale = 'minor' | 'major' | 'unknown';
export type Reconciliation = { matched: number; findings: Finding[]; scale: Scale; types: Record<string, number> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CHARGE_TYPES = Object.freeze(['01', '1']);
export const REFUND_TYPES = Object.freeze(['03', '3']);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** One TransactionsHistory row -> our shape, or null when it cannot be read (counted as unreadable, never guessed). */
export function normalizeProviderTx(raw: unknown): ProviderTx | null {
  if (!isObj(raw)) return null;
  const info = isObj(raw.information) ? raw.information : {};
  const uid = typeof raw.uuid === 'string' && raw.uuid.trim() ? raw.uuid.trim() : null;
  const type = typeof raw.transaction_type === 'string' || typeof raw.transaction_type === 'number' ? String(raw.transaction_type).trim() : '';
  const a = info.amount_by_currency;
  const amount = typeof a === 'number' ? a : typeof a === 'string' && /^\d{1,12}(\.\d{1,2})?$/.test(a.trim()) ? Number(a.trim()) : NaN;
  const currency = isObj(info.currency) && typeof info.currency.currency_code === 'string' ? info.currency.currency_code.trim().toUpperCase() : '';
  const at = typeof info.transaction_at === 'string' ? info.transaction_at : typeof raw.created_at === 'string' ? raw.created_at : null;
  if (!uid || uid.length > 200 || !type || !Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency) || !at || !Number.isFinite(Date.parse(at))) return null;
  const more = typeof info.more_info === 'string' && UUID.test(info.more_info.trim()) ? info.more_info.trim() : null;
  const kind = CHARGE_TYPES.includes(type) ? 'charge' : REFUND_TYPES.includes(type) ? 'refund' : 'other';
  return { uid, type, kind, amount, currency, at: new Date(Date.parse(at)).toISOString(), moreInfo: more };
}

const toMinor = (amount: number, scale: Scale) => (scale === 'major' ? Math.round(amount * 100) : amount);

/** the amount unit, from the charges that link to ours by uid: the unit most of them agree with (ties / none -> unknown) */
export function detectScale(provider: ProviderTx[], charges: OurCharge[]): Scale {
  const byUid = new Map(charges.map((c) => [c.providerEventId, c]));
  let minor = 0; let major = 0;
  for (const t of provider) {
    const o = t.kind === 'charge' ? byUid.get(t.uid) : undefined;
    if (!o || o.currency !== t.currency) continue;
    if (t.amount === o.amountMinor) minor += 1;
    else if (Math.round(t.amount * 100) === o.amountMinor) major += 1;
  }
  return minor > major ? 'minor' : major > minor ? 'major' : 'unknown';
}

/**
 * provider: PayPlus rows of [from - margin, until]; charges: ours of the same span. Alerts only inside [from, until - grace]: a charge in
 * the last minutes may still have its callback on the way, and a charge of ours at the edge may be listed by PayPlus a moment later.
 */
export function reconcile(a: { provider: ProviderTx[]; charges: OurCharge[]; refunds: OurRefund[]; from: string; until: string; graceMinutes?: number }): Reconciliation {
  const grace = (a.graceMinutes ?? 30) * 60000;
  const fromMs = Date.parse(a.from);
  const lastMs = Date.parse(a.until) - grace;
  const inWindow = (at: string) => { const t = Date.parse(at); return t >= fromMs && t <= lastMs; };
  const scale = detectScale(a.provider, a.charges);
  const byUid = new Map(a.charges.map((c) => [c.providerEventId, c]));
  const byAttempt = new Map(a.charges.filter((c) => c.attemptId).map((c) => [c.attemptId as string, c]));
  const known = new Set(a.refunds.map((r) => r.transactionUid));
  const seen = new Set<string>();
  const types: Record<string, number> = {};
  const findings: Finding[] = [];
  let matched = 0;
  for (const t of a.provider) {
    types[t.type] = (types[t.type] ?? 0) + 1;
    if (t.kind === 'other') continue;
    if (t.kind === 'refund') {
      if (!known.has(t.uid) && inWindow(t.at)) findings.push({ code: 'REFUND_UNRECORDED', uid: t.uid, detail: { amount: t.amount, currency: t.currency, scale, at: t.at, type: t.type } });
      continue;
    }
    const ours = byUid.get(t.uid) ?? (t.moreInfo ? byAttempt.get(t.moreInfo) : undefined);
    if (!ours) {
      if (inWindow(t.at)) findings.push({ code: 'UNLINKED', uid: t.uid, detail: { amount: t.amount, currency: t.currency, scale, at: t.at, attemptId: t.moreInfo, type: t.type } });
      continue;
    }
    seen.add(ours.providerEventId);
    if (ours.currency !== t.currency || (scale !== 'unknown' && toMinor(t.amount, scale) !== ours.amountMinor)) {
      findings.push({ code: 'AMOUNT_MISMATCH', uid: t.uid, detail: { provider: { amount: t.amount, currency: t.currency, scale }, ours: { amountMinor: ours.amountMinor, currency: ours.currency } } });
    } else matched += 1;
  }
  for (const c of a.charges) {
    if (seen.has(c.providerEventId) || !inWindow(c.at)) continue;
    findings.push({ code: 'MISSING_AT_PROVIDER', uid: c.providerEventId, detail: { amountMinor: c.amountMinor, currency: c.currency, at: c.at, attemptId: c.attemptId } });
  }
  return { matched, findings, scale, types };
}

const LABEL: Record<FindingCode, string> = {
  UNLINKED: 'חיוב בפיי פלוס שלא נקשר למנוי (נגבה כסף ואין זכאות)',
  MISSING_AT_PROVIDER: 'תשלום שנרשם אצלנו ולא נמצא בפיי פלוס',
  AMOUNT_MISMATCH: 'סכום או מטבע שונים בין פיי פלוס לבינינו',
  REFUND_UNRECORDED: 'החזר בפיי פלוס שלא נרשם אצלנו',
};
const ORDER: FindingCode[] = ['UNLINKED', 'MISSING_AT_PROVIDER', 'AMOUNT_MISMATCH', 'REFUND_UNRECORDED'];

/** The Owner's email (Hebrew): only NEW findings, the most urgent first; null when there is nothing new. */
export function alertText(newFindings: Finding[], matched: number, appUrl: string): { subject: string; text: string } | null {
  if (!newFindings.length) return null;
  const lines = [...newFindings].sort((x, y) => ORDER.indexOf(x.code) - ORDER.indexOf(y.code)).slice(0, 50).map((f) => `- ${LABEL[f.code]}: עסקה ${f.uid}`);
  return {
    subject: `התאמת תשלומים: ${newFindings.length} פריטים חדשים לבדיקה`,
    text: [`בהתאמת התשלומים היומית נמצאו ${newFindings.length} פריטים חדשים לבדיקה (עסקאות שהתאימו: ${matched}).`, '', ...lines, '',
      `הפירוט המלא בניהול, במסך "התאמת תשלומים": ${appUrl}/dashboard`].join('\n'),
  };
}

/** Israel calendar date of an instant ('YYYY-MM-DD') - the daily site run is once per Israel day */
export function israelDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** the PayPlus request body for one page; dates as YYYY-MM-DD in Israel time (the documentation names no format) */
export function historyBody(terminalUid: string, from: Date, until: Date, currency: string, skip: number, take = 500) {
  return { terminal_uid: terminalUid, filter: { fromDate: israelDay(from), untilDate: israelDay(until), currency_code: currency }, skip: String(skip), take: String(take) };
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;
export type HistoryResult = { ok: true; rows: unknown[] } | { ok: false; code: string };

/** reads every page of one currency (at most 20 pages of 500); any non-200 / non-array answer = a failed read with its code */
export async function readHistory(f: Fetch, cfg: { apiBase: string; apiKey: string; secretKey: string; terminalUid: string }, from: Date, until: Date,
  currency: string, timeoutMs = 20000): Promise<HistoryResult> {
  const rows: unknown[] = [];
  for (let page = 0; page < 20; page += 1) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await f(`${cfg.apiBase}/TransactionReports/TransactionsHistory`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'api-key': cfg.apiKey, 'secret-key': cfg.secretKey, 'user-agent': 'PayPlus' },
        body: JSON.stringify(historyBody(cfg.terminalUid, from, until, currency, page * 500)),
      });
    } catch {
      return { ok: false, code: 'provider_unreachable' };
    } finally { clearTimeout(timer); }
    if (!res.ok) return { ok: false, code: `provider_${res.status}` };
    let body: unknown;
    try { body = await res.json(); } catch { return { ok: false, code: 'provider_not_json' }; }
    if (!isObj(body) || !Array.isArray(body.transactions)) return { ok: false, code: 'provider_unexpected_answer' };
    rows.push(...body.transactions);
    const pages = typeof body.pages === 'number' ? body.pages : 1;
    if (body.transactions.length < 500 || page + 1 >= pages) return { ok: true, rows };
  }
  return { ok: false, code: 'provider_too_many_rows' };
}

// ------------------------------------------------------------------------------------------------------------------- one run
export type PayPlusRead = { apiBase: string; apiKey: string; secretKey: string; terminalUid: string };
export type RunPatch = { status: 'ok' | 'failed' | 'not_configured'; windowFrom?: string; windowUntil?: string; providerCount?: number; oursCount?: number;
  matched?: number; newFindings?: number; scale?: Scale; types?: Record<string, number>; errorCode?: string };
export type ReconcileDeps = {
  caller: () => Promise<'admin' | 'cron' | null>;
  now: () => Date;
  config: () => PayPlusRead | null;
  /** a new run row; the site run only once per Israel day (null = already ran today) */
  claimRun: (day: string, source: 'cron' | 'admin') => Promise<string | null>;
  finishRun: (runId: string, patch: RunPatch) => Promise<void>;
  source: (from: string, until: string) => Promise<{ charges: OurCharge[]; refunds: OurRefund[] }>;
  history: (cfg: PayPlusRead, from: Date, until: Date, currency: string) => Promise<HistoryResult>;
  /** stores the findings once per (code, uid); returns the ones that are new */
  saveFindings: (runId: string, findings: Finding[]) => Promise<Finding[]>;
  mailOwner: (subject: string, text: string, runId: string) => Promise<boolean>;
  markMailed: (runId: string) => Promise<void>;
};
export const WINDOW_DAYS = 3;
export const CURRENCIES = Object.freeze(['ILS', 'USD']);

export async function reconcileHandler(body: Record<string, unknown>, deps: ReconcileDeps, appUrl: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const role = await deps.caller();
  if (!role) return { status: 401, body: { ok: false, code: 'unauthorized' } };
  if (body?.action !== 'run') return { status: 400, body: { ok: false, code: 'invalid_request' } };
  const now = deps.now();
  const runId = await deps.claimRun(israelDay(now), role);
  if (!runId) return { status: 200, body: { ok: true, status: 'already_ran_today' } };
  try {
    return await runOnce(runId, role, now, deps, appUrl);
  } catch (e) {
    // a run that broke half-way is recorded as failed, never left "running"
    try { await deps.finishRun(runId, { status: 'failed', errorCode: 'internal' }); } catch { /* the original error is what matters */ }
    throw e;
  }
}

async function runOnce(runId: string, role: 'admin' | 'cron', now: Date, deps: ReconcileDeps, appUrl: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const cfg = deps.config();
  if (!cfg) {
    await deps.finishRun(runId, { status: 'not_configured', errorCode: 'payplus_read_not_configured' });
    return { status: 200, body: { ok: true, status: 'not_configured', runId } };
  }
  const until = now;
  const from = new Date(now.getTime() - WINDOW_DAYS * 86400000);
  const providerFrom = new Date(from.getTime() - 86400000);
  const rows: unknown[] = [];
  for (const currency of CURRENCIES) {
    const r = await deps.history(cfg, providerFrom, until, currency);
    if (!r.ok) {
      await deps.finishRun(runId, { status: 'failed', errorCode: r.code, windowFrom: from.toISOString(), windowUntil: until.toISOString() });
      return { status: 200, body: { ok: false, status: 'failed', code: r.code, runId } };
    }
    rows.push(...r.rows);
  }
  const provider: ProviderTx[] = [];
  const seenUid = new Set<string>();
  let unreadable = 0;
  for (const raw of rows) {
    const t = normalizeProviderTx(raw);
    if (!t) { unreadable += 1; continue; }
    if (seenUid.has(t.uid)) continue; // one transaction listed under two currency filters counts once
    seenUid.add(t.uid);
    provider.push(t);
  }
  const ours = await deps.source(providerFrom.toISOString(), until.toISOString());
  const r = reconcile({ provider, charges: ours.charges, refunds: ours.refunds, from: from.toISOString(), until: until.toISOString() });
  const fresh = await deps.saveFindings(runId, r.findings);
  const types = unreadable ? { ...r.types, unreadable } : r.types;
  await deps.finishRun(runId, { status: 'ok', windowFrom: from.toISOString(), windowUntil: until.toISOString(), providerCount: provider.length,
    oursCount: ours.charges.length, matched: r.matched, newFindings: fresh.length, scale: r.scale, types });
  let mailed = false;
  const mail = role === 'cron' ? alertText(fresh, r.matched, appUrl) : null;
  if (mail && await deps.mailOwner(mail.subject, mail.text, runId)) { mailed = true; await deps.markMailed(runId); }
  return { status: 200, body: { ok: true, status: 'ok', runId, provider: provider.length, matched: r.matched, newFindings: fresh.length, scale: r.scale, unreadable, mailed } };
}
