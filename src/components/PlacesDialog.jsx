// Unified quote (Owner console 2026-11-11, spec section 1 row 5 + decisions 1 / 4): adding places asks one question per step -
// what (apartment / room / floor / another name) -> how many -> (more than one) "is the work identical?" yes / no. Yes = one group x N
// (filled once); no = N separate groups. Back on every step. When the quote is already divided, the kind is known and only "how many"
// is asked.
import { useEffect, useRef, useState } from 'react';
import { GROUP_KINDS, groupWord } from '../utils/quoteGroups';

export default function PlacesDialog({ open, isHebrew, knownKind = null, onCreate, onClose, onFromTemplate = null }) {
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState('apartment');
  const [count, setCount] = useState('2');
  const [error, setError] = useState('');
  const firstRef = useRef(null);
  useEffect(() => { if (open) { setStep(knownKind ? 1 : 0); setKind(knownKind || 'apartment'); setCount(knownKind ? '1' : '2'); setError(''); } }, [open, knownKind]);
  useEffect(() => { if (open) setTimeout(() => firstRef.current?.focus(), 0); }, [open, step]);
  if (!open) return null;
  const T = (he, en) => (isHebrew ? he : en);
  const plural = groupWord(kind, isHebrew, { plural: true });
  const titles = [T('מה מוסיפים?', 'What would you like to add?'), T(`כמה ${plural}?`, `How many ${plural.toLowerCase()}?`),
    T(`העבודות ב${plural} זהות?`, `Is the work identical in these ${plural.toLowerCase()}?`)];
  const back = () => { setError(''); if (step === 0 || (knownKind && step === 1)) onClose(); else setStep(step - 1); };
  const n = Number(count);
  const continueCount = () => {
    if (!Number.isInteger(n) || n < 1 || n > 20) { setError(T('בחרו מספר שלם בין 1 ל-20.', 'Choose a whole number from 1 to 20.')); return; }
    setError('');
    if (n === 1 || knownKind) { onCreate({ kind, count: n, identical: false }); return; }
    setStep(2);
  };
  return (
    <div className="sq-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sq-places-title" className="sq-dialog" dir={isHebrew ? 'rtl' : 'ltr'} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); back(); } }} data-testid="places-dialog">
        <h2 id="sq-places-title" className="sq-dialog-title">{titles[step]}</h2>
        {error && <p className="sq-dialog-error" role="alert">{error}</p>}
        {step === 0 && (
          <div className="sq-dialog-body sq-dialog-choices">
            {/* PRODUCT_TRUTH_DECORATIVE: chooses the kind of places the quote is divided into (the word every button then uses) */}
            {GROUP_KINDS.map((k, i) => (
              <button key={k} ref={i === 0 ? firstRef : undefined} type="button" className="sq-chip" data-kind={k} onClick={() => { setKind(k); setStep(1); }}>
                {k === 'section' ? T('שם אחר', 'Another name') : groupWord(k, isHebrew)}
              </button>
            ))}
            {typeof onFromTemplate === 'function' && (
              // PRODUCT_TRUTH_DECORATIVE: "from a saved template" - adds one saved group with its work (the unit templates of stage 4)
              <button type="button" className="sq-chip" data-testid="places-from-template" onClick={onFromTemplate}>{T('מתבנית שמורה', 'From a saved template')}</button>
            )}
          </div>
        )}
        {step === 1 && (
          <div className="sq-dialog-body">
            <label className="sq-field">{T('מספר (אפשר לשנות אחר כך)', 'Number (you can change it later)')}
              <input ref={firstRef} type="number" min="1" max="20" step="1" value={count} data-testid="places-count" onChange={(e) => setCount(e.target.value)} />
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="sq-dialog-body">
            <p className="sq-dialog-small">{T(`כן: ממלאים פעם אחת, והסכום מוכפל ב-${n}. לא: כל אחת בנפרד, ואפשר להעתיק מהראשונה.`, `Yes: fill it in once and the amount is multiplied by ${n}. No: each one separately, with a copy-from-the-first button.`)}</p>
            <div className="sq-dialog-choices">
              {/* PRODUCT_TRUTH_DECORATIVE: identical places - one group x N (filled once) */}
              <button ref={firstRef} type="button" className="sq-chip" data-testid="places-identical-yes" onClick={() => onCreate({ kind, count: n, identical: true })}>{T('כן', 'Yes')}</button>
              {/* PRODUCT_TRUTH_DECORATIVE: separate places - N groups */}
              <button type="button" className="sq-chip" data-testid="places-identical-no" onClick={() => onCreate({ kind, count: n, identical: false })}>{T('לא', 'No')}</button>
            </div>
          </div>
        )}
        <div className="sq-dialog-actions">
          {/* PRODUCT_TRUTH_DECORATIVE: one step back in the places window (closes it on the first step) */}
          <button type="button" className="sq-btn" onClick={back}>{T('חזרה', 'Back')}</button>
          {step === 1 && (
            // PRODUCT_TRUTH_DECORATIVE: continues after the number of places
            <button type="button" className="sq-btn sq-btn--primary" data-testid="places-next" onClick={continueCount}>{T('להמשך', 'Continue')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
