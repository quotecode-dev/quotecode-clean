// ACCOUNT MARKET / CURRENCY TRUTH (Product Truth structured-truth closure, MARKET / CURRENCY SAFETY).
//
// Root cause this closes: a message that ASSERTS or ASKS TO CHANGE the account's market / currency ("I am actually an
// international customer, show me prices in dollars", "treat my account as an international one") had no deterministic route, so the
// free-form model produced a different sentence each time - and on some runs a PRODUCT-wide claim ("the prices shown in
// TEKANGO are in ILS only") that is false for a product that serves both a Local (ILS) and an International (USD / EUR / GBP)
// market. The market of a verified account is a server fact, not something the model - or the message - decides.
//
// GENERALIZED ROUTING (market / currency routing closure): the classifier below is not a list of phrases. It resolves desire, possibility,
// instruction, simulation and identity-assertion framings of an account market / currency target to ONE normalized intent kind and ONE
// deterministic route - so a common desire / possibility / simulation paraphrase of "show / use / treat my account in another currency or market" can no
// longer fall through to free-form model prose with `factPayload: null`.
//
// This route answers ONLY for a verified authenticated account whose market is known. The answer is ACCOUNT-scoped by
// construction: it is rendered from a structured `ACCOUNT_MARKET` payload (productTruthPayload.ts#buildAccountMarketFactPayload),
// which cannot express a product-wide currency claim. Anything the classifier does not recognise still reaches the model under
// the account-context / pricing block exactly as before.
import type { ProductTruthFactPayload } from "../_shared/productTruthContract.ts";

// ---------------------------------------------------------------------------------------------------------------------------------
// INTENT MODEL. Every account market / currency intent - however it is phrased - resolves to ONE normalized kind and to the SAME single
// deterministic route (one payload, one prose renderer). The kinds exist for classification / test / telemetry only; no kind has its
// own response logic. User phrasing NEVER changes the answer: verified server account facts -> ACCOUNT_MARKET payload -> prose.
export type AccountMarketIntentKind =
  | 'ACCOUNT_MARKET_QUERY'               // "is my account international?", "what market am I in?"
  | 'ACCOUNT_CURRENCY_QUERY'             // what currency the account / prices use, or whether the account can work in a currency
  | 'ACCOUNT_MARKET_OVERRIDE_REQUEST'    // ask to be treated as / to pretend to belong to another market
  | 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST'  // ask / prefer / wish to see or work in another currency
  | 'ACCOUNT_MARKET_IDENTITY_ASSERTION'; // a statement about which market the user / account belongs to

interface KindedPattern { readonly kind: AccountMarketIntentKind; readonly re: RegExp }

// ---- (A) The original phrase-shaped patterns (kept as-is; the generalized layer below is a UNION with them, never a replacement). ----
const CURRENCY_EN = '(?:usd|dollars?|us\\s+dollars?|eur|euros?|gbp|pounds?|sterling|ils|nis|shekels?|shekel)';
const INSTRUCTION_EN = '(?:show|display|give|switch|convert|change|set|treat|consider|regard|make|move|see|use)';

const EN_PATTERNS: readonly KindedPattern[] = [
  // "I am / treat me as / switch me to an international|local account|customer|market"
  { kind: 'ACCOUNT_MARKET_IDENTITY_ASSERTION', re: new RegExp(`\\b(?:i\\s+am|i['’]m|we\\s+are|we['’]re|treat\\s+me|treat\\s+my|consider\\s+me|consider\\s+my|regard\\s+me|switch\\s+me|switch\\s+my|make\\s+me|make\\s+my|set\\s+me|set\\s+my|change\\s+my|move\\s+me|move\\s+my)\\b.{0,40}\\b(?:international|foreign|overseas|local|israeli)\\b.{0,25}\\b(?:customer|account|market|user|client|business|pricing|prices?)\\b`, 'i') },
  // "<instruction> ... prices|pricing|plans|quotes ... in <currency>"
  { kind: 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST', re: new RegExp(`\\b${INSTRUCTION_EN}\\b.{0,30}\\b(?:prices?|pricing|plans?|costs?|quotes?)\\b.{0,25}\\b(?:in|to|using)\\s+${CURRENCY_EN}\\b`, 'i') },
  // "<instruction> ... my currency|market|region|country"
  { kind: 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST', re: /\b(?:change|switch|set|update|convert)\b.{0,15}\b(?:my\s+)?(?:currency|market|region|country)\b/i },
  // "<instruction> ... an international|local account|market|customer"
  { kind: 'ACCOUNT_MARKET_OVERRIDE_REQUEST', re: /\b(?:treat|consider|regard|switch|make|set|move)\b.{0,30}\b(?:international|foreign|overseas|local|israeli)\s+(?:account|market|customer)\b/i },
  // CURRENCY QUESTIONS about what the account / prices are shown in. Anchored to a yes/no or "which currency" form on purpose: a real
  // pricing question (a price-of-a-plan question in a currency, "How much is PRO in USD?") or a feature question ("Which currencies does the
  // calculator convert?") must still reach the pricing block / the capability router.
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: new RegExp(`^\\s*(?:are|is)\\s+(?:the\\s+|all\\s+|your\\s+)?(?:tekango\\s+)?(?:prices?|pricing)\\b.{0,30}\\b(?:only\\s+)?(?:in\\s+)?${CURRENCY_EN}(?:\\s+only)?\\s*\\??\\s*$`, 'i') },
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: new RegExp(`\\b(?:does|do)\\s+tekango\\b.{0,30}\\b(?:only\\s+)?(?:support|use|show|display)\\b.{0,20}\\b${CURRENCY_EN}\\b`, 'i') },
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: /\b(?:what|which)\s+currenc(?:y|ies)\b.{0,40}\b(?:are|is|do|does|will)\s+(?:the\s+|my\s+|this\s+|all\s+)?(?:tekango\s+)?(?:prices?|pricing|plans?|account|quotes?)\b/i },
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: /\b(?:prices?|pricing)\b.{0,30}\b(?:what|which)\s+currency\b/i },
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: /\bin\s+what\s+currency\b.{0,40}\b(?:prices?|pricing|shown|displayed|billed|charged)\b/i },
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: /\bwhat\s+currency\s+(?:am\s+i|do\s+i)\s+(?:seeing|see|using|use|shown|get)\b/i },
];

const HE_CURRENCY = '(?:ב?דולר(?:ים)?|ב?יורו|ב?אירו|ב?שקל(?:ים)?|ב?ש"ח|ב?לירות|ב?לירה|USD|EUR|GBP|ILS)';
const HE_INSTRUCTION = '(?:תראה|הראה|תראי|הראי|תציג|הצג|תציגי|הציגי|שנה|תשנה|שני|תשני|העבר|תעביר|העבירי|תעבירי|תמיר|המר|תגדיר|הגדר|תחשיב|תתייחס|התייחס|תתייחסי|התייחסי)';
const HE_MARKET_WORD = '(?:בינלאומי(?:ת)?|זר(?:ה)?|מחו"ל|מקומי(?:ת)?|ישראלי(?:ת)?)';

const HE_PATTERNS: readonly KindedPattern[] = [
  // "אני (בעצם) לקוח בינלאומי / חשבון בינלאומי / משתמש מקומי"
  { kind: 'ACCOUNT_MARKET_IDENTITY_ASSERTION', re: new RegExp(`(?:אני|אנחנו)\\s.{0,25}(?:לקוח|לקוחה|חשבון|משתמש|משתמשת|עסק)\\s+${HE_MARKET_WORD}`) },
  // "<instruction> ... מחירים|תמחור|מחיר|מטבע ... <currency>"
  { kind: 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST', re: new RegExp(`${HE_INSTRUCTION}\\s.{0,30}(?:מחירים|תמחור|מחיר|מטבע|תוכניות|הצעות).{0,25}${HE_CURRENCY}`) },
  // "<instruction> ... (את) המטבע|השוק|האזור"
  { kind: 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST', re: new RegExp(`${HE_INSTRUCTION}\\s.{0,15}(?:את\\s+)?(?:ה?מטבע|ה?שוק|ה?אזור|ה?מדינה)`) },
  // "<instruction> ... כחשבון|כלקוח|לחשבון|ללקוח בינלאומי|מקומי"
  { kind: 'ACCOUNT_MARKET_OVERRIDE_REQUEST', re: new RegExp(`${HE_INSTRUCTION}\\s.{0,30}(?:חשבון|לקוח|שוק)\\s+${HE_MARKET_WORD}`) },
  { kind: 'ACCOUNT_MARKET_OVERRIDE_REQUEST', re: new RegExp(`${HE_INSTRUCTION}\\s.{0,30}(?:כחשבון|כלקוח|לחשבון|ללקוח|לשוק)\\s*${HE_MARKET_WORD}`) },
  // CURRENCY QUESTIONS (yes/no or "which currency" forms - anchored so a real pricing / feature question still reaches its own route)
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: new RegExp(`^\\s*(?:האם\\s+)?(?:כל\\s+)?(?:ה)?(?:מחירים|תמחור)(?:\\s+ב-?TEKANGO)?\\s+(?:הם\\s+|נקובים\\s+|מוצגים\\s+)?${HE_CURRENCY}(?:\\s+בלבד)?\\s*\\??\\s*$`) },
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: /(?:באיזה|איזה)\s+מטבע.{0,40}(?:המחירים|מחירים|התמחור|החשבון|ההצעות|מוצג|מציגים|מחייבים)/ },
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: /(?:המחירים|התמחור|החשבון).{0,30}(?:באיזה|איזה)\s+מטבע/ },
  { kind: 'ACCOUNT_CURRENCY_QUERY', re: /(?:האם\s+)?TEKANGO\s.{0,30}(?:תומכת|מציגה|עובדת)\s.{0,15}(?:רק\s+)?ב(?:שקל|דולר|יורו|אירו)/ },
];

// ---- (B) GENERALIZED SEMANTIC LAYER: speech-act FRAMES x account TARGETS, never a list of phrases. -----------------------------------
// A message is an account market / currency intent when it pairs (1) a TARGET - a currency the ACCOUNT would display / work in, or a market
// the ACCOUNT would belong to - with (2) a FRAME - a desire, a possibility question, an instruction, a simulation or an identity assertion -
// and (3) none of the guards that keep generic currency KNOWLEDGE ("what's the USD rate", "what does USD stand for") and DOCUMENT CREATION
// ("can I create a quote in USD" - a quote-content question that keeps its own route) out of the account route. Lexicons are per-language
// word classes; the decision table below is language-neutral.
const HS = '(?<![\\u05d0-\\u05eaa-z0-9])'; // Hebrew token start (JS \b is ASCII-only)
const HE_ = '(?![\\u05d0-\\u05eaa-z0-9])'; // Hebrew token end
const HP = '[בלהוכמש]{0,2}'; // up to two Hebrew prefix letters (in / to / the / and / like / from / that: "בחשבון", "שהמחירים")
const en = (body: string): RegExp => new RegExp(`\\b(?:${body})\\b`);
const he = (body: string): RegExp => new RegExp(`${HS}${HP}(?:${body})${HE_}`); // optional Hebrew prefixes ("בחשבון", "ואפשר", "שכאילו")

/** Lower-case, strip Hebrew points, unify quote / gershayim characters and whitespace. */
function normalizeMarketText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[״“”„‟″]/g, '"')
    .replace(/[׳‘’′`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// TARGET 1 - a currency mention
const CUR_EN = /\b(?:usd|eur|gbp|ils|nis|(?:us\s+)?dollars?|euros?|pounds?(?:\s+sterling)?|sterling|shekels?)\b|[$€£₪]/;
const CUR_HE = new RegExp(`${HS}${HP}(?:דולר(?:ים|ית)?|יורו|אירו|ליש"ט|פאונד(?:ים)?|סטרלינג|שקל(?:ים)?|ש"ח|usd|eur|gbp|ils|nis)${HE_}`);

// TARGET 2 - a market word (Local / International) and the shapes it takes when it describes the ACCOUNT
const MKT_EN = '(?:international|foreign|overseas|non-israeli|local|israeli|domestic)';
// Identity / account nouns come in SINGULAR and PLURAL forms ("an international customer" / "overseas customers"). The plural forms are
// only valid where the noun is the PREDICATE of an identity claim ("we are overseas customers", "treat us as local users") - never where it
// is the OBJECT of another request ("add international customers"), so MKT_TAIL_EN / MKT_ATTR_EN keep the singular list.
const NOUN_SG_EN = 'account|customer|user|client|market|business|pricing|prices?|version|edition|mode|one|person|company|owner';
const NOUN_PL_EN = 'accounts|customers|users|clients|businesses|companies|people|persons|owners|ones|entities';
const NOUN_EN = `(?:${NOUN_SG_EN}|${NOUN_PL_EN})`;
const FILL_EN = '(?:actually|really|truly|in\\s+fact|just|now|still|also|basically|technically|an?|the|customer|user|client|business|account|company|owner|business\\s+owner)';
const SUBJ_EN = "(?:(?:i|we)\\s+(?:am|are|was|were|be)|i'm|we're|(?:my|our)\\s+(?:account|business|company|profile)\\s+(?:is|was|were|should\\s+be|would\\s+be)|(?:the|this)\\s+(?:account|business|company)\\s+(?:is|was|were|should\\s+be|would\\s+be)|this\\s+(?:is|was|were)|(?:it|account)\\s+(?:is|was|were))";
// what may follow an identity claim: the end, punctuation, a conjunction, or a scope complement ("... users of this dashboard", "... clients in your app")
const EN_TAIL_OK = '(?=\\s*(?:$|[.,;!?]|\\b(?:and|so|but|please|too|now|then|since|because)\\b|\\b(?:of|on|in|for|at|with)\\s+(?:this|the|your|tekango|our)\\b))';
const MKT_ASSERT_EN = new RegExp(`\\b${SUBJ_EN}(?:\\s+${FILL_EN})*\\s+${MKT_EN}(?:\\s+${NOUN_EN})?${EN_TAIL_OK}`);
// after as / like the noun is a PREDICATE, so the plural is valid there ("treat us as overseas clients"); after to / into it is not
const MKT_TAIL_EN = new RegExp(`\\b(?:(?:as|to|into|like)\\s+(?:an?\\s+|the\\s+)?${MKT_EN}(?:\\s+(?:${NOUN_SG_EN}))?|(?:as|like)\\s+${MKT_EN}\\s+(?:${NOUN_PL_EN}))${EN_TAIL_OK}`);
const MKT_ATTR_EN = new RegExp(`\\b(?:an?\\s+|the\\s+)?${MKT_EN}\\s+(?:account|customer|user|client|market|business|pricing|version|edition|mode)\\b`);
// "<verb> <me / my account> [as|to] <market>" - the verb + object + market word form ("make my account <market>")
const MKT_OBJ_EN = new RegExp(`\\b(?:make|set|turn|mark|classify|count|consider|treat|regard|switch|move|change)\\s+(?:(?:all|both|each)\\s+of\\s+)?(?:me|us|my\\s+\\w+|our\\s+\\w+|the\\s+account|this\\s+account)\\s+(?:as\\s+|to\\s+|into\\s+)?(?:an?\\s+|the\\s+)?${MKT_EN}(?:\\s+${NOUN_EN})?${EN_TAIL_OK}`);
const MKT_QUERY_EN: readonly RegExp[] = [
  new RegExp(`\\b(?:is|are)\\s+(?:my|our|this|the)\\s+(?:account|business|profile)\\s+(?:an?\\s+)?${MKT_EN}\\b`),
  new RegExp(`\\bam\\s+i\\s+(?:an?\\s+)?(?:in\\s+)?(?:the\\s+)?${MKT_EN}\\b`),
  /\b(?:what|which)\s+(?:market|region|country)\b[^.?!]{0,30}\b(?:am\s+i|is\s+my|is\s+this|are\s+we|is\s+the\s+account)\b/,
];

const MKT_HE = `(?:${HP}ה?(?:בינלאומי(?:ת)?|בין-לאומי|בינ"ל|זר(?:ה)?|מקומי(?:ת)?|ישראלי(?:ת)?)|(?:מ|ב)?חו"ל)`;
const NOUN_HE = `(?:${HP}(?:חשבון|לקוח|לקוחה|משתמש|משתמשת|שוק|עסק|מחירון|גרסה|מצב|אזור))`;
// plural identity nouns / market words ("אנחנו לקוחות בינלאומיים") - valid only as the PREDICATE of an identity claim, like the English plural above
const NOUN_HE_PL = `(?:${HP}(?:לקוחות|משתמשים|משתמשות|עסקים|חברות))`;
const MKT_HE_PL = `(?:${HP}ה?(?:בינלאומי(?:ים|ות)|מקומי(?:ים|ות)|ישראלי(?:ים|ות)|זר(?:ים|ות)))`;
const FILL_HE = `(?:בעצם|למעשה|ממש|כרגע|עכשיו|גם|באמת|בכלל|פשוט|כן|בעל\\s+עסק|בעלת\\s+עסק|חברה|${NOUN_HE}|${NOUN_HE_PL})`;
const SUBJ_HE = '(?:אני|אנחנו|אנו|הוא|היא|זה|זו|החשבון(?:\\s+שלי|\\s+שלנו)?|חשבוני|העסק(?:\\s+שלי|\\s+שלנו)?)';
const MKT_ASSERT_HE = new RegExp(`${HS}[שוכלב]{0,2}${SUBJ_HE}(?:\\s+${FILL_HE})*\\s+(?:${MKT_HE}|${MKT_HE_PL})${HE_}`);
const MKT_ATTR_HE = new RegExp(`${HS}${NOUN_HE}\\s+${MKT_HE}${HE_}`);
const MKT_TAIL_HE = new RegExp(`${HS}(?:כ|ל)(?:ה)?(?:בינלאומי(?:ת)?|בין-לאומי|בינ"ל|זר(?:ה)?|מקומי(?:ת)?|ישראלי(?:ת)?)${HE_}`);
const MKT_QUERY_HE: readonly RegExp[] = [
  new RegExp(`${HS}האם\\s+(?:החשבון|העסק)(?:\\s+שלי)?\\s+${MKT_HE}${HE_}`),
  new RegExp(`${HS}האם\\s+אני\\s+(?:לקוח\\s+|משתמש\\s+)?${MKT_HE}${HE_}`),
  /(?:באיזה|איזה)\s+(?:שוק|אזור|מדינה)/,
];

// FRAMES (speech acts)
const DESIRE_EN = /\b(?:i|we)(?:'d|'ll)?\b(?:\s+\S+){0,3}?\s+(?:want|wanna|prefer|rather|wish|need|hope|like|love)\b|\bi'?d\s+(?:like|prefer|rather|love)\b|\bwould\s+(?:like|prefer|rather|love)\b/;
const DESIRE_HE = he('(?:אני|אנחנו|אנו)\\s+(?:\\S+\\s+){0,2}?(?:רוצה|רוצים|מעדיף|מעדיפה|מעדיפים|מעוניין|מעוניינת|מעוניינים|צריך|צריכה|צריכים|מבקש|מבקשת|מבקשים)|הייתי\\s+(?:\\S+\\s+)?(?:רוצה|מעדיף|מעדיפה|שמח|שמחה)|היינו\\s+(?:\\S+\\s+)?(?:רוצים|מעדיפים|שמחים)|אשמח|בא\\s+לי|רוצה\\s+ש|מעדיף\\s+ש');
const POSSIBILITY_EN = en('can|could|may|might|able\\s+to|possible|possibility|way\\s+to|does\\s+(?:it|this|tekango|the\\s+(?:app|account|system))\\s+(?:support|work|handle)|will\\s+it\\s+work');
const POSSIBILITY_HE = he('אפשר|ניתן|אפשרי|מותר|אפשרות|יכול|יכולה|יכולים|יכולות|אוכל|נוכל');
const INSTRUCTION_VERBS_EN = 'show|display|give|switch|convert|change|set|treat|consider|regard|make|move|see|use|put|render|present|list|update|turn|swap|toggle|enable|activate|apply|mark|classify|count';
const INSTRUCTION_EN_RE = new RegExp(`(?:^|[,;.!?]\\s*|\\b(?:please|kindly|just|now|then|and|so|you|can\\s+you|could\\s+you|would\\s+you|will\\s+you)\\s+)(?:${INSTRUCTION_VERBS_EN})\\b`);
// state-changing verbs: with only "me / my" as the object they still ask to change the account
const STATE_VERBS_EN = en('switch|move|convert|change|set|treat|consider|regard|make|put|turn|swap|update|mark|classify|count|apply|enable|activate');
const INSTRUCTION_HE = he('תראה|הראה|תראי|הראי|תציג|הצג|תציגי|הציגי|תשנה|שני|תשני|העבר|תעביר|העבירי|תעבירי|תמיר|המר|תגדיר|הגדר|תחשיב|תתייחס|התייחס|תתייחסי|התייחסי|תפעיל|הפעל|תעבוד|תעבור|תחליף|החלף|תשים|שים|תן|תני|תחיל|נא');
const INSTRUCTION_HE_START = /^שנה\s/;
const STATE_VERBS_HE = he('העבר|תעביר|העבירי|תעבירי|תמיר|המר|תגדיר|הגדר|תתייחס|התייחס|תתייחסי|התייחסי|תפעיל|הפעל|תעבוד|תעבור|תחליף|החלף|תשנה|שני|תשני|תחיל');
const SIMULATION_EN = en("pretend|assume|suppose|imagine|act\\s+(?:as\\s+if|like)|answer\\s+as\\s+(?:if|though)|respond\\s+as\\s+(?:if|though)|behave\\s+as\\s+(?:if|though)|talk\\s+to\\s+me\\s+as\\s+(?:if|though)|as\\s+if|as\\s+though|let'?s\\s+say|say\\s+(?:that\\s+)?(?:i|my)|what\\s+if|hypothetically|let'?s\\s+pretend|for\\s+the\\s+sake\\s+of");
const SIMULATION_HE = he('נניח|נגיד|תדמיין|דמיין|תדמייני|דמייני|כאילו|תעמיד\\s+פנים|העמד\\s+פנים|נאמר|הנח|בהנחה\\s+ש');

// ACCOUNT anchors / display objects / working verbs
const ACCT_STRONG_EN = en("(?:my|our|this|the)\\s+(?:(?:whole|entire)\\s+)?(?:account|business|company|profile|plan|subscription|dashboard|app|application|system|workspace)");
// Hebrew nouns take attached prefixes (ב in / ל to / מ from / כ as / ו and / ש that) and the article ה, in EVERY combination ("בדשבורד", "לחשבון",
// "מהמערכת", "כדשבורד", "שהחשבון"). The lexicon therefore lists each noun ONCE, bare, and the prefix rule below is applied around it - a definite
// form is a preposition (with an optional article) or the article alone, optionally preceded by ו / ש. A bare noun without any prefix / article
// ("מערכת") is not an account anchor, except "חשבון" itself, which is the account word. The token-end guard keeps unrelated longer words out
// ("חשבונית" invoice, "מחשבון" calculator - the latter is also a knowledge guard).
const HE_DEFINITE_PREFIX = '[וש]?(?:[בלמכ]ה?|ה)';
const heDefinite = (nouns: string): string => `${HE_DEFINITE_PREFIX}(?:${nouns})`;
const ACCT_STRONG_HE = new RegExp(`${HS}(?:${HP}(?:חשבון|חשבוני)|${heDefinite('אפליקציה|מערכת|דשבורד|מנוי|פרופיל|עסק\\s+שלי')})${HE_}`);
const FIRST_EN = en("i|we|me|my|our|us|i'm|i'd|we're");
const FIRST_HE = he('אני|אנחנו|אנו|אותי|אותנו|אליי|אלי|לי|לנו|שלי|שלנו|אצלי|אצלנו|הייתי|היינו');
const ME_OBJ_EN = en('me|us|my|our');
const ME_OBJ_HE = he('אותי|אותנו|לי|לנו|שלי|שלנו');
const DISP_EN = en("prices?|pricing|price\\s+list|plans?|costs?|fees?|amounts?|totals?|figures|everything|currency|currencies|the\\s+(?:whole\\s+)?(?:app|dashboard|site|system|interface|ui)|all\\s+(?:the\\s+)?(?:prices|amounts)");
const DISP_HE = new RegExp(`${HS}(?:${HP}(?:מחירים|מחיר|תמחור|מחירון|תוכניות|עלויות|סכומים|הכל|ממשק|מטבע)|${heDefinite('אפליקציה|מערכת|דשבורד|ממשק')})${HE_}`);
const WORK_EN = en("work|working|operate|run|use|using|used|display|displayed|show|shown|see|view|support|handle|be\\s+(?:shown|displayed|used|set)|switch");
const WORK_HE = he('לעבוד|לפעול|להציג|הצגה|להראות|לראות|ראות|להשתמש|להגדיר|לתמוך|מוצג|מוצגים|לעבור|להעביר');

// GUARDS
// generic currency KNOWLEDGE / calculation - never an account intent
const KNOWLEDGE_EN = new RegExp(
  "exchange\\s+rate|conversion\\s+rate|\\brates?\\b|stands?\\s+for|abbreviat\\w*|\\bsymbols?\\b|\\bsigns?\\b|how\\s+(?:do\\s+(?:i|you)\\s+|to\\s+|can\\s+i\\s+)?(?:write|spell|type|say|pronounce|abbreviate)|\\bworth\\b|\\bhistory\\b|\\borigin\\b|\\bmeaning\\b|\\bmeans?\\b|\\bcalculator\\b|\\bconverter\\b|\\b(?:ounces?|lbs?|kilograms?|kilos?|grams?|weigh\\w*)\\b|\\b(?:charts?|graphs?|plots?|widgets?)\\b"
  + "|\\bconvert(?:ing|s|ed)?\\b(?!\\s+(?:me|my|our|us|the\\s+account|this\\s+account|prices?|pricing|everything|all))",
);
const KNOWLEDGE_HE = he('שער|שערי|סמל|קיצור|נוסחה|איך\\s+(?:כותבים|אומרים|מקצרים|מבטאים|מאייתים)|כמה\\s+(?:שווה|עלה)|היסטוריה|מקור|משמעות|מה\\s+זה|ממיר|מחשבון|המרה\\s+של|גרף|גרפים|תרשים|תרשימים|וידג\'ט');
// the user's OWN customers / clients / users / contacts as the subject of a market classification (a CRM request), and the first-person words that would make it self-referential
const THIRD_PARTY_EN = /\b(?:my|our)\s+(?:customers?|clients?|users?|contacts?|leads?|suppliers?|employees?|members?)\b/;
const THIRD_PARTY_HE = he('(?:לקוח|לקוחה|לקוחות|משתמש|משתמשים|ספק|ספקים|עובד|עובדים)\\s+(?:שלי|שלנו)');
const SELF_EN = en("i|we|me|us|i'm|we're|i'd");
// prefix-STRICT on purpose: with the general prefix rule "שלי" (mine) would read as ש + "לי" (to me) and turn a third-party phrase into a self-reference
const SELF_HE = new RegExp(`${HS}(?:ש?(?:אני|אנחנו)|אותי|אותנו|אליי|אלינו|הייתי|היינו|לי|לנו)${HE_}`);
// creating / sending a quote-type document in a currency is a quote-content question with its own route, not an account-market intent
const DOC_CREATION_EN = /\b(?:creat\w*|mak(?:e|ing)|issu\w*|writ(?:e|ing)|send\w*|generat\w*|build\w*|prepar\w*|draft\w*|add\w*|sav(?:e|ing))\b[^.?!]{0,30}\b(?:quotes?|proposals?|invoices?|offers?|estimates?|documents?|pdfs?|items?|services?)\b/;
const DOC_CREATION_HE = he('ליצור|יצירת|לעשות|להוציא|הוצאת|לכתוב|כתיבת|לשלוח|שליחת|להפיק|הפקת|להכין|הכנת|להוסיף|הוספת|לשמור|לחייב');
const DOC_NOUN_HE = he('הצעה|הצעות|הצעת|חשבונית|חשבוניות|מסמך|פריט|שירות|לקוח');

// banking / money-movement context: a currency there is about money, not about the account's display currency
const BANKING_EN = /\b(?:bank|wire|transfer|salary|loan|deposit|withdraw\w*|credit\s+card|debit|invest\w*|stocks?|crypto\w*|paypal|stripe|mortgage)\b/;
const BANKING_HE = he('בנק|בנקאית|העברה|משכורת|הלוואה|פיקדון|כרטיס\\s+אשראי|משכנתא|השקעה|קריפטו|פייפאל');

// a real PRICING question ("how much is the PRO plan in USD?", "give me the price of BASIC in dollars") keeps the pricing block, exactly as before
const PRICE_Q_EN = /\bhow\s+much\b|\b(?:price|prices|cost|costs)\s+of\b|\bwhat\s+(?:is|are)\s+the\s+(?:price|prices|cost|costs)\b|\b(?:pro|basic|free|premium|starter|business)\s+(?:plan|tier|package)\b|\b(?:plan|tier)\s+(?:pro|basic)\b/;
const PRICE_Q_HE = he('כמה\\s+(?:עולה|עולים|זה\\s+עולה)|(?:מחיר|עלות)\\s+(?:של|ה)|תוכנית\\s+(?:pro|basic|free|פרו|בייסיק)');

const tokenCount = (t: string): number => t.split(' ').filter(Boolean).length;
const any = (t: string, ...res: readonly RegExp[]): boolean => res.some((re) => re.test(t));

function marketIntentKind(t: string): AccountMarketIntentKind | null {
  // a question ABOUT the account's market
  if (any(t, ...MKT_QUERY_EN, ...MKT_QUERY_HE)) return 'ACCOUNT_MARKET_QUERY';
  // an assertion of the account's / the user's market (a customer or account described as international or local)
  const framed = any(t, DESIRE_EN, DESIRE_HE, POSSIBILITY_EN, POSSIBILITY_HE, INSTRUCTION_EN_RE, INSTRUCTION_HE, SIMULATION_EN, SIMULATION_HE);
  // the user's OWN customers / clients / users being classified ("treat our customers as international users") are a CRM request, not the account's market
  const thirdParty = any(t, THIRD_PARTY_EN, THIRD_PARTY_HE) && !any(t, SELF_EN, SELF_HE);
  const asserted = !thirdParty && any(t, MKT_ASSERT_EN, MKT_ASSERT_HE, MKT_OBJ_EN);
  const referred = !thirdParty && any(t, MKT_TAIL_EN, MKT_ATTR_EN, MKT_TAIL_HE, MKT_ATTR_HE) && any(t, FIRST_EN, FIRST_HE, ACCT_STRONG_EN, ACCT_STRONG_HE) && framed;
  if (!asserted && !referred) return null;
  return any(t, SIMULATION_EN, SIMULATION_HE, INSTRUCTION_EN_RE, INSTRUCTION_HE, DESIRE_EN, DESIRE_HE, POSSIBILITY_EN, POSSIBILITY_HE)
    ? 'ACCOUNT_MARKET_OVERRIDE_REQUEST'
    : 'ACCOUNT_MARKET_IDENTITY_ASSERTION';
}

function currencyIntentKind(t: string): AccountMarketIntentKind | null {
  if (!any(t, CUR_EN, CUR_HE)) return null;
  if (/\d/.test(t) || any(t, KNOWLEDGE_EN, KNOWLEDGE_HE, PRICE_Q_EN, PRICE_Q_HE, BANKING_EN, BANKING_HE)) return null;
  if (any(t, DOC_CREATION_EN) || (any(t, DOC_CREATION_HE) && any(t, DOC_NOUN_HE))) return null;
  const acct = any(t, ACCT_STRONG_EN, ACCT_STRONG_HE);
  const disp = any(t, DISP_EN, DISP_HE);
  const first = any(t, FIRST_EN, FIRST_HE);
  const meObj = any(t, ME_OBJ_EN, ME_OBJ_HE);
  const work = any(t, WORK_EN, WORK_HE);
  // simulation: "pretend / answer as if" + the account / a display object
  if (any(t, SIMULATION_EN, SIMULATION_HE) && (acct || disp || meObj)) return 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST';
  // possibility question about the ACCOUNT's currency (can it work / display / use a currency)
  if (any(t, POSSIBILITY_EN, POSSIBILITY_HE) && (acct || disp || (first && work))) return 'ACCOUNT_CURRENCY_QUERY';
  // instruction: a display object or the account is the target; a bare "me / my" is enough only for a state-changing verb (a "switch me to <currency>" request)
  if (any(t, INSTRUCTION_EN_RE, INSTRUCTION_HE, INSTRUCTION_HE_START)) {
    if (disp || acct) return 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST';
    if (meObj && any(t, STATE_VERBS_EN, STATE_VERBS_HE)) return 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST';
  }
  // desire / preference for the account to show / work in a currency - with a display / account / working object, or a short bare preference
  if (any(t, DESIRE_EN, DESIRE_HE) && (disp || acct || work || tokenCount(t) <= 10)) return 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST';
  return null;
}

/**
 * Normalized intent of a message that asserts, asks about, or asks to change the ACCOUNT's market / currency; null for anything else.
 * Conservative on purpose: generic currency knowledge and quote-content questions are NOT account intents (see the guards above).
 */
export function classifyAccountMarketIntentKind(lastUserMessage: unknown): AccountMarketIntentKind | null {
  const text = String(lastUserMessage ?? '').trim();
  if (!text) return null;
  const t = normalizeMarketText(text);
  const semantic = marketIntentKind(t) ?? currencyIntentKind(t);
  if (semantic) return semantic;
  // the original phrase-shaped patterns stay a UNION: nothing that routed before can stop routing
  return [...EN_PATTERNS, ...HE_PATTERNS].find((p) => p.re.test(text))?.kind ?? null;
}

/** True when the message asserts, asks about, or asks to change the account's market / currency. Conservative on purpose. */
export function classifyAccountMarketIntent(lastUserMessage: unknown): boolean {
  return classifyAccountMarketIntentKind(lastUserMessage) !== null;
}

/**
 * The account-scoped market / currency statement, rendered FROM the structured payload (never from raw facts): the market and
 * the currency the wording names are read off `payload.accountMarket` / `payload.currencyScope`. Fails closed for any payload
 * that is not an ACCOUNT_MARKET truth. Hebrew / Local wording never names a foreign currency; English / International wording
 * never names the shekel (market-isolation law).
 */
export function formatAccountMarketAnswer(isHebrew: boolean, payload: ProductTruthFactPayload): string {
  if (payload.truthStatus !== 'ACCOUNT_MARKET' || payload.accountMarket === null) {
    throw new Error(`formatAccountMarketAnswer requires an ACCOUNT_MARKET payload with a verified market, got ${payload.truthStatus}`);
  }
  const local = payload.accountMarket === 'LOCAL';
  if (isHebrew) {
    return local
      ? 'החשבון שלך מאומת בשוק המקומי (Local), ולכן המחירים וההצעות בחשבון שלך מוצגים בשקלים (₪). אי אפשר לשנות את שוק החשבון מתוך הצ\'אט, ואני לא מציג מחירים במטבע של שוק אחר ולא מתייחס לחשבון שלך כאילו הוא שייך לשוק אחר.'
      : 'החשבון שלך מאומת בשוק הבינלאומי (International), ולכן המחירים וההצעות בחשבון שלך מוצגים במטבע החשבון (USD, EUR או GBP). אי אפשר לשנות את שוק החשבון מתוך הצ\'אט, ואני לא מציג מחירים במטבע של שוק אחר ולא מתייחס לחשבון שלך כאילו הוא שייך לשוק אחר.';
  }
  return local
    ? "Your account is verified as Local, so prices and quotes in your account are shown in Israeli shekels (ILS). The account's market can't be changed from the chat, and I don't show prices in another market's currency or treat your account as belonging to a different market."
    : "Your account is verified as International, so prices and quotes in your account are shown in your account's currency (USD, EUR or GBP). The account's market can't be changed from the chat, and I don't show prices in another market's currency or treat your account as belonging to a different market.";
}
