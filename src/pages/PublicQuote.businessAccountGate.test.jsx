import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';

// חוק ברזל (Signature Product/Security Contract Correction, systemic
// remediation continuation task, 2026-09-09): the prior fix (Signature
// Contract Fix) blocked ANY authenticated business account from signing,
// not just this quote's own owner - which created a real, Owner-reported
// product dead-end (a legitimate customer who also holds their own
// TEKANGO business account could never sign a quote sent to them,
// short of an incognito-window workaround). The RPC (public_approve_quote,
// 20260909000000) now blocks only this quote's exact own owner. These
// tests lock the CORRECTED contract: only is_owner_viewing hides the
// signing UI - a different business account (caller_is_business_account
// no longer even exists as a field) sees and can use the full signing UI,
// exactly like an anonymous recipient.
vi.mock('../shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }) },
}));

function buildQuoteData(overrides = {}) {
  return {
    quote: {
      id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89',
      quote_number: 100701,
      status: 'draft',
      signature: null,
      tax_rate: 0.18,
      client_type: 'business',
      is_owner_viewing: false,
      ...overrides.quote,
    },
    business: { business_name: 'Test Business', ...overrides.business },
    client: { company_name: 'Test Client', ...overrides.client },
    items: [],
    attachments: [],
  };
}

describe('PublicQuote (HE) - corrected owner-only signing gate', () => {
  it('shows the full signing UI to an anonymous recipient', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData()} /></MemoryRouter>);
    expect(screen.getByText('חתימת לקוח לאישור ההצעה:')).toBeInTheDocument();
  });

  it('shows the admin-view message to the quote\'s own owner, hiding the signing UI', () => {
    const data = buildQuoteData({ quote: { is_owner_viewing: true } });
    render(<MemoryRouter><PublicQuote quoteData={data} /></MemoryRouter>);
    expect(screen.getByText(/תצוגת מנהל/)).toBeInTheDocument();
    expect(screen.queryByText('חתימת לקוח לאישור ההצעה:')).not.toBeInTheDocument();
  });

  it('CORRECTED CONTRACT: a DIFFERENT authenticated business account (not this quote\'s owner) sees the full signing UI, exactly like an anonymous recipient - this is the exact scenario the Owner reported as a dead-end, now fixed', () => {
    const data = buildQuoteData({ quote: { is_owner_viewing: false } });
    render(<MemoryRouter><PublicQuote quoteData={data} /></MemoryRouter>);
    expect(screen.getByText('חתימת לקוח לאישור ההצעה:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /אשר וחתום/ })).toBeInTheDocument();
  });
});

describe('PublicQuoteEn (EN) - corrected owner-only signing gate (symmetric with Hebrew)', () => {
  it('shows the full signing UI to an anonymous recipient', () => {
    render(<MemoryRouter><PublicQuoteEn quoteData={buildQuoteData()} /></MemoryRouter>);
    expect(screen.getByText('Client Signature to Approve This Quote:')).toBeInTheDocument();
  });

  it('shows the admin-view message to the quote\'s own owner, hiding the signing UI', () => {
    const data = buildQuoteData({ quote: { is_owner_viewing: true } });
    render(<MemoryRouter><PublicQuoteEn quoteData={data} /></MemoryRouter>);
    expect(screen.getByText(/Admin View/)).toBeInTheDocument();
    expect(screen.queryByText('Client Signature to Approve This Quote:')).not.toBeInTheDocument();
  });

  it('CORRECTED CONTRACT: a DIFFERENT authenticated business account sees the full signing UI, exactly like an anonymous recipient', () => {
    const data = buildQuoteData({ quote: { is_owner_viewing: false } });
    render(<MemoryRouter><PublicQuoteEn quoteData={data} /></MemoryRouter>);
    expect(screen.getByText('Client Signature to Approve This Quote:')).toBeInTheDocument();
  });
});

// OD-9 (issuer-tenant members cannot sign; other-tenant TEKANGO users may) + OD-1 (display + enforce acceptance expiry).
describe('OD-9 + OD-1 public signing contract (HE Local + EN International)', () => {
  const past = '2020-01-13';
  const future = '2099-12-13';

  it('HE: an expired quote stays viewable but shows no signing UI - only the expired notice + header marker', () => {
    const data = buildQuoteData({ quote: { valid_until: past } });
    render(<MemoryRouter><PublicQuote quoteData={data} /></MemoryRouter>);
    expect(screen.getByTestId('pq-expired')).toHaveTextContent('תוקף הצעת המחיר הסתיים');
    expect(screen.queryByText('חתימת לקוח לאישור ההצעה:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /אשר וחתום/ })).not.toBeInTheDocument();
    expect(screen.getAllByTestId('pq-header-expired')[0]).toHaveTextContent('פג תוקף');
  });

  it('EN: an expired quote stays viewable but shows no signing UI', () => {
    const data = buildQuoteData({ quote: { valid_until: past, tax_rate: 0, currency: 'USD' } });
    render(<MemoryRouter><PublicQuoteEn quoteData={data} /></MemoryRouter>);
    expect(screen.getByTestId('pq-expired')).toHaveTextContent('This quote has expired');
    expect(screen.queryByText('Client Signature to Approve This Quote:')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('pq-header-expired')[0]).toHaveTextContent('Expired');
  });

  it('a quote before expiry keeps the full signing UI (HE + EN)', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData({ quote: { valid_until: future } })} /></MemoryRouter>);
    expect(screen.getByText('חתימת לקוח לאישור ההצעה:')).toBeInTheDocument();
    expect(screen.queryByTestId('pq-expired')).not.toBeInTheDocument();
  });

  it('server truth wins: is_expired=true blocks signing even with a future date', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData({ quote: { valid_until: future, is_expired: true } })} /></MemoryRouter>);
    expect(screen.getByTestId('pq-expired')).toBeInTheDocument();
  });

  it('a signed (approved) historical quote whose validity later passed shows the approval record, not "expired"', () => {
    const data = buildQuoteData({ quote: { valid_until: past, status: 'approved', signature: 'data:image/png;base64,iVBORw0KGgo=' } });
    render(<MemoryRouter><PublicQuote quoteData={data} /></MemoryRouter>);
    expect(screen.getByText(/אושרה ונחתמה בהצלחה/)).toBeInTheDocument();
    expect(screen.queryByTestId('pq-expired')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pq-header-expired')).not.toBeInTheDocument();
  });

  it('the issuer viewing its own expired quote gets the owner view + a hint to extend validity (never a signing UI)', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData({ quote: { valid_until: past, is_owner_viewing: true } })} /></MemoryRouter>);
    expect(screen.getByText(/תצוגת מנהל/)).toBeInTheDocument();
    expect(screen.getByTestId('pq-owner-expired-hint')).toHaveTextContent('תאריך התוקף');
    expect(screen.queryByRole('button', { name: /אשר וחתום/ })).not.toBeInTheDocument();
  });

  it('project_name is shown on the customer-facing header when set (HE + EN)', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData({ quote: { project_name: 'מגדל סינתטי' } })} /></MemoryRouter>);
    expect(screen.getAllByText(/פרויקט:\s*מגדל סינתטי/).length).toBeGreaterThan(0);
  });
});
