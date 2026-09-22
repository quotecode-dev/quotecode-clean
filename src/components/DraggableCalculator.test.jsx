// Product Truth Registry defect fix (TEKANGO_AI_ARCHITECTURE.md v2.5 §52.3/§52.6): the calculator's
// FX fallback state used to be labelled "Live (Cached)" even when using hardcoded fallback rates
// (neither live nor a genuine cache). This locks in the truthful replacement wording.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DraggableCalculator from './DraggableCalculator.jsx';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DraggableCalculator — truthful FX fallback wording', () => {
  it('never renders the old misleading "Live (Cached)" label on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    render(<DraggableCalculator isOpen={true} onClose={() => {}} isHebrew={false} currency="USD" />);
    await waitFor(() => expect(screen.queryByText(/Live \(Cached\)/i)).toBeNull());
    expect(screen.getByText(/Fallback rates \(not live\)/i)).toBeTruthy();
    expect(screen.getByText(/Indicative rates \(not live/i)).toBeTruthy();
  });

  it('shows a genuine "Live rates" label only after a successful fetch, with a real timestamp (not the word "Cached")', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ rates: { USD: 1, EUR: 0.9, GBP: 0.78, ILS: 3.7 } }) }));
    render(<DraggableCalculator isOpen={true} onClose={() => {}} isHebrew={false} currency="USD" />);
    await waitFor(() => expect(screen.getByText(/Live rates from \$/i)).toBeTruthy());
    expect(screen.queryByText(/Cached/i)).toBeNull();
  });

  it('Hebrew fallback wording is also truthful, never "לא חי" omitted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    render(<DraggableCalculator isOpen={true} onClose={() => {}} isHebrew={true} currency="ILS" />);
    await waitFor(() => expect(screen.getByText(/שערים קבועים \(לא חי\)/)).toBeTruthy());
  });
});
