import { resolveAccountEntitlement } from '../utils/accountEntitlement';
import { getDisplayIdentityLabel } from '../utils/planCatalog';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';

// TEKANGO Admin V1 (Task 2): Plans/Subscriptions operational view - users
// by package, trials ending soon, expired trials, Lifetime accounts. All
// derived from the same real business_settings rows already loaded
// elsewhere in Admin - no revenue values invented (no real billing/payment
// integration exists yet), no fake plan-change UI where the capability
// does not exist server-side.
const dateLabel = (value, isHebrew) => value && Number.isFinite(new Date(value).getTime())
  ? new Date(value).toLocaleDateString(isHebrew ? 'he-IL' : 'en-GB') : '—';

export default function AdminPlans({ accounts, isHebrew, onOpenUser }) {
  const users = accounts.filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');
  const rows = users.map(account => ({ account, entitlement: resolveAccountEntitlement({ plan: account.plan, trialEndsAt: account.trial_ends_at, role: account.role, isLifetime: account.is_lifetime }) }));

  const planOrder = ['FREE', 'FREE_TRIAL', 'BASIC', 'PRO', 'LIFETIME'];
  const byPlan = planOrder.map(plan => ({
    plan,
    label: getDisplayIdentityLabel(plan, isHebrew),
    rows: rows.filter(r => r.entitlement.displayIdentity === plan),
  }));

  const expiringTrials = rows
    .filter(r => r.entitlement.trialStatus === 'expiringSoon')
    .sort((a, b) => new Date(a.account.trial_ends_at) - new Date(b.account.trial_ends_at));

  const expiredTrials = rows
    .filter(r => r.entitlement.trialStatus === 'expired')
    .sort((a, b) => new Date(b.account.trial_ends_at || 0) - new Date(a.account.trial_ends_at || 0));

  const group = (title, groupRows, dateField, emptyText) => (
    <article className="admin-plans-group">
      <h3>{title}<span className="admin-plans-count">{groupRows.length}</span></h3>
      {groupRows.length === 0 ? (
        <p className="admin-overview-empty">{emptyText}</p>
      ) : (
        <ul className="admin-overview-list">
          {groupRows.map(r => (
            <li key={r.account.id}>
              <button className="admin-overview-row" onClick={() => onOpenUser(r.account)}>
                <span className="admin-overview-row-name" dir="auto">{r.account.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</span>
                <span className="admin-overview-row-meta" dir="ltr">{r.account.email}</span>
                {dateField && <span className="admin-overview-row-date">{dateLabel(r.account[dateField], isHebrew)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );

  return (
    <AdminScreenFrame
      title={isHebrew ? 'חבילות ומנויים' : 'Plans / Subscriptions'}
      subtitle={isHebrew ? 'זהות חבילה לפי מקור האמת הקנוני · ללא נתוני הכנסות' : 'Package identity from the canonical entitlement source · no revenue data'}
      label={isHebrew ? 'חבילות ומנויים' : 'Plans and subscriptions'}
      controls={(
      <div className="admin-plans-summary">
          {byPlan.map(({ plan, label, rows: r }) => (
            <div className="admin-stat" key={plan}>
              <div className="admin-stat-label"><span>{label}</span></div>
              <strong>{r.length}</strong>
            </div>
          ))}
        </div>
      )}
    >
      <div className="admin-plans-grid">
        {group(isHebrew ? 'ניסיון מסתיים בקרוב' : 'Trials ending soon', expiringTrials, 'trial_ends_at', isHebrew ? 'אין ניסיונות שמסתיימים בקרוב.' : 'No trials ending soon.')}
        {group(isHebrew ? 'ניסיון פג תוקף' : 'Expired trials', expiredTrials, 'trial_ends_at', isHebrew ? 'אין ניסיונות שפגו.' : 'No expired trials.')}
        {group(isHebrew ? 'חשבונות Lifetime' : 'Lifetime accounts', byPlan.find(p => p.plan === 'LIFETIME')?.rows || [], 'created_at', isHebrew ? 'אין חשבונות Lifetime.' : 'No Lifetime accounts.')}
      </div>
    </AdminScreenFrame>
  );
}
