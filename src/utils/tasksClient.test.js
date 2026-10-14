// Task 18: the Tasks data path - owner-scoped calls, only client-writable columns, success ONLY from the persisted row, and every
// refusal mapped to a stable code (never thrown).
import { describe, it, expect, vi } from 'vitest';
import { classifyTaskError, createTask, deleteTask, listTasks, setTaskStatus, updateTask } from './tasksClient';

// a minimal chainable fake of the supabase-js query builder that records every call
function fakeClient(result) {
  const calls = [];
  const builder = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res, rej) => Promise.resolve(typeof result === 'function' ? result(calls) : result).then(res, rej);
      return (...args) => { calls.push([prop, ...args]); return builder; };
    },
  });
  return { calls, from: vi.fn((table) => { calls.push(['from', table]); return builder; }) };
}
const USER = 'user-a';
const row = (extra = {}) => ({ id: 't1', user_id: USER, title: 'Call', notes: null, status: 'open', priority: 'normal', due_date: null, due_time: null, quote_id: null, client_id: null, ...extra });

describe('tasksClient', () => {
  it('list: scoped to the owner, ok with rows', async () => {
    const c = fakeClient({ data: [row()], error: null });
    const r = await listTasks(c, USER);
    expect(r).toEqual({ ok: true, data: [row()] });
    expect(c.calls).toContainEqual(['from', 'tasks']);
    expect(c.calls).toContainEqual(['eq', 'user_id', USER]);
  });

  it('create: sends only the writable columns + the session owner, success only with the persisted row', async () => {
    const c = fakeClient({ data: row({ title: 'Call back' }), error: null });
    const r = await createTask(c, USER, { title: '  Call back ', priority: 'high', status: 'completed', user_id: 'someone-else', created_at: 'x' });
    expect(r.ok).toBe(true);
    const insert = c.calls.find((x) => x[0] === 'insert')[1];
    expect(Object.keys(insert).sort()).toEqual(['client_id', 'due_date', 'due_time', 'notes', 'priority', 'quote_id', 'title', 'user_id']);
    expect(insert).toMatchObject({ title: 'Call back', user_id: USER, priority: 'high' });
    expect(c.calls.some((x) => x[0] === 'single')).toBe(true);
  });

  it('create: invalid input is refused locally - nothing is sent', async () => {
    const c = fakeClient({ data: null, error: null });
    const r = await createTask(c, USER, { title: ' ' });
    expect(r).toMatchObject({ ok: false, error: { code: 'invalid' }, errors: ['title_required'] });
    expect(c.from).not.toHaveBeenCalled();
  });

  it('create: no persisted row => not a success (no optimistic success)', async () => {
    const r = await createTask(fakeClient({ data: null, error: null }), USER, { title: 'x' });
    expect(r).toMatchObject({ ok: false, error: { code: 'unknown' } });
  });

  it('a cross-tenant link refused by the database maps to link_not_allowed', async () => {
    const c = fakeClient({ data: null, error: { message: 'TK_TASK_LINK_NOT_ALLOWED: the linked quote or client is not available', code: '42501' } });
    const r = await createTask(c, USER, { title: 'x', quote_id: 'foreign-quote' });
    expect(r).toMatchObject({ ok: false, error: { code: 'link_not_allowed' } });
  });

  it('update / status / delete are scoped by id AND owner', async () => {
    const c1 = fakeClient({ data: row({ title: 'y' }), error: null });
    expect((await updateTask(c1, USER, 't1', { title: 'y' })).ok).toBe(true);
    expect(c1.calls).toContainEqual(['eq', 'id', 't1']);
    expect(c1.calls).toContainEqual(['eq', 'user_id', USER]);
    const c2 = fakeClient({ data: row({ status: 'completed', completed_at: '2026-10-09T10:00:00Z' }), error: null });
    expect((await setTaskStatus(c2, USER, 't1', 'completed')).ok).toBe(true);
    expect(c2.calls.find((x) => x[0] === 'update')[1]).toEqual({ status: 'completed' });
    const c3 = fakeClient({ data: [{ id: 't1' }], error: null });
    expect(await deleteTask(c3, USER, 't1')).toEqual({ ok: true, data: { id: 't1' } });
    expect(c3.calls).toContainEqual(['eq', 'user_id', USER]);
  });

  it('a delete that removed nothing (foreign / missing id) is not a success', async () => {
    expect(await deleteTask(fakeClient({ data: [], error: null }), USER, 'other')).toMatchObject({ ok: false, error: { code: 'unknown' } });
  });

  it('a status write that did not persist the requested status is not a success', async () => {
    expect(await setTaskStatus(fakeClient({ data: row({ status: 'open' }), error: null }), USER, 't1', 'completed')).toMatchObject({ ok: false });
    expect(await setTaskStatus(fakeClient({ data: row(), error: null }), USER, 't1', 'rejected')).toMatchObject({ ok: false, error: { code: 'invalid' } });
  });

  it('without a signed-in owner nothing is sent', async () => {
    const c = fakeClient({ data: [], error: null });
    expect(await listTasks(c, null)).toMatchObject({ ok: false, error: { code: 'not_signed_in' } });
    expect(c.from).not.toHaveBeenCalled();
  });

  it('a thrown network error is returned, never thrown', async () => {
    const c = { from: () => { throw new Error('Failed to fetch'); } };
    expect(await listTasks(c, USER)).toMatchObject({ ok: false, error: { code: 'network' } });
  });

  it.each([
    [{ message: 'relation "public.tasks" does not exist', code: '42P01' }, 'unavailable'],
    [{ message: "Could not find the table 'public.tasks' in the schema cache", code: 'PGRST205' }, 'unavailable'],
    [{ message: 'new row violates row-level security policy for table "tasks"', code: '42501' }, 'not_allowed'],
    [{ message: 'new row for relation "tasks" violates check constraint "tasks_title_check"', code: '23514' }, 'invalid'],
    [{ message: 'something else' }, 'unknown'],
  ])('classifies %j as %s', (error, code) => {
    expect(classifyTaskError(error)).toBe(code);
  });
});
