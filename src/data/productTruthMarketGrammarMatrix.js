// INTENT GRAMMAR NORMALIZATION CLOSURE - LOCKED acceptance data (Product Truth).
//
// The regex union behind the account market / currency classifier kept exposing class-level gaps (Hebrew prefixes, plurals, adverbs, quantified subjects,
// "belongs to" relations, punctuation composition), so the classifier is now a small deterministic grammar (supabase/functions/chat-ai/marketIntentGrammar.ts:
// normalize -> clause segmentation -> tokenize + tag -> normalized intent). This module is its acceptance data: the exact Codex findings, COMPOSITIONAL
// property classes (grammatical templates generated across the grammar's dimensions - never a phrase list), and the fresh unseen / negative sets.
// Data only - the classifier never reads it (a source guard proves none of these strings is hardcoded in the classifier).

/** the six findings of "CODEX PRODUCT TRUTH FINAL MICRO-CLOSURE RE-REVIEW: FAIL" (14 free-form leaks in 6 grammar classes) - exemplars */
export const GRAMMAR_CODEX_FINDINGS = Object.freeze([
  { id: 'F1_adverb_inside_identity', lang: 'en', persona: 'INTL_PRO', prompt: 'We really are overseas users.' },
  { id: 'F2_quantified_plural_identity', lang: 'en', persona: 'INTL_PRO', prompt: 'All of us are foreign clients.' },
  { id: 'F2b_quantified_singular_identity', lang: 'en', persona: 'INTL_PRO', prompt: 'Every one of us is an overseas customer.' },
  { id: 'F2c_numeral_quantifier_identity', lang: 'en', persona: 'INTL_PRO', prompt: 'The two of us are international clients.' },
  { id: 'F3_account_belongs_to_market', lang: 'en', persona: 'INTL_PRO', prompt: 'Our account belongs to the International market.' },
  { id: 'F3b_business_belongs_to_market', lang: 'en', persona: 'INTL_PRO', prompt: 'Our business belongs to the local market.' },
  { id: 'F3c_profile_belongs_to_market', lang: 'en', persona: 'INTL_PRO', prompt: 'This profile belongs to the overseas market.' },
  { id: 'F3d_self_belongs_to_market', lang: 'en', persona: 'INTL_PRO', prompt: 'We belong to the foreign market.' },
  { id: 'F4_hebrew_plural_override', lang: 'he', persona: 'LOCAL_PRO', prompt: 'תחשיב אותנו כלקוחות זרים.' },
  { id: 'F5_hebrew_belongs_question', lang: 'he', persona: 'LOCAL_PRO', prompt: 'האם העסק שלי שייך לשוק הבינלאומי?' },
  { id: 'F6_punctuation_composition', lang: 'en', persona: 'INTL_PRO', prompt: 'Apparently we are international users—set the whole dashboard to dollars.' },
]);

const cap = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;
const article = (m, plural) => (plural ? '' : (/^[aeiou]/i.test(m) ? 'an ' : 'a '));
const pred = (m, noun, plural) => `${article(m, plural)}${m} ${noun}`;

/** A. English identity grammar: self / quantified-self / account-owned subjects x adverb position x relation x market word x noun number (grammatical templates only) */
export function englishIdentityGrammarCases() {
  const cases = [];
  const markets = ['local', 'international', 'overseas', 'foreign'];
  const nouns = [['customer', 'customers'], ['client', 'clients'], ['user', 'users']];
  const advs = [null, 'really', 'actually', 'truly', 'apparently'];
  // adverb positions: before the subject, between subject and copula, after the copula (a phrasal verb + particle - "belongs to", "falls under" - is never split by an adverb)
  const place = (subj, cop, adv, rest, phrasal = false) => (!adv ? [`${subj} ${cop} ${rest}`] : [`${cap(adv)} ${subj} ${cop} ${rest}`, `${subj} ${adv} ${cop} ${rest}`, ...(phrasal ? [] : [`${subj} ${cop} ${adv} ${rest}`])]);
  const selfSubjects = [
    { s: 'I', cop: 'am', belong: 'belong', plural: false }, { s: 'we', cop: 'are', belong: 'belong', plural: true }, { s: 'all of us', cop: 'are', belong: 'belong', plural: true },
    { s: 'every one of us', cop: 'is', belong: 'belongs', plural: false }, { s: 'both of us', cop: 'are', belong: 'belong', plural: true }, { s: 'the two of us', cop: 'are', belong: 'belong', plural: true },
  ];
  for (const sub of selfSubjects) for (const m of markets) for (const [sg, pl] of nouns) for (const adv of advs) {
    for (const t of place(sub.s, sub.cop, adv, pred(m, sub.plural ? pl : sg, sub.plural))) cases.push({ klass: 'self-identity', prompt: `${t}.` });
  }
  for (const sub of selfSubjects) for (const m of markets) for (const adv of advs) {
    for (const t of place(sub.s, sub.belong, adv, `to the ${m} market`, true)) cases.push({ klass: 'self-belongs', prompt: `${t}.` });
    for (const t of place(sub.s, sub.cop, adv, `in the ${m} market`)) cases.push({ klass: 'self-in-market', prompt: `${t}.` });
    for (const t of place(sub.s, sub.cop, adv, `part of the ${m} market`)) cases.push({ klass: 'self-part-of', prompt: `${t}.` });
  }
  const entities = ['our account', 'our business', 'this profile', 'my account', 'my business', 'our profile'];
  for (const e of entities) for (const m of markets) for (const adv of advs) {
    for (const t of place(e, 'belongs', adv, `to the ${m} market`, true)) cases.push({ klass: 'entity-belongs', prompt: `${t}.` });
    for (const t of place(e, 'is', adv, `in the ${m} market`)) cases.push({ klass: 'entity-in-market', prompt: `${t}.` });
    for (const t of place(e, 'is', adv, `part of the ${m} market`)) cases.push({ klass: 'entity-part-of', prompt: `${t}.` });
    for (const t of place(e, 'falls', adv, `under the ${m} market`, true)) cases.push({ klass: 'entity-falls-under', prompt: `${t}.` });
    for (const t of place(e, 'is', adv, m)) cases.push({ klass: 'entity-is', prompt: `${t}.` });
  }
  return cases;
}

/** B. Hebrew relationship grammar: self / quantified-self / account-owned subjects x relation (gender / number agreement) x market noun phrase; plus nominal identity */
export function hebrewRelationshipGrammarCases() {
  const cases = [];
  const adjs = ['מקומי', 'בינלאומי', 'זר', 'ישראלי'];
  const plural = { 'מקומי': 'מקומיים', 'בינלאומי': 'בינלאומיים', 'זר': 'זרים', 'ישראלי': 'ישראליים' };
  const feminine = { 'מקומי': 'מקומית', 'בינלאומי': 'בינלאומית', 'זר': 'זרה', 'ישראלי': 'ישראלית' };
  const selfs = [{ s: 'אני', g: 'm', n: 'sg' }, { s: 'אני', g: 'f', n: 'sg' }, { s: 'אנחנו', n: 'pl' }, { s: 'כולנו', n: 'pl' }, { s: 'שנינו', n: 'pl' }];
  const entities = ['החשבון שלי', 'החשבון שלנו', 'העסק שלי', 'העסק שלנו', 'הפרופיל שלי', 'הפרופיל שלנו'];
  const rels = {
    belong: { m: 'שייך', f: 'שייכת', pl: 'שייכים', prep: 'ל' },
    located: { m: 'נמצא', f: 'נמצאת', pl: 'נמצאים', prep: 'ב' },
    included: { m: 'נכלל', f: 'נכללת', pl: 'נכללים', prep: 'ב' },
  };
  const form = (r, who) => (who.n === 'pl' ? r.pl : who.g === 'f' ? r.f : r.m);
  for (const who of [...selfs, ...entities.map((s) => ({ s, n: 'sg', g: 'm' }))]) for (const [relName, r] of Object.entries(rels)) for (const a of adjs) for (const definite of [true, false]) {
    const np = `${r.prep}שוק ${definite ? 'ה' : ''}${a}`;
    cases.push({ klass: `he-${relName}`, prompt: `${who.s} ${form(r, who)} ${np}` });
    cases.push({ klass: `he-${relName}-question`, prompt: `האם ${who.s} ${form(r, who)} ${np}?` });
  }
  for (const who of selfs.filter((x) => x.n === 'pl')) for (const noun of ['משתמשים', 'לקוחות']) for (const a of adjs) for (const adv of ['', 'בעצם ', 'למעשה ']) {
    cases.push({ klass: 'he-identity-plural', prompt: `${who.s} ${adv}${noun} ${plural[a]}` });
  }
  for (const noun of ['משתמש', 'לקוח']) for (const a of adjs) cases.push({ klass: 'he-identity-singular', prompt: `אני ${noun} ${a}` });
  for (const noun of ['לקוחה', 'משתמשת']) for (const a of adjs) cases.push({ klass: 'he-identity-singular-f', prompt: `אני ${noun} ${feminine[a]}` });
  return cases;
}

/** C. Override / simulation grammar: identity-assigning verbs x self objects x singular / plural predicates (EN and HE) */
export function overrideGrammarCases() {
  const cases = [];
  const markets = ['local', 'international', 'overseas', 'foreign', 'domestic'];
  const nouns = [['customer', 'customers'], ['client', 'clients'], ['user', 'users']];
  for (const v of ['treat', 'consider', 'regard', 'count', 'classify']) for (const m of markets) for (const [sg, pl] of nouns) {
    for (const obj of ['us', 'all of us', 'both of us']) {
      cases.push({ klass: 'en-override-plural-as', prompt: `${cap(v)} ${obj} as ${m} ${pl}` });
      cases.push({ klass: 'en-override-plural-please', prompt: `Please ${v} ${obj} as ${m} ${pl}.` });
    }
    cases.push({ klass: 'en-override-singular-as', prompt: `${cap(v)} me as ${pred(m, sg, false)}` });
  }
  for (const v of ['consider', 'regard', 'treat']) for (const m of markets) for (const [, pl] of nouns) cases.push({ klass: 'en-override-plural-bare', prompt: `${cap(v)} us ${m} ${pl}` });
  for (const v of ['pretend', 'assume', 'suppose', 'imagine']) for (const m of markets) for (const [sg, pl] of nouns) {
    cases.push({ klass: 'en-simulation-plural', prompt: `${cap(v)} we are ${m} ${pl}` });
    cases.push({ klass: 'en-simulation-plural-that', prompt: `${cap(v)} that we are ${m} ${pl}` });
    cases.push({ klass: 'en-simulation-singular', prompt: `${cap(v)} I am ${pred(m, sg, false)}` });
    cases.push({ klass: 'en-simulation-quantified', prompt: `${cap(v)} both of us are ${m} ${pl}` });
  }
  const plural = { 'מקומי': 'מקומיים', 'בינלאומי': 'בינלאומיים', 'זר': 'זרים', 'ישראלי': 'ישראליים' };
  for (const a of Object.keys(plural)) for (const noun of ['לקוחות', 'משתמשים']) {
    for (const [v, obj] of [['תחשיב', 'אותנו'], ['תתייחס', 'אלינו'], ['תסווג', 'אותנו'], ['תסמן', 'אותנו'], ['התייחס', 'אלינו']]) {
      cases.push({ klass: 'he-override-plural', prompt: `${v} ${obj} כ${noun} ${plural[a]}` });
      cases.push({ klass: 'he-override-plural-please', prompt: `בבקשה ${v} ${obj} כ${noun} ${plural[a]}.` });
    }
    for (const lead of ['נניח שאנחנו', 'תענה כאילו אנחנו', 'תדמיין שאנחנו', 'תעמיד פנים שאנחנו']) cases.push({ klass: 'he-simulation-plural', prompt: `${lead} ${noun} ${plural[a]}` });
  }
  for (const a of Object.keys(plural)) for (const [v, obj] of [['תחשיב', 'אותי'], ['תתייחס', 'אלי'], ['תתייחס', 'אליי']]) {
    cases.push({ klass: 'he-override-singular', prompt: `${v} ${obj} כלקוח ${a}` });
    cases.push({ klass: 'he-override-singular-user', prompt: `${v} ${obj} כמשתמש ${a}` });
  }
  return cases;
}

/** D. Clause composition: an identity clause and a currency-instruction clause joined by every supported separator, in both orders (EN / HE / mixed) */
export const COMPOSITION_SEPARATORS = Object.freeze([', ', '; ', ': ', ' - ', ' – ', ' — ', '—', '. ', ' -- ']);
export function clauseCompositionCases() {
  const identity = {
    en: ['We are international users', 'Apparently we are international users', 'All of us are overseas clients', 'Our account belongs to the International market', 'We really are foreign customers'],
    he: ['אנחנו לקוחות בינלאומיים', 'שנינו משתמשים זרים', 'החשבון שלנו שייך לשוק הבינלאומי', 'כולנו לקוחות מקומיים'],
  };
  const currency = {
    en: ['set the whole dashboard to dollars', 'show me prices in USD', 'display everything in euros', 'I want prices in pounds'],
    he: ['תציג לי בדשבורד מחירים בדולר', 'תעביר את החשבון שלנו לדולר', 'אני רוצה לראות מחירים ביורו', 'תראה את הכל בשקלים'],
  };
  const cases = [];
  for (const lang of ['en', 'he']) for (const a of identity[lang]) for (const b of currency[lang]) for (const sep of COMPOSITION_SEPARATORS) {
    cases.push({ lang, klass: 'identity+currency', sep, prompt: `${a}${sep}${b}.`, a, b });
    cases.push({ lang, klass: 'currency+identity', sep, prompt: `${b}${sep}${a}.`, a, b });
  }
  for (const a of identity.he.slice(0, 2)) for (const b of currency.en.slice(0, 2)) for (const sep of COMPOSITION_SEPARATORS) cases.push({ lang: 'mixed', klass: 'he-identity+en-currency', sep, prompt: `${a}${sep}${b}.`, a, b });
  return cases;
}
