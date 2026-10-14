// In-app plans view model (PricingModal.jsx and the Free-10 upgrade window). Task 27 (§249 + the Owner's 2026-10-11 amendment, §253):
// Free-10, then ONE all-inclusive package billed monthly or annually; quote styles are not plans. Every amount comes from
// src/domain/subscriptions/packageCatalog.js through landingPackageFacts.js - the amount shown is the amount that would be billed:
// IL ₪30.00 / ₪306.00 including VAT (annual saving ₪54.00, exactly 15%); INTERNATIONAL $18.00 / $184.00 USD (saving $32.00, about 15%).
// Market = the server account market (else the account's recorded business market) - never the UI language. Purchase is not available
// (checkout is not activated), so nothing here starts a payment or changes a plan.
import { FREE_QUOTES_TOTAL, ilsPackageAmount, usdPackageAmount, ilsAnnualSaving, usdAnnualSaving, ilsAnnualSavingRate, usdAnnualSavingRate } from '../../components/landing/landingPackageFacts';
import { formatMoney, formatWholeMoney } from '../../utils/money';
import { PLAN_NAMES } from '../../../supabase/functions/_shared/subscriptionContract.ts';

export function pricingModalModel({ isHebrew, market }) {
  const lang = isHebrew ? 'he' : 'en';
  const il = market === 'IL';
  const amount = (period) => (il ? ilsPackageAmount(period) : usdPackageAmount(period).text);
  const rate = il ? ilsAnnualSavingRate() : usdAnnualSavingRate();
  const saving = il ? ilsAnnualSaving() : usdAnnualSaving();
  const per = isHebrew ? { month: '/ חודש', year: '/ שנה' } : { month: il ? '/ month' : 'USD / month', year: il ? '/ year' : 'USD / year' };
  const savingNote = isHebrew
    ? `חיסכון של ${rate.exact ? '' : 'כ-'}${rate.text} — ${saving} בשנה`
    : `Save ${rate.exact ? '' : 'approximately '}${rate.text} — ${saving} per year`; // Task 30: the Owner's in-app wording (em dash)
  const free = {
    id: 'free', name: PLAN_NAMES[lang].free,
    prices: [{ period: 'free', amount: il ? `₪${formatWholeMoney(0)}` : `$${formatMoney(0)}`, per: null }],
    lines: isHebrew
      ? [`${FREE_QUOTES_TOTAL} הצעות מחיר בסך הכול`, 'בלי הגבלת זמן', 'הצעה נספרת כשהיא יוצאת ללקוח; גרסה חדשה או לקוח אחר נספרים שוב', 'שליחה חוזרת של אותה גרסה לאותו לקוח לא נספרת שוב', 'טיוטות ותצוגה מקדימה לא נספרות']
      : [`${FREE_QUOTES_TOTAL} quotes in total`, 'No time limit', 'Counted when a quote reaches a client; a new version or another client counts again', 'Re-sending the same version to the same client is not counted again', 'Drafts and previews are not counted'],
  };
  const pkg = {
    id: 'all_inclusive', name: PLAN_NAMES[lang].all_inclusive,
    tagline: isHebrew ? 'מסלול אחד עם כל היכולות הזמינות במערכת, בתשלום חודשי או שנתי.' : 'One package with every available capability, billed monthly or annually.',
    prices: [
      { period: 'month', amount: amount('month'), per: per.month, note: null },
      { period: 'year', amount: amount('year'), per: per.year, note: savingNote },
    ],
    periodChoice: isHebrew ? { legend: 'תקופת חיוב', labels: { month: 'חודשי', year: 'שנתי' } } : { legend: 'Billing period', labels: { month: 'Monthly', year: 'Annual' } },
    lines: isHebrew
      ? [`אחרי ${FREE_QUOTES_TOTAL} ההצעות החינמיות`, 'המנוי החודשי מתחדש כל חודש, והשנתי כל שנה']
      : [`After the ${FREE_QUOTES_TOTAL} free quotes`, 'The monthly plan renews every month, the annual plan every year'],
  };
  return {
    plans: [free, pkg],
    priceNote: il
      ? (isHebrew ? 'המחירים כוללים מע״מ.' : 'Prices include VAT.')
      : (isHebrew ? 'המחירים בדולר ארה״ב. החיוב בדולר ארה״ב.' : 'Prices are in US dollars. Charged in USD.'),
    availability: isHebrew
      ? 'רכישת מנוי עדיין לא זמינה: אין אפשרות לבחור מסלול בתשלום כרגע, ולא מתבצע חיוב.'
      : 'Subscriptions cannot be purchased yet: a paid plan cannot be chosen right now, and nothing is charged.',
    notDecided: isHebrew
      ? 'פרטים נוספים יפורסמו לפני הפעלת המנויים.'
      : 'Further details will be published before subscriptions are activated.',
  };
}
