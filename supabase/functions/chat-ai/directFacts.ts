// Context-Driven AI Chat V3, §22 "Direct Facts": deterministic fact
// resolution BEFORE the model is ever called, for the small closed set of
// quote questions that have one exact right answer already sitting in
// already-authorized, already-fetched quote data (see index.ts's own
// selectedQuote fetch/ownership check, unchanged by this file - this module
// never fetches or authorizes anything itself, it only classifies a
// question and formats an already-sanitized SanitizedQuoteContext).
//
// Deliberately NOT included yet, disclosed rather than silently missing:
// client display name (§23 allows resolving it deterministically for an
// EXPLICIT request, but the current selectedQuote query - quoteContext.ts's
// own RawQuoteRow - never reads any client-identifying column at all, by
// this Gate's own field whitelist; adding it would mean widening that
// whitelist and a new join, out of scope for this task's own "no routine
// client-identity-to-model" boundary without a dedicated follow-up).
import type { DirectFactKind, DirectFactPayload } from "../_shared/aiChatContract.ts";
import { DIRECT_FACT_KINDS } from "../_shared/aiChatContract.ts";
import type { SanitizedQuoteContext } from "./quoteContext.ts";
import { formatShortDate } from "../_shared/shortDate.js";

// Keyword classification, same established style/precedent as
// validation.ts's own classifySupportMessage (lowercased .includes checks,
// no model call) - conservative on purpose: a message this does not
// recognize simply falls through to the ordinary model path, exactly as if
// this module didn't exist. A false "no match" costs nothing (the model
// still answers correctly, just without the fast path); a false match on
// the WRONG kind would not - so every pattern here is a genuinely
// unambiguous word/phrase for that one fact, not a broad guess.
const PATTERNS: Readonly<Record<DirectFactKind, RegExp>> = {
  amount: /(כמה עולה|כמה עולה ההצעה|מה הסכום|הסכום של|הסכום הכולל|כמה זה עולה|מחיר כולל|how much (does|is)|what('?s| is) the (total )?amount|total (price|cost)|how much is the quote)/i,
  status: /(מה הסטטוס|באיזה סטטוס|מה המצב של ההצעה|status of|what('?s| is) the status)/i,
  quote_number: /(מה מספר ההצעה|מספר ההצעה|quote number|what('?s| is) the quote number)/i,
  creation_date: /(מתי נוצרה|תאריך יצירה|when was.*(created|made)|creation date|date (was )?created)/i,
  validity_date: /(עד מתי.*בתוקף|תאריך תוקף|מתי פג התוקף|valid until|expir(y|ation) date|how long is.*valid)/i,
  item_count: /(כמה פריטים|מספר הפריטים|how many items|item count|number of items)/i,
};

// Precedence order for the rare message matching more than one pattern
// (e.g. "what's the amount and status?") - the FIRST, most likely to be the
// primary ask, wins; the rest of the question is still visible to the user
// as ordinary conversation if they follow up. Order chosen to match the
// task's own §22 required fact list ordering.
const PRECEDENCE: DirectFactKind[] = ['amount', 'status', 'quote_number', 'creation_date', 'validity_date', 'item_count'];

export function classifyDirectFactIntent(lastUserMessage: string): DirectFactKind | null {
  for (const kind of PRECEDENCE) {
    if (PATTERNS[kind].test(lastUserMessage)) return kind;
  }
  return null;
}

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };

function formatAmount(ctx: SanitizedQuoteContext): string {
  if (ctx.total === null) return '';
  const symbol = ctx.currency ? (CURRENCY_SYMBOLS[ctx.currency.toUpperCase()] ?? '') : '';
  // IRON-ILS-001: ILS => nearest whole shekel (half-up away from zero) rendered with ".00"; other currencies unchanged.
  if (ctx.currency && ctx.currency.toUpperCase() === 'ILS') {
    const a = Math.abs(ctx.total);
    const f = Math.floor(a);
    const r = a - f >= 0.5 ? f + 1 : f;
    const whole = ctx.total < 0 && r !== 0 ? -r : r;
    return `${symbol}${whole.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${symbol}${ctx.total.toFixed(2)}`;
}

// IRON-DATE-001: the shared product short-date primitive. isHebrew here is the server-derived account market
// (isHebrewFromMarket), so Local -> DD/MM/YYYY and International -> MM/DD/YYYY; valid_until is a calendar date (no zone shift).
function formatDate(iso: string, isHebrew: boolean): string {
  return formatShortDate(iso, isHebrew ? 'Local' : 'International');
}

// Returns null when the classified kind's own underlying data is genuinely
// absent (e.g. a quote with no valid_until set) - the caller falls through
// to the ordinary model path rather than fabricating "no date" as if it
// were itself the fact (§20: "unknown remains unknown").
export function resolveDirectFact(kind: DirectFactKind, ctx: SanitizedQuoteContext, isHebrew: boolean): DirectFactPayload | null {
  switch (kind) {
    case 'amount': {
      if (ctx.total === null) return null;
      return { kind, value: formatAmount(ctx), isDraft: false };
    }
    case 'status': {
      if (!ctx.status) return null;
      return { kind, value: ctx.status, isDraft: false };
    }
    case 'quote_number': {
      if (ctx.quoteNumber === null) return null;
      return { kind, value: String(ctx.quoteNumber), isDraft: false };
    }
    case 'creation_date': {
      if (!ctx.createdAt) return null;
      return { kind, value: formatDate(ctx.createdAt, isHebrew), isDraft: false };
    }
    case 'validity_date': {
      if (!ctx.validUntil) return null;
      return { kind, value: formatDate(ctx.validUntil, isHebrew), isDraft: false };
    }
    case 'item_count': {
      return { kind, value: String(ctx.items.length), isDraft: false };
    }
    default:
      return null;
  }
}

// A short, natural sentence stating the fact plainly - §22's own required
// "answer the fact FIRST" contract, but here as the ENTIRE deterministic
// answer (no model call happened at all), so it must stand alone as a
// complete, friendly reply, not a fragment.
export function formatDirectFactAnswer(payload: DirectFactPayload, isHebrew: boolean): string {
  const templates: Record<DirectFactKind, [string, string]> = {
    amount: [`הסכום הכולל של ההצעה הוא ${payload.value}.`, `The total amount of the quote is ${payload.value}.`],
    status: [`סטטוס ההצעה הוא: ${payload.value}.`, `The quote status is: ${payload.value}.`],
    quote_number: [`מספר ההצעה הוא ${payload.value}.`, `The quote number is ${payload.value}.`],
    creation_date: [`ההצעה נוצרה בתאריך ${payload.value}.`, `The quote was created on ${payload.value}.`],
    validity_date: [`ההצעה בתוקף עד ${payload.value}.`, `The quote is valid until ${payload.value}.`],
    item_count: [`בהצעה יש ${payload.value} פריטים.`, `The quote has ${payload.value} item(s).`],
  };
  const [he, en] = templates[payload.kind];
  return isHebrew ? he : en;
}

export { DIRECT_FACT_KINDS };
