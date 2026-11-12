import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Owner R5 correction (2026-10-08 23:50) - source guards for the desktop/tablet quote TABLE: the dropdown trigger sits in the
// row's structural leading padding (logical inset, so right in HE and left in EN), outside the quote-number track; the header
// strip reserves the identical leading spacing; the quote number and the client name use the header label's alignment mode and
// 2px inline inset. The rendered x-anchors of the actual visible header labels and row content are proven by the real-browser
// matrix in evidence/managed-dashboard-final/r5/.
const norm = (text) => text.split(String.fromCharCode(13)).join('');
const dashboard = norm(readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8'));
const css = dashboard.replace(/\/\*[\s\S]*?\*\//g, '');
const desktop = css.slice(css.search(/@media \(min-width: 769px\) \{\s*\.dash-sidebar \{\s*width: 178px;/));
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&');
  const idx = desktop.search(new RegExp(`(^|\\n)\\s*${escaped} \\{`));
  expect(idx, selector).toBeGreaterThan(-1);
  return desktop.slice(idx, desktop.indexOf('}', idx));
};
const px = (block, prop) => {
  const m = block.match(new RegExp(`(?:^|[\\s;{])${prop}: ([^;]+);`));
  expect(m, prop).not.toBeNull();
  return m[1].trim().split(/\s+/).map((v) => parseFloat(v));
};

describe('Owner R5 leading-edge trigger and content alignment (CSS contract)', () => {
  it('the trigger is absolutely positioned on the logical inline-start edge (mirrors with dir), never a grid track', () => {
    const t = rule('.quote-modern-toggle');
    expect(t).toMatch(/position: absolute;/);
    expect(t).toMatch(/inset-inline-start: 3px;/);
    expect(t).not.toMatch(/(^|[\s;{])(left|right):/); // no physical side: HE right, EN left come from the list dir
    expect(px(t, 'inline-size')[0]).toBeGreaterThanOrEqual(24); // touch/pointer target
    expect(px(t, 'block-size')[0]).toBeGreaterThanOrEqual(24);
    expect(rule('.quote-modern-row')).toMatch(/position: relative;/);
    // still exactly seven tracks: the trigger takes none
    expect(desktop.match(/--qm-cols: ([^;]+);/)[1].match(/minmax\([^)]*\)/g)).toHaveLength(7);
  });

  it('the trigger fits inside the row leading padding, so it can never shift the quote-number track', () => {
    const [rowStart] = px(rule('.quote-modern-row'), 'padding-inline');
    const t = rule('.quote-modern-toggle');
    const [inset] = px(t, 'inset-inline-start');
    const [size] = px(t, 'inline-size');
    expect(inset + size).toBeLessThan(rowStart);
  });

  it('the header strip reserves the identical leading spacing (row 4px edge border + row padding = strip inset + strip padding)', () => {
    const [rowStart, rowEnd] = px(rule('.quote-modern-row'), 'padding-inline');
    const [headStart, headEnd] = px(rule('.quote-modern-head-row'), 'padding-inline');
    const margins = px(rule('.quote-modern-head'), 'margin'); // 8px 10px 4px: inline inset 10px
    const inset = margins[1];
    const [edge] = px(rule('.quote-modern-item'), 'border-inline-start');
    expect(inset + headStart).toBe(edge + rowStart);
    expect(inset + headEnd).toBe(rowEnd);
  });

  it('quote number and client name use the header label inset (sort button 2px) and start alignment in each direction', () => {
    const [, btnInline] = px(rule('.quote-modern-head-btn'), 'padding');
    expect(px(rule('.quote-modern-number'), 'padding-inline')).toEqual([btnInline]);
    const client = rule('.quote-modern-client');
    expect(px(client, 'padding')).toEqual([0, btnInline]);
    expect(client).toMatch(/text-align: start;/);
    // the client cell is plain content now: no chevron gap, no button chrome
    expect(client).not.toMatch(/gap:|cursor: pointer/);
    expect(desktop).not.toMatch(/\.quote-modern-client \{ display: flex;/);
    // the number is an LTR atom whose own "start" is left: the list dir puts it at the column start like its header label
    expect(desktop).toMatch(/\.quote-modern-list\[dir="rtl"\] \.quote-modern-row > \.quote-modern-number \{ text-align: right; \}/);
    expect(desktop).toMatch(/\.quote-modern-list\[dir="ltr"\] \.quote-modern-row > \.quote-modern-number \{ text-align: left; \}/);
    expect(rule('.quote-modern-head-cell')).toMatch(/justify-content: flex-start;/);
  });
});
