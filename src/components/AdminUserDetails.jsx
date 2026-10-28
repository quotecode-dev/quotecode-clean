import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { supabase } from '../shared/supabase';
import { resolveAdminMarket } from '../utils/adminMarket';
import { AdminAccountStatus, AdminPlanState } from './AdminSubscriptionState';
import { adminTargetUserId, useAdminAccountSummary, accountStatus, statusFromKey } from '../domain/subscriptions/adminAccountSummary';
import PlanMedallionMark from './PlanMedallionMark';
import { ADMIN_COPY as C, ACTION_NAMES, OUTCOME_NAMES, t } from '../domain/admin/adminCopy';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';
import './adminV2.css';
import { accountDate, accountDateTime } from '../utils/adminDates';
import { invokeWithFreshSession } from '../shared/invokeWithFreshSession';
import { billingPreview, billingCardVisible, previewUnavailable, billingMoney, billingRefundMoney, BILLING_COPY as B, REFUND_STATE, KIND_NAMES } from '../domain/admin/adminBilling';

// TEKANGO Admin V1 (Task 2): a shell-preserving User Details VIEW (renders inside the same Admin content outlet as every other Admin
// section - not a disconnected dark modal). Truthful data only; a failed count shows "unavailable", never a fake 0 (§2.3).
// Admin redesign part A (Owner 2026-10-16, spec §4.3 + the approved details sketch): the account head (the user's own medallion + the
// status words), "Plan & usage" (D-01: the quota counter ONLY from the server - "—" while it is not active; the issued quotes are a
// separate operational count, never a quota), the account information, this account's admin history and the protected actions.
// Counts read the account's AUTH user id (adminTargetUserId) - the former business_settings.id read always failed. Dates by the
// ACCOUNT's market (IRON-DATE-001).
export default function AdminUserDetails({ account, isHebrew, onBack, onReset = null, onDelete = null, onLifetime = null, onTestMark = null, refreshKey = 0, accounts = [], onOpenActivity = null, onBilling = null, billingNotice = null }) {
  const uid = adminTargetUserId(account);
  const [counts, setCounts] = useState({ quotes: 'loading', clients: 'loading', issued: 'loading' });
  const [history, setHistory] = useState('loading');
  // L-22 (Owner 2026-10-28): the Owner marks a test account (not counted in the statistics); the mark comes back with the reloaded accounts
  const [testBusy, setTestBusy] = useState(false);
  const [testNotice, setTestNotice] = useState(null);
  const isTest = account.is_test === true;
  const toggleTest = async () => {
    setTestBusy(true); setTestNotice(null);
    const ok = await onTestMark(account, !isTest).catch(() => false);
    setTestBusy(false);
    setTestNotice(ok ? (isTest ? C.testUnmarked : C.testMarked) : C.testFailed);
  };

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
  }, [uid, refreshKey]);

  // L-22 (Owner 2026-10-28, the subscription & payment card - docs/ADMIN_BILLING_BUTTONS_PLAN_2026-10-22.md): the server's preview of the
  // paid package (admin-billing, super admin only) - read only when the Owner's billing actions are offered (onBilling)
  const billingOn = typeof onBilling === 'function';
  const [billing, setBilling] = useState(null);
  useEffect(() => {
    if (!billingOn) return undefined;
    let cancelled = false;
    setBilling('loading');
    billingPreview(invokeWithFreshSession, uid, false).then((p) => { if (!cancelled) setBilling(p); });
    return () => { cancelled = true; };
  }, [uid, refreshKey, billingOn]);
  const bill = billing && billing !== 'loading' ? billing : null;
  const billPaid = bill?.ok === true;

  const { summary } = useAdminAccountSummary(uid);
  // Codex verification AV-01 (2026-10-17): while the summary is not ready the server list's status stands; when the summary FAILED
  // and nothing proves a status, the status is shown as unavailable - never a fallback plan
  const summaryReady = summary.state === 'ready';
  const summaryFailed = !['ready', 'loading', 'not_deployed', 'not_activated', 'unprovisioned'].includes(summary.state);
  const computedStatus = accountStatus(account, summaryReady ? summary : null);
  // the account's own (fresh) Lifetime flag always decides first, as on the server; a server row saying Lifetime is stale once revoked
  const serverStatus = account.status && !(account.status === 'lifetime' && account.is_lifetime !== true) ? account.status : null;
  const status = summaryReady || account.is_lifetime === true ? computedStatus : serverStatus ? statusFromKey(serverStatus, { until: account.trial_ends_at }) : computedStatus;
  const statusUnknown = summaryFailed && !serverStatus && status.key === 'free10_inactive';
  const adminMarket = isHebrew ? 'Local' : 'International';
  const date = (v) => accountDate(v, account, adminMarket);
  const dateTime = (v) => accountDateTime(v, account, adminMarket);
  const countValue = (v) => (v === 'loading' ? '—' : v === 'unavailable' ? t(isHebrew, C.unavailable.he, C.unavailable.en) : <bdi className="av-num">{v}</bdi>);
  // AR-01: a quota counter only from a decided summary - never numbers that were not loaded
  const free10 = status.key === 'free10' && Number.isInteger(status.consumed) && Number.isInteger(status.remaining) ? status : null;
  const name = account.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business');
  const lifetime = account.is_lifetime === true;
  const market = resolveAdminMarket(account).market;
  const marketWords = market === 'Local' ? C.regionLocal : market === 'International' ? C.regionIntl : C.regionUnknown;
  const byUid = new Map((accounts || []).filter(Boolean).map((a) => [a.user_id, a]));
  const line = (label, value) => <div className="av-statline"><span>{t(isHebrew, label.he, label.en)}</span><span>{value ?? t(isHebrew, C.notGiven.he, C.notGiven.en)}</span></div>;

  return (
    <AdminScreenFrame
      title={isHebrew ? 'פרטי משתמש' : 'User details'}
      subtitle={t(isHebrew, C.tagline.he, C.tagline.en)}
      label={isHebrew ? 'פרטי משתמש' : 'User details'}
      isHebrew={isHebrew}
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
            {isTest && <span className="av-badge av-warn" style={{ marginInlineStart: 8 }} data-testid="admin-test-badge">{t(isHebrew, C.testBadge.he, C.testBadge.en)}</span>}
            <span className="av-mail">{account.email}</span>
          </div>
          {statusUnknown
            ? <span className="admin-account-status av-plan" data-status="unknown"><PlanMedallionMark model={{ kind: 'none' }} size={32} /><strong>{isHebrew ? 'מצב המנוי אינו זמין כרגע' : 'Subscription status unavailable right now'}</strong></span>
            : <AdminAccountStatus account={account} summary={summaryReady ? summary : null} statusKey={status.key} isHebrew={isHebrew} formatDate={date} size={32} />}
        </div>
        <div className="av-pills">
          <span className="av-badge" data-market={market}>{t(isHebrew, marketWords.he, marketWords.en)}</span>
          {status.key === 'free10_inactive' && !statusUnknown && <span className="av-badge av-warn">{isHebrew ? 'שיוך מסלול טרם הופעל' : 'Plan assignment not active'}</span>}
          <span className="av-badge" data-testid="admin-plan-neutral"><AdminPlanState summary={summary} isHebrew={isHebrew} compact={false} /></span>
        </div>
        {onTestMark && (
          <div className="av-pills" style={{ alignItems: 'center', marginTop: 10 }}>
            {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
            <button type="button" className="av-btn" disabled={testBusy} onClick={toggleTest} data-testid="admin-test-toggle">
              {t(isHebrew, ...(isTest ? [C.unmarkTest.he, C.unmarkTest.en] : [C.markTest.he, C.markTest.en]))}
            </button>
            <span className="av-small av-muted">{t(isHebrew, C.testHint.he, C.testHint.en)}</span>
          </div>
        )}
        {testNotice && <p role="status" className="av-small" style={{ margin: '8px 0 0' }} data-testid="admin-test-notice">{t(isHebrew, testNotice.he, testNotice.en)}</p>}
      </article>

      {(billingNotice || billingCardVisible(bill) || previewUnavailable(bill)) && (
        <article className="av-card av-section" aria-label={t(isHebrew, B.title.he, B.title.en)} data-testid="admin-billing-card">
          <h3>{t(isHebrew, B.title.he, B.title.en)}</h3>
          {billingNotice && <div className={`av-notice ${billingNotice.good ? 'av-info' : 'av-bad'}`} role="status" data-testid="admin-billing-notice">{billingNotice.text}</div>}
          {previewUnavailable(bill) && <p className="av-muted" data-testid="admin-billing-unavailable">{t(isHebrew, B.unavailable.he, B.unavailable.en)}</p>}
          {billPaid && (
            <>
              <div className="av-statline"><span>{t(isHebrew, B.plan.he, B.plan.en)}</span><strong>{t(isHebrew, ...(bill.period === 'year' ? [B.year.he, B.year.en] : [B.month.he, B.month.en]))} · <bdi className="av-num">{billingMoney(bill.paidMinor, bill.currency)}</bdi></strong></div>
              <div className="av-statline"><span>{t(isHebrew, B.paidThrough.he, B.paidThrough.en)}</span><strong><bdi className="av-num">{date(bill.paidThrough)}</bdi></strong></div>
              <div className="av-statline"><span>{t(isHebrew, B.renewal.he, B.renewal.en)}</span><strong data-testid="admin-billing-renewal">
                {bill.renewalStopped
                  ? <>{t(isHebrew, B.renewalStopped.he, B.renewalStopped.en)} · {t(isHebrew, B.limitedOn.he, B.limitedOn.en).replace('{d}', '')}<bdi className="av-num">{date(bill.paidThrough)}</bdi></>
                  : bill.hasStandingOrder ? t(isHebrew, B.renewalActive.he, B.renewalActive.en) : t(isHebrew, B.noStandingOrder.he, B.noStandingOrder.en)}
              </strong></div>
            </>
          )}
          {bill?.unsettledRefund && (
            <div className="av-statline" data-testid="admin-billing-refund">
              <span>{t(isHebrew, B.openRefund.he, B.openRefund.en)}: <bdi className="av-num">{billingRefundMoney(bill.unsettledRefund.refundMinor, bill.unsettledRefund.currency, isHebrew)}</bdi> · {REFUND_STATE[bill.unsettledRefund.state] ? t(isHebrew, REFUND_STATE[bill.unsettledRefund.state].he, REFUND_STATE[bill.unsettledRefund.state].en) : ''}</span>
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected dialog that marks an owed refund as made (reason + admin password, server-verified) */}
              <button type="button" className="av-btn" onClick={() => onBilling('settle_refund', account, bill)}><Lock size={15} aria-hidden="true" />{t(isHebrew, B.settleButton.he, B.settleButton.en)}</button>
            </div>
          )}
          {bill?.openAction && (
            <div className="av-statline" data-testid="admin-billing-open-action">
              <span>{t(isHebrew, B.openAction.he, B.openAction.en)}: {KIND_NAMES[bill.openAction.kind] ? t(isHebrew, KIND_NAMES[bill.openAction.kind].he, KIND_NAMES[bill.openAction.kind].en) : ''} · {t(isHebrew, B.startedAt.he, B.startedAt.en).replace('{d}', '')}<bdi className="av-num">{dateTime(bill.openAction.createdAt)}</bdi></span>
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected dialog that closes an interrupted billing action (reason + admin password, server-verified) */}
              <button type="button" className="av-btn" onClick={() => onBilling('resolve', account, bill)}><Lock size={15} aria-hidden="true" />{t(isHebrew, B.resolveButton.he, B.resolveButton.en)}</button>
            </div>
          )}
        </article>
      )}

      <div className="av-grid av-equal av-section">
        <article className="av-card" aria-label={t(isHebrew, C.planUsage.he, C.planUsage.en)}>
          <h3>{t(isHebrew, C.planUsage.he, C.planUsage.en)}</h3>
          {status.key === 'free10_inactive' && !statusUnknown && <div className="av-notice av-info">{t(isHebrew, C.notActiveNotice.he, C.notActiveNotice.en)}</div>}
          <div className="av-statline">
            <span>{t(isHebrew, C.quotaUsage.he, C.quotaUsage.en)}</span>
            {free10
              ? <strong><bdi className="av-num">{free10.consumed}/{free10.total}</bdi> {free10.periodEnded ? (isHebrew ? 'נוצלו · 7 ימי החינם הסתיימו' : 'used · the 7 free days have ended') : isHebrew ? `נוצלו · נותרו ${free10.remaining}` : `used · ${free10.remaining} remaining`}{free10.reserved > 0 ? (isHebrew ? ` · ${free10.reserved} בתהליך` : ` · ${free10.reserved} in progress`) : ''}</strong>
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
                  const actor = byUid.get(row.actor_user_id);
                  return (
                    <div key={row.id} className="av-event">
                      <span className="av-eventdot" aria-hidden="true"><ShieldCheck size={17} /></span>
                      <div>
                        <strong>{a ? t(isHebrew, a.he, a.en) : t(isHebrew, C.unknownAction.he, C.unknownAction.en)}</strong>
                        {row.reason && <p><bdi dir="auto">{row.reason}</bdi></p>}
                        {/* the sketch: the outcome, then the admin who acted */}
                        <span className="av-pills" style={{ alignItems: 'center' }}>
                          {o && <span className={`av-badge av-${o.tone}`}>{t(isHebrew, o.he, o.en)}</span>}
                          {actor && <span className="av-small av-muted"><bdi>{actor.business_name || actor.email}</bdi></span>}
                        </span>
                      </div>
                      <time className="av-num">{accountDateTime(row.created_at, account, adminMarket)}</time>
                    </div>
                  );
                })}
          <div className="av-event">
            <span className="av-eventdot" aria-hidden="true"><UserPlus size={17} /></span>
            <div><strong>{t(isHebrew, C.accountRegistered.he, C.accountRegistered.en)}</strong></div>
            <time className="av-num">{dateTime(account.created_at)}</time>
          </div>
          {onOpenActivity && (
            <div className="av-section">
              {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
              <button type="button" className="av-btn" onClick={onOpenActivity}>{isHebrew ? 'פתיחת היומן' : 'Open the log'}</button>
            </div>
          )}
        </article>
        {(onLifetime || onReset || onDelete || billPaid) && (
          <article className="av-card av-protection">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Lock size={17} aria-hidden="true" />{t(isHebrew, C.protectedActions.he, C.protectedActions.en)}</h3>
            <p className="av-muted av-small">{t(isHebrew, C.protectedIntro.he, C.protectedIntro.en)}</p>
            <div className="av-grid" style={{ gap: 8 }}>
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected Lifetime dialog (reason + admin password, server-verified) */}
              {onLifetime && <button type="button" className="av-btn" onClick={() => onLifetime(account)}><Lock size={15} aria-hidden="true" />{t(isHebrew, ...(lifetime ? [C.revokeLifetime.he, C.revokeLifetime.en] : [C.grantLifetime.he, C.grantLifetime.en]))}</button>}
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected quote-reset dialog (reason + admin password + typed email, server-verified) */}
              {onReset && <button type="button" className="av-btn" onClick={() => onReset(account)}><Lock size={15} aria-hidden="true" />{t(isHebrew, C.resetQuotes.he, C.resetQuotes.en)}</button>}
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected delete-account dialog (reason + admin password + typed email, server-verified) */}
              {onDelete && <button type="button" className="av-btn" onClick={() => onDelete(account)}><Lock size={15} aria-hidden="true" />{t(isHebrew, C.deleteAccount.he, C.deleteAccount.en)}</button>}
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected stop-renewal dialog (reason + admin password, server-verified; the server cancels the PayPlus standing order) */}
              {billPaid && !bill.renewalStopped && bill.hasStandingOrder && !bill.openAction && <button type="button" className="av-btn" data-testid="admin-billing-stop" onClick={() => onBilling('stop_renewal', account, bill)}><Lock size={15} aria-hidden="true" />{t(isHebrew, B.stopButton.he, B.stopButton.en)}</button>}
              {/* PRODUCT_TRUTH_DECORATIVE: opens the protected early-end dialog (the server's prorated refund, reason + admin password, server-verified) */}
              {billPaid && !bill.openAction && <button type="button" className="av-btn" data-testid="admin-billing-end" onClick={() => onBilling('end_early', account, bill)}><Lock size={15} aria-hidden="true" />{t(isHebrew, B.endButton.he, B.endButton.en)}</button>}
            </div>
          </article>
        )}
      </div>
    </AdminScreenFrame>
  );
}
