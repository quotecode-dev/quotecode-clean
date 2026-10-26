// In-app plans view model (PricingModal.jsx and the Free-10 upgrade window). Task 27 (§249 + the Owner's 2026-10-11 amendment, §253):
// Free-10, then ONE all-inclusive package billed monthly or annually; quote styles are not plans. Every amount comes from
// src/domain/subscriptions/packageCatalog.js through landingPackageFacts.js - the amount shown is the amount that would be billed:
// IL ₪30.00 / ₪306.00 including VAT (annual saving ₪54.00, exactly 15%); INTERNATIONAL $18.00 / $184.00 USD (saving $32.00, about 15%).
// Market = the server account market (else the account's recorded business market) - never the UI language. Purchase is not available
// (checkout is not activated), so nothing here starts a payment or changes a plan.
import { FREE_QUOTES_TOTAL, ilsPackageAmount, usdPackageAmount, ilsAnnualSaving, usdAnnualSaving, ilsAnnualSavingRate, usdAnnualSavingRate } from '../../components/landing/landingPackageFacts';
import { RATE_SOURCE_NAME, ESTIMATE_CURRENCIES, CURRENCY_SYMBOL } from './localPriceEstimate';
import { formatMoney, formatWholeMoney } from '../../utils/money';
import { PLAN_NAMES } from '../../../supabase/functions/_shared/subscriptionContract.ts';
import { ilsSmartPack, ilsWithSmartPack, usdSmartPack, usdWithSmartPack, SMART_PACK_PRICE_MINOR } from '../../components/landing/smartPackFacts';
import { SMART_PACK } from './addOnCatalog';
import { packagePrice } from './packageCatalog';
import { majorUnits } from './priceCatalog';

// Task 39 (Owner final scope): International accounts whose identified currency is GBP / EUR also see a labelled estimate from the
// same rate source as the landing (`estimateRate` = a localPriceEstimate record or null); the shown / billed amounts stay USD.
export function pricingModalModel({ isHebrew, market, accountCurrency = null, estimateRate = null }) {
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
      ? [`${FREE_QUOTES_TOTAL} הצעות מחיר בסך הכול`, 'או 7 ימים מההרשמה, המוקדם מביניהם', 'בשבעת הימים כלול גם חכם פלוס', 'הצעה נספרת בשמירה הראשונה עם לקוח ופריט; גרסה חדשה או לקוח אחר נספרים שוב', 'שמירה חוזרת, או שליחה חוזרת של אותה גרסה לאותו לקוח, לא נספרת שוב', 'טיוטה ריקה ותצוגה מקדימה לא נספרות']
      : [`${FREE_QUOTES_TOTAL} quotes in total`, 'Or 7 days from sign-up, whichever comes first', 'SMART PACK included during the 7 days', 'Counted once first stored with a client and an item; a new version or another client counts again', 'Saving again, or re-sending the same version to the same client, is not counted again', 'An empty draft and previews are not counted'],
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
    // Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-22: תיבת הוספה של חכם פלוס במסך המסלולים בתוך המערכת ..."): the unticked SMART PACK
    // add-on box - ticked, the shown price is the package plus the add-on for the chosen period (display only; purchase is not open)
    addOn: {
      label: isHebrew ? `הוספת ${SMART_PACK.name.he}` : `Add ${SMART_PACK.name.en}`,
      summary: SMART_PACK.summary[isHebrew ? 'he' : 'en'],
      perPeriod: il ? {
        month: { add: isHebrew ? `(+${ilsSmartPack('month')} לחודש)` : `(+${ilsSmartPack('month')} / month)`, amount: ilsWithSmartPack('month'), line: `${isHebrew ? 'כולל חכם פלוס' : 'With SMART PACK'}: ${ilsPackageAmount('month')} + ${ilsSmartPack('month')}`,
          total: isHebrew ? `כולל חכם פלוס: ${ilsWithSmartPack('month')} לחודש` : `Including SMART PACK: ${ilsWithSmartPack('month')} / month` },
        year: { add: isHebrew ? `(+${ilsSmartPack('year')} לשנה)` : `(+${ilsSmartPack('year')} / year)`, amount: ilsWithSmartPack('year'), line: `${isHebrew ? 'כולל חכם פלוס' : 'With SMART PACK'}: ${ilsPackageAmount('year')} + ${ilsSmartPack('year')}`,
          total: isHebrew ? `כולל חכם פלוס: ${ilsWithSmartPack('year')} לשנה` : `Including SMART PACK: ${ilsWithSmartPack('year')} / year` },
      } : {
        month: { add: isHebrew ? `(+${usdSmartPack('month')} לחודש)` : `(+${usdSmartPack('month')} / month)`, amount: usdWithSmartPack('month'), line: `${isHebrew ? 'כולל חכם פלוס' : 'With SMART PACK'}: ${usdPackageAmount('month').text} + ${usdSmartPack('month')}` },
        year: { add: isHebrew ? `(+${usdSmartPack('year')} לשנה)` : `(+${usdSmartPack('year')} / year)`, amount: usdWithSmartPack('year'), line: `${isHebrew ? 'כולל חכם פלוס' : 'With SMART PACK'}: ${usdPackageAmount('year').text} + ${usdSmartPack('year')}` },
      },
    },
  };
  const wantCur = !il && typeof accountCurrency === 'string' && ESTIMATE_CURRENCIES.includes(accountCurrency.toUpperCase()) ? accountCurrency.toUpperCase() : null;
  const mo = wantCur ? usdPackageAmount('month', estimateRate) : null; const yr = wantCur ? usdPackageAmount('year', estimateRate) : null;
  const est = mo?.display.estimate && yr?.display.estimate && mo.display.displayCurrency === wantCur ? mo.display : null;
  const estimateNote = !wantCur ? null : est
    ? (isHebrew
      ? `הערכה ב־${wantCur} בלבד: כ־${mo.estimateText.slice(1)} לחודש או כ־${yr.estimateText.slice(1)} לשנה, לפי שער ${RATE_SOURCE_NAME} מ־${est.rateAsOf.slice(0, 10)}. החיוב בדולר ארה״ב.`
      : `Estimate in ${wantCur} only: about ${mo.estimateText.slice(1)} per month or ${yr.estimateText.slice(1)} per year at the ${RATE_SOURCE_NAME} rate of ${est.rateAsOf.slice(0, 10)}. Charged in USD.`)
    : (isHebrew ? `הערכה ב-${wantCur} אינה זמינה כרגע, ולכן המחירים מוצגים בדולר ארה״ב.` : `A ${wantCur} estimate is not available right now, so prices are shown in US dollars.`);
  // Owner console 2026-10-21 (typed: "מאשר שינוי ב-L-22: אומדן המטבע המקומי בחלון המסלולים כולל את חכם פלוס"): with the SMART PACK box
  // ticked the estimate is of the total that would be charged (package + add-on), with the same rate and rounding as the saving estimate
  const estWith = (period) => `${mo.estimateText.slice(1, 2)}${formatMoney(majorUnits(Math.round((packagePrice('INTERNATIONAL', period).amountMinor
    + SMART_PACK_PRICE_MINOR.INTERNATIONAL[period]) * est.rate)))}`;
  const estimateNoteWithAddOn = !wantCur || !est ? null : (isHebrew
    ? `הערכה ב-${wantCur} בלבד, כולל חכם פלוס: כ-${estWith('month')} לחודש או כ-${estWith('year')} לשנה, לפי שער ${RATE_SOURCE_NAME} מ-${est.rateAsOf.slice(0, 10)}. החיוב בדולר ארה״ב.`
    : `Estimate in ${wantCur} only, with SMART PACK: about ${estWith('month')} per month or ${estWith('year')} per year at the ${RATE_SOURCE_NAME} rate of ${est.rateAsOf.slice(0, 10)}. Charged in USD.`);
  // Owner console 2026-10-26 (typed: "... מחיר במטבע החשבון בחו"ל עם החיוב בדולר, ושורת מידע על חכם פלוס בחו"ל", L-01 / L-22, item ג):
  // with a valid rate the card's main price is the ACCOUNT currency (a labelled estimate) and the card row states the USD amount charged
  if (est) {
    const usdPer = isHebrew ? { month: 'לחודש', year: 'לשנה' } : { month: 'per month', year: 'per year' };
    pkg.prices = pkg.prices.map((r) => {
      const a = r.period === 'month' ? mo : yr;
      return { ...r, amount: a.estimateText,
        per: isHebrew ? `${wantCur} ${r.period === 'month' ? '/ חודש' : '/ שנה'} · הערכה` : `${wantCur} / ${r.period} · estimate`,
        note: `${isHebrew ? 'החיוב בדולר ארה״ב' : 'Charged in USD'}: ${a.text} ${usdPer[r.period]}${r.note ? `. ${r.note}` : ''}` };
    });
  }
  // item ד: abroad, SMART PACK is an information line in the same currency - no box, no button: buying it outside Israel opens soon
  const spEst = (period) => `≈${CURRENCY_SYMBOL[wantCur]}${formatMoney(majorUnits(Math.round(SMART_PACK_PRICE_MINOR.INTERNATIONAL[period] * est.rate)))}`;
  const smartPackAbroad = il ? null : est
    ? (isHebrew
      ? `חכם פלוס: ${spEst('month')} לחודש או ${spEst('year')} לשנה בתוספת למנוי (הערכה; החיוב בדולר ארה״ב: ${usdSmartPack('month')} / ${usdSmartPack('year')}). הרכישה מחוץ לישראל תיפתח בקרוב.`
      : `SMART PACK: ${spEst('month')} a month or ${spEst('year')} a year on top of your plan (estimate; charged in USD: ${usdSmartPack('month')} / ${usdSmartPack('year')}). Buying it outside Israel opens soon.`)
    : (isHebrew
      ? `חכם פלוס: ${usdSmartPack('month')} לחודש או ${usdSmartPack('year')} לשנה בתוספת למנוי, בדולר ארה״ב. הרכישה מחוץ לישראל תיפתח בקרוב.`
      : `SMART PACK: ${usdSmartPack('month')} a month or ${usdSmartPack('year')} a year on top of your plan, in USD. Buying it outside Israel opens soon.`);
  return {
    plans: [free, pkg],
    priceNote: il
      ? (isHebrew ? 'המחירים כוללים מע״מ.' : 'Prices include VAT.')
      : est
        ? (isHebrew ? `המחירים בכרטיס הם הערכה ב-${wantCur}. החיוב בדולר ארה״ב.` : `Prices on the card are an estimate in ${wantCur}. Charged in USD.`)
        : (isHebrew ? 'המחירים בדולר ארה״ב. החיוב בדולר ארה״ב.' : 'Prices are in US dollars. Charged in USD.'),
    smartPackAbroad,
    estimateNote,
    estimateNoteWithAddOn,
    // Task 39: the cancellation-request path (a request to the market's service mailbox, handled by the team - not an automatic cancellation).
    cancellation: {
      text: isHebrew ? 'ביטול מנוי: אפשר לבקש בכל עת במייל. הבקשה מטופלת בידי הצוות ומאושרת במייל; זה אינו ביטול אוטומטי ואינו מחיקת חשבון.' : 'Cancelling a subscription: you can ask at any time by email. Our team handles the request and confirms it by email; it is not an automatic cancellation and does not delete your account.',
      linkLabel: isHebrew ? 'שליחת בקשת ביטול' : 'Send a cancellation request',
      href: `mailto:${il ? 'support@tekango.com' : 'info@tekango.com'}?subject=${encodeURIComponent(isHebrew ? 'בקשת ביטול מנוי' : 'Subscription cancellation request')}&body=${encodeURIComponent(isHebrew ? 'שלום, אבקש לבטל את המנוי שלי.' : 'Hello, I would like to cancel my subscription.')}`,
      termsLabel: isHebrew ? 'תנאי הביטול וההחזרים' : 'Cancellation and refund terms',
      termsHref: isHebrew ? '/he/terms#cancellation' : '/en/terms#cancellation',
    },
    availability: isHebrew
      ? 'רכישת מנוי עדיין לא זמינה: אין אפשרות לבחור מסלול בתשלום כרגע, ולא מתבצע חיוב.'
      : 'Subscriptions cannot be purchased yet: a paid plan cannot be chosen right now, and nothing is charged.',
    notDecided: isHebrew
      ? 'פרטים נוספים יפורסמו לפני הפעלת המנויים.'
      : 'Further details will be published before subscriptions are activated.',
  };
}
