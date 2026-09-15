import { describe, it, expect } from 'vitest';
import { buildPresentationGroups, wrapAsSingletonGroups } from './presentationGrouping';

// Final Smart Quote Merge + Rounding Remediation task - real TEST evidence
// (component/unit level; live TEST-server evidence lives in the e2e specs
// per this project's own "No False Pass Rule") for the safe-grouping
// compatibility contract required by Part 3/Part 11 of the task prompt.
function windowItem(overrides = {}) {
  return {
    id: 'item-a',
    description: 'חלון אלומיניום',
    pricing_unit: 'm2',
    calculation_method: 'area',
    quantity_source: 'calculated',
    price: 200,
    quantity: 1,
    calculated_quantity: 12.55,
    total_price: 2510.82,
    specification: [],
    measurements: [{ width: 3.5, height: 3.586, unit: 'm', calculated_area: 12.55 }],
    ...overrides,
  };
}

describe('buildPresentationGroups - safe presentation-only grouping', () => {
  it('two compatible same-commercial items merge into one presentation group', () => {
    const a = windowItem({ id: 'a' });
    const b = windowItem({ id: 'b', calculated_quantity: 25.74, total_price: 5148.00, measurements: [{ width: 4.2, height: 6.129, unit: 'm', calculated_area: 25.74 }] });
    const groups = buildPresentationGroups([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].merged).toBe(true);
    expect(groups[0].members).toHaveLength(2);
  });

  it('canonical item count is preserved - every input item belongs to exactly one group', () => {
    const items = [windowItem({ id: 'a' }), windowItem({ id: 'b' }), { id: 'c', description: 'מקלחון', pricing_unit: 'm2', calculation_method: 'area', quantity_source: 'calculated', price: 500, total_price: 900, specification: [], measurements: [] }];
    const groups = buildPresentationGroups(items);
    const totalMembers = groups.reduce((sum, g) => sum + g.members.length, 0);
    expect(totalMembers).toBe(items.length);
  });

  it('merged group total is the exact sum of canonical stored totals (7658.82), never recomputed from combined area x rate', () => {
    const a = windowItem({ id: 'a', total_price: 2510.82 });
    const b = windowItem({ id: 'b', calculated_quantity: 25.74, total_price: 5148.00 });
    const groups = buildPresentationGroups([a, b]);
    expect(groups[0].groupTotal).toBeCloseTo(7658.82, 10);
    // Not the naive combinedArea*rate reconstruction (38.29 * 200 = 7658.00 - a different number).
    expect(groups[0].groupTotal).not.toBeCloseTo(38.29 * 200, 2);
  });

  it('combined quantity aggregates full-precision canonical values (12.55 + 25.74 = 38.29)', () => {
    const a = windowItem({ id: 'a', calculated_quantity: 12.55 });
    const b = windowItem({ id: 'b', calculated_quantity: 25.74, total_price: 5148.00 });
    const groups = buildPresentationGroups([a, b]);
    expect(groups[0].combinedQuantity).toBeCloseTo(38.29, 10);
  });

  it('preserves every measurement from every member, in member order, including duplicate-looking rows', () => {
    const dup = { width: 1, height: 1, unit: 'm', calculated_area: 1 };
    const a = windowItem({ id: 'a', measurements: [dup] });
    const b = windowItem({ id: 'b', total_price: 5148.00, measurements: [dup] });
    const groups = buildPresentationGroups([a, b]);
    const allMembers = groups[0].members;
    const allMeasurements = allMembers.flatMap((m) => m.measurements);
    expect(allMeasurements).toHaveLength(2);
    expect(allMeasurements[0]).toEqual(dup);
    expect(allMeasurements[1]).toEqual(dup);
  });

  it('first-occurrence ordering: Window A -> Shower -> Window B becomes Combined Windows -> Shower', () => {
    const windowA = windowItem({ id: 'a' });
    const shower = { id: 'shower', description: 'מקלחון', pricing_unit: 'm2', calculation_method: 'area', quantity_source: 'calculated', price: 500, total_price: 900, specification: [], measurements: [] };
    const windowB = windowItem({ id: 'b', total_price: 5148.00 });
    const groups = buildPresentationGroups([windowA, shower, windowB]);
    expect(groups).toHaveLength(2);
    expect(groups[0].merged).toBe(true);
    expect(groups[0].members.map((m) => m.id)).toEqual(['a', 'b']);
    expect(groups[1].merged).toBe(false);
    expect(groups[1].members[0].id).toBe('shower');
  });

  describe('negative grouping cases (Part 11) - must remain separate', () => {
    it('same name, different rate stays separate', () => {
      const a = windowItem({ id: 'a', price: 200 });
      const b = windowItem({ id: 'b', price: 250, total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
      expect(groups.every((g) => !g.merged)).toBe(true);
    });

    it('same name, different pricing method stays separate', () => {
      const a = windowItem({ id: 'a', calculation_method: 'area' });
      const b = windowItem({ id: 'b', calculation_method: 'linear', total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
    });

    it('same name, different pricing unit stays separate', () => {
      const a = windowItem({ id: 'a', pricing_unit: 'm2' });
      const b = windowItem({ id: 'b', pricing_unit: 'linear_meter', total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
    });

    it('same name, different specification stays separate', () => {
      const a = windowItem({ id: 'a', specification: [{ label: 'Color', value: 'White' }] });
      const b = windowItem({ id: 'b', specification: [{ label: 'Color', value: 'Black' }], total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
    });

    it('one item with a meaningful spec and one without stay separate', () => {
      const a = windowItem({ id: 'a', specification: [{ label: 'Color', value: 'White' }] });
      const b = windowItem({ id: 'b', specification: [], total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
    });

    it('same name, calculated vs manual quantity_source stays separate', () => {
      const a = windowItem({ id: 'a', quantity_source: 'calculated' });
      const b = windowItem({ id: 'b', quantity_source: 'manual', total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
    });

    it('ambiguous legacy item with no pricing_unit never groups (fixed/simple items are never grouping-eligible)', () => {
      const a = { id: 'a', description: 'חלון אלומיניום', price: 200, quantity: 1, total_price: 200 };
      const b = { id: 'b', description: 'חלון אלומיניום', price: 200, quantity: 1, total_price: 200 };
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
      expect(groups.every((g) => !g.merged)).toBe(true);
    });

    it('missing/invalid stored total blocks grouping - item preserved separately', () => {
      const a = windowItem({ id: 'a' });
      const b = windowItem({ id: 'b', total_price: undefined });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
    });

    // SQ-F04 (Codex Smart Quote P0/P1 review) - required unsafe-case matrix:
    // a missing required field must never "coincidentally match" another
    // item that is ALSO missing the same field via an empty-string
    // fallback. Both items below are otherwise fully identical.
    it('both items missing calculation_method never coincidentally match each other', () => {
      const a = windowItem({ id: 'a', calculation_method: undefined });
      const b = windowItem({ id: 'b', calculation_method: undefined, total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
      expect(groups.every((g) => !g.merged)).toBe(true);
    });

    it('both items missing quantity_source never coincidentally match each other', () => {
      const a = windowItem({ id: 'a', quantity_source: undefined });
      const b = windowItem({ id: 'b', quantity_source: undefined, total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
      expect(groups.every((g) => !g.merged)).toBe(true);
    });

    it('both items missing rate (price/unit_price) never coincidentally match each other', () => {
      const a = windowItem({ id: 'a', price: undefined, unit_price: undefined });
      const b = windowItem({ id: 'b', price: undefined, unit_price: undefined, total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
      expect(groups.every((g) => !g.merged)).toBe(true);
    });

    it('conflicting measurement units on the same item block that item from grouping', () => {
      const a = windowItem({ id: 'a', measurements: [{ width: 3.5, height: 3.586, unit: 'm', calculated_area: 12.55 }, { width: 10, height: 10, unit: 'cm', calculated_area: 0.01 }] });
      const b = windowItem({ id: 'b', total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
      expect(groups.every((g) => !g.merged)).toBe(true);
    });

    it('an item with an invalid (non-finite) calculated_quantity never fabricates a combined quantity, even though it may still group', () => {
      const a = windowItem({ id: 'a' });
      const b = windowItem({ id: 'b', calculated_quantity: NaN, total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(1);
      expect(groups[0].merged).toBe(true);
      expect(groups[0].combinedQuantity).toBeNull();
      // The exact-sum total law is unaffected by the unsafe quantity - it never depended on combinedQuantity.
      expect(groups[0].groupTotal).toBeCloseTo(7658.82, 10);
    });

    it('near-but-distinct rates that would collapse under fixed 6-decimal rounding (both round to 100.123456) stay separate', () => {
      const a = windowItem({ id: 'a', price: 100.1234561 });
      const b = windowItem({ id: 'b', price: 100.1234562, total_price: 5148.00 });
      expect(a.price.toFixed(6)).toBe(b.price.toFixed(6)); // proves this is a genuine fixed-precision collision case
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
      expect(groups.every((g) => !g.merged)).toBe(true);
    });

    // SQ-F04 closure (Codex fresh re-review, "ONE-PASS SMART QUOTE FINAL
    // REMEDIATION" task): a MISSING calculated_quantity (not merely an
    // invalid/NaN one, already covered above) for a quantity_source==='calculated'
    // member must not silently fall back to the flat quantity to fabricate
    // a combined quantity - it must be omitted (null), exactly like the
    // already-covered explicit-NaN case.
    it('an item with a MISSING (undefined) calculated_quantity never fabricates a combined quantity from the flat quantity fallback, even though it may still group', () => {
      const a = windowItem({ id: 'a' });
      const b = windowItem({ id: 'b', calculated_quantity: undefined, quantity: 999, total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(1);
      expect(groups[0].merged).toBe(true);
      expect(groups[0].combinedQuantity).toBeNull();
      expect(groups[0].groupTotal).toBeCloseTo(7658.82, 10);
    });

    it('an item with an empty-string calculated_quantity never fabricates a combined quantity', () => {
      const a = windowItem({ id: 'a' });
      const b = windowItem({ id: 'b', calculated_quantity: '', total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups[0].merged).toBe(true);
      expect(groups[0].combinedQuantity).toBeNull();
    });

    // SQ-F04 closure: a present-but-unrecognized calculation_method/
    // quantity_source value must not group, even when both items happen to
    // share the identical unrecognized string - "unrecognized legacy...
    // values must not group" is a positive requirement, not merely
    // "missing values must not group."
    it('two items sharing an identical UNRECOGNIZED legacy calculation_method value never group', () => {
      const a = windowItem({ id: 'a', calculation_method: 'legacy_v1_formula' });
      const b = windowItem({ id: 'b', calculation_method: 'legacy_v1_formula', total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
      expect(groups.every((g) => !g.merged)).toBe(true);
    });

    it('two items sharing an identical UNRECOGNIZED legacy quantity_source value never group', () => {
      const a = windowItem({ id: 'a', quantity_source: 'legacy_estimate' });
      const b = windowItem({ id: 'b', quantity_source: 'legacy_estimate', total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(2);
      expect(groups.every((g) => !g.merged)).toBe(true);
    });

    it('a recognized calculation_method/quantity_source pair still groups normally (positive control, not over-blocked by the new check)', () => {
      const a = windowItem({ id: 'a', calculation_method: 'manual', quantity_source: 'manual' });
      const b = windowItem({ id: 'b', calculation_method: 'manual', quantity_source: 'manual', total_price: 5148.00 });
      const groups = buildPresentationGroups([a, b]);
      expect(groups).toHaveLength(1);
      expect(groups[0].merged).toBe(true);
    });
  });
});

describe('wrapAsSingletonGroups - Unassigned bucket never groups in this pass', () => {
  it('wraps every item as its own singleton group, even when commercially identical', () => {
    const a = windowItem({ id: 'a' });
    const b = windowItem({ id: 'b', total_price: 5148.00 });
    const groups = wrapAsSingletonGroups([a, b]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => !g.merged)).toBe(true);
  });
});
