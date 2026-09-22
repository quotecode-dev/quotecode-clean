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
    { file: 'src/components/PublicTools.jsx', anchor: 'const [rates, setRates] = useState(' },
    { file: 'src/components/PublicToolsEn.jsx', anchor: 'const [rates, setRates] = useState(' },
  ],
  public_unit_converter: [
    { file: 'src/components/PublicTools.jsx', anchor: 'convertUnits' },
    { file: 'src/components/PublicToolsEn.jsx', anchor: 'convertUnits' },
  ],
  // Note: the two files use different variable names (metalPricesILS vs metalPricesUSD) - a real,
  // deliberate difference (the Hebrew tool denominates in ILS, the English one in USD), not an
  // inconsistency to normalize away.
  public_metals_calculator: [
    { file: 'src/components/PublicTools.jsx', anchor: 'metalPricesILS' },
    { file: 'src/components/PublicToolsEn.jsx', anchor: 'metalPricesUSD' },
  ],
  public_crypto_calculator: [
    { file: 'src/components/PublicTools.jsx', anchor: 'cryptoPricesUSD' },
    { file: 'src/components/PublicToolsEn.jsx', anchor: 'cryptoPricesUSD' },
  ],
  business_settings: [{ file: 'src/components/SettingsTab.jsx', anchor: 'export default function SettingsTab' }],
  profile_prerequisites: [{ file: 'src/components/SettingsTab.jsx', anchor: 'pf-settings-business_tax_id' }],
  plan_trial: [{ file: 'src/utils/accountEntitlement.js', anchor: 'TRIAL_EXPIRING_SOON_DAYS' }],
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

// Defect 8 (generalized market authority parity): market classification now lives in
// productTruthMarketReachability.js's createFileMarketClassifier(). That module replaced the
// original, hard-coded 2-pair Set implementation that used to live here - Codex (finding 2,
// 2026-09-24) correctly identified that a Set of 2 known literal paths does not generalize to any
// future file, and that everything outside those 2 pairs silently defaulted to 'both' (a fail-OPEN
// default masquerading as "shared code"). The replacement derives market from the real filesystem
// naming convention (generalized, fs-checked) plus real import-graph reachability from the two app
// entry points, and fails CLOSED to 'unknown' for anything neither signal resolves - see that
// module's own header for the full design. Re-exported here only for callers that already import
// classifyFileMarket from this file; no logic lives in this module any more.
export { createFileMarketClassifier } from './productTruthMarketReachability.js';
