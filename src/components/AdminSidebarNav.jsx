import { useEffect, useState } from 'react';
import { ADMIN_NAV_GROUPS } from '../utils/adminNavGroups';
import { supabase } from '../shared/supabase';

// Unified Admin: Admin destinations are an ADDITIVE group inside the one
// shared sidebar (same `.dash-sidebar-btn`/`.dash-sidebar-nav` classes and
// geometry as the business nav) - never a second Admin navigation shell.
// Business destinations and the account/utility zone stay owned by
// Dashboard.jsx, so there is no "My Workspace" switch: both sets of
// destinations are always in the same list for a Super Admin.
// `section` is the active Admin destination id, or null when a business
// screen is showing. Nav model lives in src/utils/adminNavGroups.js.
// Smart support email stage 2 (Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: שלב 2 של המייל החכם (צבעים, מונה, ...)"): the
// "פניות" item carries the red counter of inquiries waiting for the Owner (read under RLS - a super admin only; any failure = no counter).
function usePendingInquiries(section) {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener('tekango:inquiries-changed', bump);
    return () => window.removeEventListener('tekango:inquiries-changed', bump);
  }, []);
  useEffect(() => {
    let cancelled = false;
    try {
      Promise.resolve(supabase?.from?.('support_inbound_messages')?.select?.('id', { count: 'exact', head: true })?.in?.('status', ['waiting', 'draft']))
        .then((res) => { if (!cancelled && Number.isFinite(res?.count)) setCount(res.count); })
        .catch(() => {});
    } catch {
      // no counter
    }
    return () => { cancelled = true; };
  }, [section, tick]);
  return count;
}

export default function AdminSidebarNav({ section, onSelect, isHebrew }) {
  const t = (entry) => (isHebrew ? entry.he : entry.en);
  const pending = usePendingInquiries(section);
  return (
    <>
      {ADMIN_NAV_GROUPS.map((group) => (
        <div className="admin-sidebar-group" key={t(group.label)}>
          <div className="admin-sidebar-group-label">{t(group.label)}</div>
          {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
          {group.items.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              className={section === id ? 'dash-sidebar-btn dash-sidebar-btn-active' : 'dash-sidebar-btn'}
              onClick={() => onSelect(id)}
            >
              <Icon size={17} strokeWidth={2.2} />
              <span>{t(label)}</span>
              {id === 'inquiries' && pending > 0 && (
                <span className="admin-nav-count" data-testid="admin-nav-inquiries-count" aria-label={isHebrew ? `${pending} ממתינות לך` : `${pending} waiting for you`}>{pending}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </>
  );
}
