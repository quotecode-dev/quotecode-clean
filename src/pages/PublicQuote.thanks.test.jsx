import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Task 27 (spec §6): the owner's thank-you appears ONLY in the signed (approved) state; before signing the signing panel is unchanged.
vi.mock('../shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }) },
}));

function quoteData(quote, thanks) {
  return {
    quote: { id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89', quote_number: 100701, tax_rate: 0.18, client_type: 'business', is_owner_viewing: false, subtotal: 1000, total: 1180, ...quote },
    business: { business_name: 'Synthetic Business' },
    client: { company_name: 'Synthetic Client' },
    items: [{ id: 'i1', description: 'Synthetic item', quantity: 1, unit_price: 1000, total_price: 1000 }],
    attachments: [],
    thanks,
  };
}
const THANKS = { text: 'תודה שבחרתם בנו!', website_url: 'https://example.test' };
const SIGNED = { status: 'approved', signature: 'data:image/png;base64,iVBORw0KGgo=' };

describe('public quote thank-you', () => {
  it('HE: shown after a signature with the opt-in link', () => {
    render(<MemoryRouter><PublicQuote quoteData={quoteData(SIGNED, THANKS)} /></MemoryRouter>);
    expect(screen.getByTestId('pq-thanks').textContent).toMatch(/תודה שבחרתם בנו!/);
    expect(screen.getByTestId('pq-thanks-website').textContent).toBe('לאתר העסק');
  });
  it('EN: shown after a signature (thanks from the host re-read wins)', () => {
    render(<MemoryRouter><PublicQuoteEn quoteData={quoteData({ ...SIGNED, tax_rate: 0, currency: 'USD' }, null)} thanks={{ text: 'Thank you!', website_url: null }} /></MemoryRouter>);
    expect(screen.getByTestId('pq-thanks').textContent).toBe('Thank you!');
    expect(screen.queryByTestId('pq-thanks-website')).toBeNull();
  });
  it('never before signing: the signing panel is shown as before', () => {
    render(<MemoryRouter><PublicQuote quoteData={quoteData({ status: 'sent', signature: null }, THANKS)} /></MemoryRouter>);
    expect(screen.queryByTestId('pq-thanks')).toBeNull();
    expect(screen.getByText('חתימת לקוח לאישור ההצעה:')).toBeInTheDocument();
  });
  it('Task 28: an output-grant document (final PDF / Print) never shows the thank-you, even if one is passed', () => {
    const data = { ...quoteData(SIGNED, THANKS), output_channel: 'final_pdf' };
    render(<MemoryRouter><PublicQuote quoteData={data} thanks={THANKS} /></MemoryRouter>);
    expect(screen.queryByTestId('pq-thanks')).toBeNull();
  });
  it('Task 28: the notice is excluded from html2canvas PDF capture and from native print', () => {
    render(<MemoryRouter><PublicQuote quoteData={quoteData(SIGNED, THANKS)} /></MemoryRouter>);
    const n = screen.getByTestId('pq-thanks');
    expect(n).toHaveAttribute('data-html2canvas-ignore', 'true');
    expect(n.className).toMatch(/no-print/);
  });
  it('Task 28: the refetch after signing stays on the SAME route and token (no token swap, no scope change)', () => {
    const src = fs.readFileSync(path.resolve(HERE, '../components/SmartPublicQuote.jsx'), 'utf8');
    const fn = src.slice(src.indexOf('const handleApproved = useCallback'), src.indexOf('}, [id, capabilityToken]);', src.indexOf('const handleApproved = useCallback')));
    expect(fn).toContain("supabase.functions.invoke('get-public-quote', { body: capabilityToken ? { capability_token: capabilityToken } : { quote_id: key } })");
    expect(fn).not.toMatch(/output_grant|public_approve/);
  });
  it('signed without any thank-you configured: nothing extra', () => {
    render(<MemoryRouter><PublicQuote quoteData={quoteData(SIGNED, null)} /></MemoryRouter>);
    expect(screen.queryByTestId('pq-thanks')).toBeNull();
  });
});
