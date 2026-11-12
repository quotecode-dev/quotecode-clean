// Owner console 2026-11-08 (night task, typed: "מאשר את תוכנית משימת הלילה: שלב 1 של בונה ההצעה ותחילת שלב 2 בענף נפרד בלי שחרור, כולל
// שינוי ב-L-09, L-14, L-15, L-17, L-23 ..."; the one quote builder, design A): stage 1 - the ONE place that turns an item entry (what the
// user chose: method, sizes, quantity, price, catalog origin) into the quote form item. Moved verbatim out of AddItemWizard.handleConfirm
// (no behaviour change) so that the row editor of stage 2 produces EXACTLY the same item shapes as the item window - the save, the
// customer's quote, the print and the PDF stay as they are.
import { cmToM, mToCm, computeMeasurementValue, resolveCalculationMethod, sumMeasurementAreas, isMeasurableUnit, getActiveQuantity } from './professionalQuoteItem';

// Task 34 extension (Owner AI specification, section ג): a MANUAL quantity with a measured unit (36 m², 8 linear meters, no measurement
// rows - the AI-draft hand-off / the form's manual override) is a charged quantity in its own right: the unit is not proof that the quantity
// came from dimensions. Such an item opens on its manual quantity (with its unit), never on invented width / height.
export const isManualMeasured = (item) => !!item && isMeasurableUnit(item.pricing_unit) && item.quantity_source === 'manual'
  && !(Array.isArray(item.measurements) && item.measurements.length > 0);

// A4: sizes are typed in cm (default) or m; the stored measurements stay canonical metres.
// Owner console 2026-11-05 (typed: "מאשר מספרים במילים ויחידות רגל מלאות לשוק הבינלאומי, כולל שינוי ב-L-09, L-14, L-15 ו-L-17, שחרור עד
// הלייב"): the international market may also type feet or inches. Those rows are stored in canonical FEET (row unit 'ft') and priced per
// sq ft / linear ft. A metric size and a feet size never mix in one item, and a typed size is converted only when the user switches the unit.
export const round4 = (n) => Math.round(n * 10000) / 10000;
export const SIZE_IN_CM = { cm: 1, m: 100, in: 2.54, ft: 30.48 };
export const isFeetUnit = (u) => u === 'ft' || u === 'in';
export const convertSizeBetween = (v, from, to) => {
  if (v === '' || v == null || !Number.isFinite(Number(v)) || from === to || !SIZE_IN_CM[from] || !SIZE_IN_CM[to]) return v;
  return String(round4((Number(v) * SIZE_IN_CM[from]) / SIZE_IN_CM[to]));
};
export const convertSizeText = (v, toUnit) => convertSizeBetween(v, toUnit === 'm' ? 'cm' : 'm', toUnit);
export const toFeet = (unit, v) => {
  if (v === '' || v == null) return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return Math.round((unit === 'in' ? n / 12 : n) * 1e10) / 1e10;
};
// a typed size in its unit -> the canonical stored value (metres, or feet for a feet size)
export const sizeToBase = (unit, v) => (isFeetUnit(unit) ? toFeet(unit, v) : cmToM(unit === 'm' ? convertSizeText(v, 'cm') : v));
// the priced unit of a measured method in the typed unit's system
export const measuredUnitFor = (method, unit) => (isFeetUnit(unit) ? (method === 'linear' ? 'linear_ft' : 'sq_ft') : (method === 'linear' ? 'linear_meter' : 'm2'));
export const isFeetPricingUnit = (u) => u === 'sq_ft' || u === 'linear_ft';
// Owner console 2026-11-08 (typed: "מאשר להחזיר הכול למה שהיה ... כולל שינוי ב-L-02 ... L-28"; restore item 01 of
// docs/CODEX_SPEC_DEFAULTS_AND_CHANGES_2026-11-08.md): the counted professional units of the Owner-approved unit set (§155.1.4/§156) are a
// billing type of every row again - stored exactly as the unit selector / the smart quote store them (pricing_unit + manual quantity)
export const COUNTED_UNITS = Object.freeze(['kg', 'hour', 'day']);
export const isCountedMethod = (m) => m === 'units' || COUNTED_UNITS.includes(m);

/**
 * The quote form item of one entry - exactly what the item window's "add" produced before stage 1.
 * entry: { pricingMethod: 'fixed'|'units'|'area'|'linear', description, unitPrice, catalogServiceId, sectionKey, quantity, measureUnit,
 *          useManualQty, manualQty, widthCm, heightCm, extraMeasureRows: [{ widthCm, heightCm, label }], specRows: [{ label, value }],
 *          editingItem, isEditMode, conversionConfirmed }
 */
export function buildQuoteItemFromEntry(entry) {
  const {
    pricingMethod, description, unitPrice, catalogServiceId = null, sectionKey = null, quantity = '', measureUnit = 'cm',
    useManualQty = false, manualQty = '', widthCm = '', heightCm = '', extraMeasureRows = [], specRows = [],
    editingItem = null, isEditMode = false, conversionConfirmed = false,
  } = entry;
  const finalSectionKey = sectionKey || null;
  const isMeasureMethod = pricingMethod === 'area' || pricingMethod === 'linear';
  const sizeToM = (v) => sizeToBase(measureUnit, v);
  const feetSizes = isFeetUnit(measureUnit);
  // חוק ברזל (SQ-F03): true רק כשזו עריכת פריט קיים שמעולם לא עברה
  // קונברסיית-שיטה מפורשת-ומאושרת (Part K) - במקרה הזה, ורק בו, מותר
  // לשמר בשקט שדות שלאשף אין UI עבורם כלל. קונברסיה מאושרת בפועל = כוונת-שינוי-פרשנות מפורשת של המשתמש,
  // ואז השדות החדשים/הריקים של הענף הנוכחי הם הנכונים, לא שימור.
  const isNonDestructiveEdit = isEditMode && !conversionConfirmed;

  let newItem;
  if (isMeasureMethod && useManualQty) {
    // "I already know the area / length": the existing manual measured item (Task 34) - a charged quantity in its unit, no sizes
    newItem = {
      description,
      quantity: '1',
      unit_price: unitPrice,
      isFromCatalog: !!catalogServiceId,
      section_key: finalSectionKey,
      pricing_unit: measuredUnitFor(pricingMethod, measureUnit),
      quantity_source: 'manual',
      calculation_method: 'manual',
      // restore item 16 (Owner 2026-11-08): the sizes of a line whose quantity was set by hand (the smart edit) stay as reference
      measurements: isNonDestructiveEdit && editingItem?.quantity_source === 'manual' && Array.isArray(editingItem?.measurements) ? editingItem.measurements : [],
      calculated_quantity: Number(manualQty),
    };
  } else if (COUNTED_UNITS.includes(pricingMethod)) {
    // restore item 01 (Owner 2026-11-08): kg / hour / day - a professional quantity item, the shape of the unit selector and the smart quote
    const q = quantity === '' || quantity == null ? NaN : Number(quantity);
    const keep = isNonDestructiveEdit && editingItem?.pricing_unit === pricingMethod;
    newItem = {
      description,
      quantity: quantity || '1',
      unit_price: unitPrice,
      isFromCatalog: !!catalogServiceId,
      section_key: finalSectionKey,
      pricing_unit: pricingMethod,
      quantity_source: keep ? (editingItem.quantity_source || 'manual') : 'manual',
      calculation_method: keep ? (editingItem.calculation_method || resolveCalculationMethod(pricingMethod, 'manual')) : resolveCalculationMethod(pricingMethod, 'manual'),
      calculated_quantity: Number.isFinite(q) ? q : (keep ? editingItem.calculated_quantity : 1),
    };
  } else if (isMeasureMethod) {
    const calcMethod = resolveCalculationMethod(measuredUnitFor(pricingMethod, measureUnit), 'calculated');
    const originalMeasurements = isNonDestructiveEdit && Array.isArray(editingItem?.measurements) ? editingItem.measurements : [];
    const [originalFirstRow, ...originalExtraRows] = originalMeasurements;
    // חוק ברזל (SQ-F03 - "first measurement label being erased"): the label of row 0 exists only on the saved item - restored from it.
    const rawRows = [{ widthCm, heightCm, label: originalFirstRow?.label || '' }, ...extraMeasureRows];
    const measurementRows = rawRows
      .map((row, idx) => {
        const rWidthM = sizeToM(row.widthCm);
        const rHeightM = pricingMethod === 'linear' ? '' : sizeToM(row.heightCm);
        const rowValue = computeMeasurementValue(pricingMethod, rWidthM, pricingMethod === 'linear' ? undefined : rHeightM);
        // חוק ברזל (SQ-F03 - "is_pricing_driving being rewritten"): preserved by original row position (a "display only" row stays so).
        const originalRow = idx === 0 ? originalFirstRow : originalExtraRows[idx - 1];
        const preservedDriving = originalRow && originalRow.is_pricing_driving === false ? false : true;
        return { widthCm: row.widthCm, heightCm: row.heightCm, widthM: rWidthM, heightM: rHeightM, label: row.label || '', rowValue, isDriving: preservedDriving };
      })
      .filter((row) => row.rowValue != null && Number.isFinite(row.rowValue))
      .map((row) => ({
        width: row.widthM,
        height: row.heightM,
        unit: feetSizes ? 'ft' : 'm',
        calculated_area: row.rowValue,
        label: row.label,
        is_pricing_driving: row.isDriving,
      }));
    // חוק ברזל (SQ-F03-A closure): sumMeasurementAreas skips "display only" rows - the one canonical authority, no second formula.
    const totalValue = measurementRows.length > 0
      ? sumMeasurementAreas(measurementRows, calcMethod)
      : null;
    // חוק ברזל (SQ-F03 - "measured item with manual quantity being re-emitted as calculated quantity"): an original manual source is restored.
    const originalQuantitySource = isNonDestructiveEdit ? editingItem?.quantity_source : null;
    const isManualPreserved = originalQuantitySource === 'manual';
    const finalQuantitySource = isManualPreserved ? 'manual' : 'calculated';
    const finalCalcMethod = isManualPreserved ? 'manual' : calcMethod;
    const finalCalculatedQuantity = isManualPreserved
      ? ((editingItem.calculated_quantity !== undefined && editingItem.calculated_quantity !== null && editingItem.calculated_quantity !== '')
        ? editingItem.calculated_quantity
        : (totalValue != null ? totalValue : ''))
      : (totalValue != null ? totalValue : '');
    newItem = {
      description,
      quantity: '1',
      unit_price: unitPrice,
      isFromCatalog: !!catalogServiceId,
      section_key: finalSectionKey,
      pricing_unit: measuredUnitFor(pricingMethod, measureUnit),
      quantity_source: finalQuantitySource,
      calculation_method: finalCalcMethod,
      measurements: measurementRows,
      calculated_quantity: finalCalculatedQuantity,
    };
  } else if (pricingMethod === 'units') {
    newItem = {
      description,
      quantity: quantity || '1',
      unit_price: unitPrice,
      isFromCatalog: !!catalogServiceId,
      section_key: finalSectionKey,
    };
    // חוק ברזל (SQ-F03 - "non-area/non-length structured units being collapsed into generic quantity semantics"): an edit without a
    // confirmed conversion keeps the exact pricing_unit / quantity_source / calculation_method (unit / kg / hour / day).
    // Task 34: a manual measured item (isManualMeasured) keeps its measured unit, manual source and (empty) measurement rows as well
    if (isNonDestructiveEdit && isManualMeasured(editingItem)) {
      newItem.quantity = editingItem.quantity ?? '1';
      newItem.pricing_unit = editingItem.pricing_unit;
      newItem.quantity_source = 'manual';
      newItem.calculation_method = editingItem.calculation_method || 'manual';
      newItem.measurements = Array.isArray(editingItem.measurements) ? editingItem.measurements : [];
      newItem.calculated_quantity = (quantity !== '' && quantity != null && Number.isFinite(Number(quantity))) ? Number(quantity) : editingItem.calculated_quantity;
    } else if (isNonDestructiveEdit && editingItem?.pricing_unit && !isMeasurableUnit(editingItem.pricing_unit)) {
      newItem.pricing_unit = editingItem.pricing_unit;
      newItem.quantity_source = editingItem.quantity_source || 'manual';
      newItem.calculation_method = editingItem.calculation_method || 'manual';
      // חוק ברזל (SQ-F03-B closure): calculated_quantity is written too, else an hours / kg / day item collapses to the raw quantity
      newItem.calculated_quantity = (quantity !== '' && quantity != null && Number.isFinite(Number(quantity)))
        ? Number(quantity)
        : editingItem.calculated_quantity;
    }
  } else {
    // 'fixed'
    newItem = {
      description,
      quantity: '1',
      unit_price: unitPrice,
      isFromCatalog: !!catalogServiceId,
      section_key: finalSectionKey,
    };
  }
  if (editingItem && editingItem.id) newItem.id = editingItem.id;
  if (specRows.length > 0) {
    newItem.specification = specRows.filter((r) => r.label.trim() || r.value.trim());
  }
  // 2026-11-12 (unified quote): the room tag of the row survives every rebuild (an edit of the price, quantity or billing method);
  // a new row takes the entry's room
  const room = entry.room !== undefined ? entry.room : (editingItem && editingItem.room);
  if (typeof room === 'string' && room.trim()) newItem.room = room.trim();
  return newItem;
}

/** The entry of an existing item (the item window's edit state) - moved verbatim from AddItemWizard.stateFromItem (stage 1). */
export function entryFromItem(item, defaultSectionKey) {
  const pricingMethod = isManualMeasured(item)
    ? 'units'
    : item.pricing_unit === 'linear_meter' || item.pricing_unit === 'linear_ft'
      ? 'linear'
      : item.pricing_unit === 'm2' || item.pricing_unit === 'sq_ft'
        ? 'area'
        : 'units';
  const rows = Array.isArray(item.measurements) ? item.measurements : [];
  const [firstRow, ...restRows] = rows;
  // a feet item opens in feet (its rows are stored in feet); a metric item in cm, exactly as before
  const feet = isFeetPricingUnit(item.pricing_unit);
  const shown = (v) => (feet ? (v === '' || v == null ? '' : String(v)) : mToCm(v));
  return {
    description: item.description || '',
    catalogServiceId: '',
    pricingMethod,
    measureUnit: feet ? 'ft' : 'cm',
    widthCm: firstRow ? shown(firstRow.width) : '',
    heightCm: firstRow ? shown(firstRow.height) : '',
    extraMeasureRows: restRows.map((r) => ({ widthCm: shown(r.width), heightCm: shown(r.height), label: r.label || '' })),
    // חוק ברזל (SQ-F03-B - "non-area/non-length structured units being
    // collapsed": a manual hour/day/kg/professional-unit item can carry a
    // real effective quantity in calculated_quantity while its flat
    // quantity column is a different placeholder value - reading raw
    // item.quantity here silently showed/re-saved the WRONG number the
    // moment the field round-tripped through this wizard. getActiveQuantity
    // (the one existing canonical authority, already used by Dashboard.jsx/
    // QuoteForm.jsx for the exact same "what is the real charged quantity"
    // question) is a strict superset: for an ordinary simple item with no
    // calculated_quantity at all, it already falls back to item.quantity -
    // byte-identical to the previous behavior for every non-professional
    // item, so this only changes previously-wrong professional-manual cases.
    quantity: pricingMethod === 'units' ? String(getActiveQuantity(item) || item.quantity || '1') : '1',
    unitPrice: item.unit_price != null ? String(item.unit_price) : '',
    sectionKey: item.section_key || defaultSectionKey || '',
    specRows: Array.isArray(item.specification) ? item.specification.map((r) => ({ label: r.label || '', value: r.value || '' })) : [],
    _hadMeasurementRows: rows.length > 0,
  };
}

// Owner console 2026-11-08 (decision 3, typed: "מאשר החלטה 3 - שורה ישנה בלי סוג חיוב מוצגת כ\"סכום קבוע\" וניתנת לשינוי, וההצעה השמורה לא
// משתנה"): the row editor shows a line of quantity 1 with no pricing unit and no sizes as a FIXED amount. Nothing is rewritten: a fixed
// amount and "1 unit" produce the very same stored item (buildQuoteItemFromEntry), so the saved quote is unchanged.
export function rowEntryFromItem(item, defaultSectionKey) {
  const entry = entryFromItem(item, defaultSectionKey);
  // only a SAVED (old) line - a new row starts as units (decision 2)
  const saved = !!item.id;
  const noUnit = !item.pricing_unit && !(Array.isArray(item.measurements) && item.measurements.length > 0);
  const one = Number(getActiveQuantity(item) || item.quantity || 1) === 1;
  return saved && noUnit && one && entry.pricingMethod === 'units' ? { ...entry, pricingMethod: 'fixed', quantity: '1' } : entry;
}

// stage 2 (Owner 2026-11-08, decisions 2 / 3): the row editor's blank row and opening entry
/** a blank row (decision 2): quantity 1, units, no price yet */
export const blankRowItem = (sectionKey = null) => ({ description: '', quantity: '1', unit_price: '', isFromCatalog: false, section_key: sectionKey });

// Owner console 2026-11-09 (item 08, typed: "שמור את אופן החיוב בשדה נפרד במסד. השורה תיפתח נכון, והמסמך של הלקוח לא ישתנה בכלל"):
// the billing method stored for a row - only "fixed" / "units" of a row with no pricing unit and no sizes (both store the very same
// line); every other row is described by its pricing unit, so nothing is stored (null). Migration 20261109100000 (quote_items.billing_method).
export function storedBillingMethod(item) {
  if (!item || item.pricing_unit) return null;
  if ((Array.isArray(item.measurements) && item.measurements.length > 0) || (Array.isArray(item.quote_item_measurements) && item.quote_item_measurements.length > 0)) return null;
  const b = item._billing || item.billing_method;
  return b === 'fixed' || b === 'units' ? b : null;
}

/** the entry of a row when it opens: the item's own entry (decision 3), with the market's size unit for a row that has no sizes yet */
export function rowEntry(item, international) {
  const opened = rowEntryFromItem(item, null);
  // the row's own choice (a fixed amount and "1 unit" store the same line): the screen mark, else the stored billing method (item 08)
  const chosen = item._billing || item.billing_method;
  const e = (chosen === 'fixed' || chosen === 'units') && (opened.pricingMethod === 'fixed' || opened.pricingMethod === 'units')
    ? { ...opened, pricingMethod: chosen, quantity: chosen === 'fixed' ? '1' : opened.quantity } : opened;
  // a known area / length (a manual measured item) opens as that billing type with its known amount, in its own unit
  if (isManualMeasured(item)) {
    const linear = item.pricing_unit === 'linear_meter' || item.pricing_unit === 'linear_ft';
    const amount = item.calculated_quantity;
    return { ...e, pricingMethod: linear ? 'linear' : 'area', useManualQty: true, manualQty: amount === '' || amount == null ? '' : String(amount), measureUnit: isFeetPricingUnit(item.pricing_unit) ? 'ft' : 'm' };
  }
  const hasSizes = Array.isArray(item.measurements) && item.measurements.length > 0;
  // restore item 16 (Owner 2026-11-08): a measured line whose quantity was set by hand (the smart edit keeps its sizes) opens as a KNOWN
  // amount - the hand-set quantity is what is charged; its sizes are shown for reference only
  if (hasSizes && isMeasurableUnit(item.pricing_unit) && item.quantity_source === 'manual') {
    const linear = item.pricing_unit === 'linear_meter' || item.pricing_unit === 'linear_ft';
    const amount = item.calculated_quantity;
    // its sizes stay in the entry (metric ones in metres, as every row shows them) so "Enter sizes instead" starts from them
    const toM = (v) => (e.measureUnit === 'cm' ? convertSizeText(v, 'm') : v);
    return { ...e, pricingMethod: linear ? 'linear' : 'area', useManualQty: true, manualQty: amount === '' || amount == null ? '' : String(amount),
      measureUnit: isFeetPricingUnit(item.pricing_unit) ? 'ft' : 'm', referenceSizes: true, widthCm: toM(e.widthCm), heightCm: toM(e.heightCm),
      extraMeasureRows: (e.extraMeasureRows || []).map((r) => ({ ...r, widthCm: toM(r.widthCm), heightCm: toM(r.heightCm) })) };
  }
  // restore item 01: a kg / hour / day line opens as its own billing type with its charged quantity
  if (COUNTED_UNITS.includes(item.pricing_unit)) {
    return { ...e, pricingMethod: item.pricing_unit, quantity: String(getActiveQuantity(item) || item.quantity || '1'), measureUnit: international ? 'ft' : 'm' };
  }
  if (!hasSizes && e.pricingMethod !== 'area' && e.pricingMethod !== 'linear') return { ...e, measureUnit: international ? 'ft' : 'm' };
  // decision 2: metric sizes are shown in METRES in the row editor (the item window opens them in cm); the stored values are unchanged
  if (e.measureUnit === 'cm') {
    const toM = (v) => convertSizeText(v, 'm');
    return { ...e, measureUnit: 'm', widthCm: toM(e.widthCm), heightCm: toM(e.heightCm), extraMeasureRows: (e.extraMeasureRows || []).map((r) => ({ ...r, widthCm: toM(r.widthCm), heightCm: toM(r.heightCm) })) };
  }
  return e;
}

