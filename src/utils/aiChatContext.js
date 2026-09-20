// Context-Driven AI Chat V3, §5 "ONE CONTEXT ENGINE - NO PARALLEL
// ARCHITECTURES": the one canonical, pure context resolver. Takes only the
// small projections AIChatWidget.jsx already receives as props (currentArea
// from Dashboard.jsx's own activeTab/showPricingModal; workflowContext from
// src/utils/quoteWorkflowContext.js) - it never fetches, stores, or owns
// any state of its own (§5 "existing screen/form components remain
// authoritative owners of their real state"). guidedChatIntents.js's
// getContextualMenuIntentIds() consumes this resolver's own `screenId`
// output - there is exactly one place "what screen is this" gets decided.
//
// Priority order (§6 "CONTEXT PRIORITY" / §7 "OBJECT PRIORITY" combined -
// the most specific, currently-VISIBLE thing always wins over a broader
// container it happens to sit inside): item wizard (nested inside the quote
// editor) > quote editor itself > tab/modal area > neutral fallback. This
// intentionally reads §6's own numbered list (which lists "quote editor"
// before "item wizard") as ordered by CONTAINMENT, not by override
// priority - §7's own object-priority list states the opposite, narrower
// order explicitly ("VISIBLE ITEM WORKFLOW" first), and a currently-open
// wizard is always the more specific, more currently-true fact about what
// the user is doing right now.
export const SCREEN_IDS = [
  'public', 'item_wizard', 'quote_editor_new', 'quote_editor_edit',
  'clients', 'settings', 'finances', 'catalog', 'plans', 'admin',
  'quote_history', 'neutral',
];

// §8/§9: whether an explicit existing-quote reference (the chat's own
// quotes picker, or a stale chat-side selection) may ever be treated as the
// CURRENT object - false only for a brand-new, not-yet-saved draft (§8: "no
// existing-quote picker by default"). Both quote_editor_edit and every
// screen outside the quote editor allow it (§9's own "old chat-selected
// quote may not override current edit quote" is enforced separately, by
// activeEditingQuoteId always winning when present - see AIChatWidget.jsx).
export function allowsExistingQuoteReference(screenId) {
  return screenId !== 'quote_editor_new';
}

// Pure derivation - §5 "resolveAIChatContext(), or the equivalent single
// pure resolver". Every branch here reads only VISIBLE, currently-true
// props - never a value retained from a screen that is no longer showing
// (§6 "VISIBLE UI STATE WINS": a hidden retained editor state can never
// leak into what this function reports).
export function resolveAIChatContext({ isDashboard, currentArea = null, workflowContext = null }) {
  if (!isDashboard) {
    return { screenId: 'public', isDashboard: false, objectType: 'none' };
  }

  if (workflowContext?.itemWizard?.open) {
    return {
      screenId: 'item_wizard',
      isDashboard: true,
      objectType: 'item_wizard',
      itemWizardAction: workflowContext.itemWizard.action,
    };
  }

  if (workflowContext?.screen === 'quote_editor') {
    const isEdit = workflowContext.mode === 'edit';
    return {
      screenId: isEdit ? 'quote_editor_edit' : 'quote_editor_new',
      isDashboard: true,
      objectType: isEdit ? 'saved_quote' : 'draft_quote',
    };
  }

  switch (currentArea) {
    case 'plans':
      return { screenId: 'plans', isDashboard: true, objectType: 'none' };
    case 'clients':
      return { screenId: 'clients', isDashboard: true, objectType: 'none' };
    case 'settings':
      return { screenId: 'settings', isDashboard: true, objectType: 'none' };
    case 'finances':
      return { screenId: 'finances', isDashboard: true, objectType: 'none' };
    case 'catalog':
      return { screenId: 'catalog', isDashboard: true, objectType: 'none' };
    case 'admin_clients':
      return { screenId: 'admin', isDashboard: true, objectType: 'none' };
    case 'main':
      return { screenId: 'quote_history', isDashboard: true, objectType: 'none' };
    default:
      return { screenId: 'neutral', isDashboard: true, objectType: 'none' };
  }
}
