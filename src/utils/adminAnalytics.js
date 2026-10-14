// Pure, presentation-free data-shaping functions for the Admin overview/
// header KPIs. Every function here reads ONLY real, already-loaded
// `accounts` rows (business_settings) - never an entitlement model of its own,
// never fabricated categories or counts. The new-model plan state is NOT computed
// here (OD-20: it comes only from the admin summary RPC). Kept pure (no
// React, no DOM) so each is directly unit-testable without mounting any
// component. Ported from the reference Admin implementation (tkrc2) as part
// of TEKANGO Admin V1 - Task 1/2 (shared dark shell + truthful dashboard).
import { resolveAdminMarket } from './adminMarket';

function realAccounts(accounts) {
  return (accounts || []).filter(
    (a) => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted'
  );
}

// LEGACY RECORD (HISTORY) breakdown - OD-16/OD-20. The legacy business_settings fields (plan / trial_ends_at /
// is_lifetime) are audit history only: this counts their RAW technical values (lowercase keys, as stored) and is always
// presented under the "Legacy record (history)" label. It never maps them to a plan name (no Basic/Pro/trial/LIFETIME
// identity) and never derives a new-model plan - the new plan state comes only from the admin summary RPC.
export const LEGACY_HISTORY_LABEL = Object.freeze({ he: 'רשומת מורשת (היסטוריה)', en: 'Legacy record (history)' });

const rawPlan = (value) => (typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : 'null');

export function getLegacyRecordBreakdown(accounts, now = new Date()) {
  const users = realAccounts(accounts);
  const nowMs = now.getTime();
  const counts = new Map();
  const bump = (key) => counts.set(key, (counts.get(key) || 0) + 1);
  for (const account of users) {
    bump(`plan=${rawPlan(account.plan)}`);
    bump(`is_lifetime=${account.is_lifetime === true ? 'true' : account.is_lifetime === false ? 'false' : 'null'}`);
    const t = account.trial_ends_at ? new Date(account.trial_ends_at).getTime() : NaN;
    bump(!account.trial_ends_at ? 'trial_ends_at=null' : !Number.isFinite(t) ? 'trial_ends_at=invalid' : t > nowMs ? 'trial_ends_at>now' : 'trial_ends_at<=now');
  }
  const order = (key) => (key.startsWith('plan=') ? 0 : key.startsWith('is_lifetime=') ? 1 : 2);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => order(a.key) - order(b.key) || a.key.localeCompare(b.key));
}

// Registrations over the last N real days - honest zero-count days
// included (never invented as activity).
export function getRegistrationsTrend(accounts, days = 30, now = new Date()) {
  const users = realAccounts(accounts);
  const nowMs = now.getTime();
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(nowMs - (days - 1 - i) * 86400000);
    return { key: d.toDateString(), date: d, count: 0 };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const account of users) {
    if (!account.created_at) continue;
    const key = new Date(account.created_at).toDateString();
    const bucket = byKey.get(key);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

// Local vs International - the same real `country` field the region
// badge/filter/sort already use elsewhere in Admin.
export function getMarketDistribution(accounts) {
  const users = realAccounts(accounts);
  let local = 0;
  let international = 0;
  for (const account of users) {
    const market = resolveAdminMarket(account).market;
    if (market === 'International') international += 1;
    else if (market === 'Local') local += 1;
  }
  return [
    { id: 'Local', count: local },
    { id: 'International', count: international },
  ].filter((row) => row.count > 0);
}

// Admin V1 (Task 2) KPI summary for the shared Header's Admin context slot
// and AdminOverview. No "active now"/online inference anywhere here - the
// Owner's binding V1 rule explicitly forbids last-sign-in-recency signals;
// this only ever counts real, structural facts (row existence, created_at).
// OD-16/OD-20: no trial/plan KPI is derived from the legacy fields any more.
export function getAdminKpiSummary(accounts, now = new Date()) {
  const users = realAccounts(accounts);
  const nowMs = now.getTime();
  const dayMs = 86400000;
  let registrationsLast24h = 0;
  for (const account of users) {
    if (account.created_at) {
      const age = nowMs - new Date(account.created_at).getTime();
      if (age >= 0 && age < dayMs) registrationsLast24h += 1;
    }
  }
  return {
    managedBusinesses: users.length,
    registrationsLast24h,
  };
}
