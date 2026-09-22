import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Building2, Globe, CreditCard, Clock, Infinity as InfinityIcon, KeyRound } from 'lucide-react';
import { supabase } from '../shared/supabase';
import { resolveAccountEntitlement } from '../utils/accountEntitlement';
import { AdminPackageIcon, AdminMarketIcon } from './AdminIdentityIcons';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';
import { formatShortDateTime } from '../utils/shortDate';

// TEKANGO Admin V1 (Task 2): a shell-preserving User Details VIEW (renders
// inside the same Admin content outlet as every other Admin section - not
// a disconnected dark modal). Shows only truthful/useful data already
// stored on the account row, plus a best-effort quote/client count fetched
// on mount - if that query fails, it shows "unavailable", never a fake 0
// (Owner-binding rule, §2.3).
const dateTimeLabel = (value, isHebrew) => value && Number.isFinite(new Date(value).getTime())
  ? formatShortDateTime(value, (isHebrew ? 'Local' : 'International'))
  : (isHebrew ? 'לא זמין' : 'Not available');

function parseAddress(raw) {
  if (!raw) return null;
  const [street, city, region, zip] = raw.split('|').map(p => (p || '').trim());
  const parts = [street, city, region, zip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export default function AdminUserDetails({ account, isHebrew, onBack }) {
  const [counts, setCounts] = useState({ quotes: 'loading', clients: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setCounts({ quotes: 'loading', clients: 'loading' });
    async function loadCounts() {
      try {
      const [quotesRes, clientsRes] = await Promise.all([
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('user_id', account.id),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', account.id),
      ]);
      if (cancelled) return;
      setCounts({
        quotes: quotesRes.error || !Number.isFinite(quotesRes.count) ? 'unavailable' : quotesRes.count,
        clients: clientsRes.error || !Number.isFinite(clientsRes.count) ? 'unavailable' : clientsRes.count,
      });
      } catch {
        if (!cancelled) setCounts({ quotes: 'unavailable', clients: 'unavailable' });
      }
    }
    loadCounts();
    return () => { cancelled = true; };
  }, [account.id]);

  const resolved = resolveAccountEntitlement({ plan: account.plan, trialEndsAt: account.trial_ends_at, role: account.role, isLifetime: account.is_lifetime });
  const address = parseAddress(account.address);

  const trialLine = () => {
    if (resolved.isLifetime) return isHebrew ? 'Lifetime - ללא תפוגה' : 'Lifetime - no expiry';
    if (!account.trial_ends_at) return isHebrew ? 'אין ניסיון פעיל' : 'No active trial';
    const expiry = dateTimeLabel(account.trial_ends_at, isHebrew);
    if (resolved.trialStatus === 'expired') return isHebrew ? `הניסיון פג ב-${expiry}` : `Trial expired on ${expiry}`;
    const days = resolved.trialDaysLeft;
    const daysLabel = days === null ? '' : isHebrew ? ` (${days} ימים נותרו)` : ` (${days} days left)`;
    return (isHebrew ? `בתוקף עד ${expiry}` : `Active until ${expiry}`) + daysLabel;
  };

  const row = (label, value) => (
    <div className="admin-details-row"><span>{label}</span><span>{value}</span></div>
  );

  return (
    <AdminScreenFrame
      title={account.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}
      subtitle={account.email || undefined}
      label={isHebrew ? 'פרטי משתמש' : 'User details'}
      actions={(
        <button type="button" className="admin-details-back" onClick={onBack}>
          {isHebrew ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
          {isHebrew ? 'חזרה לרשימת המשתמשים' : 'Back to Users'}
        </button>
      )}
    >
      <div className="admin-user-details">
      <div className="admin-details-grid">
        <section className="admin-details-card">
          <h3><Building2 size={15} />{isHebrew ? 'פרטי עסק' : 'Business'}</h3>
          {row(isHebrew ? 'שם העסק' : 'Business name', account.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business'))}
          {row(isHebrew ? 'אימייל' : 'Email', <span dir="ltr">{account.email || '—'}</span>)}
          {row(isHebrew ? 'טלפון' : 'Phone', <span dir="ltr">{account.phone || (isHebrew ? 'לא הוזן' : 'Not provided')}</span>)}
          {row(isHebrew ? 'כתובת' : 'Address', address || (isHebrew ? 'לא הוזנה' : 'Not provided'))}
          {row(isHebrew ? 'ח.פ / עוסק מורשה' : 'Tax / business ID', <span dir="ltr">{account.tax_id || (isHebrew ? 'לא הוזן' : 'Not provided')}</span>)}
          {row(isHebrew ? 'נרשם בתאריך' : 'Registered', dateTimeLabel(account.created_at, isHebrew))}
        </section>

        <section className="admin-details-card">
          <h3><Globe size={15} />{isHebrew ? 'שוק ומטבע' : 'Market & currency'}</h3>
          {row(isHebrew ? 'אזור' : 'Region', <AdminMarketIcon account={account} isHebrew={isHebrew} />)}
          {row(isHebrew ? 'מטבע מאוחסן' : 'Stored currency', account.currency || (isHebrew ? 'לא זמין' : 'Not available'))}
        </section>

        <section className="admin-details-card">
          <h3><CreditCard size={15} />{isHebrew ? 'חבילה וזכאות' : 'Plan & entitlement'}</h3>
          {row(isHebrew ? 'חבילה' : 'Plan', <AdminPackageIcon entitlement={resolved} isHebrew={isHebrew} />)}
          {row(isHebrew ? 'סטטוס ניסיון' : 'Trial status', trialLine())}
          {row(isHebrew ? 'Lifetime' : 'Lifetime', resolved.isLifetime
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><InfinityIcon size={13} />{isHebrew ? 'פעיל' : 'Active'}</span>
            : (isHebrew ? 'לא פעיל' : 'Not active'))}
        </section>

        <section className="admin-details-card">
          <h3><Clock size={15} />{isHebrew ? 'שימוש' : 'Usage'}</h3>
          {row(isHebrew ? 'מספר הצעות' : 'Quote count', counts.quotes === 'loading' ? (isHebrew ? 'טוען...' : 'Loading...') : counts.quotes === 'unavailable' ? (isHebrew ? 'לא זמין' : 'Unavailable') : counts.quotes)}
          {row(isHebrew ? 'מספר לקוחות' : 'Client count', counts.clients === 'loading' ? (isHebrew ? 'טוען...' : 'Loading...') : counts.clients === 'unavailable' ? (isHebrew ? 'לא זמין' : 'Unavailable') : counts.clients)}
        </section>
      </div>

      <details className="admin-details-advanced">
        <summary><KeyRound size={13} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />{isHebrew ? 'מידע תפעולי מתקדם' : 'Advanced operational info'}</summary>
        <div className="admin-details-card" style={{ marginTop: 8 }}>
          {row(isHebrew ? 'מזהה חשבון' : 'Account ID', <span dir="ltr">{account.id}</span>)}
          {row(isHebrew ? 'תפקיד' : 'Role', account.role || 'user')}
        </div>
      </details>
      </div>
    </AdminScreenFrame>
  );
}
