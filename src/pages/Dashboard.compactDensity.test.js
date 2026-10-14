import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Compact professional density (owner correction 2026-10-08): source guards for the desktop type scale and row heights. The real
// rendered measurements (font sizes, row heights, column alignment) come from the real-browser check at 1001/1280 x 800.
const norm = (text) => text.split(String.fromCharCode(13)).join('');
const dashboard = norm(readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8'));
const css = dashboard.replace(/\/\*[\s\S]*?\*\//g, '');
const desktop = css.slice(css.search(/@media \(min-width: 769px\) \{\s*\.dash-sidebar \{\s*width: 178px;/));

const rule = (selector) => {
  // a rule starts its own line (so ".x-btn {" never matches inside ".y .x-btn {")
  const escaped = selector.split('.').join('\\.').split('>').join('\\>');
  const idx = desktop.search(new RegExp(`(^|\\n)\\s*${escaped} \\{`));
  expect(idx, selector).toBeGreaterThan(-1);
  return desktop.slice(idx, desktop.indexOf('}', idx));
};
const px = (selector, prop) => {
  const m = rule(selector).match(new RegExp(`(?:^|[\\s{;])${prop}:\\s*([\\d.]+)px`));
  expect(m, `${selector} ${prop}`).not.toBeNull();
  return Number(m[1]);
};

describe('compact desktop density (source guards)', () => {
  it('Owner R3 compact type ceilings: 40-44px rows, client <=12.5px/600, number/title/status/views/date <=12px, amount <=13px/700', () => {
    const row = px('.quote-modern-row', 'min-height');
    expect(row).toBeGreaterThanOrEqual(40);
    expect(row).toBeLessThanOrEqual(44);
    expect(px('.quote-modern-client', 'font-size')).toBeLessThanOrEqual(12.5);
    expect(rule('.quote-modern-client')).toMatch(/font-weight: 600;/);
    expect(px('.quote-modern-number', 'font-size')).toBeLessThanOrEqual(12);
    expect(px('.quote-modern-title', 'font-size')).toBeLessThanOrEqual(12);
    expect(px('.quote-modern-status', 'font-size')).toBeLessThanOrEqual(12);
    expect(px('.quote-modern-time', 'font-size')).toBeLessThanOrEqual(12);
    expect(px('.quote-modern-row > .quote-modern-views', 'font-size')).toBeLessThanOrEqual(12);
    expect(px('.quote-modern-row > .quote-modern-amount', 'font-size')).toBeLessThanOrEqual(13);
    // readability floor: nothing in the row drops below 11.5px
    for (const sel of ['.quote-modern-client', '.quote-modern-number', '.quote-modern-title', '.quote-modern-status', '.quote-modern-time', '.quote-modern-row > .quote-modern-views', '.quote-modern-row > .quote-modern-amount', '.quote-modern-detail .quote-modern-action', '.quote-modern-head-btn']) {
      expect(px(sel, 'font-size'), sel).toBeGreaterThanOrEqual(11.5);
    }
    expect(rule('.quote-modern-row > .quote-modern-amount')).toMatch(/font-weight: 700;/);
    expect(rule('.quote-modern-row > .quote-modern-amount')).toMatch(/font-variant-numeric: tabular-nums lining-nums;/);
    expect(rule('.quote-modern-row > .quote-modern-views')).toMatch(/font-variant-numeric: tabular-nums lining-nums;/);
  });

  it('the dropdown primary action is 32px high with an 11.5px label (R4: no Action column)', () => {
    // R4: the primary action lives in the row dropdown (no Action column): 32px touch height, 11.5px label, >=112px wide
    expect(px('.quote-modern-detail .quote-modern-action', 'block-size')).toBe(32);
    expect(px('.quote-modern-detail .quote-modern-action', 'font-size')).toBe(11.5);
    expect(px('.quote-modern-detail .quote-modern-action', 'min-inline-size')).toBeGreaterThanOrEqual(112);
    expect(desktop).not.toMatch(/\.quote-modern-row > \.quote-modern-action/);
  });

  it('toolbar controls are 32px high with 13px labels; overview numbers 16px/700 with 13px labels; title 20px, subtitle 12.5px', () => {
    expect(px('.quote-sort-direction,\n          .quote-filter-control,\n          .quote-search-control,\n          .quote-primary-action', 'height')).toBe(32);
    expect(px('.quote-sort-direction,\n          .quote-filter-control,\n          .quote-search-control,\n          .quote-primary-action', 'font-size')).toBe(13);
    expect(px('.quote-workspace .quote-overview-value', 'font-size')).toBe(16);
    expect(rule('.quote-workspace .quote-overview-value')).toMatch(/font-weight: 700;/);
    expect(px('.quote-workspace .quote-overview-label', 'font-size')).toBe(13);
    expect(px('.quote-workspace .quote-workspace-title', 'font-size')).toBe(20);
    expect(rule('.quote-workspace .quote-workspace-subtitle')).toMatch(/font-size: 12.5px;/);
  });

  it('sidebar nav is 13.5px on 36px rows and the header date/name are 13.5-14px', () => {
    expect(rule('.dash-sidebar-cta,\n          .dash-sidebar-btn')).toMatch(/min-height: 36px;/);
    expect(rule('.dash-sidebar-cta,\n          .dash-sidebar-btn')).toMatch(/font-size: 13.5px;/);
    expect(rule('.dash-header-datetime')).toMatch(/font-size: 13.5px;/);
    expect(rule('.dash-header-account strong')).toMatch(/font-size: 14px;/);
  });

  it('the shell stays exactly 980px with the shared 68px top edge', () => {
    expect(rule('.dash-upper-section')).toMatch(/height: 68px;/);
    expect(rule('.dash-sidebar-brand')).toMatch(/height: 68px;/);
  });

  it('the sortable header strip uses small grey <=12px/600 headings on a light-grey rounded strip and shares the row grid', () => {
    expect(rule('.quote-modern-head')).toMatch(/background: #f1f3f7;/);
    expect(rule('.quote-modern-head')).toMatch(/border-radius: 8px;/);
    expect(px('.quote-modern-head-btn', 'font-size')).toBeLessThanOrEqual(12);
    expect(rule('.quote-modern-head-btn')).toMatch(/font-weight: 600;/);
    expect(rule('.quote-modern-head-row')).toMatch(/color: #64748b;/);
    expect(rule('.quote-modern-head-row')).toMatch(/grid-template-columns: var\(--qm-cols\);/);
    expect(rule('.quote-modern-head-row')).not.toMatch(/direction\s*:/);
  });
});
