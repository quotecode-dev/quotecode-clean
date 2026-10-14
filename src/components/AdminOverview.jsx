import { useEffect, useState } from 'react';
import { UserPlus, ArrowRight, ArrowLeft, ListChecks, History } from 'lucide-react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';
import { AdminMarketIcon } from './AdminIdentityIcons';
import { getAdminKpiSummary, getLegacyRecordBreakdown, LEGACY_HISTORY_LABEL } from '../utils/adminAnalytics';
import { AdminPlanSystemNotice } from './AdminSubscriptionState';
import { adminTargetUserId, useAdminAccountSummaries } from '../domain/subscriptions/adminAccountSummary';
import { formatShortDateTime } from '../utils/shortDate';

// TEKANGO Admin V1 (Task 2): Admin Overview - recently registered, admin
// activity and the legacy-record (history) breakdown, derived only from real
// business_settings rows already loaded elsewhere in Admin. No fabricated
// metric, no "active now"/online inference. OD-16/OD-20: no Basic/Pro/trial/
// LIFETIME KPI or card - the new plan system's state comes only from the
// admin summary RPC (AdminPlanSystemNotice); legacy values are history only.
const dateLabel = (value, isHebrew) => value && Number.isFinite(new Date(value).getTime())
  ? formatShortDateTime(value, (isHebrew ? 'Local' : 'International')) : '—';

export default function AdminOverview({ accounts, isHebrew, onGoToUsers, onGoToPlans, onOpenUser }) {
  const users = accounts.filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');
  const recentlyRegistered = [...users]
    .filter(a => a.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  const kpi = getAdminKpiSummary(users);
  const legacyBreakdown = getLegacyRecordBreakdown(users);
  const legacyTitle = isHebrew ? LEGACY_HISTORY_LABEL.he : LEGACY_HISTORY_LABEL.en;
  const { system } = useAdminAccountSummaries(users.length ? [adminTargetUserId(users[0])] : []);
  // Every figure below is counted from the same loaded account rows - nothing estimated or invented.
  const stats = [
    [isHebrew ? 'סה"כ משתמשים' : 'Total users', kpi.managedBusinesses],
    [isHebrew ? 'נרשמו ב-24 השעות האחרונות' : 'Registered in the last 24 hours', kpi.registrationsLast24h],
  ];

  const [recentAudit, setRecentAudit] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_admin_audit_log', { p_limit: 5 }).then(({ data, error }) => {
      if (!cancelled) setRecentAudit(error ? 'unavailable' : (data || []));
    });
    return () => { cancelled = true; };
  }, []);

  const list = (items, empty, render) => items.length === 0
    ? <p className="admin-overview-empty">{empty}</p>
    : <ul className="admin-overview-list">{items.map(render)}</ul>;

  return (
    <AdminScreenFrame
      title={isHebrew ? 'סקירה כללית' : 'Admin Overview'}
      subtitle={isHebrew ? 'סקירת תפעול · נתוני חשבונות אמיתיים בלבד' : 'Operational summary · real account data only'}
      label={isHebrew ? 'סקירה כללית' : 'Admin overview'}
      controls={(
        <>
        <div className="admin-plans-summary">
          {stats.map(([label, value]) => (
            <div className="admin-stat" key={label}>
              <div className="admin-stat-label"><span>{label}</span></div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <AdminPlanSystemNotice system={system} isHebrew={isHebrew} />
        </>
      )}
    >
      <div className="admin-overview-grid">
        <article className="admin-overview-card">
          <h3><UserPlus size={16} />{isHebrew ? 'נרשמו לאחרונה' : 'Recently registered'}</h3>
          {list(recentlyRegistered, isHebrew ? 'אין הרשמות אחרונות.' : 'No recent registrations.', a => (
            <li key={a.id}>
              {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
              <button className="admin-overview-row" onClick={() => onOpenUser(a)}>
                <span className="admin-overview-row-name" dir="auto">{a.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</span>
                <span className="admin-overview-row-meta" dir="ltr">{a.email}</span>
                <span className="admin-card-badges"><AdminMarketIcon account={a} isHebrew={isHebrew} /></span>
                <span className="admin-overview-row-date">{dateLabel(a.created_at, isHebrew)}</span>
              </button>
            </li>
          ))}
        </article>

        <article className="admin-overview-card admin-legacy-breakdown" aria-label={legacyTitle}>
          <h3><ListChecks size={16} />{legacyTitle}</h3>
          <p className="admin-overview-hint">{isHebrew ? 'ערכים טכניים גולמיים לביקורת בלבד. אינם מסלול ואינם זכאות.' : 'Raw technical values for audit only. Not a plan and not an entitlement.'}</p>
          {legacyBreakdown.length === 0
            ? <p className="admin-overview-empty">{isHebrew ? 'אין חשבונות.' : 'No accounts.'}</p>
            : (
              <ul className="admin-legacy-values" dir="ltr">
                {legacyBreakdown.map(({ key, count }) => <li key={key}><code>{key}</code><span className="admin-plans-count">{count}</span></li>)}
              </ul>
            )}
        </article>
        <article className="admin-overview-card">
          <h3><History size={16} />{isHebrew ? 'פעילות ניהול אחרונה' : 'Recent admin activity'}</h3>
          {recentAudit === 'loading' ? (
            <p className="admin-overview-empty">{isHebrew ? 'טוען...' : 'Loading...'}</p>
          ) : recentAudit === 'unavailable' ? (
            <p className="admin-overview-empty">{isHebrew ? 'לא זמין כרגע.' : 'Unavailable right now.'}</p>
          ) : list(recentAudit, isHebrew ? 'אין פעולות מוגנות מתועדות.' : 'No privileged actions recorded yet.', row => (
            <li key={row.id}>
              <div className="admin-overview-row" style={{ cursor: 'default' }}>
                <span className="admin-overview-row-name" dir="auto">{row.action} · {row.outcome}</span>
                <span className="admin-overview-row-date">{dateLabel(row.created_at, isHebrew)}</span>
              </div>
            </li>
          ))}
        </article>
      </div>

      <div className="admin-overview-actions">
        {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
        <button className="admin-overview-quick-action" onClick={onGoToUsers}>
          {isHebrew ? 'עבור לרשימת המשתמשים' : 'Go to Users'}{isHebrew ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
        </button>
        {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
        <button className="admin-overview-quick-action" onClick={onGoToPlans}>
          {isHebrew ? 'עבור למסלולים ומנויים' : 'Go to Plans / Subscriptions'}{isHebrew ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
        </button>
      </div>
    </AdminScreenFrame>
  );
}
