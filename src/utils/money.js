// Canonical money-display formatter (Global Surface Audit finding I-1, Money
// Consolidation implementation pass). Before this file existed, several
// independently-written "formatNum" implementations were scattered across the
// app - two of them (Dashboard.jsx, PublicQuoteEn.jsx) silently applied
// Math.round() before formatting, discarding cents on every amount that
// passed through them (Total Revenue KPI, Quote History, Quote Form preview,
// Catalog prices, Finances KPI, CSV export, WhatsApp/share text, the entire
// English Public Quote page, and independently a third time in the
// send-quote-email Edge Function). A formatter's only job is textual
// presentation - it must never silently change the underlying business
// value. This is the single source of truth for that presentation going
// forward.
//
// The ONE deliberate exception - Local/ILS's final-payable-total whole-shekel
// rule - is NOT implemented here. It stays exactly where it already lived
// (PublicQuote.jsx's own named finalTotalRounded/netAmountDisplay/
// vatAmountDisplay, computed once for the one specific display site that
// needs it), per the explicit requirement that business rounding must be
// named and visible, never hidden inside a general-purpose formatter.
export const formatMoney = (value, locale = 'en-US') => {
  const num = Number(value || 0);
  try {
    return num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return num.toFixed(2);
  }
};

// Local/ILS whole-shekel customer-facing display law (Final Smart Quote
// Merge + Rounding Remediation task, CORRECTED by the immediately-following
// "Urgent Money Format Correction" task - the first pass here wrongly read
// "no agorot" as "no decimal point at all" (e.g. "₪7,659"). The actual
// Owner-required rule is: ROUND TO THE NEAREST WHOLE SHEKEL, THEN DISPLAY
// WITH EXACTLY TWO DECIMAL PLACES - the decimal part is therefore always
// ".00", never omitted and never non-zero. Exact required examples (do not
// re-derive this rule from first principles again - these are canonical):
//   7658.82  -> "7,659.00"
//   12091.82 -> "12,092.00"
//   4433     -> "4,433.00"
//   1980     -> "1,980.00"
// This restores/extends the same "Local/ILS's final-payable-total whole-
// shekel rule" this file's own header comment already documented as a
// deliberate, named exception, previously implemented ad hoc only at
// PublicQuote.jsx's own final-total box (finalTotalRounded/
// netAmountDisplay/vatAmountDisplay, which already round-then-force-two-
// decimals in the same spirit). This is DISPLAY-ONLY rounding: it never
// touches the value passed in, never persists anywhere, and the caller is
// expected to keep computing/summing with the full-precision number - only
// the last step (turning a number into text for a customer to read)
// rounds. Confirmed Owner-scoped to Local/ILS only: International
// (PublicQuoteEn.jsx) deliberately keeps calling formatMoney (full cent
// precision) instead - reusing this function there would reintroduce the
// exact "silently discarding cents on International" defect the Money
// Consolidation task (Global Surface Audit finding I-1) already fixed
// once. Do not call this from PublicQuoteEn.jsx.
export const formatWholeMoney = (value, locale = 'en-US') => {
  const rounded = Math.round(Number(value || 0));
  try {
    return rounded.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return rounded.toFixed(2);
  }
};
