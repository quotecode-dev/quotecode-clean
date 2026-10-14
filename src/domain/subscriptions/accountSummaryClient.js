// OD-20: the plan badge, balance and capability gates read ONLY the server account summary (RPC get_account_summary,
// identity = the caller's JWT; the RPC takes no argument, so nothing in the request can name an account, plan or market).
// This module fetches and classifies; parsing is the shared strict parser (fail closed on anything unexpected).
import { parseAccountSummary, planName, FREE_QUOTES_TOTAL } from '../../../supabase/functions/_shared/subscriptionContract.ts';

export const LOADING_SUMMARY = Object.freeze({ state: 'loading' });

// PostgREST answers an RPC that does not exist on this environment with PGRST202 (HTTP 404). That is a truthful
// "the subscription system is not deployed here" state, not an error of this account.
export function isMissingRpcError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const status = Number(error.status || error.statusCode || 0);
  return code === 'PGRST202' || code === '42883' || status === 404;
}

export async function fetchAccountSummary(supabase) {
  if (!supabase || typeof supabase.rpc !== 'function') return Object.freeze({ state: 'unavailable', code: 'no_client' });
  let res;
  try {
    res = await supabase.rpc('get_account_summary');
  } catch {
    return Object.freeze({ state: 'unavailable', code: 'network' });
  }
  if (res?.error) {
    return isMissingRpcError(res.error)
      ? Object.freeze({ state: 'not_deployed', code: 'rpc_missing' })
      : Object.freeze({ state: 'unavailable', code: 'rpc_error' });
  }
  return parseAccountSummary(res?.data);
}

// The one display model for every account surface (header badge, settings, plans view, help context).
// tone: 'plan' (a real server plan) | 'neutral' (system not active / loading) | 'blocked' (fail closed) | 'error'.
export function accountStatusModel(summary, lang) {
  const he = lang === 'he';
  const state = summary?.state ?? 'loading';
  if (state === 'ready') {
    const name = planName(summary.planId, lang);
    let detail = null;
    if (summary.free10) {
      const { remaining } = summary.free10;
      detail = he ? `נותרו ${remaining} מתוך ${FREE_QUOTES_TOTAL} הצעות` : `${remaining} of ${FREE_QUOTES_TOTAL} free quotes left`;
    } else if (summary.subscriptionStatus === 'past_due') {
      detail = he ? 'התשלום האחרון לא עבר' : 'Last payment failed';
    } else if (summary.subscriptionStatus === 'pending') {
      detail = he ? 'ממתין לאישור תשלום' : 'Awaiting payment confirmation';
    } else if (summary.subscriptionStatus === 'cancelled') {
      detail = he ? 'המנוי בוטל' : 'Subscription cancelled';
    } else if (summary.subscriptionStatus === 'failed') {
      detail = he ? 'התשלום לא הושלם' : 'Payment not completed';
    }
    return { state, tone: 'plan', planId: summary.planId, label: name, detail, retry: false };
  }
  if (state === 'loading') {
    return { state, tone: 'neutral', planId: null, label: he ? 'טוען מסלול…' : 'Loading plan…', detail: null, retry: false };
  }
  if (state === 'not_activated' || state === 'not_deployed') {
    return { state, tone: 'neutral', planId: null, label: he ? 'מסלולים: טרם הופעלו' : 'Plans: not active yet', detail: null, retry: false };
  }
  if (state === 'unprovisioned') {
    return { state, tone: 'blocked', planId: null, label: he ? 'החשבון טרם שויך למסלול' : 'Account not assigned to a plan', detail: null, retry: true };
  }
  return { state, tone: 'error', planId: null, label: he ? 'פרטי המסלול אינם זמינים' : 'Plan details unavailable', detail: null, retry: true };
}

// Owner console 2026-10-14: an account the Owner granted lifetime (business_settings.is_lifetime - written only by the guarded admin
// path; super admin is never lifetime, see resolveAccountEntitlement) is shown as "Lifetime subscription - no charge" on every plan
// surface and is offered no package. Display only: nothing is granted, revoked or charged here.
export function lifetimeAccountModel(lang) {
  const he = lang === 'he';
  return { state: 'lifetime', tone: 'lifetime', planId: null, label: he ? 'מנוי לכל החיים' : 'Lifetime subscription', detail: he ? 'ללא חיוב — אין צורך לרכוש מנוי.' : 'No charge — no subscription purchase needed.', retry: false };
}

// Owner 2026-10-14: the plan button of the dashboard header (in place of the former avatar circle). ONE source with Settings and the
// plans window: lifetime -> "Lifetime"; a ready summary with Free-10 ENFORCED -> the remaining balance; a ready paid plan -> its plan
// name; anything else (not active / prepared / loading / unavailable) -> "Plans". The button always opens the plans window.
export function planBadgeModel(summary, lang, { isLifetime = false } = {}) {
  const he = lang === 'he';
  const plans = { label: he ? 'מסלולים' : 'Plans', kind: 'plans' };
  if (isLifetime === true) return { label: he ? 'לכל החיים' : 'Lifetime', kind: 'lifetime' };
  if (summary?.state !== 'ready') return plans;
  if (summary.free10) {
    if (summary.phase?.output !== 'enforced') return plans;
    const { remaining } = summary.free10;
    return { label: he ? `נותרו ${remaining}/${FREE_QUOTES_TOTAL}` : `${remaining}/${FREE_QUOTES_TOTAL} left`, kind: 'free10' };
  }
  const name = planName(summary.planId, lang);
  return name ? { label: name, kind: 'plan' } : plans;
}

// Task 30: the account-state line of Settings › "My subscription" (server summary only). While Free-10 is not ENFORCED on the server
// (summary not_activated / not deployed, or a ready summary whose output phase is prepared / shadow) the ten free quotes do not limit
// the account, so no balance is shown as a limit; the enforced Free-10 balance comes from accountStatusModel unchanged.
export function subscriptionSectionState(summary, lang, { isLifetime = false } = {}) {
  if (isLifetime === true) return lifetimeAccountModel(lang);
  const he = lang === 'he';
  const base = accountStatusModel(summary, lang);
  if (base.state === 'not_activated' || base.state === 'not_deployed') {
    return { ...base, label: he ? 'מערכת המנויים עדיין לא פעילה' : 'Subscriptions are not active yet', detail: he ? 'החשבון אינו מוגבל, ולא מתבצע חיוב.' : 'Your account is not limited, and nothing is charged.' };
  }
  if (base.state === 'ready' && summary.phase?.output !== 'enforced' && summary.free10) {
    return { ...base, detail: he ? 'ספירת 10 ההצעות החינמיות עדיין לא פעילה, והחשבון אינו מוגבל.' : 'Free-10 counting is not active yet, and your account is not limited.' };
  }
  return base;
}
