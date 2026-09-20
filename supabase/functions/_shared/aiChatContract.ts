// Context-Driven AI Chat V3, §18/§19: the ONE shared request/response
// contract for the chat-ai Edge Function, imported by both validation.ts
// and index.ts within this same deploy boundary (Edge Functions CAN import
// from supabase/functions/_shared/ - see the pre-existing adminReauth.ts in
// this same directory for precedent; the constraint documented elsewhere in
// this codebase, e.g. guidedChatIntents.js's own header, is specifically
// about the FRONTEND not being able to import from supabase/functions/, not
// about function-to-function imports within this boundary). No Deno-only
// API is used here, so this file itself stays trivially unit-testable.
//
// The FRONTEND (src/utils/aiChatContract.js) keeps its own small mirrored
// copy of just the version number and enum values it needs - it genuinely
// cannot import this file (a different deploy target/bundler boundary) -
// kept honest by a parity test comparing both, the same established pattern
// guidedChatIntents.test.js already uses for its own Edge/frontend id split.

// Bumped from 2 -> 3 for the Context-Driven AI Chat V3 task: the response
// envelope gained `contextRevision`/`answerSource`/`factPayload`/
// `nextIntentIds`/`objectAvailability` (all additive - a v2 caller that
// simply ignores unknown fields still works), and the request envelope
// gained `contextRevision` (also additive/optional). This is a coordinated
// bump: AIChatWidget.jsx (the only caller) is updated in the same task to
// send/consume v3, so there is no stray older caller left behind.
export const CHAT_CONTRACT_VERSION = 3;

export const ANSWER_SOURCES = ['deterministic', 'model'] as const;
export type AnswerSource = typeof ANSWER_SOURCES[number];

// §22 "Direct Facts" - the closed set of quote facts this contract can
// answer deterministically, without ever calling the model. Any question
// this set doesn't cover (including client display name - see directFacts.ts's
// own header comment on why that one is deliberately NOT included yet) falls
// through to the model as before, exactly like every other free-text
// question.
export const DIRECT_FACT_KINDS = ['amount', 'status', 'quote_number', 'creation_date', 'validity_date', 'item_count'] as const;
export type DirectFactKind = typeof DIRECT_FACT_KINDS[number];

export type DirectFactPayload = {
  kind: DirectFactKind;
  // Every value is a plain, already-formatted-for-display string - never a
  // raw number/date object the two callers (HE/EN) would have to format
  // differently themselves, and never more than the one fact asked for.
  value: string;
  isDraft: boolean;
};

export type ChatErrorCode = 'invalid_request' | 'unauthenticated_private_context' | 'provider_failure' | 'malformed_provider_response' | 'internal_error';

export type ChatResponseEnvelope = {
  contractVersion: number;
  requestId: string;
  // Echoes the request's own contextRevision back unchanged when present,
  // so the caller can recognize a response that arrived after its own
  // context already moved on (§25/§26) - null when the caller sent none
  // (an older/public caller, or a request with no meaningful revision yet).
  contextRevision: number | null;
  answer: string | null;
  answerSource: AnswerSource | null;
  factPayload: DirectFactPayload | null;
  navigation: { action: string } | null;
  selectedQuoteContext: { requested: boolean; available: boolean } | null;
  error: { code: ChatErrorCode; message: string } | null;
};

export function buildErrorEnvelope(code: ChatErrorCode, message: string, contextRevision: number | null = null): ChatResponseEnvelope {
  return {
    contractVersion: CHAT_CONTRACT_VERSION,
    requestId: crypto.randomUUID(),
    contextRevision,
    answer: null,
    answerSource: null,
    factPayload: null,
    navigation: null,
    selectedQuoteContext: null,
    error: { code, message },
  };
}
