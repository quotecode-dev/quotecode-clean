// Task 18: the Tasks screen rendered in HE/RTL and EN/LTR against an in-memory fake of public.tasks (owner-scoped like RLS):
// loading / empty / validation / success / recoverable error states, create / edit / complete / reopen / delete, grouping by the
// ACCOUNT market, the hot-quote follow-up prefill (nothing created before Save) and no success before the persisted row.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import TasksTab from './TasksTab';

const USER = '00000000-0000-4000-8000-0000000000a1';
const NOW = new Date('2026-10-09T09:00:00.000Z'); // Local 12:00 / International 09:00

// In-memory public.tasks: every query is filtered to the owner (as RLS does); writes return the persisted row.
function fakeTasksDb(initial = [], { failOn = null, linkGuard = () => true, holdWrites = false } = {}) {
  const rows = initial.map((r) => ({ ...r }));
  let seq = 0;
  const pending = [];
  const db = {
    rows, pending,
    rpcCalls: [],
    // Task 29: the real follow-up path (20261011120000 semantics), no plain-insert fallback exists any more
    async rpc(name, a) {
      db.rpcCalls.push({ name, ...a });
      if (name !== 'create_follow_up_task') return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
      if (!linkGuard({ quote_id: a.p_quote_id, client_id: a.p_client_id })) return { data: null, error: { message: 'TK_TASK_LINK_NOT_ALLOWED: the linked quote or client is not available', code: '42501' } };
      const same = rows.find((r) => r.id === a.p_id);
      if (same) return { data: { created: false, reason: 'same_request', task: { ...same } }, error: null };
      const open = rows.find((r) => r.kind === 'follow_up' && r.status === 'open' && r.quote_id === a.p_quote_id && r.user_id === USER);
      if (open) return { data: { created: false, reason: 'existing_open_follow_up', task: { ...open } }, error: null };
      const row = { id: a.p_id, user_id: USER, kind: 'follow_up', title: a.p_title, notes: a.p_notes, status: 'open', priority: a.p_priority, due_date: a.p_due_date, due_time: a.p_due_time,
        quote_id: a.p_quote_id, client_id: a.p_client_id, completed_at: null, created_at: '2026-10-09T08:00:00Z', updated_at: '2026-10-09T08:00:00Z' };
      rows.push(row);
      return { data: { created: true, reason: 'created', task: { ...row } }, error: null };
    },
    from(table) {
      if (table !== 'tasks') throw new Error(`unexpected table ${table}`);
      const q = { op: 'select', filters: [], payload: null, single: false };
      const run = () => {
        if (failOn && failOn(q)) return { data: null, error: failOn(q) };
        const mine = (r) => r.user_id === USER && q.filters.every(([k, v]) => r[k] === v);
        if (q.op === 'select') return { data: rows.filter(mine).map((r) => ({ ...r })), error: null };
        if (q.op === 'insert') {
          if (q.payload.user_id !== USER) return { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } };
          if (!linkGuard(q.payload)) return { data: null, error: { message: 'TK_TASK_LINK_NOT_ALLOWED: the linked quote or client is not available', code: '42501' } };
          seq += 1;
          const row = { id: `t-new-${seq}`, status: 'open', completed_at: null, created_at: '2026-10-09T08:00:00Z', updated_at: '2026-10-09T08:00:00Z', ...q.payload };
          rows.push(row);
          return { data: { ...row }, error: null };
        }
        const hits = rows.filter(mine);
        if (q.op === 'update') {
          hits.forEach((r) => { Object.assign(r, q.payload); if ('status' in q.payload) r.completed_at = q.payload.status === 'completed' ? '2026-10-09T09:00:00Z' : null; });
          return { data: hits[0] ? { ...hits[0] } : null, error: hits[0] ? null : { message: 'no rows', code: 'PGRST116' } };
        }
        if (q.op === 'delete') {
          hits.forEach((r) => rows.splice(rows.indexOf(r), 1));
          return { data: hits.map((r) => ({ id: r.id })), error: null };
        }
        return { data: null, error: { message: 'bad op' } };
      };
      const b = {
        select: () => b, order: () => b,
        insert: (p) => { q.op = 'insert'; q.payload = p; return b; },
        update: (p) => { q.op = 'update'; q.payload = p; return b; },
        delete: () => { q.op = 'delete'; return b; },
        eq: (k, v) => { q.filters.push([k, v]); return b; },
        single: () => { q.single = true; return b; },
        then: (res, rej) => {
          const exec = () => Promise.resolve(run());
          if (holdWrites && q.op !== 'select') return new Promise((r) => pending.push(() => r(run()))).then(res, rej);
          return exec().then(res, rej);
        },
      };
      return b;
    },
  };
  return db;
}

const QUOTES = [
  { id: 'q1', quote_number: 1201, client_id: 'c1', clients: { company_name: 'Synthetic Alpha' }, created_at: '2026-10-01T00:00:00Z' },
  { id: 'q2', quote_number: 1202, client_id: null, clients: null, subject: 'Kitchen', created_at: '2026-10-02T00:00:00Z' },
];
const CLIENTS = [{ id: 'c1', company_name: 'Synthetic Alpha' }, { id: 'c2', company_name: 'Synthetic Beta' }];
const T = (id, extra = {}) => ({ id, user_id: USER, title: `Task ${id}`, notes: null, status: 'open', priority: 'normal', due_date: null, due_time: null, quote_id: null, client_id: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', completed_at: null, ...extra });

function setup(isHebrew, { initial = [], db: given, isLocalIsraeliBusiness = isHebrew, followUpDraft = null, onFollowUpConsumed = vi.fn() } = {}) {
  const db = given || fakeTasksDb(initial);
  const onStatus = vi.fn();
  const utils = render(
    <div dir={isHebrew ? 'rtl' : 'ltr'}>
      <TasksTab userId={USER} isHebrew={isHebrew} isLocalIsraeliBusiness={isLocalIsraeliBusiness} quotes={QUOTES} clients={CLIENTS} onStatus={onStatus}
        followUpDraft={followUpDraft} onFollowUpConsumed={onFollowUpConsumed} client={db} now={NOW} />
    </div>,
  );
  return { db, onStatus, ...utils };
}
const fill = (container, name, value) => fireEvent.change(container.querySelector(`[name="${name}"]`), { target: { value } });

describe.each([
  ['Hebrew/RTL', true, { new: 'משימה חדשה', save: 'שמירה', saved: 'המשימה נשמרה', overdue: 'באיחור', today: 'היום', upcoming: 'בהמשך', noDate: 'ללא תאריך יעד', done: 'סימון המשימה כהושלמה', reopen: 'פתיחה מחדש של המשימה', del: 'מחיקת המשימה', delConfirm: 'מחיקה', completed: 'הושלמו', retry: 'נסו שוב', required: 'נא להזין כותרת למשימה.' }],
  ['English/LTR', false, { new: 'New task', save: 'Save', saved: 'Task saved', overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming', noDate: 'No due date', done: 'Mark task as done', reopen: 'Reopen task', del: 'Delete task', delConfirm: 'Delete', completed: 'Completed', retry: 'Try again', required: 'Enter a task title.' }],
])('Tasks screen - %s', (_label, isHebrew, X) => {
  it('shows loading, then the empty state; the screen inherits the structural direction', async () => {
    const { container } = setup(isHebrew);
    expect(screen.getByTestId('tasks-loading')).toBeInTheDocument();
    await screen.findByTestId('tasks-empty-open');
    expect(getComputedStyle(container.firstChild).direction).toBe(isHebrew ? 'rtl' : 'ltr');
  });

  it('groups open tasks into overdue / today / upcoming / no date (account market) with LTR-isolated dates and times', async () => {
    const { container } = setup(isHebrew, { initial: [
      T('a', { due_date: '2026-10-08' }), T('b', { due_date: '2026-10-09', due_time: '15:00:00' }), T('c', { due_date: '2026-10-20' }), T('d'),
      T('x', { status: 'completed', completed_at: '2026-10-08T10:00:00Z' }),
    ] });
    await waitFor(() => expect(container.querySelectorAll('.pf-task').length).toBe(4));
    const groups = [...container.querySelectorAll('.pf-tasks-group')].map((g) => g.getAttribute('data-group'));
    expect(groups).toEqual(['overdue', 'today', 'upcoming', 'noDate']);
    const due = container.querySelector('[data-task-id="b"] [data-testid="task-due-date"]');
    expect(due).toHaveAttribute('dir', 'ltr');
    expect(due.textContent).toBe(isHebrew ? '09/10/2026' : '10/09/2026');
    expect(container.querySelector('[data-task-id="b"] [data-testid="task-due-time"]').textContent).toBe('15:00');
    expect(screen.getByRole('heading', { name: new RegExp(X.overdue) })).toBeInTheDocument();
  });

  it('validation: an empty title is explained and nothing is sent', async () => {
    const { container, db } = setup(isHebrew);
    await screen.findByTestId('tasks-empty-open');
    fireEvent.click(screen.getByTestId('tasks-new'));
    fireEvent.click(screen.getByTestId('task-save'));
    expect(within(screen.getByTestId('task-form-errors')).getByText(X.required)).toBeInTheDocument();
    expect(db.rows).toHaveLength(0);
    expect(container.querySelector('[name="title"]')).toHaveAttribute('aria-invalid', 'true');
  });

  it('create: "Saving..." until Supabase returns the persisted row - no optimistic success', async () => {
    const db = fakeTasksDb([], { holdWrites: true });
    const { container, onStatus } = setup(isHebrew, { db });
    await screen.findByTestId('tasks-empty-open');
    fireEvent.click(screen.getByTestId('tasks-new'));
    fill(container, 'title', 'Call the client');
    // typed in the ACCOUNT market's order (HE fixture = Local DD/MM/YYYY, EN fixture = International MM/DD/YYYY)
    fill(container, 'due_date_text', isHebrew ? '10/10/2026' : '10/10/2026');
    fill(container, 'due_time', '9:30');
    fireEvent.click(screen.getByTestId('task-save'));
    await waitFor(() => expect(db.pending).toHaveLength(1));
    expect(screen.getByTestId('task-save')).toBeDisabled();
    expect(onStatus).not.toHaveBeenCalled();
    expect(container.querySelector('.pf-task')).toBeNull();
    await act(async () => { db.pending.shift()(); });
    await waitFor(() => expect(container.querySelector('.pf-task')).not.toBeNull());
    expect(onStatus).toHaveBeenCalledWith({ text: X.saved, type: 'success' });
    expect(db.rows[0]).toMatchObject({ title: 'Call the client', due_date: '2026-10-10', due_time: '09:30', user_id: USER });
  });

  it('a recoverable save error keeps the form and explains it (a crafted cross-tenant link)', async () => {
    const db = fakeTasksDb([], { linkGuard: (p) => p.quote_id !== 'q2' });
    const { container } = setup(isHebrew, { db });
    await screen.findByTestId('tasks-empty-open');
    fireEvent.click(screen.getByTestId('tasks-new'));
    fill(container, 'title', 'x');
    fill(container, 'quote_id', 'q2');
    fireEvent.click(screen.getByTestId('task-save'));
    await screen.findByTestId('task-form-errors');
    expect(screen.getByTestId('task-form')).toBeInTheDocument();
    expect(db.rows).toHaveLength(0);
  });

  it('complete -> completed view -> reopen, each only after the persisted row', async () => {
    const { container, onStatus } = setup(isHebrew, { initial: [T('a', { due_date: '2026-10-10' })] });
    await waitFor(() => expect(container.querySelector('[data-task-id="a"]')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: X.done }));
    await waitFor(() => expect(screen.getByTestId('tasks-empty-open')).toBeInTheDocument());
    expect(onStatus).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('[data-view="completed"]'));
    expect(container.querySelector('[data-task-id="a"]')).toHaveAttribute('data-status', 'completed');
    fireEvent.click(screen.getByRole('button', { name: X.reopen }));
    await waitFor(() => expect(screen.getByTestId('tasks-empty-completed')).toBeInTheDocument());
  });

  it('edit keeps the stored date-only value and time, and updates the row', async () => {
    const { container, db } = setup(isHebrew, { initial: [T('a', { due_date: '2026-10-12', due_time: '08:15:00', priority: 'high' })] });
    await waitFor(() => expect(container.querySelector('[data-task-id="a"]')).not.toBeNull());
    fireEvent.click(within(container.querySelector('[data-task-id="a"]')).getAllByRole('button')[1]);
    expect(container.querySelector('[name="due_date_text"]').value).toBe(isHebrew ? '12/10/2026' : '10/12/2026');
    expect(container.querySelector('[name="due_time"]').value).toBe('08:15');
    fill(container, 'title', 'Renamed');
    fireEvent.click(screen.getByTestId('task-save'));
    await waitFor(() => expect(db.rows[0].title).toBe('Renamed'));
    expect(db.rows[0].due_date).toBe('2026-10-12');
  });

  it('delete asks for confirmation with the shared modal, then removes the row', async () => {
    const { container, db } = setup(isHebrew, { initial: [T('a')] });
    await waitFor(() => expect(container.querySelector('[data-task-id="a"]')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: X.del }));
    expect(db.rows).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: X.delConfirm }));
    await waitFor(() => expect(db.rows).toHaveLength(0));
    expect(container.querySelector('[data-task-id="a"]')).toBeNull();
  });

  it('a load failure is shown with a working retry', async () => {
    let fail = true;
    const db = fakeTasksDb([T('a')], { failOn: (q) => (fail && q.op === 'select' ? { message: 'Failed to fetch' } : null) });
    const { container } = setup(isHebrew, { db });
    await screen.findByTestId('tasks-load-error');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: X.retry }));
    await waitFor(() => expect(container.querySelector('[data-task-id="a"]')).not.toBeNull());
  });

  it('hot-quote follow-up: the form opens pre-linked to the quote and its client; nothing is created until Save', async () => {
    const consumed = vi.fn();
    const { container, db } = setup(isHebrew, { followUpDraft: { quote_id: 'q1', client_id: 'c1', origin: 'hot_quote' }, onFollowUpConsumed: consumed });
    await screen.findByTestId('task-form');
    expect(consumed).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[name="quote_id"]').value).toBe('q1');
    expect(container.querySelector('[name="client_id"]').value).toBe('c1');
    expect(container.querySelector('[name="title"]').value).toMatch(/1201/);
    expect(db.rows).toHaveLength(0);
    fireEvent.click(screen.getByTestId('task-save'));
    await waitFor(() => expect(db.rows).toHaveLength(1));
    expect(db.rows[0]).toMatchObject({ quote_id: 'q1', client_id: 'c1', kind: 'follow_up' });
    expect(db.rpcCalls.map((c) => c.name)).toEqual(['create_follow_up_task']);
  });

  // Task 27 (spec §6): no duplicate follow-up - an OPEN task already linked to the quote opens for editing instead; nothing is created.
  it('hot-quote follow-up with an open task already linked to the quote: that task opens, no second task is created', async () => {
    const consumed = vi.fn();
    const { container, db, onStatus } = setup(isHebrew, { initial: [T('f1', { quote_id: 'q1', client_id: 'c1', title: 'Existing follow-up' })], followUpDraft: { quote_id: 'q1', client_id: 'c1', origin: 'hot_quote' }, onFollowUpConsumed: consumed });
    await screen.findByTestId('task-form');
    expect(consumed).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[name="title"]').value).toBe('Existing follow-up');
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringMatching(/כבר יש משימת מעקב פתוחה|already exists for this quote/) }));
    expect(db.rows).toHaveLength(1);
  });
  it('a COMPLETED follow-up does not block a new one', async () => {
    const { container } = setup(isHebrew, { initial: [T('f2', { quote_id: 'q1', status: 'completed', completed_at: '2026-10-02T00:00:00Z' })], followUpDraft: { quote_id: 'q1', client_id: 'c1', origin: 'hot_quote' } });
    await screen.findByTestId('task-form');
    expect(container.querySelector('[name="title"]').value).toMatch(/1201/);
  });

  it('the quote / client pickers list only the tenant rows given to the screen', async () => {
    const { container } = setup(isHebrew);
    await screen.findByTestId('tasks-empty-open');
    fireEvent.click(screen.getByTestId('tasks-new'));
    expect([...container.querySelectorAll('[name="quote_id"] option')].map((o) => o.value)).toEqual(['', 'q2', 'q1']);
    expect([...container.querySelectorAll('[name="client_id"] option')].map((o) => o.value)).toEqual(['', 'c1', 'c2']);
  });
  it('date entry follows the account market order; an impossible date is refused with a message and nothing is sent', async () => {
    const { container, db } = setup(isHebrew);
    await screen.findByTestId('tasks-empty-open');
    fireEvent.click(screen.getByTestId('tasks-new'));
    fill(container, 'title', 'x');
    // 31/04 (Local) and 04/31 (International) do not exist
    fill(container, 'due_date_text', isHebrew ? '31/04/2026' : '04/31/2026');
    fireEvent.click(screen.getByTestId('task-save'));
    await screen.findByTestId('task-form-errors');
    expect(db.rows).toHaveLength(0);
    fill(container, 'due_date_text', isHebrew ? '13/05/2026' : '05/13/2026');
    fireEvent.click(screen.getByTestId('task-save'));
    await waitFor(() => expect(db.rows).toHaveLength(1));
    expect(db.rows[0].due_date).toBe('2026-05-13');
  });
});

describe('Tasks screen - account market, not UI language (IRON-DATE-001)', () => {
  it('Hebrew UI on an International account: International order and UTC "today"', async () => {
    const { container } = setup(true, { isLocalIsraeliBusiness: false, initial: [T('a', { due_date: '2026-10-09' })] });
    await waitFor(() => expect(container.querySelector('[data-task-id="a"]')).not.toBeNull());
    expect(container.querySelector('[data-testid="task-due-date"]').textContent).toBe('10/09/2026');
    expect(container.querySelector('[data-task-id="a"]').getAttribute('data-group')).toBe('today');
  });
  it('English UI on a Local account: Local order', async () => {
    const { container } = setup(false, { isLocalIsraeliBusiness: true, initial: [T('a', { due_date: '2026-10-09' })] });
    await waitFor(() => expect(container.querySelector('[data-task-id="a"]')).not.toBeNull());
    expect(container.querySelector('[data-testid="task-due-date"]').textContent).toBe('09/10/2026');
  });
});

// Task 19: a task chosen in the Calendar opens in the Tasks screen's own existing edit form (no new task flow).
describe('Tasks screen - opened from the Calendar', () => {
  it('opens the existing edit form for that task once the persisted rows are loaded, then reports it consumed', async () => {
    const db = fakeTasksDb([T('a', { due_date: '2026-10-12', due_time: '08:15:00' }), T('done', { status: 'completed', completed_at: '2026-10-08T10:00:00Z' })]);
    const consumed = vi.fn();
    const { container } = render(<TasksTab userId={USER} isHebrew isLocalIsraeliBusiness quotes={QUOTES} clients={CLIENTS} onStatus={vi.fn()} client={db} now={NOW} openTaskId="done" onOpenTaskConsumed={consumed} />);
    await screen.findByTestId('task-form');
    expect(screen.getByTestId('task-form')).toHaveAttribute('data-mode', 'edit');
    expect(container.querySelector('[name="title"]').value).toBe('Task done');
    expect(container.querySelector('[data-view="completed"]')).toHaveAttribute('aria-pressed', 'true');
    expect(consumed).toHaveBeenCalledTimes(1);
  });
});
