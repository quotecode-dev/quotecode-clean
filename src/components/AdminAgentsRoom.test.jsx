// Owner console 2026-10-27 (typed: "מאשר שלב 1 של חדר הסוכנים ..."): the agents room screen.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }));
import AdminAgentsRoom, { AGENTS_CHECK_LINK } from './AdminAgentsRoom';
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
  // Owner 2026-10-29 (L-22): the agents check opens in a new Claude chat in the Owner's editor - a link, nothing is run by the site
  it('the agents check link at the end of the KPI row, in both languages', async () => {
    for (const isHebrew of [true, false]) {
      invoke.mockResolvedValue({ data: state, error: null });
      render(<AdminAgentsRoom isHebrew={isHebrew} />);
      const a = await screen.findByTestId('agents-claude-check');
      expect(a.getAttribute('href')).toBe('vscode://anthropic.claude-code/open?prompt=%2Fagents-check');
      expect(AGENTS_CHECK_LINK).toBe(a.getAttribute('href'));
      expect(a.textContent).toBe(isHebrew ? 'בדיקת סוכנים אצל Claudeנפתח בעורך במחשב' : 'Agents check with ClaudeOpens in the editor on this computer');
      expect(screen.getByTestId('admin-agents-room-budget').lastElementChild).toBe(a);
      expect(a.querySelector('[data-tekango-ai-icon="ai"]')).toBeTruthy();
      cleanup();
    }
  });
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

  // Owner console 2026-10-27, typed: "מאשר את התוכנית לגיא ולמיכל, כולל שינוי ב-L-22 במסך הפניות"
  it.each([[true, 'לטיפולכם: דוח'], [false, 'For you to handle: דוח']])('isHebrew=%s: a red inquiry in the service card opens that inquiry; other findings stay text', async (isHebrew, label) => {
    const service = { id: '3', agent: 'service', run_key: 'admin:2026-10-27T13', trigger: 'admin', status: 'done', started_at: '2026-10-27T11:24:00Z', finished_at: '2026-10-27T11:24:00Z',
      summary: 'בשבוע האחרון: 1 פניות.', data: {}, ai_cost_usd: 0, mailed_at: null, error: null,
      findings: [{ level: 'bad', he: '1 פניות שדורשות אתכם (אדום)', en: '1 inquiries that need you (red)' }, { level: 'bad', he: 'לטיפולכם: דוח', en: 'For you to handle: דוח', inquiryId: 'b2' }] };
    invoke.mockResolvedValue({ data: { ...state, runs: [...state.runs, service] }, error: null });
    const onOpenInquiry = vi.fn();
    render(<AdminAgentsRoom isHebrew={isHebrew} onOpenInquiry={onOpenInquiry} />);
    const link = await screen.findByTestId('agent-inquiry-b2');
    expect(link.tagName).toBe('BUTTON');
    expect(link.textContent).toBe(label);
    expect(screen.getByTestId('agent-findings-service').querySelectorAll('button')).toHaveLength(1);
    fireEvent.click(link);
    expect(onOpenInquiry).toHaveBeenCalledWith('b2');
    cleanup();
    // without the permission (no handler) the same finding is plain text
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    await waitFor(() => expect(screen.getByTestId('agent-findings-service').textContent).toContain(label));
    expect(screen.queryByTestId('agent-inquiry-b2')).toBeNull();
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
    // 20261029000000 (Codex F07): the approval names the revision on the screen
    expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'decide', id: 'p1', decision: 'approve', revision: 0 } });
  });

  // 20261029000000 (Codex F07 / F22): a draft changed since it was read is read again; a rebuild that did not start can be pressed again
  it.each([[true], [false]])('isHebrew=%s: a changed draft is read again; a failed rebuild says so and rebuilds without a new approval', async (isHebrew) => {
    const built = A('h1', { kind: 'system', action_type: 'article_publish', status: 'done', title_he: 'לקרוא ולפרסם: מדריך', title_en: 'Read and publish: A guide',
      payload: { articleId: 'art9', slug: 'g' }, result: { slug: 'g', deploy: 'failed' }, error: 'deploy_failed' });
    invoke.mockResolvedValue({ data: { ...stage2, actions: [...stage2.actions, built] }, error: null });
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    await waitFor(() => expect(screen.getByTestId('article-rebuild-h1')).toBeTruthy());
    expect(screen.getByTestId('article-rebuild-h1').textContent).toContain(isHebrew ? 'בניית האתר מחדש לא התחילה' : 'the site rebuild did not start');
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'redeployed', deploy: 'ok' }, error: null });
    fireEvent.click(screen.getByTestId('article-rebuild-btn-h1'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'redeploy', id: 'h1' } }));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toBe(isHebrew ? 'האתר נבנה מחדש, וזה לוקח כ־2 דקות.' : 'The site is rebuilding; it takes about 2 minutes.'));
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'article_changed' }) } } });
    fireEvent.click(screen.getByTestId('action-approve-p1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toBe(isHebrew ? 'הטיוטה השתנתה מאז שנפתחה. קראו אותה שוב לפני האישור.' : 'The draft changed since it was opened. Read it again before approving.'));
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

// Codex release 4 (Owner 2026-10-29, typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
// החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב"): the duplicate-topic and AI-budget texts of the spec, word for word
describe('the agents room - Codex release 4', () => {
  const similar = { kind: 'static', lang: 'en', title: 'Renovation Contractor Quotes: What to Include', slug: 'renovation-contractor-quote' };
  const withSimilar = { ...stage2, actions: [A('t2', { kind: 'system', action_type: 'article_draft', title_he: 'מאמר מוצע (חו״ל): הצעות מחיר לשיפוצים', title_en: 'Proposed article (international): Renovation quotes',
    payload: { market: 'intl', topic_he: 'הצעות מחיר לשיפוצים', topic_en: 'Renovation quotes', similar } }), ...stage2.actions] };

  it.each([[true], [false]])('isHebrew=%s: a similar topic shows the existing guide and needs a distinct focus before the draft is written', async (isHebrew) => {
    invoke.mockResolvedValue({ data: withSimilar, error: null });
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    const note = await screen.findByTestId('action-topic-t2');
    expect(note.dataset.code).toBe('possible_duplicate');
    expect(note.textContent).toContain(isHebrew ? 'נמצא נושא דומה. בדקו את הפריט הקיים לפני אישור נושא נוסף.' : 'A similar topic was found. Review the existing item before approving another topic.');
    expect(screen.getByTestId('action-topic-match-t2').textContent).toContain(isHebrew ? 'מדריך קבוע באתר · אנגלית: Renovation Contractor Quotes: What to Include' : 'A guide on the site · English: Renovation Contractor Quotes: What to Include');
    expect(screen.getByTestId('action-topic-address-t2').textContent).toBe('/en/articles/renovation-contractor-quote'); // shown, never opened from the admin
    const write = screen.getByTestId('action-approve-t2');
    expect(write.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('action-focus-t2'), { target: { value: 'קצר' } });
    expect(write.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('action-focus-t2'), { target: { value: 'שיפוץ מטבח בלבד: ארונות ומשטח' } });
    expect(write.disabled).toBe(false);
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'drafted' }, error: null });
    fireEvent.click(write);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'decide', id: 't2', decision: 'approve', focus: 'שיפוץ מטבח בלבד: ארונות ומשטח' } }));
  });

  it.each([[true], [false]])('isHebrew=%s: a duplicate refused by the server says so with the existing item, and cannot be approved again', async (isHebrew) => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    await waitFor(() => expect(screen.getByTestId('action-approve-t1')).toBeTruthy());
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'duplicate_topic', match: { kind: 'draft', lang: 'he', title: 'תמחור לפי שעה', slug: 'hourly' } }) } } });
    fireEvent.click(screen.getByTestId('action-approve-t1'));
    const dup = isHebrew ? 'הנושא הזה כבר קיים במאמר או בטיוטה. פתחו את הפריט הקיים או בחרו נושא אחר. לא נוצרה טיוטה חדשה.'
      : 'This topic already exists in an article or draft. Open the existing item or choose another topic. No new draft was created.';
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toBe(`${dup} (${isHebrew ? 'טיוטה שמחכה לקריאה' : 'A draft waiting to be read'}: תמחור לפי שעה)`));
    expect(screen.getByTestId('action-topic-t1').textContent).toContain(dup);
    expect(screen.queryByTestId('action-topic-address-t1')).toBeNull(); // a draft is read in its own row on this screen - it has no site address yet
    expect(screen.getByTestId('action-approve-t1').disabled).toBe(true);
    expect(screen.getByTestId('action-reject-t1').disabled).toBe(false);
  });

  it.each([[true], [false]])('isHebrew=%s: the budget - a refusal in the spec words, the held part, and a stopped budget', async (isHebrew) => {
    invoke.mockResolvedValue({ data: { ...stage2, monthCostUsd: 3.5, heldUsd: 0.25, budgetBlocked: true }, error: null });
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-held')).toBeTruthy());
    expect(screen.getByTestId('admin-agents-room-held').textContent).toBe(isHebrew ? 'חלק מהתקציב שמור לקריאות שעדיין לא התקבלה עליהן תשובה סופית. $0.25' : 'Part of the budget is reserved for requests whose final outcome is still unknown. $0.25');
    expect(screen.getByTestId('admin-agents-room-budget-blocked').textContent).toBe(isHebrew ? 'תקציב הבינה נעצר, כי קריאה אחת עלתה יותר מהסכום שנשמר לה. לא יישלחו עוד קריאות לבינה.'
      : 'The AI budget was stopped because one request cost more than the amount reserved for it. No further AI requests will be sent.');
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'budget_insufficient' }) } } });
    fireEvent.click(screen.getByTestId('action-approve-t1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toBe(isHebrew ? 'אין בתקציב הבינה החודשי יתרה מספקת לפעולה הזו. לא בוצעה קריאה לבינה.'
      : 'The monthly AI budget does not have enough available funds for this action. No AI request was made.'));
  });

  it.each([[true], [false]])('isHebrew=%s: a draft already being written, and an inventory that could not be read, are said plainly', async (isHebrew) => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    await waitFor(() => expect(screen.getByTestId('action-approve-t1')).toBeTruthy());
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'drafting' }) } } });
    fireEvent.click(screen.getByTestId('action-reject-t1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toBe(isHebrew ? 'הטיוטה כבר נכתבת. רעננו בעוד כמה דקות.' : 'The draft is already being written. Refresh in a few minutes.'));
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'article_inventory_unavailable' }) } } });
    fireEvent.click(screen.getByTestId('action-approve-t1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toBe(isHebrew ? 'לא הצלחנו לקרוא את כל המאמרים והטיוטות, ולכן לא נוצרה טיוטה. נסו שוב בעוד רגע.' : 'We could not read all the articles and drafts, so no draft was created. Try again in a moment.'));
  });

  it('nothing new when nothing is held, blocked or similar', async () => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew />);
    await waitFor(() => expect(screen.getByTestId('action-approve-t1')).toBeTruthy());
    expect(screen.queryByTestId('admin-agents-room-held')).toBeNull();
    expect(screen.queryByTestId('admin-agents-room-budget-blocked')).toBeNull();
    expect(screen.queryByTestId('action-topic-t1')).toBeNull();
    expect(screen.queryByTestId('action-focus-t1')).toBeNull();
    expect(screen.getByTestId('action-approve-t1').disabled).toBe(false);
  });
});

// Night task 29-30/10: docs/CODEX_REVIEW_RELEASE4_2026-10-29.md - R4-04 (focus at publication), R4-09 (the copy), R4-10 (check again), R4-12 (open the item)
describe('the agents room - the review of release 4', () => {
  it.each([[true], [false]])('isHebrew=%s: a duplicate can be checked again, and the matched item opens inside the admin (static guide and draft)', async (isHebrew) => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    await waitFor(() => expect(screen.getByTestId('action-approve-t1')).toBeTruthy());
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'duplicate_topic', match: { kind: 'static', lang: 'en', title: 'Renovation Contractor Quotes: What to Include', slug: 'renovation-contractor-quote' } }) } } });
    fireEvent.click(screen.getByTestId('action-approve-t1'));
    await waitFor(() => expect(screen.getByTestId('action-topic-t1')).toBeTruthy());
    expect(screen.getByTestId('action-approve-t1').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('action-topic-open-t1'));
    await waitFor(() => expect(screen.getByTestId('article-preview-renovation-contractor-quote').textContent).toContain(isHebrew ? 'הצעת מחיר של קבלן שיפוצים' : 'Renovation Contractor Quotes'));
    expect(screen.getByTestId('action-topic-open-t1').textContent).toBe(isHebrew ? 'הסתרת הפריט הקיים' : 'Hide the existing item');
    fireEvent.click(screen.getByTestId('action-topic-recheck-t1'));
    expect(screen.queryByTestId('action-topic-t1')).toBeNull();
    expect(screen.getByTestId('action-approve-t1').disabled).toBe(false);
    // a matched draft is read through the guarded server action
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'duplicate_topic', match: { kind: 'draft', lang: 'he', title: 'איך מתמחרים', id: 'art1' } }) } } });
    fireEvent.click(screen.getByTestId('action-approve-t1'));
    await waitFor(() => expect(screen.getByTestId('action-topic-open-t1')).toBeTruthy());
    invoke.mockResolvedValueOnce({ data: { ok: true, article: stage2.drafts[0] }, error: null });
    fireEvent.click(screen.getByTestId('action-topic-open-t1'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'topic_item', kind: 'draft', id: 'art1' } }));
    await waitFor(() => expect(screen.getByTestId('action-topic-t1').querySelector('[data-testid="article-preview-hourly"]')).toBeTruthy());
  });

  it.each([[true], [false]])('isHebrew=%s: a draft with similar headings is published only with a distinct focus', async (isHebrew) => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    await waitFor(() => expect(screen.getByTestId('action-approve-p1')).toBeTruthy());
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'possible_duplicate', match: { kind: 'static', lang: 'en', title: 'Renovation Contractor Quotes: What to Include', slug: 'renovation-contractor-quote' } }) } } });
    fireEvent.click(screen.getByTestId('action-approve-p1'));
    await waitFor(() => expect(screen.getByTestId('action-focus-p1')).toBeTruthy());
    expect(screen.getByTestId('action-approve-p1').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('action-focus-p1'), { target: { value: 'שיפוץ מרפסות בלבד' } });
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'published', deploy: 'ok' }, error: null });
    fireEvent.click(screen.getByTestId('action-approve-p1'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'decide', id: 'p1', decision: 'approve', focus: 'שיפוץ מרפסות בלבד', revision: 0 } }));
  });

  it.each([[true], [false]])('isHebrew=%s: a stop after a paid attempt and an unknown outcome are said truthfully', async (isHebrew) => {
    invoke.mockResolvedValue({ data: stage2, error: null });
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    await waitFor(() => expect(screen.getByTestId('action-approve-t1')).toBeTruthy());
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'budget_stopped' }) } } });
    fireEvent.click(screen.getByTestId('action-approve-t1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toBe(isHebrew ? 'תקציב הבינה עצר ניסיונות נוספים. ייתכן שניסיון קודם בפעולה הזו כבר עלה כסף.'
      : 'The AI budget stopped further attempts. An earlier attempt in this action may already have cost money.'));
    invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'ai_unknown_outcome' }) } } });
    fireEvent.click(screen.getByTestId('action-approve-t1'));
    await waitFor(() => expect(screen.getByTestId('admin-agents-room-notice').textContent).toBe(isHebrew ? 'לא התקבלה תשובה ברורה מהבינה. הסכום נשאר שמור, ולא נשלח ניסיון נוסף. אפשר לנסות שוב מאוחר יותר.'
      : 'The AI gave no clear answer. The amount stays reserved and no further attempt was sent. You can try again later.'));
  });
});
