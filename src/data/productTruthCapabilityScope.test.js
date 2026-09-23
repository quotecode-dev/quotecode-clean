// PRODUCT TRUTH FINDING 3 (narrow remediation, second round) - PRODUCT / LOCATION SCOPE in capability polarity.
// Codex proved that "The in-editor calculator is available elsewhere, but TEKANGO lacks it", "... available only outside TEKANGO"
// and the Hebrew "מחשבון מובנה בעורך זמין במוצרים אחרים, אבל לא ב-TEKANGO" still passed the full 48-cell Owner gate: the extractor saw an
// UNSCOPED positive availability token and never bound the later scope (elsewhere / outside TEKANGO / TEKANGO lacks it / אבל לא ב-TEKANGO).
// The fix models scope (round 2: per-cue scope; superseded by the STRUCTURAL clause/claim model in productTruthScopeClaims.js - see
// productTruthScopeClaims.test.js for the structural, property and clause-order tests): a capability truth is availability IN TEKANGO;
// external claims never prove it and TEKANGO-scoped denials outrank generic positives. These tests are GROUPED by scope construction (not one string per Codex example) and finish with the FULL GATE.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TRUTH_KINDS, analyzeCapabilityProse, checkCapabilityPolarity, deriveExpectedCapabilityTruth } from './productTruthCapabilityPolarity.js';
import { validateFinalMatrix } from './productTruthEvidenceSchema.js';

const truth = (id, plan = 'pro', role = 'user') => deriveExpectedCapabilityTruth({ expectedResult: id, serverPlan: plan, serverRole: role, market: 'Local' });
const CALC = truth('editor_calculator'); // expected: AVAILABLE in TEKANGO
const verdict = (t, text, lang) => checkCapabilityPolarity(t, text, lang);
const passes = (t, text, lang) => verdict(t, text, lang).length === 0;

// [text, shouldPass]
const EN_GROUPS = {
  'elsewhere + TEKANGO lacks it (TEKANGO denial outranks the generic positive)': [
    ['The in-editor calculator is available elsewhere, but TEKANGO lacks it.', false],
    ['You can find a calculator in other tools, though TEKANGO does not have one.', false],
    ["Other products have an in-editor calculator; TEKANGO doesn't.", false],
    ['The in-editor calculator is a feature of other tools; TEKANGO lacks it.', false],
    ['TEKANGO does not have it while other products do.', false],
  ],
  'available ONLY outside TEKANGO / everywhere except TEKANGO (exclusivity is a TEKANGO denial)': [
    ['The in-editor calculator is available only outside TEKANGO.', false],
    ['The in-editor calculator is available outside of TEKANGO only.', false],
    ['The in-editor calculator exists everywhere except TEKANGO.', false],
    ['Only other products have the in-editor calculator.', false],
  ],
  'other products + "but not in TEKANGO"': [
    ['The in-editor calculator exists in other products, but not in TEKANGO.', false],
    ['The in-editor calculator is available in other products, but it is not available in TEKANGO.', false],
    ['The in-editor calculator can be found elsewhere, not in TEKANGO.', false],
    ['Competitors offer an in-editor calculator, but it is missing from TEKANGO.', false],
  ],
  'order reversal (TEKANGO denial first, elsewhere second)': [
    ['TEKANGO lacks it, though the in-editor calculator exists elsewhere.', false],
    ['TEKANGO lacks the in-editor calculator, although it exists elsewhere.', false],
    ['TEKANGO does not have an in-editor calculator, unlike other products.', false],
    ['Yes, the in-editor calculator is available elsewhere. In TEKANGO it does not exist.', false],
  ],
  'availability elsewhere ALONE is not proof of availability in TEKANGO (fail closed: insufficient)': [
    ['The in-editor calculator is available elsewhere.', false],
    ['It exists in other products.', false],
  ],
  'valid scoped positives: elsewhere is negative / neutral, TEKANGO is positive': [
    ['The in-editor calculator is unavailable elsewhere, but available in TEKANGO.', true],
    ['The in-editor calculator is available in other products and in TEKANGO.', true],
    ['The in-editor calculator is not available outside TEKANGO, but TEKANGO supports it.', true],
    ['The in-editor calculator is not available elsewhere, but it is in TEKANGO.', true],
    ['It is not available in other tools, but TEKANGO has it.', true],
    ['Other products have one too, and TEKANGO also supports the in-editor calculator.', true],
    ['Unlike some other tools, TEKANGO does have an in-editor calculator.', true],
    ['The in-editor calculator exists in TEKANGO and in other products too.', true],
    ['The in-editor calculator is available in TEKANGO, and elsewhere as well.', true],
  ],
  'plain in-TEKANGO statements (the original attack and the natural positives)': [
    ['In-editor calculator does not exist in TEKANGO', false],
    ['There is no In-editor calculator in TEKANGO.', false],
    ['Yes - In-editor calculator exists in TEKANGO.', true],
    ['Yes, TEKANGO has a built-in calculator in the editor, just like other products.', true],
    ['Yes, the editor has a built-in calculator you can use.', true],
  ],
};
const HE_GROUPS = {
  'במוצרים אחרים + אבל לא ב-TEKANGO / TEKANGO חסר': [
    ['מחשבון מובנה בעורך זמין במוצרים אחרים, אבל לא ב-TEKANGO.', false],
    ['מחשבון מובנה בעורך קיים במוצרים אחרים, אבל לא קיים ב-TEKANGO.', false],
    ['המחשבון קיים במוצרים אחרים, אך חסר ב-TEKANGO.', false],
    ['מחשבון מובנה בעורך נתמך במוצרים אחרים אבל לא נתמך ב-TEKANGO.', false],
    ['אצל מתחרים יש מחשבון מובנה בעורך, אבל TEKANGO לא כוללת אותו.', false],
  ],
  'זמין רק/אך ורק מחוץ ל-TEKANGO / בכל מקום חוץ מ-TEKANGO (exclusivity)': [
    ['מחשבון מובנה בעורך זמין רק מחוץ ל-TEKANGO.', false],
    ['מחשבון מובנה בעורך זמין אך ורק מחוץ ל-TEKANGO.', false],
    ['מחשבון מובנה בעורך קיים בכל מקום חוץ מ-TEKANGO.', false],
    ['מחשבון מובנה בעורך זמין במקום אחר.', false],
  ],
  'order reversal (TEKANGO first, others second)': [
    ['TEKANGO לא כוללת מחשבון מובנה בעורך, אף שהוא זמין במוצרים אחרים.', false],
    ['ב-TEKANGO אין מחשבון מובנה בעורך, למרות שהוא קיים אצל מתחרים.', false],
    ['אין ב-TEKANGO מחשבון מובנה, אף שהוא קיים במוצרים אחרים.', false],
  ],
  'valid scoped positives (masculine / feminine / common runtime forms: קיים/קיימת, זמין/זמינה, נתמך/נתמכת)': [
    ['מחשבון מובנה בעורך לא זמין במוצרים אחרים, אבל זמין ב-TEKANGO.', true],
    ['מחשבון מובנה בעורך זמין גם במוצרים אחרים וגם ב-TEKANGO.', true],
    ['הוא לא קיים במוצרים אחרים, אבל TEKANGO כוללת אותו.', true],
    ['מחשבון מובנה בעורך נתמך גם ב-TEKANGO וגם במוצרים אחרים.', true],
    ['מחשבון מובנה בעורך זמינה ב-TEKANGO, בניגוד לכלים אחרים.', true],
    ['מחשבון מובנה בעורך קיים ב-TEKANGO, בניגוד לכלים אחרים.', true],
    ['מחשבון מובנה בעורך נתמכת ב-TEKANGO וגם במוצרים אחרים.', true],
  ],
  'plain in-TEKANGO statements and the real runtime form': [
    ['כן - מחשבון בעורך ההצעה קיים ב-TEKANGO.', true],
    ['כן - מחשבון בעורך ההצעה קיימת ב-TEKANGO.', true],
    ['כן, יש מחשבון מובנה בעורך של TEKANGO.', true],
    ['מחשבון בעורך ההצעה אינו קיים ב-TEKANGO.', false],
    ['אין מחשבון בעורך ההצעה.', false],
  ],
};

describe('FINDING 3 scope - EN grouped scope cases (AVAILABLE truth: in-editor calculator on a PRO account)', () => {
  for (const [group, cases] of Object.entries(EN_GROUPS)) {
    it(group, () => {
      for (const [text, want] of cases) expect(passes(CALC, text, 'en'), `${want ? 'PASS' : 'FAIL'} expected: ${text} -> ${JSON.stringify(verdict(CALC, text, 'en'))}`).toBe(want);
    });
  }
  it('the required Codex EN attack strings are rejected with an in-TEKANGO reason', () => {
    expect(verdict(CALC, 'The in-editor calculator is available elsewhere, but TEKANGO lacks it.', 'en').join(' ')).toMatch(/denies_existence/);
    expect(verdict(CALC, 'The in-editor calculator is available only outside TEKANGO.', 'en').join(' ')).toMatch(/denies_existence/);
    expect(verdict(CALC, 'The in-editor calculator exists in other products, but not in TEKANGO.', 'en').join(' ')).toMatch(/denies_existence/);
  });
  it('"available elsewhere" alone is rejected as INSUFFICIENT (no in-TEKANGO claim), not as a denial', () => {
    const v = verdict(CALC, 'The in-editor calculator is available elsewhere.', 'en');
    expect(v).toEqual(['available_expected_but_response_does_not_affirm_existence']);
  });
});

describe('FINDING 3 scope - HE grouped scope cases (AVAILABLE truth)', () => {
  for (const [group, cases] of Object.entries(HE_GROUPS)) {
    it(group, () => {
      for (const [text, want] of cases) expect(passes(CALC, text, 'he'), `${want ? 'PASS' : 'FAIL'} expected: ${text} -> ${JSON.stringify(verdict(CALC, text, 'he'))}`).toBe(want);
    });
  }
  it('the required Codex HE attack string is rejected with an in-TEKANGO reason', () => {
    expect(verdict(CALC, 'מחשבון מובנה בעורך זמין במוצרים אחרים, אבל לא ב-TEKANGO.', 'he').join(' ')).toMatch(/denies_existence/);
    expect(verdict(CALC, 'מחשבון מובנה בעורך זמין רק מחוץ ל-TEKANGO.', 'he').join(' ')).toMatch(/denies_existence/);
  });
});

describe('FINDING 3 scope - the same scope model under the OTHER truth kinds', () => {
  it('NOT_AVAILABLE truth (AI mutation is roadmap): a TEKANGO denial with availability elsewhere is CORRECT; a TEKANGO affirmation is not', () => {
    const t = truth('ai_mutation');
    expect(t.kind).toBe(TRUTH_KINDS.NOT_AVAILABLE);
    expect(passes(t, 'AI-executed data mutation is available in other products, but TEKANGO lacks it.', 'en')).toBe(true);
    expect(passes(t, 'AI-executed data mutation is available only outside TEKANGO.', 'en')).toBe(true);
    expect(passes(t, 'AI-executed data mutation is available elsewhere, but not in TEKANGO.', 'en')).toBe(true);
    expect(passes(t, 'AI-executed data mutation is not available elsewhere, but TEKANGO supports it.', 'en')).toBe(false);
    expect(passes(t, 'AI-executed data mutation is available in other products and in TEKANGO.', 'en')).toBe(false);
    expect(passes(t, 'AI-executed data mutation is available elsewhere.', 'en')).toBe(false); // no in-TEKANGO denial
    expect(passes(t, 'שינוי נתונים על ידי AI זמין במוצרים אחרים, אבל לא ב-TEKANGO.', 'he')).toBe(true);
    expect(passes(t, 'שינוי נתונים על ידי AI זמין גם במוצרים אחרים וגם ב-TEKANGO.', 'he')).toBe(false);
  });
  it('PLAN_LOCKED truth: availability elsewhere never substitutes for the in-TEKANGO existence + plan-gate + account-lacks claims', () => {
    const t = truth('attachments', 'free');
    expect(t.kind).toBe(TRUTH_KINDS.PLAN_LOCKED);
    expect(passes(t, 'File attachments are available elsewhere, but TEKANGO lacks them.', 'en')).toBe(false);
    expect(passes(t, 'File attachments are available in other products.', 'en')).toBe(false);
    expect(passes(t, 'Yes - File attachments exists in TEKANGO, but it requires the PRO plan or above. Your current plan does not include it. Other products offer it too.', 'en')).toBe(true);
  });
  it('PAYMENT_NOT_LIVE truth: payments live in other products are not a false claim about TEKANGO; a TEKANGO claim still fails', () => {
    const t = truth('payment_truth_sentinel');
    expect(passes(t, 'Payments are live in other products, but TEKANGO has no live checkout or payment.', 'en')).toBe(true);
    expect(passes(t, 'Yes - TEKANGO accepts credit cards and checkout is live.', 'en')).toBe(false);
    expect(passes(t, 'Other products accept credit cards; TEKANGO has no live checkout or payment.', 'en')).toBe(true);
  });
});

describe('FINDING 3 scope - claim objects keep TEKANGO and external scopes separate (structural model)', () => {
  const claims = (text, lang) => analyzeCapabilityProse(text, lang, { labels: ['In-editor calculator'], otherLabels: [] }).sentences.flatMap((c) => c.claims).map((c) => `${c.scope}:${c.polarity}`).sort();
  it('each clause becomes a claim with its own scope and polarity', () => {
    expect(claims('available elsewhere, but TEKANGO lacks it', 'en')).toEqual(['external:positive', 'tekango:negative']);
    expect(claims('exists in other products and in TEKANGO', 'en')).toEqual(['both:positive']);
    expect(claims('The calculator exists', 'en')).toEqual(['implicit-tekango:positive']);
    expect(claims('TEKANGO lacks it, though it exists elsewhere', 'en')).toEqual(['external:positive', 'tekango:negative']);
  });
  it('"outside TEKANGO" is an EXTERNAL-scope phrase, not a TEKANGO marker (EN + HE)', () => {
    expect(claims('available outside TEKANGO', 'en')).toEqual(['external:positive']);
    expect(claims('זמין מחוץ ל-TEKANGO', 'he')).toEqual(['external:positive']);
    expect(claims('לא זמין במוצרים אחרים, אבל זמין ב-TEKANGO', 'he')).toEqual(['external:negative', 'tekango:positive']);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// FULL GATE: the REAL committed Owner rows (48) + raw capture, with each scoped contradiction injected into the calculator cell.
// The response is forged CONSISTENTLY in the row and in the raw capture, so raw-binding cannot help: polarity must reject on its own.
const P = 'evidence/product-truth/2026-09-24-grammar-blockers';
const RAW = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-grammar-blockers-v38-raw-matrices.json', 'utf-8'));
const OWNER = JSON.parse(readFileSync(`${P}-owner-matrix-final-rows.json`, 'utf-8')).rows;
const clone = (x) => JSON.parse(JSON.stringify(x));
function ownerGateWith(slot, response) {
  const rows = clone(OWNER);
  const raw = clone(RAW);
  rows.find((r) => r.matrixSlot === slot).response = response;
  raw.matrices.owner.find((e) => e.slot === slot).response = response;
  return validateFinalMatrix('owner', rows, { rawCapture: raw });
}
const cell = (res, slot) => res.slotResults.find((r) => r.slot === slot);

describe('FINDING 3 scope - FULL 48-cell Owner gate with injected scoped contradictions', () => {
  it('control: the real committed Owner rows are still 48 / 48', () => {
    const res = validateFinalMatrix('owner', clone(OWNER), { rawCapture: clone(RAW) });
    expect(res.validCount).toBe(48);
    expect(res.passes).toBe(true);
  });
  const EN_SLOT = 'calculator|direct|en';
  const HE_SLOT = 'calculator|direct|he';
  it.each([
    'In-editor calculator does not exist in TEKANGO',
    'The in-editor calculator is available elsewhere, but TEKANGO lacks it.',
    'The in-editor calculator is available only outside TEKANGO.',
    'The in-editor calculator exists in other products, but not in TEKANGO.',
    'TEKANGO lacks it, though the in-editor calculator exists elsewhere.',
    'The in-editor calculator is available elsewhere.',
  ])('EN injected "%s" drops the Owner matrix below 48', (text) => {
    const res = ownerGateWith(EN_SLOT, text);
    expect(res.validCount).toBe(47);
    expect(res.passes).toBe(false);
    expect(cell(res, EN_SLOT).violations.join(' ')).toMatch(/prose:available_expected_but_response_(denies_existence|does_not_affirm_existence)/);
  });
  it.each([
    'מחשבון מובנה בעורך זמין במוצרים אחרים, אבל לא ב-TEKANGO.',
    'מחשבון מובנה בעורך זמין רק מחוץ ל-TEKANGO.',
    'מחשבון מובנה בעורך קיים במוצרים אחרים, אבל לא קיים ב-TEKANGO.',
    'TEKANGO לא כוללת מחשבון מובנה בעורך, אף שהוא זמין במוצרים אחרים.',
  ])('HE injected "%s" drops the Owner matrix below 48', (text) => {
    const res = ownerGateWith(HE_SLOT, text);
    expect(res.validCount).toBe(47);
    expect(res.passes).toBe(false);
    expect(cell(res, HE_SLOT).violations.join(' ')).toMatch(/prose:available_expected_but_response_/);
  });
  it.each([
    ['The in-editor calculator is unavailable elsewhere, but available in TEKANGO.', EN_SLOT],
    ['The in-editor calculator is available in other products and in TEKANGO.', EN_SLOT],
    ['The in-editor calculator is not available outside TEKANGO, but TEKANGO supports it.', EN_SLOT],
    ['Yes - In-editor calculator exists in TEKANGO.', EN_SLOT],
    ['מחשבון מובנה בעורך לא זמין במוצרים אחרים, אבל זמין ב-TEKANGO.', HE_SLOT],
    ['מחשבון מובנה בעורך זמין גם במוצרים אחרים וגם ב-TEKANGO.', HE_SLOT],
    ['כן - מחשבון בעורך ההצעה קיים ב-TEKANGO.', HE_SLOT],
  ])('valid scoped positive "%s" keeps the Owner matrix at 48 / 48', (text, slot) => {
    const res = ownerGateWith(slot, text);
    expect(res.validCount).toBe(48);
    expect(res.passes).toBe(true);
  });
});
