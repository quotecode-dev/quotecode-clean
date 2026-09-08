// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (FinancesTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, ReceiptText, Download, Pencil, Trash2, Repeat, FileText, Wallet, TrendingDown, TrendingUp, BarChart2 } from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW } from '../theme/neonTheme';

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
  // חוק ברזל (Consolidated Open UI Corrections task, §I5): שדות-יצירת-
  // הוצאה לא נשארים מוצגים-לצמיתות בתוך שורת-הכלים של הרשימה - עוברים
  // ל-drawer שנפתח ע"י "הוסף הוצאה"/"Add Expense" ראשי אחד (סגול).
  // handleAddExpense (הקיים) עדיין מבצע את היצירה בפועל.
  const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);

  const handleAddExpenseSubmit = (e) => {
    e.preventDefault();
    handleAddExpense(e);
    setShowAddExpenseForm(false);
  };

  // חוק ברזל (§I3 - real defect found and fixed): chartData (Dashboard.jsx)
  // בונה כל נקודת-נתון עם מפתחות אנגליים קבועים בלבד ({ name, Income,
  // Expenses }) - ללא שום ענף isHebrew. ה-<Bar dataKey> הקודם כאן החליף
  // לעומת זאת למפתחות עבריים ('הכנסות'/'הוצאות') כש-isHebrew===true -
  // מפתחות שלא קיימים בכלל על אובייקטי-הנתון, כך שב-Hebrew כל עמודות-
  // התרשים היו מגיעות ל-undefined/0 תמיד, גם כשקיימים נתונים אמיתיים.
  // תוקן: dataKey נשאר קבוע ותואם את הנתון האמיתי (Income/Expenses),
  // ואילו name (prop נפרד שכבר תומך בו Recharts, לתצוגת legend/tooltip
  // בלבד) הוא שנושא את התרגום - כך שהערך המוצג תמיד אמיתי בשתי השפות.
  const hasChartData = Array.isArray(chartData) && chartData.some((d) => Number(d.Income || 0) > 0 || Number(d.Expenses || 0) > 0);

  // חוק ברזל (Task F item 5): מגדיר מפורשות שכרטיסי-ה-KPI (adminTotalRevenue
  // וכו', הבנויים מ-filteredQuotesForReport/filteredExpensesForReport)
  // מתייחסים אך ורק לתקופה הנבחרת בבורר שמעליהם - בשונה מהתרשים
  // ("סקירה שנתית", שכבר מתויג-נכון ובלתי-תלוי בבורר). לא תרגום חדש: כל
  // תווית כאן היא בדיוק אותו טקסט הקיים כבר בכל <option> של הבורר למעלה.
  const periodLabelByType = {
    monthly: isHebrew ? 'חודשי' : 'Monthly',
    quarterly: isHebrew ? 'רבעוני' : 'Quarterly',
    'half-yearly': isHebrew ? 'חצי שנתי' : 'Half-Yearly',
    yearly: isHebrew ? 'שנתי' : 'Yearly',
    custom: isHebrew ? 'טווח מותאם' : 'Custom Range'
  };
  const currentPeriodLabel = periodLabelByType[financeReportType] || periodLabelByType.monthly;

  return (
    <div style={{ background: NEON.bgCard, padding: '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm }}>
      {/* חוק ברזל (§I1): כותרת פיננסים/Finances + טקסט-תומך על הכנסות/
          הוצאות/רווחיות, עם בורר-תקופה קומפקטי מיושר לצד הכותרת (לא שורה
          נפרדת). */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
          <BarChart3 size={18} color={NEON.violetLight} strokeWidth={2.2} />
          {isHebrew ? 'פיננסים' : 'Finances'}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={financeReportType}
            onChange={(e) => setFinanceReportType(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: RADIUS.sm, border: `1px solid ${NEON.borderStrong}`, background: NEON.bgInput, fontSize: '0.78rem', fontWeight: '700', color: NEON.violetLight }}
          >
            <option value="monthly">{isHebrew ? 'חודשי' : 'Monthly'}</option>
            <option value="quarterly">{isHebrew ? 'רבעוני' : 'Quarterly'}</option>
            <option value="half-yearly">{isHebrew ? 'חצי שנתי' : 'Half-Yearly'}</option>
            <option value="yearly">{isHebrew ? 'שנתי' : 'Yearly'}</option>
            <option value="custom">{isHebrew ? 'טווח מותאם' : 'Custom Range'}</option>
          </select>
        </div>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: NEON.textSecondary }}>
        {isHebrew ? 'מעקב אחר הכנסות, הוצאות ורווחיות העסק' : 'Track your business income, expenses, and profitability'}
      </p>

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

      {/* חוק ברזל (§I2): ארבעה כרטיסי-מדד עקביים, מבנה-כרטיס משותף אחד,
          צבע סמנטי בלבד (סגול=נייטרלי/מותג, ירוק=חיובי, אדום=שלילי). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, borderRight: isHebrew ? `3px solid ${NEON.violet}` : 'none', borderLeft: isHebrew ? 'none' : `3px solid ${NEON.violet}` }}>
          <div style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '600', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}><FileText size={12} color={NEON.violetLight} />{t.totalQuotes}</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: NEON.textPrimary }}>{adminTotalQuotesCount}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, borderRight: isHebrew ? '3px solid #22c55e' : 'none', borderLeft: isHebrew ? 'none' : '3px solid #22c55e' }}>
          <div style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '600', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}><Wallet size={12} color="#22c55e" />{t.totalRevenue}</div>
          <div className="pf-money" style={{ fontSize: '1.25rem', fontWeight: '800', color: '#22c55e' }}>{sym}{formatNum(adminTotalRevenue)}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, borderRight: isHebrew ? `3px solid ${NEON.red}` : 'none', borderLeft: isHebrew ? 'none' : `3px solid ${NEON.red}` }}>
          <div style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '600', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingDown size={12} color={NEON.red} />{t.totalExpenses}</div>
          <div className="pf-money" style={{ fontSize: '1.25rem', fontWeight: '800', color: NEON.red }}>{sym}{formatNum(adminTotalExpenses)}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, borderRight: isHebrew ? `3px solid ${adminNetProfit >= 0 ? '#22c55e' : NEON.red}` : 'none', borderLeft: isHebrew ? 'none' : `3px solid ${adminNetProfit >= 0 ? '#22c55e' : NEON.red}` }}>
          <div style={{ fontSize: '0.7rem', color: NEON.textSecondary, fontWeight: '600', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}><TrendingUp size={12} color={adminNetProfit >= 0 ? '#22c55e' : NEON.red} />{t.netProfit}</div>
          <div className="pf-money" style={{ fontSize: '1.25rem', fontWeight: '800', color: adminNetProfit >= 0 ? '#22c55e' : NEON.red }}>{sym}{formatNum(adminNetProfit)}</div>
        </div>
      </div>

      {/* חוק ברזל (Task F item 5): כיתוב זעיר ולא-פולשני מתחת לכרטיסי ה-KPI
          שמבהיר את התקופה שהם משקפים - ללא שינוי בשום חישוב. */}
      <p style={{ margin: '-12px 0 16px', fontSize: '0.7rem', color: NEON.textMuted, textAlign: isHebrew ? 'right' : 'left' }}>
        {isHebrew ? `נתונים לתקופה: ${currentPeriodLabel}` : `Figures for: ${currentPeriodLabel}`}
      </p>

      {/* חוק ברזל (§I3): תרשים אמיתי כשיש נתונים; מצב-ריק קומפקטי ומכוון
          כשאין (לא צירי-תרשים ריקים וגדולים). */}
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: `1px solid ${NEON.border}`, marginBottom: '20px', height: hasChartData ? '260px' : 'auto' }} dir="ltr">
         <h2 style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0, marginBottom: '12px', textAlign: isHebrew ? 'right' : 'left', ...neonGlowTextStyle }}>{isHebrew ? 'סקירה שנתית - הכנסות מול הוצאות' : 'Yearly Overview - Income vs Expenses'}</h2>
         {hasChartData ? (
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
               <Bar dataKey="Income" name={isHebrew ? 'הכנסות' : 'Income'} fill="#22c55e" radius={[3, 3, 0, 0]} />
               <Bar dataKey="Expenses" name={isHebrew ? 'הוצאות' : 'Expenses'} fill={NEON.red} radius={[3, 3, 0, 0]} />
             </BarChart>
           </ResponsiveContainer>
         ) : (
           <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ textAlign: isHebrew ? 'right' : 'left', padding: '18px 4px 6px', color: NEON.textMuted, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <BarChart2 size={18} color={NEON.textMuted} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.6 }} />
             {isHebrew ? 'אין עדיין נתונים לתקופה שנבחרה' : 'No data for the selected period yet'}
           </div>
         )}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: `1px solid ${NEON.border}`, marginBottom: '16px' }}>
          {/* חוק ברזל (§I4): "הוסף הוצאה"/"Add Expense" סגול-ראשי; ייצוא-CSV
              נשאר משני-ניטרלי ולא שולט בשורה. */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, ...neonGlowTextStyle }}>{t.expensesManagement}</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleExportExpenses}
                style={{ background: NEON.bgCardAlt, color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '7px 12px', borderRadius: RADIUS.sm, cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Download size={13} strokeWidth={2.5} />
                {isHebrew ? 'ייצוא CSV' : 'Export CSV'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddExpenseForm((prev) => !prev)}
                aria-expanded={showAddExpenseForm}
                style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '7px 14px', borderRadius: RADIUS.sm, cursor: 'pointer', fontWeight: '700', fontSize: '0.78rem', boxShadow: NEON.glowSoft, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <ReceiptText size={14} strokeWidth={2.4} />
                {t.addExpenseBtn}
              </button>
            </div>
          </div>

          {/* חוק ברזל (§I5): drawer מכוון (לא מוצג-לצמיתות) - description/
              category/amount/recurring/Save/Cancel יחד, ללא כפתור-שליחה
              תלוש בשורה נפרדת. אדום עדיין מייצג הוצאה (הערך עצמו/הכפתור-
              הישן) - הכפתור-הראשי-ליצירה עצמו הפך לסגול (§I6). */}
          {showAddExpenseForm && (
            <form onSubmit={handleAddExpenseSubmit} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-end', background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: RADIUS.sm, padding: '12px' }}>
              <div style={{ flex: '2 1 160px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: NEON.textSecondary, marginBottom: '4px' }}>{isHebrew ? 'תיאור' : 'Description'}</label>
                <input
                  type="text"
                  placeholder={isHebrew ? 'לדוגמה: אירוח שרת' : 'e.g. Server hosting'}
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  required
                  autoFocus
                  style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
                />
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: NEON.textSecondary, marginBottom: '4px' }}>{isHebrew ? 'קטגוריה' : 'Category'}</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', fontSize: '0.8rem' }}
                >
                  <option value="Hosting / Cloud">{isHebrew ? 'ענן ושרתים' : 'Hosting / Cloud'}</option>
                  <option value="Marketing">{isHebrew ? 'שיווק ופרסום' : 'Marketing'}</option>
                  <option value="Tools / Software">{isHebrew ? 'כלים ותוכנות' : 'Tools / Software'}</option>
                  <option value="Other">{isHebrew ? 'אחר' : 'Other'}</option>
                </select>
              </div>
              <div style={{ flex: '1 1 90px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: NEON.textSecondary, marginBottom: '4px' }}>{isHebrew ? 'סכום' : 'Amount'}</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={isHebrew ? 'סכום' : 'Amount'}
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, boxSizing: 'border-box', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', color: NEON.textSecondary, flexShrink: 0, padding: '7px 0' }}>
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                {isHebrew ? 'הוצאה חודשית קבועה' : 'Recurring monthly'}
              </label>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button type="submit" style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 16px', borderRadius: RADIUS.sm, fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', boxShadow: NEON.glowSoft }}>
                  {isHebrew ? 'שמור' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowAddExpenseForm(false)} style={{ background: NEON.bgCardAlt, color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '8px 16px', borderRadius: RADIUS.sm, fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
              </div>
            </form>
          )}

          {/* חוק ברזל (§I7, מורחב ב-Task F item 4): מצב-ריק מכוון כשאין
              הוצאות בתקופה - קומפקטי כבר מקודם, כעת מוסיף גם רמז-פעולה
              קצר (ללא ריפוד/גובה נוסף משמעותי) המפנה ל"הוסף הוצאה"
              הקיים ממש מעל, לא כפתור/action חדש. */}
          {filteredExpensesForReport.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 16px', color: NEON.textMuted, fontSize: '0.85rem', border: `1px dashed ${NEON.border}`, borderRadius: RADIUS.sm }}>
              {isHebrew ? 'אין הוצאות בתקופה הנבחרת.' : 'No expenses in this period.'}
              <div style={{ fontSize: '0.75rem', marginTop: '4px', color: NEON.textMuted, opacity: 0.8 }}>
                {isHebrew ? `לחצו על "${t.addExpenseBtn}" כדי להוסיף אחת.` : `Click "${t.addExpenseBtn}" to add one.`}
              </div>
            </div>
          ) : (
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
                  {filteredExpensesForReport.map((exp) => (
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
                        {/* חוק ברזל (§K, real defect found+fixed): {t.delete}
                            הוחלף בתווית נקודתית - אותה תקלה שכבר תוקנה
                            ב-ClientsTab.jsx/ServicesCatalog.jsx. */}
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.description)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: NEON.red, border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '400', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Trash2 size={12} color={NEON.red} strokeWidth={2.5} />
                          {isHebrew ? 'מחק' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
