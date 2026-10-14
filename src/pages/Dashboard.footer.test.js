import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Mobile Workspace Priority Law (TEKANGO_AI_ARCHITECTURE.md §44) - source-level guard. Real geometry (footer height,
// no overlap with the bottom nav) is measured by the browser matrix; this locks the structure so it cannot regress.
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'Dashboard.jsx'), 'utf8');

describe('authenticated workspace footer (mobile compaction)', () => {
  it('keeps the accessibility entry point in both languages with the correct English label', () => {
    expect(src).toMatch(/הצהרת נגישות/);
    expect(src).toMatch(/'Accessibility Statement'/);
    expect(src).not.toMatch(/Assignment Statement/);
    expect(src).toMatch(/setShowAccessibility\(true\)/);
  });
  it('hides only the marketing tagline on mobile and leaves the single bottom inset to .dash-main-content', () => {
    expect(src).toMatch(/\.dash-footer-brand \{\s*display: none !important;/);
    expect(src).toMatch(/className="dash-footer-brand"/);
    expect(src).toMatch(/\.dash-footer \{\s*padding: 4px 12px 12px !important;/);
    expect(src).not.toMatch(/\.dash-footer \{\s*padding-bottom: 100px/);
  });
  // Task 33 (Owner: compact footer, not the removal of the branding): under the quotes table the brand line is shown again, on ONE row
  // with the accessibility link (real geometry is measured in the browser matrix).
  it('the quotes-table layout keeps the brand line, on one row with the accessibility link', () => {
    expect(src).not.toMatch(/data-qh-layout="table"\]\) \.dash-footer-brand \{ display: none/);
    expect(src).toMatch(/data-qh-layout="table"\]\) \.dash-footer \{\s*display: flex;\s*flex-wrap: wrap;\s*align-items: center;/);
  });
});
