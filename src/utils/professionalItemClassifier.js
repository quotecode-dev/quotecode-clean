// David Aluminum Professional Quote Preview - item classifier.
//
// This is a DEMO-ONLY, David-account-scoped transformation. It never writes
// anything - it only reads a quote's existing `quote_items` and `notes`
// fields (already persisted, untouched) and derives a presentational
// classification (Simple / Measured / Repeating measurements) plus, where
// the quote's own `notes` field already contains real dimension data for an
// item (matched by apartment/unit number + item type, both parsed from the
// item's own real `description` text), attaches those real numbers. No
// dimension is ever invented - an item with no matching notes data is
// classified `simple` and rendered exactly as it already appears today.

// Parses lines like "161×265" / "161X265" / "161x265" (Hebrew notes use ×).
const DIMENSION_LINE = /^(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)\s*$/;

// Parses a Hebrew apartment/unit header line, e.g. "דירה 33" or "דירה 32 ויטרינה :".
const APARTMENT_HEADER = /דירה\s*(\d+)/;

// Parses a sub-group header inside an apartment section, e.g. "ויטרינות :" / "חלונות :" / "רשת חלון :" / "רשת חלונות :".
const GROUP_HEADER = /(ויטרינ|חלו)/;

/**
 * Parses the free-text `notes` field into { [apartmentNumber]: { vitrine: [[w,h],...], window: [[w,h],...] } }.
 * Pure, deterministic, real-data-only - returns {} if nothing matches (never guesses).
 */
export function parseApartmentMeasurements(notesText) {
  const result = {};
  if (!notesText) return result;

  let currentApt = null;
  let currentGroup = null; // 'vitrine' | 'window'

  for (const rawLine of notesText.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const aptMatch = line.match(APARTMENT_HEADER);
    // Real notes text uses two conventions: "דירה 32" inline, or a "דירות :"
    // section header followed by a bare number on its own line (e.g. the
    // apartment-33 block in David's real quote). Both must resolve to the
    // same apartment key.
    const bareAptMatch = !aptMatch && /^\d+$/.test(line) ? line.match(/^(\d+)$/) : null;
    if (aptMatch || bareAptMatch) {
      currentApt = (aptMatch || bareAptMatch)[1];
      if (!result[currentApt]) result[currentApt] = { vitrine: [], window: [] };
      // A header line like "דירה 32 ויטרינה :" also declares its group inline.
      currentGroup = /ויטרינ/.test(line) ? 'vitrine' : /חלו/.test(line) ? 'window' : currentGroup;
      continue;
    }

    const groupMatch = line.match(GROUP_HEADER);
    if (groupMatch && !DIMENSION_LINE.test(line)) {
      currentGroup = /ויטרינ/.test(line) ? 'vitrine' : 'window';
      continue;
    }

    const dimMatch = line.match(DIMENSION_LINE);
    if (dimMatch && currentApt && currentGroup) {
      const w = parseFloat(dimMatch[1]);
      const h = parseFloat(dimMatch[2]);
      result[currentApt][currentGroup].push([w, h]);
    }
  }

  return result;
}

// Item-description parsers: real quote descriptions follow the pattern
// "<type text> דירה <N>" - e.g. "רשת ויטרינה 9000 דירה 33", "רשת חדש דירה 2",
// "תיקון זוויות דירה 33". Only "רשת ...ויטרינה..." / "רשת חדש" map to a
// measurement group; anything else (repairs, etc.) has no group and stays Simple.
function classifyDescription(description) {
  const aptMatch = description.match(APARTMENT_HEADER);
  if (!aptMatch) return { apartment: null, group: null };
  const apartment = aptMatch[1];
  if (/ויטרינ/.test(description)) return { apartment, group: 'vitrine' };
  if (/רשת/.test(description)) return { apartment, group: 'window' };
  return { apartment, group: null };
}

function m2(w, h) {
  return Math.round(((w / 100) * (h / 100)) * 10000) / 10000;
}

/**
 * Classifies a real quote's items against its own real notes.
 * @param {Array<{id, description, quantity, unit_price, total_price}>} items
 * @param {string} notesText
 * @returns classified items with `kind`: 'simple' | 'measured' | 'repeating',
 *   and (when matched) `measurements`: [{width, height, unit:'cm', area_m2}].
 */
export function classifyQuoteItems(items, notesText) {
  const apartments = parseApartmentMeasurements(notesText);
  // Track how many rows of each (apartment, group) have already been claimed,
  // so if two items ever pointed at the same group we would not silently
  // double-assign the same real dimensions to both.
  const claimed = {};

  return items.map((item) => {
    const { apartment, group } = classifyDescription(item.description || '');
    const qty = Number(item.quantity) || 0;
    const key = apartment && group ? `${apartment}:${group}` : null;
    const pool = key && apartments[apartment] ? apartments[apartment][group] : null;

    if (!pool || pool.length === 0) {
      return { ...item, kind: 'simple', measurements: null };
    }

    const already = claimed[key] || 0;
    const rows = pool.slice(already, already + qty);
    claimed[key] = already + rows.length;

    if (rows.length !== qty || rows.length === 0) {
      // Count mismatch between the commercial quantity and the real notes
      // data - do not force a classification that isn't actually backed by
      // a clean 1:1 real match. Falls back to Simple, exactly as instructed.
      return { ...item, kind: 'simple', measurements: null };
    }

    const measurements = rows.map(([w, h]) => ({ width: w, height: h, unit: 'cm', area_m2: m2(w, h) }));
    return {
      ...item,
      kind: rows.length > 1 ? 'repeating' : 'measured',
      measurements,
      totalArea_m2: Math.round(measurements.reduce((s, r) => s + r.area_m2, 0) * 10000) / 10000,
    };
  });
}
