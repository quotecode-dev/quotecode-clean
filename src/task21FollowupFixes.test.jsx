// Task 21 (Owner-pasted relay 2026-10-10): regression guards for the follow-up local fixes.
//  - measured entry leads with a measurement method; mobile "New" offers the same three choices; the AI choice opens the draft dialog,
//    not a blank form + the general chat; the landing drawer is rendered outside the backdrop-filter header so sign-in is visible.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
import { getEntryRecommendedPricingMethod, getRecommendedPricingMethod } from './utils/professionalQuoteItem';
import LandingHeader from './components/landing/LandingHeader';

const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');

describe('measured-entry pricing recommendation', () => {
  it('a measured entry recommends area unless the profession already recommends a measurement method', () => {
    expect(getEntryRecommendedPricingMethod(null, true)).toBe('area');
    expect(getEntryRecommendedPricingMethod('unknown-domain', true)).toBe('area');
    for (const domain of ['electrician', 'plumber', 'flooring', 'painting', 'fencing', 'aluminum']) {
      const professional = getRecommendedPricingMethod(domain);
      expect(getEntryRecommendedPricingMethod(domain, true)).toBe(professional === 'linear' || professional === 'area' ? professional : 'area');
      expect(getEntryRecommendedPricingMethod(domain, false)).toBe(professional); // ordinary quotes: unchanged profession advice
    }
  });
  it('Dashboard passes the measured-entry flag (measured choice + divided mode) to the wizard recommendation', () => {
    const src = read('pages/Dashboard.jsx');
    expect(src).toContain("recommendedPricingMethod={getEntryRecommendedPricingMethod(professionalDomain, measuredQuoteEntry && quoteStructureMode === 'divided')}");
    // Task 27: the reset doubles as the Free-10 creation check (returns false = stopped before anything opens)
    expect(src).toMatch(/const handleCreateStructuredQuoteClick = \(\) => \{\s*if \(handleCreateNewQuoteClick\(\) === false\) return;\s*setQuoteStructureMode\('divided'\);\s*setMeasuredQuoteEntry\(true\);/);
  });
});

describe('Dashboard new-quote entries (source guards)', () => {
  const src = read('pages/Dashboard.jsx');
  it('the AI choice opens the AI draft dialog on the blank form - it no longer just opens the general chat', () => {
    const block = src.slice(src.indexOf('const handleCreateAiQuoteClick'), src.indexOf('const applyAiQuoteDraft'));
    expect(block).toContain('setShowAiQuoteDraft(true)');
    expect(block).not.toContain('openAiChat()');
    expect(src).toMatch(/<AiQuoteDraftDialog[\s\S]{0,400}isOpen=\{showAiQuoteDraft && isCreatingQuote && !editingQuoteId\}/);
  });
  it('applying a draft only changes the unsaved form state (no save call)', () => {
    const block = src.slice(src.indexOf('const applyAiQuoteDraft'), src.indexOf('// PRODUCT_TRUTH_CAPABILITY: quote_duplicate'));
    expect(block).toContain('setItems(');
    expect(block).not.toMatch(/handleSaveQuote|supabase\.|\.insert\(|\.upsert\(/);
  });
  it('the mobile bottom-row "New" opens the choice sheet wired to the same handlers (Task 27: + the saved-template entry)', () => {
    expect(src).toContain('onClick={() => { setShowMobileMoreMenu(false); setShowMobileNewQuoteMenu((prev) => !prev); }} aria-haspopup="menu"');
    expect(src).not.toContain('onClick={() => { setShowMobileMoreMenu(false); handleCreateNewQuoteClick(); }}');
    const sheet = src.slice(src.indexOf('className="no-print dash-mobile-newquote-menu"'), src.indexOf('closing the mobile \'New\' choices sheet'));
    expect(sheet).toContain('[...newQuoteChoices(isHebrew), templateChoice(isHebrew)].map(');
    expect(sheet).toContain('{ standard: handleCreateNewQuoteClick, ai: handleCreateAiQuoteClick, structured: handleCreateStructuredQuoteClick, template: handleOpenTemplatePicker }');
    expect(sheet).toContain('role="menuitem"');
  });
});

describe('landing drawer (HE/EN) is rendered outside the backdrop-filter header', () => {
  const nav = (he) => ({ sections: [{ id: 'faq', label: he ? 'שאלות' : 'FAQ' }], label: he ? 'ניווט' : 'Navigation', menu: he ? 'תפריט' : 'Menu', closeMenu: he ? 'סגירת התפריט' : 'Close menu', login: he ? 'כניסה למערכת' : 'Sign In', loginShort: he ? 'כניסה' : undefined, cta: 'cta', ctaShort: 'cta', homeLabel: 'home', forgotPassword: 'forgot' });
  it.each([[true, 'כניסה', '/dashboard?lang=he'], [false, 'Sign In', '/dashboard?lang=en']])('he=%s', (he, signIn, href) => {
    const links = { home: he ? '/he' : '/en', login: href, signup: '/signup' };
    const { container } = render(<LandingHeader nav={nav(he)} links={links} navigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: he ? 'תפריט' : 'Menu' }));
    const drawer = container.querySelector('#tl-menu-drawer');
    expect(drawer).toBeTruthy();
    expect(drawer.closest('header')).toBeNull();
    expect(container.querySelector('header .tl-drawer-backdrop')).toBeNull();
    const link = [...drawer.querySelectorAll('a')].find((a) => a.textContent === signIn);
    expect(link.getAttribute('href')).toBe(href);
  });
  it('the header still carries the backdrop-filter (the reason the drawer must live outside it)', () => {
    expect(read('components/landing/landing.css')).toMatch(/\.tl-header \{[^}]*backdrop-filter: blur\(10px\)/);
  });
});
