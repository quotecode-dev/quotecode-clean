import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../utils/quotePresentationClient', () => ({
  fetchPresentationContext: vi.fn().mockResolvedValue({ ok: true, data: { tier: 'classic', defaultStyle: null, catalog: {} } }),
  setDefaultStyle: vi.fn(), uploadPresentationMedia: vi.fn(), fetchMediaUrls: vi.fn().mockResolvedValue({ ok: true, data: { urls: {} } }),
  fetchQuotePresentation: vi.fn(), saveQuotePresentation: vi.fn(), issueQuotePresentation: vi.fn(), linkCatalogMedia: vi.fn(),
}));
// The real customer pages are owned/tested elsewhere; here only the props contract matters.
vi.mock('../../pages/PublicQuote', () => ({ default: (p) => <div data-testid="pq-he" data-preview={String(p.previewMode)} data-style={p.presentation?.style} data-total={p.quoteData.quote.total} /> }));
vi.mock('../../pages/PublicQuoteEn', () => ({ default: (p) => <div data-testid="pq-en" data-preview={String(p.previewMode)} data-style={p.presentation?.style} /> }));

import useQuotePresentationEditor, { __resetPresentationCachesForTests } from './useQuotePresentationEditor';
import QuoteCreatorLayout from './QuoteCreatorLayout';
import QuotePresentationPanel from './QuotePresentationPanel';
import { buildPreviewQuoteData } from './buildPreviewQuoteData';

function Harness({ currency = 'ILS' }) {
  const [p, setP] = useState({ style: null, media: [], detail: null });
  const [typed, setTyped] = useState('');
  const ctl = useQuotePresentationEditor({ userId: 'u1', isHebrew: currency === 'ILS', presentation: p, setPresentation: setP });
  const previewData = buildPreviewQuoteData({
    editor: { clientName: typed, currency, items: [{ description: 'Door', quantity: '1', unit_price: '10' }] },
    financials: { subtotal: 10, taxRate: 0, total: 10 },
    presentation: { style: ctl.shownStyle, presentation: p, mediaUrls: ctl.urls },
  });
  return (
    <QuoteCreatorLayout ctl={ctl} previewData={previewData}>
      <input data-testid="typed" value={typed} onChange={(e) => setTyped(e.target.value)} />
      <QuotePresentationPanel ctl={ctl} items={[]} />
    </QuoteCreatorLayout>
  );
}

beforeEach(() => { __resetPresentationCachesForTests(); });

describe('QuoteCreatorLayout + QuotePreviewPane', () => {
  it('narrow viewport: preview is a sheet; it renders the HE page in previewMode, Escape closes it and focus returns', async () => {
    window.innerWidth = 390;
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('qp-creator').dataset.layout).toBe('stack'));
    expect(screen.queryByTestId('qp-preview')).toBe(null);
    fireEvent.change(screen.getByTestId('typed'), { target: { value: 'Kav' } });
    const opener = screen.getByTestId('qp-open-preview');
    opener.focus();
    fireEvent.click(opener);
    const page = await screen.findByTestId('pq-he');
    expect(page.dataset.preview).toBe('true');
    expect(page.dataset.style).toBe('classic');
    expect(page.dataset.total).toBe('10');
    // device toggle is a width container: the editor value is untouched
    fireEvent.click(screen.getByTestId('qp-device-mobile'));
    expect(screen.getByTestId('qp-device-mobile').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-preview-device="mobile"]')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('qp-preview')).toBe(null));
    expect(document.activeElement).toBe(opener);
    expect(screen.getByTestId('typed').value).toBe('Kav');
  });

  it('a locked style preview carries a visible "preview only" label outside the document; EN market uses PublicQuoteEn', async () => {
    window.innerWidth = 390;
    render(<Harness currency="USD" />);
    await waitFor(() => expect(screen.getByTestId('qp-quote-style-locked-visual')).toBeTruthy());
    fireEvent.click(screen.getByTestId('qp-quote-style-select-visual'));
    fireEvent.click(await screen.findByTestId('qp-locked-preview'));
    const page = await screen.findByTestId('pq-en');
    expect(page.dataset.style).toBe('visual');
    expect(screen.getByTestId('qp-preview-only-label').textContent).toMatch(/Preview only/);
    expect(page.closest('[data-testid="qp-preview-only-label"]')).toBe(null);
  });
});
