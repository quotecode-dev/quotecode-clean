// @vitest-environment node
// Owner console 2026-11-07 (typed: "מאשר את שחרור ד׳ ושחרור ה׳ לפי ההמלצות, סעיף 3 לספור, סעיף 9 בלי אזור זמן, כולל שינוי ב-L-01, L-05, L-06,
// L-09, L-11, L-12, L-14, L-17, L-22" + "מאשר את התוכנית לשחרור ה׳ ואחריו שחרור ד׳ כפי שהוצגה" + "מאשר שבעריכה חכמה שינוי תיאור יתקבל רק
// כשהבקשה מבקשת לשנות שם או תיאור, ופריט שמכיל שורה קיימת ייזרק, כחלק משחרור ד׳"): release D - the meter accuracy and the smart edit.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { reserveUsdMicros, inputTokensMax, claimMeter, finishMeter, FILE_PAGE_TOKENS_MAX } from '../supabase/functions/_shared/usageMeter.ts';
import { parseDraftChanges, parseDraftModelOutput, sanitizeQuoteSnapshot } from '../supabase/functions/_shared/aiQuoteDraft.js';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('M02: the reserve is the proven maximum, in micro-USD', () => {
  it('every byte counts as a token, + the output cap, at each model price, summed over the models', () => {
    expect(inputTokensMax('abc')).toBe(3);
    expect(inputTokensMax('שלום')).toBe(8); // 2 bytes a Hebrew letter: never fewer tokens than this
    expect(reserveUsdMicros(['gpt-4o-mini'], 1000, 1600)).toBe(1000 * 0.15 + 1600 * 0.6);
    expect(reserveUsdMicros(['gpt-6-luna', 'gpt-4o-mini'], 100, 100)).toBe(Math.ceil(100 * 0.1 + 100 * 0.5) + Math.ceil(100 * 0.15 + 100 * 0.6));
    expect(reserveUsdMicros(['unknown-model'], 10, 10)).toBe(10 * 2 + 10 * 10); // unknown = the most expensive, never free
    expect(FILE_PAGE_TOKENS_MAX).toBe(10000);
  });
  it('the claim sends the USD reserve (the database converts it at today\'s rate) and its 3.5 fallback in micro-ILS', async () => {
    const rpc = vi.fn(async () => ({ data: { ok: true, claimId: 'x' }, error: null }));
    await claimMeter({ rpc }, 'ai_draft', 12000, 1000);
    expect(rpc).toHaveBeenCalledWith('smart_pack_usage_claim', { p_feature: 'ai_draft', p_reserve_micros: 3500, p_reserve_usd_micros: 1000 });
    await claimMeter({ rpc }, 'ai_draft', 12000);
    expect(rpc).toHaveBeenLastCalledWith('smart_pack_usage_claim', { p_feature: 'ai_draft', p_reserve_micros: 12000 });
  });
  it('every metered function claims with its USD reserve', () => {
    expect(src('../supabase/functions/ai-quote-draft/index.ts')).toMatch(/claimMeter\(caller, 'ai_draft', RESERVE_MICROS\.ai_draft, reserveUsd\)/);
    expect(src('../supabase/functions/quote-from-file/index.ts')).toMatch(/reserveUsdMicros\(\[FILE_MODEL\], MAX_PAGES \* FILE_PAGE_TOKENS_MAX/);
    expect(src('../supabase/functions/customer-twin/lib.ts')).toMatch(/reserveUsdMicros\(\[TWIN_MODEL, TWIN_FALLBACK_MODEL\], inputTokensMax\(messages\), 1400\)/);
    expect(src('../supabase/functions/chat-ai/index.ts')).toMatch(/'chat_data', RESERVE_MICROS\.chat_data, Math\.ceil\(RESERVE_MICROS\.chat_data \/ RATE_ILS_PER_USD\)\)/);
    expect(src('../supabase/functions/voice-ai/index.ts')).toMatch(/speechCostUsdMicros\('gpt-4o-mini-tts', text\.length\) \+ speechCostUsdMicros\('tts-1', text\.length\)/);
  });
});

describe('M03: a finish is tried up to 3 times; a closed claim is not retried', () => {
  it('retries an unconfirmed finish, stops when confirmed', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'net' } }).mockResolvedValueOnce({ data: { ok: true }, error: null });
    await finishMeter({ rpc }, 'c', true, { costUsdMicros: 10 }, null);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('3 attempts at most; already_finished is not retried', async () => {
    const down = vi.fn(async () => ({ data: null, error: { message: 'net' } }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await finishMeter({ rpc: down }, 'c', true, { costUsdMicros: 10 }, null);
    expect(down).toHaveBeenCalledTimes(3);
    const closed = vi.fn(async () => ({ data: { ok: false, code: 'already_finished' }, error: null }));
    await finishMeter({ rpc: closed }, 'c', true, { costUsdMicros: 10 }, null);
    expect(closed).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});

describe('D01: a result that cannot be used is not counted for the customer (its real cost travels with the finish)', () => {
  it('the smart quote finishes AFTER the result is checked, ok = the result is usable', () => {
    const s = src('../supabase/functions/ai-quote-draft/index.ts');
    expect(s.indexOf('await finishMeter(admin, claim.claimId, draft.ok, real);')).toBeGreaterThan(s.indexOf('const draft = parseDraftModelOutput('));
  });
  it('the quote from a file: an unusable reading or a cut answer is finished not ok; the index passes the real cost whenever there was an answer', () => {
    const lib = src('../supabase/functions/quote-from-file/lib.ts');
    expect(lib).toMatch(/await meterDone\(false, answered\);/);
    expect(lib).toMatch(/const v = validateExtraction\(answer\.content\);\n {4}await meterDone\(v\.ok, answer\.usage\);/);
    expect(src('../supabase/functions/quote-from-file/index.ts')).toMatch(/costUsdMicros: u \? usdMicrosOrReserve\(/);
  });
  it('voice: an empty transcript is not counted', () => {
    expect(src('../supabase/functions/voice-ai/index.ts')).toMatch(/const usable = String\(transcript\.text \|\| ''\)\.trim\(\)\.length > 0;\n {4}await finishMeter\(admin, meter\.claimId, usable,/);
  });
});

describe('M04: the data chat counts every call of the question', () => {
  it('the fallback answer is counted, missing usage counts the reserve, one finish after the fallback', () => {
    const s = src('../supabase/functions/chat-ai/index.ts');
    expect(s).toMatch(/usages\.push\(tokenUsage\(String\(\(fb as \{ model\?: unknown \}\)\?\.model \|\| CHEAP_MODEL\)/);
    expect(s).toMatch(/const missingUsage = usages\.some\(\(u\) => u\.promptTokens \+ u\.completionTokens === 0\)/);
    expect(s.match(/await finishMeter\(adminClient/g)).toHaveLength(1);
    expect(s.indexOf('await finishMeter(adminClient')).toBeGreaterThan(s.indexOf('const fallback = await callCheapWithFallback(false);'));
  });
});

describe('smart edit (the Owner\'s approval of 2026-11-07)', () => {
  const QUOTE = sanitizeQuoteSnapshot({ items: [{ description: 'ריצוף חדש', quantity: 12, unit: 'm2' }, { description: 'אסלה תלויה', quantity: 1, unit: 'unit' }], notes: '', discountPercent: 0 });
  const out = (items, changes) => JSON.stringify({ subject: '', questions: [], items, changes: { updates: [], deletes: [], notes: { action: 'none', text: '' }, discountPercent: null, ...changes } });
  const item = (description, evidence = '') => ({ description, evidence, quantity: 1, unit: 'unit', quantityBasis: 'implied_single', derivation: null, missing: null, catalogId: null });
  it('the LIVE case: "שנו את היחידה של אסלה תלויה לשעות" - no description change, no new "שינוי אסלה תלויה" line; the unit change is kept', () => {
    const r = parseDraftModelOutput(out([item('שינוי אסלה תלויה', 'שנו את היחידה של אסלה תלויה')],
      { updates: [{ ref: 2, description: 'שינוי אסלה תלויה', quantity: null, unit: 'hour', unitPrice: null }] }), [], 'שנו את היחידה של אסלה תלויה לשעות', QUOTE);
    expect(r.ok).toBe(true);
    expect(r.items).toEqual([]);
    expect(r.changes.updates).toEqual([{ ref: 2, description: null, quantity: null, unit: 'hour', unitPrice: null }]);
  });
  it('a description change is kept when the request asks to rename / re-describe (HE / EN)', () => {
    const he = parseDraftChanges({ updates: [{ ref: 2, description: 'אסלה תלויה גרוהה' }], deletes: [], notes: null, discountPercent: null }, QUOTE, 'תשנו את התיאור של האסלה לאסלה תלויה גרוהה');
    expect(he.updates[0].description).toBe('אסלה תלויה גרוהה');
    const heName = parseDraftChanges({ updates: [{ ref: 2, description: 'אסלה' }], deletes: [], notes: null, discountPercent: null }, QUOTE, 'תשנו את השם של השורה השנייה לאסלה');
    expect(heName.updates[0].description).toBe('אסלה');
    const en = parseDraftChanges({ updates: [{ ref: 1, description: 'New tiling' }], deletes: [], notes: null, discountPercent: null }, QUOTE, 'Rename line 1 to New tiling');
    expect(en.updates[0].description).toBe('New tiling');
  });
  it('a description change the request did not ask for is dropped', () => {
    expect(parseDraftChanges({ updates: [{ ref: 2, description: 'אסלה משופרת' }], deletes: [], notes: null, discountPercent: null }, QUOTE, 'הוסיפו הנחה של 5%').updates).toEqual([]);
  });
  it('a new line that holds an existing line is dropped; a genuinely new one is kept', () => {
    const r = parseDraftModelOutput(out([item('התקנת אסלה תלויה חדשה', 'אסלה'), item('התקנת כיור', 'התקנת כיור')]), [], 'הוסיפו התקנת כיור ואסלה', QUOTE);
    expect(r.items.map((x) => x.description)).toEqual(['התקנת כיור']);
  });
});
