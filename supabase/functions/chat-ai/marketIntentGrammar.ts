// ACCOUNT MARKET / CURRENCY INTENT GRAMMAR (Product Truth - intent grammar normalization closure).
//
// A small, explicit, DETERMINISTIC domain parser - not a general NLP parser and not a phrase list. It replaces the regex union that
// classified account market / currency language, whose class-level gaps kept reappearing (Hebrew prefixes, plurals, adverbs, quantified
// subjects, "belongs to" relations, punctuation composition).
//
//   raw text -> NORMALIZE -> SEGMENT (sentences, comma / conjunction clauses) -> TOKENIZE + TAG (lexicon, Hebrew clitic morphology,
//   multi-word units) -> PARSE each clause into a NORMALIZED INTENT (subject, number, relation, target market / currency, modality,
//   polarity) -> ACCOUNT_MARKET route -> structured truth -> prose.
//
// The parser only decides WHETHER a message is an account market / currency intent and of which kind. It never decides the account's
// market: user text is not truth. The route answers from the server-verified market (marketTruth.ts / productTruthPayload.ts).
//
// Design rules that keep it from over-routing (the CRM / third-party boundary):
//   * an IDENTITY / BELONGS relation needs a SELF or ACCOUNT-owned SUBJECT (I, we, all of us, our account, החשבון שלי ...). A market word
//     attached to somebody else's customers (a CRM request to add / filter / re-tag them) has no such subject and is never an account identity;
//   * an OVERRIDE needs a verb whose OBJECT is SELF / the account (accusative: "treat US as ...", "אותנו"), never a third-party noun;
//   * every gap between subject, copula and market target may contain only adverbs / determiners / negation / prepositions - any other
//     word ("looking for", "support", "add") breaks the relation;
//   * currency intents need a currency AND an account / display / self target under a frame, and are cut by guards (knowledge, price
//     questions, quote creation, banking, charts).

export type AccountMarket = 'LOCAL' | 'INTERNATIONAL';
export type AccountCurrency = 'ILS' | 'USD' | 'EUR' | 'GBP' | 'OTHER';
export type IntentSubject = 'SELF' | 'ACCOUNT' | 'BUSINESS' | 'PROFILE' | 'NONE';
export type IntentNumber = 'SINGULAR' | 'PLURAL' | 'UNKNOWN';
export type IntentRelation =
  | 'IDENTITY' | 'BELONGS_TO_MARKET' | 'MARKET_QUERY' | 'MARKET_OVERRIDE_REQUEST'
  | 'CURRENCY_PREFERENCE' | 'CURRENCY_CAPABILITY' | 'CURRENCY_QUERY' | 'DISPLAY_REQUEST';
export type IntentModality = 'ASSERTION' | 'QUESTION' | 'REQUEST' | 'DESIRE' | 'SIMULATION';

export interface ClauseIntent {
  text: string;
  subject: IntentSubject;
  subjectNumber: IntentNumber;
  relation: IntentRelation;
  targetMarket?: AccountMarket;
  targetCurrency?: AccountCurrency;
  modality: IntentModality;
  polarity: 'POSITIVE' | 'NEGATIVE';
}
export interface AccountMarketIntent { clauses: ClauseIntent[] }

// ---------------------------------------------------------------------------------------------------------------------------------
// STAGE 1 - NORMALIZATION
export function normalizeAccountMarketText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')                    // Hebrew points
    .replace(/־/g, '-')                            // maqaf
    .replace(/[״“”„‟″]/g, '"')
    .replace(/[׳‘’′`´]/g, "'")
    .replace(/[–—―−]/g, ' — ') // en dash / em dash / bar / minus  -> clause boundary
    .replace(/\s-+\s/g, ' — ')                     // spaced hyphen
    .replace(/--+/g, ' — ')                        // double hyphen
    .replace(/([א-ת])-(?=[a-z$€£₪])/g, '$1 ') // Hebrew prefix + hyphen + Latin letter or currency symbol ("ב-TEKANGO", "ב-£")
    .replace(/([א-ת])(?=[$€£₪])/g, '$1 ')     // Hebrew prefix attached straight to a currency symbol ("ב£")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// STAGE 2 - CLAUSE SEGMENTATION: sentences (. ; : ! ? dash newline), each analysed whole and as comma / conjunction clauses.
interface Sentence { text: string; question: boolean }
export function segmentSentences(normalized: string): Sentence[] {
  const out: Sentence[] = [];
  const parts = normalized.match(/[^.;:!?—\n]+[.;:!?—\n]*/g) ?? [];
  for (const p of parts) {
    const text = p.replace(/[.;:!?—\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) out.push({ text, question: p.includes('?') });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// STAGE 3 - LEXICON. One categorized entry per word form; Hebrew stems are listed BARE and the clitic (prefix) morphology is applied once.
type Cat =
  | 'SELF' | 'POSS' | 'ENTITY' | 'SURFACE' | 'PERSON' | 'MKT' | 'MNOUN' | 'DESC' | 'COP' | 'BELONG' | 'PREP' | 'ADV' | 'DET' | 'POLITE'
  | 'CONJ' | 'OR' | 'NEG' | 'WH' | 'CUR' | 'CURN' | 'DESIRE' | 'POSSIBLE' | 'SIM' | 'VERB' | 'BRAND' | 'DIGIT' | 'KNOW' | 'PRICEQ'
  | 'BANK' | 'DOCV' | 'DOCN' | 'Q' | 'AUX' | 'MODAL' | 'PART' | 'COMMA' | 'OTHER';
interface Entry { cats: Cat[]; v?: string; pl?: boolean; flags?: string[] }
interface Tok { w: string; c: Cat[]; v?: string; pl?: boolean; flags: string[]; pfx: string; lang: 'en' | 'he' | 'x' }

const EN = new Map<string, Entry>();
const HE = new Map<string, Entry>();
function def(map: Map<string, Entry>, words: string, cats: Cat[], extra: { v?: string; pl?: boolean; flags?: string[] } = {}): void {
  for (const w of words.split(' ')) if (w) map.set(w, { cats, v: extra.v, pl: extra.pl, flags: extra.flags });
}

// ---- English
def(EN, 'i', ['SELF'], { flags: ['subj'] }); def(EN, 'we', ['SELF'], { pl: true, flags: ['subj'] });
def(EN, 'me myself', ['SELF'], { flags: ['obj'] }); def(EN, 'us ourselves', ['SELF'], { pl: true, flags: ['obj'] });
def(EN, 'my', ['POSS']); def(EN, 'our', ['POSS'], { pl: true });
def(EN, 'account business company profile workspace firm organization organisation', ['ENTITY'], { flags: ['acct', 'subj'] });
def(EN, 'subscription', ['ENTITY'], { flags: ['acct'] });
def(EN, 'plan dashboard app application system interface ui site platform', ['SURFACE'], { flags: ['acct', 'disp'] });
def(EN, 'price pricing costs cost fee amount total figure everything currency quote', ['SURFACE'], { flags: ['disp'] });
def(EN, 'customer client user contact lead supplier vendor employee member', ['PERSON'], { flags: ['third'] });
def(EN, 'owner person people individual one entity', ['PERSON']);
def(EN, 'local israeli domestic', ['MKT'], { v: 'LOCAL' });
def(EN, 'international foreign overseas abroad', ['MKT'], { v: 'INTERNATIONAL' });
def(EN, 'market segment region country', ['MNOUN']);
def(EN, 'version edition mode setup tier type kind category', ['DESC']);
def(EN, 'am is are was were be being been', ['COP']);
def(EN, 'do does did let', ['AUX']);
def(EN, 'should must will would shall ought', ['MODAL']);
// participial copula: "is considered / registered / classified as ..." (accepted only after a be-verb)
def(EN, 'considered regarded treated classified registered listed counted defined recognized recognised marked categorized categorised seen viewed identified set', ['PART']);
def(EN, 'in under within of to into as like from for on at with by', ['PREP']);
def(EN, 'really actually truly apparently basically technically just also still now indeed obviously clearly seemingly probably supposedly essentially currently officially genuinely definitely certainly surely already only simply honestly frankly presumably evidently too anyway however here there instead right yes ok okay thanks thank all both each every current existing present up two three four five six seven eight nine ten', ['ADV']);
def(EN, 'a an the this that these those', ['DET']);
def(EN, 'please kindly pls', ['POLITE']);
def(EN, 'and but so then because since while although yet plus who', ['CONJ']); def(EN, 'or', ['OR']);
def(EN, 'not no never', ['NEG']);
def(EN, 'what which', ['WH']);
def(EN, 'usd', ['CUR'], { v: 'USD' }); def(EN, 'dollar', ['CUR'], { v: 'USD' }); def(EN, 'eur euro', ['CUR'], { v: 'EUR' });
def(EN, 'gbp pound sterling', ['CUR'], { v: 'GBP' }); def(EN, 'ils nis shekel', ['CUR'], { v: 'ILS' });
def(EN, 'currency currencies', ['CURN', 'SURFACE'], { flags: ['disp'] });
def(EN, 'want wanna prefer rather wish need hope love', ['DESIRE']);
def(EN, 'can could may might possible possibility', ['POSSIBLE']);
def(EN, 'pretend assume suppose imagine hypothetically', ['SIM']);
def(EN, 'tekango', ['BRAND']);
def(EN, 'rate rates symbol symbols sign signs stand stands abbreviation abbreviate abbreviated worth history origin meaning mean means calculator converter conversion chart graph plot widget ounce lb kilogram kilo gram weight weigh weighs', ['KNOW']);
def(EN, 'bank wire transfer salary loan deposit withdraw withdrawal invest investment stock crypto cryptocurrency paypal stripe mortgage debit', ['BANK']);
def(EN, 'create creating created make making issue issuing write writing send sending generate generating build building prepare preparing draft drafting add adding save saving', ['DOCV']);
def(EN, 'proposal invoice offer estimate document pdf item service', ['DOCN']);
def(EN, 'the', ['DET']);
// verbs with roles: i = instruction, s = state-changing, o = override (accusative object), w = working / display
const V_EN: Array<[string, string[]]> = [
  ['show', ['i', 'w']], ['display', ['i', 'w']], ['give', ['i']], ['switch', ['i', 's', 'o', 'w']], ['convert', ['i', 's']], ['change', ['i', 's', 'o']],
  ['set', ['i', 's', 'o']], ['treat', ['i', 's', 'o']], ['consider', ['i', 's', 'o']], ['regard', ['i', 's', 'o']], ['make', ['i', 's', 'o']],
  ['move', ['i', 's', 'o']], ['see', ['i', 'w', 'o']], ['use', ['i', 'w']], ['put', ['i', 's', 'o']], ['render', ['i']], ['present', ['i']], ['list', ['i']],
  ['update', ['i', 's']], ['turn', ['i', 's', 'o']], ['swap', ['i', 's']], ['toggle', ['i']], ['enable', ['i', 's']], ['activate', ['i', 's']], ['apply', ['i', 's']],
  ['mark', ['i', 's', 'o']], ['classify', ['i', 's', 'o']], ['count', ['i', 's', 'o']], ['register', ['o']], ['identify', ['o']], ['recognize', ['o']],
  ['recognise', ['o']], ['handle', ['w', 'o']], ['process', ['o']], ['take', ['o']], ['view', ['w']], ['work', ['w']], ['working', ['w']],
  ['operate', ['w']], ['run', ['w']], ['using', ['w']], ['used', ['w']], ['displayed', ['w']], ['shown', ['w']], ['support', ['w']],
];
for (const [w, f] of V_EN) EN.set(w, { cats: [...(EN.get(w)?.cats ?? []), 'VERB'], flags: [...(EN.get(w)?.flags ?? []), ...f.map((x) => `v_${x}`)] });

// ---- Hebrew (stems, bare; prefixes are stripped by the clitic analysis)
def(HE, 'אני הייתי', ['SELF'], { flags: ['subj'] }); def(HE, 'אנחנו אנו כולנו שנינו שלושתנו ארבעתנו היינו', ['SELF'], { pl: true, flags: ['subj'] });
def(HE, 'אותי אליי אלי', ['SELF'], { flags: ['obj'] }); def(HE, 'אותנו אלינו', ['SELF'], { pl: true, flags: ['obj'] });
def(HE, 'לי', ['SELF'], { flags: ['dat'] }); def(HE, 'לנו', ['SELF'], { pl: true, flags: ['dat'] });
def(HE, 'שלי', ['POSS']); def(HE, 'שלנו', ['POSS'], { pl: true });
def(HE, 'חשבון עסק פרופיל מנוי חברה ארגון', ['ENTITY'], { flags: ['acct', 'subj'] });
def(HE, 'חשבוני עסקי פרופילי', ['ENTITY'], { flags: ['acct', 'subj', 'own'] }); def(HE, 'חשבוננו עסקנו פרופילנו', ['ENTITY'], { pl: true, flags: ['acct', 'subj', 'own'] });
def(HE, 'דשבורד מערכת אפליקציה ממשק אתר פלטפורמה', ['SURFACE'], { flags: ['acct', 'disp'] });
def(HE, 'מחיר מחירי מחירים תמחור תמחורי מחירון תוכנית תוכניות עלות עלויות סכומים הכל הצעה הצעות מטבע', ['SURFACE'], { flags: ['disp'] });
def(HE, 'לקוח לקוחה משתמש משתמשת ספק עובד', ['PERSON'], { flags: ['third'] });
def(HE, 'לקוחות משתמשים משתמשות ספקים עובדים', ['PERSON'], { pl: true, flags: ['third'] });
def(HE, 'בעל בעלת אנשים', ['PERSON']);
def(HE, 'מקומי מקומית מקומיים מקומיות ישראלי ישראלית ישראלים ישראליים ישראליות', ['MKT'], { v: 'LOCAL' });
def(HE, 'בינלאומי בינלאומית בינלאומיים בינלאומיות בין-לאומי בינ"ל זר זרה זרים זרות חו"ל', ['MKT'], { v: 'INTERNATIONAL' });
def(HE, 'שוק שווקים אזור מדינה', ['MNOUN']);
def(HE, 'גרסה מצב סוג', ['DESC']);
def(HE, 'משויך משויכת משויכים משויכות שייך שייכת שייכים שייכות נמצא נמצאת נמצאים נמצאות נכלל נכללת נכללים נכללות משתייך משתייכת משתייכים', ['BELONG']);
def(HE, 'מוגדר מוגדרת מוגדרים מוגדרות רשום רשומה רשומים רשומות מסווג מסווגת מסווגים נחשב נחשבת נחשבים נחשבות מוכר מוכרת מוכרים מסומן מסומנת מסומנים מקוטלג מזוהה מזוהים', ['PART']);
def(HE, 'הוא היא הם הן זה זו', ['COP'], { flags: ['pron'] }); def(HE, 'נקובים מוצגים', ['COP']);
def(HE, 'בעצם למעשה ממש כרגע כעת עכשיו גם באמת בכלל פשוט כן כנראה לכאורה אכן בהחלט עדיין רק בלבד אולי נראה כאן פה עוד', ['ADV']);
def(HE, 'את הזה הזאת כל הנוכחי הנוכחית הקיים הקיימת', ['DET']); def(HE, 'בבקשה נא', ['POLITE']);
def(HE, 'לא אין', ['NEG']); def(HE, 'אבל אז כי אך לכן', ['CONJ']); def(HE, 'או', ['OR']);
def(HE, 'האם', ['Q']); def(HE, 'מה איזה איזו', ['WH']);
def(HE, 'דולר דולרים דולרית', ['CUR'], { v: 'USD' }); def(HE, 'יורו אירו', ['CUR'], { v: 'EUR' }); def(HE, 'ליש"ט פאונד פאונדים סטרלינג', ['CUR'], { v: 'GBP' });
def(HE, 'שקל שקלים ש"ח', ['CUR'], { v: 'ILS' });
def(HE, 'usd', ['CUR'], { v: 'USD' }); def(HE, 'eur', ['CUR'], { v: 'EUR' }); def(HE, 'gbp', ['CUR'], { v: 'GBP' }); def(HE, 'ils nis', ['CUR'], { v: 'ILS' });
def(HE, 'מטבע מטבעות', ['CURN', 'SURFACE'], { flags: ['disp'] });
def(HE, 'רוצה רוצים מעדיף מעדיפה מעדיפים מעדיפות מעוניין מעוניינת מעוניינים צריך צריכה צריכים מבקש מבקשת מבקשים', ['DESIRE']);
def(HE, 'אשמח', ['DESIRE'], { flags: ['selfdesire'] });
def(HE, 'אפשר אפשרי ניתן מותר אפשרות יכול יכולה יכולים יכולות אוכל נוכל', ['POSSIBLE']);
def(HE, 'נניח נגיד תדמיין דמיין תדמייני דמייני כאילו נאמר הנח בהנחה', ['SIM']);
def(HE, 'tekango', ['BRAND']);
def(HE, 'שער שערי סמל קיצור נוסחה היסטוריה מקור משמעות ממיר מחשבון גרף גרפים תרשים תרשימים וידג\'ט', ['KNOW']);
def(HE, 'בנק בנקאית העברה משכורת הלוואה פיקדון משכנתא השקעה קריפטו פייפאל', ['BANK']);
def(HE, 'ליצור יצירת לעשות להוציא הוצאת לכתוב כתיבת לשלוח שליחת להפיק הפקת להכין הכנת להוסיף הוספת לשמור לחייב', ['DOCV']);
def(HE, 'חשבונית חשבוניות מסמך פריט שירות', ['DOCN']);
const V_HE: Array<[string, string[]]> = [
  ['תראה', ['i']], ['הראה', ['i']], ['תראי', ['i']], ['הראי', ['i']], ['תציג', ['i']], ['הצג', ['i']], ['תציגי', ['i']], ['הציגי', ['i']],
  ['תשנה', ['i', 's']], ['שני', ['i', 's']], ['תשני', ['i', 's']], ['העבר', ['i', 's', 'o']], ['תעביר', ['i', 's', 'o']], ['העבירי', ['i', 's', 'o']], ['תעבירי', ['i', 's', 'o']],
  ['תמיר', ['i', 's']], ['המר', ['i', 's']], ['תגדיר', ['i', 's', 'o']], ['הגדר', ['i', 's', 'o']], ['תחשיב', ['i', 's', 'o']], ['תתייחס', ['i', 's', 'o']], ['התייחס', ['i', 's', 'o']],
  ['תתייחסי', ['i', 's', 'o']], ['התייחסי', ['i', 's', 'o']], ['תפעיל', ['i', 's']], ['הפעל', ['i', 's']], ['תעבוד', ['i', 's']], ['תעבור', ['i', 's']], ['תחליף', ['i', 's']],
  ['החלף', ['i', 's']], ['תשים', ['i']], ['שים', ['i']], ['תן', ['i']], ['תני', ['i']], ['תחיל', ['i', 's']], ['תסמן', ['i', 's', 'o']], ['סמן', ['i', 's', 'o']],
  ['תסווג', ['i', 's', 'o']], ['סווג', ['i', 's', 'o']], ['לעבוד', ['w']], ['לפעול', ['w']], ['להציג', ['w']], ['הצגה', ['w']], ['להראות', ['w']], ['לראות', ['w']],
  ['ראות', ['w']], ['להשתמש', ['w']], ['להגדיר', ['w']], ['לתמוך', ['w']], ['מוצג', ['w']], ['לעבור', ['w', 's']], ['להעביר', ['w', 's']],
  ['תומכת', ['brandverb']], ['תומך', ['brandverb']], ['מציגה', ['brandverb']], ['מציג', ['brandverb']], ['עובדת', ['brandverb']], ['עובד', ['brandverb']],
];
// a Hebrew word may be both a verb and a noun ("עובד" works / employee): the verb reading is ADDED to an existing entry, never replaces it
for (const [w, f] of V_HE) { const e = HE.get(w); HE.set(w, { cats: [...(e?.cats ?? []), 'VERB'], v: e?.v, pl: e?.pl, flags: [...(e?.flags ?? []), ...f.map((x) => `v_${x}`)] }); }
for (const w of 'ב ל ה מ כ ו ש'.split(' ')) HE.set(w, { cats: ['PREP'] });

// multi-word units (English), matched longest-first on the raw word list
const MWE_EN: Array<{ seq: string[]; e: Entry }> = [
  { seq: ['belong', 'to'], e: { cats: ['BELONG'] } }, { seq: ['belongs', 'to'], e: { cats: ['BELONG'] } }, { seq: ['belonging', 'to'], e: { cats: ['BELONG'] } },
  { seq: ['part', 'of'], e: { cats: ['BELONG'] } }, { seq: ['falls', 'under'], e: { cats: ['BELONG'] } }, { seq: ['fall', 'under'], e: { cats: ['BELONG'] } },
  { seq: ['seem', 'to', 'be'], e: { cats: ['COP'] } }, { seq: ['seems', 'to', 'be'], e: { cats: ['COP'] } }, { seq: ['appear', 'to', 'be'], e: { cats: ['COP'] } },
  { seq: ['appears', 'to', 'be'], e: { cats: ['COP'] } }, { seq: ['turn', 'out', 'to', 'be'], e: { cats: ['COP'] } },
  { seq: ['in', 'fact'], e: { cats: ['ADV'] } }, { seq: ['in', 'every', 'respect'], e: { cats: ['ADV'] } }, { seq: ['through', 'and', 'through'], e: { cats: ['ADV'] } }, { seq: ['to', 'the', 'core'], e: { cats: ['ADV'] } }, { seq: ['as', 'well'], e: { cats: ['ADV'] } }, { seq: ['kind', 'of'], e: { cats: ['ADV'] } }, { seq: ['sort', 'of'], e: { cats: ['ADV'] } },
  { seq: ['act', 'as', 'if'], e: { cats: ['SIM'] } }, { seq: ['act', 'like'], e: { cats: ['SIM'] } }, { seq: ['as', 'if'], e: { cats: ['SIM'] } }, { seq: ['as', 'though'], e: { cats: ['SIM'] } },
  { seq: ['let', 'us', 'say'], e: { cats: ['SIM'] } }, { seq: ['what', 'if'], e: { cats: ['SIM'] } }, { seq: ['for', 'the', 'sake', 'of'], e: { cats: ['SIM'] } },
  { seq: ['let', 'us', 'pretend'], e: { cats: ['SIM'] } }, { seq: ['say', 'that'], e: { cats: ['SIM'] } },
  { seq: ['able', 'to'], e: { cats: ['POSSIBLE'] } }, { seq: ['way', 'to'], e: { cats: ['POSSIBLE'] } }, { seq: ['will', 'it', 'work'], e: { cats: ['POSSIBLE'] } },
  { seq: ['would', 'like'], e: { cats: ['DESIRE'], flags: ['nosubj'] } }, { seq: ['would', 'prefer'], e: { cats: ['DESIRE'], flags: ['nosubj'] } },
  { seq: ['would', 'rather'], e: { cats: ['DESIRE'], flags: ['nosubj'] } }, { seq: ['would', 'love'], e: { cats: ['DESIRE'], flags: ['nosubj'] } },
  { seq: ['how', 'much'], e: { cats: ['PRICEQ'] } }, { seq: ['credit', 'card'], e: { cats: ['BANK'] } }, { seq: ['price', 'list'], e: { cats: ['SURFACE'], flags: ['disp'] } },
  { seq: ['us', 'dollars'], e: { cats: ['CUR'], v: 'USD' } }, { seq: ['us', 'dollar'], e: { cats: ['CUR'], v: 'USD' } }, { seq: ['pounds', 'sterling'], e: { cats: ['CUR'], v: 'GBP' } },
  { seq: ['pound', 'sterling'], e: { cats: ['CUR'], v: 'GBP' } }, { seq: ['non', 'israeli'], e: { cats: ['MKT'], v: 'INTERNATIONAL' } },
  { seq: ['business', 'owner'], e: { cats: ['PERSON'] } }, { seq: ['business', 'owners'], e: { cats: ['PERSON'], pl: true } },
];
MWE_EN.sort((a, b) => b.seq.length - a.seq.length);
// (the Hebrew table is applied longest-first as well)
const QUANT_HEAD = new Set(['everyone', 'everybody', 'all', 'both', 'each', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'half', 'most', 'some', 'none']);
const SELF_QUANT: Entry = { cats: ['SELF'], pl: true, flags: ['subj', 'obj', 'quant'] };
const MWE_HE: Array<{ seq: string[]; e: Entry }> = [
  { seq: ['לכל', 'דבר', 'ועניין'], e: { cats: ['ADV'] } }, { seq: ['לכל', 'דבר'], e: { cats: ['ADV'] } },
  { seq: ['בא', 'לי'], e: { cats: ['DESIRE'], flags: ['selfdesire'] } }, { seq: ['בא', 'לנו'], e: { cats: ['DESIRE'], flags: ['selfdesire'] } },
  { seq: ['תעמיד', 'פנים'], e: { cats: ['SIM'] } }, { seq: ['העמד', 'פנים'], e: { cats: ['SIM'] } }, { seq: ['ככל', 'הנראה'], e: { cats: ['ADV'] } },
  { seq: ['מה', 'זה'], e: { cats: ['KNOW'] } }, { seq: ['כרטיס', 'אשראי'], e: { cats: ['BANK'] } },
];

function contractionsEn(w: string): string[] {
  if (w === "let's") return ['let', 'us'];
  if (w === "can't") return ['can', 'not'];
  if (w === "won't") return ['will', 'not'];
  if (/n't$/.test(w)) return [w.slice(0, -3), 'not'];
  if (/'m$/.test(w)) return [w.slice(0, -2), 'am'];
  if (/'re$/.test(w)) return [w.slice(0, -3), 'are'];
  if (/'s$/.test(w) && ['it', 'that', 'this', 'what', 'there', 'here', 'who'].includes(w.slice(0, -2))) return [w.slice(0, -2), 'is'];
  if (/'ve$/.test(w)) return [w.slice(0, -3), 'have'];
  if (/'(?:d|ll)$/.test(w)) return [w.replace(/'(?:d|ll)$/, ''), 'would'];
  return [w];
}
const HE_LETTER = /[א-ת]/;
const HE_PFX = /^[וש]?[בלמכ]?ה?$/; // [ו|ש]? [ב|ל|מ|כ]? ה?

function lookupEn(w: string): { e: Entry; pl: boolean } | null {
  const direct = EN.get(w); if (direct) return { e: direct, pl: !!direct.pl };
  const cands: string[] = [];
  if (w.endsWith('ies') && w.length > 4) cands.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) cands.push(w.slice(0, -2));
  if (w.endsWith('s')) cands.push(w.slice(0, -1));
  for (const c of cands) { const e = EN.get(c); if (e) return { e, pl: true }; }
  return null;
}
function analyzeHe(w: string): Tok {
  for (let k = 0; k <= 2 && (k === 0 || k < w.length - 1); k += 1) {
    const pfx = w.slice(0, k); const stem = w.slice(k);
    if (k > 0 && !(HE_PFX.test(pfx) && [...pfx].every((ch) => 'ובלמכהש'.includes(ch)))) continue;
    const e = HE.get(stem);
    if (e) return { w, c: e.cats, v: e.v, pl: e.pl, flags: e.flags ?? [], pfx, lang: 'he' };
  }
  return { w, c: ['OTHER'], flags: [], pfx: '', lang: 'he' };
}
function tokenizeWords(sentence: string): Tok[] {
  const raw = sentence.split(' ').map((x) => x.replace(/^[()[\]{}"'*_<>«»…]+|[()[\]{}"'*_<>«»…]+$/g, '')).filter(Boolean);
  const words: string[] = [];
  for (const r of raw) { if (r === ',' ) { words.push(','); continue; } for (const part of r.split(/(,)/)) { if (part === ',') words.push(','); else if (part) words.push(part); } }
  // English contractions and multi-word units on the word list
  const expanded: string[] = [];
  for (const w of words) { if (HE_LETTER.test(w)) expanded.push(w); else expanded.push(...contractionsEn(w)); }
  const toks: Tok[] = [];
  let i = 0;
  while (i < expanded.length) {
    const w = expanded[i];
    if (w === ',') { toks.push({ w, c: ['COMMA'], flags: [], pfx: '', lang: 'x' }); i += 1; continue; }
    // quantified self: "all of us", "both of us", "every one of us", "the two of us", "each of us"
    if (w === 'of' && expanded[i + 1] === 'us' && toks.length > 0) {
      const prev = toks[toks.length - 1];
      if (QUANT_HEAD.has(prev.w)) {
        toks.pop();
        while (toks.length > 0 && ['the', 'every', 'each'].includes(toks[toks.length - 1].w)) toks.pop();
        toks.push({ w: 'us*', c: [...SELF_QUANT.cats], pl: true, flags: [...(SELF_QUANT.flags ?? [])], pfx: '', lang: 'en' });
        i += 2; continue;
      }
    }
    const isHe = HE_LETTER.test(w);
    const table = isHe ? MWE_HE : MWE_EN;
    let merged = false;
    for (const m of table) {
      if (i + m.seq.length <= expanded.length && m.seq.every((s, k) => expanded[i + k] === s)) {
        toks.push({ w: m.seq.join(' '), c: m.e.cats, v: m.e.v, pl: m.e.pl, flags: m.e.flags ?? [], pfx: '', lang: isHe ? 'he' : 'en' });
        i += m.seq.length; merged = true; break;
      }
    }
    if (merged) continue;
    if (/\d/.test(w)) { toks.push({ w, c: ['DIGIT'], flags: [], pfx: '', lang: 'x' }); i += 1; continue; }
    if (/^[$€£₪]$/.test(w)) { toks.push({ w, c: ['CUR'], v: w === '$' ? 'USD' : w === '€' ? 'EUR' : w === '£' ? 'GBP' : 'ILS', flags: [], pfx: '', lang: 'x' }); i += 1; continue; }
    if (isHe) { toks.push(analyzeHe(w)); i += 1; continue; }
    // possessive of a person noun ("customer's prices"): the person noun itself, flagged genitive - never an unknown word that hides the third party
    if (/'s$/.test(w)) {
      const base = lookupEn(w.slice(0, -2));
      if (base && base.e.cats.includes('PERSON')) { toks.push({ w, c: [...base.e.cats], pl: base.pl, flags: [...(base.e.flags ?? []), 'genitive'], pfx: '', lang: 'en' }); i += 1; continue; }
    }
    const hit = lookupEn(w);
    if (hit) toks.push({ w, c: [...hit.e.cats], v: hit.e.v, pl: hit.pl, flags: [...(hit.e.flags ?? [])], pfx: '', lang: 'en' });
    else toks.push({ w, c: ['OTHER'], flags: [], pfx: '', lang: 'en' });
    i += 1;
  }
  // context-dependent readings: "like" after a first-person subject is a desire; plain desire verbs need a first-person subject before them
  for (let k = 0; k < toks.length; k += 1) {
    const t = toks[k];
    if (t.w === 'like' && k > 0 && toks[k - 1].c.includes('SELF') && toks[k - 1].flags.includes('subj')) { t.c = ['DESIRE']; }
    if (t.lang === 'en' && t.c.includes('DESIRE') && !t.flags.includes('nosubj')) {
      const before = toks.slice(Math.max(0, k - 8), k);
      if (!before.some((b) => b.c.includes('SELF') && b.flags.includes('subj'))) t.c = t.c.filter((c) => c !== 'DESIRE').concat(['OTHER']);
    }
    if (t.lang === 'he' && t.c.includes('DESIRE') && !t.flags.includes('selfdesire')) {
      if (!toks.some((b) => b.c.includes('SELF') && b.flags.includes('subj'))) t.c = t.c.filter((c) => c !== 'DESIRE').concat(['OTHER']);
    }
  }
  return toks;
}
const has = (t: Tok | undefined, c: Cat): boolean => !!t && t.c.includes(c);
const flag = (t: Tok | undefined, f: string): boolean => !!t && t.flags.includes(f);

// ---------------------------------------------------------------------------------------------------------------------------------
// STAGE 4 - PARSE. Every matcher works on TAGGED TOKENS and fills a normalized ClauseIntent.
interface Ctx { question: boolean; guarded: boolean }
const SKIP = (t: Tok): boolean => has(t, 'ADV') || has(t, 'DET') || has(t, 'POLITE') || has(t, 'Q');
const SCOPE_PREPS = new Set(['of', 'on', 'in', 'for', 'at', 'with']);

interface NP { end: number; market?: AccountMarket; markets: number; person: boolean; entity: boolean; mnoun: boolean; desc: boolean; plural: boolean }
/** target noun phrase: determiners / adverbs / market words / person, account and market nouns; must contain a market word */
function readTargetNP(tk: Tok[], start: number): NP | null {
  let j = start; let markets = 0; let market: AccountMarket | undefined; let mixed = false;
  const np: NP = { end: start, markets: 0, person: false, entity: false, mnoun: false, desc: false, plural: false };
  while (j < tk.length) {
    const t = tk[j];
    if (has(t, 'MKT')) { markets += 1; const v = t.v as AccountMarket; if (market && market !== v) mixed = true; market = market ?? v; }
    else if (has(t, 'PERSON')) { np.person = true; if (t.pl) np.plural = true; }
    else if (has(t, 'ENTITY') || (has(t, 'SURFACE') && flag(t, 'acct'))) np.entity = true;
    else if (has(t, 'MNOUN')) np.mnoun = true;
    else if (has(t, 'DESC')) np.desc = true;
    else if (has(t, 'DET') || has(t, 'ADV') || has(t, 'OR') || (has(t, 'PREP') && t.lang === 'he' && t.w.length === 1)) { /* skippable inside the phrase */ }
    else break;
    j += 1;
  }
  if (markets === 0) return null;
  // trim trailing skippables so the tail check starts at a real word
  np.end = j; np.markets = markets; np.market = mixed ? undefined : market;
  return np;
}
/** what may follow a target phrase: adverbs, determiners, politeness, a conjunction / comma (a new clause), or a scope complement ("of this dashboard") */
function tailOk(tk: Tok[], from: number): boolean {
  for (let j = from; j < tk.length; j += 1) {
    const t = tk[j];
    if (has(t, 'CONJ') || has(t, 'COMMA')) return true;
    if (has(t, 'ADV') || has(t, 'DET') || has(t, 'POLITE') || has(t, 'OR')) continue;
    if (has(t, 'PREP') && (t.lang === 'he' || SCOPE_PREPS.has(t.w))) {
      let k = j + 1;
      while (k < tk.length && (has(tk[k], 'DET') || has(tk[k], 'POSS') || has(tk[k], 'ADV'))) k += 1;
      if (k < tk.length && (has(tk[k], 'SURFACE') || has(tk[k], 'ENTITY') || has(tk[k], 'BRAND'))) { j = k; continue; }
      return false;
    }
    return false;
  }
  return true;
}

interface Subject { end: number; kind: 'self' | 'entity' | 'pron'; subject: IntentSubject; number: IntentNumber }
function entitySubject(name: string): IntentSubject {
  return name === 'profile' || name === 'פרופיל' || name === 'פרופילי' || name === 'פרופילנו' ? 'PROFILE' : name === 'account' || name === 'חשבון' || name === 'חשבוני' || name === 'חשבוננו' ? 'ACCOUNT' : 'BUSINESS';
}
const num = (pl?: boolean): IntentNumber => (pl ? 'PLURAL' : 'SINGULAR');
/** SELF / ACCOUNT-owned subject starting at i (the ownership check that keeps CRM objects out) */
function readSubject(tk: Tok[], i: number): Subject | null {
  const t = tk[i];
  if (!t) return null;
  if (has(t, 'SELF') && flag(t, 'subj')) return { end: i + 1, kind: 'self', subject: 'SELF', number: num(t.pl) };
  if (t.lang === 'en') {
    const n = tk[i + 1];
    if (has(t, 'POSS') && has(n, 'ENTITY') && flag(n, 'subj')) return { end: i + 2, kind: 'entity', subject: entitySubject(n!.w.replace(/s$/, '')), number: num(t.pl) };
    if (has(t, 'DET') && ['the', 'this', 'that'].includes(t.w) && has(n, 'ENTITY') && flag(n, 'subj')) return { end: i + 2, kind: 'entity', subject: entitySubject(n!.w.replace(/s$/, '')), number: 'SINGULAR' };
    if (has(t, 'DET') && ['this', 'that'].includes(t.w)) return { end: i + 1, kind: 'pron', subject: 'NONE', number: 'SINGULAR' };
    if (t.w === 'it') return { end: i + 1, kind: 'pron', subject: 'NONE', number: 'SINGULAR' };
    return null;
  }
  // Hebrew: ENTITY + שלי/שלנו, an inherently possessed entity (חשבוני), or a definite entity (החשבון)
  if (has(t, 'ENTITY') && flag(t, 'subj')) {
    const n = tk[i + 1];
    if (has(n, 'POSS')) return { end: i + 2, kind: 'entity', subject: entitySubject(t.w.slice(t.pfx.length)), number: num(n!.pl) };
    if (flag(t, 'own')) return { end: i + 1, kind: 'entity', subject: entitySubject(t.w.slice(t.pfx.length)), number: num(t.pl) };
    if (t.pfx.includes('ה')) { let e = i + 1; if (has(tk[e], 'DET') && ['הזה', 'הזאת'].includes(tk[e].w)) e += 1; return { end: e, kind: 'entity', subject: entitySubject(t.w.slice(t.pfx.length)), number: 'SINGULAR' }; }
  }
  if (has(t, 'COP') && flag(t, 'pron')) return { end: i + 1, kind: 'pron', subject: 'NONE', number: t.w === 'הם' || t.w === 'הן' ? 'PLURAL' : 'SINGULAR' };
  return null;
}

function modalityOf(tk: Tok[], ctx: Ctx, hasSim: boolean): IntentModality {
  if (hasSim) return 'SIMULATION';
  if (ctx.question || has(tk[0], 'Q') || has(tk[0], 'AUX') || (has(tk[0], 'COP') && tk[0].lang === 'en')) return 'QUESTION';
  if (tk.some((t) => has(t, 'DESIRE'))) return 'DESIRE';
  if (tk.some((t) => has(t, 'POSSIBLE'))) return 'QUESTION';
  if (tk.some((t) => has(t, 'VERB') && (flag(t, 'v_i') || flag(t, 'v_o')))) return 'REQUEST';
  return 'ASSERTION';
}
const polarityOf = (tk: Tok[]): 'POSITIVE' | 'NEGATIVE' => (tk.some((t) => has(t, 'NEG')) ? 'NEGATIVE' : 'POSITIVE');

/** IDENTITY / BELONGS_TO_MARKET: SUBJECT (adverbs) COPULA | BELONG (adverbs, prepositions) TARGET-NP, plus the inverted question order */
function matchIdentity(tk: Tok[], ctx: Ctx): ClauseIntent | null {
  const hasSim = tk.some((t) => has(t, 'SIM'));
  const hasOwnedEntity = tk.some((t, k) => has(t, 'ENTITY') && (flag(t, 'own') || has(tk[k + 1], 'POSS') || t.pfx.includes('ה')));
  for (let i = 0; i < tk.length; i += 1) {
    let subj = readSubject(tk, i);
    let j = subj ? subj.end : i;
    let inverted = false;
    if (!subj) {
      // inverted question: COP / AUX + subject + ...
      if ((has(tk[i], 'COP') && tk[i].lang === 'en') || has(tk[i], 'AUX')) { subj = readSubject(tk, i + 1); if (subj) { j = subj.end; inverted = true; } }
    }
    if (!subj) continue;
    const english = (inverted ? tk[i + 1] : tk[i]).lang === 'en';
    // a bare Hebrew pronoun is only an account subject in a simulation / next to an owned account ("כאילו הוא בינלאומי")
    if (subj.kind === 'pron' && !english && !hasOwnedEntity) continue;
    let cop = inverted; let belong = false; let prep = false; let onlyAs = true;
    while (j < tk.length) {
      const t = tk[j];
      if (has(t, 'ADV') || has(t, 'DET') || has(t, 'NEG') || has(t, 'MODAL') || (has(t, 'POSSIBLE') && t.lang === 'en')) { j += 1; continue; }
      if (has(t, 'COMMA') && has(tk[j + 1], 'ADV') && has(tk[j + 2], 'COMMA')) { j += 3; continue; }   // parenthetical adverbial: ", in fact,"
      if (has(t, 'PART') && (t.lang === 'he' || cop)) { cop = true; j += 1; continue; }
      if (has(t, 'COP')) { cop = true; j += 1; continue; }
      if (has(t, 'BELONG')) { belong = true; j += 1; continue; }
      if (has(t, 'PREP') && t.lang === 'en' && ['in', 'under', 'within', 'of', 'to', 'from', 'as'].includes(t.w)) { prep = true; if (t.w !== 'as') onlyAs = false; j += 1; continue; }
      if (has(t, 'PREP') && t.lang === 'he') { j += 1; continue; }
      break;
    }
    const np = readTargetNP(tk, j);
    if (!np) continue;
    if (english && !cop && !belong) continue;
    if (prep && !onlyAs && !np.mnoun) continue;
    if (subj.kind === 'pron' && english && !(np.entity || np.mnoun)) continue;
    if (!tailOk(tk, np.end)) continue;
    const relation: IntentRelation = belong || (prep && !onlyAs) ? 'BELONGS_TO_MARKET' : 'IDENTITY';
    return { text: tk.map((t) => t.w).join(' '), subject: subj.subject === 'NONE' ? 'ACCOUNT' : subj.subject, subjectNumber: np.plural ? 'PLURAL' : subj.number, relation, targetMarket: np.market, modality: modalityOf(tk, ctx, hasSim), polarity: polarityOf(tk) };
  }
  return null;
}

/** MARKET_OVERRIDE_REQUEST: VERB + OBJECT(self / own account) [as|to|into|like] TARGET-NP - the object must be the user or the account, never a third party */
function matchOverride(tk: Tok[], ctx: Ctx): ClauseIntent | null {
  const hasSim = tk.some((t) => has(t, 'SIM'));
  for (let i = 0; i < tk.length; i += 1) {
    const v = tk[i];
    if (!has(v, 'VERB') || !flag(v, 'v_o')) continue;
    let j = i + 1;
    while (j < tk.length && (has(tk[j], 'POLITE') || has(tk[j], 'ADV') || (has(tk[j], 'DET') && tk[j].lang === 'he'))) j += 1;
    const o = tk[j]; let end = -1; let subject: IntentSubject = 'SELF'; let number: IntentNumber = 'UNKNOWN';
    if (has(o, 'SELF') && (flag(o, 'obj') || flag(o, 'quant')) && !flag(o, 'dat')) { end = j + 1; number = num(o.pl); }
    else if (o && o.lang === 'en' && has(o, 'POSS') && has(tk[j + 1], 'ENTITY')) { end = j + 2; subject = entitySubject(tk[j + 1].w.replace(/s$/, '')); number = num(o.pl); }
    else if (o && o.lang === 'en' && has(o, 'DET') && ['the', 'this', 'that'].includes(o.w) && has(tk[j + 1], 'ENTITY')) { end = j + 2; subject = entitySubject(tk[j + 1].w.replace(/s$/, '')); number = 'SINGULAR'; }
    else if (o && o.lang === 'he' && has(o, 'ENTITY') && flag(o, 'subj')) {
      if (has(tk[j + 1], 'POSS')) { end = j + 2; number = num(tk[j + 1].pl); } else if (flag(o, 'own') || o.pfx.includes('ה')) end = j + 1;
      subject = entitySubject(o.w.slice(o.pfx.length));
    }
    if (end < 0) continue;
    let k = end;
    while (k < tk.length && (has(tk[k], 'PREP') || has(tk[k], 'ADV') || has(tk[k], 'SIM') || (has(tk[k], 'COP') && (flag(tk[k], 'pron') || tk[k].lang === 'en')) || (has(tk[k], 'DET') && tk[k].lang === 'en'))) k += 1;
    const np = readTargetNP(tk, k);
    if (!np || !tailOk(tk, np.end)) continue;
    return { text: tk.map((t) => t.w).join(' '), subject, subjectNumber: np.plural ? 'PLURAL' : number, relation: 'MARKET_OVERRIDE_REQUEST', targetMarket: np.market, modality: hasSim ? 'SIMULATION' : 'REQUEST', polarity: polarityOf(tk) };
  }
  return null;
}

/** implicit-subject switch: "switch to the local market", "אפשר לעבור לחשבון בינלאומי?" - a state-changing verb whose destination is a market / account of a market */
function matchImplicitSwitch(tk: Tok[], ctx: Ctx): ClauseIntent | null {
  const selfish = tk.some((t) => has(t, 'SELF') || (has(t, 'ENTITY') && flag(t, 'own'))) || tk.some((t) => has(t, 'POSSIBLE') || has(t, 'DESIRE'));
  for (let i = 0; i < tk.length; i += 1) {
    const v = tk[i];
    if (!has(v, 'VERB') || !flag(v, 'v_s')) continue;
    // destination: English "to / into" + NP; Hebrew: an NP whose head carries the ל prefix
    let p = -1;
    for (let j = i + 1; j < tk.length; j += 1) {
      const t = tk[j];
      if (t.lang === 'en' && has(t, 'PREP') && (t.w === 'to' || t.w === 'into')) { p = j + 1; break; }
      if (t.lang === 'he' && t.pfx.includes('ל') && (has(t, 'ENTITY') || has(t, 'MNOUN') || has(t, 'MKT'))) { p = j; break; }
      if (!(has(t, 'ADV') || has(t, 'DET') || has(t, 'POLITE') || has(t, 'SELF') || has(t, 'POSS') || has(t, 'ENTITY') || (has(t, 'PREP') && t.w === 'from'))) break;
    }
    if (p < 0) continue;
    const np = readTargetNP(tk, p);
    if (!np || !(np.entity || np.mnoun || np.desc) || !tailOk(tk, np.end)) continue;
    if (!(selfish || i === 0 || tk.slice(0, i).every((t) => has(t, 'POLITE') || has(t, 'ADV') || has(t, 'CONJ')))) continue;
    const possible = tk.some((t) => has(t, 'POSSIBLE'));
    return { text: tk.map((t) => t.w).join(' '), subject: 'SELF', subjectNumber: 'UNKNOWN', relation: 'MARKET_OVERRIDE_REQUEST', targetMarket: np.market, modality: possible || ctx.question ? 'QUESTION' : tk.some((t) => has(t, 'DESIRE')) ? 'DESIRE' : 'REQUEST', polarity: polarityOf(tk) };
  }
  return null;
}

/** MARKET_QUERY: a wh-question about which market the user / owned account is in (both languages) */
function matchMarketQuery(tk: Tok[], _ctx: Ctx): ClauseIntent | null {
  for (let i = 0; i < tk.length - 1; i += 1) {
    if (!has(tk[i], 'WH')) continue;
    if (!(has(tk[i + 1], 'MNOUN'))) continue;
    const owned = tk.some((t) => has(t, 'SELF') || (has(t, 'ENTITY') && (flag(t, 'own') || t.pfx.includes('ה'))) || has(t, 'POSS'));
    if (owned) return { text: tk.map((t) => t.w).join(' '), subject: 'SELF', subjectNumber: 'UNKNOWN', relation: 'MARKET_QUERY', modality: 'QUESTION', polarity: 'POSITIVE' };
  }
  return null;
}

/** "change / switch / set my currency / market / region / country" - a state-changing verb on the account's market attribute */
function matchAttributeChange(tk: Tok[], ctx: Ctx): ClauseIntent | null {
  if (ctx.guarded || currencyGuards(tk) || thirdPartyPerson(tk)) return null;
  for (let i = 0; i < tk.length; i += 1) {
    if (!(has(tk[i], 'VERB') && flag(tk[i], 'v_s'))) continue;
    for (let j = i + 1; j < Math.min(tk.length, i + 5); j += 1) {
      const t = tk[j];
      if (has(t, 'MNOUN') || has(t, 'CURN')) {
        const cur = has(t, 'CURN');
        const stem = t.w.slice(t.pfx.length);
        if (!(cur || ['region', 'regions', 'country', 'countries', 'market', 'markets', 'שוק', 'אזור', 'מדינה'].includes(stem))) continue;
        return { text: tk.map((x) => x.w).join(' '), subject: 'SELF', subjectNumber: 'UNKNOWN', relation: cur ? 'DISPLAY_REQUEST' : 'MARKET_OVERRIDE_REQUEST', modality: 'REQUEST', polarity: 'POSITIVE' };
      }
      if (!(has(t, 'POSS') || has(t, 'DET') || has(t, 'ADV') || has(t, 'POLITE') || has(t, 'SELF'))) break;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// currency intents
function currencyGuards(tk: Tok[]): boolean {
  if (tk.some((t) => has(t, 'DIGIT') || has(t, 'PRICEQ') || has(t, 'BANK'))) return true;
  for (let i = 0; i < tk.length; i += 1) {
    const t = tk[i];
    if (has(t, 'KNOW')) return true;
    if (/^conver(?:t|ts|ting|ted)$/.test(t.w)) {
      const n = tk[i + 1]; const n2 = tk[i + 2];
      const selfTarget = has(n, 'SELF') || has(n, 'POSS') || (has(n, 'DET') && (has(n2, 'ENTITY') || has(n2, 'SURFACE'))) || ['prices', 'price', 'pricing', 'everything', 'all'].includes(n?.w ?? '') || n?.w === 'prices';
      if (!selfTarget) return true;
    }
    // "how (do I | to | can I) write / spell / type / say / pronounce / abbreviate"
    if (t.w === 'how') { for (let k = i + 1; k < Math.min(tk.length, i + 4); k += 1) if (['write', 'spell', 'type', 'say', 'pronounce', 'abbreviate'].includes(tk[k].w)) return true; }
    // "price(s) / cost(s) of", "what is/are the price(s)/cost(s)", plan names
    if ((t.w === 'price' || t.w === 'prices' || t.w === 'cost' || t.w === 'costs') && tk[i + 1]?.w === 'of') return true;
    if (t.w === 'what' && has(tk[i + 1], 'COP') && has(tk[i + 2], 'DET') && ['price', 'prices', 'cost', 'costs'].includes(tk[i + 3]?.w ?? '')) return true;
    if (['pro', 'basic', 'free', 'premium', 'starter', 'business'].includes(t.w) && ['plan', 'plans', 'tier', 'package'].includes(tk[i + 1]?.w ?? '')) return true;
    if (['plan', 'tier'].includes(t.w) && ['pro', 'basic'].includes(tk[i + 1]?.w ?? '')) return true;
    // Hebrew: "כמה עולה / עולים / זה עולה", "מחיר / עלות של|ה...", "תוכנית PRO / BASIC / FREE"
    if (t.w === 'כמה' && ['עולה', 'עולים', 'שווה', 'עלה'].includes(tk[i + 1]?.w ?? '')) return true;
    if (t.w === 'כמה' && tk[i + 1]?.w === 'זה' && tk[i + 2]?.w === 'עולה') return true;
    if (t.lang === 'he' && ['מחיר', 'עלות'].includes(t.w.slice(t.pfx.length)) && (tk[i + 1]?.w === 'של' || tk[i + 1]?.pfx?.includes('ה'))) return true;
    if (t.lang === 'he' && t.w.slice(t.pfx.length) === 'תוכנית' && ['pro', 'basic', 'free', 'פרו', 'בייסיק'].includes(tk[i + 1]?.w ?? '')) return true;
    if (t.lang === 'he' && t.w === 'איך' && ['כותבים', 'אומרים', 'מקצרים', 'מבטאים', 'מאייתים'].includes(tk[i + 1]?.w ?? '')) return true;
    // creating / sending a quote-type document in a currency is a quote-content question
    if (has(t, 'DOCV')) for (let k = i + 1; k < Math.min(tk.length, i + 5); k += 1) if (has(tk[k], 'DOCN') || (has(tk[k], 'SURFACE') && /^quotes?$/.test(tk[k].w)) || (tk[k].lang === 'he' && ['הצעה', 'הצעות', 'לקוח'].includes(tk[k].w.slice(tk[k].pfx.length)))) return true;
  }
  return false;
}
function firstCurrency(tk: Tok[]): AccountCurrency | undefined {
  const c = tk.find((t) => has(t, 'CUR'));
  return c ? (c.v as AccountCurrency) : undefined;
}
/** account anchor: "my / our / this / the (whole) <account | dashboard | app | system ...>"; Hebrew: "חשבון" in any form, other entities with an article / preposition / possessive */
function accountAnchor(tk: Tok[]): boolean {
  for (let i = 0; i < tk.length; i += 1) {
    const t = tk[i];
    if (!(has(t, 'ENTITY') || has(t, 'SURFACE')) || !flag(t, 'acct')) continue;
    if (t.lang === 'he') { if (t.w.slice(t.pfx.length).startsWith('חשבון') || t.w.slice(t.pfx.length) === 'חשבוני' || t.pfx !== '' || has(tk[i + 1], 'POSS') || flag(t, 'own')) return true; continue; }
    let k = i - 1; while (k >= 0 && has(tk[k], 'ADV') && ['whole', 'entire'].includes(tk[k].w)) k -= 1;
    if (k >= 0 && (has(tk[k], 'POSS') || (has(tk[k], 'DET') && ['the', 'this', 'that'].includes(tk[k].w)))) return true;
    if (k >= 0 && tk[k].w === 'whole') return true;
  }
  return false;
}
function displayObject(tk: Tok[]): boolean {
  return tk.some((t, i) => (has(t, 'SURFACE') && flag(t, 'disp') && !flag(t, 'acct')) || (has(t, 'SURFACE') && flag(t, 'acct') && accountAnchor(tk.slice(Math.max(0, i - 3), i + 1))) || /^(?:price list|everything)$/.test(t.w));
}
function initialInstruction(tk: Tok[]): boolean {
  for (let i = 0; i < tk.length; i += 1) {
    const t = tk[i];
    if (has(t, 'VERB') && flag(t, 'v_i')) {
      if (t.lang === 'he') return true;
      return tk.slice(0, i).every((p) => has(p, 'POLITE') || has(p, 'ADV') || has(p, 'CONJ') || has(p, 'POSSIBLE') || has(p, 'AUX') || has(p, 'SELF') || (has(p, 'OTHER') && p.w === 'you'));
    }
  }
  return false;
}
const BE_QUERY_PRICE = new Set(['price', 'prices', 'pricing', 'מחיר', 'מחירים', 'תמחור']);
function matchCurrencyQuery(tk: Tok[]): ClauseIntent | null {
  const cur = firstCurrency(tk);
  // (a) "what / which currency ..." / "in what currency ..." / "באיזה מטבע ..." with an account / price context
  for (let i = 0; i < tk.length - 1; i += 1) {
    if (has(tk[i], 'WH') && has(tk[i + 1], 'CURN')) {
      const priceWord = tk.some((t) => has(t, 'SURFACE') && flag(t, 'disp') && !has(t, 'CURN'));
      const acctWord = tk.some((t) => has(t, 'ENTITY') || (has(t, 'SURFACE') && flag(t, 'acct')));
      const billing = tk.some((t) => ['billed', 'charged', 'shown', 'displayed', 'מוצג', 'מציגים', 'מחייבים'].includes(t.w));
      const selfUse = tk.some((t) => has(t, 'SELF')) && tk.some((t) => ['seeing', 'see', 'using', 'use', 'get'].includes(t.w));
      const ctxOk = priceWord || acctWord || billing || selfUse;
      if (ctxOk) return { text: tk.map((t) => t.w).join(' '), subject: 'ACCOUNT', subjectNumber: 'UNKNOWN', relation: 'CURRENCY_QUERY', targetCurrency: cur, modality: 'QUESTION', polarity: 'POSITIVE' };
    }
  }
  if (!cur) return null;
  // (b) yes / no: "Are the prices in USD?" - only be-verb, determiners, brand, prepositions, "only" around ONE price word and ONE currency
  const rest = tk.filter((t) => !(has(t, 'ADV') || has(t, 'DET') || has(t, 'COP') || has(t, 'PREP') || has(t, 'BRAND') || has(t, 'Q')));
  if (rest.length === 2 && BE_QUERY_PRICE.has(rest[0].w.slice(rest[0].pfx.length)) && has(rest[1], 'CUR')) {
    const enOk = tk[0].lang !== 'en' || has(tk[0], 'COP');
    if (enOk) return { text: tk.map((t) => t.w).join(' '), subject: 'ACCOUNT', subjectNumber: 'UNKNOWN', relation: 'CURRENCY_QUERY', targetCurrency: cur, modality: 'QUESTION', polarity: 'POSITIVE' };
  }
  // (c) "does TEKANGO (only) support / use / show / display <currency>", "האם TEKANGO תומכת רק ב<currency>"
  const bi = tk.findIndex((t) => has(t, 'BRAND'));
  if (bi >= 0) {
    const vi = tk.findIndex((t, k) => k > bi && (['support', 'use', 'show', 'display'].includes(t.w) || flag(t, 'v_brandverb')));
    const ci = tk.findIndex((t) => has(t, 'CUR'));
    if (vi > bi && ci > vi && (tk[0].lang === 'he' || has(tk[0], 'AUX') || tk.some((t) => has(t, 'AUX')))) return { text: tk.map((t) => t.w).join(' '), subject: 'ACCOUNT', subjectNumber: 'UNKNOWN', relation: 'CURRENCY_QUERY', targetCurrency: cur, modality: 'QUESTION', polarity: 'POSITIVE' };
  }
  return null;
}

/**
 * POSITIVE PROOF that a person noun is the user's own: it is the PREDICATE of a SELF identity ("we are (really) international customers", "אנחנו (בעצם) לקוחות
 * בינלאומיים", "are we overseas clients?") - a SELF subject reached by walking back over fillers (adverbs, determiners, market words, negation, modals) and, in English,
 * over the copula / participle. A person noun anywhere else (a bare compound "customer prices", a possessive "customer's prices", "my clients", "the client",
 * "מחיר לקוח", "הלקוח", "ללקוח") names a THIRD party.
 */
function selfProvenPerson(tk: Tok[], i: number): boolean {
  let k = i - 1;
  while (k >= 0 && (has(tk[k], 'ADV') || has(tk[k], 'DET') || has(tk[k], 'MKT') || has(tk[k], 'NEG') || has(tk[k], 'OR') || has(tk[k], 'MODAL'))) k -= 1;
  if (k < 0) return false;
  if (has(tk[k], 'SELF') && flag(tk[k], 'subj')) return true;
  if (tk[k].lang === 'en' && (has(tk[k], 'COP') || has(tk[k], 'PART'))) {
    let j = k - 1;
    while (j >= 0 && (has(tk[j], 'ADV') || has(tk[j], 'NEG') || has(tk[j], 'MODAL') || has(tk[j], 'COP') || has(tk[j], 'PART'))) j -= 1;
    return j >= 0 && has(tk[j], 'SELF') && flag(tk[j], 'subj');
  }
  return false;
}
/** Hebrew "משתמש" (user / uses) and "עובד" (employee / works) are nouns AND participles: right after an account / possessive / brand subject ("החשבון שלי משתמש", "המערכת משתמשת", "TEKANGO עובדת") the word is the VERB, not a person */
function hebrewUserVerb(tk: Tok[], i: number): boolean {
  const t = tk[i]; const p = tk[i - 1];
  return t.lang === 'he' && ['משתמש', 'משתמשת', 'משתמשים', 'משתמשות', 'עובד', 'עובדת', 'עובדים', 'עובדות'].includes(t.w.slice(t.pfx.length))
    && !!p && (has(p, 'POSS') || has(p, 'ENTITY') || has(p, 'BRAND') || (has(p, 'SURFACE') && flag(p, 'acct')));
}
/** a customer / client / user / supplier ... that is NOT proven to be the user's own: a currency for THEM (their prices, totals, fees) is not the account's currency */
function thirdPartyPerson(tk: Tok[]): boolean {
  return tk.some((t, i) => has(t, 'PERSON') && flag(t, 'third') && !hebrewUserVerb(tk, i) && !selfProvenPerson(tk, i));
}
function matchCurrency(tk: Tok[], ctx: Ctx): ClauseIntent | null {
  if (ctx.guarded || currencyGuards(tk) || thirdPartyPerson(tk)) return null;
  const q = matchCurrencyQuery(tk);
  if (q) return q;
  const cur = firstCurrency(tk);
  if (!cur) return null;
  const acct = accountAnchor(tk); const disp = displayObject(tk);
  const self = tk.some((t) => has(t, 'SELF')); const selfObj = tk.some((t) => has(t, 'SELF') || has(t, 'POSS'));
  const work = tk.some((t) => has(t, 'VERB') && flag(t, 'v_w'));
  const sim = tk.some((t) => has(t, 'SIM')); const possible = tk.some((t) => has(t, 'POSSIBLE'));
  const desire = tk.some((t) => has(t, 'DESIRE'));
  const state = tk.some((t) => has(t, 'VERB') && flag(t, 'v_s'));
  const n = tk.filter((t) => !has(t, 'COMMA')).length;
  const base = { text: tk.map((t) => t.w).join(' '), subject: (self || tk.some((t) => flag(t, 'selfdesire')) ? 'SELF' : acct ? 'ACCOUNT' : 'NONE') as IntentSubject, subjectNumber: 'UNKNOWN' as IntentNumber, targetCurrency: cur, polarity: 'POSITIVE' as const };
  if (sim && (acct || disp || selfObj)) return { ...base, relation: 'DISPLAY_REQUEST', modality: 'SIMULATION' };
  if (possible && (acct || disp || (self && work))) return { ...base, relation: 'CURRENCY_CAPABILITY', modality: 'QUESTION' };
  if (initialInstruction(tk)) {
    if (disp || acct) return { ...base, relation: 'DISPLAY_REQUEST', modality: 'REQUEST' };
    if (selfObj && state) return { ...base, relation: 'DISPLAY_REQUEST', modality: 'REQUEST' };
  }
  if (desire && (disp || acct || work || n <= 10)) return { ...base, relation: 'CURRENCY_PREFERENCE', modality: 'DESIRE' };
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------------------
/** units analysed per sentence: the whole sentence and every comma / conjunction clause of it */
function unitsOf(tk: Tok[]): Tok[][] {
  const units: Tok[][] = [tk];
  let cur: Tok[] = [];
  const parts: Tok[][] = [];
  for (const t of tk) { if (has(t, 'COMMA') || has(t, 'CONJ')) { if (cur.length) parts.push(cur); cur = []; } else cur.push(t); }
  if (cur.length) parts.push(cur);
  if (parts.length > 1) units.push(...parts);
  return units;
}

/** STAGES 2-4: text -> normalized account market / currency intent (clauses). Empty `clauses` = not an account market / currency intent. */
export function parseAccountMarketIntent(raw: unknown): AccountMarketIntent {
  const text = normalizeAccountMarketText(String(raw ?? ''));
  const clauses: ClauseIntent[] = [];
  if (!text) return { clauses };
  const seen = new Set<string>();
  for (const s of segmentSentences(text)) {
    const tk = tokenizeWords(s.text);
    if (!tk.length) continue;
    const ctx: Ctx = { question: s.question, guarded: currencyGuards(tk) };
    for (const unit of unitsOf(tk)) {
      const c = matchMarketQuery(unit, ctx) ?? matchIdentity(unit, ctx) ?? matchOverride(unit, ctx) ?? matchImplicitSwitch(unit, ctx) ?? matchAttributeChange(unit, ctx) ?? matchCurrency(unit, ctx);
      if (!c) continue;
      const key = `${c.relation}|${c.targetMarket ?? ''}|${c.targetCurrency ?? ''}|${c.modality}`;
      if (seen.has(key)) continue;
      seen.add(key); clauses.push(c);
    }
  }
  return { clauses };
}

/** Inspection helper (tests / audits): the tagged tokens of every sentence - shows exactly how the lexicon and the Hebrew clitic morphology read a message. */
export function describeAccountMarketTokens(raw: unknown): Array<Array<{ w: string; cats: string[]; prefix: string }>> {
  return segmentSentences(normalizeAccountMarketText(String(raw ?? ''))).map((s) => tokenizeWords(s.text).map((t) => ({ w: t.w, cats: [...t.c], prefix: t.pfx })));
}
