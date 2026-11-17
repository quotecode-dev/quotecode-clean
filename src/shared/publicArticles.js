// Owner console 2026-10-26 (SEO week 2, the night task: "כן אם אתה יכול תיצור גם את זה במשימת הלילה"; topics "תבחר אתה"): the public
// guides - four articles, each in Hebrew (/he/articles/<slug>) and English (/en/articles/<slug>), plus an index page per language.
// The ONE content source for the article pages (src/pages/PublicArticle.jsx) and their SEO entries (src/shared/publicSeoRoutes.js).
// Rules: every TEKANGO capability named here exists in the product (quote builder, the four pricing methods, sizes in cm / m, sections,
// templates, catalog, WhatsApp / email sending, view tracking, the customer's digital approval and signature, quote validity, VAT on the
// Israeli market); the English pages name no shekel / ILS and no Israeli VAT; example figures are marked as examples.

export const ARTICLE_SLUGS = Object.freeze([
  'how-to-write-a-quote-clients-approve',
  'renovation-contractor-quote',
  'quote-by-measurements',
  'import-pricing-currency-conversion',
]);

export const ARTICLES_DATE = '2026-10-27';

export const ARTICLES_INDEX = Object.freeze({
  he: {
    title: 'TEKANGO - מדריכים לעסקים: הצעות מחיר ותמחור',
    description: 'מדריכים מעשיים לעסקים ולעצמאים: איך כותבים הצעת מחיר שהלקוח מאשר, הצעת מחיר לשיפוצים, תמחור לפי מטר רבוע ומטר אורך ותמחור יבוא.',
    h1: 'מדריכים לעסקים',
    intro: 'מדריכים קצרים ומעשיים על הצעות מחיר ותמחור: מה לכתוב, איך לחשב, ואיך לשלוח ללקוח הצעה שקל לאשר.',
  },
  en: {
    title: 'TEKANGO - Business Guides: Quotes and Pricing',
    description: 'Practical guides for small businesses and freelancers: how to write a quote clients approve, renovation quotes, pricing per square meter and linear meter, and import pricing.',
    h1: 'Guides for Small Businesses',
    intro: 'Short, practical guides on quotes and pricing: what to include, how to calculate, and how to send a quote that is easy to approve.',
  },
});

export const ARTICLES = Object.freeze({
  'how-to-write-a-quote-clients-approve': {
    he: {
      // Owner 2026-11-17 (agents room, the promotion agent's approved task + the Owner's typed approval): a direct answer in 5 steps,
      // who the guide is for, a full example; the title and description match the question "how to write a quote"
      title: 'TEKANGO - איך כותבים הצעת מחיר: 5 צעדים ודוגמה מלאה',
      description: 'איך כותבים הצעת מחיר שהלקוח מאשר: 5 צעדים פשוטים, מה חייב להופיע בהצעה, דוגמה מלאה עם סכומים ומע״מ, תוקף ותנאים. מדריך מעשי לעסקים ולעצמאים.',
      h1: 'איך כותבים הצעת מחיר שהלקוח מאשר',
      modified: '2026-11-17',
      intro: 'הצעת מחיר טובה היא לא רק מספר בסוף העמוד. היא מסמך שעונה מראש על השאלות של הלקוח, ומקלה עליו לאשר אותה. ריכזנו כאן את מה שחשוב באמת.',
      sections: [
        {
          h: 'בקצרה: איך כותבים הצעת מחיר ב־5 צעדים',
          list: [
            'רשמו את פרטי העסק ואת פרטי הלקוח, מספר הצעה ותאריך.',
            'פרטו כל עבודה בשורה משלה: תיאור, כמות, מחיר ליחידה וסכום.',
            'סכמו: סכום לפני מע״מ, מע״מ וסה״כ לתשלום.',
            'הוסיפו תוקף להצעה, תנאי תשלום ומה לא כלול.',
            'שלחו עוד ביום הפגישה, ובדקו אם הלקוח פתח את ההצעה.',
          ],
        },
        {
          h: 'למי המדריך מתאים',
          p: ['לבעלי מקצוע ולעסקים קטנים שנותנים הצעות מחיר ללקוחות: קבלנים ושיפוצניקים, טכנאים, נותני שירותים ועצמאים. אם אתם מתלבטים מה לכתוב ואיך להציג את המחיר, זה המקום להתחיל.'],
        },
        {
          h: 'מה חייב להופיע בהצעת מחיר',
          p: ['הצעה מסודרת חוסכת שאלות חוזרות ומשדרת מקצועיות. לפני השליחה, כדאי לוודא שיש בה:'],
          list: [
            'פרטי העסק ופרטי הלקוח.',
            'מספר הצעה ותאריך.',
            'תיאור ברור של כל פריט או שירות.',
            'כמות, מחיר ליחידה וסכום לכל שורה.',
            'סכום ביניים, מע״מ וסה״כ לתשלום.',
            'תוקף ההצעה.',
            'תנאי תשלום ולוח זמנים.',
            'מה לא כלול בהצעה.',
          ],
        },
        {
          h: 'לכתוב את הפריטים בשפה של הלקוח',
          p: [
            'הלקוח לא תמיד מכיר את המונחים המקצועיים. שורה כמו "פירוק והתקנה של 3 חלונות, כולל פינוי" ברורה הרבה יותר מקוד פנימי או מקיצור.',
            'כשיש כמה אפשרויות, הציגו כל אחת בנפרד ועם מחיר משלה. כך הלקוח בוחר, במקום לנסות לפענח סכום אחד שמערבב הכול.',
          ],
        },
        {
          h: 'מחיר ברור, בלי הפתעות',
          p: [
            'כתבו במפורש אם המחירים כוללים מע״מ. לקוח שמגלה תוספת רק בסוף מאבד אמון.',
            'אם חלק מהמחיר תלוי במידות בשטח או בבחירה של הלקוח, כתבו איך הוא יחושב. למשל: "ריצוף: 140 ש״ח למ״ר, לפי מדידה סופית".',
          ],
        },
        {
          h: 'תוקף, תנאים והשלב הבא',
          p: [
            'הגבלת תוקף ההצעה נותנת ללקוח סיבה להחליט, ומגינה עליכם מפני התייקרויות אצל הספקים.',
            'בסוף ההצעה כתבו בבירור מה השלב הבא: איך מאשרים, מתי מתחילים ומה קורה אחרי האישור.',
          ],
        },
        {
          h: 'לשלוח מהר ולעקוב',
          p: [
            'הצעה שנשלחת עוד ביום הפגישה גוברת לא פעם על הצעה טובה ממנה שמגיעה שבוע אחר כך.',
            'אחרי השליחה כדאי לדעת אם הלקוח פתח את ההצעה, כדי לחזור אליו בזמן הנכון במקום לנחש.',
          ],
        },
        {
          h: 'דוגמה להצעת מחיר',
          p: ['הצעה לדוגמה של שיפוצניק לצביעת דירה (המספרים לדוגמה בלבד):'],
          list: [
            'הצעה מס׳ 1024, בתוקף 30 ימים.',
            'לכבוד: משפחת כהן.',
            'צביעת קירות ותקרות: 180 מ״ר, ב־22 ש״ח למ״ר. סכום: 3,960 ש״ח.',
            'תיקון סדקים וטיח: מחיר קבוע 650 ש״ח.',
            'כיסוי רצפות ופינוי בסיום: מחיר קבוע 300 ש״ח.',
            'סכום לפני מע״מ: 4,910 ש״ח. מע״מ (18%): 883.80 ש״ח. סה״כ לתשלום: 5,793.80 ש״ח.',
            'תנאים: 30% מקדמה באישור, היתרה בסיום העבודה. לא כולל: תיקוני נגרות.',
          ],
        },
        {
          h: 'איך TEKANGO עוזרת',
          p: [
            'ב־TEKANGO בונים הצעת מחיר מסודרת עם פרטי העסק, פריטים, מע״מ ותוקף, ושולחים אותה ללקוח בוואטסאפ או במייל.',
            'הלקוח פותח את ההצעה מהקישור, מאשר אותה וחותם עליה דיגיטלית, וברשימת ההצעות שלכם רואים אם הוא כבר צפה בה.',
          ],
        },
      ],
      related: [
        { href: '/he/articles/quote-by-measurements', label: 'הצעת מחיר לפי מידות: מטר רבוע ומטר אורך' },
        { href: '/he/articles/renovation-contractor-quote', label: 'הצעת מחיר של קבלן שיפוצים' },
      ],
    },
    en: {
      title: 'TEKANGO - How to Write a Quote: 5 Steps and a Full Example',
      description: 'How to write a quote clients approve: 5 simple steps, what every quote must include, a full example with line items and totals, validity and terms. A practical guide for small businesses.',
      h1: 'How to Write a Quote Your Clients Approve',
      modified: '2026-11-17',
      intro: 'A good quote is more than a number at the bottom of the page. It answers the client\'s questions in advance and makes it easy to say yes. Here is what makes the difference.',
      sections: [
        {
          h: 'In short: how to write a quote in 5 steps',
          list: [
            'Add your business details and the client\'s details, a quote number and a date.',
            'Give every job its own line: description, quantity, unit price and total.',
            'Add up the total, plus tax where it applies.',
            'Add how long the quote is valid, payment terms and what is not included.',
            'Send it on the day of the meeting, and check whether the client opened it.',
          ],
        },
        {
          h: 'Who this guide is for',
          p: ['Tradespeople and small businesses that send quotes to clients: contractors and renovators, technicians, service providers and freelancers. If you are not sure what to write or how to present the price, start here.'],
        },
        {
          h: 'What every quote must include',
          p: ['A well-organized quote saves back-and-forth and looks professional. Before you send it, make sure it has:'],
          list: [
            'Your business details and the client\'s details.',
            'A quote number and a date.',
            'A clear description of every item or service.',
            'Quantity, unit price and a total for each line.',
            'The grand total, and tax where it applies.',
            'How long the quote is valid.',
            'Payment terms and a timeline.',
            'What is not included.',
          ],
        },
        {
          h: 'Write line items in the client\'s language',
          p: [
            'Clients don\'t always know trade terms. A line such as "Remove and install 3 windows, including disposal" is far clearer than an internal code or an abbreviation.',
            'When there are several options, list each one separately with its own price. The client chooses instead of trying to decode one confusing number.',
          ],
        },
        {
          h: 'Clear prices, no surprises',
          p: [
            'If tax applies, say clearly whether your prices include it. A client who discovers an extra charge at the end loses trust.',
            'If part of the price depends on on-site measurements or on the client\'s choice, explain how it will be calculated. For example: "Tiling at $30 per square meter, based on the final measurement."',
          ],
        },
        {
          h: 'Validity, terms and the next step',
          p: [
            'A validity date gives the client a reason to decide and protects you from supplier price increases.',
            'End the quote with a clear next step: how to approve, when work starts, and what happens after approval.',
          ],
        },
        {
          h: 'Send fast, then follow up',
          p: [
            'A quote sent on the day of the meeting often beats a better quote that arrives a week later.',
            'After sending, it helps to know whether the client opened the quote, so you can follow up at the right time instead of guessing.',
          ],
        },
        {
          h: 'A quote example',
          p: ['An example quote from a renovator for painting an apartment (the figures are an example only):'],
          list: [
            'Quote #1024, valid for 30 days.',
            'To: the Miller family.',
            'Wall and ceiling painting: 180 m² at $4.50 per m². Amount: $810.',
            'Crack and plaster repairs: fixed price $150.',
            'Floor protection and clean-up: fixed price $70.',
            'Total: $1,030 (plus tax where it applies).',
            'Terms: a 30% deposit on approval, the balance on completion. Not included: carpentry repairs.',
          ],
        },
        {
          h: 'How TEKANGO helps',
          p: [
            'With TEKANGO you build a well-organized quote with your business details, line items, totals and a validity date, and send it to the client by WhatsApp or email.',
            'The client opens the quote from a link, approves it and signs it digitally, and your quote list shows whether the client has viewed it.',
          ],
        },
      ],
      related: [
        { href: '/en/articles/quote-by-measurements', label: 'Quoting by measurements: square meters and linear meters' },
        { href: '/en/articles/renovation-contractor-quote', label: 'Renovation contractor quotes' },
      ],
    },
  },

  'renovation-contractor-quote': {
    he: {
      title: 'TEKANGO - הצעת מחיר לשיפוץ: מדריך לקבלנים, שלב אחר שלב ועם דוגמה',
      description: 'איך קבלן שיפוצים בונה הצעת מחיר שלב אחר שלב: חלוקה לשלבים, מידות, חומרים, תוספות ותשלומים, עם דוגמה מלאה להצעה לשיפוץ חדר רחצה.',
      h1: 'הצעת מחיר של קבלן שיפוצים: מה חייב להופיע בה',
      modified: '2026-11-17',
      intro: 'בשיפוצים כמעט תמיד יש הפתעות: קיר שמתגלה עקום, צנרת ישנה, לקוח שמשנה את דעתו. הצעת מחיר מפורטת היא הדרך הטובה ביותר למנוע ויכוחים ולהגן על הרווח.',
      sections: [
        {
          h: 'למי המדריך מתאים',
          p: ['לקבלני שיפוצים ולשיפוצניקים שמתמחרים מטבחים, חדרי רחצה ודירות שלמות, ורוצים הצעה שהלקוח מבין ומאשר בלי ויכוחים.'],
        },
        {
          h: 'איך בונים את ההצעה, שלב אחר שלב',
          list: [
            'מגיעים לסיור בשטח ולוקחים מידות.',
            'מחלקים את העבודה לחדרים או לשלבים.',
            'מתמחרים כל שורה: מחיר קבוע, ליחידה, למטר רבוע או למטר אורך.',
            'מוסיפים את החומרים, את אופן התמחור של תוספות ואת לוח התשלומים.',
            'שולחים ללקוח קישור, והוא מאשר וחותם מהטלפון.',
          ],
        },
        {
          h: 'לחלק את העבודה לשלבים',
          p: ['במקום שורה אחת של "שיפוץ אמבטיה", חלקו את ההצעה לשלבים ברורים. כך הלקוח מבין על מה הוא משלם, וקל לשנות שלב אחד בלי לשנות את כל ההצעה. למשל:'],
          list: [
            'הריסה ופינוי.',
            'אינסטלציה וחשמל.',
            'טיח, איטום ויישור קירות.',
            'ריצוף וחיפוי.',
            'צבע וגמרים.',
            'התקנת כלים סניטריים ואביזרים.',
          ],
        },
        {
          h: 'חומרים: מי מספק, ובאיזו רמה',
          p: [
            'כתבו אם החומרים כלולים במחיר או שהלקוח מספק אותם. אם הם כלולים, ציינו את הסוג או הדרגה, או מחיר מרבי לבחירת הלקוח. למשל: "אריחים עד 120 ש״ח למ״ר; מעבר לכך בתוספת תשלום".',
          ],
        },
        {
          h: 'מידות וכמויות',
          p: [
            'עבודות שיפוץ רבות מתומחרות לפי שטח או אורך: ריצוף, צבע וחיפוי לפי מטר רבוע, ופנלים, צנרת ומעקות לפי מטר אורך.',
            'כשהמידות כתובות בהצעה, הלקוח רואה איך הגעתם לסכום. ואם בפועל המידה גדולה יותר, ברור איך התוספת תחושב.',
          ],
        },
        {
          h: 'תוספות וחריגים',
          p: [
            'כתבו מראש מה קורה כשמתגלה עבודה שלא תוכננה: איך היא תתומחר, ושעבודה נוספת מתבצעת רק באישור הלקוח.',
            'שורה אחת כזו בהצעה חוסכת הרבה ויכוחים באמצע העבודה.',
          ],
        },
        {
          h: 'לוח זמנים ותשלומים לפי שלבים',
          p: [
            'חלקו את התשלומים לפי התקדמות העבודה. למשל: מקדמה בחתימה, תשלום נוסף בסיום האינסטלציה והיתרה במסירה.',
            'ציינו גם משך עבודה משוער, ומה עלול לעכב אותו.',
          ],
        },
        {
          h: 'דוגמה: הצעת מחיר לשיפוץ חדר רחצה',
          p: ['כך יכולה להיראות הצעה מפורטת לשיפוץ חדר רחצה (המספרים לדוגמה בלבד):'],
          list: [
            'הריסה ופינוי: מחיר קבוע 2,500 ש״ח.',
            'אינסטלציה: מחיר קבוע 3,800 ש״ח.',
            'איטום רצפה: 6 מ״ר, ב־120 ש״ח למ״ר. סכום: 720 ש״ח.',
            'ריצוף וחיפוי: 28 מ״ר, ב־180 ש״ח למ״ר. סכום: 5,040 ש״ח.',
            'התקנת כלים סניטריים: מחיר קבוע 1,900 ש״ח.',
            'סכום לפני מע״מ: 13,960 ש״ח. מע״מ (18%): 2,512.80 ש״ח. סה״כ לתשלום: 16,472.80 ש״ח.',
            'תשלומים: 30% בחתימה, 40% בסיום האינסטלציה ו־30% במסירה.',
          ],
        },
        {
          h: 'איך TEKANGO עוזרת',
          p: [
            'ב־TEKANGO אפשר לחלק את ההצעה לחדרים או לאזורים, ולתמחר כל פריט במחיר קבוע, ליחידה, למטר רבוע או למטר אורך.',
            'עבודות שחוזרות על עצמן אפשר לשמור כתבנית או בקטלוג, וכך ההצעה הבאה מתחילה כמעט מוכנה. הלקוח מאשר את ההצעה וחותם עליה דיגיטלית.',
          ],
        },
      ],
      related: [
        { href: '/he/articles/quote-by-measurements', label: 'הצעת מחיר לפי מידות: מטר רבוע ומטר אורך' },
        { href: '/he/articles/how-to-write-a-quote-clients-approve', label: 'איך כותבים הצעת מחיר שהלקוח מאשר' },
      ],
    },
    en: {
      title: 'TEKANGO - Renovation Quotes for Contractors: Step by Step, with an Example',
      description: 'How a renovation contractor builds a quote step by step: stages, measurements, materials, extras and payments, with a full bathroom renovation example.',
      h1: 'Renovation Contractor Quotes: What to Include',
      modified: '2026-11-17',
      intro: 'Renovations almost always bring surprises: a wall that turns out crooked, old pipes, a client who changes their mind. A detailed quote is the best way to prevent disputes and protect your margin.',
      sections: [
        {
          h: 'Who this guide is for',
          p: ['Renovation contractors and remodelers who price kitchens, bathrooms and whole apartments, and want a quote the client understands and approves without arguments.'],
        },
        {
          h: 'How the quote comes together, step by step',
          list: [
            'Visit the site and take measurements.',
            'Split the job into rooms or stages.',
            'Price every line: a fixed price, per unit, per square meter or per linear meter.',
            'Add materials, the way extras are priced, and a payment schedule.',
            'Send the client a link; they approve and sign from their phone.',
          ],
        },
        {
          h: 'Break the job into stages',
          p: ['Instead of a single line that says "bathroom renovation", split the quote into clear stages. The client understands what they pay for, and you can change one stage without reopening everything. For example:'],
          list: [
            'Demolition and disposal.',
            'Plumbing and electrical.',
            'Plastering, waterproofing and wall leveling.',
            'Flooring and tiling.',
            'Painting and finishes.',
            'Installing fixtures and accessories.',
          ],
        },
        {
          h: 'Materials: who supplies them, and what grade',
          p: [
            'State whether materials are included or supplied by the client. If they are included, name the type or grade, or an allowance. For example: "Tiles up to $25 per square meter; anything above is extra."',
          ],
        },
        {
          h: 'Measurements and quantities',
          p: [
            'Many renovation jobs are priced by area or by length: flooring, painting and wall tiling per square meter; trims, pipes and railings per linear meter.',
            'When the measurements are written in the quote, the client sees how you reached the total. And if the real measurement turns out larger, it is clear how the extra will be calculated.',
          ],
        },
        {
          h: 'Changes and extras',
          p: [
            'Define in advance what happens when unplanned work is discovered: how it is priced, and that no extra work starts without the client\'s approval.',
            'One such line in the quote saves a lot of arguments in the middle of the job.',
          ],
        },
        {
          h: 'Timeline and stage-based payments',
          p: [
            'Tie payments to progress. For example: a deposit on signing, a payment after the plumbing is done, and the balance on handover.',
            'Also state an estimated duration and what could delay it.',
          ],
        },
        {
          h: 'Example: a bathroom renovation quote',
          p: ['This is how a detailed bathroom renovation quote can look (the figures are an example only):'],
          list: [
            'Demolition and disposal: fixed price $650.',
            'Plumbing: fixed price $1,000.',
            'Floor waterproofing: 6 m² at $30 per m². Amount: $180.',
            'Flooring and wall tiling: 28 m² at $45 per m². Amount: $1,260.',
            'Fixture installation: fixed price $500.',
            'Total: $3,590 (plus tax where it applies).',
            'Payments: 30% on signing, 40% after the plumbing and 30% on handover.',
          ],
        },
        {
          h: 'How TEKANGO helps',
          p: [
            'In TEKANGO you can split a quote into sections and price each item as a fixed price, per unit, per square meter or per linear meter.',
            'Recurring jobs are saved as a template or in your catalog, so the next quote starts ready. The client approves and signs digitally from the quote itself.',
          ],
        },
      ],
      related: [
        { href: '/en/articles/quote-by-measurements', label: 'Quoting by measurements: square meters and linear meters' },
        { href: '/en/articles/how-to-write-a-quote-clients-approve', label: 'How to write a quote your clients approve' },
      ],
    },
  },

  'quote-by-measurements': {
    he: {
      title: 'TEKANGO - הצעת מחיר לפי מטר רבוע ומטר אורך, עם דוגמה',
      description: 'איך מתמחרים לפי מטר רבוע או מטר אורך: חישוב שטח מס״מ, חיבור כמה מידות לאותו פריט והצגת החישוב בהצעה, עם דוגמה מלאה להצעה לחלונות ומעקה.',
      h1: 'הצעת מחיר לפי מידות: מטר רבוע ומטר אורך',
      modified: '2026-11-17',
      intro: 'בעבודות כמו חלונות, זכוכית, ריצוף, צבע, מעקות ופרגולות, המחיר נגזר מהמידות. כשהחישוב נכון וגלוי, הלקוח סומך על ההצעה, ואתם לא מפסידים כסף בגלל טעויות.',
      sections: [
        {
          h: 'למי המדריך מתאים',
          p: ['לבעלי מקצוע שהמחיר שלהם נגזר מהמידות: אלומיניום וחלונות, זגגות, ריצוף, צבע, מעקות, פרגולות וחיפויים.'],
        },
        {
          h: 'איך בונים הצעה לפי מידות, שלב אחר שלב',
          list: [
            'מודדים בשטח רוחב וגובה, או אורך.',
            'בוחרים לכל פריט: מטר רבוע, מטר אורך, ליחידה או מחיר קבוע.',
            'מזינים את המידות, בס״מ או במטרים.',
            'מחברים כמה מידות של אותו פריט לשטח אחד.',
            'כותבים את המידות בהצעה ושולחים ללקוח.',
          ],
        },
        {
          h: 'מטר רבוע או מטר אורך?',
          list: [
            'מטר רבוע (מ״ר): כשהמחיר תלוי בשטח, למשל חלונות, זכוכית, ריצוף, צבע, חיפוי ווילונות.',
            'מטר אורך: כשהמחיר תלוי באורך בלבד, למשל מעקות, פרופילים, צנרת, פנלים וקנטים.',
            'מחיר ליחידה או מחיר קבוע: לפריטים שהמחיר שלהם לא תלוי במידות, כמו ידית, מנוע או יום עבודה.',
          ],
        },
        {
          h: 'איך מחשבים שטח',
          p: [
            'שטח = רוחב × גובה, במטרים. מידות בס״מ מחלקים ב־100. למשל, שטחו של חלון בגודל \u2066120 × 150\u2069 ס״מ הוא \u20661.2 × 1.5 = 1.8\u2069 מ״ר.',
            'כשיש כמה מידות לאותו פריט, מחשבים כל אחת בנפרד ומחברים את התוצאות. למשל שלושה חלונות: \u2066120 × 150\u2069 (1.8 מ״ר), \u2066100 × 120\u2069 (1.2 מ״ר) ו־\u206680 × 100\u2069 (0.8 מ״ר). בסך הכול 3.8 מ״ר. במחיר של 450 ש״ח למ״ר (לדוגמה בלבד), הסכום הוא 1,710 ש״ח.',
          ],
        },
        {
          h: 'חישוב לפי מטר אורך',
          p: [
            'כאן מחברים רק את האורכים. למשל, מעקה באורך 6.4 מטר, במחיר של 380 ש״ח למטר אורך (לדוגמה בלבד), עולה 2,432 ש״ח.',
          ],
        },
        {
          h: 'טיפים שחוסכים טעויות',
          list: [
            'כתבו בהצעה את המידות עצמן, לא רק את הסכום. כך הלקוח רואה איך הגעתם למחיר.',
            'החליטו מראש איך אתם מעגלים, ואם יש מחיר מינימום לפריט קטן.',
            'אם יש פחת בחומר, הוסיפו אותו בשורה נפרדת או כללו אותו במחיר למ״ר, והקפידו לעשות זאת באופן עקבי.',
            'קיבלתם מספק בחו״ל מידות באינצ׳ים או בפיט? המירו אותן קודם למטרים.',
          ],
        },
        {
          h: 'דוגמה: הצעת מחיר לחלונות ומעקה',
          p: ['כך נראית הצעה לפי מידות (המספרים לדוגמה בלבד):'],
          list: [
            'חלונות אלומיניום: 3 מידות, בסך הכול 3.8 מ״ר, ב־450 ש״ח למ״ר. סכום: 1,710 ש״ח.',
            'מעקה: 6.4 מטר אורך, ב־380 ש״ח למטר. סכום: 2,432 ש״ח.',
            'התקנה: מחיר קבוע 600 ש״ח.',
            'סכום לפני מע״מ: 4,742 ש״ח. מע״מ (18%): 853.56 ש״ח. סה״כ לתשלום: 5,595.56 ש״ח.',
          ],
        },
        {
          h: 'איך TEKANGO עוזרת',
          p: [
            'ב־TEKANGO בוחרים לכל פריט תמחור לפי מטר רבוע או לפי מטר אורך, ומזינים את המידות בס״מ או במטרים.',
            'אפשר להוסיף כמה מידות לאותו פריט, והשטח והמחיר מחושבים אוטומטית.',
          ],
        },
      ],
      related: [
        { href: '/he/tools/units', label: 'מחשבון המרת יחידות אורך: מטר, פיט, אינץ׳ ומייל' },
        { href: '/he/articles/renovation-contractor-quote', label: 'הצעת מחיר של קבלן שיפוצים' },
        { href: '/he/articles/how-to-write-a-quote-clients-approve', label: 'איך כותבים הצעת מחיר שהלקוח מאשר' },
      ],
    },
    en: {
      title: 'TEKANGO - Quoting by Square Meter and Linear Meter, with an Example',
      description: 'How to price by square meter or linear meter: calculate area from centimeters, add several sizes for one item and show the math in the quote, with a full windows and railing example.',
      h1: 'Quoting by Measurements: Square Meters and Linear Meters',
      modified: '2026-11-17',
      intro: 'For jobs like windows, glass, flooring, painting, railings and pergolas, the price comes from the measurements. When the calculation is right and visible, the client trusts the quote and you don\'t lose money on mistakes.',
      sections: [
        {
          h: 'Who this guide is for',
          p: ['Tradespeople whose price comes from the measurements: windows and aluminum, glazing, flooring, painting, railings, pergolas and cladding.'],
        },
        {
          h: 'How a measured quote comes together, step by step',
          list: [
            'Measure width and height, or length, on site.',
            'Choose for each item: per square meter, per linear meter, per unit or a fixed price.',
            'Enter the measurements, in centimeters or meters.',
            'Combine several sizes of the same item into one total area.',
            'Write the measurements in the quote and send it to the client.',
          ],
        },
        {
          h: 'Square meters or linear meters?',
          list: [
            'Square meters (m²): when area is what matters. For example windows, glass, flooring, painting, wall tiling and blinds.',
            'Linear meters: when only length matters. For example railings, profiles, pipes, trims and edging.',
            'Per unit or a fixed price: for items that don\'t depend on size, such as a handle, a motor or a day of work.',
          ],
        },
        {
          h: 'How to calculate area',
          p: [
            'Area = width × height, in meters. Divide centimeter measurements by 100. For example, a 120 × 150 cm window is 1.2 × 1.5 = 1.8 m².',
            'When one item has several sizes, calculate each one and add them up. For example, three windows: 120 × 150 (1.8 m²), 100 × 120 (1.2 m²) and 80 × 100 (0.8 m²), 3.8 m² in total. At $95 per m² (an example only), the total is $361.',
          ],
        },
        {
          h: 'And linear meters?',
          p: [
            'Here you add up lengths only. For example, a 6.4 m railing at $80 per linear meter (an example only) comes to $512.',
          ],
        },
        {
          h: 'Tips that prevent mistakes',
          list: [
            'Write the measurements in the quote, not just the total, so the client sees how you reached the price.',
            'Decide in advance how you round, and whether a small item has a minimum charge.',
            'If there is material waste, add it as a separate line or build it into the price per m², and be consistent.',
            'Supplier sizes in inches or feet? Convert them to meters first.',
          ],
        },
        {
          h: 'Example: a windows and railing quote',
          p: ['This is how a measured quote looks (the figures are an example only):'],
          list: [
            'Aluminum windows: 3 sizes, 3.8 m² in total, at $95 per m². Amount: $361.',
            'Railing: 6.4 linear meters at $80 per meter. Amount: $512.',
            'Installation: fixed price $140.',
            'Total: $1,013 (plus tax where it applies).',
          ],
        },
        {
          h: 'How TEKANGO helps',
          p: [
            'In TEKANGO you choose per-square-meter or per-linear-meter pricing for each item, and enter the measurements in centimeters or meters.',
            'You can add several sizes to the same item, and the area and the price are calculated automatically.',
          ],
        },
      ],
      related: [
        { href: '/en/tools/units', label: 'Length converter: meters, feet, inches and miles' },
        { href: '/en/articles/renovation-contractor-quote', label: 'Renovation contractor quotes' },
        { href: '/en/articles/how-to-write-a-quote-clients-approve', label: 'How to write a quote your clients approve' },
      ],
    },
  },

  'import-pricing-currency-conversion': {
    he: {
      title: 'TEKANGO - תמחור יבוא עם המרת מטבעות: מדריך לעסקים',
      description: 'איך מתמחרים מוצר שנקנה במטבע זר: המרה לפי שער עדכני, עלויות נלוות, מרווח ביטחון לתנודות בשער ותוקף קצר להצעה. כולל דוגמה מספרית.',
      h1: 'תמחור יבוא עם המרת מטבעות',
      intro: 'כשקונים מספק בחו״ל ומוכרים בשקלים, שער המטבע הוא חלק מהמחיר. מי שמתמחר לפי שער ישן, או שוכח עלויות נלוות, מגלה את ההפסד רק אחרי שהלקוח כבר אישר.',
      sections: [
        {
          h: 'שלב 1: מחיר הספק, במטבע שלו',
          p: ['התחילו מהמחיר שהספק נקב, במטבע שבו תשלמו לו: דולר, אירו או מטבע אחר. בדקו מה כלול בו: אריזה, משלוח עד הנמל, ביטוח.'],
        },
        {
          h: 'שלב 2: המרה לפי שער עדכני',
          p: [
            'המירו לשקלים לפי השער של היום, לא לפי השער שזכרתם מהחודש שעבר. בדוגמה נשתמש בשער של 3.70 ש״ח לדולר (שער לדוגמה בלבד).',
            'לפי שער זה, הזמנה של 2,000 דולר עולה 7,400 ש״ח.',
          ],
        },
        {
          h: 'שלב 3: להוסיף את כל העלויות הנלוות',
          list: [
            'הובלה בינלאומית וביטוח.',
            'מכס ומסי יבוא, לפי סוג המוצר.',
            'עמילות מכס ושחרור מהנמל.',
            'הובלה מקומית עד המחסן או עד הלקוח.',
            'עמלות העברה בנקאית ועמלות המרה.',
          ],
        },
        {
          h: 'שלב 4: מרווח ביטחון לתנודות בשער',
          p: [
            'בין יום ההצעה ליום התשלום לספק, השער עלול להשתנות. עסקים רבים מוסיפים מרווח ביטחון קטן, או מקצרים את תוקף ההצעה כשהשוק תנודתי.',
          ],
        },
        {
          h: 'שלב 5: הרווח וההצעה ללקוח',
          p: [
            'רק אחרי שחישבתם את כל העלויות מוסיפים את הרווח. בהצעה ללקוח ציינו את המחיר בשקלים, אם הוא כולל מע״מ ועד מתי ההצעה בתוקף.',
          ],
        },
        {
          h: 'איך TEKANGO עוזרת',
          p: [
            'במחשבון המרת המטבעות של TEKANGO רואים את השער העדכני מהמקור, עם שעת העדכון.',
            'אחרי החישוב בונים ב־TEKANGO הצעת מחיר בשקלים עם מע״מ ותוקף, ושולחים אותה ללקוח.',
          ],
        },
      ],
      related: [
        { href: '/he/tools/currency', label: 'מחשבון המרת מטבעות לפי שער עדכני' },
        { href: '/he/articles/how-to-write-a-quote-clients-approve', label: 'איך כותבים הצעת מחיר שהלקוח מאשר' },
      ],
    },
    en: {
      title: 'TEKANGO - Import Pricing with Currency Conversion: A Business Guide',
      description: 'How to price goods bought in a foreign currency: convert at an up-to-date rate, add the costs along the way, keep a margin for rate changes and a short quote validity. With a worked example.',
      h1: 'Import Pricing with Currency Conversion',
      intro: 'When you buy from an overseas supplier and sell in your own currency, the exchange rate is part of the price. Price with an old rate, or forget a cost along the way, and you find the loss only after the client has approved.',
      sections: [
        {
          h: 'Step 1: the supplier\'s price, in their currency',
          p: ['Start from the supplier\'s price in the currency you will pay in: euros, pounds or another currency. Check what it includes: packing, shipping to the port, insurance.'],
        },
        {
          h: 'Step 2: convert at an up-to-date rate',
          p: [
            'Convert at today\'s rate, not the one you remember from last month. In this example we use 1.08 US dollars per euro - an example rate only.',
            'An order of €1,800 is $1,944 at that rate.',
          ],
        },
        {
          h: 'Step 3: add every cost along the way',
          list: [
            'International freight and insurance.',
            'Customs duties and import taxes, depending on the product.',
            'Customs brokerage and port release.',
            'Local delivery to your warehouse or to the client.',
            'Bank transfer and conversion fees.',
          ],
        },
        {
          h: 'Step 4: a margin for rate changes',
          p: [
            'The rate can move between the day you quote and the day you pay the supplier. Many businesses add a small safety margin, or shorten the quote\'s validity when the market is volatile.',
          ],
        },
        {
          h: 'Step 5: your profit, and the quote',
          p: [
            'Add your profit only after all the costs. In the quote, state the price in your selling currency, whether tax is included, and how long the quote is valid.',
          ],
        },
        {
          h: 'How TEKANGO helps',
          p: [
            'TEKANGO\'s currency converter shows the up-to-date rate from its source, with the time of the last update.',
            'After the calculation, build the quote in TEKANGO in your account\'s currency, with a validity date, and send it to your client.',
          ],
        },
      ],
      related: [
        { href: '/en/tools/currency', label: 'Currency converter with up-to-date rates' },
        { href: '/en/articles/how-to-write-a-quote-clients-approve', label: 'How to write a quote your clients approve' },
      ],
    },
  },
});
