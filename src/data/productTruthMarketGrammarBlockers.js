// INTENT GRAMMAR - TWO REMAINING BLOCKERS (Product Truth). LOCKED acceptance data. Answers "CODEX PRODUCT TRUTH FINAL NORMALIZED-GRAMMAR ACCEPTANCE: FAIL":
//   BLOCKER 1 - CRM / third-party over-routing: a currency-display request that mentions a person noun ("customer prices", "client totals", "user fees", "supplier costs",
//               "customer's prices", "מחיר לקוח") must prove SELF / owned-account targeting before entering ACCOUNT_MARKET;
//   BLOCKER 2 - Hebrew prefix + currency symbol ("בא לי לראות תמחור ב-£") must normalize for $ / € / £ / ₪.
// Compositional generators + the exact Codex cases. Data only - the classifier never reads it (a source guard proves none of these strings is hardcoded there).

/** the six negative controls Codex proved over-routed as ACCOUNT_CURRENCY_OVERRIDE_REQUEST (6 / 64) */
export const BLOCKER1_CODEX_NEGATIVES = Object.freeze([
  'Show customer prices in dollars.', 'Display client totals in EUR.', "Show a customer's prices in GBP.", 'List user fees in USD.', 'Present supplier costs in euros.', 'הצג מחיר לקוח בדולר.',
]);
/** the failing in-domain example (BLOCKER 2) */
export const BLOCKER2_CODEX_POSITIVE = 'בא לי לראות תמחור ב-£.';

/** third-party display negatives: person noun x display noun x verb x currency x compound form (English), never an account intent */
export function thirdPartyDisplayNegativesEn() {
  const persons = ['customer', 'client', 'user', 'supplier', 'vendor', 'employee', 'member', 'contact'];
  const display = ['prices', 'totals', 'fees', 'costs', 'amounts', 'figures'];
  const verbs = ['Show', 'Display', 'List', 'Present'];
  const currencies = ['dollars', 'USD', 'EUR', 'GBP', 'euros', 'pounds'];
  const out = [];
  for (const p of persons) for (const d of display) for (const v of verbs) for (const c of currencies) {
    out.push({ klass: 'bare-compound', prompt: `${v} ${p} ${d} in ${c}.` });
    out.push({ klass: 'possessive-singular', prompt: `${v} a ${p}'s ${d} in ${c}.` });
    out.push({ klass: 'possessive-definite', prompt: `${v} the ${p}'s ${d} in ${c}.` });
    out.push({ klass: 'plural-compound', prompt: `${v} ${p}s ${d} in ${c}.` });
    out.push({ klass: 'plural-possessive', prompt: `${v} ${p}s' ${d} in ${c}.` });
    out.push({ klass: 'for-the-person', prompt: `${v} ${d} for the ${p} in ${c}.` });
    out.push({ klass: 'my-person', prompt: `${v} my ${p} ${d} in ${c}.` });
  }
  return out;
}
/** Hebrew third-party display negatives: verb x (construct / definite) display noun x person x currency (with the ב prefix) */
export function thirdPartyDisplayNegativesHe() {
  const verbs = ['הצג', 'תציג', 'תראה'];
  const persons = ['לקוח', 'לקוחות', 'משתמש', 'ספק', 'עובד'];
  const display = ['מחיר', 'מחירי', 'מחירים', 'תמחור', 'עלות', 'סכומים'];
  const currencies = ['בדולר', 'ביורו', 'בשקלים', 'בליש"ט'];
  const out = [];
  for (const v of verbs) for (const d of display) for (const p of persons) for (const c of currencies) {
    out.push({ klass: 'he-construct', prompt: `${v} ${d} ${p} ${c}.` });
    out.push({ klass: 'he-of-person', prompt: `${v} ${d} של ${p} ${c}` });
    out.push({ klass: 'he-to-person', prompt: `${v} ${d} ל${p} ${c}` });
    out.push({ klass: 'he-definite-person', prompt: `${v} ${d} ה${p} ${c}` });
  }
  return out;
}

/** positives that MUST keep routing: SELF / owned-account currency requests, and person nouns that are the PREDICATE of a SELF identity (positive proof) */
export function selfCurrencyPositives() {
  const cur = ['dollars', 'USD', 'EUR', 'GBP', 'euros', 'pounds'];
  const out = [];
  for (const c of cur) {
    for (const t of ['Show me prices in {c}.', 'Show us all the prices in {c}', 'Display the prices in {c}', 'Please show my account totals in {c}', 'I want prices in {c}', 'Can my account work in {c}?',
      'Set the whole dashboard to {c}', 'Switch me to {c}', 'Give me the pricing in {c}', 'Show me the amounts in {c}']) out.push({ klass: 'self-currency', prompt: t.replace('{c}', c) });
    for (const m of ['international', 'overseas', 'foreign']) for (const noun of ['customers', 'clients', 'users']) {
      out.push({ klass: 'self-proven-plural', prompt: `We are ${m} ${noun}, show prices in ${c}.` });
      out.push({ klass: 'self-proven-plural-adverb', prompt: `We really are ${m} ${noun}—show us the totals in ${c}.` });
    }
    out.push({ klass: 'self-proven-singular', prompt: `I am an international user who wants ${c}.` });
    out.push({ klass: 'self-proven-question', prompt: `Are we overseas clients? Show me prices in ${c}.` });
  }
  const heCur = ['בדולר', 'ביורו', 'בשקלים', 'בליש"ט'];
  for (const c of heCur) {
    for (const t of ['תראה לי מחירים {c}', 'תציג לנו את המחירים {c}', 'אני רוצה לראות מחירים {c}', 'אפשר להציג בדשבורד מחירים {c}?', 'תעביר את החשבון שלי {c}']) out.push({ klass: 'he-self-currency', prompt: t.replace('{c}', c) });
    for (const noun of ['לקוחות בינלאומיים', 'משתמשים זרים', 'לקוחות מחו"ל']) out.push({ klass: 'he-self-proven', prompt: `אנחנו ${noun}, תציג לי מחירים ${c}` });
    out.push({ klass: 'he-self-proven-singular', prompt: `אני משתמש זר ואני רוצה לראות מחירים ${c}` });
    out.push({ klass: 'he-verb-uses', prompt: 'איזה מטבע החשבון שלי משתמש?' });
  }
  return out;
}

/** BLOCKER 2: Hebrew prefix (hyphenated, attached, stacked) x currency symbol x frame - all must route as an account currency intent */
export const SYMBOLS = Object.freeze(['$', '€', '£', '₪']);
export const SYMBOL_PREFIXES = Object.freeze(['ב-', 'ל-', 'ב', 'ל', 'וב-', 'שב-', 'ול-']);
export function symbolPrefixCases() {
  const templates = ['בא לי לראות תמחור {X}.', 'אני רוצה לראות מחירים {X}', 'אפשר להציג מחירים {X}?', 'תציג לי מחירים {X}', 'הייתי רוצה לעבוד {X}', 'תעביר את החשבון שלי {X}'];
  const out = [];
  for (const t of templates) for (const p of SYMBOL_PREFIXES) for (const s of SYMBOLS) out.push({ klass: t, prompt: t.replace('{X}', `${p}${s}`) });
  return out;
}
/** the same frames with a NUMBER after the symbol are prices / amounts, not an account currency preference - must stay off the route */
export function symbolWithNumberNegatives() {
  const out = [];
  for (const p of ['ב-', 'ב']) for (const s of SYMBOLS) for (const n of ['50', '100']) out.push({ klass: 'symbol-number', prompt: `בא לי לראות תמחור ${p}${s}${n}.` });
  return out;
}
