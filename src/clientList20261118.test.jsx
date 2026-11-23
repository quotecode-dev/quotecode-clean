// the simplify sketch (Owner 22/11): ONE client name field - saved clients that match show under it, each with its type; a pick fills the
// client. The existing-client list is gone. Private / Business is a switch ("פרטי" by default); an old quote with no type shows no side.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react';
import QuoteForm from './components/QuoteForm';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const t = { clientEmail: 'Client email', clientName: 'Client name', clientPhone: 'Client phone', currency: 'Currency', description: 'Description', discount: 'Discount', generateSave: 'Generate & Save', quantity: 'Quantity', quoteItems: 'Quote Items', status: 'Status', subtotal: 'Subtotal', totalAmount: 'Total', totalPrice: 'Total price', unitPrice: 'Unit price', updateQuote: 'Update Quote', validUntil: 'Valid until', vat: 'VAT' };
const props = (o = {}) => ({
  editingQuoteId: null, onSave: vi.fn((e) => e?.preventDefault?.()), onCancel: vi.fn(),
  clientName: '', setClientName: vi.fn(), clientEmail: '', setClientEmail: vi.fn(), clientPhone: '', setClientPhone: vi.fn(), clientType: 'business', setClientType: vi.fn(),
  clientTaxId: '', setClientTaxId: vi.fn(), clientAddress: '', setClientAddress: vi.fn(), quoteSubject: '', setQuoteSubject: vi.fn(), attnName: '', setAttnName: vi.fn(), attnRole: '', setAttnRole: vi.fn(),
  currency: 'ILS', quoteStatus: 'draft', setQuoteStatus: vi.fn(), validUntil: '', setValidUntil: vi.fn(), discount: 0, setDiscount: vi.fn(), terms: '', setTerms: vi.fn(), warranty: '', setWarranty: vi.fn(), notes: '', setNotes: vi.fn(),
  items: [{ description: 'Aluminum window', quantity: '1', unit_price: '300', isFromCatalog: false, section_key: null }], setItems: vi.fn(), sections: [], setSections: vi.fn(), addSection: vi.fn(), renameSection: vi.fn(), removeSection: vi.fn(),
  quoteStructureMode: 'regular', setQuoteStructureMode: vi.fn(), projectName: '', setProjectName: vi.fn(), services: [], clients: [], isHebrew: true, isLocalIsraeliBusiness: true, t, sym: '₪',
  formatNum: (n) => Number(n || 0).toFixed(2), formatMoneyDisplay: (n) => Number(n || 0).toFixed(2), subtotal: 300, discountAmount: 0, taxAmount: 0, totalAmount: 300,
  removeItem: vi.fn(), handleItemChange: vi.fn(), canUseAttachments: true, canUseProfessionalQuotes: true, duplicateItem: vi.fn(), canUseProfessionalQuoteReuse: true, quoteFiles: [], setQuoteFiles: vi.fn(), allUserAttachments: [],
  ...o,
});
const clients = [{ id: 'c1', company_name: 'Saved Co', client_type: 'business', email: 'x@y.co' }, { id: 'c2', company_name: 'Levi Family', client_type: 'private' }];
const en = { isLocalIsraeliBusiness: false, sym: '$', currency: 'USD' };
const nameField = () => document.getElementById('sq-client-name');
const step = (o) => props({ flowStep: 'client', onFlowStep: vi.fn(), clients, ...o });

describe('the client step of the simplify sketch (Owner 22/11)', () => {
  for (const [isHebrew, biz, priv, listName] of [[true, 'לקוח עסקי', 'לקוח פרטי', 'לקוחות שמורים'], [false, 'Business client', 'Private client', 'Saved clients']]) {
    it(`${isHebrew ? 'HE' : 'EN'}: no existing-client list; focus lists the saved clients with their type; a pick fills the client`, () => {
      const setClientName = vi.fn(); const setClientType = vi.fn(); const setClientEmail = vi.fn();
      render(<QuoteForm {...step({ isHebrew, setClientName, setClientType, setClientEmail, ...(isHebrew ? {} : en) })} />);
      expect(screen.queryByTestId('sq-client-existing')).toBeNull();
      expect(screen.queryByText(isHebrew ? 'רשימת הלקוחות' : 'Client list')).toBeNull();
      expect(screen.queryByText(isHebrew ? '+ הוספת לקוח חדש' : '+ Add a new client')).toBeNull();
      act(() => { nameField().focus(); });
      const list = screen.getByTestId('sq-client-suggest');
      expect(list.getAttribute('aria-label')).toBe(listName);
      expect(nameField().getAttribute('aria-expanded')).toBe('true');
      expect([...list.querySelectorAll('button')].map((b) => [b.firstChild.textContent, b.querySelector('small').textContent])).toEqual([['Levi Family', priv], ['Saved Co', biz]]);
      fireEvent.click(within(list).getByText('Saved Co'));
      expect(setClientName).toHaveBeenCalledWith('Saved Co'); expect(setClientType).toHaveBeenCalledWith('business'); expect(setClientEmail).toHaveBeenCalledWith('x@y.co');
      expect(screen.queryByTestId('sq-client-suggest')).toBeNull();
    });
  }
  it('typing filters; a single exact match shows no list', () => {
    render(<QuoteForm {...step({ clientName: 'lev' })} />);
    act(() => { nameField().focus(); });
    expect([...screen.getByTestId('sq-client-suggest').querySelectorAll('button')].map((b) => b.firstChild.textContent)).toEqual(['Levi Family']);
    cleanup();
    render(<QuoteForm {...step({ clientName: 'Saved Co' })} />);
    act(() => { nameField().focus(); });
    expect(screen.queryByTestId('sq-client-suggest')).toBeNull();
  });
  it('editing the name of a picked client releases it: details emptied, type kept', () => {
    const s = { setClientName: vi.fn(), setClientEmail: vi.fn(), setClientPhone: vi.fn(), setClientTaxId: vi.fn(), setClientAddress: vi.fn(), setClientType: vi.fn() };
    render(<QuoteForm {...step({ clientName: 'Saved Co', ...s })} />);
    fireEvent.change(nameField(), { target: { value: 'Saved Co 2' } });
    expect(s.setClientName).toHaveBeenCalledWith('Saved Co 2');
    for (const k of ['setClientEmail', 'setClientPhone', 'setClientTaxId', 'setClientAddress']) expect(s[k]).toHaveBeenCalledWith('');
    expect(s.setClientType).not.toHaveBeenCalled();
  });
  it('the switch: chosen side checked, thumb class; business opens the number; an old quote with no type has no side and must choose', () => {
    const setClientType = vi.fn();
    render(<QuoteForm {...step({ clientType: 'private', setClientType })} />);
    expect(screen.getByRole('radiogroup', { name: 'סוג הלקוח' }).className).toBe('qe-segc');
    expect(screen.getAllByRole('radio').map((r) => [r.textContent, r.getAttribute('aria-checked')])).toEqual([['פרטי', 'true'], ['עסקי', 'false']]);
    expect(screen.queryByTestId('sq-client-tax-id')).toBeNull();
    fireEvent.click(screen.getByTestId('sq-client-type-business'));
    expect(setClientType).toHaveBeenCalledWith('business');
    cleanup();
    render(<QuoteForm {...step({ clientType: 'business' })} />);
    expect(screen.getByRole('radiogroup').className).toBe('qe-segc biz');
    expect(screen.getByTestId('sq-client-tax-grow').contains(screen.getByTestId('sq-client-tax-id'))).toBe(true);
    cleanup();
    render(<QuoteForm {...step({ clientType: 'private', isHebrew: false, ...en })} />);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['Private', 'Business']);
    cleanup();
    render(<QuoteForm {...step({ clientType: '', clientName: 'Old Co' })} />);
    expect(screen.getByRole('radiogroup').className).toBe('qe-segc none');
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false']);
    fireEvent.click(screen.getByTestId('sq-client-continue'));
    expect(screen.getByTestId('sq-client-type-missing').textContent).toBe('בחרו לקוח פרטי או עסקי.');
  });
  it('a missing name: red edge + red placeholder, sentence for screen readers only, no bubble; typing clears it', () => {
    const onFlowStep = vi.fn();
    render(<QuoteForm {...step({ onFlowStep, clientName: '', clientType: 'private' })} />);
    fireEvent.click(screen.getByTestId('sq-client-continue'));
    expect(onFlowStep).not.toHaveBeenCalled();
    expect(nameField().className).toBe('qe-in qe-bad'); expect(nameField().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('הקלידו את שם הלקוח.'); expect(screen.getByRole('alert').className).toBe('sr-only');
    expect(screen.queryByTestId('sq-client-error')).toBeNull(); expect(document.querySelector('.qe-f > .qe-err')).toBeNull();
    fireEvent.change(nameField(), { target: { value: 'A' } });
    expect(nameField().className).toBe('qe-in');
  });
});
