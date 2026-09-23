// ACCOUNT MARKET / CURRENCY INTENT GRAMMAR - tests (Product Truth intent grammar normalization closure).
//   (1) the stages: normalization, clause segmentation, tokenization (Hebrew clitic morphology), normalized intent structure
//   (2) the six Codex findings, as normalized structures
//   (3) COMPOSITIONAL property classes A-D (5,000+ generated grammatical cases): English identity grammar, Hebrew relationship grammar,
//       override / simulation grammar, clause composition across every separator
//   (4) the CRM / third-party boundary (self identity vs somebody else's customers)
//   (5) the Builder's fresh unseen break-tests (30 HE / 30 EN / 20 cross-class) with their honest first-pass record, the second adversarial round
//   (6) >= 100 fresh negative controls across the required categories: OVER-ROUTING COUNT = 0
//   (7) the account-market law and the anti-patch structural guards
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  describeAccountMarketTokens, normalizeAccountMarketText, parseAccountMarketIntent, segmentSentences,
} from './marketIntentGrammar.ts';
import { classifyAccountMarketIntent, classifyAccountMarketIntentKind } from './marketTruth.ts';
import { buildAccountMarketFactPayload } from './productTruthPayload.ts';
import { validateProductTruthPayload } from '../_shared/productTruthContract.ts';
import {
  CODEX_PROVEN_BYPASSES, MARKET_ROUTING_MATRIX, MARKET_ROUTING_NEGATIVE_CONTROLS, MICRO_CODEX_GAPS, MICRO_NEGATIVE_CONTROLS, MICRO_UNSEEN_PARAPHRASES, SELF_BREAK_TEST,
} from '../../../src/data/productTruthMarketRoutingMatrix.js';
import {
  clauseCompositionCases, COMPOSITION_SEPARATORS, englishIdentityGrammarCases, GRAMMAR_CODEX_FINDINGS, hebrewRelationshipGrammarCases, overrideGrammarCases,
} from '../../../src/data/productTruthMarketGrammarMatrix.js';
import { GRAMMAR_NEGATIVE_CONTROLS, GRAMMAR_UNSEEN_CROSS, GRAMMAR_UNSEEN_EN, GRAMMAR_UNSEEN_HE } from '../../../src/data/productTruthMarketGrammarUnseen.js';
import { GRAMMAR_ROUND2_FIRST_PASS, GRAMMAR_ROUND2_NEGATIVES, GRAMMAR_ROUND2_POSITIVES } from '../../../src/data/productTruthMarketGrammarRound2.js';

const here = dirname(fileURLToPath(import.meta.url));
const intent = (t) => parseAccountMarketIntent(t).clauses;
const first = (t) => intent(t)[0];
const sig = (t) => [...new Set(intent(t).map((c) => `${c.relation}:${c.targetMarket ?? ''}:${c.targetCurrency ?? ''}`))].sort().join('|');

describe('(1) grammar stages', () => {
  it('normalization: case, Hebrew points, quote variants, every dash form becomes ONE clause boundary, Hebrew prefix + hyphen + Latin is split', () => {
    expect(normalizeAccountMarketText('  We ARE—set  it – now -- ok - fine ')).toBe('we are — set it — now — ok — fine');
    expect(normalizeAccountMarketText('המחירים ב-TEKANGO')).toBe('המחירים ב tekango');
    expect(normalizeAccountMarketText('בינלאומיְ')).toBe('בינלאומי');
    expect(normalizeAccountMarketText('non-israeli')).toBe('non-israeli');
  });
  it('segmentation: sentences split at . ; : ! ? and every dash; the question mark is remembered per sentence', () => {
    expect(segmentSentences(normalizeAccountMarketText('We are local, set it. Really? yes; ok: fine')).map((s) => s.text)).toEqual(['we are local, set it', 'really', 'yes', 'ok', 'fine']);
    expect(segmentSentences('is it ok?').map((s) => s.question)).toEqual([true]);
    for (const sep of COMPOSITION_SEPARATORS) expect(segmentSentences(normalizeAccountMarketText(`we are local${sep}set it`)).length, JSON.stringify(sep)).toBe(sep === ', ' ? 1 : 2);
  });
  it('tokenization: Hebrew clitic morphology reads prefixes ONCE around a bare stem, fewest prefixes first', () => {
    const tag = (t) => describeAccountMarketTokens(t)[0].map((x) => `${x.prefix}|${x.w}|${x.cats.join('+')}`);
    expect(tag('בדשבורד')).toEqual(['ב|בדשבורד|SURFACE']);
    expect(tag('מהחשבון')).toEqual(['מה|מהחשבון|ENTITY']);
    expect(tag('שהמחירים')).toEqual(['שה|שהמחירים|SURFACE']);
    expect(tag('כלקוחות')[0]).toContain('כ|כלקוחות|PERSON');
    // the fewest-prefix reading wins: "שלי" is the possessive, not ש + "לי"; "מחשבון" is the calculator, not מ + "חשבון"; "חשבונית" is an invoice, not an account
    expect(tag('שלי')).toEqual(['|שלי|POSS']);
    expect(tag('מחשבון')).toEqual(['|מחשבון|KNOW']);
    expect(tag('חשבונית')).toEqual(['|חשבונית|DOCN']);
  });
  it('tokenization: English contractions, plural derivation, multi-word units and quantified selves', () => {
    const cats = (t) => describeAccountMarketTokens(t)[0].map((x) => `${x.w}:${x.cats.join('+')}`);
    expect(cats("we're")).toEqual(['we:SELF', 'are:COP']);
    expect(cats('overseas customers')).toEqual(['overseas:MKT', 'customers:PERSON']);
    expect(cats('all of us')).toEqual(['us*:SELF']);
    expect(cats('every one of us')).toEqual(['us*:SELF']);
    expect(cats('the two of us')).toEqual(['us*:SELF']);
    expect(cats('belongs to')).toEqual(['belongs to:BELONG']);
    expect(cats('us dollars')).toEqual(['us dollars:CUR']);
  });
});

describe('(1b) normalized intent structure', () => {
  it('identity with an adverb inside the subject / copula', () => {
    expect(first('We really are overseas users.')).toMatchObject({ subject: 'SELF', subjectNumber: 'PLURAL', relation: 'IDENTITY', targetMarket: 'INTERNATIONAL', modality: 'ASSERTION', polarity: 'POSITIVE' });
  });
  it('quantified plural / singular subjects still resolve to SELF, not to an arbitrary noun', () => {
    expect(first('All of us are foreign clients.')).toMatchObject({ subject: 'SELF', subjectNumber: 'PLURAL', relation: 'IDENTITY', targetMarket: 'INTERNATIONAL' });
    expect(first('Every one of us is a local customer.')).toMatchObject({ subject: 'SELF', relation: 'IDENTITY', targetMarket: 'LOCAL' });
  });
  it('belongs-to-market relations normalize per owner (account / business / profile / self)', () => {
    expect(first('Our account belongs to the International market.')).toMatchObject({ subject: 'ACCOUNT', relation: 'BELONGS_TO_MARKET', targetMarket: 'INTERNATIONAL' });
    expect(first('Our business belongs to the local market.')).toMatchObject({ subject: 'BUSINESS', relation: 'BELONGS_TO_MARKET', targetMarket: 'LOCAL' });
    expect(first('This profile belongs to the overseas market.')).toMatchObject({ subject: 'PROFILE', relation: 'BELONGS_TO_MARKET', targetMarket: 'INTERNATIONAL' });
    expect(first('We belong to the foreign market.')).toMatchObject({ subject: 'SELF', relation: 'BELONGS_TO_MARKET', targetMarket: 'INTERNATIONAL' });
  });
  it('Hebrew: belongs-to question and plural override', () => {
    expect(first('האם העסק שלי שייך לשוק הבינלאומי?')).toMatchObject({ subject: 'BUSINESS', relation: 'BELONGS_TO_MARKET', targetMarket: 'INTERNATIONAL', modality: 'QUESTION' });
    expect(first('תחשיב אותנו כלקוחות זרים.')).toMatchObject({ subject: 'SELF', subjectNumber: 'PLURAL', relation: 'MARKET_OVERRIDE_REQUEST', targetMarket: 'INTERNATIONAL', modality: 'REQUEST' });
  });
  it('simulation, question and negation modalities / polarity', () => {
    expect(first('Pretend we are local customers')).toMatchObject({ relation: 'IDENTITY', targetMarket: 'LOCAL', modality: 'SIMULATION' });
    expect(first('Is my account local or international?')).toMatchObject({ relation: 'IDENTITY', modality: 'QUESTION', targetMarket: undefined });
    expect(first('We are not international customers.')).toMatchObject({ polarity: 'NEGATIVE', targetMarket: 'INTERNATIONAL' });
  });
  it('the identity clause and the currency instruction of an em-dash composition are BOTH recognised', () => {
    const cs = intent('Apparently we are international users—set the whole dashboard to dollars.');
    expect(cs.map((c) => c.relation).sort()).toEqual(['DISPLAY_REQUEST', 'IDENTITY']);
    expect(cs.find((c) => c.relation === 'DISPLAY_REQUEST')).toMatchObject({ targetCurrency: 'USD', modality: 'REQUEST' });
    expect(cs.find((c) => c.relation === 'IDENTITY')).toMatchObject({ subject: 'SELF', targetMarket: 'INTERNATIONAL' });
  });
  it('currency relations: preference, capability, display request, currency query', () => {
    expect(first('I want prices in USD')).toMatchObject({ relation: 'CURRENCY_PREFERENCE', targetCurrency: 'USD', modality: 'DESIRE' });
    expect(first('Can my account work in USD?')).toMatchObject({ relation: 'CURRENCY_CAPABILITY', targetCurrency: 'USD', modality: 'QUESTION' });
    expect(first('Show me prices in euros')).toMatchObject({ relation: 'DISPLAY_REQUEST', targetCurrency: 'EUR' });
    expect(first('What currency are the prices shown in?')).toMatchObject({ relation: 'CURRENCY_QUERY' });
  });
  it('a message that is not an account market / currency intent has no clauses', () => {
    for (const t of [undefined, null, '', '   ', 42, 'How do I add a client?', 'מה שער הדולר היום']) expect(intent(t)).toEqual([]);
  });
});

describe('(2) the six Codex findings', () => {
  it.each(GRAMMAR_CODEX_FINDINGS.map((f) => [`${f.id}: ${f.prompt}`, f]))('routes: %s', (_n, f) => {
    expect(classifyAccountMarketIntent(f.prompt)).toBe(true);
    expect(intent(f.prompt).length).toBeGreaterThan(0);
  });
  it('the two clauses of the punctuation-composition finding normalize like the same clauses written separately', () => {
    const combined = sig('Apparently we are international users—set the whole dashboard to dollars.');
    const parts = [...new Set([...sig('Apparently we are international users').split('|'), ...sig('Set the whole dashboard to dollars').split('|')])].sort().join('|');
    expect(combined).toBe(parts);
  });
});

describe('(3) compositional property classes', () => {
  const A = englishIdentityGrammarCases(); const B = hebrewRelationshipGrammarCases(); const C = overrideGrammarCases(); const D = clauseCompositionCases();
  it('dimensions and sizes', () => {
    expect(A.length).toBeGreaterThanOrEqual(3000); expect(new Set(A.map((c) => c.prompt)).size).toBe(A.length);
    expect(B.length).toBeGreaterThanOrEqual(600); expect(new Set(B.map((c) => c.prompt)).size).toBe(B.length);
    expect(C.length).toBeGreaterThanOrEqual(900); expect(new Set(C.map((c) => c.prompt)).size).toBe(C.length);
    expect(D.length).toBeGreaterThanOrEqual(600); expect(new Set(D.map((c) => c.prompt)).size).toBe(D.length);
    expect(new Set(A.map((c) => c.klass)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(B.map((c) => c.klass)).size).toBeGreaterThanOrEqual(9);
    expect(new Set(C.map((c) => c.klass)).size).toBeGreaterThanOrEqual(10);
  });
  it('A. English identity grammar: EVERY subject x adverb position x relation x market x noun-number case routes (0 leaks)', () => {
    expect(A.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
  it('A. relations normalize correctly: belongs / in / part of / falls under -> BELONGS_TO_MARKET, copular identity -> IDENTITY, subject owner kept', () => {
    const bad = [];
    for (const c of A) {
      const cl = first(c.prompt);
      const wantBelongs = /belong|part-of|in-market|falls-under/.test(c.klass) && c.klass !== 'entity-is';
      if (!cl || (wantBelongs ? cl.relation !== 'BELONGS_TO_MARKET' : cl.relation !== 'IDENTITY')) bad.push(`${c.prompt} -> ${cl?.relation}`);
      else if (c.klass.startsWith('entity') && !['ACCOUNT', 'BUSINESS', 'PROFILE'].includes(cl.subject)) bad.push(`${c.prompt} -> subject ${cl.subject}`);
      else if (c.klass.startsWith('self') && cl.subject !== 'SELF') bad.push(`${c.prompt} -> subject ${cl.subject}`);
    }
    expect(bad).toEqual([]);
  });
  it('A. the market word maps to the right canonical market', () => {
    const bad = A.filter((c) => { const m = first(c.prompt)?.targetMarket; const want = /\b(?:local)\b/.test(c.prompt.toLowerCase()) ? 'LOCAL' : 'INTERNATIONAL'; return m !== want; }).map((c) => c.prompt);
    expect(bad).toEqual([]);
  });
  it('B. Hebrew relationship grammar: EVERY subject x relation x market noun phrase x agreement case routes (0 leaks)', () => {
    expect(B.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
  });
  it('B. Hebrew relations normalize (belong / located / included -> BELONGS_TO_MARKET; nominal -> IDENTITY; question -> QUESTION)', () => {
    const bad = [];
    for (const c of B) {
      const cl = first(c.prompt);
      const rel = /he-(belong|located|included)/.test(c.klass) ? 'BELONGS_TO_MARKET' : 'IDENTITY';
      if (!cl || cl.relation !== rel) bad.push(`${c.prompt} -> ${cl?.relation}`);
      else if (c.klass.endsWith('question') && cl.modality !== 'QUESTION') bad.push(`${c.prompt} -> ${cl.modality}`);
    }
    expect(bad).toEqual([]);
  });
  it('C. override / simulation grammar: EVERY verb x self object x predicate case routes (0 leaks) with singular and plural predicates', () => {
    expect(C.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
    for (const c of C) {
      const cl = first(c.prompt);
      if (/simulation/.test(c.klass)) expect(['SIMULATION'], c.prompt).toContain(cl.modality);
      else expect(cl.relation, c.prompt).toBe('MARKET_OVERRIDE_REQUEST');
    }
  });
  it('C. plural predicates are recognised as plural, singular predicates as singular (number normalization)', () => {
    expect(first('Treat us as international users').subjectNumber).toBe('PLURAL');
    expect(first('Treat me as an international user').subjectNumber).not.toBe('PLURAL');
    expect(first('תחשיב אותנו כלקוחות זרים').subjectNumber).toBe('PLURAL');
    expect(first('תחשיב אותי כלקוח זר').subjectNumber).not.toBe('PLURAL');
  });
  it('D. clause composition: EVERY identity + currency pair joined by EVERY separator, in BOTH orders, routes', () => {
    expect(D.filter((c) => !classifyAccountMarketIntent(c.prompt)).map((c) => c.prompt)).toEqual([]);
    expect(new Set(D.map((c) => c.sep)).size).toBe(COMPOSITION_SEPARATORS.length);
  });
  it('D. semantically equivalent compositions normalize EQUIVALENTLY across all separators and both orders', () => {
    const groups = new Map();
    for (const c of D) { const key = `${c.lang}|${c.a}|${c.b}`; const s = sig(c.prompt); if (!groups.has(key)) groups.set(key, new Set()); groups.get(key).add(s); }
    const divergent = [...groups.entries()].filter(([, v]) => v.size !== 1).map(([k, v]) => `${k} => ${[...v].join(' / ')}`);
    expect(divergent).toEqual([]);
  });
  it('D. each composed message yields BOTH an identity / belongs clause and a currency clause', () => {
    for (const c of D) {
      const rels = intent(c.prompt).map((x) => x.relation);
      expect(rels.some((r) => r === 'IDENTITY' || r === 'BELONGS_TO_MARKET'), c.prompt).toBe(true);
      expect(rels.some((r) => ['DISPLAY_REQUEST', 'CURRENCY_PREFERENCE', 'CURRENCY_CAPABILITY'].includes(r)), c.prompt).toBe(true);
    }
  });
});

describe('(4) CRM / third-party boundary: SELF / ACCOUNT identity vs somebody else\'s customers', () => {
  const PAIRS = [
    ['We are overseas customers.', 'Add overseas customers.'], ['We are international users.', 'Filter international users.'], ['We are foreign clients.', 'Show foreign customers.'],
    ['All of us are local clients.', 'Mark my clients as local customers.'], ['Treat us as overseas users.', 'Treat my clients as overseas users.'],
    ['Our account belongs to the local market.', 'Our customers belong to the local market.'], ['We belong to the foreign market.', 'Show customers who belong to the foreign market.'],
    ['אנחנו לקוחות בינלאומיים', 'תציג לי לקוחות בינלאומיים'], ['תחשיב אותנו כלקוחות זרים', 'תסמן את הלקוחות שלי כלקוחות מקומיים'], ['החשבון שלי שייך לשוק הזר', 'הלקוחות שלי שייכים לשוק הזר'],
    ['אני משתמש בינלאומי', 'איך אני מוסיף משתמש בינלאומי?'],
  ];
  it.each(PAIRS.map((p) => [`${p[0]}  vs  ${p[1]}`, p]))('self identity routes, the CRM look-alike does not: %s', (_n, [self, crm]) => {
    expect(classifyAccountMarketIntent(self)).toBe(true);
    expect(classifyAccountMarketIntent(crm)).toBe(false);
  });
  it('a currency for a customer\'s own quote is not the account currency (English and Hebrew)', () => {
    for (const p of ['I want to bill my clients in USD', 'Set the quote currency for this client to USD', 'Show my customer the prices in pounds', 'הלקוח הזה משלם ביורו', 'תגדיר את מטבע ההצעה של הלקוח הזה לדולר']) expect(classifyAccountMarketIntent(p), p).toBe(false);
    // ... while the same currency wishes for the ACCOUNT route
    for (const p of ['I want prices in USD', 'Show me prices in euros', 'אני רוצה לראות מחירים בדולר']) expect(classifyAccountMarketIntent(p), p).toBe(true);
  });
  it('an identity claim is never made by a third-party subject: only I / we / quantified self / an owned account can be the subject', () => {
    for (const p of ['My clients are international users.', 'Our customers are all overseas.', 'The clients are overseas users', 'הלקוחות שלנו כולם בינלאומיים', 'הלקוחות שייכים לשוק הזר']) expect(intent(p), p).toEqual([]);
  });
});

describe('(5) the Builder\'s fresh unseen break-tests (written after the implementation, not used to design it)', () => {
  it('sizes: >= 30 HE, >= 30 EN, >= 20 cross-class', () => {
    expect(GRAMMAR_UNSEEN_HE.length).toBeGreaterThanOrEqual(30);
    expect(GRAMMAR_UNSEEN_EN.length).toBeGreaterThanOrEqual(30);
    expect(GRAMMAR_UNSEEN_CROSS.length).toBeGreaterThanOrEqual(20);
  });
  it.each([...GRAMMAR_UNSEEN_HE, ...GRAMMAR_UNSEEN_EN, ...GRAMMAR_UNSEEN_CROSS].map((p) => [p]))('routes: %s', (p) => { expect(classifyAccountMarketIntent(p)).toBe(true); });
  it('the cross-class set is genuinely composed: every item yields >= 1 normalized clause and the large majority yield >= 2 (identity + currency, question + wish, ...)', () => {
    for (const p of GRAMMAR_UNSEEN_CROSS) expect(intent(p).length, p).toBeGreaterThanOrEqual(1);
    expect(GRAMMAR_UNSEEN_CROSS.filter((p) => intent(p).length >= 2).length).toBeGreaterThanOrEqual(17);
  });
  it('second adversarial round: all positives route; its first-pass record (29 / 32) and the fixes are preserved', () => {
    for (const p of GRAMMAR_ROUND2_POSITIVES) expect(classifyAccountMarketIntent(p), p).toBe(true);
    expect(GRAMMAR_ROUND2_FIRST_PASS.positivesTotal).toBe(GRAMMAR_ROUND2_POSITIVES.length);
    expect(GRAMMAR_ROUND2_FIRST_PASS.positivesRouted + GRAMMAR_ROUND2_FIRST_PASS.missed.length).toBe(GRAMMAR_ROUND2_FIRST_PASS.positivesTotal);
    for (const m of GRAMMAR_ROUND2_FIRST_PASS.missed) expect(GRAMMAR_ROUND2_POSITIVES).toContain(m);
  });
});

describe('(6) negative controls: OVER-ROUTING COUNT = 0', () => {
  const ALL_NEG = [...GRAMMAR_NEGATIVE_CONTROLS, ...GRAMMAR_ROUND2_NEGATIVES, ...MARKET_ROUTING_NEGATIVE_CONTROLS, ...SELF_BREAK_TEST.negatives, ...MICRO_NEGATIVE_CONTROLS];
  it('>= 100 fresh negatives across the required categories, plus every earlier negative set', () => {
    expect(GRAMMAR_NEGATIVE_CONTROLS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(ALL_NEG).size).toBeGreaterThanOrEqual(240);
  });
  it('the OVER-ROUTING COUNT over every negative control is exactly 0', () => {
    const over = [...new Set(ALL_NEG)].filter((p) => classifyAccountMarketIntent(p));
    expect(over).toEqual([]);
    expect(over.length).toBe(0);
  });
  it('the required categories are each represented', () => {
    const has = (re) => GRAMMAR_NEGATIVE_CONTROLS.some((p) => re.test(p));
    for (const [label, re] of [['CRM', /customers|clients|לקוח/i], ['user management', /user|employee|colleague|משתמש/i], ['dashboard / widget', /widget|dashboard|דשבורד/i], ['charts', /chart|graph|plot|גרף|תרשים/i],
      ['quote creation', /quote|proposal|הצעה/i], ['invoice / accounting', /invoice|accounting|VAT|tax|חשבונית/i], ['calculator', /calculator|מחשבון/i], ['exchange rates', /rate|שער/i],
      ['banking', /bank|wire|loan|deposit|credit card|בנק|הלוואה|אשראי/i], ['generic currency knowledge', /currency|symbol|abbreviation|countries use|מדינות|מטבע/i], ['translation / spelling', /translate|spell|say dollars|איך אומרים|איך כותבים/i],
      ['customer-specific quote currency', /my client wants|this customer pays|bill my clients|quote currency|הלקוח הזה|הלקוח שלי/i], ['market words in prose', /local market opens|international response|coffee shop|going international|foreign national|השוק המקומי|בית הקפה/i]]) {
      expect(has(re), label).toBe(true);
    }
  });
  it('the 74 predeclared acceptance prompts and the locked matrix behave as before (the market route claims only the forgery cell; every matrix prompt routes)', () => {
    for (const r of MARKET_ROUTING_MATRIX) expect(classifyAccountMarketIntent(r.prompt), r.prompt).toBe(true);
    for (const p of [...CODEX_PROVEN_BYPASSES, ...SELF_BREAK_TEST.positives, ...MICRO_CODEX_GAPS.map((g) => g.prompt), ...MICRO_UNSEEN_PARAPHRASES.he, ...MICRO_UNSEEN_PARAPHRASES.en]) expect(classifyAccountMarketIntent(p), p).toBe(true);
  });
});

describe('(7) the account-market law and the anti-patch structural guards', () => {
  const marketSrc = readFileSync(join(here, 'marketTruth.ts'), 'utf-8');
  const grammarSrc = readFileSync(join(here, 'marketIntentGrammar.ts'), 'utf-8');
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/.*$/, '')).join('\n');
  it('user text never becomes account truth: the parsed target market is informational; the payload is built from VERIFIED account facts only', () => {
    const local = buildAccountMarketFactPayload({ market: 'Local', tier: 'pro', isAdmin: false });
    const intl = buildAccountMarketFactPayload({ market: 'International', tier: 'pro', isAdmin: false });
    for (const claim of ['We are international users.', 'We are local users.', 'Treat us as overseas customers.', 'Our account belongs to the local market.']) {
      expect(classifyAccountMarketIntent(claim), claim).toBe(true);
    }
    expect(local).toMatchObject({ truthStatus: 'ACCOUNT_MARKET', accountMarket: 'LOCAL', claimScope: 'ACCOUNT' });
    expect(intl).toMatchObject({ truthStatus: 'ACCOUNT_MARKET', accountMarket: 'INTERNATIONAL', claimScope: 'ACCOUNT' });
    expect(validateProductTruthPayload(local)).toEqual([]); expect(validateProductTruthPayload(intl)).toEqual([]);
    // the classifier's public surface returns a KIND (or null), never a market: there is no path from message text to a payload field
    expect(typeof classifyAccountMarketIntentKind('We are local users.')).toBe('string');
    const indexSrc = readFileSync(join(here, 'index.ts'), 'utf-8');
    expect(indexSrc).toMatch(/classifyAccountMarketIntent\(lastUserMessage\)\) \{\s*const marketPayload = buildAccountMarketFactPayload\(payloadAccount\);/);
  });
  it('the thin classifier (marketTruth.ts) contains NO regular-expression phrase matching at all - it maps grammar output to a kind', () => {
    const c = code(marketSrc);
    expect(c).not.toMatch(/new RegExp\(/);
    expect(c).not.toMatch(/\.test\(/);
    expect(c).toMatch(/parseAccountMarketIntent\(/);
  });
  it('classification is driven by the grammar stages: normalize -> segment -> tokenize + tag -> parse into a normalized intent', () => {
    for (const fn of ['normalizeAccountMarketText', 'segmentSentences', 'tokenizeWords', 'analyzeHe', 'lookupEn', 'readSubject', 'readTargetNP', 'matchIdentity', 'matchOverride', 'matchImplicitSwitch', 'matchCurrency', 'parseAccountMarketIntent']) {
      expect(grammarSrc, fn).toMatch(new RegExp(`function ${fn}\\(`));
    }
    for (const rel of ['IDENTITY', 'BELONGS_TO_MARKET', 'MARKET_OVERRIDE_REQUEST', 'CURRENCY_PREFERENCE', 'CURRENCY_CAPABILITY', 'DISPLAY_REQUEST']) expect(grammarSrc).toContain(`'${rel}'`);
  });
  it('the grammar carries no phrase table: no rule is a regex over a whole phrase (the only regex literals are character-class normalizers and word-shape guards)', () => {
    const c = code(grammarSrc);
    const regexLiterals = c.match(/\/(?![/*])(?:[^/\n\\]|\\.)+\/[gimsuy]*/g) ?? [];
    for (const re of regexLiterals) expect(re.length, re).toBeLessThan(80);
    expect((c.match(/new RegExp\(/g) ?? []).length).toBe(0);
  });
  it('none of the Codex / unseen / adversarial / negative strings is hardcoded in the classifier source (whole strings, either language)', () => {
    const source = `${marketSrc}\n${grammarSrc}`.toLowerCase();
    const strip = (p) => p.toLowerCase().replace(/[.?!]+$/, '');
    const all = [...GRAMMAR_CODEX_FINDINGS.map((f) => f.prompt), ...GRAMMAR_UNSEEN_HE, ...GRAMMAR_UNSEEN_EN, ...GRAMMAR_UNSEEN_CROSS, ...GRAMMAR_ROUND2_POSITIVES, ...GRAMMAR_ROUND2_NEGATIVES,
      ...GRAMMAR_NEGATIVE_CONTROLS, ...MARKET_ROUTING_MATRIX.map((r) => r.prompt), ...CODEX_PROVEN_BYPASSES, ...SELF_BREAK_TEST.positives, ...SELF_BREAK_TEST.negatives, ...MICRO_CODEX_GAPS.map((g) => g.prompt),
      ...MICRO_UNSEEN_PARAPHRASES.he, ...MICRO_UNSEEN_PARAPHRASES.en, ...MICRO_NEGATIVE_CONTROLS, ...MARKET_ROUTING_NEGATIVE_CONTROLS];
    const hits = [...new Set(all)].filter((p) => source.includes(strip(p)));
    expect(hits).toEqual([]);
  });
});
