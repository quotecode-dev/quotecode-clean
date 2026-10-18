import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Lock, ShieldCheck, Infinity as InfinityIcon, RotateCcw, Trash2 } from 'lucide-react';
import { supabase } from '../shared/supabase';
import { AdminMarketIcon } from './AdminIdentityIcons';
import { AdminAccountStatus, AdminPlanState } from './AdminSubscriptionState';
import { adminTargetUserId, useAdminAccountSummary, accountStatus } from '../domain/subscriptions/adminAccountSummary';
import { ADMIN_COPY as C, ACTION_NAMES, OUTCOME_NAMES, t } from '../domain/admin/adminCopy';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';
import './adminV2.css';
import { accountDate, accountDateTime } from '../utils/adminDates';
import { formatShortDateTime } from '../utils/shortDate';

// TEKANGO Admin V1 (Task 2): a shell-preserving User Details VIEW (renders inside the same Admin content outlet as every other Admin
// section - not a disconnected dark modal). Truthful data only; a failed count shows "unavailable", never a fake 0 (§2.3).
// Admin redesign part A (Owner 2026-10-16, spec §4.3 + the approved details sketch): the account head (the user's own medallion + the
// status words), "Plan & usage" (D-01: the quota counter ONLY from the server - "—" while it is not active; the issued quotes are a
// separate operational count, never a quota), the account information, this account's admin history and the protected actions.
// Counts read the account's AUTH user id (adminTargetUserId) - the former business_settings.id read always failed. Dates by the
// ACCOUNT's market (IRON-DATE-001).
function parseAddress(raw) {
  if (!raw) return null;
  const [street, city, region, zip] = raw.split('|').map(p => (p || '').trim());
  const parts = [street, city, region, zip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export default function AdminUserDetails({ account, isHebrew, onBack, onReset = null, onDelete = null, onLifetime = null, refreshKey = 0 }) {
  const uid = adminTargetUserId(account);
  const [counts, setCounts] = useState({ quotes: 'loading', clients: 'loading', issued: 'loading' });
  const [history, setHistory] = useState('loading');
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCounts({ quotes: 'loading', clients: 'loading', issued: 'loading' });
    async function loadCounts() {
      try {
        const [quotesRes, clientsRes, issuedRes] = await Promise.all([
          supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('user_id', uid),
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', uid),
          supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('user_id', uid).neq('status', 'draft'),
        ]);
        if (cancelled) return;
        const n = (r) => (r.error || !Number.isFinite(r.count) ? 'unavailable' : r.count);
        setCounts({ quotes: n(quotesRes), clients: n(clientsRes), issued: n(issuedRes) });
      } catch {
        if (!cancelled) setCounts({ quotes: 'unavailable', clients: 'unavailable', issued: 'unavailable' });
      }
    }
    loadCounts();
    supabase.rpc('get_admin_audit_log', { p_limit: 200 }).then(({ data, error }) => {
      if (!cancelled) setHistory(error ? 'unavailable' : (data || []).filter((r) => r.target_user_id === uid).slice(0, 10));
    });
    return () => { cancelled = true; };
  }, [uid, refreshKey, localRefresh]);

  const { summary } = useAdminAccountSummary(uid);
  const status = accountStatus(account, summary.state === 'ready' ? summary : null);
  const adminMarket = isHebrew ? 'Local' : 'International';
  const date = (v) => accountDate(v, account, adminMarket);
  const dateTime = (v) => accountDateTime(v, account, adminMarket);
  const address = parseAddress(account.address);
  const countValue = (v) => (v === 'loading' ? '—' : v === 'unavailable' ? t(isHebrew, C.unavailable.he, C.unavailable.en) : <bdi className="av-num">{v}</bdi>);
  const free10 = status.key === 'free10' ? status : null;
  const name = account.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business');
  const lifetime = account.is_lifetime === true;
  const line = (label, value) => <div className="av-statline"><span>{t(isHebrew, label.he, label.en)}</span><span>{value ?? t(isHebrew, C.notGiven.he, C.notGiven.en)}</span></div>;

  return (
    <AdminScreenFrame
      title={isHebrew ? 'פרטי משתמש' : 'User details'}
      subtitle={name}
      label={isHebrew ? 'פרטי משתמש' : 'User details'}
      isHebrew={isHebrew}
      onRefresh={() => setLocalRefresh((k) => k + 1)}
      formatTime={(v) => formatShortDateTime(v, adminMarket)}
      actions={(
        // PRODUCT_TRUTH_CAPABILITY: admin_console
        <button type="button" className="av-btn admin-details-back" onClick={onBack}>
          {isHebrew ? <ArrowRight size={15} aria-hidden="true" /> : <ArrowLeft size={15} aria-hidden="true" />}
          {t(isHebrew, C.backToUsers.he, C.backToUsers.en)}
        </button>
      )}
    >
      <article className="av-card">
        <div className="av-cardhead">
          <div className="av-business">
            <strong style={{ fontSize: 22 }}><bdi>{name}</bdi></strong>
            {account.role === 'admin' && <span className="av-badge av-admin" style={{ marginInlineStart: 8 }}>{t(isHebrew, C.adminBadge.he, C.adminBadge.en)}</span>}
            <span className="av-mail">{account.email}</span>
          </div>
          <AdminAccountStatus account={account} summary={summary.state === 'ready' ? summary : null} isHebrew={isHebrew} formatDate={date} size={36} />
        </div>
        <div className="av-pills">
          <span className="av-badge"><AdminMarketIcon account={account} isHebrew={isHebrew} /></span>
          {status.key === 'free10_inactive' && <span className="av-badge av-warn">{isHebrew ? 'שיוך מסלול טרם הופעל' : 'Plan assignment not active'}</span>}
          <span className="av-badge" data-testid="admin-plan-neutral"><AdminPlanState summary={summary} isHebrew={isHebrew} compact={false} /></span>
        </div>
      </article>

      <div className="av-grid av-equal av-section">
        <article className="av-card" aria-label={t(isHebrew, C.planUsage.he, C.planUsage.en)}>
          <h3>{t(isHebrew, C.planUsage.he, C.planUsage.en)}</h3>
          {status.key === 'free10_inactive' && <div className="av-notice av-info">{t(isHebrew, C.notActiveNotice.he, C.notActiveNotice.en)}</div>}
          <div className="av-statline">
            <span>{t(isHebrew, C.quotaUsage.he, C.quotaUsage.en)}</span>
            {free10
              ? <strong><bdi className="av-num">{free10.consumed}/{free10.total}</bdi> {isHebrew ? `נוצלו · נותרו ${free10.remaining}` : `used · ${free10.remaining} remaining`}{free10.reserved > 0 ? (isHebrew ? ` · ${free10.reserved} בתהליך` : ` · ${free10.reserved} in progress`) : ''}</strong>
              : <strong>—</strong>}
          </div>
          <div className="av-statline"><span>{t(isHebrew, C.issuedQuotes.he, C.issuedQuotes.en)}</span><strong>{countValue(counts.issued)}</strong></div>
          <p className="av-tiny av-muted">{t(isHebrew, C.issuedNote.he, C.issuedNote.en)}</p>
        </article>
        <article className="av-card" aria-label={t(isHebrew, C.accountInfo.he, C.accountInfo.en)}>
          <h3>{t(isHebrew, C.accountInfo.he, C.accountInfo.en)}</h3>
          {line(C.registered, <bdi className="av-num">{dateTime(account.created_at)}</bdi>)}
          {line(C.lastAppEntry, <bdi className="av-num">{dateTime(account.last_sign_in)}</bdi>)}
          {line(C.phone, account.phone ? <bdi className="av-num">{account.phone}</bdi> : null)}
          {line(C.taxId, account.tax_id ? <bdi className="av-num">{account.tax_id}</bdi> : null)}
          {line(C.address, address ? <bdi>{address}</bdi> : null)}
          {line(C.currency, account.currency ? <bdi className="av-num">{account.currency}</bdi> : null)}
          {line(C.clients, countValue(counts.clients))}
          {line(C.savedQuotes, countValue(counts.quotes))}
        </article>
      </div>

      <div className="av-grid av-equal av-section">
        <article className="av-card">
          <h3>{t(isHebrew, C.actionHistory.he, C.actionHistory.en)}</h3>
          {history === 'loading' ? <p className="av-muted">{t(isHebrew, C.loading.he, C.loading.en)}</p>
            : history === 'unavailable' ? <p className="av-muted">{t(isHebrew, C.unavailable.he, C.unavailable.en)}</p>
              : history.length === 0 ? <p className="av-muted">{t(isHebrew, C.noHistory.he, C.noHistory.en)}</p>
                : history.map((row) => {
                  const a = ACTION_NAMES[row.action];
                  const o = OUTCOME_NAMES[row.outcome];
                  return (
                    <div key={row.id} className="av-event">
                      <span className="av-eventdot" aria-hidden="true"><ShieldCheck size={17} /></span>
                      <div>
                        <strong>{a ? t(isHebrew, a.he, a.en) : t(isHebrew, C.unknownAction.he, C.unknownAction.en)}</strong>
                        {row.reason && <p><bdi>{row.reason}</bdi></p>}
                        {o && <span className={`av-badge av-${o.tone}`}>{t(isHebrew, o.he, o.en)}</span>}
                      </div>
                      <time className="av-num">{formatShortDateTime(row.created_at, adminMarket)}</time>
                    </div>
                  );
                })}
          <div className="av-event">
            <span className="av-eventdot" aria-hidden="true"><ShieldCheck size={17} /></span>
            <div><strong>{t(isHebrew, C.accountRegistered.he, C.accountRegistered.en)}</strong></div>
            <time className="av-num">{dateTime(account.created_at)}</time>
          </div>
          <p className="av-footnote">{t(isHebrew, C.historyGap.he, C.historyGap.en)}</p>
        </article>
        {(onLifetime || onReset || onDelete) && (
          <article className="av-card av-protection">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Lock size={17} aria-hidden="true" />{t(isHebrew, C.protectedActions.he, C.protectedActions.en)}</h3>
            <p className="av-muted av-small">{t(isHebrew, C.protectedIntro.he, C.protectedIntro.en)}</p>
            <div className="av-grid" style={{ gap: 8 }}>
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected Lifetime dialog (reason + admin password, server-verified) */}
              {onLifetime && <button type="button" className="av-btn" onClick={() => onLifetime(account)}><InfinityIcon size={16} aria-hidden="true" />{t(isHebrew, ...(lifetime ? [C.revokeLifetime.he, C.revokeLifetime.en] : [C.grantLifetime.he, C.grantLifetime.en]))}</button>}
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected quote-reset dialog (reason + admin password + typed email, server-verified) */}
              {onReset && <button type="button" className="av-btn" onClick={() => onReset(account)}><RotateCcw size={16} aria-hidden="true" />{t(isHebrew, C.resetQuotes.he, C.resetQuotes.en)}</button>}
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected delete-account dialog (reason + admin password + typed email, server-verified) */}
              {onDelete && <button type="button" className="av-btn av-danger" onClick={() => onDelete(account)}><Trash2 size={16} aria-hidden="true" />{t(isHebrew, C.deleteAccount.he, C.deleteAccount.en)}</button>}
            </div>
          </article>
        )}
      </div>
    </AdminScreenFrame>
  );
}
