// AI HELP CONTEXT V4 - the ONE shared help contract (frontend + chat-ai import THIS file; plain JS so Vite and Deno load the same bytes,
// same pattern as _shared/shortDate.js). Canonical detail: TEKANGO_AI_ARCHITECTURE.md §51 (AI-HELP-AVAILABILITY-001).
//
// AI-HELP-AVAILABILITY-001: "action blocked" never means "help blocked". While the user is authenticated, the tenant/account is
// safely resolved and the app shell is permitted, help stays available during validation / prerequisite / entitlement / conflict /
// recoverable network-or-server / incomplete-setup blocks. The browser publishes BOUNDED, STRUCTURED UI facts and blocker CODES only
// (never scraped text, never raw exceptions/SQL/provider text, never customer-controlled text); the server re-derives identity,
// tenant, market, entitlement and persisted-object facts and never lets browser context override them.

export const HELP_CONTRACT_VERSION = 4;
export const HELP_MODES = Object.freeze(['NORMAL_HELP', 'BLOCKED_WORKFLOW_HELP']);

// ---------------------------------------------------------------------------------------------------------- surfaces
export const HELP_SCREENS = Object.freeze([
  'dashboard', 'quote_history', 'quote_editor_new', 'quote_editor_edit', 'item_wizard', 'clients', 'catalog', 'finances',
  'settings', 'plans', 'admin', 'ai_chat', 'region_choice', 'public_quote', 'neutral',
]);
export const HELP_WORKFLOWS = Object.freeze([
  'overview', 'browse_quotes', 'create_quote', 'edit_quote', 'add_or_edit_item', 'manage_clients', 'manage_catalog', 'view_finances',
  'edit_business_profile', 'view_plans', 'admin_operations', 'share_quote', 'manage_attachments', 'ai_chat', 'setup_region', 'view_public_quote',
]);
export const HELP_SECTIONS = Object.freeze([
  'none', 'summary', 'list', 'search_filter', 'detail', 'client_details', 'items', 'totals', 'attachments', 'share_email',
  'share_whatsapp', 'print_pdf', 'wizard_what', 'wizard_pricing', 'wizard_details', 'wizard_review', 'business_details',
  'business_phone', 'business_tax_id', 'business_address', 'business_logo', 'region', 'plan_limits', 'trial', 'admin_users',
  'admin_overview', 'admin_protected_action', 'draft_conflict', 'draft_recovered', 'alert', 'transcript',
]);
// Modal / overlay the help was opened over (AI help stays available inside these).
export const HELP_MODALS = Object.freeze(['none', 'item_wizard', 'alert', 'draft_conflict', 'pricing', 'edit_client', 'email_confirm', 'delete_confirm', 'region_choice']);
export const OBJECT_KINDS = Object.freeze(['none', 'quote', 'client', 'service', 'business_profile', 'plan', 'admin_target']);

// Draft / persistence provenance of the CURRENT object (UNSAVED DRAFT AI CONTRACT). Local persistence is never "saved".
export const OBJECT_PROVENANCE = Object.freeze(['NONE', 'PERSISTED_QUOTE', 'UNSAVED_LOCAL_DRAFT', 'RECOVERED_LOCAL_DRAFT', 'STALE_SERVER_VERSION', 'UNKNOWN_SAVE_RESULT']);
export const LOCAL_WRITE_STATUS = Object.freeze(['none', 'written', 'failed', 'blocked', 'quota']);

// ---------------------------------------------------------------------------------------------------------- blockers
export const BLOCKER_TYPES = Object.freeze([
  'VALIDATION_BLOCKER', 'MISSING_PROFILE_PREREQUISITE', 'ENTITLEMENT_BLOCKER', 'AUTHORIZATION_BLOCKER', 'ACCOUNT_STATE_BLOCKER',
  'SERVER_ERROR', 'NETWORK_ERROR', 'DATA_INTEGRITY_BLOCKER', 'UNAVAILABLE_CAPABILITY', 'EXPIRED_OBJECT', 'MARKET_POLICY_BLOCKER',
  'OWNER_ACTION_REQUIRED',
]);
export const PERSISTENCE_STATES = Object.freeze(['not_attempted', 'not_persisted', 'persisted', 'partial', 'unknown', 'local_only', 'local_write_failed']);

// Closed navigation destinations (product-owned, click-required). `focus` targets are product-owned section ids, never selectors.
export const NAV_ACTIONS = Object.freeze([
  'open_dashboard', 'open_quote_history', 'open_new_quote', 'open_clients', 'open_catalog', 'open_finances', 'open_business_settings',
  'open_business_details', 'open_business_phone', 'open_business_tax_id', 'open_plan_information', 'open_selected_quote', 'open_admin',
]);
// Guidance-only resolution steps (explained in text, never executed, never a button).
export const GUIDANCE_ACTIONS = Object.freeze([
  'complete_required_fields', 'add_priced_item', 'retry_save', 'retry_later', 'check_connection', 'reselect_attachment', 'remove_attachment',
  'review_recovered_draft', 'choose_draft_version', 'save_as_draft_status', 'duplicate_as_new', 'contact_support', 'start_new_chat',
  'reauthenticate', 'select_region', 'upgrade_plan_info', 'free_storage',
]);
export const RESOLUTION_ACTIONS = Object.freeze([...NAV_ACTIONS, ...GUIDANCE_ACTIONS]);

// Field codes (never field VALUES).
export const FIELD_CODES = Object.freeze([
  'business_phone', 'business_tax_id', 'business_region', 'client_name', 'client_type', 'client_email', 'items', 'item_price',
  'item_quantity', 'item_measurements', 'item_description', 'status', 'valid_until', 'attachments', 'currency', 'project_name',
  'service_name', 'service_price', 'expense_amount',
]);

// The closed blocker catalog. Every blocker a browser may publish MUST be one of these codes; the type/operation/resolution come
// from HERE (the browser cannot invent a type or a resolution). `persistence` is the default persistence state for the code.
const B = (type, operation, subjectKind, retryable, resolution, persistence = 'not_persisted', fields = []) => Object.freeze({ type, operation, subjectKind, retryable, resolution: Object.freeze(resolution), persistence, fields: Object.freeze(fields) });
export const BLOCKER_CATALOG = Object.freeze({
  PROFILE_MISSING_PHONE: B('MISSING_PROFILE_PREREQUISITE', 'save_quote', 'business_profile', false, ['open_business_phone', 'complete_required_fields'], 'not_persisted', ['business_phone']),
  PROFILE_MISSING_TAX_ID: B('MISSING_PROFILE_PREREQUISITE', 'save_quote', 'business_profile', false, ['open_business_tax_id', 'complete_required_fields'], 'not_persisted', ['business_tax_id']),
  REGION_NOT_SELECTED: B('MISSING_PROFILE_PREREQUISITE', 'setup', 'business_profile', false, ['select_region'], 'not_attempted', ['business_region']),
  QUOTE_MISSING_CLIENT: B('VALIDATION_BLOCKER', 'save_quote', 'quote', false, ['complete_required_fields'], 'not_persisted', ['client_name']),
  QUOTE_MISSING_CLIENT_TYPE: B('VALIDATION_BLOCKER', 'save_quote', 'quote', false, ['complete_required_fields'], 'not_persisted', ['client_type']),
  QUOTE_INVALID_CLIENT_EMAIL: B('VALIDATION_BLOCKER', 'save_quote', 'quote', false, ['complete_required_fields'], 'not_persisted', ['client_email']),
  QUOTE_INCOMPLETE_ITEMS: B('VALIDATION_BLOCKER', 'save_quote', 'quote', false, ['add_priced_item'], 'not_persisted', ['items', 'item_price']),
  QUOTE_UNFINISHED_NON_DRAFT_STATUS: B('VALIDATION_BLOCKER', 'save_quote', 'quote', false, ['add_priced_item', 'save_as_draft_status'], 'not_persisted', ['status', 'items']),
  ITEM_MISSING_DESCRIPTION: B('VALIDATION_BLOCKER', 'add_item', 'quote', false, ['complete_required_fields'], 'not_attempted', ['item_description']),
  ITEM_MISSING_QUANTITY: B('VALIDATION_BLOCKER', 'add_item', 'quote', false, ['complete_required_fields'], 'not_attempted', ['item_quantity']),
  ITEM_MISSING_PRICE: B('VALIDATION_BLOCKER', 'add_item', 'quote', false, ['complete_required_fields'], 'not_attempted', ['item_price']),
  ITEM_MISSING_MEASUREMENTS: B('VALIDATION_BLOCKER', 'add_item', 'quote', false, ['complete_required_fields'], 'not_attempted', ['item_measurements']),
  MONTHLY_QUOTE_LIMIT_REACHED: B('ENTITLEMENT_BLOCKER', 'create_quote', 'plan', false, ['open_plan_information', 'upgrade_plan_info'], 'not_persisted'),
  ATTACHMENTS_REQUIRE_PRO: B('ENTITLEMENT_BLOCKER', 'attach_file', 'plan', false, ['open_plan_information', 'upgrade_plan_info'], 'not_attempted', ['attachments']),
  ATTACHMENT_FILE_TOO_LARGE: B('VALIDATION_BLOCKER', 'attach_file', 'quote', false, ['reselect_attachment'], 'not_attempted', ['attachments']),
  ATTACHMENT_TOTAL_EXCEEDED: B('ENTITLEMENT_BLOCKER', 'attach_file', 'quote', false, ['remove_attachment', 'free_storage'], 'not_attempted', ['attachments']),
  ATTACHMENT_UPLOAD_FAILED_PRE_SAVE: B('NETWORK_ERROR', 'save_quote', 'quote', true, ['retry_save', 'check_connection', 'reselect_attachment'], 'not_persisted', ['attachments']),
  ATTACHMENT_PARTIAL_AFTER_SAVE: B('DATA_INTEGRITY_BLOCKER', 'save_quote', 'quote', true, ['open_selected_quote', 'reselect_attachment'], 'partial', ['attachments']),
  ATTACHMENT_REMOVAL_PENDING: B('OWNER_ACTION_REQUIRED', 'save_quote', 'quote', false, ['retry_save'], 'local_only', ['attachments']),
  QUOTE_SAVE_SERVER_ERROR: B('SERVER_ERROR', 'save_quote', 'quote', true, ['retry_save', 'retry_later', 'contact_support'], 'not_persisted'),
  QUOTE_SAVE_NETWORK_ERROR: B('NETWORK_ERROR', 'save_quote', 'quote', true, ['check_connection', 'retry_save'], 'unknown'),
  QUOTE_SAVE_RESULT_UNKNOWN: B('DATA_INTEGRITY_BLOCKER', 'save_quote', 'quote', true, ['open_quote_history', 'retry_save'], 'unknown'),
  QUOTE_SAVE_VERIFY_FAILED: B('DATA_INTEGRITY_BLOCKER', 'save_quote', 'quote', true, ['retry_later', 'retry_save'], 'not_persisted'),
  QUOTE_IMMUTABLE_SIGNED: B('DATA_INTEGRITY_BLOCKER', 'edit_quote', 'quote', false, ['duplicate_as_new'], 'not_attempted', ['status']),
  QUOTE_EXPIRED: B('EXPIRED_OBJECT', 'sign_quote', 'quote', false, ['duplicate_as_new'], 'not_attempted', ['valid_until']),
  QUOTE_PERMISSION_DENIED: B('AUTHORIZATION_BLOCKER', 'save_quote', 'quote', false, ['reauthenticate', 'contact_support'], 'not_persisted'),
  SESSION_EXPIRED: B('AUTHORIZATION_BLOCKER', 'any', 'none', false, ['reauthenticate'], 'unknown'),
  MARKET_CURRENCY_POLICY: B('MARKET_POLICY_BLOCKER', 'save_quote', 'quote', false, ['complete_required_fields'], 'not_persisted', ['currency']),
  EMAIL_CLIENT_NO_EMAIL: B('VALIDATION_BLOCKER', 'send_email', 'quote', false, ['open_selected_quote', 'complete_required_fields'], 'not_attempted', ['client_email']),
  EMAIL_SEND_FAILED: B('SERVER_ERROR', 'send_email', 'quote', true, ['retry_later', 'contact_support'], 'not_persisted'),
  EMAIL_SEND_NETWORK: B('NETWORK_ERROR', 'send_email', 'quote', true, ['check_connection', 'retry_later'], 'unknown'),
  EMAIL_BOUNCED: B('VALIDATION_BLOCKER', 'send_email', 'quote', false, ['open_clients', 'complete_required_fields'], 'persisted', ['client_email']),
  PDF_GENERATION_FAILED: B('SERVER_ERROR', 'print_pdf', 'quote', true, ['retry_later'], 'not_attempted'),
  WHATSAPP_REQUIRES_PRO: B('ENTITLEMENT_BLOCKER', 'share_whatsapp', 'plan', false, ['open_plan_information'], 'not_attempted'),
  PLAN_FEATURE_LOCKED: B('ENTITLEMENT_BLOCKER', 'use_plan_feature', 'plan', false, ['open_plan_information', 'upgrade_plan_info'], 'not_attempted'),
  DRAFT_STORAGE_FAILED: B('DATA_INTEGRITY_BLOCKER', 'local_draft', 'quote', true, ['retry_save', 'free_storage'], 'local_write_failed'),
  DRAFT_RECOVERED_UNSAVED: B('OWNER_ACTION_REQUIRED', 'local_draft', 'quote', false, ['review_recovered_draft', 'retry_save'], 'local_only'),
  DRAFT_CONFLICT_SERVER_CHANGED: B('DATA_INTEGRITY_BLOCKER', 'local_draft', 'quote', false, ['choose_draft_version'], 'local_only'),
  DRAFT_ATTACHMENTS_MISSING: B('OWNER_ACTION_REQUIRED', 'local_draft', 'quote', false, ['reselect_attachment'], 'local_only', ['attachments']),
  CLIENT_SAVE_FAILED: B('SERVER_ERROR', 'save_client', 'client', true, ['retry_save', 'retry_later'], 'not_persisted'),
  CLIENT_DELETE_HAS_QUOTES: B('DATA_INTEGRITY_BLOCKER', 'delete_client', 'client', false, ['open_quote_history'], 'not_attempted'),
  SETTINGS_SAVE_FAILED: B('SERVER_ERROR', 'save_settings', 'business_profile', true, ['retry_save', 'retry_later'], 'not_persisted'),
  CATALOG_SAVE_FAILED: B('SERVER_ERROR', 'save_service', 'service', true, ['retry_save', 'retry_later'], 'not_persisted'),
  CATALOG_INVALID_SERVICE: B('VALIDATION_BLOCKER', 'save_service', 'service', false, ['complete_required_fields'], 'not_attempted', ['service_name', 'service_price']),
  EXPENSE_SAVE_FAILED: B('SERVER_ERROR', 'save_expense', 'none', true, ['retry_save', 'retry_later'], 'not_persisted', ['expense_amount']),
  DATA_LOAD_FAILED: B('NETWORK_ERROR', 'load_data', 'none', true, ['check_connection', 'retry_later'], 'not_attempted'),
  TRIAL_EXPIRED: B('ACCOUNT_STATE_BLOCKER', 'use_pro_feature', 'plan', false, ['open_plan_information'], 'not_attempted'),
  CHECKOUT_UNAVAILABLE: B('UNAVAILABLE_CAPABILITY', 'checkout', 'plan', false, ['contact_support'], 'not_attempted'),
  INVOICING_UNAVAILABLE: B('UNAVAILABLE_CAPABILITY', 'issue_invoice', 'none', false, ['contact_support'], 'not_attempted'),
  PUBLIC_SIGNING_ISSUER_BLOCKED: B('AUTHORIZATION_BLOCKER', 'sign_quote', 'quote', false, ['open_selected_quote'], 'not_attempted'),
  ADMIN_PROTECTED_ACTION: B('OWNER_ACTION_REQUIRED', 'admin_action', 'admin_target', false, ['reauthenticate'], 'not_attempted'),
  ADMIN_NOT_AUTHORIZED: B('AUTHORIZATION_BLOCKER', 'admin_action', 'admin_target', false, ['open_dashboard'], 'not_attempted'),
  AI_PROVIDER_FAILED: B('SERVER_ERROR', 'ai_chat', 'none', true, ['retry_later'], 'not_attempted'),
  AI_TRANSCRIPT_LIMIT: B('VALIDATION_BLOCKER', 'ai_chat', 'none', false, ['start_new_chat'], 'not_attempted'),
  AI_STALE_CONTEXT: B('DATA_INTEGRITY_BLOCKER', 'ai_chat', 'none', true, ['start_new_chat'], 'not_attempted'),
});
export const BLOCKER_CODES = Object.freeze(Object.keys(BLOCKER_CATALOG));

// Bounded, typed facts a surface may publish (keys closed; values booleans / small non-negative integers / closed enum strings).
export const FACT_SPECS = Object.freeze({
  hasClient: 'bool', hasProject: 'bool', hasClientType: 'bool', itemCount: 'count', pricedItemCount: 'count', unpricedItemCount: 'count',
  sectionCount: 'count', attachmentCount: 'count', pendingAttachmentCount: 'count', pendingRemovalCount: 'count', unsavedChanges: 'bool',
  searchActive: 'bool', filterStatus: ['All', 'draft', 'sent', 'approved', 'paid'], visibleQuoteCount: 'count', totalQuoteCount: 'count',
  selectedQuoteOwned: 'bool', selectedQuoteExpired: 'bool', selectedQuoteImmutable: 'bool', clientCount: 'count', serviceCount: 'count',
  financeRange: ['monthly', 'yearly', 'custom', 'all'], expenseCount: 'count', monthlyQuotesUsed: 'count', monthlyQuoteLimit: 'limit',
  wizardAction: ['add', 'edit'], wizardStep: ['what', 'pricing', 'details', 'review'], pricingMethod: ['fixed', 'units', 'area', 'linear'],
  measurementCount: 'count', hasQuantity: 'bool', hasUnitPrice: 'bool', hasSpecification: 'bool', structureMode: ['regular', 'divided'],
  emailSendState: ['idle', 'sending', 'sent', 'failed'], pdfState: ['idle', 'generating', 'ready', 'failed'], saveStage: ['idle', 'validating', 'verifying', 'uploading', 'persisting', 'done', 'failed'],
  profilePhoneComplete: 'bool', profileTaxIdComplete: 'bool', adminSection: ['overview', 'users', 'plans', 'activity', 'ai_support'],
  transcriptLength: 'count', transcriptMessages: 'count', dataLoadError: 'bool', draftRecoveryState: ['none', 'recovered', 'conflict', 'dismissed'],
});
export const HELP_LIMITS = Object.freeze({ maxBlockers: 8, maxFacts: 40, maxCount: 100000, maxAgeMs: 10 * 60 * 1000, maxIdLength: 64 });

// ---------------------------------------------------------------------------------------------------------- sanitizer
const isStr = (v) => typeof v === 'string';
const inList = (list, v) => isStr(v) && list.includes(v);
const OPAQUE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT = /^[A-Za-z0-9:_-]{1,128}$/;
const cleanCount = (v, max = HELP_LIMITS.maxCount) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : null);
const cleanTime = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null);

function sanitizeFacts(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const [k, spec] of Object.entries(FACT_SPECS)) {
    if (!(k in raw) || n >= HELP_LIMITS.maxFacts) continue;
    const v = raw[k];
    if (spec === 'bool') { if (typeof v === 'boolean') { out[k] = v; n++; } } else if (spec === 'count') { const c = cleanCount(v); if (c !== null) { out[k] = c; n++; } } else if (spec === 'limit') {
      if (v === 'unlimited') { out[k] = 'unlimited'; n++; } else { const c = cleanCount(v); if (c !== null) { out[k] = c; n++; } }
    } else if (Array.isArray(spec) && inList(spec, v)) { out[k] = v; n++; }
  }
  return out;
}

function sanitizeBlocker(raw, now) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!inList(BLOCKER_CODES, raw.code)) return null;
  const cat = BLOCKER_CATALOG[raw.code];
  const fields = Array.isArray(raw.fieldCodes) ? raw.fieldCodes.filter((f) => inList(FIELD_CODES, f)).slice(0, 12) : [];
  const occurredAt = cleanTime(raw.occurredAt);
  return {
    id: isStr(raw.id) && OPAQUE_ID.test(raw.id) ? raw.id : raw.code,
    code: raw.code,
    // type / operation / subject / retryability / resolution are CATALOG-owned - the browser cannot redefine them
    type: cat.type, operation: cat.operation, subjectKind: cat.subjectKind, retryable: cat.retryable,
    stage: inList(FACT_SPECS.saveStage, raw.stage) ? raw.stage : null,
    fieldCodes: fields.length ? [...new Set(fields)] : [...cat.fields],
    persistence: inList(PERSISTENCE_STATES, raw.persistence) ? raw.persistence : cat.persistence,
    resolution: [...cat.resolution],
    occurredAt,
    stale: occurredAt !== null && now - occurredAt > HELP_LIMITS.maxAgeMs,
  };
}

// Strict, fail-open-to-null sanitizer (a malformed context never rejects the chat; it simply carries no context).
export function sanitizeHelpContext(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!inList(HELP_SCREENS, raw.screen)) return null;
  const blockers = Array.isArray(raw.blockers) ? raw.blockers.map((b) => sanitizeBlocker(b, now)).filter(Boolean).slice(0, HELP_LIMITS.maxBlockers) : [];
  const seen = new Set(); const unique = blockers.filter((b) => (seen.has(b.code) ? false : seen.add(b.code)));
  const obj = raw.object && typeof raw.object === 'object' ? raw.object : {};
  const draft = raw.draft && typeof raw.draft === 'object' ? raw.draft : null;
  const capturedAt = cleanTime(raw.capturedAt);
  const ctx = {
    version: HELP_CONTRACT_VERSION,
    revision: cleanCount(raw.revision, Number.MAX_SAFE_INTEGER) ?? 0,
    screen: raw.screen,
    section: inList(HELP_SECTIONS, raw.section) ? raw.section : 'none',
    modal: inList(HELP_MODALS, raw.modal) ? raw.modal : 'none',
    workflowId: inList(HELP_WORKFLOWS, raw.workflowId) ? raw.workflowId : null,
    step: inList(FACT_SPECS.wizardStep, raw.step) ? raw.step : null,
    object: {
      kind: inList(OBJECT_KINDS, obj.kind) ? obj.kind : 'none',
      // a quote id is only ever a REFERENCE the server re-authorizes; never trusted for ownership
      id: isStr(obj.id) && UUID.test(obj.id) ? obj.id : null,
      provenance: inList(OBJECT_PROVENANCE, obj.provenance) ? obj.provenance : 'NONE',
      serverFingerprint: isStr(obj.serverFingerprint) && FINGERPRINT.test(obj.serverFingerprint) ? obj.serverFingerprint : null,
    },
    draft: draft ? {
      mode: inList(['create', 'edit'], draft.mode) ? draft.mode : null,
      localDraftId: isStr(draft.localDraftId) && OPAQUE_ID.test(draft.localDraftId) ? draft.localDraftId : null,
      dirty: typeof draft.dirty === 'boolean' ? draft.dirty : null,
      localWriteStatus: inList(LOCAL_WRITE_STATUS, draft.localWriteStatus) ? draft.localWriteStatus : 'none',
      lastLocalWriteAt: cleanTime(draft.lastLocalWriteAt),
      serverComparison: inList(['unchanged', 'changed', 'missing', 'immutable', 'not_applicable'], draft.serverComparison) ? draft.serverComparison : 'not_applicable',
      recoveryState: inList(FACT_SPECS.draftRecoveryState, draft.recoveryState) ? draft.recoveryState : 'none',
    } : null,
    facts: sanitizeFacts(raw.facts),
    blockers: unique,
    capturedAt,
    stale: capturedAt !== null && now - capturedAt > HELP_LIMITS.maxAgeMs,
  };
  ctx.mode = unique.some((b) => !b.stale) ? 'BLOCKED_WORKFLOW_HELP' : 'NORMAL_HELP';
  return ctx;
}

// ---------------------------------------------------------------------------------------------------------- deterministic explanations
// Product-owned, per-language, per-market-neutral text (no currency, no Local tax wording in EN). Field / action names are labels.
export const FIELD_LABELS = Object.freeze({
  business_phone: { he: 'טלפון העסק', en: 'Business Phone' }, business_tax_id: { he: 'ח.פ / עוסק מורשה / פטור', en: 'Tax ID' },
  business_region: { he: 'אזור העסק (מקומי / בינלאומי)', en: 'business region (Local / International)' }, client_name: { he: 'שם הלקוח', en: 'client name' },
  client_type: { he: 'סוג הלקוח', en: 'client type' }, client_email: { he: 'אימייל הלקוח', en: 'client email' }, items: { he: 'מוצר או עבודה', en: 'a product or work item' },
  item_price: { he: 'מחיר', en: 'price' }, item_quantity: { he: 'כמות', en: 'quantity' }, item_measurements: { he: 'מידות', en: 'measurements' },
  item_description: { he: 'תיאור הפריט', en: 'item description' }, status: { he: 'סטטוס ההצעה', en: 'quote status' }, valid_until: { he: 'תוקף ההצעה', en: 'validity date' },
  attachments: { he: 'קבצים מצורפים', en: 'attachments' }, currency: { he: 'מטבע', en: 'currency' }, project_name: { he: 'שם הפרויקט', en: 'project name' },
  service_name: { he: 'שם השירות', en: 'service name' }, service_price: { he: 'מחיר השירות', en: 'service price' }, expense_amount: { he: 'סכום ההוצאה', en: 'expense amount' },
});
export const NAV_LABELS = Object.freeze({
  open_dashboard: { he: 'מעבר לדשבורד', en: 'Go to the dashboard' }, open_quote_history: { he: 'פתיחת היסטוריית הצעות מחיר', en: 'Open quote history' },
  open_new_quote: { he: 'יצירת הצעת מחיר חדשה', en: 'Create a new quote' }, open_clients: { he: 'פתיחת לקוחות', en: 'Open clients' },
  open_catalog: { he: 'פתיחת קטלוג', en: 'Open catalog' }, open_finances: { he: 'פתיחת פיננסים', en: 'Open finances' },
  open_business_settings: { he: 'פתיחת הגדרות עסק', en: 'Open business settings' }, open_business_details: { he: 'הגדרות עסק ← פרטי העסק', en: 'Settings → Business details' },
  open_business_phone: { he: 'הגדרות עסק ← טלפון העסק', en: 'Settings → Business phone' }, open_business_tax_id: { he: 'הגדרות עסק ← ח.פ / עוסק', en: 'Settings → Tax ID' },
  open_plan_information: { he: 'מידע על המסלול שלי', en: 'View my plan information' }, open_selected_quote: { he: 'פתיחת ההצעה שנבחרה', en: 'Open the selected quote' },
  open_admin: { he: 'פתיחת ניהול', en: 'Open Admin' },
});
const GUIDANCE_TEXT = Object.freeze({
  complete_required_fields: { he: 'השלימו את השדות החסרים', en: 'fill in the missing fields' },
  add_priced_item: { he: 'הוסיפו מוצר או עבודה עם מחיר', en: 'add a product or work item with a price' },
  retry_save: { he: 'נסו לשמור שוב', en: 'try saving again' }, retry_later: { he: 'נסו שוב בעוד כמה דקות', en: 'try again in a few minutes' },
  check_connection: { he: 'בדקו את החיבור לאינטרנט', en: 'check your internet connection' }, reselect_attachment: { he: 'בחרו את הקובץ מחדש', en: 'select the file again' },
  remove_attachment: { he: 'הסירו קובץ קיים', en: 'remove an existing file' }, review_recovered_draft: { he: 'עברו על הטיוטה ששוחזרה ושמרו אותה', en: 'review the recovered draft and save it' },
  choose_draft_version: { he: 'בחרו איזו גרסה לשמור (הטיוטה המקומית או הגרסה השמורה)', en: 'choose which version to keep (your local draft or the saved version)' },
  save_as_draft_status: { he: 'או שמרו אותה בסטטוס טיוטה', en: 'or save it with the Draft status' }, duplicate_as_new: { he: 'שכפלו אותה להצעה חדשה', en: 'duplicate it into a new quote' },
  contact_support: { he: 'פנו לתמיכה', en: 'contact support' }, start_new_chat: { he: 'התחילו שיחה חדשה בצ׳אט', en: 'start a new chat' },
  reauthenticate: { he: 'התחברו מחדש', en: 'sign in again' }, select_region: { he: 'בחרו אזור לעסק', en: 'choose your business region' },
  upgrade_plan_info: { he: 'עיינו במידע על המסלולים', en: 'review the plan information' }, free_storage: { he: 'פנו מקום', en: 'free up space' },
});
const WHY = Object.freeze({
  PROFILE_MISSING_PHONE: { he: 'לפני שמירת הצעת מחיר ראשונה חובה להשלים את טלפון העסק בהגדרות העסק.', en: 'Before you can save your first quote, your Business Phone must be filled in under Business Settings.' },
  PROFILE_MISSING_TAX_ID: { he: 'לפני שמירת הצעת מחיר ראשונה חובה להשלים ח.פ / עוסק מורשה / פטור בהגדרות העסק.', en: 'Before you can save your first quote, your Tax ID must be filled in under Business Settings.' },
  REGION_NOT_SELECTED: { he: 'העסק עדיין לא בחר אזור (מקומי / בינלאומי), ולכן השפה, המטבע והמסים עוד לא נקבעו.', en: 'Your business has not chosen a region (Local / International) yet, so language, currency and tax rules are not set.' },
  QUOTE_MISSING_CLIENT: { he: 'חסר שם לקוח בהצעה.', en: 'The quote has no client name yet.' },
  QUOTE_MISSING_CLIENT_TYPE: { he: 'חסר סוג לקוח (עסקי / פרטי).', en: 'The client type (business / private) is not chosen yet.' },
  QUOTE_INVALID_CLIENT_EMAIL: { he: 'כתובת האימייל של הלקוח אינה תקינה.', en: "The client's email address is not valid." },
  QUOTE_INCOMPLETE_ITEMS: { he: 'בהצעה אין עדיין מוצר או עבודה עם מחיר.', en: 'The quote has no product or work item with a price yet.' },
  QUOTE_UNFINISHED_NON_DRAFT_STATUS: { he: 'הצעה לא גמורה (בלי פריט עם מחיר) לא יכולה להישמר בסטטוס נשלח / אושר / שולם.', en: 'An unfinished quote (no priced item) cannot be saved as Sent / Approved / Paid.' },
  ITEM_MISSING_DESCRIPTION: { he: 'לפריט אין עדיין תיאור.', en: 'The item has no description yet.' },
  ITEM_MISSING_QUANTITY: { he: 'לפריט חסרה כמות.', en: 'The item is missing a quantity.' },
  ITEM_MISSING_PRICE: { he: 'לפריט חסר מחיר.', en: 'The item is missing a price.' },
  ITEM_MISSING_MEASUREMENTS: { he: 'לפריט חסרות מידות.', en: 'The item is missing measurements.' },
  MONTHLY_QUOTE_LIMIT_REACHED: { he: 'הגעת למכסת ההצעות החודשית של המסלול שלך, ולכן אי אפשר ליצור הצעה חדשה החודש.', en: "You have reached your plan's monthly quote limit, so a new quote cannot be created this month." },
  ATTACHMENTS_REQUIRE_PRO: { he: 'צירוף קבצים זמין רק במסלול PRO.', en: 'File attachments are available on the PRO plan only.' },
  ATTACHMENT_FILE_TOO_LARGE: { he: 'הקובץ גדול מהמגבלה לקובץ בודד.', en: 'The file is larger than the per-file limit.' },
  ATTACHMENT_TOTAL_EXCEEDED: { he: 'הגעת למגבלת נפח הקבצים הכוללת.', en: 'You have reached the total attachment storage limit.' },
  ATTACHMENT_UPLOAD_FAILED_PRE_SAVE: { he: 'העלאת קובץ נכשלה, ולכן ההצעה לא נשמרה.', en: 'A file upload failed, so the quote was not saved.' },
  ATTACHMENT_PARTIAL_AFTER_SAVE: { he: 'ההצעה נשמרה, אבל חלק מהקבצים לא הועלו.', en: 'The quote was saved, but some files were not uploaded.' },
  ATTACHMENT_REMOVAL_PENDING: { he: 'הסרת קבצים ממתינה לשמירה - הקבצים עדיין קיימים עד שתשמרו.', en: 'File removals are staged - the files still exist until you save.' },
  QUOTE_SAVE_SERVER_ERROR: { he: 'השרת החזיר שגיאה, וההצעה לא נשמרה.', en: 'The server returned an error and the quote was not saved.' },
  QUOTE_SAVE_NETWORK_ERROR: { he: 'בעיית רשת בזמן השמירה - לא ידוע בוודאות אם ההצעה נשמרה.', en: 'A network problem interrupted saving - it is not certain whether the quote was saved.' },
  QUOTE_SAVE_RESULT_UNKNOWN: { he: 'לא ניתן לאשר אם השמירה הצליחה.', en: 'It could not be confirmed whether the save succeeded.' },
  QUOTE_SAVE_VERIFY_FAILED: { he: 'לא ניתן היה לאמת את ההצעה מול השרת, והשמירה בוטלה כדי להגן על הנתונים.', en: 'The quote could not be verified against the server, so saving was cancelled to protect the data.' },
  QUOTE_IMMUTABLE_SIGNED: { he: 'הצעה שאושרה / נחתמה אינה ניתנת לעריכה.', en: 'An approved / signed quote cannot be edited.' },
  QUOTE_EXPIRED: { he: 'תוקף ההצעה פג, ולכן אי אפשר לאשר או לחתום עליה. היא עדיין ניתנת לצפייה.', en: 'The quote has expired, so it can no longer be accepted or signed. It can still be viewed.' },
  QUOTE_PERMISSION_DENIED: { he: 'אין הרשאה לבצע את הפעולה הזו.', en: 'You do not have permission for this action.' },
  SESSION_EXPIRED: { he: 'פג תוקף ההתחברות.', en: 'Your session has expired.' },
  MARKET_CURRENCY_POLICY: { he: 'המטבע שנבחר אינו מותר לאזור העסק.', en: "The chosen currency is not allowed for your business region." },
  EMAIL_CLIENT_NO_EMAIL: { he: 'ללקוח אין כתובת אימייל, ולכן אי אפשר לשלוח את ההצעה במייל.', en: 'The client has no email address, so the quote cannot be emailed.' },
  EMAIL_SEND_FAILED: { he: 'שליחת האימייל נכשלה - ההצעה לא נשלחה.', en: 'Sending the email failed - the quote was not sent.' },
  EMAIL_SEND_NETWORK: { he: 'בעיית רשת בזמן שליחת האימייל - לא ידוע אם נשלח.', en: 'A network problem interrupted the email - it is not certain it was sent.' },
  EMAIL_BOUNCED: { he: 'כתובת האימייל של הלקוח החזירה שגיאה (לא קיימת).', en: "The client's email address bounced (does not exist)." },
  PDF_GENERATION_FAILED: { he: 'יצירת ה-PDF נכשלה.', en: 'Creating the PDF failed.' },
  WHATSAPP_REQUIRES_PRO: { he: 'שליחה ב-WhatsApp זמינה רק במסלול PRO.', en: 'Sending via WhatsApp is available on the PRO plan only.' },
  PLAN_FEATURE_LOCKED: { he: 'הפעולה הזו (עריכה / שכפול / מחיקה) אינה כלולה במסלול הנוכחי שלך.', en: 'This action (edit / duplicate / delete) is not included in your current plan.' },
  DRAFT_STORAGE_FAILED: { he: 'שמירת הטיוטה המקומית במכשיר נכשלה - שינויים שלא נשמרו עלולים ללכת לאיבוד ברענון.', en: 'Saving the local draft on this device failed - unsaved changes could be lost on a refresh.' },
  DRAFT_RECOVERED_UNSAVED: { he: 'שוחזרה טיוטה מקומית שלא נשמרה - היא קיימת רק במכשיר הזה עד שתשמרו.', en: 'A local unsaved draft was recovered - it exists only on this device until you save it.' },
  DRAFT_CONFLICT_SERVER_CHANGED: { he: 'ההצעה השמורה השתנתה מאז שהטיוטה המקומית נוצרה.', en: 'The saved quote changed after your local draft was created.' },
  DRAFT_ATTACHMENTS_MISSING: { he: 'חלק מהקבצים של הטיוטה לא נשמרו מקומית וצריך לבחור אותם מחדש.', en: 'Some draft files were not kept locally and must be selected again.' },
  CLIENT_SAVE_FAILED: { he: 'שמירת הלקוח נכשלה.', en: 'Saving the client failed.' },
  CLIENT_DELETE_HAS_QUOTES: { he: 'ללקוח יש הצעות מחיר, ולכן מחיקתו חסומה כדי לשמור על ההצעות.', en: 'The client has quotes, so deleting it is blocked to protect those quotes.' },
  SETTINGS_SAVE_FAILED: { he: 'שמירת הגדרות העסק נכשלה.', en: 'Saving the business settings failed.' },
  CATALOG_SAVE_FAILED: { he: 'שמירת פריט הקטלוג נכשלה.', en: 'Saving the catalog item failed.' },
  CATALOG_INVALID_SERVICE: { he: 'לפריט הקטלוג חסר שם או מחיר תקין.', en: 'The catalog item is missing a name or a valid price.' },
  EXPENSE_SAVE_FAILED: { he: 'שמירת ההוצאה נכשלה.', en: 'Saving the expense failed.' },
  DATA_LOAD_FAILED: { he: 'טעינת הנתונים נכשלה.', en: 'Loading the data failed.' },
  TRIAL_EXPIRED: { he: 'תקופת הניסיון הסתיימה, ולכן יכולות PRO אינן פעילות.', en: 'Your trial has ended, so PRO features are not active.' },
  CHECKOUT_UNAVAILABLE: { he: 'ל-TEKANGO אין כרגע סליקה או תשלום אונליין.', en: 'TEKANGO has no online checkout or payment processing right now.' },
  INVOICING_UNAVAILABLE: { he: 'הפקת חשבוניות אינה זמינה כרגע ב-TEKANGO.', en: 'Invoice issuing is not available in TEKANGO right now.' },
  PUBLIC_SIGNING_ISSUER_BLOCKED: { he: 'העסק המנפיק אינו יכול לחתום על ההצעה שלו עצמו - רק הלקוח חותם.', en: 'The issuing business cannot sign its own quote - only the client signs.' },
  ADMIN_PROTECTED_ACTION: { he: 'פעולת ניהול מוגנת דורשת אימות מחדש.', en: 'A protected Admin action requires re-authentication.' },
  ADMIN_NOT_AUTHORIZED: { he: 'אזור הניהול אינו זמין לחשבון הזה.', en: 'The Admin area is not available to this account.' },
  AI_PROVIDER_FAILED: { he: 'שירות ה-AI לא הגיב.', en: 'The AI service did not respond.' },
  AI_TRANSCRIPT_LIMIT: { he: 'השיחה ארוכה מדי.', en: 'This conversation has become too long.' },
  AI_STALE_CONTEXT: { he: 'המסך השתנה מאז ההודעה הקודמת.', en: 'The screen changed since the previous message.' },
});
const PERSISTENCE_TEXT = Object.freeze({
  not_persisted: { he: 'שום דבר לא נשמר בשרת.', en: 'Nothing was saved to the server.' },
  unknown: { he: 'לא ידוע בוודאות אם השינוי נשמר בשרת - בדקו בהיסטוריית ההצעות לפני שמנסים שוב.', en: 'It is not certain whether the change reached the server - check Quote History before retrying.' },
  partial: { he: 'חלק מהשינוי נשמר וחלק לא.', en: 'Part of the change was saved and part was not.' },
  local_only: { he: 'השינויים שמורים רק מקומית במכשיר הזה - לא בשרת.', en: 'The changes are stored only locally on this device - not on the server.' },
  local_write_failed: { he: 'גם השמירה המקומית במכשיר נכשלה.', en: 'Even the local save on this device failed.' },
});

export function explainBlocker(blocker, lang) {
  const L = lang === 'he' ? 'he' : 'en';
  const why = WHY[blocker.code]?.[L] || '';
  const fields = (blocker.fieldCodes || []).filter((f) => FIELD_LABELS[f]).map((f) => FIELD_LABELS[f][L]);
  const missing = blocker.type === 'MISSING_PROFILE_PREREQUISITE' || blocker.type === 'VALIDATION_BLOCKER'
    ? (fields.length ? (L === 'he' ? ` חסר: ${fields.join(', ')}.` : ` Missing: ${fields.join(', ')}.`) : '') : '';
  const persistence = PERSISTENCE_TEXT[blocker.persistence]?.[L] ? ` ${PERSISTENCE_TEXT[blocker.persistence][L]}` : '';
  const steps = (blocker.resolution || []).map((a) => (GUIDANCE_TEXT[a] ? GUIDANCE_TEXT[a][L] : NAV_LABELS[a] ? NAV_LABELS[a][L] : null)).filter(Boolean);
  const next = steps.length ? (L === 'he' ? ` הצעד הבא: ${steps.join('; ')}.` : ` Next step: ${steps.join('; ')}.`) : '';
  return `${why}${missing}${persistence}${next}`.trim();
}

const PROVENANCE_TEXT = Object.freeze({
  PERSISTED_QUOTE: { he: 'ההצעה הזו שמורה בשרת.', en: 'This quote is saved on the server.' },
  UNSAVED_LOCAL_DRAFT: { he: 'זו טיוטה שעוד לא נשמרה: היא קיימת רק מקומית במכשיר הזה ולא בשרת. כדי שתישמר בחשבון יש ללחוץ שמירה.', en: 'This is an unsaved draft: it exists only locally on this device, not on the server. To keep it in your account, save it.' },
  RECOVERED_LOCAL_DRAFT: { he: 'זו טיוטה מקומית ששוחזרה ועדיין לא נשמרה בשרת - היא קיימת רק במכשיר הזה עד שתשמרו.', en: 'This is a recovered local draft that is not saved on the server yet - it exists only on this device until you save it.' },
  STALE_SERVER_VERSION: { he: 'הגרסה השמורה בשרת השתנתה מאז הטיוטה המקומית - יש לבחור איזו גרסה לשמור.', en: 'The saved server version changed after your local draft - choose which version to keep.' },
  UNKNOWN_SAVE_RESULT: { he: 'לא ידוע בוודאות אם השמירה האחרונה הגיעה לשרת - בדקו בהיסטוריית ההצעות.', en: 'It is not certain whether the last save reached the server - check Quote History.' },
  NONE: { he: 'אין כרגע הצעה פתוחה.', en: 'No quote is open right now.' },
});
/** @param {string} provenance @param {string} lang @param {any} [draft] */
export function explainProvenance(provenance, lang, draft = null) {
  const L = lang === 'he' ? 'he' : 'en';
  let t = (PROVENANCE_TEXT[provenance] || PROVENANCE_TEXT.NONE)[L];
  if (draft?.localWriteStatus === 'failed' || draft?.localWriteStatus === 'quota' || draft?.localWriteStatus === 'blocked') t += ` ${PERSISTENCE_TEXT.local_write_failed[L]}`;
  return t;
}

// Navigation filter: only NAV actions, only those the blockers / screen make relevant, never admin unless server-verified admin,
// never the selected quote unless it was authorized this turn.
/** @param {{ ctx?: any, isAdmin?: boolean, hasSelectedQuote?: boolean }} [opts] */
export function allowedNavigation({ ctx, isAdmin = false, hasSelectedQuote = false } = {}) {
  const out = new Set();
  for (const b of ctx?.blockers || []) for (const a of b.resolution) if (NAV_ACTIONS.includes(a)) out.add(a);
  if (!out.size) ['open_quote_history', 'open_new_quote', 'open_clients', 'open_business_settings', 'open_catalog', 'open_finances', 'open_plan_information', 'open_dashboard'].forEach((a) => out.add(a));
  if (isAdmin && ctx?.screen === 'admin') out.add('open_admin'); else out.delete('open_admin');
  if (!hasSelectedQuote) out.delete('open_selected_quote');
  return [...out];
}

// ---------------------------------------------------------------------------------------------------------- transcript bounds
// The ONE set of chat transcript limits (chat-ai validation.ts imports these). The widget bounds what it sends so a long chat
// never turns into "help unavailable": the oldest turns are dropped (AI_TRANSCRIPT_LIMIT is published and the user is told).
export const TRANSCRIPT_LIMITS = Object.freeze({ maxMessages: 40, maxMessageLength: 4000, maxTotalLength: 20000 });
export function boundTranscript(messages, limits = TRANSCRIPT_LIMITS) {
  const list = Array.isArray(messages) ? messages.filter((m) => m && typeof m.content === 'string') : [];
  const out = []; let total = 0; let truncated = false;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    const content = m.content.length > limits.maxMessageLength ? m.content.slice(0, limits.maxMessageLength) : m.content;
    if (content !== m.content) truncated = true;
    if (out.length >= limits.maxMessages || total + content.length > limits.maxTotalLength) break;
    out.unshift({ role: m.role, content }); total += content.length;
  }
  const cut = out.length < list.length;
  // only a CUT transcript is re-aligned to start at a user turn (an intact chat keeps its opening assistant greeting, which the
  // server has always accepted); a chat within the limits is never reported as trimmed
  if (cut) while (out.length > 1 && out[0].role !== 'user') out.shift();
  return { messages: out, trimmed: truncated || cut };
}
