// TEKANGO billing - provider-neutral checkout + verified webhook handling (spec Phase 9, §9; OD-03..OD-08; OPEN-09/12).
// Pure, dependency-injected module (Deno + vitest). No provider is integrated: the only provider available is
// UNAVAILABLE_PROVIDER (OPEN-12 - no written PayPlus/Max terminal, recurring/tokenization or signed-webhook evidence).
// createHmacWebhookVerifier is a GENERIC signature/timestamp/source verifier shape used with mocks; it is NOT a claim about
// PayPlus's actual scheme and must be bound to the documented PayPlus contract before any sandbox use.
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
    // a year row exists only for the package; a row without an offer class is a pre-Task-27 legacy row
    if (p.billingPeriod === 'year' && p.planId !== PACKAGE_PLAN_ID) return null;
    const offer = p.offer === 'current' ? 'current' : p.offer === undefined || p.offer === 'legacy' ? 'legacy' : null;
    if (!offer || (offer === 'current') !== (p.planId === PACKAGE_PLAN_ID)) return null;
    out.push({ priceId: p.priceId, planId: p.planId, currency: want, billingPeriod: p.billingPeriod as BillingPeriod, amountMinor: p.amountMinor as number,
      taxMode: String(p.taxMode), offer });
  }
  return out;
}

/** The checkout amount from the SERVER catalog only: plan + blocks x (+100 block). No VAT is ever added (OD-05). */
export function computeCheckoutAmount(prices: readonly PriceRow[] | null, planId: unknown, blocks: unknown, billingPeriod: unknown = 'month'):
  { currency: 'ILS' | 'USD'; amountMinor: number; planPriceId: string; blockPriceId: string | null } | null {
  if (!prices || typeof planId !== 'string') return null;
  if (planId === PACKAGE_PLAN_ID) {
    // the package: one current row of the chosen period; no add-on blocks on this path
    if (!(PACKAGE_PERIODS as readonly unknown[]).includes(billingPeriod) || blocks !== 0) return null;
    const row = prices.filter((p) => p.planId === PACKAGE_PLAN_ID && p.offer === 'current' && p.billingPeriod === billingPeriod);
    if (row.length !== 1) return null;
    return { currency: row[0].currency, amountMinor: row[0].amountMinor, planPriceId: row[0].priceId, blockPriceId: null };
  }
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
  userId: string | null; line: LineEvent | null };
export type WebhookRejection = 'invalid_signature' | 'stale_timestamp' | 'untrusted_source' | 'invalid_event' | 'provider_unavailable';
export type WebhookVerification = { ok: true; event: ProviderEvent } | { ok: false; reason: WebhookRejection };

export interface BillingProvider {
  readonly name: string;
  /** hosted checkout for an already-created server attempt; amount/currency come from that attempt only */
  createCheckout(i: { attemptId: string; currency: 'ILS' | 'USD'; amountMinor: number }): Promise<{ redirectUrl: string } | null>;
  /** signature + timestamp window + source; returns the normalized event only when all three pass */
  verifyWebhook(rawBody: Uint8Array, headers: Headers, nowMs: number): Promise<WebhookVerification>;
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
  const { id, type, occurredAt, attemptId, userId, line } = raw;
  if (typeof id !== 'string' || id.length < 1 || id.length > 200 || !(EVENT_TYPES as readonly string[]).includes(type as string) || !isIso(occurredAt)) return null;
  const t = type as EventType;
  const att = attemptId === undefined || attemptId === null ? null : attemptId;
  const uid = userId === undefined || userId === null ? null : userId;
  if (att !== null && (typeof att !== 'string' || !UUID.test(att))) return null;
  if (uid !== null && (typeof uid !== 'string' || !UUID.test(uid))) return null;
  let parsedLine: LineEvent | null = null;
  if (t === 'line_added' || t === 'line_removed') {
    if (!isObj(line) || uid === null) return null;
    const { lineType, quantity, priceVersionId, effectiveFrom, providerRef } = line;
    if (lineType !== 'catalog_block' || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 1000) return null;
    if (typeof priceVersionId !== 'string' || !PRICE_ID.test(priceVersionId) || !priceVersionId.includes('catalog_block')) return null;
    if (!isIso(effectiveFrom) || typeof providerRef !== 'string' || providerRef.length < 1 || providerRef.length > 200) return null;
    parsedLine = { lineType, quantity: quantity as number, priceVersionId, effectiveFrom, providerRef };
  } else if (att === null) {
    return null; // subscription events always reference the server checkout attempt
  }
  return { providerEventId: id, type: t, occurredAt, attemptId: att, userId: uid, line: parsedLine };
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
  /** create_package_checkout_intent(p_user_id, p_billing_period, p_idempotency_key) - the all-inclusive package (Task 27) */
  createPackageCheckoutIntent?(userId: string, billingPeriod: BillingPeriod, idempotencyKey: string): Promise<Record<string, unknown>>;
  /** get_price_catalog(p_market) */
  priceCatalog(market: Market): Promise<unknown>;
  /** record_verified_subscription_event(provider, provider_event_id, event_type, attempt_id, provider_event_time, payload_sha256) */
  recordVerifiedEvent(e: { provider: string; providerEventId: string; eventType: string; attemptId: string; providerEventTime: string; payloadSha256: string }): Promise<Record<string, unknown>>;
  /** apply_verified_line_event(provider, provider_event_id, user_id, line_type, quantity, price_version_id, effective_from, provider_ref) */
  applyVerifiedLineEvent(e: { provider: string; providerEventId: string; userId: string; lineType: string; quantity: number; priceVersionId: string; effectiveFrom: string; providerRef: string; removal: boolean }): Promise<Record<string, unknown>>;
}

// ------------------------------------------------------------------------------------------------ checkout intent
const CHECKOUT_CODES: Record<string, number> = { checkout_unavailable: 503, account_unprovisioned: 409, idempotency_conflict: 409, invalid_request: 400 };
export async function checkoutIntentHandler(phase: BillingPhase, deps: { sql: BillingSql; provider: BillingProvider }, userId: string, body: unknown): Promise<Resp> {
  if (phase === 'off') return err(503, 'checkout_unavailable');
  if (typeof userId !== 'string' || !UUID.test(userId)) return err(401, 'not_authenticated');
  const b = isObj(body) ? body : {};
  // ONLY these fields are read; amount / currency / rate / market / price / account id in the body are ignored.
  const planId = b.planId; const blocks = b.blocks ?? 0; const key = b.idempotencyKey;
  const isPackage = planId === PACKAGE_PLAN_ID;
  const period = isPackage ? b.billingPeriod : 'month';
  if (typeof planId !== 'string' || !Number.isInteger(blocks) || typeof key !== 'string') return err(400, 'invalid_request');
  if (isPackage && (!(PACKAGE_PERIODS as readonly unknown[]).includes(period) || blocks !== 0 || typeof deps.sql.createPackageCheckoutIntent !== 'function')) {
    return err(400, 'invalid_request');
  }
  let r: Record<string, unknown>;
  try {
    r = isPackage
      ? await (deps.sql.createPackageCheckoutIntent as NonNullable<BillingSql['createPackageCheckoutIntent']>)(userId, period as BillingPeriod, key)
      : await deps.sql.createCheckoutIntent(userId, planId, blocks as number, key);
  } catch { return err(503, 'checkout_unavailable'); }
  if (!isObj(r) || r.ok !== true) {
    const code = isObj(r) ? String(r.code) : '';
    return err(CHECKOUT_CODES[code] ?? 503, CHECKOUT_CODES[code] ? code : 'checkout_unavailable');
  }
  if (typeof r.attemptId !== 'string' || !UUID.test(r.attemptId) || (r.market !== 'IL' && r.market !== 'INTERNATIONAL')
      || !['ILS', 'USD'].includes(r.currency as string) || !Number.isInteger(r.amountMinor)) return err(503, 'checkout_unavailable');
  // Defence in depth: the SQL amount must equal the server catalog computation for the server market (never a client value).
  const market = r.market as Market;
  let catalogRaw: unknown;
  try { catalogRaw = await deps.sql.priceCatalog(market); } catch { return err(503, 'checkout_unavailable'); }
  const expected = computeCheckoutAmount(parseCatalog(catalogRaw, market), planId, blocks, period);
  if (!expected || expected.currency !== r.currency || expected.amountMinor !== r.amountMinor) return err(503, 'checkout_unavailable');
  const hosted = await deps.provider.createCheckout({ attemptId: r.attemptId, currency: expected.currency, amountMinor: expected.amountMinor }).catch(() => null);
  if (!hosted || typeof hosted.redirectUrl !== 'string' || !/^https:\/\//.test(hosted.redirectUrl)) return err(503, 'checkout_unavailable');
  // A redirect URL is NOT an entitlement: the success page shows "processing" until a verified provider event.
  return { status: 200, body: { ok: true, attemptId: r.attemptId, currency: expected.currency, amountMinor: expected.amountMinor, redirectUrl: hosted.redirectUrl, state: 'pending' } };
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
        attemptId: e.attemptId as string, providerEventTime: e.occurredAt, payloadSha256 });
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
  return { status: 200, body: { ok: true, duplicate: r.duplicate === true, ...(outcome ? { outcome } : {}) } };
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
