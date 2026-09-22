// Product Truth Registry defect fixes (TEKANGO_AI_ARCHITECTURE.md v2.5 §52.3/§52.6, hardened
// 2026-09-22 for the Codex fail-open finding): the calculator's FX fallback state used to be
// labelled "Live (Cached)" even when using hardcoded fallback rates (neither live nor a genuine
// cache), and the fetch handler never checked `res.ok` nor validated the shape/values of
// `data.rates` - a non-OK response, missing rates, or malformed/non-numeric rates could silently
// leave stale state in place with no fallback flag ever set. This file locks in both the truthful
// wording AND the fail-closed validation for every real failure mode.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DraggableCalculator from './DraggableCalculator.jsx';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const VALID_RATES = { USD: 1, EUR: 0.9, GBP: 0.78, ILS: 3.7 };

function renderCalc(props = {}) {
  return render(<DraggableCalculator isOpen={true} onClose={() => {}} isHebrew={false} currency="USD" {...props} />);
}

describe('DraggableCalculator — truthful FX fallback wording', () => {
  it('never renders the old misleading "Live (Cached)" label on a thrown fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    renderCalc();
    await waitFor(() => expect(screen.queryByText(/Live \(Cached\)/i)).toBeNull());
    expect(screen.getByText(/Fallback rates \(not live\)/i)).toBeTruthy();
    expect(screen.getByText(/Indicative rates \(not live/i)).toBeTruthy();
  });

  it('shows a genuine "Live rates" label only after a successful, validated fetch, with a real timestamp (not the word "Cached")', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: VALID_RATES }) }));
    renderCalc();
    await waitFor(() => expect(screen.getByText(/Live rates from \$/i)).toBeTruthy());
    expect(screen.queryByText(/Cached/i)).toBeNull();
  });

  it('Hebrew fallback wording is also truthful, never "לא חי" omitted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    render(<DraggableCalculator isOpen={true} onClose={() => {}} isHebrew={true} currency="ILS" />);
    await waitFor(() => expect(screen.getByText(/שערים קבועים \(לא חי\)/)).toBeTruthy());
  });
});

describe('DraggableCalculator — fail-closed rate validation (Codex defect 4, 2026-09-22)', () => {
  it('initial render, before any fetch resolves, is never labelled live (fail-closed default)', () => {
    // A fetch that never resolves within this synchronous assertion window - the very first paint
    // must already show the fallback/indicative label, never "Live rates" for the hardcoded defaults.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderCalc();
    expect(screen.queryByText(/^Live rates from/i)).toBeNull();
    expect(screen.getByText(/Indicative rates \(not live/i)).toBeTruthy();
  });

  it('HTTP 4xx (res.ok=false) falls back, never shows live rates from the error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ rates: VALID_RATES }) }));
    renderCalc();
    await waitFor(() => expect(screen.getByText(/Fallback rates \(not live\)/i)).toBeTruthy());
    expect(screen.queryByText(/^Live rates from/i)).toBeNull();
  });

  it('HTTP 5xx (res.ok=false) falls back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'internal' }) }));
    renderCalc();
    await waitFor(() => expect(screen.getByText(/Fallback rates \(not live\)/i)).toBeTruthy());
  });

  it('malformed JSON body (res.json() throws) falls back, not left labelled live', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Unexpected token'); } }));
    renderCalc();
    await waitFor(() => expect(screen.getByText(/Fallback rates \(not live\)/i)).toBeTruthy());
  });

  it('missing rates field on an OK response falls back (the exact Codex fail-open case)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ base: 'USD' }) }));
    renderCalc();
    await waitFor(() => expect(screen.getByText(/Fallback rates \(not live\)/i)).toBeTruthy());
    expect(screen.queryByText(/^Live rates from/i)).toBeNull();
  });

  it('rates present but a required currency is a non-numeric string falls back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { ...VALID_RATES, EUR: 'oops' } }) }));
    renderCalc();
    await waitFor(() => expect(screen.getByText(/Fallback rates \(not live\)/i)).toBeTruthy());
  });

  it('rates present but a required currency is zero/negative/non-finite falls back', async () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { ...VALID_RATES, GBP: bad } }) }));
      const { unmount } = renderCalc();
      await waitFor(() => expect(screen.getByText(/Fallback rates \(not live\)/i)).toBeTruthy());
      unmount();
    }
  });

  it('rates missing a required currency entirely falls back', async () => {
    // eslint-disable-next-line no-unused-vars -- destructured only to exclude it below
    const { ILS, ...withoutIls } = VALID_RATES;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: withoutIls }) }));
    renderCalc();
    await waitFor(() => expect(screen.getByText(/Fallback rates \(not live\)/i)).toBeTruthy());
  });

  it('a fully valid response is accepted as live and never shown as fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: VALID_RATES }) }));
    renderCalc();
    await waitFor(() => expect(screen.getByText(/^Live rates from/i)).toBeTruthy());
    expect(screen.queryByText(/Fallback rates \(not live\)/i)).toBeNull();
  });
});
