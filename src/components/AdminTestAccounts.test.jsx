// Owner console 2026-10-28, typed L-22: "מאשר שינוי ב-L-22: כיתובים לפעולות שלא זוהו ביומן, וסימון חשבון בדיקה שלא נספר בסטטיסטיקה".
// The audit log names every admin action it can hold; the Owner marks a test account on its details page (badge, hint, notice) and a
// marked account leaves the counts but stays listed.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../shared/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn) => (fn === 'get_admin_audit_log' ? { data: [], error: null } : { data: null, error: { code: 'PGRST202' }, status: 404 })),
    from: () => ({ select: () => ({ eq: async () => ({ count: 0, error: null }) }) }),
  },
}));

import AdminUserDetails from './AdminUserDetails';
import AdminUsersView from './AdminUsersView';
import { ACTION_NAMES, ADMIN_COPY as C } from '../domain/admin/adminCopy';
import { parseDashboardSummary } from '../domain/admin/adminAccountsClient';

afterEach(cleanup);

const account = { id: 7, user_id: 'user-7', business_name: 'Biz', email: 'biz@example.test', role: 'user', country: 'Local', created_at: '2026-10-19T10:00:00Z' };

describe('the audit log names every admin action it can hold', () => {
  it('the billing actions, the supervisor permissions and the test-account mark - Hebrew and English', () => {
    for (const k of ['billing_stop_renewal', 'billing_end_early', 'billing_resolve', 'billing_settle_refund', 'set_admin_permissions', 'mark_test_account', 'unmark_test_account']) {
      expect(ACTION_NAMES[k]?.he, k).toMatch(/[֐-׿]/);
      expect(ACTION_NAMES[k]?.en, k).toMatch(/^[A-Z][A-Za-z -]+$/);
    }
  });
});

describe('the test-account mark (the Owner only)', () => {
  it('the summary reports the marked accounts apart (0 when the server does not say)', () => {
    const base = { schema: 'admin-dashboard-summary/v1', managedAccounts: 3, registrationsLast24h: 0, signedInLast10m: 0, market: { Local: 2, International: 1, Unknown: 0 },
      subscriptionStatus: { lifetime: 0, paid_annual: 0, paid_monthly: 0, paid_unverified: 0, free10: 3, trial: 0, trial_ended: 0, free10_inactive: 0 } };
    expect(parseDashboardSummary({ ...base, testAccounts: 18 }).testAccounts).toBe(18);
    expect(parseDashboardSummary(base).testAccounts).toBe(0);
  });

  it.each([[true], [false]])('isHebrew=%s: mark -> the notice; a marked account shows the badge and the button removes the mark', async (isHebrew) => {
    const onTestMark = vi.fn(async () => true);
    const { rerender } = render(<AdminUserDetails account={account} isHebrew={isHebrew} onBack={vi.fn()} onTestMark={onTestMark} />);
    expect(screen.queryByTestId('admin-test-badge')).toBeNull();
    fireEvent.click(screen.getByTestId('admin-test-toggle'));
    await waitFor(() => expect(onTestMark).toHaveBeenCalledWith(account, true));
    expect((await screen.findByTestId('admin-test-notice')).textContent).toBe(isHebrew ? C.testMarked.he : C.testMarked.en);
    rerender(<AdminUserDetails account={{ ...account, is_test: true }} isHebrew={isHebrew} onBack={vi.fn()} onTestMark={onTestMark} />);
    expect(screen.getByTestId('admin-test-badge').textContent).toBe(isHebrew ? 'חשבון בדיקה' : 'Test account');
    expect(screen.getByTestId('admin-test-toggle').textContent).toBe(isHebrew ? C.unmarkTest.he : C.unmarkTest.en);
  });

  it('a failed save says so; a supervisor (no onTestMark) gets no button', async () => {
    render(<AdminUserDetails account={account} isHebrew onBack={vi.fn()} onTestMark={vi.fn(async () => false)} />);
    fireEvent.click(screen.getByTestId('admin-test-toggle'));
    expect((await screen.findByTestId('admin-test-notice')).textContent).toBe(C.testFailed.he);
    cleanup();
    render(<AdminUserDetails account={account} isHebrew onBack={vi.fn()} />);
    expect(screen.queryByTestId('admin-test-toggle')).toBeNull();
  });

  it('the users list keeps a marked account, with its badge', () => {
    const rows = [account, { ...account, id: 8, user_id: 'user-8', business_name: 'Test Biz', email: 'qa@example.test', is_test: true }];
    render(<AdminUsersView accounts={rows} orderedAccounts={rows} search="" onSearch={vi.fn()} onSort={vi.fn()} sortField="created_at" sortDirection="desc" isHebrew onDetails={vi.fn()} />);
    expect(screen.getAllByTestId('admin-row-test-8').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('admin-row-test-7')).toBeNull();
  });
});
