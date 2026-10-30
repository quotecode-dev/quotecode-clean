// Codex release 9 (Owner console 2026-10-30, continuous work + "מאשר את השמות מאיה ועומר לסוכנים החדשים"; L-22): the agents room screen -
// Maya's and Omer's cards, Maya's draft (Edit / Approve this message / Reject, the server decides), Omer's undecided check, and the
// manager's "Run now" chain with the spec's per-agent words, in Hebrew and English.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }));
const { default: AdminAgentsRoom } = await import('./AdminAgentsRoom');

afterEach(cleanup);
beforeEach(() => invoke.mockReset());

const draft = { id: 'a1000000-0000-4000-8000-000000000001', created_at: '2026-10-30T06:00:00Z', run_key: 'daily:2026-10-30', source: 'customer_success', kind: 'system', action_type: 'outreach_draft',
  title_he: 'הודעת עזרה ל-owner@biz.example: נרשמו ועוד לא יצרו הצעה ראשונה', title_en: 'Help email to owner@biz.example: Registered without a first quote',
  detail_he: 'שלום,\n\nאפשר לעזור?', detail_en: 'שלום,\n\nאפשר לעזור?', status: 'proposed', decided_at: null, done_at: null, result: {}, error: null,
  payload: { caseId: 'c1', recipient: 'owner@biz.example', market: 'IL', lang: 'he', signal: 'no_quote_onboarding', text: 'שלום,\n\nאפשר לעזור?' } };
const base = (over = {}) => ({ ok: true, cap: 20, monthCostUsd: 0, split: { intl: 65, il: 35 }, googleConfigured: true, runs: [], actions: [], profiles: [
  { agent: 'customer_success', name_he: 'מאיה', name_en: 'Maya' }, { agent: 'live_check', name_he: 'עומר', name_en: 'Omer' }], pending: 0, drafts: [], chainAvailable: true, chain: null, ...over });
const route = (st, extra = {}) => invoke.mockImplementation(async (_fn, opts) => {
  const body = opts?.body ?? {};
  if (extra[body.action]) return { data: await extra[body.action](body), error: null };
  if (body.action === 'social_state') return { data: { ok: true, actions: [], replies: [], metrics: [] }, error: null };
  return { data: st, error: null };
});
const httpError = (body) => ({ data: null, error: { name: 'FunctionsHttpError', context: { json: async () => body } } });

describe('Maya and Omer in the room', () => {
  it.each([true, false])('isHebrew=%s: both cards with their drawn characters and names - the grid is full', async (he) => {
    route(base());
    render(<AdminAgentsRoom isHebrew={he} />);
    expect(await screen.findByTestId('agent-card-customer_success')).toBeTruthy();
    expect(screen.getByTestId('agent-name-customer_success').textContent).toBe(he ? 'מאיה' : 'Maya');
    expect(screen.getByTestId('agent-name-live_check').textContent).toBe(he ? 'עומר' : 'Omer');
    expect(screen.getByTestId('agent-card-customer_success').querySelector('[data-testid="agent-avatar-customer_success"]')).toBeTruthy();
    expect(screen.getByTestId('agent-card-live_check').querySelector('[data-testid="agent-avatar-live_check"]')).toBeTruthy();
    expect(screen.queryByTestId('agent-slot-empty')).toBeNull();
  });
  it('an undecided LIVE check is never shown as done', async () => {
    route(base({ runs: [{ id: 'r1', agent: 'live_check', run_key: 'cron:2026-10-30', trigger: 'cron', status: 'done', started_at: '2026-10-30T05:17:00Z', finished_at: '2026-10-30T05:35:00Z',
      summary: 'בדיקת ה-LIVE לא הוכרעה, ולכן היא לא מאשרת שהאתר תקין (קוד: deploy_changed).', data: { outcome: 'inconclusive' }, findings: [], ai_cost_usd: 0, mailed_at: null, error: null }] }));
    render(<AdminAgentsRoom isHebrew />);
    const card = await screen.findByTestId('agent-card-live_check');
    expect(card.textContent).toMatch(/לא הוכרע · /);
    expect(card.textContent).toMatch(/ריצה יומית/);
    expect(card.textContent).not.toMatch(/הושלם/);
  });
});

describe("Maya's draft waits for the Owner", () => {
  it('HE: the verified recipient, market, reason and the three buttons; the edited text is what is approved', async () => {
    const decide = vi.fn(async () => ({ ok: true, status: 'sent' }));
    route(base({ actions: [draft], pending: 1 }), { decide });
    render(<AdminAgentsRoom isHebrew />);
    const meta = await screen.findByTestId(`outreach-meta-${draft.id}`);
    expect(meta.textContent).toContain('נמען מאומת: owner@biz.example');
    expect(meta.textContent).toContain('השוק והשפה: ישראל, עברית');
    expect(meta.textContent).toContain('הסיבה: נרשמו ועוד לא יצרו הצעה ראשונה');
    expect(screen.getByTestId(`action-approve-${draft.id}`).textContent).toBe('אישור ההודעה הזו');
    expect(screen.getByTestId(`action-reject-${draft.id}`).textContent).toBe('דחייה');
    fireEvent.click(screen.getByTestId(`outreach-edit-${draft.id}`));
    fireEvent.change(screen.getByTestId(`outreach-text-${draft.id}`), { target: { value: 'שלום,\n\nנוסח חדש של הבעלים' } });
    fireEvent.click(screen.getByTestId(`action-approve-${draft.id}`));
    await waitFor(() => expect(decide).toHaveBeenCalledWith({ action: 'decide', id: draft.id, decision: 'approve', text: 'שלום,\n\nנוסח חדש של הבעלים' }));
    expect((await screen.findByTestId('admin-agents-room-notice')).textContent).toBe('ההודעה נשלחה ללקוח.');
  });
  it('EN: the buttons in English; a withdrawn consent is said plainly', async () => {
    route(base({ actions: [draft], pending: 1 }), { decide: async () => { throw new Error('unused'); } });
    invoke.mockImplementation(async (_fn, opts) => (opts?.body?.action === 'decide' ? httpError({ ok: false, code: 'outreach_no_consent' })
      : opts?.body?.action === 'social_state' ? { data: { ok: true, actions: [], replies: [], metrics: [] }, error: null } : { data: base({ actions: [draft], pending: 1 }), error: null }));
    render(<AdminAgentsRoom isHebrew={false} />);
    expect((await screen.findByTestId(`outreach-edit-${draft.id}`)).textContent).toBe('Edit');
    expect(screen.getByTestId(`action-approve-${draft.id}`).textContent).toBe('Approve this message');
    expect(screen.getByTestId(`action-reject-${draft.id}`).textContent).toBe('Reject');
    fireEvent.click(screen.getByTestId(`action-approve-${draft.id}`));
    expect((await screen.findByTestId('admin-agents-room-notice')).textContent).toBe('The account owner withdrew consent to help emails, so the message was not sent.');
  });
});

describe('the manager "Run now" chain', () => {
  const steps = (s) => ['live_check', 'seo', 'service', 'security', 'customer_success', 'social', 'live_wait', 'manager'].map((step) => ({ step, status: s[step] ?? 'pending' }));
  it.each([true, false])('isHebrew=%s: starts the chain, advances it to the end and shows each agent with the spec words + the partial line', async (he) => {
    const done = { live_check: 'failed', seo: 'skipped_fresh', service: 'ran', security: 'not_run_hour', customer_success: 'ran', social: 'skipped_week', live_wait: 'failed', manager: 'ran' };
    const chain = { id: 'c0000000-0000-4000-8000-000000000001', hour_key: 'chain:2026-10-30T09', status: 'running', steps: steps({}), created_at: '2026-10-30T07:00:00Z' };
    const step = vi.fn(async () => ({ ok: true, chain: { ...chain, status: 'done', steps: steps(done).map((x) => (x.step === 'live_check' ? { ...x, code: 'dispatch_not_configured' } : x)) }, partial: true }));
    route(base(), { chain_start: async () => ({ ok: true, chain }), chain_step: step });
    render(<AdminAgentsRoom isHebrew={he} />);
    fireEvent.click(await screen.findByTestId('agent-run-manager'));
    await waitFor(() => expect(step).toHaveBeenCalledWith({ action: 'chain_step', id: chain.id }));
    await waitFor(() => expect(screen.getByTestId('agents-chain').dataset.status).toBe('done'));
    const t = (id) => screen.getByTestId(`chain-step-${id}`).textContent;
    expect(t('seo')).toMatch(he ? /דולג — הדוח עדיין עדכני$/ : /Skipped — report is still fresh$/);
    expect(t('security')).toMatch(he ? /לא הורץ — מגבלת השעה$/ : /Not run — hourly limit$/);
    expect(t('social')).toMatch(he ? /דולג — הפוסטים לשבוע כבר מוכנים$/ : /Skipped — this week’s posts are already prepared$/);
    expect(t('live_check')).toBe(he ? 'עומר: נכשל (החיבור לגיטהאב עוד לא הוגדר, ולכן הבדיקה לא התחילה.)' : 'Omer: Failed (The GitHub connection is not set yet, so the check did not start.)');
    expect(t('manager')).toMatch(he ? /הורץ$/ : /Ran$/);
    expect(screen.queryByTestId('chain-step-live_wait')).toBeNull();
    expect(screen.getByTestId('agents-chain-partial').textContent).toBe(he ? 'הסיכום חלקי: חלק מהדוחות לא הושלמו או אינם עדכניים.' : 'The summary is partial: some reports failed or are stale.');
  });
  it('a refreshed screen continues a running chain from the server', async () => {
    const chain = { id: 'c0000000-0000-4000-8000-000000000002', hour_key: 'chain:2026-10-30T09', status: 'running', steps: steps({ live_check: 'ran', seo: 'ran' }), created_at: '2026-10-30T07:00:00Z' };
    const step = vi.fn(async () => ({ ok: true, chain: { ...chain, status: 'done', steps: steps({ live_check: 'ran', seo: 'ran', service: 'ran', security: 'ran', customer_success: 'ran', social: 'ran', live_wait: 'ran', manager: 'ran' }) }, partial: false }));
    route(base({ chain }), { chain_step: step });
    render(<AdminAgentsRoom isHebrew />);
    await waitFor(() => expect(step).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('agents-chain').dataset.status).toBe('done'));
    expect(screen.queryByTestId('agents-chain-partial')).toBeNull();
  });
});
