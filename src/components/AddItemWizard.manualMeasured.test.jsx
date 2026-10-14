// Task 34 extension (Owner comprehensive AI specification, section ג): a MANUAL quantity with a measured unit (36 m², 8 linear meters) is a
// charged quantity in its own right - m2 / linear_meter is not proof that the quantity was calculated from dimensions. The wizard must open
// such an item on its manual quantity (with its unit), never ask for invented width / height, and a no-change / name-only edit must keep
// every field (quantity source, unit, active quantity, measurement rows, specification, section, price).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddItemWizard from './AddItemWizard';

const baseProps = {
  isOpen: true, onClose: vi.fn(), onAdd: vi.fn(), editingItem: null, isHebrew: false, sym: '$', formatMoneyDisplay: (n) => Number(n).toFixed(2),
  services: [], sections: [], defaultSectionKey: null, canUseProfessionalQuotes: true, onRequestUpgrade: vi.fn(), recommendedMethod: null,
};
function setValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, value);
  fireEvent.input(el, { target: { value } });
}
// the shape the AI-draft hand-off (aiQuoteDraftClient.draftLinesToQuoteItems) and the form's manual override produce
const MANUAL_M2 = { id: 'i1', description: 'Tile the master bedroom', quantity: '1', unit_price: '100', isFromCatalog: false, pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 36, measurements: [], specification: [{ label: 'Tile', value: '60x60' }], section_key: 's1' };
const MANUAL_LM = { id: 'i2', description: 'Skirting', quantity: '1', unit_price: '20', pricing_unit: 'linear_meter', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 8, measurements: [] };

beforeEach(() => vi.clearAllMocks());

describe('manual measured-unit items in the item wizard', () => {
  it.each([['m2', MANUAL_M2, 36, 'm²'], ['linear_meter', MANUAL_LM, 8, 'linear meter']])('%s: Review shows the manual quantity with its unit; no width / height is asked', (_u, item, qty, unitLabel) => {
    render(<AddItemWizard {...baseProps} editingItem={item} />);
    expect(document.body.textContent).toContain(String(qty));
    expect(document.body.textContent).toContain(unitLabel);
    fireEvent.click(screen.getByText('Change price and sizes'));
    expect(document.getElementById('wiz-width')).toBeNull();
    expect(document.getElementById('wiz-quantity').value).toBe(String(qty));
  });

  it('a name-only edit keeps the manual quantity, its unit, its source and every non-UI field', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} editingItem={MANUAL_M2} />);
    fireEvent.click(screen.getByText('Change name'));
    setValue(document.getElementById('wiz-description'), 'Tile the master bedroom (porcelain)');
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Save changes'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const out = onAdd.mock.calls[0][0];
    expect(out).toMatchObject({ id: 'i1', description: 'Tile the master bedroom (porcelain)', pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 36, unit_price: '100', section_key: 's1' });
    expect(out.measurements).toEqual([]);
    expect(out.specification).toEqual([{ label: 'Tile', value: '60x60' }]);
  });

  it('changing the manual quantity in the wizard keeps the unit and the manual source (no dimensions invented)', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} editingItem={MANUAL_M2} />);
    fireEvent.click(screen.getByText('Change price and sizes'));
    setValue(document.getElementById('wiz-quantity'), '40.5');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Save changes'));
    const out = onAdd.mock.calls[0][0];
    expect(out).toMatchObject({ pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 40.5 });
    expect(out.measurements).toEqual([]);
  });
});
