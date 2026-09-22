// IRON-DATE-001: the app's short-date primitive IS the shared Edge-Function module (one implementation, same bytes for Vite + Deno).
export { SHORT_DATE_TIME_ZONE, resolveDateMarket, calendarParts, formatShortDate, formatShortDateTime, deviceCalendarDate, formatDeviceShortDateTime } from '../../supabase/functions/_shared/shortDate.js';
