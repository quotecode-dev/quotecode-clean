// PRODUCT TRUTH REGISTRY — curated source (hand-maintained).
//
// Implements TEKANGO_AI_ARCHITECTURE.md v2.5 §52 (the canonical Codex "TEKANGO Product Truth
// Registry review"): the 38 user-visible candidate capabilities Codex enumerated, plus the 4
// non-current capability states already tracked elsewhere in the canonical doc. This is the
// HYBRID GENERATED REGISTRY's curated half (§52.7) — labels, descriptions, state, surfaces,
// forbidden-claim codes and evidence pointers are hand-maintained here; plan/entitlement and
// subscription facts are DERIVED at generation time (scripts/generate-ai-chat-facts.js) from the
// canonical subscription sources (supabase/functions/_shared/subscriptionContract.ts and
// src/domain/subscriptions/priceCatalog.js) — never re-typed here. Do not hand-duplicate a plan
// boolean in this file (L6 "PRODUCT TRUTH: ONE SOURCE", TEKANGO_AI_ARCHITECTURE.md §5).
//
// SUBSCRIPTIONS CUTOVER (OD-01..OD-20, 2026-10-07): the legacy plan gates, the trial and the monthly
// quote limits are NOT current product truth any more. A capability that the subscription system
// gates now names its canonical capability id (`subscriptionCapabilityId`, subscriptionContract.ts
// CAPABILITIES); which plans include it is not decided (OPEN-02 / OPEN-13), so `minimumPlan` is null
// on every entry and `planEligibility` is 'not_decided'. The pre-cutover plan gates survive ONLY as
// labelled audit history in productTruthLegacyPlanRules.js, used to validate historical (chat-ai v39)
// evidence captures — never to answer a user.
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
// among the 38. This registry therefore attaches the shared-gate fact (canonical capability
// `quote.whatsapp_delete`) to `owner_whatsapp_share.deterministicFactKeys` (not a new id) and records the
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

// The non-current entries (§52.2 + Task 20/21 additions), outside the 38. Their state/facts are derived at generation
// time from AI_FACTS.billing / AI_FACTS.invoicing (payment/invoicing) — never duplicated here as
// a second boolean; this record only carries the curated label/description/forbidden-claim shape.
export const NON_CURRENT_IDS = Object.freeze(['payment_processing', 'invoicing', 'autonomous_email', 'ai_mutation', 'automatic_customer_messages', 'automatic_whatsapp', 'google_calendar_sync']);

// Task 20 (Owner instruction 2026-10-09, AI-chat product knowledge): the capabilities added after the frozen 38 - Tasks 17-20 product
// screens the assistant must explain from THIS registry (never a parallel facts source). Pinned explicitly, in this order, after the 38.
export const PHASE_CAPABILITY_IDS = Object.freeze(['quote_statistics', 'manual_tasks', 'calendar', 'quote_link_view', 'reminders_automation', 'digital_business_card']); // Task 23: Phase 5 card

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
    // Legacy plan-gate fields, kept as keys for contract stability and always null after the subscriptions cutover:
    // no approved plan grants any gated capability yet (OPEN-02). Never re-populate them with legacy plan values.
    entitlementKey: null,
    minimumPlan: null,
    // The canonical subscription capability id (subscriptionContract.ts CAPABILITIES) that gates this capability when the
    // subscription system is active, or null. Which plans include it is NOT decided (OPEN-02 / OPEN-13).
    subscriptionCapabilityId: opts.subscriptionCapabilityId ?? null,
    planEligibility: opts.subscriptionCapabilityId ? 'not_decided' : null,
    // Codex defect 6 (2026-09-22): a capability's restriction axis is either a SUBSCRIPTION capability
    // (subscriptionCapabilityId above; plan eligibility not decided) or a server-verified ROLE (independent
    // of plan - never inferred from a plan). 'none' = no restriction beyond being signed in. Exactly one of
    // {subscriptionCapabilityId, requiredRole} may be set on a given entry; both null means unrestricted.
    authorityType: opts.authorityType ?? (opts.subscriptionCapabilityId ? 'subscription' : opts.requiredRole ? 'role' : 'none'),
    requiredRole: opts.requiredRole ?? null, // a real verified `business_settings.role` value (e.g. 'super_admin'), or null
    authoritySource: opts.authoritySource ?? null, // where the role is verified server-side (file path), for role-gated entries only
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
    { surfaces: ['dashboard'], aiMayNavigate: true, safeNavigationId: 'open_dashboard', canonicalSources: ['src/pages/Dashboard.jsx', 'src/components/StatisticsTab.jsx', 'src/components/TasksTab.jsx', 'src/components/CalendarTab.jsx'] }), // Task 17: Statistics is part of the dashboard quote summary; Task 18: the manual task list is a dashboard workspace screen (no new capability id - the 38 are frozen); Task 19: the calendar likewise

  capability('quote_history', 'היסטוריית הצעות מחיר', 'Quote history',
    'רשימת כל הצעות המחיר שנוצרו, עם חיפוש, סינון וסטטוס.',
    'The list of every quote created, with search, filtering, and status.',
    { surfaces: ['quote_history_screen'], aiMayNavigate: true, safeNavigationId: 'open_quote_history', canonicalSources: ['src/components/QuotesTab.jsx'] }),

  capability('quote_create', 'יצירת הצעת מחיר חדשה', 'Create a new quote',
    'יצירת הצעת מחיר חדשה. טיוטה ותצוגה מקדימה אינן משתמשות באחת מ-10 ההצעות של מסלול חינם.',
    'Create a new quote. Drafts and previews do not use one of the 10 quotes of the Free plan.',
    {
      surfaces: ['dashboard', 'quote_editor'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_new_quote',
      deterministicFactKeys: ['subscriptions.free.quotesTotal'],
      // Codex finding 3 (2026-09-24): the real UI trigger (`isCreatingQuote`) lives in
      // Dashboard.jsx, not QuoteForm.jsx (the form component it then renders) - added so this
      // capability's own source-owned marker actually joins to a listed canonical source.
      canonicalSources: ['src/pages/Dashboard.jsx', 'src/components/QuoteForm.jsx', 'src/domain/subscriptions/priceCatalog.js',
        // Task 16 - Quote Experience V2: the quote's own presentation (style + images) is part of creating the quote.
        'src/components/quotePresentation/QuotePresentationPanel.jsx', 'src/components/quotePresentation/QuoteMediaManager.jsx',
        'src/components/quotePresentation/QuoteStylePicker.jsx',
        // Task 27 (spec §6): starting a new quote from a saved whole-quote template (the template dialogs)
        'src/components/QuoteTemplateDialogs.jsx'],
    }),

  capability('quote_edit', 'עריכת הצעה שמורה', 'Edit a saved quote',
    'עריכת הצעת מחיר שכבר נשמרה.',
    'Edit a quote that has already been saved.',
    {
      surfaces: ['quote_editor'], operationType: 'mutate', subscriptionCapabilityId: 'quote.edit_duplicate',
      aiMayNavigate: true, safeNavigationId: 'open_selected_quote', canonicalSources: ['src/components/QuoteForm.jsx', 'src/pages/Dashboard.jsx', 'src/components/QuotesTab.jsx'],
    }),

  capability('quote_duplicate', 'שכפול הצעת מחיר', 'Duplicate a quote',
    'שכפול הצעת מחיר קיימת ליצירת הצעה חדשה מבוססת עליה.',
    'Duplicate an existing quote to start a new one from it.',
    { surfaces: ['quote_history_screen'], operationType: 'mutate', subscriptionCapabilityId: 'quote.edit_duplicate', canonicalSources: ['src/pages/Dashboard.jsx', 'src/components/QuotesTab.jsx'] }),

  capability('quote_status', 'סטטוס הצעת מחיר', 'Quote status',
    'סימון/צפייה בסטטוס הצעה (טיוטה/נשלח/אושר/שולם): אפשר לבחור אותו ידנית, והצעה בטיוטה מסומנת „נשלחה” אוטומטית כששולחים אותה בוואטסאפ (כשוואטסאפ נפתח) או במייל (אחרי שליחה מוצלחת). הסטטוס אינו גובה תשלום.',
    'Viewing/setting a quote\'s status (Draft/Sent/Approved/Paid): you can set it by hand, and a Draft is marked Sent automatically when you share it by WhatsApp (when WhatsApp opens) or by email (after a successful send). The status does not collect payment.',
    { surfaces: ['quote_editor', 'quote_history_screen'], operationType: 'mutate', forbiddenClaimCodes: ['NO_PAID_STATUS_AS_PAYMENT_COLLECTION'], canonicalSources: ['src/components/QuotesTab.jsx',
      // Task 16: issuing (freezing) the quote presentation is a quote lifecycle step.
      'src/components/quotePresentation/QuotePresentationPanel.jsx', 'src/components/quotePresentation/IssueQuoteDialog.jsx'] }),

  capability('smart_quote', 'הצעת מחיר חכמה', 'Smart Quote flow',
    'הצעת מחיר חכמה עם AI (בתפריט „הצעה חדשה”): מתארים את העבודה במילים, וה-AI מציע שורות - תיאור, כמות ויחידה; מחיר רק כשהפריט קיים בקטלוג שלכם, אחרת המחיר נשאר ריק להזנה. בודקים, מתקנים ומאשרים לפני שמשהו נכנס להצעה; שום דבר לא נשמר או נשלח לבד.',
    'AI smart quote (in the "New quote" menu): describe the job in words and the AI suggests lines - description, quantity and unit; a price only when the item is in your catalog, otherwise the price stays empty for you to enter. You review, correct and approve before anything enters the quote; nothing is saved or sent on its own.',
    { surfaces: ['quote_editor'], operationType: 'mutate', deterministicFactKeys: [], canonicalSources: ['src/components/QuoteForm.jsx', 'src/components/AiQuoteDraftDialog.jsx'] }), // Task 21: the AI-draft dialog of the AI smart-quote entry; night task 2026-10-16 (R-29): described as the menu offers it (ai-quote-draft was published with the new interface)

  capability('measured_quote', 'הצעת מחיר מקצועית/מדודה', 'Measured professional quote',
    'הצעה לפי מידות: מוסיפים פריט ומודדים אותו במסך אחד (שטח, אורך, יחידות או מחיר קבוע; בס״מ או במטר, או כמות ידועה במ״ר / מ״א), ואז בודקים ומוסיפים להצעה. חלוקה לחדרים/אזורים/יחידות היא אפשרות לבחירה.',
    'Measured quote: add an item and measure it on one screen (area, length, units or a fixed price; in cm or m, or a known quantity in m² / linear m), then check it and add it to the quote. Grouping into rooms/areas/units is optional.',
    { surfaces: ['quote_editor'], operationType: 'mutate', subscriptionCapabilityId: 'professional_quote.use', canonicalSources: ['src/components/QuoteForm.jsx'] }),

  capability('professional_reuse', 'שימוש חוזר מקצועי בפריטים', 'Advanced professional item reuse',
    'שימוש חוזר מתקדם בפריטים מקצועיים בין הצעות מחיר.',
    'Advanced reuse of professional items across quotes.',
    { surfaces: ['quote_editor'], operationType: 'mutate', subscriptionCapabilityId: 'professional_quote.reuse', canonicalSources: ['src/components/QuoteForm.jsx'] }),

  capability('clients', 'ניהול לקוחות', 'Client management',
    'הוספה, עריכה וצפייה בלקוחות.',
    'Adding, editing, and viewing clients.',
    { surfaces: ['clients_screen'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_clients', canonicalSources: ['src/components/ClientsTab.jsx', 'src/components/EditClientModal.jsx'] }),

  capability('catalog', 'קטלוג שירותים', 'Services catalog',
    'ניהול קטלוג פריטים/שירותים לשימוש חוזר בהצעות מחיר.',
    'Managing a catalog of items/services for reuse across quotes.',
    { surfaces: ['catalog_screen'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_catalog', canonicalSources: ['src/components/ServicesCatalog.jsx', 'src/components/quotePresentation/CatalogMediaControl.jsx'] }),

  capability('finance_views', 'תצוגות פיננסיות', 'Finance views',
    'צפייה בסיכומי הכנסות/הוצאות ומדדים פיננסיים.',
    'Viewing income/expense summaries and financial KPIs.',
    { surfaces: ['finances_screen'], aiMayNavigate: true, safeNavigationId: 'open_finances', canonicalSources: ['src/components/FinancesTab.jsx'] }),

  capability('expenses', 'ניהול הוצאות', 'Expense management',
    'הוספה ועריכה של הוצאות עסקיות.',
    'Adding and editing business expenses.',
    { surfaces: ['finances_screen'], operationType: 'mutate', canonicalSources: ['src/components/FinancesTab.jsx', 'src/components/EditExpenseModal.jsx'] }),

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
      canonicalSources: ['src/components/DraggableCalculator.jsx', 'src/components/QuoteForm.jsx'],
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
    { surfaces: ['settings_screen'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_business_settings', canonicalSources: ['src/components/SettingsTab.jsx', 'src/components/quotePresentation/QuoteStylePicker.jsx',
      'src/components/ShareDefaultsSettings.jsx'] }), // Task 27: manual sharing defaults / thank-you settings screen

  capability('profile_prerequisites', 'דרישות פרופיל עסקי', 'Business profile prerequisites',
    'טלפון עסקי (וב-שוק המקומי גם ח.פ./עוסק) נדרשים לפני יצירת הצעה ראשונה.',
    'A business phone (and, in the Local market, a tax/business ID) are required before the first quote can be created.',
    {
      surfaces: ['settings_screen', 'quote_editor'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_business_phone',
      canonicalSources: ['src/components/SettingsTab.jsx', 'src/utils/regionConfig.js'],
    }),

  // Stable technical id kept from the frozen 38 (§52 change-control); the CONTENT is the post-cutover plan truth (OD-01/16):
  // there is no trial - Free is 10 quotes in total with no expiry, and the new plan system is not active yet.
  capability('plan_trial', 'מסלולים ו-10 הצעות חינם', 'Plans and Free quotes',
    'מסלול חינם כולל 10 הצעות בסך הכול, ללא תפוגה. אחריהן יש מסלול אחד שכולל את כל היכולות הזמינות, בתשלום חודשי או שנתי: 30.00 ₪ לחודש או 306.00 ₪ לשנה, כולל מע״מ. מערכת המנויים החדשה עדיין בהכנה.',
    'The Free plan includes 10 quotes in total, valid without an expiry date. After them there is one package with every available capability, billed monthly or annually: 18.00 USD per month or 184.00 USD per year, charged in USD. The new subscription system is still being prepared.',
    { surfaces: ['plans_screen'], aiMayNavigate: true, safeNavigationId: 'open_plan_information', deterministicFactKeys: ['subscriptions.free.quotesTotal', 'subscriptions.planSystemActive'], canonicalSources: ['src/domain/subscriptions/packageCatalog.js', 'src/domain/subscriptions/priceCatalog.js', 'supabase/functions/_shared/subscriptionContract.ts', 'src/components/PricingModal.jsx', 'src/components/SettingsTab.jsx', 'src/pages/Dashboard.jsx',
      // still carries this id's PRODUCT_TRUTH_CAPABILITY marker (legacy resolver, owned by the core stream): drop this path when
      // the core stream removes that marker or the file.
      'src/utils/accountEntitlement.js'] }),

  capability('attachments', 'צירוף קבצים', 'File attachments',
    'צירוף קבצים/שרטוטים להצעת מחיר.',
    'Attaching files/drawings to a quote.',
    {
      surfaces: ['quote_editor'], operationType: 'mutate', subscriptionCapabilityId: 'quote_attachment.upload',
      // OPEN-13: which plans include attachments, and their file types / count / size limits, are not decided.
      deterministicFactKeys: [], canonicalSources: ['src/components/QuoteForm.jsx', 'supabase/functions/_shared/subscriptionContract.ts'],
    }),

  capability('quote_pdf', 'PDF של הצעת מחיר', 'Quote PDF export',
    'ייצוא הצעת מחיר כקובץ PDF - מסמך הצעה, לא חשבונית.',
    'Exporting a quote as a PDF file - a quote document, not an invoice.',
    { surfaces: ['quote_editor', 'public_quote_page'], forbiddenClaimCodes: ['NO_INVOICE_CONFLATION'], canonicalSources: ['src/utils/generateQuotePdf.js', 'src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx'] }),

  capability('quote_print', 'הדפסת הצעת מחיר', 'Quote print',
    'הדפסה ישירה של הצעת מחיר.',
    'Printing a quote directly.',
    { surfaces: ['quote_editor', 'public_quote_page'], forbiddenClaimCodes: ['NO_INVOICE_CONFLATION'], canonicalSources: ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx'] }),

  capability('quote_email', 'שליחת הצעה במייל', 'Emailing a quote',
    'שליחת הצעת מחיר ללקוח במייל - שולחת את ההצעה, אינה מבצעת חיוב.',
    'Sending a quote to a client by email - sends the quote, does not bill or invoice.',
    { surfaces: ['quote_editor'], operationType: 'mutate', forbiddenClaimCodes: ['NO_INVOICE_CONFLATION', 'NO_PAYMENT_COLLECTION_CLAIM'], canonicalSources: ['supabase/functions/send-quote-email/index.ts', 'src/components/EmailConfirmModal.jsx', 'src/components/QuotesTab.jsx', 'src/components/StatisticsTab.jsx'] }),

  capability('owner_whatsapp_share', 'שיתוף הצעה ב-WhatsApp (בעל העסק)', 'Owner WhatsApp share',
    'שיתוף הצעת מחיר ב-WhatsApp על ידי בעל העסק - שונה מפעולת יצירת הקשר של הצד המקבל בהצעה הציבורית.',
    'The business owner sharing a quote via WhatsApp - a different capability from the recipient\'s WhatsApp contact action on the public quote.',
    {
      surfaces: ['quote_editor', 'quote_history_screen'], subscriptionCapabilityId: 'quote.whatsapp_delete',
      forbiddenClaimCodes: ['NO_OWNER_PUBLIC_WHATSAPP_CONFLATION'],
      // Known discrepancy (see file header): the same entitlementKey also gates quote deletion in real
      // source (src/pages/Dashboard.jsx handleProtectedAction), which has no dedicated id among the 38.
      deterministicFactKeys: ['quoteDeletionSharesThisEntitlement'],
      canonicalSources: ['src/pages/Dashboard.jsx', 'supabase/functions/_shared/subscriptionContract.ts', 'src/components/QuotesTab.jsx', 'src/components/StatisticsTab.jsx'],
    }),

  capability('public_whatsapp_contact', 'יצירת קשר ב-WhatsApp (צד מקבל)', 'Public quote WhatsApp contact',
    'כפתור יצירת קשר ב-WhatsApp עבור מקבל ההצעה בעמוד ההצעה הציבורי - שונה משיתוף ההצעה של בעל העסק.',
    'A WhatsApp contact button for the quote recipient on the public quote page - a different capability from the owner\'s quote share.',
    {
      // Codex defect 5 (2026-09-22): fresh source check found PublicQuoteEn.jsx (International) has
      // the SAME bizWhatsAppHref-driven WhatsApp button as PublicQuote.jsx (Local) - this was
      // wrongly marked Local-only. Both markets confirmed live in real source, not inferred.
      surfaces: ['public_quote_page'], markets: ['local', 'international'],
      forbiddenClaimCodes: ['NO_OWNER_PUBLIC_WHATSAPP_CONFLATION'],
      canonicalSources: ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx'],
    }),

  capability('public_call', 'התקשרות מעמוד ההצעה', 'Public quote call action',
    'כפתור התקשרות טלפונית עבור מקבל ההצעה בעמוד ההצעה הציבורי.',
    'A call button for the quote recipient on the public quote page.',
    { surfaces: ['public_quote_page'], canonicalSources: ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx', 'src/components/PublicQuoteHeader.jsx'] }),

  capability('public_quote_view', 'צפייה בהצעה ציבורית', 'Public quote viewing',
    'צפייה בהצעת מחיר על ידי הלקוח, ללא צורך בהתחברות, דרך קישור ייחודי.',
    'Viewing a quote as the client, no login required, via a unique link.',
    { surfaces: ['public_quote_page'], canonicalSources: ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx', 'src/components/QuotesTab.jsx', 'src/pages/Dashboard.jsx', 'src/components/StatisticsTab.jsx'] }),

  capability('public_quote_sign', 'חתימה על הצעה ציבורית', 'Public quote signing',
    'אישור/חתימה על הצעת מחיר על ידי הלקוח, בכפוף לתוקף ההצעה ולזהות המאשר.',
    'Approving/signing a quote as the client, subject to the quote\'s validity and the approver\'s identity.',
    // Enforceable source inventory fix (2026-09-2X, checkMarkerAmbiguity): PublicQuoteEn.jsx (the
    // International-market page) carries this capability's own scanned marker too - it was missing
    // from canonicalSources, an undeclared marker location the new gate caught on first run.
    { surfaces: ['public_quote_page'], operationType: 'mutate', canonicalSources: ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx', 'supabase/functions/get-public-quote/index.ts'] }),

  capability('quote_expiry', 'תפוגת הצעת מחיר', 'Quote expiry',
    'הצעה שפג תוקפה נשארת צפויה לצפייה אך אינה ניתנת לחתימה.',
    'An expired quote stays viewable but cannot be signed.',
    // Codex finding 3 (2026-09-24): the real expiry rule (`isQuoteAcceptanceExpired`) is DEFINED in
    // validity.ts; index.ts only imports and calls it - added so this capability's own source-owned
    // marker actually joins to a listed canonical source, not just its caller.
    { surfaces: ['public_quote_page', 'quote_editor'], deterministicFactKeys: ['isExpired'], canonicalSources: ['supabase/functions/get-public-quote/validity.ts', 'supabase/functions/get-public-quote/index.ts'] }),

  capability('draft_recovery', 'שחזור טיוטה מקומית', 'Local draft recovery',
    'שחזור עבודה שלא נשמרה בעורך ההצעה לאחר רענון/מעבר אפליקציה - שמור מקומית בדפדפן בלבד, לא בענן.',
    'Restoring unsaved editor work after a refresh/app switch - stored locally in the browser only, never in the cloud.',
    { surfaces: ['quote_editor'], forbiddenClaimCodes: ['NO_LOCAL_DRAFT_AS_CLOUD_SAVED'], deterministicFactKeys: ['draftProvenance'], canonicalSources: ['src/utils/quoteDraft.js', 'src/components/QuoteDraftNotices.jsx'] }),

  capability('accessibility_tools', 'כלי נגישות', 'Accessibility tools',
    'תפריט נגישות (גודל טקסט, ניגודיות ועוד) הזמין בכל מסך.',
    'An accessibility menu (text size, contrast, and more) available on every screen.',
    { surfaces: ['dashboard', 'public_quote_page', 'public_tools_page'], canonicalSources: ['src/components/AccessibilityModal.jsx', 'src/pages/Dashboard.jsx'] }),

  capability('ai_chat', 'צ׳אט AI', 'AI Chat assistant',
    'עוזר AI זמין בתוך האפליקציה, שמסביר את המוצר ומנווט לפי בקשה - קריאה בלבד, לעולם לא מבצע פעולה בעצמו.',
    'An in-app AI assistant that explains the product and navigates on request - read-only, it never performs an action itself.',
    { surfaces: ['dashboard', 'quote_editor', 'clients_screen', 'catalog_screen', 'finances_screen', 'settings_screen', 'plans_screen', 'admin_screen'], aiMayNavigate: true, canonicalSources: ['src/AIChatWidget.jsx', 'supabase/functions/chat-ai/index.ts', 'src/components/AiHelpButton.jsx', 'src/pages/Dashboard.jsx', 'src/components/NotificationCenter.jsx'] }),

  capability('admin_console', 'מסך ניהול', 'Admin console',
    'מסך ניהול פנימי המוגבל לתפקיד Super Admin המאומת בצד השרת - אינו תלוי במסלול ואינו חלק ממרחב העבודה של משתמש רגיל.',
    'An internal admin screen restricted to a server-verified Super Admin role - independent of plan entitlement, not part of an ordinary user\'s workspace.',
    {
      // Codex defect 6 (2026-09-22): Admin is a ROLE restriction (`business_settings.role ===
      // 'super_admin'`, verified server-side), never a plan restriction - an account on any plan with an
      // ordinary role has no Admin access, and admin status is never inferred from a plan (accountContext.ts).
      surfaces: ['admin_screen'], authorityType: 'role', requiredRole: 'super_admin',
      authoritySource: 'supabase/functions/chat-ai/accountContext.ts',
      forbiddenClaimCodes: ['NO_ADMIN_FROM_PLAN_OR_LIFETIME_INFERENCE'],
      aiMayNavigate: true, safeNavigationId: 'open_admin',
      // Corrected (Codex defect 9, 2026-09-22): the original reference here, "UserDetailsModal.jsx",
      // does not exist anywhere in real source - the actual component is AdminUserDetails.jsx. Found
      // by the new exhaustive canonical-source-exists gate, not by inspection.
      canonicalSources: [
        'src/components/AdminUsersTab.jsx', 'src/components/AdminUserDetails.jsx', 'supabase/functions/chat-ai/accountContext.ts',
        'src/components/AISupportLogsContent.jsx', 'src/components/AdminOverview.jsx', 'src/components/AdminPlans.jsx',
        'src/components/AdminSidebarNav.jsx', 'src/components/AdminUsersView.jsx', 'src/pages/Dashboard.jsx',
      ],
    }),

  // ---- Task 20: capabilities after the frozen 38 (PHASE_CAPABILITY_IDS). Descriptions state what is active and what is not. ----
  capability('quote_statistics', 'סטטיסטיקת הצעות והצעות חמות', 'Quote statistics and hot quotes',
    "מסך סטטיסטיקה: כמה הצעות נוצרו, נשלחו, אושרו ושולמו, שיעור ההמרה, ורשימת הצעות חמות (נצפו 3 פעמים או יותר וממתינות לאישור) עם פעולות ידניות: צפייה בהצעה (נפתחת בלשונית חדשה), WhatsApp, שליחה במייל ויצירת משימת מעקב. סכומים מוצגים לכל מטבע בנפרד, לפי תקופה וסטטוס. פותחים אותו מהתפריט „סטטיסטיקה” (בנייד: „עוד” ← „סטטיסטיקה”).",
    "A Statistics screen: how many quotes were created, sent, approved and paid, the conversion rate, and a hot-quote list (viewed 3+ times and awaiting approval) with manual actions: view the quote (opens in a new tab), WhatsApp, email and create a follow-up task. Amounts are shown per currency, by period and status. Open it from the “Statistics” menu item (on mobile: “More” → “Statistics”).",
    { surfaces: ['dashboard'], canonicalSources: ['src/components/StatisticsTab.jsx', 'src/utils/quoteStatistics.js'] }),

  capability('manual_tasks', 'משימות ידניות', 'Manual tasks',
    "מסך משימות: יוצרים משימה ידנית עם כותרת, הערות, תאריך ושעה, עדיפות וקישור להצעה או ללקוח שלכם, ומסמנים אותה כהושלמה. אפשר ליצור משימת מעקב ישירות מהצעה חמה. המשימות שמורות בחשבון שלכם ומוצגות רק לכם.",
    "A Tasks screen: you create a manual task with a title, notes, date and time, priority and a link to one of your quotes or clients, and mark it completed. A follow-up task can be created directly from a hot quote. Tasks are saved in your account and shown only to you.",
    { surfaces: ['dashboard'], operationType: 'mutate', canonicalSources: ['src/components/TasksTab.jsx', 'src/utils/tasksClient.js', 'src/utils/manualTasks.js'] }),

  capability('calendar', 'יומן', 'Calendar',
    "יומן בתצוגת יום, שבוע וחודש: משימות לפי התאריך והשעה שלהן, והצעות שממתינות לחתימה לפי תאריך „בתוקף עד”. בחשבון ישראלי היומן מציג גם שבתות, חגים וימי מנוחה רשמיים בישראל ברקע נפרד שאפשר להסתיר. השבוע מתחיל ביום ראשון, והחגים הם שכבת מידע בלבד. זה יומן פנימי של TEKANGO לתכנון העבודה; פותחים אותו מהתפריט „יומן” (בנייד: „עוד” ← „יומן”). הוא אינו מסונכרן ל-Google Calendar או ליומן חיצוני אחר.",
    "A calendar with day, week and month views: tasks on their date and time, and quotes awaiting signature on their valid-until date. Weeks start on Sunday, and it shows no public holidays. It is TEKANGO’s internal calendar for planning your work; open it from the “Calendar” menu item (on mobile: “More” → “Calendar”). It is not synced with Google Calendar or any other external calendar.",
    { surfaces: ['dashboard'], canonicalSources: ['src/components/CalendarTab.jsx', 'src/utils/calendarModel.js'] }),

  capability('quote_link_view', 'צפייה בקישור ההצעה', 'Quote link viewed',
    "הצעה „נשלחה” כשסימנתם אותה כנשלחה, או כששלחתם אותה בוואטסאפ או במייל. „צפייה בקישור ההצעה” נשמרת בזמן השרת, פעם אחת, כשקישור ההצעה נפתח והמסמך הוצג לפחות 5 שניות בדפדפן שאינו החשבון שלכם וסורקים מוכרים מסוננים. זו אינדיקציה לפתיחת הקישור בלבד - גם פתיחה שלכם מדפדפן מנותק או סורק חדש עשויים להיספר, ולכן היא מוצגת כצפייה בקישור. הנקודה הירוקה ליד מייל מאשרת רק שספק המייל קיבל את בקשת השליחה. הרישום מתחיל אחרי עדכון השרת.",
    "A quote is “sent” when you marked it as sent, or when you shared it by WhatsApp or by email. “Quote link viewed” is stored in server time, once, when the quote link was opened and the document shown for at least 5 seconds in a browser other than your account, with known scanners filtered out. It indicates that the link was opened - your own opening from a signed-out browser or a new scanner can also count, so it is shown as a link view. The green dot next to an email confirms only that the email provider accepted the send request.",
    { surfaces: ['public_quote_page', 'dashboard'], canonicalSources: ['src/utils/firstView.js', 'src/components/SmartPublicQuote.jsx'] }),

  capability('reminders_automation', 'תזכורות ואוטומציות', 'Reminders & automation',
    "הגדרות עסק ← תזכורות ואוטומציות: בוחרים אחד משלושה מצבים - „בממשק בלבד” (ברירת המחדל: התזכורות מופיעות אצלכם בפעמון), „כבוי”, או „מלא, כולל שליחה ללקוח”, שנדלק רק בבחירה מפורשת שלכם. מסמנים בתיבות סימון אילו התנהגויות יפעלו. אפשר להגדיר כלל ללקוח (ימים, תוכן, שעות שליחה ואזור זמן, עם תצוגה מקדימה והשהיה), ושליחה אוטומטית ללקוחות תיפתח בהמשך; בינתיים הודעות ללקוח נשלחות על ידכם, מתוך ההצעה. WhatsApp נשלח ידנית מתוך ההצעה.",
    "Business settings → Reminders & automation: you choose one of three modes - “In-app only” (the default: reminders appear for you under the bell), “Off”, or “Full, including customer sending”, which turns on only by your explicit choice. You tick which behaviors run. You can set up a customer rule (days, content, sending hours and a time zone, with a preview and a pause), and automatic sending to customers opens later; until then, messages to a customer are sent by you from the quote. WhatsApp is sent manually from the quote.",
    { surfaces: ['business_settings', 'dashboard'], operationType: 'mutate', aiMayNavigate: true, safeNavigationId: 'open_business_settings', canonicalSources: ['src/components/RemindersSettings.jsx', 'src/components/SettingsTab.jsx', 'src/components/NotificationCenter.jsx', 'supabase/functions/_shared/reminderRules.js', 'src/utils/reminders.js'] }),

  // Task 23 (Phase 5, Owner approval 2026-10-10) + Task 24 (editor, opt-in channels; Task 26: no card style - those are quote styles): saving needs the business_cards migration
  // and the public page its server function (get-business-card) - both local source only until separately authorized; the description says so.
  capability('digital_business_card', 'יצירת כרטיס ביקור דיגיטלי', 'Digital business card',
    'הגדרות עסק ← „כרטיס ביקור דיגיטלי”: יוצרים ועורכים דף ציבורי לעסק - שם, תפקיד, סלוגן, אודות ותמונה או לוגו - ובוחרים אילו דרכי תקשורת יוצגו (טלפון, WhatsApp, אימייל וכתובת מהגדרות העסק). יש קישור לשיתוף וקוד QR. מספר עוסק ופרטים פנימיים לא מוצגים.',
    'Business settings → “Digital business card”: create and edit a public page for your business - name, job title, slogan, about and a photo or logo - and choose which contact options appear (phone, WhatsApp, email and address from Business settings). It has a share link and a QR code. Your tax ID and internal details are never shown.',
    { surfaces: ['business_settings'], aiMayNavigate: true, safeNavigationId: 'open_business_settings', canonicalSources: ['src/components/BusinessCardSettings.jsx', 'src/components/BusinessCard.jsx', 'src/pages/PublicBusinessCard.jsx', 'src/components/SettingsTab.jsx', 'src/hooks/useBusinessCardProfile.js', 'supabase/functions/_shared/businessCard.js'] }),
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
  }),  // Task 20: what the reminders feature does NOT do today (an assistant must answer these deterministically, never promise them).
  Object.freeze({
    id: 'automatic_customer_messages', heLabel: 'שליחה אוטומטית ללקוחות', enLabel: 'Automatic customer messages',
    heDescription: 'מיילים שנשלחים ללקוחות אוטומטית לפי כללי מצב „מלא” בתזכורות ואוטומציות.', enDescription: 'Emails sent to customers automatically by Full-mode rules in Reminders & automation.',
    state: CAPABILITY_STATES.IMPLEMENTED_NOT_RELEASED, forbiddenClaimCodes: ['NO_AUTOMATIC_CUSTOMER_SEND_CLAIM'], canonicalSources: ['supabase/functions/_shared/reminderRules.js', 'src/utils/reminders.js'],
  }),
  Object.freeze({
    id: 'automatic_whatsapp', heLabel: 'WhatsApp אוטומטי', enLabel: 'Automatic WhatsApp',
    heDescription: 'שליחת הודעות WhatsApp ללקוחות אוטומטית, בלי לחיצה של בעל העסק.', enDescription: 'Sending WhatsApp messages to customers automatically, without the business owner pressing send.',
    state: CAPABILITY_STATES.ROADMAP_POST_LIVE, forbiddenClaimCodes: ['NO_AUTOMATIC_WHATSAPP_CLAIM'], canonicalSources: ['TEKANGO_AI_ARCHITECTURE.md'],
  }),
  // Task 21 (Owner report 2026-10-10, PROFLOW_PROJECT_CONTEXT.md §250): direct questions the assistant must answer plainly, never with a
  // generic clarification. answerNote = the one extra sentence the deterministic NOT_AVAILABLE answer adds (the internal Calendar exists).
  Object.freeze({
    id: 'google_calendar_sync', heLabel: 'אינטגרציה עם Google Calendar', enLabel: 'Google Calendar integration',
    heDescription: 'חיבור אופציונלי של יומן TEKANGO ליומן Google של המשתמש.', enDescription: 'An optional connection of the TEKANGO calendar to the user’s Google Calendar.',
    heAnswerNote: 'ב-TEKANGO יש יומן פנימי לתכנון העבודה - פותחים אותו מהתפריט „יומן” (בנייד: „עוד” ← „יומן”). הוא אינו מסונכרן ל-Google Calendar או ליומן חיצוני אחר.',
    enAnswerNote: 'TEKANGO has an internal calendar for planning your work - open it from the “Calendar” menu item (on mobile: “More” → “Calendar”). It is not synced with Google Calendar or any other external calendar.',
    state: CAPABILITY_STATES.ROADMAP_POST_LIVE, forbiddenClaimCodes: ['NO_EXTERNAL_CALENDAR_SYNC_CLAIM'], canonicalSources: ['PROFLOW_TODO.md'],
  }),
]);

export function getCapabilityById(id) {
  return PRODUCT_TRUTH_REGISTRY.find((c) => c.id === id) || NON_CURRENT_REGISTRY.find((c) => c.id === id) || null;
}
