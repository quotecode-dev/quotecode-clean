// Owner 2026-10-23 (typed L-09, L-13, L-14, L-17, L-22, L-24..L-27): every screen that re-derives the amounts of a SAVED quote
// (the public quote, the preview, print / PDF, the list tooltip, Customer Twin) uses the same IRON-ILS-001 rounding as the editor,
// so the discount, VAT and before-VAT amounts match the editor to the shekel. A shekel quote saved before the amendment
// (2026-10-22) still holds its old total, so a saved quote gets the rounding only when the rounded calculation reproduces its stored
// total; otherwise it keeps the calculation it always had. The editor preview ({ editing: true }) is the other way round: it shows the
// rounding (what the save will store) unless only the plain calculation reproduces the stored total of an unchanged old quote.
// calculateQuoteFinancials itself is untouched.
import { calculateQuoteFinancials } from './regionConfig';

const reproduces = (f, stored) => f && f.total !== null && f.total !== undefined && Math.abs(Number(f.total) - stored) < 0.005;

export function financialsMatchingStored(args, storedTotal, { editing = false } = {}) {
  const rounded = calculateQuoteFinancials(args);
  if (String(args?.currency || '').toUpperCase() !== 'ILS') return rounded;
  const stored = Number(storedTotal);
  const hasStored = !(storedTotal === null || storedTotal === undefined || storedTotal === '') && Number.isFinite(stored);
  if (editing && !hasStored) return rounded;
  const plain = calculateQuoteFinancials({ ...args, currency: undefined });
  if (!hasStored) return plain;
  if (editing) return reproduces(plain, stored) && !reproduces(rounded, stored) ? plain : rounded;
  return reproduces(rounded, stored) ? rounded : plain;
}
