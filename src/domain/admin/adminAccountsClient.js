// Admin redesign part A (Owner 2026-10-16, spec §10 contracts 2-3): the admin dashboard summary and the paged accounts list come from
// the server (migration 20261016100000: get_admin_dashboard_summary / get_admin_accounts, super_admin only). Read-only.
// States: 'loading' | 'ready' | 'not_deployed' (the RPC is not on this server yet -> the caller falls back to the loaded accounts) |
// 'unavailable'. A failed refresh KEEPS the last good data with its time ("not updated since ..."), never zeros (spec §4).
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/supabase';

const isMissing = (error, status) => error?.code === 'PGRST202' || error?.code === '42883' || status === 404;
const isInt = (v) => Number.isInteger(v) && v >= 0;
export const ADMIN_STATUS_KEYS = Object.freeze(['lifetime', 'paid_annual', 'paid_monthly', 'paid_unverified', 'free10', 'trial', 'trial_ended', 'free10_inactive']);

export function parseDashboardSummary(d) {
  if (!d || d.schema !== 'admin-dashboard-summary/v1') return null;
  if (![d.managedAccounts, d.registrationsLast24h, d.signedInLast10m].every(isInt)) return null;
  const market = d.market || {};
  if (!['Local', 'International', 'Unknown'].every((k) => isInt(market[k]))) return null;
  const status = d.subscriptionStatus || {};
  if (!ADMIN_STATUS_KEYS.every((k) => isInt(status[k]))) return null;
  return Object.freeze({
    generatedAt: d.generatedAt || null, managedAccounts: d.managedAccounts, registrationsLast24h: d.registrationsLast24h,
    signedInLast10m: d.signedInLast10m, market: Object.freeze({ ...market }), subscriptionStatus: Object.freeze({ ...status }),
    planSystem: d.planSystem === 'active' ? 'active' : 'not_active',
  });
}

export function parseAccountsPage(d) {
  if (!d || d.schema !== 'admin-accounts/v1' || !isInt(d.total) || !Array.isArray(d.rows)) return null;
  return Object.freeze({ generatedAt: d.generatedAt || null, total: d.total, offset: d.offset || 0, pageSize: d.pageSize || 25, rows: d.rows });
}

export async function fetchAdminDashboardSummary(client = supabase) {
  try {
    const { data, error, status } = await client.rpc('get_admin_dashboard_summary');
    if (error) return isMissing(error, status) ? { state: 'not_deployed' } : { state: 'unavailable', code: String(error.code || 'rpc_error') };
    const parsed = parseDashboardSummary(data);
    return parsed ? { state: 'ready', data: parsed } : { state: 'unavailable', code: 'invalid' };
  } catch {
    return { state: 'unavailable', code: 'network' };
  }
}

export async function fetchAdminAccountsPage(client = supabase, { query = '', market = null, status = null, sort = 'created_at', direction = 'desc', pageSize = 25, offset = 0, ids = null } = {}) {
  try {
    const { data, error, status: http } = await client.rpc('get_admin_accounts', {
      p_query: query || null, p_market: market, p_status: status, p_sort: sort, p_direction: direction,
      p_page_size: pageSize, p_offset: offset, p_ids: ids,
    });
    if (error) return isMissing(error, http) ? { state: 'not_deployed' } : { state: 'unavailable', code: String(error.code || 'rpc_error') };
    const parsed = parseAccountsPage(data);
    return parsed ? { state: 'ready', data: parsed } : { state: 'unavailable', code: 'invalid' };
  } catch {
    return { state: 'unavailable', code: 'network' };
  }
}

// one hook for both: keeps the last good data across a failed refresh; cancels on unmount / new request
function useServerResource(fetcher, key, enabled = true) {
  const [res, setRes] = useState({ state: 'loading', data: null, updatedAt: null, failedAt: null });
  const last = useRef(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setRes((r) => ({ ...r, state: last.current ? r.state : 'loading', refreshing: true }));
    fetcher().then((out) => {
      if (cancelled) return;
      if (out.state === 'ready') {
        last.current = out.data;
        setRes({ state: 'ready', data: out.data, updatedAt: new Date().toISOString(), failedAt: null, refreshing: false });
      } else if (last.current && out.state === 'unavailable') {
        setRes((r) => ({ ...r, state: 'stale', failedAt: new Date().toISOString(), refreshing: false }));
      } else {
        setRes({ state: out.state, data: null, updatedAt: null, failedAt: out.state === 'unavailable' ? new Date().toISOString() : null, refreshing: false });
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return res;
}

export function useAdminDashboardSummary(refreshKey = 0, client = supabase) {
  return useServerResource(() => fetchAdminDashboardSummary(client), `summary:${refreshKey}`);
}

export function useAdminAccountsPage(params, refreshKey = 0, { enabled = true, client = supabase } = {}) {
  const key = `accounts:${refreshKey}:${JSON.stringify(params)}`;
  return useServerResource(() => fetchAdminAccountsPage(client, params), key, enabled);
}
