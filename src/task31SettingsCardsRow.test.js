// Task 31: the three Business-settings action cards share ONE row from 700px (desktop + both tablets); phones keep the approved
// one-card-per-row inline layout (flex: 1 1 260px + wrap) untouched. Live geometry: evidence/task31/render/cards-after/measure.json.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (p) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));

describe('Task 31 action cards row', () => {
  it('one row from 700px with equal columns; no rule below 700px', () => {
    const css = read('index.css');
    expect(css).toMatch(/@media \(min-width: 700px\) \{\n {2}\.pf-settings-entries \{ flex-wrap: nowrap !important; \}\n {2}\.pf-settings-entries > button \{ flex: 1 1 0 !important; \}\n\}/);
    expect(css.match(/\.pf-settings-entries/g)).toHaveLength(2);
  });
  it('the phone layout source is unchanged: wrap + flex 1 1 260px on the cards', () => {
    const s = read('components/SettingsTab.jsx');
    expect(s).toMatch(/className="pf-settings-entries" data-testid="settings-entries" style=\{\{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' \}\}/);
    expect(s).toMatch(/const entryStyle = \{ flex: '1 1 260px', minWidth: 0,/);
  });
});
