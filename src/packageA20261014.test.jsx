// Owner package A 2026-10-14: the public "quote not found" page (readable contrast, the page's own language only) and the truthful
// sign-up message when email verification is still required.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('./shared/supabase', () => ({ supabase: { functions: { invoke: vi.fn(async () => ({ data: null, error: { message: 'not found', context: { status: 404 } } })) }, rpc: vi.fn(async () => ({ data: null, error: { message: 'x' } })) } }));
const { default: SmartPublicQuote } = await import('./components/SmartPublicQuote');

afterEach(() => { cleanup(); document.documentElement.lang = ''; });
const read = (p) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));

// Owner 2026-11-11 (finding 27, typed L-04): the language of the business that sent the link - /en/ = English only; a link without a
// prefix (every Israeli link, old International id links) cannot tell -> both languages, Hebrew first. Readable contrast stays.
describe('public quote not found', () => {
  const renderPath = async (p) => {
    window.history.pushState({}, '', p);
    const { findByTestId } = render(<MemoryRouter initialEntries={['/quote/00000000-0000-0000-0000-000000000000']}><Routes><Route path="/quote/:id" element={<SmartPublicQuote />} /></Routes></MemoryRouter>);
    return findByTestId('public-quote-not-found', {}, { timeout: 4000 });
  };
  afterEach(() => window.history.pushState({}, '', '/'));
  it('a link without a prefix: both languages, Hebrew first, explicit dark text on a light page', async () => {
    document.documentElement.lang = 'en';
    const el = await renderPath('/public-quote/00000000-0000-0000-0000-000000000000');
    await waitFor(() => expect(el.querySelector('h1').textContent).toBe('לא הצלחנו לפתוח את הצעת המחיר'));
    expect(el.textContent).toContain('We could not open this quote');
    expect(el.textContent.indexOf('לא הצלחנו')).toBeLessThan(el.textContent.indexOf('We could not'));
    expect(el.querySelector('[data-testid="public-quote-not-found-he"]').getAttribute('dir')).toBe('rtl');
    expect(el.querySelector('[data-testid="public-quote-not-found-en"]').getAttribute('dir')).toBe('ltr');
    expect(el.style.background).toMatch(/247, 248, 246|#f7f8f6/i);
    expect(el.querySelector('h1').style.color).toMatch(/16, 37, 43|#10252b/i);
  });
  it('an /en/ link: English only', async () => {
    document.documentElement.lang = 'he';
    const el = await renderPath('/en/public-quote/00000000-0000-0000-0000-000000000000');
    await waitFor(() => expect(el.querySelector('h1').textContent).toBe('We could not open this quote'));
    expect(el.textContent).not.toMatch(/הצעת המחיר/);
    expect(el.getAttribute('lang')).toBe('en');
  });
});

describe('sign-up message', () => {
  // Codex SEC-FE-05 (Owner console 2026-10-30, L-12): without a session the answer is the same for a new address and an address that
  // already has an account (it says a verification email was sent if the address is new); with a real new session it keeps "setting up"
  it('without a session the message is the uniform verification answer; with a session it keeps "setting up"', () => {
    const d = read('pages/Dashboard.jsx');
    expect(d).toContain("? (bundleIsHebrew ? 'ההרשמה הצליחה! מאתחל את החשבון...' : 'Sign up successful! Setting up your account...')");
    expect(d).toContain("'אם הכתובת עוד לא רשומה, שלחנו אליה מייל לאימות - פתחו את הקישור שבו כדי להפעיל את החשבון. אם כבר יש לכם חשבון, התחברו או אפסו את הסיסמה.'");
    expect(d).not.toContain(".eq('email', emailInput.trim())");
    expect(d).not.toContain('כתובת המייל כבר רשומה במערכת');
  });
});
