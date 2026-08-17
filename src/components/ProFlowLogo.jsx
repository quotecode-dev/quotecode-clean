import React from 'react';

export default function ProFlowLogo({ size = 48, rtl = false, darkText = false, logoUrl = '' }) {
  // אם לא צוין במפורש darkText, נבדוק האם אנחנו בדשבורד לפי נתיב ה-URL
  const isDashboard = typeof window !== 'undefined' && window.location.pathname.includes('/dashboard');
  const shouldUseDarkText = darkText || isDashboard;

  // אם יש לוגו אישי שהוגדר לעסק, נציג אותו ישירות בגודל המותאם
  if (logoUrl) {
    return (
      <div dir="ltr" style={{ display: 'flex', alignItems: 'center' }}>
        <img 
          src={logoUrl} 
          alt="Business Logo" 
          style={{ height: `${size}px`, width: 'auto', objectFit: 'contain', maxWidth: '180px' }} 
        />
      </div>
    );
  }

  return (
    <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {/* Icon Box */}
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

      {/* Text */}
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

      {/* Icon Box for RTL */}
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