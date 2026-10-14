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

describe('public quote not found', () => {
  it.each([['he', 'הצעת המחיר לא נמצאה או שפג תוקפה', /Quote not found/], ['en', 'Quote not found or expired', /הצעת המחיר/]])('%s: one language, explicit dark text on a light page', async (lang, title, other) => {
    document.documentElement.lang = lang;
    const { findByTestId } = render(<MemoryRouter initialEntries={['/quote/00000000-0000-0000-0000-000000000000']}><Routes><Route path="/quote/:id" element={<SmartPublicQuote />} /></Routes></MemoryRouter>);
    const el = await findByTestId('public-quote-not-found', {}, { timeout: 4000 });
    await waitFor(() => expect(el.querySelector('h1').textContent).toBe(title));
    expect(el.textContent).not.toMatch(other);
    expect(el.getAttribute('lang')).toBe(lang);
    expect(el.style.background).toMatch(/247, 248, 246|#f7f8f6/i);
    expect(el.querySelector('h1').style.color).toMatch(/16, 37, 43|#10252b/i);
  });
});

describe('sign-up message', () => {
  it('without a session (email verification required) the message says a verification email was sent; with a session it keeps "setting up"', () => {
    const d = read('pages/Dashboard.jsx');
    expect(d).toMatch(/setAuthSuccess\(data\?\.session\n\s*\? \(bundleIsHebrew \? 'ההרשמה הצליחה! מאתחל את החשבון\.\.\.' : 'Sign up successful! Setting up your account\.\.\.'\)\n\s*: \(bundleIsHebrew \? 'ההרשמה התקבלה\. שלחנו אליכם מייל לאימות - פתחו את הקישור שבו כדי להפעיל את החשבון\.' : 'Sign-up received\. We sent you a verification email - open the link in it to activate your account\.'\)\);/);
  });
});
