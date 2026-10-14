// Task 19 (Calendar): generates the BUNDLED, deterministic Israeli holiday dataset src/data/israelHolidays.json.
//
// Source: the Hebrew calendar of ICU / CLDR, exposed by the JavaScript runtime as Intl calendar `hebrew` (no network, no third-party
// package, no runtime provider). The product never computes holidays at runtime; it only reads the committed JSON.
// Scope (Owner decision): Israel only - the official non-working rest days (Hours of Work and Rest Law; Independence Day Law):
//   Rosh Hashanah (Tishri 1-2), Yom Kippur (Tishri 10), Sukkot (Tishri 15), Shemini Atzeret / Simchat Torah (Tishri 22, Israel schedule),
//   Pesach (Nisan 15), Seventh day of Pesach (Nisan 21), Shavuot (Sivan 6, Israel schedule), Yom HaAtzmaut (Iyar 5, moved by the statutory
//   rule: Friday -> Thursday Iyar 4, Saturday -> Thursday Iyar 3, Monday -> Tuesday Iyar 6).
// No school vacations, no minor observances, no eves. Range: 2020-2040 (outside the range the calendar shows no holiday data - never a guess).
// The dataset is independently cross-checked by src/utils/israelHolidays.test.js against published reference dates.
//   node scripts/generate-israel-holidays.mjs            (writes the JSON)
//   node scripts/generate-israel-holidays.mjs --check    (exit 1 if the committed JSON differs from a fresh generation)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RANGE = Object.freeze({ from: 2020, to: 2040 });
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'israelHolidays.json');
const fmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
if (fmt.resolvedOptions().calendar !== 'hebrew') throw new Error('this runtime has no ICU Hebrew calendar - refusing to generate');
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
function hebrew(d) {
  const parts = fmt.formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { day: Number(get('day')), month: get('month') };
}
export const HOLIDAYS = Object.freeze([
  { key: 'rosh_hashanah_1', month: 'Tishri', day: 1, he: 'ראש השנה', en: 'Rosh Hashanah' },
  { key: 'rosh_hashanah_2', month: 'Tishri', day: 2, he: 'ראש השנה (יום ב׳)', en: 'Rosh Hashanah (day 2)' },
  { key: 'yom_kippur', month: 'Tishri', day: 10, he: 'יום כיפור', en: 'Yom Kippur' },
  { key: 'sukkot', month: 'Tishri', day: 15, he: 'סוכות', en: 'Sukkot' },
  { key: 'shemini_atzeret', month: 'Tishri', day: 22, he: 'שמיני עצרת / שמחת תורה', en: 'Shemini Atzeret / Simchat Torah' },
  { key: 'pesach_1', month: 'Nisan', day: 15, he: 'פסח', en: 'Passover' },
  { key: 'pesach_7', month: 'Nisan', day: 21, he: 'שביעי של פסח', en: 'Seventh day of Passover' },
  { key: 'shavuot', month: 'Sivan', day: 6, he: 'שבועות', en: 'Shavuot' },
]);
export function generate() {
  const out = [];
  for (let t = Date.UTC(RANGE.from, 0, 1); t <= Date.UTC(RANGE.to, 11, 31); t += 86400000) {
    const d = new Date(t);
    const h = hebrew(d);
    for (const x of HOLIDAYS) if (x.month === h.month && x.day === h.day) out.push({ date: iso(d), key: x.key, he: x.he, en: x.en });
    // Yom HaAtzmaut: the statutory move rule is applied to the day that IS Iyar 5
    if (h.month === 'Iyar' && h.day === 5) {
      const wd = d.getUTCDay(); // 0 Sunday .. 6 Saturday
      const shift = wd === 5 ? -1 : wd === 6 ? -2 : wd === 1 ? 1 : 0;
      out.push({ date: iso(new Date(t + shift * 86400000)), key: 'yom_haatzmaut', he: 'יום העצמאות', en: 'Independence Day' });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  return { schema: 'tekango-israel-holidays/1', source: 'ICU/CLDR Hebrew calendar (Intl calendar "hebrew"); Israeli official non-working rest days', scope: 'IL', range: RANGE, days: out };
}
const IS_ENTRY = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_ENTRY) {
  const text = `${JSON.stringify(generate(), null, 1)}\n`;
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (cur !== text) { console.error('israelHolidays.json differs from a fresh generation'); process.exit(1); }
    console.log('israelHolidays.json matches a fresh generation');
  } else { fs.writeFileSync(OUT, text); console.log(`wrote ${OUT}`); }
}
