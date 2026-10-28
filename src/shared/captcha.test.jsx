// Owner console 2026-10-20 (L-12): the robot check on signup / login / password reset, and its Privacy line.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, cleanup } from '@testing-library/react';
import { turnstileSiteKey, TURNSTILE_SITE_KEY_LIVE, TURNSTILE_SITE_KEY_TEST, setCaptchaToken, takeCaptchaToken, onCaptchaReset } from './captcha';
import { normalizeAuthError, isCaptchaError } from '../utils/authErrorClassification';
import AuthScreen from '../components/AuthScreen';

afterEach(() => cleanup());

describe('the robot check (Cloudflare Turnstile)', () => {
  it('the real widget only on the LIVE hostnames; the always-pass test key everywhere else', () => {
    expect(turnstileSiteKey('www.tekango.com')).toBe(TURNSTILE_SITE_KEY_LIVE);
    expect(turnstileSiteKey('tekango.com')).toBe(TURNSTILE_SITE_KEY_LIVE);
    for (const h of ['127.0.0.1', 'localhost', 'tekango.com.evil.test', 'test.tekango.com', '']) expect(turnstileSiteKey(h)).toBe(TURNSTILE_SITE_KEY_TEST);
  });
  it('a token is single use: taking it clears it and asks that form\'s widget for a new one', () => {
    const seen = [];
    const off = onCaptchaReset((slot) => seen.push(slot));
    setCaptchaToken('auth', 'tok-1');
    expect(takeCaptchaToken('auth')).toBe('tok-1');
    expect(takeCaptchaToken('auth')).toBeUndefined();
    setCaptchaToken('reset', 'tok-2');
    expect(takeCaptchaToken('reset')).toBe('tok-2');
    expect(seen).toEqual(['auth', 'auth', 'reset']);
    off();
  });
  it('a refused check says so in both languages (never "check your credentials")', () => {
    const err = { message: 'captcha protection: request disallowed (captcha verification process failed)', code: 'captcha_failed' };
    expect(isCaptchaError(err)).toBe(true);
    expect(isCaptchaError({ message: 'Invalid login credentials' })).toBe(false);
    expect(normalizeAuthError(err, true)).toEqual({ category: 'captcha_failed', message: 'בדיקת האבטחה לא הושלמה. המתינו לסימון שהבדיקה עברה, ונסו שוב.' });
    expect(normalizeAuthError(err, false).message).toBe('The security check did not complete. Wait until the check shows it passed, then try again.');
  });
  it('the login / signup form and the reset form each carry the check; the three Auth calls send the token', () => {
    vi.stubGlobal('scrollTo', () => {});
    render(<AuthScreen isSignUp setIsSignUp={() => {}} handleAuth={(e) => e.preventDefault()} emailInput="" setEmailInput={() => {}} passwordInput="" setPasswordInput={() => {}} forgotOpen setForgotOpen={() => {}} resetEmail="" setResetEmail={() => {}} handleResetSubmit={(e) => e.preventDefault()} />);
    expect(screen.getByTestId('turnstile-auth')).toBeTruthy();
    expect(screen.getByTestId('turnstile-reset')).toBeTruthy();
    // line endings differ between checkouts (CRLF on Windows checkouts) - compare on LF
    const dash = readFileSync('src/pages/Dashboard.jsx', 'utf8').replace(/\r\n/g, '\n');
    expect(dash).toMatch(/captchaToken: takeCaptchaToken\('auth'\),\n\s+data: \{/);
    // Owner 2026-10-25 (typed L-12): the address is trimmed before it reaches Auth
    expect(dash).toMatch(/signInWithPassword\(\{ email: emailInput\.trim\(\), password: passwordInput, options: \{ captchaToken: takeCaptchaToken\('auth'\) \} \}\)/);
    expect(dash).toMatch(/captchaToken: takeCaptchaToken\('reset'\),\n\s+\}\)\);/);
    expect(dash).toMatch(/privacy_version: '2026-10-25'/);
    // 20261029000000 (Codex F19): the consent record names the versions of the documents linked at signup (their 'last updated' date)
    const day = (f) => { const m = readFileSync(`src/pages/${f}`, 'utf8').match(/Last updated: October (\d+), 2026/); return m ? `2026-10-${m[1].padStart(2, '0')}` : null; };
    expect(dash).toContain(`terms_version: '${day('Terms.jsx')}'`);
    expect(dash).toContain(`privacy_version: '${day('Privacy.jsx')}'`);
  });
  it('the admin password re-check runs with the secret key, which Auth exempts from captcha (protected actions keep working)', () => {
    const src = readFileSync('supabase/functions/admin-reauth-verify/index.ts', 'utf8').replace(/\r\n/g, '\n');
    expect(src).toMatch(/const checkClient = createClient\(supabaseUrl, secretKey, \{ auth: \{ persistSession: false, autoRefreshToken: false \} \}\);/);
    expect(src).not.toMatch(/createClient\(supabaseUrl, anonKey\);/);
  });
  it('the Privacy Policy names the check and what it sends, in Hebrew and English, dated 25 October 2026 (consent by location, Owner 2026-10-23; payments section updated 2026-10-25)', () => {
    const p = readFileSync('src/pages/Privacy.jsx', 'utf8').replace(/\r\n/g, '\n');
    expect(p).toContain('בדיקת אבטחה של Cloudflare (Turnstile) שחוסמת רובוטים');
    expect(p).toContain('a Cloudflare security check (Turnstile) to block bots');
    expect(p).toContain('עדכון אחרון: 25 באוקטובר 2026');
    expect(p).toContain('Last updated: October 25, 2026');
  });
});
