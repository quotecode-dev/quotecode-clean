import { Globe } from 'lucide-react';
import { resolveAdminMarket } from '../utils/adminMarket';
// OD-16/OD-20: the legacy package icon (FREE/FREE_TRIAL/BASIC/PRO/LIFETIME identity) was removed - the Admin plan state
// comes only from the admin summary RPC (AdminSubscriptionState.jsx).
export function AdminMarketIcon({ account, isHebrew }) {
  const { market, countryCode } = resolveAdminMarket(account);
  const label = countryCode ? new Intl.DisplayNames([isHebrew ? 'he' : 'en'], { type: 'region' }).of(countryCode) : isHebrew ? 'מדינה לא ידועה' : 'Country unknown';
  if (countryCode === 'IL') return <span role="img" aria-label={label} title={label} className="admin-market-icon"><svg width="26" height="18" viewBox="0 0 30 21" aria-hidden="true"><rect width="30" height="21" rx="2" fill="white" stroke="#e4e1ee"/><path d="M0 4.5h30M0 16.5h30" stroke="#0038b8" strokeWidth="2.6"/><path d="M15 7l-4 7h8zM15 15l-4-7h8z" fill="none" stroke="#0038b8"/></svg></span>;
  if (countryCode) return <span role="img" aria-label={label} title={label} className="admin-market-icon"><img src={`/flags/${countryCode.toLowerCase()}.svg`} alt="" width="26" height="18" /></span>;
  // Owner-approved globe applies only to unknown International country.
  return <span role="img" aria-label={label} title={label} className="admin-market-icon">{market === 'International' ? <Globe size={20} aria-hidden="true" /> : '—'}</span>;
}
