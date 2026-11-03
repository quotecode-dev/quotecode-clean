// Owner console 2026-10-23 (L-22): the Customer Twin cost view - numbers per day from customer_twin_admin_usage, never content or accounts.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const rpc = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a) } }));
import AdminTwinCosts from './AdminTwinCosts';
import { ADMIN_DESTINATIONS, canOpenDestination } from './adminDestinations';

afterEach(cleanup);
beforeEach(() => rpc.mockReset());

const days = [
  { day: '2026-10-23', stored: 12, refunded: 1, accounts: 4, promptTokens: 10800, completionTokens: 3600, estimatedCostUsd: 0.0029 },
  { day: '2026-10-22', stored: 3, refunded: 0, accounts: 2, promptTokens: 2700, completionTokens: 900, estimatedCostUsd: 0.0007 },
];

describe('Customer Twin cost view', () => {
  it('HE: the totals and one row per Israel day, numbers isolated; the server is asked for 30 days', async () => {
    rpc.mockResolvedValue({ data: { ok: true, days }, error: null });
    render(<AdminTwinCosts isHebrew />);
    await waitFor(() => expect(screen.getByTestId('admin-twin-costs-table')).toBeTruthy());
    expect(rpc).toHaveBeenCalledWith('customer_twin_admin_usage', { p_days: 30 });
    expect(screen.getByTestId('admin-twin-costs-kpi-stored').textContent).toBe('15');
    expect(screen.getByTestId('admin-twin-costs-kpi-refunded').textContent).toBe('1');
    expect(screen.getByTestId('admin-twin-costs-kpi-tokens').textContent).toBe('18,000');
    expect(screen.getByTestId('admin-twin-costs-kpi-cost').textContent).toBe('$0.0036');
    const first = screen.getByTestId('admin-twin-costs-table').querySelector('tr[data-day="2026-10-23"]');
    expect(first.textContent).toMatch(/23[./]10[./]2026/);
    expect(first.querySelectorAll('bdi.av-num').length).toBe(6);
    expect(screen.getByTestId('admin-twin-costs').textContent).not.toMatch(/@|user_id/);
  });
  it('another period asks the server again; an empty period and a refused read say so honestly', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, days: [] }, error: null });
    render(<AdminTwinCosts isHebrew={false} />);
    await waitFor(() => expect(screen.getByTestId('admin-twin-costs-empty')).toBeTruthy());
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    fireEvent.click(screen.getByTestId('admin-twin-costs-period-7'));
    await waitFor(() => expect(screen.getByTestId('admin-twin-costs-unavailable')).toBeTruthy());
    expect(rpc).toHaveBeenLastCalledWith('customer_twin_admin_usage', { p_days: 7 });
  });
  it('is an Owner-only tool of the "מערכת" hub', () => {
    const d = ADMIN_DESTINATIONS.find((x) => x.id === 'twin-costs');
    expect(d).toMatchObject({ hub: 'system', permission: 'owner' });
    expect(canOpenDestination(d, { owner: true, permissions: [] })).toBe(true);
    expect(canOpenDestination(d, { owner: false, permissions: ['activity.view', 'ai-support.view'] })).toBe(false);
  });
});
