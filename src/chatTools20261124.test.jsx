// Owner console 2026-11-24, typed: "מאשר ליישם במוצר את סקיצת הצבעים של הצ׳אט והכלים, ולשחרר עד הלייב" (sketch
// TEKANGO-sketch-chat-tools-2026-11-24-v2): the chat window light with the sidebar navy instead of the purple-pink, no icons in the landing
// chat's choice cards; the tools pages - headings, links and icons navy, the calculator tab row and every result box navy with white text.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AIChatWidget from './AIChatWidget.jsx';
import PublicTools from './components/PublicTools.jsx';
import PublicToolsEn from './components/PublicToolsEn.jsx';

const NAVY = 'rgb(16, 36, 68)';
const WHITE = 'rgb(255, 255, 255)';
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: () => null, length: 0 }; };
beforeEach(() => { Element.prototype.scrollTo = function scrollTo() {}; Element.prototype.scrollIntoView = function scrollIntoView() {}; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('the chat window - light, the sidebar navy instead of the purple-pink', () => {
  it('no purple-pink gradient and no dark body left in the widget source', () => {
    const src = readFileSync('src/AIChatWidget.jsx', 'utf8');
    expect(src).toContain("const CHAT_NAVY = '#102444';");
    expect(src).toMatch(/gradient: CHAT_NAVY/);
    expect(src).not.toMatch(/#8b5cf6|#ec4899|linear-gradient/i);
    expect(src).toMatch(/bg: '#F4F6F9', bgCard: '#FFFFFF'/);
  });
  it.each([['he', true], ['en', false]])('%s: the open window has a navy header, a light body and no card icons on the landing', (_l, he) => {
    render(<AIChatWidget isHebrew={he} isDashboard={false} />);
    fireEvent.click(document.querySelector('.ai-support-btn'));
    const pop = document.querySelector('.ai-chat-popup');
    expect(pop).toBeTruthy();
    expect(pop.style.background).toBe(WHITE);
    const header = pop.firstElementChild;
    expect(header.style.background).toBe(NAVY);
    const cards = [...pop.querySelectorAll('.ai-guided-card')];
    expect(cards.length).toBeGreaterThanOrEqual(4);
    for (const c of cards) expect(c.querySelector('svg')).toBeNull();
  });
});

describe('the tools pages - navy headings, tab row and result boxes', () => {
  it.each([['he', PublicTools, '/he/tools/units'], ['en', PublicToolsEn, '/en/tools/units']])('%s calculator', (_l, C, path) => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); })); vi.stubGlobal('localStorage', memoryStorage());
    render(<MemoryRouter initialEntries={[path]}><C initialTab="units" /></MemoryRouter>);
    expect(document.querySelector('h1').style.color).toBe(NAVY);
    const tabs = [...document.querySelectorAll('main button')].slice(0, 4);
    expect(tabs[0].parentElement.style.background).toBe(NAVY);
    for (const t of tabs) expect(t.style.color).toBe(WHITE);
    const result = screen.getByTestId('tools-units-result');
    expect(result.style.color).toBe(WHITE);
    expect(result.parentElement.style.background).toBe(NAVY);
    const h2 = document.querySelector('main h2');
    expect(h2.style.color).toBe(NAVY);
    expect(String(h2.style.fontWeight)).toBe('700');
  });
  it.each([['he', PublicTools, '/he/tools'], ['en', PublicToolsEn, '/en/tools']])('%s hub cards', (_l, C, path) => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); })); vi.stubGlobal('localStorage', memoryStorage());
    render(<MemoryRouter initialEntries={[path]}><C /></MemoryRouter>);
    const card = screen.getByTestId('tools-hub-card-units');
    expect(within(card).getByRole('heading').style.color).toBe(NAVY);
    expect(screen.getByTestId('tools-hub-open-units').style.color).toBe(NAVY);
    expect(screen.getByTestId('tools-home').style.color).toBe(NAVY);
  });
});
