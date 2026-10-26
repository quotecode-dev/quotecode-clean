// Owner console 2026-10-26 (typed: "מאשר שינוי ב-L-09, L-15 ו-L-17 לפי docs/CODEX_ITEM_PATHS_SPEC_2026-10-26.md: בחירה מרובה כבר בקטלוג
// הראשון, ברירת מחיר לכל יחידה וכמות 1 עם בדיקה ועריכה לפני הוספה, ... גלילה ומיקוד לשדה החסר או לשדות שנפתחו, תיקוני מקלדת ובידוד
// מספרים ודוגמת מטבע ..."): the Owner's video (26/10) - a click that seemed to do nothing - is answered: every blocked action names
// what is missing next to the button and moves the focus to it; catalog items are ticked and checked together before adding.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import AddItemWizard from './AddItemWizard';
import { answerAppDialog } from '../test/appDialog';

const SERVICES = [{ id: 1, name: 'AC installation', price: 400 }, { id: 2, name: 'Technician visit', price: 80 }, { id: 3, name: 'Copper pipe per meter', price: 30 }];
const props = (extra = {}) => ({ isOpen: true, onClose: vi.fn(), onAdd: vi.fn(), onAddMany: vi.fn(), editingItem: null, isHebrew: false, sym: '$',
  formatMoneyDisplay: (n) => Number(n).toFixed(2), services: SERVICES, sections: [], defaultSectionKey: null, canUseProfessionalQuotes: true,
  onRequestUpgrade: vi.fn(), recommendedMethod: 'area', ...extra });
const setValue = (el, value) => fireEvent.change(el, { target: { value } });
const tick = async (name) => { await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name })); }); };

describe('the click that "did nothing" (Codex F-01 / F-02)', () => {
  it('Continue without a method: the reason next to the button, the method cards focused', async () => {
    render(<AddItemWizard {...props()} />);
    setValue(document.getElementById('wiz-description'), 'Copper pipe');
    fireEvent.click(screen.getByText('Continue to check'));
    expect(screen.getByTestId('wiz-blocked').textContent).toBe('Complete:pricing method');
    expect(document.getElementById('wiz-method-error').textContent).toBe('Please choose how to charge for this item');
    await waitFor(() => expect(document.activeElement?.id).toBe('wiz-method-area'));
  });
  it('length chosen but empty: the length field is focused, its message is linked to it', async () => {
    render(<AddItemWizard {...props()} />);
    setValue(document.getElementById('wiz-description'), 'Copper pipe');
    fireEvent.click(screen.getByText('Price by length'));
    await waitFor(() => expect(document.activeElement?.id).toBe('wiz-width')); // the field the method opened
    setValue(document.getElementById('wiz-unit-price-m'), '30');
    document.getElementById('wiz-unit-price-m').focus();
    fireEvent.click(screen.getByText('Continue to check'));
    expect(screen.getByTestId('wiz-blocked').textContent).toBe('Complete:length');
    const field = document.getElementById('wiz-width');
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field.getAttribute('aria-describedby')).toBe('wiz-width-error');
  });
  it('a second size missing its height: that height is the target, not the complete first size', async () => {
    render(<AddItemWizard {...props()} />);
    setValue(document.getElementById('wiz-description'), 'Glass');
    fireEvent.click(screen.getByText('Price by area'));
    setValue(document.getElementById('wiz-width'), '100');
    setValue(document.getElementById('wiz-height'), '100');
    fireEvent.click(screen.getByText('+ Add another size'));
    setValue(document.getElementById('wiz-extra-width-0'), '50');
    setValue(document.getElementById('wiz-unit-price-m'), '10');
    fireEvent.click(screen.getByText('Continue to check'));
    expect(screen.getByTestId('wiz-blocked').textContent).toBe('Complete:size 2');
    await waitFor(() => expect(document.activeElement?.id).toBe('wiz-extra-height-0'));
    expect(document.getElementById('wiz-extra-width-0').getAttribute('aria-invalid')).toBe('false');
    expect(document.getElementById('wiz-extra-height-0').getAttribute('aria-describedby')).toBe('wiz-extra-row-error-0');
  });
  it('the "Complete" link takes the user back to the field again', async () => {
    render(<AddItemWizard {...props()} />);
    fireEvent.click(screen.getByText('Continue to check'));
    document.querySelector('[data-testid="wiz-blocked"] button').focus();
    fireEvent.click(document.querySelector('[data-testid="wiz-blocked"] button'));
    await waitFor(() => expect(document.activeElement?.id).toBe('wiz-description'));
  });
});

describe('ticking catalog items (Codex F-03 / F-07)', () => {
  it('several items: counted, checked together as "price for each, quantity 1", one is changed to 5 m, one removed, ONE update in catalog order', async () => {
    const p = props();
    render(<AddItemWizard {...p} />);
    await tick(/Copper pipe per meter/);
    await tick(/AC installation/);
    await tick(/Technician visit/);
    expect(screen.getByTestId('wiz-picked-count').textContent).toBe('3 selected');
    // the methods of a single typed item are not mixed into a catalog selection
    expect(screen.queryByText('One total price')).toBeNull();
    expect(screen.getByTestId('wiz-catalog-note').textContent).toContain('The catalog stores a name and price only.');
    fireEvent.click(screen.getByText('Continue to check (3)'));
    expect(screen.getByText('Check 3 items before adding')).toBeTruthy();
    // catalog order, not tick order; the defaults
    expect([0, 1, 2].map((i) => document.getElementById(`wiz-pick-${i}-description`).value)).toEqual(['AC installation', 'Technician visit', 'Copper pipe per meter']);
    expect(document.getElementById('wiz-pick-2-method').value).toBe('units');
    expect(document.getElementById('wiz-pick-2-quantity').value).toBe('1');
    // the unit is never guessed from "per meter": the user changes it, confirms the unit change, enters 5 m
    fireEvent.change(document.getElementById('wiz-pick-2-method'), { target: { value: 'linear' } });
    expect(await answerAppDialog(true)).toBe('Changing the unit requires reviewing the price. Continue?');
    await waitFor(() => expect(document.getElementById('wiz-pick-2-manualQty')).not.toBeNull());
    setValue(document.getElementById('wiz-pick-2-manualQty'), '5');
    expect(screen.getByTestId('wiz-pick-total-2').textContent).toBe('Line total: $150.00');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Technician visit from the selection' }));
    expect(screen.getByText('Check 2 items before adding')).toBeTruthy();
    expect(screen.getByTestId('wiz-multi-sum').textContent).toContain('Total of the selected items: $550.00');
    fireEvent.click(screen.getByTestId('wiz-add-many'));
    expect(p.onAddMany).toHaveBeenCalledTimes(1);
    expect(p.onAddMany.mock.calls[0][0]).toEqual([
      { description: 'AC installation', quantity: '1', unit_price: '400', isFromCatalog: true, section_key: null },
      { description: 'Copper pipe per meter', quantity: '1', unit_price: '30', isFromCatalog: true, section_key: null, pricing_unit: 'linear_meter',
        quantity_source: 'manual', calculation_method: 'manual', measurements: [], calculated_quantity: 5 },
    ]);
    expect(p.onAdd).not.toHaveBeenCalled();
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });
  it('a missing quantity on the check blocks the add: the item and the field are named, the field focused, nothing added', async () => {
    const p = props();
    render(<AddItemWizard {...p} />);
    await tick(/AC installation/);
    await tick(/Technician visit/);
    fireEvent.click(screen.getByText('Continue to check (2)'));
    setValue(document.getElementById('wiz-pick-1-quantity'), '0');
    fireEvent.click(screen.getByTestId('wiz-add-many'));
    expect(screen.getByTestId('wiz-blocked').textContent).toBe('Complete:Item 2: quantity');
    await waitFor(() => expect(document.activeElement?.id).toBe('wiz-pick-1-quantity'));
    expect(p.onAddMany).not.toHaveBeenCalled();
  });
  it('a catalog item without a valid price stays missing (never 0)', async () => {
    const p = props({ services: [{ id: 9, name: 'Unknown price', price: null }] });
    render(<AddItemWizard {...p} />);
    await tick(/Unknown price/);
    fireEvent.click(screen.getByText('Continue to check (1)'));
    expect(document.getElementById('wiz-pick-0-price').value).toBe('');
    fireEvent.click(screen.getByTestId('wiz-add-many'));
    expect(p.onAddMany).not.toHaveBeenCalled();
    expect(screen.getByTestId('wiz-blocked').textContent).toBe('Complete:Item 1: price');
  });
  it('removing the last item returns to the list with 0 selected and says so', async () => {
    render(<AddItemWizard {...props()} />);
    await tick(/AC installation/);
    fireEvent.click(screen.getByText('Continue to check (1)'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove AC installation from the selection' }));
    expect(screen.getByTestId('wiz-picked-count').textContent).toBe('0 selected');
    expect(screen.getByTestId('wiz-pick-notice').textContent).toBe('No items are left in the selection. Tick items in the catalog or type a new item.');
  });
  it('a started typed item is never mixed silently with a catalog tick: Keep it leaves both as they were', async () => {
    render(<AddItemWizard {...props()} />);
    setValue(document.getElementById('wiz-description'), 'My own job');
    fireEvent.click(screen.getByRole('checkbox', { name: /AC installation/ }));
    expect(await answerAppDialog(false)).toContain('Replace the item you started typing with the catalog selection?');
    expect(document.getElementById('wiz-description').value).toBe('My own job');
    expect(screen.getByTestId('wiz-picked-count').textContent).toBe('0 selected');
  });
  it('an item already in the quote is added as a separate line, with a note', async () => {
    render(<AddItemWizard {...props({ quoteItems: [{ description: 'AC installation', quantity: '1', unit_price: '400' }] })} />);
    await tick(/AC installation/);
    fireEvent.click(screen.getByText('Continue to check (1)'));
    expect(screen.getByTestId('wiz-pick-in-quote-0').textContent).toBe('Already in the quote; it will be added as a separate item.');
  });
  it('the selection is added to the unit the wizard was opened from, and says where', async () => {
    const p = props({ sections: [{ key: 's1', name: 'Kitchen' }], defaultSectionKey: 's1' });
    render(<AddItemWizard {...p} />);
    await tick(/Technician visit/);
    fireEvent.click(screen.getByText('Continue to check (1)'));
    expect(screen.getByTestId('wiz-multi-target').textContent).toBe('Added to: Kitchen');
    fireEvent.click(screen.getByTestId('wiz-add-many'));
    expect(p.onAddMany.mock.calls[0][0][0].section_key).toBe('s1');
  });
  it('Hebrew: RTL, the Hebrew counter and check title', async () => {
    render(<AddItemWizard {...props({ isHebrew: true, sym: '₪' })} />);
    expect(screen.getByRole('dialog').getAttribute('dir')).toBe('rtl');
    await tick(/התקנ|AC installation/);
    expect(screen.getByTestId('wiz-picked-count').textContent).toBe('נבחרו 1');
    fireEvent.click(screen.getByText('המשך לבדיקה (1)'));
    expect(screen.getByText('בדיקת פריט אחד לפני הוספה')).toBeTruthy();
    expect(screen.getByTestId('wiz-add-many').textContent).toBe('הוספת פריט אחד להצעה');
  });
});

describe('numbers and currency (Codex F-05 / F-06)', () => {
  it('the "one total price" example uses the quote currency, not the language', () => {
    const { unmount } = render(<AddItemWizard {...props({ isHebrew: false, sym: '₪', services: [] })} />);
    expect(screen.getByText('e.g. ₪500.00')).toBeTruthy();
    unmount();
    render(<AddItemWizard {...props({ isHebrew: true, sym: '$', services: [] })} />);
    expect(screen.getByText('לדוגמה: $500.00')).toBeTruthy();
  });
  it('number fields are LTR-isolated with tabular digits, in both languages', () => {
    render(<AddItemWizard {...props({ isHebrew: true, sym: '₪', services: [] })} />);
    setValue(document.getElementById('wiz-description'), 'עבודה');
    fireEvent.click(screen.getByText('מחיר כולל'));
    const amount = document.getElementById('wiz-fixed-amount');
    expect(amount.getAttribute('dir')).toBe('ltr');
    expect(amount.style.unicodeBidi).toBe('isolate');
    expect(amount.style.fontVariantNumeric).toBe('tabular-nums');
    expect(amount.style.textAlign).toBe('right');
  });
});
