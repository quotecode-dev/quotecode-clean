// IRON NUMERIC STATIC GATE. Structured source scan (no DOM): enforces the Iron Numeric Typography Law contract in
// TEKANGO_AI_ARCHITECTURE.md (§ Iron Numeric Typography Law). Every allowlist entry is a DOCUMENTED classified
// exception - adding one without a written reason + test is a change-control violation.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) out.push(full);
  }
  return out;
}
const files = walk(SRC);
const rel = (f) => path.relative(SRC, f).replace(/\\/g, '/');

describe('IRON NUMERIC STATIC GATE', () => {
  const css = read('index.css');

  it('.pf-money / .pf-num are tabular + lining, LTR-isolated (never proportional)', () => {
    for (const cls of ['.pf-money', '.pf-num']) {
      const start = css.search(new RegExp('^' + cls.replace('.', '[.]') + ' [{]', 'm'));
      const m = start < 0 ? null : css.slice(start).match(/[{]([^}]*)[}]/);
      expect(m, cls).toBeTruthy();
      expect(m[1]).toMatch(/font-variant-numeric:\s*tabular-nums lining-nums/);
      expect(m[1]).toMatch(/font-feature-settings:\s*"tnum" 1, "lnum" 1/);
      expect(m[1]).toMatch(/direction:\s*ltr/);
      expect(m[1]).toMatch(/unicode-bidi:\s*isolate/);
    }
  });

  it('.pf-money-slot is the protected physical axis: fixed inline size, LTR, right aligned, no shrink', () => {
    const m = css.match(/\n\.pf-money-slot \{([^}]*)\}/);
    expect(m).toBeTruthy();
    expect(m[1]).toMatch(/inline-size:\s*var\(--pf-money-slot-size,\s*[\d.]+em\)/);
    expect(m[1]).toMatch(/min-inline-size:/);
    expect(m[1]).toMatch(/flex:\s*0 0 /);
    expect(m[1]).toMatch(/direction:\s*ltr/);
    expect(m[1]).toMatch(/text-align:\s*right/);
    expect(m[1]).toMatch(/white-space:\s*nowrap/);
  });

  it('no proportional-figure feature anywhere in executable source (comments excluded)', () => {
    const bad = [];
    for (const f of files) {
      const code = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (/["']pnum["']|proportional-nums/.test(code)) bad.push(rel(f));
    }
    expect(bad).toEqual([]);
  });

  it('raw font-family stays inside the approved Rubik token set', () => {
    const bad = [];
    for (const f of files) {
      const code = fs.readFileSync(f, 'utf8');
      for (const m of code.matchAll(/fontFamily:\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g)) {
        const v = m[1] || m[2] || m[3];
        if (!/Rubik|inherit|var\(|monospace|Assistant|sans-serif|system-ui/.test(v)) bad.push(`${rel(f)}: ${v}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every .pf-money atom in JSX comes from a canonical formatter, not raw toFixed/toLocaleString/Intl', () => {
    // Classified fallback (documented): AddItemWizard prints total.toFixed(2) only when the parent passed no formatNum.
    const allow = new Set(['components/AddItemWizard.jsx']);
    const bad = [];
    for (const f of files.filter((x) => x.endsWith('.jsx'))) {
      if (allow.has(rel(f))) continue;
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((l, i) => { if (/pf-money|MoneyValue/.test(l) && /(toFixed|toLocaleString|Intl\.NumberFormat)\(/.test(l)) bad.push(`${rel(f)}:${i + 1}`); });
    }
    expect(bad).toEqual([]);
  });

  it('quote history amounts (mobile card + desktop row) use the MoneyValue slot - no independent auto-width flex amount', () => {
    const q = read('components/QuotesTab.jsx');
    expect((q.match(/<MoneyValue\s+slot/g) || []).length).toBe(2);
    expect(q).not.toMatch(/width:\s*'70px'/);
    expect(q).not.toMatch(/<span className="pf-money">\{quoteSym\}/);
  });

  it('independent flex space-between rows holding .pf-money need a documented exemption', () => {
    // Documented exemption: PublicQuoteEn totals card is ONE LTR container (English/International never RTL) - flex
    // end == physical right for every row, verified by the browser coordinate gate's totals-grid equivalent.
    const exempt = new Set(['pages/PublicQuoteEn.jsx']);
    const bad = [];
    for (const f of files.filter((x) => x.endsWith('.jsx'))) {
      if (exempt.has(rel(f))) continue;
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      let sb = -10;
      lines.forEach((l, i) => { if (/space-between/.test(l)) sb = i; if (/className="pf-money/.test(l) && i - sb <= 1) bad.push(`${rel(f)}:${i + 1}`); });
    }
    expect(bad).toEqual([]);
  });

  it('shared primitives exist and only add classes (no formatting/calculation)', () => {
    const p = read('components/NumericValue.jsx');
    expect(p).toMatch(/pf-num/);
    expect(p).toMatch(/pf-money-slot/);
    expect(p).not.toMatch(/toFixed|toLocaleString|Intl\.|Math\./);
  });
});
