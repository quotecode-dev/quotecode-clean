// Task 36 (Codex landing review L3 / L4 / L5): the public tools must never present a seed number as current data, must name the real
// source and the provider's own update time, must refuse invalid input instead of computing a value, and the closing CTA must lead to
// account creation in the page's language. Written to FAIL before the fix.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import PublicTools from './PublicTools.jsx';
import PublicToolsEn from './PublicToolsEn.jsx';

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname + l.search}</div>; };
const mount = (ui, path = '/he/tools') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="*" element={<>{ui}<Where /></>} /></Routes>
  </MemoryRouter>,
);
const memoryStorage = (seed = {}) => { const m = new Map(Object.entries(seed)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
// open.er-api.com v6 shape (base ILS for HE, USD for EN) + CoinGecko simple/price with include_last_updated_at
const ER_TIME = 1791763200; // 2026-10-12 00:00:00 UTC (provider time, not the fetch time)
const erILS = { result: 'success', provider: 'https://www.exchangerate-api.com', time_last_update_unix: ER_TIME, base_code: 'ILS',
  rates: { ILS: 1, USD: 0.27, EUR: 0.25, GBP: 0.21, CAD: 0.37, AUD: 0.41, CHF: 0.24, JPY: 40 } };
const erUSD = { result: 'success', provider: 'https://www.exchangerate-api.com', time_last_update_unix: ER_TIME, base_code: 'USD',
  rates: { USD: 1, EUR: 0.9, GBP: 0.75, ILS: 3.7, CAD: 1.36, AUD: 1.5, CHF: 0.86, JPY: 149 } };
const cg = { bitcoin: { usd: 60000, last_updated_at: ER_TIME + 60 }, ethereum: { usd: 3000, last_updated_at: ER_TIME + 60 } }; // no solana / ripple / tron
const fetchOk = (er) => vi.fn(async (url) => ({ ok: true, json: async () => (String(url).includes('er-api') ? er : cg) }));
const fetchDown = () => vi.fn(async () => { throw new Error('network down'); });

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('L3 - the closing CTA opens account creation in the page language', () => {
  it.each([['he', PublicTools, '/he/tools', '/dashboard?signup=true&lang=he'], ['en', PublicToolsEn, '/en/tools', '/dashboard?signup=true&lang=en']])('%s', async (_l, C, path, dest) => {
    vi.stubGlobal('fetch', fetchDown()); vi.stubGlobal('localStorage', memoryStorage());
    mount(<C />, path);
    fireEvent.click(screen.getByTestId('tools-cta'));
    expect(screen.getByTestId('where').textContent).toBe(dest);
  });
  it('there is a way back to the landing page of the same language', () => {
    vi.stubGlobal('fetch', fetchDown()); vi.stubGlobal('localStorage', memoryStorage());
    mount(<PublicTools />);
    expect(screen.getByTestId('tools-home').getAttribute('href')).toBe('/he');
  });
});

describe('L4 - data truth: no seed number shown as current, real source + provider time', () => {
  it('HE: providers down and no cache -> results say unavailable, never a number; no "live" wording', async () => {
    vi.stubGlobal('fetch', fetchDown()); vi.stubGlobal('localStorage', memoryStorage());
    mount(<PublicTools />);
    await waitFor(() => expect(screen.getByTestId('tools-feed-currency').textContent).toMatch(/אינם זמינים|לא זמינ/));
    expect(screen.getByTestId('tools-currency-result').textContent).not.toMatch(/\d/);
    expect(document.body.textContent).not.toMatch(/און-ליין|שערים חיים|בזמן אמת/);
    fireEvent.click(screen.getByRole('button', { name: /קריפטו/ }));
    expect(screen.getByTestId('tools-crypto-ils').textContent).not.toMatch(/\d/);
    expect(screen.getByTestId('tools-crypto-usd').textContent).not.toMatch(/\d/);
  });
  it('HE: a live answer shows the source and the PROVIDER update time (not the fetch time) and computes from it', async () => {
    vi.stubGlobal('fetch', fetchOk(erILS)); vi.stubGlobal('localStorage', memoryStorage());
    mount(<PublicTools />);
    await waitFor(() => expect(screen.getByTestId('tools-feed-currency').textContent).toMatch(/ExchangeRate-API/));
    expect(screen.getByTestId('tools-feed-currency').textContent).toMatch(/12\/10\/2026/);
    // 100 USD -> ILS with USD = 0.27 per ILS => 370.37
    expect(screen.getByTestId('tools-currency-result').textContent).toMatch(/370\.37/);
  });
  it('HE: a coin the provider did not return is unavailable (never the old fixed price)', async () => {
    vi.stubGlobal('fetch', fetchOk(erILS)); vi.stubGlobal('localStorage', memoryStorage());
    mount(<PublicTools />);
    fireEvent.click(screen.getByRole('button', { name: /קריפטו/ }));
    await waitFor(() => expect(screen.getByTestId('tools-feed-crypto').textContent).toMatch(/CoinGecko/));
    fireEvent.change(screen.getByLabelText(/מטבע קריפטו/), { target: { value: 'xrp' } });
    expect(screen.getByTestId('tools-crypto-usd').textContent).not.toMatch(/\d/);
    fireEvent.change(screen.getByLabelText(/מטבע קריפטו/), { target: { value: 'btc' } });
    expect(screen.getByTestId('tools-crypto-usd').textContent).toMatch(/60,000/);
  });
  it('EN: providers down but an older cache exists -> shown as stale with ITS data time', async () => {
    const cache = { proflow_tools_cache_en_v2: JSON.stringify({ currency: { rates: erUSD.rates, asOf: ER_TIME * 1000, source: 'ExchangeRate-API' }, fetchedAt: (ER_TIME - 7200) * 1000 }) };
    vi.stubGlobal('fetch', fetchDown()); vi.stubGlobal('localStorage', memoryStorage(cache));
    mount(<PublicToolsEn />, '/en/tools');
    await waitFor(() => expect(screen.getByTestId('tools-feed-currency').textContent).toMatch(/may be out of date|not current/i));
    expect(screen.getByTestId('tools-feed-currency').textContent).toMatch(/10\/12\/2026/);
    expect(screen.getByTestId('tools-currency-result').textContent).toMatch(/\d/);
  });
});

describe('L5 - invalid input is refused with a message, never a value', () => {
  it.each(['-1', '', '1e999', 'abc'])('HE metals weight %j', async (w) => {
    vi.stubGlobal('fetch', fetchOk(erILS)); vi.stubGlobal('localStorage', memoryStorage());
    mount(<PublicTools />);
    fireEvent.click(screen.getByRole('button', { name: /מתכות יקרות/ }));
    fireEvent.change(screen.getByLabelText(/משקל בגרמים/), { target: { value: w } });
    expect(screen.getByTestId('tools-metal-error').textContent.length).toBeGreaterThan(5);
    expect(screen.getByTestId('tools-metal-usd').textContent).not.toMatch(/\d/);
    expect(screen.getByTestId('tools-metal-ils').textContent).not.toMatch(/\d/);
  });
  it('EN currency amount -5 and crypto amount -1 are refused', async () => {
    vi.stubGlobal('fetch', fetchOk(erUSD)); vi.stubGlobal('localStorage', memoryStorage());
    mount(<PublicToolsEn />, '/en/tools');
    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: '-5' } });
    expect(screen.getByTestId('tools-currency-error')).toBeTruthy();
    expect(screen.getByTestId('tools-currency-result').textContent).not.toMatch(/\d/);
  });
  it('0 is a valid quantity (value 0), decimals are kept', async () => {
    vi.stubGlobal('fetch', fetchOk(erILS)); vi.stubGlobal('localStorage', memoryStorage());
    mount(<PublicTools />);
    fireEvent.click(screen.getByRole('button', { name: /מידות/ }));
    fireEvent.change(screen.getByLabelText(/ערך להמרה/), { target: { value: '0' } });
    expect(screen.queryByTestId('tools-units-error')).toBeNull();
    expect(screen.getByTestId('tools-units-result').textContent).toMatch(/^0/);
  });
});

describe('units and metals math', () => {
  it('1 m -> 100 cm, and the swap converts back (100 cm -> 1 m)', () => {
    vi.stubGlobal('fetch', fetchDown()); vi.stubGlobal('localStorage', memoryStorage());
    mount(<PublicTools />);
    fireEvent.click(screen.getByRole('button', { name: /מידות/ }));
    fireEvent.change(screen.getByLabelText(/יחידת יעד/), { target: { value: 'cm' } });
    expect(screen.getByTestId('tools-units-result').textContent).toMatch(/^100 /);
    fireEvent.click(screen.getByRole('button', { name: 'החלפת יחידות' }));
    fireEvent.change(screen.getByLabelText(/ערך להמרה/), { target: { value: '100' } });
    expect(screen.getByTestId('tools-units-result').textContent).toMatch(/^1 /);
  });
  it('24k = 99.9% fine gold: 10 g at the stated reference price is 10 x 0.999 x price (shown with its basis)', async () => {
    vi.stubGlobal('fetch', fetchOk(erUSD)); vi.stubGlobal('localStorage', memoryStorage());
    mount(<PublicToolsEn />, '/en/tools');
    fireEvent.click(screen.getByRole('button', { name: /Precious Metals/ }));
    const basis = screen.getByLabelText(/price per gram/i);
    expect(Number(basis.value)).toBe(75.6);
    expect(screen.getByTestId('tools-metal-usd').textContent).toMatch(/755\.24/);
    expect(within(screen.getByTestId('tools-metal-note')).getByText(/not a current market price/i)).toBeTruthy();
  });
});
