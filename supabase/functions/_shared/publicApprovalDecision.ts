// Public approval / signature authorization (CROSSCUT_CONTRACT §2.3, spec Phase 4: "bound to finalized artifact_id,
// account, quote/version and allowed operation"). Pure decision module: no Deno globals, no I/O.
//
// Contract (coordinator, stream A SQL):
//   capability route  -> anon RPC public.public_approve_quote_capability(p_token text, p_signature_data_url text). SQL hashes the
//                        token, resolves op 'approve' and approves ONLY the quote bound to the capability. The client (core
//                        stream) calls it on /public-quote/c/:token and /en/public-quote/c/:token; it never sends a quote id.
//   legacy id route   -> anon RPC public.public_approve_quote(p_quote_id, p_signature_data_url), unchanged while free_issue is
//                        not enforced; stream A adds an enforced-phase guard (legacy-allowlisted ids only).
// planApprovalCall picks the RPC + exact arguments for a request (a malformed token never reaches SQL). decideApproval is the
// reference semantics both SQL functions must implement, used as the oracle in tests. (p0-aqp-0929-broker is NOT an approval
// path: it is the one-shot Production migration executor for 20260929000000 and is deliberately left untouched.)
import { isValidToken, parseCapabilityResolution, type CapabilityResolution } from './capabilityToken.ts';
import type { PhaseRead } from './activationPhase.ts';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type ApprovalRequest =
  | { mode: 'capability'; token: string; tokenValid: boolean; claimedQuoteId: string | null }
  | { mode: 'legacy'; quoteId: string }
  | { mode: 'invalid' };

/** Exactly one addressing mode. A token request may echo a quote id; it is only ever compared, never trusted. */
export function parseApprovalRequest(body: unknown): ApprovalRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { mode: 'invalid' };
  const b = body as Record<string, unknown>;
  const hasToken = Object.prototype.hasOwnProperty.call(b, 'capability_token');
  if (hasToken) {
    const token = typeof b.capability_token === 'string' ? b.capability_token : '';
    const q = b.quote_id;
    if (q !== undefined && (typeof q !== 'string' || !UUID_RE.test(q))) return { mode: 'invalid' };
    return { mode: 'capability', token, tokenValid: isValidToken(token), claimedQuoteId: typeof q === 'string' ? q.toLowerCase() : null };
  }
  if (typeof b.quote_id === 'string' && UUID_RE.test(b.quote_id)) return { mode: 'legacy', quoteId: b.quote_id.toLowerCase() };
  return { mode: 'invalid' };
}

export type ApprovalDecision =
  | { allow: true; quoteId: string; via: 'capability' | 'legacy_unenforced' | 'legacy_allowlisted'; capability?: CapabilityResolution }
  | { allow: false; status: 400 | 404 | 503; code: 'invalid_request' | 'not_found' | 'unavailable' };

const NOT_FOUND = Object.freeze({ allow: false, status: 404, code: 'not_found' } as const);

/**
 * @param resolutionRaw  the raw answer of resolve_public_capability(hash, 'approve') - pass undefined when not queried
 *                       (a malformed token must never reach SQL)
 * @param phase          free_issue phase read (activationPhase.classifyPhaseRead)
 * @param isLegacy       is_legacy_public_quote(id) answer (only consulted for an enforced legacy request)
 */
export function decideApproval(req: ApprovalRequest, ctx: { resolutionRaw?: unknown; phase?: PhaseRead; isLegacy?: unknown }): ApprovalDecision {
  if (req.mode === 'invalid') return { allow: false, status: 400, code: 'invalid_request' };
  if (req.mode === 'capability') {
    if (!req.tokenValid) return NOT_FOUND;
    const r = parseCapabilityResolution(ctx.resolutionRaw, 'approve');
    if (!r) return NOT_FOUND;                                   // unknown / revoked / expired / view-only / malformed
    if (req.claimedQuoteId !== null && req.claimedQuoteId !== r.quoteId) return NOT_FOUND; // token swap: A cannot approve B
    return { allow: true, quoteId: r.quoteId, via: 'capability', capability: r };
  }
  // legacy id path
  const phase = ctx.phase;
  if (phase === 'error' || phase === undefined) return { allow: false, status: 503, code: 'unavailable' };
  if (phase !== 'enforced') return { allow: true, quoteId: req.quoteId, via: 'legacy_unenforced' }; // unchanged behavior
  return ctx.isLegacy === true ? { allow: true, quoteId: req.quoteId, via: 'legacy_allowlisted' } : NOT_FOUND;
}

export type ApprovalCall =
  | { call: true; rpc: 'public_approve_quote_capability'; args: { p_token: string; p_signature_data_url: string } }
  | { call: true; rpc: 'public_approve_quote'; args: { p_quote_id: string; p_signature_data_url: string } }
  | { call: false; status: 400 | 404; code: 'invalid_request' | 'not_found' };

/** Which approval RPC a request maps to, with its exact arguments. The capability call carries the raw token only. */
export function planApprovalCall(req: ApprovalRequest, signatureDataUrl: unknown): ApprovalCall {
  if (req.mode === 'invalid' || typeof signatureDataUrl !== 'string' || !signatureDataUrl.startsWith('data:image/')) {
    return { call: false, status: 400, code: 'invalid_request' };
  }
  if (req.mode === 'capability') {
    if (!req.tokenValid) return { call: false, status: 404, code: 'not_found' };
    return { call: true, rpc: 'public_approve_quote_capability', args: { p_token: req.token, p_signature_data_url: signatureDataUrl } };
  }
  return { call: true, rpc: 'public_approve_quote', args: { p_quote_id: req.quoteId, p_signature_data_url: signatureDataUrl } };
}
