import AdminUsersTab from './AdminUsersTab';
import AdminUserDetails from './AdminUserDetails';

// Users destination: the directory, or - when an account is selected - that
// account's details, both inside the same Admin content host. Selecting or
// leaving a user never changes the shell, only this body.
export default function AdminUsersDestination({ host }) {
  const account = host.selectedUserId ? host.accounts.find((a) => a.id === host.selectedUserId) : null;
  if (account) return <AdminUserDetails account={account} isHebrew={host.isHebrew} onBack={host.clearSelectedUser} />;
  return <AdminUsersTab {...host.usersTabProps} onOpenUserDetails={host.openUser} />;
}
