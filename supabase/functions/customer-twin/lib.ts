// customer-twin ("בדיקת הלקוח", Owner night task 2026-10-22, docs/NIGHT_TASK_PLAN_2026-10-22.md; Codex review fixes 2026-10-23) - the AI
// view of a quote BEFORE it is sent, from three customer perspectives. Pure and dependency-injected (vitest + Deno); index.ts is wiring.
//   * identity: the caller's verified user (index.ts: verify_jwt + auth.getUser); the market / language come from business_settings only,
//     by the product's market rule (twinMarketOf: Local / LCL / IL / Israel = IL, any other country = International - CT-06).
//   * the body is the OPEN quote as the editor holds it; it is sanitized here again (_shared/customerTwin.js): only quote content; a
//     quote longer than the limits is refused (CT-10).
//   * allowance (SQL customer_twin_claim, the CALLER): a stored answer of the same content is free; otherwise one of the month's 20
//     (SMART PACK) or one purchased check is used. It FAILS CLOSED: no answer from SQL = no AI call.
//   * the model answers in a strict schema; the answer is validated (no invented amount / percentage / date); a failure gives the check
//     back (refund). Every outcome says honestly whether the check was stored / given back (CT-05).
//   * nothing about the quote is logged; usage (tokens, model, time) is stored for the Owner's cost view (CT-14), never the content.
import {
  TWIN_RESPONSE_SCHEMA, TWIN_PROMPT_VERSION, sanitizeTwinQuote, twinChecklist, twinContentKey, buildTwinMessages, validateTwinReply,
  parseStoredTwin, twinMarketOf, twinTooLong,
} from '../_shared/customerTwin.js';

export type Resp = { status: number; body: Record<string, unknown> };
export type Usage = { model: string; promptTokens: number | null; completionTokens: number | null; providerMs: number };
export const TWIN_MODEL = 'gpt-6-luna';
export const TWIN_FALLBACK_MODEL = 'gpt-4o-mini';

export interface CustomerTwinDeps {
  /** business_settings.country of the caller (raw) */
  country(): Promise<string | null>;
  claim(contentSha256: string): Promise<Record<string, unknown>>;
  store(claimId: string, result: Record<string, unknown>, usage: Usage): Promise<Record<string, unknown>>;
  refund(claimId: string, usage: Usage | null): Promise<Record<string, unknown>>;
  /** one provider call; returns the message content and the token usage, or throws (Error('model_unavailable') = try the fallback) */
  complete(a: { model: string; messages: unknown[]; schema: unknown }): Promise<{ content: string; promptTokens: number | null; completionTokens: number | null }>;
  sha256(text: string): Promise<string>;
  today(): string;
  now(): number;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (status: number, code: string, extra: Record<string, unknown> = {}): Resp => ({ status, body: { ok: false, code, ...extra } });
const CLAIM_REFUSALS: Record<string, number> = { invalid_request: 400, quota_exhausted: 429, smart_pack_required: 403, in_progress: 409, too_many_failures: 429 };

export async function customerTwinHandler(deps: CustomerTwinDeps, body: unknown): Promise<Resp> {
  const raw = isObj(body) && isObj(body.quote) ? body.quote : null;
  let market: 'IL' | 'INTERNATIONAL' | null = null;
  try { market = twinMarketOf(await deps.country()) as 'IL' | 'INTERNATIONAL' | null; } catch { return err(503, 'retry_later'); }
  if (market !== 'IL' && market !== 'INTERNATIONAL') return err(409, 'market_unresolved');
  if (raw && twinTooLong(raw)) return err(422, 'quote_too_long');
  // the market is the account's, never the body's
  const quote = sanitizeTwinQuote(raw ? { ...raw, market } : null);
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
    if (stored) {
      return { status: 200, body: { ok: true, cached: true, analyzedAt: typeof claim.createdAt === 'string' ? claim.createdAt : null,
        language: isHebrew ? 'he' : 'en', checklist, analysis: stored, status: claim.status ?? null } };
    }
    return err(503, 'retry_later');
  }
  const claimId = typeof claim.claimId === 'string' ? claim.claimId : null;
  if (!claimId) return err(503, 'retry_later');

  // give the check back; refunded = SQL confirmed it (never promised without that)
  const giveBack = async (usage: Usage | null) => {
    const r = await deps.refund(claimId, usage).catch(() => null);
    const refunded = isObj(r) && r.ok === true;
    if (!refunded) console.error(JSON.stringify({ fn: 'customer-twin', incident: 'refund_unconfirmed' }));
    return { refunded, status: refunded && isObj(r) && isObj(r.status) ? r.status : claim.status ?? null };
  };

  const messages = buildTwinMessages({ quote, checklist, isHebrew });
  let reply: { content: string; promptTokens: number | null; completionTokens: number | null } | null = null;
  let model = TWIN_MODEL;
  const started = deps.now();
  for (const m of [TWIN_MODEL, TWIN_FALLBACK_MODEL]) {
    try { reply = await deps.complete({ model: m, messages, schema: TWIN_RESPONSE_SCHEMA }); model = m; break; }
    catch (e) { if (!(e instanceof Error && e.message === 'model_unavailable')) break; }
  }
  const usage: Usage = { model, promptTokens: reply?.promptTokens ?? null, completionTokens: reply?.completionTokens ?? null, providerMs: Math.max(0, deps.now() - started) };
  if (!reply) { const g = await giveBack(usage); return err(502, 'provider_failure', { checklist, ...g }); }
  let parsed: unknown = null;
  try { parsed = JSON.parse(reply.content); } catch { parsed = null; }
  const analysis = validateTwinReply(parsed, quote);
  if (!analysis) { const g = await giveBack(usage); return err(502, 'provider_failure', { checklist, ...g }); }
  const saved = await deps.store(claimId, analysis as Record<string, unknown>, usage).catch(() => null);
  if (!isObj(saved) || saved.ok !== true) {
    // CT-05: the answer is shown, but it was NOT stored - the check is given back so it is not charged for nothing
    console.error(JSON.stringify({ fn: 'customer-twin', incident: 'store_failed' }));
    const g = await giveBack(usage);
    return { status: 200, body: { ok: true, cached: false, saved: false, language: isHebrew ? 'he' : 'en', checklist, analysis, ...g } };
  }
  return { status: 200, body: { ok: true, cached: false, saved: true, language: isHebrew ? 'he' : 'en', checklist, analysis,
    status: isObj(saved.status) ? saved.status : claim.status ?? null } };
}

export { TWIN_PROMPT_VERSION };
