// Owner console 2026-11-02 (stage 1 of docs/SPEC_CUSTOMER_EMAILS_2026-11-02.md): the red bar, the window on opening, the words, in Hebrew and English.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

const choice = vi.fn(async () => null);
vi.mock('./AppDialog', () => ({ askChoice: (...a) => choice(...a) }));
const { default: BillingNoticeBar } = await import('./BillingNoticeBar');
const { billingNoticeModel, timeLeftText, barText, sendReminderText, billingBellItem, popupSnoozed, snoozePopup, updateCardHref } = await import('../domain/subscriptions/billingNotices');

const NOW = Date.parse('2026-11-10T10:00:00Z');
const END = '2026-11-12T15:00:00.000Z';
const ready = (billing, o = {}) => ({ state: 'ready', planId: 'visual', market: 'IL', subscriptionStatus: 'past_due', billing: { paidThrough: null, graceEndsAt: END, inGrace: false, limited: false, renewalStopped: false, limitedReason: null, ...billing }, ...o });
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };

afterEach(() => { cleanup(); choice.mockClear(); });
beforeEach(() => { try { window.localStorage.clear(); } catch { /* jsdom */ } });

describe('who is told what', () => {
  it('a failed renewal in grace; a missing charge; limited by either', () => {
    expect(billingNoticeModel(ready({ inGrace: true }))).toMatchObject({ state: 'grace', reason: 'failed', mailbox: 'support@tekango.com' });
    expect(billingNoticeModel(ready({ inGrace: true }, { subscriptionStatus: 'active', market: 'INTERNATIONAL' }))).toMatchObject({ reason: 'no_charge', mailbox: 'info@tekango.com' });
    expect(billingNoticeModel(ready({ limited: true, limitedReason: 'payment_failed' }))).toMatchObject({ state: 'limited', reason: 'failed' });
    expect(billingNoticeModel(ready({ limited: true, limitedReason: 'period_ended' }))).toMatchObject({ state: 'limited', reason: 'no_charge' });
  });
  it('never after a cancellation, for a lifetime or free account, or before the summary is ready', () => {
    expect(billingNoticeModel(ready({ limited: true, limitedReason: 'cancelled' }))).toBeNull();
    expect(billingNoticeModel(ready({ inGrace: true, renewalStopped: true }))).toBeNull();
    expect(billingNoticeModel(ready({ inGrace: true }), true)).toBeNull();
    expect(billingNoticeModel(ready({ inGrace: true }, { planId: 'free' }))).toBeNull();
    expect(billingNoticeModel({ state: 'loading' })).toBeNull();
    expect(billingNoticeModel(ready({}))).toBeNull();
  });
});

describe('the time left', () => {
  const at = (mins) => new Date(NOW + mins * 60000).toISOString();
  it('natural Hebrew', () => {
    expect(timeLeftText(at(2 * 1440 + 300), NOW, true)).toBe('יומיים ו-5 שעות');
    expect(timeLeftText(at(1440 + 60), NOW, true)).toBe('יום אחד ושעה');
    expect(timeLeftText(at(3 * 1440), NOW, true)).toBe('3 ימים');
    expect(timeLeftText(at(120), NOW, true)).toBe('שעתיים');
    expect(timeLeftText(at(1), NOW, true)).toBe('דקה');
    expect(timeLeftText(at(-5), NOW, true)).toBe('כמה רגעים');
  });
  it('English', () => {
    expect(timeLeftText(at(2 * 1440 + 300), NOW, false)).toBe('2 days and 5 hours');
    expect(timeLeftText(at(60), NOW, false)).toBe('1 hour');
    expect(timeLeftText(at(30), NOW, false)).toBe('30 minutes');
  });
});

describe('the bar', () => {
  for (const he of [true, false]) {
    it(`${he ? 'HE' : 'EN'}: grace has the countdown and writes to the service mailbox`, () => {
      const model = billingNoticeModel(ready({ inGrace: true }));
      const { getByTestId, queryByTestId } = render(<BillingNoticeBar model={model} isHebrew={he} userId="u1" />);
      expect(getByTestId('billing-notice-text').textContent).toMatch(he ? /החיוב של המנוי לא עבר. החשבון יוגבל בעוד/ : /did not go through. Your account will be limited in/);
      expect(getByTestId('billing-notice-update').getAttribute('href')).toMatch(/^mailto:support@tekango\.com\?subject=/);
      expect(queryByTestId('billing-notice-pay')).toBeNull();
      expect(queryByTestId('billing-notice-close')).toBeNull();
      expect(getByTestId('billing-notice-bar').className).toBe('no-print');
    });
    it(`${he ? 'HE' : 'EN'}: limited has a pay button and asks nothing`, () => {
      const onPay = vi.fn();
      const model = billingNoticeModel(ready({ limited: true, limitedReason: 'payment_failed' }));
      const { getByTestId } = render(<BillingNoticeBar model={model} isHebrew={he} userId="u1" onPay={onPay} />);
      fireEvent.click(getByTestId('billing-notice-pay'));
      expect(onPay).toHaveBeenCalledTimes(1);
      expect(choice).not.toHaveBeenCalled();
    });
  }
  it('nothing to tell: nothing on the screen', () => {
    expect(render(<BillingNoticeBar model={null} isHebrew userId="u1" />).container.firstChild).toBeNull();
  });
  it('the English words have no Hebrew and no shekel', () => {
    for (const reason of ['failed', 'no_charge']) {
      for (const state of ['grace', 'limited']) {
        const text = barText({ state, reason, endsAt: END, mailbox: 'info@tekango.com' }, NOW, false);
        expect(text).not.toMatch(/[א-ת]|₪/);
        expect(text).toMatch(/your|Your/);
      }
    }
  });
});

describe('the window on opening', () => {
  const model = () => billingNoticeModel(ready({ inGrace: true, graceEndsAt: new Date(Date.now() + 86400000).toISOString() }));
  it('opens once per opening of the app, with the two answers', async () => {
    const { rerender } = render(<BillingNoticeBar model={model()} isHebrew userId="u1" />);
    rerender(<BillingNoticeBar model={model()} isHebrew userId="u1" />);
    await waitFor(() => expect(choice).toHaveBeenCalledTimes(1));
    expect(choice.mock.calls[0][2]).toMatchObject({ options: [{ value: 'update', label: 'עדכון כרטיס עכשיו' }], cancel: 'אזכיר לי אחר כך' });
  });
  it('"remind me later" hides it for 4 hours only', () => {
    const s = memory();
    expect(popupSnoozed('u1', NOW, s)).toBe(false);
    snoozePopup('u1', NOW, s);
    expect(popupSnoozed('u1', NOW + 3.9 * 3600000, s)).toBe(true);
    expect(popupSnoozed('u1', NOW + 4 * 3600000, s)).toBe(false);
    expect(popupSnoozed('u2', NOW, s)).toBe(false);
  });
  it('storage that cannot be read never hides it', () => {
    expect(popupSnoozed('u1', NOW, { getItem() { throw new Error('blocked'); } })).toBe(false);
  });
  it('a limited account gets no window', async () => {
    render(<BillingNoticeBar model={billingNoticeModel(ready({ limited: true, limitedReason: 'period_ended' }))} isHebrew userId="u1" />);
    await new Promise((r) => setTimeout(r, 10));
    expect(choice).not.toHaveBeenCalled();
  });
});

describe('the reminder before a send and the bell', () => {
  const grace = { state: 'grace', reason: 'failed', endsAt: END, mailbox: 'support@tekango.com' };
  it('the reminder says the send is still allowed', () => {
    expect(sendReminderText(grace, NOW, true)).toContain('אפשר עדיין לשלוח');
    expect(sendReminderText(grace, NOW, false)).toContain('You can still send');
  });
  it('the bell item is pinned, opens the plans, and a new episode is a new item', () => {
    const item = billingBellItem(grace);
    expect(item).toMatchObject({ kind: 'announce', action: 'plans', pinned: true });
    expect(item.key).toMatch(/^announce:billing-grace:\d{12}$/);
    expect(billingBellItem({ ...grace, endsAt: '2026-12-01T10:00:00.000Z' }).key).not.toBe(item.key);
    expect(billingBellItem(null)).toBeNull();
  });
  it('the mail subject is encoded', () => {
    expect(updateCardHref(grace, false)).toBe('mailto:support@tekango.com?subject=Update%20the%20card%20of%20my%20TEKANGO%20subscription');
  });
});
