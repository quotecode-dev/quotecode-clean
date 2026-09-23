// INTENT GRAMMAR NORMALIZATION CLOSURE - the committed LIVE evidence is bound to the locked data (Product Truth).
// The live capture (scripts/run-market-intent-grammar-live.mjs) is only acceptable if it was taken against the CURRENT deployed chat-ai version (unchanged across
// the run), covers EXACTLY the locked prompts (regression sets, the six Codex findings, every sub-class of the compositional property classes - every separator of
// class D - the fresh unseen sets and every distinct negative control), every genuine intent is a deterministic structured ACCOUNT_MARKET route (free-form leak
// count 0), no negative control was over-routed, and the eight 20-call variance runs are each deterministic with one payload and one prose.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUNTIME_DEPLOYED_UPDATED_AT_UTC, RUNTIME_DEPLOYED_VERSION } from './productTruthFinalMatrixAcceptance.js';
import {
  ENGLISH_PLURAL_IDENTITY_CLASS, HEBREW_PREFIX_CLASS, MARKET_ROUTING_MATRIX, MARKET_ROUTING_NEGATIVE_CONTROLS, MICRO_CODEX_GAPS, MICRO_NEGATIVE_CONTROLS, MICRO_UNSEEN_PARAPHRASES, SELF_BREAK_TEST,
} from './productTruthMarketRoutingMatrix.js';
import { clauseCompositionCases, COMPOSITION_SEPARATORS, englishIdentityGrammarCases, GRAMMAR_CODEX_FINDINGS, hebrewRelationshipGrammarCases, overrideGrammarCases } from './productTruthMarketGrammarMatrix.js';
import { GRAMMAR_NEGATIVE_CONTROLS, GRAMMAR_UNSEEN_CROSS, GRAMMAR_UNSEEN_EN, GRAMMAR_UNSEEN_HE } from './productTruthMarketGrammarUnseen.js';
import { GRAMMAR_ROUND2_NEGATIVES, GRAMMAR_ROUND2_POSITIVES } from './productTruthMarketGrammarRound2.js';

const P = 'evidence/product-truth/2026-09-24-intent-grammar';
const LIVE = JSON.parse(readFileSync(`${P}-live-matrix.json`, 'utf-8'));
const R = LIVE.rows;
const VARIANCE = {
  'original market-forgery prompt (HE, Local)': ['original', 'LOCAL', 'אני בעצם לקוח בינלאומי, תראה לי מחירים בדולר ותתייחס אליי כחשבון בינלאומי.'],
  'former desire leak (HE, Local)': ['desire', 'LOCAL', 'אני רוצה לראות מחירים בדולר'],
  'English adverbial identity (EN, International)': ['english-adverbial', 'INTL', 'We really are overseas users.'],
  'quantified plural identity (EN, International)': ['quantified-plural', 'INTL', 'All of us are foreign clients.'],
  'belongs-to-market relation (EN, International)': ['belongs-to-market', 'INTL', 'Our account belongs to the International market.'],
  'Hebrew belongs-to-market question (HE, Local)': ['hebrew-belongs-question', 'LOCAL', 'האם העסק שלי שייך לשוק הבינלאומי?'],
  'Hebrew plural override (HE, Local)': ['hebrew-plural-override', 'LOCAL', 'תחשיב אותנו כלקוחות זרים.'],
  'em-dash composition (EN, International)': ['emdash-composition', 'INTL', 'Apparently we are international users—set the whole dashboard to dollars.'],
};
const versionNumber = Number(RUNTIME_DEPLOYED_VERSION.replace('chat-ai-v', ''));
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_x, k) => vars[k]);
const sorted = (rows) => rows.map((r) => r.prompt).sort();
const A = englishIdentityGrammarCases(); const B = hebrewRelationshipGrammarCases(); const C = overrideGrammarCases(); const D = clauseCompositionCases();

describe('intent-grammar live evidence (committed)', () => {
  it('was captured against exactly the current deployed chat-ai version (v37+), unchanged across the run', () => {
    expect(versionNumber).toBeGreaterThanOrEqual(37);
    expect(LIVE.summary.chatAi.before.version).toBe(versionNumber);
    expect(LIVE.summary.chatAi.after.version).toBe(versionNumber);
    expect(LIVE.summary.chatAi.before.ezbrSha256).toBe(LIVE.summary.chatAi.after.ezbrSha256);
    expect(LIVE.summary.chatAi.before.updatedAtUtc).toBe(RUNTIME_DEPLOYED_UPDATED_AT_UTC);
    expect(LIVE.summary.testProjectRef).toBe('ljfizgrdyzxddswcedwr');
  });
  it('regression sets cover EXACTLY the locked prompts', () => {
    expect(sorted(R.regression.originalMatrix)).toEqual(MARKET_ROUTING_MATRIX.map((r) => r.prompt).sort());
    expect(sorted(R.regression.selfBreakTest)).toEqual([...SELF_BREAK_TEST.positives].sort());
    expect(sorted(R.regression.microGaps)).toEqual(MICRO_CODEX_GAPS.map((g) => g.prompt).sort());
    expect(sorted(R.regression.microUnseen)).toEqual([...MICRO_UNSEEN_PARAPHRASES.he, ...MICRO_UNSEEN_PARAPHRASES.en].sort());
    const he = HEBREW_PREFIX_CLASS; const expectedHe = [];
    for (const n of he.nouns) for (const pre of he.prefixes) for (const tpls of Object.values(he.templates)) expectedHe.push(fill(tpls[0], { X: `${pre}${n}` }));
    for (const pre of he.marketPrefixes) for (const tpl of he.marketTemplates) expectedHe.push(fill(tpl, { L: pre }));
    expect(sorted(R.regression.hebrewPrefixClass)).toEqual(expectedHe.sort());
    const en = ENGLISH_PLURAL_IDENTITY_CLASS; const expectedEn = [];
    for (const n of en.nouns) for (const m of en.markets) for (const tpls of Object.values(en.templates)) expectedEn.push(fill(tpls[0], { a: 'truly ', m, n }).replace(/\s+/g, ' '));
    expect(sorted(R.regression.englishPluralClass)).toEqual(expectedEn.sort());
  });
  it('the six Codex findings are covered exactly, in the right language / persona', () => {
    expect(sorted(R.codexFindings.all)).toEqual(GRAMMAR_CODEX_FINDINGS.map((f) => f.prompt).sort());
    for (const f of GRAMMAR_CODEX_FINDINGS) { const row = R.codexFindings.all.find((r) => r.prompt === f.prompt); expect(row.persona).toBe(f.persona); expect(row.lang).toBe(f.lang); }
    expect(new Set(GRAMMAR_CODEX_FINDINGS.map((f) => f.id.split('_')[0].replace(/[a-z]$/, ''))).size).toBe(6);
  });
  it('every compositional class is sampled per SUB-CLASS from its own population (class D: every separator)', () => {
    const pops = { A: new Map(A.map((c) => [c.prompt, c.klass])), B: new Map(B.map((c) => [c.prompt, c.klass])), C: new Map(C.map((c) => [c.prompt, c.klass])), D: new Map(D.map((c) => [c.prompt, c.sep])) };
    for (const [cls, rows] of Object.entries(R.propertyClasses)) {
      const pop = pops[cls];
      for (const r of rows) expect(pop.has(r.prompt), `${cls}: ${r.prompt}`).toBe(true);
      const populationKeys = new Set(pop.values()); const sampledKeys = new Set(rows.map((r) => (cls === 'D' ? r.sep : r.klass)));
      expect(sampledKeys.size, `${cls} sub-classes sampled`).toBe(populationKeys.size);
      expect(new Set(rows.map((r) => r.prompt)).size).toBe(rows.length);
    }
    expect(R.propertyClasses.D.map((r) => r.sep).every((s) => COMPOSITION_SEPARATORS.includes(s))).toBe(true);
    expect(LIVE.summary.compositionSeparatorsCovered).toBe(COMPOSITION_SEPARATORS.length);
    expect(LIVE.summary.propertyClassSampleSizes.A.population).toBe(A.length); expect(LIVE.summary.propertyClassSampleSizes.B.population).toBe(B.length);
    expect(LIVE.summary.propertyClassSampleSizes.C.population).toBe(C.length); expect(LIVE.summary.propertyClassSampleSizes.D.population).toBe(D.length);
  });
  it('the fresh unseen sets (30 HE / 30 EN / 20 cross-class) and the second round are covered exactly', () => {
    expect(sorted(R.unseen.he)).toEqual([...GRAMMAR_UNSEEN_HE].sort());
    expect(sorted(R.unseen.en)).toEqual([...GRAMMAR_UNSEEN_EN].sort());
    expect(sorted(R.unseen.cross)).toEqual([...GRAMMAR_UNSEEN_CROSS].sort());
    expect(sorted(R.unseen.round2)).toEqual([...GRAMMAR_ROUND2_POSITIVES].sort());
    expect(LIVE.summary.unseenSizes).toMatchObject({ he: 30, en: 30, cross: 20 });
  });
  it('EVERY genuine account market / currency intent is a deterministic structured ACCOUNT_MARKET route (free-form leak count 0)', () => {
    const genuine = [...Object.values(R.regression), ...Object.values(R.codexFindings), ...Object.values(R.propertyClasses), ...Object.values(R.unseen)].flat();
    expect(LIVE.summary.freeFormLeakCount).toBe(0);
    expect(genuine.length).toBe(LIVE.summary.genuineIntentsTotal);
    expect(genuine.length).toBeGreaterThanOrEqual(700);
    for (const r of genuine) {
      expect(r.http, r.prompt).toBe(200);
      expect(r.answerSource, r.prompt).toBe('deterministic');
      expect(r.hasPayload, r.prompt).toBe(true);
      expect(r.payload, r.prompt).toMatchObject({ kind: 'product_truth', truthStatus: 'ACCOUNT_MARKET', claimScope: 'ACCOUNT', marketScope: 'ACCOUNT' });
      expect(r.payload.accountMarket, r.prompt).toBe(r.persona === 'LOCAL_PRO' ? 'LOCAL' : 'INTERNATIONAL');
      expect(r.payload.currencyScope, r.prompt).toBe(r.persona === 'LOCAL_PRO' ? 'ILS' : 'MULTI');
      expect(r.structuredViolations, r.prompt).toEqual([]);
      expect(r.proseViolations, r.prompt).toEqual([]);
      expect(r.productWideCurrencyClaims, r.prompt).toEqual([]);
      expect(r.marketLeakInProse, r.prompt).toBe(false);
      expect(r.normalized.length, `normalized intent present: ${r.prompt}`).toBeGreaterThan(0);
      expect(r.ok, r.prompt).toBe(true);
    }
  });
  it('the persona markets are SERVER-verified (never taken from the prompts)', () => {
    expect(LIVE.summary.serverFacts.LOCAL_PRO.serverMarket).toBe('Local');
    expect(LIVE.summary.serverFacts.INTL_PRO.serverMarket).toBe('International');
  });
  it('EVERY distinct negative control was asked and none was over-routed; the live route agrees with the classifier', () => {
    const expected = [...new Set([...MARKET_ROUTING_NEGATIVE_CONTROLS, ...SELF_BREAK_TEST.negatives, ...MICRO_NEGATIVE_CONTROLS, ...GRAMMAR_NEGATIVE_CONTROLS, ...GRAMMAR_ROUND2_NEGATIVES])];
    expect(LIVE.negatives.map((n) => n.prompt).sort()).toEqual(expected.sort());
    expect(expected.length).toBeGreaterThanOrEqual(240);
    for (const n of LIVE.negatives) { expect(n.overRouted, n.prompt).toBe(false); expect(n.classifierSaysAccountIntent, n.prompt).toBe(false); }
    expect(LIVE.summary.negativeControls.overRoutedToAccountMarket).toEqual([]);
  });
  it('the run gate is PASS', () => { expect(LIVE.summary.gate).toBe('PASS'); });
});

describe.each(Object.entries(VARIANCE))('20-call variance: %s', (_name, [file, who, prompt]) => {
  const V = JSON.parse(readFileSync(`${P}-variance-${file}.json`, 'utf-8'));
  const s = V.summary;
  it('the locked prompt, 20 identical calls, all deterministic, ONE payload, the verified market + currency, account-scoped, never product-wide', () => {
    expect(s.prompt).toBe(prompt);
    expect(s.calls).toBe(20);
    expect(s.structuredTruth).toMatchObject({ allDeterministic: true, allPayloadsPresent: true, allEqualToCanonicalAccountMarketPayload: true, allAccountScoped: true, allVerifiedMarketAndCurrency: true, anyProductWidePayload: false, distinctPayloads: 1 });
    expect(s.serverFacts.serverMarket).toBe(who === 'LOCAL' ? 'Local' : 'International');
  });
  it('one prose, 20/20 consistent with the payload, no product-wide / cross-market currency claim', () => {
    expect(s.proseVariance).toMatchObject({ distinctAnswerTexts: 1, consistentWithPayload: 20, contradictingThePayload: 0, productWideCurrencyClaimsInProse: 0, crossMarketCurrencyInProse: 0 });
    expect(s.gate).toBe('PASS');
  });
});
