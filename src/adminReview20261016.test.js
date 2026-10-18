import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Admin part A code review (2026-10-16, after the admin release): the fixes stay in place.
const SRC = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(SRC, p), 'utf8').split(String.fromCharCode(13)).join('');

describe('admin review fixes 2026-10-16', () => {
  it('reloads the admin accounts in place after a completed protected action and leaves a deleted account', () => {
    const dash = read('pages/Dashboard.jsx');
    expect(dash).toContain('async function refreshAllAccounts() {');
    expect(dash).toContain('onAccountsChanged: refreshAllAccounts,');
    const tab = read('components/AdminUsersTab.jsx');
    expect(tab).toContain("if (typeof onAccountsChanged === 'function') onAccountsChanged();");
    expect(tab).toContain("if (deletedOpenAccount && typeof onBackFromDetails === 'function') onBackFromDetails();");
  });

  it('opens Details for an account only the server list has', () => {
    const dest = read('components/AdminUsersDestination.jsx');
    expect(dest).toContain('opened.current?.id === host.selectedUserId ? opened.current : null');
    expect(dest).toContain('onOpenUserDetails={openUser}');
  });

  it('keeps the server status unless the row summary is ready, and shows the full sign-in date on cards', () => {
    const v = read('components/AdminUsersView.jsx');
    expect(v).toContain("summaryOf(a)?.state !== 'ready' ? a.status : computed.key");
    expect(v).toContain('const signInTime = (a) => accountDateTime(a.last_sign_in, a, adminMarket);');
  });

  it('never shows the previous query rows after a different query fails', () => {
    const c = read('domain/admin/adminAccountsClient.js');
    expect(c).toContain('last.current && last.current.dataKey === dataKey && out.state === \'unavailable\'');
    expect(c).toContain('fetchAdminAccountsPage(client, params), key, enabled, JSON.stringify(params)');
  });

  it('dates every audit event of an account by that account market (IRON-DATE-001)', () => {
    expect(read('components/AdminSystemActivity.jsx')).toContain('target ? accountDateTime(row.created_at, target, adminMarket) : fmt(row.created_at)');
    expect(read('components/AdminOverview.jsx')).toContain('target ? accountDateTime(row.created_at, target, adminMarket) : fmtTime(row.created_at)');
    expect(read('components/AdminUserDetails.jsx')).toContain('accountDateTime(row.created_at, account, adminMarket)');
    expect(read('components/AdminUserDetails.jsx')).not.toContain('formatShortDateTime(row.created_at');
  });

  it('moves the focus to the result of a completed protected action', () => {
    const d = read('components/AdminProtectedDialog.jsx');
    expect(d).toContain('useEffect(() => { if (done) doneCloseRef.current?.focus(); }, [done]);');
    expect(d).toContain('ref={doneCloseRef}');
  });
});
