// Task 27 (P2, spec §6) - the ONE data path of a quote's OPTIONAL work / delivery / event date (public.quote_service_schedule,
// migration 20261011110000). It is separate from valid_until (acceptance validity) and is saved AFTER the quote itself, so a failure here
// never blocks or undoes the quote save - the caller shows an explicit notice instead. Owner-only (RLS forced; the explicit user_id filter
// is defence in depth). Results never throw: { ok: true, ... } | { ok: false, error: { code, message } }; code 'unavailable' means this
// server does not have the table yet (the migration is not applied), which the UI states truthfully.
import { isCalendarDate, shortTime } from './manualTasks';

export const SERVICE_SCHEDULE_COLUMNS = 'quote_id, user_id, service_date, service_time';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const fail = (code, message = '') => ({ ok: false, error: { code, message: String(message || '').slice(0, 300) } });
export function classifyServiceScheduleError(error) {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`;
  if (/relation .* does not exist|Could not find the table|schema cache|PGRST205|42P01|PGRST204/i.test(text)) return 'unavailable';
  if (/TK_SCHEDULE_FOREIGN_QUOTE|row-level security|permission denied|42501|JWT|not authorized/i.test(text)) return 'not_allowed';
  if (/check constraint|quote_service_schedule_/i.test(text)) return 'invalid';
  if (/fetch|network|timeout/i.test(text)) return 'network';
  return 'unknown';
}
const fromError = (error) => fail(classifyServiceScheduleError(error), error?.message);
const usable = (client, userId) => client && typeof client.from === 'function' && typeof userId === 'string' && userId;

// The form value { date: 'YYYY-MM-DD' | '', time: 'HH:MM' | '' } -> { ok, value: { date, time } | null (= no work date) }.
export function normalizeServiceSchedule(v) {
  const date = String(v?.date ?? '').trim();
  const time = String(v?.time ?? '').trim();
  if (!date && !time) return { ok: true, value: null };
  if (!date) return { ok: false, error: 'time_without_date' };
  if (!isCalendarDate(date) || date < '2000-01-01' || date > '2100-12-31') return { ok: false, error: 'invalid_date' };
  if (time && !TIME_RE.test(time)) return { ok: false, error: 'invalid_time' };
  return { ok: true, value: { date, time: time || '' } };
}
const rowToValue = (row) => (row ? { date: String(row.service_date || '').slice(0, 10), time: shortTime(row.service_time) || '' } : { date: '', time: '' });
export const sameServiceSchedule = (a, b) => String(a?.date || '') === String(b?.date || '') && String(a?.time || '') === String(b?.time || '');

export async function loadServiceSchedule(client, userId, quoteId) {
  if (!usable(client, userId) || !quoteId) return fail('not_signed_in');
  try {
    const { data, error } = await client.from('quote_service_schedule').select(SERVICE_SCHEDULE_COLUMNS).eq('quote_id', quoteId).eq('user_id', userId).maybeSingle();
    if (error) return fromError(error);
    return { ok: true, value: rowToValue(data) };
  } catch (e) { return fail('network', e?.message); }
}

// Does this server have the feature? (a new quote has no row to load; one cheap owner-scoped read, at most once per session)
export async function probeServiceSchedule(client, userId) {
  if (!usable(client, userId)) return fail('not_signed_in');
  try {
    const { error } = await client.from('quote_service_schedule').select('quote_id').eq('user_id', userId).limit(1);
    if (error) return fromError(error);
    return { ok: true };
  } catch (e) { return fail('network', e?.message); }
}

export async function listServiceSchedules(client, userId) {
  if (!usable(client, userId)) return fail('not_signed_in');
  try {
    const { data, error } = await client.from('quote_service_schedule').select(SERVICE_SCHEDULE_COLUMNS).eq('user_id', userId);
    if (error) return fromError(error);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch (e) { return fail('network', e?.message); }
}

// Writes only when the value differs from what the server last returned (`previous`): empty -> delete the row, otherwise upsert it.
// Returns { ok: true, action: 'unchanged' | 'saved' | 'cleared' } after the database confirmed it.
export async function saveServiceSchedule(client, userId, quoteId, value, previous = { date: '', time: '' }) {
  if (!usable(client, userId) || !quoteId) return fail('not_signed_in');
  const n = normalizeServiceSchedule(value);
  if (!n.ok) return fail('invalid', n.error);
  const next = n.value || { date: '', time: '' };
  if (sameServiceSchedule(next, previous)) return { ok: true, action: 'unchanged', value: next };
  try {
    if (!n.value) {
      const { error } = await client.from('quote_service_schedule').delete().eq('quote_id', quoteId).eq('user_id', userId);
      if (error) return fromError(error);
      return { ok: true, action: 'cleared', value: next };
    }
    const { data, error } = await client.from('quote_service_schedule')
      .upsert({ quote_id: quoteId, user_id: userId, service_date: n.value.date, service_time: n.value.time || null }, { onConflict: 'quote_id' })
      .select(SERVICE_SCHEDULE_COLUMNS).single();
    if (error) return fromError(error);
    if (!data || data.quote_id !== quoteId) return fail('unknown', 'no persisted row returned');
    return { ok: true, action: 'saved', value: rowToValue(data) };
  } catch (e) { return fail('network', e?.message); }
}
