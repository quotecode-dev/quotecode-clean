// subscription-authority action `authorize_output` (CROSSCUT_CONTRACT §3; OD-02; spec Phase 4).
// Pure, dependency-injected wrapper around the ADOPTED orchestrator (authorizeOutput.ts - byte-identical to the prep file,
// never edited). Order (every step fails closed; nothing after a failed step runs):
//   1. request: {quoteId, channel, idempotencyKey, expectedDigest} - channel in send/public_share/final_pdf/final_print, anything
//      else 400. There is no preview/draft channel, so a client flag cannot turn a preview into an output.
//   2. free_issue phase (server read). Not 'enforced' -> {ok:false, code:'not_activated'} with NO side effect (the client keeps
//      the legacy path).
//   3. send / public_share: the public route language is resolved from server-read market data BEFORE any consumption
//      (unresolved -> 409 market_unresolved, nothing reserved).
//   4. orchestrator.output (prepare -> immutable snapshot -> read-back -> finalize = the only commit point).
//   5. ONLY after a validated FINALIZED result: link channels mint a capability (32 random bytes, base64url, sha256 stored via
//      mint_public_capability); PDF / Print issue a <=120 s single-use grant via issue_output_grant.
// Retry with the same idempotency key after commit: prepare returns the durable FINALIZED attempt (no second consumption) and
// a new token / grant is minted for the same attempt. Every response body is rebuilt from an explicit allowlist.
import { OUTPUT_CHANNELS } from '../_shared/subscriptionContract.ts';
import {
  GRANT_TTL_SECONDS, mintToken, publicPathFor, resolveServerMarket, tokenHash, type Market, type RandomFill,
} from '../_shared/capabilityToken.ts';

export type Resp = { status: number; body: Record<string, unknown> };
type OutputResponse = { status: number; body: Record<string, unknown> };

export interface OutputRouteDeps {
  /** subscription_activation.free_issue phase as read by the service client ('absent' | 'prepared' | 'shadow' | 'enforced' | 'error') */
  readFreeIssuePhase(): Promise<string>;
  /** server-read market inputs of the JWT user: account_market.market and business_settings.country */
  readMarketInputs(userId: string): Promise<{ accountMarket: unknown; businessCountry: unknown }>;
  orchestrator: { output(auth: { userId: string }, body: unknown): Promise<OutputResponse> };
  /** mint_public_capability(p_user_id, p_attempt_id, p_token_hash, p_allowed_ops, p_expires_at) */
  mintCapability(a: { userId: string; attemptId: string; tokenHash: string; allowedOps: string[]; expiresAt: string | null }): Promise<unknown>;
  /** issue_output_grant(p_user_id, p_attempt_id, p_channel, p_grant_hash, p_ttl_seconds) */
  issueGrant(a: { userId: string; attemptId: string; channel: 'final_pdf' | 'final_print'; grantHash: string; ttlSeconds: number }): Promise<unknown>;
  random?: RandomFill;
  now?: () => number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (status: number, code: string, extra: Record<string, unknown> = {}): Resp => ({ status, body: { ok: false, code, ...extra } });
const LINK_OPS = ['view', 'approve'];

/** Allowlisted failure body from an orchestrator answer (codes are the orchestrator's own allowlisted codes). */
function failureFrom(r: OutputResponse): Resp {
  const b = isObj(r.body) ? r.body : {};
  const code = typeof b.code === 'string' && /^[a-z_]{3,64}$/.test(b.code) ? b.code : 'output_unavailable';
  const status = Number.isInteger(r.status) && r.status >= 400 && r.status <= 599 ? r.status : 503;
  const extra: Record<string, unknown> = {};
  if (typeof b.field === 'string' && /^[A-Za-z]{1,32}$/.test(b.field)) extra.field = b.field;
  if (typeof b.assetId === 'string' && b.assetId.length <= 64 && /^[A-Za-z0-9-]+$/.test(b.assetId)) extra.assetId = b.assetId;
  if (typeof b.attemptId === 'string' && UUID.test(b.attemptId)) extra.attemptId = b.attemptId;
  const f = b.freeIssues;
  if (isObj(f)) {
    const fi: Record<string, number> = {};
    for (const k of ['limit', 'consumed', 'reserved', 'remaining']) if (Number.isInteger(f[k]) && (f[k] as number) >= 0) fi[k] = f[k] as number;
    if (Object.keys(fi).length) extra.freeIssues = fi;
  }
  return fail(status, code, extra);
}

export function parseOutputRequest(body: unknown):
  { ok: true; quoteId: string; channel: typeof OUTPUT_CHANNELS[number]; idempotencyKey: string; expectedDigest: string } | { ok: false; res: Resp } {
  if (!isObj(body)) return { ok: false, res: fail(400, 'invalid_request', { field: 'body' }) };
  const { quoteId, channel, idempotencyKey, expectedDigest } = body;
  if (typeof quoteId !== 'string' || !UUID.test(quoteId)) return { ok: false, res: fail(400, 'invalid_request', { field: 'quoteId' }) };
  if (typeof channel !== 'string' || !(OUTPUT_CHANNELS as readonly string[]).includes(channel)) return { ok: false, res: fail(400, 'invalid_request', { field: 'channel' }) };
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 200) return { ok: false, res: fail(400, 'invalid_request', { field: 'idempotencyKey' }) };
  if (typeof expectedDigest !== 'string' || !HEX64.test(expectedDigest)) return { ok: false, res: fail(400, 'invalid_request', { field: 'expectedDigest' }) };
  return { ok: true, quoteId, channel: channel as typeof OUTPUT_CHANNELS[number], idempotencyKey, expectedDigest };
}

export async function authorizeOutputRoute(deps: OutputRouteDeps, userId: string, body: unknown): Promise<Resp> {
  if (typeof userId !== 'string' || !UUID.test(userId)) return fail(401, 'not_authenticated');
  const req = parseOutputRequest(body);
  if (!req.ok) return req.res;

  let phase: string;
  try { phase = await deps.readFreeIssuePhase(); } catch { return fail(503, 'output_unavailable'); }
  if (phase === 'error') return fail(503, 'output_unavailable');
  if (phase !== 'enforced') return fail(409, 'not_activated');

  const isLink = req.channel === 'send' || req.channel === 'public_share';
  let market: Market | null = null;
  if (isLink) {
    try { market = resolveServerMarket(await deps.readMarketInputs(userId)); } catch { return fail(503, 'output_unavailable'); }
    if (!market) return fail(409, 'market_unresolved');
  }

  let out: OutputResponse;
  try {
    out = await deps.orchestrator.output({ userId }, { quoteId: req.quoteId, channel: req.channel, idempotencyKey: req.idempotencyKey, expectedDigest: req.expectedDigest });
  } catch { return fail(503, 'output_unavailable'); }
  if (!out || out.status !== 200) return failureFrom(out ?? { status: 503, body: {} });

  // validated FINALIZED result only (the orchestrator already rebuilt it from its allowlist; checked again here)
  const b = isObj(out.body) ? out.body : {};
  if (b.ok !== true || b.state !== 'finalized' || typeof b.attemptId !== 'string' || !UUID.test(b.attemptId) || b.quoteId !== req.quoteId
      || typeof b.consumed !== 'boolean') return fail(503, 'final_response_invalid');
  const attemptId = b.attemptId;
  const common: Record<string, unknown> = { ok: true, channel: req.channel, attemptId, quoteId: req.quoteId, consumed: b.consumed };
  if (typeof b.alreadyFinalized === 'boolean') common.alreadyFinalized = b.alreadyFinalized;

  const random = deps.random;
  if (isLink) {
    const token = mintToken(random);
    const hash = await tokenHash(token);
    let minted: unknown;
    try {
      minted = await deps.mintCapability({ userId, attemptId, tokenHash: hash as string, allowedOps: [...LINK_OPS], expiresAt: null });
    } catch { minted = null; }
    // consumption is already durable; a retry with the same idempotency key reuses it and mints a fresh token
    if (!isObj(minted) || minted.ok !== true) return fail(503, 'capability_unavailable', { attemptId });
    return { status: 200, body: { ...common, publicPath: publicPathFor(token, market as Market) } };
  }

  const grant = mintToken(random);
  const hash = await tokenHash(grant);
  const now = (deps.now ?? Date.now)();
  let issued: unknown;
  try {
    issued = await deps.issueGrant({ userId, attemptId, channel: req.channel as 'final_pdf' | 'final_print', grantHash: hash as string, ttlSeconds: GRANT_TTL_SECONDS });
  } catch { issued = null; }
  if (!isObj(issued) || issued.ok !== true) return fail(503, 'grant_unavailable', { attemptId });
  const ceiling = now + GRANT_TTL_SECONDS * 1000;
  const sqlExp = typeof issued.expiresAt === 'string' ? Date.parse(issued.expiresAt) : NaN;
  const expiresAt = new Date(Number.isFinite(sqlExp) ? Math.min(sqlExp, ceiling) : ceiling).toISOString();
  return { status: 200, body: { ...common, grant, expiresAt } };
}
