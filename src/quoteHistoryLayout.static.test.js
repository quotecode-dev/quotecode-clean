// IRON-QH-LAYOUT-001 STATIC GATE. The real-DOM proof is e2e/quote-history-collision.gate.mjs (canonical 5186, HE+EN, 1280/1440/1920 +
// 320/360/390/412, stress fixtures, >= 4px gaps). This scan keeps the ONE geometry source from silently regressing:
//   - header and body <colgroup>s are identical and read the SAME --qh-col-* variables (no hard-coded column widths)
//   - every semantic cell uses the shared QH_CELL_PAD inline padding (the old 12px amount padding is gone)
//   - both layouts tag the six protected semantic slots with data-qh (the gate's selectors)
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QH_CELL_PAD, QH_MIN_GAP } from './hooks/useQuoteHistoryGeometry';

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
    // Owner R3: the measured-slot transition (qhCompact) is kept and extended by the eight-column minimum width (r3TooNarrow).
    expect(qt).toMatch(/const useCards = isMobileView \|\| qhCompact \|\| r3TooNarrow;/);
    expect(qt).toMatch(/useQuoteHistoryGeometry\(screenRef,/);
  });
});

// Tablet list-room / visible-row PARITY with base c65f742 (Owner/Codex 2026-10-05, no tolerance).
const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8').split(String.fromCharCode(13)).join('');
describe('Quote History tablet density parity', () => {
  it('R25 rollback: no Task 16 status-count metrics anywhere (base c65f742 header structure, no tablet metric CSS)', () => {
    // (the approved quote-list-first overview intentionally reads allQuotes; only the retired metric machinery is guarded)
    expect(qt).not.toMatch(/qh-metrics|data-qh-metric|pf-qh-metric|QH_TABLET_QUERY|metricsInHeader|renderMetrics/);
    expect(css).not.toMatch(/qh-metrics|pf-qh-metric/);
  });
  it('row dividers and the 12px text floor never grow a list row beyond the base height', () => {
    const rule = css.match(/\.pf-work-screen\[data-qh-layout="table"\] \.pf-screen-body > table > tbody > tr > td \{([^}]*)\}/)[1];
    expect(rule).toMatch(/box-shadow: inset 0 -1px 0 #E1E6E7;/);
    expect(rule).not.toMatch(/border/);
    // table chip: 12px text on the base 13.44px line box; card chip 15.6px and card meta 16.8px line boxes (base 65.4px card)
    expect(qt).toMatch(/\.\.\.QH_CELL_STYLE\.status, lineHeight: '13\.44px'/);
    expect(qt).toMatch(/fontSize: '0\.75rem', lineHeight: '15\.6px', fontWeight: '700'/);
    expect(qt).toMatch(/fontSize: '0\.75rem', lineHeight: '16\.8px', color: NEON\.textMuted/);
  });
});

// Quote History usable room vs base c65f742 with an 8-DIGIT header revenue (Codex/TEST 2026-10-05) and the lead decisions
// from the A8 ledger (H02a/H02d/M03/M04/Q03). The real-DOM proof is scripts/task16/qa/layout-regression-gate.mjs (fixtures
// scripts/task16/qa/qh/fixtures.mjs, base geometry scripts/task16/qa/qh/base-c65f742.json).
const dash = fs.readFileSync(path.join(SRC, 'pages', 'Dashboard.jsx'), 'utf8').split(String.fromCharCode(13)).join('');
const badge = fs.readFileSync(path.join(SRC, 'components', 'PlanIdentityBadge.jsx'), 'utf8').split(String.fromCharCode(13)).join('');
const block = (src, q) => { const i = src.indexOf(`@media ${q} {`); expect(i, q).toBeGreaterThan(-1); return src.slice(i, src.indexOf('\n        }\n', i)); };
describe('greeting card room with an 8-digit revenue (no hidden value, no ellipsis, 12px floor)', () => {
  it('a wrapped stats line costs the 2px mobile row-gap, not an 18px inline gap', () => {
    expect(dash).toMatch(/className="dash-header-stats" style=\{\{ display: 'flex', alignItems: 'center', columnGap: '18px', flexShrink: 0 \}\}/);
    expect(dash).toMatch(/\.dash-header-stats \{\s*order: 3;[^}]*flex-wrap: wrap;\s*row-gap: 2px;[^}]*column-gap: 8px !important;/);
  });
  it('stats values stay complete: no ellipsis / overflow hidden / max-width on the revenue or count', () => {
    const stats = dash.slice(dash.indexOf('const statsRow = ('), dash.indexOf('return (', dash.indexOf('const statsRow = (')));
    // IRON-MARKET-004: the revenue renders per persisted quote currency (one token each), never one mixed {sym}{total}
    expect(stats).toMatch(/<CurrencyTotals className="dash-header-stat-value"[\s\S]*?totals=\{revenueTotals\}/);
    expect(stats).not.toMatch(/formatMoneyDisplay\(totalRevenue\)/);
    expect(stats).not.toMatch(/textOverflow|overflow: 'hidden'|maxWidth/);
    expect((stats.match(/fontWeight: '800'/g) || []).length).toBe(2); // H02a: base 800 values
  });
  it('phones: the one-row rules never set text below 12px and never hide a badge', () => {
    const b420 = block(dash, '(max-width: 420px)');
    expect(b420).toMatch(/\.dash-header-row > \.dash-header-title \{\s*font-size: 1\.125rem !important;/);
    expect(b420).not.toMatch(/display: none|visibility: hidden|text-overflow|font-size: 0\.[0-6]/);
    const b380 = block(dash, '(max-width: 380px)');
    expect(b380).toMatch(/\.dash-header-stat-value \{\s*font-size: 1rem !important;/);
  });
  it('12px usage / trial lines keep the base line boxes (no taller greeting card than base)', () => {
    expect(dash).toMatch(/fontSize: '0\.75rem', lineHeight: '14px', color: DARK_ACCENT\.amber/);
    expect(badge).toMatch(/fontSize: '0\.75rem', lineHeight: '12\.14px', fontWeight: 600/);
  });
  it('ledger: greeting title 800, sidebar weights base, no 184px tablet sidebar, hot-quote emphasis violet at >= 4.5:1 (#c4b5fd) and base BrandName footer', () => {
    expect(dash).toMatch(/fontSize: '1\.25rem',\s*fontWeight: '800',/);
    expect(dash).not.toMatch(/width: 184px/);
    const rule = (sel) => { const i = dash.indexOf(`        ${sel} {\n`); expect(i, sel).toBeGreaterThan(-1); return dash.slice(i, dash.indexOf('\n        }', i)); };
    expect(rule('.dash-sidebar-cta')).toMatch(/font-weight: 800;/);
    expect(rule('.dash-sidebar-btn')).toMatch(/font-weight: 600;/);
    expect(rule('.dash-sidebar-brand-name')).toMatch(/font-weight: 800;/);
    expect(rule('.dash-sidebar-avatar')).toMatch(/font-weight: 800;/);
    expect(dash).toMatch(/const purpleStrong = \{ color: '#c4b5fd', fontWeight: '800' \};/);
    expect(dash).toMatch(/מערכת <BrandName \/> - ניהול עסק והצעות מחיר/);
    // approved 980px dashboard: the title is a plain class-styled h2 (25px/700 on desktop, 1.2rem/800 base), no icon
    expect(qt).toMatch(/<h2 className="quote-workspace-title"/);
    expect(dash).toMatch(/\.quote-workspace-title \{ font-size: 1\.2rem; font-weight: 800;/);
    expect(qt).toMatch(/<tr style=\{\{ color: NEON\.textSecondary, fontSize: '0\.75rem', lineHeight: '16\.8px', textTransform: 'uppercase', letterSpacing: '0\.05em' \}\}>/);
  });
  it('the layout gate uses the 8-digit fixtures and judges room / rows / greeting / amounts / font / targets vs REAL base', async () => {
    const gate = fs.readFileSync(path.join(SRC, '..', 'scripts', 'task16', 'qa', 'layout-regression-gate.mjs'), 'utf8');
    for (const c of ['list-room-vs-base', 'visible-rows-vs-base', 'greeting-card-vs-base', 'amounts-complete', 'text-not-below-12px', 'touch-targets-not-shrunk', 'no-horizontal-overflow', 'no-status-count-metrics']) expect(gate).toContain(c);
    const { QH_VARIANTS, REV8_TOTAL } = await import('../scripts/task16/qa/qh/fixtures.mjs');
    expect(QH_VARIANTS).toEqual(expect.arrayContaining(['std', 'rev8', 'long8', 'basic8', 'free8', 'trial8']));
    expect(String(REV8_TOTAL)).toHaveLength(8);
    const base = JSON.parse(fs.readFileSync(path.join(SRC, '..', 'scripts', 'task16', 'qa', 'qh', 'base-c65f742.json'), 'utf8')).cells;
    for (const v of QH_VARIANTS) for (const l of ['he', 'en']) for (const vp of ['320x780', '360x780', '820x1180', '1180x820', '1280x800', '1440x900']) expect(base[`${v}/${l}/${vp}`]?.list, `${v}/${l}/${vp}`).toBeGreaterThan(0);
  });
});
