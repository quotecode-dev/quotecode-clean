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
  }
} as const;
