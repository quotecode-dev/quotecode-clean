import { useEffect, useState } from 'react';
import { UserPlus, Info, History } from 'lucide-react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';

// TEKANGO Admin V1 (Task 2/3): System Activity. "If no trustworthy activity
// source exists, do not synthesize history" - account registration
// (business_settings.created_at) is the one genuinely reconstructable
// historical event predating the audit log. Task 3 added admin_audit_log
// (a real, append-only record of privileged Admin actions, read here via
// the get_admin_audit_log() SECURITY DEFINER function, which itself
// re-verifies super_admin server-side) - shown as its own real, dated feed
// below registrations. Older changes made before that table existed are
// still not retained historically - a real, disclosed gap, not hidden.
const dateTimeLabel = (value, isHebrew) => value && Number.isFinite(new Date(value).getTime())
  ? new Date(value).toLocaleString(isHebrew ? 'he-IL' : 'en-GB') : '—';

const ACTION_LABELS = {
  grant_lifetime: { he: 'הענקת Lifetime', en: 'Grant Lifetime' },
  revoke_lifetime: { he: 'ביטול Lifetime', en: 'Revoke Lifetime' },
  extend_trial: { he: 'הארכת ניסיון', en: 'Extend Trial' },
  delete_user: { he: 'מחיקת משתמש', en: 'Delete User' },
  reset_quotes: { he: 'איפוס נתוני הצעות', en: 'Reset Quote Data' },
};
const OUTCOME_LABELS = {
  success: { he: 'הצליח', en: 'Success' },
  denied: { he: 'נדחה', en: 'Denied' },
  error: { he: 'שגיאה', en: 'Error' },
};

export default function AdminSystemActivity({ accounts, isHebrew }) {
  const users = accounts.filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');
  const recentRegistrations = [...users]
    .filter(a => a.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 30);

  const [auditRows, setAuditRows] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_admin_audit_log', { p_limit: 50 }).then(({ data, error }) => {
      if (cancelled) return;
      setAuditRows(error ? 'unavailable' : (data || []));
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminScreenFrame
      title={isHebrew ? 'פעילות מערכת' : 'System Activity'}
      subtitle={isHebrew ? 'פעולות ניהול מוגנות והרשמות אחרונות' : 'Protected admin actions and recent registrations'}
      label={isHebrew ? 'פעילות מערכת' : 'System activity'}
      controls={(
      <div className="admin-activity-notice">
          <Info size={15} />
          <span>
            {isHebrew
              ? 'שינויי חבילה/Lifetime/ניסיון שבוצעו לפני הפעלת יומן הביקורת אינם נשמרים היסטורית. רישום חשבון חדש הוא אירוע אמיתי הניתן לשחזור מנתונים קיימים תמיד - זהו פער אמיתי לגבי היסטוריה ישנה, לא הסתרה.'
              : 'Plan/Lifetime/trial changes made before the audit log existed are not retained historically. Account registration is always a real, reconstructable event - a real, disclosed gap for older history, not hidden.'}
          </span>
        </div>
      )}
    >

      <article className="admin-plans-group">
        <h3><History size={16} />{isHebrew ? 'היסטוריית פעולות מוגנות' : 'Privileged action history'}{Array.isArray(auditRows) && <span className="admin-plans-count">{auditRows.length}</span>}</h3>
        {auditRows === 'loading' ? (
          <p className="admin-overview-empty">{isHebrew ? 'טוען...' : 'Loading...'}</p>
        ) : auditRows === 'unavailable' ? (
          <p className="admin-overview-empty">{isHebrew ? 'לא זמין כרגע.' : 'Unavailable right now.'}</p>
        ) : auditRows.length === 0 ? (
          <p className="admin-overview-empty">{isHebrew ? 'אין עדיין פעולות מוגנות מתועדות.' : 'No privileged actions recorded yet.'}</p>
        ) : (
          <ul className="admin-overview-list">
            {auditRows.map(row => (
              <li key={row.id}>
                <div className="admin-overview-row" style={{ cursor: 'default' }}>
                  <span className="admin-overview-row-name" dir="auto">
                    {isHebrew ? (ACTION_LABELS[row.action]?.he || row.action) : (ACTION_LABELS[row.action]?.en || row.action)}
                    {' · '}
                    {isHebrew ? (OUTCOME_LABELS[row.outcome]?.he || row.outcome) : (OUTCOME_LABELS[row.outcome]?.en || row.outcome)}
                  </span>
                  <span className="admin-overview-row-meta" dir="ltr">{row.reason || '—'}</span>
                  <span className="admin-overview-row-date">{dateTimeLabel(row.created_at, isHebrew)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="admin-plans-group">
        <h3><UserPlus size={16} />{isHebrew ? 'רישומי חשבון אחרונים' : 'Recent registrations'}<span className="admin-plans-count">{recentRegistrations.length}</span></h3>
        {recentRegistrations.length === 0 ? (
          <p className="admin-overview-empty">{isHebrew ? 'אין רישומים.' : 'No registrations.'}</p>
        ) : (
          <ul className="admin-overview-list">
            {recentRegistrations.map(a => (
              <li key={a.id}>
                <div className="admin-overview-row" style={{ cursor: 'default' }}>
                  <span className="admin-overview-row-name" dir="auto">{a.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</span>
                  <span className="admin-overview-row-meta" dir="ltr">{a.email}</span>
                  <span className="admin-overview-row-date">{dateTimeLabel(a.created_at, isHebrew)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </AdminScreenFrame>
  );
}
