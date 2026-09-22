// PRODUCT TRUTH REGISTRY — curated source (hand-maintained).
//
// Implements TEKANGO_AI_ARCHITECTURE.md v2.5 §52 (the canonical Codex "TEKANGO Product Truth
// Registry review"): the 38 user-visible candidate capabilities Codex enumerated, plus the 4
// non-current capability states already tracked elsewhere in the canonical doc. This is the
// HYBRID GENERATED REGISTRY's curated half (§52.7) — labels, descriptions, state, surfaces,
// forbidden-claim codes and evidence pointers are hand-maintained here; plan/entitlement and
// market facts are DERIVED at generation time (scripts/generate-ai-chat-facts.js) from
// src/utils/planCatalog.js / src/utils/accountEntitlement.js / src/utils/regionConfig.js —
// never re-typed here. Do not hand-duplicate a plan boolean in this file (L6 "PRODUCT TRUTH:
// ONE SOURCE", TEKANGO_AI_ARCHITECTURE.md §5).
//
// LOCKED: the 38 IDs below are frozen from §52.2. Do not silently add/remove/split/merge an ID —
// any such change requires a fresh canonical-doc update first (§52 change-control, mirroring §41).
//
// Known discrepancy, reported (not silently resolved) per the Owner's task instruction: real
// source (src/pages/Dashboard.jsx handleProtectedAction) shows the SAME entitlement flag
// (`whatsappDelete` in planCatalog.js) gates BOTH the owner's WhatsApp-share action or the
// unqualified capability's "delete" action; the CANONICAL Product Truth Registry review the
// Codex Register was based on records these as two separate ORIGIN- and OTHER-facing findings
// under the OWNER_WHATSAPP_SHARE capability id only — quote deletion itself has no dedicated id
// among the 38. This registry therefore attaches the whatsappDelete-derived "quote deletion is
// PRO" fact to `owner_whatsapp_share.deterministicFactKeys` (not a new id) and records the
// discrepancy again in this file's own test suite instead of expanding the frozen inventory.

/** @typedef {'LIVE_CURRENT'|'FIRST_LIVE_CANDIDATE'|'TEST_ONLY'|'IMPLEMENTED_NOT_RELEASED'|'ROADMAP_POST_LIVE'|'UNAVAILABLE'|'DEPRECATED'} CapabilityState */

export const CAPABILITY_STATES = Object.freeze({
  LIVE_CURRENT: 'LIVE_CURRENT',
  FIRST_LIVE_CANDIDATE: 'FIRST_LIVE_CANDIDATE',
  TEST_ONLY: 'TEST_ONLY',
  IMPLEMENTED_NOT_RELEASED: 'IMPLEMENTED_NOT_RELEASED',
  ROADMAP_POST_LIVE: 'ROADMAP_POST_LIVE',
  UNAVAILABLE: 'UNAVAILABLE',
  DEPRECATED: 'DEPRECATED',
});

// The exact 38 canonical IDs, in the order Codex reviewed them (§52.2). Frozen.
export const CANONICAL_38_IDS = Object.freeze([
  'dashboard_overview', 'quote_history', 'quote_create', 'quote_edit', 'quote_duplicate', 'quote_status',
  'smart_quote', 'measured_quote', 'professional_reuse', 'clients', 'catalog', 'finance_views', 'expenses',
  'quote_csv', 'expense_csv', 'editor_calculator', 'editor_currency_converter', 'public_currency_converter',
  'public_unit_converter', 'public_metals_calculator', 'public_crypto_calculator', 'business_settings',
  'profile_prerequisites', 'plan_trial', 'attachments', 'quote_pdf', 'quote_print', 'quote_email',
  'owner_whatsapp_share', 'public_whatsapp_contact', 'public_call', 'public_quote_view', 'public_quote_sign',
  'quote_expiry', 'draft_recovery', 'accessibility_tools', 'ai_chat', 'admin_console',
]);

// The 4 non-current entries (§52.2), outside the 38. Their state/facts are derived at generation
// time from AI_FACTS.billing / AI_FACTS.invoicing (payment/invoicing) — never duplicated here as
// a second boolean; this record only carries the curated label/description/forbidden-claim shape.
export const NON_CURRENT_IDS = Object.freeze(['payment_processing', 'invoicing', 'autonomous_email', 'ai_mutation']);

const REV = '2c584f6d910b130bd446183b41e94bda35a5900f'; // candidate this registry was authored/verified against (tekango-rc-ironlaw-2026-09-22)

/**
 * Factory keeping every entry's field set identical (the "equivalent fields" requirement)
 * without hand-repeating 20 keys x 38 entries. Every field the Owner's task requires is present
 * on the returned object, defaulted where a capability genuinely has none (e.g. no plan gate).
 */
function capability(id, heLabel, enLabel, heDescription, enDescription, opts = {}) {
  return Object.freeze({
    id,
    heLabel,
    enLabel,
    heDescription,
    enDescription,
    state: opts.state || CAPABILITY_STATES.LIVE_CURRENT,
    surfaces: Object.freeze(opts.surfaces || []),
    markets: Object.freeze(opts.markets || ['local', 'international']),
    // currencies: null (no currency role) or { role: 'quote'|'payment'|'display'|'conversion_only', values: [...] }
    currencies: opts.currencies || null,
    entitlementKey: opts.entitlementKey ?? null, // a real src/utils/planCatalog.js entitlements field name, or null
    minimumPlan: opts.minimumPlan ?? null, // 'free'|'basic'|'pro'|null — cross-checked at generation time against entitlementKey
    trialAvailable: opts.trialAvailable ?? true, // whether the 14-day trial grants this (trial = temporary PRO entitlement, §5 L-none/AI_FACTS.trialDays)
    operationType: opts.operationType || 'read', // 'read'|'mutate'
    userActionAvailable: opts.userActionAvailable ?? true,
    aiMayExplain: opts.aiMayExplain ?? true,
    aiMayNavigate: opts.aiMayNavigate ?? false,
    aiMayClaimExecution: false, // hard invariant — the AI never claims it performed a mutating action (§52.8, task item 4)
    safeNavigationId: opts.safeNavigationId ?? null, // must be one of _shared/aiHelpContract.js NAV_ACTIONS, or null
    deterministicFactKeys: Object.freeze(opts.deterministicFactKeys || []),
    forbiddenClaimCodes: Object.freeze(opts.forbiddenClaimCodes || []),
    canonicalSources: Object.freeze(opts.canonicalSources || []),
    tests: Object.freeze(opts.tests || ['src/data/productTruthRegistry.test.js', 'supabase/functions/chat-ai/capabilityTruth.test.js']),
    lastVerifiedRevision: opts.lastVerifiedRevision || REV,
    releaseEnvironment: opts.releaseEnvironment ?? 'test',
  });
}

export const PRODUCT_TRUTH_REGISTRY = Object.freeze([
  capability('dashboard_overview', 'לוח בקרה', 'Dashboard overview',
    'מסך הבית לאחר התחברות - סיכום הצעות מחיר, פעולות מהירות וניווט לשאר המערכת.',
    'The signed-in home screen - a summary of quotes, quick actions, and navigation to the rest of the app.',
    { surfaces: ['dashboard'], aiMayNavigate: true, safeNavigationId: 'open_dashboard', canonicalSources: ['src/pages/Dashboard.jsx'] }),

  capability('quote_history', 'היסטוריית הצעות מחיר', 'Quote history',
    'רשימת כל הצעות המחיר שנוצרו, עם חיפוש, סינון וסטטוס.',
    'The list of every quote created, with search, filtering, and status.',
    { surfaces: ['quote_history_screen'], aiMayNavigate: true, safeNavigationId: 'open_quote_history', canonicalSources: ['src/components/QuotesTab.jsx'] }),

  capability('quote_create', 'יצירת הצעת מחיר חדשה', 'Create a new quote',
    'יצירת הצעת מחיר חדשה, כפופה למגבלת ההצעות החודשית של התוכנית.',
    'Create a new quote, subject to the plan\'s monthly quote limit.',
    {
      surfaces: ['dashboard', 'quote_editor'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_new_quote',
      entitlementKey: 'monthlyQuoteLimit', deterministicFactKeys: ['monthlyQuoteLimit'],
      canonicalSources: ['src/components/QuoteForm.jsx', 'src/utils/planCatalog.js'],
    }),

  capability('quote_edit', 'עריכת הצעה שמורה', 'Edit a saved quote',
    'עריכת הצעת מחיר שכבר נשמרה.',
    'Edit a quote that has already been saved.',
    {
      surfaces: ['quote_editor'], operationType: 'mutate', minimumPlan: 'basic', entitlementKey: 'editDuplicate',
      aiMayNavigate: true, safeNavigationId: 'open_selected_quote', canonicalSources: ['src/components/QuoteForm.jsx', 'src/pages/Dashboard.jsx'],
    }),

  capability('quote_duplicate', 'שכפול הצעת מחיר', 'Duplicate a quote',
    'שכפול הצעת מחיר קיימת ליצירת הצעה חדשה מבוססת עליה.',
    'Duplicate an existing quote to start a new one from it.',
    { surfaces: ['quote_history_screen'], operationType: 'mutate', minimumPlan: 'basic', entitlementKey: 'editDuplicate', canonicalSources: ['src/pages/Dashboard.jsx'] }),

  capability('quote_status', 'סטטוס הצעת מחיר', 'Quote status',
    'סימון/צפייה בסטטוס הצעה (טיוטה/נשלח/אושר/שולם) - תווית ידנית, אינה גובה תשלום.',
    'Viewing/setting a quote\'s status (Draft/Sent/Approved/Paid) - a manual label, it does not collect payment.',
    { surfaces: ['quote_editor', 'quote_history_screen'], operationType: 'mutate', forbiddenClaimCodes: ['NO_PAID_STATUS_AS_PAYMENT_COLLECTION'], canonicalSources: ['src/components/QuotesTab.jsx'] }),

  capability('smart_quote', 'הצעת מחיר חכמה', 'Smart Quote flow',
    'תהליך יצירת הצעה מודרך בארבעה שלבים (למי / מה / מחיר / סקירה ושמירה), ללא חובת מבנה-חדרים.',
    'A four-step guided quote-creation flow (who / what / price / review & save), with no compulsory room/area structure.',
    { surfaces: ['quote_editor'], operationType: 'mutate', deterministicFactKeys: [], canonicalSources: ['src/components/QuoteForm.jsx'] }),

  capability('measured_quote', 'הצעת מחיר מקצועית/מדודה', 'Measured professional quote',
    'הצעות מחיר מקצועיות עם מבנה מדוד (חדרים/אזורים/יחידות).',
    'Professional quotes with a measured structure (rooms/areas/units).',
    { surfaces: ['quote_editor'], operationType: 'mutate', minimumPlan: 'basic', entitlementKey: 'professionalQuotes', canonicalSources: ['src/components/QuoteForm.jsx'] }),

  capability('professional_reuse', 'שימוש חוזר מקצועי בפריטים', 'Advanced professional item reuse',
    'שימוש חוזר מתקדם בפריטים מקצועיים בין הצעות מחיר.',
    'Advanced reuse of professional items across quotes.',
    { surfaces: ['quote_editor'], operationType: 'mutate', minimumPlan: 'pro', entitlementKey: 'professionalQuoteReuse', canonicalSources: ['src/components/QuoteForm.jsx'] }),

  capability('clients', 'ניהול לקוחות', 'Client management',
    'הוספה, עריכה וצפייה בלקוחות.',
    'Adding, editing, and viewing clients.',
    { surfaces: ['clients_screen'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_clients', canonicalSources: ['src/components/ClientsTab.jsx', 'src/components/EditClientModal.jsx'] }),

  capability('catalog', 'קטלוג שירותים', 'Services catalog',
    'ניהול קטלוג פריטים/שירותים לשימוש חוזר בהצעות מחיר.',
    'Managing a catalog of items/services for reuse across quotes.',
    { surfaces: ['catalog_screen'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_catalog', canonicalSources: ['src/components/ServicesCatalog.jsx'] }),

  capability('finance_views', 'תצוגות פיננסיות', 'Finance views',
    'צפייה בסיכומי הכנסות/הוצאות ומדדים פיננסיים.',
    'Viewing income/expense summaries and financial KPIs.',
    { surfaces: ['finances_screen'], aiMayNavigate: true, safeNavigationId: 'open_finances', canonicalSources: ['src/components/FinancesTab.jsx'] }),

  capability('expenses', 'ניהול הוצאות', 'Expense management',
    'הוספה ועריכה של הוצאות עסקיות.',
    'Adding and editing business expenses.',
    { surfaces: ['finances_screen'], operationType: 'mutate', canonicalSources: ['src/components/FinancesTab.jsx'] }),

  capability('quote_csv', 'ייצוא הצעות ל-CSV', 'Quote CSV export',
    'ייצוא רשימת הצעות המחיר לקובץ CSV.',
    'Exporting the quote list to a CSV file.',
    { surfaces: ['quote_history_screen'], canonicalSources: ['src/components/QuotesTab.jsx'] }),

  capability('expense_csv', 'ייצוא הוצאות ל-CSV', 'Expense CSV export',
    'ייצוא רשימת ההוצאות לקובץ CSV.',
    'Exporting the expense list to a CSV file.',
    { surfaces: ['finances_screen'], canonicalSources: ['src/components/FinancesTab.jsx'] }),

  capability('editor_calculator', 'מחשבון בעורך ההצעה', 'In-editor calculator',
    'מחשבון עם ארבע פעולות חשבון, שורש, אחוזים, שינוי סימן, זיכרון והמרת מטבע, פתוח מתוך עורך ההצעה.',
    'A calculator with arithmetic, square root, percent, sign change, memory, and currency conversion, opened from the quote editor.',
    {
      surfaces: ['quote_editor'], currencies: { role: 'conversion_only', values: ['USD', 'EUR', 'GBP', 'ILS'] },
      forbiddenClaimCodes: ['NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP', 'NO_CONVERSION_CURRENCY_AS_PAYMENT_CURRENCY'],
      canonicalSources: ['src/components/DraggableCalculator.jsx'],
    }),

  capability('editor_currency_converter', 'המרת מטבע בעורך ההצעה', 'In-editor currency converter',
    'המרת מטבע בין USD/EUR/GBP (ו-ILS בהצעות מקומיות) בתוך מחשבון העורך.',
    'Currency conversion between USD/EUR/GBP (plus ILS for Local quotes) inside the editor calculator.',
    {
      surfaces: ['quote_editor'], currencies: { role: 'conversion_only', values: ['USD', 'EUR', 'GBP', 'ILS'] },
      forbiddenClaimCodes: ['NO_LIVE_RATE_CLAIM_WITHOUT_TIMESTAMP', 'NO_CONVERSION_CURRENCY_AS_PAYMENT_CURRENCY'],
      canonicalSources: ['src/components/DraggableCalculator.jsx'],
    }),

  capability('public_currency_converter', 'ממיר מטבעות ציבורי', 'Public currency converter',
    'כלי ציבורי (ללא התחברות) להמרת מטבעות, בעמוד הכלים הציבוריים.',
    'A public (no login) currency-conversion tool on the public tools page.',
    {
      surfaces: ['public_tools_page'], currencies: { role: 'conversion_only', values: ['ILS', 'USD', 'EUR', 'GBP', 'and other live-fetched currencies'] },
      forbiddenClaimCodes: ['NO_CONVERSION_CURRENCY_AS_QUOTE_OR_SUBSCRIPTION_CURRENCY'],
      canonicalSources: ['src/components/PublicTools.jsx', 'src/components/PublicToolsEn.jsx'],
    }),

  capability('public_unit_converter', 'ממיר יחידות ציבורי', 'Public unit converter',
    'כלי ציבורי להמרת יחידות מידה (אורך, שטח, משקל ועוד).',
    'A public unit-of-measure converter (length, area, weight, and more).',
    { surfaces: ['public_tools_page'], canonicalSources: ['src/components/PublicTools.jsx', 'src/components/PublicToolsEn.jsx'] }),

  capability('public_metals_calculator', 'מחשבון מתכות ציבורי', 'Public metals calculator',
    'הערכת שווי מתכות יקרות (זהב/כסף/פלטינה/פלדיום/רודיום) - הנחות מחיר קבועות מוכפלות בשער דולר/שקל חי, לא הזנה חיה של שער מתכות עצמו.',
    'An estimate of precious-metals value (gold/silver/platinum/palladium/rhodium) - fixed per-gram assumptions multiplied by a live USD/ILS rate, not an independent live metals feed.',
    {
      surfaces: ['public_tools_page'], currencies: { role: 'conversion_only', values: ['ILS'] },
      forbiddenClaimCodes: ['NO_LIVE_METALS_FEED_CLAIM'], deterministicFactKeys: ['metalsAreEstimateNotLiveFeed'],
      canonicalSources: ['src/components/PublicTools.jsx', 'src/components/PublicToolsEn.jsx'],
    }),

  capability('public_crypto_calculator', 'מחשבון קריפטו ציבורי', 'Public crypto calculator',
    'המרת מטבעות קריפטו (ביטקוין, את׳ריום ועוד) לפי שערים חיים מ-CoinGecko.',
    'Cryptocurrency conversion (Bitcoin, Ethereum, and more) using live rates from CoinGecko.',
    { surfaces: ['public_tools_page'], currencies: { role: 'conversion_only', values: ['USD'] }, canonicalSources: ['src/components/PublicTools.jsx', 'src/components/PublicToolsEn.jsx'] }),

  capability('business_settings', 'הגדרות עסק', 'Business settings',
    'עריכת פרטי העסק (שם, טלפון, ח.פ./עוסק, לוגו והגדרות נוספות).',
    'Editing business details (name, phone, tax/business ID, logo, and other settings).',
    { surfaces: ['settings_screen'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_business_settings', canonicalSources: ['src/components/SettingsTab.jsx'] }),

  capability('profile_prerequisites', 'דרישות פרופיל עסקי', 'Business profile prerequisites',
    'טלפון עסקי (וב-שוק המקומי גם ח.פ./עוסק) נדרשים לפני יצירת הצעה ראשונה.',
    'A business phone (and, in the Local market, a tax/business ID) are required before the first quote can be created.',
    {
      surfaces: ['settings_screen', 'quote_editor'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_business_phone',
      canonicalSources: ['src/components/SettingsTab.jsx', 'src/utils/regionConfig.js'],
    }),

  capability('plan_trial', 'ניסיון חינם', '14-day free trial',
    'ניסיון חינם של 14 יום המעניק זכאות PRO זמנית - אינו תוכנית נמכרת בפני עצמה.',
    'A 14-day free trial granting temporary PRO entitlement - not a sellable plan in its own right.',
    { surfaces: ['plans_screen'], aiMayNavigate: true, safeNavigationId: 'open_plan_information', deterministicFactKeys: ['trialDays'], canonicalSources: ['src/utils/accountEntitlement.js', 'src/components/PricingModal.jsx'] }),

  capability('attachments', 'צירוף קבצים', 'File attachments',
    'צירוף קבצים/שרטוטים להצעת מחיר.',
    'Attaching files/drawings to a quote.',
    {
      surfaces: ['quote_editor'], operationType: 'mutate', minimumPlan: 'pro', entitlementKey: 'attachments',
      deterministicFactKeys: ['attachments.maxFileMb', 'attachments.maxTotalMb'], canonicalSources: ['src/components/QuoteForm.jsx', 'src/utils/planCatalog.js'],
    }),

  capability('quote_pdf', 'PDF של הצעת מחיר', 'Quote PDF export',
    'ייצוא הצעת מחיר כקובץ PDF - מסמך הצעה, לא חשבונית.',
    'Exporting a quote as a PDF file - a quote document, not an invoice.',
    { surfaces: ['quote_editor', 'public_quote_page'], forbiddenClaimCodes: ['NO_INVOICE_CONFLATION'], canonicalSources: ['src/utils/generateQuotePdf.js'] }),

  capability('quote_print', 'הדפסת הצעת מחיר', 'Quote print',
    'הדפסה ישירה של הצעת מחיר.',
    'Printing a quote directly.',
    { surfaces: ['quote_editor', 'public_quote_page'], forbiddenClaimCodes: ['NO_INVOICE_CONFLATION'], canonicalSources: ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx'] }),

  capability('quote_email', 'שליחת הצעה במייל', 'Emailing a quote',
    'שליחת הצעת מחיר ללקוח במייל - שולחת את ההצעה, אינה מבצעת חיוב.',
    'Sending a quote to a client by email - sends the quote, does not bill or invoice.',
    { surfaces: ['quote_editor'], operationType: 'mutate', forbiddenClaimCodes: ['NO_INVOICE_CONFLATION', 'NO_PAYMENT_COLLECTION_CLAIM'], canonicalSources: ['supabase/functions/send-quote-email/index.ts'] }),

  capability('owner_whatsapp_share', 'שיתוף הצעה ב-WhatsApp (בעל העסק)', 'Owner WhatsApp share',
    'שיתוף הצעת מחיר ב-WhatsApp על ידי בעל העסק - שונה מפעולת יצירת הקשר של הצד המקבל בהצעה הציבורית.',
    'The business owner sharing a quote via WhatsApp - a different capability from the recipient\'s WhatsApp contact action on the public quote.',
    {
      surfaces: ['quote_editor', 'quote_history_screen'], minimumPlan: 'pro', entitlementKey: 'whatsappDelete',
      forbiddenClaimCodes: ['NO_OWNER_PUBLIC_WHATSAPP_CONFLATION'],
      // Known discrepancy (see file header): the same entitlementKey also gates quote deletion in real
      // source (src/pages/Dashboard.jsx handleProtectedAction), which has no dedicated id among the 38.
      deterministicFactKeys: ['quoteDeletionSharesThisEntitlement'],
      canonicalSources: ['src/pages/Dashboard.jsx', 'src/utils/planCatalog.js'],
    }),

  capability('public_whatsapp_contact', 'יצירת קשר ב-WhatsApp (צד מקבל)', 'Public quote WhatsApp contact',
    'כפתור יצירת קשר ב-WhatsApp עבור מקבל ההצעה בעמוד ההצעה הציבורי - שונה משיתוף ההצעה של בעל העסק.',
    'A WhatsApp contact button for the quote recipient on the public quote page - a different capability from the owner\'s quote share.',
    { surfaces: ['public_quote_page'], markets: ['local'], forbiddenClaimCodes: ['NO_OWNER_PUBLIC_WHATSAPP_CONFLATION'], canonicalSources: ['src/pages/PublicQuote.jsx'] }),

  capability('public_call', 'התקשרות מעמוד ההצעה', 'Public quote call action',
    'כפתור התקשרות טלפונית עבור מקבל ההצעה בעמוד ההצעה הציבורי.',
    'A call button for the quote recipient on the public quote page.',
    { surfaces: ['public_quote_page'], canonicalSources: ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx'] }),

  capability('public_quote_view', 'צפייה בהצעה ציבורית', 'Public quote viewing',
    'צפייה בהצעת מחיר על ידי הלקוח, ללא צורך בהתחברות, דרך קישור ייחודי.',
    'Viewing a quote as the client, no login required, via a unique link.',
    { surfaces: ['public_quote_page'], canonicalSources: ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx'] }),

  capability('public_quote_sign', 'חתימה על הצעה ציבורית', 'Public quote signing',
    'אישור/חתימה על הצעת מחיר על ידי הלקוח, בכפוף לתוקף ההצעה ולזהות המאשר.',
    'Approving/signing a quote as the client, subject to the quote\'s validity and the approver\'s identity.',
    { surfaces: ['public_quote_page'], operationType: 'mutate', canonicalSources: ['src/pages/PublicQuote.jsx', 'supabase/functions/get-public-quote/index.ts'] }),

  capability('quote_expiry', 'תפוגת הצעת מחיר', 'Quote expiry',
    'הצעה שפג תוקפה נשארת צפויה לצפייה אך אינה ניתנת לחתימה.',
    'An expired quote stays viewable but cannot be signed.',
    { surfaces: ['public_quote_page', 'quote_editor'], deterministicFactKeys: ['isExpired'], canonicalSources: ['supabase/functions/get-public-quote/index.ts'] }),

  capability('draft_recovery', 'שחזור טיוטה מקומית', 'Local draft recovery',
    'שחזור עבודה שלא נשמרה בעורך ההצעה לאחר רענון/מעבר אפליקציה - שמור מקומית בדפדפן בלבד, לא בענן.',
    'Restoring unsaved editor work after a refresh/app switch - stored locally in the browser only, never in the cloud.',
    { surfaces: ['quote_editor'], forbiddenClaimCodes: ['NO_LOCAL_DRAFT_AS_CLOUD_SAVED'], deterministicFactKeys: ['draftProvenance'], canonicalSources: ['src/utils/quoteDraft.js'] }),

  capability('accessibility_tools', 'כלי נגישות', 'Accessibility tools',
    'תפריט נגישות (גודל טקסט, ניגודיות ועוד) הזמין בכל מסך.',
    'An accessibility menu (text size, contrast, and more) available on every screen.',
    { surfaces: ['dashboard', 'public_quote_page', 'public_tools_page'], canonicalSources: ['src/components/AccessibilityModal.jsx'] }),

  capability('ai_chat', 'צ׳אט AI', 'AI Chat assistant',
    'עוזר AI זמין בתוך האפליקציה, שמסביר את המוצר ומנווט לפי בקשה - קריאה בלבד, לעולם לא מבצע פעולה בעצמו.',
    'An in-app AI assistant that explains the product and navigates on request - read-only, it never performs an action itself.',
    { surfaces: ['dashboard', 'quote_editor', 'clients_screen', 'catalog_screen', 'finances_screen', 'settings_screen', 'plans_screen', 'admin_screen'], aiMayNavigate: true, canonicalSources: ['src/AIChatWidget.jsx', 'supabase/functions/chat-ai/index.ts'] }),

  capability('admin_console', 'מסך ניהול', 'Admin console',
    'מסך ניהול פנימי לבעל עסק/Super Admin בלבד - לא חלק ממרחב העבודה של משתמש רגיל.',
    'An internal admin screen for the business owner/Super Admin only - not part of an ordinary user\'s workspace.',
    { surfaces: ['admin_screen'], aiMayNavigate: true, safeNavigationId: 'open_admin', canonicalSources: ['src/components/AdminUsersTab.jsx', 'src/components/UserDetailsModal.jsx'] }),
]);

// Non-current entries (§52.2) — curated shape only; their `state`/facts are computed at
// generation time in scripts/generate-ai-chat-facts.js from AI_FACTS.billing / AI_FACTS.invoicing,
// never duplicated here.
export const NON_CURRENT_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'payment_processing', heLabel: 'עיבוד תשלומים', enLabel: 'Payment processing',
    heDescription: 'קבלת תשלום/סליקה בתוך TEKANGO.', enDescription: 'Accepting payment/checkout inside TEKANGO.',
    forbiddenClaimCodes: ['NO_PAYMENT_CAPABILITY_CLAIM'], canonicalSources: ['supabase/functions/chat-ai/paymentTruth.ts', 'supabase/functions/chat-ai/aiFacts.generated.ts'],
  }),
  Object.freeze({
    id: 'invoicing', heLabel: 'הפקת חשבוניות', enLabel: 'Invoicing',
    heDescription: 'הפקת חשבונית/חשבונית מס/קבלה על ידי TEKANGO.', enDescription: 'Issuing an invoice/tax invoice/receipt from TEKANGO.',
    forbiddenClaimCodes: ['NO_INVOICING_CAPABILITY_CLAIM'], canonicalSources: ['supabase/functions/chat-ai/invoicingTruth.ts', 'supabase/functions/chat-ai/aiFacts.generated.ts'],
  }),
  Object.freeze({
    id: 'autonomous_email', heLabel: 'מענה אוטונומי במייל', enLabel: 'Autonomous email reply',
    heDescription: 'AI שקורא ועונה במייל ללקוחות באופן אוטונומי.', enDescription: 'AI reading and autonomously replying to customer email.',
    state: CAPABILITY_STATES.ROADMAP_POST_LIVE, forbiddenClaimCodes: ['NO_AUTONOMOUS_EMAIL_CLAIM'], canonicalSources: ['TEKANGO_AI_ARCHITECTURE.md'],
  }),
  Object.freeze({
    id: 'ai_mutation', heLabel: 'שינוי נתונים על ידי AI', enLabel: 'AI-executed data mutation',
    heDescription: 'ה-AI מבצע בעצמו שינוי/מחיקה/שליחה במקום המשתמש.', enDescription: 'The AI itself performing a change/deletion/send instead of the user.',
    state: CAPABILITY_STATES.ROADMAP_POST_LIVE, forbiddenClaimCodes: ['NO_AI_EXECUTION_CLAIM'], canonicalSources: ['TEKANGO_AI_ARCHITECTURE.md'],
  }),
]);

export function getCapabilityById(id) {
  return PRODUCT_TRUTH_REGISTRY.find((c) => c.id === id) || NON_CURRENT_REGISTRY.find((c) => c.id === id) || null;
}
