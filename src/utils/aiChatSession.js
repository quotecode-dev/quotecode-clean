// AI Chat Phase 1 isolation contract (Interactive AI Chat program, Phase 1 -
// isolation/security plumbing only, see PROFLOW_CODEX_CHECKPOINT.md). Two
// independent responsibilities live here, both pure/framework-agnostic so
// they can be unit-tested without mounting React or touching the DOM:
//
// 1. A versioned, bounded, locale-partitioned sessionStorage contract for
//    the PUBLIC (anonymous) chat surface only. Authenticated Dashboard chat
//    is intentionally in-memory only (plain component state, never touches
//    the storage functions below) per the Phase 1 directive to prefer
//    in-memory persistence unless existing behavior requires session
//    restore - this also sidesteps inventing a new per-user/per-tenant
//    persisted-storage partitioning scheme in this phase.
//
// 2. A tiny context-generation guard used by BOTH surfaces to discard a
//    stale in-flight AI reply that resolves after the active chat context
//    has already moved on (logout, user switch, market/locale change,
//    public<->authenticated switch, any other reset boundary).

export const AI_CHAT_SCHEMA_VERSION = 2;
export const AI_CHAT_MAX_STORED_MESSAGES = 40;
export const AI_CHAT_MAX_MESSAGE_LENGTH = 4000;

// The schema version is baked into the storage key itself (not just the
// envelope) so that legacy unversioned keys (the pre-Phase-1
// `proflow_ai_chat_public_he` / `_public_en` keys) are simply never read by
// this code path - they are orphaned, not migrated/parsed leniently. They
// disappear on their own when the tab/session ends.
export function buildPublicChatStorageKey({ isHebrew }) {
  const locale = isHebrew ? 'he' : 'en';
  return `proflow_ai_chat_public_v${AI_CHAT_SCHEMA_VERSION}_${locale}`;
}

function isValidStoredMessage(msg) {
  // `createdAt` (AI Chat History UX task) is optional and additive - a
  // message written before this field existed, or any future entry that
  // simply omits it, remains valid; only checked for shape when present, so
  // legacy history is never rejected wholesale.
  return (
    msg &&
    typeof msg === 'object' &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    msg.content.length <= AI_CHAT_MAX_MESSAGE_LENGTH &&
    (msg.createdAt === undefined || typeof msg.createdAt === 'string')
  );
}

// Returns a valid, bounded message array, or null for any missing/corrupt/
// wrong-version/oversized/malformed-shape input. Callers must fall back to
// a fresh default transcript on null rather than throw - corrupt storage
// must never break the chat.
export function readStoredPublicTranscript(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.schemaVersion !== AI_CHAT_SCHEMA_VERSION ||
      !Array.isArray(parsed.messages) ||
      parsed.messages.length === 0 ||
      parsed.messages.length > AI_CHAT_MAX_STORED_MESSAGES ||
      !parsed.messages.every(isValidStoredMessage)
    ) {
      return null;
    }
    return parsed.messages;
  } catch {
    return null;
  }
}

export function writeStoredPublicTranscript(storageKey, messages) {
  try {
    const bounded = Array.isArray(messages) ? messages.slice(-AI_CHAT_MAX_STORED_MESSAGES) : [];
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ schemaVersion: AI_CHAT_SCHEMA_VERSION, messages: bounded })
    );
  } catch {
    // sessionStorage unavailable/full/private-mode: non-fatal, chat simply
    // stays in-memory only for the rest of this tab's life.
  }
}

export function clearStoredPublicTranscript(storageKey) {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

// --- Context-generation guard (stale async reply isolation) ---
//
// Every outgoing chat request must capture the guard's *current* generation
// number before the request is sent. Any reset boundary (logout, user
// switch, market/locale change, public<->authenticated switch, explicit
// reset) bumps the generation. Before an async reply is applied to visible
// state, the caller must check isStale(token) first - a stale reply is
// discarded (never appended, never overwrites the draft/history, never
// surfaced as current-session content).
export function createChatContextGuard(initial = 0) {
  let generation = initial;
  return {
    current() {
      return generation;
    },
    reset() {
      generation += 1;
      return generation;
    },
    isStale(token) {
      return token !== generation;
    },
  };
}
