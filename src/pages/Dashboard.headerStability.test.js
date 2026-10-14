import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Header height law (pre-LIVE): the Header never changes size because of
// alert text, alert state, or the greeting -> date/time swap.
const src = readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8');

describe('Header height stability (source guard)', () => {
  it('the title slot reserves the stacked date/time height in both compact layouts', () => {
    expect((src.match(/min-height: 34px/g) || []).length).toBeGreaterThanOrEqual(2);
  });
  it('the alert slot is a fixed 42px row in both states, with no expand-on-click growth', () => {
    expect((src.match(/height: '42px', boxSizing: 'border-box'/g) || []).length).toBe(2);
    expect(src).not.toContain('hotQuoteExpanded');
  });
  it('Admin has no Header height of its own', () => {
    expect(src).not.toMatch(/data-shell-context/);
    expect(src).not.toMatch(/dash-topbar-admin/);
  });
  it('the trial-warning banner is gone (no separate row/overlay under the Header); trial data still feeds the plan badge', () => {
    // Comments may still mention the removed banner for history; code must not.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('dash-trial-slidebar');
    expect(code).not.toContain('dash-trial-ticker-lane');
    expect(code).not.toContain('trialNoticeVisible');
    expect(src).toMatch(/daysLeft=\{/);
    expect(src).toContain('computeEffectivePlan');
  });
});
