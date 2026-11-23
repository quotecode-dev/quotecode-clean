// Task 27 (P2, spec §6): whole-quote templates - "Save as template" (from the open quote editor; the owner chooses what to keep) and
// "Start from a template" (list -> preview -> use). Using a template only opens a NEW unsaved quote form through the caller's normal
// new-quote path (the Free-10 check runs there first); nothing is saved, issued or sent. A template never holds a customer, contact,
// number, status, signature, payment, link or date (quoteTemplates.js; the database refuses them too). Amounts / counts are LTR atoms.
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, LayoutTemplate, Trash2 } from 'lucide-react';
import useFocusTrap from './quotePresentation/useFocusTrap';
import { DEFAULT_TEMPLATE_KEEP, TEMPLATE_NAME_MAX, buildTemplateContent, templateSummary, DEFAULT_UNIT_TEMPLATE_KEEP, buildUnitTemplateContent, templateKind, TEMPLATE_KIND_UNIT,
  templateEditGroups, templateEditRows, templateEditProblem, applyTemplateEdits } from '../utils/quoteTemplates';
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from '../utils/quoteTemplatesClient';
import { getProfessionalUnitLabel } from '../utils/professionalQuoteItem';
import { askConfirm } from './AppDialog';
import EllipsisText from './EllipsisText';

const COPY = {
  he: {
    saveTitle: 'שמירה כתבנית', pickTitle: 'בחירת תבנית הצעה', close: 'סגירה', cancel: 'ביטול', // G7 (Owner 2026-11-08, the clarity fixes B3); Owner 2026-11-11 (finding 6): the two keys sat inside this comment, so the Hebrew button and the X had no name
    // Owner 2026-11-11 (finding 14): an Israeli quote with no client type chosen yet asks whether the kept prices include VAT
    basisQ: 'המחירים בתבנית:', basisIncl: 'כוללים מע״מ', basisExcl: 'לפני מע״מ', basisMissing: 'בחרו אם המחירים בתבנית כוללים מע״מ.',
    name: 'שם התבנית', namePh: 'לדוגמה: שיפוץ אמבטיה בסיסי',
    keep: 'מה לשמור בתבנית', keepPrices: 'מחירים', keepTexts: 'תנאים, אחריות והערות', keepSubject: 'נושא ושם פרויקט', keepPresentation: 'עיצוב ותמונות',
    never: 'לא נשמרים לעולם: לקוח ואיש קשר, מספר הצעה, מצב, חתימה, תשלום, קישור ותאריכים.',
    save: 'שמירת התבנית', saving: 'שומר…', saved: 'התבנית נשמרה.',
    noItems: 'אין בהצעה פריטים לשמירה כתבנית.', loading: 'טוען תבניות…', empty: 'אין עדיין תבניות. אפשר ליצור הצעת מחיר ולשמור אותה כתבנית.',
    use: 'שימוש בתבנית', del: 'מחיקה', confirmDel: (n) => `למחוק את התבנית "${n}"? אי אפשר לשחזר אותה.`,
    items: 'פריטים', sections: 'חלקים', subtotal: 'סכום לפני מע״מ והנחה', subtotalInclVat: 'סכום כולל מע״מ, לפני הנחה', noPrices: 'ללא מחירים', texts: 'כולל תנאים / אחריות / הערות', presentation: 'כולל עיצוב ותמונות',
    useHint: 'נפתחת הצעה חדשה שעדיין לא נשמרה. פרטי הלקוח, התוקף והתאריכים ימולאו מחדש.',
    // Owner console 2026-11-08 (stage 4 of the one quote builder, decision 6): unit templates
    saveUnitTitle: 'שמירה כתבנית יחידה', pickUnitTitle: 'הוספת יחידה מתבנית', unitNamePh: 'לדוגמה: דירת 4 חדרים טיפוס א׳',
    keepDetails: 'פרטים ללקוח', neverUnit: 'לא נשמרים לעולם: לקוח, כתובת, שמות המקומות במידות, מספר היחידות הזהות ותאריכים.',
    filterQuotes: 'תבניות הצעה', filterUnits: 'תבניות יחידה', addUnit: 'הוספה להצעה',
    unitHint: 'הוספת יחידה אחת להצעה הפתוחה - עם השורות שלה, בסוף ההצעה.',
    emptyUnit: 'אין עדיין תבניות יחידה. שומרים יחידה מתפריט היחידה, ב"שמירה כתבנית יחידה".',
    unitElsewhere: 'תבנית של מקום מוסיפים מתוך הצעה פתוחה, בכפתור "מתבנית שמורה".', quoteElsewhere: 'תבנית הצעה פותחים מ"הצעה חדשה", ב"מתבנית שמורה".',
    duplicateAny: 'כבר יש תבנית בשם הזה, של הצעה או של יחידה. בחרו שם אחר.',
    // Owner console 2026-11-16 (typed: "מאשר עריכת תבנית בחלון בחירת התבנית: ..."): editing a template in this window
    edit: 'עריכה', editTitle: 'עריכת התבנית', wholeTemplate: 'כל התבנית', rowDesc: 'תיאור', rowQty: 'כמות', rowPrice: 'מחיר',
    rowDelete: 'מחיקת השורה', addRow: '+ הוספת שורה',
    errors: {
      unavailable: 'תבניות עדיין לא זמינות בשרת הזה. אפשר להמשיך לעבוד עם הצעות כרגיל.', duplicate_name: 'כבר יש תבנית בשם הזה. בחרו שם אחר.',
      name_required: 'יש לתת שם לתבנית.', name_too_long: `שם התבנית ארוך מ-${TEMPLATE_NAME_MAX} תווים.`, too_large: 'התבנית גדולה מדי לשמירה.',
      no_items: 'בתבנית צריכה להישאר לפחות שורה אחת.', row_no_description: 'יש שורה בלי תיאור. כתבו תיאור או מחקו את השורה.',
      bad_quantity: 'הכמות בכל שורה צריכה להיות מספר גדול מ-0.', bad_price: 'המחיר צריך להיות מספר. אפשר גם להשאיר אותו ריק.',
      default: 'הפעולה נכשלה. שום דבר לא שונה.',
    },
  },
  en: {
    saveTitle: 'Save as template', pickTitle: 'Choose a quote template', close: 'Close', cancel: 'Cancel',
    basisQ: 'Template prices:', basisIncl: 'Include VAT', basisExcl: 'Before VAT', basisMissing: 'Choose whether the template prices include VAT.',
    name: 'Template name', namePh: 'e.g. Basic bathroom renovation',
    keep: 'What to keep in the template', keepPrices: 'Prices', keepTexts: 'Terms, warranty and notes', keepSubject: 'Subject and project name', keepPresentation: 'Design and images',
    never: 'Never kept: the customer and contact, quote number, status, signature, payment, link and dates.',
    save: 'Save template', saving: 'Saving...', saved: 'Template saved.',
    noItems: 'This quote has no items to save as a template.', loading: 'Loading templates...', empty: 'No templates yet. Create a quote and save it as a template.',
    use: 'Use template', del: 'Delete', confirmDel: (n) => `Delete the template "${n}"? It cannot be restored.`,
    items: 'Items', sections: 'Sections', subtotal: 'Amount before tax and discount', subtotalInclVat: 'Amount including VAT, before discount', noPrices: 'No prices', texts: 'Includes terms / warranty / notes', presentation: 'Includes design and images',
    useHint: 'Opens a new, unsaved quote; the customer, validity and dates are filled in fresh.',
    saveUnitTitle: 'Save as unit template', pickUnitTitle: 'Add unit from template', unitNamePh: 'e.g. 4-room apartment, type A',
    keepDetails: 'Details for the customer', neverUnit: 'Never kept: the customer, the address, the place names of the sizes, the identical unit count and dates.',
    filterQuotes: 'Quote templates', filterUnits: 'Unit templates', addUnit: 'Add to the quote',
    unitHint: 'Add one unit to this quote - with its rows, at the end of the quote.',
    emptyUnit: 'No unit templates yet. Save a unit from its unit menu, with "Save as unit template".',
    unitElsewhere: 'A place template is added from an open quote, with "From a saved template".', quoteElsewhere: 'A quote template is opened from "New quote", with "From a saved template".',
    duplicateAny: 'A quote or unit template with this name already exists. Choose another name.',
    edit: 'Edit', editTitle: 'Edit the template', wholeTemplate: 'Whole template', rowDesc: 'Description', rowQty: 'Quantity', rowPrice: 'Price',
    rowDelete: 'Delete the row', addRow: '+ Add a row',
    errors: {
      unavailable: 'Templates are not available on this server yet. Quotes themselves keep working normally.', duplicate_name: 'A template with this name already exists. Choose another name.',
      name_required: 'Give the template a name.', name_too_long: `The name is longer than ${TEMPLATE_NAME_MAX} characters.`, too_large: 'The template is too large to save.',
      no_items: 'A template needs at least one row.', row_no_description: 'A row has no description. Write one or delete the row.',
      bad_quantity: 'The quantity in every row must be a number above 0.', bad_price: 'The price must be a number. It can also stay empty.',
      default: 'The action failed. Nothing was changed.',
    },
  },
};
const errText = (C, r) => C.errors[r?.error?.code === 'invalid' ? r.error.message : r?.error?.code] || C.errors.default;

function DialogShell({ titleId, title, isHebrew, onClose, children, testId }) {
  const ref = useRef(null);
  useFocusTrap(ref, true);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('input, button:not([disabled])')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (prev && typeof prev.focus === 'function') prev.focus(); };
  }, [onClose]);
  return (
    <div className="no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10040, padding: 16 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} dir={isHebrew ? 'rtl' : 'ltr'} data-testid={testId}
        style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 20, boxSizing: 'border-box', textAlign: 'start', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.15rem', color: '#0F6672', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><LayoutTemplate size={19} aria-hidden="true" />{title}</h2>
          {/* PRODUCT_TRUTH_DECORATIVE: closes the template dialog; changes no data */}
          <button type="button" onClick={onClose} aria-label={COPY[isHebrew ? 'he' : 'en'].close}
            style={{ minWidth: 44, minHeight: 44, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
const btn = (primary, disabled) => ({ minHeight: 44, padding: '0 16px', borderRadius: 9, border: primary ? 'none' : '1px solid #94a3b8', background: disabled ? '#e2e8f0' : (primary ? '#102444' : '#fff'), color: disabled ? '#64748b' : (primary ? '#fff' : '#1e293b'), fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' });

function Summary({ C, s, formatMoney }) {
  if (!s) return null;
  return (
    <ul data-testid="template-summary" style={{ margin: '6px 0 0', paddingInlineStart: 18, fontSize: '0.82rem', color: '#334155' }}>
      <li>{C.items}: <bdi className="pf-num" dir="ltr">{s.itemCount}</bdi>{s.sectionCount ? <> · {C.sections}: <bdi className="pf-num" dir="ltr">{s.sectionCount}</bdi></> : null}</li>
      <li>{s.hasPrices ? <>{s.priceBasis === 'incl_vat' ? C.subtotalInclVat : C.subtotal}: <bdi className="pf-num" dir="ltr">{formatMoney(s.subtotal)}</bdi></> : C.noPrices}</li>
      {s.hasTexts && <li>{C.texts}</li>}
      {s.hasPresentation && <li>{C.presentation}</li>}
    </ul>
  );
}

// PRODUCT_TRUTH_CAPABILITY: quote_create
// unit = { sectionKey, name, rowBilling } saves ONE unit as a unit template (Owner console 2026-11-08 (stage 4 of the one quote builder, decision 6))
// rowBilling = the row's billing type on screen, kept in a whole-quote template too (Codex review 2026-11-09)
// askPriceBasis = an Israeli (Local market) quote whose client type is not chosen yet (Owner 2026-11-11, finding 14) - the market decides, never the UI language
export function SaveTemplateDialog({ isHebrew, client, userId, form: formIn, formatMoney, onClose, onSaved = null, unit = null, rowBilling = null, askPriceBasis = false }) {
  const C = COPY[isHebrew ? 'he' : 'en'];
  const [chosenBasis, setChosenBasis] = useState(null);
  const form = askPriceBasis && chosenBasis ? { ...formIn, priceBasis: chosenBasis } : formIn;
  const [name, setName] = useState(unit ? String(unit.name || '') : '');
  const [keep, setKeep] = useState(unit ? { ...DEFAULT_UNIT_TEMPLATE_KEEP } : { ...DEFAULT_TEMPLATE_KEEP });
  const [state, setState] = useState({ phase: 'idle', text: '' });
  const built = unit ? buildUnitTemplateContent(form, unit.sectionKey, keep, unit.rowBilling) : buildTemplateContent(form, keep, rowBilling);
  const preview = templateSummary(built);
  const noItems = !preview || preview.itemCount === 0;
  const showBasis = askPriceBasis && keep.prices && !!preview?.hasPrices;
  const submit = async (e) => {
    e.preventDefault();
    if (showBasis && !chosenBasis) { setState({ phase: 'error', text: C.basisMissing }); return; }
    setState({ phase: 'saving', text: '' });
    const r = await createTemplate(client, userId, name, form, keep, built);
    if (r.ok) { setState({ phase: 'saved', text: C.saved }); if (typeof onSaved === 'function') onSaved(r.data); }
    else setState({ phase: 'error', text: unit && r?.error?.code === 'duplicate_name' ? C.duplicateAny : errText(C, r) });
  };
  const box = (k, label) => (
    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, fontSize: '0.86rem', color: '#1e293b', cursor: 'pointer' }}>
      <input type="checkbox" data-testid={`template-keep-${k}`} checked={keep[k]} onChange={(e) => setKeep((x) => ({ ...x, [k]: e.target.checked }))} />{label}
    </label>
  );
  return (
    <DialogShell titleId="save-template-title" title={unit ? C.saveUnitTitle : C.saveTitle} isHebrew={isHebrew} onClose={onClose} testId="save-template-dialog">
      <form onSubmit={submit}>
        <label htmlFor="template-name" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{C.name}</label>
        <input id="template-name" data-testid="template-name" value={name} maxLength={TEMPLATE_NAME_MAX} placeholder={unit ? C.unitNamePh : C.namePh} onChange={(e) => { setName(e.target.value); setState({ phase: 'idle', text: '' }); }}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '16px', fontFamily: 'inherit' }} />
        <fieldset style={{ border: 'none', padding: 0, margin: '12px 0 0' }}>
          <legend style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{C.keep}</legend>
          {unit ? <>{box('prices', C.keepPrices)}{box('details', C.keepDetails)}</> : <>{box('prices', C.keepPrices)}{box('texts', C.keepTexts)}{box('subject', C.keepSubject)}{box('presentation', C.keepPresentation)}</>}
        </fieldset>
        {showBasis && (
          <fieldset data-testid="template-price-basis" style={{ border: 'none', padding: 0, margin: '10px 0 0' }}>
            <legend style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{C.basisQ}</legend>
            {[['incl_vat', C.basisIncl], ['excl_vat', C.basisExcl]].map(([v, label]) => (
              <label key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, marginInlineEnd: 16, fontSize: '0.86rem', color: '#1e293b', cursor: 'pointer' }}>
                <input type="radio" name="template-price-basis" value={v} data-testid={`template-basis-${v}`} checked={chosenBasis === v} onChange={() => { setChosenBasis(v); setState({ phase: 'idle', text: '' }); }} />{label}
              </label>
            ))}
          </fieldset>
        )}
        <p data-testid="template-never" style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#475569' }}>{unit ? C.neverUnit : C.never}</p>
        {noItems ? <p role="status" style={{ color: '#9a3412', fontWeight: 600, fontSize: '0.82rem' }}>{C.noItems}</p> : <Summary C={C} s={preview} formatMoney={formatMoney} />}
        {state.text && <p role={state.phase === 'error' ? 'alert' : 'status'} data-testid="template-save-result" style={{ margin: '10px 0 0', fontSize: '0.84rem', fontWeight: 700, color: state.phase === 'error' ? '#991b1b' : '#166534' }}>{state.text}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <button type="submit" data-testid="template-save" disabled={noItems || state.phase === 'saving' || state.phase === 'saved'} style={btn(true, noItems || state.phase === 'saving' || state.phase === 'saved')}>{state.phase === 'saving' ? C.saving : C.save}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: closes the template dialog; changes no data */}
          <button type="button" onClick={onClose} style={btn(false, false)}>{state.phase === 'saved' ? C.close : C.cancel}</button>
        </div>
      </form>
    </DialogShell>
  );
}

// Owner console 2026-11-16 (typed: "מאשר עריכת תבנית בחלון בחירת התבנית: שינוי שם, שינוי, מחיקה והוספה של שורות ושמירת התבנית, כולל שינוי
// ב-L-09 ..."): the edit view of one template - its name, then its rows under their places (description, quantity, price, delete, add a row).
// The prices stay in the template's own currency (L-09), shown beside the price; nothing else of the template changes.
const CURRENCY_SIGN = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '16px', fontFamily: 'inherit', minHeight: 44 };
const smallLabel = { display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 3 };
function TemplateEditor({ C, isHebrew, draft, setDraft, onSave, onCancel }) {
  const groups = templateEditGroups(draft.content);
  const shownKeys = new Set(groups.map((g) => g.key));
  const groupOf = (r) => (shownKeys.has(r.section_key) ? r.section_key : '');
  const currency = typeof draft.content?.currency === 'string' ? (CURRENCY_SIGN[draft.content.currency] || draft.content.currency) : '';
  const edit = (patch) => setDraft((d) => ({ ...d, ...patch, phase: 'idle', text: '' }));
  const setRow = (uid, patch) => setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)), phase: 'idle', text: '' }));
  const removeRow = (uid) => setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.uid !== uid), phase: 'idle', text: '' }));
  const addRow = (key) => setDraft((d) => ({ ...d, rows: [...d.rows, { uid: d.nextUid, ref: null, description: '', quantity: '1', unit_price: '', pricing_unit: null, section_key: key }], nextUid: d.nextUid + 1, focusUid: d.nextUid, phase: 'idle', text: '' }));
  const rootRef = useRef(null);
  useEffect(() => { if (draft.focusUid != null) rootRef.current?.querySelector(`[data-edit-uid="${draft.focusUid}"]`)?.focus(); }, [draft.focusUid]);
  const saving = draft.phase === 'saving';
  return (
    <form ref={rootRef} onSubmit={(e) => { e.preventDefault(); onSave(); }} data-testid="template-editor">
      {/* Owner console 2026-11-19: a long place name ends with "…" and shows whole in the bubble on hover / tap (EllipsisText + .pf-ell) */}
      <style>{'.tk-tpl-group-name{display:block}'}</style>
      <label htmlFor="template-edit-name" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{C.name}</label>
      <input id="template-edit-name" data-testid="template-edit-name" value={draft.name} maxLength={TEMPLATE_NAME_MAX} onChange={(e) => edit({ name: e.target.value })} style={fieldStyle} />
      {groups.map((g) => {
        const rows = draft.rows.filter((r) => groupOf(r) === g.key);
        return (
          <section key={g.key || '_whole'} data-testid="template-edit-group" style={{ marginTop: 14, paddingInlineStart: g.depth * 14 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '0.92rem', color: '#0F6672', minWidth: 0 }}>
              <EllipsisText className="tk-tpl-group-name" text={g.name || C.wholeTemplate} />
            </h3>
            {rows.map((r) => (
              <div key={r.uid} data-testid="template-edit-row" style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, marginBottom: 8, background: '#f8fafc' }}>
                <label htmlFor={`tpl-row-desc-${r.uid}`} style={smallLabel}>{C.rowDesc}</label>
                <input id={`tpl-row-desc-${r.uid}`} data-edit-uid={r.uid} data-testid="template-edit-desc" value={r.description} maxLength={1000} onChange={(e) => setRow(r.uid, { description: e.target.value })} style={fieldStyle} />
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
                  <div style={{ flex: '1 1 110px', minWidth: 0 }}>
                    <label htmlFor={`tpl-row-qty-${r.uid}`} style={smallLabel}>{C.rowQty}{r.pricing_unit ? <> (<bdi>{getProfessionalUnitLabel(r.pricing_unit, isHebrew)}</bdi>)</> : null}</label>
                    <input id={`tpl-row-qty-${r.uid}`} data-testid="template-edit-qty" inputMode="decimal" dir="ltr" value={r.quantity} onChange={(e) => setRow(r.uid, { quantity: e.target.value })} style={{ ...fieldStyle, textAlign: isHebrew ? 'right' : 'left' }} />
                  </div>
                  <div style={{ flex: '1 1 110px', minWidth: 0 }}>
                    <label htmlFor={`tpl-row-price-${r.uid}`} style={smallLabel}>{C.rowPrice}{currency ? <> (<bdi dir="ltr">{currency}</bdi>)</> : null}</label>
                    <input id={`tpl-row-price-${r.uid}`} data-testid="template-edit-price" inputMode="decimal" dir="ltr" value={r.unit_price} onChange={(e) => setRow(r.uid, { unit_price: e.target.value })} style={{ ...fieldStyle, textAlign: isHebrew ? 'right' : 'left' }} />
                  </div>
                  {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
                  <button type="button" data-testid="template-edit-delete-row" onClick={() => removeRow(r.uid)} aria-label={`${C.rowDelete}: ${r.description}`}
                    style={{ ...btn(false, false), color: '#b91c1c', borderColor: '#fecaca', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trash2 size={15} aria-hidden="true" />{C.rowDelete}</button>
                </div>
              </div>
            ))}
            {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
            <button type="button" data-testid="template-edit-add-row" onClick={() => addRow(g.key)} style={{ ...btn(false, false), borderStyle: 'dashed' }}>{C.addRow}</button>
          </section>
        );
      })}
      {draft.text && <p role="alert" data-testid="template-edit-result" style={{ margin: '12px 0 0', fontSize: '0.84rem', fontWeight: 700, color: '#991b1b' }}>{draft.text}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
        <button type="submit" data-testid="template-edit-save" disabled={saving} style={btn(true, saving)}>{saving ? C.saving : C.save}</button>
        {/* PRODUCT_TRUTH_DECORATIVE: leaves the edit view; changes no data */}
        <button type="button" data-testid="template-edit-cancel" onClick={onCancel} style={btn(false, false)}>{C.cancel}</button>
      </div>
    </form>
  );
}

// PRODUCT_TRUTH_CAPABILITY: quote_create
// kind = 'quote' (start a new quote) or 'unit' (add one unit to the open quote) - the same screen manages both kinds, with a filter; a
// template is used only where it belongs (Owner console 2026-11-08 (stage 4 of the one quote builder, decision 6))
export function TemplatePickerDialog({ isHebrew, client, userId, formatMoney, onClose, onUse, kind = 'quote' }) {
  const C = COPY[isHebrew ? 'he' : 'en'];
  const [load, setLoad] = useState({ state: 'loading', rows: [], text: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState('');
  // Owner console 2026-11-08 (restore item 13 of docs/CODEX_SPEC_DEFAULTS_AND_CHANGES_2026-11-08.md): each window shows, uses and deletes
  // only its own kind of template - the quote-template window as before stage 4 (one list), the unit-template window its unit templates
  const filter = kind === TEMPLATE_KIND_UNIT ? TEMPLATE_KIND_UNIT : 'quote';
  useEffect(() => {
    let live = true;
    listTemplates(client, userId).then((r) => {
      if (!live) return;
      if (r.ok) { setLoad({ state: 'ready', rows: r.data, text: '' }); setSelectedId(r.data.find((t) => templateKind(t.content) === filter)?.id ?? null); }
      else setLoad({ state: 'error', rows: [], text: errText(C, r) });
    });
    return () => { live = false; };
  }, [client, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = load.rows.filter((r) => templateKind(r.content) === filter);
  const selected = shown.find((r) => r.id === selectedId) || null;
  const usableHere = selected && templateKind(selected.content) === (kind === TEMPLATE_KIND_UNIT ? TEMPLATE_KIND_UNIT : 'quote');
  const remove = async (row) => {
    if (!(await askConfirm(C.confirmDel(row.name), isHebrew, isHebrew ? { yes: 'למחוק', no: 'ביטול', danger: true } : { yes: 'Delete', no: 'Cancel', danger: true }))) return;
    const r = await deleteTemplate(client, userId, row.id);
    if (!r.ok) { setNote(errText(C, r)); return; }
    setNote(''); setDone('');
    setLoad((x) => { const rows = x.rows.filter((t) => t.id !== row.id); return { ...x, rows }; });
    if (selectedId === row.id) setSelectedId(null);
  };
  // Owner console 2026-11-16 (typed: "מאשר עריכת תבנית בחלון בחירת התבנית: שינוי שם, שינוי, מחיקה והוספה של שורות ושמירת התבנית ..."):
  // the selected template is edited right here; "ביטול" / Escape / X return to the list with nothing changed
  const [editing, setEditing] = useState(null);
  const [done, setDone] = useState('');
  // one stable function: the dialog shell re-runs its focus effect whenever onClose changes (a new arrow each render stole the focus per keystroke)
  const cancelEdit = useCallback(() => setEditing(null), []);
  const startEdit = (row) => {
    const rows = templateEditRows(row.content).map((r, i) => ({ ...r, uid: i }));
    setNote(''); setDone('');
    setEditing({ id: row.id, name: row.name, content: row.content, rows, nextUid: rows.length, focusUid: null, phase: 'idle', text: '' });
  };
  const saveEdit = async () => {
    const problem = templateEditProblem(editing.rows);
    if (problem) { setEditing((d) => ({ ...d, phase: 'error', text: C.errors[problem] || C.errors.default })); return; }
    setEditing((d) => ({ ...d, phase: 'saving', text: '' }));
    const r = await updateTemplate(client, userId, editing.id, editing.name, applyTemplateEdits(editing.content, editing.rows));
    if (!r.ok) { setEditing((d) => ({ ...d, phase: 'error', text: r?.error?.code === 'duplicate_name' ? C.duplicateAny : errText(C, r) })); return; }
    setLoad((x) => ({ ...x, rows: x.rows.map((t) => (t.id === r.data.id ? r.data : t)) }));
    setEditing(null); setDone(C.saved);
  };
  if (editing) {
    return (
      <DialogShell titleId="edit-template-title" title={C.editTitle} isHebrew={isHebrew} onClose={cancelEdit} testId="edit-template-dialog">
        <TemplateEditor C={C} isHebrew={isHebrew} draft={editing} setDraft={setEditing} onSave={saveEdit} onCancel={cancelEdit} />
      </DialogShell>
    );
  }
  return (
    <DialogShell titleId="pick-template-title" title={kind === TEMPLATE_KIND_UNIT ? C.pickUnitTitle : C.pickTitle} isHebrew={isHebrew} onClose={onClose} testId="pick-template-dialog">
      {load.state === 'loading' && <p role="status" style={{ fontSize: '0.86rem', color: '#475569' }}>{C.loading}</p>}
      {load.state === 'error' && <p role="alert" data-testid="template-list-error" style={{ fontSize: '0.86rem', color: '#9a3412', fontWeight: 600 }}>{load.text}</p>}
      {load.state === 'ready' && shown.length === 0 && <p data-testid="template-list-empty" style={{ fontSize: '0.86rem', color: '#475569' }}>{filter === TEMPLATE_KIND_UNIT ? C.emptyUnit : C.empty}</p>}
      {shown.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <div role="listbox" aria-label={kind === TEMPLATE_KIND_UNIT ? C.pickUnitTitle : C.pickTitle} style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map((row) => (
              // PRODUCT_TRUTH_CAPABILITY: quote_create
              <button key={row.id} type="button" role="option" aria-selected={row.id === selectedId} data-testid="template-option" onClick={() => setSelectedId(row.id)}
                style={{ minHeight: 44, textAlign: 'start', padding: '8px 12px', borderRadius: 9, border: `2px solid ${row.id === selectedId ? '#102444' : '#e2e8f0'}`, background: row.id === selectedId ? '#e9edf3' : '#fff', color: '#1e293b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', overflowWrap: 'anywhere' }}>
                {row.name}
              </button>
            ))}
          </div>
          {selected && (
            <div data-testid="template-preview" style={{ flex: '2 1 260px', minWidth: 0, border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 800, color: '#1e293b', overflowWrap: 'anywhere' }}>{selected.name}</div>
              <Summary C={C} s={templateSummary(selected.content)} formatMoney={formatMoney} />
              <ol style={{ margin: '8px 0 0', paddingInlineStart: 18, fontSize: '0.8rem', color: '#475569', maxHeight: 180, overflowY: 'auto' }}>
                {(selected.content.items || []).slice(0, 30).map((it, i) => <li key={i} style={{ overflowWrap: 'anywhere' }}>{it.description}</li>)}
              </ol>
              <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: '#475569' }}>{usableHere ? (filter === TEMPLATE_KIND_UNIT ? C.unitHint : C.useHint) : (filter === TEMPLATE_KIND_UNIT ? C.unitElsewhere : C.quoteElsewhere)}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
                <button type="button" data-testid="template-use" disabled={!usableHere} onClick={() => onUse(selected.content)} style={btn(true, !usableHere)}>{filter === TEMPLATE_KIND_UNIT ? C.addUnit : C.use}</button>
                {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
                <button type="button" data-testid="template-edit" onClick={() => startEdit(selected)} style={btn(false, false)}>{C.edit}</button>
                {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
                <button type="button" data-testid="template-delete" onClick={() => remove(selected)} style={{ ...btn(false, false), color: '#b91c1c', borderColor: '#fecaca', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trash2 size={15} aria-hidden="true" />{C.del}</button>
              </div>
            </div>
          )}
        </div>
      )}
      {note && <p role="alert" style={{ margin: '10px 0 0', fontSize: '0.84rem', color: '#991b1b', fontWeight: 700 }}>{note}</p>}
      {done && !note && <p role="status" data-testid="template-edit-saved" style={{ margin: '10px 0 0', fontSize: '0.84rem', color: '#166534', fontWeight: 700 }}>{done}</p>}
    </DialogShell>
  );
}
