// ACCOUNT MARKET / CURRENCY ROUTING MATRIX (Product Truth - market/currency routing closure). LOCKED acceptance data.
//
// The predeclared prompts every account market / currency INTENT must route to the deterministic ACCOUNT_MARKET route (structured
// `factPayload` present, never free-form model prose with `factPayload: null`), grouped by the semantic FRAME they use, plus the
// NEGATIVE controls that must NOT be over-routed. One list, three consumers: the classifier unit test, the live TEST routing capture
// (scripts/run-market-routing-matrix.mjs) and the free-form-leak gate. It is data, not classifier input: the runtime classifier
// (supabase/functions/chat-ai/marketTruth.ts) is semantic and must not contain any of these literal prompts (source-guard test).
//
// persona / language: Hebrew prompts are asked by the synthetic Local persona (LOCAL_PRO - HE / RTL / ILS); English prompts by the synthetic
// International persona (INTL_PRO - EN / LTR / international currency). The market of the account is a SERVER fact; the wording never changes it.

/** frame -> the intent kinds a prompt of that frame may normalize to (the route and the response are identical for all of them). */
export const FRAME_ALLOWED_KINDS = Object.freeze({
  desire: ['ACCOUNT_CURRENCY_OVERRIDE_REQUEST', 'ACCOUNT_MARKET_OVERRIDE_REQUEST'],
  possibility: ['ACCOUNT_CURRENCY_QUERY', 'ACCOUNT_MARKET_QUERY'],
  instruction: ['ACCOUNT_CURRENCY_OVERRIDE_REQUEST', 'ACCOUNT_MARKET_OVERRIDE_REQUEST'],
  assertion: ['ACCOUNT_MARKET_IDENTITY_ASSERTION', 'ACCOUNT_MARKET_OVERRIDE_REQUEST'],
  simulation: ['ACCOUNT_MARKET_OVERRIDE_REQUEST', 'ACCOUNT_CURRENCY_OVERRIDE_REQUEST'],
});

const HE = (family, prompts) => prompts.map((prompt) => ({ lang: 'he', persona: 'LOCAL_PRO', family, prompt }));
const EN = (family, prompts) => prompts.map((prompt) => ({ lang: 'en', persona: 'INTL_PRO', family, prompt }));

export const MARKET_ROUTING_MATRIX = Object.freeze([
  // ---- HE / Local persona ----
  ...HE('desire', ['אני רוצה לראות מחירים בדולר', 'אני רוצה לראות מחירים ביורו', 'אני מעדיף לראות דולר', 'הייתי רוצה לעבוד בליש"ט', 'אני רוצה שהחשבון יהיה בדולר', 'אני מעדיף דולר']),
  ...HE('possibility', ['אפשר לעבוד בדולר בחשבון שלי?', 'אפשר להציג לי מחירים בדולר?', 'החשבון שלי יכול לעבוד ביורו?', 'אפשר להציג מחירים ביורו?']),
  ...HE('instruction', ['תראה לי מחירים בדולר', 'תעביר אותי לדולר', 'תתייחס לחשבון שלי כאילו הוא בינלאומי']),
  ...HE('assertion', ['אני בעצם לקוח בינלאומי', 'החשבון שלי בינלאומי', 'אני משתמש מקומי']),
  ...HE('simulation', ['נניח שאני לקוח בינלאומי', 'תענה לי כאילו אני בינלאומי']),
  // ---- EN / International persona ----
  ...EN('desire', ['I want prices in USD', "I'd prefer EUR", 'I want my account in dollars', "I'd rather see USD"]),
  ...EN('possibility', ['Can my account work in USD?', 'Can I display prices in GBP?', 'Can I display prices in EUR?', 'Can this account use GBP?']),
  ...EN('instruction', ['Show me prices in USD', 'Switch me to dollars', 'Treat my account as International', 'Treat my account as Local']),
  ...EN('assertion', ["I'm actually a Local customer", 'My account is Local', 'This is an International account', "I'm actually an International customer"]),
  ...EN('simulation', ["Pretend I'm Local", 'Answer as if this were a Local account', "Pretend I'm International", 'Answer as if my account were Local']),
]);

/** Prompts Codex proved fell through to the free-form model before this closure (a subset of the matrix above, kept as a named group). */
export const CODEX_PROVEN_BYPASSES = Object.freeze([
  'אני רוצה לראות מחירים בדולר', 'אפשר להציג לי מחירים בדולר?', 'אני מעדיף לראות דולר', 'אפשר לעבוד בדולר בחשבון שלי?',
  'תתייחס לחשבון שלי כאילו הוא בינלאומי', 'Can my account work in USD?', 'Treat my account as Local',
]);

/** Unrelated currency / market mentions. None is an account market / currency intent: they keep their existing route (pricing block / capability router / model). */
export const MARKET_ROUTING_NEGATIVE_CONTROLS = Object.freeze([
  // the Owner-listed controls
  'מה שער הדולר היום?', 'מה הסמל של דולר?', 'איך כותבים USD?', 'Tell me what USD stands for', 'What is the exchange rate between USD and EUR?',
  // generic currency knowledge / calculation
  'What does EUR mean?', 'איך אומרים יורו באנגלית?', 'Convert 100 USD to EUR', 'כמה שווה ליש"ט בשקלים?', 'What is the history of the dollar?',
  // real pricing / feature questions (their own route)
  'How much does the Pro plan cost?', 'What is the price of the BASIC plan in dollars?', 'How much does the PRO plan cost in USD?', 'What are the prices in dollars?',
  'כמה עולה תוכנית PRO?', 'כמה עולה תוכנית BASIC בדולרים?', 'מה המחירים בדולר?', 'Which currencies does the calculator convert?', 'באילו מטבעות המחשבון תומך?',
  // quote-content (document creation) questions
  'Can I create a quote in USD?', 'Can I create a quote in euros?', 'אפשר ליצור הצעה בשקלים?', 'I want to send an invoice in dollars',
  // "local" / "international" used in a different sense
  'Do you support international customers?', "I'm looking for a local plumber", 'Do you offer international shipping?', 'I want to save the file locally',
  'אני מחפש משלוח בינלאומי', 'אילו לקוחות בינלאומיים יש לכם?',
  // other-subject possibility questions
  'Can Excel work with USD?', 'Do you have a currency converter?',
  // unrelated product questions
  'How do I add a new client to my account?', 'Can I attach files to a quote?', 'I want to cancel my subscription.', 'איך מוסיפים לקוח חדש?', 'אפשר להוריד הצעה כ-pdf?', 'יש לכם מחשבון?',
]);

/** Language-agnostic building blocks for the property generator (data only - the classifier never reads these). */
export const PROPERTY_CURRENCIES = Object.freeze({
  en: [{ n: 'USD' }, { n: 'EUR' }, { n: 'GBP' }, { n: 'dollars' }, { n: 'euros' }, { n: 'pounds' }],
  he: [{ n: 'דולר', b: 'בדולר', l: 'לדולר' }, { n: 'יורו', b: 'ביורו', l: 'ליורו' }, { n: 'ליש"ט', b: 'בליש"ט', l: 'לליש"ט' }, { n: 'דולרים', b: 'בדולרים', l: 'לדולרים' }],
});
export const PROPERTY_MARKETS = Object.freeze({
  en: ['International', 'Local'],
  he: [{ m: 'בינלאומי', f: 'בינלאומית' }, { m: 'מקומי', f: 'מקומית' }],
});

/**
 * Builder SELF BREAK-TEST corpus (paraphrases written AFTER the classifier and NOT used to design it; the three that first missed were then
 * fixed by widening a general lexicon / rule, not by adding the phrase). Kept as a regression set - it is disclosed evidence, not a proof of
 * completeness: an independent break-test may still find an unmodelled phrasing.
 */
export const SELF_BREAK_TEST = Object.freeze({
  positives: Object.freeze([
    'I would love to see everything in euros', 'Could you show my prices in pounds please', 'Is it possible to use dollars in my account?', 'I need my account to be in USD',
    'Please switch my account to euros', 'Would it be possible to view prices in GBP?', 'Can you make my account international?', 'Let me see prices in dollars',
    'I prefer working in EUR', 'Can we use USD here?', 'Can I switch to dollars?', 'I am an international user, please treat me that way', 'Suppose my account is international, what then?',
    'Just pretend my account is a local one', 'Act like I am an Israeli customer', 'Put my account in the international market', 'Is my account local or international?',
    'What market am I in?', 'I live abroad, so I want dollars', 'Could my account show prices in USD instead of shekels?',
    'אני מעדיפה לראות מחירים ביורו', 'אשמח לראות הכל בדולרים', 'אפשר לראות מחירים בליש"ט?', 'תציג לי הכל בדולר בבקשה', 'האם אפשר לעבוד עם דולרים בחשבון?', 'אנחנו רוצים לעבוד ביורו',
    'תשנה את החשבון שלי לבינלאומי', 'האם החשבון שלי בינלאומי?', 'אני גר בחו"ל אז אני רוצה דולר', 'תעמיד פנים שהחשבון שלי מקומי', 'בא לי לראות מחירים בדולר', 'אפשר שהמחירים יוצגו בדולרים?',
    'הצג לי את המחירים בשקלים', 'תדבר איתי כאילו אני לקוח ישראלי', 'באיזה שוק אני נמצא?',
  ]),
  negatives: Object.freeze([
    'What is the dollar rate today?', 'Explain how the euro works', 'I want to learn about pounds and ounces', 'Tell me about your international expansion plans', 'Is there a local office?',
    'Do you have a Hebrew version?', 'How do I change my password?', 'Can I export my clients?', 'I want to add a product priced at $50', 'Can I use my phone to sign quotes?',
    'מה ההבדל בין דולר ליורו?', 'איך אני משנה את הסיסמה שלי?', 'אפשר לייצא את הלקוחות?', 'אני רוצה להוסיף מוצר', 'האם יש לכם משרד מקומי?', 'תסביר לי מה זה יורו', 'אשמח לקבל הצעת מחיר',
    'Can I show my logo on the quote?', 'Can I display the total in words?', 'I want to see my quotes', 'הצג לי את ההצעות שלי', 'תראה לי את הלקוחות',
    // banking / money movement
    'I want to open a USD bank account', 'I want to wire dollars to my supplier', 'אני רוצה להעביר דולרים לבנק', 'אני רוצה לפתוח חשבון בנק בדולרים',
  ]),
});
