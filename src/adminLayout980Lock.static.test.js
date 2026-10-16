import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// L-21 (Owner console 2026-10-16, "על פניו זה מושלם! אפשר לנעול"): the admin layout accepted on 5186 - the admin stays inside the
// shared 980px desktop shell; only while an admin screen is shown the workspace gutter is 6px; on desktop every admin element is
// drawn at 60% ("now reduce all the elements by 40%"); the users list scrolls from its column-header row, which stays sticky, while
// search / filters / the count stay fixed above (on a phone / tablet they scroll with the cards). User screens are untouched. Changing any of this needs an Owner approval naming L-21.
const SRC = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(SRC, p), 'utf8');
const css = read('components/adminV2.css');
const indexCss = read('index.css');
const frame = read('components/AdminScreenFrame.jsx');
const users = read('components/AdminUsersView.jsx');

describe('L-21 admin layout inside the 980px shell', () => {
  it('keeps the shared 980px desktop shell and never lifts it for the admin', () => {
    expect(indexCss).toContain('--pf-dashboard-shell-total-width: min(980px, 100%);');
    expect(css).not.toMatch(/\.dash-shell-outer/);
    expect(css).not.toMatch(/\.dash-content-container/);
    expect(css).not.toMatch(/max-width:\s*none/);
  });

  it('touches shared shell classes only while an admin screen is shown', () => {
    const shellRules = css.split('\n').filter((l) => /\.dash-[a-z-]+/.test(l) && !l.trim().startsWith('/*') && !l.trim().startsWith('*'));
    expect(shellRules.length).toBeGreaterThan(0);
    for (const l of shellRules) expect(l).toContain(':has(.admin-screen)');
    expect(css).toContain('.dash-main-content:has(.admin-screen) { padding-inline: 6px !important; }');
    expect(css).toContain('.dash-main-content:has(.admin-screen) .dash-upper-section { margin-inline: -6px !important; }');
  });

  it('draws every admin element at 60% on desktop only', () => {
    expect(css).toMatch(/@media \(min-width: 1000px\) \{\s*\.admin-screen \.av \{ zoom: 0\.6; \}\s*\}/);
    expect(css).toContain('@media (max-width: 999px) {');
    expect(frame).toContain("padding: '14px 8px'");
    expect(frame).toContain('className="pf-screen pf-work-screen admin-screen"');
  });

  it('scrolls the users list from a sticky column-header row with search and filters fixed above', () => {
    expect(css).toContain('.av .av-users-table thead th { position: sticky; inset-block-start: 0; z-index: 3; background: #f6f8fb; }');
    expect(css).toContain('.av .av-tablewrap.av-users-table { overflow: visible; }');
    expect(css).toContain('.pf-screen > .admin-screen-body:has(.av-users-rows) { padding-top: 0; }');
    const topCard = users.slice(users.indexOf('const topCard = ('), users.indexOf('  return (\n    <div className="admin-screen-host">'));
    expect(topCard).toContain('<div className="av-card av-users-top">');
    expect(topCard).toContain('role="search"');
    expect(topCard).toContain('C.usersCount');
    // desktop: fixed in the frame's static block; phone / tablet: scrolls with the cards
    expect(users).toContain("const wideQuery = '(min-width: 1000px)';");
    expect(users.slice(users.indexOf('controls={('), users.indexOf('    >\n'))).toContain('{wide && topCard}');
    expect(users).toContain("{!wide && topCard}");
    expect(users).toContain('<caption className="av-sr-only">');
  });
});
