// Owner 2026-10-19 ("הקידומת אמורה להיות לפי הגדרות העסק אם המשתמש מלונדון אז קידומות של לונדון"): the client window's phone prefix
// follows the business (Israel = +972, otherwise its currency); a stored prefix is kept; saving another field never erases the phone.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import EditClientModal from './components/EditClientModal';
import { businessDial, storedDial } from './utils/phoneDial';

afterEach(cleanup);
const NEW = { company_name: '', email: '', phone: '', client_type: 'business', tax_id: '', address: '', notes: '' };
const prefixText = (container) => container.querySelector('input[placeholder="502345678"]').parentElement.textContent;
const submit = (container) => fireEvent.submit(container.querySelector('form'));

describe('client phone prefix (Owner 2026-10-19)', () => {
  it('the business prefix: Israel +972; otherwise by the business currency (never by the interface language)', () => {
    expect(businessDial({ isLocal: true, currency: 'ILS' }).dial).toBe('+972');
    expect(businessDial({ isLocal: false, currency: 'GBP' })).toEqual({ dial: '+44', label: 'GB (+44)' });
    expect(businessDial({ isLocal: false, currency: 'EUR' }).dial).toBe('+49');
    expect(businessDial({ isLocal: false, currency: 'USD' }).dial).toBe('+1');
    expect(businessDial({ isLocal: false, currency: null }).dial).toBe('+1');
  });

  it('a stored phone keeps its own prefix', () => {
    expect(storedDial('+44 20 7946 0958')).toEqual({ dial: '+44', label: 'GB (+44)', local: '20 7946 0958' });
    expect(storedDial('+1 416 555 0100', { currency: 'CAD' }).label).toBe('CA (+1)');
    expect(storedDial('0501234567')).toBeNull();
  });

  it('a new client of a London (GBP) business in English shows GB (+44); a Hebrew-interface Israeli business shows IL (+972)', () => {
    const uk = render(<EditClientModal isOpen isNew isHebrew={false} isIsraeliBusiness={false} currency="GBP" client={NEW} onClose={() => {}} onSave={() => {}} />);
    expect(prefixText(uk.container)).toContain('GB (+44)');
    uk.unmount();
    const il = render(<EditClientModal isOpen isNew isHebrew isIsraeliBusiness currency="ILS" client={NEW} onClose={() => {}} onSave={() => {}} />);
    expect(prefixText(il.container)).toContain('IL (+972)');
  });

  it('typing a number saves it with the business prefix', () => {
    const onSave = vi.fn();
    const { container } = render(<EditClientModal isOpen isNew isHebrew={false} currency="GBP" client={{ ...NEW, company_name: 'Acme Ltd' }} onClose={() => {}} onSave={onSave} />);
    fireEvent.change(container.querySelector('input[placeholder="502345678"]'), { target: { value: '20 7946 0958' } });
    submit(container);
    expect(onSave.mock.calls[0][0].phone).toBe('+44 20 7946 0958');
  });

  it('editing another field of an existing client keeps the stored phone (it was erased before)', () => {
    const onSave = vi.fn();
    const client = { ...NEW, id: 'c1', company_name: 'Noa', phone: '+972 501234567', client_type: 'private' };
    const { container } = render(<EditClientModal isOpen isHebrew isIsraeliBusiness currency="ILS" client={client} onClose={() => {}} onSave={onSave} />);
    submit(container);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].phone).toBe('+972 501234567');
  });

  it('a London client of a USD business keeps +44 in the window and on save', () => {
    const onSave = vi.fn();
    const client = { ...NEW, id: 'c2', company_name: 'Acme Ltd', phone: '+44 20 7946 0958' };
    const { container } = render(<EditClientModal isOpen isHebrew={false} currency="USD" client={client} onClose={() => {}} onSave={onSave} />);
    expect(prefixText(container)).toContain('GB (+44)');
    expect(container.querySelector('input[placeholder="502345678"]').value).toBe('20 7946 0958');
    fireEvent.change(container.querySelector('input[placeholder="502345678"]'), { target: { value: '20 7946 0000' } });
    submit(container);
    expect(onSave.mock.calls[0][0].phone).toBe('+44 20 7946 0000');
  });
});
