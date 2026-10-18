// Owner 2026-10-14 (option A): the sidebar logo card shows the business's own logo when it uploaded one (as before the new interface);
// with no logo, or a logo that fails to load, it shows the TEKANGO wordmark. Owner 2026-10-14: a logo gets a 90px card (logo up to
// 78px, contained); the TEKANGO wordmark card keeps the approved 58px inside the 68px band.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dashboard = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'pages/Dashboard.jsx'), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));

describe('sidebar business logo', () => {
  it('business logo first, TEKANGO wordmark as the fallback (no logo / load error); the failure resets when the logo changes', () => {
    const brand = dashboard.slice(dashboard.indexOf("<div className={bizLogoUrl && !sidebarLogoFailed ? 'dash-sidebar-brand dash-sidebar-brand--logo' : 'dash-sidebar-brand'}>"), dashboard.indexOf('<nav className="dash-sidebar-nav">'));
    expect(brand.length).toBeGreaterThan(100);
    expect(brand).toMatch(/\{bizLogoUrl && !sidebarLogoFailed \? \(/);
    expect(brand).toMatch(/<img key=\{bizLogoUrl\} src=\{bizLogoUrl\} alt=\{bizName \|\| \(isHebrew \? 'לוגו העסק' : 'Business logo'\)\} className="dash-sidebar-business-logo" onError=\{\(\) => setSidebarLogoFailed\(true\)\} \/>/);
    expect(brand).toMatch(/className="dash-sidebar-brand-card" role="img" aria-label="TEKANGO"/);
    expect(brand.indexOf('dash-sidebar-business-logo')).toBeLessThan(brand.indexOf('aria-label="TEKANGO"'));
    expect(dashboard).toMatch(/useEffect\(\(\) => \{ setSidebarLogoFailed\(false\); \}, \[bizLogoUrl\]\);/);
  });
  it('the logo is contained inside a 90px card (logo up to 78px); the wordmark card keeps 58px / the 68px band', () => {
    const rule = dashboard.slice(dashboard.indexOf('.dash-sidebar-business-logo {'), dashboard.indexOf('.dash-sidebar-wordmark {'));
    expect(rule).toMatch(/max-height: 78px;/);
    expect(rule).toMatch(/.dash-sidebar-brand.dash-sidebar-brand--logo { height: 100px; padding: 5px 10px; }/);
    expect(rule).toMatch(/.dash-sidebar-brand--logo .dash-sidebar-brand-card { height: 90px; }/);
    expect(rule).toMatch(/max-width: calc\(100% - 16px\);/);
    expect(rule).toMatch(/object-fit: contain;/);
    // + Owner console 2026-10-18 ("שהרוחב של השוליים יהיה באותו עובי מסביב ללוגו"): the card wraps the logo with one even 6px frame
    expect(rule).toMatch(/\.dash-sidebar-brand--logo \.dash-sidebar-brand-card \{ height: auto; width: fit-content; max-width: 100%; padding: 6px; border-radius: 0; \}/);
  });
});
