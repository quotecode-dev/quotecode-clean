// IRON-QH-LAYOUT-001 STATIC GATE. The real-DOM proof is e2e/quote-history-collision.gate.mjs (canonical 5186, HE+EN, 1280/1440/1920 +
// 320/360/390/412, stress fixtures, >= 4px gaps). This scan keeps the ONE geometry source from silently regressing:
//   - header and body <colgroup>s are identical and read the SAME --qh-col-* variables (no hard-coded column widths)
//   - every semantic cell uses the shared QH_CELL_PAD inline padding (the old 12px amount padding is gone)
//   - both layouts tag the six protected semantic slots with data-qh (the gate's selectors)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QH_CELL_PAD, QH_MIN_GAP, QH_ACTION_COL, QH_CLIENT_MIN, useQuoteHistoryGeometry } from './hooks/useQuoteHistoryGeometry';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const qt = fs.readFileSync(path.join(SRC, 'components', 'QuotesTab.jsx'), 'utf8').split(String.fromCharCode(13)).join('');

describe('IRON-QH-LAYOUT-001 static gate', () => {
  it('header and body share ONE column geometry source', () => {
    const cols = qt.match(/<colgroup>.*?<\/colgroup>/g);
    expect(cols).toHaveLength(2);
    expect(cols[0]).toBe(cols[1]);
    for (const v of ['--qh-col-number', '--qh-col-amount', '--qh-col-status', '--qh-col-date']) expect(cols[0]).toContain(v);
    expect(cols[0]).not.toMatch(/width: '(72|78|86|100)px'/);
  });
  it('semantic cells use the shared inline padding and the minimum gap contract holds by construction', () => {
    expect(QH_CELL_PAD * 2).toBeGreaterThanOrEqual(QH_MIN_GAP);
    expect(qt).not.toMatch(/padding: '11px 12px'/);
    expect((qt.match(/padding: `11px \$\{QH_CELL_PAD\}px`/g) || []).length).toBeGreaterThanOrEqual(5);
  });
  it('both layouts tag the protected semantic slots', () => {
    for (const k of ['action', 'client', 'number', 'amount', 'status', 'date']) expect((qt.match(new RegExp(`data-qh="${k}"`, 'g')) || []).length, k).toBeGreaterThanOrEqual(2);
  });
  it('the deliberate responsive transition exists (cards when the slots cannot fit)', () => {
    expect(qt).toMatch(/const useCards = isMobileView \|\| qhCompact;/);
  });
});

// Responsive transition, amount slots and the Owner-approved overview row (Task 39) - the geometry facts the real-DOM gate
// relies on, kept from regressing statically. The overview and header totals render one token per persisted currency
// (IRON-MARKET-004), so their containers must wrap instead of hiding or clipping a value.
const dash = fs.readFileSync(path.join(SRC, 'pages', 'Dashboard.jsx'), 'utf8').split(String.fromCharCode(13)).join('');
const overview = qt.slice(qt.indexOf('<div data-testid="quote-overview"'), qt.indexOf("'Total value')", qt.indexOf('<div data-testid="quote-overview"')));
describe('IRON-QH-LAYOUT-001 responsive transition, amount slots and overview row', () => {
  it('ONE mobile breakpoint drives both the first render and every later change (matchMedia change + resize, both removed)', () => {
    expect((qt.match(/window\.matchMedia\('\(max-width: 768px\)'\)/g) || []).length).toBe(3);
    expect(qt).not.toMatch(/matchMedia\('\(max-width: (?!768px)\d+px\)'\)/);
    expect(qt).toMatch(/mq\.addEventListener \? mq\.addEventListener\('change', recompute\)/);
    expect(qt).toMatch(/window\.addEventListener\('resize', recompute\);/);
    expect(qt).toMatch(/mq\.removeEventListener \? mq\.removeEventListener\('change', recompute\)/);
    expect(qt).toMatch(/window\.removeEventListener\('resize', recompute\);/);
  });
  it('rows and cards both place the amount in the protected physical-axis slot (one x axis for every amount)', () => {
    expect(qt).toMatch(/<MoneyValue slot data-qh="amount" symbol=\{quoteSym\} text=\{amountText\}/);
    expect(qt).toMatch(/<MoneyValue\s+slot\s+symbol=\{quoteSym\}\s+text=\{formatMoneyDisplay\(quote\.total, quote\.currency\)\}[\s\S]*?data-qh="amount"/);
  });
  it('the overview row mirrors with the list (dir={tableDir}) and wraps its cells instead of owning a horizontal scroll', () => {
    expect(overview.length).toBeGreaterThan(200);
    expect(overview).toMatch(/dir=\{tableDir\}/);
    expect(overview).toMatch(/flexWrap: 'wrap'/);
    expect((overview.match(/minWidth: 0/g) || []).length).toBe(2); // the three count cells (one template) + the total cell
    expect(overview).not.toMatch(/overflowX|overflow: 'auto'|overflow: 'scroll'|minWidth: '\d+px'/);
    expect(overview.indexOf('data-qh-overview={item.key}')).toBeLessThan(overview.indexOf('data-qh-overview="total"'));
  });
  it('the overview total never hides a currency token: it wraps anywhere, with no ellipsis, clipping, nowrap or max width', () => {
    const total = overview.slice(overview.indexOf('data-qh-overview="total"'));
    expect(total).toMatch(/<CurrencyTotals className="quote-overview-value" style=\{\{[^}]*overflowWrap: 'anywhere'[^}]*\}\}\s+totals=\{overviewTotals\}/);
    expect(total).not.toMatch(/textOverflow|ellipsis|overflow: 'hidden'|whiteSpace: 'nowrap'|maxWidth/);
  });
  it('the dashboard header revenue renders per persisted currency, complete: no single mixed {sym}{total}, no ellipsis / clipping / max width', () => {
    const start = dash.indexOf('const statsRow = (');
    expect(start).toBeGreaterThan(-1);
    const stats = dash.slice(start, dash.indexOf('return (', start));
    expect(stats).toMatch(/<CurrencyTotals style=\{\{[^}]*\}\}\s+totals=\{revenueTotals\}/);
    expect(stats).not.toMatch(/formatMoneyDisplay\(totalRevenue\)/);
    expect(stats).not.toMatch(/textOverflow|overflow: 'hidden'|maxWidth/);
  });
});

// The canonical geometry source itself (src/hooks/useQuoteHistoryGeometry.js), exercised as a hook. jsdom has no layout,
// so only the measurement edge is supplied: each probe span reports 7px per character, the host reports its width, and
// ResizeObserver is a recorder. Everything that decides the geometry is the real hook.
describe('IRON-QH-LAYOUT-001 measured slot geometry (the hook)', () => {
  const H = { headers: { number: 'Quote #', amount: 'Amount', status: 'Status', date: 'Date' } };
  const groups = { numbers: ['A100701', 'A100702'], amounts: ['1,227.00', '18,397.00'], statuses: ['Sent'], dates: ['01/15/2026'] };
  let observers; let restore;
  const host = (width) => { const el = document.createElement('div'); Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => width.value }); document.body.appendChild(el); return el; };
  beforeEach(() => {
    observers = [];
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function measure() { return { width: 7 * (this.textContent || '').length, height: 10, top: 0, left: 0, right: 0, bottom: 0 }; });
    const prevRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() { this.gone = true; } };
    restore = () => { rect.mockRestore(); globalThis.ResizeObserver = prevRO; document.body.innerHTML = ''; };
  });
  afterEach(() => restore());

  it('every protected column is sized to its widest real content or header (+ sort mark), plus the shared padding; the amount slot to the widest amount', () => {
    const el = host({ value: 1200 });
    renderHook(() => useQuoteHistoryGeometry({ current: el }, { enabled: true, ...groups, ...H }));
    const col = (k) => el.style.getPropertyValue(`--qh-col-${k}`);
    expect(col('number')).toBe(`${7 * 'Quote # ▲'.length + 1 + 2 * QH_CELL_PAD}px`); // header wider than 'A100701'
    expect(col('amount')).toBe(`${7 * '18,397.00'.length + 1 + 2 * QH_CELL_PAD}px`); // the widest amount wins
    expect(col('date')).toBe(`${7 * '01/15/2026'.length + 1 + 2 * QH_CELL_PAD}px`);
    expect(el.style.getPropertyValue('--pf-money-slot-size')).toBe(`${7 * '18,397.00'.length + 1}px`);
    expect(el.querySelector('[aria-hidden="true"]')).toBeNull(); // the measuring probe never stays in the page
  });

  it('cards replace the table exactly when the client column would get less than its minimum, and switch back on resize', () => {
    const fixed = QH_ACTION_COL + [7 * 'Quote # ▲'.length, 7 * '18,397.00'.length, 7 * 'Status ▲'.length, 7 * '01/15/2026'.length].reduce((s, w) => s + w + 1 + 2 * QH_CELL_PAD, 0);
    const width = { value: fixed + 16 + QH_CLIENT_MIN }; // exactly the minimum: still a table
    const el = host(width);
    const { result } = renderHook(() => useQuoteHistoryGeometry({ current: el }, { enabled: true, ...groups, ...H }));
    expect(result.current.compact).toBe(false);
    width.value -= 1;
    act(() => observers[0].cb());
    expect(result.current.compact).toBe(true);
    width.value += 1;
    act(() => observers[0].cb());
    expect(result.current.compact).toBe(false);
  });

  it('never forces the card layout when the list is not laid out, and measures nothing when disabled (the mobile card path)', () => {
    const unlaid = host({ value: 0 });
    expect(renderHook(() => useQuoteHistoryGeometry({ current: unlaid }, { enabled: true, ...groups, ...H })).result.current.compact).toBe(false);
    const off = host({ value: 50 });
    const { result } = renderHook(() => useQuoteHistoryGeometry({ current: off }, { enabled: false, ...groups, ...H }));
    expect(result.current.compact).toBe(false);
    expect(off.style.getPropertyValue('--qh-col-number')).toBe('');
    expect(observers.filter((o) => !o.gone)).toHaveLength(1); // only the laid-out host above is observed
  });
});
