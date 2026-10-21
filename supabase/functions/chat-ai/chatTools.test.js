// Owner console 2026-10-19 (task-control activeTask.smartChatTools20261019, L-17 unlocked): the smart chat's read-only data tools.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAT_TOOL_DEFS, chatCompletionsTools, responsesTools, runChatTool, runToolLoop, chatCompletionToolCalls, dailyCapAnswer, buildToolsPromptBlock, MAX_TOOL_ROUNDS, TOOLS_MODEL, CHEAP_MODEL, LEGACY_CHEAP_MODEL, isOwnDataQuestion, hasDataQualifier } from './chatTools.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ME = 'user-me';
const OTHER = 'user-other';
const TODAY = '2026-10-19';

// a tiny in-memory PostgREST look-alike: records every call and applies eq / order / limit, so the user_id filter is really exercised
function fakeDb(tables) {
  const calls = [];
  const from = (table) => {
    const state = { table, eqs: [], limit: null, ops: [] };
    const run = () => {
      let rows = (tables[table] || []).filter((r) => state.eqs.every(([c, v]) => r[c] === v));
      if (state.limit) rows = rows.slice(0, state.limit);
      return Promise.resolve({ data: rows, error: null });
    };
    const q = {
      select: (cols) => { state.ops.push(['select', cols]); return q; },
      eq: (c, v) => { state.eqs.push([c, v]); return q; },
      order: () => q,
      limit: (n) => { state.limit = n; return q; },
      then: (res, rej) => run().then(res, rej),
    };
    for (const m of ['insert', 'update', 'delete', 'upsert']) q[m] = () => { throw new Error(`mutation ${m} on ${table}`); };
    calls.push(state);
    return q;
  };
  return { db: { from }, calls };
}

const quotes = [
  { user_id: ME, quote_number: 101, project_name: 'מטבח', status: 'approved', total: 1000, currency: 'ILS', created_at: '2026-10-01T10:00:00Z', valid_until: '2026-10-30', view_count: 2, signed_at: '2026-10-02T08:00:00Z', clients: { company_name: 'נעמה כהן' }, quote_items: [{ description: 'ארון', quantity: 2, unit_price: 500, total_price: 1000 }] },
  { user_id: ME, quote_number: 102, project_name: 'Deck', status: 'sent', total: 250.5, currency: 'USD', created_at: '2026-10-10T10:00:00Z', valid_until: '2026-10-01', view_count: 0, signed_at: null, clients: { company_name: 'Noa Cohen' } },
  { user_id: ME, quote_number: 103, project_name: 'מרפסת', status: 'draft', total: 400, currency: 'ILS', created_at: '2026-10-15T10:00:00Z', valid_until: null, view_count: 0, signed_at: null, clients: { company_name: 'נעמה כהן' } },
  { user_id: OTHER, quote_number: 999, project_name: 'secret', status: 'approved', total: 99999, currency: 'ILS', created_at: '2026-10-11T10:00:00Z', clients: { company_name: 'נעמה כהן' } },
];
const ctxWith = (db) => ({ db, userId: ME, accountCurrency: 'ILS', today: TODAY });

describe('smart chat tools - definitions', () => {
  it('six strict tools, every property required, no extra properties (OpenAI strict schemas)', () => {
    expect(CHAT_TOOL_DEFS.map((t) => t.name)).toEqual(['find_quotes', 'quote_overview', 'get_quote', 'find_clients', 'find_catalog_items', 'list_tasks']);
    for (const t of CHAT_TOOL_DEFS) {
      expect(t.parameters.additionalProperties, t.name).toBe(false);
      expect([...t.parameters.required].sort(), t.name).toEqual(Object.keys(t.parameters.properties).sort());
    }
    expect(chatCompletionsTools()[0]).toMatchObject({ type: 'function', function: { name: 'find_quotes', strict: true } });
    expect(responsesTools()[0]).toMatchObject({ type: 'function', name: 'find_quotes', strict: true });
  });

  it('the cheap model is the provider replacement (the old one is its fallback); the stronger model only for the tool turn, max 3 rounds', () => {
    expect(CHEAP_MODEL).toBe('gpt-6-luna');
    expect(LEGACY_CHEAP_MODEL).toBe('gpt-4o-mini');
    expect(TOOLS_MODEL).toBe('gpt-6.1-sol');
    expect(MAX_TOOL_ROUNDS).toBe(3);
  });
});

describe('smart chat tools - read only, this account only', () => {
  it('find_quotes: only my quotes, server-made sums per currency (never mixed), formatted amounts', async () => {
    const { db, calls } = fakeDb({ quotes });
    const out = JSON.parse(await runChatTool('find_quotes', JSON.stringify({ text: null, status: 'any', created_from: null, created_to: null, limit: null }), ctxWith(db)));
    expect(calls[0].eqs).toContainEqual(['user_id', ME]);
    expect(out.matched_count).toBe(3);
    expect(out.matched_total_per_currency).toEqual({ ILS: '₪1,400.00', USD: '$250.50' });
    expect(out.quotes.map((q) => q.quote_number)).not.toContain(999);
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('find_quotes: status groups (approved / awaiting / draft / expired), client text and dates', async () => {
    const { db } = fakeDb({ quotes });
    const ask = async (a) => JSON.parse(await runChatTool('find_quotes', JSON.stringify({ text: null, status: 'any', created_from: null, created_to: null, limit: null, ...a }), ctxWith(db)));
    expect((await ask({ status: 'approved' })).quotes.map((q) => q.quote_number)).toEqual([101]);
    expect((await ask({ status: 'awaiting' })).quotes.map((q) => q.quote_number)).toEqual([102]);
    expect((await ask({ status: 'draft' })).quotes.map((q) => q.quote_number)).toEqual([103]);
    expect((await ask({ status: 'expired' })).quotes.map((q) => q.quote_number)).toEqual([102]);
    const naama = await ask({ text: 'נעמה' });
    expect(naama.quotes.map((q) => q.quote_number)).toEqual([101, 103]);
    expect(naama.matched_total_per_currency).toEqual({ ILS: '₪1,400.00' });
    expect((await ask({ created_from: '2026-10-05', created_to: '2026-10-12' })).quotes.map((q) => q.quote_number)).toEqual([102]);
    expect((await ask({ limit: 1 })).quotes).toHaveLength(1);
    expect((await ask({ limit: 500 })).quotes.length).toBeLessThanOrEqual(10);
  });

  it('get_quote: my quote with items; another account\'s number is simply not found', async () => {
    const { db } = fakeDb({ quotes });
    const mine = JSON.parse(await runChatTool('get_quote', '{"quote_number":101}', ctxWith(db)));
    expect(mine).toMatchObject({ found: true, client: 'נעמה כהן', state: 'approved', total: '₪1,000.00', item_count: 1, signed_at: '2026-10-02' });
    expect(mine.items[0]).toEqual({ description: 'ארון', quantity: 2, unit_price: '₪500.00', line_total: '₪1,000.00' });
    expect(JSON.parse(await runChatTool('get_quote', '{"quote_number":999}', ctxWith(db)))).toEqual({ found: false });
  });

  it('find_clients / find_catalog_items / list_tasks read only this account', async () => {
    const { db, calls } = fakeDb({
      quotes,
      clients: [{ id: 'c1', user_id: ME, company_name: 'נעמה כהן', email: 'n@x.test', phone: '050', client_type: 'private' }, { id: 'c2', user_id: OTHER, company_name: 'Hidden Ltd', email: 'h@x.test' }],
      services: [{ user_id: ME, name: 'התקנת חלון', price: 350 }, { user_id: OTHER, name: 'Hidden item', price: 1 }],
      tasks: [{ user_id: ME, title: 'להתקשר לנעמה', status: 'open', priority: 'high', due_date: '2026-10-18' }, { user_id: ME, title: 'מדידה', status: 'open', priority: 'normal', due_date: TODAY }, { user_id: OTHER, title: 'hidden task', status: 'open', due_date: '2026-10-01' }],
    });
    const clients = JSON.parse(await runChatTool('find_clients', '{"text":null,"limit":null}', ctxWith(db)));
    expect(clients.clients.map((c) => c.name)).toEqual(['נעמה כהן']);
    const items = JSON.parse(await runChatTool('find_catalog_items', '{"text":"חלון","limit":null}', ctxWith(db)));
    expect(items.items).toEqual([{ name: 'התקנת חלון', price: '₪350.00' }]);
    const overdue = JSON.parse(await runChatTool('list_tasks', '{"which":"overdue","limit":null}', ctxWith(db)));
    expect(overdue.tasks.map((t) => t.title)).toEqual(['להתקשר לנעמה']);
    const today = JSON.parse(await runChatTool('list_tasks', '{"which":"today","limit":null}', ctxWith(db)));
    expect(today.tasks.map((t) => t.title)).toEqual(['מדידה']);
    for (const c of calls) expect(c.eqs, c.table).toContainEqual(['user_id', ME]);
  });

  it('unknown tool / broken arguments / a failing read -> a closed error, never a throw', async () => {
    const { db } = fakeDb({ quotes });
    expect(JSON.parse(await runChatTool('delete_quote', '{}', ctxWith(db)))).toEqual({ error: 'unknown_tool' });
    expect(JSON.parse(await runChatTool('find_quotes', '{bad', ctxWith(db)))).toEqual({ error: 'bad_arguments' });
    const broken = { from: () => { throw new Error('boom'); } };
    expect(JSON.parse(await runChatTool('find_quotes', '{}', ctxWith(broken)))).toEqual({ error: 'unavailable' });
  });

  it('the tools module never writes: no insert / update / delete / upsert / rpc / storage / auth.admin', () => {
    const src = fs.readFileSync(path.join(here, 'chatTools.ts'), 'utf8');
    for (const re of [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.upsert\(/, /\.rpc\(/, /\.storage\./, /auth\.admin/]) expect(src).not.toMatch(re);
  });
});

describe('smart chat tools - the stronger model turn', () => {
  const okJson = (body) => ({ ok: true, json: async () => body });
  const message = (text) => ({ output: [{ type: 'reasoning', id: 'r1', encrypted_content: 'x' }, { type: 'message', content: [{ type: 'output_text', text }] }] });

  it('runs the first calls, hands the results to the stronger model, returns its answer', async () => {
    const { db } = fakeDb({ quotes });
    const sent = [];
    const fetchImpl = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return okJson(message('יש לך 3 הצעות.')); };
    const out = await runToolLoop({ fetchImpl, apiKey: 'k', instructions: 'SYS', messages: [{ role: 'user', content: 'כמה הצעות יש לנעמה?' }], firstCalls: [{ id: 'call_1', name: 'find_quotes', arguments: '{"text":"נעמה","status":"any","created_from":null,"created_to":null,"limit":null}' }], ctx: ctxWith(db) });
    expect(out).toEqual({ answer: 'יש לך 3 הצעות.', toolsUsed: ['find_quotes'] });
    expect(sent[0].url).toBe('https://api.openai.com/v1/responses');
    expect(sent[0].body).toMatchObject({ model: 'gpt-6.1-sol', instructions: 'SYS', store: false, tool_choice: 'auto' });
    const output = sent[0].body.input.find((i) => i.type === 'function_call_output');
    expect(output.call_id).toBe('call_1');
    expect(JSON.parse(output.output).matched_count).toBe(2);
  });

  it('a further tool round keeps the model\'s own items and answers each call; the last request forbids tools', async () => {
    const { db } = fakeDb({ quotes });
    const sent = [];
    const fetchImpl = async (url, init) => {
      const body = JSON.parse(init.body); sent.push(body);
      return okJson({ output: [{ type: 'function_call', call_id: `c${sent.length}`, name: 'get_quote', arguments: '{"quote_number":101}' }] });
    };
    const out = await runToolLoop({ fetchImpl, apiKey: 'k', instructions: 'S', messages: [{ role: 'user', content: 'q' }], firstCalls: [{ id: 'c0', name: 'find_quotes', arguments: '{}' }], ctx: ctxWith(db) });
    expect(sent).toHaveLength(MAX_TOOL_ROUNDS);
    expect(sent.map((b) => b.tool_choice)).toEqual(['auto', 'auto', 'none']);
    expect(sent[1].input.filter((i) => i.type === 'function_call_output').map((i) => i.call_id)).toEqual(['c0', 'c1']);
    expect(out).toBeNull(); // still no text after the forced last request -> the caller falls back
  });

  it('a provider error, a network failure or an empty answer returns null (index.ts falls back to the plain answer)', async () => {
    const { db } = fakeDb({ quotes });
    const base = { apiKey: 'k', instructions: 'S', messages: [{ role: 'user', content: 'q' }], firstCalls: [{ id: 'c0', name: 'find_quotes', arguments: '{}' }], ctx: ctxWith(db) };
    expect(await runToolLoop({ ...base, fetchImpl: async () => ({ ok: false, json: async () => ({}) }) })).toBeNull();
    expect(await runToolLoop({ ...base, fetchImpl: async () => { throw new Error('net'); } })).toBeNull();
    expect(await runToolLoop({ ...base, fetchImpl: async () => okJson({ output: [] }) })).toBeNull();
  });

  it('reads the cheap model\'s tool calls (none = a plain answer)', () => {
    expect(chatCompletionToolCalls({ choices: [{ message: { content: 'hi' } }] })).toEqual([]);
    expect(chatCompletionToolCalls({ choices: [{ message: { tool_calls: [{ id: 'a', type: 'function', function: { name: 'find_quotes', arguments: '{}' } }] } }] }))
      .toEqual([{ id: 'a', name: 'find_quotes', arguments: '{}' }]);
  });
});

describe('smart chat - wiring in index.ts', () => {
  const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
  it('the daily allowance is claimed with the caller\'s own JWT before any model call; over the cap = a fixed answer', () => {
    const claimAt = src.indexOf("rpc('chat_ai_claim_question')");
    expect(claimAt).toBeGreaterThan(0);
    expect(claimAt).toBeLessThan(src.indexOf("fetch('https://api.openai.com/v1/chat/completions'"));
    expect(src).toMatch(/const userJwtClient = verifiedUserId && isDashboard/);
    expect(dailyCapAnswer(true, 30)).toContain('30');
    expect(dailyCapAnswer(false, 30)).toMatch(/limit of 30/);
  });
  it('tools are offered only to a verified dashboard user, after every deterministic truth gate', () => {
    expect(src).toMatch(/const toolCtx: ToolContext \| null = userJwtClient && verifiedUserId && accountContext && !reviewSnapshot/);
    expect(src.indexOf('const toolCtx')).toBeGreaterThan(src.indexOf('resolveCapabilityTruthResponse('));
    expect(src.indexOf('const toolCtx')).toBeGreaterThan(src.indexOf('deterministicHelpAnswer('));
  });
  it('the tools prompt block forbids invented numbers and currency mixing, and fences tool data', () => {
    const block = buildToolsPromptBlock(true, '2026-10-19');
    expect(block).toMatch(/Today is 2026-10-19/);
    expect(block).toMatch(/Never guess or invent/);
    expect(block).toMatch(/never add amounts of different currencies/);
    expect(block).toMatch(/untrusted DATA/);
    expect(block).toMatch(/Answer in Hebrew/);
  });
});

// Owner LIVE check 2026-10-19: "כמה הצעות יש לי ללקוח EDEN DAVID" got the account-wide fixed statistics and "אילו משימות באיחור
// יש לי" got the "tasks exist in TEKANGO" capability answer - both must reach the data tools.
describe('smart chat - own-data routing (Owner LIVE check 2026-10-19)', () => {
  it('the Owner\'s four LIVE questions are own-data questions', () => {
    for (const q of ['מה ההצעה האחרונה ששלחתי ולמי', 'כמה הצעות יש לי ללקוח EDEN DAVID', 'אילו משימות באיחור יש לי', 'כמה עולה אצלי מסך 24 אינץ',
      'which tasks are overdue', 'how many quotes do I have for client Noa Cohen', 'what is my latest quote']) expect(isOwnDataQuestion(q), q).toBe(true);
  });
  it('product / how-to questions stay with the fixed capability answers', () => {
    for (const q of ['האם יש משימות במערכת?', 'אפשר ליצור משימה מהצעה?', 'איך יוצרים הצעה?', 'האם המערכת תומכת בלקוחות עסקיים?', 'Can I create tasks?', 'does TEKANGO support catalog items?', 'how do I add a client?', 'איזה מסלולים יש לכם'])
      expect(isOwnDataQuestion(q), q).toBe(false);
  });
  it('a client / period / state narrows the question; the plain "how many quotes do I have" keeps the fixed statistics', () => {
    for (const q of ['כמה הצעות יש לי ללקוח EDEN DAVID', 'כמה הצעות שלחתי לנעמה', 'כמה הצעות נשלחו החודש', 'כמה הצעות פג תוקפן', 'how many quotes do I have for Noa', 'quotes this month'])
      expect(hasDataQualifier(q), q).toBe(true);
    for (const q of ['כמה הצעות יש לי', 'כמה הצעות יש לי ומה הסכום הכולל שלהן?', 'מה הסכום הכולל של ההצעות שאושרו?', 'How many quotes do I have, and what is their total value?'])
      expect(hasDataQualifier(q), q).toBe(false);
  });
  it('quote_overview: the overview groups for one client, per currency, only my quotes', async () => {
    const { db, calls } = fakeDb({ quotes });
    const out = JSON.parse(await runChatTool('quote_overview', JSON.stringify({ text: 'נעמה', created_from: null, created_to: null }), ctxWith(db)));
    expect(calls[0].eqs).toContainEqual(['user_id', ME]);
    expect(out.all).toEqual({ count: 2, total_per_currency: { ILS: '₪1,400.00' } });
    expect(out.approved.count).toBe(1);
    expect(out.drafts.count).toBe(1);
    expect(out.awaiting_signature.count).toBe(0);
    expect(out.clients_matched).toEqual(['נעמה כהן']);
    const all = JSON.parse(await runChatTool('quote_overview', JSON.stringify({ text: null, created_from: null, created_to: null }), ctxWith(db)));
    expect(all.all.total_per_currency).toEqual({ ILS: '₪1,400.00', USD: '$250.50' });
    expect(all.expired.count).toBe(1);
  });
  it('index.ts: own-data questions skip the fixed statistics (only with a qualifier) and the capability answer, and force a tool call', () => {
    const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
    expect(src).toMatch(/classifyQuoteStatsIntent\(lastUserMessage\) && !\(ownDataQuestion && hasDataQualifier\(lastUserMessage\)\)/);
    expect(src).toMatch(/const capabilityId = ownDataQuestion \? null : classifyCapabilityIntent\(lastUserMessage\);/);
    expect(src).toMatch(/else if \(classifyBroadCapabilityQuestionSignal\(lastUserMessage\)\)/); // the broad guard still covers every message
    expect(src).toMatch(/tool_choice: ownDataQuestion \? 'required' : 'auto'/);
    // the payment / invoicing / subscription / market gates still run before - untouched by the own-data routing
    for (const gate of ['classifyInvoicingIntent(lastUserMessage)', 'resolveSubscriptionTruthResponse(', 'classifyAccountMarketIntent(lastUserMessage)'])
      expect(src.indexOf(gate), gate).toBeGreaterThan(0);
    expect(src.indexOf('resolveSubscriptionTruthResponse(')).toBeLessThan(src.indexOf('const capabilityId = ownDataQuestion'));
  });
  it('index.ts: the new cheap model falls back to the old one on any failure', () => {
    const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
    expect(src).toMatch(/const callCheapWithFallback = async/);
    expect(src).toMatch(/return await callCheapModel\(withTools, LEGACY_CHEAP_MODEL\)/);
    expect(src).toMatch(/reasoning_effort: 'none'/);
    expect(src.match(/callCheapWithFallback\(/g)).toHaveLength(2);
  });
});

// Owner LIVE check 2026-10-19 (second round): "כמה הצעות יש לי ללקוח EDEN DAVID" was then caught by the plan-allowance answer.
describe('smart chat - a client question is not a plan question (Owner LIVE check 2026-10-19, round 2)', () => {
  it('the client question is own data with a qualifier and no plan words; plan questions keep the subscription truth', async () => {
    const { mentionsPlan } = await import('./quoteStatsTruth.ts');
    const q = 'כמה הצעות יש לי ללקוח EDEN DAVID';
    expect(isOwnDataQuestion(q) && hasDataQualifier(q) && !mentionsPlan(q)).toBe(true);
    for (const plan of ['כמה הצעות נשארו לי במסלול', 'כמה הצעות חינם נשארו לי החודש', 'how many quotes do I have left this month', 'what is my plan quota'])
      expect(mentionsPlan(plan), plan).toBe(true);
  });
  it('index.ts: the subscription truth line is unchanged and skipped only for that case', () => {
    const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
    expect(src).toMatch(/const subscription = resolveSubscriptionTruthResponse\(lastUserMessage, isHebrew, verifiedUserId && accountContext \? accountContext\.account : null\);/);
    expect(src).toMatch(/const dataNotPlan = ownDataQuestion && hasDataQualifier\(lastUserMessage\) && !mentionsPlan\(lastUserMessage\);\n {4}if \(subscription && !dataNotPlan\) \{/);
  });
  it('an empty result is followed by the closest useful fact, and answers name the concrete records', () => {
    const block = buildToolsPromptBlock(true, '2026-10-19');
    expect(block).toMatch(/closest useful fact/);
    expect(block).toMatch(/name the client, the quote number, the amount and the date/);
  });
});
