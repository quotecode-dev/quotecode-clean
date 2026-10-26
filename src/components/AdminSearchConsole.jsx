// Owner console 2026-10-26 (typed: "מאשר לבנות מסך גוגל סרץ' קונסול במסך הניהול, בקריאה בלבד"; built in the approved night task): the
// site's Google Search Console data in the admin - clicks, impressions, click rate and position for the last 28 days against the 28 before,
// the top searches and pages, the sitemap, and (on request) the indexing state of every public page. Reads the search-console function
// (super admin only, server-checked; a read-only service account). Read only. Israeli dates in the admin (IRON-DATE-001 admin amendment).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import { formatShortDate, formatShortDateTime } from '../utils/shortDate';
import { ADMIN_DATE_MARKET } from '../utils/adminDates';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import './adminUsers.css';
import './adminV2.css';

const N = ({ v }) => <bdi className="av-num">{v}</bdi>;
const group = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const one = (n) => (Number(n) || 0).toFixed(1);

async function callFn(action) {
  try {
    const { data, error } = await supabase.functions.invoke('search-console', { body: { action } });
    if (!error) return data;
    return (await error?.context?.json?.().catch(() => null)) || { ok: false, code: 'unavailable' };
  } catch { return { ok: false, code: 'unavailable' }; }
}

// the change against the previous 28 days; for the position a LOWER number is better
function Delta({ now, before, lowerIsBetter = false, isHebrew }) {
  const d = (Number(now) || 0) - (Number(before) || 0);
  if (!Number(before) && !Number(now)) return null;
  const good = lowerIsBetter ? d < 0 : d > 0;
  const text = `${d > 0 ? '+' : ''}${Number.isInteger(d) ? group(d) : one(d)}`;
  return (
    <div className="av-muted" style={{ fontSize: '0.8rem', color: d === 0 ? undefined : good ? '#1f6b3a' : '#8f3434' }}>
      <N v={text} /> {isHebrew ? 'מול 28 הימים הקודמים' : 'vs the previous 28 days'}
    </div>
  );
}

const VERDICT = {
  PASS: { he: 'באינדקס', en: 'Indexed', good: true },
  NEUTRAL: { he: 'לא באינדקס', en: 'Not indexed', good: false },
  FAIL: { he: 'שגיאה באינדקס', en: 'Indexing error', good: false },
  PARTIAL: { he: 'חלקי', en: 'Partial', good: false },
  VERDICT_UNSPECIFIED: { he: 'לא ידוע לגוגל', en: 'Unknown to Google', good: false },
  ERROR: { he: 'הבדיקה נכשלה', en: 'Check failed', good: false },
};

export default function AdminSearchConsole({ isHebrew }) {
  const [data, setData] = useState('loading');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [indexing, setIndexing] = useState(null);
  const market = ADMIN_DATE_MARKET;

  const load = useCallback(() => {
    setData('loading');
    callFn('summary').then((d) => {
      setData(d?.ok ? d : { failed: d?.code || 'unavailable' });
      if (d?.ok) setUpdatedAt(new Date().toISOString());
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const runIndexing = () => {
    setIndexing('loading');
    callFn('indexing').then((d) => setIndexing(d?.ok ? d.pages || [] : { failed: d?.code || 'unavailable' }));
  };

  const title = isHebrew ? "גוגל סרץ' קונסול" : 'Google Search Console';
  const failText = (code) => (code === 'not_configured'
    ? (isHebrew ? 'המפתח של גוגל עוד לא הוגדר בשרת.' : 'The Google key is not set on the server yet.')
    : isHebrew ? `לא הצלחנו לקרוא מגוגל כרגע. נסו שוב מאוחר יותר (קוד: ${code}).` : `Could not read from Google right now. Try again later (code: ${code}).`);
  const ok = data && typeof data === 'object' && !data.failed;
  const kpis = ok ? [
    { key: 'clicks', he: 'קליקים', en: 'Clicks', value: group(data.totals.clicks), now: data.totals.clicks, before: data.previous.clicks },
    { key: 'impressions', he: 'הופעות בחיפוש', en: 'Impressions', value: group(data.totals.impressions), now: data.totals.impressions, before: data.previous.impressions },
    { key: 'ctr', he: 'אחוז הקלקה', en: 'Click rate', value: `${one(data.totals.ctr)}%`, now: data.totals.ctr, before: data.previous.ctr },
    { key: 'position', he: 'מיקום ממוצע', en: 'Average position', value: one(data.totals.position), now: data.totals.position, before: data.previous.position, lowerIsBetter: true },
  ] : [];
  const metricHead = (
    <>
      <th scope="col">{isHebrew ? 'קליקים' : 'Clicks'}</th>
      <th scope="col">{isHebrew ? 'הופעות' : 'Impressions'}</th>
      <th scope="col">{isHebrew ? 'אחוז הקלקה' : 'Click rate'}</th>
      <th scope="col">{isHebrew ? 'מיקום' : 'Position'}</th>
    </>
  );
  const metricCells = (r) => (
    <>
      <td><N v={group(r.clicks)} /></td>
      <td><N v={group(r.impressions)} /></td>
      <td><N v={`${one(r.ctr)}%`} /></td>
      <td><N v={one(r.position)} /></td>
    </>
  );

  return (
    <AdminScreenFrame
      title={title}
      subtitle={isHebrew ? 'איך האתר מופיע בחיפוש של גוגל: 28 הימים האחרונים שגוגל כבר סיכם (בערך עד שלפני יומיים). קריאה בלבד.'
        : 'How the site shows up in Google search: the last 28 days Google has finalized (about two days back). Read only.'}
      label={title}
      isHebrew={isHebrew}
      onRefresh={load}
      refreshing={data === 'loading'}
      updatedAt={updatedAt}
      formatTime={(v) => formatShortDateTime(v, market)}
    >
      <article className="av-card" data-testid="admin-search-console">
        {data === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
          : !ok ? <div className="av-notice av-bad" role="alert" data-testid="admin-search-console-failed">{failText(data.failed)}</div>
            : (
              <>
                <p className="av-muted" data-testid="admin-search-console-period">
                  {isHebrew ? 'התקופה: ' : 'Period: '}<N v={formatShortDate(data.period.startDate, market)} /> - <N v={formatShortDate(data.period.endDate, market)} />
                </p>
                <div className="av-grid av-kpis av-section" data-testid="admin-search-console-kpis">
                  {kpis.map((k) => (
                    <div key={k.key} className="av-card av-accent-top" data-kpi={k.key}>
                      <div className="av-label">{isHebrew ? k.he : k.en}</div>
                      <div className="av-kpi-value" data-testid={`admin-search-console-kpi-${k.key}`}><N v={k.value} /></div>
                      <Delta now={k.now} before={k.before} lowerIsBetter={k.lowerIsBetter} isHebrew={isHebrew} />
                    </div>
                  ))}
                </div>

                <div className="av-tablewrap av-section">
                  <table data-testid="admin-search-console-queries">
                    <caption>{isHebrew ? 'החיפושים המובילים - מה אנשים חיפשו כשהאתר הופיע להם' : 'Top searches - what people searched when the site showed up'}</caption>
                    <thead><tr><th scope="col">{isHebrew ? 'חיפוש' : 'Search'}</th>{metricHead}</tr></thead>
                    <tbody>
                      {data.queries.length === 0
                        ? <tr><td colSpan={5} className="av-muted">{isHebrew ? 'אין עדיין חיפושים בתקופה הזו.' : 'No searches in this period yet.'}</td></tr>
                        : data.queries.map((r) => <tr key={r.query}><td><bdi>{r.query}</bdi></td>{metricCells(r)}</tr>)}
                    </tbody>
                  </table>
                </div>

                <div className="av-tablewrap av-section">
                  <table data-testid="admin-search-console-pages">
                    <caption>{isHebrew ? 'הדפים המובילים בחיפוש' : 'Top pages in search'}</caption>
                    <thead><tr><th scope="col">{isHebrew ? 'דף' : 'Page'}</th>{metricHead}</tr></thead>
                    <tbody>
                      {data.pages.length === 0
                        ? <tr><td colSpan={5} className="av-muted">{isHebrew ? 'אין עדיין דפים בתקופה הזו.' : 'No pages in this period yet.'}</td></tr>
                        : data.pages.map((r) => <tr key={r.page}><td><bdi dir="ltr">{r.page}</bdi></td>{metricCells(r)}</tr>)}
                    </tbody>
                  </table>
                </div>

                <div className="av-tablewrap av-section">
                  <table data-testid="admin-search-console-sitemaps">
                    <caption>{isHebrew ? 'מפת האתר אצל גוגל' : 'The sitemap at Google'}</caption>
                    <thead><tr>
                      <th scope="col">{isHebrew ? 'קובץ' : 'File'}</th>
                      <th scope="col">{isHebrew ? 'נקרא לאחרונה' : 'Last read'}</th>
                      <th scope="col">{isHebrew ? 'דפים שנשלחו' : 'Pages submitted'}</th>
                      <th scope="col">{isHebrew ? 'שגיאות' : 'Errors'}</th>
                      <th scope="col">{isHebrew ? 'אזהרות' : 'Warnings'}</th>
                    </tr></thead>
                    <tbody>
                      {data.sitemaps.map((m) => (
                        <tr key={m.path}>
                          <td><bdi dir="ltr">{m.path}</bdi></td>
                          <td>{m.lastDownloaded ? <N v={formatShortDateTime(m.lastDownloaded, market)} /> : '—'}</td>
                          <td><N v={group(m.submitted)} /></td>
                          <td><N v={group(m.errors)} /></td>
                          <td><N v={group(m.warnings)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

        <section className="av-section" data-testid="admin-search-console-indexing">
          <h3 className="av-label" style={{ fontSize: '1rem' }}>{isHebrew ? 'מצב האינדוקס של הדפים הציבוריים' : 'Indexing of the public pages'}</h3>
          <p className="av-muted">{isHebrew ? 'בודק אצל גוגל כל דף שבמפת האתר: האם הוא באינדקס, ומתי נסרק לאחרונה. לוקח כחצי דקה.'
            : 'Asks Google about every page in the sitemap: is it indexed, and when was it last crawled. Takes about half a minute.'}</p>
          {/* PRODUCT_TRUTH_DECORATIVE: asks Google (read only) for the indexing state of every public page in the sitemap */}
          <button type="button" className="av-pill" onClick={runIndexing} disabled={indexing === 'loading'} data-testid="admin-search-console-run-indexing">
            {indexing === 'loading' ? (isHebrew ? 'בודק...' : 'Checking...') : (isHebrew ? 'בדיקת אינדוקס לכל הדפים' : 'Check indexing of every page')}
          </button>
          {indexing && indexing !== 'loading' && (indexing.failed
            ? <div className="av-notice av-bad" role="alert">{failText(indexing.failed)}</div>
            : (
              <div className="av-tablewrap av-section">
                <table data-testid="admin-search-console-indexing-table">
                  <caption>{isHebrew
                    ? <>באינדקס: <N v={indexing.filter((p) => p.verdict === 'PASS').length} /> מתוך <N v={indexing.length} /></>
                    : <>Indexed: <N v={indexing.filter((p) => p.verdict === 'PASS').length} /> of <N v={indexing.length} /></>}</caption>
                  <thead><tr>
                    <th scope="col">{isHebrew ? 'דף' : 'Page'}</th>
                    <th scope="col">{isHebrew ? 'מצב' : 'State'}</th>
                    <th scope="col">{isHebrew ? 'הסבר של גוגל' : 'Google\'s reason'}</th>
                    <th scope="col">{isHebrew ? 'נסרק לאחרונה' : 'Last crawled'}</th>
                  </tr></thead>
                  <tbody>
                    {indexing.map((p) => {
                      const v = VERDICT[p.verdict] || VERDICT.VERDICT_UNSPECIFIED;
                      return (
                        <tr key={p.path} data-verdict={p.verdict}>
                          <td><bdi dir="ltr">{p.path}</bdi></td>
                          <td style={{ color: v.good ? '#1f6b3a' : '#8f3434', fontWeight: 600 }}>{isHebrew ? v.he : v.en}</td>
                          <td><bdi dir="ltr">{p.coverageState || '—'}</bdi></td>
                          <td>{p.lastCrawlTime ? <N v={formatShortDate(p.lastCrawlTime, market)} /> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
        </section>
      </article>
    </AdminScreenFrame>
  );
}
