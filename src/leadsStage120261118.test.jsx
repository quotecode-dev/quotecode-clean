// Leads stage 1 (Owner console 2026-11-18, typed: "מאשר את שלב 1 של הפניות: רישום ההדגמה מ-18/11 בחוק 50 כולל רענון הנעילה, מיגרציה עם
// גיבוי, ושינוי ב-L-07, L-10, L-15, L-17 ו-L-18, ושחרור עד הלייב"). Guards: the Leads tab lives INSIDE Clients (Clients stays the default
// tab, no new menu entry), the data path is owner-scoped and confirms every write, a lead needs a name and a phone or an email, "not
// relevant" removes the open follow-up task, the follow-up is a regular task, the details view and the window close on Escape (L-15 Back),
// and the leads never load from Dashboard.loadData (L-10).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ClientsTab from './components/ClientsTab';
import { normalizeLeadInput, createLead, setLeadStatus, listLeads, followUpTitle, MANUAL_LEAD_STATUSES } from './utils/leadsClient';
import { marketInstant } from './components/leads/useLeads';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, rel), 'utf8');
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// a tiny Supabase stand-in: records every call, answers from the given rows
function fakeClient({ leads = [], tasks = [], events = [] } = {}) {
  const calls = [];
  const store = { leads: leads.map((l) => ({ ...l })), tasks: tasks.map((t) => ({ ...t })), lead_events: events.map((e) => ({ ...e })) };
  const from = (table) => {
    const q = { table, filters: [], op: 'select', payload: null };
    const run = () => {
      calls.push({ table: q.table, op: q.op, payload: q.payload, filters: q.filters });
      const rows = store[q.table] || [];
      const match = (r) => q.filters.every(([k, v, kind]) => (kind === 'in' ? v.includes(r[k]) : r[k] === v));
      if (q.op === 'insert') { const row = { id: `${q.table}-${rows.length + 1}`, created_at: '2026-11-18T10:00:00Z', status: q.table === 'leads' ? 'new' : 'open', ...q.payload }; rows.push(row); return { data: row, error: null }; }
      if (q.op === 'update') { const r = rows.find(match); if (!r) return { data: null, error: { message: 'not found' } }; Object.assign(r, q.payload); return { data: { ...r }, error: null }; }
      if (q.op === 'delete') { const gone = rows.filter(match); store[q.table] = rows.filter((r) => !match(r)); return { data: gone.map((r) => ({ id: r.id })), error: null }; }
      return { data: rows.filter(match), error: null };
    };
    const chain = {
      select: () => chain, order: () => chain,
      eq: (k, v) => { q.filters.push([k, v]); return chain; },
      in: (k, v) => { q.filters.push([k, v, 'in']); return chain; },
      insert: (p) => { q.op = 'insert'; q.payload = p; return chain; },
      update: (p) => { q.op = 'update'; q.payload = p; return chain; },
      delete: () => { q.op = 'delete'; return chain; },
      single: () => Promise.resolve(run()),
      then: (res, rej) => Promise.resolve(run()).then(res, rej),
    };
    return chain;
  };
  return { from, calls, store };
}

describe('the lead form rule (the demo): a name and at least a phone or an email', () => {
  it('accepts a phone or an email alone; refuses a missing name or no contact; trims and bounds', () => {
    expect(normalizeLeadInput({ name: 'Dana', phone: '052' }).ok).toBe(true);
    expect(normalizeLeadInput({ name: 'Dana', email: 'd@x.co' }).ok).toBe(true);
    expect(normalizeLeadInput({ name: '', phone: '052' }).ok).toBe(false);
    expect(normalizeLeadInput({ name: 'Dana' }).ok).toBe(false);
    const n = normalizeLeadInput({ name: '  Dana   Cohen ', phone: ' 052 ', source: 'tv' });
    expect(n.value).toMatchObject({ name: 'Dana Cohen', phone: '052', source: 'none' });
    expect(MANUAL_LEAD_STATUSES).toEqual(['new', 'prog', 'off']);
  });
});

describe('the data path is owner-scoped and the follow-up is a regular task', () => {
  it('createLead with a follow-up date creates a task, links it and returns the persisted rows', async () => {
    const c = fakeClient();
    const res = await createLead(c, 'u1', { name: 'Dana Cohen, 14 Herzl', phone: '052' }, { followUp: { date: '2026-11-19' }, isHebrew: true });
    expect(res.ok).toBe(true);
    expect(res.data.followUp).toMatchObject({ title: 'חזרה לפנייה של Dana Cohen', due_date: '2026-11-19' });
    expect(c.store.leads[0].next_task_id).toBe(res.data.followUp.id);
    expect(c.calls.filter((x) => x.op === 'insert').map((x) => x.table)).toEqual(['leads', 'tasks']);
    expect(c.calls.find((x) => x.table === 'leads' && x.op === 'insert').payload.user_id).toBe('u1');
    expect(followUpTitle({ name: 'Sarah Miller' }, false)).toBe('Follow up with Sarah Miller');
  });
  it('"not relevant" removes the open follow-up task and clears the link; no contact entry is added', async () => {
    const c = fakeClient({ leads: [{ id: 'l1', user_id: 'u1', name: 'Dana', phone: '1', status: 'new', next_task_id: 't1' }], tasks: [{ id: 't1', user_id: 'u1', title: 'x', status: 'open', due_date: '2026-11-19' }] });
    const res = await setLeadStatus(c, 'u1', { id: 'l1', next_task_id: 't1', status: 'new' }, 'off');
    expect(res.ok).toBe(true);
    expect(res.data).toMatchObject({ status: 'off', next_task_id: null, followUp: null });
    expect(c.store.tasks).toHaveLength(0);
    expect(c.calls.some((x) => x.table === 'lead_events')).toBe(false);
    expect((await setLeadStatus(c, 'u1', { id: 'l1' }, 'sent')).ok).toBe(false); // "quote sent" is never chosen by hand
  });
  it('listLeads attaches only an OPEN follow-up task', async () => {
    const c = fakeClient({ leads: [{ id: 'l1', user_id: 'u1', name: 'A', phone: '1', status: 'new', next_task_id: 't1' }, { id: 'l2', user_id: 'u1', name: 'B', phone: '2', status: 'prog', next_task_id: 't2' }],
      tasks: [{ id: 't1', user_id: 'u1', status: 'open', due_date: '2026-11-20' }, { id: 't2', user_id: 'u1', status: 'completed', due_date: '2026-11-10' }] });
    const res = await listLeads(c, 'u1');
    expect(res.data.find((l) => l.id === 'l1').followUp).toMatchObject({ id: 't1' });
    expect(res.data.find((l) => l.id === 'l2').followUp).toBeNull();
  });
  it('no session = no query (never an anonymous read that RLS would answer with nothing)', async () => {
    const c = fakeClient();
    expect((await listLeads(c, null)).error.code).toBe('not_signed_in');
    expect(c.calls).toHaveLength(0);
  });
  it('a typed entry time is read in the market time zone', () => {
    expect(marketInstant('2026-11-18', '08:30', 'Local')).toBe('2026-11-18T06:30:00.000Z');
    expect(marketInstant('bad', '08:30', 'Local')).toBeNull();
  });
});

const base = { filteredClients: [{ id: 'c1', company_name: 'Saved Co', client_type: 'business' }], setClientSearchTerm: vi.fn(), handleClientSort: vi.fn(), setEditingClient: vi.fn(), handleDeleteClient: vi.fn(), onCreateClient: vi.fn(), quotes: [], isHebrew: true };

describe('the Clients screen: the Leads tab (decision 2 "א")', () => {
  it('without leadsApi nothing changes (no tabs); with it Clients is the default tab and the list is the same', () => {
    render(<ClientsTab {...base} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    cleanup();
    render(<ClientsTab {...base} leadsApi={{ client: fakeClient(), userId: 'u1', isLocalIsraeliBusiness: true }} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent.replace(/\s+/g, ' ').trim().split(' ')[0])).toEqual(['לקוחות', 'פניות']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('לקוח חדש')).toBeTruthy();
  });
  it('the Leads tab: the list, "new lead" window, the rule message, Escape closes the window and the details (L-15 Back)', async () => {
    const c = fakeClient({ leads: [{ id: 'l1', user_id: 'u1', name: 'Dana Cohen', phone: '052-1234567', need: 'Window', source: 'ref', status: 'new', next_task_id: null, created_at: '2026-11-15T10:00:00Z' }] });
    render(<ClientsTab {...base} leadsApi={{ client: c, userId: 'u1', isLocalIsraeliBusiness: true }} />);
    fireEvent.click(screen.getByTestId('clients-tab-leads'));
    await waitFor(() => expect(screen.getAllByTestId('lead-row')).toHaveLength(1));
    expect(screen.getByText('פניות: 1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('lead-new'));
    const dlg = screen.getByTestId('lead-dialog');
    expect(dlg.getAttribute('role')).toBe('dialog');
    fireEvent.click(screen.getByTestId('lead-save'));
    expect(screen.getByRole('alert').textContent).toBe('הוסיפו שם ולפחות טלפון או כתובת מייל.');
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(screen.queryByTestId('lead-dialog')).toBeNull();
    fireEvent.click(screen.getAllByTestId('lead-row')[0]);
    const details = await screen.findByTestId('lead-details');
    expect(details.getAttribute('role')).toBe('dialog');
    expect(screen.getByText('המעקב מזכיר לכם לחזור לפנייה. הוא לא שולח הודעה ללקוח.')).toBeTruthy();
    expect(screen.queryByText('הצעה חדשה מהפנייה')).toBeNull(); // stage 2
    await act(async () => { fireEvent.keyDown(details, { key: 'Escape' }); });
    expect(screen.queryByTestId('lead-details')).toBeNull();
    expect(screen.getAllByTestId('lead-row')).toHaveLength(1);
  });
});

describe('locks kept', () => {
  it('L-10: Dashboard.loadData never loads the leads; the leads load in their tab through loadWithRetry', () => {
    const dash = read('pages/Dashboard.jsx');
    expect(dash).not.toMatch(/fetchLeads/);
    expect(read('components/leads/useLeads.js')).toContain('loadWithRetry(() => listLeads(client, userId)');
  });
  it('no new menu entry: the sidebar list does not name the leads', () => {
    expect(read('components/ClientsTab.jsx')).toContain("data-testid=\"clients-tab-leads\"");
    expect(read('utils/dashboardNavCapabilities.js')).not.toMatch(/leads|פניות/);
  });
});
