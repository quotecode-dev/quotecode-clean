import AdminUsersTab from './AdminUsersTab';

// Users destination: the directory, or - when an account is selected - that
// account's details, both inside the same Admin content host. Selecting or
// leaving a user never changes the shell, only this body.
// Admin redesign part A (Owner 2026-10-16): both go through AdminUsersTab, which owns the protected dialogs, so the details page
// offers the same protected actions (AdminUsersTab renders AdminUserDetails for a selected account).
export default function AdminUsersDestination({ host }) {
  const account = host.selectedUserId ? host.accounts.find((a) => a.id === host.selectedUserId) : null;
  return <AdminUsersTab {...host.usersTabProps} onOpenUserDetails={host.openUser} selectedAccount={account} onBackFromDetails={host.clearSelectedUser} />;
}
