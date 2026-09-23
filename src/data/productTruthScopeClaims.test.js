// PRODUCT TRUTH - STRUCTURAL SCOPE / POLARITY closure tests.
// The two previous Finding 3 rounds fixed the Codex phrases; Codex then broke the model with punctuation / clause-order /
// exclusivity variants. These tests lock (1) the structural model (segmentation categories, explicit claim objects, TEKANGO-scope
// resolution, exclusivity, clause-order independence), (2) the exact latest Codex failures, and (3) a COMBINATORIAL property
// suite over ~133k generated semantic cases (see productTruthScopeCaseGenerator.js) with by-construction ground truth,
// including a stratified sample pushed through the REAL 48-cell Owner gate.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyzeCapabilityProse, checkCapabilityPolarity, deriveExpectedCapabilityTruth } from './productTruthCapabilityPolarity.js';
import { SCOPE_MODEL, segmentClauses } from './productTruthScopeClaims.js';
import { validateFinalMatrix } from './productTruthEvidenceSchema.js';
import { SCOPE_SUBJECTS, expectedAccept, generateScopeCases } from './productTruthScopeCaseGenerator.js';

const truthFor = (kind) => (kind === 'AVAILABLE'
  ? deriveExpectedCapabilityTruth({ expectedResult: 'editor_calculator', serverPlan: 'pro', serverRole: 'user', market: 'Local' })
  : deriveExpectedCapabilityTruth({ expectedResult: 'ai_mutation' }));
const CALC = truthFor('AVAILABLE');
const passes = (truth, text, lang) => checkCapabilityPolarity(truth, text, lang).length === 0;
const claimsOf = (text, lang, labels = ['In-editor calculator']) => analyzeCapabilityProse(text, lang, { labels, otherLabels: [] }).sentences.flatMap((s) => s.claims);
const shape = (claims) => claims.map((c) => `${c.scope}:${c.polarity}`).sort();

describe('SCOPE MODEL - clause segmentation is by boundary CATEGORY, not by a fixed string list', () => {
  const cases = {
    comma: 'a, b', semicolon: 'a; b', colon: 'a: b', 'em dash': 'a — b', 'en dash': 'a – b', 'spaced hyphen': 'a - b', parentheses: 'a (b)', slash: 'a / b', pipe: 'a | b', bullet: 'a • b', arrow: 'a -> b', ellipsis: 'a … b',
    but: 'a but b', though: 'a though b', although: 'a although b', however: 'a however b', while: 'a while b', whereas: 'a whereas b', yet: 'a yet b',
  };
  it.each(Object.entries(cases))('EN %s cuts two clauses', (_name, s) => { expect(segmentClauses(s, 'en').length).toBeGreaterThanOrEqual(2); });
  const he = { אבל: 'א אבל ב', אך: 'א אך ב', אולם: 'א אולם ב', אלא: 'א אלא ב', למרות: 'א למרות ב', 'אף ש (attached)': 'א אף שב', 'בעוד ש (attached)': 'א בעוד שב', בעוד: 'א בעוד ב', ואילו: 'א ואילו ב', colon: 'א: ב', 'em dash': 'א — ב', 'en dash': 'א – ב', parentheses: 'א (ב)' };
  it.each(Object.entries(he))('HE %s cuts two clauses', (_name, s) => { expect(segmentClauses(s, 'he').length).toBeGreaterThanOrEqual(2); });
  it('"אך ורק" (= only) is NOT a boundary; an exception construct ("everywhere but TEKANGO") is protected from its own "but"', () => {
    expect(segmentClauses('זמין אך ורק מחוץ ל-TEKANGO', 'he')).toHaveLength(1);
    expect(segmentClauses('It is available everywhere but TEKANGO', 'en')).toHaveLength(1);
    expect(segmentClauses('It is available everywhere but not in TEKANGO', 'en').length).toBe(2);
  });
  it('the boundary categories are regexes (categories), and every documented contrast word of the task is covered in EN and HE', () => {
    expect(SCOPE_MODEL.en.punctuation).toBeInstanceOf(RegExp);
    for (const w of ['but', 'though', 'although', 'however', 'while', 'whereas']) expect(new RegExp(SCOPE_MODEL.en.contrast.source, 'i').test(` ${w} `)).toBe(true);
    for (const w of ['אלא', 'אבל', 'למרות', 'בעוד', 'אולם', 'אך']) expect(new RegExp(SCOPE_MODEL.he.contrast.source).test(` ${w} `)).toBe(true);
  });
});

describe('SCOPE MODEL - explicit claim objects (polarity / scope / qualifiers / span)', () => {
  it('TEKANGO and external scopes are represented SEPARATELY, per clause', () => {
    const c = claimsOf('TEKANGO lacks the in-editor calculator — elsewhere it is available.', 'en');
    expect(shape(c)).toEqual(['external:positive', 'tekango:negative']);
    for (const claim of c) {
      expect(claim).toMatchObject({ polarity: expect.stringMatching(/^(positive|negative)$/), scope: expect.any(String), qualifiers: expect.any(Array), span: expect.any(Array), text: expect.any(String) });
    }
  });
  it('a claim with no scope phrase is implicit-tekango; both scopes in one clause is "both"', () => {
    expect(shape(claimsOf('The in-editor calculator exists.', 'en'))).toEqual(['implicit-tekango:positive']);
    expect(shape(claimsOf('The in-editor calculator is available in other products and in TEKANGO.', 'en'))).toEqual(['both:positive']);
  });
  it('exclusivity produces an external claim AND the opposite TEKANGO claim, with exclusive/exception qualifiers', () => {
    const exc = claimsOf('The in-editor calculator is available everywhere except TEKANGO.', 'en');
    expect(shape(exc)).toEqual(['external:positive', 'tekango:negative']);
    expect(exc.find((c) => c.scope === 'tekango').qualifiers).toEqual(expect.arrayContaining(['exception', 'exclusive']));
    const only = claimsOf('The in-editor calculator is available only outside TEKANGO.', 'en');
    expect(shape(only)).toEqual(['external:positive', 'tekango:negative']);
    // "unavailable everywhere except TEKANGO" means TEKANGO has it
    expect(shape(claimsOf('The in-editor calculator is unavailable everywhere except TEKANGO.', 'en'))).toEqual(['external:negative', 'tekango:positive']);
  });
  it('a fronted external scope moves to the next clause; a comparative ("unlike other tools") does not', () => {
    expect(shape(claimsOf('Elsewhere, the in-editor calculator is available; in TEKANGO, it is not.', 'en'))).toEqual(['external:positive', 'implicit-tekango:negative']);
    expect(shape(claimsOf('Unlike other tools, it has the in-editor calculator.', 'en'))).toEqual(['implicit-tekango:positive']);
  });
  it('an exception FRAGMENT after a comma attaches to the neighbouring clause (either side)', () => {
    expect(shape(claimsOf('The in-editor calculator is available everywhere, except TEKANGO.', 'en'))).toEqual(['external:positive', 'tekango:negative']);
    expect(shape(claimsOf('Except in TEKANGO, the in-editor calculator is available everywhere.', 'en'))).toEqual(['external:positive', 'tekango:negative']);
  });
});

describe('SCOPE MODEL - clause ORDER never changes the TEKANGO truth', () => {
  const pairs = [
    ['TEKANGO lacks the in-editor calculator', 'elsewhere it is available'],
    ['TEKANGO has the in-editor calculator', 'elsewhere it is unavailable'],
    ['the in-editor calculator is not available in TEKANGO', 'other platforms have it'],
    ['the in-editor calculator exists in TEKANGO', 'it does not exist in other systems'],
  ];
  const joins = [', ', '; ', ': ', ' — ', ' – ', ' / ', '. ', ' | '];
  it.each(pairs)('"%s" + "%s": identical verdict in both orders under every boundary', (a, b) => {
    for (const j of joins) expect(passes(CALC, `${a}${j}${b}.`, 'en'), `${a}${j}${b}`).toBe(passes(CALC, `${b}${j}${a}.`, 'en'));
  });
  it('HE: identical verdict in both orders', () => {
    const a = 'ב-TEKANGO אין מחשבון מובנה בעורך';
    const b = 'במוצרים אחרים הוא קיים';
    for (const j of [', ', '; ', ': ', ' — ', ' – ', ' / ', '. ']) expect(passes(CALC, `${a}${j}${b}.`, 'he')).toBe(passes(CALC, `${b}${j}${a}.`, 'he'));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('EXACT latest Codex failures (all 9) - locked', () => {
  const nine = [
    ['en', false, 'TEKANGO lacks the in-editor calculator — elsewhere it is available.'],
    ['en', false, 'TEKANGO lacks the in-editor calculator: elsewhere it is available.'],
    ['en', true, 'Other platforms lack this calculator — TEKANGO has an in-editor calculator.'],
    ['en', true, 'It is unavailable in competing products: TEKANGO includes an in-editor calculator.'],
    ['he', false, 'ב-TEKANGO חסר מחשבון מובנה בעורך — במוצרים אחרים הוא זמין.'],
    ['he', false, 'ב-TEKANGO אין מחשבון מובנה בעורך: במוצרים אחרים הוא קיים.'],
    ['he', false, 'מחשבון מובנה בעורך זמין בכל פלטפורמה מלבד TEKANGO.'],
    ['he', true, 'במוצרים אחרים המחשבון אינו זמין — ב-TEKANGO הוא זמין.'],
    ['he', true, 'במערכות אחרות היכולת אינה נתמכת: ב-TEKANGO היא נתמכת.'],
  ];
  it.each(nine.map((n, i) => [i + 1, ...n]))('#%i (%s, expect %s) %s', (_i, lang, accept, text) => {
    expect(passes(CALC, text, lang), text).toBe(accept);
  });
});

describe('ALL earlier Finding 3 attack cases stay locked', () => {
  const prior = [
    ['en', false, 'The in-editor calculator is available elsewhere, but TEKANGO lacks it.'],
    ['en', false, 'The in-editor calculator is available only outside TEKANGO.'],
    ['en', false, 'The in-editor calculator exists in other products, but not in TEKANGO.'],
    ['en', true, 'The in-editor calculator is unavailable elsewhere, but available in TEKANGO.'],
    ['en', true, 'The in-editor calculator is available in other products and in TEKANGO.'],
    ['en', true, 'The in-editor calculator is not available outside TEKANGO, but TEKANGO supports it.'],
    ['en', false, 'The in-editor calculator is available elsewhere.'],
    ['en', false, 'In-editor calculator does not exist in TEKANGO'],
    ['en', true, 'Yes - In-editor calculator exists in TEKANGO.'],
    ['en', false, 'TEKANGO lacks it, though the in-editor calculator exists elsewhere.'],
    ['he', false, 'מחשבון מובנה בעורך זמין במוצרים אחרים, אבל לא ב-TEKANGO.'],
    ['he', false, 'מחשבון מובנה בעורך זמין רק מחוץ ל-TEKANGO.'],
    ['he', false, 'מחשבון מובנה בעורך קיים במוצרים אחרים, אבל לא קיים ב-TEKANGO.'],
    ['he', true, 'מחשבון מובנה בעורך לא זמין במוצרים אחרים, אבל זמין ב-TEKANGO.'],
    ['he', true, 'מחשבון מובנה בעורך זמין גם במוצרים אחרים וגם ב-TEKANGO.'],
    ['he', true, 'כן - מחשבון בעורך ההצעה קיים ב-TEKANGO.'],
  ];
  it.each(prior)('%s expect-accept=%s: %s', (lang, accept, text) => { expect(passes(CALC, text, lang), text).toBe(accept); });
  it('the required Codex scope attacks are rejected with an in-TEKANGO DENIAL (not merely as insufficient)', () => {
    for (const [lang, text] of [
      ['en', 'The in-editor calculator is available elsewhere, but TEKANGO lacks it.'], ['en', 'The in-editor calculator is available only outside TEKANGO.'],
      ['en', 'TEKANGO lacks the in-editor calculator — elsewhere it is available.'], ['he', 'מחשבון מובנה בעורך זמין רק מחוץ ל-TEKANGO.'],
      ['he', 'מחשבון מובנה בעורך זמין בכל פלטפורמה מלבד TEKANGO.'], ['he', 'ב-TEKANGO חסר מחשבון מובנה בעורך — במוצרים אחרים הוא זמין.'],
    ]) expect(checkCapabilityPolarity(CALC, text, lang).join(' '), text).toMatch(/denies_existence/);
  });
});

describe('Realistic variants beyond the generator (self break-test): separators, verbs, fronted scope, exceptions, neither/nor, quantified externals', () => {
  const T = [
    ['en', false, 'TEKANGO lacks the in-editor calculator (it is available elsewhere).'], ['en', false, 'The in-editor calculator — available elsewhere — is missing from TEKANGO.'],
    ['en', false, 'Although other tools include the in-editor calculator, TEKANGO does not.'], ['en', false, "Other tools have the in-editor calculator; TEKANGO doesn't."],
    ['en', false, 'The in-editor calculator is available everywhere (except TEKANGO).'], ['en', false, 'Except in TEKANGO, the in-editor calculator is available everywhere.'],
    ['en', false, 'The in-editor calculator is available everywhere but TEKANGO.'], ['en', false, 'Every platform but TEKANGO has the in-editor calculator.'],
    ['en', false, 'The in-editor calculator is available on all platforms, other than in TEKANGO.'], ['en', false, 'Elsewhere, the in-editor calculator is available; in TEKANGO, it is not.'],
    ['en', false, 'Neither TEKANGO nor other products have the in-editor calculator.'], ['en', false, 'Most platforms have an in-editor calculator, TEKANGO doesn’t.'],
    ['en', false, 'TEKANGO lacks the in-editor calculator / elsewhere it is available.'], ['en', false, 'TEKANGO lacks the in-editor calculator … elsewhere it is available.'],
    ['en', false, "The in-editor calculator is available elsewhere, but you won't find it in TEKANGO."], ['en', false, 'The in-editor calculator is available in other tools; it is absent from TEKANGO.'],
    ['en', true, 'Elsewhere, the in-editor calculator is unavailable; in TEKANGO, it is available.'], ['en', true, 'The in-editor calculator is unavailable everywhere except TEKANGO.'],
    ['en', true, 'The in-editor calculator is available only in TEKANGO.'], ['en', true, 'TEKANGO ships an in-editor calculator; other platforms do not.'],
    ['en', true, 'Other platforms lack it / TEKANGO has the in-editor calculator.'], ['en', true, 'You get the in-editor calculator in TEKANGO, unlike other tools.'],
    ['he', false, 'המחשבון קיים במוצרים אחרים (ב-TEKANGO הוא חסר).'], ['he', false, 'מחשבון מובנה בעורך זמין בכל מערכת (למעט TEKANGO).'],
    ['he', false, 'למעט ב-TEKANGO, המחשבון המובנה בעורך זמין בכל מקום.'], ['he', false, 'במוצרים אחרים, המחשבון המובנה בעורך זמין; ב-TEKANGO, הוא אינו זמין.'],
    ['he', false, 'המחשבון המובנה בעורך זמין במוצרים אחרים, אבל לא תמצא אותו ב-TEKANGO.'], ['he', false, 'TEKANGO חסרה מחשבון מובנה בעורך, בעוד שבמוצרים אחרים הוא קיים.'],
    ['he', true, 'במוצרים אחרים, המחשבון המובנה בעורך אינו זמין; ב-TEKANGO, הוא זמין.'], ['he', true, 'המחשבון המובנה בעורך אינו זמין באף מערכת מלבד TEKANGO.'],
    ['he', true, 'בניגוד לכלים אחרים, ב-TEKANGO המחשבון המובנה בעורך זמין.'], ['he', true, 'ב-TEKANGO תמצא מחשבון מובנה בעורך, בניגוד למוצרים אחרים.'],
  ];
  it.each(T)('%s accept=%s: %s', (lang, accept, text) => { expect(passes(CALC, text, lang), text).toBe(accept); });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('PROPERTY / ADVERSARIAL - combinatorial semantic cases with by-construction ground truth', () => {
  const KINDS = ['AVAILABLE', 'NOT_AVAILABLE'];
  const all = [];
  for (const kind of KINDS) for (const lang of ['en', 'he']) for (const c of generateScopeCases(lang, SCOPE_SUBJECTS[kind])) all.push({ ...c, kind });
  const verdicts = all.map((c) => ({ c, got: passes(truthFor(c.kind), c.text, c.lang), want: expectedAccept(c.tekangoClaim, c.kind) }));

  it('generates a large, multi-dimensional case space (counts reported)', () => {
    const contradictions = verdicts.filter((v) => !v.want).length;
    const positives = verdicts.filter((v) => v.want).length;
    console.info(`SCOPE PROPERTY SUITE: ${all.length} generated cases (${contradictions} must-reject: contradictions + insufficient, ${positives} must-accept: valid positives)`);
    expect(all.length).toBeGreaterThan(100000);
    expect(contradictions).toBeGreaterThan(10000);
    expect(positives).toBeGreaterThan(10000);
    const dims = (k) => new Set(all.map((c) => c.dims[k]).filter(Boolean));
    expect([...dims('boundary')].sort()).toEqual(expect.arrayContaining(['comma', 'semicolon', 'colon', 'em-dash', 'en-dash', 'spaced-hyphen', 'period', 'but', 'though', 'while', 'aval', 'af-she', 'beod', 'slash', 'pipe', 'ellipsis', 'arrow', 'bullet', 'parentheses']));
    expect(dims('order')).toEqual(new Set(['tek-first', 'ext-first']));
    expect(dims('noun').size).toBeGreaterThanOrEqual(12);
    expect(new Set(all.map((c) => c.family))).toEqual(new Set(['pair', 'tek-only', 'ext-only', 'except-positive', 'except-negative', 'only-outside', 'only-tekango', 'special', 'composition', 'temporal']));
    expect([...dims('exclusivity')]).toEqual(expect.arrayContaining(['except TEKANGO', 'other than TEKANGO', 'apart from TEKANGO', 'besides TEKANGO', 'excluding TEKANGO', 'מלבד TEKANGO', 'חוץ מ-TEKANGO', 'פרט ל-TEKANGO', 'למעט TEKANGO']));
    expect(dims('gender')).toEqual(new Set(['m', 'f']));
  });

  it('ZERO contradiction leaks: every must-reject case is rejected (external-positive + TEKANGO-negative, exclusivity, TEKANGO-negative only, external-only)', () => {
    const leaks = verdicts.filter((v) => !v.want && v.got).map((v) => `${v.c.kind}|${v.c.lang}|${v.c.family}: ${v.c.text}`);
    expect(leaks.slice(0, 10)).toEqual([]);
    expect(leaks).toHaveLength(0);
  });
  it('ZERO false rejections: every valid scoped positive is accepted (external-negative + TEKANGO-positive, TEKANGO-only, unavailable-everywhere-except-TEKANGO, only-in-TEKANGO)', () => {
    const rej = verdicts.filter((v) => v.want && !v.got).map((v) => `${v.c.kind}|${v.c.lang}|${v.c.family}: ${v.c.text}`);
    expect(rej.slice(0, 10)).toEqual([]);
    expect(rej).toHaveLength(0);
  });

  // selectors describe ONLY the semantics of the generated case; the expected outcome is stated explicitly
  const family = (name, select, expectAccept) => it(name, () => {
    const sel = verdicts.filter((v) => select(v.c));
    expect(sel.length).toBeGreaterThan(0);
    expect(sel.filter((v) => v.got !== expectAccept).map((v) => v.c.text).slice(0, 5)).toEqual([]);
    console.info(`PROPERTY ${name.slice(0, 70)}: ${sel.length} cases, all ${expectAccept ? 'accepted' : 'rejected'}`);
  });
  const pair = (c, ext, tek, kind) => c.family === 'pair' && c.dims.extPolarity === ext && c.dims.tekPolarity === tek && c.kind === kind;
  family('required property: external positive + TEKANGO negative => reject a positive-availability expectation', (c) => pair(c, 'positive', 'negative', 'AVAILABLE'), false);
  family('required property: external negative + TEKANGO positive => accept a positive-availability expectation', (c) => pair(c, 'negative', 'positive', 'AVAILABLE'), true);
  family('required property: external positive + TEKANGO positive => accept (both have it)', (c) => pair(c, 'positive', 'positive', 'AVAILABLE'), true);
  family('required property: external negative + TEKANGO negative => reject', (c) => pair(c, 'negative', 'negative', 'AVAILABLE'), false);
  family('required property: external positive only, no TEKANGO claim => insufficient for positive TEKANGO proof', (c) => c.family === 'ext-only' && c.kind === 'AVAILABLE', false);
  family('required property: TEKANGO positive only => accept', (c) => c.family === 'tek-only' && c.tekangoClaim === 'positive' && c.kind === 'AVAILABLE', true);
  family('required property: TEKANGO negative only => reject', (c) => c.family === 'tek-only' && c.tekangoClaim === 'negative' && c.kind === 'AVAILABLE', false);
  family('required property: "all/every X except TEKANGO" => reject (every noun class, every exception word, EN + HE)', (c) => c.family === 'except-positive' && c.kind === 'AVAILABLE', false);
  family('required property: "unavailable everywhere except TEKANGO" => accept (TEKANGO has it)', (c) => c.family === 'except-negative' && c.kind === 'AVAILABLE', true);
  family('required property: "only outside TEKANGO / only elsewhere / only on other X" => reject', (c) => c.family === 'only-outside' && c.kind === 'AVAILABLE', false);
  family('required property: "only in TEKANGO" => accept', (c) => c.family === 'only-tekango' && c.kind === 'AVAILABLE', true);
  family('required property: special constructions (fronted scope, exception-first, but-exception, neither/nor, terminal negation) => reject the contradictions', (c) => c.family === 'special' && c.tekangoClaim === 'negative' && c.kind === 'AVAILABLE', false);
  family('required property: special constructions (comparatives, fronted scope, unavailable-except) => accept the valid positives', (c) => c.family === 'special' && c.tekangoClaim === 'positive' && c.kind === 'AVAILABLE', true);
  family('required property: mirror under a NOT_AVAILABLE truth - external positive + TEKANGO negative => ACCEPT', (c) => pair(c, 'positive', 'negative', 'NOT_AVAILABLE'), true);
  family('required property: mirror under a NOT_AVAILABLE truth - TEKANGO positive (external anything) => REJECT', (c) => c.family === 'pair' && c.dims.tekPolarity === 'positive' && c.kind === 'NOT_AVAILABLE', false);

  it('ORDER INDEPENDENCE: for every generated pair, tek-first and ext-first give the identical verdict', () => {
    const groups = new Map();
    for (const v of verdicts) {
      if (v.c.family !== 'pair') continue;
      const key = `${v.c.kind}|${v.c.lang}|${v.c.dims.pair}|${v.c.dims.gender ?? ''}`;
      const g = groups.get(key) ?? {};
      g[v.c.dims.order] = v.got;
      groups.set(key, g);
    }
    let compared = 0;
    const diff = [];
    for (const [key, g] of groups) { if ('tek-first' in g && 'ext-first' in g) { compared += 1; if (g['tek-first'] !== g['ext-first']) diff.push(key); } }
    expect(compared).toBeGreaterThan(10000);
    expect(diff.slice(0, 10)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A stratified sample of the generated cases pushed through the REAL 48-cell Owner gate (row AND raw forged consistently, so
// only polarity can decide). The evidence script (scripts/run-scope-property-proof.mjs) runs EVERY AVAILABLE-truth case.
const EV = 'evidence/product-truth/2026-09-24-grammar-blockers';
const RAW = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-grammar-blockers-v38-raw-matrices.json', 'utf-8'));
const OWNER = JSON.parse(readFileSync(`${EV}-owner-matrix-final-rows.json`, 'utf-8')).rows;
const clone = (x) => JSON.parse(JSON.stringify(x));
const ownerGate = (slot, response) => {
  const rows = clone(OWNER);
  const raw = clone(RAW);
  rows.find((r) => r.matrixSlot === slot).response = response;
  raw.matrices.owner.find((e) => e.slot === slot).response = response;
  return validateFinalMatrix('owner', rows, { rawCapture: raw });
};

describe('FULL 48-cell Owner gate with generated scoped cases injected', () => {
  it('control: 48 / 48 before any injection', () => {
    const res = validateFinalMatrix('owner', clone(OWNER), { rawCapture: clone(RAW) });
    expect(res.validCount).toBe(48);
    expect(res.passes).toBe(true);
  });
  const STRIDE = 40;
  for (const [lang, slot] of [['en', 'calculator|direct|en'], ['he', 'calculator|direct|he']]) {
    it(`${lang.toUpperCase()}: every ${STRIDE}th generated contradiction drops the Owner matrix below 48; every ${STRIDE}th valid positive keeps 48 / 48`, () => {
      const cases = generateScopeCases(lang, SCOPE_SUBJECTS.AVAILABLE);
      let injectedContradictions = 0; let rejected = 0; let injectedPositives = 0; let accepted = 0;
      const leaks = []; const falseRejects = [];
      cases.forEach((c, i) => {
        if (i % STRIDE !== 0) return;
        const res = ownerGate(slot, c.text);
        if (c.tekangoClaim === 'positive') { injectedPositives += 1; if (res.validCount === 48) accepted += 1; else falseRejects.push(c.text); }
        else { injectedContradictions += 1; if (res.validCount < 48) rejected += 1; else leaks.push(c.text); }
      });
      console.info(`OWNER-GATE INJECTION ${lang}: contradictions ${injectedContradictions}, rejected ${rejected}; valid positives ${injectedPositives}, accepted ${accepted}`);
      expect(injectedContradictions).toBeGreaterThan(300);
      expect(injectedPositives).toBeGreaterThan(50);
      expect(leaks.slice(0, 5)).toEqual([]);
      expect(falseRejects.slice(0, 5)).toEqual([]);
      expect(rejected).toBe(injectedContradictions);
      expect(accepted).toBe(injectedPositives);
    }, 120000);
  }
  it('the nine latest Codex failures injected into the real gate: every contradiction < 48, every valid positive = 48', () => {
    const inj = [
      ['calculator|direct|en', 'TEKANGO lacks the in-editor calculator — elsewhere it is available.', false], ['calculator|direct|en', 'TEKANGO lacks the in-editor calculator: elsewhere it is available.', false],
      ['calculator|direct|en', 'Other platforms lack this calculator — TEKANGO has an in-editor calculator.', true], ['calculator|direct|en', 'It is unavailable in competing products: TEKANGO includes an in-editor calculator.', true],
      ['calculator|direct|he', 'ב-TEKANGO חסר מחשבון מובנה בעורך — במוצרים אחרים הוא זמין.', false], ['calculator|direct|he', 'ב-TEKANGO אין מחשבון מובנה בעורך: במוצרים אחרים הוא קיים.', false],
      ['calculator|direct|he', 'מחשבון מובנה בעורך זמין בכל פלטפורמה מלבד TEKANGO.', false], ['calculator|direct|he', 'במוצרים אחרים המחשבון אינו זמין — ב-TEKANGO הוא זמין.', true],
      ['calculator|direct|he', 'במערכות אחרות היכולת אינה נתמכת: ב-TEKANGO היא נתמכת.', true],
    ];
    for (const [slot, text, valid] of inj) expect(ownerGate(slot, text).validCount, text).toBe(valid ? 48 : 47);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('GENERALISATION - unseen external nouns (none of them appear in any noun list in the model)', () => {
  const UNSEEN = {
    enNouns: [['spreadsheets', 'spreadsheet'], ['browsers', 'browser'], ['CRMs', 'CRM'], ['notebooks', 'notebook'], ['dashboards', 'dashboard'], ['plugins', 'plugin']],
    heNouns: [['דפדפנים', 'דפדפן', 'אחרים'], ['גיליונות', 'גיליון', 'אחרים'], ['מחברות', 'מחברת', 'אחרות'], ['תוספים', 'תוסף', 'אחרים']],
  };
  it('the full property space with UNSEEN nouns: zero contradiction leaks, zero false rejections', () => {
    let total = 0;
    const bad = [];
    for (const kind of ['AVAILABLE', 'NOT_AVAILABLE']) for (const lang of ['en', 'he']) {
      for (const c of generateScopeCases(lang, SCOPE_SUBJECTS[kind], UNSEEN)) {
        total += 1;
        if (passes(truthFor(kind), c.text, lang) !== expectedAccept(c.tekangoClaim, kind)) bad.push(`${kind}|${lang}|${c.family}|${c.tekangoClaim}: ${c.text}`);
      }
    }
    console.info(`UNSEEN-NOUN PROPERTY SUITE: ${total} generated cases, ${bad.length} mismatches`);
    expect(total).toBeGreaterThan(100000);
    expect(bad.slice(0, 10)).toEqual([]);
  }, 120000);
  it('a TEKANGO-internal noun after "other" (plans, users, accounts, roles) is NOT an external product', () => {
    const c = (t) => claimsOf(t, 'en').map((x) => `${x.scope}:${x.polarity}`);
    expect(c('The in-editor calculator is available on other plans.')).toEqual(['implicit-tekango:positive']);
    expect(c('The in-editor calculator is available in other products.')).toEqual(['external:positive']);
  });
});

describe('ANTI-PATCH guards (source level)', () => {
  const nonTest = ['src/data/productTruthScopeClaims.js', 'src/data/productTruthCapabilityPolarity.js', 'src/data/productTruthScopeCaseGenerator.js'];
  it('no literal Codex example sentence / capability-specific exception exists in the model source', () => {
    const banned = [/lacks the in-editor calculator/i, /elsewhere it is available/i, /Other platforms lack/i, /competing products: TEKANGO/i, /בכל פלטפורמה מלבד/, /במערכות אחרות היכולת/, /ב-TEKANGO חסר מחשבון/];
    for (const file of nonTest.slice(0, 2)) {
      const code = readFileSync(file, 'utf-8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
      for (const b of banned) expect(code, `${file} contains ${b}`).not.toMatch(b);
    }
  });
  it('the scope module knows nothing about any particular capability (no calculator / attachments / print ...)', () => {
    const code = readFileSync('src/data/productTruthScopeClaims.js', 'utf-8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/calculator|attachment|whatsapp|print|pdf|mutation|מחשבון|צירוף|הדפס/i);
  });
  it('TEKANGO and external scopes are separate claim scopes and clause order is never consulted by resolution', () => {
    const src = readFileSync('src/data/productTruthScopeClaims.js', 'utf-8');
    expect(src).toMatch(/'external'/);
    expect(src).toMatch(/'implicit-tekango'/);
    const resolve = src.slice(src.indexOf('export function resolveTekangoClaims'), src.indexOf('export function clauseScopeAt'));
    expect(resolve).not.toMatch(/clauseIndex|span|\.sort\(|\[0\]|\[i/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('POLARITY COMPOSITION - negation operators, retraction, negated-quantifier exceptions, TIME and MODALITY', () => {
  const N = truthFor('NOT_AVAILABLE');
  const cases = [
    // [truth, lang, expect-accept, text]
    ['A', 'en', true, 'It is not true that TEKANGO lacks the in-editor calculator.'],
    ['A', 'en', true, "It isn't true that the in-editor calculator is missing from TEKANGO."],
    ['A', 'en', false, 'It is not true that the in-editor calculator exists in TEKANGO.'],
    ['A', 'en', false, 'Some say the in-editor calculator exists in TEKANGO, but that is wrong.'],
    ['A', 'en', false, 'Some say TEKANGO includes the in-editor calculator. That is false.'],
    ['A', 'en', true, 'Some say TEKANGO lacks the in-editor calculator, but that is wrong.'],
    ['A', 'en', true, 'No other product has the in-editor calculator except TEKANGO.'],
    ['A', 'en', true, 'No platform apart from TEKANGO has the in-editor calculator.'],
    ['A', 'he', true, 'לא נכון ש-TEKANGO חסרה מחשבון מובנה בעורך.'],
    ['A', 'he', false, 'יש אומרים שהמחשבון המובנה בעורך זמין ב-TEKANGO, אבל זה לא נכון.'],
    ['A', 'he', false, 'יש אומרים שהמחשבון המובנה בעורך קיים ב-TEKANGO. זה שגוי.'],
    ['A', 'he', false, 'לא נכון שהמחשבון המובנה בעורך זמין ב-TEKANGO.'],
    // time: availability is a claim about NOW
    ['A', 'en', false, 'TEKANGO will have the in-editor calculator next year.'],
    ['A', 'en', false, 'TEKANGO used to have the in-editor calculator.'],
    ['A', 'en', false, 'The in-editor calculator is coming soon to TEKANGO.'],
    ['A', 'en', false, 'The in-editor calculator is planned for TEKANGO.'],
    ['A', 'en', false, 'The in-editor calculator was in TEKANGO but is no longer there.'],
    ['A', 'en', true, 'Yes - In-editor calculator exists in TEKANGO. It has been there since launch.'],
    ['A', 'he', false, 'המחשבון המובנה בעורך יהיה זמין ב-TEKANGO בקרוב.'],
    ['A', 'he', false, 'ב-TEKANGO היה פעם מחשבון מובנה בעורך.'],
    ['N', 'en', true, 'AI-executed data mutation will be available in TEKANGO soon.'],
    ['N', 'en', true, 'AI-executed data mutation is not available yet, but it will be.'],
    ['N', 'en', true, 'AI-executed data mutation was in TEKANGO but is no longer there.'],
    // modality: a hedge asserts nothing (insufficient either way)
    ['A', 'en', false, 'TEKANGO may have the in-editor calculator.'],
    ['A', 'en', false, 'TEKANGO might have an in-editor calculator, I am not sure.'],
    ['A', 'en', false, 'Supposedly, TEKANGO has the in-editor calculator.'],
    ['N', 'en', false, 'Perhaps AI-executed data mutation is not available in TEKANGO.'],
    ['A', 'he', false, 'אולי יש ב-TEKANGO מחשבון מובנה בעורך.'],
    ['A', 'he', false, 'כנראה שהמחשבון המובנה בעורך קיים ב-TEKANGO.'],
  ];
  it.each(cases)('%s %s accept=%s: %s', (k, lang, accept, text) => {
    expect(passes(k === 'A' ? CALC : N, text, lang), text).toBe(accept);
  });
  it('the claim objects record the composition (qualifiers): operator negation, retraction, negated quantifier, non-present tense', () => {
    const q = (text) => claimsOf(text, 'en').flatMap((c) => c.qualifiers);
    expect(q('It is not true that TEKANGO lacks the in-editor calculator.')).toContain('negated-by-operator');
    expect(q('Some say TEKANGO lacks the in-editor calculator, but that is wrong.')).toContain('retracted');
    expect(q('No other product has the in-editor calculator except TEKANGO.')).toContain('negated-quantifier');
    expect(q('TEKANGO will have the in-editor calculator next year.')).toContain('non-present');
  });
});
