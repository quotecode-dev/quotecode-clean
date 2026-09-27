import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { buildEmailContent, buildVerifyUrl, escapeHtml, isHebrewMarket, senderAddressFor } from './emailContent.ts';

// Post-LIVE Wave 1 (Track A) - static validation of the Auth email content, per MESSAGE kind (Codex blocker 1
// remediation: message kinds, not invented hook action names; which messages a payload produces is tested in
// handler.test.js).
const PROD_AUTH = 'https://ixabnzhjeqevtbhdfswv.supabase.co';
const HEBREW = /[֐-׿]/;
const FORBIDDEN = [/proflow/i, /quotecode/i, /ljfizgrdyzxddswcedwr/, /localhost/i, /127\.0\.0\.1/, /192\.168\./, /:5186/];

const verifyFor = (type) => buildVerifyUrl(PROD_AUTH, 'hash_abc', type, 'https://www.tekango.com/dashboard?lang=he');
const TO = 'user@example.com';

const LINK_MESSAGES = [
  { kind: 'signup', to: TO, verifyUrl: verifyFor('signup') },
  { kind: 'recovery', to: TO, verifyUrl: verifyFor('recovery') },
  { kind: 'magiclink', to: TO, verifyUrl: verifyFor('magiclink') },
  { kind: 'invite', to: TO, verifyUrl: verifyFor('invite') },
  { kind: 'email_change_confirm_current', to: TO, verifyUrl: verifyFor('email_change'), newEmail: 'new@example.com' },
  { kind: 'email_change_confirm_new', to: 'new@example.com', verifyUrl: verifyFor('email_change') },
];
const NO_LINK_MESSAGES = [
  { kind: 'reauthentication', to: TO, code: '482913' },
  ...[
    'password_changed_notification', 'email_changed_notification', 'phone_changed_notification', 'identity_linked_notification',
    'identity_unlinked_notification', 'mfa_factor_enrolled_notification', 'mfa_factor_unenrolled_notification',
  ].map((kind) => ({ kind, to: TO, details: { email: TO, oldEmail: 'old@example.com', provider: 'google', factorType: 'totp' } })),
];

describe('auth-send-email-hook content', () => {
  it('market selection: only signup_market === "Local" is Hebrew; everything else fails closed to English (never Local)', () => {
    expect(isHebrewMarket({ signup_market: 'Local' })).toBe(true);
    for (const md of [{ signup_market: 'International' }, { signup_market: 'local' }, {}, null, undefined, { signup_market: 'IL' }, { signup_market: 'Unknown' }, { signup_market: 'LCL' }]) {
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

  for (const message of [...LINK_MESSAGES, ...NO_LINK_MESSAGES]) {
    it(`${message.kind}: TEKANGO-branded, single-language HE and EN, no ProFlow / TEST / LAN reference`, () => {
      const he = buildEmailContent(message, true);
      const en = buildEmailContent(message, false);
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
    });
  }

  for (const message of LINK_MESSAGES) {
    it(`${message.kind}: the link is present in the HTML CTA (attribute-escaped) and in the plain-text part`, () => {
      for (const c of [buildEmailContent(message, true), buildEmailContent(message, false)]) {
        expect(c.text).toContain(message.verifyUrl);
        expect(c.html).toContain(`href="${escapeHtml(message.verifyUrl)}"`);
      }
    });
  }

  for (const message of NO_LINK_MESSAGES) {
    it(`${message.kind}: no link, no button (not a verification email)`, () => {
      for (const c of [buildEmailContent(message, true), buildEmailContent(message, false)]) {
        expect(`${c.html}${c.text}`).not.toMatch(/<a\s|https?:\/\//i);
      }
    });
  }

  it('the recipient address and payload-provided values are HTML-escaped where interpolated', () => {
    const c = buildEmailContent({ kind: 'recovery', to: '<b>x</b>@example.com', verifyUrl: verifyFor('recovery') }, false);
    expect(c.html).not.toContain('<b>x</b>');
    expect(c.html).toContain('&lt;b&gt;x&lt;/b&gt;@example.com');
    const n = buildEmailContent({ kind: 'identity_linked_notification', to: TO, details: { provider: '<img src=x>' } }, false);
    expect(n.html).not.toContain('<img');
    const ec = buildEmailContent({ kind: 'email_change_confirm_current', to: TO, verifyUrl: verifyFor('email_change'), newEmail: '"><script>@x.y' }, true);
    expect(ec.html).not.toContain('<script>');
  });

  it('the hook entry point only wires Deno into the shared handler (no duplicated template copy)', () => {
    const src = readFileSync(resolve(cwd(), 'supabase/functions/auth-send-email-hook/index.ts'), 'utf8');
    expect(src).toContain('from "./handler.ts"');
    expect(src).not.toMatch(/function buildEmailContent|function wrapEmail|function verifyWebhookSignature/);
    expect(src).not.toMatch(/proflow|quotecode/i);
  });
});
