// ACCOUNT MARKET / CURRENCY ROUTING MATRIX - LIVE TEST CAPTURE (Product Truth market/currency routing closure).
//
// Asks the currently deployed TEST chat-ai EVERY prompt of the locked routing matrix (src/data/productTruthMarketRoutingMatrix.js) as the
// synthetic persona that owns its language (HE prompts: LOCAL_PRO - Local / ILS; EN prompts: INTL_PRO - International), and records, per call:
//   - the route taken (answerSource) and whether a structured `factPayload` came back;
//   - the payload's structured checks (kind product_truth, truthStatus ACCOUNT_MARKET, claimScope ACCOUNT, marketScope, currencyScope,
//     accountMarket vs the persona's SERVER-verified market, and equality with the canonical authority's own derivation);
//   - the prose's consistency with the payload and the absence of any product-wide / cross-market currency claim.
// Also asks every NEGATIVE control (they must NOT come back as an ACCOUNT_MARKET payload) and the Builder self break-test corpus.
// FREE-FORM LEAK = an account market / currency intent that came back with `factPayload: null` (free-form model prose). Required: 0.
//
// The chat-ai function version is bracketed with read-only `supabase functions list` reads before AND after, and the run is refused if it
// changed mid-run. Purely observational: creates only the ordinary chat_logs rows every chat message creates. Credentials come only from the
// Owner-authorized, gitignored C:/tkrc-pt/.env.localtest.local and are never printed.
//   usage: node scripts/run-market-routing-matrix.mjs [outJson]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { checkFactPayloadAgainstCanonical, checkProseAgainstPayload, findProductWideCurrencyClaims } from '../src/data/productTruthFactPayload.js';
import { FRAME_ALLOWED_KINDS, MARKET_ROUTING_MATRIX, MARKET_ROUTING_NEGATIVE_CONTROLS, SELF_BREAK_TEST } from '../src/data/productTruthMarketRoutingMatrix.js';
import { classifyAccountMarketIntentKind } from '../supabase/functions/chat-ai/marketTruth.ts';

const OUT = process.argv[2] || 'evidence/product-truth/2026-09-23-market-routing-live-matrix.json';
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

const before = chatAiIdentity();
const tokens = { LOCAL_PRO: await login(PERSONAS.LOCAL_PRO), INTL_PRO: await login(PERSONAS.INTL_PRO) };
const facts = { LOCAL_PRO: await serverFacts(tokens.LOCAL_PRO), INTL_PRO: await serverFacts(tokens.INTL_PRO) };
const EXPECT = { LOCAL_PRO: { accountMarket: 'LOCAL', currencyScope: 'ILS', serverMarket: 'Local' }, INTL_PRO: { accountMarket: 'INTERNATIONAL', currencyScope: 'MULTI', serverMarket: 'International' } };

async function routed(persona, prompt, lang, extra = {}) {
  const c = await ask(tokens[persona], prompt, lang === 'he');
  const p = c.factPayload;
  const structured = p ? checkFactPayloadAgainstCanonical(p, 'account_market_sentinel', facts[persona]) : ['route:no_structured_payload_(free_form)'];
  const prose = p ? checkProseAgainstPayload(p, c.answer, lang) : [];
  const exp = EXPECT[persona];
  const payloadOk = !!p && p.kind === 'product_truth' && p.truthStatus === 'ACCOUNT_MARKET' && p.claimScope === 'ACCOUNT' && p.marketScope === 'ACCOUNT'
    && p.accountMarket === exp.accountMarket && p.currencyScope === exp.currencyScope && facts[persona].serverMarket === exp.serverMarket;
  const wideClaims = findProductWideCurrencyClaims(c.answer);
  const marketLeak = persona === 'LOCAL_PRO' ? /USD|EUR|GBP|\$|€|£|דולר|יורו/.test(c.answer) : /₪|ILS|shekel|NIS|שקל/i.test(c.answer);
  const langOk = lang === 'he' ? hasHebrew(c.answer) : !hasHebrew(c.answer);
  await sleep(250);
  return { ...extra, persona, lang, prompt, http: c.http, answerSource: c.answerSource, hasPayload: p !== null, payload: p, structuredViolations: structured, proseViolations: prose,
    payloadOk, productWideCurrencyClaims: wideClaims, marketLeakInProse: marketLeak, languageOk: langOk, predictedKind: classifyAccountMarketIntentKind(prompt), answer: c.answer };
}

// (1) the locked routing matrix
const matrixRows = [];
for (const r of MARKET_ROUTING_MATRIX) matrixRows.push(await routed(r.persona, r.prompt, r.lang, { family: r.family }));
const okRow = (r) => r.http === 200 && r.answerSource === 'deterministic' && r.payloadOk && r.structuredViolations.length === 0 && r.proseViolations.length === 0
  && r.productWideCurrencyClaims.length === 0 && !r.marketLeakInProse && r.languageOk && FRAME_ALLOWED_KINDS[r.family].includes(r.predictedKind);

// (2) self break-test corpus (paraphrases written after the classifier) - same expectations
const selfPositive = [];
for (const prompt of SELF_BREAK_TEST.positives) {
  const lang = hasHebrew(prompt) ? 'he' : 'en';
  selfPositive.push(await routed(lang === 'he' ? 'LOCAL_PRO' : 'INTL_PRO', prompt, lang, { family: 'self_break_test' }));
}
const okSelf = (r) => r.http === 200 && r.answerSource === 'deterministic' && r.payloadOk && r.structuredViolations.length === 0 && r.proseViolations.length === 0
  && r.productWideCurrencyClaims.length === 0 && !r.marketLeakInProse && r.languageOk;

// (3) negative controls - must NOT come back as the ACCOUNT_MARKET route (they keep their own route: pricing block / capability router / model)
const negatives = [];
for (const prompt of [...MARKET_ROUTING_NEGATIVE_CONTROLS, ...SELF_BREAK_TEST.negatives]) {
  const lang = hasHebrew(prompt) ? 'he' : 'en';
  const persona = lang === 'he' ? 'LOCAL_PRO' : 'INTL_PRO';
  const c = await ask(tokens[persona], prompt, lang === 'he');
  negatives.push({ persona, lang, prompt, http: c.http, answerSource: c.answerSource, payloadTruthStatus: c.factPayload?.truthStatus ?? null,
    overRouted: c.factPayload?.truthStatus === 'ACCOUNT_MARKET', classifierSaysAccountIntent: classifyAccountMarketIntentKind(prompt) !== null,
    answerHead: c.answer.slice(0, 160) });
  await sleep(250);
}
const after = chatAiIdentity();
if (before.version !== after.version || before.ezbrSha256 !== after.ezbrSha256) throw new Error(`REFUSING: chat-ai changed mid-run (${before.version} -> ${after.version})`);

const freeFormLeaks = [...matrixRows, ...selfPositive].filter((r) => !r.hasPayload);
const summary = {
  capturedAtUtc: new Date().toISOString(), testProjectRef: TEST_REF, chatAi: { before, after }, serverFacts: facts,
  matrix: { prompts: matrixRows.length, byFrame: Object.fromEntries(Object.keys(FRAME_ALLOWED_KINDS).map((f) => [f, matrixRows.filter((r) => r.family === f).length])),
    deterministicAccountMarketRoute: matrixRows.filter(okRow).length, failing: matrixRows.filter((r) => !okRow(r)).map((r) => r.prompt),
    perPersona: { LOCAL_PRO_he: matrixRows.filter((r) => r.persona === 'LOCAL_PRO' && okRow(r)).length + '/' + matrixRows.filter((r) => r.persona === 'LOCAL_PRO').length,
      INTL_PRO_en: matrixRows.filter((r) => r.persona === 'INTL_PRO' && okRow(r)).length + '/' + matrixRows.filter((r) => r.persona === 'INTL_PRO').length } },
  selfBreakTestPositives: { prompts: selfPositive.length, deterministicAccountMarketRoute: selfPositive.filter(okSelf).length, failing: selfPositive.filter((r) => !okSelf(r)).map((r) => r.prompt) },
  freeFormLeakCount: freeFormLeaks.length, freeFormLeaks: freeFormLeaks.map((r) => r.prompt),
  negativeControls: { prompts: negatives.length, overRoutedToAccountMarket: negatives.filter((n) => n.overRouted).map((n) => n.prompt),
    classifierDisagreesWithLive: negatives.filter((n) => n.overRouted !== n.classifierSaysAccountIntent).map((n) => n.prompt) },
};
summary.gate = summary.matrix.failing.length === 0 && summary.selfBreakTestPositives.failing.length === 0 && summary.freeFormLeakCount === 0
  && summary.negativeControls.overRoutedToAccountMarket.length === 0 ? 'PASS' : 'FAIL';
writeFileSync(OUT, JSON.stringify({ summary, matrixRows, selfPositive, negatives }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
