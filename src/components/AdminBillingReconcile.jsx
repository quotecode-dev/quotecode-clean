// Owner console 2026-10-23, typed approval of L-22 ("... התאמת תשלומים יומית עם מסך בניהול"): the payment reconciliation screen. Every day
// the billing-reconcile function compares PayPlus's transaction history with our records; this screen shows the last runs and every
// difference it found (money at PayPlus without an entitlement, an entitlement without money, a different amount, a refund we do not know),
// and lets the Owner mark a finding as checked. Reads billing_reconcile_admin_state() and changes a status through
// billing_reconcile_set_status() (both super admin only); "run now" calls the function (super admin). Nothing here changes a payment.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import { formatShortDateTime } from '../utils/shortDate';
import { ADMIN_DATE_MARKET } from '../utils/adminDates';
import { formatMoneyForCurrency } from '../utils/money';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import './adminUsers.css';
import './adminV2.css';

const CODE_LABEL = {
  UNLINKED: { he: 'נגבה כסף ואין מנוי', en: 'Charged, no subscription' },
  MISSING_AT_PROVIDER: { he: 'מנוי בלי חיוב בפיי פלוס', en: 'Subscription, no PayPlus charge' },
  AMOUNT_MISMATCH: { he: 'סכום או מטבע שונים', en: 'Different amount or currency' },
  REFUND_UNRECORDED: { he: 'החזר שלא נרשם אצלנו', en: 'Refund we did not record' },
};
const CODE_HELP = {
  UNLINKED: { he: 'פיי פלוס גבו את הסכום, ואין אצלנו תשלום מאומת שנתן מנוי. לבדוק בפיי פלוס למי שייך החיוב.', en: 'PayPlus charged this amount and we have no verified payment that gave a subscription. Check in PayPlus who was charged.' },
  MISSING_AT_PROVIDER: { he: 'אצלנו נרשם תשלום שנתן מנוי, ופיי פלוס לא מציגים אותו בהיסטוריה.', en: 'We recorded a payment that gave a subscription, and PayPlus does not list it.' },
  AMOUNT_MISMATCH: { he: 'אותה עסקה, וסכום או מטבע שונים בין פיי פלוס לבינינו.', en: 'The same transaction with a different amount or currency at PayPlus and with us.' },
  REFUND_UNRECORDED: { he: 'פיי פלוס מציגים החזר שלא נעשה מהניהול ולא הגיע אלינו כאירוע.', en: 'PayPlus lists a refund that was not made from the admin and did not reach us as an event.' },
};
const RUN_STATUS = {
  ok: { he: 'הושלמה', en: 'Completed' }, failed: { he: 'נכשלה', en: 'Failed' }, running: { he: 'רצה', en: 'Running' },
  not_configured: { he: 'חסר מזהה המסוף', en: 'Terminal id missing' },
};
const N = ({ v }) => <bdi className="av-num">{v}</bdi>;
const symbol = (c) => (c === 'ILS' ? '₪' : c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : `${c} `);

// the finding's amount: ours in agorot / cents; PayPlus's in the unit the run detected (unknown = shown as PayPlus wrote it)
function amountOf(f, isHebrew) {
  const d = f.detail || {};
  if (Number.isFinite(d.amountMinor)) return `${symbol(d.currency)}${formatMoneyForCurrency(d.amountMinor / 100, d.currency)}`;
  const p = d.provider || d;
  if (!Number.isFinite(p.amount)) return '—';
  if (p.scale === 'minor') return `${symbol(p.currency)}${formatMoneyForCurrency(p.amount / 100, p.currency)}`;
  if (p.scale === 'major') return `${symbol(p.currency)}${formatMoneyForCurrency(p.amount, p.currency)}`;
  return `${p.amount} ${p.currency || ''} ${isHebrew ? '(יחידה לא ידועה)' : '(unit unknown)'}`;
}

export default function AdminBillingReconcile({ isHebrew }) {
  const L = (x) => (isHebrew ? x.he : x.en);
  const market = ADMIN_DATE_MARKET; // IRON-DATE-001 admin amendment 2026-10-22: Israeli dates in every admin screen
  const [data, setData] = useState('loading');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(() => {
    setData('loading');
    Promise.resolve().then(() => supabase.rpc('billing_reconcile_admin_state')).then(({ data: d, error }) => {
      if (error || !d || d.ok !== true) { setData('unavailable'); return; }
      setData(d);
      setUpdatedAt(new Date().toISOString());
    }).catch(() => setData('unavailable'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    setBusy(id);
    const { data: r, error } = await Promise.resolve().then(() => supabase.rpc('billing_reconcile_set_status', { p_id: id, p_status: status })).catch(() => ({ error: true }));
    setBusy('');
    if (error || !r?.ok) setNotice({ good: false, text: isHebrew ? 'השינוי לא נשמר. נסו שוב.' : 'The change was not saved. Try again.' });
    load();
  };
  const runNow = async () => {
    setBusy('run');
    let r;
    try {
      const { data: d, error } = await supabase.functions.invoke('billing-reconcile', { body: { action: 'run' } });
      r = error ? await error?.context?.json?.().catch(() => null) : d;
    } catch { r = null; }
    setBusy('');
    if (r?.status === 'ok') {
      setNotice({ good: true, text: isHebrew ? `ההתאמה הסתיימה: ${r.provider} עסקאות בפיי פלוס, ${r.matched} התאימו, ${r.newFindings} פריטים חדשים לבדיקה.`
        : `Reconciliation done: ${r.provider} PayPlus transactions, ${r.matched} matched, ${r.newFindings} new items to check.` });
    } else if (r?.status === 'not_configured') {
      setNotice({ good: false, text: isHebrew ? 'חסר מזהה המסוף של פיי פלוס בשרת. בלעדיו אי אפשר לקרוא את העסקאות.' : 'The PayPlus terminal id is missing on the server. Without it the transactions cannot be read.' });
    } else {
      setNotice({ good: false, text: isHebrew ? `ההתאמה לא הושלמה${r?.code ? ` (${r.code})` : ''}. נסו שוב מאוחר יותר.` : `The reconciliation did not complete${r?.code ? ` (${r.code})` : ''}. Try again later.` });
    }
    load();
  };

  const d = data && typeof data === 'object' ? data : null;
  const runs = d?.runs || [];
  const open = d?.open || [];
  const checked = d?.checked || [];
  const last = runs[0] || null;
  const title = isHebrew ? 'התאמת תשלומים' : 'Payment reconciliation';
  const findingRow = (f, isOpen) => (
    <li key={f.id} data-finding={f.id} data-code={f.code} className="av-card" style={{ padding: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <strong>{L(CODE_LABEL[f.code] || { he: f.code, en: f.code })}</strong>
        <span className="av-muted"><N v={amountOf(f, isHebrew)} />{' · '}<N v={formatShortDateTime(f.detail?.at || f.createdAt, market)} /></span>
      </div>
      <p className="av-muted" style={{ margin: '4px 0' }}>{L(CODE_HELP[f.code] || { he: '', en: '' })}</p>
      <p style={{ margin: '4px 0', fontSize: 12 }}>{isHebrew ? 'מזהה העסקה: ' : 'Transaction id: '}<bdi dir="ltr" style={{ fontFamily: 'monospace' }}>{f.uid}</bdi></p>
      {isOpen ? (
        // PRODUCT_TRUTH_DECORATIVE: marks this finding as checked (super admin, server-checked; no payment changes)
        <button type="button" className="admin-btn" disabled={!!busy} onClick={() => setStatus(f.id, 'checked')} data-testid={`reconcile-check-${f.id}`}>{isHebrew ? 'נבדק' : 'Checked'}</button>
      ) : (
        // PRODUCT_TRUTH_DECORATIVE: returns a checked finding to the open list (super admin, server-checked)
        <button type="button" className="admin-btn" disabled={!!busy} onClick={() => setStatus(f.id, 'new')} data-testid={`reconcile-reopen-${f.id}`}>{isHebrew ? 'החזרה לפתוחים' : 'Reopen'}</button>
      )}
    </li>
  );

  return (
    <AdminScreenFrame
      title={title}
      subtitle={isHebrew ? 'כל בוקר משווים את העסקאות בפיי פלוס לתשלומים שנרשמו אצלנו, ומציגים כאן כל הבדל. קריאה בלבד: שום תשלום או מנוי לא משתנים מכאן.'
        : 'Every morning the PayPlus transactions are compared with the payments we recorded, and every difference is shown here. Read only: no payment or subscription changes from here.'}
      label={title}
      isHebrew={isHebrew}
      onRefresh={load}
      refreshing={data === 'loading'}
      updatedAt={updatedAt}
      formatTime={(v) => formatShortDateTime(v, market)}
    >
      <article className="av-card" data-testid="admin-billing-reconcile">
        {notice && <div role={notice.good ? 'status' : 'alert'} className={`av-notice ${notice.good ? 'av-good' : 'av-bad'}`} data-testid="reconcile-notice">{notice.text}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} className="av-section">
          {/* PRODUCT_TRUTH_DECORATIVE: runs the reconciliation now (super admin; reads PayPlus, changes no payment; no email) */}
          <button type="button" className="admin-btn primary" disabled={!!busy} onClick={runNow} data-testid="reconcile-run">{busy === 'run' ? (isHebrew ? 'בודק...' : 'Checking...') : (isHebrew ? 'התאמה עכשיו' : 'Reconcile now')}</button>
          {last && (
            <span className="av-muted" data-testid="reconcile-last">
              {isHebrew ? 'ההרצה האחרונה: ' : 'Last run: '}<N v={formatShortDateTime(last.startedAt, market)} />{' · '}{L(RUN_STATUS[last.status] || RUN_STATUS.failed)}
              {last.status === 'ok' && <>{' · '}{isHebrew ? 'עסקאות בפיי פלוס: ' : 'PayPlus transactions: '}<N v={last.provider} />{isHebrew ? ', התאימו: ' : ', matched: '}<N v={last.matched} /></>}
              {last.status === 'failed' && last.error && <>{' · '}<bdi dir="ltr">{last.error}</bdi></>}
            </span>
          )}
        </div>

        {data === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
          : data === 'unavailable' ? <div className="av-notice av-bad" role="alert" data-testid="reconcile-unavailable">{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</div>
            : (
              <>
                <h3 className="av-section">{isHebrew ? 'לבדיקה' : 'To check'} <N v={open.length} /></h3>
                {open.length === 0
                  ? <p className="av-muted" role="status" data-testid="reconcile-empty">{runs.length ? (isHebrew ? 'אין הבדלים פתוחים. כל העסקאות התאימו.' : 'No open differences. Every transaction matched.') : (isHebrew ? 'ההתאמה עדיין לא רצה.' : 'The reconciliation has not run yet.')}</p>
                  : <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }} data-testid="reconcile-open">{open.map((f) => findingRow(f, true))}</ol>}
                {checked.length > 0 && (
                  <details className="av-section" data-testid="reconcile-checked">
                    <summary>{isHebrew ? 'נבדקו' : 'Checked'} <N v={checked.length} /></summary>
                    <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 10 }}>{checked.map((f) => findingRow(f, false))}</ol>
                  </details>
                )}
                {runs.length > 0 && (
                  <div className="av-tablewrap av-section">
                    <table data-testid="reconcile-runs">
                      <caption>{isHebrew ? 'ההרצות האחרונות (שעון ישראל)' : 'The last runs (Israel time)'}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{isHebrew ? 'מתי' : 'When'}</th>
                          <th scope="col">{isHebrew ? 'מצב' : 'Status'}</th>
                          <th scope="col">{isHebrew ? 'בפיי פלוס' : 'At PayPlus'}</th>
                          <th scope="col">{isHebrew ? 'אצלנו' : 'Ours'}</th>
                          <th scope="col">{isHebrew ? 'התאימו' : 'Matched'}</th>
                          <th scope="col">{isHebrew ? 'חדשים' : 'New'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((r) => (
                          <tr key={r.id} data-run={r.id} data-status={r.status}>
                            <td><N v={formatShortDateTime(r.startedAt, market)} /></td>
                            <td>{L(RUN_STATUS[r.status] || RUN_STATUS.failed)}</td>
                            <td><N v={r.provider} /></td>
                            <td><N v={r.ours} /></td>
                            <td><N v={r.matched} /></td>
                            <td><N v={r.newFindings} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
      </article>
    </AdminScreenFrame>
  );
}
