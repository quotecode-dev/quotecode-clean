// Iron numeric / bidi (Owner 23/11): a size from the AI or a file keeps its order - the line description is LTR-isolated around the size
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import AiQuoteDraftDialog from './components/AiQuoteDraftDialog';
afterEach(cleanup);
describe('sizes keep their order in the AI draft', () => {
  it('the description field holds the size inside an LTR isolate', async () => {
    const requestDraft = vi.fn(async () => ({ status: 'ok', contractVersion: 3, items: [{ description: 'החלפת חלונות 120×150 ס״מ', quantity: 3, unit: 'unit', quantityBasis: 'stated', unitPrice: null, priceSource: 'none' }], changes: [] }));
    render(<AiQuoteDraftDialog isOpen isHebrew requestDraft={requestDraft} onClose={() => {}} onApply={() => {}} sym="₪" formatMoneyDisplay={(n) => String(n)} />);
    const ta = document.querySelector('textarea'); fireEvent.change(ta, { target: { value: 'החלפת 3 חלונות 120 על 150' } });
    fireEvent.click(screen.getAllByRole('button').find((b) => /AI/.test(b.textContent)));
    await waitFor(() => expect(screen.getAllByTestId('ai-quote-draft-line').length).toBe(1));
    const input = screen.getByRole('textbox', { name: /תיאור|פריט/ });
    expect(input.value).toBe('החלפת חלונות ⁦120×150⁩ ס״מ');
  });
});
