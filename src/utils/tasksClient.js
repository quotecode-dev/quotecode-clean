// Task 18 - the ONE data path of the Tasks screen (Supabase public.tasks). Every call is scoped to the authenticated owner (RLS forced
// in the database; the explicit user_id filter is defence in depth), and every write returns the row Supabase actually persisted
// (`.select().single()`), so the UI shows success ONLY after the database confirmed it - never optimistically.
// Results: { ok: true, data } | { ok: false, error: { code, message } } (never throws).
import { normalizeTaskInput } from './manualTasks';

export const TASK_COLUMNS = 'id, user_id, title, notes, status, priority, due_date, due_time, quote_id, client_id, created_at, updated_at, completed_at';
// Task 28: + kind ('task' | 'follow_up', migration 20261011120000). A server without that migration has no kind column: the list then falls
// back to TASK_COLUMNS (rows without kind); creating a FOLLOW-UP there is refused as follow_up_unavailable (see createFollowUpTask).
export const TASK_COLUMNS_WITH_KIND = `${TASK_COLUMNS}, kind`;
const isMissingKindColumn = (error) => /kind/.test(String(error?.message || '')) && /42703|PGRST204|does not exist|Could not find/i.test(`${error?.code || ''} ${error?.message || ''}`);
const isMissingFollowUpRpc = (error) => /PGRST202|42883|Could not find the function|create_follow_up_task/i.test(`${error?.code || ''} ${error?.message || ''}`) && !/TK_|tasks_/.test(String(error?.message || ''));
// The columns the client may write. user_id comes only from the authenticated session; status / timestamps only through the actions.
const WRITABLE = Object.freeze(['title', 'notes', 'priority', 'due_date', 'due_time', 'quote_id', 'client_id']);

const fail = (code, message = '') => ({ ok: false, error: { code, message: String(message || '').slice(0, 300) } });
const guard = (client, userId) => (client && typeof client.from === 'function' && typeof userId === 'string' && userId ? null : fail('not_signed_in'));
// Database refusals mapped to stable codes the UI can explain (never raw SQL in the UI).
export function classifyTaskError(error) {
  const msg = String(error?.message || '');
  if (/TK_TASK_LINK_NOT_ALLOWED/.test(msg)) return 'link_not_allowed';
  if (/tasks_one_open_follow_up|TK_FOLLOW_UP_REQUEST_MISMATCH/.test(msg)) return 'follow_up_exists';
  if (/tasks_title_check|tasks_notes_check|tasks_priority_check|tasks_status_check|tasks_due_time_requires_date|check constraint/i.test(msg)) return 'invalid';
  if (/relation .*tasks.* does not exist|Could not find the table|schema cache|PGRST205|42P01/i.test(`${msg} ${error?.code || ''}`)) return 'unavailable';
  if (/row-level security|permission denied|42501|JWT|not authorized/i.test(`${msg} ${error?.code || ''}`)) return 'not_allowed';
  if (/fetch|network|Failed to fetch|timeout/i.test(msg)) return 'network';
  return 'unknown';
}
const fromError = (error) => fail(classifyTaskError(error), error?.message);
const pickWritable = (v) => Object.fromEntries(WRITABLE.map((k) => [k, v[k] ?? null]));

export async function listTasks(client, userId) {
  const g = guard(client, userId); if (g) return g;
  try {
    let { data, error } = await client.from('tasks').select(TASK_COLUMNS_WITH_KIND).eq('user_id', userId).order('created_at', { ascending: true });
    if (error && isMissingKindColumn(error)) ({ data, error } = await client.from('tasks').select(TASK_COLUMNS).eq('user_id', userId).order('created_at', { ascending: true }));
    if (error) return fromError(error);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch (e) { return fail('network', e?.message); }
}

export async function createTask(client, userId, form) {
  const g = guard(client, userId); if (g) return g;
  const n = normalizeTaskInput(form);
  if (!n.ok) return { ok: false, error: { code: 'invalid', message: n.errors.join(',') }, errors: n.errors };
  try {
    const { data, error } = await client.from('tasks').insert({ ...pickWritable(n.value), user_id: userId }).select(TASK_COLUMNS).single();
    if (error) return fromError(error);
    if (!data || data.user_id !== userId) return fail('unknown', 'no persisted row returned');
    return { ok: true, data };
  } catch (e) { return fail('network', e?.message); }
}

// RFC 4122 v4 request id for createFollowUpTask (crypto.getRandomValues)
export function newRequestId(cryptoImpl = globalThis.crypto) {
  const b = new Uint8Array(16);
  cryptoImpl.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Task 28: a follow-up from a quote. ONE server call (create_follow_up_task): idempotent by requestId (the caller keeps the same id for
// every retry of the same form, so a lost response never creates a second row) and race-safe (another window's open follow-up is returned
// instead of a new row). Result: { ok: true, data, created, reason } | { ok: false, error }. A network error is never success.
// Task 29: there is NO unguarded fallback. A client without rpc, or a server without the RPC / schema, answers { ok: false, error: { code:
// 'follow_up_unavailable' } } - nothing is inserted (an ordinary insert would void the uniqueness and the idempotency). Ordinary tasks keep
// their own path (createTask) and are never affected by a missing follow-up RPC.
export async function createFollowUpTask(client, userId, form, requestId) {
  const g = guard(client, userId); if (g) return g;
  if (typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) return fail('invalid', 'request id');
  const n = normalizeTaskInput(form);
  if (!n.ok) return { ok: false, error: { code: 'invalid', message: n.errors.join(',') }, errors: n.errors };
  if (!n.value.quote_id) return fail('invalid', 'quote');
  if (typeof client.rpc !== 'function') return fail('follow_up_unavailable', 'client without rpc');
  try {
    const v = n.value;
    const { data, error } = await client.rpc('create_follow_up_task', {
      p_id: requestId, p_quote_id: v.quote_id, p_title: v.title, p_notes: v.notes, p_priority: v.priority,
      p_due_date: v.due_date, p_due_time: v.due_time, p_client_id: v.client_id,
    });
    if (error && isMissingFollowUpRpc(error)) return fail('follow_up_unavailable', 'create_follow_up_task is not on this server');
    if (error) return fromError(error);
    const task = data && typeof data === 'object' ? data.task : null;
    if (!task || task.user_id !== userId || task.quote_id !== v.quote_id || typeof data.created !== 'boolean') return fail('unknown', 'no persisted row returned');
    return { ok: true, data: task, created: data.created, reason: String(data.reason || '') };
  } catch (e) { return fail('network', e?.message); }
}

export async function updateTask(client, userId, id, form) {
  const g = guard(client, userId); if (g) return g;
  if (typeof id !== 'string' || !id) return fail('invalid', 'id');
  const n = normalizeTaskInput(form);
  if (!n.ok) return { ok: false, error: { code: 'invalid', message: n.errors.join(',') }, errors: n.errors };
  try {
    const { data, error } = await client.from('tasks').update(pickWritable(n.value)).eq('id', id).eq('user_id', userId).select(TASK_COLUMNS).single();
    if (error) return fromError(error);
    if (!data) return fail('unknown', 'no persisted row returned');
    return { ok: true, data };
  } catch (e) { return fail('network', e?.message); }
}

export async function setTaskStatus(client, userId, id, status) {
  const g = guard(client, userId); if (g) return g;
  if (typeof id !== 'string' || !id || !['open', 'completed'].includes(status)) return fail('invalid', 'status');
  try {
    const { data, error } = await client.from('tasks').update({ status }).eq('id', id).eq('user_id', userId).select(TASK_COLUMNS).single();
    if (error) return fromError(error);
    if (!data || data.status !== status) return fail('unknown', 'no persisted row returned');
    return { ok: true, data };
  } catch (e) { return fail('network', e?.message); }
}

export async function deleteTask(client, userId, id) {
  const g = guard(client, userId); if (g) return g;
  if (typeof id !== 'string' || !id) return fail('invalid', 'id');
  try {
    const { data, error } = await client.from('tasks').delete().eq('id', id).eq('user_id', userId).select('id');
    if (error) return fromError(error);
    if (!Array.isArray(data) || data.length !== 1 || data[0].id !== id) return fail('unknown', 'the task was not deleted');
    return { ok: true, data: { id } };
  } catch (e) { return fail('network', e?.message); }
}
