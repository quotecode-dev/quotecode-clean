import { RefreshCw } from 'lucide-react';
import { RADIUS } from '../theme/neonTheme';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import './adminV2.css';

// Unified Admin: every Admin destination renders through this ONE frame, the
// same page pattern as the ordinary user screens (ClientsTab, FinancesTab,
// ...): the shared `.pf-screen` card, ONE static block (title, controls and
// any column-header row), and the shared `.pf-screen-body` as the only
// vertical scroll owner. No Admin-specific scroll CSS or offsets - the
// scrollbar contract lives entirely in the shared `.pf-*` primitives
// (Dashboard.jsx), so Admin cannot drift from the user screens.
// Admin redesign part A (Owner 2026-10-16, spec §4 shared contract): the page head of the approved sketches - breadcrumb, title, one
// line, ONE refresh action and the data time ("not updated since ..." when a refresh failed); the .av visual language (adminV2.css) on
// the static block and the body - the screen root keeps exactly its IRON-MOBILE-WIDTH-001 class list.
//
// `controls` (search/filters/notices) and `head` (a `.pf-head-gutter` column
// header row) are optional static children. `subtitle` is a small line under
// the title. Children are the scrolling body.
export default function AdminScreenFrame({ title, subtitle, actions, controls, head, label, children, isHebrew = true, onRefresh = null, refreshing = false, updatedAt = null, staleSince = null, formatTime = null }) {
  const fmt = (v) => (formatTime ? formatTime(v) : '');
  return (
    <section
      className="pf-screen pf-work-screen admin-screen"
      aria-label={label || title}
      style={{ background: 'var(--av-bg)', padding: '14px 8px', borderRadius: RADIUS.lg, border: 'none' }}
    >
      <div className="admin-screen-static av">
        <div className="admin-screen-titlebar av-pagehead">
          <div className="admin-screen-heading">
            <span className="av-breadcrumb">{t(isHebrew, C.breadcrumb.he, C.breadcrumb.en)} / {title}</span>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="admin-screen-actions av-headactions">
            {actions}
            {onRefresh && (
              <>
                {staleSince
                  ? <span className="av-updated" role="status">{t(isHebrew, C.staleSince.he, C.staleSince.en)} <bdi className="av-num">{fmt(staleSince)}</bdi></span>
                  : updatedAt && <span className="av-updated">{t(isHebrew, C.updatedAt.he, C.updatedAt.en)} <bdi className="av-num">{fmt(updatedAt)}</bdi></span>}
                {/* PRODUCT_TRUTH_DECORATIVE: reloads this admin screen's data from the server (read-only) */}
                <button type="button" className="av-btn" onClick={onRefresh} disabled={refreshing}>
                  <RefreshCw size={16} aria-hidden="true" />{t(isHebrew, C.refresh.he, C.refresh.en)}
                </button>
              </>
            )}
          </div>
        </div>
        {controls}
      </div>
      {head}
      <div className="pf-screen-body admin-screen-body av">{children}</div>
    </section>
  );
}
