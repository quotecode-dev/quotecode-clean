import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timeGreeting } from './timeGreeting';

describe('time-of-day greeting (Owner 2026-10-14: greeting only, no business name)', () => {
  it.each([[5, 'בוקר טוב', 'Good morning'], [11, 'בוקר טוב', 'Good morning'], [12, 'צהריים טובים', 'Good afternoon'], [16, 'צהריים טובים', 'Good afternoon'],
    [17, 'ערב טוב', 'Good evening'], [20, 'ערב טוב', 'Good evening'], [21, 'לילה טוב', 'Good night'], [0, 'לילה טוב', 'Good night'], [4, 'לילה טוב', 'Good night']])('%i:00 -> %s / %s', (h, he, en) => {
    expect(timeGreeting(h, true)).toBe(he);
    expect(timeGreeting(h, false)).toBe(en);
  });
  it('the header shows the greeting, not the business name', () => {
    const d = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../pages/Dashboard.jsx'), 'utf8');
    const at = d.indexOf('<div className="dash-header-account">');
    const cluster = d.slice(at, at + 900);
    expect(cluster).toContain('<HeaderGreeting isHebrew={isHebrew} />');
    expect(cluster).not.toMatch(/bizName/);
  });
});

describe('phones (Owner 2026-10-14): the greeting tops the stacked header block in place of the date; the medallion sits next to the bell', () => {
  const d = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../pages/Dashboard.jsx'), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
  it('phones: the stacked block is greeting, date, time (Owner 2026-10-14: the date stays visible); desktop keeps the date and hides the greeting line', () => {
    // + Owner console 2026-10-18, typed: "3 - להחזיר את האנימציה" (accepted: "מעולה, תנעל"): the greeting enters with the approved animation
    expect(d).toContain('<span key={timeGreeting(now.getHours(), isHebrew)} className="dash-header-mgreet dash-header-greeting-text">{timeGreeting(now.getHours(), isHebrew)}</span>');
    expect(d).not.toContain('.dash-header-datetime .dash-header-date { display: none; }');
    expect(d).toContain('.dash-header-datetime .dash-header-mgreet { font-size: 0.8rem; font-weight: 800; white-space: nowrap; line-height: 1.15; }');
    expect(d).toContain('.dash-header-datetime .dash-header-date { font-size: 0.7rem; font-weight: 700; line-height: 1.15; }');
    expect(d).toContain('.dash-header-datetime .dash-header-mgreet { display: none; }');
    expect(d).toContain('.dash-header-datetime .dash-header-date { display: inline; }');
  });
  it('the mobile badge holds the bell then the medallion (not for the super admin)', () => {
    const at = d.indexOf('<div className="dash-header-badge-mobile"');
    const block = d.slice(at, at + 1400);
    expect(block.indexOf('variant="mobile"')).toBeLessThan(block.indexOf('<HeaderPlanMedallion'));
    expect(block).toMatch(/\{!isSuperAdmin && \(\n\s*<HeaderPlanMedallion model=\{headerPlanBadge\}/);
  });
});
