// @vitest-environment node
// Owner console 2026-11-08 (night task, the one quote builder, stage 1): the item shapes of every billing type, locked. The row editor of
// stage 2 must produce exactly these shapes (the save, the customer's quote, the print and the PDF read them unchanged).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildQuoteItemFromEntry, measuredUnitFor, sizeToBase, isManualMeasured } from './utils/quoteItemEntry';

const base = { description: 'עבודה', unitPrice: '120', catalogServiceId: null, sectionKey: null };

describe('the item shape of each billing type (stage 1 golden)', () => {
  it('fixed amount: one line, quantity 1, no unit', () => {
    expect(buildQuoteItemFromEntry({ ...base, pricingMethod: 'fixed', unitPrice: '250' }))
      .toEqual({ description: 'עבודה', quantity: '1', unit_price: '250', isFromCatalog: false, section_key: null });
  });
  it('units: the typed quantity (default 1), from the catalog, in a unit', () => {
    expect(buildQuoteItemFromEntry({ ...base, pricingMethod: 'units', quantity: '3', catalogServiceId: 'svc1', sectionKey: 'u1' }))
      .toEqual({ description: 'עבודה', quantity: '3', unit_price: '120', isFromCatalog: true, section_key: 'u1' });
    expect(buildQuoteItemFromEntry({ ...base, pricingMethod: 'units', quantity: '' }).quantity).toBe('1');
  });
  it('area in cm (Israel): 400 x 300 cm -> 12 m², stored in metres', () => {
    expect(buildQuoteItemFromEntry({ ...base, pricingMethod: 'area', measureUnit: 'cm', widthCm: '400', heightCm: '300' })).toEqual({
      description: 'עבודה', quantity: '1', unit_price: '120', isFromCatalog: false, section_key: null, pricing_unit: 'm2', quantity_source: 'calculated',
      calculation_method: 'area', measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: '', is_pricing_driving: true }], calculated_quantity: 12,
    });
  });
  it('area in metres and two rows: the sum', () => {
    const it2 = buildQuoteItemFromEntry({ ...base, pricingMethod: 'area', measureUnit: 'm', widthCm: '4', heightCm: '3', extraMeasureRows: [{ widthCm: '2', heightCm: '2.5', label: 'חדר' }] });
    expect(it2.calculated_quantity).toBe(17);
    expect(it2.measurements.map((m) => [m.width, m.height, m.label])).toEqual([[4, 3, ''], [2, 2.5, 'חדר']]);
  });
  it('length: one size, linear metres', () => {
    const l = buildQuoteItemFromEntry({ ...base, pricingMethod: 'linear', measureUnit: 'm', widthCm: '10' });
    expect([l.pricing_unit, l.calculation_method, l.calculated_quantity, l.measurements[0].height]).toEqual(['linear_meter', 'linear', 10, '']);
  });
  it('feet (international): 12 x 10 ft -> 120 sq ft, rows stored in feet; inches convert to feet', () => {
    const ft = buildQuoteItemFromEntry({ ...base, pricingMethod: 'area', measureUnit: 'ft', widthCm: '12', heightCm: '10' });
    expect([ft.pricing_unit, ft.calculated_quantity, ft.measurements[0].unit]).toEqual(['sq_ft', 120, 'ft']);
    const inch = buildQuoteItemFromEntry({ ...base, pricingMethod: 'linear', measureUnit: 'in', widthCm: '24' });
    expect([inch.pricing_unit, inch.calculated_quantity]).toEqual(['linear_ft', 2]);
  });
  it('a known area (no sizes): a manual measured quantity', () => {
    expect(buildQuoteItemFromEntry({ ...base, pricingMethod: 'area', measureUnit: 'cm', useManualQty: true, manualQty: '7.5' })).toMatchObject({
      pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', measurements: [], calculated_quantity: 7.5,
    });
  });
  it('an edit keeps what the entry has no field for: a display-only row, the first row label, hours, a manual measured item', () => {
    const editingItem = { id: 'i1', pricing_unit: 'm2', quantity_source: 'calculated', measurements: [{ label: 'סלון' }, { is_pricing_driving: false }] };
    const e = buildQuoteItemFromEntry({ ...base, pricingMethod: 'area', measureUnit: 'm', widthCm: '4', heightCm: '3', extraMeasureRows: [{ widthCm: '1', heightCm: '1', label: '' }], editingItem, isEditMode: true });
    expect([e.id, e.measurements[0].label, e.measurements[1].is_pricing_driving, e.calculated_quantity]).toEqual(['i1', 'סלון', false, 12]);
    const hours = buildQuoteItemFromEntry({ ...base, pricingMethod: 'units', quantity: '6', editingItem: { id: 'h', pricing_unit: 'hour', quantity_source: 'manual' }, isEditMode: true });
    expect([hours.pricing_unit, hours.calculated_quantity, hours.calculation_method]).toEqual(['hour', 6, 'manual']);
    const conv = buildQuoteItemFromEntry({ ...base, pricingMethod: 'units', quantity: '6', editingItem: { id: 'h', pricing_unit: 'hour' }, isEditMode: true, conversionConfirmed: true });
    expect(conv.pricing_unit).toBeUndefined(); // a confirmed conversion takes the new branch as is
    const manual = buildQuoteItemFromEntry({ ...base, pricingMethod: 'units', quantity: '36', editingItem: { id: 'm', pricing_unit: 'm2', quantity_source: 'manual', measurements: [] }, isEditMode: true });
    expect([manual.pricing_unit, manual.quantity_source, manual.calculated_quantity]).toEqual(['m2', 'manual', 36]);
  });
  it('details for the customer: empty rows dropped', () => {
    const s = buildQuoteItemFromEntry({ ...base, pricingMethod: 'fixed', specRows: [{ label: 'צבע', value: 'לבן' }, { label: ' ', value: '' }] });
    expect(s.specification).toEqual([{ label: 'צבע', value: 'לבן' }]);
  });
  it('the helpers', () => {
    expect([measuredUnitFor('area', 'cm'), measuredUnitFor('linear', 'ft'), sizeToBase('cm', '250'), sizeToBase('in', '6')]).toEqual(['m2', 'linear_ft', 2.5, 0.5]);
    expect(isManualMeasured({ pricing_unit: 'm2', quantity_source: 'manual', measurements: [] })).toBe(true);
  });
  it('the item window uses this one builder (no second copy of the shape logic)', () => {
    const wiz = readFileSync(new URL('./components/AddItemWizard.jsx', import.meta.url), 'utf8');
    expect(wiz).toMatch(/const newItem = buildQuoteItemFromEntry\(\{/);
    expect(wiz).not.toMatch(/quantity_source: finalQuantitySource/);
  });
});

// Owner console 2026-11-08 (decision 3 + "the saved quote never changes"): every stored shape survives item -> entry -> item unchanged
import { entryFromItem, rowEntryFromItem } from './utils/quoteItemEntry';
describe('round trip: a saved item opened and confirmed without a change is the same item', () => {
  const roundTrip = (item) => buildQuoteItemFromEntry({ ...entryFromItem(item, null), editingItem: item, isEditMode: true });
  const shapes = {
    'simple quantity': { id: 'a', description: 'אסלה', quantity: '2', unit_price: '900', isFromCatalog: false, section_key: null },
    'fixed (quantity 1, no unit)': { id: 'b', description: 'הובלה', quantity: '1', unit_price: '250', isFromCatalog: false, section_key: 'u1' },
    'hours (manual unit)': { id: 'c', description: 'עבודה', quantity: '1', unit_price: '150', isFromCatalog: false, section_key: null, pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 6 },
    'area from sizes': { id: 'd', description: 'ריצוף', quantity: '1', unit_price: '120', isFromCatalog: false, section_key: null, pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area',
      measurements: [{ width: 4, height: 3, unit: 'm', calculated_area: 12, label: 'סלון', is_pricing_driving: true }, { width: 2, height: 1, unit: 'm', calculated_area: 2, label: 'מסדרון', is_pricing_driving: false }], calculated_quantity: 12 },
    'feet area': { id: 'e', description: 'Tiling', quantity: '1', unit_price: '9', isFromCatalog: false, section_key: null, pricing_unit: 'sq_ft', quantity_source: 'calculated', calculation_method: 'area',
      measurements: [{ width: 12, height: 10, unit: 'ft', calculated_area: 120, label: '', is_pricing_driving: true }], calculated_quantity: 120 },
    'known area (manual measured)': { id: 'f', description: 'צבע', quantity: '1', unit_price: '35', isFromCatalog: false, section_key: null, pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', measurements: [], calculated_quantity: 36 },
  };
  for (const [name, item] of Object.entries(shapes)) {
    it(name, () => {
      const back = roundTrip(item);
      for (const k of Object.keys(item)) {
        if (k === 'measurements') expect(back.measurements.map((m) => [m.width, m.height, m.unit, m.label, m.is_pricing_driving])).toEqual(item.measurements.map((m) => [m.width, m.height, m.unit, m.label, m.is_pricing_driving]));
        // today's item window (unchanged): an hours / kg / day item re-emits its EFFECTIVE quantity in the flat column too - the charged
        // quantity (calculated_quantity) and the totals are the same
        else if (k === 'quantity' && item.pricing_unit === 'hour') expect(String(back.quantity)).toBe(String(item.calculated_quantity));
        else if (k === 'unit_price' || k === 'quantity') expect(String(back[k])).toBe(String(item[k]));
        else expect(back[k]).toEqual(item[k]);
      }
    });
  }
  it('decision 3: a line of quantity 1 with no unit opens as a fixed amount in the row editor and is stored exactly as before', () => {
    const legacy = shapes['fixed (quantity 1, no unit)'];
    const row = rowEntryFromItem(legacy, null);
    expect(row.pricingMethod).toBe('fixed');
    const back = buildQuoteItemFromEntry({ ...row, editingItem: legacy, isEditMode: true });
    expect(back).toEqual({ id: 'b', description: 'הובלה', quantity: '1', unit_price: '250', isFromCatalog: false, section_key: 'u1' });
    expect(rowEntryFromItem(shapes['simple quantity'], null).pricingMethod).toBe('units'); // quantity 2 stays units
    expect(rowEntryFromItem(shapes['hours (manual unit)'], null).pricingMethod).toBe('units'); // a real unit stays units
  });
});
