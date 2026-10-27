// Owner console 2026-10-27 ("מאשר את תוכנית א"): a guides link in the landing footer and in the top menu (header + drawer), HE and EN.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import LandingHeader from './components/landing/LandingHeader';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');

describe('landing copy: the guides link (HE + EN)', () => {
  it.each([['pages/LandingLocal.jsx', 'מדריכים', '/he/articles'], ['pages/LandingGlobal.jsx', 'Guides', '/en/articles']])('%s', (file, label, href) => {
    const src = read(file);
    expect(src).toContain(`{ id: 'guides', label: '${label}', href: '${href}' }`);
    expect(src).toContain(`{ href: '${href}', label: '${label}', icon: BookOpen }`);
    // the existing four in-page sections stay, in the same order, before the guides item
    expect(src).toMatch(/\{ id: 'styles'[\s\S]*\{ id: 'workflow'[\s\S]*\{ id: 'plans'[\s\S]*\{ id: 'faq'[\s\S]*\{ id: 'guides'/);
  });
});

describe('LandingHeader: a section with its own href opens that page', () => {
  const nav = (he) => ({
    sections: [{ id: 'faq', label: he ? 'שאלות' : 'FAQ' }, { id: 'guides', label: he ? 'מדריכים' : 'Guides', href: he ? '/he/articles' : '/en/articles' }],
    label: he ? 'ניווט' : 'Navigation', menu: he ? 'תפריט' : 'Menu', closeMenu: he ? 'סגירת התפריט' : 'Close menu', login: he ? 'כניסה למערכת' : 'Sign In', cta: 'cta', homeLabel: 'home', forgotPassword: 'forgot',
  });
  const links = (he) => ({ home: he ? '/he' : '/en', login: '/dashboard', signup: '/signup' });

  it.each([[true, 'מדריכים', 'שאלות', '/he/articles'], [false, 'Guides', 'FAQ', '/en/articles']])('he=%s header', (he, guides, faq, href) => {
    const navigate = vi.fn();
    const { container } = render(<LandingHeader nav={nav(he)} links={links(he)} navigate={navigate} />);
    const menu = container.querySelector('.tl-menu');
    const a = [...menu.querySelectorAll('a')].find((x) => x.textContent === guides);
    expect(a.getAttribute('href')).toBe(href);
    fireEvent.click(a, { button: 0 });
    expect(navigate).toHaveBeenCalledWith(href);
    // an in-page section is still a plain anchor, without the router
    const f = [...menu.querySelectorAll('a')].find((x) => x.textContent === faq);
    expect(f.getAttribute('href')).toBe('#faq');
    navigate.mockClear();
    fireEvent.click(f, { button: 0 });
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([[true, 'מדריכים', '/he/articles'], [false, 'Guides', '/en/articles']])('he=%s drawer', (he, guides, href) => {
    const navigate = vi.fn();
    const { container } = render(<LandingHeader nav={nav(he)} links={links(he)} navigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: he ? 'תפריט' : 'Menu' }));
    const drawer = container.querySelector('#tl-menu-drawer');
    const a = [...drawer.querySelectorAll('a')].find((x) => x.textContent === guides);
    expect(a.getAttribute('href')).toBe(href);
    fireEvent.click(a, { button: 0 });
    expect(navigate).toHaveBeenCalledWith(href);
    expect(container.querySelector('#tl-menu-drawer')).toBeNull();
  });
});
