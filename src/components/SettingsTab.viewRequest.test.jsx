// Task 40 (Owner 2026-10-15): the welcome item's "Business settings › Reminders & automation" link opens that exact sub-screen.
// SettingsTab takes a one-shot viewRequest ({ view: 'reminders' }) and reports it consumed; without a reminders client it stays on
// the business view (the entry itself is absent there too).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import SettingsTab from './SettingsTab';

// the app's shared client is never created in this unit test (it needs the env); every data call here goes through fakeClient()
vi.mock('../shared/supabase', () => ({ supabase: { from: () => ({}), auth: { getSession: async () => ({ data: { session: null } }) } } }));

afterEach(() => cleanup());

function fakeClient() {
  const result = { data: null, error: null };
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: () => Promise.resolve(result), then: (a, b) => Promise.resolve({ data: [], error: null }).then(a, b), upsert: () => Promise.resolve({ error: null }) };
  return { from: () => q };
}

const noop = () => {};
const base = { isHebrew: true, isLocalIsraeliBusiness: true, handleSaveSettings: noop, t: (k) => k, currency: 'ILS', setCurrency: noop };

describe('SettingsTab viewRequest (welcome link)', () => {
  it('opens Reminders & automation and reports the request consumed', async () => {
    const done = vi.fn();
    const { getByTestId } = render(<SettingsTab {...base} remindersClient={fakeClient()} remindersUserId="u1" viewRequest={{ view: 'reminders' }} onViewRequestDone={done} />);
    await waitFor(() => expect(getByTestId('reminders-settings')).toBeTruthy());
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('without a request the business view is shown (unchanged behaviour)', () => {
    const { queryByTestId } = render(<SettingsTab {...base} remindersClient={fakeClient()} remindersUserId="u1" />);
    expect(queryByTestId('reminders-settings')).toBeNull();
  });
  it('a request without a reminders client stays on the business view and is still consumed', async () => {
    const done = vi.fn();
    const { queryByTestId } = render(<SettingsTab {...base} viewRequest={{ view: 'reminders' }} onViewRequestDone={done} />);
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    expect(queryByTestId('reminders-settings')).toBeNull();
  });
});
