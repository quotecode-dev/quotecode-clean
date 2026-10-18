// Owner 2026-10-18 (L-09 approval, typed: "מאשר שינוי ב-L-09: בחירה של כמה פריטים מהקטלוג בסימון וי והוספתם יחד להצעה";
// flow: "יהיה פשוט אם תהיה שאלה, האם תרצה להוסיף פריט נוסף? אם התשובה היא כן אז שתפתח הרשימה לסימון וי").
// Shown by QuoteForm after a NEW item was added through the item wizard. Step 1 asks; "Yes" opens the catalog as a tick list
// (with no catalog it opens the item wizard for a new item instead). Every ticked catalog item is added with its catalog name and
// price and quantity 1 - the same item shape as a fixed-price catalog pick in the wizard; quantity / price change in the quote as
// for any item. Nothing changes the catalog. Escape / No / Cancel close without adding anything.
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { APP as NEON } from '../theme/neonTheme';

export default function AddAnotherItemDialog({ services, isHebrew, sym, formatMoneyDisplay, onAddSelected, onNewItem, onClose }) {
  const hasCatalog = Array.isArray(services) && services.length > 0;
  const [phase, setPhase] = useState('ask');
  const [picked, setPicked] = useState(() => new Set());
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, [phase]);

  const money = (v) => (formatMoneyDisplay ? formatMoneyDisplay(Number(v) || 0) : (Number(v) || 0).toFixed(2));
  const count = picked.size;
  const t = isHebrew
    ? {
      ask: 'האם תרצה להוסיף פריט נוסף?', yes: 'כן', no: 'לא',
      pickTitle: 'בחרו פריטים מהקטלוג', pickNote: 'סמנו את כל הפריטים שרוצים להוסיף. כל פריט נכנס בכמות 1, ואפשר לשנות אותה בהצעה.',
      add: count === 1 ? 'הוספת פריט אחד להצעה' : `הוספת ${count} פריטים להצעה`, addNone: 'סמנו לפחות פריט אחד',
      newItem: 'פריט חדש שלא בקטלוג', cancel: 'ביטול', close: 'סגירה',
    }
    : {
      ask: 'Would you like to add another item?', yes: 'Yes', no: 'No',
      pickTitle: 'Choose items from your catalog', pickNote: 'Tick every item you want to add. Each one is added with quantity 1; you can change it in the quote.',
      add: count === 1 ? 'Add 1 item to the quote' : `Add ${count} items to the quote`, addNone: 'Tick at least one item',
      newItem: 'A new item that is not in the catalog', cancel: 'Cancel', close: 'Close',
    };

  const toggle = (id) => setPicked((prev) => { const next = new Set(prev); const k = String(id); if (next.has(k)) next.delete(k); else next.add(k); return next; });
  const answerYes = () => { if (hasCatalog) setPhase('pick'); else onNewItem(); };
  const addSelected = () => {
    if (count === 0) return;
    onAddSelected(services.filter((sv) => picked.has(String(sv.id))));
  };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px', boxSizing: 'border-box' };
  const card = { background: NEON.bgCard, borderRadius: '14px', width: '100%', maxWidth: phase === 'ask' ? '380px' : '460px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: '16px 18px', textAlign: isHebrew ? 'right' : 'left', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.4)' };
  const secondaryBtn = { minHeight: '44px', padding: '0 16px', borderRadius: '8px', border: `1px solid ${NEON.borderStrong}`, background: 'none', color: NEON.textSecondary, fontWeight: 600, cursor: 'pointer' };
  const primaryBtn = (enabled) => ({ minHeight: '44px', padding: '0 16px', borderRadius: '8px', border: 'none', background: enabled ? NEON.gradient : NEON.borderStrong, color: '#fff', fontWeight: 700, cursor: enabled ? 'pointer' : 'not-allowed' });

  if (phase === 'ask') {
    return (
      <div role="dialog" aria-modal="true" aria-labelledby="pf-another-item-title" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="add-another-item"
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} style={overlay}>
        <div style={card}>
          <h3 id="pf-another-item-title" style={{ margin: '4px 0 16px', fontSize: '1.05rem', fontWeight: 800, color: NEON.textPrimary, textAlign: 'center' }}>{t.ask}</h3>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* PRODUCT_TRUTH_DECORATIVE: answers "add another item?" with Yes - opens the catalog tick list (or the item wizard when there is no catalog) */}
            <button ref={firstRef} type="button" onClick={answerYes} data-testid="add-another-yes" style={{ ...primaryBtn(true), minWidth: '110px' }}>{t.yes}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: answers "add another item?" with No - closes; nothing is added */}
            <button type="button" onClick={onClose} data-testid="add-another-no" style={{ ...secondaryBtn, minWidth: '110px' }}>{t.no}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pf-catalog-pick-title" aria-describedby="pf-catalog-pick-note" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="catalog-multi-pick"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} style={overlay}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <h3 id="pf-catalog-pick-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: NEON.textPrimary }}>{t.pickTitle}</h3>
          {/* PRODUCT_TRUTH_DECORATIVE: closes the catalog tick list without adding anything */}
          <button type="button" onClick={onClose} aria-label={t.close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: NEON.textSecondary, minWidth: '44px', minHeight: '44px' }}><X size={18} /></button>
        </div>
        <p id="pf-catalog-pick-note" style={{ margin: '2px 0 10px', fontSize: '0.8rem', color: NEON.textSecondary, lineHeight: 1.45 }}>{t.pickNote}</p>
        <div data-testid="catalog-multi-pick-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', minHeight: 0, flex: '1 1 auto' }}>
          {services.map((sv, i) => {
            const on = picked.has(String(sv.id));
            return (
              <label key={sv.id} data-testid={`catalog-pick-${sv.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', boxSizing: 'border-box', minHeight: '44px', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', background: on ? NEON.violetLighter : NEON.bgCardAlt, border: `1px solid ${on ? NEON.violet : NEON.borderStrong}` }}>
                {/* PRODUCT_TRUTH_DECORATIVE: ticks / unticks one catalog item to be added to the quote */}
                <input ref={i === 0 ? firstRef : undefined} type="checkbox" checked={on} onChange={() => toggle(sv.id)}
                  style={{ width: '20px', height: '20px', margin: 0, flexShrink: 0, accentColor: NEON.violet, cursor: 'pointer' }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.86rem', fontWeight: 700, color: NEON.textPrimary, overflowWrap: 'anywhere' }}>{sv.name}</span>
                <bdi className="pf-money" dir="ltr" style={{ color: NEON.violet, fontWeight: 800, flexShrink: 0, fontSize: '0.86rem' }}>{`${sym}${money(sv.price)}`}</bdi>
              </label>
            );
          })}
        </div>
        {/* PRODUCT_TRUTH_DECORATIVE: opens the item wizard for a new item that is not in the catalog */}
        <button type="button" onClick={onNewItem} data-testid="catalog-pick-new-item"
          style={{ alignSelf: 'flex-start', marginTop: '10px', minHeight: '44px', padding: '0 4px', background: 'none', border: 'none', color: NEON.violet, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
          {t.newItem}
        </button>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px', flexWrap: 'wrap' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: cancels the catalog tick list; nothing is added */}
          <button type="button" onClick={onClose} style={secondaryBtn}>{t.cancel}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: adds every ticked catalog item to the unsaved quote form (quantity 1, catalog price) */}
          <button type="button" onClick={addSelected} disabled={count === 0} aria-disabled={count === 0} data-testid="catalog-pick-add" style={primaryBtn(count > 0)}>
            {count === 0 ? t.addNone : t.add}
          </button>
        </div>
      </div>
    </div>
  );
}
