// Owner console 2026-10-23, typed approval of L-22: "סקירה שבועית אוטומטית של תקלות ובקשות שיפור מהמיילים, עם רשימה בלשונית פניות ומייל
// סיכום". The lasting list of the weekly reviews, opened from the "פניות" tab: every bug / improvement request the AI merged from the week's
// support emails, with its priority, how many emails reported it and a status the Owner sets (new / in progress / fixed / dismissed).
// Reads support_review_admin_list(), changes a status through support_review_set_status() (both super admin only); "run now" calls the
// support-weekly-review function (super admin; once a day). Dates in the Israeli admin format (IRON-DATE-001 admin amendment).
import { useCallback, useEffect, useState } from 'react';
import { ListChecks, X } from 'lucide-react';
import { supabase } from '../shared/supabase';
import { formatShortDate } from '../utils/shortDate';
import { ADMIN_DATE_MARKET } from '../utils/adminDates';

const STATUSES = ['new', 'in_progress', 'fixed', 'dismissed'];
const STATUS_LABEL = {
  new: { he: 'חדש', en: 'New' }, in_progress: { he: 'בטיפול', en: 'In progress' },
  fixed: { he: 'תוקן', en: 'Fixed' }, dismissed: { he: 'לא רלוונטי', en: 'Dismissed' },
};
const KIND_LABEL = { bug: { he: 'תקלה', en: 'Bug' }, request: { he: 'בקשת שיפור', en: 'Request' } };
const N = ({ v }) => <bdi dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</bdi>;

export default function AdminWeeklyReview({ isHebrew = true, canRun = true }) {
  const L = (x) => (isHebrew ? x.he : x.en);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState('loading');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(() => {
    setData('loading');
    Promise.resolve().then(() => supabase.rpc('support_review_admin_list')).then(({ data: d, error }) => {
      setData(error || !d || d.ok !== true ? 'unavailable' : d);
    }).catch(() => setData('unavailable'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const items = data && typeof data === 'object' ? data.items || [] : [];
  const openItems = items.filter((i) => i.status === 'new' || i.status === 'in_progress');
  const shown = showClosed ? items : openItems;
  const last = data && typeof data === 'object' ? (data.weeks || [])[0] : null;

  const setStatus = async (id, status) => {
    setBusy(id);
    const { data: r, error } = await Promise.resolve().then(() => supabase.rpc('support_review_set_status', { p_id: id, p_status: status })).catch(() => ({ error: true }));
    setBusy('');
    if (error || !r?.ok) setNotice({ good: false, text: isHebrew ? 'השינוי לא נשמר. נסו שוב.' : 'The change was not saved. Try again.' });
    load();
  };
  const runNow = async () => {
    setBusy('run');
    let r;
    try {
      const { data: d, error } = await supabase.functions.invoke('support-weekly-review', { body: { action: 'run' } });
      r = error ? await error?.context?.json?.().catch(() => null) : d;
    } catch { r = null; }
    setBusy('');
    if (r?.ok) setNotice({ good: true, text: isHebrew ? `הסקירה הסתיימה: נקראו ${r.inquiries} פניות ונמצאו ${r.items} פריטים. מייל סיכום נשלח.` : `Review done: ${r.inquiries} emails read, ${r.items} items found. A summary email was sent.` });
    else if (r?.skipped === 'already_reviewed') setNotice({ good: true, text: isHebrew ? 'כבר נעשתה סקירה היום.' : 'A review already ran today.' });
    else setNotice({ good: false, text: isHebrew ? 'הסקירה לא הושלמה. נסו שוב מאוחר יותר.' : 'The review did not complete. Try again later.' });
    load();
  };

  return (
    <>
      {/* PRODUCT_TRUTH_DECORATIVE: opens the weekly review list (read; statuses change only inside it) */}
      <button type="button" className="admin-inquiry-settings-btn" onClick={() => setOpen(true)} data-testid="inquiries-weekly-review">
        <ListChecks size={15} />{isHebrew ? 'סקירה שבועית' : 'Weekly review'}
        {openItems.length > 0 && <span className="admin-count-pill" data-testid="weekly-review-open-count"><N v={openItems.length} /></span>}
      </button>
      {open && (
        // PRODUCT_TRUTH_DECORATIVE: clicking the dialog backdrop closes the weekly review list
        <div className="admin-dialog-backdrop" onClick={() => setOpen(false)}>
          {/* PRODUCT_TRUTH_DECORATIVE: stops click propagation inside the weekly review dialog */}
          <section role="dialog" aria-modal="true" aria-label={isHebrew ? 'סקירה שבועית' : 'Weekly review'} data-testid="weekly-review-dialog" className="admin-action-dialog"
            style={{ maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()} dir={isHebrew ? 'rtl' : 'ltr'}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ListChecks size={20} color="#0F6672" />{isHebrew ? 'סקירה שבועית' : 'Weekly review'}
              {/* PRODUCT_TRUTH_DECORATIVE: X button closes the weekly review dialog */}
              <button type="button" className="admin-icon-button" style={{ marginInlineStart: 'auto' }} aria-label={isHebrew ? 'סגירה' : 'Close'} onClick={() => setOpen(false)}><X size={16} /></button>
            </h2>
            <p>{isHebrew ? 'כל יום ראשון ב-20:00 הבינה עוברת על הפניות של השבוע, מאחדת כפילויות ומדרגת את התקלות ובקשות השיפור. אתם מסמנים מה בטיפול ומה תוקן.'
              : 'Every Sunday at 20:00 Israel time the AI reads the week\'s emails, merges duplicates and ranks the bugs and requests. You mark what is in progress and what is fixed.'}</p>
            {last && <p style={{ fontSize: 12, color: '#64748b' }}>{isHebrew ? 'הסקירה האחרונה: ' : 'Last review: '}<N v={formatShortDate(last.week, ADMIN_DATE_MARKET)} />
              {isHebrew ? ' · נקראו ' : ' · '}<N v={last.inquiries} />{isHebrew ? ' פניות' : ' emails read'}</p>}
            {notice && <p role={notice.good ? 'status' : 'alert'} data-testid="weekly-review-notice" style={{ color: notice.good ? '#065f46' : '#b91c1c', fontWeight: 600 }}>{notice.text}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlock: 8 }}>
              {canRun && (
                // PRODUCT_TRUTH_DECORATIVE: runs the review of the last 7 days now (super admin; once a day; emails the Owner)
                <button type="button" className="admin-btn primary" disabled={!!busy} onClick={runNow} data-testid="weekly-review-run">{busy === 'run' ? (isHebrew ? 'סוקר...' : 'Reviewing...') : (isHebrew ? 'סקירה עכשיו' : 'Review now')}</button>
              )}
              {/* PRODUCT_TRUTH_DECORATIVE: shows or hides the items already fixed or dismissed (read-only) */}
              <button type="button" className="admin-btn" onClick={() => setShowClosed((v) => !v)} data-testid="weekly-review-toggle-closed">{showClosed ? (isHebrew ? 'רק הפתוחים' : 'Open only') : (isHebrew ? 'הצגת הכול' : 'Show all')}</button>
            </div>
            {data === 'loading' ? <p role="status">{isHebrew ? 'טוען...' : 'Loading...'}</p>
              : data === 'unavailable' ? <p role="alert" data-testid="weekly-review-unavailable">{isHebrew ? 'לא הצלחנו לטעון את הסקירה. נסו שוב.' : 'The review could not be loaded. Try again.'}</p>
                : shown.length === 0 ? <p data-testid="weekly-review-empty">{isHebrew ? 'אין פריטים פתוחים.' : 'No open items.'}</p>
                  : (
                    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }} data-testid="weekly-review-list">
                      {shown.map((i) => (
                        <li key={i.id} data-item={i.id} data-status={i.status} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                            <strong>{i.title}</strong>
                            <span style={{ fontSize: 12, color: i.kind === 'bug' ? '#b91c1c' : '#1d4ed8' }}>{L(KIND_LABEL[i.kind])}</span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>{isHebrew ? 'עדיפות ' : 'Priority '}<N v={i.priority} />{isHebrew ? ' · פניות: ' : ' · emails: '}<N v={i.count} />{' · '}<N v={formatShortDate(i.week, ADMIN_DATE_MARKET)} /></span>
                          </div>
                          <p dir="auto" style={{ margin: '4px 0 8px', fontSize: 13 }}>{i.summary}</p>
                          <div role="group" aria-label={isHebrew ? 'מצב' : 'Status'} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {STATUSES.map((s) => (
                              // PRODUCT_TRUTH_DECORATIVE: sets this item's status (super admin, server-checked)
                              <button key={s} type="button" className={i.status === s ? 'admin-btn primary' : 'admin-btn'} aria-pressed={i.status === s} disabled={!!busy || i.status === s}
                                onClick={() => setStatus(i.id, s)} data-testid={`weekly-review-status-${i.id}-${s}`}>{L(STATUS_LABEL[s])}</button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
          </section>
        </div>
      )}
    </>
  );
}
