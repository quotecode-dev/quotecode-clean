// MARKET / CURRENCY ROUTING MICRO-CLOSURE - the committed LIVE evidence is bound to the locked data (Product Truth).
// The live capture (scripts/run-market-routing-micro-closure.mjs) is only acceptable if it was taken against the CURRENT deployed chat-ai version (unchanged
// across the run), covers EXACTLY the locked prompts (original matrix, self break-test, the two Codex gaps, the generated Hebrew-prefix and English-plural
// class samples, the unseen paraphrases, every negative control), every genuine intent is a deterministic structured ACCOUNT_MARKET route (free-form leak
// count 0) and no negative control was over-routed. The four 20-call variance runs must each be deterministic with one payload and one prose.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUNTIME_DEPLOYED_UPDATED_AT_UTC, RUNTIME_DEPLOYED_VERSION } from './productTruthFinalMatrixAcceptance.js';
import {
  ENGLISH_PLURAL_IDENTITY_CLASS, HEBREW_PREFIX_CLASS, MARKET_ROUTING_MATRIX, MARKET_ROUTING_NEGATIVE_CONTROLS, MICRO_CODEX_GAPS, MICRO_NEGATIVE_CONTROLS,
  MICRO_UNSEEN_PARAPHRASES, SELF_BREAK_TEST,
} from './productTruthMarketRoutingMatrix.js';

const P = 'evidence/product-truth/2026-09-24-micro-closure';
const LIVE = JSON.parse(readFileSync(`${P}-live-matrix.json`, 'utf-8'));
const VARIANCE = {
  'original market-forgery prompt (HE, Local)': [JSON.parse(readFileSync(`${P}-variance-original.json`, 'utf-8')), 'LOCAL'],
  'formerly free-form desire prompt (HE, Local)': [JSON.parse(readFileSync(`${P}-variance-desire.json`, 'utf-8')), 'LOCAL'],
  'Hebrew prefixed-noun prompt (HE, Local)': [JSON.parse(readFileSync(`${P}-variance-hebrew-prefixed.json`, 'utf-8')), 'LOCAL'],
  'English plural-identity prompt (EN, International)': [JSON.parse(readFileSync(`${P}-variance-english-plural.json`, 'utf-8')), 'INTL'],
};
const versionNumber = Number(RUNTIME_DEPLOYED_VERSION.replace('chat-ai-v', ''));
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_x, k) => vars[k]);

describe('micro-closure live evidence (committed)', () => {
  it('was captured against exactly the current deployed chat-ai version (v36+), unchanged across the run', () => {
    expect(versionNumber).toBeGreaterThanOrEqual(36);
    expect(LIVE.summary.chatAi.before.version).toBe(versionNumber);
    expect(LIVE.summary.chatAi.after.version).toBe(versionNumber);
    expect(LIVE.summary.chatAi.before.ezbrSha256).toBe(LIVE.summary.chatAi.after.ezbrSha256);
    expect(LIVE.summary.chatAi.before.updatedAtUtc).toBe(RUNTIME_DEPLOYED_UPDATED_AT_UTC);
    expect(LIVE.summary.testProjectRef).toBe('ljfizgrdyzxddswcedwr');
  });
  it('covers EXACTLY the locked prompts in every section', () => {
    const p = (rows) => rows.map((r) => r.prompt).sort();
    expect(p(LIVE.matrixRows)).toEqual(MARKET_ROUTING_MATRIX.map((r) => r.prompt).sort());
    expect(p(LIVE.selfRows)).toEqual([...SELF_BREAK_TEST.positives].sort());
    expect(p(LIVE.gapRows)).toEqual(MICRO_CODEX_GAPS.map((g) => g.prompt).sort());
    expect(p(LIVE.unseenRows)).toEqual([...MICRO_UNSEEN_PARAPHRASES.he, ...MICRO_UNSEEN_PARAPHRASES.en].sort());
    expect(p(LIVE.negatives)).toEqual([...MARKET_ROUTING_NEGATIVE_CONTROLS, ...SELF_BREAK_TEST.negatives, ...MICRO_NEGATIVE_CONTROLS].sort());
    const he = HEBREW_PREFIX_CLASS;
    const expectedHe = [];
    for (const n of he.nouns) for (const pre of he.prefixes) for (const tpls of Object.values(he.templates)) expectedHe.push(fill(tpls[0], { X: `${pre}${n}` }));
    for (const pre of he.marketPrefixes) for (const tpl of he.marketTemplates) expectedHe.push(fill(tpl, { L: pre }));
    expect(p(LIVE.hePrefixRows)).toEqual(expectedHe.sort());
    const en = ENGLISH_PLURAL_IDENTITY_CLASS;
    const expectedEn = [];
    for (const n of en.nouns) for (const m of en.markets) for (const tpls of Object.values(en.templates)) expectedEn.push(fill(tpls[0], { a: 'truly ', m, n }).replace(/\s+/g, ' '));
    expect(p(LIVE.enPluralRows)).toEqual(expectedEn.sort());
  });
  it('the two Codex prompts are covered in the right language / persona', () => {
    for (const g of MICRO_CODEX_GAPS) {
      const row = LIVE.gapRows.find((r) => r.prompt === g.prompt);
      expect(row.persona).toBe(g.persona);
      expect(row.lang).toBe(g.lang);
    }
  });
  it('EVERY genuine account market / currency intent is a deterministic structured ACCOUNT_MARKET route (free-form leak count 0)', () => {
    const genuine = [...LIVE.matrixRows, ...LIVE.selfRows, ...LIVE.gapRows, ...LIVE.hePrefixRows, ...LIVE.enPluralRows, ...LIVE.unseenRows];
    expect(LIVE.summary.freeFormLeakCount).toBe(0);
    expect(genuine.length).toBe(LIVE.summary.genuineIntentsTotal);
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
      expect(r.ok, r.prompt).toBe(true);
    }
  });
  it('the persona markets are SERVER-verified (never taken from the prompts)', () => {
    expect(LIVE.summary.serverFacts.LOCAL_PRO.serverMarket).toBe('Local');
    expect(LIVE.summary.serverFacts.INTL_PRO.serverMarket).toBe('International');
  });
  it('no negative control was over-routed; the live route agrees with the classifier', () => {
    for (const n of LIVE.negatives) {
      expect(n.overRouted, n.prompt).toBe(false);
      expect(n.classifierSaysAccountIntent, n.prompt).toBe(false);
    }
    expect(LIVE.summary.negativeControls.overRoutedToAccountMarket).toEqual([]);
  });
  it('the unseen set has >= 10 Hebrew and >= 10 English and its honest first-pass record is preserved', () => {
    expect(LIVE.summary.unseenParaphrases.he).toBeGreaterThanOrEqual(10);
    expect(LIVE.summary.unseenParaphrases.en).toBeGreaterThanOrEqual(10);
    expect(LIVE.summary.unseenParaphrases.firstPassAtWriting.missed.length).toBe(2);
  });
  it('the run gate is PASS', () => {
    expect(LIVE.summary.gate).toBe('PASS');
  });
});

describe.each(Object.entries(VARIANCE))('20-call variance: %s', (_name, [V, who]) => {
  const s = V.summary;
  it('20 identical calls, all deterministic, ONE payload, the verified market + currency, account-scoped, never product-wide', () => {
    expect(s.calls).toBe(20);
    expect(s.structuredTruth).toMatchObject({ allDeterministic: true, allPayloadsPresent: true, allEqualToCanonicalAccountMarketPayload: true, allAccountScoped: true, allVerifiedMarketAndCurrency: true, anyProductWidePayload: false, distinctPayloads: 1 });
    expect(s.serverFacts.serverMarket).toBe(who === 'LOCAL' ? 'Local' : 'International');
  });
  it('one prose, 20/20 consistent with the payload, no product-wide / cross-market currency claim', () => {
    expect(s.proseVariance).toMatchObject({ distinctAnswerTexts: 1, consistentWithPayload: 20, contradictingThePayload: 0, productWideCurrencyClaimsInProse: 0, crossMarketCurrencyInProse: 0 });
    expect(s.gate).toBe('PASS');
  });
});
