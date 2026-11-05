// Owner console 2026-11-05 (typed: "מאשר הוספת קישורים לרשתות החברתיות בתחתית דפי הנחיתה לפי השוק, כולל שינוי ב-L-06 ..."; "לשים אייקונים
// קטנים למטה של הרשתות החברתיות וכמובן האנגלית לאנגלית והעברית לעברית"): the Hebrew page links TEKANGO Israel's accounts, the English
// page TEKANGO Global's - small icons in the footer, a new tab each, never the other market's.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import SocialLinks from './components/landing/SocialLinks';
import { readFileSync } from 'node:fs';

afterEach(cleanup);
const src = (f) => readFileSync(f, 'utf8');

describe('the landing footer social icons', () => {
  it('Hebrew page: the Israeli accounts only', () => {
    const he = src('src/pages/LandingLocal.jsx');
    for (const u of ['facebook.com/1381375051729705', 'instagram.com/tekangoisrael/', 'tiktok.com/@tekangoisrael', 'youtube.com/@tekangoisrael']) expect(he).toContain(u);
    expect(he).not.toMatch(/tekangoglobal|1408027809060627/);
  });
  it('English page: the international accounts only', () => {
    const en = src('src/pages/LandingGlobal.jsx');
    for (const u of ['facebook.com/1408027809060627', 'instagram.com/tekangoglobal/', 'tiktok.com/@tekangoglobal', 'youtube.com/@tekangoglobal']) expect(en).toContain(u);
    expect(en).not.toMatch(/tekangoisrael|1381375051729705/);
  });
  it('each icon opens its account in a new tab, named for screen readers; the footer renders them', () => {
    const links = [{ network: 'facebook', href: 'https://www.facebook.com/1', label: 'A' }, { network: 'youtube', href: 'https://www.youtube.com/@x', label: 'B' }];
    const { container } = render(<SocialLinks links={links} label="L" />);
    const a = [...container.querySelectorAll('a[data-social]')];
    expect(a.map((x) => [x.getAttribute('target'), x.getAttribute('rel'), x.getAttribute('aria-label'), !!x.querySelector('svg path')])).toEqual([['_blank', 'noopener noreferrer', 'A', true], ['_blank', 'noopener noreferrer', 'B', true]]);
    expect(src('src/components/landing/LandingPage.jsx')).toMatch(/<SocialLinks links=\{copy\.footer\.social \|\| \[\]\} label=\{copy\.footer\.socialLabel\} \/>/);
  });
});
