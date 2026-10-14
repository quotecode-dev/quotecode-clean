// PRODUCT TRUTH — independent component-level capability anchor map (Codex defects 7/9, 2026-09-23).
//
// This module is deliberately SEPARATE from src/data/productTruthRegistry.js and is never imported
// by it (no circular authority). Every anchor below is a real, pre-existing, capability-specific
// identifier already present in the named file for reasons that predate and are unrelated to this
// registry (a function name, a state variable, a DOM id) - never a marker manufactured after the
// fact to make a check trivially pass. This is what makes the coverage/source-validation gates in
// productTruthComponentCoverage.test.js genuinely independent of the registry's own claims:
// - Defect 7 (coverage): every capability listed here must exist as a real, LIVE_CURRENT registry
//   entry - a capability with real, discoverable anchors but no registry entry is the coverage gap
//   the gate exists to catch.
// - Defect 9 (source validation): every registry capability's canonicalSources must actually CONTAIN
//   at least one of ITS OWN anchors below - a dangling path, an unrelated file, or a file missing
//   the expected anchor all fail this check.
//
// Anchors are plain substrings (not regex) checked with String.includes() against the real file
// text, so they are trivial to audit by eye against the cited file.
export const CAPABILITY_ANCHORS = {
  dashboard_overview: [{ file: 'src/pages/Dashboard.jsx', anchor: 'export default function Dashboard' }],
  quote_history: [{ file: 'src/components/QuotesTab.jsx', anchor: 'export default function QuotesTab' }],
  quote_create: [{ file: 'src/pages/Dashboard.jsx', anchor: 'isCreatingQuote' }],
  quote_edit: [{ file: 'src/pages/Dashboard.jsx', anchor: 'editingQuoteId' }],
  quote_duplicate: [{ file: 'src/pages/Dashboard.jsx', anchor: 'handleDuplicateQuote' }],
  quote_status: [{ file: 'src/components/QuotesTab.jsx', anchor: 'getStatusBadge' }],
  smart_quote: [{ file: 'src/components/QuoteForm.jsx', anchor: "structureMode === 'regular'" }],
  measured_quote: [{ file: 'src/components/QuoteForm.jsx', anchor: "structureMode === 'divided'" }],
  professional_reuse: [{ file: 'src/components/QuoteForm.jsx', anchor: 'canUseProfessionalQuoteReuse' }],
  clients: [{ file: 'src/components/ClientsTab.jsx', anchor: 'export default function ClientsTab' }],
  catalog: [{ file: 'src/components/ServicesCatalog.jsx', anchor: 'export default function ServicesCatalog' }],
  finance_views: [{ file: 'src/components/FinancesTab.jsx', anchor: 'export default function FinancesTab' }],
  expenses: [{ file: 'src/components/FinancesTab.jsx', anchor: 'addExpenseBtn' }],
  quote_csv: [{ file: 'src/components/QuotesTab.jsx', anchor: 'Export CSV' }],
  expense_csv: [{ file: 'src/components/FinancesTab.jsx', anchor: 'ייצוא CSV' }],
  editor_calculator: [{ file: 'src/components/DraggableCalculator.jsx', anchor: 'inputDigit' }],
  editor_currency_converter: [{ file: 'src/components/DraggableCalculator.jsx', anchor: 'fromCurr' }],
  public_currency_converter: [
    { file: 'src/components/PublicTools.jsx', anchor: 'convertCurrency(amountIn.value' },
    { file: 'src/components/PublicToolsEn.jsx', anchor: 'convertCurrency(amountIn.value' },
  ],
  public_unit_converter: [
    { file: 'src/components/PublicTools.jsx', anchor: 'convertLength(unitIn.value' },
    { file: 'src/components/PublicToolsEn.jsx', anchor: 'convertLength(unitIn.value' },
  ],
  // Task 36: both tools pages share src/utils/publicToolsCore.js (anchors = the calls each page makes). Earlier note: the two files used different variable names (metalPricesILS vs metalPricesUSD) - a real,
  // deliberate difference (the Hebrew tool denominates in ILS, the English one in USD), not an
  // inconsistency to normalize away.
  public_metals_calculator: [
    { file: 'src/components/PublicTools.jsx', anchor: 'metalValueUsd(gramsIn.value' },
    { file: 'src/components/PublicToolsEn.jsx', anchor: 'metalValueUsd(gramsIn.value' },
  ],
  public_crypto_calculator: [
    { file: 'src/components/PublicTools.jsx', anchor: 'coinPrice.usd' },
    { file: 'src/components/PublicToolsEn.jsx', anchor: 'coinPrice.usd' },
  ],
  business_settings: [{ file: 'src/components/SettingsTab.jsx', anchor: 'export default function SettingsTab' }],
  // Task 20: the capabilities after the frozen 38 (PHASE_CAPABILITY_IDS in productTruthRegistry.js)
  quote_statistics: [{ file: 'src/components/StatisticsTab.jsx', anchor: 'export default function StatisticsTab' }],
  manual_tasks: [{ file: 'src/components/TasksTab.jsx', anchor: 'export default function TasksTab' }],
  calendar: [{ file: 'src/components/CalendarTab.jsx', anchor: 'export default function CalendarTab' }],
  quote_link_view: [{ file: 'src/utils/firstView.js', anchor: 'export function scheduleFirstViewRecord' }],
  reminders_automation: [{ file: 'src/components/RemindersSettings.jsx', anchor: 'export default function RemindersSettings' }],
  // Task 23 (Phase 5): the owner screen and the public page of the digital business card
  digital_business_card: [{ file: 'src/components/BusinessCardSettings.jsx', anchor: 'export default function BusinessCardSettings' }, { file: 'src/pages/PublicBusinessCard.jsx', anchor: 'export default function PublicBusinessCard' }],
  profile_prerequisites: [{ file: 'src/components/SettingsTab.jsx', anchor: 'pf-settings-business_tax_id' }],
  // Subscriptions cutover: plan_trial now states the Free-10 / canonical plan truth; its anchor is the canonical Free-10 constant
  // (OD-01), not the retired trial machinery (src/utils/accountEntitlement.js TRIAL_EXPIRING_SOON_DAYS).
  plan_trial: [{ file: 'src/domain/subscriptions/priceCatalog.js', anchor: 'FREE_QUOTES_TOTAL' }],
  attachments: [{ file: 'src/components/QuoteForm.jsx', anchor: 'handleAttachmentClick' }],
  quote_pdf: [{ file: 'src/utils/generateQuotePdf.js', anchor: 'buildQuotePdfFilename' }],
  quote_print: [
    { file: 'src/pages/PublicQuote.jsx', anchor: 'window.print()' },
    { file: 'src/pages/PublicQuoteEn.jsx', anchor: 'window.print()' },
  ],
  quote_email: [{ file: 'supabase/functions/send-quote-email/index.ts', anchor: 'api.resend.com/emails' }],
  owner_whatsapp_share: [{ file: 'src/pages/Dashboard.jsx', anchor: 'sendWhatsApp' }],
  public_whatsapp_contact: [
    { file: 'src/pages/PublicQuote.jsx', anchor: 'bizWhatsAppHref' },
    { file: 'src/pages/PublicQuoteEn.jsx', anchor: 'bizWhatsAppHref' },
  ],
  public_call: [
    { file: 'src/pages/PublicQuote.jsx', anchor: 'tel:' },
    { file: 'src/pages/PublicQuoteEn.jsx', anchor: 'tel:' },
  ],
  public_quote_view: [
    { file: 'src/pages/PublicQuote.jsx', anchor: 'export default function PublicQuote(' },
    { file: 'src/pages/PublicQuoteEn.jsx', anchor: 'export default function PublicQuoteEn' },
  ],
  public_quote_sign: [
    { file: 'src/pages/PublicQuote.jsx', anchor: 'handleApprove' },
    { file: 'src/pages/PublicQuoteEn.jsx', anchor: 'handleApprove' },
    { file: 'supabase/functions/get-public-quote/index.ts', anchor: 'is_expired' },
  ],
  quote_expiry: [{ file: 'supabase/functions/get-public-quote/index.ts', anchor: 'isQuoteAcceptanceExpired' }],
  draft_recovery: [{ file: 'src/utils/quoteDraft.js', anchor: 'draftStorageKey' }],
  accessibility_tools: [{ file: 'src/components/AccessibilityModal.jsx', anchor: 'export default function AccessibilityModal' }],
  ai_chat: [{ file: 'src/AIChatWidget.jsx', anchor: 'open-proflow-ai-chat' }],
  admin_console: [{ file: 'src/components/AdminUsersTab.jsx', anchor: "role === 'super_admin'" }],
};

/** Real fs-backed lookup used by the coverage/validation tests. Kept tiny and dependency-free. */
export function anchorExistsInFile(fileText, anchor) {
  return typeof fileText === 'string' && fileText.includes(anchor);
}

// Defect 8 / Codex "scanner-derived market authority" (2026-09-2X): market classification and
// market EVIDENCE both live entirely outside this module now. Classification: productTruthMarket-
// Reachability.js's createFileMarketClassifier() (naming convention + import-graph reachability,
// fails CLOSED to 'unknown'). Evidence: productTruthGateLib.js's deriveMarketEvidenceFromScanner(),
// fed by the scanner's own DISCOVERED marker locations (productTruthCapabilityScanner.js) - never
// by this file's CAPABILITY_ANCHORS map. CAPABILITY_ANCHORS's remaining, legitimate role is the
// DEFECT-7/9 coverage and source-presence checks above (a distinct concern from market authority);
// it is no longer imported or re-exported for any market-related purpose anywhere in the repo.
