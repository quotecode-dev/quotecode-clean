import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Building2, Globe, CreditCard, Clock, KeyRound } from 'lucide-react';
import { supabase } from '../shared/supabase';
import { AdminMarketIcon } from './AdminIdentityIcons';
import { AdminPlanState, AdminLegacyRecord } from './AdminSubscriptionState';
import { adminTargetUserId, useAdminAccountSummary, planStateText, free10Label, subscriptionStatusLabel } from '../domain/subscriptions/adminAccountSummary';
import { planName } from '../../supabase/functions/_shared/subscriptionContract.ts';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';
import { formatShortDateTime } from '../utils/shortDate';

// TEKANGO Admin V1 (Task 2): a shell-preserving User Details VIEW (renders
// inside the same Admin content outlet as every other Admin section - not
// a disconnected dark modal). Shows only truthful/useful data already
// stored on the account row, plus a best-effort quote/client count fetched
// on mount - if that query fails, it shows "unavailable", never a fake 0
// (Owner-binding rule, §2.3).
// Plan (OD-16/OD-20): the canonical new-model state comes ONLY from the read-only admin summary RPC; the legacy
// plan/trial_ends_at/is_lifetime fields are shown only in the labelled "Legacy record (history)" audit section.
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

  const { summary, legacy } = useAdminAccountSummary(adminTargetUserId(account));
  const address = parseAddress(account.address);
  const ready = summary.state === 'ready';

  const row = (label, value) => (
    <div className="admin-details-row"><span>{label}</span><span>{value}</span></div>
  );

  return (
    <AdminScreenFrame
      title={account.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}
      subtitle={account.email || undefined}
      label={isHebrew ? 'פרטי משתמש' : 'User details'}
      actions={(
        // PRODUCT_TRUTH_CAPABILITY: admin_console
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
          <h3><CreditCard size={15} />{isHebrew ? 'מסלול' : 'Plan'}</h3>
          {ready ? (
            <>
              {row(isHebrew ? 'מסלול' : 'Plan', planName(summary.planId, isHebrew ? 'he' : 'en'))}
              {summary.free10 && row(isHebrew ? 'יתרת הצעות חינם' : 'Free quotes balance', free10Label(summary.free10, isHebrew))}
              {row(isHebrew ? 'סטטוס מנוי' : 'Subscription status', subscriptionStatusLabel(summary.subscriptionStatus, isHebrew))}
            </>
          ) : (
            <p className="admin-plan-neutral" data-testid="admin-plan-neutral" title={planStateText(summary, isHebrew)}>
              <AdminPlanState summary={summary} isHebrew={isHebrew} />
            </p>
          )}
        </section>

        <section className="admin-details-card">
          <h3><Clock size={15} />{isHebrew ? 'שימוש' : 'Usage'}</h3>
          {row(isHebrew ? 'מספר הצעות' : 'Quote count', counts.quotes === 'loading' ? (isHebrew ? 'טוען...' : 'Loading...') : counts.quotes === 'unavailable' ? (isHebrew ? 'לא זמין' : 'Unavailable') : counts.quotes)}
          {row(isHebrew ? 'מספר לקוחות' : 'Client count', counts.clients === 'loading' ? (isHebrew ? 'טוען...' : 'Loading...') : counts.clients === 'unavailable' ? (isHebrew ? 'לא זמין' : 'Unavailable') : counts.clients)}
        </section>
      </div>

      <AdminLegacyRecord account={account} legacy={legacy} isHebrew={isHebrew} />

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
