// INTENT GRAMMAR - the TWO remaining blockers (Product Truth): tests.
//   BLOCKER 1 - CRM / third-party over-routing: a currency-display request that mentions a person noun must PROVE self / owned-account targeting (positive proof), so
//               bare compounds ("customer prices", "client totals", "user fees", "supplier costs"), possessives ("customer's prices") and Hebrew construct forms
//               ("מחיר לקוח", "מחירי לקוח", "תמחור לקוח") stay OFF the ACCOUNT_MARKET route - while SELF-proven identities and account requests keep routing;
//   BLOCKER 2 - Hebrew prefix + currency symbol: "ב-$", "ב-€", "ב-£", "ב-₪" (and attached / stacked / other prefix forms) normalize and route.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describeAccountMarketTokens, normalizeAccountMarketText, parseAccountMarketIntent } from './marketIntentGrammar.ts';
import { classifyAccountMarketIntent, classifyAccountMarketIntentKind } from './marketTruth.ts';
import {
  BLOCKER1_CODEX_NEGATIVES, BLOCKER2_CODEX_POSITIVE, selfCurrencyPositives, SYMBOL_PREFIXES, SYMBOLS, symbolPrefixCases, symbolWithNumberNegatives,
  thirdPartyDisplayNegativesEn, thirdPartyDisplayNegativesHe,
} from '../../../src/data/productTruthMarketGrammarBlockers.js';
import { BLOCKERS_ROUND2_KNOWN_BOUNDARY, BLOCKERS_ROUND2_NEGATIVES, BLOCKERS_ROUND2_POSITIVES } from '../../../src/data/productTruthMarketGrammarBlockersRound2.js';
import { GRAMMAR_NEGATIVE_CONTROLS, GRAMMAR_UNSEEN_CROSS, GRAMMAR_UNSEEN_EN, GRAMMAR_UNSEEN_HE } from '../../../src/data/productTruthMarketGrammarUnseen.js';
import { GRAMMAR_CODEX_FINDINGS } from '../../../src/data/productTruthMarketGrammarMatrix.js';

const here = dirname(fileURLToPath(import.meta.url));
const intent = (t) => parseAccountMarketIntent(t).clauses;
const EN = thirdPartyDisplayNegativesEn(); const HE = thirdPartyDisplayNegativesHe();
const SELF = selfCurrencyPositives(); const SYM = symbolPrefixCases(); const SYMNUM = symbolWithNumberNegatives();

describe('BLOCKER 1 - third-party (CRM) compounds are never an account currency intent', () => {
  it.each(BLOCKER1_CODEX_NEGATIVES.map((p) => [p]))('the exact Codex negative stays off ACCOUNT_MARKET: %s', (p) => {
    expect(classifyAccountMarketIntentKind(p)).toBe(null);
    expect(intent(p)).toEqual([]);
  });
  it('a possessive person noun is read as the person noun (genitive), not as an unknown word that hides the third party', () => {
    const t = describeAccountMarketTokens("Show a customer's prices in GBP")[0].find((x) => x.w === "customer's");
    expect(t.cats).toEqual(['PERSON']);
  });
  it('the property class sizes: English x (8 persons x 6 display nouns x 4 verbs x 6 currencies x 7 compound forms), Hebrew x (3 verbs x 6 display x 5 persons x 4 currencies x 4 forms)', () => {
    expect(EN.length).toBe(8 * 6 * 4 * 6 * 7); expect(HE.length).toBe(3 * 6 * 5 * 4 * 4);
    expect(new Set(EN.map((c) => c.klass)).size).toBe(7); expect(new Set(HE.map((c) => c.klass)).size).toBe(4);
    expect(new Set(EN.map((c) => c.prompt)).size).toBe(EN.length); expect(new Set(HE.map((c) => c.prompt)).size).toBe(HE.length);
  });
  it('English: EVERY person x display noun x verb x currency x compound-form case stays OFF the route (0 over-routed)', () => {
    expect(EN.filter((c) => classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
  it('Hebrew: EVERY verb x construct / definite display noun x person x currency x form case stays OFF the route (0 over-routed)', () => {
    expect(HE.filter((c) => classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
  it('the structural rule, not a list: an UNLISTED display noun next to a person noun is still third-party (the rule keys on the person noun without self proof)', () => {
    for (const p of ['Show customer balances in dollars', 'Show customer prices, in dollars', 'Customer prices in USD, please', 'Please show customer prices in USD', 'Can you show customer prices in dollars?']) expect(classifyAccountMarketIntent(p), p).toBe(false);
  });
  it('SELF / owned-account currency requests keep routing, in both languages', () => {
    expect(SELF.length).toBeGreaterThanOrEqual(200);
    expect(SELF.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
  it('a person noun that is the PREDICATE of a SELF identity is positive proof: it does not block the currency clause in the same message (with or without a separator)', () => {
    for (const p of ['We are international customers, show prices in dollars.', 'We really are overseas clients—show us the totals in EUR.', 'I am an international user who wants dollars.',
      'אנחנו לקוחות בינלאומיים, תציג לי מחירים בדולר', 'אני משתמש זר ואני רוצה לראות מחירים ביורו']) expect(classifyAccountMarketIntent(p), p).toBe(true);
  });
  it('proof must be SELF: an object "me" or a desire verb between the pronoun and the person noun is NOT proof', () => {
    for (const p of ['Show me customer prices in dollars', 'I want customer prices in USD', 'We show customer prices in euros', 'Show me my customers prices in USD']) expect(classifyAccountMarketIntent(p), p).toBe(false);
  });
  it('the Hebrew participles "משתמש" / "עובד" after an account / brand subject are VERBS, not persons (no over-blocking)', () => {
    expect(classifyAccountMarketIntent('איזה מטבע החשבון שלי משתמש?')).toBe(true);
    // a word that is both a noun and a verb keeps BOTH readings in the lexicon (the verb reading never replaces the person entry)
    const work = describeAccountMarketTokens('TEKANGO עובד')[0][1];
    expect(work.cats).toContain('PERSON');
    expect(work.cats).toContain('VERB');
  });
  it('the fresh adversarial round: 23 structural variants stay OFF the route', () => {
    expect(BLOCKERS_ROUND2_NEGATIVES.length).toBe(23);
    expect(BLOCKERS_ROUND2_NEGATIVES.filter((p) => classifyAccountMarketIntent(p))).toEqual([]);
  });
});

describe('BLOCKER 2 - Hebrew prefix + currency symbol normalization', () => {
  it('the exact Codex positive routes as an account currency preference', () => {
    expect(classifyAccountMarketIntent(BLOCKER2_CODEX_POSITIVE)).toBe(true);
    expect(intent(BLOCKER2_CODEX_POSITIVE)[0]).toMatchObject({ relation: 'CURRENCY_PREFERENCE', targetCurrency: 'GBP', modality: 'DESIRE', subject: 'SELF' });
  });
  it('normalization: Hebrew prefix + hyphen + symbol and prefix attached to a symbol are split; Latin-letter behaviour is unchanged', () => {
    for (const s of SYMBOLS) {
      expect(normalizeAccountMarketText(`תמחור ב-${s}`)).toBe(`תמחור ב ${s}`);
      expect(normalizeAccountMarketText(`תמחור ב${s}`)).toBe(`תמחור ב ${s}`);
      expect(normalizeAccountMarketText(`תמחור ל־${s}`)).toBe(`תמחור ל ${s}`);
    }
    expect(normalizeAccountMarketText('המחירים ב-TEKANGO')).toBe('המחירים ב tekango');
    expect(normalizeAccountMarketText('non-israeli')).toBe('non-israeli');
    expect(normalizeAccountMarketText('e-mail $5')).toBe('e-mail $5');
  });
  it('tokenization: the split prefix is a preposition and the symbol is a currency with its canonical value', () => {
    const toks = describeAccountMarketTokens('תמחור ב-£')[0].map((t) => `${t.w}:${t.cats.join('+')}`);
    expect(toks).toEqual(['תמחור:SURFACE', 'ב:PREP', '£:CUR']);
    const value = (s) => intent(`בא לי לראות תמחור ב-${s}`)[0].targetCurrency;
    expect([value('$'), value('€'), value('£'), value('₪')]).toEqual(['USD', 'EUR', 'GBP', 'ILS']);
  });
  it('the property class: 6 frames x 7 prefix forms x 4 symbols, all route (0 leaks)', () => {
    expect(SYM.length).toBe(6 * SYMBOL_PREFIXES.length * SYMBOLS.length);
    expect(SYM.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
  it('a symbol followed by a NUMBER is a price / amount, not a currency preference - it stays off the route', () => {
    expect(SYMNUM.filter((c) => classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
  it('English symbols and the fresh adversarial positives route; the known out-of-scope impersonal boundary is recorded and unchanged', () => {
    for (const p of ['Show me prices in £', 'I want everything in €', 'Show me prices in $']) expect(classifyAccountMarketIntent(p), p).toBe(true);
    for (const p of BLOCKERS_ROUND2_POSITIVES) expect(classifyAccountMarketIntent(p), p).toBe(true);
    for (const p of BLOCKERS_ROUND2_KNOWN_BOUNDARY) expect(classifyAccountMarketIntent(p), p).toBe(false);
  });
});

describe('no regression + anti-patch', () => {
  it('the six Codex findings of the previous review, the unseen sets and the negative controls of the grammar closure all still hold', () => {
    for (const f of GRAMMAR_CODEX_FINDINGS) expect(classifyAccountMarketIntent(f.prompt), f.prompt).toBe(true);
    for (const p of [...GRAMMAR_UNSEEN_HE, ...GRAMMAR_UNSEEN_EN, ...GRAMMAR_UNSEEN_CROSS]) expect(classifyAccountMarketIntent(p), p).toBe(true);
    expect(GRAMMAR_NEGATIVE_CONTROLS.filter((p) => classifyAccountMarketIntent(p))).toEqual([]);
  });
  it('none of the Codex / generated-class / adversarial strings is hardcoded in the classifier source; no phrase list, no regex added to marketTruth.ts', () => {
    const marketSrc = readFileSync(join(here, 'marketTruth.ts'), 'utf-8'); const grammarSrc = readFileSync(join(here, 'marketIntentGrammar.ts'), 'utf-8');
    const source = `${marketSrc}\n${grammarSrc}`.toLowerCase();
    const strip = (p) => p.toLowerCase().replace(/[.?!]+$/, '');
    const all = [...BLOCKER1_CODEX_NEGATIVES, BLOCKER2_CODEX_POSITIVE, ...BLOCKERS_ROUND2_NEGATIVES, ...BLOCKERS_ROUND2_POSITIVES, ...BLOCKERS_ROUND2_KNOWN_BOUNDARY, ...EN.slice(0, 500).map((c) => c.prompt), ...HE.map((c) => c.prompt), ...SYM.map((c) => c.prompt)];
    expect([...new Set(all)].filter((p) => source.includes(strip(p)))).toEqual([]);
    expect(marketSrc.split(/\r?\n/).filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/**')).join('\n')).not.toMatch(/new RegExp\(|\.test\(/);
    expect(grammarSrc).toMatch(/function selfProvenPerson\(/);
  });
});
