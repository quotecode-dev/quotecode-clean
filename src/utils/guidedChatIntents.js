// AI Chat Guided Interactive Entry taxonomy (Consolidated Gate 1, §4;
// reconciled to the Owner's final canonical 11-topic list, AI Chat
// Hardening overnight task, Track E - see PROFLOW_TODO.md item 2's own
// "exact final labels still open" note, now closed by this list).
//
// This module is the FRONTEND declaration only. The Edge Function
// (supabase/functions/chat-ai/validation.ts) cannot import across the
// deploy boundary (same constraint documented in src/shared/brand.js), so
// it carries its own parallel id-only copy for validation - kept honest by
// guidedChatIntents.test.js, which asserts both id sets are identical.
//
// guidedIntent is UX metadata ONLY. It is never mapped onto, and never
// overrides, the existing locked support `category` classification
// (CANCELLATION/FEATURE_REQUEST/HARD_QUESTION/GENERAL) - see chat-ai's
// classifySupportMessage, which reads only the message text.
export const GUIDED_INTENT_IDS = [
  'quotes', 'current_process_help', 'technical_problem', 'software_help',
  'plans_subscription', 'billing_payment', 'clients', 'business_settings',
  'suggestion', 'general_question', 'other',
];

// `heDesc`/`enDesc` (Descriptive Guided AI Cards + Context Header task,
// Owner correction, 2026-09-18): one short, concrete line explaining what
// the user can actually do by picking this intent - never a restatement of
// the title, never a capability the app doesn't have. `clients`/
// `business_settings` and every top-level GUIDED_TOPIC_GROUPS description
// below use the Owner's own exact given HE wording verbatim; every other
// line is new copy written to the same concise, product-accurate standard,
// EN kept semantically (not literally word-for-word) equivalent to HE.
export const GUIDED_INTENTS = [
  { id: 'quotes', he: 'הצעות מחיר', en: 'Quotes', heDesc: 'יצירה, חיפוש, סטטוס ופעולות על הצעות', enDesc: 'Create, find, track status, and manage quotes' },
  { id: 'current_process_help', he: 'עזרה בתהליך הנוכחי', en: "Help with what I'm doing now", heDesc: 'עזרה מותאמת למה שאתה עושה כרגע במערכת', enDesc: "Help based on exactly what you're doing right now" },
  { id: 'technical_problem', he: 'בעיה טכנית', en: 'Technical problem', heDesc: 'דיווח על תקלה או בעיה טכנית', enDesc: 'Report a bug or technical issue' },
  { id: 'software_help', he: 'עזרה בתוכנה', en: 'Help using the software', heDesc: 'הסבר איך להשתמש בתכונות המערכת', enDesc: 'How to use the system’s features' },
  { id: 'plans_subscription', he: 'מסלולים / מנוי', en: 'Plans / subscription', heDesc: 'פרטי המסלול שלך ושדרוג המנוי', enDesc: 'Your current plan details and upgrading your subscription' },
  { id: 'billing_payment', he: 'תשלום / חיוב', en: 'Payment / billing', heDesc: 'חיובים, קבלות ואמצעי תשלום', enDesc: 'Charges, receipts and payment methods' },
  { id: 'clients', he: 'לקוחות', en: 'Clients', heDesc: 'חיפוש לקוח, פרטים ופעולות קשורות', enDesc: 'Find a client, view details, and related actions' },
  { id: 'business_settings', he: 'הגדרות העסק', en: 'Business settings', heDesc: 'פרטי העסק, לוגו והעדפות', enDesc: 'Business details, logo and preferences' },
  { id: 'suggestion', he: 'הצעה לשיפור', en: 'Suggestion for improvement', heDesc: 'הצעה לשיפור או לתכונה חדשה', enDesc: 'Suggest an improvement or a new feature' },
  { id: 'general_question', he: 'שאלה כללית', en: 'General question', heDesc: 'כל שאלה אחרת על המערכת', enDesc: 'Any other question about the system' },
  { id: 'other', he: 'משהו אחר', en: 'Something else', heDesc: 'משהו שלא מופיע ברשימה', enDesc: 'Something not listed here' },
];

// Optional, at-most-one, skippable second step (§4.3). Only `quotes` has
// one - it exists to drive the explicit quote-selector step (Gate 2 §6),
// not merely to sub-categorize, so it is kept even though the prior second-
// steps for billing/business were removed as redundant: the 11-topic flat
// list already separates what those used to split (plans vs. billing,
// clients vs. business settings are each their own top-level topic now) -
// a second step choosing between them again would be a deeper menu tree
// than "roughly 1-2 guided steps maximum" intends.
export const GUIDED_SECOND_STEPS = {
  quotes: {
    question: { he: 'שאלה כללית או הצעה מסוימת?', en: 'General help or a specific quote?' },
    options: [
      { id: 'general', he: 'עזרה כללית', en: 'General help' },
      { id: 'specific_quote', he: 'הצעה מסוימת', en: 'A specific quote' },
    ],
  },
};

export function getGuidedSecondStepOptionIds(intentId) {
  return (GUIDED_SECOND_STEPS[intentId]?.options || []).map((o) => o.id);
}

// Hierarchical Guided AI Chat Flow (Owner correction, 2026-09-18): the flat
// 11-button list above read as too many, too-large options at once - the
// Owner asked for TOPIC -> SUBTOPIC -> next-relevant-step instead, 5-6
// top-level entries, with zero capability loss. This is a presentation-only
// grouping layer on top of the exact same 11 ids above - GUIDED_INTENT_IDS/
// GUIDED_INTENTS/GUIDED_SECOND_STEPS are all untouched (the Edge Function's
// own parallel id copy, and the request-payload `guidedIntent` value it
// receives, are byte-for-byte the same as before this task). Two kinds of
// top-level entry:
//   - `directIntent`: a singleton group that IS the leaf intent itself -
//     selecting it sets guidedIntent immediately, skipping a pointless
//     one-item subtopic screen. Only `quotes` qualifies (it already has its
//     own existing second step in GUIDED_SECOND_STEPS above, unaffected).
//   - `children`: a real group of >=2 leaf intents - selecting it shows
//     only those children (siblings/other groups hidden), each a normal
//     `GUIDED_INTENTS` entry, unchanged.
// Grouping rationale, so a future session does not have to re-derive it:
// Help & Support bundles the three "something about using the product is
// unclear/broken" intents; Plans & Billing and My Business each bundle two
// intents that were already conceptually adjacent in the flat list; Feedback
// & Questions bundles the three catch-all/non-task-specific intents. No
// leaf's own label/id/GUIDED_SECOND_STEPS entry changed - only new parent
// labels were introduced.
// heDesc/enDesc (Descriptive Guided AI Cards + Context Header task): the
// Owner's own exact given wording, verbatim, for all 5 - see that task's
// own final report for the full HE/EN copy matrix.
export const GUIDED_TOPIC_GROUPS = [
  { id: 'quotes', he: 'הצעות מחיר', en: 'Quotes', directIntent: 'quotes', heDesc: 'יצירה, חיפוש, סטטוס ופעולות על הצעות', enDesc: 'Create, find, track status, and manage quotes' },
  { id: 'help_support', he: 'עזרה ותמיכה', en: 'Help & Support', children: ['current_process_help', 'software_help', 'technical_problem'], heDesc: 'עזרה בתהליך הנוכחי או פתרון תקלה', enDesc: "Help with what you're doing now, or fixing a problem" },
  { id: 'plans_billing', he: 'מסלולים ותשלומים', en: 'Plans & Billing', children: ['plans_subscription', 'billing_payment'], heDesc: 'חבילות, מנוי, חיובים ותשלומים', enDesc: 'Plans, subscription, billing and payments' },
  { id: 'my_business', he: 'העסק שלי', en: 'My Business', children: ['clients', 'business_settings'], heDesc: 'לקוחות, פרטי העסק והגדרות', enDesc: 'Clients, business details and settings' },
  { id: 'feedback_questions', he: 'משוב ושאלות', en: 'Feedback & Questions', children: ['suggestion', 'general_question', 'other'], heDesc: 'שאלה כללית, רעיון או משוב', enDesc: 'A general question, an idea, or feedback' },
];

export function getGuidedIntentLabel(intentId, isHebrew) {
  const intent = GUIDED_INTENTS.find((i) => i.id === intentId);
  if (!intent) return '';
  return isHebrew ? intent.he : intent.en;
}

export function getGuidedIntentDescription(intentId, isHebrew) {
  const intent = GUIDED_INTENTS.find((i) => i.id === intentId);
  if (!intent) return '';
  return isHebrew ? intent.heDesc : intent.enDesc;
}

export function getGuidedGroupForIntent(intentId, groups = GUIDED_TOPIC_GROUPS) {
  return groups.find((g) => g.directIntent === intentId || g.children?.includes(intentId)) || null;
}

// Public-vs-authenticated chat surface separation (Context-Aware AI Chat
// task, root architectural defect fix): the flat/grouped taxonomy above was
// built once and shown identically on the public landing surface and the
// authenticated Dashboard surface - an anonymous visitor could reach
// "My Business" (clients/business_settings), "Current process help",
// "Technical problem", or "Billing/payment", none of which make sense
// without an actual account. GUIDED_INTENTS/GUIDED_INTENT_IDS/
// GUIDED_SECOND_STEPS above are completely unchanged (still the single
// canonical 11-id list the Edge Function's own parallel copy validates
// against) - this is a presentation-layer allowlist only, consumed by
// AIChatWidget.jsx to pick which groups to render for which surface.
// Public-safe intents only: general product/feature questions (quotes,
// software_help, plans_subscription), feedback (suggestion,
// general_question), and the universal other/free-text escape. Excluded:
// current_process_help (no workflow exists pre-login), technical_problem
// (implies existing usage), billing_payment (implies an existing account's
// billing), clients/business_settings (implies an existing business).
export const PUBLIC_SAFE_INTENT_IDS = [
  'quotes', 'software_help', 'plans_subscription', 'suggestion', 'general_question', 'other',
];

// Flat (no second-level submenu) by design - the Owner's public contract
// asks for "roughly 1-2 guided steps maximum" and a visitor-facing list is
// short enough to need no grouping tier at all. Each entry reuses the
// exact same leaf intent's own id/label/description (never re-typed, never
// a parallel/duplicate intent id) - guaranteed below by deriving the group
// directly from GUIDED_INTENTS rather than hand-authoring separate public
// copy, so there is no possible drift between a leaf's authenticated
// wording and its public wording (there is only ever one wording per
// intent, full stop).
export const PUBLIC_TOPIC_GROUPS = PUBLIC_SAFE_INTENT_IDS.map((id) => {
  const intent = GUIDED_INTENTS.find((i) => i.id === id);
  return { id, he: intent.he, en: intent.en, directIntent: id, heDesc: intent.heDesc, enDesc: intent.enDesc };
});

// Single entry point AIChatWidget.jsx uses instead of reading
// GUIDED_TOPIC_GROUPS directly, so the surface split can never be
// accidentally bypassed by a future edit that forgets the isDashboard
// check.
export function getTopicGroupsForSurface(isDashboard) {
  return isDashboard ? GUIDED_TOPIC_GROUPS : PUBLIC_TOPIC_GROUPS;
}

// Context-Driven AI Chat V3, §16 "Contextual Menus" / "STATIC UNIVERSAL
// AUTHENTICATED MENU: RETIRED": per-screen guided menus, each a curated
// 3-5-item SUBSET of the exact same 11 leaf intents above - never a new,
// parallel taxonomy (there is still only ONE set of ids, ONE set of labels/
// descriptions, ONE Edge Function validation set). `screenId` values come
// from src/utils/aiChatContext.js's own resolveAIChatContext() - the one
// canonical context resolver - never re-derived here.
//
// A screen with no entry (or an explicit `null`) falls back to the
// existing universal GUIDED_TOPIC_GROUPS (see getContextualMenuIntentIds
// below) - this is intentional, not an oversight: 'quote_history'/'neutral'
// (Dashboard overview, or any future screen this table hasn't been taught
// about yet) has no single dominant workflow, so the broader 5-group menu
// remains genuinely the most useful default there, exactly as the
// "Hierarchical Guided AI Chat Flow" task's own paused follow-up (see
// PROFLOW_CODEX_CHECKPOINT.md, 2026-09-18 Stage-1-continuation entry)
// already planned before being interrupted by an Owner side-task.
//
// quote_editor_edit deliberately excludes 'quotes': §9 "EDIT QUOTE CURRENT
// OBJECT" already auto-binds the quote being edited (see AIChatWidget.jsx's
// activeEditingQuoteId effect) - re-offering the manual quotes
// picker/second-step here would be a redundant, confusing extra step for a
// quote the chat already has full context on.
// quote_editor_new deliberately excludes 'quotes' too: §8 "NEW QUOTE
// CONTEXT > EXISTING QUOTE PICKER" - an unsaved draft has no existing-quote
// picker to offer by default.
export const CONTEXTUAL_MENUS = {
  item_wizard: ['current_process_help', 'software_help', 'technical_problem'],
  quote_editor_new: ['current_process_help', 'clients', 'suggestion'],
  quote_editor_edit: ['current_process_help', 'clients', 'general_question'],
  clients: ['clients', 'current_process_help', 'general_question'],
  settings: ['business_settings', 'current_process_help', 'general_question'],
  finances: ['current_process_help', 'suggestion', 'general_question'],
  catalog: ['software_help', 'current_process_help', 'general_question'],
  plans: ['plans_subscription', 'billing_payment', 'general_question'],
  admin: ['current_process_help', 'technical_problem', 'general_question'],
};

// Returns null (meaning "use the universal GUIDED_TOPIC_GROUPS fallback")
// for any screenId with no specific entry above - never throws, never
// guesses a menu for an unmapped screen.
export function getContextualMenuIntentIds(screenId) {
  return CONTEXTUAL_MENUS[screenId] || null;
}

// Adapter so AIChatWidget.jsx's existing Level-1 render loop (which already
// knows how to render a `directIntent` singleton group - 'quotes' has
// always been one) can render a contextual menu with ZERO new rendering
// code: every contextual leaf becomes its own singleton group, reusing its
// own already-canonical label/description (never re-typed, so there is no
// possible drift between a leaf's universal wording and its contextual
// wording - there is only ever one wording per intent, exactly the same
// guarantee PUBLIC_TOPIC_GROUPS already gives). Returns null (use the
// universal GUIDED_TOPIC_GROUPS) when this screen has no specific entry.
export function getContextualTopicGroups(screenId) {
  const ids = getContextualMenuIntentIds(screenId);
  if (!ids) return null;
  return ids.map((id) => {
    const intent = GUIDED_INTENTS.find((i) => i.id === id);
    return { id, he: intent.he, en: intent.en, directIntent: id, heDesc: intent.heDesc, enDesc: intent.enDesc };
  });
}

// Context-Driven AI Chat V3, §14 "Terminal Intent Registry": every leaf
// this module can ever present (the universal 11 + 'other') maps to exactly
// one terminal outcome type - asserted complete/orphan-free by
// guidedChatIntents.test.js. 'quotes' is the only 'submenu' (its own
// GUIDED_SECOND_STEPS + quote-selector, see AIChatWidget.jsx) - every other
// leaf (including every id referenced by CONTEXTUAL_MENUS above, which are
// always a subset of GUIDED_INTENT_IDS) resolves to 'model_answer': picking
// it seeds a contextual hint (buildGuidedIntentHint, chat-ai/validation.ts)
// and focuses free-text input - the ANSWER is a real terminal outcome that
// arrives the moment the user sends their next message, never a dead end
// (§14 "DEAD-END TERMINAL INTENTS: ZERO").
export const TERMINAL_OUTCOMES = {
  quotes: 'submenu',
  current_process_help: 'model_answer',
  technical_problem: 'model_answer',
  software_help: 'model_answer',
  plans_subscription: 'model_answer',
  billing_payment: 'model_answer',
  clients: 'model_answer',
  business_settings: 'model_answer',
  suggestion: 'model_answer',
  general_question: 'model_answer',
  other: 'free_text',
};

export function getTerminalOutcome(intentId) {
  return TERMINAL_OUTCOMES[intentId] || null;
}
