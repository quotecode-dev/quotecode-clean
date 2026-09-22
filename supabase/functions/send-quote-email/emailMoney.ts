// IRON-ILS-001 (email surface). Deno Edge Functions cannot import src/utils/money.js, so this is the deliberate server copy of
// formatMoneyForCurrency for the one money value the quote email shows (the total). resolveEmailRegion only ever returns '₪'
// for a Local account, so the symbol is the authoritative ILS signal here.
// ILS: nearest whole shekel, conventional half-up (half AWAY from zero for negatives), always ".00" (100.49 -> 100.00,
// 100.50 -> 101.00). Other currencies: full cent precision. Display only - the stored total is never changed.
export function formatEmailTotal(total: unknown, symbol: string): string {
  const raw = Number(total || 0)
  const n = Number.isFinite(raw) ? raw : 0
  let value = n
  if (symbol === '₪') {
    const a = Math.abs(n)
    const f = Math.floor(a)
    const r = a - f >= 0.5 ? f + 1 : f
    value = n < 0 && r !== 0 ? -r : r
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
