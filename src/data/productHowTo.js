// Product "how do I ..." facts (Owner console 2026-10-20, typed: "מאשר שינוי ב-L-14: הוראות "איך עושים" מאומתות לעובדות המוצר ולעוזר
// המיילים"). The step-by-step answers the AI assistants (the chat and the support email assistant) may give for the common tasks.
//  - Every step quotes the REAL label the user sees. Each entry names the source files where those labels are rendered, and
//    productHowTo.test.js fails when a quoted label no longer exists in its file - an instruction can never silently go stale.
//  - Hand-maintained here, projected into supabase/functions/chat-ai/aiFacts.generated.ts by scripts/generate-ai-chat-facts.js.
//  - Only what the product does today. Nothing here changes a capability, a plan or a price.

export const PRODUCT_HOW_TO = Object.freeze([
  {
    id: 'business_logo_and_details',
    capabilityIds: ['business_settings', 'profile_prerequisites'],
    he: {
      task: 'הוספת לוגו ועדכון פרטי העסק',
      steps: [
        'בתפריט הצד לוחצים על "הגדרות העסק".',
        'בשדה "כתובת תמונת לוגו (URL) או העלאת קובץ" לוחצים "העלאת קובץ" ובוחרים קובץ PNG, JPG או SVG עד 500KB.',
        'באותו מסך ממלאים את פרטי העסק, למשל "טלפון העסק" ו"ח.פ / עוסק מורשה".',
        'לוחצים "שמירת הגדרות העסק".',
      ],
    },
    en: {
      task: 'Adding a logo and updating the business details',
      steps: [
        'In the sidebar click "Business Settings".',
        'In the "Logo Image URL or File Upload" field click "Upload File" and choose a PNG, JPG or SVG file up to 500KB.',
        'On the same screen fill in the business details, for example "Business Phone".',
        'Click "Save Business Settings".',
      ],
    },
    evidence: [
      { file: 'src/components/SettingsTab.jsx', labels: ['כתובת תמונת לוגו (URL) או העלאת קובץ', 'Logo Image URL or File Upload', 'העלאת קובץ', 'Upload File', 'שמירת הגדרות העסק', 'Save Business Settings', 'טלפון העסק', 'Business Phone', '500KB'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הגדרות העסק', 'Business Settings', 'ח.פ / עוסק מורשה'] },
    ],
  },
  // 2026-11-12 (unified quote, L-14): the new flow - how to start, the client first, the work window, the summary and "saved, not sent"
  {
    id: 'first_quote',
    capabilityIds: ['quote_create', 'profile_prerequisites', 'catalog'],
    he: {
      task: "יצירת הצעת מחיר (גם הראשונה)",
      steps: [
        "לפני ההצעה הראשונה צריך טלפון עסק (ובישראל גם ח.פ / עוסק מורשה) ב\"הגדרות העסק\".",
        "לוחצים \"הצעה חדשה\". בחלון \"איך תרצו להתחיל?\" בוחרים \"ממלאים בעצמכם\" (לשלוש הדרכים האחרות יש הסבר משלהן).",
        "בשלב \"למי מכינים את ההצעה?\" ממלאים את שם הלקוח, בוחרים \"סוג לקוח (חובה)\" ולוחצים \"להמשך\". בישראל מופיעה מיד הודעה אם הסכומים כוללים מע״מ או לא.",
        "בשלב \"מה מוסיפים להצעה?\" לוחצים \"+ הוספת עבודה או מוצר\" ועונים על ארבע שאלות: איזו עבודה (שם, או בחירה מהקטלוג), איפה עושים אותה, איך מחשבים את המחיר וכמה זה עולה. העבודה נכנסת כשורה, ואפשר לשנות אותה בשורה עצמה. כשיש כמה דירות, חדרים או קומות לוחצים \"+ הוספת דירה, חדר או קומה\".",
        "בכרטיס \"פרטי ההצעה\" נמצאים הפרויקט, הכתובת והתוקף, קבצים, תנאים ואחריות, הערות, הנחה, עיצוב ותמונות ומטבע.",
        "ב\"סיכום ההצעה\" לוחצים \"שמירת ההצעה\". שמירה אינה שליחה: ההצעה נשמרת כטיוטה, ומופיע \"נשמרה. עדיין לא נשלחה.\" - משם אפשר לראות איך הלקוח יראה אותה, לחזור לעריכה או לעבור לרשימת ההצעות.",
      ],
    },
    en: {
      task: "Creating a quote (including the first one)",
      steps: [
        "Before the first quote a business phone is required in \"Business Settings\".",
        "Click \"New quote\". In the \"How would you like to start?\" window choose \"Fill it in yourselves\" (the other three ways have their own steps).",
        "In the \"Who is this quote for?\" step fill in the client name, choose the client type and click \"Continue\".",
        "In the \"What goes in the quote?\" step click \"+ Add work or a product\" and answer four questions: what work (a name, or pick from the catalog), where it is done, how the price is calculated and how much it costs. The work becomes a row, and you can change it in the row itself. When there are several apartments, rooms or floors click \"+ Add an apartment, room or floor\".",
        "The \"Quote details\" card holds the project, address and validity, files, terms and warranty, notes, discount, design and images and currency.",
        "In the \"Quote summary\" click \"Save the quote\". Saving is not sending: the quote is saved as a draft and \"Saved. Not sent yet.\" appears - from there you can see how the client will see it, go back to editing or go to the quote list.",
      ],
    },
    evidence: [
      { file: 'src/components/NewQuoteMenu.jsx', labels: ["הצעה חדשה","New quote","איך תרצו להתחיל?","How would you like to start?"] },
      { file: 'src/utils/newQuoteChoices.js', labels: ["ממלאים בעצמכם","Fill it in yourselves"] },
      { file: 'src/components/QuoteForm.jsx', labels: ["למי מכינים את ההצעה?","Who is this quote for?","סוג לקוח (חובה)","להמשך","Continue","מה מוסיפים להצעה?","What goes in the quote?","+ הוספת עבודה או מוצר","+ Add work or a product","+ הוספת דירה, חדר או קומה","+ Add an apartment, room or floor","פרטי ההצעה","Quote details","סיכום ההצעה","Quote summary","שמירת ההצעה","Save the quote"] },
      { file: 'src/components/QuoteSavedScreen.jsx', labels: ["נשמרה. עדיין לא נשלחה.","Saved. Not sent yet."] },
      { file: 'src/pages/Dashboard.jsx', labels: ["הגדרות העסק","Business Settings"] },
    ],
  },
  // 2026-11-12 (unified quote, L-14): dividing a quote into apartments / rooms / floors, rooms in the work, what the client sees
  {
    id: 'quote_places',
    capabilityIds: ['measured_quote', 'quote_create', 'quote_edit'],
    he: {
      task: "הצעה לכמה דירות, חדרים או קומות",
      steps: [
        "בשלב \"מה מוסיפים להצעה?\" לוחצים \"+ הוספת דירה, חדר או קומה\", בוחרים מה מוסיפים (דירה, חדר, קומה או שם אחר) וכמה. כשיש יותר מאחת נשאלים אם העבודות זהות: \"כן\" - ממלאים פעם אחת והסכום מוכפל במספר; \"לא\" - כל אחת בנפרד.",
        "בכל דירה (או חדר / קומה) לוחצים \"הוספת עבודה או מוצר\". בשאלה \"איפה עושים אותה?\" אפשר לבחור כמה חדרים - לכל חדר נוספת שורה נפרדת עם כמות ומחיר משלה (למשל ריצוף במטבח ובסלון באריחים שונים).",
        "בדירה נוספת שעדיין ריקה מופיע כפתור להעתקת מה שמילאתם בראשונה. בכפתור הפעולות שבכותרת של כל דירה יש מספר עותקים זהים, הפרדת עותק ושמירה כתבנית; מתחת לרשימה יש \"מתבנית שמורה\" ו\"ביטול החלוקה (העבודות נשמרות)\".",
        "הלקוח רואה את ההצעה כשהכול פתוח, עם חץ ליד שם כל דירה שסוגר ופותח את הפירוט, ובראש הרשימה \"תצוגת מסמך מלא\" ו\"תצוגת שורות סיכום\". בהדפסה ובקובץ בוחרים מסמך מלא או חלקי.",
      ],
    },
    en: {
      task: "A quote for several apartments, rooms or floors",
      steps: [
        "In the \"What goes in the quote?\" step click \"+ Add an apartment, room or floor\", choose what you add (an apartment, room, floor or another name) and how many. When there is more than one you are asked whether the work is identical: \"Yes\" - fill it in once and the amount is multiplied by the number; \"No\" - each one separately.",
        "In each apartment (or room / floor) click \"Add work or a product\". In \"Where is this work done?\" you can choose several rooms - each room gets its own row with its own quantity and price (for example flooring in the kitchen and the living room with different tiles).",
        "An added apartment that is still empty shows a button that copies what you filled in the first one. The actions button in the header of each apartment holds the number of identical copies, separating one copy and saving as a template; under the list there are \"From a saved template\" and \"Remove the division (the work stays)\".",
        "The client sees the quote with everything open, an arrow beside each apartment name that closes and opens its details, and \"Full document view\" and \"Summary rows view\" above the list. Printing and the file offer a full or a partial document.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["מה מוסיפים להצעה?","What goes in the quote?","+ הוספת דירה, חדר או קומה","+ Add an apartment, room or floor","הוספת עבודה או מוצר","Add work or a product","מתבנית שמורה","From a saved template","ביטול החלוקה (העבודות נשמרות)","Remove the division (the work stays)"] },
      { file: 'src/components/PlacesDialog.jsx', labels: ["כן","Yes","לא","No"] },
      { file: 'src/components/WorkItemDialog.jsx', labels: ["איפה עושים אותה?","Where is this work done?"] },
      { file: 'src/pages/PublicQuote.jsx', labels: ["תצוגת מסמך מלא","תצוגת שורות סיכום"] },
      { file: 'src/pages/PublicQuoteEn.jsx', labels: ["Full document view","Summary rows view"] },
    ],
  },
  {
    id: 'send_quote',
    capabilityIds: ['quote_email', 'owner_whatsapp_share', 'quote_status'],
    he: {
      task: 'שליחת הצעה ללקוח',
      steps: [
        'בתפריט הצד לוחצים על "הצעות מחיר" ומוצאים את ההצעה ברשימה.',
        'לוחצים "פתיחה" ליד ההצעה.',
        'בוחרים "שליחה במייל", "וואטסאפ", או "העתקה" (מעתיק הודעה עם הקישור להצעה, להדבקה בכל מקום).',
        'הצעה בטיוטה מסומנת "נשלחה" אוטומטית אחרי שליחה במייל או פתיחת וואטסאפ.',
      ],
    },
    en: {
      task: 'Sending a quote to a client',
      steps: [
        'In the sidebar click "Quotes" and find the quote in the list.',
        'Click "Open" next to the quote.',
        'Choose "Email", "WhatsApp", or "Copy" (copies a message with the quote link to paste anywhere).',
        'A draft is marked "Sent" automatically after an email send or when WhatsApp opens.',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['פתיחה', 'Open', 'שליחה במייל', 'Email', 'וואטסאפ', 'WhatsApp', 'העתקה', 'Copy'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הצעות מחיר', 'Quotes'] },
    ],
  },
  {
    id: 'quote_pdf',
    capabilityIds: ['quote_pdf', 'quote_print'],
    he: {
      task: 'הורדת הצעה כ-PDF',
      steps: [
        'ברשימת "הצעות מחיר" לוחצים "פתיחה" ליד ההצעה ואז "צפייה", כדי לראות את ההצעה כמו שהלקוח רואה אותה.',
        'לוחצים "הורדה כ-PDF". את הקובץ אפשר גם להדפיס.',
      ],
    },
    en: {
      task: 'Downloading a quote as a PDF',
      steps: [
        'In the "Quotes" list click "Open" next to the quote and then "View" to see it the way the client sees it.',
        'Click "Download PDF". The file can also be printed.',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['צפייה', 'View'] },
      { file: 'src/pages/PublicQuote.jsx', labels: ['הורדה כ-PDF'] },
      { file: 'src/pages/PublicQuoteEn.jsx', labels: ['Download PDF'] },
    ],
  },
  {
    id: 'quote_templates',
    capabilityIds: ['quote_create'],
    he: {
      task: "שמירת הצעה כתבנית והתחלה מתבנית",
      steps: [
        "בעורך ההצעה, בכרטיס \"פרטי ההצעה\", לוחצים \"שמירה כתבנית (בלי פרטי לקוח)\". נשמרים הנושא והפריטים, בלי פרטי הלקוח.",
        "כדי להתחיל מתבנית: לוחצים \"הצעה חדשה\", בוחרים \"מתבנית שמורה\", ממלאים את הלקוח ולוחצים \"להמשך\", ואז בוחרים את התבנית. סוג הלקוח שבחרתם לא משתנה; כשהמחירים בתבנית לפי בסיס מע״מ אחר, נשאלים אם להשתמש בהם.",
      ],
    },
    en: {
      task: "Saving a quote as a template and starting from a template",
      steps: [
        "In the quote editor, in the \"Quote details\" card, click \"Save as template (no customer details)\". The subject and the items are saved, without the customer details.",
        "To start from a template: click \"New quote\", choose \"From a saved template\", fill in the client and click \"Continue\", then pick the template. The client type you chose does not change.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטי ההצעה","Quote details","שמירה כתבנית (בלי פרטי לקוח)","Save as template (no customer details)","להמשך","Continue"] },
      { file: 'src/utils/newQuoteChoices.js', labels: ["מתבנית שמורה","From a saved template"] },
      { file: 'src/components/NewQuoteMenu.jsx', labels: ["הצעה חדשה","New quote"] },
    ],
  },
  {
    id: 'smart_quote_ai',
    capabilityIds: ['smart_quote'],
    he: {
      task: "הצעת מחיר חכמה עם AI",
      steps: [
        "לוחצים \"הצעה חדשה\", בוחרים \"מתארים ל-AI\", ממלאים את הלקוח ולוחצים \"להמשך\".",
        "מתארים את העבודה במילים, או מכתיבים בקול בלחיצה על המיקרופון בפינת השדה. אפשר לתאר גם מבנה, למשל: שתי דירות זהות, בכל אחת ריצוף במטבח - וה-AI מציע את הדירות, מספר העותקים, העבודות והחדרים.",
        "ה-AI מציע שורות לבדיקה. מחיר מוצע רק לפריט מהקטלוג או כשכתבתם אותו. מה שלא ברור מסומן ולא מנוחש, ואם לא כתוב אם הדירות זהות - הוא שואל. בודקים, מתקנים ומאשרים לפני שמשהו נכנס להצעה.",
      ],
    },
    en: {
      task: "An AI smart quote",
      steps: [
        "Click \"New quote\", choose \"Describe it to AI\", fill in the client and click \"Continue\".",
        "Describe the job in words, or dictate it by clicking the microphone in the corner of the field. You can describe a structure too, for example: two identical apartments, flooring in the kitchen of each - and the AI suggests the apartments, the number of copies, the work and the rooms.",
        "The AI suggests lines to check. A price is suggested only for an item from your catalog or when you wrote it. What is unclear is marked, never guessed, and when it is not written whether the apartments are identical, it asks. Review, correct and approve before anything enters the quote.",
      ],
    },
    evidence: [
      { file: 'src/utils/newQuoteChoices.js', labels: ["מתארים ל-AI","Describe it to AI"] },
      { file: 'src/components/NewQuoteMenu.jsx', labels: ["הצעה חדשה","New quote"] },
      { file: 'src/components/QuoteForm.jsx', labels: ["להמשך","Continue"] },
    ],
  },
  // Owner console 2026-11-03 (typed approval incl. L-14, L-17): quote from a file (SMART PACK)
  // Owner console 2026-11-03 (typed approval incl. L-14, L-17): quote from a file (SMART PACK); 2026-11-12: "מעלים קובץ", after the client step
  {
    id: 'quote_from_file',
    capabilityIds: ['smart_quote'],
    he: {
      task: "הצעת מחיר מקובץ",
      steps: [
        "לוחצים \"הצעה חדשה\", בוחרים \"מעלים קובץ\" (הצעת מחיר מקובץ), ממלאים את הלקוח ולוחצים \"להמשך\".",
        "לוחצים \"בחרו קובץ\", בוחרים קובץ PDF או JPG אחד ולוחצים \"קריאת הפרטים\".",
        "בכל שורה מוצגים \"מחיר במסמך\" ו\"המחיר שלכם\". ממלאים את המחיר שלכם ולוחצים \"הוספת השורות להצעה\". הקובץ לא נשמר.",
      ],
    },
    en: {
      task: "A quote from a file",
      steps: [
        "Click \"New quote\", choose \"Upload a file\" (Quote from a file), fill in the client and click \"Continue\".",
        "Click \"Choose a file\", pick one PDF or JPG and click \"Read details\".",
        "Each line shows \"Price in the document\" and \"Your price\". Fill in your price and click \"Add the lines to the quote\". The file is not stored.",
      ],
    },
    evidence: [
      { file: 'src/utils/newQuoteChoices.js', labels: ["מעלים קובץ","Upload a file"] },
      { file: 'src/components/NewQuoteMenu.jsx', labels: ["הצעה חדשה","New quote"] },
      { file: 'src/components/QuoteForm.jsx', labels: ["להמשך","Continue"] },
      { file: 'src/components/QuoteFromFileDialog.jsx', labels: ["בחרו קובץ","קריאת הפרטים","מחיר במסמך","המחיר שלכם","הוספת השורות להצעה","Choose a file","Read details","Price in the document","Your price","Add the lines to the quote"] },
    ],
  },
  // Owner console 2026-11-06 (typed approval incl. L-14): "עריכה חכמה" - edit an existing unsigned quote with the smart-quote AI, opened from the quote's row.
  {
    id: 'smart_edit_quote',
    capabilityIds: ['smart_quote', 'quote_edit'],
    he: {
      task: 'עריכה חכמה',
      steps: [
        'ברשימת "הצעות מחיר" מוצאים הצעה שעדיין לא נחתמה ולוחצים "עריכה חכמה" בשורת הפעולות של ההצעה.',
        'ההצעה נפתחת לעריכה וחלון ה-AI מכוון אליה. מתארים במילים, או מכתיבים בקול, מה להוסיף, לשנות או למחוק - שורות, כמויות, מחירים, הערות או הנחה.',
        'ה-AI מציע את השינויים בהצעה ואת השורות החדשות. בודקים, מסמנים את מה שמתאים ולוחצים "החלת השינויים בהצעה". מחיר משתנה רק כשכתבתם אותו בבקשה, ושום דבר לא נשמר עד ששומרים את ההצעה.',
        'אפשר גם לשנות כמות או מחיר של שורה ידנית, ישירות בשדות השורה בעורך ההצעה.',
        'הצעה שהלקוח כבר חתם עליה נעולה - הכפתור לא פעיל ("לא ניתן לערוך הצעה חתומה").',
      ],
    },
    en: {
      task: 'Smart edit',
      steps: [
        'In the "Quotes" list, find a quote that is not signed yet and click "Smart edit" in the quote\'s row actions.',
        'The quote opens for editing and the AI dialog is pointed at it. Describe in words, or dictate by voice, what to add, change or remove - lines, quantities, prices, notes or a discount.',
        'The AI suggests the changes to the quote and any new lines. Review, tick what fits and click "Apply the changes to the quote". A price changes only when you wrote it in the request, and nothing is saved until you save the quote.',
        'You can also change a line\'s quantity or price by hand, right in the row\'s fields in the quote editor.',
        'A quote the client has already signed is locked - the button is disabled ("Cannot edit a signed quote").',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['עריכה חכמה', 'Smart edit', 'לא ניתן לערוך הצעה חתומה', 'Cannot edit a signed quote'] },
      // Owner console 2026-11-06 (release B): the smart edit applies the reviewed changes
      { file: 'src/components/AiQuoteDraftDialog.jsx', labels: ['החלת השינויים בהצעה', 'Apply the changes to the quote'] },
    ],
  },
  // Owner console 2026-11-06 (typed L-09 / L-14 / L-17 / L-24 / L-27 approval, release A): the quantity is edited too
  // Owner console 2026-11-08 (stage 2 of the one quote builder, typed incl. L-09 / L-14): in the row itself - the quick window is gone
  {
    id: 'quote_item_price_quantity',
    capabilityIds: ['quote_create', 'quote_edit'],
    he: {
      task: 'שינוי כמות או מחיר של פריט בהצעה',
      steps: [
        'בעורך ההצעה, בשורה של הפריט, משנים את הכמות (מספר שלם או עשרוני, למשל 2.5) או את המחיר ישירות בשדות. הסכום של השורה מתעדכן מיד, ואחר כך שומרים את ההצעה.',
        'בפריט לפי "שטח" או "אורך" משנים את המידות באותה שורה. אפשר להוסיף "מידה נוספת", או ללחוץ ליד המידות על "השטח כבר ידוע?" או "האורך כבר ידוע?" כשהשטח או האורך כבר ידועים.',
        'מחיר נכתב עם נקודה עשרונית, למשל 1200.50. מחיר ריק מסומן כחסר ולא נחשב 0. פרטים נוספים ללקוח נמצאים בכפתור "פעולות לשורה" של השורה (בטלפון: שלוש הנקודות של השורה), ב"פרטים ללקוח".',
      ],
    },
    en: {
      task: 'Changing the quantity or the price of an item in a quote',
      steps: [
        'In the quote editor, on the item\x27s row, change the quantity (a whole or decimal number, for example 2.5) or the price right in the fields. The row total updates at once; then save the quote.',
        'For an item billed by "Area" or "Length" change the sizes in the same row. You can add "Another size", or click "I already know the area" or "I already know the length" beside the sizes when the area or length is already known.',
        'A price uses a decimal point, for example 1200.50. An empty price is marked as missing and never counts as 0. More details for the customer are in the "Row actions" button of the row (on a phone: the three dots of the row), under "Details for the customer".',
      ],
    },
    evidence: [
      { file: 'src/components/QuoteRowsEditor.jsx', labels: ['שטח', 'Area', 'אורך', 'Length', 'מידה נוספת', 'Another size', 'השטח כבר ידוע?', 'I already know the area', 'האורך כבר ידוע?', 'I already know the length', 'פרטים ללקוח', 'Details for the customer'] },
    ],
  },
  // Owner console 2026-11-08 (typed: "מאשר שינוי ב-L-14 לידע הצ'אט על יחידות זהות ומחיר משותף בשלב 3"): identical units + a shared price
  {
    id: 'quote_identical_units',
    capabilityIds: ['quote_create', 'quote_edit'],
    he: {
      task: "דירות זהות (או חדרים / קומות זהים) ומחיר משותף אחרי שכפול",
      steps: [
        "בהצעה מחולקת לוחצים על כפתור הפעולות בכותרת של הדירה (או החדר / הקומה) ובוחרים את מספר העותקים הזהים. מקלידים מספר שלם ולוחצים \"אישור\". השורות הן לעותק אחד, והסכום נספר כפול מספר העותקים.",
        "כדי לשנות עותק אחד בוחרים באותו כפתור את הפרדת העותק: מספר העותקים יורד ב-1 ונוצר אחריו עותק נפרד לעריכה. מיד אחרי ההפרדה אפשר ללחוץ \"ביטול\".",
        "השכפול יוצר עותק אחד עם השורות שלו, והמחירים של כל שורה והעותק שלה מקושרים. כשמשנים מחיר בשורה מקושרת נשאלים אם לעדכן גם את השורות המקושרות: \"רק כאן\", עדכון גם בהן, או \"ביטול\". אחרי עדכון אפשר ללחוץ \"ביטול עדכון המחירים\".",
        "בהצעה ללקוח, בהדפסה ובקובץ מופיעים שם הדירה עם מספר העותקים (למשל דירה טיפוס א׳ × 12), הפירוט לעותק אחד והסכום של כל העותקים.",
      ],
    },
    en: {
      task: "Identical apartments (or rooms / floors) and a shared price after duplicating",
      steps: [
        "In a divided quote click the actions button in the header of the apartment (or room / floor) and choose the number of identical copies. Type a whole number and click \"Confirm\". The rows are for one copy, and the total counts every copy.",
        "To change one copy choose separating one copy in the same button: the count goes down by 1 and a separate copy to edit appears right after it. Right after separating you can click \"Undo\".",
        "Duplicating makes one copy with its rows, and the price of every row is linked to its copy. When you change the price of a linked row you are asked whether the linked rows take it too: \"Only here\", update them too, or \"Cancel\". After an update you can click \"Undo the price update\".",
        "The client quote, the print and the file show the apartment name with its number of copies (for example Type A apartment × 12), the details for one copy and the total of all copies.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["אישור","Confirm","ביטול","Undo"] },
      { file: 'src/components/QuoteRowsEditor.jsx', labels: ["רק כאן","Only here","ביטול עדכון המחירים","Undo the price update","Cancel"] },
    ],
  },
  // Owner console 2026-11-08 (typed: "מאשר שינוי ב-L-14 לידע הצ'אט על תבנית יחידה בשלב 4"): unit templates
  // Owner console 2026-11-08 (typed: "מאשר שינוי ב-L-14 לידע הצ'אט על תבנית יחידה בשלב 4"): unit templates; 2026-11-12: the place words
  {
    id: 'quote_unit_template',
    capabilityIds: ['quote_create', 'quote_edit'],
    he: {
      task: "תבנית לדירה (או חדר / קומה) - שמירה והוספה להצעה אחרת",
      steps: [
        "בכפתור הפעולות שבכותרת של הדירה (או החדר / הקומה) בוחרים \"שמירה כתבנית\". נותנים שם ובוחרים אם לשמור מחירים ופרטים ללקוח. השורות, סוג החיוב והמידות נשמרים תמיד; פרטי לקוח, כתובת ושמות המקומות במידות לעולם לא נשמרים.",
        "כדי להוסיף מקום שמור להצעה פתוחה לוחצים \"מתבנית שמורה\" (מתחת לרשימה בהצעה מחולקת, או בחלון של \"+ הוספת דירה, חדר או קומה\"), בוחרים את התבנית ולוחצים \"הוספה להצעה\". מקום אחד עם השורות שלו נוסף לסוף ההצעה.",
        "כשהמטבע או בסיס המע״מ של המחירים בתבנית שונים מההצעה, נשאלים לפני ההוספה אם להשתמש במחירים או להוסיף בלי מחירים.",
        "בחלון ההוספה מתבנית שמורה בתוך ההצעה מופיעות רק תבניות של מקום, ובחלון התבניות של הצעה חדשה מופיעות רק תבניות הצעה. בכל חלון מוחקים רק את התבניות שלו.",
      ],
    },
    en: {
      task: "A template for an apartment (or room / floor) - saving it and adding it to another quote",
      steps: [
        "In the actions button in the header of the apartment (or room / floor) choose \"Save as a template\". Give it a name and choose whether to keep the prices and the details for the customer. The rows, the billing type and the sizes are always kept; customer details, the address and the place names of the sizes are never kept.",
        "To add a saved place to an open quote click \"From a saved template\" (under the list in a divided quote, or in the window of \"+ Add an apartment, room or floor\"), pick the template and click \"Add to the quote\". One place with its rows is added at the end of the quote.",
        "When the currency or the VAT basis of the template prices differs from the quote, you are asked before adding whether to use the prices or add without prices.",
        "The window for adding from a saved template inside a quote lists only place templates, and the template window of a new quote lists only quote templates. Each window deletes only its own templates.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["שמירה כתבנית","Save as a template","מתבנית שמורה","From a saved template","+ הוספת דירה, חדר או קומה","+ Add an apartment, room or floor"] },
      { file: 'src/components/QuoteTemplateDialogs.jsx', labels: ["הוספה להצעה","Add to the quote","תבניות הצעה","Quote templates","תבניות יחידה","Unit templates"] },
    ],
  },
  {
    id: 'quote_attachment',
    capabilityIds: ['attachments'],
    he: {
      task: "צירוף קובץ להצעה",
      steps: [
        "בעורך ההצעה פותחים את הכרטיס \"פרטי ההצעה\" (\"פתיחת פרטי ההצעה\").",
        "בקטע \"קבצים מצורפים / שרטוטים\" לוחצים על כפתור צירוף הקובץ ובוחרים את הקובץ.",
        "לוחצים \"שמירת ההצעה\".",
      ],
    },
    en: {
      task: "Attaching a file to a quote",
      steps: [
        "In the quote editor open the \"Quote details\" card (\"Open quote details\").",
        "In the \"Attachments\" section click the attach-file button and choose the file.",
        "Click \"Save the quote\".",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטי ההצעה","Quote details","פתיחת פרטי ההצעה","Open quote details","קבצים מצורפים / שרטוטים","Attachments","צירוף קובץ","Attach file","שמירת ההצעה","Save the quote"] },
    ],
  },
  {
    id: 'add_client',
    capabilityIds: ['clients'],
    he: {
      task: 'הוספת לקוח',
      steps: [
        'בתפריט הצד לוחצים על "לקוחות" ואז "לקוח חדש".',
        'ממלאים את הפרטים ושומרים. לקוח נוצר גם אוטומטית כששומרים הצעה ללקוח חדש.',
      ],
    },
    en: {
      task: 'Adding a client',
      steps: [
        'In the sidebar click "Clients" and then "New Client".',
        'Fill in the details and save. A client is also created automatically when you save a quote for a new client.',
      ],
    },
    evidence: [
      { file: 'src/components/ClientsTab.jsx', labels: ['לקוח חדש', 'New Client'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['לקוחות', 'Clients'] },
      { file: 'src/components/QuoteForm.jsx', labels: ['בשמירה ייווצר כרטיס לקוח חדש ברשימת הלקוחות שלך.'] },
    ],
  },
  {
    id: 'add_catalog_item',
    capabilityIds: ['catalog'],
    he: {
      task: "הוספת פריט לקטלוג",
      steps: [
        "בתפריט הצד לוחצים על \"קטלוג\" ואז \"הוספת פריט\".",
        "ממלאים שם ומחיר. אפשר לבחור \"איך מחשבים (לא חובה)\" - ליחידה, למ״ר, למטר, לשעה, ליום, לק״ג או מחיר אחד לכל העבודה. לוחצים \"שמירה\". כשבוחרים את הפריט בהצעה, אופן החיוב נבחר לפיו; פריט בלי בחירה הוא ליחידה.",
      ],
    },
    en: {
      task: "Adding a catalog item",
      steps: [
        "In the sidebar click \"Catalog\" and then \"Add Item\".",
        "Fill in a name and a price. You can choose \"How is it priced (optional)\" - per item, per m², per metre, per hour, per day, per kg or one price for all the work. Click \"Save\". When you pick the item in a quote, its billing follows it; an item with no choice is per item.",
      ],
    },
    evidence: [
      { file: 'src/components/ServicesCatalog.jsx', labels: ["הוספת פריט","Add Item","שמירה","Save","איך מחשבים (לא חובה)","How is it priced (optional)"] },
      { file: 'src/pages/Dashboard.jsx', labels: ["קטלוג","Catalog"] },
    ],
  },
  {
    id: 'tasks',
    capabilityIds: ['dashboard_overview'],
    he: {
      task: 'משימות',
      steps: [
        'בתפריט הצד לוחצים על "משימות" ואז "משימה חדשה".',
        'משימה שבוצעה מסמנים כהושלמה, והיא עוברת ללשונית ״הושלמו״. משימות פתוחות מופיעות בלשונית ״פתוחות״. אפשר גם למחוק משימה.',
      ],
    },
    en: {
      task: 'Tasks',
      steps: [
        'In the sidebar click "Tasks" and then "New task".',
        'Mark a finished task as done; it moves to the "Completed" tab. Open tasks are in the "Open" tab. A task can also be deleted.',
      ],
    },
    evidence: [
      { file: 'src/components/TasksTab.jsx', labels: ['משימה חדשה', 'New task', 'הושלמו', 'Completed', 'פתוחות', 'Open', 'Delete task'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['משימות', 'Tasks'] },
    ],
  },
  {
    id: 'password_reset',
    capabilityIds: ['dashboard_overview'],
    he: {
      task: 'שכחתי סיסמה',
      steps: [
        'במסך הכניסה לוחצים "שכחת סיסמה?".',
        'מזינים את כתובת המייל ולוחצים "שליחת קישור לשחזור".',
        'בקישור שמגיע במייל מזינים "סיסמה חדשה" ולוחצים "שמירת הסיסמה החדשה".',
      ],
    },
    en: {
      task: 'Forgot password',
      steps: [
        'On the sign-in screen click "Forgot password?".',
        'Enter your email address and click "Send Reset Link".',
        'In the link that arrives by email enter a "New password" and click "Update Password & Save".',
      ],
    },
    evidence: [
      { file: 'src/components/AuthScreen.jsx', labels: ['שכחת סיסמה?', 'Forgot password?', 'שליחת קישור לשחזור', 'Send Reset Link', 'סיסמה חדשה', 'New password', 'שמירת הסיסמה החדשה', 'Update Password & Save'] },
    ],
  },
  {
    id: 'sign_out',
    capabilityIds: ['dashboard_overview'],
    he: {
      task: 'התנתקות',
      steps: ['פותחים את "הגדרות והתנתקות" ולוחצים "התנתקות".'],
    },
    en: {
      task: 'Signing out',
      steps: ['Open "Settings and sign out" and click "Sign out".'],
    },
    evidence: [
      { file: 'src/components/SidebarAccountMenu.jsx', labels: ['הגדרות והתנתקות', 'Settings and sign out', 'התנתקות', 'Sign out'] },
    ],
  },
  {
    id: 'signed_quote_locked',
    capabilityIds: ['quote_edit', 'public_quote_sign'],
    he: {
      task: 'למה אי אפשר לערוך הצעה חתומה',
      steps: ['הצעה שהלקוח חתם עליה נעולה: אי אפשר לערוך או למחוק אותה ("לא ניתן לערוך הצעה חתומה"). אפשר לשכפל אותה ("שכפל") וליצור ממנה הצעה חדשה.'],
    },
    en: {
      task: 'Why a signed quote cannot be edited',
      steps: ['A quote the client signed is locked: it cannot be edited or deleted ("Cannot edit a signed quote"). You can duplicate it ("Duplicate") and create a new quote from it.'],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['לא ניתן לערוך הצעה חתומה', 'Cannot edit a signed quote', 'לא ניתן למחוק הצעה חתומה', 'שכפל', 'Duplicate'] },
    ],
  },
  // ---- Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-14 ו-L-17: תיקוני העוזר לפי דוח הבדיקה"): the tasks the QA report found the
  // assistant could not explain although the product has them ----
  {
    id: 'quote_validity',
    capabilityIds: ['quote_expiry', 'quote_create'],
    he: {
      task: "קביעת תוקף להצעה",
      steps: [
        "בעורך ההצעה פותחים את הכרטיס \"פרטי ההצעה\" (\"פתיחת פרטי ההצעה\").",
        "בשדה \"בתוקף עד\" בוחרים את התאריך האחרון שבו הלקוח יכול לחתום, ולוחצים \"שמירת ההצעה\".",
        "אחרי התאריך הלקוח עדיין רואה את ההצעה, אבל אי אפשר לחתום עליה.",
      ],
    },
    en: {
      task: "Setting how long a quote is valid",
      steps: [
        "In the quote editor open the \"Quote details\" card (\"Open quote details\").",
        "In the \"Valid Until\" field choose the last date the client can sign, and click \"Save the quote\".",
        "After that date the client still sees the quote but can no longer sign it.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטי ההצעה","Quote details","פתיחת פרטי ההצעה","Open quote details","פרויקט, כתובת ותוקף","שמירת ההצעה","Save the quote"] },
      { file: 'src/pages/Dashboard.jsx', labels: ["בתוקף עד","Valid Until"] },
    ],
  },
  {
    id: 'quote_discount',
    capabilityIds: ['quote_create', 'quote_edit'],
    he: {
      task: "מתן הנחה בהצעה",
      steps: [
        "בעורך ההצעה פותחים את הכרטיס \"פרטי ההצעה\" (\"פתיחת פרטי ההצעה\") וממלאים \"הנחה על כל ההצעה (%)\" - אחוז בין 0 ל-100.",
        "הסכום ב\"סיכום ההצעה\" מתעדכן מיד. הנחה למוצר אחד בלבד נותנים דרך המחיר של אותה שורה.",
      ],
    },
    en: {
      task: "Giving a discount in a quote",
      steps: [
        "In the quote editor open the \"Quote details\" card (\"Open quote details\") and fill in \"Discount on the whole quote (%)\" - a percentage between 0 and 100.",
        "The total in the \"Quote summary\" updates at once. A discount on a single item is given through that line's own price.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטי ההצעה","Quote details","פתיחת פרטי ההצעה","Open quote details","סיכום ההצעה","Quote summary","הנחה על כל ההצעה (%)","Discount on the whole quote (%)","הנחה יכולה להיות בין 0 ל־100."] },
    ],
  },
  {
    id: 'quote_terms_deposit',
    capabilityIds: ['quote_create', 'business_settings'],
    he: {
      task: "תנאי תשלום, מקדמה ואחריות בהצעה",
      steps: [
        "בעורך ההצעה פותחים את הכרטיס \"פרטי ההצעה\" (\"פתיחת פרטי ההצעה\") ומגיעים ל\"תנאים ואחריות\".",
        "לוחצים \"התאמה להצעה זו\" וכותבים את תנאי התשלום, למשל מקדמה ותשלומים, ואת האחריות. זה טקסט שהלקוח רואה בהצעה; המערכת אינה גובה את התשלום.",
        "כדי שהתנאים ייכנסו אוטומטית לכל הצעה חדשה: ב\"הגדרות העסק\" ממלאים \"תנאים כלליים להצעות חדשות — ברירת מחדל\" ולוחצים \"שמירת הגדרות העסק\".",
      ],
    },
    en: {
      task: "Payment terms, a deposit and warranty in a quote",
      steps: [
        "In the quote editor open the \"Quote details\" card (\"Open quote details\") and go to \"Terms & Warranty\".",
        "Click \"Customize for this quote\" and write the payment terms, for example a deposit or installments, and the warranty. It is text the client sees in the quote; TEKANGO does not collect the payment.",
        "To have the terms in every new quote: in \"Business Settings\" fill in \"Default Terms & Conditions for New Quotes\" and click \"Save Business Settings\".",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטי ההצעה","Quote details","פתיחת פרטי ההצעה","Open quote details","תנאים ואחריות","Terms & Warranty","התאמה להצעה זו","Customize for this quote"] },
      { file: 'src/components/SettingsTab.jsx', labels: ["תנאים כלליים להצעות חדשות — ברירת מחדל","Default Terms & Conditions for New Quotes","שמירת הגדרות העסק","Save Business Settings"] },
      { file: 'src/pages/Dashboard.jsx', labels: ["הגדרות העסק","Business Settings"] },
    ],
  },
  {
    id: 'quote_vat',
    capabilityIds: ['quote_create'],
    he: {
      task: "מע״מ בהצעה",
      steps: [
        "בשלב \"למי מכינים את ההצעה?\" בוחרים סוג לקוח: \"עסקי (חברה/עוסק)\" - הסכומים ללא מע״מ, והמע״מ יתווסף למחיר הסופי; או \"פרטי\" - המחיר כולל מע״מ, ולא יתווסף מע״מ לסכום הכללי. הודעה על כך מופיעה מיד אחרי הבחירה, והמחיר בכל שורה פתוח לשינוי.",
        "שיעור המע״מ מחושב אוטומטית (18% בישראל) ואינו הגדרה שמשנים. \"סיכום ההצעה\" מציג את המע״מ ואת הסכום הכולל.",
      ],
    },
    en: {
      task: "VAT in a quote",
      steps: [
        "In the \"Who is this quote for?\" step choose the client type (\"Business\" or \"Private\").",
        "For an international business no VAT is added automatically, and the VAT rate is not a setting. The \"Quote summary\" shows the total.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["למי מכינים את ההצעה?","Who is this quote for?","עסקי (חברה/עוסק)","פרטי","Business","Private","ללא מע״מ","כולל מע״מ","סיכום ההצעה","Quote summary"] },
    ],
  },
  {
    id: 'quote_delete',
    capabilityIds: ['quote_history'],
    he: {
      task: 'מחיקת הצעה',
      steps: [
        'ברשימת "הצעות מחיר" לוחצים "פתיחה" ליד ההצעה ואז "מחיקה", ומאשרים.',
        'הצעה שהלקוח כבר חתם עליה אי אפשר למחוק ("לא ניתן למחוק הצעה חתומה"). הצעה שנמחקה אינה חוזרת.',
      ],
    },
    en: {
      task: 'Deleting a quote',
      steps: [
        'In the "Quotes" list click "Open" next to the quote, then "Delete", and confirm.',
        'A quote the client already signed cannot be deleted ("Cannot delete a signed quote"). A deleted quote does not come back.',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['פתיחה', 'Open', 'מחיקה', 'Delete', 'לא ניתן למחוק הצעה חתומה', 'Cannot delete a signed quote'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הצעות מחיר', 'Quotes'] },
    ],
  },
  {
    id: 'share_default_texts',
    capabilityIds: ['owner_whatsapp_share', 'business_settings'],
    he: {
      task: 'שינוי הודעת הוואטסאפ הקבועה והודעת התודה',
      steps: [
        'ב"הגדרות העסק" פותחים את "שיתוף ותודה ללקוח".',
        'ממלאים "הודעת ברירת מחדל לוואטסאפ (לא חובה)" ו/או "הודעת תודה אחרי חתימה (לא חובה)" ולוחצים "שמירה". הקישור להצעה מצורף תמיד להודעה.',
      ],
    },
    en: {
      task: 'Changing the default WhatsApp message and the thank-you',
      steps: [
        'In "Business Settings" open "Sharing & thank-you".',
        'Fill in "Default WhatsApp message (optional)" and/or "Thank-you after signing (optional)" and click "Save". The quote link is always added to the message.',
      ],
    },
    evidence: [
      { file: 'src/components/SettingsTab.jsx', labels: ['שיתוף ותודה ללקוח', 'Sharing & thank-you'] },
      { file: 'src/components/ShareDefaultsSettings.jsx', labels: ['הודעת ברירת מחדל לוואטסאפ (לא חובה)', 'Default WhatsApp message (optional)', 'הודעת תודה אחרי חתימה (לא חובה)', 'Thank-you after signing (optional)', 'שמירה', 'Save'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הגדרות העסק', 'Business Settings'] },
    ],
  },
  {
    id: 'business_currency',
    capabilityIds: ['business_settings'],
    he: {
      task: 'מטבע ההצעות',
      steps: ['בחשבון ישראלי ההצעות הן תמיד בשקלים (₪), והמטבע אינו ניתן לשינוי.'],
    },
    en: {
      task: 'The currency of your quotes',
      steps: [
        'In "Business Settings" choose the currency in "Business Currency" (USD, EUR or GBP) and click "Save Business Settings".',
        'New quotes use that currency. It is the currency shown in the quote; TEKANGO does not collect payments.',
      ],
    },
    evidence: [
      { file: 'src/components/SettingsTab.jsx', labels: ['מטבע העסק', 'Business Currency', 'Save Business Settings', 'USD ($)'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['Business Settings'] },
    ],
  },
  {
    id: 'improve_quote',
    capabilityIds: ['quote_history', 'quote_edit'],
    he: {
      task: 'הכפתור "שיפור ההצעה"',
      steps: [
        'ברשימת "הצעות מחיר" לוחצים "פתיחה" ליד ההצעה ואז "שיפור ההצעה".',
        'הכלי בודק את ההצעה מנקודת המבט של הלקוח ומציע מה לשנות כדי שתהיה ברורה ואטרקטיבית יותר. הבדיקה פנימית - הלקוח לא רואה אותה.',
        'שום דבר לא משתנה בהצעה בלי אישור שלכם: הצעה לתוספת נכנסת רק בלחיצה על "הוספה להצעה". ניתוח הבינה הוא חלק מחכם פלוס.',
      ],
    },
    en: {
      task: 'The "Improve quote" button',
      steps: [
        'In the "Quotes" list click "Open" next to the quote, then "Improve quote".',
        'It reviews the quote from the client\'s point of view and suggests what to change so it is clearer and more attractive. The check is internal - the client never sees it.',
        'Nothing changes in the quote without your approval: a suggested addition goes in only when you click "Add to the quote". The AI analysis is part of SMART PACK.',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['פתיחה', 'Open', 'שיפור ההצעה', 'Improve quote', 'מציע מה לשנות בהצעה כדי שתהיה ברורה ואטרקטיבית יותר בעיני הלקוח שלכם.'] },
      { file: 'src/components/CustomerTwinPanel.jsx', labels: ['ניתוח הבינה של שיפור ההצעה הוא חלק מחכם פלוס.', 'The AI analysis of Improve quote is part of SMART PACK.', 'הוספה להצעה', 'Add to the quote', 'הבדיקה פנימית בלבד. הלקוח לא רואה אותה.'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הצעות מחיר', 'Quotes'] },
    ],
  },
  // Owner console 2026-10-25, typed: "מאשר שינוי ב-L-14: הוראה לסימון מצב הצעה" (the LIVE check answered "mark as paid" with the
  // sending steps). Truthful: an approved / paid / signed quote is locked; since 2026-10-25 (Owner typed: "הצעה שאושרה או נחתמה אפשר לסמן
  // כשולמה (רק המצב)") the one change left is approved -> paid, through "סימון כשולמה" (guard_quote_immutability, 20261025100000).
  {
    id: 'quote_status_mark',
    capabilityIds: ['quote_status'],
    he: {
      task: "סימון מצב הצעה (נשלחה, אושרה, שולמה)",
      steps: [
        "ברשימת \"הצעות מחיר\" לוחצים \"פתיחה\" ליד ההצעה ואז \"עריכה\".",
        "בכרטיס \"פרטי ההצעה\", בשדה \"מצב ההצעה\", בוחרים \"נשלחה\", \"אושרה\" או \"שולמה\", ולוחצים \"שמירת ההצעה\". המצב רק מסמן את ההצעה; הוא לא גובה תשלום.",
        "הצעה שאושרה או שהלקוח חתם עליה נעולה לעריכה (\"לא ניתן לערוך הצעה חתומה\"). כשהלקוח שילם, פותחים את ההצעה ברשימה, לוחצים \"סימון כשולמה\" ומאשרים. אחרי הסימון אי אפשר לחזור ל\"אושרה\", והצעה ששולמה נעולה לגמרי.",
      ],
    },
    en: {
      task: "Marking a quote's status (Sent, Approved, Paid)",
      steps: [
        "In the \"Quotes\" list click \"Open\" next to the quote, then \"Edit\".",
        "In the \"Quote details\" card, in \"Quote status\", choose \"Sent\", \"Approved\" or \"Paid\" and click \"Save the quote\". The status only marks the quote; it does not collect payment.",
        "A quote that is approved or signed by the client is locked for editing (\"Cannot edit a signed quote\"). When the client has paid, open the quote in the list, click \"Mark as paid\" and confirm. After marking it you cannot go back to \"Approved\", and a paid quote is fully locked.",
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ["פתיחה","Open","עריכה","Edit","לא ניתן לערוך הצעה חתומה","Cannot edit a signed quote","סימון כשולמה","Mark as paid"] },
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטי ההצעה","Quote details","מצב ההצעה","Quote status","נשלחה","Sent","אושרה","Approved","שולמה","Paid","שמירת ההצעה","Save the quote"] },
      { file: 'src/pages/Dashboard.jsx', labels: ["הצעות מחיר","Quotes"] },
    ],
  },
  {
    id: 'email_not_received',
    capabilityIds: ['quote_email'],
    he: {
      task: 'הלקוח לא קיבל את המייל',
      steps: [
        'בודקים בכרטיס ההצעה שכתובת המייל של הלקוח נכונה. נקודה אדומה ליד המייל אומרת שהכתובת אינה קיימת או שהשליחה נכשלה.',
        'מבקשים מהלקוח לבדוק גם בתיקיית הספאם או דואר הזבל.',
        'אפשר לשלוח שוב: ברשימת "הצעות מחיר" לוחצים "פתיחה" ליד ההצעה ואז "שליחה במייל", או לשלוח ב"וואטסאפ" או ב"העתקה".',
      ],
    },
    en: {
      task: 'The client did not get the email',
      steps: [
        'Check in the quote that the client\'s email address is correct. A red dot next to the email means the address does not exist or the send failed.',
        'Ask the client to check the spam or junk folder too.',
        'You can send again: in the "Quotes" list click "Open" next to the quote, then "Email" - or send it by "WhatsApp" or "Copy".',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['פתיחה', 'Open', 'שליחה במייל', 'Email', 'וואטסאפ', 'WhatsApp', 'העתקה', 'Copy', 'כתובת המייל שאליה נשלחה ההצעה אינה קיימת', 'שליחת המייל נכשלה'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הצעות מחיר', 'Quotes'] },
    ],
  },
]);

/** The projection the AI facts carry: the task and the steps per language (evidence stays in the repository). */
export function projectHowTo(entry) {
  return { id: entry.id, capabilityIds: [...entry.capabilityIds], he: { task: entry.he.task, steps: [...entry.he.steps] }, en: { task: entry.en.task, steps: [...entry.en.steps] } };
}
