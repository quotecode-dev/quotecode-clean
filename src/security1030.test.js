// Codex security follow-ups (Owner console 2026-10-30): the screen side - the send-record refusals are explained in Hebrew and English
// (SEC-EF-02), an existing sign-up address gets the uniform answer (SEC-FE-05), and the analytics tag never stays in a private page
// (SEC-FE-02).
import { describe, it, expect, vi } from 'vitest';
import { classifyQuoteEmailError } from './utils/quoteEmailErrorClassification';
import { normalizeAuthError } from './utils/authErrorClassification';
import { syncMeasurement } from './shared/siteAnalytics';

describe('SEC-EF-02: the send record refusals on the screen', () => {
  it.each([
    ['QUOTE_EMAIL_IN_PROGRESS: x', 'send_in_progress', 'ההצעה נשלחת ממש עכשיו', 'being sent right now'],
    ['QUOTE_EMAIL_COOLDOWN: x', 'send_cooldown', 'בעוד שתי דקות', 'in two minutes'],
    ['QUOTE_EMAIL_LIMIT: x', 'send_limit', 'מגבלת השליחה היומית', 'daily email sending limit'],
    ['QUOTE_EMAIL_UNKNOWN: x', 'send_unknown', 'לא יישלח פעמיים', 'will not be sent twice'],
    ['QUOTE_EMAIL_UNVERIFIED: x', 'send_unverified', 'לא ניתן היה לרשום', 'could not be recorded'],
  ])('%s -> %s (HE / EN)', (msg, category, he, en) => {
    expect(classifyQuoteEmailError(msg, true)).toMatchObject({ category });
    expect(classifyQuoteEmailError(msg, true).userMessage).toContain(he);
    expect(classifyQuoteEmailError(msg, false).userMessage).toContain(en);
  });
});

describe('SEC-FE-05: one sign-up answer', () => {
  it('a duplicate sign-up error reads exactly like the new-address answer, in both languages', () => {
    const err = { message: 'User already registered' };
    expect(normalizeAuthError(err, true).message).toBe('אם הכתובת עוד לא רשומה, שלחנו אליה מייל לאימות - פתחו את הקישור שבו כדי להפעיל את החשבון. אם כבר יש לכם חשבון, התחברו או אפסו את הסיסמה.');
    expect(normalizeAuthError(err, false).message).toMatch(/^If this address is not registered yet/);
  });
});

describe('SEC-FE-02: the analytics tag and a private page', () => {
  const win = (pathname, loaded) => {
    const reload = vi.fn();
    return { reload, w: { __tekangoGtagLoaded: loaded, location: { pathname, search: '', hash: '', hostname: 'www.tekango.com', origin: 'https://www.tekango.com', reload } } };
  };
  const doc = { referrer: '', title: 't', head: { appendChild: () => {} }, createElement: () => ({}) };
  it('entering a quote / the app with the tag in memory loads the page once more from the server', () => {
    const { w, reload } = win('/q/11111111-1111-4111-8111-111111111111', true);
    expect(syncMeasurement({ isHebrew: true, consent: 'granted', win: w, doc, authContext: false })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('a fresh private page (no tag loaded) never reloads - no loop', () => {
    const { w, reload } = win('/q/11111111-1111-4111-8111-111111111111', false);
    syncMeasurement({ isHebrew: true, consent: 'granted', win: w, doc, authContext: false });
    expect(reload).not.toHaveBeenCalled();
  });
});
