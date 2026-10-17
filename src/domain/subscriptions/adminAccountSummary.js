// Admin subscription state - read model and wording (OD-16 / OD-20, CROSSCUT_CONTRACT §2.1). Components: src/components/AdminSubscriptionState.jsx.
//
// The ONLY place the Admin surfaces read an account's plan state. The new-model state comes exclusively from the server
// RPC get_account_summary_for_admin(p_user_id) parsed by the shared strict parser (parseAccountSummary) - never computed
// from the legacy business_settings fields. The legacy fields (plan / trial_ends_at / is_lifetime) stay visible ONLY as a
// clearly labelled audit section with the raw technical values (lowercase keys, monospace) - no badge, no marketing name.
//
// States shown:
//   ready            -> canonical plan name (planName), Free-10 balance, subscription status
//   not_deployed     -> RPC missing (PGRST202 / 404)            -> "Plan system not active yet"
//   not_activated    -> free_issue phase not active              -> "Plan system not active yet"
//   unprovisioned    -> account_not_provisioned                  -> "Not assigned to a plan yet"
//   unavailable / invalid                                        -> "Plan state unavailable right now"
import { useEffect, useState } from 'react';
import { supabase } from '../../shared/supabase';
import { parseAccountSummary, planName, outputPhaseOf } from '../../../supabase/functions/_shared/subscriptionContract.ts';
import { withBillingPeriod } from './subscriptionStatus';

export const COPY = {
  notActive: { he: 'מערך המסלולים טרם הופעל', en: 'Plan system not active yet' },
  unassigned: { he: 'החשבון טרם שויך למסלול', en: 'Not assigned to a plan yet' },
  unavailable: { he: 'מצב המסלול אינו זמין כרגע', en: 'Plan state unavailable right now' },
  loading: { he: 'טוען מצב מסלול...', en: 'Loading plan state...' },
  systemNotActive: { he: 'מערך המסלולים החדש: טרם הופעל', en: 'New plan system: not active yet' },
  systemActive: { he: 'מערך המסלולים החדש: פעיל', en: 'New plan system: active' },
  systemUnknown: { he: 'מערך המסלולים החדש: המצב אינו זמין כרגע', en: 'New plan system: state unavailable right now' },
  systemLoading: { he: 'בודק את מצב מערך המסלולים...', en: 'Checking the plan system state...' },
  legacyTitle: { he: 'רשומת מורשת (היסטוריה)', en: 'Legacy record (history)' },
  legacyHint: { he: 'ערכים טכניים גולמיים לביקורת בלבד. אינם קובעים מסלול, יתרה או זכאות.', en: 'Raw technical values for audit only. They never decide a plan, balance or entitlement.' },
};
const STATUS = {
  none: { he: 'ללא מנוי', en: 'No subscription' },
  pending: { he: 'מנוי ממתין', en: 'Subscription pending' },
  active: { he: 'מנוי פעיל', en: 'Subscription active' },
  past_due: { he: 'תשלום באיחור', en: 'Payment past due' },
  failed: { he: 'תשלום נכשל', en: 'Payment failed' },
  cancelled: { he: 'מנוי בוטל', en: 'Subscription cancelled' },
};
export const tr = (entry, isHebrew) => (isHebrew ? entry.he : entry.en);

// The auth user id of an Admin account row (business_settings.user_id); the row id is only a fallback.
export const adminTargetUserId = (account) => account?.user_id || account?.id || null;

function normalizeLegacy(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return {
    plan: typeof raw.plan === 'string' ? raw.plan : null,
    trialEndsAt: typeof raw.trialEndsAt === 'string' ? raw.trialEndsAt : null,
    isLifetime: typeof raw.isLifetime === 'boolean' ? raw.isLifetime : null,
  };
}

// Read-only. Returns { summary, legacy }; never throws. The `legacy` key is audit history only and is stripped BEFORE
// parsing, so it can never feed the new-model state.
export async function fetchAdminAccountSummary(client, userId) {
  if (!userId) return { summary: { state: 'unavailable', code: 'no_user_id' }, legacy: null };
  try {
    const res = await client.rpc('get_account_summary_for_admin', { p_user_id: userId });
    const { data, error, status } = res || {};
    if (error) {
      if (error.code === 'PGRST202' || status === 404) return { summary: { state: 'not_deployed', code: 'not_deployed' }, legacy: null };
      return { summary: { state: 'unavailable', code: String(error.code || 'rpc_error') }, legacy: null };
    }
    let payload = data;
    let legacy = null;
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && Object.prototype.hasOwnProperty.call(payload, 'legacy')) {
      const { legacy: rawLegacy, ...rest } = payload;
      legacy = normalizeLegacy(rawLegacy);
      payload = rest;
    }
    return { summary: withBillingPeriod(parseAccountSummary(payload), payload), legacy };
  } catch {
    return { summary: { state: 'unavailable', code: 'network_error' }, legacy: null };
  }
}

// 'loading' | 'not_active' | 'active' | 'unknown' - whether the new plan system answers for accounts at all.
export function planSystemStateOf(summary) {
  const state = summary?.state;
  if (state === 'loading' || !state) return 'loading';
  if (state === 'not_deployed' || state === 'not_activated') return 'not_active';
  if (state === 'ready' || state === 'unprovisioned') return 'active';
  return 'unknown';
}

// Legacy operations (trial extension / is_lifetime) retire once the free_issue (output) phase is enforced.
export function legacyOperationsRetired(summary) {
  return outputPhaseOf(summary) === 'enforced';
}

export function useAdminAccountSummary(userId, client = supabase) {
  const [result, setResult] = useState({ summary: { state: 'loading' }, legacy: null });
  useEffect(() => {
    let cancelled = false;
    setResult({ summary: { state: 'loading' }, legacy: null });
    fetchAdminAccountSummary(client, userId).then((r) => { if (!cancelled) setResult(r); });
    return () => { cancelled = true; };
  }, [userId, client]);
  return result;
}

// List variant: probes the first account; when the plan system is not active (a global state) no further call is made.
export function useAdminAccountSummaries(userIds, client = supabase) {
  const key = (userIds || []).filter(Boolean).join('|');
  const [result, setResult] = useState({ system: 'loading', byId: {} });
  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split('|') : [];
    if (!ids.length) { setResult({ system: 'unknown', byId: {} }); return () => { cancelled = true; }; }
    setResult({ system: 'loading', byId: {} });
    (async () => {
      const first = await fetchAdminAccountSummary(client, ids[0]);
      if (cancelled) return;
      const system = planSystemStateOf(first.summary);
      if (system === 'not_active') { setResult({ system, byId: { [ids[0]]: first.summary } }); return; }
      const rest = await Promise.all(ids.slice(1).map((id) => fetchAdminAccountSummary(client, id)));
      if (cancelled) return;
      const byId = { [ids[0]]: first.summary };
      ids.slice(1).forEach((id, i) => { byId[id] = rest[i].summary; });
      setResult({ system, byId });
    })();
    return () => { cancelled = true; };
  }, [key, client]);
  return result;
}

// Owner console 2026-10-14 (Codex spec A7 / A8, approved): human indicator tags per account, each on its own axis - lifetime
// (business_settings.is_lifetime, shown even while the new plan system is not active), the legacy trial (history wording, never a new
// trial), and - only from a READY server summary - Free-10, the paid subscription state and the plan-system assignment. A missing or
// unknown value yields no tag (never "free"). formatDate is the caller's market-aware short date formatter.
export function accountIndicators(account, summary, { isHebrew, formatDate, now = Date.now() } = {}) {
  const he = isHebrew === true;
  const out = [];
  if (account?.is_lifetime === true) out.push({ key: 'lifetime', tone: 'lifetime', text: he ? 'לכל החיים' : 'Lifetime' });
  const trialAt = account?.trial_ends_at ? new Date(account.trial_ends_at).getTime() : NaN;
  if (account?.is_lifetime !== true && Number.isFinite(trialAt)) {
    const date = formatDate ? formatDate(account.trial_ends_at) : '';
    out.push(trialAt > now
      ? { key: 'legacy_trial', tone: 'muted', text: (he ? 'ניסיון ישן עד ' : 'Legacy trial until ') + date }
      : { key: 'legacy_trial_ended', tone: 'muted', text: he ? 'ניסיון ישן הסתיים' : 'Legacy trial ended' });
  }
  const state = summary?.state;
  if (state === 'ready') {
    out.push({ key: 'provisioned', tone: 'ok', text: he ? 'שויך למערכת המסלולים' : 'Provisioned' });
    if (summary.free10) {
      const enforced = outputPhaseOf(summary) === 'enforced';
      const left = summary.free10.remaining + '/' + summary.free10.limit;
      out.push({ key: 'free10', tone: enforced ? 'ok' : 'muted', text: enforced ? (he ? 'Free-10: נותרו ' + left : 'Free-10: ' + left + ' left') : (he ? 'Free-10: מוכן, לא נאכף' : 'Free-10: prepared, not enforced') });
    }
    const sub = subscriptionStatusLabel(summary.subscriptionStatus, isHebrew);
    if (sub) out.push({ key: 'subscription', tone: summary.subscriptionStatus === 'active' ? 'ok' : 'muted', text: sub });
  } else if (state === 'unprovisioned') {
    out.push({ key: 'unprovisioned', tone: 'warn', text: he ? 'טרם שויך למערכת המסלולים' : 'Not provisioned' });
  }
  return out;
}

// The status filter of the users list (Owner A8): lifetime / legacy trial active / legacy trial ended / none of these.
export function matchesStatusFilter(account, filter, now = Date.now()) {
  if (!filter || filter === 'all') return true;
  const lifetime = account?.is_lifetime === true;
  const t = account?.trial_ends_at ? new Date(account.trial_ends_at).getTime() : NaN;
  if (filter === 'lifetime') return lifetime;
  if (filter === 'trial_active') return !lifetime && Number.isFinite(t) && t > now;
  if (filter === 'trial_ended') return !lifetime && Number.isFinite(t) && t <= now;
  if (filter === 'none') return !lifetime && !Number.isFinite(t);
  return true;
}

// Codex verification AV-12 / the Owner (2026-10-16 "מה זה ללא מנוי?"): 'none' has no words - there is no "no subscription" status
export function subscriptionStatusLabel(status, isHebrew) {
  return status !== 'none' && STATUS[status] ? tr(STATUS[status], isHebrew) : null;
}

export function free10Label(free10, isHebrew) {
  if (!free10) return null;
  return isHebrew ? `נותרו ${free10.remaining} מתוך ${free10.limit}` : `${free10.remaining} of ${free10.limit} remaining`;
}

// One line of text for any summary state (never a legacy-derived plan).
export function planStateText(summary, isHebrew) {
  const state = summary?.state || 'loading';
  if (state === 'ready') {
    const name = planName(summary.planId, isHebrew ? 'he' : 'en');
    return [name, free10Label(summary.free10, isHebrew), subscriptionStatusLabel(summary.subscriptionStatus, isHebrew)].filter(Boolean).join(' · ');
  }
  if (state === 'loading') return tr(COPY.loading, isHebrew);
  if (state === 'not_deployed' || state === 'not_activated') return tr(COPY.notActive, isHebrew);
  if (state === 'unprovisioned') return tr(COPY.unassigned, isHebrew);
  return tr(COPY.unavailable, isHebrew);
}

const rawValue = (value) => (value === null || value === undefined ? 'null' : String(value));

// The legacy values, raw: plan lowercased (technical id), trial_ends_at as stored, is_lifetime as a boolean literal.
// Owner console 2026-10-16: the subscription status (LIFETIME / monthly / annual / Free-10 / trial / trial ended / none) is ONE source
// with the user's header medallion and the plans window - subscriptionStatus.js.
export { ACCOUNT_STATUS, ACCOUNT_STATUS_ORDER, ACCOUNT_STATUS_ALWAYS_SHOWN, ACCOUNT_STATUS_TITLE, STATUS_MEDALLION_KIND, STATUS_COLOR, accountStatus, accountStatusBreakdown, breakdownFromCounts, statusFromKey, accountStatusWords } from './subscriptionStatus';

export function legacyRecordEntries(account, legacy) {
  const plan = legacy ? legacy.plan : account?.plan;
  const trialEndsAt = legacy ? legacy.trialEndsAt : account?.trial_ends_at;
  const isLifetime = legacy ? legacy.isLifetime : account?.is_lifetime;
  return [
    ['plan', typeof plan === 'string' ? plan.toLowerCase() : rawValue(plan)],
    ['trial_ends_at', rawValue(trialEndsAt)],
    ['is_lifetime', typeof isLifetime === 'boolean' ? String(isLifetime) : rawValue(isLifetime)],
  ];
}
