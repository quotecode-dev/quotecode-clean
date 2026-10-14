// Task 19: the pure calendar model - Sunday weeks, date-only arithmetic, market "today", Local-only day classes and holidays, and events
// from existing tasks + SENT quotes only.
import { describe, it, expect } from 'vitest';
import {
  addDays, addMonths, buildCalendarEvents, dayClassOf, eventsByDate, holidaysFor, initialViewFor, monthWeeks, weekDates, weekday,
} from './calendarModel';

describe('calendar grid', () => {
  it('weeks start on Sunday; October 2026 starts on a Thursday and spans five weeks', () => {
    expect(weekday('2026-10-01')).toBe(4);
    const weeks = monthWeeks('2026-10-09');
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toBe('2026-09-27');
    expect(weeks.every((w) => weekday(w[0]) === 0 && w.length === 7)).toBe(true);
    expect(weekDates('2026-10-09')).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
  });
  it('date-only arithmetic never shifts across months / years / DST', () => {
    expect(addDays('2026-03-27', 1)).toBe('2026-03-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
  });
  it('initial view per device class: month desktop / tablet portrait, week tablet landscape, day mobile', () => {
    expect(initialViewFor(1440, 900)).toBe('month');
    expect(initialViewFor(768, 1024)).toBe('month');
    expect(initialViewFor(1024, 768)).toBe('week');
    expect(initialViewFor(390, 844)).toBe('day');
  });
});

describe('day classes and holidays', () => {
  const il = holidaysFor(true);
  it('Local/Israel: holiday > Saturday > ordinary', () => {
    expect(dayClassOf('2026-10-03', { isLocalIsraeliBusiness: true, holidays: il })).toBe('holiday'); // Shemini Atzeret (a Saturday)
    expect(dayClassOf('2026-10-10', { isLocalIsraeliBusiness: true, holidays: il })).toBe('saturday');
    expect(dayClassOf('2026-10-09', { isLocalIsraeliBusiness: true, holidays: il })).toBe('ordinary');
    expect(il.get('2026-09-21')[0]).toMatchObject({ he: 'יום כיפור', en: 'Yom Kippur' });
  });
  it('a hidden holiday layer falls back to the weekday class', () => {
    expect(dayClassOf('2026-10-03', { isLocalIsraeliBusiness: true, holidays: null })).toBe('saturday');
    expect(dayClassOf('2026-09-21', { isLocalIsraeliBusiness: true, holidays: null })).toBe('ordinary');
  });
  it('International: no holiday data and no Saturday / holiday class at all', () => {
    expect(holidaysFor(false).size).toBe(0);
    expect(dayClassOf('2026-10-03', { isLocalIsraeliBusiness: false, holidays: il })).toBe('ordinary');
    expect(dayClassOf('2026-10-10', { isLocalIsraeliBusiness: false, holidays: null })).toBe('ordinary');
  });
});

describe('events from existing records only', () => {
  const now = new Date('2026-10-09T09:00:00Z'); // Local 12:00
  const tasks = [
    { id: 't1', title: 'Call David', status: 'open', priority: 'high', due_date: '2026-10-11', due_time: null },
    { id: 't2', title: 'Visit', status: 'open', due_date: '2026-10-09', due_time: '15:30:00' },
    { id: 't3', title: 'Old', status: 'open', due_date: '2026-10-01' },
    { id: 't4', title: 'Done', status: 'completed', due_date: '2026-10-02', completed_at: '2026-10-02T10:00:00Z' },
    { id: 't5', title: 'No date', status: 'open', due_date: null },
  ];
  const quotes = [
    { id: 'q1', quote_number: 12003, status: 'sent', valid_until: '2026-10-15', clients: { company_name: 'Alpha' } },
    { id: 'q2', quote_number: 12004, status: 'sent', valid_until: '2026-10-05', clients: null, subject: 'Kitchen' },
    { id: 'q3', quote_number: 12005, status: 'approved', valid_until: '2026-10-20' },
    { id: 'q4', quote_number: 12006, status: 'paid', valid_until: '2026-10-21' },
    { id: 'q5', quote_number: 12007, status: 'draft', valid_until: '2026-10-22' },
    { id: 'q6', quote_number: 12008, status: 'sent', valid_until: null },
  ];
  const ev = buildCalendarEvents({ tasks, quotes, market: 'Local', now });
  it('tasks with a due date keep their own date and wall-clock time; overdue / completed are flagged; undated tasks are absent', () => {
    const t = Object.fromEntries(ev.filter((e) => e.kind === 'task').map((e) => [e.ref, e]));
    expect(Object.keys(t).sort()).toEqual(['t1', 't2', 't3', 't4']);
    expect(t.t2).toMatchObject({ date: '2026-10-09', time: '15:30', status: 'open' });
    expect(t.t3.status).toBe('overdue');
    expect(t.t4.status).toBe('completed');
  });
  it('only SENT quotes with a validity date appear, on that date; signed (approved / paid) and drafts never do; expiry follows OD-1', () => {
    const q = Object.fromEntries(ev.filter((e) => e.kind === 'quote').map((e) => [e.ref, e]));
    expect(Object.keys(q).sort()).toEqual(['q1', 'q2']);
    expect(q.q1).toMatchObject({ date: '2026-10-15', status: 'awaiting_signature', number: expect.stringMatching(/12003/) });
    expect(q.q2).toMatchObject({ date: '2026-10-05', status: 'expired' });
    expect(q.q2.party).toEqual({ kind: 'title', text: 'Kitchen' });
  });
  it('per-day order: quote deadlines, untimed tasks, then timed tasks by time', () => {
    const map = eventsByDate([...ev, { id: 'task:x', kind: 'task', date: '2026-10-15', time: '08:00', title: 'Early' }, { id: 'task:y', kind: 'task', date: '2026-10-15', time: null, title: 'All day' }]);
    expect(map.get('2026-10-15').map((e) => e.id)).toEqual(['quote:q1', 'task:y', 'task:x']);
  });
});
