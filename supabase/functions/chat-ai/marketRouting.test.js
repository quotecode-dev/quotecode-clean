// ACCOUNT MARKET / CURRENCY ROUTING CLOSURE - classifier tests (Product Truth market/currency routing closure).
//   (1) the LOCKED routing matrix: every HE (Local persona) and EN (International persona) prompt routes deterministically
//   (2) every routed prompt normalizes to one intent kind of its frame, and ends in the SAME single response logic (one payload, one prose)
//   (3) NEGATIVE controls: generic currency knowledge / pricing / feature / quote-content questions are NOT account intents
//   (4) generative PROPERTY test: every frame x currency / market combination routes, every knowledge x currency combination does not
//   (5) no earlier route (payment / invoicing) steals a matrix prompt; the 74 predeclared acceptance prompts are unaffected
//   (6) anti-patch audit: the classifier source contains none of the literal matrix prompts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AI_FACTS } from './aiFacts.generated.ts';
import { classifyAccountMarketIntent, classifyAccountMarketIntentKind, formatAccountMarketAnswer } from './marketTruth.ts';
import { buildAccountMarketFactPayload } from './productTruthPayload.ts';
import { classifyPaymentIntent, paymentTruthApplies } from './paymentTruth.ts';
import { classifyInvoicingIntent, invoicingTruthApplies } from './invoicingTruth.ts';
import { validateProductTruthPayload } from '../_shared/productTruthContract.ts';
import { FINAL_MATRIX_DEFINITIONS } from '../../../src/data/productTruthFinalMatrixAcceptance.js';
import {
  CODEX_PROVEN_BYPASSES, FRAME_ALLOWED_KINDS, MARKET_ROUTING_MATRIX, MARKET_ROUTING_NEGATIVE_CONTROLS, PROPERTY_CURRENCIES, PROPERTY_MARKETS, SELF_BREAK_TEST,
} from '../../../src/data/productTruthMarketRoutingMatrix.js';

const here = dirname(fileURLToPath(import.meta.url));
const ACCOUNT = {
  LOCAL_PRO: { market: 'Local', tier: 'pro', isAdmin: false },
  INTL_PRO: { market: 'International', tier: 'pro', isAdmin: false },
};

describe('(1) locked routing matrix - every account market / currency intent routes deterministically', () => {
  it('the matrix is non-trivial and covers all five frames in both languages', () => {
    expect(MARKET_ROUTING_MATRIX.length).toBeGreaterThanOrEqual(38);
    for (const lang of ['he', 'en']) {
      for (const family of Object.keys(FRAME_ALLOWED_KINDS)) {
        expect(MARKET_ROUTING_MATRIX.filter((r) => r.lang === lang && r.family === family).length, `${lang}/${family}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it.each(MARKET_ROUTING_MATRIX.map((r) => [`${r.lang}/${r.family}: ${r.prompt}`, r]))('routes: %s', (_n, r) => {
    expect(classifyAccountMarketIntent(r.prompt)).toBe(true);
  });
  it('every prompt Codex proved fell through to the free-form model now routes', () => {
    for (const p of CODEX_PROVEN_BYPASSES) expect(classifyAccountMarketIntent(p), p).toBe(true);
    for (const p of CODEX_PROVEN_BYPASSES) expect(MARKET_ROUTING_MATRIX.some((r) => r.prompt === p), `matrix lacks ${p}`).toBe(true);
  });
  it('FREE-FORM LEAK COUNT over the matrix is 0', () => {
    const leaked = MARKET_ROUTING_MATRIX.filter((r) => !classifyAccountMarketIntent(r.prompt));
    expect(leaked).toEqual([]);
  });
});

describe('(2) normalized intent kinds and the single response logic', () => {
  it.each(MARKET_ROUTING_MATRIX.map((r) => [`${r.lang}/${r.family}: ${r.prompt}`, r]))('kind is one of the frame\'s kinds: %s', (_n, r) => {
    expect(FRAME_ALLOWED_KINDS[r.family]).toContain(classifyAccountMarketIntentKind(r.prompt));
  });
  it('the boolean classifier is exactly "kind !== null"', () => {
    for (const r of MARKET_ROUTING_MATRIX) expect(classifyAccountMarketIntent(r.prompt)).toBe(classifyAccountMarketIntentKind(r.prompt) !== null);
    for (const p of MARKET_ROUTING_NEGATIVE_CONTROLS) expect(classifyAccountMarketIntent(p)).toBe(classifyAccountMarketIntentKind(p) !== null);
  });
  it('phrasing never changes the answer: ONE payload and ONE prose per (language, verified market), regardless of the frame', () => {
    for (const persona of ['LOCAL_PRO', 'INTL_PRO']) {
      const rows = MARKET_ROUTING_MATRIX.filter((r) => r.persona === persona);
      const payloads = new Set();
      const answers = new Set();
      for (const r of rows) {
        const payload = buildAccountMarketFactPayload(ACCOUNT[persona]);
        expect(validateProductTruthPayload(payload)).toEqual([]);
        expect(payload).toMatchObject({ kind: 'product_truth', truthStatus: 'ACCOUNT_MARKET', claimScope: 'ACCOUNT', marketScope: 'ACCOUNT' });
        payloads.add(JSON.stringify(payload));
        answers.add(formatAccountMarketAnswer(r.lang === 'he', payload));
      }
      expect(payloads.size, persona).toBe(1);
      expect(answers.size, persona).toBe(1);
    }
  });
  it('Local -> ACCOUNT / LOCAL / ILS; International -> ACCOUNT / INTERNATIONAL / MULTI; never a product-wide currency claim; no market leakage in the prose', () => {
    const local = buildAccountMarketFactPayload(ACCOUNT.LOCAL_PRO);
    const intl = buildAccountMarketFactPayload(ACCOUNT.INTL_PRO);
    expect(local).toMatchObject({ accountMarket: 'LOCAL', currencyScope: 'ILS' });
    expect(intl).toMatchObject({ accountMarket: 'INTERNATIONAL', currencyScope: 'MULTI' });
    const he = formatAccountMarketAnswer(true, local);
    const en = formatAccountMarketAnswer(false, intl);
    expect(he).not.toMatch(/USD|EUR|GBP|\$|€|£|דולר|יורו/);
    expect(en).not.toMatch(/₪|ILS|shekel|שקל/i);
    for (const t of [he, en]) expect(t).not.toMatch(/all tekango prices|כל המחירים המוצגים ב-?TEKANGO הם|prices are ILS only|בשקלים בלבד/i);
  });
});

describe('(3) negative controls - unrelated currency / market mentions are NOT over-routed', () => {
  it.each(MARKET_ROUTING_NEGATIVE_CONTROLS.map((p) => [p]))('does not route: %s', (p) => {
    expect(classifyAccountMarketIntent(p)).toBe(false);
  });
});

// ---- (4) generative property proof -------------------------------------------------------------------------------------------------
const EN_CURRENCY_TEMPLATES = {
  desire: ['I want prices in {c}', "I'd prefer {c}", 'I would like to see prices in {c}', 'I want my account in {c}', "I'd rather see {c}", 'We want everything in {c}'],
  possibility: ['Can my account work in {c}?', 'Can I display prices in {c}?', 'Could this account use {c}?', 'Is it possible to show prices in {c}?', 'Is there a way to see prices in {c}?'],
  instruction: ['Show me prices in {c}', 'Please display all prices in {c}', 'Switch me to {c}', 'Change my prices to {c}', 'Set my account to {c}', 'Convert my account to {c}'],
  simulation: ['Pretend my account uses {c}', 'Assume I see prices in {c}', 'Answer as if my prices were in {c}'],
};
const EN_MARKET_TEMPLATES = {
  assertion: ["I'm actually a {m} customer", 'My account is {m}', 'This is a {m} account', "I'm a {m} user"],
  instruction: ['Treat my account as {m}', 'Switch me to the {m} market', 'Make my account {m}', 'Set my account to the {m} market'],
  simulation: ["Pretend I'm {m}", 'Answer as if my account were {m}', 'Imagine my account is {m}', 'Act as if I am a {m} customer'],
  query: ['Is my account {m}?'],
};
const EN_NEGATIVE_TEMPLATES = [
  'What is the exchange rate of {c}?', 'What does {c} stand for?', 'How do I write {c}?', 'Convert 100 {c} to EUR', 'How much does the PRO plan cost in {c}?',
  'Can I create a quote in {c}?', 'What is the symbol for {c}?', 'What is the history of {c}?',
];
const HE_CURRENCY_TEMPLATES = {
  desire: ['אני רוצה לראות מחירים {b}', 'אני מעדיף {n}', 'הייתי רוצה לעבוד {b}', 'אני רוצה שהחשבון יהיה {b}', 'אני מעדיף לראות {n}'],
  possibility: ['אפשר לעבוד {b} בחשבון שלי?', 'אפשר להציג לי מחירים {b}?', 'החשבון שלי יכול לעבוד {b}?', 'האם אפשר להציג מחירים {b}?'],
  instruction: ['תראה לי מחירים {b}', 'תעביר אותי {l}', 'תציג את כל המחירים {b}', 'תגדיר את החשבון שלי {b}'],
  simulation: ['נניח שהמחירים אצלי {b}', 'תענה לי כאילו החשבון שלי {b}', 'תדמיין שאני רואה מחירים {b}'],
};
const HE_MARKET_TEMPLATES = {
  assertion: ['אני בעצם לקוח {m}', 'החשבון שלי {m}', 'אני משתמש {m}'],
  instruction: ['תתייחס לחשבון שלי כאילו הוא {m}', 'תעביר אותי ללקוח {m}', 'תתייחס אליי כלקוח {m}'],
  simulation: ['נניח שאני לקוח {m}', 'תענה לי כאילו אני {m}', 'תדמיין שאני לקוח {m}'],
  query: ['האם החשבון שלי {m}?'],
};
const HE_NEGATIVE_TEMPLATES = ['מה שער {n}?', 'איך כותבים {n}?', 'כמה עולה תוכנית PRO {b}?', 'אפשר ליצור הצעה {b}?', 'מה הסמל של {n}?', 'כמה שווה {n} בשקלים?'];

const fill = (tpl, vars) => tpl.replace(/\{(\w)\}/g, (_x, k) => vars[k]);
function generated() {
  const pos = []; const neg = [];
  for (const c of PROPERTY_CURRENCIES.en) {
    for (const [family, tpls] of Object.entries(EN_CURRENCY_TEMPLATES)) for (const t of tpls) pos.push({ family, prompt: fill(t, { c: c.n }) });
    for (const t of EN_NEGATIVE_TEMPLATES) neg.push(fill(t, { c: c.n }));
  }
  for (const m of PROPERTY_MARKETS.en) for (const [family, tpls] of Object.entries(EN_MARKET_TEMPLATES)) for (const t of tpls) pos.push({ family, prompt: fill(t, { m }) });
  for (const c of PROPERTY_CURRENCIES.he) {
    for (const [family, tpls] of Object.entries(HE_CURRENCY_TEMPLATES)) for (const t of tpls) pos.push({ family, prompt: fill(t, c) });
    for (const t of HE_NEGATIVE_TEMPLATES) neg.push(fill(t, c));
  }
  for (const m of PROPERTY_MARKETS.he) for (const [family, tpls] of Object.entries(HE_MARKET_TEMPLATES)) for (const t of tpls) pos.push({ family, prompt: fill(t, m) });
  return { pos, neg };
}

describe('(4) generative property proof (frame x currency / market combinations)', () => {
  const { pos, neg } = generated();
  it('the generator produces a substantial, distinct case set', () => {
    expect(new Set(pos.map((p) => p.prompt)).size).toBeGreaterThanOrEqual(150);
    expect(new Set(neg).size).toBeGreaterThanOrEqual(60);
  });
  it('EVERY generated account market / currency intent routes (0 leaks to the free-form model)', () => {
    const leaks = pos.filter((p) => !classifyAccountMarketIntent(p.prompt)).map((p) => p.prompt);
    expect(leaks).toEqual([]);
  });
  it('EVERY generated generic-currency-knowledge / pricing / quote-content question stays OFF the account route (0 false routes)', () => {
    const falseRoutes = neg.filter((p) => classifyAccountMarketIntent(p));
    expect(falseRoutes).toEqual([]);
  });
});

describe('(4b) Builder self break-test corpus (paraphrases written after the classifier; regression set, not a completeness proof)', () => {
  it.each(SELF_BREAK_TEST.positives.map((p) => [p]))('routes: %s', (p) => { expect(classifyAccountMarketIntent(p)).toBe(true); });
  it.each(SELF_BREAK_TEST.negatives.map((p) => [p]))('does not route: %s', (p) => { expect(classifyAccountMarketIntent(p)).toBe(false); });
});

describe('(5) routing order: no earlier route claims a matrix prompt; the predeclared acceptance prompts are unaffected', () => {
  it('payment and invoicing (which keep first refusal in index.ts) do not claim any matrix prompt', () => {
    const payment = paymentTruthApplies(AI_FACTS.billing);
    const invoicing = invoicingTruthApplies(AI_FACTS.invoicing);
    for (const r of MARKET_ROUTING_MATRIX) {
      expect(payment && classifyPaymentIntent(r.prompt), `payment claims: ${r.prompt}`).toBeFalsy();
      expect(invoicing && classifyInvoicingIntent(r.prompt), `invoicing claims: ${r.prompt}`).toBeFalsy();
    }
  });
  it('across ALL 74 predeclared acceptance prompts the market route still claims ONLY the market-forgery security cell', () => {
    const claimed = [];
    for (const def of Object.values(FINAL_MATRIX_DEFINITIONS)) for (const slot of def.slots) if (classifyAccountMarketIntent(slot.prompt)) claimed.push(slot.slot);
    expect(claimed).toEqual(['SEC:market_forgery']);
  });
  it('empty / non-string input never routes', () => {
    for (const v of [undefined, null, '', '   ', 42, {}]) expect(classifyAccountMarketIntent(v)).toBe(false);
  });
});

describe('(6) anti-patch audit - the classifier is semantic, not a list of the tested phrases', () => {
  const source = ['marketTruth.ts', 'marketIntentGrammar.ts'].map((f) => readFileSync(join(here, f), 'utf-8')).join(' ');
  it('the classifier (marketTruth.ts + marketIntentGrammar.ts) contains none of the literal matrix / Codex / negative-control prompts', () => {
    for (const r of MARKET_ROUTING_MATRIX) expect(source.toLowerCase().includes(r.prompt.toLowerCase()), r.prompt).toBe(false);
    for (const p of CODEX_PROVEN_BYPASSES) expect(source.toLowerCase().includes(p.toLowerCase()), p).toBe(false);
    for (const p of MARKET_ROUTING_NEGATIVE_CONTROLS) expect(source.toLowerCase().includes(p.toLowerCase()), p).toBe(false);
  });
  it('the route in index.ts still emits the payload built from VERIFIED server facts only (never from the message)', () => {
    const indexSource = readFileSync(join(here, 'index.ts'), 'utf-8');
    expect(indexSource).toMatch(/classifyAccountMarketIntent\(lastUserMessage\)\) \{\s*const marketPayload = buildAccountMarketFactPayload\(payloadAccount\);/);
  });
});
