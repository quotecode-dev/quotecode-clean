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
  not_configured: { he: 'חסרות הגדרות פיי פלוס', en: 'PayPlus settings missing' },
  stalled: { he: 'נעצרה באמצע', en: 'Stopped half-way' },
};
// a run still "running" after 30 minutes stopped half-way (the next daily call takes it again)
const runState = (r) => (r.status === 'running' && Date.now() - Date.parse(r.startedAt) > 30 * 60000 ? 'stalled' : r.status);
// what a PayPlus refusal means, in plain words (the code itself is shown too)
const ERROR_HELP = {
  provider_403: { he: 'פיי פלוס חסמו את הקריאה בגלל בדיקת כתובת ה-IP בחשבון: המפתחות עובדים רק מכתובות מורשות, ולשרת אין כתובת קבועה.', en: 'PayPlus refused the read because of the IP check in the account: the keys work only from approved addresses, and the server has no fixed address.' },
  provider_401: { he: 'פיי פלוס לא קיבלו את המפתחות. כדאי לבדוק שהמפתחות בשרת הם של החשבון האמיתי.', en: 'PayPlus did not accept the keys. Check that the server keys belong to the live account.' },
};
const N = ({ v }) => <bdi className="av-num">{v}</bdi>;
const symbol = (c) => (c === 'ILS' ? '₪' : c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : `${c} `);

// an amount: ours in agorot / cents; PayPlus's in the unit the run detected (unknown = shown as PayPlus wrote it)
const ourAmount = (minor, currency) => `${symbol(currency)}${formatMoneyForCurrency(minor / 100, currency)}`;
function providerAmount(p, isHebrew) {
  if (!p || !Number.isFinite(p.amount)) return '—';
  if (p.scale === 'minor') return `${symbol(p.currency)}${formatMoneyForCurrency(p.amount / 100, p.currency)}`;
  if (p.scale === 'major') return `${symbol(p.currency)}${formatMoneyForCurrency(p.amount, p.currency)}`;
  return `${p.amount} ${p.currency || ''} ${isHebrew ? '(יחידה לא ידועה)' : '(unit unknown)'}`;
}
function amountOf(f, isHebrew) {
  const d = f.detail || {};
  if (d.provider && d.ours) {
    return isHebrew ? `בפיי פלוס ${providerAmount(d.provider, true)}, אצלנו ${ourAmount(d.ours.amountMinor, d.ours.currency)}`
      : `PayPlus ${providerAmount(d.provider, false)}, ours ${ourAmount(d.ours.amountMinor, d.ours.currency)}`;
  }
  if (Number.isFinite(d.amountMinor)) return ourAmount(d.amountMinor, d.currency);
  return providerAmount(d, isHebrew);
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
      setNotice({ good: false, text: isHebrew ? 'חסרות בשרת הגדרות הקריאה מפיי פלוס (מזהה המסוף או המפתחות). בלעדיהן אי אפשר לקרוא את העסקאות.' : 'The PayPlus read settings are missing on the server (the terminal id or the keys). Without them the transactions cannot be read.' });
    } else {
      const help = ERROR_HELP[r?.code];
      setNotice({ good: false, text: help ? `${L(help)} (${r.code})`
        : isHebrew ? `ההתאמה לא הושלמה${r?.code ? ` (${r.code})` : ''}. נסו שוב מאוחר יותר.` : `The reconciliation did not complete${r?.code ? ` (${r.code})` : ''}. Try again later.` });
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
        <button type="button" className="av-btn" disabled={!!busy} onClick={() => setStatus(f.id, 'checked')} data-testid={`reconcile-check-${f.id}`}>{isHebrew ? 'נבדק' : 'Checked'}</button>
      ) : (
        // PRODUCT_TRUTH_DECORATIVE: returns a checked finding to the open list (super admin, server-checked)
        <button type="button" className="av-btn" disabled={!!busy} onClick={() => setStatus(f.id, 'new')} data-testid={`reconcile-reopen-${f.id}`}>{isHebrew ? 'החזרה לפתוחים' : 'Reopen'}</button>
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
        {notice && <div role={notice.good ? 'status' : 'alert'} className={`av-notice ${notice.good ? 'av-info' : 'av-bad'}`} data-testid="reconcile-notice">{notice.text}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} className="av-section">
          {/* PRODUCT_TRUTH_DECORATIVE: runs the reconciliation now (super admin; reads PayPlus, changes no payment; no email) */}
          <button type="button" className="av-btn av-primary" disabled={!!busy} onClick={runNow} data-testid="reconcile-run">{busy === 'run' ? (isHebrew ? 'בודק...' : 'Checking...') : (isHebrew ? 'התאמה עכשיו' : 'Reconcile now')}</button>
          {last && (
            <span className="av-muted" data-testid="reconcile-last">
              {isHebrew ? 'ההרצה האחרונה: ' : 'Last run: '}<N v={formatShortDateTime(last.startedAt, market)} />{' · '}{L(RUN_STATUS[runState(last)] || RUN_STATUS.failed)}
              {last.status === 'ok' && <>{' · '}{isHebrew ? 'עסקאות בפיי פלוס: ' : 'PayPlus transactions: '}<N v={last.provider} />{isHebrew ? ', התאימו: ' : ', matched: '}<N v={last.matched} /></>}
              {last.status === 'failed' && last.error && <>{' · '}<bdi dir="ltr">{last.error}</bdi>{ERROR_HELP[last.error] && <>{' · '}{L(ERROR_HELP[last.error])}</>}</>}
            </span>
          )}
        </div>

        {data === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
          : data === 'unavailable' ? <div className="av-notice av-bad" role="alert" data-testid="reconcile-unavailable">{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</div>
            : (
              <>
                <h3 className="av-label av-section">{isHebrew ? 'לבדיקה' : 'To check'} <N v={open.length} /></h3>
                {open.length === 0
                  ? <p className="av-muted" role="status" data-testid="reconcile-empty">{!last ? (isHebrew ? 'ההתאמה עדיין לא רצה.' : 'The reconciliation has not run yet.')
                    : last.status === 'ok' ? (isHebrew ? 'אין הבדלים פתוחים. כל העסקאות התאימו.' : 'No open differences. Every transaction matched.')
                      : (isHebrew ? 'ההרצה האחרונה לא הושלמה, ולכן אין כרגע תמונה עדכנית.' : 'The last run did not complete, so there is no current picture.')}</p>
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
                            <td>{L(RUN_STATUS[runState(r)] || RUN_STATUS.failed)}</td>
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
