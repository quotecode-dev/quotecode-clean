// Leads stage 1 (Owner console 2026-11-18, typed: "מאשר את שלב 1 של הפניות ..."; the approved demo of 18/11; the Owner's answers of 17/11,
// docs/CRM_PREP_DECISIONS_2026-11-17.md). The ONE data path of the Leads tab (Supabase public.leads / public.lead_events, migration
// 20261118100000). Every call is scoped to the signed-in owner (RLS forced in the database; the explicit user_id filter is defence in
// depth) and every write returns the row the database persisted - the UI shows success only after it is confirmed.
// The next follow-up is a REGULAR task (tasksClient.createTask), so it shows in Tasks, the Calendar and the bell; nothing is ever sent
// to the lead. Results: { ok: true, data } | { ok: false, error: { code, message } } (never throws).
import { createTask, updateTask, setTaskStatus, deleteTask } from './tasksClient';

export const LEAD_COLUMNS = 'id, user_id, name, phone, email, need, source, source_detail, status, next_task_id, created_at, updated_at';
export const LEAD_EVENT_COLUMNS = 'id, user_id, lead_id, kind, body, happened_at, created_at';
export const LEAD_SOURCES = Object.freeze(['none', 'ref', 'phone', 'wa', 'web', 'fb', 'other']);
export const LEAD_STATUSES = Object.freeze(['new', 'prog', 'sent', 'off']);
// the statuses chosen by hand (decision 4 "א"); "quote sent" / "signed" follow the quote (a later stage)
export const MANUAL_LEAD_STATUSES = Object.freeze(['new', 'prog', 'off']);
export const LEAD_EVENT_KINDS = Object.freeze(['call', 'meet', 'msg', 'note']);

const fail = (code, message = '') => ({ ok: false, error: { code, message: String(message || '').slice(0, 300) } });
const guard = (client, userId) => (client && typeof client.from === 'function' && typeof userId === 'string' && userId ? null : fail('not_signed_in'));
export function classifyLeadError(error) {
  const msg = `${String(error?.message || '')} ${error?.code || ''}`;
  if (/TK_LEAD_LINK_NOT_ALLOWED/.test(msg)) return 'link_not_allowed';
  if (/leads_contact_check/.test(msg)) return 'contact_required';
  if (/check constraint|leads_|lead_events_/.test(msg)) return 'invalid';
  if (/relation .*lead.* does not exist|Could not find the table|schema cache|PGRST205|42P01/i.test(msg)) return 'unavailable';
  if (/row-level security|permission denied|42501|JWT|not authorized/i.test(msg)) return 'not_allowed';
  if (/fetch|network|Failed to fetch|timeout/i.test(msg)) return 'network';
  return 'unknown';
}
const fromError = (error) => fail(classifyLeadError(error), error?.message);
const clean = (v, max) => { const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''; return s ? s.slice(0, max) : null; };

/** The lead form as the database accepts it: a name and at least a phone number or an email address (decision: the demo's rule). */
export function normalizeLeadInput(form = {}) {
  const value = {
    name: clean(form.name, 200),
    phone: clean(form.phone, 40),
    email: clean(form.email, 254),
    need: clean(form.need, 500),
    source: LEAD_SOURCES.includes(form.source) ? form.source : 'none',
    source_detail: clean(form.source_detail, 200),
  };
  const errors = [];
  if (!value.name || (!value.phone && !value.email)) errors.push('name_and_contact_required');
  return { ok: errors.length === 0, value, errors };
}

/** Every lead of the owner, newest first, each with its open follow-up task (or null). */
export async function listLeads(client, userId) {
  const g = guard(client, userId); if (g) return g;
  try {
    const { data, error } = await client.from('leads').select(LEAD_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return fromError(error);
    const leads = Array.isArray(data) ? data : [];
    const taskIds = [...new Set(leads.map((l) => l.next_task_id).filter(Boolean))];
    let tasks = [];
    if (taskIds.length) {
      const t = await client.from('tasks').select('id, title, status, due_date, due_time').eq('user_id', userId).in('id', taskIds);
      if (t.error) return fromError(t.error);
      tasks = Array.isArray(t.data) ? t.data : [];
    }
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return { ok: true, data: leads.map((l) => { const task = l.next_task_id ? byId.get(l.next_task_id) || null : null; return { ...l, followUp: task && task.status === 'open' ? task : null }; }) };
  } catch (e) { return fail('network', e?.message); }
}

/** The follow-up task title: the lead's name (its first part, as in the demo) - shown in Tasks, the Calendar and the bell. */
export function followUpTitle(lead, isHebrew) {
  const name = String(lead?.name || '').split(',')[0].trim().slice(0, 150);
  return isHebrew ? `חזרה לפנייה של ${name}` : `Follow up with ${name}`;
}

async function linkFollowUp(client, userId, lead, due, isHebrew) {
  const t = await createTask(client, userId, { title: followUpTitle(lead, isHebrew), due_date: due.date, due_time: due.time || '' });
  if (!t.ok) return t;
  const { data, error } = await client.from('leads').update({ next_task_id: t.data.id }).eq('id', lead.id).eq('user_id', userId).select(LEAD_COLUMNS).single();
  if (error) { await deleteTask(client, userId, t.data.id); return fromError(error); }
  return { ok: true, data: { ...data, followUp: t.data } };
}

/** A new lead (status "new"); when a follow-up date is given, its regular task is created and linked. */
export async function createLead(client, userId, form, { followUp = null, isHebrew = true } = {}) {
  const g = guard(client, userId); if (g) return g;
  const n = normalizeLeadInput(form);
  if (!n.ok) return { ok: false, error: { code: 'invalid', message: n.errors.join(',') }, errors: n.errors };
  try {
    const { data, error } = await client.from('leads').insert({ ...n.value, user_id: userId }).select(LEAD_COLUMNS).single();
    if (error) return fromError(error);
    if (!data || data.user_id !== userId) return fail('unknown', 'no persisted row returned');
    if (followUp && followUp.date) {
      const linked = await linkFollowUp(client, userId, data, followUp, isHebrew);
      // the lead is saved either way; a follow-up that could not be created is reported, never hidden
      return linked.ok ? linked : { ok: true, data: { ...data, followUp: null }, followUpError: linked.error };
    }
    return { ok: true, data: { ...data, followUp: null } };
  } catch (e) { return fail('network', e?.message); }
}

/** A hand-chosen status. "Not relevant" removes the open follow-up task (the demo's question says so); no contact entry is added. */
export async function setLeadStatus(client, userId, lead, status) {
  const g = guard(client, userId); if (g) return g;
  if (!MANUAL_LEAD_STATUSES.includes(status)) return fail('invalid', 'status');
  try {
    if (status === 'off' && lead.next_task_id) {
      const d = await deleteTask(client, userId, lead.next_task_id);
      if (!d.ok && d.error?.code !== 'not_found') return d;
    }
    const patch = status === 'off' ? { status, next_task_id: null } : { status };
    const { data, error } = await client.from('leads').update(patch).eq('id', lead.id).eq('user_id', userId).select(LEAD_COLUMNS).single();
    if (error) return fromError(error);
    return { ok: true, data: { ...data, followUp: status === 'off' ? null : lead.followUp || null } };
  } catch (e) { return fail('network', e?.message); }
}

export async function scheduleFollowUp(client, userId, lead, due, { isHebrew = true } = {}) {
  const g = guard(client, userId); if (g) return g;
  try {
    if (lead.followUp && lead.next_task_id) {
      const u = await updateTask(client, userId, lead.next_task_id, { title: lead.followUp.title || followUpTitle(lead, isHebrew), due_date: due.date, due_time: due.time || '' });
      if (!u.ok) return u;
      return { ok: true, data: { ...lead, followUp: u.data } };
    }
    return await linkFollowUp(client, userId, lead, due, isHebrew);
  } catch (e) { return fail('network', e?.message); }
}

/** "Complete follow-up": the task is marked done in Tasks; the lead keeps no open follow-up until the next one is scheduled. */
export async function completeFollowUp(client, userId, lead) {
  const g = guard(client, userId); if (g) return g;
  if (!lead.next_task_id) return fail('invalid', 'no follow-up');
  try {
    const s = await setTaskStatus(client, userId, lead.next_task_id, 'completed');
    if (!s.ok) return s;
    const { data, error } = await client.from('leads').update({ next_task_id: null }).eq('id', lead.id).eq('user_id', userId).select(LEAD_COLUMNS).single();
    if (error) return fromError(error);
    return { ok: true, data: { ...data, followUp: null } };
  } catch (e) { return fail('network', e?.message); }
}

export async function listLeadEvents(client, userId, leadId) {
  const g = guard(client, userId); if (g) return g;
  try {
    const { data, error } = await client.from('lead_events').select(LEAD_EVENT_COLUMNS).eq('user_id', userId).eq('lead_id', leadId).order('happened_at', { ascending: false });
    if (error) return fromError(error);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch (e) { return fail('network', e?.message); }
}

export async function addLeadEvent(client, userId, leadId, { kind, body, happenedAt = null }) {
  const g = guard(client, userId); if (g) return g;
  const text = typeof body === 'string' ? body.trim().slice(0, 2000) : '';
  if (!LEAD_EVENT_KINDS.includes(kind) || !text) return fail('invalid', 'entry');
  try {
    const row = { user_id: userId, lead_id: leadId, kind, body: text, ...(happenedAt ? { happened_at: happenedAt } : {}) };
    const { data, error } = await client.from('lead_events').insert(row).select(LEAD_EVENT_COLUMNS).single();
    if (error) return fromError(error);
    return { ok: true, data };
  } catch (e) { return fail('network', e?.message); }
}
