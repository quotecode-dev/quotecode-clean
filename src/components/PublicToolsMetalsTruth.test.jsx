// Product Truth Registry defect fix (TEKANGO_AI_ARCHITECTURE.md v2.5 §52.3/§52.6): the public
// metals calculator used fixed per-gram assumptions multiplied by a live USD/ILS rate, but was
// labelled as if backed by a live metals feed ("live rates" / "בזמן אמת" / "שערים חיים"). This locks
// in the truthful "estimate/indicative" wording for the metals tab specifically, while leaving the
// genuinely-live currency/crypto wording untouched.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicTools from './PublicTools.jsx';
import PublicToolsEn from './PublicToolsEn.jsx';

function withRouter(ui) {
  return <MemoryRouter>{ui}</MemoryRouter>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubQuietFetch() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
}

describe('Public metals calculator — truthful wording (HE)', () => {
  it('metals tab header never claims live rates, once the metals tab is open', () => {
    stubQuietFetch();
    render(withRouter(<PublicTools />));
    fireEvent.click(screen.getByText('מתכות יקרות'));
    expect(screen.queryByText(/שווי מתכות יקרות לפי שערים חיים/)).toBeNull();
    expect(screen.getByText(/הערכת שווי משוערת/)).toBeTruthy();
  });

  it('hero paragraph no longer claims real-time metals conversion', () => {
    stubQuietFetch();
    render(withRouter(<PublicTools />));
    expect(screen.queryByText(/מתכות יקרות וקריפטו בזמן אמת/)).toBeNull();
  });
});

describe('Public metals calculator — truthful wording (EN)', () => {
  it('metals tab header never says "Live Rates", once the metals tab is open', () => {
    stubQuietFetch();
    render(withRouter(<PublicToolsEn />));
    fireEvent.click(screen.getByText('Precious Metals'));
    expect(screen.queryByText(/Precious Metals Value Calculator \(Live Rates\)/)).toBeNull();
    expect(screen.getByText(/Precious Metals Value Estimator/)).toBeTruthy();
  });

  it('hero paragraph no longer lumps precious metals in with "live" conversions', () => {
    stubQuietFetch();
    render(withRouter(<PublicToolsEn />));
    expect(screen.queryByText(/live currency, unit, precious metals, and crypto conversions/)).toBeNull();
  });
});
