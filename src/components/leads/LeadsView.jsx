// Leads stage 1 (Owner console 2026-11-18, typed: "מאשר את שלב 1 של הפניות: רישום ההדגמה מ-18/11 בחוק 50 כולל רענון הנעילה, מיגרציה עם
// גיבוי, ושינוי ב-L-07, L-10, L-15, L-17 ו-L-18, ושחרור עד הלייב"; the approved demo of 18/11; the Owner's answers of 17/11): the Leads
// tab inside Clients - the list (search, order, status filter; a table on a computer, cards on a phone), the lead details (status,
// next follow-up = a regular task, the contact log) and the "new lead" window. Stage 1 has no "new quote from lead" (stage 2), no quote
// events in the log (stage 3) and nothing for the AI (stage 4). Nothing is ever sent to the lead.
// L-10: the leads load here (never in Dashboard.loadData), through loadWithRetry - a failed load never shows "no leads" and never empties
// a list already shown. L-15: the details view and the window are role="dialog" and close on Escape, so the phone Back steps out of them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'lucide-react';
import { APP as NEON } from '../../theme/neonTheme';
import { formatShortDate, formatShortDateTime } from '../../utils/shortDate';
import { loadWithRetry } from '../../utils/resilientLoad';
import { askConfirm } from '../AppDialog';
import { taskMarket, marketToday, marketClock, parseMarketDate, parseTimeText, shortTime, marketDatePattern } from '../../utils/manualTasks';
import { createLead, setLeadStatus, scheduleFollowUp, completeFollowUp, listLeadEvents, addLeadEvent, LEAD_SOURCES, MANUAL_LEAD_STATUSES, LEAD_EVENT_KINDS } from '../../utils/leadsClient';
import { LeadIcon, LeadEntryIcon, LeadBackIcon } from './LeadIcons';
import EllipsisText from '../EllipsisText';
import { marketInstant } from './useLeads';
import './leads.css';

const SRC = { ref: ['המלצה', 'Referral'], phone: ['טלפון', 'Phone'], wa: ['WhatsApp', 'WhatsApp'], web: ['אתר', 'Website'], fb: ['Facebook', 'Facebook'], other: ['אחר', 'Other'], none: ['לא צוין', 'Not specified'] };
const ST = { new: ['חדשה', 'New', 'ld-st-new'], prog: ['בטיפול', 'In progress', 'ld-st-prog'], sent: ['נשלחה הצעה', 'Quote sent', 'ld-st-sent'], off: ['לא רלוונטית', 'Not relevant', 'ld-st-off'] };
const TY = { call: ['שיחה', 'Call'], meet: ['פגישה', 'Meeting'], msg: ['הודעה', 'Message'], note: ['הערה', 'Note'] };
const pick = (pair, he) => pair[he ? 0 : 1];

// Owner console 2026-11-19: a text longer than its box ends with "…" and shows whole in the bubble on hover / tap (EllipsisText - law 50
// change of 19/11)
function Slide({ text, className = '', dir }) {
  return <EllipsisText className={`ld-slide ${className}`} dir={dir} text={text} />;
}

const ltr = (s) => <bdi dir="ltr">{s}</bdi>;

export default function LeadsView({ leadsApi, leadsState, tabs, isHebrew, isMobileView = false }) {
  const he = isHebrew;
  const market = taskMarket(leadsApi?.isLocalIsraeliBusiness === true);
  const today = marketToday(market);
  const { client, userId } = leadsApi || {};
  const { status, leads, put } = leadsState;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('due');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(0);
  const say = useCallback((text) => { setToast(text); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 2600); }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const dt = useCallback((date, time) => { const d = formatShortDate(date, market); const t = shortTime(time || ''); return ltr(t ? `${d} ${t}` : d); }, [market]);
  const dueHtml = (l) => {
    const f = l.followUp;
    if (!f || !f.due_date) return <span className="ld-due none">{he ? 'לא נקבע מעקב' : 'No follow-up scheduled'}</span>;
    const late = f.due_date < today;
    return <span className={`ld-due${late ? ' late' : ''}`}>{late ? (he ? 'באיחור · ' : 'Overdue · ') : ''}{dt(f.due_date, f.due_time)}</span>;
  };
  const chip = (st) => <span className={`ld-chip ${ST[st]?.[2] || ''}`}>{pick(ST[st] || ST.new, he)}</span>;
  const contact = (l) => (l.phone ? ltr(l.phone) : <Slide text={l.email || ''} dir="ltr" className="ld-inl" />);

  const visible = useMemo(() => {
    let ls = leads.slice();
    if (filter !== 'all') ls = ls.filter((l) => (filter === 'sent' ? l.status === 'sent' : l.status === filter));
    const term = q.trim().toLowerCase();
    if (term) ls = ls.filter((l) => [l.name, l.phone, l.email, l.need].join(' ').toLowerCase().includes(term));
    const made = (l) => String(l.created_at || '');
    if (sort === 'new') ls.sort((a, b) => made(b).localeCompare(made(a)));
    else ls.sort((a, b) => { const key = (l) => (l.followUp && l.followUp.due_date ? String(l.followUp.due_date) + ' ' + String(l.followUp.due_time || '') : '9999'); const ad = key(a); const bd = key(b); return ad.localeCompare(bd) || made(b).localeCompare(made(a)); });
    return ls;
  }, [leads, filter, q, sort]);

  const open = openId ? leads.find((l) => l.id === openId) : null;

  const header = (
    <div className="ld-titlerow">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
        <h2><User size={18} color={NEON.textSecondary} strokeWidth={2} aria-hidden="true" />{he ? 'לקוחות' : 'Clients'}</h2>
        <span className="ld-count">{he ? `פניות: ${leads.length}` : `${leads.length} lead${leads.length === 1 ? '' : 's'}`}</span>
      </div>
      {/* PRODUCT_TRUTH_CAPABILITY: clients */}
      <button type="button" className="ld-btnp" data-testid="lead-new" onClick={() => setNewOpen(true)}>
        <LeadIcon size={16} accent="#bfe3e2" />{he ? 'פנייה חדשה' : 'New lead'}
      </button>
    </div>
  );

  const dir = he ? 'rtl' : 'ltr';
  const extras = (
    <>
    {newOpen && <NewLeadDialog he={he} market={market} today={today} client={client} userId={userId} onClose={() => setNewOpen(false)}
      onSaved={(lead, withFollowUp) => { put(lead); setNewOpen(false); setFilter('all'); say(withFollowUp ? (he ? 'הפנייה נשמרה. המעקב נוסף למשימות.' : 'Lead saved. The follow-up was added to Tasks.') : (he ? 'הפנייה נשמרה.' : 'Lead saved.')); }} />}
    {toast ? <div className="ld-toast" role="status">{toast}</div> : null}
    </>
  );
  // the same frame as the Clients list: on a computer the whole screen scrolls with the page; on a phone the static block (title, tabs,
  // search, filters) stays and only the list scrolls (.pf-screen-body) - the details view scrolls as one body with no top gap
  if (open) {
    return (
      <div className={`ld-scope${isMobileView ? ' pf-screen-body ld-flush' : ''}`} dir={dir}>
        <LeadDetails key={open.id} lead={open} he={he} market={market} today={today} client={client} userId={userId} put={put} say={say} dt={dt} chip={chip}
          onBack={() => setOpenId(null)} />
        {extras}
      </div>
    );
  }
  return (
    <>
      <div className="ld-scope" dir={dir}>
        {header}
        {tabs}
        <div className="ld-search">
          <div className="ld-in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input data-testid="lead-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={he ? 'חיפוש לפי שם, טלפון, מייל או תוכן הפנייה' : 'Search name, phone, email or work needed'} aria-label={he ? 'חיפוש פניות' : 'Search leads'} />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={he ? 'סדר' : 'Order'} data-testid="lead-sort">
            <option value="due">{he ? 'לפי המעקב הקרוב' : 'By next follow-up'}</option>
            <option value="new">{he ? 'החדשות קודם' : 'Newest first'}</option>
          </select>
        </div>
        <div className="ld-filters" role="group" aria-label={he ? 'מצב הפנייה' : 'Lead status'}>
          {[['all', he ? 'כל המצבים' : 'All statuses'], ['new', pick(ST.new, he)], ['prog', pick(ST.prog, he)], ['sent', pick(ST.sent, he)], ['off', pick(ST.off, he)]].map(([k, label]) => (
            // PRODUCT_TRUTH_DECORATIVE: filters the visible leads by status
            <button key={k} type="button" className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>
      <div className={`ld-scope${isMobileView ? ' pf-screen-body' : ''}`} dir={dir}>
        {status !== 'ready' ? (
          <p className="ld-hint" role="status">{he ? 'טוען את הפניות…' : 'Loading leads…'}</p>
        ) : !leads.length ? (
          <p className="ld-hint">{he ? 'עדיין אין פניות. לוחצים „פנייה חדשה” כדי לרשום את הראשונה.' : 'No leads yet. Click “New lead” to record the first one.'}</p>
        ) : !visible.length ? (
          <p className="ld-hint">{he ? 'לא נמצאו פניות שמתאימות לחיפוש.' : 'No matching leads.'}{' '}
            {/* PRODUCT_TRUTH_DECORATIVE: clears the leads search and filter */}
            <button type="button" className="ld-btnl" onClick={() => { setQ(''); setFilter('all'); }}>{he ? 'ניקוי החיפוש' : 'Clear search'}</button></p>
        ) : (
          <>
            <table className="ld-tbl">
              <thead><tr><th>{he ? 'שם' : 'Name'}</th><th>{he ? 'יצירת קשר' : 'Contact'}</th><th>{he ? 'מה צריך לבצע?' : 'Work needed'}</th><th>{he ? 'מצב' : 'Status'}</th><th>{he ? 'המעקב הבא' : 'Next follow-up'}</th></tr></thead>
              <tbody>
                {visible.map((l) => (
                  // PRODUCT_TRUTH_DECORATIVE: opens the lead details from its table row
                  <tr key={l.id} className="ld-row" tabIndex={0} data-testid="lead-row" onClick={() => setOpenId(l.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(l.id); } }}>
                    <td style={{ maxWidth: '200px' }}><Slide text={l.name} className="ld-nm" /><span className="ld-sub">{pick(SRC[l.source] || SRC.none, he)}</span></td>
                    <td>{contact(l)}</td>
                    <td style={{ maxWidth: '220px' }}>{l.need ? <Slide text={l.need} /> : null}</td>
                    <td>{chip(l.status)}</td>
                    <td>{dueHtml(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ld-cards">
              {visible.map((l) => (
                // PRODUCT_TRUTH_DECORATIVE: opens the lead details from its phone card
                <button key={l.id} type="button" className="ld-card" data-testid="lead-card" onClick={() => setOpenId(l.id)}>
                  <span className="ld-top"><Slide text={l.name} className="ld-nm" />{chip(l.status)}</span>
                  <span className="ld-sub">{contact(l)} · {pick(SRC[l.source] || SRC.none, he)}</span>
                  {l.need ? <Slide text={l.need} className="ld-sub" /> : null}
                  <span className="ld-bot">{dueHtml(l)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {extras}
      </div>
    </>
  );
}

function tomorrowOf(today) {
  const [y, m, d] = String(today || '').split('-').map(Number);
  if (!y) return '';
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

function NewLeadDialog({ he, market, today, client, userId, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ name: '', phone: '', email: '', need: '', source: 'none', due: formatShortDate(tomorrowOf(today), market) }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    if (busy) return;
    if (!f.name.trim() || (!f.phone.trim() && !f.email.trim())) { setErr(he ? 'הוסיפו שם ולפחות טלפון או כתובת מייל.' : 'Add a name and at least a phone number or email address.'); return; }
    const date = f.due.trim() ? parseMarketDate(f.due, market) : null;
    if (f.due.trim() && !date) { setErr(he ? `כתבו את התאריך כך: ${marketDatePattern(market) === 'DD/MM/YYYY' ? 'יום/חודש/שנה' : 'חודש/יום/שנה'}` : `Write the date as ${marketDatePattern(market)}`); return; }
    setBusy(true); setErr('');
    const res = await createLead(client, userId, f, { followUp: date ? { date } : null, isHebrew: he });
    setBusy(false);
    if (!res.ok) { setErr(he ? 'לא הצלחנו לשמור את הפנייה. נסו שוב.' : 'We could not save the lead. Please try again.'); return; }
    onSaved(res.data, Boolean(res.data.followUp));
  };
  return (
    <div className="ld-overlay ld-scope" dir={he ? 'rtl' : 'ltr'} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ld-dlg" role="dialog" aria-modal="true" aria-labelledby="ld-new-title" data-testid="lead-dialog"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
        <h3 id="ld-new-title"><LeadIcon size={20} />{he ? 'פנייה חדשה' : 'New lead'}</h3>
        <label>{he ? 'שם' : 'Name'}<input ref={first} value={f.name} onChange={set('name')} autoComplete="off" data-testid="lead-f-name" /></label>
        <div className="ld-two">
          <label>{he ? 'טלפון' : 'Phone'}<input value={f.phone} onChange={set('phone')} dir="ltr" inputMode="tel" data-testid="lead-f-phone" /></label>
          <label>{he ? 'כתובת מייל' : 'Email address'}<input value={f.email} onChange={set('email')} dir="ltr" inputMode="email" data-testid="lead-f-email" /></label>
        </div>
        <label>{he ? 'מה צריך לבצע?' : 'What work is needed?'}<input value={f.need} onChange={set('need')} placeholder={he ? 'למשל: החלפת חלון בסלון' : 'For example: replace a living-room window'} data-testid="lead-f-need" /></label>
        <div className="ld-two">
          <label>{he ? 'מקור הפנייה' : 'Lead source'}<select value={f.source} onChange={set('source')} data-testid="lead-f-source">{LEAD_SOURCES.map((k) => <option key={k} value={k}>{pick(SRC[k], he)}</option>)}</select></label>
          <label>{he ? 'המעקב הבא' : 'Next follow-up'}<input value={f.due} onChange={set('due')} dir="ltr" inputMode="numeric" placeholder={marketDatePattern(market) === 'DD/MM/YYYY' ? (he ? 'יום/חודש/שנה' : 'DD/MM/YYYY') : (he ? 'חודש/יום/שנה' : 'MM/DD/YYYY')} data-testid="lead-f-due" /></label>
        </div>
        {err ? <p className="ld-err" role="alert">{err}</p> : null}
        <div className="ld-acts">
          {/* PRODUCT_TRUTH_DECORATIVE: closes the new-lead window without saving */}
          <button type="button" className="ld-btns" onClick={onClose}>{he ? 'ביטול' : 'Cancel'}</button>
          {/* PRODUCT_TRUTH_CAPABILITY: clients */}
          <button type="button" className="ld-btnp" onClick={save} disabled={busy} data-testid="lead-save">{he ? 'שמירה' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function LeadDetails({ lead, he, market, today, client, userId, put, say, dt, chip, onBack }) {
  const [events, setEvents] = useState({ status: 'loading', list: [] });
  const [type, setType] = useState('call');
  const [text, setText] = useState('');
  const [entryErr, setEntryErr] = useState(false);
  const [when, setWhen] = useState(null); // null = now; { date, time } typed
  const [whenEdit, setWhenEdit] = useState(false);
  const [whenText, setWhenText] = useState({ date: '', time: '' });
  const [fuEdit, setFuEdit] = useState(false);
  const [fuText, setFuText] = useState({ date: '', time: '' });
  const [fuErr, setFuErr] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    let live = true;
    loadWithRetry(() => listLeadEvents(client, userId, lead.id), { isCurrent: () => live }).then((res) => { if (live && res.ok) setEvents({ status: 'ready', list: res.data }); });
    rootRef.current?.focus();
    return () => { live = false; };
  }, [client, userId, lead.id]);

  const nowText = () => ({ date: formatShortDate(today, market), time: marketClock(market) || '' });
  const onStatus = async (e) => {
    const next = e.target.value;
    if (next === lead.status) return;
    if (next === 'off' && !(await askConfirm(he ? 'לסגור את הפנייה כלא רלוונטית? המעקב העתידי יימחק. לא יתווסף תיעוד קשר.' : 'Close this lead as not relevant? Its open follow-up will be removed. No contact entry will be added.', he, { danger: true }))) { e.target.value = lead.status; return; }
    const res = await setLeadStatus(client, userId, lead, next);
    if (!res.ok) { say(he ? 'לא הצלחנו לעדכן את המצב. נסו שוב.' : 'We could not update the status. Please try again.'); return; }
    put(res.data);
  };
  const saveFollowUp = async () => {
    const date = parseMarketDate(fuText.date, market);
    const time = fuText.time.trim() ? parseTimeText(fuText.time) : '';
    if (!date || (fuText.time.trim() && !time)) { setFuErr(he ? 'בדקו את התאריך והשעה.' : 'Check the date and time.'); return; }
    const res = await scheduleFollowUp(client, userId, lead, { date, time }, { isHebrew: he });
    if (!res.ok) { setFuErr(he ? 'לא הצלחנו לשמור את המעקב. נסו שוב.' : 'We could not save the follow-up. Please try again.'); return; }
    put(res.data); setFuEdit(false); setFuErr(''); say(he ? 'המעקב נשמר במשימות.' : 'The follow-up was saved in Tasks.');
  };
  const done = async () => {
    const res = await completeFollowUp(client, userId, lead);
    if (!res.ok) { say(he ? 'לא הצלחנו לסמן את המעקב. נסו שוב.' : 'We could not complete the follow-up. Please try again.'); return; }
    put(res.data); say(he ? 'המעקב סומן כבוצע. אפשר לקבוע את המעקב הבא.' : 'Follow-up completed. You can schedule the next one.');
  };
  const addEntry = async () => {
    if (!text.trim()) { setEntryErr(true); return; }
    let happenedAt = null;
    if (when) {
      const date = parseMarketDate(when.date, market); const time = when.time ? parseTimeText(when.time) : '00:00';
      if (date && time) happenedAt = marketInstant(date, time, market);
    }
    const res = await addLeadEvent(client, userId, lead.id, { kind: type, body: text, happenedAt });
    if (!res.ok) { say(he ? 'לא הצלחנו לשמור את התיעוד. נסו שוב.' : 'We could not save the entry. Please try again.'); return; }
    setEvents((s) => ({ status: 'ready', list: [res.data, ...s.list].sort((a, b) => String(b.happened_at).localeCompare(String(a.happened_at))) }));
    setText(''); setEntryErr(false); setWhen(null); setWhenEdit(false); say(he ? 'התיעוד נשמר.' : 'Entry saved.');
  };
  const f = lead.followUp;
  const late = f && f.due_date && f.due_date < today;
  const nm = String(lead.name || '').split(',')[0];
  const nowShown = when ? ltr(`${when.date}${when.time ? ` ${when.time}` : ''}`) : (() => { const n = nowText(); return ltr(`${n.date} ${n.time}`); })();
  const entryTime = (ev) => ltr(formatShortDateTime(ev.happened_at, market));

  return (
    <div ref={rootRef} role="dialog" aria-label={he ? 'פרטי הפנייה' : 'Lead details'} tabIndex={-1} data-testid="lead-details" style={{ outline: 'none' }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onBack(); } }}>
      {/* PRODUCT_TRUTH_DECORATIVE: returns from the lead details to the leads list */}
      <button type="button" className="ld-back" onClick={onBack}><LeadBackIcon />{he ? 'חזרה לרשימה' : 'Back to list'}</button>
      <div className="ld-dgrid">
        <section className="ld-box">
          <h3><span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><LeadIcon size={18} />{he ? 'פרטי הפנייה' : 'Lead details'}</span>
            <span style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {lead.status === 'sent' ? <>{chip('sent')}<span className="ld-hint" style={{ margin: 0 }}>{he ? 'המצב מתעדכן לבד לפי ההצעה' : 'Status follows the quote'}</span></> : (
                <select className="ld-statussel" value={lead.status} onChange={onStatus} aria-label={he ? 'מצב הפנייה' : 'Lead status'} data-testid="lead-status">
                  {MANUAL_LEAD_STATUSES.map((k) => <option key={k} value={k}>{pick(ST[k], he)}</option>)}
                </select>
              )}
            </span>
          </h3>
          <p className="ld-who"><Slide text={lead.name} /></p>
          <dl className="ld-kv">
            {/* PRODUCT_TRUTH_DECORATIVE: dials the lead's phone number from the device */}
            {lead.phone ? <><dt>{he ? 'טלפון' : 'Phone'}</dt><dd><a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>{ltr(lead.phone)}</a></dd></> : null}
            {lead.email ? <><dt>{he ? 'כתובת מייל' : 'Email address'}</dt><dd><Slide text={lead.email} dir="ltr" /></dd></> : null}
            <dt>{he ? 'מקור הפנייה' : 'Lead source'}</dt><dd>{pick(SRC[lead.source] || SRC.none, he)}{lead.source_detail ? ` · ${lead.source_detail}` : ''}</dd>
            <dt>{he ? 'התקבלה' : 'Received'}</dt><dd>{dt(lead.created_at)}</dd>
          </dl>
          {lead.need ? <p className="ld-need"><b>{he ? 'מה צריך לבצע? ' : 'Work needed: '}</b>{lead.need}</p> : null}
        </section>
        <section className="ld-box">
          <h3>{he ? 'המעקב הבא' : 'Next follow-up'}</h3>
          <div className="ld-fu">
            {f && f.due_date && !fuEdit ? (
              <>
                <span className={`ld-when${late ? ' late' : ''}`}>{late ? (he ? 'באיחור · ' : 'Overdue · ') : ''}{dt(f.due_date, f.due_time)}</span>
                <span className="ld-hint" style={{ margin: 0 }}>{he ? `חזרה לפנייה של ${nm} · מופיע במשימות, ביומן ובפעמון` : `Follow up with ${nm} · Shows in Tasks, Calendar and the bell`}</span>
                <div className="ld-row2">
                  {/* PRODUCT_TRUTH_CAPABILITY: clients */}
                  <button type="button" className="ld-btns" onClick={done} data-testid="lead-fu-done">{he ? 'סימון המעקב כבוצע' : 'Complete follow-up'}</button>
                  {/* PRODUCT_TRUTH_DECORATIVE: opens the follow-up date fields */}
                  <button type="button" className="ld-btnl" onClick={() => { setFuText({ date: formatShortDate(f.due_date, market), time: shortTime(f.due_time || '') || '' }); setFuEdit(true); }}>{he ? 'שינוי מועד' : 'Change date'}</button>
                </div>
              </>
            ) : fuEdit ? (
              <div className="ld-inline-form">
                <input value={fuText.date} onChange={(e) => setFuText((p) => ({ ...p, date: e.target.value }))} dir="ltr" inputMode="numeric" aria-label={he ? 'תאריך המעקב' : 'Follow-up date'} placeholder={marketDatePattern(market)} data-testid="lead-fu-date" />
                <input className="ld-time" value={fuText.time} onChange={(e) => setFuText((p) => ({ ...p, time: e.target.value }))} dir="ltr" inputMode="numeric" aria-label={he ? 'שעה (לא חובה)' : 'Time (optional)'} placeholder="HH:MM" />
                {/* PRODUCT_TRUTH_CAPABILITY: clients */}
                <button type="button" className="ld-btnp" onClick={saveFollowUp} data-testid="lead-fu-save">{he ? 'שמירה' : 'Save'}</button>
                {/* PRODUCT_TRUTH_DECORATIVE: closes the follow-up date fields */}
                <button type="button" className="ld-btnl" onClick={() => { setFuEdit(false); setFuErr(''); }}>{he ? 'ביטול' : 'Cancel'}</button>
                {fuErr ? <p className="ld-err" role="alert" style={{ flexBasis: '100%' }}>{fuErr}</p> : null}
              </div>
            ) : (
              <>
                <span className="ld-due none">{he ? 'לא נקבע מעקב' : 'No follow-up scheduled'}</span>
                {lead.status !== 'off' ? (
                  <div className="ld-row2">
                    {/* PRODUCT_TRUTH_DECORATIVE: opens the follow-up date fields */}
                    <button type="button" className="ld-btns" onClick={() => { setFuText({ date: formatShortDate(tomorrowOf(today), market), time: '' }); setFuEdit(true); }} data-testid="lead-fu-new">{he ? 'קביעת מעקב' : 'Schedule a follow-up'}</button>
                  </div>
                ) : null}
              </>
            )}
            <p className="ld-hint">{he ? 'המעקב מזכיר לכם לחזור לפנייה. הוא לא שולח הודעה ללקוח.' : 'Follow-up reminds you to contact this lead. It does not send a message to the client.'}</p>
          </div>
        </section>
      </div>
      <section className="ld-box">
        <h3>{he ? 'קשר והצעות' : 'Contact and quotes'}</h3>
        <div className="ld-composer">
          <div className="ld-types" role="group" aria-label={he ? 'סוג התיעוד' : 'Entry type'}>
            {LEAD_EVENT_KINDS.map((k) => (
              // PRODUCT_TRUTH_DECORATIVE: chooses the kind of the contact entry
              <button key={k} type="button" className={type === k ? 'on' : ''} aria-pressed={type === k} onClick={() => setType(k)}><LeadEntryIcon kind={k} /> {pick(TY[k], he)}</button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => { setText(e.target.value); if (entryErr) setEntryErr(false); }} placeholder={he ? 'מה סוכם?' : 'What was discussed?'} aria-label={he ? 'מה סוכם?' : 'What was discussed?'} data-testid="lead-entry" />
          <div className="ld-r">
            {whenEdit ? (
              <span className="ld-inline-form">
                <input value={whenText.date} onChange={(e) => setWhenText((p) => ({ ...p, date: e.target.value }))} dir="ltr" inputMode="numeric" aria-label={he ? 'תאריך' : 'Date'} placeholder={marketDatePattern(market)} />
                <input className="ld-time" value={whenText.time} onChange={(e) => setWhenText((p) => ({ ...p, time: e.target.value }))} dir="ltr" inputMode="numeric" aria-label={he ? 'שעה' : 'Time'} placeholder="HH:MM" />
                {/* PRODUCT_TRUTH_DECORATIVE: keeps the typed time of the contact entry */}
                <button type="button" className="ld-btnl" onClick={() => { if (parseMarketDate(whenText.date, market)) { setWhen({ date: whenText.date.trim(), time: (parseTimeText(whenText.time) || '') }); setWhenEdit(false); } }}>{he ? 'אישור' : 'OK'}</button>
              </span>
            ) : (
              <span className="ld-hint" style={{ margin: 0 }}>{he ? 'מתי: ' : 'When: '}{nowShown}{' '}
                {/* PRODUCT_TRUTH_DECORATIVE: opens the time fields of the contact entry */}
                <button type="button" className="ld-btnl" onClick={() => { setWhenText(when || nowText()); setWhenEdit(true); }}>{he ? 'שינוי' : 'Change'}</button>
              </span>
            )}
            {/* PRODUCT_TRUTH_CAPABILITY: clients */}
            <button type="button" className="ld-btnp" onClick={addEntry} data-testid="lead-entry-save">{he ? 'שמירה' : 'Save'}</button>
          </div>
          <p className="ld-hint" style={{ margin: 0 }}>{he ? 'התיעוד נשאר אצלכם ולא נשלח ללקוח.' : 'This record stays in your account and is not sent to the client.'}</p>
          {entryErr ? <p className="ld-err" role="alert">{he ? 'הוסיפו תיעוד קצר לפני השמירה.' : 'Add a short entry before saving.'}</p> : null}
        </div>
        {events.list.length ? (
          <ul className="ld-tl">
            {events.list.map((ev) => (
              <li key={ev.id}>
                <span className="ld-ic"><LeadEntryIcon kind={ev.kind} /></span>
                <div>
                  <div className="ld-meta"><b>{pick(TY[ev.kind] || TY.note, he)}</b>{entryTime(ev)}<span className="ld-auto">{he ? 'תיעוד שלכם' : 'Recorded by you'}</span></div>
                  <div className="ld-txt">{ev.body}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : events.status === 'ready' ? (
          <p className="ld-hint">{he ? 'עדיין אין תיעוד קשר. אפשר להוסיף שורה קצרה אחרי שיחה, פגישה או הודעה.' : 'No contact entries yet. Add a short record after a call, meeting or message.'}</p>
        ) : null}
      </section>
    </div>
  );
}

