// Owner console 2026-11-05 (typed: "מאשר מספרים במילים ויחידות רגל מלאות לשוק הבינלאומי, כולל שינוי ב-L-09, L-14, L-15 ו-L-17, שחרור עד
// הלייב"): an international account may type sizes in feet / inches; the item is priced per sq ft / linear ft and its rows are stored in
// feet. An Israeli account sees cm / m only. Metres and feet never mix in one item.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { answerAppDialog } from '../test/appDialog';
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

describe('AddItemWizard - feet for the international market', () => {
  it('an Israeli account sees cm / m only', () => {
    render(<AddItemWizard {...baseProps} isHebrew sym="₪" international={false} />);
    setValue(document.getElementById('wiz-description'), 'חלון');
    fireEvent.click(screen.getByText('מחיר לפי שטח'));
    expect(screen.getByTestId('wiz-unit-cm')).toBeTruthy();
    expect(screen.queryByTestId('wiz-unit-ft')).toBeNull();
    expect(screen.queryByTestId('wiz-unit-in')).toBeNull();
  });

  it('feet x feet = sq ft: priced per sq ft, the rows stored in feet', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} international />);
    setValue(document.getElementById('wiz-description'), 'Deck');
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByTestId('wiz-unit-ft'));
    setValue(document.getElementById('wiz-width'), '10');
    setValue(document.getElementById('wiz-height'), '12');
    expect(screen.getByText('10 × 12 ft = 120.00 sq ft')).toBeTruthy();
    expect(screen.getByText(/Price per sq ft/)).toBeTruthy();
    setValue(document.getElementById('wiz-unit-price-m'), '5');
    fireEvent.click(screen.getByText('Continue to check'));
    fireEvent.click(screen.getByText('Add to quote'));
    const item = onAdd.mock.calls[0][0];
    expect(item.pricing_unit).toBe('sq_ft');
    expect(item.calculation_method).toBe('area');
    expect(item.calculated_quantity).toBe(120);
    expect(item.measurements[0]).toMatchObject({ width: 10, height: 12, unit: 'ft', calculated_area: 120 });
  });

  it('inches are read as twelfths of a foot (18 in x 24 in = 3 sq ft); a length in feet = linear ft', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} international />);
    setValue(document.getElementById('wiz-description'), 'Panel');
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByTestId('wiz-unit-in'));
    setValue(document.getElementById('wiz-width'), '18');
    setValue(document.getElementById('wiz-height'), '24');
    setValue(document.getElementById('wiz-unit-price-m'), '10');
    fireEvent.click(screen.getByText('Continue to check'));
    fireEvent.click(screen.getByText('Add to quote'));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ pricing_unit: 'sq_ft', calculated_quantity: 3 });
    expect(onAdd.mock.calls[0][0].measurements[0]).toMatchObject({ width: 1.5, height: 2, unit: 'ft' });
  });

  it('a known quantity in sq ft (no sizes)', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} international />);
    setValue(document.getElementById('wiz-description'), 'Floor');
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByText('I already know the area'));
    fireEvent.click(screen.getByTestId('wiz-qtyunit-ft'));
    expect(screen.getByText('How many sq ft?')).toBeTruthy();
    setValue(document.getElementById('wiz-manual-qty'), '900');
    setValue(document.getElementById('wiz-unit-price-m'), '4');
    fireEvent.click(screen.getByText('Continue to check'));
    fireEvent.click(screen.getByText('Add to quote'));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ pricing_unit: 'sq_ft', quantity_source: 'manual', calculated_quantity: 900 });
  });

  it('switching metric -> feet with a typed price asks first (the price is now per sq ft)', async () => {
    render(<AddItemWizard {...baseProps} international />);
    setValue(document.getElementById('wiz-description'), 'Deck');
    fireEvent.click(screen.getByText('Price by area'));
    setValue(document.getElementById('wiz-width'), '300');
    setValue(document.getElementById('wiz-unit-price-m'), '5');
    fireEvent.click(screen.getByTestId('wiz-unit-ft'));
    await answerAppDialog(false);
    expect(screen.getByTestId('wiz-unit-cm').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('wiz-width').value).toBe('300');
  });

  it('editing a saved feet item opens in feet with its own numbers', () => {
    const editingItem = { id: 'x', description: 'Deck', quantity: '1', unit_price: '5', pricing_unit: 'sq_ft', quantity_source: 'calculated', calculation_method: 'area',
      calculated_quantity: 120, measurements: [{ width: 10, height: 12, unit: 'ft', calculated_area: 120, label: '' }] };
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} editingItem={editingItem} international />);
    expect(screen.getAllByText(/120\.00 sq ft/).length).toBeGreaterThan(0);
  });
});
