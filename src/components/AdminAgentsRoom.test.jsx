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

  it('is an Owner-only tool in the System hub', () => {
    expect(ADMIN_DESTINATIONS.find((d) => d.id === 'agents-room')).toMatchObject({ hub: 'system', permission: 'owner', available: true });
  });
});
