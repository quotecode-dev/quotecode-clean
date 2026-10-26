// QA 2026-10-25 (the screens review, unlocked findings): recurring expenses, windows that close only after a successful save, the
// business card's failed load, the calendar "+N", the bell's failed mark, the email chip's missing address, and the settings sub-views.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { reportMonthRange, recurringMonthsInRange } from './utils/recurringExpense';
import EditExpenseModal from './components/EditExpenseModal';

afterEach(cleanup);
const src = (f) => readFileSync(f, 'utf8');

describe('recurring expenses count per month from their start (C5)', () => {
  const jan = { is_recurring: true, expense_date: '2026-01-10' };
  const oct = { is_recurring: true, expense_date: '2026-10-03' };
  const r = (type, month, extra = {}) => reportMonthRange({ type, year: 2026, month, ...extra });
  it('a yearly total equals the 12 chart months; quarters, halves and months follow the start month', () => {
    expect(recurringMonthsInRange(jan, r('yearly', 9))).toBe(12);
    expect(recurringMonthsInRange(jan, r('quarterly', 10))).toBe(3);
    expect(recurringMonthsInRange(jan, r('half-yearly', 2))).toBe(6);
    expect(recurringMonthsInRange(jan, r('monthly', 4))).toBe(1);
    expect(recurringMonthsInRange(oct, r('yearly', 0))).toBe(3);
    expect(recurringMonthsInRange(oct, r('monthly', 0))).toBe(0); // never before it was created
    const chartYear = Array.from({ length: 12 }, (_, m) => recurringMonthsInRange(oct, r('monthly', m))).reduce((a, b) => a + b, 0);
    expect(chartYear).toBe(recurringMonthsInRange(oct, r('yearly', 0)));
  });
  it('a custom range counts its own months; an open end stops at the current month', () => {
    expect(recurringMonthsInRange(jan, r('custom', 0, { startDate: '2026-03-01', endDate: '2026-05-31' }))).toBe(3);
    expect(recurringMonthsInRange(jan, reportMonthRange({ type: 'custom', now: new Date('2026-04-15') }))).toBe(4);
    expect(recurringMonthsInRange({ is_recurring: true, expense_date: null }, r('yearly', 0))).toBe(0);
  });
  it('the Dashboard totals use it (the chart keeps its month-by-month count)', () => {
    const d = src('src/pages/Dashboard.jsx');
    expect(d).toContain('sum + Number(exp.amount || 0) * expenseFactor(exp)');
    expect(d).toContain("if (exp.is_recurring) return recurringMonthsInRange(exp, expenseReportRange) > 0;");
  });
});

describe('windows close only after a successful save (C1)', () => {
  const expense = { id: 'e1', description: 'Rent', amount: 100, category: 'other', is_recurring: false };
  it('a failed expense save keeps the window open; a successful one closes it', async () => {
    const onClose = vi.fn();
    render(<EditExpenseModal isOpen expense={expense} onSave={vi.fn().mockResolvedValue(false)} onClose={onClose} isHebrew={false} t={{}} />);
    fireEvent.submit(document.querySelector('form'));
    await new Promise((res) => setTimeout(res, 0));
    expect(onClose).not.toHaveBeenCalled();
    cleanup();
    render(<EditExpenseModal isOpen expense={expense} onSave={vi.fn().mockResolvedValue(true)} onClose={onClose} isHebrew={false} t={{}} />);
    fireEvent.submit(document.querySelector('form'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
  it('the client window, the catalog add form and the expense drawer wait for the result too', () => {
    expect(src('src/components/EditClientModal.jsx')).toContain('.then((saved) => { if (saved !== false) onClose(); });');
    expect(src('src/components/ServicesCatalog.jsx')).toContain('Promise.resolve(handleAddService(e)).then((saved) => { if (saved !== false) setShowAddForm(false); });');
    expect(src('src/components/FinancesTab.jsx')).toContain('Promise.resolve(handleAddExpense(e)).then((saved) => { if (saved !== false) setShowAddExpenseForm(false); });');
  });
});

describe('screens (B3, C2, C3, C4, C6, C7, C8, C12, email chip)', () => {
  it('the business card: a failed load offers a retry and never offers to save over the stored card', () => {
    const s = src('src/components/BusinessCardSettings.jsx');
    expect(s).toContain("profile.load === 'failed' && (");
    expect(s).toContain('onClick={() => profile.reload()} data-testid="business-card-load-retry"');
    expect(s).toContain("|| profile.load === 'failed'} data-testid=\"card-save\"");
    expect(src('src/hooks/useBusinessCardProfile.js')).toContain('}, [client, userId, loadRun]);');
  });
  it('the calendar "+N" opens that day in the Day view', () => {
    expect(src('src/components/CalendarTab.jsx')).toContain("data-testid=\"calendar-more\" onClick={() => { setSelected(iso); setView('day'); }}");
  });
  it('the bell says when a mark was not stored', () => {
    const s = src('src/components/NotificationCenter.jsx');
    expect(s).toContain('setMarkFailed(!r.ok);');
    expect(s).toContain('data-testid="notification-mark-failed"');
  });
  it('the email chip checks the address before the confirmation', () => {
    const d = src('src/pages/Dashboard.jsx');
    const i = d.indexOf('const requestEmailSend = (quote) => {');
    const body = d.slice(i, d.indexOf('const executeEmailSend', i));
    expect(body.indexOf("alertWithBlocker('EMAIL_CLIENT_NO_EMAIL'")).toBeGreaterThan(0);
    expect(body.indexOf("alertWithBlocker('EMAIL_CLIENT_NO_EMAIL'")).toBeLessThan(body.indexOf('setPendingEmailQuote(quote);'));
  });
  it('the settings sub-views: a load-error text and retry, Back asks before unsaved changes are lost', () => {
    const rem = src('src/components/RemindersSettings.jsx');
    expect(rem).toContain("{load.code === 'unavailable' ? C.unavailable : C.loadFailed}");
    expect(rem).toContain('if (!dirty || window.confirm(C.leaveUnsaved)) onBack();');
    const share = src('src/components/ShareDefaultsSettings.jsx');
    expect(share).toContain('if (!unsaved || window.confirm(C.leaveUnsaved)) onBack();');
    expect(share).toContain('data-testid="share-defaults-retry"');
  });
  it('the task form tells the truth about the bell; the clients list says how to add the first client; the logo picker resets', () => {
    expect(src('src/components/TasksTab.jsx')).toContain('משימה שהגיע מועדה מופיעה בפעמון.');
    expect(src('src/components/ClientsTab.jsx')).toContain('עדיין אין לקוחות. לוחצים „לקוח חדש”');
    expect(src('src/components/SettingsTab.jsx')).toContain("if (e.target) e.target.value = '';");
  });
});
