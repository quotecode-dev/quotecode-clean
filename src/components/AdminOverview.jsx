import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import AdminDonut from './AdminDonut';
import './adminUsers.css';
import { getAdminKpiSummary } from '../utils/adminAnalytics';
import { AdminPlanSystemNotice, AdminAccountStatusIcon } from './AdminSubscriptionState';
import { adminTargetUserId, useAdminAccountSummaries, accountStatusBreakdown, breakdownFromCounts, ACCOUNT_STATUS, STATUS_COLOR, tr } from '../domain/subscriptions/adminAccountSummary';
import { useAdminDashboardSummary } from '../domain/admin/adminAccountsClient';
import { setUsersFilterIntent } from '../domain/admin/adminNavIntent';
import { ADMIN_COPY as C, ACTION_NAMES, OUTCOME_NAMES, t } from '../domain/admin/adminCopy';
import { formatShortDateTime } from '../utils/shortDate';
import { resolveAdminMarket } from '../utils/adminMarket';
import { accountDate } from '../utils/adminDates';

// TEKANGO Admin V1 (Task 2): Admin Overview - recently registered, admin
// activity and the subscription-status breakdown, from real data only. No fabricated metric, no "active now" / online inference, no
// revenue. Admin redesign part A (Owner 2026-10-16, spec §4.1): five counters, the subscription mix and the market mix as ring charts
// (legend rows open the users list filtered), recent registrations and recent admin actions. The counters come from the server
// summary (get_admin_dashboard_summary); while it is not deployed on this server the same figures are counted from the loaded rows.
const MARKET_COLORS = { Local: '#087f8c', International: '#6553a0', Unknown: '#718096' };

export default function AdminOverview({ accounts, isHebrew, onGoToUsers, onOpenUser, onGoToActivity = null }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const server = useAdminDashboardSummary(refreshKey);
  const serverReady = (server.state === 'ready' || server.state === 'stale') && server.data;
  const users = accounts.filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');
  const recentlyRegistered = [...users]
    .filter(a => a.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  const kpi = getAdminKpiSummary(users);
  // fallback (the server summary is not deployed here): one probe, then per-account summaries only when the plan system is active
  const { system, byId } = useAdminAccountSummaries(serverReady ? [] : users.map(adminTargetUserId));
  // Every fallback figure below is counted from the same loaded account rows - nothing estimated or invented.
  // Night task 2026-10-16 (Owner doc 31eae0a7, phase C, default 5): "Signed in in the last 10 minutes" counts the accounts whose app
  // loaded in the last 10 minutes (business_settings.last_sign_in, written on every app load) - it is not a live "online now" presence.
  // Market from the account's own stored country (resolveAdminMarket), never the language.
  const nowMs = Date.now();
  const recentMs = (v) => { const t0 = v ? new Date(v).getTime() : NaN; return Number.isFinite(t0) && nowMs - t0 >= 0 && nowMs - t0 <= 10 * 60 * 1000; };
  const fallbackStats = {
    managed: kpi.managedBusinesses,
    reg24h: kpi.registrationsLast24h,
    signed10m: users.filter((a) => recentMs(a.last_sign_in)).length,
    Local: users.filter((a) => resolveAdminMarket(a).market === 'Local').length,
    International: users.filter((a) => resolveAdminMarket(a).market === 'International').length,
    Unknown: users.filter((a) => resolveAdminMarket(a).market === 'Unknown').length,
  };
  const s = serverReady ? server.data : null;
  const stats = s
    ? { managed: s.managedAccounts, reg24h: s.registrationsLast24h, signed10m: s.signedInLast10m, ...s.market }
    : fallbackStats;
  const planSystem = s ? s.planSystem : system;
  const statusRows = s
    ? breakdownFromCounts(s.subscriptionStatus)
    : accountStatusBreakdown(users, (a) => (system === 'not_active' ? null : (byId[adminTargetUserId(a)] || null)));
  const loadState = s ? server.state : (server.state === 'loading' ? 'loading' : 'ready');
  const pct = (n) => (stats.managed > 0 ? `${((n / stats.managed) * 100).toFixed(1)}%` : '—');

  const [recentAudit, setRecentAudit] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_admin_audit_log', { p_limit: 5 }).then(({ data, error }) => {
      if (!cancelled) setRecentAudit(error ? 'unavailable' : (data || []));
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const adminMarket = isHebrew ? 'Local' : 'International';
  const fmtTime = (v) => formatShortDateTime(v, adminMarket);
  const openUsers = (filter) => { setUsersFilterIntent(filter); onGoToUsers(); };
  const kpis = [
    { key: 'managed', label: C.kpiManaged, value: stats.managed, note: C.kpiManagedNote, filter: {} },
    { key: 'reg24h', label: C.kpi24h, value: stats.reg24h, note: C.kpi24hNote, filter: { registered: '24h' } },
    { key: 'signed10m', label: C.kpi10m, value: stats.signed10m, note: C.kpi10mNote, filter: { signedIn: '10m' } },
    { key: 'Local', label: C.israel, value: stats.Local, pct: pct(stats.Local), filter: { market: 'Local' } },
    { key: 'International', label: C.international, value: stats.International, pct: pct(stats.International), filter: { market: 'International' } },
  ];
  const statusSegments = statusRows.map(({ key, count }) => ({ key, count, color: STATUS_COLOR[key], label: tr(ACCOUNT_STATUS[key], isHebrew) }));
  const marketSegments = ['Local', 'International', 'Unknown'].map((k) => ({
    key: k, count: stats[k] || 0, color: MARKET_COLORS[k], label: t(isHebrew, ...(k === 'Local' ? [C.israel.he, C.israel.en] : k === 'International' ? [C.international.he, C.international.en] : [C.unknown.he, C.unknown.en])),
  }));
  const valueOf = (v) => (loadState === 'loading' ? '—' : v);

  return (
    <AdminScreenFrame
      title={isHebrew ? 'סקירה כללית' : 'Admin Overview'}
      subtitle={t(isHebrew, C.tagline.he, C.tagline.en)}
      label={isHebrew ? 'סקירה כללית' : 'Admin overview'}
      isHebrew={isHebrew}
      onRefresh={() => setRefreshKey((k) => k + 1)}
      refreshing={!!server.refreshing}
      updatedAt={server.updatedAt}
      staleSince={server.state === 'stale' ? server.failedAt : null}
      formatTime={fmtTime}
      controls={<AdminPlanSystemNotice system={planSystem} isHebrew={isHebrew} />}
    >
      <div className="av-grid av-kpis" data-testid="admin-kpis">
        {kpis.map((k) => (
          <article key={k.key} className="av-card av-accent-top" data-kpi={k.key}>
            <div className="av-label">{t(isHebrew, k.label.he, k.label.en)}</div>
            <div className="av-kpi-value" data-testid={`admin-kpi-${k.key}`}>{valueOf(k.value)}</div>
            <div className="av-tiny av-muted">{k.note ? t(isHebrew, k.note.he, k.note.en) : <bdi className="av-num">{k.pct}</bdi>}</div>
          </article>
        ))}
      </div>

      <div className="av-grid av-two">
        <article className="av-card" aria-label={t(isHebrew, C.subscriptionMix.he, C.subscriptionMix.en)}>
          <h3>{t(isHebrew, C.subscriptionMix.he, C.subscriptionMix.en)}</h3>
          <p className="av-muted av-small">{t(isHebrew, C.subscriptionMixSub.he, C.subscriptionMixSub.en)}</p>
          <AdminDonut
            title={t(isHebrew, C.subscriptionMix.he, C.subscriptionMix.en)}
            description={statusSegments.map((x) => `${x.label} ${x.count}`).join(', ')}
            segments={statusSegments} isHebrew={isHebrew} state={loadState}
            onSelect={(key) => openUsers({ status: key })}
            renderMark={(seg) => <AdminAccountStatusIcon statusKey={seg.key} size={18} />}
          />
        </article>
        <article className="av-card" aria-label={t(isHebrew, C.marketMix.he, C.marketMix.en)}>
          <h3>{t(isHebrew, C.marketMix.he, C.marketMix.en)}</h3>
          <p className="av-muted av-small">{t(isHebrew, C.marketMixSub.he, C.marketMixSub.en)}</p>
          <AdminDonut
            title={t(isHebrew, C.marketMix.he, C.marketMix.en)}
            description={marketSegments.map((x) => `${x.label} ${x.count}`).join(', ')}
            segments={marketSegments} isHebrew={isHebrew} state={loadState}
            onSelect={(key) => openUsers({ market: key })}
          />
        </article>
      </div>

      <div className="av-grid av-equal av-section">
        <article className="av-card">
          <div className="av-cardhead">
            <h3>{t(isHebrew, C.recentRegistrations.he, C.recentRegistrations.en)}</h3>
            {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
            <button type="button" className="av-btn av-sm" onClick={() => openUsers({})}>{t(isHebrew, C.allUsers.he, C.allUsers.en)}</button>
          </div>
          {recentlyRegistered.length === 0
            ? <p className="av-muted">{t(isHebrew, C.noAccounts.he, C.noAccounts.en)}</p>
            : recentlyRegistered.map((a) => (
              <div key={a.id} className="av-statline">
                {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                <button type="button" className="av-business" onClick={() => onOpenUser(a)} style={{ all: 'unset', cursor: 'pointer', minWidth: 0 }}>
                  <strong><bdi>{a.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</bdi></strong>
                  <span className="av-mail">{a.email}</span>
                </button>
                <bdi className="av-num av-small">{accountDate(a.created_at, a, adminMarket)}</bdi>
              </div>
            ))}
        </article>
        <article className="av-card">
          <div className="av-cardhead">
            <h3>{t(isHebrew, C.recentActions.he, C.recentActions.en)}</h3>
            {onGoToActivity && (
              // PRODUCT_TRUTH_CAPABILITY: admin_console
              <button type="button" className="av-btn av-sm" onClick={onGoToActivity}>{t(isHebrew, C.viewAllActivity.he, C.viewAllActivity.en)}</button>
            )}
          </div>
          {recentAudit === 'loading' ? (
            <p className="av-muted">{t(isHebrew, C.loading.he, C.loading.en)}</p>
          ) : recentAudit === 'unavailable' ? (
            <p className="av-muted">{t(isHebrew, C.unavailable.he, C.unavailable.en)}</p>
          ) : recentAudit.length === 0 ? (
            <p className="av-muted">{isHebrew ? 'אין פעולות מוגנות מתועדות.' : 'No privileged actions recorded yet.'}</p>
          ) : recentAudit.map((row) => {
            const a = ACTION_NAMES[row.action];
            const o = OUTCOME_NAMES[row.outcome];
            return (
              <div key={row.id} className="av-event">
                <span className="av-eventdot" aria-hidden="true"><ShieldCheck size={17} /></span>
                <div>
                  <strong>{a ? t(isHebrew, a.he, a.en) : t(isHebrew, C.unknownAction.he, C.unknownAction.en)}</strong>
                  {o && <span className={`av-badge av-${o.tone}`}>{t(isHebrew, o.he, o.en)}</span>}
                </div>
                <time className="av-num">{fmtTime(row.created_at)}</time>
              </div>
            );
          })}
        </article>
      </div>
    </AdminScreenFrame>
  );
}
