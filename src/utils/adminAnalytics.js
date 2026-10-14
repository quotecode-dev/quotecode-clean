// Pure, presentation-free data-shaping functions for the Admin overview/
// header KPIs. Every function here reads ONLY real, already-loaded
// `accounts` rows (business_settings) and the ONE canonical entitlement
// resolver (`resolveAccountEntitlement`) - never a second/independent
// entitlement model, never fabricated categories or counts. Kept pure (no
// React, no DOM) so each is directly unit-testable without mounting any
// component. Ported from the reference Admin implementation (tkrc2) as part
// of TEKANGO Admin V1 - Task 1/2 (shared dark shell + truthful dashboard).
import { resolveAccountEntitlement } from './accountEntitlement';
import { resolveAdminMarket } from './adminMarket';

function realAccounts(accounts) {
  return (accounts || []).filter(
    (a) => a && a.role !== 'super_admin' && !(a.email || '').toLowerCase().startsWith('deleted_') && (a.business_name || '').toLowerCase() !== 'deleted'
  );
}

// Plan distribution (FREE/FREE_TRIAL/BASIC/PRO/LIFETIME) - the same
// canonical `displayIdentity` the Users directory/details view already use.
export function getPlanDistribution(accounts) {
  const users = realAccounts(accounts);
  const order = ['FREE', 'FREE_TRIAL', 'BASIC', 'PRO', 'LIFETIME'];
  const counts = Object.fromEntries(order.map((id) => [id, 0]));
  for (const account of users) {
    const { displayIdentity } = resolveAccountEntitlement({ plan: account.plan, trialEndsAt: account.trial_ends_at, role: account.role, isLifetime: account.is_lifetime });
    counts[displayIdentity] = (counts[displayIdentity] || 0) + 1;
  }
  return order.map((id) => ({ id, count: counts[id] })).filter((row) => row.count > 0);
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

// Trial/account-state distribution - the canonical resolver's own 4-value
// `trialStatus` vocabulary (active/expiringSoon/expired/none) exactly.
export function getTrialStateDistribution(accounts) {
  const users = realAccounts(accounts);
  const order = ['active', 'expiringSoon', 'expired', 'none'];
  const counts = Object.fromEntries(order.map((id) => [id, 0]));
  for (const account of users) {
    const { trialStatus } = resolveAccountEntitlement({ plan: account.plan, trialEndsAt: account.trial_ends_at, role: account.role, isLifetime: account.is_lifetime });
    counts[trialStatus] = (counts[trialStatus] || 0) + 1;
  }
  return order.map((id) => ({ id, count: counts[id] })).filter((row) => row.count > 0);
}

// Canonical plan sort rank: FREE < FREE_TRIAL < BASIC < PRO < LIFETIME.
export const PLAN_SORT_RANK = { FREE: 0, FREE_TRIAL: 1, BASIC: 2, PRO: 3, LIFETIME: 4 };

export function getPlanSortRank(account) {
  const { displayIdentity } = resolveAccountEntitlement({ plan: account?.plan, trialEndsAt: account?.trial_ends_at, role: account?.role, isLifetime: account?.isLifetime ?? account?.is_lifetime });
  return PLAN_SORT_RANK[displayIdentity] ?? -1;
}

// Admin V1 (Task 2) KPI summary for the shared Header's Admin context slot
// and AdminOverview. No "active now"/online inference anywhere here - the
// Owner's binding V1 rule explicitly forbids last-sign-in-recency signals;
// this only ever counts real, structural facts (row existence, created_at,
// trialStatus from the one canonical resolver).
export function getAdminKpiSummary(accounts, now = new Date()) {
  const users = realAccounts(accounts);
  const nowMs = now.getTime();
  const dayMs = 86400000;
  let activeTrials = 0;
  let expiringSoon = 0;
  let registrationsLast24h = 0;
  for (const account of users) {
    const { trialStatus } = resolveAccountEntitlement({ plan: account.plan, trialEndsAt: account.trial_ends_at, role: account.role, isLifetime: account.is_lifetime });
    if (trialStatus === 'active' || trialStatus === 'expiringSoon') activeTrials += 1;
    if (trialStatus === 'expiringSoon') expiringSoon += 1;
    if (account.created_at) {
      const age = nowMs - new Date(account.created_at).getTime();
      if (age >= 0 && age < dayMs) registrationsLast24h += 1;
    }
  }
  return {
    managedBusinesses: users.length,
    activeTrials,
    expiringSoon,
    registrationsLast24h,
  };
}
