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
  it('the header band no longer carries any alert slot (the hot-quote banner lives under the band, in the quotes workspace)', () => {
    expect(src).not.toContain('dash-hot-quote-alert');
    expect(src).not.toContain('hotQuoteExpanded');
  });
  it('Admin has no Header height of its own', () => {
    expect(src).not.toMatch(/data-shell-context/);
    expect(src).not.toMatch(/dash-topbar-admin/);
  });
  it('the trial-warning banner is gone (no separate row/overlay under the Header); the plan badge reads only the server account summary (OD-20)', () => {
    // Comments may still mention the removed banner for history; code must not.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('dash-trial-slidebar');
    expect(code).not.toContain('dash-trial-ticker-lane');
    expect(code).not.toContain('trialNoticeVisible');
    expect(code).not.toMatch(/daysLeft=\{/);
    expect(code).not.toContain('computeEffectivePlan');
    expect(code).not.toMatch(/monthlyQuotesCount|planLimit|monthlyQuoteLimit/);
    // Task 20 (Owner console instruction 2026-10-09): the plans status indicator is no longer in the mobile header; the plan state is
    // still read only from the server summary where it is shown (Business settings via accountStatusModel; PlanIdentityBadge component).
    expect(code).not.toMatch(/<PlanIdentityBadge/);
  });
  it('the mobile header cluster holds the notification bell in the former plans-indicator slot; the AI chat launcher is centered (Task 20 Continuation 2)', () => {
    const at = src.indexOf('<div className="dash-header-badge-mobile"');
    const cluster = src.slice(at, at + 900);
    expect(cluster).not.toContain('{renderHeaderAIChatButton()}');
    expect(cluster).toContain('<NotificationCenter');
    expect(cluster).toContain('variant="mobile"');
    expect(cluster).not.toContain('renderPlanBadge');
  });
});
