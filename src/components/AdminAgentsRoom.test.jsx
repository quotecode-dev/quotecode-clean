// Owner console 2026-10-27 (typed: "מאשר שלב 1 של חדר הסוכנים ..."): the agents room screen.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }));
import AdminAgentsRoom from './AdminAgentsRoom';
import { ADMIN_DESTINATIONS } from './adminDestinations';

afterEach(cleanup);
beforeEach(() => invoke.mockReset());

const state = {
  ok: true, cap: 20, monthCostUsd: 0.0123, split: { intl: 65, il: 35 }, googleConfigured: true,
  runs: [
    { id: '1', agent: 'seo', run_key: 'cron:2026-10-27', trigger: 'cron', status: 'done', started_at: '2026-10-27T05:00:00Z', finished_at: '2026-10-27T05:01:00Z',
      summary: 'סיכום הקידום.', data: { summaryEn: 'The SEO summary.' }, ai_cost_usd: 0.0123, mailed_at: '2026-10-27T05:01:00Z', error: null,
      findings: [{ level: 'warn', he: 'לא באינדקס: /en', en: 'Not indexed: /en' }, { level: 'good', he: 'חו״ל: לחזק את דף הבית', en: 'International: strengthen the home page' }] },
    { id: '2', agent: 'security', run_key: 'admin:2026-10-26T22', trigger: 'admin', status: 'failed', started_at: '2026-10-26T20:00:00Z', finished_at: null,
      summary: null, data: {}, ai_cost_usd: 0, mailed_at: null, error: 'database', findings: [] },
  ],
};

describe('the agents room', () => {
  it('HE: the cost against the 20 dollar cap, the 65/35 split, and a card per agent with its last run', async () => {
    invoke.mockResolvedValue({ data: state, error: null });
    render(<AdminAgentsRoom isHebrew />);
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-budget')).toBeTruthy());
    expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'state' } });
    expect(screen.getByTestId('admin-agents-room-cost').textContent).toBe('$0.01');
    expect(screen.getByTestId('admin-agents-room-budget').textContent).toMatch(/65%[\s\S]*35%/);
    expect(screen.getByTestId('agent-card-seo').dataset.status).toBe('done');
    expect(screen.getByTestId('agent-summary-seo').textContent).toBe('סיכום הקידום.');
    expect(screen.getByTestId('agent-findings-seo').textContent).toMatch(/לא באינדקס: \/en/);
    expect(screen.getByTestId('agent-card-security').textContent).toMatch(/נכשל[\s\S]*database/);
    expect(screen.getByTestId('agent-card-service').dataset.status).toBe('never');
  });

  it('EN: the English summary and findings', async () => {
    invoke.mockResolvedValue({ data: state, error: null });
    render(<AdminAgentsRoom isHebrew={false} />);
    await waitFor(() => expect(screen.getByTestId('agent-summary-seo').textContent).toBe('The SEO summary.'));
    expect(screen.getByTestId('agent-findings-seo').textContent).toMatch(/International: strengthen/);
  });

  it('"run now" runs that one agent and reloads; a failure is said honestly', async () => {
    invoke.mockResolvedValueOnce({ data: state, error: null });
    render(<AdminAgentsRoom isHebrew />);
    await waitFor(() => expect(screen.getByTestId('agent-run-service')).toBeTruthy());
    invoke.mockResolvedValueOnce({ data: { ok: true, results: [{ agent: 'service', status: 'done' }] }, error: null });
    invoke.mockResolvedValueOnce({ data: state, error: null });
    fireEvent.click(screen.getByTestId('agent-run-service'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toMatch(/הסוכן סיים/));
    expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'run', agent: 'service' } });
  });

  it('Owner 2026-10-27: a cost under one cent shows 4 decimals, never $0.00', async () => {
    invoke.mockResolvedValue({ data: { ...state, monthCostUsd: 0.0006 }, error: null });
    render(<AdminAgentsRoom isHebrew />);
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-cost').textContent).toBe('$0.0006'));
  });

  it('is an Owner-only tool in the System hub', () => {
    expect(ADMIN_DESTINATIONS.find((d) => d.id === 'agents-room')).toMatchObject({ hub: 'system', permission: 'owner', available: true });
  });
});

// Owner console 2026-10-27 (typed: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים"): the manager's desk, the Owner's approvals, names, characters
const A = (id, over) => ({ id, created_at: '2026-11-01T05:40:00Z', run_key: 'cron:2026-11-01', source: 'manager', detail_he: null, detail_en: null, payload: {}, status: 'proposed', decided_at: null, done_at: null, result: {}, error: null, ...over });
const sec = (h) => ({ h, p: [`${h} - פסקה.`], list: [] });
const stage2 = {
  ...state,
  runs: [{ id: 'm', agent: 'manager', run_key: 'cron:2026-11-01', trigger: 'cron', status: 'done', started_at: '2026-11-01T05:40:00Z', finished_at: '2026-11-01T05:41:00Z',
    summary: 'השבוע: מדריך אחד באנגלית.', data: { summaryEn: 'This week: one English guide.' }, findings: [], ai_cost_usd: 0.001, error: null }, ...state.runs],
  profiles: [{ agent: 'manager', name_he: 'נועה', name_en: 'Noa' }, { agent: 'seo', name_he: 'גיא', name_en: 'Guy' }, { agent: 'service', name_he: 'מיכל', name_en: 'Michal' }, { agent: 'security', name_he: 'אבי', name_en: 'Avi' }],
  actions: [
    A('t1', { kind: 'system', action_type: 'article_draft', title_he: 'מאמר מוצע (חו״ל): תמחור לפי שעה', title_en: 'Proposed article (international): Hourly pricing', payload: { market: 'intl' } }),
    A('p1', { kind: 'system', action_type: 'article_publish', title_he: 'לקרוא ולפרסם: איך מתמחרים', title_en: 'Read and publish: How to price', payload: { articleId: 'art1', slug: 'hourly' } }),
    A('c1', { kind: 'claude', action_type: 'claude_task', title_he: 'לתקן את הכתובת הראשית', title_en: 'Fix the canonical', payload: { prompt_he: 'ההוראה המלאה ל-Claude.' } }),
    A('c2', { kind: 'claude', action_type: 'claude_task', status: 'approved', title_he: 'משימה שאושרה', title_en: 'An approved task', payload: { prompt_he: 'הוראה שאושרה.' } }),
    A('i1', { kind: 'info', action_type: 'none', status: 'done', title_he: 'המאמרים צריכים זמן', title_en: 'The guides need time' }),
    A('s1', { kind: 'auto', action_type: 'sitemap_submit', status: 'failed', error: 'google_403', run_key: 'daily:2026-10-31', title_he: 'מפת האתר נשלחה מחדש לגוגל', title_en: 'The sitemap was resubmitted to Google' }),
  ],
  drafts: [{ id: 'art1', slug: 'hourly', market: 'intl', status: 'draft', he: { h1: 'איך מתמחרים', intro: 'פתיחה.', sections: [sec('חלק א')] }, en: { h1: 'How to price', intro: 'Intro.', sections: [{ h: 'Part A', p: ['A paragraph.'], list: [] }] } }],
};

describe('the agents room - stage 2', () => {
  it('HE: the manager\'s desk on top - her character, her name, the week\'s plan, what waits, what is with Claude, information, history', async () => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew />);
    await waitFor(() => expect(screen.getByTestId('agent-card-manager')).toBeTruthy());
    expect(screen.getByTestId('agent-name-manager').textContent).toBe('נועה');
    expect(screen.getByTestId('agent-avatar-manager')).toBeTruthy();
    for (const a of ['seo', 'service', 'security']) expect(screen.getByTestId(`agent-avatar-${a}`)).toBeTruthy();
    expect(screen.getByTestId('agent-name-seo').textContent).toBe('גיא');
    expect(screen.getByTestId('agent-summary-manager').textContent).toBe('השבוע: מדריך אחד באנגלית.');
    expect(screen.getByTestId('agents-pending-count').textContent).toBe('3');
    expect(screen.getByTestId('agents-pending').textContent).toMatch(/מאמר מוצע[\s\S]*לקרוא ולפרסם[\s\S]*לתקן את הכתובת הראשית/);
    expect(screen.getByTestId('agents-with-claude').textContent).toMatch(/משימה שאושרה/);
    expect(screen.getByTestId('agents-info').textContent).toMatch(/המאמרים צריכים זמן/);
    expect(screen.getByTestId('agents-history').textContent).toMatch(/צריך להעלות את ההרשאה/);
  });

  it('EN: the same desk in English, with the English names', async () => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew={false} />);
    await waitFor(() => expect(screen.getByTestId('agent-name-manager').textContent).toBe('Noa'));
    expect(screen.getByTestId('agent-summary-manager').textContent).toBe('This week: one English guide.');
    expect(screen.getByTestId('agents-pending').textContent).toMatch(/Proposed article[\s\S]*Read and publish[\s\S]*Fix the canonical/);
    expect(screen.getByTestId('action-approve-t1').textContent).toBe('Write a draft');
  });

  it('approve a topic, read the draft, publish it, ask for a change - each one call the server checks', async () => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew />);
    await waitFor(() => expect(screen.getByTestId('action-approve-t1')).toBeTruthy());
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'drafted' }, error: null });
    fireEvent.click(screen.getByTestId('action-approve-t1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toMatch(/הטיוטה מוכנה/));
    expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'decide', id: 't1', decision: 'approve' } });
    fireEvent.click(screen.getByTestId('action-read-p1'));
    expect(screen.getByTestId('article-preview-hourly').textContent).toMatch(/איך מתמחרים[\s\S]*חלק א/);
    fireEvent.click(screen.getByText('אנגלית'));
    expect(screen.getByTestId('article-preview-hourly').textContent).toMatch(/How to price[\s\S]*Part A/);
    fireEvent.click(screen.getByTestId('action-revise-p1'));
    fireEvent.change(screen.getByTestId('action-revise-note-p1'), { target: { value: 'יותר דוגמאות' } });
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'revised' }, error: null });
    fireEvent.click(screen.getByTestId('action-revise-send-p1'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'revise', id: 'p1', note: 'יותר דוגמאות' } }));
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'published', deploy: 'not_configured' }, error: null });
    fireEvent.click(screen.getByTestId('action-approve-p1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toMatch(/קישור הבנייה מחדש עוד לא הוגדר/));
  });

  it('a code task: approve emails the instruction; the approved one copies the instruction and can be marked done; a failure is said honestly', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew />);
    await waitFor(() => expect(screen.getByTestId('action-copy-c2')).toBeTruthy());
    fireEvent.click(screen.getByTestId('action-copy-c2'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('הוראה שאושרה.'));
    invoke.mockResolvedValueOnce({ data: { ok: false, code: 'draft_failed' }, error: null });
    fireEvent.click(screen.getByTestId('action-approve-t1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toMatch(/לא עברה את הבדיקות/));
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'approved', mailed: true }, error: null });
    fireEvent.click(screen.getByTestId('action-approve-c1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toMatch(/נשלחה אליכם במייל/));
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'done' }, error: null });
    fireEvent.click(screen.getByTestId('action-done-c2'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'mark_done', id: 'c2' } }));
  });

  it('the Owner names an agent in Hebrew and English', async () => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew />);
    await waitFor(() => expect(screen.getByTestId('agent-rename-seo')).toBeTruthy());
    fireEvent.click(screen.getByTestId('agent-rename-seo'));
    fireEvent.change(screen.getByTestId('agent-name-he-seo'), { target: { value: 'רון' } });
    fireEvent.change(screen.getByTestId('agent-name-en-seo'), { target: { value: 'Ron' } });
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    fireEvent.click(screen.getByTestId('agent-name-save-seo'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'rename', agent: 'seo', name_he: 'רון', name_en: 'Ron' } }));
  });
});
