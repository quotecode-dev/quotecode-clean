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
