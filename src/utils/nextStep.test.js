// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-25 וב-L-26 לפס "הצעד הבא" לפי התוכנית" - the next-step rotation order and rules.
import { describe, it, expect } from 'vitest';
import { overdueTasks, expiringQuotes, nextSteps, NEXT_STEP_EXPIRING_DAYS } from './nextStep';

const today = '2026-10-19';
const notExpired = () => false;

describe('next step', () => {
  it('overdue tasks: open, past their day or due today at a passed time; the oldest first', () => {
    const tasks = [
      { id: 'a', status: 'open', due_date: '2026-10-11' },
      { id: 'b', status: 'open', due_date: '2026-10-19', due_time: '09:00:00' },
      { id: 'c', status: 'open', due_date: '2026-10-19', due_time: '18:00:00' },
      { id: 'd', status: 'done', due_date: '2026-10-01' },
      { id: 'e', status: 'open', due_date: '2026-10-19' },
      { id: 'f', status: 'open', due_date: '2026-10-05' },
    ];
    expect(overdueTasks(tasks, today, '10:30').map((t) => t.id)).toEqual(['f', 'a', 'b']);
  });

  it('expiring: awaiting the customer, validity ending within 3 days (today included); soonest first; never signed / expired / hot', () => {
    expect(NEXT_STEP_EXPIRING_DAYS).toBe(3);
    const quotes = [
      { id: 'q1', status: 'sent', valid_until: '2026-10-22' },
      { id: 'q2', status: 'sent', valid_until: '2026-10-19' },
      { id: 'q3', status: 'sent', valid_until: '2026-10-23' },
      { id: 'q4', status: 'approved', valid_until: '2026-10-20' },
      { id: 'q5', status: 'draft', view_count: 0, valid_until: '2026-10-20' },
      { id: 'q6', status: 'draft', view_count: 2, valid_until: '2026-10-21' },
      { id: 'q7', status: 'sent', valid_until: '2026-10-20' },
    ];
    const out = expiringQuotes(quotes, today, notExpired, new Set(['q7']));
    expect(out.map((e) => [e.quote.id, e.daysLeft])).toEqual([['q2', 0], ['q6', 2], ['q1', 3]]);
  });

  it('the rotation: overdue tasks, then the hot quotes (their order), then the expiring quotes that are not hot', () => {
    const hot = { id: 'h1', status: 'sent', view_count: 5, valid_until: '2026-10-20' };
    const exp = { id: 'x1', status: 'sent', valid_until: '2026-10-21' };
    const steps = nextSteps({
      hotRows: [{ quote: hot, isHot: true }],
      tasks: [{ id: 't1', status: 'open', due_date: '2026-10-11', title: 'להתקשר לדוד' }],
      quotes: [hot, exp], today, nowClock: '10:00', isExpired: notExpired,
    });
    expect(steps.map((s) => s.key)).toEqual(['task:t1', 'hot:h1', 'expiring:x1']);
    expect(steps[0].today).toBe(false);
  });

  it('nothing due, nothing hot, nothing expiring -> no step', () => {
    expect(nextSteps({ hotRows: [], tasks: [], quotes: [], today, nowClock: '10:00', isExpired: notExpired })).toEqual([]);
  });
});
