// David Aluminum demo only. Turns a classified item (from
// professionalItemClassifier.js - kind: 'simple'|'measured'|'repeating',
// measurements: real dimensions already matched from the quote's own real
// notes field) into customer-facing Hebrew text. Pure presentation - never
// invents a number, only phrases the ones the classifier already found.

function m2Label(area) {
  // Customer-facing display rounds to 2 decimals - the classifier keeps full
  // precision for internal/business use, but a customer never needs to see
  // e.g. "22.0446" when "22.04" (or even "כ-22") reads more naturally.
  const rounded = Math.round(area * 100) / 100;
  return `${rounded} מ״ר`;
}

/**
 * @returns {{ summary: string|null, detailRows: string[] }}
 *   summary   - one concise line, safe to show even when collapsed.
 *   detailRows - one line per real measurement, for expanded/detailed views.
 */
export function buildCustomerFriendlySpec(item) {
  if (item.kind === 'simple' || !item.measurements) {
    return { summary: null, detailRows: [] };
  }

  if (item.kind === 'measured') {
    const [m] = item.measurements;
    return {
      summary: `מידה: ${m.width}×${m.height} ס״מ (${m2Label(m.area_m2)})`,
      detailRows: [`${m.width}×${m.height} ס״מ — ${m2Label(m.area_m2)}`],
    };
  }

  // repeating
  const count = item.measurements.length;
  return {
    summary: `${count} פתחים במידות שונות (סה״כ ${m2Label(item.totalArea_m2)})`,
    detailRows: item.measurements.map(
      (m, i) => `פתח ${i + 1}: ${m.width}×${m.height} ס״מ — ${m2Label(m.area_m2)}`
    ),
  };
}

/**
 * Concept B+ only: a shorter, bullet-separated one-line variant of the same
 * summary, for a denser continuous-document layout. Same real numbers as
 * buildCustomerFriendlySpec - never a second source of truth.
 * @returns {string|null}
 */
export function buildCompactSummary(item) {
  if (item.kind === 'simple' || !item.measurements) return null;

  if (item.kind === 'measured') {
    const [m] = item.measurements;
    return `${m.width}×${m.height} ס״מ • ${m2Label(m.area_m2)}`;
  }

  const count = item.measurements.length;
  return `${count} פתחים • ${m2Label(item.totalArea_m2)}`;
}
