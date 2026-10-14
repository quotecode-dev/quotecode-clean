// AI HELP CONTEXT V4 - the ONE pure per-surface context resolver (extends Context-Driven AI Chat V3's resolveAIChatContext; that resolver
// stays the screen-id authority for the V3 greeting/intents). Input: `sources` - small projections the Dashboard already owns (never a
// new fetch, never PII, never free text, never money values, never attachment bytes/URLs). Output: a bounded V4 help context the
// server sanitizes (sanitizeHelpContext) and reconciles against its own trusted facts.
import { HELP_CONTRACT_VERSION } from './aiHelpContract';

// Every authenticated surface the full-interface coverage gate requires (a surface missing here - or a missing coverage record - FAILS).
export const REQUIRED_SURFACES = Object.freeze([
  { id: 'dashboard', screen: 'dashboard', workflowId: 'overview' },
  { id: 'quote_history', screen: 'quote_history', workflowId: 'browse_quotes' },
  { id: 'quote_editor_new', screen: 'quote_editor_new', workflowId: 'create_quote' },
  { id: 'quote_editor_edit', screen: 'quote_editor_edit', workflowId: 'edit_quote' },
  { id: 'item_wizard', screen: 'item_wizard', workflowId: 'add_or_edit_item' },
  { id: 'clients', screen: 'clients', workflowId: 'manage_clients' },
  { id: 'catalog', screen: 'catalog', workflowId: 'manage_catalog' },
  { id: 'finances', screen: 'finances', workflowId: 'view_finances' },
  { id: 'settings', screen: 'settings', workflowId: 'edit_business_profile' },
  { id: 'plans', screen: 'plans', workflowId: 'view_plans' },
  { id: 'admin', screen: 'admin', workflowId: 'admin_operations' },
  { id: 'attachments', screen: 'quote_editor_edit', workflowId: 'manage_attachments', section: 'attachments' },
  { id: 'sharing', screen: 'quote_history', workflowId: 'share_quote', section: 'share_email' },
  { id: 'ai_chat', screen: 'ai_chat', workflowId: 'ai_chat' },
  { id: 'region_choice', screen: 'region_choice', workflowId: 'setup_region' },
]);

const TAB_SCREEN = { clients: 'clients', catalog: 'catalog', finances: 'finances', settings: 'settings', admin_clients: 'admin' };
const SCREEN_WORKFLOW = { dashboard: 'overview', quote_history: 'browse_quotes', quote_editor_new: 'create_quote', quote_editor_edit: 'edit_quote', item_wizard: 'add_or_edit_item', clients: 'manage_clients', catalog: 'manage_catalog', finances: 'view_finances', settings: 'edit_business_profile', plans: 'view_plans', admin: 'admin_operations', ai_chat: 'ai_chat', region_choice: 'setup_region', neutral: null };

export function resolveHelpScreen(s) {
  if (s.regionChoice) return 'region_choice';
  if (s.wizard?.open) return 'item_wizard';
  if (s.editor?.open) return s.editor.mode === 'edit' ? 'quote_editor_edit' : 'quote_editor_new';
  if (s.pricingOpen) return 'plans';
  if (TAB_SCREEN[s.activeTab]) return TAB_SCREEN[s.activeTab];
  if (s.activeTab === 'main') {
    const h = s.history || {};
    // sharing (email / PDF / WhatsApp) is launched from a quote row in the history list
    const sharing = s.section === 'share_email' || s.section === 'print_pdf' || s.section === 'share_whatsapp';
    return sharing || h.searchActive || (h.filterStatus && h.filterStatus !== 'All') || h.selectedQuoteId ? 'quote_history' : 'dashboard';
  }
  return 'neutral';
}

// UNSAVED DRAFT AI CONTRACT: provenance of the current object. Local persistence is never "saved"; an unknown save result is reported
// as such; a server change after the draft was taken is STALE_SERVER_VERSION.
export function resolveProvenance(s, blockerCodes = []) {
  const e = s.editor;
  if (e?.open) {
    if (s.draft?.conflict) return 'STALE_SERVER_VERSION';
    if (blockerCodes.includes('QUOTE_SAVE_RESULT_UNKNOWN') || blockerCodes.includes('QUOTE_SAVE_NETWORK_ERROR')) return 'UNKNOWN_SAVE_RESULT';
    if (s.draft?.recovered) return 'RECOVERED_LOCAL_DRAFT';
    if (e.mode === 'edit') return s.draft?.dirty ? 'UNSAVED_LOCAL_DRAFT' : 'PERSISTED_QUOTE';
    return 'UNSAVED_LOCAL_DRAFT';
  }
  return s.history?.selectedQuoteId ? 'PERSISTED_QUOTE' : 'NONE';
}

const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined);
const bool = (v) => (typeof v === 'boolean' ? v : undefined);
// The server fingerprint embeds item text - only a short non-reversible digest ever leaves the browser (FNV-1a, 2x32 bit).
export function fingerprintDigest(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let h1 = 0x811c9dc5; let h2 = 0x01000193 ^ raw.length;
  for (let i = 0; i < raw.length; i++) { const c = raw.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0; }
  return 'fp-' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
const ADMIN_SECTION = { overview: 'overview', users: 'users', plans: 'plans', activity: 'activity', 'ai-support': 'ai_support' };
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

const ADAPTERS = {
  dashboard: (s) => ({ section: s.dataLoadError ? 'alert' : 'summary', facts: { monthlyQuotesUsed: count(s.plan?.monthlyUsed), monthlyQuoteLimit: s.plan?.monthlyLimit, totalQuoteCount: count(s.history?.total), dataLoadError: bool(s.dataLoadError), profilePhoneComplete: bool(s.profile?.phoneComplete), profileTaxIdComplete: bool(s.profile?.taxIdComplete) } }),
  quote_history: (s) => ({ section: s.section || (s.history?.selectedQuoteId ? 'detail' : s.history?.searchActive || s.history?.filterStatus !== 'All' ? 'search_filter' : 'list'), object: s.history?.selectedQuoteId ? { kind: 'quote', id: s.history.selectedQuoteId } : null, facts: { searchActive: bool(s.history?.searchActive), filterStatus: s.history?.filterStatus, visibleQuoteCount: count(s.history?.visible), totalQuoteCount: count(s.history?.total), selectedQuoteExpired: bool(s.history?.selectedExpired), selectedQuoteImmutable: bool(s.history?.selectedImmutable), emailSendState: s.share?.emailState, pdfState: s.share?.pdfState, monthlyQuotesUsed: count(s.plan?.monthlyUsed), monthlyQuoteLimit: s.plan?.monthlyLimit } }),
  quote_editor_new: (s) => editorAdapter(s),
  quote_editor_edit: (s) => editorAdapter(s),
  item_wizard: (s) => ({ ...editorAdapter(s), section: s.wizard?.step ? `wizard_${s.wizard.step}` : 'wizard_what', step: s.wizard?.step || null, facts: { ...editorAdapter(s).facts, wizardAction: s.wizard?.action, wizardStep: s.wizard?.step, pricingMethod: s.wizard?.pricingMethod, measurementCount: count(s.wizard?.measurementCount), hasQuantity: bool(s.wizard?.hasQuantity), hasUnitPrice: bool(s.wizard?.hasUnitPrice), hasSpecification: bool(s.wizard?.hasSpecification) } }),
  clients: (s) => ({ section: s.modal === 'edit_client' ? 'detail' : 'list', object: s.modal === 'edit_client' ? { kind: 'client' } : null, facts: { clientCount: count(s.lists?.clientCount), searchActive: bool(s.lists?.clientSearchActive) } }),
  catalog: (s) => ({ section: 'list', facts: { serviceCount: count(s.lists?.serviceCount) } }),
  finances: (s) => ({ section: s.dataLoadError ? 'alert' : 'summary', facts: { financeRange: s.finance?.range, expenseCount: count(s.lists?.expenseCount), dataLoadError: bool(s.dataLoadError) } }),
  settings: (s) => ({ section: s.section || (s.profile && !s.profile.phoneComplete ? 'business_phone' : s.profile && s.profile.taxIdRequired && !s.profile.taxIdComplete ? 'business_tax_id' : 'business_details'), object: { kind: 'business_profile' }, facts: { profilePhoneComplete: bool(s.profile?.phoneComplete), profileTaxIdComplete: bool(s.profile?.taxIdComplete) } }),
  plans: (s) => ({ section: 'plan_limits', object: { kind: 'plan' }, facts: { monthlyQuotesUsed: count(s.plan?.monthlyUsed), monthlyQuoteLimit: s.plan?.monthlyLimit } }),
  admin: (s) => ({ section: s.admin?.protectedAction ? 'admin_protected_action' : s.admin?.section === 'users' ? 'admin_users' : 'admin_overview', object: { kind: 'admin_target' }, facts: { adminSection: ADMIN_SECTION[s.admin?.section] } }),
  region_choice: () => ({ section: 'region', object: { kind: 'business_profile' }, facts: {} }),
  ai_chat: (s) => ({ section: 'transcript', facts: { transcriptLength: count(s.chat?.transcriptLength), transcriptMessages: count(s.chat?.transcriptMessages) } }),
  neutral: () => ({ section: 'none', facts: {} }),
};

function editorAdapter(s) {
  const e = s.editor || {}; const w = s.workflow || {};
  return {
    section: s.section || (e.attachmentCount || e.pendingAttachmentCount ? 'items' : 'client_details'),
    object: { kind: 'quote', id: e.mode === 'edit' ? e.quoteId : null, serverFingerprint: e.mode === 'edit' ? fingerprintDigest(e.serverFingerprint) : null },
    draft: { mode: e.mode === 'edit' ? 'edit' : 'create', localDraftId: s.draft?.localDraftId || null, dirty: !!s.draft?.dirty, localWriteStatus: s.draft?.localWriteStatus || 'none', lastLocalWriteAt: s.draft?.lastLocalWriteAt || null, serverComparison: e.mode === 'edit' ? (s.draft?.conflict ? 'changed' : e.immutable ? 'immutable' : 'unchanged') : 'not_applicable', recoveryState: s.draft?.conflict ? 'conflict' : s.draft?.recovered ? 'recovered' : 'none' },
    facts: { hasClient: bool(w.hasClient), hasProject: bool(w.hasProject), hasClientType: bool(e.hasClientType), itemCount: count(w.itemCount), pricedItemCount: count(e.pricedItemCount), unpricedItemCount: count(e.unpricedItemCount), sectionCount: count(w.sectionCount), structureMode: w.structureMode === 'divided' ? 'divided' : 'regular', attachmentCount: count(e.attachmentCount), pendingAttachmentCount: count(e.pendingAttachmentCount), pendingRemovalCount: count(e.pendingRemovalCount), unsavedChanges: bool(s.draft?.dirty), saveStage: e.saveStage, profilePhoneComplete: bool(s.profile?.phoneComplete), profileTaxIdComplete: bool(s.profile?.taxIdComplete), monthlyQuotesUsed: count(s.plan?.monthlyUsed), monthlyQuoteLimit: s.plan?.monthlyLimit, draftRecoveryState: s.draft?.conflict ? 'conflict' : s.draft?.recovered ? 'recovered' : 'none' },
  };
}

// The single builder. `blockers` are the published structured blockers (aiHelpBlockers.js); `forceScreen` is used only by the AI chat
// surface itself (transcript-limit / provider-failure help).
export function buildAiHelpContext(sources, { blockers = [], revision = 0, now = Date.now(), forceScreen = null } = {}) {
  if (!sources || !sources.authenticated) return null; // no private help context without an authenticated shell
  const codes = blockers.map((b) => b.code);
  // an active sharing / attachment blocker names the section the user is stuck in (structured, never DOM-derived)
  const blockerSection = codes.some((c) => c.startsWith('EMAIL_')) ? 'share_email' : codes.includes('PDF_GENERATION_FAILED') ? 'print_pdf' : codes.includes('WHATSAPP_REQUIRES_PRO') ? 'share_whatsapp'
    : codes.some((c) => c.startsWith('ATTACHMENT')) && sources.editor?.open ? 'attachments' : null;
  // a forced screen (the assistant's own problem) owns its section/workflow - an older blocker elsewhere never re-labels it
  if (!forceScreen && !sources.section && blockerSection) sources = { ...sources, section: blockerSection };
  if (forceScreen && sources.section) sources = { ...sources, section: null };
  const screen = forceScreen || resolveHelpScreen(sources);
  const adapter = ADAPTERS[screen] || ADAPTERS.neutral;
  const a = adapter(sources);
  const blockerCodes = blockers.map((b) => b.code);
  const provenance = resolveProvenance(sources, blockerCodes);
  return {
    version: HELP_CONTRACT_VERSION,
    revision,
    screen,
    section: a.section || 'none',
    modal: sources.modal || (sources.wizard?.open ? 'item_wizard' : sources.pricingOpen ? 'pricing' : 'none'),
    workflowId: sources.section === 'attachments' ? 'manage_attachments' : sources.section === 'share_email' || sources.section === 'print_pdf' || sources.section === 'share_whatsapp' ? 'share_quote' : SCREEN_WORKFLOW[screen] ?? null,
    step: a.step || null,
    object: { kind: a.object?.kind || 'none', id: a.object?.id || null, provenance, serverFingerprint: a.object?.serverFingerprint || null },
    draft: a.draft || null,
    facts: clean(a.facts || {}),
    blockers: blockers.map((b) => ({ id: b.id, code: b.code, stage: b.stage || null, fieldCodes: b.fieldCodes || undefined, persistence: b.persistence || undefined, occurredAt: b.occurredAt })),
    capturedAt: now,
  };
}
