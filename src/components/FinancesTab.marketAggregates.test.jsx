// IRON-MARKET-004 (rendered): the Finances revenue KPI shows one token per persisted quote currency (approved/paid only - the
// unchanged revenue definition is applied by Dashboard before grouping), and net profit is never computed across currencies.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FinancesTab from './FinancesTab';
import { totalsByQuoteCurrency, formatMoneyForCurrency } from '../utils/money';

const noop = vi.fn();
const strip = (x) => x.replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
const t = { totalQuotes: 'Total quotes', totalRevenue: 'Total revenue', totalExpenses: 'Total expenses', netProfit: 'Net profit',
  expensesManagement: 'Expenses', addExpenseBtn: 'Add expense', description: 'Description', total: 'Total', actions: 'Actions', delete: 'Delete' };
const isRevenue = (q) => ['approved', 'paid'].includes(q.status);
const HISTORY = [
  { currency: 'USD', total: 100.25, status: 'approved' }, { currency: 'USD', total: 50.75, status: 'paid' },
  { currency: 'EUR', total: 200.4, status: 'paid' }, { currency: 'GBP', total: 80.1, status: 'approved' }, { currency: 'EUR', total: 999, status: 'sent' },
];
// Dashboard: netProfit is a number only when every revenue amount is in the account currency (expenses have no currency column)
const netProfitFor = (totals, account, expenses) => (totals.unknownCount === 0 && totals.groups.every((g) => g.currency === account)
  ? (totals.groups[0]?.total || 0) - expenses : null);
const renderTab = (account, quotes, expenses = 50, isHebrew = false) => {
  const totals = totalsByQuoteCurrency(quotes.filter(isRevenue), { accountCurrency: account });
  return render(<FinancesTab financeReportType="monthly" setFinanceReportType={noop} startDate="" setStartDate={noop} endDate="" setEndDate={noop}
    adminTotalQuotesCount={quotes.filter(isRevenue).length} adminRevenueTotals={totals} adminTotalExpenses={expenses}
    adminNetProfit={netProfitFor(totals, account, expenses)} chartData={[]} chartIncomeCurrencies={[]} accountCurrency={account}
    filteredExpensesForReport={[]} expenseDesc="" setExpenseDesc={noop} expenseAmount="" setExpenseAmount={noop} expenseCategory="General"
    setExpenseCategory={noop} isRecurring={false} setIsRecurring={noop} handleAddExpense={noop} handleExportExpenses={noop}
    setEditingExpense={noop} handleDeleteExpense={noop} isHebrew={isHebrew} sym={{ ILS: '₪', USD: '$', EUR: '€', GBP: '£' }[account]}
    formatMoneyDisplay={(v, cur) => formatMoneyForCurrency(v, cur || account)} t={t} />);
};
const revenueCard = () => screen.getByText('Total revenue').closest('.pf-kpi-card');
const netCard = () => screen.getByText('Net profit').closest('.pf-kpi-card');

describe('IRON-MARKET-004 Finances revenue and net profit', () => {
  it('revenue (approved/paid only) is shown per currency: €200.40 · $151.00 · £80.10 - never a single mixed total', () => {
    renderTab('EUR', HISTORY);
    const tokens = [...revenueCard().querySelectorAll('.pf-money[data-currency]')].map((e) => strip(e.textContent));
    expect(tokens).toEqual(['€200.40', '$151.00', '£80.10']); // the 'sent' EUR 999 is not revenue
    expect(strip(revenueCard().textContent)).not.toMatch(/431\.50|1,430\.50/);
  });

  it('net profit across several currencies is shown as not computable (no number, no conversion)', () => {
    renderTab('EUR', HISTORY);
    expect(netCard().querySelector('[data-net-profit="not-computable"]')).not.toBeNull();
    expect(netCard().querySelector('.pf-money')).toBeNull();
  });

  it('single account-currency revenue keeps the existing number: revenue minus expenses', () => {
    renderTab('EUR', [{ currency: 'EUR', total: 200.4, status: 'paid' }], 50);
    expect(strip(revenueCard().textContent)).toContain('€200.40');
    expect(strip(netCard().textContent)).toContain('€150.40');
  });

  it('Local/ILS single currency keeps whole shekels (IRON-ILS-001)', () => {
    renderTab('ILS', [{ currency: 'ILS', total: 1227.5, status: 'approved' }], 27.4, true);
    expect(strip(revenueCard().textContent)).toContain('₪1,228.00');
    expect(strip(netCard().textContent)).toContain('₪1,200.00'); // 1200.10 -> 1,200.00
  });
});
