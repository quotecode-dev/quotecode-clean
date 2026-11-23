// Owner 2026-11-11 (finding 1, option ב; typed L-15): the first "new quote" with business details still missing no longer sends the user
// to Business Settings. A small window asks ONLY for the missing required details (the list is unchanged - utils/businessProfileCompleteness.js:
// phone, in Israel also the tax id, and the business name / email when they are missing). "Continue" saves them into the business settings
// and the quote opens at once. Cancel changes nothing.
import { useEffect, useRef, useState } from 'react';
import { X, Building2 } from 'lucide-react';
import useFocusTrap from './quotePresentation/useFocusTrap';
import { getMissingBusinessProfileFields } from '../utils/businessProfileCompleteness';
import { businessDial, joinPhone } from '../utils/phoneDial';

const COPY = {
  he: {
    title: 'עוד רגע מתחילים',
    intro: 'כדי שההצעה תצא עם פרטי העסק, חסרים כמה פרטים. הם נשמרים בהגדרות העסק.',
    phone: 'טלפון העסק', taxId: 'ח.פ / עוסק מורשה / פטור', name: 'שם העסק', email: 'כתובת המייל של העסק',
    phonePh: '050-1234567', taxPh: '516000000', namePh: 'לדוגמה: שיפוצים כהן', emailPh: 'business@example.com',
    cont: 'המשך', saving: 'שומרים…', cancel: 'ביטול', close: 'סגירה',
    missing: 'צריך למלא את כל השדות כדי להמשיך.', failed: 'לא הצלחנו לשמור את הפרטים. נסו שוב.',
  },
  en: {
    title: 'Almost ready to start',
    intro: 'Your quote needs a few business details. They are saved in Business Settings.',
    phone: 'Business Phone', taxId: 'Tax ID', name: 'Business Name', email: 'Business Email',
    phonePh: '(555) 123-4567', taxPh: '', namePh: 'e.g. Smith Renovations', emailPh: 'business@example.com',
    cont: 'Continue', saving: 'Saving…', cancel: 'Cancel', close: 'Close',
    missing: 'Fill in every field to continue.', failed: 'The details could not be saved. Please try again.',
  },
};

const field = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '16px', fontFamily: 'inherit', minHeight: 44 };
const btn = (primary, disabled) => ({ flex: '1 1 0', minWidth: 0, minHeight: 44, padding: '4px 12px', borderRadius: 9, border: primary ? 'none' : '1px solid #94a3b8', background: disabled ? '#e2e8f0' : (primary ? '#0F6672' : '#fff'), color: disabled ? '#64748b' : (primary ? '#fff' : '#1e293b'), fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' });

// missing = the keys getMissingBusinessProfileFields returned; onSave({ phone?, taxId?, name?, email? }) -> Promise<boolean>
export default function ProfileGateDialog({ open, missing = [], isHebrew, isLocalIsraeliBusiness, currency, onSave, onClose }) {
  const C = COPY[isHebrew ? 'he' : 'en'];
  const ref = useRef(null);
  const [values, setValues] = useState({ phone: '', taxId: '', name: '', email: '' });
  const [state, setState] = useState({ phase: 'idle', text: '' });
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return undefined;
    setValues({ phone: '', taxId: '', name: '', email: '' });
    setState({ phase: 'idle', text: '' });
    const prev = document.activeElement;
    ref.current?.querySelector('input')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (prev && typeof prev.focus === 'function') prev.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  const dial = businessDial({ isLocal: isLocalIsraeliBusiness === true, currency }).dial;
  const ask = (k) => missing.includes(k);
  const fields = () => ({
    ...(ask('phone') ? { phone: joinPhone(dial, values.phone) } : {}),
    ...(ask('taxId') ? { taxId: values.taxId.trim() } : {}),
    ...(ask('name') ? { name: values.name.trim() } : {}),
    ...(ask('email') ? { email: values.email.trim() } : {}),
  });
  const submit = async (e) => {
    e.preventDefault();
    const f = fields();
    // the same rule as the gate itself: nothing that would still be missing is saved
    const still = getMissingBusinessProfileFields({ phone: f.phone ?? 'x x', taxId: f.taxId ?? 'x', isLocalIsraeliBusiness, name: f.name ?? 'x', email: f.email ?? 'a@b.co' });
    if (still.length) { setState({ phase: 'error', text: C.missing }); return; }
    setState({ phase: 'saving', text: '' });
    const ok = await Promise.resolve(onSave(f)).catch(() => false);
    if (!ok) setState({ phase: 'error', text: C.failed });
  };
  const input = (k, label, extra = {}) => (
    <div key={k} style={{ marginTop: 10 }}>
      <label htmlFor={`profile-gate-${k}`} style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{label}</label>
      <input id={`profile-gate-${k}`} data-testid={`profile-gate-${k}`} value={values[k]} required
        onChange={(e) => { const v = e.target.value; setValues((x) => ({ ...x, [k]: v })); setState({ phase: 'idle', text: '' }); }}
        style={field} {...extra} />
    </div>
  );
  const saving = state.phase === 'saving';
  return (
    <div className="no-print" data-testid="profile-gate-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: 16 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="profile-gate-title" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="profile-gate-dialog"
        style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', padding: 20, boxSizing: 'border-box', textAlign: 'start', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h2 id="profile-gate-title" style={{ margin: 0, fontSize: '1.15rem', color: '#0F6672', display: 'flex', alignItems: 'center', gap: 8 }}><Building2 size={19} aria-hidden="true" />{C.title}</h2>
          {/* PRODUCT_TRUTH_DECORATIVE: closes the business-details window; nothing is saved and no quote opens */}
          <button type="button" onClick={onClose} aria-label={C.close}
            style={{ minWidth: 44, minHeight: 44, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p style={{ margin: '8px 0 0', color: '#334155', fontSize: '0.88rem', lineHeight: 1.5 }}>{C.intro}</p>
        <form onSubmit={submit} noValidate>
          {ask('name') && input('name', C.name, { placeholder: C.namePh, autoComplete: 'organization' })}
          {ask('phone') && (
            <div style={{ marginTop: 10 }}>
              <label htmlFor="profile-gate-phone" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{C.phone}</label>
              <div style={{ display: 'flex', direction: 'ltr', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
                <span style={{ padding: '0 10px', display: 'flex', alignItems: 'center', background: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', flex: 'none' }}><bdi dir="ltr">{dial}</bdi></span>
                <input id="profile-gate-phone" data-testid="profile-gate-phone" type="tel" inputMode="tel" autoComplete="tel-national" required value={values.phone}
                  placeholder={C.phonePh} onChange={(e) => { const v = e.target.value; setValues((x) => ({ ...x, phone: v })); setState({ phase: 'idle', text: '' }); }}
                  style={{ ...field, border: 'none', borderRadius: 0, direction: 'ltr', textAlign: 'left', minWidth: 0, flex: 1 }} />
              </div>
            </div>
          )}
          {ask('taxId') && input('taxId', C.taxId, { placeholder: C.taxPh, inputMode: 'numeric', dir: 'ltr', style: { ...field, direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' } })}
          {ask('email') && input('email', C.email, { type: 'email', placeholder: C.emailPh, autoComplete: 'email', dir: 'ltr', style: { ...field, direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' } })}
          {state.text && <p role="alert" data-testid="profile-gate-error" style={{ margin: '10px 0 0', color: '#991b1b', fontWeight: 700, fontSize: '0.84rem' }}>{state.text}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {/* PRODUCT_TRUTH_DECORATIVE: saves only the missing required business details, then opens the quote the user asked for */}
            <button type="submit" data-testid="profile-gate-continue" disabled={saving} style={btn(true, saving)}>{saving ? C.saving : C.cont}</button>
            {/* PRODUCT_TRUTH_DECORATIVE: closes the business-details window; nothing is saved and no quote opens */}
            <button type="button" onClick={onClose} style={btn(false, false)}>{C.cancel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
