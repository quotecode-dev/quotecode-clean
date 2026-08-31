import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Owner requirement (Hot Quote Fixed Geometry / No Layout Shift task): the
// Hot Quote card's rotating message must never drive the Dashboard's KPI-row
// height. Mounting the full Dashboard component here would require heavy
// Supabase/auth/routing mocks disproportionate to what this invariant needs
// (see PROFLOW_PROJECT_CONTEXT.md for the full-browser geometry verification
// this test complements, not replaces). This narrow source-level check
// guards against the specific regression that caused the original bug: the
// text column losing its reserved minHeight, or the message losing its
// line-clamp, which would make the card's height content-driven again.
const dashboardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Dashboard.jsx'),
  'utf-8',
);

function extractHotQuoteBlock(source) {
  const start = source.indexOf('dash-kpi-card dash-kpi-hot');
  const blockEnd = source.indexOf('</div>\n                  )}', start);
  return source.slice(start, blockEnd > start ? blockEnd : start + 1500);
}

describe('Hot Quote fixed geometry (source-level regression guard)', () => {
  const block = extractHotQuoteBlock(dashboardSource);

  it('reserves a fixed minHeight on the rotating text column', () => {
    expect(block).toMatch(/minHeight:\s*['"]52px['"]/);
  });

  it('clamps the rotating message to a fixed number of lines', () => {
    expect(block).toMatch(/WebkitLineClamp:\s*2/);
    expect(block).toMatch(/overflow:\s*['"]hidden['"]/);
  });
});
