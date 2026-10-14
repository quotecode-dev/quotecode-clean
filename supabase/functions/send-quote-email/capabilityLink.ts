// send-quote-email - which quote link the email carries (OD-02; CROSSCUT §3; spec Phase 4). Pure, no Deno globals.
//   free_issue NOT enforced ('absent' | 'prepared' | 'shadow'): byte-identical current behavior - the id link; a
//     capabilityToken in the body is ignored.
//   enforced: the body must carry the raw 43-char capabilityToken minted by subscription-authority authorize_output (channel
//     'send'). resolve_public_capability(sha256(token), 'view') must bind the SAME quote and the SAME owner as the verified
//     caller JWT; anything else -> 403 capability_mismatch and no email. The link is built server-side from the fixed
//     production origin and the token - never from a request URL.
//   phase read error -> 503, no email (fail closed).
import { parseCapabilityResolution, tokenHash } from '../_shared/capabilityToken.ts';
import type { PhaseRead } from '../_shared/activationPhase.ts';

export type EmailLinkDecision = { ok: true; link: string; mode: 'legacy' | 'capability' } | { ok: false; status: 403 | 503; body: Record<string, unknown> };

export function legacyQuoteLink(origin: string, quoteId: string, hebrew: boolean): string {
  return hebrew ? `${origin}/public-quote/${quoteId}` : `${origin}/en/public-quote/${quoteId}?lang=en`;
}

export async function decideEmailLink(i: {
  phase: PhaseRead; origin: string; quoteId: string; callerUserId: string; hebrew: boolean; capabilityToken: unknown;
  resolve(tokenHash: string): Promise<unknown>;
}): Promise<EmailLinkDecision> {
  if (i.phase === 'error') return { ok: false, status: 503, body: { error: 'capability_unavailable' } };
  if (i.phase !== 'enforced') return { ok: true, mode: 'legacy', link: legacyQuoteLink(i.origin, i.quoteId, i.hebrew) };
  const mismatch: EmailLinkDecision = { ok: false, status: 403, body: { error: 'capability_mismatch' } };
  const hash = await tokenHash(i.capabilityToken);
  if (!hash) return mismatch;                                   // missing / malformed token never reaches SQL
  let raw: unknown;
  try { raw = await i.resolve(hash); } catch { return { ok: false, status: 503, body: { error: 'capability_unavailable' } }; }
  const r = parseCapabilityResolution(raw, 'view');
  if (!r || r.quoteId !== String(i.quoteId).toLowerCase() || r.userId !== String(i.callerUserId).toLowerCase()) return mismatch;
  const token = i.capabilityToken as string;
  return { ok: true, mode: 'capability', link: i.hebrew ? `${i.origin}/public-quote/c/${token}` : `${i.origin}/en/public-quote/c/${token}` };
}

/** The body as it may be logged: the raw capability token is never written to a log (absent key -> identical output). */
export function loggableBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.prototype.hasOwnProperty.call(body, 'capabilityToken')) return body;
  return { ...(body as Record<string, unknown>), capabilityToken: '[redacted]' };
}
