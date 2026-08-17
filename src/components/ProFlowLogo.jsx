import React from 'react';

export default function ProFlowLogo({ size = 48, rtl = false, darkText = false, logoUrl = '', bizName = '' }) {
  // אם לא צוין במפורש darkText, נבדוק האם אנחנו בדשבורד לפי נתיב ה-URL
  const isDashboard = typeof window !== 'undefined' && window.location.pathname.includes('/dashboard');
  const shouldUseDarkText = darkText || isDashboard;

  // 1. אם יש לוגו תקין שהוגדר לעסק
  if (logoUrl && logoUrl.trim() !== '') {
    return (
      <div dir="ltr" style={{ display: 'flex', alignItems: 'center' }}>
        <img 
          src={logoUrl} 
          alt="Business Logo" 
          onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = bizName || 'ProFlow'; }}
          style={{ height: `${size}px`, width: 'auto', objectFit: 'contain', maxWidth: '180px' }} 
        />
      </div>
    );
  }

  // 2. אם אין לוגו, נציג את שם העסק אם קיים
  if (bizName && bizName.trim() !== '') {
    return (
      <span style={{ 
        fontSize: `${size * 0.6}px`, 
        fontWeight: '700', 
        color: shouldUseDarkText ? '#0f172a' : '#ffffff',
        fontFamily: 'Inter, Segoe UI, sans-serif'
      }}>
        {bizName}
      </span>
    );
  }

  // 3. ברירת מחדל: לוגו ProFlow
  return (
    <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {!rtl && (
        <div style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
          borderRadius: '12px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
          flexShrink: 0
        }}>
          <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      )}
      <span style={{ 
        fontSize: `${size * 0.75}px`, 
        fontWeight: '900', 
        letterSpacing: '-0.5px', 
        display: 'flex', 
        alignItems: 'center',
        fontFamily: 'Inter, Segoe UI, sans-serif'
      }}>
        <span style={{ color: shouldUseDarkText ? '#0f172a' : '#ffffff' }}>Pro</span>
        <span style={{ color: '#4f46e5', marginLeft: '2px' }}>Flow</span>
      </span>
      {rtl && (
        <div style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
          borderRadius: '12px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
          flexShrink: 0,
          marginLeft: '10px'
        }}>
          <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      )}
    </div>
  );
}