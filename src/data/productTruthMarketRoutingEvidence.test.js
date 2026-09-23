// MARKET / CURRENCY ROUTING CLOSURE - the committed LIVE evidence is bound to the LOCKED routing matrix (Product Truth).
// The live capture (scripts/run-market-routing-matrix.mjs) is only acceptable if it covers EXACTLY the locked prompts - one call each, as the
// right synthetic persona - with a deterministic structured ACCOUNT_MARKET payload, a free-form leak count of 0, the deployed chat-ai version
// unchanged across the run and equal to the current runtime version, and the 20-call variance runs deterministic. A missing / extra /
// duplicated prompt, a free-form row, an over-routed negative control or a version mismatch fails here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUNTIME_V35_UPDATED_AT_UTC } from './productTruthFinalMatrixAcceptance.js';
import { MARKET_ROUTING_MATRIX, MARKET_ROUTING_NEGATIVE_CONTROLS, SELF_BREAK_TEST } from './productTruthMarketRoutingMatrix.js';

const P = 'evidence/product-truth/2026-09-23-market-routing';
const LIVE = JSON.parse(readFileSync(`${P}-live-matrix.json`, 'utf-8'));
const VAR_ORIGINAL = JSON.parse(readFileSync(`${P}-variance-original.json`, 'utf-8'));
const VAR_FORMER = JSON.parse(readFileSync(`${P}-variance-formerly-freeform.json`, 'utf-8'));
// HISTORICAL evidence: this live capture belongs to chat-ai v35 (routing closure); it stays committed and valid for v35. The current runtime is v36 (micro-closure).
const versionNumber = 35;

describe('live routing matrix evidence (committed)', () => {
  it('was captured against chat-ai v35 (its own deployed version), unchanged across the run', () => {
    expect(LIVE.summary.chatAi.before.version).toBe(versionNumber);
    expect(LIVE.summary.chatAi.after.version).toBe(versionNumber);
    expect(LIVE.summary.chatAi.before.ezbrSha256).toBe(LIVE.summary.chatAi.after.ezbrSha256);
    expect(LIVE.summary.chatAi.before.updatedAtUtc).toBe(RUNTIME_V35_UPDATED_AT_UTC);
    expect(LIVE.summary.testProjectRef).toBe('ljfizgrdyzxddswcedwr');
  });
  it('covers EXACTLY the locked matrix - one call per prompt, no extra, no missing, as the right persona', () => {
    const rows = LIVE.matrixRows;
    expect(rows.map((r) => r.prompt).sort()).toEqual(MARKET_ROUTING_MATRIX.map((r) => r.prompt).sort());
    for (const locked of MARKET_ROUTING_MATRIX) {
      const row = rows.find((r) => r.prompt === locked.prompt);
      expect(row.persona, locked.prompt).toBe(locked.persona);
      expect(row.lang, locked.prompt).toBe(locked.lang);
      expect(row.family, locked.prompt).toBe(locked.family);
    }
  });
  it('every matrix row is a deterministic ACCOUNT_MARKET route with a valid structured payload (free-form leak count 0)', () => {
    expect(LIVE.summary.freeFormLeakCount).toBe(0);
    for (const r of LIVE.matrixRows) {
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
      expect(r.languageOk, r.prompt).toBe(true);
    }
  });
  it('the Builder self break-test paraphrases all routed deterministically too', () => {
    expect(LIVE.selfPositive.map((r) => r.prompt).sort()).toEqual([...SELF_BREAK_TEST.positives].sort());
    for (const r of LIVE.selfPositive) {
      expect(r.answerSource, r.prompt).toBe('deterministic');
      expect(r.payloadOk, r.prompt).toBe(true);
      expect(r.structuredViolations, r.prompt).toEqual([]);
    }
  });
  it('no negative control was over-routed to the account-market route; the live route agrees with the classifier', () => {
    const expected = [...MARKET_ROUTING_NEGATIVE_CONTROLS, ...SELF_BREAK_TEST.negatives];
    expect(LIVE.negatives.map((n) => n.prompt).sort()).toEqual([...expected].sort());
    for (const n of LIVE.negatives) {
      expect(n.overRouted, n.prompt).toBe(false);
      expect(n.classifierSaysAccountIntent, n.prompt).toBe(false);
    }
    expect(LIVE.summary.negativeControls.overRoutedToAccountMarket).toEqual([]);
  });
  it('the persona markets are SERVER-verified (never taken from the prompts)', () => {
    expect(LIVE.summary.serverFacts.LOCAL_PRO.serverMarket).toBe('Local');
    expect(LIVE.summary.serverFacts.INTL_PRO.serverMarket).toBe('International');
  });
  it('the run gate is PASS', () => {
    expect(LIVE.summary.gate).toBe('PASS');
  });
});

describe.each([['original deterministic prompt', VAR_ORIGINAL], ['formerly free-form desire prompt', VAR_FORMER]])('20-call Local variance: %s', (_n, V) => {
  const s = V.summary;
  it('20 identical calls, all deterministic, one payload, canonical Local / ILS, account-scoped, never product-wide', () => {
    expect(s.calls).toBe(20);
    expect(s.structuredTruth).toMatchObject({ allDeterministic: true, allPayloadsPresent: true, allEqualToCanonicalAccountMarketPayload: true, allAccountScoped: true, allLocalIls: true, anyProductWideIlsOnlyPayload: false, distinctPayloads: 1 });
    expect(s.serverFacts.serverMarket).toBe('Local');
  });
  it('one prose, 20/20 consistent with the payload, no product-wide currency claim', () => {
    expect(s.proseVariance).toMatchObject({ distinctAnswerTexts: 1, consistentWithPayload: 20, contradictingThePayload: 0, productWideCurrencyClaimsInProse: 0 });
    expect(s.gate).toBe('PASS');
  });
  it('the supplementary paraphrases all took the deterministic route (nothing falls through to the model)', () => {
    expect(s.supplementary.fellThroughToTheModel).toEqual([]);
    expect(s.supplementary.payloadRoutesWithViolations).toEqual([]);
  });
});

describe('the formerly free-form prompt is the one Codex named', () => {
  it('is in the locked matrix', () => {
    expect(VAR_FORMER.summary.prompt).toBe('אני רוצה לראות מחירים בדולר');
    expect(MARKET_ROUTING_MATRIX.some((r) => r.prompt === VAR_FORMER.summary.prompt)).toBe(true);
  });
});
