// Subscription add-ons - the ONE source (Owner console 2026-10-20). "חכם פלוס" / SMART PACK: 10 ILS a month (VAT included) / 5 USD; yearly
// with the main plan's 15% saving = 102 ILS / 51 USD; always the same billing period as the main plan; a choice, never pre-selected; added by
// the subscriber, removed by the subscriber in the plans window at the end of the paid period (Owner console 2026-10-26). Owner console 2026-10-25 (typed L-14 ... "להפעלת הרכישה בישראל"): purchase is open in Israel only. Consumers: the landing promotion and plan card
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
    // Owner console 2026-11-03 (typed approval incl. L-06, L-22): + "quote from a file", right after the AI smart quote
    // Owner console 2026-11-03 (typed: "מאשר תיקון כל אזכורי הצעת מחיר מקובץ לפי התוכנית (... בדיקת הלקוח ברשימת חכם פלוס), כולל שינוי ב-L-05,
    // L-06, L-11, L-12, L-14, L-17 ו-L-22"): + Customer Twin ("שיפור ההצעה", its name in the app), which was missing from the list
    he: Object.freeze(['צ׳אט חכם שקורא את הנתונים של המשתמש (הצעות, לקוחות, קטלוג, משימות)', 'צ׳אט קולי (שאלה בקול ותשובה מוקראת)', 'הצעה חכמה עם AI, כולל הכתבה בקול', 'הצעת מחיר מקובץ PDF או JPG, עם המחירים שלכם', 'שיפור ההצעה: איך הלקוח יראה את ההצעה לפני השליחה', 'צירוף קבצים להצעה']),
    en: Object.freeze(["A smart chat that reads the user's own data (quotes, clients, catalog, tasks)", 'Voice chat (a spoken question and a read-aloud answer)', 'An AI smart quote, including voice dictation', 'A quote from a PDF or JPG file, with your own prices', 'Improve quote: how your client will see the quote before you send it', 'Files attached to a quote']),
  }),
  // one short line for the plans views ("what is SMART PACK?" - Owner 2026-10-20: "אין שום הסבר למשתמש מה זה בכלל חכם פלוס")
  summary: Object.freeze({
    he: 'כולל: צ׳אט חכם שקורא את נתוני החשבון, צ׳אט קולי, הצעה חכמה עם AI והכתבה בקול, הצעת מחיר מקובץ, שיפור ההצעה, וקבצים מצורפים להצעה.',
    en: 'Includes: a smart chat that knows your data, voice chat, an AI smart quote with voice dictation, a quote from a file, Improve quote, and files attached to quotes.',
  }),
  // Owner 2026-10-25 ("לא להשאיר זנבות"): Customer Twin ("שיפור ההצעה") is LIVE since PR #47 - nothing is "coming soon"
  comingSoon: Object.freeze({ he: Object.freeze([]), en: Object.freeze([]) }),
  optional: true,
  sameBillingPeriodAsMainPlan: true,
  // per market: Israel open (2026-10-25); abroad open in USD - Owner console 2026-11-01 (typed: "מאשר פתיחת הרכישה בחו"ל לפי ההמלצות א-ה, כולל שינוי ב-L-01, L-05, L-06, L-07, L-11, L-12, L-14, L-17, L-22")
  purchasable: Object.freeze({ IL: true, INTERNATIONAL: true }),
});

export const SUBSCRIPTION_ADD_ONS = Object.freeze([SMART_PACK]);
