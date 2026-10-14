// Reading public.subscription_activation (component 'free_issue') from an Edge function with the service client.
// Pure classifier: no Deno globals, no I/O. The caller passes the PostgREST answer.
//   'absent'   - the subscription schema is not applied in this environment (table missing). The product keeps its existing
//                behavior unchanged; this is the state of every live environment today.
//   'prepared' | 'shadow' | 'enforced' - the stored phase (a missing seed row reads as 'prepared': nothing enforced).
//   'error'    - any other failure. Callers fail closed (never "assume not enforced" on an unknown error).
export type PhaseRead = 'absent' | 'prepared' | 'shadow' | 'enforced' | 'error';

const MISSING_RELATION = /(relation .* does not exist|could not find the table|schema cache)/i;

/** The table is not present in this environment (PostgREST PGRST205 / Postgres 42P01 for exactly that relation). */
export function isMissingRelationError(error: unknown, table = 'subscription_activation'): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: unknown; message?: unknown };
  const msg = typeof e.message === 'string' ? e.message : '';
  if ((e.code === '42P01' || e.code === 'PGRST205') && (msg === '' || msg.includes(table))) return true;
  return MISSING_RELATION.test(msg) && msg.includes(table);
}

/** PostgREST "function not found" (the RPC is not deployed in this environment). */
export function isMissingFunctionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: unknown; message?: unknown; status?: unknown };
  if (e.code === 'PGRST202' || e.code === '42883') return true;
  return typeof e.message === 'string' && /could not find the function/i.test(e.message);
}

export function classifyPhaseRead(answer: { data?: unknown; error?: unknown } | null | undefined): PhaseRead {
  if (!answer || typeof answer !== 'object') return 'error';
  if (answer.error) return isMissingRelationError(answer.error) ? 'absent' : 'error';
  const row = answer.data as { phase?: unknown } | null | undefined;
  if (row === null || row === undefined) return 'prepared';
  if (typeof row !== 'object') return 'error';
  const p = row.phase;
  return p === 'prepared' || p === 'shadow' || p === 'enforced' ? p : 'error';
}

export const isEnforced = (p: PhaseRead) => p === 'enforced';

/**
 * Legacy quote-id access to a PUBLIC read (get-public-quote {quote_id}, quote-presentation public_get {quoteId}).
 * Not enforced ('absent' | 'prepared' | 'shadow'): unchanged behavior. Enforced: (a) the VERIFIED owner (owner preview -
 * decided by the caller JWT, never a body flag; non-consuming) or (b) an id on the cutover allowlist
 * (is_legacy_public_quote); everything else 'not_found' (the caller answers with its uniform unknown-id 404).
 */
// Continuation (D) - rollback safety: a quote issued through the output authority (it has a quote_issue_ledger row) is
// CAPABILITY-SCOPED in EVERY phase: its bare id opens it only for the verified owner, also after a rollback to 'prepared'.
// Rolling enforcement back therefore never turns token-only documents into id-readable ones (no exposure bypass).
export function decideLegacyIdAccess(i: { phase: PhaseRead; isLegacy: unknown; callerUserId: string | null; quoteOwnerId: string | null; capabilityScoped?: unknown }):
  'serve' | 'not_found' | 'error' {
  if (i.phase === 'error') return 'error';
  if (i.capabilityScoped === true) return i.quoteOwnerId && i.callerUserId && i.callerUserId === i.quoteOwnerId ? 'serve' : 'not_found';
  if (i.phase !== 'enforced') return 'serve';
  if (i.quoteOwnerId && i.callerUserId && i.callerUserId === i.quoteOwnerId) return 'serve';
  if (i.isLegacy === true && i.quoteOwnerId) return 'serve';
  return 'not_found';
}
