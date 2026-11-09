import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import AdminTestEmailTool from './AdminTestEmailTool';
import './adminUsers.css';
import './adminV2.css';
import { formatShortDateTime } from '../utils/shortDate';
import { accountDateTime, ADMIN_DATE_MARKET } from '../utils/adminDates';
import { ADMIN_COPY as C, ACTION_NAMES, OUTCOME_NAMES, t } from '../domain/admin/adminCopy';

// TEKANGO Admin V1 (Task 2/3): System Activity. "If no trustworthy activity source exists, do not synthesize history" - account
// registration (business_settings.created_at) is the one reconstructable event predating the audit log; admin_audit_log (read through
// the get_admin_audit_log() SECURITY DEFINER function, which re-verifies super_admin) is the record of privileged admin actions.
// Older changes made before that table existed are not retained - a real, disclosed gap, not hidden.
// Admin redesign part A (Owner 2026-10-16, spec §4.5 + the approved activity sketch): two feeds (admin actions / registrations), filters
// by action, outcome and user, the action words (never a raw code), the target account and the reason as written, "show more".
const PAGE = 20;

export default function AdminSystemActivity({ accounts, isHebrew, onRefreshAccounts = null }) {
  const [feed, setFeed] = useState('actions');
  const [action, setAction] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [query, setQuery] = useState('');
  // the sketch: a period filter (default the last 7 days) over both feeds
  const [period, setPeriod] = useState('7d');
  const [shown, setShown] = useState(PAGE);
  const [refreshKey, setRefreshKey] = useState(0);
  // AR-02: the accounts behind the registrations feed failed to reload
  const [accountsStale, setAccountsStale] = useState(false);
  const [auditRows, setAuditRows] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);

  const users = accounts.filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');
  const byUid = useMemo(() => new Map(accounts.filter(Boolean).map((a) => [a.user_id, a])), [accounts]);
  const adminMarket = isHebrew ? 'Local' : 'International';
  const fmt = (v) => formatShortDateTime(v, ADMIN_DATE_MARKET);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_admin_audit_log', { p_limit: 200 }).then(({ data, error }) => {
      if (cancelled) return;
      setAuditRows(error ? 'unavailable' : (data || []));
      if (!error) setUpdatedAt(new Date().toISOString());
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const term = query.trim().toLowerCase();
  const periodMs = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5 }[period] || null;
  const inPeriod = (v) => { if (!periodMs) return true; const t0 = v ? new Date(v).getTime() : NaN; return Number.isFinite(t0) && Date.now() - t0 <= periodMs; };
  const matchesUser = (a) => !term || `${a?.business_name || ''} ${a?.email || ''}`.toLowerCase().includes(term);
  const actions = Array.isArray(auditRows)
    ? auditRows.filter((r) => (action === 'all' || r.action === action) && (outcome === 'all' || r.outcome === outcome) && matchesUser(byUid.get(r.target_user_id)) && inPeriod(r.created_at))
    : [];
  const registrations = [...users].filter((a) => a.created_at && matchesUser(a) && inPeriod(a.created_at)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const list = feed === 'actions' ? actions : registrations;

  return (
    <AdminScreenFrame
      title={isHebrew ? 'פעילות מערכת' : 'System activity'}
      subtitle={t(isHebrew, C.tagline.he, C.tagline.en)}
      label={isHebrew ? 'פעילות מערכת' : 'System activity'}
      isHebrew={isHebrew}
      onRefresh={async () => { setRefreshKey((k) => k + 1); if (typeof onRefreshAccounts === 'function') { const ok = await onRefreshAccounts(); setAccountsStale(ok === false); } }}
      updatedAt={updatedAt}
      formatTime={fmt}
    >
      {accountsStale && <div className="av-notice av-bad" role="alert" style={{ marginBlockEnd: 12 }}>{isHebrew ? 'רשימת החשבונות לא עודכנה ברענון האחרון (ההרשמות מוצגות מהטעינה הקודמת). נסו לרענן שוב.' : 'The accounts did not update in the last refresh (registrations are from the previous load). Try refreshing again.'}</div>}
      <article className="av-card">
        <div className="av-toolbar">
          {/* the sketch: every filter always visible; action / outcome apply to the admin actions feed */}
          <>
              <label className="av-field">
                <span>{t(isHebrew, C.actionType.he, C.actionType.en)}</span>
                <select value={action} disabled={feed !== 'actions'} onChange={(e) => { setAction(e.target.value); setShown(PAGE); }}>
                  <option value="all">{t(isHebrew, C.allActions.he, C.allActions.en)}</option>
                  {Object.entries(ACTION_NAMES).map(([k, v]) => <option key={k} value={k}>{t(isHebrew, v.he, v.en)}</option>)}
                </select>
              </label>
              <label className="av-field">
                <span>{t(isHebrew, C.outcome.he, C.outcome.en)}</span>
                <select value={outcome} disabled={feed !== 'actions'} onChange={(e) => { setOutcome(e.target.value); setShown(PAGE); }}>
                  <option value="all">{t(isHebrew, C.allOutcomes.he, C.allOutcomes.en)}</option>
                  {Object.entries(OUTCOME_NAMES).map(([k, v]) => <option key={k} value={k}>{t(isHebrew, v.he, v.en)}</option>)}
                </select>
              </label>
              <label className="av-field">
                <span>{isHebrew ? 'תקופה' : 'Period'}</span>
                <select value={period} onChange={(e) => { setPeriod(e.target.value); setShown(PAGE); }}>
                  <option value="24h">{isHebrew ? '24 שעות אחרונות' : 'Last 24 hours'}</option>
                  <option value="7d">{isHebrew ? '7 ימים אחרונים' : 'Last 7 days'}</option>
                  <option value="30d">{isHebrew ? '30 ימים אחרונים' : 'Last 30 days'}</option>
                  <option value="all">{isHebrew ? 'כל התקופה' : 'All time'}</option>
                </select>
              </label>
          </>
          <label className="av-field av-search">
            <span>{t(isHebrew, C.findUser.he, C.findUser.en)}</span>
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder={isHebrew ? 'שם עסק או מייל' : 'Business name or email'} />
          </label>
        </div>
        <div className="av-pills" role="group" aria-label={isHebrew ? 'סוג אירועים' : 'Event type'}>
          {/* PRODUCT_TRUTH_DECORATIVE: shows the admin actions feed */}
          <button type="button" className="av-pill" aria-pressed={feed === 'actions'} onClick={() => { setFeed('actions'); setShown(PAGE); }}>{t(isHebrew, C.adminActions.he, C.adminActions.en)}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: shows the registrations feed */}
          <button type="button" className="av-pill" aria-pressed={feed === 'registrations'} onClick={() => { setFeed('registrations'); setShown(PAGE); }}>{t(isHebrew, C.registrations.he, C.registrations.en)}</button>
        </div>

        <div className="av-section">
          {feed === 'actions' && auditRows === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
            : feed === 'actions' && auditRows === 'unavailable' ? <div className="av-notice av-bad" role="alert">{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</div>
              : list.length === 0 ? <p className="av-muted" role="status">{t(isHebrew, C.noEvents.he, C.noEvents.en)}</p>
                : list.slice(0, shown).map((row) => {
                  if (feed === 'registrations') {
                    return (
                      <div key={row.id} className="av-event">
                        <span className="av-eventdot" aria-hidden="true"><UserPlus size={17} /></span>
                        <div><strong>{isHebrew ? 'חשבון חדש' : 'New account'}</strong><p><bdi>{row.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</bdi> · <bdi className="av-num">{row.email}</bdi></p><span className="av-badge">{isHebrew ? 'אירוע הרשמה' : 'Registration event'}</span></div>
                        <time className="av-num">{accountDateTime(row.created_at, row, adminMarket)}</time>
                      </div>
                    );
                  }
                  const a = ACTION_NAMES[row.action];
                  const o = OUTCOME_NAMES[row.outcome];
                  const target = byUid.get(row.target_user_id);
                  const actor = byUid.get(row.actor_user_id);
                  return (
                    <div key={row.id} className="av-event" data-action={row.action}>
                      <span className="av-eventdot" aria-hidden="true"><ShieldCheck size={17} /></span>
                      <div>
                        <strong>{a ? t(isHebrew, a.he, a.en) : t(isHebrew, C.unknownAction.he, C.unknownAction.en)}</strong>
                        <p>{target ? <bdi>{target.business_name || target.email}</bdi> : <span className="av-muted">{isHebrew ? 'חשבון שאינו זמין' : 'Account no longer available'}</span>}</p>
                        {/* the sketch: the outcome badge, then the reason as written and the admin who acted */}
                        <span className="av-pills" style={{ alignItems: 'center' }}>
                          {o && <span className={`av-badge av-${o.tone}`}>{t(isHebrew, o.he, o.en)}</span>}
                          {(row.reason || actor) && <span className="av-small av-muted">{row.reason && <bdi dir="auto">{row.reason}</bdi>}{row.reason && actor && ' · '}{actor && <bdi>{actor.business_name || actor.email}</bdi>}</span>}
                        </span>
                      </div>
                      <time className="av-num">{target ? accountDateTime(row.created_at, target, adminMarket) : fmt(row.created_at)}</time>
                    </div>
                  );
                })}
        </div>
        <div className="av-notice av-info av-section">{t(isHebrew, C.historyGap.he, C.historyGap.en)}</div>
        <div className="av-pager">
          <span className="av-small"><bdi className="av-num">{Math.min(shown, list.length)}</bdi> {t(isHebrew, C.of.he, C.of.en)} <bdi className="av-num">{list.length}</bdi> {isHebrew ? 'אירועים' : 'events'}</span>
          {/* PRODUCT_TRUTH_DECORATIVE: loads more events */}
          <button type="button" className="av-btn" disabled={list.length <= shown} onClick={() => setShown((n) => n + PAGE)}>{isHebrew ? 'טעינה נוספת' : 'Load more'}</button>
        </div>
      </article>
      {/* Diagnostic tools (spec §4.5 / D-08): the legacy test-email tool moved here from the users screen, behaviour unchanged */}
      <AdminTestEmailTool isHebrew={isHebrew} />
    </AdminScreenFrame>
  );
}
