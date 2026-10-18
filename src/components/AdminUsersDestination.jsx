import { useEffect, useRef, useState } from 'react';
import AdminUsersTab from './AdminUsersTab';
import { fetchAdminAccountsPage } from '../domain/admin/adminAccountsClient';

// Users destination: the directory, or - when an account is selected - that
// account's details, both inside the same Admin content host. Selecting or
// leaving a user never changes the shell, only this body.
// Admin redesign part A (Owner 2026-10-16): both go through AdminUsersTab, which owns the protected dialogs, so the details page
// offers the same protected actions (AdminUsersTab renders AdminUserDetails for a selected account).
// An account opened from the server list that the loaded accounts do not have yet (registered after the admin page loaded) opens from
// the row itself (review 2026-10-16); once the accounts reload it comes from them.
export default function AdminUsersDestination({ host }) {
  const opened = useRef(null);
  const openUser = (a) => { opened.current = a || null; host.openUser(a); };
  const loaded = host.selectedUserId ? host.accounts.find((a) => a.id === host.selectedUserId) : null;
  const fromRow = host.selectedUserId && opened.current?.id === host.selectedUserId ? opened.current : null;
  // Codex re-verification 2026-10-18 (AV-01): Details read ONE fresh server row of the account (get_admin_accounts by id) - its
  // Lifetime flag and its status come from the same snapshot; re-read whenever the accounts reload (after a protected action)
  const [fresh, setFresh] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setFresh(null);
    if (!host.selectedUserId) return undefined;
    fetchAdminAccountsPage(undefined, { ids: [host.selectedUserId], pageSize: 1 }).then((out) => {
      if (!cancelled && out.state === 'ready' && out.data.rows[0]?.id === host.selectedUserId) setFresh(out.data.rows[0]);
    });
    return () => { cancelled = true; };
  }, [host.selectedUserId, host.accounts]);
  const base = loaded || fromRow;
  // until the fresh row answers: the opened server row (flag + status from one snapshot) over the loaded row; otherwise the loaded row
  const account = fresh ? { ...(base || {}), ...fresh } : fromRow?.status ? { ...(loaded || {}), ...fromRow } : base;
  return <AdminUsersTab {...host.usersTabProps} onOpenUserDetails={openUser} selectedAccount={account} onBackFromDetails={host.clearSelectedUser} onOpenActivity={() => host.navigate('activity')} />;
}
