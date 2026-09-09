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
