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
const dto = (quote) => ({ data: { quote: { id: QUOTE_ID, tax_rate: 0.18, currency: 'ILS', ...quote }, business: {}, client: {}, items: [], attachments: [] }, error: null });

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
    await waitFor(() => expect(screen.getByText('Quote not found or expired.')).toBeInTheDocument());
  });
});
