// The admin protected-action dialog (Owner 2026-10-16, admin spec §7 + §9): role=dialog + aria-modal, a name and a description, a focus
// trap, Escape closes BEFORE dispatch (never while the server is working), focus returns to the opener, the background is inert. Initial
// focus is the reason field - never the destructive confirm button. AI-HELP-AVAILABILITY-001: the ONE assistant stays reachable inside
// this dialog (the shared AiModalHeader, as in the plans window / item wizard), so the page behind is NOT made inert - the overlay
// blocks the pointer and the focus trap keeps the keyboard inside. Fields: reason + admin password (+ the target email typed for a
// reset / delete). The submit names the action, is disabled while working ("Verifying…") - no double submit.
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, CheckCircle2, X } from 'lucide-react';
import AiModalHeader from './AiModalHeader';
import { DIALOG_COPY as D, t } from '../domain/admin/adminCopy';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AdminProtectedDialog({
  isHebrew, kind, target, reason, onReason, password, onPassword, confirmEmail = null, onConfirmEmail = null,
  busy, error, done = false, disabled = false, onSubmit, onClose, children = null,
}) {
  const copy = D[kind];
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const doneCloseRef = useRef(null);
  const openerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const danger = kind === 'delete' || kind === 'reset';
  const needsEmail = typeof onConfirmEmail === 'function';
  const emailOk = !needsEmail || (confirmEmail || '').trim().toLowerCase() === (target?.email || '').trim().toLowerCase();

  useEffect(() => {
    const opener = openerRef.current;
    (firstFieldRef.current || dialogRef.current)?.focus();
    return () => {
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  useEffect(() => { if (done) doneCloseRef.current?.focus(); }, [done]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { if (!busy) { e.stopPropagation(); onClose(); } return; }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0]; const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const node = (
    <div className="av av-overlay" dir={isHebrew ? 'rtl' : 'ltr'} onKeyDown={onKeyDown}>
      <div ref={dialogRef} className="av-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} tabIndex={-1} data-testid={`admin-dialog-${kind}`}>
        <AiModalHeader onClose={() => { if (!busy) onClose(); }} closeLabel={t(isHebrew, D.close.he, D.close.en)} closeContent={<X size={18} strokeWidth={2.5} />} isHebrew={isHebrew} testId="ai-help-admin-dialog" aiContext="admin_dialog" style={{ color: '#64748b', marginBottom: '6px' }} />
        {done ? (
          <div className="av-result" role="status">
            <div className="av-stateicon" style={{ margin: '0 auto 12px', background: '#e7f4ed', color: '#236241' }}><CheckCircle2 size={28} aria-hidden="true" /></div>
            <h3 id={`${id}-title`}>{t(isHebrew, D.done.he, D.done.en)}</h3>
            <p id={`${id}-desc`} className="av-muted">{t(isHebrew, copy.title.he, copy.title.en)} · <bdi>{target?.business_name || target?.email}</bdi></p>
            <div className="av-dialog-foot" style={{ justifyContent: 'center' }}>
              {/* PRODUCT_TRUTH_DECORATIVE: closes the result of a completed protected action and refreshes the admin data */}
              <button ref={doneCloseRef} type="button" className="av-btn av-primary" onClick={onClose}>{t(isHebrew, D.close.he, D.close.en)}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} autoComplete="off">
            <div className="av-cardhead" style={{ marginBlockEnd: 4 }}>
              <span className="av-lockmark" aria-hidden="true"><Lock size={20} /></span>
              <span className="av-step">{t(isHebrew, D.step.he, D.step.en)}</span>
            </div>
            <h3 id={`${id}-title`}>{t(isHebrew, copy.title.he, copy.title.en)}</h3>
            <div className="av-business"><strong><bdi>{target?.business_name || '—'}</bdi></strong><span className="av-mail">{target?.email}</span></div>
            <p id={`${id}-desc`} className="av-muted av-section">{t(isHebrew, copy.body.he, copy.body.en)}</p>
            {(copy.scope.length > 0 || children) && (
              <div className="av-card av-impact av-section" style={{ boxShadow: 'none' }}>
                {/* the approved dialog sketches: "Impact summary" - label / value rows (current, after the action, payment last) */}
                <h4>{t(isHebrew, D.impact.he, D.impact.en)}</h4>
                {children}
                {copy.scope.map((s, i) => (s.label
                  ? <div key={i} className="av-statline"><span>{t(isHebrew, s.label.he, s.label.en)}</span><strong>{t(isHebrew, s.value.he, s.value.en)}</strong></div>
                  : <div key={i} className="av-statline"><span>{t(isHebrew, s.he, s.en)}</span></div>))}
              </div>
            )}
            <div className={`av-notice ${danger ? '' : 'av-info'} av-section`}>{t(isHebrew, D.recorded.he, D.recorded.en)}</div>
            <label className="av-field">
              <span>{t(isHebrew, D.reason.he, D.reason.en)}</span>
              <textarea ref={firstFieldRef} name={`admin_${kind}_reason`} value={reason} onChange={(e) => onReason(e.target.value)} placeholder={t(isHebrew, D.reasonPh.he, D.reasonPh.en)} required />
            </label>
            <label className="av-field">
              <span>{t(isHebrew, D.password.he, D.password.en)}</span>
              <input type="password" name={`admin_${kind}_pwd_unique`} autoComplete="one-time-code" data-lpignore="true" data-form-type="other" value={password} onChange={(e) => onPassword(e.target.value)} placeholder={t(isHebrew, D.passwordPh.he, D.passwordPh.en)} required />
            </label>
            {needsEmail && (
              <label className="av-field">
                <span>{t(isHebrew, D.confirmEmail.he, D.confirmEmail.en)}</span>
                <input type="text" name={`admin_${kind}_confirm_target`} dir="ltr" autoComplete="off" placeholder={target?.email || ''} value={confirmEmail} onChange={(e) => onConfirmEmail(e.target.value)} required />
                <small><bdi className="av-num">{target?.email}</bdi></small>
              </label>
            )}
            {error && <div className="av-error" role="alert">{error}</div>}
            <div className="av-dialog-foot">
              {/* PRODUCT_TRUTH_DECORATIVE: cancels the protected-action dialog (closed only before sending) */}
              <button type="button" className="av-btn" onClick={onClose} disabled={busy}>{t(isHebrew, D.cancel.he, D.cancel.en)}</button>
              {/* PRODUCT_TRUTH_DECORATIVE: submits the protected action (reason + server-verified admin password) */}
              <button type="submit" className={`av-btn ${danger ? 'av-danger-solid' : 'av-primary'}`} disabled={disabled || busy || !emailOk}>
                <Lock size={16} aria-hidden="true" />{busy ? t(isHebrew, D.verifying.he, D.verifying.en) : t(isHebrew, copy.confirm.he, copy.confirm.en)}
              </button>
            </div>
            <div className="av-notice av-info av-section">{t(isHebrew, D.unknownOutcome.he, D.unknownOutcome.en)}</div>
          </form>
        )}
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
}
