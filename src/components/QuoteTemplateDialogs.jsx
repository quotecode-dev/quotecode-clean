// Task 27 (P2, spec §6): whole-quote templates - "Save as template" (from the open quote editor; the owner chooses what to keep) and
// "Start from a template" (list -> preview -> use). Using a template only opens a NEW unsaved quote form through the caller's normal
// new-quote path (the Free-10 check runs there first); nothing is saved, issued or sent. A template never holds a customer, contact,
// number, status, signature, payment, link or date (quoteTemplates.js; the database refuses them too). Amounts / counts are LTR atoms.
import { useEffect, useRef, useState } from 'react';
import { X, LayoutTemplate, Trash2 } from 'lucide-react';
import useFocusTrap from './quotePresentation/useFocusTrap';
import { DEFAULT_TEMPLATE_KEEP, TEMPLATE_NAME_MAX, buildTemplateContent, templateSummary } from '../utils/quoteTemplates';
import { createTemplate, deleteTemplate, listTemplates } from '../utils/quoteTemplatesClient';

const COPY = {
  he: {
    saveTitle: 'שמירה כתבנית', pickTitle: 'התחלה מתבנית שמורה', close: 'סגירה', cancel: 'ביטול',
    name: 'שם התבנית', namePh: 'לדוגמה: שיפוץ אמבטיה בסיסי',
    keep: 'מה לשמור בתבנית', keepPrices: 'מחירים', keepTexts: 'תנאים, אחריות והערות', keepSubject: 'נושא ושם פרויקט', keepPresentation: 'עיצוב ותמונות',
    never: 'לא נשמרים לעולם: לקוח ואיש קשר, מספר הצעה, סטטוס, חתימה, תשלום, קישור ותאריכים.',
    save: 'שמירת התבנית', saving: 'שומר...', saved: 'התבנית נשמרה.',
    noItems: 'אין בהצעה פריטים לשמירה כתבנית.', loading: 'טוען תבניות...', empty: 'אין עדיין תבניות שמורות. פתחו הצעה ובחרו "שמירה כתבנית".',
    use: 'שימוש בתבנית', del: 'מחיקה', confirmDel: (n) => `למחוק את התבנית "${n}"? אי אפשר לשחזר אותה.`,
    items: 'פריטים', sections: 'חלקים', subtotal: 'סכום לפני מע"מ והנחה', noPrices: 'ללא מחירים', texts: 'כולל תנאים / אחריות / הערות', presentation: 'כולל עיצוב ותמונות',
    useHint: 'נפתחת הצעה חדשה ולא שמורה; הלקוח, התוקף והתאריכים מתמלאים מחדש.',
    errors: {
      unavailable: 'תבניות עדיין לא זמינות בשרת הזה. ההצעות עצמן ממשיכות לעבוד כרגיל.', duplicate_name: 'כבר יש תבנית בשם הזה. בחרו שם אחר.',
      name_required: 'יש לתת שם לתבנית.', name_too_long: `השם ארוך מ-${TEMPLATE_NAME_MAX} תווים.`, too_large: 'התבנית גדולה מדי לשמירה.',
      default: 'הפעולה נכשלה. שום דבר לא שונה.',
    },
  },
  en: {
    saveTitle: 'Save as template', pickTitle: 'Start from a saved template', close: 'Close', cancel: 'Cancel',
    name: 'Template name', namePh: 'e.g. Basic bathroom renovation',
    keep: 'What to keep in the template', keepPrices: 'Prices', keepTexts: 'Terms, warranty and notes', keepSubject: 'Subject and project name', keepPresentation: 'Design and images',
    never: 'Never kept: the customer and contact, quote number, status, signature, payment, link and dates.',
    save: 'Save template', saving: 'Saving...', saved: 'Template saved.',
    noItems: 'This quote has no items to save as a template.', loading: 'Loading templates...', empty: 'No saved templates yet. Open a quote and choose "Save as template".',
    use: 'Use template', del: 'Delete', confirmDel: (n) => `Delete the template "${n}"? It cannot be restored.`,
    items: 'Items', sections: 'Sections', subtotal: 'Amount before tax and discount', noPrices: 'No prices', texts: 'Includes terms / warranty / notes', presentation: 'Includes design and images',
    useHint: 'Opens a new, unsaved quote; the customer, validity and dates are filled in fresh.',
    errors: {
      unavailable: 'Templates are not available on this server yet. Quotes themselves keep working normally.', duplicate_name: 'A template with this name already exists. Choose another name.',
      name_required: 'Give the template a name.', name_too_long: `The name is longer than ${TEMPLATE_NAME_MAX} characters.`, too_large: 'The template is too large to save.',
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
const btn = (primary, disabled) => ({ minHeight: 44, padding: '0 16px', borderRadius: 9, border: primary ? 'none' : '1px solid #94a3b8', background: disabled ? '#e2e8f0' : (primary ? '#0F6672' : '#fff'), color: disabled ? '#64748b' : (primary ? '#fff' : '#1e293b'), fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' });

function Summary({ C, s, formatMoney }) {
  if (!s) return null;
  return (
    <ul data-testid="template-summary" style={{ margin: '6px 0 0', paddingInlineStart: 18, fontSize: '0.82rem', color: '#334155' }}>
      <li>{C.items}: <bdi className="pf-num" dir="ltr">{s.itemCount}</bdi>{s.sectionCount ? <> · {C.sections}: <bdi className="pf-num" dir="ltr">{s.sectionCount}</bdi></> : null}</li>
      <li>{s.hasPrices ? <>{C.subtotal}: <bdi className="pf-num" dir="ltr">{formatMoney(s.subtotal)}</bdi></> : C.noPrices}</li>
      {s.hasTexts && <li>{C.texts}</li>}
      {s.hasPresentation && <li>{C.presentation}</li>}
    </ul>
  );
}

// PRODUCT_TRUTH_CAPABILITY: quote_create
export function SaveTemplateDialog({ isHebrew, client, userId, form, formatMoney, onClose, onSaved = null }) {
  const C = COPY[isHebrew ? 'he' : 'en'];
  const [name, setName] = useState('');
  const [keep, setKeep] = useState({ ...DEFAULT_TEMPLATE_KEEP });
  const [state, setState] = useState({ phase: 'idle', text: '' });
  const preview = templateSummary(buildTemplateContent(form, keep));
  const noItems = !preview || preview.itemCount === 0;
  const submit = async (e) => {
    e.preventDefault();
    setState({ phase: 'saving', text: '' });
    const r = await createTemplate(client, userId, name, form, keep);
    if (r.ok) { setState({ phase: 'saved', text: C.saved }); if (typeof onSaved === 'function') onSaved(r.data); }
    else setState({ phase: 'error', text: errText(C, r) });
  };
  const box = (k, label) => (
    <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, fontSize: '0.86rem', color: '#1e293b', cursor: 'pointer' }}>
      <input type="checkbox" data-testid={`template-keep-${k}`} checked={keep[k]} onChange={(e) => setKeep((x) => ({ ...x, [k]: e.target.checked }))} />{label}
    </label>
  );
  return (
    <DialogShell titleId="save-template-title" title={C.saveTitle} isHebrew={isHebrew} onClose={onClose} testId="save-template-dialog">
      <form onSubmit={submit}>
        <label htmlFor="template-name" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{C.name}</label>
        <input id="template-name" data-testid="template-name" value={name} maxLength={TEMPLATE_NAME_MAX} placeholder={C.namePh} onChange={(e) => { setName(e.target.value); setState({ phase: 'idle', text: '' }); }}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '16px', fontFamily: 'inherit' }} />
        <fieldset style={{ border: 'none', padding: 0, margin: '12px 0 0' }}>
          <legend style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{C.keep}</legend>
          {box('prices', C.keepPrices)}{box('texts', C.keepTexts)}{box('subject', C.keepSubject)}{box('presentation', C.keepPresentation)}
        </fieldset>
        <p data-testid="template-never" style={{ margin: '8px 0 0', fontSize: '0.78rem', color: '#475569' }}>{C.never}</p>
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

// PRODUCT_TRUTH_CAPABILITY: quote_create
export function TemplatePickerDialog({ isHebrew, client, userId, formatMoney, onClose, onUse }) {
  const C = COPY[isHebrew ? 'he' : 'en'];
  const [load, setLoad] = useState({ state: 'loading', rows: [], text: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    let live = true;
    listTemplates(client, userId).then((r) => {
      if (!live) return;
      if (r.ok) { setLoad({ state: 'ready', rows: r.data, text: '' }); setSelectedId(r.data[0]?.id ?? null); }
      else setLoad({ state: 'error', rows: [], text: errText(C, r) });
    });
    return () => { live = false; };
  }, [client, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = load.rows.find((r) => r.id === selectedId) || null;
  const remove = async (row) => {
    if (!window.confirm(C.confirmDel(row.name))) return;
    const r = await deleteTemplate(client, userId, row.id);
    if (!r.ok) { setNote(errText(C, r)); return; }
    setNote('');
    setLoad((x) => { const rows = x.rows.filter((t) => t.id !== row.id); return { ...x, rows }; });
    if (selectedId === row.id) setSelectedId(null);
  };
  return (
    <DialogShell titleId="pick-template-title" title={C.pickTitle} isHebrew={isHebrew} onClose={onClose} testId="pick-template-dialog">
      {load.state === 'loading' && <p role="status" style={{ fontSize: '0.86rem', color: '#475569' }}>{C.loading}</p>}
      {load.state === 'error' && <p role="alert" data-testid="template-list-error" style={{ fontSize: '0.86rem', color: '#9a3412', fontWeight: 600 }}>{load.text}</p>}
      {load.state === 'ready' && load.rows.length === 0 && <p data-testid="template-list-empty" style={{ fontSize: '0.86rem', color: '#475569' }}>{C.empty}</p>}
      {load.rows.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <div role="listbox" aria-label={C.pickTitle} style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {load.rows.map((row) => (
              // PRODUCT_TRUTH_CAPABILITY: quote_create
              <button key={row.id} type="button" role="option" aria-selected={row.id === selectedId} data-testid="template-option" onClick={() => setSelectedId(row.id)}
                style={{ minHeight: 44, textAlign: 'start', padding: '8px 12px', borderRadius: 9, border: `2px solid ${row.id === selectedId ? '#0F6672' : '#e2e8f0'}`, background: row.id === selectedId ? '#E3F1F2' : '#fff', color: '#1e293b', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', overflowWrap: 'anywhere' }}>
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
              <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: '#475569' }}>{C.useHint}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
                <button type="button" data-testid="template-use" onClick={() => onUse(selected.content)} style={btn(true, false)}>{C.use}</button>
                {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
                <button type="button" data-testid="template-delete" onClick={() => remove(selected)} style={{ ...btn(false, false), color: '#b91c1c', borderColor: '#fecaca', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trash2 size={15} aria-hidden="true" />{C.del}</button>
              </div>
            </div>
          )}
        </div>
      )}
      {note && <p role="alert" style={{ margin: '10px 0 0', fontSize: '0.84rem', color: '#991b1b', fontWeight: 700 }}>{note}</p>}
    </DialogShell>
  );
}
