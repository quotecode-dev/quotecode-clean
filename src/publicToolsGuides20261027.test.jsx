// Owner console 2026-10-27, typed: "מאשר תוכנית א לדפי המחשבונים" - the hub shows the four calculators as cards (no calculator of its own),
// every calculator page carries its own guide; Hebrew for Israel, English for the international market, each written on its own.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import PublicTools from './components/PublicTools.jsx';
import PublicToolsEn from './components/PublicToolsEn.jsx';
import { HUB_CARDS, TOOL_GUIDES } from './shared/publicToolsGuides';
import { UNIT_FACTORS, METAL_PURITY, CURRENCY_SOURCE, CRYPTO_SOURCE } from './utils/publicToolsCore';

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}</div>; };
const mount = (ui, path) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<>{ui}<Where /></>} /></Routes></MemoryRouter>);
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const offline = () => { vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); })); vi.stubGlobal('localStorage', memoryStorage()); };
const TOOLS4 = ['currency', 'units', 'metals', 'crypto'];
// every visible string (the values, never the field names or the card keys)
const strings = (v, key = '') => (typeof v === 'string' ? (key === 'key' ? [] : [v]) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => strings(x, k)) : []);
const textOf = (lang) => strings([HUB_CARDS[lang], TOOL_GUIDES[lang]]).join('\n');

describe('the hub: four cards, no calculator of its own', () => {
  it.each([['he', PublicTools, 'לפתיחת המחשבון'], ['en', PublicToolsEn, 'Open the calculator']])('%s', (lang, C, open) => {
    offline();
    mount(<C />, `/${lang}/tools`);
    expect(screen.getByTestId('tools-hub-cards')).toBeTruthy();
    expect(screen.queryByTestId('tools-currency-result')).toBeNull();
    for (const key of TOOLS4) {
      const a = screen.getByTestId(`tools-hub-open-${key}`);
      expect(a.getAttribute('href')).toBe(`/${lang}/tools/${key}`);
      expect(a.textContent).toBe(open);
    }
    fireEvent.click(screen.getByTestId('tools-hub-open-units'), { button: 0 });
    expect(screen.getByTestId('where').textContent).toBe(`/${lang}/tools/units`);
  });
});

describe('every calculator page: its calculator and its own guide', () => {
  it.each(TOOLS4.flatMap((t) => [['he', t], ['en', t]]))('%s %s', (lang, tool) => {
    offline();
    const C = lang === 'he' ? PublicTools : PublicToolsEn;
    mount(<C initialTab={tool} />, `/${lang}/tools/${tool}`);
    expect(screen.queryByTestId('tools-hub-cards')).toBeNull();
    const guide = screen.getByTestId(`tools-guide-${tool}`);
    expect(guide.textContent).toContain(TOOL_GUIDES[lang][tool].h2);
    expect(guide.querySelectorAll('ol li').length).toBeGreaterThanOrEqual(3);
    expect(guide.querySelectorAll('h3').length).toBe(1 + TOOL_GUIDES[lang][tool].faq.length);
    // the hub's general text is the hub's only
    expect(document.body.textContent).not.toMatch(lang === 'he' ? /כלים לעסקים שעובדים מול ספקים/ : /Tools for Businesses Working Across Borders/);
  });

  it('the four guides of a language differ from each other and from the hub', () => {
    for (const lang of ['he', 'en']) {
      const bodies = TOOLS4.map((t) => JSON.stringify(TOOL_GUIDES[lang][t]));
      expect(new Set(bodies).size).toBe(4);
    }
  });
});

describe('language and market: each written on its own, only true facts', () => {
  it('Hebrew has no English words except the named data sources; English has no Hebrew letters', () => {
    const he = textOf('he').replaceAll(CURRENCY_SOURCE, '').replaceAll(CRYPTO_SOURCE, '');
    expect(he).not.toMatch(/[A-Za-z]{2,}/);
    expect(textOf('en')).not.toMatch(/[֐-׿]/);
  });
  it('Israel examples speak shekels, international examples speak dollars / euros / feet', () => {
    expect(TOOL_GUIDES.he.currency.example.p).toMatch(/שקלים/);
    expect(TOOL_GUIDES.en.currency.example.p).toMatch(/dollars/);
    expect(TOOL_GUIDES.en.currency.example.p).not.toMatch(/shekel/i);
    expect(TOOL_GUIDES.en.units.example.p).toMatch(/feet/);
  });
  it('the numbers in the guides are the calculators\' own exact factors (never a rate or a price)', () => {
    expect(UNIT_FACTORS.ft).toBe(0.3048);
    expect(UNIT_FACTORS.in * 100).toBeCloseTo(2.54, 10);
    expect(UNIT_FACTORS.mi).toBe(1609.344);
    expect(12 * UNIT_FACTORS.ft).toBeCloseTo(3.6576, 10); // HE example
    expect((3.6 / UNIT_FACTORS.ft).toFixed(2)).toBe('11.81'); // EN example
    expect(METAL_PURITY.gold['14k']).toBe(0.585);
    expect(10 * METAL_PURITY.gold['14k']).toBeCloseTo(5.85, 10); // both metal examples
    for (const lang of ['he', 'en']) {
      expect(TOOL_GUIDES[lang].currency.source).toContain(CURRENCY_SOURCE);
      expect(TOOL_GUIDES[lang].crypto.source).toContain(CRYPTO_SOURCE);
      // no exchange rate, coin price or metal price is ever written as data
      expect(textOf(lang)).not.toMatch(/(₪|\$|€)\s?\d|\d\s?(₪|\$|€)|per gram is \d|לגרם הוא \d/);
    }
  });
});
