// Unified quote (Owner console 2026-11-11, spec section 1; the 10-year-old rule): the work window (one row per room, each with its own
// quantity and price), the places window (kind -> how many -> identical), the summary with ONE total and ONE save, the quote details
// with every extra named, the saved screen, and one step back everywhere (Escape / the phone Back close a window step by step).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import WorkItemDialog from './components/WorkItemDialog';
import PlacesDialog from './components/PlacesDialog';
import QuoteSavedScreen from './components/QuoteSavedScreen';

const open = (props = {}) => {
  const onAdd = vi.fn(); const onClose = vi.fn();
  render(<WorkItemDialog open isHebrew={false} services={[]} groupKind="apartment" sectionKey="sec1" groupName="Apartment 1" onAdd={onAdd} onClose={onClose} {...props} />);
  return { onAdd, onClose };
};
const next = () => fireEvent.click(screen.getByTestId('work-next'));

describe('the work window: one question at a time', () => {
  it('flooring in the kitchen and the living room = two rows, each with its own quantity and price, in the group', () => {
    const { onAdd } = open();
    fireEvent.change(screen.getByTestId('work-name'), { target: { value: 'Flooring' } });
    next();
    expect(screen.getByRole('heading', { name: 'Where is this work done?' })).toBeTruthy();
    fireEvent.click(document.querySelector('[data-room="kitchen"]'));
    fireEvent.click(document.querySelector('[data-room="living"]'));
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Per m²' }));
    fireEvent.change(document.querySelector('[data-per-qty="kitchen"]'), { target: { value: '12' } });
    fireEvent.change(document.querySelector('[data-per-price="kitchen"]'), { target: { value: '150' } });
    fireEvent.change(document.querySelector('[data-per-qty="living"]'), { target: { value: '30' } });
    fireEvent.change(document.querySelector('[data-per-price="living"]'), { target: { value: '110' } });
    next();
    const rows = onAdd.mock.calls[0][0];
    expect(rows.map((r) => [r.description, r.room, r.section_key, r.pricing_unit, r.calculated_quantity, r.unit_price]))
      .toEqual([['Flooring', 'kitchen', 'sec1', 'm2', 12, '150'], ['Flooring', 'living', 'sec1', 'm2', 30, '110']]);
  });

  it('sizes in metres with a name: 2 × 3 m = 6 m²', () => {
    const { onAdd } = open();
    fireEvent.change(screen.getByTestId('work-name'), { target: { value: 'Tiles' } });
    next(); next();
    fireEvent.click(screen.getByRole('button', { name: 'Per m²' }));
    fireEvent.click(screen.getByRole('button', { name: 'From measurements' }));
    const inputs = document.querySelectorAll('.sq-size-row input');
    fireEvent.change(inputs[0], { target: { value: 'Bathroom floor' } });
    fireEvent.change(inputs[1], { target: { value: '2' } });
    fireEvent.change(inputs[2], { target: { value: '3' } });
    next();
    const [row] = onAdd.mock.calls[0][0];
    expect(row.pricing_unit).toBe('m2');
    expect(Number(row.calculated_quantity)).toBe(6);
    expect(row.room).toBe('all');
  });

  it('hours, days and kg are offered; a blank price is allowed ("not priced yet")', () => {
    const { onAdd } = open();
    fireEvent.change(screen.getByTestId('work-name'), { target: { value: 'Labour' } });
    next(); next();
    for (const m of ['Per item', 'Per m²', 'Per metre', 'Per hour', 'Per day', 'Per kg', 'One price for all the work']) expect(screen.getByRole('button', { name: m })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Per hour' }));
    fireEvent.change(screen.getByTestId('work-qty'), { target: { value: '8' } });
    next();
    expect(onAdd.mock.calls[0][0][0]).toMatchObject({ description: 'Labour', pricing_unit: 'hour', unit_price: '' });
  });

  it('Back (and Escape, the phone Back) goes one step back; on the first step it closes', () => {
    const { onClose } = open();
    fireEvent.change(screen.getByTestId('work-name'), { target: { value: 'Paint' } });
    next();
    fireEvent.keyDown(screen.getByTestId('work-item-dialog'), { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'What work would you like to add?' })).toBeTruthy();
    expect(screen.getByTestId('work-name').value).toBe('Paint');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('a catalog item fills the name, the price and its billing ("how is the price calculated")', () => {
    const { onAdd } = open({ services: [{ id: 's1', name: 'Window', price: 900, price_basis: 'linear_meter' }] });
    fireEvent.click(screen.getByRole('button', { name: /Window/ }));
    next();
    expect(screen.getByRole('button', { name: 'Per metre' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Per metre' }));
    fireEvent.change(screen.getByTestId('work-qty'), { target: { value: '4' } });
    next();
    expect(onAdd.mock.calls[0][0][0]).toMatchObject({ description: 'Window', pricing_unit: 'linear_meter', unit_price: '900' });
  });

  it('Hebrew: the same four questions in Hebrew, the calculator next to the price', () => {
    const onCalc = vi.fn();
    render(<WorkItemDialog open isHebrew services={[]} groupKind="apartment" onAdd={vi.fn()} onClose={vi.fn()} onOpenCalculator={onCalc} />);
    expect(screen.getByRole('heading', { name: 'איזו עבודה מוסיפים?' })).toBeTruthy();
    fireEvent.change(screen.getByTestId('work-name'), { target: { value: 'צבע' } });
    next();
    expect(screen.getByText('כל הדירה')).toBeTruthy();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'ליחידה' }));
    fireEvent.click(screen.getByTestId('work-calculator'));
    expect(onCalc).toHaveBeenCalled();
  });
});

describe('the places window', () => {
  it('apartment -> 2 -> identical yes = one apartment × 2; no = two apartments', () => {
    const onCreate = vi.fn();
    render(<PlacesDialog open isHebrew onCreate={onCreate} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'מה מוסיפים?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'דירה' }));
    fireEvent.click(screen.getByTestId('places-next'));
    expect(screen.getByRole('heading', { name: 'העבודות בדירות זהות?' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('places-identical-yes'));
    expect(onCreate).toHaveBeenCalledWith({ kind: 'apartment', count: 2, identical: true });
  });
  it('Escape goes one step back', () => {
    render(<PlacesDialog open isHebrew={false} onCreate={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Floor' }));
    fireEvent.keyDown(screen.getByTestId('places-dialog'), { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'What would you like to add?' })).toBeTruthy();
  });
  it('a number outside 1..20 is explained, nothing is created', () => {
    const onCreate = vi.fn();
    render(<PlacesDialog open isHebrew={false} onCreate={onCreate} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Room' }));
    fireEvent.change(screen.getByTestId('places-count'), { target: { value: '25' } });
    fireEvent.click(screen.getByTestId('places-next'));
    expect(screen.getByRole('alert').textContent).toBe('Choose a whole number from 1 to 20.');
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe.each([['HE', true, 'נשמרה. עדיין לא נשלחה.', ['כך הלקוח יראה', 'חזרה לעריכה', 'לרשימת ההצעות']],
  ['EN', false, 'Saved. Not sent yet.', ['Client view', 'Back to editing', 'Quote list']]])('%s saved screen', (_l, isHebrew, title, names) => {
  it('says it is saved and not sent, with three ways on', () => {
    const onPreview = vi.fn(); const onEdit = vi.fn(); const onList = vi.fn();
    render(<QuoteSavedScreen isHebrew={isHebrew} onPreview={onPreview} onEdit={onEdit} onList={onList} />);
    const scr = screen.getByTestId('quote-saved-screen');
    expect(within(scr).getByRole('heading').textContent).toBe(title);
    fireEvent.click(within(scr).getByRole('button', { name: names[0] }));
    fireEvent.click(within(scr).getByRole('button', { name: names[1] }));
    fireEvent.click(within(scr).getByRole('button', { name: names[2] }));
    expect([onPreview, onEdit, onList].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });
});

describe('the room of a work row in the editor', () => {
  it('a row added for the kitchen says so under it (HE / EN), with the place word for "all"', async () => {
    const { default: QuoteRowsEditor } = await import('./components/QuoteRowsEditor');
    const items = [{ description: 'ריצוף', quantity: '1', unit_price: '150', isFromCatalog: false, section_key: 's1', room: 'kitchen' },
      { description: 'צבע', quantity: '1', unit_price: '90', isFromCatalog: false, section_key: 's1', room: 'all' }];
    const common = { items, setItems: vi.fn(), keyStore: { map: new WeakMap(), seq: 0, focus: null }, services: [], sections: [{ key: 's1', name: 'דירה 1', kind: 'apartment' }], indices: [0, 1], showAdd: false };
    const { unmount } = render(<QuoteRowsEditor {...common} isHebrew />);
    const he = [...document.querySelectorAll('[data-testid^="qrow-room-"]')].map((el) => el.textContent);
    expect(he).toEqual(['איפה: מטבח', 'איפה: כל הדירה']);
    unmount();
    render(<QuoteRowsEditor {...common} isHebrew={false} />);
    expect([...document.querySelectorAll('[data-testid^="qrow-room-"]')].map((el) => el.textContent)).toEqual(['Where: Kitchen', 'Where: The whole apartment']);
  });
});
