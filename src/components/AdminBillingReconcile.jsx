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
import { runBillingAction } from '../domain/admin/adminBilling';
import './adminUsers.css';
import './adminV2.css';

const CODE_LABEL = {
  UNLINKED: { he: 'נגבה כסף ואין מנוי', en: 'Charged, no subscription' },
  MISSING_AT_PROVIDER: { he: 'מנוי בלי חיוב בפיי פלוס', en: 'Subscription, no PayPlus charge' },
  AMOUNT_MISMATCH: { he: 'סכום או מטבע שונים', en: 'Different amount or currency' },
  REFUND_UNRECORDED: { he: 'החזר שלא נרשם אצלנו', en: 'Refund we did not record' },
  REFUND_OWED: { he: 'החזר ללקוח שעוד לא הושלם', en: 'Customer refund not completed' },
};
const CODE_HELP = {
  UNLINKED: { he: 'פיי פלוס גבו את הסכום, ואין אצלנו תשלום מאומת שנתן מנוי. לבדוק בפיי פלוס למי שייך החיוב.', en: 'PayPlus charged this amount and we have no verified payment that gave a subscription. Check in PayPlus who was charged.' },
  MISSING_AT_PROVIDER: { he: 'אצלנו נרשם תשלום שנתן מנוי, ופיי פלוס לא מציגים אותו בהיסטוריה.', en: 'We recorded a payment that gave a subscription, and PayPlus does not list it.' },
  AMOUNT_MISMATCH: { he: 'אותה עסקה, וסכום או מטבע שונים בין פיי פלוס לבינינו.', en: 'The same transaction with a different amount or currency at PayPlus and with us.' },
  REFUND_UNRECORDED: { he: 'פיי פלוס מציגים החזר שלא נעשה מהניהול ולא הגיע אלינו כאירוע.', en: 'PayPlus lists a refund that was not made from the admin and did not reach us as an event.' },
  REFUND_OWED: { he: 'לקוח הסיר את חכם פלוס השנתי ומגיע לו החזר, וההחזר לא בוצע או שלא ידוע אם בוצע. לבדוק בפיי פלוס לפני כל החזר, כדי לא להחזיר פעמיים.', en: 'A customer removed the yearly SMART PACK and is owed a refund that was not made, or may not have been made. Check in PayPlus before any refund, so it is not refunded twice.' },
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
  // Codex R-10: the cause is said as likely, never as a fact (another refusal can share the code)
  provider_403: { he: 'פיי פלוס סירבו לבקשה. בדרך כלל זו בדיקת כתובות ה-IP בחשבון: כדאי לוודא ששתי כתובות המתווך ברשימת המורשים בפיי פלוס.', en: 'PayPlus refused the request. Usually this is the IP check of the account: check that both relay addresses are on the PayPlus allow list.' },
  relay_refused: { he: 'המתווך עם הכתובת הקבועה לא העביר את הבקשה. ייתכן שנגמרה המכסה החודשית שלו או שפרטי הכניסה אליו השתנו.', en: 'The fixed-IP relay did not pass the request on. Its monthly quota may be used up, or its credentials may have changed.' },
  provider_unreachable: { he: 'פיי פלוס או המתווך לא ענו בזמן. ההרצה הבאה תנסה שוב.', en: 'PayPlus or the relay did not answer in time. The next run tries again.' },
  provider_407: { he: 'המתווך עם הכתובת הקבועה לא קיבל את פרטי הכניסה. כדאי לבדוק שכתובת המתווך בשרת הועתקה במלואה.', en: 'The fixed-IP relay did not accept its credentials. Check that the relay address on the server was copied in full.' },
  relay_misconfigured: { he: 'כתובת המתווך שבשרת אינה כתובת תקינה. צריך להכניס אותה מחדש.', en: 'The relay address on the server is not a valid address. It needs to be set again.' },
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

// Codex N03 (Owner 2026-10-28, decision 1): "Done in PayPlus" for a removal refund owed to a customer - the Owner's password and the
// PayPlus transaction number of the refund; the debt is closed for good on the server (admin-billing, a single-use proof bound to both)
function SettleOwedRefund({ f, isHebrew, busy, onSettled }) {
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState(null);
  if (!open) {
    return (
      // PRODUCT_TRUTH_DECORATIVE: opens the protected form to record that this owed refund was made in PayPlus (nothing is refunded here)
      <button type="button" className="av-btn av-primary" disabled={busy} onClick={() => setOpen(true)} data-testid={`reconcile-settle-${f.id}`}>{isHebrew ? 'בוצע בפיי פלוס' : 'Done in PayPlus'}</button>
    );
  }
  const submit = async () => {
    setState('busy');
    const r = await runBillingAction((name, opts) => supabase.functions.invoke(name, opts), { action: 'settle_removal_refund', targetUserId: f.detail.userId,
      password, reason: isHebrew ? 'ההחזר בוצע ידנית בפיי פלוס' : 'The refund was made by hand in PayPlus', removalId: f.detail.removalId, refundRef: ref });
    setPassword('');
    if (r.ok) { setState('done'); onSettled(); return; }
    setState(r.code === 'reauth_failed' || r.code === 'reauth_required' ? 'password' : r.code === 'no_unsettled_refund' ? 'gone' : 'failed');
  };
  const msg = { password: isHebrew ? 'הסיסמה לא אושרה. נסו שוב.' : 'The password was not accepted. Try again.',
    gone: isHebrew ? 'ההחזר הזה כבר לא פתוח.' : 'This refund is no longer open.', failed: isHebrew ? 'הרישום לא הושלם. נסו שוב.' : 'It was not recorded. Try again.',
    done: isHebrew ? 'נרשם: ההחזר בוצע בפיי פלוס, והחוב נסגר.' : 'Recorded: the refund was made in PayPlus, and the debt is closed.' }[state];
  return (
    <div className="av-section" style={{ display: 'grid', gap: 8, maxWidth: 420 }} data-testid={`reconcile-settle-form-${f.id}`}>
      <label className="av-field"><span>{isHebrew ? 'מספר העסקה של ההחזר בפיי פלוס' : 'The PayPlus transaction number of the refund'}</span>
        <input dir="ltr" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={200} data-testid={`reconcile-settle-ref-${f.id}`} /></label>
      <label className="av-field"><span>{isHebrew ? 'הסיסמה שלכם' : 'Your password'}</span>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid={`reconcile-settle-password-${f.id}`} /></label>
      {/* PRODUCT_TRUTH_DECORATIVE: records the refund made in PayPlus (password + transaction number, checked on the server) */}
      <button type="button" className="av-btn av-primary" disabled={state === 'busy' || ref.trim().length < 3 || !password} onClick={submit} data-testid={`reconcile-settle-send-${f.id}`}>
        {state === 'busy' ? (isHebrew ? 'רושם...' : 'Recording...') : (isHebrew ? 'רישום ההחזר' : 'Record the refund')}</button>
      {msg && <div className={`av-notice ${state === 'done' ? 'av-ok' : 'av-bad'}`} role={state === 'done' ? 'status' : 'alert'}>{msg}</div>}
    </div>
  );
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
      const unv = Number(r.unverified) || 0;
      setNotice({ good: true, text: isHebrew ? `ההתאמה הסתיימה: ${r.provider} עסקאות בפיי פלוס, ${r.matched} התאימו${unv ? `, ${unv} נקשרו בלי שהסכום אומת` : ''}, ${r.newFindings} פריטים חדשים לבדיקה.`
        : `Reconciliation done: ${r.provider} PayPlus transactions, ${r.matched} matched${unv ? `, ${unv} linked with the amount not verified` : ''}, ${r.newFindings} new items to check.` });
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
      {isOpen && f.code === 'REFUND_OWED' && f.detail?.removalId && f.detail?.userId && (
        <SettleOwedRefund f={f} isHebrew={isHebrew} busy={!!busy} onSettled={() => setStatus(f.id, 'checked')} />
      )}
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
              {last.status === 'ok' && <>{' · '}{isHebrew ? 'עסקאות בפיי פלוס: ' : 'PayPlus transactions: '}<N v={last.provider} />{isHebrew ? ', התאימו: ' : ', matched: '}<N v={last.matched} />{Number(last.unverified) > 0 && <>{isHebrew ? ', לא אומתו: ' : ', not verified: '}<N v={last.unverified} /></>}</>}
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
                    : last.status === 'ok' && Number(last.unverified) > 0 ? (isHebrew ? 'אין הבדלים פתוחים, אבל בחלק מהעסקאות הסכום עוד לא אומת: יחידת הסכום של פיי פלוס תתברר מהעסקה הראשונה שתתאים במזהה.' : 'No open differences, but for some transactions the amount is not verified yet: the PayPlus amount unit is learned from the first transaction that matches by id.')
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
                          <th scope="col">{isHebrew ? 'לא אומתו' : 'Not verified'}</th>
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
                            <td><N v={Number(r.unverified) || 0} /></td>
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
