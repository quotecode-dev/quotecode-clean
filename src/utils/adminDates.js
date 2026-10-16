// IRON-DATE-001 in the admin (Owner 2026-10-16, admin spec §9): every date of an account is formatted by THAT ACCOUNT's market
// (resolveAdminMarket on its stored country), never by the admin's interface language. Local = DD/MM/YYYY (Asia/Jerusalem),
// International = MM/DD/YYYY (UTC) - the canonical shortDate formatters do the formatting. An Unknown market keeps the admin's own
// market (the event has no account market to follow), as the spec's rule for events without a target account.
import { formatShortDate, formatShortDateTime } from './shortDate';
import { resolveAdminMarket } from './adminMarket';

export function accountDateMarket(account, adminMarket = 'Local') {
  const m = resolveAdminMarket(account).market;
  return m === 'Unknown' ? adminMarket : m;
}

const valid = (v) => v && Number.isFinite(new Date(v).getTime());

export function accountDate(value, account, adminMarket = 'Local') {
  return valid(value) ? formatShortDate(value, accountDateMarket(account, adminMarket)) : '—';
}

export function accountDateTime(value, account, adminMarket = 'Local') {
  return valid(value) ? formatShortDateTime(value, accountDateMarket(account, adminMarket)) : '—';
}
