// AI Chat Gate 2, §5: verified, minimal, read-only account context for the
// authenticated Dashboard surface. Authority for every field here comes
// from the server-verified user id (see index.ts's JWT verification) - NEVER
// from anything the caller claims about their own account.
//
// SUBSCRIPTIONS CUTOVER (OD-16/OD-20, CROSSCUT_CONTRACT §2.1): the account's plan, Free-10 balance, subscription status
// and output phase come ONLY from the server account summary (`public.get_account_summary()`, account-summary/v1), which
// index.ts fetches server-side WITH THE USER'S OWN JWT (identity = auth.uid(); the RPC takes no argument, so no request
// field can name another account) and which is parsed here by the ONE strict parser (subscriptionContract.ts
// parseAccountSummary - anything outside the allowlist fails closed). The legacy `business_settings.plan /
// trial_ends_at` fields are no longer read at all (only the explicit team-set Lifetime flag is, since the night task of 2026-10-16, R-16): the old tier/trial resolution (a port of
// planEntitlements.js / accountEntitlement.js) was removed, so the assistant can never state a legacy tier, a trial or a
// monthly limit as this account's state. `business_settings` is still read for the account's market (`country`) and the
// server-verified role (admin), which are not plan facts.
import { parseAccountSummary, type AccountSummary, type ActivationPhase, type PlanId, type SummaryState } from "../_shared/subscriptionContract.ts";

export type BusinessSettingsRow = {
  role?: string | null;
  country?: string | null;
  // Night task 2026-10-16 (R-16, Owner-approved L-11 / L-01): the ONE legacy field read again - the explicit Lifetime flag the
  // team sets (the app shows "Lifetime subscription"); never a tier, a trial or a limit
  is_lifetime?: boolean | null;
};

// The plan facts the assistant may use - a projection of the parsed server summary, nothing else.
export type AccountPlanContext = {
  // 'ready' only when the server returned a valid account-summary/v1 for this user; every other state means "no plan fact".
  summaryState: SummaryState;
  planId: PlanId | null; // only when summaryState === 'ready'
  free10Remaining: number | null; // only for a ready Free account
  subscriptionStatus: string | null; // only when ready
  outputPhase: ActivationPhase; // 'off' unless ready
  isLifetime: boolean; // the explicit team-set Lifetime flag of business_settings; false when unknown
};

export const NO_ACCOUNT_PLAN: AccountPlanContext = Object.freeze({
  summaryState: 'unavailable', planId: null, free10Remaining: null, subscriptionStatus: null, outputPhase: 'off', isLifetime: false,
});

export function accountPlanFromSummary(summary: AccountSummary | null | undefined): AccountPlanContext {
  if (!summary || typeof summary !== 'object') return NO_ACCOUNT_PLAN;
  if (summary.state !== 'ready') {
    return Object.freeze({ ...NO_ACCOUNT_PLAN, summaryState: summary.state });
  }
  return Object.freeze({
    summaryState: 'ready',
    planId: summary.planId,
    free10Remaining: summary.planId === 'free' && summary.free10 ? summary.free10.remaining : null,
    subscriptionStatus: summary.subscriptionStatus,
    outputPhase: summary.phase.output,
    isLifetime: false,
  });
}

// PostgREST "function not found" (the migration is not deployed): PGRST202 / HTTP 404 -> not_deployed. Other errors ->
// unavailable. Never throws. `rpc` is the caller's own JWT-bound client's rpc (index.ts) - the request body never reaches it.
export async function fetchServerAccountSummary(
  rpc: (fn: string) => PromiseLike<{ data: unknown; error: { code?: string; status?: number; message?: string } | null; status?: number }>,
): Promise<AccountSummary> {
  try {
    const res = await rpc('get_account_summary');
    if (res.error) {
      const code = String(res.error.code ?? '');
      const status = Number(res.status ?? res.error.status ?? 0);
      if (code === 'PGRST202' || code === '42883' || status === 404) return { state: 'not_deployed', code: code || 'not_found' };
      return { state: 'unavailable', code: code || 'rpc_error' };
    }
    return parseAccountSummary(res.data);
  } catch {
    return { state: 'unavailable', code: 'rpc_threw' };
  }
}

// AI Chat Hardening overnight task, Track C/I ("Unknown/absent market must
// NOT silently become International" - a direct Owner requirement, ProFlow's
// own locked market-isolation discipline): `market` has an explicit third
// state so a brand-new/mid-onboarding account is never silently guessed either way.
export type VerifiedAccountContext = {
  market: 'Local' | 'International' | 'Unknown';
  account: AccountPlanContext;
  currentArea: string | null;
};

// §5.1's minimal, read-only allowlist - deliberately excludes everything
// under §5.1's "Do NOT send" list (raw business_settings row, full profile,
// tax id, address, phone, bank/payment data, role exposed to the model,
// customer/quote lists, support logs, secrets/tokens). `role` is read only
// by helpContext.ts to compute isAdmin internally and is never placed on this object.
// Market: the server summary's own market when it is ready and carries one; otherwise the verified business_settings.country.
export function buildVerifiedAccountContext(
  row: BusinessSettingsRow | null | undefined,
  currentArea: string | null,
  summary: AccountSummary | null | undefined = null,
): VerifiedAccountContext {
  const fromSummary = accountPlanFromSummary(summary);
  const account: AccountPlanContext = row?.is_lifetime === true ? Object.freeze({ ...fromSummary, isLifetime: true }) : fromSummary;
  const summaryMarket = summary && summary.state === 'ready' ? summary.market : null;
  const market: 'Local' | 'International' | 'Unknown' =
    summaryMarket === 'IL' ? 'Local' :
    summaryMarket === 'INTERNATIONAL' ? 'International' :
    row?.country === 'Local' ? 'Local' :
    row?.country === 'International' ? 'International' :
    'Unknown';
  return { market, account, currentArea };
}

// §4: for the AUTHENTICATED surface, the language policy is derived from
// the verified account's own market - never trusted from the caller's
// `isHebrew` claim. A public (unauthenticated) request has no verified
// account, so its own caller-supplied isHebrew (which is just "which
// locale of the public marketing site is this", not an account fact)
// remains the correct signal there - see index.ts's call site.
//
// When the market itself is 'Unknown' (no business_settings row yet), there
// is no commercial-market fact to derive a REPLY LANGUAGE from either - but a
// reply must still be given in some language. `fallbackIsHebrew` (the
// caller's own dashboard-bundle locale) is used ONLY for that narrow UI-
// language purpose in that one case; it is never used to assert the
// account's actual commercial market (currency/pricing framing).
export function isHebrewFromMarket(market: 'Local' | 'International' | 'Unknown', fallbackIsHebrew: boolean = false): boolean {
  if (market === 'Local') return true;
  if (market === 'International') return false;
  return fallbackIsHebrew;
}
