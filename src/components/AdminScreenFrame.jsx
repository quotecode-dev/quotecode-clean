import { LIGHT as NEON, RADIUS, SHADOW } from '../theme/neonTheme';

// Unified Admin: every Admin destination renders through this ONE frame, the
// same page pattern as the ordinary user screens (ClientsTab, FinancesTab,
// ...): the shared `.pf-screen` card, ONE static block (title, controls and
// any column-header row), and the shared `.pf-screen-body` as the only
// vertical scroll owner. No Admin-specific scroll CSS or offsets - the
// scrollbar contract lives entirely in the shared `.pf-*` primitives
// (Dashboard.jsx), so Admin cannot drift from the user screens.
//
// `controls` (search/filters/notices) and `head` (a `.pf-head-gutter` column
// header row) are optional static children. `subtitle` is a small line under
// the title. Children are the scrolling body.
export default function AdminScreenFrame({ title, subtitle, actions, controls, head, label, children }) {
  return (
    <section
      className="pf-screen admin-screen"
      aria-label={label || title}
      style={{ background: NEON.bgCard, padding: '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm }}
    >
      <div className="admin-screen-static">
        <div className="admin-screen-titlebar">
          <div className="admin-screen-heading">
            <h2>{title}</h2>
            {subtitle && <span>{subtitle}</span>}
          </div>
          {actions && <div className="admin-screen-actions">{actions}</div>}
        </div>
        {controls}
      </div>
      {head}
      <div className="pf-screen-body admin-screen-body">{children}</div>
    </section>
  );
}
