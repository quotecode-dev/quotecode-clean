// Task 19 (Calendar): generates the BUNDLED, deterministic Israeli holiday dataset src/data/israelHolidays.json.
//
// Source: the Hebrew calendar of ICU / CLDR, exposed by the JavaScript runtime as Intl calendar `hebrew` (no network, no third-party
// package, no runtime provider). The product never computes holidays at runtime; it only reads the committed JSON.
// Scope (Owner decision): Israel only - the official non-working rest days (Hours of Work and Rest Law; Independence Day Law):
//   Rosh Hashanah (Tishri 1-2), Yom Kippur (Tishri 10), Sukkot (Tishri 15), Shemini Atzeret / Simchat Torah (Tishri 22, Israel schedule),
//   Pesach (Nisan 15), Seventh day of Pesach (Nisan 21), Shavuot (Sivan 6, Israel schedule), Yom HaAtzmaut (Iyar 5, moved by the statutory
//   rule: Friday -> Thursday Iyar 4, Saturday -> Thursday Iyar 3, Monday -> Tuesday Iyar 6).
// No school vacations, no minor observances, no eves. Range: 2020-2040 (outside the range the calendar shows no holiday data - never a guess).
// Owner 2026-10-29 (typed: "מאשר הוספת מועדים ביומן בישראל: חנוכה, פורים, ט"ו בשבט, ל"ג בעומר, יום השואה, יום הזיכרון, יום ירושלים, תשעה
// באב, ערבי חג וחול המועד - שם בתא בלי רקע של יום מנוחה, ימי המנוחה והיומן הבינלאומי בלי שינוי"): a SEPARATE list `observances` - working
// days shown by name only, never a rest day (the `days` list above is unchanged): Hanukkah (Kislev 25, eight days), Tu BiShvat (Shevat 15),
// Purim (Adar 14 / Adar II 14 in a leap year), Yom HaShoah (Nisan 27; Friday -> Thursday, Sunday -> Monday), Yom HaZikaron (the day before
// the moved Yom HaAtzmaut), Lag BaOmer (Iyar 18), Yom Yerushalayim (Iyar 28), Tisha B'Av (Av 9; Saturday -> Sunday), the eves of Rosh
// Hashanah, Yom Kippur, Sukkot, Pesach and Shavuot, and Chol HaMoed (Tishri 16-21 with Hoshana Rabbah, Nisan 16-20).
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
const HEB_DAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳'];
export const OBSERVANCES = Object.freeze([
  { key: 'erev_rosh_hashanah', month: 'Elul', day: 29, he: 'ערב ראש השנה', en: 'Erev Rosh Hashanah' },
  { key: 'erev_yom_kippur', month: 'Tishri', day: 9, he: 'ערב יום כיפור', en: 'Erev Yom Kippur' },
  { key: 'erev_sukkot', month: 'Tishri', day: 14, he: 'ערב סוכות', en: 'Erev Sukkot' },
  ...[16, 17, 18, 19, 20].map((day) => ({ key: 'chol_hamoed_sukkot', month: 'Tishri', day, he: 'חול המועד סוכות', en: 'Sukkot (Chol HaMoed)' })),
  { key: 'hoshana_rabbah', month: 'Tishri', day: 21, he: 'הושענא רבה', en: 'Hoshana Rabbah' },
  { key: 'tu_bishvat', month: 'Shevat', day: 15, he: 'ט״ו בשבט', en: 'Tu BiShvat' },
  { key: 'purim', month: 'Adar', day: 14, he: 'פורים', en: 'Purim' },
  { key: 'purim', month: 'Adar II', day: 14, he: 'פורים', en: 'Purim' },
  { key: 'erev_pesach', month: 'Nisan', day: 14, he: 'ערב פסח', en: 'Erev Pesach' },
  ...[16, 17, 18, 19, 20].map((day) => ({ key: 'chol_hamoed_pesach', month: 'Nisan', day, he: 'חול המועד פסח', en: 'Passover (Chol HaMoed)' })),
  { key: 'lag_baomer', month: 'Iyar', day: 18, he: 'ל״ג בעומר', en: 'Lag BaOmer' },
  { key: 'yom_yerushalayim', month: 'Iyar', day: 28, he: 'יום ירושלים', en: 'Jerusalem Day' },
  { key: 'erev_shavuot', month: 'Sivan', day: 5, he: 'ערב שבועות', en: 'Erev Shavuot' },
]);
export function generate() {
  const out = [];
  const obs = [];
  const at = (t, shift) => iso(new Date(t + shift * 86400000));
  for (let t = Date.UTC(RANGE.from, 0, 1); t <= Date.UTC(RANGE.to, 11, 31); t += 86400000) {
    const d = new Date(t);
    const h = hebrew(d);
    for (const x of HOLIDAYS) if (x.month === h.month && x.day === h.day) out.push({ date: iso(d), key: x.key, he: x.he, en: x.en });
    // Yom HaAtzmaut: the statutory move rule is applied to the day that IS Iyar 5
    if (h.month === 'Iyar' && h.day === 5) {
      const wd = d.getUTCDay(); // 0 Sunday .. 6 Saturday
      const shift = wd === 5 ? -1 : wd === 6 ? -2 : wd === 1 ? 1 : 0;
      out.push({ date: iso(new Date(t + shift * 86400000)), key: 'yom_haatzmaut', he: 'יום העצמאות', en: 'Independence Day' });
      obs.push({ date: at(t, shift - 1), key: 'yom_hazikaron', he: 'יום הזיכרון', en: 'Memorial Day' });
    }
    for (const x of OBSERVANCES) if (x.month === h.month && x.day === h.day) obs.push({ date: iso(d), key: x.key, he: x.he, en: x.en });
    if (h.month === 'Kislev' && h.day === 25) {
      for (let i = 0; i < 8; i += 1) obs.push({ date: at(t, i), key: 'chanukah', he: `חנוכה (יום ${HEB_DAY[i]})`, en: `Hanukkah (day ${i + 1})` });
    }
    if (h.month === 'Nisan' && h.day === 27) {
      const wd = d.getUTCDay();
      obs.push({ date: at(t, wd === 5 ? -1 : wd === 0 ? 1 : 0), key: 'yom_hashoah', he: 'יום השואה', en: 'Holocaust Remembrance Day' });
    }
    if (h.month === 'Av' && h.day === 9) obs.push({ date: at(t, d.getUTCDay() === 6 ? 1 : 0), key: 'tisha_bav', he: 'תשעה באב', en: "Tisha B'Av" });
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  // the Gregorian range applies to both lists (an observance moved across a year boundary stays inside the range)
  const inRange = (x) => Number(x.date.slice(0, 4)) >= RANGE.from && Number(x.date.slice(0, 4)) <= RANGE.to;
  const observances = obs.filter(inRange).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  return { schema: 'tekango-israel-holidays/1', source: 'ICU/CLDR Hebrew calendar (Intl calendar "hebrew"); Israeli official non-working rest days', scope: 'IL', range: RANGE, days: out, observances };
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
