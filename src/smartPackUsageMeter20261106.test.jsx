// Owner console 2026-11-06 (typed: "מאשר את משימת הלילה בסדר הזה: שחרור א׳, מונה השימוש של חכם פלוס (4 ₪ = 100%, שער 3.5 ₪ לדולר, לפי
// התשובות שנתתי) ... כולל שינוי ב-L-01, L-05, L-06, L-09, L-11, L-12, L-14, L-17, L-22"): the SMART PACK usage meter in the browser -
// one line from one server number in every SMART PACK window, the used-up messages, and the Owner's cost view.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

const rpc = vi.fn();
vi.mock('./shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a) } }));
import { fetchSmartPackUsage, smartPackUsageText, smartPackUsedUpText } from './utils/smartPackUsage';
import { classifyDraftError } from './utils/aiQuoteDraftClient';
import { voiceRefusalOf } from './utils/voiceAssistant';
import QuoteFromFileDialog from './components/QuoteFromFileDialog';
import AiQuoteDraftDialog from './components/AiQuoteDraftDialog';
import AdminSmartPackUsage from './components/AdminSmartPackUsage';
import { ADMIN_DESTINATIONS, canOpenDestination } from './components/adminDestinations';

afterEach(cleanup);
beforeEach(() => rpc.mockReset());

describe('the one line, from the server meter', () => {
  it('reads smart_pack_usage_status strictly; anything else is unknown (no line)', async () => {
    const sb = (data, error = null) => ({ rpc: vi.fn(async () => ({ data, error })) });
    expect(await fetchSmartPackUsage(sb({ ok: true, smartPack: true, unlimited: false, percentLeft: 63 }))).toEqual({ percentLeft: 63, unlimited: false });
    expect(await fetchSmartPackUsage(sb({ ok: true, smartPack: false, percentLeft: 100 }))).toBeNull();
    expect(await fetchSmartPackUsage(sb({ ok: true, smartPack: true, percentLeft: '63' }))).toBeNull();
    expect(await fetchSmartPackUsage(sb(null, { message: 'x' }))).toBeNull();
    expect(await fetchSmartPackUsage({ rpc: async () => { throw new Error('net'); } })).toBeNull();
  });
  it('HE / EN: the percentage left; 0% = used up; the unlimited admin and an unknown meter show nothing', () => {
    expect(smartPackUsageText({ percentLeft: 63, unlimited: false }, true)).toBe('נשארו לכם 63% משימוש חכם פלוס החודש');
    expect(smartPackUsageText({ percentLeft: 63, unlimited: false }, false)).toBe('63% of your SMART PACK usage left this month');
    expect(smartPackUsageText({ percentLeft: 0, unlimited: false }, true)).toBe('ניצלתם את השימוש בחכם פלוס לחודש הזה. הוא מתחדש בתחילת החודש הבא.');
    expect(smartPackUsageText({ percentLeft: 0, unlimited: false }, false)).toBe("You have used this month's SMART PACK usage. It renews at the start of next month.");
    expect(smartPackUsageText({ percentLeft: 100, unlimited: true }, true)).toBeNull();
    expect(smartPackUsageText(null, true)).toBeNull();
    // a refused action: not enough left for THIS action (it may be more than 0%)
    expect(smartPackUsedUpText(true)).toBe('היתרה בחכם פלוס לחודש הזה לא מספיקה לפעולה הזו. היא מתחדשת בתחילת החודש הבא. בינתיים אפשר להמשיך ידנית.');
    expect(smartPackUsedUpText(false, false)).toBe('Your SMART PACK usage left this month is not enough for this action. It renews at the start of next month.');
  });
  it('a refused action is read as used up (budget_exhausted), never as "busy" or a sign-in problem', async () => {
    const http = (status, body) => ({ name: 'FunctionsHttpError', context: new Response(JSON.stringify(body), { status }) });
    expect(await classifyDraftError(http(403, { ok: false, code: 'budget_exhausted' }))).toBe('budget_exhausted');
    expect(await classifyDraftError(http(403, { ok: false, code: 'smart_pack_required' }))).toBe('smart_pack_required');
    expect(await voiceRefusalOf(http(403, { ok: false, code: 'budget_exhausted' }))).toBe('limit');
    expect(await voiceRefusalOf(http(403, { ok: false, code: 'smart_pack_required' }))).toBe('smart_pack');
    expect(await voiceRefusalOf({ context: { status: 500 } })).toBe('failed');
  });
});

describe('every SMART PACK window shows it', () => {
  it('quote from a file: the line (no count of files any more) and the used-up message', async () => {
    const readFile = vi.fn(async () => ({ status: 'budget_exhausted', allowance: null }));
    render(<QuoteFromFileDialog isOpen isHebrew sym="₪" formatMoneyDisplay={(v) => Number(v).toFixed(2)} currency="ILS" catalog={[]} readFile={readFile}
      readAllowance={async () => ({ percentLeft: 12, unlimited: false })} onClose={vi.fn()} onApply={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('quote-from-file-allowance').textContent).toBe('נשארו לכם 12% משימוש חכם פלוס החודש'));
    const f = new File([new Uint8Array(4)], 'q.pdf', { type: 'application/pdf' }); Object.defineProperty(f, 'size', { value: 1000 });
    fireEvent.change(screen.getByTestId('quote-from-file-input'), { target: { files: [f] } });
    fireEvent.click(screen.getByTestId('quote-from-file-read'));
    expect(await screen.findByText('היתרה בחכם פלוס לחודש הזה לא מספיקה לפעולה הזו. היא מתחדשת בתחילת החודש הבא. בינתיים אפשר להמשיך ידנית.')).toBeTruthy();
  });
  it('the AI smart quote / smart edit: the line under the intro, read again after a draft; the used-up message', async () => {
    const readUsage = vi.fn().mockResolvedValueOnce({ percentLeft: 40, unlimited: false }).mockResolvedValue({ percentLeft: 0, unlimited: false });
    const requestDraft = vi.fn(async () => ({ status: 'budget_exhausted' }));
    render(<AiQuoteDraftDialog isOpen isHebrew={false} sym="$" formatMoneyDisplay={(n) => Number(n).toFixed(2)} onClose={vi.fn()} onApply={vi.fn()}
      onOpenChat={vi.fn()} requestDraft={requestDraft} readUsage={readUsage} />);
    await waitFor(() => expect(screen.getByTestId('ai-quote-draft-usage').textContent).toBe('40% of your SMART PACK usage left this month'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Replace three windows in the living room' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create a draft with AI' }));
    expect(await screen.findByText('Your SMART PACK usage left this month is not enough for this action. It renews at the start of next month. Meanwhile you can continue manually.')).toBeTruthy();
    await waitFor(() => expect(readUsage).toHaveBeenCalledTimes(2));
  });
});

describe("the Owner's cost view (L-22)", () => {
  const data = {
    ok: true, budgetIls: 4, usdIlsRate: 3.5,
    days: [{ day: '2026-11-06', feature: 'chat_data', stored: 3, refunded: 1, accounts: 2, promptTokens: 30000, completionTokens: 2000, costIls: 0.5145, costUsd: 0.147 },
      { day: '2026-11-06', feature: 'ai_draft', stored: 5, refunded: 0, accounts: 1, promptTokens: 7000, completionTokens: 2000, costIls: 0.0077, costUsd: 0.0022 }],
    accounts: [{ email: 'a@x.test', admin: false, actions: 6, costIls: 0.5, percentUsed: 12.5 }, { email: 'owner@x.test', admin: true, actions: 2, costIls: 0.0222, percentUsed: 0.6 }],
  };
  it('HE: totals in ILS, per account this month (the admin is not limited), per day and feature; the server is asked for 30 days', async () => {
    rpc.mockResolvedValue({ data, error: null });
    render(<AdminSmartPackUsage isHebrew />);
    await waitFor(() => expect(screen.getByTestId('admin-smart-pack-usage-table')).toBeTruthy());
    expect(rpc).toHaveBeenCalledWith('smart_pack_usage_admin', { p_days: 30 });
    expect(screen.getByTestId('admin-smart-pack-usage-kpi-stored').textContent).toBe('8');
    // the admin cost is in agorot (tiny provider costs) - checked as the sum of the rows, in US dollars too
    expect(screen.getByTestId('admin-smart-pack-usage-kpi-cost-ils').textContent.startsWith('₪')).toBe(true);
    expect(screen.getByTestId('admin-smart-pack-usage-kpi-cost-usd').textContent).toBe('$0.1492');
    expect(screen.getByTestId('admin-smart-pack-usage-kpi-accounts').textContent).toBe('2');
    const acc = screen.getByTestId('admin-smart-pack-usage-accounts');
    expect(acc.querySelector('tr[data-account="a@x.test"]').textContent).toContain('12.5%');
    expect(acc.querySelector('tr[data-account="owner@x.test"]').textContent).toContain('(חשבון הניהול)');
    expect(screen.getByTestId('admin-smart-pack-usage-table').querySelector('tr[data-feature="chat_data"]').textContent).toContain('צ׳אט שקורא נתונים');
  });
  it('a failed read says so; the screen is the Owner\'s only (system hub)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'super admin only' } });
    render(<AdminSmartPackUsage isHebrew={false} />);
    await waitFor(() => expect(screen.getByTestId('admin-smart-pack-usage-unavailable')).toBeTruthy());
    const d = ADMIN_DESTINATIONS.find((x) => x.id === 'smart-pack-usage');
    expect(d).toMatchObject({ hub: 'system', permission: 'owner', label: { he: 'שימוש בחכם פלוס', en: 'SMART PACK usage' } });
    expect(canOpenDestination(d, { owner: false, permissions: ['activity.view'] })).toBe(false);
  });
});
