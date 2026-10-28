// Owner console 2026-10-27 (typed: "מאשר שלב 1 של חדר הסוכנים: דוח גם במייל, תקרה 20 דולר, 65% חו״ל, כמשימת לילה"; plan
// docs/AGENTS_ROOM_PLAN_2026-10-26.md): the agents room - the three read-only agents (SEO, service, security), what each found on its last
// run, its history, "run now", and the month's AI cost against the 20 dollar cap. Reads / runs through the agents-room function (super admin
// only, server-checked). Israeli dates in the admin (IRON-DATE-001).
// Stage 2 (Owner console 2026-10-27, typed: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים" + the four decisions; plan
// docs/AGENTS_ROOM_STAGE2_PLAN_2026-10-27.md): the agents manager's desk on top - the week's plan, what waits for the Owner's approval
// (an article topic -> a draft to read -> publish; a code task for Claude), what is with Claude, information, and the history. Every agent
// has a drawn character (AgentAvatar, style A chosen by the Owner) and a name the Owner gives it. Nothing here acts without the Owner's click;
// the function checks the admin and the action again.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import AgentAvatar from './AgentAvatar';
import AdminSocialPosts from './AdminSocialPosts';
import { formatShortDateTime } from '../utils/shortDate';
import { ADMIN_DATE_MARKET } from '../utils/adminDates';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import './adminUsers.css';
import './adminV2.css';

const N = ({ v }) => <bdi className="av-num">{v}</bdi>;
// Owner 2026-10-27 ("מאשר לתקן את שלוש התקלות בחדר הסוכנים"): a cost under one cent shows 4 decimals, never $0.00 (= lib.ts usd)
const usd = (v) => (v > 0 && v < 0.01 ? v.toFixed(4) : v.toFixed(2));
const MANAGER = { id: 'manager', he: 'מנהלת הסוכנים', en: 'Agents manager', roleHe: 'אוספת את הממצאים של כל הסוכנים, מציעה מה לעשות השבוע, ומבצעת רק מה שאישרתם.', roleEn: 'Gathers every agent\'s findings, proposes what to do this week, and acts only on what you approve.' };
const AGENTS = [
  { id: 'seo', he: 'סוכן הקידום', en: 'SEO agent', roleHe: 'גוגל סרץ׳ קונסול: חו״ל 65%, ישראל 35%. דוח שבועי במסך ובמייל.', roleEn: 'Google Search Console: international 65%, Israel 35%. A weekly report here and by email.' },
  { id: 'service', he: 'סוכנת השירות', en: 'Service agent', roleHe: 'הפניות של השבוע, הסקירה השבועית והצ׳אט החכם.', roleEn: 'The week\'s inquiries, the weekly review and the smart chat.' },
  { id: 'security', he: 'סוכן האבטחה', en: 'Security agent', roleHe: 'כל יום: כותרות ההגנה, הגרסה החיה וכל הדפים הציבוריים. מייל רק כשיש בעיה.', roleEn: 'Every day: the protection headers, the live build and every public page. An email only when there is a problem.' },
  // Owner 2026-10-27 ("מאשר את שלב 1 של סוכנת הרשתות"; the layout: "תחלק את המסך ל 6 תוסיף את הסוכנת החדשה מתחת לגיא")
  { id: 'social', he: 'סוכנת הרשתות', en: 'Social media agent', roleHe: 'פייסבוק, אינסטגרם וטיקטוק: ישראל בעברית, חו״ל באנגלית. כל פוסט רק אחרי אישור שלכם.', roleEn: 'Facebook, Instagram and TikTok: Israel in Hebrew, international in English. Every post only after your approval.' },
];
// the agents grid: 6 places, 3 per row on a wide screen - the social agent under the SEO agent, two places left for future agents
const GRID_SLOTS = 6;
const STATUS = {
  done: { he: 'הושלם', en: 'Done', color: '#1f6b3a' },
  failed: { he: 'נכשל', en: 'Failed', color: '#8f3434' },
  running: { he: 'רץ עכשיו', en: 'Running', color: '#7a4f0a' },
  skipped_cap: { he: 'לא רץ - הגענו לתקרה', en: 'Skipped - the cap was reached', color: '#7a4f0a' },
};
const ACTION_STATUS = {
  proposed: { he: 'מחכה', en: 'Waiting', cls: 'av-warn' }, approved: { he: 'אושר', en: 'Approved', cls: 'av-ok' },
  rejected: { he: 'נדחה', en: 'Rejected', cls: '' }, done: { he: 'בוצע', en: 'Done', cls: 'av-ok' }, failed: { he: 'נכשל', en: 'Failed', cls: 'av-bad' },
};
const KIND = {
  auto: { he: 'אוטומטי', en: 'Automatic' }, system: { he: 'המערכת מבצעת אחרי אישור', en: 'The system does it after approval' },
  claude: { he: 'Claude מבצע אחרי אישור', en: 'Claude does it after approval' }, info: { he: 'לידיעה', en: 'For your information' },
};
const LEVEL_COLOR = { good: '#1f6b3a', warn: '#7a4f0a', bad: '#8f3434' };

async function callFn(body) {
  try {
    const { data, error } = await supabase.functions.invoke('agents-room', { body });
    if (!error) return data;
    return (await error?.context?.json?.().catch(() => null)) || { ok: false, code: 'unavailable' };
  } catch { return { ok: false, code: 'unavailable' }; }
}

// 20261029000000 (Codex F22): an approved article whose site rebuild did not start - said plainly, with a button to rebuild again
const REBUILD_FAILED = { he: 'המאמר אושר ונשמר, אבל בניית האתר מחדש לא התחילה, ולכן גוגל עוד לא רואה אותו. לחצו "בנייה מחדש" כדי לנסות שוב.',
  en: 'The article was approved and saved, but the site rebuild did not start, so Google does not see it yet. Press "Rebuild the site" to try again.' };

function errorText(code, isHebrew) {
  const he = { draft_failed: 'הטיוטה לא עברה את הבדיקות של השפה והשוק. אפשר לנסות שוב.', cap_reached: 'הגענו לתקרת העלות החודשית, ולכן הבינה לא רצה החודש.',
    not_pending: 'הפעולה הזו כבר טופלה.', note_required: 'כתבו במשפט מה לתקן.', bad_name: 'שם חייב להיות באורך של 1 עד 30 תווים, בעברית ובאנגלית.', article_changed: 'הטיוטה השתנתה מאז שנפתחה. קראו אותה שוב לפני האישור.', article_not_draft: 'המאמר כבר אושר או נדחה.' };
  const en = { draft_failed: 'The draft did not pass the language and market checks. You can try again.', cap_reached: 'The monthly cost cap was reached, so the AI does not run this month.',
    not_pending: 'This action was already handled.', note_required: 'Write in one sentence what to fix.', bad_name: 'A name must be 1 to 30 characters, in Hebrew and in English.',
    article_changed: 'The draft changed since it was opened. Read it again before approving.', article_not_draft: 'The article was already approved or rejected.' };
  return (isHebrew ? he : en)[code] || (isHebrew ? 'הפעולה לא הושלמה. נסו שוב.' : 'The action did not complete. Try again.');
}

function NameEditor({ agent, profile, isHebrew, onSaved, onNotice }) {
  const [open, setOpen] = useState(false);
  const [he, setHe] = useState(profile?.name_he || '');
  const [en, setEn] = useState(profile?.name_en || '');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      /* PRODUCT_TRUTH_DECORATIVE: opens the two name fields of this agent (Owner 2026-10-27: the Owner names each agent) */
      <button type="button" className="av-btn" data-testid={`agent-rename-${agent}`} onClick={() => { setHe(profile?.name_he || ''); setEn(profile?.name_en || ''); setOpen(true); }}>
        {isHebrew ? 'שינוי שם' : 'Rename'}
      </button>
    );
  }
  const save = async () => {
    setBusy(true);
    const r = await callFn({ action: 'rename', agent, name_he: he, name_en: en });
    setBusy(false);
    if (r?.ok) { setOpen(false); onSaved(); } else onNotice({ good: false, text: errorText(r?.code, isHebrew) });
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }} data-testid={`agent-rename-form-${agent}`}>
      <label className="av-field" style={{ width: 130 }}><span>{isHebrew ? 'שם בעברית' : 'Hebrew name'}</span><input dir="auto" maxLength={30} value={he} onChange={(e) => setHe(e.target.value)} data-testid={`agent-name-he-${agent}`} /></label>
      <label className="av-field" style={{ width: 130 }}><span>{isHebrew ? 'שם באנגלית' : 'English name'}</span><input dir="auto" maxLength={30} value={en} onChange={(e) => setEn(e.target.value)} data-testid={`agent-name-en-${agent}`} /></label>
      {/* PRODUCT_TRUTH_DECORATIVE: saves this agent's names (agents-room rename, admin only) */}
      <button type="button" className="av-btn av-primary" disabled={busy} onClick={save} data-testid={`agent-name-save-${agent}`}>{isHebrew ? 'שמירה' : 'Save'}</button>
      {/* PRODUCT_TRUTH_DECORATIVE: closes the name fields without saving */}
      <button type="button" className="av-btn" disabled={busy} onClick={() => setOpen(false)}>{isHebrew ? 'ביטול' : 'Cancel'}</button>
    </div>
  );
}

function AgentHead({ agent, meta, profile, isHebrew, size, onSaved, onNotice }) {
  const name = profile ? (isHebrew ? profile.name_he : profile.name_en) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <AgentAvatar agent={agent} size={size} />
      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
        <h3 style={{ margin: 0, fontSize: size > 60 ? '1.2rem' : '1.05rem' }} data-testid={`agent-name-${agent}`}>{name ? <bdi>{name}</bdi> : (isHebrew ? meta.he : meta.en)}</h3>
        {name && <div className="av-muted" style={{ fontSize: '0.85rem' }}>{isHebrew ? meta.he : meta.en}</div>}
      </div>
      <NameEditor agent={agent} profile={profile} isHebrew={isHebrew} onSaved={onSaved} onNotice={onNotice} />
    </div>
  );
}

function ArticlePreview({ article, isHebrew }) {
  const [lang, setLang] = useState(isHebrew ? 'he' : 'en');
  const a = article?.[lang];
  if (!a) return null;
  return (
    <div style={{ border: '1px solid #dfe7ea', borderRadius: 10, padding: 12, marginTop: 8, background: '#fbfdfd' }} data-testid={`article-preview-${article.slug}`}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {/* PRODUCT_TRUTH_DECORATIVE: shows the Hebrew version of the draft */}
        <button type="button" className="av-pill" aria-pressed={lang === 'he'} onClick={() => setLang('he')}>{isHebrew ? 'עברית' : 'Hebrew'}</button>
        {/* PRODUCT_TRUTH_DECORATIVE: shows the English version of the draft */}
        <button type="button" className="av-pill" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>{isHebrew ? 'אנגלית' : 'English'}</button>
      </div>
      <div dir={lang === 'he' ? 'rtl' : 'ltr'} lang={lang} style={{ lineHeight: 1.7, fontSize: '0.92rem' }}>
        <div className="av-muted" style={{ fontSize: '0.8rem' }}><bdi dir="ltr">{`/${lang}/articles/${article.slug}`}</bdi></div>
        <h4 style={{ fontSize: '1.1rem', margin: '4px 0 6px' }}>{a.h1}</h4>
        <p style={{ margin: '0 0 8px' }}>{a.intro}</p>
        {(a.sections || []).map((s) => (
          <section key={s.h}>
            <h5 style={{ fontSize: '0.98rem', margin: '10px 0 4px' }}>{s.h}</h5>
            {(s.p || []).map((p) => <p key={p} style={{ margin: '0 0 6px' }}>{p}</p>)}
            {s.list?.length > 0 && <ul style={{ margin: '0 0 6px', paddingInlineStart: 18 }}>{s.list.map((li) => <li key={li}>{li}</li>)}</ul>}
          </section>
        ))}
      </div>
    </div>
  );
}

function ActionRow({ a, isHebrew, market, children }) {
  const st = ACTION_STATUS[a.status] || ACTION_STATUS.proposed;
  return (
    <li style={{ border: '1px solid #dfe7ea', borderRadius: 10, padding: 12, listStyle: 'none' }} data-testid={`agent-action-${a.id}`} data-kind={a.kind} data-status={a.status}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <span className="av-badge">{isHebrew ? KIND[a.kind]?.he : KIND[a.kind]?.en}</span>
        <span className={`av-badge ${st.cls}`}>{isHebrew ? st.he : st.en}</span>
        <span className="av-muted" style={{ fontSize: '0.78rem' }}><N v={formatShortDateTime(a.done_at || a.decided_at || a.created_at, market)} /></span>
      </div>
      <div style={{ fontWeight: 600 }}>{isHebrew ? a.title_he : a.title_en}</div>
      {(isHebrew ? a.detail_he : a.detail_en) && <div className="av-muted" style={{ fontSize: '0.86rem', whiteSpace: 'pre-line' }}>{isHebrew ? a.detail_he : a.detail_en}</div>}
      {a.status === 'failed' && a.action_type === 'sitemap_submit' && /google_403/.test(a.error || '') && (
        <div className="av-notice av-bad" style={{ marginTop: 6 }}>{isHebrew ? 'גוגל סירב: צריך להעלות את ההרשאה של חשבון הסוכן בסרץ׳ קונסול ל"מלאה".' : 'Google refused: the agent account needs the "Full" permission in Search Console.'}</div>
      )}
      {children}
    </li>
  );
}

// onOpenInquiry (Owner 2026-10-27, "מאשר את התוכנית לגיא ולמיכל, כולל שינוי ב-L-22 במסך הפניות"): a red inquiry in the service card opens it
export default function AdminAgentsRoom({ isHebrew, onOpenInquiry = null }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [openDraft, setOpenDraft] = useState('');
  const [reviseFor, setReviseFor] = useState('');
  const [reviseNote, setReviseNote] = useState('');
  const market = ADMIN_DATE_MARKET;
  const L = (o) => (isHebrew ? o.he : o.en);

  const load = useCallback(() => {
    setState((s) => (s && typeof s === 'object' && !s.failed ? s : 'loading'));
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

  const act = async (body, okText) => {
    setBusy(body.id || body.action); setNotice(null);
    const r = await callFn(body);
    setBusy('');
    setNotice(r?.ok ? { good: true, text: okText(r) } : { good: false, text: errorText(r?.code, isHebrew) });
    load();
    return r;
  };
  // 20261029000000 (Codex F07): an article approval names the revision on the screen - a draft rewritten since then is read again first
  const decide = (a, decision) => act({ action: 'decide', id: a.id, decision, ...(a.action_type === 'article_publish' ? { revision: Number(a.payload?.revision ?? 0) } : {}) }, (r) => {
    if (r.status === 'rejected') return isHebrew ? 'הוסר מהרשימה.' : 'Removed from the list.';
    if (r.status === 'drafted') return isHebrew ? 'הטיוטה מוכנה. היא מחכה למטה לקריאה ולאישור שלכם.' : 'The draft is ready. It waits below for you to read and approve.';
    if (r.status === 'published') return r.deploy === 'ok'
      ? (isHebrew ? 'המאמר פורסם. האתר מתעדכן, וזה לוקח כ־2 דקות.' : 'The article was published. The site is updating; it takes about 2 minutes.')
      : r.deploy === 'failed' ? REBUILD_FAILED[isHebrew ? 'he' : 'en']
      : (isHebrew ? 'המאמר פורסם ומופיע באתר. קישור הבנייה מחדש עוד לא הוגדר, ולכן גוגל יראה אותו רק בעדכון הבא של האתר.' : 'The article was published and opens on the site. The rebuild link is not set yet, so Google sees it with the next site update.');
    if (r.status === 'approved') return isHebrew ? 'אישרתם. ההוראה המלאה ל־Claude נשלחה אליכם במייל, והיא גם כאן להעתקה.' : 'Approved. The full instruction for Claude was emailed to you and is also here to copy.';
    return isHebrew ? 'בוצע.' : 'Done.';
  });
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setNotice({ good: true, text: isHebrew ? 'ההוראה הועתקה. הדביקו אותה בשיחה עם Claude.' : 'Copied. Paste it into the conversation with Claude.' }); }
    catch { setNotice({ good: false, text: isHebrew ? 'ההעתקה לא הצליחה. סמנו את ההוראה והעתיקו ידנית.' : 'Copying failed. Select the instruction and copy it by hand.' }); }
  };

  const ok = state && typeof state === 'object' && !state.failed;
  const runs = ok ? state.runs || [] : [];
  const actions = ok ? state.actions || [] : [];
  const profiles = Object.fromEntries((ok ? state.profiles || [] : []).map((p) => [p.agent, p]));
  const drafts = Object.fromEntries((ok ? state.drafts || [] : []).map((d) => [d.id, d]));
  const pending = actions.filter((a) => a.status === 'proposed' && (a.kind === 'system' || a.kind === 'claude'));
  // the social posts have their own list on the manager's desk (AdminSocialPosts); they still count as waiting for approval
  const pendingOthers = pending.filter((a) => a.action_type !== 'social_post');
  const socialWaiting = pending.length - pendingOthers.length;
  const withClaude = actions.filter((a) => a.kind === 'claude' && a.status === 'approved');
  const lastManager = runs.find((r) => r.agent === 'manager' && r.status !== 'running' && !String(r.run_key).startsWith('draft:') && !String(r.run_key).startsWith('revise:'));
  const info = lastManager ? actions.filter((a) => a.kind === 'info' && a.run_key === lastManager.run_key) : [];
  const history = actions.filter((a) => a.status !== 'proposed' && !(a.kind === 'claude' && a.status === 'approved') && !(a.kind === 'info' && lastManager && a.run_key === lastManager.run_key)).slice(0, 12);
  const title = isHebrew ? 'חדר הסוכנים' : 'Agents room';
  const capPct = ok ? Math.min(100, Math.round((Number(state.monthCostUsd) / Number(state.cap)) * 100)) : 0;
  const managerSummary = lastManager ? (isHebrew ? lastManager.summary : lastManager.data?.summaryEn || lastManager.summary) : null;
  const managerName = profiles.manager ? (isHebrew ? profiles.manager.name_he : profiles.manager.name_en) : L(MANAGER);

  const pendingButtons = (a) => {
    const off = !!busy;
    if (a.action_type === 'article_draft') return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {/* PRODUCT_TRUTH_DECORATIVE: approves the topic - the system writes a draft in Hebrew and English; nothing is published */}
        <button type="button" className="av-btn av-primary" disabled={off} onClick={() => decide(a, 'approve')} data-testid={`action-approve-${a.id}`}>{busy === a.id ? (isHebrew ? 'כותבים...' : 'Writing...') : (isHebrew ? 'כתבו טיוטה' : 'Write a draft')}</button>
        {/* PRODUCT_TRUTH_DECORATIVE: rejects the proposed topic */}
        <button type="button" className="av-btn" disabled={off} onClick={() => decide(a, 'reject')} data-testid={`action-reject-${a.id}`}>{isHebrew ? 'לא עכשיו' : 'Not now'}</button>
      </div>
    );
    if (a.action_type === 'article_publish') {
      const art = drafts[a.payload?.articleId];
      return (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {/* PRODUCT_TRUTH_DECORATIVE: shows / hides the draft to read before approving */}
            <button type="button" className="av-btn" onClick={() => setOpenDraft(openDraft === a.id ? '' : a.id)} aria-expanded={openDraft === a.id} data-testid={`action-read-${a.id}`}>{isHebrew ? 'קריאת הטיוטה' : 'Read the draft'}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: publishes the approved article on the public site (the site rebuilds itself) */}
            <button type="button" className="av-btn av-primary" disabled={off || !art} onClick={() => decide(a, 'approve')} data-testid={`action-approve-${a.id}`}>{isHebrew ? 'מאשר ומפרסם' : 'Approve and publish'}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: opens the one-sentence revision request for the draft */}
            <button type="button" className="av-btn" disabled={off} onClick={() => { setReviseFor(reviseFor === a.id ? '' : a.id); setReviseNote(''); }} data-testid={`action-revise-${a.id}`}>{isHebrew ? 'בקשת תיקון' : 'Ask for a change'}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: rejects the draft - it is never published */}
            <button type="button" className="av-btn" disabled={off} onClick={() => decide(a, 'reject')} data-testid={`action-reject-${a.id}`}>{isHebrew ? 'לא עכשיו' : 'Not now'}</button>
          </div>
          {reviseFor === a.id && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end', marginTop: 8 }}>
              <label className="av-field" style={{ flex: '1 1 260px' }}><span>{isHebrew ? 'מה לתקן? (משפט אחד)' : 'What to change? (one sentence)'}</span>
                <textarea maxLength={500} value={reviseNote} onChange={(e) => setReviseNote(e.target.value)} data-testid={`action-revise-note-${a.id}`} style={{ minHeight: 60 }} /></label>
              {/* PRODUCT_TRUTH_DECORATIVE: sends the revision request - the draft is rewritten, still unpublished */}
              <button type="button" className="av-btn av-primary" disabled={off || reviseNote.trim().length < 3}
                onClick={async () => { const r = await act({ action: 'revise', id: a.id, note: reviseNote }, () => (isHebrew ? 'הטיוטה תוקנה. קראו אותה שוב.' : 'The draft was revised. Read it again.')); if (r?.ok) setReviseFor(''); }}
                data-testid={`action-revise-send-${a.id}`}>{isHebrew ? 'שליחה' : 'Send'}</button>
            </div>
          )}
          {openDraft === a.id && art && <ArticlePreview article={art} isHebrew={isHebrew} />}
        </>
      );
    }
    return (
      <>
        {a.payload?.prompt_he && <details style={{ marginTop: 6 }}><summary>{isHebrew ? 'ההוראה ל־Claude' : 'The instruction for Claude'}</summary><pre dir="auto" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.85rem', margin: '6px 0 0' }}>{a.payload.prompt_he}</pre></details>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {/* PRODUCT_TRUTH_DECORATIVE: approves the code task - the full instruction for Claude is emailed to the Owner */}
          <button type="button" className="av-btn av-primary" disabled={off} onClick={() => decide(a, 'approve')} data-testid={`action-approve-${a.id}`}>{isHebrew ? 'מאשר' : 'Approve'}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: rejects the proposed code task */}
          <button type="button" className="av-btn" disabled={off} onClick={() => decide(a, 'reject')} data-testid={`action-reject-${a.id}`}>{isHebrew ? 'לא עכשיו' : 'Not now'}</button>
        </div>
      </>
    );
  };

  return (
    <AdminScreenFrame
      title={title}
      subtitle={isHebrew ? 'הסוכנים קוראים ומדווחים. מנהלת הסוכנים מרכזת את הכול ומציעה מה לעשות, ומבצעת רק מה שאישרתם. בכל יום ראשון בבוקר מגיע אליכם דוח אחד במייל.'
        : 'The agents read and report. The agents manager gathers it all, proposes what to do, and acts only on what you approve. Every Sunday morning one report arrives by email.'}
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
                    <div className="av-kpi-value" data-testid="admin-agents-room-cost"><N v={`$${usd(Number(state.monthCostUsd))}`} /></div>
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
                  <div className="av-card av-accent-top">
                    <div className="av-label">{isHebrew ? 'מחכה לאישורכם' : 'Waiting for your approval'}</div>
                    <div className="av-kpi-value" data-testid="agents-pending-count"><N v={pending.length} /></div>
                  </div>
                </div>
                {!state.googleConfigured && (
                  <div className="av-notice av-bad av-section" role="alert">{isHebrew ? 'המפתח של גוגל לא מוגדר בשרת, ולכן סוכן הקידום לא יכול לרוץ.' : 'The Google key is not set on the server, so the SEO agent cannot run.'}</div>
                )}
                {notice && <div className={`av-notice ${notice.good ? '' : 'av-bad'} av-section`} role="status" data-testid="admin-agents-room-notice">{notice.text}</div>}

                {/* the manager's desk */}
                <section className="av-card av-section" data-testid="agent-card-manager" data-status={lastManager?.status || 'never'} style={{ borderColor: '#315f6f' }}>
                  <AgentHead agent="manager" meta={MANAGER} profile={profiles.manager} isHebrew={isHebrew} size={72} onSaved={load} onNotice={setNotice} />
                  <p className="av-muted" style={{ fontSize: '0.85rem', margin: '0 0 8px' }}>{isHebrew ? MANAGER.roleHe : MANAGER.roleEn}</p>
                  {lastManager ? (
                    <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                      <span style={{ color: (STATUS[lastManager.status] || STATUS.failed).color, fontWeight: 600 }}>{L(STATUS[lastManager.status] || STATUS.failed)}</span>
                      {' · '}<N v={formatShortDateTime(lastManager.finished_at || lastManager.started_at, market)} />
                      {lastManager.error && <> · <bdi dir="ltr">{lastManager.error}</bdi></>}
                    </div>
                  ) : <p className="av-muted" style={{ fontSize: '0.85rem' }}>{isHebrew ? `${managerName} עוד לא סיכמה שבוע. היא תרוץ ביום ראשון, או עכשיו בכפתור.` : `${managerName} has not summarized a week yet. She runs on Sunday, or now with the button.`}</p>}
                  {managerSummary && <p style={{ fontSize: '0.98rem', lineHeight: 1.65, margin: '0 0 10px', fontWeight: 500 }} data-testid="agent-summary-manager">{managerSummary}</p>}
                  {/* PRODUCT_TRUTH_DECORATIVE: runs the agents manager now (once an hour at most) - she only proposes; nothing is done without approval */}
                  <button type="button" className="av-pill" onClick={() => run('manager')} disabled={!!busy} data-testid="agent-run-manager">
                    {busy === 'manager' ? (isHebrew ? 'רצה...' : 'Running...') : (isHebrew ? 'הרץ עכשיו' : 'Run now')}
                  </button>

                  <h4 style={{ margin: '16px 0 8px' }}>{isHebrew ? 'מחכה לאישורכם' : 'Waiting for your approval'}</h4>
                  {pendingOthers.length ? (
                    <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 10 }} data-testid="agents-pending">
                      {pendingOthers.map((a) => <ActionRow key={a.id} a={a} isHebrew={isHebrew} market={market}>{pendingButtons(a)}</ActionRow>)}
                    </ul>
                  ) : !socialWaiting && <p className="av-muted" style={{ fontSize: '0.88rem' }} data-testid="agents-pending-empty">{isHebrew ? 'אין כרגע שום דבר שמחכה לכם.' : 'Nothing is waiting for you right now.'}</p>}

                  {/* Owner 2026-10-27: every social post comes to the manager's desk - waiting, ready to publish, published */}
                  <details style={{ marginTop: 14 }} open={socialWaiting > 0} data-testid="agents-social-posts">
                    <summary style={{ fontWeight: 600 }}>{isHebrew ? 'פוסטים לרשתות החברתיות' : 'Social media posts'} · <N v={socialWaiting} /> {isHebrew ? 'מחכים' : 'waiting'}</summary>
                    <div style={{ marginTop: 8 }}><AdminSocialPosts isHebrew={isHebrew} embedded key={updatedAt || 'first'} /></div>
                  </details>

                  {withClaude.length > 0 && (
                    <>
                      <h4 style={{ margin: '16px 0 8px' }}>{isHebrew ? 'אצל Claude: אושר ומחכה לביצוע' : 'With Claude: approved, waiting to be done'}</h4>
                      <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 10 }} data-testid="agents-with-claude">
                        {withClaude.map((a) => (
                          <ActionRow key={a.id} a={a} isHebrew={isHebrew} market={market}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                              {/* PRODUCT_TRUTH_DECORATIVE: copies the full instruction to paste into the conversation with Claude */}
                              <button type="button" className="av-btn av-primary" onClick={() => copy(a.payload?.prompt_he || '')} data-testid={`action-copy-${a.id}`}>{isHebrew ? 'העתקת ההוראה ל־Claude' : 'Copy the instruction for Claude'}</button>
                              {/* PRODUCT_TRUTH_DECORATIVE: marks the approved code task as done */}
                              <button type="button" className="av-btn" disabled={!!busy} onClick={() => act({ action: 'mark_done', id: a.id }, () => (isHebrew ? 'סומן כבוצע.' : 'Marked as done.'))} data-testid={`action-done-${a.id}`}>{isHebrew ? 'בוצע' : 'Done'}</button>
                            </div>
                          </ActionRow>
                        ))}
                      </ul>
                    </>
                  )}

                  {info.length > 0 && (
                    <>
                      <h4 style={{ margin: '16px 0 8px' }}>{isHebrew ? 'לידיעה, אין מה לעשות' : 'For your information - nothing to do'}</h4>
                      <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 10 }} data-testid="agents-info">
                        {info.map((a) => <ActionRow key={a.id} a={a} isHebrew={isHebrew} market={market} />)}
                      </ul>
                    </>
                  )}

                  {history.length > 0 && (
                    <details style={{ marginTop: 14 }} data-testid="agents-history">
                      <summary>{isHebrew ? 'מה כבר טופל' : 'Already handled'}</summary>
                      <ul style={{ margin: '8px 0 0', padding: 0, display: 'grid', gap: 8 }}>
                        {history.map((a) => (
                          <ActionRow key={a.id} a={a} isHebrew={isHebrew} market={market}>
                            {a.action_type === 'article_publish' && a.status === 'done' && a.result?.deploy && a.result.deploy !== 'ok' && (
                              <div style={{ marginTop: 6 }} data-testid={`article-rebuild-${a.id}`}>
                                <div className="av-notice av-bad">{a.result.deploy === 'failed' ? REBUILD_FAILED[isHebrew ? 'he' : 'en']
                                  : (isHebrew ? 'קישור הבנייה מחדש עוד לא הוגדר, ולכן גוגל יראה את המאמר רק בעדכון הבא של האתר.' : 'The rebuild link is not set yet, so Google sees the article with the next site update.')}</div>
                                {/* PRODUCT_TRUTH_DECORATIVE: starts the site rebuild again for this approved article (no second approval - Codex F22) */}
                                <button type="button" className="av-btn" style={{ marginTop: 6 }} disabled={!!busy} onClick={() => act({ action: 'redeploy', id: a.id },
                                  (r) => (r.deploy === 'ok' ? (isHebrew ? 'האתר נבנה מחדש, וזה לוקח כ־2 דקות.' : 'The site is rebuilding; it takes about 2 minutes.') : REBUILD_FAILED[isHebrew ? 'he' : 'en']))}
                                  data-testid={`article-rebuild-btn-${a.id}`}>{isHebrew ? 'בנייה מחדש' : 'Rebuild the site'}</button>
                              </div>
                            )}
                          </ActionRow>
                        ))}
                      </ul>
                    </details>
                  )}
                </section>

                {/* Owner 2026-10-27: 6 places, at most 3 per row; every card has the same height and a long report scrolls inside its own box */}
                <div className="av-section" data-testid="agents-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(max(260px, calc((100% - 28px) / 3)), 1fr))' }}>
                  {AGENTS.map((a) => {
                    const mine = runs.filter((r) => r.agent === a.id);
                    const last = mine[0];
                    const st = last ? STATUS[last.status] || STATUS.failed : null;
                    const summary = last ? (isHebrew ? last.summary : last.data?.summaryEn || last.summary) : null;
                    return (
                      <section key={a.id} className="av-card" data-testid={`agent-card-${a.id}`} data-status={last?.status || 'never'}
                        style={{ display: 'flex', flexDirection: 'column', height: 520, minWidth: 0 }}>
                        <AgentHead agent={a.id} meta={a} profile={profiles[a.id]} isHebrew={isHebrew} size={56} onSaved={load} onNotice={setNotice} />
                        <p className="av-muted" style={{ fontSize: '0.85rem', margin: '0 0 10px' }}>{isHebrew ? a.roleHe : a.roleEn}</p>
                        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingInlineEnd: 4 }} data-testid={`agent-body-${a.id}`} tabIndex={0}>
                        {last ? (
                          <>
                            <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                              <span style={{ color: st.color, fontWeight: 600 }}>{L(st)}</span>
                              {' · '}<N v={formatShortDateTime(last.finished_at || last.started_at, market)} />
                              {' · '}{last.trigger === 'cron' ? (String(last.run_key).startsWith('daily:') ? (isHebrew ? 'ריצה יומית' : 'daily run') : (isHebrew ? 'ריצה שבועית' : 'weekly run')) : (isHebrew ? 'הרצה ידנית' : 'run now')}
                            </div>
                            {summary && <p style={{ fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 8px' }} data-testid={`agent-summary-${a.id}`}>{summary}</p>}
                            {last.error && <p className="av-muted" style={{ fontSize: '0.8rem' }}>{isHebrew ? 'קוד: ' : 'Code: '}<bdi dir="ltr">{last.error}</bdi></p>}
                            {Array.isArray(last.findings) && last.findings.length > 0 && (
                              <ul style={{ margin: '0 0 8px', paddingInlineStart: 18, fontSize: '0.85rem', lineHeight: 1.6 }} data-testid={`agent-findings-${a.id}`}>
                                {last.findings.map((f, i) => (
                                  <li key={i} style={{ color: LEVEL_COLOR[f.level] || undefined }}>
                                    {f.inquiryId && onOpenInquiry ? (
                                      // PRODUCT_TRUTH_DECORATIVE: opens this inquiry in the inquiries screen (Owner 2026-10-27, L-22)
                                      <button type="button" className="av-link" onClick={() => onOpenInquiry(f.inquiryId)} data-testid={`agent-inquiry-${f.inquiryId}`}
                                        style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textDecoration: 'underline', cursor: 'pointer', textAlign: 'start', minHeight: 24 }}>
                                        {isHebrew ? f.he : f.en}
                                      </button>
                                    ) : (isHebrew ? f.he : f.en)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        ) : <p className="av-muted" style={{ fontSize: '0.85rem' }}>{isHebrew ? 'עוד לא רץ.' : 'Has not run yet.'}</p>}
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
                        </div>
                        {/* PRODUCT_TRUTH_DECORATIVE: runs this agent now (once an hour at most); it only reads and reports, or prepares posts that wait for approval */}
                        <button type="button" className="av-pill" onClick={() => run(a.id)} disabled={!!busy} data-testid={`agent-run-${a.id}`} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                          {busy === a.id ? (isHebrew ? 'רץ...' : 'Running...') : (isHebrew ? 'הרץ עכשיו' : 'Run now')}
                        </button>
                      </section>
                    );
                  })}
                  {Array.from({ length: Math.max(0, GRID_SLOTS - AGENTS.length) }, (_, i) => (
                    <div key={`slot-${i}`} className="av-card" data-testid="agent-slot-empty"
                      style={{ height: 520, border: '2px dashed #cfdbdf', background: 'transparent', boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="av-muted" style={{ fontSize: '0.9rem' }}>{isHebrew ? 'מקום פנוי לסוכן נוסף' : 'Room for another agent'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
      </article>
    </AdminScreenFrame>
  );
}
