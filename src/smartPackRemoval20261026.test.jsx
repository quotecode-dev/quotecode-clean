// Owner console 2026-10-26 (typed: "מאשר הסרת חכם פלוס בשירות עצמי: בחודשי בסוף התקופה ששולמה בלי החזר, בשנתי לפי סעיף 6, כולל שינוי
// ב-L-14, L-17 ו-L-22"): the subscriber removes SMART PACK in the plans window - the date and the refund are the server's; Hebrew and
// English say the same; the landing pages and the chat facts say it can be removed (never "write to us").
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import SmartPackRemoval from './components/SmartPackRemoval';
import { smartPackRemovalAvailable } from './domain/subscriptions/packageCheckout';

const read = (...p) => readFileSync(join(cwd(), ...p), 'utf8');
const AT = '2026-11-25T15:48:24.917Z';
const invokeFor = (quote, request = { ok: true, state: 'removed', effectiveAt: AT, refundMinor: quote.refundMinor ?? 0 }) => vi.fn(async (_n, { body }) => ({
  data: body.action === 'smart_pack_removal_quote' ? quote : request,
}));
const month = { ok: true, period: 'month', effectiveAt: AT, refundMinor: 0, recurringMinor: 1000, feeMinor: 0 };
const year = { ok: true, period: 'year', effectiveAt: AT, refundMinor: 2300, recurringMinor: 10200, feeMinor: 510 };

describe('the removal in the plans window', () => {
  it('Hebrew monthly: the date, no refund; confirmed -> one request with an idempotency key, then "runs until ... will not renew"', async () => {
    const invoke = invokeFor(month);
    const onDone = vi.fn();
    render(<SmartPackRemoval isHebrew invoke={invoke} onDone={onDone} />);
    fireEvent.click(await screen.findByTestId('plans-smart-pack-remove'));
    const text = screen.getByTestId('plans-smart-pack-removal-text').textContent;
    expect(text).toContain('להסיר את חכם פלוס? הוא ימשיך לפעול עד 25/11/2026 ולא יתחדש.');
    expect(text).toContain('אין החזר על החודש ששולם.');
    expect(screen.getByTestId('plans-smart-pack-removal-confirm').getAttribute('dir')).toBe('rtl');
    await act(async () => { fireEvent.click(screen.getByTestId('plans-smart-pack-removal-yes')); });
    expect((await screen.findByTestId('plans-smart-pack-removal-done')).textContent).toBe('חכם פלוס יפעל עד 25/11/2026 ולא יתחדש.');
    const req = invoke.mock.calls.find(([, { body }]) => body.action === 'smart_pack_removal_request')[1].body;
    expect(Object.keys(req).sort()).toEqual(['action', 'idempotencyKey']);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('English yearly: the section 6 refund from the server, then the refund line', async () => {
    render(<SmartPackRemoval isHebrew={false} invoke={invokeFor(year)} />);
    fireEvent.click(await screen.findByTestId('plans-smart-pack-remove'));
    const text = screen.getByTestId('plans-smart-pack-removal-text').textContent;
    expect(text).toContain('Remove SMART PACK? It keeps working until 25/11/2026 and will not renew.');
    expect(text).toContain('₪23.00 is refunded - pro rata less the cancellation fee, as set out in section 6 of the Terms.');
    expect(screen.getByTestId('plans-smart-pack-removal-confirm').getAttribute('dir')).toBe('ltr');
    await act(async () => { fireEvent.click(screen.getByTestId('plans-smart-pack-removal-yes')); });
    expect((await screen.findByTestId('plans-smart-pack-removal-done')).textContent)
      .toBe('SMART PACK runs until 25/11/2026 and will not renew. A refund of ₪23.00 goes back to your card.');
  });
  it('"No, keep it" changes nothing; a refused change says SMART PACK stays and how to reach us', async () => {
    const invoke = invokeFor(month, { ok: true, state: 'refused', effectiveAt: AT, refundMinor: 0 });
    render(<SmartPackRemoval isHebrew invoke={invoke} />);
    fireEvent.click(await screen.findByTestId('plans-smart-pack-remove'));
    fireEvent.click(screen.getByTestId('plans-smart-pack-removal-no'));
    expect(screen.getByTestId('plans-smart-pack-remove')).toBeTruthy();
    expect(invoke.mock.calls.some(([, { body }]) => body.action === 'smart_pack_removal_request')).toBe(false);
    fireEvent.click(screen.getByTestId('plans-smart-pack-remove'));
    await act(async () => { fireEvent.click(screen.getByTestId('plans-smart-pack-removal-yes')); });
    expect((await screen.findByTestId('plans-smart-pack-removal-done')).textContent).toContain('לא הצלחנו להסיר את חכם פלוס כרגע, והוא נשאר במנוי.');
  });
  it('already removed: says it will not renew, no button; not removable: nothing at all', async () => {
    const { unmount } = render(<SmartPackRemoval isHebrew={false} invoke={invokeFor({ ok: false, code: 'already_removed', effectiveAt: AT })} />);
    expect((await screen.findByTestId('plans-smart-pack-removed')).textContent).toBe('SMART PACK will not renew.');
    expect(screen.queryByTestId('plans-smart-pack-remove')).toBeNull();
    unmount();
    render(<SmartPackRemoval isHebrew invoke={invokeFor({ ok: false, code: 'not_on_plan' })} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('plans-smart-pack-remove')).toBeNull();
  });
  it('offered only to an Israeli, active, paid SMART PACK add-on - never LIFETIME, never abroad', () => {
    const s = { state: 'ready', phase: { billing: 'enforced' }, market: 'IL', planId: 'all_inclusive', subscriptionStatus: 'active', smartPack: { active: true, source: 'add_on' } };
    expect(smartPackRemovalAvailable(s)).toBe(true);
    expect(smartPackRemovalAvailable(s, true)).toBe(false);
    expect(smartPackRemovalAvailable({ ...s, market: 'GLOBAL' })).toBe(false);
    expect(smartPackRemovalAvailable({ ...s, smartPack: { active: true, source: 'plan' } })).toBe(false);
    expect(smartPackRemovalAvailable({ ...s, subscriptionStatus: 'past_due' })).toBe(false);
  });
});

describe('the words everywhere (L-14, L-17)', () => {
  it('the landing pages: removed any time, at the end of the paid period - in Hebrew and in English', () => {
    expect(read('src', 'pages', 'LandingLocal.jsx')).toContain("'מסירים בכל עת, וההסרה נכנסת לתוקף בסוף התקופה ששולמה'");
    expect(read('src', 'pages', 'LandingGlobal.jsx')).toContain("'Remove it any time - it ends with the paid period'");
    expect(read('src', 'pages', 'LandingLocal.jsx')).not.toContain('להפסקה כותבים לנו');
    expect(read('src', 'pages', 'LandingGlobal.jsx')).not.toContain('To stop it, write to us');
  });
  it('the chat facts: removed in the app, monthly without a refund, yearly per section 6', () => {
    const t = read('supabase', 'functions', 'chat-ai', 'addOnTruth.ts');
    expect(t).toContain('The subscriber removes it in the app');
    expect(t).toContain('a monthly one is not refunded, a yearly one is refunded pro rata less the cancellation fee of section 6 of the Terms');
    expect(t).not.toContain('there is no removal button in the app');
  });
  it('the plans window shows the removal only when the server allows it, and re-reads the summary after', () => {
    const d = read('src', 'pages', 'Dashboard.jsx');
    expect(d).toContain('smartPackRemoval={smartPackRemovalAvailable(accountSummary, isLifetimeAccount) ? { invoke: invokeWithFreshSession, onDone: refreshAccountSummaryQuiet } : null}');
    expect(read('src', 'components', 'PricingModal.jsx')).toContain('{smartPackRemoval && !lifetime && <SmartPackRemoval isHebrew={isHebrew} invoke={smartPackRemoval.invoke} onDone={smartPackRemoval.onDone} />}');
  });
});
