// Owner console 2026-11-06 (typed night-task approval): the SMART PACK usage meter, the Edge Function side - prices, the cost of the
// provider's own usage numbers, the reserves, the claim / finish calls; and how chat-ai wires it (a data question only).
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRICES, RESERVE_MICROS, BUDGET_EXHAUSTED, priceOf, tokenUsage, tokenCostUsdMicros, sumUsage, transcribeCostUsdMicros,
  transcribeUsageCostUsdMicros, speechCostUsdMicros, claimMeter, finishMeter, parseBoiUsdRate, refreshFxRate, resetFxRefreshForTests, BOI_USD_RATE_URL,
} from './usageMeter.ts';
import { smartPackUsedUpAnswer, smartPackMeterUnavailableAnswer } from '../chat-ai/chatTools.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const RATE = 3.5;
const BUDGET = 4000000;

describe('prices and costs', () => {
  it('the models the functions call are priced; a dated snapshot is priced as its family; an unknown model as the most expensive', () => {
    for (const m of ['gpt-6-luna', 'gpt-6.1-sol', 'gpt-4o-mini']) expect(PRICES[m]).toBeTruthy();
    expect(priceOf('gpt-4o-mini-2024-07-18')).toEqual(PRICES['gpt-4o-mini']);
    expect(priceOf('gpt-6-luna')).toEqual(PRICES['gpt-6-luna']);
    expect(priceOf('some-new-model')).toEqual(PRICES['gpt-6.1-sol']);
    expect(priceOf('')).toEqual(PRICES['gpt-6.1-sol']);
  });
  it('both usage shapes are read (Chat Completions and Responses), cached input at the cached price', () => {
    expect(tokenUsage('gpt-6-luna', { prompt_tokens: 1000, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 400 } }))
      .toEqual({ model: 'gpt-6-luna', promptTokens: 1000, cachedTokens: 400, completionTokens: 50 });
    expect(tokenUsage('gpt-6.1-sol', { input_tokens: 9000, output_tokens: 700, input_tokens_details: { cached_tokens: 8000 } }))
      .toEqual({ model: 'gpt-6.1-sol', promptTokens: 9000, cachedTokens: 8000, completionTokens: 700 });
    expect(tokenUsage('gpt-6-luna', null)).toEqual({ model: 'gpt-6-luna', promptTokens: 0, cachedTokens: 0, completionTokens: 0 });
    // sol: 1,000 x 2 + 8,000 x 0.10 + 700 x 10 = 9,800 micro-USD
    expect(tokenCostUsdMicros(tokenUsage('gpt-6.1-sol', { input_tokens: 9000, output_tokens: 700, input_tokens_details: { cached_tokens: 8000 } }))).toBe(9800);
  });
  it('a data question (the cheap call + tool rounds) is summed', () => {
    const s = sumUsage([tokenUsage('gpt-6-luna', { prompt_tokens: 8000, completion_tokens: 40 }), tokenUsage('gpt-6.1-sol', { input_tokens: 9000, output_tokens: 600 }),
      tokenUsage('gpt-6.1-sol', { input_tokens: 10000, output_tokens: 300 })]);
    // 820 + 24,000 + 23,000 = 47,820 micro-USD = 0.167 ILS at 3.5
    expect(s).toMatchObject({ costUsdMicros: 47820, promptTokens: 27000, completionTokens: 940 });
  });
  it('voice: a recording by the provider duration (or 60 s when none), speech by characters', () => {
    expect(transcribeCostUsdMicros('gpt-transcribe', 15)).toBe(1125);
    expect(transcribeCostUsdMicros('gpt-transcribe', null)).toBe(4500);
    expect(transcribeCostUsdMicros('whisper-1', 60)).toBe(6000);
    expect(transcribeUsageCostUsdMicros('whisper-1', { type: 'duration', seconds: 30 })).toEqual({ costUsdMicros: 3000, seconds: 30 });
    expect(transcribeUsageCostUsdMicros('gpt-transcribe', null)).toEqual({ costUsdMicros: 4500, seconds: null });
    expect(speechCostUsdMicros('gpt-4o-mini-tts', 9)).toBe(225);
    expect(speechCostUsdMicros('tts-1', 1000)).toBe(15000);
  });
});

describe('the reserves: each is at least the action\'s maximum cost, and none takes more than a fifth of the month', () => {
  const ils = (usdMicros) => Math.ceil(usdMicros * RATE);
  it.each([
    ['ai_draft', ils(tokenCostUsdMicros({ model: 'gpt-4o-mini', promptTokens: 10000, cachedTokens: 0, completionTokens: 1600 }))],
    ['file_quote', ils(tokenCostUsdMicros({ model: 'gpt-6-luna', promptTokens: 20000, cachedTokens: 0, completionTokens: 6000 }))],
    ['customer_twin', ils(tokenCostUsdMicros({ model: 'gpt-6-luna', promptTokens: 6000, cachedTokens: 0, completionTokens: 1400 })
      + tokenCostUsdMicros({ model: 'gpt-4o-mini', promptTokens: 6000, cachedTokens: 0, completionTokens: 1400 }))],
    ['chat_data', ils(tokenCostUsdMicros({ model: 'gpt-6-luna', promptTokens: 10000, cachedTokens: 0, completionTokens: 900 })
      + tokenCostUsdMicros({ model: 'gpt-6.1-sol', promptTokens: 44000, cachedTokens: 0, completionTokens: 6000 }))],
    ['voice_transcribe', ils(transcribeCostUsdMicros('gpt-transcribe', 60) + transcribeCostUsdMicros('whisper-1', 60))],
    ['voice_speak', ils(speechCostUsdMicros('gpt-4o-mini-tts', 1500) + speechCostUsdMicros('tts-1', 1500))],
  ])('%s', (key, max) => {
    expect(RESERVE_MICROS[key]).toBeGreaterThanOrEqual(max);
    expect(RESERVE_MICROS[key]).toBeLessThanOrEqual(BUDGET / 5);
  });
});

describe('claim and finish', () => {
  it('claim: the caller rpc with the feature and the reserve; only a well-formed ok is ok, anything else is refused', async () => {
    const rpc = vi.fn(async () => ({ data: { ok: true, claimId: 'c1', status: {} }, error: null }));
    expect(await claimMeter({ rpc }, 'ai_draft', 12000.4)).toEqual({ ok: true, claimId: 'c1' });
    expect(rpc).toHaveBeenCalledWith('smart_pack_usage_claim', { p_feature: 'ai_draft', p_reserve_micros: 12001 });
    expect(await claimMeter({ rpc: async () => ({ data: { ok: false, code: BUDGET_EXHAUSTED }, error: null }) }, 'voice', 1)).toEqual({ ok: false, code: 'budget_exhausted' });
    expect(await claimMeter({ rpc: async () => ({ data: null, error: { message: 'x' } }) }, 'voice', 1)).toEqual({ ok: false, code: 'meter_unavailable' });
    expect(await claimMeter({ rpc: async () => { throw new Error('net'); } }, 'voice', 1)).toEqual({ ok: false, code: 'meter_unavailable' });
    expect(await claimMeter({ rpc: async () => ({ data: { ok: true }, error: null }) }, 'voice', 1)).toEqual({ ok: false, code: 'meter_unavailable' });
  });
  it('finish: the service rpc with the real cost; never throws', async () => {
    const rpc = vi.fn(async () => ({ data: { ok: true }, error: null }));
    await finishMeter({ rpc }, 'c1', true, { costUsdMicros: 675.2, model: 'gpt-4o-mini', promptTokens: 3000, cachedTokens: 1000, completionTokens: 500 });
    expect(rpc).toHaveBeenCalledWith('smart_pack_usage_finish', { p_claim_id: 'c1', p_ok: true, p_cost_usd_micros: 676, p_model: 'gpt-4o-mini',
      p_prompt_tokens: 3000, p_cached_tokens: 1000, p_completion_tokens: 500, p_units: null });
    await expect(finishMeter({ rpc: async () => { throw new Error('net'); } }, 'c1', false, { costUsdMicros: 0 })).resolves.toBeUndefined();
  });
});

// Owner console 2026-11-06 (typed: "החלטתי כבר, שער יציג פלוס 10%"): the representative rate, read once a day when the database asks
describe('the representative rate', () => {
  const CSV = 'DATAFLOW,TIME_PERIOD,OBS_VALUE,UNIT_MULT\nBOI,2026-11-04,3.105,0\nBOI,2026-11-05,3.112,0\nBOI,2026-11-06,3.099,0\nBOI,2026-11-07,3.5,0';
  it('the latest rate on or before the day, from the Bank of Israel CSV; nonsense is refused', () => {
    expect(parseBoiUsdRate(CSV, '2026-11-06')).toEqual({ rate: 3.099, date: '2026-11-06' });
    expect(parseBoiUsdRate(CSV, '2026-11-05')).toEqual({ rate: 3.112, date: '2026-11-05' });
    expect(parseBoiUsdRate('x,y\n1,2', '2026-11-06')).toBeNull();
    expect(parseBoiUsdRate('TIME_PERIOD,OBS_VALUE\n2026-11-06,99', '2026-11-06')).toBeNull();
  });
  it('a finish that says the rate is stale reads it once and stores it (service role); a fresh one never fetches', async () => {
    resetFxRefreshForTests();
    const rpc = vi.fn(async (fn) => ({ data: fn === 'smart_pack_usage_finish' ? { ok: true, fxStale: true } : { ok: true }, error: null }));
    const fetchImpl = vi.fn(async () => new Response(CSV, { status: 200 }));
    await finishMeter({ rpc }, 'c1', true, { costUsdMicros: 100 }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toMatch(new RegExp(`^${BOI_USD_RATE_URL.replace(/[.]/g, '\\.')}\\?startperiod=\\d{4}-\\d{2}-\\d{2}&endperiod=\\d{4}-\\d{2}-\\d{2}&format=csv$`));
    expect(rpc.mock.calls[1][0]).toBe('smart_pack_store_fx_rate');
    await finishMeter({ rpc }, 'c2', true, { costUsdMicros: 100 }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // once a day per running function
    resetFxRefreshForTests();
    const fresh = vi.fn(async () => ({ data: { ok: true, fxStale: false }, error: null }));
    await finishMeter({ rpc: fresh }, 'c3', true, { costUsdMicros: 100 }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('a failing Bank of Israel answer is ignored (the last rate stays), never thrown', async () => {
    resetFxRefreshForTests();
    const rpc = vi.fn(async () => ({ data: { ok: true }, error: null }));
    await expect(refreshFxRate({ rpc }, vi.fn(async () => { throw new Error('net'); }))).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('chat-ai wiring: only a question that reads the account\'s data is metered', () => {
  const src = fs.readFileSync(path.join(here, '..', 'chat-ai', 'index.ts'), 'utf8');
  it('the day\'s 30 stays only for an account without SMART PACK (the meter replaces it)', () => {
    expect(src).toMatch(/if \(userJwtClient && !trustedFacts\?\.isAdmin && !smartPackAllowed\) \{\s+try \{\s+const \{ data: claim, error: claimErr \} = await userJwtClient\.rpc\('chat_ai_claim_question'\)/);
  });
  it('the meter is read before the first model call; used up / unreadable = an own-data question gets the fixed answer, otherwise no tools', () => {
    const status = src.indexOf("rpc('smart_pack_usage_status')");
    expect(status).toBeGreaterThan(src.indexOf('let toolCtx'));
    expect(status).toBeLessThan(src.indexOf('const callCheapModel'));
    expect(src.slice(status, status + 1200)).toMatch(/ownDataQuestion[\s\S]*smartPackUsedUpAnswer[\s\S]*toolCtx = null;/);
  });
  it('the reserve is claimed right before the tool loop (the caller JWT) and finished after it with the summed usage (the service role)', () => {
    const claim = src.indexOf("claimMeter(userJwtClient");
    const loop = src.indexOf('await runToolLoop(');
    const fin = src.indexOf('await finishMeter(adminClient');
    expect(claim).toBeGreaterThan(src.indexOf('if (toolCtx && (firstCalls.length || screenshot))'));
    expect(claim).toBeLessThan(loop);
    expect(fin).toBeGreaterThan(loop);
    expect(src).toMatch(/onUsage: \(u\) => \{ usages\.push\(tokenUsage\(TOOLS_MODEL, u\)\); \}/);
    // the plain path (no tool call) never claims: claimMeter appears once, inside the tool branch
    expect(src.match(/claimMeter\(/g)).toHaveLength(1);
  });
  it('the fixed answers say what stops and what goes on, in both languages', () => {
    expect(smartPackUsedUpAnswer(true)).toMatch(/היתרה בחכם פלוס לחודש הזה לא מספיקה לקריאת הנתונים שלכם בצ׳אט/);
    expect(smartPackUsedUpAnswer(true)).toMatch(/שאלות על השימוש ב-TEKANGO ממשיכות כרגיל/);
    expect(smartPackUsedUpAnswer(false)).toMatch(/^Your SMART PACK usage left this month is not enough for reading your own data/);
    expect(smartPackMeterUnavailableAnswer(true)).toMatch(/נסו שוב/);
    expect(smartPackMeterUnavailableAnswer(false)).toMatch(/try again/);
  });
});
