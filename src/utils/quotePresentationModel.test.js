import { describe, it, expect } from 'vitest';
import { isQuoteDivided, buildEditorPresentationModel, buildCustomerPresentationModel } from './quotePresentationModel';

describe('isQuoteDivided', () => {
  it('false for no sections, false for sections with only empty/whitespace names, true once one real name exists', () => {
    expect(isQuoteDivided([])).toBe(false);
    expect(isQuoteDivided(undefined)).toBe(false);
    expect(isQuoteDivided([{ key: 's1', name: '' }])).toBe(false);
    expect(isQuoteDivided([{ key: 's1', name: '   ' }])).toBe(false);
    expect(isQuoteDivided([{ key: 's1', name: 'Apartment 33' }])).toBe(true);
  });
});

describe('buildEditorPresentationModel - live editing state, canonical calculateQuoteFinancials subtotal', () => {
  it('a regular (no real sections) quote reports isDivided:false and every item as unassigned', () => {
    const items = [{ description: 'A', quantity: '1', unit_price: '500' }, { description: 'B', quantity: '6', unit_price: '25' }];
    const model = buildEditorPresentationModel(items, []);
    expect(model.isDivided).toBe(false);
    expect(model.units).toEqual([]);
    expect(model.unassignedItems).toBe(items);
    expect(model.quoteSubtotal).toBe(650);
  });

  it('a divided quote groups items per real unit, in sort_order, with a per-unit subtotal that reconciles with the quote subtotal', () => {
    const sections = [{ key: 's2', name: 'Apartment 34', sort_order: 1 }, { key: 's1', name: 'Apartment 33', sort_order: 0 }];
    const items = [
      { description: 'Aluminum', quantity: '1', unit_price: '300', section_key: 's1' },
      { description: 'Carpentry', quantity: '1', unit_price: '200', section_key: 's2' },
    ];
    const model = buildEditorPresentationModel(items, sections);
    expect(model.isDivided).toBe(true);
    expect(model.units.map((u) => u.title)).toEqual(['Apartment 33', 'Apartment 34']);
    expect(model.units[0].itemCount).toBe(1);
    expect(model.units[0].subtotal).toBe(300);
    expect(model.units[1].subtotal).toBe(200);
    expect(model.unassignedItems).toEqual([]);
    expect(model.quoteSubtotal).toBe(500);
    expect(model.units.reduce((s, u) => s + u.subtotal, 0)).toBe(model.quoteSubtotal);
  });

  it('an item with no section_key (or pointing at a removed section) lands in unassignedItems, never dropped', () => {
    const sections = [{ key: 's1', name: 'Apartment 33', sort_order: 0 }];
    const items = [
      { description: 'In unit', quantity: '1', unit_price: '100', section_key: 's1' },
      { description: 'Legacy, no unit', quantity: '1', unit_price: '50' },
      { description: 'Orphaned', quantity: '1', unit_price: '25', section_key: 'removed-section' },
    ];
    const model = buildEditorPresentationModel(items, sections);
    expect(model.unassignedItems.map((i) => i.description).sort()).toEqual(['Legacy, no unit', 'Orphaned'].sort());
    expect(model.quoteSubtotal).toBe(175);
  });

  it('a freshly-created, still-unnamed unit does not count as "divided" and its (empty, in practice) items fall into unassigned rather than an empty-titled unit', () => {
    const sections = [{ key: 'tmp_1', name: '', sort_order: 0 }];
    const model = buildEditorPresentationModel([], sections);
    expect(model.isDivided).toBe(false);
  });

  it('a professional item\'s active (calculated) quantity drives the subtotal, exactly like the whole-quote subtotal - the same 4.40 m^2 x 100 = 440 scenario', () => {
    const sections = [{ key: 's1', name: 'Apartment 33', sort_order: 0 }];
    const items = [{ description: 'Windows', quantity: '1', unit_price: '100', calculated_quantity: 4.4, pricing_unit: 'm2', section_key: 's1' }];
    const model = buildEditorPresentationModel(items, sections);
    expect(model.units[0].subtotal).toBe(440);
    expect(model.quoteSubtotal).toBe(440);
  });
});

describe('buildCustomerPresentationModel - persisted/read-only data, sums the canonical stored total_price, never recomputes', () => {
  it('a regular (no sections) quote reports isDivided:false, sums real total_price values', () => {
    const items = [{ description: 'A', quantity: 1, price: 500, total_price: 500 }, { description: 'B', quantity: 6, price: 25, total_price: 150 }];
    const model = buildCustomerPresentationModel(items, []);
    expect(model.isDivided).toBe(false);
    expect(model.quoteSubtotal).toBe(650);
  });

  it('a divided quote (get-public-quote shape: section_id/id, no sort_order needed - already pre-sorted) groups correctly with real per-unit subtotals', () => {
    const sections = [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 34' }];
    const items = [
      { description: 'Aluminum', quantity: 1, price: 300, total_price: 300, section_id: 'sec1' },
      { description: 'Carpentry', quantity: 1, price: 200, total_price: 200, section_id: 'sec2' },
    ];
    const model = buildCustomerPresentationModel(items, sections);
    expect(model.isDivided).toBe(true);
    expect(model.units.map((u) => u.title)).toEqual(['Apartment 33', 'Apartment 34']);
    expect(model.units[0].subtotal).toBe(300);
    expect(model.units[1].subtotal).toBe(200);
    expect(model.units.reduce((s, u) => s + u.subtotal, 0)).toBe(model.quoteSubtotal);
  });

  it('never recalculates quantity*price when total_price is already present, even if they would disagree (proves it sums the stored canonical amount, not a re-derived one)', () => {
    const items = [{ description: 'A', quantity: 1, price: 100, total_price: 999 }];
    const model = buildCustomerPresentationModel(items, []);
    expect(model.quoteSubtotal).toBe(999);
  });

  it('falls back to quantity*price only for a legacy item genuinely missing total_price', () => {
    const items = [{ description: 'Legacy flat item', quantity: 3, price: 10 }];
    const model = buildCustomerPresentationModel(items, []);
    expect(model.quoteSubtotal).toBe(30);
  });

  it('an empty unit (no items) is still reported as a real unit with itemCount 0 and subtotal 0 - never omitted', () => {
    const sections = [{ id: 'sec1', name: 'Apartment 33' }, { id: 'sec2', name: 'Apartment 35' }];
    const items = [{ description: 'Aluminum', quantity: 1, price: 300, total_price: 300, section_id: 'sec1' }];
    const model = buildCustomerPresentationModel(items, sections);
    const empty = model.units.find((u) => u.title === 'Apartment 35');
    expect(empty).toBeTruthy();
    expect(empty.itemCount).toBe(0);
    expect(empty.subtotal).toBe(0);
  });

  it('the same model shape is produced by both builders (isDivided/units/unassignedItems/quoteSubtotal) - a future renderer can be agnostic to the data source', () => {
    const editorModel = buildEditorPresentationModel([{ description: 'A', quantity: '1', unit_price: '10' }], []);
    const customerModel = buildCustomerPresentationModel([{ description: 'A', quantity: 1, price: 10, total_price: 10 }], []);
    expect(Object.keys(editorModel).sort()).toEqual(Object.keys(customerModel).sort());
  });
});
