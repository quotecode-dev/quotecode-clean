import React from 'react';

export default function PublicQuoteHeader({ isHebrew, bizLogo, bizName, bizTaxId, bizPhone, bizEmail, bizAddress, quote }) {
  const hasLogo = bizLogo && bizLogo.length > 5;

  return (
    <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '25px', marginBottom: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
        
        {/* צד לוגו/שם העסק */}
        <div style={{ flex: '1 1 200px', textAlign: isHebrew ? 'right' : 'left' }}>
          {hasLogo ? (
            <img src={bizLogo} alt={bizName} style={{ maxHeight: '60px', maxWidth: '160px', objectFit: 'contain', marginBottom: '10px' }} />
          ) : (
            <h2 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', color: '#0f172a' }}>{bizName}</h2>
          )}
          
          <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5' }}>
            {bizTaxId && <div>{isHebrew ? 'ח.פ / עוסק:' : 'Tax ID:'} {bizTaxId}</div>}
            {bizPhone && <div>{isHebrew ? 'טלפון:' : 'Phone:'} {bizPhone}</div>}
            {bizEmail && <div>{bizEmail}</div>}
            {bizAddress && <div>{bizAddress}</div>}
          </div>
        </div>

        {/* תיבת פרטי הצעת המחיר */}
        <div style={{ textAlign: 'center', background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', minWidth: '180px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '5px' }}>{isHebrew ? 'הצעת מחיר' : 'Price Quote'}</div>
          <div style={{ color: '#4f46e5', fontWeight: 'bold', fontFamily: 'monospace' }}>#{quote.id?.slice(0, 8)}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>
            {isHebrew ? 'תאריך:' : 'Date:'} {new Date(quote.created_at).toLocaleDateString(isHebrew ? 'he-IL' : 'en-GB')}
          </div>
          {quote.valid_until && (
            <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 'bold' }}>
              {isHebrew ? 'בתוקף עד:' : 'Valid until:'} {new Date(quote.valid_until).toLocaleDateString(isHebrew ? 'he-IL' : 'en-GB')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}