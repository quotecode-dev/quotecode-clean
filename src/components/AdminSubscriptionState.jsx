// Admin subscription state components (OD-16 / OD-20). Read model, fetching and wording: src/domain/subscriptions/adminAccountSummary.js.
import { planName } from '../../supabase/functions/_shared/subscriptionContract.ts';
import { COPY, tr, planStateText, legacyRecordEntries } from '../domain/subscriptions/adminAccountSummary';

// Compact (list) presentation. A neutral state shows a dash with the full sentence for assistive tech and as a tooltip;
// the screen shows the global "not active" statement once (AdminPlanSystemNotice).
export function AdminPlanState({ summary, isHebrew, compact = false }) {
  const state = summary?.state || 'loading';
  const text = planStateText(summary, isHebrew);
  if (state === 'ready') {
    const name = planName(summary.planId, isHebrew ? 'he' : 'en');
    const balance = summary.free10 ? `${summary.free10.remaining}/${summary.free10.limit}` : null;
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

export function AdminLegacyRecord({ account, legacy = null, isHebrew, compact = false }) {
  const entries = legacyRecordEntries(account, legacy);
  if (compact) {
    return (
      <span className="admin-legacy-inline" dir="ltr">
        <span className="sr-only">{tr(COPY.legacyTitle, isHebrew)}: </span>
        {entries.map(([k, v]) => <code key={k}>{`${k}=${v}`}</code>)}
      </span>
    );
  }
  return (
    <section className="admin-details-card admin-legacy-record" aria-label={tr(COPY.legacyTitle, isHebrew)}>
      <h3>{tr(COPY.legacyTitle, isHebrew)}</h3>
      <p className="admin-legacy-hint">{tr(COPY.legacyHint, isHebrew)}</p>
      <ul className="admin-legacy-values" dir="ltr">
        {entries.map(([k, v]) => <li key={k}><code>{`${k}=${v}`}</code></li>)}
      </ul>
    </section>
  );
}
