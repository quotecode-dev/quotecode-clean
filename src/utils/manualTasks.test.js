// Task 18: the pure task rules - validation mirrors the database checks, the account market decides "today" / the clock, date-only
// values never shift, grouping and the deterministic order.
import { describe, it, expect } from 'vitest';
import {
  TASK_PRIORITIES, TASK_STATUSES, compareTasks, followUpDraftFor, groupTasks, isCalendarDate, marketClock, marketToday, normalizeTaskInput,
  shortTime, taskGroupOf, taskMarket,
} from './manualTasks';

describe('normalizeTaskInput (mirrors public.tasks checks)', () => {
  it('trims and keeps only the client-writable columns (never user_id / status / timestamps)', () => {
    const r = normalizeTaskInput({ title: '  Call back  ', notes: '  ask  ', priority: 'high', due_date: '2026-10-12', due_time: '09:30', quote_id: ' q1 ', client_id: '', user_id: 'x', status: 'completed' });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ title: 'Call back', notes: 'ask', priority: 'high', due_date: '2026-10-12', due_time: '09:30', quote_id: 'q1', client_id: null });
  });
  it('blank notes become NULL; priority defaults to normal', () => {
    expect(normalizeTaskInput({ title: 'x', notes: '   ' }).value).toMatchObject({ notes: null, priority: 'normal' });
  });
  it.each([
    [{ title: '' }, 'title_required'],
    [{ title: '   ' }, 'title_required'],
    [{ title: 'x'.repeat(201) }, 'title_too_long'],
    [{ title: 'x', notes: 'n'.repeat(2001) }, 'notes_too_long'],
    [{ title: 'x', priority: 'urgent' }, 'invalid_priority'],
    [{ title: 'x', due_date: '2026-02-30' }, 'invalid_date'],
    [{ title: 'x', due_date: '12/10/2026' }, 'invalid_date'],
    [{ title: 'x', due_date: '2026-10-12', due_time: '25:00' }, 'invalid_time'],
    [{ title: 'x', due_time: '10:00' }, 'time_without_date'],
  ])('refuses %j with %s', (form, code) => {
    const r = normalizeTaskInput(form);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain(code);
  });
  it('exactly 200 / 2000 characters are accepted', () => {
    expect(normalizeTaskInput({ title: 'x'.repeat(200), notes: 'n'.repeat(2000) }).ok).toBe(true);
  });
  it('enums are exactly the database enums', () => {
    expect(TASK_STATUSES).toEqual(['open', 'completed']);
    expect(TASK_PRIORITIES).toEqual(['low', 'normal', 'high']);
  });
});

describe('account-market dates (IRON-DATE-001)', () => {
  // 2026-10-09T22:30Z is already 10 Oct 01:30 in Asia/Jerusalem but still 9 Oct 22:30 in UTC
  const late = new Date('2026-10-09T22:30:00.000Z');
  it('"today" and the clock are the account market\'s product day / time, never the browser zone', () => {
    expect(marketToday('Local', late)).toBe('2026-10-10');
    expect(marketToday('International', late)).toBe('2026-10-09');
    expect(marketClock('Local', late)).toBe('01:30');
    expect(marketClock('International', late)).toBe('22:30');
  });
  it('taskMarket follows the authenticated account flag only', () => {
    expect(taskMarket(true)).toBe('Local');
    expect(taskMarket(false)).toBe('International');
    expect(taskMarket(undefined)).toBe('International');
  });
  it('the same task is "today" for a Local account and "upcoming" for an International one at the same instant', () => {
    const task = { id: 't', status: 'open', due_date: '2026-10-10' };
    expect(groupTasks([task], { market: 'Local', now: late }).today).toHaveLength(1);
    expect(groupTasks([task], { market: 'International', now: late }).upcoming).toHaveLength(1);
  });
  it('a date-only due date is a calendar value - it is never parsed through a time zone', () => {
    expect(isCalendarDate('2026-10-10')).toBe(true);
    expect(isCalendarDate('2026-10-10T00:00:00Z')).toBe(false);
  });
});

describe('grouping and deterministic order', () => {
  const now = new Date('2026-10-09T09:00:00.000Z'); // Local 12:00
  const T = (id, extra) => ({ id, status: 'open', priority: 'normal', created_at: '2026-10-01T00:00:00Z', ...extra });
  it('overdue (earlier day, or today with a passed time), today, upcoming, no date, completed', () => {
    const g = groupTasks([
      T('past', { due_date: '2026-10-08' }), T('passed-time', { due_date: '2026-10-09', due_time: '11:00:00' }),
      T('today-later', { due_date: '2026-10-09', due_time: '15:00' }), T('today-untimed', { due_date: '2026-10-09' }),
      T('future', { due_date: '2026-10-20' }), T('nodate', {}), T('done', { status: 'completed', completed_at: '2026-10-08T10:00:00Z', due_date: '2026-10-01' }),
    ], { market: 'Local', now });
    expect(g.overdue.map((t) => t.id)).toEqual(['past', 'passed-time']);
    expect(g.today.map((t) => t.id)).toEqual(['today-later', 'today-untimed']);
    expect(g.upcoming.map((t) => t.id)).toEqual(['future']);
    expect(g.noDate.map((t) => t.id)).toEqual(['nodate']);
    expect(g.completed.map((t) => t.id)).toEqual(['done']);
  });
  it('sorts by due date, due time (timed first), priority, creation time, then id', () => {
    const list = [
      T('d', { due_date: '2026-10-12', priority: 'low' }),
      T('c', { due_date: '2026-10-12', priority: 'high', created_at: '2026-10-05T00:00:00Z' }),
      T('b', { due_date: '2026-10-12', priority: 'high', created_at: '2026-10-02T00:00:00Z' }),
      T('a', { due_date: '2026-10-12', due_time: '08:00' }),
      T('e', { due_date: '2026-10-11' }),
      T('z', {}), T('y', {}),
    ];
    expect([...list].sort(compareTasks).map((t) => t.id)).toEqual(['e', 'a', 'b', 'c', 'd', 'y', 'z']);
    expect([...list].reverse().sort(compareTasks).map((t) => t.id)).toEqual(['e', 'a', 'b', 'c', 'd', 'y', 'z']);
  });
  it('completed tasks: most recently completed first', () => {
    const g = groupTasks([
      T('old', { status: 'completed', completed_at: '2026-10-01T00:00:00Z' }), T('new', { status: 'completed', completed_at: '2026-10-08T00:00:00Z' }),
    ], { market: 'International', now });
    expect(g.completed.map((t) => t.id)).toEqual(['new', 'old']);
  });
  it('taskGroupOf is exact at the minute boundary', () => {
    expect(taskGroupOf({ due_date: '2026-10-09', due_time: '12:00' }, { today: '2026-10-09', clock: '12:00' })).toBe('today');
    expect(taskGroupOf({ due_date: '2026-10-09', due_time: '11:59' }, { today: '2026-10-09', clock: '12:00' })).toBe('overdue');
  });
  it('shortTime accepts HH:MM and the database HH:MM:SS', () => {
    expect(shortTime('09:30:00')).toBe('09:30');
    expect(shortTime('9:30')).toBeNull();
  });
});

describe('followUpDraftFor (hot quote -> task form; nothing is created)', () => {
  it('pre-links the quote and its client', () => {
    expect(followUpDraftFor({ id: 'q1', client_id: 'c1' })).toEqual({ quote_id: 'q1', client_id: 'c1', origin: 'hot_quote' });
    expect(followUpDraftFor({ id: 'q2' })).toEqual({ quote_id: 'q2', client_id: null, origin: 'hot_quote' });
    expect(followUpDraftFor(null)).toBeNull();
  });
});

describe('market-ordered entry (IRON-DATE-001)', () => {
  it('Local reads DD/MM/YYYY, International MM/DD/YYYY; impossible dates are refused', async () => {
    const { parseMarketDate, parseTimeText, marketDatePattern } = await import('./manualTasks');
    expect(parseMarketDate('09/10/2026', 'Local')).toBe('2026-10-09');
    expect(parseMarketDate('09/10/2026', 'International')).toBe('2026-09-10');
    expect(parseMarketDate('9-1-2026', 'Local')).toBe('2026-01-09');
    expect(parseMarketDate('31/04/2026', 'Local')).toBeNull();
    expect(parseMarketDate('2026-10-09', 'Local')).toBeNull();
    expect(marketDatePattern('Local')).toBe('DD/MM/YYYY');
    expect(marketDatePattern('International')).toBe('MM/DD/YYYY');
    expect(parseTimeText('9:30')).toBe('09:30');
    expect(parseTimeText('23:59')).toBe('23:59');
    expect(parseTimeText('24:00')).toBeNull();
    expect(parseTimeText('9:30 PM')).toBeNull();
  });
});
