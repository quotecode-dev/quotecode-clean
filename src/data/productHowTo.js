// Product "how do I ..." facts (Owner console 2026-10-20, typed: "מאשר שינוי ב-L-14: הוראות "איך עושים" מאומתות לעובדות המוצר ולעוזר
// המיילים"). The step-by-step answers the AI assistants (the chat and the support email assistant) may give for the common tasks.
//  - Every step quotes the REAL label the user sees. Each entry names the source files where those labels are rendered, and
//    productHowTo.test.js fails when a quoted label no longer exists in its file - an instruction can never silently go stale.
//  - Hand-maintained here, projected into supabase/functions/chat-ai/aiFacts.generated.ts by scripts/generate-ai-chat-facts.js.
//  - Only what the product does today. Nothing here changes a capability, a plan or a price.

export const PRODUCT_HOW_TO = Object.freeze([
  // ---- Owner console 2026-11-13 (typed: "כן מאשר את שלושת החלקים, כולל שינוי ב-L-12 וב-L-14"): the chat knowledge scan of 12/11
  // (docs/CHAT_KNOWLEDGE_SCAN_2026-11-12.md, sections א-ג) - each fact checked against the code ----
  {
    id: "clients_catalog_export",
    capabilityIds: ["clients","catalog","quote_csv","expense_csv"],
    he: {
      task: "ייצוא לאקסל של לקוחות, קטלוג, הצעות והוצאות",
      steps: [
        "במסך \"לקוחות\" לוחצים \"ייצוא לאקסל\" (ליד החיפוש). יורד קובץ אקסל עם הלקוחות שמוצגים: שם, סוג, מייל, טלפון, ח״פ, כתובת, הערות ותאריך יצירה.",
        "במסך הקטלוג לוחצים \"ייצוא לאקסל\" (ליד \"הוספת פריט\"). יורד קובץ עם שם הפריט, המחיר, איך מחשבים ותיאור.",
        "הצעות מייצאים באייקון ההורדה ליד הכותרת \"הצעות מחיר\" (\"ייצוא לאקסל (CSV)\"), והוצאות ב\"ייצוא CSV\" במסך \"פיננסים\".",
      ],
    },
    en: {
      task: "Exporting clients, the catalog, quotes and expenses to Excel",
      steps: [
        "In \"Clients\" click \"Export to Excel\" (beside the search). An Excel file with the clients shown downloads: name, type, email, phone, tax ID, address, notes and created date.",
        "In the catalog click \"Export to Excel\" (beside \"Add Item\"). The file has the item name, the price, how it is priced and the description.",
        "Quotes are exported with the download icon beside the \"Quotes\" title (\"Export CSV\"), and expenses with \"Export CSV\" in \"Finances\".",
      ],
    },
    evidence: [
      { file: "src/components/ClientsTab.jsx", labels: ["ייצוא לאקסל","Export to Excel"] },
      { file: "src/components/ServicesCatalog.jsx", labels: ["ייצוא לאקסל","הוספת פריט","Export to Excel","Add Item"] },
      { file: "src/components/QuotesTab.jsx", labels: ["ייצוא לאקסל (CSV)","Export CSV"] },
      { file: "src/components/FinancesTab.jsx", labels: ["ייצוא CSV","פיננסים","Export CSV","Finances"] },
      { file: "src/pages/Dashboard.jsx", labels: ["לקוחות","Clients"] },
    ],
  },
  {
    id: "accessibility_statement",
    capabilityIds: ["accessibility_tools"],
    he: {
      task: "נגישות והגדלת טקסט",
      steps: [
        "אין במערכת תפריט נגישות להגדלת טקסט או לשינוי ניגודיות. כדי להגדיל טקסט משתמשים בהגדלה של הדפדפן או של הטלפון.",
        "בתחתית המסך יש \"הצהרת נגישות\", ושם פרטי הפנייה בנושא נגישות.",
      ],
    },
    en: {
      task: "Accessibility and larger text",
      steps: [
        "There is no accessibility menu for text size or contrast. To make text larger use the zoom of the browser or the phone.",
        "At the bottom of the screen there is the \"Accessibility Statement\", with the contact details for accessibility.",
      ],
    },
    evidence: [
      { file: "src/pages/Dashboard.jsx", labels: ["הצהרת נגישות","Accessibility Statement"] },
    ],
  },
  {
    id: "signed_notice_email",
    capabilityIds: ["public_quote_sign"],
    he: {
      task: "הודעה כשהלקוח חותם",
      steps: [
        "כשלקוח חותם על הצעה, בעל העסק מקבל מייל אחד לכתובת שאיתה הוא נכנס לחשבון, בנושא שבו כתוב שהלקוח חתם על הצעה ומספרה, עם קישור להצעה החתומה. הלקוח עצמו לא מקבל מייל.",
      ],
    },
    en: {
      task: "A notice when the client signs",
      steps: [
        "When a client signs a quote, the business owner gets one email at the address used to sign in, saying that the client signed the quote and its number, with a link to the signed quote. The client gets no email.",
      ],
    },
    evidence: [
      { file: "supabase/functions/quote-signed-notice/lib.ts", labels: ["חתם על הצעה"] },
    ],
  },
  {
    id: "attachments_limits",
    capabilityIds: ["attachments"],
    he: {
      task: "צירוף קבצים להצעה - מסלול וגודל",
      steps: [
        "צירוף קבצים ללקוח הוא חלק מחכם פלוס. בעורך ההצעה, ב\"פרטים נוספים להצעה (לא חובה)\", בוחרים \"קבצים ותמונות\" ולוחצים על צירוף קובץ ללקוח (עד 3 מגה לקובץ). לכל העסק יש עד 30 מגה, והנפח שנשאר מופיע ב\"נפח פנוי להעלאת קבצים\".",
      ],
    },
    en: {
      task: "Attaching files to a quote - plan and size",
      steps: [
        "Attaching files for the client is part of SMART PACK. In the quote editor, in \"More quote details (optional)\", choose \"Files and images\" and click \"Attach file for client (max 3 MB)\". A business has up to 30 MB in total; what is left shows in \"Free space for attachments\".",
      ],
    },
    evidence: [
      { file: "src/components/QuoteForm.jsx", labels: ["פרטים נוספים להצעה (לא חובה)","צירוף קובץ ללקוח (עד ","נפח פנוי להעלאת קבצים","More quote details (optional)","Attach file for client (max 3 MB)","Free space for attachments"] },
    ],
  },
  {
    id: "price_change_after_send",
    capabilityIds: ["quote_edit","public_quote_view"],
    he: {
      task: "שיניתי מחיר אחרי השליחה - הלקוח יראה?",
      steps: [
        "כן. עד שהלקוח חותם, כל שינוי שנשמר מופיע בקישור שלו, בלי לרענן את הדף.",
        "אם הלקוח כבר התחיל לחתום, החתימה מתאפסת ומופיעה ההודעה \"ההצעה עודכנה. עברו על השינויים לפני החתימה.\", והוא חותם מחדש. אחרי חתימה ההצעה נעולה.",
      ],
    },
    en: {
      task: "I changed a price after sending - will the client see it?",
      steps: [
        "Yes. Until the client signs, every saved change shows on their link without a page refresh.",
        "If they had started signing, the signature is cleared and they see \"This quote was updated. Review the changes before signing.\" and sign again. After signing the quote is locked.",
      ],
    },
    evidence: [
      { file: "src/utils/quoteApprovalErrorClassification.js", labels: ["ההצעה עודכנה. עברו על השינויים לפני החתימה.","This quote was updated. Review the changes before signing."] },
    ],
  },
  {
    id: "expenses_record",
    capabilityIds: ["expenses"],
    he: {
      task: "רישום הוצאה והוצאה קבועה",
      steps: [
        "במסך \"פיננסים\" לוחצים \"הוספת הוצאה\", ממלאים \"תיאור\", \"קטגוריה\" ו\"סכום\" ולוחצים \"שמירה\".",
        "הוצאה שחוזרת כל חודש מסמנים ב\"הוצאה חודשית קבועה\". היא נספרת בכל חודש מהחודש שבו נרשמה.",
        "תאריך ההוצאה הוא תמיד היום. אי אפשר לבחור תאריך או לרשום הוצאה לחודש קודם.",
      ],
    },
    en: {
      task: "Recording an expense and a recurring expense",
      steps: [
        "In \"Finances\" click \"Add Expense\", fill in \"Description\", \"Category\" and \"Amount\" and click \"Save\".",
        "An expense that repeats every month is marked \"Recurring monthly\". It counts every month from the month it was entered.",
        "The expense date is always today. A date cannot be chosen, and an expense of a previous month cannot be recorded.",
      ],
    },
    evidence: [
      { file: "src/components/FinancesTab.jsx", labels: ["פיננסים","תיאור","קטגוריה","סכום","הוצאה חודשית קבועה","שמירה","Finances","Description","Category","Amount","Recurring monthly","Save"] },
      { file: "src/pages/Dashboard.jsx", labels: ["הוספת הוצאה","Add Expense"] },
    ],
  },
  {
    id: "install_app",
    capabilityIds: ["dashboard_overview"],
    he: {
      task: "התקנת האפליקציה במסך הבית",
      steps: [
        "בטלפון או בטאבלט, בתפריט \"עוד\" לוחצים \"התקנת האפליקציה\". אם הדפדפן מציע חלון התקנה משלו, הוא נפתח; אחרת נפתח חלון \"התקנת TEKANGO במסך הבית\" עם השלבים, ולוחצים \"הבנתי\".",
        "במחשב אין שורת התקנה, וכשהאתר כבר פתוח מהסמל במסך הבית השורה לא מופיעה.",
      ],
    },
    en: {
      task: "Installing the app on the home screen",
      steps: [
        "On a phone or tablet, open \"More\" and tap \"Install the app\". If the browser has its own install window it opens; otherwise the \"Install TEKANGO on your home screen\" window shows the steps - tap \"Got it\".",
        "A computer has no install row, and once the site runs from the home-screen icon the row is not shown.",
      ],
    },
    evidence: [
      { file: "src/pages/Dashboard.jsx", labels: ["עוד","התקנת האפליקציה","More","Install the app"] },
      { file: "src/components/InstallAppSheet.jsx", labels: ["התקנת TEKANGO במסך הבית","הבנתי","Install TEKANGO on your home screen","Got it"] },
    ],
  },
  {
    id: "rounding_discount",
    capabilityIds: ["quote_create"],
    he: {
      task: "הנחת עיגול בסיכום ההצעה",
      steps: [
        "בהצעה בשקלים, כשהסכום אחרי ההנחה יוצא לא בשקלים שלמים, הוא מעוגל כלפי מטה והאגורות עוברות להנחה.",
        "בלי הנחה באחוזים מופיעה בסיכום השורה \"הנחת עיגול\" (כשהעיגול הוא חצי שקל ומעלה). כשיש הנחה באחוזים, העיגול נכלל בשורת ההנחה. במטבעות אחרים אין עיגול.",
      ],
    },
    en: {
      task: "The rounding discount in the quote summary",
      steps: [
        "In a shekel quote, when the amount after discount is not a whole shekel, it is rounded down and the agorot go into the discount.",
        "With no percent discount the summary shows \"Rounding discount\" (when the rounding is half a shekel or more). With a percent discount the rounding is part of the discount row. Other currencies are not rounded.",
      ],
    },
    evidence: [
      { file: "src/components/QuoteForm.jsx", labels: ["הנחת עיגול","Rounding discount"] },
    ],
  },
  {
    id: "client_delete_blocked",
    capabilityIds: ["clients"],
    he: {
      task: "מחיקת לקוח, ולמה לפעמים אי אפשר",
      steps: [
        // Owner 2026-11-24 (typed: "מאשר סבב המשך לצ׳אט ... כולל שינוי ב-L-14 ו-L-17"; live re-run en-23): the click path first
        "בתפריט הצד לוחצים \"לקוחות\", פותחים את השורה של הלקוח ולוחצים \"מחיקה\".",
        "אי אפשר למחוק לקוח שיש לו הצעה כלשהי, גם טיוטה. מוחקים קודם את ההצעות שלו ואז את הלקוח.",
        "הצעה חתומה או מאושרת אי אפשר למחוק, ולכן לקוח עם הצעה כזו נשאר במערכת לצורכי תיעוד.",
      ],
    },
    en: {
      task: "Deleting a client, and when it is blocked",
      steps: [
        "In the side menu click \"Clients\", open the client's row and click \"Delete\".",
        "A client with any quote, drafts included, cannot be deleted. Delete their quotes first, then the client.",
        "A signed or approved quote cannot be deleted, so a client with such a quote stays in the system for the records.",
      ],
    },
    evidence: [
      { file: "src/components/ClientsTab.jsx", labels: ["לא ניתן למחוק לקוח עם הצעות מחיר חתומות או מאושרות", "מחיקה", "Delete"] },
    ],
  },
  {
    id: "finances_totals",
    capabilityIds: ["finance_views","expense_csv"],
    he: {
      task: "מה סופרים במסך הפיננסים",
      steps: [
        "\"סך הכנסות\" סופר רק הצעות שאושרו או ששולמו, לפי תאריך היצירה של ההצעה בתקופה שנבחרה, בנפרד לכל מטבע.",
        "\"רווח נקי\" מראה \"לא ניתן לחשב: ההכנסות בכמה מטבעות\" כשיש הכנסה במטבע שאינו מטבע החשבון: ההוצאות במטבע החשבון ואין המרה.",
        "\"ייצוא CSV\" במסך הזה מוריד רק את ההוצאות של התקופה.",
      ],
    },
    en: {
      task: "What the finances screen counts",
      steps: [
        "\"TOTAL REVENUE\" counts only approved or paid quotes, by the quote creation date in the selected period, one total per currency.",
        "\"NET PROFIT\" shows \"Not computable: revenue is in several currencies\" when there is revenue in a currency other than the account currency: expenses are in the account currency and nothing is converted.",
        "\"Export CSV\" on this screen downloads only the expenses of the period.",
      ],
    },
    evidence: [
      { file: "src/pages/Dashboard.jsx", labels: ["סך הכנסות","רווח נקי","TOTAL REVENUE","NET PROFIT"] },
      { file: "src/components/FinancesTab.jsx", labels: ["לא ניתן לחשב: ההכנסות בכמה מטבעות","ייצוא CSV","Not computable: revenue is in several currencies","Export CSV"] },
    ],
  },
  {
    id: "next_step_bar",
    capabilityIds: ["dashboard_overview","quote_history"],
    he: {
      task: "השורה מעל רשימת ההצעות - מה הצעד הבא",
      steps: [
        "מעל רשימת ההצעות מתחלפות כל 4 שניות, בסדר הזה: משימה באיחור, הצעה שהלקוח צפה בה 3 פעמים או יותר ולא חתם, והצעה שעוד לא נחתמה ותוקפה מסתיים היום או בתוך 3 ימים.",
        "כשאין אף אחד מאלה כתוב \"אין כרגע צעד דחוף.\".",
      ],
    },
    en: {
      task: "The line above the quote list - the next step",
      steps: [
        "Above the quote list, rotating every 4 seconds in this order: an overdue task, a quote the client viewed 3 times or more without signing, and an unsigned quote whose validity ends today or within 3 days.",
        "When there is none it says \"No urgent next step right now.\".",
      ],
    },
    evidence: [
      { file: "src/utils/nextStep.js", labels: ["אין כרגע צעד דחוף.","No urgent next step right now."] },
    ],
  },
  {
    id: "quote_states_list",
    capabilityIds: ["quote_status","quote_history"],
    he: {
      task: "מה אומר המצב של הצעה ברשימה",
      steps: [
        "\"טיוטה\" - עוד אין מחיר. \"טיוטה · מוכנה לשליחה\" - טיוטה שלמה שהלקוח עוד לא ראה.",
        "\"נשלחה · טרם נצפתה\", \"נשלחה · נצפתה\" ו\"נצפתה, ממתינה\" (נצפתה 3 פעמים או יותר ולא נחתמה).",
        "\"אושרה\", \"שולמה\", ו\"פג תוקף\" - תאריך התוקף עבר והיא לא אושרה.",
      ],
    },
    en: {
      task: "What the state of a quote in the list means",
      steps: [
        "\"Draft\" - nothing priced yet. \"Draft · ready to send\" - a complete draft the client has not seen.",
        "\"Sent · not viewed yet\", \"Sent · viewed\" and \"Viewed, awaiting\" (viewed 3 times or more, not signed).",
        "\"Approved\", \"Paid\", and \"Expired\" - the validity date passed and it was not approved.",
      ],
    },
    evidence: [
      { file: "src/utils/quoteStatusDisplay.js", labels: ["טיוטה","טיוטה · מוכנה לשליחה","נשלחה · טרם נצפתה","נשלחה · נצפתה","נצפתה, ממתינה","אושרה","שולמה","פג תוקף","Draft","Draft · ready to send","Sent · not viewed yet","Sent · viewed","Viewed, awaiting","Approved","Paid","Expired"] },
    ],
  },
  {
    id: "issue_quote",
    capabilityIds: ["quote_status"],
    he: {
      task: "מה עושה \"הנפקת ההצעה\"",
      steps: [
        "בהצעה שמורה שעוד לא הונפקה, בחלק \"הנפקת ההצעה\" לוחצים \"המשיכו להנפקה\" ומאשרים ב\"הנפיקו\".",
        "ההצעה מסומנת כנשלחה, והסגנון, המיתוג והתמונות שלה מוקפאים. לא נשלח מייל ולא נשלחת הודעה ללקוח; את הקישור משתפים אחר כך.",
      ],
    },
    en: {
      task: "What \"Issue the quote\" does",
      steps: [
        "On a saved quote that was not issued yet, in \"Issue the quote\" click \"Continue to issuing\" and confirm with \"Issue\".",
        "The quote is marked sent, and its style, branding and images are frozen. No email or message goes to the client; share the link afterwards.",
      ],
    },
    evidence: [
      { file: "src/components/quotePresentation/presentationCopy.js", labels: ["הנפקת ההצעה","המשיכו להנפקה","הנפיקו","Issue the quote","Continue to issuing","Issue"] },
    ],
  },
  {
    id: "missing_price_customer",
    capabilityIds: ["public_quote_view","public_quote_sign"],
    he: {
      task: "מה הלקוח רואה כשחסר מחיר",
      steps: [
        "שורה בלי מחיר מוצגת ללקוח \"טרם תומחר\", והסכום מסומן כחלקי.",
        "הלקוח לא יכול לחתום, להדפיס או להוריד PDF עד שכל המחירים מולאו.",
      ],
    },
    en: {
      task: "What the client sees when a price is missing",
      steps: [
        "A row without a price shows \"Not priced yet\" to the client, and the total is marked partial.",
        "The client cannot sign, print or download a PDF until every price is filled in.",
      ],
    },
    evidence: [
      { file: "src/pages/PublicQuote.jsx", labels: ["טרם תומחר"] },
      { file: "src/pages/PublicQuoteEn.jsx", labels: ["Not priced yet"] },
    ],
  },
  {
    id: "quote_from_file_limits",
    capabilityIds: ["smart_quote"],
    he: {
      task: "העלאת קובץ להצעה - מה מותר",
      steps: [
        "ב\"מעלים קובץ\" מעלים קובץ PDF או JPG אחד, עד 8 מגה, עד 5 עמודים ועד 30 שורות. זה חלק מחכם פלוס.",
        "החלון משווה בין הסכום במסמך לסכום שלכם, לפני מע״מ והנחות. הקובץ לא נשמר אצלנו; ספק הבינה שומר עותק לזמן מוגבל, לפי התנאים שלו.",
      ],
    },
    en: {
      task: "Making a quote from a file - what is allowed",
      steps: [
        "With \"Upload a file\" you upload one PDF or JPG, up to 8 MB, 5 pages and 30 lines. It is part of SMART PACK.",
        "The window compares the document total with yours, before VAT and discounts. The file is not kept by us; the AI provider keeps a copy for a limited time under its own terms.",
      ],
    },
    evidence: [
      { file: "src/utils/newQuoteChoices.js", labels: ["מעלים קובץ","Upload a file"] },
    ],
  },
  {
    id: "service_date",
    capabilityIds: ["quote_create"],
    he: {
      task: "תאריך ביצוע",
      steps: [
        "ב\"פרטים נוספים להצעה (לא חובה)\", ב\"פרויקט, כתובת ותוקף\", יש \"תאריך העבודה (לא חובה)\". הוא נפרד מתוקף ההצעה, לא מוצג ללקוח, ומופיע ביומן הפנימי (\"יומן\").",
      ],
    },
    en: {
      task: "The work date",
      steps: [
        "In \"More quote details (optional)\", in \"Project, address and validity\", there is \"Work date (optional)\". It is separate from the validity, is not shown to the client, and is listed in your internal \"Calendar\".",
      ],
    },
    evidence: [
      { file: "src/components/ServiceScheduleFields.jsx", labels: ["תאריך העבודה (לא חובה)","Work date (optional)"] },
      { file: "src/components/QuoteForm.jsx", labels: ["פרטים נוספים להצעה (לא חובה)","More quote details (optional)","פרויקט, כתובת ותוקף","Project, address and validity"] },
      { file: "src/pages/Dashboard.jsx", labels: ["יומן","Calendar"] },
    ],
  },
  {
    id: "after_free_plan",
    capabilityIds: ["plan_trial"],
    he: {
      task: "מה אפשר לעשות אחרי שמסלול החינם נגמר",
      steps: [
        "אפשר להמשיך לצפות בהצעות הקיימות, לשלוח שוב הצעות שכבר יצאו בלי שינוי, למחוק הצעות ולעבוד עם לקוחות, משימות והוצאות.",
        "הצעה חדשה, או הצעה ששונתה אחרי שנשלחה, דורשות מנוי.",
      ],
    },
    en: {
      task: "What you can do after the Free plan ends",
      steps: [
        "You can keep viewing existing quotes, re-send quotes that already went out unchanged, delete quotes and work with clients, tasks and expenses.",
        "A new quote, or a quote changed after it was sent, needs a subscription.",
      ],
    },
    evidence: [
      { file: "src/components/Free10UpgradeWindow.jsx", labels: ["הצעות"] },
    ],
  },
  {
    id: "signup_verify",
    capabilityIds: ["profile_prerequisites"],
    he: {
      task: "הרשמה, אימות מייל ובדיקת אבטחה",
      steps: [
        "אחרי ההרשמה נשלח מייל לאימות. התחברות לפני האימות מציגה את הכפתור \"שליחה חוזרת של מייל האימות\".",
        "בכל הרשמה, התחברות ואיפוס סיסמה מופיעה תיבת בדיקה של Cloudflare (\"אני לא רובוט\"). אם הבדיקה לא הושלמה, מחכים רגע, מסמנים את התיבה ומנסים שוב.",
      ],
    },
    en: {
      task: "Sign-up, email verification and the security check",
      steps: [
        "After sign-up a verification email is sent. Signing in before verifying shows the \"Resend the verification email\" button.",
        "Sign-up, sign-in and password reset always show a Cloudflare check box (\"I am not a robot\"). If the check did not complete, wait a moment, tick the box and try again.",
      ],
    },
    evidence: [
      { file: "src/components/AuthScreen.jsx", labels: ["שליחה חוזרת של מייל האימות","Resend the verification email"] },
      { file: "src/components/TurnstileWidget.jsx", labels: ["אני לא רובוט"] },
    ],
  },
  {
    id: "client_tax_id",
    capabilityIds: ["clients"],
    he: {
      task: "ח״פ של לקוח וחיפוש",
      steps: [
        "בכרטיס הלקוח יש שדה \"ח״פ / ת״ז\", והחיפוש במסך הלקוחות מוצא גם לפיו.",
      ],
    },
    en: {
      task: "A client tax ID and search",
      steps: [
        "The client card has a \"Tax ID\" field, and the client search also finds by it.",
      ],
    },
    evidence: [
      { file: "src/components/EditClientModal.jsx", labels: ["ח״פ / ת״ז","Tax ID"] },
    ],
  },
  {
    id: "editor_limits",
    capabilityIds: ["quote_create"],
    he: {
      task: "מגבלות בעורך ההצעה",
      steps: [
        "אפשר להוסיף עד 100 כותרות (דירות, קומות, חדרים או נושאים) בפעם אחת (\"אפשר להוסיף עד 100 בכל פעם\"), עד 4 רמות של כותרת בתוך כותרת.",
        "הצעות ישנות שבהן כותרת סומנה כמה עותקים זהים נשארות עם \"×\" ומספר; בהצעה חדשה כל עותק הוא כותרת נפרדת.",
      ],
    },
    en: {
      task: "Limits in the quote editor",
      steps: [
        "Up to 100 sections (apartments, floors, rooms or topics) can be added at once (\"You can add up to 100 at a time.\"), up to 4 levels of sections inside sections.",
        "Older quotes where a heading stood for several identical copies keep \"×\" and a number; in a new quote each copy is its own heading.",
      ],
    },
    evidence: [
      { file: "src/components/quoteTree/QuoteTreeEditor.jsx", labels: ["אפשר להוסיף עד 100 בכל פעם","You can add up to 100 at a time."] },
    ],
  },
  {
    id: "daily_tips",
    capabilityIds: ["dashboard_overview"],
    he: {
      task: "הטיפים היומיים",
      steps: [
        "אפשר לכבות את הטיפים בכפתור \"לא להציג טיפים\" (בדפדפן הזה). טיפ שנסגר נשמר בפעמון כנקרא למשך 30 יום. כרגע אין כפתור שמחזיר אותם.",
      ],
    },
    en: {
      task: "The daily tips",
      steps: [
        "Tips can be turned off with \"No more tips\" (in this browser). A closed tip stays read in the bell for 30 days. There is no button to turn them back on yet.",
      ],
    },
    evidence: [
      { file: "src/components/DailyTipCard.jsx", labels: ["לא להציג טיפים","No more tips"] },
    ],
  },
  {
    id: "business_settings_effects",
    capabilityIds: ["business_settings"],
    he: {
      task: "מה משנות הגדרות העסק",
      steps: [
        "עסק מחוץ לישראל בוחר \"מדינת העסק\": בעסק בארה״ב התאריך מוצג חודש קודם, בכל השאר יום קודם.",
        "השאלה \"מה סוג העיסוק המקצועי של העסק?\" קובעת את יחידת המחיר המוצעת בהוספת עבודה.",
        "ב\"אחריות להצעות חדשות — ברירת מחדל\" כותבים אחריות שתיכנס לכל הצעה חדשה.",
      ],
    },
    en: {
      task: "What the business settings change",
      steps: [
        "A business outside Israel chooses the \"Business country\": a US business shows dates month first, every other one day first.",
        "The question \"What kind of professional work does your business do?\" sets the price unit offered when adding work.",
        "In \"Default Warranty for New Quotes\" you write a warranty that goes into every new quote.",
      ],
    },
    evidence: [
      { file: "src/components/SettingsTab.jsx", labels: ["מדינת העסק","מה סוג העיסוק המקצועי של העסק?","אחריות להצעות חדשות — ברירת מחדל","Business country","What kind of professional work does your business do?","Default Warranty for New Quotes"] },
    ],
  },
  {
    id: "copy_message_marks_sent",
    capabilityIds: ["quote_email","owner_whatsapp_share"],
    he: {
      task: "העתקת ההודעה ללקוח",
      steps: [
        "ברשימת ההצעות \"העתקה\" מעתיק את ההודעה עם הקישור, כדי שתדביקו ותשלחו בעצמכם. טיוטה שמעתיקים לה הודעה מסומנת כנשלחה.",
      ],
    },
    en: {
      task: "Copying the message for the client",
      steps: [
        "In the quote list \"Copy\" copies the message with the link so you can paste and send it yourself. A draft whose message is copied is marked sent.",
      ],
    },
    evidence: [
      { file: "src/components/QuotesTab.jsx", labels: ["העתקה","Copy"] },
    ],
  },
  {
    id: "quote_style_settings",
    capabilityIds: ["business_settings","quote_pdf"],
    he: {
      task: "עיצוב ההצעה",
      steps: [
        "סגנון ההצעה נקבע בהגדרות העסק, ב\"עיצוב הצעות המחיר\", ולא בכל הצעה בנפרד. הצעה שכבר נשמרה עם סגנון משלה שומרת אותו.",
      ],
    },
    en: {
      task: "The quote design",
      steps: [
        "The quote style is set in the business settings, in \"Quote design\", not per quote. A quote already saved with its own style keeps it.",
      ],
    },
    evidence: [
      { file: "src/components/quotePresentation/presentationCopy.js", labels: ["עיצוב הצעות המחיר","Quote design"] },
    ],
  },
  {
    id: "phone_navigation",
    capabilityIds: ["dashboard_overview"],
    he: {
      task: "איפה המסכים בטלפון",
      steps: [
        "בטלפון השורה התחתונה היא \"הצעות מחיר\", \"לקוחות\", \"פיננסים\", \"חדש\" ו\"עוד\". ב\"עוד\" נמצאים הקטלוג, הסטטיסטיקה, המשימות, היומן, ההגדרות ו\"התקנת האפליקציה\".",
      ],
    },
    en: {
      task: "Where the screens are on a phone",
      steps: [
        "On a phone the bottom row is \"Quotes\", \"Clients\", \"Finances\", \"New\" and \"More\". \"More\" holds the catalog, statistics, tasks, calendar, settings and \"Install the app\".",
      ],
    },
    evidence: [
      { file: "src/pages/Dashboard.jsx", labels: ["הצעות מחיר","לקוחות","פיננסים","חדש","עוד","התקנת האפליקציה","Quotes","Clients","Finances","New","More","Install the app"] },
    ],
  },
  {
    id: "chat_limits",
    capabilityIds: ["ai_chat"],
    he: {
      task: "מגבלות הצ׳אט",
      steps: [
        "בלי חכם פלוס אפשר לשאול את העוזר עד 30 שאלות ביום, והמכסה מתחדשת למחרת. עם חכם פלוס, מד השימוש החודשי מחליף את המכסה היומית.",
        "הסבר של צילום מסך שמדביקים בצ׳אט, וקריאת הנתונים של החשבון, הם חלק מחכם פלוס.",
      ],
    },
    en: {
      task: "Chat limits",
      steps: [
        "Without SMART PACK you can ask the assistant up to 30 questions a day; it renews the next day. With SMART PACK the monthly usage meter replaces the daily limit.",
        "Explaining a pasted screenshot and reading your account data are part of SMART PACK.",
      ],
    },
    evidence: [
      { file: "supabase/functions/chat-ai/chatTools.ts", labels: ["30"] },
    ],
  },
  {
    id: 'business_logo_and_details',
    capabilityIds: ['business_settings', 'profile_prerequisites'],
    he: {
      task: 'הוספת לוגו ועדכון פרטי העסק',
      steps: [
        'בתפריט הצד לוחצים על "הגדרות העסק".',
        'בשדה "כתובת תמונת לוגו (URL) או העלאת קובץ" לוחצים "העלאת קובץ" ובוחרים קובץ PNG או JPG עד 500KB (במסמכים מונפקים קובץ SVG לא מתקבל).',
        'באותו מסך ממלאים את פרטי העסק, למשל "טלפון העסק" ו"ח.פ / עוסק מורשה".',
        'לוחצים "שמירת הגדרות העסק".',
      ],
    },
    en: {
      task: 'Adding a logo and updating the business details',
      steps: [
        'In the sidebar click "Business Settings".',
        'In the "Logo Image URL or File Upload" field click "Upload File" and choose a PNG or JPG file up to 500KB (issued documents do not accept an SVG file).',
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
        "בשלב \"למי מכינים את ההצעה?\" מקלידים את שם הלקוח בשדה \"הקלידו את שם הלקוח\" - לקוח שמור מופיע ברשימה מתחת לשדה תוך כדי הקלדה, ובחירה בו ממלאת את הפרטים שלו. ב\"סוג הלקוח\" בוחרים \"פרטי\" (ברירת המחדל) או \"עסקי\"; ללקוח עסקי בישראל נפתח מתחת גם \"מספר עוסק מורשה / חברה\" (חובה). טלפון, דוא״ל וכתובת נמצאים ב\"פרטי קשר (לא חובה)\". לוחצים \"שמירת הלקוח והמשך\" - לקוח חדש נשמר מיד ברשימת הלקוחות (כשבחרתם לקוח שמור, הכפתור הוא \"להמשך\"). בישראל שורת המע״מ מופיעה תמיד: ללקוח פרטי הסכומים כוללים מע״מ, וללקוח עסקי הם ללא מע״מ.",
        "במסך העבודה שורת ההקלדה נמצאת בתוך הטבלה, מתחת לשורות: בוחרים מוצר מהקטלוג או מקלידים שם (\"+ הוספת מוצר חדש\"), בוחרים \"חישוב\" - ליחידה, למ״ר, למטר, לשעה, ליום עבודה, לק״ג או מחיר גלובלי - כותבים כמות ומחיר ולוחצים \"הוספה\". מוצר חדש אפשר \"לשמור גם בקטלוג\". השורה נכנסת לטבלה, ושלוש הנקודות שלה פותחות עריכה, שכפול, הזזה למעלה או למטה והסרה. אין בחירת מבנה: כדי לחלק את ההצעה לקומות, דירות או חדרים לוחצים \"+ חלק: קומה, דירה, חדר\". מתחת לטבלה רואים תמיד את סכום הביניים, את המע״מ (בישראל) ואת הסה״כ.",
        "ב\"פרטים נוספים להצעה (לא חובה)\" יש: \"פרויקט, כתובת ותוקף\", \"הערות לכל ההצעה\", \"תנאים ואחריות\", \"הנחה\", \"קבצים ותמונות\" ו\"עיצוב והנפקת ההצעה\". כתובת הלקוח נמצאת בפרטי הלקוח, ב\"פרטי קשר (לא חובה)\".",
        "בפס שבתחתית רואים \"סה״כ לתשלום\"; לחיצה עליו פותחת את \"סיכום ההצעה\". שם גם \"כך הלקוח יראה\" ו\"שמירת ההצעה\". שמירה אינה שליחה: ההצעה נשמרת כטיוטה, ומופיע \"נשמרה. עדיין לא נשלחה.\" - משם אפשר לראות איך הלקוח יראה אותה, לחזור לעריכה או לעבור לרשימת ההצעות. המחשבון נמצא בכותרת העליונה, ליד הפעמון.",
      ],
    },
    en: {
      task: "Creating a quote (including the first one)",
      steps: [
        "Before the first quote a business phone is required in \"Business Settings\".",
        "Click \"New quote\". In the \"How would you like to start?\" window choose \"Fill it in yourselves\" (the other three ways have their own steps).",
        "In the \"Who is this quote for?\" step type the client name in the \"Type the client name\" field - a saved client appears in the list under the field as you type, and choosing it fills in its details. In \"Client type\" choose \"Private\" (the default) or \"Business\"; a business client may get a \"Business / company number\". Phone, email and address are in \"Contact details (optional)\". Click \"Save the client and continue\" - a new client is saved to your client list right away (when you chose a saved client, the button is \"Continue\").",
        "In the work screen the entry row is inside the table, below the rows: choose a catalog product or type a name (\"+ Add a new product\"), choose the \"Pricing\" - per unit, per sq ft, per ft, per hour, per work day, per kg or a lump sum - type the quantity and the price and click \"Add\". A new product can \"Also save to the catalog\". The row enters the table, and its three dots hold edit, duplicate, move up or down and remove. There is no structure choice: to divide the quote into floors, apartments or rooms click \"+ Section: floor, apartment, room\". Under the table the subtotal and the total are always shown.",
        "\"More quote details (optional)\" holds \"Project, address and validity\", \"Notes for the whole quote\", \"Terms and warranty\", \"Discount\", \"Files and images\" and \"Quote design and issuing\". The client address is in the client details, under \"Contact details (optional)\".",
        "The bar at the bottom shows the \"Total\"; a click on it opens the \"Quote summary\". It also has \"Client view\" and \"Save the quote\". Saving is not sending: the quote is saved as a draft and \"Saved. Not sent yet.\" appears - from there you can see how the client will see it, go back to editing or go to the quote list. The calculator is in the top header, next to the bell.",
      ],
    },
    evidence: [
      { file: 'src/components/NewQuoteMenu.jsx', labels: ["הצעה חדשה","New quote","איך תרצו להתחיל?","How would you like to start?"] },
      { file: 'src/utils/newQuoteChoices.js', labels: ["ממלאים בעצמכם","Fill it in yourselves"] },
      { file: 'src/components/QuoteForm.jsx', labels: ["למי מכינים את ההצעה?","Who is this quote for?","הקלידו את שם הלקוח","Type the client name","סוג הלקוח","Client type","פרטי","Private","עסקי","Business","מספר עוסק מורשה / חברה","Business / company number","פרטי קשר (לא חובה)","Contact details (optional)","שמירת הלקוח והמשך","Save the client and continue","פרטים נוספים להצעה (לא חובה)","More quote details (optional)","סיכום ההצעה","Quote summary","שמירת ההצעה","Save the quote"] },
      { file: 'src/components/quoteTree/QuoteTreeEditor.jsx', labels: ["+ חלק: קומה, דירה, חדר","+ Section: floor, apartment, room","+ הוספת מוצר חדש","+ Add a new product","חישוב","Pricing","הוספה","Add","לשמור גם בקטלוג","Also save to the catalog"] },
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
        "כדי לחלק את ההצעה לוחצים \"+ חלק: קומה, דירה, חדר\" (בהצעה שכבר יש בה חלקים: \"+ חלק חדש\" בסוף ההצעה). בשורה אחת בוחרים מה מוסיפים (קומה, דירה, חדר או נושא בשם אחר) וכמה (עד 100 בכל פעם), ולוחצים \"הוספה\". השמות נוצרים לבד (דירה 1, דירה 2), ושינוי שם - בלחיצה על השם. כל חלק הוא כותרת נפרדת עם העבודות שלו - גם כשהדירות זהות, כל דירה מופיעה בנפרד, ואפשר לשכפל חלק עם כל מה שבתוכו.",
        "שורת ההקלדה אחת: בחלק שעובדים עליו כתוב \"מה להוסיף?\" ושורת ההקלדה פתוחה, ובכותרת של כל חלק אחר יש \"+ עבודה\" שמעביר אליו את שורת ההקלדה. בסוף ההצעה \"+ עבודה כללית\" מוסיף עבודה שאינה בתוך חלק. חלק בתוך חלק אפשר תמיד, בכפתור \"+ חלק בתוך\" של החלק שעובדים עליו - חדרים בתוך דירה ודירות בתוך קומה, עד 4 רמות. ליד כל חלק מוצג הסכום של כל מה שבתוכו, והמשולש סוגר ופותח אותו.",
        "שלוש הנקודות של חלק פותחות: \"שינוי שם\" (במקום, עם \"שמירת השם\"), \"שכפול עם התוכן\", \"העתקת עבודות מהראשון\" (מהחלק הראשון באותה רמה), \"שמירה כתבנית\" ו\"הסרה עם התוכן\" - ואפשר לבטל. שורה עוברת לחלק אחר דרך שלוש הנקודות שלה (\"העברה לחלק אחר\"). בשלוש הנקודות של העורך, למעלה, נמצאים \"מתבנית שמורה\" ו\"ביטול החלוקה לחלקים\" - החלקים יורדים וכל העבודות נשארות בהצעה. הצעות ישנות שבהן דירה סומנה כמה עותקים זהים (× ומספר) נשארות כמו שהן.",
        "הלקוח רואה את הכותרות ואת הכותרות שבתוכן, עם חץ ליד כל כותרת שסוגר ופותח את הפירוט (חץ גדול לכותרת ראשית וקטן לכותרת שבתוכה), ובראש הרשימה \"תצוגת מסמך מלא\" ו\"תצוגת שורות סיכום\". בהדפסה ובקובץ בוחרים מסמך מלא או חלקי, ושם אין חיצים.",
      ],
    },
    en: {
      task: "A quote for several apartments, rooms or floors",
      steps: [
        "To divide the quote click \"+ Section: floor, apartment, room\" (in a quote that already has sections: \"+ New section\" at the end of the quote). In one line choose what you add (a floor, apartment, room or another topic) and how many (up to 100 at a time), and click \"Add\". The names are made for you (Apartment 1, Apartment 2); to rename, click the name. Each section is a separate heading with its own work - identical apartments are each shown separately too, and a section can be duplicated with everything inside it.",
        "There is one entry row: the section you work on shows \"What to add?\" with the entry row open, and every other section heading has \"+ Work\", which moves the entry row to it. At the end of the quote \"+ General work\" adds work that is not in a section. A section inside a section is always possible, with the \"+ Section inside\" button of the section you work on - rooms inside an apartment and apartments inside a floor, up to 4 levels. Each section shows the total of everything inside it, and its triangle closes and opens it.",
        "A section's three dots hold: \"Rename\" (in place, with \"Save the name\"), \"Duplicate with its content\", \"Copy the works from the first\" (from the first section at the same level), \"Save as a template\" and \"Remove with its content\" - and it can be undone. A row moves to another section through its own three dots (\"Move to another section\"). The editor's three dots at the top hold \"From a saved template\" and \"Remove the sections\" - the sections go and all the work stays in the quote. Older quotes where an apartment was marked as several identical copies (× and a number) stay as they are.",
        "The client sees the headings and the headings inside them, an arrow beside each heading that closes and opens its details (a big arrow for a main heading and a small one for a heading inside it), and \"Full document view\" and \"Summary rows view\" above the list. Printing and the file offer a full or a partial document, with no arrows.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["מתבנית שמורה","From a saved template","ביטול החלוקה לחלקים","Remove the sections"] },
      { file: 'src/components/quoteTree/QuoteTreeEditor.jsx', labels: ["+ חלק: קומה, דירה, חדר","+ Section: floor, apartment, room","+ חלק חדש","+ New section","הוספה","Add","מה להוסיף?","What to add?","+ עבודה","+ Work","+ עבודה כללית","+ General work","+ חלק בתוך","+ Section inside","שינוי שם","Rename","שמירת השם","Save the name","שכפול עם התוכן","Duplicate with its content","העתקת עבודות מהראשון","Copy the works from the first","שמירה כתבנית","Save as a template","הסרה עם התוכן","Remove with its content","העברה לחלק אחר","Move to another section"] },
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
        'לוחצים על השורה של ההצעה - היא נפתחת, ובה "צפייה", "עריכה", "שליחה" ושלוש נקודות.',
        'לוחצים "שליחה" ובוחרים "וואטסאפ", "שליחה במייל" או "העתקה" (מעתיק הודעה עם הקישור להצעה, להדבקה בכל מקום).',
        'הצעה בטיוטה מסומנת "נשלחה" אוטומטית אחרי שליחה במייל או פתיחת וואטסאפ.',
      ],
    },
    en: {
      task: 'Sending a quote to a client',
      steps: [
        'In the sidebar click "Quotes" and find the quote in the list.',
        'Click the quote\'s row - it opens with "View", "Edit", "Send" and three dots.',
        'Click "Send" and choose "WhatsApp", "Email" or "Copy" (copies a message with the quote link to paste anywhere).',
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
        'ברשימת "הצעות מחיר" לוחצים על השורה של ההצעה ואז "צפייה", כדי לראות אותה כמו שהלקוח רואה אותה.',
        'לוחצים "הורדה כ-PDF". את הקובץ אפשר גם להדפיס.',
      ],
    },
    en: {
      task: 'Downloading a quote as a PDF',
      steps: [
        'In the "Quotes" list click the quote\'s row and then "View" to see it the way the client sees it.',
        'Click "Get PDF". The file can also be printed.',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['צפייה', 'View'] },
      { file: 'src/pages/PublicQuote.jsx', labels: ['הורדה כ-PDF'] },
      { file: 'src/pages/PublicQuoteEn.jsx', labels: ['Get PDF'] },
    ],
  },
  {
    id: 'quote_templates',
    capabilityIds: ['quote_create'],
    he: {
      task: "שמירת הצעה כתבנית והתחלה מתבנית",
      steps: [
        "כדי לשמור את ההצעה כתבנית: במסך העבודה לוחצים על שלוש הנקודות של העורך, למעלה, ובוחרים \"שמירה כתבנית\" - גם לפני ששומרים את ההצעה עצמה. נותנים שם ובוחרים מה לשמור. נשמרים הנושא והפריטים, בלי פרטי הלקוח. שמירת ההצעה (\"שמירת ההצעה\" או \"עדכון ההצעה\") לא שואלת על תבנית.",
        "כדי להתחיל מתבנית: לוחצים \"הצעה חדשה\", בוחרים \"מתבנית שמורה\", ממלאים את הלקוח ולוחצים \"שמירת הלקוח והמשך\", ואז בוחרים את התבנית. סוג הלקוח שבחרתם לא משתנה; כשהמחירים בתבנית לפי בסיס מע״מ אחר, נשאלים אם להשתמש בהם.",
      ],
    },
    en: {
      task: "Saving a quote as a template and starting from a template",
      steps: [
        "To save the quote as a template: in the work screen click the editor's three dots at the top and choose \"Save as a template\" - even before the quote itself is saved. Give it a name and choose what to keep. The subject and the items are saved, without the customer details. Saving the quote (\"Save the quote\" or \"Update the quote\") does not ask about a template.",
        "To start from a template: click \"New quote\", choose \"From a saved template\", fill in the client and click \"Save the client and continue\", then pick the template. The client type you chose does not change.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["שמירה כתבנית","Save as a template","שמירת ההצעה","Save the quote","עדכון ההצעה","Update the quote","שמירת הלקוח והמשך","Save the client and continue"] },
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
        "לוחצים \"הצעה חדשה\", בוחרים \"מתארים ל-AI\", ממלאים את הלקוח ולוחצים \"שמירת הלקוח והמשך\".",
        "מתארים את העבודה במילים, או מכתיבים בקול בלחיצה על המיקרופון בפינת השדה. אפשר לתאר גם מבנה, למשל: שתי דירות זהות, בכל אחת ריצוף במטבח - וה-AI מציע את הדירות, מספר העותקים, העבודות והחדרים.",
        "ה-AI מציע שורות לבדיקה. בכל שורה יש \"המחיר שלכם\": הוא מתמלא רק לפריט מהקטלוג או כשכתבתם את המחיר, ואפשר לכתוב או לשנות אותו. הסבר מופיע רק כשיש מה לבדוק; מה שלא ברור מסומן ולא מנוחש, ואם לא כתוב אם הדירות זהות - הוא שואל. בודקים, מתקנים ומאשרים לפני שמשהו נכנס להצעה.",
      ],
    },
    en: {
      task: "An AI smart quote",
      steps: [
        "Click \"New quote\", choose \"Describe it to AI\", fill in the client and click \"Save the client and continue\".",
        "Describe the job in words, or dictate it by clicking the microphone in the corner of the field. You can describe a structure too, for example: two identical apartments, flooring in the kitchen of each - and the AI suggests the apartments, the number of copies, the work and the rooms.",
        "The AI suggests lines to check. Every line has \"Your price\": it is filled only for an item from your catalog or when you wrote the price, and you can type or change it. An explanation appears only when something needs checking; what is unclear is marked, never guessed, and when it is not written whether the apartments are identical, it asks. Review, correct and approve before anything enters the quote.",
      ],
    },
    evidence: [
      { file: 'src/utils/newQuoteChoices.js', labels: ["מתארים ל-AI","Describe it to AI"] },
      { file: 'src/components/NewQuoteMenu.jsx', labels: ["הצעה חדשה","New quote"] },
      { file: 'src/components/QuoteForm.jsx', labels: ["שמירת הלקוח והמשך","Save the client and continue"] },
      { file: 'src/components/AiQuoteDraftDialog.jsx', labels: ["המחיר שלכם","Your price","מחיר ליחידה","Unit price"] },
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
        "לוחצים \"הצעה חדשה\", בוחרים \"מעלים קובץ\" (הצעת מחיר מקובץ), ממלאים את הלקוח ולוחצים \"שמירת הלקוח והמשך\".",
        "לוחצים \"בחרו קובץ\" ובוחרים קובץ PDF או JPG אחד. הקריאה מתחילה מיד אחרי הבחירה.",
        "בכל שורה מוצגים \"מחיר במסמך\" ו\"המחיר שלכם\". ממלאים את המחיר שלכם ולוחצים \"הוספת השורות להצעה\". הקובץ לא נשמר.",
      ],
    },
    en: {
      task: "A quote from a file",
      steps: [
        "Click \"New quote\", choose \"Upload a file\" (Quote from a file), fill in the client and click \"Save the client and continue\".",
        "Click \"Choose a file\" and pick one PDF or JPG. Reading starts right after you pick it.",
        "Each line shows \"Price in the document\" and \"Your price\". Fill in your price and click \"Add the lines to the quote\". The file is not stored.",
      ],
    },
    evidence: [
      { file: 'src/utils/newQuoteChoices.js', labels: ["מעלים קובץ","Upload a file"] },
      { file: 'src/components/NewQuoteMenu.jsx', labels: ["הצעה חדשה","New quote"] },
      { file: 'src/components/QuoteForm.jsx', labels: ["שמירת הלקוח והמשך","Save the client and continue"] },
      { file: 'src/components/QuoteFromFileDialog.jsx', labels: ["בחרו קובץ","מחיר במסמך","המחיר שלכם","הוספת השורות להצעה","Choose a file","Price in the document","Your price","Add the lines to the quote"] },
    ],
  },
  // Owner console 2026-11-06 (typed approval incl. L-14): "עריכה חכמה" - edit an existing unsigned quote with the smart-quote AI, opened from the quote's row.
  {
    id: 'smart_edit_quote',
    capabilityIds: ['smart_quote', 'quote_edit'],
    he: {
      task: 'עריכה חכמה',
      steps: [
        'ברשימת "הצעות מחיר" מוצאים הצעה שעדיין לא נחתמה, לוחצים על השורה שלה, ובשלוש הנקודות בוחרים "עריכה חכמה".',
        'ההצעה נפתחת לעריכה וחלון ה-AI מכוון אליה. מתארים במילים, או מכתיבים בקול, מה להוסיף, לשנות או למחוק - שורות, כמויות, מחירים, הערות או הנחה.',
        'ה-AI מציע את השינויים בהצעה ואת השורות החדשות. בודקים, מסמנים את מה שמתאים ולוחצים "החלת השינויים בהצעה". מחיר משתנה רק כשכתבתם אותו בבקשה, ושום דבר לא נשמר עד ששומרים את ההצעה.',
        'אפשר גם לשנות כמות או מחיר של שורה ידנית, ישירות בשדות השורה בעורך ההצעה.',
        'הצעה שהלקוח כבר חתם עליה נעולה - הכפתור לא פעיל ("לא ניתן לערוך הצעה חתומה").',
      ],
    },
    en: {
      task: 'Smart edit',
      steps: [
        'In the "Quotes" list, find a quote that is not signed yet, click its row, and in the three dots choose "Smart edit".',
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
        "בעורך ההצעה לוחצים על שם הפריט בטבלה (או על שלוש הנקודות של השורה ובוחרים \"עריכה\"). הערכים שלו עוברים לשורת ההקלדה שמתחת לשורות: משנים את הכמות (מספר שלם או עשרוני, למשל 2.5) או את המחיר, \"סכום השורה\" מתעדכן מיד, ולוחצים \"הוספה\" - אותה שורה מתעדכנת במקומה (\"ניקוי השורה\" משאיר אותה כמו שהייתה). אחר כך שומרים את ההצעה.",
        "בפריט לפי שטח או אורך לוחצים \"מידות ופירוט נוסף\" שמתחת לשורת ההקלדה: \"השטח כבר ידוע\" / \"האורך כבר ידוע\" לכמות אחת, או \"לפי מידות\" עם אורך ורוחב, ו\"+ מידה נוספת\".",
        "מחיר נכתב עם נקודה עשרונית, למשל 1200.50. מחיר ריק מסומן \"טרם תומחר\" ולא נחשב 0. פירוט ללקוח כותבים ב\"פירוט לעבודה (לא חובה)\", באותו \"מידות ופירוט נוסף\".",
      ],
    },
    en: {
      task: 'Changing the quantity or the price of an item in a quote',
      steps: [
        "In the quote editor click the item's name in the table (or its three dots and \"Edit\"). Its values go into the entry row below the rows: change the quantity (a whole or decimal number, for example 2.5) or the price, the \"Line total\" updates at once, and click \"Add\" - the same row is updated in its place (\"Clear\" leaves it as it was). Then save the quote.",
        "For an item billed by area or length click \"Sizes and details\" under the entry row: \"The area is known\" / \"The length is known\" for one quantity, or \"By sizes\" with a length and a width, and \"+ Another size\".",
        "A price uses a decimal point, for example 1200.50. An empty price is marked \"Not priced yet\" and never counts as 0. Details for the customer go in \"Work details (optional)\", in the same \"Sizes and details\".",
      ],
    },
    evidence: [
      { file: 'src/components/quoteTree/QuoteTreeEditor.jsx', labels: ['מידות ופירוט נוסף', 'Sizes and details', 'השטח כבר ידוע', 'The area is known', 'האורך כבר ידוע', 'The length is known', 'לפי מידות', 'By sizes', '+ מידה נוספת', '+ Another size', 'פירוט לעבודה (לא חובה)', 'Work details (optional)', 'טרם תומחר', 'Not priced yet'] },
      { file: 'src/components/quoteTree/QuoteTreeEditor.jsx', labels: ['עריכה', 'Edit', 'הוספה', 'Add', 'ניקוי השורה', 'Clear', 'סכום השורה:', 'Line total:'] },
    ],
  },
  // Owner console 2026-11-08 (typed: "מאשר שינוי ב-L-14 לידע הצ'אט על יחידות זהות ומחיר משותף בשלב 3"): identical units + a shared price
  {
    id: 'quote_identical_units',
    capabilityIds: ['quote_create', 'quote_edit'],
    he: {
      task: "דירות זהות (או חדרים / קומות זהים) ומחיר משותף אחרי שכפול",
      steps: [
        "בהצעה חדשה כל דירה (או חדר / קומה) היא חלק נפרד, גם כשהדירות זהות. ממלאים אחד, ובשלוש הנקודות של החלק בוחרים \"שכפול עם התוכן\" - נוצר עותק עם כל מה שבתוכו, מיד אחריו, והשם שלו נפתח לשינוי (\"שמירת השם\"). לחלק ריק אפשר \"העתקת עבודות מהראשון\" - העבודות של החלק הראשון באותה רמה נוספות אליו.",
        "כל עותק נערך בנפרד: משנים, מוסיפים או מסירים בו שורות בלי לגעת בשאר. אחרי הסרה של שורה או חלק אפשר ללחוץ \"ביטול הפעולה האחרונה\".",
        "בשכפול המחירים של כל שורה והעותק שלה מקושרים. כשמשנים מחיר בשורה מקושרת נשאלים אם לעדכן גם את השורות המקושרות: \"רק כאן\", עדכון גם בהן, או \"ביטול\". אחרי עדכון אפשר ללחוץ \"ביטול עדכון המחירים\".",
        "בהצעות ישנות שבהן דירה סומנה כמה עותקים זהים מופיעים שם הדירה עם מספר העותקים (למשל דירה טיפוס א׳ × 12), הפירוט לעותק אחד והסכום של כל העותקים - בעורך, בהצעה ללקוח, בהדפסה ובקובץ. בהצעה חדשה אין × ומספר.",
      ],
    },
    en: {
      task: "Identical apartments (or rooms / floors) and a shared price after duplicating",
      steps: [
        "In a new quote every apartment (or room / floor) is a separate section, identical apartments too. Fill in one, and in the section's three dots choose \"Duplicate with its content\" - a copy with everything inside it appears right after it, and its name opens for a change (\"Save the name\"). An empty section can \"Copy the works from the first\" - the works of the first section at the same level are added to it.",
        "Each copy is edited on its own: change, add or remove its rows without touching the others. After removing a row or a section you can click \"Undo the last action\".",
        "When duplicating, the price of every row is linked to its copy. When you change the price of a linked row you are asked whether the linked rows take it too: \"Only here\", update them too, or \"Cancel\". After an update you can click \"Undo the price update\".",
        "Older quotes where an apartment was marked as several identical copies show the apartment name with its number of copies (for example Type A apartment × 12), the details for one copy and the total of all copies - in the editor, the client quote, the print and the file. A new quote has no × and number.",
      ],
    },
    evidence: [
      { file: 'src/components/quoteTree/QuoteTreeEditor.jsx', labels: ["שכפול עם התוכן","Duplicate with its content","שמירת השם","Save the name","העתקת עבודות מהראשון","Copy the works from the first","ביטול הפעולה האחרונה","Undo the last action"] },
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
        "בכפתור \"⋯\" שבכותרת של הדירה (או החדר / הקומה) בוחרים \"שמירה כתבנית\". נותנים שם ובוחרים אם לשמור מחירים ופרטים ללקוח. השורות, סוג החיוב והמידות נשמרים תמיד; פרטי לקוח, כתובת ושמות המקומות במידות לעולם לא נשמרים.",
        "כדי להוסיף חלק שמור להצעה פתוחה פותחים את שלוש הנקודות שבראש העורך ובוחרים \"מתבנית שמורה\", בוחרים את התבנית ולוחצים \"הוספה להצעה\". חלק אחד עם השורות שלו נוסף לסוף ההצעה.",
        "כשהמטבע או בסיס המע״מ של המחירים בתבנית שונים מההצעה, נשאלים לפני ההוספה אם להשתמש במחירים או להוסיף בלי מחירים.",
        "בחלון ההוספה מתבנית שמורה בתוך ההצעה מופיעות רק תבניות של מקום, ובחלון התבניות של הצעה חדשה מופיעות רק תבניות הצעה. בכל חלון מוחקים רק את התבניות שלו.",
      ],
    },
    en: {
      task: "A template for an apartment (or room / floor) - saving it and adding it to another quote",
      steps: [
        "In the \"⋯\" button in the header of the apartment (or room / floor) choose \"Save as a template\". Give it a name and choose whether to keep the prices and the details for the customer. The rows, the billing type and the sizes are always kept; customer details, the address and the place names of the sizes are never kept.",
        "To add a saved section to an open quote open the three dots at the top of the editor and choose \"From a saved template\", pick the template and click \"Add to the quote\". One section with its rows is added at the end of the quote.",
        "When the currency or the VAT basis of the template prices differs from the quote, you are asked before adding whether to use the prices or add without prices.",
        "The window for adding from a saved template inside a quote lists only place templates, and the template window of a new quote lists only quote templates. Each window deletes only its own templates.",
      ],
    },
    evidence: [
      { file: 'src/components/quoteTree/QuoteTreeEditor.jsx', labels: ["שמירה כתבנית","Save as a template"] },
      { file: 'src/components/QuoteForm.jsx', labels: ["מתבנית שמורה","From a saved template"] },
      { file: 'src/components/QuoteTemplateDialogs.jsx', labels: ["הוספה להצעה","Add to the quote","תבניות הצעה","Quote templates","תבניות יחידה","Unit templates"] },
    ],
  },
  {
    id: 'quote_attachment',
    capabilityIds: ['attachments'],
    he: {
      task: "צירוף קובץ להצעה",
      steps: [
        "בעורך ההצעה, מתחת לעבודות, לוחצים \"פרטים נוספים להצעה (לא חובה)\" ובוחרים \"קבצים ותמונות\".",
        "לוחצים על כפתור צירוף הקובץ, בוחרים את הקובץ, לוחצים \"שמירת הפרטים\" ואז \"שמירת ההצעה\".",
      ],
    },
    en: {
      task: "Attaching a file to a quote",
      steps: [
        "In the quote editor, under the works, click \"More quote details (optional)\" and choose \"Files and images\".",
        "Click the attach-file button, choose the file, click \"Save the details\" and then \"Save the quote\".",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטים נוספים להצעה (לא חובה)","More quote details (optional)","קבצים ותמונות","Files and images","צירוף קובץ","Attach file","שמירת הפרטים","Save the details","שמירת ההצעה","Save the quote"] },
    ],
  },
  {
    id: 'add_client',
    capabilityIds: ['clients'],
    he: {
      task: 'הוספת לקוח',
      steps: [
        'בתפריט הצד לוחצים על "לקוחות" ואז "לקוח חדש".',
        'ממלאים את הפרטים ושומרים. לקוח חדש נשמר גם בהצעה חדשה, כשלוחצים "שמירת הלקוח והמשך".',
      ],
    },
    en: {
      task: 'Adding a client',
      steps: [
        'In the sidebar click "Clients" and then "New Client".',
        'Fill in the details and save. A new client is also saved from a new quote, when you click "Save the client and continue".',
      ],
    },
    evidence: [
      { file: 'src/components/ClientsTab.jsx', labels: ['לקוח חדש', 'New Client'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['לקוחות', 'Clients'] },
      { file: 'src/components/QuoteForm.jsx', labels: ['שמירת הלקוח והמשך', 'Save the client and continue'] },
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
      // Owner 2026-11-24 (typed: "מאשר את שלב 4 בתוכנית הצ׳אט ... כולל שינוי ב-L-14 ו-L-17"; chat audit he-30): the phone path too
      steps: [
        'במחשב: לוחצים על גלגל השיניים ליד שם העסק בתחתית תפריט הצד ("הגדרות והתנתקות") ובוחרים "התנתקות".',
        'בטלפון: לוחצים "עוד" בסרגל התחתון ובוחרים "התנתקות".',
      ],
    },
    en: {
      task: 'Signing out',
      steps: [
        'On a computer: click the gear beside the business name at the bottom of the side menu ("Settings and sign out") and choose "Sign out".',
        'On a phone: tap "More" in the bottom bar and choose "Sign out".',
      ],
    },
    evidence: [
      { file: 'src/components/SidebarAccountMenu.jsx', labels: ['הגדרות והתנתקות', 'Settings and sign out', 'התנתקות', 'Sign out'] },
      { file: 'src/pages/Dashboard.jsx', labels: ['עוד', 'More', 'התנתקות', 'Sign out'] },
    ],
  },
  // Owner 2026-11-24 (typed: "מאשר את שלב 4 בתוכנית הצ׳אט: תיקון עשר הבעיות מהדוח, כולל שינוי ב-L-14 ו-L-17 ..."): steps the chat audit found
  // missing - the pricing method of a row, the leads tab, the list search and filters, and how the client signs
  {
    // Owner 2026-11-24 (typed: "מאשר סבב המשך לצ׳אט ... כולל שינוי ב-L-14 ו-L-17"; live re-run en-2): where the calculator is
    id: 'calculator_location',
    capabilityIds: ['editor_calculator'],
    he: {
      task: 'איפה המחשבון',
      steps: ['המחשבון נמצא בסרגל העליון של המסך, ליד הפעמון, בכל מסך - גם בתוך עורך ההצעה. לוחצים על אייקון "מחשבון".'],
    },
    en: {
      task: 'Where the calculator is',
      steps: ['The calculator is in the top bar of the screen, next to the bell, on every screen - in the quote editor too. Click the "Calculator" icon.'],
    },
    evidence: [
      { file: 'src/pages/Dashboard.jsx', labels: ['מחשבון', 'Calculator'] },
    ],
  },
  {
    id: 'pricing_unit',
    capabilityIds: ['measured_quote', 'quote_create'],
    he: {
      task: 'בחירת אופן החישוב של שורה (ליחידה, למ״ר, למטר, לשעה)',
      steps: [
        'בעורך ההצעה, בשורת ההוספה, בוחרים ב"חישוב" את אופן החישוב: "ליחידה", "למ״ר", "למטר", "לשעה", "ליום עבודה", "לק״ג" או "מחיר גלובלי".',
        'ממלאים כמות (או מידות ב"מידות ופירוט נוסף") ומחיר, ולוחצים "הוספה".',
      ],
    },
    en: {
      task: 'Choosing how a row is priced (per unit, per sq ft, per ft, per hour)',
      steps: [
        'In the quote editor, in the entry row, choose the method under "Pricing": "Per unit", "Per sq ft", "Per ft", "Per m²", "Per m", "Per hour", "Per work day", "Per kg" or "Lump sum".',
        'Fill in the quantity (or the sizes under "Sizes and details") and the price, then click "Add".',
      ],
    },
    enLocal: {
      task: 'Choosing how a row is priced (per unit, per m², per metre, per hour)',
      steps: [
        'In the quote editor, in the entry row, choose the method under "Pricing": "Per unit", "Per m²", "Per m", "Per hour", "Per work day", "Per kg" or "Lump sum".',
        'Fill in the quantity (or the sizes under "Sizes and details") and the price, then click "Add".',
      ],
    },
    heIntl: {
      task: 'בחירת אופן החישוב של שורה (ליחידה, לרגל רבועה, לרגל, לשעה)',
      steps: [
        'בעורך ההצעה, בשורת ההוספה, בוחרים ב"חישוב" את אופן החישוב: "ליחידה", "לרגל רבועה", "לרגל", "למ״ר", "למטר", "לשעה", "ליום עבודה", "לק״ג" או "מחיר גלובלי".',
        'ממלאים כמות (או מידות ב"מידות ופירוט נוסף") ומחיר, ולוחצים "הוספה".',
      ],
    },
    evidence: [
      { file: 'src/components/quoteTree/QuoteTreeEditor.jsx', labels: ['חישוב', 'ליחידה', 'למ״ר', 'למטר', 'לרגל רבועה', 'לרגל', 'לשעה', 'ליום עבודה', 'לק״ג', 'מחיר גלובלי', 'מידות ופירוט נוסף', 'הוספה', 'Pricing', 'Per unit', 'Per sq ft', 'Per ft', 'Per m²', 'Per m', 'Per hour', 'Per work day', 'Per kg', 'Lump sum', 'Sizes and details', 'Add'] },
    ],
  },
  {
    id: 'leads',
    capabilityIds: ['clients'],
    he: {
      task: 'רישום פנייה של לקוח שהתקשר או כתב (פניות)',
      steps: [
        'בתפריט הצד לוחצים "לקוחות", ובחלק העליון עוברים ללשונית "פניות".',
        'לוחצים "פנייה חדשה", ממלאים "שם", "טלפון" או "כתובת מייל", "מה צריך לבצע?" ו"מקור הפנייה", ולוחצים "שמירה".',
        'אם ממלאים "המעקב הבא", המעקב נוסף גם למשימות. מצב הפנייה: "חדשה", "בטיפול", "נשלחה הצעה" או "לא רלוונטית".',
      ],
    },
    en: {
      task: 'Logging an inquiry from a customer who called or wrote (Leads)',
      steps: [
        'In the side menu click "Clients", then switch to the "Leads" tab at the top.',
        'Click "New lead", fill in "Name", "Phone" or "Email address", "What work is needed?" and "Lead source", then click "Save".',
        'If you fill in "Next follow-up", the follow-up is also added to Tasks. A lead\'s status is "New", "In progress", "Quote sent" or "Not relevant".',
      ],
    },
    evidence: [
      { file: 'src/components/ClientsTab.jsx', labels: ['פניות', 'Leads', 'לקוחות', 'Clients'] },
      { file: 'src/components/leads/LeadsView.jsx', labels: ['פנייה חדשה', 'New lead', 'שם', 'Name', 'טלפון', 'Phone', 'כתובת מייל', 'Email address', 'מה צריך לבצע?', 'What work is needed?', 'מקור הפנייה', 'Lead source', 'המעקב הבא', 'Next follow-up', 'שמירה', 'Save', 'חדשה', 'בטיפול', 'נשלחה הצעה', 'לא רלוונטית', 'In progress', 'Quote sent', 'Not relevant'] },
    ],
  },
  {
    id: 'quote_list_search_filter',
    capabilityIds: ['quote_history', 'quote_expiry'],
    he: {
      task: 'חיפוש וסינון ברשימת ההצעות (למשל רק הצעות שפג תוקפן)',
      steps: [
        'ב"הצעות מחיר" מקלידים בשדה "חיפוש לפי שם לקוח או מספר הצעה…".',
        'לסינון לוחצים "סינון ומיון", בוחרים מצב (למשל "פג תוקף") ואת המיון, ולוחצים "הצגה".',
      ],
    },
    en: {
      task: 'Searching and filtering the quote list (for example only expired quotes)',
      steps: [
        'In "Quotes" type in the "Search client or quote #..." field.',
        'To filter, click "Filters", choose a status (for example "Expired") and the sort, then click "Show".',
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['חיפוש לפי שם לקוח או מספר הצעה…', 'Search client or quote #...', 'סינון ומיון', 'Filters', 'הצגה', 'Show'] },
      { file: 'src/utils/quoteStatusDisplay.js', labels: ['פג תוקף', 'Expired'] },
    ],
  },
  {
    id: 'client_signing_steps',
    capabilityIds: ['public_quote_sign', 'public_quote_view'],
    he: {
      task: 'איך הלקוח חותם על ההצעה',
      steps: [
        'הלקוח פותח את הקישור שקיבל בוואטסאפ או במייל, ורואה את ההצעה.',
        'ממלא "שם מלא לחתימה", לוחץ "לחצו כאן לחתימה", חותם באצבע או בעכבר ולוחץ "סיום הציור".',
        'לוחץ "אישור וחתימה על הצעת המחיר". ההצעה מסומנת אצלכם כמאושרת, ואתם מקבלים הודעה במייל.',
      ],
    },
    en: {
      task: 'How the client signs the quote',
      steps: [
        'The client opens the link they got by WhatsApp or email and sees the quote.',
        'They fill in "Signer\'s full name", click "Tap to sign", sign with a finger or the mouse and click "Done drawing".',
        'They click "Approve & Sign This Quote". The quote is marked approved for you, and you get an email notice.',
      ],
    },
    evidence: [
      { file: 'src/pages/PublicQuote.jsx', labels: ['שם מלא לחתימה', 'לחצו כאן לחתימה', 'סיום הציור', 'אישור וחתימה על הצעת המחיר'] },
      { file: 'src/pages/PublicQuoteEn.jsx', labels: ["Signer's full name", 'Tap to sign', 'Done drawing', 'Approve & Sign This Quote'] },
    ],
  },
  {
    id: 'signed_quote_locked',
    capabilityIds: ['quote_edit', 'public_quote_sign'],
    he: {
      task: 'למה אי אפשר לערוך הצעה חתומה',
      steps: ['הצעה שהלקוח חתם עליה נעולה: אי אפשר לערוך או למחוק אותה ("לא ניתן לערוך הצעה חתומה"). אפשר לשכפל אותה ("שכפול") וליצור ממנה הצעה חדשה.'],
    },
    en: {
      task: 'Why a signed quote cannot be edited',
      steps: ['A quote the client signed is locked: it cannot be edited or deleted ("Cannot edit a signed quote"). You can duplicate it ("Duplicate") and create a new quote from it.'],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ['לא ניתן לערוך הצעה חתומה', 'Cannot edit a signed quote', 'לא ניתן למחוק הצעה חתומה', 'שכפול', 'Duplicate'] },
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
        "בעורך ההצעה, מתחת לעבודות, לוחצים \"פרטים נוספים להצעה (לא חובה)\" ובוחרים \"פרויקט, כתובת ותוקף\".",
        "בשדה \"בתוקף עד\" כותבים את התאריך האחרון שבו הלקוח יכול לחתום, לוחצים \"שמירת הפרטים\" ואז \"שמירת ההצעה\".",
        "אחרי התאריך הלקוח עדיין רואה את ההצעה, אבל אי אפשר לחתום עליה.",
      ],
    },
    en: {
      task: "Setting how long a quote is valid",
      steps: [
        "In the quote editor, under the works, click \"More quote details (optional)\" and choose \"Project, address and validity\".",
        "In \"Valid until\" type the last date the client can sign, click \"Save the details\" and then \"Save the quote\".",
        "After that date the client still sees the quote but can no longer sign it.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטים נוספים להצעה (לא חובה)","More quote details (optional)","פרויקט, כתובת ותוקף","Project, address and validity","בתוקף עד","Valid until","שמירת הפרטים","Save the details","שמירת ההצעה","Save the quote"] },
    ],
  },
  {
    id: 'quote_discount',
    capabilityIds: ['quote_create', 'quote_edit'],
    he: {
      task: "מתן הנחה בהצעה",
      steps: [
        "בעורך ההצעה, מתחת לעבודות, לוחצים \"פרטים נוספים להצעה (לא חובה)\", בוחרים \"הנחה\" וממלאים \"הנחה באחוזים\" - אחוז בין 0 ל-100.",
        "הסכום ב\"סיכום ההצעה\" מתעדכן מיד. הנחה למוצר אחד בלבד נותנים דרך המחיר של אותה שורה.",
      ],
    },
    en: {
      task: "Giving a discount in a quote",
      steps: [
        "In the quote editor, under the works, click \"More quote details (optional)\", choose \"Discount\" and fill in \"Discount in percent\" - a percentage between 0 and 100.",
        "The total in the \"Quote summary\" updates at once. A discount on a single item is given through that line's own price.",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטים נוספים להצעה (לא חובה)","More quote details (optional)","סיכום ההצעה","Quote summary","הנחה","Discount","הנחה באחוזים","Discount in percent","הנחה צריכה להיות בין 0 ל־100 אחוז."] },
    ],
  },
  {
    id: 'quote_terms_deposit',
    capabilityIds: ['quote_create', 'business_settings'],
    he: {
      task: "תנאי תשלום, מקדמה ואחריות בהצעה",
      steps: [
        "בעורך ההצעה, מתחת לעבודות, לוחצים \"פרטים נוספים להצעה (לא חובה)\" ובוחרים \"תנאים ואחריות\".",
        "כותבים ב\"תנאי תשלום\" את התנאים, למשל מקדמה ותשלומים, וב\"אחריות\" את האחריות, ולוחצים \"שמירת הפרטים\". זה טקסט שהלקוח רואה בהצעה; המערכת אינה גובה את התשלום.",
        "כדי שהתנאים ייכנסו אוטומטית לכל הצעה חדשה: ב\"הגדרות העסק\" ממלאים \"תנאים כלליים להצעות חדשות — ברירת מחדל\" ולוחצים \"שמירת הגדרות העסק\".",
      ],
    },
    en: {
      task: "Payment terms, a deposit and warranty in a quote",
      steps: [
        "In the quote editor, under the works, click \"More quote details (optional)\" and choose \"Terms and warranty\".",
        "Write the terms in \"Payment terms\", for example a deposit or installments, and the warranty in \"Warranty\", and click \"Save the details\". It is text the client sees in the quote; TEKANGO does not collect the payment.",
        "To have the terms in every new quote: in \"Business Settings\" fill in \"Default Terms & Conditions for New Quotes\" and click \"Save Business Settings\".",
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטים נוספים להצעה (לא חובה)","More quote details (optional)","תנאים ואחריות","Terms and warranty","תנאי תשלום","Payment terms","אחריות","Warranty","שמירת הפרטים","Save the details"] },
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
        "בשלב \"למי מכינים את ההצעה?\" בוחרים ב\"סוג הלקוח\" \"פרטי\" (ברירת המחדל) או \"עסקי\". שורת המע״מ מופיעה תמיד, באותו מקום, בשלב הלקוח ובמסך העבודה: ללקוח פרטי - הסכומים כוללים מע״מ, והמע״מ לא יתווסף למחיר הסופי; ללקוח עסקי - הסכומים ללא מע״מ, והמע״מ יתווסף למחיר הסופי. המחיר בכל שורה פתוח לשינוי.",
        "שיעור המע״מ מחושב אוטומטית (18% בישראל) ואינו הגדרה שמשנים. מתחת לטבלה רואים תמיד את \"סכום ביניים\", את \"מע״מ (18%)\" (ללקוח פרטי: \"מע״מ (18%) · כלול\") ואת הסכום הכולל; גם \"סיכום ההצעה\" מציג אותם.",
      ],
    },
    en: {
      task: "VAT in a quote",
      steps: [
        "In the \"Who is this quote for?\" step choose the \"Client type\" (\"Private\", the default, or \"Business\").",
        "For an international business no VAT is added automatically, and the VAT rate is not a setting. The \"Quote summary\" shows the total.",
      ],
    },
    enLocal: {
      task: 'VAT in a quote',
      steps: [
        'In the "Who is this quote for?" step choose the "Client type": "Private" (the default) - the price includes VAT and no VAT is added to the total; or "Business" - amounts are before VAT and VAT is added to the final price. The VAT line is always shown, in the same place, in the client step and in the work screen.',
        "The VAT rate is calculated automatically (18% in Israel) and is not a setting. Under the table you always see the \"Subtotal\", the \"VAT (18%)\" (for a private client: \"VAT (18%) · included\") and the total; the \"Quote summary\" shows them too.",
      ],
    },
    heIntl: {
      task: 'מע״מ בהצעה',
      steps: [
        'בשלב "למי מכינים את ההצעה?" בוחרים "סוג הלקוח" ("פרטי", ברירת המחדל, או "עסקי").',
        'בעסק בינלאומי לא מתווסף מע״מ אוטומטית, ושיעור המע״מ אינו הגדרה. "סיכום ההצעה" מציג את הסכום הכולל.',
      ],
    },
    evidence: [
      { file: 'src/components/QuoteForm.jsx', labels: ["למי מכינים את ההצעה?","Who is this quote for?","סוג הלקוח","Client type","פרטי","עסקי","Private","Business","ללא מע״מ","כלול","included","סכום ביניים","Subtotal","סיכום ההצעה","Quote summary"] },
    ],
  },
  {
    id: 'quote_delete',
    capabilityIds: ['quote_history'],
    he: {
      task: 'מחיקת הצעה',
      steps: [
        'ברשימת "הצעות מחיר" לוחצים על השורה של ההצעה, ובשלוש הנקודות בוחרים "מחיקה" ומאשרים.',
        'הצעה שהלקוח כבר חתם עליה אי אפשר למחוק ("לא ניתן למחוק הצעה חתומה"). הצעה שנמחקה אינה חוזרת.',
      ],
    },
    en: {
      task: 'Deleting a quote',
      steps: [
        'In the "Quotes" list click the quote\'s row, choose "Delete" in its three dots, and confirm.',
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
    // an Israeli account in English / an international account in Hebrew (the market decides, never the screen language)
    enLocal: {
      task: 'The currency of your quotes',
      steps: ['In an Israeli account quotes are always in shekels (₪), and the currency cannot be changed.'],
    },
    heIntl: {
      task: 'מטבע ההצעות',
      steps: [
        'ב"הגדרות העסק" בוחרים את המטבע ב"מטבע העסק" (USD, EUR או GBP) ולוחצים "שמירת הגדרות העסק".',
        'הצעות חדשות משתמשות במטבע הזה. זה המטבע שמוצג בהצעה; TEKANGO לא גובה תשלומים.',
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
        'ברשימת "הצעות מחיר" לוחצים על השורה של ההצעה ובשלוש הנקודות בוחרים "שיפור ההצעה". בעורך ההצעה הוא נמצא בשלוש הנקודות שלמעלה.',
        'הכלי בודק את ההצעה מנקודת המבט של הלקוח ומציע מה לשנות כדי שתהיה ברורה ואטרקטיבית יותר. הבדיקה פנימית - הלקוח לא רואה אותה.',
        'שום דבר לא משתנה בהצעה בלי אישור שלכם: הצעה לתוספת נכנסת רק בלחיצה על "הוספה להצעה". ניתוח הבינה הוא חלק מחכם פלוס.',
      ],
    },
    en: {
      task: 'The "Improve quote" button',
      steps: [
        'In the "Quotes" list click the quote\'s row and choose "Improve quote" in its three dots. In the quote editor it is in the three dots at the top.',
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
        "ברשימת \"הצעות מחיר\" לוחצים על השורה של ההצעה ואז \"עריכה\".",
        "ב\"פרטים נוספים להצעה (לא חובה)\" בוחרים \"מצב ההצעה\", ושם בוחרים \"נשלחה\", \"אושרה\" או \"שולמה\", ולוחצים \"שמירת ההצעה\". המצב רק מסמן את ההצעה; הוא לא גובה תשלום.",
        "הצעה שאושרה או שהלקוח חתם עליה נעולה לעריכה (\"לא ניתן לערוך הצעה חתומה\"). כשהלקוח שילם, ברשימת ההצעות פותחים את תפריט ⋯ של השורה, לוחצים \"סימון כשולמה\" ומאשרים. אחרי הסימון אי אפשר לחזור ל\"אושרה\", והצעה ששולמה נעולה לגמרי.",
      ],
    },
    en: {
      task: "Marking a quote's status (Sent, Approved, Paid)",
      steps: [
        "In the \"Quotes\" list click the quote's row, then \"Edit\".",
        "In \"More quote details (optional)\", choose \"Quote status\", then choose \"Sent\", \"Approved\" or \"Paid\" and click \"Save the quote\". The status only marks the quote; it does not collect payment.",
        "A quote that is approved or signed by the client is locked for editing (\"Cannot edit a signed quote\"). When the client has paid, open the row's ⋯ menu in the quote list, click \"Mark as paid\" and confirm. After marking it you cannot go back to \"Approved\", and a paid quote is fully locked.",
      ],
    },
    evidence: [
      { file: 'src/components/QuotesTab.jsx', labels: ["פתיחה","Open","עריכה","Edit","לא ניתן לערוך הצעה חתומה","Cannot edit a signed quote","סימון כשולמה","Mark as paid"] },
      { file: 'src/components/QuoteForm.jsx', labels: ["פרטים נוספים להצעה (לא חובה)","More quote details (optional)","מצב ההצעה","Quote status","נשלחה","Sent","אושרה","Approved","שולמה","Paid","שמירת ההצעה","Save the quote"] },
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
        'אפשר לשלוח שוב: ברשימת "הצעות מחיר" לוחצים על השורה של ההצעה, "שליחה" ואז "שליחה במייל" - או שולחים ב"וואטסאפ" או ב"העתקה".',
      ],
    },
    en: {
      task: 'The client did not get the email',
      steps: [
        'Check in the quote that the client\'s email address is correct. A red dot next to the email means the address does not exist or the send failed.',
        'Ask the client to check the spam or junk folder too.',
        'You can send again: in the "Quotes" list click the quote\'s row, "Send", then "Email" - or send it by "WhatsApp" or "Copy".',
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
  const t = (x) => ({ task: x.task, steps: [...x.steps] });
  // 2026-11-13: a market-bound task may carry its Israeli steps in English (enLocal) and its international steps in Hebrew (heIntl)
  return { id: entry.id, capabilityIds: [...entry.capabilityIds], he: t(entry.he), en: t(entry.en), ...(entry.enLocal ? { enLocal: t(entry.enLocal) } : {}), ...(entry.heIntl ? { heIntl: t(entry.heIntl) } : {}) };
}
