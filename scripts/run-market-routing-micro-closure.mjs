// MARKET / CURRENCY ROUTING MICRO-CLOSURE - LIVE TEST CAPTURE (Hebrew attached prefixes + English plural identity nouns).
//
// Against the currently deployed TEST chat-ai, as the synthetic persona that owns each prompt's language (HE: LOCAL_PRO - Local / ILS; EN: INTL_PRO -
// International), records for EVERY genuine account market / currency intent: route (answerSource), presence of the structured `factPayload`, the
// structured checks (product_truth / ACCOUNT_MARKET / ACCOUNT scope / accountMarket + currencyScope equal to the SERVER-verified market / equality with the
// canonical derivation), prose consistency, and the absence of any product-wide or cross-market currency claim.
// Sections: (1) the original locked matrix + self break-test (regression), (2) the two Codex gaps, (3) the Hebrew-prefix class (every noun x prefix, one
// template per frame), (4) the English plural-identity class (every noun-form x market, one template per frame), (5) the fresh unseen paraphrases,
// (6) every negative control (must NOT come back as ACCOUNT_MARKET). FREE-FORM LEAK = a genuine intent with `factPayload: null`. Required: 0.
// The chat-ai version is bracketed with read-only `supabase functions list` reads before AND after; the run is refused if it changed. Credentials come only
// from the Owner-authorized, gitignored C:/tkrc-pt/.env.localtest.local and are never printed.
//   usage: node scripts/run-market-routing-micro-closure.mjs [outJson]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { checkFactPayloadAgainstCanonical, checkProseAgainstPayload, findProductWideCurrencyClaims } from '../src/data/productTruthFactPayload.js';
import {
  ENGLISH_PLURAL_IDENTITY_CLASS, FRAME_ALLOWED_KINDS, HEBREW_PREFIX_CLASS, MARKET_ROUTING_MATRIX, MARKET_ROUTING_NEGATIVE_CONTROLS, MICRO_CODEX_GAPS,
  MICRO_NEGATIVE_CONTROLS, MICRO_UNSEEN_FIRST_PASS, MICRO_UNSEEN_PARAPHRASES, SELF_BREAK_TEST,
} from '../src/data/productTruthMarketRoutingMatrix.js';
import { classifyAccountMarketIntentKind } from '../supabase/functions/chat-ai/marketTruth.ts';

const OUT = process.argv[2] || 'evidence/product-truth/2026-09-24-micro-closure-live-matrix.json';
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
  await sleep(200);
  const ok = c.http === 200 && c.answerSource === 'deterministic' && payloadOk && structured.length === 0 && prose.length === 0 && wide.length === 0 && !leak && (lang === 'he' ? hasHebrew(c.answer) : !hasHebrew(c.answer));
  return { ...extra, persona, lang, prompt, http: c.http, answerSource: c.answerSource, hasPayload: p !== null, payload: p, structuredViolations: structured, proseViolations: prose,
    payloadOk, productWideCurrencyClaims: wide, marketLeakInProse: leak, predictedKind: classifyAccountMarketIntentKind(prompt), ok, answerHead: c.answer.slice(0, 120) };
}
const runAll = async (label, prompts, extraFor) => { const rows = []; for (const prompt of prompts) rows.push(await routed(prompt, extraFor(prompt))); console.log(`${label}: ${rows.filter((r) => r.ok).length}/${rows.length}`); return rows; };

// (1) regression: the original locked matrix (38) + the self break-test positives (35)
const matrixRows = await runAll('original locked matrix', MARKET_ROUTING_MATRIX.map((r) => r.prompt), (p) => ({ section: 'original_matrix', family: MARKET_ROUTING_MATRIX.find((r) => r.prompt === p).family }));
const selfRows = await runAll('self break-test positives', SELF_BREAK_TEST.positives, () => ({ section: 'self_break_test' }));
// (2) the two Codex gaps
const gapRows = await runAll('Codex gaps', MICRO_CODEX_GAPS.map((g) => g.prompt), (p) => ({ section: 'codex_gap', family: MICRO_CODEX_GAPS.find((g) => g.prompt === p).family }));
// (3) Hebrew prefix class: every noun x prefix, ONE template per frame (the full template set is the unit-test property proof)
const hePrefixPrompts = [];
{
  const { nouns, prefixes, templates, marketTemplates, marketPrefixes } = HEBREW_PREFIX_CLASS;
  for (const noun of nouns) for (const prefix of prefixes) for (const [family, tpls] of Object.entries(templates)) hePrefixPrompts.push({ family, noun, prefix, prompt: fill(tpls[0], { X: `${prefix}${noun}` }) });
  for (const prefix of marketPrefixes) for (const tpl of marketTemplates) hePrefixPrompts.push({ family: 'market', noun: 'חשבון', prefix, prompt: fill(tpl, { L: prefix }) });
}
const hePrefixRows = await runAll('Hebrew prefix class', hePrefixPrompts.map((c) => c.prompt), (p) => ({ section: 'hebrew_prefix_class', ...hePrefixPrompts.find((c) => c.prompt === p) }));
// (4) English plural identity class: every noun-form x market, ONE template per frame
const enPluralPrompts = [];
{
  const { nouns, markets, templates } = ENGLISH_PLURAL_IDENTITY_CLASS;
  for (const n of nouns) for (const m of markets) for (const [family, tpls] of Object.entries(templates)) enPluralPrompts.push({ family, noun: n, market: m, prompt: fill(tpls[0], { a: 'truly ', m, n }).replace(/\s+/g, ' ') });
}
const enPluralRows = await runAll('English plural class', enPluralPrompts.map((c) => c.prompt), (p) => ({ section: 'english_plural_class', ...enPluralPrompts.find((c) => c.prompt === p) }));
// (5) fresh unseen paraphrases
const unseenRows = await runAll('unseen paraphrases', [...MICRO_UNSEEN_PARAPHRASES.he, ...MICRO_UNSEEN_PARAPHRASES.en], () => ({ section: 'unseen' }));
// (6) negative controls - must NOT come back as the ACCOUNT_MARKET route
const negatives = [];
for (const prompt of [...MARKET_ROUTING_NEGATIVE_CONTROLS, ...SELF_BREAK_TEST.negatives, ...MICRO_NEGATIVE_CONTROLS]) {
  const persona = personaFor(prompt);
  const c = await ask(tokens[persona], prompt, persona === 'LOCAL_PRO');
  negatives.push({ persona, prompt, http: c.http, answerSource: c.answerSource, payloadTruthStatus: c.factPayload?.truthStatus ?? null, overRouted: c.factPayload?.truthStatus === 'ACCOUNT_MARKET',
    classifierSaysAccountIntent: classifyAccountMarketIntentKind(prompt) !== null, answerHead: c.answer.slice(0, 120) });
  await sleep(200);
}
console.log(`negative controls over-routed: ${negatives.filter((n) => n.overRouted).length}/${negatives.length}`);

const after = chatAiIdentity();
if (before.version !== after.version || before.ezbrSha256 !== after.ezbrSha256) throw new Error(`REFUSING: chat-ai changed mid-run (${before.version} -> ${after.version})`);
const genuine = [...matrixRows, ...selfRows, ...gapRows, ...hePrefixRows, ...enPluralRows, ...unseenRows];
const sec = (rows) => ({ prompts: rows.length, deterministicAccountMarketRoute: rows.filter((r) => r.ok).length, failing: rows.filter((r) => !r.ok).map((r) => r.prompt) });
const summary = {
  capturedAtUtc: new Date().toISOString(), testProjectRef: TEST_REF, chatAi: { before, after }, serverFacts: facts,
  originalMatrix: { ...sec(matrixRows), kindsOk: matrixRows.every((r) => FRAME_ALLOWED_KINDS[r.family].includes(r.predictedKind)) },
  selfBreakTest: sec(selfRows), codexGaps: sec(gapRows), hebrewPrefixClass: { ...sec(hePrefixRows), nouns: HEBREW_PREFIX_CLASS.nouns.length, prefixes: HEBREW_PREFIX_CLASS.prefixes.length },
  englishPluralClass: { ...sec(enPluralRows), nounForms: ENGLISH_PLURAL_IDENTITY_CLASS.nouns.length, markets: ENGLISH_PLURAL_IDENTITY_CLASS.markets.length },
  unseenParaphrases: { ...sec(unseenRows), he: MICRO_UNSEEN_PARAPHRASES.he.length, en: MICRO_UNSEEN_PARAPHRASES.en.length, firstPassAtWriting: MICRO_UNSEEN_FIRST_PASS },
  genuineIntentsTotal: genuine.length, freeFormLeakCount: genuine.filter((r) => !r.hasPayload).length, freeFormLeaks: genuine.filter((r) => !r.hasPayload).map((r) => r.prompt),
  negativeControls: { prompts: negatives.length, overRoutedToAccountMarket: negatives.filter((n) => n.overRouted).map((n) => n.prompt), classifierDisagreesWithLive: negatives.filter((n) => n.overRouted !== n.classifierSaysAccountIntent).map((n) => n.prompt) },
};
summary.gate = genuine.every((r) => r.ok) && summary.freeFormLeakCount === 0 && summary.negativeControls.overRoutedToAccountMarket.length === 0 ? 'PASS' : 'FAIL';
writeFileSync(OUT, JSON.stringify({ summary, matrixRows, selfRows, gapRows, hePrefixRows, enPluralRows, unseenRows, negatives }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
