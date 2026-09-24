// ACCOUNT / SYSTEM-SUBJECT CURRENCY QUESTION FRAME - LIVE TEST CAPTURE (Product Truth micro-delta).
// Against the currently deployed TEST chat-ai, as the synthetic persona that owns each prompt's language (HE: LOCAL_PRO - Local / ILS; EN: INTL_PRO - International):
// the four exact Codex questions + the new frame (sampled per sub-class) + paraphrases must route to a deterministic structured ACCOUNT_MARKET payload with the
// SERVER-verified market; the impersonal out-of-scope case (asked 6 times) and every negative control must NOT; targeted preservation samples must still route.
// The chat-ai version is bracketed with read-only `supabase functions list` reads before AND after. Credentials come only from the Owner-authorized, gitignored
// C:/tkrc-pt/.env.localtest.local and are never printed.
//   usage: node scripts/run-market-account-system-live.mjs [outJson]
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

const OUT = process.argv[2] || 'evidence/product-truth/2026-09-24-account-system-question-live-matrix.json';
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


import {
  ACCOUNT_SYSTEM_CODEX_QUESTIONS, ACCOUNT_SYSTEM_NEGATIVES, ACCOUNT_SYSTEM_OUT_OF_SCOPE, ACCOUNT_SYSTEM_PARAPHRASES, accountSystemQuestionPositivesEn, accountSystemQuestionPositivesHe,
} from '../src/data/productTruthMarketAccountSystemQuestion.js';

// (1) the four exact Codex questions + representative positives of the new frame (per sub-class) + paraphrases: must route to structured ACCOUNT_MARKET truth
const enPos = accountSystemQuestionPositivesEn(); const hePos = accountSystemQuestionPositivesHe();
const sFrame = {
  codexQuestions: await runAll('Codex account / system questions', ACCOUNT_SYSTEM_CODEX_QUESTIONS.map((q) => ({ prompt: q.prompt, extra: { section: 'codex_question' } }))),
  enClass: await runAll('EN frame class sample', stratified(enPos, 5).map((x) => ({ ...x, extra: { ...x.extra, section: 'frame_en' } }))),
  heClass: await runAll('HE frame class sample', stratified(hePos, 6).map((x) => ({ ...x, extra: { ...x.extra, section: 'frame_he' } }))),
  paraphrases: await runAll('paraphrases', plain(ACCOUNT_SYSTEM_PARAPHRASES, 'paraphrase')),
};
// (2) targeted PRESERVATION (positives): SELF positives, symbol-prefix cases, the Codex symbol case, market-forgery truth (original locked matrix), the grammar-closure findings
const symbolCases = symbolPrefixCases(); const selfCases = selfCurrencyPositives();
const sKeep = {
  originalMatrix: await runAll('original locked matrix (market-forgery truth)', plain(MARKET_ROUTING_MATRIX.map((r) => r.prompt), 'original_matrix')),
  codexFindings: await runAll('grammar-closure Codex findings', GRAMMAR_CODEX_FINDINGS.map((f) => ({ prompt: f.prompt, extra: { section: 'codex_finding', id: f.id } }))),
  symbol: await runAll('symbol-prefix class + Codex symbol case', [{ prompt: BLOCKER2_CODEX_POSITIVE, extra: { section: 'blocker2_codex' } }, ...stratified(symbolCases, 3).map((x) => ({ ...x, extra: { ...x.extra, section: 'symbol_class' } }))]),
  selfPositives: await runAll('SELF / SELF-proven positives', stratified(selfCases, 3).map((x) => ({ ...x, extra: { ...x.extra, section: 'self_positives' } }))),
};
// (3) NEGATIVES: the account / system negatives (incl. the impersonal out-of-scope case, asked 5 times), the six Codex negatives, a third-party sample, the earlier negatives - none may be ACCOUNT_MARKET
const thirdEn = thirdPartyDisplayNegativesEn(); const thirdHe = thirdPartyDisplayNegativesHe();
const thirdSample = [...stratified(thirdEn, 3), ...stratified(thirdHe, 3)].map((x) => x.prompt);
const negPrompts = [...new Set([...ACCOUNT_SYSTEM_NEGATIVES, ...ACCOUNT_SYSTEM_OUT_OF_SCOPE, ...BLOCKER1_CODEX_NEGATIVES, ...thirdSample, ...BLOCKERS_ROUND2_NEGATIVES, ...symbolWithNumberNegatives().map((c) => c.prompt), ...GRAMMAR_NEGATIVE_CONTROLS])];
const negatives = [];
for (const prompt of negPrompts) {
  const persona = personaFor(prompt);
  const c = await ask(tokens[persona], prompt, persona === 'LOCAL_PRO');
  negatives.push({ persona, prompt, http: c.http, answerSource: c.answerSource, payloadTruthStatus: c.factPayload?.truthStatus ?? null, overRouted: c.factPayload?.truthStatus === 'ACCOUNT_MARKET',
    classifierSaysAccountIntent: classifyAccountMarketIntentKind(prompt) !== null, answerHead: c.answer.slice(0, 100) });
  await sleep(150);
}
console.log(`negative controls over-routed: ${negatives.filter((n) => n.overRouted).length}/${negatives.length}`);
// stability: the out-of-scope impersonal case, asked 5 more times - it must never become a structured account route
const stability = [];
for (const prompt of ACCOUNT_SYSTEM_OUT_OF_SCOPE) for (let i = 0; i < 5; i += 1) {
  const persona = personaFor(prompt); const c = await ask(tokens[persona], prompt, persona === 'LOCAL_PRO');
  stability.push({ prompt, run: i + 1, persona, answerSource: c.answerSource, factPayloadPresent: c.factPayload !== null, payloadTruthStatus: c.factPayload?.truthStatus ?? null, overRouted: c.factPayload?.truthStatus === 'ACCOUNT_MARKET', answerHead: c.answer.slice(0, 200) });
  await sleep(150);
}
console.log(`out-of-scope stability over-routed: ${stability.filter((x) => x.overRouted).length}/${stability.length}`);

const after = chatAiIdentity();
if (before.version !== after.version || before.ezbrSha256 !== after.ezbrSha256) throw new Error(`REFUSING: chat-ai changed mid-run (${before.version} -> ${after.version})`);
const groups = { frame: sFrame, preservation: sKeep };
const sec = (rows) => ({ prompts: rows.length, deterministicAccountMarketRoute: rows.filter((r) => r.ok).length, failing: rows.filter((r) => !r.ok).map((r) => r.prompt) });
const summary = { capturedAtUtc: new Date().toISOString(), testProjectRef: TEST_REF, chatAi: { before, after }, serverFacts: facts, sections: {} };
const genuine = [];
for (const [g, sets] of Object.entries(groups)) { summary.sections[g] = {}; for (const [k, rows] of Object.entries(sets)) { summary.sections[g][k] = sec(rows); genuine.push(...rows); } }
summary.sampleSizes = { enPopulation: enPos.length, enSampled: sFrame.enClass.length, hePopulation: hePos.length, heSampled: sFrame.heClass.length, symbolPopulation: symbolCases.length, selfPopulation: selfCases.length, thirdPartySampled: thirdSample.length };
summary.genuineIntentsTotal = genuine.length;
summary.freeFormLeakCount = genuine.filter((r) => !r.hasPayload).length; summary.freeFormLeaks = genuine.filter((r) => !r.hasPayload).map((r) => r.prompt);
summary.negativeControls = { prompts: negatives.length, overRoutedToAccountMarket: negatives.filter((n) => n.overRouted).map((n) => n.prompt), classifierDisagreesWithLive: negatives.filter((n) => n.overRouted !== n.classifierSaysAccountIntent).map((n) => n.prompt) };
summary.outOfScopeStability = { asked: stability.length, overRouted: stability.filter((x) => x.overRouted).length };
summary.gate = genuine.every((r) => r.ok) && summary.freeFormLeakCount === 0 && summary.negativeControls.overRoutedToAccountMarket.length === 0 && summary.outOfScopeStability.overRouted === 0 ? 'PASS' : 'FAIL';
writeFileSync(OUT, JSON.stringify({ summary, rows: groups, negatives, stability }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
