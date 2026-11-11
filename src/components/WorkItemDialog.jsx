// Unified quote (Owner console 2026-11-11, spec section 1 row 6 + decisions 2 / 6): adding a work item asks ONE question per step -
// work (a name or a catalog item) -> place (the whole place / rooms; several rooms = one row per room, each with its own quantity and
// price) -> calculation (per unit / m² / metre / hour / day / kg / one price for all the work) -> price. Back on every step.
// The rows are built by the same buildQuoteItemFromEntry the rows editor uses, so a row added here is identical to a typed row.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildQuoteItemFromEntry } from '../utils/quoteItemEntry';
import { ROOM_CHOICES, wholePlaceLabel } from '../utils/quoteGroups';

const METHODS = ['units', 'area', 'linear', 'hour', 'day', 'kg', 'fixed'];
const BASIS_TO_METHOD = { unit: 'units', m2: 'area', sq_ft: 'area', linear_meter: 'linear', linear_ft: 'linear', kg: 'kg', hour: 'hour', day: 'day', fixed: 'fixed' };

function methodLabel(m, isHebrew, international) {
  if (isHebrew) return { units: 'ליחידה', area: international ? 'לרגל רבועה' : 'למ״ר', linear: international ? 'לרגל' : 'למטר', hour: 'לשעה', day: 'ליום', kg: 'לק״ג', fixed: 'מחיר אחד לכל העבודה' }[m];
  return { units: 'Per item', area: international ? 'Per sq ft' : 'Per m²', linear: international ? 'Per ft' : 'Per metre', hour: 'Per hour', day: 'Per day', kg: 'Per kg', fixed: 'One price for all the work' }[m];
}
function qtyLabel(m, isHebrew, international) {
  if (m === 'area') return isHebrew ? (international ? 'כמה רגל רבועה?' : 'כמה מ״ר?') : (international ? 'How many sq ft?' : 'How many m²?');
  if (m === 'linear') return isHebrew ? (international ? 'כמה רגל?' : 'כמה מטר?') : (international ? 'How many ft?' : 'How many metres?');
  return isHebrew ? 'כמה?' : 'How many?';
}
const priceLabel = (m, isHebrew, international) => (m === 'fixed'
  ? (isHebrew ? 'מחיר לכל העבודה' : 'Price for all the work')
  : `${isHebrew ? 'מחיר' : 'Price'} ${methodLabel(m, isHebrew, international)}`);

export default function WorkItemDialog({ open, isHebrew, international = false, services = [], groupKind = 'section', sectionKey = null, groupName = '',
  canUseMeasured = true, onMeasuredLocked = null, onAdd, onClose, onOpenCalculator = null }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [catalogId, setCatalogId] = useState(null);
  const [rooms, setRooms] = useState(['all']);
  const [customRoom, setCustomRoom] = useState('');
  const [method, setMethod] = useState('units');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [useSizes, setUseSizes] = useState(false);
  const [sizes, setSizes] = useState([{ label: '', w: '', h: '' }]);
  const [per, setPer] = useState({});
  const [error, setError] = useState('');
  const firstRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setStep(0); setName(''); setCatalogId(null); setRooms(['all']); setCustomRoom(''); setMethod('units'); setQty('1'); setPrice('');
    setUseSizes(false); setSizes([{ label: '', w: '', h: '' }]); setPer({}); setError('');
  }, [open]);
  useEffect(() => { if (open) setTimeout(() => firstRef.current?.focus(), 0); }, [open, step]);

  const roomList = useMemo(() => {
    const list = rooms.filter((r) => r !== 'all');
    if (customRoom.trim()) list.push(customRoom.trim());
    return list.length ? [...new Set(list)] : (rooms.includes('all') ? ['all'] : []);
  }, [rooms, customRoom]);
  const multi = roomList.length > 1;
  const matches = useMemo(() => {
    const q = name.trim().toLowerCase();
    return (services || []).filter((s) => s && s.name && (!q || String(s.name).toLowerCase().includes(q))).slice(0, 12);
  }, [services, name]);

  if (!open) return null;
  const T = (he, en) => (isHebrew ? he : en);
  const roomText = (r) => (r === 'all' ? wholePlaceLabel(groupKind, isHebrew) : (ROOM_CHOICES.find((c) => c.key === r)?.[isHebrew ? 'he' : 'en'] || r));
  const measured = method === 'area' || method === 'linear';
  const titles = [T('איזו עבודה מוסיפים?', 'What work would you like to add?'), T('איפה עושים אותה?', 'Where is this work done?'),
    T('איך מחשבים את המחיר?', 'How is the price calculated?'), T('כמה זה עולה?', 'How much does it cost?')];

  const pickCatalog = (svc) => {
    setName(String(svc.name)); setCatalogId(svc.id || null);
    if (svc.price != null && svc.price !== '') setPrice(String(svc.price));
    const m = BASIS_TO_METHOD[svc.price_basis];
    if (m) setMethod(m);
    setError(''); setStep(1);
  };
  const toggleRoom = (key, on) => {
    if (key === 'all') { setRooms(on ? ['all'] : []); return; }
    setRooms((prev) => { const next = prev.filter((r) => r !== 'all' && r !== key); return on ? [...next, key] : next; });
  };
  const chooseMethod = (m) => {
    if ((m === 'area' || m === 'linear') && !canUseMeasured) { if (typeof onMeasuredLocked === 'function') onMeasuredLocked(); return; }
    setMethod(m); setError(''); setStep(3);
  };
  const back = () => { setError(''); if (step === 0) onClose(); else setStep(step - 1); };
  const next = () => {
    if (step === 0) { if (!name.trim()) { setError(T('כתבו שם או בחרו מהקטלוג.', 'Enter a name or choose from the catalog.')); return; } setError(''); setStep(1); return; }
    if (step === 1) { if (!roomList.length) { setError(T('בחרו איפה עושים את העבודה.', 'Choose where the work is done.')); return; } setError(''); setStep(2); return; }
    if (step === 2) { setStep(3); return; }
    add();
  };
  const positive = (v) => v !== '' && Number.isFinite(Number(v)) && Number(v) > 0;
  const priceOk = (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0);
  const add = () => {
    const unit = international ? 'ft' : 'm';
    const base = { pricingMethod: method, description: name.trim(), catalogServiceId: catalogId, sectionKey, measureUnit: unit, specRows: [] };
    const entryFor = (room, q, p) => {
      if (method === 'fixed') return { ...base, unitPrice: p, quantity: '1', room };
      if (measured) {
        if (!multi && useSizes) {
          const [first, ...rest] = sizes;
          return { ...base, unitPrice: p, room, widthCm: first.w, heightCm: method === 'area' ? first.h : '', extraMeasureRows: rest.map((r) => ({ widthCm: r.w, heightCm: method === 'area' ? r.h : '', label: r.label || '' })) };
        }
        return { ...base, unitPrice: p, room, useManualQty: true, manualQty: q };
      }
      return { ...base, unitPrice: p, quantity: q, room };
    };
    const plan = multi ? roomList.map((r) => ({ room: r, q: per[r]?.qty ?? qty, p: per[r]?.price ?? price })) : [{ room: roomList[0], q: qty, p: price }];
    for (const it of plan) {
      if (method !== 'fixed' && !(measured && !multi && useSizes) && !positive(it.q)) { setError(T('השלימו כמות גדולה מאפס.', 'Enter a quantity above zero.')); return; }
      if (!priceOk(it.p)) { setError(T('המחיר חייב להיות מספר שאינו שלילי.', 'The price must be a number that is not negative.')); return; }
    }
    if (measured && !multi && useSizes && sizes.some((r) => !positive(r.w) || (method === 'area' && !positive(r.h)))) {
      setError(T('השלימו מידות גדולות מאפס.', 'Enter measurements above zero.')); return;
    }
    const rows = plan.map(({ room, q, p }) => {
      const built = buildQuoteItemFromEntry(entryFor(room, q, p));
      if (method === 'fixed' || method === 'units') built._billing = method;
      return built;
    });
    onAdd(rows);
  };

  return (
    <div className="sq-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sq-work-title" className="sq-dialog" dir={isHebrew ? 'rtl' : 'ltr'} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); back(); } }} data-testid="work-item-dialog">
        <p className="sq-dialog-steps">{T('עבודה · מקום · חישוב · מחיר', 'Work · Place · Calculation · Price')} - <bdi dir="ltr">{step + 1} / 4</bdi>{groupName ? <> · <bdi>{groupName}</bdi></> : null}</p>
        <h2 id="sq-work-title" className="sq-dialog-title">{titles[step]}</h2>
        {error && <p className="sq-dialog-error" role="alert">{error}</p>}

        {step === 0 && (
          <div className="sq-dialog-body">
            <label className="sq-field">{T('שם העבודה או המוצר', 'Work or product name')}
              <input ref={firstRef} type="text" value={name} data-testid="work-name" onChange={(e) => { setName(e.target.value); setCatalogId(null); }} autoComplete="off" />
            </label>
            {matches.length > 0 && (
              <>
                <p className="sq-dialog-small">{T('או בחרו מהקטלוג:', 'Or choose from your catalog:')}</p>
                <div className="sq-dialog-catalog">
                  {/* PRODUCT_TRUTH_DECORATIVE: picks a catalog item for the new work row (name, price and its billing method) */}
                  {matches.map((s) => (
                    <button key={s.id || s.name} type="button" className="sq-chip" onClick={() => pickCatalog(s)}>{s.name}{s.price != null && s.price !== '' ? <small> · <bdi dir="ltr">{s.price}</bdi></small> : null}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="sq-dialog-body">
            <p className="sq-dialog-small">{T('אפשר לבחור כמה חדרים - לכל חדר תיווסף שורה נפרדת עם כמות ומחיר משלה.', 'You can choose several rooms - each room gets its own row with its own quantity and price.')}</p>
            {ROOM_CHOICES.map((c, i) => (
              <label key={c.key} className="sq-check">
                <input ref={i === 0 ? firstRef : undefined} type="checkbox" checked={rooms.includes(c.key)} data-room={c.key} onChange={(e) => toggleRoom(c.key, e.target.checked)} />
                {roomText(c.key)}
              </label>
            ))}
            <label className="sq-field">{T('חדר אחר (לא חובה)', 'Another room (optional)')}
              <input type="text" value={customRoom} maxLength={60} onChange={(e) => setCustomRoom(e.target.value)} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="sq-dialog-body sq-dialog-choices">
            {/* PRODUCT_TRUTH_DECORATIVE: chooses how the new work row is priced (the same billing methods as the rows editor) */}
            {METHODS.map((m, i) => (
              <button key={m} ref={i === 0 ? firstRef : undefined} type="button" className={`sq-chip${method === m ? ' is-on' : ''}`} aria-pressed={method === m} onClick={() => chooseMethod(m)}>{methodLabel(m, isHebrew, international)}</button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="sq-dialog-body">
            <p className="sq-dialog-small"><strong>{name}</strong> · {methodLabel(method, isHebrew, international)}</p>
            {multi ? roomList.map((r, i) => (
              <div key={r} className="sq-room-block">
                <strong>{roomText(r)}</strong>
                <div className="sq-row2">
                  {method !== 'fixed' && (
                    <label className="sq-field">{qtyLabel(method, isHebrew, international)}
                      <input ref={i === 0 ? firstRef : undefined} type="number" inputMode="decimal" min="0" step="any" value={per[r]?.qty ?? qty} data-per-qty={r}
                        onChange={(e) => setPer((p) => ({ ...p, [r]: { ...(p[r] || { price }), qty: e.target.value } }))} />
                    </label>
                  )}
                  <label className="sq-field">{priceLabel(method, isHebrew, international)}
                    <input type="number" inputMode="decimal" min="0" step="0.01" value={per[r]?.price ?? price} data-per-price={r}
                      onChange={(e) => setPer((p) => ({ ...p, [r]: { ...(p[r] || { qty }), price: e.target.value } }))} />
                  </label>
                </div>
              </div>
            )) : (
              <>
                {measured && (
                  <div className="sq-dialog-choices">
                    {/* PRODUCT_TRUTH_DECORATIVE: the area / length is already known (one amount, no sizes) - the same choice as the rows editor */}
                    <button type="button" className={`sq-chip${!useSizes ? ' is-on' : ''}`} aria-pressed={!useSizes} onClick={() => setUseSizes(false)}>{method === 'area' ? T('השטח כבר ידוע', 'I already know the area') : T('האורך כבר ידוע', 'I already know the length')}</button>
                    {/* PRODUCT_TRUTH_DECORATIVE: from measurements (named sizes) - the same choice as the rows editor */}
                    <button type="button" className={`sq-chip${useSizes ? ' is-on' : ''}`} aria-pressed={useSizes} onClick={() => setUseSizes(true)}>{T('לפי מידות', 'From measurements')}</button>
                  </div>
                )}
                {measured && useSizes ? (
                  <div className="sq-sizes">
                    {sizes.map((r, i) => (
                      <div key={i} className="sq-size-row">
                        <label className="sq-field">{T('שם המידה (לא חובה)', 'Measurement name (optional)')}<input type="text" value={r.label} onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></label>
                        <label className="sq-field">{international ? T('אורך ברגל', 'Length in ft') : T('אורך במטר', 'Length in metres')}<input type="number" inputMode="decimal" min="0" step="any" value={r.w} onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, w: e.target.value } : x)))} /></label>
                        {method === 'area' && <label className="sq-field">{international ? T('רוחב ברגל', 'Width in ft') : T('רוחב במטר', 'Width in metres')}<input type="number" inputMode="decimal" min="0" step="any" value={r.h} onChange={(e) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, h: e.target.value } : x)))} /></label>}
                      </div>
                    ))}
                    {/* PRODUCT_TRUTH_DECORATIVE: adds another named measurement row to the new work line */}
                    <button type="button" className="sq-chip" onClick={() => setSizes((all) => [...all, { label: '', w: '', h: '' }])}>+ {T('מידה נוספת', 'Another measurement')}</button>
                  </div>
                ) : method !== 'fixed' && (
                  <label className="sq-field">{qtyLabel(method, isHebrew, international)}
                    <input ref={firstRef} type="number" inputMode="decimal" min="0" step="any" value={qty} data-testid="work-qty" onChange={(e) => setQty(e.target.value)} />
                  </label>
                )}
                <label className="sq-field">{priceLabel(method, isHebrew, international)}
                  <input ref={method === 'fixed' ? firstRef : undefined} type="number" inputMode="decimal" min="0" step="0.01" value={price} data-testid="work-price" onChange={(e) => setPrice(e.target.value)} />
                </label>
                {typeof onOpenCalculator === 'function' && (
                  // PRODUCT_TRUTH_DECORATIVE: the calculator next to the price (spec section 4) - opens the same floating calculator, nothing is typed for you
                  <button type="button" className="sq-calc-link" data-testid="work-calculator" onClick={onOpenCalculator}>
                    {isHebrew ? 'מחשבון' : 'Calculator'}
                  </button>
                )}
              </>
            )}
            <p className="sq-dialog-small">{T('מחיר ריק נשמר כ״טרם תומחר״.', 'A blank price stays "Not priced yet".')}</p>
          </div>
        )}

        <div className="sq-dialog-actions">
          {/* PRODUCT_TRUTH_DECORATIVE: one step back in the work window (closes it on the first step) */}
          <button type="button" className="sq-btn" onClick={back}>{T('חזרה', 'Back')}</button>
          {step !== 2 && (
            // PRODUCT_TRUTH_DECORATIVE: continues to the next question / adds the work rows to the quote (nothing is saved yet)
            <button type="button" className="sq-btn sq-btn--primary" data-testid="work-next" onClick={next}>{step === 3 ? T('הוספה', 'Add') : T('להמשך', 'Continue')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
