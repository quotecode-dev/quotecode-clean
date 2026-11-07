// Owner console 2026-11-06 (typed: "מאשר את משימת הלילה בסדר הזה: שחרור א׳, מונה השימוש של חכם פלוס (4 ₪ = 100%, שער 3.5 ₪ לדולר, לפי
// התשובות שנתתי) ... כולל שינוי ב-L-01, L-05, L-06, L-09, L-11, L-12, L-14, L-17, L-22"): the SMART PACK usage meter, the Edge Function
// side (the database side is 20261106100000_smart_pack_usage_meter.sql). Every metered AI action:
//   1. claims BEFORE the provider call with the CALLER's token (smart_pack_usage_claim) - it holds the action's MAXIMUM possible cost
//      (RESERVE_MICROS, micro-ILS at 3.5 ILS per USD), so the month's 4 ILS can never be passed; a refusal (budget_exhausted /
//      smart_pack_required) means no provider call at all;
//   2. finishes AFTER the call with the service role (smart_pack_usage_finish): the REAL cost from the provider's own usage numbers
//      (PRICES, USD per 1M tokens) - or 0 when the call failed (the reserve is given back).
// Metered: a chat question that reads the account's data (the tool path), voice, the AI smart quote / smart edit, a quote from a file,
// Customer Twin. A plain chat question is never metered. The super admin is recorded but never refused (the database decides).
// Prices: OpenAI pricing page as read 2026-11-06 (gpt-6-luna / gpt-6.1-sol), list prices for the older models; an unknown model is
// priced as the most expensive one, never as free.

export type MeterFeature = 'chat_data' | 'voice' | 'ai_draft' | 'file_quote' | 'customer_twin';
export const BUDGET_EXHAUSTED = 'budget_exhausted';

// USD per 1M tokens: input, cached input, output
export const PRICES: Readonly<Record<string, { input: number; cached: number; output: number }>> = Object.freeze({
  'gpt-6-luna': { input: 0.10, cached: 0.01, output: 0.50 },
  'gpt-6.1-sol': { input: 2.00, cached: 0.10, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, cached: 0.075, output: 0.60 },
});
const MOST_EXPENSIVE = PRICES['gpt-6.1-sol'];
// voice: USD per minute of audio (transcription) and per character (speech; ~600 spoken characters a minute at about US$0.015)
export const TRANSCRIBE_USD_PER_MINUTE: Readonly<Record<string, number>> = Object.freeze({ 'gpt-transcribe': 0.0045, 'whisper-1': 0.006 });
export const SPEECH_USD_PER_CHAR: Readonly<Record<string, number>> = Object.freeze({ 'gpt-4o-mini-tts': 0.000025, 'tts-1': 0.000015 });

// the maximum possible cost of ONE action, in micro-ILS at 3.5 ILS per USD (held while the call runs; see the header)
export const RESERVE_MICROS: Readonly<Record<string, number>> = Object.freeze({
  ai_draft: 12000,        // gpt-4o-mini: <= ~10k tokens in + 1,600 out
  file_quote: 20000,      // gpt-6-luna: <= 5 pages in + 6,000 out
  customer_twin: 12000,   // gpt-6-luna, then gpt-4o-mini as a fallback: two calls of 1,400 out
  chat_data: 650000,      // the cheap call + up to 4 gpt-6.1-sol tool rounds of 1,500 out each
  voice_transcribe: 40000, // <= 60 s of audio, two models at most
  voice_speak: 220000,    // <= 1,500 characters, two models at most
});

type Num = number | null | undefined;
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
// round up to a whole micro-USD, after dropping binary float noise (9 x 25.000000000000004 is 225, not 226)
const ceilMicros = (x: number): number => Math.ceil(Math.round(x * 1e6) / 1e6);

/** token usage from either provider shape: Chat Completions (prompt/completion) or Responses (input/output) */
export type TokenUsage = { model: string; promptTokens: number; cachedTokens: number; completionTokens: number };
export function tokenUsage(model: string, usage: unknown): TokenUsage {
  const u = (usage && typeof usage === 'object' ? usage : {}) as Record<string, unknown>;
  const details = (u.prompt_tokens_details || u.input_tokens_details || {}) as Record<string, unknown>;
  return {
    model,
    promptTokens: n(u.prompt_tokens) || n(u.input_tokens),
    cachedTokens: n(details.cached_tokens),
    completionTokens: n(u.completion_tokens) || n(u.output_tokens),
  };
}

/** micro-USD of token usage: cached input at the cached price, the rest at the input price, output (reasoning included) at the output price */
/** the price of a model id - a dated snapshot ("gpt-4o-mini-2024-07-18") is priced as its family; unknown = the most expensive */
export function priceOf(model: string): { input: number; cached: number; output: number } {
  const id = String(model || '');
  const key = Object.keys(PRICES).sort((a, b) => b.length - a.length).find((k) => id === k || id.startsWith(`${k}-`));
  return key ? PRICES[key] : MOST_EXPENSIVE;
}

export function tokenCostUsdMicros(u: TokenUsage): number {
  const p = priceOf(u.model);
  const cached = Math.min(u.cachedTokens, u.promptTokens);
  return ceilMicros((u.promptTokens - cached) * p.input + cached * p.cached + u.completionTokens * p.output);
}

// Owner console 2026-11-07 (typed: "מאשר את שחרור ד׳ ושחרור ה׳ לפי ההמלצות, סעיף 3 לספור ..." + the plan, Codex M02): the reserve of a
// token action is its PROVEN maximum - every byte of what is sent counted as one token (a token is never shorter than one byte; a
// file's pages at a fixed page bound), plus the output cap, at each model's own price, summed over every model the action may call - in
// micro-USD. The database converts it at today's rate (smart_pack_usage_claim, p_reserve_usd_micros), never at a fixed 3.5.
export const FILE_PAGE_TOKENS_MAX = 10000;
export function inputTokensMax(payload: unknown): number {
  return new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload ?? '')).length;
}
export function reserveUsdMicros(models: string[], inputTokens: number, maxOutputTokens: number): number {
  return models.reduce((sum, m) => { const p = priceOf(m); return sum + ceilMicros(n(inputTokens) * p.input + n(maxOutputTokens) * p.output); }, 0);
}

/** the sum of several calls of one action (a fallback call, the tool rounds) */
export function sumUsage(list: TokenUsage[]): { costUsdMicros: number; model: string | null; promptTokens: number; cachedTokens: number; completionTokens: number } {
  return list.reduce((acc, u) => ({
    costUsdMicros: acc.costUsdMicros + tokenCostUsdMicros(u),
    model: u.model || acc.model,
    promptTokens: acc.promptTokens + u.promptTokens,
    cachedTokens: acc.cachedTokens + u.cachedTokens,
    completionTokens: acc.completionTokens + u.completionTokens,
  }), { costUsdMicros: 0, model: null as string | null, promptTokens: 0, cachedTokens: 0, completionTokens: 0 });
}

/** the provider answered but gave no usage numbers: count the action's reserve (its maximum, back in micro-USD) - never free.
 *  (3.5 = the meter's fallback rate; the real rate - the representative rate + 10% - is applied by the database at finish) */
export const RATE_ILS_PER_USD = 3.5;

// Owner console 2026-11-06 (typed: "החלטתי כבר, שער יציג פלוס 10%"): the database counts at the Bank of Israel representative rate +
// 10%. When it says today's rate is missing (fxStale), the representative rate is read ONCE (per running function, per Israel day) from
// the Bank of Israel public SDMX service - the same source the expense invoices use - and stored. Any failure keeps the last rate.
export const BOI_USD_RATE_URL = 'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS';
/** the latest representative rate on or before `date` from the Bank of Israel CSV, or null */
export function parseBoiUsdRate(csv: string, date: string): { rate: number; date: string } | null {
  const lines = String(csv || '').trim().split(/\r?\n/);
  const head = (lines.shift() || '').split(',');
  const iT = head.indexOf('TIME_PERIOD'); const iV = head.indexOf('OBS_VALUE'); const iM = head.indexOf('UNIT_MULT');
  if (iT < 0 || iV < 0) return null;
  let best: { rate: number; date: string } | null = null;
  for (const l of lines) {
    const c = l.split(',');
    const d = c[iT]; const v = Number(c[iV]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || d > date || !Number.isFinite(v) || v < 1 || v > 10 || (iM >= 0 && c[iM] !== '0')) continue;
    if (!best || d > best.date) best = { rate: v, date: d };
  }
  return best;
}
const israelDate = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
let fxTriedOn = '';
/** read and store today's representative rate (once per Israel day per running function); never throws, never blocks long */
export async function refreshFxRate(admin: RpcClient, fetchImpl: typeof fetch, now = new Date()): Promise<void> {
  const today = israelDate(now);
  if (fxTriedOn === today) return;
  fxTriedOn = today;
  try {
    const from = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const res = await fetchImpl(`${BOI_USD_RATE_URL}?startperiod=${from}&endperiod=${today}&format=csv`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return;
    const r = parseBoiUsdRate(await res.text(), today);
    if (r) await admin.rpc('smart_pack_store_fx_rate', { p_date: r.date, p_usd_ils: r.rate });
  } catch { /* the last stored rate (or 3.5) stays */ }
}
export function resetFxRefreshForTests() { fxTriedOn = ''; }
export function usdMicrosOrReserve(costUsdMicros: number, tokensSeen: number, reserveMicros: number): number {
  return tokensSeen > 0 ? costUsdMicros : Math.ceil(reserveMicros / RATE_ILS_PER_USD);
}

/** micro-USD of one transcription: the provider's own duration when it gives one, otherwise the longest recording (60 s) */
export function transcribeCostUsdMicros(model: string, seconds: Num): number {
  const perMinute = TRANSCRIBE_USD_PER_MINUTE[model] ?? TRANSCRIBE_USD_PER_MINUTE['whisper-1'];
  const s = n(seconds) || 60;
  return ceilMicros((Math.min(s, 600) / 60) * perMinute * 1e6);
}

/** micro-USD of one transcription from the provider's own usage: { type: 'duration', seconds } (whisper-1) or { type: 'tokens', ... }
 *  (the gpt transcribe models: audio input US$6, text input US$2.5, output US$10 per 1M tokens); no usage = the longest recording */
export function transcribeUsageCostUsdMicros(model: string, usage: unknown): { costUsdMicros: number; seconds: number | null } {
  const u = (usage && typeof usage === 'object' ? usage : {}) as Record<string, unknown>;
  if (u.type === 'tokens') {
    const d = (u.input_token_details || {}) as Record<string, unknown>;
    const audio = n(d.audio_tokens);
    const textIn = n(d.text_tokens) || Math.max(0, n(u.input_tokens) - audio);
    return { costUsdMicros: ceilMicros(audio * 6 + textIn * 2.5 + n(u.output_tokens) * 10), seconds: null };
  }
  const seconds = u.type === 'duration' ? n(u.seconds) : 0;
  return { costUsdMicros: transcribeCostUsdMicros(model, seconds || null), seconds: seconds || null };
}

/** micro-USD of one spoken answer */
export function speechCostUsdMicros(model: string, chars: number): number {
  const perChar = SPEECH_USD_PER_CHAR[model] ?? SPEECH_USD_PER_CHAR['gpt-4o-mini-tts'];
  return ceilMicros(n(chars) * perChar * 1e6);
}

type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
export type MeterClaim = { ok: true; claimId: string } | { ok: false; code: string };

/** step 1 (the CALLER's token): hold the reserve. Anything unreadable is refused - no meter answer, no provider call.
 *  reserveUsdMicros (2026-11-07): the proven maximum in micro-USD - the database converts it at today's rate; reserveMicros (micro-ILS
 *  at 3.5) stays as the validated fallback value. */
export async function claimMeter(caller: RpcClient, feature: MeterFeature, reserveMicros: number, reserveUsd: number | null = null): Promise<MeterClaim> {
  try {
    const usd = reserveUsd != null && Number.isFinite(reserveUsd) && reserveUsd > 0 ? Math.ceil(reserveUsd) : null;
    const ils = Math.min(2000000, Math.max(1, Math.ceil(usd != null ? usd * RATE_ILS_PER_USD : reserveMicros)));
    const { data, error } = await caller.rpc('smart_pack_usage_claim', usd != null
      ? { p_feature: feature, p_reserve_micros: ils, p_reserve_usd_micros: usd }
      : { p_feature: feature, p_reserve_micros: ils });
    const d = (data || {}) as { ok?: boolean; claimId?: string; code?: string };
    if (error || !d || typeof d !== 'object') return { ok: false, code: 'meter_unavailable' };
    if (d.ok === true && typeof d.claimId === 'string') return { ok: true, claimId: d.claimId };
    return { ok: false, code: typeof d.code === 'string' ? d.code : 'meter_unavailable' };
  } catch {
    return { ok: false, code: 'meter_unavailable' };
  }
}

/** step 2 (the service role): the real cost (ok) or the reserve given back (not ok). Never throws - a lost finish is given back by the
 *  database after 10 minutes (the stale rule). A finish the database did not confirm is logged with a fixed incident code (no content). */
export async function finishMeter(admin: RpcClient, claimId: string, ok: boolean,
  cost: { costUsdMicros: number; model?: string | null; promptTokens?: number; cachedTokens?: number; completionTokens?: number; units?: number | null },
  fetchImpl: typeof fetch | null = (typeof fetch === 'function' ? fetch : null)): Promise<void> {
  let confirmed = false;
  let fxStale = false;
  // Owner console 2026-11-07 (Codex M03, "סעיף 3 לספור"): up to 3 attempts; a claim the database already closed (or does not know) is not
  // retried. A finish that never lands is counted at its reserve by the database after 10 minutes (never given back).
  for (let attempt = 0; attempt < 3 && !confirmed; attempt += 1) {
    try {
      const { data, error } = await admin.rpc('smart_pack_usage_finish', {
        p_claim_id: claimId, p_ok: ok, p_cost_usd_micros: Math.max(0, Math.ceil(cost.costUsdMicros || 0)), p_model: cost.model ?? null,
        p_prompt_tokens: cost.promptTokens ?? null, p_cached_tokens: cost.cachedTokens ?? null, p_completion_tokens: cost.completionTokens ?? null,
        p_units: cost.units ?? null,
      });
      confirmed = !error && !!data && (data as { ok?: unknown }).ok === true;
      fxStale = confirmed && (data as { fxStale?: unknown }).fxStale === true;
      const code = !error && data ? (data as { code?: unknown }).code : null;
      if (code === 'already_finished' || code === 'no_claim') break;
    } catch { confirmed = false; }
  }
  if (!confirmed) console.error(JSON.stringify({ incident: 'smart_pack_meter_finish_unconfirmed' }));
  if (fxStale && fetchImpl) await refreshFxRate(admin, fetchImpl);
}
