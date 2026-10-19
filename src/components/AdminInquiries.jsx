// Owner console 2026-10-19 (spec docs/SMART_SUPPORT_EMAIL_SPEC_2026-10-19.md, typed: "מאשר שינוי ב-L-22: לשונית "פניות" חדשה בממשק
// הניהול"): the smart support email, stage 1 - the support / info emails the system received, READ-ONLY (no reply, no AI yet).
// The same table / cards / detail-dialog pattern as the AI support log; super admin only (RLS on support_inbound_messages).
import { useEffect, useState } from 'react';
import { Inbox, Search, Clock, Mail, MessageSquareText, Paperclip, X, ShieldCheck } from 'lucide-react';
import { supabase } from '../shared/supabase';
import { formatShortDateTime } from '../utils/shortDate';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';

const INQUIRIES_COPY = Object.freeze({
  title: { he: 'פניות', en: 'Inquiries' },
  subtitle: { he: (n) => `${n} פניות · קריאה בלבד`, en: (n) => `${n} inquiries · read-only` },
  search: { he: 'חיפוש לפי שולח, נושא או תוכן...', en: 'Search sender, subject or text...' },
  searchLabel: { he: 'חיפוש לפי שולח, נושא או תוכן', en: 'Search sender, subject or text' },
  loading: { he: 'טוען פניות...', en: 'Loading inquiries...' },
  failed: { he: 'טעינת הפניות נכשלה.', en: 'Could not load the inquiries.' },
  none: { he: 'עדיין לא התקבלו פניות. הקליטה תתחיל אחרי חיבור כתובת התמיכה.', en: 'No inquiries yet. Receiving starts once the support address is connected.' },
  noMatch: { he: 'אין פניות תואמות לחיפוש.', en: 'No inquiries match the search.' },
  time: { he: 'התקבל', en: 'Received' },
  from: { he: 'שולח', en: 'From' },
  subject: { he: 'נושא', en: 'Subject' },
  preview: { he: 'תוכן', en: 'Text' },
  detail: { he: 'פרטי הפנייה', en: 'Inquiry details' },
  close: { he: 'סגירה', en: 'Close' },
  to: { he: 'נשלח אל', en: 'Sent to' },
  attachments: { he: 'קבצים מצורפים (לא נפתחים)', en: 'Attachments (never opened)' },
  checks: { he: 'אימות השולח', en: 'Sender checks' },
  noSubject: { he: '(ללא נושא)', en: '(no subject)' },
  open: { he: 'לחץ לצפייה בפנייה המלאה', en: 'Click to read the full inquiry' },
});

export default function AdminInquiries({ isHebrew = true }) {
  const t = Object.fromEntries(Object.entries(INQUIRIES_COPY).map(([k, v]) => [k, isHebrew ? v.he : v.en]));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from('support_inbound_messages')
      .select('id, from_address, from_name, to_addresses, subject, text_body, attachments, auth_results, received_at')
      .order('received_at', { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (data) setRows(data); else if (error) setFailed(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const q = term.trim().toLowerCase();
  const shown = rows.filter((r) => !q || [r.from_address, r.from_name, r.subject, r.text_body].some((v) => String(v || '').toLowerCase().includes(q)));
  const when = (r) => (r.received_at ? formatShortDateTime(r.received_at, isHebrew ? 'Local' : 'International') : '');
  const sender = (r) => (r.from_name ? `${r.from_name} <${r.from_address}>` : r.from_address);
  const preview = (r) => String(r.text_body || '').replace(/\s+/g, ' ').slice(0, 140);
  const colgroup = <colgroup>{[16, 26, 24, 34].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>;
  const detail = (label, Icon, value, ltr) => (
    <div className="admin-details-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon size={13} color="#0F6672" />{label}</span>
      <span dir={ltr ? 'ltr' : 'auto'} style={{ whiteSpace: 'pre-wrap', textAlign: 'start', overflowWrap: 'anywhere' }}>{value || '-'}</span>
    </div>
  );

  return (
    <>
      <AdminScreenFrame
        title={t.title}
        subtitle={t.subtitle(shown.length)}
        label={t.title}
        isHebrew={isHebrew}
        controls={(
          <div className="admin-filters">
            <label className="admin-search">
              <Search size={16} />
              <input type="text" aria-label={t.searchLabel} placeholder={t.search} value={term} onChange={(e) => setTerm(e.target.value)} data-testid="inquiries-search" />
            </label>
          </div>
        )}
        head={(
          <div className="pf-head-gutter admin-table-wrap admin-head-wrap">
            <table>
              {colgroup}
              <thead>
                <tr>
                  {[[t.time, Clock], [t.from, Mail], [t.subject, Inbox], [t.preview, MessageSquareText]].map(([label, Icon]) => (
                    <th key={label} scope="col"><span className="admin-sort" style={{ cursor: 'default' }}><Icon size={12} aria-hidden="true" /> {label}</span></th>
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
                    <tr key={r.id} className="admin-support-row" data-testid="inquiry-row" onClick={() => setSelected(r)} title={t.open}>
                      <td><span className="admin-date" dir="ltr">{when(r)}</span></td>
                      <td><span className="admin-support-cell" dir="ltr">{sender(r)}</span></td>
                      <td><span className="admin-support-cell" dir="auto">{r.subject || t.noSubject}</span></td>
                      <td><span className="admin-support-cell" dir="auto">{preview(r)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-user-cards">
              {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
              {shown.map((r) => (
                <article className="admin-user-card admin-support-row" key={r.id} data-testid="inquiry-card" onClick={() => setSelected(r)}>
                  <div className="admin-card-heading">
                    <div className="admin-identity"><strong dir="ltr">{r.from_address}</strong><span dir="ltr">{when(r)}</span></div>
                  </div>
                  <p className="admin-support-cell" dir="auto"><strong>{r.subject || t.noSubject}</strong> · {preview(r)}</p>
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
            {detail(t.time, Clock, when(selected), true)}
            {detail(t.from, Mail, sender(selected), true)}
            {detail(t.to, Mail, (selected.to_addresses || []).join(', '), true)}
            {detail(t.subject, Inbox, selected.subject || t.noSubject)}
            {detail(t.preview, MessageSquareText, selected.text_body)}
            {Array.isArray(selected.attachments) && selected.attachments.length > 0
              && detail(t.attachments, Paperclip, selected.attachments.map((a) => a.filename || a.content_type || '?').join(', '), true)}
            {selected.auth_results && detail(t.checks, ShieldCheck, `SPF ${selected.auth_results.spf} · DKIM ${selected.auth_results.dkim} · DMARC ${selected.auth_results.dmarc}`, true)}
          </section>
        </div>
      )}
    </>
  );
}
