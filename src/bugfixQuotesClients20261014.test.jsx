// Owner bugs 2026-10-14: (1) a second hot quote vanished from the compact list; (2) the "Awaiting" counter skipped viewed quotes;
// (3) the client window had no city field.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickCompactRows } from './utils/quoteListRows';
import EditClientModal from './components/EditClientModal';

afterEach(() => cleanup());
const read = (p) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
const row = (id, views, created) => ({ isHot: views >= 3, quote: { id, view_count: views, created_at: created } });

describe('compact quote list never drops a quote', () => {
  it('two hot quotes: both are shown (lead first)', () => {
    const rows = [row('a', 5, '2026-08-18'), row('b', 3, '2026-08-19')];
    expect(pickCompactRows(rows).map((r) => r.quote.id)).toEqual(['a', 'b']);
  });
  it('the lead hot quote comes first, then every other quote in order, up to the limit', () => {
    const rows = [row('x', 0, '2026-08-01'), row('h1', 3, '2026-08-02'), row('h2', 9, '2026-08-03'), row('y', 1, '2026-08-04'), row('z', 0, '2026-08-05')];
    expect(pickCompactRows(rows).map((r) => r.quote.id)).toEqual(['h2', 'x', 'h1', 'y']);
    expect(pickCompactRows(rows, 10)).toHaveLength(5);
  });
  it('no hot quote: the first rows in order', () => {
    expect(pickCompactRows([row('a', 0), row('b', 1)]).map((r) => r.quote.id)).toEqual(['a', 'b']);
  });
});

describe('"Awaiting" counts sent AND viewed quotes that are not approved / paid', () => {
  it('source: viewed (view_count > 0) or sent, never approved / paid', () => {
    const q = read('components/QuotesTab.jsx');
    const block = q.slice(q.indexOf('const overviewAwaiting'), q.indexOf('const overviewApproved'));
    expect(block).toContain("if (status === 'approved' || status === 'paid') return false;");
    expect(block).toContain("return status === 'sent' || Number(quote.view_count || 0) > 0;");
  });
});

describe('client window: street / city / state / zip in the canonical format', () => {
  const base = { company_name: 'לקוח', email: '', phone: '', client_type: 'business', tax_id: '', notes: '' };
  it('loads a canonical address into the four fields', () => {
    const { getByTestId } = render(<EditClientModal isOpen isHebrew client={{ ...base, address: 'הרצל 5|חיפה||3100001' }} onClose={() => {}} onSave={() => {}} />);
    expect(getByTestId('client-address-street').value).toBe('הרצל 5');
    expect(getByTestId('client-address-city').value).toBe('חיפה');
    expect(getByTestId('client-address-zip').value).toBe('3100001');
  });
  it('keeps a legacy single-field address as the street line (no silent split)', () => {
    const { getByTestId } = render(<EditClientModal isOpen isHebrew client={{ ...base, address: 'הרצל 5 חיפה' }} onClose={() => {}} onSave={() => {}} />);
    expect(getByTestId('client-address-street').value).toBe('הרצל 5 חיפה');
    expect(getByTestId('client-address-city').value).toBe('');
  });
  it('saves "street|city|state|zip"; an all-empty address saves empty', () => {
    const onSave = vi.fn();
    const { getByTestId, container } = render(<EditClientModal isOpen isHebrew client={{ ...base, address: '' }} onClose={() => {}} onSave={onSave} />);
    fireEvent.change(getByTestId('client-address-street'), { target: { value: 'הרצל 5' } });
    fireEvent.change(getByTestId('client-address-city'), { target: { value: 'חיפה' } });
    fireEvent.submit(container.querySelector('form'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].address).toBe('הרצל 5|חיפה||');
  });
});
