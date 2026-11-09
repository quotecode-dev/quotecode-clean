// Owner console 2026-11-09 (typed: "מאשר את תיקוני האדמין כולל שינוי ב-L-22, שחרור עד הלייב"): the plans screen shows the marked test
// accounts on their own card and its plan cards open the real accounts only; the users list filters by account type; user details reads
// its counts from the server (get_admin_account_counts - the tables' owner-only policies returned 0); a failed load says so instead of 0;
// "all time" reads the whole log; the reconcile screen no longer claims "read only"; limited / failed-charge accounts have their own status.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';

const rpcState = vi.hoisted(() => ({ reply: {}, calls: [] }));
vi.mock('./shared/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn, args) => {
      rpcState.calls.push([fn, args]);
      const r = rpcState.reply[fn];
      return r ? r(args) : { data: null, error: { code: 'PGRST202' }, status: 404 };
    }),
    from: () => ({ select: () => ({ eq: async () => ({ count: 0, error: null }) }) }),
  },
}));

import AdminPlans from './components/AdminPlans';
import AdminPermissions from './components/AdminPermissions';
import { peekUsersFilterIntent, clearUsersFilterIntent } from './domain/admin/adminNavIntent';
import { ACCOUNT_STATUS_ORDER } from './domain/subscriptions/subscriptionStatus';

const summary = (o = {}) => ({
  schema: 'admin-dashboard-summary/v1', generatedAt: '2026-11-09T08:00:00Z', managedAccounts: 1, registrationsLast24h: 0, signedInLast10m: 0,
  market: { Local: 1, International: 0, Unknown: 0 }, planSystem: 'active', free10Counter: 'enforced', testAccounts: 20,
  subscriptionStatus: { lifetime: 1, paid_annual: 0, paid_monthly: 0, paid_unverified: 0, free10: 0, trial: 0, trial_ended: 0, free10_inactive: 0, paid_past_due: 0, paid_limited: 0 },
  ...o,
});
beforeEach(() => { rpcState.calls.length = 0; rpcState.reply = {}; clearUsersFilterIntent(); });
afterEach(cleanup);
const read = (p) => readFileSync(p, 'utf8');

describe('2026-11-09 · plans screen: the test accounts on their own card', () => {
  it('shows the 20 marked test accounts apart, and its button opens the test accounts only', async () => {
    rpcState.reply.get_admin_dashboard_summary = () => ({ data: summary(), error: null });
    const onGoToUsers = vi.fn();
    render(<AdminPlans accounts={[]} isHebrew onGoToUsers={onGoToUsers} />);
    const card = await screen.findByTestId('admin-plans-test-card');
    await waitFor(() => expect(card.querySelector('.av-kpi-value').textContent).toBe('20'));
    expect(card.textContent).toContain('חשבונות בדיקה');
    expect(card.textContent).toContain('לא נספרים במסלולים');
    fireEvent.click(card.querySelector('button'));
    expect(peekUsersFilterIntent()).toEqual({ test: 'only' });
    expect(onGoToUsers).toHaveBeenCalled();
  });
  it('a plan card opens the real accounts of that plan only (the same accounts it counts)', async () => {
    rpcState.reply.get_admin_dashboard_summary = () => ({ data: summary(), error: null });
    render(<AdminPlans accounts={[]} isHebrew onGoToUsers={() => {}} />);
    await waitFor(() => expect(document.querySelector('[data-status="lifetime"] .av-kpi-value').textContent).toBe('1'));
    fireEvent.click(document.querySelector('[data-status="lifetime"] button'));
    expect(peekUsersFilterIntent()).toEqual({ status: 'lifetime', test: 'exclude' });
  });
  it('English: the card is "Test accounts"', async () => {
    rpcState.reply.get_admin_dashboard_summary = () => ({ data: summary(), error: null });
    render(<AdminPlans accounts={[]} isHebrew={false} onGoToUsers={() => {}} />);
    const card = await screen.findByTestId('admin-plans-test-card');
    expect(card.textContent).toContain('Test accounts');
    expect(card.textContent).toContain('Not counted in the plans');
  });
  it('a failed load shows the failure and dashes - never counts from the loaded rows', async () => {
    rpcState.reply.get_admin_dashboard_summary = () => ({ data: null, error: { code: '57014', message: 'timeout' } });
    const accounts = [{ id: 1, user_id: 'u1', role: 'user', email: 'a@x.test', is_lifetime: true }];
    render(<AdminPlans accounts={accounts} isHebrew onGoToUsers={() => {}} />);
    expect(await screen.findByTestId('admin-plans-load-failed')).toBeTruthy();
    expect(document.querySelector('[data-status="lifetime"] .av-kpi-value').textContent).toBe('—');
    expect(screen.getByTestId('admin-plans-test-card').querySelector('.av-kpi-value').textContent).toBe('—');
  });
});

describe('2026-11-09 · permissions: a failed load is not "no supervisors"', () => {
  it('shows the failure, not the empty list', async () => {
    rpcState.reply.list_admin_permission_holders = () => ({ data: null, error: { code: '42501' } });
    render(<AdminPermissions accounts={[]} isHebrew />);
    expect((await screen.findByTestId('permissions-load-failed')).textContent).toBe('לא הצלחנו לטעון את רשימת המפקחים. נסו שוב בעוד רגע.');
    expect(screen.queryByTestId('permissions-empty')).toBeNull();
  });
});

describe('2026-11-09 · the wiring of the other fixes', () => {
  it('user details reads its counts from the server function, and the whole audit log', () => {
    const d = read('src/components/AdminUserDetails.jsx');
    expect(d).toContain("supabase.rpc('get_admin_account_counts', { p_user_id: uid })");
    expect(d).not.toContain("supabase.from('quotes')");
    expect(d).toContain("supabase.rpc('get_admin_audit_log', { p_limit: 10000 })");
    expect(read('src/components/AdminSystemActivity.jsx')).toContain("supabase.rpc('get_admin_audit_log', { p_limit: 10000 })");
  });
  it('the users list has an account-type filter sent to the server', () => {
    const v = read('src/components/AdminUsersView.jsx');
    expect(v).toContain('data-testid="admin-users-test-filter"');
    expect(v).toContain("test: testFilter === 'all' ? null : testFilter,");
    expect(read('src/domain/admin/adminAccountsClient.js')).toContain("...(test === 'only' || test === 'exclude' ? { p_test: test } : {}),");
  });
  it('the reconcile screen no longer says "read only"', () => {
    const r = read('src/components/AdminBillingReconcile.jsx');
    expect(r).not.toContain('קריאה בלבד');
    expect(r).not.toContain('Read only');
  });
  it('the admin knows the limited and failed-charge statuses', () => {
    expect(ACCOUNT_STATUS_ORDER).toContain('paid_past_due');
    expect(ACCOUNT_STATUS_ORDER).toContain('paid_limited');
  });
  it('the migration: the two statuses, the test filter, the counts function and the 10000 audit cap', () => {
    const m = read('supabase/migrations/20261109200000_admin_fixes.sql');
    expect(m).toContain("IF v_ent.account_mode = 'paid' AND public.paid_account_limited(p_user_id) THEN RETURN 'paid_limited'; END IF;");
    expect(m).toContain("IF v_ent.account_mode = 'paid' AND v_ent.subscription_status = 'past_due' THEN RETURN 'paid_past_due'; END IF;");
    expect(m).toContain("AND (p_test IS NULL OR (p_test = 'only') = m.is_test)");
    expect(m).toContain('DROP FUNCTION IF EXISTS public.get_admin_accounts(text, text, text, text, text, integer, integer, bigint[]);');
    expect(m).toContain('CREATE OR REPLACE FUNCTION public.get_admin_account_counts(p_user_id uuid)');
    expect(m).toContain('GRANT EXECUTE ON FUNCTION public.get_admin_account_counts(uuid) TO authenticated;');
    expect(m).toContain('LIMIT LEAST(GREATEST(p_limit, 1), 10000);');
    // the server's plan sort order is the shared status order
    expect(m).toContain(`ARRAY['${ACCOUNT_STATUS_ORDER.slice(0, 4).join("', '")}',`);
  });
});
