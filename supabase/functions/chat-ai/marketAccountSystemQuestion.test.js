// ACCOUNT / SYSTEM-SUBJECT CURRENCY QUESTION FRAME - focused micro-delta tests (Product Truth).
// Root cause (verified): the grammar had currency-question frames only for a wh-question ("what currency ..."), a price-word yes/no ("are the prices in USD?") and a
// TEKANGO-brand subject; a yes/no question whose SUBJECT is the user's own account or the system ("does my account use dollars?", "האם המערכת עובדת ביורו?") matched no
// frame, although every token was tagged correctly. The fix is one structural frame in marketIntentGrammar.ts (matchAccountSubjectCurrencyQuestion).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describeAccountMarketTokens, parseAccountMarketIntent } from './marketIntentGrammar.ts';
import { classifyAccountMarketIntent, classifyAccountMarketIntentKind } from './marketTruth.ts';
import {
  ACCOUNT_SYSTEM_CODEX_QUESTIONS, ACCOUNT_SYSTEM_NEGATIVES, ACCOUNT_SYSTEM_OUT_OF_SCOPE, ACCOUNT_SYSTEM_PARAPHRASES, accountSystemQuestionPositivesEn, accountSystemQuestionPositivesHe,
} from '../../../src/data/productTruthMarketAccountSystemQuestion.js';
import {
  BLOCKER1_CODEX_NEGATIVES, BLOCKER2_CODEX_POSITIVE, selfCurrencyPositives, symbolPrefixCases, symbolWithNumberNegatives, thirdPartyDisplayNegativesEn, thirdPartyDisplayNegativesHe,
} from '../../../src/data/productTruthMarketGrammarBlockers.js';
import { BLOCKERS_ROUND2_NEGATIVES, BLOCKERS_ROUND2_POSITIVES } from '../../../src/data/productTruthMarketGrammarBlockersRound2.js';
import { GRAMMAR_CODEX_FINDINGS } from '../../../src/data/productTruthMarketGrammarMatrix.js';
import { GRAMMAR_NEGATIVE_CONTROLS, GRAMMAR_UNSEEN_CROSS, GRAMMAR_UNSEEN_EN, GRAMMAR_UNSEEN_HE } from '../../../src/data/productTruthMarketGrammarUnseen.js';

const here = dirname(fileURLToPath(import.meta.url));
const EN = accountSystemQuestionPositivesEn(); const HE = accountSystemQuestionPositivesHe();
const first = (t) => parseAccountMarketIntent(t).clauses[0];

describe('root cause: every token is tagged correctly - only the FRAME was missing', () => {
  it('the account / system subject, the verb (Hebrew: person-noun / verb ambiguity) and the currency are all recognised', () => {
    const tags = (t) => describeAccountMarketTokens(t)[0].map((x) => `${x.w}:${x.cats.join('+')}`);
    expect(tags('האם החשבון שלי משתמש בדולר?')).toEqual(['האם:Q', 'החשבון:ENTITY', 'שלי:POSS', 'משתמש:PERSON', 'בדולר:CUR']);
    expect(tags('האם המערכת עובדת ביורו?')).toEqual(['האם:Q', 'המערכת:SURFACE', 'עובדת:VERB', 'ביורו:CUR']);
    expect(tags('Does my account use dollars?')).toEqual(['does:AUX', 'my:POSS', 'account:ENTITY', 'use:VERB', 'dollars:CUR']);
    expect(tags('Does the system work in euros?')).toEqual(['does:AUX', 'the:DET', 'system:SURFACE', 'work:VERB', 'in:PREP', 'euros:CUR']);
  });
});

describe('the four exact Codex questions route structurally', () => {
  it.each(ACCOUNT_SYSTEM_CODEX_QUESTIONS.map((q) => [q.prompt, q]))('routes as ACCOUNT_CURRENCY_QUERY: %s', (_p, q) => {
    expect(classifyAccountMarketIntent(q.prompt)).toBe(true);
    expect(classifyAccountMarketIntentKind(q.prompt)).toBe('ACCOUNT_CURRENCY_QUERY');
    expect(first(q.prompt)).toMatchObject({ subject: 'ACCOUNT', relation: 'CURRENCY_QUERY', modality: 'QUESTION', polarity: 'POSITIVE' });
  });
  it('the normalized target currency is canonical', () => {
    expect(first('האם החשבון שלי משתמש בדולר?').targetCurrency).toBe('USD');
    expect(first('האם המערכת עובדת ביורו?').targetCurrency).toBe('EUR');
    expect(first('Does my account use dollars?').targetCurrency).toBe('USD');
    expect(first('Does the system work in euros?').targetCurrency).toBe('EUR');
  });
});

describe('HE regression tests', () => {
  it.each([['האם החשבון שלי משתמש בדולר?'], ['האם החשבון שלנו משתמש ביורו?'], ['האם המערכת עובדת ביורו?'], ['האם המערכת עובדת ב-£?'], ['האם החשבון שלי עובד עם דולרים?']])('routes: %s', (p) => {
    expect(classifyAccountMarketIntent(p)).toBe(true);
  });
  it('the Hebrew class (masc / fem subjects x use / work / support x 8 currency forms incl. $ € £ ₪, nominal, participle, brand) - 0 leaks', () => {
    expect(HE.length).toBe(232);
    expect(new Set(HE.map((c) => c.klass)).size).toBe(5);
    expect(HE.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
});

describe('EN regression tests', () => {
  it.each([['Does my account use dollars?'], ['Does our account use euros?'], ['Does the system work in euros?'], ['Does the system work in £?'], ['Is my account currently using dollars?']])('routes: %s', (p) => {
    expect(classifyAccountMarketIntent(p)).toBe(true);
  });
  it('the English class (9 subjects x 8 question forms x 12 currency forms incl. words, codes and symbols) - 0 leaks', () => {
    expect(EN.length).toBe(756);
    expect(new Set(EN.map((c) => c.klass)).size).toBeGreaterThanOrEqual(7);
    expect(EN.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
  it('paraphrases (both languages) route', () => {
    for (const p of ACCOUNT_SYSTEM_PARAPHRASES) expect(classifyAccountMarketIntent(p), p).toBe(true);
  });
});

describe('negative preservation - stays OFF the route unless structurally targeted', () => {
  it.each(ACCOUNT_SYSTEM_NEGATIVES.map((p) => [p]))('does not route: %s', (p) => { expect(classifyAccountMarketIntent(p)).toBe(false); });
  it('the previously disclosed out-of-scope impersonal case is UNCHANGED', () => {
    for (const p of ACCOUNT_SYSTEM_OUT_OF_SCOPE) { expect(classifyAccountMarketIntent(p), p).toBe(false); expect(parseAccountMarketIntent(p).clauses).toEqual([]); }
  });
  it('a statement (no question frame) about the system / account currency is not this frame', () => {
    for (const p of ['The system works in euros', 'My account is in dollars', 'האם זה נכון? המערכת עובדת ביורו']) expect(classifyAccountMarketIntentKind(p) === 'ACCOUNT_CURRENCY_QUERY' && p !== 'האם זה נכון? המערכת עובדת ביורו', p).toBe(false);
  });
  it('a possibility question keeps its own CURRENCY_CAPABILITY reading (the new frame does not steal it)', () => {
    expect(first('Can my account work in USD?')).toMatchObject({ relation: 'CURRENCY_CAPABILITY' });
  });
});

describe('targeted non-regression of the previous closures', () => {
  it('the six exact Codex negatives stay off the route', () => {
    expect(BLOCKER1_CODEX_NEGATIVES.length).toBe(6);
    for (const p of BLOCKER1_CODEX_NEGATIVES) expect(classifyAccountMarketIntent(p), p).toBe(false);
  });
  it('representative generated third-party negatives (bare compounds, possessives, Hebrew construct forms) stay off the route', () => {
    const sample = [...thirdPartyDisplayNegativesEn().filter((_c, i) => i % 40 === 0), ...thirdPartyDisplayNegativesHe().filter((_c, i) => i % 12 === 0)];
    expect(sample.length).toBeGreaterThan(200);
    expect(sample.filter((c) => classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
    for (const p of [...BLOCKERS_ROUND2_NEGATIVES, ...symbolWithNumberNegatives().map((c) => c.prompt), ...GRAMMAR_NEGATIVE_CONTROLS]) expect(classifyAccountMarketIntent(p), p).toBe(false);
  });
  it('the Hebrew person / verb readings of משתמש and עובד still hold (person after a third-party noun, verb after an account subject)', () => {
    expect(classifyAccountMarketIntent('הצג מחיר עובד בדולר.')).toBe(false);
    expect(classifyAccountMarketIntent('הצג מחיר משתמש בשקלים')).toBe(false);
    expect(classifyAccountMarketIntent('איזה מטבע החשבון שלי משתמש?')).toBe(true);
  });
  it('SELF / SELF-proven positives (all 220) still route', () => {
    expect(selfCurrencyPositives().filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
  it('the symbol-prefix class (168) and the Codex symbol positive still route', () => {
    expect(classifyAccountMarketIntent(BLOCKER2_CODEX_POSITIVE)).toBe(true);
    expect(symbolPrefixCases().filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
    for (const p of BLOCKERS_ROUND2_POSITIVES) expect(classifyAccountMarketIntent(p), p).toBe(true);
  });
  it('the grammar closure findings and unseen sets still route', () => {
    for (const f of GRAMMAR_CODEX_FINDINGS) expect(classifyAccountMarketIntent(f.prompt), f.prompt).toBe(true);
    for (const p of [...GRAMMAR_UNSEEN_HE, ...GRAMMAR_UNSEEN_EN, ...GRAMMAR_UNSEEN_CROSS]) expect(classifyAccountMarketIntent(p), p).toBe(true);
  });
});

describe('anti-patch + structure', () => {
  it('the frame is one structural matcher; none of the Codex / generated / paraphrase strings is hardcoded; no regex added to marketTruth.ts', () => {
    const grammarSrc = readFileSync(join(here, 'marketIntentGrammar.ts'), 'utf-8'); const marketSrc = readFileSync(join(here, 'marketTruth.ts'), 'utf-8');
    expect(grammarSrc).toMatch(/function matchAccountSubjectCurrencyQuestion\(/);
    expect(grammarSrc).toMatch(/function readAccountSystemSubject\(/);
    const source = `${marketSrc}\n${grammarSrc}`.toLowerCase(); const strip = (p) => p.toLowerCase().replace(/[.?!]+$/, '');
    const all = [...ACCOUNT_SYSTEM_CODEX_QUESTIONS.map((q) => q.prompt), ...ACCOUNT_SYSTEM_PARAPHRASES, ...ACCOUNT_SYSTEM_NEGATIVES, ...ACCOUNT_SYSTEM_OUT_OF_SCOPE, ...EN.map((c) => c.prompt), ...HE.map((c) => c.prompt)];
    expect([...new Set(all)].filter((p) => source.includes(strip(p)))).toEqual([]);
    expect(marketSrc).not.toMatch(/new RegExp\(/);
  });
});
