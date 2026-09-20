// AI Chat Gate 2, §8: the frontend half of the safe-navigation allowlist.
// Labels here are PRODUCT copy, never model-authored text - the AI (see
// supabase/functions/chat-ai/navigation.ts) can only choose WHICH of these
// 7 fixed ids to suggest; this module owns what the button actually says
// and does. No destination outside this list can ever be rendered, and no
// free-form URL is ever accepted from a chat response.
export const NAVIGATION_ACTIONS = [
  { id: 'open_quote_history', he: 'פתיחת היסטוריית הצעות מחיר', en: 'Open quote history' },
  { id: 'open_clients', he: 'פתיחת לקוחות', en: 'Open clients' },
  { id: 'open_business_settings', he: 'פתיחת הגדרות עסק', en: 'Open business settings' },
  { id: 'open_catalog', he: 'פתיחת קטלוג', en: 'Open catalog' },
  { id: 'open_finances', he: 'פתיחת פיננסים', en: 'Open finances' },
  { id: 'open_plan_information', he: 'מידע על המסלול שלי', en: 'View my plan information' },
  { id: 'open_selected_quote', he: 'פתיחת ההצעה שנבחרה', en: 'Open the selected quote' },
];

export const NAVIGATION_ACTION_IDS = NAVIGATION_ACTIONS.map((a) => a.id);

export function isValidNavigationAction(actionId) {
  return NAVIGATION_ACTION_IDS.includes(actionId);
}

export function getNavigationLabel(actionId, isHebrew) {
  const found = NAVIGATION_ACTIONS.find((a) => a.id === actionId);
  if (!found) return null;
  return isHebrew ? found.he : found.en;
}

// Dashboard.jsx listens for this exact event name and maps each allowlisted
// action to its own existing tab-switch/modal-open state - this module
// never touches routing/DOM navigation itself, it only asks Dashboard to.
export const AI_NAVIGATE_EVENT = 'proflow-ai-navigate';

// Returns false (and dispatches nothing) for any id outside the allowlist -
// the one enforcement point between "a value came back from the Edge
// Function" and "something on screen actually navigated". `meta` is
// optional, narrow, caller-known data the destination itself needs (today:
// only `open_selected_quote` uses it, carrying the exact quoteId the user
// themselves already selected in this same chat session - never anything
// the model supplied).
export function dispatchSafeNavigation(actionId, meta = null) {
  if (!isValidNavigationAction(actionId)) return false;
  if (typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(AI_NAVIGATE_EVENT, { detail: { action: actionId, meta } }));
  return true;
}
