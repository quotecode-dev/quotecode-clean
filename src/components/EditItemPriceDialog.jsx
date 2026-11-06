// Task 34 extension (Owner AI specification, section ה): the simple per-item "Edit price" action of the quote form - for AI, manual and
// catalog items alike. It edits ONLY the unit price: the quantity, its unit and source, measurements, specification, section and catalog
// origin are untouched (the wizard is not involved). It shows what the price is charged per (m² / linear meter / hour / ... / one unit, or
// the line total of a single fixed item), the item's current quantity + unit and the expected line total before quote-level rules (VAT /
// discount / rounding are applied by the quote totals, as everywhere else). An empty price stays "missing" (never shown as free); 0 is an
// intentional free line. Changing a price never updates the catalog. Cancel / Escape keep everything as it was.
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { APP as NEON } from '../theme/neonTheme';
import { getActiveQuantity, getProfessionalUnitLabel } from '../utils/professionalQuoteItem';
import { parsePriceInput } from '../utils/itemPrice';


export default function EditItemPriceDialog({ item, isHebrew, sym, fmtMoney, formatNum, onSave, onCancel }) {
  const [value, setValue] = useState(item?.unit_price === '' || item?.unit_price == null ? '' : String(item.unit_price));
  const [error, setError] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select?.(); }, []);
  if (!item) return null;
  const qty = getActiveQuantity(item);
  const unit = item.pricing_unit || null;
  const unitLabel = unit ? getProfessionalUnitLabel(unit, isHebrew) : null;
  const isSingleFixed = !unit && Number(qty) === 1;
  const priceLabel = unit && unit !== 'unit'
    ? (isHebrew ? `מחיר ל${unitLabel}` : `Price per ${unitLabel}`)
    : isSingleFixed ? (isHebrew ? 'מחיר לפריט (סכום כולל)' : 'Price for this item (total)') : (isHebrew ? 'מחיר ליחידה' : 'Price per unit');
  const parsed = parsePriceInput(value);
  const lineTotal = parsed.ok && parsed.value !== '' ? Number(qty) * Number(parsed.value) : null;
  const save = () => {
    const p = parsePriceInput(value);
    if (!p.ok) { setError(true); inputRef.current?.focus(); return; }
    onSave(p.value);
  };
  const t = isHebrew
    ? { title: 'עריכת מחיר', qty: 'כמות', total: 'סכום צפוי לשורה', missing: 'יש להזין מחיר', note: 'מע״מ, הנחה ועיגול מחושבים בסיכום ההצעה. שינוי המחיר כאן לא משנה את הקטלוג.', save: 'שמירת מחיר', cancel: 'ביטול', invalid: 'הזינו מחיר תקין: מספר עם נקודה עשרונית (עד 2 ספרות אחריה), פסיק רק להפרדת אלפים (1,200) — או השאירו ריק.' }
    : { title: 'Edit price', qty: 'Quantity', total: 'Expected line total', missing: 'Enter a price', note: 'VAT, discount and rounding are applied in the quote totals. Changing the price here does not change your catalog.', save: 'Save price', cancel: 'Cancel', invalid: 'Enter a valid price: a number with a decimal point (up to 2 decimals), commas only for thousands (1,200) — or leave it empty.' };
  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="pf-edit-price-title" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="edit-item-price"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px', boxSizing: 'border-box' }}
    >
      <div style={{ background: NEON.bgCard, borderRadius: '14px', width: '100%', maxWidth: '400px', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', padding: '16px 18px', textAlign: isHebrew ? 'right' : 'left', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <h3 id="pf-edit-price-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: NEON.textPrimary }}>{t.title}</h3>
          {/* PRODUCT_TRUTH_DECORATIVE: closes the Edit price dialog without changing the item */}
          <button type="button" onClick={onCancel} aria-label={isHebrew ? 'סגירה' : 'Close'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: NEON.textSecondary, minWidth: '44px', minHeight: '44px' }}><X size={18} /></button>
        </div>
        <div style={{ fontWeight: 700, color: NEON.textPrimary, fontSize: '0.9rem', margin: '4px 0 10px', overflowWrap: 'anywhere' }}>{item.description}</div>
        <div data-testid="edit-price-qty" style={{ fontSize: '0.84rem', color: NEON.textSecondary, marginBottom: '10px' }}>
          {t.qty}: <bdi className="pf-num" dir="ltr">{formatNum ? formatNum(qty) : qty}</bdi>{unitLabel && unit !== 'unit' ? ` ${unitLabel}` : ''}
        </div>
        <label htmlFor="pf-edit-price-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: NEON.textPrimary, marginBottom: '4px' }}>{`${priceLabel} (${sym})`}</label>
        <input
          id="pf-edit-price-input" ref={inputRef} type="text" inputMode="decimal" dir="ltr" className="pf-num" value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
          aria-invalid={error} aria-describedby={error ? 'pf-edit-price-error' : 'pf-edit-price-total'}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1px solid ${error ? NEON.red : NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px', textAlign: 'left' }}
        />
        {error && <div id="pf-edit-price-error" role="alert" style={{ color: NEON.red, fontSize: '0.8rem', marginTop: '4px' }}>{t.invalid}</div>}
        <div id="pf-edit-price-total" data-testid="edit-price-total" aria-live="polite" style={{ marginTop: '10px', fontSize: '0.88rem', color: NEON.textPrimary }}>
          {t.total}: {lineTotal != null ? <bdi className="pf-money" dir="ltr" style={{ fontWeight: 800 }}>{`${sym}${fmtMoney(lineTotal)}`}</bdi> : <span style={{ color: NEON.amber || NEON.textSecondary, fontWeight: 700 }}>{t.missing}</span>}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: NEON.textSecondary, lineHeight: 1.45 }}>{t.note}</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px', flexWrap: 'wrap' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: cancels the Edit price dialog; nothing changes */}
          <button type="button" onClick={onCancel} style={{ minHeight: '44px', padding: '0 16px', borderRadius: '8px', border: `1px solid ${NEON.borderStrong}`, background: 'none', color: NEON.textSecondary, fontWeight: 600, cursor: 'pointer' }}>{t.cancel}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: saves only this item's unit price in the unsaved quote form (the quote itself is saved by the normal Save) */}
          <button type="button" onClick={save} style={{ minHeight: '44px', padding: '0 16px', borderRadius: '8px', border: 'none', background: NEON.gradient, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{t.save}</button>
        </div>
      </div>
    </div>
  );
}
