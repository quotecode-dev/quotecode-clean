// Owner console 2026-11-02 (stage 1 of docs/SPEC_CUSTOMER_EMAILS_2026-11-02.md): the failed-renewal emails - when, in which words, and never twice.
import { describe, it, expect, vi } from 'vitest';
import { dueNotice, healthOf, inSendingHours, lifeContent, noticeContent, runNotices, type LifeFact, type Fact, type Deps, type Kind } from './lib.ts';

const START = '2026-11-10T08:00:00.000Z';
const END = '2026-11-13T08:00:00.000Z';
const at = (hours: number) => new Date(Date.parse(START) + hours * 3600000);
const fact = (o: Partial<Fact> = {}): Fact => ({ account_id: 'a1', email: 'owner@example.com', market: 'IL', episode_at: START, grace_ends_at: END, limited: false, reason: 'payment_failed', sent: [], ...o });

describe('which email is due', () => {
  it('failure day, day 2, day 3, by the hours since the failure', () => {
    expect(dueNotice(fact(), at(1))).toEqual({ kind: 'failed_day1', seq: 0 });
    expect(dueNotice(fact(), at(24))).toEqual({ kind: 'failed_day2', seq: 0 });
    expect(dueNotice(fact(), at(48))).toEqual({ kind: 'failed_day3', seq: 0 });
  });
  it('at limitation, then once a week until a payment', () => {
    expect(dueNotice(fact({ limited: true }), at(72))).toEqual({ kind: 'limited', seq: 0 });
    expect(dueNotice(fact({ limited: true }), at(72 + 24 * 6))).toEqual({ kind: 'limited', seq: 0 });
    expect(dueNotice(fact({ limited: true }), at(72 + 24 * 7))).toEqual({ kind: 'limited_weekly', seq: 1 });
    expect(dueNotice(fact({ limited: true }), at(72 + 24 * 21))).toEqual({ kind: 'limited_weekly', seq: 3 });
  });
  it('what was sent is not due again, and an older stage is never sent after a newer one', () => {
    expect(dueNotice(fact({ sent: [{ kind: 'failed_day1', seq: 0 }] }), at(2))).toBeNull();
    expect(dueNotice(fact({ sent: [] }), at(50))).toEqual({ kind: 'failed_day3', seq: 0 });
    expect(dueNotice(fact({ limited: true, sent: [{ kind: 'limited_weekly', seq: 1 }] }), at(72 + 24 * 8))).toBeNull();
  });
  it('counted from the end the server states, when it is later than failure + 72 hours', () => {
    const later = { grace_ends_at: new Date(Date.parse(START) + 100 * 3600000).toISOString() };
    expect(dueNotice(fact(later), at(30))).toEqual({ kind: 'failed_day1', seq: 0 });
    expect(dueNotice(fact(later), at(60))).toEqual({ kind: 'failed_day2', seq: 0 });
    expect(dueNotice(fact(later), at(80))).toEqual({ kind: 'failed_day3', seq: 0 });
  });
  it('a missing charge: the opening email, then the last day, with no reminder an hour later', () => {
    const missing = { reason: 'period_ended' as const };
    expect(dueNotice(fact(missing), at(24))).toEqual({ kind: 'failed_day1', seq: 0 });
    expect(dueNotice(fact({ ...missing, sent: [{ kind: 'failed_day1', seq: 0 }] }), at(25))).toBeNull();
    expect(dueNotice(fact({ ...missing, sent: [{ kind: 'failed_day1', seq: 0 }] }), at(48))).toEqual({ kind: 'failed_day3', seq: 0 });
  });
  it('a time that cannot be read, or before the episode: nothing', () => {
    expect(dueNotice(fact({ episode_at: 'x' }), at(1))).toBeNull();
    expect(dueNotice(fact(), at(-1))).toBeNull();
  });
});

describe('sending hours', () => {
  it('Israel 08:00 up to 21:00 local time, in summer and in winter; abroad always', () => {
    expect(inSendingHours('IL', new Date('2026-11-10T05:59:00Z'))).toBe(false); // 07:59 winter
    expect(inSendingHours('IL', new Date('2026-11-10T06:00:00Z'))).toBe(true);
    expect(inSendingHours('IL', new Date('2026-11-10T18:59:00Z'))).toBe(true); // 20:59 winter
    expect(inSendingHours('IL', new Date('2026-11-10T19:00:00Z'))).toBe(false);
    expect(inSendingHours('IL', new Date('2026-07-10T04:59:00Z'))).toBe(false); // 07:59 summer
    expect(inSendingHours('IL', new Date('2026-07-10T05:00:00Z'))).toBe(true);
    expect(inSendingHours('INTERNATIONAL', new Date('2026-11-10T01:00:00Z'))).toBe(true);
  });
});

describe('the words', () => {
  const KINDS: Kind[] = ['failed_day1', 'failed_day2', 'failed_day3', 'limited', 'limited_weekly'];
  it('Hebrew in Israel: TEKANGO in Latin letters, no price', () => {
    for (const k of KINDS) {
      const c = noticeContent(k, fact());
      expect(c.text).toContain('TEKANGO');
      expect(c.subject + c.text).toMatch(/[א-ת]/);
      expect(c.text).not.toMatch(/טקנגו|₪/);
    }
    expect(noticeContent('failed_day1', fact()).text).toContain('13/11/2026 בשעה 10:00');
    expect(noticeContent('failed_day3', fact()).subject).toBe('היום החשבון ב-TEKANGO יוגבל');
  });
  it('English abroad: no Hebrew, no Israel, no shekel, no VAT', () => {
    for (const k of KINDS) {
      const c = noticeContent(k, fact({ market: 'INTERNATIONAL' }));
      expect(c.subject + c.text).not.toMatch(/[א-ת]|Israel|ILS|₪|VAT/);
    }
    expect(noticeContent('failed_day1', fact({ market: 'INTERNATIONAL' })).text).toContain('November 13, 2026');
    expect(noticeContent('limited', fact({ market: 'INTERNATIONAL' })).text).toContain('dashboard?lang=en');
  });
  it('a missing charge is not called a failed one; no retry promise for it', () => {
    const c = noticeContent('failed_day1', fact({ reason: 'period_ended' }));
    expect(c.text).toContain('לא התקבל חיוב חדש');
    expect(c.text).not.toContain('ננסה לחייב');
    expect(c.subject).toBe('לא התקבל חיוב חדש על המנוי ב-TEKANGO');
    expect(noticeContent('limited', fact({ reason: 'period_ended', market: 'INTERNATIONAL' })).text).toContain('did not receive a new charge');
  });
  it('during the grace days a reply reaches the service mailbox (decision 1)', () => {
    expect(noticeContent('failed_day1', fact()).text).toContain('השיבו למייל הזה');
    expect(noticeContent('failed_day2', fact({ market: 'INTERNATIONAL' })).text).toContain('reply to this email');
  });
});

function deps(facts: Fact[], o: Partial<Deps> = {}) {
  const log: string[] = [];
  const d: Deps = {
    facts: vi.fn(async (user?: string) => (user ? facts.filter((f) => f.account_id === user) : facts)),
    lifecycle: vi.fn(async () => [] as LifeFact[]),
    claim: vi.fn(async (_u, _k, _e, _s, key) => key),
    complete: vi.fn(async (_u, _k, _e, _s, _key, outcome) => { log.push(outcome); return true; }),
    send: vi.fn(async () => ({ ok: true, status: 200, id: 'p1' })),
    now: () => new Date('2026-11-10T10:00:00Z'),
    uuid: () => 'uuid-1',
    ...o,
  };
  return { d, log };
}

describe('stage 2: welcome and the free period', () => {
  const now = new Date('2026-11-10T10:00:00Z');
  const life = (o: Partial<LifeFact> = {}): LifeFact => ({ account_id: 'b1', email: 'new@example.com', market: 'IL', kind: 'welcome', episode_at: '2026-11-10T09:00:00.000Z', free_ends_at: '2026-11-17T09:00:00.000Z', remaining: 10, ...o });
  it('the words, in the market\'s language; no offer, no price, no link to the plans', () => {
    const he = lifeContent(life(), now);
    expect(he.subject).toBe('ברוכים הבאים ל-TEKANGO');
    expect(he.text).toContain('10 הצעות או 7 ימים');
    const en = lifeContent(life({ market: 'INTERNATIONAL' }), now);
    expect(en.text + en.subject).not.toMatch(/[א-ת]|Israel|ILS|₪|VAT/);
    for (const c of [he, en, lifeContent(life({ kind: 'free_ending', remaining: 2 }), now), lifeContent(life({ kind: 'free_ending', remaining: 2, market: 'INTERNATIONAL' }), now)]) {
      expect(c.text).not.toMatch(/₪|\$|מבצע|הנחה|offer|discount|plans/i);
      expect(c.text).toContain('TEKANGO');
    }
  });
  it('the free period: by what ends first', () => {
    expect(lifeContent(life({ kind: 'free_ending', remaining: 2 }), now).text).toContain('נותרו 2 הצעות חינם.');
    expect(lifeContent(life({ kind: 'free_ending', remaining: 1 }), now).text).toContain('נותרה הצעת חינם אחת.');
    expect(lifeContent(life({ kind: 'free_ending', remaining: 1, market: 'INTERNATIONAL' }), now).text).toContain('You have 1 free quote left.');
    expect(lifeContent(life({ kind: 'free_ending', remaining: 6, free_ends_at: '2026-11-11T08:00:00.000Z' }), now).text).toContain('תקופת החינם מסתיימת ב-11/11/2026 בשעה 10:00.');
    expect(lifeContent(life({ kind: 'free_ending', remaining: 6, free_ends_at: '2026-11-11T08:00:00.000Z', market: 'INTERNATIONAL' }), now).text).toContain('November 11, 2026');
  });
  it('the run sends it once from the market mailbox, and a change after the claim cancels it', async () => {
    const list = vi.fn(async () => [life()]);
    const ok = deps([], { lifecycle: list });
    expect((await runNotices(ok.d)).sent).toBe(1);
    expect(ok.log).toEqual(['sent']);
    expect((ok.d.send as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ replyTo: 'support@tekango.com', to: 'new@example.com' });
    const gone = deps([], { lifecycle: vi.fn(async (user?: string) => (user ? [] : [life()])) });
    expect((await runNotices(gone.d)).sent).toBe(0);
    expect(gone.log).toEqual(['cancelled']);
  });
});

describe('what the watcher is told', () => {
  it('a clean run, a send problem, a failure', () => {
    expect(healthOf({ ok: true, failed: 0, unknown: 0 })).toEqual({ event: 'completed', outcome: 'ok' });
    expect(healthOf({ ok: true, failed: 1 })).toEqual({ event: 'partial', outcome: 'send_errors' });
    expect(healthOf({ ok: true, unknown: 1 })).toEqual({ event: 'partial', outcome: 'send_errors' });
    expect(healthOf({ ok: false, code: 'facts_failed' })).toEqual({ event: 'failed', outcome: 'facts_failed' });
    expect(healthOf(null)).toEqual({ event: 'failed', outcome: 'failed' });
  });
});

describe('the run', () => {
  it('claims, sends from the market mailbox, records', async () => {
    const { d, log } = deps([fact(), fact({ account_id: 'a2', market: 'INTERNATIONAL', email: 'x@example.com' })]);
    expect(await runNotices(d)).toMatchObject({ ok: true, found: 2, sent: 2 });
    expect(log).toEqual(['sent', 'sent']);
    const first = (d.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(first).toMatchObject({ from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com', to: 'owner@example.com', idempotencyKey: 'customer-notice/uuid-1' });
    expect((d.send as ReturnType<typeof vi.fn>).mock.calls[1][0].replyTo).toBe('info@tekango.com');
  });
  it('a lost claim sends nothing', async () => {
    const { d } = deps([fact()], { claim: vi.fn(async () => null) });
    expect((await runNotices(d)).sent).toBe(0);
    expect(d.send).not.toHaveBeenCalled();
  });
  it('a payment between the claim and the send cancels the email', async () => {
    const list = vi.fn(async (user?: string) => (user ? [] : [fact()]));
    const { d, log } = deps([], { facts: list });
    expect((await runNotices(d)).sent).toBe(0);
    expect(d.send).not.toHaveBeenCalled();
    expect(log).toEqual(['cancelled']);
  });
  it('a night hour in Israel waits, nothing is claimed; abroad it goes', async () => {
    const night = () => new Date('2026-11-10T23:00:00Z');
    const il = deps([fact()], { now: night });
    expect(await runNotices(il.d)).toMatchObject({ waiting: 1, sent: 0 });
    expect(il.d.claim).not.toHaveBeenCalled();
    const abroad = deps([fact({ market: 'INTERNATIONAL' })], { now: night });
    expect((await runNotices(abroad.d)).sent).toBe(1);
  });
  it('no answer from the provider is unknown, a refusal is failed', async () => {
    const u = deps([fact()], { send: vi.fn(async () => ({ ok: false, status: 0, unknown: true })) });
    expect(await runNotices(u.d)).toMatchObject({ unknown: 1, sent: 0 });
    expect(u.log).toEqual(['unknown']);
    const r = deps([fact()], { send: vi.fn(async () => ({ ok: false, status: 422 })) });
    expect(await runNotices(r.d)).toMatchObject({ failed: 1, sent: 0 });
    expect(r.log).toEqual(['failed']);
  });
});
