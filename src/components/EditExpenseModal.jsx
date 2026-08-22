// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (EditExpenseModal.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import React, { useState, useEffect } from 'react';

export default function EditExpenseModal({ isOpen, onClose, expense, onSave, isHebrew }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Hosting / Cloud');
  const [isRecurring, setIsRecurring] = useState(false);

  useEffect(() => {
    if (expense) {
      setDescription(expense.description || '');
      setAmount(expense.amount || '');
      setCategory(expense.category || 'Hosting / Cloud');
      setIsRecurring(expense.is_recurring || false);
    }
  }, [expense]);

  if (!isOpen || !expense) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...expense,
      description,
      amount: Number(amount),
      category,
      is_recurring: isRecurring
    });
    onClose();
  };

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: isHebrew ? 'right' : 'left', position: 'relative' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>✕</button>

        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '16px', fontWeight: '800' }}>
          {isHebrew ? 'עריכת הוצאה' : 'Edit Expense'}
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'תיאור ההוצאה' : 'Description'}</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} required style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'סכום' : 'Amount'}</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'קטגוריה' : 'Category'}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}>
                <option value="Hosting / Cloud">{isHebrew ? 'ענן ושרתים' : 'Hosting / Cloud'}</option>
                <option value="Marketing">{isHebrew ? 'שיווק ופרסום' : 'Marketing'}</option>
                <option value="Tools / Software">{isHebrew ? 'כלים ותוכנות' : 'Tools / Software'}</option>
                <option value="Other">{isHebrew ? 'אחר' : 'Other'}</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} id="edit-recurring-checkbox" />
              <label htmlFor="edit-recurring-checkbox" style={{ fontWeight: '600', color: '#475569', cursor: 'pointer' }}>{isHebrew ? 'הוצאה חודשית קבועה' : 'Recurring monthly'}</label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
              {isHebrew ? 'ביטול' : 'Cancel'}
            </button>
            <button type="submit" style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
              {isHebrew ? 'שמור שינויים' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}