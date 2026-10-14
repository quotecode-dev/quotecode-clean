import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';
import { formatShortDate } from '../utils/shortDate';
import { getLegacyRecordBreakdown, LEGACY_HISTORY_LABEL } from '../utils/adminAnalytics';
import { AdminPlanSystemNotice, AdminLegacyRecord } from './AdminSubscriptionState';
import { adminTargetUserId, useAdminAccountSummaries } from '../domain/subscriptions/adminAccountSummary';

// TEKANGO Admin V1 (Task 2) Plans/Subscriptions view, reworked for OD-16/OD-20 (subscriptions cross-cut, stream D):
// - the new plan system's state comes ONLY from the read-only admin summary RPC (probed once; per-account state is on the
//   User Details page). Nothing here computes a plan from the legacy fields;
// - the legacy business_settings fields (plan / trial_ends_at / is_lifetime) appear only as the labelled
//   "Legacy record (history)" breakdown of their raw technical values - no Basic/Pro/FREE/trial/LIFETIME labels;
// - no revenue values invented, no plan-change UI (admin never edits entitlement/ledger).
const dateLabel = (value, isHebrew) => value && Number.isFinite(new Date(value).getTime())
  ? formatShortDate(value, (isHebrew ? 'Local' : 'International')) : '—';

export default function AdminPlans({ accounts, isHebrew, onOpenUser }) {
  const users = accounts.filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');
  const breakdown = getLegacyRecordBreakdown(users);
  const { system } = useAdminAccountSummaries(users.length ? [adminTargetUserId(users[0])] : []);
  const legacyTitle = isHebrew ? LEGACY_HISTORY_LABEL.he : LEGACY_HISTORY_LABEL.en;
  const sorted = [...users].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <AdminScreenFrame
      title={isHebrew ? 'מסלולים ומנויים' : 'Plans / Subscriptions'}
      subtitle={isHebrew ? 'מצב המסלולים מהשרת בלבד · ללא נתוני הכנסות' : 'Plan state from the server only · no revenue data'}
      label={isHebrew ? 'מסלולים ומנויים' : 'Plans and subscriptions'}
      controls={(
        <>
          <AdminPlanSystemNotice system={system} isHebrew={isHebrew} />
          <p className="admin-overview-hint">{isHebrew ? 'מצב המסלול של כל חשבון מוצג בעמוד פרטי המשתמש.' : "Each account's plan state is shown on its User Details page."}</p>
        </>
      )}
    >
      <div className="admin-plans-grid">
        <article className="admin-plans-group admin-legacy-breakdown" aria-label={legacyTitle}>
          <h3>{legacyTitle}</h3>
          <p className="admin-overview-hint">{isHebrew ? 'ספירת ערכים טכניים גולמיים לביקורת בלבד. אינה מסלול ואינה זכאות.' : 'Counts of raw technical values, for audit only. Not a plan and not an entitlement.'}</p>
          {breakdown.length === 0 ? (
            <p className="admin-overview-empty">{isHebrew ? 'אין חשבונות.' : 'No accounts.'}</p>
          ) : (
            <ul className="admin-legacy-values" dir="ltr">
              {breakdown.map(({ key, count }) => (
                <li key={key}><code>{key}</code><span className="admin-plans-count">{count}</span></li>
              ))}
            </ul>
          )}
        </article>
        <article className="admin-plans-group">
          <h3>{isHebrew ? 'חשבונות' : 'Accounts'}<span className="admin-plans-count">{sorted.length}</span></h3>
          {sorted.length === 0 ? (
            <p className="admin-overview-empty">{isHebrew ? 'אין חשבונות.' : 'No accounts.'}</p>
          ) : (
            <ul className="admin-overview-list">
              {sorted.map(account => (
                <li key={account.id}>
                  {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                  <button className="admin-overview-row" onClick={() => onOpenUser(account)}>
                    <span className="admin-overview-row-name" dir="auto">{account.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</span>
                    <span className="admin-overview-row-meta" dir="ltr">{account.email}</span>
                    <span className="admin-overview-row-meta"><AdminLegacyRecord account={account} isHebrew={isHebrew} compact /></span>
                    <span className="admin-overview-row-date">{dateLabel(account.created_at, isHebrew)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </AdminScreenFrame>
  );
}
