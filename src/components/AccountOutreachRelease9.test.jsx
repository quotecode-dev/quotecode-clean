// Codex release 9, topic 9 (Owner console 2026-10-30, L-12 / L-15 / L-17): the owner's own consent to optional help emails (the spec's
// words, unchecked by default, his own account only) and the unsubscribe page (a confirmation first, the withdrawal on the button,
// the same answer whatever the token), in Hebrew and English; the Privacy addition is the spec's text, word for word.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';

const rpc = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a) } }));
const { default: AccountOutreachPreferences } = await import('./AccountOutreachPreferences');
const { OUTREACH_COPY } = await import('./accountOutreachCopy');
const { default: AccountOutreachUnsubscribe } = await import('../pages/AccountOutreachUnsubscribe');

afterEach(cleanup);
beforeEach(() => rpc.mockReset());

describe('the consent in Settings', () => {
  it.each([true, false])('isHebrew=%s: the spec text, unchecked until the owner ticks it; ticking saves his own choice', async (he) => {
    const client = { rpc: vi.fn(async (name) => (name === 'account_outreach_get' ? { data: { optionalHelp: false }, error: null } : { data: { optionalHelp: true }, error: null })) };
    render(<AccountOutreachPreferences isHebrew={he} client={client} />);
    const box = await screen.findByTestId('settings-outreach-checkbox');
    await waitFor(() => expect(box.disabled).toBe(false));
    expect(box.checked).toBe(false);
    expect(screen.getByTestId('settings-outreach').textContent).toContain(he ? 'אפשר לשלוח לי הודעות עזרה יזומות על השימוש ב-TEKANGO. אפשר להפסיק בכל עת.'
      : 'You may send me optional help emails about using TEKANGO. I can stop them at any time.');
    fireEvent.click(box);
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('account_outreach_set', { p_optional_help: true }));
    expect((await screen.findByTestId('settings-outreach-notice')).textContent).toBe(he ? OUTREACH_COPY.he.savedOn : OUTREACH_COPY.en.savedOn);
    expect(box.checked).toBe(true);
  });
  it('a failed read never shows a checkbox that could be wrong', async () => {
    const client = { rpc: vi.fn(async () => ({ data: null, error: { code: '42501' } })) };
    render(<AccountOutreachPreferences isHebrew client={client} />);
    expect((await screen.findByTestId('settings-outreach-load-failed')).textContent).toBe(OUTREACH_COPY.he.loadFailed);
    expect(screen.queryByTestId('settings-outreach-checkbox')).toBeNull();
  });
  it('a refused save keeps the old state and says so', async () => {
    const client = { rpc: vi.fn(async (name) => (name === 'account_outreach_get' ? { data: { optionalHelp: true }, error: null } : { data: null, error: { code: 'x' } })) };
    render(<AccountOutreachPreferences isHebrew={false} client={client} />);
    const box = await screen.findByTestId('settings-outreach-checkbox');
    await waitFor(() => expect(box.checked).toBe(true));
    fireEvent.click(box);
    expect((await screen.findByTestId('settings-outreach-notice')).textContent).toBe(OUTREACH_COPY.en.failed);
    expect(box.checked).toBe(true);
  });
});

describe('the unsubscribe page', () => {
  const at = (search) => window.history.replaceState(null, '', `/he/unsubscribe${search}`);
  it.each([true, false])('isHebrew=%s: opening the link changes nothing; the button withdraws; the token leaves the address bar', async (he) => {
    at(`?t=${'a'.repeat(64)}`);
    rpc.mockResolvedValue({ data: true, error: null });
    render(<AccountOutreachUnsubscribe isHebrew={he} />);
    expect(rpc).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    fireEvent.click(screen.getByTestId('outreach-unsubscribe-button'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('outreach_unsubscribe', { p_token: 'a'.repeat(64) }));
    expect((await screen.findByTestId('outreach-unsubscribe-done')).textContent).toBe(he
      ? 'בוצע. לא יישלחו אליכם יותר הודעות עזרה יזומות. אפשר לחזור ולבקש אותן בהגדרות החשבון.'
      : 'Done. No more optional help emails will be sent to you. You can turn them on again in your account settings.');
    expect(screen.getByTestId('outreach-unsubscribe').getAttribute('dir')).toBe(he ? 'rtl' : 'ltr');
  });
  it('a broken link asks for the email again and sends nothing', async () => {
    at('?t=nope');
    render(<AccountOutreachUnsubscribe isHebrew />);
    expect(screen.getByTestId('outreach-unsubscribe-missing')).toBeTruthy();
    expect(screen.queryByTestId('outreach-unsubscribe-button')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('the Privacy page carries the spec addition, word for word', () => {
  const p = readFileSync('src/pages/Privacy.jsx', 'utf8');
  it('Hebrew and English', () => {
    expect(p).toContain('נוכל להכין הצעות לעזרה אישית על סמך אירועים תפעוליים בחשבון, כגון תחילת השימוש, מצב מסלול או תשלום והצעות שממתינות לאישור. הודעות עזרה יזומות שאינן נדרשות להפעלת השירות יישלחו רק לאחר הסכמה נפרדת, ואפשר להסירן בכל עת. הודעה נשלחת רק לאחר בדיקת הצוות ואישור התוכן והנמען.');
    expect(p).toContain('We may prepare individual help drafts using account events such as onboarding, plan or payment status, and quotes awaiting approval. Optional proactive help emails require separate consent and can be stopped at any time. A message is sent only after our team reviews and approves its content and recipient.');
  });
});
