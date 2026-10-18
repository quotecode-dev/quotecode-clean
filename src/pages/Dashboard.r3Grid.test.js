import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Owner R3 correction (2026-10-08 18:55) - source guards for the desktop/tablet quote TABLE: eight separate tracks shared by the
// header and every row, list-only vertical scroll beginning directly below a fixed column-header row, per-column alignment and
// structural RTL/LTR mirroring. Rendered geometry (x coordinates, scroll ownership, font sizes) is proven separately by the real
// browser matrix in evidence/managed-dashboard-final/r3/.
const norm = (text) => text.split(String.fromCharCode(13)).join('');
const dashboard = norm(readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8'));
const quotesTab = norm(readFileSync(join(cwd(), 'src', 'components', 'QuotesTab.jsx'), 'utf8'));
const css = dashboard.replace(/\/\*[\s\S]*?\*\//g, '');
const desktop = css.slice(css.search(/@media \(min-width: 769px\) \{\s*\.dash-sidebar \{\s*width: 178px;/));
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&');
  const idx = desktop.search(new RegExp(`(^|\\n)\\s*${escaped} \\{`));
  expect(idx, selector).toBeGreaterThan(-1);
  return desktop.slice(idx, desktop.indexOf('}', idx));
};

describe('Owner R3/R4 seven-column grid (R4: no Action column)', () => {
  it('declares exactly seven tracks once and both the header row and the quote row consume that same variable and gap', () => {
    const cols = desktop.match(/--qm-cols: ([^;]+);/);
    expect(cols).not.toBeNull();
    const tracks = cols[1].match(/minmax\([^)]*\)/g);
    expect(tracks).toHaveLength(7);
    // R4: the quote-number track has a px floor wide enough for the full identifier (never ellipsized)
    expect(Number(tracks[0].match(/minmax\((\d+)px/)[1])).toBeGreaterThanOrEqual(84);
    expect((desktop.match(/--qm-cols:/g) || [])).toHaveLength(1);
    for (const sel of ['.quote-modern-row', '.quote-modern-head-row']) {
      expect(rule(sel)).toMatch(/grid-template-columns: var\(--qm-cols\);/);
      expect(rule(sel)).toMatch(/column-gap: var\(--qm-gap\);/);
    }
  });

  it('the header markup renders seven sortable headers in the row-cell order, without grouped header wrappers', () => {
    const keys = [...quotesTab.matchAll(/sortHeader\('([a-z_]+)'/g)].map((m) => m[1]);
    expect(keys).toEqual(['id', 'client', 'subject', 'status', 'views', 'created_at', 'total']);
    expect(quotesTab).not.toMatch(/sortHeader\('action'/);
    expect(quotesTab).not.toMatch(/quote-modern-head-(identity|state|text)/);
    expect(quotesTab).not.toMatch(/className="quote-modern-(identity|state|text|subject)"/);
  });

  it('per-column alignment: text columns start-aligned; views and amount are right-aligned LTR atoms with matching headers', () => {
    expect(rule('.quote-modern-head-cell')).toMatch(/justify-content: flex-start;/);
    expect(desktop).toMatch(/\.quote-modern-head-views,\s*\.quote-modern-head-total \{ justify-content: flex-end; direction: ltr; \}/);
    for (const sel of ['.quote-modern-row > .quote-modern-views', '.quote-modern-row > .quote-modern-amount']) {
      expect(rule(sel)).toMatch(/direction: ltr;/);
      expect(rule(sel)).toMatch(/unicode-bidi: isolate;/);
      expect(rule(sel)).toMatch(/text-align: right;/);
    }
    expect(desktop).toMatch(/\.quote-modern-client-name \{[^}]*text-align: start;/);
    expect(rule('.quote-modern-client')).toMatch(/text-align: start;/);
    expect(desktop).not.toMatch(/.quote-modern-head-action/); // R4: no Action header
  });

  it('client, title and status ellipsize on one line (title access via the title attribute)', () => {
    expect(desktop).toMatch(/\.quote-modern-title,\s*\.quote-modern-status,\s*\.quote-modern-client-name \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/);
    // R4: the quote number is never ellipsized or clipped
    expect(rule('.quote-modern-number')).toMatch(/overflow: visible;/);
    expect(rule('.quote-modern-number')).toMatch(/white-space: nowrap;/);
    expect(rule('.quote-modern-number')).not.toMatch(/text-overflow/);
    // the same exact '#'-free definition, now shared from utils/quoteListRows (Task 17 Statistics reuses it); QuotesTab imports it
    const listRows = norm(readFileSync(join(cwd(), 'src', 'utils', 'quoteListRows.js'), 'utf8'));
    expect(listRows).toMatch(/export const displayQuoteNumber = \(quote\) => String\(formatQuoteFallback\(quote\) \|\| ''\)\.replace\(\/\^#\/, ''\);/);
    expect(quotesTab).toMatch(/import \{[^}]*\bdisplayQuoteNumber\b[^}]*\} from '\.\.\/utils\/quoteListRows';/);
    expect(quotesTab).not.toMatch(/const displayQuoteNumber = /); // one definition only
    expect(quotesTab).not.toMatch(/>#\{formatQuoteFallback/);
    expect(quotesTab).toMatch(/className="quote-modern-title" title=\{subject\}/);
    expect(quotesTab).toMatch(/title=\{clientName\}/);
  });
});

describe('Owner R3 list-only scroll ownership', () => {
  it('in table layout the page scroller (.dash-main-content) does not scroll and the work screen shrinks to the remaining height', () => {
    expect(desktop).toMatch(/\.dash-main-content:has\(\.quote-workspace\[data-qh-layout="table"\]\) \{ overflow-y: hidden;/);
    expect(rule('.quote-workspace.pf-work-screen[data-qh-layout="table"]')).toMatch(/flex: 0 1 auto; min-height: 0;/);
    expect(quotesTab).toMatch(/data-qh-layout=\{useCards \? 'cards' : 'table'\}/);
  });

  it('the list card is a flex column; only .quote-modern-body scrolls; the column header is a fixed non-scrolling sibling before it', () => {
    const card = rule('.quote-workspace > .quote-modern-list');
    expect(card).toMatch(/display: flex;/);
    expect(card).toMatch(/flex-direction: column;/);
    expect(card).toMatch(/overflow: hidden;/);
    expect(card).toMatch(/min-height: 0;/);
    const body = rule('.quote-modern-body');
    expect(body).toMatch(/overflow-y: auto;/);
    expect(body).toMatch(/min-height: 0;/);
    expect(body).toMatch(/flex: 0 1 auto;/);
    const head = rule('.quote-modern-head');
    expect(head).toMatch(/flex: none;/);
    expect(head).toMatch(/overflow: hidden;/);
    // header precedes the scroll body in the DOM, and every row / Show all lives inside the body
    const headAt = quotesTab.indexOf('data-testid="quote-modern-head"');
    const bodyAt = quotesTab.indexOf('data-testid="quote-modern-body"');
    expect(headAt).toBeGreaterThan(-1);
    expect(bodyAt).toBeGreaterThan(headAt);
    expect(quotesTab.indexOf('className={`quote-modern-item')).toBeGreaterThan(bodyAt);
    // Owner 2026-10-18: the page bar (previous / next) is outside the scroll body, inside the card, so it never scrolls away
    expect(quotesTab).toContain('className="quote-modern-pager"');
    expect(quotesTab.indexOf('          {pager}')).toBeGreaterThan(bodyAt);
  });

  it('header and body reserve the identical scrollbar gutter so header cells and row cells keep one x coordinate', () => {
    for (const sel of ['.quote-modern-head', '.quote-modern-body']) {
      expect(rule(sel)).toMatch(/scrollbar-gutter: stable;/);
      expect(rule(sel)).toMatch(/scrollbar-width: thin;/);
    }
  });

  it('below the measured minimum width the list deliberately switches to cards instead of squeezing eight columns', () => {
    expect(quotesTab).toMatch(/const R3_TABLE_MIN_WIDTH = 740;/);
    expect(quotesTab).toMatch(/const useCards = isMobileView \|\| qhCompact \|\| r3TooNarrow;/);
    expect(quotesTab).toMatch(/setR3TooNarrow\(w > 0 && w < R3_TABLE_MIN_WIDTH\)/);
  });

  it('the list body outranks the shared no-shrink rule and the static blocks above it never shrink', () => {
    expect(desktop).toMatch(/\.quote-workspace > \.quote-modern-list > \.quote-modern-body,\s*\.quote-modern-body \{\s*flex: 0 1 auto;/);
    expect(desktop).toMatch(/\.quote-workspace\.pf-work-screen\[data-qh-layout="table"\] > :not\(\.quote-modern-list\) \{ flex-shrink: 0; \}/);
  });

  it('card layouts (mobile) keep their own scroll contract untouched', () => {
    expect(desktop).not.toMatch(/data-qh-layout="cards"/);
  });
});

describe('Owner R3 RTL/LTR mirroring', () => {
  it('the grid itself sets no direction and uses logical inline paddings/borders; physical sides appear only dir-scoped for the LTR numeric atoms', () => {
    for (const sel of ['.quote-modern-row', '.quote-modern-head-row']) {
      expect(rule(sel)).not.toMatch(/direction\s*:/);
      expect(rule(sel)).toMatch(/padding-inline:/);
    }
    expect(rule('.quote-modern-item')).toMatch(/border-inline-start: 4px solid transparent;/);
    // Owner update 2026-10-09: the hot row has no title tag any more - its signal is the logical inline-start orange edge
    expect(rule('.quote-modern-item.is-hot')).toMatch(/border-inline-start-color: #f66a25;/);
    expect(desktop).not.toMatch(/\.quote-modern-hot \{/);
    const physical = [...desktop.matchAll(/^\s*(\.quote-modern[^{]*)\{[^}]*\b(padding|margin)-(left|right):/gm)].map((m) => m[1].trim());
    for (const sel of physical) expect(sel, sel).toMatch(/^\.quote-modern-list\[dir="(rtl|ltr)"\]|^\.quote-modern-head-(total|views) \.quote-modern-head-btn/);
  });

  it('the list carries the real language direction and numeric cells are explicitly LTR-isolated', () => {
    expect(quotesTab).toMatch(/className="quote-modern-list pf-screen-body" data-testid="quote-modern-list" dir=\{tableDir\}/);
    expect(quotesTab).toMatch(/className="quote-modern-number pf-num" dir="ltr"/);
    expect(quotesTab).toMatch(/className="quote-modern-views pf-num" dir="ltr"/);
  });
});
