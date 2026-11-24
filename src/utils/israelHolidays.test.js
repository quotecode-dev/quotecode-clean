// Task 19: the bundled Israeli holiday dataset (src/data/israelHolidays.json) - Israel only, official non-working rest days, generated
// deterministically from the ICU/CLDR Hebrew calendar. Independent cross-check: the 2026 and 2027 Israel-schedule dates published by
// Hebcal (hebcal.com, CC BY 4.0 - used here only as a verification reference, retrieved 2026-10-09) and the widely published
// Yom HaAtzmaut dates of 2024 (moved Monday -> Tuesday) and 2025 (moved Saturday -> Thursday).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { cwd, execPath } from 'node:process';
import data from '../data/israelHolidays.json';

const byYear = (y) => Object.fromEntries(data.days.filter((d) => d.date.startsWith(String(y))).map((d) => [d.key, d.date]));

describe('Israeli holiday dataset', () => {
  it('is Israel-only, covers 2020-2040 with exactly the nine official rest days per year', () => {
    expect(data.scope).toBe('IL');
    expect(data.range).toEqual({ from: 2020, to: 2040 });
    expect(data.days).toHaveLength(21 * 9);
    const keys = ['pesach_1', 'pesach_7', 'rosh_hashanah_1', 'rosh_hashanah_2', 'shavuot', 'shemini_atzeret', 'sukkot', 'yom_haatzmaut', 'yom_kippur'];
    for (let y = 2020; y <= 2040; y += 1) expect(Object.keys(byYear(y)).sort(), String(y)).toEqual(keys);
    // no minor observances, eves or school vacations
    expect(data.days.some((d) => /purim|chanukah|hanukkah|erev|tisha|lag|tu_bishvat/i.test(d.key))).toBe(false);
  });
  it('matches the published Israel-schedule reference for 2026 and 2027 (Hebcal)', () => {
    expect(byYear(2026)).toEqual({
      pesach_1: '2026-04-02', pesach_7: '2026-04-08', yom_haatzmaut: '2026-04-22', shavuot: '2026-05-22', rosh_hashanah_1: '2026-09-12',
      rosh_hashanah_2: '2026-09-13', yom_kippur: '2026-09-21', sukkot: '2026-09-26', shemini_atzeret: '2026-10-03',
    });
    expect(byYear(2027)).toEqual({
      pesach_1: '2027-04-22', pesach_7: '2027-04-28', yom_haatzmaut: '2027-05-12', shavuot: '2027-06-11', rosh_hashanah_1: '2027-10-02',
      rosh_hashanah_2: '2027-10-03', yom_kippur: '2027-10-11', sukkot: '2027-10-16', shemini_atzeret: '2027-10-23',
    });
  });
  it('applies the statutory Yom HaAtzmaut move rule (Monday -> Tuesday, Saturday -> Thursday)', () => {
    expect(byYear(2024).yom_haatzmaut).toBe('2024-05-14');
    expect(byYear(2025).yom_haatzmaut).toBe('2025-05-01');
    // Yom HaAtzmaut never falls on Friday, Saturday or Monday
    for (const d of data.days.filter((x) => x.key === 'yom_haatzmaut')) expect([5, 6, 1]).not.toContain(new Date(`${d.date}T00:00:00Z`).getUTCDay());
  });
  it('the committed file is exactly what the generator produces (no hand edits)', () => {
    const out = execFileSync(execPath, [join(cwd(), 'scripts', 'generate-israel-holidays.mjs'), '--check'], { encoding: 'utf8' });
    expect(out).toMatch(/matches a fresh generation/);
  });
});
