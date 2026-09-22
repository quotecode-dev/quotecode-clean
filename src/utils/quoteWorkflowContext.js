// AI Chat Hardening overnight task, Track B — Current-Workflow / Current-
// Step Awareness. The smallest safe, pure, framework-agnostic derivation of
// "where is the authenticated user right now inside the quote editor" -
// computed entirely from state Dashboard.jsx/QuoteForm.jsx already own, never
// a new data fetch, never client PII, never a financial total, never a free-
// text field. See PROFLOW_PROJECT_CONTEXT.md §238 for the full contract.
//
// Context-Driven AI Chat V3, §10 "Item Wizard Context": `liveState` (when
// provided) is AddItemWizard.jsx's own bounded, non-PII snapshot of its
// CURRENT in-progress step/pricing-method/measurement-progress (see that
// component's own `onLiveStateChange` effect) - it does NOT re-derive any
// of this independently, only merges what the wizard itself already
// reported. When `liveState` is absent (e.g. an older caller, or a test
// exercising only the open/edit boundary), the step/pricingMethod/etc
// fields are simply omitted rather than guessed - "unknown remains
// unknown" (§20), never a fabricated default.
import { isProfessionalItem } from './professionalQuoteItem';

export function computeItemWizardState({ isOpen, editingItem, liveState = null }) {
  if (!isOpen) return null;
  const base = !editingItem
    ? { open: true, action: 'add', itemType: 'unknown', hasMeasurements: null }
    : {
      open: true,
      action: 'edit',
      itemType: isProfessionalItem(editingItem) ? 'professional' : 'simple',
      hasMeasurements: Array.isArray(editingItem.measurements) && editingItem.measurements.length > 0,
    };
  if (!liveState) return base;
  return {
    ...base,
    step: liveState.step ?? null,
    pricingMethod: liveState.pricingMethod ?? null,
    measurementCount: typeof liveState.measurementCount === 'number' ? liveState.measurementCount : null,
    hasSpecification: typeof liveState.hasSpecification === 'boolean' ? liveState.hasSpecification : null,
    hasQuantity: typeof liveState.hasQuantity === 'boolean' ? liveState.hasQuantity : null,
    hasUnitPrice: typeof liveState.hasUnitPrice === 'boolean' ? liveState.hasUnitPrice : null,
  };
}

// SMART-QUOTE-02 (2026-09-22): there is no structure-first decision any more - an unset structure IS the simple flat list the
// user sees, so the assistant is told 'regular' (the server still accepts 'undecided' from older clients).
function normalizeStructureMode(quoteStructureMode) {
  if (quoteStructureMode === 'divided') return 'divided';
  return 'regular';
}

// A brand-new quote's `items` state starts as one placeholder row with an
// empty description (see Dashboard.jsx's own `handleCancelEdit`/initial
// state) - that placeholder must not be counted as "an item already exists".
function countRealItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.filter((it) => it && typeof it.description === 'string' && it.description.trim().length > 0).length;
}

export function computeQuoteWorkflowContext({
  showQuoteForm, editingQuoteId, clientName, projectName, sections, quoteStructureMode, items, itemWizardState,
}) {
  if (!showQuoteForm) return null;
  return {
    screen: 'quote_editor',
    mode: editingQuoteId ? 'edit' : 'create',
    hasClient: !!(clientName && clientName.trim()),
    hasProject: !!(projectName && projectName.trim()),
    structureMode: normalizeStructureMode(quoteStructureMode),
    sectionCount: Array.isArray(sections) ? sections.length : 0,
    itemCount: countRealItems(items),
    itemWizard: itemWizardState || null,
  };
}
