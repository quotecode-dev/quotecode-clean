// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-17: תשובה מדויקת מהנתונים לשאלות על מספר ההצעות והסכומים שלהן בצ'אט".
// A question about how many quotes the account has / their amounts (all, approved, awaiting signature, drafts) is answered
// DETERMINISTICALLY from the account's own quotes (read with the caller's JWT, user_id = the verified user) - the model never guesses
// numbers and can never claim the product does not track approved quotes. The groups are exactly the quote list's own overview:
//  - approved = status approved | paid;  awaiting = not approved / paid, and sent OR viewed (QuotesTab overviewAwaiting, L-07);
//  - drafts = every other quote;  amounts are totalled PER CURRENCY (IRON-MARKET-004) - never one mixed sum.
// The plan-balance question ("how many quotes do I have LEFT") is NOT this route: it stays with the subscription truth.

export type QuoteStatRow = { status?: string | null; total?: number | string | null; currency?: string | null; view_count?: number | null };
type Group = { count: number; sums: Record<string, number> };
export type QuoteStats = { all: Group; approved: Group; awaiting: Group; drafts: Group };

const PLAN_WORDS_HE = /(נשאר|נותר|נותרו|נשארו|יתר[הת]|מסלול|חינם|חינמי|מנוי|מכס[הת]|הגבל|מוגבל|לשדרג|שדרוג|כמה עוד|אפשר עוד|מותר)/;
const PLAN_WORDS_EN = /\b(left|remaining|remain|plan|free|quota|limit|allowance|subscription|upgrade|can i still|allowed)\b/i;
const HE_QUOTES = /הצע(ות|ה)( מחיר)?/;
const HE_ASK = /(כמה|מה|מהו|מהי|תן לי|תני לי|תראה|תראי|הראה|מספר)/;
const HE_STAT = /(יש לי|יש בחשבון|נשלחו|אושרו|נחתמו|ממתינ|פתוחות|טיוט|סכום|סה["״]?כ|סך|שווי|סכומים|כולל|בסך הכול|סך הכל)/;
const EN_QUOTES = /\bquotes?\b/i;
const EN_ASK = /\b(how many|how much|number of|count|total|sum|value|worth|amount)\b/i;
const EN_STAT = /\b(have|sent|approved|signed|pending|awaiting|open|drafts?|total|sum|value|worth|amounts?)\b/i;

/** The message is about the plan / allowance (quotes LEFT, free, subscription...) - the subscription truth answers it. */
export function mentionsPlan(message: string): boolean {
  const m = String(message || '');
  return PLAN_WORDS_HE.test(m) || PLAN_WORDS_EN.test(m);
}

/** True for a question about the account's existing quotes - their number and / or their amounts. */
export function classifyQuoteStatsIntent(message: string): boolean {
  const m = String(message || '').trim();
  if (!m || m.length > 300) return false;
  if (PLAN_WORDS_HE.test(m) || PLAN_WORDS_EN.test(m)) return false;
  if (HE_QUOTES.test(m) && HE_ASK.test(m) && HE_STAT.test(m)) return true;
  if (EN_QUOTES.test(m) && EN_ASK.test(m) && EN_STAT.test(m)) return true;
  return false;
}

const emptyGroup = (): Group => ({ count: 0, sums: {} });
const CURRENCIES = new Set(['ILS', 'USD', 'EUR', 'GBP', 'CAD', 'AUD']);

export function computeQuoteStats(rows: QuoteStatRow[], accountCurrency: string): QuoteStats {
  const stats: QuoteStats = { all: emptyGroup(), approved: emptyGroup(), awaiting: emptyGroup(), drafts: emptyGroup() };
  const add = (g: Group, cur: string, amount: number) => { g.count += 1; g.sums[cur] = (g.sums[cur] || 0) + amount; };
  for (const q of Array.isArray(rows) ? rows : []) {
    if (!q) continue;
    const status = String(q.status || '').toLowerCase();
    const raw = String(q.currency || '').toUpperCase();
    const cur = CURRENCIES.has(raw) ? raw : accountCurrency;
    const n = Number(q.total || 0);
    const amount = Number.isFinite(n) ? n : 0;
    add(stats.all, cur, amount);
    if (status === 'approved' || status === 'paid') add(stats.approved, cur, amount);
    else if (status === 'sent' || Number(q.view_count || 0) > 0) add(stats.awaiting, cur, amount);
    else add(stats.drafts, cur, amount);
  }
  return stats;
}

const SYMBOL: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$' };
export const money = (cur: string, amount: number) => `${SYMBOL[cur] || `${cur} `}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// the account's own currency first, then the others in a fixed order - never added together
const amounts = (g: Group, accountCurrency: string, isHebrew: boolean) => {
  const order = [accountCurrency, ...['ILS', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'].filter((c) => c !== accountCurrency)];
  const parts = order.filter((c) => g.sums[c] !== undefined).map((c) => money(c, g.sums[c]));
  return parts.join(isHebrew ? ' ו-' : ' and ');
};

export function formatQuoteStatsAnswer(stats: QuoteStats, accountCurrency: string, isHebrew: boolean): string {
  if (!stats.all.count) {
    return isHebrew
      ? 'עדיין אין הצעות מחיר בחשבון שלך. כשתיצור הצעה, אוכל לסכם כאן כמה הצעות יש לך ומה הסכומים שלהן.'
      : 'There are no quotes in your account yet. Once you create one, I can sum up here how many quotes you have and their amounts.';
  }
  const line = (label: string, g: Group) => (isHebrew
    ? `• ${label}: ${g.count}${g.count ? `, בסך ${amounts(g, accountCurrency, true)}` : ''}`
    : `• ${label}: ${g.count}${g.count ? `, totalling ${amounts(g, accountCurrency, false)}` : ''}`);
  if (isHebrew) {
    return [
      'לפי ההצעות בחשבון שלך:',
      line('סך הכול', stats.all),
      line('אושרו (כולל ששולמו)', stats.approved),
      line('ממתינות לחתימה (נשלחו או נצפו)', stats.awaiting),
      line('טיוטות שעדיין לא נשלחו', stats.drafts),
      'את אותם מספרים רואים בראש רשימת הצעות המחיר, ובמסך „סטטיסטיקה” אפשר לראות אותם גם לפי תקופה.',
    ].join('\n');
  }
  return [
    'Based on the quotes in your account:',
    line('In total', stats.all),
    line('Approved (incl. paid)', stats.approved),
    line('Awaiting signature (sent or viewed)', stats.awaiting),
    line('Drafts not sent yet', stats.drafts),
    'The same numbers are shown at the top of your quote list, and the “Statistics” screen shows them by period as well.',
  ].join('\n');
}
