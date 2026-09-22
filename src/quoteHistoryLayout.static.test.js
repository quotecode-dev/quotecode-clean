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
    expect(qt).toMatch(/const useCards = isMobileView \|\| qhCompact;/);
  });
});
