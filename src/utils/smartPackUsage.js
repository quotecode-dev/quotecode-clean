// Owner console 2026-11-06 (typed: "מאשר את משימת הלילה בסדר הזה: שחרור א׳, מונה השימוש של חכם פלוס (4 ₪ = 100%, שער 3.5 ₪ לדולר, לפי
// התשובות שנתתי) ... כולל שינוי ב-L-01, L-05, L-06, L-09, L-11, L-12, L-14, L-17, L-22"): the SMART PACK usage meter, the browser side.
// Every SMART PACK window shows the same line from the same server number (public.smart_pack_usage_status(), the caller's own JWT):
// "נשארו לכם 63% משימוש חכם פלוס החודש". At 0% the expensive actions stop until the next month (the server refuses them:
// budget_exhausted); a plain chat question goes on. The super admin is never limited (no line). Numbers only - never a cost.

/** the caller's own meter: { percentLeft, unlimited } or null (unknown / not SMART PACK). Never throws. */
export async function fetchSmartPackUsage(supabase) {
  try {
    const { data, error } = await supabase.rpc('smart_pack_usage_status');
    if (error || !data || data.ok !== true || data.smartPack !== true) return null;
    const p = data.percentLeft;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p > 100) return null;
    return { percentLeft: p, unlimited: data.unlimited === true };
  } catch {
    return null;
  }
}

export const SMART_PACK_USED_UP = Object.freeze({
  he: 'ניצלתם את השימוש בחכם פלוס לחודש הזה. הוא מתחדש בתחילת החודש הבא.',
  en: "You have used this month's SMART PACK usage. It renews at the start of next month.",
});

/** the one line every SMART PACK window shows (null = show nothing: unknown, or the unlimited super admin) */
export function smartPackUsageText(usage, isHebrew) {
  if (!usage || usage.unlimited === true || !Number.isInteger(usage.percentLeft)) return null;
  if (usage.percentLeft <= 0) return isHebrew ? SMART_PACK_USED_UP.he : SMART_PACK_USED_UP.en;
  return isHebrew ? `נשארו לכם ${usage.percentLeft}% משימוש חכם פלוס החודש` : `${usage.percentLeft}% of your SMART PACK usage left this month`;
}

// an action is refused when what is left this month is less than the action's maximum cost (it may be more than 0%)
export const SMART_PACK_NOT_ENOUGH = Object.freeze({
  he: 'היתרה בחכם פלוס לחודש הזה לא מספיקה לפעולה הזו. היא מתחדשת בתחילת החודש הבא.',
  en: 'Your SMART PACK usage left this month is not enough for this action. It renews at the start of next month.',
});

/** the error line of an action the server refused (budget_exhausted): not enough left this month for THIS action */
export function smartPackUsedUpText(isHebrew, manualHint = true) {
  const base = isHebrew ? SMART_PACK_NOT_ENOUGH.he : SMART_PACK_NOT_ENOUGH.en;
  if (!manualHint) return base;
  return isHebrew ? `${base} בינתיים אפשר להמשיך ידנית.` : `${base} Meanwhile you can continue manually.`;
}
