// AI HELP V4 - STRUCTURED BLOCKER PUBLISHING (AI-HELP-AVAILABILITY-001). The existing owners of a blocked action (business-profile
// gate, quote save, entitlement checks, email send, attachment staging, draft engine, settings/client/catalog saves, Admin re-auth)
// publish a TYPED blocker code here - never scraped DOM text, never a raw exception / SQL / provider message. The AI help context reads
// the active set. A blocker is cleared ONLY by confirmed resolution (e.g. the profile saved complete, the quote saved) or by a context
// transition of its scope (e.g. the editor closed) - dismissing an alert does NOT clear it.
import { useSyncExternalStore } from 'react';
import { BLOCKER_CATALOG, FIELD_CODES } from './aiHelpContract';

// scope: 'editor' (cleared when the quote editor closes / a new quote starts / a save succeeds), 'profile' (cleared when the business
// profile is confirmed complete), 'surface' (cleared when the user leaves the surface it was raised on), 'session' (explicit clear only).
const blockers = new Map();
const listeners = new Set();
let snapshot = [];
const emit = () => { snapshot = [...blockers.values()]; listeners.forEach((l) => l()); };

export function publishBlocker(code, { scope = 'editor', surface = null, stage = null, fieldCodes = null, persistence = null, now = Date.now() } = {}) {
  if (!BLOCKER_CATALOG[code]) return false; // closed catalog - an unknown code is never published
  const fields = Array.isArray(fieldCodes) ? fieldCodes.filter((f) => FIELD_CODES.includes(f)) : null;
  const prev = blockers.get(code);
  // idempotent: re-publishing the same blocker (e.g. from a state-derived effect) keeps its first occurrence and emits nothing
  if (prev && prev.scope === scope && prev.surface === surface && prev.stage === stage && prev.persistence === persistence && JSON.stringify(prev.fieldCodes) === JSON.stringify(fields)) return true;
  blockers.set(code, { id: code, code, scope, surface, stage, fieldCodes: fields, persistence, occurredAt: now });
  emit();
  return true;
}

export function resolveBlockers(codes) {
  let changed = false;
  for (const c of codes) changed = blockers.delete(c) || changed;
  if (changed) emit();
}

export function clearScope(scope, surface = null) {
  let changed = false;
  for (const [k, b] of blockers) if (b.scope === scope && (surface === null || b.surface === surface)) { blockers.delete(k); changed = true; }
  if (changed) emit();
}

export function clearAllBlockers() { if (blockers.size) { blockers.clear(); emit(); } }
export function getActiveBlockers() { return snapshot; }
export function subscribeBlockers(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useAiHelpBlockers() { return useSyncExternalStore(subscribeBlockers, getActiveBlockers, getActiveBlockers); }

// Codes a NEW save attempt re-evaluates: they are resolved when the user presses Save again and re-published only if still true.
export const SAVE_ATTEMPT_CODES = Object.freeze(Object.keys(BLOCKER_CATALOG).filter((c) => /^(QUOTE_|ATTACHMENT_UPLOAD_FAILED_PRE_SAVE|ATTACHMENT_PARTIAL_AFTER_SAVE|SESSION_EXPIRED)/.test(c) && c !== 'QUOTE_EXPIRED'));

// ------------------------------------------------------------------------------------------------ adapters from existing classifiers
// classifyDashboardActionError(...) categories -> blocker codes per operation (the classifier stays the single message owner).
const OPERATION_SAVE_CODES = { update_settings: 'SETTINGS_SAVE_FAILED', create_client: 'CLIENT_SAVE_FAILED', update_client: 'CLIENT_SAVE_FAILED', delete_quote: 'QUOTE_SAVE_SERVER_ERROR', extend_trial: 'ADMIN_PROTECTED_ACTION', delete_client: 'CLIENT_SAVE_FAILED', add_service: 'CATALOG_SAVE_FAILED', update_service: 'CATALOG_SAVE_FAILED', delete_service: 'CATALOG_SAVE_FAILED', add_expense: 'EXPENSE_SAVE_FAILED', update_expense: 'EXPENSE_SAVE_FAILED', delete_expense: 'EXPENSE_SAVE_FAILED' };
export function blockerCodeForActionError(operationKey, rawMessage = '') {
  const m = String(rawMessage || '').toLowerCase();
  if (/jwt|session|not authenticated|401/.test(m)) return 'SESSION_EXPIRED';
  if (/permission|row-level security|rls|42501|403/.test(m)) return 'QUOTE_PERMISSION_DENIED';
  if (/failed to fetch|network|timeout|fetch/.test(m)) return 'DATA_LOAD_FAILED';
  return OPERATION_SAVE_CODES[operationKey] || 'QUOTE_SAVE_SERVER_ERROR';
}

// quote save failure -> code + persistence (the orchestrator result / thrown error decides; never guessed from UI text)
export function blockerCodeForSaveFailure(err) {
  const m = String(err?.message || err || '').toLowerCase();
  if (/failed to fetch|network|timeout|load failed/.test(m)) return { code: 'QUOTE_SAVE_NETWORK_ERROR', persistence: 'unknown' };
  if (/jwt|session|not authenticated/.test(m)) return { code: 'SESSION_EXPIRED', persistence: 'unknown' };
  if (/permission|row-level security|42501/.test(m)) return { code: 'QUOTE_PERMISSION_DENIED', persistence: 'not_persisted' };
  if (/storage|upload|attachment|object/.test(m)) return { code: 'ATTACHMENT_UPLOAD_FAILED_PRE_SAVE', persistence: 'not_persisted' };
  return { code: 'QUOTE_SAVE_SERVER_ERROR', persistence: 'not_persisted' };
}

// classifyQuoteEmailError(...) category -> blocker code
export function blockerCodeForEmailError(rawMessage = '', hadReadableServerResponse = true) {
  const m = String(rawMessage || '').toLowerCase();
  if (!hadReadableServerResponse || /failed to fetch|network|timeout/.test(m)) return 'EMAIL_SEND_NETWORK';
  if (/no email|missing email|client email|recipient/.test(m)) return 'EMAIL_CLIENT_NO_EMAIL';
  return 'EMAIL_SEND_FAILED';
}
