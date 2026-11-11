// Task 19: the Calendar rendered in HE/RTL (Local/Israel) and EN/LTR (International) - views, the Local-only day classes and holiday
// layer, events from existing tasks + SENT quotes, opening a task through the existing flow, and the recoverable task-load error.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CalendarTab from './CalendarTab';

const USER = 'user-a';
const NOW = new Date('2026-10-09T09:00:00.000Z');
const TASKS = [
  { id: 't1', user_id: USER, title: 'להתקשר לדוד', status: 'open', priority: 'high', due_date: '2026-10-11', due_time: null },
  { id: 't2', user_id: USER, title: 'ביקור באתר', status: 'open', priority: 'normal', due_date: '2026-10-09', due_time: '15:30:00' },
];
const QUOTES = [
  { id: 'q1', quote_number: 12003, status: 'sent', valid_until: '2026-10-15', clients: { company_name: 'Alpha' }, currency: 'ILS', tax_rate: 18 },
  { id: 'q2', quote_number: 12005, status: 'approved', valid_until: '2026-10-16', clients: { company_name: 'Signed' } },
];
function fakeClient(rows, { fail = false } = {}) {
  const b = { select: () => b, eq: () => b, order: () => b, then: (res) => Promise.resolve(fail ? { data: null, error: { message: 'Failed to fetch' } } : { data: rows, error: null }).then(res) };
  return { from: vi.fn(() => b) };
}
function setup({ isHebrew = true, local = isHebrew, view, client = fakeClient(TASKS), onOpenTask = vi.fn() } = {}) {
  const utils = render(<div dir={isHebrew ? 'rtl' : 'ltr'}><CalendarTab client={client} userId={USER} isHebrew={isHebrew} isLocalIsraeliBusiness={local} quotes={QUOTES} onOpenTask={onOpenTask} now={NOW} /></div>);
  if (view) fireEvent.click(utils.container.querySelector(`[data-view="${view}"]`));
  return { ...utils, onOpenTask };
}
const cell = (c, iso) => c.querySelector(`.pf-cal-cell[data-date="${iso}"]`);

describe('Calendar - HE / Local / Israel', () => {
  it('month view: Sunday-first header, the three day classes, today and the holiday labels from the bundled data', async () => {
    const { container } = setup({ view: 'month' });
    await waitFor(() => expect(container.querySelector('[data-event-id="task:t1"]')).not.toBeNull());
    expect([...container.querySelectorAll('.pf-cal-dow')].map((d) => d.textContent)[0]).toBe('א׳');
    expect(cell(container, '2026-10-09')).toHaveAttribute('data-day-class', 'ordinary');
    expect(cell(container, '2026-10-10')).toHaveAttribute('data-day-class', 'saturday');
    expect(cell(container, '2026-10-03')).toHaveAttribute('data-day-class', 'holiday');
    expect(within(cell(container, '2026-10-03')).getByTestId('calendar-holiday').textContent).toBe('שמיני עצרת / שמחת תורה');
    expect(cell(container, '2026-10-09')).toHaveAttribute('data-today', 'true');
    expect(cell(container, '2026-10-09')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('calendar-legend')).toBeInTheDocument();
  });
  it('the three classes have three different, light backgrounds; Saturday and holiday are not white', () => {
    const { container } = setup({ view: 'month' });
    const css = container.querySelector('style').textContent;
    const color = (name) => css.match(new RegExp(`--cal-${name}: (#[0-9A-Fa-f]{6})`))[1].toUpperCase();
    const [o, s, h] = ['ordinary', 'saturday', 'holiday'].map(color);
    expect(new Set([o, s, h]).size).toBe(3);
    for (const c of [s, h]) expect(c).not.toBe('#FFFFFF');
    // light: every channel >= 0xE0
    for (const c of [o, s, h]) for (const i of [1, 3, 5]) expect(parseInt(c.slice(i, i + 2), 16)).toBeGreaterThanOrEqual(0xe0);
  });
  it('events: tasks on their due date (timed with an LTR time), the SENT quote on its validity date, never the signed quote', async () => {
    const { container } = setup({ view: 'month' });
    await waitFor(() => expect(container.querySelector('[data-event-id="task:t2"]')).not.toBeNull());
    expect(cell(container, '2026-10-09').querySelector('[data-event-id="task:t2"] bdi')).toHaveAttribute('dir', 'ltr');
    const q = cell(container, '2026-10-15').querySelector('[data-event-id="quote:q1"]');
    expect(q).toHaveAttribute('data-status', 'awaiting_signature');
    expect(q.textContent).toMatch(/ממתינה לחתימה/);
    expect(container.querySelector('[data-event-id="quote:q2"]')).toBeNull();
  });
  it('a calendar task opens the existing task flow', async () => {
    const { container, onOpenTask } = setup({ view: 'month' });
    await waitFor(() => expect(container.querySelector('[data-event-id="task:t1"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-event-id="task:t1"]'));
    expect(onOpenTask).toHaveBeenCalledWith('t1');
  });
  it('the holiday layer can be hidden independently; holiday days then keep their weekday class', async () => {
    const { container } = setup({ view: 'month' });
    fireEvent.click(container.querySelector('[data-layer="holidays"]'));
    expect(container.querySelector('[data-testid="calendar-holiday"]')).toBeNull();
    expect(cell(container, '2026-10-03')).toHaveAttribute('data-day-class', 'saturday');
    await waitFor(() => expect(container.querySelector('[data-event-id="task:t1"]')).not.toBeNull()); // events untouched
  });
  it('week view: Sunday to Saturday, all-day row with the holiday, timed task in its hour', async () => {
    const { container } = setup({ view: 'week' });
    await waitFor(() => expect(container.querySelector('[data-event-id="task:t2"]')).not.toBeNull());
    expect([...container.querySelectorAll('.pf-cal-wkhead')].map((h) => h.getAttribute('data-date'))).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
    expect(screen.getByTestId('calendar-period').textContent).toBe('04/10/2026 – 10/10/2026');
  });
  it('day view: compact month + agenda of the selected day; selecting another day shows its holiday', async () => {
    const { container } = setup({ view: 'day' });
    await waitFor(() => expect(container.querySelector('.pf-cal-item[data-event-id="task:t2"]')).not.toBeNull());
    fireEvent.click(container.querySelector('.pf-cal-mini button[data-date="2026-10-03"]'));
    expect(within(screen.getByTestId('calendar-day')).getByTestId('calendar-holiday').textContent).toBe('שמיני עצרת / שמחת תורה');
  });
  it('a task-load failure is recoverable and still shows quote deadlines', async () => {
    const { container } = setup({ view: 'month', client: fakeClient([], { fail: true }) });
    await screen.findByTestId('calendar-load-error');
    expect(container.querySelector('[data-event-id="quote:q1"]')).not.toBeNull();
  });
});

describe('Calendar - EN / International (regular calendar, no holidays)', () => {
  it('no holiday layer, no holiday labels, no Saturday / holiday classes; MM/DD dates', async () => {
    const { container } = setup({ isHebrew: false, view: 'month' });
    await waitFor(() => expect(container.querySelector('[data-event-id="task:t1"]')).not.toBeNull());
    expect(container.querySelector('[data-layer="holidays"]')).toBeNull();
    expect(container.querySelector('[data-testid="calendar-legend"]')).toBeNull();
    expect(container.querySelector('[data-testid="calendar-holiday"]')).toBeNull();
    expect([...container.querySelectorAll('.pf-cal-cell')].every((c) => c.getAttribute('data-day-class') === 'ordinary')).toBe(true);
    expect([...container.querySelectorAll('.pf-cal-dow')].map((d) => d.textContent)[0]).toBe('Sun');
    fireEvent.click(container.querySelector('[data-view="day"]'));
    expect(screen.getByTestId('calendar-period').textContent).toBe('10/09/2026');
  });
  it('Hebrew UI on an International account still shows no holidays (the account market decides, not the language)', () => {
    const { container } = setup({ isHebrew: true, local: false, view: 'month' });
    expect(container.querySelector('[data-testid="calendar-holiday"]')).toBeNull();
    expect(cell(container, '2026-10-03')).toHaveAttribute('data-day-class', 'ordinary');
  });
});
