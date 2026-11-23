// 2026-11-20/21 (Owner console, typed: "מאשר ליישם במוצר את הסקיצה TEKANGO-sketch-simple-quotes-2026-11-20 (רשימת ההצעות ועורך ההצעה, עברית
// ואנגלית, כל הרוחבים) כדמו המאושר החדש במקום הדמו הקודם, כולל כל שינויי ההתנהגות שבה, שורת ההקלדה מתחת לשורות והשמות "מחולקת לחלקים" /
// "חלקים בתוך חלקים" בכל מקום שהם מופיעים; מאשר שינוי ב-L-07, L-19, L-25, L-26, L-27 ו-L-29 רק במה שנדרש לזה ..." + 2026-11-21 L-02 ... L-23):
// the work area of the quote editor = the sketch C:/tekango-ops/demos/simple1120/src.html (itemsScreen / eline / card / formHtml / rowHtml /
// headHtml / addHPanel / structBody):
//   - "מבנה: <name> ▾" - one menu with the three structures (an example line under each);
//   - ONE entry row per quote, inside the table and BELOW its rows; it goes with the chosen section ("אל: דירה 22 ← סלון");
//   - the rows as a table: work / pricing / qty / price / sum on the amount axis / "⋯" (edit, duplicate, up, down, move to a section, remove);
//   - a section: its name (a click sends the entry row to it), "+", its total on the axis, "⋯" (add here, add inside, rename in place,
//     duplicate with content, copy the works of the first, save as a template, remove with content) - nothing opens as a page any more;
//   - adding sections in the page: the kind, how many (up to 100), the names (an empty name = a name in order).
// The quantity starts EMPTY; "מחיר גלובלי" = one price for the row; an empty price is not 0 (unchanged).
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { SketchIcon } from '../SketchIcons';
import { ChevronDown, X } from 'lucide-react';
import './quoteTree.css';
import { buildQuoteItemFromEntry, rowEntry, isCountedMethod } from '../../utils/quoteItemEntry';
import { askConfirm } from '../AppDialog';
import EllipsisText from '../EllipsisText';
import { groupWord } from '../../utils/quoteGroups';
import { isUntouchedPlaceholderItem } from '../../utils/structuredQuoteItemPersistence';
import { parseQuantityInput, parsePriceInput } from '../../utils/itemPrice';
import { formatQuantity, getProfessionalUnitLabel, normalizeRepeatCount } from '../../utils/professionalQuoteItem';
import { useMoneySlotSize } from '../../hooks/useMoneySlotSize';
import { childrenOf, topHeadings, pathOf, depthOf, itemIndicesOf, lineTotal, headingTotal, addHeadings, removeHeadingWithContent, duplicateHeading,
  sortServices, parentOf, subtreeKeys, MAX_DEPTH, firstSiblingOf, copyRowsFromFirst } from './treeModel';

const T = {
  he: {
    structL: 'מבנה:', simple: 'הצעה פשוטה', grouped: 'מחולקת לחלקים', tiered: 'חלקים בתוך חלקים',
    sxSimple: 'למשל: חלון, צביעה והתקנה', sxGrouped: 'למשל: דירה 1, דירה 2, חצר', sxTiered: 'למשל: קומה 10 ← דירה 22 ← מטבח',
    help: 'הסבר', whole: 'כל ההצעה', back: 'חזרה', to: 'אל:',
    formTitle: 'מוסיפים עבודה או מוצר', product: 'חיפוש מוצר', pricing: 'חישוב', qty: 'כמות', price: 'מחיר ליחידה',
    productPh: 'בחרו מוצר מהקטלוג', newProduct: '+ הוספת מוצר חדש', newPh: 'הקלידו שם למוצר החדש', add: 'הוספה', clear: 'ניקוי השורה', more: 'מידות ופירוט נוסף',
    lineSum: 'סכום השורה:', notPriced: 'טרם תומחר', saveCatalog: 'לשמור גם בקטלוג', savedCatalog: 'השורה נוספה ונשמרה גם בקטלוג.',
    catalogDup: 'מוצר בשם הזה כבר קיים בקטלוג - לא נשמר שוב. השורה נוספה להצעה.', catalogNoPrice: 'מוצר בלי מחיר לא נשמר בקטלוג. השורה נוספה להצעה.',
    catalogFail: 'השמירה בקטלוג נכשלה. השורה נוספה להצעה.',
    units: { units: 'ליחידה', area: 'למ״ר', linear: 'למטר', areaFt: 'לרגל רבועה', linearFt: 'לרגל', hour: 'לשעה', day: 'ליום עבודה', kg: 'לק״ג', fixed: 'מחיר גלובלי' },
    unitShort: { units: 'יח׳', area: 'מ״ר', linear: 'מטר', areaFt: 'רגל רבועה', linearFt: 'רגל', hour: 'שעות', day: 'ימים', kg: 'ק״ג', fixed: '' },
    qtyPh: { units: "מס' יחידות", area: 'שטח במ״ר', linear: 'אורך במטרים', areaFt: 'שטח ברגל רבועה', linearFt: 'אורך ברגל', hour: "מס' שעות", day: "מס' ימי עבודה", kg: 'משקל בק״ג' },
    pricePh: { units: 'מחיר ליחידה', area: 'מחיר למ״ר', linear: 'מחיר למטר', areaFt: 'מחיר לרגל רבועה', linearFt: 'מחיר לרגל', hour: 'מחיר לשעה', day: 'מחיר ליום', kg: 'מחיר לק״ג', fixed: 'מחיר גלובלי' },
    needName: 'כתבו מה עושים או איזה מוצר מוסיפים.', needQty: 'הקלידו כמות או מידות גדולות מאפס.', badPrice: 'המחיר צריך להיות אפס או יותר. אפשר להשאיר ריק לטיוטה.',
    sizeIncomplete: 'השלימו את כל המידות או הסירו מידה ריקה.',
    known: { area: 'השטח כבר ידוע', linear: 'האורך כבר ידוע' }, byMeasures: 'לפי מידות', measureName: 'שם המידה (לא חובה)',
    lengthOf: { m: 'אורך במטרים', ft: 'אורך ברגל' }, widthOf: { m: 'רוחב במטרים', ft: 'רוחב ברגל' }, removeMeasure: 'הסרת המידה', addSize: '+ מידה נוספת',
    workDetails: 'פירוט לעבודה (לא חובה)', workDetailsPh: 'למשל: צבע, דגם או מה כלול במחיר',
    msgAdded: 'השורה נוספה להצעה.', msgUpdated: 'השורה עודכנה.', msgCopied: 'נוסף עותק של העבודה.', msgRemoved: 'השורה הוסרה.', msgMoved: 'השורה הועברה.',
    msgHeadingAdded: 'החלק נוסף. העבודות הבאות יופיעו מתחתיו.', msgHeadingCopied: 'נוסף עותק עם כל התוכן. אפשר לשנות לו את השם כאן.',
    msgHeadingDeleted: 'החלק הוסר עם התוכן שלו. אפשר לבטל.', msgNamesSaved: 'השם נשמר.', msgCopiedFirst: 'העבודות הועתקו. מה שהיה כאן נשמר.',
    undoLast: 'ביטול הפעולה האחרונה', closeMsg: 'סגירת ההודעה',
    colWork: 'העבודה / המוצר', colQty: 'כמות', colPrice: 'מחיר', colSum: 'סכום', actions: 'פעולות',
    edit: 'עריכה', duplicate: 'שכפול', remove: 'הסרה', up: 'הזזה למעלה', down: 'הזזה למטה', moveToMenu: 'העברה לחלק אחר', moveT: 'לאן להעביר את השורה?', here: 'כאן עכשיו', cancel: 'ביטול',
    hAddFirst: 'הוספת חלק: דירה, קומה, חדר או נושא אחר', kindQ: 'מה מוסיפים להצעה?', kindQIn: (n) => `מה מוסיפים בתוך "${n}"?`,
    kinds: { floor: 'קומה', apartment: 'דירה', room: 'חדר', section: 'נושא בשם אחר' }, kinds1: { floor: 'קומה', apartment: 'דירה', room: 'חדר', section: 'נושא' },
    plural: { floor: 'קומות', apartment: 'דירות', room: 'חדרים', section: 'נושאים' },
    countQ: (p) => `כמה ${p} להוסיף?`, countHint: (one) => `את השם או המספר של כל ${one} מקלידים בשלב הבא. אפשר להוסיף גם אחד.`,
    countErr: 'כתבו מספר שלם, 1 ומעלה.', countMax: 'אפשר להוסיף עד 100 בכל פעם.',
    namesQ: (k, one) => (k === 'section' ? 'איך לקרוא לכל נושא?' : `מה השם או המספר של כל ${one}?`), namesHint: 'שדה ריק = שם לפי הסדר.',
    namePh: { floor: 'למשל: קומה 10', apartment: 'למשל: דירה 33', room: 'למשל: חדר ילדים', section: 'למשל: חצר' }, nameL: 'שם',
    namesDup: 'יש כבר חלק בשם הזה באותה רמה. תנו לכל אחד שם שונה.', toNames: 'להמשך', hCreate: 'הוספה להצעה', closeNoSave: 'חזרה ללא שמירה',
    hActs: (n) => `פעולות ל${n}`, addHere: 'הוספת עבודה או מוצר כאן', hInside: 'הוספת חלק בתוך', hRename: 'שינוי שם', hDup: 'שכפול עם התוכן',
    hCopyFirst: 'העתקת עבודות מהראשון', hTmpl: 'שמירה כתבנית', hDel: 'הסרה עם התוכן', saveName: 'שמירת השם', needHName: 'כתבו שם.',
    hOpen: 'פתיחה', hClose: 'סגירה', addHereL: (n) => `הוספת עבודה או מוצר אל ${n}`, addWhole: '+ הוספת עבודה לכל ההצעה', unnamed: '(ללא שם)',
    helpProduct: 'פתחו את הרשימה והתחילו להקליד שם מוצר כדי לאתר אותו. המוצרים מסודרים לפי א׳–ב׳. ״הוספת מוצר חדש״ נמצאת בראש הרשימה.',
    helpPricing: 'בחרו על מה משלמים: יחידות, שטח, אורך, זמן, משקל או מחיר לכל העבודה.',
    helpQty: 'הקלידו כמות גדולה מאפס. לדוגמה: 2 יחידות.', helpPrice: 'מחיר עבור דרך החישוב שבחרתם. ריק = טרם תומחר; 0 = מחיר אפס.',
    example: 'דוגמה · לא נשמרת',
  },
  en: {
    structL: 'Structure:', simple: 'Simple quote', grouped: 'In sections', tiered: 'Sections within sections',
    sxSimple: 'e.g. Window, painting and installation', sxGrouped: 'e.g. Apartment 1, Apartment 2, Yard', sxTiered: 'e.g. Floor 10 → Apartment 22 → Kitchen',
    help: 'Explain', whole: 'Whole quote', back: 'Back', to: 'To:',
    formTitle: 'Add work or a product', product: 'Product search', pricing: 'Pricing', qty: 'Quantity', price: 'Unit price',
    productPh: 'Choose from the catalog', newProduct: '+ Add a new product', newPh: 'New product name', add: 'Add', clear: 'Clear', more: 'Sizes and details',
    lineSum: 'Line total:', notPriced: 'Not priced yet', saveCatalog: 'Also save to the catalog', savedCatalog: 'The row was added and saved to the catalog too.',
    catalogDup: 'A product with this name is already in the catalog - not saved again. The row was added to the quote.', catalogNoPrice: 'A product without a price is not saved to the catalog. The row was added to the quote.',
    catalogFail: 'Saving to the catalog failed. The row was added to the quote.',
    units: { units: 'Per unit', area: 'Per m²', linear: 'Per m', areaFt: 'Per sq ft', linearFt: 'Per ft', hour: 'Per hour', day: 'Per work day', kg: 'Per kg', fixed: 'Lump sum' },
    unitShort: { units: 'units', area: 'm²', linear: 'm', areaFt: 'sq ft', linearFt: 'ft', hour: 'hours', day: 'days', kg: 'kg', fixed: '' },
    qtyPh: { units: 'Units', area: 'm²', linear: 'Metres', areaFt: 'Sq ft', linearFt: 'Feet', hour: 'Hours', day: 'Work days', kg: 'kg' },
    pricePh: { units: 'Unit price', area: 'Price/m²', linear: 'Price/metre', areaFt: 'Price/sq ft', linearFt: 'Price/foot', hour: 'Price/hour', day: 'Price/day', kg: 'Price/kg', fixed: 'Lump sum price' },
    needName: 'Write what you do or which product you add.', needQty: 'Type a quantity or sizes above zero.', badPrice: 'The price must be zero or more. You can leave it empty for a draft.',
    sizeIncomplete: 'Complete all the sizes or remove an empty one.',
    known: { area: 'The area is known', linear: 'The length is known' }, byMeasures: 'By sizes', measureName: 'Size name (optional)',
    lengthOf: { m: 'Length in metres', ft: 'Length in feet' }, widthOf: { m: 'Width in metres', ft: 'Width in feet' }, removeMeasure: 'Remove the size', addSize: '+ Another size',
    workDetails: 'Work details (optional)', workDetailsPh: 'e.g. colour, model or what the price includes',
    msgAdded: 'The row was added to the quote.', msgUpdated: 'The row was updated.', msgCopied: 'A copy of the work was added.', msgRemoved: 'The row was removed.', msgMoved: 'The row was moved.',
    msgHeadingAdded: 'The section was added. The next work items appear under it.', msgHeadingCopied: 'A copy with all its content was added. You can rename it here.',
    msgHeadingDeleted: 'The section was removed with its content. You can undo.', msgNamesSaved: 'The name was saved.', msgCopiedFirst: 'The works were copied. What was here was kept.',
    undoLast: 'Undo the last action', closeMsg: 'Close message',
    colWork: 'Work / product', colQty: 'Qty', colPrice: 'Price', colSum: 'Total', actions: 'Actions',
    edit: 'Edit', duplicate: 'Duplicate', remove: 'Remove', up: 'Move up', down: 'Move down', moveToMenu: 'Move to another section', moveT: 'Where should the row go?', here: 'here now', cancel: 'Cancel',
    hAddFirst: 'Add a section: apartment, floor, room or other', kindQ: 'What goes into the quote?', kindQIn: (n) => `What goes inside "${n}"?`,
    kinds: { floor: 'Floor', apartment: 'Apartment', room: 'Room', section: 'Other topic' }, kinds1: { floor: 'Floor', apartment: 'Apartment', room: 'Room', section: 'Topic' },
    plural: { floor: 'floors', apartment: 'apartments', room: 'rooms', section: 'topics' },
    countQ: (p) => `How many ${p} to add?`, countHint: (one) => `You type the name or number of each ${one.toLowerCase()} in the next step. You can add just one.`,
    countErr: 'Type a whole number, 1 or more.', countMax: 'You can add up to 100 at a time.',
    namesQ: (k, one) => (k === 'section' ? 'What should each topic be called?' : `What is the name or number of each ${one.toLowerCase()}?`), namesHint: 'An empty field = a name in order.',
    namePh: { floor: 'e.g. Floor 10', apartment: 'e.g. Apartment 33', room: 'e.g. Kids room', section: 'e.g. Yard' }, nameL: 'Name',
    namesDup: 'A section with this name already exists at this level. Give each one a different name.', toNames: 'Continue', hCreate: 'Add to the quote', closeNoSave: 'Back without saving',
    hActs: (n) => `Actions for ${n}`, addHere: 'Add work or a product here', hInside: 'Add a section inside', hRename: 'Rename', hDup: 'Duplicate with its content',
    hCopyFirst: 'Copy the works from the first', hTmpl: 'Save as a template', hDel: 'Remove with its content', saveName: 'Save the name', needHName: 'Type a name.',
    hOpen: 'Open', hClose: 'Close', addHereL: (n) => `Add work or a product to ${n}`, addWhole: '+ Add work to the whole quote', unnamed: '(unnamed)',
    helpProduct: 'Open the list and start typing a product name to find it. Products are sorted A–Z. "Add a new product" is at the top of the list.',
    helpPricing: 'Choose what is paid for: units, area, length, time, weight or one price for the whole job.',
    helpQty: 'Type a quantity above zero. For example: 2 units.', helpPrice: 'The price for the pricing you chose. Empty = not priced yet; 0 = a zero price.',
    example: 'Example · not saved',
  },
};
const METHODS = ['units', 'area', 'linear', 'hour', 'day', 'kg', 'fixed'];
// Owner 2026-11-05 (feet for the international market, metres stay available): an international account measures area / length in feet
// ("area" / "linear") and may still choose metres ("area_m" / "linear_m"); a local account measures in metres only
const METHODS_INTL = ['units', 'area', 'linear', 'area_m', 'linear_m', 'hour', 'day', 'kg', 'fixed'];
const COUNTED = ['units', 'hour', 'day', 'kg'];
const baseMethod = (m) => (m === 'area_m' ? 'area' : m === 'linear_m' ? 'linear' : m);
const isFeetMethod = (m, international) => Boolean(international) && (m === 'area' || m === 'linear');
/** the copy key of a method in its market: the feet keys for an international area / length, the metric keys otherwise */
const copyKey = (m, international) => (isFeetMethod(m, international) ? `${m}Ft` : baseMethod(m));
const methodOfBasis = (basis, international) => ({ unit: 'units', m2: international ? 'area_m' : 'area', sq_ft: 'area', linear_meter: international ? 'linear_m' : 'linear', linear_ft: 'linear', hour: 'hour', day: 'day', kg: 'kg', fixed: 'fixed' }[basis]);
const keyOf = (s) => s && (s.key ?? s.id);
const N = (v) => <bdi dir="ltr" className="pf-num">{v}</bdi>;
/** Enter in a text field of the work area never submits the quote form around it */
const enterInField = (e) => e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox';
const sizeOf = (m) => ({ size: m, strokeWidth: 2, 'aria-hidden': true });

/** the help circle of the client step / the extras (a popover); kept as it was - ServiceScheduleFields and QuoteForm import it */
export function HelpCircle({ text, label, inline = false, testId = 'qt-help' }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || focus || pinned;
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeAll = () => { setHover(false); setFocus(false); setPinned(false); };
    const out = (e) => { if (ref.current && !ref.current.contains(e.target)) closeAll(); };
    const esc = (e) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [open]);
  const toggle = () => { if (pinned) { setPinned(false); setHover(false); setFocus(false); } else setPinned(true); };
  const popRef = useRef(null);
  const [below, setBelow] = useState(false);
  useLayoutEffect(() => {
    if (!open) { setBelow(false); return; }
    const p = popRef.current; if (!p || typeof p.getBoundingClientRect !== 'function') return;
    const bar = document.querySelector('.dash-topbar'); const barBottom = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect().bottom : 0;
    if (!below && p.getBoundingClientRect().top < Math.max(0, barBottom) + 4) setBelow(true);
  }, [open, below]);
  return (
    <span ref={ref} className={inline ? 'qt-help-wrap' : undefined} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* PRODUCT_TRUTH_DECORATIVE: the help circle of a field - explains it, never changes it */}
      <span role="button" tabIndex={0} className={inline ? 'qt-help qt-help--inline' : 'qt-help'} aria-label={label} aria-expanded={open} data-testid={testId}
        onClick={(e) => { e.stopPropagation(); toggle(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(); } }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}><span aria-hidden="true">?</span></span>
      {open && <span ref={popRef} role="tooltip" className={below ? 'qt-pop qt-pop--below' : 'qt-pop'} data-testid="qt-help-pop">{text}</span>}
    </span>
  );
}

/** the sketch's "?" beside a column title / a field label: it opens one explanation box under the entry row (helpBtn / helpBox) */
function HelpDot({ k, label, t, help, setHelp }) {
  return (
    // PRODUCT_TRUTH_DECORATIVE: opens / closes the explanation of a column of the entry row
    <button type="button" className="qt-q" aria-label={`${t.help}: ${label}`} aria-expanded={help === k} data-testid={`qt-help-${k}`}
      onClick={(e) => { e.stopPropagation(); setHelp(help === k ? null : k); }}>?</button>
  );
}

/** a small menu (the sketch's .menu): one open at a time; it opens under its button (or above it near the bottom of the window) and closes on a
 *  click outside or Escape (the focus goes back to its button) */
function MenuList({ items, up, className = '', label }) {
  return (
    <div className={`qt-menu${up ? ' qt-menu--up' : ''} ${className}`.trim()} role="menu" aria-label={label}>
      {/* PRODUCT_TRUTH_DECORATIVE: one item of a row / section menu of the work area - each item runs the editor action named on it */}
      {items.filter(Boolean).map((it, i) => (it === '-' ? <hr key={`s${i}`} /> : (
        <button key={it.key || i} type="button" role={it.role || 'menuitem'} aria-checked={it.checked} className={it.cls || (it.danger ? 'qt-menu-del' : undefined)}
          data-testid={it.testId} disabled={it.disabled} title={it.title} onClick={it.onClick}>{it.icon}<span className="qt-menu-label">{it.label}</span>{it.why && <span className="qt-menu-why">{it.why}</span>}</button>
      )))}
    </div>
  );
}

function CatalogField({ id, value, onText, onPick, onNew, services, t, isHebrew, sym, fmtMoney, inputRef, international = false, placeholder }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const wrap = useRef(null);
  const all = useMemo(() => sortServices(services, isHebrew), [services, isHebrew]);
  const q = typed ? String(value || '').trim().toLowerCase() : '';
  const list = q ? all.filter((s) => String(s.name || '').toLowerCase().includes(q)) : all;
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', out);
    return () => document.removeEventListener('pointerdown', out);
  }, [open]);
  return (
    <div ref={wrap} className="qt-catalog">
      {/* PRODUCT_TRUTH_DECORATIVE: the product search field - typing or a click opens the catalog list; nothing is added until Add */}
      <input ref={inputRef} id={id} className="qt-input" value={value} placeholder={placeholder || t.productPh} autoComplete="off" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-label={t.product}
        onFocus={() => setTyped(false)} onClick={() => setOpen(true)} onChange={(e) => { onText(e.target.value); setTyped(true); setOpen(true); }}
        onBlur={(e) => { const to = e.relatedTarget; if (to && wrap.current && !wrap.current.contains(to)) setOpen(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Tab') setOpen(false); if (e.key === 'ArrowDown') setOpen(true); }} />
      <span className="qt-catalog-arrow" aria-hidden="true"><ChevronDown {...sizeOf(15)} /></span>
      {open && (
        <ul id={`${id}-list`} role="listbox" className="qt-catalog-list" data-testid="qt-catalog-list">
          <li role="option" aria-selected="false">{/* PRODUCT_TRUTH_DECORATIVE: a new product - the catalog is not changed until "also save to the catalog" and Add */}<button type="button" className="qt-catalog-new" onClick={() => { setOpen(false); onNew(); }}>{t.newProduct}</button></li>
          {list.map((s) => (
            <li key={s.id} role="option" aria-selected="false">
              {/* PRODUCT_TRUTH_DECORATIVE: picks a catalog product into the entry row (name, price, pricing) - nothing is added until Add */}
              <button type="button" onClick={() => { setOpen(false); onPick(s); }}>
                <span>{s.name}</span>{s.price != null && s.price !== '' && <span className="qt-catalog-price"><span className="pf-money">{sym}{fmtMoney(Number(s.price))}</span> {t.units[copyKey(methodOfBasis(s.price_basis, international) || 'units', international)]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const emptyForm = (method = 'units') => ({ name: '', method, qty: '', price: '', catalogId: null, known: true, sizes: [{ name: '', w: '', h: '' }], details: '', more: false, toCatalog: false, isNew: false });

/** the entry row filled from a row (edit): the row's own entry (rowEntry: the same reading as the row editor) */
function formFromItem(item, international) {
  const e = rowEntry(item, international);
  let method = e.pricingMethod;
  if (international && (method === 'area' || method === 'linear') && e.measureUnit === 'm') method = method === 'area' ? 'area_m' : 'linear_m';
  const meas = Array.isArray(item.measurements) ? item.measurements : [];
  const sizes = [{ w: e.widthCm, h: e.heightCm, name: meas[0]?.label || '' }, ...(e.extraMeasureRows || []).map((r, i) => ({ w: r.widthCm, h: r.heightCm, name: r.label || meas[i + 1]?.label || '' }))]
    .filter((z) => String(z.w ?? '').trim() !== '').map((z) => ({ name: String(z.name || ''), w: String(z.w ?? ''), h: String(z.h ?? '') }));
  const measured = baseMethod(method) === 'area' || baseMethod(method) === 'linear';
  const known = !measured || Boolean(e.useManualQty) || !sizes.length;
  const qty = measured ? (e.useManualQty ? e.manualQty : '') : (method === 'fixed' ? '' : e.quantity);
  const details = (e.specRows || []).map((r) => (r.label && r.value ? `${r.label}: ${r.value}` : (r.value || r.label || ''))).filter(Boolean).join('\n');
  return { ...emptyForm(method), name: String(e.description || ''), qty: String(qty ?? ''), price: e.unitPrice == null ? '' : String(e.unitPrice), known,
    sizes: sizes.length ? sizes : [{ name: '', w: '', h: '' }], details, more: Boolean(details) || (measured && !known) };
}

/** what the entry row holds now (the values the user typed, computed) */
function formNumbers(f, international) {
  const base = baseMethod(f.method);
  const measured = base === 'area' || base === 'linear';
  const fullSize = (z) => String(z.w).trim() && (base === 'linear' || String(z.h).trim());
  const sizes = measured && !f.known ? f.sizes.filter(fullSize) : [];
  const qp = parseQuantityInput(String(f.qty));
  const qtyNum = qp.ok ? qp.value : NaN;
  const pp = parsePriceInput(String(f.price));
  const priceNum = pp.ok && pp.value !== '' ? Number(pp.value) : null; // '' = an empty price (missing), never 0
  const sizeQty = sizes.length ? sizes.reduce((n, z) => n + (base === 'area' ? (Number(z.w) || 0) * (Number(z.h) || 0) : (Number(z.w) || 0)), 0) : null;
  const effQty = f.method === 'fixed' ? 1 : (measured && !f.known ? sizeQty : qtyNum);
  const lineSum = priceNum != null && Number.isFinite(priceNum) && Number.isFinite(effQty) && effQty > 0 ? effQty * priceNum : (f.method === 'fixed' && priceNum != null ? priceNum : null);
  return { base, measured, fullSize, sizes, qtyNum, pp, priceNum, sizeQty, effQty, lineSum, measureUnit: isFeetMethod(f.method, international) ? 'ft' : 'm' };
}

export default function QuoteTreeEditor({
  isHebrew, international, items, setItems, sections, setSections, services, sym, fmtMoney, structure, onStructure,
  onBackToClient = null, // eslint-disable-line no-unused-vars -- 2026-11-20: the editor bar's arrow goes back to the client (QuoteForm)
  onSaveToCatalog, onCatalogItemAdded, recommendedMethod, bottomBar, onSaveHeadingTemplate = null,
  onAddFromTemplate = null, // eslint-disable-line no-unused-vars -- 2026-11-20: "מתבנית שמורה" is in the editor bar's "⋯" menu (QuoteForm)
  onShowExample = null, // eslint-disable-line no-unused-vars -- 2026-11-20: "הצגת דוגמה" is in the editor bar's "⋯" menu (QuoteForm)
  canDuplicateRow = null, onDuplicateLocked = null, keyStore = null, onPendingChange = null, onPageChange = null, canUseMeasured = true, onMeasuredLocked = null,
  lineExtra = null, // the VAT chip of the editor line (QuoteForm decides it by the market)
  renderRowEditor = null, // eslint-disable-line no-unused-vars -- kept in the props for older callers
}) {
  const t = T[isHebrew ? 'he' : 'en'];
  const methods = international ? METHODS_INTL : METHODS;
  const simple = structure === 'simple';
  const allowNest = structure === 'tiered';
  const [target, setTarget] = useState(null); // the section the entry row adds to (null = the whole quote)
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [addPanel, setAddPanel] = useState(null); // { parent, step, kind, count, names, err }
  const [renaming, setRenaming] = useState(null); // { key, value }
  const [help, setHelp] = useState(null);
  const [moveSheet, setMoveSheet] = useState(null); // the row index to move
  const [menu, setMenu] = useState(null); // { type, id, up, btn }
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const out = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null); };
    const esc = (e) => { if (e.key === 'Escape') { const b = menu.btn; setMenu(null); b?.focus?.(); } };
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [menu]);
  const isMenu = (type, id) => Boolean(menu) && menu.type === type && menu.id === id;
  const toggleMenu = (type, id) => (e) => {
    const b = e.currentTarget; const r = b.getBoundingClientRect();
    const up = typeof window !== 'undefined' && window.innerHeight - r.bottom < 340 && r.top > 340;
    setMenu((m) => (m && m.type === type && m.id === id ? null : { type, id, up, btn: b }));
  };
  const wrapRef = (type, id) => (isMenu(type, id) ? menuRef : undefined);
  const run = (fn) => () => { setMenu(null); fn(); };
  const rootRef = useRef(null);
  // the row being edited is followed by its row key (the shared key store), never by its place in the list
  const ownStore = useRef({ map: new WeakMap(), seq: 0, focus: null });
  const store = keyStore || ownStore.current;
  const rowKey = (it) => { if (!store.map.has(it)) store.map.set(it, it.id || `r${(store.seq += 1)}`); return store.map.get(it); };
  const [editing, setEditing] = useState(null); // { rowKey }
  const editIndex = editing ? (items || []).findIndex((it) => it && store.map.get(it) === editing.rowKey) : -1;
  const editItem = editIndex >= 0 ? items[editIndex] : null;
  // the edited row is gone (removed, undone) -> its values leave the entry row too
  useEffect(() => { if (editing && editIndex < 0) { setEditing(null); setF((p) => emptyForm(p.method)); } }, [editing, editIndex]);
  // the ONE entry row of the quote (it moves with the chosen section and keeps what was typed)
  const [f, setF] = useState(() => emptyForm(methods.includes(recommendedMethod) ? recommendedMethod : 'units'));
  const [formErr, setFormErr] = useState('');
  const set = (patch) => { setF((p) => ({ ...p, ...patch })); setFormErr(''); };
  const nameRef = useRef(null);
  const qtyRef = useRef(null);
  const nums = formNumbers(f, international);
  const ck = copyKey(f.method, international);
  // the sketch's toast: the message of the last change with "ביטול הפעולה האחרונה" (6 s, 3.2 s without undo) and a close button
  const [status, setStatus] = useState(null); // { text, restore?, error? }
  const [statusSlot, setStatusSlot] = useState(null);
  useEffect(() => { setStatusSlot(document.querySelector('[data-testid="qt-status-slot"]')); }, []);
  useEffect(() => { if (!status) return undefined; const id = setTimeout(() => setStatus(null), status.restore ? 6000 : 3200); return () => clearTimeout(id); }, [status]);
  const done = (text) => { const before = { items, sections }; setStatus({ text, restore: () => { setSections(before.sections); setItems(before.items); } }); };
  // the undo of the last change holds only while nothing else changed since (a later move, template, AI line or example is never wiped)
  useEffect(() => {
    if (!status || !status.restore) return;
    if (!status.after) { setStatus((u) => (u && u.restore && !u.after ? { ...u, after: { items, sections } } : u)); return; }
    if (status.after.items !== items || status.after.sections !== sections) setStatus((u) => (u ? { ...u, restore: null } : u));
  }, [items, sections, status]);
  useEffect(() => { if (typeof onPageChange === 'function') onPageChange(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a row typed and not added yet (or an edit) blocks the save / the client view / the details (QuoteForm), with its own sentence
  useEffect(() => { if (target && !sections.some((x) => keyOf(x) === target)) setTarget(null); }, [sections, target]);
  const liveTarget = target && sections.some((x) => keyOf(x) === target) ? target : null;
  const pathNamesOf = (key) => pathOf(sections, key).map((s) => s.name);
  // every name keeps its place in the UI direction (a direction mark on both sides of the arrow - a Latin name never swaps the order)
  const pathSep = isHebrew ? '\u200F ← \u200F' : '\u200E → \u200E';
  const toText = liveTarget && !simple ? pathNamesOf(liveTarget).join(pathSep) : t.whole;
  const dirty = Boolean(editItem) || Boolean(String(f.name).trim() || String(f.price).trim() || String(f.details).trim() || (f.method !== 'fixed' && String(f.qty).trim())
    || (nums.measured && !f.known && f.sizes.some((z) => String(z.w).trim() || String(z.h).trim() || String(z.name).trim())));
  useEffect(() => { if (typeof onPendingChange === 'function') onPendingChange(dirty ? [toText] : []); }, [dirty, toText]); // eslint-disable-line react-hooks/exhaustive-deps

  // the money axis: the sum column is as wide as the widest amount shown (never cut), at least the sketch's width
  const moneyTexts = useMemo(() => {
    const out = (items || []).filter(Boolean).flatMap((it) => [`${sym}${fmtMoney(lineTotal(it))}`, `${sym}${fmtMoney(Number(it.unit_price) || 0)}`]);
    (sections || []).forEach((s) => out.push(`${sym}${fmtMoney(headingTotal(items, sections, keyOf(s)))}`));
    return out;
  }, [items, sections, sym, fmtMoney]);
  useMoneySlotSize(rootRef, moneyTexts, { fontSize: '13.5px', fontWeight: '600' });

  const tops = topHeadings(sections);
  const expand = (key) => setCollapsed((prev) => { const n = new Set(prev); pathOf(sections, key).forEach((x) => n.delete(keyOf(x))); return n; });
  // the entry row is brought into view inside the editor's own scroll body only (scrollIntoView would also move the app shell and its header)
  const scrollToForm = () => setTimeout(() => {
    const el = rootRef.current?.querySelector('.qt-er'); if (!el || typeof window === 'undefined') return;
    let sc = el.parentElement;
    while (sc && sc !== document.body) { const oy = getComputedStyle(sc).overflowY; if ((oy === 'auto' || oy === 'scroll') && sc.scrollHeight > sc.clientHeight + 1) break; sc = sc.parentElement; }
    if (!sc || sc === document.body) return;
    const box = sc.getBoundingClientRect(); const r = el.getBoundingClientRect();
    const bar = 90; // the bar at the bottom of the work area
    if (r.top < box.top + 8) sc.scrollTop -= box.top + 8 - r.top;
    else if (r.bottom > box.bottom - bar) sc.scrollTop += r.bottom - (box.bottom - bar);
  }, 30);
  const chooseTarget = (key) => { setTarget(key || null); if (key) expand(key); scrollToForm(); };

  // a new row is appended at the end of its place; its catalog extras (an image) follow it
  const placeOf = (it) => (it && it.section_key && sections.some((s) => keyOf(s) === it.section_key) ? it.section_key : null);
  const insertAtEndOf = (list, place, row) => { let at = -1; list.forEach((it, i) => { if (placeOf(it) === place) at = i; }); return at < 0 ? [...list, row] : [...list.slice(0, at + 1), row, ...list.slice(at + 1)]; };
  const removeRow = (index) => { done(t.msgRemoved); setItems((prev) => prev.filter((_, i) => i !== index)); };
  // a professional row without the reuse entitlement is never copied - the upgrade window opens instead
  const locked = (list) => typeof canDuplicateRow === 'function' && list.some((it) => it && !canDuplicateRow(it));
  const duplicateRow = (index) => {
    if (locked([items[index]])) { onDuplicateLocked?.(); return; }
    done(t.msgCopied);
    setItems((prev) => { const c = { ...prev[index] }; delete c.id; delete c.price_link_id; return [...prev.slice(0, index + 1), c, ...prev.slice(index + 1)]; });
  };
  // up / down inside its own place (the sketch's grpOf)
  const placeRows = (index) => { if (simple) return flatRows(); const p = placeOf(items[index]); return (items || []).map((it, i) => i).filter((i) => !isUntouchedPlaceholderItem(items[i]) && placeOf(items[i]) === p); };
  const moveRow = (index, dir) => {
    const g = placeRows(index); const at = g.indexOf(index); const j = g[at + dir];
    if (j == null) return;
    setItems((prev) => { const next = prev.slice(); [next[index], next[j]] = [next[j], next[index]]; return next; });
  };
  const moveRowTo = (index, place) => {
    done(t.msgMoved);
    setItems((prev) => { const row = { ...prev[index], section_key: place || null }; const rest = prev.filter((_, i) => i !== index); return insertAtEndOf(rest, place || null, row); });
    setMoveSheet(null);
  };
  // edit: the row's values go into the entry row of its place (the sketch's rEdit); "הוספה" puts the row back changed
  const startEdit = (it) => {
    if (dirty && !editItem) { setStatus({ text: isHebrew ? 'השורה עדיין לא נוספה. לחצו ״הוספה״ או ״ניקוי השורה״ לפני המעבר.' : 'The row was not added yet. Click "Add" or "Clear" before moving on.', error: true }); return; }
    const place = placeOf(it);
    if (!simple) { setTarget(place); if (place) expand(place); }
    setEditing({ rowKey: rowKey(it) }); setF(formFromItem(it, international)); setFormErr(''); scrollToForm();
  };
  const clearForm = () => { setEditing(null); setF(emptyForm(f.method)); setFormErr(''); };

  const askBasisChange = () => askConfirm(isHebrew ? 'אופן החיוב ישתנה. בדקו את הכמות והזינו מחיר לבסיס החדש.' : 'The billing method will change. Review the quantity and enter a price for the new unit.', isHebrew,
    { yes: isHebrew ? 'שינוי אופן חיוב' : 'Change billing method', no: isHebrew ? 'שמירת אופן החיוב הקיים' : 'Keep current billing method' });
  const changeMethod = async (m) => {
    if (m === f.method) return;
    const mb = baseMethod(m);
    if ((mb === 'area' || mb === 'linear') && canUseMeasured === false) { onMeasuredLocked?.(); return; }
    if (editItem && (editItem.id || editItem.price_link_id || String(f.price).trim()) && !(await askBasisChange())) return;
    set({ method: m, qty: '', price: '', known: true, sizes: [{ name: '', w: '', h: '' }] });
  };
  const pick = (s) => {
    const m = methodOfBasis(s.price_basis, international) || 'units';
    const mb = baseMethod(m);
    if ((mb === 'area' || mb === 'linear') && canUseMeasured === false) { onMeasuredLocked?.(); return; }
    set({ name: String(s.name || ''), catalogId: String(s.id), price: s.price == null ? '' : String(s.price), method: m, qty: '', known: true, sizes: [{ name: '', w: '', h: '' }], isNew: false, toCatalog: false });
    setTimeout(() => qtyRef.current?.focus({ preventScroll: true }), 0);
  };
  const submit = async () => {
    const name = String(f.name).trim();
    const { base, measured, fullSize, sizes, qtyNum, pp, priceNum, effQty, measureUnit } = nums;
    const anySize = (z) => String(z.w).trim() || String(z.h).trim();
    if (!name) { setFormErr(t.needName); nameRef.current?.focus(); return; }
    if (measured && !f.known && f.sizes.some((z) => anySize(z) && !fullSize(z))) { setFormErr(t.sizeIncomplete); return; }
    if (f.method !== 'fixed' && !(effQty > 0)) { setFormErr(t.needQty); return; }
    if (!pp.ok || (priceNum != null && priceNum < 0)) { setFormErr(t.badPrice); return; }
    const text = String(f.details).trim();
    const original = editItem ? formFromItem(editItem, international) : null;
    const specRows = text ? (original && original.details === f.details && Array.isArray(editItem.specification) ? editItem.specification.map((r) => ({ label: r.label || '', value: r.value || '' })) : [{ label: '', value: text }]) : [];
    const place = simple ? null : liveTarget;
    const entry = {
      pricingMethod: base, description: name, unitPrice: priceNum == null ? '' : String(priceNum), catalogServiceId: f.catalogId, sectionKey: editItem ? (editItem.section_key ?? null) : (place || null),
      quantity: COUNTED.includes(f.method) ? String(qtyNum) : '1', measureUnit,
      useManualQty: measured && f.known, manualQty: measured && f.known ? String(qtyNum) : '',
      widthCm: sizes[0]?.w ?? '', heightCm: base === 'linear' ? '1' : (sizes[0]?.h ?? ''),
      extraMeasureRows: sizes.slice(1).map((z) => ({ widthCm: z.w, heightCm: base === 'linear' ? '1' : z.h, label: z.name || '' })),
      specRows,
    };
    if (editItem) {
      // the row editor's commit rules: the same row, its id, its shared-price link, its review mark
      const now = rowEntry(editItem, international);
      const conversionConfirmed = entry.pricingMethod !== now.pricingMethod || Boolean(entry.useManualQty) !== Boolean(now.useManualQty);
      const built = buildQuoteItemFromEntry({ ...entry, editingItem: editItem, isEditMode: true, conversionConfirmed });
      if (!conversionConfirmed && isCountedMethod(f.method) && String(qtyNum) === String(now.quantity) && editItem.quantity !== undefined) built.quantity = editItem.quantity;
      if (f.method === 'fixed' || f.method === 'units') built._billing = f.method;
      if (editItem.price_link_id && entry.pricingMethod === now.pricingMethod && (built.pricing_unit || null) === (editItem.pricing_unit || null)) built.price_link_id = editItem.price_link_id;
      if (editItem._review) built._review = true;
      if (editItem._noUnit && entry.pricingMethod === now.pricingMethod) built._noUnit = true;
      if (Array.isArray(built.measurements) && built.measurements[0] && sizes[0]) built.measurements[0] = { ...built.measurements[0], label: sizes[0].name || '' };
      if (!simple) built.section_key = liveTarget || null;
      const rk = editing.rowKey;
      done(t.msgUpdated);
      setItems((prev) => { const j = prev.findIndex((x) => x && store.map.get(x) === rk); if (j < 0) return prev; const next = prev.slice(); next[j] = built; store.map.set(built, rk); return next; });
      setEditing(null); setF(emptyForm(f.method));
      return;
    }
    const item = { ...buildQuoteItemFromEntry(entry), ...(f.method === 'fixed' || f.method === 'units' ? { _billing: f.method } : {}) };
    if (Array.isArray(item.measurements) && item.measurements[0] && sizes[0]) item.measurements[0] = { ...item.measurements[0], label: sizes[0].name || '' };
    const before = { items, sections };
    const restore = () => { setSections(before.sections); setItems(before.items); };
    setStatus({ text: t.msgAdded, restore });
    setItems((prev) => insertAtEndOf((prev || []).filter((it) => !(it && it.description === '' && (it.unit_price === '' || it.unit_price == null) && !it.id && !it.pricing_unit)), place, item));
    if (f.catalogId && typeof onCatalogItemAdded === 'function') onCatalogItemAdded(f.catalogId, item);
    const toCatalog = f.toCatalog && f.isNew && typeof onSaveToCatalog === 'function';
    // the entry row is ready for the next row at once (a second click never adds the same row twice); the catalog answer comes after
    setF(emptyForm(f.method));
    scrollToForm();
    if (!toCatalog) return;
    if (priceNum == null) { setStatus((u) => ({ text: t.catalogNoPrice, restore: u && u.restore ? u.restore : null, after: u && u.after })); return; }
    let note;
    try {
      const r = await onSaveToCatalog({ name, price: priceNum, method: base, international: isFeetMethod(f.method, international) });
      note = r && r.ok ? t.savedCatalog : (r && r.duplicate ? t.catalogDup : t.catalogFail);
    } catch { note = t.catalogFail; }
    setStatus((u) => ({ text: note, restore: u && u.restore ? u.restore : null, after: u && u.after }));
  };

  const createHeadings = () => {
    const a = addPanel; const pk = a.parent ?? null;
    const { sections: next, added } = addHeadings(sections, { kind: a.kind, names: a.names, parentKey: pk }, isHebrew);
    done(t.msgHeadingAdded);
    setSections(next);
    setAddPanel(null);
    if (simple) onStructure(pk ? 'tiered' : 'grouped');
    if (added[0]) setTimeout(() => { setTarget(added[0]); setCollapsed((prev) => { const n = new Set(prev); pathOf(next, added[0]).forEach((x) => n.delete(keyOf(x))); return n; }); }, 0);
  };
  const addNext = () => {
    const a = addPanel;
    if (a.step === 'count') {
      const n = Number(String(a.count).trim());
      if (!/^\d+$/.test(String(a.count).trim()) || n < 1) { setAddPanel({ ...a, err: t.countErr }); return; }
      if (n > 100) { setAddPanel({ ...a, err: t.countMax }); return; }
      setAddPanel({ ...a, names: Array.from({ length: n }, (_, k) => a.names[k] || ''), step: 'names', err: '' });
      return;
    }
    const sib = childrenOf(sections, a.parent ?? null).map((s) => String(s.name || '').trim().toLowerCase());
    const typed = a.names.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
    if (new Set([...sib, ...typed]).size !== sib.length + typed.length) { setAddPanel({ ...a, err: t.namesDup }); return; }
    createHeadings();
  };

  // the untouched starter line of a new quote is never shown as a row (nothing typed yet - the entry row is where work starts)
  const rowsOf = (key) => itemIndicesOf(items, sections, key).filter((i) => !isUntouchedPlaceholderItem(items[i]));
  // the simple structure lists every row in one table, in the order of the tree (root rows, then each section's rows)
  const flatRows = () => { const out = [...rowsOf(null)]; const walk = (k) => childrenOf(sections, k).forEach((s) => { out.push(...rowsOf(keyOf(s))); walk(keyOf(s)); }); walk(null); return out; };
  const treeOrder = () => { const out = []; const w = (p, d) => childrenOf(sections, p).forEach((s) => { out.push({ key: keyOf(s), name: s.name, d }); w(keyOf(s), d + 1); }); w(null, 0); return out; };

  const money = (v) => <span className="pf-money">{sym}{fmtMoney(v)}</span>;
  const unitShortOf = (it) => {
    if (it.pricing_unit && !['unit', 'fixed'].includes(it.pricing_unit)) return getProfessionalUnitLabel(it.pricing_unit, isHebrew);
    const q = Number(it.quantity);
    return !isHebrew && q === 1 ? 'unit' : t.unitShort.units;
  };
  const methodLabelOf = (it) => { const e = rowEntry(it, international); let m = e.pricingMethod; if (international && (m === 'area' || m === 'linear') && e.measureUnit === 'm') m = `${m}_m`; return t.units[copyKey(m, international)] || ''; };

  // ---------- one row ----------
  const rowLine = (i) => {
    const it = items[i];
    const rk = rowKey(it); const open = isMenu('row', rk);
    const priceMissing = it.unit_price === '' || it.unit_price == null;
    const fixed = it._billing === 'fixed' && !it.pricing_unit;
    const qtyText = it.pricing_unit && !['unit', 'fixed'].includes(it.pricing_unit) ? formatQuantity(Number(it.calculated_quantity ?? it.quantity), it.pricing_unit) : String(it.quantity || '');
    const details = Array.isArray(it.specification) && it.specification.length ? it.specification.map((d) => (d.label && d.value ? `${d.label}: ${d.value}` : (d.value || d.label || ''))).filter(Boolean).join(' · ') : '';
    const g = placeRows(i); const pos = g.indexOf(i);
    const isEdited = editIndex === i;
    return (
      <div key={rk} className={`qt-ir${isEdited ? ' qt-ir--edit' : ''}`} data-testid="qt-row">
        <span className="qt-ir-name">
          {it._localExample && <span className="qt-example" data-testid="quote-example-badge">{t.example}</span>}
          {/* PRODUCT_TRUTH_DECORATIVE: the row name - a click puts the row into the entry row for editing (as "עריכה") */}
          <button type="button" className="qt-row-name" onClick={() => startEdit(it)}><EllipsisText className="qt-row-name-box" text={details ? `${it.description} · ${details}` : it.description} /></button>
          <span className="qt-ir-sub">{fixed ? null : <>{N(qtyText)} {unitShortOf(it)} × </>}{priceMissing ? <span className="qt-missing">{t.notPriced}</span> : money(Number(it.unit_price))}</span>
        </span>
        <span className="qt-ir-u">{methodLabelOf(it)}</span>
        <span className="qt-ir-q">{fixed ? '—' : N(qtyText)}</span>
        <span className="qt-ir-p">{priceMissing ? <span className="qt-missing">{t.notPriced}</span> : money(Number(it.unit_price))}</span>
        <span className="qt-ir-s">{priceMissing ? <span className="qt-missing">{t.notPriced}</span> : money(lineTotal(it))}</span>
        <span className="qt-menu-wrap" ref={wrapRef('row', rk)}>
          {/* PRODUCT_TRUTH_DECORATIVE: the one actions menu of a row */}
          <button type="button" className="qt-ib" aria-haspopup="menu" aria-expanded={open} aria-label={t.actions} data-testid="qt-row-actions" onClick={toggleMenu('row', rk)}><SketchIcon name="dots" size={17} /></button>
          {open && <MenuList up={menu.up} label={t.actions} items={[
            { label: t.edit, icon: <SketchIcon name="pen" size={16} />, onClick: run(() => startEdit(it)), testId: 'qt-row-edit' },
            { label: t.duplicate, icon: <SketchIcon name="copy" size={16} />, onClick: run(() => duplicateRow(i)), testId: 'qt-row-duplicate' },
            { label: t.up, icon: <SketchIcon name="up" size={16} />, onClick: run(() => moveRow(i, -1)), disabled: pos <= 0, testId: 'qt-row-up' },
            { label: t.down, icon: <SketchIcon name="down" size={16} />, onClick: run(() => moveRow(i, 1)), disabled: pos < 0 || pos >= g.length - 1, testId: 'qt-row-down' },
            !simple && sections.length ? { label: t.moveToMenu, icon: <SketchIcon name="back" size={16} />, onClick: run(() => setMoveSheet(i)), testId: 'qt-row-move' } : null,
            '-',
            { label: t.remove, icon: <SketchIcon name="trash" size={16} />, onClick: run(() => removeRow(i)), danger: true, testId: 'qt-row-remove' },
          ]} />}
        </span>
      </div>
    );
  };

  // ---------- the entry row (formHtml) ----------
  const helpBox = ['product', 'pricing', 'qty', 'price'].includes(help) ? <div className="qt-helpbox" role="note">{t[`help${help.charAt(0).toUpperCase()}${help.slice(1)}`]}</div> : null;
  const typedNew = String(f.name).trim() && (f.isNew || !services.some((s) => String(s.name || '').trim().toLowerCase() === String(f.name).trim().toLowerCase()))
    && !services.some((s) => String(s.name || '').trim().toLowerCase() === String(f.name).trim().toLowerCase());
  const lineSumNode = <b className={`qt-lsum${nums.lineSum == null ? '' : ' qt-lsum--set'}`}>{nums.lineSum == null ? t.notPriced : <span className="pf-money">{sym}{fmtMoney(nums.lineSum)}</span>}</b>;
  const qtyDisabled = f.method === 'fixed' || (nums.measured && !f.known);
  const entryRow = () => (
    <>
      <div className="qt-er" role="group" aria-label={t.formTitle} data-testid={editItem ? 'qt-edit-form' : 'qt-form'} data-target={(simple ? null : target) || 'root'}>
        <div className="qt-er-pn">
          <label htmlFor="qt-f-name" className="qt-ml">{t.product}<HelpDot k="product" label={t.product} t={t} help={help} setHelp={setHelp} /></label>
          <CatalogField id="qt-f-name" inputRef={nameRef} value={f.name} services={services} t={t} isHebrew={isHebrew} sym={sym} fmtMoney={fmtMoney} international={international}
            placeholder={f.isNew && !f.name ? t.newPh : t.productPh}
            onText={(v) => set({ name: v, catalogId: null, isNew: true })} onPick={pick} onNew={() => { set({ name: '', catalogId: null, isNew: true, toCatalog: true, qty: '', price: '' }); setTimeout(() => nameRef.current?.focus(), 0); }} />
        </div>
        <div className="qt-er-pu">
          <label htmlFor="qt-f-unit" className="qt-ml">{t.pricing}<HelpDot k="pricing" label={t.pricing} t={t} help={help} setHelp={setHelp} /></label>
          <select id="qt-f-unit" className="qt-select" aria-label={t.pricing} value={f.method} onChange={(e) => changeMethod(e.target.value)}>
            {methods.map((mm) => <option key={mm} value={mm}>{t.units[copyKey(mm, international)]}</option>)}
          </select>
        </div>
        <div className="qt-er-pq">
          <label htmlFor="qt-f-qty" className="qt-ml">{t.qty}<HelpDot k="qty" label={t.qty} t={t} help={help} setHelp={setHelp} /></label>
          <input ref={qtyRef} id="qt-f-qty" className="qt-input pf-num" inputMode="decimal" dir="ltr" aria-label={t.qty} disabled={qtyDisabled}
            value={qtyDisabled && nums.measured && !f.known ? (nums.sizeQty ? String(Math.round(nums.sizeQty * 100) / 100) : '') : (f.method === 'fixed' ? '' : f.qty)}
            placeholder={f.method === 'fixed' ? '1' : t.qtyPh[ck]} onChange={(e) => set({ qty: e.target.value })} />
        </div>
        <div className="qt-er-pp">
          <label htmlFor="qt-f-price" className="qt-ml">{t.price}<HelpDot k="price" label={t.price} t={t} help={help} setHelp={setHelp} /></label>
          <input id="qt-f-price" className="qt-input pf-num" inputMode="decimal" dir="ltr" aria-label={t.price} value={f.price} placeholder={t.pricePh[ck]} onChange={(e) => set({ price: e.target.value })} />
        </div>
        <div className="qt-er-pa">
          {/* PRODUCT_TRUTH_DECORATIVE: adds the row to the chosen section (in an edit, puts the same row back changed) */}
          <button type="button" className="qt-btn qt-btn--p qt-add" data-testid={editItem ? 'qt-edit-save' : 'qt-add'} onClick={submit}>{t.add}</button>
          <span className="qt-msl">{t.lineSum}</span>
          <span className="qt-lsc" data-testid="qt-line-sum">{lineSumNode}</span>
          <span />
        </div>
      </div>
      {helpBox}
      {formErr && <div className="qt-err" role="alert" data-testid="qt-form-error">{formErr}</div>}
      <div className="qt-ebot">
        {/* PRODUCT_TRUTH_DECORATIVE: clears the entry row (in an edit, the row stays exactly as it was) */}
        <button type="button" className="qt-link" data-testid={editItem ? 'qt-edit-cancel' : 'qt-clear'} onClick={clearForm}>{t.clear}</button>
        {/* PRODUCT_TRUTH_DECORATIVE: opens / closes the sizes and the work details of the entry row (what was typed is kept) */}
        <button type="button" className="qt-link" aria-expanded={f.more} data-testid="qt-more" onClick={() => set({ more: !f.more })}>{t.more}</button>
        {typedNew && !editItem && (
          <label className="qt-chk"><input type="checkbox" checked={f.toCatalog} onChange={(e) => set({ toCatalog: e.target.checked })} />{t.saveCatalog}</label>
        )}
        <span className="qt-to" data-testid="qt-form-to">{t.to} {toText === t.whole ? <span>{t.whole}</span> : <EllipsisText dir={isHebrew ? 'rtl' : 'ltr'} text={toText} />}</span>
        {/* PRODUCT_TRUTH_DECORATIVE: the same Add, in the line under the row (desktop and tablet) */}
        <button type="button" className="qt-btn qt-btn--p qt-add2" data-testid="qt-add2" onClick={submit}>{t.add}</button>
      </div>
      {f.more && (
        <div className="qt-more" data-testid="qt-more-body">
          {nums.measured && (<>
            <div className="qt-toggle" role="group">
              {/* PRODUCT_TRUTH_DECORATIVE: the known total (area / length) - one quantity */}
              <button type="button" className="qt-chip" aria-pressed={f.known} onClick={() => set({ known: true })}>{t.known[nums.base]}</button>
              {/* PRODUCT_TRUTH_DECORATIVE: by sizes - the quantity is the sum of the sizes */}
              <button type="button" className="qt-chip" aria-pressed={!f.known} onClick={() => set({ known: false })}>{t.byMeasures}</button>
            </div>
            {!f.known && f.sizes.map((z, i) => (
              <div key={i} className="qt-size">
                <input className="qt-input" aria-label={`${t.measureName} ${i + 1}`} placeholder={t.measureName} value={z.name} onChange={(e) => set({ sizes: f.sizes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input className="qt-input pf-num" inputMode="decimal" dir="ltr" aria-label={`${t.lengthOf[nums.measureUnit]} ${i + 1}`} placeholder={t.lengthOf[nums.measureUnit]} value={z.w} onChange={(e) => set({ sizes: f.sizes.map((x, j) => (j === i ? { ...x, w: e.target.value } : x)) })} />
                {nums.base === 'area' && <input className="qt-input pf-num" inputMode="decimal" dir="ltr" aria-label={`${t.widthOf[nums.measureUnit]} ${i + 1}`} placeholder={t.widthOf[nums.measureUnit]} value={z.h} onChange={(e) => set({ sizes: f.sizes.map((x, j) => (j === i ? { ...x, h: e.target.value } : x)) })} />}
                {/* PRODUCT_TRUTH_DECORATIVE: removes this size of the entry row */}
                {f.sizes.length > 1 && <button type="button" className="qt-link" onClick={() => set({ sizes: f.sizes.filter((_, j) => j !== i) })}>{t.removeMeasure}</button>}
              </div>
            ))}
            {/* PRODUCT_TRUTH_DECORATIVE: one more size of the entry row */}
            {!f.known && <button type="button" className="qt-link" onClick={() => set({ sizes: [...f.sizes, { name: '', w: '', h: '' }] })}>{t.addSize}</button>}
          </>)}
          <label htmlFor="qt-f-details" className="qt-more-l">{t.workDetails}</label>
          <textarea id="qt-f-details" className="qt-input qt-textarea" value={f.details} placeholder={t.workDetailsPh} onChange={(e) => set({ details: e.target.value })} />
        </div>
      )}
    </>
  );
  const colHead = (
    <div className="qt-ih">
      <span>{t.colWork}<HelpDot k="product" label={t.product} t={t} help={help} setHelp={setHelp} /></span>
      <span>{t.pricing}<HelpDot k="pricing" label={t.pricing} t={t} help={help} setHelp={setHelp} /></span>
      <span>{t.colQty}<HelpDot k="qty" label={t.qty} t={t} help={help} setHelp={setHelp} /></span>
      <span>{t.colPrice}<HelpDot k="price" label={t.price} t={t} help={help} setHelp={setHelp} /></span>
      <span>{t.colSum}</span><span />
    </div>
  );
  // one card: the column titles (with "?"), the rows and the entry row below them
  const card = (idx) => (
    <div className="qt-items qt-tcard" data-testid="qt-rows">{colHead}{idx.map((i) => rowLine(i))}{entryRow()}</div>
  );
  const rowsBlock = (idx, withHead) => (idx.length ? (
    <div className="qt-items" data-testid="qt-rows">{withHead && <div className="qt-ih"><span>{t.colWork}</span><span>{t.pricing}</span><span>{t.colQty}</span><span>{t.colPrice}</span><span>{t.colSum}</span><span /></div>}
      {idx.map((i) => rowLine(i))}</div>) : null);

  // ---------- the add-sections panel (addHPanel) ----------
  const kindsInside = (parentKind) => (parentKind === 'floor' ? ['apartment', 'room', 'section'] : parentKind === 'apartment' ? ['room', 'section'] : parentKind === 'room' ? ['section'] : ['floor', 'apartment', 'room', 'section']);
  const panel = () => {
    const a = addPanel; const parent = a.parent ? sections.find((x) => keyOf(x) === a.parent) : null;
    return (
      <div className="qt-addh-p" role="group" aria-label={t.hAddFirst} data-testid="qt-wizard">
        {a.step === 'kind' && (<>
          <div className="qt-aq">{parent ? t.kindQIn(parent.name || t.unnamed) : t.kindQ}</div>
          <div className="qt-chips">{kindsInside(parent ? parent.kind || 'section' : null).map((k) => (
            // PRODUCT_TRUTH_DECORATIVE: chooses the kind of the new sections (floor / apartment / room / other topic)
            <button key={k} type="button" data-testid={`qt-kind-${k}`} onClick={() => setAddPanel({ ...a, kind: k, step: 'count', err: '' })}>{t.kinds[k]}</button>
          ))}</div>
        </>)}
        {a.step === 'count' && (<>
          <label className="qt-aq" htmlFor="qt-count">{t.countQ(t.plural[a.kind])}</label>
          <input id="qt-count" className="qt-hcnt pf-num" inputMode="numeric" dir="ltr" data-testid="qt-count" autoFocus value={a.count} placeholder="1" onChange={(e) => setAddPanel({ ...a, count: e.target.value, err: '' })} />
          <div className="qt-hint">{t.countHint(t.kinds1[a.kind])}</div>
          {a.err && <div className="qt-err" role="alert">{a.err}</div>}
        </>)}
        {a.step === 'names' && (<>
          <div className="qt-aq">{t.namesQ(a.kind, t.kinds1[a.kind])}</div>
          <div className="qt-hnames">{a.names.map((v, k) => (
            <input key={k} data-testid={`qt-name-${k}`} value={v} placeholder={t.namePh[a.kind]} aria-label={`${t.nameL} ${k + 1}`}
              onChange={(e) => setAddPanel({ ...a, names: a.names.map((x, j) => (j === k ? e.target.value : x)), err: '' })} />
          ))}</div>
          <div className="qt-hint">{t.namesHint}</div>
          {a.err && <div className="qt-err" role="alert" data-testid="qt-names-error">{a.err}</div>}
        </>)}
        <div className="qt-hacts">
          {a.step === 'kind' ? (
            // PRODUCT_TRUTH_DECORATIVE: closes the panel - nothing is added
            <button type="button" className="qt-btn" data-testid="qt-page-close" onClick={() => setAddPanel(null)}>{t.closeNoSave}</button>
          ) : (<>
            {/* PRODUCT_TRUTH_DECORATIVE: checks the number and goes on to the names / adds the new sections to the quote */}
            <button type="button" className="qt-btn qt-btn--p" data-testid={a.step === 'count' ? 'qt-count-next' : 'qt-wizard-create'} onClick={addNext}>{a.step === 'count' ? t.toNames : t.hCreate}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: back one step of the panel (what was typed is kept) */}
            <button type="button" className="qt-btn" data-testid="qt-page-back" onClick={() => setAddPanel({ ...a, step: a.step === 'names' ? 'count' : 'kind', err: '' })}>{t.back}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: closes the panel - nothing is added */}
            <button type="button" className="qt-link" data-testid="qt-page-close" onClick={() => setAddPanel(null)}>{t.closeNoSave}</button>
          </>)}
        </div>
      </div>
    );
  };

  // ---------- a section (headHtml) ----------
  const heading = (s) => {
    const key = keyOf(s);
    const depth = depthOf(sections, key);
    const isOpen = !collapsed.has(key);
    const kids = childrenOf(sections, key);
    const repeat = normalizeRepeatCount(s.repeat_count);
    const name = String(s.name || '').trim() || t.unnamed;
    const open = isMenu('head', key);
    const first = firstSiblingOf(sections, key);
    const isFirst = !first || keyOf(first) === key;
    const isReal = (it) => it && !isUntouchedPlaceholderItem(it) && !it._localExample;
    const canTemplate = onSaveHeadingTemplate && String(s.name || '').trim() && rowsOf(key).length && !kids.length;
    const items2 = [
      { label: t.addHere, icon: <SketchIcon name="plus" size={16} />, onClick: run(() => chooseTarget(key)), testId: 'qt-head-here' },
      allowNest && depth < MAX_DEPTH - 1 && repeat < 2 ? { label: t.hInside, icon: <SketchIcon name="plusCircle" size={16} />, testId: 'qt-add-inside', onClick: run(() => { expand(key); setAddPanel({ parent: key, step: 'kind', count: '1', names: [], err: '' }); }) } : null,
      { label: t.hRename, icon: <SketchIcon name="pen" size={16} />, onClick: run(() => setRenaming({ key, value: String(s.name || '') })), testId: 'qt-head-rename' },
      { label: t.hDup, icon: <SketchIcon name="copy" size={16} />, testId: 'qt-head-duplicate', onClick: run(() => {
        const under = new Set(subtreeKeys(sections, key));
        if (locked(items.filter((it) => it && under.has(it.section_key)))) { onDuplicateLocked?.(); return; }
        const r = duplicateHeading(sections, items, key, isHebrew); done(t.msgHeadingCopied); setSections(r.sections); setItems(r.items);
        const copy = r.sections.find((x) => keyOf(x) === r.copyKey); setRenaming({ key: r.copyKey, value: String(copy?.name || '') });
      }) },
      { label: t.hCopyFirst, icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /></svg>, testId: 'unit-copy-first', disabled: isFirst, title: first ? first.name : undefined,
        onClick: run(() => { done(t.msgCopiedFirst); setItems(copyRowsFromFirst(sections, items, key, isReal)); }) },
      canTemplate ? { label: t.hTmpl, icon: <SketchIcon name="tmpl" size={16} />, testId: 'qt-head-template', onClick: run(() => onSaveHeadingTemplate(s)) } : null,
      '-',
      { label: t.hDel, icon: <SketchIcon name="trash" size={16} />, danger: true, testId: 'qt-head-delete', onClick: run(() => {
        const r = removeHeadingWithContent(sections, items, key);
        done(t.msgHeadingDeleted); setSections(r.sections); setItems(r.items);
        if (target && !r.sections.some((x) => keyOf(x) === target)) setTarget(null);
      }) },
    ];
    const saveName = () => {
      const v = String(renaming.value || '').trim();
      if (!v) { setStatus({ text: t.needHName, error: true }); return; }
      if (childrenOf(sections, parentOf(sections, key)).some((x) => keyOf(x) !== key && String(x.name || '').trim().toLowerCase() === v.toLowerCase())) { setStatus({ text: t.namesDup, error: true }); return; }
      done(t.msgNamesSaved); setSections(sections.map((x) => (keyOf(x) === key ? { ...x, name: v } : x))); setRenaming(null);
    };
    const idx = rowsOf(key);
    return (
      <div key={key} className="qt-hb" data-testid="qt-heading" data-depth={depth}>
        {renaming && renaming.key === key ? (
          <div className="qt-hh qt-hh--ren">
            <input className="qt-input" data-testid="qt-rename" aria-label={t.hRename} autoFocus value={renaming.value} onChange={(e) => setRenaming({ key, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(); } if (e.key === 'Escape') setRenaming(null); }} />
            {/* PRODUCT_TRUTH_DECORATIVE: keeps the new name of the section (its works and prices stay) */}
            <button type="button" className="qt-btn qt-btn--p qt-btn--sm" data-testid="qt-save-name" onClick={saveName}>{t.saveName}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: leaves the name as it was */}
            <button type="button" className="qt-btn qt-btn--sm" onClick={() => setRenaming(null)}>{t.cancel}</button>
          </div>
        ) : (
          <div id={`qt-h-${String(key).replace(/[^a-z0-9_-]/gi, '')}`} className={`qt-hh${target === key ? ' qt-hh--on' : ''}`}>
            {/* PRODUCT_TRUTH_DECORATIVE: folds / opens a section (its content stays) */}
            <button type="button" className="qt-ib qt-tri" aria-expanded={isOpen} aria-label={`${isOpen ? t.hClose : t.hOpen} ${name}`}
              onClick={() => { if (isOpen && liveTarget && pathOf(sections, liveTarget).some((x) => keyOf(x) === key)) setTarget(null); setCollapsed((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; }); }}>
              <ChevronDown {...sizeOf(15)} style={{ transform: isOpen ? 'none' : `rotate(${isHebrew ? 90 : -90}deg)` }} /></button>
            {/* PRODUCT_TRUTH_DECORATIVE: the section name - a click sends the entry row to this section */}
            <button type="button" className="qt-hn" aria-pressed={target === key} onClick={() => chooseTarget(key)}>
              {String(s.name || '').trim() ? <EllipsisText text={repeat > 1 ? `${s.name} × ${repeat}` : s.name} /> : <span className="qt-unnamed">{t.unnamed}</span>}
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: sends the entry row to this section (desktop and tablet) */}
            <button type="button" className="qt-ib qt-addb" aria-label={t.addHereL(name)} onClick={() => chooseTarget(key)}><SketchIcon name="plus" size={17} /></button>
            <span className="qt-hs">{money(headingTotal(items, sections, key))}</span>
            <span className="qt-menu-wrap" ref={wrapRef('head', key)}>
              {/* PRODUCT_TRUTH_DECORATIVE: the actions menu of a section (add here / inside, rename, duplicate, copy, template, remove) */}
              <button type="button" className="qt-ib" aria-haspopup="menu" aria-expanded={open} aria-label={t.hActs(name)} data-testid="qt-heading-actions" onClick={toggleMenu('head', key)}><SketchIcon name="dots" size={17} /></button>
              {open && <MenuList up={menu.up} label={t.hActs(name)} items={items2} />}
            </span>
          </div>
        )}
        {isOpen && (
          <div className="qt-hbody">
            {repeat > 1 && (() => {
              // an older quote whose section stands for N identical copies (Owner 2026-11-10 G6a "א": the sums by name, not as an equation)
              const kind = s.kind || 'section';
              const W = groupWord(kind, true); const Wp = groupWord(kind, true, { plural: true });
              const w = groupWord(kind, false).toLowerCase(); const wp = groupWord(kind, false, { plural: true }).toLowerCase();
              const per = idx.reduce((n, i) => n + lineTotal(items[i]), 0);
              return (
                <div className="qt-strip" data-testid="unit-per-copy">
                  <span>{isHebrew
                    ? <>סכום ל{W}: <bdi dir="ltr" className="pf-money">{sym}{fmtMoney(per)}</bdi> · סכום לכל ה{Wp}: <bdi dir="ltr" className="pf-money">{sym}{fmtMoney(per * repeat)}</bdi></>
                    : <>Per {w}: <bdi dir="ltr" className="pf-money">{sym}{fmtMoney(per)}</bdi> · All {wp}: <bdi dir="ltr" className="pf-money">{sym}{fmtMoney(per * repeat)}</bdi></>}</span>
                  <span>{isHebrew ? `השורות כאן הן ל${W} אחת` : `The rows here are for one ${w}`}</span>
                  <span data-testid="unit-applies-all">{isHebrew ? <>עריכה תחול על כל <bdi dir="ltr" className="pf-num">{repeat}</bdi> ה{Wp}.</> : <>Edits apply to all <bdi dir="ltr" className="pf-num">{repeat}</bdi> {wp}.</>}</span>
                </div>
              );
            })()}
            {addPanel && addPanel.parent === key && panel()}
            {target === key ? card(idx) : rowsBlock(idx, false)}
            {kids.map((k) => heading(k))}
          </div>
        )}
      </div>
    );
  };

  // ---------- the structure line (eline) ----------
  const smOpen = isMenu('struct', 's');
  const structs = [['simple', t.simple, t.sxSimple], ['grouped', t.grouped, t.sxGrouped], ['tiered', t.tiered, t.sxTiered]];
  const structLabel = (structs.find((z) => z[0] === structure) || structs[0])[1];
  const top = rowsOf(null);
  const rootTarget = simple || !liveTarget;
  const statusEl = status && (
    <div className={status.error ? 'qt-toast qt-toast--error' : 'qt-toast'} role={status.error ? 'alert' : 'status'} data-testid={status.error ? 'qt-block' : 'qt-undo'}>
      <span>{status.text}</span>
      {/* PRODUCT_TRUTH_DECORATIVE: undoes the last change exactly */}
      {status.restore && <button type="button" className="qt-link qt-toast-undo" onClick={() => { status.restore(); setStatus(null); }}>{t.undoLast}</button>}
      {/* PRODUCT_TRUTH_DECORATIVE: closes the message */}
      <button type="button" className="qt-ib qt-toast-x" aria-label={t.closeMsg} onClick={() => setStatus(null)}><X {...sizeOf(14)} /></button>
    </div>
  );
  const moving = moveSheet != null && items[moveSheet] ? items[moveSheet] : null;
  return (
    <div className="qt" ref={rootRef} dir={isHebrew ? 'rtl' : 'ltr'} data-testid="qt-editor" onKeyDown={(e) => { if (enterInField(e)) e.preventDefault(); }}>
      {statusSlot ? createPortal(statusEl, statusSlot) : statusEl}
      <div className="qt-eline">
        <span className="qt-menu-wrap" ref={wrapRef('struct', 's')}>
          {/* PRODUCT_TRUTH_DECORATIVE: opens the structure menu of the quote (simple / in sections / sections within sections) */}
          <button type="button" className="qt-slink" aria-haspopup="menu" aria-expanded={smOpen} data-testid="qt-structure" onClick={toggleMenu('struct', 's')}>{t.structL} <b>{structLabel}</b><ChevronDown {...sizeOf(14)} /></button>
          {smOpen && (
            <div className="qt-menu qt-smenu" role="menu" aria-label={t.structL}>
              {structs.map(([k, label, sx]) => (
                // PRODUCT_TRUTH_DECORATIVE: chooses the quote structure - nothing that was entered is removed
                <button key={k} type="button" role="menuitemradio" aria-checked={structure === k} className={`qt-sopt${structure === k ? ' qt-sopt--on' : ''}`} data-testid={`qt-structure-${k}`}
                  onClick={() => { setMenu(null); onStructure(k); setAddPanel(null); setRenaming(null); if (k === 'simple') setTarget(null); }}><span><b>{label}</b><small>{sx}</small></span></button>
              ))}
            </div>
          )}
        </span>
        {lineExtra}
      </div>
      {simple ? card(flatRows()) : (<>
        {tops.map((s) => heading(s))}
        {addPanel && !addPanel.parent ? panel() : (
          // PRODUCT_TRUTH_DECORATIVE: adds the first / more sections of the quote (the kind, how many, the names)
          <button type="button" className="qt-btn qt-addh" data-testid="qt-add-first" onClick={() => setAddPanel({ parent: null, step: 'kind', count: '1', names: [], err: '' })}><SketchIcon name="plusCircle" size={16} />{t.hAddFirst}</button>
        )}
        {sections.length > 0 && (top.length > 0 || rootTarget) && <div className="qt-wl">{t.whole}</div>}
        {rootTarget ? card(top) : (<>
          {rowsBlock(top, !sections.length)}
          {/* PRODUCT_TRUTH_DECORATIVE: sends the entry row to the whole quote */}
          <button type="button" className="qt-link qt-addhere" data-testid="qt-target-whole" onClick={() => chooseTarget(null)}>{t.addWhole}</button>
        </>)}
      </>)}
      {moving && (
        <div className="qt-ov" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setMoveSheet(null); }}>
          <div className="qt-dlg" role="dialog" aria-modal="true" aria-label={t.moveT} data-testid="qt-move-sheet">
            <h3>{t.moveT}</h3>
            <p className="qt-dlg-sub">{moving.description}</p>
            <div className="qt-mvl">
              {[{ key: null, name: t.whole, d: 0 }, ...treeOrder()].map((h) => {
                const here = (placeOf(moving) || null) === (h.key || null);
                return (
                  // PRODUCT_TRUTH_DECORATIVE: moves the row to this section (the whole quote at the top)
                  <button key={h.key || 'root'} type="button" disabled={here} style={{ paddingInlineStart: `${10 + h.d * 16}px` }} onClick={() => moveRowTo(moveSheet, h.key)}>
                    <bdi>{h.name || t.unnamed}</bdi>{here && <small> · {t.here}</small>}
                  </button>
                );
              })}
            </div>
            <div className="qt-dlg-acts">{/* PRODUCT_TRUTH_DECORATIVE: closes the move window - the row stays where it is */}<button type="button" className="qt-btn" onClick={() => setMoveSheet(null)}>{t.cancel}</button></div>
          </div>
        </div>
      )}
      {bottomBar}
    </div>
  );
}

export { T as QUOTE_TREE_COPY };
