// PayPlus phase 1 (Owner console 2026-10-18 "כן להתחיל לבנות את שלב 1"): the PayPlus BillingProvider - Israel / ILS only.
// Pure, dependency-injected module (Deno + vitest). Nothing here reads the environment, holds a key or calls PayPlus unless a caller
// builds it with an explicit config (wiring.ts, from the secrets). Since 2026-10-25 purchasing opens in Israel only (DB switch).
//
// Contract = the PayPlus public documentation (docs.payplus.co.il, read 2026-10-18):
//   * POST {base}/PaymentPages/generateLink with the headers `api-key` + `secret-key`; base = restapi (production) or restapidev
//     (staging); the answer carries data.payment_page_link. charge_method 3 = recurring payments with recurring_settings.
//   * the transaction callback (refURL_callback) carries transaction_type + transaction { uid, status_code, currency, date,
//     more_info, ... }; "000" is the documented success code.
//   * "Validate Requests Received from PayPlus": the `user-agent` header is exactly "PayPlus" and the `hash` header is
//     base64(HMAC-SHA256(secret key, JSON.stringify(body))).
// Still OPEN with PayPlus (docs/PAYPLUS_QUESTIONS_2026-10-15.md): Q5 the annual cycle (recurring_range 12 below), Q6 retries of a
// failed charge, Q9 duplicate / retried callbacks. A replayed callback is harmless: the event id makes it a no-op in SQL.
//
// Trust boundary (unchanged from billing.ts): the amount and the currency come from the server attempt; a callback's plan, card or
// customer data is never read. Read: the event id, the result, the time, our own attempt id and the paid amount - the paid amount
// only so SQL can require it to EQUAL the attempt before the subscription opens (it never sets a price or a right).
import { parseProviderEvent, sha256Hex, cleanCheckoutCustomer, type CheckoutCustomer, type BillingPeriod, type BillingProvider, type EventType, type PulledCheckout, type PulledAddOn, type SmartPackLineRequest, type SmartPackRemovalRequest, type WebhookVerification } from './billing.ts';

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) =>
  Promise<{ ok: boolean; json(): Promise<unknown> }>;

export const PAYPLUS_PROVIDER_NAME = 'payplus';
export const PAYPLUS_API_BASES = Object.freeze({
  production: 'https://restapi.payplus.co.il/api/v1.0',
  staging: 'https://restapidev.payplus.co.il/api/v1.0',
});
export const PAYPLUS_USER_AGENT = 'PayPlus';
export const PAYPLUS_SUCCESS_CODE = '000';

export type PayPlusConfig = {
  apiBase: string; apiKey: string; secretKey: string; paymentPageUid: string;
  /** our server endpoint (subscription-authority/provider-event) and the browser return pages - all https, all server-owned */
  callbackUrl: string; successUrl: string; failureUrl: string;
  /** optional: the page's 'Return to site' link (refURL_cancel) */
  cancelUrl?: string;
  /** 20261025300000: the browser return pages of a SMART PACK add-on page (default: the package pages) */
  addOnSuccessUrl?: string; addOnFailureUrl?: string; addOnCancelUrl?: string;
  /** Owner console 2026-10-25 (typed: "מאשר: מזהה המסוף כסוד ..."): the account's PayPlus terminal - used when a standing order was
   *  bound without one (the server pull carries none); the same secret admin-billing reads */
  terminalUid?: string;
  fetch: Fetch; now: () => number; timeoutMs?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isHttps = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
};
const isPayPlusLink = (v: unknown): v is string => {
  if (!isHttps(v)) return false;
  const host = new URL(v).hostname;
  return host === 'payplus.co.il' || host.endsWith('.payplus.co.il');
};
const enc = new TextEncoder();

// -------------------------------------------------------------------------------------------------------- Israel local time
const IL_PARTS = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
function jerusalemWallClockMs(ms: number): number {
  const p = Object.fromEntries(IL_PARTS.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}
/** "YYYY-MM-DD HH:MM:SS" in Israel time (the callback `date`) -> ISO UTC; an ISO value with a zone is kept. */
export function payplusDateToIso(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(v)) return Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  if (+m[2] < 1 || +m[2] > 12 || +m[4] > 23 || +m[5] > 59 || +m[6] > 59) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  if (!Number.isFinite(wall) || new Date(wall).getUTCDate() !== +m[3]) return null;
  let utc = wall - (jerusalemWallClockMs(wall) - wall);
  utc = wall - (jerusalemWallClockMs(utc) - utc); // second pass settles a DST edge
  return new Date(utc).toISOString();
}
// Owner console 2026-10-26 (typed: "מאשר תיקון יצירת הוראת הקבע כך שהחיוב הראשון שלה יהיה רק אחרי תקופה מלאה ..."): the first live
// purchase (25/10) was charged twice - the page charged the first payment (instant_first_payment) and PayPlus charged the standing order
// again the first night, because it started on the payment date with no free days. PayPlus docs (generateLink, recurring_settings):
// jump_payments = "Give free X days ... the system will give 30 days free till first charge". The free days are exactly the paid
// period - from today (Israel) to the same day next month / next year, clamped to the month's length the way Postgres adds
// interval '1 month' / '1 year' to paid_through (2026-01-31 + 1 month = 2026-02-28) - so the first standing-order charge falls when
// the paid period ends.
export function firstChargeFreeDays(ms: number, period: 'month' | 'year'): number {
  const d = new Date(jerusalemWallClockMs(ms));
  const y = d.getUTCFullYear(); const m = d.getUTCMonth(); const day = d.getUTCDate();
  const ty = period === 'year' ? y + 1 : (m === 11 ? y + 1 : y);
  const tm = period === 'year' ? m : (m + 1) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const target = Date.UTC(ty, tm, Math.min(day, lastDay));
  return Math.round((target - Date.UTC(y, m, day)) / 86_400_000);
}
/** day of the month today in Israel, capped at 28 so every month has it */
export function israelDayOfMonth(ms: number): number {
  return Math.min(new Date(jerusalemWallClockMs(ms)).getUTCDate(), 28);
}

// -------------------------------------------------------------------------------------------------------- payment page
export const PAYPLUS_ITEM_NAMES = Object.freeze({ month: 'TEKANGO - מנוי חודשי', year: 'TEKANGO - מנוי שנתי' });
// Owner 2026-10-20: SMART PACK is a second line of the same payment page / standing order
export const PAYPLUS_SMART_PACK_ITEM_NAMES = Object.freeze({ month: 'TEKANGO - חכם פלוס חודשי', year: 'TEKANGO - חכם פלוס שנתי' });
// Owner console 2026-10-21 ("אם ... מפעילים את האפשרות ... לתשלומים בלייב ... צריך לעשות את זה גם לאנגלית"): International = USD, an
// English page, VAT-exempt lines (a customer abroad), no Israeli ID / instalments field. Prepared only - the billing phase stays off.
export const PAYPLUS_ITEM_NAMES_EN = Object.freeze({ month: 'TEKANGO - Monthly subscription', year: 'TEKANGO - Annual subscription' });
export const PAYPLUS_SMART_PACK_ITEM_NAMES_EN = Object.freeze({ month: 'TEKANGO - SMART PACK monthly', year: 'TEKANGO - SMART PACK annual' });

/** The generateLink body for one server attempt. amountMinor is the server catalog amount (IL prices include VAT: vat_type 0;
 *  USD = International, VAT-exempt: vat_type 2). */
export function buildGenerateLinkBody(cfg: Pick<PayPlusConfig, 'paymentPageUid' | 'callbackUrl' | 'successUrl' | 'failureUrl' | 'cancelUrl'>,
  i: { attemptId: string; amountMinor: number; billingPeriod: BillingPeriod; nowMs: number; addOnAmountMinor?: number | null; currency?: 'ILS' | 'USD';
    customer?: CheckoutCustomer | null }): Record<string, unknown> {
  const amount = i.amountMinor / 100;
  const usd = i.currency === 'USD';
  const addOn = Number.isInteger(i.addOnAmountMinor) && (i.addOnAmountMinor as number) > 0 ? (i.addOnAmountMinor as number) : 0;
  const names = usd ? PAYPLUS_ITEM_NAMES_EN : PAYPLUS_ITEM_NAMES;
  const addOnNames = usd ? PAYPLUS_SMART_PACK_ITEM_NAMES_EN : PAYPLUS_SMART_PACK_ITEM_NAMES;
  const vatType = usd ? 2 : 0;
  // the lines always sum to the attempt total: package = total - add-on
  const items = [{ name: names[i.billingPeriod], quantity: 1, price: (i.amountMinor - addOn) / 100, vat_type: vatType },
    ...(addOn ? [{ name: addOnNames[i.billingPeriod], quantity: 1, price: addOn / 100, vat_type: vatType }] : [])];
  return {
    payment_page_uid: cfg.paymentPageUid,
    charge_method: 3, // recurring payments
    amount,
    currency_code: usd ? 'USD' : 'ILS',
    ...(usd ? { language_code: 'en', paying_vat: false, hide_identification_id: true, hide_payments_field: true } : {}),
    more_info: i.attemptId, // comes back in the callback: the ONLY link from a payment to our server attempt
    // Owner 2026-10-25: the invoice-receipt and the approval email go to the paying account's own business name / email
    ...(i.customer && (i.customer.name || i.customer.email) ? { customer: {
      ...(i.customer.name ? { customer_name: i.customer.name } : {}),
      ...(i.customer.email ? { email: i.customer.email } : {}),
    } } : {}),
    refURL_success: cfg.successUrl,
    refURL_failure: cfg.failureUrl,
    refURL_callback: cfg.callbackUrl,
    ...(cfg.cancelUrl ? { refURL_cancel: cfg.cancelUrl } : {}),
    send_failure_callback: true,
    // Owner 2026-10-25: an Israeli customer gets the PayPlus approval / failure email and a tax invoice-receipt (Invoice+) for the
    // first charge and every renewal; USD stays off (international purchasing is not open)
    sendEmailApproval: !usd,
    sendEmailFailure: !usd,
    ...(usd ? {} : { initial_invoice: true }),
    items,
    recurring_settings: {
      instant_first_payment: true,
      recurring_type: 2, // monthly cycle
      recurring_range: i.billingPeriod === 'year' ? 12 : 1, // annual = every 12 months (PayPlus Q5 still open)
      number_of_charges: 0, // renews until cancelled
      start_date_on_payment_date: true,
      start_date: israelDayOfMonth(i.nowMs),
      // the first standing-order charge only after the whole paid period (never a second charge the first night)
      jump_payments: firstChargeFreeDays(i.nowMs, i.billingPeriod === 'year' ? 'year' : 'month'),
      successful_invoice: !usd,
      customer_failure_email: !usd,
      send_customer_success_email: !usd,
    },
  };
}

// Owner console 2026-10-25 ("ב: חיוב יחסי עכשיו"; 20261025300000): an active subscriber adds SMART PACK - a ONE-TIME charge of the
// server's pro-rata amount (charge_method 1), one line with the same name as the standing-order SMART PACK line (PayPlus keeps it as a
// product of that name - the line later added to the standing order is that product). more_info = 'sp_' + the add-on id: a callback of
// this page reaches the add-on row, never a package attempt. Same customer, approval email and invoice-receipt as the package page.
export const PAYPLUS_ADD_ON_REF_PREFIX = 'sp_';
export function buildAddOnLinkBody(cfg: Pick<PayPlusConfig, 'paymentPageUid' | 'callbackUrl' | 'successUrl' | 'failureUrl' | 'cancelUrl' | 'addOnSuccessUrl' | 'addOnFailureUrl' | 'addOnCancelUrl'>,
  i: { addOnId: string; amountMinor: number; billingPeriod: BillingPeriod; customer?: CheckoutCustomer | null }): Record<string, unknown> {
  return {
    payment_page_uid: cfg.paymentPageUid,
    charge_method: 1, // one charge now
    amount: i.amountMinor / 100,
    currency_code: 'ILS',
    more_info: PAYPLUS_ADD_ON_REF_PREFIX + i.addOnId,
    ...(i.customer && (i.customer.name || i.customer.email) ? { customer: {
      ...(i.customer.name ? { customer_name: i.customer.name } : {}),
      ...(i.customer.email ? { email: i.customer.email } : {}),
    } } : {}),
    refURL_success: cfg.addOnSuccessUrl ?? cfg.successUrl,
    refURL_failure: cfg.addOnFailureUrl ?? cfg.failureUrl,
    refURL_callback: cfg.callbackUrl,
    // Owner console 2026-10-25 (findings 1-13): its own cancel page - never the package's (which would read "payment confirmed")
    ...((cfg.addOnCancelUrl ?? cfg.cancelUrl) ? { refURL_cancel: cfg.addOnCancelUrl ?? cfg.cancelUrl } : {}),
    send_failure_callback: true,
    sendEmailApproval: true,
    sendEmailFailure: true,
    initial_invoice: true,
    items: [{ name: PAYPLUS_SMART_PACK_ITEM_NAMES[i.billingPeriod], quantity: 1, price: i.amountMinor / 100, vat_type: 0 }],
  };
}
const addOnIdOf = (v: unknown): string | null =>
  typeof v === 'string' && v.startsWith(PAYPLUS_ADD_ON_REF_PREFIX) && UUID.test(v.slice(PAYPLUS_ADD_ON_REF_PREFIX.length))
    ? v.slice(PAYPLUS_ADD_ON_REF_PREFIX.length) : null;

// -------------------------------------------------------------------------------------------------------- callback
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
function decodeBase64(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
  try { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); } catch { return null; }
}

const ref = (v: unknown): string | null => (typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 200 ? v.trim() : null);

/** The normalized event of a verified callback, or null. Our attempt id = more_info; ILS only. The paid amount is carried ONLY so
 *  SQL can require it to equal the server attempt before anything opens (it never sets a price, a plan or a right).
 *  20261022000000: a standing-order charge carries transaction.recurring_charge_information.recurring_uid (documented); the docs do not
 *  promise that a renewal repeats more_info, so a callback with the standing-order id and no attempt id is kept - SQL reaches the
 *  attempt the standing order was bound to by its first (activating) payment, and refuses one nobody bound. */
export function mapPayPlusCallback(json: unknown): { id: string; type: EventType; occurredAt: string; attemptId: string | null;
  paidAmountMinor: number | null; paidCurrency: 'ILS' | 'USD'; recurringRef: string | null; terminalRef: string | null; addOnId?: string } | null {
  if (!isObj(json) || !isObj(json.transaction)) return null;
  const tx = json.transaction;
  const kind = typeof json.transaction_type === 'string' ? json.transaction_type.trim().toLowerCase() : '';
  if (tx.currency !== 'ILS' && tx.currency !== 'USD') return null; // Israel ILS + International USD (2026-10-21, prepared)
  if (typeof tx.uid !== 'string' || typeof tx.status_code !== 'string') return null;
  const attemptId = typeof tx.more_info === 'string' && UUID.test(tx.more_info) ? tx.more_info : null;
  // 20261025300000: a SMART PACK add-on page ('sp_' + its id) - a one-time charge, never a standing order
  const addOnId = attemptId ? null : addOnIdOf(tx.more_info);
  const recurringRef = !addOnId && isObj(tx.recurring_charge_information) ? ref(tx.recurring_charge_information.recurring_uid) : null;
  if (!attemptId && !recurringRef && !addOnId) return null;
  const terminalRef = recurringRef && isObj(json.data) ? ref(json.data.terminal_uid) : null;
  const type: EventType | null = kind === 'charge' ? (tx.status_code === PAYPLUS_SUCCESS_CODE ? 'payment_confirmed' : 'payment_failed')
    : kind === 'refund' ? 'refund' : null;
  const occurredAt = payplusDateToIso(tx.date);
  if (!type || !occurredAt) return null;
  // review 2026-10-22: a numeric string ("306" / "306.00") is the same amount - never a silent "no amount" (rejected) for a real payment
  const amountNum = typeof tx.amount === 'number' ? tx.amount
    : typeof tx.amount === 'string' && /^\d{1,9}(\.\d{1,2})?$/.test(tx.amount.trim()) ? Number(tx.amount.trim()) : NaN;
  const paidAmountMinor = Number.isFinite(amountNum) && amountNum > 0 ? Math.round(amountNum * 100) : null;
  return { id: tx.uid, type, occurredAt, attemptId, paidAmountMinor, paidCurrency: tx.currency as 'ILS' | 'USD', recurringRef, terminalRef,
    ...(addOnId ? { addOnId } : {}) };
}

export function createPayPlusProvider(cfg: PayPlusConfig): BillingProvider {
  const bases = Object.values(PAYPLUS_API_BASES) as string[];
  if (!bases.includes(cfg.apiBase) || typeof cfg.apiKey !== 'string' || cfg.apiKey.length < 8 || typeof cfg.secretKey !== 'string'
      || cfg.secretKey.length < 16 || typeof cfg.paymentPageUid !== 'string' || !UUID.test(cfg.paymentPageUid)
      || !isHttps(cfg.callbackUrl) || !isHttps(cfg.successUrl) || !isHttps(cfg.failureUrl) || (cfg.cancelUrl !== undefined && !isHttps(cfg.cancelUrl))
      || (cfg.addOnSuccessUrl !== undefined && !isHttps(cfg.addOnSuccessUrl)) || (cfg.addOnFailureUrl !== undefined && !isHttps(cfg.addOnFailureUrl))
      || (cfg.addOnCancelUrl !== undefined && !isHttps(cfg.addOnCancelUrl))
      || (cfg.terminalUid !== undefined && !UUID.test(cfg.terminalUid))
      || typeof cfg.fetch !== 'function'
      || typeof cfg.now !== 'function') {
    throw new Error('createPayPlusProvider: invalid configuration');
  }
  const keyPromise = globalThis.crypto.subtle.importKey('raw', enc.encode(cfg.secretKey) as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = async (bytes: Uint8Array) =>
    new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', await keyPromise, bytes as unknown as ArrayBuffer));
  const orders = payplusStandingOrders({ apiBase: cfg.apiBase, apiKey: cfg.apiKey, secretKey: cfg.secretKey, fetch: cfg.fetch, timeoutMs: cfg.timeoutMs });

  return Object.freeze({
    name: PAYPLUS_PROVIDER_NAME,
    async createCheckout(i: { attemptId: string; currency: 'ILS' | 'USD'; amountMinor: number; billingPeriod?: BillingPeriod; addOnAmountMinor?: number | null;
      customer?: CheckoutCustomer | null }) {
      // ILS (Israel) or USD (International, 2026-10-21 prepared); the package only (a legacy style plan carries no billing period)
      if ((i.currency !== 'ILS' && i.currency !== 'USD') || !UUID.test(i.attemptId) || !Number.isInteger(i.amountMinor) || i.amountMinor <= 0
          || (i.billingPeriod !== 'month' && i.billingPeriod !== 'year')
          || (i.addOnAmountMinor != null && (!Number.isInteger(i.addOnAmountMinor) || i.addOnAmountMinor <= 0 || i.addOnAmountMinor >= i.amountMinor))) return null;
      const body = buildGenerateLinkBody(cfg, { attemptId: i.attemptId, amountMinor: i.amountMinor, billingPeriod: i.billingPeriod, nowMs: cfg.now(),
        addOnAmountMinor: i.addOnAmountMinor ?? null, currency: i.currency, customer: cleanCheckoutCustomer(i.customer) });
      let json: unknown;
      try {
        const res = await cfg.fetch(`${cfg.apiBase}/PaymentPages/generateLink`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'api-key': cfg.apiKey, 'secret-key': cfg.secretKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(cfg.timeoutMs ?? 10_000),
        });
        if (!res.ok) return null;
        json = await res.json();
      } catch { return null; }
      if (!isObj(json) || !isObj(json.results) || json.results.status !== 'success' || !isObj(json.data)) return null;
      const link = json.data.payment_page_link;
      // the page request id lets the server PULL the result later (/PaymentPages/ipn) when no callback arrives (sandbox 2026-10-21)
      const pageRequestUid = typeof json.data.page_request_uid === 'string' && UUID.test(json.data.page_request_uid) ? json.data.page_request_uid : null;
      return isPayPlusLink(link) ? { redirectUrl: link, ...(pageRequestUid ? { pageRequestUid } : {}) } : null;
    },
    async verifyWebhook(rawBody: Uint8Array, headers: { get(name: string): string | null }): Promise<WebhookVerification> {
      if ((headers.get('user-agent') ?? '') !== PAYPLUS_USER_AGENT) return { ok: false, reason: 'untrusted_source' };
      const sig = decodeBase64((headers.get('hash') ?? '').trim());
      if (!sig) return { ok: false, reason: 'invalid_signature' };
      let json: unknown;
      try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)); } catch { return { ok: false, reason: 'invalid_signature' }; }
      // The documented check signs JSON.stringify(body); the exact received bytes are accepted too (same secret, same body).
      const signedOk = bytesEqual(await mac(rawBody), sig) || bytesEqual(await mac(enc.encode(JSON.stringify(json))), sig);
      if (!signedOk) return { ok: false, reason: 'invalid_signature' };
      const mapped = mapPayPlusCallback(json);
      const event = mapped ? parseProviderEvent({ id: mapped.id, type: mapped.type, occurredAt: mapped.occurredAt, attemptId: mapped.attemptId,
        recurringRef: mapped.recurringRef, terminalRef: mapped.terminalRef, ...(mapped.addOnId ? { addOnId: mapped.addOnId } : {}) }) : null;
      if (!mapped || !event) return { ok: false, reason: 'invalid_event' };
      return { ok: true, event: mapped.paidAmountMinor === null ? event : { ...event, paid: { amountMinor: mapped.paidAmountMinor, currency: mapped.paidCurrency } } };
    },
    // 20261022200000: the server pull (sandbox 2026-10-21: /PaymentPages/ipn answers the standing order the payment created - status
    // 000, valid, extra_info = our attempt id - but not the transaction uid). Approved only when PayPlus says both.
    async pullCheckout(pageRequestUid: string): Promise<PulledCheckout | null> {
      const o = await orders.byPageRequest(pageRequestUid);
      if (!o) return null;
      const seen = { pageRequestUid, recurringUid: o.recurringUid, statusCode: o.statusCode, valid: o.valid, amountMinor: o.amountMinor,
        currency: o.currency, attemptId: o.attemptId };
      return { attemptId: o.attemptId, recurringRef: o.recurringUid, amountMinor: o.amountMinor, currency: o.currency,
        approved: o.valid && o.statusCode === PAYPLUS_SUCCESS_CODE, payloadSha256: await sha256Hex(enc.encode(JSON.stringify(seen))) };
    },
    // 20261025300000: the one-time SMART PACK page of an active subscriber
    async createAddOnCheckout(i: { addOnId: string; currency: 'ILS'; amountMinor: number; billingPeriod: BillingPeriod; customer?: CheckoutCustomer | null }) {
      if (i.currency !== 'ILS' || !UUID.test(i.addOnId) || !Number.isInteger(i.amountMinor) || i.amountMinor <= 0
          || (i.billingPeriod !== 'month' && i.billingPeriod !== 'year')) return null;
      const body = buildAddOnLinkBody(cfg, { addOnId: i.addOnId, amountMinor: i.amountMinor, billingPeriod: i.billingPeriod,
        customer: cleanCheckoutCustomer(i.customer) });
      let json: unknown;
      try {
        const res = await cfg.fetch(`${cfg.apiBase}/PaymentPages/generateLink`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'api-key': cfg.apiKey, 'secret-key': cfg.secretKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(cfg.timeoutMs ?? 10_000),
        });
        if (!res.ok) return null;
        json = await res.json();
      } catch { return null; }
      if (!isObj(json) || !isObj(json.results) || json.results.status !== 'success' || !isObj(json.data)) return null;
      const link = json.data.payment_page_link;
      const pageRequestUid = typeof json.data.page_request_uid === 'string' && UUID.test(json.data.page_request_uid) ? json.data.page_request_uid : null;
      return isPayPlusLink(link) ? { redirectUrl: link, ...(pageRequestUid ? { pageRequestUid } : {}) } : null;
    },
    // the result of that page by its request id (no callback needed); approved only with status 000 AND our own add-on reference
    async pullAddOnCheckout(pageRequestUid: string): Promise<PulledAddOn | null> {
      const d = await orders.pageRequest(pageRequestUid);
      if (!d) return null;
      const t = isObj(d.transaction) ? d.transaction : d;
      const addOnId = [t.more_info, d.more_info, t.extra_info, d.extra_info].map(addOnIdOf).find((v) => v !== null) ?? null;
      const statusCode = typeof t.status_code === 'string' ? t.status_code : typeof d.status_code === 'string' ? d.status_code : null;
      const cur = [t.currency, t.currency_code, d.currency_code].find((v) => v === 'ILS' || v === 'USD') as 'ILS' | 'USD' | undefined;
      const amountMinor = minor(t.amount ?? d.amount);
      const seen = { pageRequestUid, statusCode, amountMinor, currency: cur ?? null, addOnId };
      return { addOnId, amountMinor, currency: cur ?? null, approved: statusCode === PAYPLUS_SUCCESS_CODE && addOnId !== null,
        payloadSha256: await sha256Hex(enc.encode(JSON.stringify(seen))) };
    },
    // Owner console 2026-10-26 (typed: "מאשר הסרת חכם פלוס בשירות עצמי: בחודשי בסוף התקופה ששולמה בלי החזר, בשנתי לפי סעיף 6 ..."): the SMART PACK line taken OFF
    // the live standing order - ONE Update with the package line alone (its catalog product), the same cycle, from the next charge date.
    // 'removed' when PayPlus said success (or the order already carries the package alone); 'refused' when it cannot or said no;
    // 'unknown' when no answer came (tried again).
    async removeSmartPackLine(i: SmartPackRemovalRequest): Promise<'removed' | 'refused' | 'unknown'> {
      const refuse = (reason: string, detail: Record<string, unknown> = {}) => {
        console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'smart_pack_removal_refused', reason, ...detail }));
        return 'refused' as const;
      };
      const terminal = i.terminalRef ?? cfg.terminalUid ?? '';
      if (i.currency !== 'ILS' || !UUID.test(i.packageRequestRef)) return refuse('request');
      if (!UUID.test(terminal)) { console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'smart_pack_terminal_missing' })); return 'unknown'; }
      const o = await orders.byPageRequest(i.packageRequestRef);
      if (!o) return 'unknown';
      if (o.recurringUid !== i.recurringRef || !o.valid || o.currency !== 'ILS' || o.attemptId !== i.packageAttemptId) {
        return refuse('order', { sameOrder: o.recurringUid === i.recurringRef, valid: o.valid, ils: o.currency === 'ILS', ourAttempt: o.attemptId === i.packageAttemptId });
      }
      if (o.recurringType !== 2 || o.recurringRange !== (i.period === 'year' ? 12 : 1)) return refuse('cycle', { type: o.recurringType, range: o.recurringRange, period: i.period });
      // the order total stands for its lines (PayPlus answers the order without them): the package alone = already removed
      const total = o.items.length ? o.items.reduce((s, it) => s + it.priceMinor * (it.quantity || 1), 0) : o.amountMinor;
      if (total === i.packageAmountMinor) return 'removed'; // a retry after a lost answer
      if (total !== i.packageAmountMinor + i.addOnAmountMinor) return refuse('lines', { lines: o.items.length, amount: total, expected: i.packageAmountMinor + i.addOnAmountMinor });
      const pkg = await orders.productUidByName(PAYPLUS_ITEM_NAMES[i.period], 'ILS');
      if (pkg === undefined) return 'unknown';
      if (pkg === null) { console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'package_product_missing' })); return 'unknown'; }
      const r = await orders.updateLinesOutcome(o, terminal, [{ productUid: pkg, priceMinor: i.packageAmountMinor }], i.nextChargeDate,
        { extraInfo: i.packageAttemptId, documents: true });
      if (r === 'rejected') return refuse('update');
      return r === 'updated' ? 'removed' : 'unknown';
    },
    // section 6 (a yearly SMART PACK removed): the pro-rata refund on the period's charge (the documented refund by transaction uid)
    refund: (transactionUid: string, amountMinor: number) => orders.refund(transactionUid, amountMinor),
    // the SMART PACK line on the live package's standing order: read the order (by the package page request id), find the SMART PACK
    // product (the add-on page's line), then ONE Update with both lines from the next charge date - nothing is charged by it.
    // 'added' only when PayPlus said success (or the order already carries both lines); 'not_added' when it cannot or said no;
    // 'unknown' when no answer came (tried again later, never recorded as failed).
    async addSmartPackLine(i: SmartPackLineRequest): Promise<'added' | 'not_added' | 'unknown'> {
      // Owner 2026-10-26 (item א2, the third refusal): every refusal logs WHICH check refused (no personal data - flags, counts, amounts)
      const refuse = (reason: string, detail: Record<string, unknown> = {}) => {
        console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'smart_pack_line_refused', reason, ...detail }));
        return 'not_added' as const;
      };
      const terminal = i.terminalRef ?? cfg.terminalUid ?? '';
      if (i.currency !== 'ILS' || !UUID.test(i.packageRequestRef)) return refuse('request', { ils: i.currency === 'ILS', requestRef: UUID.test(i.packageRequestRef) });
      // Owner 2026-10-26 (item א2): no account terminal is a configuration gap of OURS - retried (the line stays 'requested'),
      // never recorded as refused (the first real add-on was refused this way before PayPlus was asked)
      if (!UUID.test(terminal)) { console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'smart_pack_terminal_missing' })); return 'unknown'; }
      const o = await orders.byPageRequest(i.packageRequestRef);
      if (!o) return 'unknown';
      if (o.recurringUid !== i.recurringRef || !o.valid || o.currency !== 'ILS' || o.attemptId !== i.packageAttemptId) {
        return refuse('order', { sameOrder: o.recurringUid === i.recurringRef, valid: o.valid, ils: o.currency === 'ILS', ourAttempt: o.attemptId === i.packageAttemptId });
      }
      // review 2026-10-25: the cycle is sent back exactly as PayPlus holds it - an annual order is never rewritten as a monthly one
      if (o.recurringType !== 2 || o.recurringRange !== (i.period === 'year' ? 12 : 1)) return refuse('cycle', { type: o.recurringType, range: o.recurringRange, period: i.period });
      // Owner 2026-10-26 (typed: "מאשר את תיקון קריאת הוראת הקבע לפי הסכום הכולל ..."): PayPlus answers the order WITHOUT its lines
      // (production 2026-10-26: lines 0, amount 30; the sandbox 2026-10-21 too) - the order total stands for its lines then
      if (o.items.length === 0 && o.amountMinor === i.packageAmountMinor + i.addOnAmountMinor) return 'added'; // a retry after a lost answer
      const prices = o.items.map((it) => it.priceMinor).sort((a, b) => a - b);
      const both = [i.packageAmountMinor, i.addOnAmountMinor].sort((a, b) => a - b);
      if (o.items.length === 2 && prices[0] === both[0] && prices[1] === both[1]) return 'added'; // a retry after a lost answer
      const noLines = o.items.length === 0;
      if (noLines ? o.amountMinor !== i.packageAmountMinor : (o.items.length !== 1 || o.items[0].priceMinor !== i.packageAmountMinor || o.items[0].quantity !== 1)) {
        return refuse('lines', { lines: o.items.length, prices: o.items.map((it) => it.priceMinor), amount: o.amountMinor, expected: i.packageAmountMinor, quantity: o.items[0]?.quantity ?? null });
      }
      const productUid = await orders.productUidByName(PAYPLUS_SMART_PACK_ITEM_NAMES[i.period], 'ILS');
      if (productUid === undefined) return 'unknown';
      // Owner 2026-10-26 (item א2): no SMART PACK product in the PayPlus catalog is a configuration gap of OURS (a one-time page
      // creates no catalog product - the first real add-on was refused this way) - retried, never recorded as refused
      if (productUid === null) { console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'smart_pack_product_missing' })); return 'unknown'; }
      // the package line keeps its name on every later invoice: its own catalog product when there is one, else the order's own line
      const packageProduct = await orders.productUidByName(PAYPLUS_ITEM_NAMES[i.period], 'ILS');
      if (packageProduct === undefined) return 'unknown';
      // an order read without lines needs the package's own catalog product (a configuration gap of ours otherwise - retried)
      if (noLines && !packageProduct) { console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'package_product_missing' })); return 'unknown'; }
      const r = await orders.updateLinesOutcome(o, terminal,
        [{ productUid: packageProduct || o.items[0].productUid, priceMinor: noLines ? i.packageAmountMinor : o.items[0].priceMinor }, { productUid, priceMinor: i.addOnAmountMinor }],
        i.nextChargeDate, { extraInfo: i.packageAttemptId, documents: true });
      if (r === 'rejected') return refuse('update', { packageProduct: Boolean(packageProduct), customer: Boolean(o.customerUid), cashier: Boolean(o.cashierUid), token: Boolean(o.cardToken) });
      return r === 'updated' ? 'added' : 'unknown';
    },
  });
}

// -------------------------------------------------------------------------------------------------------- standing orders
// Sandbox run 2026-10-21 (Owner-typed authorization; docs/PAYPLUS_OPEN_QUESTIONS_IMPACT_2026-10-21.md): POST /PaymentPages/ipn with the
// page request id returns the standing order the payment created (uid, number, items, amount, extra_info = our attempt id) - a
// server PULL that works without any callback; /RecurringPayments/Update needs the undocumented field `valid: true` (422 without it);
// /RecurringPayments/DeleteRecurring cancels. Prepared only: nothing here is wired to a route while the billing phase is off.
export type PayPlusStandingOrder = {
  recurringUid: string; number: string | null; valid: boolean; status: string | null; statusCode: string | null;
  amountMinor: number | null; currency: 'ILS' | 'USD' | null; attemptId: string | null; startDate: string | null;
  recurringType: number | null; recurringRange: number | null;
  items: { productUid: string; priceMinor: number; quantity: number }[];
  /** needed only to send an Update back; never logged, never stored */
  customerUid: string | null; cashierUid: string | null; cardToken: string | null;
};
const minor = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,9}(\.\d{1,2})?$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};
export function normalizeStandingOrder(d: unknown): PayPlusStandingOrder | null {
  if (!isObj(d) || typeof d.uid !== 'string' || !UUID.test(d.uid)) return null;
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const items = Array.isArray(d.items) ? d.items.filter(isObj).map((it) => ({
    productUid: typeof it.product_uid === 'string' ? it.product_uid : '', quantity: typeof it.quantity === 'number' ? it.quantity : 1,
    priceMinor: minor(it.quantity_price_including_vat ?? it.quantity_price ?? it.amount_pay) ?? -1,
  })).filter((it) => UUID.test(it.productUid) && it.priceMinor >= 0) : [];
  const cur = d.currency_code === 'ILS' || d.currency_code === 'USD' ? d.currency_code : null;
  return {
    recurringUid: d.uid, number: s(d.number), valid: d.valid === true, status: s(d.status), statusCode: s(d.status_code), amountMinor: minor(d.amount), currency: cur,
    attemptId: typeof d.extra_info === 'string' && UUID.test(d.extra_info) ? d.extra_info : null, startDate: s(d.start_date),
    recurringType: typeof d.recurring_type === 'number' ? d.recurring_type : null, recurringRange: typeof d.recurring_range === 'number' ? d.recurring_range : null,
    items, customerUid: s(d.customer_uid), cashierUid: s(d.cashier_uid), cardToken: s(d.card_token),
  };
}

export type CancelOutcome = 'cancelled' | 'rejected' | 'unknown';

export function payplusStandingOrders(cfg: { apiBase: string; apiKey: string; secretKey: string; fetch: Fetch; timeoutMs?: number }) {
  if (!(Object.values(PAYPLUS_API_BASES) as string[]).includes(cfg.apiBase) || !cfg.apiKey || !cfg.secretKey || typeof cfg.fetch !== 'function') {
    throw new Error('payplusStandingOrders: invalid configuration');
  }
  const call = async (method: 'POST' | 'GET', path: string, body?: unknown): Promise<Record<string, unknown> | null> => {
    try {
      const res = await cfg.fetch(`${cfg.apiBase}${path}`, { method, headers: { 'content-type': 'application/json', 'api-key': cfg.apiKey, 'secret-key': cfg.secretKey },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(cfg.timeoutMs ?? 10_000) });
      const j = await res.json().catch(() => null);
      return isObj(j) ? j : null;
    } catch { return null; }
  };
  const ok = (j: Record<string, unknown> | null) => !!j && isObj(j.results) && j.results.status === 'success';
  type Line = { productUid: string; priceMinor: number; quantity?: number };
  type UpdateOptions = { extraInfo?: string; documents?: boolean };
  const updateLinesOutcome = async (o: PayPlusStandingOrder, terminalUid: string, lines: Line[], startDate: string, opt: UpdateOptions = {}):
    Promise<'updated' | 'rejected' | 'unknown'> => {
    if (!UUID.test(o.recurringUid) || !UUID.test(terminalUid) || !o.customerUid || !o.cashierUid || !o.cardToken || !o.currency
        || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !lines.length || lines.some((l) => !UUID.test(l.productUid) || !Number.isInteger(l.priceMinor) || l.priceMinor <= 0)) return 'rejected';
    const j = await call('POST', `/RecurringPayments/Update/${o.recurringUid}`, {
      terminal_uid: terminalUid, customer_uid: o.customerUid, card_token: o.cardToken, cashier_uid: o.cashierUid, currency_code: o.currency,
      instant_first_payment: false, recurring_type: o.recurringType ?? 2, recurring_range: o.recurringRange ?? 1, number_of_charges: 0,
      start_date: startDate, valid: true,
      items: lines.map((l) => ({ product_uid: l.productUid, quantity: l.quantity ?? 1, price: l.priceMinor / 100 })),
      // 20261025300000: an Update replaces the order's settings - the invoice-receipt and the customer emails of every renewal stay on
      // (the documented defaults are off; on by default for an Israeli order), and our attempt id stays its extra_info
      ...((opt.documents ?? o.currency === 'ILS') ? { successful_invoice: true, send_customer_success_email: true, customer_failure_email: true } : {}),
      ...(opt.extraInfo ? { extra_info: opt.extraInfo } : {}),
    });
    if (ok(j)) return 'updated';
    // Owner 2026-10-26 (item א2): PayPlus' own refusal words are logged (its description / validation messages; never a card or customer value)
    if (j && isObj(j.results) && typeof j.results.status === 'string') {
      const msgs = Array.isArray(j.data) ? j.data.filter((m) => typeof m === 'string').map((m) => m.slice(0, 160)).slice(0, 5) : [];
      console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'payplus_update_refused', code: j.results.code ?? null,
        description: typeof j.results.description === 'string' ? j.results.description.slice(0, 200) : null, messages: msgs }));
      return 'rejected';
    }
    return 'unknown';
  };
  return Object.freeze({
    /** the standing order a payment page created, pulled by the page request id (no callback needed) */
    async byPageRequest(pageRequestUid: string): Promise<PayPlusStandingOrder | null> {
      if (!UUID.test(pageRequestUid)) return null;
      const j = await call('POST', '/PaymentPages/ipn', { payment_request_uid: pageRequestUid });
      return ok(j) ? normalizeStandingOrder(j!.data) : null;
    },
    /** 20261025300000: the raw answer for a payment page (a one-time page answers its transaction, not a standing order) */
    async pageRequest(pageRequestUid: string): Promise<Record<string, unknown> | null> {
      if (!UUID.test(pageRequestUid)) return null;
      const j = await call('POST', '/PaymentPages/ipn', { payment_request_uid: pageRequestUid });
      return ok(j) && isObj(j!.data) ? j!.data : null;
    },
    /** 20261025300000: the uid of the terminal's product with exactly this name (GET /Products/View, documented filters only - the
     *  answer's shape is not documented, so every object with a uid and that name is looked at). null = PayPlus answered and there is
     *  none; undefined = no answer. */
    async productUidByName(name: string, currency: 'ILS' | 'USD'): Promise<string | null | undefined> {
      // Owner 2026-10-26 (the retries after PR #74 stayed 'unknown'): PayPlus answers this list as a BARE array of products whose id
      // is 'uuid' (proven against the sandbox 2026-10-26) - never the { results, data } envelope of the other calls
      let j: unknown = null;
      try {
        const res = await cfg.fetch(`${cfg.apiBase}/Products/View?currency_code=${currency}&skip=0&take=500`, { method: 'GET',
          headers: { 'content-type': 'application/json', 'api-key': cfg.apiKey, 'secret-key': cfg.secretKey }, signal: AbortSignal.timeout(cfg.timeoutMs ?? 10_000) });
        j = await res.json().catch(() => null);
      } catch { j = null; }
      const list = Array.isArray(j) ? j : isObj(j) && ok(j) ? j.data : undefined;
      if (list === undefined) {
        console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'payplus_products_unreadable', shape: Array.isArray(j) ? 'array' : isObj(j) ? 'object' : String(j) }));
        return isObj(j) && isObj(j.results) ? null : undefined;
      }
      const found: string[] = [];
      const visit = (v: unknown, depth: number) => {
        if (depth > 4) return;
        if (Array.isArray(v)) { v.forEach((x) => visit(x, depth + 1)); return; }
        if (!isObj(v)) return;
        const uid = typeof v.uuid === 'string' ? v.uuid : typeof v.uid === 'string' ? v.uid : typeof v.product_uid === 'string' ? v.product_uid : null;
        const sameCurrency = typeof v.currency_code !== 'string' || v.currency_code === currency;
        if (uid && UUID.test(uid) && typeof v.name === 'string' && v.name.trim() === name && v.valid !== false && sameCurrency) found.push(uid);
        Object.values(v).forEach((x) => { if (isObj(x) || Array.isArray(x)) visit(x, depth + 1); });
      };
      visit(list, 0);
      return found[0] ?? null;
    },
    /** replace the lines of a standing order (e.g. SMART PACK added / removed); the next charge from startDate, nothing charged now */
    async updateLines(o: PayPlusStandingOrder, terminalUid: string, lines: Line[], startDate: string, opt: UpdateOptions = {}): Promise<boolean> {
      return (await updateLinesOutcome(o, terminalUid, lines, startDate, opt)) === 'updated';
    },
    updateLinesOutcome,
    /** stop a standing order (no further charges). Codex audit 2026-10-22 H-02: 'rejected' only when PayPlus answered and said no;
     *  no answer / a timeout / an unreadable answer is 'unknown' (it may have stopped - never recorded as failed) */
    async cancel(recurringUid: string, terminalUid: string): Promise<CancelOutcome> {
      if (!UUID.test(recurringUid) || !UUID.test(terminalUid)) return 'rejected';
      const j = await call('POST', `/RecurringPayments/DeleteRecurring/${recurringUid}`, { terminal_uid: terminalUid });
      if (ok(j)) return 'cancelled';
      return j && isObj(j.results) && typeof j.results.status === 'string' ? 'rejected' : 'unknown';
    },
    /** 20261022300000 (Terms section 6, early end): refund part of a charge (docs.payplus.co.il, Refund By Transaction UID:
     *  transaction_uid + amount, never more than the charge). Refunded only when PayPlus answers success with status 000; the refund's
     *  own transaction uid is returned for the log. Not proven in the sandbox yet. */
    async refund(transactionUid: string, amountMinor: number): Promise<{ ok: true; refundRef: string } | { ok: false }> {
      if (!ref(transactionUid) || !Number.isInteger(amountMinor) || amountMinor <= 0) return { ok: false };
      // Owner 2026-10-28 ("מאשר תיקון: הפקת חשבונית זיכוי בכל החזר דרך פיי פלוס"): without initial_invoice PayPlus refunds the money
      // and issues NO document (docs: "As long your account connected to Invoice+ we will generate document for this action")
      const j = await call('POST', '/Transactions/RefundByTransactionUID', { transaction_uid: transactionUid, amount: amountMinor / 100, initial_invoice: true });
      const tx = ok(j) && isObj(j!.data) && isObj(j!.data.transaction) ? j!.data.transaction : null;
      const refundRef = tx && tx.status_code === PAYPLUS_SUCCESS_CODE ? ref(tx.uid) : null;
      return refundRef ? { ok: true, refundRef } : { ok: false };
    },
  });
}

// -------------------------------------------------------------------------------------------------------- Function secrets
// Owner night task 2026-10-21: the provider is built from the Function secrets the Owner sets (never in code, never shown).
// Still INERT: the billing phase stays the code constant ACTIVATION_PHASE 'off', so checkout and callbacks answer 503 before the
// provider is ever used. A missing or invalid secret = no provider (UNAVAILABLE_PROVIDER), never a guess.
export const PAYPLUS_SECRET_NAMES = Object.freeze(['PAYPLUS_API_KEY', 'PAYPLUS_SECRET_KEY', 'PAYPLUS_PAYMENT_PAGE_UID', 'PAYPLUS_ENVIRONMENT',
  'PAYPLUS_RETURN_ORIGIN', 'PAYPLUS_TERMINAL_UID'] as const);
/** the browser return pages: the app's own origin only */
export const PAYPLUS_RETURN_ORIGINS = Object.freeze(['https://www.tekango.com', 'https://tekango.com']);
export const PAYPLUS_RETURN_PATHS = Object.freeze({
  success: '/dashboard?billing=processing', failure: '/dashboard?billing=failed', cancel: '/dashboard?billing=cancelled',
  // 20261025300000: back from a SMART PACK add-on page
  addOnSuccess: '/dashboard?billing=smart_pack', addOnFailure: '/dashboard?billing=smart_pack_failed', addOnCancel: '/dashboard?billing=smart_pack_cancelled',
});

/** The PayPlus provider from the Function secrets, or null. `get` reads ONE named secret; supabaseUrl = this project's URL (the callback). */
export function payplusProviderFromSecrets(get: (name: typeof PAYPLUS_SECRET_NAMES[number]) => string | undefined, supabaseUrl: string,
  fetchImpl: Fetch, now: () => number): BillingProvider | null {
  const apiKey = (get('PAYPLUS_API_KEY') ?? '').trim();
  const secretKey = (get('PAYPLUS_SECRET_KEY') ?? '').trim();
  const paymentPageUid = (get('PAYPLUS_PAYMENT_PAGE_UID') ?? '').trim().toLowerCase();
  const environment = (get('PAYPLUS_ENVIRONMENT') ?? '').trim();
  // 20261025400000: optional - a missing or malformed terminal leaves it unset (never a guess; only the SMART PACK line needs it)
  const terminalRaw = (get('PAYPLUS_TERMINAL_UID') ?? '').trim().toLowerCase();
  const terminalUid = UUID.test(terminalRaw) ? terminalRaw : undefined;
  // the LIVE app is the default only for the production terminal; a staging terminal must name its return origin
  const origin = ((get('PAYPLUS_RETURN_ORIGIN') ?? '').trim() || (environment === 'production' ? PAYPLUS_RETURN_ORIGINS[0] : '')).replace(/\/+$/, '');
  if (!apiKey || !secretKey || !paymentPageUid || (environment !== 'production' && environment !== 'staging')) return null;
  if (!PAYPLUS_RETURN_ORIGINS.includes(origin) || !isHttps(supabaseUrl)) return null;
  try {
    return createPayPlusProvider({
      apiBase: PAYPLUS_API_BASES[environment], apiKey, secretKey, paymentPageUid,
      callbackUrl: `${new URL(supabaseUrl).origin}/functions/v1/subscription-authority/provider-event`,
      successUrl: origin + PAYPLUS_RETURN_PATHS.success, failureUrl: origin + PAYPLUS_RETURN_PATHS.failure,
      cancelUrl: origin + PAYPLUS_RETURN_PATHS.cancel,
      addOnSuccessUrl: origin + PAYPLUS_RETURN_PATHS.addOnSuccess, addOnFailureUrl: origin + PAYPLUS_RETURN_PATHS.addOnFailure,
      addOnCancelUrl: origin + PAYPLUS_RETURN_PATHS.addOnCancel, ...(terminalUid ? { terminalUid } : {}), fetch: fetchImpl, now,
    });
  } catch {
    return null;
  }
}
