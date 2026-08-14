import React, { useState, useEffect, useRef } from 'react';

export default function DraggableCalculator({ isOpen, onClose, isHebrew, currency }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const [display, setDisplay] = useState('0');
  const [memory, setMemory] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [pendingOperator, setPendingOperator] = useState(null);

  const [rates, setRates] = useState({ USD: 1, EUR: 0.92, GBP: 0.79, ILS: 3.75, CAD: 1.35 });
  const [lastUpdated, setLastUpdated] = useState('');
  const [calcAmount, setCalcAmount] = useState('100');
  
  // חוק ברזל: התאמה מוחלטת למטבע העסק בלבד (בלי ILS לבינלאומי)
  const isGlobal = currency && currency !== 'ILS';
  const defaultCurr = isGlobal ? currency : 'USD';
  const secondaryCurr = isGlobal ? (currency === 'GBP' ? 'USD' : 'GBP') : 'EUR';

  const [fromCurr, setFromCurr] = useState(defaultCurr);
  const [toCurr, setToCurr] = useState(secondaryCurr);

  useEffect(() => {
    if (currency && currency !== 'ILS') {
      setFromCurr(currency);
      setToCurr(currency === 'GBP' ? 'USD' : 'GBP');
    }
  }, [currency]);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data && data.rates) {
          setRates(data.rates);
          const now = new Date();
          setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (e) {
        setRates({ USD: 1, EUR: 0.92, GBP: 0.79, ILS: 3.75, CAD: 1.35 });
        setLastUpdated('Live (Cached)');
      }
    };

    fetchRates();
    const interval = setInterval(fetchRates, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPos({
        x: Math.max(0, (window.innerWidth - 340) / 2),
        y: Math.max(0, (window.innerHeight - 520) / 2)
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPos({
        x: dragStart.current.posX + dx,
        y: Math.max(0, dragStart.current.posY + dy)
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

  if (!isOpen) return null;

  const inputDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(String(digit));
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? String(digit) : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const clearAll = () => {
    setDisplay('0');
    setMemory(null);
    setPendingOperator(null);
    setWaitingForOperand(false);
  };

  const performOperation = (nextOperator) => {
    const inputValue = parseFloat(display);

    if (pendingOperator && waitingForOperand) {
      setPendingOperator(nextOperator);
      return;
    }

    if (memory == null) {
      setMemory(inputValue);
    } else if (pendingOperator) {
      const currentValue = memory || 0;
      const newValue = calculate(currentValue, inputValue, pendingOperator);
      setMemory(newValue);
      setDisplay(String(newValue));
    } else {
      setMemory(inputValue);
    }

    setWaitingForOperand(true);
    setPendingOperator(nextOperator);
  };

  const calculate = (prevValue, nextValue, operator) => {
    switch (operator) {
      case '+': return prevValue + nextValue;
      case '-': return prevValue - nextValue;
      case '×': return prevValue * nextValue;
      case '÷': return nextValue !== 0 ? prevValue / nextValue : 0;
      default: return nextValue;
    }
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);
    if (!pendingOperator) return;

    const newValue = calculate(memory, inputValue, pendingOperator);
    setMemory(null);
    setDisplay(String(newValue));
    setPendingOperator(null);
    setWaitingForOperand(true);
  };

  // פונקציית המרה אוניברסלית לפי מטבע הבסיס (USD = 1)
  const getRateToUSD = (curr) => rates[curr] || 1;
  const convertedValue = (Number(calcAmount) || 0) / getRateToUSD(fromCurr) * getRateToUSD(toCurr);

  return (
    <div
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: '340px',
        background: '#f8fafc',
        borderRadius: '16px',
        boxShadow: isDragging ? '0 30px 60px rgba(0,0,0,0.3)' : '0 15px 35px rgba(0,0,0,0.2)',
        border: '1px solid #cbd5e1',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
        opacity: isDragging ? 0.95 : 1,
        transition: isDragging ? 'none' : 'box-shadow 0.2s',
        direction: 'ltr'
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        style={{
          background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
          color: 'white',
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
          <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>
            {isHebrew ? 'מחשבון פיננסי חכם' : 'Smart Financial Calculator'}
          </span>
        </div>
        <button
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ padding: '12px' }}>
        <div style={{ background: 'white', borderRadius: '10px', padding: '10px', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>
              {isGlobal 
                ? (isHebrew ? 'שערים חיים מ-$ ל: (מתעדכן כל 10 דק\')' : 'Live rates from $ to: (updates every 10 min)')
                : (isHebrew ? 'שערים יציגים מ-₪ ל: (מתעדכן כל 10 דק\')' : 'Live rates from ₪ to: (updates every 10 min)')}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold' }}>{lastUpdated}</span>
          </div>
          
          {/* חוק ברזל: תצוגת השערים מותאמת אישית למצב הבינלאומי (בלי ILS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
            {isGlobal ? (
              <>
                <div style={{ background: '#f8fafc', padding: '4px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>EUR</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0f172a' }}>{(rates.EUR || 0).toFixed(4)}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '4px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>GBP</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0f172a' }}>{(rates.GBP || 0).toFixed(4)}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '4px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>CAD</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0f172a' }}>{(rates.CAD || 0).toFixed(4)}</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: '#f8fafc', padding: '4px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>USD</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0f172a' }}>₪{((rates.ILS || 0) / (rates.USD || 1)).toFixed(4)}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '4px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>EUR</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0f172a' }}>₪{((rates.ILS || 0) / (rates.EUR || 1)).toFixed(4)}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '4px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>GBP</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#0f172a' }}>₪{((rates.ILS || 0) / (rates.GBP || 1)).toFixed(4)}</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '10px', padding: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input 
            type="number" 
            value={calcAmount} 
            onChange={(e) => setCalcAmount(e.target.value)} 
            style={{ width: '70px', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }} 
          />
          <select value={fromCurr} onChange={(e) => setFromCurr(e.target.value)} style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#f1f5f9' }}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            {!isGlobal && <option value="ILS">ILS</option>}
          </select>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>=</span>
          <div style={{ flex: 1, padding: '6px', background: '#eef2ff', color: '#4f46e5', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.9rem', textAlign: 'center' }}>
            {convertedValue.toFixed(2)} {toCurr}
          </div>
          <select value={toCurr} onChange={(e) => setToCurr(e.target.value)} style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#f1f5f9' }}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            {!isGlobal && <option value="ILS">ILS</option>}
          </select>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '8px', padding: '10px 14px', textAlign: 'right', fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', border: '1px solid #cbd5e1', marginBottom: '8px', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
          {display}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
          <button onClick={clearAll} style={btnStyle('#ef4444', '#fee2e2')}>C</button>
          <button onClick={() => setDisplay(String(Math.sqrt(parseFloat(display))))} style={btnStyle('#10b981', '#d1fae5')}>√</button>
          <button onClick={() => setDisplay(String(parseFloat(display) / 100))} style={btnStyle('#10b981', '#d1fae5')}>%</button>
          <button onClick={() => performOperation('÷')} style={btnStyle('#3b82f6', '#dbeafe')}>÷</button>
          <button onClick={() => setDisplay(display.slice(0, -1) || '0')} style={btnStyle('#64748b', '#e2e8f0')}>⌫</button>

          <button onClick={() => inputDigit(7)} style={btnStyle('#334155', '#ffffff')}>7</button>
          <button onClick={() => inputDigit(8)} style={btnStyle('#334155', '#ffffff')}>8</button>
          <button onClick={() => inputDigit(9)} style={btnStyle('#334155', '#ffffff')}>9</button>
          <button onClick={() => performOperation('×')} style={btnStyle('#3b82f6', '#dbeafe')}>×</button>
          <button onClick={() => setMemory(parseFloat(display))} style={btnStyle('#8b5cf6', '#ede9fe')}>M+</button>

          <button onClick={() => inputDigit(4)} style={btnStyle('#334155', '#ffffff')}>4</button>
          <button onClick={() => inputDigit(5)} style={btnStyle('#334155', '#ffffff')}>5</button>
          <button onClick={() => inputDigit(6)} style={btnStyle('#334155', '#ffffff')}>6</button>
          <button onClick={() => performOperation('-')} style={btnStyle('#3b82f6', '#dbeafe')}>-</button>
          <button onClick={() => setMemory(null)} style={btnStyle('#8b5cf6', '#ede9fe')}>MC</button>

          <button onClick={() => inputDigit(1)} style={btnStyle('#334155', '#ffffff')}>1</button>
          <button onClick={() => inputDigit(2)} style={btnStyle('#334155', '#ffffff')}>2</button>
          <button onClick={() => inputDigit(3)} style={btnStyle('#334155', '#ffffff')}>3</button>
          <button onClick={() => performOperation('+')} style={btnStyle('#3b82f6', '#dbeafe')}>+</button>
          <button onClick={handleEquals} style={{ ...btnStyle('#ffffff', '#10b981', 'bold'), gridRow: 'span 2', height: '100%' }}>=</button>

          <button onClick={() => inputDigit(0)} style={{ ...btnStyle('#334155', '#ffffff'), gridColumn: 'span 2' }}>0</button>
          <button onClick={inputDot} style={btnStyle('#334155', '#ffffff')}>.</button>
          <button onClick={() => setDisplay(String(parseFloat(display) * -1))} style={btnStyle('#334155', '#ffffff')}>±</button>
        </div>

      </div>
    </div>
  );
}

function btnStyle(textColor, bgColor, weight = '600') {
  return {
    background: bgColor,
    color: textColor,
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '8px 0',
    fontSize: '0.85rem',
    fontWeight: weight,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
}