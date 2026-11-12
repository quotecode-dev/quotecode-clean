// Unified quote (Owner console 2026-11-11, spec section 1 row 8): after "שמירת ההצעה" of a quote that did not reach the customer -
// "נשמרה. עדיין לא נשלחה." with three ways on: how the customer will see it, back to editing, the quote list. Saving is not sending.
import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

export default function QuoteSavedScreen({ isHebrew, onPreview, onEdit = null, onList }) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const T = (he, en) => (isHebrew ? he : en);
  return (
    <section className="sq-saved" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="quote-saved-screen" aria-labelledby="sq-saved-title">
      {/* PRODUCT_TRUTH_DECORATIVE: "Back" on the saved screen - to the quote list (nothing changes) */}
      <button type="button" className="sq-saved-back" data-testid="quote-saved-back" onClick={onList}>
        {isHebrew ? <ArrowRight size={15} aria-hidden="true" /> : <ArrowLeft size={15} aria-hidden="true" />}{T('חזרה', 'Back')}
      </button>
      <div className="sq-saved-card">
        <span className="sq-saved-icon" aria-hidden="true"><Check size={26} strokeWidth={3} /></span>
        <h2 id="sq-saved-title" ref={headingRef} tabIndex={-1}>{T('נשמרה. עדיין לא נשלחה.', 'Saved. Not sent yet.')}</h2>
        <div className="sq-saved-actions">
          {/* PRODUCT_TRUTH_DECORATIVE: opens the saved quote's customer page in a new tab (the same link as the eye in the quote list) */}
          <button type="button" className="sq-btn sq-btn--primary" data-testid="quote-saved-preview" onClick={onPreview}>{T('כך הלקוח יראה', 'Client view')}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: opens the same saved quote in the editor again */}
          <button type="button" className="sq-btn" data-testid="quote-saved-edit" onClick={onEdit || undefined} disabled={!onEdit}>{T('חזרה לעריכה', 'Back to editing')}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: goes to the quote list */}
          <button type="button" className="sq-btn" data-testid="quote-saved-list" onClick={onList}>{T('לרשימת ההצעות', 'Quote list')}</button>
        </div>
      </div>
    </section>
  );
}
