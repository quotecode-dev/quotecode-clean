import { createElement } from 'react';
import { LayoutDashboard, Users2, CreditCard, Activity, Bot, Inbox } from 'lucide-react';
import AdminOverview from './AdminOverview';
import AdminPlans from './AdminPlans';
import AdminSystemActivity from './AdminSystemActivity';
import AdminUsersDestination from './AdminUsersDestination';
import AISupportLogsContent from './AISupportLogsContent';
import AdminInquiries from './AdminInquiries';

// THE Admin destination registry - the one and only definition of what an
// Admin destination is. The sidebar group list, the mobile More list, the
// URL section ids, the destination titles and the content renderer are ALL
// derived from this array (utils/adminNavGroups.js, AdminSidebarNav,
// AdminDestinationHost, Dashboard). Adding a destination = adding one entry
// here; it then automatically opens INSIDE the unified Admin body (never a
// new tab/window/page) and is covered by the structural regression tests.
//
// entry: { id, group, icon, label{he,en}, title{he,en}, permission,
//          mobile ('more'), available, render(host) -> element }
// `host` (built in Dashboard.jsx) carries: isHebrew, accounts, isSuperAdmin,
// navigate(id), openUser(account), selectedUserId, clearSelectedUser,
// usersTabProps.
export const ADMIN_GROUPS = {
  overview: { he: 'סקירה', en: 'Overview' },
  management: { he: 'ניהול', en: 'Management' },
  system: { he: 'מערכת', en: 'System' },
};

export const ADMIN_DESTINATIONS = [
  {
    id: 'overview', group: 'overview', icon: LayoutDashboard, permission: 'super_admin', mobile: 'more', available: true,
    label: { he: 'סקירה כללית', en: 'Overview' },
    title: { he: 'סקירה כללית - סופר אדמין', en: 'Admin Overview - Super Admin' },
    render: (host) => createElement(AdminOverview, {
      accounts: host.accounts, isHebrew: host.isHebrew,
      onGoToUsers: () => host.navigate('users'), onGoToPlans: () => host.navigate('plans'), onOpenUser: host.openUser,
      onGoToActivity: () => host.navigate('activity'), onRefreshAccounts: host.refreshAccounts,
    }),
  },
  {
    id: 'users', group: 'management', icon: Users2, permission: 'super_admin', mobile: 'more', available: true,
    label: { he: 'משתמשים', en: 'Users' },
    title: { he: 'ניהול משתמשים - סופר אדמין', en: 'Users - Super Admin' },
    render: (host) => createElement(AdminUsersDestination, { host }),
  },
  {
    id: 'plans', group: 'management', icon: CreditCard, permission: 'super_admin', mobile: 'more', available: true,
    label: { he: 'מסלולים ומנויים', en: 'Plans & subscriptions' },
    title: { he: 'חבילות ומנויים - סופר אדמין', en: 'Plans / Subscriptions - Super Admin' },
    render: (host) => createElement(AdminPlans, { accounts: host.accounts, isHebrew: host.isHebrew, onOpenUser: host.openUser, onGoToUsers: () => host.navigate('users'), onRefreshAccounts: host.refreshAccounts }),
  },
  // Owner console 2026-10-19, typed: "מאשר שינוי ב-L-22: לשונית "פניות" חדשה בממשק הניהול" - the smart support email, stage 1 (read-only)
  {
    id: 'inquiries', group: 'management', icon: Inbox, permission: 'super_admin', mobile: 'more', available: true,
    label: { he: 'פניות', en: 'Inquiries' },
    title: { he: 'פניות - סופר אדמין', en: 'Inquiries - Super Admin' },
    render: (host) => createElement(AdminInquiries, { isHebrew: host.isHebrew }),
  },
  {
    id: 'activity', group: 'system', icon: Activity, permission: 'super_admin', mobile: 'more', available: true,
    label: { he: 'פעילות מערכת', en: 'System activity' },
    title: { he: 'פעילות מערכת - סופר אדמין', en: 'System Activity - Super Admin' },
    render: (host) => createElement(AdminSystemActivity, { accounts: host.accounts, isHebrew: host.isHebrew, onRefreshAccounts: host.refreshAccounts }),
  },
  {
    id: 'ai-support', group: 'system', icon: Bot, permission: 'super_admin', mobile: 'more', available: true,
    label: { he: 'יומן תמיכת AI', en: 'AI support log' },
    title: { he: 'יומן AI Support - סופר אדמין', en: 'AI Support Logs - Super Admin' },
    render: (host) => createElement(AISupportLogsContent, { isHebrew: host.isHebrew }),
  },
];
