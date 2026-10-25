// Admin subscription state components (OD-16 / OD-20). Read model, fetching and wording: src/domain/subscriptions/adminAccountSummary.js.
import { planName } from '../../supabase/functions/_shared/subscriptionContract.ts';
import { COPY, tr, planStateText, accountIndicators, accountStatus, ACCOUNT_STATUS, STATUS_MEDALLION_KIND, statusFromKey, accountStatusWords } from '../domain/subscriptions/adminAccountSummary';
import PlanMedallionMark from './PlanMedallionMark';

// Owner console 2026-10-16: the subscription status is the SAME medallion + words as the user's own header (subscriptionStatus.js),
// never a raw legacy code. The status comes from the server row (get_admin_accounts .status) when present, else from the summary.
export function AdminAccountStatusIcon({ statusKey, size = 22, remaining, total }) {
  return <PlanMedallionMark model={{ kind: STATUS_MEDALLION_KIND[statusKey] || 'free10', remaining, total }} size={size} />;
}
export function AdminAccountStatus({ account, summary = null, statusKey = null, isHebrew, formatDate = null, size = 22, sub = null }) {
  const computed = accountStatus(account, summary);
  const s = statusKey && statusKey !== computed.key ? statusFromKey(statusKey, { until: account?.trial_ends_at }) : computed;
  // a server row says Free-10 without the counter: the status name only (the counter comes with the summary)
  const words = s.key === 'free10' && !Number.isInteger(s.consumed) ? tr(ACCOUNT_STATUS.free10, isHebrew) : accountStatusWords(s, isHebrew, null);
  return (
    <span className="admin-account-status av-plan" data-status={s.key}>
      <AdminAccountStatusIcon statusKey={s.key} remaining={s.remaining} total={s.total} size={size} />
      <span>
        <strong>{words}</strong>
        {s.key === 'trial' && formatDate && <span className="av-sub">{isHebrew ? 'עד ' : 'until '}<bdi className="av-num">{formatDate(s.until)}</bdi></span>}
        {sub && <span className="av-sub">{sub}</span>}
      </span>
    </span>
  );
}

// Owner 2026-10-14 (A7 / A8): the account's indicator tags (lifetime, legacy trial, and - from a ready summary - Free-10, subscription,
// assignment). No tag -> a dash with an accessible "no indicators" text.
export function AdminAccountIndicators({ account, summary, isHebrew, formatDate }) {
  const tags = accountIndicators(account, summary, { isHebrew, formatDate });
  const none = isHebrew ? 'אין חיוויים' : 'No indicators';
  if (!tags.length) return <span className="admin-indicators is-empty" title={none}>—<span className="sr-only">{none}</span></span>;
  return (
    <span className="admin-indicators">
      {tags.map((t) => <span key={t.key} className={'admin-indicator is-' + t.tone} data-indicator={t.key}><bdi>{t.text}</bdi></span>)}
    </span>
  );
}

// Compact (list) presentation. A neutral state shows a dash with the full sentence for assistive tech and as a tooltip;
// the screen shows the global "not active" statement once (AdminPlanSystemNotice).
export function AdminPlanState({ summary, isHebrew, compact = false }) {
  const state = summary?.state || 'loading';
  const text = planStateText(summary, isHebrew);
  if (state === 'ready') {
    const name = planName(summary.planId, isHebrew ? 'he' : 'en');
    const balance = summary.free10 ? `${summary.free10.periodEnded ? 0 : summary.free10.remaining}/${summary.free10.limit}` : null;
    return (
      <span className="admin-plan-state" data-state="ready" title={text}>
        <span className="admin-plan-state-name">{name}</span>
        {compact
          ? (balance && <span className="admin-plan-state-meta" dir="ltr">{balance}</span>)
          : <span className="admin-plan-state-meta">{text.slice(name.length).replace(/^ · /, '')}</span>}
        {compact && <span className="sr-only">{text}</span>}
      </span>
    );
  }
  if (compact) {
    return (
      <span className="admin-plan-state is-neutral" data-state={state} title={text}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{text}</span>
      </span>
    );
  }
  return <span className="admin-plan-state is-neutral" data-state={state}>{text}</span>;
}

export function AdminPlanSystemNotice({ system, isHebrew }) {
  const entry = system === 'not_active' ? COPY.systemNotActive
    : system === 'active' ? COPY.systemActive
      : system === 'loading' ? COPY.systemLoading : COPY.systemUnknown;
  return (
    <p className="admin-plan-system-notice" role="status" data-system={system}>{tr(entry, isHebrew)}</p>
  );
}

// Owner console 2026-10-16: the former raw "legacy record" codes (plan / trial_ends_at / is_lifetime) are shown as ONE subscription
// status (icon + words); the details page passes the read-back legacy fields and the server summary.
export function AdminLegacyRecord({ account, legacy = null, summary = null, isHebrew, compact = false, formatDate = null }) {
  const view = legacy ? { is_lifetime: legacy.isLifetime, trial_ends_at: legacy.trialEndsAt } : account;
  if (compact) return <AdminAccountStatus account={view} summary={summary} isHebrew={isHebrew} formatDate={formatDate} />;
  const title = isHebrew ? 'מצב מנוי' : 'Subscription status';
  return (
    <section className="admin-details-card admin-legacy-record" aria-label={title}>
      <h3>{title}</h3>
      <p className="admin-account-status-line"><AdminAccountStatus account={view} summary={summary} isHebrew={isHebrew} formatDate={formatDate} /></p>
    </section>
  );
}
