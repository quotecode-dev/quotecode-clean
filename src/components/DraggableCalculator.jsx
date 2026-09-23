// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (DraggableCalculator.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { useState, useEffect, useRef } from 'react';

export default function DraggableCalculator({ isOpen, onClose, isHebrew, currency }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  // Read inside the mount-scoped rate-fetch effect below without making it re-run/restart the
  // 10-minute interval on every language toggle (same non-goal as before this fix).
  const isHebrewRef = useRef(isHebrew);
  isHebrewRef.current = isHebrew;

  const [display, setDisplay] = useState('0');
  const [memory, setMemory] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [pendingOperator, setPendingOperator] = useState(null);

  const [rates, setRates] = useState({ USD: 1, EUR: 0.92, GBP: 0.79, ILS: 3.75, CAD: 1.35 });
  const [lastUpdated, setLastUpdated] = useState('');
  // Product Truth Registry fix (TEKANGO_AI_ARCHITECTURE.md v2.5 §52.3/§52.6, hardened for the Codex
  // fail-open finding, 2026-09-22): "Live (Cached)" used to be shown even when the live fetch FAILED
  // and hardcoded fallback constants were used - neither live nor a genuine cache of a prior
  // successful fetch. This flag makes that state truthfully distinguishable from an actually-
  // successful, validated live fetch. Starts `true` (fail-closed): the initial hardcoded state above
  // is never labelled "live" until a real, validated fetch proves otherwise.
  const [usingFallbackRates, setUsingFallbackRates] = useState(true);
  const [calcAmount, setCalcAmount] = useState('100');
  
  const isGlobal = currency && currency !== 'ILS';
  const defaultCurr = isGlobal ? currency : 'USD';
  const secondaryCurr = isGlobal ? (currency === 'GBP' ? 'USD' : 'GBP') : 'EUR';

  // PRODUCT_TRUTH_CAPABILITY: editor_currency_converter
  const [fromCurr, setFromCurr] = useState(defaultCurr);
  const [toCurr, setToCurr] = useState(secondaryCurr);

  useEffect(() => {
    if (currency && currency !== 'ILS') {
      setFromCurr(currency);
      setToCurr(currency === 'GBP' ? 'USD' : 'GBP');
    }
  }, [currency]);

  useEffect(() => {
    const FALLBACK_RATES = { USD: 1, EUR: 0.92, GBP: 0.79, ILS: 3.75, CAD: 1.35 };
    // Codex fail-open finding (2026-09-22): the previous version never checked `res.ok` and treated
    // "response has a truthy .rates" as the only success signal - a non-OK HTTP status whose body
    // still parsed as JSON, or a malformed/non-numeric rates object, silently left the PREVIOUS
    // (possibly still-hardcoded) state in place with no fallback flag ever set. Every currency this
    // widget actually offers (USD/EUR/GBP/ILS, §52.5/registry `currencies.values`) must be a real,
    // finite, positive number before a response is trusted as live.
    const REQUIRED_CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS'];
    const isValidRatesPayload = (data) => {
      if (!data || typeof data !== 'object' || !data.rates || typeof data.rates !== 'object') return false;
      return REQUIRED_CURRENCIES.every((code) => {
        const v = data.rates[code];
        return typeof v === 'number' && Number.isFinite(v) && v > 0;
      });
    };
    const applyFallback = () => {
      setRates(FALLBACK_RATES);
      setLastUpdated(isHebrewRef.current ? 'שערים קבועים (לא חי)' : 'Fallback rates (not live)');
      setUsingFallbackRates(true);
    };
    const fetchRates = async () => {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (!res.ok) { applyFallback(); return; }
        const data = await res.json();
        if (!isValidRatesPayload(data)) { applyFallback(); return; }
        setRates(data.rates);
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setUsingFallbackRates(false);
      } catch {
        applyFallback();
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
        fontFamily: 'system-ui, Arial, sans-serif',
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
        {/* PRODUCT_TRUTH_DECORATIVE: closes the draggable calculator/currency-converter popup, no calculation performed */}
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
              {usingFallbackRates
                ? (isHebrew ? 'שערים משוערים (לא חי, מתעדכן כל 10 דק\')' : 'Indicative rates (not live, refreshes every 10 min)')
                : isGlobal
                  ? (isHebrew ? 'שערים חיים מ-$ ל: (מתעדכן כל 10 דק\')' : 'Live rates from $ to: (updates every 10 min)')
                  : (isHebrew ? 'שערים יציגים מ-₪ ל: (מתעדכן כל 10 דק\')' : 'Live rates from ₪ to: (updates every 10 min)')}
            </span>
            <span style={{ fontSize: '0.65rem', color: usingFallbackRates ? '#b45309' : '#10b981', fontWeight: 'bold' }}>{lastUpdated}</span>
          </div>
          
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
          {/* PRODUCT_TRUTH_DECORATIVE: calculator 'C' clear-all key */}
          <button onClick={clearAll} style={btnStyle('#ef4444', '#fee2e2')}>C</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator square-root function key */}
          <button onClick={() => setDisplay(String(Math.sqrt(parseFloat(display))))} style={btnStyle('#10b981', '#d1fae5')}>√</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator percent function key */}
          <button onClick={() => setDisplay(String(parseFloat(display) / 100))} style={btnStyle('#10b981', '#d1fae5')}>%</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator division operator key */}
          <button onClick={() => performOperation('÷')} style={btnStyle('#3b82f6', '#dbeafe')}>÷</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator backspace key */}
          <button onClick={() => setDisplay(display.slice(0, -1) || '0')} style={btnStyle('#64748b', '#e2e8f0')}>⌫</button>

          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '7' */}
          <button onClick={() => inputDigit(7)} style={btnStyle('#334155', '#ffffff')}>7</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '8' */}
          <button onClick={() => inputDigit(8)} style={btnStyle('#334155', '#ffffff')}>8</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '9' */}
          <button onClick={() => inputDigit(9)} style={btnStyle('#334155', '#ffffff')}>9</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator multiplication operator key */}
          <button onClick={() => performOperation('×')} style={btnStyle('#3b82f6', '#dbeafe')}>×</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator memory-store key */}
          <button onClick={() => setMemory(parseFloat(display))} style={btnStyle('#8b5cf6', '#ede9fe')}>M+</button>

          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '4' */}
          <button onClick={() => inputDigit(4)} style={btnStyle('#334155', '#ffffff')}>4</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '5' */}
          <button onClick={() => inputDigit(5)} style={btnStyle('#334155', '#ffffff')}>5</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '6' */}
          <button onClick={() => inputDigit(6)} style={btnStyle('#334155', '#ffffff')}>6</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator subtraction operator key */}
          <button onClick={() => performOperation('-')} style={btnStyle('#3b82f6', '#dbeafe')}>-</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator memory-clear key */}
          <button onClick={() => setMemory(null)} style={btnStyle('#8b5cf6', '#ede9fe')}>MC</button>

          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '1' */}
          <button onClick={() => inputDigit(1)} style={btnStyle('#334155', '#ffffff')}>1</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '2' */}
          <button onClick={() => inputDigit(2)} style={btnStyle('#334155', '#ffffff')}>2</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '3' */}
          <button onClick={() => inputDigit(3)} style={btnStyle('#334155', '#ffffff')}>3</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator addition operator key */}
          <button onClick={() => performOperation('+')} style={btnStyle('#3b82f6', '#dbeafe')}>+</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator equals key */}
          <button onClick={handleEquals} style={{ ...btnStyle('#ffffff', '#10b981', 'bold'), gridRow: 'span 2', height: '100%' }}>=</button>

          {/* PRODUCT_TRUTH_DECORATIVE: calculator digit key '0' */}
          <button onClick={() => inputDigit(0)} style={{ ...btnStyle('#334155', '#ffffff'), gridColumn: 'span 2' }}>0</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator decimal point key */}
          <button onClick={inputDot} style={btnStyle('#334155', '#ffffff')}>.</button>
          {/* PRODUCT_TRUTH_DECORATIVE: calculator sign-toggle key */}
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