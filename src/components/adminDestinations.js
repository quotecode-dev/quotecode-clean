import { createElement } from 'react';
import { LayoutDashboard, Users2, CreditCard, Activity, Bot, Inbox, Briefcase, Settings2, KeyRound, Coins, Receipt, Scale, SearchCheck, Network, Megaphone } from 'lucide-react';
import AdminOverview from './AdminOverview';
import AdminPlans from './AdminPlans';
import AdminSystemActivity from './AdminSystemActivity';
import AdminUsersDestination from './AdminUsersDestination';
import AISupportLogsContent from './AISupportLogsContent';
import AdminInquiries from './AdminInquiries';
import AdminHub from './AdminHub';
import AdminPermissions from './AdminPermissions';
import AdminTwinCosts from './AdminTwinCosts';
import AdminExpenseInvoices from './AdminExpenseInvoices';
import AdminBillingReconcile from './AdminBillingReconcile';
import AdminSearchConsole from './AdminSearchConsole';
import AdminAgentsRoom from './AdminAgentsRoom';
import AdminSocialPosts from './AdminSocialPosts';
import { focusInquiry } from '../utils/adminInquiryFocus';

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
    render: (host) => createElement(AdminInquiries, { isHebrew: host.isHebrew, canReply: host.can('inquiries.reply'), canSettings: host.can('inquiries.settings'), canLink: host.isSuperAdmin === true }),
  },
  // Owner console 2026-10-27 (L-22, "מאשר את שניהם"): the social agent's posts - a supervisor with social.view reads them, social.publish
  // approves and marks them published (the agents-room function checks both again); never the rest of the agents room
  {
    id: 'social', hub: 'manage', icon: Megaphone, permission: 'social.view', mobile: 'more', available: true,
    label: { he: 'רשתות חברתיות', en: 'Social media' },
    title: { he: 'רשתות חברתיות - סופר אדמין', en: 'Social media - Super Admin' },
    description: { he: 'פוסטים לפייסבוק, לאינסטגרם ולטיקטוק: אישור, העתקה ופרסום', en: 'Posts for Facebook, Instagram and TikTok: approve, copy and publish' },
    render: (host) => createElement(AdminSocialPosts, { isHebrew: host.isHebrew }),
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
    label: { he: 'יומן התמיכה של העוזר החכם', en: 'AI support log' },
    title: { he: 'יומן התמיכה של העוזר החכם — מנהל מערכת ראשי', en: 'AI Support Logs - Super Admin' },
    description: { he: 'שיחות העוזר החכם עם המשתמשים', en: 'The smart assistant\'s conversations with users' },
    render: (host) => createElement(AISupportLogsContent, { isHebrew: host.isHebrew }),
  },
  // Owner console 2026-10-23, typed approval of L-22: "מסך עלויות בדיקת הלקוח בניהול" - the Owner only (the server allows super admin only)
  {
    id: 'twin-costs', hub: 'system', icon: Coins, permission: 'owner', mobile: 'more', available: true,
    label: { he: 'עלויות בדיקת הלקוח', en: 'Customer check costs' },
    title: { he: 'עלויות בדיקת הלקוח - סופר אדמין', en: 'Customer check costs - Super Admin' },
    description: { he: 'כמה בדיקות רצו וכמה הן עלו לנו, לפי יום', en: 'How many checks ran and what they cost us, by day' },
    render: (host) => createElement(AdminTwinCosts, { isHebrew: host.isHebrew }),
  },
  // Owner console 2026-10-22, typed approval of L-22: "כלי חשבוניות הוצאה במסך מערכת בניהול ..." - the Owner only (server: super admin only)
  {
    id: 'expense-invoices', hub: 'system', icon: Receipt, permission: 'owner', mobile: 'more', available: true,
    label: { he: 'חשבוניות הוצאה', en: 'Expense invoices' },
    title: { he: 'חשבוניות הוצאה - סופר אדמין', en: 'Expense invoices - Super Admin' },
    description: { he: 'חשבוניות מתיבות הדואר, אישור ושליחה להוצאות בפיי פלוס', en: 'Invoices from the mailboxes, approval and sending to PayPlus expenses' },
    render: (host) => createElement(AdminExpenseInvoices, { isHebrew: host.isHebrew }),
  },
  // Owner console 2026-10-23, typed approval of L-22: "... התאמת תשלומים יומית עם מסך בניהול" - the Owner only (server: super admin only)
  {
    id: 'billing-reconcile', hub: 'system', icon: Scale, permission: 'owner', mobile: 'more', available: true,
    label: { he: 'התאמת תשלומים', en: 'Payment reconciliation' },
    title: { he: 'התאמת תשלומים - סופר אדמין', en: 'Payment reconciliation - Super Admin' },
    description: { he: 'השוואה יומית בין העסקאות בפיי פלוס לתשלומים שנרשמו אצלנו', en: 'A daily comparison of the PayPlus transactions with the payments we recorded' },
    render: (host) => createElement(AdminBillingReconcile, { isHebrew: host.isHebrew }),
  },
  // Owner console 2026-10-26 (typed: "מאשר לבנות מסך גוגל סרץ' קונסול במסך הניהול, בקריאה בלבד") - the Owner only (server: super admin only)
  {
    id: 'search-console', hub: 'system', icon: SearchCheck, permission: 'owner', mobile: 'more', available: true,
    label: { he: "גוגל סרץ' קונסול", en: 'Google Search Console' },
    title: { he: "גוגל סרץ' קונסול - סופר אדמין", en: 'Google Search Console - Super Admin' },
    description: { he: 'קליקים, הופעות וחיפושים בגוגל, ומצב האינדוקס של הדפים', en: 'Clicks, impressions and searches on Google, and the indexing of the pages' },
    render: (host) => createElement(AdminSearchConsole, { isHebrew: host.isHebrew }),
  },
  // Owner console 2026-10-27 (typed: "מאשר שלב 1 של חדר הסוכנים ...") - the Owner only (server: super admin only)
  {
    id: 'agents-room', hub: 'system', icon: Network, permission: 'owner', mobile: 'more', available: true,
    label: { he: 'חדר הסוכנים', en: 'Agents room' },
    title: { he: 'חדר הסוכנים - סופר אדמין', en: 'Agents room - Super Admin' },
    description: { he: 'סוכני הקידום, השירות והאבטחה: מה מצאו ומה הם ממליצים', en: 'The SEO, service and security agents: what they found and recommend' },
    render: (host) => createElement(AdminAgentsRoom, {
      isHebrew: host.isHebrew,
      // the service card's red inquiries open in the inquiries screen, only for an account that may open it (Owner 2026-10-27, L-22)
      onOpenInquiry: host.can('inquiries.view') ? (id) => { focusInquiry(id); host.navigate('inquiries'); } : null,
    }),
  },
];

// The permissions the Owner can grant (the permissions screen lists them as boxes), derived from the registry plus the action-level
// permissions inside a screen. Must match the server's known list (20261020200000 set_admin_permissions).
export const ADMIN_PERMISSIONS = Object.freeze([
  ...ADMIN_DESTINATIONS.filter((d) => !d.isHub && d.permission !== 'owner').map((d) => Object.freeze({ id: d.permission, destination: d.id, label: d.label, action: false })),
  Object.freeze({ id: 'inquiries.reply', destination: 'inquiries', label: { he: 'מענה על פניות ושליחת תשובות', en: 'Reply to inquiries and send answers' }, action: true }),
  Object.freeze({ id: 'inquiries.settings', destination: 'inquiries', label: { he: 'שינוי הגדרות העוזר', en: 'Change the assistant settings' }, action: true }),
  Object.freeze({ id: 'social.publish', destination: 'social', label: { he: 'אישור פוסטים וסימון פורסם', en: 'Approve posts and mark them published' }, action: true }),
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
