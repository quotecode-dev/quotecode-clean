// Task 27 (P2, spec §6): the OPTIONAL work / delivery / event date (+ optional time) of a quote. It is NOT the acceptance validity
// ("Valid until") and is never shown to the customer; it feeds the internal calendar only. Same typed-date pattern as "Valid until"
// (account date format + the native picker); dates and times are LTR atoms. Disabled while loading, when the server does not have the
// feature yet ('unavailable' - stated, never faked), or when the saved value could not be read ('error' - so it is never overwritten blind).
import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { APP as NEON } from '../theme/neonTheme';
import { normalizeServiceSchedule } from '../utils/serviceScheduleClient';

const NOTE = {
  unavailable: ['תאריך ביצוע עדיין לא זמין בשרת הזה - ההצעה נשמרת כרגיל בלעדיו.', 'A work date is not available on this server yet - the quote saves normally without it.'],
  error: ['לא ניתן היה לטעון את תאריך הביצוע השמור, ולכן אי אפשר לשנות אותו כרגע.', 'The saved work date could not be loaded, so it cannot be changed right now.'],
  loading: ['טוען תאריך ביצוע...', 'Loading the work date...'],
  time_without_date: ['כדי לשמור שעה יש לבחור גם תאריך.', 'Choose a date to keep a time.'],
  invalid_date: ['התאריך אינו תקין.', 'The date is not valid.'],
  invalid_time: ['השעה אינה תקינה.', 'The time is not valid.'],
};

export default function ServiceScheduleFields({ value, onChange, state = 'ready', isHebrew, isUS = false }) {
  const pickerRef = useRef(null);
  const L = (pair) => (isHebrew ? pair[0] : pair[1]);
  const v = { date: value?.date || '', time: value?.time || '' };
  const disabled = state !== 'ready';
  const formatLabel = isUS ? 'MM-DD-YYYY' : 'DD-MM-YYYY';
  const display = (iso) => {
    const p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '';
    const [y, m, d] = p;
    return isUS ? `${m}-${d}-${y}` : `${d}-${m}-${y}`;
  };
  const onTyped = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (digits.length === 8) {
      const a = digits.slice(0, 2); const b = digits.slice(2, 4); const y = digits.slice(4, 8);
      onChange({ ...v, date: isUS ? `${y}-${a}-${b}` : `${y}-${b}-${a}` });
    } else onChange({ ...v, date: e.target.value });
  };
  const check = normalizeServiceSchedule(v);
  const note = disabled ? NOTE[state] : (!check.ok ? NOTE[check.error] : null);
  const inputStyle = { width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', background: disabled ? NEON.bgCardAlt : NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' };
  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' };
  return (
    <div data-testid="service-schedule" data-state={state} style={{ marginTop: '4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <div>
          <label htmlFor="sq-service-date" style={labelStyle}>
            {L(['תאריך ביצוע (לא חובה)', 'Work date (optional)'])} <bdi className="pf-num" dir="ltr" style={{ color: NEON.violetLight, fontWeight: 'bold', whiteSpace: 'nowrap' }}>({formatLabel})</bdi>
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input id="sq-service-date" data-testid="service-date" type="text" inputMode="numeric" value={display(v.date)} onChange={onTyped} placeholder={formatLabel} disabled={disabled}
              style={{ ...inputStyle, padding: '7px 32px 7px 10px' }} />
            <input type="date" ref={pickerRef} value={/^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : ''} onChange={(e) => onChange({ ...v, date: e.target.value })} tabIndex={-1} aria-hidden="true"
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
            {/* PRODUCT_TRUTH_DECORATIVE: opens the native date picker for the optional work date; a generic form-field interaction helper */}
            <button type="button" disabled={disabled} aria-label={L(['בחירת תאריך ביצוע', 'Pick a work date'])}
              onClick={() => { const el = pickerRef.current; if (!el) return; if (typeof el.showPicker === 'function') el.showPicker(); else el.click(); }}
              style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', color: NEON.textMuted, padding: 0, display: 'flex', alignItems: 'center' }}>
              <Calendar size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="sq-service-time" style={labelStyle}>{L(['שעה (לא חובה)', 'Time (optional)'])}</label>
          <input id="sq-service-time" data-testid="service-time" type="time" step={60} value={v.time} onChange={(e) => onChange({ ...v, time: e.target.value })} disabled={disabled || !v.date} style={inputStyle} />
        </div>
      </div>
      <div style={{ marginTop: '4px', fontSize: '0.72rem', color: NEON.textMuted }}>
        {L(['מועד העבודה, האספקה או האירוע. נפרד מתוקף ההצעה, לא מוצג ללקוח, ומופיע ביומן הפנימי.', 'When the work, delivery or event happens. Separate from the quote validity, not shown to the customer, and listed in your internal calendar.'])}
      </div>
      {note && <div data-testid="service-schedule-note" role="status" style={{ marginTop: '4px', fontSize: '0.75rem', fontWeight: 600, color: state === 'loading' ? NEON.textMuted : '#9a3412' }}>{L(note)}</div>}
    </div>
  );
}
