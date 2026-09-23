import { useEffect, useState } from 'react';
import { UserPlus, AlertTriangle, ArrowRight, ArrowLeft, ListChecks, History } from 'lucide-react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import { resolveAccountEntitlement } from '../utils/accountEntitlement';
import './adminUsers.css';
import { AdminPackageIcon, AdminMarketIcon } from './AdminIdentityIcons';
import { formatShortDateTime } from '../utils/shortDate';

// TEKANGO Admin V1 (Task 2): Admin Overview - recently registered / trials
// ending soon / needs attention, derived only from real business_settings
// rows already loaded elsewhere in Admin. No fabricated metric, no "active
// now"/online inference.
const dateLabel = (value, isHebrew) => value && Number.isFinite(new Date(value).getTime())
  ? formatShortDateTime(value, (isHebrew ? 'Local' : 'International')) : '—';

export default function AdminOverview({ accounts, isHebrew, onGoToUsers, onGoToPlans, onOpenUser }) {
  const users = accounts.filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');
  const rows = users.map(account => ({ account, entitlement: resolveAccountEntitlement({ plan: account.plan, trialEndsAt: account.trial_ends_at, role: account.role, isLifetime: account.is_lifetime }) }));

  const recentlyRegistered = [...users]
    .filter(a => a.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  const trialsEndingSoon = rows
    .filter(({ entitlement }) => entitlement.trialStatus === 'expiringSoon')
    .sort((a, b) => new Date(a.account.trial_ends_at) - new Date(b.account.trial_ends_at))
    .slice(0, 8);

  const needsAttention = rows
    .filter(({ entitlement }) => entitlement.trialStatus === 'expired' && entitlement.displayIdentity === 'FREE')
    .sort((a, b) => new Date(b.account.trial_ends_at || 0) - new Date(a.account.trial_ends_at || 0))
    .slice(0, 8);

  const trialSummary = account => {
    const entitlement = resolveAccountEntitlement({ plan: account.plan, trialEndsAt: account.trial_ends_at, role: account.role, isLifetime: account.is_lifetime });
    if (entitlement.isLifetime) return isHebrew ? 'ללא תפוגה' : 'No expiry';
    if (entitlement.trialStatus === 'expired') return (isHebrew ? 'ניסיון פג: ' : 'Trial expired: ') + dateLabel(account.trial_ends_at, isHebrew);
    if (['active','expiringSoon'].includes(entitlement.trialStatus)) return (isHebrew ? 'סיום ניסיון: ' : 'Trial ends: ') + dateLabel(account.trial_ends_at, isHebrew);
    return isHebrew ? 'אין ניסיון פעיל' : 'No active trial';
  };
  // Every figure below is counted from the same loaded account rows and the
  // one canonical entitlement resolver - nothing estimated or invented.
  const stats = [
    [isHebrew ? 'סה"כ משתמשים' : 'Total users', users.length],
    [isHebrew ? 'בניסיון' : 'On trial', rows.filter(({ entitlement }) => ['active', 'expiringSoon'].includes(entitlement.trialStatus) && !entitlement.isLifetime).length],
    [isHebrew ? 'חבילות בתשלום (Basic/Pro)' : 'Paid plans (Basic/Pro)', rows.filter(({ entitlement }) => ['BASIC', 'PRO'].includes(entitlement.displayIdentity)).length],
    [isHebrew ? 'Lifetime' : 'Lifetime', rows.filter(({ entitlement }) => entitlement.isLifetime).length],
    [isHebrew ? 'טעון תשומת לב' : 'Needs attention', needsAttention.length],
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
        <div className="admin-plans-summary">
          {stats.map(([label, value]) => (
            <div className="admin-stat" key={label}>
              <div className="admin-stat-label"><span>{label}</span></div>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
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
                <span className="admin-card-badges"><AdminPackageIcon entitlement={resolveAccountEntitlement({ plan: a.plan, trialEndsAt: a.trial_ends_at, role: a.role, isLifetime: a.is_lifetime })} isHebrew={isHebrew} /><AdminMarketIcon account={a} isHebrew={isHebrew} /></span>
                <span className="admin-overview-row-date">{dateLabel(a.created_at, isHebrew)}</span>
                <span className="admin-overview-row-meta">{trialSummary(a)}</span>
              </button>
            </li>
          ))}
        </article>

        <article className="admin-overview-card">
          <h3><AlertTriangle size={16} />{isHebrew ? 'ניסיון מסתיים בקרוב' : 'Trials ending soon'}</h3>
          {list(trialsEndingSoon, isHebrew ? 'אין ניסיונות שמסתיימים בקרוב.' : 'No trials ending soon.', a => (
            <li key={a.account.id}>
              {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
              <button className="admin-overview-row" onClick={() => onOpenUser(a.account)}>
                <span className="admin-overview-row-name" dir="auto">{a.account.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</span>
                <span className="admin-overview-row-meta" dir="ltr">{a.account.email}</span>
                <span className="admin-overview-row-date">{dateLabel(a.account.trial_ends_at, isHebrew)}</span>
              </button>
            </li>
          ))}
        </article>

        <article className="admin-overview-card">
          <h3><ListChecks size={16} />{isHebrew ? 'טעון תשומת לב' : 'Needs attention'}</h3>
          <p className="admin-overview-hint">{isHebrew ? 'ניסיון פג · חבילת FREE' : 'Expired trial · FREE entitlement'}</p>
          {list(needsAttention, isHebrew ? 'אין פריטים הדורשים תשומת לב כרגע.' : 'Nothing needs attention right now.', a => (
            <li key={a.account.id}>
              {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
              <button className="admin-overview-row" onClick={() => onOpenUser(a.account)}>
                <span className="admin-overview-row-name" dir="auto">{a.account.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</span>
                <span className="admin-overview-row-meta" dir="ltr">{a.account.email}</span>
                <span className="admin-overview-row-date">{dateLabel(a.account.trial_ends_at, isHebrew)}</span>
              </button>
            </li>
          ))}
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
          {isHebrew ? 'עבור לחבילות ומנויים' : 'Go to Plans / Subscriptions'}{isHebrew ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
        </button>
      </div>
    </AdminScreenFrame>
  );
}
