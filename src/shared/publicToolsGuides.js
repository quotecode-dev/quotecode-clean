// Owner console 2026-10-27, typed: "מאשר תוכנית א לדפי המחשבונים". Search Console marked /he|en/tools/currency and /he/tools/units as
// "Duplicate, Google chose different canonical" with Google's choice /he|en/tools: the hub opened on the currency calculator and every
// calculator page shared the hub's text. Now the hub shows the four calculators as cards (HUB_CARDS) and every calculator page carries
// its own guide (TOOL_GUIDES) - written separately per language (Hebrew for Israel, English for the international market), never a
// translation. Only what the calculators really do (src/utils/publicToolsCore.js): the named sources (ExchangeRate-API, CoinGecko), a
// fetch reused for up to 10 minutes, the shown update time, the stale / unavailable notices, the exact length factors, the exact
// purity fineness and the editable reference price per gram (an estimate, not a market price). No rate or price is ever stated as data.

export const HUB_CARDS = Object.freeze({
  he: [
    { key: 'currency', title: 'מחשבון המרת מטבעות', text: 'שקל, דולר, אירו ועוד חמישה מטבעות, לפי שער עדכני מהמקור ועם שעת העדכון.' },
    { key: 'units', title: 'המרת יחידות אורך', text: 'מטר, סנטימטר, קילומטר, פיט, אינץ\' ומייל - לפי יחסי ההמרה המדויקים.' },
    { key: 'metals', title: 'הערכת שווי למתכות יקרות', text: 'זהב, כסף, פלטינה, פלדיום ורודיום לפי משקל, טוהר ומחיר ייחוס שאפשר לשנות.' },
    { key: 'crypto', title: 'ממיר קריפטו', text: 'ביטקוין, אתריום, סולנה, ריפל וטרון בדולרים ובשקלים, עם שעת העדכון.' },
  ],
  en: [
    { key: 'currency', title: 'Currency Converter', text: 'US dollars, euros, pounds and five more currencies at an up-to-date rate from a named source, with the update time.' },
    { key: 'units', title: 'Length Converter', text: 'Feet, inches, miles, meters, centimeters and kilometers - using the exact conversion factors.' },
    { key: 'metals', title: 'Precious Metals Estimator', text: 'Gold, silver, platinum, palladium and rhodium by weight, purity and a reference price you can change.' },
    { key: 'crypto', title: 'Crypto Converter', text: 'Bitcoin, Ethereum, Solana, XRP and TRON in US dollars and euros, with the update time.' },
  ],
});

export const HUB_COPY = Object.freeze({
  he: { open: 'לפתיחת המחשבון', h2: 'בחרו מחשבון' },
  en: { open: 'Open the calculator', h2: 'Choose a calculator' },
});

export const TOOL_GUIDES = Object.freeze({
  he: {
    currency: {
      h2: 'איך משתמשים במחשבון המטבעות',
      steps: ['מקלידים את הסכום.', 'בוחרים את המטבע שממנו ממירים ואת המטבע שאליו ממירים. החץ שבין השדות מחליף ביניהם.', 'התוצאה מופיעה מיד, ומתחתיה מקור השער ושעת העדכון.'],
      example: { h: 'דוגמה מהעבודה', p: 'ספק בחו"ל מבקש 1,200 דולר על חומרי גלם. מקלידים 1200, בוחרים מדולר לשקל, ורואים כמה זה בשקלים לפי השער שמוצג. את הסכום הזה מעבירים לתמחור, ובהצעה ללקוח מוסיפים מרווח לתנודות בשער.' },
      source: 'השערים מגיעים מ־ExchangeRate-API. שער שנטען בעשר הדקות האחרונות משמש שוב בלי לפנות למקור. אם המקור לא זמין, מוצג השער האחרון עם אזהרה ועם השעה שלו, או הודעה שהשער אינו זמין. אין במחשבון שער קבוע.',
      faq: [
        { q: 'האם זה השער שהבנק ייתן?', a: 'לא בהכרח. זה שער ייחוס עדכני מהמקור. הבנק או חברת האשראי מוסיפים עמלה ומרווח משלהם.' },
        { q: 'אילו מטבעות אפשר להמיר?', a: 'שקל, דולר אמריקאי, אירו, ליש"ט, דולר קנדי, דולר אוסטרלי, פרנק שוויצרי וין יפני.' },
        { q: 'איך זה עוזר בהצעת מחיר?', a: 'כשחלק מהעלויות במטבע זר, ממירים אותן לשקלים לפני התמחור, ומציינים בהצעה מאיזה תאריך השער.' },
      ],
    },
    units: {
      h2: 'איך משתמשים בהמרת היחידות',
      steps: ['מקלידים את הערך.', 'בוחרים את יחידת המקור ואת יחידת היעד. החץ מחליף ביניהן.', 'התוצאה מחושבת מיד לפי יחס ההמרה המדויק.'],
      example: { h: 'דוגמה מהעבודה', p: 'בתוכנית מספק מחו"ל כתוב שאורך המעקה 12 פיט. פיט אחד הוא בדיוק 0.3048 מטר, כך ש־12 פיט הם 3.6576 מטר. את המטרים מכניסים להצעה לפי מטר אורך.' },
      source: 'יחסי ההמרה קבועים ומדויקים: פיט = 0.3048 מטר, אינץ\' = 2.54 סנטימטר, מייל = 1,609.344 מטר. אין כאן נתון חיצוני שמשתנה.',
      faq: [
        { q: 'למה הפיט נקרא גם רגל?', a: 'זו אותה יחידה. במחשבון היא מופיעה בשם "פיט (רגל)".' },
        { q: 'אפשר להמיר שטחים, כמו מטר רבוע?', a: 'לא. המחשבון ממיר אורך ומרחק בלבד. לשטח מחשבים את שתי המידות באורך ומכפילים.' },
        { q: 'כמה ספרות אחרי הנקודה?', a: 'התוצאה מעוגלת להצגה. החישוב עצמו נעשה לפי היחס המדויק.' },
      ],
    },
    metals: {
      h2: 'איך עובדת הערכת השווי',
      steps: ['בוחרים מתכת וטוהר.', 'מקלידים את המשקל בגרמים.', 'מחיר הייחוס לגרם מתכת טהורה מופיע בשדה משלו, ואפשר לשנות אותו למחיר שקיבלתם.', 'ההערכה מוצגת בדולרים, ובשקלים לפי שער הדולר העדכני.'],
      example: { h: 'דוגמה לחישוב', p: 'טבעת זהב 14 קראט במשקל 10 גרם: הטוהר של 14 קראט הוא 58.5%, כלומר 5.85 גרם זהב טהור. את 5.85 מכפילים במחיר הייחוס לגרם שמופיע בשדה, וזו ההערכה.' },
      source: 'המחשבון לא מושך מחירי מתכות מהשוק. מחיר הייחוס הוא נקודת התחלה שאתם יכולים לשנות, ולכן התוצאה היא הערכה ולא מחיר שוק. ההמרה לשקלים משתמשת בשער הדולר מ־ExchangeRate-API.',
      faq: [
        { q: 'למה זו הערכה ולא מחיר?', a: 'כי מחיר המתכת משתנה כל הזמן, וקונה או סוחר מוסיפים עמלה. כדי לקבל תוצאה מדויקת יותר, מעדכנים את מחיר הייחוס לגרם.' },
        { q: 'אילו רמות טוהר יש לזהב?', a: '24, 22, 21, 18 ו־14 קראט. לכסף: 999, 925 ו־800.' },
        { q: 'האם המשקל כולל אבנים?', a: 'המחשבון מניח שכל המשקל הוא מתכת. אם יש אבנים, מקלידים רק את משקל המתכת.' },
      ],
    },
    crypto: {
      h2: 'איך משתמשים בממיר הקריפטו',
      steps: ['בוחרים מטבע: ביטקוין, אתריום, סולנה, ריפל או טרון.', 'מקלידים כמות.', 'השווי מוצג בדולרים, ובשקלים לפי שער הדולר העדכני, עם שעת העדכון של המחיר.'],
      example: { h: 'דוגמה מהעבודה', p: 'לקוח מציע לשלם חצי ביטקוין. מקלידים 0.5, בוחרים ביטקוין, ורואים את השווי בדולרים ובשקלים לפי המחיר שמוצג ושעת העדכון שלו.' },
      source: 'המחירים מגיעים מ־CoinGecko, ושער הדולר מ־ExchangeRate-API. מחיר שנטען בעשר הדקות האחרונות משמש שוב. אם המחיר לא זמין, מוצגת הודעה ולא מספר.',
      faq: [
        { q: 'האם המחיר מתעדכן בזמן אמת?', a: 'הוא מתעדכן מהמקור, ושעת העדכון מוצגת מתחת לתוצאה. מחירי קריפטו משתנים מהר, ולכן כדאי לבדוק שוב לפני כל החלטה.' },
        { q: 'למה רק חמישה מטבעות?', a: 'אלה המטבעות שהמחשבון תומך בהם כרגע.' },
        { q: 'זו המלצה להשקעה?', a: 'לא. זה חישוב שווי בלבד.' },
      ],
    },
  },
  en: {
    currency: {
      h2: 'How to use the currency converter',
      steps: ['Enter the amount.', 'Choose the currency to convert from and the one to convert to. The arrow between them swaps the two.', 'The result appears right away, with the rate source and the time of its last update below it.'],
      example: { h: 'A real-world example', p: 'A supplier in Europe quotes 2,400 euros for materials. Enter 2400, convert from EUR to USD, and see the amount in dollars at the rate shown. Use that figure in your pricing, and add a margin for currency moves in the quote you send.' },
      source: 'Rates come from ExchangeRate-API. A rate loaded in the last ten minutes is reused instead of asking the source again. If the source is unavailable, the last rate is shown with a warning and its time, or a notice that no rate is available. The converter never uses a fixed rate.',
      faq: [
        { q: 'Is this the rate my bank will give me?', a: 'Not necessarily. It is an up-to-date reference rate from the source; banks and card issuers add their own fee and spread.' },
        { q: 'Which currencies are supported?', a: 'US dollar, Israeli shekel, euro, British pound, Canadian dollar, Australian dollar, Swiss franc and Japanese yen.' },
        { q: 'How does this help with a quote?', a: 'When part of your costs is in another currency, convert it before you price the job, and state in the quote which date the rate is from.' },
      ],
    },
    units: {
      h2: 'How to use the length converter',
      steps: ['Enter the value.', 'Choose the unit to convert from and the one to convert to. The arrow swaps them.', 'The result is calculated instantly using the exact conversion factor.'],
      example: { h: 'A real-world example', p: 'A plan from an overseas supplier lists a railing at 3.6 meters. One foot is exactly 0.3048 meters, so 3.6 meters is about 11.81 feet. Use the feet in a quote priced per linear foot.' },
      source: 'The factors are fixed and exact: 1 foot = 0.3048 meters, 1 inch = 2.54 centimeters, 1 mile = 1,609.344 meters. No outside data is involved.',
      faq: [
        { q: 'Can it convert areas, like square feet?', a: 'No. It converts length and distance only. For an area, convert both dimensions and multiply them.' },
        { q: 'Which units are included?', a: 'Feet, inches, miles, meters, centimeters and kilometers.' },
        { q: 'How many decimals are shown?', a: 'The result is rounded for display; the calculation itself uses the exact factor.' },
      ],
    },
    metals: {
      h2: 'How the estimate works',
      steps: ['Choose a metal and a purity.', 'Enter the weight in grams.', 'The reference price per gram of pure metal sits in its own field, and you can change it to the price you were quoted.', 'The estimate is shown in US dollars, and in euros at the current exchange rate.'],
      example: { h: 'A worked example', p: 'A 14k gold ring weighing 10 grams: 14k is 58.5% pure, so it holds 5.85 grams of pure gold. Multiply 5.85 by the reference price per gram in the field, and that is the estimate.' },
      source: 'The calculator does not pull live metal prices. The reference price is a starting point you can edit, so the result is an estimate, not a market price. The euro figure uses the exchange rate from ExchangeRate-API.',
      faq: [
        { q: 'Why an estimate and not a price?', a: 'Metal prices move all the time, and buyers and dealers add a margin. For a closer figure, update the reference price per gram.' },
        { q: 'Which gold purities are there?', a: '24k, 22k, 21k, 18k and 14k. For silver: 999, 925 and 800.' },
        { q: 'Does the weight include stones?', a: 'The calculator treats the whole weight as metal. If there are stones, enter the metal weight only.' },
      ],
    },
    crypto: {
      h2: 'How to use the crypto converter',
      steps: ['Choose a coin: Bitcoin, Ethereum, Solana, XRP or TRON.', 'Enter an amount.', 'The value is shown in US dollars and in euros, with the time of the price update.'],
      example: { h: 'A real-world example', p: 'A client offers to pay 0.5 Bitcoin. Enter 0.5, choose Bitcoin, and see the value in dollars and euros at the price shown and its update time.' },
      source: 'Prices come from CoinGecko, and the euro figure uses the exchange rate from ExchangeRate-API. A price loaded in the last ten minutes is reused. If a price is unavailable, you see a notice, never a number.',
      faq: [
        { q: 'Is the price real-time?', a: 'It updates from the source, and the update time is shown below the result. Crypto prices move fast, so check again before any decision.' },
        { q: 'Why only five coins?', a: 'Those are the coins the converter supports today.' },
        { q: 'Is this investment advice?', a: 'No. It is a value calculation only.' },
      ],
    },
  },
});
