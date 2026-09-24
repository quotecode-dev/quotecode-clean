// PRODUCT TRUTH - scope/polarity STRUCTURAL CLOSURE proof. Produces the numbers the closure report needs:
//   baseline gate (real committed rows) ; runtime-answer corpus ; cross-truth sweep ; the nine latest Codex failures + all earlier
//   attacks ; the combinatorial cases at polarity level (seen + unseen nouns) ; and EVERY AVAILABLE-truth generated case injected into the
//   real 48-cell Owner gate (row AND raw forged consistently, so only polarity can decide).
//   usage: node scripts/run-scope-property-proof.mjs [outJson]
import { readFileSync, writeFileSync } from 'node:fs';
import { formatCapabilityTruthAnswer } from '../supabase/functions/chat-ai/capabilityTruth.ts';
import { formatPaymentTruthAnswer } from '../supabase/functions/chat-ai/paymentTruth.ts';
import { formatInvoicingTruthAnswer } from '../supabase/functions/chat-ai/invoicingTruth.ts';
import { AI_FACTS } from '../supabase/functions/chat-ai/aiFacts.generated.ts';
import { PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY } from '../src/data/productTruthRegistry.js';
import { TRUTH_KINDS, checkCapabilityPolarity, deriveExpectedCapabilityTruth } from '../src/data/productTruthCapabilityPolarity.js';
import { validateFinalMatrix } from '../src/data/productTruthEvidenceSchema.js';
import { SCOPE_SUBJECTS, expectedAccept, generateScopeCases } from '../src/data/productTruthScopeCaseGenerator.js';

const OUT = process.argv[2] || 'evidence/product-truth/2026-09-23-scope-structural-closure-proof.json';
const EV = 'evidence/product-truth/2026-09-24-account-system-question';
const RAW = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-account-system-question-v39-raw-matrices.json', 'utf-8'));
const FILES = { owner: 'owner-matrix', planRole: 'plan-role-matrix', security: 'security-matrix', support: 'support-matrix' };
const ROWS = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, JSON.parse(readFileSync(`${EV}-${f}-final-rows.json`, 'utf-8')).rows]));
const clone = (x) => JSON.parse(JSON.stringify(x));
const truthFor = (kind) => (kind === 'AVAILABLE'
  ? deriveExpectedCapabilityTruth({ expectedResult: 'editor_calculator', serverPlan: 'pro', serverRole: 'user', market: 'Local' })
  : deriveExpectedCapabilityTruth({ expectedResult: 'ai_mutation' }));
const ownerGate = (slot, response) => {
  const rows = clone(ROWS.owner);
  const raw = clone(RAW);
  rows.find((r) => r.matrixSlot === slot).response = response;
  raw.matrices.owner.find((e) => e.slot === slot).response = response;
  return validateFinalMatrix('owner', rows, { rawCapture: raw });
};
const report = { capturedAtUtc: new Date().toISOString() };

// 1. baseline
report.baseline = Object.fromEntries(Object.keys(FILES).map((k) => { const r = validateFinalMatrix(k, clone(ROWS[k]), { rawCapture: clone(RAW) }); return [k, `${r.validCount} / ${r.totalRequired}`]; }));

// 2. runtime-answer corpus + 3. cross-truth sweep
const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const IDS = [...PRODUCT_TRUTH_REGISTRY, ...NON_CURRENT_REGISTRY].map((c) => c.id).filter((i) => i !== 'payment_processing' && i !== 'invoicing');
const truthOf = (id, tier = 'pro', role = 'user') => deriveExpectedCapabilityTruth({ expectedResult: id, serverPlan: tier, serverRole: role, market: 'Local' });
let corpus = 0; let corpusRejected = 0;
const accounts = [];
for (const tier of ['free', 'basic', 'pro']) for (const role of ['user', 'super_admin']) accounts.push({ tier, role });
let pairs = 0; let leaks = 0;
for (const id of IDS) for (const lang of ['en', 'he']) for (const a of accounts) {
  const text = formatCapabilityTruthAnswer(id, FACTS, lang === 'he', a.tier, a.role === 'super_admin');
  if (!text) continue;
  corpus += 1;
  if (checkCapabilityPolarity(truthOf(id, a.tier, a.role), text, lang).length) corpusRejected += 1;
  const own = truthOf(id, a.tier, a.role).kind;
  const others = new Map();
  for (const b of accounts) { const t = truthOf(id, b.tier, b.role); if (t.kind !== own) others.set(t.kind, t); }
  if (own !== TRUTH_KINDS.NOT_AVAILABLE) others.set('NA', { ...truthOf(id, a.tier, a.role), kind: TRUTH_KINDS.NOT_AVAILABLE });
  else others.set('AV', { ...truthOf(id, a.tier, a.role), kind: TRUTH_KINDS.AVAILABLE, gate: null, minimumPlan: null });
  for (const t of others.values()) { pairs += 1; if (checkCapabilityPolarity(t, text, lang).length === 0) leaks += 1; }
}
for (const lang of ['en', 'he']) {
  for (const [k, fmt] of [['payment_truth_sentinel', formatPaymentTruthAnswer], ['invoicing_truth_sentinel', formatInvoicingTruthAnswer]]) { corpus += 1; if (checkCapabilityPolarity(truthOf(k), fmt(lang === 'he'), lang).length) corpusRejected += 1; }
  corpus += 1; if (checkCapabilityPolarity(truthOf('quote_pdf_vs_print_comparison'), formatCapabilityTruthAnswer('quote_pdf_vs_print_comparison', FACTS, lang === 'he'), lang).length) corpusRejected += 1;
}
report.runtimeCorpus = { answers: corpus, falseRejections: corpusRejected };
report.crossTruthSweep = { pairs, leaks };

// 4. direct cases
const CALC = truthFor('AVAILABLE');
const direct = [
  // the nine latest Codex failures
  ['en', false, 'TEKANGO lacks the in-editor calculator — elsewhere it is available.', 'calculator|direct|en'], ['en', false, 'TEKANGO lacks the in-editor calculator: elsewhere it is available.', 'calculator|direct|en'],
  ['en', true, 'Other platforms lack this calculator — TEKANGO has an in-editor calculator.', 'calculator|direct|en'], ['en', true, 'It is unavailable in competing products: TEKANGO includes an in-editor calculator.', 'calculator|direct|en'],
  ['he', false, 'ב-TEKANGO חסר מחשבון מובנה בעורך — במוצרים אחרים הוא זמין.', 'calculator|direct|he'], ['he', false, 'ב-TEKANGO אין מחשבון מובנה בעורך: במוצרים אחרים הוא קיים.', 'calculator|direct|he'],
  ['he', false, 'מחשבון מובנה בעורך זמין בכל פלטפורמה מלבד TEKANGO.', 'calculator|direct|he'], ['he', true, 'במוצרים אחרים המחשבון אינו זמין — ב-TEKANGO הוא זמין.', 'calculator|direct|he'], ['he', true, 'במערכות אחרות היכולת אינה נתמכת: ב-TEKANGO היא נתמכת.', 'calculator|direct|he'],
  // earlier Finding 3 attacks
  ['en', false, 'In-editor calculator does not exist in TEKANGO', 'calculator|direct|en'], ['en', false, 'The in-editor calculator is available elsewhere, but TEKANGO lacks it.', 'calculator|direct|en'],
  ['en', false, 'The in-editor calculator is available only outside TEKANGO.', 'calculator|direct|en'], ['en', false, 'The in-editor calculator exists in other products, but not in TEKANGO.', 'calculator|direct|en'],
  ['en', false, 'The in-editor calculator is available elsewhere.', 'calculator|direct|en'],
  ['en', true, 'The in-editor calculator is unavailable elsewhere, but available in TEKANGO.', 'calculator|direct|en'], ['en', true, 'The in-editor calculator is available in other products and in TEKANGO.', 'calculator|direct|en'],
  ['en', true, 'The in-editor calculator is not available outside TEKANGO, but TEKANGO supports it.', 'calculator|direct|en'],
  ['he', false, 'מחשבון מובנה בעורך זמין במוצרים אחרים, אבל לא ב-TEKANGO.', 'calculator|direct|he'], ['he', false, 'מחשבון מובנה בעורך זמין רק מחוץ ל-TEKANGO.', 'calculator|direct|he'], ['he', false, 'מחשבון מובנה בעורך קיים במוצרים אחרים, אבל לא קיים ב-TEKANGO.', 'calculator|direct|he'],
  ['he', true, 'מחשבון מובנה בעורך לא זמין במוצרים אחרים, אבל זמין ב-TEKANGO.', 'calculator|direct|he'], ['he', true, 'מחשבון מובנה בעורך זמין גם במוצרים אחרים וגם ב-TEKANGO.', 'calculator|direct|he'],
];
report.directCases = direct.map(([lang, valid, text, slot]) => {
  const g = ownerGate(slot, text);
  const polarityAccepts = checkCapabilityPolarity(CALC, text, lang).length === 0;
  return { lang, text, expected: valid ? 'ACCEPT' : 'REJECT', polarity: polarityAccepts ? 'ACCEPT' : 'REJECT', ownerGate: `${g.validCount} / 48`, ok: polarityAccepts === valid && g.validCount === (valid ? 48 : 47) };
});

// 5. generated cases - polarity level (seen + unseen nouns, both truths)
const UNSEEN = {
  enNouns: [['spreadsheets', 'spreadsheet'], ['browsers', 'browser'], ['CRMs', 'CRM'], ['notebooks', 'notebook'], ['dashboards', 'dashboard'], ['plugins', 'plugin']],
  heNouns: [['דפדפנים', 'דפדפן', 'אחרים'], ['גיליונות', 'גיליון', 'אחרים'], ['מחברות', 'מחברת', 'אחרות'], ['תוספים', 'תוסף', 'אחרים']],
};
const tally = (opts) => {
  const t = { generated: 0, mustReject: 0, mustAccept: 0, leaks: 0, falseRejections: 0, byFamily: {} };
  for (const kind of ['AVAILABLE', 'NOT_AVAILABLE']) for (const lang of ['en', 'he']) for (const c of generateScopeCases(lang, SCOPE_SUBJECTS[kind], opts)) {
    const want = expectedAccept(c.tekangoClaim, kind);
    const got = checkCapabilityPolarity(truthFor(kind), c.text, lang).length === 0;
    t.generated += 1; want ? (t.mustAccept += 1) : (t.mustReject += 1);
    if (got && !want) t.leaks += 1;
    if (!got && want) t.falseRejections += 1;
    t.byFamily[c.family] = (t.byFamily[c.family] || 0) + 1;
  }
  return t;
};
report.generatedPolarity = { seenNouns: tally({}), unseenNouns: tally(UNSEEN) };

// 6. EVERY AVAILABLE-truth generated case through the real 48-cell Owner gate
const gate = { contradictionsInjected: 0, contradictionsRejected: 0, validPositivesInjected: 0, validPositivesAccepted: 0, leaks: [], falseRejections: [] };
for (const [lang, slot] of [['en', 'calculator|direct|en'], ['he', 'calculator|direct|he']]) {
  for (const c of generateScopeCases(lang, SCOPE_SUBJECTS.AVAILABLE)) {
    const res = ownerGate(slot, c.text);
    if (c.tekangoClaim === 'positive') { gate.validPositivesInjected += 1; res.validCount === 48 ? (gate.validPositivesAccepted += 1) : gate.falseRejections.push(c.text); }
    else { gate.contradictionsInjected += 1; res.validCount < 48 ? (gate.contradictionsRejected += 1) : gate.leaks.push(c.text); }
  }
}
gate.leakCount = gate.leaks.length; gate.falseRejectionCount = gate.falseRejections.length;
gate.leaks = gate.leaks.slice(0, 20); gate.falseRejections = gate.falseRejections.slice(0, 20);
report.fullOwnerGateInjection = gate;

const ok = Object.values(report.baseline).join() === '48 / 48,13 / 13,9 / 9,4 / 4'
  && report.runtimeCorpus.falseRejections === 0 && report.crossTruthSweep.leaks === 0
  && report.directCases.every((d) => d.ok)
  && report.generatedPolarity.seenNouns.leaks === 0 && report.generatedPolarity.seenNouns.falseRejections === 0
  && report.generatedPolarity.unseenNouns.leaks === 0 && report.generatedPolarity.unseenNouns.falseRejections === 0
  && gate.leakCount === 0 && gate.falseRejectionCount === 0 && gate.contradictionsRejected === gate.contradictionsInjected && gate.validPositivesAccepted === gate.validPositivesInjected;
report.summary = ok ? 'BASELINE 48/13/9/4; ZERO CONTRADICTION LEAKS; ZERO FALSE REJECTIONS' : 'PROOF FAILED';
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ baseline: report.baseline, runtimeCorpus: report.runtimeCorpus, crossTruthSweep: report.crossTruthSweep, directCasesOk: report.directCases.every((d) => d.ok), directCases: report.directCases.length, generatedPolarity: { seen: { generated: report.generatedPolarity.seenNouns.generated, leaks: report.generatedPolarity.seenNouns.leaks, falseRejections: report.generatedPolarity.seenNouns.falseRejections }, unseen: { generated: report.generatedPolarity.unseenNouns.generated, leaks: report.generatedPolarity.unseenNouns.leaks, falseRejections: report.generatedPolarity.unseenNouns.falseRejections } }, fullOwnerGateInjection: { ...gate, leaks: gate.leakCount, falseRejections: gate.falseRejectionCount }, summary: report.summary }, null, 2));
process.exit(ok ? 0 : 1);
