// Codex release 4 (Owner 2026-10-29, typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
// החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב"), topic 6a: every AI request is reserved before it and settled once after it.
import { describe, it, expect, vi } from 'vitest';
import { budgetedComplete, microsOf, inputBound, requestBody, isBudgetRefusal, RATES, INPUT_OVERHEAD_TOKENS, type BudgetDeps } from './aiBudget.ts';
import { PRICES } from './lib.ts';

const req = { model: 'gpt-6-luna', messages: [{ role: 'user', content: 'שלום עולם' }], schema: { name: 'manager_weekly', strict: true, schema: {} }, maxTokens: 2000 };
const answer = (usage: Record<string, unknown> | null, content: unknown = '{"ok":true}') => new Response(JSON.stringify({ choices: [{ message: { content } }], ...(usage ? { usage } : {}) }), { status: 200 });
function budget(post: BudgetDeps['post'], reserve?: BudgetDeps['reserve']) {
  const b = {
    month: () => '2026-11',
    reserve: vi.fn(reserve ?? (async () => ({ id: 'att-1' }))),
    settle: vi.fn(async () => undefined),
    post: vi.fn(post),
  };
  return b;
}

describe('the AI budget reservation (Codex release 4, topic 6a)', () => {
  it('the tariff is the list price table, in integers, rounded UP; an unknown model is never priced', () => {
    for (const [m, [a, b]] of Object.entries(PRICES)) expect(RATES[m]).toEqual([Math.round(a * 100), Math.round(b * 100)]);
    expect(microsOf('gpt-6-luna', 1, 0)).toBe(1); // 0.1 micro-dollar -> 1
    expect(microsOf('gpt-6-luna', 1000, 2000)).toBe(1100); // 100 + 1000
    expect(microsOf('gpt-4o-mini', 3, 3)).toBe(3); // 0.45 + 1.8 = 2.25 -> 3
    expect(microsOf('gpt-unknown', 1, 1)).toBeNull();
    expect(inputBound('אב')).toBe(4 + INPUT_OVERHEAD_TOKENS); // UTF-8 bytes, not characters
  });

  it('the body measured is the body sent; the worst case is reserved before the request and the usage is settled after it', async () => {
    const b = budget(async () => answer({ prompt_tokens: 120, completion_tokens: 40 }));
    const r = await budgetedComplete(b, req);
    expect(r).toEqual({ content: '{"ok":true}', promptTokens: 120, completionTokens: 40 });
    const { body } = requestBody(req);
    expect(b.post.mock.calls[0][0]).toBe(body);
    expect(b.reserve).toHaveBeenCalledWith({ month: '2026-11', purpose: 'manager_weekly', model: 'gpt-6-luna', rateVersion: expect.any(String),
      maxInput: inputBound(body), maxOutput: 2000, micros: microsOf('gpt-6-luna', inputBound(body), 2000) });
    expect(b.reserve.mock.invocationCallOrder[0]).toBeLessThan(b.post.mock.invocationCallOrder[0]);
    expect(b.settle).toHaveBeenCalledTimes(1);
    expect(b.settle).toHaveBeenCalledWith('att-1', 'settled', { promptTokens: 120, completionTokens: 40 }, microsOf('gpt-6-luna', 120, 40));
    expect(JSON.parse(body)).toMatchObject({ max_completion_tokens: 2000, reasoning_effort: 'none' }); // all output (reasoning included) is bounded
    expect(JSON.parse(requestBody({ ...req, model: 'gpt-4o-mini', maxTokens: 6000 }).body)).toMatchObject({ max_tokens: 6000 });
  });

  it('a refusal makes no request; an unknown tariff makes no reservation and no request', async () => {
    for (const code of ['budget_insufficient', 'budget_blocked'] as const) {
      const b = budget(async () => answer({ prompt_tokens: 1, completion_tokens: 1 }), async () => ({ refused: code }));
      await expect(budgetedComplete(b, req)).rejects.toThrow(code);
      expect(b.post).not.toHaveBeenCalled();
      expect(b.settle).not.toHaveBeenCalled();
      expect(isBudgetRefusal(new Error(code))).toBe(true);
    }
    const b = budget(async () => answer(null));
    await expect(budgetedComplete(b, { ...req, model: 'gpt-unknown' })).rejects.toThrow('budget_unknown_tariff');
    expect(b.reserve).not.toHaveBeenCalled();
    expect(b.post).not.toHaveBeenCalled();
  });

  it('no answer / a time-out / an unreadable answer / an answer without usage keep the whole reservation (unknown), never free', async () => {
    const b1 = budget(async () => { throw new Error('aborted'); });
    await expect(budgetedComplete(b1, req)).rejects.toThrow('aborted');
    expect(b1.settle).toHaveBeenCalledWith('att-1', 'unknown', null, null);
    const b2 = budget(async () => new Response('not json', { status: 200 }));
    await expect(budgetedComplete(b2, req)).rejects.toThrow();
    expect(b2.settle).toHaveBeenCalledWith('att-1', 'unknown', null, null);
    const b3 = budget(async () => answer(null));
    expect((await budgetedComplete(b3, req)).content).toBe('{"ok":true}');
    expect(b3.settle).toHaveBeenCalledWith('att-1', 'unknown', null, null);
  });

  it('a definite provider refusal (4xx) settles at 0; a server / gateway error or 408 stays held; an answer without content settles its usage (Codex N08)', async () => {
    for (const status of [400, 401, 429]) {
      const b = budget(async () => new Response('{}', { status }));
      await expect(budgetedComplete(b, req)).rejects.toThrow(`ai_${status}`);
      expect(b.settle).toHaveBeenCalledWith('att-1', 'failed', null, null);
    }
    for (const status of [408, 500, 502, 504]) {
      const b = budget(async () => new Response('{}', { status }));
      await expect(budgetedComplete(b, req)).rejects.toThrow(`ai_${status}`);
      expect(b.settle).toHaveBeenCalledWith('att-1', 'unknown', null, null);
    }
    const b2 = budget(async () => answer({ prompt_tokens: 50, completion_tokens: 7 }, null));
    expect(b2.settle).not.toHaveBeenCalled();
    const e = await budgetedComplete(b2, req).catch((x) => x);
    expect(e.message).toBe('ai_incomplete');
    expect(e.usage).toEqual({ promptTokens: 50, completionTokens: 7 });
    expect(b2.settle).toHaveBeenCalledWith('att-1', 'settled', { promptTokens: 50, completionTokens: 7 }, microsOf('gpt-6-luna', 50, 7));
  });

  it('a failed settlement (database) keeps the hold and still returns the paid answer', async () => {
    const b = budget(async () => answer({ prompt_tokens: 1, completion_tokens: 1 }));
    b.settle.mockRejectedValueOnce(new Error('database'));
    expect((await budgetedComplete(b, req)).content).toBe('{"ok":true}');
  });
});
