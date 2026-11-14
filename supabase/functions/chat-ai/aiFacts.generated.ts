// GENERATED FILE - do not hand-edit.
// Regenerate with: node scripts/generate-ai-chat-facts.js
// Source of truth: supabase/functions/_shared/subscriptionContract.ts, src/domain/subscriptions/priceCatalog.js,
// src/data/productTruthRegistry.js, src/data/productHowTo.js, src/domain/subscriptions/addOnCatalog.js, src/shared/brand.js, src/utils/regionConfig.js.
// Staleness is enforced by supabase/functions/chat-ai/aiFacts.parity.test.js.
export const AI_FACTS = {
  "schemaVersion": 3,
  "supportEmail": {
    "he": "support@tekango.com",
    "en": "info@tekango.com"
  },
  "vatRate": {
    "il": 0.18,
    "international": 0
  },
  "subscriptions": {
    "source": "supabase/functions/_shared/subscriptionContract.ts + src/domain/subscriptions/packageCatalog.js + src/domain/subscriptions/priceCatalog.js",
    "priceCatalogVersion": "2026-10-07.1",
    "packageCatalogVersion": "2026-10-11.p2",
    "currentPaidPlanId": "all_inclusive",
    "legacyPaidPlanIds": [
      "classic",
      "modern",
      "visual"
    ],
    "stylesAreNotPlans": true,
    "planSystemActive": true,
    "purchaseOpenMarkets": [
      "IL",
      "INTERNATIONAL"
    ],
    "activationPhase": "enforced",
    "trialOffered": false,
    "accountStateSource": "get_account_summary",
    "plans": [
      {
        "id": "free",
        "he": "חינם",
        "en": "Free"
      },
      {
        "id": "all_inclusive",
        "he": "הכול כלול",
        "en": "All-inclusive"
      },
      {
        "id": "classic",
        "he": "קלאסיק",
        "en": "Classic"
      },
      {
        "id": "modern",
        "he": "מודרן",
        "en": "Modern"
      },
      {
        "id": "visual",
        "he": "ויזואל",
        "en": "Visual"
      }
    ],
    "free": {
      "quotesTotal": 10,
      "expires": true,
      "days": 7,
      "endsWhen": "first_of_quotes_or_days",
      "daysCountFrom": "signup_or_activation_day",
      "countedOnFirstSaveWithClientAndItem": true,
      "resaveConsumesAgain": false,
      "consumingChannels": [
        "send",
        "public_share",
        "final_pdf",
        "final_print"
      ],
      "draftsAndPreviewsConsume": false,
      "reuseConsumesAgain": false,
      "deleteRefunds": false,
      "existingDocumentsStayAccessible": true
    },
    "prices": {
      "IL": {
        "billingCurrency": "ILS",
        "package": {
          "id": "all_inclusive",
          "month": "30.00",
          "year": "306.00",
          "annualSaving": "54.00",
          "annualSavingPercentRounded": 15,
          "annualSavingPercentExact": true
        },
        "catalogBlock100": "5.00",
        "taxIncluded": true
      },
      "INTERNATIONAL": {
        "billingCurrency": "USD",
        "package": {
          "id": "all_inclusive",
          "month": "18.00",
          "year": "184.00",
          "annualSaving": "32.00",
          "annualSavingPercentRounded": 15,
          "annualSavingPercentExact": false
        },
        "catalogBlock100": "3.00",
        "localCurrencyDisplayIsEstimateOnly": true
      }
    },
    "catalog": {
      "includedProductsPerPaidPlan": 100,
      "blockProducts": 100,
      "blockRequiresExplicitPurchase": true,
      "catalogCapacityUnlocksStyleOrMedia": false
    },
    "notDecided": [
      "paid_plan_quote_limits",
      "capability_matrix",
      "free_catalog_limit",
      "storage",
      "cancellation_refund_proration",
      "tax_beyond_il_inclusion",
      "attachments"
    ]
  },
  "billing": {
    "liveCheckoutAvailable": false,
    "paymentProcessingAvailable": false,
    "acceptedPaymentCurrencies": [],
    "paymentMethodsKnown": false,
    "subscriptionCheckoutMarkets": [
      "IL",
      "INTERNATIONAL"
    ]
  },
  "invoicing": {
    "liveInvoicingAvailable": false,
    "invoiceIssuanceAvailable": false,
    "receiptIssuanceAvailable": false,
    "providerCandidate": "PayPlus",
    "providerStatus": "candidate_not_integrated"
  },
  "capabilities": [
    {
      "id": "dashboard_overview",
      "heLabel": "לוח בקרה",
      "enLabel": "Dashboard overview",
      "heDescription": "מסך הבית לאחר התחברות - סיכום הצעות מחיר, פעולות מהירות וניווט לשאר המערכת.",
      "enDescription": "The signed-in home screen - a summary of quotes, quick actions, and navigation to the rest of the app.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_dashboard",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_history",
      "heLabel": "היסטוריית הצעות מחיר",
      "enLabel": "Quote history",
      "heDescription": "רשימת כל הצעות המחיר שנוצרו, עם חיפוש, סינון ומצב.",
      "enDescription": "The list of every quote created, with search, filtering, and status.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_quote_history",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_create",
      "heLabel": "יצירת הצעת מחיר חדשה",
      "enLabel": "Create a new quote",
      "heDescription": "יצירת הצעת מחיר חדשה. טיוטה ותצוגה מקדימה אינן משתמשות באחת מ-10 ההצעות של מסלול חינם. תבניות: כששומרים הצעה חדשה בפעם הראשונה מופיעה השאלה „האם לשמור הצעה זאת כתבנית?” - נשמרים הנושא והפריטים, בלי פרטי הלקוח. הצעה שכבר נשמרה מתעדכנת ב„עדכון ההצעה”. כדי להתחיל הצעה מתבנית: בתפריט „הצעה חדשה” בוחרים „מתבנית שמורה” ומשם בוחרים את התבנית.",
      "enDescription": "Create a new quote. Drafts and previews do not use one of the 10 quotes of the Free plan. Templates: when a new quote is saved for the first time the question \"Save this quote as a template?\" appears - the subject and the items are saved, without the customer details. A quote saved before is updated with \"Update the quote\". To start a quote from a template: in the \"New quote\" menu choose \"From a saved template\" and pick the template there.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_new_quote",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": [
        "subscriptions.free.quotesTotal"
      ]
    },
    {
      "id": "quote_edit",
      "heLabel": "עריכת הצעה שמורה",
      "enLabel": "Edit a saved quote",
      "heDescription": "עריכת הצעת מחיר שכבר נשמרה.",
      "enDescription": "Edit a quote that has already been saved.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": "quote.edit_duplicate",
      "planEligibility": "not_decided",
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "subscription",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_selected_quote",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_duplicate",
      "heLabel": "שכפול הצעת מחיר",
      "enLabel": "Duplicate a quote",
      "heDescription": "שכפול הצעת מחיר קיימת כדי ליצור הצעה חדשה שמבוססת עליה.",
      "enDescription": "Duplicate an existing quote to start a new one from it.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": "quote.edit_duplicate",
      "planEligibility": "not_decided",
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "subscription",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_status",
      "heLabel": "מצב הצעת מחיר",
      "enLabel": "Quote status",
      "heDescription": "סימון/צפייה במצב הצעה (טיוטה/נשלחה/אושרה/שולמה): אפשר לבחור אותו ידנית, והצעה בטיוטה מסומנת „נשלחה” אוטומטית כששולחים אותה בוואטסאפ (כשוואטסאפ נפתח) או במייל (אחרי שליחה מוצלחת). המצב אינו גובה תשלום.",
      "enDescription": "Viewing/setting a quote's status (Draft/Sent/Approved/Paid): you can set it by hand, and a Draft is marked Sent automatically when you share it by WhatsApp (when WhatsApp opens) or by email (after a successful send). The status does not collect payment.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_PAID_STATUS_AS_PAYMENT_COLLECTION"
      ],
      "deterministicFactKeys": []
    },
    {
      "id": "smart_quote",
      "heLabel": "הצעת מחיר חכמה",
      "enLabel": "Smart Quote flow",
      "heDescription": "הצעת מחיר חכמה עם AI (בחלון „הצעה חדשה” ← „מתארים ל-AI”, אחרי שלב הלקוח): מתארים את העבודה במילים, וה-AI מציע שורות - תיאור, כמות ויחידה - וגם מבנה: קומות, דירות וחדרים - כל אחת ככותרת נפרדת, גם כשהן זהות, חדרים בתוך דירה ודירות בתוך קומה, וחדר לכל עבודה. מחיר רק כשהפריט קיים בקטלוג שלכם או כשכתבתם אותו, אחרת המחיר נשאר ריק להזנה; מה שלא ברור מסומן ולא מנוחש, ואם לא כתוב אם הדירות זהות - הוא שואל. בודקים, מתקנים ומאשרים לפני שמשהו נכנס להצעה; שום דבר לא נשמר או נשלח לבד. אפשר גם להכתיב את העבודה בקול (המיקרופון בפינת שדה התיאור) ולענות בקול על השאלות שהטיוטה שואלת. בחלון יש גם „מעלים קובץ” (הצעת מחיר מקובץ): מעלים קובץ PDF או JPG אחד של הצעה או רשימת עבודות, וה-AI קורא ממנו שורות, כמויות, יחידות ומחירים. בבדיקה מוצגים לכל שורה „מחיר במסמך” ו„המחיר שלכם”, ורק המחירים שלכם נכנסים להצעה. הקובץ לא נשמר ולא מצורף להצעה. חלק מחכם פלוס, ונספר במכסת השימוש של חכם פלוס לחודש (היתרה מוצגת באחוזים).",
      "enDescription": "AI smart quote (in the \"New quote\" window, \"Describe it to AI\", after the client step): describe the job in words and the AI suggests lines - description, quantity and unit - and a structure too: floors, apartments and rooms - each one a separate heading, identical ones too, rooms inside an apartment and apartments inside a floor, and a room for each work item. A price only when the item is in your catalog or you wrote it, otherwise the price stays empty for you to enter; what is unclear is marked, never guessed, and when it is not written whether the apartments are identical, it asks. You review, correct and approve before anything enters the quote; nothing is saved or sent on its own. You can also dictate the job by voice (the microphone in the corner of the description field) and answer the draft’s questions by voice. The window also has \"Upload a file\" (Quote from a file): upload one PDF or JPG of a quote or job list, and the AI reads its lines, quantities, units and prices. The review shows \"Price in the document\" and \"Your price\" on each line, and only your prices enter the quote. The file is not stored or attached to the quote. Part of SMART PACK, counted in its monthly usage allowance (shown as a percentage left).",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_ai_quote",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "measured_quote",
      "heLabel": "הצעת מחיר מקצועית/מדודה",
      "enLabel": "Measured professional quote",
      "heDescription": "מידות בהצעה (בעורך ההצעה, בטופס „מוסיפים עבודה או מוצר” ובשורות): לכל שורה בוחרים „חישוב” - ליחידה, למ״ר, למטר, לשעה, ליום עבודה, לק״ג או מחיר גלובלי. בשטח ובאורך כותבים כמות, או פותחים „מידות ופירוט נוסף” וכותבים אורך ורוחב (ואפשר „+ מידה נוספת”), והסכום מחושב מיד. בעריכת שורה המידות נכתבות במטר או בס״מ; בחשבון בינלאומי ברגל או באינץ׳, ומטר נשאר זמין - ואז המחיר לרגל רבועה / לרגל אורך, בלי המרה בין מטרים לרגל. אפשר לחלק את ההצעה (״לפי דירות״ או ״קומות, דירות וחדרים״): כל דירה, קומה, חדר או נושא היא כותרת עם העבודות שלה, ואפשר כותרת בתוך כותרת - חדר בתוך דירה, דירה בתוך קומה - לא חובה.",
      "enDescription": "Sizes in a quote (in the quote editor, in the \"Add work or a product\" form and in the rows): every row chooses its \"Pricing\" - per unit, per area, per length, per hour, per work day, per kg or a global price. For area and length type the quantity, or open \"Sizes and details\" and type the length and width (\"+ Another size\" adds one), and the total is calculated at once. When a row is edited the sizes are typed in m or cm; an international account measures in feet or inches, metres stay available, and prices per sq ft / linear ft - metres and feet are never converted into each other. The quote can be divided (\"By apartments\" or \"Floors, apartments, rooms\"): every apartment, floor, room or topic is a heading with its own work, and a heading can sit inside a heading - a room inside an apartment, an apartment inside a floor - optional.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": "professional_quote.use",
      "planEligibility": "not_decided",
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "subscription",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "professional_reuse",
      "heLabel": "שימוש חוזר מקצועי בפריטים",
      "enLabel": "Advanced professional item reuse",
      "heDescription": "שימוש חוזר מתקדם בפריטים מקצועיים בין הצעות מחיר.",
      "enDescription": "Advanced reuse of professional items across quotes.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": "professional_quote.reuse",
      "planEligibility": "not_decided",
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "subscription",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "clients",
      "heLabel": "ניהול לקוחות",
      "enLabel": "Client management",
      "heDescription": "הוספת לקוחות, עריכת הפרטים שלהם וצפייה בהם.",
      "enDescription": "Adding, editing, and viewing clients.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_clients",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "catalog",
      "heLabel": "קטלוג שירותים",
      "enLabel": "Services catalog",
      "heDescription": "ניהול קטלוג פריטים/שירותים לשימוש חוזר בהצעות מחיר. אפשר לצרף לפריט תמונה (כפתור התמונה בשורת הפריט); פריט עם תמונה מציג אותה כתמונה קטנה ליד השם, והיא מצטרפת לשורה בהצעה כשמוסיפים אותו.",
      "enDescription": "Managing a catalog of items/services for reuse across quotes. An item can have an image (the image button in its row); an item with an image shows it as a small thumbnail beside its name, and it joins the quote line when the item is added.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_catalog",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "finance_views",
      "heLabel": "תצוגות פיננסיות",
      "enLabel": "Finance views",
      "heDescription": "צפייה בסיכומי הכנסות/הוצאות ומדדים פיננסיים.",
      "enDescription": "Viewing income/expense summaries and financial KPIs.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_finances",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "expenses",
      "heLabel": "ניהול הוצאות",
      "enLabel": "Expense management",
      "heDescription": "הוספה ועריכה של הוצאות עסקיות.",
      "enDescription": "Adding and editing business expenses.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_csv",
      "heLabel": "ייצוא הצעות ל-CSV",
      "enLabel": "Quote CSV export",
      "heDescription": "ייצוא רשימת הצעות המחיר לקובץ CSV.",
      "enDescription": "Exporting the quote list to a CSV file.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "expense_csv",
      "heLabel": "ייצוא הוצאות ל-CSV",
      "enLabel": "Expense CSV export",
      "heDescription": "ייצוא רשימת ההוצאות לקובץ CSV.",
      "enDescription": "Exporting the expense list to a CSV file.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "editor_calculator",
      "heLabel": "מחשבון בעורך ההצעה",
      "enLabel": "In-editor calculator",
      "heDescription": "מחשבון עם ארבע פעולות חשבון, שורש, אחוזים, שינוי סימן, זיכרון והמרת מטבע, פתוח מתוך עורך ההצעה.",
      "enDescription": "A calculator with arithmetic, square root, percent, sign change, memory, and currency conversion, opened from the quote editor.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": {
        "role": "conversion_only",
        "values": [
          "USD",
          "EUR",
          "GBP",
          "ILS"
        ]
      },
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP",
        "NO_CONVERSION_CURRENCY_AS_PAYMENT_CURRENCY"
      ],
      "deterministicFactKeys": []
    },
    {
      "id": "editor_currency_converter",
      "heLabel": "המרת מטבע בעורך ההצעה",
      "enLabel": "In-editor currency converter",
      "heDescription": "המרת מטבע בין USD/EUR/GBP (ו-ILS בהצעות מקומיות) בתוך מחשבון העורך.",
      "enDescription": "Currency conversion between USD/EUR/GBP (plus ILS for Local quotes) inside the editor calculator.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": {
        "role": "conversion_only",
        "values": [
          "USD",
          "EUR",
          "GBP",
          "ILS"
        ]
      },
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP",
        "NO_CONVERSION_CURRENCY_AS_PAYMENT_CURRENCY"
      ],
      "deterministicFactKeys": []
    },
    {
      "id": "public_currency_converter",
      "heLabel": "ממיר מטבעות ציבורי",
      "enLabel": "Public currency converter",
      "heDescription": "כלי ציבורי (ללא התחברות) להמרת מטבעות, בעמוד הכלים הציבוריים.",
      "enDescription": "A public (no login) currency-conversion tool on the public tools page.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": {
        "role": "conversion_only",
        "values": [
          "ILS",
          "USD",
          "EUR",
          "GBP",
          "and other live-fetched currencies"
        ]
      },
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_CONVERSION_CURRENCY_AS_QUOTE_OR_SUBSCRIPTION_CURRENCY"
      ],
      "deterministicFactKeys": []
    },
    {
      "id": "public_unit_converter",
      "heLabel": "ממיר יחידות ציבורי",
      "enLabel": "Public unit converter",
      "heDescription": "כלי ציבורי להמרת יחידות מידה (אורך, שטח, משקל ועוד).",
      "enDescription": "A public unit-of-measure converter (length, area, weight, and more).",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "public_metals_calculator",
      "heLabel": "מחשבון מתכות ציבורי",
      "enLabel": "Public metals calculator",
      "heDescription": "הערכת שווי של מתכות יקרות (זהב, כסף, פלטינה, פלדיום ורודיום): מחירי ייחוס קבועים מוכפלים בשער דולר–שקל עדכני. מחירי המתכות עצמם אינם מתעדכנים בזמן אמת.",
      "enDescription": "An estimate of precious-metals value (gold/silver/platinum/palladium/rhodium) - fixed per-gram assumptions multiplied by a live USD/ILS rate, not an independent live metals feed.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": {
        "role": "conversion_only",
        "values": [
          "ILS"
        ]
      },
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_LIVE_METALS_FEED_CLAIM"
      ],
      "deterministicFactKeys": [
        "metalsAreEstimateNotLiveFeed"
      ]
    },
    {
      "id": "public_crypto_calculator",
      "heLabel": "מחשבון קריפטו ציבורי",
      "enLabel": "Public crypto calculator",
      "heDescription": "המרת מטבעות קריפטו (ביטקוין, את׳ריום ועוד) לפי שערים חיים מ-CoinGecko.",
      "enDescription": "Cryptocurrency conversion (Bitcoin, Ethereum, and more) using live rates from CoinGecko.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": {
        "role": "conversion_only",
        "values": [
          "USD"
        ]
      },
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "business_settings",
      "heLabel": "הגדרות עסק",
      "enLabel": "Business settings",
      "heDescription": "עריכת פרטי העסק (שם, טלפון, ח.פ./עוסק, לוגו והגדרות נוספות).",
      "enDescription": "Editing business details (name, phone, tax/business ID, logo, and other settings).",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_business_settings",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "profile_prerequisites",
      "heLabel": "דרישות פרופיל עסקי",
      "enLabel": "Business profile prerequisites",
      "heDescription": "לפני יצירת ההצעה הראשונה נדרש טלפון עסקי, ובשוק המקומי נדרש גם מספר ח״פ או עוסק.",
      "enDescription": "A business phone (and, in the Local market, a tax/business ID) are required before the first quote can be created.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_business_phone",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "plan_trial",
      "heLabel": "מסלולים ו-10 הצעות חינם",
      "enLabel": "Plans and Free quotes",
      "heDescription": "מסלול החינם כולל 10 הצעות בסך הכול או 7 ימים מההרשמה, המוקדם מביניהם. בשבעת הימים כלול גם חכם פלוס. לאחר מכן יש מסלול אחד שכולל את כל היכולות הזמינות, בתשלום חודשי או שנתי: 30.00 ₪ לחודש או 306.00 ₪ לשנה, כולל מע״מ. את המנוי רוכשים בחלון המסלולים.",
      "enDescription": "The Free plan includes 10 quotes in total or 7 days from sign-up, whichever ends first, with SMART PACK included during those 7 days. After them there is one package with every available capability, billed monthly or annually: 18.00 USD per month or 184.00 USD per year, charged in USD. The package is bought in the plans window.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_plan_information",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": [
        "subscriptions.free.quotesTotal",
        "subscriptions.planSystemActive"
      ]
    },
    {
      "id": "attachments",
      "heLabel": "צירוף קבצים",
      "enLabel": "File attachments",
      "heDescription": "צירוף קבצים ושרטוטים להצעת מחיר: עד 3 מגה לקובץ ועד 30 מגה לכל העסק.",
      "enDescription": "Attaching files and drawings to a quote: up to 3 MB per file and 30 MB per business.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": "quote_attachment.upload",
      "planEligibility": "not_decided",
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "subscription",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_pdf",
      "heLabel": "PDF של הצעת מחיר",
      "enLabel": "Quote PDF export",
      "heDescription": "ייצוא הצעת מחיר כקובץ PDF - מסמך הצעה, לא חשבונית.",
      "enDescription": "Exporting a quote as a PDF file - a quote document, not an invoice.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_INVOICE_CONFLATION"
      ],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_print",
      "heLabel": "הדפסת הצעת מחיר",
      "enLabel": "Quote print",
      "heDescription": "הדפסה ישירה של הצעת מחיר.",
      "enDescription": "Printing a quote directly.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_INVOICE_CONFLATION"
      ],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_email",
      "heLabel": "שליחת הצעה במייל",
      "enLabel": "Emailing a quote",
      "heDescription": "שליחת הצעת מחיר ללקוח במייל - שולחת את ההצעה, אינה מבצעת חיוב.",
      "enDescription": "Sending a quote to a client by email - sends the quote, does not bill or invoice.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_INVOICE_CONFLATION",
        "NO_PAYMENT_COLLECTION_CLAIM"
      ],
      "deterministicFactKeys": []
    },
    {
      "id": "owner_whatsapp_share",
      "heLabel": "שיתוף הצעה ב-WhatsApp (בעל העסק)",
      "enLabel": "Owner WhatsApp share",
      "heDescription": "שיתוף הצעת מחיר ב-WhatsApp על ידי בעל העסק - שונה מפעולת יצירת הקשר של הצד המקבל בהצעה הציבורית.",
      "enDescription": "The business owner sharing a quote via WhatsApp - a different capability from the recipient's WhatsApp contact action on the public quote.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": "quote.whatsapp_delete",
      "planEligibility": "not_decided",
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "subscription",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_OWNER_PUBLIC_WHATSAPP_CONFLATION"
      ],
      "deterministicFactKeys": [
        "quoteDeletionSharesThisEntitlement"
      ]
    },
    {
      "id": "public_whatsapp_contact",
      "heLabel": "יצירת קשר ב-WhatsApp (צד מקבל)",
      "enLabel": "Public quote WhatsApp contact",
      "heDescription": "כפתור יצירת קשר ב-WhatsApp עבור מקבל ההצעה בעמוד ההצעה הציבורי - שונה משיתוף ההצעה של בעל העסק.",
      "enDescription": "A WhatsApp contact button for the quote recipient on the public quote page - a different capability from the owner's quote share.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_OWNER_PUBLIC_WHATSAPP_CONFLATION"
      ],
      "deterministicFactKeys": []
    },
    {
      "id": "public_call",
      "heLabel": "התקשרות מעמוד ההצעה",
      "enLabel": "Public quote call action",
      "heDescription": "כפתור התקשרות טלפונית עבור מקבל ההצעה בעמוד ההצעה הציבורי.",
      "enDescription": "A call button for the quote recipient on the public quote page.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "public_quote_view",
      "heLabel": "צפייה בהצעה ציבורית",
      "enLabel": "Public quote viewing",
      "heDescription": "צפייה בהצעת מחיר על ידי הלקוח, ללא צורך בהתחברות, דרך קישור ייחודי.",
      "enDescription": "Viewing a quote as the client, no login required, via a unique link.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "public_quote_sign",
      "heLabel": "חתימה על הצעה ציבורית",
      "enLabel": "Public quote signing",
      "heDescription": "אישור/חתימה על הצעת מחיר על ידי הלקוח, בכפוף לתוקף ההצעה ולזהות המאשר.",
      "enDescription": "Approving/signing a quote as the client, subject to the quote's validity and the approver's identity.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_expiry",
      "heLabel": "תפוגת הצעת מחיר",
      "enLabel": "Quote expiry",
      "heDescription": "אפשר לצפות בהצעה שפג תוקפה, אבל אי אפשר לחתום עליה.",
      "enDescription": "An expired quote stays viewable but cannot be signed.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": [
        "isExpired"
      ]
    },
    {
      "id": "draft_recovery",
      "heLabel": "שחזור טיוטה מקומית",
      "enLabel": "Local draft recovery",
      "heDescription": "שחזור עבודה שלא נשמרה בעורך ההצעה לאחר רענון או מעבר לאפליקציה אחרת. העבודה שמורה רק בדפדפן המקומי, ולא בענן.",
      "enDescription": "Restoring unsaved editor work after a refresh/app switch - stored locally in the browser only, never in the cloud.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_LOCAL_DRAFT_AS_CLOUD_SAVED"
      ],
      "deterministicFactKeys": [
        "draftProvenance"
      ]
    },
    {
      "id": "accessibility_tools",
      "heLabel": "הצהרת נגישות",
      "enLabel": "Accessibility statement",
      "heDescription": "הצהרת נגישות בתחתית כל מסך, עם פרטי פנייה בנושא נגישות. טקסט מגדילים בהגדלה של הדפדפן או של הטלפון.",
      "enDescription": "An Accessibility Statement at the bottom of every screen, with the accessibility contact details. Text is enlarged with the zoom of the browser or the phone.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "ai_chat",
      "heLabel": "צ׳אט AI",
      "enLabel": "AI Chat assistant",
      "heDescription": "עוזר AI זמין בתוך האפליקציה, שמסביר את המוצר, עונה מהנתונים של החשבון (הצעות, לקוחות, קטלוג, משימות) ומנווט לפי בקשה - קריאה בלבד, לעולם לא מבצע פעולה בעצמו. אפשר לשאול גם בקול: המיקרופון בשורת הכתיבה; התשובות מוקראות או בכתב לפי הבחירה בכפתור הרמקול שבכותרת הצ׳אט. אפשר להדביק לשאלה צילום מסך (או לצרף אותו בכפתור המהדק בטלפון), והעוזר מסביר מה מופיע בו.",
      "enDescription": "An in-app AI assistant that explains the product, answers from the account’s own data (quotes, clients, catalog, tasks) and navigates on request - read-only, it never performs an action itself. You can also ask by voice: the microphone in the typing row; answers are spoken or written by the choice in the speaker button of the chat header. You can paste a screenshot into a question (or attach it with the paperclip on a phone) and the assistant explains what it shows.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "admin_console",
      "heLabel": "מסך ניהול",
      "enLabel": "Admin console",
      "heDescription": "מסך ניהול פנימי המוגבל לתפקיד Super Admin המאומת בצד השרת - אינו תלוי במסלול ואינו חלק ממרחב העבודה של משתמש רגיל.",
      "enDescription": "An internal admin screen restricted to a server-verified Super Admin role - independent of plan entitlement, not part of an ordinary user's workspace.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "role",
      "requiredRole": "super_admin",
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_admin",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [
        "NO_ADMIN_FROM_PLAN_OR_LIFETIME_INFERENCE"
      ],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_statistics",
      "heLabel": "סטטיסטיקת הצעות והצעות חמות",
      "enLabel": "Quote statistics and hot quotes",
      "heDescription": "מסך סטטיסטיקה: כמה הצעות נוצרו, נשלחו, אושרו ושולמו, שיעור ההמרה, ורשימת הצעות חמות (נצפו 3 פעמים או יותר וממתינות לאישור) עם פעולות ידניות: צפייה בהצעה (נפתחת בלשונית חדשה), WhatsApp, שליחה במייל ויצירת משימת מעקב. סכומים מוצגים לכל מטבע בנפרד, לפי תקופה ומצב. פותחים אותו מהתפריט „סטטיסטיקה” (בנייד: „עוד” ← „סטטיסטיקה”).",
      "enDescription": "A Statistics screen: how many quotes were created, sent, approved and paid, the conversion rate, and a hot-quote list (viewed 3+ times and awaiting approval) with manual actions: view the quote (opens in a new tab), WhatsApp, email and create a follow-up task. Amounts are shown per currency, by period and status. Open it from the “Statistics” menu item (on mobile: “More” → “Statistics”).",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "manual_tasks",
      "heLabel": "משימות ידניות",
      "enLabel": "Manual tasks",
      "heDescription": "מסך משימות: יוצרים משימה ידנית עם כותרת, הערות, תאריך ושעה, עדיפות וקישור להצעה או ללקוח שלכם, ומסמנים אותה כהושלמה. אפשר ליצור משימת מעקב ישירות מהצעה חמה. המשימות שמורות בחשבון שלכם ומוצגות רק לכם.",
      "enDescription": "A Tasks screen: you create a manual task with a title, notes, date and time, priority and a link to one of your quotes or clients, and mark it completed. A follow-up task can be created directly from a hot quote. Tasks are saved in your account and shown only to you.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "calendar",
      "heLabel": "יומן",
      "enLabel": "Calendar",
      "heDescription": "יומן בתצוגת יום, שבוע וחודש: משימות לפי התאריך והשעה שלהן, והצעות שממתינות לחתימה לפי תאריך „בתוקף עד”. בחשבון ישראלי היומן מציג גם שבתות, חגים וימי מנוחה רשמיים בישראל ברקע נפרד שאפשר להסתיר. השבוע מתחיל ביום ראשון, והחגים הם שכבת מידע בלבד. זה יומן פנימי של TEKANGO לתכנון העבודה; פותחים אותו מהתפריט „יומן” (בנייד: „עוד” ← „יומן”). הוא אינו מסונכרן ל-Google Calendar או ליומן חיצוני אחר.",
      "enDescription": "A calendar with day, week and month views: tasks on their date and time, and quotes awaiting signature on their valid-until date. Weeks start on Sunday, and it shows no public holidays. It is TEKANGO’s internal calendar for planning your work; open it from the “Calendar” menu item (on mobile: “More” → “Calendar”). It is not synced with Google Calendar or any other external calendar.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "quote_link_view",
      "heLabel": "צפייה בקישור ההצעה",
      "enLabel": "Quote link viewed",
      "heDescription": "הצעה „נשלחה” כשסימנתם אותה כנשלחה, או כששלחתם אותה בוואטסאפ או במייל. „צפייה בקישור ההצעה” נשמרת בזמן השרת, פעם אחת, כשקישור ההצעה נפתח והמסמך הוצג לפחות 5 שניות בדפדפן שאינו החשבון שלכם וסורקים מוכרים מסוננים. זו אינדיקציה לפתיחת הקישור בלבד - גם פתיחה שלכם מדפדפן מנותק או סורק חדש עשויים להיספר, ולכן היא מוצגת כצפייה בקישור. הנקודה הירוקה ליד מייל מאשרת רק שספק המייל קיבל את בקשת השליחה. הרישום מתחיל אחרי עדכון השרת.",
      "enDescription": "A quote is “sent” when you marked it as sent, or when you shared it by WhatsApp or by email. “Quote link viewed” is stored in server time, once, when the quote link was opened and the document shown for at least 5 seconds in a browser other than your account, with known scanners filtered out. It indicates that the link was opened - your own opening from a signed-out browser or a new scanner can also count, so it is shown as a link view. The green dot next to an email confirms only that the email provider accepted the send request.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "reminders_automation",
      "heLabel": "תזכורות ואוטומציות",
      "enLabel": "Reminders & automation",
      "heDescription": "הגדרות עסק ← תזכורות ואוטומציות: בוחרים אחד משלושה מצבים — ״בממשק בלבד״ (ברירת המחדל: התזכורות מופיעות בפעמון), ״כבוי״ או ״מלא, כולל שליחה ללקוח״. המצב המלא מופעל רק בבחירה מפורשת שלכם. מסמנים בתיבות הסימון אילו פעולות יפעלו. אפשר להגדיר כלל ללקוח (ימים, תוכן, שעות שליחה ואזור זמן, עם תצוגה מקדימה והשהיה). שליחה אוטומטית ללקוחות תיפתח בהמשך; בינתיים אתם שולחים הודעות ללקוח מתוך ההצעה. שליחה בוואטסאפ נעשית ידנית מתוך ההצעה. התראה חדשה בפעמון גם קופצת על המסך כהודעה צפה, פעם אחת, כשהמערכת פתוחה (אם היא מגיעה כשהמסך לא מוצג - היא קופצת כשחוזרים אליו); ההודעה הקופצת והפעמון פועלים תמיד יחד.",
      "enDescription": "Business settings → Reminders & automation: you choose one of three modes - “In-app only” (the default: reminders appear for you under the bell), “Off”, or “Full, including customer sending”, which turns on only by your explicit choice. You tick which behaviors run. You can set up a customer rule (days, content, sending hours and a time zone, with a preview and a pause), and automatic sending to customers opens later; until then, messages to a customer are sent by you from the quote. WhatsApp is sent manually from the quote. A new bell notification also pops up on the screen as a floating notice, once, while the app is open (if it arrives while the page is not shown, it pops up when you return); the floating notice and the bell always work together.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_business_settings",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "digital_business_card",
      "heLabel": "יצירת כרטיס ביקור דיגיטלי",
      "enLabel": "Digital business card",
      "heDescription": "הגדרות עסק ← „כרטיס ביקור דיגיטלי”: יוצרים ועורכים דף ציבורי לעסק - שם, תפקיד, סלוגן, אודות ותמונה או לוגו - ובוחרים אילו דרכי תקשורת יוצגו (טלפון, WhatsApp, אימייל וכתובת מהגדרות העסק). יש קישור לשיתוף וקוד QR. מספר עוסק ופרטים פנימיים לא מוצגים.",
      "enDescription": "Business settings → “Digital business card”: create and edit a public page for your business - name, job title, slogan, about and a photo or logo - and choose which contact options appear (phone, WhatsApp, email and address from Business settings). It has a share link and a QR code. Your tax ID and internal details are never shown.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "subscriptionCapabilityId": null,
      "planEligibility": null,
      "eligiblePlans": null,
      "minimumPlan": null,
      "authorityType": "none",
      "requiredRole": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_business_settings",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    }
  ],
  "nonCurrentCapabilities": [
    {
      "id": "payment_processing",
      "heLabel": "עיבוד תשלומים",
      "enLabel": "Payment processing",
      "heDescription": "קבלת תשלום/סליקה בתוך TEKANGO.",
      "enDescription": "Accepting payment/checkout inside TEKANGO.",
      "state": "UNAVAILABLE",
      "forbiddenClaimCodes": [
        "NO_PAYMENT_CAPABILITY_CLAIM"
      ]
    },
    {
      "id": "invoicing",
      "heLabel": "הפקת חשבוניות",
      "enLabel": "Invoicing",
      "heDescription": "הפקת חשבונית/חשבונית מס/קבלה על ידי TEKANGO.",
      "enDescription": "Issuing an invoice/tax invoice/receipt from TEKANGO.",
      "state": "UNAVAILABLE",
      "forbiddenClaimCodes": [
        "NO_INVOICING_CAPABILITY_CLAIM"
      ]
    },
    {
      "id": "autonomous_email",
      "heLabel": "מענה אוטונומי במייל",
      "enLabel": "Autonomous email reply",
      "heDescription": "AI שקורא ועונה במייל ללקוחות באופן אוטונומי.",
      "enDescription": "AI reading and autonomously replying to customer email.",
      "state": "ROADMAP_POST_LIVE",
      "forbiddenClaimCodes": [
        "NO_AUTONOMOUS_EMAIL_CLAIM"
      ]
    },
    {
      "id": "ai_mutation",
      "heLabel": "שינוי נתונים על ידי AI",
      "enLabel": "AI-executed data mutation",
      "heDescription": "ה-AI מבצע בעצמו שינוי/מחיקה/שליחה במקום המשתמש.",
      "enDescription": "The AI itself performing a change/deletion/send instead of the user.",
      "state": "ROADMAP_POST_LIVE",
      "forbiddenClaimCodes": [
        "NO_AI_EXECUTION_CLAIM"
      ],
      "heAnswerNote": "העוזר עונה ומדריך, ואינו מבצע פעולות במקומכם. להכנת הצעה בעזרת AI יש הצעת מחיר חכמה עם AI: בחלון „הצעה חדשה” בוחרים „מתארים ל-AI”, מתארים את העבודה בכתב או מכתיבים בקול, וה-AI מציע שורות שבודקים ומאשרים.",
      "enAnswerNote": "The assistant answers and guides; it does not act for you. To prepare a quote with AI, use the AI smart quote: in “New quote” choose “Describe it to AI”, describe the job in writing or dictate it, and the AI suggests lines you review and approve."
    },
    {
      "id": "automatic_customer_messages",
      "heLabel": "שליחה אוטומטית ללקוחות",
      "enLabel": "Automatic customer messages",
      "heDescription": "מיילים שנשלחים ללקוחות אוטומטית לפי כללי מצב „מלא” בתזכורות ואוטומציות.",
      "enDescription": "Emails sent to customers automatically by Full-mode rules in Reminders & automation.",
      "state": "IMPLEMENTED_NOT_RELEASED",
      "forbiddenClaimCodes": [
        "NO_AUTOMATIC_CUSTOMER_SEND_CLAIM"
      ]
    },
    {
      "id": "automatic_whatsapp",
      "heLabel": "WhatsApp אוטומטי",
      "enLabel": "Automatic WhatsApp",
      "heDescription": "שליחת הודעות WhatsApp ללקוחות אוטומטית, בלי לחיצה של בעל העסק.",
      "enDescription": "Sending WhatsApp messages to customers automatically, without the business owner pressing send.",
      "state": "ROADMAP_POST_LIVE",
      "forbiddenClaimCodes": [
        "NO_AUTOMATIC_WHATSAPP_CLAIM"
      ]
    },
    {
      "id": "google_calendar_sync",
      "heLabel": "אינטגרציה עם Google Calendar",
      "enLabel": "Google Calendar integration",
      "heDescription": "חיבור אופציונלי של יומן TEKANGO ליומן Google של המשתמש.",
      "enDescription": "An optional connection of the TEKANGO calendar to the user’s Google Calendar.",
      "state": "ROADMAP_POST_LIVE",
      "forbiddenClaimCodes": [
        "NO_EXTERNAL_CALENDAR_SYNC_CLAIM"
      ],
      "heAnswerNote": "ב-TEKANGO יש יומן פנימי לתכנון העבודה - פותחים אותו מהתפריט „יומן” (בנייד: „עוד” ← „יומן”). הוא אינו מסונכרן ל-Google Calendar או ליומן חיצוני אחר.",
      "enAnswerNote": "TEKANGO has an internal calendar for planning your work - open it from the “Calendar” menu item (on mobile: “More” → “Calendar”). It is not synced with Google Calendar or any other external calendar."
    }
  ],
  "howTo": [
    {
      "id": "clients_catalog_export",
      "capabilityIds": [
        "clients",
        "catalog",
        "quote_csv",
        "expense_csv"
      ],
      "he": {
        "task": "ייצוא לאקסל של לקוחות, קטלוג, הצעות והוצאות",
        "steps": [
          "במסך \"לקוחות\" לוחצים \"ייצוא לאקסל\" (ליד החיפוש). יורד קובץ אקסל עם הלקוחות שמוצגים: שם, סוג, מייל, טלפון, ח״פ, כתובת, הערות ותאריך יצירה.",
          "במסך הקטלוג לוחצים \"ייצוא לאקסל\" (ליד \"הוספת פריט\"). יורד קובץ עם שם הפריט, המחיר, איך מחשבים ותיאור.",
          "הצעות מייצאים ב\"ייצוא לאקסל (CSV)\" ברשימת ההצעות, והוצאות ב\"ייצוא CSV\" במסך \"פיננסים\"."
        ]
      },
      "en": {
        "task": "Exporting clients, the catalog, quotes and expenses to Excel",
        "steps": [
          "In \"Clients\" click \"Export to Excel\" (beside the search). An Excel file with the clients shown downloads: name, type, email, phone, tax ID, address, notes and created date.",
          "In the catalog click \"Export to Excel\" (beside \"Add Item\"). The file has the item name, the price, how it is priced and the description.",
          "Quotes are exported with \"Export CSV\" in the quote list, and expenses with \"Export CSV\" in \"Finances\"."
        ]
      }
    },
    {
      "id": "accessibility_statement",
      "capabilityIds": [
        "accessibility_tools"
      ],
      "he": {
        "task": "נגישות והגדלת טקסט",
        "steps": [
          "אין במערכת תפריט נגישות להגדלת טקסט או לשינוי ניגודיות. כדי להגדיל טקסט משתמשים בהגדלה של הדפדפן או של הטלפון.",
          "בתחתית המסך יש \"הצהרת נגישות\", ושם פרטי הפנייה בנושא נגישות."
        ]
      },
      "en": {
        "task": "Accessibility and larger text",
        "steps": [
          "There is no accessibility menu for text size or contrast. To make text larger use the zoom of the browser or the phone.",
          "At the bottom of the screen there is the \"Accessibility Statement\", with the contact details for accessibility."
        ]
      }
    },
    {
      "id": "signed_notice_email",
      "capabilityIds": [
        "public_quote_sign"
      ],
      "he": {
        "task": "הודעה כשהלקוח חותם",
        "steps": [
          "כשלקוח חותם על הצעה, בעל העסק מקבל מייל אחד לכתובת שאיתה הוא נכנס לחשבון, בנושא שבו כתוב שהלקוח חתם על הצעה ומספרה, עם קישור להצעה החתומה. הלקוח עצמו לא מקבל מייל."
        ]
      },
      "en": {
        "task": "A notice when the client signs",
        "steps": [
          "When a client signs a quote, the business owner gets one email at the address used to sign in, saying that the client signed the quote and its number, with a link to the signed quote. The client gets no email."
        ]
      }
    },
    {
      "id": "attachments_limits",
      "capabilityIds": [
        "attachments"
      ],
      "he": {
        "task": "צירוף קבצים להצעה - מסלול וגודל",
        "steps": [
          "צירוף קבצים ללקוח הוא חלק מחכם פלוס. בעורך ההצעה, ב\"פרטים נוספים להצעה (לא חובה)\", בוחרים \"קבצים ותמונות\" ולוחצים על צירוף קובץ ללקוח (עד 3 מגה לקובץ). לכל העסק יש עד 30 מגה, והנפח שנשאר מופיע ב\"נפח פנוי להעלאת קבצים\"."
        ]
      },
      "en": {
        "task": "Attaching files to a quote - plan and size",
        "steps": [
          "Attaching files for the client is part of SMART PACK. In the quote editor, in \"More quote details (optional)\", choose \"Files and images\" and click \"Attach file for client (max 3 MB)\". A business has up to 30 MB in total; what is left shows in \"Free space for attachments\"."
        ]
      }
    },
    {
      "id": "price_change_after_send",
      "capabilityIds": [
        "quote_edit",
        "public_quote_view"
      ],
      "he": {
        "task": "שיניתי מחיר אחרי השליחה - הלקוח יראה?",
        "steps": [
          "כן. עד שהלקוח חותם, כל שינוי שנשמר מופיע בקישור שלו, בלי לרענן את הדף.",
          "אם הלקוח כבר התחיל לחתום, החתימה מתאפסת ומופיעה ההודעה \"ההצעה עודכנה. עברו על השינויים לפני החתימה.\", והוא חותם מחדש. אחרי חתימה ההצעה נעולה."
        ]
      },
      "en": {
        "task": "I changed a price after sending - will the client see it?",
        "steps": [
          "Yes. Until the client signs, every saved change shows on their link without a page refresh.",
          "If they had started signing, the signature is cleared and they see \"This quote was updated. Review the changes before signing.\" and sign again. After signing the quote is locked."
        ]
      }
    },
    {
      "id": "expenses_record",
      "capabilityIds": [
        "expenses"
      ],
      "he": {
        "task": "רישום הוצאה והוצאה קבועה",
        "steps": [
          "במסך \"פיננסים\" לוחצים \"הוספת הוצאה\", ממלאים \"תיאור\", \"קטגוריה\" ו\"סכום\" ולוחצים \"שמירה\".",
          "הוצאה שחוזרת כל חודש מסמנים ב\"הוצאה חודשית קבועה\". היא נספרת בכל חודש מהחודש שבו נרשמה.",
          "תאריך ההוצאה הוא תמיד היום. אי אפשר לבחור תאריך או לרשום הוצאה לחודש קודם."
        ]
      },
      "en": {
        "task": "Recording an expense and a recurring expense",
        "steps": [
          "In \"Finances\" click \"Add Expense\", fill in \"Description\", \"Category\" and \"Amount\" and click \"Save\".",
          "An expense that repeats every month is marked \"Recurring monthly\". It counts every month from the month it was entered.",
          "The expense date is always today. A date cannot be chosen, and an expense of a previous month cannot be recorded."
        ]
      }
    },
    {
      "id": "install_app",
      "capabilityIds": [
        "dashboard_overview"
      ],
      "he": {
        "task": "התקנת האפליקציה במסך הבית",
        "steps": [
          "בטלפון או בטאבלט, בתפריט \"עוד\" לוחצים \"התקנת האפליקציה\". אם הדפדפן מציע חלון התקנה משלו, הוא נפתח; אחרת נפתח חלון \"התקנת TEKANGO במסך הבית\" עם השלבים, ולוחצים \"הבנתי\".",
          "במחשב אין שורת התקנה, וכשהאתר כבר פתוח מהסמל במסך הבית השורה לא מופיעה."
        ]
      },
      "en": {
        "task": "Installing the app on the home screen",
        "steps": [
          "On a phone or tablet, open \"More\" and tap \"Install the app\". If the browser has its own install window it opens; otherwise the \"Install TEKANGO on your home screen\" window shows the steps - tap \"Got it\".",
          "A computer has no install row, and once the site runs from the home-screen icon the row is not shown."
        ]
      }
    },
    {
      "id": "rounding_discount",
      "capabilityIds": [
        "quote_create"
      ],
      "he": {
        "task": "הנחת עיגול בסיכום ההצעה",
        "steps": [
          "בהצעה בשקלים, כשהסכום אחרי ההנחה יוצא לא בשקלים שלמים, הוא מעוגל כלפי מטה והאגורות עוברות להנחה.",
          "בלי הנחה באחוזים מופיעה בסיכום השורה \"הנחת עיגול\" (כשהעיגול הוא חצי שקל ומעלה). כשיש הנחה באחוזים, העיגול נכלל בשורת ההנחה. במטבעות אחרים אין עיגול."
        ]
      },
      "en": {
        "task": "The rounding discount in the quote summary",
        "steps": [
          "In a shekel quote, when the amount after discount is not a whole shekel, it is rounded down and the agorot go into the discount.",
          "With no percent discount the summary shows \"Rounding discount\" (when the rounding is half a shekel or more). With a percent discount the rounding is part of the discount row. Other currencies are not rounded."
        ]
      }
    },
    {
      "id": "client_delete_blocked",
      "capabilityIds": [
        "clients"
      ],
      "he": {
        "task": "למה אי אפשר למחוק לקוח",
        "steps": [
          "אי אפשר למחוק לקוח שיש לו הצעה כלשהי, גם טיוטה. מוחקים קודם את ההצעות שלו ואז את הלקוח.",
          "הצעה חתומה או מאושרת אי אפשר למחוק, ולכן לקוח עם הצעה כזו נשאר במערכת לצורכי תיעוד."
        ]
      },
      "en": {
        "task": "Why a client cannot be deleted",
        "steps": [
          "A client with any quote, drafts included, cannot be deleted. Delete their quotes first, then the client.",
          "A signed or approved quote cannot be deleted, so a client with such a quote stays in the system for the records."
        ]
      }
    },
    {
      "id": "finances_totals",
      "capabilityIds": [
        "finance_views",
        "expense_csv"
      ],
      "he": {
        "task": "מה סופרים במסך הפיננסים",
        "steps": [
          "\"סך הכנסות\" סופר רק הצעות שאושרו או ששולמו, לפי תאריך היצירה של ההצעה בתקופה שנבחרה, בנפרד לכל מטבע.",
          "\"רווח נקי\" מראה \"לא ניתן לחשב: ההכנסות בכמה מטבעות\" כשיש הכנסה במטבע שאינו מטבע החשבון: ההוצאות במטבע החשבון ואין המרה.",
          "\"ייצוא CSV\" במסך הזה מוריד רק את ההוצאות של התקופה."
        ]
      },
      "en": {
        "task": "What the finances screen counts",
        "steps": [
          "\"TOTAL REVENUE\" counts only approved or paid quotes, by the quote creation date in the selected period, one total per currency.",
          "\"NET PROFIT\" shows \"Not computable: revenue is in several currencies\" when there is revenue in a currency other than the account currency: expenses are in the account currency and nothing is converted.",
          "\"Export CSV\" on this screen downloads only the expenses of the period."
        ]
      }
    },
    {
      "id": "next_step_bar",
      "capabilityIds": [
        "dashboard_overview",
        "quote_history"
      ],
      "he": {
        "task": "השורה מעל רשימת ההצעות - מה הצעד הבא",
        "steps": [
          "מעל רשימת ההצעות מתחלפות כל 4 שניות, בסדר הזה: משימה באיחור, הצעה שהלקוח צפה בה 3 פעמים או יותר ולא חתם, והצעה שעוד לא נחתמה ותוקפה מסתיים היום או בתוך 3 ימים.",
          "כשאין אף אחד מאלה כתוב \"אין כרגע צעד דחוף.\"."
        ]
      },
      "en": {
        "task": "The line above the quote list - the next step",
        "steps": [
          "Above the quote list, rotating every 4 seconds in this order: an overdue task, a quote the client viewed 3 times or more without signing, and an unsigned quote whose validity ends today or within 3 days.",
          "When there is none it says \"No urgent next step right now.\"."
        ]
      }
    },
    {
      "id": "quote_states_list",
      "capabilityIds": [
        "quote_status",
        "quote_history"
      ],
      "he": {
        "task": "מה אומר המצב של הצעה ברשימה",
        "steps": [
          "\"טיוטה\" - עוד אין מחיר. \"טיוטה · מוכנה לשליחה\" - טיוטה שלמה שהלקוח עוד לא ראה.",
          "\"נשלחה · טרם נצפתה\", \"נשלחה · נצפתה\" ו\"נצפתה, ממתינה\" (נצפתה 3 פעמים או יותר ולא נחתמה).",
          "\"אושרה\", \"שולמה\", ו\"פג תוקף\" - תאריך התוקף עבר והיא לא אושרה."
        ]
      },
      "en": {
        "task": "What the state of a quote in the list means",
        "steps": [
          "\"Draft\" - nothing priced yet. \"Draft · ready to send\" - a complete draft the client has not seen.",
          "\"Sent · not viewed yet\", \"Sent · viewed\" and \"Viewed, awaiting\" (viewed 3 times or more, not signed).",
          "\"Approved\", \"Paid\", and \"Expired\" - the validity date passed and it was not approved."
        ]
      }
    },
    {
      "id": "issue_quote",
      "capabilityIds": [
        "quote_status"
      ],
      "he": {
        "task": "מה עושה \"הנפקת ההצעה\"",
        "steps": [
          "בהצעה שמורה שעוד לא הונפקה, בחלק \"הנפקת ההצעה\" לוחצים \"המשיכו להנפקה\" ומאשרים ב\"הנפיקו\".",
          "ההצעה מסומנת כנשלחה, והסגנון, המיתוג והתמונות שלה מוקפאים. לא נשלח מייל ולא נשלחת הודעה ללקוח; את הקישור משתפים אחר כך."
        ]
      },
      "en": {
        "task": "What \"Issue the quote\" does",
        "steps": [
          "On a saved quote that was not issued yet, in \"Issue the quote\" click \"Continue to issuing\" and confirm with \"Issue\".",
          "The quote is marked sent, and its style, branding and images are frozen. No email or message goes to the client; share the link afterwards."
        ]
      }
    },
    {
      "id": "missing_price_customer",
      "capabilityIds": [
        "public_quote_view",
        "public_quote_sign"
      ],
      "he": {
        "task": "מה הלקוח רואה כשחסר מחיר",
        "steps": [
          "שורה בלי מחיר מוצגת ללקוח \"טרם תומחר\", והסכום מסומן כחלקי.",
          "הלקוח לא יכול לחתום, להדפיס או להוריד PDF עד שכל המחירים מולאו."
        ]
      },
      "en": {
        "task": "What the client sees when a price is missing",
        "steps": [
          "A row without a price shows \"Not priced yet\" to the client, and the total is marked partial.",
          "The client cannot sign, print or download a PDF until every price is filled in."
        ]
      }
    },
    {
      "id": "quote_from_file_limits",
      "capabilityIds": [
        "smart_quote"
      ],
      "he": {
        "task": "העלאת קובץ להצעה - מה מותר",
        "steps": [
          "ב\"מעלים קובץ\" מעלים קובץ PDF או JPG אחד, עד 8 מגה, עד 5 עמודים ועד 30 שורות. זה חלק מחכם פלוס.",
          "החלון משווה בין הסכום במסמך לסכום שלכם, לפני מע״מ והנחות. הקובץ לא נשמר אצלנו; ספק הבינה שומר עותק לזמן מוגבל, לפי התנאים שלו."
        ]
      },
      "en": {
        "task": "Making a quote from a file - what is allowed",
        "steps": [
          "With \"Upload a file\" you upload one PDF or JPG, up to 8 MB, 5 pages and 30 lines. It is part of SMART PACK.",
          "The window compares the document total with yours, before VAT and discounts. The file is not kept by us; the AI provider keeps a copy for a limited time under its own terms."
        ]
      }
    },
    {
      "id": "service_date",
      "capabilityIds": [
        "quote_create"
      ],
      "he": {
        "task": "תאריך ביצוע",
        "steps": [
          "ב\"פרטים נוספים להצעה (לא חובה)\", ב\"פרויקט, כתובת ותוקף\", יש \"תאריך העבודה (לא חובה)\". הוא נפרד מתוקף ההצעה, לא מוצג ללקוח, ומופיע ביומן הפנימי (\"יומן\")."
        ]
      },
      "en": {
        "task": "The work date",
        "steps": [
          "In \"More quote details (optional)\", in \"Project, address and validity\", there is \"Work date (optional)\". It is separate from the validity, is not shown to the client, and is listed in your internal \"Calendar\"."
        ]
      }
    },
    {
      "id": "after_free_plan",
      "capabilityIds": [
        "plan_trial"
      ],
      "he": {
        "task": "מה אפשר לעשות אחרי שמסלול החינם נגמר",
        "steps": [
          "אפשר להמשיך לצפות בהצעות הקיימות, לשלוח שוב הצעות שכבר יצאו בלי שינוי, למחוק הצעות ולעבוד עם לקוחות, משימות והוצאות.",
          "הצעה חדשה, או הצעה ששונתה אחרי שנשלחה, דורשות מנוי."
        ]
      },
      "en": {
        "task": "What you can do after the Free plan ends",
        "steps": [
          "You can keep viewing existing quotes, re-send quotes that already went out unchanged, delete quotes and work with clients, tasks and expenses.",
          "A new quote, or a quote changed after it was sent, needs a subscription."
        ]
      }
    },
    {
      "id": "signup_verify",
      "capabilityIds": [
        "profile_prerequisites"
      ],
      "he": {
        "task": "הרשמה, אימות מייל ובדיקת אבטחה",
        "steps": [
          "אחרי ההרשמה נשלח מייל לאימות. התחברות לפני האימות מציגה את הכפתור \"שליחה חוזרת של מייל האימות\".",
          "בכל הרשמה, התחברות ואיפוס סיסמה מופיעה תיבת בדיקה של Cloudflare (\"אני לא רובוט\"). אם הבדיקה לא הושלמה, מחכים רגע, מסמנים את התיבה ומנסים שוב."
        ]
      },
      "en": {
        "task": "Sign-up, email verification and the security check",
        "steps": [
          "After sign-up a verification email is sent. Signing in before verifying shows the \"Resend the verification email\" button.",
          "Sign-up, sign-in and password reset always show a Cloudflare check box (\"I am not a robot\"). If the check did not complete, wait a moment, tick the box and try again."
        ]
      }
    },
    {
      "id": "client_tax_id",
      "capabilityIds": [
        "clients"
      ],
      "he": {
        "task": "ח״פ של לקוח וחיפוש",
        "steps": [
          "בכרטיס הלקוח יש שדה \"ח״פ / ת״ז\", והחיפוש במסך הלקוחות מוצא גם לפיו."
        ]
      },
      "en": {
        "task": "A client tax ID and search",
        "steps": [
          "The client card has a \"Tax ID\" field, and the client search also finds by it."
        ]
      }
    },
    {
      "id": "editor_limits",
      "capabilityIds": [
        "quote_create"
      ],
      "he": {
        "task": "מגבלות בעורך ההצעה",
        "steps": [
          "אפשר להוסיף עד 100 כותרות (דירות, קומות, חדרים או נושאים) בפעם אחת (\"אפשר להוסיף עד 100 בכל פעם\"), עד 4 רמות של כותרת בתוך כותרת.",
          "הצעות ישנות שבהן כותרת סומנה כמה עותקים זהים נשארות עם \"×\" ומספר; בהצעה חדשה כל עותק הוא כותרת נפרדת."
        ]
      },
      "en": {
        "task": "Limits in the quote editor",
        "steps": [
          "Up to 100 headings (apartments, floors, rooms or topics) can be added at once (\"Up to 100 at a time\"), up to 4 levels of a heading inside a heading.",
          "Older quotes where a heading stood for several identical copies keep \"×\" and a number; in a new quote each copy is its own heading."
        ]
      }
    },
    {
      "id": "daily_tips",
      "capabilityIds": [
        "dashboard_overview"
      ],
      "he": {
        "task": "הטיפים היומיים",
        "steps": [
          "אפשר לכבות את הטיפים בכפתור \"לא להציג טיפים\" (בדפדפן הזה). טיפ שנסגר נשמר בפעמון כנקרא למשך 30 יום. כרגע אין כפתור שמחזיר אותם."
        ]
      },
      "en": {
        "task": "The daily tips",
        "steps": [
          "Tips can be turned off with \"No more tips\" (in this browser). A closed tip stays read in the bell for 30 days. There is no button to turn them back on yet."
        ]
      }
    },
    {
      "id": "business_settings_effects",
      "capabilityIds": [
        "business_settings"
      ],
      "he": {
        "task": "מה משנות הגדרות העסק",
        "steps": [
          "עסק מחוץ לישראל בוחר \"מדינת העסק\": בעסק בארה״ב התאריך מוצג חודש קודם, בכל השאר יום קודם.",
          "השאלה \"מה סוג העיסוק המקצועי של העסק?\" קובעת את יחידת המחיר המוצעת בהוספת עבודה.",
          "ב\"אחריות להצעות חדשות — ברירת מחדל\" כותבים אחריות שתיכנס לכל הצעה חדשה."
        ]
      },
      "en": {
        "task": "What the business settings change",
        "steps": [
          "A business outside Israel chooses the \"Business country\": a US business shows dates month first, every other one day first.",
          "The question \"What kind of professional work does your business do?\" sets the price unit offered when adding work.",
          "In \"Default Warranty for New Quotes\" you write a warranty that goes into every new quote."
        ]
      }
    },
    {
      "id": "copy_message_marks_sent",
      "capabilityIds": [
        "quote_email",
        "owner_whatsapp_share"
      ],
      "he": {
        "task": "העתקת ההודעה ללקוח",
        "steps": [
          "ברשימת ההצעות \"העתקה\" מעתיק את ההודעה עם הקישור, כדי שתדביקו ותשלחו בעצמכם. טיוטה שמעתיקים לה הודעה מסומנת כנשלחה."
        ]
      },
      "en": {
        "task": "Copying the message for the client",
        "steps": [
          "In the quote list \"Copy\" copies the message with the link so you can paste and send it yourself. A draft whose message is copied is marked sent."
        ]
      }
    },
    {
      "id": "quote_style_settings",
      "capabilityIds": [
        "business_settings",
        "quote_pdf"
      ],
      "he": {
        "task": "עיצוב ההצעה",
        "steps": [
          "סגנון ההצעה נקבע בהגדרות העסק, ב\"עיצוב הצעות המחיר\", ולא בכל הצעה בנפרד. הצעה שכבר נשמרה עם סגנון משלה שומרת אותו."
        ]
      },
      "en": {
        "task": "The quote design",
        "steps": [
          "The quote style is set in the business settings, in \"Quote design\", not per quote. A quote already saved with its own style keeps it."
        ]
      }
    },
    {
      "id": "phone_navigation",
      "capabilityIds": [
        "dashboard_overview"
      ],
      "he": {
        "task": "איפה המסכים בטלפון",
        "steps": [
          "בטלפון השורה התחתונה היא \"הצעות מחיר\", \"לקוחות\", \"פיננסים\", \"חדש\" ו\"עוד\". ב\"עוד\" נמצאים הקטלוג, הסטטיסטיקה, המשימות, היומן, ההגדרות ו\"התקנת האפליקציה\"."
        ]
      },
      "en": {
        "task": "Where the screens are on a phone",
        "steps": [
          "On a phone the bottom row is \"Quotes\", \"Clients\", \"Finances\", \"New\" and \"More\". \"More\" holds the catalog, statistics, tasks, calendar, settings and \"Install the app\"."
        ]
      }
    },
    {
      "id": "chat_limits",
      "capabilityIds": [
        "ai_chat"
      ],
      "he": {
        "task": "מגבלות הצ׳אט",
        "steps": [
          "בלי חכם פלוס אפשר לשאול את העוזר עד 30 שאלות ביום, והמכסה מתחדשת למחרת. עם חכם פלוס, מד השימוש החודשי מחליף את המכסה היומית.",
          "הסבר של צילום מסך שמדביקים בצ׳אט, וקריאת הנתונים של החשבון, הם חלק מחכם פלוס."
        ]
      },
      "en": {
        "task": "Chat limits",
        "steps": [
          "Without SMART PACK you can ask the assistant up to 30 questions a day; it renews the next day. With SMART PACK the monthly usage meter replaces the daily limit.",
          "Explaining a pasted screenshot and reading your account data are part of SMART PACK."
        ]
      }
    },
    {
      "id": "business_logo_and_details",
      "capabilityIds": [
        "business_settings",
        "profile_prerequisites"
      ],
      "he": {
        "task": "הוספת לוגו ועדכון פרטי העסק",
        "steps": [
          "בתפריט הצד לוחצים על \"הגדרות העסק\".",
          "בשדה \"כתובת תמונת לוגו (URL) או העלאת קובץ\" לוחצים \"העלאת קובץ\" ובוחרים קובץ PNG או JPG עד 500KB (במסמכים מונפקים קובץ SVG לא מתקבל).",
          "באותו מסך ממלאים את פרטי העסק, למשל \"טלפון העסק\" ו\"ח.פ / עוסק מורשה\".",
          "לוחצים \"שמירת הגדרות העסק\"."
        ]
      },
      "en": {
        "task": "Adding a logo and updating the business details",
        "steps": [
          "In the sidebar click \"Business Settings\".",
          "In the \"Logo Image URL or File Upload\" field click \"Upload File\" and choose a PNG or JPG file up to 500KB (issued documents do not accept an SVG file).",
          "On the same screen fill in the business details, for example \"Business Phone\".",
          "Click \"Save Business Settings\"."
        ]
      }
    },
    {
      "id": "first_quote",
      "capabilityIds": [
        "quote_create",
        "profile_prerequisites",
        "catalog"
      ],
      "he": {
        "task": "יצירת הצעת מחיר (גם הראשונה)",
        "steps": [
          "לפני ההצעה הראשונה צריך טלפון עסק (ובישראל גם ח.פ / עוסק מורשה) ב\"הגדרות העסק\".",
          "לוחצים \"הצעה חדשה\". בחלון \"איך תרצו להתחיל?\" בוחרים \"ממלאים בעצמכם\" (לשלוש הדרכים האחרות יש הסבר משלהן).",
          "בשלב \"למי מכינים את ההצעה?\" אפשר לבחור לקוח שמור ב\"בחירת לקוח קיים (לא חובה)\" (בראש הרשימה \"+ הוספת לקוח חדש\"), או למלא את שם הלקוח. בוחרים \"סוג הלקוח\" - \"לקוח פרטי\" או \"לקוח עסקי\"; ללקוח עסקי בישראל ממלאים גם \"מספר עוסק מורשה / חברה\" (חובה). טלפון, דוא״ל וכתובת נמצאים ב\"פרטי קשר (לא חובה)\". לוחצים \"שמירת הלקוח והמשך\" - לקוח חדש נשמר מיד ברשימת הלקוחות. בישראל מופיעה מיד הודעה אם הסכומים כוללים מע״מ או לא.",
          "בשלב \"מה מוסיפים להצעה?\" בוחרים מבנה: \"הצעה פשוטה\", \"לפי דירות\" או \"קומות, דירות וחדרים\" (ליד כל אחד יש סימן שאלה עם הסבר). בטופס \"מוסיפים עבודה או מוצר\" בוחרים מוצר מהקטלוג או מקלידים שם (\"+ הוספת מוצר חדש\"), בוחרים \"חישוב\" - ליחידה, למ״ר, למטר, לשעה, ליום עבודה, לק״ג או מחיר גלובלי - כותבים כמות ומחיר ולוחצים \"הוספה\". מוצר חדש אפשר \"לשמור גם בקטלוג\". השורה נכנסת לרשימה, ובכפתור \"פעולות\" שלה יש עריכה, שכפול, העברה והסרה.",
          "ב\"פרטים נוספים להצעה (לא חובה)\" יש: \"פרויקט, כתובת ותוקף\", \"הערות לכל ההצעה\", \"תנאים ואחריות\", \"הנחה\", \"קבצים ותמונות\" ו\"עיצוב והנפקת ההצעה\". כתובת הלקוח נמצאת בפרטי הלקוח, ב\"פרטי קשר (לא חובה)\".",
          "בפס שבתחתית רואים \"סה״כ לתשלום\"; שם אפשר לפתוח את \"סיכום ההצעה\", לראות \"כך הלקוח יראה\" וללחוץ \"שמירת ההצעה\". שמירה אינה שליחה: ההצעה נשמרת כטיוטה, ומופיע \"נשמרה. עדיין לא נשלחה.\" - משם אפשר לראות איך הלקוח יראה אותה, לחזור לעריכה או לעבור לרשימת ההצעות."
        ]
      },
      "en": {
        "task": "Creating a quote (including the first one)",
        "steps": [
          "Before the first quote a business phone is required in \"Business Settings\".",
          "Click \"New quote\". In the \"How would you like to start?\" window choose \"Fill it in yourselves\" (the other three ways have their own steps).",
          "In the \"Who is this quote for?\" step you can pick a saved client in \"Choose an existing client (optional)\" (\"+ Add a new client\" is at the top), or fill in the client name. Choose the \"Client type\" - \"Private client\" or \"Business client\"; a business client may get a \"Business / company number\". Phone, email and address are in \"Contact details (optional)\". Click \"Save the client and continue\" - a new client is saved to your client list right away.",
          "In the \"What goes in the quote?\" step choose a structure: \"Simple quote\", \"By apartments\" or \"Floors, apartments, rooms\" (each has a question mark with an explanation). In the \"Add work or a product\" form choose a catalog product or type a name (\"+ Add a new product\"), choose the \"Pricing\" - per unit, per sq ft, per ft, per hour, per work day, per kg or a global price - type the quantity and the price and click \"Add\". A new product can \"Also save to the catalog\". The row enters the list, and its \"Actions\" button holds edit, duplicate, move and remove.",
          "\"More quote details (optional)\" holds \"Project, address and validity\", \"Notes for the whole quote\", \"Terms and warranty\", \"Discount\", \"Files and images\" and \"Quote design and issuing\". The client address is in the client details, under \"Contact details (optional)\".",
          "The bar at the bottom shows \"Total to pay\"; there you can open the \"Quote summary\", see \"Client view\" and click \"Save the quote\". Saving is not sending: the quote is saved as a draft and \"Saved. Not sent yet.\" appears - from there you can see how the client will see it, go back to editing or go to the quote list."
        ]
      }
    },
    {
      "id": "quote_places",
      "capabilityIds": [
        "measured_quote",
        "quote_create",
        "quote_edit"
      ],
      "he": {
        "task": "הצעה לכמה דירות, חדרים או קומות",
        "steps": [
          "בשלב \"מה מוסיפים להצעה?\" בוחרים \"לפי דירות\" או \"קומות, דירות וחדרים\" ולוחצים \"+ הוספת דירה, קומה, חדר או נושא אחר\". בוחרים מה מוסיפים (קומה, דירה, חדר או נושא בשם אחר), כמה, ואת השמות שלהן (שדה ריק = שם לפי הסדר). כל אחת היא כותרת נפרדת עם העבודות שלה - גם כשהדירות זהות, כל דירה מופיעה בנפרד, ואפשר לשכפל דירה עם כל מה שבתוכה.",
          "מתחת לכל כותרת יש טופס \"מוסיפים עבודה או מוצר\", ובראשו כתוב לאן השורה נכנסת (\"אל:\"). ב\"קומות, דירות וחדרים\" אפשר להוסיף כותרת בתוך כותרת (\"+ הוספת כותרת בתוך\" ושם הכותרת) - חדרים בתוך דירה ודירות בתוך קומה, עד 4 רמות. ליד כל כותרת מוצג הסכום של כל מה שבתוכה, והמשולש סוגר ופותח אותה.",
          "הכפתור \"⋯\" של כותרת פותח את עמוד האפשרויות שלה: שינוי השם (\"שמירת השם\"), שכפול עם כל מה שבתוכה, \"העתקת עבודות\" מהכותרת הראשונה באותה רמה (לכותרת ריקה), \"שמירה כתבנית\", \"הזזה למעלה\" / \"הזזה למטה\" ומחיקה \"עם התוכן\" - ואפשר לבטל. \"חזרה ללא שמירה\" יוצא בלי שינוי. בשורת ההוספה יש גם \"מתבנית שמורה\". הצעות ישנות שבהן דירה סומנה כמה עותקים זהים (× ומספר) נשארות כמו שהן.",
          "הלקוח רואה את הכותרות ואת הכותרות שבתוכן, עם חץ ליד כל כותרת שסוגר ופותח את הפירוט (חץ גדול לכותרת ראשית וקטן לכותרת שבתוכה), ובראש הרשימה \"תצוגת מסמך מלא\" ו\"תצוגת שורות סיכום\". בהדפסה ובקובץ בוחרים מסמך מלא או חלקי, ושם אין חיצים."
        ]
      },
      "en": {
        "task": "A quote for several apartments, rooms or floors",
        "steps": [
          "In the \"What goes in the quote?\" step choose \"By apartments\" or \"Floors, apartments, rooms\" and click \"+ Add an apartment, floor, room or other topic\". Choose what you add (a floor, apartment, room or another topic), how many, and what they are called (an empty field = a name in order). Each one is a separate heading with its own work - identical apartments are each shown separately too, and an apartment can be duplicated with everything inside it.",
          "Under each heading there is an \"Add work or a product\" form, and its top says where the row goes (\"To:\"). In \"Floors, apartments, rooms\" a heading can be added inside a heading (\"+ Add a heading inside\" and the heading name) - rooms inside an apartment and apartments inside a floor, up to 4 levels. Each heading shows the total of everything inside it, and its triangle closes and opens it.",
          "A heading's \"⋯\" button opens its options page: the name (\"Save the name\"), duplicate with everything inside it, \"Copy the works from the first\" heading at the same level (into an empty heading), \"Save as a template\", \"Move up\" / \"Move down\" and delete \"with its content\" - and it can be undone. \"Back without saving\" leaves with no change. The add row also has \"From a saved template\". Older quotes where an apartment was marked as several identical copies (× and a number) stay as they are.",
          "The client sees the headings and the headings inside them, an arrow beside each heading that closes and opens its details (a big arrow for a main heading and a small one for a heading inside it), and \"Full document view\" and \"Summary rows view\" above the list. Printing and the file offer a full or a partial document, with no arrows."
        ]
      }
    },
    {
      "id": "send_quote",
      "capabilityIds": [
        "quote_email",
        "owner_whatsapp_share",
        "quote_status"
      ],
      "he": {
        "task": "שליחת הצעה ללקוח",
        "steps": [
          "בתפריט הצד לוחצים על \"הצעות מחיר\" ומוצאים את ההצעה ברשימה.",
          "לוחצים \"פתיחה\" ליד ההצעה.",
          "בוחרים \"שליחה במייל\", \"וואטסאפ\", או \"העתקה\" (מעתיק הודעה עם הקישור להצעה, להדבקה בכל מקום).",
          "הצעה בטיוטה מסומנת \"נשלחה\" אוטומטית אחרי שליחה במייל או פתיחת וואטסאפ."
        ]
      },
      "en": {
        "task": "Sending a quote to a client",
        "steps": [
          "In the sidebar click \"Quotes\" and find the quote in the list.",
          "Click \"Open\" next to the quote.",
          "Choose \"Email\", \"WhatsApp\", or \"Copy\" (copies a message with the quote link to paste anywhere).",
          "A draft is marked \"Sent\" automatically after an email send or when WhatsApp opens."
        ]
      }
    },
    {
      "id": "quote_pdf",
      "capabilityIds": [
        "quote_pdf",
        "quote_print"
      ],
      "he": {
        "task": "הורדת הצעה כ-PDF",
        "steps": [
          "ברשימת \"הצעות מחיר\" לוחצים \"פתיחה\" ליד ההצעה ואז \"צפייה\", כדי לראות את ההצעה כמו שהלקוח רואה אותה.",
          "לוחצים \"הורדה כ-PDF\". את הקובץ אפשר גם להדפיס."
        ]
      },
      "en": {
        "task": "Downloading a quote as a PDF",
        "steps": [
          "In the \"Quotes\" list click \"Open\" next to the quote and then \"View\" to see it the way the client sees it.",
          "Click \"Download PDF\". The file can also be printed."
        ]
      }
    },
    {
      "id": "quote_templates",
      "capabilityIds": [
        "quote_create"
      ],
      "he": {
        "task": "שמירת הצעה כתבנית והתחלה מתבנית",
        "steps": [
          "כששומרים הצעה חדשה בפעם הראשונה (\"שמירת ההצעה\") מופיעה השאלה \"האם לשמור הצעה זאת כתבנית?\". לוחצים \"כן\", נותנים שם ובוחרים מה לשמור. נשמרים הנושא והפריטים, בלי פרטי הלקוח. בהצעה שכבר נשמרה הכפתור הוא \"עדכון ההצעה\", והשאלה לא מופיעה.",
          "כדי להתחיל מתבנית: לוחצים \"הצעה חדשה\", בוחרים \"מתבנית שמורה\", ממלאים את הלקוח ולוחצים \"שמירת הלקוח והמשך\", ואז בוחרים את התבנית. סוג הלקוח שבחרתם לא משתנה; כשהמחירים בתבנית לפי בסיס מע״מ אחר, נשאלים אם להשתמש בהם."
        ]
      },
      "en": {
        "task": "Saving a quote as a template and starting from a template",
        "steps": [
          "When a new quote is saved for the first time (\"Save the quote\") the question \"Save this quote as a template?\" appears. Click \"Yes\", give it a name and choose what to keep. The subject and the items are saved, without the customer details. A quote saved before shows \"Update the quote\" and is not asked.",
          "To start from a template: click \"New quote\", choose \"From a saved template\", fill in the client and click \"Save the client and continue\", then pick the template. The client type you chose does not change."
        ]
      }
    },
    {
      "id": "smart_quote_ai",
      "capabilityIds": [
        "smart_quote"
      ],
      "he": {
        "task": "הצעת מחיר חכמה עם AI",
        "steps": [
          "לוחצים \"הצעה חדשה\", בוחרים \"מתארים ל-AI\", ממלאים את הלקוח ולוחצים \"שמירת הלקוח והמשך\".",
          "מתארים את העבודה במילים, או מכתיבים בקול בלחיצה על המיקרופון בפינת השדה. אפשר לתאר גם מבנה, למשל: שתי דירות זהות, בכל אחת ריצוף במטבח - וה-AI מציע את הדירות, מספר העותקים, העבודות והחדרים.",
          "ה-AI מציע שורות לבדיקה. מחיר מוצע רק לפריט מהקטלוג או כשכתבתם אותו. מה שלא ברור מסומן ולא מנוחש, ואם לא כתוב אם הדירות זהות - הוא שואל. בודקים, מתקנים ומאשרים לפני שמשהו נכנס להצעה."
        ]
      },
      "en": {
        "task": "An AI smart quote",
        "steps": [
          "Click \"New quote\", choose \"Describe it to AI\", fill in the client and click \"Save the client and continue\".",
          "Describe the job in words, or dictate it by clicking the microphone in the corner of the field. You can describe a structure too, for example: two identical apartments, flooring in the kitchen of each - and the AI suggests the apartments, the number of copies, the work and the rooms.",
          "The AI suggests lines to check. A price is suggested only for an item from your catalog or when you wrote it. What is unclear is marked, never guessed, and when it is not written whether the apartments are identical, it asks. Review, correct and approve before anything enters the quote."
        ]
      }
    },
    {
      "id": "quote_from_file",
      "capabilityIds": [
        "smart_quote"
      ],
      "he": {
        "task": "הצעת מחיר מקובץ",
        "steps": [
          "לוחצים \"הצעה חדשה\", בוחרים \"מעלים קובץ\" (הצעת מחיר מקובץ), ממלאים את הלקוח ולוחצים \"שמירת הלקוח והמשך\".",
          "לוחצים \"בחרו קובץ\", בוחרים קובץ PDF או JPG אחד ולוחצים \"קריאת הפרטים\".",
          "בכל שורה מוצגים \"מחיר במסמך\" ו\"המחיר שלכם\". ממלאים את המחיר שלכם ולוחצים \"הוספת השורות להצעה\". הקובץ לא נשמר."
        ]
      },
      "en": {
        "task": "A quote from a file",
        "steps": [
          "Click \"New quote\", choose \"Upload a file\" (Quote from a file), fill in the client and click \"Save the client and continue\".",
          "Click \"Choose a file\", pick one PDF or JPG and click \"Read details\".",
          "Each line shows \"Price in the document\" and \"Your price\". Fill in your price and click \"Add the lines to the quote\". The file is not stored."
        ]
      }
    },
    {
      "id": "smart_edit_quote",
      "capabilityIds": [
        "smart_quote",
        "quote_edit"
      ],
      "he": {
        "task": "עריכה חכמה",
        "steps": [
          "ברשימת \"הצעות מחיר\" מוצאים הצעה שעדיין לא נחתמה ולוחצים \"עריכה חכמה\" בשורת הפעולות של ההצעה.",
          "ההצעה נפתחת לעריכה וחלון ה-AI מכוון אליה. מתארים במילים, או מכתיבים בקול, מה להוסיף, לשנות או למחוק - שורות, כמויות, מחירים, הערות או הנחה.",
          "ה-AI מציע את השינויים בהצעה ואת השורות החדשות. בודקים, מסמנים את מה שמתאים ולוחצים \"החלת השינויים בהצעה\". מחיר משתנה רק כשכתבתם אותו בבקשה, ושום דבר לא נשמר עד ששומרים את ההצעה.",
          "אפשר גם לשנות כמות או מחיר של שורה ידנית, ישירות בשדות השורה בעורך ההצעה.",
          "הצעה שהלקוח כבר חתם עליה נעולה - הכפתור לא פעיל (\"לא ניתן לערוך הצעה חתומה\")."
        ]
      },
      "en": {
        "task": "Smart edit",
        "steps": [
          "In the \"Quotes\" list, find a quote that is not signed yet and click \"Smart edit\" in the quote's row actions.",
          "The quote opens for editing and the AI dialog is pointed at it. Describe in words, or dictate by voice, what to add, change or remove - lines, quantities, prices, notes or a discount.",
          "The AI suggests the changes to the quote and any new lines. Review, tick what fits and click \"Apply the changes to the quote\". A price changes only when you wrote it in the request, and nothing is saved until you save the quote.",
          "You can also change a line's quantity or price by hand, right in the row's fields in the quote editor.",
          "A quote the client has already signed is locked - the button is disabled (\"Cannot edit a signed quote\")."
        ]
      }
    },
    {
      "id": "quote_item_price_quantity",
      "capabilityIds": [
        "quote_create",
        "quote_edit"
      ],
      "he": {
        "task": "שינוי כמות או מחיר של פריט בהצעה",
        "steps": [
          "בעורך ההצעה לוחצים \"פעולות\" בשורה של הפריט (בטלפון: שלוש הנקודות של השורה) ובוחרים \"עריכה\". השורה נפתחת לעריכה במקומה: משנים את הכמות (מספר שלם או עשרוני, למשל 2.5) או את המחיר, הסכום של השורה מתעדכן מיד, ולוחצים \"שמירה\" (\"ביטול\" מחזיר את השורה בדיוק כמו שהייתה). אחר כך שומרים את ההצעה.",
          "בפריט לפי \"שטח\" או \"אורך\" משנים את המידות באותה שורה. אפשר להוסיף \"מידה נוספת\", או ללחוץ ליד המידות על \"השטח כבר ידוע?\" או \"האורך כבר ידוע?\" כשהשטח או האורך כבר ידועים.",
          "מחיר נכתב עם נקודה עשרונית, למשל 1200.50. מחיר ריק מסומן כחסר ולא נחשב 0. פרטים נוספים ללקוח נמצאים בשורה הפתוחה לעריכה, בכפתור \"פעולות לשורה\" של השורה (בטלפון: שלוש הנקודות של השורה), ב\"פרטים ללקוח\"."
        ]
      },
      "en": {
        "task": "Changing the quantity or the price of an item in a quote",
        "steps": [
          "In the quote editor click \"Actions\" on the item's row (on a phone: the three dots of the row) and choose \"Edit\". The row opens for editing in its place: change the quantity (a whole or decimal number, for example 2.5) or the price, the row total updates at once, and click \"Save\" (\"Cancel\" returns the row exactly as it was). Then save the quote.",
          "For an item billed by \"Area\" or \"Length\" change the sizes in the same row. You can add \"Another size\", or click \"I already know the area\" or \"I already know the length\" beside the sizes when the area or length is already known.",
          "A price uses a decimal point, for example 1200.50. An empty price is marked as missing and never counts as 0. More details for the customer are in the row open for editing, in the \"Row actions\" button of the row (on a phone: the three dots of the row), under \"Details for the customer\"."
        ]
      }
    },
    {
      "id": "quote_identical_units",
      "capabilityIds": [
        "quote_create",
        "quote_edit"
      ],
      "he": {
        "task": "דירות זהות (או חדרים / קומות זהים) ומחיר משותף אחרי שכפול",
        "steps": [
          "בהצעה חדשה כל דירה (או חדר / קומה) היא כותרת נפרדת, גם כשהדירות זהות. ממלאים אחת, ובכפתור \"⋯\" שבכותרת שלה בוחרים \"שכפול\" - נוצר עותק עם כל מה שבתוכה, מיד אחריה, ואת השם משנים באותו עמוד ב\"שמירת השם\". לדירה ריקה אפשר גם \"העתקת עבודות\" מהדירה הראשונה.",
          "כל עותק נערך בנפרד: משנים, מוסיפים או מסירים בו שורות בלי לגעת בשאר. אחרי הסרה של שורה או כותרת אפשר ללחוץ \"ביטול ההסרה\".",
          "בשכפול המחירים של כל שורה והעותק שלה מקושרים. כשמשנים מחיר בשורה מקושרת נשאלים אם לעדכן גם את השורות המקושרות: \"רק כאן\", עדכון גם בהן, או \"ביטול\". אחרי עדכון אפשר ללחוץ \"ביטול עדכון המחירים\".",
          "בהצעות ישנות שבהן דירה סומנה כמה עותקים זהים מופיעים שם הדירה עם מספר העותקים (למשל דירה טיפוס א׳ × 12), הפירוט לעותק אחד והסכום של כל העותקים - בעורך, בהצעה ללקוח, בהדפסה ובקובץ. בהצעה חדשה אין × ומספר."
        ]
      },
      "en": {
        "task": "Identical apartments (or rooms / floors) and a shared price after duplicating",
        "steps": [
          "In a new quote every apartment (or room / floor) is a separate heading, identical apartments too. Fill in one, and in the \"⋯\" button in the header of that apartment choose \"Duplicate\" - a copy with everything inside it appears right after it, and \"Save the name\" on the same page gives it its own name. An empty apartment can also \"Copy the works from the first\" apartment.",
          "Each copy is edited on its own: change, add or remove its rows without touching the others. After removing a row or a heading you can click \"Undo\".",
          "When duplicating, the price of every row is linked to its copy. When you change the price of a linked row you are asked whether the linked rows take it too: \"Only here\", update them too, or \"Cancel\". After an update you can click \"Undo the price update\".",
          "Older quotes where an apartment was marked as several identical copies show the apartment name with its number of copies (for example Type A apartment × 12), the details for one copy and the total of all copies - in the editor, the client quote, the print and the file. A new quote has no × and number."
        ]
      }
    },
    {
      "id": "quote_unit_template",
      "capabilityIds": [
        "quote_create",
        "quote_edit"
      ],
      "he": {
        "task": "תבנית לדירה (או חדר / קומה) - שמירה והוספה להצעה אחרת",
        "steps": [
          "בכפתור \"⋯\" שבכותרת של הדירה (או החדר / הקומה) בוחרים \"שמירה כתבנית\". נותנים שם ובוחרים אם לשמור מחירים ופרטים ללקוח. השורות, סוג החיוב והמידות נשמרים תמיד; פרטי לקוח, כתובת ושמות המקומות במידות לעולם לא נשמרים.",
          "כדי להוסיף מקום שמור להצעה פתוחה לוחצים \"מתבנית שמורה\" (בשורת כפתורי ההוספה שבראש אזור העבודה), בוחרים את התבנית ולוחצים \"הוספה להצעה\". מקום אחד עם השורות שלו נוסף לסוף ההצעה.",
          "כשהמטבע או בסיס המע״מ של המחירים בתבנית שונים מההצעה, נשאלים לפני ההוספה אם להשתמש במחירים או להוסיף בלי מחירים.",
          "בחלון ההוספה מתבנית שמורה בתוך ההצעה מופיעות רק תבניות של מקום, ובחלון התבניות של הצעה חדשה מופיעות רק תבניות הצעה. בכל חלון מוחקים רק את התבניות שלו."
        ]
      },
      "en": {
        "task": "A template for an apartment (or room / floor) - saving it and adding it to another quote",
        "steps": [
          "In the \"⋯\" button in the header of the apartment (or room / floor) choose \"Save as a template\". Give it a name and choose whether to keep the prices and the details for the customer. The rows, the billing type and the sizes are always kept; customer details, the address and the place names of the sizes are never kept.",
          "To add a saved place to an open quote click \"From a saved template\" (in the row of add buttons at the top of the work area), pick the template and click \"Add to the quote\". One place with its rows is added at the end of the quote.",
          "When the currency or the VAT basis of the template prices differs from the quote, you are asked before adding whether to use the prices or add without prices.",
          "The window for adding from a saved template inside a quote lists only place templates, and the template window of a new quote lists only quote templates. Each window deletes only its own templates."
        ]
      }
    },
    {
      "id": "quote_attachment",
      "capabilityIds": [
        "attachments"
      ],
      "he": {
        "task": "צירוף קובץ להצעה",
        "steps": [
          "בעורך ההצעה, מתחת לעבודות, לוחצים \"פרטים נוספים להצעה (לא חובה)\" ובוחרים \"קבצים ותמונות\".",
          "לוחצים על כפתור צירוף הקובץ, בוחרים את הקובץ, לוחצים \"שמירת הפרטים\" ואז \"שמירת ההצעה\"."
        ]
      },
      "en": {
        "task": "Attaching a file to a quote",
        "steps": [
          "In the quote editor, under the works, click \"More quote details (optional)\" and choose \"Files and images\".",
          "Click the attach-file button, choose the file, click \"Save the details\" and then \"Save the quote\"."
        ]
      }
    },
    {
      "id": "add_client",
      "capabilityIds": [
        "clients"
      ],
      "he": {
        "task": "הוספת לקוח",
        "steps": [
          "בתפריט הצד לוחצים על \"לקוחות\" ואז \"לקוח חדש\".",
          "ממלאים את הפרטים ושומרים. לקוח חדש נשמר גם בהצעה חדשה, כשלוחצים \"שמירת הלקוח והמשך\"."
        ]
      },
      "en": {
        "task": "Adding a client",
        "steps": [
          "In the sidebar click \"Clients\" and then \"New Client\".",
          "Fill in the details and save. A new client is also saved from a new quote, when you click \"Save the client and continue\"."
        ]
      }
    },
    {
      "id": "add_catalog_item",
      "capabilityIds": [
        "catalog"
      ],
      "he": {
        "task": "הוספת פריט לקטלוג",
        "steps": [
          "בתפריט הצד לוחצים על \"קטלוג\" ואז \"הוספת פריט\".",
          "ממלאים שם ומחיר. אפשר לבחור \"איך מחשבים (לא חובה)\" - ליחידה, למ״ר, למטר, לשעה, ליום, לק״ג או מחיר אחד לכל העבודה. לוחצים \"שמירה\". כשבוחרים את הפריט בהצעה, אופן החיוב נבחר לפיו; פריט בלי בחירה הוא ליחידה."
        ]
      },
      "en": {
        "task": "Adding a catalog item",
        "steps": [
          "In the sidebar click \"Catalog\" and then \"Add Item\".",
          "Fill in a name and a price. You can choose \"How is it priced (optional)\" - per item, per m², per metre, per hour, per day, per kg or one price for all the work. Click \"Save\". When you pick the item in a quote, its billing follows it; an item with no choice is per item."
        ]
      }
    },
    {
      "id": "tasks",
      "capabilityIds": [
        "dashboard_overview"
      ],
      "he": {
        "task": "משימות",
        "steps": [
          "בתפריט הצד לוחצים על \"משימות\" ואז \"משימה חדשה\".",
          "משימה שבוצעה מסמנים כהושלמה, והיא עוברת ללשונית ״הושלמו״. משימות פתוחות מופיעות בלשונית ״פתוחות״. אפשר גם למחוק משימה."
        ]
      },
      "en": {
        "task": "Tasks",
        "steps": [
          "In the sidebar click \"Tasks\" and then \"New task\".",
          "Mark a finished task as done; it moves to the \"Completed\" tab. Open tasks are in the \"Open\" tab. A task can also be deleted."
        ]
      }
    },
    {
      "id": "password_reset",
      "capabilityIds": [
        "dashboard_overview"
      ],
      "he": {
        "task": "שכחתי סיסמה",
        "steps": [
          "במסך הכניסה לוחצים \"שכחת סיסמה?\".",
          "מזינים את כתובת המייל ולוחצים \"שליחת קישור לשחזור\".",
          "בקישור שמגיע במייל מזינים \"סיסמה חדשה\" ולוחצים \"שמירת הסיסמה החדשה\"."
        ]
      },
      "en": {
        "task": "Forgot password",
        "steps": [
          "On the sign-in screen click \"Forgot password?\".",
          "Enter your email address and click \"Send Reset Link\".",
          "In the link that arrives by email enter a \"New password\" and click \"Update Password & Save\"."
        ]
      }
    },
    {
      "id": "sign_out",
      "capabilityIds": [
        "dashboard_overview"
      ],
      "he": {
        "task": "התנתקות",
        "steps": [
          "פותחים את \"הגדרות והתנתקות\" ולוחצים \"התנתקות\"."
        ]
      },
      "en": {
        "task": "Signing out",
        "steps": [
          "Open \"Settings and sign out\" and click \"Sign out\"."
        ]
      }
    },
    {
      "id": "signed_quote_locked",
      "capabilityIds": [
        "quote_edit",
        "public_quote_sign"
      ],
      "he": {
        "task": "למה אי אפשר לערוך הצעה חתומה",
        "steps": [
          "הצעה שהלקוח חתם עליה נעולה: אי אפשר לערוך או למחוק אותה (\"לא ניתן לערוך הצעה חתומה\"). אפשר לשכפל אותה (\"שכפול\") וליצור ממנה הצעה חדשה."
        ]
      },
      "en": {
        "task": "Why a signed quote cannot be edited",
        "steps": [
          "A quote the client signed is locked: it cannot be edited or deleted (\"Cannot edit a signed quote\"). You can duplicate it (\"Duplicate\") and create a new quote from it."
        ]
      }
    },
    {
      "id": "quote_validity",
      "capabilityIds": [
        "quote_expiry",
        "quote_create"
      ],
      "he": {
        "task": "קביעת תוקף להצעה",
        "steps": [
          "בעורך ההצעה, מתחת לעבודות, לוחצים \"פרטים נוספים להצעה (לא חובה)\" ובוחרים \"פרויקט, כתובת ותוקף\".",
          "בשדה \"תוקף ההצעה\" בוחרים את התאריך האחרון שבו הלקוח יכול לחתום, לוחצים \"שמירת הפרטים\" ואז \"שמירת ההצעה\".",
          "אחרי התאריך הלקוח עדיין רואה את ההצעה, אבל אי אפשר לחתום עליה."
        ]
      },
      "en": {
        "task": "Setting how long a quote is valid",
        "steps": [
          "In the quote editor, under the works, click \"More quote details (optional)\" and choose \"Project, address and validity\".",
          "In \"Quote validity\" choose the last date the client can sign, click \"Save the details\" and then \"Save the quote\".",
          "After that date the client still sees the quote but can no longer sign it."
        ]
      }
    },
    {
      "id": "quote_discount",
      "capabilityIds": [
        "quote_create",
        "quote_edit"
      ],
      "he": {
        "task": "מתן הנחה בהצעה",
        "steps": [
          "בעורך ההצעה, מתחת לעבודות, לוחצים \"פרטים נוספים להצעה (לא חובה)\", בוחרים \"הנחה\" וממלאים \"הנחה באחוזים\" - אחוז בין 0 ל-100.",
          "הסכום ב\"סיכום ההצעה\" מתעדכן מיד. הנחה למוצר אחד בלבד נותנים דרך המחיר של אותה שורה."
        ]
      },
      "en": {
        "task": "Giving a discount in a quote",
        "steps": [
          "In the quote editor, under the works, click \"More quote details (optional)\", choose \"Discount\" and fill in \"Discount in percent\" - a percentage between 0 and 100.",
          "The total in the \"Quote summary\" updates at once. A discount on a single item is given through that line's own price."
        ]
      }
    },
    {
      "id": "quote_terms_deposit",
      "capabilityIds": [
        "quote_create",
        "business_settings"
      ],
      "he": {
        "task": "תנאי תשלום, מקדמה ואחריות בהצעה",
        "steps": [
          "בעורך ההצעה, מתחת לעבודות, לוחצים \"פרטים נוספים להצעה (לא חובה)\" ובוחרים \"תנאים ואחריות\".",
          "כותבים ב\"תנאי תשלום\" את התנאים, למשל מקדמה ותשלומים, וב\"אחריות\" את האחריות, ולוחצים \"שמירת הפרטים\". זה טקסט שהלקוח רואה בהצעה; המערכת אינה גובה את התשלום.",
          "כדי שהתנאים ייכנסו אוטומטית לכל הצעה חדשה: ב\"הגדרות העסק\" ממלאים \"תנאים כלליים להצעות חדשות — ברירת מחדל\" ולוחצים \"שמירת הגדרות העסק\"."
        ]
      },
      "en": {
        "task": "Payment terms, a deposit and warranty in a quote",
        "steps": [
          "In the quote editor, under the works, click \"More quote details (optional)\" and choose \"Terms and warranty\".",
          "Write the terms in \"Payment terms\", for example a deposit or installments, and the warranty in \"Warranty\", and click \"Save the details\". It is text the client sees in the quote; TEKANGO does not collect the payment.",
          "To have the terms in every new quote: in \"Business Settings\" fill in \"Default Terms & Conditions for New Quotes\" and click \"Save Business Settings\"."
        ]
      }
    },
    {
      "id": "quote_vat",
      "capabilityIds": [
        "quote_create"
      ],
      "he": {
        "task": "מע״מ בהצעה",
        "steps": [
          "בשלב \"למי מכינים את ההצעה?\" בוחרים \"סוג הלקוח\": \"לקוח עסקי\" - הסכומים ללא מע״מ, והמע״מ יתווסף למחיר הסופי; או \"לקוח פרטי\" - המחיר כולל מע״מ, ולא יתווסף מע״מ לסכום הכללי. הודעה על כך מופיעה מיד אחרי הבחירה, והמחיר בכל שורה פתוח לשינוי.",
          "שיעור המע״מ מחושב אוטומטית (18% בישראל) ואינו הגדרה שמשנים. \"סיכום ההצעה\" מציג את המע״מ ואת הסכום הכולל."
        ]
      },
      "en": {
        "task": "VAT in a quote",
        "steps": [
          "In the \"Who is this quote for?\" step choose the \"Client type\" (\"Business client\" or \"Private client\").",
          "For an international business no VAT is added automatically, and the VAT rate is not a setting. The \"Quote summary\" shows the total."
        ]
      },
      "enLocal": {
        "task": "VAT in a quote",
        "steps": [
          "In the \"Who is this quote for?\" step choose the \"Client type\": \"Business client\" - amounts are before VAT and VAT is added to the final price; or \"Private client\" - the price includes VAT and no VAT is added to the total.",
          "The VAT rate is calculated automatically (18% in Israel) and is not a setting. The \"Quote summary\" shows the VAT and the total."
        ]
      },
      "heIntl": {
        "task": "מע״מ בהצעה",
        "steps": [
          "בשלב \"למי מכינים את ההצעה?\" בוחרים \"סוג הלקוח\" (\"לקוח עסקי\" או \"לקוח פרטי\").",
          "בעסק בינלאומי לא מתווסף מע״מ אוטומטית, ושיעור המע״מ אינו הגדרה. \"סיכום ההצעה\" מציג את הסכום הכולל."
        ]
      }
    },
    {
      "id": "quote_delete",
      "capabilityIds": [
        "quote_history"
      ],
      "he": {
        "task": "מחיקת הצעה",
        "steps": [
          "ברשימת \"הצעות מחיר\" לוחצים \"פתיחה\" ליד ההצעה ואז \"מחיקה\", ומאשרים.",
          "הצעה שהלקוח כבר חתם עליה אי אפשר למחוק (\"לא ניתן למחוק הצעה חתומה\"). הצעה שנמחקה אינה חוזרת."
        ]
      },
      "en": {
        "task": "Deleting a quote",
        "steps": [
          "In the \"Quotes\" list click \"Open\" next to the quote, then \"Delete\", and confirm.",
          "A quote the client already signed cannot be deleted (\"Cannot delete a signed quote\"). A deleted quote does not come back."
        ]
      }
    },
    {
      "id": "share_default_texts",
      "capabilityIds": [
        "owner_whatsapp_share",
        "business_settings"
      ],
      "he": {
        "task": "שינוי הודעת הוואטסאפ הקבועה והודעת התודה",
        "steps": [
          "ב\"הגדרות העסק\" פותחים את \"שיתוף ותודה ללקוח\".",
          "ממלאים \"הודעת ברירת מחדל לוואטסאפ (לא חובה)\" ו/או \"הודעת תודה אחרי חתימה (לא חובה)\" ולוחצים \"שמירה\". הקישור להצעה מצורף תמיד להודעה."
        ]
      },
      "en": {
        "task": "Changing the default WhatsApp message and the thank-you",
        "steps": [
          "In \"Business Settings\" open \"Sharing & thank-you\".",
          "Fill in \"Default WhatsApp message (optional)\" and/or \"Thank-you after signing (optional)\" and click \"Save\". The quote link is always added to the message."
        ]
      }
    },
    {
      "id": "business_currency",
      "capabilityIds": [
        "business_settings"
      ],
      "he": {
        "task": "מטבע ההצעות",
        "steps": [
          "בחשבון ישראלי ההצעות הן תמיד בשקלים (₪), והמטבע אינו ניתן לשינוי."
        ]
      },
      "en": {
        "task": "The currency of your quotes",
        "steps": [
          "In \"Business Settings\" choose the currency in \"Business Currency\" (USD, EUR or GBP) and click \"Save Business Settings\".",
          "New quotes use that currency. It is the currency shown in the quote; TEKANGO does not collect payments."
        ]
      },
      "enLocal": {
        "task": "The currency of your quotes",
        "steps": [
          "In an Israeli account quotes are always in shekels (₪), and the currency cannot be changed."
        ]
      },
      "heIntl": {
        "task": "מטבע ההצעות",
        "steps": [
          "ב\"הגדרות העסק\" בוחרים את המטבע ב\"מטבע העסק\" (USD, EUR או GBP) ולוחצים \"שמירת הגדרות העסק\".",
          "הצעות חדשות משתמשות במטבע הזה. זה המטבע שמוצג בהצעה; TEKANGO לא גובה תשלומים."
        ]
      }
    },
    {
      "id": "improve_quote",
      "capabilityIds": [
        "quote_history",
        "quote_edit"
      ],
      "he": {
        "task": "הכפתור \"שיפור ההצעה\"",
        "steps": [
          "ברשימת \"הצעות מחיר\" לוחצים \"פתיחה\" ליד ההצעה ואז \"שיפור ההצעה\".",
          "הכלי בודק את ההצעה מנקודת המבט של הלקוח ומציע מה לשנות כדי שתהיה ברורה ואטרקטיבית יותר. הבדיקה פנימית - הלקוח לא רואה אותה.",
          "שום דבר לא משתנה בהצעה בלי אישור שלכם: הצעה לתוספת נכנסת רק בלחיצה על \"הוספה להצעה\". ניתוח הבינה הוא חלק מחכם פלוס."
        ]
      },
      "en": {
        "task": "The \"Improve quote\" button",
        "steps": [
          "In the \"Quotes\" list click \"Open\" next to the quote, then \"Improve quote\".",
          "It reviews the quote from the client's point of view and suggests what to change so it is clearer and more attractive. The check is internal - the client never sees it.",
          "Nothing changes in the quote without your approval: a suggested addition goes in only when you click \"Add to the quote\". The AI analysis is part of SMART PACK."
        ]
      }
    },
    {
      "id": "quote_status_mark",
      "capabilityIds": [
        "quote_status"
      ],
      "he": {
        "task": "סימון מצב הצעה (נשלחה, אושרה, שולמה)",
        "steps": [
          "ברשימת \"הצעות מחיר\" לוחצים \"פתיחה\" ליד ההצעה ואז \"עריכה\".",
          "ב\"פרטים נוספים להצעה (לא חובה)\" בוחרים \"מצב ההצעה\", ושם בוחרים \"נשלחה\", \"אושרה\" או \"שולמה\", ולוחצים \"שמירת ההצעה\". המצב רק מסמן את ההצעה; הוא לא גובה תשלום.",
          "הצעה שאושרה או שהלקוח חתם עליה נעולה לעריכה (\"לא ניתן לערוך הצעה חתומה\"). כשהלקוח שילם, פותחים את ההצעה ברשימה, לוחצים \"סימון כשולמה\" ומאשרים. אחרי הסימון אי אפשר לחזור ל\"אושרה\", והצעה ששולמה נעולה לגמרי."
        ]
      },
      "en": {
        "task": "Marking a quote's status (Sent, Approved, Paid)",
        "steps": [
          "In the \"Quotes\" list click \"Open\" next to the quote, then \"Edit\".",
          "In \"More quote details (optional)\", choose \"Quote status\", then choose \"Sent\", \"Approved\" or \"Paid\" and click \"Save the quote\". The status only marks the quote; it does not collect payment.",
          "A quote that is approved or signed by the client is locked for editing (\"Cannot edit a signed quote\"). When the client has paid, open the quote in the list, click \"Mark as paid\" and confirm. After marking it you cannot go back to \"Approved\", and a paid quote is fully locked."
        ]
      }
    },
    {
      "id": "email_not_received",
      "capabilityIds": [
        "quote_email"
      ],
      "he": {
        "task": "הלקוח לא קיבל את המייל",
        "steps": [
          "בודקים בכרטיס ההצעה שכתובת המייל של הלקוח נכונה. נקודה אדומה ליד המייל אומרת שהכתובת אינה קיימת או שהשליחה נכשלה.",
          "מבקשים מהלקוח לבדוק גם בתיקיית הספאם או דואר הזבל.",
          "אפשר לשלוח שוב: ברשימת \"הצעות מחיר\" לוחצים \"פתיחה\" ליד ההצעה ואז \"שליחה במייל\", או לשלוח ב\"וואטסאפ\" או ב\"העתקה\"."
        ]
      },
      "en": {
        "task": "The client did not get the email",
        "steps": [
          "Check in the quote that the client's email address is correct. A red dot next to the email means the address does not exist or the send failed.",
          "Ask the client to check the spam or junk folder too.",
          "You can send again: in the \"Quotes\" list click \"Open\" next to the quote, then \"Email\" - or send it by \"WhatsApp\" or \"Copy\"."
        ]
      }
    }
  ],
  "addOns": [
    {
      "id": "smart_pack",
      "name": {
        "he": "חכם פלוס",
        "en": "SMART PACK"
      },
      "optional": true,
      "sameBillingPeriodAsMainPlan": true,
      "purchasable": {
        "IL": true,
        "INTERNATIONAL": true
      },
      "prices": {
        "IL": {
          "currency": "ILS",
          "month": "10.00",
          "year": "102.00",
          "taxIncluded": true
        },
        "INTERNATIONAL": {
          "currency": "USD",
          "month": "5.00",
          "year": "51.00"
        }
      },
      "includes": {
        "he": [
          "צ׳אט חכם שקורא את הנתונים של המשתמש (הצעות, לקוחות, קטלוג, משימות)",
          "צ׳אט קולי (שאלה בקול ותשובה מוקראת)",
          "הצעה חכמה עם AI, כולל הכתבה בקול",
          "הצעת מחיר מקובץ PDF או JPG, עם המחירים שלכם",
          "שיפור ההצעה: איך הלקוח יראה את ההצעה לפני השליחה",
          "צירוף קבצים להצעה"
        ],
        "en": [
          "A smart chat that reads the user's own data (quotes, clients, catalog, tasks)",
          "Voice chat (a spoken question and a read-aloud answer)",
          "An AI smart quote, including voice dictation",
          "A quote from a PDF or JPG file, with your own prices",
          "Improve quote: how your client will see the quote before you send it",
          "Files attached to a quote"
        ]
      },
      "comingSoon": {
        "he": [],
        "en": []
      }
    }
  ]
} as const;
