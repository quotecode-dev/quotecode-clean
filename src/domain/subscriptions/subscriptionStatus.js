// Owner console 2026-10-16: ONE subscription status per account, shown IDENTICALLY in the user's header medallion, the plans window and
// the admin (same medallion, same words) - "the icon in the user interface and the admin must be the same" (approvals naming L-03 and
// L-07), refined by the approved admin spec (docs/CODEX_SPEC_ADMIN_REDESIGN_2026-10-16.md §5, D-01 / D-02 / D-06). Pure: no fetch.
// - LIFETIME = the account's lifetime flag;
// - paid = ONLY a ready server summary with an active subscription; monthly / annual ONLY from the server's billingPeriod (the active
//   subscription's real price version - migration 20261016100000); an active subscription without a proven period is
//   "needs verification", never a default month (D-06). Never from the legacy plan field (OD-16 / OD-20);
// - 10 free quotes = a ready summary whose Free-10 is ENFORCED: the server counter consumed / 10 (D-01: server counter only);
// - trial / expired = the legacy trial date;
// - otherwise "10 free quotes - not yet active" (D-02): an account opened after the 14-day trial was retired, with no server
//   allocation yet - no counter and no claim of an active entitlement. There is no "no subscription" status.
import { FREE_QUOTES_TOTAL } from '../../../supabase/functions/_shared/subscriptionContract.ts';

export const ACCOUNT_STATUS = Object.freeze({
  lifetime: Object.freeze({ he: 'מנוי לכל החיים', en: 'Lifetime subscription' }),
  paid_annual: Object.freeze({ he: 'מנוי שנתי', en: 'Annual subscription' }),
  paid_monthly: Object.freeze({ he: 'מנוי חודשי', en: 'Monthly subscription' }),
  paid_unverified: Object.freeze({ he: 'מידע המנוי דורש אימות', en: 'Subscription needs verification' }),
  free10: Object.freeze({ he: '10 הצעות חינם', en: '10 free quotes' }),
  trial: Object.freeze({ he: 'בניסיון', en: 'Trial' }),
  trial_ended: Object.freeze({ he: 'פג תוקף', en: 'Expired' }),
  free10_inactive: Object.freeze({ he: '10 הצעות חינם — טרם הופעל', en: '10 free quotes — not yet active' }),
});
export const ACCOUNT_STATUS_ORDER = Object.freeze(['free10', 'trial', 'trial_ended', 'paid_monthly', 'paid_annual', 'lifetime', 'free10_inactive', 'paid_unverified']);
// the chart / count always lists these (monthly and annual even at 0); the other two only when an account has them
export const ACCOUNT_STATUS_ALWAYS_SHOWN = Object.freeze(['free10', 'trial', 'trial_ended', 'paid_monthly', 'paid_annual', 'lifetime']);
export const ACCOUNT_STATUS_TITLE = Object.freeze({ he: 'התפלגות מסלולים', en: 'Subscription mix' });
// the medallion of each status (HeaderPlanMedallion.jsx PLAN_MEDALLION_VISUAL - the one visual table)
export const STATUS_MEDALLION_KIND = Object.freeze({
  lifetime: 'lifetime', paid_annual: 'paid_annual', paid_monthly: 'plan', paid_unverified: 'plan', free10: 'free10',
  trial: 'trial', trial_ended: 'trial_ended', free10_inactive: 'free10',
});
// chart colours = the medallion colours (spec §6)
export const STATUS_COLOR = Object.freeze({
  free10: '#16a34a', trial: '#d97706', trial_ended: '#b91c1c', paid_monthly: '#6d28d9', paid_annual: '#3730a3', lifetime: '#c98a06',
  free10_inactive: '#86b89a', paid_unverified: '#8b7fc4',
});

// The server's billing period, read strictly from the raw summary (the shared parser drops unknown keys): 'month' | 'year' only for a
// ready, active, non-free summary; anything else is null (unknown - never a default).
export function withBillingPeriod(summary, raw) {
  if (!summary || summary.state !== 'ready') return summary;
  const v = raw && typeof raw === 'object' ? raw.billingPeriod : undefined;
  const ok = (v === 'month' || v === 'year') && summary.subscriptionStatus === 'active' && summary.planId !== 'free';
  return Object.freeze({ ...summary, billingPeriod: ok ? v : null });
}

export function accountStatus(account, summary, now = Date.now()) {
  if (account?.is_lifetime === true) return { key: 'lifetime' };
  if (summary?.state === 'ready' && summary.subscriptionStatus === 'active') {
    return { key: summary.billingPeriod === 'year' ? 'paid_annual' : summary.billingPeriod === 'month' ? 'paid_monthly' : 'paid_unverified' };
  }
  if (summary?.state === 'ready' && summary.free10 && summary.phase?.output === 'enforced') {
    const { consumed, reserved, remaining } = summary.free10;
    return { key: 'free10', consumed, reserved, remaining, total: FREE_QUOTES_TOTAL };
  }
  const t = account?.trial_ends_at ? new Date(account.trial_ends_at).getTime() : NaN;
  if (Number.isFinite(t)) return { key: t > now ? 'trial' : 'trial_ended', until: account.trial_ends_at };
  return { key: 'free10_inactive' };
}

// the server's status key (get_admin_accounts row.status) back to the same shape
export function statusFromKey(key, extra = {}) {
  return Object.prototype.hasOwnProperty.call(ACCOUNT_STATUS, key) ? { key, ...extra } : { key: 'free10_inactive' };
}

export function accountStatusBreakdown(accounts, summaryOf = () => null, now = Date.now()) {
  const counts = new Map();
  for (const a of accounts || []) { const k = accountStatus(a, summaryOf(a), now).key; counts.set(k, (counts.get(k) || 0) + 1); }
  return breakdownFromCounts(Object.fromEntries(counts));
}
// the same rows from server counts (get_admin_dashboard_summary.subscriptionStatus)
export function breakdownFromCounts(counts) {
  const c = counts || {};
  return ACCOUNT_STATUS_ORDER.filter((k) => (c[k] || 0) > 0 || ACCOUNT_STATUS_ALWAYS_SHOWN.includes(k)).map((key) => ({ key, count: c[key] || 0 }));
}

// The status words: "בניסיון עד 21/10/2026", "10 הצעות חינם · 3/10 נוצלו", or the plain status name. formatDate is the caller's
// market-aware short date formatter (IRON-DATE-001: the ACCOUNT's market); without it the trial shows no date.
export function accountStatusWords(status, isHebrew, formatDate = null) {
  const he = isHebrew === true;
  const name = he ? ACCOUNT_STATUS[status.key].he : ACCOUNT_STATUS[status.key].en;
  if (status.key === 'free10') return `${name} · ${status.consumed}/${status.total} ${he ? 'נוצלו' : 'used'}`;
  if (status.key === 'trial' && formatDate) return `${name}${he ? ' עד ' : ' until '}${formatDate(status.until)}`;
  return name;
}

// The header medallion model (HeaderPlanMedallion: kind / label / remaining / total) - the same status the admin shows. The ring of the
// 10 free quotes is the share remaining (the former header rule); its words say how many were used.
export function statusMedallionModel(account, summary, { isHebrew, formatDate = null, now = Date.now() } = {}) {
  const status = accountStatus(account, summary, now);
  return {
    kind: STATUS_MEDALLION_KIND[status.key],
    statusKey: status.key,
    label: accountStatusWords(status, isHebrew, formatDate),
    ...(status.key === 'free10' ? { remaining: status.remaining, total: status.total } : {}),
  };
}

// The plans window line ("you have ... until X") - only real facts: a date only where one exists (the trial); a paid subscription has
// no end date in the summary, so none is invented.
export function accountStatusSentence(status, isHebrew, formatDate = null) {
  const he = isHebrew === true;
  const date = status.until && formatDate ? formatDate(status.until) : null;
  switch (status.key) {
    case 'lifetime': return he ? 'יש לכם מנוי לכל החיים' : 'You have a Lifetime subscription';
    case 'paid_annual': return he ? 'יש לך מנוי שנתי פעיל' : 'You have an active annual subscription';
    case 'paid_monthly': return he ? 'יש לך מנוי חודשי פעיל' : 'You have an active monthly subscription';
    case 'paid_unverified': return he ? 'יש לך מנוי פעיל' : 'You have an active subscription';
    case 'free10': {
      const reserved = status.reserved > 0 ? (he ? ` (${status.reserved} בתהליך)` : ` (${status.reserved} in progress)`) : '';
      return he ? `ניצלתם ${status.consumed} מתוך ${status.total} הצעות חינם${reserved}` : `${status.consumed} of ${status.total} free quotes used${reserved}`;
    }
    case 'trial': return date ? (he ? `יש לך תקופת ניסיון עד ${date}` : `Your trial runs until ${date}`) : (he ? 'יש לך תקופת ניסיון' : 'You are on a trial');
    case 'trial_ended': return he ? 'תקופת הניסיון שלך הסתיימה' : 'Your trial has ended';
    default: return he ? '10 ההצעות החינמיות שלך עוד לא הופעלו, והחשבון אינו מוגבל' : 'Your 10 free quotes are not active yet, and your account is not limited';
  }
}
