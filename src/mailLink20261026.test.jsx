// Owner console 2026-10-26 (typed: "מאשר את התוכנית א עד ז בשחרור אחד ...", item ז): every mail link opens the in-app mail window
// (address + Copy, subject, Gmail / Outlook / mail app) - HE + EN; the anchor keeps its mailto href.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import MailLink from './components/MailLink';
import { mailComposeLinks, parseMailto } from './shared/mailCompose';

afterEach(() => cleanup());
const HREF = 'mailto:support@tekango.com?subject=%D7%91%D7%A7%D7%A9%D7%AA%20%D7%91%D7%99%D7%98%D7%95%D7%9C%20%D7%9E%D7%A0%D7%95%D7%99&body=%D7%A9%D7%9C%D7%95%D7%9D';

describe('mailCompose', () => {
  it('reads a mailto (address, subject, body) and refuses anything else', () => {
    expect(parseMailto(HREF)).toEqual({ to: 'support@tekango.com', subject: 'בקשת ביטול מנוי', body: 'שלום' });
    expect(parseMailto('mailto:info@tekango.com')).toEqual({ to: 'info@tekango.com', subject: '', body: '' });
    expect(parseMailto('https://x.test')).toBeNull();
    expect(parseMailto('mailto:not-an-address')).toBeNull();
  });
  it('builds Gmail, Outlook on the web and mailto with every value encoded, empty parts left out', () => {
    const l = mailComposeLinks({ to: 'support@tekango.com', subject: 'בקשת ביטול מנוי', body: 'a&b' });
    expect(l.gmail).toBe('https://mail.google.com/mail/?view=cm&fs=1&to=support%40tekango.com&su=%D7%91%D7%A7%D7%A9%D7%AA%20%D7%91%D7%99%D7%98%D7%95%D7%9C%20%D7%9E%D7%A0%D7%95%D7%99&body=a%26b');
    expect(l.outlook).toBe('https://outlook.live.com/mail/0/deeplink/compose?to=support%40tekango.com&subject=%D7%91%D7%A7%D7%A9%D7%AA%20%D7%91%D7%99%D7%98%D7%95%D7%9C%20%D7%9E%D7%A0%D7%95%D7%99&body=a%26b');
    expect(l.mailto).toBe('mailto:support@tekango.com?subject=%D7%91%D7%A7%D7%A9%D7%AA%20%D7%91%D7%99%D7%98%D7%95%D7%9C%20%D7%9E%D7%A0%D7%95%D7%99&body=a%26b');
    expect(mailComposeLinks({ to: 'info@tekango.com' })).toEqual({ mailto: 'mailto:info@tekango.com',
      gmail: 'https://mail.google.com/mail/?view=cm&fs=1&to=info%40tekango.com', outlook: 'https://outlook.live.com/mail/0/deeplink/compose?to=info%40tekango.com' });
  });
});

describe.each([
  [true, 'rtl', 'שליחת מייל', 'העתקת הכתובת', 'הכתובת הועתקה', 'פתיחה בג׳ימייל', 'פתיחה באאוטלוק', 'פתיחה בתוכנת המייל'],
  [false, 'ltr', 'Send an email', 'Copy the address', 'Address copied', 'Open in Gmail', 'Open in Outlook', 'Open in your mail app'],
])('MailLink (isHebrew %s)', (isHebrew, dir, title, copy, copied, gmail, outlook, app) => {
  it('keeps the mailto href; a click opens the window instead of the mail app', () => {
    render(<MailLink href={HREF} isHebrew={isHebrew}>link</MailLink>);
    const a = screen.getByText('link');
    expect(a.getAttribute('href')).toBe(HREF);
    expect(fireEvent.click(a)).toBe(false); // the default (the mail app) is prevented
    const d = screen.getByTestId('mail-compose');
    expect(d).toHaveAttribute('dir', dir);
    expect(d).toHaveAttribute('role', 'dialog');
    expect(d.textContent).toContain(title);
    expect(screen.getByTestId('mail-compose-to').textContent).toBe('support@tekango.com');
    expect(screen.getByTestId('mail-compose-to')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByTestId('mail-compose-subject').textContent).toBe('בקשת ביטול מנוי');
    expect(screen.getByTestId('mail-compose-gmail').textContent).toBe(gmail);
    expect(screen.getByTestId('mail-compose-gmail').getAttribute('href')).toMatch(/^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=support%40tekango\.com&su=/);
    expect(screen.getByTestId('mail-compose-gmail')).toHaveAttribute('target', '_blank');
    expect(screen.getByTestId('mail-compose-outlook').textContent).toBe(outlook);
    expect(screen.getByTestId('mail-compose-app').textContent).toBe(app);
    expect(screen.getByTestId('mail-compose-app').getAttribute('href')).toBe(HREF);
    expect(screen.getByTestId('mail-compose-copy').textContent).toBe(copy);
  });
  it('Copy puts the address on the clipboard and says so; Escape closes the window', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<MailLink href={HREF} isHebrew={isHebrew}>link</MailLink>);
    fireEvent.click(screen.getByText('link'));
    fireEvent.click(screen.getByTestId('mail-compose-copy'));
    await waitFor(() => expect(screen.getByTestId('mail-compose-copy-status').textContent).toBe(copied));
    expect(writeText).toHaveBeenCalledWith('support@tekango.com');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('mail-compose')).toBeNull();
  });
  it('a blocked clipboard never claims success', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('denied'); }) }, configurable: true });
    render(<MailLink href={HREF} isHebrew={isHebrew}>link</MailLink>);
    fireEvent.click(screen.getByText('link'));
    fireEvent.click(screen.getByTestId('mail-compose-copy'));
    await waitFor(() => expect(screen.getByTestId('mail-compose-copy-status').textContent).not.toBe(copied));
  });
});

describe('every mail link in the app goes through MailLink (no bare mailto anchor left)', () => {
  const FILES = ['components/PricingModal.jsx', 'components/SettingsTab.jsx', 'components/SmartPackAddOnOffer.jsx', 'components/NotificationCenter.jsx',
    'components/BusinessCard.jsx', 'pages/Contact.jsx', 'components/AccessibilityModal.jsx', 'pages/LandingLocal.jsx', 'pages/LandingGlobal.jsx'];
  it.each(FILES)('%s', (f) => {
    const s = readFileSync(join(cwd(), 'src', f), 'utf8');
    expect(s).toContain('<MailLink ');
    expect(s).not.toMatch(/<a [^>]*href=["{`]+mailto:/);
  });
  it('the English pages use the English mailbox (info@) for contact', () => {
    const s = readFileSync(join(cwd(), 'src', 'pages', 'LandingGlobal.jsx'), 'utf8');
    expect(s).not.toContain('support@tekango.com');
  });
});
