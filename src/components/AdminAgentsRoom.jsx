// Owner console 2026-10-27 (typed: "מאשר שלב 1 של חדר הסוכנים: דוח גם במייל, תקרה 20 דולר, 65% חו״ל, כמשימת לילה"; plan
// docs/AGENTS_ROOM_PLAN_2026-10-26.md): the agents room - the three read-only agents (SEO, service, security), what each found on its last
// run, its history, "run now", and the month's AI cost against the 20 dollar cap. Reads / runs through the agents-room function (super admin
// only, server-checked). Nothing here publishes, sends to a customer or changes the site. Israeli dates in the admin (IRON-DATE-001).
import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Headset, ShieldCheck } from 'lucide-react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import { formatShortDateTime } from '../utils/shortDate';
import { ADMIN_DATE_MARKET } from '../utils/adminDates';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import './adminUsers.css';
import './adminV2.css';

const N = ({ v }) => <bdi className="av-num">{v}</bdi>;
const AGENTS = [
  { id: 'seo', icon: TrendingUp, he: 'סוכן הקידום', en: 'SEO agent', roleHe: 'גוגל סרץ׳ קונסול: חו״ל 65%, ישראל 35%. דוח שבועי במסך ובמייל.', roleEn: 'Google Search Console: international 65%, Israel 35%. A weekly report here and by email.' },
  { id: 'service', icon: Headset, he: 'סוכן השירות', en: 'Service agent', roleHe: 'הפניות של השבוע, הסקירה השבועית והצ׳אט החכם.', roleEn: 'The week\'s inquiries, the weekly review and the smart chat.' },
  { id: 'security', icon: ShieldCheck, he: 'סוכן האבטחה', en: 'Security agent', roleHe: 'כותרות ההגנה, הגרסה החיה וכל הדפים הציבוריים.', roleEn: 'The protection headers, the live build and every public page.' },
];
const STATUS = {
  done: { he: 'הושלם', en: 'Done', color: '#1f6b3a' },
  failed: { he: 'נכשל', en: 'Failed', color: '#8f3434' },
  running: { he: 'רץ עכשיו', en: 'Running', color: '#7a4f0a' },
  skipped_cap: { he: 'לא רץ - הגענו לתקרה', en: 'Skipped - the cap was reached', color: '#7a4f0a' },
};
const LEVEL_COLOR = { good: '#1f6b3a', warn: '#7a4f0a', bad: '#8f3434' };

async function callFn(body) {
  try {
    const { data, error } = await supabase.functions.invoke('agents-room', { body });
    if (!error) return data;
    return (await error?.context?.json?.().catch(() => null)) || { ok: false, code: 'unavailable' };
  } catch { return { ok: false, code: 'unavailable' }; }
}

export default function AdminAgentsRoom({ isHebrew }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const market = ADMIN_DATE_MARKET;
  const L = (o) => (isHebrew ? o.he : o.en);

  const load = useCallback(() => {
    setState('loading');
    callFn({ action: 'state' }).then((d) => {
      setState(d?.ok ? d : { failed: d?.code || 'unavailable' });
      if (d?.ok) setUpdatedAt(new Date().toISOString());
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (agent) => {
    setBusy(agent); setNotice(null);
    const r = await callFn({ action: 'run', agent });
    setBusy('');
    const statuses = r?.ok ? (r.results || []).map((x) => x.status) : [];
    if (statuses.includes('already_ran')) setNotice({ good: true, text: isHebrew ? 'הסוכן כבר רץ בשעה הזו. התוצאה למטה.' : 'The agent already ran this hour. The result is below.' });
    else if (r?.ok && statuses.every((s) => s === 'done')) setNotice({ good: true, text: isHebrew ? 'הסוכן סיים. התוצאה למטה.' : 'The agent finished. The result is below.' });
    else setNotice({ good: false, text: isHebrew ? 'הסוכן לא הושלם. הפירוט בכרטיס שלו.' : 'The agent did not complete. Details are on its card.' });
    load();
  };

  const ok = state && typeof state === 'object' && !state.failed;
  const runs = ok ? state.runs || [] : [];
  const title = isHebrew ? 'חדר הסוכנים' : 'Agents room';
  const capPct = ok ? Math.min(100, Math.round((Number(state.monthCostUsd) / Number(state.cap)) * 100)) : 0;

  return (
    <AdminScreenFrame
      title={title}
      subtitle={isHebrew ? 'שלושה סוכנים שקוראים, מסכמים וממליצים. הם לא מפרסמים, לא פונים ללקוחות ולא משנים שום דבר באתר. בכל יום ראשון בבוקר הם רצים לבד ושולחים לכם דוח במייל.'
        : 'Three agents that read, summarize and recommend. They never publish, never contact customers and never change the site. Every Sunday morning they run on their own and email you a report.'}
      label={title}
      isHebrew={isHebrew}
      onRefresh={load}
      refreshing={state === 'loading'}
      updatedAt={updatedAt}
      formatTime={(v) => formatShortDateTime(v, market)}
    >
      <article className="av-card" data-testid="admin-agents-room">
        {state === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
          : !ok ? <div className="av-notice av-bad" role="alert" data-testid="admin-agents-room-failed">{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</div>
            : (
              <>
                <div className="av-grid av-kpis av-section" data-testid="admin-agents-room-budget">
                  <div className="av-card av-accent-top">
                    <div className="av-label">{isHebrew ? 'עלות הבינה החודש' : 'AI cost this month'}</div>
                    <div className="av-kpi-value" data-testid="admin-agents-room-cost"><N v={`$${Number(state.monthCostUsd).toFixed(2)}`} /></div>
                    <div className="av-muted" style={{ fontSize: '0.8rem' }}>{isHebrew ? <>מתוך תקרה של <N v={`$${state.cap}`} /></> : <>of a <N v={`$${state.cap}`} /> cap</>}</div>
                    <div aria-hidden="true" style={{ height: 6, background: '#e5ecee', borderRadius: 3, marginTop: 8 }}>
                      <div style={{ width: `${capPct}%`, height: 6, borderRadius: 3, background: capPct >= 100 ? '#8f3434' : '#315f6f' }} />
                    </div>
                  </div>
                  <div className="av-card av-accent-top">
                    <div className="av-label">{isHebrew ? 'חלוקת הקידום' : 'Promotion split'}</div>
                    <div className="av-kpi-value">{isHebrew ? <>חו״ל <N v={`${state.split.intl}%`} /></> : <>International <N v={`${state.split.intl}%`} /></>}</div>
                    <div className="av-muted" style={{ fontSize: '0.8rem' }}>{isHebrew ? <>ישראל <N v={`${state.split.il}%`} /></> : <>Israel <N v={`${state.split.il}%`} /></>}</div>
                  </div>
                </div>
                {!state.googleConfigured && (
                  <div className="av-notice av-bad av-section" role="alert">{isHebrew ? 'המפתח של גוגל לא מוגדר בשרת, ולכן סוכן הקידום לא יכול לרוץ.' : 'The Google key is not set on the server, so the SEO agent cannot run.'}</div>
                )}
                {notice && <div className={`av-notice ${notice.good ? '' : 'av-bad'} av-section`} role="status" data-testid="admin-agents-room-notice">{notice.text}</div>}

                <div className="av-section" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                  {AGENTS.map((a) => {
                    const mine = runs.filter((r) => r.agent === a.id);
                    const last = mine[0];
                    const Icon = a.icon;
                    const st = last ? STATUS[last.status] || STATUS.failed : null;
                    const summary = last ? (isHebrew ? last.summary : last.data?.summaryEn || last.summary) : null;
                    return (
                      <section key={a.id} className="av-card" data-testid={`agent-card-${a.id}`} data-status={last?.status || 'never'}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px', fontSize: '1.05rem' }}>
                          <span aria-hidden="true" style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: '50%', background: '#dfe9ec', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color="#315f6f" /></span>
                          {L(a)}
                        </h3>
                        <p className="av-muted" style={{ fontSize: '0.85rem', margin: '0 0 10px' }}>{isHebrew ? a.roleHe : a.roleEn}</p>
                        {last ? (
                          <>
                            <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                              <span style={{ color: st.color, fontWeight: 600 }}>{L(st)}</span>
                              {' · '}<N v={formatShortDateTime(last.finished_at || last.started_at, market)} />
                              {' · '}{last.trigger === 'cron' ? (isHebrew ? 'ריצה שבועית' : 'weekly run') : (isHebrew ? 'הרצה ידנית' : 'run now')}
                            </div>
                            {summary && <p style={{ fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 8px' }} data-testid={`agent-summary-${a.id}`}>{summary}</p>}
                            {last.error && <p className="av-muted" style={{ fontSize: '0.8rem' }}>{isHebrew ? 'קוד: ' : 'Code: '}<bdi dir="ltr">{last.error}</bdi></p>}
                            {Array.isArray(last.findings) && last.findings.length > 0 && (
                              <ul style={{ margin: '0 0 8px', paddingInlineStart: 18, fontSize: '0.85rem', lineHeight: 1.6 }} data-testid={`agent-findings-${a.id}`}>
                                {last.findings.map((f, i) => <li key={i} style={{ color: LEVEL_COLOR[f.level] || undefined }}>{isHebrew ? f.he : f.en}</li>)}
                              </ul>
                            )}
                          </>
                        ) : <p className="av-muted" style={{ fontSize: '0.85rem' }}>{isHebrew ? 'עוד לא רץ.' : 'Has not run yet.'}</p>}
                        {/* PRODUCT_TRUTH_DECORATIVE: runs this read-only agent now (once an hour at most); it only reads and reports */}
                        <button type="button" className="av-pill" onClick={() => run(a.id)} disabled={!!busy} data-testid={`agent-run-${a.id}`}>
                          {busy === a.id ? (isHebrew ? 'רץ...' : 'Running...') : (isHebrew ? 'הרץ עכשיו' : 'Run now')}
                        </button>
                        {mine.length > 1 && (
                          <details style={{ marginTop: 8, fontSize: '0.8rem' }}>
                            <summary>{isHebrew ? 'ריצות קודמות' : 'Earlier runs'}</summary>
                            <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
                              {mine.slice(1, 6).map((r) => (
                                <li key={r.id}><N v={formatShortDateTime(r.started_at, market)} /> · {L(STATUS[r.status] || STATUS.failed)}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </section>
                    );
                  })}
                </div>
              </>
            )}
      </article>
    </AdminScreenFrame>
  );
}
