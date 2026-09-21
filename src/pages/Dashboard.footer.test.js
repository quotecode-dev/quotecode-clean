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
  it('hides only the marketing tagline on mobile and keeps a small bottom reserve', () => {
    expect(src).toMatch(/\.dash-footer-brand \{\s*display: none !important;/);
    expect(src).toMatch(/className="dash-footer-brand"/);
    expect(src).toMatch(/\.dash-footer \{\s*padding: 4px 12px calc\(44px \+ env\(safe-area-inset-bottom, 0px\)\) !important;/);
    expect(src).not.toMatch(/\.dash-footer \{\s*padding-bottom: 100px/);
  });
});
