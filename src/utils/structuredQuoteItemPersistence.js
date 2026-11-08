// Post-LIVE Priority 1, Fix A (empty placeholder item persistence, 2026-09-16):
// Dashboard.jsx's items state always seeds with one default row
// ({ description: '', quantity: '1', unit_price: '' }) and re-seeds it after
// every form reset. In the sectioned/professional flow the user never fills
// this original row in (all real content goes into named sections instead),
// so it previously reached save_quote_structured untouched and persisted as
// a real quote_items row with section_id=null - the "Unassigned $0.00" line
// observed on Public Quote in both Production synthetic smoke quotes.
//
// This filter is deliberately conservative and forward-only: it only ever
// excludes a row from what THIS save call writes, and only when every signal
// points to "never touched by the user" at once. It never inspects or
// removes an already-persisted row (id present) - editing an existing quote
// can never have this filter delete real historical data, preserving quote
// immutability for approved/paid/signed quotes untouched.
export function isUntouchedPlaceholderItem(item) {
  if (!item) return false;
  // Already persisted (has a real quote_items id) - never a placeholder to
  // strip; only a not-yet-saved row can possibly be the default seed.
  if (item.id) return false;
  // Explicit section assignment is itself a real, deliberate user action.
  if (item.section_key) return false;
  // Picking a catalog item is a real user action even before further edits.
  if (item.isFromCatalog) return false;

  const description = String(item.description || '').trim();
  if (description !== '') return false;

  const quantity = item.quantity;
  const isDefaultQuantity = quantity === '1' || quantity === 1 || quantity === '' || quantity == null;
  if (!isDefaultQuantity) return false;

  const unitPrice = item.unit_price;
  const isEmptyPrice = unitPrice === '' || unitPrice == null || Number(unitPrice) === 0;
  if (!isEmptyPrice) return false;

  // Any professional/structured content (pricing method, calculation
  // method, quantity source) is real, deliberate configuration.
  if (item.pricing_unit) return false;
  if (item.calculation_method) return false;
  if (item.quantity_source) return false;

  const hasSpecificationContent = Array.isArray(item.specification)
    && item.specification.some((row) => String(row?.label || '').trim() !== '' || String(row?.value || '').trim() !== '');
  if (hasSpecificationContent) return false;

  const hasMeasurementContent = Array.isArray(item.measurements)
    && item.measurements.some((m) => (m?.width !== '' && m?.width != null) || (m?.height !== '' && m?.height != null));
  if (hasMeasurementContent) return false;

  return true;
}

export function excludeUntouchedPlaceholderItems(items) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => !isUntouchedPlaceholderItem(item));
}
