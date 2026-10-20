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
    "planSystemActive": false,
    "activationPhase": "off",
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
      "expires": false,
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
      "ai_quotas",
      "cancellation_refund_proration",
      "tax_beyond_il_inclusion",
      "attachments"
    ]
  },
  "billing": {
    "liveCheckoutAvailable": false,
    "paymentProcessingAvailable": false,
    "acceptedPaymentCurrencies": [],
    "paymentMethodsKnown": false
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
      "heDescription": "רשימת כל הצעות המחיר שנוצרו, עם חיפוש, סינון וסטטוס.",
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
      "heDescription": "יצירת הצעת מחיר חדשה. טיוטה ותצוגה מקדימה אינן משתמשות באחת מ-10 ההצעות של מסלול חינם. תבניות: בעורך ההצעה, מתחת לכפתור השמירה, יש „שמירה כתבנית (בלי פרטי לקוח)” - נשמרים הנושא והפריטים, בלי פרטי הלקוח. כדי להתחיל הצעה מתבנית: בתפריט „הצעה חדשה” בוחרים „התחלה מתבנית שמורה” ומשם בוחרים את התבנית.",
      "enDescription": "Create a new quote. Drafts and previews do not use one of the 10 quotes of the Free plan. Templates: in the quote editor, under the save button, there is \"Save as template (no customer details)\" - the subject and the items are saved, without the customer details. To start a quote from a template: in the \"New quote\" menu choose \"Start from a saved template\" and pick the template there.",
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
      "heDescription": "שכפול הצעת מחיר קיימת ליצירת הצעה חדשה מבוססת עליה.",
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
      "heLabel": "סטטוס הצעת מחיר",
      "enLabel": "Quote status",
      "heDescription": "סימון/צפייה בסטטוס הצעה (טיוטה/נשלח/אושר/שולם): אפשר לבחור אותו ידנית, והצעה בטיוטה מסומנת „נשלחה” אוטומטית כששולחים אותה בוואטסאפ (כשוואטסאפ נפתח) או במייל (אחרי שליחה מוצלחת). הסטטוס אינו גובה תשלום.",
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
      "heDescription": "הצעת מחיר חכמה עם AI (בתפריט „הצעה חדשה”): מתארים את העבודה במילים, וה-AI מציע שורות - תיאור, כמות ויחידה; מחיר רק כשהפריט קיים בקטלוג שלכם, אחרת המחיר נשאר ריק להזנה. בודקים, מתקנים ומאשרים לפני שמשהו נכנס להצעה; שום דבר לא נשמר או נשלח לבד. אפשר גם להכתיב את העבודה בקול (המיקרופון בפינת שדה התיאור) ולענות בקול על השאלות שהטיוטה שואלת.",
      "enDescription": "AI smart quote (in the \"New quote\" menu): describe the job in words and the AI suggests lines - description, quantity and unit; a price only when the item is in your catalog, otherwise the price stays empty for you to enter. You review, correct and approve before anything enters the quote; nothing is saved or sent on its own. You can also dictate the job by voice (the microphone in the corner of the description field) and answer the draft’s questions by voice.",
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
      "id": "measured_quote",
      "heLabel": "הצעת מחיר מקצועית/מדודה",
      "enLabel": "Measured professional quote",
      "heDescription": "הצעה לפי מידות: מוסיפים פריט ומודדים אותו במסך אחד (שטח, אורך, יחידות או מחיר קבוע; בס״מ או במטר, או כמות ידועה במ״ר / מ״א), ואז בודקים ומוסיפים להצעה. חלוקה לחדרים/אזורים/יחידות היא אפשרות לבחירה.",
      "enDescription": "Measured quote: add an item and measure it on one screen (area, length, units or a fixed price; in cm or m, or a known quantity in m² / linear m), then check it and add it to the quote. Grouping into rooms/areas/units is optional.",
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
      "heDescription": "הוספה, עריכה וצפייה בלקוחות.",
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
      "heDescription": "ניהול קטלוג פריטים/שירותים לשימוש חוזר בהצעות מחיר.",
      "enDescription": "Managing a catalog of items/services for reuse across quotes.",
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
      "heDescription": "הערכת שווי מתכות יקרות (זהב/כסף/פלטינה/פלדיום/רודיום) - הנחות מחיר קבועות מוכפלות בשער דולר/שקל חי, לא הזנה חיה של שער מתכות עצמו.",
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
      "heDescription": "טלפון עסקי (וב-שוק המקומי גם ח.פ./עוסק) נדרשים לפני יצירת הצעה ראשונה.",
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
      "heDescription": "מסלול חינם כולל 10 הצעות בסך הכול, ללא תפוגה. אחריהן יש מסלול אחד שכולל את כל היכולות הזמינות, בתשלום חודשי או שנתי: 30.00 ₪ לחודש או 306.00 ₪ לשנה, כולל מע״מ. מערכת המנויים החדשה עדיין בהכנה.",
      "enDescription": "The Free plan includes 10 quotes in total, valid without an expiry date. After them there is one package with every available capability, billed monthly or annually: 18.00 USD per month or 184.00 USD per year, charged in USD. The new subscription system is still being prepared.",
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
      "heDescription": "צירוף קבצים/שרטוטים להצעת מחיר.",
      "enDescription": "Attaching files/drawings to a quote.",
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
      "heDescription": "הצעה שפג תוקפה נשארת צפויה לצפייה אך אינה ניתנת לחתימה.",
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
      "heDescription": "שחזור עבודה שלא נשמרה בעורך ההצעה לאחר רענון/מעבר אפליקציה - שמור מקומית בדפדפן בלבד, לא בענן.",
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
      "heLabel": "כלי נגישות",
      "enLabel": "Accessibility tools",
      "heDescription": "תפריט נגישות (גודל טקסט, ניגודיות ועוד) הזמין בכל מסך.",
      "enDescription": "An accessibility menu (text size, contrast, and more) available on every screen.",
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
      "heDescription": "מסך סטטיסטיקה: כמה הצעות נוצרו, נשלחו, אושרו ושולמו, שיעור ההמרה, ורשימת הצעות חמות (נצפו 3 פעמים או יותר וממתינות לאישור) עם פעולות ידניות: צפייה בהצעה (נפתחת בלשונית חדשה), WhatsApp, שליחה במייל ויצירת משימת מעקב. סכומים מוצגים לכל מטבע בנפרד, לפי תקופה וסטטוס. פותחים אותו מהתפריט „סטטיסטיקה” (בנייד: „עוד” ← „סטטיסטיקה”).",
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
      "heDescription": "הגדרות עסק ← תזכורות ואוטומציות: בוחרים אחד משלושה מצבים - „בממשק בלבד” (ברירת המחדל: התזכורות מופיעות אצלכם בפעמון), „כבוי”, או „מלא, כולל שליחה ללקוח”, שנדלק רק בבחירה מפורשת שלכם. מסמנים בתיבות סימון אילו התנהגויות יפעלו. אפשר להגדיר כלל ללקוח (ימים, תוכן, שעות שליחה ואזור זמן, עם תצוגה מקדימה והשהיה), ושליחה אוטומטית ללקוחות תיפתח בהמשך; בינתיים הודעות ללקוח נשלחות על ידכם, מתוך ההצעה. WhatsApp נשלח ידנית מתוך ההצעה.",
      "enDescription": "Business settings → Reminders & automation: you choose one of three modes - “In-app only” (the default: reminders appear for you under the bell), “Off”, or “Full, including customer sending”, which turns on only by your explicit choice. You tick which behaviors run. You can set up a customer rule (days, content, sending hours and a time zone, with a preview and a pause), and automatic sending to customers opens later; until then, messages to a customer are sent by you from the quote. WhatsApp is sent manually from the quote.",
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
      ]
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
      "id": "business_logo_and_details",
      "capabilityIds": [
        "business_settings",
        "profile_prerequisites"
      ],
      "he": {
        "task": "הוספת לוגו ועדכון פרטי העסק",
        "steps": [
          "בתפריט הצד לוחצים על \"הגדרות העסק\".",
          "בשדה \"כתובת תמונת לוגו (URL) או העלאת קובץ\" לוחצים \"העלה קובץ\" ובוחרים קובץ PNG, JPG או SVG עד 500KB.",
          "באותו מסך ממלאים את פרטי העסק, למשל \"טלפון עסק\" ו\"ח.פ / עוסק מורשה\".",
          "לוחצים \"שמור הגדרות עסק\"."
        ]
      },
      "en": {
        "task": "Adding a logo and updating the business details",
        "steps": [
          "In the sidebar click \"Business Settings\".",
          "In the \"Logo Image URL or File Upload\" field click \"Upload File\" and choose a PNG, JPG or SVG file up to 500KB.",
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
          "לוחצים \"הצעה חדשה\" ובוחרים \"הצעת מחיר רגילה\".",
          "בשלב \"למי ההצעה?\" ממלאים את פרטי הלקוח ובוחרים \"סוג לקוח (חובה)\".",
          "בשלב \"מה העבודה או המוצר?\" מוסיפים פריטים: כותבים תיאור, או בוחרים מהקטלוג (\"בחר שירות מהקטלוג...\").",
          "בשלב \"מחיר\" ממלאים כמות ומחיר.",
          "בשלב \"בדיקה ושמירה\" לוחצים \"הפק ושמור בענן\". כל הצעה חדשה נשמרת כטיוטה, ואחרי השמירה אפשר לשלוח אותה."
        ]
      },
      "en": {
        "task": "Creating a quote (including the first one)",
        "steps": [
          "Before the first quote a business phone is required in \"Business Settings\".",
          "Click \"New quote\" and choose \"Standard quote\".",
          "In the \"Who is it for?\" step fill in the client details and choose the client type.",
          "In the \"What work or product?\" step add items: type a description, or pick from the catalog (\"Choose from catalog...\").",
          "In the \"Price\" step enter the quantity and the price.",
          "In the \"Review and save\" step click \"Generate & Save to Cloud\". Every new quote is saved as a draft; after saving you can send it."
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
          "בוחרים \"שלח במייל\", \"וואטסאפ\", או \"העתקת הודעה\" (מעתיק הודעה עם הקישור להצעה, להדבקה בכל מקום).",
          "הצעה בטיוטה מסומנת \"נשלח\" אוטומטית אחרי שליחה במייל או פתיחת וואטסאפ."
        ]
      },
      "en": {
        "task": "Sending a quote to a client",
        "steps": [
          "In the sidebar click \"Quotes\" and find the quote in the list.",
          "Click \"Open\" next to the quote.",
          "Choose \"Email\", \"WhatsApp\", or \"Copy message\" (copies a message with the quote link to paste anywhere).",
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
          "ברשימת \"הצעות מחיר\" לוחצים \"פתיחה\" ליד ההצעה ואז \"צפה\", כדי לראות את ההצעה כמו שהלקוח רואה אותה.",
          "לוחצים \"הורד כ-PDF\". את הקובץ אפשר גם להדפיס."
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
          "בעורך ההצעה, מתחת לכפתור השמירה, לוחצים \"שמירה כתבנית (בלי פרטי לקוח)\". נשמרים הנושא והפריטים, בלי פרטי הלקוח.",
          "כדי להתחיל מתבנית: לוחצים \"הצעה חדשה\", בוחרים \"מתבנית שמורה\" ובוחרים את התבנית."
        ]
      },
      "en": {
        "task": "Saving a quote as a template and starting from a template",
        "steps": [
          "In the quote editor, under the save button, click \"Save as template (no customer details)\". The subject and the items are saved, without the customer details.",
          "To start from a template: click \"New quote\", choose \"From a saved template\" and pick the template."
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
          "לוחצים \"הצעה חדשה\" ובוחרים \"הצעת מחיר חכמה עם AI\".",
          "מתארים את העבודה במילים, או מכתיבים בקול בלחיצה על המיקרופון בפינת השדה.",
          "ה-AI מציע שורות. בודקים, מתקנים ומאשרים לפני שמשהו נכנס להצעה. מחיר מוצע רק לפריט שקיים בקטלוג."
        ]
      },
      "en": {
        "task": "An AI smart quote",
        "steps": [
          "Click \"New quote\" and choose \"AI smart quote\".",
          "Describe the job in words, or dictate it by clicking the microphone in the corner of the field.",
          "The AI suggests lines. Review, correct and approve before anything enters the quote. A price is suggested only for an item that is in your catalog."
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
          "בעורך ההצעה, בשלב \"בדיקה ושמירה\", פותחים את \"פרטים נוספים (לא חובה)\".",
          "בקטע \"קבצים מצורפים / שרטוטים\" לוחצים על כפתור צירוף הקובץ ובוחרים את הקובץ.",
          "שומרים את ההצעה."
        ]
      },
      "en": {
        "task": "Attaching a file to a quote",
        "steps": [
          "In the quote editor, in the \"Review and save\" step, open \"More details (optional)\".",
          "In the \"Attachments\" section click the attach-file button and choose the file.",
          "Save the quote."
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
          "ממלאים את הפרטים ושומרים. לקוח נוצר גם אוטומטית כששומרים הצעה ללקוח חדש."
        ]
      },
      "en": {
        "task": "Adding a client",
        "steps": [
          "In the sidebar click \"Clients\" and then \"New Client\".",
          "Fill in the details and save. A client is also created automatically when you save a quote for a new client."
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
          "בתפריט הצד לוחצים על \"קטלוג\" ואז \"הוסף פריט\".",
          "ממלאים שם ומחיר ולוחצים \"שמור\". הפריט יופיע בבחירה מהקטלוג בעורך ההצעה."
        ]
      },
      "en": {
        "task": "Adding a catalog item",
        "steps": [
          "In the sidebar click \"Catalog\" and then \"Add Item\".",
          "Fill in a name and a price and click \"Save\". The item appears in the catalog picker of the quote editor."
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
          "משימה שבוצעה מסמנים כהושלמה; היא עוברת ללשונית \"הושלמו\". משימות פתוחות בלשונית \"פתוחות\". אפשר גם למחוק משימה."
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
          "מזינים את כתובת האימייל ולוחצים \"שלח קישור לשחזור\".",
          "בקישור שמגיע במייל מזינים \"סיסמה חדשה\" ולוחצים \"עדכן סיסמה ושמור\"."
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
          "הצעה שהלקוח חתם עליה נעולה: אי אפשר לערוך או למחוק אותה (\"לא ניתן לערוך הצעה חתומה\"). אפשר לשכפל אותה (\"שכפל\") וליצור ממנה הצעה חדשה."
        ]
      },
      "en": {
        "task": "Why a signed quote cannot be edited",
        "steps": [
          "A quote the client signed is locked: it cannot be edited or deleted (\"Cannot edit a signed quote\"). You can duplicate it (\"Duplicate\") and create a new quote from it."
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
      "purchasable": false,
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
          "צירוף קבצים להצעה"
        ],
        "en": [
          "A smart chat that reads the user's own data (quotes, clients, catalog, tasks)",
          "Voice chat (a spoken question and a read-aloud answer)",
          "An AI smart quote, including voice dictation",
          "Files attached to a quote"
        ]
      },
      "comingSoon": {
        "he": [
          "התאום הדיגיטלי של הלקוח"
        ],
        "en": [
          "Customer Twin"
        ]
      }
    }
  ]
} as const;
