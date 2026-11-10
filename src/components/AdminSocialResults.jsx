// Owner console 2026-11-02 (typed: "מאשר את התוכנית לשירה: מדידה יומית של כל פרסום, מסך מה תופס ..."; "שהיא תבדוק גם כמה צפיות וכמה לייקים יש לכל סרטון או פרסום בכדי שנוכל לדעת את סוג הפרסום שתופס";
// "נשים לה בתיקיה, והיא תאסוף משם ותתן לי לאשר"): what catches on, the results of every post, the daily line and the stills folder. Reads what the agents-room function returned.
import { useRef, useState } from 'react';
import { engagement, summarize } from './socialResultsSummary';

const NETWORK = { facebook: { he: 'פייסבוק', en: 'Facebook' }, instagram: { he: 'אינסטגרם', en: 'Instagram' }, youtube: { he: 'יוטיוב', en: 'YouTube' } };
const MARKET = { il: { he: 'ישראל', en: 'Israel' }, intl: { he: 'חו״ל', en: 'International' } };
const KIND = { video: { he: 'סרטון', en: 'Video' }, image: { he: 'תמונה', en: 'Image' }, text: { he: 'טקסט', en: 'Text' } };
const COPY = {
  he: { title: 'מה תופס', sub: 'ממוצע לפי רשת, שוק וסוג. לייקים, תגובות ושיתופים נספרים יחד. טיקטוק לא נמדד עדיין.', none: 'עוד אין נתונים. שירה אוספת אותם פעם ביום.', posts: 'פרסומים', avgViews: 'צפיות בממוצע', avgEng: 'תגובתיות בממוצע',
    list: 'כל הפרסומים', views: 'צפיות', likes: 'לייקים', comments: 'תגובות', shares: 'שיתופים', na: 'לא זמין', open: 'פתיחה', care: 'תחזוקה יומית', noTitle: 'בלי כיתוב',
    folder: 'תיקיית הפרסומות', folderSub: 'מעלים לכאן פרסומת מוכנה. פעם ביום שירה לוקחת אחת לכל שוק ומביאה אותה לאישור שלכם לפני פרסום.', il: 'הוספה לעברית', intl: 'הוספה לאנגלית', waiting: 'מחכות בתיקייה', uploading: 'מעלה...', uploaded: 'הפרסומת נוספה לתיקייה.', failed: 'ההעלאה לא הצליחה. נסו קובץ תמונה אחר.', size: 'התמונה לא נוספה: היא לא מתאימה לפוסט, כי היא גבוהה, רחבה או קטנה מדי. מתאימה תמונה ריבועית. קובץ בגובה מסך של טלפון מיועד לסטורי ולא לכאן.' },
  en: { title: 'What catches on', sub: 'Averages by network, market and kind. Likes, comments and shares count together. TikTok is not measured yet.', none: 'No data yet. Shira collects it once a day.', posts: 'Posts', avgViews: 'Average views', avgEng: 'Average engagement',
    list: 'All posts', views: 'Views', likes: 'Likes', comments: 'Comments', shares: 'Shares', na: 'Not available', open: 'Open', care: 'Daily care', noTitle: 'No caption',
    folder: 'Ads folder', folderSub: 'Upload a ready ad here. Once a day Shira takes one per market and brings it for your approval before anything is published.', il: 'Add to Hebrew', intl: 'Add to English', waiting: 'Waiting in the folder', uploading: 'Uploading...', uploaded: 'The ad was added to the folder.', failed: 'The upload failed. Try another image file.', size: 'The image was not added: it does not fit a post, because it is too tall, too wide or too small. A square image fits. A phone-height file is for a story, not for here.' },
};
const N = ({ v }) => <bdi className="av-num">{v}</bdi>;
const safeLink = (u) => (typeof u === 'string' && /^https:\/\/([a-z]+\.)?(facebook|instagram|youtube)\.com\//.test(u) ? u : null);

// Owner 2026-11-02 (typed: "מאשר בדיקת מידות בתיקיית הפרסומות של שירה: תמונה שלא מתאימה לפוסט נדחית בהעלאה עם הסבר, כולל שינוי ב-L-22, שחרור עד הלייב"):
// the same image goes to a Facebook post and an Instagram post: 4:5 up to 1.91:1, at least 320 wide (the server checks the same)
const fitsPost = (w, h) => w >= 320 && h > 0 && w / h >= 0.8 && w / h <= 1.91;
const TOO_BIG_OR_SMALL = 'still_size';

// an ad is always stored as a JPEG: Instagram publishes JPEG only
async function toJpegBase64(file) {
  const bitmap = await createImageBitmap(file);
  if (!fitsPost(bitmap.width, bitmap.height)) throw new Error(TOO_BIG_OR_SMALL);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
}

export default function AdminSocialResults({ isHebrew = true, content = [], care = null, stillsWaiting = { il: 0, intl: 0 }, canPublish = false, upload }) {
  const l = isHebrew ? 'he' : 'en';
  const c = COPY[l];
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const market = useRef('il');
  const rows = [...content].sort((a, b) => engagement(b) - engagement(a) || (b.views ?? 0) - (a.views ?? 0));
  const num = (v) => (v === null || v === undefined ? c.na : <N v={v} />);
  const pick = (m) => { market.current = m; if (input.current) { input.current.value = ''; input.current.click(); } };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !upload) return;
    setBusy(true); setNotice(null);
    let ok;
    let bad = c.failed;
    try { ok = (await upload({ market: market.current, fileName: file.name, dataBase64: await toJpegBase64(file) })) === true; } catch (err) { ok = false; if (err?.message === TOO_BIG_OR_SMALL) bad = c.size; }
    setBusy(false);
    setNotice({ good: ok, text: ok ? c.uploaded : bad });
  };
  return (
    <section className="av-section" data-testid="social-results" dir={isHebrew ? 'rtl' : 'ltr'}>
      {care && (
        <div className="av-card av-section" data-testid="social-care">
          <strong>{c.care}</strong>
          <p className="av-small" style={{ margin: '6px 0 0' }}>{isHebrew ? care.detail_he : care.detail_en}</p>
        </div>
      )}
      <div className="av-card av-section">
        <strong>{c.folder}</strong>
        <p className="av-muted av-small" style={{ margin: '6px 0' }}>{c.folderSub}</p>
        <p className="av-small" style={{ margin: '0 0 8px' }} data-testid="social-stills-waiting">
          {c.waiting}: {MARKET.il[l]} <N v={stillsWaiting.il ?? 0} /> · {MARKET.intl[l]} <N v={stillsWaiting.intl ?? 0} />
        </p>
        {canPublish && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onFile} data-testid="social-still-file" />
            {/* PRODUCT_TRUTH_DECORATIVE: adds one ready ad to the Hebrew part of Shira's folder (it is published only after the Owner's approval) */}
            <button type="button" className="av-btn" disabled={busy} onClick={() => pick('il')} data-testid="social-still-add-il">{busy ? c.uploading : c.il}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: adds one ready ad to the English part of Shira's folder (it is published only after the Owner's approval) */}
            <button type="button" className="av-btn" disabled={busy} onClick={() => pick('intl')} data-testid="social-still-add-intl">{busy ? c.uploading : c.intl}</button>
          </div>
        )}
        {notice && <p className={`av-small ${notice.good ? 'av-info' : 'av-warn'}`} role="status" style={{ marginBottom: 0 }} data-testid="social-still-notice">{notice.text}</p>}
      </div>
      <div className="av-card av-section">
        <strong>{c.title}</strong>
        <p className="av-muted av-small" style={{ margin: '6px 0' }}>{c.sub}</p>
        {!rows.length ? <p className="av-muted av-small" data-testid="social-results-empty">{c.none}</p> : (
          <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 0, listStyle: 'none' }} data-testid="social-what-works">
            {/* Owner 2026-11-09 (L-22): a gray row and a white row in turn, so each line reads as one */}
            {summarize(content).map((g, i) => (
              <li key={g.key} className="av-small" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: i % 2 === 0 ? '#e8edf3' : '#fff' }}>
                <strong>{NETWORK[g.network]?.[l] || g.network} · {MARKET[g.market]?.[l] || g.market} · {KIND[g.kind]?.[l] || g.kind}</strong>
                <span>{c.posts} <N v={g.posts} /> · {c.avgViews} {num(g.avgViews)} · {c.avgEng} <N v={g.avgEngagement} /></span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {rows.length > 0 && (
        <div className="av-card av-section">
          <strong>{c.list}</strong>
          <ul style={{ margin: '8px 0 0', padding: 0, display: 'grid', gap: 10, listStyle: 'none' }} data-testid="social-content-list">
            {rows.slice(0, 60).map((r) => {
              const link = safeLink(r.url);
              return (
                <li key={`${r.network}:${r.postId}`} data-testid={`social-content-${r.network}-${r.postId}`} style={{ borderTop: '1px solid #e8eef0', paddingTop: 8 }}>
                  <div className="av-small" style={{ fontWeight: 600, overflowWrap: 'anywhere' }}><bdi>{r.title || c.noTitle}</bdi></div>
                  <div className="av-muted av-small">{NETWORK[r.network]?.[l] || r.network} · {MARKET[r.market]?.[l] || r.market} · {KIND[r.kind]?.[l] || r.kind}</div>
                  <div className="av-small" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>{c.views}: {num(r.views)}</span><span>{c.likes}: {num(r.likes)}</span><span>{c.comments}: {num(r.comments)}</span><span>{c.shares}: {num(r.shares)}</span>
                    {/* PRODUCT_TRUTH_DECORATIVE: opens this post on its own network (only an address of the network itself) */}
                    {link && <a href={link} rel="noopener noreferrer">{c.open}</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
