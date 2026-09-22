// GENERATED FILE - do not hand-edit.
// Regenerate with: node scripts/generate-ai-chat-facts.js
// Source of truth: src/utils/pricingCatalog.js, src/utils/planCatalog.js,
// src/shared/brand.js, src/utils/regionConfig.js (plus two parity-tested
// literals documented in scripts/generate-ai-chat-facts.js).
// Staleness is enforced by supabase/functions/chat-ai/aiFacts.parity.test.js.
export const AI_FACTS = {
  "schemaVersion": 1,
  "supportEmail": {
    "he": "support@tekango.com",
    "en": "info@tekango.com"
  },
  "vatRate": {
    "il": 0.18,
    "international": 0
  },
  "trialDays": 14,
  "quoteLimits": {
    "free": 5,
    "basic": 20,
    "pro": "unlimited"
  },
  "attachments": {
    "proOnly": true,
    "maxFileMb": 3,
    "maxTotalMb": 30
  },
  "pricing": {
    "il": {
      "currency": "ILS",
      "currencySymbol": "₪",
      "plans": {
        "free": {
          "monthly": 0
        },
        "basic": {
          "monthly": 49,
          "annualEffectiveMonthly": 39,
          "annualTotal": 468,
          "savingsPercent": 20
        },
        "pro": {
          "monthly": 99,
          "annualEffectiveMonthly": 79,
          "annualTotal": 948,
          "savingsPercent": 20
        }
      }
    },
    "usd": {
      "currency": "USD",
      "currencySymbol": "$",
      "plans": {
        "free": {
          "monthly": 0
        },
        "basic": {
          "monthly": 15,
          "annualEffectiveMonthly": 12,
          "annualTotal": 144,
          "savingsPercent": 20
        },
        "pro": {
          "monthly": 29,
          "annualEffectiveMonthly": 23,
          "annualTotal": 276,
          "savingsPercent": 21
        }
      }
    },
    "gbp": {
      "currency": "GBP",
      "currencySymbol": "£",
      "plans": {
        "free": {
          "monthly": 0
        },
        "basic": {
          "monthly": 12,
          "annualEffectiveMonthly": 10,
          "annualTotal": 120,
          "savingsPercent": 17
        },
        "pro": {
          "monthly": 24,
          "annualEffectiveMonthly": 19,
          "annualTotal": 228,
          "savingsPercent": 21
        }
      }
    },
    "eur": {
      "currency": "EUR",
      "currencySymbol": "€",
      "plans": {
        "free": {
          "monthly": 0
        },
        "basic": {
          "monthly": 14,
          "annualEffectiveMonthly": 11,
          "annualTotal": 132,
          "savingsPercent": 21
        },
        "pro": {
          "monthly": 27,
          "annualEffectiveMonthly": 22,
          "annualTotal": 264,
          "savingsPercent": 19
        }
      }
    }
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "heDescription": "יצירת הצעת מחיר חדשה, כפופה למגבלת ההצעות החודשית של התוכנית.",
      "enDescription": "Create a new quote, subject to the plan's monthly quote limit.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": "free",
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_new_quote",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": [
        "monthlyQuoteLimit"
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
      "planAvailability": {
        "free": false,
        "basic": true,
        "pro": true
      },
      "minimumPlan": "basic",
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
      "planAvailability": {
        "free": false,
        "basic": true,
        "pro": true
      },
      "minimumPlan": "basic",
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
      "heDescription": "סימון/צפייה בסטטוס הצעה (טיוטה/נשלח/אושר/שולם) - תווית ידנית, אינה גובה תשלום.",
      "enDescription": "Viewing/setting a quote's status (Draft/Sent/Approved/Paid) - a manual label, it does not collect payment.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "heDescription": "תהליך יצירת הצעה מודרך בארבעה שלבים (למי / מה / מחיר / סקירה ושמירה), ללא חובת מבנה-חדרים.",
      "enDescription": "A four-step guided quote-creation flow (who / what / price / review & save), with no compulsory room/area structure.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "heDescription": "הצעות מחיר מקצועיות עם מבנה מדוד (חדרים/אזורים/יחידות).",
      "enDescription": "Professional quotes with a measured structure (rooms/areas/units).",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "planAvailability": {
        "free": false,
        "basic": true,
        "pro": true
      },
      "minimumPlan": "basic",
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
      "planAvailability": {
        "free": false,
        "basic": false,
        "pro": true
      },
      "minimumPlan": "pro",
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_business_phone",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": []
    },
    {
      "id": "plan_trial",
      "heLabel": "ניסיון חינם",
      "enLabel": "14-day free trial",
      "heDescription": "ניסיון חינם של 14 יום המעניק זכאות PRO זמנית - אינו תוכנית נמכרת בפני עצמה.",
      "enDescription": "A 14-day free trial granting temporary PRO entitlement - not a sellable plan in its own right.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_plan_information",
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": [
        "trialDays"
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
      "planAvailability": {
        "free": false,
        "basic": false,
        "pro": true
      },
      "minimumPlan": "pro",
      "aiMayExplain": true,
      "aiMayNavigate": false,
      "safeNavigationId": null,
      "aiMayClaimExecution": false,
      "forbiddenClaimCodes": [],
      "deterministicFactKeys": [
        "attachments.maxFileMb",
        "attachments.maxTotalMb"
      ]
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": false,
        "basic": false,
        "pro": true
      },
      "minimumPlan": "pro",
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
        "local"
      ],
      "currencies": null,
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "heDescription": "עוזר AI זמין בתוך האפליקציה, שמסביר את המוצר ומנווט לפי בקשה - קריאה בלבד, לעולם לא מבצע פעולה בעצמו.",
      "enDescription": "An in-app AI assistant that explains the product and navigates on request - read-only, it never performs an action itself.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
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
      "heDescription": "מסך ניהול פנימי לבעל עסק/Super Admin בלבד - לא חלק ממרחב העבודה של משתמש רגיל.",
      "enDescription": "An internal admin screen for the business owner/Super Admin only - not part of an ordinary user's workspace.",
      "state": "LIVE_CURRENT",
      "markets": [
        "local",
        "international"
      ],
      "currencies": null,
      "planAvailability": {
        "free": true,
        "basic": true,
        "pro": true
      },
      "minimumPlan": null,
      "aiMayExplain": true,
      "aiMayNavigate": true,
      "safeNavigationId": "open_admin",
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
    }
  ]
} as const;
