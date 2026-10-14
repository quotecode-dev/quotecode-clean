// Task 36 (Owner, section A): on the customer's document a line whose price was never entered reads "טרם תומחר" / "Not priced yet" -
// never ₪0.00 / $0.00 - and the total says it is partial. Independent of the D1 decision (confirm | block). Only a line flagged
// price_missing (from get-public-quote / the issued deal document) is affected: every existing document, an intentional 0 included, is
// unchanged. Written to FAIL before the fix.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';

vi.mock('../shared/supabase', () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ error: null }), functions: { invoke: vi.fn() } } }));

const data = (items, sections = [], quote = {}) => ({
  quote: { id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89', quote_number: 100701, status: 'draft', signature: null, tax_rate: 0.18, client_type: 'business', total: 1180, subtotal: 1000, discount: 0, currency: 'ILS', ...quote },
  business: { business_name: 'Test Business' }, client: { company_name: 'Test Client' }, items, sections, attachments: [],
});
const priced = { description: 'ריצוף', quantity: 10, price: 100, total_price: 1000 };
const missing = { description: 'פינוי פסולת', quantity: 1, price: 0, total_price: 0, price_missing: true };
const free = { description: 'מתנה', quantity: 1, price: 0, total_price: 0 };
const mount = (C, d) => render(<MemoryRouter><C quoteData={d} /></MemoryRouter>);
const rowOf = (text) => screen.getAllByRole('row').find((r) => r.textContent.includes(text));

describe('HE public quote', () => {
  it('a missing price line says "טרם תומחר" (no ₪0.00) and the total is marked partial', () => {
    mount(PublicQuote, data([priced, missing]));
    const row = rowOf('פינוי פסולת');
    expect(row.textContent).toContain('טרם תומחר');
    expect(row.textContent).not.toMatch(/₪0\.00/);
    expect(screen.getByTestId('pq-total-partial').textContent).toMatch(/חלקי/);
  });
  it('an intentional 0 and an ordinary quote are unchanged (no marker)', () => {
    mount(PublicQuote, data([priced, free]));
    expect(rowOf('מתנה').textContent).toMatch(/₪0\.00/);
    expect(screen.queryByText(/טרם תומחר/)).toBeNull();
    expect(screen.queryByTestId('pq-total-partial')).toBeNull();
  });
  it('inside an expanded section the flagged line says "טרם תומחר" too', () => {
    mount(PublicQuote, data([{ ...priced, section_id: 's1' }, { ...missing, section_id: 's1' }], [{ id: 's1', name: 'מטבח' }]));
    fireEvent.click(screen.getByRole('button', { name: /מטבח/ }));
    expect(rowOf('פינוי פסולת').textContent).toContain('טרם תומחר');
    expect(screen.getByTestId('pq-total-partial')).toBeTruthy();
  });
});

describe('EN public quote', () => {
  it('a missing price line says "Not priced yet" and the total is marked partial; an intentional 0 is unchanged', () => {
    mount(PublicQuoteEn, data([{ ...priced, description: 'Tiling' }, { ...missing, description: 'Debris removal' }, { ...free, description: 'Gift' }], [], { tax_rate: 0, currency: 'USD', total: 1000 }));
    expect(rowOf('Debris removal').textContent).toContain('Not priced yet');
    expect(rowOf('Debris removal').textContent).not.toMatch(/\$0\.00/);
    expect(rowOf('Gift').textContent).toMatch(/\$0\.00/);
    expect(screen.getByTestId('pq-total-partial').textContent).toMatch(/partial/i);
  });
});
