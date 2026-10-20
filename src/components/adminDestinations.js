import { createElement } from 'react';
import { LayoutDashboard, Users2, CreditCard, Activity, Bot, Inbox, Briefcase, Settings2, KeyRound } from 'lucide-react';
import AdminOverview from './AdminOverview';
import AdminPlans from './AdminPlans';
import AdminSystemActivity from './AdminSystemActivity';
import AdminUsersDestination from './AdminUsersDestination';
import AISupportLogsContent from './AISupportLogsContent';
import AdminInquiries from './AdminInquiries';
import AdminHub from './AdminHub';
import AdminPermissions from './AdminPermissions';

// THE Admin destination registry - the one and only definition of what an
// Admin destination is. The sidebar list, the mobile More list, the
// URL section ids, the destination titles and the content renderer are ALL
// derived from this array (utils/adminNavGroups.js, AdminSidebarNav,
// AdminDestinationHost, Dashboard). Adding a destination = adding one entry
// here; it then automatically opens INSIDE the unified Admin body (never a
// new tab/window/page) and is covered by the structural regression tests.
//
// Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: צמצום תפריט הניהול לשני כפתורים ומסך מרכזי, ומשתמש מפקח עם מסך הרשאות מנהל"
// (spec docs/ADMIN_SUPERVISOR_AND_NAV_SPEC_2026-10-20.md):
//  - the sidebar shows TWO hub buttons ("ניהול" / "מערכת"); each hub is a destination whose screen holds a card per tool of that hub;
//    every tool keeps its own section id (deep links unchanged) and names its hub (`hub`).
//  - `permission` = the admin permission that opens the destination: a permission id (admin_permission_grants, server-checked),
//    'any' (a hub - shown when at least one of its tools is), or 'owner' (super admin only: the permissions screen). A future tool with a
//    new permission id appears in the permissions screen as an unticked box (ADMIN_PERMISSIONS below is derived from this list).
//
// entry: { id, hub, icon, label{he,en}, title{he,en}, description{he,en}, permission, mobile ('more'), available, render(host) -> element }
// `host` (built in Dashboard.jsx) carries: isHebrew, accounts, isSuperAdmin, isOwner, can(permission), navigate(id), openUser(account),
// selectedUserId, clearSelectedUser, usersTabProps.
export const ADMIN_GROUPS = {
  admin: { he: 'ממשק ניהול', en: 'Admin' },
};

export const ADMIN_HUBS = {
  manage: { he: 'ניהול', en: 'Management' },
  system: { he: 'מערכת', en: 'System' },
};

export const ADMIN_DESTINATIONS = [
  {
    id: 'manage', hub: null, isHub: true, group: 'admin', icon: Briefcase, permission: 'any', mobile: 'more', available: true,
    label: { he: 'ניהול', en: 'Management' },
    title: { he: 'ניהול - סופר אדמין', en: 'Management - Super Admin' },
    description: { he: 'כל כלי הניהול במקום אחד', en: 'Every management tool in one place' },
    render: (host) => createElement(AdminHub, { host, hubId: 'manage' }),
  },
  {
    id: 'system', hub: null, isHub: true, group: 'admin', icon: Settings2, permission: 'any', mobile: 'more', available: true,
    label: { he: 'מערכת', en: 'System' },
    title: { he: 'מערכת - סופר אדמין', en: 'System - Super Admin' },
    description: { he: 'פעילות המערכת ויומן העוזר החכם', en: 'System activity and the smart assistant log' },
    render: (host) => createElement(AdminHub, { host, hubId: 'system' }),
  },
  {
    id: 'overview', hub: 'manage', icon: LayoutDashboard, permission: 'overview.view', mobile: 'more', available: true,
    label: { he: 'סקירה כללית', en: 'Overview' },
    title: { he: 'סקירה כללית - סופר אדמין', en: 'Admin Overview - Super Admin' },
    description: { he: 'מצב המערכת במבט אחד', en: 'The system at a glance' },
    render: (host) => createElement(AdminOverview, {
      accounts: host.accounts, isHebrew: host.isHebrew,
      onGoToUsers: () => host.navigate('users'), onGoToPlans: () => host.navigate('plans'), onOpenUser: host.openUser,
      onGoToActivity: () => host.navigate('activity'), onRefreshAccounts: host.refreshAccounts,
    }),
  },
  {
    id: 'users', hub: 'manage', icon: Users2, permission: 'users.view', mobile: 'more', available: true,
    label: { he: 'משתמשים', en: 'Users' },
    title: { he: 'ניהול משתמשים - סופר אדמין', en: 'Users - Super Admin' },
    description: { he: 'כל החשבונות, הפרטים והמצב', en: 'Every account, its details and status' },
    render: (host) => createElement(AdminUsersDestination, { host }),
  },
  {
    id: 'plans', hub: 'manage', icon: CreditCard, permission: 'plans.view', mobile: 'more', available: true,
    label: { he: 'מסלולים ומנויים', en: 'Plans & subscriptions' },
    title: { he: 'חבילות ומנויים - סופר אדמין', en: 'Plans / Subscriptions - Super Admin' },
    description: { he: 'מסלולים, מנויים ומצב תשלום', en: 'Plans, subscriptions and payment status' },
    render: (host) => createElement(AdminPlans, { accounts: host.accounts, isHebrew: host.isHebrew, onOpenUser: host.openUser, onGoToUsers: () => host.navigate('users'), onRefreshAccounts: host.refreshAccounts }),
  },
  // Owner console 2026-10-19, typed: "מאשר שינוי ב-L-22: לשונית "פניות" חדשה בממשק הניהול" - the smart support email
  {
    id: 'inquiries', hub: 'manage', icon: Inbox, permission: 'inquiries.view', mobile: 'more', available: true,
    label: { he: 'פניות', en: 'Inquiries' },
    title: { he: 'פניות - סופר אדמין', en: 'Inquiries - Super Admin' },
    description: { he: 'פניות מהתמיכה ומהמידע, טיוטות ותשובות', en: 'Support and info emails, drafts and replies' },
    render: (host) => createElement(AdminInquiries, { isHebrew: host.isHebrew, canReply: host.can('inquiries.reply'), canSettings: host.can('inquiries.settings') }),
  },
  // Owner console 2026-10-20 (L-22): the permissions screen - the Owner only, never a supervisor
  {
    id: 'permissions', hub: 'manage', icon: KeyRound, permission: 'owner', mobile: 'more', available: true,
    label: { he: 'הרשאות מנהל', en: 'Admin permissions' },
    title: { he: 'הרשאות מנהל - סופר אדמין', en: 'Admin permissions - Super Admin' },
    description: { he: 'מי עוד עוזר בניהול, ומה מותר לו', en: 'Who else helps run the admin, and what they may do' },
    render: (host) => createElement(AdminPermissions, { isHebrew: host.isHebrew, accounts: host.accounts }),
  },
  {
    id: 'activity', hub: 'system', icon: Activity, permission: 'activity.view', mobile: 'more', available: true,
    label: { he: 'פעילות מערכת', en: 'System activity' },
    title: { he: 'פעילות מערכת - סופר אדמין', en: 'System Activity - Super Admin' },
    description: { he: 'מה קרה במערכת לאחרונה', en: 'What happened in the system lately' },
    render: (host) => createElement(AdminSystemActivity, { accounts: host.accounts, isHebrew: host.isHebrew, onRefreshAccounts: host.refreshAccounts }),
  },
  {
    id: 'ai-support', hub: 'system', icon: Bot, permission: 'ai-support.view', mobile: 'more', available: true,
    label: { he: 'יומן תמיכת AI', en: 'AI support log' },
    title: { he: 'יומן AI Support - סופר אדמין', en: 'AI Support Logs - Super Admin' },
    description: { he: 'שיחות העוזר החכם עם המשתמשים', en: 'The smart assistant\'s conversations with users' },
    render: (host) => createElement(AISupportLogsContent, { isHebrew: host.isHebrew }),
  },
];

// The permissions the Owner can grant (the permissions screen lists them as boxes), derived from the registry plus the action-level
// permissions inside a screen. Must match the server's known list (20261020200000 set_admin_permissions).
export const ADMIN_PERMISSIONS = Object.freeze([
  ...ADMIN_DESTINATIONS.filter((d) => !d.isHub && d.permission !== 'owner').map((d) => Object.freeze({ id: d.permission, destination: d.id, label: d.label, action: false })),
  Object.freeze({ id: 'inquiries.reply', destination: 'inquiries', label: { he: 'מענה על פניות ושליחת תשובות', en: 'Reply to inquiries and send answers' }, action: true }),
  Object.freeze({ id: 'inquiries.settings', destination: 'inquiries', label: { he: 'שינוי הגדרות העוזר', en: 'Change the assistant settings' }, action: true }),
]);

/** Whether a destination is open for this access ({ owner, permissions[] }); a hub when at least one of its tools is. */
export function canOpenDestination(d, access) {
  if (!d) return false;
  const owner = access?.owner === true;
  const perms = Array.isArray(access?.permissions) ? access.permissions : [];
  if (d.permission === 'owner') return owner;
  if (d.permission === 'any') return owner || ADMIN_DESTINATIONS.some((t) => t.hub === d.id && canOpenDestination(t, access));
  return owner || perms.includes(d.permission);
}
