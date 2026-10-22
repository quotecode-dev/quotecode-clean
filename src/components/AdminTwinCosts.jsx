// Owner console 2026-10-23, typed approval of L-22 for "מסך עלויות בדיקת הלקוח בניהול": the Customer Twin cost view (Codex review CT-14).
// Reads customer_twin_admin_usage (super admin only, server-checked): per Israel day - checks stored / given back, accounts, tokens and the
// estimated provider cost in USD. Numbers only: never quote content, never an account. Read-only.
import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import { formatShortDate, formatShortDateTime } from '../utils/shortDate';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import './adminUsers.css';
import './adminV2.css';

const PERIODS = [7, 30, 90];
const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const usd = (v) => `$${(Number.isFinite(Number(v)) ? Number(v) : 0).toFixed(4)}`;
const N = ({ v }) => <bdi className="av-num">{v}</bdi>;

export default function AdminTwinCosts({ isHebrew }) {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const market = isHebrew ? 'Local' : 'International';

  useEffect(() => {
    let cancelled = false;
    setRows('loading');
    Promise.resolve(supabase.rpc('customer_twin_admin_usage', { p_days: days })).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data || data.ok !== true || !Array.isArray(data.days)) { setRows('unavailable'); return; }
      setRows(data.days);
      setUpdatedAt(new Date().toISOString());
    }).catch(() => { if (!cancelled) setRows('unavailable'); });
    return () => { cancelled = true; };
  }, [days, refreshKey]);

  const list = Array.isArray(rows) ? rows : [];
  const sum = (k) => list.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const kpis = [
    { key: 'stored', he: 'בדיקות שהושלמו', en: 'Checks completed', value: int(sum('stored')) },
    { key: 'refunded', he: 'בדיקות שהוחזרו', en: 'Checks given back', value: int(sum('refunded')) },
    { key: 'tokens', he: 'מילים שעובדו (טוקנים)', en: 'Tokens processed', value: group(int(sum('promptTokens') + sum('completionTokens'))) },
    { key: 'cost', he: 'עלות משוערת', en: 'Estimated cost', value: usd(sum('estimatedCostUsd')) },
  ];
  const title = isHebrew ? 'עלויות בדיקת הלקוח' : 'Customer check costs';

  return (
    <AdminScreenFrame
      title={title}
      subtitle={isHebrew ? 'כמה בדיקות רצו וכמה הן עלו לנו אצל ספק הבינה. מספרים בלבד, בלי תוכן ההצעות ובלי פרטי חשבונות.'
        : 'How many checks ran and what they cost us at the AI provider. Numbers only - no quote content, no account details.'}
      label={title}
      isHebrew={isHebrew}
      onRefresh={() => setRefreshKey((k) => k + 1)}
      refreshing={rows === 'loading'}
      updatedAt={updatedAt}
      formatTime={(v) => formatShortDateTime(v, market)}
    >
      <article className="av-card" data-testid="admin-twin-costs">
        <div className="av-pills" role="group" aria-label={isHebrew ? 'תקופה' : 'Period'}>
          {PERIODS.map((p) => (
            // PRODUCT_TRUTH_DECORATIVE: chooses the period of the Customer Twin cost view (read-only)
            <button key={p} type="button" className="av-pill" aria-pressed={days === p} onClick={() => setDays(p)} data-testid={`admin-twin-costs-period-${p}`}>
              {isHebrew ? <><N v={p} /> ימים אחרונים</> : <>Last <N v={p} /> days</>}
            </button>
          ))}
        </div>

        {rows === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
          : rows === 'unavailable' ? <div className="av-notice av-bad" role="alert" data-testid="admin-twin-costs-unavailable">{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</div>
            : (
              <>
                <div className="av-grid av-kpis av-section" data-testid="admin-twin-costs-kpis">
                  {kpis.map((k) => (
                    <div key={k.key} className="av-card av-accent-top" data-kpi={k.key}>
                      <div className="av-label">{isHebrew ? k.he : k.en}</div>
                      <div className="av-kpi-value" data-testid={`admin-twin-costs-kpi-${k.key}`}>{k.value}</div>
                    </div>
                  ))}
                </div>
                {list.length === 0 ? <p className="av-muted av-section" role="status" data-testid="admin-twin-costs-empty">{isHebrew ? 'עדיין לא רצו בדיקות בתקופה הזו.' : 'No checks ran in this period yet.'}</p> : (
                  <div className="av-tablewrap av-section">
                    <table data-testid="admin-twin-costs-table">
                      <caption>{isHebrew ? 'לפי יום (שעון ישראל). העלות לפי מחירון הספק, בדולרים.' : 'By day (Israel time). Cost at the provider list price, in US dollars.'}</caption>
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
