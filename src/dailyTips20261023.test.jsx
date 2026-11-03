// Owner console 2026-10-23: the daily tip ("הידעתם?") - one a day at most, chosen by where the user is, never repeated, can be turned off;
// a small corner card that never blocks the work. HE / RTL and EN / LTR.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { DAILY_TIPS, pickDailyTip, parseTipState, markTipShown, turnTipsOff, firstUnsentQuote, tipStorageKey } from './utils/dailyTips';
import DailyTipCard, { AUTO_HIDE_MS } from './components/DailyTipCard';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const draft = { status: 'draft', view_count: 0, quote_items: [{ description: 'צביעת דירה' }] };
const sent = { status: 'sent', view_count: 0, quote_items: [{ description: 'x' }] };
const ctx = (o = {}) => ({ quotesCount: 0, unsentQuote: null, mobile: false, voice: false, ...o });

describe('choosing the daily tip', () => {
  it('the place decides: an unsent quote = Customer check first; nothing yet = the smart chat', () => {
    const s = parseTipState(null);
    expect(pickDailyTip(ctx({ quotesCount: 4, unsentQuote: draft }), s, '2026-10-23').id).toBe('twin_before_send');
    expect(pickDailyTip(ctx({ quotesCount: 1 }), s, '2026-10-23').id).toBe('smart_quote');
    expect(pickDailyTip(ctx(), s, '2026-10-23').id).toBe('ai_chat');
    expect(pickDailyTip(ctx({ mobile: true, voice: true }), s, '2026-10-23').id).toBe('voice');
  });
  it('one a day at most; a seen tip never returns; off = none', () => {
    let s = markTipShown(parseTipState(null), 'twin_before_send', '2026-10-23');
    expect(pickDailyTip(ctx({ unsentQuote: draft }), s, '2026-10-23')).toBeNull();
    expect(pickDailyTip(ctx({ unsentQuote: draft, quotesCount: 5 }), s, '2026-10-24').id).toBe('smart_quote');
    s = turnTipsOff(s);
    expect(pickDailyTip(ctx({ quotesCount: 5 }), s, '2026-10-25')).toBeNull();
    for (const id of DAILY_TIPS.map((t) => t.id)) s = markTipShown({ ...s, off: false }, id, '2026-10-26');
    expect(pickDailyTip(ctx({ quotesCount: 9, unsentQuote: draft, mobile: true, voice: true }), s, '2026-10-27')).toBeNull();
  });
  it('the stored state is read safely; the key is per user', () => {
    expect(parseTipState('{bad')).toEqual({ seen: [], seenAt: {}, seenInfo: {}, last: null, off: false });
    expect(parseTipState(JSON.stringify({ seen: ['a', 3], seenAt: { a: '2026-10-23', b: 'x' }, last: '2026-10-23', off: true }))).toEqual({ seen: ['a'], seenAt: { a: '2026-10-23' }, seenInfo: {}, last: '2026-10-23', off: true });
    expect(tipStorageKey('u1')).not.toBe(tipStorageKey('u2'));
  });
  it('the Customer Twin moment = a saved quote never sent nor opened, with a described item', () => {
    expect(firstUnsentQuote([sent, { ...draft, view_count: 2 }, { status: 'draft', quote_items: [{ description: ' ' }] }])).toBeNull();
    expect(firstUnsentQuote([sent, draft])).toBe(draft);
  });
  it('every tip has its words in both languages and a known action', () => {
    for (const t of DAILY_TIPS) {
      expect(t.he.text && t.he.action && t.en.text && t.en.action, t.id).toBeTruthy();
      expect(['twin', 'smart_quote', 'chat', 'templates']).toContain(t.action);
    }
  });
});

describe('the tip card', () => {
  const tip = DAILY_TIPS[0];
  it('HE: "הידעתם?", the tip, its action, "הבנתי" and "לא להציג טיפים"; the TEKANGO mark; never a dialog', () => {
    vi.useFakeTimers();
    const onAction = vi.fn(); const onDismiss = vi.fn(); const onTurnOff = vi.fn();
    render(<DailyTipCard tip={tip} isHebrew onAction={onAction} onDismiss={onDismiss} onTurnOff={onTurnOff} />);
    const card = screen.getByTestId('daily-tip');
    expect(card.getAttribute('dir')).toBe('rtl');
    expect(card.getAttribute('role')).toBe('status');
    expect(card.textContent).toContain('הידעתם?');
    expect(card.querySelector('svg[data-customer-twin-icon]')).toBeTruthy();
    expect(screen.queryByTestId('daily-tip-quote')).toBeNull();
    fireEvent.click(screen.getByTestId('daily-tip-action')); expect(onAction).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('daily-tip-ok')); act(() => { vi.advanceTimersByTime(300); }); expect(onDismiss).toHaveBeenCalled(); // after the smooth exit
    fireEvent.click(screen.getByTestId('daily-tip-off')); act(() => { vi.advanceTimersByTime(300); }); expect(onTurnOff).toHaveBeenCalled();
    expect(card.querySelector('.tk-tip-bar')).toBeTruthy(); // the time-left bar
    expect(document.querySelector('[role="dialog"], [aria-modal]')).toBeNull();
  });
  it('EN / LTR; it hides by itself, but not while the pointer is on it', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<DailyTipCard tip={DAILY_TIPS[3]} isHebrew={false} onAction={() => {}} onDismiss={onDismiss} onTurnOff={() => {}} />);
    expect(screen.getByTestId('daily-tip').getAttribute('dir')).toBe('ltr');
    expect(screen.getByTestId('daily-tip').textContent).toContain('Did you know?');
    fireEvent.mouseEnter(screen.getByTestId('daily-tip'));
    act(() => { vi.advanceTimersByTime(AUTO_HIDE_MS + 1000); });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(screen.getByTestId('daily-tip'));
    act(() => { vi.advanceTimersByTime(AUTO_HIDE_MS + 300); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('the Dashboard wiring', () => {
  const src = readFileSync('src/pages/Dashboard.jsx', 'utf8');
  it('only on the quotes list with nothing else open; actions reuse the existing paths', () => {
    expect(src).toMatch(/const tipQuiet = !!tipUserId && activeTab === 'main' && !showQuoteForm && !customerTwin && !showPricingModal && !templateDialog && !showAiQuoteDraft && !showMobileNewQuoteMenu;/);
    expect(src).toMatch(/\{dailyTip && tipQuiet && \(\s*<DailyTipCard /);
    expect(src).toMatch(/tip\.action === 'smart_quote'\) handleCreateAiQuoteClick\(\)/);
    expect(src).toMatch(/tip\.action === 'templates'\) handleOpenTemplatePicker\(\)/);
    expect(src).toMatch(/tip\.action === 'chat'\) openAiChat\(\)/);
  });
});

describe('the Customer Twin tip names its quote (L-17, 23/10)', () => {
  it('the card shows the quote it means', () => {
    render(<DailyTipCard tip={{ ...DAILY_TIPS[0], quoteId: 'q1', quoteLabel: 'A1042 · שיפוץ מטבח' }} isHebrew onAction={() => {}} onDismiss={() => {}} onTurnOff={() => {}} />);
    expect(screen.getByTestId('daily-tip-quote').textContent).toBe('ההצעה: A1042 · שיפוץ מטבח');
  });
});
