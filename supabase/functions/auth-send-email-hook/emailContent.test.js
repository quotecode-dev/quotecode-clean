import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { buildEmailContent, buildVerifyUrl, escapeHtml, isHebrewMarket, senderAddressFor } from './emailContent.ts';

// Post-LIVE Wave 1 (Track A) - static validation of the proposed Auth email content.
const PROD_AUTH = 'https://ixabnzhjeqevtbhdfswv.supabase.co';
const ACTIONS = ['signup', 'recovery', 'magiclink', 'email_change_current', 'email_change_new', 'invite', 'reauthentication'];
const HEBREW = /[֐-׿]/;
const FORBIDDEN = [/proflow/i, /quotecode/i, /ljfizgrdyzxddswcedwr/, /localhost/i, /127\.0\.0\.1/, /192\.168\./, /:5186/];

const verifyFor = (action) => buildVerifyUrl(PROD_AUTH, 'hash_abc', action, 'https://www.tekango.com/dashboard?lang=he');

describe('auth-send-email-hook content', () => {
  it('market selection: only signup_market === "Local" is Hebrew; everything else fails closed to English', () => {
    expect(isHebrewMarket({ signup_market: 'Local' })).toBe(true);
    for (const md of [{ signup_market: 'International' }, { signup_market: 'local' }, {}, null, undefined, { signup_market: 'IL' }]) {
      expect(isHebrewMarket(md)).toBe(false);
    }
  });

  it('sender identity per market (TEKANGO, tekango.com)', () => {
    expect(senderAddressFor(true)).toBe('TEKANGO Support <support@tekango.com>');
    expect(senderAddressFor(false)).toBe('TEKANGO <info@tekango.com>');
  });

  it('verify URL is built on the Auth API base, never a payload host', () => {
    const u = new URL(verifyFor('recovery'));
    expect(u.origin).toBe(PROD_AUTH);
    expect(u.pathname).toBe('/auth/v1/verify');
    expect(u.searchParams.get('type')).toBe('recovery');
    expect(u.searchParams.get('redirect_to')).toBe('https://www.tekango.com/dashboard?lang=he');
  });

  for (const action of ACTIONS) {
    it(`${action}: TEKANGO-branded, single-language HE and EN, no ProFlow / TEST / LAN reference`, () => {
      const he = buildEmailContent(action, true, verifyFor(action), 'user@example.com');
      const en = buildEmailContent(action, false, verifyFor(action), 'user@example.com');
      for (const c of [he, en]) {
        const all = `${c.subject}\n${c.html}\n${c.text}`;
        expect(all).toContain('TEKANGO');
        for (const re of FORBIDDEN) expect(all).not.toMatch(re);
      }
      expect(he.subject).toMatch(HEBREW);
      expect(he.html).toContain('dir="rtl"');
      expect(he.html).toContain('lang="he"');
      expect(en.html).toContain('dir="ltr"');
      expect(en.html).toContain('lang="en"');
      // English email carries no Hebrew text at all (market separation)
      expect(`${en.subject}${en.html}${en.text}`).not.toMatch(HEBREW);
      // the link is present in both the HTML (attribute-escaped) and the plain-text part
      expect(he.text).toContain(verifyFor(action));
      expect(en.html).toContain(escapeHtml(verifyFor(action)));
    });
  }

  it('the recipient address is HTML-escaped where interpolated', () => {
    const c = buildEmailContent('recovery', false, verifyFor('recovery'), '<b>x</b>@example.com');
    expect(c.html).not.toContain('<b>x</b>');
    expect(c.html).toContain('&lt;b&gt;x&lt;/b&gt;@example.com');
  });

  it('the hook entry point uses the shared content module (no duplicated template copy)', () => {
    const src = readFileSync(resolve(cwd(),'supabase/functions/auth-send-email-hook/index.ts'), 'utf8');
    expect(src).toContain('from "./emailContent.ts"');
    expect(src).not.toMatch(/function buildEmailContent|function wrapEmail/);
    expect(src).not.toMatch(/proflow|quotecode/i);
  });
});
