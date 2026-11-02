// Codex audit 2026-10-22 M-01 (Owner console 2026-10-22, typed: "מאשר שינוי ב-L-01 וב-L-22: חשבון שבוטל מקבל סיבה נפרדת ונוסח משלו
// במצב מוגבל, לפי חלק ד' בדוח של קודקס"): the words for a stopped renewal and for a limited paid account come from the reason the
// SERVER states (summary billing.renewalStopped / billing.limitedReason) - never inferred from the limited flag. A voluntary
// cancellation is never shown as a failed payment; a reason the server did not prove gets the neutral "paid period ended".
// Wording: docs/CODEX_PAYMENTS_PREP_AUDIT_2026-10-22.md part D. Display only: nothing is granted, limited or charged here.
import { formatShortDateTime } from '../../utils/shortDate';

const LIMITED = {
  he: {
    cancelled: 'המנוי הסתיים בעקבות בקשת הביטול שלכם, ולכן החשבון מוגבל.',
    payment_failed: 'התשלום לחידוש המנוי לא עבר, ולכן החשבון מוגבל.',
    period_ended: 'התקופה ששולמה הסתיימה, ולכן החשבון מוגבל.',
  },
  en: {
    cancelled: 'Your subscription has ended following your cancellation request, so the account is limited.',
    payment_failed: 'Your subscription renewal payment did not go through, so the account is limited.',
    period_ended: 'Your paid period has ended, so the account is limited.',
  },
};
const SHORT = {
  he: { cancelled: 'המנוי הסתיים לבקשתכם', payment_failed: 'התשלום לחידוש המנוי לא עבר', period_ended: 'התקופה ששולמה הסתיימה' },
  en: { cancelled: 'Subscription ended at your request', payment_failed: 'Renewal payment did not go through', period_ended: 'Paid period has ended' },
};
const KEEP = {
  he: 'ההצעות והלקוחות הקיימים נשארים זמינים.',
  en: 'Your existing quotes and clients remain available.',
};

const reasonOf = (reason) => (reason === 'cancelled' || reason === 'payment_failed' ? reason : 'period_ended');

/** the limited sentence by the server's reason (true / null / unknown = the neutral "paid period ended") */
export function limitedReasonSentence(reason, isHebrew, { withKeep = false } = {}) {
  const lang = isHebrew ? 'he' : 'en';
  const s = LIMITED[lang][reasonOf(reason)];
  return withKeep ? `${s} ${KEEP[lang]}` : s;
}

/** the end of the paid access, by the account's market (IRON-DATE-001), isolated so the numbers keep their order in Hebrew */
export function billingEndLabel(iso, isHebrew, market) {
  const local = market === 'IL';
  const when = formatShortDateTime(iso, local ? 'Local' : 'International');
  const zone = local ? (isHebrew ? 'שעון ישראל' : 'Israel time') : 'UTC';
  return `⁦${when}⁩ (${zone})`;
}

/** the short account-status detail from the server billing block, or null when it says nothing new */
export function billingStatusDetail(billing, isHebrew, market) {
  if (!billing || typeof billing !== 'object') return null;
  const lang = isHebrew ? 'he' : 'en';
  if (billing.limited === true) return SHORT[lang][reasonOf(billing.limitedReason)];
  if (billing.renewalStopped === true && typeof billing.paidThrough === 'string') {
    const until = billingEndLabel(billing.paidThrough, isHebrew, market);
    return isHebrew ? `החידוש האוטומטי הופסק — המנוי בתוקף עד ${until}` : `Automatic renewal is off — subscription valid until ${until}`;
  }
  return null;
}
