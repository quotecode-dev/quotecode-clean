// Market of one Auth email (Post-LIVE Wave 1, Auth market identity gap F1 - Option C, Owner-approved 2026-09-28).
// Pure: no I/O, no Deno globals (vitest: marketResolver.test.js). The single database read lives in marketLookup.ts.
//
// Precedence (evidence/wave1-production-release-plan-2026-09-27/AUTH_MARKET_IDENTITY_DESIGN.md):
//   1. The CANONICAL row wins: public.business_settings.country of the verified Auth user (one row per user_id).
//        'Local' | 'LCL' (the application-wide legacy Local alias) -> Local;  'International' -> International;
//        any other value (Unknown / NULL / malformed) -> fail closed to International, and signup metadata is NOT consulted.
//   2. Bootstrap ONLY when the lookup succeeded with ZERO rows (signup email / before the first login creates the row):
//        exact user_metadata.signup_market 'Local' -> Local, 'International' -> International, anything else -> International.
//      This is the application's own precedence (Dashboard.jsx fetchSettings creates the missing row from signup_market).
//   3. Lookup error / timeout / more than one row / no usable user id -> fail closed to International. The email is still
//      sent: an Auth email is never blocked because the market lookup failed.
// Never used: browser / email language, IP / geography, currency, recipient domain, legacy user_metadata.country.

export type AuthMarket = 'Local' | 'International';

export type MarketLookupResult =
  | { ok: true; rows: ReadonlyArray<{ country?: unknown }> }
  | { ok: false; reason: 'timeout' | 'error' | 'invalid_user_id' | 'not_configured' };

// Safe diagnostic classifications only (no ids, addresses, secrets or raw values).
export type MarketClassification =
  | 'row_local'
  | 'row_lcl_alias'
  | 'row_international'
  | 'row_unresolved'
  | 'bootstrap_local'
  | 'bootstrap_international'
  | 'bootstrap_missing_or_malformed'
  | 'lookup_timeout'
  | 'lookup_error'
  | 'lookup_invalid_user_id'
  | 'lookup_not_configured'
  | 'lookup_multiple_rows';

export type MarketResolution = {
  market: AuthMarket;
  source: 'canonical_row' | 'signup_bootstrap' | 'fail_closed';
  classification: MarketClassification;
};

export const MARKET_LOOKUP_TIMEOUT_MS = 1500;

const failClosed = (classification: MarketClassification): MarketResolution => ({ market: 'International', source: 'fail_closed', classification });

export function resolveAuthEmailMarket(lookup: MarketLookupResult, userMetadata: Record<string, unknown> | null | undefined): MarketResolution {
  if (!lookup || lookup.ok !== true) {
    const reason = lookup && lookup.ok === false ? lookup.reason : 'error';
    if (reason === 'timeout') return failClosed('lookup_timeout');
    if (reason === 'invalid_user_id') return failClosed('lookup_invalid_user_id');
    if (reason === 'not_configured') return failClosed('lookup_not_configured');
    return failClosed('lookup_error');
  }
  const rows = Array.isArray(lookup.rows) ? lookup.rows : null;
  if (!rows) return failClosed('lookup_error');
  if (rows.length > 1) return failClosed('lookup_multiple_rows');

  if (rows.length === 1) {
    const country = rows[0]?.country;
    if (country === 'Local') return { market: 'Local', source: 'canonical_row', classification: 'row_local' };
    if (country === 'LCL') return { market: 'Local', source: 'canonical_row', classification: 'row_lcl_alias' };
    if (country === 'International') return { market: 'International', source: 'canonical_row', classification: 'row_international' };
    // An existing row that does not resolve: the canonical record says "unresolved" - metadata must not override it.
    return failClosed('row_unresolved');
  }

  // Zero rows: bootstrap from the signup metadata (exact values only).
  const signupMarket = userMetadata && typeof userMetadata === 'object' ? (userMetadata as Record<string, unknown>).signup_market : undefined;
  if (signupMarket === 'Local') return { market: 'Local', source: 'signup_bootstrap', classification: 'bootstrap_local' };
  if (signupMarket === 'International') return { market: 'International', source: 'signup_bootstrap', classification: 'bootstrap_international' };
  return failClosed('bootstrap_missing_or_malformed');
}

// Runs a lookup with a hard deadline. A lookup that throws, rejects, returns garbage or does not settle in time is converted
// into a fail-closed result; it can never throw out of here and can never hang the Auth email.
export async function runMarketLookupWithTimeout(
  lookup: ((userId: string, signal: AbortSignal) => Promise<ReadonlyArray<{ country?: unknown }>>) | undefined,
  userId: unknown,
  timeoutMs: number = MARKET_LOOKUP_TIMEOUT_MS,
): Promise<MarketLookupResult> {
  if (typeof lookup !== 'function') return { ok: false, reason: 'not_configured' };
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return { ok: false, reason: 'invalid_user_id' };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<MarketLookupResult>((resolve) => {
    timer = setTimeout(() => { controller.abort(); resolve({ ok: false, reason: 'timeout' }); }, timeoutMs);
  });
  const attempt = (async (): Promise<MarketLookupResult> => {
    try {
      const rows = await lookup(userId, controller.signal);
      if (!Array.isArray(rows)) return { ok: false, reason: 'error' };
      return { ok: true, rows };
    } catch (e) {
      if (e && typeof e === 'object' && (e as { code?: unknown }).code === 'not_configured') return { ok: false, reason: 'not_configured' };
      return { ok: false, reason: controller.signal.aborted ? 'timeout' : 'error' };
    }
  })();
  try {
    return await Promise.race([attempt, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
