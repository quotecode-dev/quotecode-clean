import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Admin EN requirement (no International persona exists): static regression
// that no Admin source hardcodes Hebrew user-visible copy outside an
// isHebrew/{he,en} switch, and that direction comes from the shell, not
// from a hardcoded rtl/ltr.
const dir = join(cwd(), 'src', 'components');
const adminFiles = readdirSync(dir).filter((f) => /^Admin.*\.jsx$/.test(f) && !f.includes('.test.'));
const HEBREW = /[֐-׿]/;

describe('Admin HE/EN copy parity (static)', () => {
  for (const file of adminFiles) {
    it(`${file}: every line with Hebrew text has the language switch and an English literal nearby`, () => {
      // Block comments are blanked (line count preserved) so multi-line Hebrew
      // comments are never mistaken for user-visible copy.
      const source = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
      const lines = source.split(/\r?\n/);
      // Multi-line ternaries put the English branch on a neighbouring line, so
      // the switch and an English literal must appear within +-2 lines.
      const offenders = lines
        .map((line, i) => ({ line: line.trim(), n: i + 1, window: lines.slice(Math.max(0, i - 2), i + 3).join('\n') }))
        // Skip comment lines, including continuation lines of a multi-line
        // {/* ... */} comment (they carry no string quote or JSX text marker).
        .filter(({ line }) => HEBREW.test(line) && !/^(\/\/|\/\*|\*)/.test(line) && /['"`>]/.test(line))
        .filter(({ window }) => !(/isHebrew|sendHebrew|\bhe:/.test(window) && /['"`][^'"`]*[A-Za-z]{3}/.test(window)));
      expect(offenders.map((o) => `${file}:${o.n}`)).toEqual([]);
    });
    it(`${file}: no hardcoded page direction`, () => {
      const src = readFileSync(join(dir, file), 'utf8');
      expect(src).not.toMatch(/dir=["']rtl["']|direction:\s*['"]rtl['"]/);
    });
  }
});
