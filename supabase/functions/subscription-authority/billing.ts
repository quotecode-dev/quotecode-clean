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
  standingOrder?: { recurringRef: string; terminalRef: string | null } };
export type WebhookRejection = 'invalid_signature' | 'stale_timestamp' | 'untrusted_source' | 'invalid_event' | 'provider_unavailable';
export type WebhookVerification = { ok: true; event: ProviderEvent } | { ok: false; reason: WebhookRejection };
/** 20261022200000: what the provider answers for a payment page the server asks about (no callback needed). approved = the first
 *  charge succeeded and the standing order is live; the amount / currency are compared for EQUALITY in SQL, never a price. */
export type PulledCheckout = { attemptId: string | null; recurringRef: string; amountMinor: number | null; currency: 'ILS' | 'USD' | null;
  approved: boolean; payloadSha256: string };

export interface BillingProvider {
  readonly name: string;
  /** hosted checkout for an already-created server attempt; amount/currency (and the package period) come from that attempt only */
  createCheckout(i: { attemptId: string; currency: 'ILS' | 'USD'; amountMinor: number; billingPeriod?: BillingPeriod;
    /** Owner 2026-10-20: the SMART PACK line of the same payment (amountMinor = package + add-on) */
    addOnAmountMinor?: number | null }): Promise<{ redirectUrl: string; pageRequestUid?: string } | null>;
  /** signature + timestamp window + source; returns the normalized event only when all three pass */
  verifyWebhook(rawBody: Uint8Array, headers: Headers, nowMs: number): Promise<WebhookVerification>;
  /** 20261022200000: the result of a payment page by its request id (createCheckout's pageRequestUid); null = nothing to read yet */
  pullCheckout?(pageRequestUid: string): Promise<PulledCheckout | null>;
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
  const { id, type, occurredAt, attemptId, userId, line, recurringRef, terminalRef } = raw;
  if (typeof id !== 'string' || id.length < 1 || id.length > 200 || !(EVENT_TYPES as readonly string[]).includes(type as string) || !isIso(occurredAt)) return null;
  const t = type as EventType;
  const att = attemptId === undefined || attemptId === null ? null : attemptId;
  const uid = userId === undefined || userId === null ? null : userId;
  if (att !== null && (typeof att !== 'string' || !UUID.test(att))) return null;
  if (uid !== null && (typeof uid !== 'string' || !UUID.test(uid))) return null;
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
  const hosted = await deps.provider.createCheckout({ attemptId: r.attemptId, currency: expected.currency, amountMinor: expected.amountMinor,
    ...(isPackage ? { billingPeriod: period as BillingPeriod, addOnAmountMinor: expected.addOnAmountMinor ?? null } : {}) }).catch(() => null);
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
