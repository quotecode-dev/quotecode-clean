// Owner console 2026-11-08 (night task, typed: "מאשר את תוכנית משימת הלילה: שלב 1 של בונה ההצעה ותחילת שלב 2 בענף נפרד בלי שחרור, כולל
// שינוי ב-L-09, L-14, L-15, L-17, L-23 ..."; design A typed: "מאשר חלופה א׳ - שורות ישירות, כפתור אחד "הצעת מחיר", כולל החלפת הבחירה
// המרובה בבחירה לפי שורה, שינוי ב-L-09"): stage 2 of the one quote builder - every item is ONE row: item (catalog list or a typed name),
// billing type, quantity or sizes, price, line total, and a three-dot menu. Decision 2: a new row starts at quantity 1; a catalog pick fills
// its name and price; the default billing type is "units"; sizes are in metres in Israel (cm option) and in feet abroad (inch option, metres
// still available). Decision 3: an old line of quantity 1 with no unit shows as a fixed amount. Every row is built by the ONE item-shape
// builder (utils/quoteItemEntry.js) - the save, the customer's quote, the print and the PDF read exactly the shapes they read today.
// Owner console 2026-11-08 (typed: "מאשר השלמת שלב 2 של בונה ההצעה לפי התוכנית, כולל שינוי ב-L-09, L-14, L-15, L-17, L-23 ..."): the rows
// replace the item cards and the item window in the quote screen - details for the customer, extra sizes and a known area open inside the
// row; the price and the quantity use the same grammar as the "Edit price" window (utils/itemPrice.js), an invalid value is shown at the
// field and never stored; up / down move a row inside its unit; Enter in a filled row's price adds the next row.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { MoreVertical, ChevronDown, Plus, X } from 'lucide-react';
import { APP as NEON } from '../theme/neonTheme';
import { buildQuoteItemFromEntry, blankRowItem, rowEntry, convertSizeBetween, isFeetUnit, isCountedMethod, sizeToBase } from '../utils/quoteItemEntry';
import { getActiveQuantity, getProfessionalUnitLabel, formatQuantity, normalizeRepeatCount, computeMeasurementValue, formatMeasurementLine } from '../utils/professionalQuoteItem';
import { parsePriceInput, parseQuantityInput } from '../utils/itemPrice';
import { askConfirm } from './AppDialog';

const COPY = {
  he: {
    item: 'פריט', billing: 'סוג חיוב', amount: 'כמות / מידות', price: 'מחיר', total: 'סכום', itemPlaceholder: 'חפשו בקטלוג או הקלידו שם',
    fixed: 'סכום קבוע', units: 'יחידות', area: 'שטח', linear: 'אורך', qty: 'כמות', width: 'אורך', height: 'רוחב', length: 'אורך',
    addRow: 'הוספת שורה', menu: 'פעולות לשורה', duplicate: 'שכפול שורה', remove: 'הסרת שורה', moveTo: 'העברה ליחידה', noUnit: 'ללא יחידה',
    catalog: 'מהקטלוג', openCatalog: 'פתיחת הקטלוג', emptyCatalog: 'אין פריטים מתאימים בקטלוג - אפשר פשוט להקליד שם',
    details: 'פרטים ללקוח', detailLabel: 'שם הפרט, למשל צבע', detailValue: 'הערך, למשל לבן', addDetail: 'הוספת פרט', removeDetail: 'הסרת הפרט',
    moveUp: 'הזזה למעלה', moveDown: 'הזזה למטה', sizes: 'לפי מידות', known: 'כמות ידועה (בלי מידות)', moreSize: 'מידה נוספת', removeSize: 'הסרת המידה',
    sizeLabel: 'שם, למשל סלון', priceError: 'מחיר לא תקין - מספר עם נקודה, למשל 1200.50', qtyError: 'כמות לא תקינה - מספר גדול מ-0',
    sizesLost: 'מעבר לסוג חיוב אחר ימחק את המידות של השורה. להמשיך?', perUnit: 'לכל',
    unitChange: 'מעבר בין מטרים לרגל משנה את היחידה שהמחיר נקבע לפיה (מ״ר או רגל רבועה). לבדוק את המחיר אחרי המעבר?',
    linkedTo: 'המחיר השתנה ל-', linkedAsk: 'לעדכן גם {n} שורות מקושרות?', linkedAsk1: 'לעדכן גם את השורה המקושרת?',
    linkedHere: 'רק כאן', linkedAll: 'עדכון כולן', linkedAll1: 'עדכון גם שם', linkedCancel: 'ביטול',
    linkedCopies: 'כולל {c} יחידות זהות', linkedDone: 'עודכנו {n} מחירים מקושרים', linkedDone1: 'עודכן מחיר מקושר אחד', linkedUndo: 'ביטול עדכון המחירים',
    linkBreak: 'למחיר של השורה הזאת מקושרות שורות ביחידות אחרות. שינוי סוג החיוב ינתק אותה מהקישור. להמשיך?',
    // Owner console 2026-11-08 (restore items 01-06, 09, 16, 17): the item window's own words (4f1592f2:src/components/AddItemWizard.jsx)
    kg: 'ק״ג', hour: 'שעות', day: 'ימים', recommended: 'מומלץ',
    knowArea: 'השטח כבר ידוע?', knowLength: 'האורך כבר ידוע?', backToSizes: 'חזרה להזנת מידות', refSizes: 'מידות לעיון',
    conversion: 'שינוי שיטת התמחור עלול לשנות את משמעות הסכומים הקיימים. להמשיך?', unitChangeAsk: 'שינוי היחידה דורש בדיקה מחדש של המחיר. להמשיך?',
    // the words of the row's own fields (length x width), so the message names the field the user sees
    missingFirst: 'יש להזין אורך גדול מ-0', missingSecond: 'יש להזין רוחב גדול מ-0',
    rowNeedsFirst: (n) => `במידה ${n} חסר אורך. השלימו או הסירו אותה.`, rowNeedsSecond: (n) => `במידה ${n} חסר רוחב. השלימו או הסירו אותה.`,
    sizeTooSmall: 'המידות קטנות מדי והכמות יוצאת 0.00. בדקו את המספרים ואת היחידה (ס״מ או מטר).',
    missingQuantity: 'יש להזין כמות גדולה מ-0',
  },
  en: {
    item: 'Item', billing: 'Billing', amount: 'Quantity / size', price: 'Price', total: 'Total', itemPlaceholder: 'Search the catalog or type a name',
    fixed: 'Fixed amount', units: 'Units', area: 'Area', linear: 'Length', qty: 'Quantity', width: 'Length', height: 'Width', length: 'Length',
    addRow: 'Add row', menu: 'Row actions', duplicate: 'Duplicate row', remove: 'Remove row', moveTo: 'Move to unit', noUnit: 'No unit',
    catalog: 'From the catalog', openCatalog: 'Open the catalog', emptyCatalog: 'No matching catalog item - just type a name',
    details: 'Details for the customer', detailLabel: 'Detail, e.g. Colour', detailValue: 'Value, e.g. White', addDetail: 'Add a detail', removeDetail: 'Remove detail',
    moveUp: 'Move up', moveDown: 'Move down', sizes: 'By sizes', known: 'Known amount (no sizes)', moreSize: 'Another size', removeSize: 'Remove size',
    sizeLabel: 'Name, e.g. Living room', priceError: 'Invalid price - a number with a dot, e.g. 1200.50', qtyError: 'Invalid quantity - a number above 0',
    sizesLost: "Switching the billing type removes this row's sizes. Continue?", perUnit: 'per',
    unitChange: 'Switching between metres and feet changes what the price is for (m² or sq ft). Check the price after switching?',
    linkedTo: 'The price changed to ', linkedAsk: 'Update {n} linked rows too?', linkedAsk1: 'Update the linked row too?',
    linkedHere: 'Only here', linkedAll: 'Update all', linkedAll1: 'Update it too', linkedCancel: 'Cancel',
    linkedCopies: 'covers {c} identical units', linkedDone: '{n} linked prices updated', linkedDone1: '1 linked price updated', linkedUndo: 'Undo the price update',
    linkBreak: 'Rows in other units share this row\'s price. Changing the billing type unlinks it. Continue?',
    kg: 'kg', hour: 'Hours', day: 'Days', recommended: 'Recommended',
    knowArea: 'I already know the area', knowLength: 'I already know the length', backToSizes: 'Enter sizes instead', refSizes: 'Measurements for reference',
    conversion: 'Changing the pricing method may change how the existing numbers are interpreted. Continue?', unitChangeAsk: 'Changing the unit requires reviewing the price. Continue?',
    missingFirst: 'Please enter a length greater than 0', missingSecond: 'Please enter a width greater than 0',
    rowNeedsFirst: (n) => `Size ${n} needs a length. Complete or remove it.`, rowNeedsSecond: (n) => `Size ${n} needs a width. Complete or remove it.`,
    sizeTooSmall: 'The sizes are too small and the quantity comes out as 0.00. Check the numbers and the unit (cm or m).',
    missingQuantity: 'Please enter a quantity greater than 0',
  },
};
// Owner console 2026-11-08 (restore item 01): every billing type of the Owner-approved unit set in every row (the order of the spec, B2);
// restore item 06: the business's recommended type (advice only) comes first with its mark, as in the item window
const METHODS = ['fixed', 'units', 'area', 'linear', 'kg', 'hour', 'day'];
const orderedMethods = (rec) => (rec && METHODS.includes(rec) ? [rec, ...METHODS.filter((m) => m !== rec)] : METHODS);
const sizeUnits = (international) => (international ? ['ft', 'in', 'm', 'cm'] : ['m', 'cm']);
const sizeUnitLabel = (u, isHebrew) => ({ m: isHebrew ? 'מ׳' : 'm', cm: isHebrew ? 'ס״מ' : 'cm', ft: isHebrew ? 'רגל' : 'ft', in: isHebrew ? 'אינץ׳' : 'in' }[u] || u);
const areaLabel = (entry, isHebrew) => getProfessionalUnitLabel(isFeetUnit(entry.measureUnit) ? 'sq_ft' : 'm2', isHebrew);
const lengthLabel = (entry, isHebrew) => getProfessionalUnitLabel(isFeetUnit(entry.measureUnit) ? 'linear_ft' : 'linear_meter', isHebrew);
const isMeasured = (m) => m === 'area' || m === 'linear';
const hasSizes = (it) => Array.isArray(it?.measurements) && it.measurements.some((m) => (m?.width !== '' && m?.width != null) || (m?.height !== '' && m?.height != null));
const copyItem = (it) => {
  const copy = { ...it };
  delete copy.id;
  delete copy.price_link_id; // Owner console 2026-11-08 (stage 3): a manually copied row starts with its own price
  if (Array.isArray(it.measurements)) copy.measurements = it.measurements.map((m) => { const c = { ...m }; delete c.id; return c; });
  if (Array.isArray(it.specification)) copy.specification = it.specification.map((r) => ({ ...r }));
  return copy;
};

function ItemField({ value, onText, onPick, services, t, rowId, inputRef, sym, fmtMoney }) {
  const [open, setOpen] = useState(false);
  // the arrow opens the WHOLE catalog; typing filters it
  const [filtering, setFiltering] = useState(false);
  const wrap = useRef(null);
  const list = useMemo(() => {
    const q = filtering ? String(value || '').trim().toLowerCase() : '';
    return (services || []).filter((s) => !q || String(s.name || '').toLowerCase().includes(q)).slice(0, 12);
  }, [services, value, filtering]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    // the list closes when the focus leaves the field (Tab, Enter in another field), not only on a click outside
    <div ref={wrap} className="qrow-item" style={{ position: 'relative', display: 'flex', minWidth: 0 }}
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget)) setOpen(false); }}>
      <input
        ref={inputRef} type="text" value={value} placeholder={t.itemPlaceholder} aria-label={t.item} data-testid={`qrow-item-${rowId}`}
        onChange={(e) => { onText(e.target.value); setFiltering(true); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        style={{ flex: 1, minWidth: 0, minHeight: '40px', padding: '0 10px', border: `1px solid ${NEON.borderStrong}`, borderInlineEnd: 'none', borderStartStartRadius: '8px', borderEndStartRadius: '8px', borderStartEndRadius: 0, borderEndEndRadius: 0, background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.86rem' }}
      />
      {/* PRODUCT_TRUTH_DECORATIVE: arrow that opens the business catalog list inside the row; choosing fills the name and price (the existing catalog flow) */}
      <button type="button" aria-label={t.openCatalog} data-testid={`qrow-catalog-${rowId}`} onClick={() => { setFiltering(false); setOpen((v) => !v); }}
        style={{ minWidth: '40px', minHeight: '40px', border: `1px solid ${NEON.borderStrong}`, borderStartEndRadius: '8px', borderEndEndRadius: '8px', borderStartStartRadius: 0, borderEndStartRadius: 0, background: NEON.bgCardAlt, color: NEON.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {/* typing a name that is not in the catalog shows no list at all (a free name is simply typed); the arrow always shows the list */}
      {open && (list.length > 0 || !filtering) && (
        <ul role="listbox" aria-label={t.catalog} data-testid={`qrow-catalog-list-${rowId}`}
          style={{ position: 'absolute', insetInlineStart: 0, top: '100%', zIndex: 30, margin: '4px 0 0', padding: '4px', listStyle: 'none', width: 'min(320px, calc(100vw - 48px))', maxHeight: '260px', overflowY: 'auto', background: NEON.bgCard, border: `1px solid ${NEON.border}`, borderRadius: '10px', boxShadow: '0 12px 28px -10px rgba(15,23,42,0.35)' }}>
          {list.length === 0 && <li style={{ padding: '8px 10px', fontSize: '0.8rem', color: NEON.textSecondary }}>{t.emptyCatalog}</li>}
          {list.map((s) => (
            <li key={s.id} role="option" aria-selected="false" tabIndex={-1}
              onPointerDown={(e) => { e.preventDefault(); onPick(s); setOpen(false); }}
              style={{ padding: '8px 10px', minHeight: '40px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', cursor: 'pointer', borderRadius: '8px', fontSize: '0.84rem', color: NEON.textPrimary }}>
              <bdi>{s.name}</bdi>
              {s.price != null && s.price !== '' && <bdi dir="ltr" className="pf-money" style={{ color: NEON.textSecondary }}>{`${sym}${fmtMoney(s.price)}`}</bdi>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// restore item 04 (Owner 2026-11-08): the item window's size check (4f1592f2:src/components/AddItemWizard.jsx 875-904) - a measured row
// with content needs its sizes, a started extra size must be complete, and the quantity may not round to 0.00; an untouched size is ignored
const roundsToNothing = (v) => v != null && Number.isFinite(v) && v.toFixed(2) === '0.00';
const typed = (v) => String(v ?? '').trim() !== '';
function sizeProblems(e, t) {
  if (!isMeasured(e.pricingMethod) || e.useManualQty) return null;
  const linear = e.pricingMethod === 'linear';
  const extra = e.extraMeasureRows || [];
  const startedRow = (r) => typed(r.widthCm) || (!linear && typed(r.heightCm));
  if (!typed(e.description) && !typed(e.unitPrice) && !startedRow(e) && !extra.some(startedRow)) return null;
  const out = {};
  if (!(Number(e.widthCm) > 0)) out.main = t.missingFirst;
  else if (!linear && !(Number(e.heightCm) > 0)) out.main = t.missingSecond;
  const rows = {};
  extra.forEach((r, i) => {
    if (!startedRow(r)) return;
    if (!(Number(r.widthCm) > 0)) rows[i] = t.rowNeedsFirst(i + 2);
    else if (!linear && !(Number(r.heightCm) > 0)) rows[i] = t.rowNeedsSecond(i + 2);
  });
  if (Object.keys(rows).length) out.rows = rows;
  if (!out.main && !out.rows) {
    const valueOf = (r) => computeMeasurementValue(e.pricingMethod, sizeToBase(e.measureUnit, r.widthCm), linear ? undefined : sizeToBase(e.measureUnit, r.heightCm));
    const total = [e, ...extra.filter(startedRow)].map(valueOf).filter((v) => v != null && Number.isFinite(v)).reduce((s, v) => s + v, 0);
    if (roundsToNothing(total)) out.main = t.sizeTooSmall;
  }
  return out.main || out.rows ? out : null;
}
// restore item 05 (Owner 2026-11-08): what the screen shows is what is saved. While an open row holds a value that cannot be stored, its
// line carries the screen-only mark _invalid (never sent - the save builds its rows field by field) and the save refuses the quote. The
// typed text lives only in the open row: a row that opens again, or a line changed from outside (smart edit, a linked price), shows the
// stored line again and drops the mark.
const unmark = (it) => { const c = { ...it }; delete c._invalid; return c; };

const fieldStyle = { minHeight: '40px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.84rem' };
const errStyle = { flexBasis: '100%', margin: '2px 0 0', fontSize: '0.72rem', fontWeight: 700, color: NEON.red };

function RowLine({ item, index, rowId, t, isHebrew, international, sym, fmtMoney, services, sections, store, pos, count, onItem, onDuplicate, onRemove, onMove, onShift, onEnterNext, onCatalogItemAdded, canUseMeasured, onMeasuredLocked, linked = null, onLinkedAll = null, recommendedMethod = null, canRemove = true }) {
  // a catalog line stays a catalog line when it is edited again (the entry's catalog mark; the media binding runs only on a new pick)
  const entryOf = (it) => ({ ...rowEntry(it, international), catalogServiceId: it.isFromCatalog ? 'catalog' : null });
  const [entry, setEntry] = useState(() => entryOf(item));
  const [menu, setMenu] = useState(false);
  // the quantity counts as changed only when its TEXT changed - an untouched box never blocks a price edit (a stored 0, float noise) and
  // never rewrites the stored amount (the rule of the former quick price window); a billing type / size mode other than the one the row
  // opened with is a confirmed conversion (the new branch is taken as is - no manual amount of the old type survives)
  const openedOf = (e) => ({ quantity: e.quantity, manualQty: e.manualQty, pricingMethod: e.pricingMethod, useManualQty: !!e.useManualQty });
  const opened = useRef(null);
  if (!opened.current) opened.current = openedOf(entry);
  // the line changed from outside (the smart edit keeps its id): the row reads it again, it never writes back its old values
  const lastBuilt = useRef(item);
  // a row that opens on a marked line shows the stored line (its typed text is gone with the row that held it) - the mark goes too
  useEffect(() => {
    if (item._invalid) { const clean = unmark(item); lastBuilt.current = clean; onItem(index, clean); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (item === lastBuilt.current) return;
    const clean = item._invalid ? unmark(item) : item;
    lastBuilt.current = clean;
    const fresh = entryOf(clean);
    opened.current = openedOf(fresh);
    setEntry(fresh);
    setPriceErr(false);
    setQtyErr(false);
    setQtyEmpty(false);
    if (clean !== item) onItem(index, clean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);
  const [showDetails, setShowDetails] = useState(() => Array.isArray(item.specification) && item.specification.length > 0);
  const [priceErr, setPriceErr] = useState(false);
  const [qtyErr, setQtyErr] = useState(false);
  // restore item 05: an emptied quantity stays empty and says so (the item window's missingQuantity), never becomes 1 by itself
  const [qtyEmpty, setQtyEmpty] = useState(false);
  const rowRef = useRef(null);
  const itemInput = useRef(null);
  const menuBtnRef = useRef(null);
  // Owner console 2026-11-08 (stage 3, decision 5): a linked row's explicit new price asks whether the linked rows take it too
  const priceAtFocus = useRef(null);
  const [linkAsk, setLinkAsk] = useState(null);
  const isLinked = !!(item.price_link_id && linked && linked.count > 0);
  useEffect(() => {
    if (store.focus === rowId) { store.focus = null; itemInput.current?.focus(); }
  }, [store, rowId]);
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setMenu(false); menuBtnRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu]);
  // every change is built by the one item builder from the CURRENT item (fields the row has no control for - hours, a "display only"
  // size, a manual measured quantity - are kept exactly as the item window kept them); an invalid price / quantity is never stored
  const apply = (patch) => {
    const next = { ...entry, ...patch };
    setEntry(next);
    if (typed(next.quantity) && (!isMeasured(next.pricingMethod) || !next.useManualQty)) setQtyEmpty(false);
    if (typed(next.manualQty) && isMeasured(next.pricingMethod) && next.useManualQty) setQtyEmpty(false);
    const p = parsePriceInput(next.unitPrice);
    const o = opened.current;
    const qtyUntouched = next.quantity === o.quantity && isCountedMethod(o.pricingMethod) && o.pricingMethod === next.pricingMethod;
    const knownUntouched = o.useManualQty && next.manualQty === o.manualQty;
    const qOk = !isCountedMethod(next.pricingMethod) || qtyUntouched || parseQuantityInput(next.quantity).ok;
    const mOk = !(isMeasured(next.pricingMethod) && next.useManualQty) || knownUntouched || parseQuantityInput(next.manualQty).ok;
    setPriceErr(!p.ok);
    setQtyErr((!qOk && String(next.quantity ?? '').trim() !== '') || (!mOk && String(next.manualQty ?? '').trim() !== ''));
    if (!p.ok || !qOk || !mOk || sizeProblems(next, t)) {
      // Owner console 2026-11-08 (restore items 04 / 05): a row that cannot be stored is never saved with its previous value - the line
      // keeps what was typed and is marked, and the save refuses the quote until the marked fields are fixed
      const marked = { ...item, _invalid: true };
      lastBuilt.current = marked;
      onItem(index, marked);
      return null;
    }
    // a conversion = a billing type / size mode other than the line's own one right now (sizes -> known -> sizes counts the sizes again)
    const now = rowEntry(item, international);
    const conversionConfirmed = next.pricingMethod !== now.pricingMethod || !!next.useManualQty !== !!now.useManualQty;
    const built = buildQuoteItemFromEntry({ ...next, unitPrice: p.value, sectionKey: item.section_key ?? null, editingItem: item, isEditMode: true, conversionConfirmed });
    // an untouched count keeps its stored quantity column (an hours / kg line edited only in its price)
    if (!conversionConfirmed && qtyUntouched && isCountedMethod(next.pricingMethod) && item.quantity !== undefined) built.quantity = item.quantity;
    // a fixed amount and "1 unit" are the same stored line - the row remembers which one the user chose (a screen-only mark, never saved)
    if (next.pricingMethod === 'fixed' || next.pricingMethod === 'units') built._billing = next.pricingMethod;
    // stage 3: the shared-price link stays through any edit of the same billing basis; another basis unlinks the row (asked before)
    if (item.price_link_id && next.pricingMethod === now.pricingMethod && (built.pricing_unit || null) === (item.pricing_unit || null)) built.price_link_id = item.price_link_id;
    lastBuilt.current = built;
    onItem(index, built);
    return built;
  };
  const method = entry.pricingMethod;
  // Owner console 2026-11-08 (restore item 03): the item window's rule (4f1592f2 AddItemWizard 964-989) - every billing change of a saved
  // line may reinterpret its numbers and is asked first; on a new row a price typed for one basis is never kept silently for another
  const conversionAsk = (m) => {
    if (isLinked) return t.linkBreak;
    if (item.id) return t.conversion;
    if (isMeasured(method) && !isMeasured(m) && hasSizes(item)) return t.sizesLost;
    if (typed(entry.unitPrice)) return t.unitChangeAsk;
    return null;
  };
  const changeMethod = async (m) => {
    if (m === method) return;
    if (isMeasured(m) && !canUseMeasured) { onMeasuredLocked?.(); return; }
    const ask = conversionAsk(m);
    if (ask && !(await askConfirm(ask, isHebrew))) return;
    apply({ pricingMethod: m, quantity: isCountedMethod(m) ? (isCountedMethod(method) ? (entry.quantity || '1') : '1') : '1', useManualQty: isMeasured(m) ? entry.useManualQty : false });
  };
  // restore item 09 (decision 2: "catalog pick fills price + billing type"): a catalog item fills the name, the price and the catalog's
  // billing type - units, quantity 1, as the item window opened a catalog line; replacing another basis is asked first (item 03)
  const pickCatalog = async (s) => {
    if (method !== 'units') {
      const ask = conversionAsk('units');
      if (ask && !(await askConfirm(ask, isHebrew))) return;
    }
    // the item window always started a catalog line at quantity 1 (4f1592f2 AddItemWizard 164-166)
    const built = apply({ description: String(s.name || ''), unitPrice: s.price == null ? '' : String(s.price), catalogServiceId: String(s.id),
      pricingMethod: 'units', quantity: '1', useManualQty: false });
    if (built && typeof onCatalogItemAdded === 'function') onCatalogItemAdded(s.id, built);
  };
  // a known amount starts from the row's current amount (never an empty 0); sizes / known switch is a conversion of the row
  const changeSizeMode = (known) => {
    const current = Number(getActiveQuantity(item) || 0);
    apply({ useManualQty: known, manualQty: known ? (entry.manualQty || (current > 0 ? String(current) : '')) : entry.manualQty });
  };
  // the item window's unit rule (Owner 2026-11-05): typed sizes convert to the new unit; metres <-> feet changes what the price is for, so it
  // asks first when a price exists, and a known m² is never re-read as sq ft
  const changeMeasureUnit = async (next) => {
    const from = entry.measureUnit;
    if (next === from) return;
    const crossing = isFeetUnit(next) !== isFeetUnit(from);
    if (crossing && isLinked && !(await askConfirm(t.linkBreak, isHebrew))) return;
    if (crossing && String(entry.unitPrice ?? '').trim() !== '' && !(await askConfirm(t.unitChange, isHebrew))) return;
    apply({
      measureUnit: next,
      widthCm: convertSizeBetween(entry.widthCm, from, next),
      heightCm: convertSizeBetween(entry.heightCm, from, next),
      extraMeasureRows: (entry.extraMeasureRows || []).map((r) => ({ ...r, widthCm: convertSizeBetween(r.widthCm, from, next), heightCm: convertSizeBetween(r.heightCm, from, next) })),
      manualQty: crossing ? '' : entry.manualQty,
    });
  };
  const qty = Number(getActiveQuantity(item) || 0);
  const price = Number(item.unit_price);
  // restore items 04 / 05: a marked row shows no amount (its stored amount is not what it shows now) until it is fixed
  const total = item._invalid || item.unit_price === '' || item.unit_price == null || !Number.isFinite(price) ? null : (method === 'fixed' ? price : qty * price);
  // a counted unit that is not plain "units" (hour / day / kg, a known m²) shows its unit next to the quantity
  const countUnit = isCountedMethod(method) && method !== 'units' ? getProfessionalUnitLabel(method, isHebrew)
    : method === 'units' && item.pricing_unit && item.pricing_unit !== 'unit' ? getProfessionalUnitLabel(item.pricing_unit, isHebrew) : '';
  // restore item 04: the size problems of this row, shown once the row was left (or when it opens marked from a draft / a refused save)
  const sizeErr = sizeProblems(entry, t);
  const [showSizeErr, setShowSizeErr] = useState(false);
  const unitSelect = (
    <select aria-label={t.amount} value={entry.measureUnit} onChange={(e) => changeMeasureUnit(e.target.value)} data-testid={`qrow-sizeunit-${rowId}`} style={{ ...fieldStyle, fontSize: '0.8rem' }}>
      {sizeUnits(international).map((u) => <option key={u} value={u}>{sizeUnitLabel(u, isHebrew)}</option>)}
    </select>
  );
  const num = { inputMode: 'decimal', dir: 'ltr', className: 'pf-num', style: { width: '58px', minHeight: '40px', padding: '0 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.86rem', textAlign: 'center' } };
  const extra = entry.extraMeasureRows || [];
  const setExtra = (rows) => apply({ extraMeasureRows: rows });
  const specRows = entry.specRows || [];
  const close = () => setMenu(false);
  const calcUnit = method === 'area' ? areaLabel(entry, isHebrew) : lengthLabel(entry, isHebrew);
  // the sizes read left to right in both languages, exactly like the customer's quote (`4 × 3 m`)
  const sizeGroup = { display: 'inline-flex', alignItems: 'center', gap: '6px', direction: 'ltr' };
  return (
    <div ref={rowRef} className="qrow qrow-line" role="group" aria-label={`${t.item} ${pos + 1}`} data-testid={`qrow-${rowId}`} data-invalid={item._invalid ? 'true' : undefined}
      onFocus={() => setShowSizeErr(false)}
      onBlur={(e) => {
        // the message appears a moment after the row is left - never under a pointer mid-click (it would push the clicked button away),
        // and not when the user is already back in the row
        if (!e.currentTarget.contains(e.relatedTarget)) window.setTimeout(() => { if (!rowRef.current || !rowRef.current.contains(document.activeElement)) setShowSizeErr(true); }, 250);
      }}>
      <ItemField value={entry.description} rowId={rowId} t={t} services={services} inputRef={itemInput} sym={sym} fmtMoney={fmtMoney}
        onText={(v) => apply({ description: v, catalogServiceId: null })}
        onPick={(s) => { pickCatalog(s); }} />
      <label className="qrow-billing"><span className="qrow-mlabel">{t.billing}</span>
      <select aria-label={t.billing} value={method} data-testid={`qrow-billing-${rowId}`} onChange={(e) => changeMethod(e.target.value)} style={fieldStyle}>
        {orderedMethods(recommendedMethod).map((m) => <option key={m} value={m}>{m === recommendedMethod ? `${t[m]} · ${t.recommended}` : t[m]}</option>)}
      </select>
      </label>
      <div className="qrow-amount" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
        {method !== 'fixed' && <span className="qrow-mlabel" style={{ flexBasis: '100%' }}>{t.amount}</span>}
        {isCountedMethod(method) && (<>
          <input {...num} aria-label={t.qty} aria-invalid={qtyErr} value={entry.quantity} data-testid={`qrow-qty-${rowId}`} onChange={(e) => apply({ quantity: e.target.value })}
            onBlur={() => { if (!typed(entry.quantity)) setQtyEmpty(true); }} />
          {countUnit && <span style={{ fontSize: '0.78rem', color: NEON.textSecondary }}>{countUnit}</span>}
        </>)}
        {isMeasured(method) && entry.useManualQty && (<>
          <input {...num} aria-label={t.known} aria-invalid={qtyErr || qtyEmpty} value={entry.manualQty ?? ''} data-testid={`qrow-known-${rowId}`} onChange={(e) => apply({ manualQty: e.target.value })}
            onBlur={() => { if (!typed(entry.manualQty)) setQtyEmpty(true); }} />
          {unitSelect}
          <span style={{ fontSize: '0.74rem', color: NEON.textSecondary }}>{calcUnit}</span>
          <span aria-hidden="true" style={{ flexBasis: '100%', height: 0 }} />
          {/* PRODUCT_TRUTH_DECORATIVE: restore item 02 (Owner 2026-11-08) - back from a known amount to typed sizes, beside the amount (the item window's "Enter sizes instead") */}
          <button type="button" data-testid={`qrow-sizemode-${rowId}`} data-mode="known" onClick={() => changeSizeMode(false)} style={inlineLink}>{t.backToSizes}</button>
        </>)}
        {isMeasured(method) && entry.useManualQty && entry.referenceSizes && hasSizes(item) && (
          // restore item 16 (Owner 2026-11-08): a hand-set quantity is what is charged; the sizes it kept are shown for reference only
          <span data-testid={`qrow-refsizes-${rowId}`} style={{ flexBasis: '100%', fontSize: '0.74rem', color: NEON.textSecondary }}>
            {t.refSizes}: {item.measurements.map((m, i) => <span key={i}>{i > 0 ? ' · ' : ''}<bdi dir="ltr" className="pf-num">{formatMeasurementLine(m, isHebrew, (v) => formatQuantity(v))}</bdi></span>)}
          </span>
        )}
        {method === 'area' && !entry.useManualQty && (<>
          <span style={sizeGroup}>
            <input {...num} aria-label={t.width} value={entry.widthCm} data-testid={`qrow-w-${rowId}`} onChange={(e) => apply({ widthCm: e.target.value })} />
            <span aria-hidden="true" style={{ color: NEON.textSecondary }}>×</span>
            <input {...num} aria-label={t.height} value={entry.heightCm} data-testid={`qrow-h-${rowId}`} onChange={(e) => apply({ heightCm: e.target.value })} />
            {unitSelect}
          </span>
        </>)}
        {method === 'linear' && !entry.useManualQty && (<>
          <span style={sizeGroup}>
            <input {...num} aria-label={t.length} value={entry.widthCm} data-testid={`qrow-w-${rowId}`} onChange={(e) => apply({ widthCm: e.target.value })} />
            {unitSelect}
          </span>
        </>)}
        {isMeasured(method) && !entry.useManualQty && (<>
          <span aria-hidden="true" style={{ flexBasis: '100%', height: 0 }} />
          <span data-testid={`qrow-calc-${rowId}`} style={{ fontSize: '0.74rem', color: NEON.textSecondary }}>{qty && !item._invalid ? (<><bdi dir="ltr" className="pf-num">{formatQuantity(qty, item.pricing_unit)}</bdi> {calcUnit}</>) : ''}</span>
          {/* PRODUCT_TRUTH_DECORATIVE: adds another size line to this row (the item window's "another measurement"); sub-control of the measured row */}
          <button type="button" data-testid={`qrow-moresize-${rowId}`} onClick={() => setExtra([...extra, { widthCm: '', heightCm: '', label: '' }])}
            style={{ background: 'none', border: 'none', color: NEON.violet, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', minHeight: '40px', padding: '0 4px' }}>+ {t.moreSize}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: restore item 02 (Owner 2026-11-08) - "I already know the area / length" beside the sizes again (it had moved into the row menu) */}
          <button type="button" data-testid={`qrow-sizemode-${rowId}`} data-mode="sizes" onClick={() => changeSizeMode(true)} style={inlineLink}>{method === 'area' ? t.knowArea : t.knowLength}</button>
          {showSizeErr && sizeErr?.main && <p role="alert" data-testid={`qrow-sizeerr-${rowId}`} style={errStyle}>{sizeErr.main}</p>}
        </>)}
        {qtyErr && <p role="alert" style={errStyle}>{t.qtyError}</p>}
        {!qtyErr && qtyEmpty && <p role="alert" data-testid={`qrow-qtyempty-${rowId}`} style={errStyle}>{t.missingQuantity}</p>}
      </div>
      <label className="qrow-price"><span className="qrow-mlabel">{t.price}</span>
      <input {...num} aria-label={t.price} aria-invalid={priceErr} value={entry.unitPrice} data-testid={`qrow-price-${rowId}`} onChange={(e) => apply({ unitPrice: e.target.value })}
        onFocus={() => { priceAtFocus.current = String(entry.unitPrice ?? ''); }}
        onBlur={() => {
          const now = String(entry.unitPrice ?? '').trim();
          if (isLinked && now !== '' && parsePriceInput(now).ok && priceAtFocus.current != null && now !== priceAtFocus.current.trim()) setLinkAsk({ from: priceAtFocus.current });
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && String(entry.description).trim() !== '' && !priceErr) { e.preventDefault(); onEnterNext(index); } }}
        style={{ ...num.style, width: '84px' }} />
      {priceErr && <span role="alert" style={{ ...errStyle, display: 'block' }}>{t.priceError}</span>}
      </label>
      <bdi dir="ltr" className="qrow-total pf-money" data-testid={`qrow-total-${rowId}`} style={{ fontWeight: 800, color: NEON.violet, whiteSpace: 'nowrap', minWidth: '72px', textAlign: 'right', lineHeight: '40px' }}>
        {total == null ? '—' : `${sym}${fmtMoney(total)}`}
      </bdi>
      <div className="qrow-menu" style={{ position: 'relative' }}>
        {/* PRODUCT_TRUTH_DECORATIVE: row three-dot 'actions' button that opens the row menu; a menu-toggle */}
        <button ref={menuBtnRef} type="button" aria-label={t.menu} aria-haspopup="menu" aria-expanded={menu} data-testid={`qrow-menu-${rowId}`} onClick={() => setMenu((v) => !v)}
          style={{ minWidth: '40px', minHeight: '40px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: 'none', color: NEON.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <MoreVertical size={16} aria-hidden="true" />
        </button>
        {menu && (
          <div role="menu" style={{ position: 'absolute', insetInlineEnd: 0, top: '100%', zIndex: 30, marginTop: '4px', minWidth: '190px', background: NEON.bgCard, border: `1px solid ${NEON.border}`, borderRadius: '10px', boxShadow: '0 12px 28px -10px rgba(15,23,42,0.35)', padding: '4px' }}>
            {/* PRODUCT_TRUTH_DECORATIVE: row menu 'details for the customer': opens the item's specification rows inside the row (the item window's details) */}
            <button type="button" role="menuitem" onClick={() => { close(); setShowDetails(true); if (specRows.length === 0) setEntry((e) => ({ ...e, specRows: [{ label: '', value: '' }] })); }} style={menuBtn}>{t.details}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: row menu 'duplicate row': copies this item as a new line (same as the item card's duplicate) */}
            <button type="button" role="menuitem" onClick={() => { close(); onDuplicate(index); }} style={menuBtn}>{t.duplicate}</button>
            {pos > 0 && (
              // PRODUCT_TRUTH_DECORATIVE: row menu 'move up' inside its unit (the saved order)
              <button type="button" role="menuitem" onClick={() => { close(); onShift(pos, -1); }} style={menuBtn}>{t.moveUp}</button>
            )}
            {pos < count - 1 && (
              // PRODUCT_TRUTH_DECORATIVE: row menu 'move down' inside its unit (the saved order)
              <button type="button" role="menuitem" onClick={() => { close(); onShift(pos, 1); }} style={menuBtn}>{t.moveDown}</button>
            )}
            {sections.length > 0 && (
              <label style={{ ...menuBtn, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {t.moveTo}
                <select value={item.section_key || ''} onChange={(e) => { close(); onMove(index, e.target.value || null); }} style={fieldStyle}>
                  <option value="">{t.noUnit}</option>
                  {sections.map((s) => <option key={s.key} value={s.key}>{s.name || (isHebrew ? '(ללא שם)' : '(unnamed)')}</option>)}
                </select>
              </label>
            )}
            {canRemove && (
              // PRODUCT_TRUTH_DECORATIVE: row menu 'remove row': removes this item from the open quote (same as the item card's remove); restore item 17 (Owner 2026-11-08): shown only when the quote has more than one line, as before
              <button type="button" role="menuitem" onClick={() => { close(); onRemove(index); }} style={{ ...menuBtn, color: NEON.red }}>{t.remove}</button>
            )}
          </div>
        )}
      </div>
      {linkAsk && isLinked && (
        <div className="qrow-extra" role="group" aria-label={linked.count === 1 ? t.linkedAsk1 : t.linkedAsk.replace('{n}', String(linked.count))} data-testid={`qrow-linkask-${rowId}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 10px', border: `1px solid ${NEON.violetLight}`, borderRadius: '10px', background: NEON.bgCardAlt }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: NEON.textPrimary }}>
            {t.linkedTo}<bdi dir="ltr" className="pf-money">{sym}{fmtMoney(Number(item.unit_price))}</bdi>{isMeasured(method) ? <> {t.perUnit} {calcUnit}</> : null}. {linked.count === 1 ? t.linkedAsk1 : t.linkedAsk.replace('{n}', String(linked.count))}
          </span>
          <span style={{ fontSize: '0.76rem', color: NEON.textSecondary }}>
            {linked.names.map((n, i) => <span key={i}>{i > 0 ? ', ' : ''}<bdi>{n}</bdi></span>)}
            {linked.copies > linked.count ? <> · {t.linkedCopies.replace('{c}', String(linked.copies))}</> : null}
          </span>
          <span style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', marginInlineStart: 'auto' }}>
            {/* PRODUCT_TRUTH_DECORATIVE: shared price (stage 3) - keep the new price only in this row */}
            <button type="button" data-testid={`qrow-link-here-${rowId}`} onClick={() => setLinkAsk(null)} style={linkBtn}>{t.linkedHere}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: shared price (stage 3) - the linked rows take the new price, each by its own sizes and unit count */}
            <button type="button" data-testid={`qrow-link-all-${rowId}`} onClick={() => { const from = linkAsk.from; setLinkAsk(null); onLinkedAll?.(index, from); }} style={{ ...linkBtn, background: NEON.violet, color: '#fff', borderColor: NEON.violet }}>{linked.count === 1 ? t.linkedAll1 : t.linkedAll}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: shared price (stage 3) - cancel: this row returns to its previous price */}
            <button type="button" data-testid={`qrow-link-cancel-${rowId}`} onClick={() => { const from = linkAsk.from; setLinkAsk(null); apply({ unitPrice: from }); }} style={linkBtn}>{t.linkedCancel}</button>
          </span>
        </div>
      )}
      {isMeasured(method) && !entry.useManualQty && extra.length > 0 && (
        <div className="qrow-extra" data-testid={`qrow-extrasizes-${rowId}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {extra.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <input type="text" aria-label={t.sizeLabel} placeholder={t.sizeLabel} value={r.label} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} style={{ ...fieldStyle, padding: '0 8px', width: '140px' }} />
              <span style={sizeGroup}>
                <input {...num} aria-label={t.width} value={r.widthCm} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, widthCm: e.target.value } : x)))} />
                {method === 'area' && (<>
                  <span aria-hidden="true" style={{ color: NEON.textSecondary }}>×</span>
                  <input {...num} aria-label={t.height} value={r.heightCm} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? { ...x, heightCm: e.target.value } : x)))} />
                </>)}
                <span style={{ fontSize: '0.76rem', color: NEON.textSecondary }}>{sizeUnitLabel(entry.measureUnit, isHebrew)}</span>
              </span>
              {/* PRODUCT_TRUTH_DECORATIVE: removes one extra size line of this row */}
              <button type="button" aria-label={t.removeSize} onClick={() => setExtra(extra.filter((_, j) => j !== i))} style={iconBtn}><X size={14} aria-hidden="true" /></button>
              {showSizeErr && sizeErr?.rows?.[i] && <p role="alert" style={errStyle}>{sizeErr.rows[i]}</p>}
            </div>
          ))}
        </div>
      )}
      {showDetails && (
        <div className="qrow-extra" data-testid={`qrow-details-${rowId}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: NEON.textSecondary }}>{t.details}</span>
          {specRows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <input type="text" aria-label={t.detailLabel} placeholder={t.detailLabel} value={r.label} onChange={(e) => apply({ specRows: specRows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} style={{ ...fieldStyle, padding: '0 8px', flex: '1 1 140px', minWidth: 0 }} />
              <input type="text" aria-label={t.detailValue} placeholder={t.detailValue} value={r.value} onChange={(e) => apply({ specRows: specRows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} style={{ ...fieldStyle, padding: '0 8px', flex: '2 1 180px', minWidth: 0 }} />
              {/* PRODUCT_TRUTH_DECORATIVE: removes one detail line of this row */}
              <button type="button" aria-label={t.removeDetail} onClick={() => { const rows = specRows.filter((_, j) => j !== i); apply({ specRows: rows }); if (rows.length === 0) setShowDetails(false); }} style={iconBtn}><X size={14} aria-hidden="true" /></button>
            </div>
          ))}
          {/* PRODUCT_TRUTH_DECORATIVE: adds one more detail line to this row */}
          <button type="button" onClick={() => apply({ specRows: [...specRows, { label: '', value: '' }] })} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: NEON.violet, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', minHeight: '40px', padding: 0 }}>+ {t.addDetail}</button>
        </div>
      )}
    </div>
  );
}
const inlineLink = { background: 'none', border: 'none', color: NEON.violet, fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', minHeight: '40px', padding: '0 4px', textDecoration: 'underline' };
const linkBtn = { minHeight: '40px', padding: '0 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' };
const menuBtn = { display: 'block', width: '100%', textAlign: 'start', padding: '8px 10px', minHeight: '40px', background: 'none', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.84rem', color: NEON.textPrimary };
const iconBtn = { minWidth: '40px', minHeight: '40px', border: 'none', borderRadius: '8px', background: 'none', color: NEON.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

/**
 * items / setItems: the whole quote's lines (Dashboard state); indices: the lines this list shows, in order (default: all) - a unit card
 * passes its own lines. addSectionKey: the unit a new row joins. keyStore: one shared { map, seq, focus } so a row keeps its key (its typed
 * entry and the focus) when its item object is replaced.
 */
export default function QuoteRowsEditor({
  items, setItems, indices = null, addSectionKey = null, showHead = true, showAdd = true, keyStore = null,
  services = [], sections = [], isHebrew, international = false, sym = '', fmtMoney = (v) => Number(v).toFixed(2),
  onCatalogItemAdded = null, canUseMeasured = true, onMeasuredLocked = null, canDuplicate = () => true, onDuplicateLocked = null,
  recommendedMethod = null,
}) {
  const t = COPY[isHebrew ? 'he' : 'en'];
  const own = useRef(null);
  if (!own.current) own.current = { map: new WeakMap(), seq: 0, focus: null };
  const store = keyStore || own.current;
  const keyOf = (it) => { if (!store.map.has(it)) store.map.set(it, it.id || `r${(store.seq += 1)}`); return store.map.get(it); };
  const shown = indices || items.map((_, i) => i);
  // an edited row keeps its key (its typed entry and the focus stay): the key travels with the new item object
  const onItem = (index, built) => setItems((prev) => prev.map((it, i) => { if (i !== index) return it; store.map.set(built, keyOf(it)); return built; }));
  const insertAfter = (index, newItem) => setItems((prev) => [...prev.slice(0, index + 1), newItem, ...prev.slice(index + 1)]);
  const onDuplicate = (index) => {
    const src = items[index];
    if (!canDuplicate(src)) { onDuplicateLocked?.(); return; }
    insertAfter(index, copyItem(src));
  };
  // the last line of the quote is never removed into nothing: a blank row stays to type in
  const onRemove = (index) => setItems((prev) => { const next = prev.filter((_, i) => i !== index); return next.length ? next : [blankRowItem(null)]; });
  const onMove = (index, key) => setItems((prev) => prev.map((it, i) => { if (i !== index) return it; const moved = { ...it, section_key: key }; store.map.set(moved, keyOf(it)); return moved; }));
  // up / down inside this list: the two lines swap places in the quote (the saved order follows the list order)
  const onShift = (pos, dir) => {
    const a = shown[pos];
    const b = shown[pos + dir];
    if (a == null || b == null) return;
    setItems((prev) => { const next = [...prev]; [next[a], next[b]] = [next[b], next[a]]; return next; });
  };
  // Owner console 2026-11-08 (stage 3, decision 5): the rows sharing a row's price (linked by duplicating a unit) - their unit names and
  // how many identical copies they stand for; "update all" reprices each one by the same item builder as typing the price in that row
  const sectionOf = (key) => (key ? sections.find((s) => s.key === key) : null);
  const linkedOf = (index) => {
    const src = items[index];
    if (!src?.price_link_id) return null;
    const others = items.filter((it, i) => i !== index && it && it.price_link_id === src.price_link_id);
    const names = [...new Set(others.map((it) => sectionOf(it.section_key)?.name || t.noUnit))];
    return { count: others.length, names, copies: others.reduce((n, it) => n + normalizeRepeatCount(sectionOf(it.section_key)?.repeat_count), 0) };
  };
  const repriced = (it, priceValue) => {
    const e = rowEntry(it, international);
    const built = buildQuoteItemFromEntry({ ...e, unitPrice: priceValue, sectionKey: it.section_key ?? null, editingItem: it, isEditMode: true, conversionConfirmed: false });
    if (isCountedMethod(e.pricingMethod) && it.quantity !== undefined) built.quantity = it.quantity;
    if (it._billing) built._billing = it._billing;
    built.price_link_id = it.price_link_id;
    return built;
  };
  const [priceUndo, setPriceUndo] = useState(null);
  const onLinkedAll = (index, fromText) => {
    const src = items[index];
    const p = parsePriceInput(String(src?.unit_price ?? ''));
    if (!src?.price_link_id || !p.ok) return;
    const before = parsePriceInput(String(fromText ?? ''));
    const pairs = [];
    const next = items.map((it, i) => {
      if (!it) return it;
      if (i === index) { if (before.ok) pairs.push([repriced(it, before.value), it]); return it; }
      if (it.price_link_id !== src.price_link_id) return it;
      const built = repriced(it, p.value);
      store.map.set(built, keyOf(it));
      pairs.push([it, built]);
      return built;
    });
    setItems(next);
    setPriceUndo({ pairs, count: pairs.length - (before.ok ? 1 : 0) });
  };
  const undoLive = priceUndo && priceUndo.pairs.every(([, after]) => items.includes(after));
  const undoPrices = () => {
    if (!undoLive) return;
    const back = new Map(priceUndo.pairs.map(([b, a]) => [a, b]));
    setItems((prev) => prev.map((it) => { const b = back.get(it); if (!b) return it; store.map.set(b, keyOf(it)); return b; }));
    setPriceUndo(null);
  };
  const addRow = () => {
    const row = blankRowItem(addSectionKey);
    store.focus = keyOf(row);
    setItems((prev) => [...prev, row]);
  };
  const onEnterNext = (index) => {
    const row = { ...blankRowItem(items[index]?.section_key ?? addSectionKey) };
    store.focus = keyOf(row);
    insertAfter(index, row);
  };
  return (
    <div className="qrows" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="quote-rows-editor">
      {showHead && (
        <div className="qrow qrow-head" aria-hidden="true">
          <span>{t.item}</span><span>{t.billing}</span><span>{t.amount}</span><span>{t.price}</span><span style={{ textAlign: 'right' }}>{t.total}</span><span />
        </div>
      )}
      {shown.map((index, pos) => {
        const item = items[index];
        if (!item) return null;
        const k = keyOf(item);
        return (
          <Fragment key={k}>
            {item._localExample && (
              // Owner console 2026-11-08 (restore item 07; 4f1592f2:src/components/QuoteForm.jsx 1023-1031): the example line's mark and removal
              <div data-testid="quote-example-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 10px', margin: '4px 0', borderRadius: '8px', background: '#fff4e2', border: '1px solid #f1c27d', color: '#8a4b00', fontSize: '0.78rem', fontWeight: 700 }}>
                <span>{isHebrew ? 'דוגמה · לא נשמרת' : 'Example · not saved'}</span>
                {/* PRODUCT_TRUTH_DECORATIVE: removes the local example line (Owner round 1, A6; restored 2026-11-08) */}
                <button type="button" data-testid="quote-remove-example" onClick={() => setItems((prev) => { const rest = prev.filter((it) => !(it && it._localExample)); return rest.length ? rest : [blankRowItem(null)]; })}
                  style={{ background: 'none', border: 'none', color: '#8a4b00', textDecoration: 'underline', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', padding: '4px 6px', minHeight: '40px' }}>
                  {isHebrew ? 'הסרת הדוגמה' : 'Remove the example'}
                </button>
              </div>
            )}
            <RowLine rowId={k} item={item} index={index} pos={pos} count={shown.length} store={store} t={t} isHebrew={isHebrew} international={international}
              sym={sym} fmtMoney={fmtMoney} services={services} sections={sections} onItem={onItem} onDuplicate={onDuplicate} onRemove={onRemove} onMove={onMove}
              onShift={onShift} onEnterNext={onEnterNext} onCatalogItemAdded={onCatalogItemAdded} canUseMeasured={canUseMeasured} onMeasuredLocked={onMeasuredLocked}
              linked={linkedOf(index)} onLinkedAll={onLinkedAll} recommendedMethod={recommendedMethod} canRemove={items.length > 1} />
          </Fragment>
        );
      })}
      {undoLive && (
        <div role="status" data-testid="qrow-price-undo" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.8rem', color: NEON.textSecondary }}>
          <span>{priceUndo.count === 1 ? t.linkedDone1 : t.linkedDone.replace('{n}', String(priceUndo.count))}</span>
          {/* PRODUCT_TRUTH_DECORATIVE: shared price (stage 3) - undo the last linked price update, the row that started it included */}
          <button type="button" onClick={undoPrices} style={linkBtn}>{t.linkedUndo}</button>
        </div>
      )}
      {showAdd && (
        // PRODUCT_TRUTH_DECORATIVE: add row: appends a blank quote item row (the one quote builder's rows; sub-control of the existing add-item flow)
        <button type="button" data-testid="qrow-add" onClick={() => addRow()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '0 14px', marginTop: '8px', border: `1px dashed ${NEON.borderStrong}`, borderRadius: '10px', background: 'none', color: NEON.textPrimary, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={16} aria-hidden="true" />{t.addRow}
        </button>
      )}
    </div>
  );
}
