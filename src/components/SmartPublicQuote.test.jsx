import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Task 16: SmartPublicQuote fetches the optional presentation alongside get-public-quote, passes it to the page, never
// lets a presentation failure block the quote, and re-fetches it after a successful approval.
const { invokeMock, fetchPresentationMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  fetchPresentationMock: vi.fn(),
}));

vi.mock('../shared/supabase', () => ({
  supabase: { functions: { invoke: invokeMock }, rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../utils/quotePresentationClient', () => ({ fetchPublicPresentation: fetchPresentationMock }));
vi.mock('../pages/PublicQuote', () => ({
  default: ({ presentation, onApproved }) => (
    <div>
      <span data-testid="page">HE</span>
      <span data-testid="style">{presentation ? presentation.style : 'legacy'}</span>
      <button type="button" onClick={onApproved}>approve</button>
    </div>
  ),
}));
vi.mock('../pages/PublicQuoteEn', () => ({
  default: ({ presentation }) => (
    <div>
      <span data-testid="page">EN</span>
      <span data-testid="style">{presentation ? presentation.style : 'legacy'}</span>
    </div>
  ),
}));

import SmartPublicQuote from './SmartPublicQuote';

const QUOTE_ID = '00000000-0000-4000-8000-000000000001';
// הצעה גמורה (יש פריט עם מחיר); הצעה לא גמורה לא מגיעה לדף בכלל - ראו הבדיקה "הצעה לא גמורה" למטה
const dto = (quote, items = [{ id: 'i1', description: 'עבודה', quantity: 1, price: 1000, total_price: 1000 }]) => ({ data: { quote: { id: QUOTE_ID, tax_rate: 0.18, currency: 'ILS', total: 1180, subtotal: 1000, status: 'sent', ...quote }, business: {}, client: {}, items, attachments: [] }, error: null });

function renderAt(id = QUOTE_ID) {
  return render(
    <MemoryRouter initialEntries={[`/public-quote/${id}`]}>
      <Routes>
        <Route path="/public-quote/:id" element={<SmartPublicQuote />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  invokeMock.mockReset();
  fetchPresentationMock.mockReset();
});

// בעל המערכת 2026-10-18: "איזה משתמש ירצה שהלקוח שלו יראה הצעה לא גמורה?" -> "כן" (רק הודעה, בלי המסמך)
describe('הצעה לא גמורה: הלקוח רואה רק הודעה שהעסק מעדכן אותה', () => {
  it('עברית: אין מסמך, רק ההודעה', async () => {
    invokeMock.mockResolvedValue(dto({ total: 0, subtotal: 0 }, []));
    fetchPresentationMock.mockResolvedValue({ ok: false });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('public-quote-updating')).toBeInTheDocument());
    expect(screen.getByTestId('public-quote-updating')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading')).toHaveTextContent('העסק מעדכן את ההצעה הזו');
    expect(screen.getByText('תקבלו ממנו קישור מעודכן.')).toBeInTheDocument();
    expect(screen.queryByTestId('page')).toBeNull();
  });
  it('אנגלית: ההודעה באנגלית ומשמאל לימין', async () => {
    invokeMock.mockResolvedValue(dto({ tax_rate: 0, currency: 'USD', total: 0, subtotal: 0 }, []));
    fetchPresentationMock.mockResolvedValue({ ok: false });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('public-quote-updating')).toHaveAttribute('dir', 'ltr'));
    expect(screen.getByRole('heading')).toHaveTextContent('The business is updating this quote');
    expect(screen.queryByTestId('page')).toBeNull();
  });
  it('בעל העסק שפותח את ההצעה שלו ממשיך לראות את המסמך', async () => {
    invokeMock.mockResolvedValue(dto({ total: 0, subtotal: 0, is_owner_viewing: true }, []));
    fetchPresentationMock.mockResolvedValue({ ok: false });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('HE'));
    expect(screen.queryByTestId('public-quote-updating')).toBeNull();
  });
});

describe('SmartPublicQuote - Task 16 presentation wiring', () => {
  it('passes a valid presentation to the market page', async () => {
    invokeMock.mockResolvedValue(dto());
    fetchPresentationMock.mockResolvedValue({ ok: true, data: { mode: 'issued', style: 'modern', media: [] } });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('style')).toHaveTextContent('modern'));
    expect(fetchPresentationMock).toHaveBeenCalledWith(QUOTE_ID, null);
    expect(screen.getByTestId('page')).toHaveTextContent('HE');
  });

  it('a presentation failure renders the legacy Classic page (never blocks the quote)', async () => {
    invokeMock.mockResolvedValue(dto({ tax_rate: 0, currency: 'USD' }));
    fetchPresentationMock.mockResolvedValue({ ok: false, code: 'network_error', message: 'down' });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('EN'));
    expect(screen.getByTestId('style')).toHaveTextContent('legacy');
  });

  it('a thrown / malformed presentation is ignored too', async () => {
    invokeMock.mockResolvedValue(dto());
    fetchPresentationMock.mockResolvedValue({ ok: true, data: 'nope' });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('style')).toHaveTextContent('legacy'));
  });

  it('re-fetches the presentation after a successful approval (the server freezes the snapshot)', async () => {
    invokeMock.mockResolvedValue(dto());
    fetchPresentationMock.mockResolvedValueOnce({ ok: true, data: { mode: 'draft', style: 'visual', media: [] } });
    renderAt();
    await waitFor(() => expect(screen.getByTestId('style')).toHaveTextContent('visual'));
    fetchPresentationMock.mockResolvedValueOnce({ ok: true, data: { mode: 'issued', style: 'modern', media: [] } });
    fireEvent.click(screen.getByText('approve'));
    await waitFor(() => expect(screen.getByTestId('style')).toHaveTextContent('modern'));
    expect(fetchPresentationMock).toHaveBeenCalledTimes(2);
  });

  it('get-public-quote failure still shows the not-found state', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { context: { status: 404 } } });
    fetchPresentationMock.mockResolvedValue({ ok: false, code: 'not_found' });
    renderAt();
    // Owner package A 2026-10-14: one language (the page's own) - Hebrew unless <html lang="en">
    await waitFor(() => expect(screen.getByTestId('public-quote-not-found')).toBeInTheDocument());
    expect(screen.getByText('הצעת המחיר לא נמצאה או שפג תוקפה')).toBeInTheDocument();
    expect(screen.queryByText(/Quote not found/)).toBeNull();
  });
});
