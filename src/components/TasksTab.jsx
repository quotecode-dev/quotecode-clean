// Task 18 - durable manual tasks (authenticated product). ONE screen: create / edit / complete / reopen / delete, grouped open tasks
// (overdue, today, upcoming, no date) and a separate completed view. Data lives in Supabase public.tasks (RLS forced, owner only) and
// therefore persists across reloads and devices; nothing is shown as saved before Supabase returned the persisted row.
// Dates (IRON-DATE-001): the AUTHENTICATED ACCOUNT MARKET decides "today", the clock and the short-date order; due dates are date-only
// values and never shift. HE is structural RTL, EN structural LTR (inherited); dates, times and quote numbers are LTR-isolated atoms.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckCircle2, Circle, ListChecks, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { APP as NEON, appHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW } from '../theme/neonTheme';
import DeleteConfirmModal from './DeleteConfirmModal';
import { formatShortDate } from '../utils/shortDate';
import { displayQuoteNumber, quotePartyLabel } from '../utils/quoteListRows';
import {
  TASK_GROUPS, TASK_NOTES_MAX, TASK_PRIORITIES, TASK_TITLE_MAX, groupTasks, isCalendarDate, marketDatePattern, normalizeTaskInput, parseMarketDate, shortTime, taskMarket,
} from '../utils/manualTasks';
import { createFollowUpTask, createTask, deleteTask, listTasks, newRequestId, setTaskStatus, updateTask } from '../utils/tasksClient';

const GROUP_LABEL = { overdue: ['באיחור', 'Overdue'], today: ['היום', 'Today'], upcoming: ['בהמשך', 'Upcoming'], noDate: ['ללא תאריך יעד', 'No due date'] };
const PRIORITY_LABEL = { high: ['עדיפות גבוהה', 'High priority'], normal: ['עדיפות רגילה', 'Normal priority'], low: ['עדיפות נמוכה', 'Low priority'] };
const PRIORITY_OPTION = { high: ['גבוהה', 'High'], normal: ['רגילה', 'Normal'], low: ['נמוכה', 'Low'] };
const ERROR_TEXT = {
  title_required: ['הזינו כותרת למשימה.', 'Enter a task title.'],
  title_too_long: [`הכותרת ארוכה מ-${TASK_TITLE_MAX} תווים.`, `The title is longer than ${TASK_TITLE_MAX} characters.`],
  notes_too_long: [`ההערות ארוכות מ-${TASK_NOTES_MAX} תווים.`, `The notes are longer than ${TASK_NOTES_MAX} characters.`],
  invalid_priority: ['יש לבחור עדיפות מהרשימה.', 'Choose a priority from the list.'],
  invalid_date: ['תאריך היעד אינו תקין.', 'The due date is not valid.'],
  invalid_time: ['השעה אינה תקינה.', 'The time is not valid.'],
  time_without_date: ['כדי לקבוע שעה יש לבחור קודם תאריך יעד.', 'Choose a due date before setting a time.'],
  link_not_allowed: ['ההצעה או הלקוח שנבחרו אינם זמינים בחשבון זה.', 'The selected quote or client is not available in this account.'],
  follow_up_unavailable: ['כדי לשמור משימת מעקב נדרש עדכון שרת שעדיין לא הותקן. דבר לא נשמר, והפרטים שהקלדתם נשארו בטופס. אפשר לשמור שוב אחרי העדכון. אפשר ליצור משימה רגילה כרגיל.', 'Saving a follow-up needs a server update that is not installed yet. Nothing was saved - what you typed is kept and you can save again after the update. Ordinary tasks work as usual.'],
  follow_up_exists: ['כבר יש משימת מעקב פתוחה להצעה הזו. אפשר לפתוח אותה, או להשלים אותה לפני פתיחת מעקב נוסף.', 'An open follow-up already exists for this quote. Open it, or complete it before opening another one.'],
  not_allowed: ['אין הרשאה לפעולה זו. התחברו מחדש ונסו שוב.', 'This action is not allowed. Sign in again and retry.'],
  not_signed_in: ['יש להתחבר כדי לנהל משימות.', 'Sign in to manage tasks.'],
  unavailable: ['שירות המשימות אינו זמין כרגע. נסו שוב מאוחר יותר.', 'Tasks are not available right now. Try again later.'],
  network: ['בעיית תקשורת - הפעולה לא נשמרה. בדקו את החיבור ונסו שוב.', 'Connection problem - nothing was saved. Check your connection and try again.'],
  invalid: ['המשימה לא נשמרה - בדקו את השדות ונסו שוב.', 'The task was not saved - check the fields and try again.'],
  unknown: ['הפעולה לא הושלמה ולא נשמרה. נסו שוב.', 'The action did not complete and nothing was saved. Try again.'],
};
const EMPTY_FORM = Object.freeze({ title: '', notes: '', priority: 'normal', due_date: '', due_date_text: '', due_time: '', quote_id: '', client_id: '' });

const TASKS_CSS = `
  .pf-tasks-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
  .pf-tasks-new { display: inline-flex; align-items: center; gap: 6px; min-block-size: 36px; padding-inline: 14px; border: none; border-radius: ${RADIUS.sm}; background: ${NEON.violet}; color: #fff; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
  .pf-tasks-views { display: inline-flex; gap: 4px; margin-block: 12px 12px; }
  .pf-tasks-view { min-block-size: 32px; padding-inline: 12px; border-radius: ${RADIUS.sm}; border: 1px solid ${NEON.borderStrong}; background: ${NEON.bgInput}; color: ${NEON.textPrimary}; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
  .pf-tasks-view[aria-pressed="true"] { background: ${NEON.violet}; border-color: ${NEON.violet}; color: #fff; }
  .pf-tasks-form { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px 12px; padding: 14px; margin-block-end: 12px; border-radius: 10px; border: 1px solid ${NEON.border}; background: ${NEON.bgCardAlt}; }
  .pf-tasks-field { display: flex; flex-direction: column; gap: 4px; min-inline-size: 0; font-size: 0.75rem; font-weight: 600; color: ${NEON.textSecondary}; }
  .pf-tasks-field--full { grid-column: 1 / -1; }
  .pf-tasks-field--third { grid-column: span 2; }
  .pf-tasks-field--half { grid-column: span 3; }
  .pf-tasks-field input, .pf-tasks-field select, .pf-tasks-field textarea { box-sizing: border-box; inline-size: 100%; min-block-size: 36px; padding: 6px 10px; border-radius: ${RADIUS.sm}; border: 1px solid ${NEON.borderStrong}; background: ${NEON.bgInput}; color: ${NEON.textPrimary}; font: inherit; font-size: 0.85rem; font-weight: 500; }
  .pf-tasks-field textarea { min-block-size: 64px; resize: vertical; }
  .pf-tasks-field input[name="due_date_text"], .pf-tasks-field input[name="due_time"] { direction: ltr; text-align: left; }
  .pf-tasks-hint { font-weight: 500; color: ${NEON.textMuted}; direction: ltr; unicode-bidi: isolate; }
  .pf-tasks-date { position: relative; display: flex; align-items: center; }
  .pf-tasks-date input[name="due_date_text"] { padding-right: 38px; }
  .pf-tasks-picker { position: absolute; opacity: 0; pointer-events: none; inline-size: 0; block-size: 0; border: 0; padding: 0; }
  .pf-tasks-cal { position: absolute; right: 4px; display: inline-flex; align-items: center; justify-content: center; inline-size: 30px; block-size: 30px; padding: 0; border: none; background: transparent; color: ${NEON.textMuted}; cursor: pointer; }
  .pf-tasks-form-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .pf-tasks-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-block-size: 36px; padding-inline: 14px; border-radius: ${RADIUS.sm}; border: 1px solid ${NEON.border}; background: ${NEON.bgCard}; color: ${NEON.textSecondary}; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
  .pf-tasks-btn--primary { background: ${NEON.violet}; border-color: ${NEON.violet}; color: #fff; }
  .pf-tasks-btn[disabled] { opacity: 0.6; cursor: default; }
  .pf-tasks-errors { grid-column: 1 / -1; margin: 0; padding: 8px 12px; border-radius: ${RADIUS.sm}; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.78rem; font-weight: 600; list-style: none; }
  .pf-tasks-note { font-size: 0.72rem; color: ${NEON.textMuted}; }
  .pf-tasks-state { padding: 14px 4px; font-size: 0.85rem; color: ${NEON.textSecondary}; }
  .pf-tasks-alert { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; border-radius: ${RADIUS.sm}; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.8rem; font-weight: 600; }
  .pf-tasks-group { margin-block-end: 14px; }
  .pf-tasks-group-title { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 0.85rem; font-weight: 800; color: ${NEON.textPrimary}; }
  .pf-tasks-group[data-group="overdue"] .pf-tasks-group-title { color: #b42318; }
  .pf-tasks-list { display: flex; flex-direction: column; gap: 8px; }
  .pf-task { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 8px 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid ${NEON.border}; border-inline-start: 3px solid ${NEON.border}; background: ${NEON.bgCard}; }
  .pf-task[data-priority="high"] { border-inline-start-color: #d92d20; }
  .pf-task[data-group="overdue"] { background: #fff7f6; }
  .pf-task-toggle { display: inline-flex; align-items: center; justify-content: center; inline-size: 32px; block-size: 32px; padding: 0; border: none; border-radius: 50%; background: transparent; color: ${NEON.textMuted}; cursor: pointer; }
  .pf-task[data-status="completed"] .pf-task-toggle { color: #1f7a4d; }
  .pf-task-main { min-inline-size: 0; }
  .pf-task-title { margin: 0; font-size: 0.88rem; font-weight: 700; color: ${NEON.textPrimary}; overflow-wrap: anywhere; }
  .pf-task[data-status="completed"] .pf-task-title { text-decoration: line-through; color: ${NEON.textMuted}; }
  .pf-task-notes { margin: 2px 0 0; font-size: 0.78rem; color: ${NEON.textSecondary}; white-space: pre-line; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
  .pf-task-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-block-start: 6px; font-size: 0.75rem; color: ${NEON.textSecondary}; }
  .pf-task-due { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; }
  .pf-task[data-group="overdue"] .pf-task-due { color: #b42318; }
  .pf-task-chip { padding: 1px 8px; border-radius: 999px; background: ${NEON.bgCardAlt}; border: 1px solid ${NEON.border}; font-weight: 600; }
  .pf-task-chip[data-priority="high"] { background: #fef3f2; border-color: #fecdca; color: #b42318; }
  .pf-task-link { min-inline-size: 0; overflow-wrap: anywhere; }
  .pf-task-actions { display: flex; gap: 4px; }
  .pf-task-action { display: inline-flex; align-items: center; justify-content: center; inline-size: 32px; block-size: 32px; padding: 0; border-radius: ${RADIUS.sm}; border: 1px solid ${NEON.border}; background: ${NEON.bgCardAlt}; color: ${NEON.textSecondary}; cursor: pointer; }
  .pf-task-action[disabled], .pf-task-toggle[disabled] { opacity: 0.5; cursor: default; }
  .pf-task-error { grid-column: 1 / -1; font-size: 0.75rem; font-weight: 600; color: #991b1b; }
  @media (max-width: 900px) {
    .pf-tasks-field--third { grid-column: span 3; }
  }
  @media (max-width: 560px) {
    .pf-tasks-form { grid-template-columns: minmax(0, 1fr); padding: 12px; }
    .pf-tasks-field--third, .pf-tasks-field--half { grid-column: 1 / -1; }
    .pf-tasks-new, .pf-tasks-view, .pf-tasks-btn, .pf-tasks-field input, .pf-tasks-field select { min-block-size: 40px; }
    .pf-task { grid-template-columns: auto minmax(0, 1fr); }
    .pf-task-actions { grid-column: 1 / -1; justify-content: flex-end; }
    .pf-task-toggle, .pf-task-action { inline-size: 40px; block-size: 40px; }
  }
`;

// PRODUCT_TRUTH_CAPABILITY: manual_tasks
export default function TasksTab({
  userId, isHebrew, isLocalIsraeliBusiness, quotes = [], clients = [], onStatus, followUpDraft = null, onFollowUpConsumed, client, now = null,
  openTaskId = null, onOpenTaskConsumed,
}) {
  const L = useCallback((pair) => (isHebrew ? pair[0] : pair[1]), [isHebrew]);
  const market = taskMarket(isLocalIsraeliBusiness === true); // the authenticated account market - never the UI language
  const [tasks, setTasks] = useState([]);
  const [load, setLoad] = useState({ state: 'loading', code: null });
  const [view, setView] = useState('open');
  const [form, setForm] = useState(null); // { mode, id, values, errors, saving, saveError }
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState(null); // { id, code }
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const pickerRef = useRef(null);
  const titleRef = useRef(null);
  const formKey = form ? `${form.mode}:${form.id || ''}` : null;
  // an opened form takes the focus (and so scrolls into view inside the scroll owner) - create, edit and the hot-quote follow-up
  useEffect(() => { if (formKey && titleRef.current) titleRef.current.focus(); }, [formKey]);
  const say = useCallback((text) => { if (typeof onStatus === 'function') onStatus({ text, type: 'success' }); }, [onStatus]);
  const errorText = useCallback((code) => L(ERROR_TEXT[code] || ERROR_TEXT.unknown), [L]);

  const reload = useCallback(async () => {
    setLoad({ state: 'loading', code: null });
    const r = await listTasks(client, userId);
    if (r.ok) { setTasks(r.data); setLoad({ state: 'ready', code: null }); } else setLoad({ state: 'error', code: r.error.code });
  }, [client, userId]);
  useEffect(() => { reload(); }, [reload]);

  // A follow-up from a hot quote opens the form pre-linked to that quote and its client; nothing is created until Save.
  // Task 27 (spec §6 follow-up): no duplicate - when an OPEN task is already linked to that quote, that task opens instead (manual,
  // nothing created); the check waits for the persisted rows so it never misses an existing task.
  const consumedDraftRef = useRef(null); // Task 28: each follow-up draft is handled exactly once (later task-list changes never re-run it)
  useEffect(() => {
    if (!followUpDraft?.quote_id) return;
    if (load.state === 'loading') return;
    if (consumedDraftRef.current === followUpDraft) return;
    consumedDraftRef.current = followUpDraft;
    // Task 28: only an open FOLLOW-UP of that quote counts (ordinary tasks on the same quote are allowed); rows from a server without
    // the kind column (no follow-up marking) keep the Task 27 rule: any open task linked to the quote opens instead
    const kindKnown = tasks.some((t) => Object.prototype.hasOwnProperty.call(t, 'kind'));
    const existing = load.state === 'ready'
      ? tasks.find((t) => t.quote_id === followUpDraft.quote_id && t.status !== 'completed' && (!kindKnown || t.kind === 'follow_up')) : null;
    if (existing) {
      setView('open');
      openEdit(existing);
      say(L(['כבר יש משימת מעקב פתוחה להצעה הזו, והיא נפתחה לעריכה.', 'An open follow-up task already exists for this quote; it was opened for editing.']));
      if (typeof onFollowUpConsumed === 'function') onFollowUpConsumed();
      return;
    }
    const q = quotes.find((x) => x.id === followUpDraft.quote_id);
    const number = q ? displayQuoteNumber(q) : '';
    setForm({
      mode: 'create', id: null, saving: false, saveError: null, errors: [],
      // the request id is created ONCE per follow-up form: every retry of this form is the same server request (no duplicate)
      followUp: true, requestId: newRequestId(), conflict: null,
      values: { ...EMPTY_FORM, quote_id: followUpDraft.quote_id, client_id: followUpDraft.client_id || '', title: number ? L([`מעקב אחרי הצעה ${number}`, `Follow up on quote ${number}`]) : '' },
    });
    setView('open');
    if (typeof onFollowUpConsumed === 'function') onFollowUpConsumed();
  }, [followUpDraft, quotes, L, onFollowUpConsumed, load.state, tasks, say]); // eslint-disable-line react-hooks/exhaustive-deps

  // Task 19: a task chosen in the Calendar opens here, in this screen's own existing edit form, once the persisted rows are loaded
  useEffect(() => {
    if (!openTaskId || load.state !== 'ready') return;
    const task = tasks.find((t) => t.id === openTaskId);
    if (task) { setView(task.status === 'completed' ? 'completed' : 'open'); openEdit(task); }
    if (typeof onOpenTaskConsumed === 'function') onOpenTaskConsumed();
  }, [openTaskId, load.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => groupTasks(tasks, { market, now: now ?? new Date() }), [tasks, market, now]);
  const openCount = TASK_GROUPS.reduce((n, g) => n + groups[g].length, 0);
  const quoteById = useMemo(() => new Map(quotes.map((q) => [q.id, q])), [quotes]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const quoteOptions = useMemo(() => [...quotes].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))), [quotes]);
  const clientOptions = useMemo(() => [...clients].sort((a, b) => String(a.company_name || '').localeCompare(String(b.company_name || ''))), [clients]);

  const replaceTask = (row) => setTasks((list) => (list.some((t) => t.id === row.id) ? list.map((t) => (t.id === row.id ? row : t)) : [...list, row]));
  const openCreate = () => { setForm({ mode: 'create', id: null, values: { ...EMPTY_FORM }, errors: [], saving: false, saveError: null }); setView('open'); };
  const openEdit = (task) => setForm({
    mode: 'edit', id: task.id, errors: [], saving: false, saveError: null,
    values: {
      title: task.title || '', notes: task.notes || '', priority: task.priority || 'normal', due_date: task.due_date || '', due_date_text: task.due_date ? formatShortDate(task.due_date, market) : '',
      due_time: shortTime(task.due_time) || '', quote_id: task.quote_id || '', client_id: task.client_id || '',
    },
  });
  const setField = (k, v) => setForm((f) => {
    const values = { ...f.values, [k]: v };
    // date entry in the ACCOUNT market's order (IRON-DATE-001); an unparseable entry is kept as typed and refused on Save
    if (k === 'due_date_text') { const t = String(v || '').trim(); values.due_date = t ? (parseMarketDate(t, market) || t) : ''; }
    if (k === 'due_date') values.due_date_text = v ? formatShortDate(v, market) : '';
    if (!values.due_date) values.due_time = '';
    // choosing a quote links its client too when no client was picked (the user can still change it)
    if (k === 'quote_id' && v && !f.values.client_id) { const q = quoteById.get(v); if (q?.client_id && clientById.has(q.client_id)) values.client_id = q.client_id; }
    return { ...f, values, errors: [] };
  });

  async function save(e) {
    e.preventDefault();
    if (!form || form.saving) return;
    const n = normalizeTaskInput(form.values);
    if (!n.ok) { setForm((f) => ({ ...f, errors: n.errors, saveError: null })); return; }
    setForm((f) => ({ ...f, saving: true, errors: [], saveError: null }));
    const r = form.mode === 'edit' ? await updateTask(client, userId, form.id, form.values)
      : form.followUp && form.values.quote_id ? await createFollowUpTask(client, userId, form.values, form.requestId) : await createTask(client, userId, form.values);
    // a failure keeps everything typed in the form (and, for a follow-up, its request id: the retry is the same request)
    if (!r.ok) { setForm((f) => (f ? { ...f, saving: false, errors: r.errors || [], saveError: r.errors ? null : r.error.code } : f)); return; }
    if (r.created === false && r.reason === 'existing_open_follow_up') {
      // another window created the open follow-up first: show it, keep this form's content; nothing new was written
      replaceTask(r.data);
      setForm((f) => (f ? { ...f, saving: false, conflict: r.data } : f));
      return;
    }
    replaceTask(r.data);
    setForm(null);
    say(form.mode === 'edit' ? L(['המשימה עודכנה', 'Task updated']) : L(['המשימה נשמרה', 'Task saved']));
  }

  async function toggle(task) {
    if (busyId) return;
    const next = task.status === 'completed' ? 'open' : 'completed';
    setBusyId(task.id); setRowError(null);
    const r = await setTaskStatus(client, userId, task.id, next);
    setBusyId(null);
    if (!r.ok) { setRowError({ id: task.id, code: r.error.code }); return; }
    replaceTask(r.data);
    say(next === 'completed' ? L(['המשימה סומנה כהושלמה', 'Task marked as done']) : L(['המשימה נפתחה מחדש', 'Task reopened']));
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true); setRowError(null);
    const r = await deleteTask(client, userId, pendingDelete.id);
    setDeleting(false);
    const id = pendingDelete.id;
    setPendingDelete(null);
    if (!r.ok) { setRowError({ id, code: r.error.code }); return; }
    setTasks((list) => list.filter((t) => t.id !== id));
    if (form?.id === id) setForm(null);
    say(L(['המשימה נמחקה', 'Task deleted']));
  }

  const dueText = (task) => {
    if (!task.due_date) return null;
    const time = shortTime(task.due_time);
    return (
      <span className="pf-task-due">
        <Calendar size={13} aria-hidden="true" />
        <bdi className="pf-num" dir="ltr" data-testid="task-due-date">{formatShortDate(task.due_date, market)}</bdi>
        {time && <bdi className="pf-num" dir="ltr" data-testid="task-due-time">{time}</bdi>}
      </span>
    );
  };

  const renderTask = (task, group) => {
    const q = task.quote_id ? quoteById.get(task.quote_id) : null;
    const c = task.client_id ? clientById.get(task.client_id) : null;
    const done = task.status === 'completed';
    const busy = busyId === task.id;
    return (
      <div key={task.id} className="pf-task" data-task-id={task.id} data-group={group} data-status={task.status} data-priority={task.priority}>
        {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
        <button type="button" className="pf-task-toggle" onClick={() => toggle(task)} disabled={busy}
          aria-label={done ? L(['פתיחה מחדש של המשימה', 'Reopen task']) : L(['סימון המשימה כהושלמה', 'Mark task as done'])}
          title={done ? L(['פתיחה מחדש', 'Reopen']) : L(['סימון כהושלמה', 'Mark as done'])}>
          {done ? <CheckCircle2 size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
        </button>
        <div className="pf-task-main">
          <p className="pf-task-title">{task.title}</p>
          {task.notes && <p className="pf-task-notes">{task.notes}</p>}
          <div className="pf-task-meta">
            {dueText(task)}
            <span className="pf-task-chip" data-priority={task.priority}>{L(PRIORITY_LABEL[task.priority] || PRIORITY_LABEL.normal)}</span>
            {q && (
              <span className="pf-task-link" data-testid="task-quote-link">
                {L(['הצעה ', 'Quote '])}<bdi className="pf-num" dir="ltr">{displayQuoteNumber(q)}</bdi>
                {quotePartyLabel(q).kind === 'client' ? ` · ${quotePartyLabel(q).text}` : ''}
              </span>
            )}
            {c && (!q || q.client_id !== c.id) && <span className="pf-task-link" data-testid="task-client-link">{L(['לקוח: ', 'Client: '])}{c.company_name}</span>}
            {done && task.completed_at && (
              <span>{L(['הושלמה ב-', 'Done on '])}<bdi className="pf-num" dir="ltr">{formatShortDate(task.completed_at, market)}</bdi></span>
            )}
          </div>
        </div>
        <div className="pf-task-actions">
          {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
          <button type="button" className="pf-task-action" onClick={() => openEdit(task)} disabled={busy} aria-label={L(['עריכת המשימה', 'Edit task'])} title={L(['עריכה', 'Edit'])}>
            <Pencil size={15} aria-hidden="true" />
          </button>
          {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
          <button type="button" className="pf-task-action" onClick={() => setPendingDelete(task)} disabled={busy} aria-label={L(['מחיקת המשימה', 'Delete task'])} title={L(['מחיקה', 'Delete'])}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
        {rowError?.id === task.id && <div className="pf-task-error" role="alert">{errorText(rowError.code)}</div>}
      </div>
    );
  };

  const v = form?.values;
  return (
    <div className="pf-screen pf-work-screen pf-tasks" data-testid="tasks-screen" style={{ background: NEON.bgCard, padding: '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm }}>
      <style>{TASKS_CSS}</style>
      <div className="pf-tasks-head">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
            <ListChecks size={18} color={NEON.textSecondary} strokeWidth={2} aria-hidden="true" />
            {L(['משימות', 'Tasks'])}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: NEON.textSecondary }}>
            {L(['משימות ידניות שנשמרות בחשבון שלך וזמינות בכל מכשיר', 'Manual tasks saved to your account and available on every device'])}
          </p>
        </div>
        {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
        <button type="button" className="pf-tasks-new" data-testid="tasks-new" onClick={openCreate}>
          <Plus size={16} aria-hidden="true" />{L(['משימה חדשה', 'New task'])}
        </button>
      </div>

      <div className="pf-tasks-views" role="group" aria-label={L(['תצוגת משימות', 'Task view'])}>
        {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
        <button type="button" className="pf-tasks-view" aria-pressed={view === 'open'} data-view="open" onClick={() => setView('open')}>
          {L(['פתוחות', 'Open'])} <bdi className="pf-num" dir="ltr">{`(${openCount})`}</bdi>
        </button>
        {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
        <button type="button" className="pf-tasks-view" aria-pressed={view === 'completed'} data-view="completed" onClick={() => setView('completed')}>
          {L(['הושלמו', 'Completed'])} <bdi className="pf-num" dir="ltr">{`(${groups.completed.length})`}</bdi>
        </button>
      </div>

      <div className="pf-screen-body" data-testid="tasks-body">
        {/* the form scrolls with the list inside the ONE scroll owner (.pf-screen-body) - never a static block that can overflow */}
        {form && (
          <form className="pf-tasks-form" data-testid="task-form" data-mode={form.mode} onSubmit={save} noValidate aria-label={form.mode === 'edit' ? L(['עריכת משימה', 'Edit task']) : L(['משימה חדשה', 'New task'])}>
            <label className="pf-tasks-field pf-tasks-field--full">
              {L(['כותרת', 'Title'])}
              {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
              <input ref={titleRef} type="text" name="title" value={v.title} maxLength={TASK_TITLE_MAX} onChange={(e) => setField('title', e.target.value)} required aria-invalid={form.errors.some((x) => x.startsWith('title'))} />
            </label>
            <label className="pf-tasks-field pf-tasks-field--full">
              {L(['הערות (לא חובה)', 'Notes (optional)'])}
              {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
              <textarea name="notes" value={v.notes} maxLength={TASK_NOTES_MAX} onChange={(e) => setField('notes', e.target.value)} />
            </label>
            <label className="pf-tasks-field pf-tasks-field--third">
              {L(['עדיפות', 'Priority'])}
              {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
              <select name="priority" value={v.priority} onChange={(e) => setField('priority', e.target.value)}>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{L(PRIORITY_OPTION[p])}</option>)}
              </select>
            </label>
            {/* IRON-DATE-001: the due date is typed and shown in the ACCOUNT market's order (the same order as every short date); the
                hidden native picker only feeds the date-only value, so neither the browser locale nor the UI language decides the order */}
            <div className="pf-tasks-field pf-tasks-field--third">
              <label htmlFor="pf-task-due-date">{L(['תאריך יעד (לא חובה)', 'Due date (optional)'])} <span className="pf-tasks-hint">{marketDatePattern(market)}</span></label>
              <span className="pf-tasks-date">
                {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
                <input id="pf-task-due-date" type="text" name="due_date_text" dir="ltr" inputMode="numeric" autoComplete="off" placeholder={marketDatePattern(market)}
                  value={v.due_date_text} onChange={(e) => setField('due_date_text', e.target.value)} aria-invalid={form.errors.includes('invalid_date')} />
                {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
                <input ref={pickerRef} type="date" className="pf-tasks-picker" tabIndex={-1} aria-hidden="true" value={isCalendarDate(v.due_date) ? v.due_date : ''}
                  onChange={(e) => setField('due_date', e.target.value)} />
                {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
                <button type="button" className="pf-tasks-cal" aria-label={L(['פתיחת לוח שנה', 'Open calendar'])} title={L(['לוח שנה', 'Calendar'])}
                  onClick={() => { const p = pickerRef.current; if (p && typeof p.showPicker === 'function') { try { p.showPicker(); } catch { p.click(); } } else if (p) p.click(); }}>
                  <Calendar size={16} aria-hidden="true" />
                </button>
              </span>
            </div>
            <label className="pf-tasks-field pf-tasks-field--third">
              <span>{L(['שעה (לא חובה)', 'Time (optional)'])} <span className="pf-tasks-hint">HH:MM</span></span>
              {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
              <input type="text" name="due_time" dir="ltr" inputMode="numeric" autoComplete="off" placeholder="HH:MM" maxLength={5} value={v.due_time}
                disabled={!v.due_date} onChange={(e) => setField('due_time', e.target.value)} aria-invalid={form.errors.includes('invalid_time')} />
            </label>
            <label className="pf-tasks-field pf-tasks-field--half">
              {L(['הצעת מחיר מקושרת (לא חובה)', 'Linked quote (optional)'])}
              {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
              <select name="quote_id" value={v.quote_id} onChange={(e) => setField('quote_id', e.target.value)}>
                <option value="">{L(['ללא', 'None'])}</option>
                {quoteOptions.map((q) => <option key={q.id} value={q.id}>{`${displayQuoteNumber(q)} · ${quotePartyLabel(q).text}`}</option>)}
              </select>
            </label>
            <label className="pf-tasks-field pf-tasks-field--half">
              {L(['לקוח מקושר (לא חובה)', 'Linked client (optional)'])}
              {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
              <select name="client_id" value={v.client_id} onChange={(e) => setField('client_id', e.target.value)}>
                <option value="">{L(['ללא', 'None'])}</option>
                {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.company_name || '—'}</option>)}
              </select>
            </label>
            {form.conflict && (
              <div className="pf-tasks-alert" role="alert" data-testid="task-follow-up-conflict">
                <span>{L(['כבר נוצרה משימת מעקב פתוחה להצעה הזו (בחלון אחר). לא נוצרה משימה נוספת, ומה שהקלדתם כאן נשאר.', 'An open follow-up for this quote was already created (in another window). No second task was created, and what you typed here is kept.'])}</span>
                {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
                <button type="button" className="pf-tasks-btn" data-testid="task-open-existing-follow-up" onClick={() => openEdit(form.conflict)}>{L(['פתיחת משימת המעקב הקיימת', 'Open the existing follow-up'])}</button>
              </div>
            )}
            {(form.errors.length > 0 || form.saveError) && (
              <ul className="pf-tasks-errors" role="alert" data-testid="task-form-errors">
                {form.errors.map((code) => <li key={code}>{errorText(code)}</li>)}
                {form.saveError && <li>{errorText(form.saveError)}</li>}
              </ul>
            )}
            <div className="pf-tasks-form-actions">
              <span className="pf-tasks-note">{/* QA 2026-10-25 (C4): a due task does appear in the bell - only nothing is sent to anyone */}{L(['לא נשלחים מייל או וואטסאפ. משימה שהגיע מועדה מופיעה בפעמון.', 'No email or WhatsApp is sent. A task that is due appears in the bell.'])}</span>
              {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
              <button type="button" className="pf-tasks-btn" onClick={() => setForm(null)} disabled={form.saving}>{L(['ביטול', 'Cancel'])}</button>
              {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
              <button type="submit" className="pf-tasks-btn pf-tasks-btn--primary" data-testid="task-save" disabled={form.saving}>
                {form.saving ? L(['שומר…', 'Saving...']) : L(['שמירה', 'Save'])}
              </button>
            </div>
          </form>
        )}
        {load.state === 'loading' && <div className="pf-tasks-state" role="status" data-testid="tasks-loading">{L(['טוען משימות…', 'Loading tasks...'])}</div>}
        {load.state === 'error' && (
          <div className="pf-tasks-alert" role="alert" data-testid="tasks-load-error">
            <span>{errorText(load.code)}</span>
            {/* PRODUCT_TRUTH_CAPABILITY: manual_tasks */}
            <button type="button" className="pf-tasks-btn" onClick={reload}><RotateCcw size={14} aria-hidden="true" />{L(['נסו שוב', 'Try again'])}</button>
          </div>
        )}
        {load.state === 'ready' && view === 'open' && (openCount === 0 ? (
          <div className="pf-tasks-state" data-testid="tasks-empty-open">{L(['אין משימות פתוחות. לחצו על "משימה חדשה" כדי להוסיף.', 'No open tasks. Choose "New task" to add one.'])}</div>
        ) : TASK_GROUPS.filter((g) => groups[g].length > 0).map((g) => (
          <section key={g} className="pf-tasks-group" data-group={g} aria-label={L(GROUP_LABEL[g])}>
            <h3 className="pf-tasks-group-title">{L(GROUP_LABEL[g])} <bdi className="pf-num" dir="ltr">{`(${groups[g].length})`}</bdi></h3>
            <div className="pf-tasks-list">{groups[g].map((t) => renderTask(t, g))}</div>
          </section>
        )))}
        {load.state === 'ready' && view === 'completed' && (groups.completed.length === 0 ? (
          <div className="pf-tasks-state" data-testid="tasks-empty-completed">{L(['עדיין אין משימות שהושלמו.', 'No completed tasks yet.'])}</div>
        ) : (
          <section className="pf-tasks-group" data-group="completed" aria-label={L(['הושלמו', 'Completed'])}>
            <div className="pf-tasks-list">{groups.completed.map((t) => renderTask(t, 'completed'))}</div>
          </section>
        ))}
      </div>

      <DeleteConfirmModal
        isOpen={pendingDelete !== null}
        isHebrew={isHebrew}
        title={L(['למחוק את המשימה?', 'Delete this task?'])}
        message={pendingDelete ? L([`"${pendingDelete.title}" תימחק לצמיתות.`, `"${pendingDelete.title}" will be permanently deleted.`]) : ''}
        confirmLabel={L(['מחיקה', 'Delete'])}
        cancelLabel={L(['ביטול', 'Cancel'])}
        isDeleting={deleting}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
