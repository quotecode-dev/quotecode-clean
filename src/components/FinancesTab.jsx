// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (FinancesTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  reportYear,
  expenses,
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
    <div style={{ background: 'white', padding: '18px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '10px' }}>
         <h2 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
           {isHebrew ? 'הוצאות והכנסות ודוחות עסק' : 'Finances & Reports'}
         </h2>
         
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
           <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>{isHebrew ? 'סוג דוח:' : 'Report Type:'}</span>
           <select 
             value={financeReportType} 
             onChange={(e) => setFinanceReportType(e.target.value)}
             style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '0.8rem', fontWeight: 'bold', color: '#4f46e5' }}
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
        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', border: '1px solid #e2e8f0' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#64748b', marginBottom: '3px' }}>{isHebrew ? 'מתאריך:' : 'Start Date:'}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', background: 'white', fontSize: '0.8rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#64748b', marginBottom: '3px' }}>{isHebrew ? 'עד תאריך:' : 'End Date:'}</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '5px', background: 'white', fontSize: '0.8rem' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', borderRight: isHebrew ? '3px solid #4f46e5' : 'none', borderLeft: isHebrew ? 'none' : '3px solid #4f46e5' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginBottom: '3px' }}>{t.totalQuotes}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b' }}>{adminTotalQuotesCount}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', borderRight: isHebrew ? '3px solid #22c55e' : 'none', borderLeft: isHebrew ? 'none' : '3px solid #22c55e' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginBottom: '3px' }}>{t.totalRevenue}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#22c55e' }}>{sym}{formatNum(adminTotalRevenue)}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', borderRight: isHebrew ? '3px solid #ef4444' : 'none', borderLeft: isHebrew ? 'none' : '3px solid #ef4444' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginBottom: '3px' }}>{t.totalExpenses}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#ef4444' }}>{sym}{formatNum(adminTotalExpenses)}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', borderRight: isHebrew ? '3px solid #3b82f6' : 'none', borderLeft: isHebrew ? 'none' : '3px solid #3b82f6' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginBottom: '3px' }}>{t.netProfit}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: adminNetProfit >= 0 ? '#3b82f6' : '#ef4444' }}>{sym}{formatNum(adminNetProfit)}</div>
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px', height: '260px' }} dir="ltr">
         <h2 style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: '800', margin: 0, marginBottom: '12px', textAlign: isHebrew ? 'right' : 'left' }}>{isHebrew ? 'סקירה שנתית - הכנסות מול הוצאות' : 'Yearly Overview - Income vs Expenses'}</h2>
         <ResponsiveContainer width="100%" height="100%">
           <BarChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 20 }}>
             <CartesianGrid strokeDasharray="3 3" vertical={false} />
             <XAxis dataKey="name" />
             <YAxis />
             <Tooltip formatter={(value) => `${sym}${formatNum(value)}`} />
             <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '0.75rem' }} />
             <Bar dataKey={isHebrew ? 'הכנסות' : 'Income'} fill="#22c55e" radius={[3, 3, 0, 0]} />
             <Bar dataKey={isHebrew ? 'הוצאות' : 'Expenses'} fill="#ef4444" radius={[3, 3, 0, 0]} />
           </BarChart>
         </ResponsiveContainer>
      </div>

      <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '800', margin: 0 }}>{t.expensesManagement}</h2>
            <button 
              onClick={handleExportExpenses}
              style={{ background: '#10b981', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem' }}
            >
              📥 {isHebrew ? 'ייצא הוצאות לאקסל (CSV)' : 'Export Expenses CSV'}
            </button>
          </div>

          <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder={isHebrew ? 'תיאור ההוצאה (לדוגמה: אירוח שרת)' : 'Expense description'} 
              value={expenseDesc} 
              onChange={(e) => setExpenseDesc(e.target.value)} 
              required 
              style={{ flex: '2 1 140px', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: 'white' }} 
            />
            <input 
              type="number" 
              step="0.01" 
              placeholder={isHebrew ? 'סכום' : 'Amount'} 
              value={expenseAmount} 
              onChange={(e) => setExpenseAmount(e.target.value)} 
              required 
              style={{ flex: '1 1 70px', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontSize: '0.8rem', background: 'white' }} 
            />
            <select 
              value={expenseCategory} 
              onChange={(e) => setExpenseCategory(e.target.value)}
              style={{ flex: '1 1 110px', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', boxSizing: 'border-box', fontSize: '0.8rem', fontWeight: '400' }}
            >
              <option value="Hosting / Cloud">{isHebrew ? 'ענן ושרתים' : 'Hosting / Cloud'}</option>
              <option value="Marketing">{isHebrew ? 'שיווק ופרסום' : 'Marketing'}</option>
              <option value="Tools / Software">{isHebrew ? 'כלים ותוכנות' : 'Tools / Software'}</option>
              <option value="Other">{isHebrew ? 'אחר' : 'Other'}</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', color: '#475569' }}>
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
              {isHebrew ? 'הוצאה חודשית קבועה' : 'Recurring monthly'}
            </label>

            <button type="submit" style={{ background: '#ef4444', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.2)' }}>
              {t.addExpenseBtn}
            </button>
          </form>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '380px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.8rem' }}>
                      {isHebrew ? 'אין הוצאות בתקופה הנבחרת.' : 'No expenses in this period.'}
                    </td>
                  </tr>
                ) : (
                  filteredExpensesForReport.map((exp) => (
                    <tr key={exp.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 6px', fontWeight: '400', color: '#1e293b' }}>{exp.description}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{exp.category}</td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>
                        {exp.is_recurring ? (isHebrew ? '🔄 קבועה' : 'Recurring') : (isHebrew ? 'חד פעמית' : 'One-time')}
                      </td>
                      <td style={{ padding: '8px 6px', color: '#64748b' }}>{exp.expense_date}</td>
                      <td style={{ padding: '8px 6px', color: '#ef4444', fontWeight: '400' }}>{sym}{formatNum(exp.amount)}</td>
                      <td style={{ padding: '8px 6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button 
                          onClick={() => setEditingExpense(exp)}
                          style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          {isHebrew ? 'ערוך' : 'Edit'}
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(exp.id)}
                          style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '400', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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