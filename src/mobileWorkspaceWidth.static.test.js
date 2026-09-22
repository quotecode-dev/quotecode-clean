// IRON-MOBILE-WIDTH-001 STATIC GATE. Structured source scan (no DOM). Authenticated mobile work screens use exactly ONE canonical
// horizontal inset chain: viewport -> .dash-main-content (--pf-mobile-workspace-inset) -> .pf-work-screen card padding
// (--pf-mobile-screen-inset). The real-browser geometry proof is e2e/mobile-workspace-width.gate.mjs (320/360/390/412, HE+EN).
// A new nested gutter needs a documented exception + a test here AND in the browser gate.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8').split(String.fromCharCode(13)).join('');

const WORK_SCREENS = {
  QuotesTab: 'components/QuotesTab.jsx',
  ClientsTab: 'components/ClientsTab.jsx',
  FinancesTab: 'components/FinancesTab.jsx',
  ServicesCatalog: 'components/ServicesCatalog.jsx',
  SettingsTab: 'components/SettingsTab.jsx',
  AdminScreenFrame: 'components/AdminScreenFrame.jsx',
};

describe('IRON-MOBILE-WIDTH-001 static gate', () => {
  it('canonical tokens are defined once in index.css', () => {
    const css = read('index.css');
    expect(css.match(/--pf-mobile-workspace-inset:\s*6px;/g)).toHaveLength(1);
    expect(css.match(/--pf-mobile-screen-inset:\s*8px;/g)).toHaveLength(1);
  });

  it('the mobile workspace wrapper uses the workspace token and work screens use the screen token (<=768px)', () => {
    const dash = read('pages', 'Dashboard.jsx');
    expect(dash).toMatch(/\.dash-main-content \{\s*padding: var\(--pf-mobile-workspace-inset, 6px\) !important;/);
    expect(dash).toMatch(/@media \(max-width: 768px\) \{\s*\.pf-work-screen \{\s*padding-inline: var\(--pf-mobile-screen-inset, 8px\) !important;\s*\}/);
  });

  for (const [name, file] of Object.entries(WORK_SCREENS)) {
    it(`${name}: the screen card is a .pf-work-screen (no second, screen-specific mobile gutter)`, () => {
      expect(read(file)).toMatch(/className="pf-screen pf-work-screen( admin-screen)?"/);
    });
  }

  it('no work-screen root hard-codes a mobile padding other than the shared rule overrides', () => {
    // The inline desktop padding (18px) is overridden on mobile by the single !important rule above; a NEW mobile-only padding
    // branch (e.g. isMobileView ? '12px' : ...) would reintroduce a second, screen-owned gutter.
    for (const file of Object.values(WORK_SCREENS)) {
      const src = read(file);
      const root = src.slice(src.search(/className="pf-screen pf-work-screen/)).split('\n')[0];
      const mobilePad = root.match(/padding: isMobileView \? '(\d+)px'/);
      if (mobilePad) expect(mobilePad[1], file).toBe('8');
    }
  });
});
