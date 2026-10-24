// admin-billing - the PayPlus connection of one request, from the Function secrets (moved out of index.ts to be unit-tested).
// Owner 2026-10-24 ("כן אשמח" - connecting the payment functions to the relay before payments go on; Codex spec PAY-01 / PAY-02):
// stopping a standing order and refunding go through the fixed-IP relay (PAYPLUS_PROXY_URL). Without a usable relay there is NO PayPlus
// connection at all (null -> the handler answers provider_unavailable before anything is begun or sent) - never a direct call, and never
// an "unknown" stop outcome for a request that was not even sent.
import { requiredPayplusEgress, type PayPlusEgress } from '../_shared/payplusEgress.ts';
import { PAYPLUS_API_BASES, payplusStandingOrders } from '../subscription-authority/payplus.ts';
import type { AdminBillingDeps } from './lib.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const ADMIN_PAYPLUS_ENV = Object.freeze(['PAYPLUS_API_KEY', 'PAYPLUS_SECRET_KEY', 'PAYPLUS_ENVIRONMENT', 'PAYPLUS_TERMINAL_UID', 'PAYPLUS_PROXY_URL'] as const);

/** the PayPlus actions of this request + close() (the relay client), or payplus null when the keys or the relay are missing / invalid */
export function adminPayplus(get: (name: typeof ADMIN_PAYPLUS_ENV[number]) => string | undefined,
  egressOf: (secret: string | undefined) => PayPlusEgress = (s) => requiredPayplusEgress(s)): { payplus: AdminBillingDeps['payplus']; close: () => void } {
  const apiKey = (get('PAYPLUS_API_KEY') ?? '').trim();
  const secretKey = (get('PAYPLUS_SECRET_KEY') ?? '').trim();
  const environment = (get('PAYPLUS_ENVIRONMENT') ?? '').trim();
  const terminalUid = (get('PAYPLUS_TERMINAL_UID') ?? '').trim().toLowerCase();
  const none = { payplus: null, close: () => {} };
  if (!apiKey || !secretKey || (environment !== 'production' && environment !== 'staging') || !UUID.test(terminalUid)) return none;
  const egress = egressOf(get('PAYPLUS_PROXY_URL'));
  if (egress.via !== 'relay') return none;
  try {
    const orders = payplusStandingOrders({ apiBase: PAYPLUS_API_BASES[environment], apiKey, secretKey, fetch: egress.fetch });
    return { payplus: { terminalUid, cancel: orders.cancel, refund: orders.refund }, close: egress.close };
  } catch {
    egress.close();
    return none;
  }
}
