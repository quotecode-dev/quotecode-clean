// Owner console 2026-11-06 (typed night-task approval incl. L-22: "אצלך בניהול: מסך אחד שמציג את העלות האמיתית לכל משתמש ולכל יכולת"):
// the SMART PACK usage meter cost view. Reads smart_pack_usage_admin (super admin only, server-checked): per Israel day and feature the
// actions counted / given back, accounts, tokens and the real provider cost (ILS at the meter's rate, and USD); per account this month
// its email, actions, ILS and the share of the 4 ILS budget used. Numbers only: never any content. Read-only.
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
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const ils = (v) => `₪${num(v).toFixed(2)}`;
const usd = (v) => `$${num(v).toFixed(4)}`;
const pct = (v) => `${num(v).toFixed(1)}%`;
const N = ({ v }) => <bdi className="av-num">{v}</bdi>;
const FEATURES = {
  chat_data: { he: 'צ׳אט שקורא נתונים', en: 'Chat reading data' },
  voice: { he: 'קול', en: 'Voice' },
  ai_draft: { he: 'הצעה / עריכה חכמה', en: 'Smart quote / edit' },
  file_quote: { he: 'הצעת מחיר מקובץ', en: 'Quote from a file' },
  customer_twin: { he: 'שיפור ההצעה', en: 'Improve quote' },
};

export default function AdminSmartPackUsage({ isHebrew }) {
  const L = (o) => (isHebrew ? o.he : o.en);
  const [days, setDays] = useState(30);
  const [data, setData] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const market = ADMIN_DATE_MARKET;

  useEffect(() => {
    let cancelled = false;
    setData('loading');
    Promise.resolve(supabase.rpc('smart_pack_usage_admin', { p_days: days })).then(({ data: d, error }) => {
      if (cancelled) return;
      if (error || !d || d.ok !== true || !Array.isArray(d.days) || !Array.isArray(d.accounts)) { setData('unavailable'); return; }
      setData(d);
      setUpdatedAt(new Date().toISOString());
    }).catch(() => { if (!cancelled) setData('unavailable'); });
    return () => { cancelled = true; };
  }, [days, refreshKey]);

  const ok = data && typeof data === 'object';
  const list = ok ? data.days : [];
  const accounts = ok ? data.accounts : [];
  const sum = (k) => list.reduce((a, r) => a + num(r[k]), 0);
  const kpis = [
    { key: 'stored', he: 'פעולות שנספרו', en: 'Actions counted', value: group(int(sum('stored'))) },
    { key: 'cost-ils', he: 'עלות בתקופה', en: 'Cost in the period', value: ils(sum('costIls')) },
    { key: 'cost-usd', he: 'עלות בדולרים', en: 'Cost in US dollars', value: usd(sum('costUsd')) },
    { key: 'accounts', he: 'חשבונות החודש', en: 'Accounts this month', value: group(accounts.length) },
  ];
  const title = isHebrew ? 'שימוש בחכם פלוס' : 'SMART PACK usage';
  const id = 'admin-smart-pack-usage';
  const budget = <N v={ok ? ils(data.budgetIls) : '₪4.00'} />;
  const rate = <N v={ok ? num(data.usdIlsRate) : 3.5} />;
  const subtitle = isHebrew ? <>העלות האמיתית אצל ספק הבינה, לכל יכולת ולכל חשבון. תקציב חודשי {budget} לחשבון, בשער {rate} ₪ לדולר (השער היציג ועוד 10%). מספרים בלבד, בלי תוכן.</> : <>The real cost at the AI provider, per feature and per account. A monthly budget of {budget} per account, at {rate} ILS per USD (the representative rate + 10%). Numbers only, no content.</>;

  return (
    <AdminScreenFrame title={title} subtitle={subtitle} label={title} isHebrew={isHebrew} onRefresh={() => setRefreshKey((k) => k + 1)}
      refreshing={data === 'loading'} updatedAt={updatedAt} formatTime={(v) => formatShortDateTime(v, market)}>
      <article className="av-card" data-testid={id}>
        <div className="av-pills" role="group" aria-label={isHebrew ? 'תקופה' : 'Period'}>
          {PERIODS.map((p) => (
            // PRODUCT_TRUTH_DECORATIVE: chooses the period of the SMART PACK usage cost view (read-only)
            <button key={p} type="button" className="av-pill" aria-pressed={days === p} onClick={() => setDays(p)} data-testid={`${id}-period-${p}`}>
              {isHebrew ? <><N v={p} /> ימים אחרונים</> : <>Last <N v={p} /> days</>}
            </button>
          ))}
        </div>

        {data === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
          : data === 'unavailable' ? <div className="av-notice av-bad" role="alert" data-testid={`${id}-unavailable`}>{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</div>
            : (
              <>
                <div className="av-grid av-kpis av-section" data-testid={`${id}-kpis`}>
                  {kpis.map((k) => (
                    <div key={k.key} className="av-card av-accent-top" data-kpi={k.key}>
                      <div className="av-label">{isHebrew ? k.he : k.en}</div>
                      <div className="av-kpi-value" data-testid={`${id}-kpi-${k.key}`}><N v={k.value} /></div>
                    </div>
                  ))}
                </div>
                {accounts.length > 0 && (
                  <div className="av-tablewrap av-section">
                    <table data-testid={`${id}-accounts`}>
                      <caption>{isHebrew ? 'לפי חשבון, החודש (שעון ישראל)' : 'By account, this month (Israel time)'}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{isHebrew ? 'חשבון' : 'Account'}</th>
                          <th scope="col">{isHebrew ? 'פעולות' : 'Actions'}</th>
                          <th scope="col">{isHebrew ? 'עלות' : 'Cost'}</th>
                          <th scope="col">{isHebrew ? 'מהתקציב' : 'Of the budget'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((a) => (
                          <tr key={a.email} data-account={a.email}>
                            <td><bdi>{a.email}</bdi>{a.admin ? (isHebrew ? ' (חשבון הניהול)' : ' (the admin account)') : ''}</td>
                            <td><N v={group(int(a.actions))} /></td>
                            <td><N v={ils(a.costIls)} /></td>
                            <td><N v={a.admin ? '—' : pct(a.percentUsed)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {list.length === 0 ? <p className="av-muted av-section" role="status" data-testid={`${id}-empty`}>{isHebrew ? 'עדיין לא נספר שימוש בתקופה הזו.' : 'No usage was counted in this period yet.'}</p> : (
                  <div className="av-tablewrap av-section">
                    <table data-testid={`${id}-table`}>
                      <caption>{isHebrew ? 'לפי יום ויכולת (שעון ישראל). העלות האמיתית של כל פעולה.' : 'By day and feature (Israel time). The real cost of each action.'}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{isHebrew ? 'יום' : 'Day'}</th>
                          <th scope="col">{isHebrew ? 'יכולת' : 'Feature'}</th>
                          <th scope="col">{isHebrew ? 'נספרו' : 'Counted'}</th>
                          <th scope="col">{isHebrew ? 'הוחזרו' : 'Given back'}</th>
                          <th scope="col">{isHebrew ? 'חשבונות' : 'Accounts'}</th>
                          <th scope="col">{isHebrew ? 'טוקנים' : 'Tokens'}</th>
                          <th scope="col">{isHebrew ? 'עלות' : 'Cost'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((r) => (
                          <tr key={`${r.day}-${r.feature}`} data-day={r.day} data-feature={r.feature}>
                            <td><N v={formatShortDate(r.day, market)} /></td>
                            <td>{FEATURES[r.feature] ? L(FEATURES[r.feature]) : r.feature}</td>
                            <td><N v={int(r.stored)} /></td>
                            <td><N v={int(r.refunded)} /></td>
                            <td><N v={int(r.accounts)} /></td>
                            <td><N v={group(int(r.promptTokens) + int(r.completionTokens))} /></td>
                            <td><N v={ils(r.costIls)} /></td>
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
