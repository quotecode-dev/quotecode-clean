// IRON-PUBLIC-001 / IRON-NUMERIC-001 / IRON-ILS-001 / IRON-MARKET-003 - the commercial item table on the public quote:
// which persisted item field lands in which cell, how each money cell is formatted per market, the reading order of the
// header in RTL and LTR, and the shared numeric axis. The 4-column geometry, the section disclosure and the mobile column
// overrides are proven in PublicQuote.structuredDisplay.test.jsx and are not repeated. Real pages, no mocked subject.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';

vi.mock('../shared/supabase', () => ({ supabase: { rpc: vi.fn() } }));
afterEach(cleanup);

const data = (items, quote = {}) => ({
  quote: { id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89', quote_number: 100701, status: 'sent', signature: null, tax_rate: 0.18, client_type: 'business',
    is_owner_viewing: false, subtotal: 1000, total: 1180, created_at: '2026-01-15T10:00:00.000Z', currency: 'ILS', ...quote },
  business: { business_name: 'Issuer Co' }, client: { company_name: 'Client Ltd' }, items, sections: [], attachments: [],
});
const table = (Page, items, quote) => render(<MemoryRouter><Page quoteData={data(items, quote)} /></MemoryRouter>).container.querySelector('.pq-commercial-table');
const he = (items, quote) => table(PublicQuote, items, quote);
const en = (items, quote) => table(PublicQuoteEn, items, { currency: 'USD', tax_rate: 0, total: 1000, ...quote });
const strip = (x) => x.replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
const rows = (t) => [...t.querySelectorAll('tbody > tr')].map((tr) => [...tr.children].map((td) => strip(td.textContent)));

describe('header cells: reading order and the numeric axis', () => {
  it('HE: description, quantity, unit price, total - in RTL DOM order, inside an RTL page', () => {
    const t = he([{ description: 'A', quantity: 1, price: 10, total_price: 10 }]);
    expect([...t.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['תיאור פריט', 'כמות', 'מחיר יחידה', 'סה"כ']);
    expect(t.closest('[dir]')).toHaveAttribute('dir', 'rtl');
  });
  it('EN: Description, Qty, Unit Price, Total - in LTR DOM order, inside an LTR page', () => {
    const t = en([{ description: 'A', quantity: 1, price: 10, total_price: 10 }]);
    expect([...t.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Description', 'Qty', 'Unit Price', 'Total']);
    expect(t.closest('[dir]')).toHaveAttribute('dir', 'ltr');
  });
  it('both directions keep money on ONE physical right edge (unit price + total right-aligned) and quantity centred', () => {
    for (const t of [he([{ description: 'A', quantity: 2, price: 10, total_price: 20 }]), en([{ description: 'A', quantity: 2, price: 10, total_price: 20 }])]) {
      const ths = t.querySelectorAll('thead th');
      const tds = t.querySelectorAll('tbody tr:first-child td');
      for (const i of [2, 3]) { expect(ths[i]).toHaveStyle({ textAlign: 'right' }); expect(tds[i]).toHaveStyle({ textAlign: 'right' }); }
      expect(ths[1]).toHaveStyle({ textAlign: 'center' });
      expect(tds[1]).toHaveStyle({ textAlign: 'center' });
      for (const td of [tds[2], tds[3]]) expect(td.querySelector('.pf-money')).not.toBeNull();
      cleanup();
    }
  });
});

describe('body cells: one row per persisted item, field -> cell', () => {
  it('HE: each item is one row (persisted order) of description / quantity / unit price / line total', () => {
    const t = he([{ description: 'Window', quantity: 2, price: 500, total_price: 1000 }, { description: 'Door', quantity: 1, price: 250, total_price: 250 }]);
    expect(rows(t)).toEqual([['Window', '2', '₪500.00', '₪1,000.00'], ['Door', '1', '₪250.00', '₪250.00']]);
  });
  it('HE / ILS: every money cell is a whole shekel on its own (unit 191.16 -> ₪191.00, line 382.32 -> ₪382.00)', () => {
    const t = he([{ description: 'Glass', quantity: 2, price: 191.16, total_price: 382.32 }, { description: 'Seal', quantity: 1, price: 0.5, total_price: 0.5 }]);
    expect(rows(t)).toEqual([['Glass', '2', '₪191.00', '₪382.00'], ['Seal', '1', '₪1.00', '₪1.00']]);
  });
  it('EN / International: money cells keep cents in the quote currency', () => {
    const t = en([{ description: 'Glass', quantity: 2, price: 191.16, total_price: 382.32 }], { currency: 'EUR' });
    expect(rows(t)).toEqual([['Glass', '2', '€191.16', '€382.32']]);
  });
  it('a line without a stored line total shows quantity x unit price (HE and EN)', () => {
    expect(rows(he([{ description: 'A', quantity: 3, price: 120.4 }]))[0].slice(2)).toEqual(['₪120.00', '₪361.00']);
    cleanup();
    expect(rows(en([{ description: 'A', quantity: 3, price: 120.4 }]))[0].slice(2)).toEqual(['$120.40', '$361.20']);
  });
  it('a plain item quantity is the stored count (not formatted as money); an item without a description still gets a label', () => {
    expect(rows(he([{ description: '', quantity: 7, price: 1, total_price: 7 }]))[0].slice(0, 2)).toEqual(['פריט', '7']);
    cleanup();
    expect(rows(en([{ description: null, quantity: 7, price: 1, total_price: 7 }]))[0].slice(0, 2)).toEqual(['Item', '7']);
  });
  it('HE: a quote with no item lines states one general amount across all four columns, in whole shekels', () => {
    const t = he([], { subtotal: 1040.4, total: 1227.6 });
    const cells = t.querySelectorAll('tbody td');
    expect(cells).toHaveLength(1);
    expect(cells[0]).toHaveAttribute('colspan', '4');
    expect(strip(cells[0].textContent)).toBe('הצעתמחירכלליתבסך1,228.00₪');
    // IRON-NUMERIC-001: the amount is an LTR-isolated tabular money atom like every other amount on the page
    expect(strip(cells[0].querySelector('.pf-money')?.textContent || '')).toBe('1,228.00');
  });
  it('the table never mixes markets: no ₪ in an International table, no $/€/£ in a Local one', () => {
    const items = [{ description: 'A', quantity: 1, price: 99.99, total_price: 99.99 }];
    expect(within(he(items)).queryAllByText(/[$€£]/)).toHaveLength(0);
    cleanup();
    expect(en(items, { currency: 'GBP' }).textContent).not.toContain('₪');
  });
  it('item cells are rendered as text, never as markup (a description with HTML stays literal)', () => {
    const t = he([{ description: '<img src=x onerror=alert(1)>', quantity: 1, price: 1, total_price: 1 }]);
    expect(t.querySelector('img')).toBeNull();
    expect(t.querySelector('tbody td').textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
