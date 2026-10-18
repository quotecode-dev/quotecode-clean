import { useState } from 'react';
import AdminScreenFrame from './AdminScreenFrame';
import AdminDonut from './AdminDonut';
import './adminUsers.css';
import './adminV2.css';
import { AdminPlanSystemNotice, AdminAccountStatusIcon } from './AdminSubscriptionState';
import { adminTargetUserId, useAdminAccountSummaries, accountStatusBreakdown, breakdownFromCounts, ACCOUNT_STATUS, STATUS_COLOR, tr } from '../domain/subscriptions/adminAccountSummary';
import { useAdminDashboardSummary } from '../domain/admin/adminAccountsClient';
import { setUsersFilterIntent } from '../domain/admin/adminNavIntent';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import { formatShortDateTime } from '../utils/shortDate';

// TEKANGO Admin V1 (Task 2) Plans/Subscriptions view, reworked for OD-16/OD-20: the plan state comes ONLY from the server (summary RPCs);
// nothing here computes a plan from the legacy fields; no revenue values invented, no plan-change UI.
// Admin redesign part A (Owner 2026-10-16, spec §4.4 + the approved plans sketch): an operational screen - the subscription mix ring
// chart (monthly and annual listed even at 0), the data quality card (D-06: a missing billing period is never assumed monthly), and a
// card per status that opens the users list filtered to it (no second accounts list). Counts from get_admin_dashboard_summary; while
// it is not deployed here, counted from the loaded rows.
export default function AdminPlans({ accounts, isHebrew, onGoToUsers = null }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const server = useAdminDashboardSummary(refreshKey);
  const s = (server.state === 'ready' || server.state === 'stale') ? server.data : null;
  const users = accounts.filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');
  const { system, byId } = useAdminAccountSummaries(s ? [] : users.map(adminTargetUserId));
  const rows = s ? breakdownFromCounts(s.subscriptionStatus) : accountStatusBreakdown(users, (a) => (system === 'not_active' ? null : (byId[adminTargetUserId(a)] || null)));
  const count = (k) => rows.find((r) => r.key === k)?.count ?? 0;
  const managed = s ? s.managedAccounts : users.length;
  const planSystem = s ? s.planSystem : system;
  const loadState = s ? server.state : (server.state === 'loading' ? 'loading' : 'ready');
  const segments = rows.map(({ key, count: n }) => ({ key, count: n, color: STATUS_COLOR[key], label: tr(ACCOUNT_STATUS[key], isHebrew) }));
  const openUsers = (filter) => { setUsersFilterIntent(filter); if (onGoToUsers) onGoToUsers(); };
  const adminMarket = isHebrew ? 'Local' : 'International';

  return (
    <AdminScreenFrame
      title={isHebrew ? 'מסלולים ומנויים' : 'Plans / Subscriptions'}
      subtitle={isHebrew ? 'מצב המסלולים מהשרת בלבד · ללא נתוני הכנסות' : 'Plan state from the server only · no revenue data'}
      label={isHebrew ? 'מסלולים ומנויים' : 'Plans and subscriptions'}
      isHebrew={isHebrew}
      onRefresh={() => setRefreshKey((k) => k + 1)}
      refreshing={!!server.refreshing}
      updatedAt={server.updatedAt}
      staleSince={server.state === 'stale' ? server.failedAt : null}
      formatTime={(v) => formatShortDateTime(v, adminMarket)}
      controls={(
        <>
          <AdminPlanSystemNotice system={planSystem} isHebrew={isHebrew} />
          <div className="av-notice av-info">{t(isHebrew, C.plansNotice.he, C.plansNotice.en)}</div>
        </>
      )}
    >
      <div className="av-grid av-equal">
        <article className="av-card admin-legacy-breakdown" aria-label={t(isHebrew, C.subscriptionMix.he, C.subscriptionMix.en)}>
          <h3>{t(isHebrew, C.subscriptionMix.he, C.subscriptionMix.en)}</h3>
          <AdminDonut
            title={t(isHebrew, C.subscriptionMix.he, C.subscriptionMix.en)}
            description={segments.map((x) => `${x.label} ${x.count}`).join(', ')}
            segments={segments} isHebrew={isHebrew} state={loadState}
            onSelect={(key) => openUsers({ status: key })}
            renderMark={(seg) => <AdminAccountStatusIcon statusKey={seg.key} size={18} />}
          />
        </article>
        <article className="av-card" aria-label={t(isHebrew, C.dataQuality.he, C.dataQuality.en)}>
          <h3>{t(isHebrew, C.dataQuality.he, C.dataQuality.en)}</h3>
          <div className="av-statline"><span>{t(isHebrew, C.managedAccounts.he, C.managedAccounts.en)}</span><strong className="av-num">{loadState === 'loading' ? '—' : managed}</strong></div>
          <div className="av-statline"><span>{t(isHebrew, C.verifiedMonthly.he, C.verifiedMonthly.en)}</span><strong className="av-num">{loadState === 'loading' ? '—' : count('paid_monthly')}</strong></div>
          <div className="av-statline"><span>{t(isHebrew, C.verifiedAnnual.he, C.verifiedAnnual.en)}</span><strong className="av-num">{loadState === 'loading' ? '—' : count('paid_annual')}</strong></div>
          <div className="av-statline"><span>{t(isHebrew, C.free10Counter.he, C.free10Counter.en)}</span><span className={`av-badge ${planSystem === 'active' ? 'av-ok' : 'av-warn'}`}>{planSystem === 'active' ? t(isHebrew, C.active.he, C.active.en) : t(isHebrew, C.notActivated.he, C.notActivated.en)}</span></div>
          <div className="av-notice av-section">{t(isHebrew, C.periodNotice.he, C.periodNotice.en)}</div>
        </article>
      </div>

      <article className="av-card av-section">
        <div className="av-cardhead">
          <h3>{t(isHebrew, C.workByPlan.he, C.workByPlan.en)}</h3>
          {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
          <button type="button" className="av-btn av-sm" onClick={() => openUsers({})}>{t(isHebrew, C.openUsers.he, C.openUsers.en)}</button>
        </div>
        <div className="av-grid av-three">
          {rows.map(({ key, count: n }) => (
            <div key={key} className="av-card" data-status={key} style={{ boxShadow: 'none' }}>
              <span className="av-plan"><AdminAccountStatusIcon statusKey={key} size={24} /><strong>{tr(ACCOUNT_STATUS[key], isHebrew)}</strong></span>
              <div className="av-kpi-value">{loadState === 'loading' ? '—' : n}</div>
              {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
              <button type="button" className="av-btn av-sm" onClick={() => openUsers({ status: key })}>{t(isHebrew, C.viewUsers.he, C.viewUsers.en)}</button>
            </div>
          ))}
        </div>
      </article>
    </AdminScreenFrame>
  );
}
