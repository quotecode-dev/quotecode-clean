import { useEffect, useRef, useState } from 'react';
import { Search, MoreHorizontal, Lock } from 'lucide-react';
import { AdminMarketIcon } from './AdminIdentityIcons';
import AdminScreenFrame from './AdminScreenFrame';
import { AdminAccountStatus, AdminPlanSystemNotice } from './AdminSubscriptionState';
import { adminTargetUserId, useAdminAccountSummaries, accountStatus, ACCOUNT_STATUS, ACCOUNT_STATUS_ORDER, tr } from '../domain/subscriptions/adminAccountSummary';
import { useAdminAccountsPage } from '../domain/admin/adminAccountsClient';
import { peekUsersFilterIntent, clearUsersFilterIntent, saveUsersListState, peekUsersListState, clearUsersListState } from '../domain/admin/adminNavIntent';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';
import { resolveAdminMarket } from '../utils/adminMarket';
import { accountDate, accountDateTime, ADMIN_DATE_MARKET } from '../utils/adminDates';
import { formatShortDateTime } from '../utils/shortDate';
import './adminUsers.css';
import './adminV2.css';

// TEKANGO Admin V1 (Task 2): the Users/Businesses directory - business-first, real data only.
// Admin redesign part A (Owner console 2026-10-16, approval naming L-07 / L-20; spec §4.2 + the approved users sketch):
// - 7 columns: Business (name + email; an "Admin" tag beside an admin account - the Role column was removed by the Owner), Plan (the
//   user's own medallion + the status words), Indicators (only extra facts: an unverified usage counter, a legacy trial, a verified
//   server state), Registered, Last sign-in, Region (icon with its name), Actions (a visible "Details" + a "More actions" menu: Lifetime
//   grant / revoke by state, reset quotes, delete last and red - each opens the protected dialog; opening the menu needs no password).
// - Search (250 ms), status and market filters, sort and pages come from the SERVER (get_admin_accounts) - one population, the real
//   total; while that RPC is not deployed here the same filters run over the loaded rows (fallback).
// - Under 1200px every row is a card with all the fields. Dates by the ACCOUNT's market (IRON-DATE-001), never the interface language.
const PAGE_SIZE = 25;
const users0 = (accounts) => (accounts || []).filter(a => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted');

function RowActions({ account, isHebrew, onDetails, onReset, onDelete, onLifetime }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const btn = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  const name = account.business_name || account.email;
  const lifetime = account.is_lifetime === true;
  const pick = (fn) => { btn.current?.focus(); setOpen(false); fn(account); };
  const items = [
    onLifetime && { key: lifetime ? 'revoke' : 'grant', label: lifetime ? C.revokeLifetime : C.grantLifetime, run: () => pick(onLifetime) },
    onReset && { key: 'reset', label: C.resetQuotes, run: () => pick(onReset) },
    onDelete && { key: 'delete', label: C.deleteAccount, run: () => pick(onDelete), danger: true },
  ].filter(Boolean);
  return (
    <div className="av-row-actions">
      {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
      <button type="button" className="av-btn" onClick={() => onDetails(account)} aria-label={`${t(isHebrew, C.details.he, C.details.en)}: ${name}`}>{t(isHebrew, C.details.he, C.details.en)}</button>
      {items.length > 0 && (
        <div className="av-menu-wrap av-tip-host" ref={wrap} onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); btn.current?.focus(); } }}>
          {/* PRODUCT_TRUTH_DECORATIVE: opens the row's protected-actions menu (nothing runs until a dialog is confirmed) */}
          <button ref={btn} type="button" className="av-btn av-menu-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`${t(isHebrew, C.moreActions.he, C.moreActions.en)}: ${name}`} onClick={() => setOpen((v) => !v)}>
            <MoreHorizontal size={19} aria-hidden="true" />
          </button>
          {!open && <span className="av-tip" aria-hidden="true">{t(isHebrew, C.protectedActions.he, C.protectedActions.en)}</span>}
          {open && (
            <div className="av-menu" role="menu" aria-label={t(isHebrew, C.protectedActions.he, C.protectedActions.en)}>
              {items.map((it) => (
                // PRODUCT_TRUTH_DECORATIVE: opens the protected dialog of this action (reason + admin password, server-verified)
                <button key={it.key} type="button" role="menuitem" className={it.danger ? 'av-danger-item' : undefined} data-action={it.key} onClick={it.run}>
                  <Lock size={16} aria-hidden="true" /><span>{t(isHebrew, it.label.he, it.label.en)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// the shown indicator group of each status (verified, usage not verified, legacy trial, legacy trial ended, payment unverified, none)
const INDICATOR_RANK = { free10: 0, paid_monthly: 0, paid_annual: 0, free10_inactive: 1, trial: 2, trial_ended: 3, paid_unverified: 4, lifetime: 5 };

export default function AdminUsersView({ accounts, orderedAccounts = accounts, search, onSearch, isHebrew, onDetails, onReset = null, onDelete = null, onLifetime = null, bodyExtra, refreshKey: outerRefresh = 0, onRefreshAccounts = null }) {
  const [localRefresh, setLocalRefresh] = useState(0);
  const refreshKey = outerRefresh * 1000 + localRefresh;
  // AV-05 / AV-06: a legend / link intent wins; otherwise the state saved when Details opened; otherwise the defaults
  const [init] = useState(() => {
    const intent = peekUsersFilterIntent();
    if (intent) return { market: intent.market || 'all', status: intent.status || 'all', sort: { field: 'created_at', direction: 'desc' }, page: 0, scrollTop: 0 };
    const saved = peekUsersListState();
    return saved || { market: 'all', status: 'all', sort: { field: 'created_at', direction: 'desc' }, page: 0, scrollTop: 0 };
  });
  useEffect(() => { clearUsersFilterIntent(); clearUsersListState(); }, []);
  const [market, setMarket] = useState(init.market);
  const [statusFilter, setStatusFilter] = useState(init.status);
  const [sort, setSort] = useState(init.sort);
  const [page, setPage] = useState(init.page);
  const restoreScroll = useRef(init.scrollTop || 0);
  // desktop (the table, >= 1000px) vs phone / tablet (cards) - the same breakpoint as adminV2.css
  const wideQuery = '(min-width: 1000px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(wideQuery).matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(wideQuery);
    const recompute = () => setWide(mq.matches);
    recompute();
    mq.addEventListener ? mq.addEventListener('change', recompute) : mq.addListener(recompute);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', recompute) : mq.removeListener(recompute); };
  }, []);
  const [query, setQuery] = useState(search || '');
  // AV-06: the mount run keeps a restored page; only a REAL search change goes back to page 1
  const searchSeen = useRef(search || '');
  useEffect(() => { const h = setTimeout(() => { setQuery(search || ''); if ((search || '') !== searchSeen.current) { searchSeen.current = search || ''; setPage(0); } }, 250); return () => clearTimeout(h); }, [search]);

  const server = useAdminAccountsPage({
    query, market: market === 'all' ? null : market, status: statusFilter === 'all' ? null : statusFilter,
    sort: sort.field, direction: sort.direction, pageSize: PAGE_SIZE, offset: page * PAGE_SIZE,
  }, refreshKey);
  // the server list once it answered (or failed with no data yet); until then the loaded rows - no empty flash while it loads
  const serverMode = (server.state === 'ready' || server.state === 'stale') && !!server.data;
  // Codex verification AV-02: the loaded rows stand in ONLY while the RPC is not deployed (or before its first answer)

  // fallback over the loaded rows (the RPC is not deployed on this server)
  const users = users0(accounts);
  const order = new Map(orderedAccounts.map((a, index) => [a.id, index]));
  const accountMarket = (account) => resolveAdminMarket(account).market;
  // plan / indicators sort by the shared status order and the shown indicator group - the same ranks as get_admin_accounts
  const sortValue = (x, f) => {
    if (f === 'created_at' || f === 'last_sign_in') { const t0 = x[f] ? new Date(x[f]).getTime() : NaN; return Number.isFinite(t0) ? t0 : null; }
    if (f === 'plan') return ACCOUNT_STATUS_ORDER.indexOf(accountStatus(x, null).key);
    if (f === 'indicators') return INDICATOR_RANK[accountStatus(x, null).key] ?? 5;
    return String((f === 'country' ? (x.country || 'Local') : x[f]) || '').toLowerCase();
  };
  const cmp = (a, b) => {
    const f = sort.field;
    const va = sortValue(a, f);
    const vb = sortValue(b, f);
    // AV-13: a missing date is always last
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    // the direction reverses only the sorted value; ties keep the loaded order
    if (va !== vb) return (va < vb ? -1 : 1) * (sort.direction === 'asc' ? 1 : -1);
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  };
  const local = users.filter((account) => {
    const term = (query || '').trim().toLowerCase();
    const matchesSearch = `${account.business_name || ''} ${account.email || ''}`.toLowerCase().includes(term);
    const matchesMarket = market === 'all' || market === accountMarket(account);
    const matchesStatus = statusFilter === 'all' || accountStatus(account, null).key === statusFilter;
    return matchesSearch && matchesMarket && matchesStatus;
  }).sort(cmp);

  const failed = !serverMode && server.state === 'unavailable';
  const total = serverMode ? (server.data?.total ?? null) : failed ? null : local.length;
  const pageRows = serverMode ? (server.data?.rows || []) : failed ? [] : local.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  // the per-account server summary for the visible page only (the counter / billing period); "not active" is global - one probe
  const { system, byId } = useAdminAccountSummaries(pageRows.map(adminTargetUserId));
  const summaryOf = (a) => (system === 'not_active' ? null : (byId[adminTargetUserId(a)] || null));
  const adminMarket = isHebrew ? 'Local' : 'International';

  const setSortField = (field) => { setPage(0); setSort((s) => (s.field === field ? { field, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: field === 'created_at' || field === 'last_sign_in' ? 'desc' : 'asc' })); };
  const sortHead = (field, label) => {
    const active = sort.field === field;
    return (
      <th scope="col" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {/* PRODUCT_TRUTH_DECORATIVE: sorts the users list by this column (read-only) */}
        <button type="button" className="av-sort" onClick={() => setSortField(field)}>{t(isHebrew, label.he, label.en)}{active && <span aria-hidden="true">{sort.direction === 'asc' ? '↑' : '↓'}</span>}</button>
      </th>
    );
  };
  const indicator = (a, statusKey) => {
    if (statusKey === 'free10_inactive') return <span className="av-badge av-ok">{t(isHebrew, C.usageUnverified.he, C.usageUnverified.en)}</span>;
    if (statusKey === 'trial' || statusKey === 'trial_ended') return <span className={`av-badge ${statusKey === 'trial_ended' ? 'av-bad' : 'av-ok'}`}>{t(isHebrew, C.legacyTrial.he, C.legacyTrial.en)}</span>;
    if (statusKey === 'free10' || statusKey === 'paid_monthly' || statusKey === 'paid_annual') return <span className="av-badge av-ok">{t(isHebrew, C.verifiedState.he, C.verifiedState.en)}</span>;
    if (statusKey === 'paid_unverified') return <span className="av-badge av-warn">{tr(ACCOUNT_STATUS.paid_unverified, isHebrew)}</span>;
    return <span className="av-muted"><span aria-hidden="true">—</span><span className="av-sr-only">{isHebrew ? 'אין חיוויים' : 'No indicators'}</span></span>;
  };
  const rowStatus = (a) => {
    const computed = accountStatus(a, summaryOf(a));
    // the server status stands unless this row's own summary is ready (a loading / failed summary never overrides it)
    return a.status && a.status !== computed.key && summaryOf(a)?.state !== 'ready' ? a.status : computed.key;
  };
  const business = (a) => (
    <div className="av-business">
      <span className="av-nameline">
        <strong><bdi>{a.business_name || (isHebrew ? 'עסק ללא שם' : 'Unnamed business')}</bdi></strong>
        {a.role === 'admin' && <span className="av-badge av-admin">{t(isHebrew, C.adminBadge.he, C.adminBadge.en)}</span>}
        {a.is_test === true && <span className="av-badge av-warn" data-testid={`admin-row-test-${a.id}`}>{t(isHebrew, C.testBadge.he, C.testBadge.en)}</span>}
      </span>
      <span className="av-mail" title={a.email}>{a.email}</span>
    </div>
  );
  const plan = (a, sub = null) => <AdminAccountStatus account={a} summary={summaryOf(a)} statusKey={rowStatus(a)} isHebrew={isHebrew} formatDate={(v) => accountDate(v, a, adminMarket)} size={26} sub={sub} />;
  // last sign-in: the date, then the time on the next line (sketch), by the account market
  const signIn = (a) => { const [d, tm] = accountDateTime(a.last_sign_in, a, adminMarket).split(' '); return <bdi className="av-num" data-testid="admin-last-sign-in">{d}{tm && <><br />{tm}</>}</bdi>; };
  const signInTime = (a) => accountDateTime(a.last_sign_in, a, adminMarket);
  const marketWords = (a) => { const m = resolveAdminMarket(a).market; return m === 'Local' ? C.regionLocal : m === 'International' ? C.regionIntl : C.regionUnknown; };
  const actions = (a) => <RowActions account={a} isHebrew={isHebrew} onDetails={openDetails} onReset={onReset} onDelete={onDelete} onLifetime={onLifetime} />;

  const loading = server.state === 'loading' && users.length === 0;
  // AV-06: Details saves the list state (filters, sort, page, scroll) and the list restores it on the way back
  const scrollBody = () => (typeof document !== 'undefined' ? document.querySelector('.admin-screen > .pf-screen-body') : null);
  const openDetails = (a) => { saveUsersListState({ market, status: statusFilter, sort, page, scrollTop: scrollBody()?.scrollTop || 0 }); onDetails(a); };
  useEffect(() => {
    if (!restoreScroll.current || pageRows.length === 0) return;
    const el = scrollBody(); if (el) el.scrollTop = restoreScroll.current;
    restoreScroll.current = 0;
  }, [pageRows.length]);
  // AV-07: on phones / tablets (cards) the sort is one select - the same fields and directions as the table headers
  const SORT_OPTIONS = [['created_at', 'desc'], ['created_at', 'asc'], ['last_sign_in', 'desc'], ['last_sign_in', 'asc'], ['business_name', 'asc'], ['business_name', 'desc'], ['plan', 'asc'], ['plan', 'desc'], ['indicators', 'asc'], ['indicators', 'desc'], ['country', 'asc'], ['country', 'desc']];
  const sortLabel = (f, d) => { const w = { created_at: C.colRegistered, last_sign_in: C.colLastSignIn, business_name: C.colBusiness, country: C.colRegion, plan: C.colPlan, indicators: C.colIndicators }[f]; const dir = (f === 'created_at' || f === 'last_sign_in') ? (d === 'desc' ? C.newestFirst : C.oldestFirst) : (d === 'asc' ? C.aToZ : C.zToA); return `${t(isHebrew, w.he, w.en)}, ${t(isHebrew, dir.he, dir.en)}`; };
  const clear = () => { onSearch(''); setQuery(''); setMarket('all'); setStatusFilter('all'); setPage(0); };
  const sortWords = { created_at: C.colRegistered, last_sign_in: C.colLastSignIn, business_name: C.colBusiness, country: C.colRegion, plan: C.colPlan, indicators: C.colIndicators }[sort.field];
  const from = total ? page * PAGE_SIZE + 1 : 0;
  const to = total ? Math.min(total, page * PAGE_SIZE + pageRows.length) : 0;

  // Owner console 2026-10-16: on desktop the scrollbar starts at the column headers - search, filters and the count stay fixed above
  // (the frame's static block); on a phone / tablet (cards) they scroll with the list so the cards keep the screen (Owner 5186 phone video)
  const topCard = (
    <div className="av-card av-users-top">
      <div className="av-toolbar" role="search">
        <label className="av-field av-search">
          <span>{t(isHebrew, C.findUser.he, C.findUser.en)}</span>
          <input type="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder={t(isHebrew, C.findUserPh.he, C.findUserPh.en)} />
        </label>
        <label className="av-field">
          <span>{t(isHebrew, C.status.he, C.status.en)}</span>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} aria-label={isHebrew ? 'סינון לפי מצב' : 'Filter by status'}>
            <option value="all">{t(isHebrew, C.allStatuses.he, C.allStatuses.en)}</option>
            {ACCOUNT_STATUS_ORDER.map((k) => <option key={k} value={k}>{tr(ACCOUNT_STATUS[k], isHebrew)}</option>)}
          </select>
        </label>
        <label className="av-field">
          <span>{t(isHebrew, C.market.he, C.market.en)}</span>
          <select value={market} onChange={(e) => { setMarket(e.target.value); setPage(0); }}>
            <option value="all">{t(isHebrew, C.allMarkets.he, C.allMarkets.en)}</option>
            <option value="Local">{t(isHebrew, C.israel.he, C.israel.en)}</option>
            <option value="International">{t(isHebrew, C.international.he, C.international.en)}</option>
            <option value="Unknown">{t(isHebrew, C.unknown.he, C.unknown.en)}</option>
          </select>
        </label>
        {!wide && (
          <label className="av-field">
            <span>{isHebrew ? 'מיון' : 'Sort'}</span>
            <select value={`${sort.field}:${sort.direction}`} onChange={(e) => { const [field, direction] = e.target.value.split(':'); setPage(0); setSort({ field, direction }); }}>
              {SORT_OPTIONS.map(([f, d]) => <option key={`${f}:${d}`} value={`${f}:${d}`}>{sortLabel(f, d)}</option>)}
            </select>
          </label>
        )}
        {/* PRODUCT_TRUTH_DECORATIVE: clears the users search and filters */}
        <button type="button" className="av-btn" onClick={clear}>{t(isHebrew, C.clear.he, C.clear.en)}</button>
      </div>

      <div className="av-cardhead">
        <span className="av-small av-muted" role="status">
          <bdi className="av-num">{total ?? '—'}</bdi> {t(isHebrew, C.usersCount.he, C.usersCount.en)} · {t(isHebrew, C.sortedBy.he, C.sortedBy.en)}: {t(isHebrew, sortWords.he, sortWords.en)}, {t(isHebrew, ...(sort.field !== 'created_at' && sort.field !== 'last_sign_in' ? (sort.direction === 'asc' ? [C.aToZ.he, C.aToZ.en] : [C.zToA.he, C.zToA.en]) : (sort.direction === 'desc' ? [C.newestFirst.he, C.newestFirst.en] : [C.oldestFirst.he, C.oldestFirst.en])))}
        </span>
        {server.state === 'stale' && <span className="av-badge av-warn">{t(isHebrew, C.staleSince.he, C.staleSince.en)} <bdi className="av-num">{server.updatedAt ? formatShortDateTime(server.updatedAt, ADMIN_DATE_MARKET) : ''}</bdi></span>}
      </div>
      {pageRows.length > 0 && !(failed && !server.data) && <div className="av-small av-muted av-users-caption" aria-hidden="true">{t(isHebrew, C.usersCaption.he, C.usersCaption.en)}</div>}
    </div>
  );

  return (
    <div className="admin-screen-host">
    <AdminScreenFrame
      title={isHebrew ? 'משתמשים' : 'Users'}
      subtitle={t(isHebrew, C.tagline.he, C.tagline.en)}
      label={isHebrew ? 'רשימת משתמשים' : 'Users list'}
      isHebrew={isHebrew}
      onRefresh={() => { setLocalRefresh((k) => k + 1); if (typeof onRefreshAccounts === 'function') onRefreshAccounts(); }}
      refreshing={!!server.refreshing}
      updatedAt={serverMode ? server.updatedAt : null}
      staleSince={server.state === 'stale' ? (server.updatedAt || server.failedAt) : null}
      formatTime={(v) => formatShortDateTime(v, ADMIN_DATE_MARKET)}
      controls={(
        <>
          {system !== 'active' && <AdminPlanSystemNotice system={system} isHebrew={isHebrew} />}
          {wide && topCard}
        </>
      )}
    >
    {!wide && topCard}
    <div className="av-card av-users av-users-rows" data-users-mode={serverMode ? 'server' : 'loaded'}>
      {failed && !server.data ? (
        <div className="av-statebox" role="alert">
          <h3>{t(isHebrew, C.loadFailed.he, C.loadFailed.en)}</h3>
          <p className="av-muted">{t(isHebrew, C.loadFailedHint.he, C.loadFailedHint.en)}</p>
        </div>
      ) : loading && !server.data ? (
        <div role="status" aria-live="polite">
          <div className="av-notice av-info">{t(isHebrew, C.loading.he, C.loading.en)}</div>
          {[0, 1, 2, 3].map((i) => <div key={i} className="av-skeleton" style={{ blockSize: 44 }} />)}
        </div>
      ) : pageRows.length === 0 ? (
        <div className="av-statebox" role="status">
          <div className="av-stateicon" aria-hidden="true"><Search size={26} /></div>
          <h3>{t(isHebrew, C.noMatch.he, C.noMatch.en)}</h3>
          <p className="av-muted">{t(isHebrew, C.noMatchHint.he, C.noMatchHint.en)}</p>
          {/* PRODUCT_TRUTH_DECORATIVE: clears the users search and filters */}
          <button type="button" className="av-btn av-primary" onClick={clear}>{t(isHebrew, C.clearFilters.he, C.clearFilters.en)}</button>
        </div>
      ) : (
        <>
          <div className="av-tablewrap av-users-table">
            <table>
              <caption className="av-sr-only">{t(isHebrew, C.usersCaption.he, C.usersCaption.en)}</caption>
              <thead>
                <tr>
                  {sortHead('business_name', C.colBusiness)}
                  {sortHead('plan', C.colPlan)}
                  {sortHead('indicators', C.colIndicators)}
                  {sortHead('created_at', C.colRegistered)}
                  {sortHead('last_sign_in', C.colLastSignIn)}
                  {sortHead('country', C.colRegion)}
                  <th scope="col">{t(isHebrew, C.colActions.he, C.colActions.en)}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => {
                  const st = rowStatus(a);
                  return (
                    <tr key={a.id} data-user-id={a.user_id}>
                      <td>{business(a)}</td>
                      <td>{plan(a)}</td>
                      <td>{indicator(a, st)}</td>
                      <td><bdi className="av-num">{accountDate(a.created_at, a, adminMarket)}</bdi></td>
                      <td>{signIn(a)}</td>
                      <td><AdminMarketIcon account={a} isHebrew={isHebrew} /></td>
                      <td>{actions(a)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="av-usercards">
            {pageRows.map((a) => {
              const st = rowStatus(a);
              return (
                <article key={a.id} className="av-usercard" data-user-id={a.user_id}>
                  <div className="av-cardtop">{business(a)}{actions(a)}</div>
                  {plan(a, st === 'free10_inactive' ? t(isHebrew, C.usageCounterUnverified.he, C.usageCounterUnverified.en) : null)}
                  <div className="av-pills av-section"><span className="av-badge">{t(isHebrew, marketWords(a).he, marketWords(a).en)}</span></div>
                  <div className="av-meta">
                    <span>{t(isHebrew, C.colRegistered.he, C.colRegistered.en)} <bdi className="av-num">{accountDate(a.created_at, a, adminMarket)}</bdi></span>
                    <span>{t(isHebrew, C.signInShort.he, C.signInShort.en)} <bdi className="av-num">{signInTime(a)}</bdi></span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="av-pager">
            <span>{t(isHebrew, C.showing.he, C.showing.en)} <bdi className="av-num">{from}–{to}</bdi> {t(isHebrew, C.of.he, C.of.en)} <bdi className="av-num">{total ?? '—'}</bdi></span>
            <span className="av-pills">
              {/* PRODUCT_TRUTH_DECORATIVE: previous page of the users list */}
              <button type="button" className="av-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>{t(isHebrew, C.previous.he, C.previous.en)}</button>
              {/* PRODUCT_TRUTH_DECORATIVE: next page of the users list */}
              <button type="button" className="av-btn" disabled={!total || to >= total} onClick={() => setPage((p) => p + 1)}>{t(isHebrew, C.next.he, C.next.en)}</button>
            </span>
          </div>
        </>
      )}
      {pageRows.length > 0 && <p className="av-footnote">{t(isHebrew, C.usersFootnote.he, C.usersFootnote.en)}</p>}
      {bodyExtra}
    </div>
    </AdminScreenFrame>
    </div>
  );
}
