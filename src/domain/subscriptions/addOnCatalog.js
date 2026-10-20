// Subscription add-ons - the ONE source (Owner console 2026-10-20). "חכם פלוס" / SMART PACK: 10 ILS a month (VAT included) / 5 USD; yearly
// with the main plan's 15% saving = 102 ILS / 51 USD; always the same billing period as the main plan; a choice, never pre-selected; can be
// added or removed at any time. Purchase is NOT open (the plan system is not active). Consumers: the landing promotion and plan card
// (src/components/landing/smartPackFacts.js), the AI facts (scripts/generate-ai-chat-facts.js -> chat-ai addOnTruth.ts; typed
// "מאשר שינוי ב-L-14: חכם פלוס בעובדות המוצר (תוכן, מחיר, עדיין לא לרכישה)").

export const SMART_PACK = Object.freeze({
  id: 'smart_pack',
  name: Object.freeze({ he: 'חכם פלוס', en: 'SMART PACK' }),
  priceMinor: Object.freeze({
    IL: Object.freeze({ currency: 'ILS', month: 1000, year: 10200, taxIncluded: true }),
    INTERNATIONAL: Object.freeze({ currency: 'USD', month: 500, year: 5100 }),
  }),
  includes: Object.freeze({
    he: Object.freeze(['צ׳אט חכם שקורא את הנתונים של המשתמש (הצעות, לקוחות, קטלוג, משימות)', 'צ׳אט קולי (שאלה בקול ותשובה מוקראת)', 'הצעה חכמה עם AI, כולל הכתבה בקול', 'צירוף קבצים להצעה']),
    en: Object.freeze(["A smart chat that reads the user's own data (quotes, clients, catalog, tasks)", 'Voice chat (a spoken question and a read-aloud answer)', 'An AI smart quote, including voice dictation', 'Files attached to a quote']),
  }),
  comingSoon: Object.freeze({ he: Object.freeze(['התאום הדיגיטלי של הלקוח']), en: Object.freeze(['Customer Twin']) }),
  optional: true,
  sameBillingPeriodAsMainPlan: true,
  purchasable: false,
});

export const SUBSCRIPTION_ADD_ONS = Object.freeze([SMART_PACK]);
