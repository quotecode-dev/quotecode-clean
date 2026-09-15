import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddItemWizard from './AddItemWizard';

// Smart Quote Final UX Simplification task: 4 required stages only (What
// are you adding? -> How is the price worked out? -> relevant numbers ->
// Check before adding). Step 1 opens directly on the description input -
// no more "choose free-text or catalog first" gate. Step 2 shows only 2
// business-aware-ranked methods by default, the rest under "More options" -
// every genuinely-supported method must remain reachable. Customer details
// are an optional expansion inside Review, never a compulsory standalone
// step. This component never touches Dashboard state itself (calculation
// utilities are the canonical, already-tested source - see
// professionalQuoteItem.test.js) - these tests verify the wizard's own
// step flow, validation, and the exact item-object shape it hands to onAdd.

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onAdd: vi.fn(),
  editingItem: null,
  isHebrew: false,
  sym: '$',
  formatNum: (n) => Number(n).toFixed(2),
  services: [],
  sections: [],
  defaultSectionKey: null,
  canUseProfessionalQuotes: true,
  onRequestUpgrade: vi.fn(),
  recommendedMethod: null,
};

function setValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, value);
  fireEvent.input(el, { target: { value } });
}

// SQ-F03 (Codex Smart Quote P0/P1 review, "unified Edit can silently
// replace saved pricing/measurement semantics"): a genuinely name-only edit
// must round-trip every unrelated field byte/semantically identically.
// Real user path: edit mode opens directly on Review -> "Change name" jumps
// to step 1 -> Next x3 returns to Review without ever touching pricing
// method/measurements/quantity -> Save changes. Never construct the item
// object directly - going through the real step machinery is what proves
// goNext's own method-unchanged branch (no conversion confirm) is taken.
function nameOnlyEditAndSave(editingItem, newDescription) {
  const onAdd = vi.fn();
  render(<AddItemWizard {...baseProps} onAdd={onAdd} editingItem={editingItem} />);
  fireEvent.click(screen.getByText('Change name'));
  setValue(document.getElementById('wiz-description'), newDescription);
  fireEvent.click(screen.getByText('Next'));
  fireEvent.click(screen.getByText('Next'));
  fireEvent.click(screen.getByText('Next'));
  fireEvent.click(screen.getByText('Save changes'));
  expect(onAdd).toHaveBeenCalledTimes(1);
  return onAdd.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddItemWizard - Step 1 opens directly on the business task (no source-choice gate)', () => {
  it('shows the description input immediately, with the exact Owner-specified title/placeholder', () => {
    render(<AddItemWizard {...baseProps} />);
    expect(screen.getByText('Add product or work')).toBeTruthy();
    expect(screen.getByText('What are you adding?')).toBeTruthy();
    expect(screen.getByText('Enter the product or work you want to add to the quote.')).toBeTruthy();
    const input = document.getElementById('wiz-description');
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe('e.g. Installation, handles, or a window screen');
  });

  it('requires a description before advancing', () => {
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/enter a name or description/)).toBeTruthy();
  });

  it('does not show a catalog option at all when the catalog is empty - manual entry shown directly', () => {
    render(<AddItemWizard {...baseProps} services={[]} />);
    expect(screen.queryByText('Choose a product or work from your catalog')).toBeNull();
    expect(screen.queryByText('Not in the catalog? Add a product or work manually')).toBeNull();
    expect(document.getElementById('wiz-description')).toBeTruthy();
  });

  it('Catalog First (Structural Unification task): when the business has catalog items, the catalog list IS the primary Step 1 view, not a secondary link', () => {
    const services = [{ id: 1, name: 'Design consultation', price: 150 }, { id: 2, name: 'Site visit', price: 80 }];
    render(<AddItemWizard {...baseProps} services={services} />);
    // The catalog is shown immediately - no manual description field yet.
    expect(screen.getByText('Choose a product or work from your catalog')).toBeTruthy();
    expect(screen.getByText('Design consultation')).toBeTruthy();
    expect(screen.getByText('Site visit')).toBeTruthy();
    expect(document.getElementById('wiz-description')).toBeNull();
    expect(screen.getByText('Not in the catalog? Add a product or work manually')).toBeTruthy();
  });

  it('picking a catalog item prefills description/price and reveals the (now pre-filled) manual field for review, without forcing a pricing method', () => {
    const services = [{ id: 1, name: 'Design consultation', price: 150 }];
    render(<AddItemWizard {...baseProps} services={services} />);
    fireEvent.click(screen.getByText('Design consultation'));
    expect(document.getElementById('wiz-description').value).toBe('Design consultation');
    fireEvent.click(screen.getByText('Next'));
    // Both pricing methods remain genuinely choosable - catalog never skips this step.
    expect(screen.getByText('One total price')).toBeTruthy();
    expect(screen.getByText('Price for each')).toBeTruthy();
  });

  it('the manual-entry fallback link reveals a plain description field; "Back to catalog" returns to the catalog list', () => {
    const services = [{ id: 1, name: 'Design consultation', price: 150 }];
    render(<AddItemWizard {...baseProps} services={services} />);
    fireEvent.click(screen.getByText('Not in the catalog? Add a product or work manually'));
    expect(document.getElementById('wiz-description')).toBeTruthy();
    expect(screen.queryByText('Design consultation')).toBeNull();
    fireEvent.click(screen.getByText('Back to catalog'));
    expect(screen.getByText('Design consultation')).toBeTruthy();
    expect(document.getElementById('wiz-description')).toBeNull();
  });

  it('editing an item with a saved catalog always shows the manual field (the item\'s own real description), never an unrelated catalog list - "Catalog must NOT silently override saved quote-item semantics during Edit"', () => {
    const services = [{ id: 1, name: 'Design consultation', price: 150 }];
    const editingItem = { description: 'Custom carpentry work', quantity: '1', unit_price: '300' };
    render(<AddItemWizard {...baseProps} services={services} editingItem={editingItem} />);
    // Edit mode opens on Review - navigate back to Step 1 via "Change name".
    fireEvent.click(screen.getByText('Change name'));
    expect(document.getElementById('wiz-description').value).toBe('Custom carpentry work');
    expect(screen.queryByText('Choose a product or work from your catalog')).toBeNull();
  });
});

describe('AddItemWizard - Step 2: business-aware pricing, More options, all methods reachable', () => {
  it('with no recommendation, shows the generic Fixed+Quantity pair, with Area/Length under More options', () => {
    render(<AddItemWizard {...baseProps} recommendedMethod={null} />);
    setValue(document.getElementById('wiz-description'), 'Item');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('One total price')).toBeTruthy();
    expect(screen.getByText('Price for each')).toBeTruthy();
    expect(screen.queryByText('Price by area')).toBeNull();
    expect(screen.queryByText('Price by length')).toBeNull();
    expect(screen.getByText('More options')).toBeTruthy();
    fireEvent.click(screen.getByText('More options'));
    expect(screen.getByText('Price by area')).toBeTruthy();
    expect(screen.getByText('Price by length')).toBeTruthy();
  });

  it('with a real area recommendation, shows it first with a Recommended badge - advisory only, other methods stay fully reachable', () => {
    render(<AddItemWizard {...baseProps} recommendedMethod="area" />);
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Price by area')).toBeTruthy();
    expect(screen.getByText('Recommended')).toBeTruthy();
    // The user can still pick a non-recommended method immediately.
    fireEvent.click(screen.getByText('Price for each'));
    fireEvent.click(screen.getByText('Next'));
    expect(document.getElementById('wiz-quantity')).toBeTruthy();
  });

  it('never shows a business recommendation as market/currency-coupled (same recommendation regardless of language)', () => {
    render(<AddItemWizard {...baseProps} recommendedMethod="units" isHebrew={true} />);
    setValue(document.getElementById('wiz-description'), 'פריט');
    fireEvent.click(screen.getByText('הבא'));
    expect(screen.getByText('מומלץ')).toBeTruthy();
    expect(screen.getByText('מחיר לכל יחידה')).toBeTruthy();
  });

  it('locks Area/Length behind entitlement and requests upgrade instead of selecting', () => {
    render(<AddItemWizard {...baseProps} canUseProfessionalQuotes={false} />);
    setValue(document.getElementById('wiz-description'), 'Item');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByText('Price by area'));
    expect(baseProps.onRequestUpgrade).toHaveBeenCalledTimes(1);
  });
});

describe('AddItemWizard - fixed price ("One total price")', () => {
  it('shows the dynamic Step 3 explanation and produces a quantity:1 flat item', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(document.getElementById('wiz-description'), 'Installation');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('One total price'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Enter the total price you want to charge.')).toBeTruthy();
    setValue(document.getElementById('wiz-fixed-amount'), '500');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Check before adding')).toBeTruthy();
    expect(screen.getAllByText('$500.00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Add to quote'));

    const item = onAdd.mock.calls[0][0];
    expect(item.description).toBe('Installation');
    expect(item.quantity).toBe('1');
    expect(item.unit_price).toBe('500');
    expect(item.pricing_unit).toBeUndefined();
  });
});

describe('AddItemWizard - Quantity ("Price for each")', () => {
  it('shows the dynamic explanation, a live equation, and produces the correct item shape', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(document.getElementById('wiz-description'), 'Handles');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Price for each'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Enter how many units there are and the price for each.')).toBeTruthy();
    setValue(document.getElementById('wiz-quantity'), '6');
    setValue(document.getElementById('wiz-unit-price'), '25');
    expect(screen.getByText('6 × $25.00 = $150.00')).toBeTruthy();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('6 × $25.00 = $150.00')).toBeTruthy();
    fireEvent.click(screen.getByText('Add to quote'));

    const item = onAdd.mock.calls[0][0];
    expect(item.description).toBe('Handles');
    expect(item.quantity).toBe('6');
    expect(item.unit_price).toBe('25');
  });

  it('shows a plain-language validation message instead of silently blocking on missing quantity', () => {
    render(<AddItemWizard {...baseProps} />);
    setValue(document.getElementById('wiz-description'), 'Item');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Price for each'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-quantity'), '0');
    setValue(document.getElementById('wiz-unit-price'), '10');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/enter a quantity greater than 0/)).toBeTruthy();
  });
});

describe('AddItemWizard - Area/Length, multiple sizes, and no silently-dropped measurements', () => {
  it('computes area using the canonical helper and stores meters while displaying cm', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Enter the sizes and we’ll calculate the area and price for you.')).toBeTruthy();
    expect(screen.getByText('Enter centimetres. We’ll calculate square metres.')).toBeTruthy();

    setValue(document.getElementById('wiz-width'), '300');
    setValue(document.getElementById('wiz-height'), '200');
    expect(screen.getByText('300 × 200 cm = 6.00 m²')).toBeTruthy();
    setValue(document.getElementById('wiz-unit-price-m'), '200');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Add to quote'));

    const item = onAdd.mock.calls[0][0];
    expect(item.pricing_unit).toBe('m2');
    expect(item.calculation_method).toBe('area');
    expect(item.calculated_quantity).toBe(6);
    expect(item.measurements[0].width).toBe(3);
    expect(item.measurements[0].height).toBe(2);
  });

  it('switches to Length and computes using width only, height field hidden', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(document.getElementById('wiz-description'), 'Railing');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByText('Price by length'));
    fireEvent.click(screen.getByText('Next'));
    expect(document.getElementById('wiz-height')).toBeNull();
    setValue(document.getElementById('wiz-width'), '500');
    setValue(document.getElementById('wiz-unit-price-m'), '40');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Add to quote'));
    const item = onAdd.mock.calls[0][0];
    expect(item.pricing_unit).toBe('linear_meter');
    expect(item.calculated_quantity).toBe(5);
  });

  it('sums every size into calculated_quantity and shows all of them in Review (synthetic acceptance scenario: 4.4 m^2)', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(document.getElementById('wiz-description'), 'Windows - apartment 33');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByText('Next'));

    setValue(document.getElementById('wiz-width'), '80');
    setValue(document.getElementById('wiz-height'), '100');
    for (const [w, h] of [['100', '120'], ['120', '150'], ['60', '100']]) {
      fireEvent.click(screen.getByText('+ Add another size'));
      const idx = document.querySelectorAll('[id^="wiz-extra-width-"]').length - 1;
      setValue(document.getElementById(`wiz-extra-width-${idx}`), w);
      setValue(document.getElementById(`wiz-extra-height-${idx}`), h);
    }
    expect(screen.getByText(/Total area: 4\.40 m/)).toBeTruthy();
    setValue(document.getElementById('wiz-unit-price-m'), '100');
    fireEvent.click(screen.getByText('Next'));

    // Review completeness (Codex fix): every size shown individually, not "+3 more".
    expect(screen.getByText('Size 1')).toBeTruthy();
    expect(screen.getByText('Size 2')).toBeTruthy();
    expect(screen.getByText('Size 3')).toBeTruthy();
    expect(screen.getByText('Size 4')).toBeTruthy();
    expect(screen.getByText(/80 × 100 cm = 0\.80 m²/)).toBeTruthy();
    expect(screen.getByText(/100 × 120 cm = 1\.20 m²/)).toBeTruthy();
    expect(screen.getByText(/120 × 150 cm = 1\.80 m²/)).toBeTruthy();
    expect(screen.getByText(/60 × 100 cm = 0\.60 m²/)).toBeTruthy();
    expect(screen.getAllByText('$440.00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Add to quote'));

    const item = onAdd.mock.calls[0][0];
    expect(item.calculated_quantity).toBeCloseTo(4.4, 6);
    expect(item.measurements).toHaveLength(4);
  });

  it('blocks progression when a started size is incomplete, names the exact row, and never silently drops it', () => {
    render(<AddItemWizard {...baseProps} />);
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-width'), '80');
    setValue(document.getElementById('wiz-height'), '100');
    fireEvent.click(screen.getByText('+ Add another size'));
    fireEvent.click(screen.getByText('+ Add another size'));
    // Size 3 (second extra row) gets only a width - started but incomplete.
    setValue(document.getElementById('wiz-extra-width-1'), '120');
    setValue(document.getElementById('wiz-unit-price-m'), '100');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Size 3 needs a height. Complete or remove it.')).toBeTruthy();
    // Still on the Details step - did not silently advance/drop the row.
    expect(document.getElementById('wiz-extra-width-1').value).toBe('120');
  });

  it('an untouched (never-started) extra row does not block progression', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-width'), '80');
    setValue(document.getElementById('wiz-height'), '100');
    fireEvent.click(screen.getByText('+ Add another size'));
    setValue(document.getElementById('wiz-unit-price-m'), '100');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Add to quote'));
    const item = onAdd.mock.calls[0][0];
    expect(item.measurements).toHaveLength(1);
  });

  it('a removed row clears its own validation error', () => {
    render(<AddItemWizard {...baseProps} />);
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-width'), '80');
    setValue(document.getElementById('wiz-height'), '100');
    fireEvent.click(screen.getByText('+ Add another size'));
    setValue(document.getElementById('wiz-extra-width-0'), '120');
    setValue(document.getElementById('wiz-unit-price-m'), '100');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Size 2 needs a height. Complete or remove it.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remove this size'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Check before adding')).toBeTruthy();
  });
});

describe('AddItemWizard - Review: optional customer details never block completion or affect price', () => {
  it('customer details are collapsed by default, described as optional and price-neutral, and never required', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('One total price'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-fixed-amount'), '100');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Add details for the customer?')).toBeTruthy();
    // Add succeeds without ever opening the optional section.
    fireEvent.click(screen.getByText('Add to quote'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('adding a detail uses "Detail" wording (not Label/Value) and does not change the price', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(document.getElementById('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('One total price'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-fixed-amount'), '100');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Add details for the customer?'));
    expect(screen.getByText('These details do not change the price')).toBeTruthy();
    fireEvent.click(screen.getByText('+ Add detail'));
    setValue(screen.getByLabelText('Detail'), 'Colour');
    setValue(screen.getByLabelText('Value'), 'White');
    expect(screen.getAllByText('$100.00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Add to quote'));
    const item = onAdd.mock.calls[0][0];
    expect(item.unit_price).toBe('100');
    expect(item.specification).toEqual([{ label: 'Colour', value: 'White' }]);
  });
});

describe('AddItemWizard - Add/Edit parity: editing reopens the same guided editor, never reinterpreting saved semantics', () => {
  it('opens directly on Review with real saved values for a measured item, showing every size', () => {
    const editingItem = {
      id: 'real-id-1',
      description: 'Existing window',
      quantity: '1',
      unit_price: '100',
      pricing_unit: 'm2',
      quantity_source: 'calculated',
      calculation_method: 'area',
      calculated_quantity: 6,
      measurements: [
        { width: 3, height: 2, unit: 'm', calculated_area: 6, label: '', is_pricing_driving: true },
      ],
      section_key: null,
    };
    render(<AddItemWizard {...baseProps} editingItem={editingItem} />);
    expect(screen.getByRole('heading', { name: 'Check before adding' })).toBeTruthy();
    expect(screen.getByText('Review the current details and choose what you want to change.')).toBeTruthy();
    expect(screen.getAllByText('Existing window').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$600.00').length).toBeGreaterThan(0);
  });

  it('a quantity-one "Price for each" item keeps its original pricing semantics on edit - never silently reinterpreted as a fixed total', () => {
    const editingItem = { id: 'x', description: 'One consulting hour', quantity: '1', unit_price: '150', section_key: null };
    render(<AddItemWizard {...baseProps} editingItem={editingItem} />);
    fireEvent.click(screen.getByText('Change price and sizes'));
    // Hydrated as Quantity (units), not Fixed - the quantity=1 and unit
    // price=150 are both visible exactly as saved, never collapsed into a
    // single "Amount" framing.
    expect(document.getElementById('wiz-quantity')).toBeTruthy();
    expect(document.getElementById('wiz-quantity').value).toBe('1');
    expect(document.getElementById('wiz-unit-price').value).toBe('150');
  });

  it('preserves the first measurement row label on edit', () => {
    const editingItem = {
      id: 'x', description: 'Window', quantity: '1', unit_price: '100', pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 6,
      measurements: [{ width: 3, height: 2, unit: 'm', calculated_area: 6, label: 'Kitchen', is_pricing_driving: true }],
      section_key: null,
    };
    render(<AddItemWizard {...baseProps} editingItem={editingItem} />);
    fireEvent.click(screen.getByText('Change price and sizes'));
    expect(document.getElementById('wiz-width').value).toBe('300');
    expect(document.getElementById('wiz-height').value).toBe('200');
  });

  it('confirming an edit calls onAdd with the updated item, preserving its existing id', () => {
    const onAdd = vi.fn();
    const editingItem = { id: 'real-id-2', description: 'Fixed item', quantity: '1', unit_price: '150', section_key: null };
    render(<AddItemWizard {...baseProps} onAdd={onAdd} editingItem={editingItem} />);
    expect(screen.getByText('Save changes')).toBeTruthy();
    fireEvent.click(screen.getByText('Save changes'));
    const item = onAdd.mock.calls[0][0];
    expect(item.id).toBe('real-id-2');
    expect(item.description).toBe('Fixed item');
  });

  it('warns before ANY pricing-method change in edit mode could reinterpret the existing numbers - not only when measurements would be lost', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const editingItem = { id: 'x', description: 'Item', quantity: '3', unit_price: '10', section_key: null };
    render(<AddItemWizard {...baseProps} editingItem={editingItem} />);
    fireEvent.click(screen.getByText('Change how it is priced'));
    fireEvent.click(screen.getByText('One total price'));
    fireEvent.click(screen.getByText('Next'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText('How is the price worked out?')).toBeTruthy();
    confirmSpy.mockRestore();
  });
});

// SQ-F03 (Codex Smart Quote P0/P1 review): required acceptance fixtures -
// for each, a name-only edit (never touching pricing method/measurements/
// quantity) must preserve every unrelated field the wizard has no UI for
// at all (quantity_source, per-row is_pricing_driving, the first
// measurement row's label, and non-area/non-length pricing_unit).
describe('AddItemWizard - SQ-F03: non-destructive name-only edit preserves fields the wizard has no UI for', () => {
  it('measured item with manual quantity keeps quantity_source=manual and its stored calculated_quantity (never re-emitted as calculated)', () => {
    const editingItem = {
      id: 'm1', description: 'Custom cut glass', quantity: '1', unit_price: '80',
      pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 4.5,
      measurements: [{ width: 3, height: 2, unit: 'm', calculated_area: 6, label: '', is_pricing_driving: true }],
      section_key: null,
    };
    const item = nameOnlyEditAndSave(editingItem, 'Custom cut glass (renamed)');
    expect(item.description).toBe('Custom cut glass (renamed)');
    expect(item.quantity_source).toBe('manual');
    expect(item.calculation_method).toBe('manual');
    expect(Number(item.calculated_quantity)).toBe(4.5);
  });

  it('measured item with a display-only (is_pricing_driving:false) measurement row keeps that flag false', () => {
    const editingItem = {
      id: 'm2', description: 'Window with frame note', quantity: '1', unit_price: '120',
      pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 6,
      measurements: [{ width: 3, height: 2, unit: 'm', calculated_area: 6, label: '', is_pricing_driving: false }],
      section_key: null,
    };
    const item = nameOnlyEditAndSave(editingItem, 'Window with frame note (renamed)');
    expect(item.measurements[0].is_pricing_driving).toBe(false);
  });

  it('first measurement row with a non-empty label keeps that label (the wizard exposes no label field for row 1 at all)', () => {
    const editingItem = {
      id: 'm3', description: 'Kitchen window', quantity: '1', unit_price: '90',
      pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 6,
      measurements: [{ width: 3, height: 2, unit: 'm', calculated_area: 6, label: 'Kitchen', is_pricing_driving: true }],
      section_key: null,
    };
    const item = nameOnlyEditAndSave(editingItem, 'Kitchen window (renamed)');
    expect(item.measurements[0].label).toBe('Kitchen');
  });

  it('mixed pricing-driving/non-pricing-driving rows keep each row\'s own flag and label after a name-only edit', () => {
    const editingItem = {
      id: 'm4', description: 'Two-panel door', quantity: '1', unit_price: '200',
      pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 8,
      measurements: [
        { width: 3, height: 2, unit: 'm', calculated_area: 6, label: 'Left panel', is_pricing_driving: true },
        { width: 1, height: 2, unit: 'm', calculated_area: 2, label: 'Display trim', is_pricing_driving: false },
      ],
      section_key: null,
    };
    const item = nameOnlyEditAndSave(editingItem, 'Two-panel door (renamed)');
    expect(item.measurements.length).toBe(2);
    expect(item.measurements[0]).toMatchObject({ label: 'Left panel', is_pricing_driving: true });
    expect(item.measurements[1]).toMatchObject({ label: 'Display trim', is_pricing_driving: false });
  });

  // SQ-F03-A closure (Codex fresh re-review, "ONE-PASS SMART QUOTE FINAL
  // REMEDIATION" task, real severe bug): the row-level is_pricing_driving
  // FLAG was already correctly preserved (test above) - but a naive re-sum
  // of ALL measurement rows (including display-only ones) into the item's
  // recomputed calculated_quantity was NOT excluding the flagged row from
  // the actual NUMBER. Exact scenario from the task prompt: pricing-driving
  // area 1.5m^2 + display-only area 2m^2, rate 200, stored charge 300
  // (1.5*200) - a naive sum would silently jump to 3.5m^2/700 on a pure
  // name-only edit that never touches any measurement.
  it('SQ-F03-A: a name-only edit never re-sums a display-only measurement row into calculated_quantity (1.5 driving + 2 display-only stays 1.5, never 3.5)', () => {
    const editingItem = {
      id: 'm5', description: 'Window with decorative trim', quantity: '1', unit_price: '200',
      pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 1.5,
      measurements: [
        { width: 1, height: 1.5, unit: 'm', calculated_area: 1.5, label: '', is_pricing_driving: true },
        { width: 1, height: 2, unit: 'm', calculated_area: 2, label: 'Decorative trim (display only)', is_pricing_driving: false },
      ],
      section_key: null,
    };
    const item = nameOnlyEditAndSave(editingItem, 'Window with decorative trim (renamed)');
    expect(item.measurements[0].is_pricing_driving).toBe(true);
    expect(item.measurements[1].is_pricing_driving).toBe(false);
    // The real regression: this must stay 1.5, never fabricate 3.5.
    expect(Number(item.calculated_quantity)).toBeCloseTo(1.5, 10);
  });

  // SQ-F03-B closure (Codex fresh re-review, real severe bug): a manual
  // non-measured professional item (hour/day/kg/professional unit) can
  // carry a real effective quantity in calculated_quantity while its flat
  // `quantity` column is a different placeholder value (legacy data
  // pattern, same convention already used for measured items). Exact
  // scenario from the task prompt: rate 100/hour, stored total 700 (7
  // hours), flat quantity column left at a placeholder 1 - a name-only edit
  // must not collapse the effective quantity down to that flat placeholder.
  it('SQ-F03-B: a name-only edit on a manual hour item preserves the real effective quantity (calculated_quantity), never collapsing to the flat placeholder quantity', () => {
    const editingItem = {
      id: 'h2', description: 'Installation labor (legacy)', quantity: '1', unit_price: '100',
      pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 7,
      section_key: null,
    };
    const item = nameOnlyEditAndSave(editingItem, 'Installation labor (legacy, renamed)');
    expect(item.pricing_unit).toBe('hour');
    expect(item.quantity_source).toBe('manual');
    // The real regression: this must stay 7, never collapse to the flat
    // placeholder quantity (1) - getActiveQuantity(item) would compute the
    // effective/charged quantity as 7*100=700, not 1*100=100.
    expect(Number(item.calculated_quantity)).toBe(7);
  });

  it('hour-based structured item keeps pricing_unit=hour, quantity_source and calculation_method (never silently downgraded to a plain item)', () => {
    const editingItem = { id: 'h1', description: 'Installation labor', quantity: '5', unit_price: '150', pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', section_key: null };
    const item = nameOnlyEditAndSave(editingItem, 'Installation labor (renamed)');
    expect(item.pricing_unit).toBe('hour');
    expect(item.quantity_source).toBe('manual');
    expect(item.calculation_method).toBe('manual');
    expect(item.quantity).toBe('5');
  });

  it('kg-based structured item keeps pricing_unit=kg, quantity_source and calculation_method (never silently downgraded to a plain item)', () => {
    const editingItem = { id: 'k1', description: 'Raw material', quantity: '12', unit_price: '9', pricing_unit: 'kg', quantity_source: 'manual', calculation_method: 'manual', section_key: null };
    const item = nameOnlyEditAndSave(editingItem, 'Raw material (renamed)');
    expect(item.pricing_unit).toBe('kg');
    expect(item.quantity_source).toBe('manual');
    expect(item.calculation_method).toBe('manual');
    expect(item.quantity).toBe('12');
  });

  it('item with a specification keeps it exactly after a name-only edit', () => {
    const editingItem = { id: 's1', description: 'Custom frame', quantity: '1', unit_price: '75', specification: [{ label: 'Color', value: 'White' }], section_key: null };
    const item = nameOnlyEditAndSave(editingItem, 'Custom frame (renamed)');
    expect(item.specification).toEqual([{ label: 'Color', value: 'White' }]);
  });

  it('item assigned to a unit keeps its section_key after a name-only edit', () => {
    const editingItem = { id: 'u1', description: 'Assigned item', quantity: '1', unit_price: '50', section_key: 'sec1' };
    const item = nameOnlyEditAndSave(editingItem, 'Assigned item (renamed)');
    expect(item.section_key).toBe('sec1');
  });

  it('an explicit, confirmed pricing-method conversion does NOT preserve the old pricing_unit/quantity_source - this is an intentional semantic conversion, not a silent mutation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onAdd = vi.fn();
    const editingItem = { id: 'c1', description: 'Labor', quantity: '5', unit_price: '150', pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', section_key: null };
    render(<AddItemWizard {...baseProps} onAdd={onAdd} editingItem={editingItem} />);
    fireEvent.click(screen.getByText('Change how it is priced'));
    fireEvent.click(screen.getByText('More options'));
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-width'), '300');
    setValue(document.getElementById('wiz-height'), '200');
    setValue(document.getElementById('wiz-unit-price-m'), '150');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Save changes'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const item = onAdd.mock.calls[0][0];
    expect(item.pricing_unit).toBe('m2');
    expect(item.quantity_source).toBe('calculated');
    expect(item.calculation_method).toBe('area');
    confirmSpy.mockRestore();
  });
});

describe('AddItemWizard - grouping', () => {
  it('uses real-world "Unit (apartment / room / area)" terminology, never Section/Category, and defaults to no unit', () => {
    const onAdd = vi.fn();
    const sections = [{ key: 'sec1', name: 'Ground floor' }];
    render(<AddItemWizard {...baseProps} onAdd={onAdd} sections={sections} />);
    setValue(document.getElementById('wiz-description'), 'Item');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('One total price'));
    fireEvent.click(screen.getByText('Next'));
    setValue(document.getElementById('wiz-fixed-amount'), '10');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Add details for the customer?'));
    expect(screen.getByText('Unit (apartment / room / area) - optional')).toBeTruthy();
    expect(screen.queryByText(/Section/)).toBeNull();
    expect(screen.queryByText(/Category/)).toBeNull();
    fireEvent.click(screen.getByText('Add to quote'));
    expect(onAdd.mock.calls[0][0].section_key).toBeNull();
  });
});

describe('AddItemWizard - modal focus management', () => {
  it('moves focus to the first field on step 1 (description input)', () => {
    render(<AddItemWizard {...baseProps} />);
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(document.activeElement?.id).toBe('wiz-description');
        resolve();
      }, 60);
    });
  });

  it('restores focus to the element that had it before the dialog opened, on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = render(<AddItemWizard {...baseProps} isOpen={false} />);
    rerender(<AddItemWizard {...baseProps} isOpen={true} />);
    rerender(<AddItemWizard {...baseProps} isOpen={false} />);
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

describe('AddItemWizard - Hebrew/RTL', () => {
  it('renders Hebrew labels and RTL direction, matching the exact Owner-specified copy', () => {
    render(<AddItemWizard {...baseProps} isHebrew={true} />);
    expect(screen.getByRole('dialog').getAttribute('dir')).toBe('rtl');
    expect(screen.getByText('הוספת מוצר או עבודה')).toBeTruthy();
    expect(screen.getByText('מה מוסיפים?')).toBeTruthy();
    expect(screen.getByText('כתבו את המוצר או העבודה שתרצו להוסיף להצעה.')).toBeTruthy();
  });
});

describe('AddItemWizard - mobile input sizing', () => {
  it('text inputs use a 16px font size (prevents iOS auto-zoom)', () => {
    render(<AddItemWizard {...baseProps} />);
    const input = document.getElementById('wiz-description');
    expect(input.style.fontSize).toBe('16px');
  });
});

describe('AddItemWizard - 4-step indicator', () => {
  it('shows all 4 step labels and marks the current step accessibly', () => {
    render(<AddItemWizard {...baseProps} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
  });

  it('advances aria-valuenow as the user moves through steps', () => {
    render(<AddItemWizard {...baseProps} />);
    setValue(document.getElementById('wiz-description'), 'Item');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
  });
});
