// ACCOUNT MARKET / CURRENCY INTENT GRAMMAR - LIVE TEST CAPTURE (Product Truth intent grammar normalization closure).
//
// Against the currently deployed TEST chat-ai, as the synthetic persona that owns each prompt's language (HE: LOCAL_PRO - Local / ILS; EN: INTL_PRO - International),
// records for EVERY genuine account market / currency intent: route (answerSource), presence of the structured `factPayload`, the structured checks (product_truth /
// ACCOUNT_MARKET / ACCOUNT scope / accountMarket + currencyScope equal to the SERVER-verified market / equality with the canonical derivation), prose consistency, the
// absence of any product-wide or cross-market currency claim - and the grammar's own NORMALIZED intent for the prompt (relation / modality / target).
// Sections: (1) regression - original locked matrix, self break-test, micro-closure sets, Hebrew-prefix / English-plural class samples; (2) the six Codex findings;
// (3) the compositional property classes A-D, sampled per sub-class (every separator of class D); (4) the fresh unseen sets (30 HE / 30 EN / 20 cross) + second round;
// (5) every distinct negative control (must NOT come back as ACCOUNT_MARKET). FREE-FORM LEAK = a genuine intent with `factPayload: null`. Required: 0.
// The chat-ai version is bracketed with read-only `supabase functions list` reads before AND after; the run is refused if it changed. Credentials come only from the
// Owner-authorized, gitignored C:/tkrc-pt/.env.localtest.local and are never printed.
//   usage: node scripts/run-market-intent-grammar-live.mjs [outJson]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { checkFactPayloadAgainstCanonical, checkProseAgainstPayload, findProductWideCurrencyClaims } from '../src/data/productTruthFactPayload.js';
import {
  ENGLISH_PLURAL_IDENTITY_CLASS, HEBREW_PREFIX_CLASS, MARKET_ROUTING_MATRIX, MARKET_ROUTING_NEGATIVE_CONTROLS, MICRO_CODEX_GAPS, MICRO_NEGATIVE_CONTROLS, MICRO_UNSEEN_PARAPHRASES, SELF_BREAK_TEST,
} from '../src/data/productTruthMarketRoutingMatrix.js';
import { clauseCompositionCases, englishIdentityGrammarCases, GRAMMAR_CODEX_FINDINGS, hebrewRelationshipGrammarCases, overrideGrammarCases } from '../src/data/productTruthMarketGrammarMatrix.js';
import { GRAMMAR_NEGATIVE_CONTROLS, GRAMMAR_UNSEEN_CROSS, GRAMMAR_UNSEEN_EN, GRAMMAR_UNSEEN_HE } from '../src/data/productTruthMarketGrammarUnseen.js';
import { GRAMMAR_ROUND2_NEGATIVES, GRAMMAR_ROUND2_POSITIVES } from '../src/data/productTruthMarketGrammarRound2.js';
import {
  BLOCKER1_CODEX_NEGATIVES, BLOCKER2_CODEX_POSITIVE, selfCurrencyPositives, symbolPrefixCases, symbolWithNumberNegatives, thirdPartyDisplayNegativesEn, thirdPartyDisplayNegativesHe,
} from '../src/data/productTruthMarketGrammarBlockers.js';
import { BLOCKERS_ROUND2_KNOWN_BOUNDARY, BLOCKERS_ROUND2_NEGATIVES, BLOCKERS_ROUND2_POSITIVES } from '../src/data/productTruthMarketGrammarBlockersRound2.js';
import { parseAccountMarketIntent } from '../supabase/functions/chat-ai/marketIntentGrammar.ts';
import { classifyAccountMarketIntentKind } from '../supabase/functions/chat-ai/marketTruth.ts';

const OUT = process.argv[2] || 'evidence/product-truth/2026-09-24-grammar-blockers-live-matrix.json';
const TEST_REF = 'ljfizgrdyzxddswcedwr';
const envText = readFileSync('C:/tkrc-pt/.env.localtest.local', 'utf-8');
const envVar = (n) => { const m = envText.match(new RegExp(`^${n}=(.*)$`, 'm')); if (!m) throw new Error(`missing env var ${n}`); return m[1].trim(); };
const URL_ = envVar('VITE_SUPABASE_URL');
if (!URL_.includes(TEST_REF)) throw new Error('REFUSING: not the TEST project');
const ANON = envVar('VITE_SUPABASE_ANON_KEY');
const PASS = envVar('PROFLOW_TEST_PLAN_PERSONAS_PASSWORD');
const PERSONAS = { LOCAL_PRO: 'PROFLOW_TEST_LOCAL_PRO_EMAIL', INTL_PRO: 'PROFLOW_TEST_INTL_PRO_EMAIL' };

function chatAiIdentity() {
  const out = execFileSync('npx', ['--no-install', 'supabase', 'functions', 'list', '--project-ref', TEST_REF, '-o', 'json'], { encoding: 'utf-8', shell: true, cwd: 'C:/tkrc-pt' });
  const parsed = JSON.parse(out);
  const fn = (Array.isArray(parsed) ? parsed : parsed.functions).find((f) => f.slug === 'chat-ai');
  if (!fn) throw new Error('chat-ai not found');
  return { readAtUtc: new Date().toISOString(), version: fn.version, updatedAtUtc: new Date(fn.updated_at).toISOString(), ezbrSha256: fn.ezbr_sha256, status: fn.status, functionId: fn.id };
}
const login = async (emailVar) => (await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON }, body: JSON.stringify({ email: envVar(emailVar), password: PASS }) })).json()).access_token;
const serverFacts = async (token) => {
  const uid = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
  const r = await (await fetch(`${URL_}/rest/v1/business_settings?select=plan,role,country&user_id=eq.${uid}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })).json();
  return { serverPlan: r[0]?.plan ?? null, serverRole: r[0]?.role ?? null, serverMarket: r[0]?.country ?? null };
};
const ask = async (token, prompt, isHebrew) => {
  const res = await fetch(`${URL_}/functions/v1/chat-ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], isHebrew, isDashboard: true }) });
  const j = await res.json().catch(() => ({}));
  return { http: res.status, answerSource: j.answerSource ?? null, answer: String(j.answer ?? ''), factPayload: j.factPayload ?? null };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasHebrew = (t) => /[\u05d0-\u05ea]/.test(t);
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_x, k) => vars[k]);
const personaFor = (prompt) => (hasHebrew(prompt) ? 'LOCAL_PRO' : 'INTL_PRO');

const before = chatAiIdentity();
const tokens = { LOCAL_PRO: await login(PERSONAS.LOCAL_PRO), INTL_PRO: await login(PERSONAS.INTL_PRO) };
const facts = { LOCAL_PRO: await serverFacts(tokens.LOCAL_PRO), INTL_PRO: await serverFacts(tokens.INTL_PRO) };
const EXPECT = { LOCAL_PRO: { accountMarket: 'LOCAL', currencyScope: 'ILS', serverMarket: 'Local' }, INTL_PRO: { accountMarket: 'INTERNATIONAL', currencyScope: 'MULTI', serverMarket: 'International' } };

async function routed(prompt, extra = {}) {
  const persona = personaFor(prompt); const lang = persona === 'LOCAL_PRO' ? 'he' : 'en';
  const c = await ask(tokens[persona], prompt, lang === 'he');
  const p = c.factPayload; const exp = EXPECT[persona];
  const structured = p ? checkFactPayloadAgainstCanonical(p, 'account_market_sentinel', facts[persona]) : ['route:no_structured_payload_(free_form)'];
  const prose = p ? checkProseAgainstPayload(p, c.answer, lang) : [];
  const payloadOk = !!p && p.kind === 'product_truth' && p.truthStatus === 'ACCOUNT_MARKET' && p.claimScope === 'ACCOUNT' && p.marketScope === 'ACCOUNT'
    && p.accountMarket === exp.accountMarket && p.currencyScope === exp.currencyScope && facts[persona].serverMarket === exp.serverMarket;
  const wide = findProductWideCurrencyClaims(c.answer);
  const leak = persona === 'LOCAL_PRO' ? /USD|EUR|GBP|\$|€|£|דולר|יורו/.test(c.answer) : /₪|ILS|shekel|NIS|שקל/i.test(c.answer);
  await sleep(150);
  const ok = c.http === 200 && c.answerSource === 'deterministic' && payloadOk && structured.length === 0 && prose.length === 0 && wide.length === 0 && !leak && (lang === 'he' ? hasHebrew(c.answer) : !hasHebrew(c.answer));
  return { ...extra, persona, lang, prompt, http: c.http, answerSource: c.answerSource, hasPayload: p !== null, payload: p, structuredViolations: structured, proseViolations: prose,
    payloadOk, productWideCurrencyClaims: wide, marketLeakInProse: leak, kind: classifyAccountMarketIntentKind(prompt),
    normalized: parseAccountMarketIntent(prompt).clauses.map((x) => ({ relation: x.relation, subject: x.subject, number: x.subjectNumber, targetMarket: x.targetMarket ?? null, targetCurrency: x.targetCurrency ?? null, modality: x.modality, polarity: x.polarity })),
    ok, answerHead: c.answer.slice(0, 100) };
}
const runAll = async (label, items) => { const rows = []; for (const it of items) rows.push(await routed(it.prompt, it.extra ?? {})); console.log(`${label}: ${rows.filter((r) => r.ok).length}/${rows.length}`); return rows; };
const plain = (prompts, section) => prompts.map((prompt) => ({ prompt, extra: { section } }));
/** up to `per` evenly spaced cases of every sub-class */
function stratified(cases, per, keyOf = (c) => c.klass) {
  const by = new Map(); for (const c of cases) { const k = keyOf(c); if (!by.has(k)) by.set(k, []); by.get(k).push(c); }
  const out = [];
  for (const [k, list] of by) { const step = Math.max(1, Math.floor(list.length / per)); for (let i = 0, n = 0; i < list.length && n < per; i += step, n += 1) out.push({ prompt: list[i].prompt, extra: { klass: k, sep: list[i].sep ?? null } }); }
  return out;
}

// (1) regression sets
const sReg = {
  originalMatrix: await runAll('original locked matrix', plain(MARKET_ROUTING_MATRIX.map((r) => r.prompt), 'original_matrix')),
  selfBreakTest: await runAll('self break-test', plain(SELF_BREAK_TEST.positives, 'self_break_test')),
  microGaps: await runAll('micro Codex gaps', plain(MICRO_CODEX_GAPS.map((g) => g.prompt), 'micro_gap')),
  microUnseen: await runAll('micro unseen', plain([...MICRO_UNSEEN_PARAPHRASES.he, ...MICRO_UNSEEN_PARAPHRASES.en], 'micro_unseen')),
};
const hePrefix = []; { const { nouns, prefixes, templates, marketTemplates, marketPrefixes } = HEBREW_PREFIX_CLASS;
  for (const n of nouns) for (const pre of prefixes) for (const tpls of Object.values(templates)) hePrefix.push(fill(tpls[0], { X: `${pre}${n}` }));
  for (const pre of marketPrefixes) for (const t of marketTemplates) hePrefix.push(fill(t, { L: pre })); }
const enPlural = []; { const { nouns, markets, templates } = ENGLISH_PLURAL_IDENTITY_CLASS;
  for (const n of nouns) for (const m of markets) for (const tpls of Object.values(templates)) enPlural.push(fill(tpls[0], { a: 'truly ', m, n }).replace(/\s+/g, ' ')); }
sReg.hebrewPrefixClass = await runAll('Hebrew prefix class', plain(hePrefix, 'hebrew_prefix_class'));
sReg.englishPluralClass = await runAll('English plural class', plain(enPlural, 'english_plural_class'));
// (2) the six Codex findings
const sCodex = await runAll('Codex findings', GRAMMAR_CODEX_FINDINGS.map((f) => ({ prompt: f.prompt, extra: { section: 'codex_finding', id: f.id } })));
// (3) compositional property classes, sampled per sub-class (class D: every separator, both orders)
const A = englishIdentityGrammarCases(); const B = hebrewRelationshipGrammarCases(); const C = overrideGrammarCases(); const D = clauseCompositionCases();
const sProp = {
  A: await runAll('class A english identity', stratified(A, 8).map((x) => ({ ...x, extra: { ...x.extra, section: 'class_A' } }))),
  B: await runAll('class B hebrew relationship', stratified(B, 8).map((x) => ({ ...x, extra: { ...x.extra, section: 'class_B' } }))),
  C: await runAll('class C override / simulation', stratified(C, 8).map((x) => ({ ...x, extra: { ...x.extra, section: 'class_C' } }))),
  D: await runAll('class D clause composition', stratified(D, 8, (c) => `${c.sep}`).map((x) => ({ ...x, extra: { ...x.extra, section: 'class_D' } }))),
};
// (4) fresh unseen sets + second adversarial round
const sUnseen = {
  he: await runAll('unseen HE', plain(GRAMMAR_UNSEEN_HE, 'unseen_he')),
  en: await runAll('unseen EN', plain(GRAMMAR_UNSEEN_EN, 'unseen_en')),
  cross: await runAll('unseen cross-class', plain(GRAMMAR_UNSEEN_CROSS, 'unseen_cross')),
  round2: await runAll('adversarial round 2', plain(GRAMMAR_ROUND2_POSITIVES, 'round2')),
};
// (4b) the TWO remaining blockers: in-domain positives (Hebrew prefix + currency symbol; SELF-proven person nouns and SELF currency requests) must still route
const symbolCases = symbolPrefixCases(); const selfCases = selfCurrencyPositives();
const sBlockers = {
  codexBlocker2: await runAll('Codex blocker-2 positive', [{ prompt: BLOCKER2_CODEX_POSITIVE, extra: { section: 'blocker2_codex' } }]),
  symbolPrefix: await runAll('symbol prefix class', stratified(symbolCases, 9).map((x) => ({ ...x, extra: { ...x.extra, section: 'blocker2_symbol_class' } }))),
  selfCurrency: await runAll('self / self-proven currency positives', stratified(selfCases, 9).map((x) => ({ ...x, extra: { ...x.extra, section: 'blocker1_self_positives' } }))),
  round2Positives: await runAll('blockers adversarial round positives', plain(BLOCKERS_ROUND2_POSITIVES, 'blockers_round2_positives')),
};
// (5) negative controls - must NOT come back as the ACCOUNT_MARKET route
const thirdEn = thirdPartyDisplayNegativesEn(); const thirdHe = thirdPartyDisplayNegativesHe();
const thirdSample = [...stratified(thirdEn, 8), ...stratified(thirdHe, 8)].map((x) => x.prompt);
const negPrompts = [...new Set([...BLOCKER1_CODEX_NEGATIVES, ...thirdSample, ...BLOCKERS_ROUND2_NEGATIVES, ...BLOCKERS_ROUND2_KNOWN_BOUNDARY, ...symbolWithNumberNegatives().map((c) => c.prompt), ...MARKET_ROUTING_NEGATIVE_CONTROLS, ...SELF_BREAK_TEST.negatives, ...MICRO_NEGATIVE_CONTROLS, ...GRAMMAR_NEGATIVE_CONTROLS, ...GRAMMAR_ROUND2_NEGATIVES])];
const negatives = [];
for (const prompt of negPrompts) {
  const persona = personaFor(prompt);
  const c = await ask(tokens[persona], prompt, persona === 'LOCAL_PRO');
  negatives.push({ persona, prompt, http: c.http, answerSource: c.answerSource, payloadTruthStatus: c.factPayload?.truthStatus ?? null, overRouted: c.factPayload?.truthStatus === 'ACCOUNT_MARKET',
    classifierSaysAccountIntent: classifyAccountMarketIntentKind(prompt) !== null, answerHead: c.answer.slice(0, 100) });
  await sleep(150);
}
console.log(`negative controls over-routed: ${negatives.filter((n) => n.overRouted).length}/${negatives.length}`);

const after = chatAiIdentity();
if (before.version !== after.version || before.ezbrSha256 !== after.ezbrSha256) throw new Error(`REFUSING: chat-ai changed mid-run (${before.version} -> ${after.version})`);
// stability of the six Codex negatives: each asked 5 more times (a third-party request must never flip onto the account route)
const stability = [];
for (const prompt of BLOCKER1_CODEX_NEGATIVES) for (let i = 0; i < 5; i += 1) {
  const persona = personaFor(prompt); const c = await ask(tokens[persona], prompt, persona === 'LOCAL_PRO');
  stability.push({ prompt, run: i + 1, persona, answerSource: c.answerSource, payloadTruthStatus: c.factPayload?.truthStatus ?? null, overRouted: c.factPayload?.truthStatus === 'ACCOUNT_MARKET' });
  await sleep(150);
}
console.log(`Codex negative stability over-routed: ${stability.filter((x) => x.overRouted).length}/${stability.length}`);
const groups = { regression: sReg, codexFindings: { all: sCodex }, propertyClasses: sProp, unseen: sUnseen, blockers: sBlockers };
const sec = (rows) => ({ prompts: rows.length, deterministicAccountMarketRoute: rows.filter((r) => r.ok).length, failing: rows.filter((r) => !r.ok).map((r) => r.prompt) });
const summary = { capturedAtUtc: new Date().toISOString(), testProjectRef: TEST_REF, chatAi: { before, after }, serverFacts: facts, sections: {} };
const genuine = [];
for (const [g, sets] of Object.entries(groups)) { summary.sections[g] = {}; for (const [k, rows] of Object.entries(sets)) { summary.sections[g][k] = sec(rows); genuine.push(...rows); } }
summary.propertyClassSampleSizes = { A: { population: A.length, sampled: sProp.A.length }, B: { population: B.length, sampled: sProp.B.length }, C: { population: C.length, sampled: sProp.C.length }, D: { population: D.length, sampled: sProp.D.length } };
summary.compositionSeparatorsCovered = [...new Set(sProp.D.map((r) => r.sep))].length;
summary.blockerSampleSizes = { symbolPrefixPopulation: symbolCases.length, symbolPrefixSampled: sBlockers.symbolPrefix.length, selfPositivesPopulation: selfCases.length, selfPositivesSampled: sBlockers.selfCurrency.length, thirdPartyEnPopulation: thirdEn.length, thirdPartyHePopulation: thirdHe.length, thirdPartySampled: thirdSample.length };
summary.codexNegativeStability = { asked: stability.length, overRouted: stability.filter((x) => x.overRouted).length };
summary.unseenSizes = { he: GRAMMAR_UNSEEN_HE.length, en: GRAMMAR_UNSEEN_EN.length, cross: GRAMMAR_UNSEEN_CROSS.length, round2: GRAMMAR_ROUND2_POSITIVES.length };
summary.genuineIntentsTotal = genuine.length;
summary.freeFormLeakCount = genuine.filter((r) => !r.hasPayload).length; summary.freeFormLeaks = genuine.filter((r) => !r.hasPayload).map((r) => r.prompt);
summary.negativeControls = { prompts: negatives.length, overRoutedToAccountMarket: negatives.filter((n) => n.overRouted).map((n) => n.prompt), classifierDisagreesWithLive: negatives.filter((n) => n.overRouted !== n.classifierSaysAccountIntent).map((n) => n.prompt) };
summary.gate = genuine.every((r) => r.ok) && summary.codexNegativeStability.overRouted === 0 && summary.freeFormLeakCount === 0 && summary.negativeControls.overRoutedToAccountMarket.length === 0 ? 'PASS' : 'FAIL';
writeFileSync(OUT, JSON.stringify({ summary, rows: Object.fromEntries(Object.entries(groups).map(([g, sets]) => [g, sets])), negatives, stability }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
