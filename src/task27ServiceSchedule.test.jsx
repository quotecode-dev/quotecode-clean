// Task 27 (P2, spec §6): the optional work date / time of a quote - separate from the validity, saved after the quote in its own
// owner-only table, shown in the internal calendar as its own layer; an unavailable server is stated, never faked.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { classifyServiceScheduleError, normalizeServiceSchedule, saveServiceSchedule, loadServiceSchedule } from './utils/serviceScheduleClient';
import { buildCalendarEvents } from './utils/calendarModel';
import ServiceScheduleFields from './components/ServiceScheduleFields';
import CalendarTab from './components/CalendarTab';

const USER = 'user-a';
function recorder(result = { data: null, error: null }) {
  const calls = [];
  const b = {};
  for (const m of ['select', 'eq', 'delete', 'upsert', 'limit', 'order']) b[m] = vi.fn((...a) => { calls.push([m, ...a]); return b; });
  b.single = vi.fn(() => Promise.resolve(result));
  b.maybeSingle = vi.fn(() => Promise.resolve(result));
  b.then = (res) => Promise.resolve(result).then(res);
  return { client: { from: vi.fn((t) => { calls.push(['from', t]); return b; }) }, calls };
}

describe('work date - value rules', () => {
  it('empty is "no work date"; a time needs a date; dates and times are validated', () => {
    expect(normalizeServiceSchedule({ date: '', time: '' })).toEqual({ ok: true, value: null });
    expect(normalizeServiceSchedule({ date: '', time: '08:00' })).toEqual({ ok: false, error: 'time_without_date' });
    expect(normalizeServiceSchedule({ date: '2026-02-30', time: '' }).error).toBe('invalid_date');
    expect(normalizeServiceSchedule({ date: '12-11-20', time: '' }).error).toBe('invalid_date');
    expect(normalizeServiceSchedule({ date: '2026-11-02', time: '25:00' }).error).toBe('invalid_time');
    expect(normalizeServiceSchedule({ date: '2026-11-02', time: '08:30' })).toEqual({ ok: true, value: { date: '2026-11-02', time: '08:30' } });
  });
  it('a missing table is "unavailable"; RLS / foreign quote is "not_allowed"', () => {
    expect(classifyServiceScheduleError({ code: 'PGRST205', message: "Could not find the table 'public.quote_service_schedule' in the schema cache" })).toBe('unavailable');
    expect(classifyServiceScheduleError({ code: '42501', message: 'TK_SCHEDULE_FOREIGN_QUOTE: the quote does not belong to this owner' })).toBe('not_allowed');
  });
});

describe('work date - persistence (after the quote, only on a change)', () => {
  it('an unchanged value makes no request at all', async () => {
    const { client } = recorder();
    const r = await saveServiceSchedule(client, USER, 'q1', { date: '', time: '' }, { date: '', time: '' });
    expect(r).toMatchObject({ ok: true, action: 'unchanged' });
    expect(client.from).not.toHaveBeenCalled();
  });
  it('a new value is upserted for the owner and the quote; no time is stored as NULL', async () => {
    const { client, calls } = recorder({ data: { quote_id: 'q1', user_id: USER, service_date: '2026-11-02', service_time: null }, error: null });
    const r = await saveServiceSchedule(client, USER, 'q1', { date: '2026-11-02', time: '' });
    expect(r).toMatchObject({ ok: true, action: 'saved', value: { date: '2026-11-02', time: '' } });
    expect(calls).toContainEqual(['from', 'quote_service_schedule']);
    expect(calls.find((c) => c[0] === 'upsert')).toEqual(['upsert', { quote_id: 'q1', user_id: USER, service_date: '2026-11-02', service_time: null }, { onConflict: 'quote_id' }]);
  });
  it('clearing a saved value deletes the row (owner-scoped)', async () => {
    const { client, calls } = recorder();
    const r = await saveServiceSchedule(client, USER, 'q1', { date: '', time: '' }, { date: '2026-11-02', time: '08:30' });
    expect(r).toMatchObject({ ok: true, action: 'cleared' });
    expect(calls.filter((c) => c[0] === 'eq')).toEqual([['eq', 'quote_id', 'q1'], ['eq', 'user_id', USER]]);
    expect(calls.some((c) => c[0] === 'delete')).toBe(true);
  });
  it('a server without the table answers "unavailable" (nothing pretends to be saved)', async () => {
    const { client } = recorder({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } });
    expect((await saveServiceSchedule(client, USER, 'q1', { date: '2026-11-02', time: '' })).error.code).toBe('unavailable');
    expect((await loadServiceSchedule(client, USER, 'q1')).error.code).toBe('unavailable');
  });
  it('a saved time is read back as HH:MM', async () => {
    const { client } = recorder({ data: { quote_id: 'q1', user_id: USER, service_date: '2026-11-02', service_time: '08:30:00' }, error: null });
    expect(await loadServiceSchedule(client, USER, 'q1')).toEqual({ ok: true, value: { date: '2026-11-02', time: '08:30' } });
  });
});

describe('work date - calendar layer', () => {
  const quotes = [
    { id: 'q1', quote_number: 12003, status: 'approved', valid_until: '2026-10-15', clients: { company_name: 'Alpha' } },
    { id: 'q2', quote_number: 12004, status: 'rejected', valid_until: '2026-10-15', clients: { company_name: 'Beta' } },
  ];
  it('a work date is its own event (also for a signed quote), never the validity end; rejected / unknown quotes are skipped', () => {
    const ev = buildCalendarEvents({ quotes, schedules: [
      { quote_id: 'q1', service_date: '2026-10-20', service_time: '08:30:00' },
      { quote_id: 'q2', service_date: '2026-10-21', service_time: null },
      { quote_id: 'foreign', service_date: '2026-10-22', service_time: null },
    ], market: 'Local', now: new Date('2026-10-09T09:00:00Z') });
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ id: 'service:q1', kind: 'service', date: '2026-10-20', time: '08:30', status: 'scheduled' });
  });
  function client(scheduleResult) {
    const make = (result) => { const b = { select: () => b, eq: () => b, order: () => b, then: (res) => Promise.resolve(result).then(res) }; return b; };
    return { from: vi.fn((t) => make(t === 'quote_service_schedule' ? scheduleResult : { data: [], error: null })) };
  }
  it('HE: the "work dates" layer shows the event with an LTR time and can be hidden', async () => {
    const { container } = render(<div dir="rtl"><CalendarTab client={client({ data: [{ quote_id: 'q1', service_date: '2026-10-20', service_time: '08:30:00' }], error: null })}
      userId={USER} isHebrew isLocalIsraeliBusiness quotes={quotes} now={new Date('2026-10-09T09:00:00Z')} /></div>);
    fireEvent.click(container.querySelector('[data-view="month"]'));
    await waitFor(() => expect(container.querySelector('[data-event-id="service:q1"]')).not.toBeNull());
    const chip = container.querySelector('[data-event-id="service:q1"]');
    expect(chip.textContent).toMatch(/תאריך ביצוע/);
    expect(chip.querySelector('bdi')).toHaveAttribute('dir', 'ltr');
    fireEvent.click(container.querySelector('[data-layer="service"]'));
    expect(container.querySelector('[data-event-id="service:q1"]')).toBeNull();
  });
  it('EN: a server without the table hides the layer (no fake empty layer); other failures are stated', async () => {
    const r1 = render(<CalendarTab client={client({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } })} userId={USER} isHebrew={false} isLocalIsraeliBusiness={false} quotes={quotes} now={new Date('2026-10-09T09:00:00Z')} />);
    await waitFor(() => expect(r1.container.querySelector('[data-testid="calendar-loading"]')).toBeNull());
    expect(r1.container.querySelector('[data-layer="service"]')).toBeNull();
    expect(r1.container.querySelector('[data-testid="calendar-service-error"]')).toBeNull();
    r1.unmount();
    render(<CalendarTab client={client({ data: null, error: { message: 'Failed to fetch' } })} userId={USER} isHebrew={false} isLocalIsraeliBusiness={false} quotes={quotes} now={new Date('2026-10-09T09:00:00Z')} />);
    await waitFor(() => expect(screen.getByTestId('calendar-service-error').textContent).toMatch(/Work dates could not be loaded/));
  });
});

describe('work date - form fields', () => {
  it('HE: separate from the validity, typed in the account date format, time locked until a date exists', () => {
    const onChange = vi.fn();
    render(<div dir="rtl"><ServiceScheduleFields value={{ date: '', time: '' }} onChange={onChange} isHebrew /></div>);
    expect(screen.getByText(/תאריך ביצוע \(לא חובה\)/)).toBeInTheDocument();
    expect(screen.getByText(/נפרד מתוקף ההצעה, לא מוצג ללקוח/)).toBeInTheDocument();
    expect(screen.getByTestId('service-time')).toBeDisabled();
    fireEvent.change(screen.getByTestId('service-date'), { target: { value: '02112026' } });
    expect(onChange).toHaveBeenCalledWith({ date: '2026-11-02', time: '' });
  });
  it('EN (US): MM-DD-YYYY; an unavailable server disables the fields and says so', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ServiceScheduleFields value={{ date: '2026-11-02', time: '08:30' }} onChange={onChange} isHebrew={false} isUS />);
    expect(screen.getByTestId('service-date')).toHaveValue('11-02-2026');
    expect(screen.getByTestId('service-time')).toHaveValue('08:30');
    rerender(<ServiceScheduleFields value={{ date: '', time: '' }} onChange={onChange} isHebrew={false} state="unavailable" />);
    expect(screen.getByTestId('service-date')).toBeDisabled();
    expect(screen.getByTestId('service-schedule-note').textContent).toMatch(/not available on this server yet/);
  });
});
