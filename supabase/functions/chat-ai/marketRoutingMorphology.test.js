// ACCOUNT MARKET / CURRENCY ROUTING - MICRO-CLOSURE property-class tests (Hebrew attached prefixes + English plural identity nouns).
// Class coverage, not phrase coverage: nouns x prefixes x frames, singular / plural nouns x market words x frames, plus negative controls
// that the new rules must NOT over-route, plus fresh unseen paraphrases, plus an anti-patch source audit.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyAccountMarketIntent, classifyAccountMarketIntentKind } from './marketTruth.ts';
import { classifyPaymentIntent, paymentTruthApplies } from './paymentTruth.ts';
import { classifyInvoicingIntent, invoicingTruthApplies } from './invoicingTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { FINAL_MATRIX_DEFINITIONS } from '../../../src/data/productTruthFinalMatrixAcceptance.js';
import {
  ENGLISH_PLURAL_IDENTITY_CLASS, FRAME_ALLOWED_KINDS, HEBREW_PREFIX_CLASS, MARKET_ROUTING_MATRIX, MARKET_ROUTING_NEGATIVE_CONTROLS, MICRO_CODEX_GAPS,
  MICRO_NEGATIVE_CONTROLS, MICRO_UNSEEN_FIRST_PASS, MICRO_UNSEEN_PARAPHRASES, SELF_BREAK_TEST,
} from '../../../src/data/productTruthMarketRoutingMatrix.js';

const here = dirname(fileURLToPath(import.meta.url));
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_x, k) => vars[k]);

function hebrewPrefixCases() {
  const cases = [];
  const { nouns, prefixes, templates, marketTemplates, marketPrefixes } = HEBREW_PREFIX_CLASS;
  for (const noun of nouns) for (const prefix of prefixes) for (const [family, tpls] of Object.entries(templates)) {
    for (const tpl of tpls) cases.push({ family, noun, prefix, prompt: fill(tpl, { X: `${prefix}${noun}` }) });
  }
  for (const prefix of marketPrefixes) for (const tpl of marketTemplates) cases.push({ family: 'market', noun: 'חשבון', prefix, prompt: fill(tpl, { L: prefix }) });
  return cases;
}
function englishPluralCases() {
  const cases = [];
  const { nouns, markets, adverbs, templates } = ENGLISH_PLURAL_IDENTITY_CLASS;
  for (const n of nouns) for (const m of markets) for (const [family, tpls] of Object.entries(templates)) for (const tpl of tpls) {
    for (const a of (tpl.includes('{a}') ? adverbs : [''])) cases.push({ family, noun: n, market: m, prompt: fill(tpl, { a, m, n }).replace(/\s+/g, ' ') });
  }
  return cases;
}

describe('the two Codex gaps', () => {
  it.each(MICRO_CODEX_GAPS.map((g) => [g.prompt, g]))('routes: %s', (_p, g) => {
    expect(classifyAccountMarketIntent(g.prompt)).toBe(true);
    expect(FRAME_ALLOWED_KINDS[g.family]).toContain(classifyAccountMarketIntentKind(g.prompt));
  });
});

describe('Hebrew attached-prefix class (nouns x prefixes x frames)', () => {
  const cases = hebrewPrefixCases();
  it('the generator covers every dimension', () => {
    expect(new Set(cases.map((c) => c.noun)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(cases.map((c) => c.prefix)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(cases.map((c) => c.family))).toEqual(new Set(['possibility', 'desire', 'instruction', 'market']));
    expect(cases.length).toBeGreaterThanOrEqual(150);
    // the four required prefixes are all present
    for (const p of ['ב', 'ל', 'מה', 'כ']) expect(HEBREW_PREFIX_CLASS.prefixes).toContain(p);
  });
  it('EVERY noun x prefix x frame combination routes (0 free-form leaks)', () => {
    const leaks = cases.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt);
    expect(leaks).toEqual([]);
  });
  it('each frame normalizes to a kind of that frame (possibility -> query; desire / instruction -> override)', () => {
    const bad = cases.filter((c) => (c.family === 'possibility' ? classifyAccountMarketIntentKind(c.prompt) !== 'ACCOUNT_CURRENCY_QUERY' : false)).map((c) => c.prompt);
    expect(bad).toEqual([]);
    for (const c of cases.filter((x) => x.family === 'desire' || x.family === 'instruction')) {
      expect(['ACCOUNT_CURRENCY_OVERRIDE_REQUEST', 'ACCOUNT_MARKET_OVERRIDE_REQUEST'], c.prompt).toContain(classifyAccountMarketIntentKind(c.prompt));
    }
  });
  it('the prefix rule is a morphology rule, not a phrase table: an UNLISTED noun from the same lexicon with every prefix still routes', () => {
    for (const noun of ['מנוי', 'פרופיל']) for (const prefix of HEBREW_PREFIX_CLASS.prefixes) {
      expect(classifyAccountMarketIntent(`אפשרי לראות ${prefix}${noun} EUR?`), `${prefix}${noun}`).toBe(true);
    }
  });
});

describe('English plural identity class (singular / plural nouns x market words x frames)', () => {
  const cases = englishPluralCases();
  it('the generator covers every dimension', () => {
    expect(new Set(cases.map((c) => c.noun))).toEqual(new Set(['customer', 'customers', 'client', 'clients', 'user', 'users']));
    expect(new Set(cases.map((c) => c.family))).toEqual(new Set(['assertion', 'simulation', 'instruction']));
    expect(new Set(cases.map((c) => c.market)).size).toBe(5);
    expect(cases.length).toBeGreaterThanOrEqual(250);
  });
  it('EVERY noun-form x market x frame combination routes (0 free-form leaks)', () => {
    const leaks = cases.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt);
    expect(leaks).toEqual([]);
  });
  it('assertions normalize to an identity assertion or override; simulations / instructions to an override', () => {
    for (const c of cases) expect(FRAME_ALLOWED_KINDS[c.family === 'instruction' ? 'instruction' : c.family], c.prompt).toContain(classifyAccountMarketIntentKind(c.prompt));
  });
});

describe('negative controls for the new rules - no over-routing', () => {
  it.each(MICRO_NEGATIVE_CONTROLS.map((p) => [p]))('does not route: %s', (p) => {
    expect(classifyAccountMarketIntent(p)).toBe(false);
  });
  it('the earlier negative controls and the self break-test negatives still hold', () => {
    for (const p of [...MARKET_ROUTING_NEGATIVE_CONTROLS, ...SELF_BREAK_TEST.negatives]) expect(classifyAccountMarketIntent(p), p).toBe(false);
  });
  it('a Hebrew word that merely contains an anchor after a prefix-like letter is not an anchor (calculator, invoice)', () => {
    for (const p of ['אפשר להשתמש במחשבון עם דולר?', 'אפשר להוציא חשבונית בדולר?']) expect(classifyAccountMarketIntent(p), p).toBe(false);
  });
});

describe('fresh unseen paraphrases (written after the implementation, not used to design it)', () => {
  it('there are at least 10 Hebrew and 10 English', () => {
    expect(MICRO_UNSEEN_PARAPHRASES.he.length).toBeGreaterThanOrEqual(10);
    expect(MICRO_UNSEEN_PARAPHRASES.en.length).toBeGreaterThanOrEqual(10);
  });
  it.each([...MICRO_UNSEEN_PARAPHRASES.he, ...MICRO_UNSEEN_PARAPHRASES.en].map((p) => [p]))('routes: %s', (p) => {
    expect(classifyAccountMarketIntent(p)).toBe(true);
  });
  it('the honest first-pass record is consistent (misses are part of the unseen set and now route)', () => {
    const all = [...MICRO_UNSEEN_PARAPHRASES.he, ...MICRO_UNSEEN_PARAPHRASES.en];
    expect(MICRO_UNSEEN_FIRST_PASS.total).toBe(all.length);
    expect(MICRO_UNSEEN_FIRST_PASS.routed + MICRO_UNSEEN_FIRST_PASS.missed.length).toBe(MICRO_UNSEEN_FIRST_PASS.total);
    for (const m of MICRO_UNSEEN_FIRST_PASS.missed) { expect(all).toContain(m); expect(classifyAccountMarketIntent(m)).toBe(true); }
  });
});

describe('no regression: the locked matrix, routing order and the 74 predeclared prompts', () => {
  it('the original locked matrix and the self break-test positives still all route', () => {
    for (const r of MARKET_ROUTING_MATRIX) expect(classifyAccountMarketIntent(r.prompt), r.prompt).toBe(true);
    for (const p of SELF_BREAK_TEST.positives) expect(classifyAccountMarketIntent(p), p).toBe(true);
  });
  it('payment / invoicing do not steal any new-class prompt', () => {
    const payment = paymentTruthApplies(AI_FACTS.billing);
    const invoicing = invoicingTruthApplies(AI_FACTS.invoicing);
    const prompts = [...hebrewPrefixCases(), ...englishPluralCases()].map((c) => c.prompt).concat(MICRO_CODEX_GAPS.map((g) => g.prompt), MICRO_UNSEEN_PARAPHRASES.he, MICRO_UNSEEN_PARAPHRASES.en);
    for (const p of prompts) {
      expect(payment && classifyPaymentIntent(p), `payment claims: ${p}`).toBeFalsy();
      expect(invoicing && classifyInvoicingIntent(p), `invoicing claims: ${p}`).toBeFalsy();
    }
  });
  it('across ALL 74 predeclared acceptance prompts the market route still claims ONLY the market-forgery security cell', () => {
    const claimed = [];
    for (const def of Object.values(FINAL_MATRIX_DEFINITIONS)) for (const slot of def.slots) if (classifyAccountMarketIntent(slot.prompt)) claimed.push(slot.slot);
    expect(claimed).toEqual(['SEC:market_forgery']);
  });
});

describe('anti-patch audit - the generalization is morphology, not the two Codex strings', () => {
  const source = ['marketTruth.ts', 'marketIntentGrammar.ts'].map((f) => readFileSync(join(here, f), 'utf-8')).join(' ').toLowerCase();
  it('marketTruth.ts contains none of the literal micro-closure prompts', () => {
    const all = [...MICRO_CODEX_GAPS.map((g) => g.prompt), ...MICRO_UNSEEN_PARAPHRASES.he, ...MICRO_UNSEEN_PARAPHRASES.en, ...MICRO_NEGATIVE_CONTROLS];
    for (const p of all) expect(source.includes(p.toLowerCase()), p).toBe(false);
  });
  it('the Hebrew nouns are listed ONCE, bare, and read through the shared clitic (prefix) analysis (no article-bearing duplicates)', () => {
    const raw = readFileSync(join(here, 'marketIntentGrammar.ts'), 'utf-8').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join(' ');
    for (const articled of ['הדשבורד', 'המערכת', 'האפליקציה', 'החשבון']) expect(raw.includes(articled), articled).toBe(false);
    expect(raw).toMatch(/function analyzeHe\(/);
  });
  it('the English plural forms come from one lexicon lookup (singular entries + plural stripping), not per-pattern regexes', () => {
    const raw = readFileSync(join(here, 'marketIntentGrammar.ts'), 'utf-8').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join(' ');
    expect(raw).toMatch(/function lookupEn\(/);
    expect(raw.includes('customers'), 'plural nouns are derived, never listed').toBe(false);
  });
});
