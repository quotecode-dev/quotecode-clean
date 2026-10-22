// customer-twin ("בדיקת הלקוח", Owner night task 2026-10-22, docs/NIGHT_TASK_PLAN_2026-10-22.md) - the AI view of a quote BEFORE it is
// sent, from three customer perspectives. Pure and dependency-injected (vitest + Deno); index.ts is wiring only.
//   * identity: the caller's verified user (index.ts: verify_jwt + auth.getUser); the market / language come from business_settings only.
//   * the body is the OPEN quote as the editor holds it; it is sanitized here again (_shared/customerTwin.js): only quote content.
//   * allowance (SQL customer_twin_claim, the CALLER): a stored answer of the same content is free; otherwise one of the month's 20
//     (SMART PACK) or one purchased check is used. It FAILS CLOSED: no answer from SQL = no AI call.
//   * the model answers in a strict schema; the answer is validated (no invented amount); a failure gives the check back (refund).
//   * nothing about the quote is logged; the recipient never sees any of it.
import {
  TWIN_RESPONSE_SCHEMA, TWIN_PROMPT_VERSION, sanitizeTwinQuote, twinChecklist, twinContentKey, buildTwinMessages, validateTwinReply, parseStoredTwin,
} from '../_shared/customerTwin.js';

export type Resp = { status: number; body: Record<string, unknown> };
export const TWIN_MODEL = 'gpt-6-luna';
export const TWIN_FALLBACK_MODEL = 'gpt-4o-mini';

export interface CustomerTwinDeps {
  market(): Promise<'IL' | 'INTERNATIONAL' | null>;
  claim(contentSha256: string): Promise<Record<string, unknown>>;
  store(claimId: string, result: Record<string, unknown>, model: string): Promise<Record<string, unknown>>;
  refund(claimId: string): Promise<Record<string, unknown>>;
  /** one provider call; returns the message content (string) or throws */
  complete(a: { model: string; messages: unknown[]; schema: unknown }): Promise<string>;
  sha256(text: string): Promise<string>;
  today(): string;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (status: number, code: string, extra: Record<string, unknown> = {}): Resp => ({ status, body: { ok: false, code, ...extra } });
const CLAIM_REFUSALS: Record<string, number> = { invalid_request: 400, quota_exhausted: 429, smart_pack_required: 403, in_progress: 409 };

export async function customerTwinHandler(deps: CustomerTwinDeps, body: unknown): Promise<Resp> {
  const raw = isObj(body) ? body.quote : null;
  let market: 'IL' | 'INTERNATIONAL' | null = null;
  try { market = await deps.market(); } catch { return err(503, 'retry_later'); }
  if (market !== 'IL' && market !== 'INTERNATIONAL') return err(409, 'market_unresolved');
  // the market is the account's, never the body's
  const quote = sanitizeTwinQuote(isObj(raw) ? { ...raw, market } : null);
  if (!quote) return err(422, 'nothing_to_check');
  const isHebrew = market === 'IL';
  const checklist = twinChecklist(quote, deps.today());

  let sha: string;
  try { sha = await deps.sha256(twinContentKey(quote, TWIN_MODEL)); } catch { return err(503, 'retry_later'); }
  let claim: Record<string, unknown>;
  try { claim = await deps.claim(sha); } catch { return err(503, 'retry_later'); } // fail closed
  if (!isObj(claim) || claim.ok !== true) {
    const code = isObj(claim) && typeof claim.code === 'string' && claim.code in CLAIM_REFUSALS ? claim.code : 'retry_later';
    return err(CLAIM_REFUSALS[code] ?? 503, code, { checklist, status: isObj(claim) && isObj(claim.status) ? claim.status : null });
  }
  if (claim.cached === true) {
    const stored = parseStoredTwin(claim.result);
    if (stored) return { status: 200, body: { ok: true, cached: true, language: isHebrew ? 'he' : 'en', checklist, analysis: stored, status: claim.status ?? null } };
    return err(503, 'retry_later');
  }
  const claimId = typeof claim.claimId === 'string' ? claim.claimId : null;
  if (!claimId) return err(503, 'retry_later');

  const giveBack = async (code: string, status: number) => {
    const r = await deps.refund(claimId).catch(() => null);
    if (!isObj(r) || r.ok !== true) console.error(JSON.stringify({ fn: 'customer-twin', incident: 'refund_failed' }));
    return err(status, code, { checklist, status: isObj(r) && isObj(r.status) ? r.status : claim.status ?? null });
  };

  const messages = buildTwinMessages({ quote, checklist, isHebrew });
  let content: string | null = null;
  let model = TWIN_MODEL;
  for (const m of [TWIN_MODEL, TWIN_FALLBACK_MODEL]) {
    try { content = await deps.complete({ model: m, messages, schema: TWIN_RESPONSE_SCHEMA }); model = m; break; }
    catch (e) { if (!(e instanceof Error && e.message === 'model_unavailable')) break; }
  }
  if (content === null) return giveBack('provider_failure', 502);
  let parsed: unknown = null;
  try { parsed = JSON.parse(content); } catch { parsed = null; }
  const analysis = validateTwinReply(parsed, quote);
  if (!analysis) return giveBack('malformed_provider_response', 502);
  const saved = await deps.store(claimId, analysis as Record<string, unknown>, model).catch(() => null);
  if (!isObj(saved) || saved.ok !== true) console.error(JSON.stringify({ fn: 'customer-twin', incident: 'store_failed' }));
  return { status: 200, body: { ok: true, cached: false, language: isHebrew ? 'he' : 'en', checklist, analysis,
    status: isObj(saved) && isObj(saved.status) ? saved.status : claim.status ?? null } };
}

export { TWIN_PROMPT_VERSION };
