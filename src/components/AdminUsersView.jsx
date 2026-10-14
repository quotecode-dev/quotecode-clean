import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveAccountEntitlement } from '../utils/accountEntitlement';
import { getDisplayIdentityLabel } from '../utils/planCatalog';
import { AdminPackageIcon, AdminMarketIcon } from './AdminIdentityIcons';
import { resolveAdminMarket } from '../utils/adminMarket';
import AdminScreenFrame from './AdminScreenFrame';
import './adminUsers.css';
import { formatShortDateTime } from '../utils/shortDate';

// TEKANGO Admin V1 (Task 2): the Users/Businesses directory - business-
// first, real data only. Owner-binding rules this file follows:
// - No generic "USER" role column/badge.
// - No online/last-sign-in-recency status - that was removed entirely
//   (see Dashboard.jsx's filteredAdminAccounts comment for why).
// - Owner-locked package/market presentation is icon-only.
// - Default sort (newest registration first) is owned by the caller
//   (Dashboard.jsx's sortField/sortDirection default), not this component.
const dateLabel = (value, isHebrew) => value && Number.isFinite(new Date(value).getTime())
  ? formatShortDateTime(value, (isHebrew ? 'Local' : 'International')) : '—';

const PAGE_SIZE_OPTIONS = [25, 50];
// First-LIVE profile: sensitive Admin actions (Lifetime grant/revoke, trial
// extension, delete, quote reset) are NOT rendered at all - no disabled
// buttons, no technical "backend on hold" copy. Their backend is deferred.

export default function AdminUsersView({ accounts, orderedAccounts = accounts, search, onSearch, onSort, sortField, sortDirection, isHebrew, onDetails, bodyExtra }) {
  const [plan, setPlan] = useState('all');
  const [trialState, setTrialState] = useState('all');
  const [market, setMarket] = useState('all');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(0);

  const users = accounts.filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');
  const rows = users.map(account => ({ account, entitlement: resolveAccountEntitlement({ plan: account.plan, trialEndsAt: account.trial_ends_at, role: account.role, isLifetime: account.is_lifetime }) }));
  const order = new Map(orderedAccounts.map((a, index) => [a.id, index]));

  // Market comes from the account's own stored `country` field - never
  // inferred from interface language. business_settings.country defaults
  // to the literal string 'Unknown' in the schema, so only the two real,
  // known values map to Local/International; anything else (including
  // that literal default, and any unrecognized/legacy value) stays
  // "Unknown", never silently mapped to Local (Owner-binding rule, §2.5).
  const accountMarket = account => resolveAdminMarket(account).market;

  const visible = rows.filter(({ account, entitlement }) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = `${account.business_name || ''} ${account.email || ''}`.toLowerCase().includes(term);
    const matchesPlan = plan === 'all' || entitlement.displayIdentity === plan;
    const matchesTrial = trialState === 'all'
      || (trialState === 'active' && ['active', 'expiringSoon'].includes(entitlement.trialStatus))
      || (trialState === 'expired' && entitlement.trialStatus === 'expired')
      || (trialState === 'lifetime' && entitlement.isLifetime);
    const matchesMarket = market === 'all' || market === accountMarket(account);
    return matchesSearch && matchesPlan && matchesTrial && matchesMarket;
  }).sort((a, b) => (order.get(a.account.id) ?? Infinity) - (order.get(b.account.id) ?? Infinity));

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const identity = a => (
    <div className="admin-identity">
      <strong dir="auto" title={a.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}>{a.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</strong>
      <span dir="ltr" title={a.email || ''}>{a.email || '—'}</span>
    </div>
  );
  const marketBadge = a => <AdminMarketIcon account={a} isHebrew={isHebrew} />;
  const packageBadge = e => <AdminPackageIcon entitlement={e} isHebrew={isHebrew} />;
  const expiry = (a, e) => (
    <div className="admin-expiry">
      <span>{e.isLifetime ? (isHebrew ? 'ללא תפוגה' : 'No expiry') : e.trialStatus === 'expired' ? (isHebrew ? 'פג תוקף' : 'Expired') : ['active', 'expiringSoon'].includes(e.trialStatus) ? (isHebrew ? 'ניסיון פעיל' : 'Active trial') : (isHebrew ? 'אין ניסיון פעיל' : 'No active trial')}</span>
      {!e.isLifetime && a.trial_ends_at && <small>{dateLabel(a.trial_ends_at, isHebrew)}</small>}
    </div>
  );
  const registered = a => <span className="admin-date">{dateLabel(a.created_at, isHebrew)}</span>;
  // PRODUCT_TRUTH_CAPABILITY: admin_console
  const actions = a => <button className="admin-icon-button" aria-label={isHebrew ? `פרטי משתמש: ${a.business_name || a.email}` : `User details: ${a.business_name || a.email}`} onClick={() => onDetails(a)}>{isHebrew ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</button>;

  const columns = [
    [isHebrew ? 'עסק' : 'Business', 'business_name'],
    [isHebrew ? 'חבילה' : 'Plan', 'plan'],
    [isHebrew ? 'ניסיון / תפוגה' : 'Trial / expiry', 'trial_ends_at'],
    [isHebrew ? 'נרשם' : 'Registered', 'created_at'],
    [isHebrew ? 'אזור' : 'Region', 'country'],
    [isHebrew ? 'פעולות' : 'Actions', null],
  ];

  const colgroup = (
    <colgroup>
      {[30, 13, 18, 20, 12, 7].map((w, index) => <col key={index} style={{ width: `${w}%` }} />)}
    </colgroup>
  );

  return <div className="admin-users-page admin-screen-host">
    <AdminScreenFrame
      title={isHebrew ? 'משתמשים ועסקים' : 'Users & Businesses'}
      subtitle={isHebrew ? `${visible.length} משתמשים` : `${visible.length} users`}
      label={isHebrew ? 'רשימת משתמשים' : 'Users list'}
      controls={
        <div className="admin-filters">
          <label className="admin-search">
            <Search size={16} />
            <input aria-label={isHebrew ? 'חיפוש שם עסק או אימייל' : 'Search business name or email'} placeholder={isHebrew ? 'חיפוש שם עסק או אימייל...' : 'Search business or email...'} value={search} onChange={e => { onSearch(e.target.value); setPage(0); }} />
          </label>
          <select aria-label={isHebrew ? 'סינון חבילה' : 'Filter by plan'} value={plan} onChange={e => { setPlan(e.target.value); setPage(0); }}>
            <option value="all">{isHebrew ? 'כל החבילות' : 'All plans'}</option>
            {['FREE', 'FREE_TRIAL', 'BASIC', 'PRO', 'LIFETIME'].map(p => <option key={p} value={p}>{getDisplayIdentityLabel(p, isHebrew)}</option>)}
          </select>
          <select aria-label={isHebrew ? 'סינון ניסיון' : 'Filter by trial state'} value={trialState} onChange={e => { setTrialState(e.target.value); setPage(0); }}>
            <option value="all">{isHebrew ? 'כל המצבים' : 'All trial states'}</option>
            <option value="active">{isHebrew ? 'בניסיון' : 'On trial'}</option>
            <option value="expired">{isHebrew ? 'ניסיון פג' : 'Trial expired'}</option>
            <option value="lifetime">{isHebrew ? 'Lifetime' : 'Lifetime'}</option>
          </select>
          <select aria-label={isHebrew ? 'סינון שוק' : 'Filter by market'} value={market} onChange={e => { setMarket(e.target.value); setPage(0); }}>
            <option value="all">{isHebrew ? 'כל השווקים' : 'All markets'}</option>
            <option value="Local">{isHebrew ? 'ישראל' : 'Local'}</option>
            <option value="International">{isHebrew ? 'בינלאומי' : 'International'}</option>
            <option value="Unknown">{isHebrew ? 'לא ידוע' : 'Unknown'}</option>
          </select>
        </div>
      }
      head={
        <div className="pf-head-gutter admin-table-wrap admin-head-wrap">
          <table>
            {colgroup}
            <thead>
              <tr>
                {columns.map(([label, field]) => (
                  <th key={label} scope="col" aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {/* PRODUCT_TRUTH_DECORATIVE: sorts the users table by the clicked column */}
                    {field && onSort ? <button className="admin-sort" onClick={() => onSort(field)}>{label}{sortField === field ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</button> : label}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      }
    >
      <div className="admin-table-wrap">
        <table>
          {colgroup}
          <tbody>
            {pageRows.map(({ account: a, entitlement: e }) => (
              <tr key={a.id}>
                <td>{identity(a)}</td>
                <td>{packageBadge(e)}</td>
                <td>{expiry(a, e)}</td>
                <td>{registered(a)}</td>
                <td>{marketBadge(a)}</td>
                <td>{actions(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-user-cards">
        {pageRows.map(({ account: a, entitlement: e }) => (
          <article className="admin-user-card" key={a.id}>
            <div className="admin-card-heading">{identity(a)}{actions(a)}</div>
            <div className="admin-card-badges">{packageBadge(e)}{marketBadge(a)}</div>
            <div className="admin-card-dates">{expiry(a, e)}{registered(a)}</div>
          </article>
        ))}
      </div>

      {!pageRows.length && <p className="admin-empty" role="status">{isHebrew ? 'לא נמצאו משתמשים התואמים לחיפוש ולסינון.' : 'No users match this search/filter combination.'}</p>}

      {visible.length > 0 && (
        <div className="admin-pagination">
          <span>{isHebrew ? `עמוד ${safePage + 1} מתוך ${pageCount}` : `Page ${safePage + 1} of ${pageCount}`}</span>
          <div className="admin-pagination-controls">
            <select aria-label={isHebrew ? 'שורות בעמוד' : 'Rows per page'} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}>
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} / {isHebrew ? 'עמוד' : 'page'}</option>)}
            </select>
            {/* PRODUCT_TRUTH_DECORATIVE: goes to the previous page of the users table */}
            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0} aria-label={isHebrew ? 'עמוד קודם' : 'Previous page'}>
              {isHebrew ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: goes to the next page of the users table */}
            <button type="button" onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} aria-label={isHebrew ? 'עמוד הבא' : 'Next page'}>
              {isHebrew ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      )}
      {bodyExtra}
    </AdminScreenFrame>
  </div>;
}
