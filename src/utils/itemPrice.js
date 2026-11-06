// Task 34 extension: the per-item price input of the Edit price dialog. '' = a missing price (kept missing), '0' = an intentional free
// line, otherwise a non-negative number with at most 2 decimals. Anything else is refused - never guessed.
// Task 35 (Codex F3: "1,,2" was read as 1.2 and "1,2,3" as 12.3): one strict grammar - '.' is the ONLY decimal point (1-2 places) and
// ',' is accepted only as complete thousands groups ("1,200", "1,234,567.50"). A decimal comma ("99,5"), a currency sign, a sign,
// an exponent, inner spaces, NaN / Infinity or more than 10,000,000 are refused with a message.
const PRICE_GRAMMAR = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
export const MAX_ITEM_PRICE = 10000000;
export const parsePriceInput = (raw) => {
  const s = String(raw ?? '').trim();
  if (s === '') return { ok: true, value: '' };
  if (!PRICE_GRAMMAR.test(s)) return { ok: false };
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) && n <= MAX_ITEM_PRICE ? { ok: true, value: String(n) } : { ok: false };
};

// Task 35 (Codex F4): the save payload of one item's price. quote_items.unit_price is NOT NULL, so a missing price is sent as the numeric 0
// TOGETHER WITH price_missing = true (the line is not free; the totals are partial). An intentional 0 is price_missing = false.
export const itemPricePayload = (item, activeQuantity) => {
  const missing = item?.price_missing === true || item?.unit_price === '' || item?.unit_price == null;
  const unitPrice = missing ? 0 : Number(item.unit_price);
  return { unit_price: unitPrice, total_price: missing ? 0 : Number(activeQuantity) * unitPrice, price_missing: missing };
};
// load: a saved missing price returns to the form as '' (missing); every other stored value (a 0 included) is kept as stored
export const formPriceFromSavedItem = (row) => (row?.price_missing === true ? '' : row?.unit_price);
