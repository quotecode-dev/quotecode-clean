import { ADMIN_NAV_GROUPS } from '../utils/adminNavGroups';

// Unified Admin: Admin destinations are an ADDITIVE group inside the one
// shared sidebar (same `.dash-sidebar-btn`/`.dash-sidebar-nav` classes and
// geometry as the business nav) - never a second Admin navigation shell.
// Business destinations and the account/utility zone stay owned by
// Dashboard.jsx, so there is no "My Workspace" switch: both sets of
// destinations are always in the same list for a Super Admin.
// `section` is the active Admin destination id, or null when a business
// screen is showing. Nav model lives in src/utils/adminNavGroups.js.
export default function AdminSidebarNav({ section, onSelect, isHebrew }) {
  const t = (entry) => (isHebrew ? entry.he : entry.en);
  return (
    <>
      {ADMIN_NAV_GROUPS.map((group) => (
        <div className="admin-sidebar-group" key={t(group.label)}>
          <div className="admin-sidebar-group-label">{t(group.label)}</div>
          {group.items.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              className={section === id ? 'dash-sidebar-btn dash-sidebar-btn-active' : 'dash-sidebar-btn'}
              onClick={() => onSelect(id)}
            >
              <Icon size={17} strokeWidth={2.2} />
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
      ))}
    </>
  );
}
