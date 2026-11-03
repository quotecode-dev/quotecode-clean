// Owner console 2026-10-23, typed approval of L-22 for "מסך עלויות בדיקת הלקוח בניהול": the Customer Twin cost view (Codex review CT-14).
// Reads customer_twin_admin_usage (super admin only, server-checked): per Israel day - checks stored / given back, accounts, tokens and the
// estimated provider cost in USD. Numbers only: never quote content, never an account. Read-only.
import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import { formatShortDate, formatShortDateTime } from '../utils/shortDate';
import { ADMIN_DATE_MARKET } from '../utils/adminDates';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import './adminUsers.css';
import './adminV2.css';

const PERIODS = [7, 30, 90];
const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const usd = (v) => `$${(Number.isFinite(Number(v)) ? Number(v) : 0).toFixed(4)}`;
const N = ({ v }) => <bdi className="av-num">{v}</bdi>;

// Owner console 2026-11-03 (typed: "מאשר תיקון כל אזכורי הצעת מחיר מקובץ לפי התוכנית (... מסך ניהול ...), כולל שינוי ב-L-05, L-06, L-11,
// L-12, L-14, L-17 ו-L-22"): the same view for "quote from a file" reads (quote_file_admin_usage, migration 20261103300000) - its own words
const KINDS = {
  twin: {
    rpc: 'customer_twin_admin_usage', testid: 'admin-twin-costs',
    title: { he: 'עלויות בדיקת הלקוח', en: 'Customer check costs' },
    subtitle: { he: 'כמה בדיקות רצו וכמה הן עלו לנו אצל ספק הבינה. מספרים בלבד, בלי תוכן ההצעות ובלי פרטי חשבונות.', en: 'How many checks ran and what they cost us at the AI provider. Numbers only - no quote content, no account details.' },
    stored: { he: 'בדיקות שהושלמו', en: 'Checks completed' }, refunded: { he: 'בדיקות שהוחזרו', en: 'Checks given back' },
    empty: { he: 'עדיין לא רצו בדיקות בתקופה הזו.', en: 'No checks ran in this period yet.' },
    caption: { he: 'לפי יום (שעון ישראל). העלות לפי מחירון הספק, בדולרים.', en: 'By day (Israel time). Cost at the provider list price, in US dollars.' },
  },
  file: {
    rpc: 'quote_file_admin_usage', testid: 'admin-file-costs',
    title: { he: 'עלויות הצעת מחיר מקובץ', en: 'Quote from a file costs' },
    subtitle: { he: 'כמה קבצים נקראו וכמה הם עלו לנו אצל ספק הבינה. מספרים בלבד, בלי הקבצים, בלי השורות ובלי פרטי חשבונות.', en: 'How many files were read and what they cost us at the AI provider. Numbers only - no files, no lines, no account details.' },
    stored: { he: 'קבצים שנקראו', en: 'Files read' }, refunded: { he: 'קריאות שהוחזרו', en: 'Reads given back' },
    empty: { he: 'עדיין לא נקראו קבצים בתקופה הזו.', en: 'No files were read in this period yet.' },
    caption: { he: 'לפי יום (שעון ישראל). העלות כפי שנרשמה בכל קריאה, בדולרים.', en: 'By day (Israel time). Cost as recorded on each read, in US dollars.' },
  },
};

export default function AdminTwinCosts({ isHebrew, kind = 'twin' }) {
  const K = KINDS[kind] || KINDS.twin;
  const L = (o) => (isHebrew ? o.he : o.en);
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const market = ADMIN_DATE_MARKET; // IRON-DATE-001 admin amendment 2026-10-22: Israeli dates in every admin screen

  useEffect(() => {
    let cancelled = false;
    setRows('loading');
    Promise.resolve(supabase.rpc(K.rpc, { p_days: days })).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data || data.ok !== true || !Array.isArray(data.days)) { setRows('unavailable'); return; }
      setRows(data.days);
      setUpdatedAt(new Date().toISOString());
    }).catch(() => { if (!cancelled) setRows('unavailable'); });
    return () => { cancelled = true; };
  }, [days, refreshKey, K.rpc]);

  const list = Array.isArray(rows) ? rows : [];
  const sum = (k) => list.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const kpis = [
    { key: 'stored', ...K.stored, value: int(sum('stored')) },
    { key: 'refunded', ...K.refunded, value: int(sum('refunded')) },
    { key: 'tokens', he: 'מילים שעובדו (טוקנים)', en: 'Tokens processed', value: group(int(sum('promptTokens') + sum('completionTokens'))) },
    { key: 'cost', he: 'עלות משוערת', en: 'Estimated cost', value: usd(sum('estimatedCostUsd')) },
  ];
  const title = L(K.title);
  const id = K.testid;

  return (
    <AdminScreenFrame
      title={title}
      subtitle={L(K.subtitle)}
      label={title}
      isHebrew={isHebrew}
      onRefresh={() => setRefreshKey((k) => k + 1)}
      refreshing={rows === 'loading'}
      updatedAt={updatedAt}
      formatTime={(v) => formatShortDateTime(v, market)}
    >
      <article className="av-card" data-testid={id}>
        <div className="av-pills" role="group" aria-label={isHebrew ? 'תקופה' : 'Period'}>
          {PERIODS.map((p) => (
            // PRODUCT_TRUTH_DECORATIVE: chooses the period of the Customer Twin cost view (read-only)
            <button key={p} type="button" className="av-pill" aria-pressed={days === p} onClick={() => setDays(p)} data-testid={`${id}-period-${p}`}>
              {isHebrew ? <><N v={p} /> ימים אחרונים</> : <>Last <N v={p} /> days</>}
            </button>
          ))}
        </div>

        {rows === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
          : rows === 'unavailable' ? <div className="av-notice av-bad" role="alert" data-testid={`${id}-unavailable`}>{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</div>
            : (
              <>
                <div className="av-grid av-kpis av-section" data-testid={`${id}-kpis`}>
                  {kpis.map((k) => (
                    <div key={k.key} className="av-card av-accent-top" data-kpi={k.key}>
                      <div className="av-label">{isHebrew ? k.he : k.en}</div>
                      <div className="av-kpi-value" data-testid={`${id}-kpi-${k.key}`}>{k.value}</div>
                    </div>
                  ))}
                </div>
                {list.length === 0 ? <p className="av-muted av-section" role="status" data-testid={`${id}-empty`}>{L(K.empty)}</p> : (
                  <div className="av-tablewrap av-section">
                    <table data-testid={`${id}-table`}>
                      <caption>{L(K.caption)}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{isHebrew ? 'יום' : 'Day'}</th>
                          <th scope="col">{isHebrew ? 'הושלמו' : 'Completed'}</th>
                          <th scope="col">{isHebrew ? 'הוחזרו' : 'Given back'}</th>
                          <th scope="col">{isHebrew ? 'חשבונות' : 'Accounts'}</th>
                          <th scope="col">{isHebrew ? 'טוקנים' : 'Tokens'}</th>
                          <th scope="col">{isHebrew ? 'עלות משוערת' : 'Estimated cost'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((r) => (
                          <tr key={r.day} data-day={r.day}>
                            <td><N v={formatShortDate(r.day, market)} /></td>
                            <td><N v={int(r.stored)} /></td>
                            <td><N v={int(r.refunded)} /></td>
                            <td><N v={int(r.accounts)} /></td>
                            <td><N v={group(int(r.promptTokens) + int(r.completionTokens))} /></td>
                            <td><N v={usd(r.estimatedCostUsd)} /></td>
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
