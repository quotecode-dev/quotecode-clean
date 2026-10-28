// Owner console 2026-10-22, typed approval of L-22: "כלי חשבוניות הוצאה במסך מערכת בניהול, עם משיכה מתיבות הדואר, אישור, ושליחה להוצאות
// בפיי פלוס - מ 28 ליולי והלאה" (plan docs/EXPENSE_INVOICES_TOOL_PLAN_2026-10-22.md). The Owner only (the server allows super admin only).
// The two mailboxes connect read-only through Google; a scan reads every possible invoice since 28/07/2026 and the AI fills the table; the
// Owner approves or rejects each row (and may correct it); only approved rows are sent to PayPlus expenses, never twice. Reads through
// expense_invoices_admin_state(); every change goes through the expense-invoices function. Amounts: formatMoneyForCurrency (IRON-ILS-001).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import { formatShortDate, formatShortDateTime } from '../utils/shortDate';
import { ADMIN_DATE_MARKET } from '../utils/adminDates';
import { formatMoneyForCurrency, QUOTE_CURRENCY_SYMBOLS } from '../utils/money';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import './adminUsers.css';
import './adminV2.css';

const EXPENSE_MAILBOXES = Object.freeze(['quotecodedev@gmail.com', 'shlomisiny@gmail.com']);
const EXPENSE_CATEGORY_LABELS = Object.freeze({
  software_cloud: { he: 'תוכנה וענן', en: 'Software and cloud' }, ai: { he: 'בינה מלאכותית', en: 'AI services' },
  advertising: { he: 'פרסום ושיווק', en: 'Advertising' }, communication: { he: 'טלפון ואינטרנט', en: 'Phone and internet' },
  equipment: { he: 'ציוד ומחשבים', en: 'Equipment' }, professional: { he: 'שירותים מקצועיים', en: 'Professional services' },
  fees: { he: 'עמלות סליקה ובנק', en: 'Payment and bank fees' }, office: { he: 'משרד', en: 'Office' }, other: { he: 'אחר', en: 'Other' },
});
const TABS = [
  { id: 'pending', he: 'ממתינות לאישור', en: 'Waiting for approval', statuses: ['pending'] },
  { id: 'approved', he: 'אושרו', en: 'Approved', statuses: ['approved', 'send_failed', 'sending'] },
  { id: 'sent', he: 'נשלחו לפיי פלוס', en: 'Sent to PayPlus', statuses: ['sent'] },
  { id: 'rejected', he: 'נדחו', en: 'Rejected', statuses: ['rejected'] },
  { id: 'excluded', he: 'סוננו', en: 'Filtered out', statuses: ['excluded'] },
];
const CONNECT_RESULT = {
  ok: { he: 'התיבה חוברה. אפשר לסרוק.', en: 'The mailbox is connected. You can scan now.', good: true },
  wrong_mailbox: { he: 'נבחר חשבון גוגל אחר מהתיבה שביקשתם. נסו שוב ובחרו את התיבה הנכונה.', en: 'A different Google account was chosen. Try again with the right mailbox.' },
  cancelled: { he: 'החיבור בוטל בגוגל. שום דבר לא השתנה.', en: 'The connection was cancelled at Google. Nothing changed.' },
  expired: { he: 'עבר יותר מדי זמן. לחצו שוב על "חיבור".', en: 'Too much time passed. Press "Connect" again.' },
  no_offline_access: { he: 'גוגל לא נתנה גישה קבועה. נתקו את האפליקציה בהגדרות חשבון הגוגל ונסו שוב.', en: 'Google gave no lasting access. Remove the app in your Google account settings and try again.' },
  not_configured: { he: 'החיבור לגוגל עדיין לא מוגדר בשרת.', en: 'The Google connection is not set up on the server yet.' },
  failed: { he: 'החיבור לגוגל נכשל. נסו שוב.', en: 'The Google connection failed. Try again.' },
};
// a failed connection names its step (the function's fixed codes): failed_token_<Google's error>, failed_profile_<status>, failed_store
function connectResultText(code, isHebrew) {
  if (CONNECT_RESULT[code]) return { good: CONNECT_RESULT[code].good === true, text: isHebrew ? CONNECT_RESULT[code].he : CONNECT_RESULT[code].en };
  if (!/^failed_(admin|token|profile|store)(_[a-z0-9_]+)?$/.test(code || '')) return null;
  const detail = code.replace(/^failed_[a-z]+_?/, '');
  const step = code.split('_')[1];
  const text = {
    admin: { he: 'החיבור נדחה: המשתמש שהתחיל אותו אינו מנהל על.', en: 'The connection was refused: the user who started it is not a super admin.' },
    token: { he: 'גוגל דחתה את פרטי לקוח החיבור בשרת (המזהה או הסוד). בדקו את שני הסודות של גוגל בשרת.', en: 'Google refused the connection client details on the server (the id or the secret). Check both Google secrets on the server.' },
    profile: { he: 'גוגל לא נתנה לקרוא את פרטי התיבה. נסו לחבר שוב.', en: 'Google did not allow reading the mailbox details. Try connecting again.' },
    store: { he: 'שמירת החיבור בשרת נכשלה.', en: 'Saving the connection on the server failed.' },
  }[step];
  return { good: false, text: `${isHebrew ? text.he : text.en}${detail ? ` (${isHebrew ? 'קוד' : 'code'}: ${detail})` : ''}` };
}

const SEND_CODES = {
  not_approved: { he: 'לא אושרה', en: 'not approved' }, no_expense_type: { he: 'חסר סוג הוצאה', en: 'no expense type' },
  missing_fields: { he: 'חסרים מספר, תאריך או סכום', en: 'missing number, date or amount' }, payplus_failed: { he: 'פיי פלוס דחו', en: 'PayPlus refused' },
  payplus_search_failed: { he: 'החיפוש בפיי פלוס נכשל', en: 'the PayPlus search failed' },
  rate_unavailable: { he: 'השער היציג של יום החשבונית לא נמצא', en: 'no representative rate for the invoice date' },
};
const N = ({ v }) => <bdi className="av-num">{v}</bdi>;
const money = (amount, currency) => (amount === null || amount === undefined || !currency ? '—'
  : `${QUOTE_CURRENCY_SYMBOLS[currency] || `${currency} `}${formatMoneyForCurrency(amount, currency)}`);

export default function AdminExpenseInvoices({ isHebrew }) {
  const market = ADMIN_DATE_MARKET; // IRON-DATE-001 admin amendment 2026-10-22: Israeli dates in every admin screen
  const [state, setState] = useState('loading');
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [edit, setEdit] = useState(null);
  const [typeDraft, setTypeDraft] = useState({ id: '', name: '', uuid: '' });
  const [googleLink, setGoogleLink] = useState(null);
  const [preview, setPreview] = useState(null);
  // the file preview's local copy is released when the screen closes
  useEffect(() => () => { if (preview?.src) URL.revokeObjectURL(preview.src); }, [preview]);

  useEffect(() => {
    // back from Google: the result the server put on the address (read only - the screen never navigates by itself)
    const r = new URLSearchParams(globalThis.location?.search || '').get('expenseConnect');
    const n = r ? connectResultText(r, isHebrew) : null;
    if (n) setNotice(n);
  }, [isHebrew]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(supabase.rpc('expense_invoices_admin_state')).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data || data.ok !== true) { setState('unavailable'); return; }
      setState(data);
      setUpdatedAt(new Date().toISOString());
    }).catch(() => { if (!cancelled) setState('unavailable'); });
    return () => { cancelled = true; };
  }, [refreshKey]);
  const reload = () => setRefreshKey((k) => k + 1);

  const call = useCallback(async (body) => {
    try {
      const { data, error } = await supabase.functions.invoke('expense-invoices', { body });
      if (!error && data) return data;
      // a non-2xx answer: the server's own code (for example google_not_configured / already_sent) is in the response body
      const answer = await error?.context?.json?.().catch(() => null);
      return answer && typeof answer === 'object' ? { ok: false, ...answer } : { ok: false, code: 'failed' };
    } catch { return { ok: false, code: 'failed' }; }
  }, []);
  const failed = () => setNotice({ good: false, text: isHebrew ? 'הפעולה נכשלה. שום דבר לא השתנה. נסו שוב.' : 'The action failed. Nothing changed. Try again.' });

  const connect = async (mailbox) => {
    setBusy(`connect:${mailbox}`);
    const r = await call({ action: 'connect', mailbox });
    setBusy('');
    // the Owner continues to Google himself with the link (the admin screen never navigates on its own)
    if (r.ok && typeof r.url === 'string' && r.url.startsWith('https://accounts.google.com/')) { setGoogleLink({ mailbox, url: r.url }); return; }
    if (r.code === 'google_not_configured') setNotice({ good: false, text: isHebrew ? CONNECT_RESULT.not_configured.he : CONNECT_RESULT.not_configured.en });
    else failed();
  };
  const disconnect = async (mailbox) => {
    setBusy(`disconnect:${mailbox}`);
    const r = await call({ action: 'disconnect', mailbox });
    setBusy('');
    if (!r.ok) failed();
    reload();
  };
  const scan = async () => {
    setBusy('scan');
    let processed = 0;
    let found = 0;
    let failedCount = 0;
    for (let round = 0; round < 40; round += 1) {
      const r = await call({ action: 'scan' });
      if (!r.ok) { failed(); break; }
      processed += r.processed || 0;
      found += r.found || 0;
      failedCount += r.failed || 0;
      const retry = Math.max(0, (r.errors || []).length - (r.failed || 0));
      const tail = isHebrew
        ? `${failedCount ? ` ${failedCount} מיילים לא נקראו גם אחרי 3 ניסיונות.` : ''}${retry ? ` ${retry} מיילים לא נקראו הפעם וינוסו שוב בסריקה הבאה.` : ''}`
        : `${failedCount ? ` ${failedCount} emails could not be read after 3 attempts.` : ''}${retry ? ` ${retry} emails were not read this time and will be tried again.` : ''}`;
      setNotice({ good: !failedCount && !retry, text: (isHebrew ? `נקראו ${processed} מיילים, נמצאו ${found} חשבוניות חדשות${r.remaining ? `, נשארו ${r.remaining}` : '. הסריקה הסתיימה.'}`
        : `${processed} emails read, ${found} new invoices found${r.remaining ? `, ${r.remaining} left` : '. The scan is complete.'}`) + tail });
      if (!r.remaining || !r.processed) break;
    }
    setBusy('');
    reload();
  };
  const setStatus = async (ids, status) => {
    if (!ids.length) return;
    setBusy('status');
    let allOk = true;
    for (let i = 0; i < ids.length; i += 200) {
      const r = await call({ action: 'update', ids: ids.slice(i, i + 200), patch: { status } });
      if (!r.ok) allOk = false;
    }
    setBusy('');
    if (!allOk) failed();
    reload();
  };
  const send = async (ids) => {
    setBusy('send');
    const results = [];
    // 10 at a time (the server's batch), every answer kept - a failed batch is reported, never hidden by a later one
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10);
      const r = await call({ action: 'send', ids: chunk });
      if (!r.ok) { results.push(...chunk.map((id) => ({ id, ok: false, code: r.code || 'failed' }))); continue; }
      results.push(...(r.results || []));
    }
    setBusy('');
    const good = results.filter((x) => x.ok).length;
    const bad = results.filter((x) => !x.ok);
    if (results.length) {
      setNotice({ good: bad.length === 0, text: isHebrew
        ? `נשלחו לפיי פלוס: ${good}.${bad.length ? ` לא נשלחו: ${bad.length} (${[...new Set(bad.map((b) => SEND_CODES[b.code]?.he || b.code))].join(', ')}).` : ''}`
        : `Sent to PayPlus: ${good}.${bad.length ? ` Not sent: ${bad.length} (${[...new Set(bad.map((b) => SEND_CODES[b.code]?.en || b.code))].join(', ')}).` : ''}` });
    }
    reload();
  };
  const openFile = async (id) => {
    // the file is shown inside this screen (a short signed link, fetched and shown in place - no new tab)
    setBusy(`file:${id}`);
    const r = await call({ action: 'file', id });
    try {
      if (!r.ok || !r.url) throw new Error('no_file');
      const res = await fetch(r.url);
      if (!res.ok) throw new Error('no_file');
      const blob = await res.blob();
      if (preview?.src) URL.revokeObjectURL(preview.src);
      setPreview({ id, src: URL.createObjectURL(blob), type: blob.type });
    } catch { failed(); }
    setBusy('');
  };
  const closePreview = () => { if (preview?.src) URL.revokeObjectURL(preview.src); setPreview(null); };
  const saveEdit = async () => {
    const amount = edit.amount === '' ? null : Number(edit.amount);
    const vat = Number(edit.vatPercentage);
    if ((amount !== null && !Number.isFinite(amount)) || !Number.isFinite(vat)) { failed(); return; }
    setBusy('edit');
    const r = await call({ action: 'update', id: edit.id, patch: {
      supplierName: edit.supplierName, docNumber: edit.docNumber, docDate: edit.docDate || null, amount, currency: edit.currency,
      amountIncludesVat: edit.amountIncludesVat, vatPercentage: vat, subcategoryId: edit.subcategoryId ? Number(edit.subcategoryId) : null, category: edit.category,
    } });
    setBusy('');
    if (!r.ok) { failed(); return; }
    setEdit(null);
    reload();
  };
  const saveTypes = async (types, def) => {
    setBusy('settings');
    const r = await call({ action: 'settings', expenseTypes: types, defaultSubcategoryId: def });
    setBusy('');
    if (!r.ok) failed();
    reload();
  };

  const data = state && typeof state === 'object' ? state : null;
  const invoices = data?.invoices || [];
  const types = data?.settings?.expenseTypes || [];
  const def = data?.settings?.defaultSubcategoryId ?? null;
  const current = TABS.find((x) => x.id === tab);
  const rows = invoices.filter((i) => current.statuses.includes(i.status));
  const count = (tb) => invoices.filter((i) => tb.statuses.includes(i.status)).length;
  const typeName = (id) => types.find((x) => x.id === id)?.name;
  const title = isHebrew ? 'חשבוניות הוצאה' : 'Expense invoices';

  return (
    <AdminScreenFrame
      title={title}
      subtitle={isHebrew ? 'חשבוניות ההוצאה משתי תיבות הדואר מ-28/07/2026: המערכת מוצאת אותן, אתם מאשרים, והן נשלחות להוצאות בפיי פלוס.'
        : 'Expense invoices from both mailboxes since 28/07/2026: the system finds them, you approve, and they are sent to PayPlus expenses.'}
      label={title}
      isHebrew={isHebrew}
      onRefresh={reload}
      refreshing={state === 'loading'}
      updatedAt={updatedAt}
      formatTime={(v) => formatShortDateTime(v, market)}
    >
      <div data-testid="admin-expense-invoices">
        {notice && <div className={`av-notice ${notice.good ? 'av-ok' : 'av-bad'} av-section`} role={notice.good ? 'status' : 'alert'} data-testid="expense-notice">{notice.text}</div>}
        {state === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
          : state === 'unavailable' ? <div className="av-notice av-bad" role="alert" data-testid="expense-unavailable">{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</div>
            : (
              <>
                <article className="av-card av-section" data-testid="expense-mailboxes">
                  <h3 className="av-label">{isHebrew ? 'תיבות הדואר (קריאה בלבד)' : 'Mailboxes (read only)'}</h3>
                  {EXPENSE_MAILBOXES.map((m) => {
                    const c = (data.connections || []).find((x) => x.mailbox === m);
                    return (
                      <div key={m} className="av-toolbar av-section" data-mailbox={m} style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                        <div>
                          <bdi dir="ltr" style={{ fontWeight: 600 }}>{m}</bdi>
                          <div className="av-muted av-small">
                            {c ? <>{isHebrew ? 'מחוברת מאז ' : 'Connected since '}<N v={formatShortDate(c.connectedAt, market)} />
                              {c.lastScanAt && <>{isHebrew ? ' · נסרקה לאחרונה ' : ' · last scan '}<N v={formatShortDateTime(c.lastScanAt, market)} /></>}</>
                              : (isHebrew ? 'לא מחוברת' : 'Not connected')}
                          </div>
                          {c?.lastError && <div className="av-bad av-small" role="alert">{c.lastError}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {/* PRODUCT_TRUTH_DECORATIVE: opens Google's read-only consent for this mailbox (the server builds the signed link) */}
                          <button type="button" className="av-btn av-primary" disabled={!!busy} onClick={() => connect(m)} data-testid={`expense-connect-${m}`}>
                            {c ? (isHebrew ? 'חיבור מחדש' : 'Reconnect') : (isHebrew ? 'חיבור' : 'Connect')}
                          </button>
                          {c && (
                            // PRODUCT_TRUTH_DECORATIVE: removes the stored Google access of this mailbox (the found invoices stay)
                            <button type="button" className="av-btn" disabled={!!busy} onClick={() => disconnect(m)} data-testid={`expense-disconnect-${m}`}>{isHebrew ? 'ניתוק' : 'Disconnect'}</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {googleLink && (
                    <div className="av-notice av-info av-section" role="status" data-testid="expense-google-link">
                      {isHebrew ? 'הקישור לגוגל מוכן עבור ' : 'The Google link is ready for '}<bdi dir="ltr">{googleLink.mailbox}</bdi>{isHebrew ? '. בחרו שם את התיבה הזו ואשרו קריאה בלבד.' : '. Choose this mailbox there and allow read-only access.'}{' '}
                      {/* PRODUCT_TRUTH_DECORATIVE: the Owner's own click to Google's read-only consent page (signed by the server, 15 minutes) */}
                      <a href={googleLink.url} rel="noopener noreferrer" className="av-btn av-primary" data-testid="expense-google-continue">{isHebrew ? 'המשך לגוגל' : 'Continue to Google'}</a>
                    </div>
                  )}
                  {/* PRODUCT_TRUTH_DECORATIVE: reads the connected mailboxes for new possible invoices (nothing is sent anywhere) */}
                  <button type="button" className="av-btn av-primary av-section" disabled={!!busy || !(data.connections || []).length} onClick={scan} data-testid="expense-scan">
                    {busy === 'scan' ? (isHebrew ? 'סורק...' : 'Scanning...') : (isHebrew ? 'סריקת התיבות' : 'Scan the mailboxes')}
                  </button>
                  <p className="av-muted av-small">{isHebrew ? 'בכל 1 לחודש התיבות נסרקות לבד, ותקבלו מייל כשיש חשבוניות חדשות לאישור.' : 'On the 1st of every month the mailboxes are scanned automatically, and you get an email when new invoices wait for approval.'}</p>
                  {/* L-22 (Owner 2026-10-28, "שער יציג לפי תאריך החשבונית בשליחה לפיי פלוס") */}
                  <p className="av-muted av-small" data-testid="expense-fx-note">{isHebrew ? 'חשבונית במטבע זר נשלחת לפיי פלוס בשקלים, לפי השער היציג של בנק ישראל ביום החשבונית. הסכום המקורי והשער נכתבים בתיאור ההוצאה.' : 'A foreign-currency invoice is sent to PayPlus in shekels, at the Bank of Israel representative rate of the invoice date. The original amount and the rate are written in the expense description.'}</p>
                </article>

                <article className="av-card av-section" data-testid="expense-types">
                  <h3 className="av-label">{isHebrew ? 'סוגי ההוצאה בפיי פלוס' : 'PayPlus expense types'}</h3>
                  <p className="av-muted av-small">{isHebrew ? 'פיי פלוס מחייבים סוג הוצאה לכל הוצאה. כל סוג: המספר שלו בפיי פלוס ושם. הסוג המסומן הוא ברירת המחדל.'
                    : 'PayPlus needs an expense type for every expense. Each type: its PayPlus number and a name. The marked type is the default.'}</p>
                  {types.length === 0 && <p className="av-warn av-small" data-testid="expense-types-empty">{isHebrew ? 'עדיין אין סוגי הוצאה, ולכן אי אפשר לשלוח לפיי פלוס.' : 'No expense types yet, so nothing can be sent to PayPlus.'}</p>}
                  {types.map((x) => (
                    <div key={x.id} className="av-toolbar" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="radio" name="expense-default-type" checked={def === x.id} onChange={() => saveTypes(types, x.id)} disabled={!!busy} />
                        {x.name} <N v={x.id} />{x.uuid && <span className="av-muted av-small">{isHebrew ? '(מזהה פיי פלוס שמור)' : '(PayPlus id saved)'}</span>}
                      </label>
                      {/* PRODUCT_TRUTH_DECORATIVE: removes this expense type from the tool's list (PayPlus itself is not changed) */}
                      <button type="button" className="av-btn" disabled={!!busy} onClick={() => saveTypes(types.filter((y) => y.id !== x.id), def === x.id ? null : def)}>{isHebrew ? 'הסרה' : 'Remove'}</button>
                    </div>
                  ))}
                  <div className="av-toolbar av-section" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <label className="av-field" style={{ inlineSize: 120 }}><span>{isHebrew ? 'מספר בפיי פלוס' : 'PayPlus number'}</span><input inputMode="numeric" dir="ltr"
                      value={typeDraft.id} onChange={(e) => setTypeDraft({ ...typeDraft, id: e.target.value.replace(/\D/g, '') })} /></label>
                    <label className="av-field" style={{ inlineSize: 200 }}><span>{isHebrew ? 'שם הסוג' : 'Type name'}</span><input value={typeDraft.name}
                      onChange={(e) => setTypeDraft({ ...typeDraft, name: e.target.value })} /></label>
                    {/* L-22 (Owner 2026-10-28, "שמירת מזהי סוגי ההוצאה של פיי פלוס בהגדרות הכלי"): the type's PayPlus id (optional) */}
                    <label className="av-field" style={{ inlineSize: 320 }}><span>{isHebrew ? 'מזהה הסוג בפיי פלוס (לא חובה)' : 'PayPlus type id (optional)'}</span><input dir="ltr"
                      value={typeDraft.uuid || ''} data-testid="expense-type-uuid" onChange={(e) => setTypeDraft({ ...typeDraft, uuid: e.target.value.trim() })} /></label>
                    {/* PRODUCT_TRUTH_DECORATIVE: adds an expense type to the tool's list (PayPlus itself is not changed) */}
                    <button type="button" className="av-btn" disabled={!!busy || !typeDraft.id || !typeDraft.name.trim()} data-testid="expense-type-add"
                      onClick={() => { saveTypes([...types, { id: Number(typeDraft.id), name: typeDraft.name.trim(), ...(typeDraft.uuid ? { uuid: typeDraft.uuid } : {}) }], def ?? Number(typeDraft.id)); setTypeDraft({ id: '', name: '', uuid: '' }); }}>
                      {isHebrew ? 'הוספה' : 'Add'}
                    </button>
                  </div>
                </article>

                <article className="av-card av-section">
                  <div className="av-pills" role="group" aria-label={isHebrew ? 'מצב' : 'Status'}>
                    {TABS.map((x) => (
                      // PRODUCT_TRUTH_DECORATIVE: chooses which invoices are listed (read-only)
                      <button key={x.id} type="button" className="av-pill" style={{ gap: 6 }} aria-pressed={tab === x.id} onClick={() => setTab(x.id)} data-testid={`expense-tab-${x.id}`}>
                        {isHebrew ? x.he : x.en} <N v={count(x)} />
                      </button>
                    ))}
                  </div>
                  {tab === 'pending' && rows.length > 0 && (
                    // PRODUCT_TRUTH_DECORATIVE: approves every invoice in this list (nothing is sent until "Send to PayPlus")
                    <button type="button" className="av-btn av-primary av-section" disabled={!!busy} onClick={() => setStatus(rows.filter((r) => r.confidence !== 'low').map((r) => r.id), 'approved')} data-testid="expense-approve-all">
                      {isHebrew ? 'אישור כל הממתינות (בלי הלא בטוחות)' : 'Approve all waiting (not the uncertain ones)'}
                    </button>
                  )}
                  {tab === 'approved' && rows.length > 0 && (
                    // PRODUCT_TRUTH_DECORATIVE: sends the approved invoices to PayPlus expenses (the server searches PayPlus first - never twice)
                    <button type="button" className="av-btn av-primary av-section" disabled={!!busy || types.length === 0} onClick={() => send(rows.map((r) => r.id))} data-testid="expense-send">
                      {busy === 'send' ? (isHebrew ? 'שולח...' : 'Sending...') : (isHebrew ? 'שליחה לפיי פלוס' : 'Send to PayPlus')}
                    </button>
                  )}
                  {rows.length === 0 ? <p className="av-muted av-section" role="status" data-testid="expense-empty">{isHebrew ? 'אין חשבוניות ברשימה הזו.' : 'No invoices in this list.'}</p> : (
                    <div className="av-section" data-testid="expense-list">
                      {rows.map((r) => (
                        <div key={r.id} className="av-card av-section" data-invoice={r.id} data-status={r.status}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <strong>{r.supplierName || (isHebrew ? 'ספק לא ידוע' : 'Unknown supplier')}</strong>
                            <strong><N v={money(r.amount, r.currency)} /></strong>
                          </div>
                          <div className="av-muted av-small">
                            {r.docDate ? <N v={formatShortDate(r.docDate, market)} /> : (isHebrew ? 'בלי תאריך' : 'No date')}
                            {' · '}{isHebrew ? 'מסמך ' : 'Document '}<bdi dir="ltr">{r.docNumber || '—'}</bdi>
                            {' · '}{r.amountIncludesVat ? (isHebrew ? <>כולל מע"מ <N v={`${r.vatPercentage}%`} /></> : <>VAT included <N v={`${r.vatPercentage}%`} /></>) : (isHebrew ? 'ללא מע"מ' : 'No VAT')}
                            {' · '}{(EXPENSE_CATEGORY_LABELS[r.category] || EXPENSE_CATEGORY_LABELS.other)[isHebrew ? 'he' : 'en']}
                            {r.subcategoryId ? <>{' · '}{typeName(r.subcategoryId) || r.subcategoryId}</> : null}
                          </div>
                          {r.reason && <div className="av-small">{r.reason}</div>}
                          <div className="av-muted av-tiny">{isHebrew ? 'מאת ' : 'From '}<bdi dir="ltr">{r.emailFrom || '—'}</bdi> · <bdi dir="ltr">{r.mailbox}</bdi>{r.emailSubject ? <> · <bdi>{r.emailSubject}</bdi></> : null}</div>
                          {r.status === 'send_failed' && r.sendError && <div className="av-bad av-small" role="alert">{isHebrew ? 'לא נשלח: ' : 'Not sent: '}<bdi>{r.sendError}</bdi></div>}
                          {r.status === 'sending' && <div className="av-warn av-small" role="status">{isHebrew ? 'בשליחה לפיי פלוס. אם זה נשאר כך, בדקו בפיי פלוס אם ההוצאה נוצרה.' : 'Being sent to PayPlus. If it stays like this, check in PayPlus whether the expense was created.'}</div>}
                          {!r.hasFile && <div className="av-warn av-small">{isHebrew ? 'אין קובץ במייל - החשבונית בגוף המייל או בקישור אצל הספק.' : 'No file in the email - the invoice is in the email body or behind a link at the supplier.'}</div>}
                          <div className="av-row-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBlockStart: 8 }}>
                            {r.hasFile && (
                              // PRODUCT_TRUTH_DECORATIVE: opens the invoice file through a short signed link (read-only)
                              <button type="button" className="av-btn" disabled={!!busy} onClick={() => (preview?.id === r.id ? closePreview() : openFile(r.id))} data-testid={`expense-file-${r.id}`}>
                                {preview?.id === r.id ? (isHebrew ? 'סגירת הקובץ' : 'Close the file') : (isHebrew ? 'הקובץ' : 'File')}
                              </button>
                            )}
                            {r.status !== 'sent' && r.status !== 'sending' && (
                              <>
                                {r.status !== 'approved' && r.status !== 'send_failed' && (
                                  // PRODUCT_TRUTH_DECORATIVE: approves this invoice (it is sent only with "Send to PayPlus")
                                  <button type="button" className="av-btn av-primary" disabled={!!busy} onClick={() => setStatus([r.id], 'approved')} data-testid={`expense-approve-${r.id}`}>{isHebrew ? 'אישור' : 'Approve'}</button>
                                )}
                                {r.status !== 'rejected' && (
                                  // PRODUCT_TRUTH_DECORATIVE: rejects this invoice (kept in the "Rejected" list)
                                  <button type="button" className="av-btn" disabled={!!busy} onClick={() => setStatus([r.id], 'rejected')} data-testid={`expense-reject-${r.id}`}>{isHebrew ? 'דחייה' : 'Reject'}</button>
                                )}
                                {r.status !== 'pending' && (
                                  // PRODUCT_TRUTH_DECORATIVE: moves this invoice back to "Waiting for approval"
                                  <button type="button" className="av-btn" disabled={!!busy} onClick={() => setStatus([r.id], 'pending')}>{isHebrew ? 'החזרה לממתינות' : 'Back to waiting'}</button>
                                )}
                                {/* PRODUCT_TRUTH_DECORATIVE: opens the correction form of this invoice */}
                                <button type="button" className="av-btn" disabled={!!busy} onClick={() => setEdit({ id: r.id, supplierName: r.supplierName || '', docNumber: r.docNumber || '', docDate: r.docDate || '',
                                  amount: r.amount ?? '', currency: r.currency || 'ILS', amountIncludesVat: !!r.amountIncludesVat, vatPercentage: r.vatPercentage ?? 0,
                                  subcategoryId: r.subcategoryId ?? '', category: r.category || 'other' })} data-testid={`expense-edit-${r.id}`}>{isHebrew ? 'תיקון' : 'Correct'}</button>
                              </>
                            )}
                          </div>
                          {preview?.id === r.id && (
                            <div className="av-section" data-testid="expense-file-preview">
                              {preview.type.startsWith('image/')
                                ? <img src={preview.src} alt={isHebrew ? 'החשבונית' : 'The invoice'} style={{ maxInlineSize: '100%', borderRadius: 8 }} />
                                : <iframe src={preview.src} title={isHebrew ? 'החשבונית' : 'The invoice'} style={{ inlineSize: '100%', blockSize: '70vh', border: '1px solid #e2e8f0', borderRadius: 8 }} />}
                            </div>
                          )}
                          {edit?.id === r.id && (
                            <div className="av-section" data-testid="expense-edit-form" style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                              <label className="av-field"><span>{isHebrew ? 'ספק' : 'Supplier'}</span><input value={edit.supplierName} onChange={(e) => setEdit({ ...edit, supplierName: e.target.value })} /></label>
                              <label className="av-field"><span>{isHebrew ? 'מספר מסמך' : 'Document number'}</span><input dir="ltr" value={edit.docNumber} onChange={(e) => setEdit({ ...edit, docNumber: e.target.value })} /></label>
                              <label className="av-field"><span>{isHebrew ? 'תאריך' : 'Date'}</span><input type="date" value={edit.docDate} onChange={(e) => setEdit({ ...edit, docDate: e.target.value })} /></label>
                              <label className="av-field"><span>{isHebrew ? 'סכום כולל' : 'Total amount'}</span><input dir="ltr" inputMode="decimal" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></label>
                              <label className="av-field"><span>{isHebrew ? 'מטבע' : 'Currency'}</span>
                                <select value={edit.currency} onChange={(e) => setEdit({ ...edit, currency: e.target.value })}>
                                  {['ILS', 'USD', 'EUR', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </label>
                              <label className="av-small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input type="checkbox" checked={edit.amountIncludesVat} onChange={(e) => setEdit({ ...edit, amountIncludesVat: e.target.checked, vatPercentage: e.target.checked ? 18 : 0 })} />
                                {isHebrew ? 'כולל מע"מ' : 'Includes VAT'}
                              </label>
                              <label className="av-field"><span>{isHebrew ? 'סוג הוצאה בפיי פלוס' : 'PayPlus expense type'}</span>
                                <select value={edit.subcategoryId} onChange={(e) => setEdit({ ...edit, subcategoryId: e.target.value })}>
                                  <option value="">{isHebrew ? 'ברירת המחדל' : 'The default'}</option>
                                  {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                                </select>
                              </label>
                              <label className="av-field"><span>{isHebrew ? 'קטגוריה' : 'Category'}</span>
                                <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{isHebrew ? v.he : v.en}</option>)}
                                </select>
                              </label>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
                                {/* PRODUCT_TRUTH_DECORATIVE: saves the corrections of this invoice (not sent anywhere) */}
                                <button type="button" className="av-btn av-primary" disabled={!!busy} onClick={saveEdit} data-testid="expense-edit-save">{isHebrew ? 'שמירה' : 'Save'}</button>
                                {/* PRODUCT_TRUTH_DECORATIVE: closes the correction form without saving */}
                                <button type="button" className="av-btn" onClick={() => setEdit(null)}>{isHebrew ? 'ביטול' : 'Cancel'}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </>
            )}
      </div>
    </AdminScreenFrame>
  );
}
