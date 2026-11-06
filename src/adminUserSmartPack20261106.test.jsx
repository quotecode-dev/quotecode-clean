// Owner console 2026-11-06 (release C, typed approval incl. L-22: "אני רוצה לראות שימוש של משתמש בכרטיס שלו"): the account's SMART PACK
// usage this month in the admin user card - % used, ILS of the budget, actions, a bar per day; the meter's own numbers, read-only.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';

const rpc = vi.fn();
vi.mock('./shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a) } }));
const { default: AdminUserSmartPackUsage, usageDays } = await import('./components/AdminUserSmartPackUsage');

afterEach(() => { cleanup(); rpc.mockReset(); });
const DATA = { ok: true, month: '2026-11', smartPack: true, unlimited: false, budgetIls: 4, usedIls: 0.7, percentUsed: 17.5, percentLeft: 82, actions: 2,
  days: [{ day: '2026-11-06', actions: 2, costIls: 0.7 }] };

describe('the admin user card: SMART PACK this month', () => {
  it('reads the one account (super admin RPC) and shows % used, ILS of the budget and the actions - Hebrew and English', async () => {
    rpc.mockResolvedValue({ data: DATA, error: null });
    render(<AdminUserSmartPackUsage uid="u-1" isHebrew />);
    await waitFor(() => expect(screen.getByTestId('admin-user-smart-pack-value').textContent).toBe('נוצלו 17.5% · ₪0.70 מתוך ₪4.00 · 2 פעולות'));
    expect(rpc).toHaveBeenCalledWith('smart_pack_usage_account', { p_user_id: 'u-1' });
    cleanup();
    render(<AdminUserSmartPackUsage uid="u-1" isHebrew={false} />);
    await waitFor(() => expect(screen.getByTestId('admin-user-smart-pack-value').textContent).toBe('17.5% used · ₪0.70 of ₪4.00 · 2 actions'));
  });
  it('a bar per day of the month; only the day with usage has height', async () => {
    rpc.mockResolvedValue({ data: DATA, error: null });
    render(<AdminUserSmartPackUsage uid="u-1" isHebrew />);
    const chart = await screen.findByTestId('admin-user-smart-pack-chart');
    const bars = chart.querySelectorAll('[data-day]');
    expect(bars).toHaveLength(30);
    expect(chart.querySelector('[data-day="6"]').style.height).toBe('100%');
    expect(chart.querySelector('[data-day="5"]').style.height).toBe('0px');
    expect(chart.querySelector('[role="img"]').getAttribute('aria-label')).toBe('השימוש לפי יום, נובמבר 2026');
  });
  it('the admin account is not counted against the budget; no SMART PACK and no usage says so; a failed read says unavailable (never a fake 0)', async () => {
    rpc.mockResolvedValue({ data: { ...DATA, unlimited: true, usedIls: 0.05, actions: 9 }, error: null });
    render(<AdminUserSmartPackUsage uid="u-1" isHebrew />);
    await waitFor(() => expect(screen.getByTestId('admin-user-smart-pack-value').textContent).toBe('חשבון הניהול, לא נספר מהתקציב · ₪0.05 · 9 פעולות'));
    cleanup();
    rpc.mockResolvedValue({ data: { ...DATA, smartPack: false, usedIls: 0, percentUsed: 0, actions: 0, days: [] }, error: null });
    render(<AdminUserSmartPackUsage uid="u-1" isHebrew={false} />);
    await waitFor(() => expect(screen.getByTestId('admin-user-smart-pack-value').textContent).toBe('No SMART PACK'));
    cleanup();
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    render(<AdminUserSmartPackUsage uid="u-1" isHebrew />);
    await waitFor(() => expect(screen.getByTestId('admin-user-smart-pack').textContent).toContain('לא זמין'));
  });
  it('usageDays fills every day of the month (February of a leap year too) and ignores a bad month', () => {
    expect(usageDays('2028-02', [])).toHaveLength(29);
    expect(usageDays('2026-11', [{ day: '2026-11-30', costIls: 1, actions: 1 }])[29]).toEqual({ day: 30, costIls: 1, actions: 1 });
    expect(usageDays('nope', [])).toEqual([]);
  });
  it('the user card mounts it inside "Plan & usage" (L-22), the "quota usage" line of the free 10 quotes unchanged', () => {
    const src = readFileSync('src/components/AdminUserDetails.jsx', 'utf8');
    expect(src).toContain('<AdminUserSmartPackUsage uid={uid} isHebrew={isHebrew} refreshKey={refreshKey} />');
    expect(src).toContain('{t(isHebrew, C.quotaUsage.he, C.quotaUsage.en)}');
  });
});
