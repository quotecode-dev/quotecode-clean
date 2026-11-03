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
  {
    id: 'first_quote',
    capabilityIds: ['quote_create', 'profile_prerequisites', 'catalog'],
    he: {
      task: 'יצירת הצעת מחיר (גם הראשונה)',
      steps: [
        'לפני ההצעה הראשונה צריך טלפון עסק (ובישראל גם ח.פ / עוסק מורשה) ב"הגדרות העסק".',
        'לוחצים "הצעה חדשה" ובוחרים "הצעת מחיר רגילה".',
        'בשלב "למי ההצעה?" ממלאים את פרטי הלקוח ובוחרים "סוג לקוח (חובה)".',
        'בשלב "מה העבודה או המוצר?" מוסיפים פריטים: כותבים תיאור, או בוחרים מהקטלוג ("בחירת פריט מהקטלוג…").',
        'בשלב "מחיר" ממלאים כמות ומחיר.',
        'בשלב "בדיקה ושמירה" לוחצים "הפקה ושמירה בענן". כל הצעה חדשה נשמרת כטיוטה, ואחרי השמירה אפשר לשלוח אותה.',
      ],
    },
    en: {
      task: 'Creating a quote (including the first one)',
      steps: [
        'Before the first quote a business phone is required in "Business Settings".',
        'Click "New quote" and choose "Standard quote".',
        'In the "Who is it for?" step fill in the client details and choose the client type.',
        'In the "What work or product?" step add items: type a description, or pick from the catalog ("Choose from catalog...").',
        'In the "Price" step enter the quantity and the price.',
        'In the "Review and save" step click "Generate & Save to Cloud". Every new quote is saved as a draft; after saving you can send it.',
      ],
    },
    evidence: [
      { file: 'src/components/NewQuoteMenu.jsx', labels: ['הצעה חדשה', 'New quote'] },
      { file: 'src/utils/newQuoteChoices.js', labels: ['הצעת מחיר רגילה', 'Standard quote'] },
      { file: 'src/components/QuoteForm.jsx', labels: ['למי ההצעה?', 'Who is it for?', 'מה העבודה או המוצר?', 'What work or product?', 'בדיקה ושמירה', 'Review and save', 'סוג לקוח (חובה)', 'Every new quote is saved as a draft.'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הפקה ושמירה בענן', 'Generate & Save to Cloud', 'בחירת פריט מהקטלוג…', 'Choose from catalog...'] },
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
        'בוחרים "שליחה במייל", "וואטסאפ", או "העתקת הודעה" (מעתיק הודעה עם הקישור להצעה, להדבקה בכל מקום).',
        'הצעה בטיוטה מסומנת "נשלחה" אוטומטית אחרי שליחה במייל או פתיחת וואטסאפ.',
      ],
    },
    en: {
      task: 'Sending a quote to a client',
      steps: [
        'In the sidebar click "Quotes" and find the quote in the list.',
        'Click "Open" next to the quote.',
        'Choose "Email", "WhatsApp", or "Copy message" (copies a message with the quote link to paste anywhere).',
        'A draft is marked "Sent" automatically after an email send or when WhatsApp opens.',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['פתיחה', 'Open', 'שליחה במייל', 'Email', 'וואטסאפ', 'WhatsApp', 'העתקת הודעה', 'Copy message'] },
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
      task: 'שמירת הצעה כתבנית והתחלה מתבנית',
      steps: [
        'בעורך ההצעה, מתחת לכפתור השמירה, לוחצים "שמירה כתבנית (בלי פרטי לקוח)". נשמרים הנושא והפריטים, בלי פרטי הלקוח.',
        'כדי להתחיל מתבנית: לוחצים "הצעה חדשה", בוחרים "מתבנית שמורה" ובוחרים את התבנית.',
      ],
    },
    en: {
      task: 'Saving a quote as a template and starting from a template',
      steps: [
        'In the quote editor, under the save button, click "Save as template (no customer details)". The subject and the items are saved, without the customer details.',
        'To start from a template: click "New quote", choose "From a saved template" and pick the template.',
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ['שמירה כתבנית (בלי פרטי לקוח)', 'Save as template (no customer details)'] },
      { file: 'src/utils/newQuoteChoices.js', labels: ['מתבנית שמורה', 'From a saved template'] },
      { file: 'src/components/NewQuoteMenu.jsx', labels: ['הצעה חדשה', 'New quote'] },
    ],
  },
  {
    id: 'smart_quote_ai',
    capabilityIds: ['smart_quote'],
    he: {
      task: 'הצעת מחיר חכמה עם AI',
      steps: [
        'לוחצים "הצעה חדשה" ובוחרים "הצעת מחיר חכמה עם AI".',
        'מתארים את העבודה במילים, או מכתיבים בקול בלחיצה על המיקרופון בפינת השדה.',
        'ה-AI מציע שורות. בודקים, מתקנים ומאשרים לפני שמשהו נכנס להצעה. מחיר מוצע רק לפריט שקיים בקטלוג.',
      ],
    },
    en: {
      task: 'An AI smart quote',
      steps: [
        'Click "New quote" and choose "AI smart quote".',
        'Describe the job in words, or dictate it by clicking the microphone in the corner of the field.',
        'The AI suggests lines. Review, correct and approve before anything enters the quote. A price is suggested only for an item that is in your catalog.',
      ],
    },
    evidence: [
      { file: 'src/utils/newQuoteChoices.js', labels: ['הצעת מחיר חכמה עם AI', 'AI smart quote'] },
      { file: 'src/components/NewQuoteMenu.jsx', labels: ['הצעה חדשה', 'New quote'] },
    ],
  },
  {
    id: 'quote_attachment',
    capabilityIds: ['attachments'],
    he: {
      task: 'צירוף קובץ להצעה',
      steps: [
        'בעורך ההצעה, בשלב "בדיקה ושמירה", פותחים את "פרטים נוספים (לא חובה)".',
        'בקטע "קבצים מצורפים / שרטוטים" לוחצים על כפתור צירוף הקובץ ובוחרים את הקובץ.',
        'שומרים את ההצעה.',
      ],
    },
    en: {
      task: 'Attaching a file to a quote',
      steps: [
        'In the quote editor, in the "Review and save" step, open "More details (optional)".',
        'In the "Attachments" section click the attach-file button and choose the file.',
        'Save the quote.',
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ['פרטים נוספים (לא חובה)', 'More details (optional)', 'קבצים מצורפים / שרטוטים', 'Attachments', 'צירוף קובץ', 'Attach File', 'בדיקה ושמירה'] },
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
      task: 'הוספת פריט לקטלוג',
      steps: [
        'בתפריט הצד לוחצים על "קטלוג" ואז "הוספת פריט".',
        'ממלאים שם ומחיר ולוחצים "שמירה". הפריט יופיע בבחירה מהקטלוג בעורך ההצעה.',
      ],
    },
    en: {
      task: 'Adding a catalog item',
      steps: [
        'In the sidebar click "Catalog" and then "Add Item".',
        'Fill in a name and a price and click "Save". The item appears in the catalog picker of the quote editor.',
      ],
    },
    evidence: [
      { file: 'src/components/ServicesCatalog.jsx', labels: ['הוספת פריט', 'Add Item', 'שמירה', 'Save'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['קטלוג', 'Catalog'] },
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
      task: 'קביעת תוקף להצעה',
      steps: [
        'בעורך ההצעה, בשלב "בדיקה ושמירה", פותחים את "פרטים נוספים (לא חובה)".',
        'בשדה "בתוקף עד" בוחרים את התאריך האחרון שבו הלקוח יכול לחתום, ושומרים את ההצעה.',
        'אחרי התאריך הלקוח עדיין רואה את ההצעה, אבל אי אפשר לחתום עליה.',
      ],
    },
    en: {
      task: 'Setting how long a quote is valid',
      steps: [
        'In the quote editor, in the "Review and save" step, open "More details (optional)".',
        'In the "Valid Until" field choose the last date the client can sign, and save the quote.',
        'After that date the client still sees the quote but can no longer sign it.',
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ['בדיקה ושמירה', 'Review and save', 'פרטים נוספים (לא חובה)', 'More details (optional)', 'נושא, שם פרויקט, תוקף, קבצים, כתובת, תנאים והערות'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['בתוקף עד', 'Valid Until'] },
    ],
  },
  {
    id: 'quote_discount',
    capabilityIds: ['quote_create', 'quote_edit'],
    he: {
      task: 'מתן הנחה בהצעה',
      steps: [
        'בעורך ההצעה, בשלב "מחיר", ממלאים את השדה "הנחה על כל ההצעה (%)" - אחוז בין 0 ל-100.',
        'הסכום הכולל מתעדכן מיד. הנחה למוצר אחד בלבד נותנים דרך המחיר של אותה שורה.',
      ],
    },
    en: {
      task: 'Giving a discount in a quote',
      steps: [
        'In the quote editor, in the "Price" step, fill in "Discount on the whole quote (%)" - a percentage between 0 and 100.',
        'The total updates at once. A discount on a single item is given through that line\'s own price.',
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ['מחיר', 'Price', 'הנחה על כל ההצעה (%)', 'Discount on the whole quote (%)', 'הנחה יכולה להיות בין 0 ל־100.'] },
    ],
  },
  {
    id: 'quote_terms_deposit',
    capabilityIds: ['quote_create', 'business_settings'],
    he: {
      task: 'תנאי תשלום, מקדמה ואחריות בהצעה',
      steps: [
        'בעורך ההצעה, בשלב "בדיקה ושמירה", פותחים את "פרטים נוספים (לא חובה)" ומגיעים ל"תנאים ואחריות".',
        'לוחצים "התאמה להצעה זו" וכותבים את תנאי התשלום, למשל מקדמה ותשלומים, ואת האחריות. זה טקסט שהלקוח רואה בהצעה; המערכת אינה גובה את התשלום.',
        'כדי שהתנאים ייכנסו אוטומטית לכל הצעה חדשה: ב"הגדרות העסק" ממלאים "תנאים כלליים להצעות חדשות — ברירת מחדל" ולוחצים "שמירת הגדרות העסק".',
      ],
    },
    en: {
      task: 'Payment terms, a deposit and warranty in a quote',
      steps: [
        'In the quote editor, in the "Review and save" step, open "More details (optional)" and go to "Terms & Warranty".',
        'Click "Customize for this quote" and write the payment terms, for example a deposit or installments, and the warranty. It is text the client sees in the quote; TEKANGO does not collect the payment.',
        'To have the terms in every new quote: in "Business Settings" fill in "Default Terms & Conditions for New Quotes" and click "Save Business Settings".',
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ['בדיקה ושמירה', 'Review and save', 'פרטים נוספים (לא חובה)', 'More details (optional)', 'תנאים ואחריות', 'Terms & Warranty', 'התאמה להצעה זו', 'Customize for this quote'] },
      { file: 'src/components/SettingsTab.jsx', labels: ['תנאים כלליים להצעות חדשות — ברירת מחדל', 'Default Terms & Conditions for New Quotes', 'שמירת הגדרות העסק', 'Save Business Settings'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הגדרות העסק', 'Business Settings'] },
    ],
  },
  {
    id: 'quote_vat',
    capabilityIds: ['quote_create'],
    he: {
      task: 'מע״מ בהצעה',
      steps: [
        'בשלב "למי ההצעה?" בוחרים סוג לקוח: "עסקי (חברה/עוסק)" - המחירים שמזינים הם לפני מע״מ, או "פרטי (B2C)" - המחירים כוללים מע״מ.',
        'שיעור המע״מ מחושב אוטומטית (18% בישראל) ואינו הגדרה שמשנים. סיכום ההצעה מציג את המע״מ ואת הסכום הכולל.',
      ],
    },
    en: {
      task: 'VAT in a quote',
      steps: [
        'In the "Who is it for?" step choose the client type ("Business" or "Private").',
        'For an international business no VAT is added automatically, and the VAT rate is not a setting. The quote summary shows the total.',
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ['למי ההצעה?', 'Who is it for?', 'עסקי (חברה/עוסק)', 'פרטי (B2C)', 'Business', 'Private', 'סוג הלקוח קובע אם המחיר כולל מע״מ או לפני מע״מ.'] },
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
      task: 'סימון מצב הצעה (נשלחה, אושרה, שולמה)',
      steps: [
        'ברשימת "הצעות מחיר" לוחצים "פתיחה" ליד ההצעה ואז "עריכה".',
        'בשלב "בדיקה ושמירה", בשדה "מצב ההצעה", בוחרים "נשלחה", "אושרה" או "שולמה", ולוחצים "עדכון ההצעה בענן". המצב רק מסמן את ההצעה; הוא לא גובה תשלום.',
        'הצעה שאושרה או שהלקוח חתם עליה נעולה לעריכה ("לא ניתן לערוך הצעה חתומה"). כשהלקוח שילם, פותחים את ההצעה ברשימה, לוחצים "סימון כשולמה" ומאשרים. אחרי הסימון אי אפשר לחזור ל"אושרה", והצעה ששולמה נעולה לגמרי.',
      ],
    },
    en: {
      task: 'Marking a quote\'s status (Sent, Approved, Paid)',
      steps: [
        'In the "Quotes" list click "Open" next to the quote, then "Edit".',
        'In the "Review and save" step, in "Quote status", choose "Sent", "Approved" or "Paid" and click "Update Quote in Cloud". The status only marks the quote; it does not collect payment.',
        'A quote that is approved or signed by the client is locked for editing ("Cannot edit a signed quote"). When the client has paid, open the quote in the list, click "Mark as paid" and confirm. After marking it you cannot go back to "Approved", and a paid quote is fully locked.',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['פתיחה', 'Open', 'עריכה', 'Edit', 'לא ניתן לערוך הצעה חתומה', 'Cannot edit a signed quote', 'סימון כשולמה', 'Mark as paid'] },
      { file: 'src/components/QuoteForm.jsx', labels: ['בדיקה ושמירה', 'Review and save', 'מצב ההצעה', 'Quote status', 'נשלחה', 'Sent', 'אושרה', 'Approved', 'שולמה', 'Paid'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הצעות מחיר', 'Quotes', 'עדכון ההצעה בענן', 'Update Quote in Cloud'] },
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
        'אפשר לשלוח שוב: ברשימת "הצעות מחיר" לוחצים "פתיחה" ליד ההצעה ואז "שליחה במייל", או לשלוח ב"וואטסאפ" או ב"העתקת הודעה".',
      ],
    },
    en: {
      task: 'The client did not get the email',
      steps: [
        'Check in the quote that the client\'s email address is correct. A red dot next to the email means the address does not exist or the send failed.',
        'Ask the client to check the spam or junk folder too.',
        'You can send again: in the "Quotes" list click "Open" next to the quote, then "Email" - or send it by "WhatsApp" or "Copy message".',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['פתיחה', 'Open', 'שליחה במייל', 'Email', 'וואטסאפ', 'WhatsApp', 'העתקת הודעה', 'Copy message', 'כתובת המייל שאליה נשלחה ההצעה אינה קיימת', 'שליחת המייל נכשלה'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הצעות מחיר', 'Quotes'] },
    ],
  },
]);

/** The projection the AI facts carry: the task and the steps per language (evidence stays in the repository). */
export function projectHowTo(entry) {
  return { id: entry.id, capabilityIds: [...entry.capabilityIds], he: { task: entry.he.task, steps: [...entry.he.steps] }, en: { task: entry.en.task, steps: [...entry.en.steps] } };
}
