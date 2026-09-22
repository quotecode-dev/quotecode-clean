import { useEffect, useState } from 'react';
import { Bot, Search, Clock, Mail, HelpCircle, MessageSquareText, Tag, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../shared/supabase';
import { formatShortDateTime } from '../utils/shortDate';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';

// AI Support Logs - the ONE content implementation. It is an ordinary Admin
// destination rendered through AdminScreenFrame (static title/search/filter/
// column header + one inner scroll body) inside the unified authenticated
// shell. The former standalone /ai-logs page is now only a redirect into this
// destination. Read-only: same chat_logs query, search, category filter,
// column sorting and full-detail dialog as before. Access is enforced by the
// server (RLS on chat_logs); the Dashboard additionally only mounts it for a
// Super Admin.
export default function AISupportLogsContent({ isHebrew }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    let cancelled = false;
    supabase.from('chat_logs').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (cancelled) return;
      if (data) setLogs(data);
      else if (error) setFailed(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSort = (field) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const term = searchTerm.toLowerCase();
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = (log.user_question || '').toLowerCase().includes(term)
      || (log.user_email || '').toLowerCase().includes(term)
      || (log.ai_response || '').toLowerCase().includes(term);
    const matchesCategory = categoryFilter === 'ALL' || (log.category || 'GENERAL') === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    let aVal = a[sortField] || '';
    let bVal = b[sortField] || '';
    if (sortField === 'created_at') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime(); }
    else { aVal = aVal.toString().toLowerCase(); bVal = bVal.toString().toLowerCase(); }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  const categories = ['ALL', ...new Set(logs.map((l) => l.category || 'GENERAL'))];
  const isCritical = (log) => !!log.category && log.category !== 'GENERAL';
  const when = (log) => (log.created_at ? formatShortDateTime(log.created_at, (isHebrew ? 'Local' : 'International')) : '');

  const columns = [
    ['created_at', isHebrew ? 'זמן' : 'Time', Clock],
    ['user_email', isHebrew ? 'אימייל משתמש' : 'User email', Mail],
    ['user_question', isHebrew ? 'שאלת הלקוח' : 'Customer question', HelpCircle],
    ['ai_response', isHebrew ? 'תשובת ה-AI' : 'AI answer', MessageSquareText],
    ['category', isHebrew ? 'קטגוריה' : 'Category', Tag],
  ];
  const colgroup = <colgroup>{[15, 20, 25, 28, 12].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>;
  const badge = (log) => (
    <span className={`admin-badge ${isCritical(log) ? 'admin-support-critical' : ''}`}>
      {isCritical(log) ? <AlertTriangle size={11} /> : <Tag size={11} />}
      {log.category || 'GENERAL'}
    </span>
  );
  const title = isHebrew ? 'יומן שאלות ותשובות AI' : 'AI Support Logs';
  const empty = failed
    ? (isHebrew ? 'טעינת הלוגים נכשלה.' : 'Could not load the logs.')
    : (isHebrew ? 'אין לוגים תואמים לחיפוש.' : 'No logs match the search.');

  const detail = (label, Icon, color, value, ltr) => (
    <div className="admin-details-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon size={13} color={color} />{label}</span>
      <span dir={ltr ? 'ltr' : 'auto'} style={{ whiteSpace: 'pre-wrap', textAlign: 'start' }}>{value || '-'}</span>
    </div>
  );

  return (
    <>
      <AdminScreenFrame
        title={title}
        subtitle={isHebrew ? `${filteredLogs.length} רשומות · קריאה בלבד` : `${filteredLogs.length} entries · read-only`}
        label={title}
        controls={(
          <div className="admin-filters">
            <label className="admin-search">
              <Search size={16} />
              <input
                type="text"
                aria-label={isHebrew ? 'חיפוש לפי שאלה, אימייל או תשובה' : 'Search question, email or answer'}
                placeholder={isHebrew ? 'חיפוש לפי שאלה, אימייל או תשובה...' : 'Search question, email or answer...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
            <select aria-label={isHebrew ? 'סינון קטגוריה' : 'Filter by category'} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{isHebrew ? `קטגוריה: ${cat}` : `Category: ${cat}`}</option>
              ))}
            </select>
          </div>
        )}
        head={(
          <div className="pf-head-gutter admin-table-wrap admin-head-wrap">
            <table>
              {colgroup}
              <thead>
                <tr>
                  {columns.map(([field, label, Icon]) => (
                    <th key={field} scope="col" aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                      <button className="admin-sort" onClick={() => handleSort(field)}>
                        <Icon size={12} aria-hidden="true" /> {label}{sortField === field ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
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
          <p className="admin-empty" role="status">{isHebrew ? 'טוען נתונים...' : 'Loading...'}</p>
        ) : filteredLogs.length === 0 ? (
          <p className="admin-empty" role="status">{empty}</p>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table>
                {colgroup}
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="admin-support-row" onClick={() => setSelectedLog(log)} title={isHebrew ? 'לחץ לצפייה במלוא המלל' : 'Click to read the full text'}>
                      <td><span className="admin-date" dir="ltr">{when(log)}</span></td>
                      <td><span className="admin-support-cell" dir="ltr">{log.user_email || '-'}</span></td>
                      <td><span className="admin-support-cell" dir="auto">{log.user_question || '-'}</span></td>
                      <td><span className="admin-support-cell" dir="auto">{log.ai_response || '-'}</span></td>
                      <td>{badge(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-user-cards">
              {filteredLogs.map((log) => (
                <article className="admin-user-card admin-support-row" key={log.id} onClick={() => setSelectedLog(log)}>
                  <div className="admin-card-heading">
                    <div className="admin-identity"><strong dir="ltr">{log.user_email || '-'}</strong><span dir="ltr">{when(log)}</span></div>
                    {badge(log)}
                  </div>
                  <p className="admin-support-cell" dir="auto">{log.user_question || '-'}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </AdminScreenFrame>

      {selectedLog && (
        <div className="admin-dialog-backdrop" onClick={() => setSelectedLog(null)}>
          <section role="dialog" aria-modal="true" aria-label={isHebrew ? 'פרטי לוג מלאים' : 'Full log details'} className="admin-action-dialog" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setSelectedLog(null); }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={20} color="#7c3aed" />{isHebrew ? 'פרטי לוג מלאים' : 'Full log details'}
              <button className="admin-icon-button" style={{ marginInlineStart: 'auto' }} aria-label={isHebrew ? 'סגירה' : 'Close'} onClick={() => setSelectedLog(null)}><X size={16} /></button>
            </h2>
            {detail(isHebrew ? 'זמן' : 'Time', Clock, '#7c3aed', when(selectedLog), true)}
            {detail(isHebrew ? 'אימייל משתמש' : 'User email', Mail, '#4f46e5', selectedLog.user_email, true)}
            {detail(isHebrew ? 'קטגוריה' : 'Category', Tag, '#f59e0b', selectedLog.category || 'GENERAL')}
            {detail(isHebrew ? 'שאלת הלקוח' : 'Customer question', HelpCircle, '#0ea5e9', selectedLog.user_question)}
            {detail(isHebrew ? 'תשובת ה-AI' : 'AI answer', MessageSquareText, '#10b981', selectedLog.ai_response)}
          </section>
        </div>
      )}
    </>
  );
}
