// Prepared cutover copy (PREPARED / OFF) for the in-app surfaces that today still run the legacy model (14-day trial,
// Free/Basic/Pro): AuthScreen signup text, signup-success notice, plan badge, Settings plan status, the pre-consumption
// notice and the Free-10 balance. Owner decisions OD-01/OD-02 (wording of the notice: change spec §5.1). NOT wired: while
// the activation phase is 'off' the legacy UI stays the truth (the legacy model is what a signup really gets), so these
// strings must not be shown - showing a Free-10 balance before the server ledger exists would be a fake balance.
// The cutover happens in ONE release together with server provisioning (spec Phase 5/10), never string by string.
import { FREE_QUOTES_TOTAL } from './priceCatalog';

export const CUTOVER_COPY = Object.freeze({
  he: Object.freeze({
    authSignup: `להרשמה ולקבלת ${FREE_QUOTES_TOTAL} הצעות מחיר חינם בסך הכול או 7 ימים, המוקדם מביניהם, יש למלא את הפרטים הבאים.`,
    signupSuccess: `ההרשמה הצליחה! מכינים את החשבון שלכם עם ${FREE_QUOTES_TOTAL} הצעות מחיר חינם...`,
    consumptionWarning: `פעולה זו תנצל הצעה אחת מתוך ${FREE_QUOTES_TOTAL} ההצעות החינמיות שלכם`,
    balance: (remaining) => `נותרו ${remaining} מתוך ${FREE_QUOTES_TOTAL} הצעות חינם`,
    exhausted: 'ניצלתם את 10 ההצעות החינמיות. הצעות שכבר יצאו ללקוחות נשארות זמינות.',
    badge: Object.freeze({ free10: 'חינם', classic: 'Classic', modern: 'Modern', visual: 'Visual', legacy: 'מסלול קודם' }),
  }),
  en: Object.freeze({
    authSignup: `Sign up to get ${FREE_QUOTES_TOTAL} free quotes in total or 7 days, whichever comes first.`,
    signupSuccess: `Sign-up successful! Setting up your account with ${FREE_QUOTES_TOTAL} free quotes...`,
    consumptionWarning: `This action will use 1 of your ${FREE_QUOTES_TOTAL} free quotes`,
    balance: (remaining) => `${remaining} of ${FREE_QUOTES_TOTAL} free quotes left`,
    exhausted: 'You have used your 10 free quotes. Quotes already sent to customers stay available.',
    badge: Object.freeze({ free10: 'Free', classic: 'Classic', modern: 'Modern', visual: 'Visual', legacy: 'Previous plan' }),
  }),
});

// The balance text exists ONLY for a server-authoritative Free-10 summary (parsed allowlist); anything else -> null, never a
// guessed or browser-computed number.
export function freeBalanceText(lang, summary) {
  const t = CUTOVER_COPY[lang === 'he' ? 'he' : 'en'];
  const f = summary?.freeQuotes;
  if (!summary || summary.accountMode !== 'free' || !f || f.limit !== FREE_QUOTES_TOTAL || !Number.isInteger(f.remaining) || f.remaining < 0 || f.remaining > FREE_QUOTES_TOTAL) return null;
  return f.remaining === 0 ? t.exhausted : t.balance(f.remaining);
}

// Which copy a surface may show: while off, ALWAYS the existing (legacy) copy.
export const cutoverCopyFor = (activationPhase) => (activationPhase === 'enforced' ? 'cutover' : 'legacy');
