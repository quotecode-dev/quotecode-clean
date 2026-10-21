// PayPlus phase 1 (Owner console 2026-10-18 "כן להתחיל לבנות את שלב 1"): the PayPlus BillingProvider - Israel / ILS only.
// Pure, dependency-injected module (Deno + vitest). INERT: wiring.ts still wires UNAVAILABLE_PROVIDER and ACTIVATION_PHASE stays
// 'off'; nothing here reads the environment, holds a key or calls PayPlus unless a caller builds it with an explicit config.
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
import { parseProviderEvent, type BillingPeriod, type BillingProvider, type EventType, type WebhookVerification } from './billing.ts';

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) =>
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
  i: { attemptId: string; amountMinor: number; billingPeriod: BillingPeriod; nowMs: number; addOnAmountMinor?: number | null; currency?: 'ILS' | 'USD' }): Record<string, unknown> {
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
    refURL_success: cfg.successUrl,
    refURL_failure: cfg.failureUrl,
    refURL_callback: cfg.callbackUrl,
    ...(cfg.cancelUrl ? { refURL_cancel: cfg.cancelUrl } : {}),
    send_failure_callback: true,
    sendEmailApproval: false,
    sendEmailFailure: false,
    items,
    recurring_settings: {
      instant_first_payment: true,
      recurring_type: 2, // monthly cycle
      recurring_range: i.billingPeriod === 'year' ? 12 : 1, // annual = every 12 months (PayPlus Q5 still open)
      number_of_charges: 0, // renews until cancelled
      start_date_on_payment_date: true,
      start_date: israelDayOfMonth(i.nowMs),
      jump_payments: 0,
      successful_invoice: false, // invoicing is not live
      customer_failure_email: false,
      send_customer_success_email: false,
    },
  };
}

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
  paidAmountMinor: number | null; paidCurrency: 'ILS' | 'USD'; recurringRef: string | null; terminalRef: string | null } | null {
  if (!isObj(json) || !isObj(json.transaction)) return null;
  const tx = json.transaction;
  const kind = typeof json.transaction_type === 'string' ? json.transaction_type.trim().toLowerCase() : '';
  if (tx.currency !== 'ILS' && tx.currency !== 'USD') return null; // Israel ILS + International USD (2026-10-21, prepared)
  if (typeof tx.uid !== 'string' || typeof tx.status_code !== 'string') return null;
  const attemptId = typeof tx.more_info === 'string' && UUID.test(tx.more_info) ? tx.more_info : null;
  const recurringRef = isObj(tx.recurring_charge_information) ? ref(tx.recurring_charge_information.recurring_uid) : null;
  if (!attemptId && !recurringRef) return null;
  const terminalRef = recurringRef && isObj(json.data) ? ref(json.data.terminal_uid) : null;
  const type: EventType | null = kind === 'charge' ? (tx.status_code === PAYPLUS_SUCCESS_CODE ? 'payment_confirmed' : 'payment_failed')
    : kind === 'refund' ? 'refund' : null;
  const occurredAt = payplusDateToIso(tx.date);
  if (!type || !occurredAt) return null;
  // review 2026-10-22: a numeric string ("306" / "306.00") is the same amount - never a silent "no amount" (rejected) for a real payment
  const amountNum = typeof tx.amount === 'number' ? tx.amount
    : typeof tx.amount === 'string' && /^\d{1,9}(\.\d{1,2})?$/.test(tx.amount.trim()) ? Number(tx.amount.trim()) : NaN;
  const paidAmountMinor = Number.isFinite(amountNum) && amountNum > 0 ? Math.round(amountNum * 100) : null;
  return { id: tx.uid, type, occurredAt, attemptId, paidAmountMinor, paidCurrency: tx.currency as 'ILS' | 'USD', recurringRef, terminalRef };
}

export function createPayPlusProvider(cfg: PayPlusConfig): BillingProvider {
  const bases = Object.values(PAYPLUS_API_BASES) as string[];
  if (!bases.includes(cfg.apiBase) || typeof cfg.apiKey !== 'string' || cfg.apiKey.length < 8 || typeof cfg.secretKey !== 'string'
      || cfg.secretKey.length < 16 || typeof cfg.paymentPageUid !== 'string' || !UUID.test(cfg.paymentPageUid)
      || !isHttps(cfg.callbackUrl) || !isHttps(cfg.successUrl) || !isHttps(cfg.failureUrl) || (cfg.cancelUrl !== undefined && !isHttps(cfg.cancelUrl))
      || typeof cfg.fetch !== 'function'
      || typeof cfg.now !== 'function') {
    throw new Error('createPayPlusProvider: invalid configuration');
  }
  const keyPromise = globalThis.crypto.subtle.importKey('raw', enc.encode(cfg.secretKey) as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = async (bytes: Uint8Array) =>
    new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', await keyPromise, bytes as unknown as ArrayBuffer));

  return Object.freeze({
    name: PAYPLUS_PROVIDER_NAME,
    async createCheckout(i: { attemptId: string; currency: 'ILS' | 'USD'; amountMinor: number; billingPeriod?: BillingPeriod; addOnAmountMinor?: number | null }) {
      // ILS (Israel) or USD (International, 2026-10-21 prepared); the package only (a legacy style plan carries no billing period)
      if ((i.currency !== 'ILS' && i.currency !== 'USD') || !UUID.test(i.attemptId) || !Number.isInteger(i.amountMinor) || i.amountMinor <= 0
          || (i.billingPeriod !== 'month' && i.billingPeriod !== 'year')
          || (i.addOnAmountMinor != null && (!Number.isInteger(i.addOnAmountMinor) || i.addOnAmountMinor <= 0 || i.addOnAmountMinor >= i.amountMinor))) return null;
      const body = buildGenerateLinkBody(cfg, { attemptId: i.attemptId, amountMinor: i.amountMinor, billingPeriod: i.billingPeriod, nowMs: cfg.now(),
        addOnAmountMinor: i.addOnAmountMinor ?? null, currency: i.currency });
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
        recurringRef: mapped.recurringRef, terminalRef: mapped.terminalRef }) : null;
      if (!mapped || !event) return { ok: false, reason: 'invalid_event' };
      return { ok: true, event: mapped.paidAmountMinor === null ? event : { ...event, paid: { amountMinor: mapped.paidAmountMinor, currency: mapped.paidCurrency } } };
    },
  });
}

// -------------------------------------------------------------------------------------------------------- standing orders
// Sandbox run 2026-10-21 (Owner-typed authorization; docs/PAYPLUS_OPEN_QUESTIONS_IMPACT_2026-10-21.md): POST /PaymentPages/ipn with the
// page request id returns the standing order the payment created (uid, number, items, amount, extra_info = our attempt id) - a
// server PULL that works without any callback; /RecurringPayments/Update needs the undocumented field `valid: true` (422 without it);
// /RecurringPayments/DeleteRecurring cancels. Prepared only: nothing here is wired to a route while the billing phase is off.
export type PayPlusStandingOrder = {
  recurringUid: string; number: string | null; valid: boolean; status: string | null;
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
    recurringUid: d.uid, number: s(d.number), valid: d.valid === true, status: s(d.status), amountMinor: minor(d.amount), currency: cur,
    attemptId: typeof d.extra_info === 'string' && UUID.test(d.extra_info) ? d.extra_info : null, startDate: s(d.start_date),
    recurringType: typeof d.recurring_type === 'number' ? d.recurring_type : null, recurringRange: typeof d.recurring_range === 'number' ? d.recurring_range : null,
    items, customerUid: s(d.customer_uid), cashierUid: s(d.cashier_uid), cardToken: s(d.card_token),
  };
}

export function payplusStandingOrders(cfg: { apiBase: string; apiKey: string; secretKey: string; fetch: Fetch; timeoutMs?: number }) {
  if (!(Object.values(PAYPLUS_API_BASES) as string[]).includes(cfg.apiBase) || !cfg.apiKey || !cfg.secretKey || typeof cfg.fetch !== 'function') {
    throw new Error('payplusStandingOrders: invalid configuration');
  }
  const call = async (method: 'GET' | 'POST', path: string, body?: unknown): Promise<Record<string, unknown> | null> => {
    try {
      const res = await cfg.fetch(`${cfg.apiBase}${path}`, { method, headers: { 'content-type': 'application/json', 'api-key': cfg.apiKey, 'secret-key': cfg.secretKey },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(cfg.timeoutMs ?? 10_000) });
      const j = await res.json().catch(() => null);
      return isObj(j) ? j : null;
    } catch { return null; }
  };
  const ok = (j: Record<string, unknown> | null) => !!j && isObj(j.results) && j.results.status === 'success';
  return Object.freeze({
    /** the standing order a payment page created, pulled by the page request id (no callback needed) */
    async byPageRequest(pageRequestUid: string): Promise<PayPlusStandingOrder | null> {
      if (!UUID.test(pageRequestUid)) return null;
      const j = await call('POST', '/PaymentPages/ipn', { payment_request_uid: pageRequestUid });
      return ok(j) ? normalizeStandingOrder(j!.data) : null;
    },
    /** replace the lines of a standing order (e.g. SMART PACK added / removed); the next charge from startDate, nothing charged now */
    async updateLines(o: PayPlusStandingOrder, terminalUid: string, lines: { productUid: string; priceMinor: number; quantity?: number }[], startDate: string): Promise<boolean> {
      if (!UUID.test(o.recurringUid) || !UUID.test(terminalUid) || !o.customerUid || !o.cashierUid || !o.cardToken || !o.currency
          || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !lines.length || lines.some((l) => !UUID.test(l.productUid) || !Number.isInteger(l.priceMinor) || l.priceMinor <= 0)) return false;
      const j = await call('POST', `/RecurringPayments/Update/${o.recurringUid}`, {
        terminal_uid: terminalUid, customer_uid: o.customerUid, card_token: o.cardToken, cashier_uid: o.cashierUid, currency_code: o.currency,
        instant_first_payment: false, recurring_type: o.recurringType ?? 2, recurring_range: o.recurringRange ?? 1, number_of_charges: 0,
        start_date: startDate, valid: true,
        items: lines.map((l) => ({ product_uid: l.productUid, quantity: l.quantity ?? 1, price: l.priceMinor / 100 })),
      });
      return ok(j);
    },
    /** stop a standing order (no further charges) */
    async cancel(recurringUid: string, terminalUid: string): Promise<boolean> {
      if (!UUID.test(recurringUid) || !UUID.test(terminalUid)) return false;
      return ok(await call('POST', `/RecurringPayments/DeleteRecurring/${recurringUid}`, { terminal_uid: terminalUid }));
    },
  });
}

// -------------------------------------------------------------------------------------------------------- Function secrets
// Owner night task 2026-10-21: the provider is built from the Function secrets the Owner sets (never in code, never shown).
// Still INERT: the billing phase stays the code constant ACTIVATION_PHASE 'off', so checkout and callbacks answer 503 before the
// provider is ever used. A missing or invalid secret = no provider (UNAVAILABLE_PROVIDER), never a guess.
export const PAYPLUS_SECRET_NAMES = Object.freeze(['PAYPLUS_API_KEY', 'PAYPLUS_SECRET_KEY', 'PAYPLUS_PAYMENT_PAGE_UID', 'PAYPLUS_ENVIRONMENT',
  'PAYPLUS_RETURN_ORIGIN'] as const);
/** the browser return pages: the app's own origin only */
export const PAYPLUS_RETURN_ORIGINS = Object.freeze(['https://www.tekango.com', 'https://tekango.com']);
export const PAYPLUS_RETURN_PATHS = Object.freeze({
  success: '/dashboard?billing=processing', failure: '/dashboard?billing=failed', cancel: '/dashboard?billing=cancelled',
});

/** The PayPlus provider from the Function secrets, or null. `get` reads ONE named secret; supabaseUrl = this project's URL (the callback). */
export function payplusProviderFromSecrets(get: (name: typeof PAYPLUS_SECRET_NAMES[number]) => string | undefined, supabaseUrl: string,
  fetchImpl: Fetch, now: () => number): BillingProvider | null {
  const apiKey = (get('PAYPLUS_API_KEY') ?? '').trim();
  const secretKey = (get('PAYPLUS_SECRET_KEY') ?? '').trim();
  const paymentPageUid = (get('PAYPLUS_PAYMENT_PAGE_UID') ?? '').trim().toLowerCase();
  const environment = (get('PAYPLUS_ENVIRONMENT') ?? '').trim();
  // the LIVE app is the default only for the production terminal; a staging terminal must name its return origin
  const origin = ((get('PAYPLUS_RETURN_ORIGIN') ?? '').trim() || (environment === 'production' ? PAYPLUS_RETURN_ORIGINS[0] : '')).replace(/\/+$/, '');
  if (!apiKey || !secretKey || !paymentPageUid || (environment !== 'production' && environment !== 'staging')) return null;
  if (!PAYPLUS_RETURN_ORIGINS.includes(origin) || !isHttps(supabaseUrl)) return null;
  try {
    return createPayPlusProvider({
      apiBase: PAYPLUS_API_BASES[environment], apiKey, secretKey, paymentPageUid,
      callbackUrl: `${new URL(supabaseUrl).origin}/functions/v1/subscription-authority/provider-event`,
      successUrl: origin + PAYPLUS_RETURN_PATHS.success, failureUrl: origin + PAYPLUS_RETURN_PATHS.failure,
      cancelUrl: origin + PAYPLUS_RETURN_PATHS.cancel, fetch: fetchImpl, now,
    });
  } catch {
    return null;
  }
}
