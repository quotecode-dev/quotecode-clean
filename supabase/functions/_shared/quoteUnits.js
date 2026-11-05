// The ONE list of quote line unit ids for every reader of a line's unit (the AI smart quote, the quote from a file, the quote review
// snapshot of the chat, the customer twin) - the same ids as PROFESSIONAL_UNITS (src/utils/professionalQuoteItem.js), which holds
// their HE / EN labels. Owner console 2026-11-05 (typed: "מאשר מספרים במילים ויחידות רגל מלאות לשוק הבינלאומי, כולל שינוי ב-L-09,
// L-14, L-15 ו-L-17, שחרור עד הלייב"): + the feet units of the international market; before, five separate copies of this list
// existed and a unit missing from one of them became "no unit" there.
export const QUOTE_UNITS = Object.freeze(['unit', 'm2', 'linear_meter', 'kg', 'hour', 'day', 'sq_ft', 'linear_ft']);
// the units a unit picker offers per market (a line always keeps its own unit, whatever the market)
export const METRIC_QUOTE_UNITS = Object.freeze(['unit', 'm2', 'linear_meter', 'kg', 'hour', 'day']);
