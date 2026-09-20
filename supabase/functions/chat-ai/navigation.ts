// AI Chat Gate 2, §8: safe, read-only, allowlisted navigation suggestions.
// The model is never wired to any real navigation/routing API - it can only
// emit a plain-text marker at the very end of its answer, which this module
// parses, validates against a closed enum, and strips from the visible
// answer. The frontend never receives (or could render) a free-form URL or
// model-authored destination; it only ever receives one of the 7 fixed ids
// below, and renders a PRODUCT-OWNED label for it (src/utils/
// safeNavigation.js) - the model contributes only the choice of WHICH
// destination, never the label or a destination outside this list.
export const NAVIGATION_ACTION_IDS = [
  'open_quote_history',
  'open_clients',
  'open_business_settings',
  'open_catalog',
  'open_finances',
  'open_plan_information',
  'open_selected_quote',
] as const;

export type NavigationActionId = typeof NAVIGATION_ACTION_IDS[number];

const ALLOWED_SET: ReadonlySet<string> = new Set(NAVIGATION_ACTION_IDS);

// Matches a trailing "NAVIGATE: <action>" line (the instruction told to the
// model in buildSystemPrompt). Case-insensitive, tolerant of surrounding
// whitespace/newlines - anything not matching this exact trailing-marker
// shape is simply not treated as a navigation suggestion (fails closed to
// "no navigation", never to an error).
const NAV_MARKER_RE = /\n?\s*NAVIGATE:\s*([a-zA-Z_]+)\s*$/i;

export type NavigationExtractionResult = {
  answer: string;
  action: NavigationActionId | null;
};

// `hasSelectedQuoteContext` must be true only when a specific quote is both
// selected AND authorized this exact turn (see index.ts) - `open_selected_quote`
// is rejected otherwise, so a stale/hallucinated suggestion can never point
// at a quote the current turn was not actually authorized to discuss.
export function extractNavigationAction(rawAnswer: string, hasSelectedQuoteContext: boolean): NavigationExtractionResult {
  const text = typeof rawAnswer === 'string' ? rawAnswer : '';
  const match = text.match(NAV_MARKER_RE);
  if (!match) {
    return { answer: text.trim(), action: null };
  }

  const cleanAnswer = text.slice(0, match.index).trim();
  const candidate = match[1].toLowerCase();

  if (!ALLOWED_SET.has(candidate)) {
    return { answer: cleanAnswer, action: null };
  }
  if (candidate === 'open_selected_quote' && !hasSelectedQuoteContext) {
    return { answer: cleanAnswer, action: null };
  }

  return { answer: cleanAnswer, action: candidate as NavigationActionId };
}
