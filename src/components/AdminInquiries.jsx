// Owner console 2026-10-19 (spec docs/SMART_SUPPORT_EMAIL_SPEC_2026-10-19.md, typed: "מאשר שינוי ב-L-22: לשונית "פניות" חדשה בממשק
// הניהול"): the smart support email - the support / info emails the system received. Super admin only (RLS on support_inbound_messages).
// Stage 2 (Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: שלב 2 של המייל החכם (צבעים, מונה, טיוטות, שבוע ניסיון ועמודת הכתובת)"):
// every inquiry shows its colour and state, the mailbox it was sent to, a counter of what waits for the Owner, the assistant settings
// (sending by colour - off = drafts only, the trial - and the stop switch) and the Owner's actions in the inquiry dialog. Every write
// goes through the support-admin function (super admin check + the one mail gate); this screen only reads the tables.
import { useEffect, useState } from 'react';
import { Inbox, Search, Clock, Mail, MessageSquareText, Paperclip, X, ShieldCheck, AtSign, CircleDot, Settings2, Send, Sparkles, Ban, Info, Palette, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { supabase } from '../shared/supabase';
import { formatShortDateTime } from '../utils/shortDate';
import { ADMIN_DATE_MARKET } from '../utils/adminDates';
import AdminWeeklyReview from './AdminWeeklyReview';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';

const INQUIRIES_COPY = Object.freeze({
  title: { he: 'פניות', en: 'Inquiries' },
  subtitle: { he: (n, w) => `פניות: ${n} · ממתינות לטיפול: ${w}`, en: (n, w) => `${n} inquiries · ${w} waiting for you` },
  search: { he: 'חיפוש לפי שולח, נושא או תוכן…', en: 'Search sender, subject or text...' },
  searchLabel: { he: 'חיפוש לפי שולח, נושא או תוכן', en: 'Search sender, subject or text' },
  loading: { he: 'טוען פניות…', en: 'Loading inquiries...' },
  failed: { he: 'טעינת הפניות נכשלה.', en: 'Could not load the inquiries.' },
  none: { he: 'עדיין לא התקבלו פניות. הקליטה תתחיל אחרי חיבור כתובת התמיכה.', en: 'No inquiries yet. Receiving starts once the support address is connected.' },
  noMatch: { he: 'אין פניות תואמות לחיפוש.', en: 'No inquiries match the search.' },
  time: { he: 'התקבל', en: 'Received' },
  from: { he: 'שולח', en: 'From' },
  subject: { he: 'נושא', en: 'Subject' },
  preview: { he: 'תוכן', en: 'Text' },
  mailbox: { he: 'נשלח אל', en: 'Sent to' },
  state: { he: 'מצב', en: 'State' },
  colour: { he: 'צבע', en: 'Colour' },
  colourFilter: { he: 'סינון לפי צבע', en: 'Filter by colour' },
  detail: { he: 'פרטי הפנייה', en: 'Inquiry details' },
  close: { he: 'סגירה', en: 'Close' },
  to: { he: 'נשלח אל', en: 'Sent to' },
  attachments: { he: 'קבצים מצורפים (לא נפתחים)', en: 'Attachments (never opened)' },
  checks: { he: 'אימות השולח', en: 'Sender checks' },
  noSubject: { he: '(ללא נושא)', en: '(no subject)' },
  open: { he: 'צפייה בפנייה המלאה', en: 'Click to read the full inquiry' },
  filter: { he: 'סינון לפי מצב', en: 'Filter by state' },
  why: { he: 'למה הצבע הזה', en: 'Why this colour' },
  summary: { he: 'מה הלקוח רוצה', en: 'What the sender wants' },
  sentToCustomer: { he: 'מה נשלח ללקוח', en: 'Sent to the customer' },
  nothingSent: { he: 'עדיין לא נשלח דבר.', en: 'Nothing was sent yet.' },
  ackSent: { he: (w) => `אישור קבלה קבוע נשלח ${w}`, en: (w) => `The fixed acknowledgement was sent ${w}` },
  replySent: { he: (w, by) => `${by === 'owner' ? 'בעל המערכת' : 'העוזר'} שלח תשובה ${w}`, en: (w, by) => `A reply was sent ${w} by ${by === 'owner' ? 'the Owner' : 'the assistant'}` },
  reply: { he: 'התשובה ללקוח', en: 'Reply to the customer' },
  approveSend: { he: 'מאשר ושולח', en: 'Approve and send' },
  editSend: { he: 'מתקן ושולח', en: 'Edit and send' },
  send: { he: 'שליחה', en: 'Send' },
  redraft: { he: 'בקשת טיוטה מהעוזר', en: 'Ask the assistant for a draft' },
  dismiss: { he: 'לא לשלוח', en: 'Do not send' },
  working: { he: 'רגע…', en: 'One moment...' },
  done: { he: 'נשלח ללקוח.', en: 'Sent to the customer.' },
  dismissed: { he: 'הפנייה סומנה: לא לשלוח.', en: 'Marked: do not send.' },
  drafted: { he: 'העוזר כתב טיוטה. אפשר לתקן לפני השליחה.', en: 'The assistant wrote a draft. You can edit it before sending.' },
  actionFailed: { he: 'הפעולה לא הצליחה. נסו שוב.', en: 'The action failed. Try again.' },
  noSafeDraft: { he: 'לעוזר אין תשובה שאפשר למסור בביטחון לפנייה הזו. יש לכתוב את התשובה ידנית.', en: 'The assistant has no safe answer for this inquiry. Write the reply yourself.' },
  handled: { he: 'הפנייה כבר טופלה.', en: 'This inquiry was already handled.' },
  settings: { he: 'הגדרות העוזר', en: 'Assistant settings' },
  autoGreen: { he: 'שליחה אוטומטית: ירוק (שאלות ״איך עושים״, מחירים, כניסה)', en: 'Send by itself: green (how-to, prices, sign-in)' },
  autoYellow: { he: 'שליחה אוטומטית: צהוב (אישור קבלת דיווח על תקלה או בקשה)', en: 'Send by itself: yellow (bug received, request noted)' },
  paused: { he: 'עצירת כל השליחות ללקוחות', en: 'Stop every email to customers' },
  settingsHint: {
    he: 'כששליחה אוטומטית כבויה, כל תשובה נשמרת כטיוטה לאישורכם. אישור קבלה בנוסח קבוע לפנייה אדומה נשלח תמיד, אלא אם כל השליחות עצורות. התראות על פניות אדומות וסיכום הערב נשלחים אליכם תמיד.',
    en: 'While sending by itself is off, every reply waits as a draft for your approval. The fixed acknowledgement of a red inquiry is always sent unless every email is stopped. Red alerts and the evening summary always reach you.',
  },
  settingsFailed: { he: 'שמירת ההגדרה נכשלה.', en: 'Could not save the setting.' },
});

const BINS = {
  green: { color: '#16A34A', he: 'ירוק', en: 'Green' },
  yellow: { color: '#EAB308', he: 'צהוב', en: 'Yellow' },
  red: { color: '#DC2626', he: 'אדום', en: 'Red' },
  black: { color: '#1F2937', he: 'שחור', en: 'Black' },
};
const STATES = {
  new: { he: 'בטיפול העוזר', en: 'Being sorted' },
  waiting: { he: 'ממתינה לטיפולכם', en: 'Waiting for you' },
  draft: { he: 'טיוטה לאישור', en: 'Draft to approve' },
  answered: { he: 'נענתה', en: 'Answered' },
  dismissed: { he: 'לא נשלחה', en: 'Not sent' },
  ignored: { he: 'ללא מענה (מייל אוטומטי)', en: 'Not answered (automated)' },
};
const REASONS = {
  automated: { he: 'מייל אוטומטי או רשימת תפוצה', en: 'Automated email or mailing list' },
  instructions_in_email: { he: 'יש במייל הוראות לעוזר', en: 'The email gives the assistant instructions' },
  attachment: { he: 'צורף קובץ', en: 'A file is attached' },
  low_confidence: { he: 'העוזר לא בטוח', en: 'The assistant is not sure' },
  model_unavailable: { he: 'העוזר לא זמין', en: 'The assistant was unavailable' },
  model_not_configured: { he: 'העוזר לא מוגדר', en: 'The assistant is not configured' },
  model_unreadable: { he: 'העוזר לא מיין', en: 'The assistant could not sort it' },
  model_unknown_bin: { he: 'העוזר לא מיין', en: 'The assistant could not sort it' },
  model_yellow_without_kind: { he: 'העוזר לא מיין', en: 'The assistant could not sort it' },
  no_safe_answer: { he: 'אין לעוזר תשובה בטוחה', en: 'The assistant has no safe answer' },
  processing_failed: { he: 'הטיפול האוטומטי נכשל', en: 'Automatic handling failed' },
  'model:green': { he: 'שאלה שהעוזר יודע לענות עליה', en: 'A question the assistant can answer' },
  'model:bug': { he: 'דיווח על תקלה', en: 'A bug report' },
  'model:request': { he: 'בקשה ליכולת חדשה', en: 'A feature request' },
  'model:red': { he: 'נושא שדורש אותך', en: 'A topic that needs you' },
  'model:black': { he: 'ספאם או פרסום', en: 'Spam or advertising' },
};
const FILTERS = ['all', 'pending', 'answered', 'dismissed', 'ignored'];
const FILTER_LABELS = {
  all: { he: 'הכול', en: 'All' }, pending: { he: 'ממתינות לך', en: 'Waiting for you' }, answered: { he: 'נענו', en: 'Answered' },
  dismissed: { he: 'לא נשלחו', en: 'Not sent' }, ignored: { he: 'אוטומטי / ספאם', en: 'Automated / spam' },
};
const isPending = (r) => r.status === 'waiting' || r.status === 'draft';
const COLOUR_ALL = { he: 'כל הצבעים', en: 'All colours' };
const COLOUR_UNSORTED = { he: 'טרם נקבע צבע', en: 'Not sorted yet' };
// sort keys: colour by urgency (red first when descending), state by what needs the Owner, the rest as text / time
const BIN_RANK = { red: 4, yellow: 3, green: 2, black: 1 };
const STATE_RANK = { waiting: 6, draft: 5, new: 4, answered: 3, dismissed: 2, ignored: 1 };
const SORTERS = {
  bin: (r) => BIN_RANK[r.bin] || 0,
  received: (r) => Date.parse(r.received_at || '') || 0,
  from: (r) => String(r.from_address || '').toLowerCase(),
  mailbox: (r) => String(r.mailbox || ''),
  subject: (r) => String(r.subject || '').toLowerCase(),
  state: (r) => STATE_RANK[r.status] || 0,
};
const canAct = (r) => ['new', 'waiting', 'draft'].includes(r.status);

function BinDot({ bin, isHebrew }) {
  const b = BINS[bin];
  const label = b ? (isHebrew ? b.he : b.en) : (isHebrew ? 'טרם נקבע צבע' : 'Not sorted yet');
  return <span className="admin-bin-dot" role="img" aria-label={label} title={label} style={{ background: b ? b.color : '#CBD5E1' }} />;
}

// Owner console 2026-10-20 (L-22 supervisor): canReply = may send / redraft / dismiss (inquiries.reply), canSettings = may change the
// assistant settings (inquiries.settings); the Owner holds both. The server (support-admin) checks the same permissions again.
export default function AdminInquiries({ isHebrew = true, canReply = true, canSettings = true }) {
  const t = Object.fromEntries(Object.entries(INQUIRIES_COPY).map(([k, v]) => [k, isHebrew ? v.he : v.en]));
  const L = (entry) => (entry ? (isHebrew ? entry.he : entry.en) : '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState('all');
  // Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-22: ... ומיון וסינון בלשונית פניות"): sort by every column (colour included), filter by colour
  const [binFilter, setBinFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'received', dir: 'desc' });
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [settings, setSettings] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase.from('support_inbound_messages')
      .select('id, status, bin, bin_reason, summary, mailbox, reply_language, draft_reply, ack_sent_at, reply_text, reply_sent_at, reply_sent_by, from_address, from_name, to_addresses, subject, text_body, attachments, auth_results, received_at')
      .order('received_at', { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (data) setRows(data); else if (error) setFailed(true);
        setLoading(false);
      });
    supabase.from('support_assistant_settings').select('auto_send_green, auto_send_yellow, paused').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setSettings(data); });
    return () => { cancelled = true; };
  }, []);

  const q = term.trim().toLowerCase();
  const byFilter = (r) => filter === 'all' || (filter === 'pending' ? isPending(r) : r.status === filter);
  const byBin = (r) => binFilter === 'all' || (binFilter === 'unsorted' ? !r.bin : r.bin === binFilter);
  const sortValue = SORTERS[sort.key] || SORTERS.received;
  // text columns compare in the screen's language (Hebrew first on a Hebrew screen), numbers inside text in numeric order
  const collator = new Intl.Collator(isHebrew ? 'he' : 'en', { sensitivity: 'base', numeric: true });
  const cmp = (x, y) => (typeof x === 'string' && typeof y === 'string' ? collator.compare(x, y) : (x < y ? -1 : x > y ? 1 : 0));
  const shown = rows.filter((r) => byFilter(r) && byBin(r) && (!q || [r.from_address, r.from_name, r.subject, r.text_body].some((v) => String(v || '').toLowerCase().includes(q))))
    .map((r, i) => ({ r, i })).sort((a, b) => { const x = sortValue(a.r); const y = sortValue(b.r); const c = cmp(x, y); return (sort.dir === 'asc' ? c : -c) || a.i - b.i; }).map((o) => o.r);
  const toggleSort = (key) => setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'received' || key === 'bin' ? 'desc' : 'asc' }));
  const pendingCount = rows.filter(isPending).length;
  const when = (iso) => (iso ? formatShortDateTime(iso, ADMIN_DATE_MARKET) : '');
  // a date + time inside a sentence stays ONE left-to-right unit (Unicode isolate) - never split by the Hebrew direction
  const isolated = (iso) => `⁦${when(iso)}⁩`;
  const sender = (r) => (r.from_name ? `${r.from_name} <${r.from_address}>` : r.from_address);
  const preview = (r) => String(r.text_body || '').replace(/\s+/g, ' ').slice(0, 140);
  const mailboxOf = (r) => (r.mailbox ? `${r.mailbox}@tekango.com` : '-');
  const stateText = (r) => L(STATES[r.status]) || r.status;
  const reasonText = (reason) => {
    const s = String(reason || '');
    if (s.startsWith('word:')) return isHebrew ? `המילה "${s.slice(5)}"` : `The word "${s.slice(5)}"`;
    return L(REASONS[s]) || s || '-';
  };
  const colgroup = <colgroup>{[7, 14, 22, 16, 24, 17].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>;
  // Owner 2026-10-20: the subject sits centred under its heading like every other column (Hebrew and English subjects alike)
  const startAlign = { textAlign: 'center', unicodeBidi: 'plaintext' };
  const detail = (label, Icon, value, ltr) => (
    <div className="admin-details-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon size={13} color="#0F6672" />{label}</span>
      <span dir={ltr ? 'ltr' : 'auto'} style={{ whiteSpace: 'pre-wrap', textAlign: 'start', overflowWrap: 'anywhere' }}>{value || '-'}</span>
    </div>
  );

  const openInquiry = (r) => { setSelected(r); setReplyText(r.draft_reply || ''); setNotice(''); };
  const patchRow = (id, patch) => {
    setRows((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    // the sidebar counter re-reads the waiting inquiries
    try { window.dispatchEvent(new Event('tekango:inquiries-changed')); } catch { /* no window */ }
    setSelected((s) => (s && s.id === id ? { ...s, ...patch } : s));
  };
  const act = async (action, extra = {}) => {
    if (!selected || busy) return;
    setBusy(true); setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('support-admin', { body: { action, id: selected.id, ...extra } });
      const code = data?.code || (error ? 'error' : null);
      if (data?.ok) {
        if (action === 'send') { patchRow(selected.id, { status: 'answered', reply_text: extra.text, reply_sent_at: new Date().toISOString(), reply_sent_by: 'owner' }); setNotice(t.done); }
        if (action === 'dismiss') { patchRow(selected.id, { status: 'dismissed' }); setNotice(t.dismissed); }
        if (action === 'redraft') { patchRow(selected.id, { draft_reply: data.draft }); setReplyText(data.draft); setNotice(t.drafted); }
      } else {
        setNotice(code === 'no_safe_answer' ? t.noSafeDraft : code === 'already_handled' ? t.handled : t.actionFailed);
      }
    } catch {
      setNotice(t.actionFailed);
    } finally {
      setBusy(false);
    }
  };
  const saveSetting = async (key, value) => {
    setSettingsError('');
    const prev = settings;
    setSettings((s) => ({ ...s, [key]: value }));
    try {
      const { data } = await supabase.functions.invoke('support-admin', { body: { action: 'settings', [key]: value } });
      if (data?.ok && data.settings) setSettings(data.settings); else { setSettings(prev); setSettingsError(t.settingsFailed); }
    } catch {
      setSettings(prev); setSettingsError(t.settingsFailed);
    }
  };

  const draftExists = !!selected?.draft_reply;
  const edited = draftExists && replyText.trim() !== String(selected.draft_reply).trim();
  const sendLabel = draftExists ? (edited ? t.editSend : t.approveSend) : t.send;
  const replyDir = selected?.reply_language === 'en' ? 'ltr' : selected?.reply_language === 'he' ? 'rtl' : 'auto';

  return (
    <>
      <AdminScreenFrame
        title={t.title}
        subtitle={t.subtitle(shown.length, pendingCount)}
        label={t.title}
        isHebrew={isHebrew}
        controls={(
          <div className="admin-filters">
            <label className="admin-search">
              <Search size={16} />
              <input type="text" aria-label={t.searchLabel} placeholder={t.search} value={term} onChange={(e) => setTerm(e.target.value)} data-testid="inquiries-search" />
            </label>
            <select className="admin-inquiry-filter" aria-label={t.filter} value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="inquiries-filter">
              {FILTERS.map((f) => <option key={f} value={f}>{L(FILTER_LABELS[f])}</option>)}
            </select>
            <select className="admin-inquiry-filter" aria-label={t.colourFilter} value={binFilter} onChange={(e) => setBinFilter(e.target.value)} data-testid="inquiries-bin-filter">
              {['all', 'red', 'yellow', 'green', 'black', 'unsorted'].map((b) => <option key={b} value={b}>{b === 'all' ? L(COLOUR_ALL) : b === 'unsorted' ? L(COLOUR_UNSORTED) : L(BINS[b])}</option>)}
            </select>
            {pendingCount > 0 && <span className="admin-count-pill" data-testid="inquiries-pending">{pendingCount}</span>}
            {/* Owner console 2026-10-23 (typed L-22): the weekly review of bug reports and requests - a list with a status per item */}
            <AdminWeeklyReview isHebrew={isHebrew} canRun={canSettings} />
            {canSettings && (
              // PRODUCT_TRUTH_CAPABILITY: admin_console
              <button type="button" className="admin-inquiry-settings-btn" onClick={() => setSettingsOpen(true)} data-testid="inquiries-settings">
                <Settings2 size={15} />{t.settings}
              </button>
            )}
          </div>
        )}
        head={(
          <div className="pf-head-gutter admin-table-wrap admin-head-wrap">
            <table>
              {colgroup}
              <thead>
                <tr>
                  {[['bin', t.colour, Palette], ['received', t.time, Clock], ['from', t.from, Mail], ['mailbox', t.mailbox, AtSign], ['subject', t.subject, Inbox], ['state', t.state, CircleDot]].map(([key, label, Icon]) => (
                    <th key={key} scope="col" aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                      <button type="button" className="admin-sort" onClick={() => toggleSort(key)} data-testid={`inquiries-sort-${key}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        <Icon size={12} aria-hidden="true" /> {label} {sort.key === key ? (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />) : <ArrowUpDown size={12} aria-hidden="true" style={{ opacity: 0.45 }} />}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
        )}
      >
        {loading ? (
          <p className="admin-empty" role="status">{t.loading}</p>
        ) : shown.length === 0 ? (
          <p className="admin-empty" role="status" data-testid="inquiries-empty">{failed ? t.failed : rows.length ? t.noMatch : t.none}</p>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table>
                {colgroup}
                <tbody>
                  {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                  {shown.map((r) => (
                    <tr key={r.id} className="admin-support-row" data-testid="inquiry-row" onClick={() => openInquiry(r)} title={t.open}>
                      <td><BinDot bin={r.bin} isHebrew={isHebrew} /></td>
                      <td><span className="admin-date" dir="ltr">{when(r.received_at)}</span></td>
                      <td><span className="admin-support-cell" dir="ltr">{sender(r)}</span></td>
                      <td><span className="admin-support-cell" dir="ltr" data-testid="inquiry-mailbox">{mailboxOf(r)}</span></td>
                      <td><span className="admin-support-cell" dir="auto" style={startAlign} data-testid="inquiry-subject">{r.subject || t.noSubject}</span></td>
                      <td><span className={isPending(r) ? 'admin-inquiry-state is-pending' : 'admin-inquiry-state'}>{stateText(r)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-user-cards">
              {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
              {shown.map((r) => (
                <article className="admin-user-card admin-support-row" key={r.id} data-testid="inquiry-card" onClick={() => openInquiry(r)}>
                  <div className="admin-card-heading">
                    <div className="admin-identity"><strong dir="ltr">{r.from_address}</strong><span dir="ltr">{when(r.received_at)}</span></div>
                    <span className="admin-inquiry-when"><BinDot bin={r.bin} isHebrew={isHebrew} /><span className={isPending(r) ? 'admin-inquiry-state is-pending' : 'admin-inquiry-state'}>{stateText(r)}</span></span>
                  </div>
                  <p className="admin-support-cell" dir="auto"><strong>{r.subject || t.noSubject}</strong> · {preview(r)}</p>
                  <p className="admin-support-cell" dir="ltr" style={{ margin: 0, fontSize: 11 }}>{mailboxOf(r)}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </AdminScreenFrame>

      {/* PRODUCT_TRUTH_DECORATIVE: clicking the dialog backdrop dismisses the open inquiry */}
      {selected && (
        <div className="admin-dialog-backdrop" onClick={() => setSelected(null)}>
          {/* PRODUCT_TRUTH_DECORATIVE: stops click propagation inside the inquiry dialog */}
          <section role="dialog" aria-modal="true" aria-label={t.detail} data-testid="inquiry-detail" className="admin-action-dialog" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setSelected(null); }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Inbox size={20} color="#0F6672" />{t.detail}
              {/* PRODUCT_TRUTH_DECORATIVE: X button closes the inquiry dialog */}
              <button className="admin-icon-button" style={{ marginInlineStart: 'auto' }} aria-label={t.close} onClick={() => setSelected(null)}><X size={16} /></button>
            </h2>
            <p className="admin-inquiry-when" style={{ margin: '0 0 8px' }}><BinDot bin={selected.bin} isHebrew={isHebrew} /><strong>{L(BINS[selected.bin]) || ''}</strong> · <span className={isPending(selected) ? 'admin-inquiry-state is-pending' : 'admin-inquiry-state'}>{stateText(selected)}</span></p>
            {selected.bin_reason && detail(t.why, Info, reasonText(selected.bin_reason))}
            {selected.summary && detail(t.summary, Sparkles, selected.summary)}
            {detail(t.time, Clock, when(selected.received_at), true)}
            {detail(t.from, Mail, sender(selected), true)}
            {detail(t.to, AtSign, mailboxOf(selected), true)}
            {detail(t.subject, Inbox, selected.subject || t.noSubject)}
            {detail(t.preview, MessageSquareText, selected.text_body)}
            {Array.isArray(selected.attachments) && selected.attachments.length > 0
              && detail(t.attachments, Paperclip, selected.attachments.map((a) => a.filename || a.content_type || '?').join(', '), true)}
            {selected.auth_results && detail(t.checks, ShieldCheck, `SPF ${selected.auth_results.spf} · DKIM ${selected.auth_results.dkim} · DMARC ${selected.auth_results.dmarc}`, true)}
            {detail(t.sentToCustomer, Send, [
              selected.ack_sent_at ? t.ackSent(isolated(selected.ack_sent_at)) : null,
              selected.reply_sent_at ? `${t.replySent(isolated(selected.reply_sent_at), selected.reply_sent_by)}\n\n${selected.reply_text || ''}` : null,
            ].filter(Boolean).join('\n\n') || t.nothingSent)}
            {canReply && canAct(selected) && (
              <div className="admin-inquiry-reply" data-testid="inquiry-reply">
                <label htmlFor="inquiry-reply-text">{t.reply}</label>
                <textarea id="inquiry-reply-text" dir={replyDir} rows={8} value={replyText} onChange={(e) => setReplyText(e.target.value)} disabled={busy} data-testid="inquiry-reply-text" />
                <div className="admin-inquiry-actions">
                  {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                  <button type="button" className="admin-inquiry-primary" disabled={busy || replyText.trim().length < 2} onClick={() => act('send', { text: replyText })} data-testid="inquiry-send"><Send size={15} />{busy ? t.working : sendLabel}</button>
                  {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                  <button type="button" disabled={busy} onClick={() => act('redraft')} data-testid="inquiry-redraft"><Sparkles size={15} />{t.redraft}</button>
                  {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                  <button type="button" disabled={busy} onClick={() => act('dismiss')} data-testid="inquiry-dismiss"><Ban size={15} />{t.dismiss}</button>
                </div>
              </div>
            )}
            {notice && <p role="status" data-testid="inquiry-notice" style={{ margin: '10px 0 0', color: '#0F6672', fontSize: 13 }}>{notice}</p>}
          </section>
        </div>
      )}

      {/* PRODUCT_TRUTH_DECORATIVE: clicking the dialog backdrop closes the assistant settings */}
      {canSettings && settingsOpen && (
        <div className="admin-dialog-backdrop" onClick={() => setSettingsOpen(false)}>
          {/* PRODUCT_TRUTH_DECORATIVE: stops click propagation inside the settings dialog */}
          <section role="dialog" aria-modal="true" aria-label={t.settings} data-testid="inquiries-settings-dialog" className="admin-action-dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setSettingsOpen(false); }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Settings2 size={20} color="#0F6672" />{t.settings}
              {/* PRODUCT_TRUTH_DECORATIVE: X button closes the settings dialog */}
              <button className="admin-icon-button" style={{ marginInlineStart: 'auto' }} aria-label={t.close} onClick={() => setSettingsOpen(false)}><X size={16} /></button>
            </h2>
            <p>{t.settingsHint}</p>
            {settings ? (
              <div className="admin-inquiry-toggles">
                {[['auto_send_green', t.autoGreen], ['auto_send_yellow', t.autoYellow], ['paused', t.paused]].map(([key, label]) => (
                  <label key={key} className={key === 'paused' ? 'admin-inquiry-toggle is-stop' : 'admin-inquiry-toggle'}>
                    {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                    <input type="checkbox" checked={!!settings[key]} onChange={(e) => saveSetting(key, e.target.checked)} data-testid={`inquiries-setting-${key}`} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            ) : <p role="status">{t.loading}</p>}
            {settingsError && <p role="alert" style={{ color: '#9A4040' }}>{settingsError}</p>}
          </section>
        </div>
      )}
    </>
  );
}
