// Owner console 2026-10-23, typed L-22 (the weekly review): the button shows how many items are open, the list opens open items first,
// a status change goes through the super-admin function, "review now" calls the review function, and a failure is said honestly.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a), functions: { invoke: (...a) => invoke(...a) } } }));
const { default: AdminWeeklyReview } = await import('./AdminWeeklyReview');

const item = (o) => ({ id: o.id, week: '2026-10-25', kind: 'bug', title: 'כפתור ה-PDF לא עובד', summary: 'שני לקוחות דיווחו.', priority: 1, count: 2, status: 'new', ...o });
const list = { data: { ok: true, weeks: [{ week: '2026-10-25', inquiries: 7, items: 3 }], items: [item({ id: 'a' }), item({ id: 'b', kind: 'request', status: 'in_progress' }), item({ id: 'c', status: 'fixed' })] }, error: null };

beforeEach(() => {
  rpc.mockReset(); invoke.mockReset();
  rpc.mockImplementation(async (fn) => (fn === 'support_review_admin_list' ? list : { data: { ok: true }, error: null }));
  invoke.mockResolvedValue({ data: { ok: true, inquiries: 7, items: 3 }, error: null });
});
afterEach(() => cleanup());

describe('AdminWeeklyReview', () => {
  it.each([true, false])('isHebrew=%s: the open count, the open items first, fixed hidden until "show all"', async (he) => {
    const { findByTestId, getByTestId } = render(<AdminWeeklyReview isHebrew={he} />);
    expect((await findByTestId('weekly-review-open-count')).textContent).toBe('2');
    fireEvent.click(getByTestId('inquiries-weekly-review'));
    const ol = await findByTestId('weekly-review-list');
    expect([...ol.querySelectorAll('[data-item]')].map((li) => li.getAttribute('data-item'))).toEqual(['a', 'b']);
    expect(getByTestId('weekly-review-dialog').textContent).toContain('25/10/2026');
    fireEvent.click(getByTestId('weekly-review-toggle-closed'));
    expect(getByTestId('weekly-review-list').querySelectorAll('[data-item]').length).toBe(3);
  });
  it('a status change goes through support_review_set_status', async () => {
    const { findByTestId, getByTestId } = render(<AdminWeeklyReview isHebrew />);
    fireEvent.click(await findByTestId('inquiries-weekly-review'));
    await findByTestId('weekly-review-list');
    fireEvent.click(getByTestId('weekly-review-status-a-fixed'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('support_review_set_status', { p_id: 'a', p_status: 'fixed' }));
  });
  it('"review now" calls the review function and reports the result; a failure is said honestly', async () => {
    const { findByTestId, getByTestId } = render(<AdminWeeklyReview isHebrew />);
    fireEvent.click(await findByTestId('inquiries-weekly-review'));
    fireEvent.click(getByTestId('weekly-review-run'));
    await waitFor(() => expect(getByTestId('weekly-review-notice').textContent).toContain('נקראו 7 פניות'));
    expect(invoke).toHaveBeenCalledWith('support-weekly-review', { body: { action: 'run' } });
    invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ ok: false, code: 'failed' }) } } });
    fireEvent.click(getByTestId('weekly-review-run'));
    await waitFor(() => expect(getByTestId('weekly-review-notice').textContent).toContain('לא הושלמה'));
  });
  it('without the run permission there is no "review now"', async () => {
    const { findByTestId, queryByTestId } = render(<AdminWeeklyReview isHebrew canRun={false} />);
    fireEvent.click(await findByTestId('inquiries-weekly-review'));
    expect(queryByTestId('weekly-review-run')).toBeNull();
  });
});
