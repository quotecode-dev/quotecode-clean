// Context-Driven AI Chat V3, §18/§19: the frontend's own small mirror of
// supabase/functions/_shared/aiChatContract.ts - AIChatWidget.jsx cannot
// import across the deploy boundary (same established constraint as
// guidedChatIntents.js's own parallel id-only copy of the Edge Function's
// GUIDED_INTENT_IDS - see that file's header comment), so this module
// re-declares only the version number and enum values the frontend actually
// needs to send/interpret. Kept honest by aiChatContract.test.js, which
// directly imports the Edge Function's own .ts source (Vitest can parse it
// statically, the same established pattern guidedChatIntents.test.js
// already uses for its own Edge/frontend id parity check) and asserts both
// sides match exactly.
export const CHAT_CONTRACT_VERSION = 3;

export const ANSWER_SOURCES = ['deterministic', 'model'];

export const DIRECT_FACT_KINDS = ['amount', 'status', 'quote_number', 'creation_date', 'validity_date', 'item_count'];
