// Legacy admin operation guard (subscriptions cross-cut, stream D; OD-16 / CROSSCUT_CONTRACT §0, §2.1).
// The trial extension (admin-extend-trial) and is_lifetime (admin-set-lifetime) operations write only the LEGACY record.
// They keep working while the new plan system is not active and are refused (HTTP 409 `legacy_trial_retired`) once the
// subscription free_issue phase is `enforced`. The phase is read with the service-role client from
// public.subscription_activation (service_role SELECT only); a missing table means the subscription schema is not
// deployed, which is "not enforced". Any other read failure fails CLOSED (503 `phase_unavailable`): the legacy write is
// never performed when the phase cannot be established.
// Pure module (no Deno globals, no remote imports) - unit-tested by vitest. This file is kept byte-identical in
// admin-extend-trial/ and admin-set-lifetime/ (each Edge function bundles only its own directory and _shared/).

export const LEGACY_TRIAL_RETIRED = 'legacy_trial_retired';
export const PHASE_UNAVAILABLE = 'phase_unavailable';

// PostgREST / Postgres "relation does not exist" (schema not deployed).
const MISSING_RELATION_CODES = new Set(['42P01', 'PGRST205']);

type PhaseQueryResult = { data: { phase?: unknown } | null; error: { code?: string; message?: string } | null };
// deno-lint-ignore no-explicit-any
type ServiceClient = { from: (table: string) => any };

export type LegacyGuardDecision =
  | { allow: true; phase: string | null }
  | { allow: false; status: 409 | 503; code: typeof LEGACY_TRIAL_RETIRED | typeof PHASE_UNAVAILABLE; phase: string | null };

export function decideLegacyOperation(result: PhaseQueryResult): LegacyGuardDecision {
  const { data, error } = result || { data: null, error: null };
  if (error) {
    if (MISSING_RELATION_CODES.has(String(error.code || ''))) return { allow: true, phase: null };
    return { allow: false, status: 503, code: PHASE_UNAVAILABLE, phase: null };
  }
  const phase = data && typeof data.phase === 'string' ? data.phase : null;
  if (phase === 'enforced') return { allow: false, status: 409, code: LEGACY_TRIAL_RETIRED, phase };
  return { allow: true, phase };
}

export async function checkLegacyOperationAllowed(adminClient: ServiceClient): Promise<LegacyGuardDecision> {
  try {
    const result = await adminClient
      .from('subscription_activation').select('phase').eq('component', 'free_issue').maybeSingle();
    return decideLegacyOperation(result as PhaseQueryResult);
  } catch (_err) {
    return { allow: false, status: 503, code: PHASE_UNAVAILABLE, phase: null };
  }
}
