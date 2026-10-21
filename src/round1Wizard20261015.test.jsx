// Owner round 1 (2026-10-15, Codex spec A2 / A4, plan approved): the item wizard is two screens - the item (what, all four pricing
// methods, the numbers, a live calculation) and the check; sizes in cm or m (stored metres); "I already know the area"; a price typed
// for one unit is never kept silently for another; the AI context keeps its four step ids.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AddItemWizard from './components/AddItemWizard';

const baseProps = {
  isOpen: true, onClose: vi.fn(), onAdd: vi.fn(), editingItem: null, isHebrew: false, sym: '$', formatMoneyDisplay: (n) => Number(n).toFixed(2),
  services: [], sections: [], defaultSectionKey: null, canUseProfessionalQuotes: true, onRequestUpgrade: vi.fn(), recommendedMethod: 'area',
};
const setValue = (el, value) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value); fireEvent.input(el, { target: { value } }); };
const byId = (id) => document.getElementById(id);

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('one item screen', () => {
  it('description, all four methods (recommendation first) and the numbers of the chosen method on the same screen', () => {
    render(<AddItemWizard {...baseProps} />);
    expect(byId('wiz-description')).toBeTruthy();
    expect([...document.querySelectorAll('[aria-pressed]')].slice(0, 4).map((el) => el.textContent.split('e.g.')[0])).toEqual(['Price by areaRecommended', 'One total price', 'Price for each', 'Price by length']);
    fireEvent.click(screen.getByText('Price by area'));
    expect(byId('wiz-width')).toBeTruthy();
    expect(byId('wiz-description')).toBeTruthy();
  });

  it('100 × 200 cm at 600 per m²: live calculation 2.00 m² and $1,200 with the discount / VAT note; stored in metres', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(byId('wiz-description'), 'Aluminium window');
    fireEvent.click(screen.getByText('Price by area'));
    setValue(byId('wiz-width'), '100');
    setValue(byId('wiz-height'), '200');
    setValue(byId('wiz-unit-price-m'), '600');
    expect(screen.getByText('100 × 200 cm = 2.00 m²')).toBeTruthy();
    const calc = screen.getByTestId('wiz-calc');
    expect(calc.textContent).toContain('2.00 m² × $600.00 = $1200.00');
    expect(calc.textContent).toContain('Discount and tax are calculated in the quote summary');
    fireEvent.click(screen.getByText('Continue to check'));
    fireEvent.click(screen.getByText('Add to quote'));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ pricing_unit: 'm2', quantity_source: 'calculated', calculated_quantity: 2 });
    expect(onAdd.mock.calls[0][0].measurements.map((m) => [m.width, m.height])).toEqual([[1, 2]]);
  });
});

describe('A4: cm with a switch to metres', () => {
  it('switching converts what was typed; the stored measurements stay metres; the review speaks the chosen unit', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(byId('wiz-description'), 'Glass');
    fireEvent.click(screen.getByText('Price by area'));
    setValue(byId('wiz-width'), '150');
    setValue(byId('wiz-height'), '120');
    fireEvent.click(screen.getByTestId('wiz-unit-m'));
    expect(screen.getByTestId('wiz-unit-m').getAttribute('aria-pressed')).toBe('true');
    expect(byId('wiz-width').value).toBe('1.5');
    expect(byId('wiz-height').value).toBe('1.2');
    expect(screen.getByText('Width (m)')).toBeTruthy();
    expect(screen.getByText('1.5 × 1.2 m = 1.80 m²')).toBeTruthy();
    setValue(byId('wiz-unit-price-m'), '100');
    fireEvent.click(screen.getByText('Continue to check'));
    fireEvent.click(screen.getByText('Add to quote'));
    const item = onAdd.mock.calls[0][0];
    expect(item.measurements.map((m) => [m.width, m.height])).toEqual([[1.5, 1.2]]);
    expect(item.calculated_quantity).toBeCloseTo(1.8, 10);
  });

  it('Hebrew: ס"מ by default, מטר on the switch', () => {
    render(<AddItemWizard {...baseProps} isHebrew sym="₪" />);
    setValue(byId('wiz-description'), 'חלון');
    fireEvent.click(screen.getByText('מחיר לפי שטח'));
    expect(screen.getByText('רוחב (ס"מ)')).toBeTruthy();
    fireEvent.click(screen.getByTestId('wiz-unit-m'));
    expect(screen.getByText("רוחב (מ')")).toBeTruthy();
  });
});

describe('"I already know the area" - a manual measured quantity, no invented sizes', () => {
  it('36 m² at 100: the existing manual measured item, no measurement rows', () => {
    const onAdd = vi.fn();
    render(<AddItemWizard {...baseProps} onAdd={onAdd} />);
    setValue(byId('wiz-description'), 'Tiling');
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByText('I already know the area'));
    expect(byId('wiz-width')).toBeNull();
    setValue(byId('wiz-manual-qty'), '36');
    setValue(byId('wiz-unit-price-m'), '100');
    expect(screen.getByTestId('wiz-calc').textContent).toContain('36.00 m² × $100.00 = $3600.00');
    fireEvent.click(screen.getByText('Continue to check'));
    fireEvent.click(screen.getByText('Add to quote'));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 36, measurements: [] });
  });

  it('an empty known quantity is refused with a message', () => {
    render(<AddItemWizard {...baseProps} />);
    setValue(byId('wiz-description'), 'Skirting');
    fireEvent.click(screen.getByText('Price by length'));
    fireEvent.click(screen.getByText('I already know the length'));
    setValue(byId('wiz-unit-price-m'), '20');
    fireEvent.click(screen.getByText('Continue to check'));
    expect(screen.getByText('Please enter a quantity greater than 0')).toBeTruthy();
  });
});

describe('a typed price is never kept silently for another unit', () => {
  it('asks before switching the method once a price exists; declining keeps everything', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AddItemWizard {...baseProps} />);
    setValue(byId('wiz-description'), 'Window');
    fireEvent.click(screen.getByText('Price by area'));
    setValue(byId('wiz-unit-price-m'), '600');
    fireEvent.click(screen.getByText('Price by length'));
    expect(confirmSpy).toHaveBeenCalledWith('Changing the unit requires reviewing the price. Continue?');
    expect(byId('wiz-height')).toBeTruthy();
    expect(byId('wiz-unit-price-m').value).toBe('600');
  });

  it('no question before any price is typed', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<AddItemWizard {...baseProps} />);
    fireEvent.click(screen.getByText('Price by area'));
    fireEvent.click(screen.getByText('Price by length'));
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe('the AI context keeps its four step ids; old drafts resume', () => {
  it('what -> pricing -> details on the item screen, review on the check', () => {
    const live = vi.fn();
    render(<AddItemWizard {...baseProps} onLiveStateChange={live} />);
    const last = () => live.mock.calls.at(-1)[0].step;
    expect(last()).toBe('what');
    setValue(byId('wiz-description'), 'Item');
    expect(last()).toBe('pricing');
    fireEvent.click(screen.getByText('One total price'));
    expect(last()).toBe('details');
    setValue(byId('wiz-fixed-amount'), '10');
    fireEvent.click(screen.getByText('Continue to check'));
    expect(last()).toBe('review');
  });

  it('a draft from the 4-step wizard resumes on the item screen (steps 1-3) or on the check (step 4)', () => {
    const draft = { description: 'Resumed', pricingMethod: 'fixed', unitPrice: '50', quantity: '1', widthCm: '', heightCm: '', extraMeasureRows: [], specRows: [] };
    render(<AddItemWizard {...baseProps} resumeState={{ ...draft, step: 3 }} />);
    expect(byId('wiz-fixed-amount').value).toBe('50');
    cleanup();
    render(<AddItemWizard {...baseProps} resumeState={{ ...draft, step: 4 }} />);
    expect(screen.getByText('Check before adding')).toBeTruthy();
  });
});
