// Task 28: follow-up duplicate prevention end to end on the client - one stable request id per follow-up form (retries are the same
// server request), another window's open follow-up is shown instead of a second row, a network error is never success and keeps the
// form, ordinary tasks on the same quote are not blocked. Task 29: a client / server without the follow-up RPC is refused explicitly
// (follow_up_unavailable) with ZERO inserts - there is no unguarded fallback; ordinary tasks keep working there.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TasksTab from './components/TasksTab';
import { createFollowUpTask, listTasks, newRequestId } from './utils/tasksClient';

const USER = '00000000-0000-4000-8000-0000000000a1';
const NOW = new Date('2026-10-09T09:00:00.000Z');
const QUOTES = [{ id: 'q1', quote_number: 1201, client_id: 'c1', clients: { company_name: 'Synthetic Alpha' }, created_at: '2026-10-01T00:00:00Z' }];
const CLIENTS = [{ id: 'c1', company_name: 'Synthetic Alpha' }];
const T = (id, extra = {}) => ({ id, user_id: USER, kind: 'task', title: `Task ${id}`, notes: null, status: 'open', priority: 'normal', due_date: null, due_time: null, quote_id: null, client_id: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', completed_at: null, ...extra });

// A fake with the SERVER semantics of create_follow_up_task (20261011120000): idempotent by p_id, one open follow-up per quote.
function serverFake(initial = [], { failNext = 0, loseResponseNext = 0 } = {}) {
  const rows = initial.map((r) => ({ ...r }));
  const calls = [];
  const state = { failNext, loseResponseNext };
  const rpc = vi.fn(async (name, a) => {
    calls.push({ name, ...a });
    if (state.failNext > 0) { state.failNext -= 1; throw new TypeError('Failed to fetch'); }
    let res;
    const same = rows.find((r) => r.id === a.p_id);
    if (same) res = { created: false, reason: 'same_request', task: { ...same } };
    else {
      const open = rows.find((r) => r.kind === 'follow_up' && r.status === 'open' && r.quote_id === a.p_quote_id);
      if (open) res = { created: false, reason: 'existing_open_follow_up', task: { ...open } };
      else {
        const row = T(a.p_id, { kind: 'follow_up', title: a.p_title, notes: a.p_notes, priority: a.p_priority, quote_id: a.p_quote_id, client_id: a.p_client_id });
        rows.push(row); res = { created: true, reason: 'created', task: { ...row } };
      }
    }
    // the write happened but the response is lost on the way back (the retry must not create a second row)
    if (state.loseResponseNext > 0) { state.loseResponseNext -= 1; throw new TypeError('Failed to fetch'); }
    return { data: res, error: null };
  });
  const from = vi.fn(() => {
    const b = { select: () => b, order: () => b, eq: () => b, then: (ok) => Promise.resolve({ data: rows.filter((r) => r.user_id === USER).map((r) => ({ ...r })), error: null }).then(ok) };
    return b;
  });
  return { client: { rpc, from }, rows, calls, state };
}
function renderTab(client, followUpDraft = { quote_id: 'q1', client_id: 'c1', origin: 'hot_quote' }, isHebrew = true) {
  const onStatus = vi.fn();
  render(<div dir={isHebrew ? 'rtl' : 'ltr'}><TasksTab userId={USER} isHebrew={isHebrew} isLocalIsraeliBusiness={isHebrew} quotes={QUOTES} clients={CLIENTS} onStatus={onStatus}
    followUpDraft={followUpDraft} onFollowUpConsumed={vi.fn()} client={client} now={NOW} /></div>);
  return { onStatus };
}

describe('tasks client - follow-up request', () => {
  it('sends ONE rpc with the request id, the quote and the normalized fields; returns the persisted row', async () => {
    const f = serverFake();
    const id = newRequestId();
    const r = await createFollowUpTask(f.client, USER, { title: ' Follow up 1201 ', quote_id: 'q1', client_id: 'c1', priority: 'high' }, id);
    expect(r).toMatchObject({ ok: true, created: true, data: { id, kind: 'follow_up', quote_id: 'q1' } });
    expect(f.calls).toEqual([{ name: 'create_follow_up_task', p_id: id, p_quote_id: 'q1', p_title: 'Follow up 1201', p_notes: null, p_priority: 'high', p_due_date: null, p_due_time: null, p_client_id: 'c1' }]);
  });
  it('a network error is never success; a retry with the same id after a lost response returns the same row (one row in total)', async () => {
    const f = serverFake([], { loseResponseNext: 1 });
    const id = newRequestId();
    const first = await createFollowUpTask(f.client, USER, { title: 'x', quote_id: 'q1' }, id);
    expect(first).toMatchObject({ ok: false, error: { code: 'network' } });
    const retry = await createFollowUpTask(f.client, USER, { title: 'x', quote_id: 'q1' }, id);
    expect(retry).toMatchObject({ ok: true, created: false, reason: 'same_request', data: { id } });
    expect(f.rows.filter((r) => r.kind === 'follow_up')).toHaveLength(1);
  });
  it('the request id must be a uuid; no quote = not a follow-up', async () => {
    const f = serverFake();
    expect((await createFollowUpTask(f.client, USER, { title: 'x', quote_id: 'q1' }, 'nope')).error.code).toBe('invalid');
    expect((await createFollowUpTask(f.client, USER, { title: 'x' }, newRequestId())).error.code).toBe('invalid');
    expect(f.client.rpc).not.toHaveBeenCalled();
  });
  // Task 29: no unguarded fallback - both cases are an explicit refusal and NOTHING is inserted
  const insertSpy = () => { const inserted = []; return { inserted, from: vi.fn(() => ({ insert: (p) => { inserted.push(p); return { select: () => ({ single: () => Promise.resolve({ data: { id: 't9', ...p }, error: null }) }) }; } })) }; };
  it('a server without the RPC (PGRST202) -> follow_up_unavailable, zero inserts', async () => {
    const spy = insertSpy();
    const client = { rpc: vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.create_follow_up_task(p_client_id, p_due_date) in the schema cache' } })), from: spy.from };
    const r = await createFollowUpTask(client, USER, { title: 'x', quote_id: 'q1' }, newRequestId());
    expect(r).toMatchObject({ ok: false, error: { code: 'follow_up_unavailable' } });
    expect(spy.inserted).toHaveLength(0);
    expect(spy.from).not.toHaveBeenCalled();
  });
  it('a client without rpc -> follow_up_unavailable, zero inserts', async () => {
    const spy = insertSpy();
    const r = await createFollowUpTask({ from: spy.from }, USER, { title: 'x', quote_id: 'q1' }, newRequestId());
    expect(r).toMatchObject({ ok: false, error: { code: 'follow_up_unavailable' } });
    expect(spy.inserted).toHaveLength(0);
  });
  it('a database refusal inside the RPC (e.g. the unique index on reopen races) is NOT treated as a missing RPC', async () => {
    const spy = insertSpy();
    const client = { rpc: vi.fn(async () => ({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "tasks_one_open_follow_up"' } })), from: spy.from };
    const r = await createFollowUpTask(client, USER, { title: 'x', quote_id: 'q1' }, newRequestId());
    expect(r.error.code).toBe('follow_up_exists');
    expect(spy.inserted).toHaveLength(0);
  });
  it('the list falls back to the base columns when the kind column does not exist yet', async () => {
    const selects = [];
    const client = { from: () => { const b = { select: (c) => { selects.push(c); return b; }, eq: () => b, order: () => b,
      then: (ok) => Promise.resolve(selects.length === 1 ? { data: null, error: { code: '42703', message: 'column tasks.kind does not exist' } } : { data: [T('a')], error: null }).then(ok) }; return b; } };
    const r = await listTasks(client, USER);
    expect(r.ok).toBe(true);
    expect(selects[0]).toMatch(/, kind$/);
    expect(selects[1]).not.toMatch(/kind/);
  });
});

describe('tasks screen - follow-up save', () => {
  it('HE: a server without the follow-up RPC -> the explicit message, the form and request id kept, nothing written; an ordinary task still saves', async () => {
    const rows = [];
    const inserts = [];
    const rpc = vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.create_follow_up_task' } }));
    const from = vi.fn(() => {
      const q = { op: 'select', payload: null };
      const b = { select: () => b, order: () => b, eq: () => b, single: () => b,
        insert: (p) => { q.op = 'insert'; q.payload = p; return b; },
        then: (ok) => {
          if (q.op === 'insert') { const row = T(`n${inserts.length + 1}`, { ...q.payload }); inserts.push(row); rows.push(row); return Promise.resolve({ data: { ...row }, error: null }).then(ok); }
          return Promise.resolve({ data: rows.map((r) => ({ ...r })), error: null }).then(ok);
        } };
      return b;
    });
    renderTab({ rpc, from });
    const form = await screen.findByTestId('task-form');
    fireEvent.change(form.querySelector('[name="title"]'), { target: { value: 'נוסח שלי' } });
    fireEvent.click(screen.getByTestId('task-save'));
    expect((await screen.findByTestId('task-form-errors')).textContent).toMatch(/נדרש עדכון שרת/);
    expect(form.querySelector('[name="title"]').value).toBe('נוסח שלי');
    expect(inserts).toHaveLength(0);
    fireEvent.click(screen.getByTestId('task-save')); // retry = the same request id
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
    expect(new Set(rpc.mock.calls.map((c) => c[1].p_id)).size).toBe(1);
    expect(inserts).toHaveLength(0);
    // an ORDINARY task is not blocked by the missing follow-up RPC
    fireEvent.click(screen.getByTestId('tasks-new'));
    const f2 = await screen.findByTestId('task-form');
    fireEvent.change(f2.querySelector('[name="title"]'), { target: { value: 'משימה רגילה' } });
    fireEvent.click(screen.getByTestId('task-save'));
    await waitFor(() => expect(inserts).toHaveLength(1));
    expect(inserts[0]).toMatchObject({ title: 'משימה רגילה' });
    expect(inserts[0].kind).toBe('task'); // T() default; the client never sends kind for an ordinary task
  });
  it('HE: ordinary open tasks on the same quote do NOT block a follow-up; saving creates exactly one follow-up', async () => {
    const f = serverFake([T('o1', { quote_id: 'q1', title: 'Order tiles' }), T('o2', { quote_id: 'q1', title: 'Call supplier' })]);
    const { onStatus } = renderTab(f.client);
    const form = await screen.findByTestId('task-form');
    expect(form.querySelector('[name="title"]').value).toMatch(/1201/);
    fireEvent.click(screen.getByTestId('task-save'));
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ text: 'המשימה נשמרה' })));
    expect(f.rows.filter((r) => r.kind === 'follow_up')).toHaveLength(1);
    expect(f.rows.filter((r) => r.kind === 'task')).toHaveLength(2); // ordinary rows untouched
  });
  it('an existing OPEN follow-up opens for editing instead of a new form', async () => {
    const f = serverFake([T('fu1', { kind: 'follow_up', quote_id: 'q1', title: 'Existing follow-up' })]);
    renderTab(f.client);
    const form = await screen.findByTestId('task-form');
    expect(form.querySelector('[name="title"]').value).toBe('Existing follow-up');
  });
  it('EN: another window wins the race -> the existing follow-up is shown, nothing new is written, the typed content stays', async () => {
    const f = serverFake();
    renderTab(f.client, undefined, false);
    const form = await screen.findByTestId('task-form');
    fireEvent.change(form.querySelector('[name="title"]'), { target: { value: 'My own wording' } });
    // the other window saves first (directly on the "server")
    f.rows.push(T('other', { kind: 'follow_up', quote_id: 'q1', title: 'From the other window' }));
    fireEvent.click(screen.getByTestId('task-save'));
    expect((await screen.findByTestId('task-follow-up-conflict')).textContent).toMatch(/already created \(in another window\)/);
    expect(form.querySelector('[name="title"]').value).toBe('My own wording');
    expect(f.rows.filter((r) => r.kind === 'follow_up')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('task-open-existing-follow-up'));
    await waitFor(() => expect(screen.getByTestId('task-form').querySelector('[name="title"]').value).toBe('From the other window'));
  });
  it('a network failure keeps the form and its request id: the retry is the SAME request and one row results', async () => {
    const f = serverFake([], { failNext: 1 });
    renderTab(f.client);
    await screen.findByTestId('task-form');
    fireEvent.click(screen.getByTestId('task-save'));
    expect((await screen.findByTestId('task-form-errors')).textContent).toMatch(/בעיית תקשורת/);
    expect(screen.getByTestId('task-form').querySelector('[name="title"]').value).toMatch(/1201/);
    fireEvent.click(screen.getByTestId('task-save'));
    await waitFor(() => expect(f.rows.filter((r) => r.kind === 'follow_up')).toHaveLength(1));
    expect(new Set(f.calls.map((c) => c.p_id)).size).toBe(1);
  });
});
