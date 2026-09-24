// ACCOUNT / SYSTEM-SUBJECT CURRENCY QUESTION FRAME - the committed LIVE evidence is bound to the locked data (Product Truth micro-delta).
// The live capture (scripts/run-market-account-system-live.mjs) is only acceptable if it was taken against the CURRENT deployed chat-ai version (unchanged across the run),
// covers the four exact Codex questions, the new frame sampled per SUB-CLASS from its own population and the paraphrases, the targeted preservation samples, every negative
// control (incl. the impersonal out-of-scope case asked 6 times), every genuine intent is a deterministic structured ACCOUNT_MARKET route (free-form leak 0) and nothing
// that must stay off the route reached it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUNTIME_DEPLOYED_UPDATED_AT_UTC, RUNTIME_DEPLOYED_VERSION } from './productTruthFinalMatrixAcceptance.js';
import { MARKET_ROUTING_MATRIX } from './productTruthMarketRoutingMatrix.js';
import { GRAMMAR_CODEX_FINDINGS } from './productTruthMarketGrammarMatrix.js';
import { GRAMMAR_NEGATIVE_CONTROLS } from './productTruthMarketGrammarUnseen.js';
import {
  BLOCKER1_CODEX_NEGATIVES, BLOCKER2_CODEX_POSITIVE, selfCurrencyPositives, symbolPrefixCases, symbolWithNumberNegatives, thirdPartyDisplayNegativesEn, thirdPartyDisplayNegativesHe,
} from './productTruthMarketGrammarBlockers.js';
import { BLOCKERS_ROUND2_NEGATIVES } from './productTruthMarketGrammarBlockersRound2.js';
import {
  ACCOUNT_SYSTEM_CODEX_QUESTIONS, ACCOUNT_SYSTEM_NEGATIVES, ACCOUNT_SYSTEM_OUT_OF_SCOPE, ACCOUNT_SYSTEM_PARAPHRASES, accountSystemQuestionPositivesEn, accountSystemQuestionPositivesHe,
} from './productTruthMarketAccountSystemQuestion.js';

const LIVE = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-account-system-question-live-matrix.json', 'utf-8'));
const R = LIVE.rows;
const versionNumber = Number(RUNTIME_DEPLOYED_VERSION.replace('chat-ai-v', ''));
const sorted = (rows) => rows.map((r) => r.prompt).sort();
const EN = accountSystemQuestionPositivesEn(); const HE = accountSystemQuestionPositivesHe();

describe('account / system currency question - live evidence (committed)', () => {
  it('was captured against exactly the current deployed chat-ai version (v39+), unchanged across the run', () => {
    expect(versionNumber).toBeGreaterThanOrEqual(39);
    expect(LIVE.summary.chatAi.before.version).toBe(versionNumber);
    expect(LIVE.summary.chatAi.after.version).toBe(versionNumber);
    expect(LIVE.summary.chatAi.before.ezbrSha256).toBe(LIVE.summary.chatAi.after.ezbrSha256);
    expect(LIVE.summary.chatAi.before.updatedAtUtc).toBe(RUNTIME_DEPLOYED_UPDATED_AT_UTC);
    expect(LIVE.summary.testProjectRef).toBe('ljfizgrdyzxddswcedwr');
  });
  it('the four exact Codex questions are covered, in the right language / persona', () => {
    expect(sorted(R.frame.codexQuestions)).toEqual(ACCOUNT_SYSTEM_CODEX_QUESTIONS.map((q) => q.prompt).sort());
    for (const q of ACCOUNT_SYSTEM_CODEX_QUESTIONS) { const row = R.frame.codexQuestions.find((r) => r.prompt === q.prompt); expect(row.persona).toBe(q.persona); expect(row.lang).toBe(q.lang); }
  });
  it('the new frame is sampled per SUB-CLASS from its own population; the paraphrases are covered exactly', () => {
    const enPop = new Map(EN.map((c) => [c.prompt, c.klass])); const hePop = new Map(HE.map((c) => [c.prompt, c.klass]));
    for (const r of R.frame.enClass) expect(enPop.has(r.prompt), r.prompt).toBe(true);
    for (const r of R.frame.heClass) expect(hePop.has(r.prompt), r.prompt).toBe(true);
    expect(new Set(R.frame.enClass.map((r) => r.klass)).size).toBe(new Set(enPop.values()).size);
    expect(new Set(R.frame.heClass.map((r) => r.klass)).size).toBe(new Set(hePop.values()).size);
    expect(sorted(R.frame.paraphrases)).toEqual([...ACCOUNT_SYSTEM_PARAPHRASES].sort());
    expect(LIVE.summary.sampleSizes).toMatchObject({ enPopulation: EN.length, hePopulation: HE.length });
  });
  it('targeted preservation: market-forgery truth (original matrix) and the previous findings are covered exactly; symbol / SELF samples come from their populations', () => {
    expect(sorted(R.preservation.originalMatrix)).toEqual(MARKET_ROUTING_MATRIX.map((r) => r.prompt).sort());
    expect(sorted(R.preservation.codexFindings)).toEqual(GRAMMAR_CODEX_FINDINGS.map((f) => f.prompt).sort());
    const sym = new Set([BLOCKER2_CODEX_POSITIVE, ...symbolPrefixCases().map((c) => c.prompt)]); const self = new Set(selfCurrencyPositives().map((c) => c.prompt));
    for (const r of R.preservation.symbol) expect(sym.has(r.prompt), r.prompt).toBe(true);
    for (const r of R.preservation.selfPositives) expect(self.has(r.prompt), r.prompt).toBe(true);
    expect(R.preservation.symbol.length).toBeGreaterThanOrEqual(19); expect(R.preservation.selfPositives.length).toBeGreaterThanOrEqual(20);
  });
  it('EVERY genuine account / system currency intent is a deterministic structured ACCOUNT_MARKET route (free-form leak count 0)', () => {
    const genuine = [...Object.values(R.frame), ...Object.values(R.preservation)].flat();
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
      expect(r.normalized.length, `normalized intent present: ${r.prompt}`).toBeGreaterThan(0);
      expect(r.ok, r.prompt).toBe(true);
    }
    for (const r of R.frame.codexQuestions) expect(r.normalized[0], r.prompt).toMatchObject({ relation: 'CURRENCY_QUERY', subject: 'ACCOUNT', modality: 'QUESTION' });
  });
  it('the persona markets are SERVER-verified (never taken from the prompts)', () => {
    expect(LIVE.summary.serverFacts.LOCAL_PRO.serverMarket).toBe('Local');
    expect(LIVE.summary.serverFacts.INTL_PRO.serverMarket).toBe('International');
  });
  it('every negative control was asked and NONE reached ACCOUNT_MARKET - including the impersonal out-of-scope case, asked 5 more times', () => {
    const expected = [...new Set([...ACCOUNT_SYSTEM_NEGATIVES, ...ACCOUNT_SYSTEM_OUT_OF_SCOPE, ...BLOCKER1_CODEX_NEGATIVES, ...BLOCKERS_ROUND2_NEGATIVES, ...symbolWithNumberNegatives().map((c) => c.prompt), ...GRAMMAR_NEGATIVE_CONTROLS])];
    const asked = new Set(LIVE.negatives.map((n) => n.prompt));
    for (const p of expected) expect(asked.has(p), p).toBe(true);
    const thirdPop = new Set([...thirdPartyDisplayNegativesEn(), ...thirdPartyDisplayNegativesHe()].map((c) => c.prompt));
    expect(LIVE.negatives.filter((n) => thirdPop.has(n.prompt)).length).toBeGreaterThanOrEqual(20);
    for (const n of LIVE.negatives) { expect(n.overRouted, n.prompt).toBe(false); expect(n.classifierSaysAccountIntent, n.prompt).toBe(false); }
    expect(LIVE.summary.negativeControls.overRoutedToAccountMarket).toEqual([]);
    expect(LIVE.stability.length).toBe(5);
    expect(new Set(LIVE.stability.map((s) => s.prompt))).toEqual(new Set(ACCOUNT_SYSTEM_OUT_OF_SCOPE));
    expect(LIVE.stability.filter((s) => s.overRouted || s.factPayloadPresent && s.payloadTruthStatus === 'ACCOUNT_MARKET')).toEqual([]);
    expect(LIVE.summary.outOfScopeStability).toEqual({ asked: 5, overRouted: 0 });
  });
  it('the run gate is PASS', () => { expect(LIVE.summary.gate).toBe('PASS'); });
});
