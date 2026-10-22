// IRON-DATE-001 in the admin. ADMIN AMENDMENT (Owner console 2026-10-22, typed: "מאשר תיקון לחוק ברזל התאריכים: במסכי הניהול כל
// התאריכים מוצגים בפורמט הישראלי, יום/חודש/שנה בשעון ישראל, לכל חשבון; בכל מה שהמשתמש עצמו רואה (המערכת, דף ההצעה, ההדפסה והמיילים)
// התאריך נשאר לפי השוק של החשבון"; L-22 opened for it: "תאריכים בפורמט ישראלי בכל מסכי הניהול"): every date in the admin screens -
// of every account, in Hebrew and in English - is DD/MM/YYYY in Israel time (the 'Local' short-date formatter). What the user sees
// (the app, the public quote, print and emails) still follows the account market; nothing here is used outside the admin.
// (Before 2026-10-22: the account's own market decided the admin format - admin spec §9.)
import { formatShortDate, formatShortDateTime } from './shortDate';

export const ADMIN_DATE_MARKET = 'Local';

/** The market the admin formats an account's dates with - always Israel (the amendment), whatever the account or interface. */
export function accountDateMarket() {
  return ADMIN_DATE_MARKET;
}

const valid = (v) => v && Number.isFinite(new Date(v).getTime());

export function accountDate(value) {
  return valid(value) ? formatShortDate(value, ADMIN_DATE_MARKET) : '—';
}

export function accountDateTime(value) {
  return valid(value) ? formatShortDateTime(value, ADMIN_DATE_MARKET) : '—';
}
