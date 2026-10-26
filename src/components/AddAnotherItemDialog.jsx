// Owner 2026-10-18 (L-09 approval, typed: "מאשר שינוי ב-L-09: בחירה של כמה פריטים מהקטלוג בסימון וי והוספתם יחד להצעה";
// flow: "יהיה פשוט אם תהיה שאלה, האם תרצה להוסיף פריט נוסף? אם התשובה היא כן אז שתפתח הרשימה לסימון וי").
// Owner console 2026-10-26 (typed: "מאשר שינוי ב-L-09, L-15 ו-L-17 לפי docs/CODEX_ITEM_PATHS_SPEC_2026-10-26.md ... אותו מסלול אחרי שאלת
// פריט נוסף ..."): the question stays; "Yes" opens the item wizard, whose catalog is the same tick list with the shared check before
// adding (nothing is added straight from a list any more). Escape / No close without adding anything; Tab stays in the window.
import { useEffect, useRef } from 'react';
import { APP as NEON } from '../theme/neonTheme';
import useFocusTrap from './quotePresentation/useFocusTrap';

export default function AddAnotherItemDialog({ isHebrew, onNewItem, onClose }) {
  const firstRef = useRef(null);
  const cardRef = useRef(null);
  useFocusTrap(cardRef, true);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const t = isHebrew
    ? { ask: 'להוסיף פריט נוסף?', yes: 'כן', no: 'לא' }
    : { ask: 'Would you like to add another item?', yes: 'Yes', no: 'No' };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px', boxSizing: 'border-box' };
  const card = { background: NEON.bgCard, borderRadius: '14px', width: '100%', maxWidth: '380px', boxSizing: 'border-box', padding: '16px 18px', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.4)' };
  const secondaryBtn = { minHeight: '44px', minWidth: '110px', padding: '0 16px', borderRadius: '8px', border: `1px solid ${NEON.borderStrong}`, background: 'none', color: NEON.textSecondary, fontWeight: 600, cursor: 'pointer' };
  const primaryBtn = { minHeight: '44px', minWidth: '110px', padding: '0 16px', borderRadius: '8px', border: 'none', background: NEON.gradient, color: '#fff', fontWeight: 700, cursor: 'pointer' };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pf-another-item-title" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="add-another-item"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} style={overlay}>
      <div ref={cardRef} style={card}>
        <h3 id="pf-another-item-title" style={{ margin: '4px 0 16px', fontSize: '1.05rem', fontWeight: 800, color: NEON.textPrimary, textAlign: 'center' }}>{t.ask}</h3>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: answers "add another item?" with Yes - opens the item wizard (its catalog is a tick list with a shared check) */}
          <button ref={firstRef} type="button" onClick={onNewItem} data-testid="add-another-yes" style={primaryBtn}>{t.yes}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: answers "add another item?" with No - closes; nothing is added */}
          <button type="button" onClick={onClose} data-testid="add-another-no" style={secondaryBtn}>{t.no}</button>
        </div>
      </div>
    </div>
  );
}
