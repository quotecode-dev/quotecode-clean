import { describe, it, expect } from 'vitest';
import {
  PROFESSIONAL_UNITS,
  getProfessionalUnitLabel,
  isProfessionalItem,
  computeMeasurementArea,
  sumMeasurementAreas,
  getActiveQuantity,
  withActiveQuantities,
  PROFESSIONAL_DOMAINS,
  getProfessionalDomainLabel,
  getDefaultProfessionalUnit,
  cmToM,
  mToCm,
  getMeasurementCountLabel,
  CALCULATION_METHODS,
  getCalculationMethodLabel,
  UNIT_CALCULATION_METHOD,
  MEASURABLE_UNIT_IDS,
  isMeasurableUnit,
  resolveCalculationMethod,
  computeMeasurementValue,
  normalizeSpecificationRows,
  groupItemsBySection,
} from './professionalQuoteItem';

describe('cmToM / mToCm (Dimension Input — cm entry, Owner-required)', () => {
  it('converts the exact A46 reference geometry cm values to the correct meter values used in calculation', () => {
    expect(cmToM(161)).toBe(1.61);
    expect(cmToM(265)).toBe(2.65);
    expect(cmToM(89)).toBe(0.89);
    expect(cmToM(226)).toBe(2.26);
    expect(cmToM(100)).toBe(1);
    expect(cmToM(123.5)).toBe(1.235);
    expect(cmToM(214)).toBe(2.14);
    expect(cmToM(99)).toBe(0.99);
    expect(cmToM(211.5)).toBe(2.115);
  });

  it('round-trips exactly for half-centimeter values (123.5/211.5) — no float drift', () => {
    expect(mToCm(cmToM(123.5))).toBe(123.5);
    expect(mToCm(cmToM(211.5))).toBe(211.5);
  });

  it('preserves empty/blank input — never coerces an unfilled field to 0', () => {
    expect(cmToM('')).toBe('');
    expect(mToCm('')).toBe('');
    expect(cmToM(null)).toBe('');
    expect(mToCm(undefined)).toBe('');
  });

  it('computeMeasurementArea on the converted meter values reproduces the A46-geometry reference total, displaying as 22.04 m²', () => {
    // חוק ברזל: הסכום המדויק המחושב כאן הוא 22.044575 (1.235×2.115=2.612025,
    // לא 2.611025 - אימות-כפל ידני חוזר, לא הערך שהופיע בתיאור-המשימה) - שני
    // הערכים מעוגלים לאותה תצוגה (22.04 מ"ר) בכל מקרה, וזו התוצאה שאומתה
    // חי גם דרך ה-UI (ר' §165.x). הבדיקה כאן מוודאת חשבון-אמת, לא משכפלת
    // טעות-חישוב-ידני.
    const pairsCm = [
      [161, 265], [161, 265], [89, 226], [89, 226],
      [100, 214], [123.5, 214], [99, 211.5], [123.5, 211.5],
    ];
    const total = pairsCm.reduce((sum, [w, h]) => sum + computeMeasurementArea(cmToM(w), cmToM(h)), 0);
    expect(Math.round(total * 1e6) / 1e6).toBe(22.044575);
    expect(Math.round(total * 100) / 100).toBe(22.04);
  });
});

describe('getMeasurementCountLabel (§4/§10 - Public Quote compact "X openings • Y m²" summary)', () => {
  it('matches the exact A46 reference count (8 measurement rows)', () => {
    expect(getMeasurementCountLabel(8, true)).toBe('8 פתחים');
    expect(getMeasurementCountLabel(8, false)).toBe('8 openings');
  });

  it('uses the correct singular form for exactly one measurement row', () => {
    expect(getMeasurementCountLabel(1, true)).toBe('1 פתח');
    expect(getMeasurementCountLabel(1, false)).toBe('1 opening');
  });

  it('handles zero/missing defensively, never NaN', () => {
    expect(getMeasurementCountLabel(0, true)).toBe('0 פתחים');
    expect(getMeasurementCountLabel(undefined, false)).toBe('0 openings');
    expect(getMeasurementCountLabel(null, false)).toBe('0 openings');
  });
});

describe('Calculation method framework (§168 - real, extensible pricing-method mechanism)', () => {
  it('defines exactly the four approved methods with HE/EN labels', () => {
    expect(CALCULATION_METHODS.map(m => m.id)).toEqual(['manual', 'quantity', 'area', 'linear']);
    for (const m of CALCULATION_METHODS) {
      expect(m.he).toBeTruthy();
      expect(m.en).toBeTruthy();
    }
  });

  it('getCalculationMethodLabel returns the correct label per language', () => {
    expect(getCalculationMethodLabel('area', true)).toBe('שטח (רוחב × גובה)');
    expect(getCalculationMethodLabel('area', false)).toBe('Area (width × height)');
    expect(getCalculationMethodLabel('linear', false)).toBe('Linear length');
  });

  it('m2 and linear_meter are the only measurable units, mapped to area/linear respectively', () => {
    expect(UNIT_CALCULATION_METHOD).toEqual({ m2: 'area', linear_meter: 'linear' });
    expect(MEASURABLE_UNIT_IDS.sort()).toEqual(['linear_meter', 'm2']);
    expect(isMeasurableUnit('m2')).toBe(true);
    expect(isMeasurableUnit('linear_meter')).toBe(true);
    expect(isMeasurableUnit('kg')).toBe(false);
    expect(isMeasurableUnit('unit')).toBe(false);
  });

  it('resolveCalculationMethod: manual override always wins regardless of unit', () => {
    expect(resolveCalculationMethod('m2', 'manual')).toBe('manual');
    expect(resolveCalculationMethod('kg', 'manual')).toBe('manual');
  });

  it('resolveCalculationMethod: measurable units resolve to their real formula when not manual', () => {
    expect(resolveCalculationMethod('m2', 'calculated')).toBe('area');
    expect(resolveCalculationMethod('linear_meter', 'calculated')).toBe('linear');
  });

  it('resolveCalculationMethod: non-measurable units fall back to quantity (manual-entry, unchanged existing behavior)', () => {
    expect(resolveCalculationMethod('kg', null)).toBe('quantity');
    expect(resolveCalculationMethod('hour', undefined)).toBe('quantity');
    expect(resolveCalculationMethod('unit', 'calculated')).toBe('quantity');
  });

  it('resolveCalculationMethod: a Simple item (no pricing_unit) resolves to null', () => {
    expect(resolveCalculationMethod(null, null)).toBeNull();
    expect(resolveCalculationMethod('', 'manual')).toBeNull();
  });

  it('computeMeasurementValue: linear method uses width alone, ignores height', () => {
    expect(computeMeasurementValue('linear', 3.5, 999)).toBe(3.5);
    expect(computeMeasurementValue('linear', 0, 5)).toBeNull();
    expect(computeMeasurementValue('linear', '', 5)).toBeNull();
  });

  it('computeMeasurementValue: area method (default) matches the exact pre-existing width×height behavior', () => {
    expect(computeMeasurementValue('area', 2.65, 1.61)).toBeCloseTo(4.2665, 6);
    expect(computeMeasurementValue(undefined, 2.65, 1.61)).toBeCloseTo(4.2665, 6);
  });
});

describe('sumMeasurementAreas — specification-vs-pricing-driving + linear method (§168, 30.E)', () => {
  it('a row explicitly flagged is_pricing_driving:false is excluded from the sum', () => {
    const rows = [
      { width: 2, height: 3, is_pricing_driving: true },
      { width: 10, height: 10, is_pricing_driving: false },
    ];
    expect(sumMeasurementAreas(rows)).toBe(6);
  });

  it('a row with no is_pricing_driving flag defaults to included (backward compatible with every pre-existing row)', () => {
    const rows = [{ width: 2, height: 3 }];
    expect(sumMeasurementAreas(rows)).toBe(6);
  });

  it('sums using the linear method when passed explicitly', () => {
    const rows = [{ width: 3, height: 0 }, { width: 2, height: 0 }];
    expect(sumMeasurementAreas(rows, 'linear')).toBe(5);
  });

  it('all rows excluded (all specification-only) returns null, not 0', () => {
    const rows = [{ width: 2, height: 3, is_pricing_driving: false }];
    expect(sumMeasurementAreas(rows)).toBeNull();
  });
});

describe('normalizeSpecificationRows (§168 - specification-only data, 30.E "Pricing Unit ≠ Specification Data")', () => {
  it('keeps well-formed label/value rows', () => {
    expect(normalizeSpecificationRows([{ label: 'Color', value: 'White' }])).toEqual([{ label: 'Color', value: 'White' }]);
  });

  it('filters out fully-empty rows (both label and value blank)', () => {
    expect(normalizeSpecificationRows([{ label: '', value: '' }, { label: 'Glass', value: 'Laminated' }])).toEqual([{ label: 'Glass', value: 'Laminated' }]);
  });

  it('handles missing/non-array input defensively', () => {
    expect(normalizeSpecificationRows(null)).toEqual([]);
    expect(normalizeSpecificationRows(undefined)).toEqual([]);
    expect(normalizeSpecificationRows('not an array')).toEqual([]);
  });
});

describe('groupItemsBySection (§168 - Project/Section hierarchy, 30.C)', () => {
  it('groups items under their matching section, in section sort_order', () => {
    const sections = [{ key: 's2', sort_order: 1, name: 'Apartment 34' }, { key: 's1', sort_order: 0, name: 'Apartment 33' }];
    const items = [
      { description: 'A', section_key: 's1' },
      { description: 'B', section_key: 's2' },
      { description: 'C', section_key: 's1' },
    ];
    const { groups, unsectioned } = groupItemsBySection(items, sections);
    expect(groups.map(g => g.section.name)).toEqual(['Apartment 33', 'Apartment 34']);
    expect(groups[0].items.map(i => i.description)).toEqual(['A', 'C']);
    expect(groups[1].items.map(i => i.description)).toEqual(['B']);
    expect(unsectioned).toEqual([]);
  });

  it('an item with no section_key (or one matching no real section) falls into unsectioned - the exact pre-existing flat behavior', () => {
    const sections = [{ key: 's1', sort_order: 0, name: 'Apartment 33' }];
    const items = [{ description: 'Flat item' }, { description: 'Orphaned', section_key: 'does-not-exist' }];
    const { groups, unsectioned } = groupItemsBySection(items, sections);
    expect(groups[0].items).toEqual([]);
    expect(unsectioned.map(i => i.description)).toEqual(['Flat item', 'Orphaned']);
  });

  it('a quote with zero sections puts every item in unsectioned - byte-identical to a flat quote', () => {
    const items = [{ description: 'A' }, { description: 'B' }];
    const { groups, unsectioned } = groupItemsBySection(items, []);
    expect(groups).toEqual([]);
    expect(unsectioned).toEqual(items);
  });

  it('handles missing/undefined input defensively', () => {
    expect(groupItemsBySection(undefined, undefined)).toEqual({ groups: [], unsectioned: [] });
  });
});

describe('PROFESSIONAL_DOMAINS (Business Professional Profile, Owner Night Run task)', () => {
  it('includes a general/other option with no default unit suggestion', () => {
    const general = PROFESSIONAL_DOMAINS.find(d => d.id === 'general');
    expect(general).toBeTruthy();
    expect(general.defaultUnit).toBeNull();
  });

  it('every domain carries HE/EN labels and a defaultUnit that is either null or a real professional unit id', () => {
    const validUnitIds = PROFESSIONAL_UNITS.map(u => u.id);
    for (const d of PROFESSIONAL_DOMAINS) {
      expect(d.he).toBeTruthy();
      expect(d.en).toBeTruthy();
      expect(d.defaultUnit === null || validUnitIds.includes(d.defaultUnit)).toBe(true);
    }
  });
});

describe('getProfessionalDomainLabel', () => {
  it('returns the correct HE/EN label for a known domain', () => {
    expect(getProfessionalDomainLabel('aluminum_metal', true)).toBe('אלומיניום ומתכת');
    expect(getProfessionalDomainLabel('aluminum_metal', false)).toBe('Aluminum & Metalwork');
  });

  it('returns an empty string for an unknown/empty domain — never invents a label', () => {
    expect(getProfessionalDomainLabel('', true)).toBe('');
    expect(getProfessionalDomainLabel('not_a_real_domain', false)).toBe('');
  });
});

describe('getDefaultProfessionalUnit (business default — a suggestion, never a lock)', () => {
  it('returns the correct default unit for a known domain', () => {
    expect(getDefaultProfessionalUnit('aluminum_metal')).toBe('m2');
    expect(getDefaultProfessionalUnit('consulting_services')).toBe('hour');
  });

  it('returns null for general/unknown/empty domain — safe fallback, not a guess', () => {
    expect(getDefaultProfessionalUnit('general')).toBeNull();
    expect(getDefaultProfessionalUnit('')).toBeNull();
    expect(getDefaultProfessionalUnit('not_a_real_domain')).toBeNull();
    expect(getDefaultProfessionalUnit(undefined)).toBeNull();
  });
});

describe('PROFESSIONAL_UNITS (Owner-approved §155.1.4/§156)', () => {
  it('defines exactly the six approved units, no more, no less', () => {
    expect(PROFESSIONAL_UNITS.map(u => u.id)).toEqual(['unit', 'm2', 'linear_meter', 'kg', 'hour', 'day']);
  });

  it('every unit carries both HE and EN labels', () => {
    for (const u of PROFESSIONAL_UNITS) {
      expect(u.he).toBeTruthy();
      expect(u.en).toBeTruthy();
    }
  });

  it('does not define m³ or liter — deferred, not rejected, per §4 of the authorization', () => {
    expect(PROFESSIONAL_UNITS.find(u => u.id === 'm3')).toBeUndefined();
    expect(PROFESSIONAL_UNITS.find(u => u.id === 'liter')).toBeUndefined();
  });
});

describe('getProfessionalUnitLabel', () => {
  it('returns the correct label per language for a known unit', () => {
    expect(getProfessionalUnitLabel('m2', true)).toBe('מ"ר');
    expect(getProfessionalUnitLabel('m2', false)).toBe('m²');
    expect(getProfessionalUnitLabel('hour', true)).toBe('שעה');
    expect(getProfessionalUnitLabel('hour', false)).toBe('hour');
  });

  it('falls back to the raw id for an unknown unit, defensively not by guessing', () => {
    expect(getProfessionalUnitLabel('m3', false)).toBe('m3');
  });

  it('falls back to empty string for a missing unit', () => {
    expect(getProfessionalUnitLabel(null, false)).toBe('');
    expect(getProfessionalUnitLabel(undefined, true)).toBe('');
  });
});

describe('isProfessionalItem', () => {
  it('is true only when pricing_unit is set', () => {
    expect(isProfessionalItem({ pricing_unit: 'm2' })).toBe(true);
    expect(isProfessionalItem({ pricing_unit: 'unit' })).toBe(true);
  });

  it('is false for a Simple item (no pricing_unit)', () => {
    expect(isProfessionalItem({ description: 'x', quantity: 1, unit_price: 10 })).toBe(false);
    expect(isProfessionalItem({ pricing_unit: null })).toBe(false);
    expect(isProfessionalItem({ pricing_unit: '' })).toBe(false);
  });

  it('handles a missing/undefined item defensively', () => {
    expect(isProfessionalItem(null)).toBe(false);
    expect(isProfessionalItem(undefined)).toBe(false);
  });
});

describe('computeMeasurementArea (width × height, §7)', () => {
  it('computes the exact real David-quote-derived example (2.65m × 1.61m)', () => {
    expect(computeMeasurementArea(2.65, 1.61)).toBeCloseTo(4.2665, 6);
  });

  it('computes a second real example (0.90m × 0.495m)', () => {
    expect(computeMeasurementArea(0.90, 0.495)).toBeCloseTo(0.4455, 6);
  });

  it('returns null for zero, negative, or missing dimensions — never a fake area', () => {
    expect(computeMeasurementArea(0, 5)).toBeNull();
    expect(computeMeasurementArea(-1, 5)).toBeNull();
    expect(computeMeasurementArea(null, 5)).toBeNull();
    expect(computeMeasurementArea('', 5)).toBeNull();
    expect(computeMeasurementArea(5, undefined)).toBeNull();
  });

  it('handles numeric strings the same as real inputs, matching how form values arrive', () => {
    expect(computeMeasurementArea('2.65', '1.61')).toBeCloseTo(4.2665, 6);
  });
});

describe('sumMeasurementAreas (item calculated_quantity = sum of applicable rows, §7)', () => {
  it('sums multiple real measurement rows', () => {
    const rows = [
      { width: 2.65, height: 1.61 },
      { width: 0.90, height: 0.495 },
    ];
    expect(sumMeasurementAreas(rows)).toBeCloseTo(4.2665 + 0.4455, 6);
  });

  it('uses a persisted calculated_area directly when present, not recomputing from width/height (snapshot-on-save discipline)', () => {
    const rows = [{ width: 999, height: 999, calculated_area: 1.5 }];
    expect(sumMeasurementAreas(rows)).toBe(1.5);
  });

  it('ignores incomplete/empty rows while typing, does not throw', () => {
    const rows = [{ width: 2, height: 3 }, { width: '', height: '' }, { width: 1 }];
    expect(sumMeasurementAreas(rows)).toBe(6);
  });

  it('returns null (not 0) when no row has a valid area yet', () => {
    expect(sumMeasurementAreas([])).toBeNull();
    expect(sumMeasurementAreas([{ width: '', height: '' }])).toBeNull();
    expect(sumMeasurementAreas(undefined)).toBeNull();
  });
});

describe('getActiveQuantity (§155.8 item 3 — the core Stage A/C reconciliation)', () => {
  it('a Simple item (no calculated_quantity) uses the existing integer quantity, untouched', () => {
    expect(getActiveQuantity({ quantity: 3, unit_price: 100 })).toBe(3);
  });

  it('a Professional item with calculated_quantity uses the decimal value instead', () => {
    expect(getActiveQuantity({ quantity: 1, calculated_quantity: 2.135 })).toBeCloseTo(2.135, 6);
  });

  it('calculated_quantity of 0 is a real, valid quantity — not treated as "absent"', () => {
    expect(getActiveQuantity({ quantity: 1, calculated_quantity: 0 })).toBe(0);
  });

  it('an empty-string calculated_quantity (mid-edit UI state) falls back to the plain quantity', () => {
    expect(getActiveQuantity({ quantity: 5, calculated_quantity: '' })).toBe(5);
  });

  it('handles a missing item defensively', () => {
    expect(getActiveQuantity(null)).toBe(0);
    expect(getActiveQuantity(undefined)).toBe(0);
  });
});

describe('withActiveQuantities (normalizes an items array before calculateQuoteFinancials, without touching that canonical function)', () => {
  it('replaces quantity with the active quantity for every item, leaving other fields untouched', () => {
    const items = [
      { description: 'Simple', quantity: 3, unit_price: 10 },
      { description: 'Pro', quantity: 1, unit_price: 500, calculated_quantity: 2.135, pricing_unit: 'm2' },
    ];
    const result = withActiveQuantities(items);
    expect(result[0].quantity).toBe(3);
    expect(result[0].description).toBe('Simple');
    expect(result[1].quantity).toBeCloseTo(2.135, 6);
    expect(result[1].pricing_unit).toBe('m2');
  });

  it('does not mutate the original items array or its objects', () => {
    const items = [{ description: 'x', quantity: 1, unit_price: 10, calculated_quantity: 5 }];
    const result = withActiveQuantities(items);
    expect(result).not.toBe(items);
    expect(result[0]).not.toBe(items[0]);
    expect(items[0].quantity).toBe(1);
  });

  it('handles an empty/missing array defensively', () => {
    expect(withActiveQuantities([])).toEqual([]);
    expect(withActiveQuantities(undefined)).toEqual([]);
  });
});
