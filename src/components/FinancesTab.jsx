// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (FinancesTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, Download, Pencil, Trash2, Repeat, FileText, Wallet, TrendingDown, TrendingUp } from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle } from '../theme/neonTheme';

export default function FinancesTab({
  financeReportType,
  setFinanceReportType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  adminTotalQuotesCount,
  adminTotalRevenue,
  adminTotalExpenses,
  adminNetProfit,
  chartData,
  filteredExpensesForReport,
  expenseDesc,
  setExpenseDesc,
  expenseAmount,
  setExpenseAmount,
  expenseCategory,
  setExpenseCategory,
  isRecurring,
  setIsRecurring,
  handleAddExpense,
  handleExportExpenses,
  setEditingExpense,
  handleDeleteExpense,
  isHebrew,
  sym,
  formatNum,
  t
}) {
  return (
    <div style={{ background: NEON.bgCard, padding: '18px', borderRadius: '14px', border: `1px solid ${NEON.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '10px' }}>
         <h2 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
           <BarChart3 size={18} color={NEON.emerald} strokeWidth={2.2} />
           {isHebrew ? 'הוצאות והכנסות ודוחות עסק' : 'Finances & Reports'}
         </h2>

         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
           <span style={{ fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary }}>{isHebrew ? 'סוג דוח:' : 'Report Type:'}</span>
           <select
             value={financeReportType}
             onChange={(e) => setFinanceReportType(e.target.value)}
             style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${NEON.borderStrong}`, background: NEON.bgInput, fontSize: '0.8rem', fontWeight: 'bold', color: NEON.violetLight }}
           >
             <option value="monthly">{isHebrew ? 'חודשי (מתחיל מאפס כל חודש)' : 'Monthly'}</option>
             <option value="quarterly">{isHebrew ? 'רבעוני (3 חודשים)' : 'Quarterly'}</option>
             <option value="half-yearly">{isHebrew ? 'חצי שנתי (6 חודשים)' : 'Half-Yearly'}</option>
             <option value="yearly">{isHebrew ? 'שנתי (12 חודשים)' : 'Yearly'}</option>
             <option value="custom">{isHebrew ? 'בחירת טווח תאריכים אישי' : 'Custom Date Range'}</option>
           </select>
         </div>
      </div>

      {financeReportType === 'custom' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', border: `1px solid ${NEON.border}` }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'מתאריך:' : 'Start Date:'}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '5px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'עד תאריך:' : 'End Date:'}</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '5px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, borderRight: isHebrew ? `3px solid ${NEON.violet}` : 'none', borderLeft: isHebrew ? 'none' : `3px solid ${NEON.violet}` }}>
          <div style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '600', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}><FileText size={12} color={NEON.violetLight} />{t.totalQuotes}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: NEON.textPrimary }}>{adminTotalQuotesCount}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, borderRight: isHebrew ? '3px solid #22c55e' : 'none', borderLeft: isHebrew ? 'none' : '3px solid #22c55e' }}>
          <div style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '600', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}><Wallet size={12} color="#22c55e" />{t.totalRevenue}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#22c55e' }}>{sym}{formatNum(adminTotalRevenue)}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, borderRight: isHebrew ? `3px solid ${NEON.red}` : 'none', borderLeft: isHebrew ? 'none' : `3px solid ${NEON.red}` }}>
          <div style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '600', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingDown size={12} color={NEON.red} />{t.totalExpenses}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: NEON.red }}>{sym}{formatNum(adminTotalExpenses)}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, borderRight: isHebrew ? `3px solid ${NEON.sky}` : 'none', borderLeft: isHebrew ? 'none' : `3px solid ${NEON.sky}` }}>
          <div style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '600', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingUp size={12} color={adminNetProfit >= 0 ? NEON.sky : NEON.red} />{t.netProfit}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: adminNetProfit >= 0 ? NEON.sky : NEON.red }}>{sym}{formatNum(adminNetProfit)}</div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: `1px solid ${NEON.border}`, marginBottom: '20px', height: '260px' }} dir="ltr">
         <h2 style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0, marginBottom: '12px', textAlign: isHebrew ? 'right' : 'left', ...neonGlowTextStyle }}>{isHebrew ? 'סקירה שנתית - הכנסות מול הוצאות' : 'Yearly Overview - Income vs Expenses'}</h2>
         <ResponsiveContainer width="100%" height="100%">
           <BarChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 20 }}>
             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
             <XAxis dataKey="name" stroke={NEON.textMuted} tick={{ fill: NEON.textMuted, fontSize: 11 }} />
             <YAxis stroke={NEON.textMuted} tick={{ fill: NEON.textMuted, fontSize: 11 }} />
             <Tooltip
               formatter={(value) => `${sym}${formatNum(value)}`}
               contentStyle={{ background: NEON.bgElevated, border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', color: NEON.textPrimary }}
               labelStyle={{ color: NEON.textPrimary }}
             />
             <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '0.75rem', color: NEON.textSecondary }} />
             <Bar dataKey={isHebrew ? 'הכנסות' : 'Income'} fill="#22c55e" radius={[3, 3, 0, 0]} />
             <Bar dataKey={isHebrew ? 'הוצאות' : 'Expenses'} fill={NEON.red} radius={[3, 3, 0, 0]} />
           </BarChart>
         </ResponsiveContainer>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: `1px solid ${NEON.border}`, marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, ...neonGlowTextStyle }}>{t.expensesManagement}</h2>
            <button
              onClick={handleExportExpenses}
              style={{ background: NEON.emeraldDark, color: 'white', border: 'none', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <Download size={13} strokeWidth={2.5} />
              {isHebrew ? 'ייצא הוצאות לאקסל (CSV)' : 'Export Expenses CSV'}
            </button>
          </div>

          <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder={isHebrew ? 'תיאור ההוצאה (לדוגמה: אירוח שרת)' : 'Expense description'}
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              required
              style={{ flex: '2 1 140px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
            />
            <input
              type="number"
              step="0.01"
              placeholder={isHebrew ? 'סכום' : 'Amount'}
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              required
              style={{ flex: '1 1 70px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
            />
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              style={{ flex: '1 1 110px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', fontSize: '0.8rem', fontWeight: '400' }}
            >
              <option value="Hosting / Cloud">{isHebrew ? 'ענן ושרתים' : 'Hosting / Cloud'}</option>
              <option value="Marketing">{isHebrew ? 'שיווק ופרסום' : 'Marketing'}</option>
              <option value="Tools / Software">{isHebrew ? 'כלים ותוכנות' : 'Tools / Software'}</option>
              <option value="Other">{isHebrew ? 'אחר' : 'Other'}</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', color: NEON.textSecondary }}>
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
              {isHebrew ? 'הוצאה חודשית קבועה' : 'Recurring monthly'}
            </label>

            <button type="submit" style={{ background: NEON.redDark, color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontWeight: '600', fontSize: '0.8rem', boxShadow: '0 2px 10px -2px rgba(239, 68, 68, 0.4)' }}>
              {t.addExpenseBtn}
            </button>
          </form>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '380px' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${NEON.border}`, color: NEON.textSecondary, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '6px' }}>{t.description}</th>
                  <th style={{ padding: '6px' }}>{isHebrew ? 'קטגוריה' : 'Category'}</th>
                  <th style={{ padding: '6px' }}>{isHebrew ? 'סוג' : 'Type'}</th>
                  <th style={{ padding: '6px' }}>{isHebrew ? 'תאריך' : 'Date'}</th>
                  <th style={{ padding: '6px' }}>{t.total}</th>
                  <th style={{ padding: '6px' }}>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpensesForReport.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: NEON.textMuted, fontSize: '0.8rem' }}>
                      {isHebrew ? 'אין הוצאות בתקופה הנבחרת.' : 'No expenses in this period.'}
                    </td>
                  </tr>
                ) : (
                  filteredExpensesForReport.map((exp) => (
                    <tr key={exp.id} style={{ borderBottom: `1px solid ${NEON.border}`, fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 6px', fontWeight: '400', color: NEON.textPrimary }}>{exp.description}</td>
                      <td style={{ padding: '8px 6px', color: NEON.textSecondary }}>{exp.category}</td>
                      <td style={{ padding: '8px 6px', color: NEON.textSecondary }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {exp.is_recurring && <Repeat size={11} color={NEON.violetLight} />}
                          {exp.is_recurring ? (isHebrew ? 'קבועה' : 'Recurring') : (isHebrew ? 'חד פעמית' : 'One-time')}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', color: NEON.textSecondary }}>{exp.expense_date}</td>
                      <td style={{ padding: '8px 6px', color: NEON.red, fontWeight: '400' }}>{sym}{formatNum(exp.amount)}</td>
                      <td style={{ padding: '8px 6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          onClick={() => setEditingExpense(exp)}
                          style={{ background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Pencil size={12} color={NEON.violetLight} strokeWidth={2.5} />
                          {isHebrew ? 'ערוך' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.description)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: NEON.red, border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '400', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Trash2 size={12} color={NEON.red} strokeWidth={2.5} />
                          {t.delete}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
