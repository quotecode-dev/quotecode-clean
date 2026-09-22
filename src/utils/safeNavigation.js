// AI Chat Gate 2, §8 + AI HELP V4 §11: the frontend half of the safe-navigation allowlist.
// Labels here are PRODUCT copy, never model-authored text - the AI (see
// supabase/functions/chat-ai/navigation.ts) can only choose WHICH of the
// closed NAV_ACTIONS ids (supabase/functions/_shared/aiHelpContract.js - the
// ONE list both sides import) to suggest; this module owns what the button
// actually says and does. No destination outside this list can ever be
// rendered, and no free-form URL / selector / DOM id is ever accepted from a
// chat response. The server filters per turn; this module re-checks.
import { NAV_ACTIONS, NAV_LABELS } from './aiHelpContract';

export const NAVIGATION_ACTIONS = NAV_ACTIONS.map((id) => ({ id, he: NAV_LABELS[id].he, en: NAV_LABELS[id].en }));

export const NAVIGATION_ACTION_IDS = NAVIGATION_ACTIONS.map((a) => a.id);

// Product-owned focus targets (Settings section ids rendered by SettingsTab as `pf-settings-<id>`).
export const NAVIGATION_FOCUS_TARGETS = Object.freeze(['business_details', 'business_phone', 'business_tax_id']);

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
// narrow, caller-known data the destination itself needs: `quoteId` only
// for `open_selected_quote` (the id the user themselves selected in this
// chat session - never model-supplied) and `focus` only from the closed
// NAVIGATION_FOCUS_TARGETS list (anything else is dropped).
export function dispatchSafeNavigation(actionId, meta = null) {
  if (!isValidNavigationAction(actionId)) return false;
  if (typeof window === 'undefined') return false;
  const safeMeta = {};
  if (actionId === 'open_selected_quote' && meta?.quoteId) safeMeta.quoteId = meta.quoteId;
  if (meta?.focus && NAVIGATION_FOCUS_TARGETS.includes(meta.focus)) safeMeta.focus = meta.focus;
  window.dispatchEvent(new CustomEvent(AI_NAVIGATE_EVENT, { detail: { action: actionId, meta: Object.keys(safeMeta).length ? safeMeta : null } }));
  return true;
}
