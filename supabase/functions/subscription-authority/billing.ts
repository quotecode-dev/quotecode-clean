// TEKANGO billing - provider-neutral checkout + verified webhook handling (spec Phase 9, §9; OD-03..OD-08; OPEN-09/12).
// Pure, dependency-injected module (Deno + vitest). No provider is integrated: the only provider available is
// UNAVAILABLE_PROVIDER (OPEN-12 - no written PayPlus/Max terminal, recurring/tokenization or signed-webhook evidence).
// createHmacWebhookVerifier is a GENERIC signature/timestamp/source verifier shape used with mocks; it is NOT a claim about
// PayPlus's actual scheme and must be bound to the documented PayPlus contract before any sandbox use.
// PayPlus phase 1 (Owner 2026-10-18): payplus.ts is the PayPlus provider bound to the documented contract; it is NOT wired (wiring.ts).
//
// Trust boundary:
//   * the user comes from the verified JWT; the market from the server (account_market via SQL); the amount from the server
//     price catalog (price_versions). A body amount / currency / rate / market / account id is never read.
//   * a browser redirect is never an entitlement: only a VERIFIED provider event recorded by SQL changes subscription state.
//   * webhook: signature + timestamp window + source are verified BEFORE anything is parsed or stored; the provider event id
//     makes processing idempotent; an older event never overwrites newer state (SQL: 'stale').

export type Resp = { status: number; body: Record<string, unknown> };
export type BillingPhase = 'off' | 'prepared' | 'enforced';
export type Market = 'IL' | 'INTERNATIONAL';
type Headers = { get(name: string): string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PRICE_ID = /^[a-z0-9_]{3,64}$/;
const err = (status: number, code: string): Resp => ({ status, body: { ok: false, code } });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const enc = new TextEncoder();

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------------------------------------ server price catalog
// Legacy style plans (OD-03..OD-08, offer 'legacy': existing rights only) keep their monthly path unchanged. Task 27 (§249 + the Owner's
// 2026-10-11 amendment): the CURRENT offer is the all-inclusive package, monthly or annual, from the server rows only (IL 3000 / 30600
// ILS incl. VAT; INTERNATIONAL 1800 / 18400 USD) - the amount charged is the amount displayed.
export const PLAN_PRICE_IDS = Object.freeze(['classic', 'modern', 'visual'] as const);
export const PACKAGE_PLAN_ID = 'all_inclusive';
// Owner 2026-10-20 (20261021400000): the SMART PACK add-on - a second line of the same package payment, same market and cycle
export const SMART_PACK_PLAN_ID = 'smart_pack';
const CURRENT_OFFER_PLAN_IDS: readonly string[] = Object.freeze([PACKAGE_PLAN_ID, SMART_PACK_PLAN_ID]);
export const PACKAGE_PERIODS = Object.freeze(['month', 'year'] as const);
export const BLOCK_PLAN_ID = 'catalog_block_100';
export type BillingPeriod = 'month' | 'year';
export type PriceRow = { priceId: string; planId: string; currency: 'ILS' | 'USD'; billingPeriod: BillingPeriod; amountMinor: number; taxMode: string; offer: 'current' | 'legacy' };

/** get_price_catalog(market) answer -> rows. Only the market's own currency is accepted (IL=ILS, INTERNATIONAL=USD). */
export function parseCatalog(raw: unknown, market: Market): PriceRow[] | null {
  if (!isObj(raw) || raw.ok !== true || raw.market !== market || !Array.isArray(raw.prices)) return null;
  const want = market === 'IL' ? 'ILS' : 'USD';
  const out: PriceRow[] = [];
  for (const p of raw.prices as unknown[]) {
    if (!isObj(p) || p.currency !== want || !(p.billingPeriod === 'month' || p.billingPeriod === 'year') || !Number.isInteger(p.amountMinor) || (p.amountMinor as number) <= 0) return null;
    if (typeof p.priceId !== 'string' || !PRICE_ID.test(p.priceId) || typeof p.planId !== 'string') return null;
    // a year row exists only for the package and its SMART PACK add-on; a row without an offer class is a pre-Task-27 legacy row
    if (p.billingPeriod === 'year' && !CURRENT_OFFER_PLAN_IDS.includes(p.planId)) return null;
    const offer = p.offer === 'current' ? 'current' : p.offer === undefined || p.offer === 'legacy' ? 'legacy' : null;
    if (!offer || (offer === 'current') !== CURRENT_OFFER_PLAN_IDS.includes(p.planId)) return null;
    out.push({ priceId: p.priceId, planId: p.planId, currency: want, billingPeriod: p.billingPeriod as BillingPeriod, amountMinor: p.amountMinor as number,
      taxMode: String(p.taxMode), offer });
  }
  return out;
}

/** The checkout amount from the SERVER catalog only: plan + blocks x (+100 block). No VAT is ever added (OD-05). */
export function computeCheckoutAmount(prices: readonly PriceRow[] | null, planId: unknown, blocks: unknown, billingPeriod: unknown = 'month',
  smartPack: unknown = false):
  { currency: 'ILS' | 'USD'; amountMinor: number; planPriceId: string; blockPriceId: string | null;
    addOnPriceId?: string | null; packageAmountMinor?: number; addOnAmountMinor?: number | null } | null {
  if (!prices || typeof planId !== 'string' || typeof smartPack !== 'boolean') return null;
  if (planId === PACKAGE_PLAN_ID) {
    // the package: one current row of the chosen period; no add-on blocks on this path
    if (!(PACKAGE_PERIODS as readonly unknown[]).includes(billingPeriod) || blocks !== 0) return null;
    const row = prices.filter((p) => p.planId === PACKAGE_PLAN_ID && p.offer === 'current' && p.billingPeriod === billingPeriod);
    if (row.length !== 1) return null;
    // Owner 2026-10-20: the ticked SMART PACK box adds its own current row of the same cycle (same currency) to the same payment
    let addOn: PriceRow | null = null;
    if (smartPack) {
      const a = prices.filter((p) => p.planId === SMART_PACK_PLAN_ID && p.offer === 'current' && p.billingPeriod === billingPeriod);
      if (a.length !== 1 || a[0].currency !== row[0].currency) return null;
      addOn = a[0];
    }
    return { currency: row[0].currency, amountMinor: row[0].amountMinor + (addOn ? addOn.amountMinor : 0), planPriceId: row[0].priceId,
      blockPriceId: null, addOnPriceId: addOn ? addOn.priceId : null, packageAmountMinor: row[0].amountMinor,
      addOnAmountMinor: addOn ? addOn.amountMinor : null };
  }
  if (smartPack) return null; // SMART PACK rides only on the package
  if (!(PLAN_PRICE_IDS as readonly string[]).includes(planId) || billingPeriod !== 'month') return null;
  if (!Number.isInteger(blocks) || (blocks as number) < 0 || (blocks as number) > 1000) return null;
  const plan = prices.filter((p) => p.planId === planId && p.billingPeriod === 'month');
  const block = prices.filter((p) => p.planId === BLOCK_PLAN_ID);
  if (plan.length !== 1 || block.length > 1) return null;
  const n = blocks as number;
  if (n > 0 && block.length !== 1) return null;
  if (n > 0 && block[0].currency !== plan[0].currency) return null;
  return { currency: plan[0].currency, amountMinor: plan[0].amountMinor + n * (n > 0 ? block[0].amountMinor : 0),
    planPriceId: plan[0].priceId, blockPriceId: n > 0 ? block[0].priceId : null };
}

// ------------------------------------------------------------------------------------------------ provider interface
export const EVENT_TYPES = Object.freeze(['payment_confirmed', 'payment_failed', 'subscription_cancelled', 'refund',
  'renewal_failed', 'payment_succeeded', 'renewed', 'line_added', 'line_removed'] as const);
export type EventType = typeof EVENT_TYPES[number];
export type LineEvent = { lineType: 'catalog_block'; quantity: number; priceVersionId: string; effectiveFrom: string; providerRef: string };
/** The ONLY fields of a provider event the system ever reads. Amount / currency / rate / plan rights are never read. */
export type ProviderEvent = { providerEventId: string; type: EventType; occurredAt: string; attemptId: string | null;
  userId: string | null; line: LineEvent | null;
  /** PayPlus phase 1: what the provider says was charged - compared for EQUALITY with the server attempt in SQL, never a price */
  paid?: { amountMinor: number; currency: 'ILS' | 'USD' };
  /** 20261022000000: the provider's standing-order id (+ terminal) - a renewal without our attempt id reaches the bound attempt in SQL */
  standingOrder?: { recurringRef: string; terminalRef: string | null };
  /** 20261025300000: a SMART PACK add-on page of an active subscriber (never together with a package attempt or a standing order) */
  addOnId?: string };
export type WebhookRejection = 'invalid_signature' | 'stale_timestamp' | 'untrusted_source' | 'invalid_event' | 'provider_unavailable';
export type WebhookVerification = { ok: true; event: ProviderEvent } | { ok: false; reason: WebhookRejection };
/** 20261022200000: what the provider answers for a payment page the server asks about (no callback needed). approved = the first
 *  charge succeeded and the standing order is live; the amount / currency are compared for EQUALITY in SQL, never a price. */
export type PulledCheckout = { attemptId: string | null; recurringRef: string; amountMinor: number | null; currency: 'ILS' | 'USD' | null;
  approved: boolean; payloadSha256: string };
/** 20261025300000: what the provider answers for a SMART PACK add-on page (a one-time charge) */
export type PulledAddOn = { addOnId: string | null; amountMinor: number | null; currency: 'ILS' | 'USD' | null; approved: boolean; payloadSha256: string };
/** 20261025300000: what the SMART PACK line on the live package's standing order needs (from SQL: smart_pack_add_on_line_begin) */
// 20261025400000: terminalRef null = a standing order bound by the server pull (no terminal) - the provider uses the account terminal
// Owner console 2026-10-26 (typed: "מאשר הסרת חכם פלוס בשירות עצמי: בחודשי בסוף התקופה ששולמה בלי החזר, בשנתי לפי סעיף 6 ..."): what taking the SMART PACK line off the standing order needs
// (from SQL: smart_pack_removal_begin)
export type SmartPackRemovalRequest = { removalId: string; packageAttemptId: string; recurringRef: string; terminalRef: string | null; packageRequestRef: string;
  packageAmountMinor: number; addOnAmountMinor: number; period: BillingPeriod; currency: 'ILS'; nextChargeDate: string };
export type SmartPackLineRequest = { addOnId: string; packageAttemptId: string; recurringRef: string; terminalRef: string | null; packageRequestRef: string;
  packageAmountMinor: number; addOnAmountMinor: number; period: BillingPeriod; currency: 'ILS'; nextChargeDate: string };

/** Owner 2026-10-25 (the first real charge came back as "General Customer" with no email - no invoice, no approval email): the
 *  paying account's own business details from its settings row; each value is optional and validated before use. */
export type CheckoutCustomer = { name: string | null; email: string | null };
const CUSTOMER_EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
export function cleanCheckoutCustomer(v: unknown): CheckoutCustomer | null {
  if (!isObj(v)) return null;
  const name = typeof v.name === 'string' ? v.name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) : '';
  const email = typeof v.email === 'string' ? v.email.trim().toLowerCase() : '';
  const out = { name: name || null, email: CUSTOMER_EMAIL.test(email) && email.length <= 254 ? email : null };
  return out.name || out.email ? out : null;
}

export interface BillingProvider {
  readonly name: string;
  /** hosted checkout for an already-created server attempt; amount/currency (and the package period) come from that attempt only */
  createCheckout(i: { attemptId: string; currency: 'ILS' | 'USD'; amountMinor: number; billingPeriod?: BillingPeriod;
    /** Owner 2026-10-20: the SMART PACK line of the same payment (amountMinor = package + add-on) */
    addOnAmountMinor?: number | null;
    /** Owner 2026-10-25: the account's own business name / email - the invoice and the payment emails go to them (never a body value) */
    customer?: CheckoutCustomer | null }): Promise<{ redirectUrl: string; pageRequestUid?: string } | null>;
  /** signature + timestamp window + source; returns the normalized event only when all three pass */
  verifyWebhook(rawBody: Uint8Array, headers: Headers, nowMs: number): Promise<WebhookVerification>;
  /** 20261022200000: the result of a payment page by its request id (createCheckout's pageRequestUid); null = nothing to read yet */
  pullCheckout?(pageRequestUid: string): Promise<PulledCheckout | null>;
  /** 20261025300000: the one-time SMART PACK page of an active subscriber (the server's pro-rata amount) */
  createAddOnCheckout?(i: { addOnId: string; currency: 'ILS'; amountMinor: number; billingPeriod: BillingPeriod; customer?: CheckoutCustomer | null }):
    Promise<{ redirectUrl: string; pageRequestUid?: string } | null>;
  pullAddOnCheckout?(pageRequestUid: string): Promise<PulledAddOn | null>;
  /** the SMART PACK line on the live package's standing order: 'unknown' = no answer (tried again later) */
  addSmartPackLine?(i: SmartPackLineRequest): Promise<'added' | 'not_added' | 'unknown'>;
  /** 20261027100000: the SMART PACK line taken off the standing order; a yearly SMART PACK refunded pro rata (section 6) */
  removeSmartPackLine?(i: SmartPackRemovalRequest): Promise<'removed' | 'refused' | 'unknown'>;
  refund?(transactionUid: string, amountMinor: number): Promise<{ ok: true; refundRef: string } | { ok: false }>;
}

// The only provider available today: none (OPEN-12). Checkout is unavailable and every webhook is refused.
export const UNAVAILABLE_PROVIDER: BillingProvider = Object.freeze({
  name: 'unavailable',
  createCheckout: async () => null,
  verifyWebhook: async () => ({ ok: false, reason: 'provider_unavailable' }) as WebhookVerification,
});

const isIso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));

/** Strict allowlist parse of a (verified) provider payload. Unknown fields are dropped, never copied. */
export function parseProviderEvent(raw: unknown): ProviderEvent | null {
  if (!isObj(raw)) return null;
  const { id, type, occurredAt, attemptId, userId, line, recurringRef, terminalRef, addOnId } = raw;
  if (typeof id !== 'string' || id.length < 1 || id.length > 200 || !(EVENT_TYPES as readonly string[]).includes(type as string) || !isIso(occurredAt)) return null;
  const t = type as EventType;
  const att = attemptId === undefined || attemptId === null ? null : attemptId;
  const uid = userId === undefined || userId === null ? null : userId;
  if (att !== null && (typeof att !== 'string' || !UUID.test(att))) return null;
  if (uid !== null && (typeof uid !== 'string' || !UUID.test(uid))) return null;
  // 20261025300000: a SMART PACK add-on page event - a payment / failure / refund of that page only
  if (addOnId !== undefined && addOnId !== null) {
    if (typeof addOnId !== 'string' || !UUID.test(addOnId) || att !== null || (line !== undefined && line !== null)
        || !['payment_confirmed', 'payment_failed', 'refund'].includes(t)) return null;
    return { providerEventId: id, type: t, occurredAt, attemptId: null, userId: uid, line: null, addOnId };
  }
  const ref = (v: unknown) => (typeof v === 'string' && v.length >= 1 && v.length <= 200 ? v : null);
  if (recurringRef !== undefined && recurringRef !== null && !ref(recurringRef)) return null;
  if (terminalRef !== undefined && terminalRef !== null && !ref(terminalRef)) return null;
  const standingOrder = ref(recurringRef) ? { recurringRef: recurringRef as string, terminalRef: ref(terminalRef) } : null;
  let parsedLine: LineEvent | null = null;
  if (t === 'line_added' || t === 'line_removed') {
    if (!isObj(line) || uid === null) return null;
    const { lineType, quantity, priceVersionId, effectiveFrom, providerRef } = line;
    if (lineType !== 'catalog_block' || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 1000) return null;
    if (typeof priceVersionId !== 'string' || !PRICE_ID.test(priceVersionId) || !priceVersionId.includes('catalog_block')) return null;
    if (!isIso(effectiveFrom) || typeof providerRef !== 'string' || providerRef.length < 1 || providerRef.length > 200) return null;
    parsedLine = { lineType, quantity: quantity as number, priceVersionId, effectiveFrom, providerRef };
  } else if (att === null && !standingOrder) {
    return null; // subscription events always reference the server checkout attempt (directly, or through its bound standing order)
  }
  return { providerEventId: id, type: t, occurredAt, attemptId: att, userId: uid, line: parsedLine, ...(standingOrder ? { standingOrder } : {}) };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
function decodeSig(s: string, encoding: 'hex' | 'base64'): Uint8Array | null {
  try {
    if (encoding === 'hex') {
      if (!/^[0-9a-fA-F]+$/.test(s) || s.length % 2) return null;
      return Uint8Array.from(s.match(/../g)!, (h) => parseInt(h, 16));
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch { return null; }
}

export type HmacVerifierConfig = {
  secret: Uint8Array; signatureHeader: string; timestampHeader: string; toleranceSeconds: number;
  sourceHeader: string; allowedSources: readonly string[]; encoding: 'hex' | 'base64';
};
/** Generic HMAC-SHA256 over `${timestamp}.${rawBody}` with a timestamp window and a source allowlist (mock shape). */
export function createHmacWebhookVerifier(cfg: HmacVerifierConfig): BillingProvider['verifyWebhook'] {
  if (!(cfg.secret instanceof Uint8Array) || cfg.secret.length < 16 || !(cfg.toleranceSeconds > 0) || cfg.allowedSources.length === 0) {
    throw new Error('createHmacWebhookVerifier: invalid configuration');
  }
  return async (rawBody, headers, nowMs) => {
    const sigText = headers.get(cfg.signatureHeader) ?? '';
    const tsText = headers.get(cfg.timestampHeader) ?? '';
    const sig = decodeSig(sigText.trim(), cfg.encoding);
    if (!sig) return { ok: false, reason: 'invalid_signature' };
    if (!/^\d{1,12}$/.test(tsText)) return { ok: false, reason: 'stale_timestamp' };
    if (Math.abs(nowMs / 1000 - Number(tsText)) > cfg.toleranceSeconds) return { ok: false, reason: 'stale_timestamp' };
    if (!cfg.allowedSources.includes(headers.get(cfg.sourceHeader) ?? '')) return { ok: false, reason: 'untrusted_source' };
    const key = await globalThis.crypto.subtle.importKey('raw', cfg.secret as unknown as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signed = new Uint8Array(enc.encode(`${tsText}.`).length + rawBody.length);
    signed.set(enc.encode(`${tsText}.`), 0); signed.set(rawBody, enc.encode(`${tsText}.`).length);
    const mac = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, signed as unknown as ArrayBuffer));
    if (!bytesEqual(mac, sig)) return { ok: false, reason: 'invalid_signature' };
    let json: unknown;
    try { json = JSON.parse(new TextDecoder().decode(rawBody)); } catch { return { ok: false, reason: 'invalid_event' }; }
    const event = parseProviderEvent(json);
    return event ? { ok: true, event } : { ok: false, reason: 'invalid_event' };
  };
}

// ------------------------------------------------------------------------------------------------ SQL interface (stream A)
export interface BillingSql {
  /** create_checkout_intent(p_user_id, p_plan_id, p_blocks, p_idempotency_key) - legacy style plans */
  createCheckoutIntent(userId: string, planId: string, blocks: number, idempotencyKey: string): Promise<Record<string, unknown>>;
  /** create_package_checkout_intent(p_user_id, p_billing_period, p_idempotency_key, p_smart_pack) - the all-inclusive package (Task 27)
   *  + the optional SMART PACK line (20261021400000) */
  createPackageCheckoutIntent?(userId: string, billingPeriod: BillingPeriod, idempotencyKey: string, smartPack?: boolean): Promise<Record<string, unknown>>;
  /** get_price_catalog(p_market) */
  priceCatalog(market: Market): Promise<unknown>;
  /** Owner 2026-10-25: the paying account's business_settings business_name / email (by the verified user id) */
  checkoutCustomer?(userId: string): Promise<unknown>;
  /** 20261022100000 (Codex audit H05): the provider page already opened for this pending attempt (one page per attempt) */
  checkoutPage?(attemptId: string, userId: string): Promise<string | null>;
  /** record_checkout_attempt_page - set once; returns the STORED page (a concurrent second page never wins) */
  recordCheckoutPage?(attemptId: string, userId: string, url: string): Promise<string | null>;
  /** 20261022200000 record_checkout_attempt_page_and_request - the page and its provider request id, set once together */
  recordCheckoutPageAndRequest?(attemptId: string, userId: string, url: string, requestRef: string): Promise<string | null>;
  /** checkout_pull_targets(p_user_id) - the account's own pending attempts with a page from the last 24 hours (3 at most) */
  checkoutPullTargets?(userId: string): Promise<unknown>;
  /** record_checkout_pull(p_attempt_id, p_user_id, p_provider_attempt_id, p_recurring_ref, p_paid_amount_minor, p_paid_currency,
   *  p_payload_sha256) - providerAttemptId = the attempt id the provider's answer named (SQL requires it to equal attemptId) */
  recordCheckoutPull?(p: { attemptId: string; userId: string; providerAttemptId: string | null; recurringRef: string; paidAmountMinor: number | null;
    paidCurrency: string | null; payloadSha256: string }): Promise<Record<string, unknown>>;
  /** record_verified_provider_event(provider, provider_event_id, event_type, attempt_id, recurring_ref, terminal_ref, provider_event_time,
   *  payload_sha256, paid_amount_minor, paid_currency) - 20261022000000; the attempt id may be null only with a standing-order id */
  recordVerifiedEvent(e: { provider: string; providerEventId: string; eventType: string; attemptId: string | null; providerEventTime: string; payloadSha256: string;
    paidAmountMinor?: number; paidCurrency?: string; recurringRef?: string; terminalRef?: string | null }): Promise<Record<string, unknown>>;
  /** apply_verified_line_event(provider, provider_event_id, user_id, line_type, quantity, price_version_id, effective_from, provider_ref) */
  applyVerifiedLineEvent(e: { provider: string; providerEventId: string; userId: string; lineType: string; quantity: number; priceVersionId: string; effectiveFrom: string; providerRef: string; removal: boolean }): Promise<Record<string, unknown>>;
  // 20261025300000 (Owner 2026-10-25 "ב: חיוב יחסי עכשיו"): SMART PACK for an active subscriber - a one-time pro-rata charge, then the line
  /** smart_pack_add_on_quote(p_user_id) */
  smartPackAddOnQuote?(userId: string): Promise<Record<string, unknown>>;
  /** create_smart_pack_add_on_intent(p_user_id, p_idempotency_key) */
  createSmartPackAddOnIntent?(userId: string, idempotencyKey: string): Promise<Record<string, unknown>>;
  /** smart_pack_add_on_page / record_smart_pack_add_on_page (set once; the stored page wins) */
  smartPackAddOnPage?(addOnId: string, userId: string): Promise<string | null>;
  recordSmartPackAddOnPage?(addOnId: string, userId: string, url: string, requestRef: string | null): Promise<string | null>;
  /** smart_pack_add_on_pull_targets(p_user_id) / record_smart_pack_add_on_pull(...) */
  smartPackAddOnPullTargets?(userId: string): Promise<unknown>;
  recordSmartPackAddOnPull?(p: { addOnId: string; userId: string; providerAddOnId: string | null; paidAmountMinor: number | null; paidCurrency: string | null;
    payloadSha256: string }): Promise<Record<string, unknown>>;
  /** record_smart_pack_add_on_payment(provider, provider_event_id, event_type, add_on_id, provider_event_time, payload_sha256, paid_amount_minor, paid_currency) */
  recordSmartPackAddOnPayment?(e: { provider: string; providerEventId: string; eventType: string; addOnId: string; providerEventTime: string;
    payloadSha256: string; paidAmountMinor?: number; paidCurrency?: string }): Promise<Record<string, unknown>>;
  /** smart_pack_add_on_line_begin / _finish / _targets */
  smartPackAddOnLineBegin?(addOnId: string): Promise<Record<string, unknown>>;
  smartPackAddOnLineFinish?(addOnId: string, added: boolean): Promise<Record<string, unknown>>;
  smartPackAddOnLineTargets?(userId: string): Promise<unknown>;
  // 20261027100000 (Owner 2026-10-26): SMART PACK removed by the subscriber
  smartPackRemovalQuote?(userId: string): Promise<Record<string, unknown>>;
  requestSmartPackRemoval?(userId: string, idempotencyKey: string): Promise<Record<string, unknown>>;
  smartPackRemovalBegin?(removalId: string): Promise<Record<string, unknown>>;
  smartPackRemovalFinish?(removalId: string, removed: boolean): Promise<Record<string, unknown>>;
  smartPackRemovalTargets?(userId: string): Promise<unknown>;
  smartPackRemovalRefundsDue?(userId: string): Promise<unknown>;
  recordSmartPackRemovalRefund?(removalId: string, refundRef: string): Promise<Record<string, unknown>>;
  // 20261029000000 (Codex F01/F02): a refund is claimed before PayPlus is asked; an unproven answer is left for the Owner
  claimSmartPackRemovalRefund?(removalId: string): Promise<Record<string, unknown>>;
  markSmartPackRemovalRefundUnknown?(removalId: string): Promise<Record<string, unknown>>;
}

// ------------------------------------------------------------------------------------------------ checkout intent
/** Owner 2026-10-25: the only market where purchasing is open (international waits for PayPlus foreign-currency approval) */
export const OPEN_MARKET = 'IL' as const;
const CHECKOUT_CODES: Record<string, number> = { checkout_unavailable: 503, account_unprovisioned: 409, idempotency_conflict: 409, invalid_request: 400,
  already_subscribed: 409,
  // 20261021200000: in the grace days a failed renewal is paid on the live standing order (no second subscription)
  payment_update_required: 409,
  // review 2026-10-22: the same click again for an attempt that is no longer pending (paid / expired) opens no new page
  checkout_not_pending: 409,
  // 20261025200000 (Owner 2026-10-25): purchasing is open in Israel only
  market_not_open: 409 };
export async function checkoutIntentHandler(phase: BillingPhase, deps: { sql: BillingSql; provider: BillingProvider }, userId: string, body: unknown): Promise<Resp> {
  if (phase === 'off') return err(503, 'checkout_unavailable');
  if (typeof userId !== 'string' || !UUID.test(userId)) return err(401, 'not_authenticated');
  const b = isObj(body) ? body : {};
  // ONLY these fields are read; amount / currency / rate / market / price / account id in the body are ignored.
  const planId = b.planId; const blocks = b.blocks ?? 0; const key = b.idempotencyKey;
  const smartPack = b.smartPack ?? false; // Owner 2026-10-20: the ticked SMART PACK box (package only)
  const isPackage = planId === PACKAGE_PLAN_ID;
  const period = isPackage ? b.billingPeriod : 'month';
  if (typeof planId !== 'string' || !Number.isInteger(blocks) || typeof key !== 'string' || typeof smartPack !== 'boolean'
      || (smartPack && !isPackage)) return err(400, 'invalid_request');
  if (isPackage && (!(PACKAGE_PERIODS as readonly unknown[]).includes(period) || blocks !== 0 || typeof deps.sql.createPackageCheckoutIntent !== 'function')) {
    return err(400, 'invalid_request');
  }
  let r: Record<string, unknown>;
  try {
    r = isPackage
      ? await (deps.sql.createPackageCheckoutIntent as NonNullable<BillingSql['createPackageCheckoutIntent']>)(userId, period as BillingPeriod, key, smartPack)
      : await deps.sql.createCheckoutIntent(userId, planId, blocks as number, key);
  } catch { return err(503, 'checkout_unavailable'); }
  if (!isObj(r) || r.ok !== true) {
    const code = isObj(r) ? String(r.code) : '';
    return err(CHECKOUT_CODES[code] ?? 503, CHECKOUT_CODES[code] ? code : 'checkout_unavailable');
  }
  if (typeof r.attemptId !== 'string' || !UUID.test(r.attemptId) || (r.market !== 'IL' && r.market !== 'INTERNATIONAL')
      || !['ILS', 'USD'].includes(r.currency as string) || !Number.isInteger(r.amountMinor)) return err(503, 'checkout_unavailable');
  if (r.state !== undefined && r.state !== 'pending') return err(409, 'checkout_not_pending');
  // Owner 2026-10-25: Israel only until PayPlus approves foreign-currency billing (the SQL refuses first; never a page abroad)
  if (r.market !== OPEN_MARKET) return err(409, 'market_not_open');
  // Defence in depth: the SQL amount must equal the server catalog computation for the server market (never a client value).
  const market = r.market as Market;
  let catalogRaw: unknown;
  try { catalogRaw = await deps.sql.priceCatalog(market); } catch { return err(503, 'checkout_unavailable'); }
  const expected = computeCheckoutAmount(parseCatalog(catalogRaw, market), planId, blocks, period, smartPack);
  if (!expected || expected.currency !== r.currency || expected.amountMinor !== r.amountMinor) return err(503, 'checkout_unavailable');
  // the SQL attempt and the catalog must agree on the add-on line too (never a payment page for a line the attempt does not carry)
  if (isPackage && (r.addOnPriceId ?? null) !== (expected.addOnPriceId ?? null)) return err(503, 'checkout_unavailable');
  // 20261022100000 (Codex audit H05): one provider page per attempt - a retry of the same attempt (same idempotency key) gets the
  // page it already has; a new page is kept once and the stored page always wins
  const httpsPage = (v: unknown): v is string => typeof v === 'string' && /^https:\/\//.test(v);
  const answer = (redirectUrl: string): Resp => ({ status: 200, body: { ok: true, attemptId: r.attemptId, currency: expected.currency,
    amountMinor: expected.amountMinor, redirectUrl, state: 'pending', ...(isPackage ? { smartPack: Boolean(expected.addOnPriceId) } : {}) } });
  const existing = deps.sql.checkoutPage ? await deps.sql.checkoutPage(r.attemptId, userId).catch(() => null) : null;
  if (httpsPage(existing)) return answer(existing);
  // Owner 2026-10-25: the paying account's own business name / email (its settings row, by the verified user id) - a failed read opens
  // the page without them (the payment itself never depends on it)
  const customer = deps.sql.checkoutCustomer ? cleanCheckoutCustomer(await deps.sql.checkoutCustomer(userId).catch(() => null)) : null;
  const hosted = await deps.provider.createCheckout({ attemptId: r.attemptId, currency: expected.currency, amountMinor: expected.amountMinor,
    ...(isPackage ? { billingPeriod: period as BillingPeriod, addOnAmountMinor: expected.addOnAmountMinor ?? null } : {}),
    ...(customer ? { customer } : {}) }).catch(() => null);
  if (!hosted || !httpsPage(hosted.redirectUrl)) return err(503, 'checkout_unavailable');
  // 20261022200000: with the provider's page request id the page and the id are kept together (the server can pull the result later)
  const requestRef = typeof hosted.pageRequestUid === 'string' && UUID.test(hosted.pageRequestUid) ? hosted.pageRequestUid : null;
  let stored = requestRef && deps.sql.recordCheckoutPageAndRequest
    ? await deps.sql.recordCheckoutPageAndRequest(r.attemptId, userId, hosted.redirectUrl, requestRef).catch(() => null)
    : deps.sql.recordCheckoutPage ? await deps.sql.recordCheckoutPage(r.attemptId, userId, hosted.redirectUrl).catch(() => null) : null;
  // Codex audit 2026-10-22 H-01: a payment link only after the server KEPT it (with its request id - the pull needs it). A lost answer
  // is read back once; still nothing kept = no link (a page paid but never kept could not be pulled or matched).
  if (!httpsPage(stored) && deps.sql.checkoutPage) stored = await deps.sql.checkoutPage(r.attemptId, userId).catch(() => null);
  if (!httpsPage(stored)) {
    console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'checkout_page_not_stored' }));
    return err(503, 'checkout_unavailable');
  }
  // A redirect URL is NOT an entitlement: the success page shows "processing" until a verified provider event.
  return answer(stored);
}

// ------------------------------------------------------------------------------------------------ SMART PACK for an active subscriber
// Owner console 2026-10-25 ("ב: חיוב יחסי עכשיו"; 20261025300000): the amount is the server's (smart_pack_add_on_quote: the SMART PACK
// price of the package cycle x the days left of the paid period); the verified one-time payment gives SMART PACK to the period end,
// then the SMART PACK line joins the standing order so the renewals carry it. No body amount, period or account is ever read.
const ADD_ON_CODES: Record<string, number> = { checkout_unavailable: 503, invalid_request: 400, market_not_open: 409, not_eligible: 409,
  already_included: 409, checkout_not_pending: 409 };
const addOnError = (r: unknown): Resp => {
  const code = isObj(r) ? String(r.code) : '';
  return err(ADD_ON_CODES[code] ?? 503, ADD_ON_CODES[code] ? code : 'checkout_unavailable');
};
const isPeriod = (v: unknown): v is BillingPeriod => v === 'month' || v === 'year';

export async function smartPackAddOnQuoteHandler(phase: BillingPhase, deps: { sql: BillingSql }, userId: string): Promise<Resp> {
  if (phase === 'off') return err(503, 'checkout_unavailable');
  if (typeof userId !== 'string' || !UUID.test(userId)) return err(401, 'not_authenticated');
  if (typeof deps.sql.smartPackAddOnQuote !== 'function') return err(503, 'checkout_unavailable');
  let r: Record<string, unknown>;
  try { r = await deps.sql.smartPackAddOnQuote(userId); } catch { return err(503, 'checkout_unavailable'); }
  if (!isObj(r) || r.ok !== true) return addOnError(r);
  if (r.currency !== 'ILS' || !Number.isInteger(r.amountMinor) || (r.amountMinor as number) <= 0 || !Number.isInteger(r.recurringMinor)
      || !isPeriod(r.period) || !isIso(r.periodEnd)) return err(503, 'checkout_unavailable');
  return { status: 200, body: { ok: true, currency: 'ILS', amountMinor: r.amountMinor, recurringMinor: r.recurringMinor, period: r.period,
    periodEnd: r.periodEnd, ...(Number.isInteger(r.daysLeft) ? { daysLeft: r.daysLeft } : {}) } };
}

export async function smartPackAddOnIntentHandler(phase: BillingPhase, deps: { sql: BillingSql; provider: BillingProvider }, userId: string, body: unknown): Promise<Resp> {
  if (phase === 'off') return err(503, 'checkout_unavailable');
  if (typeof userId !== 'string' || !UUID.test(userId)) return err(401, 'not_authenticated');
  const key = isObj(body) ? body.idempotencyKey : undefined; // the ONLY field read
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) return err(400, 'invalid_request');
  const { sql, provider } = deps;
  if (typeof sql.createSmartPackAddOnIntent !== 'function' || typeof sql.recordSmartPackAddOnPage !== 'function'
      || typeof provider.createAddOnCheckout !== 'function') return err(503, 'checkout_unavailable');
  let r: Record<string, unknown>;
  try { r = await sql.createSmartPackAddOnIntent(userId, key); } catch { return err(503, 'checkout_unavailable'); }
  if (!isObj(r) || r.ok !== true) return addOnError(r);
  if (typeof r.addOnId !== 'string' || !UUID.test(r.addOnId) || r.market !== OPEN_MARKET || r.currency !== 'ILS' || !Number.isInteger(r.amountMinor)
      || (r.amountMinor as number) <= 0 || !isPeriod(r.period)) return err(503, 'checkout_unavailable');
  if (r.state !== 'pending') return err(409, 'checkout_not_pending');
  const addOnId = r.addOnId; const amountMinor = r.amountMinor as number;
  const httpsPage = (v: unknown): v is string => typeof v === 'string' && /^https:\/\//.test(v);
  const answer = (redirectUrl: string): Resp => ({ status: 200, body: { ok: true, addOnId, currency: 'ILS', amountMinor, redirectUrl, state: 'pending' } });
  const existing = sql.smartPackAddOnPage ? await sql.smartPackAddOnPage(addOnId, userId).catch(() => null) : null;
  if (httpsPage(existing)) return answer(existing);
  const customer = sql.checkoutCustomer ? cleanCheckoutCustomer(await sql.checkoutCustomer(userId).catch(() => null)) : null;
  const hosted = await provider.createAddOnCheckout({ addOnId, currency: 'ILS', amountMinor, billingPeriod: r.period as BillingPeriod,
    ...(customer ? { customer } : {}) }).catch(() => null);
  if (!hosted || !httpsPage(hosted.redirectUrl)) return err(503, 'checkout_unavailable');
  const requestRef = typeof hosted.pageRequestUid === 'string' && UUID.test(hosted.pageRequestUid) ? hosted.pageRequestUid : null;
  let stored = await sql.recordSmartPackAddOnPage(addOnId, userId, hosted.redirectUrl, requestRef).catch(() => null);
  if (!httpsPage(stored) && sql.smartPackAddOnPage) stored = await sql.smartPackAddOnPage(addOnId, userId).catch(() => null);
  if (!httpsPage(stored)) {
    console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'checkout_page_not_stored', kind: 'smart_pack_add_on' }));
    return err(503, 'checkout_unavailable');
  }
  return answer(stored);
}

function parseLineRequest(b: Record<string, unknown>): SmartPackLineRequest | null {
  const s = (v: unknown, re: RegExp) => typeof v === 'string' && re.test(v);
  if (!s(b.addOnId, UUID) || !s(b.packageAttemptId, UUID) || typeof b.recurringRef !== 'string' || !b.recurringRef || !(b.terminalRef === null || s(b.terminalRef, UUID))
      || !s(b.packageRequestRef, UUID) || !Number.isInteger(b.packageAmountMinor) || (b.packageAmountMinor as number) <= 0
      || !Number.isInteger(b.addOnAmountMinor) || (b.addOnAmountMinor as number) <= 0 || !isPeriod(b.period) || b.currency !== 'ILS'
      || !s(b.nextChargeDate, /^\d{4}-\d{2}-\d{2}$/)) return null;
  return { addOnId: b.addOnId as string, packageAttemptId: b.packageAttemptId as string, recurringRef: b.recurringRef, terminalRef: (b.terminalRef as string | null),
    packageRequestRef: b.packageRequestRef as string, packageAmountMinor: b.packageAmountMinor as number, addOnAmountMinor: b.addOnAmountMinor as number,
    period: b.period, currency: 'ILS', nextChargeDate: b.nextChargeDate as string };
}

/** the SMART PACK line on the live standing order after a verified add-on payment. 'unknown' leaves it 'requested' (tried again on the
 *  account's next return from a payment page); every outcome but 'added' is an incident for the Owner - never silent. */
export async function completeSmartPackLine(deps: { sql: BillingSql; provider: BillingProvider }, addOnId: string): Promise<'added' | 'not_added' | 'unknown' | 'skipped'> {
  const { sql, provider } = deps;
  const incident = (code: string) => console.error(JSON.stringify({ fn: 'subscription-authority', incident: code }));
  if (typeof sql.smartPackAddOnLineBegin !== 'function' || typeof sql.smartPackAddOnLineFinish !== 'function') return 'skipped';
  let b: Record<string, unknown>;
  try { b = await sql.smartPackAddOnLineBegin(addOnId); } catch { incident('smart_pack_line_unknown'); return 'unknown'; }
  if (!isObj(b) || b.ok !== true) {
    if (isObj(b) && b.code === 'line_not_possible') { incident('smart_pack_line_not_added'); return 'not_added'; }
    return 'skipped'; // already added / refused before: nothing to do
  }
  const req = parseLineRequest(b);
  const outcome = !req || typeof provider.addSmartPackLine !== 'function' ? 'not_added'
    : await provider.addSmartPackLine(req).catch(() => 'unknown' as const);
  if (outcome === 'unknown') { incident('smart_pack_line_unknown'); return 'unknown'; }
  try { await sql.smartPackAddOnLineFinish(addOnId, outcome === 'added'); } catch { incident('smart_pack_line_unknown'); return 'unknown'; }
  if (outcome !== 'added') incident('smart_pack_line_not_added');
  return outcome;
}

const ADD_ON_INCIDENTS = new Set(['amount_mismatch', 'second_charge', 'attempt_not_payable', 'package_not_live']);
async function addOnWebhook(deps: { sql: BillingSql; provider: BillingProvider }, e: ProviderEvent, payloadSha256: string): Promise<Resp> {
  if (typeof deps.sql.recordSmartPackAddOnPayment !== 'function') return err(503, 'retry_later');
  let r: Record<string, unknown>;
  try {
    r = await deps.sql.recordSmartPackAddOnPayment({ provider: deps.provider.name, providerEventId: e.providerEventId, eventType: e.type,
      addOnId: e.addOnId as string, providerEventTime: e.occurredAt, payloadSha256,
      ...(e.paid ? { paidAmountMinor: e.paid.amountMinor, paidCurrency: e.paid.currency } : {}) });
  } catch { return err(503, 'retry_later'); }
  if (!isObj(r) || r.ok !== true) {
    const code = isObj(r) ? String(r.code ?? '') : '';
    if (code === 'unknown_attempt') return err(404, code);
    if (code === 'invalid_event') return err(400, code);
    return err(503, code === 'billing_off' ? code : 'retry_later');
  }
  const code = typeof r.code === 'string' && /^[a-z_]{1,40}$/.test(r.code) ? r.code : null;
  if (code && ADD_ON_INCIDENTS.has(code)) {
    console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'smart_pack_payment_not_applied', code }));
  }
  if (r.activated === true && r.lineNeeded === true) await completeSmartPackLine(deps, e.addOnId as string);
  return { status: 200, body: { ok: true, duplicate: r.duplicate === true, ...(typeof r.outcome === 'string' && ['applied', 'stale', 'rejected', 'recorded'].includes(r.outcome) ? { outcome: r.outcome } : {}),
    ...(r.activated === false && code ? { activated: false, code } : {}) } };
}

// ------------------------------------------------------------------------------------------------ SMART PACK removal
// Owner console 2026-10-26 (typed: "מאשר הסרת חכם פלוס בשירות עצמי: בחודשי בסוף התקופה ששולמה בלי החזר, בשנתי לפי סעיף 6 ..."): the subscriber removes SMART PACK - it stops renewing (the
// standing order line comes off now), runs to the end of the paid period, and a yearly SMART PACK is refunded pro rata less the fee.
const REMOVAL_CODES: Record<string, number> = { checkout_unavailable: 503, not_eligible: 409, not_on_plan: 409, already_removed: 409, retry_later: 503,
  invalid_request: 400 };
const removalError = (r: unknown): Resp => {
  const code = isObj(r) ? String(r.code) : '';
  return err(REMOVAL_CODES[code] ?? 503, REMOVAL_CODES[code] ? code : 'checkout_unavailable');
};

export async function smartPackRemovalQuoteHandler(phase: BillingPhase, deps: { sql: BillingSql }, userId: string): Promise<Resp> {
  if (phase === 'off') return err(503, 'checkout_unavailable');
  if (typeof userId !== 'string' || !UUID.test(userId)) return err(401, 'not_authenticated');
  if (typeof deps.sql.smartPackRemovalQuote !== 'function') return err(503, 'checkout_unavailable');
  let r: Record<string, unknown>;
  try { r = await deps.sql.smartPackRemovalQuote(userId); } catch { return err(503, 'checkout_unavailable'); }
  if (!isObj(r) || r.ok !== true) {
    // an already scheduled removal answers its date, so the window can say so
    if (isObj(r) && r.code === 'already_removed' && isIso(r.effectiveAt)) return { status: 409, body: { ok: false, code: 'already_removed', effectiveAt: r.effectiveAt } };
    return removalError(r);
  }
  const int = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
  if (r.currency !== 'ILS' || !isPeriod(r.period) || !isIso(r.effectiveAt) || !int(r.refundMinor) || !int(r.recurringMinor)) return err(503, 'checkout_unavailable');
  return { status: 200, body: { ok: true, period: r.period, effectiveAt: r.effectiveAt, refundMinor: r.refundMinor, recurringMinor: r.recurringMinor,
    feeMinor: int(r.feeMinor) ? r.feeMinor : 0 } };
}

function parseRemovalRequest(b: Record<string, unknown>): SmartPackRemovalRequest | null {
  const s = (v: unknown, re: RegExp) => typeof v === 'string' && re.test(v);
  const pos = (v: unknown) => Number.isInteger(v) && (v as number) > 0;
  if (!s(b.removalId, UUID) || !s(b.packageAttemptId, UUID) || typeof b.recurringRef !== 'string' || !b.recurringRef || !(b.terminalRef === null || s(b.terminalRef, UUID))
      || !s(b.packageRequestRef, UUID) || !pos(b.packageAmountMinor) || !pos(b.addOnAmountMinor) || !isPeriod(b.period) || b.currency !== 'ILS'
      || !s(b.nextChargeDate, /^\d{4}-\d{2}-\d{2}$/)) return null;
  return { removalId: b.removalId as string, packageAttemptId: b.packageAttemptId as string, recurringRef: b.recurringRef, terminalRef: b.terminalRef as string | null,
    packageRequestRef: b.packageRequestRef as string, packageAmountMinor: b.packageAmountMinor as number, addOnAmountMinor: b.addOnAmountMinor as number,
    period: b.period, currency: 'ILS', nextChargeDate: b.nextChargeDate as string };
}

/** the line taken off after the request; 'unknown' leaves it 'requested' (tried again); every outcome but 'removed' is an incident */
export async function completeSmartPackRemoval(deps: { sql: BillingSql; provider: BillingProvider }, removalId: string): Promise<'removed' | 'refused' | 'unknown' | 'skipped'> {
  const { sql, provider } = deps;
  const incident = (code: string) => console.error(JSON.stringify({ fn: 'subscription-authority', incident: code }));
  if (typeof sql.smartPackRemovalBegin !== 'function' || typeof sql.smartPackRemovalFinish !== 'function') return 'skipped';
  let b: Record<string, unknown>;
  try { b = await sql.smartPackRemovalBegin(removalId); } catch { incident('smart_pack_removal_unknown'); return 'unknown'; }
  if (!isObj(b) || b.ok !== true) return 'skipped';
  const req = parseRemovalRequest(b);
  const outcome = !req || typeof provider.removeSmartPackLine !== 'function' ? 'refused' : await provider.removeSmartPackLine(req).catch(() => 'unknown' as const);
  if (outcome === 'unknown') { incident('smart_pack_removal_unknown'); return 'unknown'; }
  try { await sql.smartPackRemovalFinish(removalId, outcome === 'removed'); } catch { incident('smart_pack_removal_unknown'); return 'unknown'; }
  if (outcome !== 'removed') incident('smart_pack_removal_refused');
  return outcome;
}

/** section 6: every yearly refund due of the account is refunded once (recorded with the provider's refund id). 20261029000000 (Codex
 *  F01/F02): each refund is CLAIMED first (one request wins - two tabs never refund twice); a refund PayPlus did not prove, or one made
 *  but not recorded, is never sent again automatically - the daily reconciliation tells the Owner (REFUND_OWED). Answers per removal:
 *  'refunded' (made and recorded) or 'pending'. */
export async function refundDueRemovals(deps: { sql: BillingSql; provider: BillingProvider }, userId: string): Promise<Map<string, 'refunded' | 'pending'>> {
  const { sql, provider } = deps;
  const out = new Map<string, 'refunded' | 'pending'>();
  if (typeof sql.smartPackRemovalRefundsDue !== 'function' || typeof sql.recordSmartPackRemovalRefund !== 'function' || typeof provider.refund !== 'function'
      || typeof sql.claimSmartPackRemovalRefund !== 'function' || typeof sql.markSmartPackRemovalRefundUnknown !== 'function') return out;
  let due: unknown = [];
  try { due = await sql.smartPackRemovalRefundsDue(userId); } catch { return out; }
  const log = (incident: string) => console.error(JSON.stringify({ fn: 'subscription-authority', incident }));
  for (const d of Array.isArray(due) ? due.slice(0, 3) : []) {
    if (!isObj(d) || typeof d.removalId !== 'string' || !UUID.test(d.removalId)) continue;
    out.set(d.removalId, 'pending');
    let c: Record<string, unknown>;
    try { c = await sql.claimSmartPackRemovalRefund(d.removalId); } catch { log('smart_pack_removal_refund_claim_failed'); continue; }
    if (!isObj(c) || c.ok !== true) { if (isObj(c) && c.code === 'no_charge_ref') log('smart_pack_removal_refund_no_charge_ref'); continue; }
    if (typeof c.chargeRef !== 'string' || !Number.isInteger(c.amountMinor) || (c.amountMinor as number) <= 0) {
      await sql.markSmartPackRemovalRefundUnknown(d.removalId).catch(() => undefined);
      log('smart_pack_removal_refund_needs_owner'); continue;
    }
    const r = await provider.refund(c.chargeRef, c.amountMinor as number).catch(() => ({ ok: false as const }));
    if (!r.ok) {
      // a refusal and a lost answer look the same here: never refunded again automatically (the Owner checks PayPlus)
      await sql.markSmartPackRemovalRefundUnknown(d.removalId).catch(() => undefined);
      log('smart_pack_removal_refund_needs_owner'); continue;
    }
    try {
      const rec = await sql.recordSmartPackRemovalRefund(d.removalId, r.refundRef);
      if (isObj(rec) && rec.ok === true) out.set(d.removalId, 'refunded'); else log('smart_pack_removal_refund_unrecorded');
    } catch { log('smart_pack_removal_refund_unrecorded'); } // stays 'sending' - never sent again
  }
  return out;
}

/** what the screen may promise: 'refunded' only when the refund was made and recorded */
function removalRefundState(r: Record<string, unknown>, made: Map<string, 'refunded' | 'pending'>): 'refunded' | 'pending' | 'none' {
  if (!Number.isInteger(r.refundMinor) || (r.refundMinor as number) <= 0) return 'none';
  const now = typeof r.removalId === 'string' ? made.get(r.removalId) : undefined;
  if (now) return now;
  return r.refundState === 'refunded' ? 'refunded' : 'pending';
}

export async function smartPackRemovalRequestHandler(phase: BillingPhase, deps: { sql: BillingSql; provider: BillingProvider }, userId: string, body: unknown): Promise<Resp> {
  if (phase === 'off') return err(503, 'checkout_unavailable');
  if (typeof userId !== 'string' || !UUID.test(userId)) return err(401, 'not_authenticated');
  const key = isObj(body) ? body.idempotencyKey : undefined; // the ONLY field read
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) return err(400, 'invalid_request');
  const { sql } = deps;
  if (typeof sql.requestSmartPackRemoval !== 'function') return err(503, 'checkout_unavailable');
  let r: Record<string, unknown>;
  try { r = await sql.requestSmartPackRemoval(userId, key); } catch { return err(503, 'checkout_unavailable'); }
  if (!isObj(r) || r.ok !== true || typeof r.removalId !== 'string' || !UUID.test(r.removalId)) return removalError(r);
  const outcome = r.state === 'requested' ? await completeSmartPackRemoval(deps, r.removalId) : r.state === 'removed' ? 'removed' : 'refused';
  const made = outcome === 'removed' ? await refundDueRemovals(deps, userId) : new Map<string, 'refunded' | 'pending'>();
  return { status: 200, body: { ok: true, state: outcome === 'removed' ? 'removed' : outcome === 'refused' ? 'refused' : 'pending',
    ...(isIso(r.effectiveAt) ? { effectiveAt: r.effectiveAt } : {}), refundMinor: Number.isInteger(r.refundMinor) ? r.refundMinor : 0,
    refundState: removalRefundState(r, made) } };
}

// ------------------------------------------------------------------------------------------------ verified webhook
const OUTCOMES = new Set(['applied', 'stale', 'policy_pending', 'rejected']);
export async function providerWebhookHandler(phase: BillingPhase, deps: { sql: BillingSql; provider: BillingProvider; now: () => number },
  rawBody: Uint8Array, headers: Headers): Promise<Resp> {
  if (phase === 'off') return err(503, 'billing_off');
  if (!(rawBody instanceof Uint8Array) || rawBody.length === 0 || rawBody.length > 64 * 1024) return err(400, 'invalid_event');
  let v: WebhookVerification;
  try { v = await deps.provider.verifyWebhook(rawBody, headers, deps.now()); } catch { v = { ok: false, reason: 'invalid_signature' }; }
  if (!v.ok) return err(v.reason === 'invalid_event' ? 400 : v.reason === 'provider_unavailable' ? 503 : 401, v.reason); // nothing stored
  const e = v.event;
  const payloadSha256 = await sha256Hex(rawBody);
  if (e.addOnId) return addOnWebhook(deps, e, payloadSha256); // 20261025300000: a SMART PACK add-on page
  let r: Record<string, unknown>;
  try {
    if (e.line) {
      r = await deps.sql.applyVerifiedLineEvent({ provider: deps.provider.name, providerEventId: e.providerEventId, userId: e.userId as string,
        lineType: e.line.lineType, quantity: e.line.quantity, priceVersionId: e.line.priceVersionId, effectiveFrom: e.line.effectiveFrom,
        providerRef: e.line.providerRef, removal: e.type === 'line_removed' });
    } else {
      r = await deps.sql.recordVerifiedEvent({ provider: deps.provider.name, providerEventId: e.providerEventId, eventType: e.type,
        attemptId: e.attemptId, providerEventTime: e.occurredAt, payloadSha256,
        ...(e.paid ? { paidAmountMinor: e.paid.amountMinor, paidCurrency: e.paid.currency } : {}),
        ...(e.standingOrder ? { recurringRef: e.standingOrder.recurringRef, terminalRef: e.standingOrder.terminalRef } : {}) });
    }
  } catch {
    return err(503, 'retry_later'); // timeout / outage: the provider retries the same event id; processing is idempotent
  }
  if (!isObj(r) || r.ok !== true) {
    const code = isObj(r) ? String(r.code ?? '') : '';
    if (code === 'unknown_attempt') return err(404, code);
    if (code === 'invalid_event') return err(400, code);
    return err(503, code === 'billing_off' ? code : 'retry_later');
  }
  const outcome = typeof r.outcome === 'string' && OUTCOMES.has(r.outcome) ? r.outcome : undefined;
  // 20261022100000 (Codex audit H04): the receipt stays 200, but a payment that opened nothing says so and why
  const notActivatedCode = r.activated === false && typeof r.code === 'string' && /^[a-z_]{1,40}$/.test(r.code) ? r.code : null;
  const notActivated = notActivatedCode ? { activated: false, code: notActivatedCode } : {};
  // a verified payment that opened nothing (wrong amount, a replaced standing order, ...) is an incident for the Owner - never silent
  // 20261022200000: 'first_charge_pulled' = the server already pulled this very payment (the package is open) - not an incident
  if (notActivatedCode && notActivatedCode !== 'billing_not_enforced' && notActivatedCode !== 'first_charge_pulled') {
    console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'payment_not_activated', code: notActivatedCode, outcome: outcome ?? null }));
  }
  return { status: 200, body: { ok: true, duplicate: r.duplicate === true, ...(outcome ? { outcome } : {}), ...notActivated } };
}

// ------------------------------------------------------------------------------------------------ checkout status (server pull)
// 20261022200000 (Owner 2026-10-21, docs/PAYMENTS_ACTIVATION_PLAN_2026-10-21.md step 1): back from the payment page with no callback
// yet, the user's own pending attempts are asked about at the provider. Only an approved answer that names OUR attempt, with its
// standing order, reaches SQL - which compares the amount / currency with the attempt, opens the package once and never counts the
// same first charge twice when its callback arrives later. The answer says only whether something opened; the client then reads the
// account summary as before.
type PullTarget = { attemptId: string; requestRef: string; amountMinor: number; currency: 'ILS' | 'USD' };
function parsePullTargets(raw: unknown): PullTarget[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PullTarget[] = [];
  for (const t of raw.slice(0, 3)) {
    if (!isObj(t) || typeof t.attemptId !== 'string' || !UUID.test(t.attemptId) || typeof t.requestRef !== 'string' || !UUID.test(t.requestRef)
        || !Number.isInteger(t.amountMinor) || (t.currency !== 'ILS' && t.currency !== 'USD')) return null;
    out.push({ attemptId: t.attemptId, requestRef: t.requestRef, amountMinor: t.amountMinor as number, currency: t.currency });
  }
  return out;
}
export async function checkoutStatusHandler(phase: BillingPhase, deps: { sql: BillingSql; provider: BillingProvider }, userId: string): Promise<Resp> {
  if (phase === 'off') return err(503, 'billing_off');
  if (typeof userId !== 'string' || !UUID.test(userId)) return err(401, 'not_authenticated');
  const { sql, provider } = deps;
  if (typeof provider.pullCheckout !== 'function' || typeof sql.checkoutPullTargets !== 'function' || typeof sql.recordCheckoutPull !== 'function') {
    return err(503, 'checkout_unavailable');
  }
  let targets: PullTarget[] | null;
  try { targets = parsePullTargets(await sql.checkoutPullTargets(userId)); } catch { return err(503, 'retry_later'); }
  if (!targets) return err(503, 'retry_later');
  let activated = false; let waiting = 0;
  for (const t of targets) {
    const p = await provider.pullCheckout(t.requestRef).catch(() => null);
    if (!p || !p.approved) { waiting++; continue; } // not paid (yet) / provider unreachable: the callback or a later pull decides
    if (p.attemptId !== t.attemptId) {
      // a page request answered with someone else's attempt id is never applied - an incident for the Owner
      console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'pull_attempt_mismatch' }));
      continue;
    }
    let r: Record<string, unknown>;
    try {
      r = await sql.recordCheckoutPull({ attemptId: t.attemptId, userId, providerAttemptId: p.attemptId, recurringRef: p.recurringRef, paidAmountMinor: p.amountMinor,
        paidCurrency: p.currency, payloadSha256: p.payloadSha256 });
    } catch { return err(503, 'retry_later'); }
    if (!isObj(r) || r.ok !== true) { waiting++; continue; }
    if (r.activated === true) activated = true;
    const code = r.activated === false && typeof r.code === 'string' && /^[a-z_]{1,40}$/.test(r.code) ? r.code : null;
    // a verified payment that opened nothing (wrong amount, another package, ...) is an incident for the Owner - never silent
    if (r.pulled === true && code && code !== 'billing_not_enforced') {
      console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'payment_not_activated', code, source: 'pull' }));
    }
  }
  // 20261025300000: the account's own SMART PACK add-on pages (the same pull discipline), then the lines still to add
  if (typeof sql.smartPackAddOnPullTargets === 'function' && typeof sql.recordSmartPackAddOnPull === 'function' && typeof provider.pullAddOnCheckout === 'function') {
    let addOns: { addOnId: string; requestRef: string }[] = [];
    try {
      const raw = await sql.smartPackAddOnPullTargets(userId);
      addOns = Array.isArray(raw) ? raw.slice(0, 3).filter((t): t is { addOnId: string; requestRef: string } =>
        isObj(t) && typeof t.addOnId === 'string' && UUID.test(t.addOnId) && typeof t.requestRef === 'string' && UUID.test(t.requestRef)) : [];
    } catch { addOns = []; }
    for (const t of addOns) {
      const p = await provider.pullAddOnCheckout(t.requestRef).catch(() => null);
      if (!p || !p.approved) { waiting++; continue; }
      if (p.addOnId !== t.addOnId) { console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'pull_attempt_mismatch', kind: 'smart_pack_add_on' })); continue; }
      let r: Record<string, unknown>;
      try {
        r = await sql.recordSmartPackAddOnPull({ addOnId: t.addOnId, userId, providerAddOnId: p.addOnId, paidAmountMinor: p.amountMinor,
          paidCurrency: p.currency, payloadSha256: p.payloadSha256 });
      } catch { waiting++; continue; }
      if (!isObj(r) || r.ok !== true) { waiting++; continue; }
      if (r.activated === true) activated = true;
      const code = typeof r.code === 'string' && /^[a-z_]{1,40}$/.test(r.code) ? r.code : null;
      if (code && ADD_ON_INCIDENTS.has(code)) console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'smart_pack_payment_not_applied', code, source: 'pull' }));
      if (r.activated === true && r.lineNeeded === true) await completeSmartPackLine(deps, t.addOnId);
    }
  }
  if (typeof sql.smartPackAddOnLineTargets === 'function') {
    let ids: unknown = [];
    try { ids = await sql.smartPackAddOnLineTargets(userId); } catch { ids = []; }
    for (const id of Array.isArray(ids) ? ids.slice(0, 3) : []) {
      if (typeof id === 'string' && UUID.test(id)) await completeSmartPackLine(deps, id);
    }
  }
  // 20261027100000: a SMART PACK removal whose answer was lost is tried again; a yearly refund still due is refunded
  if (typeof sql.smartPackRemovalTargets === 'function') {
    let ids: unknown = [];
    try { ids = await sql.smartPackRemovalTargets(userId); } catch { ids = []; }
    for (const id of Array.isArray(ids) ? ids.slice(0, 3) : []) if (typeof id === 'string' && UUID.test(id)) await completeSmartPackRemoval(deps, id);
  }
  await refundDueRemovals(deps, userId);
  return { status: 200, body: { ok: true, activated, waiting } };
}

// ------------------------------------------------------------------------------------------------ reference state model
// The subscription state graph the SQL must implement (CROSSCUT §2.4), used by reconciliation as the drift oracle and by the
// in-memory SQL mock. Renewal failure -> past_due with NO new period; only a verified success after it returns to active;
// an older event is stale; a duplicate is a no-op. Cancel / refund / proration are policy_pending (OPEN-09).
export type SubStatus = 'pending' | 'active' | 'past_due';
export type SubState = { status: SubStatus; periods: number; lastEventAt: string | null; seen: readonly string[] };
export const INITIAL_SUB_STATE: SubState = Object.freeze({ status: 'pending', periods: 0, lastEventAt: null, seen: Object.freeze([]) as readonly string[] });

export function applySubscriptionEvent(s: SubState, e: Pick<ProviderEvent, 'providerEventId' | 'type' | 'occurredAt'>):
  { state: SubState; outcome: 'applied' | 'stale' | 'duplicate' | 'policy_pending' | 'rejected' } {
  if (s.seen.includes(e.providerEventId)) return { state: s, outcome: 'duplicate' };
  const seen = Object.freeze([...s.seen, e.providerEventId]);
  if (s.lastEventAt !== null && Date.parse(e.occurredAt) <= Date.parse(s.lastEventAt)) return { state: { ...s, seen }, outcome: 'stale' };
  const at = e.occurredAt;
  switch (e.type) {
    case 'payment_confirmed':
      if (s.status !== 'pending') return { state: { ...s, seen }, outcome: 'rejected' };
      return { state: { status: 'active', periods: s.periods + 1, lastEventAt: at, seen }, outcome: 'applied' };
    case 'renewed':
    case 'payment_succeeded':
      if (s.status === 'pending') return { state: { ...s, seen }, outcome: 'rejected' };
      return { state: { status: 'active', periods: s.periods + 1, lastEventAt: at, seen }, outcome: 'applied' };
    case 'renewal_failed':
      if (s.status === 'pending') return { state: { ...s, seen }, outcome: 'rejected' };
      return { state: { status: 'past_due', periods: s.periods, lastEventAt: at, seen }, outcome: 'applied' };
    default:
      return { state: { ...s, seen, lastEventAt: at }, outcome: 'policy_pending' };
  }
}

/**
 * Reconciliation (no cron wired): for each local subscription, the provider's VERIFIED event list is replayed through the
 * same idempotent recorder (duplicates are no-ops), then the local status is compared with the reference graph. Drift is
 * reported, never "fixed" by writing a status directly (an admin / support action cannot mark paid).
 */
export async function reconcileSubscriptions(deps: {
  listLocal(): Promise<{ attemptId: string }[]>;
  fetchProviderEvents(attemptId: string): Promise<ProviderEvent[]>;
  record(e: ProviderEvent): Promise<unknown>;
  readStatus(attemptId: string): Promise<string | null>;
}): Promise<{ ok: boolean; checked: number; drift: { attemptId: string; local: string | null; expected: SubStatus }[]; errors: string[] }> {
  const out = { ok: true, checked: 0, drift: [] as { attemptId: string; local: string | null; expected: SubStatus }[], errors: [] as string[] };
  let rows: { attemptId: string }[];
  try { rows = await deps.listLocal(); } catch { return { ...out, ok: false }; }
  for (const row of rows) {
    if (!row || typeof row.attemptId !== 'string' || !UUID.test(row.attemptId)) continue;
    try {
      const events = (await deps.fetchProviderEvents(row.attemptId)).filter((e) => e && e.attemptId === row.attemptId)
        .slice().sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
      let model: SubState = INITIAL_SUB_STATE;
      for (const e of events) { await deps.record(e); model = applySubscriptionEvent(model, e).state; }
      const local = await deps.readStatus(row.attemptId);
      out.checked++;
      if (local !== model.status) out.drift.push({ attemptId: row.attemptId, local, expected: model.status });
    } catch {
      out.errors.push(row.attemptId);
    }
  }
  return out;
}
