// ACCOUNT / SYSTEM-SUBJECT CURRENCY QUESTION FRAME - LOCKED acceptance data (Product Truth micro-delta).
// Answers "PRODUCT TRUTH v38 FINAL CODEX RE-REVIEW: PARTIAL": the explicit in-domain yes/no currency questions whose SUBJECT is the user's own account or the system
// ("האם החשבון שלי משתמש בדולר?", "האם המערכת עובדת ביורו?") had no grammar frame and fell through to free-form prose. Data only - the classifier never reads it.

/** the exact Codex failing questions (HE / Local persona, EN / International persona) */
export const ACCOUNT_SYSTEM_CODEX_QUESTIONS = Object.freeze([
  { lang: 'he', persona: 'LOCAL_PRO', prompt: 'האם החשבון שלי משתמש בדולר?' },
  { lang: 'he', persona: 'LOCAL_PRO', prompt: 'האם המערכת עובדת ביורו?' },
  { lang: 'en', persona: 'INTL_PRO', prompt: 'Does my account use dollars?' },
  { lang: 'en', persona: 'INTL_PRO', prompt: 'Does the system work in euros?' },
]);
/** the previously disclosed out-of-scope case: an impersonal question with NO self / account / system target - must stay OFF the route */
export const ACCOUNT_SYSTEM_OUT_OF_SCOPE = Object.freeze(['האם אפשר לעבוד ב-£?']);

const EN_CUR = ['dollars', 'USD', 'euros', 'EUR', 'pounds', 'GBP', 'shekels', 'ILS', '$', '€', '£', '₪'];
const HE_CUR = ['בדולר', 'ביורו', 'בשקלים', 'בליש"ט', 'ב-$', 'ב-€', 'ב-£', 'ב-₪'];

/** positives: subject (my / our / the / this account | system | app | dashboard, TEKANGO) x predicate (use / work in / support / is in / is using) x currency (word, code, symbol) */
export function accountSystemQuestionPositivesEn() {
  const out = [];
  const subjects = ['my account', 'our account', 'the account', 'this account', 'the system', 'this system', 'the app', 'the dashboard', 'TEKANGO'];
  for (const s of subjects) for (const c of EN_CUR) {
    const symbol = /^[$€£₪]$/.test(c);
    out.push({ klass: 'does-use', prompt: `Does ${s} use ${c}?` });
    if (!symbol) out.push({ klass: 'does-work-in', prompt: `Does ${s} work in ${c}?` });
    if (symbol) out.push({ klass: 'does-work-in-symbol', prompt: `Does ${s} work in ${c}?` });
    out.push({ klass: 'does-support', prompt: `Does ${s} support ${c}?` });
    out.push({ klass: 'is-in', prompt: `Is ${s} in ${c}?` });
    out.push({ klass: 'is-using', prompt: `Is ${s} using ${c}?` });
    out.push({ klass: 'is-working-in', prompt: `Is ${s} working in ${c}?` });
    out.push({ klass: 'is-set-to', prompt: `Is ${s} set to ${c}?` });
  }
  return out;
}
export function accountSystemQuestionPositivesHe() {
  const out = [];
  const masc = ['החשבון שלי', 'החשבון שלנו', 'החשבון', 'הדשבורד'];
  const fem = ['המערכת', 'האפליקציה'];
  for (const c of HE_CUR) {
    for (const s of masc) for (const v of ['משתמש', 'עובד', 'תומך']) out.push({ klass: 'he-masc-verb', prompt: `האם ${s} ${v} ${c}?` });
    for (const s of fem) for (const v of ['משתמשת', 'עובדת', 'תומכת']) out.push({ klass: 'he-fem-verb', prompt: `האם ${s} ${v} ${c}?` });
    for (const s of [...masc, ...fem]) out.push({ klass: 'he-nominal', prompt: `האם ${s} ${c}?` });
    for (const s of masc) out.push({ klass: 'he-participle', prompt: `האם ${s} מוגדר ${c}?` });
    out.push({ klass: 'he-brand', prompt: `האם TEKANGO עובדת ${c}?` });
  }
  return out;
}
/** natural paraphrases (a question mark, "please", an adverb, a statement-order Hebrew question) */
export const ACCOUNT_SYSTEM_PARAPHRASES = Object.freeze([
  'Is my account currently using dollars?', 'Does my account actually work in euros?', 'Please tell me: does the system use USD?', 'Is the app working in pounds?',
  'האם החשבון שלי עובד עם דולרים?', 'האם המערכת שלנו משתמשת ביורו?', 'האם החשבון שלי כרגע בשקלים?', 'המערכת עובדת ביורו?',
]);

/** negatives that MUST stay off the route unless structurally targeted */
export const ACCOUNT_SYSTEM_NEGATIVES = Object.freeze([
  // impersonal - no self / account / system target
  'האם אפשר לעבוד ב-£?', 'Is it possible to work in euros?', 'Can one work in dollars?',
  // third-party account / customer currency questions
  'Does my client account use dollars?', "Does my client's account use dollars?", 'Does the customer account use euros?', 'האם החשבון של הלקוח משתמש בדולר?', 'האם הלקוח שלי משתמש בדולר?', 'Does the supplier system work in euros?',
  'Does the system work in euros for my customers?', 'האם המערכת של הספק עובדת ביורו?',
  // price statements / numeric price forms
  'Does the system use 5 dollars?', 'Does my account cost 50 dollars?', 'האם החשבון שלי עולה 50 דולר?', 'Does my account use $5?', 'האם המערכת עובדת ב-€100?', 'The system works in euros', 'My account is in dollars',
  // unrelated "works" / "uses" verb contexts
  'Does my account work?', 'האם המערכת עובדת?', 'Does Excel use dollars?', 'Does the system work with Excel in euros?', 'Does my account use the dollar rate?', 'Does the system use the euro symbol?', 'האם המערכת עובדת עם שער הדולר?',
  'Does the system work on weekends?', 'האם החשבון שלי משתמש בסיסמה?',
]);
