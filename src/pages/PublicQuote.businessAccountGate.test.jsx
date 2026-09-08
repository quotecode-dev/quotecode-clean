import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';

// חוק ברזל (Signature Contract Fix, systemic remediation task): לפני התיקון,
// ה-RPC (public_approve_quote, 20260831000000) כבר חסם כל חשבון עסקי מחובר
// (לא רק בעלים) מלחתום כלקוח, אך ה-UI הסתיר את אזור החתימה רק מהבעלים
// המדויק (is_owner_viewing) - כך שחשבון עסקי *אחר* עדיין ראה את מסך החתימה
// המלא, יכול היה לצייר חתימה, ורק ב-Approve קיבל כשל גנרי מה-RPC. הבדיקות
// האלה נועדו לתפוס בדיוק את הפער הזה: מוודאות שהדגל caller_is_business_
// account (get-public-quote, מוחזר על גבי quote) חוסם את ה-UI *לפני* כניסה
// ל-canvas - לא רק שה-RPC (שממוקד/ ammocked כאן) חוסם בסוף.
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
      caller_is_business_account: false,
      ...overrides.quote,
    },
    business: { business_name: 'Test Business', ...overrides.business },
    client: { company_name: 'Test Client', ...overrides.client },
    items: [],
    attachments: [],
  };
}

describe('PublicQuote (HE) - business-account signing gate', () => {
  it('shows the full signing UI to an anonymous recipient (caller_is_business_account: false, is_owner_viewing: false)', () => {
    render(<MemoryRouter><PublicQuote quoteData={buildQuoteData()} /></MemoryRouter>);
    expect(screen.getByText('חתימת לקוח לאישור ההצעה:')).toBeInTheDocument();
    expect(screen.queryByText(/לא ניתן לחתום על הצעה זו מחשבון עסקי מחובר/)).not.toBeInTheDocument();
  });

  it('shows the admin-view message to the quote\'s own owner, not the business-blocked message', () => {
    const data = buildQuoteData({ quote: { is_owner_viewing: true, caller_is_business_account: true } });
    render(<MemoryRouter><PublicQuote quoteData={data} /></MemoryRouter>);
    expect(screen.getByText(/תצוגת מנהל/)).toBeInTheDocument();
    expect(screen.queryByText('חתימת לקוח לאישור ההצעה:')).not.toBeInTheDocument();
    expect(screen.queryByText(/לא ניתן לחתום על הצעה זו מחשבון עסקי מחובר/)).not.toBeInTheDocument();
  });

  it('blocks a DIFFERENT authenticated business account with a specific message and hides the signing canvas entirely (the exact reported bug)', () => {
    const data = buildQuoteData({ quote: { is_owner_viewing: false, caller_is_business_account: true } });
    render(<MemoryRouter><PublicQuote quoteData={data} /></MemoryRouter>);
    expect(screen.getByText(/לא ניתן לחתום על הצעה זו מחשבון עסקי מחובר/)).toBeInTheDocument();
    expect(screen.queryByText('חתימת לקוח לאישור ההצעה:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /אשר וחתום/ })).not.toBeInTheDocument();
  });
});

describe('PublicQuoteEn (EN) - business-account signing gate (symmetric with Hebrew)', () => {
  it('shows the full signing UI to an anonymous recipient', () => {
    render(<MemoryRouter><PublicQuoteEn quoteData={buildQuoteData()} /></MemoryRouter>);
    expect(screen.queryByText(/cannot be signed from a logged-in business account/)).not.toBeInTheDocument();
  });

  it('shows the admin-view message to the quote\'s own owner, not the business-blocked message', () => {
    const data = buildQuoteData({ quote: { is_owner_viewing: true, caller_is_business_account: true } });
    render(<MemoryRouter><PublicQuoteEn quoteData={data} /></MemoryRouter>);
    expect(screen.getByText(/Admin View/)).toBeInTheDocument();
    expect(screen.queryByText(/cannot be signed from a logged-in business account/)).not.toBeInTheDocument();
  });

  it('blocks a DIFFERENT authenticated business account with a specific message and hides the signing canvas entirely', () => {
    const data = buildQuoteData({ quote: { is_owner_viewing: false, caller_is_business_account: true } });
    render(<MemoryRouter><PublicQuoteEn quoteData={data} /></MemoryRouter>);
    expect(screen.getByText(/cannot be signed from a logged-in business account/)).toBeInTheDocument();
  });
});
