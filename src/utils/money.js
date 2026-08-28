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
