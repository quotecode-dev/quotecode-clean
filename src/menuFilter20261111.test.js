// Owner 2026-11-11: (1) the English Send menu sits flush with its button's end (LIVE showed it ~7px inside because the page keeps a stable
// scrollbar gutter); (2) typed L-22: the admin users screen opens on the real accounts and "Clear" returns to them.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p), 'utf8').split(String.fromCharCode(13)).join('');

// Owner 2026-11-11 (unified quote release, typed L-07 / L-13 / L-19 / L-29): the Send button on every row was removed - sending is from
// the opened row again, as before PR #209
describe('uq1112: no Send button on the quote rows', () => {
  it('the list has no row Send menu and the menu component is gone', () => {
    const q = read('src/components/QuotesTab.jsx');
    expect(q).not.toMatch(/QuoteSendMenu|sendMenuFor/);
    expect(read('src/index.css')).not.toMatch(/.quote-send/);
  });
});

describe('menu1111: the admin users screen opens on the real accounts (typed L-22)', () => {
  const v = read('src/components/AdminUsersView.jsx');
  it('every default is the real accounts; Clear returns to them; an explicit intent (test accounts) still wins', () => {
    expect(v).toContain("test: intent.test || 'exclude', sort");
    expect(v).toContain("return saved || { market: 'all', status: 'all', test: 'exclude', sort");
    expect(v).toContain("const [testFilter, setTestFilter] = useState(init.test || 'exclude');");
    expect(v).toContain("setTestFilter('exclude'); setPage(0); };");
    expect(v).not.toMatch(/setTestFilter\('all'\)/);
    expect(v).not.toMatch(/test: 'all'/);
  });
});

describe('menu1111: admin Hebrew-English parity (typed L-21 + L-22)', () => {
  it('the phone sort list takes the full row; the "updated" line says Israel time in English too (every admin screen formats it in Israel time)', () => {
    expect(read('src/components/AdminUsersView.jsx')).toContain('<label className="av-field av-sort">');
    expect(read('src/components/adminV2.css')).toContain('.av-toolbar .av-sort { flex-basis: 100%; min-width: 0; }');
    const f = read('src/components/AdminScreenFrame.jsx');
    expect(f).toContain("· {isHebrew ? 'שעון ישראל' : 'Israel time'}</span>}");
    expect(f).not.toMatch(/'UTC'/);
  });
});
