// agents-room - the AI budget reservation (Codex release 4, topic 6a; unit-tested in aiBudget.test.ts; index.ts wires it).
// Owner console 2026-10-29 (typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
// החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב"); migration 20261030200000.
// Every PHYSICAL request to the AI provider (a fallback model is a request of its own) is:
//   1. built exactly here - the body sent is the body measured;
//   2. bounded: input <= the UTF-8 bytes of the whole body + an overhead (a token is at least one byte), output <= the request's own cap;
//   3. priced at its worst case in integer centi-micro-dollars, rounded UP; a model without a known tariff is never sent;
//   4. reserved in the database (agents_ai_reserve) - only an admitted request is sent;
//   5. settled once: the observed usage (also an empty / invalid answer), 0 for a provider refusal (an HTTP error), and NOTHING released
//      for an unknown outcome (no answer, a time-out, an unreadable answer, a database failure after the call).
export const RATE_VERSION = 'openai-list-2026-10';
// the list prices of lib.ts PRICES (USD per million tokens) x 100 = centi-micro-dollars per token, integers
export const RATES: Readonly<Record<string, readonly [number, number]>> = Object.freeze({ 'gpt-6-luna': [10, 50], 'gpt-4o-mini': [15, 60] });
export const INPUT_OVERHEAD_TOKENS = 1024;
export const DEFAULT_MAX_OUTPUT = 2000;
export const BUDGET_CODES = ['budget_insufficient', 'budget_blocked'] as const;
export type BudgetCode = typeof BUDGET_CODES[number];
export const isBudgetRefusal = (e: unknown) => BUDGET_CODES.includes(String((e as Error)?.message ?? '') as BudgetCode);

/** worst-case / observed cost in micro-dollars, rounded up; null = no known tariff */
export function microsOf(model: string, inputTokens: number, outputTokens: number): number | null {
  const r = RATES[model];
  if (!r) return null;
  return Math.ceil((inputTokens * r[0] + outputTokens * r[1]) / 100);
}
export const inputBound = (body: string) => new TextEncoder().encode(body).length + INPUT_OVERHEAD_TOKENS;

export function requestBody(a: { model: string; messages: unknown[]; schema: unknown; maxTokens?: number }): { body: string; maxOutput: number } {
  const legacy = a.model === 'gpt-4o-mini';
  const maxOutput = a.maxTokens ?? DEFAULT_MAX_OUTPUT;
  const body = JSON.stringify({ model: a.model, messages: a.messages, response_format: { type: 'json_schema', json_schema: a.schema },
    ...(legacy ? { max_tokens: maxOutput, temperature: 0.2 } : { max_completion_tokens: maxOutput, reasoning_effort: 'none' }) });
  return { body, maxOutput };
}

export interface BudgetDeps {
  month(): string; // the Israel month (YYYY-MM) of now
  reserve(r: { month: string; purpose: string; model: string; rateVersion: string; maxInput: number; maxOutput: number; micros: number }): Promise<{ id: string } | { refused: BudgetCode }>;
  settle(id: string, outcome: 'settled' | 'failed' | 'unknown', usage: { promptTokens: number; completionTokens: number } | null, micros: number | null): Promise<void>;
  post(body: string, timeoutMs: number): Promise<Response>; // throws on no answer / time-out
}
export type Completion = { content: string; promptTokens: number; completionTokens: number };

export async function budgetedComplete(b: BudgetDeps, a: { model: string; messages: unknown[]; schema: unknown; maxTokens?: number }): Promise<Completion> {
  const { body, maxOutput } = requestBody(a);
  const maxInput = inputBound(body);
  const worst = microsOf(a.model, maxInput, maxOutput);
  if (worst === null) throw new Error('budget_unknown_tariff');
  const purpose = String((a.schema as { name?: unknown })?.name ?? 'agents').slice(0, 60) || 'agents';
  const r = await b.reserve({ month: b.month(), purpose, model: a.model, rateVersion: RATE_VERSION, maxInput, maxOutput, micros: Math.max(1, worst) });
  if ('refused' in r) throw new Error(r.refused); // no request was made
  const settle = (outcome: 'settled' | 'failed' | 'unknown', usage: { promptTokens: number; completionTokens: number } | null) =>
    b.settle(r.id, outcome, usage, usage ? microsOf(a.model, usage.promptTokens, usage.completionTokens) : null).catch(() => undefined); // a failed settlement keeps the hold
  let res: Response;
  try { res = await b.post(body, maxOutput > 2000 ? 120000 : 60000); } catch (e) { await settle('unknown', null); throw e; }
  if (!res.ok) {
    try { await res.body?.cancel(); } catch { /* the status is enough */ }
    // a definite refusal (4xx: bad request, auth, rate limit) produced nothing = 0; a server / gateway error or a time-out status (5xx,
    // 408) may come after a billed generation = unknown, the reservation stays held
    await settle(res.status >= 400 && res.status < 500 && res.status !== 408 ? 'failed' : 'unknown', null);
    throw new Error(`ai_${res.status}`);
  }
  let data: { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
  try { data = await res.json(); } catch (e) { await settle('unknown', null); throw e; }
  const p = Number(data?.usage?.prompt_tokens ?? NaN); const q = Number(data?.usage?.completion_tokens ?? NaN);
  const known = Number.isInteger(p) && Number.isInteger(q) && p >= 0 && q >= 0;
  // an answer without its usage: the cost is not known, so the whole reservation stays held (the run reports 0 tokens)
  const usage = known ? { promptTokens: p, completionTokens: q } : { promptTokens: 0, completionTokens: 0 };
  await settle(known ? 'settled' : 'unknown', known ? usage : null);
  const c = data?.choices?.[0];
  // Codex N08: a paid answer without content still reports its usage, so the cost is counted
  if (typeof c?.message?.content !== 'string') throw Object.assign(new Error('ai_incomplete'), { usage });
  return { content: c.message.content, ...usage };
}
