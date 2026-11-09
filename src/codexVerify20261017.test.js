import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { subscriptionStatusLabel, planStateText } from './domain/subscriptions/adminAccountSummary';
import { parseDashboardSummary } from './domain/admin/adminAccountsClient';
import { setUsersFilterIntent, peekUsersFilterIntent, clearUsersFilterIntent, saveUsersListState, peekUsersListState, clearUsersListState } from './domain/admin/adminNavIntent';

// Owner console 2026-10-17, typed: "מאשר תיקון כל 16 הממצאים של קודקס (AV-01 עד AV-16), כולל העברה חדשה למסד ל-AV-09 ו-AV-13, ותיקון
// AV-04 רק בהקשר האדמין" (docs/CODEX_ADMIN_VERIFY_2026-10-17.md). The fixes stay in place.
const SRC = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(SRC, p), 'utf8').split(String.fromCharCode(13)).join('');
const summary = { schema: 'admin-dashboard-summary/v1', managedAccounts: 1, registrationsLast24h: 0, signedInLast10m: 0, market: { Local: 1, International: 0, Unknown: 0 },
  subscriptionStatus: { lifetime: 0, paid_annual: 0, paid_monthly: 0, paid_unverified: 0, free10: 0, trial: 0, trial_ended: 0, free10_inactive: 1 }, planSystem: 'active' };

describe('Codex verification fixes 2026-10-17', () => {
  it('AV-01: the details status keeps the server status and never invents a plan when the summary failed', () => {
    const d = read('components/AdminUserDetails.jsx');
    expect(d).toContain("const status = summaryReady || account.is_lifetime === true ? computedStatus : serverStatus ? statusFromKey(serverStatus, { until: account.trial_ends_at }) : computedStatus;");
    expect(d).toContain("const statusUnknown = summaryFailed && !serverStatus && status.key === 'free10_inactive';");
    expect(d).toContain("'מצב המנוי אינו זמין כרגע'");
    // re-verification 2026-10-18: one fresh server row (flag + status from one snapshot); badges only with a proven status; counters only decided
    const dest = read('components/AdminUsersDestination.jsx');
    expect(dest).toContain("fetchAdminAccountsPage(undefined, { ids: [host.selectedUserId], pageSize: 1 })");
    expect(dest).toContain('const account = fresh ? { ...(base || {}), ...fresh } : fromRow?.status ? { ...(loaded || {}), ...fromRow } : base;');
    expect(d).toContain("{status.key === 'free10_inactive' && !statusUnknown && <span");
    expect(d).toContain("const free10 = status.key === 'free10' && Number.isInteger(status.consumed) && Number.isInteger(status.remaining) ? status : null;");
  });
  it('AV-02: a failed server list is a failure, never a decided empty result', () => {
    const v = read('components/AdminUsersView.jsx');
    expect(v).toContain("const serverMode = (server.state === 'ready' || server.state === 'stale') && !!server.data;");
    expect(v).toContain("const failed = !serverMode && server.state === 'unavailable';");
    expect(v).toContain(': failed ? [] : local.slice(');
  });
  it('AV-03: the revoke dialog explains the revoke', () => {
    const tab = read('components/AdminUsersTab.jsx');
    expect(tab).toContain('{targetIsLifetime ? revokeOnlyText : legacyOnlyText}');
  });
  it('AV-04: Ask AI from an admin dialog moves the focus into the assistant - admin context only', () => {
    expect(read('components/AdminProtectedDialog.jsx')).toContain('aiContext="admin_dialog"');
    const w = read('AIChatWidget.jsx');
    expect(w).toContain("if (e?.detail?.context === 'admin_dialog') { focusIntoChatRef.current = true; setFocusIntoChatTick((n) => n + 1); }");
    expect(read('components/AiHelpButton.jsx')).toContain("detail: context ? { source: 'in_context_help', context } : { source: 'in_context_help' }");
  });
  it('AV-05 / AV-06: the legend intent is read without being consumed; the list state survives Details', () => {
    setUsersFilterIntent({ market: 'Local' });
    expect(peekUsersFilterIntent()).toEqual({ market: 'Local' });
    expect(peekUsersFilterIntent()).toEqual({ market: 'Local' }); // a second render still sees it
    clearUsersFilterIntent();
    expect(peekUsersFilterIntent()).toBeNull();
    saveUsersListState({ market: 'International', status: 'all', sort: { field: 'business_name', direction: 'asc' }, page: 1, scrollTop: 120 });
    expect(peekUsersListState()).toMatchObject({ market: 'International', page: 1, scrollTop: 120 });
    expect(peekUsersListState()).toMatchObject({ market: 'International' }); // a second render still sees it
    clearUsersListState();
    expect(peekUsersListState()).toBeNull();
    expect(read('components/AdminUsersView.jsx')).toContain('useEffect(() => { clearUsersFilterIntent(); clearUsersListState(); }, []);');
  });
  it('AV-07: phones / tablets sort through one select', () => {
    expect(read('components/AdminUsersView.jsx')).toContain("['plan', 'desc'], ['indicators', 'asc'], ['indicators', 'desc'], ['country', 'asc'], ['country', 'desc']]");
    const v = read('components/AdminUsersView.jsx');
    expect(v).toContain('{!wide && (');
    expect(v).toContain('SORT_OPTIONS.map(([f, d])');
  });
  it('AV-08: a refresh reloads the accounts behind recent registrations and the registrations feed', () => {
    expect(read('components/adminDestinations.js').match(/onRefreshAccounts: host\.refreshAccounts/g)).toHaveLength(3);
    expect(read('pages/Dashboard.jsx')).toContain('refreshAccounts: refreshAllAccounts,');
  });
  it('AV-09: the Free-10 counter is active only when enforced', () => {
    expect(parseDashboardSummary({ ...summary }).free10Counter).toBe('not_enforced');
    expect(parseDashboardSummary({ ...summary, free10Counter: 'enforced' }).free10Counter).toBe('enforced');
    expect(read('components/AdminPlans.jsx')).toContain("s?.free10Counter === 'enforced'");
  });
  it('AV-10 / AV-14 / AV-15 / AV-16: touch targets, the portrait-tablet admin drawer, the email alignment, the focused field above the actions', () => {
    const css = read('components/adminV2.css');
    expect(css).toContain('.av-legend-row { min-height: 44px; }');
    expect(css).toContain('@media (min-width: 769px) and (max-width: 999px) {');
    expect(css).toContain('.dash-shell-body:has(.admin-screen) > .dash-sidebar.dash-operator-sidebar { display: none !important; }');
    expect(css).toContain('html[dir="rtl"] .av .av-business .av-mail { text-align: right; }');
    expect(css).toContain('.av-dialog { scroll-padding-block-end: 96px; }');
    expect(read('components/AdminScreenFrame.jsx')).toContain("window.dispatchEvent(new Event('tekango-open-admin-drawer'))");
  });
  it('re-verification: AV-04 refocus, AV-06 page kept, AR-02 partial refresh, AR-03 menu only on a portrait tablet', () => {
    expect(read('AIChatWidget.jsx')).toContain('}, [isOpen, focusIntoChatTick]);');
    expect(read('components/AdminUsersView.jsx')).toContain("if ((search || '') !== searchSeen.current) { searchSeen.current = search || ''; setPage(0); }");
    expect(read('pages/Dashboard.jsx')).toContain("if (!error && Array.isArray(data)) { setAllAccounts(data); return true; }");
    expect(read('components/AdminOverview.jsx')).toContain('setAccountsStale(ok === false)');
    expect(read('components/AdminSystemActivity.jsx')).toContain('setAccountsStale(ok === false)');
    const css = read('components/adminV2.css');
    expect(css).toContain('.av button.av-btn.av-drawer-open { display: none; }');
    expect(read('pages/Dashboard.jsx')).toContain("window.matchMedia('(min-width:769px) and (max-width:999px)').matches) setShellDrawerOpen(true);");
  });
  it('AV-11: the menu button takes the focus before its dialog opens', () => {
    expect(read('components/AdminUsersView.jsx')).toContain('const pick = (fn) => { btn.current?.focus(); setOpen(false); fn(account); };');
  });
  it('AV-12: no "no subscription" words', () => {
    expect(subscriptionStatusLabel('none', true)).toBeNull();
    expect(subscriptionStatusLabel('active', true)).toBe('מנוי פעיל');
    expect(planStateText({ state: 'ready', planId: 'free', free10: { remaining: 7, limit: 10 }, subscriptionStatus: 'none' }, true)).not.toContain('ללא מנוי');
  });
  it('AV-13: a missing date sorts last (fallback list) - the server rule is DB test 390', () => {
    const v = read('components/AdminUsersView.jsx');
    expect(v).toContain('if (va === null && vb !== null) return 1;');
    expect(read('../supabase/migrations/20261017000000_admin_followup_counter_and_nulls.sql')).toContain('THEN f.last_sign_in END ASC NULLS LAST');
  });
});
