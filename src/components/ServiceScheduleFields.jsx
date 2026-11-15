// Task 27 (P2, spec §6): the OPTIONAL work / delivery / event date (+ optional time) of a quote. It is NOT the acceptance validity
// ("Valid until") and is never shown to the customer; it feeds the internal calendar only. Same typed-date pattern as "Valid until"
// (account date format + the native picker); dates and times are LTR atoms. Disabled while loading, when the server does not have the
// feature yet ('unavailable' - stated, never faked), or when the saved value could not be read ('error' - so it is never overwritten blind).
// 2026-11-15 (the approved demo, "פרויקט, כתובת ותוקף"): two full-width fields, each with its own "?" - "תאריך העבודה (לא חובה)" and
// "שעת הגעה (לא חובה)"; the explanation that was a line under them is the date's "?" text (nothing is dropped). The date field is
// built like the validity field above it (the same mirroring: the digits LTR, aligned to the language's start, the calendar at the end).
import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { HelpCircle } from './quoteTree/QuoteTreeEditor';
import { normalizeServiceSchedule } from '../utils/serviceScheduleClient';

const NOTE = {
  unavailable: ['תאריך העבודה עדיין לא זמין בשרת הזה - ההצעה נשמרת כרגיל בלעדיו.', 'A work date is not available on this server yet - the quote saves normally without it.'],
  error: ['לא ניתן היה לטעון את תאריך העבודה השמור, ולכן אי אפשר לשנות אותו כרגע.', 'The saved work date could not be loaded, so it cannot be changed right now.'],
  loading: ['טוען את תאריך העבודה…', 'Loading the work date...'],
  time_without_date: ['כדי לשמור שעה יש לבחור גם תאריך.', 'Choose a date to keep a time.'],
  invalid_date: ['התאריך אינו תקין.', 'The date is not valid.'],
  invalid_time: ['השעה אינה תקינה.', 'The time is not valid.'],
};

export default function ServiceScheduleFields({ value, onChange, state = 'ready', isHebrew, isUS = false }) {
  const pickerRef = useRef(null);
  const L = (pair) => (isHebrew ? pair[0] : pair[1]);
  const v = { date: value?.date || '', time: value?.time || '' };
  const disabled = state !== 'ready';
  // IRON-DATE-001: the product's slash date, as in the validity field beside it (Codex spec item 5); typed digits are read as before
  const formatLabel = isUS ? 'MM/DD/YYYY' : 'DD/MM/YYYY';
  const display = (iso) => {
    const p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '';
    const [y, m, d] = p;
    return isUS ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
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
  const dateLabel = L(['תאריך העבודה (לא חובה)', 'Work date (optional)']);
  const timeLabel = L(['שעת הגעה (לא חובה)', 'Arrival time (optional)']);
  const atom = { direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' };
  return (
    <div data-testid="service-schedule" data-state={state} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="qt-field">
        <div className="qt-page-label">
          <label htmlFor="sq-service-date">{dateLabel} <span className="sq-nowrap">({formatLabel})</span></label>
          <HelpCircle inline testId="sq-help-service-date" label={L(['הסבר: תאריך העבודה', 'Explain: work date'])}
            text={L(['מועד העבודה, האספקה או האירוע. נפרד מתוקף ההצעה, לא מוצג ללקוח, ומופיע ביומן הפנימי.', 'When the work, delivery or event happens. Separate from the quote validity, not shown to the customer, and listed in your internal calendar.'])} />
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input id="sq-service-date" data-testid="service-date" className="qt-input" type="text" inputMode="numeric" value={display(v.date)} onChange={onTyped} placeholder={formatLabel} disabled={disabled}
            style={{ ...atom, ...(isHebrew ? { paddingLeft: '36px' } : { paddingRight: '36px' }) }} />
          <input type="date" ref={pickerRef} value={/^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : ''} onChange={(e) => onChange({ ...v, date: e.target.value })} tabIndex={-1} aria-hidden="true"
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
          {/* PRODUCT_TRUTH_DECORATIVE: opens the native date picker for the optional work date; a generic form-field interaction helper */}
          <button type="button" disabled={disabled} aria-label={L(['בחירת תאריך העבודה', 'Pick a work date'])}
            onClick={() => { const el = pickerRef.current; if (!el) return; if (typeof el.showPicker === 'function') el.showPicker(); else el.click(); }}
            style={{ position: 'absolute', insetInlineEnd: '6px', background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', color: '#64748b', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, minHeight: 32 }}>
            <Calendar size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="qt-field">
        <div className="qt-page-label">
          <label htmlFor="sq-service-time">{timeLabel}</label>
          <HelpCircle inline testId="sq-help-service-time" label={L(['הסבר: שעת הגעה', 'Explain: arrival time'])}
            text={L(['השעה המתוכננת להגעה. אפשר לבחור שעה אחרי שבוחרים תאריך.', 'The planned arrival time. You can choose a time after choosing a date.'])} />
        </div>
        <input id="sq-service-time" data-testid="service-time" className="qt-input" type="time" step={60} value={v.time} onChange={(e) => onChange({ ...v, time: e.target.value })} disabled={disabled || !v.date} style={atom} />
      </div>
      {note && <div data-testid="service-schedule-note" role="status" style={{ fontSize: '0.75rem', fontWeight: 600, color: state === 'loading' ? '#64748b' : '#9a3412' }}>{L(note)}</div>}
    </div>
  );
}
