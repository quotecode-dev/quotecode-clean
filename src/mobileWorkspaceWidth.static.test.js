// IRON-MOBILE-WIDTH-001 STATIC GATE. Structured source scan (no DOM). ONE authenticated mobile workspace ownership model (<=768px):
//   viewport -> .dash-main-content (--pf-mobile-workspace-inset: the ONLY outer gutter) -> FLAT .pf-work-screen (no surface, no inline
//   padding) -> primary card/surface (--pf-mobile-surface-pad: the ONLY inner padding).
// The former screen-card layer (--pf-mobile-screen-inset) is REMOVED; its return would re-stack a second outer gutter (Codex root cause).
// The real-browser geometry proof is e2e/mobile-workspace-width.gate.mjs (canonical 5186, 320/360/390/412, HE+EN, final card/text bounds).
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
  it('canonical tokens are defined once in index.css; the removed screen-inset layer does not exist anywhere', () => {
    const css = read('index.css');
    expect(css.match(/--pf-mobile-workspace-inset:\s*6px;/g)).toHaveLength(1);
    expect(css.match(/--pf-mobile-surface-pad:\s*10px;/g)).toHaveLength(1);
    expect(css).toMatch(/@media \(max-width: 768px\) \{\s*\.pf-m-surface \{\s*padding-inline: var\(--pf-mobile-surface-pad\) !important;/);
    for (const f of [...Object.values(WORK_SCREENS), 'index.css', 'pages/Dashboard.jsx', 'components/QuoteForm.jsx']) {
      expect(read(f), f).not.toMatch(/--pf-mobile-screen-inset/);
    }
  });

  it('the workspace wrapper owns the outer gutter and the work screen is FLAT on mobile', () => {
    const dash = read('pages', 'Dashboard.jsx');
    expect(dash).toMatch(/\.dash-main-content \{\s*padding: var\(--pf-mobile-workspace-inset, 6px\) !important;/);
    expect(dash).toMatch(/@media \(max-width: 768px\) \{\s*\.pf-work-screen \{\s*padding: 10px 0 0 !important;\s*background: transparent !important;\s*box-shadow: none !important;\s*border-radius: 0 !important;\s*\}/);
  });

  for (const [name, file] of Object.entries(WORK_SCREENS)) {
    it(`${name}: the screen root is a .pf-work-screen with no screen-owned mobile padding branch`, () => {
      const src = read(file);
      expect(src).toMatch(/className="pf-screen pf-work-screen( admin-screen)?"/);
      const root = src.slice(src.search(/className="pf-screen pf-work-screen/)).split('\n')[0];
      expect(root, file).not.toMatch(/padding: isMobileView \?/);
    });
  }

  it('primary surfaces inside screens carry the shared surface class (no second nested padding layer)', () => {
    expect(read('components/QuoteForm.jsx').match(/className="pf-m-surface" style=\{\{ background: NEON\.bgCard, border: `1px solid \$\{NEON\.border\}`, boxShadow: '0 1px 2px rgba\(15,23,42,0\.05\)', borderRadius: '16px', padding: '16px'/g)).toHaveLength(6);
    expect(read('components/FinancesTab.jsx').match(/className="pf-m-surface[^"]*"/g).length).toBeGreaterThanOrEqual(7);
    // KPI tiles: accent surfaces give back the extra border width, and their money figure fits the tile (container-relative size)
    expect(read('components/FinancesTab.jsx').match(/className="pf-m-surface pf-m-surface--accent pf-kpi-card"/g)).toHaveLength(4);
    expect(read('components/FinancesTab.jsx').match(/className="pf-money pf-kpi-money"/g)).toHaveLength(3);
    expect(read('index.css')).toMatch(/\.pf-m-surface\.pf-m-surface--accent \{\s*padding-inline-start: calc\(var\(--pf-mobile-surface-pad\) - 2px\) !important;/);
    expect(read('index.css')).toMatch(/\.pf-kpi-money \{\s*font-size: clamp\(0\.85rem, 10cqi, 1\.25rem\) !important;/);
    expect(read('components/SettingsTab.jsx').match(/className="pf-m-surface"/g)).toHaveLength(3);
    // list cards: the row button IS the padded layer and uses the same token
    expect(read('components/QuotesTab.jsx')).toMatch(/padding: '9px var\(--pf-mobile-surface-pad, 10px\)'/);
    expect(read('components/ClientsTab.jsx')).toMatch(/padding: '10px var\(--pf-mobile-surface-pad, 10px\)'/);
    // no screen may use the transparent dark-theme leftover as a surface (it vanishes once the screen card is flat)
    for (const f of ['components/FinancesTab.jsx', 'components/SettingsTab.jsx']) expect(read(f), f).not.toMatch(/background: 'rgba\(255,255,255,0\.03\)'/);
  });
});
