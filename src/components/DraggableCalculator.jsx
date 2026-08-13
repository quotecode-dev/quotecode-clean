import React, { useState, useEffect, useRef } from 'react';

// נתונים זמניים של שערים (ניתן לחבר ל-API בעתיד)
const MOCK_RATES = {
  USD: 3.75,
  EUR: 4.05,
  GBP: 4.80,
  ILS: 1
};

export default function DraggableCalculator({ isOpen, onClose, isHebrew }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // מצב המחשבון
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('ILS');

  // מיקום החלון במרכז המסך בפעם הראשונה שהוא נפתח
  useEffect(() => {
    if (isOpen) {
      setPos({
        x: Math.max(0, (window.innerWidth - 300) / 2),
        y: Math.max(0, (window.innerHeight - 450) / 2)
      });
    }
  }, [isOpen]);

  // לוגיקת הגרירה (Drag & Drop)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPos({
        x: dragStart.current.posX + dx,
        y: Math.max(0, dragStart.current.posY + dy) // מונע בריחה מחוץ לחלק העליון של המסך
      });
    };
    
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
  };

  // אם החלון סגור, אל תרנדר כלום
  if (!isOpen) return null;

  // חישוב ההמרה
  const fromRate = MOCK_RATES[fromCurrency];
  const toRate = MOCK_RATES[toCurrency];
  const convertedAmount = ((Number(amount) || 0) * fromRate) / toRate;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: '300px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: isDragging ? '0 25px 50px rgba(0,0,0,0.25)' : '0 10px 30px rgba(0,0,0,0.15)',
        border: '1px solid #cbd5e1',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        opacity: isDragging ? 0.9 : 1,
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
        direction: isHebrew ? 'rtl' : 'ltr'
      }}
    >
      {/* כותרת החלון (Drag Handle) */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          background: '#4f46e5',
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
        title={isHebrew ? 'לחץ וגרור כדי להזיז' : 'Click and drag to move'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
          <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>
            {isHebrew ? 'טבלת שערים ומחשבון' : 'Rates & Calculator'}
          </span>
        </div>
        <button
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()} // מונע הפעלת גרירה בעת סגירה
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* גוף המחשבון */}
      <div style={{ padding: '16px', background: '#f8fafc' }}>
        
        {/* טבלת שערים */}
        <div style={{ marginBottom: '16px', background: 'white', borderRadius: '8px', padding: '12px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>
            {isHebrew ? 'שערים יציגים (סימולציה)' : 'Exchange Rates (Mock)'}
          </h4>
          <div style={{ display: 'grid', gap: '8px', fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '1rem' }}>🇺🇸</span> USD ($)</span>
              <span>₪{MOCK_RATES.USD}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderTop: '1px dashed #e2e8f0', borderBottom: '1px dashed #e2e8f0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '1rem' }}>🇪🇺</span> EUR (€)</span>
              <span>₪{MOCK_RATES.EUR}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ fontSize: '1rem' }}>🇬🇧</span> GBP (£)</span>
              <span>₪{MOCK_RATES.GBP}</span>
            </div>
          </div>
        </div>

        {/* מחשבון המרה */}
        <div style={{ background: 'white', borderRadius: '8px', padding: '12px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>
            {isHebrew ? 'מחשבון המרה' : 'Quick Converter'}
          </h4>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', fontWeight: '600', color: '#0f172a' }}
            />
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              style={{ width: '85px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', background: '#f1f5f9', outline: 'none', fontWeight: '700', color: '#334155', cursor: 'pointer' }}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="ILS">ILS</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <div style={{ flex: 1, padding: '8px 10px', border: '2px solid #4f46e5', borderRadius: '6px', fontSize: '0.95rem', background: '#eef2ff', color: '#4f46e5', fontWeight: '800', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              style={{ width: '85px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', background: '#f1f5f9', outline: 'none', fontWeight: '700', color: '#334155', cursor: 'pointer' }}
            >
              <option value="ILS">ILS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  );
}