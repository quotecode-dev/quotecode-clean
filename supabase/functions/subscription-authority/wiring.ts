// subscription-authority - Edge wiring (the ONLY file of this function that reads the environment or imports supabase-js).
// Env allowlist: SUPABASE_URL and SUPABASE_SECRET_KEYS (service client, same convention as get-public-quote /
// quote-presentation) + the PayPlus Function secrets (Owner night task 2026-10-21: payplus.ts PAYPLUS_SECRET_NAMES - keys, payment
// page, environment, return origin). No phase, market, plan or price value is ever read from the environment: billing stays at
// the code constant ACTIVATION_PHASE ('off'), so the provider built from the secrets is never reached; without the secrets it is
// UNAVAILABLE_PROVIDER. Output / logo use the DB phase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ACTIVATION_PHASE } from './authority.ts';
import { createQuoteOutputOrchestrator } from './authorizeOutput.ts';
import {
  bucketAssetStorage, bucketSnapshotStorage, capabilityRpcs, freeIssuePhaseReader, marketInputsReader, rpcAssetSql,
  rpcOutputSql, storageMediaAssetSource, storagePresentationSource, strictRpc, BUCKET, type BucketApi, type Rpc, type TableReader,
} from './adapters.ts';
import { UNAVAILABLE_PROVIDER, type BillingSql } from './billing.ts';
import { PAYPLUS_SECRET_NAMES, payplusProviderFromSecrets } from './payplus.ts';
import { decodeImageBase64, MAX_IMAGE_BYTES, MAX_IMAGE_SIDE } from '../quote-presentation/lib.ts';
import { requiredPayplusEgress } from '../_shared/payplusEgress.ts';
import type { AuthorityDeps } from './router.ts';

// Owner 2026-10-24 ("כן אשמח"; Codex spec PAY-01 / PAY-02): + PAYPLUS_PROXY_URL, the fixed-IP relay every outgoing PayPlus call needs
export const ALLOWED_ENV = Object.freeze(['SUPABASE_URL', 'SUPABASE_SECRET_KEYS', 'PAYPLUS_PROXY_URL', ...PAYPLUS_SECRET_NAMES]);

export function buildAuthorityDeps(): AuthorityDeps | null {
  const env = (n: string) => (ALLOWED_ENV.includes(n) ? Deno.env.get(n) : undefined);
  const url = env('SUPABASE_URL');
  let key = '';
  try { key = JSON.parse(env('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? ''; } catch { key = ''; }
  if (!url || !key) return null;
  // deno-lint-ignore no-explicit-any
  const admin: any = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc: Rpc = async (fn, args) => { const { data, error } = await admin.rpc(fn, args); return { data, error }; };
  const bucket: BucketApi = admin.storage.from(BUCKET);
  const tables: TableReader = {
    one: async (table, columns, column, value) => {
      const { data, error } = await admin.from(table).select(columns).eq(column, value).maybeSingle();
      return { data, error };
    },
  };
  const readFreeIssuePhase = freeIssuePhaseReader(tables);
  const call = strictRpc(rpc);
  const billingSql: BillingSql = {
    createCheckoutIntent: async (userId, planId, blocks, idempotencyKey) => (await call('create_checkout_intent',
      { p_user_id: userId, p_plan_id: planId, p_blocks: blocks, p_idempotency_key: idempotencyKey })) as Record<string, unknown>,
    createPackageCheckoutIntent: async (userId, billingPeriod, idempotencyKey, smartPack = false) => (await call('create_package_checkout_intent',
      { p_user_id: userId, p_billing_period: billingPeriod, p_idempotency_key: idempotencyKey, p_smart_pack: smartPack })) as Record<string, unknown>,
    priceCatalog: (market) => call('get_price_catalog', { p_market: market }),
    // 20261022100000 (Codex audit H05): one provider page per attempt
    checkoutPage: async (attemptId, userId) => {
      const v = await call('checkout_attempt_page', { p_attempt_id: attemptId, p_user_id: userId });
      return typeof v === 'string' ? v : null;
    },
    recordCheckoutPage: async (attemptId, userId, url) => {
      const v = await call('record_checkout_attempt_page', { p_attempt_id: attemptId, p_user_id: userId, p_url: url });
      return typeof v === 'string' ? v : null;
    },
    // 20261022200000: the page with its PayPlus request id, the pull targets and the pulled first charge
    recordCheckoutPageAndRequest: async (attemptId, userId, url, requestRef) => {
      const v = await call('record_checkout_attempt_page_and_request', { p_attempt_id: attemptId, p_user_id: userId, p_url: url, p_request_ref: requestRef });
      return typeof v === 'string' ? v : null;
    },
    checkoutPullTargets: (userId) => call('checkout_pull_targets', { p_user_id: userId }),
    recordCheckoutPull: async (p) => (await call('record_checkout_pull', { p_attempt_id: p.attemptId, p_user_id: p.userId,
      p_provider_attempt_id: p.providerAttemptId, p_recurring_ref: p.recurringRef, p_paid_amount_minor: p.paidAmountMinor, p_paid_currency: p.paidCurrency,
      p_payload_sha256: p.payloadSha256 })) as Record<string, unknown>,
    // 20261021000000: the same verified-event recorder + (same transaction) a confirmed package payment opens the subscription;
    // 20261022000000: through record_verified_provider_event, which reaches the attempt of a bound standing order
    recordVerifiedEvent: async (e) => (await call('record_verified_provider_event', { p_provider: e.provider,
      p_provider_event_id: e.providerEventId, p_event_type: e.eventType, p_attempt_id: e.attemptId,
      p_recurring_ref: e.recurringRef ?? null, p_terminal_ref: e.terminalRef ?? null,
      p_provider_event_time: e.providerEventTime, p_payload_sha256: e.payloadSha256,
      p_paid_amount_minor: e.paidAmountMinor ?? null, p_paid_currency: e.paidCurrency ?? null })) as Record<string, unknown>,
    applyVerifiedLineEvent: async (e) => {
      // The §2.4 signature has no removal parameter: a removal event is refused (no state change) until it is defined.
      if (e.removal) return { ok: false, code: 'invalid_event' };
      return (await call('apply_verified_line_event', { p_provider: e.provider, p_provider_event_id: e.providerEventId,
        p_user_id: e.userId, p_line_type: e.lineType, p_quantity: e.quantity, p_price_version_id: e.priceVersionId,
        p_effective_from: e.effectiveFrom, p_provider_ref: e.providerRef })) as Record<string, unknown>;
    },
  };
  const caps = capabilityRpcs(rpc);
  // Every OUTGOING PayPlus call (the payment link, the pull on return) goes through the relay; no / a bad relay secret = the call fails at
  // once and nothing is sent. The incoming callback is verified locally (HMAC) and never depends on the relay. The deps live for the whole
  // isolate, so the relay client is shared by its requests and never closed by one of them (it is created on the first call only).
  const payplusFetch = requiredPayplusEgress(env('PAYPLUS_PROXY_URL')).fetch;
  return {
    verifyJwt: async (token) => {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : { sub: data?.user?.id };
    },
    output: {
      readFreeIssuePhase,
      readMarketInputs: marketInputsReader(tables),
      orchestrator: createQuoteOutputOrchestrator({
        sql: rpcOutputSql(rpc), storage: bucketSnapshotStorage(bucket), presentation: storagePresentationSource(bucket),
        assets: storageMediaAssetSource(bucket),
        onIncident: (i) => console.error(JSON.stringify({ fn: 'subscription-authority', incident: i.code })),
      }),
      mintCapability: caps.mintCapability,
      issueGrant: caps.issueGrant,
    },
    notice: { outputNotice: (userId, quoteId) => call('output_notice', { p_user_id: userId, p_quote_id: quoteId }) },
    billing: { phase: ACTIVATION_PHASE, sql: billingSql, now: () => Date.now(),
      provider: payplusProviderFromSecrets((n) => env(n), url, payplusFetch, () => Date.now()) ?? UNAVAILABLE_PROVIDER },
    logo: {
      readFreeIssuePhase, sql: rpcAssetSql(rpc), storage: bucketAssetStorage(bucket),
      decode: (b64) => { const d = decodeImageBase64(b64); return d.ok ? { ok: true, bytes: d.bytes } : { ok: false }; },
      limits: { maxBytes: MAX_IMAGE_BYTES, maxDimension: MAX_IMAGE_SIDE },
    },
  };
}
