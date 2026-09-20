// TEKANGO Admin V1 (Task 3): shared helper for every privileged Admin Edge
// Function to atomically claim a re-auth proof minted by
// admin-reauth-verify, and to write one admin_audit_log row after the
// action resolves. Used by admin-set-lifetime, admin-extend-trial,
// admin-delete-user, admin-cleanup-user-quotes - never called from client
// code (Service Role client only).

// deno-lint-ignore no-explicit-any
export async function canonicalParamsHash(value: unknown): Promise<string> {
  const canonical = canonicalize(value);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// deno-lint-ignore no-explicit-any
function canonicalize(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export interface ClaimReauthProofArgs {
  // deno-lint-ignore no-explicit-any
  adminClient: any;
  proofToken: unknown;
  actorUserId: string;
  action: string;
  targetUserId: string | null;
  params: unknown;
}

export interface ClaimReauthProofResult {
  ok: boolean;
  error?: string;
}

// Atomically claims a proof row: fresh (expires_at > now), unused
// (used_at IS NULL), and bound to this exact actor/action/target/params
// (mismatched params - e.g. a different reason/target than what was
// re-authenticated for - refuse just like a stale/replayed proof). Zero
// rows updated means the proof is stale, replayed, mismatched, or forged -
// the caller gets one generic refusal message either way, never a hint
// which specific check failed (no oracle for guessing valid proof ids).
export async function claimReauthProof(args: ClaimReauthProofArgs): Promise<ClaimReauthProofResult> {
  const { adminClient, proofToken, actorUserId, action, targetUserId, params } = args;
  if (!proofToken || typeof proofToken !== 'string') {
    return { ok: false, error: 'Missing or invalid re-authentication proof.' };
  }
  const paramsHash = await canonicalParamsHash(params);
  const { data, error } = await adminClient
    .from('admin_reauth_proofs')
    .update({ used_at: new Date().toISOString() })
    .eq('id', proofToken)
    .eq('actor_user_id', actorUserId)
    .eq('action', action)
    .eq('params_hash', paramsHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .eq('target_user_id', targetUserId ?? '00000000-0000-0000-0000-000000000000')
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: 'Re-authentication check failed.' };
  if (!data) return { ok: false, error: 'Re-authentication is missing, expired, or does not match this action. Please re-authenticate and try again.' };
  return { ok: true };
}

export interface WriteAuditLogArgs {
  // deno-lint-ignore no-explicit-any
  adminClient: any;
  actorUserId: string | null;
  targetUserId: string | null;
  action: string;
  reason?: string | null;
  // deno-lint-ignore no-explicit-any
  beforeState?: any;
  // deno-lint-ignore no-explicit-any
  afterState?: any;
  outcome: 'success' | 'denied' | 'error';
}

// Never logs a password or proof secret (proofToken itself is never passed
// here) or customer document contents - only the structural fields each
// caller explicitly passes as beforeState/afterState (e.g. {is_lifetime}).
export async function writeAuditLog(args: WriteAuditLogArgs): Promise<void> {
  const { adminClient, actorUserId, targetUserId, action, reason, beforeState, afterState, outcome } = args;
  try {
    await adminClient.from('admin_audit_log').insert([{
      actor_user_id: actorUserId,
      target_user_id: targetUserId,
      action,
      reason: reason ?? null,
      before_state: beforeState ?? null,
      after_state: afterState ?? null,
      outcome,
    }]);
  } catch (_err) {
    // Audit-log failure must never mask or block the action's own real
    // result (the action already resolved by the time this runs) - best
    // effort only, silently swallowed rather than surfaced as the caller's
    // own error.
  }
}
