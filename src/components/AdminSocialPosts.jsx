// Owner console 2026-10-27, typed: "מאשר את שלב 1 של סוכנת הרשתות" (plan docs/SOCIAL_AGENT_PLAN_2026-10-27.md) + the supervisor screen
// (L-22, "מאשר את שניהם"): the social agent's posts - waiting for approval, ready to publish, published. Stage 1 posts NOTHING: "approve"
// marks a post ready; the Owner (or a supervisor holding social.publish) copies the text, downloads the image, posts it, then marks it
// published. Every account is ONE market - an Israeli post is Hebrew right-to-left, an international post English left-to-right.
// Reads / acts through the agents-room function (social_state / decide / revise / mark_done); the function checks the permission again.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import AgentAvatar from './AgentAvatar';
import { formatShortDateTime } from '../utils/shortDate';
import { ADMIN_DATE_MARKET } from '../utils/adminDates';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import './adminUsers.css';
import './adminV2.css';

const NETWORK = { facebook: { he: 'פייסבוק', en: 'Facebook' }, instagram: { he: 'אינסטגרם', en: 'Instagram' }, tiktok: { he: 'טיקטוק', en: 'TikTok' } };
const MARKET = { il: { he: 'ישראל · עברית', en: 'Israel · Hebrew' }, intl: { he: 'חו״ל · אנגלית', en: 'International · English' } };
const N = ({ v }) => <bdi className="av-num">{v}</bdi>;

async function callFn(body) {
  try {
    const { data, error } = await supabase.functions.invoke('agents-room', { body });
    if (!error) return data;
    return (await error?.context?.json?.().catch(() => null)) || { ok: false, code: 'unavailable' };
  } catch { return { ok: false, code: 'unavailable' }; }
}

const fullText = (p) => [p.text, (p.hashtags || []).join(' '), p.link].filter(Boolean).join('\n\n');

// stage 2 (Owner 2026-10-27, "מאשר את שלב 2 של סוכנת הרשתות"): only a Meta address the server returned is ever a link
const postLink = (u) => (typeof u === 'string' && /^https:\/\/www\.(facebook|instagram)\.com\//.test(u) ? u : null);

// 20261029000000 (Codex F08 / F10): the failure in plain words by Meta's reason; an outcome not known asks for a check first
const NETWORK_NAME = { facebook: { he: 'בפייסבוק', en: 'on Facebook' }, instagram: { he: 'באינסטגרם', en: 'on Instagram' } };
function publishFailureText(error, isHebrew) {
  const code = /meta_\d+_(\d+)/.exec(error || '')?.[1] || '';
  if (code === '190') return isHebrew ? 'החיבור לדף פג. צריך לחבר את הדף מחדש, ואחר כך ללחוץ "פרסום עכשיו".' : 'The connection to the page expired. Reconnect the page, then press "Publish now".';
  if (['10', '200', '3'].includes(code)) return isHebrew ? 'לדף חסרה הרשאת פרסום. צריך לחבר אותו מחדש עם הרשאות הפרסום.' : 'The page is missing the publishing permission. Reconnect it with the publishing permissions.';
  if (['4', '17', '32', '613'].includes(code)) return isHebrew ? 'מטא הגבילו את הפרסום זמנית. נסו שוב מאוחר יותר.' : 'Meta limited publishing for now. Try again later.';
  return isHebrew ? 'הפרסום האוטומטי לא הצליח. אפשר לנסות שוב ב"פרסום עכשיו", או לפרסם את הפוסט ידנית ולסמן "פורסם".' : 'The automatic publication failed. You can try again with "Publish now", or publish the post by hand and mark it "Published".';
}

// Codex release 8 (Owner console 2026-10-30, typed: "מאשר להוסיף לשחרור 8 תשובות של שירה לתגובות, כטיוטה לאישור שלי", L-22): a comment on our
// post and Shira's draft reply - published only with the Owner's approval, with the text as approved (edited or the draft). A sensitive
// comment comes without a draft: the Owner writes the answer. The comment's text is kept 30 days.
const REPLY = {
  sensitive: { he: 'נושא רגיש (כסף, ביטול, פרטיות או תלונה): שירה לא כתבה טיוטה. כתבו את התשובה בעצמכם.', en: 'A sensitive topic (money, cancellation, privacy or a complaint): Shira wrote no draft. Write the answer yourselves.' },
  label: { he: 'התשובה שתפורסם', en: 'The reply that will be published' },
  approve: { he: 'אישור ופרסום התשובה', en: 'Approve and publish the reply' },
  purged: { he: 'טקסט התגובה נמחק אחרי 30 יום.', en: 'The comment text was deleted after 30 days.' },
};
const WHERE = { fb_il: { he: 'פייסבוק ישראל', en: 'Facebook Israel' }, fb_intl: { he: 'פייסבוק חו״ל', en: 'Facebook international' }, ig_il: { he: 'אינסטגרם ישראל', en: 'Instagram Israel' }, ig_intl: { he: 'אינסטגרם חו״ל', en: 'Instagram international' } };
function ReplyCard({ a, isHebrew, canPublish, busy, onAct }) {
  const p = a.payload || {};
  const [text, setText] = useState(p.draft || '');
  const off = !!busy || !canPublish;
  const where = WHERE[p.channel] ? (isHebrew ? WHERE[p.channel].he : WHERE[p.channel].en) : p.channel;
  return (
    <li className="av-card" style={{ listStyle: 'none', padding: 12 }} data-testid={`social-reply-${a.id}`}>
      <div className="av-muted" style={{ fontSize: '0.82rem' }}>{where}{p.author ? <> · <bdi>{p.author}</bdi></> : null}</div>
      {p.comment_text ? <p dir="auto" style={{ margin: '6px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.comment_text}</p>
        : <p className="av-muted" style={{ margin: '6px 0', fontSize: '0.85rem' }}>{isHebrew ? REPLY.purged.he : REPLY.purged.en}</p>}
      {p.sensitive && <div className="av-notice av-bad" role="note" style={{ margin: '6px 0' }} data-testid={`social-reply-sensitive-${a.id}`}>{isHebrew ? REPLY.sensitive.he : REPLY.sensitive.en}</div>}
      {a.status === 'proposed' && (
        <>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>{isHebrew ? REPLY.label.he : REPLY.label.en}
            <textarea dir={p.market === 'il' ? 'rtl' : 'ltr'} rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} disabled={off} data-testid={`social-reply-text-${a.id}`} />
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {/* PRODUCT_TRUTH_DECORATIVE: publishes this reply under the comment, with the approved text (Owner 2026-10-30, release 8) */}
            <button type="button" className="av-btn av-primary" disabled={off || text.trim().length < 2} onClick={() => onAct({ action: 'decide', id: a.id, decision: 'approve', text })} data-testid={`social-reply-approve-${a.id}`}>{isHebrew ? REPLY.approve.he : REPLY.approve.en}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: no reply to this comment */}
            <button type="button" className="av-btn" disabled={off} onClick={() => onAct({ action: 'decide', id: a.id, decision: 'reject' })} data-testid={`social-reply-reject-${a.id}`}>{isHebrew ? 'לא עכשיו' : 'Not now'}</button>
          </div>
        </>
      )}
      {a.status === 'done' && <p className="av-muted" style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>{isHebrew ? 'התשובה פורסמה: ' : 'The reply was published: '}<span dir="auto">{p.approved_text}</span></p>}
      {a.error && /^publish_/.test(a.error) && <div className="av-notice av-bad" role="alert" style={{ marginTop: 6 }}>{publishFailureText(a.error, isHebrew)}</div>}
    </li>
  );
}
// the results of a published post: what the current permissions allow; reach missing = said so, never 0
function PostResults({ m, isHebrew }) {
  if (!m) return <p className="av-muted" style={{ margin: '6px 0 0', fontSize: '0.82rem' }} data-testid="social-metrics-unavailable">{isHebrew ? 'נתוני הפוסט אינם זמינים בהרשאות הנוכחיות.' : 'Post metrics are unavailable with the current permissions.'}</p>;
  const part = (he, en, v) => (v === null || v === undefined ? null : <span>{isHebrew ? he : en} <N v={v} /></span>);
  return (
    <p className="av-muted" style={{ margin: '6px 0 0', fontSize: '0.82rem', display: 'flex', gap: 10, flexWrap: 'wrap' }} data-testid={`social-metrics-${m.actionId}`}>
      {part('לייקים', 'Likes', m.likes)}{part('תגובות', 'Comments', m.comments)}{part('שיתופים', 'Shares', m.shares)}
      {m.reachAvailable ? part('חשיפה', 'Reach', m.reach) : <span>{isHebrew ? 'חשיפה: נתוני הפוסט אינם זמינים בהרשאות הנוכחיות.' : 'Reach: post metrics are unavailable with the current permissions.'}</span>}
    </p>
  );
}

function PostCard({ a, isHebrew, canPublish, busy, onAct, onCopy, auto, metrics }) {
  const p = a.payload || {};
  const published = postLink(a.result?.url);
  const failed = a.status === 'approved' && /^publish_failed/.test(a.error || '');
  // no clear answer from Meta, or a publication that never finished: the post may already be online
  const unknown = a.status === 'approved' && (/^publish_unknown/.test(a.error || '') || (/^publishing:/.test(a.error || '') && Date.now() - Date.parse(a.decided_at || 0) >= 120000));
  const [revising, setRevising] = useState(false);
  const [note, setNote] = useState('');
  const net = NETWORK[p.network] || NETWORK.facebook;
  const mk = MARKET[p.market] || MARKET.intl;
  const lang = p.market === 'il' ? 'he' : 'en';
  const off = !!busy;
  return (
    <li style={{ border: '1px solid #dfe7ea', borderRadius: 10, padding: 12, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 12 }} data-testid={`social-post-${a.id}`} data-status={a.status}>
      <img src={`/social/art/${p.art}.jpg`} alt="" width="112" height="112" loading="lazy" style={{ borderRadius: 8, border: '1px solid #dfe7ea', flex: '0 0 auto' }} data-testid={`social-post-art-${a.id}`} />
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <span className="av-badge">{isHebrew ? net.he : net.en}</span>
          <span className="av-badge">{isHebrew ? mk.he : mk.en}</span>
          {p.accountOpen === false && !auto && <span className="av-badge av-warn">{isHebrew ? 'החשבון עוד לא נפתח' : 'The account is not open yet'}</span>}
          {auto && <span className="av-badge av-ok" data-testid={`social-auto-${a.id}`}>{isHebrew ? 'מחובר: יפורסם אוטומטית' : 'Connected: published automatically'}</span>}
          <span className="av-muted" style={{ fontSize: '0.78rem' }}><N v={formatShortDateTime(a.done_at || a.decided_at || a.created_at, ADMIN_DATE_MARKET)} /></span>
        </div>
        {/* the post in ITS account's language and direction (the Owner's market rule) */}
        <div lang={lang} dir={lang === 'he' ? 'rtl' : 'ltr'} style={{ whiteSpace: 'pre-line', lineHeight: 1.6, fontSize: '0.92rem' }} data-testid={`social-post-text-${a.id}`}>
          {p.text}
          {p.hashtags?.length > 0 && <div style={{ marginTop: 6, color: '#315f6f' }}>{p.hashtags.join(' ')}</div>}
          {p.link && <div style={{ marginTop: 4 }}><bdi dir="ltr" className="av-muted" style={{ fontSize: '0.82rem' }}>{p.link}</bdi></div>}
        </div>
        {p.network === 'tiktok' && (
          <details style={{ marginTop: 8 }} data-testid={`social-post-video-${a.id}`}>
            <summary>{isHebrew ? 'התסריט וההנחיות לכלי הווידאו' : 'The script and the video tool prompts'}</summary>
            <p lang={lang} dir={lang === 'he' ? 'rtl' : 'ltr'} style={{ margin: '6px 0', fontSize: '0.88rem', whiteSpace: 'pre-line' }}>{p.video_script}</p>
            <ol lang="en" dir="ltr" style={{ margin: 0, paddingInlineStart: 20, fontSize: '0.85rem' }}>{(p.video_scenes || []).map((s) => <li key={s}>{s}</li>)}</ol>
          </details>
        )}
        {canPublish && a.status === 'proposed' && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {/* PRODUCT_TRUTH_DECORATIVE: approves the post - it becomes ready to publish; nothing is posted by the system */}
              <button type="button" className="av-btn av-primary" disabled={off} onClick={() => onAct({ action: 'decide', id: a.id, decision: 'approve' })} data-testid={`social-approve-${a.id}`}>
                {auto ? (isHebrew ? 'מאשר ומפרסם' : 'Approve and publish') : (isHebrew ? 'מאשר' : 'Approve')}
              </button>
              {/* PRODUCT_TRUTH_DECORATIVE: opens the one-sentence change request for the post */}
              <button type="button" className="av-btn" disabled={off} onClick={() => { setRevising(!revising); setNote(''); }} data-testid={`social-revise-${a.id}`}>{isHebrew ? 'בקשת תיקון' : 'Ask for a change'}</button>
              {/* PRODUCT_TRUTH_DECORATIVE: rejects the post - it is never published */}
              <button type="button" className="av-btn" disabled={off} onClick={() => onAct({ action: 'decide', id: a.id, decision: 'reject' })} data-testid={`social-reject-${a.id}`}>{isHebrew ? 'לא עכשיו' : 'Not now'}</button>
            </div>
            {revising && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end', marginTop: 8 }}>
                <label className="av-field" style={{ flex: '1 1 240px' }}><span>{isHebrew ? 'מה לתקן? (משפט אחד)' : 'What to change? (one sentence)'}</span>
                  <textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 56 }} data-testid={`social-revise-note-${a.id}`} /></label>
                {/* PRODUCT_TRUTH_DECORATIVE: sends the change request - the post is rewritten for the same account, still waiting */}
                <button type="button" className="av-btn av-primary" disabled={off || note.trim().length < 3}
                  onClick={async () => { const r = await onAct({ action: 'revise', id: a.id, note }); if (r?.ok) setRevising(false); }} data-testid={`social-revise-send-${a.id}`}>{isHebrew ? 'שליחה' : 'Send'}</button>
              </div>
            )}
          </>
        )}
        {failed && <div className="av-notice av-bad" style={{ marginTop: 8 }} data-testid={`social-failed-${a.id}`}>{publishFailureText(a.error, isHebrew)}</div>}
        {unknown && <div className="av-notice av-bad" style={{ marginTop: 8 }} data-testid={`social-unknown-${a.id}`}>{isHebrew
          ? `לא ברור אם הפוסט פורסם. בדקו בדף ${(NETWORK_NAME[p.network] || NETWORK_NAME.facebook).he} לפני שמפרסמים שוב, כדי שלא יופיע פעמיים.`
          : `We could not confirm whether the post was published. Check the page ${(NETWORK_NAME[p.network] || NETWORK_NAME.facebook).en} before publishing again, so it does not appear twice.`}</div>}
        {published && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }} data-testid={`social-link-${a.id}`}>
            <span className="av-muted" style={{ fontSize: '0.85rem' }}>{isHebrew ? 'פורסם אוטומטית:' : 'Published automatically:'}</span>
            <bdi dir="ltr" style={{ fontSize: '0.82rem', wordBreak: 'break-all' }}>{published}</bdi>
            {/* PRODUCT_TRUTH_DECORATIVE: copies the address of the post the system published (the admin never opens another tab) */}
            <button type="button" className="av-btn" onClick={() => onCopy(published, isHebrew ? 'הקישור לפוסט הועתק.' : 'The link to the post was copied.')} data-testid={`social-copy-link-${a.id}`}>{isHebrew ? 'העתקת הקישור לפוסט' : 'Copy the post link'}</button>
          </div>
        )}
        {metrics !== undefined && <PostResults m={metrics} isHebrew={isHebrew} />}
        {canPublish && a.status === 'approved' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {auto && !unknown && (
              /* PRODUCT_TRUTH_DECORATIVE: publishes the approved post now to its connected account (once - Owner 2026-10-27, "מאשר") */
              <button type="button" className="av-btn av-primary" disabled={off} onClick={() => onAct({ action: 'publish_now', id: a.id })} data-testid={`social-publish-now-${a.id}`}>{isHebrew ? 'פרסום עכשיו' : 'Publish now'}</button>
            )}
            {auto && unknown && (
              /* PRODUCT_TRUTH_DECORATIVE: the Owner checked the page and the post is not there - publishes it now (Codex F08) */
              <button type="button" className="av-btn av-primary" disabled={off} onClick={() => onAct({ action: 'publish_now', id: a.id, confirm: 'not_published' })} data-testid={`social-publish-confirmed-${a.id}`}>{isHebrew ? 'הפוסט לא פורסם, לפרסם עכשיו' : 'It was not published - publish now'}</button>
            )}
            {/* PRODUCT_TRUTH_DECORATIVE: copies the post (text, hashtags, link) to paste into the network */}
            <button type="button" className={auto ? 'av-btn' : 'av-btn av-primary'} onClick={() => onCopy(fullText(p), isHebrew ? 'הטקסט הועתק. הדביקו אותו ברשת.' : 'The text was copied. Paste it into the network.')} data-testid={`social-copy-${a.id}`}>{isHebrew ? 'העתקת הטקסט' : 'Copy the text'}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: downloads the post's square image */}
            <a className="av-btn" href={`/social/art/${p.art}.jpg`} download={`tekango-${p.art}.jpg`} data-testid={`social-download-${a.id}`}>{isHebrew ? 'הורדת התמונה' : 'Download the image'}</a>
            {p.network === 'tiktok' && (
              /* PRODUCT_TRUTH_DECORATIVE: copies the TikTok script and the video tool prompts */
              <button type="button" className="av-btn" onClick={() => onCopy([p.video_script, ...(p.video_scenes || []).map((s, i) => `${i + 1}. ${s}`)].join('\n'), isHebrew ? 'התסריט הועתק.' : 'The script was copied.')} data-testid={`social-copy-script-${a.id}`}>{isHebrew ? 'העתקת התסריט' : 'Copy the script'}</button>
            )}
            {/* PRODUCT_TRUTH_DECORATIVE: marks the post as published by hand */}
            <button type="button" className="av-btn" disabled={off} onClick={() => onAct({ action: 'mark_done', id: a.id })} data-testid={`social-published-${a.id}`}>{isHebrew ? 'פורסם' : 'Published'}</button>
          </div>
        )}
      </div>
    </li>
  );
}

// embedded = inside the agents room (no screen frame of its own)
export default function AdminSocialPosts({ isHebrew = true, embedded = false }) {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(() => {
    callFn({ action: 'social_state' }).then((d) => {
      setState(d?.ok ? d : { failed: d?.code || 'unavailable' });
      if (d?.ok) setUpdatedAt(new Date().toISOString());
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const onAct = async (body) => {
    setBusy(body.id); setNotice(null);
    const r = await callFn(body);
    setBusy('');
    // Codex release 8: a reply to a comment speaks of the reply
    const okText = body.text !== undefined && r?.status === 'published' ? (isHebrew ? 'התשובה פורסמה מתחת לתגובה.' : 'The reply was published under the comment.')
      : body.text !== undefined && (r?.status === 'failed' || r?.status === 'unknown') ? `${isHebrew ? 'התשובה לא פורסמה.' : 'The reply was not published.'} ${publishFailureText(r.publishError || '', isHebrew)}`
      : r?.status === 'published' ? (isHebrew ? 'הפוסט פורסם. הקישור אליו מופיע ברשימת "פורסמו לאחרונה".' : 'The post was published. Its link is in "Published lately".')
      : r?.status === 'unknown' ? (isHebrew ? 'לא התקבלה תשובה ברורה ממטא, ולכן לא ברור אם הפוסט פורסם. בדקו בדף לפני שמפרסמים שוב.' : 'Meta gave no clear answer, so it is not clear whether the post was published. Check the page before publishing again.')
      : r?.status === 'ready' && r?.publishError && body.action === 'publish_now' ? `${publishFailureText(r.publishError, isHebrew)} ${isHebrew ? 'הפוסט עדיין מחכה למטה.' : 'The post still waits below.'}`
      : r?.status === 'ready' && r?.publishError ? `${isHebrew ? 'אושר, אבל הפוסט לא פורסם.' : 'Approved, but the post was not published.'} ${publishFailureText(r.publishError, isHebrew)}`
      : r?.status === 'ready' ? (isHebrew ? 'אושר. הפוסט מוכן לפרסום למטה.' : 'Approved. The post is ready to publish below.')
      : r?.status === 'rejected' ? (isHebrew ? 'הוסר מהרשימה.' : 'Removed from the list.')
        : r?.status === 'revised' ? (isHebrew ? 'הפוסט תוקן. קראו אותו שוב.' : 'The post was revised. Read it again.')
          : (isHebrew ? 'סומן כפורסם.' : 'Marked as published.');
    const failText = r?.code === 'reply_invalid' ? (isHebrew ? 'התשובה צריכה להיות בשפת החשבון, קצרה, ובלי מחירים או מבצעים.' : 'The reply must be in the account\'s language, short, and without prices or offers.')
      : r?.code === 'not_connected' ? (isHebrew ? 'החשבון לא מחובר, ולכן אי אפשר לפרסם את התשובה מכאן.' : 'The account is not connected, so the reply cannot be published from here.')
      : r?.code === 'cap_reached' ? (isHebrew ? 'הגענו לתקרת העלות החודשית.' : 'The monthly cost cap was reached.')
      // Codex release 4 (Owner 2026-10-29, L-22): the AI budget reservation refused the rewrite - the spec's words
      : r?.code === 'budget_insufficient' ? (isHebrew ? 'אין בתקציב הבינה החודשי יתרה מספקת לפעולה הזו. לא בוצעה קריאה לבינה.' : 'The monthly AI budget does not have enough available funds for this action. No AI request was made.')
      : r?.code === 'budget_blocked' ? (isHebrew ? 'תקציב הבינה נעצר, כי קריאה אחת עלתה יותר מהסכום שנשמר לה. לא יישלחו עוד קריאות לבינה.' : 'The AI budget was stopped because one request cost more than the amount reserved for it. No further AI requests will be sent.')
      // Codex R4-08 / R4-09: an earlier attempt of this rewrite may have cost money; an unknown outcome is never retried by itself
      : r?.code === 'budget_stopped' ? (isHebrew ? 'תקציב הבינה עצר ניסיונות נוספים. ייתכן שניסיון קודם בפעולה הזו כבר עלה כסף.' : 'The AI budget stopped further attempts. An earlier attempt in this action may already have cost money.')
      : r?.code === 'ai_unknown_outcome' ? (isHebrew ? 'לא התקבלה תשובה ברורה מהבינה. הסכום נשאר שמור, ולא נשלח ניסיון נוסף. אפשר לנסות שוב מאוחר יותר.' : 'The AI gave no clear answer. The amount stays reserved and no further attempt was sent. You can try again later.')
      : r?.code === 'forbidden' ? (isHebrew ? 'אין לכם הרשאה לפעולה הזו.' : 'You do not have permission for this action.')
        : r?.code === 'revise_limit' ? (isHebrew ? 'הפוסט כבר תוקן 3 פעמים. אפשר לאשר אותו או לבחור "לא עכשיו".' : 'This post was already revised 3 times. Approve it or choose "Not now".')
          : r?.code === 'not_pending' ? (isHebrew ? 'הפוסט כבר טופל.' : 'This post was already handled.')
            : r?.code === 'publishing' ? (isHebrew ? 'הפוסט מתפרסם ממש עכשיו. רעננו בעוד דקה.' : 'The post is being published right now. Refresh in a minute.')
              : r?.code === 'not_ready' ? (isHebrew ? 'הפוסט כבר לא מחכה לפרסום.' : 'This post no longer waits to be published.')
                : r?.code === 'publish_unknown' ? (isHebrew ? 'לא ברור אם הפוסט כבר פורסם. בדקו בדף, ואם הוא לא שם לחצו "הפוסט לא פורסם, לפרסם עכשיו".' : 'It is not clear whether the post was already published. Check the page; if it is not there, press "It was not published - publish now".')
        : (isHebrew ? 'הפעולה לא הושלמה. נסו שוב.' : 'The action did not complete. Try again.');
    // a failed or unknown publication is never shown as a success (Codex F10)
    setNotice(r?.ok ? { good: !r.publishError, text: okText } : { good: false, text: failText });
    load();
    return r;
  };
  const onCopy = async (text, done) => {
    try { await navigator.clipboard.writeText(text); setNotice({ good: true, text: done }); }
    catch { setNotice({ good: false, text: isHebrew ? 'ההעתקה לא הצליחה. סמנו את הטקסט והעתיקו ידנית.' : 'Copying failed. Select the text and copy it by hand.' }); }
  };

  const ok = state && typeof state === 'object' && !state.failed;
  const posts = ok ? state.posts || [] : [];
  const canPublish = ok && !!state.canPublish;
  const waiting = posts.filter((a) => a.status === 'proposed');
  const ready = posts.filter((a) => a.status === 'approved');
  const published = posts.filter((a) => a.status === 'done').slice(0, 10);
  const name = ok && state.profile ? (isHebrew ? state.profile.name_he : state.profile.name_en) : (isHebrew ? 'סוכנת הרשתות' : 'The social agent');
  const autoChannels = ok && Array.isArray(state.autoChannels) ? state.autoChannels : [];
  const metricsBy = new Map((ok && Array.isArray(state.metrics) ? state.metrics : []).map((m) => [m.actionId, m]));
  const list = (items, testId) => <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 10 }} data-testid={testId}>{items.map((a) => <PostCard key={a.id} a={a} isHebrew={isHebrew} canPublish={canPublish} busy={busy} onAct={onAct} onCopy={onCopy} auto={autoChannels.includes(a.payload?.channel)} metrics={a.status === 'done' && a.result?.id ? (metricsBy.get(a.id) ?? null) : undefined} />)}</ul>;
  const replies = ok && Array.isArray(state.replies) ? state.replies : [];
  const repliesWaiting = replies.filter((a) => a.status === 'proposed');
  const repliesDone = replies.filter((a) => a.status !== 'proposed').slice(0, 10);

  const body = state === 'loading' ? <p className="av-muted" role="status">{t(isHebrew, C.loading.he, C.loading.en)}</p>
    : !ok ? <div className="av-notice av-bad" role="alert" data-testid="social-posts-failed">{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</div>
      : (
        <div data-testid="social-posts">
          {notice && <div className={`av-notice ${notice.good ? '' : 'av-bad'}`} role="status" style={{ marginBottom: 10 }} data-testid="social-posts-notice">{notice.text}</div>}
          {!embedded && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <AgentAvatar agent="social" size={48} />
              <p className="av-muted" style={{ margin: 0, fontSize: '0.88rem' }}>{isHebrew ? `${name} מכינה את הפוסטים בכל יום ראשון. כל חשבון בשפה ובשוק שלו בלבד.` : `${name} prepares the posts every Sunday. Every account in its own language and market only.`}</p>
            </div>
          )}
          <h4 style={{ margin: '4px 0 8px' }}>{isHebrew ? 'פוסטים שמחכים לאישור' : 'Posts waiting for approval'} · <N v={waiting.length} /></h4>
          {waiting.length ? list(waiting, 'social-waiting') : <p className="av-muted" style={{ fontSize: '0.88rem' }} data-testid="social-waiting-empty">{isHebrew ? 'אין פוסטים שמחכים.' : 'No posts are waiting.'}</p>}
          {ready.length > 0 && <><h4 style={{ margin: '16px 0 8px' }}>{isHebrew ? 'מוכן לפרסום' : 'Ready to publish'} · <N v={ready.length} /></h4>{list(ready, 'social-ready')}</>}
          <h4 style={{ margin: '16px 0 8px' }}>{isHebrew ? 'תגובות שמחכות לתשובה' : 'Comments waiting for a reply'} · <N v={repliesWaiting.length} /></h4>
          {repliesWaiting.length ? <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 10 }} data-testid="social-replies-waiting">{repliesWaiting.map((a) => <ReplyCard key={a.id} a={a} isHebrew={isHebrew} canPublish={canPublish} busy={busy} onAct={onAct} />)}</ul>
            : <p className="av-muted" style={{ fontSize: '0.88rem' }} data-testid="social-replies-empty">{isHebrew ? 'אין תגובות שמחכות.' : 'No comments are waiting.'}</p>}
          {repliesDone.length > 0 && (
            <details style={{ marginTop: 10 }} data-testid="social-replies-done">
              <summary>{isHebrew ? 'תגובות שטופלו' : 'Handled comments'}</summary>
              <ul style={{ margin: '8px 0 0', padding: 0, display: 'grid', gap: 10 }}>{repliesDone.map((a) => <ReplyCard key={a.id} a={a} isHebrew={isHebrew} canPublish={canPublish} busy={busy} onAct={onAct} />)}</ul>
            </details>
          )}
          {published.length > 0 && (
            <details style={{ marginTop: 14 }} data-testid="social-published">
              <summary>{isHebrew ? 'פורסמו לאחרונה' : 'Published lately'}</summary>
              <div style={{ marginTop: 8 }}>{list(published, 'social-published-list')}</div>
            </details>
          )}
        </div>
      );
  if (embedded) return body;
  const title = isHebrew ? 'רשתות חברתיות' : 'Social media';
  return (
    <AdminScreenFrame title={title} label={title} isHebrew={isHebrew} onRefresh={load} refreshing={state === 'loading'} updatedAt={updatedAt}
      subtitle={isHebrew ? 'פוסטים לפייסבוק, לאינסטגרם ולטיקטוק. אחרי אישור מעתיקים את הטקסט, מורידים את התמונה ומפרסמים.' : 'Posts for Facebook, Instagram and TikTok. After approval, copy the text, download the image and publish.'}
      formatTime={(v) => formatShortDateTime(v, ADMIN_DATE_MARKET)}>
      <article className="av-card" data-testid="admin-social">{body}</article>
    </AdminScreenFrame>
  );
}
