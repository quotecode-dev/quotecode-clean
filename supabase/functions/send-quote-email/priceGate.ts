// Task 38 (Owner D1 = block, SERVER side): a quote with a line whose price was never entered (quote_items.price_missing = true) is never
// emailed to a customer; an intentional 0 is a price (price_missing = false) and passes. If the price state cannot be read the send is
// refused too (fail closed). PURE: the caller reads the flag and passes the answer; this module decides only.
// The messages are part of the API: src/utils/quoteEmailErrorClassification.js classifies them by their stable code prefix.
export const PRICE_MISSING_REFUSAL = 'QUOTE_PRICE_MISSING: This quote has items without a price - complete the prices before sending it to a customer.'
export const PRICE_UNVERIFIED_REFUSAL = 'QUOTE_PRICE_UNVERIFIED: Cannot verify the quote prices - refusing to send email.'

export type PriceGate = { ok: true } | { ok: false; code: 'QUOTE_PRICE_MISSING' | 'QUOTE_PRICE_UNVERIFIED'; message: string }

export function decidePriceGate(missingRows: unknown, missingErr: unknown): PriceGate {
  if (missingErr || !Array.isArray(missingRows)) return { ok: false, code: 'QUOTE_PRICE_UNVERIFIED', message: PRICE_UNVERIFIED_REFUSAL }
  if (missingRows.length > 0) return { ok: false, code: 'QUOTE_PRICE_MISSING', message: PRICE_MISSING_REFUSAL }
  return { ok: true }
}
