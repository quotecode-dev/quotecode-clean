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
        'בשדה "כתובת תמונת לוגו (URL) או העלאת קובץ" לוחצים "העלה קובץ" ובוחרים קובץ PNG, JPG או SVG עד 500KB.',
        'באותו מסך ממלאים את פרטי העסק, למשל "טלפון עסק" ו"ח.פ / עוסק מורשה".',
        'לוחצים "שמור הגדרות עסק".',
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
      { file: 'src/components/SettingsTab.jsx', labels: ['כתובת תמונת לוגו (URL) או העלאת קובץ', 'Logo Image URL or File Upload', 'העלה קובץ', 'Upload File', 'שמור הגדרות עסק', 'Save Business Settings', 'טלפון עסק', 'Business Phone', '500KB'] },
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
        'בשלב "מה העבודה או המוצר?" מוסיפים פריטים: כותבים תיאור, או בוחרים מהקטלוג ("בחר שירות מהקטלוג...").',
        'בשלב "מחיר" ממלאים כמות ומחיר.',
        'בשלב "בדיקה ושמירה" לוחצים "הפק ושמור בענן". כל הצעה חדשה נשמרת כטיוטה, ואחרי השמירה אפשר לשלוח אותה.',
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
      { file: 'src/pages/Dashboard.jsx', labels: ['הפק ושמור בענן', 'Generate & Save to Cloud', 'בחר שירות מהקטלוג...', 'Choose from catalog...'] },
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
        'בוחרים "שלח במייל", "וואטסאפ", או "העתקת הודעה" (מעתיק הודעה עם הקישור להצעה, להדבקה בכל מקום).',
        'הצעה בטיוטה מסומנת "נשלח" אוטומטית אחרי שליחה במייל או פתיחת וואטסאפ.',
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
      { file: 'src/components/QuotesTab.jsx', labels: ['פתיחה', 'Open', 'שלח במייל', 'Email', 'וואטסאפ', 'WhatsApp', 'העתקת הודעה', 'Copy message'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['הצעות מחיר', 'Quotes'] },
    ],
  },
  {
    id: 'quote_pdf',
    capabilityIds: ['quote_pdf', 'quote_print'],
    he: {
      task: 'הורדת הצעה כ-PDF',
      steps: [
        'ברשימת "הצעות מחיר" לוחצים "פתיחה" ליד ההצעה ואז "צפה", כדי לראות את ההצעה כמו שהלקוח רואה אותה.',
        'לוחצים "הורד כ-PDF". את הקובץ אפשר גם להדפיס.',
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
      { file: 'src/components/QuotesTab.jsx', labels: ['צפה', 'View'] },
      { file: 'src/pages/PublicQuote.jsx', labels: ['הורד כ-PDF'] },
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
      { file: 'src/components/QuoteForm.jsx', labels: ['פרטים נוספים (לא חובה)', 'More details (optional)', 'קבצים מצורפים / שרטוטים', 'Attachments', 'צרף קובץ', 'Attach File', 'בדיקה ושמירה'] },
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
        'בתפריט הצד לוחצים על "קטלוג" ואז "הוסף פריט".',
        'ממלאים שם ומחיר ולוחצים "שמור". הפריט יופיע בבחירה מהקטלוג בעורך ההצעה.',
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
      { file: 'src/components/ServicesCatalog.jsx', labels: ['הוסף פריט', 'Add Item', 'שמור', 'Save'] },
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
        'משימה שבוצעה מסמנים כהושלמה; היא עוברת ללשונית "הושלמו". משימות פתוחות בלשונית "פתוחות". אפשר גם למחוק משימה.',
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
        'מזינים את כתובת האימייל ולוחצים "שלח קישור לשחזור".',
        'בקישור שמגיע במייל מזינים "סיסמה חדשה" ולוחצים "עדכן סיסמה ושמור".',
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
      { file: 'src/components/AuthScreen.jsx', labels: ['שכחת סיסמה?', 'Forgot password?', 'שלח קישור לשחזור', 'Send Reset Link', 'סיסמה חדשה', 'New password', 'עדכן סיסמה ושמור', 'Update Password & Save'] },
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
]);

/** The projection the AI facts carry: the task and the steps per language (evidence stays in the repository). */
export function projectHowTo(entry) {
  return { id: entry.id, capabilityIds: [...entry.capabilityIds], he: { task: entry.he.task, steps: [...entry.he.steps] }, en: { task: entry.en.task, steps: [...entry.en.steps] } };
}
