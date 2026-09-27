import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { formatShortDate, formatShortDateTime, calendarParts, resolveDateMarket, deviceCalendarDate, formatDeviceShortDateTime, SHORT_DATE_TIME_ZONE } from './shortDate';

// IRON-DATE-001: ONE short-date primitive. Fixture 2026-09-13 is unambiguous (13 cannot be a month).
describe('IRON-DATE-001 short-date primitive', () => {
  it('renders the Owner fixture by market: Local 13/09/2026, International 09/13/2026', () => {
    expect(formatShortDate('2026-09-13', 'Local')).toBe('13/09/2026');
    expect(formatShortDate('2026-09-13', 'International')).toBe('09/13/2026');
    expect(formatShortDate('2026-09-13', 'LCL')).toBe('13/09/2026');
    expect(formatShortDate('2026-09-13', true)).toBe('13/09/2026');
    expect(formatShortDate('2026-09-13', false)).toBe('09/13/2026');
  });

  it('has no currency input at all - every International currency gets the same MM/DD/YYYY order', () => {
    expect(formatShortDate.length).toBe(2);
    for (const junk of ['USD', 'EUR', 'GBP', 'ILS', 'he', 'en-GB']) expect(formatShortDate('2026-09-13', junk)).toBe('09/13/2026');
  });

  it('treats a date-only value as a calendar date (never shifted by a time zone)', () => {
    expect(calendarParts('2026-09-13', 'International')).toEqual({ y: '2026', m: '09', d: '13' });
    expect(formatShortDate('2026-01-01', 'Local')).toBe('01/01/2026');
    expect(formatShortDate('2026-12-31', 'International')).toBe('12/31/2026');
  });

  it('converts timestamps in the market product time zone (Local Asia/Jerusalem, International UTC)', () => {
    expect(SHORT_DATE_TIME_ZONE).toEqual({ Local: 'Asia/Jerusalem', International: 'UTC' });
    // 22:30Z on the 12th is already the 13th in Jerusalem (UTC+3 in September) but still the 12th in UTC.
    expect(formatShortDate('2026-09-12T22:30:00Z', 'Local')).toBe('13/09/2026');
    expect(formatShortDate('2026-09-12T22:30:00Z', 'International')).toBe('09/12/2026');
    expect(formatShortDate('2026-09-13T09:00:00+00:00', 'Local')).toBe('13/09/2026');
    expect(formatShortDate(new Date('2026-09-13T09:00:00Z'), 'International')).toBe('09/13/2026');
    expect(formatShortDate(Date.UTC(2026, 8, 13, 9), 'International')).toBe('09/13/2026');
    // zone-less timestamp strings are UTC, never browser-local
    expect(formatShortDate('2026-09-12T22:30:00', 'International')).toBe('09/12/2026');
    expect(formatShortDate('2026-09-12 22:30:00', 'Local')).toBe('13/09/2026');
  });

  it('formats date-times in the same zone with 24h time', () => {
    expect(formatShortDateTime('2026-09-13T09:05:00Z', 'Local')).toBe('13/09/2026 12:05');
    expect(formatShortDateTime('2026-09-13T21:05:00Z', 'International')).toBe('09/13/2026 21:05');
    expect(formatShortDateTime('2026-09-13', 'International')).toBe('09/13/2026');
  });

  it('never fabricates: empty -> "", unparseable -> unchanged', () => {
    expect(formatShortDate(null, 'Local')).toBe('');
    expect(formatShortDate(undefined, 'International')).toBe('');
    expect(formatShortDate('', 'Local')).toBe('');
    expect(formatShortDate('not a date', 'Local')).toBe('not a date');
    expect(formatShortDateTime('nope', 'International')).toBe('nope');
  });

  it('device-originated moments use the device day with market order', () => {
    const d = new Date(2026, 8, 13, 7, 4);
    expect(deviceCalendarDate(d)).toBe('2026-09-13');
    expect(formatDeviceShortDateTime(d, 'Local')).toBe('13/09/2026 07:04');
    expect(formatDeviceShortDateTime(d, 'International')).toBe('09/13/2026 07:04');
    expect(formatDeviceShortDateTime('garbage', 'Local')).toBe('');
  });

  it('resolveDateMarket: only an explicit Local marker is Local', () => {
    expect(resolveDateMarket('Local')).toBe('Local');
    expect(resolveDateMarket('International')).toBe('International');
    expect(resolveDateMarket(undefined)).toBe('International');
  });

  it('renders identically under opposing machine time zones and locales (browser/OS never decides)', () => {
    const mod = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/functions/_shared/shortDate.js').replace(/\\/g, '/');
    const script = `import('file:///${mod.replace(/^\//, '')}').then(m=>console.log(JSON.stringify([m.formatShortDate('2026-09-13','Local'),m.formatShortDate('2026-09-13','International'),m.formatShortDate('2026-09-13T09:00:00Z','Local'),m.formatShortDate('2026-09-13T09:00:00Z','International')])))`;
    const outs = [['America/Los_Angeles', 'en-US'], ['Pacific/Kiritimati', 'he-IL'], ['Asia/Jerusalem', 'en-GB']].map(([TZ, LANG]) =>
      execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ, LANG, LC_ALL: LANG }, encoding: 'utf8' }).trim());
    for (const o of outs) expect(JSON.parse(o)).toEqual(['13/09/2026', '09/13/2026', '13/09/2026', '09/13/2026']);
  });
});

// Static ownership guard: no product surface may format a short date by itself (browser-locale / currency-ordered calls).
describe('IRON-DATE-001 ownership guard', () => {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = path.join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'supabase/functions'))]
    .filter((f) => /\.(jsx?|tsx?)$/.test(f) && !/\.test\./.test(f));
  // Documented long-form prose exceptions (month spelled out, so day/month order can never be misread; never numeric).
  const LONG_FORM = ['supabase/functions/send-trial-expiration-email/reminderContent.ts', 'supabase/functions/send-subscription-expiration-email/index.ts'];

  it('no direct toLocaleDateString / Date#toLocaleString / removed owners outside the primitive', () => {
    const offenders = [];
    for (const f of files) {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      const src = readFileSync(f, 'utf8');
      if (/formatDateLocal\s*\(|formatHeaderDate\s*\(/.test(src)) offenders.push(`${rel}: removed owner`);
      if (/new Date\([^)]*\)\.toLocaleString\(/.test(src)) offenders.push(`${rel}: Date#toLocaleString`);
      if (/toLocaleDateString\(/.test(src) && !LONG_FORM.includes(rel)) offenders.push(`${rel}: toLocaleDateString`);
      // a raw stored date/timestamp column rendered straight into JSX (e.g. {exp.expense_date}) is an ISO bypass of the primitive
      if (/\.jsx$/.test(rel) && /\{[\w.?]+\.(\w+_date|valid_until|created_at|updated_at|\w+_at)\}/.test(src)) offenders.push(`${rel}: raw date field rendered`);
    }
    expect(offenders).toEqual([]);
  });

  it('long-form exceptions stay prose (month: long, never a numeric day/month order)', () => {
    for (const rel of LONG_FORM) {
      const src = readFileSync(path.join(ROOT, rel), 'utf8');
      expect(src).toMatch(/toLocaleDateString\(isHebrew \? 'he-IL' : 'en-US', \{ year: 'numeric', month: 'long', day: 'numeric' \}\)/);
    }
  });

  it('chat-ai directFacts and the app load the SAME primitive file', () => {
    expect(readFileSync(path.join(ROOT, 'supabase/functions/chat-ai/directFacts.ts'), 'utf8')).toMatch(/from "\.\.\/_shared\/shortDate\.js"/);
    expect(readFileSync(path.join(ROOT, 'src/utils/shortDate.js'), 'utf8')).toMatch(/from '\.\.\/\.\.\/supabase\/functions\/_shared\/shortDate\.js'/);
  });
});
